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
    if (allowed && origin === allowed) return origin
    // 若未配置跨域白名单，则严格禁止跨域带有 credentials 的请求
    // 返回空字符串会使 CORS 校验失败，仅允许完全同源的请求
    return allowed || ''
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}))

app.use('/api/*', csrf())
app.use('/api/*', bodyLimit({ maxSize: 50 * 1024 }))
app.use('*', daoMiddleware)
app.use('*', authMiddleware)

app.route('/', pages)
app.route('/api', api)

app.get('/robots.txt', (c) => {
  return c.text('User-agent: *\nDisallow: /')
})

app.notFound((c) => {
  return c.text('Not Found', 404)
})

app.onError((err, c) => {
  console.error(`[Error] ${c.req.path}:`, err.message)
  return c.json({ error: err.message, success: false }, 500)
})

export default app
