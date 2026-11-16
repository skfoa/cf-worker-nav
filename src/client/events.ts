/**
 * src/client/events.ts - 分类切换、搜索、管理交互与全局快捷键
 */
import { syncBatchSelectionStyles, toggleCardSelection } from './batch'
import { $, $$, sysConfirm } from './dom'
import { loadLazyImages } from './icons'
import { deleteLink, showEditCatModal, showEditLinkModal, showLinkActionModal } from './modals'
import { linkCardHtml } from './render'
import { disableSort, enableSort } from './sort'
import { getAllLinks, navState, runtime } from './state'

let currentEngine = localStorage.getItem('nav_engine') || 'google'
let currentEngineUrl = 'https://www.google.com/search?q='

function updateTabStyles(activeIdx: number): void {
  $$('.nav-tab').forEach((t, i) => {
    const isActive = i === activeIdx
    t.classList.toggle('text-primary', isActive)
    t.classList.toggle('border-primary', isActive)
    t.classList.toggle('opacity-100', isActive)
    t.classList.toggle('text-base-content/60', !isActive)
    t.classList.toggle('border-transparent', !isActive)
    t.classList.toggle('opacity-70', !isActive)
  })
}

function updateActiveSectionGrids(): void {
  const activeSection = $$<HTMLElement>('.cat-section')[runtime.currentCatIdx]
  if (!activeSection) return
  activeSection.querySelectorAll<HTMLElement>('.sub-grid, .grid-empty-msg').forEach((el) => {
    const subId = parseInt(el.dataset.subId || '', 10)
    const catId = parseInt(activeSection.dataset.catId || '', 10)
    const isTarget = runtime.currentSubId ? subId === runtime.currentSubId : subId === catId
    el.classList.toggle('hidden', !isTarget)
  })
  loadLazyImages(activeSection)
}

export function initSearchEngines(): void {
  const tabs = $$<HTMLElement>('.search-engine-tab')
  tabs.forEach((tab) => {
    if (tab.dataset.engine === currentEngine) {
      currentEngineUrl = tab.dataset.url || ''
    }
    tab.addEventListener('click', function () {
      currentEngine = this.dataset.engine || 'google'
      currentEngineUrl = this.dataset.url || ''
      localStorage.setItem('nav_engine', currentEngine)
      tabs.forEach((t) => {
        t.className =
          t.dataset.engine === currentEngine
            ? 'search-engine-tab px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-primary-content shadow-md shadow-primary/30'
            : 'search-engine-tab px-4 py-1.5 rounded-full text-sm font-medium text-base-content/50 hover:text-base-content/80'
      })
      const input = $<HTMLInputElement>('#search-input')
      if (input) {
        input.placeholder = currentEngine === 'local' ? '站内搜索...' : input.dataset?.placeholder || '搜索...'
        if (currentEngine === 'local' && input.value.trim()) {
          input.dispatchEvent(new Event('input'))
        } else if (currentEngine !== 'local') {
          $$('.cat-section').forEach((s, i) => s.classList.toggle('hidden', i !== runtime.currentCatIdx))
          $('#search-results')?.classList.add('hidden')
        }
      }
    })
  })
  tabs.forEach((t) => {
    t.className =
      t.dataset.engine === currentEngine
        ? 'search-engine-tab px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-primary-content shadow-md shadow-primary/30'
        : 'search-engine-tab px-4 py-1.5 rounded-full text-sm font-medium text-base-content/50 hover:text-base-content/80'
  })
}

