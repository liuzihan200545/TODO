const html = document.documentElement;
const themeToggle = document.getElementById('themeToggle');

const SUPABASE_URL = 'https://ocdllhgizeevgobypmbl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_PUEyB8EFcjGirdo_oUfb_Q_-CmrwWwB';
const SNAPSHOT_VERSION = 1;

var currentUser = null;
var syncReady = false;
var syncTimer = null;
var suppressSync = false;
var supabaseClient = null;
var appBootstrapped = false;

function getTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(t) {
  if (t === 'dark') {
    html.classList.add('dark');
    themeToggle.innerHTML = '<svg class="theme-icon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1110.2 3a7 7 0 0010.8 9.8z"/></svg>';
    themeToggle.title = '切换为浅色模式';
  } else {
    html.classList.remove('dark');
    themeToggle.innerHTML = '<svg class="theme-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M1 12h2M21 12h2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>';
    themeToggle.title = '切换为深色模式';
  }
  localStorage.setItem('theme', t);
  scheduleCloudSync();
}

applyTheme(getTheme());

themeToggle.addEventListener('click', () => {
  applyTheme(html.classList.contains('dark') ? 'light' : 'dark');
});

// username editing
const usernameEl = document.querySelector('.sidebar .username');
const avatarEl = document.querySelector('.sidebar .avatar');

function initUsername() {
  const saved = localStorage.getItem('username');
  if (saved) {
    usernameEl.textContent = saved;
    avatarEl.textContent = saved.charAt(0).toUpperCase();
  }
}
initUsername();

usernameEl.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = usernameEl.textContent;
  input.className = 'username-input';
  input.maxLength = 20;

  const finish = () => {
    const newName = input.value.trim();
    if (newName && newName !== usernameEl.textContent) {
      usernameEl.textContent = newName;
      avatarEl.textContent = newName.charAt(0).toUpperCase();
      localStorage.setItem('username', newName);
      scheduleCloudSync();
    }
    input.replaceWith(usernameEl);
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { input.blur(); }
  });

  usernameEl.replaceWith(input);
  input.focus();
  input.select();
});

// card transparency init
const savedOpacity = localStorage.getItem('cardOpacity') || '0.92';
const savedBlur = localStorage.getItem('cardBlur') || '8';
document.documentElement.style.setProperty('--card-opacity', savedOpacity);
document.documentElement.style.setProperty('--card-blur', savedBlur + 'px');

// ── Todo logic ──
const input = document.getElementById('input');
const addBtn = document.getElementById('addBtn');
const list = document.getElementById('list');
const countEl = document.getElementById('count');
const clearDoneBtn = document.getElementById('clearDone');
const dateLabel = document.getElementById('dateLabel');
const impCount = document.getElementById('impCount');
const allCount = document.getElementById('allCount');
const listTitle = document.getElementById('listTitle');
const customLists = document.getElementById('customLists');
const newListBtn = document.getElementById('newListBtn');
const newListRow = document.getElementById('newListRow');
const newListInput = document.getElementById('newListInput');
const createListBtn = document.getElementById('createListBtn');
const importRoadmapBtn = document.getElementById('importRoadmapBtn');
const roadmapFileInput = document.getElementById('roadmapFileInput');
const roadmapProjectsEl = document.getElementById('roadmapProjects');
const roadmapLabel = document.querySelector('.roadmap-label');
const addVideoBtn = document.getElementById('addVideoBtn');
const videoProjectsEl = document.getElementById('videoProjects');
const videoLabel = document.querySelector('.video-label');
const addCalendarBtn = document.getElementById('addCalendarBtn');
const calendarProjectsEl = document.getElementById('calendarProjects');
const calendarLabel = document.querySelector('.calendar-label');
const customListsLabel = document.querySelector('.custom-lists-label');
const syncForm = document.getElementById('syncForm');
const syncUser = document.getElementById('syncUser');
const syncEmail = document.getElementById('syncEmail');
const syncPassword = document.getElementById('syncPassword');
const syncLoginBtn = document.getElementById('syncLoginBtn');
const syncSignupBtn = document.getElementById('syncSignupBtn');
const syncUserEmail = document.getElementById('syncUserEmail');
const manualSyncBtn = document.getElementById('manualSyncBtn');
const syncLogoutBtn = document.getElementById('syncLogoutBtn');
const syncStatus = document.getElementById('syncStatus');
const aiSummaryBtn = document.getElementById('aiSummaryBtn');
const aiSummaryModal = document.getElementById('aiSummaryModal');
const aiSummaryBackdrop = document.getElementById('aiSummaryBackdrop');
const aiSummaryClose = document.getElementById('aiSummaryClose');
const aiSummaryDate = document.getElementById('aiSummaryDate');
const deepseekKeyInput = document.getElementById('deepseekKeyInput');
const aiGenerateBtn = document.getElementById('aiGenerateBtn');
const aiSummaryStatus = document.getElementById('aiSummaryStatus');
const aiSummaryResult = document.getElementById('aiSummaryResult');
const aiSummaryHistory = document.getElementById('aiSummaryHistory');

let searchQuery = '';
let activeListId = 'tasks';
let videoContextMenu = null;
let aiContextMenu = null;
let aiSummaryType = 'daily';

const defaultLists = [
  { id: 'myday', name: '我的一天', icon: 'sun' },
  { id: 'important', name: '重要', icon: 'star' },
  { id: 'planned', name: '计划内', icon: 'calendar' },
  { id: 'tasks', name: '任务', icon: 'list' },
];

const DEFAULT_SIDEBAR_LABELS = {
  'group.roadmap': '路线图',
  'group.video': '视频学习',
  'group.calendar': '日历栏',
  'group.custom': '我的列表',
};

function loadSidebarLabels() {
  try {
    const saved = JSON.parse(localStorage.getItem('sidebarLabels')) || {};
    delete saved['nav.myday'];
    delete saved['nav.important'];
    delete saved['nav.planned'];
    delete saved['nav.tasks'];
    return { ...DEFAULT_SIDEBAR_LABELS, ...saved };
  } catch (e) {
    return { ...DEFAULT_SIDEBAR_LABELS };
  }
}

let sidebarLabels = loadSidebarLabels();
let activeRenameContext = null;

function getSidebarLabel(key) {
  return sidebarLabels[key] || DEFAULT_SIDEBAR_LABELS[key] || '';
}

function saveSidebarLabels() {
  delete sidebarLabels['nav.myday'];
  delete sidebarLabels['nav.important'];
  delete sidebarLabels['nav.planned'];
  delete sidebarLabels['nav.tasks'];
  localStorage.setItem('sidebarLabels', JSON.stringify(sidebarLabels));
  scheduleCloudSync();
}

function renameSidebarLabel(key, nextName) {
  if (key.startsWith('nav.')) return;
  const name = String(nextName || '').trim();
  if (!name) return;
  sidebarLabels[key] = name;
  saveSidebarLabels();
  renderSidebar();
  switchToList(activeListId);
}

function loadLists() {
  let data = localStorage.getItem('todoLists');
  if (data) return JSON.parse(data);

  // migrate old single-list data
  const oldTodos = localStorage.getItem('todos');
  if (oldTodos) {
    const parsed = JSON.parse(oldTodos);
    localStorage.removeItem('todos');
    return [
      { id: 'myday', name: '我的一天', todos: [] },
      { id: 'important', name: '重要', todos: [] },
      { id: 'planned', name: '计划内', todos: [] },
      { id: 'tasks', name: '任务', todos: parsed },
    ];
  }

  return defaultLists.map(d => ({ ...d, todos: [] }));
}

function saveLists(listsData) {
  localStorage.setItem('todoLists', JSON.stringify(listsData));
  scheduleCloudSync();
}

const loadedLists = loadLists();
let lists = loadedLists.filter(l => l.id !== 'roadmap');
if (lists.length !== loadedLists.length) saveLists(lists);
activeListId = localStorage.getItem('activeListId') || 'tasks';

function loadRoadmapProjects() {
  try {
    const projects = JSON.parse(localStorage.getItem('roadmapProjects')) || [];
    if (Array.isArray(projects)) return projects;
  } catch (e) {}

  try {
    const oldDoc = JSON.parse(localStorage.getItem('roadmapDoc')) || null;
    if (oldDoc) {
      const migrated = [{ ...oldDoc, id: 'roadmap_project_' + Date.now() }];
      localStorage.setItem('roadmapProjects', JSON.stringify(migrated));
      localStorage.removeItem('roadmapDoc');
      return migrated;
    }
  } catch (e) {}

  return [];
}

function saveRoadmapProjects() {
  localStorage.setItem('roadmapProjects', JSON.stringify(roadmapProjects));
  scheduleCloudSync();
}

let roadmapProjects = loadRoadmapProjects();

function loadVideoProjects() {
  try {
    const projects = JSON.parse(localStorage.getItem('videoProjects')) || [];
    if (Array.isArray(projects)) return projects.map(normalizeVideoProject);
  } catch (e) {}
  return [];
}

function saveVideoProjects() {
  videoProjects = videoProjects.map(normalizeVideoProject);
  localStorage.setItem('videoProjects', JSON.stringify(videoProjects));
  scheduleCloudSync();
}

let videoProjects = loadVideoProjects();

function normalizeVideoCollection(collection) {
  collection = collection || {};
  const videos = Array.isArray(collection.videos) ? collection.videos.map(normalizeVideoProject) : [];
  return {
    id: collection.id || 'video_collection_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name: collection.name || collection.title || '默认收藏夹',
    videos,
    createdAt: collection.createdAt || new Date().toISOString(),
  };
}

function loadVideoCollections() {
  try {
    const collections = JSON.parse(localStorage.getItem('videoCollections')) || [];
    if (Array.isArray(collections) && collections.length) return collections.map(normalizeVideoCollection);
  } catch (e) {}

  const legacyVideos = videoProjects.map(normalizeVideoProject);
  if (legacyVideos.length) {
    return [normalizeVideoCollection({
      id: 'video_collection_default',
      name: '默认收藏夹',
      videos: legacyVideos,
      createdAt: new Date().toISOString(),
    })];
  }
  return [];
}

function saveVideoCollections() {
  videoCollections = videoCollections.map(normalizeVideoCollection);
  localStorage.setItem('videoCollections', JSON.stringify(videoCollections));
  videoProjects = videoCollections.flatMap(collection => collection.videos);
  localStorage.setItem('videoProjects', JSON.stringify(videoProjects));
  scheduleCloudSync();
}

let videoCollections = loadVideoCollections();
if (videoCollections.length && !localStorage.getItem('videoCollections')) {
  localStorage.setItem('videoCollections', JSON.stringify(videoCollections));
}

function normalizeCalendarProject(project) {
  project = project || {};
  const days = project.days && typeof project.days === 'object' ? project.days : {};
  return {
    id: project.id || 'calendar_project_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name: project.name || project.title || '打卡项目',
    days,
    createdAt: project.createdAt || new Date().toISOString(),
  };
}

function loadCalendarProjects() {
  try {
    const projects = JSON.parse(localStorage.getItem('calendarProjects')) || [];
    if (Array.isArray(projects)) return projects.map(normalizeCalendarProject);
  } catch (e) {}
  return [];
}

function saveCalendarProjects() {
  calendarProjects = calendarProjects.map(normalizeCalendarProject);
  localStorage.setItem('calendarProjects', JSON.stringify(calendarProjects));
  scheduleCloudSync();
}

let calendarProjects = loadCalendarProjects();

function loadAiSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem('aiSettings')) || {};
    return {
      deepseekApiKey: settings.deepseekApiKey || '',
      model: settings.model || 'deepseek-chat',
    };
  } catch (e) {
    return { deepseekApiKey: '', model: 'deepseek-chat' };
  }
}

function normalizeAiSummary(summary) {
  summary = summary || {};
  const nowIso = new Date().toISOString();
  const now = new Date();
  const fallbackDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    id: summary.id || 'ai_summary_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    type: summary.type === 'weekly' ? 'weekly' : 'daily',
    periodKey: summary.periodKey || fallbackDateKey,
    title: summary.title || 'AI 总结',
    inputStats: summary.inputStats || {},
    content: summary.content || '',
    createdAt: summary.createdAt || nowIso,
    updatedAt: summary.updatedAt || summary.createdAt || nowIso,
  };
}

function loadAiSummaries() {
  try {
    const summaries = JSON.parse(localStorage.getItem('aiSummaries')) || [];
    return Array.isArray(summaries) ? summaries.map(normalizeAiSummary) : [];
  } catch (e) {
    return [];
  }
}

function saveAiData() {
  aiSettings.model = aiSettings.model || 'deepseek-chat';
  aiSummaries = aiSummaries.map(normalizeAiSummary);
  localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
  localStorage.setItem('aiSummaries', JSON.stringify(aiSummaries));
  scheduleCloudSync();
}

let aiSettings = loadAiSettings();
let aiSummaries = loadAiSummaries();

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseBvid(url) {
  const text = String(url || '');
  const match = text.match(/\b(BV[a-zA-Z0-9]{8,})\b/i);
  return match ? match[1] : '';
}

function normalizeBvid(input) {
  const bvid = parseBvid(input);
  return bvid ? 'BV' + bvid.slice(2) : '';
}

function getBilibiliVideoUrl(bvid) {
  return 'https://www.bilibili.com/video/' + encodeURIComponent(bvid);
}

function normalizeCoverUrl(url) {
  if (!url) return '';
  const text = String(url).trim();
  if (!text) return '';
  if (text.includes('images.weserv.nl')) return text;
  if (text.startsWith('//')) return 'https:' + text;
  const httpsUrl = text.startsWith('http://') ? 'https://' + text.slice('http://'.length) : text;
  try {
    const parsed = new URL(httpsUrl);
    if (parsed.hostname.endsWith('hdslb.com')) {
      return 'https://images.weserv.nl/?url=' + encodeURIComponent(parsed.hostname + parsed.pathname + parsed.search);
    }
  } catch (e) {}
  return httpsUrl;
}

