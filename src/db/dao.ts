/**
 * src/db/dao.ts - 数据库访问层 (DAO) TypeScript 重写
 * 保留全部原始 SQL 逻辑，添加类型安全
 */
import { hashWithSalt } from '../utils/security'
import type { Category, Link, CategoryWithItems, SiteConfig } from '../types'
import { SafeUrlSchema } from '../types'

export class DAO {
  private db: D1Database
  private salt: string
  private logLevel: string

  // 速率限制配置
  static RATE_LIMIT = {
    MAX_ATTEMPTS: 5,
    WINDOW_MS: 60 * 1000,
    LOCKOUT_MS: 15 * 60 * 1000,
    CLEANUP_INTERVAL_MS: 24 * 60 * 60 * 1000,
    CLEANUP_PROBABILITY: 0.05,
  } as const

  constructor(db: D1Database, env: { TOKEN_SALT?: string; LOG_LEVEL?: string }) {
    this.db = db
    this.salt = env.TOKEN_SALT || 'nav_default_salt_CHANGE_IN_PRODUCTION'
    this.logLevel = (env.LOG_LEVEL || 'INFO').toUpperCase()
    if (!env.TOKEN_SALT) {
      console.warn('[DAO] ⚠️ TOKEN_SALT is not configured! Using default salt.')
    }
  }

  private now(): number {
    return Date.now()
  }

  private async hash(input: string): Promise<string> {
    return hashWithSalt(input, this.salt)
  }

  // ===========================================
  // 核心查询
  // ===========================================

  async getAllData(isLogin = false): Promise<{ nav: CategoryWithItems[]; config: SiteConfig }> {
    const config = await this.getConfigs()

    const catSql = isLogin
      ? 'SELECT * FROM categories ORDER BY sort_order ASC, id ASC'
      : `SELECT * FROM categories 
         WHERE COALESCE(is_private, 0) = 0 
           AND (parent_id IS NULL OR parent_id IN (SELECT id FROM categories WHERE COALESCE(is_private, 0) = 0))
         ORDER BY sort_order ASC, id ASC`

    const linksSql = isLogin
      ? 'SELECT * FROM links ORDER BY sort_order ASC, id ASC'
      : `SELECT l.* FROM links l
         INNER JOIN categories c ON l.category_id = c.id
         WHERE COALESCE(c.is_private, 0) = 0
           AND (c.parent_id IS NULL OR c.parent_id IN (SELECT id FROM categories WHERE COALESCE(is_private, 0) = 0))
           AND COALESCE(l.is_private, 0) = 0
         ORDER BY l.sort_order ASC, l.id ASC`

    const hotSql = `
      SELECT * FROM links
      WHERE visits > 0 AND COALESCE(is_private, 0) = 0
      ORDER BY visits DESC
      LIMIT 24
    `

    const [catsData, linksData, hotData] = await Promise.all([
      this.db.prepare(catSql).all<Category>(),
      this.db.prepare(linksSql).all<Link>(),
      isLogin ? this.db.prepare(hotSql).all<Link>() : Promise.resolve({ results: [] as Link[] }),
    ])

    const categories = catsData.results || []
    const links = linksData.results || []
    const hotLinks = hotData.results || []

    // 为每个分类分配链接
    const allCatsWithItems: CategoryWithItems[] = categories.map(cat => ({
      ...cat,
      items: links.filter(l => l.category_id === cat.id),
      children: [],
    }))

    // 树形组装：子分类挂到父分类下
    const catMap = new Map<number, CategoryWithItems>()
    allCatsWithItems.forEach(c => catMap.set(c.id, c))

    const nav: CategoryWithItems[] = []
    for (const cat of allCatsWithItems) {
      if (cat.parent_id && catMap.has(cat.parent_id)) {
        catMap.get(cat.parent_id)!.children!.push(cat)
      } else {
        nav.push(cat)
      }
    }

    // 🔥 热门推荐虚拟分类（仅登录用户可见）
    if (isLogin && hotLinks.length > 0) {
      nav.unshift({
        id: -1,
        title: '🔥 常用推荐',
        items: hotLinks,
        is_private: 1,
        sort_order: -999,
        created_at: 0,
        updated_at: 0,
      })
    }

    return { nav, config }
  }

  async incrementVisit(id: number): Promise<D1Result> {
    return await this.db
      .prepare('UPDATE links SET visits = visits + 1 WHERE id = ?')
      .bind(id)
      .run()
  }

