/**
 * public/client.js - 客户端交互逻辑
 * 分类切换 + 搜索 + SortableJS + 主题 + CRUD + 点击上报
 */
(function () {
  'use strict';
  const state = window.__NAV_STATE__ || { data: [], config: {}, auth: '', isRoot: false };
  let token = localStorage.getItem('nav_token') || '';
  let isAdmin = false;
  let currentCatIdx = 0;
  let sortMode = false;
  let sortableInstances = [];

  // ── 工具函数 ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const api = async (path, opts = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(path, { ...opts, headers });
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
    if (!token) return;
    try {
      const res = await api('/api/auth/verify');
      if (res.status === 'ok') {
        isAdmin = true;
        state.isRoot = res.role === 'root';
        // 重新加载数据（含私有）
        const fullData = await api('/api/data');
        state.data = fullData.nav;
        renderAll();
      } else {
        token = '';
        localStorage.removeItem('nav_token');
      }
    } catch { /* not logged in */ }
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
    scroll.innerHTML = state.data.map((cat, i) => {
      const active = i === currentCatIdx;
      return '<button type="button" class="nav-tab whitespace-nowrap text-sm font-medium transition-all duration-200 border-b-2 pb-1 ' +
        (active ? 'text-primary border-primary opacity-100' : 'text-base-content/60 border-transparent opacity-70 hover:opacity-100') +
        '" data-idx="' + i + '">' + escapeHtml(cat.title) + '</button>';
    }).join('');
  }

  function renderGrid() {
    const container = $('#link-sections');
    if (!container) return;
    container.innerHTML = state.data.map((cat, i) => {
      const hidden = i !== currentCatIdx ? 'hidden' : '';
      const cards = cat.items.map(link => linkCardHtml(link)).join('');
      return '<section class="cat-section ' + hidden + '" data-cat-id="' + cat.id + '">' +
        '<div id="grid-' + cat.id + '" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">' +
        cards + '</div>' +
        (cat.items.length === 0 ? '<div class="text-center text-base-content/30 py-16 text-sm">暂无链接</div>' : '') +
        '</section>';
    }).join('') +
      '<section id="search-results" class="hidden"><div id="search-results-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"></div>' +
      '<div id="search-empty" class="text-center text-base-content/30 py-16 text-sm hidden">未找到匹配的链接</div></section>';
  }

  function linkCardHtml(link) {
    const iconSrc = link.icon || ('/api/icon?domain=' + encodeURIComponent(new URL(link.url).hostname));
    const adminBtns = isAdmin ? '<div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">' +
      '<button type="button" class="btn btn-ghost btn-xs btn-circle edit-link-btn" data-link-id="' + link.id + '" onclick="event.preventDefault();event.stopPropagation()">✏️</button>' +
      '<button type="button" class="btn btn-ghost btn-xs btn-circle delete-link-btn" data-link-id="' + link.id + '" onclick="event.preventDefault();event.stopPropagation()">🗑️</button></div>' : '';
    return '<a href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener noreferrer" ' +
      'class="link-card glass-card rounded-2xl p-3 flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group cursor-pointer no-underline" ' +
      'data-link-id="' + link.id + '" data-cat-id="' + link.category_id + '" data-title="' + escapeHtml(link.title) + '" data-url="' + escapeHtml(link.url) + '">' +
      '<div class="w-10 h-10 rounded-xl bg-base-300/50 flex items-center justify-center shrink-0 overflow-hidden">' +
      '<img src="' + escapeHtml(iconSrc) + '" alt="" class="w-6 h-6 object-contain" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
      '<span class="text-lg" style="display:none">🔗</span></div>' +
      '<div class="min-w-0 flex-1"><div class="text-sm font-medium truncate text-base-content">' +
      (link.is_private ? '🔒 ' : '') + escapeHtml(link.title) + '</div>' +
      (link.description ? '<div class="text-xs text-base-content/50 truncate mt-0.5">' + escapeHtml(link.description) + '</div>' : '') +
      '</div>' + adminBtns + '</a>';
  }

  function renderDock() {
    const existing = $('.dock');
    if (existing) existing.remove();
    if (!isAdmin) return;
    const dock = document.createElement('div');
    dock.className = 'dock dock-bottom bg-base-200/90 backdrop-blur-lg border-t border-base-content/10 z-50';
    dock.innerHTML =
      '<button type="button" id="btn-add-link" class="dock-active"><svg class="size-[1.2em]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg><span class="dock-label">添加</span></button>' +
      '<button type="button" id="btn-add-cat"><svg class="size-[1.2em]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7h4l3-3h10a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1z"/></svg><span class="dock-label">分类</span></button>' +
      '<button type="button" id="btn-toggle-sort"><svg class="size-[1.2em]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg><span class="dock-label">排序</span></button>' +
      '<button type="button" id="btn-settings"><svg class="size-[1.2em]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span class="dock-label">设置</span></button>' +
      '<button type="button" id="btn-theme-toggle"><svg id="icon-moon" class="size-[1.2em]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg><svg id="icon-sun" class="size-[1.2em] hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg><span class="dock-label">主题</span></button>';
    document.body.appendChild(dock);
    bindDockEvents();
  }

  // ── 分类切换 ──
  document.addEventListener('click', function (e) {
    const tab = e.target.closest('.nav-tab');
    if (tab) {
      const idx = parseInt(tab.dataset.idx);
      if (isNaN(idx)) return;
      currentCatIdx = idx;
      $$('.nav-tab').forEach((t, i) => {
        t.classList.toggle('text-primary', i === idx);
        t.classList.toggle('border-primary', i === idx);
        t.classList.toggle('opacity-100', i === idx);
        t.classList.toggle('text-base-content/60', i !== idx);
        t.classList.toggle('border-transparent', i !== idx);
        t.classList.toggle('opacity-70', i !== idx);
      });
      $$('.cat-section').forEach((s, i) => s.classList.toggle('hidden', i !== idx));
      $('#search-results')?.classList.add('hidden');
      const searchInput = $('#search-input');
      if (searchInput) searchInput.value = '';
      $('#search-clear')?.classList.add('hidden');
    }
  });

  // ── 搜索 ──
  const searchInput = $('#search-input');
  const searchClear = $('#search-clear');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      const q = this.value.trim().toLowerCase();
      searchClear?.classList.toggle('hidden', !q);
      if (!q) {
        $$('.cat-section').forEach((s, i) => s.classList.toggle('hidden', i !== currentCatIdx));
        $('#search-results')?.classList.add('hidden');
        return;
      }
      $$('.cat-section').forEach(s => s.classList.add('hidden'));
      const results = $('#search-results');
      const grid = $('#search-results-grid');
      const empty = $('#search-empty');
      if (!results || !grid) return;
      results.classList.remove('hidden');
      const allLinks = state.data.flatMap(c => c.items);
      const matched = allLinks.filter(l =>
        (l.title || '').toLowerCase().includes(q) ||
        (l.url || '').toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q)
      );
      grid.innerHTML = matched.map(l => linkCardHtml(l)).join('');
      empty?.classList.toggle('hidden', matched.length > 0);
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

  // ── Dock 事件 ──
  function bindDockEvents() {
    $('#btn-add-link')?.addEventListener('click', showAddLinkModal);
    $('#btn-add-cat')?.addEventListener('click', showAddCatModal);
    $('#btn-toggle-sort')?.addEventListener('click', toggleSortMode);
    $('#btn-settings')?.addEventListener('click', showSettings);
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

  function showAddLinkModal() {
    const cats = state.data.filter(c => c.id !== -1);
    const options = cats.map(c => '<option value="' + c.id + '">' + escapeHtml(c.title) + '</option>').join('');
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
    openModal('添加分类', '<form id="cat-form" class="flex flex-col gap-3">' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">分类名称</span></div><input type="text" name="title" class="input input-bordered w-full" required placeholder="例如：开发工具"></label>' +
      '<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="is_private" class="toggle toggle-sm"><span class="label-text">🔒 私有分类</span></label>' +
      '<div class="modal-action"><button type="submit" class="btn btn-primary">添加分类</button></div></form>');
    $('#cat-form')?.addEventListener('submit', async function (e) {
      e.preventDefault();
      const data = { title: e.target.title.value, is_private: e.target.is_private?.checked ? 1 : 0 };
      try {
        await api('/api/category', { method: 'POST', body: JSON.stringify(data) });
        $('#app-modal')?.close();
        toast('分类已添加', 'success');
        await reloadData();
      } catch (err) { toast('添加失败: ' + err.message, 'error'); }
    });
  }

  // ── 编辑/删除 ──
  document.addEventListener('click', function (e) {
    const editBtn = e.target.closest('.edit-link-btn');
    if (editBtn) {
      const id = parseInt(editBtn.dataset.linkId);
      const link = state.data.flatMap(c => c.items).find(l => l.id === id);
      if (link) showEditLinkModal(link);
    }
    const deleteBtn = e.target.closest('.delete-link-btn');
    if (deleteBtn) {
      const id = parseInt(deleteBtn.dataset.linkId);
      if (confirm('确定删除？')) deleteLink(id);
    }
  });

  function showEditLinkModal(link) {
    const cats = state.data.filter(c => c.id !== -1);
    const options = cats.map(c => '<option value="' + c.id + '" ' + (c.id === link.category_id ? 'selected' : '') + '>' + escapeHtml(c.title) + '</option>').join('');
    openModal('编辑链接', '<form id="edit-form" class="flex flex-col gap-3"><input type="hidden" name="id" value="' + link.id + '">' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">分类</span></div><select name="category_id" class="select select-bordered w-full" required>' + options + '</select></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">标题</span></div><input type="text" name="title" class="input input-bordered w-full" required value="' + escapeHtml(link.title) + '"></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">URL</span></div><input type="url" name="url" class="input input-bordered w-full" required value="' + escapeHtml(link.url) + '"></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">描述</span></div><input type="text" name="description" class="input input-bordered w-full" value="' + escapeHtml(link.description || '') + '"></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">图标 URL</span></div><input type="text" name="icon" class="input input-bordered w-full" value="' + escapeHtml(link.icon || '') + '"></label>' +
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

  // ── 设置 ──
  function showSettings() {
    openModal('⚙️ 设置', '<div class="flex flex-col gap-3">' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-import">📥 导入数据</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-export">📤 导出数据</button>' +
      '<button type="button" class="btn btn-outline btn-error btn-sm" id="btn-logout">🚪 退出登录</button>' +
      '</div>');
    $('#btn-export')?.addEventListener('click', async function () {
      try {
        const data = await api('/api/export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'nav-export.json';
        a.click();
        toast('导出成功', 'success');
      } catch (err) { toast('导出失败', 'error'); }
    });
    $('#btn-import')?.addEventListener('click', function () {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async function () {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const json = JSON.parse(text);
          const importData = json.data || json;
          const res = await api('/api/import', { method: 'POST', body: JSON.stringify(importData) });
          toast('导入成功：' + (res.count || 0) + ' 条链接', 'success');
          await reloadData();
        } catch (err) { toast('导入失败: ' + err.message, 'error'); }
      };
      input.click();
    });
    $('#btn-logout')?.addEventListener('click', function () {
      token = '';
      localStorage.removeItem('nav_token');
      location.reload();
    });
  }

  // ── 数据重载 ──
  async function reloadData() {
    try {
      const fullData = await api('/api/data');
      state.data = fullData.nav;
      if (currentCatIdx >= state.data.length) currentCatIdx = 0;
      renderAll();
    } catch { /* silent */ }
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // ── 初始化 ──
  initTheme();
  checkAuth();
})();
