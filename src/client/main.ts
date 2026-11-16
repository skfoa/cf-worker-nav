/**
 * src/client/main.ts - 客户端入口
 */
import type { DockActions } from './types'
import { exitBatchMode, renderBatchBar, syncBatchSelectionStyles, toggleBatchMode } from './batch'
import { $ } from './dom'
import { initEvents, initSearchEngines } from './events'
import { initImageErrorFallback, loadLazyImages } from './icons'
import { doLogin, showAddCatModal, showAddLinkModal, showLogsModal } from './modals'
import { setDockActions } from './refresh'
import { bindSubDropdownHover, initTheme, renderDock, toggleTheme } from './render'
import { showSettings } from './settings'
import { disableSort, loadAdminScripts, toggleSortMode } from './sort'
import { getAllLinks, runtime } from './state'
import { bindVisitTracking } from './visit'

const actions: DockActions = {
  onLogin: doLogin,
  onAddLink: showAddLinkModal,
  onAddCat: showAddCatModal,
  onToggleSort: () => {
    exitBatchMode()
    toggleSortMode()
  },
  onToggleBatch: () => {
    if (runtime.sortMode) {
      runtime.sortMode = false
      $('#btn-toggle-sort')?.classList.remove('dock-active')
      disableSort()
    }
    toggleBatchMode()
  },
  onSettings: showSettings,
  onLogs: () => {
    void showLogsModal()
  },
  onLogout: async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    window.location.reload()
  },
  onToggleTheme: toggleTheme,
}

setDockActions(actions, () => {
  if (!runtime.batchMode) return
  const liveIds = new Set(getAllLinks().map((l) => l.id))
  for (const id of Array.from(runtime.selectedLinkIds)) {
    if (!liveIds.has(id)) runtime.selectedLinkIds.delete(id)
  }
  syncBatchSelectionStyles()
  renderBatchBar()
})
initTheme()
initSearchEngines()
renderDock(actions)
bindSubDropdownHover($('#nav-scroll'), $('#sub-dropdown-container'))
if (runtime.isAdmin) {
  loadAdminScripts()
}
initEvents()
bindVisitTracking()
initImageErrorFallback()
loadLazyImages($('.cat-section:not(.hidden)'))
