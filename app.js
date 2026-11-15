/* ===== XENOVA — app.js ===== */
'use strict';

// ============================================================
// CONSTANTS & CONFIG
// ============================================================
const LS_MEMBERS    = 'xenova_members';
const LS_MEETINGS   = 'xenova_meetings';
const LS_PROJECTS   = 'xenova_projects';
const LS_CURRENT_USER = 'xenova_current_user';
const LS_THEME      = 'xenova_theme';
const LS_CUSTOM     = 'xenova_custom_theme';
const LS_ACTIVITY   = 'xenova_activity';
const LS_COMPACT    = 'xenova_sidebar_compact';
const LS_BRIGHTNESS = 'xenova_brightness';
const LS_LANG       = 'xenova_lang';
const LS_TIMETABLE  = 'xenova_timetable_tasks';
const LS_AUTH_USERS = 'xenova_auth_users';
const LS_AUTH_SESSION = 'xenova_auth_session';
const LS_CLOUD_CONFIG = 'xenova_cloud_config';

const THEMES = {
  'white-blue': {
    '--bg': '#F8FAFF',
    '--primary': '#1A73E8',
    '--secondary': '#0D47A1',
    '--surface': '#FFFFFF',
    '--text': '#1a1a2e',
    '--text-secondary': '#5f6368',
    '--accent': '#4285F4',
    '--border': '#E8ECF4',
    name: 'White & Blue',
    emoji: '🔵'
  },
  'dark': {
    '--bg': '#0f0f1a',
    '--primary': '#6366f1',
    '--secondary': '#4f46e5',
    '--surface': '#1e1e2e',
    '--text': '#e2e8f0',
    '--text-secondary': '#94a3b8',
    '--accent': '#818cf8',
    '--border': '#2d2d44',
    name: 'Dark Mode',
    emoji: '🌑'
  },
  'purple': {
    '--bg': '#f5f0ff',
    '--primary': '#7c3aed',
    '--secondary': '#5b21b6',
    '--surface': '#ffffff',
    '--text': '#1a1a2e',
    '--text-secondary': '#6b7280',
    '--accent': '#8b5cf6',
    '--border': '#ede9fe',
    name: 'Purple',
    emoji: '💜'
  },
  'pink': {
    '--bg': '#fff0f6',
    '--primary': '#ec4899',
    '--secondary': '#be185d',
    '--surface': '#ffffff',
    '--text': '#1a1a2e',
    '--text-secondary': '#6b7280',
    '--accent': '#f472b6',
    '--border': '#fce7f3',
    name: 'Pink',
    emoji: '🩷'
  },
  'green': {
    '--bg': '#f0fdf4',
    '--primary': '#059669',
    '--secondary': '#047857',
    '--surface': '#ffffff',
    '--text': '#1a1a2e',
    '--text-secondary': '#6b7280',
    '--accent': '#10b981',
    '--border': '#d1fae5',
    name: 'Green',
    emoji: '💚'
  }
};

const AVATAR_COLORS = [
  '#1A73E8','#7c3aed','#ec4899','#059669','#f59e0b',
  '#ef4444','#06b6d4','#8b5cf6','#10b981','#f97316',
  '#6366f1','#14b8a6','#e11d48','#0ea5e9','#84cc16'
];

// ============================================================
// STATE
// ============================================================
let currentPage = 'dashboard';
let currentView = 'list';
let calendarDate = new Date();
let weekStartDate = getWeekStart(new Date());
let selectedDay = null;
let countdownInterval = null;
let notifInterval = null;
let currentProfileId = null;
let confirmCallback = null;
let isSidebarCompact = false;
let currentLang = localStorage.getItem(LS_LANG) || 'th';
let timetableViewMode = 'cards'; // 'cards' (mockup-style), 'weekly' (grid), 'daily'
let timetableWeekStart = getMondayOfWeek(new Date());
let currentTimetableTaskId = null;
let currentAuthTab = 'signin';
let failedLoginAttempts = 0;
let lockoutUntil = 0;

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const locale = getLocaleCode(currentLang);
  return d.toLocaleDateString(locale, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

function formatDateTime(dateStr, timeStr) {
  return `${formatDate(dateStr)} at ${formatTime(timeStr)}`;
}

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('time.just_now');
  if (mins < 60) return t('time.m_ago', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('time.h_ago', { n: hrs });
  const days = Math.floor(hrs / 24);
  return t('time.d_ago', { n: days });
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function getMondayOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getMeetingDateTime(meeting) {
  return new Date(`${meeting.date}T${meeting.time || '00:00'}`);
}

function getMeetingStatus(meeting) {
  const now = new Date();
  const mdt = getMeetingDateTime(meeting);
  const endTime = new Date(mdt.getTime() + (meeting.duration || 60) * 60000);
  const today = new Date();
  today.setHours(0,0,0,0);
  const mDate = new Date(meeting.date + 'T00:00:00');

  if (endTime < now) return 'past';
  if (mDate.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// LOCAL STORAGE
// ============================================================
function loadData(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveData(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) { console.error('Storage error', e); }
}

function getMembers() { return loadData(LS_MEMBERS, []); }
function saveMembers(d) { saveData(LS_MEMBERS, d); }
function getMeetings() { return loadData(LS_MEETINGS, []); }
function saveMeetings(d) { saveData(LS_MEETINGS, d); }
function getProjects() { return loadData(LS_PROJECTS, []); }
function saveProjects(d) { saveData(LS_PROJECTS, d); }

// ============================================================
// CURRENT USER / PERMISSIONS
// ============================================================
function getCurrentUser() {
  return loadData(LS_CURRENT_USER, { id: 'admin', name: 'Admin', role: 'admin' });
}

function setCurrentUser(user) {
  saveData(LS_CURRENT_USER, user);
  updateCurrentUserUI();
}

function updateCurrentUserUI() {
  const user = getCurrentUser();
  const avatarEl = document.getElementById('current-user-avatar');
  const nameEl = document.getElementById('current-user-name');
  const roleEl = document.getElementById('current-user-role');
  if (avatarEl) avatarEl.textContent = user.role === 'admin' ? 'A' : getInitials(user.name);
  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = user.role === 'admin' ? t('sidebar.group_manager') : (user.position || t('sidebar.member_role'));

  // Topbar user account info
  const topbarAvatar = document.getElementById('topbar-user-avatar');
  const topbarName = document.getElementById('topbar-user-name');
  const menuName = document.getElementById('menu-user-name');
  const menuEmail = document.getElementById('menu-user-email');
  if (topbarAvatar) topbarAvatar.textContent = user.role === 'admin' ? 'A' : getInitials(user.name);
  if (topbarName) topbarName.textContent = user.name;
  if (menuName) menuName.textContent = user.name;
  if (menuEmail) menuEmail.textContent = user.email || (user.role === 'admin' ? 'admin@xenova.com' : 'user@xenova.com');
}

function canEditMember(memberId) {
  const user = getCurrentUser();
  if (user.role === 'admin') return true;
  return user.id === memberId;
}

function canManageProject(project) {
  const user = getCurrentUser();
  if (user.role === 'admin') return true;
  return project && project.memberId === user.id;
}

function isSafeUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ============================================================
// ACTIVITY LOG
// ============================================================
function addActivity(message, type = 'info') {
  const activities = loadData(LS_ACTIVITY, []);
  activities.unshift({ id: generateId(), message, type, createdAt: new Date().toISOString() });
  if (activities.length > 20) activities.length = 20;
  saveData(LS_ACTIVITY, activities);
}

function clearActivity() {
  saveData(LS_ACTIVITY, []);
  renderActivityFeed();
  showToast('Activity log cleared', 'info');
}

// ============================================================
// SAMPLE DATA
// ============================================================
function loadSampleData() {
  const existing = localStorage.getItem(LS_MEMBERS);
  if (existing !== null) {
    const parsed = JSON.parse(existing);
    const hasExact = parsed.some(m => m.name === 'AUMIM');
    if (hasExact && parsed.length === 4) return;
  }

  // Exact 4 Team Members from User's Vercel Portfolio design:
  // 1. AUMIM - "KEEPS ORBIT STABLE"
  // 2. TAETAE - "BUILDS IN SILENCE"
  // 3. PROUD - "SEES WHAT OTHERS MISS"
  // 4. NOTEBOOK - "NEWEST TRANSMISSION"
  const members = [
    {
      id: 'mem_aumim',
      name: 'AUMIM',
      position: 'KEEPS ORBIT STABLE',
      bio: 'เสาหลักในการควบคุมวงโคจรของโปรเจกต์ ดูแลความเสถียรและความเรียบร้อยของทีม XENOVA',
      responsibilities: ['Orbit Stability', 'Core Operations', 'Team Harmony', 'System Review'],
      skills: ['Leadership', 'Operations', 'Quality Control', 'Project Planning'],
      email: 'aumim@xenova.dev',
      phone: '+66 81 111 2222',
      photo: 'mem_aumim.webp',
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com',
      color: '#3B82F6',
      createdAt: new Date().toISOString()
    },
    {
      id: 'mem_taetae',
      name: 'TAETAE',
      position: 'BUILDS IN SILENCE',
      bio: 'นักสร้างสรรค์และนักพัฒนาผู้ลงมือทำอย่างเงียบเชียบ เบื้องหลังระบบประสิทธิภาพสูงของ XENOVA',
      responsibilities: ['Architecture Building', 'Core Engineering', 'Silent Crafting'],
      skills: ['System Design', 'Backend Development', 'Clean Code', 'Performance Tuning'],
      email: 'taetae@xenova.dev',
      phone: '+66 82 222 3333',
      photo: 'mem_taetae.jpg',
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com',
      color: '#10B981',
      createdAt: new Date().toISOString()
    },
    {
      id: 'mem_proud',
      name: 'PROUD',
      position: 'SEES WHAT OTHERS MISS',
      bio: 'ผู้สังเกตการณ์ที่มองเห็นในจุดที่คนอื่นมองข้าม ละเอียดถี่ถ้วนในงานวิชวลและประสบการณ์ผู้ใช้',
      responsibilities: ['Visual Quality Assurance', 'UI/UX Oversight', 'User Journey Testing'],
      skills: ['UX Observation', 'Attention to Detail', 'Design Review', 'Interaction Design'],
      email: 'proud@xenova.dev',
      phone: '+66 83 333 4444',
      photo: 'mem_proud.jpg',
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com',
      color: '#EC4899',
      createdAt: new Date().toISOString()
    },
    {
      id: 'mem_notebook',
      name: 'NOTEBOOK',
      position: 'NEWEST TRANSMISSION',
      bio: 'สัญญาณคลื่นลูกใหม่แห่ง XENOVA รังสรรค์ไอเดียสดใหม่ งานกราฟิก และมิติใหม่ของผลิตภัณฑ์',
      responsibilities: ['New Transmissions', 'Creative Ideas', 'Graphic System', 'Visual Identity'],
      skills: ['Pixel Art', 'Brand Identity', 'Typography', 'Creative Exploration'],
      email: 'notebook@xenova.dev',
      phone: '+66 84 444 5555',
      photo: 'mem_notebook.jpg',
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com',
      color: '#EF4444',
      createdAt: new Date().toISOString()
    }
  ];

  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(now); nextWeek.setDate(nextWeek.getDate() + 5);
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);

  const fmtDate = d => d.toISOString().split('T')[0];

  const meetings = [
    {
      id: generateId(),
      title: 'Weekly Team Standup',
      date: fmtDate(tomorrow),
      time: '09:00',
      duration: 30,
      location: 'Google Meet',
      description: 'Weekly sync to discuss progress, blockers, and priorities.',
      attendeeIds: members.map(m => m.id),
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: generateId(),
      title: 'Sprint Planning Q4',
      date: fmtDate(nextWeek),
      time: '14:00',
      duration: 120,
      location: 'Conference Room B',
      description: 'Plan sprint goals and task breakdown for Q4 deliverables.',
      attendeeIds: members.slice(0, 3).map(m => m.id),
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    {
      id: generateId(),
      title: 'Design Review Session',
      date: fmtDate(yesterday),
      time: '11:00',
      duration: 60,
      location: 'Zoom',
      description: 'Review and feedback on new dashboard designs.',
      attendeeIds: members.slice(0, 2).map(m => m.id),
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
    }
  ];

  const sampleProjects = [
    {
      id: generateId(),
      memberId: members[0].id, // AUMIM
      title: 'Orbit Stabilization & Core Operations',
      cover: 'mem_aumim.webp',
      desc: 'ควบคุมระบบและวงโคจรการดำเนินงานทั้งหมดของ XENOVA มั่นใจในความเสถียรและความพร้อมใช้งาน 99.99%',
      role: 'Orbit Lead',
      team: ['AUMIM', 'TAETAE'],
      startDate: '2026-01-10',
      endDate: '2026-05-20',
      status: 'completed',
      tools: ['Operations', 'Quality Control', 'Project Planning', 'Monitoring'],
      links: { demo: 'https://example.com/orbit', github: '', drive: '' },
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      memberId: members[1].id, // TAETAE
      title: 'Silent Core Architecture & High-Performance Engines',
      cover: 'mem_taetae.jpg',
      desc: 'พัฒนาระบบแบ็คเอนด์และโครงสร้างระบบที่ทำงานได้อย่างเงียบเชียบและรวดเร็ว รองรับงานประมวลผลขนาดใหญ่',
      role: 'Core Architect',
      team: ['TAETAE', 'PROUD'],
      startDate: '2026-02-01',
      endDate: '',
      status: 'in_progress',
      tools: ['System Design', 'Backend Development', 'Clean Code', 'Performance Tuning'],
      links: { demo: 'http://localhost:8765', github: 'https://github.com/xenova', drive: '' },
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      memberId: members[2].id, // PROUD
      title: 'Deep Observation & Micro-Interaction Testing',
      cover: 'mem_proud.jpg',
      desc: 'ตรวจสอบและเก็บรายละเอียดทุกจุดสัมผัสของผลิตภัณฑ์ที่ผู้อื่นมองข้าม เพื่อมอบประสบการณ์ที่สมบูรณ์แบบที่สุด',
      role: 'UX Observation Lead',
      team: ['PROUD', 'NOTEBOOK'],
      startDate: '2026-04-15',
      endDate: '2026-09-30',
      status: 'completed',
      tools: ['UX Observation', 'Attention to Detail', 'Design Review', 'Interaction Design'],
      links: { demo: '', github: '', drive: '' },
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      memberId: members[3].id, // NOTEBOOK
      title: 'Newest Transmission & Visual Pixel Universe',
      cover: 'mem_notebook.jpg',
      desc: 'ออกแบบสัญญาณวิชวลคลื่นใหม่ สไตล์ Cyberpunk และ Pixel Identity สำหรับแบรนด์ XENOVA',
      role: 'Visual Concept Artist',
      team: ['NOTEBOOK', 'AUMIM', 'TAETAE', 'PROUD'],
      startDate: '2026-03-01',
      endDate: '',
      status: 'in_progress',
      tools: ['Pixel Art', 'Brand Identity', 'Typography', 'Creative Exploration'],
      links: { demo: '', github: '', drive: 'https://drive.google.com/sample' },
      createdAt: new Date().toISOString()
    }
  ];

  saveMembers(members);
  saveMeetings(meetings);
  saveProjects(sampleProjects);
  addActivity('Welcome to XENOVA! Sample data loaded.', 'info');
  addActivity('4 sample members added', 'success');
  addActivity('3 sample meetings created', 'success');
  addActivity('Sample portfolio projects initialized', 'success');
}

// ============================================================
// THEME SYSTEM
// ============================================================
function applyTheme(themeName) {
  const theme = THEMES[themeName];
  if (!theme) return;
  const root = document.documentElement;
  Object.entries(theme).forEach(([k, v]) => {
    if (k.startsWith('--')) root.style.setProperty(k, v);
  });
  saveData(LS_THEME, themeName);
  updateTopbarBg();
}

function applyCustomTheme(overrides) {
  const root = document.documentElement;
  if (overrides.bg)      root.style.setProperty('--bg', overrides.bg);
  if (overrides.primary) {
    root.style.setProperty('--primary', overrides.primary);
    root.style.setProperty('--accent', overrides.primary);
  }
  if (overrides.text)    root.style.setProperty('--text', overrides.text);
  updateTopbarBg();
}

function updateTopbarBg() {
  // topbar uses CSS var so this is automatic
}

function previewCustomColor(type, value) {
  const root = document.documentElement;
  if (type === 'bg') {
    root.style.setProperty('--bg', value);
    document.getElementById('cp-bg-text').value = value;
  } else if (type === 'primary') {
    root.style.setProperty('--primary', value);
    root.style.setProperty('--accent', value);
    document.getElementById('cp-primary-text').value = value;
  } else if (type === 'text') {
    root.style.setProperty('--text', value);
    document.getElementById('cp-text-text').value = value;
  }
}

function syncColorText(type, value) {
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
    if (type === 'bg') document.getElementById('cp-bg').value = value;
    if (type === 'primary') document.getElementById('cp-primary').value = value;
    if (type === 'text') document.getElementById('cp-text').value = value;
    previewCustomColor(type, value);
  }
}

function previewBrightness(val) {
  document.body.style.filter = `brightness(${val}%)`;
  document.getElementById('brightness-value').textContent = `${val}%`;
}

function setMenuStyle(style) {
  isSidebarCompact = (style === 'compact');
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main');
  if (isSidebarCompact) {
    sidebar.classList.add('compact');
    document.getElementById('menu-style-compact').classList.add('active');
    document.getElementById('menu-style-expanded').classList.remove('active');
  } else {
    sidebar.classList.remove('compact');
    document.getElementById('menu-style-expanded').classList.add('active');
    document.getElementById('menu-style-compact').classList.remove('active');
  }
  saveData(LS_COMPACT, isSidebarCompact);
}

function saveThemeSettings() {
  const custom = {
    bg: document.getElementById('cp-bg').value,
    primary: document.getElementById('cp-primary').value,
    text: document.getElementById('cp-text').value
  };
  saveData(LS_CUSTOM, custom);
  const brightness = document.getElementById('brightness-slider').value;
  saveData(LS_BRIGHTNESS, brightness);
  showToast('Theme settings saved!', 'success');
}

function resetTheme() {
  localStorage.removeItem(LS_CUSTOM);
  localStorage.removeItem(LS_BRIGHTNESS);
  applyTheme('white-blue');
  document.body.style.filter = '';
  document.getElementById('brightness-slider').value = 100;
  document.getElementById('brightness-value').textContent = '100%';
  // Reset color pickers
  const defaults = THEMES['white-blue'];
  document.getElementById('cp-bg').value = defaults['--bg'];
  document.getElementById('cp-bg-text').value = defaults['--bg'];
  document.getElementById('cp-primary').value = defaults['--primary'];
  document.getElementById('cp-primary-text').value = defaults['--primary'];
  document.getElementById('cp-text').value = defaults['--text'];
  document.getElementById('cp-text-text').value = defaults['--text'];
  saveData(LS_THEME, 'white-blue');
  renderThemePresets();
  showToast('Theme reset to default', 'info');
}

function initTheme() {
  const saved = loadData(LS_THEME, 'white-blue');
  applyTheme(typeof saved === 'string' ? saved : 'white-blue');

  const custom = loadData(LS_CUSTOM, null);
  if (custom) applyCustomTheme(custom);

  const brightness = loadData(LS_BRIGHTNESS, 100);
  if (brightness !== 100) {
    document.body.style.filter = `brightness(${brightness}%)`;
  }

  isSidebarCompact = loadData(LS_COMPACT, false);
  if (isSidebarCompact) {
    document.getElementById('sidebar').classList.add('compact');
  }
}

// ============================================================
// ROUTER / NAVIGATION
// ============================================================
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = document.getElementById(`page-${page}`);
  if (section) section.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  const titles = {
    dashboard: t('nav.dashboard'),
    members: t('nav.members'),
    schedule: t('nav.schedule'),
    timetable: t('nav.timetable'),
    theme: t('nav.theme')
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[page] || page;

  // Close mobile sidebar
  closeMobileSidebar();

  // Render page
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'members': renderMembers(); break;
    case 'schedule': renderSchedule(); break;
    case 'timetable': renderTimetable(); break;
    case 'theme': renderThemePage(); break;
  }
}

// ============================================================
// SIDEBAR CONTROLS
// ============================================================
function toggleSidebarCompact() {
  isSidebarCompact = !isSidebarCompact;
  document.getElementById('sidebar').classList.toggle('compact', isSidebarCompact);
  saveData(LS_COMPACT, isSidebarCompact);
}

function openMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.add('mobile-open');
  overlay.classList.add('active');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.remove('mobile-open');
  overlay.classList.remove('active');
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const id = generateId();

  const icons = {
    success: '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#10b981" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
    error:   '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#ef4444" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
    warning: '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>',
    info:    '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.id = `toast-${id}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-text">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="removeToast('${id}')">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;
  container.appendChild(toast);

  setTimeout(() => removeToast(id), duration);
}

function removeToast(id) {
  const toast = document.getElementById(`toast-${id}`);
  if (!toast) return;
  toast.classList.add('hiding');
  setTimeout(() => toast.remove(), 300);
}

// ============================================================
// CONFIRM DIALOG
// ============================================================
function showConfirm(title, msg, onConfirm, btnLabel = 'Delete') {
  confirmCallback = onConfirm;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-ok-btn').textContent = btnLabel;
  document.getElementById('confirm-icon').innerHTML = `
    <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="#ef4444" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    </svg>`;
  document.getElementById('confirm-dialog').classList.add('active');
}

function closeConfirm() {
  document.getElementById('confirm-dialog').classList.remove('active');
  confirmCallback = null;
}

document.getElementById('confirm-ok-btn').addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
  closeConfirm();
});

