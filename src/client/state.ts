/**
 * src/client/state.ts - 客户端全局状态与数据查询辅助
 */
import type { CategoryWithItems, Link, NavState, SortableInstance } from './types'

const fallbackState: NavState = { data: [], config: {}, isRoot: false, isAdmin: false }

export const navState: NavState = window.__NAV_STATE__ || fallbackState
if (!navState.config) navState.config = {}
if (!Array.isArray(navState.data)) navState.data = []

export const runtime = {
  token: '',
  isAdmin: Boolean(navState.isAdmin),
  currentCatIdx: 0,
  currentSubId: null as number | null,
  sortMode: false,
  batchMode: false,
  selectedLinkIds: new Set<number>(),
  sortableInstances: [] as SortableInstance[],
}

export function findCatById(id: number): CategoryWithItems | null {
  for (const cat of navState.data) {
    if (cat.id === id) return cat
    if (cat.children) {
      const child = cat.children.find((ch) => ch.id === id)
      if (child) return child
    }
  }
  return null
}

/** 获取全部书签链接（含子分类，跳过虚拟分类 -1） */
export function getAllLinks(): Link[] {
  const links: Link[] = []
  for (const cat of navState.data) {
    if (cat.id === -1) continue
    links.push(...cat.items)
    if (cat.children) {
      for (const ch of cat.children) links.push(...ch.items)
    }
  }
  return links
}
