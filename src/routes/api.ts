/**
 * src/routes/api.ts - RESTful API 路由
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { setCookie, deleteCookie } from 'hono/cookie'
import type { HonoEnv } from '../types'
import {
  LinkCreateSchema, LinkUpdateSchema,
  CategoryCreateSchema, CategoryUpdateSchema,
  ReorderSchema, ConfigUpdateSchema,
} from '../types'
import { requireAuth, requireRoot } from '../middleware/auth'
import { signSession } from '../utils/session'
import { safeCompare } from '../utils/security'

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

// [GET] 图标代理 (三级降级：DuckDuckGo → 直接 favicon → 首字母生成)
api.get('/icon', async (c) => {
  const domain = c.req.query('domain')
  if (!domain) return c.text('Missing domain parameter', 400)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9\-\.]*\.[a-zA-Z]{2,}$/.test(domain)) {
    return c.text('Invalid domain format', 400)
  }

  const domainLower = domain.toLowerCase()
  const cacheKey = new Request(`https://icon-cache.internal/icon/${domainLower}`, { method: 'GET' })
  const cache = caches.default

  try {
    // 1. 检查边缘缓存
    const cachedResponse = await cache.match(cacheKey)
    if (cachedResponse) {
      const headers = new Headers(cachedResponse.headers)
      headers.set('X-Cache', 'HIT')
      return new Response(cachedResponse.body, { status: cachedResponse.status, headers })
    }

    const ua = 'Mozilla/5.0 (compatible; NavIconProxy/1.0)'
    let iconBody: ArrayBuffer | null = null
    let contentType = 'image/png'

    // 2. 第一优先：DuckDuckGo 图标服务
    try {
      const ddgRes = await fetch(`https://icons.duckduckgo.com/ip3/${domainLower}.ico`, {
        headers: { 'User-Agent': ua },
      })
      if (ddgRes.ok) {
        const body = await ddgRes.arrayBuffer()
        // DuckDuckGo 对未知域名会返回一个极小的空白占位图（通常 < 200 字节）
        if (body.byteLength > 100) {
          iconBody = body
          contentType = ddgRes.headers.get('Content-Type') || 'image/x-icon'
        }
      }
    } catch { /* DuckDuckGo 不可达，继续降级 */ }

    // 3. 第二优先：favicon.im 图标服务
    if (!iconBody) {
      try {
        const fimRes = await fetch(`https://a.favicon.im/${domainLower}`, {
          headers: { 'User-Agent': ua },
          redirect: 'follow',
        })
        if (fimRes.ok) {
          const body = await fimRes.arrayBuffer()
          if (body.byteLength > 100) {
            iconBody = body
            contentType = fimRes.headers.get('Content-Type') || 'image/png'
          }
        }
      } catch { /* favicon.im 不可达，继续降级 */ }
    }

    // 4. 第三优先：直接访问网站 /favicon.ico
    if (!iconBody) {
      try {
        const directRes = await fetch(`https://${domainLower}/favicon.ico`, {
          headers: { 'User-Agent': ua },
          redirect: 'follow',
        })
        if (directRes.ok) {
          const ct = directRes.headers.get('Content-Type') || ''
          // 确保返回的确实是图片而非 HTML 错误页
          if (ct.includes('image') || ct.includes('icon')) {
            iconBody = await directRes.arrayBuffer()
            contentType = ct
          }
        }
      } catch { /* 网站不可达，继续降级 */ }
    }

    // 5. 第四优先：生成首字母 SVG 图标
    if (!iconBody) {
      const letter = domainLower.replace(/^www\./, '').charAt(0).toUpperCase()
      // 根据首字母生成稳定的色相（同一字母永远是同一颜色）
      const hue = (letter.charCodeAt(0) * 37) % 360
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue},65%,55%)"/>
          <stop offset="100%" style="stop-color:hsl(${(hue + 30) % 360},55%,45%)"/>
        </linearGradient></defs>
        <rect width="64" height="64" rx="14" fill="url(#g)"/>
        <text x="32" y="32" font-family="system-ui,sans-serif" font-size="30" font-weight="600" fill="white" text-anchor="middle" dominant-baseline="central">${letter}</text>
      </svg>`
      iconBody = new TextEncoder().encode(svg).buffer as ArrayBuffer
      contentType = 'image/svg+xml'
    }

    // 6. 返回并缓存
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
    // 终极兜底：即使出现意外异常，也返回首字母 SVG
    const letter = domainLower.replace(/^www\./, '').charAt(0).toUpperCase()
    const hue = (letter.charCodeAt(0) * 37) % 360
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="hsl(${hue},60%,50%)"/><text x="32" y="32" font-family="system-ui,sans-serif" font-size="30" font-weight="600" fill="white" text-anchor="middle" dominant-baseline="central">${letter}</text></svg>`
    return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } })
  }
})

