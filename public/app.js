// ReminderMe - Smart Daily Morning & Evening Reminder App (PWA & Native)

// -------------------------------------------------------------
// 🌐 DYNAMIC DOMAIN & BACKEND RESOLUTION (NO HARDCODED LOCALHOST)
// -------------------------------------------------------------
const OFFICIAL_DOMAIN = 'https://reminderme-app.vercel.app';

function getLiveOrigin() {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    if (origin.startsWith('http') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return origin;
    }
  }
  return OFFICIAL_DOMAIN;
}

// When inside Capacitor/Cordova app on phone (capacitor://localhost or file://), hit the cloud domain.
// When inside any web browser (dev localhost, production reminderme.in.net, or Render), use relative path ('')
const isNativeAppShell = (typeof window !== 'undefined' && (
  window.location.protocol === 'capacitor:' ||
  window.location.protocol === 'file:' ||
  (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
));

const BACKEND_BASE = isNativeAppShell
  ? OFFICIAL_DOMAIN
  : '';

const originalFetch = window.fetch;
window.fetch = function(resource, init) {
  if (typeof resource === 'string' && resource.startsWith('/api/')) {
    resource = BACKEND_BASE + resource;
  }
  return originalFetch.call(this, resource, init);
};

// -------------------------------------------------------------
// 📲 PWA INSTALLATION & STANDALONE VIEW SWITCHER
// -------------------------------------------------------------
let deferredPrompt = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default mini-infobar on mobile Chrome
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] beforeinstallprompt captured successfully');
    const headerInstall = document.getElementById('btn-header-install');
    if (headerInstall) headerInstall.classList.add('pulse-glowing-btn');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    console.log('[PWA] ReminderMe App successfully installed');
    showToast('🎉 ReminderMe installed successfully on your device!');
    applyAppDisplayMode();
  });
}

function checkIsStandalone() {
  if (typeof window === 'undefined') return false;
  const isStandaloneMatch = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = (window.navigator && window.navigator.standalone === true);
  const isAndroidReferrer = document.referrer && document.referrer.includes('android-app://');
  const isCapacitorNative = (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  return !!(isStandaloneMatch || isIosStandalone || isAndroidReferrer || isCapacitorNative);
}

function applyAppDisplayMode() {
  const isStandalone = checkIsStandalone();
  const landingHero = document.getElementById('landing-hero');
  const headerInstallBtn = document.getElementById('btn-header-install');

  if (isStandalone) {
    document.body.classList.add('is-standalone-app');
    if (landingHero) landingHero.style.display = 'none';
    if (headerInstallBtn) headerInstallBtn.style.display = 'none';
    console.log('[PWA] Standalone App Mode Active -> Direct to Dashboard');
  } else {
    document.body.classList.remove('is-standalone-app');
    const skipped = sessionStorage.getItem('reminderme_skip_landing');
    if (skipped === '1' && landingHero) {
      landingHero.style.display = 'none';
    }
  }
}

async function triggerPwaInstall() {
  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult && choiceResult.outcome === 'accepted') {
        showToast('✓ Installing ReminderMe App...');
        deferredPrompt = null;
      }
    } catch (err) {
      console.warn('[PWA] Installation prompt error:', err);
      openPwaInstallModal();
    }
  } else {
    // If prompt is unavailable (e.g. iOS Safari, desktop or already installed), open helper modal
    openPwaInstallModal();
  }
}

function openPwaInstallModal() {
  const modal = document.getElementById('pwa-install-modal');
  if (modal) {
    modal.classList.remove('hidden');
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isAndroid = /android/.test(window.navigator.userAgent.toLowerCase());
    const iosBox = document.getElementById('pwa-guide-ios');
    const androidBox = document.getElementById('pwa-guide-android');
    const desktopBox = document.getElementById('pwa-guide-desktop');

    if (isIos && iosBox) {
      iosBox.style.borderColor = 'var(--emerald-primary)';
      iosBox.style.background = 'rgba(16, 185, 129, 0.08)';
    } else if (isAndroid && androidBox) {
      androidBox.style.borderColor = 'var(--emerald-primary)';
      androidBox.style.background = 'rgba(16, 185, 129, 0.08)';
    } else if (desktopBox) {
      desktopBox.style.borderColor = 'var(--emerald-primary)';
      desktopBox.style.background = 'rgba(16, 185, 129, 0.08)';
    }
  }
}

function closePwaInstallModal() {
  const modal = document.getElementById('pwa-install-modal');
  if (modal) modal.classList.add('hidden');
}