// ============================================================
// AVATAR HELPER
// ============================================================
function renderAvatar(member, sizeClass = 'avatar-md') {
  if (member.photo) {
    return `<div class="avatar ${sizeClass}"><img src="${member.photo}" alt="${escapeHtml(member.name)}"></div>`;
  }
  return `<div class="avatar ${sizeClass}" style="background:${member.color || '#1A73E8'}">${escapeHtml(getInitials(member.name))}</div>`;
}

function setAvatarElement(el, member) {
  if (!el) return;
  el.style.background = member.photo ? 'transparent' : (member.color || '#1A73E8');
  if (member.photo) {
    el.innerHTML = `<img src="${member.photo}" alt="${escapeHtml(member.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    el.textContent = getInitials(member.name);
  }
}

// ============================================================
// DASHBOARD RENDER
// ============================================================
function renderDashboard() {
  renderStats();
  renderNextMeeting();
  renderActivityFeed();
  renderMembersPreview();
  renderUpcomingMeetingsList();
}

function renderStats() {
  const members = getMembers();
  const meetings = getMeetings();
  const now = new Date();

  const startOfWeek = new Date(now);
  startOfWeek.setHours(0,0,0,0);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const upcoming = meetings.filter(m => {
    const mdt = getMeetingDateTime(m);
    return mdt >= now;
  }).length;

  const thisWeek = meetings.filter(m => {
    const mdt = getMeetingDateTime(m);
    return mdt >= startOfWeek && mdt < endOfWeek;
  }).length;

  const completed = meetings.filter(m => getMeetingStatus(m) === 'past').length;

  const stats = [
    {
      icon: `<svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
      iconBg: 'linear-gradient(135deg,#1A73E8,#4285F4)',
      value: members.length,
      label: t('dashboard.stats_total_members'),
      change: t('dashboard.stats_active_members'),
      changeClass: 'neutral'
    },
    {
      icon: `<svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
      iconBg: 'linear-gradient(135deg,#7c3aed,#8b5cf6)',
      value: meetings.length,
      label: t('dashboard.stats_total_meetings'),
      change: t('dashboard.stats_all_time'),
      changeClass: 'neutral'
    },
    {
      icon: `<svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      iconBg: 'linear-gradient(135deg,#f59e0b,#f97316)',
      value: thisWeek,
      label: t('dashboard.stats_this_week'),
      change: t('dashboard.stats_upcoming_meetings'),
      changeClass: 'up'
    },
    {
      icon: `<svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      iconBg: 'linear-gradient(135deg,#059669,#10b981)',
      value: completed,
      label: t('dashboard.stats_completed'),
      change: t('dashboard.stats_past_meetings'),
      changeClass: 'neutral'
    }
  ];

  const grid = document.getElementById('stats-grid');
  grid.innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-icon" style="background:${s.iconBg}">${s.icon}</div>
      <div class="stat-info">
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
        <div class="stat-change ${s.changeClass}">${s.change}</div>
      </div>
    </div>
  `).join('');
}

