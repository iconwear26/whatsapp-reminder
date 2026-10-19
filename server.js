const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const webpush = require('web-push');
const QRCode = require('qrcode');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { dbAsync } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'reminder_me_super_secret_jwt_key_2026';
const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'deepakprajapat8529@gmail.com').toLowerCase().trim();

// Razorpay Config (Keys from env or fallback test mode)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_placeholder_secret'
});

// WebPush VAPID config
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'UUxI4g7_8u_M9U53P72P_tA6y56o2k_cEaJ4i7XgKls'
};
webpush.setVapidDetails('mailto:supportrememberme@gmail.com', vapidKeys.publicKey, vapidKeys.privateKey);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data folder exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const AUTH_DIR = path.join(DATA_DIR, 'auth_baileys');

// WhatsApp State Variables
let sock = null;
let currentQR = null;
let currentQRImage = null;
let isWAConnected = false;
let loggedInUserWA = '';

function sanitizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

// WhatsApp Baileys Connection
async function startWhatsAppBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: 'silent' }),
      browser: ['Reminder Me App', 'Chrome', '1.0.0']
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        try {
          currentQRImage = await QRCode.toDataURL(qr, {
            width: 280,
            margin: 2,
            color: { dark: '#0F5132', light: '#FFFFFF' }
          });
        } catch (qrErr) {
          console.error('[WhatsApp] QR generation error:', qrErr);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        isWAConnected = false;
        currentQR = null;
        currentQRImage = null;

        if (statusCode === DisconnectReason.loggedOut) {
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch (e) {}
        }

        if (shouldReconnect) {
          setTimeout(startWhatsAppBot, 3000);
        }
      } else if (connection === 'open') {
        isWAConnected = true;
        currentQR = null;
        currentQRImage = null;
        const userJid = sock.user?.id || '';
        loggedInUserWA = userJid.split(':')[0] || userJid.split('@')[0];
        console.log(`[WhatsApp] Ready as +${loggedInUserWA}`);
      }
    });

    sock.ev.on('creds.update', saveCreds);
  } catch (err) {
    console.error('[WhatsApp] Init error:', err);
    setTimeout(startWhatsAppBot, 5000);
  }
}
startWhatsAppBot();

// Unified Send WhatsApp Message Handler
async function sendAnyWhatsAppMessage(targetPhone, message) {
  if (isWAConnected && sock) {
    const clean = sanitizePhone(targetPhone) || loggedInUserWA;
    const recipientJid = `${clean}@s.whatsapp.net`;
    console.log(`[WhatsApp] Sending to ${recipientJid}...`);
    await sock.sendMessage(recipientJid, { text: message });
    return { method: 'direct', recipient: clean };
  }
  throw new Error('WhatsApp is not connected in admin panel!');
}

// Send Web Push Notification to User
async function sendWebPushToUser(userId, payload) {
  try {
    const subs = await dbAsync.all('SELECT * FROM push_subscriptions WHERE userId = ?', [userId]);
    const payloadStr = JSON.stringify(payload);
    for (const sub of subs) {
      try {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: JSON.parse(sub.keys)
        };
        await webpush.sendNotification(pushConfig, payloadStr);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await dbAsync.run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
        }
      }
    }
  } catch (err) {
    console.error('Error dispatching web push:', err);
  }
}

// JWT Authentication Middleware
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await dbAsync.get('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return res.status(401).json({ error: 'User session not found' });
    }

    // Check Plan Status / Trial Expired
    const now = new Date();
    const isOwner = user.email.toLowerCase() === OWNER_EMAIL || user.isOwner === 1;

    let hasActiveAccess = true;
    let trialDaysLeft = 0;

    if (isOwner) {
      hasActiveAccess = true;
    } else if (user.planStatus === 'trial') {
      const trialEnds = new Date(user.trialEndsAt);
      if (now > trialEnds) {
        hasActiveAccess = false;
        trialDaysLeft = 0;
      } else {
        trialDaysLeft = Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24));
        hasActiveAccess = true;
      }
    } else if (['monthly', 'yearly', 'coupon_lifetime', 'owner'].includes(user.planStatus)) {
      if (user.subscriptionExpiresAt) {
        const expires = new Date(user.subscriptionExpiresAt);
        if (now > expires) {
          hasActiveAccess = false;
        }
      }
    }

    req.user = user;
    req.isOwner = isOwner;
    req.hasActiveAccess = hasActiveAccess;
    req.trialDaysLeft = trialDaysLeft;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

