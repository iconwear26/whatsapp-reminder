// WhatsApp Reminder App - Client Logic

let currentReminders = [];
let currentFilter = 'all';
let mobileUrl = '';
let currentDefaultDelay = 15;
let currentDailyEndMode = 'forever';

// DOM Elements
const views = {
  add: document.getElementById('view-add'),
  list: document.getElementById('view-list'),
  settings: document.getElementById('view-settings'),
  guide: document.getElementById('view-guide')
};

const navItems = document.querySelectorAll('.nav-item');
const quickReminderForm = document.getElementById('quick-reminder-form');
const dailyReminderForm = document.getElementById('daily-reminder-form');
const customReminderForm = document.getElementById('reminder-form');
const settingsForm = document.getElementById('settings-form');
const statusPill = document.getElementById('status-pill');
const statusText = document.getElementById('status-text');
const remindersContainer = document.getElementById('reminders-container');
const emptyState = document.getElementById('empty-state');
const toastEl = document.getElementById('toast');
const qrBtn = document.getElementById('qr-btn');
const qrModal = document.getElementById('qr-modal');
const testWaBtn = document.getElementById('test-wa-btn');
const disconnectWaBtn = document.getElementById('disconnect-wa-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIcon = document.getElementById('theme-icon');

// Direct WhatsApp elements
const waQrSection = document.getElementById('wa-qr-section');
const waConnectedSection = document.getElementById('wa-connected-section');
const waConnectQrImg = document.getElementById('wa-connect-qr-img');
const waQrLoading = document.getElementById('wa-qr-loading');
const connectedUserPhone = document.getElementById('connected-user-phone');

// Theme Management (Dark / Light Mode)
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = current === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      showToast(newTheme === 'dark' ? '🌙 Dark Mode On' : '☀️ Light Mode On');
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (themeIcon) {
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

// Audio Chime
function playChimeSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.log('Audio chime error:', e);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupNavigation();
  setupVoiceInputs();
  setDefaultDateTime();
  loadSettings();
  loadReminders();
  loadNetworkInfo();
  checkWhatsAppStatus();

  // Set default min date for end date picker to tomorrow
  const endInput = document.getElementById('daily-end-date-input');
  if (endInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    endInput.min = tomorrow.toISOString().split('T')[0];
  }

  setInterval(checkWhatsAppStatus, 3000);
  setInterval(loadReminders, 12000);
});

// Toast notification
function showToast(message, duration = 3000) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
  }, duration);
}

// 3-Way Mode Switcher (Quick, Daily, Custom)
function toggleFormMode(mode) {
  const quickBox = document.getElementById('quick-reminder-box');
  const dailyBox = document.getElementById('daily-reminder-box');
  const customBox = document.getElementById('custom-reminder-box');
  const btnQuick = document.getElementById('tab-quick-mode');
  const btnDaily = document.getElementById('tab-daily-mode');
  const btnCustom = document.getElementById('tab-custom-mode');

  quickBox.classList.add('hidden');
  dailyBox.classList.add('hidden');
  customBox.classList.add('hidden');

  btnQuick.classList.remove('active');
  btnDaily.classList.remove('active');
  btnCustom.classList.remove('active');

  if (mode === 'quick') {
    quickBox.classList.remove('hidden');
    btnQuick.classList.add('active');
    document.getElementById('quick-msg-input').focus();
  } else if (mode === 'daily') {
    dailyBox.classList.remove('hidden');
    btnDaily.classList.add('active');
    document.getElementById('daily-msg-input').focus();
  } else {
    customBox.classList.remove('hidden');
    btnCustom.classList.add('active');
    document.getElementById('reminder-title').focus();
  }
}

// Daily Reminder Helpers
function setDailyTime(timeStr) {
  document.getElementById('daily-time-input').value = timeStr;
  showToast(`Roz ka samay: ${timeStr} set kiya gaya`);
}

