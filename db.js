const fs = require('fs');
const path = require('path');

// Enforce TLS/SSL if external database connection string is configured in production
if (process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL.toLowerCase();
  if (process.env.NODE_ENV === 'production' && !url.includes('sslmode=') && !url.includes('ssl=')) {
    throw new Error('[DB SECURITY FATAL] External database connection in production must mandate TLS/SSL encryption (e.g. ?sslmode=require).');
  }
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'reminder_me.json');

// Default initial state
const defaultData = {
  users: [],
  reminders: [],
  coupons: [
    { code: 'OWNER-LIFETIME-VIP', planType: 'owner', isUsed: 0, isUnlimited: 1, usedByUserId: null, usedAt: null },
    { code: 'ADMIN-FOREVER-01', planType: 'lifetime', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FOUNDER-VIP-PASS', planType: 'lifetime', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-4Z9K2M', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-8H3P9X', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-2W7R5Y', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-9K4N2H', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-5T8D1W', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-3M6Y8V', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-7P2X4K', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-1H9J6Q', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-6V3L5T', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-4N8C7R', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-2K5W9P', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-8Y1M3X', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-9D4H6Z', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-5R7T2V', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-3X8N1K', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-7J2Q6W', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-1P5L4H', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-6C9Y3T', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-4W2V8M', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-8K6H5X', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-2T1R9Q', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-9M3N4Y', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-5H7P2W', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-3V8K1Z', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1M-7X4L6R', planType: '1month', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-9W2K5H', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-4M8P3T', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-1X7R9V', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-6N3L2W', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-8Y5H1K', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-2T9Q4M', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-5P1X8Z', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-3C7V6N', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-7K4J2Y', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-9D8W1Q', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-4H2M5T', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-1R6L9X', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-8W3N7P', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-2K9Y4H', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-6V1T8R', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-5M7X3K', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-3Q8P2W', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-7N5H1V', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-9T2L6M', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-4X9K5Q', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-1H3W8Y', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-6P4R2N', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-8V7K9Z', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-2M5W1T', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null },
    { code: 'FREE1Y-7J6X4P', planType: '1year', isUsed: 0, usedByUserId: null, usedAt: null }
  ],
  push_subscriptions: [],
  orders: [],
  revoked_tokens: [],
  password_resets: [],
  app_settings: {}
};

function loadDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    saveDatabase(defaultData);
    return JSON.parse(JSON.stringify(defaultData));
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    parsed.users = parsed.users || [];
    parsed.reminders = parsed.reminders || [];
    parsed.coupons = parsed.coupons || [];
    parsed.push_subscriptions = parsed.push_subscriptions || [];
    parsed.orders = parsed.orders || [];
    parsed.revoked_tokens = parsed.revoked_tokens || [];
    parsed.password_resets = parsed.password_resets || [];
    parsed.app_settings = parsed.app_settings || {};

    // Auto-heal any corrupted reminder status records
    parsed.reminders = (parsed.reminders || []).map(r => {
      if (r && r.status && typeof r.status === 'string' && r.status.includes('T') && r.status.includes(':')) {
        r.createdAt = r.createdAt || r.status;
        r.status = 'pending';
      }
      if (!r.status) r.status = 'pending';
      if (r.clientPopped === undefined) r.clientPopped = 0;
      return r;
    });

    // Ensure seed coupons exist
    defaultData.coupons.forEach(seed => {
      if (!parsed.coupons.some(c => c.code === seed.code)) {
        parsed.coupons.push({ ...seed });
      }
    });

    return parsed;
  } catch (err) {
    console.error('[DB] Error loading DB, using fallback defaults:', err);
    return JSON.parse(JSON.stringify(defaultData));
  }
}

let memoryDb = loadDatabase();

function saveDatabase(dataToSave) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave || memoryDb, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB] Save error:', err);
  }
}

