/**
 * src/client/refresh.ts - 数据热重载与重绘协调
 */
import type { DataResponse, DockActions } from './types'
import { api } from './api'
import { renderAll } from './render'
import { disableSort, enableSort } from './sort'
import { navState, runtime } from './state'

let dockActions: DockActions | null = null
let afterReloadHook: (() => void) | null = null

export function setDockActions(actions: DockActions, onAfterReload?: () => void): void {
  dockActions = actions
  afterReloadHook = onAfterReload ?? null
}

export function getDockActions(): DockActions {
  if (!dockActions) {
    throw new Error('DockActions not initialized')
  }
  return dockActions
}

export async function reloadData(): Promise<void> {
  try {
    const fullData = await api<DataResponse>('/api/data')
    navState.data = fullData.nav
    if (fullData.config) {
      navState.config = fullData.config
    }
    if (runtime.currentCatIdx >= navState.data.length) runtime.currentCatIdx = 0
    if (runtime.currentSubId != null) {
      const curCat = navState.data[runtime.currentCatIdx]
      const hasSub = Boolean(curCat?.children?.some((ch) => ch.id === runtime.currentSubId))
      if (!hasSub) runtime.currentSubId = null
    }
    if (dockActions) {
      renderAll(dockActions)
    }
    if (runtime.sortMode) {
      disableSort()
      enableSort()
    }
    afterReloadHook?.()
  } catch {
    /* silent: api() handles auth reload */
  }
}

