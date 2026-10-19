// Reminder Me - Client Application Logic (Version 2.0)

// Localization Dictionaries (English Default & Hindi)
const i18n = {
  en: {
    appName: 'Reminder Me',
    trialText: '10-Day Free Trial',
    trialDaysLeft: '{days} Days Left',
    create: 'Create',
    reminders: 'Reminders',
    plans: 'Plans',
    settings: 'Settings',
    admin: 'Admin',
    quick: 'Quick Reminder',
    custom: 'Custom Reminder',
    daily: 'Daily Reminder',
    contact: 'Remind Someone',
    whatToRemember: 'What do you want to remember?',
    saveDefault: 'Save (15 Min Default)',
    saveCustom: 'Save Custom Reminder',
    saveDaily: 'Save Daily Reminder',
    saveContact: 'Save Contact Reminder',
    noReminders: 'No Reminders',
    noRemindersSub: 'Schedule your first reminder in seconds.',
    monthlyPlan: 'Monthly Autopay',
    yearlyPlan: 'Yearly Autopay',
    haveCoupon: 'Have a Coupon Code?',
    apply: 'Apply',
    lockScreenNotif: 'Lock-Screen Notifications',
    enablePush: '🔔 Enable Push Alerts',
    customerSupport: 'Customer Support',
    shareApp: '📲 Share Reminder Me App',
    logout: '🚪 Log Out',
    deleteAccount: '🗑️ Delete My Account & Data',
    switchLangBtn: 'हिन्दी'
  },
  hi: {
    appName: 'Reminder Me',
    trialText: '10 दिन का फ्री ट्रायल',
    trialDaysLeft: '{days} दिन बचे हैं',
    create: 'बनाएं (+)',
    reminders: 'रिमाइंडर',
    plans: 'प्लान्स',
    settings: 'सेटिंग्स',
    admin: 'एडमिन',
    quick: 'क्विक रिमाइंडर',
    custom: 'कस्टम रिमाइंडर',
    daily: 'रोजाना रिमाइंडर',
    contact: 'कांटेक्ट को याद दिलाएं',
    whatToRemember: 'आपको क्या याद रखना है?',
    saveDefault: 'सेव करें (15 मिनट)',
    saveCustom: 'कस्टम रिमाइंडर सेव करें',
    saveDaily: 'रोजाना रिमाइंडर सेव करें',
    saveContact: 'कांटेक्ट रिमाइंडर सेव करें',
    noReminders: 'कोई रिमाइंडर नहीं है',
    noRemindersSub: 'चंद सेकंड में अपना पहला रिमाइंडर सेट करें।',
    monthlyPlan: 'मंथली ऑटोपे',
    yearlyPlan: 'सालाना ऑटोपे',
    haveCoupon: 'कूपन कोड है?',
    apply: 'अप्लाई करें',
    lockScreenNotif: 'लॉक-स्क्रीन नोटिफिकेशन',
    enablePush: '🔔 पुश अलर्ट चालू करें',
    customerSupport: 'कस्टमर सपोर्ट',
    shareApp: '📲 रिमाइंडर मी ऐप शेयर करें',
    logout: '🚪 लॉग आउट',
    deleteAccount: '🗑️ मेरा अकाउंट और डेटा डिलीट करें',
    switchLangBtn: 'English'
  }
};

let currentLang = localStorage.getItem('reminder_me_lang') || 'en';
let authToken = localStorage.getItem('reminder_me_token') || null;
let currentUser = null;
let selectedPlan = 'monthly';
let currentReminders = [];
let activeAlarmReminder = null;
let alarmAudioInterval = null;

// DOM Elements
const views = {
  auth: document.getElementById('view-auth'),
  create: document.getElementById('view-create'),
  list: document.getElementById('view-list'),
  subscription: document.getElementById('view-subscription'),
  settings: document.getElementById('view-settings'),
  admin: document.getElementById('view-admin')
};

const toastEl = document.getElementById('toast');
const langToggleBtn = document.getElementById('lang-toggle-btn');
const langLabel = document.getElementById('lang-label');
const trialBadge = document.getElementById('trial-badge');
const trialText = document.getElementById('trial-text');
const navAdminBtn = document.getElementById('nav-btn-admin');
const navPlansBtn = document.getElementById('nav-btn-plans');
const alarmModal = document.getElementById('alarm-modal');

