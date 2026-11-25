import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Miniflare } from 'miniflare'
import { ASSET_VERSIONS } from '../../src/generated/assets'
import { createTestWorker } from '../helpers/worker'

const ORIGIN = 'https://123.pixel5.de5.net'

describe('Worker end-to-end integration (Miniflare workerd + D1)', () => {
  let mf: Miniflare
  let db: D1Database
  let fetchMock: Awaited<ReturnType<typeof createTestWorker>>['fetchMock']
  let adminCookie = ''
  let readOnlyToken = ''

  beforeAll(async () => {
    const setup = await createTestWorker()
    mf = setup.mf
    db = setup.db
    fetchMock = setup.fetchMock

    // 预置一个只读 API Token
    const enc = new TextEncoder()
    const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode('readonly-api-tok' + 'test-salt-value'))
    const hashHex = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    await db.prepare('INSERT INTO tokens (name, token_hash) VALUES (?, ?)').bind('ci-readonly', hashHex).run()
    readOnlyToken = 'readonly-api-tok'

    const loginRes = await mf.dispatchFetch(`${ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': '198.51.100.1' },
      body: JSON.stringify({ password: 'test-root-password' }),
    })
    adminCookie = (loginRes.headers.get('Set-Cookie') || '').split(';')[0]
  })

  afterAll(async () => {
    await mf.dispose()
  })

  it('serves robots.txt cleanly without duplicate route breakage', async () => {
    const res = await mf.dispatchFetch(`${ORIGIN}/robots.txt`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Disallow: /')
  })

  it('caches guest SSR homepage (MISS -> HIT) without inline onerror and skips D1 on HIT', async () => {
    const r1 = await mf.dispatchFetch(`${ORIGIN}/`)
    const html1 = await r1.text()
    expect(r1.status).toBe(200)
    expect(r1.headers.get('X-Cache')).toBe('MISS')
    expect(html1).not.toContain('onerror=')
    expect(html1).toContain('"bg_image":""')
    expect(html1).toContain('href="/favicon.svg"')
    expect(html1).toContain('href="/favicon.ico"')
    expect(html1).not.toContain('flaticon.com')
    expect(html1).toContain(`/output.css?v=${ASSET_VERSIONS.css}`)
    expect(html1).toContain(`/client.min.js?v=${ASSET_VERSIONS.js}`)

    await new Promise((r) => setTimeout(r, 150))

    // 直接在 DB 插入私有分类并修改标题，验证缓存命中时不会穿透 D1 也不会泄露私有数据
    await db.exec("INSERT INTO categories (title, sort_order, is_private) VALUES ('SecretCat', 5, 1); UPDATE configs SET value='ChangedInDb' WHERE key='title';")
    const r2 = await mf.dispatchFetch(`${ORIGIN}/`)
    const html2 = await r2.text()
    expect(r2.status).toBe(200)
    expect(r2.headers.get('X-Cache')).toBe('HIT')
    expect(html2).not.toContain('SecretCat')
    expect(html2).not.toContain('ChangedInDb')
  })

  it('handles login validation, rate limiting, Bearer lockout enforcement, and purge on mutation', async () => {
    // 非字符串 password 拒绝
    const badLogin = await mf.dispatchFetch(`${ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': '198.51.100.10' },
      body: JSON.stringify({ password: 12345 }),
    })
    expect(badLogin.status).toBe(401)

    // 连续 5 次 Bearer 失败锁定后，即使拿正确 Root 密码也不可绕过 429
    for (let i = 0; i < 5; i++) {
      const r = await mf.dispatchFetch(`${ORIGIN}/api/data`, {
        headers: { Authorization: `Bearer wrong-${i}`, 'CF-Connecting-IP': '198.51.100.20' },
      })
      expect(r.status).toBe(i < 4 ? 404 : 429)
    }
    const bypass = await mf.dispatchFetch(`${ORIGIN}/api/data`, {
      headers: { Authorization: 'Bearer test-root-password', 'CF-Connecting-IP': '198.51.100.20' },
    })
    expect(bypass.status).toBe(429)

    // 正常 Root 登录
    const okLogin = await mf.dispatchFetch(`${ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': '198.51.100.30' },
      body: JSON.stringify({ password: 'test-root-password' }),
    })
    expect(okLogin.status).toBe(200)
    adminCookie = (okLogin.headers.get('Set-Cookie') || '').split(';')[0]
    expect(adminCookie.startsWith('nav_token=')).toBe(true)

    // 管理员访问 / 绕过公开缓存且看到私有分类
    const adminHome = await mf.dispatchFetch(`${ORIGIN}/`, { headers: { Cookie: adminCookie } })
    const adminHtml = await adminHome.text()
    expect(adminHome.headers.get('X-Cache')).toBeNull()
    expect(adminHome.headers.get('Cache-Control')).toContain('private')
    expect(adminHtml).toContain('SecretCat')
    expect(adminHtml).toContain('ChangedInDb')

    // 新增公开分类触发 purgePublicCache
    const addCat = await mf.dispatchFetch(`${ORIGIN}/api/category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ title: 'PublicNew', is_private: 0 }),
    })
    expect(addCat.status).toBe(200)
    await new Promise((r) => setTimeout(r, 150))

    const r3 = await mf.dispatchFetch(`${ORIGIN}/`)
    const html3 = await r3.text()
    expect(r3.headers.get('X-Cache')).toBe('MISS')
    expect(html3).toContain('PublicNew')
    expect(html3).toContain('ChangedInDb')
    expect(html3).not.toContain('SecretCat')
  })

  it('enforces Root vs read-only Token RBAC and stealth 404', async () => {
    const unauth = await mf.dispatchFetch(`${ORIGIN}/api/data`)
    expect(unauth.status).toBe(404)

    const verifyRes = await mf.dispatchFetch(`${ORIGIN}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${readOnlyToken}` },
    })
    expect(verifyRes.status).toBe(200)
    expect(((await verifyRes.json()) as { role: string }).role).toBe('user')

    const dataRes = await mf.dispatchFetch(`${ORIGIN}/api/data`, {
      headers: { Authorization: `Bearer ${readOnlyToken}` },
    })
    expect(dataRes.status).toBe(200)

    for (const [method, path, body] of [
      ['POST', '/api/category', { title: 'x' }],
      ['POST', '/api/link', { category_id: 1, title: 'x', url: 'https://x.example.com' }],
      ['POST', '/api/link/batch', { action: 'delete', ids: [1] }],
      ['POST', '/api/link/meta', { url: 'https://example.com' }],
      ['POST', '/api/config', { key: 'title', value: 'x' }],
      ['GET', '/api/export', null],
      ['GET', '/api/token/list', null],
      ['GET', '/api/logs', null],
      ['POST', '/api/icon/purge', { domain: 'example.com' }],
    ] as const) {
      const r = await mf.dispatchFetch(`${ORIGIN}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${readOnlyToken}`,
          Origin: ORIGIN,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      expect(r.status).toBe(404)
    }
  })

  it('enforces category hierarchy, link deduplication, import validation, and /visit origin check', async () => {
    // 创建子分类（挂到 id=1 下）并验证三级嵌套与自父级均被拦截
    const childRes = await mf.dispatchFetch(`${ORIGIN}/api/category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ title: 'SubCat', parent_id: 1, is_private: 0 }),
    })
    expect(childRes.status).toBe(200)
    const childId = ((await childRes.json()) as { meta: { last_row_id: number } }).meta.last_row_id

    const threeLevel = await mf.dispatchFetch(`${ORIGIN}/api/category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ title: 'GrandChild', parent_id: childId }),
    })
    expect(threeLevel.status).toBe(500)

    const selfParent = await mf.dispatchFetch(`${ORIGIN}/api/category/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ id: 1, parent_id: 1 }),
    })
    expect(selfParent.status).toBe(400)

    const parentWithChildren = await mf.dispatchFetch(`${ORIGIN}/api/category/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ id: 1, parent_id: 2 }),
    })
    expect(parentWithChildren.status).toBe(500)

    // 导入跳过空标题、非 http 协议与重复 URL
    const impRes = await mf.dispatchFetch(`${ORIGIN}/api/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify([
        {
          category: '工具站',
          items: [
            { title: '   ', url: 'https://blank.example.com' },
            { title: 'Bad', url: 'javascript:alert(1)' },
            { title: 'DupGH', url: 'https://github.com' },
            { title: 'ValidItem', url: 'https://valid.example.com' },
          ],
        },
      ]),
    })
    const impData = (await impRes.json()) as { count: number; skipped_count: number }
    expect(impData.count).toBe(1)
    expect(impData.skipped_count).toBe(3)

    // /visit 阻止前缀欺骗并允许精确同源
    const before = await db.prepare('SELECT visits FROM links WHERE id = 1').first<{ visits: number }>()
    await mf.dispatchFetch(`${ORIGIN}/api/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Referer: `${ORIGIN}.evil.com/` },
      body: JSON.stringify({ id: 1 }),
    })
    const afterSpoof = await db.prepare('SELECT visits FROM links WHERE id = 1').first<{ visits: number }>()
    expect(afterSpoof?.visits).toBe(before?.visits)

    await mf.dispatchFetch(`${ORIGIN}/api/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Referer: `${ORIGIN}/` },
      body: JSON.stringify({ id: 1 }),
    })
    const afterOk = await db.prepare('SELECT visits FROM links WHERE id = 1').first<{ visits: number }>()
    expect(afterOk?.visits).toBe((before?.visits || 0) + 1)
  })

  it('caches /manifest.json and purges when title config updates', async () => {
    const m1 = await mf.dispatchFetch(`${ORIGIN}/manifest.json`)
    const j1 = (await m1.json()) as { name: string }
    expect(m1.status).toBe(200)
    expect(m1.headers.get('X-Cache')).toBe('MISS')

    await new Promise((r) => setTimeout(r, 150))
    const m2 = await mf.dispatchFetch(`${ORIGIN}/manifest.json`)
    expect(m2.headers.get('X-Cache')).toBe('HIT')

    // 更新标题 -> 清空 manifest 与 SSR 缓存
    const cfgUpdate = await mf.dispatchFetch(`${ORIGIN}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ key: 'title', value: '  Updated Nav  ' }),
    })
    expect(cfgUpdate.status).toBe(200)
    expect(((await cfgUpdate.json()) as { value: string }).value).toBe('Updated Nav')
    await new Promise((r) => setTimeout(r, 150))

    const m3 = await mf.dispatchFetch(`${ORIGIN}/manifest.json`)
    const j3 = (await m3.json()) as { name: string }
    expect(m3.headers.get('X-Cache')).toBe('MISS')
    expect(j3.name).toBe('Updated Nav')
    expect(j3.name).not.toBe(j1.name)
  })

  it('extracts metadata safely via /api/link/meta and blocks direct SSRF targets', async () => {
    // 禁止内网 / 云元数据 / 本站自请求
    for (const badUrl of [
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:8080/admin',
      `${ORIGIN}/api/data`,
    ]) {
      const res = await mf.dispatchFetch(`${ORIGIN}/api/link/meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
        body: JSON.stringify({ url: badUrl }),
      })
      expect(res.status).toBe(500)
    }

    // 正常公网 HTML 抓取（含相对 icon 路径和无效实体）
    fetchMock
      .get('https://docs.example.com')
      .intercept({ path: '/guide' })
      .reply(
        200,
        '<html><head><title>Doc Site &amp; &#99999999;</title><meta name="description" content="Helpful docs"><link rel="icon" href="/fav.png"></head></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    const okMeta = await mf.dispatchFetch(`${ORIGIN}/api/link/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ url: 'https://docs.example.com/guide' }),
    })
    const metaJson = (await okMeta.json()) as { title: string; description: string; icon: string }
    expect(okMeta.status).toBe(200)
    expect(metaJson.title).toBe('Doc Site &')
    expect(metaJson.description).toBe('Helpful docs')
    expect(metaJson.icon).toBe('https://docs.example.com/fav.png')
  })

  it('supports batch move/privacy/delete via /api/link/batch while respecting duplicate URL rules', async () => {
    const l1 = (await (
      await mf.dispatchFetch(`${ORIGIN}/api/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
        body: JSON.stringify({ category_id: 1, title: 'BatchA', url: 'https://batch-a.example.com' }),
      })
    ).json()) as { meta: { last_row_id: number } }
    const l2 = (await (
      await mf.dispatchFetch(`${ORIGIN}/api/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
        body: JSON.stringify({ category_id: 1, title: 'BatchB', url: 'https://batch-b.example.com' }),
      })
    ).json()) as { meta: { last_row_id: number } }

    const ids = [l1.meta.last_row_id, l2.meta.last_row_id]

    const privRes = await mf.dispatchFetch(`${ORIGIN}/api/link/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ action: 'privacy', ids, is_private: 1 }),
    })
    expect(((await privRes.json()) as { updated: number }).updated).toBe(2)

    const moveRes = await mf.dispatchFetch(`${ORIGIN}/api/link/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ action: 'move', ids, category_id: 2 }),
    })
    expect(((await moveRes.json()) as { updated: number; skipped: number }).updated).toBe(2)

    // 再次移动到同一目标分类应全部跳过
    const moveSameRes = await mf.dispatchFetch(`${ORIGIN}/api/link/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ action: 'move', ids, category_id: 2 }),
    })
    expect(((await moveSameRes.json()) as { updated: number; skipped: number }).skipped).toBe(2)

    const delRes = await mf.dispatchFetch(`${ORIGIN}/api/link/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ action: 'delete', ids }),
    })
    expect(((await delRes.json()) as { updated: number }).updated).toBe(2)

    // 验证批量设为本地首字母图标（icon='letter'）且 SSR 直接输出内联 SVG，不生成 /api/icon 请求
    const letterCreate = (await (
      await mf.dispatchFetch(`${ORIGIN}/api/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
        body: JSON.stringify({ category_id: 1, title: 'MySelfHost', url: 'https://no-icon.example.test' }),
      })
    ).json()) as { meta: { last_row_id: number } }
    const letterId = letterCreate.meta.last_row_id

    const iconBatchRes = await mf.dispatchFetch(`${ORIGIN}/api/link/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ action: 'icon', ids: [letterId], icon: 'letter' }),
    })
    expect(iconBatchRes.status).toBe(200)
    expect(((await iconBatchRes.json()) as { updated: number }).updated).toBe(1)

    await new Promise((r) => setTimeout(r, 150))
    const ssrAfterLetter = await (await mf.dispatchFetch(`${ORIGIN}/`)).text()
    expect(ssrAfterLetter).toContain('MySelfHost')
    expect(ssrAfterLetter).not.toContain('/api/icon?domain=no-icon.example.test')
    expect(ssrAfterLetter).toContain('data:image/svg+xml,')

    await mf.dispatchFetch(`${ORIGIN}/api/link/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ id: letterId }),
    })

    // 验证超过 D1 单条 SQL 100 参数上限（120 条）时分片查询仍可正常批量移动并清理
    const bulkIds: number[] = []
    for (let i = 0; i < 120; i++) {
      const ins = await db
        .prepare('INSERT INTO links (category_id, title, url) VALUES (?, ?, ?)')
        .bind(1, `Bulk-${i}`, `https://bulk-${i}.example.com`)
        .run()
      bulkIds.push(ins.meta.last_row_id as number)
    }
    const bulkMoveRes = await mf.dispatchFetch(`${ORIGIN}/api/link/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ action: 'move', ids: bulkIds, category_id: 2 }),
    })
    expect(bulkMoveRes.status).toBe(200)
    expect(((await bulkMoveRes.json()) as { updated: number }).updated).toBe(120)

    const bulkDelRes = await mf.dispatchFetch(`${ORIGIN}/api/link/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ action: 'delete', ids: bulkIds }),
    })
    expect(bulkDelRes.status).toBe(200)
    expect(((await bulkDelRes.json()) as { updated: number }).updated).toBe(120)
  })

  it('blocks hotlinking and private/self targets on /api/icon, gracefully falls back offline, and purges custom icon URL cache', async () => {
    const customUrl = 'https://down.example.com/favicon.ico'

    // 1. 阻止无来源直刷与跨站盗链（403）
    const bareReq = await mf.dispatchFetch(`${ORIGIN}/api/icon?url=${encodeURIComponent(customUrl)}`)
    expect(bareReq.status).toBe(403)

    const crossSiteReq = await mf.dispatchFetch(`${ORIGIN}/api/icon?url=${encodeURIComponent(customUrl)}`, {
      headers: { 'Sec-Fetch-Site': 'cross-site', Referer: 'https://evil.example.com/' },
    })
    expect(crossSiteReq.status).toBe(403)

    const spoofRefererReq = await mf.dispatchFetch(`${ORIGIN}/api/icon?domain=github.com`, {
      headers: { Referer: `${ORIGIN}.evil.com/` },
    })
    expect(spoofRefererReq.status).toBe(403)

    // 2. 同源请求但指向回环/保留 IP 或本站自身时提前返回 400，不发起外链抓取
    const loopbackReq = await mf.dispatchFetch(`${ORIGIN}/api/icon?url=${encodeURIComponent('http://127.0.0.1:8080/x')}`, {
      headers: { 'Sec-Fetch-Site': 'same-origin' },
    })
    expect(loopbackReq.status).toBe(400)

    const selfUrlReq = await mf.dispatchFetch(`${ORIGIN}/api/icon?url=${encodeURIComponent(`${ORIGIN}/favicon.ico`)}`, {
      headers: { Referer: `${ORIGIN}/` },
    })
    expect(selfUrlReq.status).toBe(400)

    const selfDomainReq = await mf.dispatchFetch(`${ORIGIN}/api/icon?domain=123.pixel5.de5.net`, {
      headers: { 'Sec-Fetch-Site': 'same-origin' },
    })
    expect(selfDomainReq.status).toBe(400)

    // 3. 正常同源请求（离线降级 + 缓存命中 + 精准清除）
    fetchMock.get('https://down.example.com').intercept({ path: '/favicon.ico' }).replyWithError(new Error('offline'))
    const r = await mf.dispatchFetch(`${ORIGIN}/api/icon?url=${encodeURIComponent(customUrl)}`, {
      headers: { 'Sec-Fetch-Site': 'same-origin', Referer: `${ORIGIN}/` },
    })
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('image/svg+xml')
    expect(r.headers.get('X-Icon-Source')).toBe('generated-fallback')

    await new Promise((res) => setTimeout(res, 150))
    const rHit = await mf.dispatchFetch(`${ORIGIN}/api/icon?url=${encodeURIComponent(customUrl)}`, {
      headers: { 'Sec-Fetch-Site': 'same-origin' },
    })
    expect(rHit.headers.get('X-Cache')).toBe('HIT')

    const purge = await mf.dispatchFetch(`${ORIGIN}/api/icon/purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({ url: customUrl }),
    })
    expect(((await purge.json()) as { cacheCleared: boolean }).cacheCleared).toBe(true)
  })
})