function renderNextMeeting() {
  const meetings = getMeetings();
  const now = new Date();
  const futureMeetings = meetings
    .filter(m => getMeetingDateTime(m) > now)
    .sort((a, b) => getMeetingDateTime(a) - getMeetingDateTime(b));

  const container = document.getElementById('next-meeting-content');

  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }

  if (futureMeetings.length === 0) {
    container.innerHTML = `<div class="next-meeting-title">${t('dashboard.no_upcoming_meeting')}</div><div class="no-meeting-msg">${t('dashboard.schedule_one')}</div>`;
    return;
  }

  const next = futureMeetings[0];
  const members = getMembers();
  const attendees = next.attendeeIds ? next.attendeeIds.map(id => members.find(m => m.id === id)).filter(Boolean) : [];

  container.innerHTML = `
    <div class="next-meeting-title">${escapeHtml(next.title)}</div>
    <div class="next-meeting-meta">
      <span>📅 ${formatDate(next.date)}</span>
      <span>🕐 ${formatTime(next.time)}</span>
      ${next.location ? `<span>📍 ${escapeHtml(next.location)}</span>` : ''}
      ${next.duration ? `<span>⏱ ${next.duration} min</span>` : ''}
    </div>
    ${attendees.length > 0 ? `<div style="margin-top:10px;font-size:12px;opacity:0.8;">👥 ${attendees.map(a => escapeHtml(a.name)).join(', ')}</div>` : ''}
    <div class="countdown-timer" id="countdown-timer">
      <div class="countdown-unit"><div class="countdown-value" id="cd-days">--</div><div class="countdown-label">${t('dashboard.days')}</div></div>
      <div class="countdown-unit"><div class="countdown-value" id="cd-hours">--</div><div class="countdown-label">${t('dashboard.hours')}</div></div>
      <div class="countdown-unit"><div class="countdown-value" id="cd-mins">--</div><div class="countdown-label">${t('dashboard.mins')}</div></div>
      <div class="countdown-unit"><div class="countdown-value" id="cd-secs">--</div><div class="countdown-label">${t('dashboard.secs')}</div></div>
    </div>
  `;

  function updateCountdown() {
    const diff = getMeetingDateTime(next) - new Date();
    if (diff <= 0) {
      clearInterval(countdownInterval);
      document.getElementById('countdown-timer').innerHTML = `<div style="font-size:14px;opacity:0.8;">🔴 ${t('dashboard.meeting_now')}</div>`;
      return;
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const pad = n => String(n).padStart(2, '0');
    if (document.getElementById('cd-days')) {
      document.getElementById('cd-days').textContent = pad(days);
      document.getElementById('cd-hours').textContent = pad(hours);
      document.getElementById('cd-mins').textContent = pad(mins);
      document.getElementById('cd-secs').textContent = pad(secs);
    }
  }

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

function renderActivityFeed() {
  const activities = loadData(LS_ACTIVITY, []);
  const list = document.getElementById('activity-list');

  if (!list) return;

  if (activities.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:14px;">${t('dashboard.no_activity')}</div>`;
    return;
  }

  const typeMap = { success: 'success', error: 'danger', warning: 'warning', info: '' };
  list.innerHTML = activities.slice(0, 5).map(a => `
    <div class="activity-item">
      <div class="activity-dot ${typeMap[a.type] || ''}"></div>
      <div>
        <div class="activity-text">${escapeHtml(a.message)}</div>
        <div class="activity-time">${timeAgo(a.createdAt)}</div>
      </div>
    </div>
  `).join('');
}

function renderMembersPreview() {
  const members = getMembers();
  const container = document.getElementById('members-preview');
  if (!container) return;

  if (members.length === 0) {
    container.innerHTML = `<div style="color:var(--text-secondary);font-size:13px;">${t('members.no_members')}</div>`;
    return;
  }

  container.innerHTML = members.slice(0, 10).map(m => `
    <div class="member-preview-item" onclick="openProfileModal('${m.id}')">
      ${renderAvatar(m, 'avatar-md')}
      <span class="member-preview-name">${escapeHtml(m.name.split(' ')[0])}</span>
    </div>
  `).join('');
}

function renderUpcomingMeetingsList() {
  const meetings = getMeetings();
  const now = new Date();
  const upcoming = meetings
    .filter(m => getMeetingDateTime(m) >= now)
    .sort((a, b) => getMeetingDateTime(a) - getMeetingDateTime(b))
    .slice(0, 5);

  const list = document.getElementById('upcoming-meetings-list');
  if (!list) return;

  if (upcoming.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px;">${t('dashboard.no_upcoming_list')}</div>`;
    return;
  }

  list.innerHTML = upcoming.map(m => {
    const d = new Date(m.date + 'T00:00:00');
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    return `
      <div class="meeting-list-item" onclick="navigateTo('schedule')">
        <div class="meeting-date-badge">
          <div class="month">${month}</div>
          <div class="day">${day}</div>
        </div>
        <div class="meeting-info">
          <div class="meeting-info-title">${escapeHtml(m.title)}</div>
          <div class="meeting-info-meta">${formatTime(m.time)}${m.location ? ' · ' + escapeHtml(m.location) : ''}</div>
        </div>
        <span class="badge badge-upcoming">${t('schedule.status_upcoming')}</span>
      </div>
    `;
  }).join('');
}

// ============================================================
// MEMBERS PAGE
// ============================================================
function renderMembers() {
  const members = getMembers();
  const search = document.getElementById('member-search').value.toLowerCase();
  const filtered = search
    ? members.filter(m =>
        m.name.toLowerCase().includes(search) ||
        m.position.toLowerCase().includes(search) ||
        (m.skills || []).join(' ').toLowerCase().includes(search))
    : members;

  const label = document.getElementById('members-count-label');
  if (label) label.textContent = members.length === 1 ? t('members.subtitle_single', { count: members.length }) : t('members.subtitle_plural', { count: members.length });

  const grid = document.getElementById('members-grid');
  if (!grid) return;

  if (members.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <h3>${t('members.no_members')}</h3>
        <p>${t('members.add_first_hint')}</p>
      </div>`;
    return;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>${t('members.no_results')}</h3><p>${t('members.try_different')}</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(m => `
    <div class="member-card" onclick="openProfileModal('${m.id}')">
      <div class="member-card-menu" onclick="event.stopPropagation()">
        <button class="three-dot-btn" onclick="toggleDropdown(event,'dropdown-${m.id}')">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>
        <div class="dropdown-menu hidden" id="dropdown-${m.id}">
          <button class="dropdown-item" onclick="openProfileModal('${m.id}')">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            ${t('members.view_profile')}
          </button>
          <button class="dropdown-item" onclick="openEditMemberModal('${m.id}')">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            ${t('members.edit')}
          </button>
          <button class="dropdown-item danger" onclick="deleteMember('${m.id}')">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            ${t('members.delete')}
          </button>
        </div>
      </div>
      ${renderAvatar(m, 'avatar-lg')}
      <div class="member-card-name">${escapeHtml(m.name)}</div>
      <div class="member-card-position">${escapeHtml(m.position)}</div>
      ${m.email ? `<div class="member-card-email">${escapeHtml(m.email)}</div>` : ''}
      ${m.skills && m.skills.length > 0 ? `
        <div class="member-skills">
          ${m.skills.slice(0, 3).map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}
          ${m.skills.length > 3 ? `<span class="skill-tag">+${m.skills.length - 3}</span>` : ''}
        </div>` : ''}
    </div>
  `).join('');
}

function filterMembers() {
  renderMembers();
}

function toggleDropdown(event, id) {
  event.stopPropagation();
  // Close all others
  document.querySelectorAll('.dropdown-menu').forEach(d => {
    if (d.id !== id) d.classList.add('hidden');
  });
  document.getElementById(id).classList.toggle('hidden');
}

// Close dropdowns on outside click
document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.add('hidden'));
});

// ============================================================
// MEMBER MODAL
// ============================================================
function openAddMemberModal() {
  document.getElementById('member-modal-title').textContent = t('member_form.add_title');
  document.getElementById('member-id-input').value = '';
  document.getElementById('member-name-input').value = '';
  document.getElementById('member-position-input').value = '';
  document.getElementById('member-bio-input').value = '';
  document.getElementById('member-responsibilities-input').value = '';
  document.getElementById('member-skills-input').value = '';
  document.getElementById('member-email-input').value = '';
  document.getElementById('member-phone-input').value = '';
  document.getElementById('member-photo-data').value = '';
  const preview = document.getElementById('photo-preview-avatar');
  preview.style.background = '#1A73E8';
  preview.innerHTML = '+';
  document.getElementById('member-modal-overlay').classList.add('active');
}

function openEditMemberModal(id) {
  const members = getMembers();
  const m = members.find(x => x.id === id);
  if (!m) return;

  document.getElementById('member-modal-title').textContent = t('member_form.edit_title');
  document.getElementById('member-id-input').value = m.id;
  document.getElementById('member-name-input').value = m.name;
  document.getElementById('member-position-input').value = m.position;
  document.getElementById('member-bio-input').value = m.bio || '';
  document.getElementById('member-responsibilities-input').value = (m.responsibilities || []).join(', ');
  document.getElementById('member-skills-input').value = (m.skills || []).join(', ');
  document.getElementById('member-email-input').value = m.email || '';
  document.getElementById('member-phone-input').value = m.phone || '';
  document.getElementById('member-photo-data').value = m.photo || '';

  const preview = document.getElementById('photo-preview-avatar');
  if (m.photo) {
    preview.style.background = 'transparent';
    preview.innerHTML = `<img src="${m.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    preview.style.background = m.color || '#1A73E8';
    preview.textContent = getInitials(m.name);
  }

  document.getElementById('member-modal-overlay').classList.add('active');
  // Close any open dropdowns
  document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.add('hidden'));
}

function closeMemberModal() {
  document.getElementById('member-modal-overlay').classList.remove('active');
}

function handleMemberPhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('File too large. Max 5MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const data = e.target.result;
    document.getElementById('member-photo-data').value = data;
    const preview = document.getElementById('photo-preview-avatar');
    preview.style.background = 'transparent';
    preview.innerHTML = `<img src="${data}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  };
  reader.readAsDataURL(file);
}

function saveMember() {
  const name = document.getElementById('member-name-input').value.trim();
  const position = document.getElementById('member-position-input').value.trim();
  if (!name) { showToast('Name is required', 'error'); return; }
  if (!position) { showToast('Position is required', 'error'); return; }

  const id = document.getElementById('member-id-input').value;
  const members = getMembers();

  const rawResp = document.getElementById('member-responsibilities-input').value;
  const rawSkills = document.getElementById('member-skills-input').value;

  const memberData = {
    name,
    position,
    bio: document.getElementById('member-bio-input').value.trim(),
    responsibilities: rawResp ? rawResp.split(',').map(s => s.trim()).filter(Boolean) : [],
    skills: rawSkills ? rawSkills.split(',').map(s => s.trim()).filter(Boolean) : [],
    email: document.getElementById('member-email-input').value.trim(),
    phone: document.getElementById('member-phone-input').value.trim(),
    photo: document.getElementById('member-photo-data').value
  };

  if (id) {
    // Edit
    const idx = members.findIndex(m => m.id === id);
    if (idx !== -1) {
      members[idx] = { ...members[idx], ...memberData };
      addActivity(`Member "${name}" was updated`, 'info');
      showToast(`${name} updated successfully`, 'success');
    }
  } else {
    // Add
    const newMember = {
      id: generateId(),
      color: randomColor(),
      createdAt: new Date().toISOString(),
      ...memberData
    };
    members.push(newMember);
    addActivity(`New member "${name}" added`, 'success');
    showToast(`${name} added successfully`, 'success');
  }

  saveMembers(members);
  closeMemberModal();
  renderMembers();
  renderMembersPreview();
  renderStats();
}

function deleteMember(id) {
  const members = getMembers();
  const m = members.find(x => x.id === id);
  if (!m) return;

  showConfirm(
    'Delete Member',
    `Are you sure you want to remove "${m.name}" from the team? This cannot be undone.`,
    () => {
      const updated = members.filter(x => x.id !== id);
      saveMembers(updated);
      addActivity(`Member "${m.name}" was removed`, 'error');
      showToast(`${m.name} removed`, 'info');

      if (document.getElementById('profile-modal').classList.contains('active')) {
        closeProfileModal();
      }
      renderMembers();
      renderMembersPreview();
      renderStats();
    }
  );
}

// ============================================================
// MEMBER PROFILE MODAL
// ============================================================
function openProfileModal(id) {
  const members = getMembers();
  const m = members.find(x => x.id === id);
  if (!m) return;

  currentProfileId = id;

  // Avatar
  const avatarEl = document.getElementById('profile-avatar-display');
  avatarEl.style.background = m.photo ? 'transparent' : (m.color || '#1A73E8');
  if (m.photo) {
    avatarEl.innerHTML = `<img src="${m.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    avatarEl.textContent = getInitials(m.name);
  }

  document.getElementById('profile-name-display').textContent = m.name;
  document.getElementById('profile-position-display').textContent = m.position;

  // Bio
  const bioSection = document.getElementById('profile-bio-section');
  if (m.bio) {
    bioSection.style.display = '';
    document.getElementById('profile-bio-display').textContent = m.bio;
  } else {
    bioSection.style.display = 'none';
  }

  // Responsibilities
  const respSection = document.getElementById('profile-responsibilities-section');
  const respList = document.getElementById('profile-responsibilities-display');
  if (m.responsibilities && m.responsibilities.length) {
    respSection.style.display = '';
    respList.innerHTML = m.responsibilities.map(r => `<li>${escapeHtml(r)}</li>`).join('');
  } else {
    respSection.style.display = 'none';
  }

  // Skills
  const skillsSection = document.getElementById('profile-skills-section');
  const skillsEl = document.getElementById('profile-skills-display');
  if (m.skills && m.skills.length) {
    skillsSection.style.display = '';
    skillsEl.innerHTML = m.skills.map(s => `<span class="profile-skill-tag">${escapeHtml(s)}</span>`).join('');
  } else {
    skillsSection.style.display = 'none';
  }

  // Contact
  const contactEl = document.getElementById('profile-contact-display');
  const contactItems = [];
  if (m.email) contactItems.push({ icon: '✉️', label: 'Email', value: m.email });
  if (m.phone) contactItems.push({ icon: '📞', label: 'Phone', value: m.phone });
  contactEl.innerHTML = contactItems.length
    ? contactItems.map(c => `
        <div class="contact-item">
          <div class="contact-icon">${c.icon}</div>
          <div>
            <div class="contact-label">${c.label}</div>
            <div class="contact-value">${escapeHtml(c.value)}</div>
          </div>
        </div>`).join('')
    : '<div style="color:var(--text-secondary);font-size:14px;">No contact info provided</div>';

  // Render Portfolio / Work History
  renderMemberPortfolio(id);

  // Check Permissions for Member Edit/Delete
  const canEdit = canEditMember(id);
  const editBtn = document.getElementById('profile-edit-btn');
  const delBtn = document.getElementById('profile-delete-btn');
  const addProjBtn = document.getElementById('btn-add-project');
  
  if (editBtn) editBtn.style.display = canEdit ? '' : 'none';
  if (delBtn) delBtn.style.display = (getCurrentUser().role === 'admin') ? '' : 'none';
  if (addProjBtn) addProjBtn.style.display = canEdit ? '' : 'none';

  // Buttons
  document.getElementById('profile-edit-btn').onclick = () => { closeProfileModal(); openEditMemberModal(id); };
  document.getElementById('profile-delete-btn').onclick = () => deleteMember(id);

  document.getElementById('profile-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
  // Close dropdowns
  document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.add('hidden'));
}

function closeProfileModal() {
  document.getElementById('profile-modal').classList.remove('active');
  document.body.style.overflow = '';
  currentProfileId = null;
}

// ============================================================
// PORTFOLIO & WORK HISTORY FUNCTIONS
// ============================================================
let currentProjectViewId = null;

