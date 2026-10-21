require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const webpush = require('web-push');
const { dbAsync } = require('./db');

// Ensure debug mode defaults to OFF
const DEBUG = process.env.DEBUG === 'true';

// -------------------------------------------------------------
// 1. STRICT ENVIRONMENT VALIDATION PASS
// -------------------------------------------------------------
function validateEnvironment() {
  // If running in Vercel serverless / edge, bypass strict process exit
  if (process.env.VERCEL) {
    return;
  }
  const isProd = process.env.NODE_ENV === 'production';
  const missingCritical = [];
  const missingWarnings = [];

  // JWT Secret validation
  if (!process.env.JWT_SECRET) {
    if (isProd) {
      missingCritical.push('JWT_SECRET: Required in production for secure token signing.');
    } else {
      missingWarnings.push('JWT_SECRET not provided; using ephemeral cryptographic key for dev.');
    }
  } else if (process.env.JWT_SECRET.length < 32) {
    missingWarnings.push('JWT_SECRET is shorter than 32 characters; recommend 64 characters for production.');
  }

  // Owner credentials
  if (!process.env.OWNER_EMAIL) {
    missingWarnings.push('OWNER_EMAIL: Not set; owner privileges will not be auto-assigned.');
  }

  // Razorpay credentials
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    missingWarnings.push('RAZORPAY_KEY_ID/SECRET: Missing; running payment integration in simulated test mode.');
  }

  // WebPush VAPID
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    missingWarnings.push('VAPID_PUBLIC_KEY/PRIVATE_KEY: Missing; lock-screen push notifications disabled.');
  }

  // External database TLS check (if DATABASE_URL is supplied)
  if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL.toLowerCase();
    if (isProd && !dbUrl.includes('sslmode=') && !dbUrl.includes('ssl=')) {
      missingCritical.push('DATABASE_URL: External database in production must enforce TLS/SSL (e.g. ?sslmode=require).');
    }
  }

  if (missingWarnings.length > 0) {
    console.warn('[CONFIG WARNINGS]:\n  - ' + missingWarnings.join('\n  - '));
  }

  if (missingCritical.length > 0) {
    console.error('[CRITICAL CONFIG ERROR] Application refusing to start due to missing security variables:\n  - ' + missingCritical.join('\n  - '));
    process.exit(1);
  }
}
validateEnvironment();

const app = express();
const PORT = process.env.PORT || 3000;

function sanitizePhone(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

// -------------------------------------------------------------
// 2. ERROR HANDLING HELPER (Opaque Client Message + Correlation ID)
// -------------------------------------------------------------
function sendInternalError(res, err, publicMessage = 'An internal server error occurred.') {
  const correlationId = 'err_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
  console.error(`[CorrelationID: ${correlationId}]`, err && (err.stack || err.message || err));
  return res.status(500).json({
    error: publicMessage,
    correlationId
  });
}

// -------------------------------------------------------------
// 3. SECURE ENVIRONMENT VARIABLES & CREDENTIALS CONFIGURATION
// -------------------------------------------------------------

// JWT Signing Secret (Server-side only)
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
}

// Owner Identification
const OWNER_EMAIL = (process.env.OWNER_EMAIL || '').toLowerCase().trim();
const OWNER_ALT_EMAIL = (process.env.OWNER_ALT_EMAIL || '').toLowerCase().trim();
const OWNER_PHONE = sanitizePhone(process.env.OWNER_PHONE || '');

function isOwnerUser(user) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  const phone = sanitizePhone(user.phone || '');
  if (OWNER_EMAIL && email === OWNER_EMAIL) return true;
  if (OWNER_ALT_EMAIL && email === OWNER_ALT_EMAIL) return true;
  if (OWNER_PHONE && phone === OWNER_PHONE) return true;
  if (user.isOwner === 1 || user.isOwner === true) return true;
  if (user.planStatus === 'owner') return true;
  return false;
}

// Payment Gateway Config (Razorpay)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const razorpay = (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET)
  ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
  : null;

// Web Push VAPID Configuration
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || (OWNER_EMAIL ? `mailto:${OWNER_EMAIL}` : 'mailto:support@reminderme.app');

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    console.error('[WebPush] Error initializing VAPID configuration:', err.message);
  }
}

