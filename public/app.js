// Reminder Me - Luxury Edition (Version 3.0)

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
    whatToRemember: 'What would you like to remember?',
    saveDefault: 'Save Reminder',
    saveCustom: 'Save Custom Reminder',
    saveDaily: 'Save Daily Reminder',
    saveContact: 'Save Contact Reminder',
    noReminders: 'No Active Reminders',
    noRemindersSub: 'Schedule your first reminder in seconds.',
    tabActive: '⏰ Active',
    tabMsgBox: '📬 Message Box',
    msgBoxEmpty: 'Message Box is Empty',
    msgBoxEmptySub: 'All your created reminders will be preserved here with beautiful photos.',
    readMsg: 'Read 🌸',
    deliveredTag: 'Delivered ✓',
    scheduledTag: 'Scheduled',
    lockScreenTitle: 'Ring Reminders on Time',
    lockScreenSub: 'Allow notifications so reminders ring on your phone.',
    enableAlertsBtn: 'Allow 🔔',
    monthlyPlan: 'Monthly Autopay',
    yearlyPlan: 'Yearly Autopay',
    haveCoupon: 'HAVE A COUPON CODE?',
    apply: 'Apply',
    lockScreenNotif: 'Lock-Screen Notifications & Tone',
    enablePush: 'Enable Push Alerts',
    customerSupport: 'Customer Support',
    shareApp: 'Share Reminder Me App',
    logout: 'Log Out',
    deleteAccount: 'Delete My Account & Data',
    switchLangBtn: 'हिन्दी'
  },
  hi: {
    appName: 'Reminder Me',
    trialText: '10 दिन का फ्री ट्रायल',
    trialDaysLeft: '{days} दिन शेष',
    create: 'बनाएं',
    reminders: 'रिमाइंडर',
    plans: 'प्लान्स',
    settings: 'सेटिंग्स',
    admin: 'एडमिन',
    quick: 'क्विक रिमाइंडर',
    custom: 'कस्टम रिमाइंडर',
    daily: 'रोजाना रिमाइंडर',
    contact: 'कांटेक्ट रिमाइंडर',
    whatToRemember: 'आपको क्या याद रखना है?',
    saveDefault: 'रिमाइंडर सेव करें',
    saveCustom: 'कस्टम रिमाइंडर सेव करें',
    saveDaily: 'रोजाना रिमाइंडर सेव करें',
    saveContact: 'कांटेक्ट रिमाइंडर सेव करें',
    noReminders: 'कोई रिमाइंडर नहीं है',
    noRemindersSub: 'चंद सेकंड में अपना पहला रिमाइंडर सेट करें।',
    tabActive: '⏰ सक्रिय',
    tabMsgBox: '📬 संदेश बॉक्स',
    msgBoxEmpty: 'संदेश बॉक्स खाली है',
    msgBoxEmptySub: 'आपके द्वारा बनाए गए सभी रिमाइंडर यहाँ खूबसूरत फोटो के साथ सुरक्षित रहेंगे।',
    readMsg: 'पढ़ें 🌸',
    deliveredTag: 'पहुंचाया गया ✓',
    scheduledTag: 'शेड्यूल्ड',
    lockScreenTitle: 'समय पर रिमाइंडर पाएं',
    lockScreenSub: 'फोन पर समय पर रिमाइंडर की घंटी सुनने के लिए Allow करें।',
    enableAlertsBtn: 'Allow करें 🔔',
    monthlyPlan: 'मंथली ऑटोपे',
    yearlyPlan: 'सालाना ऑटोपे',
    haveCoupon: 'कूपन कोड है?',
    apply: 'अप्लाई करें',
    lockScreenNotif: 'लॉक-स्क्रीन नोटिफिकेशन और टोन',
    enablePush: 'पुश अलर्ट चालू करें',
    customerSupport: 'कस्टमर सपोर्ट',
    shareApp: 'रिमाइंडर मी ऐप शेयर करें',
    logout: 'लॉग आउट',
    deleteAccount: 'मेरा अकाउंट और डेटा डिलीट करें',
    switchLangBtn: 'English'
  }
};

let currentLang = localStorage.getItem('reminder_me_lang') || 'en';
let authToken = localStorage.getItem('reminder_me_token') || null;
let currentUser = null;
let selectedPlan = 'monthly';
let currentReminders = [];
let currentListSubtab = 'active'; // 'active' or 'msgbox'
let activeViewingReminder = null;
let iosBannerTimeout = null;

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

// iOS Banner & Aesthetic Modal Elements
const iosBanner = document.getElementById('ios-notification-banner');
const iosBannerTitle = document.getElementById('ios-banner-title');
const iosBannerMessage = document.getElementById('ios-banner-message');
const iosBannerTime = document.getElementById('ios-banner-time');

const aestheticModal = document.getElementById('aesthetic-card-modal');
const aestheticTitle = document.getElementById('aesthetic-task-title');
const aestheticQuote = document.getElementById('aesthetic-quote-display');
const aestheticTimeTag = document.getElementById('aesthetic-time-tag');

