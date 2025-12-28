/**
 * src/ui.js
 * 前端 UI 渲染层 (SSR + CSR)
 * 适配 API: v5.0
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
<meta name="description" content="Personal Navigation Dashboard">
<link rel="icon" href="https://cdn-icons-png.flaticon.com/512/1006/1006771.png">
<style>
  :root {
    --bg-overlay: rgba(0, 0, 0, 0.4);
    --glass: rgba(26, 26, 26, 0.85);
    --glass-border: rgba(255, 255, 255, 0.1);
    --accent: #3b82f6;
    --danger: #ef4444;
    --text-main: #f3f4f6;
    --text-sub: #9ca3af;
    --safe-top: env(safe-area-inset-top);
    --safe-bottom: env(safe-area-inset-bottom);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: url('${esc(ssrConfig.BG_IMAGE)}') center/cover fixed no-repeat, #111;
    color: var(--text-main);
    min-height: 100vh;
    padding-bottom: calc(80px + var(--safe-bottom));
  }
  body::before { content: ''; position: fixed; inset: 0; background: var(--bg-overlay); z-index: -1; backdrop-filter: blur(3px); }

  /* --- Navbar --- */
  .nav-header {
    position: sticky; top: 0; z-index: 50;
    background: rgba(18, 18, 18, 0.8); backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--glass-border);
    padding-top: var(--safe-top);
  }
  .nav-scroll {
    display: flex; gap: 2px; padding: 0 10px; overflow-x: auto;
    scrollbar-width: none;
  }
  .nav-scroll::-webkit-scrollbar { display: none; }
  
  .nav-item {
    padding: 14px 16px; font-size: 15px; font-weight: 500;
    color: var(--text-sub); white-space: nowrap; cursor: pointer;
    border-bottom: 2px solid transparent; transition: 0.2s;
    user-select: none;
  }
  .nav-item.active { color: #fff; border-bottom-color: var(--accent); }
  .nav-item.private::after { content: '🔒'; font-size: 10px; margin-left: 4px; opacity: 0.7; }
  
  /* --- Search --- */
  .search-container {
    margin: 24px auto; width: 90%; max-width: 500px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .search-engines { display: flex; justify-content: center; gap: 15px; font-size: 13px; color: var(--text-sub); }
  .engine { cursor: pointer; transition: 0.2s; opacity: 0.6; }
  .engine.active { opacity: 1; color: var(--accent); font-weight: bold; }
  
  .search-box {
    position: relative; display: flex; align-items: center;
    background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border);
    border-radius: 12px; transition: 0.3s;
  }
  .search-box:focus-within { background: rgba(0,0,0,0.7); border-color: var(--accent); }
  .search-input {
    flex: 1; background: transparent; border: none; padding: 14px;
    color: #fff; font-size: 16px; outline: none;
  }
  
  /* --- Grid --- */
  .grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
    gap: 16px; padding: 16px; max-width: 1000px; margin: 0 auto;
  }
  
  .card {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: var(--glass); border: 1px solid var(--glass-border);
    border-radius: 16px; padding: 16px 10px;
    text-decoration: none; color: var(--text-main);
    transition: transform 0.2s, background 0.2s;
    position: relative; height: 105px;
    backdrop-filter: blur(10px);
  }
  .card:hover { transform: translateY(-4px); background: rgba(50,50,50,0.9); }
  .card img { width: 40px; height: 40px; margin-bottom: 10px; border-radius: 10px; object-fit: cover; background: rgba(255,255,255,0.05); }
  .card span { font-size: 13px; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-private-badge { position: absolute; top: 6px; left: 6px; font-size: 10px; opacity: 0.6; }

  /* Edit Mode */
  .editing .card { border: 1px dashed #fbbf24; animation: shake 0.3s infinite alternate; cursor: grab; }
  .editing .card:active { cursor: grabbing; }
  .edit-btn { position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; background: var(--accent); border-radius: 50%; display: none; align-items: center; justify-content: center; font-size: 12px; z-index: 2; cursor: pointer; border: 2px solid #fff; }
  .del-btn { position: absolute; top: -6px; left: -6px; width: 22px; height: 22px; background: var(--danger); border-radius: 50%; display: none; align-items: center; justify-content: center; font-size: 12px; z-index: 2; cursor: pointer; border: 2px solid #fff; }
  .editing .edit-btn, .editing .del-btn { display: flex; }
  
  @keyframes shake { from { transform: rotate(-1deg); } to { transform: rotate(1deg); } }

  /* --- Dock --- */
  .dock {
    position: fixed; bottom: calc(20px + var(--safe-bottom)); left: 50%; transform: translateX(-50%);
    background: rgba(20,20,20,0.95); padding: 12px 24px; border-radius: 100px;
    display: flex; gap: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.6);
    border: 1px solid var(--glass-border); z-index: 100;
  }
  .dock-btn { font-size: 22px; cursor: pointer; transition: 0.2s; opacity: 0.8; position: relative; }
  .dock-btn:hover { transform: scale(1.15); opacity: 1; }
  .dock-btn.active { color: var(--accent); opacity: 1; }

  /* --- Modals --- */
  .modal-mask {
    position: fixed; inset: 0; background: rgba(0,0,0,0.8);
    display: none; align-items: center; justify-content: center; z-index: 200;
    backdrop-filter: blur(5px); animation: fadeIn 0.2s;
  }
  .modal {
    background: #1c1c1e; width: 85%; max-width: 360px; padding: 24px;
    border-radius: 20px; border: 1px solid #333;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }
  .modal h3 { margin-bottom: 20px; font-weight: 600; color: #fff; display: flex; justify-content: space-between; align-items: center; }
  .modal-form { display: flex; flex-direction: column; gap: 12px; }
  
  input, select, textarea {
    width: 100%; padding: 12px; background: #2c2c2e; border: 1px solid #3a3a3c;
    border-radius: 10px; color: #fff; font-size: 15px; outline: none; transition: 0.2s;
  }
  input:focus, select:focus { border-color: var(--accent); background: #3a3a3c; }
  
  .checkbox-group { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--text-sub); margin: 5px 0; }
  .checkbox-group input { width: auto; transform: scale(1.2); }

  .btn-group { display: flex; gap: 12px; margin-top: 20px; }
  .btn { flex: 1; padding: 12px; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 15px; transition: 0.2s; }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-ghost { background: #3a3a3c; color: #ccc; }
  .btn:active { transform: scale(0.96); }

  /* Settings Panel specific */
  .settings-section { margin-bottom: 20px; border-bottom: 1px solid #333; padding-bottom: 15px; }
  .settings-section h4 { color: var(--text-sub); font-size: 12px; text-transform: uppercase; margin-bottom: 10px; }
  .token-item { display: flex; justify-content: space-between; background: #2c2c2e; padding: 8px; border-radius: 6px; margin-bottom: 5px; font-size: 13px; }

  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
</head>
<body>

  <!-- 1. Navbar -->
  <header class="nav-header">
    <div class="nav-scroll" id="nav-tabs"></div>
  </header>

  <!-- 2. Search -->
  <div class="search-container" id="search-section">
    <div class="search-engines" id="engines">
      <div class="engine active" data-url="https://www.google.com/search?q=">Google</div>
      <div class="engine" data-url="https://cn.bing.com/search?q=">Bing</div>
      <div class="engine" data-url="https://www.baidu.com/s?wd=">Baidu</div>
      <div class="engine" data-url="https://github.com/search?q=">GitHub</div>
    </div>
    <div class="search-box">
      <input class="search-input" id="search-input" placeholder="Search..." autocomplete="off">
    </div>
  </div>

  <!-- 3. Main Grid -->
  <main class="grid" id="main-grid"></main>

  <!-- 4. Dock (Bottom) -->
  <div class="dock">
    <div class="dock-btn" onclick="toggleEdit()" id="btn-edit" title="编辑模式">⚙️</div>
    <div class="dock-btn" onclick="openModal('link')" title="添加链接">➕</div>
    <div class="dock-btn" onclick="openModal('settings')" id="btn-settings" title="系统设置">🔧</div>
    <div class="dock-btn" onclick="doLogout()" style="color:var(--danger); display:none" id="btn-logout" title="退出">🚪</div>
  </div>

  <!-- Modal: Link/Category Form -->
  <div class="modal-mask" id="m-form"><div class="modal">
    <h3 id="m-title">添加</h3>
    <div class="modal-form">
      <input type="hidden" id="f-id">
      <input id="f-title" placeholder="名称 (Title)">
      
      <!-- Link fields -->
      <div id="f-link-fields">
        <input id="f-url" placeholder="网址 (https://...)">
        <input id="f-desc" placeholder="描述 (可选)">
        <input id="f-icon" placeholder="图标 URL (可选)">
        <select id="f-cat"></select>
      </div>

      <div class="checkbox-group">
        <input type="checkbox" id="f-private">
        <label for="f-private">设为私有 (Private) 🔒</label>
      </div>

      <div class="btn-group">
        <button class="btn btn-ghost" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="submitForm()">保存</button>
      </div>
      
      <div class="btn-group" id="btn-add-cat-wrapper" style="margin-top:0">
        <button class="btn btn-ghost" style="font-size:12px" onclick="switchToCatMode()">📂 切换到“新建分类”模式</button>
      </div>
    </div>
  </div></div>

  <!-- Modal: Auth -->
  <div class="modal-mask" id="m-auth"><div class="modal">
    <h3>管理员认证</h3>
    <div class="modal-form">
      <input type="password" id="auth-pwd" placeholder="输入密码或 Token">
      <div class="btn-group">
        <button class="btn btn-primary" onclick="doLogin()">进入后台</button>
      </div>
    </div>
  </div></div>

  <!-- Modal: Settings -->
  <div class="modal-mask" id="m-settings"><div class="modal" style="max-width:400px">
    <h3>系统设置 <span style="font-size:12px;cursor:pointer" onclick="closeModal()">✕</span></h3>
    
    <div class="settings-section">
      <h4>全局配置</h4>
      <input id="set-title" placeholder="网站标题" style="margin-bottom:8px">
      <input id="set-bg" placeholder="背景图片 URL">
      <button class="btn btn-primary" style="margin-top:10px;padding:8px" onclick="saveSysConfig()">更新配置</button>
    </div>

    <div class="settings-section" id="sec-token">
      <h4>API Tokens</h4>
      <div style="display:flex;gap:5px;margin-bottom:10px">
        <input id="new-token-name" placeholder="Token 备注名" style="font-size:13px">
        <button class="btn btn-primary" style="flex:0 0 60px;font-size:12px" onclick="createToken()">生成</button>
      </div>
      <div id="token-list" style="max-height:100px;overflow-y:auto"></div>
    </div>

    <div class="settings-section" style="border:none">
      <h4>数据备份</h4>
      <button class="btn btn-ghost" onclick="exportData()">⬇️ 导出 JSON 数据</button>
      <button class="btn btn-ghost" onclick="document.getElementById('file-import').click()" style="margin-top:8px">⬆️ 导入 JSON 数据</button>
      <input type="file" id="file-import" style="display:none" onchange="importData(this)">
    </div>
  </div></div>

<script>
/**
 * Core Logic
 */
const state = {
  data: ${safeJson(ssrData)},
  currentCatId: 0,
  auth: localStorage.getItem('nav_auth') || '',
  isRoot: false,
  isEditing: false,
  searchUrl: 'https://www.google.com/search?q='
};

// 1. Initialization
async function init() {
  if (state.data.length > 0) state.currentCatId = state.data[0].id;
  
  // Verify Auth
  if (state.auth) {
    try {
      const res = await api('/api/auth/verify');
      if (res.status === 'ok') {
        state.isRoot = res.role === 'root';
        document.getElementById('btn-logout').style.display = 'flex';
        // Refresh data (to get private items)
        await refreshData();
      } else {
        doLogout();
      }
    } catch(e) { console.log('Offline or Auth expired'); }
  }

  renderTabs();
  renderGrid();
  setupSearch();
  setupDragDrop();
}

// 2. Rendering
function renderTabs() {
  const el = document.getElementById('nav-tabs');
  el.innerHTML = state.data.map(c => \`
    <div class="nav-item \${c.id === state.currentCatId ? 'active' : ''} \${c.is_private ? 'private' : ''}" 
         onclick="switchCat(\${c.id})"
         ondblclick="editCat(\${c.id})">
      \${esc(c.title)}
    </div>
  \`).join('') + (state.auth ? \`<div class="nav-item" onclick="openModal('cat_new')">+</div>\` : '');
}

function renderGrid() {
  const cat = state.data.find(c => c.id === state.currentCatId);
  const grid = document.getElementById('main-grid');
  
  if (!cat || !cat.items.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;opacity:0.5;margin-top:50px">No Links</div>';
    return;
  }

  grid.innerHTML = cat.items.map(item => {
    // Icon Fallback Logic
    let iconSrc = item.icon;
    let fallback = '';
    const domain = getDomain(item.url);
    if (!iconSrc) {
       iconSrc = \`https://api.iowen.cn/favicon/\${domain}.png\`;
       fallback = \`onerror="this.src='https://icons.duckduckgo.com/ip3/\${domain}.ico'"\`;
    }

    return \`
    <div class="card-wrapper" draggable="\${state.isEditing}" data-id="\${item.id}">
      <a class="card" href="\${esc(item.url)}" target="_blank" onclick="\${state.isEditing?'return false':''}">
        <img src="\${iconSrc}" \${fallback} loading="lazy">
        <span>\${esc(item.title)}</span>
        \${item.description ? \`<span style="font-size:10px;opacity:0.6">\${esc(item.description)}</span>\` : ''}
        \${state.isEditing ? '' : (item.is_private ? '<span class="card-private-badge">🔒</span>' : '')}
      </a>
      <div class="edit-btn" onclick="editLink(\${item.id})">✎</div>
      <div class="del-btn" onclick="delLink(\${item.id})">✕</div>
    </div>\`;
  }).join('');
  
  grid.classList.toggle('editing', state.isEditing);
}

// 3. Interactions
function switchCat(id) { state.currentCatId = id; renderTabs(); renderGrid(); }

function toggleEdit() {
  if (!checkAuth()) return;
  state.isEditing = !state.isEditing;
  document.getElementById('btn-edit').classList.toggle('active', state.isEditing);
  renderGrid();
}

function getDomain(url) {
  try { return new URL(url).hostname; } catch(e) { return ''; }
}

// 4. API & Data
async function api(path, body = null) {
  const opts = {
    method: body ? 'POST' : 'GET',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': state.auth
    }
  };
  if (body) opts.body = JSON.stringify(body);
  
  const res = await fetch(path, opts);
  if (res.status === 401) {
    alert("Token Expired");
    doLogout();
    throw new Error("401");
  }
  return res.json();
}

async function refreshData() {
  const res = await api('/api/data');
  state.data = res.nav;
  renderTabs();
  renderGrid();
}

// 5. Forms & Modals
let formMode = 'link'; // 'link' | 'cat'
let editingId = null;

function openModal(type) {
  if (!checkAuth()) return;
  closeModal();
  
  // Reset Form
  document.getElementById('f-id').value = '';
  document.getElementById('f-title').value = '';
  document.getElementById('f-private').checked = false;
  editingId = null;

  if (type === 'settings') {
    if (!state.isRoot) { alert("仅 Root 管理员可用"); return; }
    document.getElementById('m-settings').style.display = 'flex';
    document.getElementById('set-title').value = document.title;
    return;
  }

  if (type === 'cat_new') switchToCatMode();
  else if (type === 'link') switchToLinkMode();

  document.getElementById('m-form').style.display = 'flex';
}

function switchToLinkMode() {
  formMode = 'link';
  document.getElementById('m-title').innerText = '添加/编辑 链接';
  document.getElementById('f-link-fields').style.display = 'block';
  document.getElementById('btn-add-cat-wrapper').style.display = 'flex';
  
  // Fill Cat Select
  const sel = document.getElementById('f-cat');
  sel.innerHTML = state.data.map(c => \`<option value="\${c.id}">\${esc(c.title)}</option>\`).join('');
  sel.value = state.currentCatId;
}

function switchToCatMode() {
  formMode = 'cat';
  document.getElementById('m-title').innerText = '新建/编辑 分类';
  document.getElementById('f-link-fields').style.display = 'none';
  document.getElementById('btn-add-cat-wrapper').style.display = 'none';
}

function closeModal() { document.querySelectorAll('.modal-mask').forEach(e => e.style.display = 'none'); }

async function submitForm() {
  const id = editingId;
  const title = document.getElementById('f-title').value;
  const is_private = document.getElementById('f-private').checked ? 1 : 0;
  
  if (!title) return alert("标题必填");

  try {
    if (formMode === 'link') {
      const url = document.getElementById('f-url').value;
      if (!url) return alert("URL 必填");
      
      const payload = {
        title, url, is_private,
        category_id: document.getElementById('f-cat').value,
        description: document.getElementById('f-desc').value,
        icon: document.getElementById('f-icon').value
      };

      if (id) await api('/api/link/update', { id, ...payload });
      else await api('/api/link', payload);

    } else {
      if (id) await api('/api/category/update', { id, title, is_private });
      else await api('/api/category', { title, is_private });
    }
    
    closeModal();
    await refreshData();
  } catch(e) { alert(e.message); }
}

function editLink(id) {
  const cat = state.data.find(c => c.id === state.currentCatId);
  const item = cat.items.find(i => i.id === id);
  if (!item) return;
  
  openModal('link');
  editingId = id;
  document.getElementById('m-title').innerText = '编辑链接';
  document.getElementById('f-title').value = item.title;
  document.getElementById('f-url').value = item.url;
  document.getElementById('f-desc').value = item.description || '';
  document.getElementById('f-icon').value = item.icon || '';
  document.getElementById('f-cat').value = item.category_id;
  document.getElementById('f-private').checked = !!item.is_private; // Note: Links usually inherit privacy, but DB supports per-link
}

function editCat(id) {
  if (!state.auth) return;
  const cat = state.data.find(c => c.id === id);
  openModal('cat_new');
  editingId = id;
  document.getElementById('m-title').innerText = '编辑分类';
  document.getElementById('f-title').value = cat.title;
  document.getElementById('f-private').checked = !!cat.is_private;
}

async function delLink(id) {
  if (confirm("确定删除?")) {
    await api('/api/link/delete', { id });
    await refreshData();
  }
}

// 6. Auth
function checkAuth() {
  if (state.auth) return true;
  document.getElementById('m-auth').style.display = 'flex';
  document.getElementById('auth-pwd').focus();
  return false;
}

async function doLogin() {
  const pwd = document.getElementById('auth-pwd').value;
  if (!pwd) return;
  
  state.auth = pwd;
  try {
    const res = await api('/api/auth/verify');
    if (res.status === 'ok') {
      localStorage.setItem('nav_auth', pwd);
      state.isRoot = res.role === 'root';
      closeModal();
      location.reload(); // Reload to get private SSR data
    }
  } catch(e) { alert("认证失败"); state.auth = ''; }
}

function doLogout() {
  localStorage.removeItem('nav_auth');
  location.reload();
}

// 7. Drag & Drop (Native)
function setupDragDrop() {
  const grid = document.getElementById('main-grid');
  let draggedItem = null;

  grid.addEventListener('dragstart', e => {
    if (!state.isEditing) { e.preventDefault(); return; }
    draggedItem = e.target.closest('.card-wrapper');
    e.dataTransfer.effectAllowed = 'move';
    draggedItem.style.opacity = '0.5';
  });

  grid.addEventListener('dragend', async e => {
    if (!draggedItem) return;
    draggedItem.style.opacity = '1';
    
    // Save Order
    const children = Array.from(grid.children);
    const updates = children.map((el, idx) => ({
      id: parseInt(el.dataset.id),
      sort_order: idx
    }));
    
    // Optimistic update done visually, now sync DB
    await api('/api/link/reorder', updates);
    draggedItem = null;
  });

  grid.addEventListener('dragover', e => {
    e.preventDefault();
    if (!draggedItem) return;
    const target = e.target.closest('.card-wrapper');
    if (target && target !== draggedItem) {
      const rect = target.getBoundingClientRect();
      const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
      grid.insertBefore(draggedItem, next ? target.nextSibling : target);
    }
  });
}

// 8. Settings & Tokens
async function createToken() {
  const name = document.getElementById('new-token-name').value;
  if(!name) return;
  const res = await api('/api/token/create', { name });
  if(res.token) {
    alert(\`Token 创建成功 (仅显示一次):\\n\${res.token}\`);
    document.getElementById('new-token-name').value = '';
    loadTokens();
  }
}

async function saveSysConfig() {
  const t = document.getElementById('set-title').value;
  const b = document.getElementById('set-bg').value;
  await api('/api/config', { key: 'title', value: t });
  await api('/api/config', { key: 'bg_image', value: b });
  alert("已保存，刷新生效");
}

async function exportData() {
  const res = await api('/api/export');
  const blob = new Blob([JSON.stringify(res.data, null, 2)], {type : 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'nav-backup.json'; a.click();
}

async function importData(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      if(confirm(\`将导入 \${json.length} 个分类，这会覆盖现有数据吗？(取决于后端实现，通常是追加)\`)) {
        await api('/api/import', { data: json });
        alert("导入完成"); location.reload();
      }
    } catch(err) { alert("文件格式错误"); }
  };
  reader.readAsText(file);
}

// 9. Search
function setupSearch() {
  document.querySelectorAll('.engine').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.engine').forEach(e => e.classList.remove('active'));
      el.classList.add('active');
      state.searchUrl = el.dataset.url;
    });
  });
  
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value) {
      window.open(state.searchUrl + encodeURIComponent(e.target.value));
    }
  });
}

// Start
init();
</script>
</body>
</html>`;
}