// -------------------------------------------------------------
// 4. SECURITY HEADERS (Helmet & Explicit Fallbacks)
// -------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https://reminderme.in.net", "http://reminderme.in.net", "https://whatsapp-reminder-0yad.onrender.com", "https://api.razorpay.com", "https://lumberjack.razorpay.com"],
        frameSrc: ["'self'", "https://api.razorpay.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' }, // X-Frame-Options: DENY
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    noSniff: true // X-Content-Type-Options: nosniff
  })
);

// Fallback headers ensuring strict compliance across all endpoints
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
});

// -------------------------------------------------------------
// 5. RESTRICTED CORS CONFIGURATION
// -------------------------------------------------------------
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim().toLowerCase())
  : [
      'https://reminderme.in.net',
      'http://reminderme.in.net',
      'https://whatsapp-reminder-0yad.onrender.com',
      'capacitor://localhost',
      'http://localhost',
      'https://localhost'
    ];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const lower = origin.toLowerCase();
      const isAllowed = allowedOrigins.some(
        allowed => lower === allowed || lower.startsWith('http://localhost:') || lower.startsWith('http://127.0.0.1:')
      );
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('CORS request blocked by security policy'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// -------------------------------------------------------------
// 6. RATE LIMITING
// -------------------------------------------------------------
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Minimum: 5 attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 1 minute before trying again.' }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many accounts created from this IP. Please try again later.' }
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Minimum: 3 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Password reset request limit reached. Please wait 1 hour.' }
});

const couponLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many coupon attempts. Please try again in 15 minutes.' }
});

// Protect against directory traversal, dotfiles (.env, .git)
app.use((req, res, next) => {
  const p = (req.path || '').toLowerCase();
  if (p.includes('.env') || p.includes('.git') || p.includes('/..') || p.startsWith('/.') || p.includes('reminder_me.json')) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
});

app.use('/api/', apiLimiter);
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Direct High-Speed APK Download Endpoint
app.get('/download/apk', (req, res) => {
  const apkPath = path.join(__dirname, 'public', 'ReminderMe.apk');
  if (fs.existsSync(apkPath)) {
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="ReminderMe.apk"');
    return res.sendFile(apkPath);
  }
  return res.redirect('https://github.com/iconwear26/whatsapp-reminder/releases/download/v2.0-apk/ReminderMe.apk');
});

