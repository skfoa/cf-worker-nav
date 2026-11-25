/**
 * src/types.ts - 全局类型定义 + Zod Schema
 */
import { z } from 'zod'
import type { Category, Link, CategoryWithItems, SiteConfig } from './shared/types'

export type { Category, Link, CategoryWithItems, SiteConfig }

// =====================================
// Cloudflare Bindings
// =====================================

export type Env = {
  DB: D1Database
  PASSWORD?: string
  TOKEN_SALT?: string
  COOKIE_SECRET?: string
  ENVIRONMENT?: string
  LOG_LEVEL?: string
  ALLOWED_ORIGIN?: string
  TITLE?: string
  BG_IMAGE?: string
}

export type AppVariables = {
  isRoot: boolean
  isUser: boolean
  clientIP: string
  dao: import('./db/dao').DAO
  rateLimited?: { blocked: boolean; remainingMs: number; attempts: number }
}

export type HonoEnv = {
  Bindings: Env
  Variables: AppVariables
}

// =====================================
// Data Models (re-exported from src/shared/types)
// =====================================

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
  parent_id: z.number().int().positive().optional(),
})

export const CategoryUpdateSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(100).optional(),
  is_private: z.union([z.literal(0), z.literal(1)]).optional(),
  parent_id: z.number().int().positive().nullable().optional(),
}).refine(data => data.id !== data.parent_id, {
  message: "父分类不能是自己",
  path: ["parent_id"]
})

export const ReorderSchema = z.array(z.object({
  id: z.number().int().positive(),
  sort_order: z.number().int().min(0),
  category_id: z.number().int().positive().optional(),
}))

export const SafeUrlSchema = z.string().url('URL 格式不正确').regex(/^https?:\/\//i, '仅支持 http/https 协议')

export const ConfigUpdateSchema = z.object({
  key: z.string().min(1).max(50),
  value: z.string().max(2000),
}).refine(data => {
  if (data.key === 'bg_image' && data.value.trim() !== '') {
    return SafeUrlSchema.safeParse(data.value).success
  }
  return true
}, {
  message: "bg_image 必须是合法的 http/https URL",
  path: ["value"]
}).refine(data => {
  if (data.key === 'title') {
    const trimmed = data.value.trim()
    return trimmed.length >= 1 && trimmed.length <= 100
  }
  return true
}, {
  message: "站点标题不能为空且不超过 100 个字符",
  path: ["value"]
})

export const IdSchema = z.object({
  id: z.number().int().positive(),
})

export const VisitSchema = IdSchema

export const TokenCreateSchema = z.object({
  name: z.string().trim().min(1, '名称不能为空').max(100),
})

export const LinkMetaSchema = z.object({
  url: SafeUrlSchema,
})

export const LinkBatchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('move'),
    ids: z.array(z.number().int().positive()).min(1, '至少选择一个链接').max(200),
    category_id: z.number().int().positive(),
  }),
  z.object({
    action: z.literal('privacy'),
    ids: z.array(z.number().int().positive()).min(1, '至少选择一个链接').max(200),
    is_private: z.union([z.literal(0), z.literal(1)]),
  }),
  z.object({
    action: z.literal('delete'),
    ids: z.array(z.number().int().positive()).min(1, '至少选择一个链接').max(200),
  }),
  z.object({
    action: z.literal('icon'),
    ids: z.array(z.number().int().positive()).min(1, '至少选择一个链接').max(200),
    icon: z.string().max(500),
  }),
])

export const IconPurgeSchema = z.object({
  domain: z.string().trim().min(1).max(253).optional(),
  url: SafeUrlSchema.optional(),
}).refine(data => Boolean(data.domain || data.url), {
  message: '请提供 domain 或 url',
})