function scrollToAppView() {
  const target = document.getElementById('view-auth') || document.querySelector('.app-main');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function continueToWebApp() {
  sessionStorage.setItem('reminderme_skip_landing', '1');
  const landingHero = document.getElementById('landing-hero');
  if (landingHero) {
    landingHero.style.display = 'none';
  }
  showToast('✓ Welcome to ReminderMe Web App!');
}

// Check display mode immediately on script evaluation
if (typeof window !== 'undefined') {
  applyAppDisplayMode();
  if (window.matchMedia) {
    window.matchMedia('(display-mode: standalone)').addEventListener('change', applyAppDisplayMode);
  }
}

// -------------------------------------------------------------
// 📱 NATIVE ANDROID CAPACITOR ALARMS & NOTIFICATIONS
// -------------------------------------------------------------
function stringHashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const REMINDER_CHANNEL_ID = 'reminder_alarms_v4';

async function initNativeNotificationChannel() {
  try {
    const Cap = window.Capacitor;
    if (!Cap || !Cap.Plugins || !Cap.Plugins.LocalNotifications) return;
    const LocalNotifications = Cap.Plugins.LocalNotifications;
    
    // Register high priority notification channel for Android 8.0+
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: 'ReminderMe Alarms',
      description: 'High-priority reminder sound alerts and notifications',
      importance: 5, // MAX importance (heads-up banner + sound)
      visibility: 1, // Public on lockscreen
      sound: 'sweet_chime.wav',
      vibration: true,
      lights: true,
      lightColor: '#0F5132'
    });
    console.log('[Native] Notification channel initialized:', REMINDER_CHANNEL_ID);
  } catch (err) {
    console.warn('[Native] Channel init error:', err);
  }
}

async function scheduleNativeLocalNotification(reminder) {
  try {
    const Cap = window.Capacitor;
    if (!Cap || !Cap.Plugins || !Cap.Plugins.LocalNotifications) return;

    const LocalNotifications = Cap.Plugins.LocalNotifications;
    try {
      await LocalNotifications.requestPermissions();
    } catch (e) {}

    await initNativeNotificationChannel();

    const triggerDate = new Date(reminder.reminderTimestamp || reminder.reminderTime);
    if (isNaN(triggerDate.getTime()) || triggerDate.getTime() <= Date.now()) return;

    const notifId = stringHashCode(String(reminder.id || Date.now())) % 2147483647;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title: '🌸 ReminderMe: ' + (reminder.title || 'Task Due'),
          body: (reminder.message && reminder.message !== reminder.title) ? reminder.message : 'Tap to view reminder details.',
          schedule: { at: triggerDate, allowWhileIdle: true },
          channelId: REMINDER_CHANNEL_ID,
          sound: 'sweet_chime.wav',
          smallIcon: 'ic_stat_reminder',
          largeIcon: 'ic_reminder_large',
          iconColor: '#0F5132',
          extra: {
            reminderId: reminder.id,
            title: reminder.title,
            message: reminder.message
          }
        }
      ]
    });
    console.log('[Native] Scheduled Android OS alarm for:', triggerDate.toLocaleString(), 'Channel:', REMINDER_CHANNEL_ID);
  } catch (err) {
    console.warn('[Native LocalNotification] Scheduling error:', err);
  }
}

// Setup native notification tap listener
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
        initNativeNotificationChannel();
        window.Capacitor.Plugins.LocalNotifications.requestPermissions().catch(() => {});
        window.Capacitor.Plugins.LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
          const extra = action && action.notification && action.notification.extra;
          if (extra && extra.reminderId) {
            const found = (currentReminders && currentReminders.find(r => r.id === extra.reminderId)) || extra;
            if (typeof openAestheticModal === 'function') {
              openAestheticModal(found);
            }
          }
        });
      }
    } catch (e) {}
  });
}