function normalizeVideoProject(video) {
  video = video || {};
  const nowIso = new Date().toISOString();
  const progress = clampPercent(video.progressPercent !== undefined ? video.progressPercent : (video.done ? 100 : 0));
  const done = video.done === true || progress >= 100;
  return {
    id: video.id || 'video_project_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    title: video.title || getBilibiliVideoTitle(video.url || ''),
    url: video.url || '',
    bvid: normalizeBvid(video.bvid || video.url || ''),
    cover: normalizeCoverUrl(video.cover || ''),
    duration: Number.isFinite(Number(video.duration)) ? Math.max(0, Math.round(Number(video.duration))) : 0,
    progressPercent: progress,
    done,
    completedAt: done && video.completedAt ? video.completedAt : null,
    myDay: video.myDay || null,
    createdAt: video.createdAt || nowIso,
    updatedAt: video.updatedAt || video.createdAt || nowIso,
  };
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseDurationInput(value) {
  const text = String(value || '').trim();
  if (!text) return 0;
  if (/^\d+$/.test(text)) return Number(text);
  const parts = text.split(':').map(part => Number(part));
  if (parts.some(part => !Number.isFinite(part) || part < 0)) return 0;
  if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
  if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return 0;
}

function getVideoProgress(video) {
  return clampPercent(video && video.progressPercent);
}

function getVideoStats() {
  const videos = getActiveVideoCollection() ? getActiveVideoCollection().videos : videoCollections.flatMap(collection => collection.videos);
  const total = videos.length;
  const done = videos.filter(video => normalizeVideoProject(video).done).length;
  const avg = total
    ? Math.round(videos.reduce((sum, video) => sum + getVideoProgress(video), 0) / total)
    : 0;
  return { total, done, avg };
}

function getMyDayVideoEntries() {
  const today = todayStr();
  const entries = [];
  videoCollections.forEach(collection => {
    (collection.videos || []).forEach(video => {
      if (video.myDay === today) entries.push({ collection, video });
    });
  });
  return entries;
}

function getMyDayVideoSuggestions() {
  const today = todayStr();
  const entries = [];
  videoCollections.forEach(collection => {
    (collection.videos || []).forEach(video => {
      if (!video.done && video.myDay !== today) entries.push({ collection, video });
    });
  });
  return entries;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toLocalDateKeyFromIso(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso).slice(0, 10);
  return toDateKey(date);
}

function formatLocalTimeFromIso(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getWeekDates(baseDate) {
  const base = new Date(baseDate || new Date());
  base.setHours(0, 0, 0, 0);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

function getWeekPeriodKey(dateKey) {
  const dates = getWeekDates(parseDateKey(dateKey));
  return toDateKey(dates[0]) + '_' + toDateKey(dates[6]);
}

function parseDateKey(key) {
  const parts = String(key || '').split('-').map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
}

function formatAiPeriod(type, dateKey) {
  if (type === 'weekly') {
    const dates = getWeekDates(parseDateKey(dateKey));
    return toDateKey(dates[0]) + ' 至 ' + toDateKey(dates[6]);
  }
  return dateKey;
}

function isIsoDateInRange(iso, startKey, endKey) {
  if (!iso) return false;
  const key = toLocalDateKeyFromIso(iso);
  return key >= startKey && key <= endKey;
}

function buildCompletedTimeFields(completedAt) {
  return {
    completedAt,
    completedLocalDate: toLocalDateKeyFromIso(completedAt),
    completedLocalTime: formatLocalTimeFromIso(completedAt),
  };
}

function getAiPeriodInfo(type, dateKey) {
  const safeDateKey = dateKey || todayStr();
  if (type === 'weekly') {
    const dates = getWeekDates(parseDateKey(safeDateKey));
    return {
      type: 'weekly',
      label: formatAiPeriod('weekly', safeDateKey),
      periodKey: getWeekPeriodKey(safeDateKey),
      startKey: toDateKey(dates[0]),
      endKey: toDateKey(dates[6]),
      dates: dates.map(toDateKey),
    };
  }
  return {
    type: 'daily',
    label: safeDateKey,
    periodKey: safeDateKey,
    startKey: safeDateKey,
    endKey: safeDateKey,
    dates: [safeDateKey],
  };
}

function getCompletedTodoEntries(period) {
  const entries = [];
  let unknown = 0;
  lists.forEach(listItem => {
    (listItem.todos || []).forEach(todo => {
      if (!todo.done) return;
      if (!todo.completedAt) {
        unknown += 1;
        return;
      }
      if (isIsoDateInRange(todo.completedAt, period.startKey, period.endKey)) {
        entries.push({
          text: todo.text,
          list: listItem.name,
          ...buildCompletedTimeFields(todo.completedAt),
        });
      }
    });
  });
  return { entries, unknown };
}

function getOpenTodoEntries(limit) {
  const entries = [];
  lists.forEach(listItem => {
    (listItem.todos || []).forEach(todo => {
      if (!todo.done) entries.push({ text: todo.text, list: listItem.name, dueDate: todo.dueDate || '' });
    });
  });
  return entries.slice(0, limit || 20);
}

function getCompletedRoadmapEntries(period) {
  const entries = [];
  let unknown = 0;
  let open = 0;
  roadmapProjects.forEach(project => {
    (project.items || []).forEach(item => {
      if (item.type !== 'task') return;
      if (!item.done) {
        open += 1;
        return;
      }
      if (!item.completedAt) {
        unknown += 1;
        return;
      }
      if (isIsoDateInRange(item.completedAt, period.startKey, period.endKey)) {
        entries.push({ text: item.text, project: project.title, ...buildCompletedTimeFields(item.completedAt) });
      }
    });
  });
  return { entries, unknown, open };
}

function getVideoSummaryEntries(period) {
  const completed = [];
  let unknown = 0;
  let inProgress = 0;
  videoCollections.forEach(collection => {
    (collection.videos || []).forEach(rawVideo => {
      const video = normalizeVideoProject(rawVideo);
      if (video.done) {
        if (!video.completedAt) {
          unknown += 1;
        } else if (isIsoDateInRange(video.completedAt, period.startKey, period.endKey)) {
          completed.push({ title: video.title, collection: collection.name, ...buildCompletedTimeFields(video.completedAt) });
        }
      } else if (video.progressPercent > 0) {
        inProgress += 1;
      }
    });
  });
  return { completed, unknown, inProgress };
}

function getCalendarSummaryEntries(period) {
  const entries = [];
  const byDate = {};
  period.dates.forEach(dateKey => { byDate[dateKey] = []; });
  calendarProjects.forEach(project => {
    period.dates.forEach(dateKey => {
      if (project.days && project.days[dateKey]) {
        const item = { project: project.name, date: dateKey };
        entries.push(item);
        byDate[dateKey].push(project.name);
      }
    });
  });
  return { entries, byDate };
}

function buildAiSummaryInput(type, dateKey) {
  const period = getAiPeriodInfo(type, dateKey);
  const todos = getCompletedTodoEntries(period);
  const roadmaps = getCompletedRoadmapEntries(period);
  const videos = getVideoSummaryEntries(period);
  const calendars = getCalendarSummaryEntries(period);
  const openTodos = getOpenTodoEntries(25);
  const stats = {
    completedTodos: todos.entries.length,
    completedRoadmapTasks: roadmaps.entries.length,
    completedVideos: videos.completed.length,
    calendarCheckins: calendars.entries.length,
    openTodos: openTodos.length,
    unknownCompleted: todos.unknown + roadmaps.unknown + videos.unknown,
  };
  return {
    type,
    period,
    stats,
    completed: {
      todos: todos.entries,
      roadmapTasks: roadmaps.entries,
      videos: videos.completed,
      calendarCheckins: calendars.entries,
    },
    open: {
      todos: openTodos,
      roadmapTaskCount: roadmaps.open,
      videoInProgressCount: videos.inProgress,
    },
    unknownCompleted: {
      todos: todos.unknown,
      roadmapTasks: roadmaps.unknown,
      videos: videos.unknown,
    },
    calendarByDate: calendars.byDate,
  };
}

function getCurrentAiPeriodKey() {
  const dateKey = aiSummaryDate && aiSummaryDate.value ? aiSummaryDate.value : todayStr();
  return getAiPeriodInfo(aiSummaryType, dateKey).periodKey;
}

function findAiSummary(type, periodKey) {
  return aiSummaries.find(summary => summary.type === type && summary.periodKey === periodKey) || null;
}

function closeAiContextMenu() {
  if (aiContextMenu) {
    aiContextMenu.remove();
    aiContextMenu = null;
  }
}

function openAiSummaryContextMenu(event, summary) {
  event.preventDefault();
  event.stopPropagation();
  closeAiContextMenu();
  closeVideoContextMenu();

  const menu = document.createElement('div');
  menu.className = 'video-context-menu ai-context-menu';
  const del = document.createElement('button');
  del.type = 'button';
  del.textContent = '删除总结';
  del.addEventListener('click', () => {
    closeAiContextMenu();
    if (!confirm('确定删除这条 AI 总结吗？')) return;
    aiSummaries = aiSummaries.filter(item => item.id !== summary.id);
    saveAiData();
    renderAiHistory();
    updateAiSummaryMode();
    setAiStatus('已删除总结', 'ok');
  });
  menu.appendChild(del);
  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  const x = Math.min(event.clientX, window.innerWidth - rect.width - 8);
  const y = Math.min(event.clientY, window.innerHeight - rect.height - 8);
  menu.style.left = Math.max(8, x) + 'px';
  menu.style.top = Math.max(8, y) + 'px';
  aiContextMenu = menu;
}

function setAiStatus(message, state) {
  if (!aiSummaryStatus) return;
  aiSummaryStatus.textContent = message || '';
  aiSummaryStatus.className = 'ai-status' + (state ? ' ' + state : '');
}

function cleanAiText(text) {
  return String(text || '')
    .replace(/```(?:json|markdown|md)?/gi, '')
    .replace(/```/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/\*/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[\s>*-]+/gm, '')
    .trim();
}

function appendAiText(parent, text) {
  const node = document.createElement('p');
  node.textContent = cleanAiText(text) || '暂无内容。';
  parent.appendChild(node);
}

function normalizeAiCard(card) {
  if (typeof card === 'string') return { summary: card, bullets: [] };
  card = card || {};
  return {
    summary: cleanAiText(card.summary),
    bullets: Array.isArray(card.bullets)
      ? card.bullets.map(cleanAiText).filter(Boolean).slice(0, 6)
      : [],
  };
}

function extractJsonObjectText(text) {
  const raw = String(text || '');
  const start = raw.indexOf('{');
  if (start < 0) return '';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }
  return raw.slice(start).trim();
}

function parseJsonMaybeWrapped(text) {
  const candidates = [];
  const raw = String(text || '').trim();
  if (!raw) return null;
  candidates.push(raw);
  const extracted = extractJsonObjectText(raw);
  if (extracted && extracted !== raw) candidates.push(extracted);
  candidates.push(...candidates.map(candidate => candidate
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u0000-\u001f]+/g, ' ')
  ));

  for (const candidate of candidates) {
    try {
      let parsed = JSON.parse(candidate);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {}
  }
  return null;
}

function extractJsonLikeSection(raw, key) {
  const text = String(raw || '');
  const keyIndex = text.search(new RegExp("[\"']?" + key + "[\"']?\\s*:"));
  if (keyIndex < 0) return null;
  const braceStart = text.indexOf('{', keyIndex);
  if (braceStart < 0) return null;
  return extractJsonObjectText(text.slice(braceStart));
}

function decodeLooseJsonString(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return JSON.parse('"' + raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
  } catch (e) {
    return raw;
  }
}

function parseLooseBulletList(text) {
  const raw = String(text || '');
  const matches = raw.match(/"((?:\\.|[^"\\])*)"/g) || raw.match(/'((?:\\.|[^'\\])*)'/g) || [];
  return matches
    .map(item => decodeLooseJsonString(item.slice(1, -1)))
    .filter(Boolean)
    .slice(0, 6);
}

function parseLooseAiJsonContent(content) {
  const raw = extractJsonObjectText(content) || String(content || '');
  const result = {};
  ['overview', 'highlights', 'problems', 'nextSteps'].forEach(key => {
    const section = extractJsonLikeSection(raw, key);
    if (!section) return;
    const summaryMatch = section.match(/["']summary["']\s*:\s*"((?:\\.|[^"\\])*)"/)
      || section.match(/["']summary["']\s*:\s*'((?:\\.|[^'\\])*)'/);
    const bulletsMatch = section.match(/["']bullets["']\s*:\s*\[([\s\S]*?)\]/);
    result[key] = {
      summary: summaryMatch ? decodeLooseJsonString(summaryMatch[1]) : '',
      bullets: bulletsMatch ? parseLooseBulletList(bulletsMatch[1]) : [],
    };
  });
  return Object.keys(result).length ? result : null;
}

function parseAiJsonContent(content) {
  const raw = String(content || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = fenced ? fenced[1].trim() : raw;
  return parseJsonMaybeWrapped(text) || parseJsonMaybeWrapped(raw) || parseLooseAiJsonContent(text) || parseLooseAiJsonContent(raw);
}

function splitLegacyAiContent(content) {
  const raw = String(content || '').trim();
  if (!raw) return {};
  const sectionMap = [
    ['overview', /完成概况|概况|总结/],
    ['highlights', /亮点|做得好|优势/],
    ['problems', /问题|不足|风险|卡点/],
    ['nextSteps', /下一步建议|建议|下一步|行动/],
  ];
  const lines = raw.split(/\r?\n/);
  const sections = {};
  let current = 'overview';
  sections[current] = [];

  lines.forEach(line => {
    const clean = line.replace(/^#+\s*/, '').replace(/^[\s>*-]*\d*[.、)]?\s*/, '').trim();
    const matched = sectionMap.find(([, pattern]) => pattern.test(clean.replace(/[:：]$/, '')));
    if (matched && clean.length <= 18) {
      current = matched[0];
      if (!sections[current]) sections[current] = [];
      return;
    }
    if (!sections[current]) sections[current] = [];
    if (clean) sections[current].push(clean);
  });

  return Object.fromEntries(Object.entries(sections).map(([key, values]) => {
    const bullets = values.filter(line => /^[-*•]/.test(line)).map(line => line.replace(/^[-*•]\s*/, ''));
    const prose = values.filter(line => !/^[-*•]/.test(line));
    return [key, {
      summary: prose[0] || values[0] || '',
      bullets: bullets.length ? bullets : prose.slice(1, 6),
    }];
  }));
}

function getAiDisplayData(summary) {
  const parsed = parseAiJsonContent(summary && summary.content);
  if (parsed) {
    return {
      overview: normalizeAiCard(parsed.overview),
      highlights: normalizeAiCard(parsed.highlights),
      problems: normalizeAiCard(parsed.problems),
      nextSteps: normalizeAiCard(parsed.nextSteps),
    };
  }
  const legacy = splitLegacyAiContent(summary && summary.content);
  return {
    overview: normalizeAiCard(legacy.overview || { summary: summary && summary.content }),
    highlights: normalizeAiCard(legacy.highlights),
    problems: normalizeAiCard(legacy.problems),
    nextSteps: normalizeAiCard(legacy.nextSteps),
  };
}

function renderAiStats(stats) {
  const grid = document.createElement('div');
  grid.className = 'ai-stats-grid';
  const items = [
    ['Todo', stats.completedTodos || 0],
    ['路线图', stats.completedRoadmapTasks || 0],
    ['视频', stats.completedVideos || 0],
    ['打卡', stats.calendarCheckins || 0],
    ['时间未知', stats.unknownCompleted || 0],
  ];
  items.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'ai-stat-item';
    item.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
    grid.appendChild(item);
  });
  return grid;
}

function renderAiCard(title, card, tone) {
  const section = document.createElement('section');
  section.className = 'ai-summary-card' + (tone ? ' ' + tone : '');
  const heading = document.createElement('h3');
  heading.className = 'ai-card-title';
  heading.textContent = title;
  section.appendChild(heading);
  appendAiText(section, card.summary);
  if (card.bullets && card.bullets.length) {
    const listEl = document.createElement('ul');
    listEl.className = 'ai-card-list';
    card.bullets.forEach(item => {
      const li = document.createElement('li');
      li.textContent = cleanAiText(item);
      listEl.appendChild(li);
    });
    section.appendChild(listEl);
  }
  return section;
}

function renderAiSummaryContent(summary) {
  if (!aiSummaryResult) return;
  aiSummaryResult.innerHTML = '';
  if (!summary) {
    const empty = document.createElement('div');
    empty.className = 'ai-result-empty';
    empty.textContent = '这个时间段还没有保存的总结。';
    aiSummaryResult.appendChild(empty);
    return;
  }
  const title = document.createElement('div');
  title.className = 'ai-result-title';
  title.innerHTML = `<strong>${summary.title || 'AI 总结'}</strong><span>${summary.updatedAt ? '更新于 ' + summary.updatedAt.slice(0, 16).replace('T', ' ') : ''}</span>`;
  aiSummaryResult.appendChild(title);
  aiSummaryResult.appendChild(renderAiStats(summary.inputStats || {}));

  const data = getAiDisplayData(summary);
  const cards = document.createElement('div');
  cards.className = 'ai-card-grid';
  cards.appendChild(renderAiCard('完成概况', data.overview, 'overview'));
  cards.appendChild(renderAiCard('亮点', data.highlights, 'highlights'));
  cards.appendChild(renderAiCard('问题', data.problems, 'problems'));
  cards.appendChild(renderAiCard('下一步建议', data.nextSteps, 'next'));
  aiSummaryResult.appendChild(cards);
}

function renderAiHistory() {
  if (!aiSummaryHistory) return;
  aiSummaryHistory.innerHTML = '';
  const sorted = aiSummaries
    .slice()
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, 12);
  if (!sorted.length) {
    aiSummaryHistory.innerHTML = '<div class="ai-history-empty">还没有生成过总结。</div>';
    return;
  }
  sorted.forEach(summary => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ai-history-item';
    btn.innerHTML = `<strong>${summary.title}</strong><span>${summary.type === 'weekly' ? '周总结' : '日总结'} · ${summary.periodKey}</span>`;
    btn.addEventListener('contextmenu', (event) => openAiSummaryContextMenu(event, summary));
    btn.addEventListener('click', () => {
      aiSummaryType = summary.type;
      if (aiSummaryDate) {
        aiSummaryDate.value = summary.type === 'weekly' ? summary.periodKey.slice(0, 10) : summary.periodKey;
      }
      updateAiSummaryMode();
      renderAiSummaryContent(summary);
      setAiStatus('已打开历史总结', 'ok');
    });
    aiSummaryHistory.appendChild(btn);
  });
}

function updateAiSummaryMode() {
  document.querySelectorAll('[data-summary-type]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.summaryType === aiSummaryType);
  });
  const dateKey = aiSummaryDate && aiSummaryDate.value ? aiSummaryDate.value : todayStr();
  const period = getAiPeriodInfo(aiSummaryType, dateKey);
  const existing = findAiSummary(aiSummaryType, period.periodKey);
  renderAiSummaryContent(existing);
  if (existing) {
    setAiStatus('已加载 ' + period.label + ' 的已保存总结', 'ok');
  } else {
    setAiStatus('当前范围：' + period.label, '');
  }
}

function openAiSummaryModal() {
  if (!aiSummaryModal) return;
  aiSummaryModal.hidden = false;
  if (aiSummaryDate && !aiSummaryDate.value) aiSummaryDate.value = todayStr();
  if (deepseekKeyInput) deepseekKeyInput.value = aiSettings.deepseekApiKey || '';
  updateAiSummaryMode();
  renderAiHistory();
}

function closeAiSummaryModal() {
  if (aiSummaryModal) aiSummaryModal.hidden = true;
}

function buildDeepSeekPrompt(inputData) {
  return [
    '请基于下面这份任务数据，生成一份中文' + (inputData.type === 'weekly' ? '每周' : '每日') + '总结和评价。',
    '只返回合法 JSON，不要 Markdown，不要代码块，不要额外解释。',
    'JSON 字段必须严格为：{"overview":{"summary":"","bullets":[]},"highlights":{"summary":"","bullets":[]},"problems":{"summary":"","bullets":[]},"nextSteps":{"summary":"","bullets":[]}}。',
    '四个字段分别对应“完成概况 / 亮点 / 问题 / 下一步建议”。summary 用一句具体评价，bullets 放 2 到 4 条要点。',
    'summary 和 bullets 里的文字都不要使用 **加粗**、*斜体*、反引号、标题符号或任何 Markdown 标记。',
    '要求：简洁、具体、有判断；不要空泛鸡汤，要引用真实任务名称。',
    '如果完成时间未知，只说明旧完成项无法归入本周期，不要把它们算作本周期成果。',
    '',
    JSON.stringify(inputData, null, 2),
  ].join('\n');
}

function getDeepSeekErrorMessage(error, response) {
  if (response && response.status === 401) return 'DeepSeek API Key 无效或没有权限。';
  if (response && response.status === 402) return 'DeepSeek 账户余额不足或计费状态异常。';
  if (response && response.status === 429) return 'DeepSeek 调用过于频繁，请稍后再试。';
  if (response && response.status >= 500) return 'DeepSeek 服务暂时不可用，请稍后重试。';
  if (error && error.name === 'TypeError') return '网络请求失败，可能是浏览器跨域限制、网络中断或接口不可达。';
  return (error && error.message) || '生成失败，请稍后重试。';
}

async function requestDeepSeekSummary(inputData) {
  const apiKey = (aiSettings.deepseekApiKey || '').trim();
  if (!apiKey) throw new Error('请先填写 DeepSeek API Key。');
  let response;
  try {
    response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: aiSettings.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个严谨、具体、不过度夸张的个人效率复盘助手。' },
          { role: 'user', content: buildDeepSeekPrompt(inputData) },
        ],
        temperature: 0.5,
        max_tokens: 1200,
      }),
    });
  } catch (error) {
    throw new Error(getDeepSeekErrorMessage(error));
  }

  let data = null;
  try { data = await response.json(); } catch (e) {}
  if (!response.ok) {
    const message = data && data.error && data.error.message ? data.error.message : getDeepSeekErrorMessage(null, response);
    throw new Error(message);
  }
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error('DeepSeek 没有返回可用内容。');
  return content.trim();
}

