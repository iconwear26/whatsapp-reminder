// Reminder Me - Client Application Logic

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
    quick: 'Quick Reminder',
    custom: 'Custom Reminder',
    daily: 'Daily Reminder',
    contact: 'Remind Contact',
    whatToRemember: 'What do you want to remember?',
    saveDefault: 'Save ({time} Min Default)',
    saveCustom: 'Save Custom Reminder',
    saveDaily: 'Save Daily Reminder',
    saveContact: 'Schedule Contact Reminder',
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
    quick: 'क्विक रिमाइंडर',
    custom: 'कस्टम रिमाइंडर',
    daily: 'रोजाना रिमाइंडर',
    contact: 'कांटेक्ट को याद दिलाएं',
    whatToRemember: 'आपको क्या याद रखना है?',
    saveDefault: 'सेव करें ({time} मिनट)',
    saveCustom: 'कस्टम रिमाइंडर सेव करें',
    saveDaily: 'रोजाना रिमाइंडर सेव करें',
    saveContact: 'कांटेक्ट रिमाइंडर सेट करें',
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

// -------------------------------------------------------------
// TOAST NOTIFICATIONS & AUDIO ALARMS
// -------------------------------------------------------------
function showToast(msg, duration = 3000) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), duration);
}

function playAlarmTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
    osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  } catch (e) {}
}

// -------------------------------------------------------------
// LOCALIZATION (ENGLISH DEFAULT / HINDI DYNAMIC TOGGLE)
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

  document.getElementById('lbl-quick-heading').textContent = t.quick;
  document.getElementById('lbl-custom-heading').textContent = t.custom;
  document.getElementById('lbl-daily-heading').textContent = t.daily;
  document.getElementById('lbl-contact-heading').textContent = t.contact;
  document.getElementById('quick-input').placeholder = t.whatToRemember;

  document.getElementById('btn-custom-save').textContent = t.saveCustom;
  document.getElementById('btn-daily-save').textContent = t.saveDaily;
  document.getElementById('btn-contact-save').textContent = t.saveContact;

  document.getElementById('lbl-list-title').textContent = t.reminders;
  document.getElementById('lbl-empty-title').textContent = t.noReminders;
  document.getElementById('lbl-empty-sub').textContent = t.noRemindersSub;

  document.getElementById('lbl-plan-monthly').textContent = t.monthlyPlan;
  document.getElementById('lbl-plan-yearly').textContent = t.yearlyPlan;
  document.getElementById('btn-enable-push').textContent = t.enablePush;

  updateUserBadge();
}

langToggleBtn.addEventListener('click', () => {
  const nextLang = currentLang === 'en' ? 'hi' : 'en';
  applyLanguage(nextLang);
  showToast(nextLang === 'en' ? 'Language: English' : 'भाषा: हिन्दी');
});

// -------------------------------------------------------------
// NAVIGATION HANDLER
// -------------------------------------------------------------
function switchNav(navKey) {
  if (!authToken && navKey !== 'auth') {
    switchNav('auth');
    return;
  }

  document.querySelectorAll('.nav-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === navKey);
  });

  Object.keys(views).forEach(k => {
    views[k].classList.toggle('active', k === navKey);
  });

  if (navKey === 'list') loadReminders();
  if (navKey === 'admin') loadAdminDashboard();
}

function switchCreateMode(mode) {
  ['quick', 'custom', 'daily', 'contact'].forEach(m => {
    document.getElementById(`box-mode-${m}`).classList.toggle('hidden', m !== mode);
    document.getElementById(`tab-${m}`).classList.toggle('active', m === mode);
  });
}

// -------------------------------------------------------------
// AUTHENTICATION & NEVER LOGOUT SESSION
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

    // Never Logout Session: Store 365-day token in localStorage
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
  if (currentUser && currentUser.isOwner) {
    navAdminBtn.classList.remove('hidden');
  } else {
    navAdminBtn.classList.add('hidden');
  }
  document.getElementById('user-email-chip').textContent = currentUser.email;
  loadReminders();
}

function updateUserBadge() {
  if (!currentUser) return;
  const t = i18n[currentLang];

  if (currentUser.isOwner) {
    trialText.textContent = '👑 Owner VIP';
    trialBadge.style.background = 'rgba(15, 81, 50, 0.2)';
    trialBadge.style.color = '#0F5132';
  } else if (currentUser.planStatus === 'trial') {
    trialText.textContent = t.trialDaysLeft.replace('{days}', currentUser.trialDaysLeft || 10);
  } else {
    trialText.textContent = `Active (${currentUser.planStatus.toUpperCase()})`;
    trialBadge.style.background = 'rgba(15, 81, 50, 0.15)';
    trialBadge.style.color = '#0F5132';
  }
}