export function initEvents(): void {
  // 分类/子分类切换
  document.addEventListener('click', (e) => {
    const target = e.target as Element | null
    const tab = target?.closest<HTMLElement>('.nav-tab')
    if (tab) {
      const idx = parseInt(tab.dataset.idx || '', 10)
      if (Number.isNaN(idx)) return
      runtime.currentCatIdx = idx
      runtime.currentSubId = null
      updateTabStyles(idx)
      $$('.sub-dropdown-item').forEach((i) => i.classList.remove('sub-dropdown-active'))
      $$('.cat-section').forEach((s, i) => s.classList.toggle('hidden', i !== idx))
      updateActiveSectionGrids()
      $('#search-results')?.classList.add('hidden')
      const searchInput = $<HTMLInputElement>('#search-input')
      if (searchInput) searchInput.value = ''
      $('#search-clear')?.classList.add('hidden')
      if (runtime.sortMode) {
        disableSort()
        enableSort()
      }
      if (runtime.batchMode) syncBatchSelectionStyles()
      return
    }

    const subItem = target?.closest<HTMLElement>('.sub-dropdown-item')
    if (subItem) {
      const subId = parseInt(subItem.dataset.subId || '', 10)
      runtime.currentSubId = runtime.currentSubId === subId ? null : subId
      const parentEl = subItem.closest<HTMLElement>('.sub-dropdown')
      const parentIdx = parseInt(parentEl?.dataset.parentIdx || '', 10)
      if (!Number.isNaN(parentIdx) && runtime.currentCatIdx !== parentIdx) {
        runtime.currentCatIdx = parentIdx
        updateTabStyles(runtime.currentCatIdx)
        $$('.cat-section').forEach((s, i) => s.classList.toggle('hidden', i !== runtime.currentCatIdx))
        $('#search-results')?.classList.add('hidden')
        const searchInput = $<HTMLInputElement>('#search-input')
        if (searchInput) searchInput.value = ''
        $('#search-clear')?.classList.add('hidden')
      }
      $$<HTMLElement>('.sub-dropdown-item').forEach((i) => {
        i.classList.toggle('sub-dropdown-active', parseInt(i.dataset.subId || '', 10) === runtime.currentSubId)
      })
      updateActiveSectionGrids()
      if (runtime.sortMode) {
        disableSort()
        enableSort()
      }
      if (runtime.batchMode) syncBatchSelectionStyles()
    }
  })

  // 搜索逻辑
  const searchInput = $<HTMLInputElement>('#search-input')
  const searchClear = $('#search-clear')

  const doSearch = (): void => {
    const q = searchInput?.value?.trim()
    if (!q || !searchInput) return
    if (currentEngine === 'local') {
      searchInput.dispatchEvent(new Event('input'))
    } else {
      window.open(currentEngineUrl + encodeURIComponent(q), '_blank')
    }
  }

  $('#search-go')?.addEventListener('click', doSearch)

  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        doSearch()
      }
    })
    let searchTimer: ReturnType<typeof setTimeout> | undefined
    searchInput.addEventListener('input', function () {
      const q = this.value.trim().toLowerCase()
      searchClear?.classList.toggle('hidden', !q)
      if (currentEngine !== 'local' && q) return
      if (!q) {
        clearTimeout(searchTimer)
        $$('.cat-section').forEach((s, i) => s.classList.toggle('hidden', i !== runtime.currentCatIdx))
        $('#search-results')?.classList.add('hidden')
        return
      }
      clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        $$('.cat-section').forEach((s) => s.classList.add('hidden'))
        const results = $('#search-results')
        const grid = $('#search-results-grid')
        const empty = $('#search-empty')
        if (!results || !grid) return
        results.classList.remove('hidden')
        const scored: Array<{ link: ReturnType<typeof getAllLinks>[number]; score: number }> = []
        getAllLinks().forEach((l) => {
          const title = (l.title || '').toLowerCase()
          const desc = (l.description || '').toLowerCase()
          const url = (l.url || '').toLowerCase()
          let score = 0
          if (title.includes(q)) score += 100
          if (desc.includes(q)) score += 10
          if (url.includes(q)) score += 1
          if (score > 0) scored.push({ link: l, score })
        })
        scored.sort((a, b) => b.score - a.score)
        grid.innerHTML = scored.map((s) => linkCardHtml(s.link)).join('')
        empty?.classList.toggle('hidden', scored.length > 0)
        if (runtime.batchMode) syncBatchSelectionStyles()
      }, 200)
    })
  }

  searchClear?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = ''
      searchInput.dispatchEvent(new Event('input'))
    }
  })

  // 编辑/删除与批量多选点击拦截
  document.addEventListener('click', (e) => {
    const target = e.target as Element | null
    const editBtn = target?.closest<HTMLElement>('.edit-link-btn')
    if (editBtn) {
      e.preventDefault()
      e.stopPropagation()
      const id = parseInt(editBtn.dataset.linkId || '', 10)
      const link = getAllLinks().find((l) => l.id === id)
      if (link) showEditLinkModal(link)
      return
    }
    const deleteBtn = target?.closest<HTMLElement>('.delete-link-btn')
    if (deleteBtn) {
      e.preventDefault()
      e.stopPropagation()
      const id = parseInt(deleteBtn.dataset.linkId || '', 10)
      sysConfirm('确定删除？', () => {
        void deleteLink(id)
      })
      return
    }
    if (runtime.batchMode) {
      const card = target?.closest<HTMLElement>('.link-card[data-link-id]')
      if (card) {
        e.preventDefault()
        const id = parseInt(card.dataset.linkId || '', 10)
        if (!Number.isNaN(id)) toggleCardSelection(id)
      }
    }
  })

  // 移动端长按编辑/删除
  let longPressTimer: ReturnType<typeof setTimeout> | undefined
  let longPressTriggered = false

  document.addEventListener(
    'touchstart',
    (e) => {
      if (!runtime.isAdmin || runtime.batchMode) return
      const card = (e.target as Element | null)?.closest<HTMLElement>('.link-card')
      if (!card) return
      longPressTriggered = false
      longPressTimer = setTimeout(() => {
        longPressTriggered = true
        e.preventDefault()
        const id = parseInt(card.dataset.linkId || '', 10)
        const link = getAllLinks().find((l) => l.id === id)
        if (link) showLinkActionModal(link)
      }, 500)
    },
    { passive: false }
  )

  document.addEventListener('touchend', () => {
    clearTimeout(longPressTimer)
  })

  document.addEventListener('touchmove', () => {
    clearTimeout(longPressTimer)
  })

  document.addEventListener(
    'click',
    (e) => {
      if (longPressTriggered) {
        e.preventDefault()
        e.stopPropagation()
        longPressTriggered = false
      }
    },
    true
  )

  // 分类右键编辑/删除
  document.addEventListener('contextmenu', (e) => {
    if (!runtime.isAdmin) return
    const tab = (e.target as Element | null)?.closest<HTMLElement>('.nav-tab')
    if (!tab) return
    e.preventDefault()
    const idx = parseInt(tab.dataset.idx || '', 10)
    if (Number.isNaN(idx) || !navState.data[idx]) return
    showEditCatModal(navState.data[idx])
  })

  // 全局快捷键
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

    if (e.key === 'Escape') {
      const appModal = $<HTMLDialogElement>('#app-modal')
      const sysModal = $<HTMLDialogElement>('#sys-modal')
      if (appModal?.open) {
        appModal.close()
        return
      }
      if (sysModal?.open) {
        sysModal.close()
        return
      }
      const si = $<HTMLInputElement>('#search-input')
      if (si && si.value) {
        si.value = ''
        si.dispatchEvent(new Event('input'))
        si.blur()
        return
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      const si = $<HTMLInputElement>('#search-input')
      if (si) {
        si.focus()
        si.select()
      }
      return
    }

    if (e.key === 'Enter' && isTyping && document.activeElement === $('#search-input')) {
      if (currentEngine === 'local') {
        const firstCard = $<HTMLElement>('#search-results-grid .link-card')
        if (firstCard) {
          e.preventDefault()
          firstCard.click()
        }
      }
    }
  })
}
