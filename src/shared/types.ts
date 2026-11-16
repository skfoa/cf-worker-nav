/**
 * src/shared/types.ts - 前后端共享的数据模型类型定义
 */

export interface Category {
  id: number
  title: string
  sort_order: number
  is_private: number
  parent_id?: number | null
  created_at: number
  updated_at: number
}

export interface Link {
  id: number
  category_id: number
  title: string
  url: string
  description: string
  icon: string
  sort_order: number
  is_private: number
  visits: number
  created_at: number
  updated_at: number
}

export interface CategoryWithItems extends Category {
  items: Link[]
  children?: CategoryWithItems[]
}

export interface SiteConfig {
  title?: string
  bg_image?: string
  [key: string]: string | undefined
}