// Ensure data folder exists
const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/data' : path.join(__dirname, 'data'));
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {}
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
        const options = {
          TTL: 86400,
          urgency: 'high'
        };
        await webpush.sendNotification(pushConfig, payloadStr, options);
      } catch (err) {
        console.error('[WebPush] Push notification delivery failed:', err.statusCode || err.message);
        if (err.statusCode === 410 || err.statusCode === 404) {
          await dbAsync.run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
        }
      }
    }
  } catch (err) {
    console.error('[WebPush] Error dispatching push:', err.message);
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
    const isRevoked = await dbAsync.get('SELECT * FROM revoked_tokens WHERE token = ?', [token]);
    if (isRevoked) {
      return res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.jwtDecoded = decoded;
    req.token = token;
    let user = await dbAsync.get('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      if (decoded.userId === 'usr_owner_deepak') {
        const salt = await bcrypt.genSalt(10);
        const ownerPassword = process.env.OWNER_INITIAL_PASSWORD || crypto.randomBytes(8).toString('hex');
        const passwordHash = await bcrypt.hash(ownerPassword, salt);
        user = {
          id: 'usr_owner_deepak',
          fullName: 'Deepak Prajapat',
          email: OWNER_EMAIL,
          phone: OWNER_PHONE,
          passwordHash,
          planStatus: 'owner',
          trialEndsAt: new Date(Date.now() + 100 * 365 * 86400000).toISOString(),
          isOwner: 1,
          createdAt: new Date().toISOString()
        };
        await dbAsync.run(`
          INSERT INTO users (id, fullName, email, phone, passwordHash, planStatus, trialEndsAt, subscriptionExpiresAt, isOwner, createdAt, lastLoginAt)
          VALUES (?, ?, ?, ?, ?, 'owner', ?, null, 1, ?, ?)
        `, [user.id, user.fullName, user.email, user.phone, passwordHash, user.trialEndsAt, user.createdAt, user.createdAt]);
      } else {
        return res.status(401).json({ error: 'User account not found' });
      }
    }

    const isOwner = isOwnerUser(user);
    if (isOwner && (user.isOwner !== 1 || user.planStatus !== 'owner')) {
      user.isOwner = 1;
      user.planStatus = 'owner';
      await dbAsync.run("UPDATE users SET isOwner = 1, planStatus = 'owner' WHERE id = ?", [user.id]).catch(() => {});
    }
    req.user = user;
    req.isOwner = isOwner;

    // Check Plan & Access
    let hasActiveAccess = false;
    let trialDaysRemaining = 0;
    const now = new Date();

    if (isOwner) {
      hasActiveAccess = true;
      trialDaysRemaining = 9999;
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
  if (!req.isOwner && !isOwnerUser(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Owner access only' });
  }
  next();
}

// -------------------------------------------------------------
// AUTH ROUTES
// -------------------------------------------------------------

// Sign Up
app.post('/api/auth/signup', signupLimiter, async (req, res) => {
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
    const isOwner = isOwnerUser({ email: cleanEmail, phone: cleanPhone });

    const existing = await dbAsync.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    if (existing && !isOwner) {
      return res.status(400).json({ error: 'Account already exists with this Email' });
    }

    const existingPhone = await dbAsync.get('SELECT * FROM users WHERE phone = ?', [cleanPhone]);
    if (existingPhone && !isOwner) {
      return res.status(400).json({ error: 'Account already exists with this Phone Number' });
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
    return sendInternalError(res, err, 'Error processing registration');
  }
});

// Login (Enforced 5 attempts per min rate-limiting)
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and App Password required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const isOwner = isOwnerUser({ email: cleanEmail });
    let user = await dbAsync.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (isOwner) {
      if (!user) {
        // Initial auto-provisioning of owner on first login
        const salt = await bcrypt.genSalt(10);
        const ownerPassword = process.env.OWNER_INITIAL_PASSWORD || password;
        const passwordHash = await bcrypt.hash(ownerPassword, salt);
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
          OWNER_PHONE || '918529062363',
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
        // Strict bcrypt password verification for owner (blocks arbitrary password takeover)
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
          const envInitialPass = process.env.OWNER_INITIAL_PASSWORD;
          if (envInitialPass && password === envInitialPass) {
            const salt = await bcrypt.genSalt(10);
            const newHash = await bcrypt.hash(password, salt);
            await dbAsync.run('UPDATE users SET passwordHash = ? WHERE id = ?', [newHash, user.id]);
            user.passwordHash = newHash;
          } else {
            return res.status(400).json({ error: 'Invalid Email or Password' });
          }
        }
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
    return sendInternalError(res, err, 'Error processing login');
  }
});

// Logout & Revoke JWT Token
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    const token = req.token;
    if (token) {
      const decoded = req.jwtDecoded || {};
      const expiresAt = decoded.exp ? new Date(decoded.exp * 1000).toISOString() : new Date(Date.now() + 365 * 86400000).toISOString();
      await dbAsync.run('INSERT INTO revoked_tokens (token, expiresAt, revokedAt) VALUES (?, ?, ?)', [
        token,
        expiresAt,
        new Date().toISOString()
      ]);
    }
    res.json({ success: true, message: 'Logged out and session revoked successfully.' });
  } catch (err) {
    return sendInternalError(res, err, 'Error processing logout');
  }
});

// Request Password Reset Token (15-min single-use cryptographically random token)
app.post('/api/auth/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const user = await dbAsync.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    // Constant response prevents email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, password reset instructions have been issued.'
      });
    }

    // Invalidate any active reset tokens for this user
    await dbAsync.run('UPDATE password_resets SET isUsed = 1 WHERE userId = ?', [user.id]);

    // High entropy 256-bit random reset token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15-min max limit

    const resetId = 'pr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    await dbAsync.run(
      'INSERT INTO password_resets (id, userId, tokenHash, expiresAt, isUsed, createdAt) VALUES (?, ?, ?, ?, 0, ?)',
      [resetId, user.id, tokenHash, expiresAt, new Date().toISOString()]
    );

    res.json({
      success: true,
      message: 'If an account exists with this email, password reset instructions have been issued.',
      ...(process.env.NODE_ENV !== 'production' ? { devResetToken: rawToken } : {})
    });
  } catch (err) {
    return sendInternalError(res, err, 'Error processing password reset request');
  }
});