function toggleDailyEndMode(mode) {
  currentDailyEndMode = mode;
  const btnForever = document.getElementById('btn-end-forever');
  const btnDate = document.getElementById('btn-end-date');
  const dateWrapper = document.getElementById('daily-end-date-wrapper');

  if (mode === 'forever') {
    btnForever.classList.add('active');
    btnDate.classList.remove('active');
    dateWrapper.classList.add('hidden');
  } else {
    btnForever.classList.remove('active');
    btnDate.classList.add('active');
    dateWrapper.classList.remove('hidden');
    document.getElementById('daily-end-date-input').focus();
  }
}

// Set default datetime to 30 mins from now in custom form
function setDefaultDateTime() {
  const dateInput = document.getElementById('reminder-time');
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  dateInput.value = formatDateTimeLocal(now);
}

function formatDateTimeLocal(date) {
  const pad = (n) => (n < 10 ? '0' + n : n);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Check WhatsApp connection status & display pre-rendered QR Image
async function checkWhatsAppStatus() {
  try {
    const res = await fetch('/api/whatsapp/status');
    const data = await res.json();

    if (data.isConnected) {
      statusText.textContent = 'WhatsApp Connected';
      statusPill.className = 'status-pill status-connected';

      waQrSection.classList.add('hidden');
      waConnectedSection.classList.remove('hidden');
      connectedUserPhone.textContent = data.phone ? `Sender Account: +${data.phone}` : 'Sender Account: Connected';
    } else {
      statusText.textContent = 'WhatsApp Scan QR';
      statusPill.className = 'status-pill status-disconnected';

      waConnectedSection.classList.add('hidden');
      waQrSection.classList.remove('hidden');

      if (data.qrImage) {
        waQrLoading.classList.add('hidden');
        waConnectQrImg.classList.remove('hidden');
        if (waConnectQrImg.src !== data.qrImage) {
          waConnectQrImg.src = data.qrImage;
        }
      } else {
        waConnectQrImg.classList.add('hidden');
        waQrLoading.classList.remove('hidden');
      }
    }
  } catch (err) {
    console.error('Error checking WhatsApp status:', err);
  }
}

// Navigation between tabs
function setupNavigation() {
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.dataset.view;
      switchTab(viewName);
    });
  });

  const filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderReminders();
    });
  });
}

function switchTab(viewName) {
  navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });

  Object.keys(views).forEach(key => {
    views[key].classList.toggle('active', key === viewName);
  });

  if (viewName === 'list') {
    loadReminders();
  }
  if (viewName === 'settings') {
    checkWhatsAppStatus();
  }
}

// Voice-to-Text Input Setup
function setupVoiceInputs() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const qv = document.getElementById('quick-voice-btn');
    const dv = document.getElementById('daily-voice-btn');
    const cv = document.getElementById('voice-btn');
    if (qv) qv.style.display = 'none';
    if (dv) dv.style.display = 'none';
    if (cv) cv.style.display = 'none';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'hi-IN';
  recognition.interimResults = false;

  let activeTargetInput = null;
  let activeVoiceBtn = null;

  function handleVoiceClick(targetInput, btn) {
    try {
      activeTargetInput = targetInput;
      activeVoiceBtn = btn;
      showToast('🎙️ Bolna shuru kijiye...');
      btn.textContent = '🔴';
      recognition.start();
    } catch (e) {
      recognition.stop();
    }
  }

  const quickVoice = document.getElementById('quick-voice-btn');
  const dailyVoice = document.getElementById('daily-voice-btn');
  const customVoice = document.getElementById('voice-btn');

  if (quickVoice) {
    quickVoice.addEventListener('click', () => {
      handleVoiceClick(document.getElementById('quick-msg-input'), quickVoice);
    });
  }

  if (dailyVoice) {
    dailyVoice.addEventListener('click', () => {
      handleVoiceClick(document.getElementById('daily-msg-input'), dailyVoice);
    });
  }

  if (customVoice) {
    customVoice.addEventListener('click', () => {
      handleVoiceClick(document.getElementById('reminder-title'), customVoice);
    });
  }

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (activeTargetInput) {
      activeTargetInput.value = transcript;
    }
    showToast(`Pehchana: "${transcript}"`);
  };

  recognition.onend = () => {
    if (activeVoiceBtn) activeVoiceBtn.textContent = '🎙️';
  };

  recognition.onerror = () => {
    if (activeVoiceBtn) activeVoiceBtn.textContent = '🎙️';
    showToast('Voice read nahi ho paya.');
  };
}

