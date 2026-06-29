/**
 * src/middleware/auth.ts - 3 级鉴权中间件
 * Root (env.PASSWORD) → User (API Token) → Public
 */
import { createMiddleware } from 'hono/factory'
import { getCookie, setCookie } from 'hono/cookie'
import { safeCompare } from '../utils/security'
import { verifySession } from '../utils/session'
import { DAO } from '../db/dao'
import type { HonoEnv } from '../types'

/**
 * DAO 初始化中间件 — 在所有路由前执行
 */
export const daoMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  if (!c.env.DB) {
    return c.json({ error: 'Database D1 is not bound. Check wrangler.toml', success: false }, 500)
  }
  if (!c.env.COOKIE_SECRET || !c.env.PASSWORD) {
    return c.json({ error: 'System unconfigured: COOKIE_SECRET and PASSWORD are required in env', success: false }, 500)
  }
  const dao = new DAO(c.env.DB, c.env)
  c.set('dao', dao)
  await next()
})

/**
 * 鉴权中间件 — 提取 Token/Cookie 并验证身份
 * 结果写入 c.set('isRoot') 和 c.set('isUser')
 */
export const authMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const dao = c.get('dao')
  const authHeader = c.req.header('Authorization')
  const cookieToken = getCookie(c, 'nav_token')
  let isRoot = false
  let isUser = false
  let isCookieAuth = false

  // 获取客户端 IP 和 物理位置
  const clientIP =
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  const region = (c.req.raw as any)?.cf?.country || 'Local'
  c.set('clientIP', clientIP)

  // 1. Header Authentication (API Token / Legacy Password)
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim()
    isRoot = await safeCompare(token, c.env.PASSWORD!)
    isUser = isRoot || await dao.validateToken(token)
  } 
  // 2. Cookie Authentication
  else if (cookieToken) {
    const payload = await verifySession(cookieToken, c.env.COOKIE_SECRET! + c.env.PASSWORD!)
    if (payload === 'root') {
      isRoot = true
      isUser = true
      isCookieAuth = true
    } else {
      console.warn('[Security] Session verification failed: invalid signature or expired cookie')
      c.executionCtx.waitUntil(
        dao.addLog({
          ip: clientIP,
          region,
          level: 'DANGER',
          action: 'session_verification_failed',
          details: 'A forged or expired cookie was detected.'
        })
      )
    }
  }

  c.set('isRoot', isRoot)
  c.set('isUser', isUser)

  // 3. Sliding Expiration for GET requests authenticated via Cookie
  if (isCookieAuth && c.req.method === 'GET') {
    setCookie(c, 'nav_token', cookieToken!, {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === 'https:',
      sameSite: 'Lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })
  }

  await next()
})

/**
 * 保护路由中间件 — 要求已登录
 */
export const requireAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const isUser = c.get('isUser')
  const dao = c.get('dao')
  const clientIP = c.get('clientIP')

  if (!isUser) {
    const authHeader = c.req.header('Authorization')
    const token = authHeader
      ? (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim())
      : ''

    if (token) {
      const result = await dao.recordFailedAttempt(clientIP)
      if (result.locked) {
        const lockMin = Math.ceil(result.lockoutMs / 60000)
        return c.json({
          error: `Account locked due to too many failed attempts. Try again in ${lockMin} minutes.`,
          blocked: true,
          lockoutMs: result.lockoutMs,
        }, 429)
      }
      const remaining = 5 - result.attempts
      return c.json({ error: 'Not Found' }, 404) // Stealth Mode: Fake 404 instead of 401
    }
    return c.text('Not Found', 404) // Stealth Mode: Fake 404 instead of 401
  }

  await next()
})

/**
 * 要求 Root 权限
 */
export const requireRoot = createMiddleware<HonoEnv>(async (c, next) => {
  if (!c.get('isRoot')) {
    return c.text('Not Found', 404) // Stealth Mode: Fake 404 instead of 403
  }
  await next()
})