// Confirm Password Reset with Single-Use Token
app.post('/api/auth/reset-password', passwordResetLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const resetRecord = await dbAsync.get('SELECT * FROM password_resets WHERE tokenHash = ? AND isUsed = 0', [tokenHash]);

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or already used password reset token' });
    }

    if (new Date(resetRecord.expiresAt) <= new Date()) {
      await dbAsync.run('UPDATE password_resets SET isUsed = 1 WHERE id = ?', [resetRecord.id]);
      return res.status(400).json({ error: 'Password reset token has expired (15-minute validity exceeded)' });
    }

    // Hash new password using bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update user password and mark token used
    await dbAsync.run('UPDATE users SET passwordHash = ? WHERE id = ?', [passwordHash, resetRecord.userId]);
    await dbAsync.run('UPDATE password_resets SET isUsed = 1 WHERE id = ?', [resetRecord.id]);

    res.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.'
    });
  } catch (err) {
    return sendInternalError(res, err, 'Error resetting password');
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

// Delete My Account (DPDP & GDPR Compliance)
app.delete('/api/auth/delete-account', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    await dbAsync.run('DELETE FROM reminders WHERE userId = ?', [userId]);
    await dbAsync.run('DELETE FROM push_subscriptions WHERE userId = ?', [userId]);
    await dbAsync.run('UPDATE coupons SET usedByUserId = null WHERE usedByUserId = ?', [userId]);
    await dbAsync.run('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true, message: 'Your account and all associated personal data have been permanently deleted.' });
  } catch (err) {
    return sendInternalError(res, err, 'Error processing account deletion');
  }
});

// -------------------------------------------------------------
// SUBSCRIPTIONS & COUPON SYSTEM
// -------------------------------------------------------------

// Single-use Coupon Apply
app.post('/api/subscription/apply-coupon', authMiddleware, couponLimiter, async (req, res) => {
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

    const isOwnerCode = cleanCode === 'OWNER-LIFETIME-VIP';
    if (coupon.isUsed === 1 && !isOwnerCode && !coupon.isUnlimited) {
      return res.status(400).json({ error: 'This coupon has already been used' });
    }

    const now = new Date();
    let newPlan = 'monthly';
    let expiresAt = null;

    if (isOwnerCode || coupon.planType === 'owner') {
      newPlan = 'owner';
      expiresAt = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
      await dbAsync.run(`
        UPDATE users SET planStatus = 'owner', isOwner = 1, subscriptionExpiresAt = ? WHERE id = ?
      `, [expiresAt, req.user.id]);
    } else if (coupon.planType === 'lifetime' || ['ADMIN-FOREVER-01', 'FOUNDER-VIP-PASS'].includes(cleanCode)) {
      newPlan = 'coupon_lifetime';
      expiresAt = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
      await dbAsync.run(`
        UPDATE users SET planStatus = 'coupon_lifetime', subscriptionExpiresAt = ? WHERE id = ?
      `, [expiresAt, req.user.id]);
      await dbAsync.run('UPDATE coupons SET isUsed = 1, usedByUserId = ?, usedAt = ? WHERE code = ?', [
        req.user.id,
        now.toISOString(),
        cleanCode
      ]);
    } else if (coupon.planType === '1year' || cleanCode.startsWith('FREE1Y-')) {
      newPlan = 'yearly';
      expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
      await dbAsync.run(`
        UPDATE users SET planStatus = 'yearly', subscriptionExpiresAt = ? WHERE id = ?
      `, [expiresAt, req.user.id]);
      await dbAsync.run('UPDATE coupons SET isUsed = 1, usedByUserId = ?, usedAt = ? WHERE code = ?', [
        req.user.id,
        now.toISOString(),
        cleanCode
      ]);
    } else {
      newPlan = 'monthly';
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await dbAsync.run(`
        UPDATE users SET planStatus = 'monthly', subscriptionExpiresAt = ? WHERE id = ?
      `, [expiresAt, req.user.id]);
      await dbAsync.run('UPDATE coupons SET isUsed = 1, usedByUserId = ?, usedAt = ? WHERE code = ?', [
        req.user.id,
        now.toISOString(),
        cleanCode
      ]);
    }

    res.json({
      success: true,
      message: isOwnerCode
        ? 'Owner Master VIP Plan activated! Lifetime 100% Free Forever.'
        : `Coupon applied successfully! Plan upgraded to ${newPlan.toUpperCase()}`,
      planStatus: newPlan,
      isOwner: isOwnerCode || req.user.isOwner === 1,
      lifetimeFree: isOwnerCode || newPlan === 'coupon_lifetime' || newPlan === 'owner',
      expiresAt
    });
  } catch (err) {
    return sendInternalError(res, err, 'Error applying coupon');
  }
});

