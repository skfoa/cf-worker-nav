/**
 * src/ui.js
 * 修复版：解决初始化顺序问题 & 增加空数据引导
 */
export function renderUI(ssrData, ssrConfig) {
  // 安全转义
  const esc = (str) => String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m]));
  const safeJson = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>${esc(ssrConfig.TITLE)}</title>
<link rel="icon" href="https://cdn-icons-png.flaticon.com/512/1006/1006771.png">
<style>
  :root {
    --glass: rgba(26, 26, 26, 0.85);
    --glass-border: rgba(255, 255, 255, 0.1);
    --accent: #3b82f6;
    --danger: #ef4444;
    --text-main: #f3f4f6;
    --text-sub: #9ca3af;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: url('${esc(ssrConfig.BG_IMAGE)}') center/cover fixed no-repeat, #111;
    color: var(--text-main); min-height: 100vh; padding-bottom: 100px;
  }
  body::before { content: ''; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: -1; backdrop-filter: blur(3px); }

  /* Navbar */
  .nav-header {
    position: sticky; top: 0; z-index: 50;
    background: rgba(18, 18, 18, 0.9); backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--glass-border);
    padding-top: env(safe-area-inset-top);
    min-height: 50px; display: flex; align-items: flex-end;
  }
  .nav-scroll {
    display: flex; gap: 2px; padding: 0 10px; overflow-x: auto; width: 100%;
    scrollbar-width: none;
  }
  .nav-item {
    padding: 14px 16px; font-size: 15px; font-weight: 500; color: var(--text-sub);
    white-space: nowrap; cursor: pointer; border-bottom: 2px solid transparent;
    transition: 0.2s;
  }
  .nav-item.active { color: #fff; border-bottom-color: var(--accent); }
  .nav-item.private::after { content: '🔒'; font-size: 10px; margin-left: 4px; opacity: 0.7; }

  /* Search */
  .search-container { margin: 24px auto; width: 90%; max-width: 500px; display: flex; flex-direction: column; gap: 10px; z-index: 10; position: relative; }
  .search-engines { display: flex; justify-content: center; gap: 15px; font-size: 13px; color: var(--text-sub); }
  .engine { cursor: pointer; transition: 0.2s; opacity: 0.6; padding: 5px; }
  .engine.active { opacity: 1; color: var(--accent); font-weight: bold; }
  .search-box {
    display: flex; align-items: center; background: rgba(0,0,0,0.5);
    border: 1px solid var(--glass-border); border-radius: 12px; transition: 0.3s;
  }
  .search-box:focus-within { background: rgba(0,0,0,0.8); border-color: var(--accent); }
  .search-input { flex: 1; background: transparent; border: none; padding: 14px; color: #fff; font-size: 16px; outline: none; }

  /* Grid */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(105px, 1fr)); gap: 16px; padding: 16px; max-width: 1000px; margin: 0 auto; }
  .card-wrapper { position: relative; }
  .card {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: var(--glass); border: 1px solid var(--glass-border); border-radius: 16px;
    padding: 16px 10px; text-decoration: none; color: var(--text-main); height: 105px;
    backdrop-filter: blur(10px); transition: transform 0.2s;
  }
  .card:hover { transform: translateY(-4px); background: rgba(60,60,60,0.9); }
  .card img { width: 40px; height: 40px; margin-bottom: 10px; border-radius: 10px; object-fit: cover; background: rgba(255,255,255,0.1); }
  .card span { font-size: 13px; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  
  /* Edit Controls */
  .editing .card { border: 1px dashed #fbbf24; animation: shake 0.3s infinite alternate; cursor: grab; }
  .edit-btn, .del-btn { position: absolute; top: -6px; width: 22px; height: 22px; border-radius: 50%; display: none; align-items: center; justify-content: center; font-size: 12px; z-index: 5; cursor: pointer; border: 2px solid #fff; color: #fff; }
  .edit-btn { right: -6px; background: var(--accent); }
  .del-btn { left: -6px; background: var(--danger); }
  .editing .edit-btn, .editing .del-btn { display: flex; }
  @keyframes shake { from { transform: rotate(-1deg); } to { transform: rotate(1deg); } }

  /* Dock */
  .dock {
    position: fixed; bottom: max(20px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%);
    background: rgba(20,20,20,0.95); padding: 12px 24px; border-radius: 100px;
    display: flex; gap: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.6);
    border: 1px solid var(--glass-border); z-index: 100;
  }
  .dock-btn { font-size: 22px; cursor: pointer; transition: 0.2s; opacity: 0.8; }
  .dock-btn:hover { transform: scale(1.2); opacity: 1; }
  .dock-btn.active { color: var(--accent); opacity: 1; }

  /* Modal */
  .modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 200; backdrop-filter: blur(5px); }
  .modal { background: #1c1c1e; width: 85%; max-width: 360px; padding: 24px; border-radius: 20px; border: 1px solid #333; box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
  .modal h3 { margin-bottom: 20px; color: #fff; }
  input, select { width: 100%; padding: 12px; margin-bottom: 10px; background: #2c2c2e; border: 1px solid #3a3a3c; border-radius: 10px; color: #fff; outline: none; }
  .checkbox-group { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--text-sub); margin: 5px 0 15px; }
  .checkbox-group input { width: auto; }
  .btn-group { display: flex; gap: 10px; }
  .btn { flex: 1; padding: 12px; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-ghost { background: #3a3a3c; color: #ccc; }
</style>
</head>
<body>

<header class="nav-header"><div class="nav-scroll" id="nav-tabs"></div></header>

<div class="search-container">
  <div class="search-engines">
    <div class="engine active" data-url="https://www.google.com/search?q=">Google</div>
    <div class="engine" data-url="https://cn.bing.com/search?q=">Bing</div>
    <div class="engine" data-url="https://www.baidu.com/s?wd=">Baidu</div>
    <div class="engine" data-url="https://github.com/search?q=">GitHub</div>
  </div>
  <div class="search-box">
    <input class="search-input" id="search-input" placeholder="Search..." autocomplete="off">
  </div>
</div>

<main class="grid" id="main-grid"></main>

<div class="dock">
  <div class="dock-btn" onclick="toggleEdit()" id="btn-edit">⚙️</div>
  <div class="dock-btn" onclick="openModal('link')">➕</div>
  <div class="dock-btn" onclick="openModal('settings')">🔧</div>
  <div class="dock-btn" onclick="doLogout()" style="color:var(--danger);display:none" id="btn-logout">🚪</div>
</div>

<!-- Modals -->
<div class="modal-mask" id="m-form"><div class="modal">
  <h3 id="m-title">添加</h3>
  <input type="hidden" id="f-id">
  <input id="f-title" placeholder="名称">
  <div id="f-link-opts">
    <input id="f-url" placeholder="网址 (https://...)">
    <input id="f-desc" placeholder="描述 (可选)">
    <input id="f-icon" placeholder="图标 URL (可选)">
    <select id="f-cat"></select>
  </div>
  <div class="checkbox-group"><input type="checkbox" id="f-private"><label for="f-private">私有 (Private)</label></div>
  <div class="btn-group">
    <button class="btn btn-ghost" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="submitForm()">保存</button>
  </div>
  <div style="margin-top:15px;text-align:center" id="btn-sw-cat">
    <span style="font-size:12px;color:#666;cursor:pointer" onclick="switchToCatMode()">切换到“新建分类”</span>
  </div>
</div></div>

<div class="modal-mask" id="m-auth"><div class="modal">
  <h3>管理员认证</h3>
  <input type="password" id="auth-pwd" placeholder="输入密码">
  <div class="btn-group"><button class="btn btn-primary" onclick="doLogin()">进入后台</button></div>
</div></div>

<div class="modal-mask" id="m-settings"><div class="modal">
  <h3>系统设置</h3>
  <p style="font-size:12px;color:#888;margin-bottom:10px">全局配置 (Root Only)</p>
  <input id="set-title" placeholder="网站标题">
  <input id="set-bg" placeholder="背景图片 URL">
  <div class="btn-group"><button class="btn btn-ghost" onclick="closeModal()">关闭</button><button class="btn btn-primary" onclick="saveSysConfig()">保存</button></div>
</div></div>

<script>
const state = {
  data: ${safeJson(ssrData)},
  currentCatId: 0,
  auth: localStorage.getItem('nav_auth') || '',
  isRoot: false,
  isEditing: false,
  searchUrl: 'https://www.google.com/search?q='
};

// 核心修复：按安全顺序初始化
async function init() {
  // 1. 先绑定事件，保证按钮能点
  setupSearch();
  setupDragDrop();

  // 2. 设置初始分类 ID
  if (state.data && state.data.length > 0) {
    state.currentCatId = state.data[0].id;
  }

  // 3. 渲染 UI (即使为空也要渲染)
  renderTabs();
  renderGrid();

  // 4. 后台认证与数据刷新 (放在最后，防止网络错误阻断 UI)
  if (state.auth) {
    try {
      const res = await api('/api/auth/verify');
      if (res.status === 'ok') {
        state.isRoot = res.role === 'root';
        document.getElementById('btn-logout').style.display = 'flex';
        // 尝试刷新数据，如果 DB 报错则 catch 住
        await refreshData().catch(e => console.warn("DB Refresh failed:", e));
      } else {
        doLogout();
      }
    } catch(e) { console.log('Auth check failed:', e); }
  }
}

function renderTabs() {
  const list = state.data || [];
  const html = list.map(c => \`
    <div class="nav-item \${c.id === state.currentCatId ? 'active' : ''} \${c.is_private ? 'private' : ''}" 
         onclick="switchCat(\${c.id})" ondblclick="editCat(\${c.id})">
      \${esc(c.title)}
    </div>\`).join('');
  document.getElementById('nav-tabs').innerHTML = html + (state.auth ? '<div class="nav-item" onclick="openModal(\\'cat_new\\')">+</div>' : '');
}

function renderGrid() {
  const grid = document.getElementById('main-grid');
  // 空状态处理
  if (!state.data || state.data.length === 0) {
    grid.innerHTML = \`<div style="grid-column:1/-1;text-align:center;padding:40px;opacity:0.6;">
      <h3>👋 欢迎使用</h3>
      <p style="font-size:13px;margin:10px 0">数据库暂无数据</p>
      \${state.auth ? '<button class="btn btn-primary" onclick="openModal(\\'cat_new\\')" style="max-width:120px">新建分类</button>' : '<small>请先点击下方设置登录</small>'}
    </div>\`;
    return;
  }

  const cat = state.data.find(c => c.id === state.currentCatId);
  if (!cat) return; // Should not happen

  grid.innerHTML = cat.items.map(item => {
    let icon = item.icon;
    const domain = new URL(item.url).hostname;
    if (!icon) icon = \`https://api.iowen.cn/favicon/\${domain}.png\`;
    
    return \`
    <div class="card-wrapper" draggable="\${state.isEditing}" data-id="\${item.id}">
      <a class="card" href="\${esc(item.url)}" target="_blank" onclick="\${state.isEditing?'return false':''}">
        <img src="\${icon}" loading="lazy" onerror="this.src='https://icons.duckduckgo.com/ip3/\${domain}.ico'">
        <span>\${esc(item.title)}</span>
      </a>
      <div class="edit-btn" onclick="editLink(\${item.id})">✎</div>
      <div class="del-btn" onclick="delLink(\${item.id})">✕</div>
    </div>\`;
  }).join('');
  grid.classList.toggle('editing', state.isEditing);
}

function setupSearch() {
  document.querySelectorAll('.engine').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.engine').forEach(e => e.classList.remove('active'));
      el.classList.add('active');
      state.searchUrl = el.dataset.url;
    });
  });
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value) window.open(state.searchUrl + encodeURIComponent(e.target.value));
  });
}

// Interactions
function switchCat(id) { state.currentCatId = id; renderTabs(); renderGrid(); }
function toggleEdit() { if(checkAuth()) { state.isEditing = !state.isEditing; document.getElementById('btn-edit').classList.toggle('active', state.isEditing); renderGrid(); } }
function checkAuth() { if(state.auth) return true; document.getElementById('m-auth').style.display='flex'; return false; }
function closeModal() { document.querySelectorAll('.modal-mask').forEach(e => e.style.display='none'); }

// API
async function api(path, body) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'Authorization': state.auth },
    body: body ? JSON.stringify(body) : undefined
  });
  if(res.status===401) { doLogout(); throw new Error("401"); }
  return res.json();
}
async function refreshData() {
  const res = await api('/api/data');
  if (res.nav) { state.data = res.nav; renderTabs(); renderGrid(); }
}

// Login/Logout
async function doLogin() {
  const pwd = document.getElementById('auth-pwd').value;
  if(!pwd) return;
  state.auth = pwd;
  try {
    const res = await api('/api/auth/verify');
    if(res.status==='ok') {
      localStorage.setItem('nav_auth', pwd);
      location.reload(); 
    } else alert("密码错误");
  } catch(e) { alert("登录失败"); }
}
function doLogout() { localStorage.removeItem('nav_auth'); location.reload(); }

// Forms
let formMode = 'link';
let editId = null;

function openModal(type) {
  if(!checkAuth()) return;
  closeModal();
  document.getElementById('f-id').value = '';
  document.getElementById('f-title').value = '';
  editId = null;

  if(type==='settings') {
    if(!state.isRoot) return alert("需要 Root 权限");
    document.getElementById('m-settings').style.display='flex';
    document.getElementById('set-title').value = document.title;
    return;
  }
  
  if(type==='cat_new') switchToCatMode();
  else switchToLinkMode();
  document.getElementById('m-form').style.display='flex';
}

function switchToLinkMode() {
  formMode = 'link';
  document.getElementById('m-title').innerText = '添加链接';
  document.getElementById('f-link-opts').style.display='block';
  document.getElementById('btn-sw-cat').style.display='block';
  
  const sel = document.getElementById('f-cat');
  // 如果没有分类，强制切换到分类模式
  if (!state.data || state.data.length === 0) {
    switchToCatMode();
    document.getElementById('btn-sw-cat').style.display='none'; // 没法切回链接模式
    return;
  }
  sel.innerHTML = state.data.map(c => \`<option value="\${c.id}">\${esc(c.title)}</option>\`).join('');
  sel.value = state.currentCatId || (state.data[0] && state.data[0].id);
}

function switchToCatMode() {
  formMode = 'cat';
  document.getElementById('m-title').innerText = '新建分类';
  document.getElementById('f-link-opts').style.display='none';
  document.getElementById('btn-sw-cat').style.display='block';
}

async function submitForm() {
  const title = document.getElementById('f-title').value;
  if(!title) return alert("标题必填");
  const is_private = document.getElementById('f-private').checked ? 1 : 0;
  
  try {
    if(formMode === 'link') {
      const url = document.getElementById('f-url').value;
      if(!url) return alert("网址必填");
      const payload = { 
        title, url, is_private, 
        category_id: document.getElementById('f-cat').value,
        icon: document.getElementById('f-icon').value
      };
      await api(editId ? '/api/link/update' : '/api/link', { id: editId, ...payload });
    } else {
      await api(editId ? '/api/category/update' : '/api/category', { id: editId, title, is_private });
    }
    closeModal();
    await refreshData();
  } catch(e) { alert("保存失败: " + e.message); }
}

function editLink(id) {
  const cat = state.data.find(c => c.id === state.currentCatId);
  const item = cat.items.find(i => i.id === id);
  openModal('link');
  editId = id;
  document.getElementById('m-title').innerText = '编辑链接';
  document.getElementById('f-title').value = item.title;
  document.getElementById('f-url').value = item.url;
  document.getElementById('f-icon').value = item.icon || '';
  document.getElementById('f-cat').value = item.category_id;
  document.getElementById('f-private').checked = !!item.is_private;
}

function editCat(id) {
  if(!state.auth) return;
  const cat = state.data.find(c => c.id === id);
  openModal('cat_new');
  editId = id;
  document.getElementById('m-title').innerText = '编辑分类';
  document.getElementById('f-title').value = cat.title;
  document.getElementById('f-private').checked = !!cat.is_private;
}

async function delLink(id) { if(confirm('删除?')) { await api('/api/link/delete', {id}); refreshData(); } }
async function saveSysConfig() {
  await api('/api/config', { key: 'title', value: document.getElementById('set-title').value });
  await api('/api/config', { key: 'bg_image', value: document.getElementById('set-bg').value });
  location.reload();
}
function setupDragDrop() {} // 简版保留占位，防报错

init();
</script>
</body>
</html>`;
}
