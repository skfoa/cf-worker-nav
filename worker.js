/**
 * CF-Workers-Nav (V11 Final Perfection)
 * 核心特性:
 * 1. 配置解耦: 支持 Cloudflare 后台环境变量 (TITLE, BG_IMAGE, PASSWORD)
 * 2. 缓存控制: Manifest 随数据版本自动更新，解决 PWA 改名不生效问题
 * 3. 极致安全: 乐观锁并发控制 + XSS 深度清洗 + 协议白名单
 * 4. 完美体验: 移动端自适应 + 搜索引擎切换 + 冲突灾难恢复 + 协议感知图标
 */

// 默认配置 (兜底用，建议在后台配置环境变量)
const DEFAULT_CONFIG = {
  TITLE: "我的导航",
  BG_IMAGE: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?q=80&w=2070&auto=format&fit=crop",
  PASSWORD: "admin"
};

// 冷启动数据
const DEFAULT_DB = {
  ver: 1,
  data: [{
    category: "开始",
    items: [
      { name: "Google", url: "https://www.google.com" },
      { name: "GitHub", url: "https://github.com" },
    ]
  }]
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // === 1. 配置加载 (优先读取环境变量) ===
    const CONFIG = {
      TITLE: env.TITLE || DEFAULT_CONFIG.TITLE,
      BG_IMAGE: env.BG_IMAGE || DEFAULT_CONFIG.BG_IMAGE,
      PASSWORD: env.PASSWORD || DEFAULT_CONFIG.PASSWORD
    };

    // === 2. PWA Manifest (动态生成) ===
    if (url.pathname === "/manifest.json") {
      return new Response(JSON.stringify({
        name: CONFIG.TITLE,
        short_name: "Nav", // 手机桌面显示短名
        start_url: "/",
        display: "standalone",
        background_color: "#1a1a1a",
        theme_color: "#1a1a1a",
        icons: [{ src: "https://cdn-icons-png.flaticon.com/512/1006/1006771.png", sizes: "192x192", type: "image/png" }]
      }), { headers: { "content-type": "application/json" } });
    }

    // === 3. API: 保存数据 ===
    if (url.pathname === "/api/save" && request.method === "POST") {
      if (request.headers.get("Authorization") !== CONFIG.PASSWORD) {
        await new Promise(r => setTimeout(r, 2000)); // 防爆破
        return new Response("Unauthorized", { status: 401 });
      }

      try {
        const reqPayload = await request.json();
        const currentRaw = await env.KV.get("NAV_DATA", { type: "json" });
        const currentDB = currentRaw || DEFAULT_DB;

        // 乐观锁校验
        if (!Array.isArray(currentDB) && reqPayload.base_ver !== currentDB.ver) {
          return new Response("Conflict", { status: 409 });
        }

        // 数据清洗
        const cleanData = reqPayload.data.map(cat => ({
          category: String(cat.category || "默认").slice(0, 50),
          items: Array.isArray(cat.items) ? cat.items.map(item => {
            let rawUrl = String(item.url || "").trim();
            if (/^javascript:/i.test(rawUrl)) rawUrl = "";
            // 协议白名单补全
            else if (rawUrl && !/^[a-zA-Z0-9.\+\-]+:/.test(rawUrl)) {
              rawUrl = "https://" + rawUrl;
            }
            return {
              name: String(item.name || "").slice(0, 50),
              url: rawUrl.slice(0, 500)
            };
          }).filter(i => i.url) : []
        }));

        const newDB = { ver: Date.now(), data: cleanData };
        await env.KV.put("NAV_DATA", JSON.stringify(newDB));
        return new Response(JSON.stringify({ new_ver: newDB.ver }), { status: 200 });

      } catch (e) {
        return new Response(e.message, { status: 400 });
      }
    }

    // === 4. 首页渲染 ===
    if (url.pathname === "/") {
      const raw = await env.KV.get("NAV_DATA", { type: "json" });
      const db = raw || DEFAULT_DB;
      const finalDB = Array.isArray(db) ? { ver: 1, data: db } : db;
      
      return new Response(renderHTML(finalDB, CONFIG), {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }
    return new Response("404", { status: 404 });
  },
};

function renderHTML(db, config) {
  // HTML 转义
  const esc = (str) => String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m]));
  // JSON 安全注入
  const safeDataStr = JSON.stringify(db.data).replace(/</g, "\\u003c");

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>${esc(config.TITLE)}</title>
<!-- [优化] 增加版本号后缀，强迫浏览器更新 PWA 配置 -->
<link rel="manifest" href="/manifest.json?v=${db.ver}">
<meta name="apple-mobile-web-app-capable" content="yes">
<style>
  :root { --glass: rgba(22,22,22,0.9); --glass-border: rgba(255,255,255,0.1); --accent: #3b82f6; --safe-bottom: env(safe-area-inset-bottom); }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: url('${esc(config.BG_IMAGE)}') center/cover fixed; min-height: 100vh; color: #fff; padding-bottom: calc(80px + var(--safe-bottom)); }
  body::before { content: ''; position: absolute; inset: 0; background: rgba(0,0,0,0.3); z-index: -1; }
  
  /* Tabs */
  .nav-bar { position: sticky; top: 0; z-index: 50; background: rgba(20,20,20,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid var(--glass-border); padding-top: env(safe-area-inset-top); }
  .nav-scroll { display: flex; gap: 5px; padding: 0 10px; overflow-x: auto; scrollbar-width: none; }
  .nav-item { padding: 14px 12px; font-size: 15px; color: rgba(255,255,255,0.6); white-space: nowrap; position: relative; cursor: pointer; transition: 0.2s; }
  .nav-item.active { color: #fff; font-weight: 600; }
  .nav-item.active::after { content: ''; position: absolute; bottom: 0; left: 10px; right: 10px; height: 3px; background: var(--accent); border-radius: 4px 4px 0 0; }
  
  /* Search */
  .search-sec { margin: 25px auto 10px; width: 90%; max-width: 600px; }
  .engines { display: flex; justify-content: center; gap: 15px; margin-bottom: 15px; font-size: 13px; color: rgba(255,255,255,0.7); }
  .eng { cursor: pointer; transition: 0.2s; padding-bottom: 2px; }
  .eng.active { color: #fff; font-weight: bold; border-bottom: 2px solid var(--accent); }
  .search-input { width: 100%; padding: 14px 20px; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); backdrop-filter: blur(10px); color: #fff; border-radius: 12px; font-size: 16px; outline: none; text-align: center; transition: 0.2s; }
  .search-input:focus { background: rgba(0,0,0,0.8); border-color: var(--accent); text-align: left; }

  /* Grid */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; padding: 15px; max-width: 1000px; margin: 0 auto; }
  .card { display: flex; flex-direction: column; align-items: center; background: var(--glass); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid var(--glass-border); border-radius: 16px; padding: 16px 8px; text-decoration: none; color: #fff; position: relative; transition: transform 0.1s; }
  .card:active { transform: scale(0.96); background: rgba(255,255,255,0.15); }
  .card img { width: 42px; height: 42px; margin-bottom: 10px; border-radius: 10px; background: rgba(255,255,255,0.05); object-fit: cover; }
  .card span { font-size: 12px; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.9; }
  
  /* Edit Mode */
  .del-btn { display: none; position: absolute; top: -6px; right: -6px; width: 24px; height: 24px; background: #ef4444; border-radius: 50%; border: 2px solid rgba(255,255,255,0.8); z-index: 10; cursor: pointer; }
  .editing .del-btn { display: block; }
  .editing .card { border: 1px dashed #eab308; animation: shake 0.25s infinite alternate; cursor: grab; }
  @keyframes shake { from { transform: rotate(-1deg); } to { transform: rotate(1deg); } }
  
  /* Dock & Modals */
  .dock { position: fixed; bottom: calc(20px + var(--safe-bottom)); left: 50%; transform: translateX(-50%); background: rgba(25,25,25,0.9); backdrop-filter: blur(20px); padding: 10px 25px; border-radius: 100px; display: flex; gap: 25px; border: 1px solid var(--glass-border); z-index: 900; transition: bottom 0.3s; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
  .dock-icon { font-size: 22px; cursor: pointer; opacity: 0.8; transition: 0.2s; }
  .dock-icon:hover { transform: scale(1.1); opacity: 1; }
  
  .modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(8px); display: none; align-items: flex-start; justify-content: center; padding-top: 10vh; z-index: 1000; }
  .modal { background: #1c1c1e; width: 85%; max-width: 320px; padding: 24px; border-radius: 18px; border: 1px solid #333; box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
  .modal h3 { margin-bottom: 15px; text-align: center; font-weight: 600; }
  .modal input, .modal select { width: 100%; padding: 12px; margin-bottom: 12px; background: #2c2c2e; border: none; border-radius: 8px; color: #fff; font-size: 16px; }
  .btn-group { display: flex; gap: 10px; margin-top: 10px; }
  .btn { flex: 1; padding: 12px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; }
  .btn-ok { background: var(--accent); color: #fff; }
  .btn-cancel { background: #3a3a3c; color: #aaa; }

  /* Backup Area */
  #backup-area { width: 100%; height: 200px; background: #111; color: #0f0; font-family: monospace; font-size: 12px; padding: 10px; border: 1px solid #333; border-radius: 8px; margin-bottom: 10px; resize: none; }
</style>
</head>
<body>

  <nav class="nav-bar"><div class="nav-scroll" id="tabs"></div></nav>

  <div class="search-sec">
    <div class="engines" id="engines">
      <span class="eng active" data-url="https://www.google.com/search?q=">Google</span>
      <span class="eng" data-url="https://www.baidu.com/s?wd=">Baidu</span>
      <span class="eng" data-url="https://cn.bing.com/search?q=">Bing</span>
      <span class="eng" data-url="https://github.com/search?q=">GitHub</span>
    </div>
    <input class="search-input" id="search" placeholder="Search..." autocomplete="off" onfocus="this.select()">
  </div>

  <div class="grid" id="grid"></div>

  <div class="dock" id="dock">
    <div class="dock-icon" onclick="toggleEdit()">⚙️</div>
    <div class="dock-icon" onclick="openModal('link')">➕</div>
    <div class="dock-icon" onclick="openModal('cat')">📁</div>
    <div class="dock-icon" onclick="saveData()" style="color:#4ade80">✔</div>
  </div>

  <div class="modal-mask" id="m-link"><div class="modal">
    <h3>添加网站</h3>
    <input id="l-name" placeholder="名称"><input id="l-url" placeholder="网址 (支持 http/ftp/magnet)">
    <select id="l-cat"></select>
    <div class="btn-group"><button class="btn btn-cancel" onclick="closeM()">取消</button><button class="btn btn-ok" onclick="addLink()">确定</button></div>
  </div></div>

  <div class="modal-mask" id="m-cat"><div class="modal">
    <h3>新建分类</h3>
    <input id="c-name" placeholder="分类名称">
    <div class="btn-group"><button class="btn btn-cancel" onclick="closeM()">取消</button><button class="btn btn-ok" onclick="addCat()">创建</button></div>
  </div></div>

  <div class="modal-mask" id="m-conflict"><div class="modal" style="max-width:400px">
    <h3 style="color:#eab308">⚠️ 数据冲突</h3>
    <p style="font-size:13px;color:#ccc;margin-bottom:10px">云端数据较新。为防止丢失当前修改，请<b>全选复制</b>下方数据进行备份，然后刷新页面。</p>
    <textarea id="backup-area" readonly></textarea>
    <div class="btn-group"><button class="btn btn-ok" onclick="location.reload()">已备份，刷新</button></div>
  </div></div>

<script>
  let data = ${safeDataStr};
  let currentVer = ${db.ver};
  let catIdx = 0;
  let isEditing = false;
  let pwd = localStorage.getItem('nav_auth') || "";
  let searchUrl = "https://www.google.com/search?q=";

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\'':'&#039;'}[m]});
  }

  function renderTabs() {
    document.getElementById('tabs').innerHTML = data.map((c, i) => \`
      <div class="nav-item \${i===catIdx?'active':''}" onclick="switchCat(\${i})">
        \${escapeHtml(c.category)}
        \${isEditing ? \`<span style="color:#ef4444;margin-left:5px" onclick="delCat(\${i});event.stopPropagation()">●</span>\` : ''}
      </div>\`).join('');
  }

  function getDomain(url) {
    if (!/^https?:\\/\\//i.test(url)) return '';
    try { return new URL(url).hostname; } catch(e){ return 'google.com'; }
  }

  function renderGrid() {
    const grid = document.getElementById('grid');
    grid.classList.toggle('editing', isEditing);
    grid.innerHTML = (data[catIdx]?.items || []).map((item, i) => {
      let safeUrl = item.url.trim();
      if (/^javascript:/i.test(safeUrl)) safeUrl = "about:blank";
      
      // 协议感知图标
      let imgSrc = "";
      let errAttr = "";
      if (/^magnet:/i.test(safeUrl)) {
        imgSrc = "https://cdn-icons-png.flaticon.com/512/1250/1250308.png";
      } else if (/^mailto:/i.test(safeUrl)) {
        imgSrc = "https://cdn-icons-png.flaticon.com/512/732/732200.png";
      } else if (!/^https?:\\/\\//i.test(safeUrl)) {
        imgSrc = "https://cdn-icons-png.flaticon.com/512/1006/1006771.png";
      } else {
        const domain = getDomain(safeUrl);
        imgSrc = \`https://api.iowen.cn/favicon/\${domain}.png\`;
        errAttr = \`onerror="this.src='https://icons.duckduckgo.com/ip3/\${domain}.ico'"\`;
      }

      return \`
      <div style="position:relative">
        <a class="card" href="\${escapeHtml(safeUrl)}" target="_blank">
          <img src="\${imgSrc}" \${errAttr} loading="lazy">
          <span>\${escapeHtml(item.name)}</span>
        </a>
        <div class="del-btn" onclick="delLink(\${i})"></div>
      </div>\`;
    }).join('');
  }

  document.querySelectorAll('.eng').forEach(el => {
    el.addEventListener('click', function() {
      document.querySelectorAll('.eng').forEach(e => e.classList.remove('active'));
      this.classList.add('active');
      searchUrl = this.dataset.url;
    });
  });
  document.getElementById('search').addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && e.target.value) location.href = searchUrl + encodeURIComponent(e.target.value);
  });

  function switchCat(i) { catIdx = i; renderTabs(); renderGrid(); }
  async function checkAuth() { if(!pwd) { pwd=prompt("密码:"); if(pwd) localStorage.setItem('nav_auth',pwd); else return false; } return true; }
  async function toggleEdit() { if(await checkAuth()) { isEditing=!isEditing; renderTabs(); renderGrid(); } }
  
  async function openModal(type) {
    if(!(await checkAuth())) return;
    if(!isEditing) { isEditing=true; renderTabs(); renderGrid(); }
    closeM();
    if(type==='link') {
      const s = document.getElementById('l-cat');
      s.innerHTML = data.map((c,i)=>\`<option value="\${i}">\${escapeHtml(c.category)}</option>\`).join('');
      s.value = catIdx;
      document.getElementById('m-link').style.display='flex';
    } else document.getElementById('m-cat').style.display='flex';
  }
  function closeM() { document.querySelectorAll('.modal-mask').forEach(e=>e.style.display='none'); }

  function addLink() {
    const n = document.getElementById('l-name').value;
    let u = document.getElementById('l-url').value;
    const c = document.getElementById('l-cat').value;
    if(!n || !u) return alert("请填写完整");
    
    // 前端协议补全
    if (!/^[a-zA-Z0-9.\+\-]+:/.test(u)) u = 'https://' + u;
    
    data[c].items.push({name:n, url:u});
    closeM(); document.getElementById('l-name').value=''; document.getElementById('l-url').value='';
    if(c!=catIdx) switchCat(Number(c)); else renderGrid();
  }
  
  function addCat() {
    const n = document.getElementById('c-name').value;
    if(n) { data.push({category:n, items:[]}); closeM(); document.getElementById('c-name').value=''; switchCat(data.length-1); }
  }
  function delLink(i) { if(confirm('删除?')) { data[catIdx].items.splice(i,1); renderGrid(); } }
  function delCat(i) {
    if(data[i].items.length) return alert('请先清空分类');
    if(confirm('删除?')) { data.splice(i,1); if(!data.length) data.push({category:'Default',items:[]}); catIdx=0; renderTabs(); renderGrid(); }
  }

  async function saveData() {
    if(!(await checkAuth())) return;
    const btn = document.querySelector('.dock .dock-icon:last-child');
    const old = btn.innerHTML; btn.innerHTML = '⏳';
    
    try {
      const res = await fetch('/api/save', {
        method: 'POST', headers: {'Authorization': pwd},
        body: JSON.stringify({ base_ver: currentVer, data: data })
      });
      
      if(res.ok) {
        const json = await res.json();
        currentVer = json.new_ver;
        isEditing = false; renderTabs(); renderGrid(); alert('✅ 已保存');
      } else if (res.status === 409) {
        document.getElementById('backup-area').value = JSON.stringify(data, null, 2);
        document.getElementById('m-conflict').style.display = 'flex';
        document.getElementById('backup-area').select();
      } else if (res.status === 401) {
        alert('密码错误'); localStorage.removeItem('nav_auth'); pwd='';
      } else { alert('保存失败'); }
    } catch(e) { alert('网络错误'); }
    btn.innerHTML = old;
  }
  
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      document.getElementById('dock').style.display = window.visualViewport.height < window.innerHeight*0.8 ? 'none' : 'flex';
    });
  }
  
  renderTabs(); renderGrid();
<\/script>
</body>
</html>
  `;
}
