export function renderUI(data, config) {
  const esc = (str) => String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m]));
  const safeJson = JSON.stringify(data).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${esc(config.TITLE)}</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<style>
  :root { --glass: rgba(22,22,22,0.9); --glass-border: rgba(255,255,255,0.1); --accent: #3b82f6; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { 
    background: url('${esc(config.BG_IMAGE)}') center/cover fixed; 
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
    color: #fff; min-height: 100vh; padding-bottom: 90px; 
  }
  body::before { content:''; position:fixed; inset:0; background:rgba(0,0,0,0.35); z-index:-1; }

  /* Nav */
  .nav { position: sticky; top: 0; background: rgba(20,20,20,0.8); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid var(--glass-border); padding: 0 15px; display: flex; gap: 5px; overflow-x: auto; z-index: 50; scrollbar-width: none; }
  .nav-item { padding: 14px 10px; font-size: 15px; color: rgba(255,255,255,0.6); white-space: nowrap; cursor: pointer; border-bottom: 2px solid transparent; transition: 0.2s; }
  .nav-item.active { color: #fff; font-weight: 600; border-bottom-color: var(--accent); }

  /* Search */
  .search-box { margin: 25px auto 15px; width: 90%; max-width: 600px; position: relative; }
  .search-input { width: 100%; padding: 14px 20px; background: rgba(0,0,0,0.6); border: 1px solid var(--glass-border); backdrop-filter: blur(10px); color: #fff; border-radius: 12px; font-size: 16px; outline: none; text-align: center; transition: 0.2s; }
  .search-input:focus { background: rgba(0,0,0,0.8); border-color: var(--accent); text-align: left; }

  /* Grid */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(105px, 1fr)); gap: 12px; padding: 15px; max-width: 1000px; margin: 0 auto; }
  .card { 
    display: flex; flex-direction: column; align-items: center; 
    background: var(--glass); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--glass-border); border-radius: 14px; padding: 16px 8px; 
    text-decoration: none; color: #fff; position: relative; transition: transform 0.1s; cursor: pointer;
  }
  .card:active { transform: scale(0.96); }
  .card img { width: 38px; height: 38px; margin-bottom: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); object-fit: cover; }
  .card span { font-size: 12px; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.9; }

  /* Edit Mode Styles */
  .del-btn { display: none; position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; background: #ef4444; border-radius: 50%; border: 2px solid rgba(255,255,255,0.9); z-index: 10; cursor: pointer; }
  .editing .del-btn { display: block; }
  .editing .card { border-color: #eab308; animation: shake 0.25s infinite alternate; }
  .editing .card img { pointer-events: none; } /* Prevent drag */
  @keyframes shake { from { transform: rotate(-1deg); } to { transform: rotate(1deg); } }

  /* Dock */
  .dock { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(30,30,30,0.9); backdrop-filter: blur(20px); padding: 8px 20px; border-radius: 100px; display: flex; gap: 20px; border: 1px solid var(--glass-border); z-index: 100; box-shadow: 0 10px 40px rgba(0,0,0,0.6); transition: 0.3s; }
  .dock-btn { font-size: 22px; cursor: pointer; opacity: 0.8; transition: 0.2s; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; }
  .dock-btn:hover { background: rgba(255,255,255,0.1); opacity: 1; transform: scale(1.1); }
  
  /* Modal */
  .modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); display: none; align-items: flex-start; justify-content: center; padding-top: 15vh; z-index: 200; }
  .modal { background: #1c1c1e; width: 85%; max-width: 320px; padding: 20px; border-radius: 16px; border: 1px solid #333; box-shadow: 0 25px 50px rgba(0,0,0,0.7); }
  .modal h3 { margin-bottom: 15px; font-weight: 600; color: #fff; text-align: center; }
  .modal input, .modal select { width: 100%; padding: 12px; margin-bottom: 12px; background: #2c2c2e; border: none; border-radius: 8px; color: #fff; font-size: 15px; outline: none; }
  .modal input:focus { box-shadow: 0 0 0 2px var(--accent); }
  .btn-group { display: flex; gap: 10px; margin-top: 5px; }
  .btn { flex: 1; padding: 12px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; font-size: 14px; }
  .btn-ok { background: var(--accent); color: #fff; }
  .btn-del { background: #ef4444; color: #fff; }
  .btn-cancel { background: #3a3a3c; color: #aaa; }
</style>
</head>
<body>

  <nav class="nav" id="nav-list"></nav>

  <div class="search-box">
    <input class="search-input" id="search" placeholder="Search Google..." autocomplete="off">
  </div>

  <div class="grid" id="grid"></div>

  <!-- 动态 Dock 栏 -->
  <div class="dock" id="dock">
    <!-- 默认只有齿轮，JS 会动态填充 -->
    <div class="dock-btn" onclick="setEditMode(true)">⚙️</div>
  </div>

  <!-- Modal: Edit/Add Link -->
  <div class="modal-mask" id="m-link"><div class="modal">
    <h3 id="m-link-title">添加链接</h3>
    <input id="l-name" placeholder="网站名称">
    <input id="l-url" placeholder="网址 (https://...)">
    <select id="l-cat"></select>
    <div class="btn-group">
      <button class="btn btn-cancel" onclick="closeM()">取消</button>
      <button class="btn btn-ok" onclick="saveLink()">保存</button>
    </div>
  </div></div>

  <!-- Modal: Edit/Add Cat -->
  <div class="modal-mask" id="m-cat"><div class="modal">
    <h3 id="m-cat-title">分类管理</h3>
    <input id="c-name" placeholder="分类名称">
    <div class="btn-group">
      <button class="btn btn-cancel" onclick="closeM()">取消</button>
      <button class="btn btn-del" id="btn-del-cat" style="display:none" onclick="delCat()">删除</button>
      <button class="btn btn-ok" onclick="saveCat()">保存</button>
    </div>
  </div></div>

<script>
  let DATA = ${safeJson};
  let activeCatId = DATA[0]?.id || 0;
  let isEditing = false;
  // 用于记录当前正在修改的 Item ID (null 表示新增)
  let editingId = null; 

  // --- 核心渲染逻辑 ---
  
  function getIcon(url) {
    let safeUrl = url.trim();
    if (!safeUrl || /^javascript:/i.test(safeUrl)) return "https://cdn-icons-png.flaticon.com/512/1006/1006771.png"; // Globe
    if (/^magnet:/i.test(safeUrl)) return "https://cdn-icons-png.flaticon.com/512/1250/1250308.png";
    if (/^mailto:/i.test(safeUrl)) return "https://cdn-icons-png.flaticon.com/512/732/732200.png";
    
    // 默认 favicon
    try {
      const domain = new URL(safeUrl.startsWith('http') ? safeUrl : 'https://'+safeUrl).hostname;
      return \`https://api.iowen.cn/favicon/\${domain}.png\`;
    } catch(e) { return "https://cdn-icons-png.flaticon.com/512/1006/1006771.png"; }
  }

  function getErrIcon(url) {
    try {
      const domain = new URL(url.startsWith('http') ? url : 'https://'+url).hostname;
      return \`this.src='https://icons.duckduckgo.com/ip3/\${domain}.ico'\`;
    } catch(e) { return ""; }
  }

  function render() {
    // 1. 渲染 Tabs
    const navHtml = DATA.map(c => 
      \`<div class="nav-item \${c.id === activeCatId ? 'active' : ''}" 
           onclick="isEditing ? openCatModal(\${c.id}) : switchCat(\${c.id})">
         \${esc(c.title)}
         \${isEditing ? '<span style="color:#ef4444;font-size:10px;vertical-align:top">✎</span>' : ''}
       </div>\`
    ).join('');
    document.getElementById('nav-list').innerHTML = navHtml;

    // 2. 渲染 Grid
    const cat = DATA.find(c => c.id === activeCatId);
    const grid = document.getElementById('grid');
    
    if (isEditing) grid.classList.add('editing');
    else grid.classList.remove('editing');

    if (cat && cat.items) {
      grid.innerHTML = cat.items.map(item => \`
        <div style="position:relative">
          <a class="card" href="\${isEditing ? 'javascript:void(0)' : esc(item.url)}" 
             target="_blank" onclick="\${isEditing ? \`openLinkModal(\${item.id})\` : ''}">
            <img src="\${getIcon(item.url)}" loading="lazy" onerror="\${getErrIcon(item.url)}">
            <span>\${esc(item.title)}</span>
          </a>
          <div class="del-btn" onclick="delLink(\${item.id})"></div>
        </div>
      \`).join('');
    } else {
      grid.innerHTML = '<div style="color:#666;text-align:center;grid-column:1/-1;margin-top:50px">空空如也</div>';
    }

    // 3. 渲染 Dock (状态机)
    const dock = document.getElementById('dock');
    if (isEditing) {
      dock.innerHTML = \`
        <div class="dock-btn" onclick="setEditMode(false)" style="color:#4ade80">✔</div>
        <div class="dock-btn" onclick="openLinkModal(null)">➕</div>
        <div class="dock-btn" onclick="openCatModal(null)">📁</div>
      \`;
    } else {
      dock.innerHTML = \`<div class="dock-btn" onclick="setEditMode(true)">⚙️</div>\`;
    }
  }

  // --- 交互逻辑 ---

  function switchCat(id) { activeCatId = id; render(); }
  
  async function setEditMode(val) {
    if (val) {
      if (await checkAuth()) { isEditing = true; render(); }
    } else {
      isEditing = false; render();
    }
  }

  // --- Modals ---

  function openLinkModal(id) {
    editingId = id;
    const cat = DATA.find(c => c.id === activeCatId);
    
    // 填充分类下拉框
    const sel = document.getElementById('l-cat');
    sel.innerHTML = DATA.map(c => \`<option value="\${c.id}">\${esc(c.title)}</option>\`).join('');
    sel.value = activeCatId;

    if (id) {
      // 修改模式
      const item = cat.items.find(i => i.id === id);
      document.getElementById('m-link-title').innerText = "修改链接";
      document.getElementById('l-name').value = item.title;
      document.getElementById('l-url').value = item.url;
      sel.value = activeCatId; // 也可以支持移动分类
    } else {
      // 新增模式
      document.getElementById('m-link-title').innerText = "添加链接";
      document.getElementById('l-name').value = "";
      document.getElementById('l-url').value = "";
    }
    document.getElementById('m-link').style.display = 'flex';
  }

  function openCatModal(id) {
    editingId = id;
    const btnDel = document.getElementById('btn-del-cat');
    
    if (id) {
      const c = DATA.find(x => x.id === id);
      document.getElementById('m-cat-title').innerText = "修改分类";
      document.getElementById('c-name').value = c.title;
      btnDel.style.display = 'block'; // 编辑时才显示删除
    } else {
      document.getElementById('m-cat-title').innerText = "新建分类";
      document.getElementById('c-name').value = "";
      btnDel.style.display = 'none';
    }
    document.getElementById('m-cat').style.display = 'flex';
  }

  function closeM() { document.querySelectorAll('.modal-mask').forEach(e => e.style.display='none'); }

  // --- API Actions ---

  async function saveLink() {
    const title = document.getElementById('l-name').value;
    let url = document.getElementById('l-url').value;
    const catId = document.getElementById('l-cat').value;

    if (!title || !url) return alert("请填写完整");
    if (!/^[a-zA-Z0-9.\+\-]+:/.test(url)) url = 'https://' + url;

    const endpoint = editingId ? '/api/link' : '/api/link'; // URL一样，Method不一样
    const method = editingId ? 'PUT' : 'POST';
    const body = { id: editingId, title, url, category_id: catId };

    if (await api(endpoint, method, body)) location.reload();
  }

  async function delLink(id) {
    if (confirm("确定删除?")) {
      if (await api('/api/link', 'DELETE', { id })) {
        // 简单处理：直接刷新保持状态比较麻烦，直接重载最稳
        location.reload(); 
      }
    }
  }

  async function saveCat() {
    const title = document.getElementById('c-name').value;
    if (!title) return alert("写个名字吧");
    
    const method = editingId ? 'PUT' : 'POST';
    const body = { id: editingId, title };
    
    if (await api('/api/category', method, body)) location.reload();
  }

  async function delCat() {
    if (confirm("确定删除分类？(其下所有链接也会消失)")) {
      if (await api('/api/category', 'DELETE', { id: editingId })) location.reload();
    }
  }

  // --- Auth & Network ---

  function getPwd() { return localStorage.getItem('nav_pwd'); }
  async function checkAuth() {
    if(getPwd()) return true;
    const p = prompt("请输入管理密码:");
    if(p) { localStorage.setItem('nav_pwd', p); return true; }
    return false;
  }

  async function api(path, method, body) {
    const res = await fetch(path, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'Authorization': getPwd() },
      body: JSON.stringify(body)
    });
    if (res.status === 401) { alert("密码错误"); localStorage.removeItem('nav_pwd'); return false; }
    if (!res.ok) { alert("操作失败"); return false; }
    return true;
  }

  // --- Search Logic ---
  document.getElementById('search').addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && e.target.value) 
      window.open('https://www.google.com/search?q=' + encodeURIComponent(e.target.value));
  });

  // Init
  render();

</script>
</body>
</html>`;
}