// ⚡ 1-CLICK QUICK REMINDER SAVE
async function saveQuickReminder(param) {
  const msgInput = document.getElementById('quick-msg-input');
  const message = msgInput.value.trim();

  if (!message) {
    showToast('⚠️ Pehle yahan reminder ka message likhein!');
    msgInput.focus();
    return;
  }

  let body = {};
  if (typeof param === 'number') {
    body = { message, minutes: param };
  } else if (typeof param === 'string') {
    body = { message, preset: param };
  } else {
    body = { message, minutes: currentDefaultDelay };
  }

  const saveBtn = document.getElementById('quick-save-btn');
  saveBtn.disabled = true;

  try {
    const res = await fetch('/api/reminders/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (res.ok) {
      playChimeSound();
      showToast(`🎉 Reminder save ho gaya! Agla reminder: ${data.scheduledTime}`);
      msgInput.value = '';
      loadReminders();
      switchTab('list');
    } else {
      showToast('❌ Error: ' + (data.error || 'Nahi ho saka'));
    }
  } catch (err) {
    showToast('❌ Error: ' + err.message);
  } finally {
    saveBtn.disabled = false;
  }
}

quickReminderForm.addEventListener('submit', (e) => {
  e.preventDefault();
  saveQuickReminder(currentDefaultDelay);
});

// 🔁 DAILY FIX TIME REMINDER FORM SUBMIT
dailyReminderForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const msgInput = document.getElementById('daily-msg-input');
  const message = msgInput.value.trim();
  const time = document.getElementById('daily-time-input').value;
  let endDate = null;

  if (currentDailyEndMode === 'date') {
    endDate = document.getElementById('daily-end-date-input').value;
    if (!endDate) {
      showToast('⚠️ Kripya aakhiri tarikh (End Date) chunein!');
      return;
    }
  }

  if (!message) {
    showToast('⚠️ Kripya reminder ka message likhein.');
    return;
  }

  const saveBtn = document.getElementById('save-daily-btn');
  saveBtn.disabled = true;

  try {
    const res = await fetch('/api/reminders/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, time, endDate })
    });
    const data = await res.json();

    if (res.ok) {
      playChimeSound();
      showToast(`🎉 ${data.message}`);
      dailyReminderForm.reset();
      document.getElementById('daily-time-input').value = '08:00';
      toggleDailyEndMode('forever');
      loadReminders();
      switchTab('list');
    } else {
      showToast('❌ Error: ' + (data.error || 'Nahi ho saka'));
    }
  } catch (err) {
    showToast('❌ Error: ' + err.message);
  } finally {
    saveBtn.disabled = false;
  }
});

// 🛠️ CUSTOM DETAILED REMINDER FORM SUBMIT
customReminderForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('reminder-title').value.trim();
  const message = document.getElementById('reminder-msg').value.trim();
  const category = document.getElementById('reminder-category').value;
  const priority = document.getElementById('reminder-priority').value;
  const reminderTime = document.getElementById('reminder-time').value;

  if (!title) {
    showToast('⚠️ Kripya reminder title bharein.');
    return;
  }
  if (!reminderTime) {
    showToast('⚠️ Kripya date & time chunein.');
    return;
  }

  const saveBtn = document.getElementById('save-reminder-btn');
  saveBtn.disabled = true;

  try {
    const res = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        message: message || title,
        category,
        priority,
        reminderTime: new Date(reminderTime).toISOString()
      })
    });

    const data = await res.json();
    if (res.ok) {
      playChimeSound();
      showToast('🎉 Reminder save ho gaya!');
      customReminderForm.reset();
      setDefaultDateTime();
      switchTab('list');
      loadReminders();
    } else {
      showToast('❌ Error: ' + (data.error || 'Nahi ho saka'));
    }
  } catch (err) {
    showToast('❌ Network error: ' + err.message);
  } finally {
    saveBtn.disabled = false;
  }
});

