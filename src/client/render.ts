/**
 * src/client/render.ts - 导航栏、卡片网格、Dock、主题与背景渲染
 */
import type { DockActions, Link } from './types'
import { $, $$, escapeHtml, sanitizeCssUrl } from './dom'
import { getClientIconSrc, LAZY_PLACEHOLDER, loadLazyImages } from './icons'
import { navState, runtime } from './state'

let subDropdownBound = false

export function bindSubDropdownHover(scroll: HTMLElement | null, container: HTMLElement | null): void {
  if (!scroll || !container || subDropdownBound) return
  subDropdownBound = true

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let activeDropdownIdx = -1

  function showDropdown(tabIdx: number): void {
    clearTimeout(hideTimer)
    activeDropdownIdx = tabIdx
    container!.querySelectorAll<HTMLElement>('.sub-dropdown').forEach((dd) => {
      const show = dd.dataset.parentIdx === String(tabIdx)
      dd.classList.toggle('sub-dropdown-visible', show)
      if (show) {
        const tab = scroll!.querySelectorAll<HTMLElement>('.nav-tab')[tabIdx]
        if (tab) {
          const tabRect = tab.getBoundingClientRect()
          const contRect = container!.getBoundingClientRect()
          const ddWidth = dd.offsetWidth
          const tabCenter = tabRect.left + tabRect.width / 2 - contRect.left
          const minLeft = ddWidth / 2 + 8
          const maxLeft = contRect.width - ddWidth / 2 - 8
          dd.style.left = Math.max(minLeft, Math.min(maxLeft, tabCenter)) + 'px'
        }
      }
    })
  }

  function hideAll(): void {
    hideTimer = setTimeout(() => {
      activeDropdownIdx = -1
      container!.querySelectorAll('.sub-dropdown').forEach((dd) => {
        dd.classList.remove('sub-dropdown-visible')
      })
    }, 150)
  }

  function hideAllImmediate(): void {
    clearTimeout(hideTimer)
    activeDropdownIdx = -1
    container!.querySelectorAll('.sub-dropdown').forEach((dd) => {
      dd.classList.remove('sub-dropdown-visible')
    })
  }

  if (isTouchDevice) {
    scroll.addEventListener('click', (e) => {
      const tab = (e.target as Element | null)?.closest<HTMLElement>('.nav-tab')
      if (tab && tab.dataset.hasChildren) {
        const idx = parseInt(tab.dataset.idx || '', 10)
        if (activeDropdownIdx === idx) {
          hideAllImmediate()
        } else {
          showDropdown(idx)
        }
      } else {
        hideAllImmediate()
      }
    })
    document.addEventListener('click', (e) => {
      const target = e.target as Element | null
      if (!target?.closest('#nav-scroll') && !target?.closest('#sub-dropdown-container')) {
        hideAllImmediate()
      }
    })
  } else {
    scroll.addEventListener(
      'mouseenter',
      (e) => {
        const tab = (e.target as Element | null)?.closest<HTMLElement>('.nav-tab')
        if (tab && tab.dataset.hasChildren) {
          showDropdown(parseInt(tab.dataset.idx || '', 10))
        } else if (tab) {
          hideAllImmediate()
        }
      },
      true
    )
    scroll.addEventListener('mouseleave', hideAll)
    container.addEventListener('mouseenter', () => {
      clearTimeout(hideTimer)
    })
    container.addEventListener('mouseleave', hideAll)
  }
}

export function renderNav(): void {
  const scroll = $('#nav-scroll')
  if (!scroll) return
  scroll.className = 'flex gap-7 px-6 overflow-x-auto scrollbar-hide max-w-full'
  scroll.innerHTML = navState.data
    .map((cat, i) => {
      const active = i === runtime.currentCatIdx
      const hasChildren = Boolean(cat.children && cat.children.length > 0)
      return (
        '<button type="button" class="nav-tab whitespace-nowrap text-base font-medium transition-all duration-200 border-b-2 pb-1.5 px-1 ' +
        (active
          ? 'text-primary border-primary opacity-100'
          : 'text-base-content/60 border-transparent opacity-70 hover:opacity-100') +
        '" data-idx="' +
        i +
        '"' +
        (hasChildren ? ' data-has-children="1"' : '') +
        '>' +
        escapeHtml(cat.title) +
        '</button>'
      )
    })
    .join('')

  const dropdownContainer = $('#sub-dropdown-container')
  if (!dropdownContainer) return
  dropdownContainer.innerHTML = ''
  navState.data.forEach((cat, i) => {
    if (!cat.children || cat.children.length === 0) return
    const dd = document.createElement('div')
    dd.className = 'sub-dropdown'
    dd.dataset.parentIdx = String(i)
    dd.innerHTML = cat.children
      .map(
        (ch) =>
          '<button type="button" class="sub-dropdown-item' +
          (runtime.currentSubId === ch.id ? ' sub-dropdown-active' : '') +
          '" data-sub-id="' +
          ch.id +
          '">' +
          escapeHtml(ch.title) +
          '</button>'
      )
      .join('')
    dropdownContainer.appendChild(dd)
  })

  bindSubDropdownHover(scroll, dropdownContainer)
}