function logoutUser() {
  if (!confirm('Are you sure you want to log out?')) return;
  localStorage.removeItem('reminder_me_token');
  authToken = null;
  currentUser = null;
  switchNav('auth');
  showToast('Logged out');
}

async function deleteUserAccount() {
  const confirmEmail = prompt('To permanently delete your account and all reminders, type your email address:');
  if (!confirmEmail || confirmEmail.toLowerCase() !== currentUser.email.toLowerCase()) {
    showToast('Action cancelled: Email did not match');
    return;
  }

  try {
    const res = await fetch('/api/auth/delete-account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.ok) {
      localStorage.removeItem('reminder_me_token');
      authToken = null;
      currentUser = null;
      switchNav('auth');
      alert('Your account and personal data have been completely deleted.');
    }
  } catch (e) {
    showToast('Failed to delete account');
  }
}

// -------------------------------------------------------------
// REMINDER ENGINE (QUICK, CUSTOM, DAILY, CONTACT)
// -------------------------------------------------------------
async function quickSave(param) {
  const input = document.getElementById('quick-input');
  const message = input.value.trim();
  if (!message) {
    showToast('Please type your reminder first!');
    input.focus();
    return;
  }

  const body = { message };
  if (typeof param === 'number') body.minutes = param;
  if (typeof param === 'string') body.preset = param;

  try {
    const res = await fetch('/api/reminders/quick', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('❌ ' + (data.error || 'Failed to save'));
      if (res.status === 403) switchNav('subscription');
      return;
    }

    playAlarmTone();
    showToast(`✓ Scheduled for ${data.scheduledTime}`);
    input.value = '';
    loadReminders();
    switchNav('list');
  } catch (err) {
    showToast('❌ Error: ' + err.message);
  }
}

// Custom Date & Time Form
document.getElementById('form-custom').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('custom-title').value.trim();
  const message = document.getElementById('custom-note').value.trim();
  const reminderTime = document.getElementById('custom-datetime').value;
  const priority = document.getElementById('custom-priority').value;

  try {
    const res = await fetch('/api/reminders/custom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ title, message, reminderTime, priority })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('❌ ' + (data.error || 'Failed to save'));
      return;
    }

    playAlarmTone();
    showToast('✓ Custom reminder saved!');
    document.getElementById('form-custom').reset();
    loadReminders();
    switchNav('list');
  } catch (err) {
    showToast('❌ ' + err.message);
  }
});

// Daily Recurring Form
document.getElementById('form-daily').addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = document.getElementById('daily-msg').value.trim();
  const time = document.getElementById('daily-time').value;
  const endDate = document.getElementById('daily-enddate').value;

  try {
    const res = await fetch('/api/reminders/daily', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ message, time, endDate })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('❌ ' + (data.error || 'Failed to save'));
      return;
    }

    playAlarmTone();
    showToast('✓ Daily recurring reminder scheduled!');
    document.getElementById('form-daily').reset();
    loadReminders();
    switchNav('list');
  } catch (err) {
    showToast('❌ ' + err.message);
  }
});

// Remind Contact Form
document.getElementById('form-contact').addEventListener('submit', async (e) => {
  e.preventDefault();
  const contactName = document.getElementById('contact-name').value.trim();
  const contactPhone = document.getElementById('contact-phone').value.trim();
  const message = document.getElementById('contact-msg').value.trim();
  const reminderTime = document.getElementById('contact-datetime').value;

  try {
    const res = await fetch('/api/reminders/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ contactName, contactPhone, message, reminderTime })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('❌ ' + (data.error || 'Failed to save'));
      return;
    }

    playAlarmTone();
    showToast(`✓ Reminder scheduled for ${contactName}!`);
    document.getElementById('form-contact').reset();
    loadReminders();
    switchNav('list');
  } catch (err) {
    showToast('❌ ' + err.message);
  }
});

