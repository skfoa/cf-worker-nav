/**
 * src/middleware/auth.ts - 3 级鉴权中间件
 * Root (env.PASSWORD) → User (API Token) → Public
 */
import { createMiddleware } from 'hono/factory'
import { safeCompare } from '../utils/security'
import { DAO } from '../db/dao'
import type { HonoEnv } from '../types'

/**
 * DAO 初始化中间件 — 在所有路由前执行
 */
export const daoMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  if (!c.env.DB) {
    return c.json({ error: 'Database D1 is not bound. Check wrangler.toml', success: false }, 500)
  }
  const dao = new DAO(c.env.DB, c.env)
  c.set('dao', dao)
  await next()
})

/**
 * 鉴权中间件 — 提取 Token 并验证身份
 * 结果写入 c.set('isRoot') 和 c.set('isUser')
 */
export const authMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const dao = c.get('dao')
  const authHeader = c.req.header('Authorization')
  let token = ''

  if (authHeader) {
    token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : authHeader.trim()
  }

  // 获取客户端 IP
  const clientIP =
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  c.set('clientIP', clientIP)

  // 速率限制检查（仅在有 token 时）
  if (token) {
    const rateCheck = await dao.checkRateLimit(clientIP)
    if (rateCheck.blocked) {
      const remainingMin = Math.ceil(rateCheck.remainingMs / 60000)
      return c.json({
        error: `Too many failed attempts. Try again in ${remainingMin} minutes.`,
        blocked: true,
        remainingMs: rateCheck.remainingMs,
      }, 429)
    }
  }

  // Level 1: Root 身份
  let isRoot = false
  if (c.env.PASSWORD && token) {
    isRoot = await safeCompare(token, c.env.PASSWORD)
  }

  // Level 2: User 身份
  let isUser = isRoot
  if (!isRoot && token) {
    isUser = await dao.validateToken(token)
  }

  // 登录成功：清除速率限制
  if (isUser && token) {
    await dao.clearRateLimit(clientIP)
  }

  c.set('isRoot', isRoot)
  c.set('isUser', isUser)

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
      return c.json({
        error: `Unauthorized. ${remaining} attempts remaining before lockout.`,
        attemptsRemaining: remaining,
      }, 401)
    }
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
})

/**
 * 要求 Root 权限
 */
export const requireRoot = createMiddleware<HonoEnv>(async (c, next) => {
  if (!c.get('isRoot')) {
    return c.json({ error: 'Root privilege required' }, 403)
  }
  await next()
})