  // ===========================================
  // Token 管理
  // ===========================================

  async validateToken(inputToken: string): Promise<boolean> {
    if (!inputToken) return false
    const inputHash = await this.hash(inputToken)
    const res = await this.db
      .prepare('SELECT 1 FROM tokens WHERE token_hash = ?')
      .bind(inputHash)
      .first()
    return !!res
  }

  async createToken(name: string): Promise<{ id: number; name: string; token: string }> {
    const randomBuffer = new Uint8Array(32)
    crypto.getRandomValues(randomBuffer)
    const token = Array.from(randomBuffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    const tokenHash = await this.hash(token)

    const res = await this.db
      .prepare('INSERT INTO tokens (name, token_hash, created_at) VALUES (?, ?, ?)')
      .bind(name, tokenHash, this.now())
      .run()

    return { id: res.meta.last_row_id as number, name, token }
  }

  async deleteToken(id: number): Promise<D1Result> {
    return await this.db.prepare('DELETE FROM tokens WHERE id = ?').bind(id).run()
  }

  async listTokens(): Promise<{ id: number; name: string; created_at: number }[]> {
    const res = await this.db
      .prepare('SELECT id, name, created_at FROM tokens ORDER BY created_at DESC')
      .all<{ id: number; name: string; created_at: number }>()
    return res.results || []
  }

  // ===========================================
  // 分类管理
  // ===========================================

  async addCategory(data: { title: string; is_private?: number; parent_id?: number }): Promise<D1Result> {
    const privateVal = data.is_private ? 1 : 0
    const parentId = data.parent_id || null
    return await this.db
      .prepare(
        `INSERT INTO categories (title, sort_order, is_private, parent_id, created_at, updated_at)
         VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories), ?, ?, ?, ?)`
      )
      .bind(data.title, privateVal, parentId, this.now(), this.now())
      .run()
  }

  async updateCategory(data: { id: number; title?: string; is_private?: number; parent_id?: number | null }): Promise<D1Result> {
    const fields = ['title', 'is_private', 'parent_id'] as const
    const hasUpdate = fields.some(f => data[f] !== undefined)
    if (!hasUpdate) {
      return { success: true, meta: { changes: 0 } } as unknown as D1Result
    }
    let sql = 'UPDATE categories SET updated_at = ?'
    const args: unknown[] = [this.now()]
    if (data.title !== undefined) { sql += ', title = ?'; args.push(data.title) }
    if (data.is_private !== undefined) { sql += ', is_private = ?'; args.push(Number(data.is_private)) }
    if (data.parent_id !== undefined) { sql += ', parent_id = ?'; args.push(data.parent_id) }
    sql += ' WHERE id = ?'
    args.push(data.id)
    return await this.db.prepare(sql).bind(...args).run()
  }

  async deleteCategory(id: number): Promise<D1Result> {
    try {
      return await this.db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('FOREIGN KEY constraint failed') || msg.includes('SQLITE_CONSTRAINT')) {
        throw new Error('无法删除：请先清空该分类下的所有链接')
      }
      throw err
    }
  }

  async batchUpdateCategoriesOrder(items: { id: number; sort_order: number }[]): Promise<D1Result[]> {
    if (!items?.length) return []
    const n = this.now()
    const stmts = items.map(item =>
      this.db
        .prepare('UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?')
        .bind(item.sort_order, n, item.id)
    )
    return await this.db.batch(stmts)
  }

  // ===========================================
  // 链接管理
  // ===========================================

  async addLink(data: {
    category_id: number; title: string; url: string
    icon?: string; description?: string; is_private?: number
  }): Promise<D1Result> {
    // 同分类下 URL 去重检查
    const existing = await this.db
      .prepare('SELECT id FROM links WHERE category_id = ? AND url = ?')
      .bind(data.category_id, data.url)
      .first<{ id: number }>()
    if (existing) {
      throw new Error('该分类下已存在相同 URL 的链接')
    }

    const privateVal = data.is_private ? 1 : 0
    return await this.db
      .prepare(
        `INSERT INTO links (category_id, title, url, description, icon, is_private, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM links WHERE category_id = ?), ?, ?)`
      )
      .bind(
        data.category_id, data.title, data.url,
        data.description || '', data.icon || '', privateVal,
        data.category_id, this.now(), this.now()
      )
      .run()
  }