// Motivational Serene Quotes
const inspirationalQuotes = [
  'Every moment is a fresh beginning. Take a deep breath and accomplish your task.',
  'Aur yaqeenan aane wala waqt behtar hai guzre hue waqt se.',
  'Small daily disciplines lead to massive long-term success.',
  'Peace comes from within. Focus on what is in front of you right now.',
  'Consistency is what transforms average into excellence.'
];

function getRandomQuote() {
  return inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)];
}

// -------------------------------------------------------------
// TOAST NOTIFICATIONS & SWEET AUDIO CHIME
// -------------------------------------------------------------
function showToast(msg, duration = 3000) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), duration);
}

// Web app audio completely silenced - audio only comes from native device notifications
function playNotificationChime() {}
function playSynthChime() {}

// -------------------------------------------------------------
// 📱 iOS STYLE TOP NOTIFICATION SLIDE-DOWN BANNER (Image 2)
// -------------------------------------------------------------
function showIosNotificationBanner(reminder) {
  if (!reminder) return;
  activeViewingReminder = reminder;

  iosBannerTitle.textContent = reminder.title || 'Reminder Alert';
  iosBannerMessage.textContent = reminder.message || reminder.title || 'Scheduled task is due';
  iosBannerTime.textContent = 'Now';

  iosBanner.classList.remove('hidden');
  iosBanner.classList.remove('hiding');

  if ('vibrate' in navigator) {
    try { navigator.vibrate([250, 100, 250]); } catch (e) {}
  }

  // Acknowledge to server so popup won't repeat
  if (reminder.id && authToken) {
    fetch(`/api/reminders/${reminder.id}/ack-popup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    }).catch(() => {});
  }

  if (iosBannerTimeout) clearTimeout(iosBannerTimeout);
  iosBannerTimeout = setTimeout(() => {
    dismissIosBanner();
  }, 10000); // Stays visible for 10s or until tapped
}

function dismissIosBanner() {
  if (iosBanner.classList.contains('hidden')) return;
  iosBanner.classList.add('hiding');
  setTimeout(() => {
    iosBanner.classList.add('hidden');
    iosBanner.classList.remove('hiding');
  }, 300);
}

function openAestheticCardFromBanner() {
  if (iosBannerTimeout) clearTimeout(iosBannerTimeout);
  iosBanner.classList.add('hidden');
  if (activeViewingReminder) {
    openAestheticModal(activeViewingReminder);
  }
}

// -------------------------------------------------------------
// 🌸 AESTHETIC ENERGY READING CARD (Dynamic Aesthetic Art)
// -------------------------------------------------------------
const aestheticPhotoGallery = [
  '/images/art_morning_sun.jpg',
  '/images/art_mountain_sunrise.jpg',
  '/images/art_lotus_water.jpg',
  '/images/art_sakura_blossom.jpg',
  '/images/art_lavender_sunset.jpg',
  '/images/art_zen_water_stones.jpg'
];

function getReminderArtwork(reminder) {
  if (!reminder) return aestheticPhotoGallery[0];
  const str = (reminder.id || '') + (reminder.title || '') + (reminder.createdAt || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % aestheticPhotoGallery.length;
  return aestheticPhotoGallery[index];
}

function openAestheticModal(reminder) {
  activeViewingReminder = reminder;
  aestheticTitle.textContent = reminder.title || 'Task Reminder';
  
  if (reminder.message && reminder.message !== reminder.title) {
    aestheticQuote.textContent = `"${reminder.message}"`;
  } else {
    aestheticQuote.textContent = `"${getRandomQuote()}"`;
  }

  const d = new Date(reminder.reminderTimestamp || reminder.reminderTime);
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  aestheticTimeTag.textContent = `${dateStr} • ${timeStr}`;

  // Assign fresh, dynamic energetic photo for this specific reminder!
  const imgEl = document.getElementById('aesthetic-card-img');
  if (imgEl) {
    imgEl.src = getReminderArtwork(reminder);
  }

  const doneBtn = document.querySelector('.btn-aesthetic-done');
  if (doneBtn) {
    doneBtn.textContent = (reminder.status === 'completed' || reminder.status === 'sent') ? 'Close ✓' : 'Mark as Done ✓';
  }

  aestheticModal.classList.remove('hidden');
}

function closeAestheticModal() {
  aestheticModal.classList.add('hidden');
  activeViewingReminder = null;
}

async function markAestheticDone() {
  if (!activeViewingReminder) {
    closeAestheticModal();
    return;
  }
  const id = activeViewingReminder.id;
  const isAlreadyDone = activeViewingReminder.status === 'completed' || activeViewingReminder.status === 'sent';
  closeAestheticModal();

  if (isAlreadyDone) return;

  try {
    const res = await fetch(`/api/reminders/${id}/dismiss`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.ok) {
      showToast('✓ Marked as completed');
      loadReminders();
    }
  } catch (e) {
    console.error('Error marking done:', e);
  }
}

async function snoozeAestheticModal(minutes = 10) {
  if (!activeViewingReminder) {
    closeAestheticModal();
    return;
  }
  const id = activeViewingReminder.id;
  closeAestheticModal();
  await snoozeReminder(id, minutes);
}

// In-App Background Poller & Precision Timers for Due Reminders
const handledReminderIds = new Set();
const activeTimers = new Map();

function scheduleReminderTimers(reminders) {
  if (!Array.isArray(reminders)) return;
  const nowMs = Date.now();
  reminders.forEach(r => {
    if (r.status === 'completed' || r.clientPopped === 1 || handledReminderIds.has(r.id)) return;
    const dueMs = r.reminderTimestamp || new Date(r.reminderTime).getTime();
    const diff = dueMs - nowMs;
    if (diff <= 1000 && diff > -300000) {
      // Due right now or in last 5 minutes!
      handledReminderIds.add(r.id);
      showIosNotificationBanner(r);
    } else if (diff > 1000 && diff < 86400000) {
      // Set high-precision timer for this exact millisecond
      if (!activeTimers.has(r.id)) {
        const timer = setTimeout(() => {
          activeTimers.delete(r.id);
          if (!handledReminderIds.has(r.id)) {
            handledReminderIds.add(r.id);
            showIosNotificationBanner(r);
            loadReminders();
          }
        }, diff);
        activeTimers.set(r.id, timer);
      }
    }
  });
}

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
        if (!handledReminderIds.has(rem.id)) {
          handledReminderIds.add(rem.id);
          showIosNotificationBanner(rem);
          loadReminders();
          break;
        }
      }
    }
  } catch (e) {}
}
setInterval(pollDueReminders, 4000);

// -------------------------------------------------------------
// LANGUAGE LOCALIZATION SYSTEM
// -------------------------------------------------------------
function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('reminder_me_lang', lang);
  const t = i18n[lang];

  langLabel.textContent = t.switchLangBtn;

  document.getElementById('nav-lbl-create').textContent = t.create;
  document.getElementById('nav-lbl-list').textContent = t.reminders;
  document.getElementById('nav-lbl-plans').textContent = t.plans;
  document.getElementById('nav-lbl-settings').textContent = t.settings;
  const adminLbl = document.getElementById('nav-lbl-admin');
  if (adminLbl) adminLbl.textContent = t.admin;

  document.getElementById('lbl-quick-heading').textContent = t.quick;
  document.getElementById('lbl-custom-heading').textContent = t.custom;
  document.getElementById('lbl-daily-heading').textContent = t.daily;
  document.getElementById('lbl-contact-heading').textContent = t.contact;
  document.getElementById('quick-input').placeholder = t.whatToRemember;
  document.getElementById('btn-quick-save-default').textContent = t.saveDefault;
  document.getElementById('btn-custom-save').textContent = t.saveCustom;
  document.getElementById('btn-daily-save').textContent = t.saveDaily;
  document.getElementById('btn-contact-save').textContent = t.saveContact;

  const tabActiveEl = document.getElementById('lbl-tab-active');
  if (tabActiveEl) tabActiveEl.textContent = t.tabActive;
  const tabMsgBoxEl = document.getElementById('lbl-tab-msgbox');
  if (tabMsgBoxEl) tabMsgBoxEl.textContent = t.tabMsgBox;

  document.getElementById('lbl-list-title').textContent = currentListSubtab === 'active' ? t.reminders : t.tabMsgBox;
  document.getElementById('lbl-empty-title').textContent = t.noReminders;
  document.getElementById('lbl-empty-sub').textContent = t.noRemindersSub;

  const msgEmptyTitle = document.getElementById('lbl-msgbox-empty-title');
  if (msgEmptyTitle) msgEmptyTitle.textContent = t.msgBoxEmpty;
  const msgEmptySub = document.getElementById('lbl-msgbox-empty-sub');
  if (msgEmptySub) msgEmptySub.textContent = t.msgBoxEmptySub;

  const lockTitle = document.getElementById('lbl-lockscreen-title');
  if (lockTitle) lockTitle.textContent = t.lockScreenTitle;
  const lockSub = document.getElementById('lbl-lockscreen-sub');
  if (lockSub) lockSub.textContent = t.lockScreenSub;
  const btnBannerEnable = document.getElementById('btn-banner-enable');
  if (btnBannerEnable) btnBannerEnable.textContent = t.enableAlertsBtn;

  document.getElementById('lbl-sub-title').textContent = t.plans;
  document.getElementById('lbl-plan-monthly').textContent = t.monthlyPlan;
  document.getElementById('lbl-plan-yearly').textContent = t.yearlyPlan;

  document.getElementById('lbl-settings-title').textContent = t.settings;
  document.getElementById('lbl-notif-perm').textContent = t.lockScreenNotif;
  document.getElementById('btn-enable-push').textContent = t.enablePush;
  document.getElementById('lbl-support-heading').textContent = t.customerSupport;

  const lblBannerTitle = document.getElementById('lbl-lockscreen-title');
  if (lblBannerTitle) lblBannerTitle.textContent = t.lockScreenTitle;
  const lblBannerSub = document.getElementById('lbl-lockscreen-sub');
  if (lblBannerSub) lblBannerSub.textContent = t.lockScreenSub;

  updateUserBadge();
  renderReminders();
}

langToggleBtn.addEventListener('click', () => {
  const nextLang = currentLang === 'en' ? 'hi' : 'en';
  applyLanguage(nextLang);
  showToast(nextLang === 'hi' ? 'भाषा: हिन्दी' : 'Language: English');
});

// -------------------------------------------------------------
// NAVIGATION SYSTEM
// -------------------------------------------------------------
function switchNav(targetView) {
  if (currentUser && currentUser.isOwner && targetView === 'subscription') {
    targetView = 'admin';
  }

  Object.keys(views).forEach(v => {
    if (views[v]) {
      views[v].classList.toggle('active', v === targetView);
    }
  });

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
// CREATE REMINDER MODES (ACCURATE LOCAL TIME)
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
  const message = inputEl.value.trim() || 'Reminder Task';

  let targetDate = new Date();
  if (typeof minutes === 'number') {
    targetDate = new Date(Date.now() + minutes * 60000);
  } else if (preset === 'tonight-9pm') {
    if (targetDate.getHours() >= 21) targetDate.setDate(targetDate.getDate() + 1);
    targetDate.setHours(21, 0, 0, 0);
  } else if (preset === 'tomorrow-8am') {
    targetDate.setDate(targetDate.getDate() + 1);
    targetDate.setHours(8, 0, 0, 0);
  } else if (preset === 'tomorrow-6pm') {
    targetDate.setDate(targetDate.getDate() + 1);
    targetDate.setHours(18, 0, 0, 0);
  } else {
    targetDate = new Date(Date.now() + 15 * 60000);
  }

  const reminderTimestamp = targetDate.getTime();
  const reminderTime = targetDate.toISOString();

  try {
    const res = await fetch('/api/reminders/quick', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ message, reminderTimestamp, reminderTime })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to save');
      return;
    }

    const timeFormatted = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    showToast(`✓ Scheduled for ${timeFormatted}`);
    inputEl.value = '';
    if (data.reminder) {
      currentReminders = currentReminders.filter(r => r.id !== data.reminder.id);
      currentReminders.unshift(data.reminder);
      renderReminders();
    }
    await loadReminders();
    switchNav('list');
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => enablePushNotifications(), 400);
    }
  } catch (err) {
    showToast('Error: ' + err.message);
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

  // Parse in local browser timezone accurately!
  const targetDate = new Date(datetimeVal);
  const reminderTimestamp = targetDate.getTime();
  const reminderTime = targetDate.toISOString();

  try {
    const res = await fetch('/api/reminders/custom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ title, note, reminderTimestamp, reminderTime, priority })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to save');
      return;
    }

    const timeFormatted = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    showToast(`✓ Saved for ${timeFormatted}`);
    document.getElementById('form-custom').reset();
    if (data.reminder) {
      currentReminders = currentReminders.filter(r => r.id !== data.reminder.id);
      currentReminders.unshift(data.reminder);
      renderReminders();
    }
    await loadReminders();
    switchNav('list');
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => enablePushNotifications(), 400);
    }
  } catch (err) {
    showToast('Error: ' + err.message);
  }
});

// Mode 3: Rozana (Daily Recurring) Form
document.getElementById('form-daily').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('daily-msg').value.trim();
  const time = document.getElementById('daily-time').value;
  const kisDateTak = document.getElementById('daily-enddate').value;

  const [hours, minutes] = time.split(':');
  const targetDate = new Date();
  targetDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  if (targetDate < new Date()) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  const reminderTimestamp = targetDate.getTime();
  const reminderTime = targetDate.toISOString();

  try {
    const res = await fetch('/api/reminders/daily', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ title, time, kisDateTak, reminderTimestamp, reminderTime })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to save');
      return;
    }

    showToast(`✓ Daily reminder scheduled at ${time}`);
    document.getElementById('form-daily').reset();
    if (data.reminder) {
      currentReminders = currentReminders.filter(r => r.id !== data.reminder.id);
      currentReminders.unshift(data.reminder);
      renderReminders();
    }
    await loadReminders();
    switchNav('list');
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => enablePushNotifications(), 400);
    }
  } catch (err) {
    showToast('Error: ' + err.message);
  }
});

// Mode 4: Remind Someone Form
document.getElementById('form-contact').addEventListener('submit', async (e) => {
  e.preventDefault();
  const contactName = document.getElementById('contact-name').value.trim();
  const phone = document.getElementById('contact-phone').value.trim();
  const title = document.getElementById('contact-title').value.trim();
  const datetimeVal = document.getElementById('contact-datetime').value;

  let targetDate = datetimeVal ? new Date(datetimeVal) : new Date(Date.now() + 15 * 60000);
  const reminderTimestamp = targetDate.getTime();
  const reminderTime = targetDate.toISOString();

  try {
    const res = await fetch('/api/reminders/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ contactName, phone, title, reminderTimestamp, reminderTime })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to save');
      return;
    }

    if (data.targetUserNotified) {
      showToast(`✓ Delivered directly to ${contactName}'s app account!`, 3000);
    } else {
      showToast(`✓ Reminder scheduled for ${contactName}!`, 3000);
    }

    document.getElementById('form-contact').reset();
    if (data.reminder) {
      currentReminders = currentReminders.filter(r => r.id !== data.reminder.id);
      currentReminders.unshift(data.reminder);
      renderReminders();
    }
    await loadReminders();
    switchNav('list');
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => enablePushNotifications(), 400);
    }
  } catch (err) {
    showToast('Error: ' + err.message);
  }
});

