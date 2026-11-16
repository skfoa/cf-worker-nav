/**
 * src/client/types.ts - 客户端专用类型定义
 */
import type { CategoryWithItems, SiteConfig } from '../shared/types'

export type { Category, Link, CategoryWithItems, SiteConfig } from '../shared/types'

export interface NavState {
  data: CategoryWithItems[]
  config: SiteConfig
  isRoot: boolean
  isAdmin: boolean
}

export interface LogEntry {
  id: number
  created_at: number | string
  ip?: string
  region?: string
  level: string
  action: string
  details?: string
}

export interface LogsResponse {
  logs: LogEntry[]
  total: number
}

export interface ImportResponse {
  success: boolean
  count: number
  categories_added: number
  skipped_count: number
  skipped_urls: string[]
}

export interface DataResponse {
  nav: CategoryWithItems[]
  config: SiteConfig
}

export interface TokenItem {
  id: number
  name: string
  created_at: number
}

export interface TokenCreateResponse {
  id: number
  name: string
  token: string
}

export interface LinkMetaResponse {
  success: boolean
  title: string
  description: string
  icon: string
  warning?: string
}

export interface BatchActionResponse {
  success: boolean
  updated: number
  skipped: number
}

export interface ImportLinkItem {
  name?: string
  title?: string
  url: string
  description?: string
  icon?: string
  is_private?: number
}

export interface ImportGroup {
  category: string
  parent_category?: string
  is_private?: number
  items: ImportLinkItem[]
}

export interface DockActions {
  onLogin: () => void
  onAddLink: () => void
  onAddCat: () => void
  onToggleSort: () => void
  onToggleBatch: () => void
  onSettings: () => void
  onLogs: () => void
  onLogout: () => void
  onToggleTheme: () => void
}

export interface SortableInstance {
  destroy(): void
}

export interface SortableConstructor {
  new (
    el: HTMLElement,
    options: {
      animation?: number
      draggable?: string
      handle?: string
      ghostClass?: string
      onEnd?: () => void | Promise<void>
    }
  ): SortableInstance
}

declare global {
  interface Window {
    __NAV_STATE__?: NavState
    Sortable?: SortableConstructor
  }
}