async function generateAiSummary() {
  if (!aiGenerateBtn) return;
  const key = deepseekKeyInput ? deepseekKeyInput.value.trim() : '';
  aiSettings.deepseekApiKey = key;
  aiSettings.model = aiSettings.model || 'deepseek-chat';
  saveAiData();

  const dateKey = aiSummaryDate && aiSummaryDate.value ? aiSummaryDate.value : todayStr();
  const inputData = buildAiSummaryInput(aiSummaryType, dateKey);
  aiGenerateBtn.disabled = true;
  setAiStatus('正在生成总结...', '');
  try {
    const content = await requestDeepSeekSummary(inputData);
    const nowIso = new Date().toISOString();
    const existing = findAiSummary(aiSummaryType, inputData.period.periodKey);
    const nextSummary = normalizeAiSummary({
      id: existing ? existing.id : undefined,
      type: aiSummaryType,
      periodKey: inputData.period.periodKey,
      title: (aiSummaryType === 'weekly' ? '周总结 · ' : '日总结 · ') + inputData.period.label,
      inputStats: inputData.stats,
      content,
      createdAt: existing ? existing.createdAt : nowIso,
      updatedAt: nowIso,
    });
    aiSummaries = aiSummaries.filter(summary => !(summary.type === nextSummary.type && summary.periodKey === nextSummary.periodKey));
    aiSummaries.unshift(nextSummary);
    saveAiData();
    renderAiSummaryContent(nextSummary);
    renderAiHistory();
    setAiStatus('已生成并保存', 'ok');
  } catch (error) {
    setAiStatus(error.message || '生成失败', 'error');
  } finally {
    aiGenerateBtn.disabled = false;
  }
}

function getCalendarWeekDoneCount(project) {
  const days = project.days || {};
  return getWeekDates().filter(date => days[toDateKey(date)]).length;
}

function getCalendarTodayOpenCount(project) {
  const days = project.days || {};
  return days[toDateKey(new Date())] ? 0 : 1;
}

function getCalendarStats() {
  const weekDates = getWeekDates();
  const total = calendarProjects.length * weekDates.length;
  const done = calendarProjects.reduce((sum, project) => {
    return sum + weekDates.filter(date => project.days && project.days[toDateKey(date)]).length;
  }, 0);
  const percent = total ? Math.round(done / total * 100) : 0;
  return { total, done, percent };
}

function getMonthDates(baseDate) {
  const base = new Date(baseDate || new Date());
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  const firstDay = first.getDay();
  start.setDate(first.getDate() - (firstDay === 0 ? 6 : firstDay - 1));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function getCalendarMonthStats(project, baseDate) {
  const base = new Date(baseDate || new Date());
  const monthDates = getMonthDates(base).filter(date => date.getMonth() === base.getMonth());
  if (project) {
    const done = monthDates.filter(date => project.days && project.days[toDateKey(date)]).length;
    const percent = monthDates.length ? Math.round(done / monthDates.length * 100) : 0;
    return { total: monthDates.length, done, percent };
  }
  const total = calendarProjects.length * monthDates.length;
  const done = calendarProjects.reduce((sum, item) => {
    return sum + monthDates.filter(date => item.days && item.days[toDateKey(date)]).length;
  }, 0);
  return { total, done, percent: total ? Math.round(done / total * 100) : 0 };
}

function getActiveList() {
  if (isCalendarView(activeListId)) return null;
  if (isVideoView(activeListId)) return null;
  if (isRoadmapView(activeListId)) return null;
  if (isSmartList(activeListId)) return null;
  return lists.find(l => l.id === activeListId) || lists[3];
}

function getTodos() {
  if (isSmartList(activeListId)) return getSmartListTodos(activeListId);
  const al = getActiveList();
  return al ? al.todos : [];
}

const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  render();
});

const now = new Date();
const weekdays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
dateLabel.textContent = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;

function ding() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const t = ctx.currentTime;
  const freqs = [1319, 2640, 3960, 5590, 7240];
  const gains = [0.25, 0.12, 0.06, 0.04, 0.02];
  const decays = [1.2, 0.8, 0.5, 0.35, 0.25];
  freqs.forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f + Math.random() * 3, t);
    o.connect(g);
    g.gain.setValueAtTime(gains[i], t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decays[i]);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + decays[i] + 0.01);
  });
}

function getListCount(listId) {
  const l = lists.find(x => x.id === listId);
  return l ? l.todos.filter(t => !t.done).length : 0;
}

function isRoadmapView(id) {
  return id === 'roadmap' || id.startsWith('roadmap:');
}

function isVideoView(id) {
  return id === 'videos' || id.startsWith('video:') || id.startsWith('video-collection:');
}

function isCalendarView(id) {
  return id === 'calendar' || id.startsWith('calendar:');
}

function getRoadmapIdFromListId(id) {
  return id.startsWith('roadmap:') ? id.slice('roadmap:'.length) : null;
}

function getVideoIdFromListId(id) {
  return id.startsWith('video:') ? id.slice('video:'.length) : null;
}

function getVideoCollectionIdFromListId(id) {
  return id.startsWith('video-collection:') ? id.slice('video-collection:'.length) : null;
}

function getCalendarIdFromListId(id) {
  return id.startsWith('calendar:') ? id.slice('calendar:'.length) : null;
}

function getActiveRoadmap() {
  const roadmapId = getRoadmapIdFromListId(activeListId);
  return roadmapProjects.find(project => project.id === roadmapId) || null;
}

function getActiveVideo() {
  const videoId = getVideoIdFromListId(activeListId);
  return videoCollections.flatMap(collection => collection.videos).find(video => video.id === videoId) || null;
}

function getActiveVideoCollection() {
  const collectionId = getVideoCollectionIdFromListId(activeListId);
  return videoCollections.find(collection => collection.id === collectionId) || null;
}

function getActiveCalendarProject() {
  const calendarId = getCalendarIdFromListId(activeListId);
  return calendarProjects.find(project => project.id === calendarId) || null;
}

function getRoadmapOpenCount(project) {
  if (!project) return 0;
  return project.items.filter(item => item.type === 'task' && !item.done).length;
}

function setupEditableText(el, value, onSave, renameType, renameKey) {
  if (!el) return;
  el.textContent = value;
  el.title = '双击重命名';
  el.dataset.renameReady = 'true';
  if (renameType) el.dataset.renameType = renameType;
  if (renameKey) el.dataset.renameKey = renameKey;
  const renameId = 'rename_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  el.dataset.renameId = renameId;
  el._renameSave = onSave;
  if (!window.sidebarRenameHandlers) window.sidebarRenameHandlers = {};
  window.sidebarRenameHandlers[renameId] = onSave;
}

function saveSidebarRenameTarget(el, nextName) {
  const name = String(nextName || '').trim();
  if (!name) return false;
  const type = el.dataset.renameType;
  const key = el.dataset.renameKey;

  if (type === 'group') {
    sidebarLabels[key] = name;
    saveSidebarLabels();
  } else if (type === 'roadmap') {
    const project = roadmapProjects.find(item => item.id === key);
    if (!project) return false;
    project.title = name;
    saveRoadmapProjects();
  } else if (type === 'videoCollection') {
    const collection = videoCollections.find(item => item.id === key);
    if (!collection) return false;
    collection.name = name;
    saveVideoCollections();
  } else if (type === 'calendar') {
    const project = calendarProjects.find(item => item.id === key);
    if (!project) return false;
    project.name = name;
    saveCalendarProjects();
  } else if (type === 'customList') {
    const custom = lists.find(item => item.id === key);
    if (!custom) return false;
    custom.name = name;
    saveLists(lists);
  } else if (type === 'legacyVideo') {
    const video = videoProjects.find(item => item.id === key);
    if (!video) return false;
    video.title = name;
    saveVideoProjects();
  } else if (typeof el._renameSave === 'function') {
    el._renameSave(name);
  } else {
    return false;
  }

  renderSidebar();
  render();
  return true;
}

function beginSidebarRename(el, event) {
  if (!el || !el.dataset.renameReady) return;
  if (!el.isConnected) return;
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const oldValue = el.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldValue;
  input.className = 'sidebar-rename-input';
  input.maxLength = 40;
  const renameId = el.dataset.renameId;
  activeRenameContext = {
    id: renameId,
    save: window.sidebarRenameHandlers && window.sidebarRenameHandlers[renameId],
  };
  let finished = false;

  const finish = (shouldSave) => {
    if (finished) return;
    finished = true;
    const next = input.value.trim();
    const save = activeRenameContext && activeRenameContext.id === renameId ? activeRenameContext.save : null;
    activeRenameContext = null;
    input.replaceWith(el);
    if (shouldSave && next && next !== oldValue) {
      const saved = saveSidebarRenameTarget(el, next);
      if (!saved && typeof save === 'function') save(next);
    } else {
      el.textContent = oldValue;
    }
  };

  input.addEventListener('click', ev => ev.stopPropagation());
  input.addEventListener('dblclick', ev => ev.stopPropagation());
  input.addEventListener('pointerdown', ev => ev.stopPropagation(), true);
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') finish(true);
    if (ev.key === 'Escape') finish(false);
  });

  el.replaceWith(input);
  input.focus();
  input.select();
}

function getRenameTarget(eventTarget) {
  const element = eventTarget && eventTarget.nodeType === Node.TEXT_NODE
    ? eventTarget.parentElement
    : eventTarget;
  if (!element || !element.closest) return null;
  const direct = element.closest('[data-rename-ready="true"]');
  if (direct) return direct;
  if (element.closest('button, input')) return null;
  const row = element.closest('.sidebar .nav li, .roadmap-projects li, .video-projects li, .calendar-projects li, .custom-lists li, .roadmap-label, .video-label, .calendar-label, .custom-lists-label');
  return row ? row.querySelector('[data-rename-ready="true"]') : null;
}

document.querySelector('.sidebar').addEventListener('pointerdown', (e) => {
  const editable = getRenameTarget(e.target);
  if (editable) {
    e.stopPropagation();
  }
}, true);

document.querySelector('.sidebar').addEventListener('mousedown', (e) => {
  const editable = getRenameTarget(e.target);
  if (!editable) return;
  e.stopPropagation();
  if (e.detail >= 2) beginSidebarRename(editable, e);
}, true);

document.querySelector('.sidebar').addEventListener('click', (e) => {
  const editable = getRenameTarget(e.target);
  if (!editable) return;
  if (e.detail >= 2) {
    e.preventDefault();
    e.stopPropagation();
    beginSidebarRename(editable, e);
  }
}, true);

document.querySelector('.sidebar').addEventListener('dblclick', (e) => {
  const editable = getRenameTarget(e.target);
  if (editable) beginSidebarRename(editable, e);
}, true);

/*
function setupEditableText_old(el, value, onSave) {
  if (!el) return;
  el.textContent = value;
  el.title = '双击重命名';
  el.onclick = (e) => {
    e.stopPropagation();
  };
  el.ondblclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const oldValue = el.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldValue;
    input.className = 'sidebar-rename-input';
    input.maxLength = 40;
    let finished = false;

    const finish = (shouldSave) => {
      if (finished) return;
      finished = true;
      const next = input.value.trim();
      input.replaceWith(el);
      if (shouldSave && next && next !== oldValue) onSave(next);
      else el.textContent = oldValue;
    };

    input.addEventListener('click', ev => ev.stopPropagation());
    input.addEventListener('dblclick', ev => ev.stopPropagation());
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') finish(true);
      if (ev.key === 'Escape') finish(false);
    });

    el.replaceWith(input);
    input.focus();
    input.select();
  };
}
*/

