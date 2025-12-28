/**
 * src/ui.js
 * Final Version: 修复空白页登录引导 + 增强删除功能可见性
 */
export function renderUI(ssrData, ssrConfig) {
  const esc = (str) => String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#039;' }[m]));

  // 注入服务端数据
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
    --glass-bg: rgba(30, 30, 30, 0.65);
    --glass-border: rgba(255, 255, 255, 0.12);
    --accent: #3b82f6;      
    --danger: #ef4444;      
    --text-main: #ffffff;
    --text-sub: #94a3b8;
    --radius: 16px;
  }

  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  
  body {
    margin: 0; padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: url('${esc(ssrConfig.BG_IMAGE)}') center/cover fixed no-repeat, #0f172a;
    color: var(--text-main);
    min-height: 100vh;
    padding-bottom: 120px;
    user-select: none; /* 防止长按选中文本，利于拖拽 */
  }

  body::before {
    content: ''; position: fixed; inset: 0; 
    background: rgba(15, 23, 42, 0.4); 
    z-index: -1; backdrop-filter: blur(0px); 
  }

  /* 导航栏 */
  .nav-header {
    position: sticky; top: 0; z-index: 50;
    min-height: 64px; 
    background: linear-gradient(to bottom, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0) 100%);
    padding-top: max(12px, env(safe-area-inset-top));
    padding-bottom: 16px;
    display: flex; justify-content: center; align-items: flex-end;
  }

  .nav-scroll {
    display: flex; gap: 24px; padding: 0 24px;
    overflow-x: auto; scrollbar-width: none; align-items: center;
    max-width: 1200px; width: 100%;
  }
  
  @media (max-width: 768px) { .nav-header { justify-content: flex-start; } }

  .nav-item {
    padding: 6px 0;
    font-size: 15px; font-weight: 500;
    color: rgba(255,255,255,0.7);
    white-space: nowrap; cursor: pointer;
    position: relative; transition: all 0.3s ease;
    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
    border-bottom: 2px solid transparent;
  }

  .nav-item:hover { color: #fff; }
  
  .nav-item.active {
    color: #fff; font-size: 17px; font-weight: 600;
    border-bottom-color: var(--accent);
  }

  /* 私有锁图标 */
  .nav-item.private::after {
    content: '🔒'; font-size: 10px; margin-left: 4px; opacity: 0.6; vertical-align: super;
  }

  /* 导航栏上的编辑/删除按钮 (默认隐藏) */
  .nav-item .cat-btn {
    display: none; position: absolute; top: -8px;
    width: 16px; height: 16px; border-radius: 50%;
    font-size: 9px; align-items: center; justify-content: center;
    color: white; border: 1px solid rgba(255,255,255,0.3);
    z-index: 10; cursor: pointer;
    box-shadow: 0 2px 5px rgba(0,0,0,0.5);
  }
  .nav-item .cat-del { right: -8px; background: var(--danger); }
  .nav-item .cat-edit { right: 10px; background: var(--accent); }

  /* 编辑模式下显示分类操作按钮 */
  .editing .nav-item {
    border: 1px dashed rgba(255,255,255,0.4);
    padding: 6px 14px; border-radius: 8px; margin: 0 6px;
    background: rgba(0,0,0,0.2);
  }
  .editing .nav-item .cat-btn { display: flex; }

  /* 搜索框 */
  .search-wrap {
    max-width: 680px; margin: 40px auto 30px; padding: 0 20px;
    display: flex; flex-direction: column; gap: 16px;
    position: relative; z-index: 10;
  }

  .search-engines {
    display: flex; justify-content: center; gap: 10px;
    font-size: 14px; color: var(--text-sub); flex-wrap: wrap;
  }

  .engine {
    cursor: pointer; padding: 6px 14px; border-radius: 20px;
    transition: 0.2s; background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1);
    backdrop-filter: blur(4px);
  }
  .engine:hover { background: rgba(255,255,255,0.2); }
  .engine.active {
    color: #fff; background: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .search-input-box {
    display: flex; align-items: center;
    background: rgba(20, 20, 20, 0.8);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 24px; height: 56px;
    transition: 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    backdrop-filter: blur(12px);
  }
  .search-input-box:focus-within {
    background: rgba(30, 30, 30, 0.95);
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3), 0 10px 40px rgba(0,0,0,0.5);
  }

  .search-input {
    flex: 1; background: transparent; border: none;
    padding: 0 24px; color: #fff; font-size: 17px;
    outline: none; height: 100%;
  }

  /* 网格布局 */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 20px; padding: 0 24px;
    max-width: 1280px; margin: 0 auto;
    animation: fadeIn 0.5s ease-out;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  .card-wrap { position: relative; }

  .card {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius);
    height: 120px;
    text-decoration: none; color: var(--text-main);
    transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    position: relative; overflow: hidden;
  }

  .card:hover {
    transform: translateY(-4px) scale(1.02);
    background: rgba(50, 50, 50, 0.85);
    border-color: rgba(255,255,255,0.3);
    box-shadow: 0 15px 30px rgba(0,0,0,0.4);
    z-index: 2;
  }

  .card img {
    width: 48px; height: 48px; margin-bottom: 12px;
    border-radius: 10px; object-fit: contain;
    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));
  }

  .card span {
    font-size: 13px; font-weight: 500;
    max-width: 90%; overflow: hidden;
    white-space: nowrap; text-overflow: ellipsis;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    padding: 0 8px;
  }
  
  /* 编辑模式下，卡片增加抖动效果和操作按钮 */
  .editing .card {
    cursor: grab; border: 1px dashed var(--accent);
    animation: shake 0.3s infinite alternate;
  }
  .editing .card:active { cursor: grabbing; }
  .dragging { opacity: 0.4; transform: scale(0.9); }
  @keyframes shake { from { transform: rotate(-0.5deg); } to { transform: rotate(0.5deg); } }

  /* 卡片上的编辑/删除按钮 */
  .btn-edit-link, .btn-del-link {
    position: absolute; width: 24px; height: 24px;
    border-radius: 50%; z-index: 10; cursor: pointer;
    display: none; align-items: center; justify-content: center;
    font-size: 12px; color: white;
    border: 2px solid rgba(255,255,255,0.2);
    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  }
  .btn-edit-link { top: -8px; right: -8px; background: var(--accent); }
  .btn-del-link { top: -8px; left: -8px; background: var(--danger); }
  
  /* 只有在 editing 类下才显示 */
  .editing .btn-edit-link, .editing .btn-del-link { display: flex; }

  /* 底部 Dock */
  .footer {
    text-align: center; margin-top: 60px;
    color: rgba(255,255,255,0.3); font-size: 12px;
  }
  .footer a { color: inherit; text-decoration: none; margin: 0 4px; border-bottom: 1px dotted #666; }

  .dock {
    position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
    background: rgba(15, 15, 15, 0.9);
    backdrop-filter: blur(20px);
    padding: 12px 24px; border-radius: 100px;
    border: 1px solid rgba(255,255,255,0.15);
    display: flex; gap: 24px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    z-index: 100;
  }

  .dock-item {
    font-size: 22px; cursor: pointer;
    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    opacity: 0.7; position: relative;
    width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
  }
  .dock-item:hover { opacity: 1; background: rgba(255,255,255,0.1); transform: scale(1.1) translateY(-4px); }
  .dock-item.active { color: var(--accent); opacity: 1; background: rgba(59, 130, 246, 0.2); }
  
  /* 工具提示 */
  .dock-item::after {
    content: attr(title); position: absolute; bottom: 100%; left: 50%;
    transform: translateX(-50%) translateY(-10px);
    background: rgba(0,0,0,0.8); color: #fff;
    padding: 4px 8px; border-radius: 4px; font-size: 12px;
    opacity: 0; pointer-events: none; transition: 0.2s; white-space: nowrap;
  }
  .dock-item:hover::after { opacity: 1; transform: translateX(-50%) translateY(-16px); }

  /* 空状态提示与登录按钮 */
  .empty-state {
    grid-column: 1/-1; text-align: center; padding: 60px 0;
    color: rgba(255,255,255,0.5);
  }
  .btn-login-hero {
    margin-top: 20px;
    padding: 10px 24px;
    background: var(--accent); color: #fff;
    border: none; border-radius: 20px;
    font-size: 15px; font-weight: 600; cursor: pointer;
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
    transition: 0.2s;
  }
  .btn-login-hero:hover { transform: scale(1.05); }

  /* 弹窗通用样式 */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.85);
    z-index: 200; display: none;
    align-items: center; justify-content: center;
    backdrop-filter: blur(5px);
    animation: fadeIn 0.2s;
  }
  .modal {
    background: #1e293b; width: 90%; max-width: 400px;
    padding: 24px; border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 25px 80px rgba(0,0,0,0.8);
    transform: scale(0.95); opacity: 0;
    animation: popUp 0.3s forwards;
  }
  @keyframes popUp { to { transform: scale(1); opacity: 1; } }

  .modal h3 { margin: 0 0 20px 0; color: #fff; font-size: 18px; font-weight: 600; }
  .form-group { margin-bottom: 16px; }
  .form-label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
  
  input, select {
    width: 100%; padding: 12px;
    background: #0f172a; border: 1px solid #334155;
    border-radius: 10px; color: #fff; font-size: 14px;
    outline: none; transition: 0.2s;
  }
  input:focus, select:focus { border-color: var(--accent); background: #020617; }

  .btn-row { display: flex; gap: 10px; margin-top: 24px; }
  .btn {
    flex: 1; padding: 12px; border: none; border-radius: 10px;
    font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 14px;
  }
  .btn:active { transform: scale(0.98); }
  .btn-primary { background: var(--accent); color: white; }
  .btn-ghost { background: #334155; color: #cbd5e1; }

  /* Toast 提示 */
  #toast {
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-100%);
    background: rgba(59, 130, 246, 0.9); color: white;
    padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 500;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 300;
    transition: 0.3s; opacity: 0; pointer-events: none;
  }
  #toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }

</style>
</head>
<body>

<div id="toast"></div>

<!-- 顶部导航 -->
<nav class="nav-header">
  <div class="nav-scroll" id="nav-list"></div>
</nav>

<!-- 搜索区 -->
<div class="search-wrap">
  <div class="search-engines">
    <div class="engine active" data-type="google" onclick="setEngine(this)">Google</div>
    <div class="engine" data-type="baidu" onclick="setEngine(this)">百度</div>
    <div class="engine" data-type="bing" onclick="setEngine(this)">Bing</div>
    <div class="engine" data-type="github" onclick="setEngine(this)">GitHub</div>
    <div class="engine" data-type="site" onclick="setEngine(this)">🔍 站内</div>
  </div>
  <div class="search-input-box">
    <input class="search-input" id="search-input" placeholder="Google 搜索..." autocomplete="off">
  </div>
</div>

<!-- 内容网格 -->
<main class="grid" id="grid"></main>

<!-- 底部信息 -->
<div class="footer">
  <p>Copyright © 2025 Nav-Item | Powered by Cloudflare Worker</p>
</div>

<!-- 底部功能栏 (Dock) -->
<div class="dock">
  <div class="dock-item" onclick="toggleEditMode()" id="btn-edit" title="布局编辑 (删除/排序)">⚙️</div>
  <div class="dock-item" onclick="openLinkModal()" title="添加链接">➕</div>
  <div class="dock-item" onclick="openCatModal()" title="添加分类">📁</div>
  <div class="dock-item" onclick="openSettings()" title="设置">🔧</div>
  <div class="dock-item" onclick="doLogout()" id="btn-logout" style="display:none;color:var(--danger)" title="退出">🚪</div>
</div>

<!-- 弹窗：添加/编辑链接 -->
<div class="modal-overlay" id="m-link"><div class="modal">
  <h3 id="m-link-title">添加链接</h3>
  <input type="hidden" id="l-id">
  <div class="form-group"><input id="l-title" placeholder="网站名称"></div>
  <div class="form-group"><input id="l-url" placeholder="网址 (https://...)"></div>
  <div class="form-group"><input id="l-icon" placeholder="图标 URL (可留空自动获取)"></div>
  <div class="form-group"><input id="l-desc" placeholder="描述 (可选)"></div>
  <div class="form-group">
    <label class="form-label">所属分类</label>
    <select id="l-cat"></select>
  </div>
  <div class="form-group" style="display:flex;align-items:center;gap:10px;font-size:13px;color:#aaa">
     <input type="checkbox" id="l-private" style="width:auto"> 仅登录可见
  </div>
  <div class="btn-row">
    <button class="btn btn-ghost" onclick="closeModals()">取消</button>
    <button class="btn btn-primary" onclick="saveLink()">保存</button>
  </div>
</div></div>

<!-- 弹窗：添加/编辑分类 -->
<div class="modal-overlay" id="m-cat"><div class="modal">
  <h3 id="m-cat-title">分类管理</h3>
  <input type="hidden" id="c-id">
  <div class="form-group"><input id="c-title" placeholder="分类名称"></div>
  <div class="form-group" style="display:flex;align-items:center;gap:10px;font-size:13px;color:#aaa">
     <input type="checkbox" id="c-private" style="width:auto"> 私有分类 (未登录不可见)
  </div>
  <div class="btn-row">
    <button class="btn btn-ghost" onclick="closeModals()">取消</button>
    <button class="btn btn-primary" onclick="saveCat()">保存</button>
  </div>
</div></div>

<!-- 弹窗：登录 -->
<div class="modal-overlay" id="m-auth"><div class="modal">
  <h3>管理员登录</h3>
  <div class="form-group"><input type="password" id="auth-pwd" placeholder="输入后台密码" onkeydown="if(event.key==='Enter') doLogin()"></div>
  <div class="btn-row">
    <button class="btn btn-ghost" onclick="closeModals()">取消</button>
    <button class="btn btn-primary" onclick="doLogin()">登录</button>
  </div>
</div></div>

<!-- 弹窗：全局设置 -->
<div class="modal-overlay" id="m-set"><div class="modal">
  <h3>全局设置</h3>
  <div class="form-group">
    <label class="form-label">网站标题</label>
    <input id="s-title">
  </div>
  <div class="form-group">
    <label class="form-label">背景图片 URL</label>
    <input id="s-bg">
  </div>
  <div class="btn-row">
    <button class="btn btn-ghost" onclick="closeModals()">关闭</button>
    <button class="btn btn-primary" onclick="saveConfig()">保存设置</button>
  </div>
  <div style="margin-top:20px;padding-top:15px;border-top:1px solid #334155;">
    <p class="form-label">数据备份</p>
    <div style="display:flex;gap:10px">
      <button class="btn btn-ghost" onclick="exportData()" style="font-size:12px">📤 导出 JSON</button>
      <button class="btn btn-ghost" onclick="document.getElementById('file-import').click()" style="font-size:12px">📥 导入 JSON</button>
    </div>
    <input type="file" id="file-import" style="display:none" accept=".json" onchange="importData(this)">
  </div>
</div></div>

<script>
/** 
 * 核心逻辑
 */
const APP = ${safeState};
const STATE = {
  activeCatId: 0,
  isEditing: false,
  searchType: 'google',
  searchUrl: 'https://www.google.com/search?q='
};

// 搜索引擎配置
const ENGINES = {
  google: { url: 'https://www.google.com/search?q=', place: 'Google 搜索...' },
  baidu:  { url: 'https://www.baidu.com/s?wd=', place: '百度一下...' },
  bing:   { url: 'https://cn.bing.com/search?q=', place: '微软 Bing...' },
  github: { url: 'https://github.com/search?q=', place: 'Search GitHub...' },
  site:   { url: '', place: '输入关键词筛选本站链接...' }
};

// 初始化
(async function init() {
  const localToken = localStorage.getItem('nav_token');
  if (localToken) APP.auth = localToken;

  // 默认选中第一个分类
  if (APP.data && APP.data.length > 0) {
    STATE.activeCatId = APP.data[0].id;
  }

  renderNav();
  renderGrid();
  setupSearch();

  // 后台验证 Token
  if (APP.auth) {
    try {
      const res = await api('/api/auth/verify');
      if (res.status === 'ok') {
        APP.isRoot = (res.role === 'root');
        document.getElementById('btn-logout').style.display = 'flex';
      } else {
        doLogout(); // Token 失效
      }
    } catch (e) { console.warn("Auth check failed", e); }
  }
})();

// 渲染导航栏
function renderNav() {
  const list = document.getElementById('nav-list');
  
  if (!APP.data || APP.data.length === 0) {
    list.innerHTML = '';
    return;
  }
  
  list.innerHTML = APP.data.map(cat => \`
    <div class="nav-item \${cat.id === STATE.activeCatId ? 'active' : ''} \${cat.is_private ? 'private' : ''}" 
         draggable="\${STATE.isEditing}" 
         data-id="\${cat.id}"
         onclick="switchCat(\${cat.id})">
      \${esc(cat.title)}
      <!-- 删除按钮 (仅编辑模式显示) -->
      <div class="cat-btn cat-del" onclick="deleteCat(\${cat.id}, event)" title="删除分类">✕</div>
      <!-- 编辑按钮 (仅编辑模式显示) -->
      <div class="cat-btn cat-edit" onclick="openCatModal(\${cat.id}, event)" title="修改分类">✎</div>
    </div>
  \`).join('');

  if (STATE.isEditing) setupDrag('nav-item', handleCatDrop);
}

// 渲染网格内容
function renderGrid(customItems = null) {
  const grid = document.getElementById('grid');
  let items = customItems;

  // 如果没有自定义搜索结果，则取当前分类的数据
  if (!items) {
    const cat = APP.data.find(c => c.id === STATE.activeCatId);
    if (cat) items = cat.items;
  }

  // === 关键修复：空状态处理 ===
  // 如果当前分类没数据，或者根本没有分类（比如全部私有且未登录）
  if (!items || items.length === 0) {
    let html = '<div class="empty-state">';
    
    // 情况 A: 根本没有分类数据 (可能是未登录且全私有)
    if (!APP.data || APP.data.length === 0) {
      html += '<div style="font-size:40px;margin-bottom:10px">🔒</div>';
      html += '<div>当前无公开内容</div>';
      // 显眼的登录按钮
      if (!APP.auth) {
        html += '<button class="btn-login-hero" onclick="showLoginModal()">管理员登录</button>';
      } else {
        html += '<div style="margin-top:10px;font-size:13px">请点击底部 📁 添加分类</div>';
      }
    } 
    // 情况 B: 有分类，但该分类下没链接
    else {
      html += '<div style="font-size:40px;margin-bottom:10px">🍃</div>';
      html += customItems ? '未找到匹配结果' : '此分类下暂无链接';
    }
    
    html += '</div>';
    grid.innerHTML = html;
    return;
  }

  // 正常渲染卡片
  grid.innerHTML = items.map(item => {
    let domain = '';
    try {
      domain = new URL(item.url).hostname;
    } catch (e) {
      domain = 'example.com'; // URL 格式错误时使用默认值
    }
    const fallback = \`https://icons.duckduckgo.com/ip3/\${domain}.ico\`;
    const icon = item.icon || \`https://api.iowen.cn/favicon/\${domain}.png\`;

    return \`
    <div class="card-wrap" draggable="\${STATE.isEditing && !customItems}" data-id="\${item.id}">
      <a class="card" href="\${item.url}" target="_blank" onclick="\${STATE.isEditing ? 'return false' : ''}">
        <img src="\${icon}" loading="lazy" onerror="this.src='\${fallback}'">
        <span>\${esc(item.title)}</span>
      </a>
      <!-- 链接删除/编辑按钮 (仅编辑模式显示) -->
      <div class="btn-edit-link" onclick="openLinkModal(\${item.id})">✎</div>
      <div class="btn-del-link" onclick="deleteLink(\${item.id})">✕</div>
    </div>\`;
  }).join('');

  if (STATE.isEditing && !customItems) setupDrag('card-wrap', handleLinkDrop);
}

// 切换分类
function switchCat(id) {
  STATE.activeCatId = id;
  renderNav();
  renderGrid();
}

// 切换编辑模式
function toggleEditMode() {
  if (!checkAuth()) return;
  
  STATE.isEditing = !STATE.isEditing;
  const btn = document.getElementById('btn-edit');
  
  // 切换 UI 状态
  btn.classList.toggle('active', STATE.isEditing);
  document.body.classList.toggle('editing', STATE.isEditing);
  
  // 提示用户
  if (STATE.isEditing) {
    showToast("🔧 编辑模式：可拖拽排序，点击红色 X 删除");
  } else {
    showToast("已退出编辑模式");
  }
  
  renderNav();
  renderGrid();
}

// === 删除功能 (你之前提到的重点缺失部分) ===

async function deleteCat(id, e) {
  // 阻止冒泡，防止触发 switchCat
  if (e) e.stopPropagation();
  
  if (confirm("⚠️ 警告：确定删除此分类吗？\\n该分类下的所有链接也会被删除！")) {
    try {
      await api('/api/category/delete', { id });
      // 如果删除了当前选中的分类，重置选中项
      if (STATE.activeCatId == id) {
        STATE.activeCatId = APP.data[0] ? APP.data[0].id : 0;
      }
      await refreshData();
      showToast("分类已删除");
    } catch (err) {
      alert(err.message);
    }
  }
}

async function deleteLink(id) {
  if (confirm("确定删除此链接吗？")) {
    try {
      await api('/api/link/delete', { id });
      await refreshData();
      showToast("链接已删除");
    } catch (err) {
      alert(err.message);
    }
  }
}

// === API 与 数据交互 ===

async function api(path, body) {
  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': APP.auth.startsWith('Bearer') ? APP.auth : ('Bearer ' + APP.auth)
  };
  
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 401) {
    doLogout();
    throw new Error("登录已过期，请重新登录");
  }
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

async function refreshData() {
  try {
    const res = await api('/api/data');
    if (res.nav) {
      APP.data = res.nav;
      // 如果当前没有选中项，修正它
      if (!APP.data.find(c => c.id === STATE.activeCatId) && APP.data.length > 0) {
        STATE.activeCatId = APP.data[0].id;
      }
      renderNav();
      renderGrid();
    }
  } catch(e) { console.error("Refresh failed", e); }
}

// === 认证逻辑 ===

function checkAuth() {
  if (APP.auth) return true;
  showLoginModal();
  return false;
}

function showLoginModal() {
  closeModals();
  document.getElementById('m-auth').style.display = 'flex';
  setTimeout(() => document.getElementById('auth-pwd').focus(), 100);
}

async function doLogin() {
  const pwd = document.getElementById('auth-pwd').value;
  if (!pwd) return;
  APP.auth = pwd;
  try {
    const res = await api('/api/auth/verify');
    if (res.status === 'ok') {
      localStorage.setItem('nav_token', pwd);
      location.reload();
    } else {
      APP.auth = '';
      alert("密码错误");
    }
  } catch (e) { 
    APP.auth = '';
    alert("登录失败: " + e.message); 
  }
}

function doLogout() {
  localStorage.removeItem('nav_token');
  location.reload();
}

// === 弹窗与表单操作 ===

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(e => e.style.display = 'none');
}

function openLinkModal(id) {
  if (!checkAuth()) return;
  closeModals();
  
  const sel = document.getElementById('l-cat');
  // 填充分类下拉框
  sel.innerHTML = APP.data.map(c => \`<option value="\${c.id}">\${esc(c.title)}\</option>\`).join('');
  
  if (id) {
    // 编辑现有链接
    const cat = APP.data.find(c => c.items.some(i => i.id === id));
    const item = cat.items.find(i => i.id === id);
    document.getElementById('m-link-title').innerText = "编辑链接";
    document.getElementById('l-id').value = id;
    document.getElementById('l-title').value = item.title;
    document.getElementById('l-url').value = item.url;
    document.getElementById('l-icon').value = item.icon || '';
    document.getElementById('l-desc').value = item.description || '';
    document.getElementById('l-private').checked = !!item.is_private;
    sel.value = cat.id;
  } else {
    // 新建链接
    document.getElementById('m-link-title').innerText = "添加链接";
    document.getElementById('l-id').value = '';
    document.getElementById('l-title').value = '';
    document.getElementById('l-url').value = '';
    document.getElementById('l-icon').value = '';
    document.getElementById('l-desc').value = '';
    document.getElementById('l-private').checked = false;
    // 默认选中当前分类
    if (STATE.activeCatId) sel.value = STATE.activeCatId;
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
    showToast(id ? "链接已更新" : "链接已添加");
  } catch (e) { alert(e.message); }
}

function openCatModal(id, e) {
  if (e) e.stopPropagation(); 
  if (!checkAuth()) return;
  closeModals();
  document.getElementById('m-cat').style.display = 'flex';
  
  if (id) {
    const cat = APP.data.find(c => c.id === id);
    document.getElementById('m-cat-title').innerText = "编辑分类";
    document.getElementById('c-id').value = id;
    document.getElementById('c-title').value = cat.title;
    document.getElementById('c-private').checked = !!cat.is_private;
  } else {
    document.getElementById('m-cat-title').innerText = "新建分类";
    document.getElementById('c-id').value = '';
    document.getElementById('c-title').value = '';
  }
}

async function saveCat() {
  const id = document.getElementById('c-id').value;
  const title = document.getElementById('c-title').value;
  const is_private = document.getElementById('c-private').checked ? 1 : 0;
  
  if (!title) return alert("分类名不能为空");
  
  try {
    await api(id ? '/api/category/update' : '/api/category', { id, title, is_private });
    closeModals();
    await refreshData();
    showToast(id ? "分类已更新" : "分类已添加");
  } catch (e) { alert(e.message); }
}

// === 设置与导入导出 ===

function openSettings() {
  if (!checkAuth()) return;
  if (!APP.isRoot) return alert("需要 Root 权限");
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
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nav_backup.json';
  a.click();
}

async function importData(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      if (!Array.isArray(json)) throw new Error("JSON 格式错误: 根节点必须是数组");
      
      if (!confirm('确认导入 ' + json.length + ' 个分类？这将合并现有数据。')) return;
      
      const res = await api('/api/import', json);
      alert('导入成功！新增分类: ' + res.categories_added + '，新增链接: ' + res.count);
      location.reload();
    } catch (err) {
      alert("导入失败: " + err.message);
    }
  };
  reader.readAsText(file);
}

// === 辅助工具 ===

function setupSearch() {
  const input = document.getElementById('search-input');
  
  input.addEventListener('input', (e) => {
    if (STATE.searchType === 'site') {
      const val = e.target.value.trim().toLowerCase();
      if (!val) {
        renderGrid(); 
        return;
      }
      const results = [];
      APP.data.forEach(cat => {
        cat.items.forEach(link => {
          if (link.title.toLowerCase().includes(val) || link.url.toLowerCase().includes(val)) {
            results.push(link);
          }
        });
      });
      renderGrid(results);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value && STATE.searchType !== 'site') {
      window.open(STATE.searchUrl + encodeURIComponent(input.value));
      input.value = '';
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
  input.placeholder = conf.place;
  input.value = '';
  input.focus();
  renderGrid();
}

function setupDrag(className, dropHandler) {
  const els = document.querySelectorAll('.' + className);
  let dragSrc = null;

  els.forEach(el => {
    el.setAttribute('draggable', 'true');
    
    el.addEventListener('dragstart', function(e) {
      this.classList.add('dragging');
      dragSrc = this;
      e.dataTransfer.effectAllowed = 'move';
      // 兼容 Firefox
      e.dataTransfer.setData('text/plain', this.dataset.id);
    });

    el.addEventListener('dragover', function(e) {
      e.preventDefault(); 
      e.dataTransfer.dropEffect = 'move';
    });

    el.addEventListener('dragend', function() {
      this.classList.remove('dragging');
    });

    el.addEventListener('drop', function(e) {
      e.stopPropagation();
      if (dragSrc !== this) {
        dropHandler(dragSrc, this);
      }
      return false;
    });
  });
}

async function handleCatDrop(src, target) {
  const srcIdx = APP.data.findIndex(c => c.id == src.dataset.id);
  const targetIdx = APP.data.findIndex(c => c.id == target.dataset.id);
  
  if (srcIdx === -1 || targetIdx === -1) return;

  const [removed] = APP.data.splice(srcIdx, 1);
  APP.data.splice(targetIdx, 0, removed);
  
  renderNav();
  await api('/api/category/reorder', APP.data.map((c, i) => ({ id: c.id, sort_order: i })));
}

async function handleLinkDrop(src, target) {
  const cat = APP.data.find(c => c.id === STATE.activeCatId);
  const srcIdx = cat.items.findIndex(i => i.id == src.dataset.id);
  const targetIdx = cat.items.findIndex(i => i.id == target.dataset.id);
  
  if (srcIdx === -1 || targetIdx === -1) return;

  const [removed] = cat.items.splice(srcIdx, 1);
  cat.items.splice(targetIdx, 0, removed);
  
  renderGrid();
  await api('/api/link/reorder', cat.items.map((i, idx) => ({ id: i.id, sort_order: idx })));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerText = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function esc(s) {
  return s ? s.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : '';
}
</script>
</body>
</html>`;
}