// -------------------------------------------------------------
// TOAST NOTIFICATIONS & AUDIO ALARM
// -------------------------------------------------------------
function showToast(msg, duration = 3000) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), duration);
}

// Built-in Web Audio Chime Alarm
function playAlarmChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    function playTone(freq, time, duration = 0.25) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + duration);
    }

    const t = ctx.currentTime;
    playTone(587.33, t, 0.2);        // D5
    playTone(739.99, t + 0.15, 0.2); // F#5
    playTone(880.00, t + 0.3, 0.3);  // A5
    playTone(1174.66, t + 0.45, 0.5); // D6
  } catch (e) {
    console.log('Audio chime error:', e);
  }
}

function startContinuousAlarm() {
  stopContinuousAlarm();
  playAlarmChime();
  alarmAudioInterval = setInterval(playAlarmChime, 3000);
}

function stopContinuousAlarm() {
  if (alarmAudioInterval) {
    clearInterval(alarmAudioInterval);
    alarmAudioInterval = null;
  }
}

// -------------------------------------------------------------
// IN-APP NOTIFICATION ALARM POPUP
// -------------------------------------------------------------
function triggerAlarmModal(reminder) {
  activeAlarmReminder = reminder;
  const dueTime = new Date(reminder.reminderTime).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });

  document.getElementById('alarm-time-display').textContent = dueTime;
  document.getElementById('alarm-title-display').textContent = reminder.title || 'Reminder Alert';
  document.getElementById('alarm-message-display').textContent = reminder.message || reminder.title || '';
  
  alarmModal.classList.remove('hidden');
  startContinuousAlarm();

  // Try device vibration if available
  if ('vibrate' in navigator) {
    try { navigator.vibrate([400, 200, 400, 200, 600]); } catch (e) {}
  }
}