// [POST] 图标缓存清除 (管理员手动刷新坏图标)
api.post('/icon/purge', requireAuth, requireRoot, async (c) => {
  const { domain } = await c.req.json().catch(() => ({ domain: '' })) as { domain: string }
  if (!domain) return c.json({ error: 'Missing domain' }, 400)
  const cacheKey = new Request(`https://icon-cache.internal/icon/${domain.toLowerCase()}`, { method: 'GET' })
  const deleted = await caches.default.delete(cacheKey)
  return c.json({ success: true, domain, cacheCleared: deleted })
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

// [POST] 登录下发 Cookie
api.post('/auth/login', async (c) => {
  const dao = c.get('dao')
  const clientIP = c.get('clientIP')
  const region = (c.req.raw as any)?.cf?.country || 'Local'
  
  // 手动防刷接管
  const rateCheck = await dao.checkRateLimit(clientIP)
  if (rateCheck.blocked) {
    const remainingMin = Math.ceil(rateCheck.remainingMs / 60000)
    return c.json({ error: `Too many failed attempts. Try again in ${remainingMin} minutes.`, blocked: true, remainingMs: rateCheck.remainingMs }, 429)
  }

  const { password } = await c.req.json().catch(() => ({ password: '' }))
  if (!password || !c.env.PASSWORD || !c.env.COOKIE_SECRET) {
    await dao.recordFailedAttempt(clientIP)
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const isRoot = await safeCompare(password, c.env.PASSWORD)
  if (!isRoot) {
    const result = await dao.recordFailedAttempt(clientIP)
    if (result.locked) {
      c.executionCtx.waitUntil(
        dao.addLog({ ip: clientIP, region, level: 'DANGER', action: 'ip_lockout', details: `Failed 5 times. Locked for 15 mins.` })
      )
    }
    return c.json({ error: 'Unauthorized', attemptsRemaining: 5 - result.attempts }, 401)
  }

  await dao.clearRateLimit(clientIP)
  const token = await signSession('root', c.env.COOKIE_SECRET + c.env.PASSWORD)
  
  setCookie(c, 'nav_token', token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60
  })

  c.executionCtx.waitUntil(
    dao.addLog({ ip: clientIP, region, level: 'INFO', action: 'login', details: 'Admin logged in via UI' })
  )

  return c.json({ success: true, role: 'root' })
})

// [POST] 登出销毁 Cookie
api.post('/auth/logout', (c) => {
  deleteCookie(c, 'nav_token', { path: '/' })
  return c.json({ success: true })
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
  const res = await dao.batchUpdateCategoriesOrder(data)
  
  const clientIP = c.get('clientIP')
  const region = (c.req.raw as any)?.cf?.country || 'Local'
  c.executionCtx.waitUntil(
    dao.addLog({ ip: clientIP, region, level: 'INFO', action: 'reorder_categories', details: JSON.stringify({ count: data.length }) })
  )
  
  return c.json(res)
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
  const res = await dao.batchUpdateLinksOrder(data)

  const clientIP = c.get('clientIP')
  const region = (c.req.raw as any)?.cf?.country || 'Local'
  c.executionCtx.waitUntil(
    dao.addLog({ ip: clientIP, region, level: 'INFO', action: 'reorder_links', details: JSON.stringify({ count: data.length }) })
  )
  
  return c.json(res)
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
  const res = await dao.importData(body)

  const clientIP = c.get('clientIP')
  const region = (c.req.raw as any)?.cf?.country || 'Local'
  c.executionCtx.waitUntil(
    dao.addLog({ 
      ip: clientIP, 
      region, 
      level: 'WARN', 
      action: 'import_data', 
      details: JSON.stringify({ imported_count: res.count, skipped_count: res.skipped_count }) 
    })
  )
  
  return c.json(res)
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

api.get('/logs', requireAuth, requireRoot, async (c) => {
  const dao = c.get('dao')
  const page = parseInt(c.req.query('page') || '1') || 1
  const limit = parseInt(c.req.query('limit') || '20') || 20
  return c.json(await dao.getLogs(page, limit))
})

api.post('/logs/clear', requireAuth, requireRoot, async (c) => {
  const dao = c.get('dao')
  const result = await dao.clearLogs()

  const clientIP = c.get('clientIP')
  const region = (c.req.raw as any)?.cf?.country || 'Local'
  c.executionCtx.waitUntil(
    dao.addLog({ ip: clientIP, region, level: 'WARN', action: 'clear_logs', details: `Cleared ${result.deleted} logs` })
  )

  return c.json({ success: true, ...result })
})

export { api }
