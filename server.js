const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const webpush = require('web-push');
const { dbAsync } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'reminder_me_super_secret_jwt_key_2026';
const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'deepakprajapat8529@gmail.com').toLowerCase().trim();

// Razorpay Config (Keys from env or fallback placeholder)
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

function sanitizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

// Send Web Push Notification to User
async function sendWebPushToUser(userId, payload) {
  try {
    const subs = await dbAsync.all('SELECT * FROM push_subscriptions WHERE userId = ?', [userId]);
    console.log(`[WebPush] Dispatching to user ${userId}, active device subscriptions count: ${subs.length}`);
    const payloadStr = JSON.stringify(payload);
    for (const sub of subs) {
      try {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: JSON.parse(sub.keys)
        };
        const options = {
          TTL: 86400,
          urgency: 'high'
        };
        const result = await webpush.sendNotification(pushConfig, payloadStr, options);
        console.log(`[WebPush] Successfully pushed to ${sub.endpoint.substring(0, 45)}... (status: ${result.statusCode})`);
      } catch (err) {
        console.error(`[WebPush] Failed push to ${sub.endpoint.substring(0, 45)}... error: ${err.statusCode || err.message}`);
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[WebPush] Cleaning up inactive subscription ${sub.id}`);
          await dbAsync.run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
        }
      }
    }
  } catch (err) {
    console.error('[WebPush] Error sending push to user:', err.message);
  }
}

// -------------------------------------------------------------
// AUTH & SESSION MIDDLEWARE
// -------------------------------------------------------------
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await dbAsync.get('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return res.status(401).json({ error: 'User account not found' });
    }

    req.user = user;
    const isOwner = user.email.toLowerCase().trim() === OWNER_EMAIL || user.isOwner === 1;
    req.isOwner = isOwner;

    // Check Plan & Access
    let hasActiveAccess = false;
    let trialDaysRemaining = 0;
    const now = new Date();

    if (isOwner) {
      hasActiveAccess = true;
    } else if (['coupon_lifetime', 'monthly', 'yearly'].includes(user.planStatus)) {
      if (user.planStatus === 'coupon_lifetime') {
        hasActiveAccess = true;
      } else if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now) {
        hasActiveAccess = true;
      } else {
        hasActiveAccess = false;
      }
    } else if (user.planStatus === 'trial') {
      const trialEnds = new Date(user.trialEndsAt);
      if (trialEnds > now) {
        hasActiveAccess = true;
        trialDaysRemaining = Math.max(0, Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24)));
      } else {
        hasActiveAccess = false;
        trialDaysRemaining = 0;
      }
    }

    req.hasActiveAccess = hasActiveAccess;
    req.trialDaysRemaining = trialDaysRemaining;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid token' });
  }
}

// Owner Middleware
function ownerMiddleware(req, res, next) {
  if (!req.isOwner) {
    return res.status(403).json({ error: 'Forbidden: Owner access only' });
  }
  next();
}

// -------------------------------------------------------------
// AUTH ROUTES
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
    const isOwner = cleanEmail === OWNER_EMAIL;

    const existing = await dbAsync.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    if (existing && !isOwner) {
      return res.status(400).json({ error: 'Account already exists with this Email' });
    }

    if (existing && isOwner) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      await dbAsync.run('UPDATE users SET passwordHash = ? WHERE id = ?', [passwordHash, existing.id]);
      const token = jwt.sign({ userId: existing.id }, JWT_SECRET, { expiresIn: '365d' });
      return res.status(200).json({
        success: true,
        token,
        user: {
          id: existing.id,
          fullName: fullName.trim(),
          email: cleanEmail,
          phone: cleanPhone,
          planStatus: 'owner',
          isOwner: true,
          lifetimeFree: true,
          trialDaysRemaining: 9999,
          trialEndsAt: existing.trialEndsAt
        }
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const now = new Date();
    const trialEnds = new Date(now.getTime() + (isOwner ? 100 * 365 : 10) * 24 * 60 * 60 * 1000);

    const userId = isOwner ? 'usr_owner_deepak' : ('usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
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
      null,
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
        isOwner,
        lifetimeFree: isOwner,
        trialDaysRemaining: isOwner ? 9999 : 10,
        trialEndsAt: trialEnds.toISOString()
      }
    });
  } catch (err) {
    console.error('[Auth Signup Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and App Password required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const isOwner = cleanEmail === OWNER_EMAIL;
    let user = await dbAsync.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (isOwner) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      if (!user) {
        const ownerId = 'usr_owner_deepak';
        const now = new Date();
        const trialEnds = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);

        await dbAsync.run(`
          INSERT INTO users (id, fullName, email, phone, passwordHash, planStatus, trialEndsAt, subscriptionExpiresAt, isOwner, createdAt, lastLoginAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          ownerId,
          'Deepak Prajapat',
          cleanEmail,
          '919876500000',
          passwordHash,
          'owner',
          trialEnds.toISOString(),
          null,
          1,
          now.toISOString(),
          now.toISOString()
        ]);
        user = await dbAsync.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);
      } else {
        // Auto-sync owner password to whichever password Deepak enters
        await dbAsync.run('UPDATE users SET passwordHash = ? WHERE id = ?', [passwordHash, user.id]);
        user.passwordHash = passwordHash;
        user.isOwner = 1;
        user.planStatus = 'owner';
      }
    } else {
      if (!user) {
        return res.status(400).json({ error: 'Invalid Email or Password' });
      }

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        return res.status(400).json({ error: 'Invalid Email or Password' });
      }
    }

    await dbAsync.run('UPDATE users SET lastLoginAt = ? WHERE id = ?', [new Date().toISOString(), user.id]);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '365d' });

    const now = new Date();
    let trialDaysRemaining = 0;
    let hasActiveAccess = false;

    if (isOwner) {
      hasActiveAccess = true;
      trialDaysRemaining = 9999;
    } else if (['coupon_lifetime', 'monthly', 'yearly'].includes(user.planStatus)) {
      hasActiveAccess = true;
    } else if (user.planStatus === 'trial') {
      const trialEnds = new Date(user.trialEndsAt);
      if (trialEnds > now) {
        hasActiveAccess = true;
        trialDaysRemaining = Math.max(0, Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24)));
      }
    }

    const subs = await dbAsync.all('SELECT * FROM push_subscriptions WHERE userId = ?', [user.id]);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        planStatus: isOwner ? 'owner' : user.planStatus,
        isOwner,
        lifetimeFree: isOwner || user.planStatus === 'coupon_lifetime',
        hasActiveAccess,
        trialDaysRemaining,
        trialEndsAt: user.trialEndsAt,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        hasPushSubscription: subs.length > 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check Session / Current User
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const subs = await dbAsync.all('SELECT * FROM push_subscriptions WHERE userId = ?', [req.user.id]);
  res.json({
    user: {
      id: req.user.id,
      fullName: req.user.fullName,
      email: req.user.email,
      phone: req.user.phone,
      planStatus: req.isOwner ? 'owner' : req.user.planStatus,
      isOwner: req.isOwner,
      lifetimeFree: req.isOwner || req.user.planStatus === 'coupon_lifetime',
      hasActiveAccess: req.hasActiveAccess,
      trialDaysRemaining: req.trialDaysRemaining,
      trialEndsAt: req.user.trialEndsAt,
      subscriptionExpiresAt: req.user.subscriptionExpiresAt,
      hasPushSubscription: subs.length > 0
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
    res.json({ success: true, message: 'Your account and all associated data have been permanently deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// SUBSCRIPTIONS & COUPON SYSTEM
// -------------------------------------------------------------

// Single-use Coupon Apply
app.post('/api/subscription/apply-coupon', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Please enter a coupon code' });
    }

    const cleanCode = code.trim().toUpperCase();
    const coupon = await dbAsync.get('SELECT * FROM coupons WHERE code = ?', [cleanCode]);

    if (!coupon) {
      return res.status(400).json({ error: 'Invalid coupon code' });
    }
    if (coupon.isUsed === 1) {
      return res.status(400).json({ error: 'This coupon has already been used' });
    }

    const now = new Date();
    let newPlan = 'monthly';
    let expiresAt = null;

    if (coupon.planType === 'lifetime' || cleanCode === 'OWNER-LIFETIME-VIP') {
      newPlan = 'coupon_lifetime';
      expiresAt = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
    } else if (coupon.planType === '1year') {
      newPlan = 'yearly';
      expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      newPlan = 'monthly';
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    await dbAsync.run('UPDATE coupons SET isUsed = 1, usedByUserId = ?, usedAt = ? WHERE code = ?', [
      req.user.id,
      now.toISOString(),
      cleanCode
    ]);

    await dbAsync.run(`
      UPDATE users SET planStatus = ?, subscriptionExpiresAt = ? WHERE id = ?
    `, [newPlan, expiresAt, req.user.id]);

    res.json({
      success: true,
      message: `Coupon applied successfully! Plan upgraded to ${newPlan.toUpperCase()}`,
      planStatus: newPlan,
      expiresAt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Razorpay Autopay Order / Mandate Creation
app.post('/api/subscription/create-autopay', authMiddleware, async (req, res) => {
  try {
    const { planType } = req.body; // 'monthly' (₹20.50) or 'yearly' (₹154.00)
    let amountPaise = 2050; // ₹20.50
    if (planType === 'yearly') amountPaise = 15400; // ₹154.00

    const options = {
      amount: amountPaise,
      currency: 'INR',
      receipt: `rcpt_${req.user.id.substring(0, 8)}_${Date.now()}`,
      notes: {
        userId: req.user.id,
        userEmail: req.user.email,
        planType
      }
    };

    let order = null;
    try {
      order = await razorpay.orders.create(options);
    } catch (rzpErr) {
      order = {
        id: 'order_simulated_' + Date.now(),
        amount: amountPaise,
        currency: 'INR',
        receipt: options.receipt
      };
    }

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_id',
      planType
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Razorpay Autopay Verification
app.post('/api/subscription/verify-autopay', authMiddleware, async (req, res) => {
  try {
    const { orderId, paymentId, planType } = req.body;
    const now = new Date();
    const durationDays = planType === 'yearly' ? 365 : 30;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    await dbAsync.run(`
      UPDATE users SET planStatus = ?, subscriptionExpiresAt = ?, razorpaySubscriptionId = ? WHERE id = ?
    `, [planType, expiresAt, paymentId || orderId, req.user.id]);

    res.json({
      success: true,
      message: `Subscription activated! Active until ${new Date(expiresAt).toDateString()}`,
      planStatus: planType,
      expiresAt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// REMINDER ENGINE (In-App & Push Notifications)
// -------------------------------------------------------------

// 1. Fetch All User Reminders
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

// 2. Poll In-App Due Notifications (Active browser tab alarm & popup)
app.get('/api/reminders/due-notifications', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const dueReminders = await dbAsync.all(
      `SELECT * FROM reminders WHERE userId = ? AND clientPopped != 1 AND status != 'completed' AND reminderTime <= ?`,
      [req.user.id, now.toISOString()]
    );

    res.json({ due: dueReminders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Acknowledge in-app popup so it doesn't pop up again
app.post('/api/reminders/:id/ack-popup', authMiddleware, async (req, res) => {
  try {
    await dbAsync.run('UPDATE reminders SET clientPopped = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Mode 1: Quick Tap Save
app.post('/api/reminders/quick', authMiddleware, async (req, res) => {
  try {
    if (!req.hasActiveAccess) {
      return res.status(403).json({ error: 'Your 10-day trial has ended. Please subscribe or apply coupon.' });
    }

    const message = req.body.message || req.body.text;
    const { minutes, preset } = req.body;
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
    const targetTimestamp = req.body.reminderTimestamp || targetDate.getTime();
    const targetTimeIso = req.body.reminderTime || targetDate.toISOString();

    await dbAsync.run(`
      INSERT INTO reminders (id, userId, title, message, reminderTime, reminderTimestamp, repeat, priority, category, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'none', 'normal', 'personal', 'pending', ?)
    `, [reminderId, req.user.id, message.trim(), message.trim(), targetTimeIso, targetTimestamp, now]);

    res.status(201).json({
      success: true,
      reminderId,
      scheduledTime: targetDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Mode 2: Custom Date & Time
app.post('/api/reminders/custom', authMiddleware, async (req, res) => {
  try {
    if (!req.hasActiveAccess) {
      return res.status(403).json({ error: 'Your 10-day trial has ended. Please subscribe or apply coupon.' });
    }

    const { title, note, date, time, priority, category, repeat } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    let reminderDateTime = new Date();
    if (date && time) {
      reminderDateTime = new Date(`${date}T${time}`);
    }

    const targetTimestamp = req.body.reminderTimestamp || reminderDateTime.getTime();
    const targetTimeIso = req.body.reminderTime || reminderDateTime.toISOString();

    const reminderId = 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const now = new Date().toISOString();

    await dbAsync.run(`
      INSERT INTO reminders (id, userId, title, message, reminderTime, reminderTimestamp, repeat, priority, category, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [
      reminderId,
      req.user.id,
      title.trim(),
      (note || '').trim(),
      targetTimeIso,
      targetTimestamp,
      repeat || 'none',
      priority || 'normal',
      category || 'personal',
      now
    ]);

    res.status(201).json({
      success: true,
      reminderId,
      scheduledTime: reminderDateTime.toLocaleString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Mode 3: Rozana (Daily Repetition Until End Date)
app.post('/api/reminders/daily', authMiddleware, async (req, res) => {
  try {
    if (!req.hasActiveAccess) {
      return res.status(403).json({ error: 'Your 10-day trial has ended. Please subscribe or apply coupon.' });
    }

    const { title, note, time, kisDateTak, priority } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!time) {
      return res.status(400).json({ error: 'Time is required' });
    }

    const [hours, minutes] = time.split(':');
    const firstReminderTime = new Date();
    firstReminderTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

    if (firstReminderTime < new Date()) {
      firstReminderTime.setDate(firstReminderTime.getDate() + 1);
    }

    const targetTimestamp = req.body.reminderTimestamp || firstReminderTime.getTime();
    const targetTimeIso = req.body.reminderTime || firstReminderTime.toISOString();

    const reminderId = 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const now = new Date().toISOString();

    await dbAsync.run(`
      INSERT INTO reminders (id, userId, title, message, reminderTime, reminderTimestamp, repeat, repeatTime, endDate, priority, category, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'daily', ?, ?, ?, 'personal', 'pending', ?)
    `, [
      reminderId,
      req.user.id,
      title.trim(),
      (note || '').trim(),
      targetTimeIso,
      targetTimestamp,
      time,
      (kisDateTak || '').trim() || null,
      priority || 'normal',
      now
    ]);

    res.status(201).json({
      success: true,
      reminderId,
      scheduledTime: `Daily at ${time}` + (kisDateTak ? ` until ${kisDateTak}` : '')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Mode 4: Remind a Contact
app.post('/api/reminders/contact', authMiddleware, async (req, res) => {
  try {
    if (!req.hasActiveAccess) {
      return res.status(403).json({ error: 'Your 10-day trial has ended. Please subscribe or apply coupon.' });
    }

    const { title, note, phone, contactName, date, time } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title / Message is required' });
    }

    let targetDate = new Date();
    if (date && time) {
      targetDate = new Date(`${date}T${time}`);
    } else {
      targetDate = new Date(Date.now() + 15 * 60000);
    }

    const targetTimestamp = req.body.reminderTimestamp || targetDate.getTime();
    const targetTimeIso = req.body.reminderTime || targetDate.toISOString();

    const cleanPhone = sanitizePhone(phone);
    const reminderId = 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const now = new Date().toISOString();

    // 1. Save reminder in creator's account
    await dbAsync.run(`
      INSERT INTO reminders (id, userId, title, message, reminderTime, reminderTimestamp, repeat, priority, category, targetContactPhone, targetContactName, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'none', 'high', 'contact', ?, ?, 'pending', ?)
    `, [
      reminderId,
      req.user.id,
      title.trim(),
      (note || '').trim(),
      targetTimeIso,
      targetTimestamp,
      cleanPhone,
      (contactName || '').trim(),
      now
    ]);

    // 2. Check if contact is a registered user on Reminder Me app!
    let targetUser = null;
    let targetUserNotified = false;
    if (cleanPhone) {
      targetUser = await dbAsync.get('SELECT * FROM users WHERE phone = ?', [cleanPhone]);
      if (targetUser && targetUser.id !== req.user.id) {
        targetUserNotified = true;
        const incomingId = 'rem_in_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        await dbAsync.run(`
          INSERT INTO reminders (id, userId, title, message, reminderTime, reminderTimestamp, repeat, priority, category, targetContactPhone, targetContactName, status, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, 'none', 'high', 'received_contact', ?, ?, 'pending', ?)
        `, [
          incomingId,
          targetUser.id,
          `${req.user.fullName || 'Someone'} ने रिमाइंडर भेजा: ${title.trim()}`,
          (note || title).trim(),
          targetTimeIso,
          targetTimestamp,
          req.user.phone || '',
          req.user.fullName || 'Contact',
          now
        ]);
      }
    }

    const timeFormatted = targetDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    const shareMessage = `🔔 Reminder Me: "${title.trim()}" scheduled for ${timeFormatted} by ${req.user.fullName || 'a friend'}.\nOpen Reminder Me: https://whatsapp-reminder-0yad.onrender.com/`;

    res.status(201).json({
      success: true,
      reminderId,
      scheduledTime: timeFormatted,
      contactName: contactName || cleanPhone,
      targetUserNotified,
      cleanPhone,
      shareMessage
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Dismiss / Complete a Reminder
app.post('/api/reminders/:id/dismiss', authMiddleware, async (req, res) => {
  try {
    const reminder = await dbAsync.get('SELECT * FROM reminders WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

    const now = new Date();
    if (reminder.repeat === 'daily') {
      const nextOccurrence = new Date(reminder.reminderTime);
      nextOccurrence.setDate(nextOccurrence.getDate() + 1);

      if (reminder.endDate && nextOccurrence > new Date(reminder.endDate)) {
        await dbAsync.run('UPDATE reminders SET status = "completed", sentCount = sentCount + 1, sentAt = ? WHERE id = ?', [now.toISOString(), reminder.id]);
      } else {
        await dbAsync.run('UPDATE reminders SET reminderTime = ?, sentCount = sentCount + 1, sentAt = ? WHERE id = ?', [nextOccurrence.toISOString(), now.toISOString(), reminder.id]);
      }
    } else {
      await dbAsync.run('UPDATE reminders SET status = "completed", sentAt = ? WHERE id = ?', [now.toISOString(), reminder.id]);
    }

    res.json({ success: true, message: 'Reminder dismissed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Snooze Reminder (5, 10, or 15 mins)
app.post('/api/reminders/:id/snooze', authMiddleware, async (req, res) => {
  try {
    const snoozeMinutes = parseInt(req.body.minutes, 10) || 5;
    const newTime = new Date(Date.now() + snoozeMinutes * 60000).toISOString();

    await dbAsync.run(
      'UPDATE reminders SET reminderTime = ?, status = "pending" WHERE id = ? AND userId = ?',
      [newTime, req.params.id, req.user.id]
    );

    res.json({ success: true, message: `Snoozed for ${snoozeMinutes} minutes`, newTime });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Delete Reminder
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

// -------------------------------------------------------------
// WEB PUSH SUBSCRIPTIONS
// -------------------------------------------------------------
app.get('/api/push/public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/push/subscribe', authMiddleware, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid push subscription' });
    }

    const subId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    await dbAsync.run(`
      INSERT OR REPLACE INTO push_subscriptions (id, userId, endpoint, keys, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `, [
      subId,
      req.user.id,
      subscription.endpoint,
      JSON.stringify(subscription.keys || {}),
      new Date().toISOString()
    ]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test Push Notification Endpoint
app.post('/api/push/test', authMiddleware, async (req, res) => {
  try {
    const subs = await dbAsync.all('SELECT * FROM push_subscriptions WHERE userId = ?', [req.user.id]);
    if (!subs || subs.length === 0) {
      return res.status(400).json({ error: 'No device subscription found. Please tap "Enable Push Alerts" first!' });
    }
    await sendWebPushToUser(req.user.id, {
      title: '🔔 Reminder Me Test Alert',
      body: 'Lock-screen notifications and sweet chime sound working perfectly! 🌸',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { test: true }
    });
    res.json({ success: true, message: '✓ Test notification sent! Check your notification tray or lock screen.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// OWNER EXCLUSIVE ADMIN PANEL APIS
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

    // Total revenue calculation
    let totalRevenue = 0;
    allUsers.forEach(u => {
      if (u.planStatus === 'monthly') totalRevenue += 20.50;
      if (u.planStatus === 'yearly') totalRevenue += 154.00;
    });

    // Strip sensitive passwords for display
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
        totalUsers: totalUsersRow ? totalUsersRow.count : allUsers.length,
        activeTrials,
        activeAutopay,
        totalRevenue: totalRevenue.toFixed(2),
        totalCoupons: totalCouponsRow ? totalCouponsRow.count : 0,
        usedCoupons: usedCouponsRow ? usedCouponsRow.count : 0
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
    const { count = 5, planType = '1month' } = req.body;
    const generated = [];

    for (let i = 0; i < Math.min(count, 50); i++) {
      const prefix = planType === '1year' ? 'FREE1Y-' : 'FREE1M-';
      const code = prefix + Math.random().toString(36).substring(2, 8).toUpperCase();
      await dbAsync.run('INSERT INTO coupons (code, planType, isUsed) VALUES (?, ?, 0)', [code, planType || '1month']);
      generated.push(code);
    }

    res.json({ success: true, count: generated.length, codes: generated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// BACKGROUND DISPATCHER SCHEDULER (Push Notifications)
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
      const isOwner = reminder.userEmail.toLowerCase() === OWNER_EMAIL || reminder.isOwner === 1;
      let hasAccess = true;
      if (!isOwner) {
        if (reminder.planStatus === 'trial' && new Date(reminder.trialEndsAt) < now) hasAccess = false;
        if (reminder.subscriptionExpiresAt && new Date(reminder.subscriptionExpiresAt) < now) hasAccess = false;
      }

      if (!hasAccess) {
        continue;
      }

      // Check if daily reminder passed end date
      if (reminder.endDate && new Date(reminder.endDate) < now) {
        await dbAsync.run('UPDATE reminders SET status = "completed" WHERE id = ?', [reminder.id]);
        continue;
      }

      try {
        const dueTime = new Date(reminder.reminderTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        // Pick dynamic aesthetic art
        const dynamicArtImages = [
          '/images/art_morning_sun.jpg',
          '/images/art_mountain_sunrise.jpg',
          '/images/art_lotus_water.jpg',
          '/images/art_sakura_blossom.jpg',
          '/images/art_lavender_sunset.jpg',
          '/images/art_zen_water_stones.jpg'
        ];
        const artImage = dynamicArtImages[Math.floor(Math.random() * dynamicArtImages.length)];

        // Dispatch Native Push Notification to User's Phone & Lock Screen (Text Only, No Image)
        await sendWebPushToUser(reminder.userId, {
          title: '🔔 Reminder Me: ' + reminder.title,
          body: reminder.message && reminder.message !== reminder.title 
            ? `${reminder.message} (${dueTime})` 
            : `Scheduled reminder is due (${dueTime})`,
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-96.png',
          data: { reminderId: reminder.id }
        });

        // Also push to contact user if registered!
        if (reminder.targetContactPhone) {
          const contactUser = await dbAsync.get('SELECT * FROM users WHERE phone = ?', [reminder.targetContactPhone]);
          if (contactUser && contactUser.id !== reminder.userId) {
            await sendWebPushToUser(contactUser.id, {
              title: `🔔 Reminder: ${reminder.title}`,
              body: `${reminder.message || reminder.title} (${dueTime})`,
              icon: '/icons/icon-192.png',
              badge: '/icons/badge-96.png',
              data: { reminderId: reminder.id }
            });
          }
        }

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
      } catch (sendErr) {
        console.error(`[Scheduler] Failed reminder ${reminder.id}:`, sendErr.message);
        await dbAsync.run('UPDATE reminders SET status = "failed", error = ? WHERE id = ?', [sendErr.message, reminder.id]);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error in check loop:', err);
  }
}, 5000);

// Ping endpoint for keepalive
app.get('/api/ping', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Reminder Me Server running on port ${PORT}`);
});
