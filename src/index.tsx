/**
 * src/index.tsx - Hono 入口 + 全局中间件
 */
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { logger } from 'hono/logger'
import { bodyLimit } from 'hono/body-limit'
import { timing } from 'hono/timing'
import type { HonoEnv } from './types'
import { daoMiddleware, authMiddleware } from './middleware/auth'
import { pages } from './routes/pages'
import { api } from './routes/api'
import { LoginForm } from './components/LoginForm'

const app = new Hono<HonoEnv>()

app.use('*', logger())
app.use('*', timing())
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com', 'https://cdn.jsdelivr.net'],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    connectSrc: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
  xFrameOptions: 'DENY',
  xXssProtection: '1',
  referrerPolicy: 'strict-origin-when-cross-origin',
}))

app.use('*', cors({
  origin: (origin, c) => {
    const allowed = c.env.ALLOWED_ORIGIN
    if (allowed) return origin === allowed ? origin : ''
    return origin || '*'
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))

app.use('/api/*', csrf())
app.use('/api/*', bodyLimit({ maxSize: 50 * 1024 }))
app.use('*', daoMiddleware)
app.use('*', authMiddleware)

app.route('/', pages)
app.route('/api', api)

app.notFound(async (c) => {
  try {
    const dao = c.get('dao')
    const config = await dao.getConfigs()
    const isPrivate = config.private_mode === 'true' || config.private_mode === '1'
    if (isPrivate) {
      const title = config.title || c.env.TITLE || 'My Nav'
      const bgImage = config.bg_image || c.env.BG_IMAGE || ''
      return c.html(<LoginForm title={title} bgImage={bgImage} />, 200)
    }
  } catch { /* fallback */ }
  return c.text('Not Found', 404)
})

app.onError((err, c) => {
  console.error(`[Error] ${c.req.path}:`, err.message)
  return c.json({ error: err.message, success: false }, 500)
})

export default app