// Razorpay Autopay Order / Mandate Creation (Server-side price calculation only)
app.post('/api/subscription/create-autopay', authMiddleware, async (req, res) => {
  try {
    const { planType } = req.body;
    if (planType !== 'monthly' && planType !== 'yearly') {
      return res.status(400).json({ error: 'Invalid plan type selected. Must be monthly or yearly.' });
    }

    // Server-enforced pricing (client parameters like price/amount/discount are strictly ignored)
    const amountPaise = planType === 'yearly' ? 15400 : 2050;

    const receipt = `rcpt_${req.user.id.substring(0, 8)}_${Date.now()}`;
    const options = {
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        userId: req.user.id,
        planType
      }
    };

    let order = null;
    if (razorpay) {
      try {
        order = await razorpay.orders.create(options);
      } catch (rzpErr) {
        console.error('[Razorpay Order Error]:', rzpErr.message);
      }
    }
    if (!order) {
      if (process.env.NODE_ENV === 'production' && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
        return res.status(502).json({ error: 'Failed to create payment order with gateway.' });
      }
      order = {
        id: 'order_simulated_' + Date.now(),
        amount: amountPaise,
        currency: 'INR',
        receipt: options.receipt
      };
    }

    // Record order in database for server-side verification and replay prevention
    await dbAsync.run(
      'INSERT INTO orders (id, userId, planType, amountPaise, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [order.id, req.user.id, planType, amountPaise, 'created', new Date().toISOString()]
    );

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
      planType
    });
  } catch (err) {
    return sendInternalError(res, err, 'Error creating subscription order');
  }
});