  async updateLink(data: {
    id: number; category_id?: number; title?: string; url?: string
    description?: string; icon?: string; is_private?: number
  }): Promise<D1Result> {
    const fields = ['category_id', 'title', 'url', 'description', 'icon', 'is_private'] as const
    const hasUpdate = fields.some(f => data[f] !== undefined)
    if (!hasUpdate) return { success: true, meta: { changes: 0 } } as unknown as D1Result

    let sql = 'UPDATE links SET updated_at = ?'
    const args: unknown[] = [this.now()]
    if (data.category_id !== undefined) { sql += ', category_id = ?'; args.push(data.category_id) }
    if (data.title !== undefined) { sql += ', title = ?'; args.push(data.title) }
    if (data.url !== undefined) { sql += ', url = ?'; args.push(data.url) }
    if (data.description !== undefined) { sql += ', description = ?'; args.push(data.description) }
    if (data.icon !== undefined) { sql += ', icon = ?'; args.push(data.icon) }
    if (data.is_private !== undefined) { sql += ', is_private = ?'; args.push(Number(data.is_private)) }
    sql += ' WHERE id = ?'
    args.push(data.id)
    return await this.db.prepare(sql).bind(...args).run()
  }

  async deleteLink(id: number): Promise<D1Result> {
    return await this.db.prepare('DELETE FROM links WHERE id = ?').bind(id).run()
  }

  async batchUpdateLinksOrder(items: { id: number; sort_order: number; category_id?: number }[]): Promise<D1Result[]> {
    if (!items?.length) return []
    const n = this.now()
    const stmts = items.map(item => {
      if (item.category_id !== undefined) {
        return this.db
          .prepare('UPDATE links SET sort_order = ?, category_id = ?, updated_at = ? WHERE id = ?')
          .bind(item.sort_order, item.category_id, n, item.id)
      }
      return this.db
        .prepare('UPDATE links SET sort_order = ?, updated_at = ? WHERE id = ?')
        .bind(item.sort_order, n, item.id)
    })
    return await this.db.batch(stmts)
  }

  // ===========================================
  // 系统配置
  // ===========================================

  async getConfigs(): Promise<SiteConfig> {
    const res = await this.db
      .prepare('SELECT key, value FROM configs')
      .all<{ key: string; value: string }>()
    return (res.results || []).reduce((acc, cur) => {
      acc[cur.key] = cur.value
      return acc
    }, {} as SiteConfig)
  }