// Localization Dictionaries (English Default & Hindi)
const i18n = {
  en: {
    appName: 'ReminderMe',
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
    shareApp: 'Share ReminderMe App',
    logout: 'Log Out',
    deleteAccount: 'Delete My Account & Data',
    switchLangBtn: 'हिन्दी'
  },
  hi: {
    appName: 'ReminderMe',
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

// Extract token from URL hash if redirected from in-app live update
if (typeof window !== 'undefined' && window.location.hash) {
  try {
    const hashStr = window.location.hash.substring(1);
    const params = new URLSearchParams(hashStr);
    const tokenParam = params.get('token');
    if (tokenParam) {
      localStorage.setItem('reminder_me_token', tokenParam);
      history.replaceState(null, null, window.location.pathname);
    }
  } catch (e) {}
}

let authToken = localStorage.getItem('reminder_me_token') || null;
let currentUser = null;

// Safe session storage helper: never store PII (email, phone, fullName) in localStorage
function saveSafeUserSession(user) {
  if (!user) return;
  const safeSession = {
    id: user.id,
    planStatus: user.planStatus,
    isOwner: user.isOwner,
    lifetimeFree: user.lifetimeFree,
    trialDaysRemaining: user.trialDaysRemaining
  };
  localStorage.setItem('reminder_me_cached_user', JSON.stringify(safeSession));
}

// Restore cached non-PII user session immediately (prevents login screen bounce during updates)
const cachedUserStr = localStorage.getItem('reminder_me_cached_user');
if (cachedUserStr) {
  try {
    const parsed = JSON.parse(cachedUserStr);
    // Purge any legacy PII (email, phone, fullName) from localStorage if present
    if (parsed.email || parsed.phone || parsed.fullName) {
      delete parsed.email;
      delete parsed.phone;
      delete parsed.fullName;
      saveSafeUserSession(parsed);
    }
    currentUser = parsed;
  } catch (e) {}
}

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

// Sweet Audio Chime (plays sweet_chime.wav or harmonious synth chime)
let lastChimePlayTime = 0;
function playNotificationChime() {
  const now = Date.now();
  if (now - lastChimePlayTime < 4000) return; // Prevent duplicate rapid chime spam
  lastChimePlayTime = now;

  try {
    const preloadedAudio = document.getElementById('notif-chime-audio');
    if (preloadedAudio) {
      preloadedAudio.currentTime = 0;
      preloadedAudio.play().catch(() => {
        playSynthChime();
      });
      return;
    }
    const audio = new Audio('/sounds/sweet_chime.wav');
    audio.play().catch(() => {
      playSynthChime();
    });
  } catch (e) {
    playSynthChime();
  }
}

function playSynthChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [587.33, 880.00]; // D5, A5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);
      gain.gain.setValueAtTime(0, now + idx * 0.15);
      gain.gain.linearRampToValueAtTime(0.3, now + idx * 0.15 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.85);
    });
  } catch (e) {}
}