async function dismissCurrentAlarm() {
  stopContinuousAlarm();
  alarmModal.classList.add('hidden');
  if (!activeAlarmReminder) return;

  try {
    await fetch(`/api/reminders/${activeAlarmReminder.id}/dismiss`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    showToast('✓ Reminder marked complete');
    loadReminders();
  } catch (e) {
    console.error('Dismiss error:', e);
  }
  activeAlarmReminder = null;
}

async function snoozeCurrentAlarm(minutes = 5) {
  stopContinuousAlarm();
  alarmModal.classList.add('hidden');
  if (!activeAlarmReminder) return;

  try {
    const res = await fetch(`/api/reminders/${activeAlarmReminder.id}/snooze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ minutes })
    });
    const data = await res.json();
    showToast(`💤 Snoozed for ${minutes} minutes`);
    loadReminders();
  } catch (e) {
    console.error('Snooze error:', e);
  }
  activeAlarmReminder = null;
}

// Background poller for due in-app reminders
const notifiedIds = new Set();
async function pollDueReminders() {
  if (!authToken || !currentUser) return;
  try {
    const res = await fetch('/api/reminders/due-notifications', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.due && data.due.length > 0) {
      for (const rem of data.due) {
        if (!notifiedIds.has(rem.id)) {
          notifiedIds.add(rem.id);
          triggerAlarmModal(rem);
          break; // Show one modal at a time
        }
      }
    }
  } catch (e) {}
}
setInterval(pollDueReminders, 6000);

// -------------------------------------------------------------
// LANGUAGE LOCALIZATION SYSTEM
// -------------------------------------------------------------
function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('reminder_me_lang', lang);
  const t = i18n[lang];

  langLabel.textContent = t.switchLangBtn;

  // Nav labels
  document.getElementById('nav-lbl-create').textContent = t.create;
  document.getElementById('nav-lbl-list').textContent = t.reminders;
  document.getElementById('nav-lbl-plans').textContent = t.plans;
  document.getElementById('nav-lbl-settings').textContent = t.settings;
  const adminLbl = document.getElementById('nav-lbl-admin');
  if (adminLbl) adminLbl.textContent = t.admin;

  // Create headings & buttons
  document.getElementById('lbl-quick-heading').textContent = t.quick;
  document.getElementById('lbl-custom-heading').textContent = t.custom;
  document.getElementById('lbl-daily-heading').textContent = t.daily;
  document.getElementById('lbl-contact-heading').textContent = t.contact;
  document.getElementById('quick-input').placeholder = t.whatToRemember;
  document.getElementById('btn-quick-save-default').textContent = t.saveDefault;
  document.getElementById('btn-custom-save').textContent = t.saveCustom;
  document.getElementById('btn-daily-save').textContent = t.saveDaily;
  document.getElementById('btn-contact-save').textContent = t.saveContact;

  // List empty state
  document.getElementById('lbl-list-title').textContent = t.reminders;
  document.getElementById('lbl-empty-title').textContent = t.noReminders;
  document.getElementById('lbl-empty-sub').textContent = t.noRemindersSub;

  // Plans
  document.getElementById('lbl-sub-title').textContent = t.plans;
  document.getElementById('lbl-plan-monthly').textContent = t.monthlyPlan;
  document.getElementById('lbl-plan-yearly').textContent = t.yearlyPlan;

  // Settings
  document.getElementById('lbl-settings-title').textContent = t.settings;
  document.getElementById('lbl-notif-perm').textContent = t.lockScreenNotif;
  document.getElementById('btn-enable-push').textContent = t.enablePush;
  document.getElementById('lbl-support-heading').textContent = t.customerSupport;

  updateUserBadge();
}

langToggleBtn.addEventListener('click', () => {
  const nextLang = currentLang === 'en' ? 'hi' : 'en';
  applyLanguage(nextLang);
  showToast(nextLang === 'hi' ? 'भाषा: हिन्दी' : 'Language: English');
});

// -------------------------------------------------------------
// NAVIGATION SYSTEM (Customized for Owner vs Normal User)
// -------------------------------------------------------------
function switchNav(targetView) {
  // If user is Owner and clicks on 'subscription' view, redirect to create or admin
  if (currentUser && currentUser.isOwner && targetView === 'subscription') {
    targetView = 'admin';
  }

  // Update view visibility
  Object.keys(views).forEach(v => {
    if (views[v]) {
      views[v].classList.toggle('active', v === targetView);
    }
  });

  // Update bottom nav icons
  document.querySelectorAll('.bottom-nav .nav-pill-btn').forEach(btn => {
    const nav = btn.getAttribute('data-nav');
    btn.classList.toggle('active', nav === targetView);
  });

  if (targetView === 'list') {
    loadReminders();
  } else if (targetView === 'admin') {
    loadAdminDashboard();
  }
}

// -------------------------------------------------------------
// CREATE REMINDER MODES
// -------------------------------------------------------------
function switchCreateMode(mode) {
  const modes = ['quick', 'custom', 'daily', 'contact'];
  modes.forEach(m => {
    const tab = document.getElementById(`tab-${m}`);
    const box = document.getElementById(`box-mode-${m}`);
    if (tab) tab.classList.toggle('active', m === mode);
    if (box) box.classList.toggle('hidden', m !== mode);
  });
}

// Mode 1: Quick Tap Save
async function quickSave(minutes, preset) {
  const inputEl = document.getElementById('quick-input');
  const message = inputEl.value.trim() || 'Quick Task';

  try {
    const res = await fetch('/api/reminders/quick', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ message, minutes, preset })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('❌ ' + (data.error || 'Failed to save reminder'));
      return;
    }

    playAlarmChime();
    showToast(`✓ Scheduled for ${data.scheduledTime}!`);
    inputEl.value = '';
    loadReminders();
    switchNav('list');
  } catch (err) {
    showToast('❌ Error: ' + err.message);
  }
}

// Mode 2: Custom Date & Time Form
document.getElementById('form-custom').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('custom-title').value.trim();
  const note = document.getElementById('custom-note').value.trim();
  const datetimeVal = document.getElementById('custom-datetime').value;
  const priority = document.getElementById('custom-priority').value;

  if (!datetimeVal) {
    showToast('Please select Date & Time');
    return;
  }
  const [date, time] = datetimeVal.split('T');

  try {
    const res = await fetch('/api/reminders/custom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ title, note, date, time, priority })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('❌ ' + (data.error || 'Failed to save'));
      return;
    }

    playAlarmChime();
    showToast('✓ Custom reminder saved!');
    document.getElementById('form-custom').reset();
    loadReminders();
    switchNav('list');
  } catch (err) {
    showToast('❌ ' + err.message);
  }
});

// Mode 3: Rozana (Daily Recurring) Form
document.getElementById('form-daily').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('daily-msg').value.trim();
  const time = document.getElementById('daily-time').value;
  const kisDateTak = document.getElementById('daily-enddate').value;

  try {
    const res = await fetch('/api/reminders/daily', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ title, time, kisDateTak })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('❌ ' + (data.error || 'Failed to save'));
      return;
    }

    playAlarmChime();
    showToast('✓ Daily recurring reminder scheduled!');
    document.getElementById('form-daily').reset();
    loadReminders();
    switchNav('list');
  } catch (err) {
    showToast('❌ ' + err.message);
  }
});

// Mode 4: Remind Someone Form
document.getElementById('form-contact').addEventListener('submit', async (e) => {
  e.preventDefault();
  const contactName = document.getElementById('contact-name').value.trim();
  const phone = document.getElementById('contact-phone').value.trim();
  const title = document.getElementById('contact-title').value.trim();
  const datetimeVal = document.getElementById('contact-datetime').value;

  let date = null;
  let time = null;
  if (datetimeVal) {
    [date, time] = datetimeVal.split('T');
  }

  try {
    const res = await fetch('/api/reminders/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ contactName, phone, title, date, time })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('❌ ' + (data.error || 'Failed to save'));
      return;
    }

    playAlarmChime();
    showToast(`✓ Reminder scheduled for ${contactName}!`);
    document.getElementById('form-contact').reset();
    loadReminders();
    switchNav('list');
  } catch (err) {
    showToast('❌ ' + err.message);
  }
});

// -------------------------------------------------------------
// REMINDERS LIST
// -------------------------------------------------------------
async function loadReminders() {
  if (!authToken) return;
  try {
    const res = await fetch('/api/reminders', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    currentReminders = await res.json();
    renderReminders();
  } catch (err) {
    console.error('Error fetching reminders:', err);
  }
}

function renderReminders() {
  const container = document.getElementById('reminders-container');
  const emptyState = document.getElementById('list-empty-state');
  const countBadge = document.getElementById('reminders-count');

  countBadge.textContent = `${currentReminders.length} Active`;

  if (currentReminders.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = currentReminders.map(r => {
    const d = new Date(r.reminderTime);
    const timeFormatted = d.toLocaleString(currentLang === 'hi' ? 'hi-IN' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const isDaily = r.repeat === 'daily';
    const contactBadge = r.targetContactName ? `<span class="pill-tag" style="background:rgba(249,115,22,0.12); color:#F97316;">For: ${escapeHtml(r.targetContactName)}</span>` : '';
    const dailyBadge = isDaily ? `<span class="pill-tag" style="background:rgba(139,92,246,0.12); color:#7C3AED;">🔁 Daily (${r.repeatTime})</span>` : '';

    return `
      <div class="reminder-item">
        <div class="reminder-header-row">
          <div>
            <div class="reminder-text">${escapeHtml(r.title)}</div>
            ${r.message && r.message !== r.title ? `<p style="font-size:12px; color:var(--text-muted); margin-top:2px;">${escapeHtml(r.message)}</p>` : ''}
          </div>
          <div style="display:flex; gap:4px;">
            ${dailyBadge}
            ${contactBadge}
          </div>
        </div>

        <div class="reminder-meta-row">
          <div class="reminder-time-chip">⏰ ${timeFormatted}</div>
          <div class="reminder-actions-btns">
            <button class="mini-btn mini-send" onclick="testPlayReminder('${r.id}')" title="Test Alarm">🔔 Ring</button>
            <button class="mini-btn mini-delete" onclick="deleteReminder('${r.id}')" title="Delete">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function testPlayReminder(id) {
  const rem = currentReminders.find(r => r.id === id);
  if (rem) {
    triggerAlarmModal(rem);
  } else {
    playAlarmChime();
    showToast('🔔 Alarm tested!');
  }
}

async function deleteReminder(id) {
  if (!confirm('Delete this reminder?')) return;
  try {
    const res = await fetch(`/api/reminders/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.ok) {
      showToast('✓ Reminder deleted');
      loadReminders();
    }
  } catch (e) {
    showToast('Error deleting reminder');
  }
}

// -------------------------------------------------------------
// AUTHENTICATION & SESSION ("NEVER LOGOUT")
// -------------------------------------------------------------
let authMode = 'signup';
function switchAuthMode(mode) {
  authMode = mode;
  document.getElementById('btn-auth-signup').classList.toggle('active', mode === 'signup');
  document.getElementById('btn-auth-login').classList.toggle('active', mode === 'login');
  document.getElementById('group-fullname').style.display = mode === 'signup' ? 'block' : 'none';
  document.getElementById('group-phone').style.display = mode === 'signup' ? 'block' : 'none';
  document.getElementById('group-terms').style.display = mode === 'signup' ? 'block' : 'none';

  document.getElementById('auth-title').textContent = mode === 'signup' ? 'Create Account' : 'Welcome Back';
  document.getElementById('auth-submit-btn').textContent = mode === 'signup' ? 'Start 10-Day Free Trial' : 'Log In';
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value.trim();

  const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
  const body = { email, password };

  if (authMode === 'signup') {
    body.fullName = document.getElementById('auth-fullname').value.trim();
    body.phone = document.getElementById('auth-phone').value.trim();
    body.agreedTerms = document.getElementById('auth-terms').checked;
  }

  const submitBtn = document.getElementById('auth-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Please wait...';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok) {
      showToast('❌ ' + (data.error || 'Authentication failed'));
      return;
    }

    // Never Logout: 365-day persistent token in localStorage
    authToken = data.token;
    localStorage.setItem('reminder_me_token', authToken);
    currentUser = data.user;

    showToast('🎉 Welcome to Reminder Me!');
    initAppSession();
    switchNav('create');
  } catch (err) {
    showToast('❌ Network error: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = authMode === 'signup' ? 'Start 10-Day Free Trial' : 'Log In';
  }
});

async function checkSession() {
  if (!authToken) {
    switchNav('auth');
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!res.ok) {
      localStorage.removeItem('reminder_me_token');
      authToken = null;
      switchNav('auth');
      return;
    }
    const data = await res.json();
    currentUser = data.user;
    initAppSession();
  } catch (err) {
    console.error('Session check error:', err);
  }
}

function initAppSession() {
  updateUserBadge();

  const isOwner = currentUser && currentUser.isOwner;

  // 1. Owner Navigation Control: Hide Plans tab completely for Owner
  if (isOwner) {
    if (navPlansBtn) navPlansBtn.classList.add('hidden');
    if (navAdminBtn) navAdminBtn.classList.remove('hidden');
    document.getElementById('settings-owner-card').classList.remove('hidden');
    document.getElementById('box-owner-plan-vip').classList.remove('hidden');
    document.getElementById('box-regular-plans').classList.add('hidden');
  } else {
    if (navPlansBtn) navPlansBtn.classList.remove('hidden');
    if (navAdminBtn) navAdminBtn.classList.add('hidden');
    document.getElementById('settings-owner-card').classList.add('hidden');
    document.getElementById('box-owner-plan-vip').classList.add('hidden');
    document.getElementById('box-regular-plans').classList.remove('hidden');

    // If user has applied lifetime/active coupon, don't show annoying payment cards
    const isSubscribed = currentUser && (currentUser.planStatus === 'coupon_lifetime' || currentUser.planStatus === 'monthly' || currentUser.planStatus === 'yearly');
    const userActiveBox = document.getElementById('box-user-active-vip');
    if (isSubscribed) {
      userActiveBox.classList.remove('hidden');
      document.getElementById('user-active-plan-title').textContent =
        currentUser.planStatus === 'coupon_lifetime' ? 'Lifetime VIP Access Active' : 'Subscription Active';
      document.getElementById('btn-start-autopay').style.display = 'none';
    } else {
      userActiveBox.classList.add('hidden');
      document.getElementById('btn-start-autopay').style.display = 'block';
    }
  }

  document.getElementById('user-email-chip').textContent = currentUser.email;
  loadReminders();
}

function updateUserBadge() {
  if (!currentUser) return;
  const t = i18n[currentLang];

  if (currentUser.isOwner) {
    trialText.textContent = '👑 Owner VIP';
    trialBadge.style.background = 'rgba(15, 81, 50, 0.15)';
    trialBadge.style.color = '#0F5132';
  } else if (currentUser.planStatus === 'coupon_lifetime') {
    trialText.textContent = '✨ Lifetime VIP';
    trialBadge.style.background = 'rgba(15, 81, 50, 0.15)';
    trialBadge.style.color = '#0F5132';
  } else if (currentUser.planStatus === 'trial') {
    const days = currentUser.trialDaysRemaining || 10;
    trialText.textContent = t.trialDaysLeft.replace('{days}', days);
    trialBadge.style.background = 'rgba(234, 88, 12, 0.12)';
    trialBadge.style.color = '#C2410C';
  } else {
    trialText.textContent = '✓ Pro Member';
    trialBadge.style.background = 'rgba(15, 81, 50, 0.15)';
    trialBadge.style.color = '#0F5132';
  }
}

function logoutUser() {
  if (!confirm('Log out from Reminder Me?')) return;
  localStorage.removeItem('reminder_me_token');
  authToken = null;
  currentUser = null;
  showToast('Logged out');
  switchNav('auth');
}

async function deleteUserAccount() {
  if (!confirm('⚠️ Permanently delete your account and all reminders? This cannot be undone.')) return;
  try {
    const res = await fetch('/api/auth/delete-account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.ok) {
      localStorage.removeItem('reminder_me_token');
      authToken = null;
      currentUser = null;
      alert('Your account has been deleted.');
      location.reload();
    }
  } catch (e) {
    showToast('Error deleting account');
  }
}

// -------------------------------------------------------------
// SUBSCRIPTIONS & COUPONS (For Normal Users)
// -------------------------------------------------------------
function selectPlan(plan) {
  selectedPlan = plan;
  document.getElementById('card-plan-monthly').classList.toggle('selected', plan === 'monthly');
  document.getElementById('card-plan-yearly').classList.toggle('selected', plan === 'yearly');
}

async function startRazorpayAutopay() {
  try {
    showToast('Opening payment gateway...');
    const res = await fetch('/api/subscription/create-autopay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ planType: selectedPlan })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast('❌ ' + (data.error || 'Failed to start payment'));
      return;
    }

    const options = {
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: 'Reminder Me',
      description: `Autopay (${selectedPlan.toUpperCase()})`,
      image: '/icons/icon.svg',
      handler: async function (response) {
        showToast('Verifying payment...');
        const verifyRes = await fetch('/api/subscription/verify-autopay', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            planType: selectedPlan,
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id
          })
        });
        const verifyData = await verifyRes.json();
        if (verifyRes.ok) {
          playAlarmChime();
          showToast('🎉 ' + verifyData.message);
          checkSession();
        }
      },
      prefill: {
        name: currentUser.fullName,
        email: currentUser.email,
        contact: currentUser.phone
      },
      theme: { color: '#0F5132' }
    };

    if (typeof Razorpay !== 'undefined') {
      const rzp = new Razorpay(options);
      rzp.open();
    } else {
      // Simulation fallback for sandbox
      const mockPayId = 'pay_' + Date.now();
      await fetch('/api/subscription/verify-autopay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ planType: selectedPlan, paymentId: mockPayId })
      });
      showToast('✓ Autopay subscription activated (Test Mode)');
      checkSession();
    }
  } catch (err) {
    showToast('❌ ' + err.message);
  }
}

async function applyCouponCode() {
  const code = document.getElementById('coupon-input').value.trim();
  if (!code) {
    showToast('Please enter a coupon code');
    return;
  }

  try {
    const res = await fetch('/api/subscription/apply-coupon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (res.ok) {
      playAlarmChime();
      showToast('🎉 ' + data.message);
      document.getElementById('coupon-input').value = '';
      checkSession();
    } else {
      showToast('❌ ' + (data.error || 'Invalid coupon'));
    }
  } catch (e) {
    showToast('Coupon application error');
  }
}

// -------------------------------------------------------------
// WEB PUSH NOTIFICATIONS
// -------------------------------------------------------------
async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast('Push notifications not supported on this device');
    return;
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      showToast('Notification permission denied');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const vapidRes = await fetch('/api/push/public-key');
    const { publicKey } = await vapidRes.json();

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(publicKey)
    });

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ subscription: sub })
    });

    playAlarmChime();
    showToast('🔔 Lock-screen notifications enabled!');
  } catch (err) {
    showToast('Push setup error: ' + err.message);
  }
}

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// -------------------------------------------------------------
// EXCLUSIVE OWNER ADMIN PANEL
// -------------------------------------------------------------
async function loadAdminDashboard() {
  if (!authToken || !currentUser || !currentUser.isOwner) return;
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('stat-total-users').textContent = data.stats.totalUsers;
    document.getElementById('stat-active-trials').textContent = data.stats.activeTrials;
    document.getElementById('stat-autopay-users').textContent = data.stats.activeAutopay;
    document.getElementById('stat-revenue').textContent = '₹' + data.stats.totalRevenue;

    const tbody = document.getElementById('admin-users-tbody');
    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td><strong>${escapeHtml(u.fullName)}</strong>${u.isOwner ? ' 👑' : ''}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.phone)}</td>
        <td><span class="pill-tag" style="font-size:10px;">${u.planStatus}</span></td>
        <td>${u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).toLocaleDateString() : 'Trial'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Admin dashboard error:', err);
  }
}

async function generateAdminCoupons() {
  const planType = document.getElementById('admin-coupon-type').value;
  try {
    const res = await fetch('/api/admin/coupons/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ planType, count: 3 })
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('admin-generated-codes').innerHTML =
        '<strong>New Codes:</strong><br>' + data.codes.join('<br>');
      showToast('✓ Generated 3 single-use coupons');
    }
  } catch (e) {
    showToast('Error generating coupons');
  }
}

function exportAdminDataCSV() {
  fetch('/api/admin/stats', {
    headers: { Authorization: `Bearer ${authToken}` }
  })
  .then(res => res.json())
  .then(data => {
    let csv = 'ID,Full Name,Email,Phone,Plan Status,Trial Ends,Subscription Expires,Created At\n';
    data.users.forEach(u => {
      csv += `"${u.id}","${u.fullName}","${u.email}","${u.phone}","${u.planStatus}","${u.trialEndsAt}","${u.subscriptionExpiresAt || ''}","${u.createdAt}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reminder_me_users_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast('✓ CSV exported successfully!');
  });
}

// -------------------------------------------------------------
// SHARE APP & VOICE MIC HELPER
// -------------------------------------------------------------
function shareReminderMeApp() {
  const shareData = {
    title: 'Reminder Me',
    text: 'Try Reminder Me - Smart task, medicine & daily reminders with loud in-app alarms and push alerts!',
    url: window.location.origin
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    navigator.clipboard.writeText(window.location.origin).then(() => {
      showToast('📋 App link copied to clipboard!');
    });
  }
}

document.getElementById('share-app-btn').addEventListener('click', shareReminderMeApp);

// Voice Mic recognition setup
const quickMic = document.getElementById('quick-mic-btn');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition && quickMic) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';

  quickMic.addEventListener('click', () => {
    try {
      showToast('🎙️ Listening...');
      quickMic.textContent = '🔴';
      recognition.start();
    } catch (e) {
      recognition.stop();
    }
  });

  recognition.onresult = (e) => {
    document.getElementById('quick-input').value = e.results[0][0].transcript;
    quickMic.textContent = '🎙️';
  };
  recognition.onend = () => { quickMic.textContent = '🎙️'; };
  recognition.onerror = () => { quickMic.textContent = '🎙️'; };
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration error:', err));
  });
}

// Default DateTime for custom inputs
const now = new Date();
now.setMinutes(now.getMinutes() + 30);
const pad = n => n < 10 ? '0' + n : n;
const defaultDT = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
const customDT = document.getElementById('custom-datetime');
if (customDT) customDT.value = defaultDT;
const contactDT = document.getElementById('contact-datetime');
if (contactDT) contactDT.value = defaultDT;

// Start session
applyLanguage(currentLang);
checkSession();
