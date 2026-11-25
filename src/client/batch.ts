/**
 * src/client/batch.ts - 后台卡片多选与批量操作栏
 */
import type { BatchActionResponse } from './types'
import { api } from './api'
import { $, $$, escapeHtml, sysConfirm, toast } from './dom'
import { reloadData } from './refresh'
import { navState, runtime } from './state'
import { clearVisitCooldown } from './visit'
import { LETTER_ICON_TOKEN } from './icons'

const SELECTED_CLASSES = ['ring-2', 'ring-primary', 'bg-primary/10']

export function syncBatchSelectionStyles(): void {
  $$<HTMLElement>('.link-card[data-link-id]').forEach((card) => {
    const id = parseInt(card.dataset.linkId || '', 10)
    const selected = runtime.batchMode && runtime.selectedLinkIds.has(id)
    SELECTED_CLASSES.forEach((cls) => card.classList.toggle(cls, selected))
  })
}

function buildCategoryOptionsHtml(): string {
  const cats = navState.data.filter((c) => c.id !== -1)
  let html = ''
  cats.forEach((c) => {
    html += '<option value="' + c.id + '">' + escapeHtml(c.title) + '</option>'
    c.children?.forEach((ch) => {
      html += '<option value="' + ch.id + '">└ ' + escapeHtml(ch.title) + '</option>'
    })
  })
  return html
}

async function runBatchAction(
  payload:
    | { action: 'move'; ids: number[]; category_id: number }
    | { action: 'privacy'; ids: number[]; is_private: 0 | 1 }
    | { action: 'delete'; ids: number[] }
    | { action: 'icon'; ids: number[]; icon: string },
  successLabel: string
): Promise<void> {
  try {
    const BATCH_LIMIT = 100
    let totalUpdated = 0
    let totalSkipped = 0
    for (let i = 0; i < payload.ids.length; i += BATCH_LIMIT) {
      const idSlice = payload.ids.slice(i, i + BATCH_LIMIT)
      const chunkPayload = { ...payload, ids: idSlice }
      const res = await api<BatchActionResponse>('/api/link/batch', {
        method: 'POST',
        body: JSON.stringify(chunkPayload),
      })
      totalUpdated += res.updated || 0
      totalSkipped += res.skipped || 0
      if (payload.action === 'delete') {
        idSlice.forEach((id) => clearVisitCooldown(id))
      }
    }
    const skipNote = totalSkipped > 0 ? `，跳过 ${totalSkipped} 条（重复或已在目标分类）` : ''
    toast(`${successLabel} ${totalUpdated} 条${skipNote}`, 'success')
    exitBatchMode()
    await reloadData()
  } catch (err) {
    toast('批量操作失败: ' + (err as Error).message, 'error')
  }
}