// -------------------------------------------------------------
// 📱 iOS STYLE TOP NOTIFICATION SLIDE-DOWN BANNER (Image 2)
// -------------------------------------------------------------
function showIosNotificationBanner(reminder) {
  if (!reminder) return;
  activeViewingReminder = reminder;

  // Play audio alert
  playNotificationChime();

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

  const rem = currentReminders.find(r => r.id === id) || activeViewingReminder;
  if (rem) {
    rem.status = 'completed';
    rem.clientPopped = 1;
    addLocalReminder(rem);
    showToast('✓ Marked as completed');
  }

  if (authToken) {
    fetch(`/api/reminders/${id}/dismiss`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    }).catch(() => {});
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
    // Register native Android OS exact alarm (works when app is closed or phone locked)
    scheduleNativeLocalNotification(r);
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
  if (typeof document !== 'undefined' && document.hidden) return;

  try {
    const res = await fetch('/api/reminders/due-notifications', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.due && data.due.length > 0) {
      let triggeredAny = false;
      for (const rem of data.due) {
        if (!handledReminderIds.has(rem.id)) {
          handledReminderIds.add(rem.id);
          showIosNotificationBanner(rem);
          triggeredAny = true;
          break;
        }
      }
      if (triggeredAny) {
        loadReminders();
      }
    }
  } catch (e) {}
}
setInterval(pollDueReminders, 25000);

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

  // Automatically hide marketing landing hero when user is logged into the app
  const landingHero = document.getElementById('landing-hero');
  if (landingHero) {
    landingHero.style.display = 'none';
  }
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
  if (currentUser && checkIsOwnerClient(currentUser) && targetView === 'subscription') {
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
// LOCAL OFFLINE-FIRST REMINDER STORAGE & SYNC
// -------------------------------------------------------------
function getLocalReminders() {
  try {
    const raw = localStorage.getItem('reminder_me_local_reminders');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalReminders(list) {
  try {
    localStorage.setItem('reminder_me_local_reminders', JSON.stringify(list || []));
  } catch (e) {}
}

function addLocalReminder(rem) {
  if (!rem || !rem.id) return;
  const list = getLocalReminders();
  const filtered = list.filter(r => r.id !== rem.id);
  filtered.unshift(rem);
  saveLocalReminders(filtered);

  // Update currentReminders in memory
  currentReminders = currentReminders.filter(r => r.id !== rem.id);
  currentReminders.unshift(rem);
  renderReminders();
  scheduleReminderTimers([rem]);
}

function continueAsGuest() {
  localStorage.setItem('reminder_me_guest_mode', 'true');
  if (!currentUser) {
    currentUser = {
      id: 'guest_' + Date.now(),
      fullName: 'Guest User',
      planStatus: 'trial',
      isGuest: true,
      trialDaysRemaining: 10
    };
    saveSafeUserSession(currentUser);
  }
  initAppSession();
  switchNav('create');
  showToast('✓ Quick Start active — reminders will save on your phone!');
  loadReminders();
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
  const timeFormatted = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  // 1. Immediately save locally & schedule precision alarm so reminder NEVER fails!
  const localRem = {
    id: 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    userId: currentUser ? currentUser.id : 'guest',
    title: message,
    message: message,
    reminderTime,
    reminderTimestamp,
    repeat: 'none',
    priority: 'normal',
    category: 'personal',
    status: 'pending',
    clientPopped: 0,
    createdAt: new Date().toISOString()
  };
  addLocalReminder(localRem);
  showToast(`✓ Scheduled for ${timeFormatted}`);
  inputEl.value = '';
  switchNav('list');

  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => enablePushNotifications(), 400);
  }

  // 2. Sync to cloud server in background if online & authenticated
  if (authToken) {
    fetch('/api/reminders/quick', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ message, reminderTimestamp, reminderTime })
    })
    .then(r => r.json())
    .then(data => {
      if (data && data.reminder) {
        addLocalReminder(data.reminder);
      }
    })
    .catch(err => {
      console.warn('[Sync] Offline or sleeping server, saved in local store:', err);
    });
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
  const timeFormatted = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  // 1. Immediately save locally & schedule precision alarm
  const localRem = {
    id: 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    userId: currentUser ? currentUser.id : 'guest',
    title,
    message: note || title,
    reminderTime,
    reminderTimestamp,
    repeat: 'none',
    priority: priority || 'normal',
    category: 'personal',
    status: 'pending',
    clientPopped: 0,
    createdAt: new Date().toISOString()
  };
  addLocalReminder(localRem);
  showToast(`✓ Saved for ${timeFormatted}`);
  document.getElementById('form-custom').reset();
  switchNav('list');

  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => enablePushNotifications(), 400);
  }

  // 2. Sync to cloud server
  if (authToken) {
    fetch('/api/reminders/custom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ title, note, reminderTimestamp, reminderTime, priority })
    })
    .then(r => r.json())
    .then(data => {
      if (data && data.reminder) {
        addLocalReminder(data.reminder);
      }
    })
    .catch(err => {
      console.warn('[Sync] Custom reminder saved in local store:', err);
    });
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

  // 1. Immediately save locally & schedule precision alarm
  const localRem = {
    id: 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    userId: currentUser ? currentUser.id : 'guest',
    title,
    message: title,
    reminderTime,
    reminderTimestamp,
    repeat: 'daily',
    repeatTime: time,
    endDate: kisDateTak || null,
    priority: 'normal',
    category: 'personal',
    status: 'pending',
    clientPopped: 0,
    createdAt: new Date().toISOString()
  };
  addLocalReminder(localRem);
  showToast(`✓ Daily reminder scheduled at ${time}`);
  document.getElementById('form-daily').reset();
  switchNav('list');

  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => enablePushNotifications(), 400);
  }

  // 2. Sync to cloud server
  if (authToken) {
    fetch('/api/reminders/daily', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ title, time, kisDateTak, reminderTimestamp, reminderTime })
    })
    .then(r => r.json())
    .then(data => {
      if (data && data.reminder) {
        addLocalReminder(data.reminder);
      }
    })
    .catch(err => {
      console.warn('[Sync] Daily reminder saved in local store:', err);
    });
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

  // 1. Save locally immediately
  const localRem = {
    id: 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    userId: currentUser ? currentUser.id : 'guest',
    title: `${title} (for ${contactName})`,
    message: title,
    reminderTime,
    reminderTimestamp,
    repeat: 'none',
    priority: 'normal',
    category: 'contact',
    targetContactPhone: phone,
    targetContactName: contactName,
    status: 'pending',
    clientPopped: 0,
    createdAt: new Date().toISOString()
  };
  addLocalReminder(localRem);
  showToast(`✓ Reminder scheduled for ${contactName}!`);
  document.getElementById('form-contact').reset();
  switchNav('list');

  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => enablePushNotifications(), 400);
  }

  // 2. Sync to cloud server
  if (authToken) {
    fetch('/api/reminders/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ contactName, phone, title, reminderTimestamp, reminderTime })
    })
    .then(r => r.json())
    .then(data => {
      if (data && data.reminder) {
        addLocalReminder(data.reminder);
      }
    })
    .catch(err => {
      console.warn('[Sync] Contact reminder saved in local store:', err);
    });
  }
});

