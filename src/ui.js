/**
 * src/ui.js
 * 最终完整版 v2.2：补全导入功能 + 分类修改功能 + 修复空状态显示
 */
export function renderUI(ssrData, ssrConfig) {
  const esc = (str) => String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m]));
  
  const safeState = JSON.stringify({
    data: ssrData.nav || [],
    config: ssrConfig,
    auth: '', 
    isRoot: false
  }).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>${esc(ssrConfig.TITLE)}</title>
<link rel="icon" href="https://cdn-icons-png.flaticon.com/512/1006/1006771.png">
<style>
  :root {
    --glass: rgba(30, 30, 30, 0.6);
    --glass-border: rgba(255, 255, 255, 0.15);
    --accent: #3b82f6;
    --danger: #ef4444;
    --text: #ffffff;
    --text-sub: #cbd5e1;
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body {
    margin: 0; padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: url('${esc(ssrConfig.BG_IMAGE)}') center/cover fixed no-repeat, #0f172a;
    color: var(--text); min-height: 100vh; padding-bottom: 120px;
  }
  body::before { content: ''; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.3); z-index: -1; }

  /* 1. 顶部导航 */
  .nav-header {
    position: sticky; top: 0; z-index: 50;
    min-height: 60px; /* 强制高度，防止空数据塌陷 */
    background: linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0) 100%);
    padding-top: max(10px, env(safe-area-inset-top));
    padding-bottom: 15px;
    display: flex; justify-content: center; align-items: flex-end;
  }
  .nav-scroll {
    display: flex; gap: 24px; padding: 0 20px; 
    overflow-x: auto; scrollbar-width: none; align-items: center;
    max-width: 1200px; min-height: 30px; 
  }
  @media (max-width: 768px) { .nav-header { justify-content: flex-start; } }

  .nav-item {
    padding: 6px 0; font-size: 15px; color: rgba(255,255,255,0.7);
    white-space: nowrap; cursor: pointer; position: relative;
    transition: all 0.3s; font-weight: 500;
    text-shadow: 0 1px 3px rgba(0,0,0,0.9);
    border-bottom: 2px solid transparent;
  }
  .nav-item:hover { color: #fff; }
  .nav-item.active { color: #fff; font-size: 16px; font-weight: 600; border-bottom-color: var(--accent); }
  .nav-item.private::before { content: '🔒'; font-size: 10px; vertical-align: super; margin-right:2px; opacity: 0.7; }
  .nav-empty-tip { color: rgba(255,255,255,0.4); font-size: 13px; pointer-events: none; }

  /* 分类操作按钮 (编辑模式显示) */
  .nav-item .cat-btn { 
    display: none; position: absolute; top: -8px;
    width: 16px; height: 16px; border-radius: 50%; 
    font-size: 10px; align-items: center; justify-content: center;
    color: white; border: 1px solid rgba(255,255,255,0.5);
  }
  /* 删除按钮 */
  .nav-item .cat-del { right: -8px; background: var(--danger); }
  /* 编辑按钮 (新增) */
  .nav-item .cat-edit { right: 12px; background: var(--accent); }
  
  .editing .nav-item { border: 1px dashed rgba(255,255,255,0.3); padding: 6px 12px; border-radius: 4px; margin: 0 5px; }
  .editing .nav-item .cat-btn { display: flex; }

  /* 2. 搜索框 */
  .search-wrap { max-width: 640px; margin: 30px auto 30px; padding: 0 20px; display: flex; flex-direction: column; gap: 15px; position: relative; z-index: 10; }
  .search-engines { display: flex; justify-content: center; gap: 10px; font-size: 14px; color: var(--text-sub); flex-wrap: wrap; }
  .engine { cursor: pointer; padding: 5px 12px; border-radius: 20px; transition: 0.2s; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(4px); }
  .engine:hover { background: rgba(255,255,255,0.2); }
  .engine.active { color: #fff; background: var(--accent); border-color: var(--accent); box-shadow: 0 2px 10px rgba(59, 130, 246, 0.4); }
  
  .search-input-box {
    display: flex; align-items: center; 
    background: rgba(30,30,30,0.75);
    border: 1px solid rgba(255,255,255,0.1); 
    border-radius: 24px;
    height: 52px; transition: 0.3s;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    backdrop-filter: blur(10px);
  }
  .search-input-box:focus-within { background: rgba(40,40,40,0.95); border-color: var(--accent); box-shadow: 0 0 15px rgba(59, 130, 246, 0.3); }
  .search-input { 
    flex: 1; background: transparent; border: none; padding: 0 20px; 
    color: #fff; font-size: 16px; outline: none; height: 100%;
  }

  /* 3. 网格布局 */
  .grid { 
    display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); 
    gap: 20px; padding: 0 20px; max-width: 1200px; margin: 0 auto; 
  }
  .card-wrap { position: relative; }
  .card {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: var(--glass); 
    border: 1px solid var(--glass-border); 
    border-radius: 16px; height: 120px;
    text-decoration: none; color: var(--text);
    transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }
  .card:hover { 
    transform: translateY(-5px) scale(1.02); 
    background: rgba(60,60,60,0.85); 
    border-color: rgba(255,255,255,0.4); 
    box-shadow: 0 10px 20px rgba(0,0,0,0.3);
  }
  .card img { width: 48px; height: 48px; margin-bottom: 14px; border-radius: 12px; object-fit: contain; filter: drop-shadow(0 4px 4px rgba(0,0,0,0.3)); }
  .card span { font-size: 14px; max-width: 90%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }

  .editing .card { cursor: move; border: 1px dashed var(--accent); animation: shake 0.3s infinite alternate; }
  .dragging { opacity: 0.5; transform: scale(0.95); }
  @keyframes shake { from { transform: rotate(-0.5deg); } to { transform: rotate(0.5deg); } }

  .btn-edit-link, .btn-del-link {
    position: absolute; width: 26px; height: 26px; border-radius: 50%;
    display: none; align-items: center; justify-content: center;
    font-size: 12px; cursor: pointer; z-index: 10; color: white;
    border: 2px solid rgba(255,255,255,0.2); box-shadow: 0 2px 5px rgba(0,0,0,0.5);
  }
  .btn-edit-link { top: -10px; right: -10px; background: var(--accent); }
  .btn-del-link { top: -10px; left: -10px; background: var(--danger); }
  .editing .btn-edit-link, .editing .btn-del-link { display: flex; }

  /* Footer & Dock */
  .footer { text-align: center; margin-top: 60px; color: rgba(255,255,255,0.4); font-size: 12px; }
  .footer a { color: inherit; text-decoration: none; margin: 0 5px; }
  .footer a:hover { color: #fff; }

  .dock {
    position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
    background: rgba(15,15,15,0.85); backdrop-filter: blur(15px);
    padding: 12px 24px; border-radius: 100px; border: 1px solid rgba(255,255,255,0.1);
    display: flex; gap: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); z-index: 100;
  }
  .dock-item { font-size: 22px; cursor: pointer; transition: 0.2s; opacity: 0.6; }
  .dock-item:hover { opacity: 1; transform: scale(1.15); }
  .dock-item.active { color: var(--accent); opacity: 1; }

  /* Modals */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 200; display: none; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
  .modal { background: #1e293b; width: 90%; max-width: 420px; padding: 28px; border-radius: 20px; border: 1px solid #334155; box-shadow: 0 25px 60px rgba(0,0,0,0.7); animation: popUp 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  @keyframes popUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  
  .form-group { margin-bottom: 18px; }
  input, select { width: 100%; padding: 14px; background: #0f172a; border: 1px solid #334155; border-radius: 12px; color: #fff; font-size: 15px; outline: none; }
  input:focus, select:focus { border-color: var(--accent); }
  .btn-row { display: flex; gap: 12px; margin-top: 30px; }
  .btn { flex: 1; padding: 14px; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; }
  .btn-primary { background: var(--accent); color: white; }
  .btn-ghost { background: #334155; color: #cbd5e1; }
</style>
</head>
<body>

<nav class="nav-header">
  <div class="nav-scroll" id="nav-list"></div>
</nav>

<div class="search-wrap">
  <div class="search-engines">
    <div class="engine active" data-type="google" onclick="setEngine(this)">Google</div>
    <div class="engine" data-type="baidu" onclick="setEngine(this)">百度</div>
    <div class="engine" data-type="bing" onclick="setEngine(this)">Bing</div>
    <div class="engine" data-type="github" onclick="setEngine(this)">GitHub</div>
    <div class="engine" data-type="site" onclick="setEngine(this)">站内</div>
  </div>
  <div class="search-input-box">
    <input class="search-input" id="search-input" placeholder="Google 搜索..." autocomplete="off">
  </div>
</div>

<main class="grid" id="grid"></main>

<div class="footer">
  <p>Copyright © 2025 Nav-Item | Powered by <a href="https://github.com/skfoa/cf-worker-nav" target="_blank">Cloudflare Worker</a></p>
</div>

<div class="dock">
  <div class="dock-item" onclick="toggleEditMode()" id="btn-edit" title="布局编辑">⚙️</div>
  <div class="dock-item" onclick="openLinkModal()" title="添加链接">➕</div>
  <div class="dock-item" onclick="openCatModal()" title="添加分类">📁</div>
  <div class="dock-item" onclick="openSettings()" title="设置">🔧</div>
  <div class="dock-item" onclick="doLogout()" id="btn-logout" style="display:none;color:var(--danger)" title="退出">🚪</div>
</div>

<!-- Modals -->
<div class="modal-overlay" id="m-link"><div class="modal">
  <h3 style="color:#fff;margin-bottom:20px" id="m-link-title">添加链接</h3>
  <input type="hidden" id="l-id">
  <div class="form-group"><input id="l-title" placeholder="网站名称"></div>
  <div class="form-group"><input id="l-url" placeholder="网址 (https://...)"></div>
  <div class="form-group"><input id="l-icon" placeholder="图标 URL (自动获取可留空)"></div>
  <div class="form-group"><input id="l-desc" placeholder="描述 (可选)"></div>
  <div class="form-group"><label style="font-size:12px;color:#aaa">所属分类</label><select id="l-cat"></select></div>
  <div class="form-group" style="display:flex;align-items:center;gap:10px;color:#aaa;font-size:13px">
     <input type="checkbox" id="l-private" style="width:auto"> 仅登录可见
  </div>
  <div class="btn-row"><button class="btn btn-ghost" onclick="closeModals()">取消</button><button class="btn btn-primary" onclick="saveLink()">保存</button></div>
</div></div>

<div class="modal-overlay" id="m-cat"><div class="modal">
  <h3 style="color:#fff;margin-bottom:20px" id="m-cat-title">分类管理</h3>
  <input type="hidden" id="c-id">
  <div class="form-group"><input id="c-title" placeholder="分类名称"></div>
  <div class="form-group" style="display:flex;align-items:center;gap:10px;color:#aaa;font-size:13px">
     <input type="checkbox" id="c-private" style="width:auto"> 私有分类
  </div>
  <div class="btn-row"><button class="btn btn-ghost" onclick="closeModals()">取消</button><button class="btn btn-primary" onclick="saveCat()">保存</button></div>
</div></div>

<div class="modal-overlay" id="m-auth"><div class="modal">
  <h3 style="color:#fff;margin-bottom:20px">管理员登录</h3>
  <div class="form-group"><input type="password" id="auth-pwd" placeholder="输入后台密码"></div>
  <div class="btn-row"><button class="btn btn-primary" onclick="doLogin()">登录</button></div>
</div></div>

<div class="modal-overlay" id="m-set"><div class="modal">
  <h3 style="color:#fff;margin-bottom:20px">全局设置</h3>
  <div class="form-group"><label style="font-size:12px;color:#aaa">标题</label><input id="s-title"></div>
  <div class="form-group"><label style="font-size:12px;color:#aaa">背景 URL</label><input id="s-bg"></div>
  <div class="btn-row"><button class="btn btn-ghost" onclick="closeModals()">关闭</button><button class="btn btn-primary" onclick="saveConfig()">保存</button></div>
  <div style="margin-top:20px;padding-top:20px;border-top:1px solid #334155;display:flex;gap:10px">
    <button class="btn btn-ghost" style="flex:1;font-size:13px" onclick="exportData()">📦 导出备份</button>
    <button class="btn btn-ghost" style="flex:1;font-size:13px" onclick="document.getElementById('file-import').click()">📥 恢复备份</button>
    <input type="file" id="file-import" style="display:none" accept=".json" onchange="importData(this)">
  </div>
</div></div>

<script>
const APP = ${safeState};
const STATE = { activeCatId: 0, isEditing: false, searchType: 'google', searchUrl: 'https://www.google.com/search?q=', dragSrcEl: null };
const ENGINES = {
  google: { url: 'https://www.google.com/search?q=', place: 'Google 搜索...' },
  baidu: { url: 'https://www.baidu.com/s?wd=', place: '百度一下...' },
  bing: { url: 'https://cn.bing.com/search?q=', place: '微软 Bing...' },
  github: { url: 'https://github.com/search?q=', place: 'Search GitHub...' },
  site: { url: '', place: '输入关键词筛选...' }
};

(async function init() {
  const localToken = localStorage.getItem('nav_token');
  if (localToken) APP.auth = localToken;
  if (APP.data && APP.data.length > 0) STATE.activeCatId = APP.data[0].id;
  renderNav(); renderGrid(); setupSearch();
  if (APP.auth) {
    try {
      const res = await api('/api/auth/verify');
      if (res.status === 'ok') { APP.isRoot = (res.role === 'root'); document.getElementById('btn-logout').style.display = 'flex'; }
      else doLogout();
    } catch (e) {}
  }
})();

function renderNav() {
  const list = document.getElementById('nav-list');
  if (!APP.data || APP.data.length === 0) {
    list.innerHTML = '<span class="nav-empty-tip">暂无分类，请点击底部 📂 添加</span>';
    return;
  }
  
  list.innerHTML = APP.data.map(cat => \`
    <div class="nav-item \${cat.id === STATE.activeCatId ? 'active' : ''} \${cat.is_private ? 'private' : ''}" 
         draggable="\${STATE.isEditing}" data-id="\${cat.id}"
         onclick="switchCat(\${cat.id})">
      \${esc(cat.title)}
      <div class="cat-btn cat-del" onclick="deleteCat(\${cat.id}, event)">✕</div>
      <div class="cat-btn cat-edit" onclick="openCatModal(\${cat.id}, event)">✎</div>
    </div>
  \`).join('');
  if (STATE.isEditing) setupDrag('nav-item', handleCatDrop);
}

function renderGrid(customItems = null) {
  const grid = document.getElementById('grid');
  let items = customItems;
  if (!items) {
    const cat = APP.data.find(c => c.id === STATE.activeCatId);
    if (cat) items = cat.items;
  }

  if (!items || items.length === 0) {
    grid.innerHTML = \`<div style="grid-column:1/-1;text-align:center;padding:60px;opacity:0.6;color:#fff;text-shadow:0 1px 3px #000;">
      \${customItems ? '未找到相关内容' : (APP.data.length ? '此分类为空' : '请先添加分类')}
    </div>\`;
    return;
  }

  grid.innerHTML = items.map(item => {
    const domain = new URL(item.url).hostname;
    const fallback = \`https://icons.duckduckgo.com/ip3/\${domain}.ico\`;
    const icon = item.icon || \`https://api.iowen.cn/favicon/\${domain}.png\`;
    return \`
    <div class="card-wrap" draggable="\${STATE.isEditing && !customItems}" data-id="\${item.id}">
      <a class="card" href="\${item.url}" target="_blank" onclick="\${STATE.isEditing ? 'return false' : ''}">
        <img src="\${icon}" loading="lazy" onerror="this.src='\${fallback}'">
        <span>\${esc(item.title)}</span>
      </a>
      <div class="btn-edit-link" onclick="openLinkModal(\${item.id})">✎</div>
      <div class="btn-del-link" onclick="deleteLink(\${item.id})">✕</div>
    </div>\`;
  }).join('');
  if (STATE.isEditing && !customItems) setupDrag('card-wrap', handleLinkDrop);
}

function setupSearch() {
  const input = document.getElementById('search-input');
  input.addEventListener('input', (e) => {
    if (STATE.searchType === 'site') {
      const val = e.target.value.trim().toLowerCase();
      if (!val) { renderGrid(); return; }
      const results = [];
      APP.data.forEach(cat => cat.items.forEach(link => {
        if (link.title.toLowerCase().includes(val) || link.url.toLowerCase().includes(val)) results.push(link);
      }));
      renderGrid(results);
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value && STATE.searchType !== 'site') {
      window.open(STATE.searchUrl + encodeURIComponent(input.value)); input.value = '';
    }
  });
}

function setEngine(el) {
  document.querySelectorAll('.engine').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  STATE.searchType = el.dataset.type;
  const conf = ENGINES[STATE.searchType];
  STATE.searchUrl = conf.url;
  const input = document.getElementById('search-input');
  input.placeholder = conf.place; input.value = ''; input.focus();
  renderGrid();
}

function setupDrag(className, dropHandler) {
  const els = document.querySelectorAll('.' + className);
  els.forEach(el => {
    el.addEventListener('dragstart', function(e) { this.classList.add('dragging'); STATE.dragSrcEl = this; e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    el.addEventListener('dragend', function() { this.classList.remove('dragging'); });
    el.addEventListener('drop', function(e) { e.stopPropagation(); if (STATE.dragSrcEl !== this) dropHandler(STATE.dragSrcEl, this); return false; });
  });
}

async function handleCatDrop(src, target) {
  const srcIdx = APP.data.findIndex(c => c.id == src.dataset.id);
  const targetIdx = APP.data.findIndex(c => c.id == target.dataset.id);
  const [removed] = APP.data.splice(srcIdx, 1); APP.data.splice(targetIdx, 0, removed);
  renderNav(); await api('/api/category/reorder', APP.data.map((c, i) => ({ id: c.id, sort_order: i })));
}

async function handleLinkDrop(src, target) {
  const cat = APP.data.find(c => c.id === STATE.activeCatId);
  const srcIdx = cat.items.findIndex(i => i.id == src.dataset.id);
  const targetIdx = cat.items.findIndex(i => i.id == target.dataset.id);
  const [removed] = cat.items.splice(srcIdx, 1); cat.items.splice(targetIdx, 0, removed);
  renderGrid(); await api('/api/link/reorder', cat.items.map((i, idx) => ({ id: i.id, sort_order: idx })));
}

function switchCat(id) { STATE.activeCatId = id; renderNav(); renderGrid(); }
function toggleEditMode() { if (!checkAuth()) return; STATE.isEditing = !STATE.isEditing; document.getElementById('btn-edit').classList.toggle('active', STATE.isEditing); document.body.classList.toggle('editing', STATE.isEditing); renderNav(); renderGrid(); }
function checkAuth() { if (APP.auth) return true; document.getElementById('m-auth').style.display = 'flex'; return false; }
function closeModals() { document.querySelectorAll('.modal-overlay').forEach(e => e.style.display='none'); }
function esc(s) { return s ? s.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : ''; }
async function api(path, body) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': APP.auth.startsWith('Bearer')?APP.auth:('Bearer '+APP.auth) };
  const res = await fetch(path, { method: body?'POST':'GET', headers, body: body?JSON.stringify(body):undefined });
  if (res.status === 401) { doLogout(); throw new Error("Unauthorized"); } return res.json();
}
async function refreshData() { const res = await api('/api/data'); if (res.nav) { APP.data = res.nav; renderNav(); renderGrid(); } }
async function doLogin() { const pwd = document.getElementById('auth-pwd').value; if (!pwd) return; APP.auth = pwd; try { const res = await api('/api/auth/verify'); if (res.status === 'ok') { localStorage.setItem('nav_token', pwd); location.reload(); } else alert("Error"); } catch(e) { alert("Failed"); } }
function doLogout() { localStorage.removeItem('nav_token'); location.reload(); }

// 链接管理
function openLinkModal(id) {
  if (!checkAuth()) return; closeModals();
  const sel = document.getElementById('l-cat'); sel.innerHTML = APP.data.map(c => \`<option value="\${c.id}">\${esc(c.title)}</option>\`).join('');
  if (id) {
    const cat = APP.data.find(c => c.items.some(i => i.id === id)); const item = cat.items.find(i => i.id === id);
    document.getElementById('m-link-title').innerText = "编辑链接"; document.getElementById('l-id').value = id;
    document.getElementById('l-title').value = item.title; document.getElementById('l-url').value = item.url; document.getElementById('l-icon').value = item.icon || ''; document.getElementById('l-desc').value = item.description || ''; document.getElementById('l-private').checked = !!item.is_private; sel.value = cat.id;
  } else {
    document.getElementById('m-link-title').innerText = "添加链接"; document.getElementById('l-id').value = ''; document.getElementById('l-title').value = ''; document.getElementById('l-url').value = ''; document.getElementById('l-icon').value = ''; sel.value = STATE.activeCatId;
  }
  document.getElementById('m-link').style.display = 'flex';
}
async function saveLink() {
  const id = document.getElementById('l-id').value; const payload = { title: document.getElementById('l-title').value, url: document.getElementById('l-url').value, icon: document.getElementById('l-icon').value, description: document.getElementById('l-desc').value, category_id: document.getElementById('l-cat').value, is_private: document.getElementById('l-private').checked ? 1 : 0 };
  if(!payload.title) return alert("标题必填"); try { await api(id?'/api/link/update':'/api/link', {id, ...payload}); closeModals(); await refreshData(); } catch(e){ alert(e.message); }
}
async function deleteLink(id) { if(confirm("Del?")) { await api('/api/link/delete', {id}); await refreshData(); } }

// 分类管理 (支持编辑)
function openCatModal(id, e) {
  if(e) e.stopPropagation(); if(!checkAuth()) return; closeModals(); 
  document.getElementById('m-cat').style.display='flex';
  if (id) {
    const cat = APP.data.find(c => c.id === id);
    document.getElementById('m-cat-title').innerText = "编辑分类"; document.getElementById('c-id').value = id;
    document.getElementById('c-title').value = cat.title; document.getElementById('c-private').checked = !!cat.is_private;
  } else {
    document.getElementById('m-cat-title').innerText = "新建分类"; document.getElementById('c-id').value = ''; document.getElementById('c-title').value = '';
  }
}
async function saveCat() { const id = document.getElementById('c-id').value; const title = document.getElementById('c-title').value; const is_private = document.getElementById('c-private').checked?1:0; if(!title) return; try { await api(id?'/api/category/update':'/api/category', {id, title, is_private}); closeModals(); await refreshData(); } catch(e){ alert(e.message); } }
async function deleteCat(id, e) { e.stopPropagation(); if(confirm("Del Category?")) { await api('/api/category/delete', {id}); if(STATE.activeCatId==id) STATE.activeCatId=APP.data[0]?.id; await refreshData(); } }

// 设置与导入导出
function openSettings() { if(!checkAuth()) return; if(!APP.isRoot) return alert("Root Only"); document.getElementById('m-set').style.display='flex'; document.getElementById('s-title').value = APP.config.TITLE; document.getElementById('s-bg').value = APP.config.BG_IMAGE; }
async function saveConfig() { await api('/api/config', { key: 'title', value: document.getElementById('s-title').value }); await api('/api/config', { key: 'bg_image', value: document.getElementById('s-bg').value }); location.reload(); }
async function exportData() { const res = await api('/api/export'); const blob = new Blob([JSON.stringify(res.data, null, 2)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='nav_backup.json'; a.click(); }
async function importData(input) {
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      if(!Array.isArray(json)) throw new Error("Format Error");
      if(!confirm("导入将合并现有数据，确定继续？")) return;
      const res = await api('/api/import', json);
      alert(\`导入成功: \${res.count} 个链接\`); location.reload();
    } catch(err) { alert("导入失败: " + err.message); }
  };
  reader.readAsText(file);
}
</script>
</body>
</html>`;
}
