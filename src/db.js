/**
 * src/db.js
 * v6.0 Fixed: 修复 Link 隐私字段写入遗漏 & 增强 SQL 过滤逻辑
 * Force Build Update
 */
export default class DAO {
  constructor(db, env = {}) {
    this.db = db;
    // 🔒 Token hashing salt - should be set via environment variable
    this.salt = env.TOKEN_SALT || 'nav_default_salt_CHANGE_IN_PRODUCTION';

    // ⚠️ 安全检测：未配置 TOKEN_SALT 时输出警告
    if (!env.TOKEN_SALT) {
      console.warn('[DAO] ⚠️ WARNING: TOKEN_SALT is not configured! Using default salt value.');
      console.warn('[DAO] 🔒 SECURITY RISK: Please set TOKEN_SALT environment variable in production!');
    }
  }

  _now() {
    return Date.now();
  }

  /**
   * 辅助方法：计算 SHA-256 哈希（带盐值防彩虹表攻击）
   */
  async _hash(input) {
    const msgBuffer = new TextEncoder().encode(input + this.salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ===========================================
  // 核心查询 (Core Query)
  // ===========================================

  async getAllData(isLogin = false) {
    // 1. 获取系统配置
    const config = await this.getConfigs();

    // 2. 动态构建查询
    // 未登录时，分类必须是非私有的 (is_private=0 或 null)
    const catSql = isLogin
      ? "SELECT * FROM categories ORDER BY sort_order ASC, id ASC"
      : "SELECT * FROM categories WHERE COALESCE(is_private, 0) = 0 ORDER BY sort_order ASC, id ASC";

    // 🔒 深度防御 & 修复核心 Bug：
    // 未登录时，使用 INNER JOIN 确保：
    // 1. 分类是公开的 (c.is_private = 0)
    // 2. 链接本身也是公开的 (l.is_private = 0)
    const linksSql = isLogin
      ? "SELECT * FROM links ORDER BY sort_order ASC, id ASC"
      : `SELECT l.* FROM links l 
         INNER JOIN categories c ON l.category_id = c.id 
         WHERE COALESCE(c.is_private, 0) = 0 
           AND COALESCE(l.is_private, 0) = 0
         ORDER BY l.sort_order ASC, l.id ASC`;

    // 🔥 获取 Top 8 热门链接 (visits > 0, 仅公开)
    const hotSql = `
      SELECT * FROM links 
      WHERE visits > 0 AND COALESCE(is_private, 0) = 0
      ORDER BY visits DESC 
      LIMIT 8
    `;

    // 3. 并行查询 (含热门链接)
    const [catsData, linksData, hotData] = await Promise.all([
      this.db.prepare(catSql).all(),
      this.db.prepare(linksSql).all(),
      this.db.prepare(hotSql).all()
    ]);

    const categories = catsData.results || [];
    const links = linksData.results || [];
    const hotLinks = hotData.results || [];

    // 4. 组装数据
    const nav = categories.map(cat => ({
      ...cat,
      items: links.filter(l => l.category_id === cat.id)
    }));

    // 5. 🔥 如果有热门链接，动态插入"常用推荐"虚拟分类
    if (hotLinks.length > 0) {
      nav.unshift({
        id: -1,  // 虚拟 ID
        title: "🔥 常用推荐",
        items: hotLinks,
        is_private: 0,
        sort_order: -999  // 保证排在最前
      });
    }

    return { nav, config };
  }

  // 🔥 点击计数 (用于常用推荐)
  async incrementVisit(id) {
    // 仅更新 visits，不触发 updated_at 以免影响排序
    return await this.db.prepare(
      "UPDATE links SET visits = visits + 1 WHERE id = ?"
    ).bind(id).run();
  }

  // ===========================================
  // Token 管理 (Token Management)
  // ===========================================

  async validateToken(inputToken) {
    if (!inputToken) return false;
    const inputHash = await this._hash(inputToken);
    const res = await this.db.prepare("SELECT 1 FROM tokens WHERE token_hash = ?").bind(inputHash).first();
    return !!res;
  }

  async createToken(name) {
    const randomBuffer = new Uint8Array(32);
    crypto.getRandomValues(randomBuffer);
    const token = Array.from(randomBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
    const tokenHash = await this._hash(token);

    const res = await this.db.prepare(
      "INSERT INTO tokens (name, token_hash, created_at) VALUES (?, ?, ?)"
    ).bind(name, tokenHash, this._now()).run();

    return { id: res.meta.last_row_id, name, token };
  }

  async deleteToken(id) {
    return await this.db.prepare("DELETE FROM tokens WHERE id = ?").bind(id).run();
  }

  // ===========================================
  // 分类管理 (Category CRUD)
  // ===========================================

  async addCategory({ title, is_private = 0 }) {
    // 确保 is_private 只能是 0 或 1，防止 NaN 或其他异常值
    const privateVal = is_private ? 1 : 0;
    return await this.db.prepare(
      `INSERT INTO categories (title, sort_order, is_private, created_at, updated_at) 
       VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories), ?, ?, ?)`
    ).bind(title, privateVal, this._now(), this._now()).run();
  }

  async updateCategory({ id, title, is_private }) {
    if (title === undefined && is_private === undefined) {
      return { success: true, meta: { changes: 0 } };
    }
    let sql = "UPDATE categories SET updated_at = ?";
    const args = [this._now()];
    if (title !== undefined) { sql += ", title = ?"; args.push(title); }
    if (is_private !== undefined) { sql += ", is_private = ?"; args.push(Number(is_private)); }
    sql += " WHERE id = ?";
    args.push(id);
    return await this.db.prepare(sql).bind(...args).run();
  }

  async deleteCategory(id) {
    try {
      return await this.db.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
    } catch (err) {
      // Handle ON DELETE RESTRICT constraint violation
      if (err.message?.includes('FOREIGN KEY constraint failed') ||
        err.message?.includes('SQLITE_CONSTRAINT')) {
        throw new Error('无法删除：请先清空该分类下的所有链接');
      }
      throw err;
    }
  }

  async batchUpdateCategoriesOrder(items) {
    if (!items?.length) return { success: true, meta: { changes: 0 } };
    const now = this._now();
    const stmts = items.map(item =>
      this.db.prepare("UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?").bind(item.sort_order, now, item.id)
    );
    return await this.db.batch(stmts);
  }

  // ===========================================
  // 链接管理 (Link CRUD)
  // ===========================================

  async addLink({ category_id, title, url, icon = "", description = "", is_private = 0 }) {
    // 确保 is_private 只能是 0 或 1，防止 NaN 或其他异常值
    const privateVal = is_private ? 1 : 0;
    return await this.db.prepare(
      `INSERT INTO links (category_id, title, url, description, icon, is_private, sort_order, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM links WHERE category_id = ?), ?, ?)`
    ).bind(category_id, title, url, description, icon, privateVal, category_id, this._now(), this._now()).run();
  }

  async updateLink({ id, category_id, title, url, description, icon, is_private }) {
    if (category_id === undefined && title === undefined && url === undefined &&
      description === undefined && icon === undefined && is_private === undefined) {
      return { success: true, meta: { changes: 0 } };
    }
    let sql = "UPDATE links SET updated_at = ?";
    const args = [this._now()];
    if (category_id !== undefined) { sql += ", category_id = ?"; args.push(category_id); }
    if (title !== undefined) { sql += ", title = ?"; args.push(title); }
    if (url !== undefined) { sql += ", url = ?"; args.push(url); }
    if (description !== undefined) { sql += ", description = ?"; args.push(description); }
    if (icon !== undefined) { sql += ", icon = ?"; args.push(icon); }
    // 🛠️ 修复：更新时包含 is_private 字段
    if (is_private !== undefined) { sql += ", is_private = ?"; args.push(Number(is_private)); }

    sql += " WHERE id = ?";
    args.push(id);
    return await this.db.prepare(sql).bind(...args).run();
  }

  async deleteLink(id) {
    return await this.db.prepare("DELETE FROM links WHERE id = ?").bind(id).run();
  }

  async batchUpdateLinksOrder(items) {
    if (!items?.length) return { success: true, meta: { changes: 0 } };
    const now = this._now();
    const stmts = items.map(item => {
      if (item.category_id !== undefined) {
        return this.db.prepare("UPDATE links SET sort_order = ?, category_id = ?, updated_at = ? WHERE id = ?")
          .bind(item.sort_order, item.category_id, now, item.id);
      } else {
        return this.db.prepare("UPDATE links SET sort_order = ?, updated_at = ? WHERE id = ?")
          .bind(item.sort_order, now, item.id);
      }
    });
    return await this.db.batch(stmts);
  }

  // ===========================================
  // 系统配置 (Configs & Stats)
  // ===========================================

  async getConfigs() {
    const res = await this.db.prepare("SELECT key, value FROM configs").all();
    return (res.results || []).reduce((acc, cur) => {
      acc[cur.key] = cur.value;
      return acc;
    }, {});
  }

  async updateConfig(key, value) {
    return await this.db.prepare(
      `INSERT INTO configs (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
    ).bind(key, value, this._now()).run();
  }

  async getStats() {
    const [c, l] = await Promise.all([
      this.db.prepare("SELECT COUNT(*) as count FROM categories").first(),
      this.db.prepare("SELECT COUNT(*) as count FROM links").first()
    ]);
    return { categories: c.count, links: l.count, db_latency: "low" };
  }

  // ===========================================
  // 批量导入 (Optimized Batch Import)
  // ===========================================

  async importData(data) {
    if (!Array.isArray(data)) throw new Error("Invalid format: Root must be an array");

    const now = this._now();

    // 1. 预读取现有分类 (Title -> ID)
    let existingCats = await this.db.prepare("SELECT id, title FROM categories").all();
    const catMap = new Map();
    (existingCats.results || []).forEach(c => catMap.set(c.title, c.id));

    // 2. 识别并批量插入新分类
    const newCatStmts = [];
    const newCatNames = new Set();

    for (const group of data) {
      const catTitle = group.category || group.title;
      // 默认导入分类为公开 (is_private=0)
      if (catTitle && !catMap.has(catTitle) && !newCatNames.has(catTitle)) {
        newCatStmts.push(
          this.db.prepare("INSERT INTO categories (title, is_private, created_at, updated_at) VALUES (?, 0, ?, ?)")
            .bind(catTitle, now, now)
        );
        newCatNames.add(catTitle);
      }
    }

    if (newCatStmts.length > 0) {
      // 执行批量插入新分类
      await this.db.batch(newCatStmts);

      // 3. 重新获取完整 Map
      existingCats = await this.db.prepare("SELECT id, title FROM categories").all();
      (existingCats.results || []).forEach(c => catMap.set(c.title, c.id));
    }

    // 4. 构建所有链接的插入语句
    const linkStmts = [];
    let skippedCount = 0;
    const skippedUrls = [];
    for (const group of data) {
      const catTitle = group.category || group.title;
      const catId = catMap.get(catTitle);

      if (catId && Array.isArray(group.items)) {
        for (const item of group.items) {
          // 🔒 URL 协议校验：跳过非 http/https URL 以符合 Migration 0003 约束
          const url = item.url || '';
          if (!/^https?:\/\//i.test(url)) {
            console.warn(`[importData] Skipping invalid URL: ${url}`);
            skippedCount++;
            skippedUrls.push(url || '(empty)');
            continue;
          }
          // 🛠️ 修复：导入时显式设置 is_private = 0 (公开)
          linkStmts.push(this.db.prepare(
            `INSERT INTO links (category_id, title, url, description, icon, is_private, created_at, updated_at) 
              VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
          ).bind(catId, item.name || item.title, url, item.description || '', item.icon || '', now, now));
        }
      }
    }