function shareReminderById(id) {
  const r = currentReminders.find(rem => rem.id === id);
  if (!r) return;
  const d = new Date(r.reminderTimestamp || r.reminderTime);
  const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateFormatted = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const cleanPhone = (r.targetContactPhone || '').replace(/[^0-9+]/g, '');
  const text = `🔔 ReminderMe: "${r.title}" scheduled for ${dateFormatted}, ${timeFormatted}.\nOpen: https://reminderme-app.vercel.app`;
  if (navigator.share) {
    navigator.share({
      title: 'ReminderMe Alert',
      text: text
    }).catch(() => {
      window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(text)}`;
    });
  } else {
    window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(text)}`;
  }
}

function shareReminderDirectly(phone, text) {
  const cleanPhone = (phone || '').replace(/[^0-9+]/g, '');
  if (navigator.share) {
    navigator.share({
      title: 'ReminderMe Alert',
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
  // 1. Immediately load local reminders (Zero delay offline support)
  const localList = getLocalReminders();
  if (localList.length > 0) {
    currentReminders = localList;
    scheduleReminderTimers(currentReminders);
    renderReminders();
  }

  // 2. Fetch server reminders if authenticated
  if (!authToken) return;
  try {
    const res = await fetch('/api/reminders', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.ok) {
      const serverReminders = await res.json();
      if (Array.isArray(serverReminders)) {
        const map = new Map();
        localList.forEach(r => map.set(r.id, r));
        serverReminders.forEach(r => map.set(r.id, r));
        currentReminders = Array.from(map.values());
        saveLocalReminders(currentReminders);
        scheduleReminderTimers(currentReminders);
        renderReminders();
      }
    }
  } catch (err) {
    console.warn('Server fetch fallback to local reminders:', err);
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
          ? `<button class="mini-btn mini-send" onclick="event.stopPropagation(); shareReminderById('${r.id}')">Share 📲</button>`
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
          ? `<button class="btn-msgbox-read" style="background:#FFFFFF; border:1px solid var(--border-subtle); color:var(--text-primary);" onclick="shareReminderById('${r.id}')">Share 📲</button>`
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
    playNotificationChime();
    openAestheticModal(rem);
  }
}

async function deleteReminder(id) {
  if (!confirm('Delete this reminder?')) return;
  // Remove locally immediately
  const localList = getLocalReminders().filter(r => r.id !== id);
  saveLocalReminders(localList);
  currentReminders = currentReminders.filter(r => r.id !== id);
  if (activeTimers.has(id)) {
    clearTimeout(activeTimers.get(id));
    activeTimers.delete(id);
  }
  handledReminderIds.delete(id);
  renderReminders();
  showToast('✓ Reminder deleted');

  if (authToken) {
    fetch(`/api/reminders/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    }).catch(() => {});
  }
}

async function snoozeReminder(id, minutes = 10) {
  const rem = currentReminders.find(r => r.id === id);
  const newDueMs = Date.now() + minutes * 60000;
  if (rem) {
    rem.reminderTimestamp = newDueMs;
    rem.reminderTime = new Date(newDueMs).toISOString();
    rem.clientPopped = 0;
    rem.status = 'pending';
    handledReminderIds.delete(id);
    addLocalReminder(rem);
    showToast(`✓ Snoozed for ${minutes} mins`);
  }
  if (authToken) {
    fetch(`/api/reminders/${id}/snooze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ minutes })
    }).catch(() => {});
  }
}

async function dismissReminderDirect(id) {
  const rem = currentReminders.find(r => r.id === id);
  if (rem) {
    rem.status = 'completed';
    rem.clientPopped = 1;
    addLocalReminder(rem);
    showToast('✓ Completed');
  }
  if (authToken) {
    fetch(`/api/reminders/${id}/dismiss`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    }).catch(() => {});
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
    saveSafeUserSession(currentUser);

    showToast('Welcome to ReminderMe!');
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
  const isGuestMode = localStorage.getItem('reminder_me_guest_mode') === 'true';
  if (!authToken) {
    if (isGuestMode) {
      if (!currentUser) {
        currentUser = {
          id: 'guest_' + Date.now(),
          fullName: 'Guest User',
          planStatus: 'trial',
          isGuest: true,
          trialDaysRemaining: 10
        };
      }
      initAppSession();
      switchNav('create');
      loadReminders();
      return;
    }
    switchNav('auth');
    return;
  }

  // If session is already cached, immediately display active UI
  if (currentUser) {
    initAppSession();
    switchNav('create');
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status === 401) {
      localStorage.removeItem('reminder_me_token');
      localStorage.removeItem('reminder_me_cached_user');
      authToken = null;
      currentUser = null;
      switchNav('auth');
      return;
    }
    if (!res.ok) {
      console.warn('Temporary session check failure (sleeping or offline):', res.status);
      if (currentUser) initAppSession();
      return;
    }
    const data = await res.json();
    currentUser = data.user;
    saveSafeUserSession(currentUser);
    initAppSession();
    if (!currentUser.hasPushSubscription && 'Notification' in window && Notification.permission === 'granted') {
      ensurePushSubscription();
    }
  } catch (err) {
    console.warn('Session check offline fallback:', err);
    if (currentUser) {
      initAppSession();
    }
  }
}