export function linkCardHtml(link: Link, isLazy = false): string {
  const { iconSrc, originalIcon } = getClientIconSrc(link)
  const adminBtns = runtime.isAdmin
    ? '<div class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">' +
      '<button type="button" class="btn btn-ghost btn-xs btn-circle edit-link-btn text-xs" data-link-id="' +
      link.id +
      '">✏️</button>' +
      '<button type="button" class="btn btn-ghost btn-xs btn-circle delete-link-btn text-xs" data-link-id="' +
      link.id +
      '">🗑️</button></div>'
    : ''
  const desc = link.description ? escapeHtml(link.description) : ''
  const tooltipCls = desc ? ' tooltip tooltip-top' : ''
  const tooltipAttr = desc ? ' data-tip="' + desc + '"' : ''
  const imgAttrs = isLazy
    ? 'src="' + LAZY_PLACEHOLDER + '" data-src="' + escapeHtml(iconSrc) + '"'
    : 'src="' + escapeHtml(iconSrc) + '"'
  const originalAttr = originalIcon ? ' data-original-icon="' + escapeHtml(originalIcon) + '"' : ''

  return (
    '<a href="' +
    escapeHtml(link.url) +
    '" target="_blank" rel="noopener noreferrer" ' +
    'class="link-card glass-card rounded-3xl p-4 flex flex-col items-center justify-center gap-3 group cursor-pointer no-underline relative aspect-square' +
    tooltipCls +
    '" ' +
    tooltipAttr +
    'data-link-id="' +
    link.id +
    '" data-cat-id="' +
    link.category_id +
    '" data-title="' +
    escapeHtml(link.title) +
    '" data-url="' +
    escapeHtml(link.url) +
    '">' +
    adminBtns +
    '<div class="w-14 h-14 flex items-center justify-center flex-shrink-0">' +
    '<img ' +
    imgAttrs +
    ' alt="" class="w-10 h-10 object-contain" loading="lazy"' +
    originalAttr +
    '></div>' +
    '<div class="text-xs font-medium text-center text-base-content/80 truncate w-full leading-tight">' +
    (link.is_private ? '🔒 ' : '') +
    escapeHtml(link.title) +
    '</div>' +
    '</a>'
  )
}

export function renderGrid(): void {
  const container = $('#link-sections')
  if (!container) return
  container.innerHTML =
    navState.data
      .map((cat, i) => {
        const hidden = i !== runtime.currentCatIdx ? 'hidden' : ''
        const hasChildren = Boolean(cat.children && cat.children.length > 0)
        const isCatActive = i === runtime.currentCatIdx
        const showParent = !runtime.currentSubId || !hasChildren

        let gridsHtml =
          '<div id="grid-' +
          cat.id +
          '" class="sub-grid grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3' +
          (showParent ? '' : ' hidden') +
          '" data-sub-id="' +
          cat.id +
          '">' +
          cat.items.map((link) => linkCardHtml(link, !isCatActive || !showParent)).join('') +
          '</div>'

        if (hasChildren && cat.children) {
          gridsHtml += cat.children
            .map((ch) => {
              const isSubActive = isCatActive && runtime.currentSubId === ch.id
              return (
                '<div id="grid-' +
                ch.id +
                '" class="sub-grid grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3' +
                (isSubActive ? '' : ' hidden') +
                '" data-sub-id="' +
                ch.id +
                '">' +
                ch.items.map((link) => linkCardHtml(link, !isSubActive)).join('') +
                '</div>'
              )
            })
            .join('')
        }

        let emptyMsgs = ''
        if (cat.items.length === 0) {
          emptyMsgs +=
            '<div class="text-center text-base-content/30 py-16 text-sm grid-empty-msg' +
            (showParent ? '' : ' hidden') +
            '" data-sub-id="' +
            cat.id +
            '">暂无链接</div>'
        }
        if (hasChildren && cat.children) {
          emptyMsgs += cat.children
            .map((ch) => {
              if (ch.items.length > 0) return ''
              return (
                '<div id="empty-' +
                ch.id +
                '" class="text-center text-base-content/30 py-16 text-sm grid-empty-msg' +
                (runtime.currentSubId === ch.id ? '' : ' hidden') +
                '" data-sub-id="' +
                ch.id +
                '">暂无链接</div>'
              )
            })
            .join('')
        }

        return (
          '<section class="cat-section ' +
          hidden +
          '" data-cat-id="' +
          cat.id +
          '">' +
          gridsHtml +
          emptyMsgs +
          '</section>'
        )
      })
      .join('') +
    '<section id="search-results" class="hidden"><div id="search-results-grid" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3"></div>' +
    '<div id="search-empty" class="text-center text-base-content/30 py-16 text-sm hidden">未找到匹配的链接</div></section>'

  loadLazyImages(container.querySelector('.cat-section:not(.hidden)'))
}

