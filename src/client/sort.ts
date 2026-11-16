/**
 * src/client/sort.ts - SortableJS 动态加载与卡片拖拽排序
 */
import { api } from './api'
import { $, $$, toast } from './dom'
import { navState, runtime } from './state'

export function loadAdminScripts(): void {
  if (typeof window.Sortable !== 'undefined' || document.getElementById('sortable-script')) return
  const script = document.createElement('script')
  script.id = 'sortable-script'
  script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js'
  document.head.appendChild(script)
}

export function enableSort(): void {
  const SortableCls = window.Sortable
  if (typeof SortableCls === 'undefined') return
  runtime.sortableInstances = []
  $$<HTMLElement>('.cat-section:not(.hidden) [id^="grid-"]').forEach((grid) => {
    if (grid.id === 'grid--1') return
    const instance = new SortableCls(grid, {
      animation: 200,
      ghostClass: 'opacity-30',
      onEnd: async () => {
        const items = Array.from(grid.children)
          .map((el, i) => ({
            id: parseInt((el as HTMLElement).dataset.linkId || '', 10),
            sort_order: i,
          }))
          .filter((x) => !Number.isNaN(x.id))
        try {
          await api('/api/link/reorder', { method: 'POST', body: JSON.stringify(items) })
        } catch {
          toast('排序保存失败', 'error')
        }
      },
    })
    runtime.sortableInstances.push(instance)
  })
}

export function disableSort(): void {
  runtime.sortableInstances.forEach((s) => s.destroy())
  runtime.sortableInstances = []
}

export function toggleSortMode(): void {
  const activeCat = navState.data[runtime.currentCatIdx]
  if (!runtime.sortMode && activeCat && activeCat.id === -1) {
    toast('「常用推荐」为自动汇总分类，请切换到具体分类后再排序', 'info')
    return
  }
  runtime.sortMode = !runtime.sortMode
  $('#btn-toggle-sort')?.classList.toggle('dock-active', runtime.sortMode)
  if (runtime.sortMode) enableSort()
  else disableSort()
  toast(runtime.sortMode ? '拖拽排序模式已开启' : '排序已关闭', 'info')
}

