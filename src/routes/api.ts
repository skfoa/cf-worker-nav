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

// [GET] 图标代理 (分层并发：第三方竞速 → HTML解析 → 静态路径竞速 → 首字母生成)
api.get('/icon', async (c) => {
  const domain = c.req.query('domain')
  if (!domain) return c.text('Missing domain parameter', 400)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9\-\.]*\.[a-zA-Z]{2,}$/.test(domain)) {
    return c.text('Invalid domain format', 400)
  }

  const domainLower = domain.toLowerCase()
  const cacheKey = new Request(`https://icon-cache.internal/icon/${domainLower}`, { method: 'GET' })
  const cache = caches.default

  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  // 带超时的 fetch
  async function fetchT(url: string, opts: RequestInit = {}, ms = 5000): Promise<Response> {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), ms)
    try { return await fetch(url, { ...opts, signal: ac.signal }) } finally { clearTimeout(t) }
  }

  // 安全读取 body（限 512KB）
  async function safeBody(res: Response): Promise<ArrayBuffer | null> {
    const cl = res.headers.get('Content-Length')
    if (cl && parseInt(cl) > 512 * 1024) return null
    const b = await res.arrayBuffer()
    return b.byteLength > 100 && b.byteLength <= 512 * 1024 ? b : null
  }

  // 解析相对 URL
  function toAbsolute(raw: string): string {
    if (raw.startsWith('http')) return raw
    if (raw.startsWith('//')) return `https:${raw}`
    return `https://${domainLower}${raw.startsWith('/') ? '' : '/'}${raw}`
  }

  // 尝试获取图标的通用逻辑，返回 { body, ct } 或 null
  async function tryFetchIcon(url: string, ms = 4000): Promise<{ body: ArrayBuffer; ct: string } | null> {
    try {
      const res = await fetchT(url, { headers: { 'User-Agent': ua }, redirect: 'follow' }, ms)
      if (!res.ok) return null
      const ct = res.headers.get('Content-Type') || ''
      if (!(ct.includes('image') || ct.includes('icon') || ct.includes('svg') || ct.includes('octet-stream'))) return null
      const body = await safeBody(res)
      if (!body) return null
      return { body, ct: ct.includes('octet-stream') ? 'image/png' : ct }
    } catch { return null }
  }

  try {
    // 0. 边缘缓存命中
    const cached = await cache.match(cacheKey)
    if (cached) {
      const h = new Headers(cached.headers)
      h.set('X-Cache', 'HIT')
      return new Response(cached.body, { status: cached.status, headers: h })
    }

    let iconBody: ArrayBuffer | null = null
    let contentType = 'image/png'
    let isGenerated = false

    // ═══ 第一层：DuckDuckGo + favicon.im 并发竞速 ═══
    const tier1Results = await Promise.allSettled([
      // DuckDuckGo
      (async (): Promise<{ body: ArrayBuffer; ct: string } | null> => {
        try {
          const res = await fetchT(`https://icons.duckduckgo.com/ip3/${domainLower}.ico`, { headers: { 'User-Agent': ua } })
          if (!res.ok) return null
          const body = await safeBody(res)
          return body ? { body, ct: res.headers.get('Content-Type') || 'image/x-icon' } : null
        } catch { return null }
      })(),
      // favicon.im
      (async (): Promise<{ body: ArrayBuffer; ct: string } | null> => {
        try {
          const res = await fetchT(`https://a.favicon.im/${domainLower}`, { headers: { 'User-Agent': ua }, redirect: 'follow' })
          if (!res.ok) return null
          const ct = res.headers.get('Content-Type') || ''
          const finalUrl = res.url || ''
          const isDefault = finalUrl.includes('favicon.im/default') || finalUrl.includes('favicon.im/icons/default')
            || (ct.includes('svg') && (await res.clone().text()).length < 1000)
          if (isDefault) return null
          const body = await safeBody(res)
          return body ? { body, ct: ct || 'image/png' } : null
        } catch { return null }
      })(),
    ])

    // 取第一个成功的结果（优先 DuckDuckGo）
    for (const r of tier1Results) {
      if (r.status === 'fulfilled' && r.value) {
        iconBody = r.value.body
        contentType = r.value.ct
        break
      }
    }

    // ═══ 第二层：解析 HTML <head> + manifest ═══
    if (!iconBody) {
      try {
        const htmlRes = await fetchT(`https://${domainLower}/`, {
          headers: { 'User-Agent': ua, 'Accept': 'text/html' },
          redirect: 'follow',
        }, 5000)
        if (htmlRes.ok && (htmlRes.headers.get('Content-Type') || '').includes('text/html')) {
          // 流式读取前 32KB
          const reader = htmlRes.body?.getReader()
          let html = ''
          if (reader) {
            const dec = new TextDecoder()
            let bytes = 0
            while (bytes < 32768) {
              const { done, value } = await reader.read()
              if (done) break
              html += dec.decode(value, { stream: true })
              bytes += value.byteLength
              if (html.includes('</head>') || html.includes('</HEAD>')) break
            }
            reader.cancel().catch(() => {})
          }

          // 提取 <link rel="icon/shortcut icon/apple-touch-icon"> 的 href
          const iconUrls: string[] = []
          const re = /<link\s[^>]*?(?:rel\s*=\s*["'](?:icon|shortcut icon|apple-touch-icon(?:-precomposed)?)["'][^>]*?href\s*=\s*["']([^"']+)["']|href\s*=\s*["']([^"']+)["'][^>]*?rel\s*=\s*["'](?:icon|shortcut icon|apple-touch-icon(?:-precomposed)?)["'])[^>]*>/gi
          let m: RegExpExecArray | null
          while ((m = re.exec(html)) !== null) {
            const href = m[1] || m[2]
            if (href && !iconUrls.includes(href)) iconUrls.push(href)
          }

          // 并发获取解析出的图标 URL（最多取前 3 个）
          if (iconUrls.length > 0) {
            const iconResults = await Promise.allSettled(
              iconUrls.slice(0, 3).map(u => tryFetchIcon(toAbsolute(u), 4000))
            )
            for (const r of iconResults) {
              if (r.status === 'fulfilled' && r.value) {
                iconBody = r.value.body
                contentType = r.value.ct
                break
              }
            }
          }

          // manifest.json 图标
          if (!iconBody) {
            const mm = html.match(/<link\s[^>]*?(?:rel\s*=\s*["']manifest["'][^>]*?href\s*=\s*["']([^"']+)["']|href\s*=\s*["']([^"']+)["'][^>]*?rel\s*=\s*["']manifest["'])[^>]*>/i)
            const manifestHref = mm?.[1] || mm?.[2]
            if (manifestHref) {
              try {
                const mRes = await fetchT(toAbsolute(manifestHref), { headers: { 'User-Agent': ua } }, 3000)
                if (mRes.ok) {
                  const mj = await mRes.json() as { icons?: Array<{ src: string; sizes?: string; type?: string }> }
                  if (mj.icons?.length) {
                    const sorted = [...mj.icons].sort((a, b) =>
                      parseInt(b.sizes?.split('x')[0] || '0') - parseInt(a.sizes?.split('x')[0] || '0')
                    )
                    // 并发取前 2 个尺寸最大的
                    const mResults = await Promise.allSettled(
                      sorted.slice(0, 2).map(i => tryFetchIcon(toAbsolute(i.src), 3000))
                    )
                    for (const r of mResults) {
                      if (r.status === 'fulfilled' && r.value) {
                        iconBody = r.value.body
                        contentType = r.value.ct
                        break
                      }
                    }
                  }
                }
              } catch { /* manifest 解析失败 */ }
            }
          }
        }
      } catch { /* HTML 解析失败 */ }
    }

    // ═══ 第三层：常见静态路径并发竞速 ═══
    if (!iconBody) {
      const paths = ['/favicon.ico', '/favicon.svg', '/favicon.png', '/apple-touch-icon.png']
      const pathResults = await Promise.allSettled(
        paths.map(p => tryFetchIcon(`https://${domainLower}${p}`, 4000))
      )
      for (const r of pathResults) {
        if (r.status === 'fulfilled' && r.value) {
          iconBody = r.value.body
          contentType = r.value.ct
          break
        }
      }
    }

    // ═══ 兜底：首字母 SVG ═══
    if (!iconBody) {
      const letter = domainLower.replace(/^www\./, '').charAt(0).toUpperCase()
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
      isGenerated = true
    }

    // 返回并缓存（生成图标缓存 24h，真实图标缓存 7 天）
    const ttl = isGenerated ? 86400 : 604800
    const response = new Response(iconBody, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS',
        'X-Icon-Source': isGenerated ? 'generated' : 'fetched',
      },
    })
    c.executionCtx.waitUntil(
      cache.put(cacheKey, new Response(iconBody, {
        headers: { 'Content-Type': contentType, 'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}` },
      }))
    )
    return response
  } catch {
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
  const exportData: Array<{
    category: string
    parent_category?: string
    is_private?: number
    items: Array<{
      title: string
      url: string
      description?: string
      icon?: string
      is_private?: number
    }>
  }> = []

  for (const cat of allData.nav) {
    if (cat.id === -1) continue // 跳过虚拟“常用推荐”

    exportData.push({
      category: cat.title,
      is_private: cat.is_private || 0,
      items: (cat.items || []).map(link => ({
        title: link.title,
        url: link.url,
        description: link.description || '',
        icon: link.icon || '',
        is_private: link.is_private || 0,
      })),
    })

    if (cat.children && cat.children.length > 0) {
      for (const child of cat.children) {
        exportData.push({
          category: child.title,
          parent_category: cat.title,
          is_private: child.is_private || 0,
          items: (child.items || []).map(link => ({
            title: link.title,
            url: link.url,
            description: link.description || '',
            icon: link.icon || '',
            is_private: link.is_private || 0,
          })),
        })
      }
    }
  }

  const clientIP = c.get('clientIP')
  const region = (c.req.raw as any)?.cf?.country || 'Local'
  c.executionCtx.waitUntil(
    dao.addLog({
      ip: clientIP,
      region,
      level: 'INFO',
      action: 'export_data',
      details: JSON.stringify({ category_count: exportData.length })
    })
  )

  const dateStr = new Date().toISOString().slice(0, 10)
  c.header('Content-Disposition', `attachment; filename="nav-backup-${dateStr}.json"`)
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
