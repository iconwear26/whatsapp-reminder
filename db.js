const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'reminder_me.db');
const db = new sqlite3.Database(DB_PATH);

// Initialize Tables
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      fullName TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      planStatus TEXT DEFAULT 'trial', -- 'trial', 'monthly', 'yearly', 'coupon_lifetime', 'owner'
      trialEndsAt TEXT NOT NULL,
      subscriptionExpiresAt TEXT,
      razorpaySubscriptionId TEXT,
      isOwner INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      lastLoginAt TEXT
    )
  `);

  // Reminders table
  db.run(`
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      reminderTime TEXT NOT NULL,
      repeat TEXT DEFAULT 'none', -- 'none', 'daily'
      repeatTime TEXT,
      endDate TEXT,
      priority TEXT DEFAULT 'normal',
      category TEXT DEFAULT 'personal',
      targetContactPhone TEXT,
      targetContactName TEXT,
      status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'completed', 'failed'
      sentCount INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      sentAt TEXT,
      error TEXT,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Coupons table
  db.run(`
    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      planType TEXT NOT NULL, -- '1month', '1year', 'lifetime'
      isUsed INTEGER DEFAULT 0,
      usedByUserId TEXT,
      usedAt TEXT
    )
  `);

  // Push Subscriptions table
  db.run(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      endpoint TEXT UNIQUE NOT NULL,
      keys TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  // Global app settings
  db.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Seed standard single-use coupons & Owner VIP
  const seedCoupons = [
    { code: 'OWNER-LIFETIME-VIP', planType: 'lifetime' },
    { code: 'FREE1M-REMIND01', planType: '1month' },
    { code: 'FREE1M-REMIND02', planType: '1month' },
    { code: 'FREE1M-REMIND03', planType: '1month' },
    { code: 'FREE1M-REMIND04', planType: '1month' },
    { code: 'FREE1M-REMIND05', planType: '1month' },
    { code: 'FREE1Y-REMIND01', planType: '1year' },
    { code: 'FREE1Y-REMIND02', planType: '1year' },
    { code: 'FREE1Y-REMIND03', planType: '1year' }
  ];

  const stmt = db.prepare(`INSERT OR IGNORE INTO coupons (code, planType, isUsed) VALUES (?, ?, 0)`);
  seedCoupons.forEach(c => stmt.run(c.code, c.planType));
  stmt.finalize();
});

// Helper DB Promise wrappers
const dbAsync = {
  get: (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  }),
  all: (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  }),
  run: (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  })
};

module.exports = { db, dbAsync, DB_PATH };