// Load Settings
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();

    if (data.recipientPhone) {
      document.getElementById('settings-recipient').value = data.recipientPhone;
    }
    if (data.defaultDelayMinutes) {
      currentDefaultDelay = data.defaultDelayMinutes;
      document.getElementById('settings-default-delay').value = data.defaultDelayMinutes;
      const btnTime = document.getElementById('btn-default-time');
      if (btnTime) btnTime.textContent = `${data.defaultDelayMinutes} Min`;
    }
    if (data.defaultPriority) {
      document.getElementById('settings-default-priority').value = data.defaultPriority;
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

// Save Settings Form
settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const recipientPhone = document.getElementById('settings-recipient').value.trim();
  const defaultDelayMinutes = document.getElementById('settings-default-delay').value;
  const defaultPriority = document.getElementById('settings-default-priority').value;

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientPhone,
        defaultDelayMinutes,
        defaultPriority
      })
    });
    if (res.ok) {
      currentDefaultDelay = parseInt(defaultDelayMinutes, 10);
      const btnTime = document.getElementById('btn-default-time');
      if (btnTime) btnTime.textContent = `${currentDefaultDelay} Min`;
      playChimeSound();
      showToast('✅ Settings save ho gayi!');
    }
  } catch (err) {
    showToast('❌ Error: ' + err.message);
  }
});

// Test WhatsApp Button
testWaBtn.addEventListener('click', async () => {
  testWaBtn.disabled = true;
  testWaBtn.textContent = 'Bheja ja raha hai...';

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testNow: true })
    });
    const data = await res.json();

    if (res.ok) {
      playChimeSound();
      showToast('🎉 WhatsApp par test message bhej diya gaya! Check karein.');
    } else {
      showToast('❌ ' + (data.error || 'Nahi bhej paye'));
    }
  } catch (err) {
    showToast('❌ Error: ' + err.message);
  } finally {
    testWaBtn.disabled = false;
    testWaBtn.textContent = '📲 WhatsApp Par Test Message Bhejo';
  }
});