function ensureStaticLabel(container, className, text, onSave, renameType, renameKey) {
  if (!container) return;
  let label = container.querySelector('.' + className);
  if (!label) {
    label = document.createElement('span');
    label.className = className;
    const button = container.querySelector('button');
    container.insertBefore(label, button || container.firstChild);
  }
  Array.from(container.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.remove();
  });
  setupEditableText(label, text, onSave, renameType, renameKey);
}

function renderStaticSidebarLabels() {
  document.querySelectorAll('.sidebar .nav li').forEach(li => {
    const id = li.dataset.listId;
    if (!id) return;
    let nameEl = li.querySelector('.nav-name');
    if (!nameEl) {
      nameEl = document.createElement('span');
      nameEl.className = 'nav-name';
      const icon = li.querySelector('.icon');
      li.insertBefore(nameEl, icon ? icon.nextSibling : li.firstChild);
    }
    Array.from(li.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.remove();
    });
    const defaultName = (defaultLists.find(item => item.id === id) || {}).name || id;
    nameEl.textContent = defaultName;
    nameEl.title = '';
    delete nameEl.dataset.renameReady;
    delete nameEl.dataset.renameId;
    nameEl._renameSave = null;
  });

  ensureStaticLabel(roadmapLabel, 'group-name', getSidebarLabel('group.roadmap'), next => renameSidebarLabel('group.roadmap', next), 'group', 'group.roadmap');
  ensureStaticLabel(videoLabel, 'group-name', getSidebarLabel('group.video'), next => renameSidebarLabel('group.video', next), 'group', 'group.video');
  ensureStaticLabel(calendarLabel, 'group-name', getSidebarLabel('group.calendar'), next => renameSidebarLabel('group.calendar', next), 'group', 'group.calendar');
  ensureStaticLabel(customListsLabel, 'group-name', getSidebarLabel('group.custom'), next => renameSidebarLabel('group.custom', next), 'group', 'group.custom');
}

function renderSidebar() {
  renderStaticSidebarLabels();

  // update default nav counts (smart lists pull from all lists)
  document.querySelectorAll('.sidebar .nav li').forEach(li => {
        const id = li.dataset.listId;
      const countEl = li.querySelector('.count');
      if (!countEl || !id) return;
      if (isSmartList(id)) {
          const smartCount = getSmartListTodos(id).filter(t => !t.done).length
            + (id === 'myday' ? getMyDayVideoEntries().filter(entry => !entry.video.done).length : 0);
          countEl.textContent = smartCount || '';
      } else {
          countEl.textContent = getListCount(id) || '';
    }
  });

  // set active on default nav
  document.querySelectorAll('.sidebar .nav li').forEach(li => {
    li.classList.toggle('active', li.dataset.listId === activeListId);
  });

  renderRoadmapProjects();
  renderVideoProjects();
  renderVideoCollections();
  renderCalendarProjects();

  // render custom lists
  const custom = lists.filter(l => !defaultLists.find(d => d.id === l.id));
  customLists.innerHTML = '';
  custom.forEach(cl => {
    const li = document.createElement('li');
    li.className = cl.id === activeListId ? 'active' : '';
    const activeCount = cl.todos.filter(t => !t.done).length;
    li.innerHTML = `<span class="list-icon"><svg viewBox="0 0 24 24"><circle cx="7" cy="8" r="1.5"/><path d="M10 8h9"/><circle cx="7" cy="16" r="1.5"/><path d="M10 16h9"/></svg></span>
      <span class="custom-list-name"></span>
      <span class="count">${activeCount || ''}</span>
      <button class="del-list" data-id="${cl.id}" title="删除列表">&times;</button>`;
    setupEditableText(li.querySelector('.custom-list-name'), cl.name, next => {
      cl.name = next;
      saveLists(lists);
      renderSidebar();
      render();
    }, 'customList', cl.id);
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('del-list')) return;
      switchToList(cl.id);
    });
    customLists.appendChild(li);
  });

  // delete buttons
  customLists.querySelectorAll('.del-list').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (confirm('确定删除此列表及其所有任务？')) {
        lists = lists.filter(l => l.id !== id);
        saveLists(lists);
        if (activeListId === id) switchToList('tasks');
        else { renderSidebar(); render(); }
      }
    });
  });

}

function renderRoadmapProjects() {
  roadmapProjectsEl.innerHTML = '';

  roadmapProjects.forEach(project => {
    const li = document.createElement('li');
    const listId = 'roadmap:' + project.id;
    li.className = activeListId === listId ? 'active' : '';
    li.dataset.listId = listId;
    li.innerHTML = `<span class="project-icon"><svg viewBox="0 0 24 24"><path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z"/><path d="M9 4v14M15 6v14"/></svg></span>
      <span class="project-name"></span>
      <span class="count">${getRoadmapOpenCount(project) || ''}</span>
      <button class="del-roadmap" data-id="${project.id}" title="删除路线图">&times;</button>`;
    li.querySelector('.project-name').textContent = project.title;
    setupEditableText(li.querySelector('.project-name'), project.title, next => {
      project.title = next;
      saveRoadmapProjects();
      renderSidebar();
      render();
    }, 'roadmap', project.id);
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('del-roadmap')) return;
      switchToList(listId);
    });
    roadmapProjectsEl.appendChild(li);
  });

  roadmapProjectsEl.querySelectorAll('.del-roadmap').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm('确定删除这个路线图项目？')) return;
      roadmapProjects = roadmapProjects.filter(project => project.id !== id);
      saveRoadmapProjects();
      if (activeListId === 'roadmap:' + id) {
        const next = roadmapProjects[0] ? 'roadmap:' + roadmapProjects[0].id : 'roadmap';
        switchToList(next);
      } else {
        renderSidebar();
      }
    });
  });
}

function renderVideoProjects() {
  videoProjectsEl.innerHTML = '';

  videoProjects.forEach(video => {
    video = normalizeVideoProject(video);
    const li = document.createElement('li');
    const listId = 'video:' + video.id;
    li.className = activeListId === listId ? 'active' : '';
    li.dataset.listId = listId;
    li.innerHTML = `<span class="video-icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/></svg></span>
      <span class="video-name"></span>
      <span class="count">${video.done ? '✓' : ''}</span>
      <button class="del-video" data-id="${video.id}" title="删除视频">&times;</button>`;
    li.querySelector('.video-name').textContent = video.title;
    li.querySelector('.count').textContent = getVideoProgress(video) ? getVideoProgress(video) + '%' : '';
    setupEditableText(li.querySelector('.video-name'), video.title, next => {
      video.title = next;
      saveVideoProjects();
      renderSidebar();
      render();
    }, 'legacyVideo', video.id);
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('del-video')) return;
      switchToList(listId);
    });
    videoProjectsEl.appendChild(li);
  });

  videoProjectsEl.querySelectorAll('.del-video').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm('确定删除这个视频学习项目？')) return;
      videoProjects = videoProjects.filter(video => video.id !== id);
      saveVideoProjects();
      if (activeListId === 'video:' + id) {
        const next = videoProjects[0] ? 'video:' + videoProjects[0].id : 'videos';
        switchToList(next);
      } else {
        renderSidebar();
      }
    });
  });
}

function renderVideoCollections() {
  videoProjectsEl.innerHTML = '';

  videoCollections.forEach(collection => {
    collection = normalizeVideoCollection(collection);
    const li = document.createElement('li');
    const listId = 'video-collection:' + collection.id;
    const done = collection.videos.filter(video => normalizeVideoProject(video).done).length;
    li.className = activeListId === listId ? 'active' : '';
    li.dataset.listId = listId;
    li.innerHTML = `<span class="video-icon"><svg viewBox="0 0 24 24"><path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7V5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2"/></svg></span>
      <span class="video-name"></span>
      <span class="count">${collection.videos.length ? done + '/' + collection.videos.length : ''}</span>
      <button class="del-video" data-id="${collection.id}" title="删除收藏夹">&times;</button>`;
    li.querySelector('.video-name').textContent = collection.name;
    setupEditableText(li.querySelector('.video-name'), collection.name, next => {
      collection.name = next;
      saveVideoCollections();
      renderSidebar();
      render();
    }, 'videoCollection', collection.id);
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('del-video')) return;
      switchToList(listId);
    });
    videoProjectsEl.appendChild(li);
  });

  videoProjectsEl.querySelectorAll('.del-video').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm('确定删除这个视频收藏夹以及里面的视频吗？')) return;
      videoCollections = videoCollections.filter(collection => collection.id !== id);
      saveVideoCollections();
      if (activeListId === 'video-collection:' + id) {
        const next = videoCollections[0] ? 'video-collection:' + videoCollections[0].id : 'videos';
        switchToList(next);
      } else {
        renderSidebar();
        render();
      }
    });
  });
}

function renderCalendarProjects() {
  calendarProjectsEl.innerHTML = '';

  calendarProjects.forEach(project => {
    project = normalizeCalendarProject(project);
    const li = document.createElement('li');
    const listId = 'calendar:' + project.id;
    li.className = activeListId === listId ? 'active' : '';
    li.dataset.listId = listId;
    li.innerHTML = `<span class="calendar-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg></span>
      <span class="calendar-name"></span>
      <span class="count">${getCalendarTodayOpenCount(project) || ''}</span>
      <button class="del-calendar" data-id="${project.id}" title="删除日历项目">&times;</button>`;
    li.querySelector('.calendar-name').textContent = project.name;
    setupEditableText(li.querySelector('.calendar-name'), project.name, next => {
      project.name = next;
      saveCalendarProjects();
      renderSidebar();
      render();
    }, 'calendar', project.id);
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('del-calendar')) return;
      switchToList(listId);
    });
    calendarProjectsEl.appendChild(li);
  });

  calendarProjectsEl.querySelectorAll('.del-calendar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm('确定删除这个日历打卡项目吗？')) return;
      calendarProjects = calendarProjects.filter(project => project.id !== id);
      saveCalendarProjects();
      if (activeListId === 'calendar:' + id) {
        const next = calendarProjects[0] ? 'calendar:' + calendarProjects[0].id : 'calendar';
        switchToList(next);
      } else {
        renderSidebar();
        render();
      }
    });
  });
}

function switchToList(id) {
  activeListId = id;
  localStorage.setItem('activeListId', id);
  scheduleCloudSync();
  const def = defaultLists.find(d => d.id === id);
  const roadmap = getActiveRoadmap();
  const video = getActiveVideo();
  const calendarProject = getActiveCalendarProject();
  const l = def || roadmap || video || calendarProject || lists.find(x => x.id === id);
  if (l) listTitle.textContent = l.name;
  if (def) listTitle.textContent = def.name;
  if (roadmap) listTitle.textContent = roadmap.title;
  if (video) listTitle.textContent = '视频学习';
  if (id === 'roadmap') listTitle.textContent = '路线图';
  if (id === 'videos') listTitle.textContent = '视频学习';
  if (calendarProject || id === 'calendar') listTitle.textContent = '日历栏';
  if (id === 'roadmap') listTitle.textContent = getSidebarLabel('group.roadmap');
  if (id === 'videos') listTitle.textContent = getSidebarLabel('group.video');
  if (id === 'calendar' || calendarProject) listTitle.textContent = getSidebarLabel('group.calendar');
  searchQuery = '';
  const si = document.getElementById('searchInput');
  const ns = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  ns.call(si, '');
  // hide input row for smart lists except myday
  document.querySelector('.input-row').style.display = ((isSmartList(id) && id !== 'myday') || isRoadmapView(id) || isVideoView(id) || isCalendarView(id)) ? 'none' : 'flex';
  renderSidebar();
  render();
}

function stripMarkdownInline(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .trim();
}

function appendMarkdownInline(target, text) {
  const pattern = /(!?\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      target.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    if (match[2] !== undefined && match[3] !== undefined && !match[1].startsWith('!')) {
      const a = document.createElement('a');
      a.href = match[3];
      a.textContent = match[2] || match[3];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      target.appendChild(a);
    } else if (match[4]) {
      target.appendChild(document.createTextNode(match[4]));
    } else {
      const strong = document.createElement('strong');
      strong.textContent = match[5] || match[6] || '';
      target.appendChild(strong);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    target.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function parseRoadmapMarkdown(markdown, fileName) {
  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const items = [];
  let title = fileName.replace(/\.[^.]+$/, '') || '路线图';
  let inCode = false;
  let codeLang = '';
  let codeLines = [];

  function pushCode() {
    items.push({
      id: 'roadmap_' + Date.now() + '_' + items.length,
      type: 'code',
      lang: codeLang,
      text: codeLines.join('\n'),
    });
    codeLang = '';
    codeLines = [];
  }

  lines.forEach((rawLine) => {
    const line = rawLine.replace(/\s+$/, '');
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      if (inCode) {
        pushCode();
        inCode = false;
      } else {
        inCode = true;
        codeLang = fence[1].trim();
      }
      return;
    }

    if (inCode) {
      codeLines.push(rawLine);
      return;
    }

    if (!line.trim()) return;

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const text = stripMarkdownInline(heading[2]);
      if (level === 1 && !items.length) title = text;
      items.push({
        id: 'roadmap_' + Date.now() + '_' + items.length,
        type: 'heading',
        level,
        text: heading[2].trim(),
        plainText: text,
      });
      return;
    }

    const task = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (task) {
      const done = task[1].toLowerCase() === 'x';
      items.push({
        id: 'roadmap_' + Date.now() + '_' + items.length,
        type: 'task',
        done,
        completedAt: done ? new Date().toISOString() : null,
        text: task[2].trim(),
      });
      return;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      items.push({
        id: 'roadmap_' + Date.now() + '_' + items.length,
        type: 'bullet',
        text: bullet[1].trim(),
      });
      return;
    }

    items.push({
      id: 'roadmap_' + Date.now() + '_' + items.length,
      type: 'text',
      text: line.trim(),
    });
  });

  if (inCode) pushCode();

  return {
    id: 'roadmap_project_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    title,
    fileName,
    importedAt: new Date().toISOString(),
    items,
  };
}

function renderRoadmap() {
  list.innerHTML = '';
  clearDoneBtn.style.display = 'none';
  const roadmap = getActiveRoadmap();

  if (!roadmap) {
    list.innerHTML = `<div class="empty-state">
      <div class="emoji">🗺️</div>
      <div>${roadmapProjects.length ? '请选择一个路线图项目' : '还没有路线图项目'}</div>
      <div class="hint">点击左侧“路线图”旁边的 + 导入 Markdown 文件</div>
    </div>`;
    countEl.textContent = '每个 Markdown 文件会成为一个独立项目';
    return;
  }

  listTitle.textContent = roadmap.title;

  const tasks = roadmap.items.filter(item => item.type === 'task');
  const doneCount = tasks.filter(item => item.done).length;
  const percent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const view = document.createElement('div');
  view.className = 'roadmap-view';

  const toolbar = document.createElement('div');
  toolbar.className = 'roadmap-toolbar';
  const progress = document.createElement('div');
  progress.className = 'roadmap-progress';
  const progressBar = document.createElement('span');
  progressBar.style.width = percent + '%';
  progress.appendChild(progressBar);
  const progressLabel = document.createElement('div');
  progressLabel.className = 'roadmap-progress-label';
  progressLabel.textContent = tasks.length ? `${doneCount}/${tasks.length} 已完成 · ${percent}%` : '没有待办项';
  toolbar.appendChild(progress);
  toolbar.appendChild(progressLabel);
  view.appendChild(toolbar);

  roadmap.items.forEach((item) => {
    if (item.type === 'code') {
      const pre = document.createElement('pre');
      pre.className = 'roadmap-code';
      const code = document.createElement('code');
      code.textContent = item.text;
      pre.appendChild(code);
      view.appendChild(pre);
      return;
    }

    const block = document.createElement('div');
    block.className = 'roadmap-block';

    if (item.type === 'heading') {
      block.classList.add('roadmap-heading', 'level-' + Math.min(item.level, 4));
      appendMarkdownInline(block, item.text);
    } else if (item.type === 'task') {
      block.classList.add('roadmap-task');
      if (item.done) block.classList.add('done');
      const check = document.createElement('span');
      check.className = 'check';
      check.addEventListener('click', () => {
        const wasDone = item.done;
        item.done = !item.done;
        item.completedAt = item.done ? (item.completedAt || new Date().toISOString()) : null;
        if (!wasDone && item.done) ding();
        saveRoadmapProjects();
        renderRoadmap();
        renderSidebar();
      });
      const text = document.createElement('div');
      text.className = 'roadmap-task-text';
      appendMarkdownInline(text, item.text);
      block.appendChild(check);
      block.appendChild(text);
    } else {
      block.classList.add(item.type === 'bullet' ? 'roadmap-bullet' : 'roadmap-text');
      appendMarkdownInline(block, item.text);
    }

    view.appendChild(block);
  });

  list.appendChild(view);
  countEl.textContent = tasks.length ? `${getRoadmapOpenCount(roadmap)} 项待完成` : '路线图说明';
}

function getBilibiliVideoTitle(url) {
  const bvMatch = url.match(/\/(BV[a-zA-Z0-9]+)/i) || url.match(/\b(BV[a-zA-Z0-9]+)/i);
  if (bvMatch) return 'B站视频 ' + bvMatch[1];
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('bilibili.com') || parsed.hostname.includes('b23.tv')) {
      return 'B站视频学习';
    }
  } catch (e) {}
  return '视频学习';
}