    // 5. 分片执行链接插入
    if (linkStmts.length > 0) {
      const CHUNK_SIZE = 50;
      for (let i = 0; i < linkStmts.length; i += CHUNK_SIZE) {
        await this.db.batch(linkStmts.slice(i, i + CHUNK_SIZE));
      }
    }

    return {
      success: true,
      count: linkStmts.length,
      categories_added: newCatStmts.length,
      skipped_count: skippedCount,
      skipped_urls: skippedUrls.slice(0, 10) // 最多返回10个示例
    };
  }

  // ===========================================
  // 速率限制 (Rate Limiting for Brute-Force Protection)
  // ===========================================

  // 配置常量
  static RATE_LIMIT = {
    MAX_ATTEMPTS: 5,          // 最大尝试次数
    WINDOW_MS: 60 * 1000,     // 时间窗口：1 分钟
    LOCKOUT_MS: 15 * 60 * 1000 // 锁定时间：15 分钟
  };

  /**
   * 检查 IP 是否被锁定
   * @returns {Object} { blocked: boolean, remainingMs: number, attempts: number }
   */
  async checkRateLimit(ip) {
    const now = this._now();

    try {
      const record = await this.db.prepare(
        "SELECT attempts, first_attempt, locked_until FROM login_attempts WHERE ip = ?"
      ).bind(ip).first();

      if (!record) {
        return { blocked: false, remainingMs: 0, attempts: 0 };
      }

      // 检查是否在锁定期内
      if (record.locked_until > now) {
        return {
          blocked: true,
          remainingMs: record.locked_until - now,
          attempts: record.attempts
        };
      }

      // 检查时间窗口是否过期（过期则重置计数）
      const windowExpired = (now - record.first_attempt) > DAO.RATE_LIMIT.WINDOW_MS;
      if (windowExpired) {
        // 清理过期记录
        await this.db.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
        return { blocked: false, remainingMs: 0, attempts: 0 };
      }

      return {
        blocked: false,
        remainingMs: 0,
        attempts: record.attempts
      };
    } catch (e) {
      // 表可能不存在（迁移未执行），降级为不限制
      console.warn('[RateLimit] Check failed:', e.message);
      return { blocked: false, remainingMs: 0, attempts: 0 };
    }
  }

  /**
   * 记录一次失败的登录尝试
   * @returns {Object} { locked: boolean, attempts: number, lockoutMs: number }
   */
  async recordFailedAttempt(ip) {
    const now = this._now();
    const { MAX_ATTEMPTS, WINDOW_MS, LOCKOUT_MS } = DAO.RATE_LIMIT;

    try {
      const record = await this.db.prepare(
        "SELECT attempts, first_attempt FROM login_attempts WHERE ip = ?"
      ).bind(ip).first();

      let newAttempts = 1;
      let firstAttempt = now;

      if (record) {
        // 检查时间窗口
        const windowExpired = (now - record.first_attempt) > WINDOW_MS;
        if (windowExpired) {
          // 重置计数
          newAttempts = 1;
          firstAttempt = now;
        } else {
          newAttempts = record.attempts + 1;
          firstAttempt = record.first_attempt;
        }
      }

      // 判断是否需要锁定
      const shouldLock = newAttempts >= MAX_ATTEMPTS;
      const lockedUntil = shouldLock ? (now + LOCKOUT_MS) : 0;

      // Upsert 记录
      await this.db.prepare(`
        INSERT INTO login_attempts (ip, attempts, first_attempt, locked_until)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(ip) DO UPDATE SET 
          attempts = excluded.attempts,
          first_attempt = excluded.first_attempt,
          locked_until = excluded.locked_until
      `).bind(ip, newAttempts, firstAttempt, lockedUntil).run();

      return {
        locked: shouldLock,
        attempts: newAttempts,
        lockoutMs: shouldLock ? LOCKOUT_MS : 0
      };
    } catch (e) {
      console.warn('[RateLimit] Record failed:', e.message);
      return { locked: false, attempts: 0, lockoutMs: 0 };
    }
  }

  /**
   * 登录成功后清除该 IP 的记录
   */
  async clearRateLimit(ip) {
    try {
      await this.db.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
    } catch (e) {
      console.warn('[RateLimit] Clear failed:', e.message);
    }
  }

  /**
   * 清理过期的锁定记录（可选：定期调用）
   */
  async cleanupExpiredLocks() {
    const now = this._now();
    try {
      await this.db.prepare(
        "DELETE FROM login_attempts WHERE locked_until > 0 AND locked_until < ?"
      ).bind(now).run();
    } catch (e) {
      console.warn('[RateLimit] Cleanup failed:', e.message);
    }
  }
}