// Require Owner Middleware
function ownerMiddleware(req, res, next) {
  if (!req.isOwner) {
    return res.status(403).json({ error: 'Access denied: Owner privileges required' });
  }
  next();
}

// -------------------------------------------------------------
// AUTH & USER ROUTES
// -------------------------------------------------------------

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { fullName, email, phone, password, agreedTerms } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!agreedTerms) {
      return res.status(400).json({ error: 'Please accept Terms of Service & Privacy Policy' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = sanitizePhone(phone);

    const existing = await dbAsync.get('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ error: 'Account already exists with this Email' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const isOwner = cleanEmail === OWNER_EMAIL;
    const now = new Date();
    const trialEnds = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // Strict 10-day trial

    const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const planStatus = isOwner ? 'owner' : 'trial';

    await dbAsync.run(`
      INSERT INTO users (id, fullName, email, phone, passwordHash, planStatus, trialEndsAt, subscriptionExpiresAt, isOwner, createdAt, lastLoginAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      fullName.trim(),
      cleanEmail,
      cleanPhone,
      passwordHash,
      planStatus,
      trialEnds.toISOString(),
      isOwner ? null : null,
      isOwner ? 1 : 0,
      now.toISOString(),
      now.toISOString()
    ]);

    // 365-day persistent JWT token
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '365d' });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        fullName: fullName.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        planStatus,
        trialEndsAt: trialEnds.toISOString(),
        trialDaysLeft: 10,
        isOwner,
        hasActiveAccess: true
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and Password are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await dbAsync.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid Email or Password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid Email or Password' });
    }

    // Update last login
    await dbAsync.run('UPDATE users SET lastLoginAt = ? WHERE id = ?', [new Date().toISOString(), user.id]);

    const isOwner = cleanEmail === OWNER_EMAIL || user.isOwner === 1;
    const now = new Date();
    let hasActiveAccess = true;
    let trialDaysLeft = 0;

    if (isOwner) {
      hasActiveAccess = true;
    } else if (user.planStatus === 'trial') {
      const trialEnds = new Date(user.trialEndsAt);
      if (now > trialEnds) {
        hasActiveAccess = false;
        trialDaysLeft = 0;
      } else {
        trialDaysLeft = Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24));
        hasActiveAccess = true;
      }
    } else if (['monthly', 'yearly', 'coupon_lifetime', 'owner'].includes(user.planStatus)) {
      if (user.subscriptionExpiresAt) {
        hasActiveAccess = now <= new Date(user.subscriptionExpiresAt);
      }
    }

    // Persistent 365-day token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '365d' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        planStatus: user.planStatus,
        trialEndsAt: user.trialEndsAt,
        trialDaysLeft,
        isOwner,
        hasActiveAccess
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Current User Profile & Subscription Status
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      fullName: req.user.fullName,
      email: req.user.email,
      phone: req.user.phone,
      planStatus: req.user.planStatus,
      trialEndsAt: req.user.trialEndsAt,
      trialDaysLeft: req.trialDaysLeft,
      subscriptionExpiresAt: req.user.subscriptionExpiresAt,
      isOwner: req.isOwner,
      hasActiveAccess: req.hasActiveAccess
    }
  });
});

// Delete My Account (DPDP Compliance)
app.delete('/api/auth/delete-account', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    await dbAsync.run('DELETE FROM reminders WHERE userId = ?', [userId]);
    await dbAsync.run('DELETE FROM push_subscriptions WHERE userId = ?', [userId]);
    await dbAsync.run('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true, message: 'Your account and personal data have been completely deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// SUBSCRIPTIONS & COUPON ROUTES
// -------------------------------------------------------------

// Apply Coupon Code
app.post('/api/subscription/apply-coupon', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Please enter a coupon code' });
    }

    const cleanCode = code.toUpperCase().trim();
    const coupon = await dbAsync.get('SELECT * FROM coupons WHERE code = ?', [cleanCode]);

    if (!coupon) {
      return res.status(400).json({ error: 'Invalid coupon code' });
    }
    if (coupon.isUsed && cleanCode !== 'OWNER-LIFETIME-VIP') {
      return res.status(400).json({ error: 'This coupon code has already been used' });
    }

    const now = new Date();
    let newPlan = 'monthly';
    let expiresAt = new Date();

    if (coupon.planType === '1month') {
      newPlan = 'monthly';
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else if (coupon.planType === '1year') {
      newPlan = 'yearly';
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else if (coupon.planType === 'lifetime') {
      newPlan = 'coupon_lifetime';
      expiresAt = null;
    }

    // Mark coupon as used (unless owner vip reusable)
    if (cleanCode !== 'OWNER-LIFETIME-VIP') {
      await dbAsync.run('UPDATE coupons SET isUsed = 1, usedByUserId = ?, usedAt = ? WHERE code = ?', [
        req.user.id,
        now.toISOString(),
        cleanCode
      ]);
    }

    await dbAsync.run(`
      UPDATE users SET planStatus = ?, subscriptionExpiresAt = ? WHERE id = ?
    `, [newPlan, expiresAt ? expiresAt.toISOString() : null, req.user.id]);

    res.json({
      success: true,
      message: `Coupon applied successfully! Plan upgraded to ${newPlan.toUpperCase()}`,
      planStatus: newPlan,
      expiresAt: expiresAt ? expiresAt.toISOString() : 'Lifetime'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Razorpay Create Autopay Subscription (Pass-Through Rasta 1: ₹20.50/mo, ₹154/yr)
app.post('/api/subscription/create-autopay', authMiddleware, async (req, res) => {
  try {
    const { planType } = req.body; // 'monthly' (₹20.50) or 'yearly' (₹154.00)
    
    // In production with live Razorpay keys, this creates subscription or order
    // Plan prices in paise:
    // Monthly: 2050 (₹20.50)
    // Yearly: 15400 (₹154.00)
    const amountPaise = planType === 'yearly' ? 15400 : 2050;

    // For test / simulated integration:
    const mockSubId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    res.json({
      success: true,
      subscriptionId: mockSubId,
      amountPaise,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_id',
      planType,
      currency: 'INR',
      name: 'Reminder Me Autopay',
      description: planType === 'yearly' ? 'Yearly Autopay (₹154.00/yr)' : 'Monthly Autopay (₹20.50/mo)'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Razorpay Verify & Activate Subscription
app.post('/api/subscription/verify-autopay', authMiddleware, async (req, res) => {
  try {
    const { planType, paymentId, subscriptionId } = req.body;
    const now = new Date();
    let expiresAt = new Date();

    if (planType === 'yearly') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    await dbAsync.run(`
      UPDATE users SET planStatus = ?, subscriptionExpiresAt = ?, razorpaySubscriptionId = ? WHERE id = ?
    `, [planType, expiresAt.toISOString(), subscriptionId || paymentId || 'manual', req.user.id]);

    res.json({
      success: true,
      message: 'Autopay subscription activated successfully!',
      planStatus: planType,
      expiresAt: expiresAt.toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// REMINDER ENGINE ROUTES (3 MODES + REMIND CONTACT)
// -------------------------------------------------------------

// 1. Get User Reminders
app.get('/api/reminders', authMiddleware, async (req, res) => {
  try {
    const reminders = await dbAsync.all(
      'SELECT * FROM reminders WHERE userId = ? ORDER BY reminderTime ASC',
      [req.user.id]
    );
    res.json(reminders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Mode 1: Quick Tap Save
app.post('/api/reminders/quick', authMiddleware, async (req, res) => {
  try {
    if (!req.hasActiveAccess) {
      return res.status(403).json({ error: 'Your 10-day trial has ended. Please subscribe or apply coupon.' });
    }

    const { message, minutes, preset } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let targetDate = new Date();
    if (typeof minutes === 'number') {
      targetDate = new Date(Date.now() + minutes * 60000);
    } else if (preset) {
      if (preset === 'tonight-9pm') {
        if (targetDate.getHours() >= 21) targetDate.setDate(targetDate.getDate() + 1);
        targetDate.setHours(21, 0, 0, 0);
      } else if (preset === 'tomorrow-8am') {
        targetDate.setDate(targetDate.getDate() + 1);
        targetDate.setHours(8, 0, 0, 0);
      } else if (preset === 'tomorrow-6pm') {
        targetDate.setDate(targetDate.getDate() + 1);
        targetDate.setHours(18, 0, 0, 0);
      }
    } else {
      targetDate = new Date(Date.now() + 15 * 60000);
    }

    const reminderId = 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const now = new Date().toISOString();

    await dbAsync.run(`
      INSERT INTO reminders (id, userId, title, message, reminderTime, repeat, priority, category, status, createdAt)
      VALUES (?, ?, ?, ?, ?, 'none', 'normal', 'personal', 'pending', ?)
    `, [reminderId, req.user.id, message.trim(), message.trim(), targetDate.toISOString(), now]);

    res.status(201).json({
      success: true,
      reminderId,
      scheduledTime: targetDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Mode 2: Custom Date & Time
app.post('/api/reminders/custom', authMiddleware, async (req, res) => {
  try {
    if (!req.hasActiveAccess) {
      return res.status(403).json({ error: 'Your 10-day trial has ended. Please subscribe or apply coupon.' });
    }

    const { title, message, reminderTime, priority, category } = req.body;
    if (!title || !reminderTime) {
      return res.status(400).json({ error: 'Title and Date/Time are required' });
    }

    const reminderId = 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const now = new Date().toISOString();

    await dbAsync.run(`
      INSERT INTO reminders (id, userId, title, message, reminderTime, repeat, priority, category, status, createdAt)
      VALUES (?, ?, ?, ?, ?, 'none', ?, ?, 'pending', ?)
    `, [reminderId, req.user.id, title.trim(), (message || title).trim(), new Date(reminderTime).toISOString(), priority || 'normal', category || 'personal', now]);

    res.status(201).json({ success: true, reminderId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Mode 3: Rozana (Daily Until Fixed Date)
app.post('/api/reminders/daily', authMiddleware, async (req, res) => {
  try {
    if (!req.hasActiveAccess) {
      return res.status(403).json({ error: 'Your 10-day trial has ended. Please subscribe or apply coupon.' });
    }

    const { message, time, endDate, priority } = req.body;
    if (!message || !time) {
      return res.status(400).json({ error: 'Message and Daily Time are required' });
    }

    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    let scheduledDate = new Date();
    scheduledDate.setHours(hours, minutes, 0, 0);
    if (scheduledDate <= now) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    let parsedEndDate = null;
    if (endDate && endDate.trim()) {
      const endD = new Date(endDate);
      endD.setHours(23, 59, 59, 999);
      parsedEndDate = endD.toISOString();
    }

    const reminderId = 'rem_daily_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    await dbAsync.run(`
      INSERT INTO reminders (id, userId, title, message, reminderTime, repeat, repeatTime, endDate, priority, category, status, createdAt)
      VALUES (?, ?, ?, ?, ?, 'daily', ?, ?, ?, 'personal', 'pending', ?)
    `, [reminderId, req.user.id, message.trim(), message.trim(), scheduledDate.toISOString(), time, parsedEndDate, priority || 'normal', now.toISOString()]);

    res.status(201).json({
      success: true,
      message: `Daily reminder set for ${time}! Next run: ${scheduledDate.toLocaleTimeString()}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Mode 4: Remind a Contact ("Kisi Aur Ko Yaad Dilao")
app.post('/api/reminders/contact', authMiddleware, async (req, res) => {
  try {
    if (!req.hasActiveAccess) {
      return res.status(403).json({ error: 'Your 10-day trial has ended. Please subscribe or apply coupon.' });
    }

    const { contactName, contactPhone, message, reminderTime } = req.body;
    if (!contactPhone || !message || !reminderTime) {
      return res.status(400).json({ error: 'Contact phone, message, and time are required' });
    }

    const cleanContactPhone = sanitizePhone(contactPhone);
    const reminderId = 'rem_ct_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const now = new Date().toISOString();

    await dbAsync.run(`
      INSERT INTO reminders (id, userId, title, message, reminderTime, repeat, targetContactPhone, targetContactName, status, createdAt)
      VALUES (?, ?, ?, ?, ?, 'none', ?, ?, 'pending', ?)
    `, [reminderId, req.user.id, `Reminder for ${contactName || 'Contact'}`, message.trim(), new Date(reminderTime).toISOString(), cleanContactPhone, contactName || 'Contact', now]);

    res.status(201).json({ success: true, message: `Reminder scheduled for ${contactName || cleanContactPhone}!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Reminder
app.delete('/api/reminders/:id', authMiddleware, async (req, res) => {
  try {
    const result = await dbAsync.run('DELETE FROM reminders WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Reminder not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Instant Test Trigger Reminder
app.post('/api/reminders/:id/trigger', authMiddleware, async (req, res) => {
  try {
    const reminder = await dbAsync.get('SELECT * FROM reminders WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

    const targetPhone = reminder.targetContactPhone || req.user.phone;
    const msg = `🔔 *Reminder Me* 🔔\n\n📌 *Task:* ${reminder.title}\n💬 *Details:* ${reminder.message}\n⏰ *Sent At:* ${new Date().toLocaleTimeString()}\n\n_Sent via Reminder Me_`;

    await sendAnyWhatsAppMessage(targetPhone, msg);
    await sendWebPushToUser(req.user.id, {
      title: 'Reminder Me',
      body: reminder.title,
      icon: '/icons/icon.svg'
    });

    res.json({ success: true, message: 'Reminder sent to WhatsApp & Phone!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// WEB PUSH SUBSCRIPTION & VAPID KEY
// -------------------------------------------------------------
app.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/push/subscribe', authMiddleware, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Subscription object required' });
    }

    const id = 'sub_' + Buffer.from(subscription.endpoint).toString('base64').substring(0, 32);
    await dbAsync.run(`
      INSERT OR REPLACE INTO push_subscriptions (id, userId, endpoint, keys, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `, [id, req.user.id, subscription.endpoint, JSON.stringify(subscription.keys || {}), new Date().toISOString()]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// ADMIN PANEL ROUTES (EXCLUSIVE TO OWNER)
// -------------------------------------------------------------
app.get('/api/admin/stats', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const totalUsersRow = await dbAsync.get('SELECT COUNT(*) as count FROM users');
    const allUsers = await dbAsync.all('SELECT * FROM users ORDER BY createdAt DESC');
    const totalCouponsRow = await dbAsync.get('SELECT COUNT(*) as count FROM coupons');
    const usedCouponsRow = await dbAsync.get('SELECT COUNT(*) as count FROM coupons WHERE isUsed = 1');

    let activeTrials = 0;
    let activeAutopay = 0;

    allUsers.forEach(u => {
      if (u.planStatus === 'trial' && new Date(u.trialEndsAt) >= now) {
        activeTrials++;
      } else if (['monthly', 'yearly'].includes(u.planStatus)) {
        activeAutopay++;
      }
    });

    // Approximate revenue calculation
    let totalRevenue = 0;
    allUsers.forEach(u => {
      if (u.planStatus === 'monthly') totalRevenue += 20.50;
      if (u.planStatus === 'yearly') totalRevenue += 154.00;
    });

    // Strip sensitive passwords for safe display
    const sanitizedUsers = allUsers.map(u => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      planStatus: u.planStatus,
      trialEndsAt: u.trialEndsAt,
      subscriptionExpiresAt: u.subscriptionExpiresAt,
      razorpaySubscriptionId: u.razorpaySubscriptionId || '-',
      isOwner: u.isOwner === 1,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt
    }));

    res.json({
      stats: {
        totalUsers: totalUsersRow.count,
        activeTrials,
        activeAutopay,
        totalRevenue: totalRevenue.toFixed(2),
        totalCoupons: totalCouponsRow.count,
        usedCoupons: usedCouponsRow.count
      },
      users: sanitizedUsers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Coupon Generator
app.post('/api/admin/coupons/generate', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const { planType, count } = req.body;
    const num = Math.min(parseInt(count, 10) || 1, 20);
    const createdCodes = [];

    for (let i = 0; i < num; i++) {
      const prefix = planType === '1year' ? 'FREE1Y-' : 'FREE1M-';
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = prefix + randomSuffix;
      await dbAsync.run('INSERT INTO coupons (code, planType, isUsed) VALUES (?, ?, 0)', [code, planType || '1month']);
      createdCodes.push(code);
    }

    res.json({ success: true, createdCodes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin WhatsApp Status & QR
app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    isConnected: isWAConnected,
    qr: currentQR,
    qrImage: currentQRImage,
    phone: loggedInUserWA || ''
  });
});

app.post('/api/whatsapp/logout', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    if (sock) await sock.logout();
    isWAConnected = false;
    currentQR = null;
    currentQRImage = null;
    loggedInUserWA = '';
    try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) {}
    setTimeout(startWhatsAppBot, 1000);
    res.json({ success: true, message: 'Disconnected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// BACKGROUND DISPATCHER SCHEDULER
// -------------------------------------------------------------
setInterval(async () => {
  try {
    const now = new Date();
    const pendingReminders = await dbAsync.all(
      `SELECT r.*, u.phone as userPhone, u.email as userEmail, u.planStatus, u.trialEndsAt, u.subscriptionExpiresAt, u.isOwner
       FROM reminders r
       JOIN users u ON r.userId = u.id
       WHERE r.status = 'pending' AND r.reminderTime <= ?`,
      [now.toISOString()]
    );

    for (const reminder of pendingReminders) {
      // Check user plan status (expired trials don't trigger unless owner)
      const isOwner = reminder.userEmail.toLowerCase() === OWNER_EMAIL || reminder.isOwner === 1;
      let hasAccess = true;
      if (!isOwner) {
        if (reminder.planStatus === 'trial' && new Date(reminder.trialEndsAt) < now) hasAccess = false;
        if (reminder.subscriptionExpiresAt && new Date(reminder.subscriptionExpiresAt) < now) hasAccess = false;
      }

      if (!hasAccess) {
        console.log(`[Scheduler] User ${reminder.userEmail} plan expired. Skipping reminder ${reminder.id}`);
        continue;
      }

      // Check if daily reminder passed end date
      if (reminder.endDate && new Date(reminder.endDate) < now) {
        await dbAsync.run('UPDATE reminders SET status = "completed" WHERE id = ?', [reminder.id]);
        continue;
      }

      try {
        const targetPhone = reminder.targetContactPhone || reminder.userPhone;
        const dueTime = new Date(reminder.reminderTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const repeatHeader = reminder.repeat === 'daily' ? '🔁 *DAILY REMINDER* 🔁\n\n' : '🔔 *REMINDER ME* 🔔\n\n';

        const msg = `${repeatHeader}📌 *Task:* ${reminder.title}\n💬 *Note:* ${reminder.message}\n⏰ *Time:* ${dueTime}\n\n_Sent by Reminder Me App_`;

        await sendAnyWhatsAppMessage(targetPhone, msg);
        await sendWebPushToUser(reminder.userId, {
          title: 'Reminder Me Alert',
          body: reminder.title,
          icon: '/icons/icon.svg'
        });

        if (reminder.repeat === 'daily') {
          const nextOccurrence = new Date(reminder.reminderTime);
          nextOccurrence.setDate(nextOccurrence.getDate() + 1);

          if (reminder.endDate && nextOccurrence > new Date(reminder.endDate)) {
            await dbAsync.run('UPDATE reminders SET status = "completed", sentCount = sentCount + 1, sentAt = ? WHERE id = ?', [now.toISOString(), reminder.id]);
          } else {
            await dbAsync.run('UPDATE reminders SET reminderTime = ?, sentCount = sentCount + 1, sentAt = ? WHERE id = ?', [nextOccurrence.toISOString(), now.toISOString(), reminder.id]);
          }
        } else {
          await dbAsync.run('UPDATE reminders SET status = "sent", sentAt = ? WHERE id = ?', [now.toISOString(), reminder.id]);
        }
        console.log(`[Scheduler] Reminder ${reminder.id} sent successfully`);
      } catch (sendErr) {
        console.error(`[Scheduler] Failed reminder ${reminder.id}:`, sendErr.message);
        await dbAsync.run('UPDATE reminders SET status = "failed", error = ? WHERE id = ?', [sendErr.message, reminder.id]);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error in check loop:', err);
  }
}, 10000);

// Ping endpoint for keepalive
app.get('/api/ping', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Reminder Me Server running on port ${PORT}`);
});