function shareReminderDirectly(phone, text) {
  const cleanPhone = (phone || '').replace(/[^0-9+]/g, '');
  if (navigator.share) {
    navigator.share({
      title: 'Reminder Me Alert',
      text: text
    }).catch(() => {
      window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(text)}`;
    });
  } else {
    window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(text)}`;
  }
}

// -------------------------------------------------------------
// REMINDERS LIST & MESSAGE BOX (SAVED VAULT)
// -------------------------------------------------------------
function switchListSubtab(subtab) {
  currentListSubtab = subtab;
  const tabActiveBtn = document.getElementById('subtab-active');
  const tabMsgBoxBtn = document.getElementById('subtab-msgbox');
  if (tabActiveBtn) tabActiveBtn.classList.toggle('active', subtab === 'active');
  if (tabMsgBoxBtn) tabMsgBoxBtn.classList.toggle('active', subtab === 'msgbox');

  const t = i18n[currentLang];
  const listTitle = document.getElementById('lbl-list-title');
  if (listTitle) {
    listTitle.textContent = subtab === 'active' ? t.reminders : t.tabMsgBox;
  }

  renderReminders();
}

async function loadReminders() {
  if (!authToken) return;
  try {
    const res = await fetch('/api/reminders', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    currentReminders = await res.json();
    scheduleReminderTimers(currentReminders);
    renderReminders();
  } catch (err) {
    console.error('Error fetching reminders:', err);
  }
}

function renderReminders() {
  const t = i18n[currentLang];
  const activeContainer = document.getElementById('reminders-container');
  const msgboxContainer = document.getElementById('msgbox-container');
  const activeEmpty = document.getElementById('list-empty-state');
  const msgboxEmpty = document.getElementById('msgbox-empty-state');
  const countBadge = document.getElementById('reminders-count');

  if (currentListSubtab === 'active') {
    if (activeContainer) activeContainer.classList.remove('hidden');
    if (msgboxContainer) msgboxContainer.classList.add('hidden');
    if (msgboxEmpty) msgboxEmpty.classList.add('hidden');

    // Keep all non-completed reminders visible (upcoming pending + delivered)
    const activeList = currentReminders.filter(r => r.status !== 'completed');

    // Sort: Upcoming pending first (soonest first), followed by delivered items
    activeList.sort((a, b) => {
      const isPendA = a.status === 'pending';
      const isPendB = b.status === 'pending';
      if (isPendA && !isPendB) return -1;
      if (!isPendA && isPendB) return 1;
      const timeA = a.reminderTimestamp || new Date(a.reminderTime).getTime();
      const timeB = b.reminderTimestamp || new Date(b.reminderTime).getTime();
      return isPendA ? (timeA - timeB) : (timeB - timeA);
    });

    const pendingCount = activeList.filter(r => r.status === 'pending').length;
    const deliveredCount = activeList.filter(r => r.status === 'sent').length;

    if (countBadge) {
      if (pendingCount > 0 && deliveredCount > 0) {
        countBadge.textContent = `${pendingCount} Upcoming • ${deliveredCount} Delivered`;
      } else if (pendingCount > 0) {
        countBadge.textContent = `${pendingCount} Upcoming`;
      } else if (deliveredCount > 0) {
        countBadge.textContent = `${deliveredCount} Delivered`;
      } else {
        countBadge.textContent = `${activeList.length} Active`;
      }
    }

    if (activeList.length === 0) {
      if (activeContainer) activeContainer.innerHTML = '';
      if (activeEmpty) activeEmpty.classList.remove('hidden');
      return;
    }

    if (activeEmpty) activeEmpty.classList.add('hidden');
    if (activeContainer) {
      activeContainer.innerHTML = activeList.map(r => {
        const d = new Date(r.reminderTimestamp || r.reminderTime);
        const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        const dateFormatted = d.toLocaleDateString([], { month: 'short', day: 'numeric' });

        const isDaily = r.repeat === 'daily';
        const isDelivered = r.status === 'sent';
        const statusBadge = isDelivered
          ? `<span class="pill-tag" style="background:#ECFDF5; color:#059669; border:1px solid #A7F3D0; font-weight:600;">✓ Delivered</span>`
          : `<span class="pill-tag" style="background:var(--emerald-light); color:var(--emerald-primary); font-weight:600;">⏰ Upcoming</span>`;

        const contactBadge = r.targetContactName ? `<span class="pill-tag">For: ${escapeHtml(r.targetContactName)}</span>` : '';
        const dailyBadge = isDaily ? `<span class="pill-tag">Daily (${r.repeatTime})</span>` : '';
        const shareContactBtn = r.targetContactPhone
          ? `<button class="mini-btn mini-send" onclick="event.stopPropagation(); shareReminderDirectly('${r.targetContactPhone}', '🔔 Reminder Me: ${escapeHtml(r.title)} scheduled for ${dateFormatted}, ${timeFormatted}. Open: ${window.location.origin}')">Share 📲</button>`
          : '';

        const snoozeBtn = isDelivered
          ? `<button class="mini-btn" style="background:#FEF3C7; color:#92400E; font-weight:600;" onclick="event.stopPropagation(); snoozeReminder('${r.id}', 10)">+10m</button>`
          : '';
        const doneBtn = isDelivered
          ? `<button class="mini-btn" style="background:#D1FAE5; color:#065F46; font-weight:600;" onclick="event.stopPropagation(); dismissReminderDirect('${r.id}')">Done ✓</button>`
          : '';

        return `
          <div class="reminder-item" onclick="openAestheticModalById('${r.id}')" style="${isDelivered ? 'border-left: 3px solid #10B981;' : ''}">
            <div class="reminder-header-row">
              <div>
                <div class="reminder-text">${escapeHtml(r.title)}</div>
                ${r.message && r.message !== r.title ? `<p style="font-size:13px; color:var(--text-secondary); margin-top:2px;">${escapeHtml(r.message)}</p>` : ''}
              </div>
              <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center;">
                ${statusBadge}
                ${dailyBadge}
                ${contactBadge}
              </div>
            </div>

            <div class="reminder-meta-row">
              <div class="reminder-time-chip">${dateFormatted}, ${timeFormatted}</div>
              <div class="reminder-actions-btns" onclick="event.stopPropagation()">
                ${shareContactBtn}
                ${snoozeBtn}
                ${doneBtn}
                <button class="mini-btn mini-send" onclick="testPlayReminder('${r.id}')">View 🌸</button>
                <button class="mini-btn mini-delete" onclick="deleteReminder('${r.id}')">✕</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  } else {
    // 📬 MESSAGE BOX (All Saved Reminders with Brand New Aesthetic Artworks)
    if (activeContainer) activeContainer.classList.add('hidden');
    if (activeEmpty) activeEmpty.classList.add('hidden');
    if (msgboxContainer) msgboxContainer.classList.remove('hidden');

    // Sort newest first
    const allSaved = [...currentReminders].sort((a, b) => {
      const timeA = a.reminderTimestamp || new Date(a.reminderTime).getTime();
      const timeB = b.reminderTimestamp || new Date(b.reminderTime).getTime();
      return timeB - timeA;
    });

    if (countBadge) countBadge.textContent = `${allSaved.length} Saved`;

    if (allSaved.length === 0) {
      if (msgboxContainer) msgboxContainer.innerHTML = '';
      if (msgboxEmpty) msgboxEmpty.classList.remove('hidden');
      return;
    }

    if (msgboxEmpty) msgboxEmpty.classList.add('hidden');
    if (msgboxContainer) {
      msgboxContainer.innerHTML = allSaved.map(r => {
        const d = new Date(r.reminderTimestamp || r.reminderTime);
        const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        const dateFormatted = d.toLocaleDateString([], { month: 'short', day: 'numeric' });

        const isDelivered = r.status === 'sent' || r.status === 'completed';
        const statusPill = isDelivered
          ? `<span class="pill-tag" style="background:var(--emerald-light); color:var(--emerald-primary);">${t.deliveredTag}</span>`
          : `<span class="pill-tag" style="background:#F3F4F6; color:var(--text-secondary);">${t.scheduledTag}</span>`;

        const shareContactBtn = r.targetContactPhone
          ? `<button class="btn-msgbox-read" style="background:#FFFFFF; border:1px solid var(--border-subtle); color:var(--text-primary);" onclick="shareReminderDirectly('${r.targetContactPhone}', '🔔 Reminder Me: ${escapeHtml(r.title)} scheduled for ${dateFormatted}, ${timeFormatted}. Open: ${window.location.origin}')">Share 📲</button>`
          : '';

        return `
          <div class="msg-box-card" onclick="openAestheticModalById('${r.id}')">
            <div class="msg-box-top-row">
              <div class="msg-box-thumb-wrap">
                <img src="${getReminderArtwork(r)}" alt="Aesthetic Art" class="msg-box-thumb">
              </div>
              <div class="msg-box-details">
                <div class="msg-box-title">${escapeHtml(r.title)}</div>
                <div class="msg-box-text">${escapeHtml(r.message || r.title)}</div>
                <div class="msg-box-tags">
                  ${statusPill}
                  ${r.targetContactName ? `<span class="pill-tag" style="font-size:10px;">For: ${escapeHtml(r.targetContactName)}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="msg-box-bottom-bar" onclick="event.stopPropagation()">
              <div class="msg-box-time-chip">${dateFormatted} • ${timeFormatted}</div>
              <div class="msg-box-actions">
                ${shareContactBtn}
                <button class="btn-msgbox-read" onclick="openAestheticModalById('${r.id}')">${t.readMsg}</button>
                <button class="btn-msgbox-del" title="Delete" onclick="deleteReminder('${r.id}')">✕</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function openAestheticModalById(id) {
  const rem = currentReminders.find(r => r.id === id);
  if (rem) {
    openAestheticModal(rem);
  }
}

function testPlayReminder(id) {
  const rem = currentReminders.find(r => r.id === id);
  if (rem) {
    openAestheticModal(rem);
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

async function snoozeReminder(id, minutes = 10) {
  try {
    const res = await fetch(`/api/reminders/${id}/snooze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ minutes })
    });
    if (res.ok) {
      showToast(`✓ Snoozed for ${minutes} mins`);
      loadReminders();
    }
  } catch (e) {
    showToast('Failed to snooze');
  }
}

async function dismissReminderDirect(id) {
  try {
    const res = await fetch(`/api/reminders/${id}/dismiss`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.ok) {
      showToast('✓ Completed');
      loadReminders();
    }
  } catch (e) {
    showToast('Failed to complete');
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
      showToast(data.error || 'Authentication failed');
      return;
    }

    authToken = data.token;
    localStorage.setItem('reminder_me_token', authToken);
    currentUser = data.user;

    showToast('Welcome to Reminder Me!');
    initAppSession();
    switchNav('create');

    // Prompt for standard native notification permission directly on user gesture
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => {
        enablePushNotifications();
      }, 500);
    }
  } catch (err) {
    showToast('Network error: ' + err.message);
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
    if (res.status === 401) {
      localStorage.removeItem('reminder_me_token');
      authToken = null;
      switchNav('auth');
      return;
    }
    if (!res.ok) {
      console.warn('Temporary session check failure:', res.status);
      return;
    }
    const data = await res.json();
    currentUser = data.user;
    initAppSession();
    if (!currentUser.hasPushSubscription && 'Notification' in window && Notification.permission === 'granted') {
      ensurePushSubscription();
    }
  } catch (err) {
    console.error('Session check error:', err);
  }
}

