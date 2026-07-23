/**
 * public/client.js - 客户端交互逻辑
 * 分类切换 + 搜索 + SortableJS + 主题 + CRUD + 点击上报
 */
(function () {
  'use strict';
  const state = window.__NAV_STATE__ || { data: [], config: {}, isRoot: false, isAdmin: false };
  let token = ''; // API Token (非 Cookie 环境备用)
  let isAdmin = state.isAdmin || false;
  let currentCatIdx = 0;
  let currentSubId = null; // 当前选中的子分类 ID
  let sortMode = false;
  let sortableInstances = [];

  // ── 工具函数 ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const api = async (path, opts = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    opts.credentials = 'include'; // 强制携带 Cookie
    const res = await fetch(path, { ...opts, headers });
    if (res.status === 401 || res.status === 403) {
      const searchInput = $('#search-input');
      if (searchInput) searchInput.value = '';
      window.location.reload();
      return;
    }
    return res.json();
  };

  function toast(msg, type = 'info') {
    const container = $('#toast-container');
    if (!container) return;
    const cls = { success: 'alert-success', error: 'alert-error', info: 'alert-info' }[type] || 'alert-info';
    const el = document.createElement('div');
    el.className = 'alert ' + cls + ' text-sm shadow-lg';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.remove(); }, 3000);
  }

  // ── 鉴权 ──
  async function checkAuth() {
    if (isAdmin) {
      loadAdminScripts();
    }
  }

  function loadAdminScripts() {
    if (typeof Sortable !== 'undefined' || document.getElementById('sortable-script')) return;
    const script = document.createElement('script');
    script.id = 'sortable-script';
    script.src = "https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js";
    document.head.appendChild(script);
  }

  // ── 渲染 ──
  function renderAll() {
    renderNav();
    renderGrid();
    renderDock();
  }

  function renderNav() {
    const scroll = $('#nav-scroll');
    if (!scroll) return;
    scroll.className = 'flex gap-7 px-6 overflow-x-auto scrollbar-hide max-w-full';
    scroll.innerHTML = state.data.map((cat, i) => {
      const active = i === currentCatIdx;
      const hasChildren = cat.children && cat.children.length > 0;
      return '<button type="button" class="nav-tab whitespace-nowrap text-base font-medium transition-all duration-200 border-b-2 pb-1.5 px-1 ' +
        (active ? 'text-primary border-primary opacity-100' : 'text-base-content/60 border-transparent opacity-70 hover:opacity-100') +
        '" data-idx="' + i + '"' + (hasChildren ? ' data-has-children="1"' : '') +
        '>' + escapeHtml(cat.title) + '</button>';
    }).join('');

    // 预渲染所有有子分类的下拉到容器中（默认隐藏）
    const dropdownContainer = $('#sub-dropdown-container');
    if (!dropdownContainer) return;
    dropdownContainer.innerHTML = '';
    state.data.forEach((cat, i) => {
      if (!cat.children || cat.children.length === 0) return;
      const dd = document.createElement('div');
      dd.className = 'sub-dropdown';
      dd.dataset.parentIdx = String(i);
      dd.innerHTML = cat.children.map(ch =>
        '<button type="button" class="sub-dropdown-item' + (currentSubId === ch.id ? ' sub-dropdown-active' : '') +
        '" data-sub-id="' + ch.id + '">' + escapeHtml(ch.title) + '</button>'
      ).join('');
      dropdownContainer.appendChild(dd);
    });

    // hover 显隐逻辑
    bindSubDropdownHover(scroll, dropdownContainer);
  }

  // 子分类交互绑定（hover + touch）
  let _subDropdownBound = false;
  function bindSubDropdownHover(scroll, container) {
    if (_subDropdownBound) return; // 防止重复绑定
    _subDropdownBound = true;

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    let hideTimer = null;
    let activeDropdownIdx = -1;

    function showDropdown(tabIdx) {
      clearTimeout(hideTimer);
      activeDropdownIdx = tabIdx;
      container.querySelectorAll('.sub-dropdown').forEach(dd => {
        const show = dd.dataset.parentIdx === String(tabIdx);
        dd.classList.toggle('sub-dropdown-visible', show);
        if (show) {
          const tab = scroll.querySelectorAll('.nav-tab')[tabIdx];
          if (tab) {
            const tabRect = tab.getBoundingClientRect();
            const contRect = container.getBoundingClientRect();
            const ddWidth = dd.offsetWidth;
            const tabCenter = tabRect.left + tabRect.width / 2 - contRect.left;
            // 边界钳制：不超出容器左右边缘（留 8px 安全距离）
            const minLeft = ddWidth / 2 + 8;
            const maxLeft = contRect.width - ddWidth / 2 - 8;
            dd.style.left = Math.max(minLeft, Math.min(maxLeft, tabCenter)) + 'px';
          }
        }
      });
    }

    function hideAll() {
      hideTimer = setTimeout(() => {
        activeDropdownIdx = -1;
        container.querySelectorAll('.sub-dropdown').forEach(dd => {
          dd.classList.remove('sub-dropdown-visible');
        });
      }, 150);
    }

    function hideAllImmediate() {
      clearTimeout(hideTimer);
      activeDropdownIdx = -1;
      container.querySelectorAll('.sub-dropdown').forEach(dd => {
        dd.classList.remove('sub-dropdown-visible');
      });
    }

    if (isTouchDevice) {
      // 移动端：点击 tab 切换显隐
      scroll.addEventListener('click', function (e) {
        const tab = e.target.closest('.nav-tab');
        if (tab && tab.dataset.hasChildren) {
          const idx = parseInt(tab.dataset.idx);
          if (activeDropdownIdx === idx) {
            hideAllImmediate();
          } else {
            showDropdown(idx);
          }
        } else {
          hideAllImmediate();
        }
      });
      // 点击页面其他区域关闭
      document.addEventListener('click', function (e) {
        if (!e.target.closest('#nav-scroll') && !e.target.closest('#sub-dropdown-container')) {
          hideAllImmediate();
        }
      });
    } else {
      // 桌面端：hover 显隐
      scroll.addEventListener('mouseenter', function (e) {
        const tab = e.target.closest('.nav-tab');
        if (tab && tab.dataset.hasChildren) {
          showDropdown(parseInt(tab.dataset.idx));
        } else if (tab) {
          hideAllImmediate();
        }
      }, true);

      scroll.addEventListener('mouseleave', hideAll);

      container.addEventListener('mouseenter', function () {
        clearTimeout(hideTimer);
      });
      container.addEventListener('mouseleave', hideAll);
    }
  }

  function renderGrid() {
    const container = $('#link-sections');
    if (!container) return;
    container.innerHTML = state.data.map((cat, i) => {
      const hidden = i !== currentCatIdx ? 'hidden' : '';
      const hasChildren = cat.children && cat.children.length > 0;

      // 父分类自身链接
      const showParent = !currentSubId || !hasChildren;
      let gridsHtml = '<div id="grid-' + cat.id + '" class="sub-grid grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3' +
        (showParent ? '' : ' hidden') + '" data-sub-id="' + cat.id + '">' +
        cat.items.map(link => linkCardHtml(link)).join('') +
        '</div>';

      // 子分类链接
      if (hasChildren) {
        gridsHtml += cat.children.map(ch =>
          '<div id="grid-' + ch.id + '" class="sub-grid grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3' +
          (currentSubId === ch.id ? '' : ' hidden') + '" data-sub-id="' + ch.id + '">' +
          ch.items.map(link => linkCardHtml(link)).join('') +
          '</div>'
        ).join('');
      }

      const activeSubItems = currentSubId && hasChildren
        ? (cat.children.find(ch => ch.id === currentSubId)?.items || [])
        : cat.items;
      const emptyMsg = activeSubItems.length === 0 ? '<div class="text-center text-base-content/30 py-16 text-sm">暂无链接</div>' : '';

      return '<section class="cat-section ' + hidden + '" data-cat-id="' + cat.id + '">' +
        gridsHtml + emptyMsg +
        '</section>';
    }).join('') +
      '<section id="search-results" class="hidden"><div id="search-results-grid" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3"></div>' +
      '<div id="search-empty" class="text-center text-base-content/30 py-16 text-sm hidden">未找到匹配的链接</div></section>';
  }

  function linkCardHtml(link) {
    const iconSrc = link.icon || ('/api/icon?domain=' + encodeURIComponent(new URL(link.url).hostname));
    const adminBtns = isAdmin ? '<div class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">' +
      '<button type="button" class="btn btn-ghost btn-xs btn-circle edit-link-btn text-xs" data-link-id="' + link.id + '">✏️</button>' +
      '<button type="button" class="btn btn-ghost btn-xs btn-circle delete-link-btn text-xs" data-link-id="' + link.id + '">🗑️</button></div>' : '';
    const desc = link.description ? escapeHtml(link.description) : '';
    const tooltipCls = desc ? ' tooltip tooltip-top' : '';
    const tooltipAttr = desc ? ' data-tip="' + desc + '"' : '';
    return '<a href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener noreferrer" ' +
      'class="link-card glass-card rounded-3xl p-4 flex flex-col items-center justify-center gap-3 group cursor-pointer no-underline relative aspect-square' + tooltipCls + '" ' +
      tooltipAttr +
      'data-link-id="' + link.id + '" data-cat-id="' + link.category_id + '" data-title="' + escapeHtml(link.title) + '" data-url="' + escapeHtml(link.url) + '">' +
      adminBtns +
      '<div class="w-14 h-14 flex items-center justify-center flex-shrink-0">' +
      '<img src="' + escapeHtml(iconSrc) + '" alt="" class="w-10 h-10 object-contain" loading="lazy" onerror="var l=(\'' + escapeHtml(link.title) + '\').charAt(0).toUpperCase()||\'?\';var h=(l.charCodeAt(0)*37)%360;this.onerror=null;this.src=\'data:image/svg+xml,\'+encodeURIComponent(\'<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;64&quot; height=&quot;64&quot; viewBox=&quot;0 0 64 64&quot;><rect width=&quot;64&quot; height=&quot;64&quot; rx=&quot;14&quot; fill=&quot;hsl(\'+h+\',60%,50%)&quot;/><text x=&quot;32&quot; y=&quot;32&quot; font-family=&quot;system-ui,sans-serif&quot; font-size=&quot;30&quot; font-weight=&quot;600&quot; fill=&quot;white&quot; text-anchor=&quot;middle&quot; dominant-baseline=&quot;central&quot;>\'+l+\'</text></svg>\')"></div>' +
      '<div class="text-xs font-medium text-center text-base-content/80 truncate w-full leading-tight">' +
      (link.is_private ? '🔒 ' : '') + escapeHtml(link.title) + '</div>' +
      '</a>';
  }

  function renderDock() {
    const existing = $('.floating-dock');
    if (existing) existing.remove();
    // Also remove any legacy DaisyUI dock
    const legacyDock = $('.dock');
    if (legacyDock) legacyDock.remove();
    const dock = document.createElement('div');
    dock.className = 'floating-dock';
    const inner = document.createElement('div');
    inner.className = 'flex items-center justify-center gap-1';
    if (!isAdmin) {
      const isGhostAdmin = window.location.pathname === '/admin' || window.location.search.includes('admin');
      const loginBtn = isGhostAdmin ? '<button type="button" id="btn-login" class="dock-item"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg><span class="dock-text">登录</span></button>' : '';
      
      inner.innerHTML = loginBtn +
        '<button type="button" id="btn-theme-toggle" class="dock-item"><svg id="icon-moon" class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg><svg id="icon-sun" class="dock-icon hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg><span class="dock-text">主题</span></button>' +
        '<a href="https://github.com/skfoa/cf-worker-nav" target="_blank" rel="noopener" class="dock-item"><svg class="dock-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg><span class="dock-text">仓库</span></a>';
    } else {
      inner.innerHTML =
        '<button type="button" id="btn-add-link" class="dock-item"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg><span class="dock-text">添加</span></button>' +
        '<button type="button" id="btn-add-cat" class="dock-item"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7h4l3-3h10a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1z"/></svg><span class="dock-text">分类</span></button>' +
        '<button type="button" id="btn-toggle-sort" class="dock-item"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg><span class="dock-text">排序</span></button>' +
        '<button type="button" id="btn-settings" class="dock-item"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span class="dock-text">设置</span></button>' +
        '<button type="button" id="btn-logs" class="dock-item"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><span class="dock-text">日志</span></button>' +
        '<button type="button" id="btn-logout" class="dock-item"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg><span class="dock-text">退出</span></button>' +
        '<button type="button" id="btn-theme-toggle" class="dock-item"><svg id="icon-moon" class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg><svg id="icon-sun" class="dock-icon hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg><span class="dock-text">主题</span></button>' +
        '<a href="https://github.com/skfoa/cf-worker-nav" target="_blank" rel="noopener" class="dock-item"><svg class="dock-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg><span class="dock-text">仓库</span></a>';
    }
    dock.appendChild(inner);
    document.body.appendChild(dock);
    bindDockEvents();
    updateThemeIcons(document.documentElement.getAttribute('data-theme') || 'dark');
  }

  // ── 分类切换 ──
  document.addEventListener('click', function (e) {
    const tab = e.target.closest('.nav-tab');
    if (tab) {
      const idx = parseInt(tab.dataset.idx);
      if (isNaN(idx)) return;
      currentCatIdx = idx;
      currentSubId = null;
      // 更新 tab 样式
      $$('.nav-tab').forEach((t, i) => {
        const isActive = i === idx;
        t.classList.toggle('text-primary', isActive);
        t.classList.toggle('border-primary', isActive);
        t.classList.toggle('opacity-100', isActive);
        t.classList.toggle('text-base-content/60', !isActive);
        t.classList.toggle('border-transparent', !isActive);
        t.classList.toggle('opacity-70', !isActive);
      });
      // 更新 sub-dropdown active 状态
      $$('.sub-dropdown-item').forEach(i => i.classList.remove('sub-dropdown-active'));
      $$('.cat-section').forEach((s, i) => s.classList.toggle('hidden', i !== idx));
      const activeSection = $$('.cat-section')[idx];
      if (activeSection) {
        activeSection.querySelectorAll('.sub-grid, .grid-empty-msg').forEach(el => {
          const isTarget = currentSubId ? (parseInt(el.dataset.subId) === currentSubId) : (parseInt(el.dataset.subId) === parseInt(activeSection.dataset.catId));
          el.classList.toggle('hidden', !isTarget);
        });
      }
      $('#search-results')?.classList.add('hidden');
      const searchInput = $('#search-input');
      if (searchInput) searchInput.value = '';
      $('#search-clear')?.classList.add('hidden');
      if (sortMode) { disableSort(); enableSort(); }
      return;
    }

    // 子分类下拉项点击
    const subItem = e.target.closest('.sub-dropdown-item');
    if (subItem) {
      const subId = parseInt(subItem.dataset.subId);
      currentSubId = (currentSubId === subId) ? null : subId;
      
      // 切换父分类 tab 和 section 如果不同
      const parentIdx = parseInt(subItem.closest('.sub-dropdown').dataset.parentIdx);
      if (currentCatIdx !== parentIdx) {
        currentCatIdx = parentIdx;
        $$('.nav-tab').forEach((t, i) => {
          const isActive = i === currentCatIdx;
          t.classList.toggle('text-primary', isActive);
          t.classList.toggle('border-primary', isActive);
          t.classList.toggle('opacity-100', isActive);
          t.classList.toggle('text-base-content/60', !isActive);
          t.classList.toggle('border-transparent', !isActive);
          t.classList.toggle('opacity-70', !isActive);
        });
        $$('.cat-section').forEach((s, i) => s.classList.toggle('hidden', i !== currentCatIdx));
        $('#search-results')?.classList.add('hidden');
        const searchInput = $('#search-input');
        if (searchInput) searchInput.value = '';
        $('#search-clear')?.classList.add('hidden');
      }

      // 更新 active 状态
      $$('.sub-dropdown-item').forEach(i => {
        i.classList.toggle('sub-dropdown-active', parseInt(i.dataset.subId) === currentSubId);
      });
      const activeSection = $$('.cat-section')[currentCatIdx];
      if (activeSection) {
        activeSection.querySelectorAll('.sub-grid, .grid-empty-msg').forEach(el => {
          const isTarget = currentSubId ? (parseInt(el.dataset.subId) === currentSubId) : (parseInt(el.dataset.subId) === parseInt(activeSection.dataset.catId));
          el.classList.toggle('hidden', !isTarget);
        });
      }
      if (sortMode) { disableSort(); enableSort(); }
    }
  });

  // ── 搜索引擎切换 ──
  let currentEngine = localStorage.getItem('nav_engine') || 'google';
  let currentEngineUrl = 'https://www.google.com/search?q=';

  function initSearchEngines() {
    const tabs = $$('.search-engine-tab');
    tabs.forEach(tab => {
      if (tab.dataset.engine === currentEngine) {
        currentEngineUrl = tab.dataset.url;
      }
      tab.addEventListener('click', function () {
        currentEngine = this.dataset.engine;
        currentEngineUrl = this.dataset.url;
        localStorage.setItem('nav_engine', currentEngine);
        tabs.forEach(t => {
          t.className = t.dataset.engine === currentEngine
            ? 'search-engine-tab px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-primary-content shadow-md shadow-primary/30'
            : 'search-engine-tab px-4 py-1.5 rounded-full text-sm font-medium text-base-content/50 hover:text-base-content/80';
        });
        const input = $('#search-input');
        if (input) {
          input.placeholder = currentEngine === 'local' ? '站内搜索...' : input.dataset?.placeholder || '搜索...';
          if (currentEngine === 'local' && input.value.trim()) {
            input.dispatchEvent(new Event('input'));
          } else if (currentEngine !== 'local') {
            $$('.cat-section').forEach((s, i) => s.classList.toggle('hidden', i !== currentCatIdx));
            $('#search-results')?.classList.add('hidden');
          }
        }
      });
    });
    // 应用保存的选择
    tabs.forEach(t => {
      t.className = t.dataset.engine === currentEngine
        ? 'search-engine-tab px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-primary-content shadow-md shadow-primary/30'
        : 'search-engine-tab px-4 py-1.5 rounded-full text-sm font-medium text-base-content/50 hover:text-base-content/80';
    });
  }

  // ── 搜索 ──
  const searchInput = $('#search-input');
  const searchClear = $('#search-clear');

  function doSearch() {
    const q = searchInput?.value?.trim();
    if (!q) return;
    if (currentEngine === 'local') {
      // 站内搜索
      searchInput.dispatchEvent(new Event('input'));
    } else {
      // 外部搜索引擎
      window.open(currentEngineUrl + encodeURIComponent(q), '_blank');
    }
  }

  $('#search-go')?.addEventListener('click', doSearch);

  if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch();
      }
    });
    var searchTimer = null;
    searchInput.addEventListener('input', function () {
      var self = this;
      var q = self.value.trim().toLowerCase();
      searchClear?.classList.toggle('hidden', !q);
      if (currentEngine !== 'local' && q) return;
      if (!q) {
        clearTimeout(searchTimer);
        $$('.cat-section').forEach(function (s, i) { s.classList.toggle('hidden', i !== currentCatIdx); });
        $('#search-results')?.classList.add('hidden');
        return;
      }
      // 200ms 防抖
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        $$('.cat-section').forEach(function (s) { s.classList.add('hidden'); });
        var results = $('#search-results');
        var grid = $('#search-results-grid');
        var empty = $('#search-empty');
        if (!results || !grid) return;
        results.classList.remove('hidden');
        var allLinks = getAllLinks();
        // 带权重的搜索：标题匹配权重最高，描述次之，URL 最低
        var scored = [];
        allLinks.forEach(function (l) {
          var title = (l.title || '').toLowerCase();
          var desc = (l.description || '').toLowerCase();
          var url = (l.url || '').toLowerCase();
          var score = 0;
          if (title.includes(q)) score += 100;
          if (desc.includes(q)) score += 10;
          if (url.includes(q)) score += 1;
          if (score > 0) scored.push({ link: l, score: score });
        });
        scored.sort(function (a, b) { return b.score - a.score; });
        grid.innerHTML = scored.map(function (s) { return linkCardHtml(s.link); }).join('');
        empty?.classList.toggle('hidden', scored.length > 0);
      }, 200);
    });
  }
  if (searchClear) {
    searchClear.addEventListener('click', function () {
      if (searchInput) { searchInput.value = ''; searchInput.dispatchEvent(new Event('input')); }
    });
  }

  // ── 点击上报 ──
  document.addEventListener('click', function (e) {
    const card = e.target.closest('.link-card');
    if (card && card.dataset.linkId) {
      fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: parseInt(card.dataset.linkId) })
      }).catch(() => {});
    }
  });

  // ── 主题 ──
  function initTheme() {
    const saved = localStorage.getItem('nav_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcons(saved);
  }
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('nav_theme', next);
    updateThemeIcons(next);
  }
  function updateThemeIcons(theme) {
    const moon = $('#icon-moon');
    const sun = $('#icon-sun');
    if (moon) moon.classList.toggle('hidden', theme === 'light');
    if (sun) sun.classList.toggle('hidden', theme === 'dark');
  }

  // ── 登录 ──
  function doLogin() {
    openModal('',
      '<form id="login-form" class="flex flex-col items-center gap-5 pt-2">' +
      '<div class="w-14 h-14 rounded-2xl flex items-center justify-center" style="background:linear-gradient(135deg,rgba(99,102,241,.2),rgba(139,92,246,.15));border:1px solid rgba(99,102,241,.2)"><svg class="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg></div>' +
      '<div class="text-center"><h3 class="text-lg font-semibold text-base-content/90">管理员登录</h3><p class="text-sm text-base-content/30 mt-1">请输入密码以继续</p></div>' +
      '<div class="w-full relative">' +
      '<input type="password" id="login-pwd" name="password" class="w-full h-12 pl-4 pr-12 rounded-xl text-sm text-base-content placeholder:text-base-content/25 outline-none" style="background:rgba(15,23,42,.65);border:1px solid rgba(255,255,255,.06);backdrop-filter:blur(12px)" placeholder="请输入密码" required autofocus>' +
      '<button type="button" id="toggle-pwd-vis" class="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-base-content/60 transition-colors cursor-pointer text-sm">👁️</button>' +
      '</div>' +
      '<button type="submit" class="w-full h-11 rounded-xl text-sm font-medium text-white cursor-pointer transition-all duration-200 hover:opacity-90 active:scale-[0.98]" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);box-shadow:0 4px 16px rgba(99,102,241,.3)">登 录</button>' +
      '</form>'
    );
    // 隐藏默认标题
    const titleEl = $('#modal-title');
    if (titleEl) titleEl.style.display = 'none';
    // 密码可见性切换
    $('#toggle-pwd-vis')?.addEventListener('click', function () {
      const inp = $('#login-pwd');
      if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
      this.textContent = inp.type === 'password' ? '👁️' : '🙈';
    });
    // 提交
    $('#login-form')?.addEventListener('submit', async function (e) {
      e.preventDefault();
      const pwd = $('#login-pwd')?.value?.trim();
      if (!pwd) return;
      const btn = this.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = '登录中...'; }
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        if (data.success) {
          toast('登录成功', 'success');
          setTimeout(() => window.location.reload(), 500);
        } else if (data.blocked) {
          // 被锁定
          const lockMin = Math.ceil((data.remainingMs || data.lockoutMs || 900000) / 60000);
          toast('⛔ 尝试次数过多，已锁定 ' + lockMin + ' 分钟', 'error');
          if (btn) { btn.disabled = true; btn.textContent = '已锁定 ' + lockMin + ' 分钟'; }
          $('#login-pwd').value = '';
          // 倒计时恢复
          setTimeout(function () {
            if (btn) { btn.disabled = false; btn.textContent = '登 录'; }
          }, Math.min(data.remainingMs || data.lockoutMs || 60000, 120000));
        } else {
          // 密码错误，显示剩余次数
          const remaining = data.attemptsRemaining;
          const msg = remaining !== undefined
            ? '密码错误，剩余 ' + remaining + ' 次机会'
            : '密码错误';
          toast(msg, 'error');
          if (btn) { btn.disabled = false; btn.textContent = '登 录'; }
          $('#login-pwd').value = '';
          $('#login-pwd').focus();
        }
      } catch {
        toast('登录失败', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '登 录'; }
      }
    });
  }

  // ── Dock 事件 ──
  function bindDockEvents() {
    $('#btn-login')?.addEventListener('click', doLogin);
    $('#btn-add-link')?.addEventListener('click', showAddLinkModal);
    $('#btn-add-cat')?.addEventListener('click', showAddCatModal);
    $('#btn-toggle-sort')?.addEventListener('click', toggleSortMode);
    $('#btn-settings')?.addEventListener('click', showSettings);
    $('#btn-logs')?.addEventListener('click', showLogsModal);
    $('#btn-logout')?.addEventListener('click', async function () {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.reload();
    });
    $('#btn-theme-toggle')?.addEventListener('click', toggleTheme);
  }

  // ── Modal 控制 ──
  function openModal(title, bodyHtml) {
    const modal = $('#app-modal');
    const modalTitle = $('#modal-title');
    const modalBody = $('#modal-body');
    if (!modal || !modalTitle || !modalBody) return;
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modal.showModal();
  }

  function sysConfirm(text, onConfirm) {
    const modal = $('#sys-modal');
    if (!modal) return;
    $('#sys-modal-title').textContent = '操作确认';
    $('#sys-modal-body').textContent = text;
    $('#sys-modal-cancel').classList.remove('hidden');
    
    const confirmBtn = $('#sys-modal-confirm');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    newConfirmBtn.textContent = '确定';
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.close();
      onConfirm();
    });
    
    modal.showModal();
  }

  function sysAlert(text) {
    const modal = $('#sys-modal');
    if (!modal) return;
    $('#sys-modal-title').textContent = '系统提示';
    $('#sys-modal-body').textContent = text;
    $('#sys-modal-cancel').classList.add('hidden');
    
    const confirmBtn = $('#sys-modal-confirm');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    newConfirmBtn.textContent = '知道了';
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.close();
    });
    
    modal.showModal();
  }

  function showAddLinkModal() {
    const cats = state.data.filter(c => c.id !== -1);
    let options = '';
    cats.forEach(c => {
      options += '<option value="' + c.id + '">' + escapeHtml(c.title) + '</option>';
      if (c.children) c.children.forEach(ch => {
        options += '<option value="' + ch.id + '">└ ' + escapeHtml(ch.title) + '</option>';
      });
    });
    openModal('添加链接', '<form id="link-form" class="flex flex-col gap-3">' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">分类</span></div><select name="category_id" class="select select-bordered w-full" required>' + options + '</select></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">标题</span></div><input type="text" name="title" class="input input-bordered w-full" required placeholder="网站名称"></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">URL</span></div><input type="url" name="url" class="input input-bordered w-full" required placeholder="https://..."></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">描述</span></div><input type="text" name="description" class="input input-bordered w-full" placeholder="简短描述"></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">图标 URL</span></div><input type="text" name="icon" class="input input-bordered w-full" placeholder="留空自动获取"></label>' +
      '<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="is_private" class="toggle toggle-sm"><span class="label-text">🔒 私有链接</span></label>' +
      '<div class="modal-action"><button type="submit" class="btn btn-primary">添加链接</button></div></form>');
    $('#link-form')?.addEventListener('submit', handleAddLink);
  }

  async function handleAddLink(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      category_id: parseInt(form.category_id.value),
      title: form.title.value,
      url: form.url.value,
      description: form.description?.value || '',
      icon: form.icon?.value || '',
      is_private: form.is_private?.checked ? 1 : 0,
    };
    try {
      await api('/api/link', { method: 'POST', body: JSON.stringify(data) });
      $('#app-modal')?.close();
      toast('链接已添加', 'success');
      await reloadData();
    } catch (err) { toast('添加失败: ' + err.message, 'error'); }
  }

  function showAddCatModal() {
    // 扁平化分类列表（含缩进）
    let catListHtml = '';
    state.data.forEach(cat => {
      if (cat.id === -1) return; // 跳过常用推荐
      catListHtml += '<div class="cat-manage-item flex items-center gap-2 p-2 rounded-xl group" data-cat-id="' + cat.id + '">' +
        '<span class="cursor-grab text-base-content/30 drag-handle">⠿</span>' +
        '<span class="flex-1 text-sm font-medium truncate">' + (cat.is_private ? '🔒 ' : '') + escapeHtml(cat.title) + '</span>' +
        '<button type="button" class="btn btn-ghost btn-xs cat-edit-btn" data-cat-id="' + cat.id + '">✏️</button>' +
        '<button type="button" class="btn btn-ghost btn-xs cat-del-btn text-error/60" data-cat-id="' + cat.id + '">🗑️</button>' +
        '</div>';
      if (cat.children && cat.children.length > 0) {
        cat.children.forEach(ch => {
          catListHtml += '<div class="cat-manage-item flex items-center gap-2 p-2 rounded-xl group ml-6" data-cat-id="' + ch.id + '">' +
            '<span class="cursor-grab text-base-content/30 drag-handle">⠿</span>' +
            '<span class="text-base-content/30 text-xs mr-1">└</span>' +
            '<span class="flex-1 text-sm font-medium truncate">' + (ch.is_private ? '🔒 ' : '') + escapeHtml(ch.title) + '</span>' +
            '<button type="button" class="btn btn-ghost btn-xs cat-edit-btn" data-cat-id="' + ch.id + '">✏️</button>' +
            '<button type="button" class="btn btn-ghost btn-xs cat-del-btn text-error/60" data-cat-id="' + ch.id + '">🗑️</button>' +
            '</div>';
        });
      }
    });

    // 顶级分类选项（用于选择父分类）
    const parentOptions = '<option value="">无（顶级分类）</option>' +
      state.data.filter(c => c.id !== -1).map(c => '<option value="' + c.id + '">' + escapeHtml(c.title) + '</option>').join('');

    openModal('分类管理', '<div class="flex flex-col gap-3">' +
      '<p class="text-xs text-base-content/40">拖拽调整顺序 · 点击编辑或删除</p>' +
      '<div id="cat-sort-list" class="flex flex-col gap-2">' + catListHtml + '</div>' +
      '<div class="divider text-xs text-base-content/30 my-1">添加新分类</div>' +
      '<form id="cat-form" class="flex gap-2 items-center">' +
      '<input type="text" name="title" class="input input-bordered input-sm flex-1 min-w-0" required placeholder="分类名称">' +
      '<select name="parent_id" class="select select-bordered select-sm w-auto max-w-[140px]">' +
      '<option value="">顶级分类</option>' +
      state.data.filter(c => c.id !== -1).map(c => '<option value="' + c.id + '">↳ ' + escapeHtml(c.title) + '</option>').join('') +
      '</select>' +
      '<button type="submit" class="btn btn-primary btn-sm">添加</button>' +
      '</form></div>');

    // 拖拽排序
    if (typeof Sortable !== 'undefined') {
      const sortList = $('#cat-sort-list');
      if (sortList) {
        new Sortable(sortList, {
          animation: 200,
          handle: '.drag-handle',
          ghostClass: 'opacity-30',
          onEnd: async function () {
            const items = Array.from(sortList.children).map((el, i) => ({
              id: parseInt(el.dataset.catId),
              sort_order: i,
            })).filter(x => !isNaN(x.id));
            try {
              await api('/api/category/reorder', { method: 'POST', body: JSON.stringify(items) });
              toast('分类顺序已保存', 'success');
              await reloadData();
            } catch (err) { toast('排序失败', 'error'); }
          }
        });
      }
    }

    // 编辑分类
    $$('.cat-edit-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const catId = parseInt(this.dataset.catId);
        const cat = findCatById(catId);
        if (cat) showEditCatModal(cat);
      });
    });

    // 删除分类
    $$('.cat-del-btn').forEach(btn => {
      btn.addEventListener('click', async function () {
        const catId = parseInt(this.dataset.catId);
        const cat = findCatById(catId);
        if (!cat) return;
        sysConfirm('确定删除分类「' + cat.title + '」？分类下的链接也会被删除！', async () => {
          try {
            await api('/api/category/delete', { method: 'POST', body: JSON.stringify({ id: catId }) });
            toast('分类已删除', 'success');
            currentCatIdx = 0;
            await reloadData();
            showAddCatModal(); // 刷新管理面板
          } catch (err) { toast('删除失败: ' + err.message, 'error'); }
        });
      });
    });

    // 添加新分类
    $('#cat-form')?.addEventListener('submit', async function (e) {
      e.preventDefault();
      const data = { title: e.target.title.value, is_private: 0 };
      const parentId = e.target.parent_id.value;
      if (parentId) data.parent_id = parseInt(parentId);
      try {
        await api('/api/category', { method: 'POST', body: JSON.stringify(data) });
        $('#app-modal')?.close();
        toast('分类已添加', 'success');
        await reloadData();
      } catch (err) { toast('添加失败: ' + err.message, 'error'); }
    });
  }

  // 查找分类（含子分类）
  function findCatById(id) {
    for (const cat of state.data) {
      if (cat.id === id) return cat;
      if (cat.children) {
        const child = cat.children.find(ch => ch.id === id);
        if (child) return child;
      }
    }
    return null;
  }

  // 获取所有链接（含子分类）
  function getAllLinks() {
    const links = [];
    state.data.forEach(cat => {
      links.push(...cat.items);
      if (cat.children) cat.children.forEach(ch => links.push(...ch.items));
    });
    return links;
  }

  // ── 编辑/删除 ──
  document.addEventListener('click', function (e) {
    const editBtn = e.target.closest('.edit-link-btn');
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = parseInt(editBtn.dataset.linkId);
      const link = getAllLinks().find(l => l.id === id);
      if (link) showEditLinkModal(link);
      return;
    }
    const deleteBtn = e.target.closest('.delete-link-btn');
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = parseInt(deleteBtn.dataset.linkId);
      sysConfirm('确定删除？', () => deleteLink(id));
      return;
    }
  });

  // ── 长按编辑/删除（移动端） ──
  let longPressTimer = null;
  let longPressTriggered = false;

  document.addEventListener('touchstart', function (e) {
    if (!isAdmin) return;
    const card = e.target.closest('.link-card');
    if (!card) return;
    longPressTriggered = false;
    longPressTimer = setTimeout(function () {
      longPressTriggered = true;
      e.preventDefault();
      const id = parseInt(card.dataset.linkId);
      const link = getAllLinks().find(l => l.id === id);
      if (link) showLinkActionModal(link);
    }, 500);
  }, { passive: false });

  document.addEventListener('touchend', function () {
    clearTimeout(longPressTimer);
  });

  document.addEventListener('touchmove', function () {
    clearTimeout(longPressTimer);
  });

  // 阻止长按后打开链接
  document.addEventListener('click', function (e) {
    if (longPressTriggered) {
      e.preventDefault();
      e.stopPropagation();
      longPressTriggered = false;
    }
  }, true);

  function showLinkActionModal(link) {
    openModal(escapeHtml(link.title), '<div class="flex flex-col gap-3">' +
      '<a href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">🔗 打开链接</a>' +
      '<button type="button" id="act-edit" class="btn btn-primary btn-sm">✏️ 编辑</button>' +
      '<button type="button" id="act-delete" class="btn btn-error btn-outline btn-sm">🗑️ 删除</button>' +
      '</div>');
    $('#act-edit')?.addEventListener('click', function () {
      showEditLinkModal(link);
    });
    $('#act-delete')?.addEventListener('click', function () {
      sysConfirm('确定删除「' + link.title + '」？', () => {
        deleteLink(link.id);
        $('#app-modal')?.close();
      });
    });
  }

  // ── 分类右键编辑/删除 ──
  document.addEventListener('contextmenu', function (e) {
    if (!isAdmin) return;
    const tab = e.target.closest('.nav-tab');
    if (!tab) return;
    e.preventDefault();
    const idx = parseInt(tab.dataset.idx);
    if (isNaN(idx) || !state.data[idx]) return;
    const cat = state.data[idx];
    showEditCatModal(cat);
  });

  function showEditCatModal(cat) {
    const parentOptions = '<option value="">无（顶级分类）</option>' +
      state.data.filter(c => c.id !== -1 && c.id !== cat.id).map(c => '<option value="' + c.id + '" ' + (cat.parent_id === c.id ? 'selected' : '') + '>↳ ' + escapeHtml(c.title) + '</option>').join('');

    openModal('编辑分类', '<form id="edit-cat-form" class="flex flex-col gap-3">' +
      '<input type="hidden" name="id" value="' + cat.id + '">' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">分类名称</span></div><input type="text" name="title" class="input input-bordered w-full" required value="' + escapeHtml(cat.title) + '"></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">所属父分类</span></div><select name="parent_id" class="select select-bordered w-full">' + parentOptions + '</select></label>' +
      '<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="is_private" class="toggle toggle-sm" ' + (cat.is_private ? 'checked' : '') + '><span class="label-text">🔒 私有分类</span></label>' +
      '<div class="modal-action flex gap-2">' +
      '<button type="button" id="btn-delete-cat" class="btn btn-error btn-outline">删除分类</button>' +
      '<button type="submit" class="btn btn-primary flex-1">保存修改</button>' +
      '</div></form>');
    $('#edit-cat-form')?.addEventListener('submit', async function (e) {
      e.preventDefault();
      const data = {
        id: parseInt(e.target.id.value),
        title: e.target.title.value,
        is_private: e.target.is_private?.checked ? 1 : 0,
        parent_id: e.target.parent_id.value ? parseInt(e.target.parent_id.value) : null,
      };
      try {
        await api('/api/category/update', { method: 'POST', body: JSON.stringify(data) });
        $('#app-modal')?.close();
        toast('分类已更新', 'success');
        await reloadData();
      } catch (err) { toast('更新失败: ' + err.message, 'error'); }
    });
    $('#btn-delete-cat')?.addEventListener('click', async function () {
      sysConfirm('确定删除分类「' + cat.title + '」？分类下的链接也会被删除！', async () => {
        try {
          await api('/api/category/delete', { method: 'POST', body: JSON.stringify({ id: cat.id }) });
          $('#app-modal')?.close();
          toast('分类已删除', 'success');
          currentCatIdx = 0;
          await reloadData();
        } catch (err) { toast('删除失败: ' + err.message, 'error'); }
      });
    });
  }

  function showEditLinkModal(link) {
    const cats = state.data.filter(c => c.id !== -1);
    let options = '';
    cats.forEach(c => {
      options += '<option value="' + c.id + '" ' + (c.id === link.category_id ? 'selected' : '') + '>' + escapeHtml(c.title) + '</option>';
      if (c.children) c.children.forEach(ch => {
        options += '<option value="' + ch.id + '" ' + (ch.id === link.category_id ? 'selected' : '') + '>└ ' + escapeHtml(ch.title) + '</option>';
      });
    });
    var linkDomain = '';
    try { linkDomain = new URL(link.url).hostname; } catch (e) {}
    openModal('编辑链接', '<form id="edit-form" class="flex flex-col gap-3"><input type="hidden" name="id" value="' + link.id + '">' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">分类</span></div><select name="category_id" class="select select-bordered w-full" required>' + options + '</select></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">标题</span></div><input type="text" name="title" class="input input-bordered w-full" required value="' + escapeHtml(link.title) + '"></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">URL</span></div><input type="url" name="url" class="input input-bordered w-full" required value="' + escapeHtml(link.url) + '"></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">描述</span></div><input type="text" name="description" class="input input-bordered w-full" value="' + escapeHtml(link.description || '') + '"></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">图标 URL</span></div><input type="text" name="icon" class="input input-bordered w-full" value="' + escapeHtml(link.icon || '') + '"></label>' +
      (linkDomain ? '<button type="button" id="btn-purge-icon" class="btn btn-outline btn-xs self-start" data-domain="' + escapeHtml(linkDomain) + '">🔄 刷新图标缓存</button>' : '') +
      '<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="is_private" class="toggle toggle-sm" ' + (link.is_private ? 'checked' : '') + '><span class="label-text">🔒 私有链接</span></label>' +
      '<div class="modal-action"><button type="submit" class="btn btn-primary">保存修改</button></div></form>');
    $('#edit-form')?.addEventListener('submit', async function (e) {
      e.preventDefault();
      const data = {
        id: parseInt(e.target.id.value),
        category_id: parseInt(e.target.category_id.value),
        title: e.target.title.value,
        url: e.target.url.value,
        description: e.target.description?.value || '',
        icon: e.target.icon?.value || '',
        is_private: e.target.is_private?.checked ? 1 : 0,
      };
      try {
        await api('/api/link/update', { method: 'POST', body: JSON.stringify(data) });
        $('#app-modal')?.close();
        toast('链接已更新', 'success');
        await reloadData();
      } catch (err) { toast('更新失败: ' + err.message, 'error'); }
    });
    // 图标缓存刷新按钮
    $('#btn-purge-icon')?.addEventListener('click', async function () {
      var domain = this.dataset.domain;
      this.disabled = true;
      this.textContent = '⏳ 刷新中...';
      try {
        await api('/api/icon/purge', { method: 'POST', body: JSON.stringify({ domain: domain }) });
        toast('图标缓存已清除，刷新页面后生效', 'success');
        this.textContent = '✅ 已刷新';
      } catch (err) {
        toast('刷新失败: ' + err.message, 'error');
        this.disabled = false;
        this.textContent = '🔄 刷新图标缓存';
      }
    });
  }

  async function deleteLink(id) {
    try {
      await api('/api/link/delete', { method: 'POST', body: JSON.stringify({ id }) });
      toast('链接已删除', 'success');
      await reloadData();
    } catch (err) { toast('删除失败: ' + err.message, 'error'); }
  }

  // ── SortableJS ──
  function toggleSortMode() {
    sortMode = !sortMode;
    const btn = $('#btn-toggle-sort');
    if (btn) btn.classList.toggle('dock-active', sortMode);
    if (sortMode) enableSort(); else disableSort();
    toast(sortMode ? '拖拽排序模式已开启' : '排序已关闭', 'info');
  }

  function enableSort() {
    if (typeof Sortable === 'undefined') return;
    sortableInstances = [];
    $$('.cat-section:not(.hidden) [id^="grid-"]').forEach(grid => {
      const s = new Sortable(grid, {
        animation: 200,
        ghostClass: 'opacity-30',
        onEnd: async function () {
          const items = Array.from(grid.children).map((el, i) => ({
            id: parseInt(el.dataset.linkId),
            sort_order: i,
          })).filter(x => !isNaN(x.id));
          try {
            await api('/api/link/reorder', { method: 'POST', body: JSON.stringify(items) });
          } catch (err) { toast('排序保存失败', 'error'); }
        }
      });
      sortableInstances.push(s);
    });
  }

  function disableSort() {
    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];
  }

  // ── 审计日志 ──
  async function showLogsModal(page = 1, limit = 5) {
    try {
      const res = await api('/api/logs?page=' + page + '&limit=' + limit);
      let html = '<div class="flex flex-col gap-3">';

      if (!res.logs || res.logs.length === 0) {
        html += '<div class="py-20 text-center text-base-content/40">暂无操作日志记录</div>';
      } else {
        function getActionBadge(action) {
          const map = {
            'login': { text: '登录后台', cls: 'bg-primary text-primary-content' },
            'add_category': { text: '添加分类', cls: 'bg-emerald-500 text-white' },
            'add_link': { text: '添加链接', cls: 'bg-emerald-500 text-white' },
            'update_category': { text: '修改分类', cls: 'bg-blue-500 text-white' },
            'update_link': { text: '修改链接', cls: 'bg-blue-500 text-white' },
            'delete_category': { text: '删除分类', cls: 'bg-rose-500 text-white' },
            'delete_link': { text: '删除链接', cls: 'bg-rose-500 text-white' },
            'reorder_categories': { text: '排序分类', cls: 'bg-purple-500 text-white' },
            'reorder_links': { text: '排序链接', cls: 'bg-purple-500 text-white' },
            'import_data': { text: '导入数据', cls: 'bg-emerald-500 text-white' },
            'clear_logs': { text: '清空日志', cls: 'bg-rose-500 text-white' },
            'ip_lockout': { text: 'IP 锁定', cls: 'bg-rose-500 text-white' },
          };
          const match = map[action];
          if (match) return '<span class="inline-block px-2.5 py-1 rounded text-xs font-medium ' + match.cls + '">' + match.text + '</span>';
          return '<span class="inline-block px-2.5 py-1 rounded text-xs font-medium bg-base-content/20 text-base-content">' + escapeHtml(action) + '</span>';
        }

        html += '<div class="overflow-x-auto"><table class="w-full text-left border-collapse whitespace-nowrap">';
        html += '<thead><tr class="border-b border-base-content/10">' +
          '<th class="py-3 px-3 font-semibold text-xs">时间 (UTC+8)</th>' +
          '<th class="py-3 px-3 font-semibold text-xs">IP</th>' +
          '<th class="py-3 px-3 font-semibold text-xs">地区</th>' +
          '<th class="py-3 px-3 font-semibold text-xs text-center">操作</th>' +
          '</tr></thead><tbody>';

        res.logs.forEach(function (log) {
          const d = new Date(log.created_at);
          const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');

          html += '<tr class="border-b border-base-content/5 hover:bg-base-content/[0.02] transition-colors">' +
            '<td class="py-3 px-3 text-xs text-base-content/80">' + dateStr + '</td>' +
            '<td class="py-3 px-3 text-xs font-mono text-base-content/60">' + escapeHtml(log.ip || 'Unknown') + '</td>' +
            '<td class="py-3 px-3 text-xs text-base-content/80">' + escapeHtml(log.region || 'Unknown') + '</td>' +
            '<td class="py-3 px-3 text-center">' + getActionBadge(log.action) + '</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';
      }

      // 底部操作区
      html += '<div class="flex flex-col gap-3 pt-3 border-t border-base-content/10">';

      // 翻页按钮行
      html += '<div class="flex items-center justify-between">';
      html += '<span class="text-xs text-base-content/30">共 ' + (res.total || 0) + ' 条日志</span>';
      html += '<div class="flex gap-2">';
      if (page > 1) {
        html += '<button class="btn btn-outline btn-xs btn-logs-nav" data-page="' + (page - 1) + '" data-limit="' + limit + '">上一页</button>';
      }
      if (res.logs && res.logs.length === limit && (page * limit) < (res.total || 0)) {
        html += '<button class="btn btn-outline btn-xs btn-logs-nav" data-page="' + (page + 1) + '" data-limit="' + limit + '">下一页</button>';
      }
      html += '</div></div>';

      // 操作按钮行
      html += '<div class="flex gap-2">';
      if (limit <= 5) {
        html += '<button class="btn btn-primary btn-sm flex-1" id="btn-logs-all">📋 查看全部日志</button>';
      } else {
        html += '<button class="btn btn-outline btn-sm flex-1" id="btn-logs-brief">📋 简略视图</button>';
      }
      html += '<button class="btn btn-error btn-outline btn-sm" id="btn-logs-clear">🗑️ 清空</button>';
      html += '</div>';

      html += '</div></div>';

      openModal('📋 操作日志', html);

      // 扩大 modal 宽度以容纳表格
      var modalBox = document.querySelector('#app-modal .modal-box');
      if (modalBox) modalBox.style.maxWidth = '48rem';

      // 翻页事件
      document.querySelectorAll('.btn-logs-nav').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          showLogsModal(parseInt(e.target.dataset.page), parseInt(e.target.dataset.limit));
        });
      });

      // 查看全部日志
      $('#btn-logs-all')?.addEventListener('click', function () {
        showLogsModal(1, 15);
      });

      // 简略视图
      $('#btn-logs-brief')?.addEventListener('click', function () {
        showLogsModal(1, 5);
      });

      // 清空日志
      $('#btn-logs-clear')?.addEventListener('click', function () {
        sysConfirm('确定要清空所有操作日志吗？此操作不可恢复！', async function () {
          try {
            await api('/api/logs/clear', { method: 'POST' });
            toast('日志已清空', 'success');
            showLogsModal(1, limit);
          } catch (err) {
            toast('清空失败: ' + err.message, 'error');
          }
        });
      });
    } catch (err) {
      toast('获取日志失败: ' + err.message, 'error');
    }
  }

  // ── 设置 ──
  function showSettings() {
    const currentBg = state.config?.bg_image || '';
    openModal('⚙️ 设置', '<div class="flex flex-col gap-4">' +
      // 背景图片设置
      '<div class="flex flex-col gap-2">' +
      '<h3 class="text-sm font-semibold text-base-content/70">🖼️ 背景图片</h3>' +
      '<input type="text" id="bg-input" class="input input-bordered input-sm w-full" placeholder="输入图片 URL（留空使用纯色）" value="' + escapeHtml(currentBg) + '">' +
      '<div id="bg-preview" class="rounded-xl overflow-hidden h-24 bg-base-content/5 flex items-center justify-center">' +
      (currentBg ? '<img src="' + escapeHtml(currentBg) + '" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML=\'<span class=&quot;text-xs text-base-content/30&quot;>加载失败</span>\'">' : '<span class="text-xs text-base-content/30">暂无背景</span>') +
      '</div>' +
      '<div class="flex gap-2">' +
      '<button type="button" id="btn-bg-preview" class="btn btn-outline btn-xs flex-1">预览</button>' +
      '<button type="button" id="btn-bg-save" class="btn btn-primary btn-xs flex-1">保存背景</button>' +
      '<button type="button" id="btn-bg-clear" class="btn btn-ghost btn-xs">清除</button>' +
      '</div></div>' +
      '<div class="divider my-0"></div>' +
      // 数据管理
      '<div class="flex flex-col gap-2">' +
      '<h3 class="text-sm font-semibold text-base-content/70">📦 数据管理</h3>' +
      '<div class="flex gap-2">' +
      '<button type="button" class="btn btn-outline btn-sm flex-1" id="btn-import">📥 导入</button>' +
      '<button type="button" class="btn btn-outline btn-sm flex-1" id="btn-export">📤 导出</button>' +
      '</div></div>' +
      '</div>');

    // 背景预览
    $('#btn-bg-preview')?.addEventListener('click', function () {
      const url = $('#bg-input')?.value?.trim();
      const preview = $('#bg-preview');
      if (!preview) return;
      if (url) {
        preview.innerHTML = '<img src="' + escapeHtml(url) + '" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML=\'<span class=&quot;text-xs text-base-content/30&quot;>加载失败</span>\'">';
      } else {
        preview.innerHTML = '<span class="text-xs text-base-content/30">暂无背景</span>';
      }
    });

    // 保存背景
    $('#btn-bg-save')?.addEventListener('click', async function () {
      const url = $('#bg-input')?.value?.trim() || '';
      try {
        await api('/api/config', { method: 'POST', body: JSON.stringify({ key: 'bg_image', value: url }) });
        toast('背景已保存，刷新生效', 'success');
        // 前端实时切换
        applyBackground(url);
        state.config.bg_image = url;
      } catch (err) { toast('保存失败: ' + err.message, 'error'); }
    });

    // 清除背景
    $('#btn-bg-clear')?.addEventListener('click', function () {
      $('#bg-input').value = '';
      $('#bg-preview').innerHTML = '<span class="text-xs text-base-content/30">暂无背景</span>';
    });

    // 导出数据
    $('#btn-export')?.addEventListener('click', async function () {
      const btn = this;
      btn.disabled = true;
      btn.textContent = '⏳ 导出中...';
      try {
        const data = await api('/api/export');
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = 'nav-backup-' + dateStr + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('数据全量备份导出成功', 'success');
      } catch (err) {
        toast('导出失败: ' + (err.message || '网络错误'), 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '📤 导出';
      }
    });

    // 导入
    $('#btn-import')?.addEventListener('click', function () {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async function () {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          let json;
          try {
            json = JSON.parse(text);
          } catch (e) {
            throw new Error('JSON 文件格式无效');
          }
          const res = await api('/api/import', { method: 'POST', body: JSON.stringify(json) });
          let msg = '导入完成：新增 ' + (res.count || 0) + ' 条链接';
          if (res.categories_added > 0) msg += '，创建 ' + res.categories_added + ' 个新分类';
          toast(msg, 'success');
          if (res.skipped_urls && res.skipped_urls.length > 0) {
            const listStr = res.skipped_urls.slice(0, 10).join('\n') + (res.skipped_urls.length > 10 ? '\n...等共 ' + res.skipped_urls.length + ' 条' : '');
            sysAlert('提示：有 ' + res.skipped_count + ' 条数据被跳过（可能因为 URL 无效或已存在）：\n\n' + listStr);
          }
          await reloadData();
        } catch (err) { toast('导入失败: ' + err.message, 'error'); }
      };
      input.click();
    });
  }

  // 前端实时切换背景
  function applyBackground(url) {
    let bgEl = document.querySelector('.bg-image-layer');
    if (url) {
      if (!bgEl) {
        bgEl = document.createElement('div');
        bgEl.className = 'bg-image-layer fixed inset-0 z-[-2] bg-cover bg-center bg-no-repeat pointer-events-none';
        document.body.insertBefore(bgEl, document.body.firstChild);
      }
      bgEl.style.backgroundImage = "url('" + url + "')";
      document.body.classList.remove('bg-base-300');
      document.body.classList.add('bg-transparent');
    } else {
      if (bgEl) bgEl.remove();
      document.body.classList.remove('bg-transparent');
      document.body.classList.add('bg-base-300');
    }
  }

  // ── 数据重载 ──
  async function reloadData() {
    try {
      const fullData = await api('/api/data');
      state.data = fullData.nav;
      if (currentCatIdx >= state.data.length) currentCatIdx = 0;
      renderAll();
      if (sortMode) {
        disableSort();
        enableSort();
      }
    } catch { /* silent */ }
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // ── 初始化 ──
  initTheme();
  initSearchEngines();
  renderDock();
  bindSubDropdownHover($('#nav-scroll'), $('#sub-dropdown-container'));
  checkAuth();
})();