// Razorpay Autopay Verification (HMAC-SHA256 signature verification & plan integrity)
app.post('/api/subscription/verify-autopay', authMiddleware, async (req, res) => {
  try {
    const orderId = req.body.orderId || req.body.razorpay_order_id;
    const paymentId = req.body.paymentId || req.body.razorpay_payment_id;
    const signature = req.body.signature || req.body.razorpay_signature;

    if (!orderId || !paymentId) {
      return res.status(400).json({ error: 'Missing required order or payment identifiers.' });
    }

    // 1. Verify that order exists and belongs to this user
    const order = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found in system records.' });
    }
    if (order.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Order belongs to a different account.' });
    }
    if (order.status === 'paid') {
      return res.status(400).json({ error: 'Order has already been processed.' });
    }

    // 2. Cryptographic signature check (mandatory when secret configured or in production)
    if (RAZORPAY_KEY_SECRET) {
      if (!signature) {
        return res.status(400).json({ error: 'Missing cryptographic payment signature.' });
      }
      const payload = `${orderId}|${paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(payload)
        .digest('hex');

      const sigBuffer = Buffer.from(signature, 'utf8');
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

      if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        return res.status(400).json({ error: 'Invalid payment signature. Payment verification failed.' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Payment gateway secret not configured.' });
    }

    // 3. Grant access based strictly on server's recorded planType (ignoring any client body claim)
    const verifiedPlan = order.planType;
    const now = new Date();
    const durationDays = verifiedPlan === 'yearly' ? 365 : 30;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    // Mark order as paid
    await dbAsync.run('UPDATE orders SET status = ?, paymentId = ?, verifiedAt = ? WHERE id = ?', [
      'paid',
      paymentId,
      now.toISOString(),
      order.id
    ]);

    // Activate subscription
    await dbAsync.run(`
      UPDATE users SET planStatus = ?, subscriptionExpiresAt = ?, razorpaySubscriptionId = ? WHERE id = ?
    `, [verifiedPlan, expiresAt, paymentId, req.user.id]);

    res.json({
      success: true,
      message: `Subscription activated! Active until ${new Date(expiresAt).toDateString()}`,
      planStatus: verifiedPlan,
      expiresAt
    });
  } catch (err) {
    return sendInternalError(res, err, 'Error verifying subscription');
  }
});

// Razorpay Webhook Endpoint (HMAC Signature Verified)
app.post('/api/subscription/webhook', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || RAZORPAY_KEY_SECRET;
    if (!webhookSecret) {
      return res.status(501).json({ error: 'Webhook signature secret not configured' });
    }
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
    }

    const bodyStr = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', webhookSecret).update(bodyStr).digest('hex');

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    res.json({ status: 'ok', received: true });
  } catch (err) {
    return sendInternalError(res, err, 'Error processing webhook event');
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
    return sendInternalError(res, err, 'Error fetching reminders');
  }
});

// Unified POST /api/reminders Endpoint
app.post('/api/reminders', authMiddleware, async (req, res) => {
  try {
    if (!req.hasActiveAccess) {
      return res.status(403).json({ error: 'Your 10-day trial has ended. Please subscribe or apply coupon.' });
    }

    const title = (req.body.title || req.body.message || req.body.text || '').trim();
    if (!title) {
      return res.status(400).json({ error: 'Reminder title / message is required' });
    }
    if (title.length > 300) {
      return res.status(400).json({ error: 'Reminder title is too long (maximum 300 characters).' });
    }
    if (req.body.note && req.body.note.length > 2000) {
      return res.status(400).json({ error: 'Reminder note is too long (maximum 2000 characters).' });
    }

    const userReminders = await dbAsync.all('SELECT * FROM reminders WHERE userId = ?', [req.user.id]);
    if (userReminders.length >= 300 && !req.isOwner) {
      return res.status(400).json({ error: 'Reminder limit reached (maximum 300 active reminders). Please complete or delete old reminders.' });
    }

    const {
      note,
      date,
      time,
      reminderTime,
      reminderTimestamp,
      repeat = 'none',
      repeatTime = null,
      endDate = null,
      priority = 'normal',
      category = 'personal',
      targetContactPhone = null,
      targetContactName = null,
      minutes,
      preset
    } = req.body;

    let targetDate = new Date();
    if (reminderTimestamp) {
      targetDate = new Date(Number(reminderTimestamp));
    } else if (reminderTime) {
      targetDate = new Date(reminderTime);
    } else if (date && time) {
      targetDate = new Date(`${date}T${time}`);
    } else if (typeof minutes === 'number') {
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

    const targetTimeIso = targetDate.toISOString();
    const targetTimestampMs = targetDate.getTime();
    const reminderId = 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const nowIso = new Date().toISOString();

    await dbAsync.run(`
      INSERT INTO reminders (id, userId, title, message, reminderTime, reminderTimestamp, repeat, repeatTime, endDate, priority, category, targetContactPhone, targetContactName, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [
      reminderId,
      req.user.id,
      title,
      (note || title).trim(),
      targetTimeIso,
      targetTimestampMs,
      repeat,
      repeatTime,
      endDate,
      priority,
      category,
      targetContactPhone,
      targetContactName,
      nowIso
    ]);

    const createdReminder = {
      id: reminderId,
      userId: req.user.id,
      title,
      message: (note || title).trim(),
      reminderTime: targetTimeIso,
      reminderTimestamp: targetTimestampMs,
      repeat,
      repeatTime,
      endDate,
      priority,
      category,
      targetContactPhone,
      targetContactName,
      status: 'pending',
      clientPopped: 0,
      createdAt: nowIso
    };

    const scheduledTime = targetDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });

    res.status(201).json({
      success: true,
      reminder: createdReminder,
      reminderId,
      scheduledTime
    });
  } catch (err) {
    return sendInternalError(res, err, 'Error creating reminder');
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
    return sendInternalError(res, err, 'Error polling notifications');
  }
});

