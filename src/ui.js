/**
 * src/ui.js
 * V3.0 Final Polish: 居中导航 + 高对比度配色 + 站内实时搜索
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
    /* 核心配色：参考截图的深色玻璃质感 */
    --bg-overlay: rgba(0, 0, 0, 0.6); /* 背景压暗 */
    --glass: rgba(40, 40, 45, 0.6);   /* 卡片底色 */
    --glass-hover: rgba(60, 60, 70, 0.8);
    --glass-border: rgba(255, 255, 255, 0.08);
    --accent: #60a5fa; /* 亮蓝色 */
    --text-main: #ffffff;
    --text-sub: #d1d5db; /* 浅灰，提高对比度 */
    --danger: #f87171;
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  
  body {
    margin: 0; padding: 0;
    font-family: "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, sans-serif;
    /* 背景图固定，叠加一层黑色蒙版让文字更清晰 */
    background: url('${esc(ssrConfig.BG_IMAGE)}') center/cover fixed no-repeat, #0f0f11;
    color: var(--text-main); min-height: 100vh; padding-bottom: 120px;
  }
  body::before { content: ''; position: fixed; inset: 0; background: var(--bg-overlay); z-index: -1; backdrop-filter: blur(0px); }

  /* ====================
     1. 导航栏 (居中优化)
     ==================== */
  .nav-header {
    position: sticky; top: 0; z-index: 50;
    /* 移除背景色，只留模糊，让其看起来悬浮 */
    background: rgba(15, 15, 20, 0.7); backdrop-filter: blur(15px);
    border-bottom: 1px solid var(--glass-border);
    padding-top: env(safe-area-inset-top);
  }
  
  .nav-scroll {
    display: flex; 
    /* 关键修改：PC端居中，内容过多时自动切回左对齐滚动 */
    justify-content: center; 
    gap: 20px; 
    padding: 0 20px; 
    overflow-x: auto; 
    width: 100%;
    scrollbar-width: none; 
    height: 60px; /* 增加高度 */
    align-items: center;
  }
  @media (max-width: 768px) {
    .nav-scroll { justify-content: flex-start; } /* 手机端靠左滑动 */
  }

  .nav-item {
    font-size: 15px; font-weight: 500; 
    color: var(--text-sub); /* 默认颜色调亮 */
    cursor: pointer; position: relative;
    padding: 8px 4px;
    transition: all 0.3s;
    white-space: nowrap;
    opacity: 0.8;
  }
  
  /* 悬停效果 */
  .nav-item:hover { color: #fff; opacity: 1; }

  /* 选中状态：文字变白，下方出现蓝条 */
  .nav-item.active { 
    color: #fff; 
    font-weight: 600; 
    opacity: 1;
  }
  .nav-item.active::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0;
    height: 3px; background: var(--accent);
    border-radius: 2px 2px 0 0;
    box-shadow: 0 -2px 10px rgba(96, 165, 250, 0.5);
  }

  /* 私有锁图标 */
  .nav-item.private::before { content: '🔒'; font-size: 10px; margin-right: 4px; opacity: 0.5; }

  /* 删除按钮 (编辑模式) */
  .cat-del {
    position: absolute; top: -5px; right: -10px;
    background: var(--danger); width: 16px; height: 16px; border-radius: 50%;
    font-size: 10px; display: none; align-items: center; justify-content: center; color: #fff;
  }
  .editing .nav-item { border: 1px dashed #555; margin: 0 5px; padding: 5px 10px; border-radius: 4px; }
  .editing .active::after { display: none; } /* 编辑模式隐藏下划线 */
  .editing .cat-del { display: flex; }

  /* ====================
     2. 搜索栏 (样式 + 站内搜索)
     ==================== */
  .search-wrap { 
    max-width: 640px; margin: 40px auto 30px; padding: 0 20px; 
    display: flex; flex-direction: column; gap: 15px; 
    position: relative; z-index: 10;
  }
  
  /* 搜索引擎切换器 */
  .search-engines { display: flex; justify-content: center; gap: 20px; font-size: 14px; color: var(--text-sub); }
  .engine { cursor: pointer; padding-bottom: 4px; transition: 0.2s; opacity: 0.7; border-bottom: 2px solid transparent; }
  .engine:hover { opacity: 1; color: #fff; }
  .engine.active { color: #fff; opacity: 1; border-bottom-color: #fff; font-weight: 500; }

  .search-input-box {
    display: flex; align-items: center; 
    background: rgba(255, 255, 255, 0.1); /* 稍微亮一点的背景 */
    border: 1px solid rgba(255, 255, 255, 0.15); 
    backdrop-filter: blur(10px);
    border-radius: 30px; /* 圆角加大 */
    height: 54px;
    transition: 0.3s; 
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }
  .search-input-box:focus-within { 
    background: rgba(30, 30, 35, 0.9); 
    border-color: var(--accent); 
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
  }
  .search-input { 
    flex: 1; background: transparent; border: none; padding: 0 24px; 
    color: #fff; font-size: 17px; outline: none; height: 100%;
    text-align: center; /* 输入文字居中，更像截图风格 */
  }
  .search-input::placeholder { color: rgba(255,255,255,0.3); }

  /* ====================
     3. 卡片网格
     ==================== */
  .grid { 
    display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); 
    gap: 20px; padding: 16px; max-width: 1100px; margin: 0 auto; 
    transition: opacity 0.2s;
  }
  
  .card-wrap { position: relative; }
  .card {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: var(--glass); 
    border: 1px solid var(--glass-border); 
    border-radius: 18px;
    height: 120px; 
    text-decoration: none; color: var(--text-main);
    transition: transform 0.2s, background 0.2s, box-shadow 0.2s;
  }
  .card:hover { 
    transform: translateY(-5px); 
    background: var(--glass-hover); 
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    border-color: rgba(255,255,255,0.3);
  }
  .card img { 
    width: 48px; height: 48px; margin-bottom: 14px; 
    border-radius: 12px; object-fit: contain; 
    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));
  }
  .card span { 
    font-size: 13px; font-weight: 500; color: #e5e7eb;
    max-width: 90%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; 
  }

  /* 搜索时的隐藏状态 */
  .card-wrap.hidden { display: none; }
  
  /* 编辑控件 */
  .editing .card { cursor: move; border: 1px dashed rgba(255,255,255,0.3); animation: shake 0.3s infinite alternate; }
  .btn-edit-link, .btn-del-link {
    position: absolute; top: -8px; width: 26px; height: 26px; border-radius: 50%;
    display: none; align-items: center; justify-content: center; color: white;
    cursor: pointer; z-index: 10; border: 2px solid #222; box-shadow: 0 2px 5px rgba(0,0,0,0.5);
  }
  .btn-edit-link { right: -8px; background: var(--accent); }
  .btn-del-link { left: -8px; background: var(--danger); }
  .editing .btn-edit-link, .editing .btn-del-link { display: flex; }
  @keyframes shake { from { transform: rotate(-0.5deg); } to { transform: rotate(0.5deg); } }

  /* 底部 Dock */
  .dock {
    position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
    background: rgba(20,20,20,0.8); backdrop-filter: blur(15px);
    padding: 12px 25px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.1);
    display: flex; gap: 25px; box-shadow: 0 15px 40px rgba(0,0,0,0.4); z-index: 100;
  }
  .dock-item { font-size: 20px; cursor: pointer; opacity: 0.6; transition: 0.2s; }
  .dock-item:hover { opacity: 1; transform: scale(1.2); }
  .dock-item.active { color: var(--accent); opacity: 1; }

  /* Modals (保持不变，仅微调颜色) */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 200; display: none; align-items: center; justify-content: center; backdrop-filter: blur(8px); }
  .modal { background: #18181b; width: 90%; max-width: 400px; padding: 25px; border-radius: 24px; border: 1px solid #333; }
  input, select { width: 100%; padding: 14px; background: #27272a; border: 1px solid #3f3f46; border-radius: 12px; color: #fff; outline: none; margin-bottom: 15px; }
  input:focus { border-color: var(--accent); background: #000; }
  .btn-row { display: flex; gap: 12px; margin-top: 10px; }
  .btn { flex: 1; padding: 14px; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; }
  .btn-primary { background: var(--accent); color: #000; }
  .btn-ghost { background: #3f3f46; color: #fff; }

  /* Footer */
  .footer { text-align: center; font-size: 12px; color: #666; padding-bottom: 20px; }
</style>
</head>
<body>

<nav class="nav-header">
  <div class="nav-scroll" id="nav-list"></div>
</nav>

<div class="search-wrap">
  <div class="search-engines">
    <div class="engine active" onclick="setEngine(this, 'google')">Google</div>
    <div class="engine" onclick="setEngine(this, 'baidu')">百度</div>
    <div class="engine" onclick="setEngine(this, 'bing')">Bing</div>
    <div class="engine" onclick="setEngine(this, 'github')">GitHub</div>
    <!-- 新增站内搜索 -->
    <div class="engine" onclick="setEngine(this, 'site')">站内</div>
  </div>
  <div class="search-input-box">
    <input class="search-input" id="search-input" placeholder="Google 搜索..." autocomplete="off">
  </div>
</div>

<main class="grid" id="grid"></main>

<div class="footer">
  &copy; 2025 Nav-Item | Powered by Cloudflare D1
</div>

<div class="dock">
  <div class="dock-item" onclick="toggleEditMode()" id="btn-edit">⚙️</div>
  <div class="dock-item" onclick="openLinkModal()">➕</div>
  <div class="dock-item" onclick="openCatModal()">📁</div>
  <div class="dock-item" onclick="openSettings()">🔧</div>
  <div class="dock-item" onclick="doLogout()" id="btn-logout" style="display:none;color:var(--danger)">🚪</div>
</div>

<!-- Modal: Link -->
<div class="modal-overlay" id="m-link"><div class="modal">
  <h3 style="color:#fff;margin:0 0 20px">添加链接</h3>
  <input type="hidden" id="l-id">
  <input id="l-title" placeholder="网站名称">
  <input id="l-url" placeholder="网址 (https://...)">
  <input id="l-icon" placeholder="图标 URL (可选)">
  <input id="l-desc" placeholder="描述">
  <select id="l-cat"></select>
  <div style="margin-bottom:20px;color:#aaa;font-size:13px"><input type="checkbox" id="l-private" style="width:auto;margin:0 5px 0 0"> 仅自己可见</div>
  <div class="btn-row"><button class="btn btn-ghost" onclick="closeModals()">取消</button><button class="btn btn-primary" onclick="saveLink()">保存</button></div>
</div></div>

<!-- Modal: Cat -->
<div class="modal-overlay" id="m-cat"><div class="modal">
  <h3 style="color:#fff;margin:0 0 20px">分类管理</h3>
  <input type="hidden" id="c-id">
  <input id="c-title" placeholder="分类名称">
  <div style="margin-bottom:20px;color:#aaa;font-size:13px"><input type="checkbox" id="c-private" style="width:auto;margin:0 5px 0 0"> 私有分类</div>
  <div class="btn-row"><button class="btn btn-ghost" onclick="closeModals()">取消</button><button class="btn btn-primary" onclick="saveCat()">保存</button></div>
</div></div>

<!-- Modal: Auth -->
<div class="modal-overlay" id="m-auth"><div class="modal">
  <h3 style="color:#fff;margin:0 0 20px">管理员登录</h3>
  <input type="password" id="auth-pwd" placeholder="输入密码">
  <div class="btn-row"><button class="btn btn-primary" onclick="doLogin()">登录</button></div>
</div></div>

<!-- Modal: Settings -->
<div class="modal-overlay" id="m-set"><div class="modal">
  <h3 style="color:#fff;margin:0 0 20px">设置</h3>
  <input id="s-title" placeholder="网站标题">
  <input id="s-bg" placeholder="背景图片 URL">
  <div class="btn-row"><button class="btn btn-ghost" onclick="closeModals()">取消</button><button class="btn btn-primary" onclick="saveConfig()">保存</button></div>
  <button class="btn btn-ghost" style="width:100%;margin-top:15px;font-size:12px" onclick="exportData()">导出 JSON</button>
</div></div>

<script>
const APP = ${safeState};
const STATE = {
  activeCatId: 0,
  isEditing: false,
  engineType: 'google', // google, baidu, bing, github, site
  dragSrc: null
};

const ENGINES = {
  google: { url: 'https://www.google.com/search?q=', ph: 'Google 搜索...' },
  baidu:  { url: 'https://www.baidu.com/s?wd=', ph: '百度搜索...' },
  bing:   { url: 'https://cn.bing.com/search?q=', ph: 'Bing 搜索...' },
  github: { url: 'https://github.com/search?q=', ph: 'GitHub 搜索...' },
  site:   { url: '', ph: '输入名称筛选应用...' }
};

// Init
(async function() {
  const t = localStorage.getItem('nav_token');
  if(t) APP.auth = t;
  if(APP.data.length > 0) STATE.activeCatId = APP.data[0].id;
  
  renderNav();
  renderGrid();
  
  // 绑定搜索输入事件 (为了站内搜索)
  document.getElementById('search-input').addEventListener('input', handleInput);
  document.getElementById('search-input').addEventListener('keydown', handleEnter);

  if(APP.auth) {
    try {
      const res = await api('/api/auth/verify');
      if(res.status==='ok') {
        APP.isRoot = (res.role === 'root');
        document.getElementById('btn-logout').style.display='flex';
      } else doLogout();
    } catch(e) {}
  }
})();

// Render Logic
function renderNav() {
  const list = document.getElementById('nav-list');
  list.innerHTML = APP.data.map(cat => \`
    <div class="nav-item \${cat.id === STATE.activeCatId ? 'active' : ''} \${cat.is_private ? 'private' : ''}" 
         draggable="\${STATE.isEditing}" data-id="\${cat.id}" onclick="switchCat(\${cat.id})">
      \${esc(cat.title)}
      <div class="cat-del" onclick="delCat(\${cat.id}, event)">✕</div>
    </div>\`).join('');
  if(STATE.isEditing) setupDrag('nav-item', handleCatDrop);
}

function renderGrid() {
  const grid = document.getElementById('grid');
  // 如果是站内搜索模式且有输入，则不局限于当前分类，而是搜全站（可选），这里仅演示搜当前分类
  // 为了体验更好，我们在切换分类时会重置搜索，所以这里渲染当前分类即可
  const cat = APP.data.find(c => c.id === STATE.activeCatId);
  
  if (!cat || cat.items.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#666;padding:40px">暂无内容</div>';
    return;
  }

  grid.innerHTML = cat.items.map(item => {
    const domain = new URL(item.url).hostname;
    const icon = item.icon || \`https://api.iowen.cn/favicon/\${domain}.png\`;
    const fallback = \`https://icons.duckduckgo.com/ip3/\${domain}.ico\`;
    
    return \`
    <div class="card-wrap" draggable="\${STATE.isEditing}" data-id="\${item.id}" data-title="\${esc(item.title).toLowerCase()}">
      <a class="card" href="\${item.url}" target="_blank" onclick="\${STATE.isEditing?'return false':''}">
        <img src="\${icon}" loading="lazy" onerror="this.src='\${fallback}'">
        <span>\${esc(item.title)}</span>
      </a>
      <div class="btn-edit-link" onclick="openLinkModal(\${item.id})">✎</div>
      <div class="btn-del-link" onclick="delLink(\${item.id})">✕</div>
    </div>\`;
  }).join('');
  
  if(STATE.isEditing) setupDrag('card-wrap', handleLinkDrop);
}

// Search Logic
function setEngine(el, type) {
  STATE.engineType = type;
  document.querySelectorAll('.engine').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  
  const input = document.getElementById('search-input');
  input.placeholder = ENGINES[type].ph;
  input.focus();
  
  // 切换回普通搜索时，确保所有卡片显示
  if(type !== 'site') {
    document.querySelectorAll('.card-wrap').forEach(c => c.classList.remove('hidden'));
  } else {
    // 切换到站内搜索时，立即触发一次过滤
    handleInput({ target: input });
  }
}

function handleInput(e) {
  // 仅在站内搜索模式下触发
  if (STATE.engineType !== 'site') return;
  
  const val = e.target.value.toLowerCase();
  const cards = document.querySelectorAll('.card-wrap');
  
  cards.forEach(card => {
    const title = card.dataset.title;
    if (title.includes(val)) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
}

function handleEnter(e) {
  if (e.key === 'Enter') {
    const val = e.target.value;
    if (!val) return;
    
    if (STATE.engineType === 'site') {
      // 站内搜索回车不做跳转，只是收起键盘（移动端）或保持过滤
      e.target.blur();
    } else {
      window.open(ENGINES[STATE.engineType].url + encodeURIComponent(val));
      e.target.value = ''; // 清空
    }
  }
}

// Actions
function switchCat(id) { 
  STATE.activeCatId = id; 
  // 切换分类时清空搜索框（可选体验）
  if(STATE.engineType === 'site') {
    document.getElementById('search-input').value = '';
  }
  renderNav(); 
  renderGrid(); 
}
function toggleEditMode() { 
  if(!checkAuth()) return;
  STATE.isEditing = !STATE.isEditing;
  document.body.classList.toggle('editing', STATE.isEditing);
  document.getElementById('btn-edit').classList.toggle('active', STATE.isEditing);
  renderNav();
  renderGrid();
}

// API & Drag (Simplified for brevity, logic same as before)
async function api(p,b){const r=await fetch(p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json','Authorization':APP.auth.startsWith('Bearer')?APP.auth:'Bearer '+APP.auth},body:b?JSON.stringify(b):undefined});if(r.status===401){doLogout();throw new Error('401');}return r.json();}
async function refresh(){const r=await api('/api/data');if(r.nav){APP.data=r.nav;renderNav();renderGrid();}}
function checkAuth(){if(APP.auth)return true;document.getElementById('m-auth').style.display='flex';return false;}
function closeModals(){document.querySelectorAll('.modal-overlay').forEach(e=>e.style.display='none');}
function doLogout(){localStorage.removeItem('nav_token');location.reload();}
async function doLogin(){const p=document.getElementById('auth-pwd').value;if(!p)return;APP.auth=p;try{const r=await api('/api/auth/verify');if(r.status==='ok'){localStorage.setItem('nav_token',p);location.reload();}else alert('Error');}catch(e){alert('Error');}}

// CRUD Ops
function openLinkModal(id){
  if(!checkAuth())return; closeModals(); document.getElementById('m-link').style.display='flex';
  const sel=document.getElementById('l-cat'); sel.innerHTML=APP.data.map(c=>\`<option value="\${c.id}">\${esc(c.title)}</option>\`).join('');
  if(id){
    const cat=APP.data.find(c=>c.items.some(i=>i.id===id)); const item=cat.items.find(i=>i.id===id);
    document.getElementById('l-id').value=id; document.getElementById('l-title').value=item.title;
    document.getElementById('l-url').value=item.url; document.getElementById('l-icon').value=item.icon||'';
    document.getElementById('l-desc').value=item.description||''; document.getElementById('l-private').checked=!!item.is_private;
    sel.value=cat.id;
  } else {
    document.getElementById('l-id').value=''; document.getElementById('l-title').value=''; document.getElementById('l-url').value='';
    document.getElementById('l-icon').value=''; document.getElementById('l-desc').value=''; sel.value=STATE.activeCatId;
  }
}
async function saveLink(){
  const id=document.getElementById('l-id').value, title=document.getElementById('l-title').value, url=document.getElementById('l-url').value;
  if(!title||!url)return alert('必填');
  await api(id?'/api/link/update':'/api/link',{id,title,url,icon:document.getElementById('l-icon').value,description:document.getElementById('l-desc').value,category_id:document.getElementById('l-cat').value,is_private:document.getElementById('l-private').checked?1:0});
  closeModals(); await refresh();
}
async function delLink(id){if(confirm('Del?')){await api('/api/link/delete',{id});await refresh();}}

function openCatModal(){if(!checkAuth())return;closeModals();document.getElementById('m-cat').style.display='flex';document.getElementById('c-id').value='';document.getElementById('c-title').value='';}
async function saveCat(){const t=document.getElementById('c-title').value;if(!t)return;await api('/api/category',{title:t,is_private:document.getElementById('c-private').checked?1:0});closeModals();await refresh();}
async function delCat(id,e){e.stopPropagation();if(confirm('Del Cat?')){await api('/api/category/delete',{id});if(STATE.activeCatId===id)STATE.activeCatId=APP.data[0]?.id||0;await refresh();}}

function openSettings(){if(!checkAuth()||!APP.isRoot)return alert('Root Only');closeModals();document.getElementById('m-set').style.display='flex';document.getElementById('s-title').value=APP.config.TITLE;document.getElementById('s-bg').value=APP.config.BG_IMAGE;}
async function saveConfig(){await api('/api/config',{key:'title',value:document.getElementById('s-title').value});await api('/api/config',{key:'bg_image',value:document.getElementById('s-bg').value});location.reload();}
async function exportData(){const r=await api('/api/export');const b=new Blob([JSON.stringify(r.data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='nav.json';a.click();}

// Drag n Drop
function setupDrag(cls, cb){
  document.querySelectorAll('.'+cls).forEach(el=>{
    el.setAttribute('draggable','true');
    el.addEventListener('dragstart',e=>{e.target.classList.add('dragging');STATE.dragSrc=e.target;e.dataTransfer.effectAllowed='move';});
    el.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';});
    el.addEventListener('dragend',e=>{e.target.classList.remove('dragging');});
    el.addEventListener('drop',e=>{e.stopPropagation();if(STATE.dragSrc!==el)cb(STATE.dragSrc,el);return false;});
  });
}
async function handleCatDrop(src,tgt){
  const sI=APP.data.findIndex(c=>c.id==src.dataset.id), tI=APP.data.findIndex(c=>c.id==tgt.dataset.id);
  const [m]=APP.data.splice(sI,1); APP.data.splice(tI,0,m); renderNav();
  await api('/api/category/reorder',APP.data.map((c,i)=>({id:c.id,sort_order:i})));
}
async function handleLinkDrop(src,tgt){
  const cat=APP.data.find(c=>c.id==STATE.activeCatId);
  const sI=cat.items.findIndex(i=>i.id==src.dataset.id), tI=cat.items.findIndex(i=>i.id==tgt.dataset.id);
  const [m]=cat.items.splice(sI,1); cat.items.splice(tI,0,m); renderGrid();
  await api('/api/link/reorder',cat.items.map((i,x)=>({id:i.id,sort_order:x})));
}

// Esc Tool
function esc(s){return s?s.toString().replace(/[&<>"']/g,''):'';}
</script>
</body>
</html>`;
}
