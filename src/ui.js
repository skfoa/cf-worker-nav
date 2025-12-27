export function renderUI(data, config) {
  // 安全转义
  const esc = (str) => String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m]));
  const safeJson = JSON.stringify(data).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${esc(config.TITLE)}</title>
<style>
  /* 基础 CSS (保留你之前的暗黑玻璃风格，精简版) */
  :root { --glass: rgba(20,20,20,0.85); --accent: #3b82f6; --text: #eee; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    background: url('${esc(config.BG_IMAGE)}') center/cover fixed; 
    font-family: system-ui, sans-serif; color: var(--text); min-height: 100vh; padding-bottom: 80px; 
  }
  body::before { content:''; position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:-1; }
  
  /* 导航栏 */
  .nav { position: sticky; top: 0; background: var(--glass); backdrop-filter: blur(15px); padding: 10px 15px; display: flex; overflow-x: auto; gap: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); z-index: 50; }
  .nav-item { white-space: nowrap; opacity: 0.7; cursor: pointer; transition: 0.2s; padding-bottom: 5px; }
  .nav-item.active { opacity: 1; border-bottom: 2px solid var(--accent); font-weight: bold; }

  /* 搜索框 */
  .search-box { margin: 30px auto; width: 90%; max-width: 500px; display: flex; background: rgba(0,0,0,0.5); border-radius: 12px; padding: 5px; border: 1px solid rgba(255,255,255,0.1); }
  .search-input { flex: 1; background: transparent; border: none; color: #fff; padding: 10px; outline: none; font-size: 16px; }
  
  /* 网格布局 */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 15px; padding: 20px; max-width: 1200px; margin: 0 auto; }
  .card { 
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: rgba(30,30,30,0.6); backdrop-filter: blur(10px); 
    border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; 
    padding: 15px; text-decoration: none; color: #fff; transition: transform 0.2s; height: 100px; position: relative;
  }
  .card:hover { transform: translateY(-3px); background: rgba(50,50,50,0.8); }
  .card img { width: 32px; height: 32px; margin-bottom: 8px; border-radius: 6px; }
  .card span { font-size: 13px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }

  /* 编辑模式 */
  .del-btn { position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; background: red; border-radius: 50%; display: none; cursor: pointer; border: 2px solid #fff; }
  .editing .del-btn { display: block; }
  .editing .card { border: 1px dashed #eab308; animation: shake 0.3s infinite alternate; }
  @keyframes shake { from{transform:rotate(-1deg)} to{transform:rotate(1deg)} }

  /* 底部 Dock */
  .dock { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #222; padding: 10px 20px; border-radius: 50px; display: flex; gap: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #444; z-index: 100; }
  .dock i { cursor: pointer; font-style: normal; font-size: 20px; transition: 0.2s; }
  .dock i:hover { transform: scale(1.2); }

  /* Modal */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 200; }
  .modal { background: #1f1f1f; padding: 25px; border-radius: 15px; width: 300px; border: 1px solid #333; }
  .modal input, .modal select { width: 100%; margin: 10px 0; padding: 10px; background: #333; border: 1px solid #444; color: #fff; border-radius: 5px; }
  .btn-row { display: flex; gap: 10px; margin-top: 15px; }
  .btn { flex: 1; padding: 10px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-cancel { background: #444; color: #ccc; }
</style>
</head>
<body>

<div class="nav" id="cat-list"></div>

<div class="search-box">
  <input class="search-input" placeholder="Search Google..." onkeydown="if(event.key==='Enter') window.open('https://google.com/search?q='+this.value)">
</div>

<div class="grid" id="link-grid"></div>

<div class="dock">
  <i onclick="toggleEdit()">⚙️</i>
  <i onclick="openModal('link')">➕</i>
  <i onclick="openModal('cat')">📁</i>
</div>

<!-- Modal: Add Link -->
<div class="modal-overlay" id="m-link"><div class="modal">
  <h3>添加链接</h3>
  <input id="l-title" placeholder="标题">
  <input id="l-url" placeholder="网址 (https://...)">
  <select id="l-cat-select"></select>
  <div class="btn-row">
    <button class="btn btn-cancel" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="submitLink()">添加</button>
  </div>
</div></div>

<!-- Modal: Add Cat -->
<div class="modal-overlay" id="m-cat"><div class="modal">
  <h3>新建分类</h3>
  <input id="c-title" placeholder="分类名称">
  <div class="btn-row">
    <button class="btn btn-cancel" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="submitCat()">创建</button>
  </div>
</div></div>

<script>
  // 核心数据 (SSR 注入)
  let DATA = ${safeJson};
  let activeCatId = DATA[0]?.id || 0;
  let isEditing = false;

  // 渲染分类
  function renderCats() {
    const html = DATA.map(c => 
      \`<div class="nav-item \${c.id === activeCatId ? 'active' : ''}" onclick="switchCat(\${c.id})">
          \${c.title} \${isEditing ? \`<small onclick="delCat(\${c.id}, event)" style="color:red;margin-left:5px">x</small>\` : ''}
       </div>\`
    ).join('');
    document.getElementById('cat-list').innerHTML = html;
  }

  // 渲染网格
  function renderGrid() {
    const cat = DATA.find(c => c.id === activeCatId);
    if (!cat) return document.getElementById('link-grid').innerHTML = '';
    
    document.getElementById('link-grid').classList.toggle('editing', isEditing);
    document.getElementById('link-grid').innerHTML = cat.items.map(l => {
        // 自动图标 fallback
        const domain = new URL(l.url).hostname;
        const icon = l.icon || \`https://api.iowen.cn/favicon/\${domain}.png\`;
        
        return \`<div style="position:relative">
          <a class="card" href="\${l.url}" target="_blank">
            <img src="\${icon}" loading="lazy" onerror="this.src='https://icons.duckduckgo.com/ip3/\${domain}.ico'">
            <span>\${l.title}</span>
          </a>
          <div class="del-btn" onclick="delLink(\${l.id})"></div>
        </div>\`;
    }).join('');
  }

  function switchCat(id) { activeCatId = id; renderCats(); renderGrid(); }
  function toggleEdit() { if(checkAuth()) { isEditing = !isEditing; renderCats(); renderGrid(); } }
  function closeModal() { document.querySelectorAll('.modal-overlay').forEach(e => e.style.display = 'none'); }
  
  // 简易认证
  function getPwd() { return localStorage.getItem('nav_pwd'); }
  function checkAuth() {
    if(getPwd()) return true;
    const p = prompt("请输入管理密码:");
    if(p) { localStorage.setItem('nav_pwd', p); return true; }
    return false;
  }

  // API 交互
  async function api(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': getPwd() },
      body: JSON.stringify(body)
    });
    if (res.status === 401) { alert("密码错误"); localStorage.removeItem('nav_pwd'); location.reload(); return false; }
    if (!res.ok) { alert("操作失败"); return false; }
    return true;
  }

  async function submitLink() {
    const title = document.getElementById('l-title').value;
    const url = document.getElementById('l-url').value;
    const catId = document.getElementById('l-cat-select').value;
    if(await api('/api/link', { category_id: catId, title, url })) location.reload();
  }

  async function delLink(id) {
    if(confirm('删除链接?')) if(await api('/api/link/delete', { id })) location.reload();
  }

  async function submitCat() {
    const title = document.getElementById('c-title').value;
    if(await api('/api/category', { title })) location.reload();
  }

  async function delCat(id, e) {
    e.stopPropagation();
    if(confirm('删除分类及其所有链接?')) if(await api('/api/category/delete', { id })) location.reload();
  }

  function openModal(type) {
    if(!checkAuth()) return;
    closeModal();
    if(type === 'link') {
      const sel = document.getElementById('l-cat-select');
      sel.innerHTML = DATA.map(c => \`<option value="\${c.id}">\${c.title}</option>\`).join('');
      sel.value = activeCatId;
      document.getElementById('m-link').style.display = 'flex';
    } else {
      document.getElementById('m-cat').style.display = 'flex';
    }
  }

  renderCats(); renderGrid();
</script>
</body>
</html>`;
}
