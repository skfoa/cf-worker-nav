/**
 * src/routes/pages.tsx - 页面路由 (SSR)
 */
import { Hono } from 'hono'
import type { HonoEnv } from '../types'
import { Layout } from '../components/Layout'
import { Navbar } from '../components/Navbar'
import { SearchBox } from '../components/SearchBox'
import { LinkGrid } from '../components/LinkGrid'
import { Dock } from '../components/Dock'
import { Modal } from '../components/Modal'
import { safeJsonStringify, escapeHtml } from '../utils/helpers'

const pages = new Hono<HonoEnv>()

// [GET] robots.txt
pages.get('/robots.txt', (c) => {
  return c.text(
    `# 🔒 Disallow all crawlers to prevent SEO indexing
User-agent: *
Disallow: /

User-agent: Googlebot
Disallow: /

User-agent: Bingbot
Disallow: /

User-agent: Baiduspider
Disallow: /

User-agent: YandexBot
Disallow: /
`,
    200,
    {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
      'X-Robots-Tag': 'noindex, nofollow',
    }
  )
})

// [GET] PWA Manifest
pages.get('/manifest.json', async (c) => {
  const dao = c.get('dao')
  let title = c.env.TITLE || 'Nav'
  try {
    const config = await dao.getConfigs()
    if (config.title) title = config.title
  } catch { /* fallback */ }

  return c.json(
    {
      name: title,
      short_name: title.length > 12 ? 'Nav' : title,
      start_url: '/',
      display: 'standalone',
      background_color: '#1a1a1a',
      theme_color: '#1a1a1a',
      icons: [
        { src: 'https://cdn-icons-png.flaticon.com/512/1006/1006771.png', sizes: '192x192', type: 'image/png' },
      ],
    },
    200,
    { 'Cache-Control': 'public, max-age=86400' }
  )
})

// [GET] 首页及管理员入口
const renderApp = async (c: any) => {
  const dao = c.get('dao')
  const isUser = c.get('isUser')
  const isRoot = c.get('isRoot')

  try {
    const config = await dao.getConfigs()
    const title = config.title || c.env.TITLE || 'My Nav'
    const bgImage = config.bg_image || c.env.BG_IMAGE || ''

    // 私有模式下未登录不注入数据，否则拉取全量数据
    const ssrData = (await dao.getAllData(isUser)).nav

    // 构建安全的客户端状态
    const clientState = safeJsonStringify({
      data: ssrData,
      config: { TITLE: title, BG_IMAGE: bgImage },
      isRoot,
      isAdmin: isUser,
    })

    return c.html(
      <Layout title={title} bgImage={bgImage}>
        <Navbar categories={ssrData} />
        <SearchBox />
        <LinkGrid categories={ssrData} isAdmin={isUser} />
        <Modal />
        <Dock isAdmin={isUser} />
        {/* 客户端状态注入 */}
        <script dangerouslySetInnerHTML={{ __html: `window.__NAV_STATE__=${clientState};` }} />
        {/* 客户端逻辑 */}
        <script src="/client.min.js" />
      </Layout>
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return c.html(
      <html>
        <body style="background:#111;color:#fff;font-family:sans-serif;padding:2rem;">
          <h1>🚧 System Error</h1>
          <p>{escapeHtml(msg)}</p>
        </body>
      </html>,
      500
    )
  }
}

pages.get('/', renderApp)
pages.get('/admin', renderApp)

export { pages }