function initAppSession() {
  updateUserBadge();

  const isOwner = currentUser && currentUser.isOwner;

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

  // Check Notification Permission
  const permBanner = document.getElementById('lockscreen-perm-banner');
  if (permBanner) {
    if ('Notification' in window && Notification.permission === 'default') {
      permBanner.classList.remove('hidden');
      const t = i18n[currentLang];
      const titleEl = document.getElementById('lbl-lockscreen-title');
      const subEl = document.getElementById('lbl-lockscreen-sub');
      const btnEnable = document.getElementById('btn-banner-enable');
      if (titleEl) titleEl.textContent = t.lockScreenTitle;
      if (subEl) subEl.textContent = t.lockScreenSub;
      if (btnEnable) btnEnable.textContent = t.enableAlertsBtn;
    } else {
      permBanner.classList.add('hidden');
      if ('Notification' in window && Notification.permission === 'granted') {
        ensurePushSubscription();
      }
    }
  }

  loadReminders();
}

function updateUserBadge() {
  if (!currentUser) return;
  const t = i18n[currentLang];

  if (currentUser.isOwner) {
    trialText.textContent = '👑 Owner VIP';
    trialBadge.style.background = 'var(--emerald-light)';
    trialBadge.style.color = 'var(--emerald-primary)';
  } else if (currentUser.planStatus === 'coupon_lifetime') {
    trialText.textContent = 'Lifetime VIP';
    trialBadge.style.background = 'var(--emerald-light)';
    trialBadge.style.color = 'var(--emerald-primary)';
  } else if (currentUser.planStatus === 'trial') {
    const days = currentUser.trialDaysRemaining || 10;
    trialText.textContent = t.trialDaysLeft.replace('{days}', days);
    trialBadge.style.background = 'rgba(234, 88, 12, 0.1)';
    trialBadge.style.color = '#C2410C';
  } else {
    trialText.textContent = 'Pro Member';
    trialBadge.style.background = 'var(--emerald-light)';
    trialBadge.style.color = 'var(--emerald-primary)';
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
  if (!confirm('Permanently delete your account and all reminders? This cannot be undone.')) return;
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
// SUBSCRIPTIONS & COUPONS
// -------------------------------------------------------------
function selectPlan(plan) {
  selectedPlan = plan;
  document.getElementById('card-plan-monthly').style.borderColor = plan === 'monthly' ? 'var(--emerald-primary)' : 'var(--border-subtle)';
  document.getElementById('card-plan-yearly').style.borderColor = plan === 'yearly' ? 'var(--emerald-primary)' : 'var(--border-subtle)';
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
      showToast(data.error || 'Failed to start payment');
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
          showToast(verifyData.message);
          checkSession();
        }
      },
      prefill: {
        name: currentUser.fullName,
        email: currentUser.email,
        contact: currentUser.phone
      },
      theme: { color: '#0F3826' }
    };

    if (typeof Razorpay !== 'undefined') {
      const rzp = new Razorpay(options);
      rzp.open();
    } else {
      const mockPayId = 'pay_' + Date.now();
      await fetch('/api/subscription/verify-autopay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ planType: selectedPlan, paymentId: mockPayId })
      });
      showToast('Autopay activated (Test Mode)');
      checkSession();
    }
  } catch (err) {
    showToast(err.message);
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
      showToast(data.message);
      document.getElementById('coupon-input').value = '';
      checkSession();
    } else {
      showToast(data.error || 'Invalid coupon');
    }
  } catch (e) {
    showToast('Coupon application error');
  }
}