export function renderDock(actions: DockActions): void {
  $('.floating-dock')?.remove()
  $('.dock')?.remove()

  const dock = document.createElement('div')
  dock.className = 'floating-dock'
  const inner = document.createElement('div')
  inner.className = 'flex items-center justify-center gap-1'

  const themeBtnHtml =
    '<button type="button" id="btn-theme-toggle" class="dock-item"><svg id="icon-moon" class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg><svg id="icon-sun" class="dock-icon hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg><span class="dock-text">主题</span></button>'
  const repoLinkHtml =
    '<a href="https://github.com/skfoa/cf-worker-nav" target="_blank" rel="noopener" class="dock-item"><svg class="dock-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg><span class="dock-text">仓库</span></a>'

  if (!runtime.isAdmin) {
    const isGhostAdmin = window.location.pathname === '/admin' || window.location.search.includes('admin')
    const loginBtn = isGhostAdmin
      ? '<button type="button" id="btn-login" class="dock-item"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg><span class="dock-text">登录</span></button>'
      : ''
    inner.innerHTML = loginBtn + themeBtnHtml + repoLinkHtml
  } else {
    inner.innerHTML =
      '<button type="button" id="btn-add-link" class="dock-item"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg><span class="dock-text">添加</span></button>' +
      '<button type="button" id="btn-add-cat" class="dock-item"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7h4l3-3h10a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1z"/></svg><span class="dock-text">分类</span></button>' +
      '<button type="button" id="btn-toggle-sort" class="dock-item' + (runtime.sortMode ? ' dock-active' : '') + '"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg><span class="dock-text">排序</span></button>' +
      '<button type="button" id="btn-batch-mode" class="dock-item' + (runtime.batchMode ? ' dock-active' : '') + '"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span class="dock-text">多选</span></button>' +
      '<button type="button" id="btn-settings" class="dock-item"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span class="dock-text">设置</span></button>' +
      '<button type="button" id="btn-logs" class="dock-item"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><span class="dock-text">日志</span></button>' +
      '<button type="button" id="btn-logout" class="dock-item"><svg class="dock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg><span class="dock-text">退出</span></button>' +
      themeBtnHtml +
      repoLinkHtml
  }

  dock.appendChild(inner)
  document.body.appendChild(dock)

  $('#btn-login')?.addEventListener('click', actions.onLogin)
  $('#btn-add-link')?.addEventListener('click', actions.onAddLink)
  $('#btn-add-cat')?.addEventListener('click', actions.onAddCat)
  $('#btn-toggle-sort')?.addEventListener('click', actions.onToggleSort)
  $('#btn-batch-mode')?.addEventListener('click', actions.onToggleBatch)
  $('#btn-settings')?.addEventListener('click', actions.onSettings)
  $('#btn-logs')?.addEventListener('click', actions.onLogs)
  $('#btn-logout')?.addEventListener('click', actions.onLogout)
  $('#btn-theme-toggle')?.addEventListener('click', actions.onToggleTheme)

  updateThemeIcons(document.documentElement.getAttribute('data-theme') || 'dark')
}

export function renderAll(actions: DockActions): void {
  renderNav()
  renderGrid()
  renderDock(actions)
}

export function applyBackground(url: string): void {
  const safeUrl = sanitizeCssUrl(url)
  let bgEl = document.querySelector<HTMLElement>('.bg-image-layer')
  if (safeUrl) {
    if (!bgEl) {
      bgEl = document.createElement('div')
      bgEl.className = 'bg-image-layer fixed inset-0 z-[-2] bg-cover bg-center bg-no-repeat pointer-events-none'
      document.body.insertBefore(bgEl, document.body.firstChild)
    }
    bgEl.style.backgroundImage = "url('" + safeUrl + "')"
    document.body.classList.remove('bg-base-300')
    document.body.classList.add('bg-transparent')
  } else {
    bgEl?.remove()
    document.body.classList.remove('bg-transparent')
    document.body.classList.add('bg-base-300')
  }
}

export function updateThemeIcons(theme: string): void {
  $('#icon-moon')?.classList.toggle('hidden', theme === 'light')
  $('#icon-sun')?.classList.toggle('hidden', theme === 'dark')
}

export function initTheme(): void {
  const saved = localStorage.getItem('nav_theme') || 'dark'
  document.documentElement.setAttribute('data-theme', saved)
  updateThemeIcons(saved)
}

export function toggleTheme(): void {
  const current = document.documentElement.getAttribute('data-theme')
  const next = current === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('nav_theme', next)
  updateThemeIcons(next)
}
