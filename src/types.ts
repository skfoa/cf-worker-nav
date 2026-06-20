/**
 * src/types.ts - 全局类型定义 + Zod Schema
 */
import { z } from 'zod'

// =====================================
// Cloudflare Bindings
// =====================================

export type Env = {
  DB: D1Database
  PASSWORD?: string
  TOKEN_SALT?: string
  ALLOWED_ORIGIN?: string
  TITLE?: string
  BG_IMAGE?: string
}

export type AppVariables = {
  isRoot: boolean
  isUser: boolean
  clientIP: string
  dao: import('./db/dao').DAO
}

export type HonoEnv = {
  Bindings: Env
  Variables: AppVariables
}

// =====================================
// Data Models
// =====================================

export interface Category {
  id: number
  title: string
  sort_order: number
  is_private: number
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
}

export interface SiteConfig {
  title?: string
  bg_image?: string
  allow_search?: string
  private_mode?: string
  [key: string]: string | undefined
}

export interface ApiToken {
  id: number
  name: string
  token_hash: string
  created_at: number
}

// =====================================
// Zod Schemas (输入校验)
// =====================================

export const LinkCreateSchema = z.object({
  category_id: z.number().int().positive(),
  title: z.string().min(1, '标题不能为空').max(200),
  url: z.string().url('URL 格式不正确').regex(/^https?:\/\//, '仅支持 http/https 协议'),
  description: z.string().max(500).default(''),
  icon: z.string().max(500).default(''),
  is_private: z.union([z.literal(0), z.literal(1)]).default(0),
})

export const LinkUpdateSchema = z.object({
  id: z.number().int().positive(),
  category_id: z.number().int().positive().optional(),
  title: z.string().min(1).max(200).optional(),
  url: z.string().url().regex(/^https?:\/\//).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(500).optional(),
  is_private: z.union([z.literal(0), z.literal(1)]).optional(),
})

export const CategoryCreateSchema = z.object({
  title: z.string().min(1, '分类名不能为空').max(100),
  is_private: z.union([z.literal(0), z.literal(1)]).default(0),
})

export const CategoryUpdateSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(100).optional(),
  is_private: z.union([z.literal(0), z.literal(1)]).optional(),
})

export const ReorderSchema = z.array(z.object({
  id: z.number().int().positive(),
  sort_order: z.number().int().min(0),
  category_id: z.number().int().positive().optional(),
}))

export const ConfigUpdateSchema = z.object({
  key: z.string().min(1).max(50),
  value: z.string().max(2000),
})

export const VisitSchema = z.object({
  id: z.number().int().positive(),
})