// Pure JS async query emulator matching SQLite syntax in server.js
const dbAsync = {
  get: async (sql, params = []) => {
    const s = sql.trim().toLowerCase();

    // 1. SELECT * FROM users WHERE id = ?
    if (s.includes('from users where id =')) {
      return memoryDb.users.find(u => u.id === params[0]) || null;
    }

    // 2. SELECT * FROM users WHERE email = ? OR SELECT id FROM users WHERE email = ?
    if (s.includes('from users where email =')) {
      const email = (params[0] || '').toLowerCase().trim();
      return memoryDb.users.find(u => (u.email || '').toLowerCase().trim() === email) || null;
    }

    // 2b. SELECT * FROM users WHERE phone = ?
    if (s.includes('from users where phone =')) {
      const cleanTarget = (params[0] || '').replace(/[^0-9]/g, '');
      if (!cleanTarget) return null;
      return memoryDb.users.find(u => {
        const uPhone = (u.phone || '').replace(/[^0-9]/g, '');
        return uPhone && (uPhone === cleanTarget || uPhone.endsWith(cleanTarget) || cleanTarget.endsWith(uPhone));
      }) || null;
    }

    // 3. SELECT * FROM coupons WHERE code = ?
    if (s.includes('from coupons where code =')) {
      const code = (params[0] || '').toUpperCase().trim();
      return memoryDb.coupons.find(c => (c.code || '').toUpperCase().trim() === code) || null;
    }

    // 4. SELECT * FROM reminders WHERE id = ? AND userId = ?
    if (s.includes('from reminders where id = ? and userid = ?')) {
      return memoryDb.reminders.find(r => r.id === params[0] && r.userId === params[1]) || null;
    }

    // 5. SELECT COUNT(*) as count FROM users
    if (s.includes('count(*)') && s.includes('from users')) {
      return { count: memoryDb.users.length };
    }

    // 6. SELECT COUNT(*) as count FROM coupons WHERE isUsed = 1
    if (s.includes('count(*)') && s.includes('from coupons where isused = 1')) {
      return { count: memoryDb.coupons.filter(c => c.isUsed === 1).length };
    }

    // 7. SELECT COUNT(*) as count FROM coupons
    if (s.includes('count(*)') && s.includes('from coupons')) {
      return { count: memoryDb.coupons.length };
    }

    // 8. SELECT * FROM revoked_tokens WHERE token = ?
    if (s.includes('from revoked_tokens where token =')) {
      const now = new Date();
      return (memoryDb.revoked_tokens || []).find(t => t.token === params[0] && new Date(t.expiresAt) > now) || null;
    }

    // 9. SELECT * FROM orders WHERE id = ?
    if (s.includes('from orders where id =')) {
      return (memoryDb.orders || []).find(o => o.id === params[0]) || null;
    }

    // 10. SELECT * FROM password_resets WHERE tokenHash = ? AND isUsed = 0
    if (s.includes('from password_resets where tokenhash =')) {
      return (memoryDb.password_resets || []).find(p => p.tokenHash === params[0] && p.isUsed === 0) || null;
    }

    console.warn('[DB] Unhandled dbAsync.get query:', sql);
    return null;
  },

  all: async (sql, params = []) => {
    const s = sql.trim().toLowerCase();

    // 1. SELECT * FROM push_subscriptions WHERE userId = ?
    if (s.includes('from push_subscriptions where userid =')) {
      return memoryDb.push_subscriptions.filter(p => String(p.userId) === String(params[0]));
    }

    // 2. In-App Due Check: SELECT * FROM reminders WHERE userId = ? AND clientPopped != 1 AND status != 'completed' AND reminderTime <= ?
    if (s.includes('from reminders where userid =') && (s.includes('clientpopped') || s.includes('status = \'pending\'') || s.includes('status !='))) {
      const nowMs = Date.now();
      return memoryDb.reminders.filter(r => {
        if (String(r.userId) !== String(params[0])) return false;
        if (r.status === 'completed') return false;
        if (r.clientPopped === 1) return false;
        const dueMs = r.reminderTimestamp || new Date(r.reminderTime).getTime();
        // Due now or in the past (up to 24 hours ago) with 10s grace
        return dueMs <= (nowMs + 10000) && (nowMs - dueMs < 86400000);
      });
    }

    // 3. SELECT * FROM reminders WHERE userId = ? ORDER BY reminderTime ASC
    if (s.includes('from reminders where userid =')) {
      const list = memoryDb.reminders.filter(r => String(r.userId) === String(params[0]));
      return list.sort((a, b) => new Date(a.reminderTime) - new Date(b.reminderTime));
    }

    // 4. SELECT * FROM users ORDER BY createdAt DESC
    if (s.includes('from users order by createdat desc')) {
      return [...memoryDb.users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // 5. Scheduler JOIN query:
    // SELECT r.*, u.phone as userPhone, u.email as userEmail, u.planStatus, u.trialEndsAt, u.subscriptionExpiresAt, u.isOwner
    // FROM reminders r JOIN users u ON r.userId = u.id WHERE r.status = 'pending' AND r.reminderTime <= ?
    if (s.includes('from reminders r') && s.includes('join users u')) {
      const nowMs = Date.now();
      const pending = memoryDb.reminders.filter(r => {
        if (r.status !== 'pending') return false;
        const dueMs = r.reminderTimestamp || new Date(r.reminderTime).getTime();
        return dueMs <= nowMs;
      });
      return pending.map(r => {
        const u = memoryDb.users.find(user => user.id === r.userId) || {};
        return {
          ...r,
          userPhone: u.phone || '',
          userEmail: u.email || '',
          planStatus: u.planStatus || 'trial',
          trialEndsAt: u.trialEndsAt || '',
          subscriptionExpiresAt: u.subscriptionExpiresAt || null,
          isOwner: u.isOwner || 0
        };
      });
    }

    console.warn('[DB] Unhandled dbAsync.all query:', sql);
    return [];
  },

  run: async (sql, params = []) => {
    const s = sql.trim().toLowerCase();

    // 1. INSERT INTO users
    if (s.startsWith('insert into users')) {
      const [id, fullName, email, phone, passwordHash, planStatus, trialEndsAt, subscriptionExpiresAt, isOwner, createdAt, lastLoginAt] = params;
      const newUser = {
        id,
        fullName,
        email: (email || '').toLowerCase().trim(),
        phone,
        passwordHash,
        planStatus: planStatus || 'trial',
        trialEndsAt,
        subscriptionExpiresAt: subscriptionExpiresAt || null,
        isOwner: isOwner ? 1 : 0,
        createdAt: createdAt || new Date().toISOString(),
        razorpaySubscriptionId: null,
        lastLoginAt: lastLoginAt || new Date().toISOString()
      };
      memoryDb.users.push(newUser);
      saveDatabase();
      return { lastID: id, changes: 1 };
    }

    // 2. UPDATE users SET passwordHash = ? WHERE id = ?
    if (s.includes('update users set passwordhash =')) {
      const [passwordHash, id] = params;
      const u = memoryDb.users.find(user => user.id === id);
      if (u) {
        u.passwordHash = passwordHash;
        u.isOwner = 1;
        u.planStatus = 'owner';
        saveDatabase();
      }
      return { changes: u ? 1 : 0 };
    }

    // 2b. UPDATE users SET lastLoginAt = ? WHERE id = ?
    if (s.includes('update users set lastloginat =')) {
      const [lastLoginAt, id] = params;
      const u = memoryDb.users.find(user => user.id === id);
      if (u) {
        u.lastLoginAt = lastLoginAt;
        saveDatabase();
      }
      return { changes: u ? 1 : 0 };
    }

    // 3. UPDATE users SET planStatus = ?, subscriptionExpiresAt = ?, razorpaySubscriptionId = ? WHERE id = ?
    if (s.includes('update users set planstatus =') && s.includes('razorpaysubscriptionid =')) {
      const [planStatus, subscriptionExpiresAt, razorpaySubscriptionId, id] = params;
      const u = memoryDb.users.find(user => user.id === id);
      if (u) {
        u.planStatus = planStatus;
        u.subscriptionExpiresAt = subscriptionExpiresAt;
        u.razorpaySubscriptionId = razorpaySubscriptionId;
        saveDatabase();
      }
      return { changes: u ? 1 : 0 };
    }

    // 4. UPDATE users SET planStatus = ?, trialEndsAt = ? WHERE id = ?
    if (s.includes('update users set planstatus =') && s.includes('trialendsat =')) {
      const [trialEndsAt, id] = params;
      const u = memoryDb.users.find(user => user.id === id);
      if (u) {
        u.planStatus = 'trial';
        u.trialEndsAt = trialEndsAt;
        saveDatabase();
      }
      return { changes: u ? 1 : 0 };
    }

    // 4b. UPDATE users SET planStatus = ?, subscriptionExpiresAt = ? WHERE id = ?
    if (s.includes('update users set planstatus =') && !s.includes('razorpaysubscriptionid =')) {
      const [planStatus, subscriptionExpiresAt, id] = params;
      const u = memoryDb.users.find(user => user.id === id);
      if (u) {
        u.planStatus = planStatus;
        u.subscriptionExpiresAt = subscriptionExpiresAt;
        saveDatabase();
      }
      return { changes: u ? 1 : 0 };
    }

    // 5. DELETE FROM users WHERE id = ?
    if (s.includes('delete from users where id =')) {
      const before = memoryDb.users.length;
      memoryDb.users = memoryDb.users.filter(u => u.id !== params[0]);
      saveDatabase();
      return { changes: before - memoryDb.users.length };
    }

    // 6. DELETE FROM reminders WHERE userId = ?
    if (s.includes('delete from reminders where userid =')) {
      const before = memoryDb.reminders.length;
      memoryDb.reminders = memoryDb.reminders.filter(r => r.userId !== params[0]);
      saveDatabase();
      return { changes: before - memoryDb.reminders.length };
    }

    // 7. DELETE FROM push_subscriptions WHERE userId = ?
    if (s.includes('delete from push_subscriptions where userid =')) {
      const before = memoryDb.push_subscriptions.length;
      memoryDb.push_subscriptions = memoryDb.push_subscriptions.filter(p => p.userId !== params[0]);
      saveDatabase();
      return { changes: before - memoryDb.push_subscriptions.length };
    }

    // 8. DELETE FROM push_subscriptions WHERE id = ?
    if (s.includes('delete from push_subscriptions where id =')) {
      const before = memoryDb.push_subscriptions.length;
      memoryDb.push_subscriptions = memoryDb.push_subscriptions.filter(p => p.id !== params[0]);
      saveDatabase();
      return { changes: before - memoryDb.push_subscriptions.length };
    }

    // 9. INSERT OR REPLACE INTO push_subscriptions (id, userId, endpoint, keys, createdAt)
    if (s.includes('into push_subscriptions')) {
      const [id, userId, endpoint, keys, createdAt] = params;
      memoryDb.push_subscriptions = memoryDb.push_subscriptions.filter(p => p.endpoint !== endpoint);
      memoryDb.push_subscriptions.push({ id, userId, endpoint, keys, createdAt });
      saveDatabase();
      return { lastID: id, changes: 1 };
    }

    // 10. UPDATE coupons SET isUsed = 1, usedByUserId = ?, usedAt = ? WHERE code = ?
    if (s.includes('update coupons set isused = 1')) {
      const [usedByUserId, usedAt, code] = params;
      const c = memoryDb.coupons.find(coupon => (coupon.code || '').toUpperCase() === (code || '').toUpperCase());
      if (c) {
        c.isUsed = 1;
        c.usedByUserId = usedByUserId;
        c.usedAt = usedAt;
        saveDatabase();
      }
      return { changes: c ? 1 : 0 };
    }

    // 11. INSERT INTO coupons (code, planType, isUsed) VALUES (?, ?, 0)
    if (s.startsWith('insert into coupons')) {
      const [code, planType] = params;
      const cleanCode = (code || '').toUpperCase().trim();
      if (!memoryDb.coupons.some(c => c.code === cleanCode)) {
        memoryDb.coupons.push({
          code: cleanCode,
          planType: planType || '1month',
          isUsed: 0,
          usedByUserId: null,
          usedAt: null
        });
        saveDatabase();
      }
      return { changes: 1 };
    }

    // 12. INSERT INTO reminders
    if (s.startsWith('insert into reminders')) {
      const colMatch = sql.match(/insert\s+into\s+reminders\s*\(([^)]+)\)/i);
      const valMatch = sql.match(/values\s*\(([^)]+)\)/i);
      const newReminder = {
        id: null,
        userId: null,
        title: '',
        message: '',
        reminderTime: null,
        reminderTimestamp: null,
        repeat: 'none',
        repeatTime: null,
        endDate: null,
        priority: 'normal',
        category: 'personal',
        targetContactPhone: null,
        targetContactName: null,
        status: 'pending',
        clientPopped: 0,
        sentCount: 0,
        createdAt: new Date().toISOString(),
        sentAt: null,
        error: null
      };

      if (colMatch && valMatch) {
        const cols = colMatch[1].split(',').map(c => c.trim());
        const vals = valMatch[1].split(',').map(v => v.trim());
        let paramIdx = 0;
        cols.forEach((col, idx) => {
          const valExpr = vals[idx] || '?';
          if (valExpr === '?') {
            if (paramIdx < params.length) {
              newReminder[col] = params[paramIdx++];
            }
          } else {
            const cleanVal = valExpr.replace(/^['"]|['"]$/g, '');
            newReminder[col] = cleanVal;
          }
        });
      } else if (colMatch) {
        const cols = colMatch[1].split(',').map(c => c.trim());
        cols.forEach((col, idx) => {
          if (idx < params.length) {
            newReminder[col] = params[idx];
          }
        });
      }

      if (!newReminder.reminderTimestamp && newReminder.reminderTime) {
        newReminder.reminderTimestamp = new Date(newReminder.reminderTime).getTime();
      }
      if (!newReminder.reminderTime && newReminder.reminderTimestamp) {
        newReminder.reminderTime = new Date(newReminder.reminderTimestamp).toISOString();
      }
      if (!newReminder.status || (typeof newReminder.status === 'string' && newReminder.status.includes('T') && newReminder.status.includes(':'))) {
        newReminder.status = 'pending';
      }

      memoryDb.reminders.push(newReminder);
      saveDatabase();
      return { lastID: newReminder.id, changes: 1 };
    }

    // 13. DELETE FROM reminders WHERE id = ? AND userId = ?
    if (s.includes('delete from reminders where id = ? and userid = ?')) {
      const [id, userId] = params;
      const before = memoryDb.reminders.length;
      memoryDb.reminders = memoryDb.reminders.filter(r => !(r.id === id && r.userId === userId));
      saveDatabase();
      return { changes: before - memoryDb.reminders.length };
    }

    // 14. UPDATE reminders SET status = "completed" WHERE id = ?
    if (s.includes('update reminders set status = "completed" where id =')) {
      const [id] = params;
      const r = memoryDb.reminders.find(rem => rem.id === id);
      if (r) {
        r.status = 'completed';
        saveDatabase();
      }
      return { changes: r ? 1 : 0 };
    }

    // 15. UPDATE reminders SET status = "completed", sentCount = sentCount + 1, sentAt = ? WHERE id = ?
    if (s.includes('update reminders set status = "completed", sentcount = sentcount + 1')) {
      const [sentAt, id] = params;
      const r = memoryDb.reminders.find(rem => rem.id === id);
      if (r) {
        r.status = 'completed';
        r.sentCount = (r.sentCount || 0) + 1;
        r.sentAt = sentAt;
        saveDatabase();
      }
      return { changes: r ? 1 : 0 };
    }

    // 16. UPDATE reminders SET reminderTime = ?, sentCount = sentCount + 1, sentAt = ? WHERE id = ?
    if (s.includes('update reminders set remindertime = ?')) {
      const [reminderTime, sentAt, id] = params;
      const r = memoryDb.reminders.find(rem => rem.id === id);
      if (r) {
        r.reminderTime = reminderTime;
        r.sentCount = (r.sentCount || 0) + 1;
        r.sentAt = sentAt;
        saveDatabase();
      }
      return { changes: r ? 1 : 0 };
    }

    // 17. UPDATE reminders SET status = "sent", sentAt = ? WHERE id = ?
    if (s.includes('update reminders set status = "sent"')) {
      const [sentAt, id] = params;
      const r = memoryDb.reminders.find(rem => rem.id === id);
      if (r) {
        r.status = 'sent';
        r.sentAt = sentAt;
        saveDatabase();
      }
      return { changes: r ? 1 : 0 };
    }

    // 18. UPDATE reminders SET status = "failed", error = ? WHERE id = ?
    if (s.includes('update reminders set status = "failed"')) {
      const [error, id] = params;
      const r = memoryDb.reminders.find(rem => rem.id === id);
      if (r) {
        r.status = 'failed';
        r.error = error;
        saveDatabase();
      }
      return { changes: r ? 1 : 0 };
    }

    // 19. UPDATE reminders SET clientPopped = 1 WHERE id = ? [AND userId = ?]
    if (s.includes('update reminders set clientpopped = 1')) {
      const [id, userId] = params;
      const r = memoryDb.reminders.find(rem => rem.id === id && (!userId || rem.userId === userId));
      if (r) {
        r.clientPopped = 1;
        saveDatabase();
      }
      return { changes: r ? 1 : 0 };
    }

    // 20. UPDATE coupons SET usedByUserId = null WHERE usedByUserId = ? (Account Deletion / Anonymization)
    if (s.includes('update coupons set usedbyuserid = null where usedbyuserid =')) {
      const [userId] = params;
      let count = 0;
      memoryDb.coupons.forEach(c => {
        if (c.usedByUserId === userId) {
          c.usedByUserId = null;
          count++;
        }
      });
      if (count > 0) saveDatabase();
      return { changes: count };
    }

    // 21. INSERT INTO revoked_tokens (token, expiresAt, revokedAt) VALUES (?, ?, ?)
    if (s.startsWith('insert into revoked_tokens')) {
      const [token, expiresAt, revokedAt] = params;
      memoryDb.revoked_tokens = memoryDb.revoked_tokens || [];
      memoryDb.revoked_tokens.push({ token, expiresAt, revokedAt });
      saveDatabase();
      return { changes: 1 };
    }

    // 22. INSERT INTO orders (id, userId, planType, amountPaise, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)
    if (s.startsWith('insert into orders')) {
      const [id, userId, planType, amountPaise, status, createdAt] = params;
      memoryDb.orders = memoryDb.orders || [];
      memoryDb.orders.push({ id, userId, planType, amountPaise, status, createdAt });
      saveDatabase();
      return { changes: 1 };
    }

    // 23. UPDATE orders SET status = ?, paymentId = ?, verifiedAt = ? WHERE id = ?
    if (s.startsWith('update orders set status =')) {
      const [status, paymentId, verifiedAt, id] = params;
      const order = (memoryDb.orders || []).find(o => o.id === id);
      if (order) {
        order.status = status;
        order.paymentId = paymentId;
        order.verifiedAt = verifiedAt;
        saveDatabase();
      }
      return { changes: order ? 1 : 0 };
    }

    // 24. INSERT INTO password_resets (id, userId, tokenHash, expiresAt, isUsed, createdAt) VALUES (?, ?, ?, ?, 0, ?)
    if (s.startsWith('insert into password_resets')) {
      const [id, userId, tokenHash, expiresAt, createdAt] = params;
      memoryDb.password_resets = memoryDb.password_resets || [];
      memoryDb.password_resets.push({ id, userId, tokenHash, expiresAt, isUsed: 0, createdAt });
      saveDatabase();
      return { changes: 1 };
    }

    // 25. UPDATE password_resets SET isUsed = 1 WHERE id = ?
    if (s.includes('update password_resets set isused = 1 where id =')) {
      const [id] = params;
      const pr = (memoryDb.password_resets || []).find(p => p.id === id);
      if (pr) {
        pr.isUsed = 1;
        saveDatabase();
      }
      return { changes: pr ? 1 : 0 };
    }

    // 26. UPDATE password_resets SET isUsed = 1 WHERE userId = ?
    if (s.includes('update password_resets set isused = 1 where userid =')) {
      const [userId] = params;
      let count = 0;
      (memoryDb.password_resets || []).forEach(p => {
        if (p.userId === userId) {
          p.isUsed = 1;
          count++;
        }
      });
      if (count > 0) saveDatabase();
      return { changes: count };
    }

    console.warn('[DB] Unhandled dbAsync.run query:', sql);
    return { changes: 0 };
  }
};

module.exports = { db: {}, dbAsync, DB_PATH: DB_FILE };
