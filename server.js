const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data folder exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const REMINDERS_FILE = path.join(DATA_DIR, 'reminders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const AUTH_DIR = path.join(DATA_DIR, 'auth_baileys');

// WhatsApp State Variables
let sock = null;
let currentQR = null;
let currentQRImage = null;
let isWAConnected = false;
let loggedInUser = '';

function readJSON(filePath, defaultData = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultData;
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

function sanitizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

// Connect to WhatsApp using Baileys
async function startWhatsAppBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: 'silent' }),
      browser: ['WhatsApp Reminder App', 'Chrome', '1.0.0']
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        try {
          currentQRImage = await QRCode.toDataURL(qr, {
            width: 280,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
          });
          console.log('[WhatsApp] Generated fresh QR code image!');
        } catch (qrErr) {
          console.error('[WhatsApp] QR Image generation error:', qrErr);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        isWAConnected = false;
        currentQR = null;
        currentQRImage = null;
        console.log(`[WhatsApp] Connection closed (code: ${statusCode}). Reconnect: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('[WhatsApp] Logged out. Clearing credentials...');
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
        loggedInUser = userJid.split(':')[0] || userJid.split('@')[0];
        console.log(`====================================================`);
        console.log(`✅ WhatsApp Connected successfully!`);
        console.log(`👤 Sender Account: +${loggedInUser}`);
        console.log(`====================================================`);
      }
    });

    sock.ev.on('creds.update', saveCreds);
  } catch (err) {
    console.error('[WhatsApp] Initialization error:', err);
    setTimeout(startWhatsAppBot, 5000);
  }
}

// Start WhatsApp
startWhatsAppBot();

// Unified Send WhatsApp Message Handler
async function sendAnyWhatsAppMessage(targetPhone, message) {
  if (isWAConnected && sock) {
    const clean = sanitizePhone(targetPhone) || loggedInUser;
    const recipientJid = `${clean}@s.whatsapp.net`;
    console.log(`[WhatsApp] Sending reminder from +${loggedInUser} to +${clean}...`);
    await sock.sendMessage(recipientJid, { text: message });
    console.log(`[WhatsApp] Message successfully sent!`);
    return { method: 'direct', sender: loggedInUser, recipient: clean };
  }

  throw new Error('WhatsApp is not connected! Please scan the QR code in WhatsApp settings tab.');
}

// API Routes

// 1. WhatsApp Connection Status & QR Image
app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    isConnected: isWAConnected,
    qr: currentQR,
    qrImage: currentQRImage,
    phone: loggedInUser || ''
  });
});

// Logout WhatsApp
app.post('/api/whatsapp/logout', async (req, res) => {
  try {
    if (sock) {
      await sock.logout();
    }
    isWAConnected = false;
    currentQR = null;
    currentQRImage = null;
    loggedInUser = '';
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    } catch (e) {}
    setTimeout(startWhatsAppBot, 1000);
    res.json({ success: true, message: 'Disconnected.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Network Info with pre-rendered QR
app.get('/api/network-info', async (req, res) => {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }

  const mobileUrl = addresses.length > 0 ? `http://${addresses[0]}:${PORT}` : `http://localhost:${PORT}`;
  let mobileUrlQR = '';
  try {
    mobileUrlQR = await QRCode.toDataURL(mobileUrl, { width: 220, margin: 2 });
  } catch (e) {}

  res.json({
    port: PORT,
    ips: addresses,
    localUrl: `http://localhost:${PORT}`,
    mobileUrl: mobileUrl,
    mobileUrlQR: mobileUrlQR
  });
});

// 3. Settings Endpoints
app.get('/api/settings', (req, res) => {
  const settings = readJSON(SETTINGS_FILE, {
    recipientPhone: '',
    defaultDelayMinutes: 15,
    defaultPriority: 'high',
    theme: 'dark'
  });
  res.json({
    recipientPhone: settings.recipientPhone || '',
    defaultDelayMinutes: settings.defaultDelayMinutes || 15,
    defaultPriority: settings.defaultPriority || 'high',
    theme: settings.theme || 'dark',
    isDirectConnected: isWAConnected,
    senderPhone: loggedInUser || ''
  });
});