// Acknowledge in-app popup so it doesn't pop up again
app.post('/api/reminders/:id/ack-popup', authMiddleware, async (req, res) => {
  try {
    await dbAsync.run('UPDATE reminders SET clientPopped = 1 WHERE id = ? AND userId = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    return sendInternalError(res, err, 'Error acknowledging reminder');
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

    const createdReminder = {
      id: reminderId,
      userId: req.user.id,
      title: message.trim(),
      message: message.trim(),
      reminderTime: targetTimeIso,
      reminderTimestamp: targetTimestamp,
      repeat: 'none',
      priority: 'normal',
      category: 'personal',
      status: 'pending',
      clientPopped: 0,
      createdAt: now
    };

    res.status(201).json({
      success: true,
      reminder: createdReminder,
      reminderId,
      scheduledTime: targetDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
    });
  } catch (err) {
    return sendInternalError(res, err, 'Error saving quick reminder');
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

    const createdCustom = {
      id: reminderId,
      userId: req.user.id,
      title: title.trim(),
      message: (note || '').trim(),
      reminderTime: targetTimeIso,
      reminderTimestamp: targetTimestamp,
      repeat: repeat || 'none',
      priority: priority || 'normal',
      category: category || 'personal',
      status: 'pending',
      clientPopped: 0,
      createdAt: now
    };

    res.status(201).json({
      success: true,
      reminder: createdCustom,
      reminderId,
      scheduledTime: reminderDateTime.toLocaleString()
    });
  } catch (err) {
    return sendInternalError(res, err, 'Error saving custom reminder');
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

    const createdDaily = {
      id: reminderId,
      userId: req.user.id,
      title: title.trim(),
      message: (note || '').trim(),
      reminderTime: targetTimeIso,
      reminderTimestamp: targetTimestamp,
      repeat: 'daily',
      repeatTime: time,
      endDate: (kisDateTak || '').trim() || null,
      priority: priority || 'normal',
      category: 'personal',
      status: 'pending',
      clientPopped: 0,
      createdAt: now
    };

    res.status(201).json({
      success: true,
      reminder: createdDaily,
      reminderId,
      scheduledTime: `Daily at ${time}` + (kisDateTak ? ` until ${kisDateTak}` : '')
    });
  } catch (err) {
    return sendInternalError(res, err, 'Error saving daily reminder');
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
    const publicUrl = process.env.PUBLIC_APP_URL || 'https://reminderme.in.net';
    const shareMessage = `🔔 ReminderMe: "${title.trim()}" scheduled for ${timeFormatted} by ${req.user.fullName || 'a friend'}.\nOpen ReminderMe: ${publicUrl}/`;

    const createdContact = {
      id: reminderId,
      userId: req.user.id,
      title: title.trim(),
      message: (note || '').trim(),
      reminderTime: targetTimeIso,
      reminderTimestamp: targetTimestamp,
      repeat: 'none',
      priority: 'high',
      category: 'contact',
      targetContactPhone: cleanPhone,
      targetContactName: (contactName || '').trim(),
      status: 'pending',
      clientPopped: 0,
      createdAt: now
    };

    res.status(201).json({
      success: true,
      reminder: createdContact,
      reminderId,
      scheduledTime: timeFormatted,
      contactName: contactName || cleanPhone,
      targetUserNotified,
      cleanPhone,
      shareMessage
    });
  } catch (err) {
    return sendInternalError(res, err, 'Error creating contact reminder');
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
    return sendInternalError(res, err, 'Error dismissing reminder');
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
    return sendInternalError(res, err, 'Error snoozing reminder');
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
    return sendInternalError(res, err, 'Error deleting reminder');
  }
});

// -------------------------------------------------------------
// WEB PUSH SUBSCRIPTIONS
// -------------------------------------------------------------
app.get('/api/push/public-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notification service not configured' });
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
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
    return sendInternalError(res, err, 'Error registering push subscription');
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
    return sendInternalError(res, err, 'Error sending test push notification');
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

    // Load all reminders to give owner full visibility into users' saved data
    const allReminders = (await dbAsync.all('SELECT * FROM reminders ORDER BY reminderTime DESC')) || [];

    // Strip sensitive passwords for display and attach reminders
    const sanitizedUsers = allUsers.map(u => {
      const userRems = allReminders.filter(r => r.userId === u.id);
      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        planStatus: u.planStatus,
        trialEndsAt: u.trialEndsAt,
        subscriptionExpiresAt: u.subscriptionExpiresAt,
        razorpaySubscriptionId: u.razorpaySubscriptionId || '-',
        isOwner: u.isOwner === 1 || u.planStatus === 'owner',
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        remindersCount: userRems.length,
        reminders: userRems.map(r => ({
          id: r.id,
          title: r.title,
          message: r.message,
          time: r.reminderTime,
          status: r.status,
          targetContactName: r.targetContactName
        }))
      };
    });

    res.json({
      stats: {
        totalUsers: totalUsersRow ? totalUsersRow.count : allUsers.length,
        activeTrials,
        activeAutopay,
        totalRevenue: totalRevenue.toFixed(2),
        totalCoupons: totalCouponsRow ? totalCouponsRow.count : 0,
        usedCoupons: usedCouponsRow ? usedCouponsRow.count : 0,
        totalReminders: allReminders.length
      },
      users: sanitizedUsers
    });
  } catch (err) {
    return sendInternalError(res, err, 'Error loading admin stats');
  }
});

// -------------------------------------------------------------
// APP VERSION & INSTANT LIVE SYNC ENDPOINT
// -------------------------------------------------------------
app.get('/api/version', (req, res) => {
  res.json({
    version: '3.2.0',
    build: '2026-10-21',
    name: 'ReminderMe Production PWA',
    liveUrl: process.env.PUBLIC_APP_URL || 'https://reminderme.in.net'
  });
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
    return sendInternalError(res, err, 'Error generating coupons');
  }
});