function renderMemberPortfolio(memberId) {
  const container = document.getElementById('profile-portfolio-list');
  if (!container) return;

  const allProjects = getProjects();
  const projects = allProjects.filter(p => p.memberId === memberId);

  if (projects.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1;padding:32px 16px;text-align:center;color:var(--text-secondary);background:var(--bg);border-radius:10px;border:1px dashed var(--border);">
        <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 8px;display:block;opacity:0.6;"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
        <p style="font-size:14px;font-weight:600;margin-bottom:4px;">${t('portfolio.no_projects')}</p>
        <p style="font-size:12px;">${t('portfolio.add_first_hint')}</p>
      </div>
    `;
    return;
  }

  const statusMap = {
    completed: { label: t('portfolio.status_completed'), class: 'status-completed' },
    in_progress: { label: t('portfolio.status_in_progress'), class: 'status-in_progress' },
    cancelled: { label: t('portfolio.status_cancelled'), class: 'status-cancelled' }
  };

  container.innerHTML = projects.map(p => {
    const st = statusMap[p.status] || statusMap.completed;
    const coverHtml = p.cover 
      ? `<img src="${p.cover}" alt="${escapeHtml(p.title)}">` 
      : `<svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="color:var(--primary);opacity:0.7;"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;

    const dateRange = (p.startDate || p.endDate)
      ? `${p.startDate ? p.startDate : t('portfolio.no_period')} ${t('portfolio.to')} ${p.endDate ? p.endDate : t('portfolio.present')}`
      : t('portfolio.no_period');

    const toolsHtml = (p.tools || []).slice(0, 3).map(t => `<span class="portfolio-tool-badge">${escapeHtml(t)}</span>`).join('');

    return `
      <div class="portfolio-card" onclick="openProjectDetailModal('${p.id}')">
        <div class="portfolio-card-cover">
          ${coverHtml}
          <span class="portfolio-card-status ${st.class}">${st.label}</span>
        </div>
        <div class="portfolio-card-body">
          <div class="portfolio-card-title">${escapeHtml(p.title)}</div>
          <div class="portfolio-card-role">${escapeHtml(p.role || 'Member')}</div>
          <div class="portfolio-card-desc">${escapeHtml(p.desc || 'ไม่มีรายละเอียด')}</div>
          <div class="portfolio-card-footer">
            <div class="portfolio-card-tools">${toolsHtml}</div>
            <div>📅 ${escapeHtml(dateRange)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Open Add Project Modal
function openAddProjectModal() {
  if (!currentProfileId) return;
  if (!canEditMember(currentProfileId)) {
    showToast('คุณไม่มีสิทธิ์เพิ่มผลงานให้สมาชิกท่านนี้', 'error');
    return;
  }

  document.getElementById('project-modal-title').textContent = 'Add Project (เพิ่มโปรเจกต์)';
  document.getElementById('project-id-input').value = '';
  document.getElementById('project-title-input').value = '';
  document.getElementById('project-status-input').value = 'completed';
  document.getElementById('project-role-input').value = '';
  document.getElementById('project-team-input').value = '';
  document.getElementById('project-start-date-input').value = '';
  document.getElementById('project-end-date-input').value = '';
  document.getElementById('project-tools-input').value = '';
  document.getElementById('project-desc-input').value = '';
  document.getElementById('project-link-demo').value = '';
  document.getElementById('project-link-github').value = '';
  document.getElementById('project-link-drive').value = '';
  document.getElementById('project-cover-data').value = '';

  const preview = document.getElementById('project-cover-preview');
  preview.innerHTML = `
    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
    <span>คลิกเพื่ออัปโหลดรูปภาพหน้าปก (JPG, PNG, GIF)</span>
  `;

  document.getElementById('project-modal-overlay').classList.add('active');
}

// Open Edit Project Modal
function openEditProjectModal(projectId) {
  const projects = getProjects();
  const p = projects.find(x => x.id === projectId);
  if (!p) return;

  if (!canManageProject(p)) {
    showToast('คุณไม่มีสิทธิ์แก้ไขผลงานนี้', 'error');
    return;
  }

  document.getElementById('project-modal-title').textContent = 'Edit Project (แก้ไขโปรเจกต์)';
  document.getElementById('project-id-input').value = p.id;
  document.getElementById('project-title-input').value = p.title || '';
  document.getElementById('project-status-input').value = p.status || 'completed';
  document.getElementById('project-role-input').value = p.role || '';
  document.getElementById('project-team-input').value = (p.team || []).join(', ');
  document.getElementById('project-start-date-input').value = p.startDate || '';
  document.getElementById('project-end-date-input').value = p.endDate || '';
  document.getElementById('project-tools-input').value = (p.tools || []).join(', ');
  document.getElementById('project-desc-input').value = p.desc || '';
  document.getElementById('project-link-demo').value = (p.links && p.links.demo) || '';
  document.getElementById('project-link-github').value = (p.links && p.links.github) || '';
  document.getElementById('project-link-drive').value = (p.links && p.links.drive) || '';
  document.getElementById('project-cover-data').value = p.cover || '';

  const preview = document.getElementById('project-cover-preview');
  if (p.cover) {
    preview.innerHTML = `<img src="${p.cover}" alt="Cover">`;
  } else {
    preview.innerHTML = `
      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
      <span>คลิกเพื่ออัปโหลดรูปภาพหน้าปกใหม่</span>
    `;
  }

  closeProjectDetailModal();
  document.getElementById('project-modal-overlay').classList.add('active');
}

function closeProjectModal() {
  document.getElementById('project-modal-overlay').classList.remove('active');
}

function handleProjectCoverUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('ไฟล์ขนาดใหญ่เกินไป จำกัดไม่เกิน 5MB', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const data = e.target.result;
    document.getElementById('project-cover-data').value = data;
    const preview = document.getElementById('project-cover-preview');
    preview.innerHTML = `<img src="${data}" alt="Cover">`;
    showToast('อัปโหลดรูปหน้าปกเรียบร้อย', 'success');
  };
  reader.readAsDataURL(file);
}

function saveProject() {
  const title = document.getElementById('project-title-input').value.trim();
  const role = document.getElementById('project-role-input').value.trim();

  if (!title) { showToast('กรุณากรอกชื่อโปรเจกต์', 'error'); return; }
  if (!role) { showToast('กรุณากรอกตำแหน่ง/หน้าที่รับผิดชอบ', 'error'); return; }

  const id = document.getElementById('project-id-input').value;
  const rawTeam = document.getElementById('project-team-input').value.trim();
  const rawTools = document.getElementById('project-tools-input').value.trim();

  const demoLink = document.getElementById('project-link-demo').value.trim();
  const githubLink = document.getElementById('project-link-github').value.trim();
  const driveLink = document.getElementById('project-link-drive').value.trim();

  // Validate URLs if provided
  const invalidLinks = [];
  if (demoLink && !isSafeUrl(demoLink)) invalidLinks.push('Live Demo');
  if (githubLink && !isSafeUrl(githubLink)) invalidLinks.push('GitHub');
  if (driveLink && !isSafeUrl(driveLink)) invalidLinks.push('Drive');

  if (invalidLinks.length > 0) {
    showToast(`ลิงก์ ${invalidLinks.join(', ')} ไม่ถูกต้อง ต้องขึ้นต้นด้วย http:// หรือ https://`, 'error');
    return;
  }

  const projects = getProjects();
  const projectData = {
    title,
    role,
    status: document.getElementById('project-status-input').value,
    team: rawTeam ? rawTeam.split(',').map(s => s.trim()).filter(Boolean) : [],
    startDate: document.getElementById('project-start-date-input').value,
    endDate: document.getElementById('project-end-date-input').value,
    tools: rawTools ? rawTools.split(',').map(s => s.trim()).filter(Boolean) : [],
    desc: document.getElementById('project-desc-input').value.trim(),
    links: { demo: demoLink, github: githubLink, drive: driveLink },
    cover: document.getElementById('project-cover-data').value
  };

  if (id) {
    // Edit
    const idx = projects.findIndex(p => p.id === id);
    if (idx !== -1) {
      if (!canManageProject(projects[idx])) {
        showToast('คุณไม่มีสิทธิ์แก้ไขผลงานนี้', 'error');
        return;
      }
      projects[idx] = { ...projects[idx], ...projectData };
      saveProjects(projects);
      addActivity(`อัปเดตโปรเจกต์ "${title}"`, 'info');
      showToast(`อัปเดต "${title}" สำเร็จ`, 'success');
    }
  } else {
    // Add
    const newProj = {
      id: generateId(),
      memberId: currentProfileId,
      createdAt: new Date().toISOString(),
      ...projectData
    };
    projects.push(newProj);
    saveProjects(projects);
    addActivity(`เพิ่มโปรเจกต์ใหม่ "${title}"`, 'success');
    showToast(`เพิ่มโปรเจกต์ "${title}" สำเร็จ`, 'success');
  }

  closeProjectModal();
  renderMemberPortfolio(currentProfileId);
}

function deleteProject(projectId) {
  const projects = getProjects();
  const p = projects.find(x => x.id === projectId);
  if (!p) return;

  if (!canManageProject(p)) {
    showToast('คุณไม่มีสิทธิ์ลบผลงานนี้', 'error');
    return;
  }

  showConfirm(
    'Delete Project',
    `คุณแน่ใจหรือไม่ว่าต้องการลบโปรเจกต์ "${p.title}"? การกระทำนี้ไม่สามารถย้อนกลับได้`,
    () => {
      const updated = projects.filter(x => x.id !== projectId);
      saveProjects(updated);
      addActivity(`ลบโปรเจกต์ "${p.title}"`, 'error');
      showToast(`ลบโปรเจกต์ "${p.title}" เรียบร้อย`, 'info');
      closeProjectDetailModal();
      if (currentProfileId) renderMemberPortfolio(currentProfileId);
    }
  );
}

// Open Fullscreen Project Detail
function openProjectDetailModal(projectId) {
  const projects = getProjects();
  const p = projects.find(x => x.id === projectId);
  if (!p) return;

  currentProjectViewId = projectId;

  // Header Cover
  const coverContainer = document.getElementById('project-detail-cover-container');
  if (p.cover) {
    coverContainer.style.display = '';
    coverContainer.innerHTML = `<img src="${p.cover}" alt="${escapeHtml(p.title)}">`;
  } else {
    coverContainer.style.display = 'none';
  }

  // Status & Date
  const statusMap = {
    completed: { label: 'เสร็จสิ้น (Completed)', class: 'status-completed' },
    in_progress: { label: 'กำลังดำเนินการ (In Progress)', class: 'status-in_progress' },
    cancelled: { label: 'ยกเลิก (Cancelled)', class: 'status-cancelled' }
  };
  const st = statusMap[p.status] || statusMap.completed;
  const badgeEl = document.getElementById('project-detail-status-badge');
  badgeEl.className = `portfolio-card-status ${st.class}`;
  badgeEl.style.position = 'static';
  badgeEl.textContent = st.label;

  const dateText = (p.startDate || p.endDate)
    ? `🗓️ ${p.startDate || 'ไม่ระบุ'} — ${p.endDate || 'ปัจจุบัน'}`
    : '🗓️ ไม่ได้ระบุช่วงเวลา';
  document.getElementById('project-detail-dates').textContent = dateText;

  // Title & Role
  document.getElementById('project-detail-title').textContent = p.title;
  document.getElementById('project-detail-role').textContent = `ตำแหน่ง/หน้าที่: ${p.role}`;
  document.getElementById('project-detail-desc').textContent = p.desc || 'ไม่มีรายละเอียดเพิ่มเติม';

  // Team
  const teamSection = document.getElementById('project-detail-team-section');
  const teamEl = document.getElementById('project-detail-team');
  if (p.team && p.team.length > 0) {
    teamSection.style.display = '';
    teamEl.innerHTML = p.team.map(member => `
      <div style="display:inline-flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);padding:4px 10px;border-radius:20px;font-size:13px;margin:3px 4px 3px 0;">
        <span>👤</span>
        <span>${escapeHtml(member)}</span>
      </div>
    `).join('');
  } else {
    teamSection.style.display = 'none';
  }

  // Tools & Skills
  const toolsSection = document.getElementById('project-detail-tools-section');
  const toolsEl = document.getElementById('project-detail-tools');
  if (p.tools && p.tools.length > 0) {
    toolsSection.style.display = '';
    toolsEl.innerHTML = p.tools.map(t => `<span class="profile-skill-tag">🛠️ ${escapeHtml(t)}</span>`).join('');
  } else {
    toolsSection.style.display = 'none';
  }

  // Links (Verified Safe)
  const linksSection = document.getElementById('project-detail-links-section');
  const linksEl = document.getElementById('project-detail-links');
  const linkItems = [];
  if (p.links) {
    if (p.links.demo && isSafeUrl(p.links.demo)) {
      linkItems.push(`<a href="${escapeHtml(p.links.demo)}" target="_blank" rel="noopener noreferrer" class="link-btn">🌐 Live Demo / Website <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></a>`);
    }
    if (p.links.github && isSafeUrl(p.links.github)) {
      linkItems.push(`<a href="${escapeHtml(p.links.github)}" target="_blank" rel="noopener noreferrer" class="link-btn">💻 GitHub Repository <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></a>`);
    }
    if (p.links.drive && isSafeUrl(p.links.drive)) {
      linkItems.push(`<a href="${escapeHtml(p.links.drive)}" target="_blank" rel="noopener noreferrer" class="link-btn">📁 Document / Drive <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></a>`);
    }
  }

  if (linkItems.length > 0) {
    linksSection.style.display = '';
    linksEl.innerHTML = linkItems.join('');
  } else {
    linksSection.style.display = 'none';
  }

  // Actions (Edit/Delete permission)
  const actionsEl = document.getElementById('project-detail-actions');
  if (canManageProject(p)) {
    actionsEl.innerHTML = `
      <button class="btn btn-primary btn-sm" onclick="openEditProjectModal('${p.id}')">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        Edit
      </button>
      <button class="btn btn-danger btn-sm" onclick="deleteProject('${p.id}')">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        Delete
      </button>
    `;
  } else {
    actionsEl.innerHTML = `<span style="font-size:12px;color:var(--text-secondary);align-self:center;">👁️ โหมดดูข้อมูลเท่านั้น</span>`;
  }

  document.getElementById('project-detail-modal').classList.add('active');
}

function closeProjectDetailModal() {
  document.getElementById('project-detail-modal').classList.remove('active');
  currentProjectViewId = null;
}

// User Switching Modal (Role Simulator)
function openSwitchUserModal() {
  const members = getMembers();
  const currentUser = getCurrentUser();
  const listEl = document.getElementById('switch-user-list');

  const users = [
    { id: 'admin', name: 'Admin', role: 'admin', position: 'Group Manager' },
    ...members.map(m => ({ id: m.id, name: m.name, role: 'member', position: m.position }))
  ];

  listEl.innerHTML = users.map(u => `
    <div class="user-switch-item ${currentUser.id === u.id ? 'active' : ''}" onclick="selectUser('${u.id}')">
      <div class="avatar avatar-sm" style="background:${u.role === 'admin' ? '#1A73E8' : '#7c3aed'};color:white;">
        ${u.role === 'admin' ? 'A' : getInitials(u.name)}
      </div>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:13px;color:var(--text);">${escapeHtml(u.name)}</div>
        <div style="font-size:11px;color:var(--text-secondary);">${escapeHtml(u.position)} ${u.role === 'admin' ? '⭐ Admin' : ''}</div>
      </div>
      ${currentUser.id === u.id ? '<span style="color:var(--primary);font-size:12px;font-weight:700;">✓ Active</span>' : ''}
    </div>
  `).join('');

  document.getElementById('switch-user-modal-overlay').classList.add('active');
}

function closeSwitchUserModal() {
  document.getElementById('switch-user-modal-overlay').classList.remove('active');
}

function selectUser(userId) {
  if (userId === 'admin') {
    setCurrentUser({ id: 'admin', name: 'Admin', role: 'admin', position: 'Group Manager' });
  } else {
    const members = getMembers();
    const m = members.find(x => x.id === userId);
    if (m) {
      setCurrentUser({ id: m.id, name: m.name, role: 'member', position: m.position });
    }
  }
  closeSwitchUserModal();
  showToast(`สลับผู้ใช้งานเป็น ${getCurrentUser().name} แล้ว`, 'success');
  if (currentProfileId) {
    openProfileModal(currentProfileId); // re-render with updated permissions
  }
}

function triggerProfilePhotoUpload() {
  document.getElementById('profile-photo-input').click();
}

