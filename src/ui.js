/**
 * src/ui.js
 * 完整增强版：包含原生拖拽排序、完整的分类管理、移动端适配
 */
export function renderUI(ssrData, ssrConfig) {
  // 安全转义工具
  const esc = (str) => String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m]));
  
  // 将数据安全地注入到前端 Script 标签中
  const safeState = JSON.stringify({
    data: ssrData.nav || [], // 确保结构正确
    config: ssrConfig,
    auth: '', 
    isRoot: false
  }).replace(/</g, "\\u003c"); // 防止 XSS

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>${esc(ssrConfig.TITLE)}</title>
<link rel="icon" href="https://cdn-icons-png.flaticon.com/512/1006/1006771.png">
<style>
  :root {
    --glass: rgba(30, 30, 30, 0.8);
    --glass-border: rgba(255, 255, 255, 0.1);
    --accent: #3b82f6;
    --danger: #ef4444;
    --text: #f3f4f6;
    --text-sub: #9ca3af;
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body {
    margin: 0; padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: url('${esc(ssrConfig.BG_IMAGE)}') center/cover fixed no-repeat, #111;
    color: var(--text); min-height: 100vh; padding-bottom: 120px;
  }
  body::before { content: ''; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: -1; backdrop-filter: blur(5px); }

  /* 1. 顶部导航 (Categories) */
  .nav-header {
    position: sticky; top: 0; z-index: 50;
    background: rgba(18, 18, 18, 0.95);
    border-bottom: 1px solid var(--glass-border);
    padding-top: env(safe-area-inset-top);
    display: flex; align-items: flex-end; overflow: hidden;
  }
  .nav-scroll {
    display: flex; gap: 4px; padding: 0 10px; overflow-x: auto; width: 100%;
    scrollbar-width: none; align-items: center; height: 50px;
  }
  .nav-item {
    padding: 8px 16px; font-size: 14px; color: var(--text-sub);
    white-space: nowrap; cursor: pointer; border-radius: 8px;
    transition: 0.2s; position: relative; user-select: none;
    border: 1px solid transparent;
  }
  .nav-item.active { color: #fff; background: rgba(255,255,255,0.1); font-weight: 500; }
  .nav-item.private::after { content: '🔒'; font-size: 10px; margin-left: 4px; opacity: 0.6; }
  
  /* 编辑模式下的分类样式 */
  .editing .nav-item { border: 1px dashed #666; padding-right: 25px; cursor: move; }
  .nav-item .cat-del { 
    display: none; position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
    width: 16px; height: 16px; border-radius: 50%; background: var(--danger); 
    color: white; font-size: 10px; align-items: center; justify-content: center;
  }
  .editing .nav-item .cat-del { display: flex; }

  /* 2. 搜索框 */
  .search-wrap { max-width: 600px; margin: 30px auto 20px; padding: 0 20px; display: flex; flex-direction: column; gap: 12px; }
  .search-engines { display: flex; justify-content: center; gap: 15px; font-size: 13px; color: var(--text-sub); }
  .engine { cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: 0.2s; }
  .engine.active { color: var(--accent); background: rgba(59, 130, 246, 0.1); font-weight: bold; }
  .search-input-box {
    display: flex; align-items: center; background: rgba(30,30,30,0.6);
    border: 1px solid var(--glass-border); border-radius: 12px; height: 46px;
    transition: 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  .search-input-box:focus-within { border-color: var(--accent); background: rgba(0,0,0,0.8); }
  .search-input { 
    flex: 1; background: transparent; border: none; padding: 0 16px; 
    color: #fff; font-size: 16px; outline: none; height: 100%;
  }

  /* 3. 网格布局 (Links) */
  .grid { 
    display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); 
    gap: 16px; padding: 16px; max-width: 1000px; margin: 0 auto; 
  }
  .card-wrap { position: relative; }
  .card {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: var(--glass); border: 1px solid var(--glass-border); border-radius: 16px;
    height: 110px; text-decoration: none; color: var(--text);
    transition: transform 0.2s, background 0.2s; position: relative;
  }
  .card:hover { transform: translateY(-3px); background: rgba(50,50,50,0.9); border-color: rgba(255,255,255,0.2); }
  .card img { width: 44px; height: 44px; margin-bottom: 12px; border-radius: 10px; object-fit: contain; }
  .card span { font-size: 13px; max-width: 90%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

  /* 拖拽相关样式 */
  .editing .card { cursor: move; border-style: dashed; animation: shake 0.3s infinite alternate; }
  .editing .card:active { cursor: grabbing; }
  .dragging { opacity: 0.4; transform: scale(0.9); }
  @keyframes shake { from { transform: rotate(-0.5deg); } to { transform: rotate(0.5deg); } }

  /* 编辑按钮 */
  .btn-edit-link, .btn-del-link {
    position: absolute; width: 24px; height: 24px; border-radius: 50%;
    display: none; align-items: center; justify-content: center;
    font-size: 12px; cursor: pointer; z-index: 10; color: white;
    border: 2px solid rgba(255,255,255,0.2);
  }
  .btn-edit-link { top: -8px; right: -8px; background: var(--accent); }
  .btn-del-link { top: -8px; left: -8px; background: var(--danger); }
  .editing .btn-edit-link, .editing .btn-del-link { display: flex; }

  /* 4. 底部 Dock */
  .dock {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: rgba(20,20,20,0.9); backdrop-filter: blur(10px);
    padding: 10px 20px; border-radius: 100px; border: 1px solid var(--glass-border);
    display: flex; gap: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 100;
  }
  .dock-item { font-size: 20px; padding: 8px; cursor: pointer; border-radius: 50%; transition: 0.2s; opacity: 0.7; }
  .dock-item:hover { background: rgba(255,255,255,0.1); opacity: 1; transform: scale(1.1); }
  .dock-item.active { color: var(--accent); opacity: 1; background: rgba(59, 130, 246, 0.2); }

  /* 5. Modals */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 200;
    display: none; align-items: center; justify-content: center; backdrop-filter: blur(4px);
  }
  .modal {
    background: #1c1c1e; width: 90%; max-width: 400px; padding: 24px;
    border-radius: 20px; border: 1px solid #333; box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    animation: popUp 0.2s ease-out;
  }
  @keyframes popUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  
  .form-group { margin-bottom: 16px; }
  .form-label { display: block; font-size: 12px; color: #888; margin-bottom: 6px; }
  input, select { 
    width: 100%; padding: 12px; background: #2c2c2e; border: 1px solid #3a3a3c; 
    border-radius: 10px; color: #fff; font-size: 14px; outline: none; 
  }
  input:focus, select:focus { border-color: var(--accent); }
  .btn-row { display: flex; gap: 10px; margin-top: 24px; }
  .btn { flex: 1; padding: 12px; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; }
  .btn-primary { background: var(--accent); color: white; }
  .btn-ghost { background: #3a3a3c; color: #ccc; }
</style>
</head>
<body>

<!-- 顶部导航 -->
<nav class="nav-header">
  <div class="nav-scroll" id="nav-list"></div>
</nav>

<!-- 搜索部分 -->
<div class="search-wrap">
  <div class="search-engines">
    <div class="engine active" onclick="setEngine(this, 'https://www.google.com/search?q=')">Google</div>
    <div class="engine" onclick="setEngine(this, 'https://cn.bing.com/search?q=')">Bing</div>
    <div class="engine" onclick="setEngine(this, 'https://github.com/search?q=')">GitHub</div>
  </div>
  <div class="search-input-box">
    <input class="search-input" id="search-input" placeholder="Search..." autocomplete="off">
  </div>
</div>

<!-- 主要内容网格 -->
<main class="grid" id="grid"></main>

<!-- 底部操作栏 -->
<div class="dock">
  <div class="dock-item" onclick="toggleEditMode()" id="btn-edit" title="编辑模式">⚙️</div>
  <div class="dock-item" onclick="openLinkModal()" title="添加链接">➕</div>
  <div class="dock-item" onclick="openCatModal()" title="添加分类">📁</div>
  <div class="dock-item" onclick="openSettings()" title="设置">🔧</div>
  <div class="dock-item" onclick="doLogout()" id="btn-logout" style="display:none;color:var(--danger)" title="退出">🚪</div>
</div>

<!-- 弹窗：链接编辑 -->
<div class="modal-overlay" id="m-link"><div class="modal">
  <h3 style="color:#fff;margin-bottom:20px" id="m-link-title">添加链接</h3>
  <input type="hidden" id="l-id">
  <div class="form-group"><input id="l-title" placeholder="网站名称"></div>
  <div class="form-group"><input id="l-url" placeholder="网址 (https://...)"></div>
  <div class="form-group"><input id="l-icon" placeholder="图标 URL (可选)"></div>
  <div class="form-group"><input id="l-desc" placeholder="描述 (可选)"></div>
  <div class="form-group">
    <label class="form-label">所属分类</label>
    <select id="l-cat"></select>
  </div>
  <div class="form-group" style="display:flex;align-items:center;gap:10px;color:#aaa;font-size:13px">
     <input type="checkbox" id="l-private" style="width:auto"> 仅自己可见
  </div>
  <div class="btn-row">
    <button class="btn btn-ghost" onclick="closeModals()">取消</button>
    <button class="btn btn-primary" onclick="saveLink()">保存</button>
  </div>
</div></div>

<!-- 弹窗：分类编辑 -->
<div class="modal-overlay" id="m-cat"><div class="modal">
  <h3 style="color:#fff;margin-bottom:20px" id="m-cat-title">分类管理</h3>
  <input type="hidden" id="c-id">
  <div class="form-group"><input id="c-title" placeholder="分类名称"></div>
  <div class="form-group" style="display:flex;align-items:center;gap:10px;color:#aaa;font-size:13px">
     <input type="checkbox" id="c-private" style="width:auto"> 私有分类 (Private)
  </div>
  <div class="btn-row">
    <button class="btn btn-ghost" onclick="closeModals()">取消</button>
    <button class="btn btn-primary" onclick="saveCat()">保存</button>
  </div>
</div></div>

<!-- 弹窗：登录 -->
<div class="modal-overlay" id="m-auth"><div class="modal">
  <h3 style="color:#fff;margin-bottom:20px">管理员登录</h3>
  <div class="form-group"><input type="password" id="auth-pwd" placeholder="输入后台密码"></div>
  <div class="btn-row"><button class="btn btn-primary" onclick="doLogin()">进入后台</button></div>
</div></div>

<!-- 弹窗：设置 -->
<div class="modal-overlay" id="m-set"><div class="modal">
  <h3 style="color:#fff;margin-bottom:20px">全局设置</h3>
  <div class="form-group"><label class="form-label">网站标题</label><input id="s-title"></div>
  <div class="form-group"><label class="form-label">背景图片 URL</label><input id="s-bg"></div>
  <div class="btn-row">
    <button class="btn btn-ghost" onclick="closeModals()">关闭</button>
    <button class="btn btn-primary" onclick="saveConfig()">保存应用</button>
  </div>
  <div style="margin-top:20px;padding-top:20px;border-top:1px solid #333;">
    <button class="btn btn-ghost" style="width:100%;font-size:12px" onclick="exportData()">📋 导出数据 (JSON)</button>
  </div>
</div></div>

<script>
// ==========================================
// 1. 初始化 State
// ==========================================
const APP = ${safeState}; // 注入服务端数据
const STATE = {
  activeCatId: 0,
  isEditing: false,
  searchUrl: 'https://www.google.com/search?q=',
  dragSrcEl: null
};

// 启动逻辑
(async function init() {
  // 读取本地缓存的 Token
  const localToken = localStorage.getItem('nav_token');
  if (localToken) APP.auth = localToken;

  // 设置初始分类
  if (APP.data && APP.data.length > 0) {
    STATE.activeCatId = APP.data[0].id;
  }

  // 渲染界面
  renderNav();
  renderGrid();
  setupSearch();

  // 验证 Token (静默)
  if (APP.auth) {
    try {
      const res = await api('/api/auth/verify');
      if (res.status === 'ok') {
        APP.isRoot = (res.role === 'root');
        document.getElementById('btn-logout').style.display = 'flex';
      } else {
        doLogout(); // Token 过期
      }
    } catch (e) { console.log('Auth check error', e); }
  }
})();

// ==========================================
// 2. 渲染逻辑 (Render)
// ==========================================

function renderNav() {
  const list = document.getElementById('nav-list');
  list.innerHTML = APP.data.map(cat => \`
    <div class="nav-item \${cat.id === STATE.activeCatId ? 'active' : ''} \${cat.is_private ? 'private' : ''}" 
         draggable="\${STATE.isEditing}"
         data-id="\${cat.id}"
         onclick="switchCat(\${cat.id})">
      \${esc(cat.title)}
      <div class="cat-del" onclick="deleteCat(\${cat.id}, event)">✕</div>
    </div>
  \`).join('');
  
  if (STATE.isEditing) setupDrag('nav-item', handleCatDrop);
}

function renderGrid() {
  const grid = document.getElementById('grid');
  const cat = APP.data.find(c => c.id === STATE.activeCatId);
  
  if (!cat || cat.items.length === 0) {
    grid.innerHTML = \`<div style="grid-column:1/-1;text-align:center;padding:50px;opacity:0.5;color:#fff">
      \${cat ? '此分类暂无链接' : '请先添加分类'}
    </div>\`;
    return;
  }

  grid.innerHTML = cat.items.map(item => {
    // 自动回退图标
    const domain = new URL(item.url).hostname;
    const fallback = \`https://icons.duckduckgo.com/ip3/\${domain}.ico\`;
    const icon = item.icon || \`https://api.iowen.cn/favicon/\${domain}.png\`;

    return \`
    <div class="card-wrap" draggable="\${STATE.isEditing}" data-id="\${item.id}">
      <a class="card" href="\${item.url}" target="_blank" onclick="\${STATE.isEditing ? 'return false' : ''}">
        <img src="\${icon}" loading="lazy" onerror="this.src='\${fallback}'">
        <span>\${esc(item.title)}</span>
      </a>
      <div class="btn-edit-link" onclick="openLinkModal(\${item.id})">✎</div>
      <div class="btn-del-link" onclick="deleteLink(\${item.id})">✕</div>
    </div>\`;
  }).join('');

  if (STATE.isEditing) setupDrag('card-wrap', handleLinkDrop);
}

// ==========================================
// 3. 拖拽逻辑 (Native DnD) - 核心修复
// ==========================================

function setupDrag(className, dropHandler) {
  const els = document.querySelectorAll('.' + className);
  els.forEach(el => {
    el.addEventListener('dragstart', function(e) {
      this.classList.add('dragging');
      STATE.dragSrcEl = this;
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      this.classList.add('drag-over');
    });
    el.addEventListener('dragleave', function() {
      this.classList.remove('drag-over');
    });
    el.addEventListener('dragend', function() {
      this.classList.remove('dragging');
      els.forEach(e => e.classList.remove('drag-over'));
    });
    el.addEventListener('drop', function(e) {
      e.stopPropagation();
      if (STATE.dragSrcEl !== this) {
        dropHandler(STATE.dragSrcEl, this);
      }
      return false;
    });
  });
}

// 分类排序处理
async function handleCatDrop(src, target) {
  const srcId = parseInt(src.dataset.id);
  const targetId = parseInt(target.dataset.id);
  
  // 数组重排
  const srcIdx = APP.data.findIndex(c => c.id === srcId);
  const targetIdx = APP.data.findIndex(c => c.id === targetId);
  const [removed] = APP.data.splice(srcIdx, 1);
  APP.data.splice(targetIdx, 0, removed);
  
  // 渲染
  renderNav();
  
  // API 保存
  const orderData = APP.data.map((c, i) => ({ id: c.id, sort_order: i }));
  await api('/api/category/reorder', orderData);
}

// 链接排序处理
async function handleLinkDrop(src, target) {
  const cat = APP.data.find(c => c.id === STATE.activeCatId);
  const srcId = parseInt(src.dataset.id);
  const targetId = parseInt(target.dataset.id);
  
  const srcIdx = cat.items.findIndex(i => i.id === srcId);
  const targetIdx = cat.items.findIndex(i => i.id === targetId);
  const [removed] = cat.items.splice(srcIdx, 1);
  cat.items.splice(targetIdx, 0, removed);
  
  renderGrid();
  
  const orderData = cat.items.map((i, idx) => ({ id: i.id, sort_order: idx }));
  await api('/api/link/reorder', orderData); // 仅保存当前分类下的顺序
}


// ==========================================
// 4. 交互与 API (Interactions)
// ==========================================

function switchCat(id) {
  STATE.activeCatId = id;
  renderNav();
  renderGrid();
}

function toggleEditMode() {
  if (!checkAuth()) return;
  STATE.isEditing = !STATE.isEditing;
  document.getElementById('btn-edit').classList.toggle('active', STATE.isEditing);
  document.body.classList.toggle('editing', STATE.isEditing);
  renderNav();
  renderGrid();
}

function checkAuth() {
  if (APP.auth) return true;
  document.getElementById('m-auth').style.display = 'flex';
  return false;
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(el => el.style.display = 'none');
}

async function api(path, body) {
  const opts = {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      // 修复：添加 Bearer 前缀，符合标准
      'Authorization': APP.auth.startsWith('Bearer') ? APP.auth : ('Bearer ' + APP.auth)
    }
  };
  if (body) opts.body = JSON.stringify(body);
  
  const res = await fetch(path, opts);
  if (res.status === 401) { doLogout(); throw new Error("Unauthorized"); }
  return res.json();
}

async function refreshData() {
  const res = await api('/api/data');
  if (res.nav) {
    APP.data = res.nav;
    renderNav();
    renderGrid();
  }
}

// ==========================================
// 5. 表单与业务逻辑 (CRUD)
// ==========================================

// 登录
async function doLogin() {
  const pwd = document.getElementById('auth-pwd').value;
  if (!pwd) return;
  // 简单模拟 Token (实际应由服务器下发，但 MVP 可用密码作 Token)
  const token = pwd; 
  APP.auth = token;
  try {
    const res = await api('/api/auth/verify');
    if (res.status === 'ok') {
      localStorage.setItem('nav_token', token);
      location.reload();
    } else {
      alert("密码错误");
      APP.auth = '';
    }
  } catch (e) { alert("登录失败"); APP.auth = ''; }
}

function doLogout() {
  localStorage.removeItem('nav_token');
  location.reload();
}

// 链接管理
function openLinkModal(id) {
  if (!checkAuth()) return;
  closeModals();
  const titleEl = document.getElementById('m-link-title');
  const sel = document.getElementById('l-cat');
  
  // 填充分类下拉框
  sel.innerHTML = APP.data.map(c => \`<option value="\${c.id}">\${esc(c.title)}</option>\`).join('');
  sel.value = STATE.activeCatId;

  if (id) {
    // 编辑模式
    const cat = APP.data.find(c => c.items.some(i => i.id === id));
    const item = cat.items.find(i => i.id === id);
    titleEl.innerText = "编辑链接";
    document.getElementById('l-id').value = id;
    document.getElementById('l-title').value = item.title;
    document.getElementById('l-url').value = item.url;
    document.getElementById('l-icon').value = item.icon || '';
    document.getElementById('l-desc').value = item.description || '';
    document.getElementById('l-private').checked = !!item.is_private;
    sel.value = cat.id;
  } else {
    // 新增模式
    titleEl.innerText = "添加链接";
    document.getElementById('l-id').value = '';
    document.getElementById('l-title').value = '';
    document.getElementById('l-url').value = '';
    document.getElementById('l-icon').value = '';
    document.getElementById('l-desc').value = '';
  }
  document.getElementById('m-link').style.display = 'flex';
}

async function saveLink() {
  const id = document.getElementById('l-id').value;
  const payload = {
    title: document.getElementById('l-title').value,
    url: document.getElementById('l-url').value,
    icon: document.getElementById('l-icon').value,
    description: document.getElementById('l-desc').value,
    category_id: document.getElementById('l-cat').value,
    is_private: document.getElementById('l-private').checked ? 1 : 0
  };
  
  if (!payload.title || !payload.url) return alert("标题和网址必填");

  try {
    await api(id ? '/api/link/update' : '/api/link', { id, ...payload });
    closeModals();
    await refreshData();
  } catch (e) { alert(e.message); }
}

async function deleteLink(id) {
  if (!confirm("确定删除此链接吗？")) return;
  await api('/api/link/delete', { id });
  await refreshData();
}

// 分类管理
function openCatModal(id) {
  if (!checkAuth()) return;
  closeModals();
  document.getElementById('m-cat').style.display = 'flex';
  const titleEl = document.getElementById('m-cat-title');
  
  if (id) { // 其实目前没做编辑按钮，但逻辑预留
    titleEl.innerText = "编辑分类";
    document.getElementById('c-id').value = id;
  } else {
    titleEl.innerText = "新建分类";
    document.getElementById('c-id').value = '';
    document.getElementById('c-title').value = '';
  }
}

async function saveCat() {
  const id = document.getElementById('c-id').value;
  const title = document.getElementById('c-title').value;
  const is_private = document.getElementById('c-private').checked ? 1 : 0;
  
  if (!title) return alert("分类名称必填");
  
  try {
    await api(id ? '/api/category/update' : '/api/category', { id, title, is_private });
    closeModals();
    await refreshData();
  } catch (e) { alert(e.message); }
}

async function deleteCat(id, e) {
  e.stopPropagation(); // 防止触发切换分类
  if (!confirm("确定删除此分类及其所有链接吗？此操作不可恢复！")) return;
  await api('/api/category/delete', { id });
  // 如果删除了当前分类，切换到第一个
  if (STATE.activeCatId === id) STATE.activeCatId = APP.data[0] ? APP.data[0].id : 0;
  await refreshData();
}

// 设置与搜索
function setupSearch() {
  const input = document.getElementById('search-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value) {
      window.open(STATE.searchUrl + encodeURIComponent(input.value));
      input.value = '';
    }
  });
}

function setEngine(el, url) {
  document.querySelectorAll('.engine').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  STATE.searchUrl = url;
}

function openSettings() {
  if (!checkAuth()) return;
  if (!APP.isRoot) return alert("设置功能仅限 Root 管理员");
  document.getElementById('m-set').style.display = 'flex';
  document.getElementById('s-title').value = APP.config.TITLE;
  document.getElementById('s-bg').value = APP.config.BG_IMAGE;
}

async function saveConfig() {
  await api('/api/config', { key: 'title', value: document.getElementById('s-title').value });
  await api('/api/config', { key: 'bg_image', value: document.getElementById('s-bg').value });
  location.reload();
}

async function exportData() {
  const res = await api('/api/export');
  const blob = new Blob([JSON.stringify(res.data, null, 2)], {type : 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nav_backup.json';
  a.click();
}

// 辅助转义
function esc(s) {
  if (!s) return '';
  return s.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
</script>
</body>
</html>`;
}