app.post('/api/settings', async (req, res) => {
  try {
    const { recipientPhone, defaultDelayMinutes, defaultPriority, theme, testNow } = req.body;
    const current = readJSON(SETTINGS_FILE, {});

    const newSettings = {
      recipientPhone: recipientPhone !== undefined ? recipientPhone.trim() : (current.recipientPhone || ''),
      defaultDelayMinutes: defaultDelayMinutes !== undefined ? parseInt(defaultDelayMinutes, 10) : (current.defaultDelayMinutes || 15),
      defaultPriority: defaultPriority || current.defaultPriority || 'high',
      theme: theme || current.theme || 'dark'
    };

    writeJSON(SETTINGS_FILE, newSettings);

    if (testNow) {
      const target = newSettings.recipientPhone || loggedInUser;
      if (!target && !isWAConnected) {
        return res.status(400).json({ error: 'Pehle WhatsApp QR code scan karke connect karein!' });
      }

      const isSameNumber = target && loggedInUser && sanitizePhone(target) === sanitizePhone(loggedInUser);
      let notifNote = '';
      if (isSameNumber) {
        notifNote = `\n\n⚠️ *Note:* Ye message aapke khud ke number (+${loggedInUser}) se aaya hai. Phone me sound/ring bajane ke liye, Settings me jakar kisi dusre number se QR scan karein aur apna main number recipient me dalein.`;
      } else {
        notifNote = `\n\n🎉 *Phone me sound & notification check karein!* Ye message dusre number (+${loggedInUser}) se bheja gaya hai.`;
      }

      const testMsg = `🔔 *WhatsApp Reminder Test!* 🔔\n\n✅ *Aapka Reminder system successfully ready hai!*${notifNote}\n\nAb aap koi bhi message save karenge to sahi time par reminder aayega!`;
      await sendAnyWhatsAppMessage(target, testMsg);
      return res.json({ success: true, message: 'WhatsApp Test message bhej diya gaya!' });
    }

    res.json({ success: true, message: 'Settings save ho gayi!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Reminders Endpoints
app.get('/api/reminders', (req, res) => {
  const reminders = readJSON(REMINDERS_FILE, []);
  reminders.sort((a, b) => new Date(a.reminderTime) - new Date(b.reminderTime));
  res.json(reminders);
});

// Quick 1-Click Reminder (Expanded Time Support)
app.post('/api/reminders/quick', (req, res) => {
  try {
    const { message, minutes, preset } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message likhna zaroori hai.' });
    }

    const settings = readJSON(SETTINGS_FILE, {});
    let targetDate = new Date();

    if (typeof minutes === 'number') {
      targetDate = new Date(Date.now() + minutes * 60000);
    } else if (preset) {
      if (preset === 'tonight-9pm') {
        if (targetDate.getHours() >= 21) {
          targetDate.setDate(targetDate.getDate() + 1);
        }
        targetDate.setHours(21, 0, 0, 0);
      } else if (preset === 'tomorrow-8am') {
        targetDate.setDate(targetDate.getDate() + 1);
        targetDate.setHours(8, 0, 0, 0);
      } else if (preset === 'tomorrow-10am') {
        targetDate.setDate(targetDate.getDate() + 1);
        targetDate.setHours(10, 0, 0, 0);
      } else if (preset === 'tomorrow-6pm') {
        targetDate.setDate(targetDate.getDate() + 1);
        targetDate.setHours(18, 0, 0, 0);
      } else if (preset === 'in-2-days') {
        targetDate.setDate(targetDate.getDate() + 2);
        targetDate.setHours(9, 0, 0, 0);
      } else if (preset === 'next-monday') {
        const day = targetDate.getDay();
        const diff = (day === 0 ? 1 : 8 - day);
        targetDate.setDate(targetDate.getDate() + diff);
        targetDate.setHours(9, 0, 0, 0);
      }
    } else {
      const delay = settings.defaultDelayMinutes || 15;
      targetDate = new Date(Date.now() + delay * 60000);
    }

    const reminders = readJSON(REMINDERS_FILE, []);
    const newReminder = {
      id: 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: message.trim(),
      message: message.trim(),
      recipient: settings.recipientPhone || '',
      reminderTime: targetDate.toISOString(),
      repeat: 'none',
      repeatTime: null,
      endDate: null,
      priority: settings.defaultPriority || 'high',
      category: 'personal',
      status: 'pending',
      sentCount: 0,
      createdAt: new Date().toISOString(),
      sentAt: null,
      error: null
    };

    reminders.push(newReminder);
    writeJSON(REMINDERS_FILE, reminders);

    res.status(201).json({
      success: true,
      reminder: newReminder,
      scheduledTime: targetDate.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Daily Fix Time Recurring Reminder
app.post('/api/reminders/daily', (req, res) => {
  try {
    const { message, time, endDate, priority, category } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message likhna zaroori hai.' });
    }
    if (!time) {
      return res.status(400).json({ error: 'Rozana aane ka fix time select karein.' });
    }

    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    let scheduledDate = new Date();
    scheduledDate.setHours(hours, minutes, 0, 0);

    // If time for today already passed, schedule for tomorrow
    if (scheduledDate <= now) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    const settings = readJSON(SETTINGS_FILE, {});
    const reminders = readJSON(REMINDERS_FILE, []);

    let parsedEndDate = null;
    if (endDate && endDate.trim()) {
      const endD = new Date(endDate);
      endD.setHours(23, 59, 59, 999);
      parsedEndDate = endD.toISOString();
    }

    const newReminder = {
      id: 'rem_daily_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: message.trim(),
      message: message.trim(),
      recipient: settings.recipientPhone || '',
      reminderTime: scheduledDate.toISOString(),
      repeat: 'daily',
      repeatTime: time,
      endDate: parsedEndDate,
      priority: priority || settings.defaultPriority || 'high',
      category: category || 'personal',
      status: 'pending',
      sentCount: 0,
      createdAt: new Date().toISOString(),
      sentAt: null,
      error: null
    };

    reminders.push(newReminder);
    writeJSON(REMINDERS_FILE, reminders);

    const formattedNext = scheduledDate.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
    const untilNote = parsedEndDate ? ` (${new Date(parsedEndDate).toLocaleDateString('en-IN')} tak)` : ' (Hamesha)';

    res.status(201).json({
      success: true,
      reminder: newReminder,
      message: `Rozana ${time} baje reminder set ho gaya! Agla reminder: ${formattedNext}${untilNote}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Standard Custom Reminder
app.post('/api/reminders', (req, res) => {
  try {
    const { title, message, reminderTime, repeat, repeatTime, endDate, priority, category } = req.body;

    if (!title && !message) {
      return res.status(400).json({ error: 'Message ya title bharna zaroori hai.' });
    }
    if (!reminderTime) {
      return res.status(400).json({ error: 'Reminder time zaroori hai.' });
    }

    const settings = readJSON(SETTINGS_FILE, {});
    const reminders = readJSON(REMINDERS_FILE, []);

    let parsedEndDate = null;
    if (endDate && endDate.trim()) {
      const endD = new Date(endDate);
      endD.setHours(23, 59, 59, 999);
      parsedEndDate = endD.toISOString();
    }

    const newReminder = {
      id: 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: (title || message || '').trim(),
      message: (message || title || '').trim(),
      recipient: settings.recipientPhone || '',
      reminderTime: new Date(reminderTime).toISOString(),
      repeat: repeat || 'none',
      repeatTime: repeatTime || null,
      endDate: parsedEndDate,
      priority: priority || settings.defaultPriority || 'high',
      category: category || 'personal',
      status: 'pending',
      sentCount: 0,
      createdAt: new Date().toISOString(),
      sentAt: null,
      error: null
    };

    reminders.push(newReminder);
    writeJSON(REMINDERS_FILE, reminders);

    res.status(201).json({ success: true, reminder: newReminder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/reminders/:id', (req, res) => {
  const { id } = req.params;
  let reminders = readJSON(REMINDERS_FILE, []);
  const initialLength = reminders.length;
  reminders = reminders.filter(r => r.id !== id);

  if (reminders.length === initialLength) {
    return res.status(404).json({ error: 'Reminder not found.' });
  }

  writeJSON(REMINDERS_FILE, reminders);
  res.json({ success: true, message: 'Reminder deleted.' });
});

// Trigger specific reminder immediately
app.post('/api/reminders/:id/trigger', async (req, res) => {
  try {
    const { id } = req.params;
    const reminders = readJSON(REMINDERS_FILE, []);
    const reminder = reminders.find(r => r.id === id);

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found.' });
    }

    const settings = readJSON(SETTINGS_FILE, {});
    const target = reminder.recipient || settings.recipientPhone || loggedInUser;

    const formattedTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const priorityIcon = reminder.priority === 'urgent' ? '🚨 URGENT' : (reminder.priority === 'high' ? '⭐ High' : '📌 Normal');
    const repeatTag = reminder.repeat === 'daily' ? '🔁 *ROZANA (DAILY)*\n' : '';

    const msg = `🔔 *REMINDER ALERT* 🔔\n\n${repeatTag}📌 *Task:* ${reminder.title}\n💬 *Details:* ${reminder.message}\n⏰ *Time:* ${formattedTime}\n⚡ *Priority:* ${priorityIcon}`;

    await sendAnyWhatsAppMessage(target, msg);

    if (reminder.repeat === 'daily') {
      reminder.lastSentAt = new Date().toISOString();
      reminder.sentCount = (reminder.sentCount || 0) + 1;
    } else {
      reminder.status = 'sent';
      reminder.sentAt = new Date().toISOString();
    }

    writeJSON(REMINDERS_FILE, reminders);
    res.json({ success: true, message: 'Reminder sent to WhatsApp!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Background Scheduler - handles one-time & daily/recurring reminders
setInterval(async () => {
  try {
    const reminders = readJSON(REMINDERS_FILE, []);
    const settings = readJSON(SETTINGS_FILE, {});
    const now = new Date();
    let updated = false;

    for (const reminder of reminders) {
      if (reminder.status === 'pending' && new Date(reminder.reminderTime) <= now) {
        
        // Check if endDate is passed
        if (reminder.endDate && new Date(reminder.endDate) < now) {
          console.log(`[Scheduler] Reminder ${reminder.id} passed end date. Marking completed.`);
          reminder.status = 'completed';
          updated = true;
          continue;
        }

        console.log(`[Scheduler] Due reminder found: "${reminder.title}" (Repeat: ${reminder.repeat || 'none'})`);
        try {
          const target = reminder.recipient || settings.recipientPhone || loggedInUser;
          const dueTime = new Date(reminder.reminderTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
          const priorityIcon = reminder.priority === 'urgent' ? '🚨 URGENT' : (reminder.priority === 'high' ? '⭐ High' : '📌 Normal');
          const repeatHeader = reminder.repeat === 'daily' ? '🔁 *ROZANA REMINDER (DAILY)* 🔁\n\n' : '⏰ *REMINDER NOTIFICATION* ⏰\n\n';

          const msg = `${repeatHeader}📌 *Task:* ${reminder.title}\n📝 *Note:* ${reminder.message}\n🕒 *Time:* ${dueTime}\n⚡ *Priority:* ${priorityIcon}\n\n_Sent by Mobile Reminder App_`;

          await sendAnyWhatsAppMessage(target, msg);
          reminder.lastSentAt = new Date().toISOString();
          reminder.sentCount = (reminder.sentCount || 0) + 1;
          reminder.error = null;

          // If recurring (daily)
          if (reminder.repeat === 'daily') {
            const nextOccurrence = new Date(reminder.reminderTime);
            nextOccurrence.setDate(nextOccurrence.getDate() + 1);

            // Check if next occurrence is beyond endDate
            if (reminder.endDate && nextOccurrence > new Date(reminder.endDate)) {
              reminder.status = 'completed';
              console.log(`[Scheduler] Daily reminder "${reminder.title}" completed its schedule.`);
            } else {
              reminder.reminderTime = nextOccurrence.toISOString();
              reminder.status = 'pending';
              console.log(`[Scheduler] Daily reminder "${reminder.title}" rescheduled for tomorrow: ${nextOccurrence.toLocaleTimeString()}`);
            }
          } else {
            // One-time reminder
            reminder.status = 'sent';
            reminder.sentAt = new Date().toISOString();
          }

          updated = true;
          console.log(`[Scheduler] Reminder "${reminder.title}" successfully delivered!`);
        } catch (sendErr) {
          console.error(`[Scheduler] Failed to dispatch reminder ${reminder.id}:`, sendErr.message);
          reminder.status = 'failed';
          reminder.error = sendErr.message;
          updated = true;
        }
      }
    }

    if (updated) {
      writeJSON(REMINDERS_FILE, reminders);
    }
  } catch (err) {
    console.error('[Scheduler] Error in check loop:', err);
  }
}, 10000);

app.listen(PORT, '0.0.0.0', () => {
  const interfaces = os.networkInterfaces();
  console.log(`====================================================`);
  console.log(`🚀 Mobile WhatsApp Reminder Server Started!`);
  console.log(`💻 Local PC URL:     http://localhost:${PORT}`);
  
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`📱 Mobile Phone URL: http://${net.address}:${PORT}`);
      }
    }
  }
  console.log(`====================================================`);
});