// -------------------------------------------------------------
// WEB PUSH NOTIFICATIONS & LOCK-SCREEN ALERTS
// -------------------------------------------------------------
async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      initAppSession();
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const vapidRes = await fetch('/api/push/public-key');
    const { publicKey } = await vapidRes.json();
    const appServerKey = urlB64ToUint8Array(publicKey);

    // Unsubscribe any stale subscription to guarantee fresh key alignment
    try {
      const oldSub = await reg.pushManager.getSubscription();
      if (oldSub) await oldSub.unsubscribe();
    } catch (unsubErr) {}

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey
    });

    const subJson = sub.toJSON ? sub.toJSON() : JSON.parse(JSON.stringify(sub));

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ subscription: subJson })
    });

    if (res.ok) {
      showToast('✓ Reminders connected to your phone!');
      initAppSession();
    }
  } catch (err) {
    console.warn('Push setup notice:', err.message);
  }
}

// Background sync to ensure subscription is active
async function ensurePushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !authToken) return;
  if (Notification.permission !== 'granted') return;

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    const vapidRes = await fetch('/api/push/public-key');
    if (!vapidRes.ok) return;
    const { publicKey } = await vapidRes.json();
    const appServerKey = urlB64ToUint8Array(publicKey);

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey
      });
    }

    const subJson = sub.toJSON ? sub.toJSON() : JSON.parse(JSON.stringify(sub));

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ subscription: subJson })
    });
  } catch (e) {
    console.warn('Silent push sync notice:', e.message);
  }
}