function handleProfilePhotoChange(input) {
  if (!currentProfileId) return;
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('File too large. Max 5MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const data = e.target.result;
    const members = getMembers();
    const idx = members.findIndex(m => m.id === currentProfileId);
    if (idx !== -1) {
      members[idx].photo = data;
      saveMembers(members);
      const avatarEl = document.getElementById('profile-avatar-display');
      avatarEl.style.background = 'transparent';
      avatarEl.innerHTML = `<img src="${data}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      showToast('Profile photo updated', 'success');
      if (currentPage === 'members') renderMembers();
      renderMembersPreview();
    }
  };
  reader.readAsDataURL(file);
  input.value = '';
}

// ============================================================
// SCHEDULE PAGE
// ============================================================
function renderSchedule() {
  const meetings = getMeetings();
  const label = document.getElementById('schedule-count-label');
  if (label) label.textContent = meetings.length === 1 ? t('schedule.subtitle_single', { count: meetings.length }) : t('schedule.subtitle_plural', { count: meetings.length });

  if (currentView === 'list') renderMeetingsList();
  else if (currentView === 'calendar') renderCalendar();
  else if (currentView === 'week') renderWeekView();
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  document.getElementById('schedule-list-view').classList.toggle('hidden', view !== 'list');
  document.getElementById('schedule-calendar-view').classList.toggle('hidden', view !== 'calendar');
  document.getElementById('schedule-week-view').classList.toggle('hidden', view !== 'week');

  if (view === 'list') renderMeetingsList();
  else if (view === 'calendar') renderCalendar();
  else if (view === 'week') renderWeekView();
}

function renderMeetingsList() {
  const meetings = getMeetings().sort((a, b) => getMeetingDateTime(a) - getMeetingDateTime(b));
  const members = getMembers();
  const tbody = document.getElementById('meetings-tbody');
  if (!tbody) return;

  if (meetings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-secondary);">No meetings yet. Click "Add Meeting" to create one.</td></tr>`;
    return;
  }

  tbody.innerHTML = meetings.map(m => {
    const status = getMeetingStatus(m);
    const badgeClass = { upcoming: 'badge-upcoming', today: 'badge-today', past: 'badge-past' }[status];
    const attendees = (m.attendeeIds || []).map(id => members.find(x => x.id === id)).filter(Boolean);

    return `
      <tr>
        <td class="meeting-title-cell">${escapeHtml(m.title)}</td>
        <td>${formatDate(m.date)}<br><span style="color:var(--text-secondary);font-size:12px;">${formatTime(m.time)}</span></td>
        <td>${m.duration ? `${m.duration} min` : '—'}</td>
        <td>${m.location ? escapeHtml(m.location) : '—'}</td>
        <td><span class="badge ${badgeClass}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
        <td>
          <div style="display:flex;gap:-4px;align-items:center;">
            ${attendees.slice(0, 3).map(a => `<div title="${escapeHtml(a.name)}" style="margin-right:-6px;">${renderAvatar(a,'avatar-sm')}</div>`).join('')}
            ${attendees.length > 3 ? `<span style="font-size:11px;color:var(--text-secondary);margin-left:12px;">+${attendees.length - 3}</span>` : ''}
            ${attendees.length === 0 ? '<span style="color:var(--text-secondary);font-size:12px;">None</span>' : ''}
          </div>
        </td>
        <td>
          <div class="meeting-actions">
            <button class="btn btn-ghost btn-sm" onclick="openEditMeetingModal('${m.id}')">${t('common.edit')}</button>
            <button class="btn btn-danger btn-sm" onclick="deleteMeeting('${m.id}')">${t('common.delete')}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Calendar
function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const dateObj = new Date(year, month, 1);
  const locale = getLocaleCode(currentLang);
  document.getElementById('calendar-month-label').textContent = dateObj.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const meetings = getMeetings();
  const meetingsByDate = {};
  meetings.forEach(m => {
    if (!meetingsByDate[m.date]) meetingsByDate[m.date] = [];
    meetingsByDate[m.date].push(m);
  });

  const grid = document.getElementById('calendar-grid');
  const days = [
    t('timetable.day_short_sun'), t('timetable.day_short_mon'), t('timetable.day_short_tue'),
    t('timetable.day_short_wed'), t('timetable.day_short_thu'), t('timetable.day_short_fri'),
    t('timetable.day_short_sat')
  ];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const today = new Date();
  today.setHours(0,0,0,0);

  let html = days.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    html += `<div class="calendar-day other-month"><div class="day-number">${day}</div></div>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayMeetings = meetingsByDate[dateStr] || [];
    const dayDate = new Date(year, month, d);
    const isToday = dayDate.getTime() === today.getTime();
    const isSelected = selectedDay === dateStr;

    html += `
      <div class="calendar-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}" onclick="selectDay('${dateStr}')">
        <div class="day-number">${d}</div>
        <div class="day-meetings">
          ${dayMeetings.slice(0, 2).map(m => `<div class="day-meeting-dot" onclick="event.stopPropagation();openEditMeetingModal('${m.id}')" title="${escapeHtml(m.title)}">${escapeHtml(m.title)}</div>`).join('')}
          ${dayMeetings.length > 2 ? `<div class="day-meeting-dot" style="background:var(--text-secondary);">+${dayMeetings.length - 2} more</div>` : ''}
        </div>
      </div>`;
  }

  // Next month fill
  const totalCells = firstDay + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    html += `<div class="calendar-day other-month"><div class="day-number">${d}</div></div>`;
  }

  grid.innerHTML = html;

  // Show day panel if selected
  if (selectedDay) showDayPanel(selectedDay);
}

function selectDay(dateStr) {
  selectedDay = dateStr;
  renderCalendar();
}

function showDayPanel(dateStr) {
  const meetings = getMeetings().filter(m => m.date === dateStr);
  const panel = document.getElementById('day-panel');
  if (!panel) return;

  if (meetings.length === 0) {
    panel.className = 'day-panel';
    panel.innerHTML = `
      <div class="card-header">
        <span class="card-title">📅 ${formatDate(dateStr)}</span>
        <button class="btn btn-primary btn-sm" onclick="openAddMeetingForDate('${dateStr}')">+ Add Meeting</button>
      </div>
      <div style="color:var(--text-secondary);font-size:14px;padding:12px 0;">No meetings on this day.</div>`;
  } else {
    panel.className = 'day-panel';
    panel.innerHTML = `
      <div class="card-header">
        <span class="card-title">📅 ${formatDate(dateStr)} — ${meetings.length} meeting${meetings.length>1?'s':''}</span>
        <button class="btn btn-primary btn-sm" onclick="openAddMeetingForDate('${dateStr}')">+ Add</button>
      </div>
      ${meetings.map(m => `
        <div class="meeting-list-item" style="margin-bottom:8px;">
          <div class="meeting-info">
            <div class="meeting-info-title">${escapeHtml(m.title)}</div>
            <div class="meeting-info-meta">${formatTime(m.time)}${m.duration ? ` · ${m.duration} min` : ''}${m.location ? ` · ${escapeHtml(m.location)}` : ''}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="openEditMeetingModal('${m.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteMeeting('${m.id}')">Del</button>
          </div>
        </div>`).join('')}`;
  }
}

function prevMonth() {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  selectedDay = null;
  document.getElementById('day-panel').classList.add('hidden');
  renderCalendar();
}

function nextMonth() {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  selectedDay = null;
  document.getElementById('day-panel').classList.add('hidden');
  renderCalendar();
}

function goToToday() {
  calendarDate = new Date();
  selectedDay = null;
  document.getElementById('day-panel').classList.add('hidden');
  renderCalendar();
}

// Week View
function renderWeekView() {
  const startDate = new Date(weekStartDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);

  const fmtShort = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  document.getElementById('week-label').textContent = `${fmtShort(startDate)} – ${fmtShort(endDate)}`;

  const today = new Date(); today.setHours(0,0,0,0);
  const meetings = getMeetings();

  // Build date strings for the week
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    weekDates.push(d);
  }

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const hours = Array.from({length: 24}, (_, i) => i);

  const grid = document.getElementById('week-grid');
  let html = '';

  // Headers
  html += `<div class="week-header"></div>`;
  weekDates.forEach((d, i) => {
    const isToday = d.getTime() === today.getTime();
    html += `<div class="week-header${isToday?' today-col':''}">${days[i]}<br><strong>${d.getDate()}</strong></div>`;
  });

  // Time slots (6am to 10pm)
  for (let h = 6; h <= 22; h++) {
    const hStr = h < 12 ? `${h}AM` : (h === 12 ? '12PM' : `${h-12}PM`);
    html += `<div class="week-time-slot">${hStr}</div>`;

    weekDates.forEach(d => {
      const dateStr = d.toISOString().split('T')[0];
      const hourMeetings = meetings.filter(m => {
        if (m.date !== dateStr) return false;
        const mHour = parseInt((m.time || '00:00').split(':')[0]);
        return mHour === h;
      });

      html += `<div class="week-cell">
        ${hourMeetings.map(m => `
          <div class="week-meeting-block" onclick="openEditMeetingModal('${m.id}')" title="${escapeHtml(m.title)}">
            ${formatTime(m.time)} ${escapeHtml(m.title)}
          </div>`).join('')}
      </div>`;
    });
  }

  grid.innerHTML = html;
}

function prevWeek() {
  weekStartDate.setDate(weekStartDate.getDate() - 7);
  renderWeekView();
}

function nextWeek() {
  weekStartDate.setDate(weekStartDate.getDate() + 7);
  renderWeekView();
}

function goToCurrentWeek() {
  weekStartDate = getWeekStart(new Date());
  renderWeekView();
}

// ============================================================
// MEETING MODAL
// ============================================================
function openAddMeetingModal() {
  document.getElementById('meeting-modal-title').textContent = t('schedule.modal_add_title');
  document.getElementById('meeting-id-input').value = '';
  document.getElementById('meeting-title-input').value = '';
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('meeting-date-input').value = today;
  document.getElementById('meeting-time-input').value = '09:00';
  document.getElementById('meeting-duration-input').value = '60';
  document.getElementById('meeting-location-input').value = '';
  document.getElementById('meeting-description-input').value = '';
  renderAttendeesChecklist([]);
  document.getElementById('meeting-modal-overlay').classList.add('active');
}

function openAddMeetingForDate(dateStr) {
  openAddMeetingModal();
  document.getElementById('meeting-date-input').value = dateStr;
}

function openEditMeetingModal(id) {
  const meetings = getMeetings();
  const m = meetings.find(x => x.id === id);
  if (!m) return;

  document.getElementById('meeting-modal-title').textContent = t('schedule.modal_edit_title');
  document.getElementById('meeting-id-input').value = m.id;
  document.getElementById('meeting-title-input').value = m.title;
  document.getElementById('meeting-date-input').value = m.date;
  document.getElementById('meeting-time-input').value = m.time || '';
  document.getElementById('meeting-duration-input').value = m.duration || '';
  document.getElementById('meeting-location-input').value = m.location || '';
  document.getElementById('meeting-description-input').value = m.description || '';
  renderAttendeesChecklist(m.attendeeIds || []);
  document.getElementById('meeting-modal-overlay').classList.add('active');
}

function renderAttendeesChecklist(selected) {
  const members = getMembers();
  const container = document.getElementById('attendees-list');
  if (!container) return;

  if (members.length === 0) {
    container.innerHTML = `<div style="color:var(--text-secondary);font-size:13px;padding:8px;">No members available. Add members first.</div>`;
    return;
  }

  container.innerHTML = members.map(m => `
    <label class="attendee-check">
      <input type="checkbox" value="${m.id}" ${selected.includes(m.id) ? 'checked' : ''}>
      ${renderAvatar(m, 'avatar-sm')}
      <span>${escapeHtml(m.name)} <span style="color:var(--text-secondary);font-size:11px;">(${escapeHtml(m.position)})</span></span>
    </label>
  `).join('');
}

function closeMeetingModal() {
  document.getElementById('meeting-modal-overlay').classList.remove('active');
}

function saveMeeting() {
  const title = document.getElementById('meeting-title-input').value.trim();
  const date = document.getElementById('meeting-date-input').value;
  const time = document.getElementById('meeting-time-input').value;

  if (!title) { showToast('Meeting title is required', 'error'); return; }
  if (!date) { showToast('Date is required', 'error'); return; }
  if (!time) { showToast('Time is required', 'error'); return; }

  const id = document.getElementById('meeting-id-input').value;
  const meetings = getMeetings();

  const attendeeIds = Array.from(document.querySelectorAll('#attendees-list input[type="checkbox"]:checked')).map(c => c.value);

  const meetingData = {
    title,
    date,
    time,
    duration: parseInt(document.getElementById('meeting-duration-input').value) || 60,
    location: document.getElementById('meeting-location-input').value.trim(),
    description: document.getElementById('meeting-description-input').value.trim(),
    attendeeIds
  };

  if (id) {
    const idx = meetings.findIndex(m => m.id === id);
    if (idx !== -1) {
      meetings[idx] = { ...meetings[idx], ...meetingData };
      addActivity(`Meeting "${title}" was updated`, 'info');
      showToast(`Meeting updated`, 'success');
    }
  } else {
    meetings.push({ id: generateId(), createdAt: new Date().toISOString(), ...meetingData });
    addActivity(`New meeting "${title}" scheduled for ${formatDate(date)}`, 'success');
    showToast(`Meeting "${title}" scheduled`, 'success');
  }

  saveMeetings(meetings);
  closeMeetingModal();
  renderSchedule();
  if (currentPage === 'dashboard') renderDashboard();
}

function deleteMeeting(id) {
  const meetings = getMeetings();
  const m = meetings.find(x => x.id === id);
  if (!m) return;

  showConfirm(
    'Delete Meeting',
    `Delete "${m.title}" on ${formatDate(m.date)}?`,
    () => {
      const updated = meetings.filter(x => x.id !== id);
      saveMeetings(updated);
      addActivity(`Meeting "${m.title}" was deleted`, 'error');
      showToast('Meeting deleted', 'info');
      renderSchedule();
      if (currentPage === 'dashboard') renderDashboard();
    }
  );
}

// ============================================================
// THEME PAGE
// ============================================================
function renderThemePage() {
  renderThemePresets();

  // Load current custom colors
  const custom = loadData(LS_CUSTOM, {});
  const currentTheme = loadData(LS_THEME, 'white-blue');
  const theme = THEMES[typeof currentTheme === 'string' ? currentTheme : 'white-blue'] || THEMES['white-blue'];

  const bg = custom.bg || theme['--bg'] || '#F8FAFF';
  const primary = custom.primary || theme['--primary'] || '#1A73E8';
  const text = custom.text || theme['--text'] || '#1a1a2e';

  document.getElementById('cp-bg').value = bg;
  document.getElementById('cp-bg-text').value = bg;
  document.getElementById('cp-primary').value = primary;
  document.getElementById('cp-primary-text').value = primary;
  document.getElementById('cp-text').value = text;
  document.getElementById('cp-text-text').value = text;

  const brightness = loadData(LS_BRIGHTNESS, 100);
  document.getElementById('brightness-slider').value = brightness;
  document.getElementById('brightness-value').textContent = `${brightness}%`;

  // Menu style
  const compact = loadData(LS_COMPACT, false);
  if (compact) {
    document.getElementById('menu-style-compact').classList.add('active');
    document.getElementById('menu-style-expanded').classList.remove('active');
  } else {
    document.getElementById('menu-style-expanded').classList.add('active');
    document.getElementById('menu-style-compact').classList.remove('active');
  }
}