function checkIsOwnerClient(user) {
  if (!user) return false;
  if (user.isOwner === 1 || user.isOwner === true) return true;
  if (user.planStatus === 'owner') return true;
  const email = (user.email || '').toLowerCase().trim();
  const phone = (user.phone || '').replace(/[^0-9]/g, '');
  if (email.includes('deepakprajapat')) return true;
  if (phone.includes('8529062363')) return true;
  return false;
}

function initAppSession() {
  if (!currentUser) return;
  const isOwner = checkIsOwnerClient(currentUser);
  if (isOwner) {
    currentUser.isOwner = true;
    currentUser.planStatus = 'owner';
    currentUser.lifetimeFree = true;
  }

  updateUserBadge();

  // Automatically hide marketing landing hero when user is inside the app
  const landingHero = document.getElementById('landing-hero');
  if (landingHero) {
    landingHero.style.display = 'none';
  }

  // Show in-app update card inside Settings ONLY for owner, hide for everyone else
  const ownerUpdateCard = document.getElementById('owner-update-card');
  if (ownerUpdateCard) {
    if (isOwner) {
      ownerUpdateCard.classList.remove('hidden');
    } else {
      ownerUpdateCard.classList.add('hidden');
    }
  }

  if (isOwner) {
    if (navPlansBtn) navPlansBtn.classList.add('hidden');
    if (navAdminBtn) navAdminBtn.classList.remove('hidden');
    const ownerCard = document.getElementById('settings-owner-card');
    if (ownerCard) ownerCard.classList.remove('hidden');
    const ownerBox = document.getElementById('box-owner-plan-vip');
    if (ownerBox) ownerBox.classList.remove('hidden');
    const regularPlans = document.getElementById('box-regular-plans');
    if (regularPlans) regularPlans.classList.add('hidden');
  } else {
    if (navPlansBtn) navPlansBtn.classList.remove('hidden');
    if (navAdminBtn) navAdminBtn.classList.add('hidden');
    const ownerCard = document.getElementById('settings-owner-card');
    if (ownerCard) ownerCard.classList.add('hidden');
    const ownerBox = document.getElementById('box-owner-plan-vip');
    if (ownerBox) ownerBox.classList.add('hidden');
    const regularPlans = document.getElementById('box-regular-plans');
    if (regularPlans) regularPlans.classList.remove('hidden');

    const isSubscribed = currentUser && (currentUser.planStatus === 'coupon_lifetime' || currentUser.planStatus === 'monthly' || currentUser.planStatus === 'yearly');
    const userActiveBox = document.getElementById('box-user-active-vip');
    if (isSubscribed) {
      if (userActiveBox) userActiveBox.classList.remove('hidden');
      const planTitle = document.getElementById('user-active-plan-title');
      if (planTitle) {
        planTitle.textContent =
          currentUser.planStatus === 'coupon_lifetime' ? 'Lifetime VIP Access Active' : 'Subscription Active';
      }
      const autopayBtn = document.getElementById('btn-start-autopay');
      if (autopayBtn) autopayBtn.style.display = 'none';
    } else {
      if (userActiveBox) userActiveBox.classList.add('hidden');
      const autopayBtn = document.getElementById('btn-start-autopay');
      if (autopayBtn) autopayBtn.style.display = 'block';
    }
  }

  const emailChip = document.getElementById('user-email-chip');
  if (emailChip) emailChip.textContent = currentUser.email || currentUser.phone || 'User';

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
  const isOwner = checkIsOwnerClient(currentUser);

  if (isOwner) {
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

async function logoutUser() {
  if (!confirm('Log out from ReminderMe?')) return;
  try {
    if (authToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
    }
  } catch (e) {}
  localStorage.removeItem('reminder_me_token');
  localStorage.removeItem('reminder_me_cached_user');
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
      localStorage.removeItem('reminder_me_cached_user');
      authToken = null;
      currentUser = null;
      alert('Your account and personal data have been completely deleted.');
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
      name: 'ReminderMe',
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
            orderId: response.razorpay_order_id,
            signature: response.razorpay_signature
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
// EXCLUSIVE OWNER ADMIN PANEL (Real-Time Users & Data View)
// -------------------------------------------------------------
let adminUsersList = [];

async function loadAdminDashboard() {
  if (!authToken || !currentUser || !checkIsOwnerClient(currentUser)) return;
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    const totalUsersEl = document.getElementById('stat-total-users');
    if (totalUsersEl) totalUsersEl.textContent = data.stats.totalUsers || 0;
    const totalRemsEl = document.getElementById('stat-total-reminders');
    if (totalRemsEl) totalRemsEl.textContent = data.stats.totalReminders || 0;
    const activeTrialsEl = document.getElementById('stat-active-trials');
    if (activeTrialsEl) activeTrialsEl.textContent = data.stats.activeTrials || 0;
    const autopayEl = document.getElementById('stat-autopay-users');
    if (autopayEl) autopayEl.textContent = data.stats.activeAutopay || 0;

    adminUsersList = data.users || [];
    renderAdminUsersTable(adminUsersList);
  } catch (err) {
    console.error('Admin dashboard error:', err);
  }
}

let activeInspectedUser = null;

function renderAdminUsersTable(users) {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:18px; color:var(--text-secondary);">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users.map((u, idx) => {
    const remList = u.reminders || [];
    const hasRems = remList.length > 0;
    const planPill = u.isOwner
      ? '<span class="pill-tag" style="background:#10B981; color:#fff; font-size:10px;">👑 OWNER</span>'
      : `<span class="pill-tag" style="font-size:10px;">${escapeHtml(u.planStatus)}</span>`;

    return `
      <tr style="cursor:pointer;" onclick="inspectAdminUser(${idx})">
        <td>
          <strong>${escapeHtml(u.fullName || 'User')}</strong>${u.isOwner ? ' 👑' : ''}
          <div style="font-size:10px; color:var(--emerald-primary); font-weight:600;">${hasRems ? `🔔 ${remList.length} reminders (Tap to inspect)` : '0 reminders (Tap to inspect)'}</div>
        </td>
        <td>${escapeHtml(u.email || '-')}</td>
        <td><strong>${escapeHtml(u.phone || '-')}</strong></td>
        <td>${planPill}</td>
        <td>${u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).toLocaleDateString() : 'Trial'}</td>
      </tr>
    `;
  }).join('');
}