// Load Reminders List
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
    const contactBadge = r.targetContactName ? `<span class="pill-tag" style="background:rgba(249,115,22,0.12); color:#F97316;">To: ${r.targetContactName}</span>` : '';
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
            <button class="mini-btn mini-send" onclick="triggerReminderNow('${r.id}')" title="Test Send">📲 Send</button>
            <button class="mini-btn mini-delete" onclick="deleteReminder('${r.id}')" title="Delete">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function triggerReminderNow(id) {
  try {
    showToast('Sending WhatsApp & Push...');
    const res = await fetch(`/api/reminders/${id}/trigger`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (res.ok) {
      playAlarmTone();
      showToast('✓ Alert dispatched!');
    } else {
      showToast('❌ ' + (data.error || 'Failed'));
    }
  } catch (e) {
    showToast('Error sending reminder');
  }
}

async function deleteReminder(id) {
  try {
    const res = await fetch(`/api/reminders/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.ok) {
      showToast('Deleted');
      loadReminders();
    }
  } catch (e) {
    showToast('Error deleting reminder');
  }
}

// -------------------------------------------------------------
// SUBSCRIPTION & RAZORPAY AUTOPAY
// -------------------------------------------------------------
function selectPlan(plan) {
  selectedPlan = plan;
  document.getElementById('card-plan-monthly').classList.toggle('selected', plan === 'monthly');
  document.getElementById('card-plan-yearly').classList.toggle('selected', plan === 'yearly');
}

async function startRazorpayAutopay() {
  try {
    showToast('Initializing Autopay...');
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
      amount: data.amountPaise,
      currency: data.currency,
      name: 'Reminder Me',
      description: data.description,
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
            subscriptionId: response.razorpay_subscription_id
          })
        });
        const verifyData = await verifyRes.json();
        if (verifyRes.ok) {
          playAlarmTone();
          showToast('🎉 ' + verifyData.message);
          checkSession();
        } else {
          showToast('Verification failed');
        }
      },
      prefill: {
        name: currentUser.fullName,
        email: currentUser.email,
        contact: currentUser.phone
      },
      theme: { color: '#0F5132' }
    };

    // Open Razorpay Modal
    if (typeof Razorpay !== 'undefined') {
      const rzp = new Razorpay(options);
      rzp.open();
    } else {
      // In sandbox/testing mode if razorpay script not loaded:
      const mockPayId = 'pay_' + Date.now();
      const verifyRes = await fetch('/api/subscription/verify-autopay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ planType: selectedPlan, paymentId: mockPayId })
      });
      showToast('✓ Autopay subscription activated (Simulated)');
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
      playAlarmTone();
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
    const vapidRes = await fetch('/api/push/vapid-key');
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

    playAlarmTone();
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
  if (!currentUser || !currentUser.isOwner) return;

  try {
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) return;

    document.getElementById('stat-total-users').textContent = data.stats.totalUsers;
    document.getElementById('stat-active-trials').textContent = data.stats.activeTrials;
    document.getElementById('stat-autopay-users').textContent = data.stats.activeAutopay;
    document.getElementById('stat-revenue').textContent = `₹${data.stats.totalRevenue}`;

    const tbody = document.getElementById('admin-users-tbody');
    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td><strong>${escapeHtml(u.fullName)}</strong></td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.phone)}</td>
        <td><span class="pill-tag" style="font-size:10px;">${u.planStatus.toUpperCase()}</span></td>
        <td>${u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).toLocaleDateString() : (u.isOwner ? 'VIP Lifetime' : '10-Day Trial')}</td>
      </tr>
    `).join('');

    checkAdminWhatsAppStatus();
  } catch (err) {
    console.error('Admin dashboard error:', err);
  }
}

async function checkAdminWhatsAppStatus() {
  try {
    const res = await fetch('/api/whatsapp/status');
    const data = await res.json();
    const statusText = document.getElementById('admin-wa-status');
    const qrImg = document.getElementById('admin-wa-qr');

    if (data.isConnected) {
      statusText.innerHTML = `🟢 <strong>Connected as:</strong> +${data.phone}`;
      qrImg.style.display = 'none';
    } else {
      statusText.innerHTML = '⚠️ <strong>WhatsApp Disconnected.</strong> Scan QR below:';
      if (data.qrImage) {
        qrImg.src = data.qrImage;
        qrImg.style.display = 'block';
      }
    }
  } catch (e) {}
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
        '<strong>New Codes:</strong><br>' + data.createdCodes.join('<br>');
      showToast('Generated 3 single-use coupons');
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
    text: 'Try Reminder Me - Get automated task & medicine reminders directly on your WhatsApp and Lock Screen!',
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