function renderThemePresets() {
  const container = document.getElementById('theme-presets');
  const current = loadData(LS_THEME, 'white-blue');

  container.innerHTML = Object.entries(THEMES).map(([key, t]) => `
    <button class="theme-preset-btn${current === key ? ' active' : ''}" onclick="selectThemePreset('${key}')">
      <div class="theme-swatch" style="background:${t['--bg']};border:2px solid ${t['--border'] || '#E8ECF4'};">
        <div style="width:20px;height:20px;border-radius:50%;background:${t['--primary']};"></div>
      </div>
      ${t.emoji} ${t.name}
    </button>
  `).join('');
}

function selectThemePreset(themeName) {
  applyTheme(themeName);
  renderThemePresets();
  // Update color pickers to new theme values
  const theme = THEMES[themeName];
  document.getElementById('cp-bg').value = theme['--bg'];
  document.getElementById('cp-bg-text').value = theme['--bg'];
  document.getElementById('cp-primary').value = theme['--primary'];
  document.getElementById('cp-primary-text').value = theme['--primary'];
  document.getElementById('cp-text').value = theme['--text'];
  document.getElementById('cp-text-text').value = theme['--text'];
  showToast(`${theme.name} theme applied`, 'success');
}

// ============================================================
// NOTIFICATIONS
// ============================================================
function initNotifications() {
  // Request browser notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  checkUpcomingMeetingNotifs();
  if (notifInterval) clearInterval(notifInterval);
  notifInterval = setInterval(checkUpcomingMeetingNotifs, 60000);
}

function checkUpcomingMeetingNotifs() {
  const meetings = getMeetings();
  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 60000);

  meetings.forEach(m => {
    const mdt = getMeetingDateTime(m);
    if (mdt > now && mdt <= in60) {
      const minLeft = Math.round((mdt - now) / 60000);
      const msg = `Meeting "${m.title}" starts in ${minLeft} minute${minLeft !== 1 ? 's' : ''}`;

      showToast(msg, 'warning', 8000);

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('XENOVA — Upcoming Meeting', {
          body: msg,
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">📅</text></svg>'
        });
      }
    }
  });
}


// ============================================================
// MULTI-LANGUAGE SYSTEM
// ============================================================
function initLanguage() {
  const savedLang = localStorage.getItem(LS_LANG) || 'th';
  currentLang = savedLang;
  document.documentElement.lang = currentLang;

  const btn = document.getElementById('lang-selector-btn');
  const menu = document.getElementById('lang-dropdown-menu');
  const flagEl = document.getElementById('current-lang-flag');
  const nameEl = document.getElementById('current-lang-name');

  const curr = (typeof SUPPORTED_LANGUAGES !== 'undefined') ? (SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0]) : { flag: '🇹🇭', name: 'ไทย' };
  if (flagEl) flagEl.textContent = curr.flag;
  if (nameEl) nameEl.textContent = curr.name;

  if (btn && menu) {
    btn.onclick = (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
      const isExpanded = !menu.classList.contains('hidden');
      btn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    };
  }

  renderLanguageDropdown();
  applyTranslations();
}

function renderLanguageDropdown() {
  const menu = document.getElementById('lang-dropdown-menu');
  if (!menu || typeof SUPPORTED_LANGUAGES === 'undefined') return;
  menu.innerHTML = SUPPORTED_LANGUAGES.map(lang => `
    <button type="button" class="lang-option ${lang.code === currentLang ? 'active' : ''}" onclick="updateLanguage('${lang.code}')">
      <span class="lang-flag">${lang.flag}</span>
      <span class="lang-name">${lang.name}</span>
      ${lang.code === currentLang ? '<span class="lang-option-check">✓</span>' : ''}
    </button>
  `).join('');
}

function updateLanguage(newLang) {
  currentLang = newLang;
  localStorage.setItem(LS_LANG, newLang);
  document.documentElement.lang = newLang;

  const flagEl = document.getElementById('current-lang-flag');
  const nameEl = document.getElementById('current-lang-name');
  const curr = (typeof SUPPORTED_LANGUAGES !== 'undefined') ? (SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0]) : { flag: '🇹🇭', name: 'ไทย' };
  if (flagEl) flagEl.textContent = curr.flag;
  if (nameEl) nameEl.textContent = curr.name;

  const menu = document.getElementById('lang-dropdown-menu');
  if (menu) menu.classList.add('hidden');
  const btn = document.getElementById('lang-selector-btn');
  if (btn) btn.setAttribute('aria-expanded', 'false');

  renderLanguageDropdown();
  applyTranslations();

  // Update page title
  const titles = {
    dashboard: t('nav.dashboard'),
    members: t('nav.members'),
    schedule: t('nav.schedule'),
    timetable: t('nav.timetable'),
    theme: t('nav.theme')
  };
  const pageTitleEl = document.getElementById('page-title');
  if (pageTitleEl) pageTitleEl.textContent = titles[currentPage] || currentPage;

  updateCurrentUserUI();

  // Re-render current page
  switch (currentPage) {
    case 'dashboard': renderDashboard(); break;
    case 'members': renderMembers(); break;
    case 'schedule': renderSchedule(); break;
    case 'timetable': renderTimetable(); break;
    case 'theme': renderThemePage(); break;
  }

  showToast(t('toast.lang_changed'), 'success');
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', t(key));
  });
}

// ============================================================
// WEEKLY TIMETABLE MODULE (ตารางงานแบบตารางเรียน)
// ============================================================
function getTimetableTasks() {
  return loadData(LS_TIMETABLE, []);
}

function saveTimetableTasks(tasks) {
  saveData(LS_TIMETABLE, tasks);
}

function initTimetable() {
  loadSampleTimetableData();
  renderTimetable();
}

function loadSampleTimetableData() {
  const existing = localStorage.getItem(LS_TIMETABLE);
  if (existing !== null) {
    const parsed = JSON.parse(existing);
    if (parsed.length > 0) return;
  }

  // Pre-seed matching the user's mockup image exactly:
  // จ: 09:00 ออกแบบเว็บ (Pastel Blue)
  // อ: 10:00 ประชุมทีม (Pastel Purple)
  // พ: 09:00 ทำโปรเจกต์ (Pastel Green)
  // พฤ: 13:00 ตรวจงาน (Pastel Orange)
  // ศ: 10:00 นำเสนอ (Pastel Blue)
  // ส: ว่าง
  // อา: ว่าง
  const sample = [
    {
      id: 'tt_mon_design',
      title: 'ออกแบบเว็บ',
      dayOfWeek: 1, // จันทร์
      startTime: '09:00',
      endTime: '11:00',
      category: 'general', // Blue
      project: 'XENOVA Platform',
      assigneeName: 'Araya S.',
      collaborators: 'Nattida C.',
      repeatWeekly: true,
      notes: 'ออกแบบหน้าเว็บและ UI Components'
    },
    {
      id: 'tt_tue_meeting',
      title: 'ประชุมทีม',
      dayOfWeek: 2, // อังคาร
      startTime: '10:00',
      endTime: '11:30',
      category: 'meeting', // Purple
      project: 'Team Standup',
      assigneeName: 'Admin',
      collaborators: 'ทีมงานทุกคน',
      repeatWeekly: true,
      notes: 'ประชุมติดตามความคืบหน้าประจำสัปดาห์'
    },
    {
      id: 'tt_wed_project',
      title: 'ทำโปรเจกต์',
      dayOfWeek: 3, // พุธ
      startTime: '09:00',
      endTime: '12:00',
      category: 'completed', // Green
      project: 'Core Features',
      assigneeName: 'Tanasak P.',
      collaborators: 'Admin',
      repeatWeekly: true,
      notes: 'พัฒนาฟีเจอร์หลักของระบบ'
    },
    {
      id: 'tt_thu_review',
      title: 'ตรวจงาน',
      dayOfWeek: 4, // พฤหัสบดี
      startTime: '13:00',
      endTime: '15:00',
      category: 'urgent', // Orange / Peach
      project: 'QA & Review',
      assigneeName: 'Admin',
      collaborators: 'Kittipong R.',
      repeatWeekly: true,
      notes: 'ทดสอบระบบและตรวจเช็คคุณภาพโค้ด'
    },
    {
      id: 'tt_fri_present',
      title: 'นำเสนอ',
      dayOfWeek: 5, // ศุกร์
      startTime: '10:00',
      endTime: '11:30',
      category: 'general', // Blue
      project: 'Client Presentation',
      assigneeName: 'Araya S.',
      collaborators: 'Admin',
      repeatWeekly: true,
      notes: 'นำเสนอผลงานประจำสัปดาห์'
    }
  ];
  saveTimetableTasks(sample);
}

function renderTimetable() {
  const weekLabelEl = document.getElementById('timetable-week-label');
  if (weekLabelEl) {
    const monday = new Date(timetableWeekStart);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const locale = getLocaleCode(currentLang);
    const fmt = d => d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    weekLabelEl.textContent = `${fmt(monday)} – ${fmt(sunday)}`;
  }

  const gridContainer = document.getElementById('timetable-grid-content');
  if (!gridContainer) return;

  if (timetableViewMode === 'cards') {
    renderWeeklyCardsTimetable(gridContainer);
  } else if (timetableViewMode === 'weekly') {
    renderWeeklyTimetableGrid(gridContainer);
  } else {
    renderDailyTimetable(gridContainer);
  }
}

// Render Mockup-Style Weekly Cards Layout (เช่น จ. อ. พ. พฤ. ศ. ส. อา.)
function renderWeeklyCardsTimetable(container) {
  const daysInfo = [
    { day: 1, key: 'mon', short: 'จ.' },
    { day: 2, key: 'tue', short: 'อ.' },
    { day: 3, key: 'wed', short: 'พ.' },
    { day: 4, key: 'thu', short: 'พฤ.' },
    { day: 5, key: 'fri', short: 'ศ.' },
    { day: 6, key: 'sat', short: 'ส.' },
    { day: 0, key: 'sun', short: 'อา.' }
  ];

  const today = new Date();
  today.setHours(0,0,0,0);
  const monday = new Date(timetableWeekStart);
  const allTasks = getTimetableTasks();

  let html = `<div class="timetable-mockup-grid">`;

  daysInfo.forEach((info, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const isToday = d.getTime() === today.getTime();

    const dayTasks = allTasks.filter(t => Number(t.dayOfWeek) === info.day)
      .sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''));

    html += `
      <div class="mockup-day-col ${isToday ? 'is-today' : ''}">
        <div class="mockup-day-header">
          <span class="mockup-day-name">${info.short}</span>
          <button class="mockup-add-btn" onclick="openAddTimetableModal(${info.day}, '09:00')" title="เพิ่มงานในวันนี้">+</button>
        </div>
        <div class="mockup-day-dropzone"
             data-day="${info.day}"
             ondragover="handleTimetableDragOver(event)"
             ondragleave="handleTimetableDragLeave(event)"
             ondrop="handleTimetableDrop(event, ${info.day}, '09:00')">
    `;

    if (dayTasks.length === 0) {
      html += `
        <div class="mockup-task-card cat-empty" onclick="openAddTimetableModal(${info.day}, '09:00')">
          <div class="mockup-card-time">-</div>
          <div class="mockup-card-title">ว่าง</div>
        </div>
      `;
    } else {
      dayTasks.forEach(task => {
        html += `
          <div class="mockup-task-card cat-${task.category || 'general'}"
               draggable="true"
               ondragstart="handleTimetableDragStart(event, '${task.id}')"
               ondragend="handleTimetableDragEnd(event)"
               onclick="openTimetableDetailModal('${task.id}')"
               title="${escapeHtml(task.title)}">
            <div class="mockup-card-time">${task.startTime || '09:00'}</div>
            <div class="mockup-card-title">${escapeHtml(task.title)}</div>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderWeeklyTimetableGrid(container) {
  const daysInfo = [
    { day: 1, key: 'mon', short: t('timetable.day_short_mon') },
    { day: 2, key: 'tue', short: t('timetable.day_short_tue') },
    { day: 3, key: 'wed', short: t('timetable.day_short_wed') },
    { day: 4, key: 'thu', short: t('timetable.day_short_thu') },
    { day: 5, key: 'fri', short: t('timetable.day_short_fri') },
    { day: 6, key: 'sat', short: t('timetable.day_short_sat') },
    { day: 0, key: 'sun', short: t('timetable.day_short_sun') }
  ];

  const today = new Date();
  today.setHours(0,0,0,0);

  const monday = new Date(timetableWeekStart);
  const locale = getLocaleCode(currentLang);

  const dayDates = daysInfo.map((info, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const isToday = d.getTime() === today.getTime();
    return { ...info, date: d, isToday, dateStr: d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) };
  });

  const allTasks = getTimetableTasks();

  const hours = [];
  for (let h = 8; h <= 19; h++) {
    hours.push(String(h).padStart(2, '0') + ':00');
  }

  let html = `<table class="timetable-grid-table">
    <thead>
      <tr>
        <th class="timetable-time-th">${t('timetable.time_header')}</th>
        ${dayDates.map(d => `
          <th class="timetable-day-th ${d.isToday ? 'today-col' : ''}">
            <div>${d.short}</div>
            <div class="day-sub">${d.dateStr}</div>
          </th>
        `).join('')}
      </tr>
    </thead>
    <tbody>
  `;

  hours.forEach(hourStr => {
    const nextH = parseInt(hourStr.split(':')[0]) + 1;
    const nextHourStr = String(nextH).padStart(2, '0') + ':00';
    html += `<tr>
      <td class="timetable-time-cell">${hourStr} - ${nextHourStr}</td>`;

    daysInfo.forEach(info => {
      const slotTasks = allTasks.filter(task => {
        if (Number(task.dayOfWeek) !== info.day) return false;
        const taskStartH = parseInt((task.startTime || '08:00').split(':')[0]);
        const curH = parseInt(hourStr.split(':')[0]);
        return taskStartH === curH;
      });

      html += `<td class="timetable-slot-cell"
                   data-day="${info.day}"
                   data-time="${hourStr}"
                   ondragover="handleTimetableDragOver(event)"
                   ondragleave="handleTimetableDragLeave(event)"
                   ondrop="handleTimetableDrop(event, ${info.day}, '${hourStr}')"
                   onclick="handleSlotCellClick(event, ${info.day}, '${hourStr}')">
        ${slotTasks.map(task => `
          <div class="timetable-task-card cat-${task.category || 'general'}"
               draggable="true"
               ondragstart="handleTimetableDragStart(event, '${task.id}')"
               ondragend="handleTimetableDragEnd(event)"
               onclick="event.stopPropagation();openTimetableDetailModal('${task.id}')"
               title="${escapeHtml(task.title)}">
            <div class="timetable-task-title">${escapeHtml(task.title)}</div>
            ${task.project ? `<div class="timetable-task-project">${escapeHtml(task.project)}</div>` : ''}
            <div class="timetable-task-meta">
              <span class="timetable-task-time">⏰ ${task.startTime}-${task.endTime}</span>
              <span class="timetable-task-assignee">👤 ${escapeHtml(task.assigneeName || 'Admin')}</span>
            </div>
          </div>
        `).join('')}
      </td>`;
    });

    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function renderDailyTimetable(container) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const allTasks = getTimetableTasks().filter(t => Number(t.dayOfWeek) === dayOfWeek);

  const hours = [];
  for (let h = 8; h <= 19; h++) {
    hours.push(String(h).padStart(2, '0') + ':00');
  }

  let html = `<div class="timetable-daily-container">`;
  if (allTasks.length === 0) {
    html += `<div style="text-align:center;padding:32px;color:var(--text-secondary);font-size:14px;">${t('timetable.no_tasks_day')}</div>`;
  } else {
    hours.forEach(hourStr => {
      const nextH = parseInt(hourStr.split(':')[0]) + 1;
      const nextHourStr = String(nextH).padStart(2, '0') + ':00';
      const slotTasks = allTasks.filter(task => {
        const taskStartH = parseInt((task.startTime || '08:00').split(':')[0]);
        return taskStartH === parseInt(hourStr.split(':')[0]);
      });

      if (slotTasks.length > 0) {
        html += `<div class="timetable-daily-row">
          <div class="timetable-daily-time">${hourStr} - ${nextHourStr}</div>
          <div class="timetable-daily-tasks">
            ${slotTasks.map(task => `
              <div class="timetable-task-card cat-${task.category || 'general'}" onclick="openTimetableDetailModal('${task.id}')">
                <div class="timetable-task-title" style="font-size:14px;">${escapeHtml(task.title)}</div>
                ${task.project ? `<div class="timetable-task-project" style="font-size:12px;">📁 ${escapeHtml(task.project)}</div>` : ''}
                <div class="timetable-task-meta" style="margin-top:4px;">
                  <span>⏰ ${task.startTime} - ${task.endTime}</span>
                  <span>👤 ${escapeHtml(task.assigneeName || 'Admin')}${task.collaborators ? ' (' + escapeHtml(task.collaborators) + ')' : ''}</span>
                </div>
                ${task.notes ? `<div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">📝 ${escapeHtml(task.notes)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>`;
      }
    });
  }
  html += `</div>`;
  container.innerHTML = html;
}

// Drag & Drop Handlers
function handleTimetableDragStart(e, taskId) {
  e.dataTransfer.setData('text/plain', taskId);
  e.target.classList.add('dragging');
}

function handleTimetableDragEnd(e) {
  e.target.classList.remove('dragging');
}

function handleTimetableDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleTimetableDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleTimetableDrop(e, targetDay, targetTime) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const taskId = e.dataTransfer.getData('text/plain');
  if (!taskId) return;

  const tasks = getTimetableTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const [oldStartH] = (task.startTime || '08:00').split(':').map(Number);
  const [oldEndH] = (task.endTime || '09:00').split(':').map(Number);
  const durationH = Math.max(1, oldEndH - oldStartH);

  const [newStartH] = targetTime.split(':').map(Number);
  const newEndH = Math.min(20, newStartH + durationH);
  const newEndTime = String(newEndH).padStart(2, '0') + ':00';

  task.dayOfWeek = targetDay;
  task.startTime = targetTime;
  task.endTime = newEndTime;

  saveTimetableTasks(tasks);

  const daysNameMap = {
    1: t('timetable.day_mon'),
    2: t('timetable.day_tue'),
    3: t('timetable.day_wed'),
    4: t('timetable.day_thu'),
    5: t('timetable.day_fri'),
    6: t('timetable.day_sat'),
    0: t('timetable.day_sun')
  };

  showToast(t('toast.task_moved', { day: daysNameMap[targetDay], time: targetTime }), 'success');
  renderTimetable();
}