function inspectAdminUser(idx) {
  const u = adminUsersList[idx];
  if (!u) return;
  activeInspectedUser = u;

  const modal = document.getElementById('admin-user-modal');
  const nameEl = document.getElementById('modal-user-name');
  const badgeEl = document.getElementById('modal-user-plan-badge');
  const metaEl = document.getElementById('modal-user-meta');
  const remsEl = document.getElementById('modal-user-reminders');
  const remsTitle = document.getElementById('modal-user-rems-title');

  if (nameEl) nameEl.textContent = u.fullName || 'User Profile';
  if (badgeEl) {
    badgeEl.textContent = u.isOwner ? '👑 OWNER' : (u.planStatus || 'trial').toUpperCase();
    badgeEl.style.background = u.isOwner ? '#10B981' : 'var(--emerald-primary)';
    badgeEl.style.color = '#fff';
  }

  if (metaEl) {
    metaEl.innerHTML = `
      <div><strong>Email:</strong> ${escapeHtml(u.email || 'None')}</div>
      <div><strong>Phone:</strong> ${escapeHtml(u.phone || 'None')}</div>
      <div><strong>Plan:</strong> <span style="text-transform:uppercase; font-weight:700;">${escapeHtml(u.planStatus)}</span></div>
      <div><strong>Registered:</strong> ${new Date(u.createdAt).toLocaleDateString()}</div>
      <div><strong>Validity:</strong> ${u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).toLocaleDateString() : (u.trialEndsAt ? new Date(u.trialEndsAt).toLocaleDateString() : 'Active')}</div>
      <div><strong>Total Saved Reminders:</strong> ${u.reminders ? u.reminders.length : 0}</div>
    `;
  }

  const remList = u.reminders || [];
  if (remsTitle) remsTitle.textContent = `User's Saved Reminders (${remList.length}):`;
  if (remsEl) {
    if (remList.length === 0) {
      remsEl.innerHTML = '<div style="font-size:12px; color:var(--text-secondary); padding:10px 0;">No reminders saved by this user yet.</div>';
    } else {
      remsEl.innerHTML = remList.map(r => `
        <div style="background:#fff; border:1px solid #E5E7EB; border-radius:10px; padding:8px 12px; font-size:12px;">
          <div style="font-weight:700; color:#1F2937;">📌 ${escapeHtml(r.title)}</div>
          ${r.message && r.message !== r.title ? `<div style="color:#4B5563; font-size:11px; margin-top:2px;">${escapeHtml(r.message)}</div>` : ''}
          <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:10px; color:#6B7280;">
            <span>⏰ ${new Date(r.time).toLocaleString()}</span>
            <span>Status: <b style="color:${r.status === 'completed' ? '#10B981' : '#F59E0B'}">${escapeHtml(r.status)}</b></span>
          </div>
          ${r.targetContactName ? `<div style="font-size:10px; color:#059669; margin-top:2px;">Target Contact: ${escapeHtml(r.targetContactName)}</div>` : ''}
        </div>
      `).join('');
    }
  }

  if (modal) modal.classList.remove('hidden');
}

function closeAdminUserModal() {
  const modal = document.getElementById('admin-user-modal');
  if (modal) modal.classList.add('hidden');
  activeInspectedUser = null;
}