function fetchJsonp(url, callbackParam) {
  return new Promise((resolve, reject) => {
    const callbackName = '__biliJsonp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('metadata timeout'));
    }, 12000);

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    const finalUrl = new URL(url);
    finalUrl.searchParams.set(callbackParam || 'callback', callbackName);
    finalUrl.searchParams.set('jsonp', 'jsonp');
    script.src = finalUrl.toString();
    script.onerror = () => {
      cleanup();
      reject(new Error('metadata script failed'));
    };
    document.head.appendChild(script);
  });
}

function parseBilibiliPayload(payload, bvid) {
  if (!payload || payload.code !== 0 || !payload.data) {
    throw new Error((payload && payload.message) || 'metadata unavailable');
  }
  return {
    bvid: payload.data.bvid || bvid,
    title: payload.data.title || getBilibiliVideoTitle(bvid),
    cover: normalizeCoverUrl(payload.data.pic || ''),
    duration: Number(payload.data.duration) || 0,
  };
}

async function fetchBilibiliMetadata(input) {
  const bvid = normalizeBvid(input);
  if (!bvid) return null;
  const endpoint = 'https://api.bilibili.com/x/web-interface/view?bvid=' + encodeURIComponent(bvid);

  try {
    const payload = await fetchJsonp(endpoint, 'callback');
    return parseBilibiliPayload(payload, bvid);
  } catch (jsonpError) {
    const response = await fetch(endpoint, { mode: 'cors' });
    if (!response.ok) throw jsonpError;
    const payload = await response.json();
    return parseBilibiliPayload(payload, bvid);
  }
}

function createVideoPlaceholder(video) {
  const title = encodeURIComponent((video && video.title) || 'Bilibili');
  return `https://placehold.co/640x360/202020/60a5fa?text=${title}`;
}

function updateVideoProgress(video, value, afterRender) {
  const wasDone = video.done;
  video.progressPercent = clampPercent(value);
  video.done = video.progressPercent >= 100;
  video.completedAt = video.done ? (video.completedAt || new Date().toISOString()) : null;
  video.updatedAt = new Date().toISOString();
  if (!wasDone && video.done) ding();
  saveVideoCollections();
  if (typeof afterRender === 'function') afterRender();
  else renderVideoCollectionGrid();
  renderSidebar();
}

function closeVideoContextMenu() {
  if (videoContextMenu) {
    videoContextMenu.remove();
    videoContextMenu = null;
  }
}

function openVideoContextMenu(event, collection, video) {
  event.preventDefault();
  event.stopPropagation();
  closeVideoContextMenu();

  const menu = document.createElement('div');
  menu.className = 'video-context-menu';
  const del = document.createElement('button');
  del.type = 'button';
  del.textContent = '删除视频';
  del.addEventListener('click', () => {
    closeVideoContextMenu();
    if (!confirm('确定删除这个视频吗？')) return;
    collection.videos = collection.videos.filter(item => item.id !== video.id);
    saveVideoCollections();
    renderVideoCollectionGrid();
    renderSidebar();
  });
  menu.appendChild(del);
  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  const x = Math.min(event.clientX, window.innerWidth - rect.width - 8);
  const y = Math.min(event.clientY, window.innerHeight - rect.height - 8);
  menu.style.left = Math.max(8, x) + 'px';
  menu.style.top = Math.max(8, y) + 'px';
  videoContextMenu = menu;
}

document.addEventListener('click', closeVideoContextMenu);
document.addEventListener('click', closeAiContextMenu);
document.addEventListener('contextmenu', () => {
  closeVideoContextMenu();
  closeAiContextMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeVideoContextMenu();
    closeAiContextMenu();
  }
});

function renderVideo() {
  list.innerHTML = '';
  clearDoneBtn.style.display = 'none';
  const video = getActiveVideo();

  if (!video) {
    list.innerHTML = `<div class="empty-state">
      <div class="emoji">▶</div>
      <div>${videoProjects.length ? '请选择一个视频学习项目' : '还没有视频学习项目'}</div>
      <div class="hint">点击左侧“视频学习”旁边的 + 粘贴 B 站链接</div>
    </div>`;
    countEl.textContent = '每个视频链接会成为一个独立学习项目';
    return;
  }

  listTitle.textContent = video.title;

  const view = document.createElement('div');
  view.className = 'video-view';
  const card = document.createElement('div');
  card.className = 'video-card' + (video.done ? ' done' : '');

  const check = document.createElement('span');
  check.className = 'check';
  check.title = video.done ? '标记为未完成' : '标记为已完成';
  check.addEventListener('click', () => {
    const wasDone = video.done;
    video.done = !video.done;
    if (!wasDone && video.done) ding();
    saveVideoProjects();
    renderVideo();
    renderSidebar();
  });

  const main = document.createElement('div');
  main.className = 'video-main';
  const title = document.createElement('div');
  title.className = 'video-title';
  title.textContent = video.title;
  const link = document.createElement('a');
  link.className = 'video-link';
  link.href = video.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = video.url;
  const meta = document.createElement('div');
  meta.className = 'video-meta';
  meta.textContent = video.done ? '已完成学习' : '未完成学习';

  main.appendChild(title);
  main.appendChild(link);
  main.appendChild(meta);
  card.appendChild(check);
  card.appendChild(main);
  view.appendChild(card);
  list.appendChild(view);
  countEl.textContent = video.done ? '视频学习已完成 ✓' : '视频学习待完成';
}

function renderVideoGrid() {
  list.innerHTML = '';
  clearDoneBtn.style.display = 'none';
  listTitle.textContent = '视频学习';
  videoProjects = videoProjects.map(normalizeVideoProject);

  if (!videoProjects.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<div class="emoji">▶</div><div>还没有视频学习项目</div><div class="hint">点击左侧“视频学习”旁边的 +，粘贴 B 站链接</div>';
    list.appendChild(empty);
    countEl.textContent = '每个视频都会显示封面、时长和学习进度';
    return;
  }

  const stats = getVideoStats();
  const view = document.createElement('div');
  view.className = 'video-view video-grid-view';

  const toolbar = document.createElement('div');
  toolbar.className = 'video-toolbar';
  toolbar.innerHTML = `<div class="video-summary">
      <strong>视频学习收藏夹</strong>
      <span>${stats.done}/${stats.total} 已完成 · ${stats.avg}%</span>
    </div>
    <div class="video-progress"><span style="width:${stats.avg}%"></span></div>`;
  view.appendChild(toolbar);

  const grid = document.createElement('div');
  grid.className = 'video-grid';

  videoProjects.forEach(video => {
    const card = document.createElement('article');
    card.className = 'video-tile' + (video.done ? ' done' : '');
    if (activeListId === 'video:' + video.id) card.classList.add('active');

    const coverLink = document.createElement('a');
    coverLink.className = 'video-cover';
    coverLink.href = video.url;
    coverLink.target = '_blank';
    coverLink.rel = 'noopener noreferrer';

    const img = document.createElement('img');
    img.src = video.cover || createVideoPlaceholder(video);
    img.alt = video.title;
    img.loading = 'lazy';
    img.onerror = () => { img.src = createVideoPlaceholder(video); };
    coverLink.appendChild(img);

    const duration = document.createElement('span');
    duration.className = 'video-duration';
    duration.textContent = video.duration ? formatDuration(video.duration) : '--:--';
    coverLink.appendChild(duration);

    const body = document.createElement('div');
    body.className = 'video-tile-body';

    const titleLink = document.createElement('a');
    titleLink.className = 'video-title';
    titleLink.href = video.url;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';
    titleLink.textContent = video.title;

    const meta = document.createElement('div');
    meta.className = 'video-meta';
    meta.textContent = video.bvid || 'Bilibili';

    const progressRow = document.createElement('div');
    progressRow.className = 'video-tile-progress-row';
    const progressBar = document.createElement('div');
    progressBar.className = 'video-tile-progress';
    progressBar.innerHTML = `<span style="width:${getVideoProgress(video)}%"></span>`;
    const percent = document.createElement('span');
    percent.className = 'video-percent';
    percent.textContent = getVideoProgress(video) + '%';
    progressRow.appendChild(progressBar);
    progressRow.appendChild(percent);

    const controls = document.createElement('div');
    controls.className = 'video-controls';

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'video-check';
    check.title = video.done ? '标记为未完成' : '标记为已完成';
    check.setAttribute('aria-label', check.title);
    check.addEventListener('click', () => updateVideoProgress(video, video.done ? 0 : 100));

    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.step = '1';
    range.value = String(getVideoProgress(video));
    range.addEventListener('input', () => {
      progressBar.querySelector('span').style.width = range.value + '%';
      percent.textContent = clampPercent(range.value) + '%';
    });
    range.addEventListener('change', () => updateVideoProgress(video, range.value));

    controls.appendChild(check);
    controls.appendChild(range);
    body.appendChild(titleLink);
    body.appendChild(meta);
    body.appendChild(progressRow);
    body.appendChild(controls);
    card.appendChild(coverLink);
    card.appendChild(body);
    grid.appendChild(card);
  });

  view.appendChild(grid);
  list.appendChild(view);
  countEl.textContent = `${stats.done}/${stats.total} 已完成 · ${stats.avg}%`;
}

function renderVideoCollectionGrid() {
  list.innerHTML = '';
  clearDoneBtn.style.display = 'none';
  listTitle.textContent = '视频学习';
  const activeCollection = getActiveVideoCollection();

  if (!activeCollection) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<div class="emoji">□</div><div>请选择一个视频收藏夹</div><div class="hint">点击左侧“视频学习”旁边的 + 新建收藏夹</div>';
    list.appendChild(empty);
    countEl.textContent = '每个收藏夹里可以添加一组 B 站视频';
    return;
  }

  activeCollection.videos = activeCollection.videos.map(normalizeVideoProject);
  const stats = getVideoStats();
  const view = document.createElement('div');
  view.className = 'video-view video-grid-view';

  const toolbar = document.createElement('div');
  toolbar.className = 'video-toolbar';
  toolbar.innerHTML = `<div class="video-summary">
      <strong>${activeCollection.name}</strong>
      <span>${stats.done}/${stats.total} 已完成 · ${stats.avg}%</span>
    </div>
    <div class="video-progress"><span style="width:${stats.avg}%"></span></div>`;
  const toolbarActions = document.createElement('div');
  toolbarActions.className = 'video-toolbar-actions';
  const addVideoToCollectionBtn = document.createElement('button');
  addVideoToCollectionBtn.type = 'button';
  addVideoToCollectionBtn.className = 'video-add-btn';
  addVideoToCollectionBtn.textContent = '添加视频';
  addVideoToCollectionBtn.addEventListener('click', () => addVideoToCollection(activeCollection));
  toolbarActions.appendChild(addVideoToCollectionBtn);
  toolbar.appendChild(toolbarActions);
  view.appendChild(toolbar);

  if (!activeCollection.videos.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<div class="emoji">▶</div><div>这个收藏夹还没有视频</div><div class="hint">点击右上方“添加视频”，把 BV 视频加入当前收藏夹</div>';
    view.appendChild(empty);
    list.appendChild(view);
    countEl.textContent = activeCollection.name + ' · 0 个视频';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'video-grid';

  activeCollection.videos.forEach(video => {
    const card = document.createElement('article');
    card.className = 'video-tile' + (video.done ? ' done' : '');
    card.addEventListener('contextmenu', (event) => openVideoContextMenu(event, activeCollection, video));
    const coverLink = document.createElement('a');
    coverLink.className = 'video-cover';
    coverLink.href = video.url;
    coverLink.target = '_blank';
    coverLink.rel = 'noopener noreferrer';
    const img = document.createElement('img');
    img.src = video.cover || createVideoPlaceholder(video);
    img.alt = video.title;
    img.loading = 'lazy';
    img.onerror = () => { img.src = createVideoPlaceholder(video); };
    coverLink.appendChild(img);
    const duration = document.createElement('span');
    duration.className = 'video-duration';
    duration.textContent = video.duration ? formatDuration(video.duration) : '--:--';
    coverLink.appendChild(duration);
    const body = document.createElement('div');
    body.className = 'video-tile-body';
    const titleLink = document.createElement('a');
    titleLink.className = 'video-title';
    titleLink.href = video.url;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';
    titleLink.textContent = video.title;
    const meta = document.createElement('div');
    meta.className = 'video-meta';
    meta.textContent = video.bvid || 'Bilibili';
    const progressRow = document.createElement('div');
    progressRow.className = 'video-tile-progress-row';
    const progressBar = document.createElement('div');
    progressBar.className = 'video-tile-progress';
    progressBar.innerHTML = `<span style="width:${getVideoProgress(video)}%"></span>`;
    const percent = document.createElement('span');
    percent.className = 'video-percent';
    percent.textContent = getVideoProgress(video) + '%';
    progressRow.appendChild(progressBar);
    progressRow.appendChild(percent);
    const controls = document.createElement('div');
    controls.className = 'video-controls';
    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'video-check';
    check.title = video.done ? '标记为未完成' : '标记为已完成';
    check.setAttribute('aria-label', check.title);
    check.addEventListener('click', () => updateVideoProgress(video, video.done ? 0 : 100));
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.step = '1';
    range.value = String(getVideoProgress(video));
    range.addEventListener('input', () => {
      progressBar.querySelector('span').style.width = range.value + '%';
      percent.textContent = clampPercent(range.value) + '%';
    });
    range.addEventListener('change', () => updateVideoProgress(video, range.value));
    controls.appendChild(check);
    controls.appendChild(range);
    body.appendChild(titleLink);
    body.appendChild(meta);
    body.appendChild(progressRow);
    body.appendChild(controls);
    card.appendChild(coverLink);
    card.appendChild(body);
    grid.appendChild(card);
  });

  view.appendChild(grid);
  list.appendChild(view);
  countEl.textContent = `${stats.done}/${stats.total} 已完成 · ${stats.avg}%`;
}

