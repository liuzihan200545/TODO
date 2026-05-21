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

let searchQuery = '';
let activeListId = 'tasks';

const defaultLists = [
  { id: 'myday', name: '我的一天', icon: 'sun' },
  { id: 'important', name: '重要', icon: 'star' },
  { id: 'planned', name: '计划内', icon: 'calendar' },
  { id: 'tasks', name: '任务', icon: 'list' },
];

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

function getActiveList() {
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

function getRoadmapIdFromListId(id) {
  return id.startsWith('roadmap:') ? id.slice('roadmap:'.length) : null;
}

function getActiveRoadmap() {
  const roadmapId = getRoadmapIdFromListId(activeListId);
  return roadmapProjects.find(project => project.id === roadmapId) || null;
}

function getRoadmapOpenCount(project) {
  if (!project) return 0;
  return project.items.filter(item => item.type === 'task' && !item.done).length;
}

function renderSidebar() {
  // update default nav counts (smart lists pull from all lists)
  document.querySelectorAll('.sidebar .nav li').forEach(li => {
        const id = li.dataset.listId;
        const countEl = li.querySelector('.count');
        if (!countEl || !id) return;
        if (isSmartList(id)) {
          countEl.textContent = getSmartListTodos(id).filter(t => !t.done).length || '';
        } else {
          countEl.textContent = getListCount(id) || '';
    }
  });

  // set active on default nav
  document.querySelectorAll('.sidebar .nav li').forEach(li => {
    li.classList.toggle('active', li.dataset.listId === activeListId);
  });

  renderRoadmapProjects();

  // render custom lists
  const custom = lists.filter(l => !defaultLists.find(d => d.id === l.id));
  customLists.innerHTML = '';
  custom.forEach(cl => {
    const li = document.createElement('li');
    li.className = cl.id === activeListId ? 'active' : '';
    const activeCount = cl.todos.filter(t => !t.done).length;
    li.innerHTML = `<span class="list-icon"><svg viewBox="0 0 24 24"><circle cx="7" cy="8" r="1.5"/><path d="M10 8h9"/><circle cx="7" cy="16" r="1.5"/><path d="M10 16h9"/></svg></span>
      <span>${cl.name}</span>
      <span class="count">${activeCount || ''}</span>
      <button class="del-list" data-id="${cl.id}" title="删除列表">&times;</button>`;
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

function switchToList(id) {
  activeListId = id;
  localStorage.setItem('activeListId', id);
  scheduleCloudSync();
  const def = defaultLists.find(d => d.id === id);
  const roadmap = getActiveRoadmap();
  const l = def || roadmap || lists.find(x => x.id === id);
  if (l) listTitle.textContent = l.name;
  if (roadmap) listTitle.textContent = roadmap.title;
  if (id === 'roadmap') listTitle.textContent = '路线图';
  searchQuery = '';
  const si = document.getElementById('searchInput');
  const ns = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  ns.call(si, '');
  // hide input row for smart lists except myday
  document.querySelector('.input-row').style.display = ((isSmartList(id) && id !== 'myday') || isRoadmapView(id)) ? 'none' : 'flex';
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
      items.push({
        id: 'roadmap_' + Date.now() + '_' + items.length,
        type: 'task',
        done: task[1].toLowerCase() === 'x',
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

function render() {
  list.innerHTML = '';
  clearDoneBtn.style.display = '';

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

    if (suggestions.length > 0) {
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
      list.appendChild(suggestDiv);
    } else if (visible.length === 0) {
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
      t.done = !t.done;
      if (t.done) ding();
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

  const activeCount = todos.filter(t => !t.done).length;
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
  const task = { text, done: false, important: false, myDay: null };
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
  const settings = snapshot.settings;
  const hasCustomSettings = settings.username !== 'Lenovo'
    || settings.theme !== (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    || settings.bgType !== 'preset'
    || Number(settings.bgIndex) !== 0
    || settings.customBgs.length > 0
    || settings.cardOpacity !== '0.92'
    || settings.cardBlur !== '8';
  return hasTodos || hasRoadmaps || hasCustomSettings;
}

function saveLocalSnapshot(snapshot) {
  localStorage.setItem('appSnapshot', JSON.stringify(snapshot || buildSnapshot()));
}

function applySnapshot(snapshot) {
  if (!snapshot || snapshot.version !== SNAPSHOT_VERSION) {
    throw new Error('不支持的云端数据版本');
  }

  suppressSync = true;
  try {
    const settings = snapshot.settings || {};
    lists = Array.isArray(snapshot.todoLists) ? snapshot.todoLists.filter(l => l.id !== 'roadmap') : loadLists();
    roadmapProjects = Array.isArray(snapshot.roadmapProjects) ? snapshot.roadmapProjects : [];

    localStorage.setItem('todoLists', JSON.stringify(lists));
    localStorage.setItem('roadmapProjects', JSON.stringify(roadmapProjects));

    if (settings.theme) applyTheme(settings.theme);
    if (settings.username) {
      usernameEl.textContent = settings.username;
      avatarEl.textContent = settings.username.charAt(0).toUpperCase();
      localStorage.setItem('username', settings.username);
    }

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
    if (!isRoadmapView(activeListId) && !defaultLists.some(d => d.id === activeListId) && !lists.some(l => l.id === activeListId)) {
      activeListId = 'tasks';
    }
    localStorage.setItem('activeListId', activeListId);

    applyBackground();
    saveLocalSnapshot(snapshot);
    switchToList(activeListId);
  } finally {
    suppressSync = false;
  }
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
