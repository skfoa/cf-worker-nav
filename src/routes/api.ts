/**
 * src/routes/api.ts - RESTful API 路由
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { HonoEnv } from '../types'
import {
  LinkCreateSchema, LinkUpdateSchema,
  CategoryCreateSchema, CategoryUpdateSchema,
  ReorderSchema, ConfigUpdateSchema,
} from '../types'
import { requireAuth, requireRoot } from '../middleware/auth'

const api = new Hono<HonoEnv>()

// ==========================================
// 公开接口
// ==========================================

// [GET] 健康检查
api.get('/health', async (c) => {
  const dao = c.get('dao')
  return c.json({ status: 'ok', ...(await dao.getStats()) })
})

// [GET] 公共配置 (边缘缓存 5 分钟)
api.get('/config', async (c) => {
  const dao = c.get('dao')
  const url = new URL(c.req.url)
  const cacheKey = new Request(`${url.origin}/api/config`, { method: 'GET' })
  const cache = caches.default

  try {
    const cachedResponse = await cache.match(cacheKey)
    if (cachedResponse) {
      const headers = new Headers(cachedResponse.headers)
      headers.set('X-Cache', 'HIT')
      return new Response(cachedResponse.body, { status: cachedResponse.status, headers })
    }

    const conf = await dao.getConfigs()
    const configData = {
      title: conf.title || c.env.TITLE || 'My Nav',
      bg_image: conf.bg_image || c.env.BG_IMAGE || '',
      allow_search: conf.allow_search !== 'false',
      private_mode: conf.private_mode || 'false',
    }

    const response = c.json(configData, 200, {
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Cache': 'MISS',
    })

    const responseToCache = new Response(JSON.stringify(configData), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    })
    c.executionCtx.waitUntil(cache.put(cacheKey, responseToCache))

    return response
  } catch {
    const conf = await dao.getConfigs()
    return c.json({
      title: conf.title || c.env.TITLE || 'My Nav',
      bg_image: conf.bg_image || c.env.BG_IMAGE || '',
      allow_search: conf.allow_search !== 'false',
      private_mode: conf.private_mode || 'false',
    }, 200, { 'Cache-Control': 'public, max-age=300, s-maxage=300' })
  }
})

// [POST] 点击上报 (无需鉴权，校验来源)
api.post('/visit', async (c) => {
  try {
    const referer = c.req.header('Referer') || ''
    const origin = c.req.header('Origin') || ''
    const url = new URL(c.req.url)
    const allowedOrigin = c.env.ALLOWED_ORIGIN || url.origin
    const isValid = referer.startsWith(allowedOrigin) || referer.startsWith(url.origin) ||
      origin === allowedOrigin || origin === url.origin
    if (!isValid) return c.json({ status: 'ok' })

    const body = await c.req.json().catch(() => ({})) as { id?: number }
    if (body.id) {
      const dao = c.get('dao')
      await dao.incrementVisit(body.id)
    }
    return c.json({ status: 'ok' })
  } catch {
    return c.json({ status: 'ok' })
  }
})

// [GET] 图标代理 (边缘缓存 7 天)
api.get('/icon', async (c) => {
  const domain = c.req.query('domain')
  if (!domain) return c.text('Missing domain parameter', 400)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9\-\.]*\.[a-zA-Z]{2,}$/.test(domain)) {
    return c.text('Invalid domain format', 400)
  }

  const cacheKey = new Request(`https://icon-cache.internal/icon/${domain.toLowerCase()}`, { method: 'GET' })
  const cache = caches.default

  try {
    const cachedResponse = await cache.match(cacheKey)
    if (cachedResponse) {
      const headers = new Headers(cachedResponse.headers)
      headers.set('X-Cache', 'HIT')
      return new Response(cachedResponse.body, { status: cachedResponse.status, headers })
    }

    const iconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
    const iconRes = await fetch(iconUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NavIconProxy/1.0)' },
    })
    if (!iconRes.ok) return c.text('Icon not found', 404)

    const iconBody = await iconRes.arrayBuffer()
    const contentType = iconRes.headers.get('Content-Type') || 'image/png'

    const responseHeaders = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800, s-maxage=604800',
      'Access-Control-Allow-Origin': '*',
      'X-Cache': 'MISS',
    }

    const response = new Response(iconBody, { headers: responseHeaders })
    const responseToCache = new Response(iconBody, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=604800, s-maxage=604800' },
    })
    c.executionCtx.waitUntil(cache.put(cacheKey, responseToCache))

    return response
  } catch {
    return c.text('Icon fetch failed', 500)
  }
})

// ==========================================
// 需要鉴权的接口
// ==========================================

// [GET] 验证身份
api.get('/auth/verify', requireAuth, (c) => {
  return c.json({
    status: 'ok',
    role: c.get('isRoot') ? 'root' : 'user',
    timestamp: Date.now(),
  })
})

// [GET] 全量数据 (后台模式)
api.get('/data', requireAuth, async (c) => {
  const dao = c.get('dao')
  return c.json(await dao.getAllData(true))
})

// ── Category CRUD ──

api.post('/category', requireAuth, zValidator('json', CategoryCreateSchema), async (c) => {
  const dao = c.get('dao')
  const data = c.req.valid('json')
  return c.json(await dao.addCategory(data))
})

api.post('/category/update', requireAuth, zValidator('json', CategoryUpdateSchema), async (c) => {
  const dao = c.get('dao')
  const data = c.req.valid('json')
  return c.json(await dao.updateCategory(data))
})

api.post('/category/delete', requireAuth, async (c) => {
  const dao = c.get('dao')
  const body = await c.req.json() as { id: number }
  return c.json(await dao.deleteCategory(body.id))
})

api.post('/category/reorder', requireAuth, zValidator('json', ReorderSchema), async (c) => {
  const dao = c.get('dao')
  const data = c.req.valid('json')
  return c.json(await dao.batchUpdateCategoriesOrder(data))
})

// ── Link CRUD ──

api.post('/link', requireAuth, zValidator('json', LinkCreateSchema), async (c) => {
  const dao = c.get('dao')
  const data = c.req.valid('json')
  return c.json(await dao.addLink(data))
})

api.post('/link/update', requireAuth, zValidator('json', LinkUpdateSchema), async (c) => {
  const dao = c.get('dao')
  const data = c.req.valid('json')
  return c.json(await dao.updateLink(data))
})

api.post('/link/delete', requireAuth, async (c) => {
  const dao = c.get('dao')
  const body = await c.req.json() as { id: number }
  return c.json(await dao.deleteLink(body.id))
})

api.post('/link/reorder', requireAuth, zValidator('json', ReorderSchema), async (c) => {
  const dao = c.get('dao')
  const data = c.req.valid('json')
  return c.json(await dao.batchUpdateLinksOrder(data))
})

// ==========================================
// Root 专属接口
// ==========================================

api.post('/config', requireAuth, requireRoot, zValidator('json', ConfigUpdateSchema), async (c) => {
  const dao = c.get('dao')
  const { key, value } = c.req.valid('json')
  await dao.updateConfig(key, value)

  // 清除缓存
  const url = new URL(c.req.url)
  const cacheKey = new Request(`${url.origin}/api/config`, { method: 'GET' })
  c.executionCtx.waitUntil(caches.default.delete(cacheKey))

  return c.json({ status: 'ok', key, value })
})

api.post('/import', requireAuth, requireRoot, async (c) => {
  const dao = c.get('dao')
  const body = await c.req.json()
  return c.json(await dao.importData(body))
})

api.get('/export', requireAuth, requireRoot, async (c) => {
  const dao = c.get('dao')
  const allData = await dao.getAllData(true)
  const exportData = allData.nav.map(cat => ({
    category: cat.title,
    is_private: cat.is_private,
    items: cat.items.map(link => ({
      title: link.title,
      url: link.url,
      description: link.description,
      icon: link.icon,
      is_private: link.is_private,
    })),
  }))
  return c.json({ meta: { version: 1, date: new Date().toISOString() }, data: exportData })
})

api.get('/token/list', requireAuth, requireRoot, async (c) => {
  const dao = c.get('dao')
  return c.json(await dao.listTokens())
})

api.post('/token/create', requireAuth, requireRoot, async (c) => {
  const dao = c.get('dao')
  const body = await c.req.json() as { name: string }
  return c.json(await dao.createToken(body.name))
})

api.post('/token/delete', requireAuth, requireRoot, async (c) => {
  const dao = c.get('dao')
  const body = await c.req.json() as { id: number }
  return c.json(await dao.deleteToken(body.id))
})

export { api }