// Disconnect WhatsApp
if (disconnectWaBtn) {
  disconnectWaBtn.addEventListener('click', async () => {
    if (!confirm('Kya aap WhatsApp logout karna chahte hain?')) return;
    try {
      showToast('Disconnecting...');
      await fetch('/api/whatsapp/logout', { method: 'POST' });
      showToast('Disconnected. Naya QR scan karein.');
      checkWhatsAppStatus();
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  });
}

// Load Reminders
async function loadReminders() {
  try {
    const res = await fetch('/api/reminders');
    currentReminders = await res.json();
    updateCounts();
    renderReminders();
  } catch (err) {
    console.error('Error loading reminders:', err);
  }
}

function updateCounts() {
  const allCount = currentReminders.length;
  const pendingCount = currentReminders.filter(r => r.status === 'pending' && r.repeat !== 'daily').length;
  const dailyCount = currentReminders.filter(r => r.repeat === 'daily' && r.status === 'pending').length;
  const sentCount = currentReminders.filter(r => r.status === 'sent' || r.status === 'completed').length;

  document.getElementById('count-all').textContent = allCount;
  document.getElementById('count-pending').textContent = pendingCount;
  document.getElementById('count-daily').textContent = dailyCount;
  document.getElementById('count-sent').textContent = sentCount;
}

// Render Reminders
function renderReminders() {
  let list = currentReminders;
  if (currentFilter === 'pending') {
    list = list.filter(r => r.status === 'pending' && r.repeat !== 'daily');
  } else if (currentFilter === 'daily') {
    list = list.filter(r => r.repeat === 'daily');
  } else if (currentFilter === 'sent') {
    list = list.filter(r => r.status === 'sent' || r.status === 'completed');
  }

  if (list.length === 0) {
    remindersContainer.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  remindersContainer.innerHTML = list.map(item => {
    const remDate = new Date(item.reminderTime);
    const dateFormatted = remDate.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    const isDaily = item.repeat === 'daily';
    const isPending = item.status === 'pending';
    const isSent = item.status === 'sent';
    const isCompleted = item.status === 'completed';

    const categoryIcons = {
      personal: '👤 Personal',
      work: '💼 Work',
      health: '💊 Health',
      bill: '💰 Bill',
      other: '📌 Other'
    };

    let statusBadgeHtml = '';
    if (isDaily && isPending) {
      statusBadgeHtml = `<span class="tag tag-daily">🔁 Rozana (${item.repeatTime || 'Fix Time'})</span>`;
    } else if (isPending) {
      statusBadgeHtml = `<span class="tag tag-status-pending">⏳ Scheduled</span>`;
    } else if (isCompleted) {
      statusBadgeHtml = `<span class="tag tag-status-completed">🏁 Completed</span>`;
    } else if (isSent) {
      statusBadgeHtml = `<span class="tag tag-status-sent">✅ WhatsApp Sent</span>`;
    } else {
      statusBadgeHtml = `<span class="tag tag-status-failed">❌ Failed</span>`;
    }

    const sentCountBadge = isDaily && item.sentCount > 0 ? `<span class="tag tag-category">Sent: ${item.sentCount} bar</span>` : '';
    const endBadge = item.endDate ? `<span class="tag tag-category">📅 End: ${new Date(item.endDate).toLocaleDateString('en-IN')}</span>` : '';

    return `
      <div class="reminder-card" data-id="${item.id}">
        <div class="reminder-top">
          <div class="reminder-info">
            <div class="reminder-title">${escapeHtml(item.title)}</div>
            ${item.message && item.message !== item.title ? `<div class="reminder-details">${escapeHtml(item.message)}</div>` : ''}
            <div class="reminder-tags">
              ${statusBadgeHtml}
              ${sentCountBadge}
              ${endBadge}
              <span class="tag tag-priority-${item.priority}">${(item.priority || 'NORMAL').toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div class="reminder-time-box">
          <span>${isDaily ? '🕒 Agla Reminder:' : '🕒 Reminder Time:'}</span>
          <strong>${dateFormatted}</strong>
        </div>

        <div class="reminder-actions">
          <button class="action-btn-sm btn-send-now" onclick="triggerReminderNow('${item.id}')" title="Send now to WhatsApp">
            📲 Abhi Bhejo
          </button>
          <button class="action-btn-sm btn-danger" onclick="deleteReminder('${item.id}')" title="Delete">
            🗑️ Delete
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Trigger Reminder Now
async function triggerReminderNow(id) {
  try {
    showToast('📲 WhatsApp par bhej rahe hain...');
    const res = await fetch(`/api/reminders/${id}/trigger`, {
      method: 'POST'
    });
    const data = await res.json();

    if (res.ok) {
      playChimeSound();
      showToast('✅ WhatsApp reminder bhej diya gaya!');
      loadReminders();
    } else {
      showToast('❌ Error: ' + (data.error || 'Failed to send'));
    }
  } catch (err) {
    showToast('❌ Error: ' + err.message);
  }
}

// Delete Reminder
async function deleteReminder(id) {
  if (!confirm('Kya aap ye reminder delete karna chahte hain?')) return;

  try {
    const res = await fetch(`/api/reminders/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToast('🗑️ Reminder delete ho gaya');
      loadReminders();
    } else {
      showToast('❌ Delete nahi ho saka');
    }
  } catch (err) {
    showToast('❌ Error: ' + err.message);
  }
}

// Load Network IP & Render QR
async function loadNetworkInfo() {
  try {
    const res = await fetch('/api/network-info');
    const data = await res.json();

    mobileUrl = data.mobileUrl;
    document.getElementById('mobile-url-display').textContent = mobileUrl;
    document.getElementById('modal-url-text').textContent = mobileUrl;

    if (data.mobileUrlQR) {
      const mobileQrImg = document.getElementById('mobile-qr-img');
      const modalQrImg = document.getElementById('modal-qr-img');
      if (mobileQrImg) mobileQrImg.src = data.mobileUrlQR;
      if (modalQrImg) modalQrImg.src = data.mobileUrlQR;
    }
  } catch (err) {
    console.error('Error fetching network info:', err);
  }
}

// QR Modal toggling
if (qrBtn) {
  qrBtn.addEventListener('click', () => {
    qrModal.classList.remove('hidden');
  });
}

function closeQRModal() {
  qrModal.classList.add('hidden');
}

function copyMobileUrl() {
  copyText(mobileUrl);
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Copied: ' + text);
  }).catch(() => {
    showToast('Copied: ' + text);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration failed:', err);
    });
  });
}