function renderCalendar() {
  list.innerHTML = '';
  clearDoneBtn.style.display = 'none';
  listTitle.textContent = '日历栏';
  calendarProjects = calendarProjects.map(normalizeCalendarProject);

  if (!calendarProjects.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<div class="emoji">□</div><div>还没有日历打卡项目</div><div class="hint">点击左侧“日历栏”旁边的 +，添加练琴、运动这类项目</div>';
    list.appendChild(empty);
    countEl.textContent = '添加项目后，可以在本周日历上直接勾选';
    return;
  }

  const weekDates = getWeekDates();
  const todayKey = toDateKey(new Date());
  const activeProject = getActiveCalendarProject();
  const stats = getCalendarStats();
  const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
  const view = document.createElement('div');
  view.className = 'calendar-view';

  const toolbar = document.createElement('div');
  toolbar.className = 'calendar-toolbar';
  toolbar.innerHTML = `<div class="calendar-summary">
      <strong>本周打卡</strong>
      <span>${stats.done}/${stats.total} 已完成 · ${stats.percent}%</span>
    </div>
    <div class="calendar-progress"><span style="width:${stats.percent}%"></span></div>`;
  view.appendChild(toolbar);

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';
  const corner = document.createElement('div');
  corner.className = 'calendar-corner';
  corner.textContent = '项目';
  grid.appendChild(corner);

  weekDates.forEach((date, index) => {
    const key = toDateKey(date);
    const head = document.createElement('div');
    head.className = 'calendar-day-head' + (key === todayKey ? ' today' : '');
    head.innerHTML = `<span>周${weekdays[index]}</span><strong>${date.getMonth() + 1}/${date.getDate()}</strong>`;
    grid.appendChild(head);
  });

  calendarProjects.forEach(project => {
    const name = document.createElement('div');
    name.className = 'calendar-project-name' + (activeProject && activeProject.id === project.id ? ' active' : '');
    name.textContent = project.name;
    name.addEventListener('click', () => switchToList('calendar:' + project.id));
    grid.appendChild(name);

    weekDates.forEach(date => {
      const key = toDateKey(date);
      const done = !!(project.days && project.days[key]);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'calendar-cell' + (done ? ' done' : '') + (key === todayKey ? ' today' : '');
      cell.title = `${project.name} · ${key}`;
      cell.setAttribute('aria-label', cell.title);
      cell.addEventListener('click', () => {
        if (!project.days) project.days = {};
        if (project.days[key]) delete project.days[key];
        else {
          project.days[key] = true;
          ding();
        }
        saveCalendarProjects();
        renderCalendar();
        renderSidebar();
      });
      grid.appendChild(cell);
    });
  });

  view.appendChild(grid);
  list.appendChild(view);
  countEl.textContent = `${stats.done}/${stats.total} 已完成 · ${stats.percent}%`;
}

function renderMonthCalendar() {
  list.innerHTML = '';
  clearDoneBtn.style.display = 'none';
  listTitle.textContent = '日历栏';
  calendarProjects = calendarProjects.map(normalizeCalendarProject);

  if (!calendarProjects.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<div class="emoji">□</div><div>还没有日历打卡项目</div><div class="hint">点击左侧“日历栏”旁边的 +，添加练琴、运动这类项目</div>';
    list.appendChild(empty);
    countEl.textContent = '添加项目后，可以在月历上直接打卡';
    return;
  }

  const monthBase = new Date();
  const monthDates = getMonthDates(monthBase);
  const todayKey = toDateKey(new Date());
  const activeProject = getActiveCalendarProject();
  const stats = getCalendarMonthStats(activeProject, monthBase);
  const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
  const monthLabel = `${monthBase.getFullYear()}年${monthBase.getMonth() + 1}月`;

  const view = document.createElement('div');
  view.className = 'calendar-view month-calendar-view';

  const toolbar = document.createElement('div');
  toolbar.className = 'calendar-toolbar';
  toolbar.innerHTML = `<div class="calendar-summary">
      <div class="calendar-title-row">
        <span class="calendar-title-badge">${activeProject ? activeProject.name.charAt(0).toUpperCase() : '日'}</span>
        <strong>${activeProject ? activeProject.name : '日历栏'} · ${monthLabel}</strong>
      </div>
      <span>${stats.done}/${stats.total} 已完成 · ${stats.percent}%</span>
    </div>
    <div class="calendar-progress"><span style="width:${stats.percent}%"></span></div>`;
  view.appendChild(toolbar);

  const helper = document.createElement('div');
  helper.className = 'calendar-project-hint';
  helper.textContent = activeProject
    ? '点击日期即可为当前项目打卡或取消打卡。'
    : '在左侧选择一个项目后，可以直接在这个月历上点击日期打卡。';
  view.appendChild(helper);

  if (activeProject) {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'calendar-back';
    back.textContent = '查看全部项目';
    back.addEventListener('click', () => switchToList('calendar'));
    view.appendChild(back);
  }

  const grid = document.createElement('div');
  grid.className = 'month-calendar-grid';

  weekdays.forEach(day => {
    const head = document.createElement('div');
    head.className = 'month-weekday';
    head.textContent = day;
    grid.appendChild(head);
  });

  monthDates.forEach(date => {
    const key = toDateKey(date);
    const inMonth = date.getMonth() === monthBase.getMonth();
    const doneProjects = calendarProjects.filter(project => project.days && project.days[key]);
    const isDone = activeProject ? !!(activeProject.days && activeProject.days[key]) : doneProjects.length > 0;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'month-day' + (inMonth ? '' : ' outside') + (key === todayKey ? ' today' : '') + (isDone ? ' done' : '');
    cell.title = activeProject ? `${activeProject.name} · ${key}` : `${key} · ${doneProjects.length} 个项目完成`;
    cell.setAttribute('aria-label', cell.title);

    const dayNum = document.createElement('span');
    dayNum.className = 'month-day-number';
    dayNum.textContent = String(date.getDate());
    cell.appendChild(dayNum);

    const marker = document.createElement('span');
    marker.className = 'month-day-marker';
    marker.textContent = activeProject ? (isDone ? '已打卡' : '未打卡') : (doneProjects.length ? `${doneProjects.length}/${calendarProjects.length}` : '未打卡');
    cell.appendChild(marker);

    if (!inMonth) {
      cell.disabled = true;
    } else if (activeProject) {
      cell.addEventListener('click', () => {
        if (!activeProject.days) activeProject.days = {};
        if (activeProject.days[key]) delete activeProject.days[key];
        else {
          activeProject.days[key] = true;
          ding();
        }
        saveCalendarProjects();
        renderMonthCalendar();
        renderSidebar();
      });
    } else {
      cell.addEventListener('click', () => {
        alert('请先在左侧选择一个日历项目，例如“练琴”或“运动”，再在月历上打卡。');
      });
    }

    grid.appendChild(cell);
  });

  view.appendChild(grid);
  list.appendChild(view);
  countEl.textContent = `${stats.done}/${stats.total} 已完成 · ${stats.percent}%`;
}