export function renderBatchBar(): void {
  $('#batch-action-bar')?.remove()
  if (!runtime.batchMode) return

  const bar = document.createElement('div')
  bar.id = 'batch-action-bar'
  bar.className =
    'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 nav-modal-box !p-2.5 !rounded-2xl flex flex-wrap items-center justify-center gap-2 shadow-2xl max-w-[95vw]'

  const count = runtime.selectedLinkIds.size
  bar.innerHTML =
    '<span class="text-xs font-medium px-2 text-base-content/80">已选 <b class="text-primary">' +
    count +
    '</b> 项</span>' +
    '<button type="button" id="batch-select-all" class="btn btn-ghost btn-xs">全选当前</button>' +
    '<button type="button" id="batch-clear-sel" class="btn btn-ghost btn-xs">清空</button>' +
    '<div class="flex items-center gap-1">' +
    '<select id="batch-target-cat" class="select select-bordered select-xs max-w-[130px]">' +
    buildCategoryOptionsHtml() +
    '</select>' +
    '<button type="button" id="batch-move" class="btn btn-primary btn-xs">移动</button>' +
    '</div>' +
    '<button type="button" id="batch-set-private" class="btn btn-outline btn-xs">🔒 设私有</button>' +
    '<button type="button" id="batch-set-public" class="btn btn-outline btn-xs">🌐 设公开</button>' +
    '<button type="button" id="batch-set-letter-icon" class="btn btn-outline btn-xs">🔤 首字母图标</button>' +
    '<button type="button" id="batch-delete" class="btn btn-error btn-outline btn-xs">🗑️ 删除</button>' +
    '<button type="button" id="batch-exit" class="btn btn-ghost btn-xs">完成</button>'

  document.body.appendChild(bar)

  $('#batch-select-all')?.addEventListener('click', () => {
    const searchResults = $('#search-results')
    const cards =
      searchResults && !searchResults.classList.contains('hidden')
        ? $$<HTMLElement>('#search-results-grid .link-card[data-link-id]')
        : $$<HTMLElement>('.cat-section:not(.hidden) .sub-grid:not(.hidden) .link-card[data-link-id]')
    cards.forEach((card) => {
      const id = parseInt(card.dataset.linkId || '', 10)
      if (!Number.isNaN(id)) runtime.selectedLinkIds.add(id)
    })
    syncBatchSelectionStyles()
    renderBatchBar()
  })

  $('#batch-clear-sel')?.addEventListener('click', () => {
    runtime.selectedLinkIds.clear()
    syncBatchSelectionStyles()
    renderBatchBar()
  })

  $('#batch-exit')?.addEventListener('click', () => {
    exitBatchMode()
  })

  $('#batch-move')?.addEventListener('click', () => {
    const ids = Array.from(runtime.selectedLinkIds)
    if (ids.length === 0) {
      toast('请先点击选择要操作的链接卡片', 'info')
      return
    }
    const catSelect = $<HTMLSelectElement>('#batch-target-cat')
    const categoryId = parseInt(catSelect?.value || '', 10)
    if (Number.isNaN(categoryId)) return
    void runBatchAction({ action: 'move', ids, category_id: categoryId }, '已移动')
  })

  $('#batch-set-private')?.addEventListener('click', () => {
    const ids = Array.from(runtime.selectedLinkIds)
    if (ids.length === 0) {
      toast('请先点击选择要操作的链接卡片', 'info')
      return
    }
    void runBatchAction({ action: 'privacy', ids, is_private: 1 }, '已设为私有')
  })

  $('#batch-set-public')?.addEventListener('click', () => {
    const ids = Array.from(runtime.selectedLinkIds)
    if (ids.length === 0) {
      toast('请先点击选择要操作的链接卡片', 'info')
      return
    }
    void runBatchAction({ action: 'privacy', ids, is_private: 0 }, '已设为公开')
  })

  $('#batch-set-letter-icon')?.addEventListener('click', () => {
    const ids = Array.from(runtime.selectedLinkIds)
    if (ids.length === 0) {
      toast('请先点击选择要操作的链接卡片', 'info')
      return
    }
    void runBatchAction({ action: 'icon', ids, icon: LETTER_ICON_TOKEN }, '已设为本地首字母图标')
  })

  $('#batch-delete')?.addEventListener('click', () => {
    const ids = Array.from(runtime.selectedLinkIds)
    if (ids.length === 0) {
      toast('请先点击选择要删除的链接卡片', 'info')
      return
    }
    sysConfirm(`确定批量删除选中的 ${ids.length} 条链接吗？此操作不可恢复！`, () => {
      void runBatchAction({ action: 'delete', ids }, '已删除')
    })
  })
}

export function toggleCardSelection(linkId: number): void {
  if (runtime.selectedLinkIds.has(linkId)) {
    runtime.selectedLinkIds.delete(linkId)
  } else {
    runtime.selectedLinkIds.add(linkId)
  }
  syncBatchSelectionStyles()
  renderBatchBar()
}

export function exitBatchMode(): void {
  if (!runtime.batchMode) return
  runtime.batchMode = false
  runtime.selectedLinkIds.clear()
  $('#btn-batch-mode')?.classList.remove('dock-active')
  syncBatchSelectionStyles()
  renderBatchBar()
}

export function toggleBatchMode(): void {
  if (runtime.batchMode) {
    exitBatchMode()
    toast('多选模式已关闭', 'info')
    return
  }
  runtime.batchMode = true
  runtime.selectedLinkIds.clear()
  $('#btn-batch-mode')?.classList.add('dock-active')
  renderBatchBar()
  toast('已进入多选模式：点击卡片即可勾选', 'info')
}