  async updateConfig(key: string, value: string): Promise<D1Result> {
    return await this.db
      .prepare(
        `INSERT INTO configs (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
      )
      .bind(key, value, this.now())
      .run()
  }

  async getStats(): Promise<{ categories: number; links: number; db_latency: string }> {
    const [c, l] = await Promise.all([
      this.db.prepare('SELECT COUNT(*) as count FROM categories').first<{ count: number }>(),
      this.db.prepare('SELECT COUNT(*) as count FROM links').first<{ count: number }>(),
    ])
    return { categories: c?.count || 0, links: l?.count || 0, db_latency: 'low' }
  }

  // ===========================================
  // 批量导入
  // ===========================================

  async importData(inputData: any): Promise<{ success: boolean; count: number; categories_added: number; skipped_count: number; skipped_urls: string[] }> {
    const data: Array<{
      category?: string; title?: string; parent_category?: string; is_private?: number
      items?: Array<{ name?: string; title?: string; url: string; description?: string; icon?: string; is_private?: number }>
    }> = Array.isArray(inputData) ? inputData : (inputData && Array.isArray(inputData.data) ? inputData.data : null)

    if (!Array.isArray(data)) throw new Error('Invalid format: Root or "data" field must be an array')

    const n = this.now()
    let existingCats = await this.db.prepare('SELECT id, title, parent_id, is_private FROM categories').all<Category>()
    const catMap = new Map<string, number>()
    ;(existingCats.results || []).forEach(c => catMap.set(c.title, c.id))

    let categoriesAdded = 0

    // 1. 确保所有分类存在（包括主分类与子分类）
    for (const group of data) {
      const catTitle = group.category || group.title
      if (catTitle && !catMap.has(catTitle)) {
        const isPriv = group.is_private ? 1 : 0
        const res = await this.db
          .prepare('INSERT INTO categories (title, is_private, created_at, updated_at) VALUES (?, ?, ?, ?)')
          .bind(catTitle, isPriv, n, n)
          .run()
        if (res.meta.last_row_id) {
          catMap.set(catTitle, res.meta.last_row_id)
          categoriesAdded++
        }
      }
    }

    // 2. 绑定子分类与父分类的关系
    for (const group of data) {
      const catTitle = group.category || group.title
      if (catTitle && group.parent_category && catMap.has(group.parent_category)) {
        const catId = catMap.get(catTitle)!
        const parentId = catMap.get(group.parent_category)!
        if (catId !== parentId) {
          await this.db
            .prepare('UPDATE categories SET parent_id = ?, updated_at = ? WHERE id = ?')
            .bind(parentId, n, catId)
            .run()
        }
      }
    }

    // 刷新分类映射
    existingCats = await this.db.prepare('SELECT id, title FROM categories').all<Category>()
    ;(existingCats.results || []).forEach(c => catMap.set(c.title, c.id))

    // 3. 查重防重复插入
    const existingLinks = await this.db.prepare('SELECT category_id, url FROM links').all<{ category_id: number; url: string }>()
    const existingLinkSet = new Set<string>()
    ;(existingLinks.results || []).forEach(l => existingLinkSet.add(`${l.category_id}|${l.url}`))

    const linkStmts: D1PreparedStatement[] = []
    let skippedCount = 0
    const skippedUrls: string[] = []

    for (const group of data) {
      const catTitle = group.category || group.title
      const catId = catTitle ? catMap.get(catTitle) : undefined
      if (catId && Array.isArray(group.items)) {
        for (const item of group.items) {
          const url = item.url || ''
          const urlParse = SafeUrlSchema.safeParse(url)
          if (!urlParse.success) {
            skippedCount++
            skippedUrls.push(`${url || '(empty)'} (格式不合规)`)
            continue
          }

          const dupKey = `${catId}|${url}`
          if (existingLinkSet.has(dupKey)) {
            skippedCount++
            skippedUrls.push(`${url} (已存在)`)
            continue
          }
          existingLinkSet.add(dupKey)

          const itemTitle = item.name || item.title || ''
          const isPriv = item.is_private ? 1 : 0
          linkStmts.push(
            this.db
              .prepare(
                `INSERT INTO links (category_id, title, url, description, icon, is_private, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(catId, itemTitle, url, item.description || '', item.icon || '', isPriv, n, n)
          )
        }
      }
    }

    if (linkStmts.length > 0) {
      const CHUNK_SIZE = 50
      for (let i = 0; i < linkStmts.length; i += CHUNK_SIZE) {
        await this.db.batch(linkStmts.slice(i, i + CHUNK_SIZE))
      }
    }

    return {
      success: true,
      count: linkStmts.length,
      categories_added: categoriesAdded,
      skipped_count: skippedCount,
      skipped_urls: skippedUrls,
    }
  }

  // ===========================================
  // 速率限制
  // ===========================================

  async checkRateLimit(ip: string): Promise<{ blocked: boolean; remainingMs: number; attempts: number }> {
    const n = this.now()
    await this.maybeCleanup()
    try {
      const record = await this.db
        .prepare('SELECT attempts, first_attempt, locked_until FROM login_attempts WHERE ip = ?')
        .bind(ip)
        .first<{ attempts: number; first_attempt: number; locked_until: number }>()

      if (!record) return { blocked: false, remainingMs: 0, attempts: 0 }

      if (record.locked_until > n) {
        return { blocked: true, remainingMs: record.locked_until - n, attempts: record.attempts }
      }

      if ((n - record.first_attempt) > DAO.RATE_LIMIT.WINDOW_MS) {
        await this.db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run()
        return { blocked: false, remainingMs: 0, attempts: 0 }
      }

      return { blocked: false, remainingMs: 0, attempts: record.attempts }
    } catch (e: unknown) {
      console.warn('[RateLimit] Check failed:', e instanceof Error ? e.message : e)
      return { blocked: false, remainingMs: 0, attempts: 0 }
    }
  }

  async recordFailedAttempt(ip: string): Promise<{ locked: boolean; attempts: number; lockoutMs: number }> {
    const n = this.now()
    const { MAX_ATTEMPTS, WINDOW_MS, LOCKOUT_MS } = DAO.RATE_LIMIT
    try {
      const record = await this.db
        .prepare('SELECT attempts, first_attempt FROM login_attempts WHERE ip = ?')
        .bind(ip)
        .first<{ attempts: number; first_attempt: number }>()

      let newAttempts = 1
      let firstAttempt = n

      if (record) {
        if ((n - record.first_attempt) > WINDOW_MS) {
          newAttempts = 1
          firstAttempt = n
        } else {
          newAttempts = record.attempts + 1
          firstAttempt = record.first_attempt
        }
      }

      const shouldLock = newAttempts >= MAX_ATTEMPTS
      const lockedUntil = shouldLock ? (n + LOCKOUT_MS) : 0

      await this.db
        .prepare(
          `INSERT INTO login_attempts (ip, attempts, first_attempt, locked_until)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(ip) DO UPDATE SET
             attempts = excluded.attempts,
             first_attempt = excluded.first_attempt,
             locked_until = excluded.locked_until`
        )
        .bind(ip, newAttempts, firstAttempt, lockedUntil)
        .run()

      return { locked: shouldLock, attempts: newAttempts, lockoutMs: shouldLock ? LOCKOUT_MS : 0 }
    } catch (e: unknown) {
      console.warn('[RateLimit] Record failed:', e instanceof Error ? e.message : e)
      return { locked: false, attempts: 0, lockoutMs: 0 }
    }
  }

  async clearRateLimit(ip: string): Promise<void> {
    try {
      await this.db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run()
    } catch (e: unknown) {
      console.warn('[RateLimit] Clear failed:', e instanceof Error ? e.message : e)
    }
  }

  private async cleanupExpiredLocks(): Promise<void> {
    const n = this.now()
    const threshold = n - DAO.RATE_LIMIT.CLEANUP_INTERVAL_MS
    try {
      const result = await this.db
        .prepare(
          `DELETE FROM login_attempts
           WHERE (locked_until > 0 AND locked_until < ?)
              OR first_attempt < ?`
        )
        .bind(n, threshold)
        .run()
      if (result.meta?.changes && result.meta.changes > 0) {
        console.log(`[RateLimit] Cleaned up ${result.meta.changes} expired records`)
      }
    } catch (e: unknown) {
      console.warn('[RateLimit] Cleanup failed:', e instanceof Error ? e.message : e)
    }
  }

  private async maybeCleanup(): Promise<void> {
    if (Math.random() < DAO.RATE_LIMIT.CLEANUP_PROBABILITY) {
      await this.cleanupExpiredLocks()
    }
  }

  // ===========================================
  // 操作日志
  // ===========================================

  async addLog(log: { ip: string; region?: string; level: 'INFO' | 'WARN' | 'DANGER'; action: string; details?: string }): Promise<void> {
    // 动态日志熔断：根据 LOG_LEVEL 丢弃低级别日志
    if (this.logLevel === 'WARN' && log.level === 'INFO') return
    if (this.logLevel === 'DANGER' && (log.level === 'INFO' || log.level === 'WARN')) return

    try {
      await this.db
        .prepare('INSERT INTO operation_logs (created_at, ip, region, level, action, details) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(this.now(), log.ip, log.region || '', log.level, log.action, log.details || '')
        .run()
        
      // 概率清理（维持约 500 条）
      if (Math.random() < 0.1) {
        await this.db
          .prepare('DELETE FROM operation_logs WHERE id IN (SELECT id FROM operation_logs ORDER BY created_at DESC LIMIT -1 OFFSET 500)')
          .run()
      }
    } catch (e: unknown) {
      console.error('[Logs] Failed to write log:', e instanceof Error ? e.message : e)
    }
  }

  async getLogs(page = 1, limit = 20): Promise<{ logs: any[]; total: number }> {
    const offset = (page - 1) * limit
    const [data, totalRes] = await Promise.all([
      this.db
        .prepare('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT ? OFFSET ?')
        .bind(limit, offset)
        .all(),
      this.db
        .prepare('SELECT COUNT(*) as count FROM operation_logs')
        .first<{ count: number }>()
    ])
    return { logs: data.results || [], total: totalRes?.count || 0 }
  }

  async clearLogs(): Promise<{ deleted: number }> {
    const result = await this.db
      .prepare('DELETE FROM operation_logs')
      .run()
    return { deleted: result.meta.changes || 0 }
  }
}