// Admin User Action: Grant VIP Lifetime Plan
app.post('/api/admin/users/:id/grant-vip', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const targetUser = await dbAsync.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    const expiresAt = new Date(Date.now() + 100 * 365 * 86400000).toISOString();
    await dbAsync.run("UPDATE users SET planStatus = 'coupon_lifetime', subscriptionExpiresAt = ? WHERE id = ?", [expiresAt, targetUser.id]);
    res.json({ success: true, message: `VIP Lifetime access granted to ${targetUser.fullName || targetUser.email}` });
  } catch (err) {
    return sendInternalError(res, err, 'Error granting VIP plan');
  }
});

// Admin User Action: Extend Trial (+30 Days)
app.post('/api/admin/users/:id/extend-trial', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const targetUser = await dbAsync.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    const currentEnd = new Date(targetUser.trialEndsAt && new Date(targetUser.trialEndsAt) > new Date() ? targetUser.trialEndsAt : Date.now());
    const newTrialEnd = new Date(currentEnd.getTime() + 30 * 86400000).toISOString();
    await dbAsync.run("UPDATE users SET planStatus = 'trial', trialEndsAt = ? WHERE id = ?", [newTrialEnd, targetUser.id]);
    res.json({ success: true, message: `Trial extended by 30 days for ${targetUser.fullName || targetUser.email}` });
  } catch (err) {
    return sendInternalError(res, err, 'Error extending trial');
  }
});

// Admin User Action: Permanently Delete User & Clean Records
app.delete('/api/admin/users/:id', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    if (req.params.id === req.user.id || req.params.id === 'usr_owner_deepak') {
      return res.status(400).json({ error: 'Cannot delete the owner account.' });
    }
    await dbAsync.run('DELETE FROM reminders WHERE userId = ?', [req.params.id]);
    await dbAsync.run('DELETE FROM push_subscriptions WHERE userId = ?', [req.params.id]);
    await dbAsync.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User record and associated reminders permanently deleted.' });
  } catch (err) {
    return sendInternalError(res, err, 'Error deleting user');
  }
});

// Admin User Action: Purge Test / Simulated Data
app.post('/api/admin/clean-tests', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const allUsers = await dbAsync.all('SELECT * FROM users ORDER BY createdAt DESC');
    let cleanedCount = 0;
    for (const u of allUsers) {
      if (u.id !== req.user.id && u.id !== 'usr_owner_deepak') {
        const isTest = u.id.startsWith('test') || u.id.includes('_test_') || (u.email && (u.email.includes('test') || u.email.includes('example.com') || u.email.includes('fake')));
        if (isTest) {
          await dbAsync.run('DELETE FROM reminders WHERE userId = ?', [u.id]);
          await dbAsync.run('DELETE FROM push_subscriptions WHERE userId = ?', [u.id]);
          await dbAsync.run('DELETE FROM users WHERE id = ?', [u.id]);
          cleanedCount++;
        }
      }
    }
    res.json({ success: true, message: `Cleaned ${cleanedCount} test entries.` });
  } catch (err) {
    return sendInternalError(res, err, 'Error cleaning test data');
  }
});

// -------------------------------------------------------------
// BACKGROUND DISPATCHER SCHEDULER (Push Notifications)
// -------------------------------------------------------------
if (!process.env.VERCEL) {
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
        console.error('[Scheduler] Failed reminder dispatch:', sendErr.message);
        await dbAsync.run('UPDATE reminders SET status = "failed", error = ? WHERE id = ?', [sendErr.message, reminder.id]);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error in check loop:', err.message);
  }
}, 5000);
}

// Ping endpoint for keepalive
app.get('/api/ping', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Global 404 API Handler
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Centralized Global Error Handler Middleware (Opaque Error + Correlation ID)
app.use((err, req, res, next) => {
  const correlationId = 'err_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
  console.error(`[CorrelationID: ${correlationId}] Global Handler:`, err && (err.stack || err.message || err));
  const statusCode = err.status || (err.message && err.message.includes('CORS') ? 403 : 500);
  res.status(statusCode).json({
    error: statusCode === 403 ? err.message : 'An unexpected error occurred.',
    correlationId
  });
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ReminderMe Server running on port ${PORT}`);
  });
}

module.exports = app;