function handleSlotCellClick(e, day, time) {
  if (e.target.closest('.timetable-task-card')) return;
  openAddTimetableModal(day, time);
}

function prevTimetableWeek() {
  timetableWeekStart.setDate(timetableWeekStart.getDate() - 7);
  renderTimetable();
}

function nextTimetableWeek() {
  timetableWeekStart.setDate(timetableWeekStart.getDate() + 7);
  renderTimetable();
}

function goToTimetableToday() {
  timetableWeekStart = getMondayOfWeek(new Date());
  renderTimetable();
}

function switchTimetableView(mode) {
  timetableViewMode = mode;
  document.getElementById('timetable-view-cards-btn')?.classList.toggle('active', mode === 'cards');
  document.getElementById('timetable-view-weekly-btn')?.classList.toggle('active', mode === 'weekly');
  document.getElementById('timetable-view-daily-btn')?.classList.toggle('active', mode === 'daily');
  renderTimetable();
}

// Modal Handlers for Timetable
function populateTimetableTimeSelects(selectedStart = '09:00', selectedEnd = '11:00') {
  const startSelect = document.getElementById('timetable-start-time-input');
  const endSelect = document.getElementById('timetable-end-time-input');
  if (!startSelect || !endSelect) return;

  let options = '';
  for (let h = 8; h <= 20; h++) {
    const val = String(h).padStart(2, '0') + ':00';
    options += `<option value="${val}">${val}</option>`;
  }
  startSelect.innerHTML = options;
  endSelect.innerHTML = options;

  startSelect.value = selectedStart;
  endSelect.value = selectedEnd;
}

function populateTimetableAssigneeSelect(selectedId = '') {
  const select = document.getElementById('timetable-assignee-input');
  if (!select) return;

  const members = getMembers();
  let html = `<option value="admin">Admin (Group Manager)</option>`;
  members.forEach(m => {
    html += `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.position)})</option>`;
  });
  select.innerHTML = html;
  if (selectedId) select.value = selectedId;
}

function openAddTimetableModal(day = 1, startTime = '09:00') {
  document.getElementById('timetable-modal-title').textContent = t('timetable.modal_add_title');
  document.getElementById('timetable-task-id-input').value = '';
  document.getElementById('timetable-title-input').value = '';
  document.getElementById('timetable-day-input').value = day;
  document.getElementById('timetable-category-input').value = 'general';
  document.getElementById('timetable-project-input').value = '';
  document.getElementById('timetable-collab-input').value = '';
  document.getElementById('timetable-notes-input').value = '';
  document.getElementById('timetable-repeat-input').checked = true;

  const nextH = Math.min(20, parseInt(startTime.split(':')[0]) + 1);
  const endTime = String(nextH).padStart(2, '0') + ':00';
  populateTimetableTimeSelects(startTime, endTime);
  populateTimetableAssigneeSelect();

  document.getElementById('timetable-modal-overlay').classList.add('active');
}

function openEditTimetableModal(taskId) {
  closeTimetableDetailModal();
  const tasks = getTimetableTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('timetable-modal-title').textContent = t('timetable.modal_edit_title');
  document.getElementById('timetable-task-id-input').value = task.id;
  document.getElementById('timetable-title-input').value = task.title;
  document.getElementById('timetable-day-input').value = task.dayOfWeek;
  document.getElementById('timetable-category-input').value = task.category || 'general';
  document.getElementById('timetable-project-input').value = task.project || '';
  document.getElementById('timetable-collab-input').value = task.collaborators || '';
  document.getElementById('timetable-notes-input').value = task.notes || '';
  document.getElementById('timetable-repeat-input').checked = task.repeatWeekly !== false;

  populateTimetableTimeSelects(task.startTime, task.endTime);
  populateTimetableAssigneeSelect(task.assigneeId || 'admin');

  document.getElementById('timetable-modal-overlay').classList.add('active');
}

function closeTimetableModal() {
  document.getElementById('timetable-modal-overlay').classList.remove('active');
}

function saveTimetableTask() {
  const idInput = document.getElementById('timetable-task-id-input').value;
  const title = document.getElementById('timetable-title-input').value.trim();
  const dayOfWeek = parseInt(document.getElementById('timetable-day-input').value);
  const category = document.getElementById('timetable-category-input').value;
  const startTime = document.getElementById('timetable-start-time-input').value;
  const endTime = document.getElementById('timetable-end-time-input').value;
  const project = document.getElementById('timetable-project-input').value.trim();
  const assigneeSelect = document.getElementById('timetable-assignee-input');
  const assigneeId = assigneeSelect.value;
  const assigneeName = assigneeSelect.options[assigneeSelect.selectedIndex]?.text.split(' (')[0] || 'Admin';
  const collaborators = document.getElementById('timetable-collab-input').value.trim();
  const notes = document.getElementById('timetable-notes-input').value.trim();
  const repeatWeekly = document.getElementById('timetable-repeat-input').checked;

  if (!title) {
    showToast(t('validation.task_title_required'), 'error');
    return;
  }

  const startH = parseInt(startTime.split(':')[0]);
  const endH = parseInt(endTime.split(':')[0]);
  if (endH <= startH) {
    showToast(t('validation.time_invalid'), 'error');
    return;
  }

  const tasks = getTimetableTasks();
  if (idInput) {
    const idx = tasks.findIndex(t => t.id === idInput);
    if (idx !== -1) {
      tasks[idx] = {
        ...tasks[idx],
        title, dayOfWeek, category, startTime, endTime, project,
        assigneeId, assigneeName, collaborators, notes, repeatWeekly
      };
    }
  } else {
    tasks.push({
      id: 'tt_' + generateId(),
      title, dayOfWeek, category, startTime, endTime, project,
      assigneeId, assigneeName, collaborators, notes, repeatWeekly
    });
  }

  saveTimetableTasks(tasks);
  closeTimetableModal();
  showToast(t('toast.task_saved'), 'success');
  renderTimetable();
}

function deleteTimetableTask(taskId) {
  const tasks = getTimetableTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  showConfirm(
    t('dialog.delete_task_title'),
    t('dialog.delete_task_msg', { title: task.title }),
    () => {
      saveTimetableTasks(tasks.filter(t => t.id !== taskId));
      closeTimetableDetailModal();
      showToast(t('toast.task_deleted'), 'success');
      renderTimetable();
    }
  );
}

function openTimetableDetailModal(taskId) {
  const tasks = getTimetableTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  currentTimetableTaskId = taskId;

  const daysNameMap = {
    1: t('timetable.day_mon'),
    2: t('timetable.day_tue'),
    3: t('timetable.day_wed'),
    4: t('timetable.day_thu'),
    5: t('timetable.day_fri'),
    6: t('timetable.day_sat'),
    0: t('timetable.day_sun')
  };

  const catNames = {
    general: t('timetable.cat_general'),
    meeting: t('timetable.cat_meeting'),
    completed: t('timetable.cat_completed'),
    urgent: t('timetable.cat_urgent')
  };

  document.getElementById('tt-detail-name').textContent = task.title;
  document.getElementById('tt-detail-project').textContent = task.project ? '📁 ' + task.project : '';
  document.getElementById('tt-detail-day').textContent = daysNameMap[task.dayOfWeek] || '';
  document.getElementById('tt-detail-time').textContent = `${task.startTime} – ${task.endTime}`;
  document.getElementById('tt-detail-assignee').textContent = task.assigneeName || 'Admin';

  const badge = document.getElementById('tt-detail-category-badge');
  badge.className = `legend-badge cat-${task.category || 'general'}`;
  badge.innerHTML = `<span class="legend-dot"></span><span>${catNames[task.category] || catNames.general}</span>`;

  document.getElementById('tt-detail-repeat-badge').textContent = task.repeatWeekly ? '🔄 ' + t('timetable.repeat_weekly') : '';

  const collabWrap = document.getElementById('tt-detail-collab-wrap');
  if (task.collaborators) {
    collabWrap.style.display = '';
    document.getElementById('tt-detail-collab').textContent = task.collaborators;
  } else {
    collabWrap.style.display = 'none';
  }

  const notesWrap = document.getElementById('tt-detail-notes-wrap');
  if (task.notes) {
    notesWrap.style.display = '';
    document.getElementById('tt-detail-notes').textContent = task.notes;
  } else {
    notesWrap.style.display = 'none';
  }

  document.getElementById('tt-detail-edit-btn').onclick = () => openEditTimetableModal(task.id);
  document.getElementById('tt-detail-delete-btn').onclick = () => deleteTimetableTask(task.id);

  document.getElementById('timetable-detail-modal-overlay').classList.add('active');
}

function closeTimetableDetailModal() {
  document.getElementById('timetable-detail-modal-overlay').classList.remove('active');
  currentTimetableTaskId = null;
}

// ============================================================
// AUTHENTICATION & ACCOUNT ENGINE
// ============================================================
function hashPassword(password, salt = 'xenova_salt_2026') {
  let hash = 0;
  const str = password + ':' + salt;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'xhash_' + Math.abs(hash).toString(16) + '_' + str.length;
}

