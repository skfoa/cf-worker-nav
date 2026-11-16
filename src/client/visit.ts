/**
 * src/client/visit.ts - 点击上报（30 分钟同书签去重冷却）
 */
import { runtime } from './state'

const VISIT_COOLDOWN_MS = 30 * 60 * 1000
const VISIT_STORAGE_KEY = 'nav_visit_ts'
const memoryVisitMap: Record<number, number> = {}

export function shouldRecordVisit(linkId: number): boolean {
  const now = Date.now()
  try {
    const raw = localStorage.getItem(VISIT_STORAGE_KEY)
    const records: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    if (records[linkId] && now - records[linkId] < VISIT_COOLDOWN_MS) {
      return false
    }
    for (const k in records) {
      if (now - records[k] >= VISIT_COOLDOWN_MS) delete records[k]
    }
    records[linkId] = now
    localStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(records))
    return true
  } catch {
    if (memoryVisitMap[linkId] && now - memoryVisitMap[linkId] < VISIT_COOLDOWN_MS) {
      return false
    }
    memoryVisitMap[linkId] = now
    return true
  }
}

export function clearVisitCooldown(linkId: number): void {
  delete memoryVisitMap[linkId]
  try {
    const raw = localStorage.getItem(VISIT_STORAGE_KEY)
    if (!raw) return
    const records = JSON.parse(raw) as Record<string, number>
    delete records[linkId]
    localStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(records))
  } catch {
    /* ignore */
  }
}

export function bindVisitTracking(): void {
  document.addEventListener('click', (e) => {
    if (runtime.sortMode || runtime.batchMode || e.defaultPrevented) return
    const target = e.target as Element | null
    if (!target || target.closest('.edit-link-btn, .delete-link-btn')) return
    const card = target.closest<HTMLElement>('.link-card')
    if (card?.dataset.linkId) {
      const id = parseInt(card.dataset.linkId, 10)
      if (!Number.isNaN(id) && shouldRecordVisit(id)) {
        fetch('/api/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        }).catch(() => {})
      }
    }
  })
}
