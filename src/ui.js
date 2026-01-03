/**
 * src/ui.js
 * Final Version: 修复空白页登录引导 + 增强删除功能可见性
 */

// 🔒 私有模式：纯登录页面（不暴露任何内容给爬虫）
export function renderLoginPage(ssrConfig) {
  const esc = (str) => String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(ssrConfig.TITLE)} - 登录</title>
<link rel="icon" href="https://cdn-icons-png.flaticon.com/512/1006/1006771.png">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: url('${esc(ssrConfig.BG_IMAGE)}') center/cover no-repeat fixed, #0f172a;
  }
  body::before {
    content: ''; position: fixed; inset: 0;
    background: rgba(0,0,0,0.6); z-index: -1;
  }
  .login-box {
    background: rgba(30,41,59,0.95); padding: 40px;
    border-radius: 20px; width: 90%; max-width: 380px;
    box-shadow: 0 25px 80px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.1);
  }
  .login-box h1 { color: #fff; margin: 0 0 8px; font-size: 24px; text-align: center; }
  .login-box p { color: #94a3b8; margin: 0 0 24px; font-size: 14px; text-align: center; }
  .login-box input {
    width: 100%; padding: 14px; margin-bottom: 16px;
    background: #0f172a; border: 1px solid #334155;
    border-radius: 10px; color: #fff; font-size: 15px; outline: none;
  }
  .login-box input:focus { border-color: #3b82f6; }
  .login-box button {
    width: 100%; padding: 14px; background: #3b82f6;
    border: none; border-radius: 10px; color: #fff;
    font-size: 15px; font-weight: 600; cursor: pointer;
  }
  .login-box button:hover { background: #2563eb; }
  .error { color: #ef4444; font-size: 13px; text-align: center; margin-top: 12px; display: none; }
</style>
</head>
<body>
<div class="login-box">
  <h1>🔐 私有站点</h1>
  <p>此站点需要管理员权限才能访问</p>
  <input type="password" id="pwd" placeholder="请输入密码" onkeydown="if(event.key==='Enter') login()">
  <button onclick="login()">登录</button>
  <div class="error" id="err"></div>
</div>
<script>
async function login() {
  const pwd = document.getElementById('pwd').value;
  if (!pwd) return;
  try {
    const res = await fetch('/api/auth/verify', {
      headers: { 'Authorization': 'Bearer ' + pwd }
    });
    const json = await res.json();
    if (json.status === 'ok') {
      localStorage.setItem('nav_token', pwd);
      // 🔧 UX 优化：直接跳转避免闪烁
      location.href = '/?auth=1';
    } else {
      showError('密码错误');
    }
  } catch (e) {
    showError('登录失败: ' + e.message);
  }
}
function showError(msg) {
  const err = document.getElementById('err');
  err.textContent = msg;
  err.style.display = 'block';
}
// 检查是否已有 token
(function() {
  const token = localStorage.getItem('nav_token');
  if (token) {
    fetch('/api/auth/verify', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(r => r.json())
      .then(j => { if (j.status === 'ok') location.href = '/?auth=1'; })
      .catch(() => {});
  }
})();
</script>
</body>
</html>`;
}

export function renderUI(ssrData, ssrConfig) {
  const esc = (str) => String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#039;' }[m]));

  // 注入服务端数据
  // 注意：ssrData 本身就是 nav 数组，不需要再访问 .nav
  // 🔒 安全转义：防止 XSS + 修复某些旧环境下的 JS 解析问题
  const safeState = JSON.stringify({
    data: ssrData || [],
    config: ssrConfig,
    auth: '',
    isRoot: false
  }).replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")  // Line Separator
    .replace(/\u2029/g, "\\u2029"); // Paragraph Separator

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>${esc(ssrConfig.TITLE)}</title>
<link rel="icon" href="https://cdn-icons-png.flaticon.com/512/1006/1006771.png">
<style>
  /* 🌙 深色主题 (默认) */
  :root {
    --glass-bg: rgba(30, 30, 30, 0.65);
    --glass-border: rgba(255, 255, 255, 0.12);
    --accent: #3b82f6;      
    --danger: #ef4444;      
    --text-main: #ffffff;
    --text-sub: #94a3b8;
    --radius: 16px;
    --bg-overlay: rgba(15, 23, 42, 0.4);
    --nav-bg: rgba(0, 0, 0, 0.95);
    --search-bg: rgba(20, 20, 20, 0.8);
    --modal-bg: #1e293b;
    --input-bg: #0f172a;
    --dock-bg: rgba(15, 15, 15, 0.9);
  }

  /* ☀️ 浅色主题 */
  [data-theme="light"] {
    --glass-bg: rgba(255, 255, 255, 0.75);
    --glass-border: rgba(0, 0, 0, 0.1);
    --accent: #2563eb;      
    --danger: #dc2626;      
    --text-main: #1e293b;
    --text-sub: #64748b;
    --bg-overlay: rgba(255, 255, 255, 0.3);
    --nav-bg: rgba(255, 255, 255, 0.9);
    --search-bg: rgba(255, 255, 255, 0.85);
    --modal-bg: #ffffff;
    --input-bg: #f1f5f9;
    --dock-bg: rgba(255, 255, 255, 0.9);
  }

  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  
  body {
    margin: 0; padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #0f172a;
    color: var(--text-main);
    min-height: 100vh;
    padding-bottom: 120px;
    /* 📱 移除全局 user-select: none，允许长按菜单 */
  }

  /* 📱 性能优化：将 fixed 背景图移到伪元素，避免 iOS Safari 滚动卡顿 */
  body::after {
    content: ''; position: fixed; inset: 0; z-index: -2;
    background: url('${esc(ssrConfig.BG_IMAGE)}') center/cover no-repeat;
    pointer-events: none;
  }

  /* 遮罩层 */
  body::before {
    content: ''; position: fixed; inset: 0; 
    background: var(--bg-overlay); 
    z-index: -1; backdrop-filter: blur(0px);
    transition: background 0.3s ease;
    pointer-events: none;
  }

  /* 导航栏 */
  .nav-header {
    position: sticky; top: 0; z-index: 50;
    min-height: 64px; 
    background: linear-gradient(to bottom, var(--nav-bg) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0) 100%);
    padding-top: max(12px, env(safe-area-inset-top));
    padding-bottom: 16px;
    display: flex; justify-content: center; align-items: flex-end;
    transition: background 0.3s ease;
  }

  .nav-scroll {
    display: flex; gap: 24px; padding: 0 24px;
    overflow-x: auto; scrollbar-width: none; align-items: center;
    max-width: 1200px; width: 100%;
    justify-content: center; /* 分类居中显示 */
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
    background: var(--search-bg);
    border: 1px solid var(--glass-border);
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
    padding: 0 24px; color: var(--text-main); font-size: 17px;
    outline: none; height: 100%;
  }

  .search-btn {
    width: 48px; height: 48px;
    background: var(--accent); border: none; border-radius: 50%;
    color: white; font-size: 18px; cursor: pointer;
    margin-right: 4px;
    display: flex; align-items: center; justify-content: center;
    transition: 0.2s;
  }
  .search-btn:hover { background: #2563eb; transform: scale(1.05); }

  /* 密码可见性切换 */
  .pwd-wrap {
    position: relative;
  }
  .pwd-toggle {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; color: #94a3b8;
    cursor: pointer; font-size: 18px; padding: 4px;
  }
  .pwd-toggle:hover { color: #fff; }

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
    /* 📱 移动端优化：默认允许系统长按菜单(新标签页打开等) */
    -webkit-touch-callout: default;
    user-select: none; /* 保留禁止文本选中 */
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
  
  /* 默认图标占位符 - 优化：避免每个卡片重复内联 SVG */
  .card .icon-fallback {
    width: 48px; height: 48px; margin-bottom: 12px;
    border-radius: 10px;
    background: var(--accent);
    display: none; /* 默认隐藏，onerror 时显示 */
    align-items: center; justify-content: center;
    font-size: 24px; font-weight: 600; color: white;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
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
    /* 📱 编辑模式禁用长按菜单，防止与拖拽冲突 */
    -webkit-touch-callout: none;
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
    background: var(--dock-bg);
    backdrop-filter: blur(20px);
    padding: 12px 24px; border-radius: 100px;
    border: 1px solid var(--glass-border);
    display: flex; gap: 24px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    z-index: 100;
    transition: background 0.3s ease;
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
    background: var(--modal-bg); width: 90%; max-width: 400px;
    padding: 24px; border-radius: 20px;
    border: 1px solid var(--glass-border);
    box-shadow: 0 25px 80px rgba(0,0,0,0.8);
    transform: scale(0.95); opacity: 0;
    animation: popUp 0.3s forwards;
    transition: background 0.3s ease;
  }
  @keyframes popUp { to { transform: scale(1); opacity: 1; } }

  .modal h3 { margin: 0 0 20px 0; color: var(--text-main); font-size: 18px; font-weight: 600; }
  .form-group { margin-bottom: 16px; }
  .form-label { display: block; font-size: 13px; color: var(--text-sub); margin-bottom: 6px; }
  
  input, select {
    width: 100%; padding: 12px;
    background: var(--input-bg); border: 1px solid var(--glass-border);
    border-radius: 10px; color: var(--text-main); font-size: 14px;
    outline: none; transition: 0.2s;
  }
  input:focus, select:focus { border-color: var(--accent); }

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
    background: rgba(59, 130, 246, 0.95); color: white;
    padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 500;
    box-shadow: 0 10px 40px rgba(0,0,0,0.4); z-index: 300;
    transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); opacity: 0; pointer-events: none;
    max-width: 90%; text-align: center; line-height: 1.5;
    backdrop-filter: blur(10px);
  }
  #toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
  #toast.error { background: rgba(239, 68, 68, 0.95); }
  #toast.success { background: rgba(34, 197, 94, 0.95); }

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
    <button class="search-btn" onclick="doSearch()" title="搜索">🔍</button>
  </div>
</div>

<!-- 内容网格 -->
<main class="grid" id="grid"></main>


<!-- 底部功能栏 (Dock) -->
<div class="dock">
  <a class="dock-item" href="https://github.com/skfoa/cf-worker-nav/" target="_blank" title="GitHub 项目">📦</a>
  <div class="dock-item" onclick="toggleTheme()" id="btn-theme" title="切换主题">🌙</div>
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
  <div class="form-group pwd-wrap">
    <input type="password" id="auth-pwd" placeholder="输入后台密码" onkeydown="if(event.key==='Enter') doLogin()">
    <button type="button" class="pwd-toggle" onclick="togglePwd()" title="显示/隐藏密码">👁️</button>
  </div>
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
  <div class="form-group" style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-sub)">
    <input type="checkbox" id="s-private" style="width:auto">
    <label for="s-private">🔒 私有模式 (首页需登录才能查看内容)</label>
  </div>
  <div class="btn-row">
    <button class="btn btn-ghost" onclick="closeModals()">关闭</button>
    <button class="btn btn-primary" onclick="saveConfig()">保存设置</button>
  </div>
  <div style="margin-top:20px;padding-top:15px;border-top:1px solid var(--glass-border);">
    <p class="form-label">数据备份</p>
    <div style="display:flex;gap:10px">
      <button class="btn btn-ghost" onclick="exportData()" style="font-size:12px">📤 导出 JSON</button>
      <button class="btn btn-ghost" onclick="document.getElementById('file-import').click()" style="font-size:12px">📥 导入 JSON</button>
    </div>
    <input type="file" id="file-import" style="display:none" accept=".json" onchange="importData(this)">
  </div>
</div></div>

<!-- 弹窗：自定义确认框 -->
<div class="modal-overlay" id="m-confirm"><div class="modal" style="max-width:340px">
  <h3 id="confirm-title">确认操作</h3>
  <p id="confirm-msg" style="color:#94a3b8;font-size:14px;line-height:1.6"></p>
  <div class="btn-row">
    <button class="btn btn-ghost" onclick="closeModals()">取消</button>
    <button class="btn" id="confirm-btn" style="background:var(--danger)" onclick="doConfirm()">确认删除</button>
  </div>
</div></div>

<script>
/** 
 * 核心逻辑
 */
const APP = ${safeState};

// 🔒 客户端 HTML 转义函数 (防 XSS)
const esc = (str) => String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));

const STATE = {
  activeCatId: 0,
  isEditing: false,
  searchType: 'google',
  searchUrl: 'https://www.google.com/search?q=',
  theme: 'dark'  // 🌙 当前主题
};

// 搜索引擎配置
const ENGINES = {
  google: { url: 'https://www.google.com/search?q=', place: 'Google 搜索...' },
  baidu:  { url: 'https://www.baidu.com/s?wd=', place: '百度一下...' },
  bing:   { url: 'https://cn.bing.com/search?q=', place: '微软 Bing...' },
  github: { url: 'https://github.com/search?q=', place: 'Search GitHub...' },
  site:   { url: '', place: '输入关键词筛选本站链接...' }
};

// 🌙 主题切换
function toggleTheme() {
  const newTheme = STATE.theme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
  localStorage.setItem('nav_theme', newTheme);
  showToast(newTheme === 'light' ? '☀️ 已切换到浅色模式' : '🌙 已切换到深色模式');
}

function setTheme(theme) {
  STATE.theme = theme;
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  // 更新按钮图标
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
}

function initTheme() {
  // 优先读取用户保存的偏好
  const saved = localStorage.getItem('nav_theme');
  if (saved) {
    setTheme(saved);
    return;
  }
  // 否则跟随系统偏好
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    setTheme('light');
  } else {
    setTheme('dark');
  }
}

// 初始化
(async function init() {
  // 🌙 优先初始化主题（避免闪烁）
  initTheme();
  
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
        // 🔧 修复：登录成功后重新获取完整数据（包括私有分类）
        await refreshData();
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
    
    // 🔧 多级回退图标源策略 (国内优先，减少等待时间)
    // 1. 用户自定义 icon (最高优先级)
    // 2. Ico.moe (国内 CDN 加速，速度最快)
    // 3. DuckDuckGo (国内可访问，较稳定)
    // 4. Favicon.im (国外服务，图标质量高)
    // 5. Google Favicon (质量高，但需代理)
    // 6. 首字母占位符 (最终兜底)
    const fallbackSources = [
      \`https://ico.moe/domain/\${domain}\`,
      \`https://icons.duckduckgo.com/ip3/\${domain}.ico\`,
      \`https://favicon.im/\${domain}?larger=true\`,
      \`https://www.google.com/s2/favicons?sz=64&domain=\${domain}\`
    ];
    
    // 如果用户有自定义 icon，则它是第一优先级
    const primaryIcon = item.icon || fallbackSources.shift();
    
    // 🔧 优化：首字母仅在所有源都失败时显示
    const initial = (item.title || 'N').charAt(0).toUpperCase();
    
    // 将剩余备用源编码到 data 属性，供 onerror 级联使用
    const fallbacksJson = JSON.stringify(fallbackSources).replace(/"/g, '&quot;');

    return \`
    <div class="card-wrap" draggable="\${STATE.isEditing && !customItems}" data-id="\${item.id}">
      <a class="card" href="\${esc(item.url)}" target="_blank" 
         onclick="trackClick(\${item.id}); \${STATE.isEditing ? 'return false' : ''}">
        <img src="\${esc(primaryIcon)}" loading="lazy" 
             data-fallbacks="\${fallbacksJson}"
             onerror="handleIconError(this)">
        <div class="icon-fallback">\${initial}</div>
        <span>\${esc(item.title)}</span>
      </a>
      <!-- 链接删除/编辑按钮 (仅编辑模式显示) -->
      <div class="btn-edit-link" onclick="openLinkModal(\${item.id})">✎</div>
      <div class="btn-del-link" onclick="deleteLink(\${item.id})">✕</div>
    </div>\`;
  }).join('');

  if (STATE.isEditing && !customItems) setupDrag('card-wrap', handleLinkDrop);
}

// 🔧 图标加载失败处理：级联尝试备用源
function handleIconError(img) {
  const fallbacksAttr = img.getAttribute('data-fallbacks');
  
  if (fallbacksAttr) {
    try {
      const fallbacks = JSON.parse(fallbacksAttr);
      
      if (fallbacks.length > 0) {
        // 取出下一个备用源
        const nextSrc = fallbacks.shift();
        // 更新剩余备用源
        img.setAttribute('data-fallbacks', JSON.stringify(fallbacks));
        // 尝试加载下一个
        img.src = nextSrc;
        return; // 继续尝试，不显示占位符
      }
    } catch (e) {
      console.warn('[handleIconError] Failed to parse fallbacks:', e);
    }
  }
  
  // 所有备用源都失败了，显示首字母占位符
  img.style.display = 'none';
  img.nextElementSibling.style.display = 'flex';
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

// === 删除功能 ===

// 自定义确认框状态
let confirmCallback = null;

function showConfirm(title, msg, btnText, callback) {
  document.getElementById('confirm-title').innerText = title;
  document.getElementById('confirm-msg').innerText = msg;
  document.getElementById('confirm-btn').innerText = btnText || '确认';
  confirmCallback = callback;
  document.getElementById('m-confirm').style.display = 'flex';
}

function doConfirm() {
  closeModals();
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
}

async function deleteCat(id, e) {
  if (e) e.stopPropagation();
  
  showConfirm('⚠️ 删除分类', '确定删除此分类吗？该分类下的所有链接也会被删除！', '确认删除', async () => {
    try {
      await api('/api/category/delete', { id });
      if (STATE.activeCatId == id) {
        STATE.activeCatId = APP.data[0] ? APP.data[0].id : 0;
      }
      await refreshData();
      showToast("分类已删除");
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  });
}

async function deleteLink(id) {
  showConfirm('⚠️ 删除链接', '确定删除此链接吗？', '确认删除', async () => {
    try {
      await api('/api/link/delete', { id });
      await refreshData();
      showToast("链接已删除");
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  });
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
      showToast('❌ 密码错误', 'error');
    }
  } catch (e) { 
    APP.auth = '';
    showToast('❌ 登录失败: ' + e.message, 'error'); 
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
  
  if (!payload.title || !payload.url) return showToast('⚠️ 标题和网址必填', 'error');
  
  try {
    await api(id ? '/api/link/update' : '/api/link', { id, ...payload });
    closeModals();
    await refreshData();
    showToast(id ? "链接已更新" : "链接已添加");
  } catch (e) { showToast('❌ ' + e.message, 'error'); }
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
    document.getElementById('c-private').checked = false; // 重置私有选项
  }
}

async function saveCat() {
  const id = document.getElementById('c-id').value;
  const title = document.getElementById('c-title').value;
  const is_private = document.getElementById('c-private').checked ? 1 : 0;
  
  if (!title) return showToast('⚠️ 分类名不能为空', 'error');
  
  try {
    await api(id ? '/api/category/update' : '/api/category', { id, title, is_private });
    closeModals();
    await refreshData();
    showToast(id ? "分类已更新" : "分类已添加");
  } catch (e) { showToast('❌ ' + e.message, 'error'); }
}

// === 设置与导入导出 ===

async function openSettings() {
  if (!checkAuth()) return;
  if (!APP.isRoot) return showToast('🔒 需要 Root 权限', 'error');
  document.getElementById('m-set').style.display = 'flex';
  document.getElementById('s-title').value = APP.config.TITLE || '';
  document.getElementById('s-bg').value = APP.config.BG_IMAGE || '';
  
  // 🔒 加载私有模式配置
  try {
    const res = await api('/api/config');
    document.getElementById('s-private').checked = 
      res.private_mode === 'true' || res.private_mode === '1';
  } catch (e) {
    document.getElementById('s-private').checked = false;
  }
}

async function saveConfig() {
  try {
    await api('/api/config', { key: 'title', value: document.getElementById('s-title').value });
    await api('/api/config', { key: 'bg_image', value: document.getElementById('s-bg').value });
    // 🔒 保存私有模式配置
    await api('/api/config', { 
      key: 'private_mode', 
      value: document.getElementById('s-private').checked ? 'true' : 'false' 
    });
    showToast('✅ 设置已保存');
    setTimeout(() => location.reload(), 500);
  } catch (e) {
    showToast('❌ 保存失败: ' + e.message, 'error');
  }
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
      
      // 使用自定义确认框代替原生 confirm()
      showConfirm('📥 确认导入', '确认导入 ' + json.length + ' 个分类？这将合并现有数据。', '确认导入', async () => {
        try {
          const res = await api('/api/import', json);
          let msg = '✅ 导入成功！新增分类: ' + res.categories_added + '，新增链接: ' + res.count;
          if (res.skipped_count > 0) {
            msg += ' (跳过 ' + res.skipped_count + ' 个无效链接)';
          }
          showToast(msg, 'success');
          setTimeout(() => location.reload(), 1500);
        } catch (err) {
          showToast('❌ 导入失败: ' + err.message, 'error');
        }
      });
    } catch (err) {
      showToast('❌ JSON 解析失败: ' + err.message, 'error');
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

// 点击搜索按钮
function doSearch() {
  const input = document.getElementById('search-input');
  const val = input.value.trim();
  if (!val) return;
  
  if (STATE.searchType === 'site') {
    // 站内搜索已通过 input 事件实时筛选
    return;
  }
  window.open(STATE.searchUrl + encodeURIComponent(val));
  input.value = '';
}

// 切换密码可见性
function togglePwd() {
  const pwd = document.getElementById('auth-pwd');
  const btn = document.querySelector('.pwd-toggle');
  if (pwd.type === 'password') {
    pwd.type = 'text';
    btn.textContent = '🙈';
  } else {
    pwd.type = 'password';
    btn.textContent = '👁️';
  }
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

  // 🔧 保存原始顺序用于错误回滚
  const originalOrder = [...APP.data];
  
  const [removed] = APP.data.splice(srcIdx, 1);
  APP.data.splice(targetIdx, 0, removed);
  
  renderNav();
  
  try {
    await api('/api/category/reorder', APP.data.map((c, i) => ({ id: c.id, sort_order: i })));
  } catch (err) {
    // 🔧 错误回滚：恢复原始顺序
    APP.data = originalOrder;
    renderNav();
    showToast('❌ 排序保存失败: ' + err.message + '\n页面已恢复原状态', 'error');
  }
}

async function handleLinkDrop(src, target) {
  const cat = APP.data.find(c => c.id === STATE.activeCatId);
  const srcIdx = cat.items.findIndex(i => i.id == src.dataset.id);
  const targetIdx = cat.items.findIndex(i => i.id == target.dataset.id);
  
  if (srcIdx === -1 || targetIdx === -1) return;

  // 🔧 保存原始顺序用于错误回滚
  const originalItems = [...cat.items];
  
  const [removed] = cat.items.splice(srcIdx, 1);
  cat.items.splice(targetIdx, 0, removed);
  
  renderGrid();
  
  try {
    await api('/api/link/reorder', cat.items.map((i, idx) => ({ id: i.id, sort_order: idx })));
  } catch (err) {
    // 🔧 错误回滚：恢复原始顺序
    cat.items = originalItems;
    renderGrid();
    showToast('❌ 排序保存失败: ' + err.message + '\n页面已恢复原状态', 'error');
  }
}

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.innerText = msg;
  t.className = 'show' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.className = '', 300);
  }, type === 'error' ? 4000 : 3000);
}

// 🔥 点击上报函数 (用于常用推荐统计)
function trackClick(id) {
  // 编辑模式下不记录点击
  if (STATE.isEditing) return;
  
  console.log('[trackClick] Sending visit for id:', id);
  
  // 使用 keepalive 确保页面跳转后请求仍能发送
  fetch('/api/visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: Number(id) }),
    keepalive: true
  })
  .then(res => console.log('[trackClick] Response:', res.status))
  .catch(err => console.error('[trackClick] Error:', err));
}

</script>
</body>
</html>`;
}