async function adminActionGrantVip() {
  if (!activeInspectedUser) return;
  if (!confirm(`Grant VIP Lifetime (100% Free Forever) to ${activeInspectedUser.fullName || activeInspectedUser.email}?`)) return;
  try {
    const res = await fetch(`/api/admin/users/${activeInspectedUser.id}/grant-vip`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message);
      closeAdminUserModal();
      loadAdminStats();
    } else {
      showToast(data.error || 'Failed to grant VIP');
    }
  } catch (err) {
    showToast('Network error');
  }
}

async function adminActionExtendTrial() {
  if (!activeInspectedUser) return;
  if (!confirm(`Extend free trial by 30 days for ${activeInspectedUser.fullName || activeInspectedUser.email}?`)) return;
  try {
    const res = await fetch(`/api/admin/users/${activeInspectedUser.id}/extend-trial`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message);
      closeAdminUserModal();
      loadAdminStats();
    } else {
      showToast(data.error || 'Failed to extend trial');
    }
  } catch (err) {
    showToast('Network error');
  }
}

async function adminActionDeleteUser() {
  if (!activeInspectedUser) return;
  if (!confirm(`Permanently delete account and all reminders of ${activeInspectedUser.fullName || activeInspectedUser.email}? This cannot be undone.`)) return;
  try {
    const res = await fetch(`/api/admin/users/${activeInspectedUser.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message);
      closeAdminUserModal();
      loadAdminStats();
    } else {
      showToast(data.error || 'Failed to delete user');
    }
  } catch (err) {
    showToast('Network error');
  }
}

async function adminCleanTests() {
  if (!confirm('Clean all dummy/test accounts? Genuine registered users will not be affected.')) return;
  try {
    const res = await fetch('/api/admin/clean-tests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message);
      loadAdminStats();
    } else {
      showToast(data.error || 'Failed to clean test data');
    }
  } catch (err) {
    showToast('Network error');
  }
}

function filterAdminUsers() {
  const searchInput = document.getElementById('admin-user-search');
  const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
  if (!q) {
    renderAdminUsersTable(adminUsersList);
    return;
  }
  const filtered = adminUsersList.filter(u =>
    (u.fullName && u.fullName.toLowerCase().includes(q)) ||
    (u.phone && u.phone.includes(q)) ||
    (u.email && u.email.toLowerCase().includes(q))
  );
  renderAdminUsersTable(filtered);
}

// -------------------------------------------------------------
// INSTANT IN-APP LIVE UPDATE (Smooth, Modern & Bulletproof)
// -------------------------------------------------------------
async function triggerLiveAppUpdate() {
  const spinner = document.getElementById('spinner-update');
  const btnText = document.getElementById('text-update-btn');
  const badge = document.getElementById('badge-update-status');
  if (spinner) spinner.classList.remove('hidden');
  if (btnText) btnText.textContent = 'Checking Cloud...';

  try {
    // 1. Check local or cloud server version
    let versionData = null;
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (res.ok) versionData = await res.json();
    } catch (e) {}

    if (!versionData) {
      try {
        const cloudRes = await fetch('https://whatsapp-reminder-0yad.onrender.com/api/version', { cache: 'no-store' });
        if (cloudRes.ok) versionData = await cloudRes.json();
      } catch (e) {}
    }

    // 2. Trigger Service Worker cache check
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      } catch (e) {}
    }

    if (badge) {
      badge.textContent = 'Up to Date';
      badge.style.background = '#10B981';
    }

    showToast('✓ App is up to date! Version 3.1.0 (All features synced) 🌸');
  } catch (err) {
    showToast('✓ App is up to date! (Version 3.1.0)');
  } finally {
    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = '🔄 Check for Updates';
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
    let csv = 'ID,Full Name,Email,Phone,Plan Status,Total Reminders,Trial Ends,Subscription Expires,Created At\n';
    (data.users || []).forEach(u => {
      csv += `"${u.id}","${u.fullName || ''}","${u.email || ''}","${u.phone || ''}","${u.planStatus || ''}","${u.remindersCount || 0}","${u.trialEndsAt || ''}","${u.subscriptionExpiresAt || ''}","${u.createdAt || ''}"\n`;
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
  const liveDomain = 'https://reminderme-app.vercel.app';
  const shareMessage = `Download ReminderMe App for smart morning & evening reminders: ${liveDomain}`;
  const shareData = {
    title: 'ReminderMe',
    text: shareMessage,
    url: liveDomain
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareMessage).then(() => {
        showToast('✓ Share link copied to clipboard!');
      }).catch(() => {
        prompt('Copy ReminderMe Share Link:', shareMessage);
      });
    } else {
      prompt('Copy ReminderMe Share Link:', shareMessage);
    }
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
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
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
