/**
 * src/ui.js
 * Server-Side Rendering (SSR) for Navigation & Admin Dashboard
 * 包含：前台导航 + 后台管理 + 登录弹窗 + Tailwind CSS
 */

export function renderUI(navData, config) {
  const { TITLE, BG_IMAGE } = config;
  const safeData = JSON.stringify(navData).replace(/</g, '\\u003c');
  const safeConfig = JSON.stringify(config).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="zh-CN" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${TITLE}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: { extend: { colors: { primary: '#3b82f6', dark: '#0f172a' } } }
    }
  </script>
  <style>
    /* 自定义滚动条 & 玻璃拟态 */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
    .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
    .card-hover { transition: all 0.3s ease; }
    .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 20px -10px rgba(0,0,0,0.5); border-color: #3b82f6; }
  </style>
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen font-sans selection:bg-blue-500 selection:text-white"
      style="${BG_IMAGE ? `background-image: linear-gradient(to bottom, rgba(17,24,39,0.9), rgba(17,24,39,0.95)), url('${BG_IMAGE}'); background-size: cover; background-attachment: fixed;` : ''}">

  <!-- 1. 顶部导航栏 -->
  <nav class="fixed top-0 w-full z-50 glass border-b-0 border-white/5">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">N</div>
          <span class="font-bold text-xl tracking-tight">${TITLE}</span>
        </div>
        <div class="flex items-center gap-4">
          <button onclick="toggleLogin()" class="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </button>
        </div>
      </div>
    </div>
  </nav>

  <!-- 2. 主内容区 -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
    <!-- 搜索框 -->
    <div class="max-w-2xl mx-auto mb-12">
      <div class="relative group">
        <div class="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-30 group-hover:opacity-75 transition duration-1000"></div>
        <div class="relative">
          <input type="text" id="searchInput" placeholder="Search anything..." 
                 class="w-full bg-gray-900/90 text-white border border-gray-700 rounded-xl px-5 py-4 pl-12 focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-gray-500 shadow-xl"
                 onkeyup="filterLinks()">
          <svg class="absolute left-4 top-4.5 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>
    </div>

    <!-- 链接分类列表 -->
    <div id="content-area" class="space-y-12">
      <!-- JS 渲染内容将注入这里 -->
    </div>
  </main>

  <!-- 3. 后台管理面板 (默认隐藏) -->
  <div id="admin-panel" class="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-sm hidden overflow-y-auto">
    <div class="max-w-4xl mx-auto p-6 min-h-screen flex flex-col justify-center">
      <div class="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl p-8">
        <div class="flex justify-between items-center mb-8">
          <h2 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">Manage Navigation</h2>
          <div class="flex gap-3">
             <button onclick="logout()" class="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition">Logout</button>
             <button onclick="toggleLogin()" class="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition">Close</button>
          </div>
        </div>

        <!-- 登录表单 -->
        <div id="login-form" class="max-w-sm mx-auto space-y-4 py-10">
          <div class="text-center mb-4 text-gray-400">Enter Admin Password</div>
          <input type="password" id="password" class="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none" placeholder="Password">
          <button onclick="doLogin()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition shadow-lg shadow-blue-500/30">Login</button>
        </div>

        <!-- 管理界面 (登录后显示) -->
        <div id="dashboard" class="hidden space-y-8">
          <!-- 添加链接 -->
          <div class="p-6 bg-gray-900/50 rounded-xl border border-gray-700/50">
            <h3 class="text-lg font-semibold mb-4 text-blue-400">Add New Link</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select id="new-cat" class="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white"></select>
              <input id="new-title" placeholder="Title" class="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white">
              <input id="new-url" placeholder="URL (https://...)" class="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white md:col-span-2">
              <input id="new-desc" placeholder="Description (Optional)" class="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white md:col-span-2">
            </div>
            <div class="mt-4 flex justify-end">
              <button onclick="addLink()" class="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition">Add Link</button>
            </div>
          </div>
          
          <!-- 添加分类 -->
          <div class="p-6 bg-gray-900/50 rounded-xl border border-gray-700/50 flex gap-4 items-center">
             <input id="new-cat-title" placeholder="New Category Name" class="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white">
             <button onclick="addCategory()" class="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium whitespace-nowrap">Add Category</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 4. 客户端逻辑 -->
  <script>
    const INITIAL_DATA = ${safeData};
    const CONFIG = ${safeConfig};
    let token = localStorage.getItem('nav_token') || '';
    
    // 初始化渲染
    function init() {
      renderContent(INITIAL_DATA);
      if(token) checkAuth();
    }

    // 渲染卡片列表
    function renderContent(data) {
      const container = document.getElementById('content-area');
      container.innerHTML = data.map(cat => {
        if(!cat.items || cat.items.length === 0) return '';
        return \`
          <div class="category-section">
            <div class="flex items-center gap-3 mb-6 px-2">
              <h2 class="text-xl font-bold text-gray-200">\${cat.title}</h2>
              <div class="h-px flex-1 bg-gradient-to-r from-gray-700 to-transparent"></div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              \${cat.items.map(link => \`
                <a href="\${link.url}" target="_blank" rel="noopener" class="group block p-4 bg-gray-800/40 hover:bg-gray-800/80 border border-gray-700/50 rounded-xl card-hover relative overflow-hidden">
                  <div class="flex items-start gap-4 relative z-10">
                    \${link.icon ? \`<img src="\${link.icon}" class="w-10 h-10 rounded-lg object-contain bg-gray-900/50 p-1">\` : \`
                    <div class="w-10 h-10 rounded-lg bg-gray-700/50 flex items-center justify-center text-lg">\${link.title.charAt(0)}</div>\`}
                    <div class="flex-1 min-w-0">
                      <h3 class="font-medium text-gray-200 group-hover:text-blue-400 truncate transition-colors">\${link.title}</h3>
                      <p class="text-sm text-gray-500 truncate mt-1">\${link.description || extractDomain(link.url)}</p>
                    </div>
                  </div>
                </a>
              \`).join('')}
            </div>
          </div>
        \`;
      }).join('');
    }

    // 辅助：提取域名
    function extractDomain(url) {
      try { return new URL(url).hostname; } catch { return url; }
    }

    // 搜索功能
    function filterLinks() {
      const q = document.getElementById('searchInput').value.toLowerCase();
      if(!q) return renderContent(INITIAL_DATA);
      
      const filtered = INITIAL_DATA.map(cat => ({
        ...cat,
        items: cat.items.filter(item => 
          item.title.toLowerCase().includes(q) || 
          (item.description && item.description.toLowerCase().includes(q)) ||
          item.url.toLowerCase().includes(q)
        )
      })).filter(cat => cat.items.length > 0);
      
      renderContent(filtered);
    }

    // --- 后台管理逻辑 ---

    function toggleLogin() {
      const panel = document.getElementById('admin-panel');
      panel.classList.toggle('hidden');
      if(token && !panel.classList.contains('hidden')) loadAdminData();
    }

    async function doLogin() {
      const pwd = document.getElementById('password').value;
      // 简单请求测试
      const res = await apiCall('/api/auth/verify', 'POST', {}, pwd);
      if(res.status === 'ok') {
        token = pwd; // 简单模式直接用密码当 Token
        localStorage.setItem('nav_token', token);
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        loadAdminData();
      } else {
        alert('Invalid Password');
      }
    }

    function logout() {
      token = '';
      localStorage.removeItem('nav_token');
      location.reload();
    }

    function checkAuth() {
      apiCall('/api/auth/verify', 'POST').then(res => {
        if(res.status === 'ok') {
          document.getElementById('login-form').classList.add('hidden');
          document.getElementById('dashboard').classList.remove('hidden');
        } else {
          logout();
        }
      });
    }

    async function loadAdminData() {
      // 刷新分类下拉框
      const res = await apiCall('/api/data'); // 获取全部数据(含私有)
      if(!res.nav) return;
      const select = document.getElementById('new-cat');
      select.innerHTML = res.nav.map(c => \`<option value="\${c.id}">\${c.title}</option>\`).join('');
    }

    async function addLink() {
      const body = {
        category_id: parseInt(document.getElementById('new-cat').value),
        title: document.getElementById('new-title').value,
        url: document.getElementById('new-url').value,
        description: document.getElementById('new-desc').value
      };
      if(!body.title || !body.url) return alert('Title and URL required');
      
      const res = await apiCall('/api/link', 'POST', body);
      if(res.success !== false) {
        alert('Link Added!');
        location.reload(); // 简单粗暴刷新页面
      } else {
        alert('Error: ' + res.error);
      }
    }

    async function addCategory() {
      const title = document.getElementById('new-cat-title').value;
      if(!title) return;
      const res = await apiCall('/api/category', 'POST', { title });
      if(res.success !== false) {
        alert('Category Added!');
        loadAdminData();
        document.getElementById('new-cat-title').value = '';
      }
    }

    // 通用 API 调用
    async function apiCall(path, method = 'GET', body = null, tempToken = null) {
      const headers = { 
        'Authorization': 'Bearer ' + (tempToken || token),
        'Content-Type': 'application/json'
      };
      const opts = { method, headers };
      if(body) opts.body = JSON.stringify(body);
      
      try {
        const res = await fetch(path, opts);
        if(res.status === 401) { logout(); return { error: 'Unauthorized' }; }
        return await res.json();
      } catch(e) {
        console.error(e);
        return { error: e.message };
      }
    }

    // 启动
    init();
  </script>
</body>
</html>`;
}