// 1-Tap Test Lock Screen Alert
async function testLockScreenAlert() {
  if (!('Notification' in window)) {
    showToast('Notifications not supported on this browser');
    return;
  }

  showToast('Connecting notification...');
  await enablePushNotifications();
  showToast('🔔 Sending alert... Lock your phone screen now!');

  try {
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (res.ok) {
      showToast('✓ Alert dispatched! Check your lock screen.');
    } else {
      showToast(data.error || 'Failed to send test alert');
    }
  } catch (e) {
    showToast('Error: ' + e.message);
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
// SHARE APP & VOICE MIC
// -------------------------------------------------------------
function shareReminderMeApp() {
  const shareData = {
    title: 'Reminder Me',
    text: 'Try Reminder Me - Elegant in-app alarms and push alerts for all your daily tasks!',
    url: window.location.origin
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    navigator.clipboard.writeText(window.location.origin).then(() => {
      showToast('App link copied to clipboard');
    });
  }
}

document.getElementById('share-app-btn').addEventListener('click', shareReminderMeApp);

// Voice Mic recognition
const quickMic = document.getElementById('quick-mic-btn');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition && quickMic) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';

  quickMic.addEventListener('click', () => {
    try {
      showToast('Listening...');
      quickMic.textContent = '●';
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

// Register PWA Service Worker immediately and listen for background push events
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    console.log('SW registered successfully:', reg.scope);
  }).catch(err => console.log('SW registration error:', err));

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PUSH_REMINDER_TRIGGER') {
      const rem = event.data.data;
      if (rem) {
        showIosNotificationBanner(rem);
        loadReminders();
      }
    } else if (event.data && event.data.type === 'OPEN_REMINDER_MODAL') {
      if (event.data.reminderId) {
        openAestheticModalById(event.data.reminderId);
      }
    }
  });
}

// Default DateTime for custom inputs in local time
const now = new Date();
now.setMinutes(now.getMinutes() + 15);
const pad = n => n < 10 ? '0' + n : n;
const defaultDT = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
const customDT = document.getElementById('custom-datetime');
if (customDT) customDT.value = defaultDT;
const contactDT = document.getElementById('contact-datetime');
if (contactDT) contactDT.value = defaultDT;

// Initialize Session
applyLanguage(currentLang);
checkSession();