function render() {
  list.innerHTML = '';
  clearDoneBtn.style.display = '';

  if (isVideoView(activeListId)) {
    renderVideoCollectionGrid();
    return;
  }

  if (isCalendarView(activeListId)) {
    renderMonthCalendar();
    return;
  }

  if (isRoadmapView(activeListId)) {
    renderRoadmap();
    return;
  }

  const todos = getTodos();
  const visible = searchQuery
    ? todos.filter(t => t.text.toLowerCase().includes(searchQuery))
    : todos;

  // ── My Day suggestions ──
  if (activeListId === 'myday' && !searchQuery) {
    // gather suggestions: non-done tasks not already in myday
    const suggestions = [];
    lists.forEach(l => {
      if (l.id === 'myday') return;
      l.todos.forEach(t => {
        if (!t.done && t.myDay !== todayStr()) {
          suggestions.push({ task: t, listName: l.name, listId: l.id });
        }
      });
    });
    const videoEntries = getMyDayVideoEntries();
    const videoSuggestions = getMyDayVideoSuggestions();

    if (videoEntries.length > 0) {
      const videoDiv = document.createElement('div');
      videoDiv.className = 'suggestions myday-video-section';
      videoDiv.innerHTML = '<div class="suggest-label">今日视频学习</div>';
      videoEntries.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'myday-video-card' + (entry.video.done ? ' done' : '');
        const cover = document.createElement('a');
        cover.className = 'myday-video-cover';
        cover.href = entry.video.url;
        cover.target = '_blank';
        cover.rel = 'noopener noreferrer';
        const img = document.createElement('img');
        img.src = entry.video.cover || createVideoPlaceholder(entry.video);
        img.alt = entry.video.title;
        img.loading = 'lazy';
        img.onerror = () => { img.src = createVideoPlaceholder(entry.video); };
        cover.appendChild(img);
        const duration = document.createElement('span');
        duration.className = 'video-duration';
        duration.textContent = entry.video.duration ? formatDuration(entry.video.duration) : '--:--';
        cover.appendChild(duration);
        const body = document.createElement('div');
        body.className = 'myday-video-body';
        const text = document.createElement('span');
        text.className = 'suggest-text';
        text.textContent = entry.video.title;
        const source = document.createElement('span');
        source.className = 'suggest-source';
        source.textContent = `${entry.collection.name} · ${getVideoProgress(entry.video)}%`;
        text.appendChild(source);
        const progress = document.createElement('div');
        progress.className = 'myday-video-progress';
        progress.innerHTML = `<span style="width:${getVideoProgress(entry.video)}%"></span>`;
        const actions = document.createElement('div');
        actions.className = 'actions myday-video-actions';
        const doneBtn = document.createElement('button');
        doneBtn.className = 'myday-video-check';
        doneBtn.title = entry.video.done ? '标记为未完成' : '标记为已完成';
        doneBtn.setAttribute('aria-label', doneBtn.title);
        doneBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          updateVideoProgress(entry.video, entry.video.done ? 0 : 100, render);
        });
        const removeBtn = document.createElement('button');
        removeBtn.className = 'myday-btn active';
        removeBtn.textContent = '☀️';
        removeBtn.title = '从“我的一天”移除';
        removeBtn.setAttribute('aria-label', removeBtn.title);
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          entry.video.myDay = null;
          saveVideoCollections();
          render();
          renderSidebar();
        });
        body.appendChild(text);
        body.appendChild(progress);
        body.appendChild(actions);
        item.appendChild(doneBtn);
        item.appendChild(cover);
        item.appendChild(body);
        actions.appendChild(removeBtn);
        videoDiv.appendChild(item);
      });
      list.appendChild(videoDiv);
    }

    if (suggestions.length > 0 || videoSuggestions.length > 0) {
      const suggestDiv = document.createElement('div');
      suggestDiv.className = 'suggestions';
      suggestDiv.innerHTML = '<div class="suggest-label">建议</div>';
      suggestions.forEach(s => {
        const item = document.createElement('div');
        item.className = 'suggest-item';
        item.innerHTML = `<span class="suggest-text">${s.task.text}<span class="suggest-source">${s.listName}</span></span>`;
        const addBtn = document.createElement('button');
        addBtn.className = 'add-to-myday';
        addBtn.textContent = '+';
        addBtn.title = '添加到"我的一天"';
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          s.task.myDay = todayStr();
          saveAndRender();
        });
        item.appendChild(addBtn);
        suggestDiv.appendChild(item);
      });
      videoSuggestions.forEach(s => {
        const item = document.createElement('div');
        item.className = 'suggest-item video-suggest-item';
        const text = document.createElement('span');
        text.className = 'suggest-text';
        text.textContent = s.video.title;
        const source = document.createElement('span');
        source.className = 'suggest-source';
        source.textContent = `${s.collection.name} · 视频学习`;
        text.appendChild(source);
        const addBtn = document.createElement('button');
        addBtn.className = 'add-to-myday';
        addBtn.textContent = '+';
        addBtn.title = '添加到“我的一天”';
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          s.video.myDay = todayStr();
          saveVideoCollections();
          render();
          renderSidebar();
        });
        item.appendChild(text);
        item.appendChild(addBtn);
        suggestDiv.appendChild(item);
      });
      list.appendChild(suggestDiv);
    } else if (visible.length === 0 && videoEntries.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <div class="emoji">☀️</div>
        <div>今天所有任务都已加入</div>
        <div class="hint">在下方添加新任务吧</div>
      </div>`;
    }
  }

  if (visible.length === 0 && (activeListId !== 'myday' || searchQuery)) {
    // check if we already set My Day empty state
    if (list.querySelector('.empty-state') || list.querySelector('.suggestions')) {
      // already handled
    } else {
      const msg = searchQuery
        ? `<div class="emoji">🔍</div><div>未找到"${searchQuery}"</div><div class="hint">试试其他关键词</div>`
        : `<div class="emoji">📋</div><div>今天有什么计划？</div><div class="hint">添加你的第一个任务吧</div>`;
      list.innerHTML = `<div class="empty-state">${msg}</div>`;
    }
  }

  // for planned view, sort by dueDate and group
  if (activeListId === 'planned' && !searchQuery) {
    const grouped = new Map();
    visible.forEach(t => {
      const key = t.dueDate || 'no-date';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(t);
    });
    const sortedKeys = [...grouped.keys()].sort((a, b) => {
      if (a === 'no-date') return 1;
      if (b === 'no-date') return -1;
      return a.localeCompare(b);
    });
    sortedKeys.forEach(key => {
      const header = document.createElement('div');
      header.className = 'planned-group-header';
      header.textContent = key === 'no-date' ? '未设置日期' : formatDate(key);
      list.appendChild(header);
      grouped.get(key).forEach(t => buildTaskItem(t));
    });
  } else {
    visible.forEach(t => buildTaskItem(t));
  }

  function buildTaskItem(t) {
    const li = document.createElement('li');
    if (t.done) li.classList.add('done');

    const check = document.createElement('span');
    check.className = 'check';
    check.addEventListener('click', () => {
      const wasDone = t.done;
      t.done = !t.done;
      t.completedAt = t.done ? (t.completedAt || new Date().toISOString()) : null;
      if (!wasDone && t.done) ding();
      saveAndRender();
    });

    const wrap = document.createElement('div');
    wrap.className = 'text-wrap';
    const textSpan = document.createElement('span');
    textSpan.className = 'text';
    textSpan.textContent = t.text;
    textSpan.title = '点击编辑';
    textSpan.style.cursor = 'text';
    textSpan.addEventListener('click', (e) => {
      if (t.done) return;
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'text';
      input.value = t.text;
      input.className = 'edit-input';
      input.addEventListener('blur', () => finishEdit(input, textSpan, t));
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { input.blur(); }
        if (ev.key === 'Escape') { input.value = t.text; input.blur(); }
      });
      wrap.replaceChild(input, textSpan);
      input.focus();
      input.select();
    });
    wrap.appendChild(textSpan);
    if (t.dueDate) {
      const badge = document.createElement('span');
      badge.className = 'due-badge' + (t.dueDate < todayStr() && !t.done ? ' overdue' : '');
      badge.textContent = '📅 ' + formatDate(t.dueDate);
      wrap.appendChild(badge);
    }

    const actions = document.createElement('span');
    actions.className = 'actions';

    const starBtn = document.createElement('button');
    starBtn.className = 'star-btn' + (t.important ? ' active' : '');
    starBtn.textContent = t.important ? '★' : '☆';
    starBtn.title = t.important ? '取消重要' : '标记为重要';
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      t.important = !t.important;
      saveAndRender();
    });

    const dateBtn = document.createElement('button');
    dateBtn.className = 'date-btn' + (t.dueDate ? ' active' : '');
    dateBtn.textContent = '📅';
    dateBtn.title = t.dueDate ? '截止日期: ' + formatDate(t.dueDate) + ' (点击修改)' : '设置截止日期';
    dateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pickDate(t);
    });

    actions.appendChild(starBtn);
    actions.appendChild(dateBtn);

    // only in My Day view, show cancel button to remove from My Day
    if (activeListId === 'myday') {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'myday-btn active';
      cancelBtn.textContent = '☀️';
      cancelBtn.title = '从"我的一天"移除';
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        t.myDay = null;
        saveAndRender();
      });
      actions.appendChild(cancelBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '🗑';
    delBtn.title = '删除';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // find and remove from source list (works for both smart and regular lists)
      for (const l of lists) {
        const idx = l.todos.indexOf(t);
        if (idx !== -1) {
          l.todos.splice(idx, 1);
          break;
        }
      }
      saveAndRender();
    });
    actions.appendChild(delBtn);

    li.appendChild(check);
    li.appendChild(wrap);
    li.appendChild(actions);
    list.appendChild(li);
  }

  const activeCount = todos.filter(t => !t.done).length
    + (activeListId === 'myday' ? getMyDayVideoEntries().filter(entry => !entry.video.done).length : 0);
  countEl.textContent = activeCount === 0 ? '全部完成 ✓' : `${activeCount} 项待完成`;
}

function saveAndRender() {
  saveLists(lists);
  render();
  renderSidebar();
}

function add() {
  const text = input.value.trim();
  if (!text) return;
  const task = { text, done: false, important: false, myDay: null, completedAt: null };
  if (activeListId === 'myday') {
    task.myDay = todayStr();
    const tasksList = lists.find(l => l.id === 'tasks');
    if (tasksList) tasksList.todos.unshift(task);
  } else {
    getTodos().unshift(task);
  }
  input.value = '';
  saveAndRender();
}

// migrate old tasks without important/myDay/dueDate
lists.forEach(l => {
  l.todos.forEach(t => {
    if (t.important === undefined) t.important = false;
    if (t.myDay === undefined) t.myDay = null;
    if (t.dueDate === undefined) t.dueDate = null;
  });
});

function backfillCompletedTimestamps(persist) {
  const nowIso = new Date().toISOString();
  let changed = false;

  lists.forEach(l => {
    (l.todos || []).forEach(t => {
      if (t.done && !t.completedAt) {
        t.completedAt = nowIso;
        changed = true;
      }
      if (!t.done && t.completedAt) {
        t.completedAt = null;
        changed = true;
      }
    });
  });

  roadmapProjects.forEach(project => {
    (project.items || []).forEach(item => {
      if (item.type !== 'task') return;
      if (item.done && !item.completedAt) {
        item.completedAt = nowIso;
        changed = true;
      }
      if (!item.done && item.completedAt) {
        item.completedAt = null;
        changed = true;
      }
    });
  });

  videoCollections = videoCollections.map(collection => {
    const normalized = normalizeVideoCollection(collection);
    normalized.videos = normalized.videos.map(video => {
      if (video.done && !video.completedAt) {
        video.completedAt = nowIso;
        changed = true;
      }
      if (!video.done && video.completedAt) {
        video.completedAt = null;
        changed = true;
      }
      return video;
    });
    return normalized;
  });
  videoProjects = videoCollections.flatMap(collection => collection.videos);

  if (changed && persist !== false) {
    localStorage.setItem('todoLists', JSON.stringify(lists));
    localStorage.setItem('roadmapProjects', JSON.stringify(roadmapProjects));
    localStorage.setItem('videoCollections', JSON.stringify(videoCollections));
    localStorage.setItem('videoProjects', JSON.stringify(videoProjects));
    try { saveLocalSnapshot(buildSnapshot()); } catch (e) {}
    scheduleCloudSync();
  }

  return changed;
}

backfillCompletedTimestamps(true);

// ── Smart list helpers ──
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

function isSmartList(id) {
  return ['myday', 'important', 'planned'].includes(id);
}

function getSmartListTodos(id) {
  let tasks = [];
  lists.forEach(l => {
    l.todos.forEach(t => {
      if (id === 'myday' && t.myDay === todayStr()) tasks.push(t);
      if (id === 'important' && t.important) tasks.push(t);
      if (id === 'planned' && t.dueDate) tasks.push(t);
    });
  });
  return tasks;
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
  return `${m}月${d}日 ${weekdays[date.getDay()]}`;
}

// hidden date picker for due dates
const datePicker = document.createElement('input');
datePicker.type = 'date';
datePicker.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
document.body.appendChild(datePicker);
let datePickTarget = null;

datePicker.addEventListener('change', () => {
  if (datePickTarget) {
    datePickTarget.dueDate = datePicker.value || null;
    saveAndRender();
  }
  datePickTarget = null;
});

datePicker.addEventListener('blur', () => {
  setTimeout(() => { datePickTarget = null; }, 200);
});

function pickDate(task) {
  datePickTarget = task;
  datePicker.value = task.dueDate || '';
  datePicker.showPicker ? datePicker.showPicker() : datePicker.click();
}

function finishEdit(input, textSpan, task) {
  const newText = input.value.trim();
  if (newText && newText !== task.text) {
    task.text = newText;
    saveAndRender();
  } else {
    textSpan.textContent = task.text;
    input.replaceWith(textSpan);
  }
}

addBtn.addEventListener('click', add);
input.addEventListener('keydown', e => {
  if (e.key === 'Enter') add();
});

clearDoneBtn.addEventListener('click', () => {
  if (isSmartList(activeListId)) {
    lists.forEach(l => {
      l.todos = l.todos.filter(t => !t.done);
    });
  } else {
    const al = getActiveList();
    if (al) al.todos = al.todos.filter(t => !t.done);
  }
  saveAndRender();
});

if (aiSummaryBtn) aiSummaryBtn.addEventListener('click', openAiSummaryModal);
if (aiSummaryBackdrop) aiSummaryBackdrop.addEventListener('click', closeAiSummaryModal);
if (aiSummaryClose) aiSummaryClose.addEventListener('click', closeAiSummaryModal);
if (aiSummaryDate) aiSummaryDate.addEventListener('change', updateAiSummaryMode);
if (deepseekKeyInput) {
  deepseekKeyInput.addEventListener('change', () => {
    aiSettings.deepseekApiKey = deepseekKeyInput.value.trim();
    saveAiData();
    setAiStatus('DeepSeek API Key 已保存', 'ok');
  });
}
if (aiGenerateBtn) aiGenerateBtn.addEventListener('click', generateAiSummary);
document.querySelectorAll('[data-summary-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    aiSummaryType = btn.dataset.summaryType === 'weekly' ? 'weekly' : 'daily';
    updateAiSummaryMode();
  });
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && aiSummaryModal && !aiSummaryModal.hidden) closeAiSummaryModal();
});

// sidebar default nav click
document.querySelectorAll('.sidebar .nav li').forEach(li => {
  li.addEventListener('click', () => {
    switchToList(li.dataset.listId);
  });
});

// new list
newListBtn.addEventListener('click', () => newListRow.classList.toggle('show'));
createListBtn.addEventListener('click', () => {
  const name = newListInput.value.trim();
  if (!name) return;
  const id = 'custom_' + Date.now();
  lists.push({ id, name, todos: [] });
  newListInput.value = '';
  newListRow.classList.remove('show');
  saveLists(lists);
  switchToList(id);
});
newListInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') createListBtn.click();
});

importRoadmapBtn.addEventListener('click', () => {
  roadmapFileInput.click();
});

async function buildVideoFromBvid(inputValue) {
  const bvid = normalizeBvid(inputValue);
  if (!bvid) {
    alert('请输入有效的 BV 号，例如 BV1GJ411x7h7。');
    return null;
  }

  let metadata = null;
  try {
    metadata = await fetchBilibiliMetadata(bvid);
  } catch (e) {
    alert('没有获取到这个 BV 号的视频信息。请检查 BV 号是否正确，或这个视频是否仍可访问。');
    return null;
  }

  const defaultTitle = (metadata && metadata.title) || getBilibiliVideoTitle(bvid);
  let title = defaultTitle;
  let duration = metadata ? Number(metadata.duration) || 0 : 0;
  let cover = metadata ? metadata.cover || '' : '';

  return normalizeVideoProject({
    id: 'video_project_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    title: title || defaultTitle,
    url: getBilibiliVideoUrl((metadata && metadata.bvid) || bvid),
    bvid: (metadata && metadata.bvid) || bvid,
    cover,
    duration,
    progressPercent: 0,
    done: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function createVideoCollection() {
  const name = (prompt('新建视频收藏夹名称，例如：CUDA 学习、绘画教程') || '').trim();
  if (!name) return null;
  const collection = normalizeVideoCollection({
    id: 'video_collection_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name,
    videos: [],
    createdAt: new Date().toISOString(),
  });
  videoCollections.push(collection);
  saveVideoCollections();
  switchToList('video-collection:' + collection.id);
  return collection;
}

async function addVideoToCollection(collection) {
  if (!collection) return;
  const inputValue = prompt('输入 B 站视频 BV 号，添加到“' + collection.name + '”');
  if (!inputValue) return;
  const video = await buildVideoFromBvid(inputValue.trim());
  if (!video) return;
  collection.videos.push(video);
  saveVideoCollections();
  switchToList('video-collection:' + collection.id);
}

videoLabel.addEventListener('click', (e) => {
  if (e.target === addVideoBtn) return;
  switchToList('videos');
});

addVideoBtn.addEventListener('click', (e) => {
  e.stopImmediatePropagation();
  createVideoCollection();
}, true);

addCalendarBtn.addEventListener('click', () => {
  const name = (prompt('添加日历打卡项目，例如：练琴、运动') || '').trim();
  if (!name) return;
  const project = normalizeCalendarProject({
    id: 'calendar_project_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name,
    days: {},
    createdAt: new Date().toISOString(),
  });
  calendarProjects.push(project);
  saveCalendarProjects();
  switchToList('calendar:' + project.id);
});

calendarLabel.addEventListener('click', (e) => {
  if (e.target === addCalendarBtn) return;
  switchToList('calendar');
});

roadmapFileInput.addEventListener('change', () => {
  const files = Array.from(roadmapFileInput.files || []);
  if (!files.length) return;

  Promise.all(files.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(parseRoadmapMarkdown(String(reader.result || ''), file.name));
    reader.onerror = () => reject(file.name);
    reader.readAsText(file, 'utf-8');
  }))).then(projects => {
    roadmapProjects.push(...projects);
    saveRoadmapProjects();
    roadmapFileInput.value = '';
    switchToList('roadmap:' + projects[0].id);
  }).catch(() => {
    alert('Markdown 文件读取失败，请重试。');
    roadmapFileInput.value = '';
  });
});

// init
switchToList(activeListId);

// ── Background picker ──
const mainArea = document.querySelector('.main');
const bgBtn = document.getElementById('bgBtn');

const backgrounds = [
  { name: '天空蓝', css: 'linear-gradient(135deg, #2564CF 0%, #3b82f6 40%, #60a5fa 100%)' },
  { name: '紫罗兰', css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: '粉霞', css: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: '冰蓝', css: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { name: '薄荷绿', css: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { name: '日落橘', css: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { name: '薰衣草', css: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { name: '海洋蓝', css: 'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)' },
  { name: '夜空', css: 'linear-gradient(135deg, #09203f 0%, #537895 100%)' },
  { name: '暮光', css: 'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)' },
  { name: '深夜蓝', css: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' },
  { name: '暗影', css: 'linear-gradient(135deg, #000000 0%, #434343 100%)' },
];

function getCustomImages() {
  try { return JSON.parse(localStorage.getItem('customBgs')) || []; }
  catch (e) { return []; }
}

function saveCustomImages(imgs) {
  localStorage.setItem('customBgs', JSON.stringify(imgs));
  scheduleCloudSync();
}

let bgIndex = parseInt(localStorage.getItem('bgIndex')) || 0;
let bgType = localStorage.getItem('bgType') || 'preset';
let customIdx = parseInt(localStorage.getItem('customBgIdx')) || 0;

function applyBackground() {
  if (bgType === 'custom') {
    const imgs = getCustomImages();
    if (imgs[customIdx]) {
      mainArea.style.setProperty('--hero-bg', `url(${imgs[customIdx]}) center/cover no-repeat`);
    } else {
      bgType = 'preset'; bgIndex = 0;
      mainArea.style.setProperty('--hero-bg', backgrounds[bgIndex].css);
    }
  } else {
    mainArea.style.setProperty('--hero-bg', backgrounds[bgIndex].css);
  }
}

applyBackground();

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/*';
fileInput.style.cssText = 'position:fixed;left:-9999px;top:0;';
document.body.appendChild(fileInput);

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  // check size — localStorage limit ~5MB, warn if > 2MB
  if (file.size > 2 * 1024 * 1024) {
    alert('图片过大（超过2MB），可能导致保存失败，请使用较小的图片。');
  }
  const reader = new FileReader();
  reader.onload = () => {
    const imgs = getCustomImages();
    imgs.push(reader.result);
    saveCustomImages(imgs);
    bgType = 'custom';
    customIdx = imgs.length - 1;
    localStorage.setItem('bgType', 'custom');
    localStorage.setItem('customBgIdx', customIdx);
    scheduleCloudSync();
    applyBackground();
    openPicker();
  };
  reader.onerror = () => {
    alert('图片读取失败，请重试。');
  };
  reader.readAsDataURL(file);
  // clear so same file can be re-selected
  fileInput.value = '';
});

function openPicker() {
  const existing = document.querySelector('.overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const customImgs = getCustomImages();

  let gridHTML = backgrounds.map((b, i) => {
    const sel = (bgType === 'preset' && i === bgIndex) ? ' selected' : '';
    return `<div class="swatch${sel}" style="background:${b.css}" data-type="preset" data-index="${i}" title="${b.name}"></div>`;
  }).join('');

  gridHTML += `<div class="swatch upload-tile" title="上传本地图片">+</div>`;

  let customHTML = '';
  if (customImgs.length > 0) {
    customHTML = '<div class="custom-label">我的图片</div><div class="custom-grid">';
    customImgs.forEach((url, i) => {
      const sel = (bgType === 'custom' && i === customIdx) ? ' selected' : '';
      customHTML += `<div class="custom-swatch${sel}" style="background-image:url(${url})" data-type="custom" data-index="${i}">
        <span class="rm" data-rm="${i}">&times;</span>
      </div>`;
    });
    customHTML += '</div>';
  }

  const cardOpacity = localStorage.getItem('cardOpacity') || '0.92';
  const cardBlur = localStorage.getItem('cardBlur') || '8';

  overlay.innerHTML = `<div class="picker" style="position:relative">
    <button class="close" onclick="closePicker()">&times;</button>
    <h2>选择背景</h2>
    <div class="sub">选择你喜欢的主题或上传本地图片</div>
    <div class="grid">${gridHTML}</div>
    ${customHTML}
    <div class="opacity-row">
      <label for="opacitySlider">卡片透明度</label>
      <input type="range" id="opacitySlider" min="0.3" max="1" step="0.01" value="${cardOpacity}">
      <span class="val" id="opacityVal">${Math.round(cardOpacity * 100)}%</span>
    </div>
  </div>`;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePicker();
  });

  overlay.querySelector('.grid').addEventListener('click', (e) => {
    const swatch = e.target.closest('.swatch');
    if (!swatch) return;
    if (swatch.classList.contains('upload-tile')) {
      fileInput.click();
      return;
    }
    bgType = swatch.dataset.type;
    if (bgType === 'preset') {
      bgIndex = parseInt(swatch.dataset.index);
    } else {
      customIdx = parseInt(swatch.dataset.index);
    }
    localStorage.setItem('bgType', bgType);
    localStorage.setItem('bgIndex', bgIndex);
    localStorage.setItem('customBgIdx', customIdx);
    scheduleCloudSync();
    applyBackground();
    overlay.querySelectorAll('.swatch, .custom-swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
    setTimeout(closePicker, 150);
  });

  const customGrid = overlay.querySelector('.custom-grid');
  if (customGrid) {
    customGrid.addEventListener('click', (e) => {
      const swatch = e.target.closest('.custom-swatch');
      if (!swatch) return;
      if (e.target.classList.contains('rm')) return;
      bgType = 'custom';
      customIdx = parseInt(swatch.dataset.index);
      localStorage.setItem('bgType', 'custom');
      localStorage.setItem('customBgIdx', customIdx);
      scheduleCloudSync();
      applyBackground();
      overlay.querySelectorAll('.swatch, .custom-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      setTimeout(closePicker, 150);
    });

    customGrid.querySelectorAll('.rm').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.rm);
        const imgs = getCustomImages();
        imgs.splice(idx, 1);
        saveCustomImages(imgs);
        if (bgType === 'custom') {
          if (imgs.length === 0) { bgType = 'preset'; bgIndex = 0; }
          else if (customIdx >= imgs.length) customIdx = imgs.length - 1;
          localStorage.setItem('bgType', bgType);
          localStorage.setItem('customBgIdx', customIdx);
          scheduleCloudSync();
        }
        applyBackground();
        openPicker();
      });
    });
  }

  // opacity slider
  const opacitySlider = overlay.querySelector('#opacitySlider');
  const opacityVal = overlay.querySelector('#opacityVal');
  opacitySlider.addEventListener('input', () => {
    document.documentElement.style.setProperty('--card-opacity', opacitySlider.value);
    document.documentElement.style.setProperty('--card-blur', Math.round((1 - opacitySlider.value) * 26) + 'px');
    opacityVal.textContent = Math.round(opacitySlider.value * 100) + '%';
    localStorage.setItem('cardOpacity', opacitySlider.value);
    localStorage.setItem('cardBlur', Math.round((1 - opacitySlider.value) * 26));
    scheduleCloudSync();
  });

  document.body.appendChild(overlay);
}

function closePicker() {
  const overlay = document.querySelector('.overlay');
  if (!overlay) return;
  overlay.classList.add('closing');
  setTimeout(() => overlay.remove(), 150);
}

function setSyncStatus(message, type) {
  if (!syncStatus) return;
  syncStatus.textContent = message;
  syncStatus.classList.toggle('ok', type === 'ok');
  syncStatus.classList.toggle('error', type === 'error');
}

function getErrorMessage(error, fallback) {
  if (!error) return fallback;
  return error.message || error.details || error.hint || String(error) || fallback;
}

function setSyncBusy(isBusy) {
  [syncLoginBtn, syncSignupBtn, manualSyncBtn, syncLogoutBtn].forEach(btn => {
    if (btn) btn.disabled = isBusy;
  });
}

function updateAuthUI() {
  const signedIn = Boolean(currentUser);
  syncForm.hidden = signedIn;
  syncUser.hidden = !signedIn;
  syncUserEmail.textContent = signedIn ? currentUser.email : '';
}

function getSettingValue(key, fallback) {
  const value = localStorage.getItem(key);
  return value === null ? fallback : value;
}

function buildSnapshot() {
  return {
    version: SNAPSHOT_VERSION,
    todoLists: lists,
    roadmapProjects,
    videoProjects: videoProjects.map(normalizeVideoProject),
    videoCollections: videoCollections.map(normalizeVideoCollection),
    calendarProjects: calendarProjects.map(normalizeCalendarProject),
    aiSummaries: aiSummaries.map(normalizeAiSummary),
    settings: {
      theme: getTheme(),
      username: usernameEl.textContent || 'Lenovo',
      activeListId,
      bgType,
      bgIndex,
      customBgs: getCustomImages(),
      customBgIdx: customIdx,
      cardOpacity: getSettingValue('cardOpacity', '0.92'),
      cardBlur: getSettingValue('cardBlur', '8'),
      sidebarLabels,
      aiSettings,
    },
    updatedAt: new Date().toISOString(),
  };
}

function hasLocalUserData(snapshot) {
  const hasTodos = snapshot.todoLists.some(l => {
    const isDefault = defaultLists.some(d => d.id === l.id);
    return l.todos.length > 0 || !isDefault;
  });
  const hasRoadmaps = snapshot.roadmapProjects.length > 0;
  const hasVideos = Array.isArray(snapshot.videoProjects) && snapshot.videoProjects.length > 0;
  const hasVideoCollections = Array.isArray(snapshot.videoCollections) && snapshot.videoCollections.length > 0;
  const hasCalendars = Array.isArray(snapshot.calendarProjects) && snapshot.calendarProjects.length > 0;
  const hasAiSummaries = Array.isArray(snapshot.aiSummaries) && snapshot.aiSummaries.length > 0;
  const settings = snapshot.settings;
  const hasCustomSettings = settings.username !== 'Lenovo'
    || settings.theme !== (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    || settings.bgType !== 'preset'
    || Number(settings.bgIndex) !== 0
    || settings.customBgs.length > 0
    || settings.cardOpacity !== '0.92'
    || settings.cardBlur !== '8'
    || JSON.stringify(settings.sidebarLabels || DEFAULT_SIDEBAR_LABELS) !== JSON.stringify(DEFAULT_SIDEBAR_LABELS)
    || !!(settings.aiSettings && settings.aiSettings.deepseekApiKey);
  return hasTodos || hasRoadmaps || hasVideos || hasVideoCollections || hasCalendars || hasAiSummaries || hasCustomSettings;
}

function saveLocalSnapshot(snapshot) {
  localStorage.setItem('appSnapshot', JSON.stringify(snapshot || buildSnapshot()));
}

function applySnapshot(snapshot) {
  if (!snapshot || snapshot.version !== SNAPSHOT_VERSION) {
    throw new Error('不支持的云端数据版本');
  }

  let completedAtBackfilled = false;
  suppressSync = true;
  try {
    const settings = snapshot.settings || {};
    lists = Array.isArray(snapshot.todoLists) ? snapshot.todoLists.filter(l => l.id !== 'roadmap') : loadLists();
    roadmapProjects = Array.isArray(snapshot.roadmapProjects) ? snapshot.roadmapProjects : [];
    videoProjects = Array.isArray(snapshot.videoProjects) ? snapshot.videoProjects.map(normalizeVideoProject) : [];
    videoCollections = Array.isArray(snapshot.videoCollections) && snapshot.videoCollections.length
      ? snapshot.videoCollections.map(normalizeVideoCollection)
      : (videoProjects.length ? [normalizeVideoCollection({ id: 'video_collection_default', name: '默认收藏夹', videos: videoProjects })] : []);
    videoProjects = videoCollections.flatMap(collection => collection.videos);
    calendarProjects = Array.isArray(snapshot.calendarProjects) ? snapshot.calendarProjects.map(normalizeCalendarProject) : [];
    aiSummaries = Array.isArray(snapshot.aiSummaries) ? snapshot.aiSummaries.map(normalizeAiSummary) : [];
    aiSettings = {
      ...loadAiSettings(),
      ...(settings.aiSettings || {}),
      model: (settings.aiSettings && settings.aiSettings.model) || 'deepseek-chat',
    };
    completedAtBackfilled = backfillCompletedTimestamps(false);

    localStorage.setItem('todoLists', JSON.stringify(lists));
    localStorage.setItem('roadmapProjects', JSON.stringify(roadmapProjects));
    localStorage.setItem('videoProjects', JSON.stringify(videoProjects));
    localStorage.setItem('videoCollections', JSON.stringify(videoCollections));
    localStorage.setItem('calendarProjects', JSON.stringify(calendarProjects));
    localStorage.setItem('aiSummaries', JSON.stringify(aiSummaries));
    localStorage.setItem('aiSettings', JSON.stringify(aiSettings));

    if (settings.theme) applyTheme(settings.theme);
    if (settings.username) {
      usernameEl.textContent = settings.username;
      avatarEl.textContent = settings.username.charAt(0).toUpperCase();
      localStorage.setItem('username', settings.username);
    }

    sidebarLabels = { ...DEFAULT_SIDEBAR_LABELS, ...(settings.sidebarLabels || {}) };
    delete sidebarLabels['nav.myday'];
    delete sidebarLabels['nav.important'];
    delete sidebarLabels['nav.planned'];
    delete sidebarLabels['nav.tasks'];
    localStorage.setItem('sidebarLabels', JSON.stringify(sidebarLabels));

    bgType = settings.bgType || 'preset';
    bgIndex = Number.isFinite(Number(settings.bgIndex)) ? Number(settings.bgIndex) : 0;
    customIdx = Number.isFinite(Number(settings.customBgIdx)) ? Number(settings.customBgIdx) : 0;
    localStorage.setItem('bgType', bgType);
    localStorage.setItem('bgIndex', bgIndex);
    localStorage.setItem('customBgIdx', customIdx);
    localStorage.setItem('customBgs', JSON.stringify(Array.isArray(settings.customBgs) ? settings.customBgs : []));

    const cardOpacity = settings.cardOpacity || '0.92';
    const cardBlur = settings.cardBlur || '8';
    localStorage.setItem('cardOpacity', cardOpacity);
    localStorage.setItem('cardBlur', cardBlur);
    document.documentElement.style.setProperty('--card-opacity', cardOpacity);
    document.documentElement.style.setProperty('--card-blur', cardBlur + 'px');

    activeListId = settings.activeListId || 'tasks';
    if (isRoadmapView(activeListId) && !getActiveRoadmap()) activeListId = 'tasks';
    if (activeListId.startsWith('video:')) activeListId = videoCollections[0] ? 'video-collection:' + videoCollections[0].id : 'videos';
    if (activeListId !== 'videos' && activeListId.startsWith('video-collection:') && !getActiveVideoCollection()) activeListId = 'videos';
    if (activeListId !== 'calendar' && isCalendarView(activeListId) && !getActiveCalendarProject()) activeListId = 'calendar';
    if (!isRoadmapView(activeListId) && !isVideoView(activeListId) && !isCalendarView(activeListId) && !defaultLists.some(d => d.id === activeListId) && !lists.some(l => l.id === activeListId)) {
      activeListId = 'tasks';
    }
    localStorage.setItem('activeListId', activeListId);

    applyBackground();
    saveLocalSnapshot(completedAtBackfilled ? buildSnapshot() : snapshot);
    switchToList(activeListId);
  } finally {
    suppressSync = false;
  }
  if (completedAtBackfilled) scheduleCloudSync();
}

async function loadCloudSnapshot() {
  if (!supabaseClient || !currentUser) return null;
  const { data, error } = await supabaseClient
    .from('app_snapshots')
    .select('data, updated_at')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (error) throw error;
  return data ? data.data : null;
}

async function saveCloudSnapshot(snapshot) {
  if (!supabaseClient || !currentUser) return;
  const nextSnapshot = snapshot || buildSnapshot();
  nextSnapshot.updatedAt = new Date().toISOString();
  saveLocalSnapshot(nextSnapshot);

  setSyncStatus('正在同步...', '');
  const { error } = await supabaseClient
    .from('app_snapshots')
    .upsert({
      user_id: currentUser.id,
      data: nextSnapshot,
      updated_at: nextSnapshot.updatedAt,
    }, { onConflict: 'user_id' });

  if (error) throw error;
  setSyncStatus('已同步', 'ok');
}

function scheduleCloudSync() {
  if (suppressSync || !appBootstrapped) return;
  if (!currentUser || !syncReady) {
    try { saveLocalSnapshot(buildSnapshot()); } catch (e) {}
    return;
  }
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    saveCloudSnapshot().catch(() => {
      setSyncStatus('本地已保存，云端同步失败，请点同步重试', 'error');
    });
  }, 900);
}

async function handleSignedIn(user) {
  currentUser = user;
  syncReady = false;
  updateAuthUI();
  setSyncStatus('正在读取云端...', '');

  try {
    const cloudSnapshot = await loadCloudSnapshot();
    const localSnapshot = buildSnapshot();
    const resolvedKey = 'syncResolved:' + currentUser.id;
    const hasResolved = localStorage.getItem(resolvedKey) === '1';

    if (!cloudSnapshot) {
      await saveCloudSnapshot(localSnapshot);
      localStorage.setItem(resolvedKey, '1');
    } else if (hasLocalUserData(localSnapshot) && !hasResolved) {
      const useCloud = confirm('云端已有数据。点击“确定”使用云端数据覆盖本地；点击“取消”上传本地数据覆盖云端。');
      if (useCloud) {
        applySnapshot(cloudSnapshot);
        setSyncStatus('已加载云端数据', 'ok');
      } else {
        await saveCloudSnapshot(localSnapshot);
      }
      localStorage.setItem(resolvedKey, '1');
    } else {
      applySnapshot(cloudSnapshot);
      setSyncStatus('已加载云端数据', 'ok');
    }

    syncReady = true;
  } catch (error) {
    syncReady = true;
    setSyncStatus('云端同步初始化失败：' + getErrorMessage(error, '未知错误'), 'error');
    console.error(error);
  }
}

function handleSignedOut() {
  currentUser = null;
  syncReady = false;
  updateAuthUI();
  setSyncStatus('未登录，本地保存', '');
}

function getAuthFields() {
  return {
    email: syncEmail.value.trim(),
    password: syncPassword.value,
  };
}

async function signUp() {
  if (!supabaseClient) return;
  const { email, password } = getAuthFields();
  if (!email || !password) {
    setSyncStatus('请输入邮箱和密码', 'error');
    return;
  }
  setSyncBusy(true);
  setSyncStatus('正在注册...', '');
  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    if (data.session && data.user && (!currentUser || currentUser.id !== data.user.id)) {
      await handleSignedIn(data.user);
      setSyncStatus('注册成功，已同步', 'ok');
    } else {
      setSyncStatus('注册成功，请检查邮箱确认后再登录', 'ok');
    }
  } catch (error) {
    setSyncStatus(error.message || '注册失败', 'error');
  } finally {
    setSyncBusy(false);
  }
}

async function signIn() {
  if (!supabaseClient) return;
  const { email, password } = getAuthFields();
  if (!email || !password) {
    setSyncStatus('请输入邮箱和密码', 'error');
    return;
  }
  setSyncBusy(true);
  setSyncStatus('正在登录...', '');
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user && (!currentUser || currentUser.id !== data.user.id)) await handleSignedIn(data.user);
  } catch (error) {
    setSyncStatus(error.message || '登录失败', 'error');
  } finally {
    setSyncBusy(false);
  }
}

async function signOut() {
  if (!supabaseClient) return;
  setSyncBusy(true);
  try {
    await supabaseClient.auth.signOut();
    handleSignedOut();
  } finally {
    setSyncBusy(false);
  }
}

async function manualSync() {
  if (!currentUser || !syncReady) {
    setSyncStatus('请先登录', 'error');
    return;
  }
  try {
    await saveCloudSnapshot();
  } catch (error) {
    setSyncStatus('本地已保存，云端同步失败：' + getErrorMessage(error, '未知错误'), 'error');
  }
}

async function initSupabaseSync() {
  updateAuthUI();

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    setSyncStatus('Supabase 未配置，本地保存', 'error');
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    setSyncStatus('Supabase SDK 加载失败', 'error');
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  syncLoginBtn.addEventListener('click', signIn);
  syncSignupBtn.addEventListener('click', signUp);
  syncLogoutBtn.addEventListener('click', signOut);
  manualSyncBtn.addEventListener('click', manualSync);
  [syncEmail, syncPassword].forEach(el => {
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') signIn();
    });
  });

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') handleSignedOut();
    if (event === 'SIGNED_IN' && session && (!currentUser || currentUser.id !== session.user.id)) {
      handleSignedIn(session.user);
    }
  });

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setSyncStatus(error.message || '读取登录状态失败', 'error');
    return;
  }

  if (data.session) await handleSignedIn(data.session.user);
  else handleSignedOut();
}

bgBtn.addEventListener('click', openPicker);
appBootstrapped = true;
initSupabaseSync();