function initAuth() {
  let users = loadData(LS_AUTH_USERS, null);
  if (!users) {
    users = [];
  }

  // Ensure user's master account exists: xenova.gmali.com@gmail.com / Xenova17266
  const masterEmail = 'xenova.gmali.com@gmail.com';
  const existingMaster = users.find(u => u.email.toLowerCase() === masterEmail.toLowerCase());
  if (!existingMaster) {
    users.unshift({
      id: 'u_xenova_master',
      email: masterEmail,
      name: 'XENOVA Administrator',
      passwordHash: hashPassword('Xenova17266'),
      role: 'admin',
      position: 'Platform Owner (Admin)',
      createdAt: new Date().toISOString()
    });
    saveData(LS_AUTH_USERS, users);
  } else {
    // update password to ensure it matches
    existingMaster.passwordHash = hashPassword('Xenova17266');
    saveData(LS_AUTH_USERS, users);
  }

  if (users.length <= 1) {
    const defaultUsers = [
      {
        id: 'u_admin',
        email: 'admin@xenova.com',
        name: 'Admin',
        passwordHash: hashPassword('admin123'),
        role: 'admin',
        position: 'Group Manager (Admin)',
        createdAt: new Date().toISOString()
      },
      {
        id: 'mem_nattana',
        email: 'nattana@xenova.dev',
        name: 'Nattana Note',
        passwordHash: hashPassword('nattana123'),
        role: 'member',
        position: 'Creative Director & Founder',
        createdAt: new Date().toISOString()
      },
      {
        id: 'mem_ploy',
        email: 'ploy@xenova.dev',
        name: 'Ploypailin (Ploy)',
        passwordHash: hashPassword('ploy123'),
        role: 'member',
        position: 'UI/UX & Frontend Lead',
        createdAt: new Date().toISOString()
      },
      {
        id: 'mem_earth',
        email: 'earth@xenova.dev',
        name: 'Thanaphat (Earth)',
        passwordHash: hashPassword('earth123'),
        role: 'member',
        position: 'Lead Software Architect',
        createdAt: new Date().toISOString()
      },
      {
        id: 'mem_boss',
        email: 'krit@xenova.dev',
        name: 'Krit (Boss)',
        passwordHash: hashPassword('boss123'),
        role: 'member',
        position: 'Product & Operations Lead',
        createdAt: new Date().toISOString()
      }
    ];
    users.push(...defaultUsers);
    saveData(LS_AUTH_USERS, users);
  }

  const userBtn = document.getElementById('user-account-btn');
  const userMenu = document.getElementById('topbar-account-menu');
  if (userBtn && userMenu) {
    userBtn.onclick = (e) => {
      e.stopPropagation();
      userMenu.classList.toggle('hidden');
    };
  }

  checkAuthSession();
}

function getAuthSession() {
  return loadData(LS_AUTH_SESSION, null);
}

function checkAuthSession() {
  const session = getAuthSession();
  const overlay = document.getElementById('auth-overlay');
  if (!overlay) return;

  if (session && session.token && session.expiresAt > Date.now()) {
    overlay.classList.add('hidden');
    setCurrentUser({
      id: session.userId,
      name: session.name,
      role: session.role,
      email: session.email,
      position: session.position
    });
  } else {
    overlay.classList.remove('hidden');
  }
}

function switchAuthTab(tab) {
  currentAuthTab = tab;
  document.getElementById('tab-btn-signin').classList.toggle('active', tab === 'signin');
  document.getElementById('tab-btn-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('signin-form').classList.toggle('hidden', tab !== 'signin');
  document.getElementById('signup-form').classList.toggle('hidden', tab !== 'signup');

  const titleEl = document.getElementById('auth-header-title');
  const subEl = document.getElementById('auth-header-sub');
  if (tab === 'signin') {
    titleEl.textContent = t('auth.welcome_back');
    subEl.textContent = t('auth.welcome_subtitle');
  } else {
    titleEl.textContent = t('auth.create_account');
    subEl.textContent = t('auth.create_subtitle');
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPwd = input.type === 'password';
  input.type = isPwd ? 'text' : 'password';
  btn.style.opacity = isPwd ? '1' : '0.6';
}

function handleSignInSubmit(e) {
  e.preventDefault();
  if (Date.now() < lockoutUntil) {
    const minsLeft = Math.ceil((lockoutUntil - Date.now()) / 60000);
    showToast(t('auth.lockout_msg', { mins: minsLeft }), 'error');
    return;
  }

  const email = document.getElementById('signin-email').value.trim().toLowerCase();
  const password = document.getElementById('signin-password').value;
  const remember = document.getElementById('signin-remember').checked;

  const users = loadData(LS_AUTH_USERS, []);
  const user = users.find(u => u.email.toLowerCase() === email);

  if (!user || user.passwordHash !== hashPassword(password)) {
    failedLoginAttempts++;
    if (failedLoginAttempts >= 5) {
      lockoutUntil = Date.now() + 5 * 60000;
      showToast(t('auth.lockout_msg', { mins: 5 }), 'error');
    } else {
      showToast(t('validation.invalid_credentials'), 'error');
    }
    return;
  }

  failedLoginAttempts = 0;
  const session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'member',
    position: user.position || 'Member',
    token: 'jwt_' + generateId() + '_' + Date.now(),
    expiresAt: Date.now() + (remember ? 30 * 86400000 : 86400000)
  };

  saveData(LS_AUTH_SESSION, session);
  setCurrentUser({
    id: user.id,
    name: user.name,
    role: user.role,
    email: user.email,
    position: user.position
  });

  document.getElementById('auth-overlay').classList.add('hidden');
  showToast(t('toast.login_success', { name: user.name }), 'success');
  addActivity(`User ${user.name} logged in`, 'info');
}

function handleSignUpSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm-password').value;

  if (!name) {
    showToast(t('validation.name_required'), 'error');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast(t('validation.email_invalid'), 'error');
    return;
  }

  if (password.length < 6) {
    showToast(t('validation.password_short'), 'error');
    return;
  }

  if (password !== confirmPassword) {
    showToast(t('validation.password_mismatch'), 'error');
    return;
  }

  const users = loadData(LS_AUTH_USERS, []);
  if (users.some(u => u.email.toLowerCase() === email)) {
    showToast(t('validation.email_exists'), 'error');
    return;
  }

  const newId = 'u_' + generateId();
  const newUser = {
    id: newId,
    name,
    email,
    passwordHash: hashPassword(password),
    role: 'member',
    position: 'Team Member',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveData(LS_AUTH_USERS, users);

  const members = getMembers();
  members.push({
    id: newId,
    name,
    position: 'Team Member',
    bio: '',
    responsibilities: [],
    skills: [],
    email,
    phone: '',
    photo: '',
    color: randomColor(),
    createdAt: new Date().toISOString()
  });
  saveMembers(members);

  const session = {
    userId: newId,
    name,
    email,
    role: 'member',
    position: 'Team Member',
    token: 'jwt_' + generateId() + '_' + Date.now(),
    expiresAt: Date.now() + 86400000
  };
  saveData(LS_AUTH_SESSION, session);
  setCurrentUser(newUser);

  document.getElementById('auth-overlay').classList.add('hidden');
  showToast(t('toast.register_success', { name }), 'success');
  addActivity(`New user ${name} registered`, 'success');
  renderMembers();
}

function quickDemoLogin(type) {
  const users = loadData(LS_AUTH_USERS, []);
  let user = null;
  if (type === 'master') user = users.find(u => u.email.toLowerCase() === 'xenova.gmali.com@gmail.com');
  else if (type === 'admin') user = users.find(u => u.email === 'admin@xenova.com');
  else if (type === 'araya') user = users.find(u => u.email === 'araya@xenova.dev');
  else if (type === 'tanasak') user = users.find(u => u.email === 'tanasak@xenova.dev');

  if (!user && users.length > 0) user = users[0];
  if (!user) {
    user = { id: 'u_xenova_master', name: 'XENOVA Administrator', email: 'xenova.gmali.com@gmail.com', role: 'admin', position: 'Platform Owner (Admin)' };
  }

  const session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    position: user.position,
    token: 'jwt_demo_' + Date.now(),
    expiresAt: Date.now() + 86400000 * 7
  };
  saveData(LS_AUTH_SESSION, session);
  setCurrentUser(user);

  document.getElementById('auth-overlay').classList.add('hidden');
  showToast(t('toast.login_success', { name: user.name }), 'success');
  addActivity(`Demo login as ${user.name}`, 'info');
}

function handleLogout() {
  localStorage.removeItem(LS_AUTH_SESSION);
  document.getElementById('topbar-account-menu')?.classList.add('hidden');
  checkAuthSession();
  showToast(t('toast.logout_success'), 'info');
}

function openForgotPasswordModal() {
  document.getElementById('forgot-modal-overlay').classList.add('active');
}

function closeForgotPasswordModal() {
  document.getElementById('forgot-modal-overlay').classList.remove('active');
}

function handleSendResetLink() {
  const email = document.getElementById('forgot-email-input').value.trim();
  if (!email) {
    showToast(t('validation.email_invalid'), 'error');
    return;
  }
  closeForgotPasswordModal();
  showToast(t('toast.reset_sent', { email }), 'success');
}

function openAccountSettingsModal() {
  document.getElementById('topbar-account-menu')?.classList.add('hidden');
  const user = getCurrentUser();
  document.getElementById('acc-name-input').value = user.name || '';
  document.getElementById('acc-email-input').value = user.email || 'user@xenova.com';
  document.getElementById('acc-old-password').value = '';
  document.getElementById('acc-new-password').value = '';
  document.getElementById('account-settings-modal-overlay').classList.add('active');
}

function closeAccountSettingsModal() {
  document.getElementById('account-settings-modal-overlay').classList.remove('active');
}

function saveAccountSettings() {
  const user = getCurrentUser();
  const newName = document.getElementById('acc-name-input').value.trim();
  const oldPwd = document.getElementById('acc-old-password').value;
  const newPwd = document.getElementById('acc-new-password').value;

  if (!newName) {
    showToast(t('validation.name_required'), 'error');
    return;
  }

  const users = loadData(LS_AUTH_USERS, []);
  const uIdx = users.findIndex(u => u.id === user.id || u.email === user.email);

  if (oldPwd || newPwd) {
    if (newPwd.length < 6) {
      showToast(t('validation.password_short'), 'error');
      return;
    }
    if (uIdx !== -1 && users[uIdx].passwordHash !== hashPassword(oldPwd)) {
      showToast(t('validation.invalid_credentials'), 'error');
      return;
    }
    if (uIdx !== -1) {
      users[uIdx].passwordHash = hashPassword(newPwd);
    }
  }

  if (uIdx !== -1) {
    users[uIdx].name = newName;
    saveData(LS_AUTH_USERS, users);
  }

  user.name = newName;
  setCurrentUser(user);

  const session = getAuthSession();
  if (session) {
    session.name = newName;
    saveData(LS_AUTH_SESSION, session);
  }

  closeAccountSettingsModal();
  showToast(t('toast.password_changed'), 'success');
}

function handleDeleteAccount() {
  showConfirm(
    t('auth.delete_account'),
    t('common.confirm_msg'),
    () => {
      const user = getCurrentUser();
      const users = loadData(LS_AUTH_USERS, []).filter(u => u.id !== user.id && u.email !== user.email);
      saveData(LS_AUTH_USERS, users);
      closeAccountSettingsModal();
      handleLogout();
    }
  );
}

function openCloudConfigModal() {
  document.getElementById('topbar-account-menu')?.classList.add('hidden');
  const cfg = loadData(LS_CLOUD_CONFIG, {});
  document.getElementById('cloud-firebase-key').value = cfg.firebaseKey || '';
  document.getElementById('cloud-firebase-project').value = cfg.firebaseProject || '';
  document.getElementById('cloud-supabase-url').value = cfg.supabaseUrl || '';
  document.getElementById('cloud-supabase-key').value = cfg.supabaseKey || '';
  document.getElementById('cloud-config-modal-overlay').classList.add('active');
}

function closeCloudConfigModal() {
  document.getElementById('cloud-config-modal-overlay').classList.remove('active');
}

function saveCloudConfig() {
  const cfg = {
    firebaseKey: document.getElementById('cloud-firebase-key').value.trim(),
    firebaseProject: document.getElementById('cloud-firebase-project').value.trim(),
    supabaseUrl: document.getElementById('cloud-supabase-url').value.trim(),
    supabaseKey: document.getElementById('cloud-supabase-key').value.trim()
  };
  saveData(LS_CLOUD_CONFIG, cfg);
  closeCloudConfigModal();
  showToast(t('toast.cloud_saved'), 'success');
}

// ============================================================
// INIT
// ============================================================
function init() {
  initLanguage();
  loadSampleData();
  initAuth();
  initTheme();
  updateCurrentUserUI();
  navigateTo('dashboard');
  initNotifications();
  initTimetable();

  // Sidebar user switcher
  const userSwitchBtn = document.getElementById('sidebar-user-switch');
  if (userSwitchBtn) {
    userSwitchBtn.addEventListener('click', openSwitchUserModal);
  }

  // Sidebar toggle (desktop compact)
  document.getElementById('sidebar-toggle-btn').addEventListener('click', toggleSidebarCompact);

  // Hamburger (mobile)
  document.getElementById('hamburger-btn').addEventListener('click', openMobileSidebar);

  // Sidebar overlay click
  document.getElementById('sidebar-overlay').addEventListener('click', closeMobileSidebar);

  // Nav items
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Modal close on overlay click
  document.getElementById('member-modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('member-modal-overlay')) closeMemberModal();
  });
  document.getElementById('meeting-modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('meeting-modal-overlay')) closeMeetingModal();
  });
  document.getElementById('project-modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('project-modal-overlay')) closeProjectModal();
  });
  document.getElementById('switch-user-modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('switch-user-modal-overlay')) closeSwitchUserModal();
  });
  document.getElementById('timetable-modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('timetable-modal-overlay')) closeTimetableModal();
  });
  document.getElementById('timetable-detail-modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('timetable-detail-modal-overlay')) closeTimetableDetailModal();
  });
  document.getElementById('forgot-modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('forgot-modal-overlay')) closeForgotPasswordModal();
  });
  document.getElementById('account-settings-modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('account-settings-modal-overlay')) closeAccountSettingsModal();
  });
  document.getElementById('cloud-config-modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('cloud-config-modal-overlay')) closeCloudConfigModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeMemberModal();
      closeMeetingModal();
      closeProjectModal();
      closeProjectDetailModal();
      closeSwitchUserModal();
      closeTimetableModal();
      closeTimetableDetailModal();
      closeForgotPasswordModal();
      closeAccountSettingsModal();
      closeCloudConfigModal();
      closeConfirm();
      closeProfileModal();
      document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.add('hidden'));
      document.getElementById('lang-dropdown-menu')?.classList.add('hidden');
      document.getElementById('topbar-account-menu')?.classList.add('hidden');
    }
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#lang-dropdown-wrap')) {
      document.getElementById('lang-dropdown-menu')?.classList.add('hidden');
      document.getElementById('lang-selector-btn')?.setAttribute('aria-expanded', 'false');
    }
    if (!e.target.closest('#user-menu-wrap')) {
      document.getElementById('topbar-account-menu')?.classList.add('hidden');
    }
  });
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
