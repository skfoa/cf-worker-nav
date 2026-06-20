/**
 * src/db/dao.ts - 数据库访问层 (DAO) TypeScript 重写
 * 保留全部原始 SQL 逻辑，添加类型安全
 */
import { hashWithSalt } from '../utils/security'
import type { Category, Link, CategoryWithItems, SiteConfig } from '../types'

export class DAO {
  private db: D1Database
  private salt: string

  // 速率限制配置
  static RATE_LIMIT = {
    MAX_ATTEMPTS: 5,
    WINDOW_MS: 60 * 1000,
    LOCKOUT_MS: 15 * 60 * 1000,
    CLEANUP_INTERVAL_MS: 24 * 60 * 60 * 1000,
    CLEANUP_PROBABILITY: 0.05,
  } as const

  constructor(db: D1Database, env: { TOKEN_SALT?: string }) {
    this.db = db
    this.salt = env.TOKEN_SALT || 'nav_default_salt_CHANGE_IN_PRODUCTION'
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
      : 'SELECT * FROM categories WHERE COALESCE(is_private, 0) = 0 ORDER BY sort_order ASC, id ASC'

    const linksSql = isLogin
      ? 'SELECT * FROM links ORDER BY sort_order ASC, id ASC'
      : `SELECT l.* FROM links l
         INNER JOIN categories c ON l.category_id = c.id
         WHERE COALESCE(c.is_private, 0) = 0
           AND COALESCE(l.is_private, 0) = 0
         ORDER BY l.sort_order ASC, l.id ASC`

    const hotSql = `
      SELECT * FROM links
      WHERE visits > 0 AND COALESCE(is_private, 0) = 0
      ORDER BY visits DESC
      LIMIT 16
    `

    const [catsData, linksData, hotData] = await Promise.all([
      this.db.prepare(catSql).all<Category>(),
      this.db.prepare(linksSql).all<Link>(),
      this.db.prepare(hotSql).all<Link>(),
    ])

    const categories = catsData.results || []
    const links = linksData.results || []
    const hotLinks = hotData.results || []

    const nav: CategoryWithItems[] = categories.map(cat => ({
      ...cat,
      items: links.filter(l => l.category_id === cat.id),
    }))

    // 🔥 热门推荐虚拟分类
    if (hotLinks.length > 0) {
      nav.unshift({
        id: -1,
        title: '🔥 常用推荐',
        items: hotLinks,
        is_private: 0,
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

  async addCategory(data: { title: string; is_private?: number }): Promise<D1Result> {
    const privateVal = data.is_private ? 1 : 0
    return await this.db
      .prepare(
        `INSERT INTO categories (title, sort_order, is_private, created_at, updated_at)
         VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories), ?, ?, ?)`
      )
      .bind(data.title, privateVal, this.now(), this.now())
      .run()
  }

  async updateCategory(data: { id: number; title?: string; is_private?: number }): Promise<D1Result> {
    if (data.title === undefined && data.is_private === undefined) {
      return { success: true, meta: { changes: 0 } } as unknown as D1Result
    }
    let sql = 'UPDATE categories SET updated_at = ?'
    const args: unknown[] = [this.now()]
    if (data.title !== undefined) { sql += ', title = ?'; args.push(data.title) }
    if (data.is_private !== undefined) { sql += ', is_private = ?'; args.push(Number(data.is_private)) }
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

  async importData(data: Array<{
    category?: string; title?: string; is_private?: number
    items?: Array<{ name?: string; title?: string; url: string; description?: string; icon?: string; is_private?: number }>
  }>): Promise<{ success: boolean; count: number; categories_added: number; skipped_count: number; skipped_urls: string[] }> {
    if (!Array.isArray(data)) throw new Error('Invalid format: Root must be an array')

    const n = this.now()
    let existingCats = await this.db.prepare('SELECT id, title FROM categories').all<{ id: number; title: string }>()
    const catMap = new Map<string, number>()
    ;(existingCats.results || []).forEach(c => catMap.set(c.title, c.id))

    const newCatStmts: D1PreparedStatement[] = []
    const newCatNames = new Set<string>()

    for (const group of data) {
      const catTitle = group.category || group.title
      if (catTitle && !catMap.has(catTitle) && !newCatNames.has(catTitle)) {
        newCatStmts.push(
          this.db
            .prepare('INSERT INTO categories (title, is_private, created_at, updated_at) VALUES (?, 0, ?, ?)')
            .bind(catTitle, n, n)
        )
        newCatNames.add(catTitle)
      }
    }

    if (newCatStmts.length > 0) {
      await this.db.batch(newCatStmts)
      existingCats = await this.db.prepare('SELECT id, title FROM categories').all<{ id: number; title: string }>()
      ;(existingCats.results || []).forEach(c => catMap.set(c.title, c.id))
    }

    const linkStmts: D1PreparedStatement[] = []
    let skippedCount = 0
    const skippedUrls: string[] = []

    for (const group of data) {
      const catTitle = group.category || group.title
      const catId = catTitle ? catMap.get(catTitle) : undefined
      if (catId && Array.isArray(group.items)) {
        for (const item of group.items) {
          const url = item.url || ''
          if (!/^https?:\/\//i.test(url)) {
            skippedCount++
            skippedUrls.push(url || '(empty)')
            continue
          }
          linkStmts.push(
            this.db
              .prepare(
                `INSERT INTO links (category_id, title, url, description, icon, is_private, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
              )
              .bind(catId, item.name || item.title || '', url, item.description || '', item.icon || '', n, n)
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
      categories_added: newCatStmts.length,
      skipped_count: skippedCount,
      skipped_urls: skippedUrls.slice(0, 10),
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
}
