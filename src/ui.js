/**
 * src/ui.js
 * 前端界面渲染引擎 (SSR + Client Hydration)
 */
export function renderUI(data, config) {
  // 安全转义，防止 XSS
  const esc = (str) => String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m]));
  // 安全注入 JSON 数据
  const safeJson = JSON.stringify(data).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>${esc(config.TITLE)}</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<style>
  :root {
    --bg-color: #111;
    --text-primary: #fff;
    --text-secondary: rgba(255,255,255,0.6);
    --glass: rgba(30, 30, 30, 0.6);
    --glass-border: rgba(255, 255, 255, 0.08);
    --accent: #3b82f6;
    --danger: #ef4444;
  }
  
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  
  body {
    background-color: var(--bg-color);
    background-image: url('${esc(config.BG_IMAGE)}');
    background-position: center;
    background-size: cover;
    background-attachment: fixed;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: var(--text-primary);
    min-height: 100vh;
    padding-bottom: 100px;
    /* 遮罩层，让背景暗一点 */
    box-shadow: inset 0 0 0 100vh rgba(0,0,0,0.3);
  }

  /* 顶部导航栏 (分类) */
  .nav-bar {
    position: sticky;
    top: 0;
    z-index: 50;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    background: rgba(10,10,10,0.8);
    border-bottom: 1px solid var(--glass-border);
    padding: 10px 0;
    display: flex;
    justify-content: center;
  }
  .nav-scroll {
    display: flex;
    overflow-x: auto;
    gap: 20px;
    padding: 0 20px;
    max-width: 1000px;
    width: 100%;
    scrollbar-width: none; /* Firefox */
  }
  .nav-scroll::-webkit-scrollbar { display: none; }
  
  .nav-item {
    font-size: 15px;
    color: var(--text-secondary);
    white-space: nowrap;
    cursor: pointer;
    padding: 8px 0;
    position: relative;
    transition: 0.2s;
  }
  .nav-item.active {
    color: #fff;
    font-weight: 600;
  }
  .nav-item.active::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: var(--accent);
    border-radius: 2px;
  }
  .nav-item small { 
    font-size: 10px; color: var(--danger); margin-left: 4px; vertical-align: top; 
    opacity: 0.8;
  }

  /* 搜索框 */
  .search-container {
    margin: 40px auto 20px;
    width: 90%;
    max-width: 600px;
    position: relative;
  }
  .search-input {
    width: 100%;
    padding: 16px 24px;
    border-radius: 16px;
    border: 1px solid var(--glass-border);
    background: var(--glass);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #fff;
    font-size: 16px;
    outline: none;
    text-align: center;
    transition: 0.3s;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  }
  .search-input:focus {
    background: rgba(40,40,40,0.9);
    border-color: var(--accent);
    text-align: left;
    transform: scale(1.02);
  }

  /* 内容网格 */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 16px;
    padding: 20px;
    max-width: 1000px;
    margin: 0 auto;
  }
  
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1/1; /* 正方形卡片 */
    background: var(--glass);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--glass-border);
    border-radius: 18px;
    text-decoration: none;
    color: #fff;
    transition: transform 0.2s, background 0.2s;
    position: relative;
    padding: 10px;
  }
  .card:hover {
    transform: translateY(-4px);
    background: rgba(60,60,60,0.7);
    border-color: rgba(255,255,255,0.2);
  }
  .card:active { transform: scale(0.96); }
  
  .card img {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    margin-bottom: 12px;
    object-fit: contain;
    background: rgba(255,255,255,0.05); /* 图标底色，防透明 */
  }
  .card span {
    font-size: 13px;
    text-align: center;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.9;
  }
  
  /* 空状态提示 */
  .empty-state {
    text-align: center;
    color: var(--text-secondary);
    margin-top: 50px;
    font-size: 14px;
  }

  /* 编辑模式样式 */
  .editing .card {
    border: 1px dashed var(--accent);
    animation: shake 0.3s infinite alternate ease-in-out;
  }
  .del-btn {
    position: absolute;
    top: -8px; right: -8px;
    width: 24px; height: 24px;
    background: var(--danger);
    border-radius: 50%;
    color: #fff;
    display: none;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
    border: 2px solid #fff;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    z-index: 10;
  }
  .editing .del-btn { display: flex; }
  @keyframes shake { from { transform: rotate(-1deg); } to { transform: rotate(1deg); } }

  /* 底部 Dock 栏 */
  .dock-container {
    position: fixed;
    bottom: 30px;
    left: 0; right: 0;
    display: flex;
    justify-content: center;
    pointer-events: none; /* 让两侧可点击穿透 */
    z-index: 100;
  }
  .dock {
    pointer-events: auto;
    background: rgba(20,20,20,0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    padding: 10px 20px;
    border-radius: 100px;
    display: flex;
    gap: 24px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  .dock-icon {
    font-size: 20px;
    cursor: pointer;
    opacity: 0.7;
    transition: 0.2s;
    position: relative;
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px;
  }
  .dock-icon:hover { opacity: 1; transform: scale(1.1); }
  .dock-icon.active { opacity: 1; color: var(--accent); }

  /* 弹窗 Modal */
  .modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(5px);
    z-index: 200;
    display: none;
    align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s;
  }
  .modal-overlay.show { opacity: 1; }
  
  .modal {
    background: #1c1c1e;
    width: 90%; max-width: 340px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.1);
    padding: 24px;
    transform: scale(0.95); transition: transform 0.2s;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }
  .modal-overlay.show .modal { transform: scale(1); }
  
  .modal h3 { margin-bottom: 20px; font-weight: 600; text-align: center; }
  .form-group { margin-bottom: 16px; }
  .form-input {
    width: 100%; padding: 12px;
    background: #2c2c2e; border: none; border-radius: 10px;
    color: #fff; font-size: 16px;
    outline: none; transition: 0.2s;
  }
  .form-input:focus { ring: 2px solid var(--accent); background: #3a3a3c; }
  
  .btn-row { display: flex; gap: 12px; margin-top: 24px; }
  .btn {
    flex: 1; padding: 12px;
    border: none; border-radius: 10px;
    font-size: 15px; font-weight: 600; cursor: pointer;
  }
  .btn-cancel { background: #3a3a3c; color: #aaa; }
  .btn-primary { background: var(--accent); color: #fff; }
</style>
</head>
<body>

  <!-- 分类导航 -->
  <div class="nav-bar">
    <div class="nav-scroll" id="cat-list">
      <!-- JS 渲染 -->
    </div>
  </div>

  <!-- 搜索 -->
  <div class="search-container">
    <input class="search-input" id="search" placeholder="Search..." autocomplete="off">
  </div>

  <!-- 链接网格 -->
  <div class="grid" id="link-grid">
    <!-- JS 渲染 -->
  </div>

  <!-- 底部操作栏 -->
  <div class="dock-container">
    <div class="dock">
      <div class="dock-icon" onclick="toggleEdit()" title="设置/编辑">⚙️</div>
      <div class="dock-icon" onclick="openModal('link')" title="添加链接">➕</div>
      <div class="dock-icon" onclick="openModal('cat')" title="新建分类">📁</div>
      <!-- 只有在登录后才显示注销 -->
      <div class="dock-icon" id="btn-logout" onclick="doLogout()" style="display:none" title="退出">👋</div>
    </div>
  </div>

  <!-- Modal: Link -->
  <div class="modal-overlay" id="m-link"><div class="modal">
    <h3>添加网站</h3>
    <div class="form-group"><input class="form-input" id="l-title" placeholder="网站名称"></div>
    <div class="form-group"><input class="form-input" id="l-url" placeholder="网址 (https://...)"></div>
    <div class="form-group"><input class="form-input" id="l-icon" placeholder="图标地址 (可选)"></div>
    <div class="form-group">
      <select class="form-input" id="l-cat-select"></select>
    </div>
    <div class="btn-row">
      <button class="btn btn-cancel" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitLink()">添加</button>
    </div>
  </div></div>

  <!-- Modal: Category -->
  <div class="modal-overlay" id="m-cat"><div class="modal">
    <h3>新建分类</h3>
    <div class="form-group"><input class="form-input" id="c-title" placeholder="分类名称"></div>
    <div class="form-group" style="display:flex;align-items:center;gap:10px;color:#ccc;font-size:14px">
      <input type="checkbox" id="c-private"> 设为私有分类 (仅登录可见)
    </div>
    <div class="btn-row">
      <button class="btn btn-cancel" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitCat()">创建</button>
    </div>
  </div></div>

<script>
  // ============================================
  // 核心逻辑
  // ============================================
  let DATA = ${safeJson}; // 服务端注入的数据
  let activeCatId = null;
  let isEditing = false;

  // 初始化
  function init() {
    // 优先选择第一个分类，如果没有数据，则为 null
    if (DATA && DATA.length > 0) {
      activeCatId = DATA[0].id;
    }
    
    // 检查登录状态
    if (localStorage.getItem('nav_pwd')) {
      document.getElementById('btn-logout').style.display = 'flex';
      // 如果本地已有密码，尝试后台验证一次（静默）
      api('/api/auth/verify').then(res => {
         if(!res) { 
           // 密码失效
           localStorage.removeItem('nav_pwd');
           document.getElementById('btn-logout').style.display = 'none';
         }
      });
    }

    render();
  }

  // 渲染函数
  function render() {
    renderCats();
    renderGrid();
  }

  function renderCats() {
    const list = document.getElementById('cat-list');
    if (!DATA || DATA.length === 0) {
      list.innerHTML = '<div class="nav-item">暂无分类</div>';
      return;
    }

    list.innerHTML = DATA.map(c => \`
      <div class="nav-item \${c.id === activeCatId ? 'active' : ''}" onclick="switchCat(\${c.id})">
        \${escapeHtml(c.title)}
        \${c.is_private ? '🔒' : ''}
        \${isEditing ? \`<small onclick="delCat(\${c.id}, event)">x</small>\` : ''}
      </div>
    \`).join('');
  }

  function renderGrid() {
    const grid = document.getElementById('link-grid');
    grid.classList.toggle('editing', isEditing);

    // 找到当前分类
    const cat = DATA.find(c => c.id === activeCatId);
    
    if (!cat || !cat.items || cat.items.length === 0) {
      grid.innerHTML = \`<div class="empty-state">\${DATA.length===0 ? '还没有数据，请点击底部 + 号添加' : '该分类下暂无链接'}</div>\`;
      return;
    }

    grid.innerHTML = cat.items.map(l => {
      // 图标自动回退逻辑
      const domain = getDomain(l.url);
      const iconSrc = l.icon || \`https://api.iowen.cn/favicon/\${domain}.png\`;
      const fallback = \`https://icons.duckduckgo.com/ip3/\${domain}.ico\`;
      
      return \`
      <div style="position:relative">
        <a class="card" href="\${escapeHtml(l.url)}" target="_blank">
          <img src="\${escapeHtml(iconSrc)}" loading="lazy" onerror="this.src='\${fallback}'">
          <span>\${escapeHtml(l.title)}</span>
        </a>
        <div class="del-btn" onclick="delLink(\${l.id})">×</div>
      </div>\`;
    }).join('');
  }

  // 切换分类
  window.switchCat = (id) => {
    activeCatId = id;
    render();
  }

  // ============================================
  // 交互逻辑
  // ============================================
  
  // 1. 认证
  function getPwd() { return localStorage.getItem('nav_pwd'); }
  
  async function checkAuth() {
    if (getPwd()) return true;
    const p = prompt("请输入管理密码:");
    if (!p) return false;
    
    // 简单验证一下
    localStorage.setItem('nav_pwd', p);
    const res = await api('/api/auth/verify');
    if (res) {
      document.getElementById('btn-logout').style.display = 'flex';
      // 登录成功后，刷新页面以获取可能存在的私有数据
      location.reload(); 
      return true;
    } else {
      alert("密码错误");
      localStorage.removeItem('nav_pwd');
      return false;
    }
  }

  window.doLogout = () => {
    if(confirm('确定退出登录？')) {
      localStorage.removeItem('nav_pwd');
      location.reload();
    }
  }

  // 2. 通用 API 请求
  async function api(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const pwd = getPwd();
    if (pwd) headers['Authorization'] = pwd;

    try {
      const res = await fetch(path, {
        method: body ? 'POST' : 'GET',
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      
      if (res.status === 401) return false; // Auth fail
      if (res.status === 200) return await res.json();
      return false;
    } catch(e) {
      return false;
    }
  }

  // 3. 编辑模式
  window.toggleEdit = async () => {
    if (await checkAuth()) {
      isEditing = !isEditing;
      render();
    }
  }

  // 4. Modal 操作
  window.openModal = async (type) => {
    if (!(await checkAuth())) return;
    
    document.querySelectorAll('.modal-overlay').forEach(el => {
      el.classList.remove('show');
      el.style.display = 'none';
    });

    const modalId = type === 'link' ? 'm-link' : 'm-cat';
    const el = document.getElementById(modalId);
    el.style.display = 'flex';
    // 强制重绘以触发 transition
    el.offsetHeight; 
    el.classList.add('show');

    if (type === 'link') {
      // 填充分类选择框
      const sel = document.getElementById('l-cat-select');
      sel.innerHTML = DATA.map(c => \`<option value="\${c.id}">\${escapeHtml(c.title)}\</option>\`).join('');
      if (activeCatId) sel.value = activeCatId;
    }
  }

  window.closeModal = () => {
    document.querySelectorAll('.modal-overlay').forEach(el => {
      el.classList.remove('show');
      setTimeout(() => el.style.display = 'none', 200);
    });
  }

  // 5. 提交数据
  window.submitCat = async () => {
    const title = document.getElementById('c-title').value;
    const isPrivate = document.getElementById('c-private').checked ? 1 : 0;
    if (!title) return alert("请输入名称");

    const res = await api('/api/category', { title, is_private: isPrivate });
    if (res && res.success !== false) location.reload();
    else alert("操作失败");
  }

  window.submitLink = async () => {
    const title = document.getElementById('l-title').value;
    const url = document.getElementById('l-url').value;
    const catId = document.getElementById('l-cat-select').value;
    const icon = document.getElementById('l-icon').value;
    
    if (!title || !url) return alert("请填写完整");

    const res = await api('/api/link', { category_id: catId, title, url, icon });
    if (res && res.success !== false) location.reload();
    else alert("操作失败");
  }

  // 6. 删除
  window.delLink = async (id) => {
    if (confirm("确定删除此链接？")) {
      await api('/api/link/delete', { id });
      // 乐观更新 UI (不刷新页面)
      const cat = DATA.find(c => c.id === activeCatId);
      cat.items = cat.items.filter(i => i.id !== id);
      render();
    }
  }

  window.delCat = async (id, e) => {
    e.stopPropagation();
    if (confirm("确定删除此分类及其下所有链接？")) {
      const res = await api('/api/category/delete', { id });
      if (res) location.reload();
    }
  }

  // 工具函数
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m]));
  }
  
  function getDomain(url) {
    try { return new URL(url).hostname; } catch(e) { return ''; }
  }
  
  // 搜索回车事件
  document.getElementById('search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value) {
      window.open('https://www.google.com/search?q=' + encodeURIComponent(e.target.value));
    }
  });

  // 启动!
  init();
</script>
</body>
</html>`;
}
