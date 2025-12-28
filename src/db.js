/**
 * src/db.js
 * D1 Database Access Object (DAO)
 * v5.0 Audit Fixes - Performance Optimized Import & Strict Consistency
 */
export class DAO {
  constructor(db) {
    this.db = db;
  }

  _now() {
    return Date.now();
  }

  /**
   * 辅助方法：计算 SHA-256 哈希
   */
  async _hash(input) {
    const msgBuffer = new TextEncoder().encode(input);
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
    const catSql = isLogin 
      ? "SELECT * FROM categories ORDER BY sort_order ASC, id ASC"
      : "SELECT * FROM categories WHERE is_private = 0 ORDER BY sort_order ASC, id ASC";

    // 🔒 深度防御：未登录时，使用 INNER JOIN 确保只查出公开分类下的链接
    const linksSql = isLogin
      ? "SELECT * FROM links ORDER BY sort_order ASC, id ASC"
      : `SELECT l.* FROM links l 
         INNER JOIN categories c ON l.category_id = c.id 
         WHERE c.is_private = 0 
         ORDER BY l.sort_order ASC, l.id ASC`;

    // 3. 并行查询
    const [catsData, linksData] = await Promise.all([
      this.db.prepare(catSql).all(),
      this.db.prepare(linksSql).all()
    ]);

    const categories = catsData.results || [];
    const links = linksData.results || [];

    // 4. 组装数据
    const nav = categories.map(cat => ({
      ...cat,
      items: links.filter(l => l.category_id === cat.id)
    }));

    return { nav, config };
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
    return await this.db.prepare(
      `INSERT INTO categories (title, sort_order, is_private, created_at, updated_at) 
       VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories), ?, ?, ?)`
    ).bind(title, is_private, this._now(), this._now()).run();
  }

  async updateCategory({ id, title, is_private }) {
    if (title === undefined && is_private === undefined) {
      return { success: true, meta: { changes: 0 } };
    }
    let sql = "UPDATE categories SET updated_at = ?";
    const args = [this._now()];
    if (title !== undefined) { sql += ", title = ?"; args.push(title); }
    if (is_private !== undefined) { sql += ", is_private = ?"; args.push(is_private); }
    sql += " WHERE id = ?";
    args.push(id);
    return await this.db.prepare(sql).bind(...args).run();
  }

  async deleteCategory(id) {
    return await this.db.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  }

  async batchUpdateCategoriesOrder(items) {
    if (!items?.length) return { success: true, meta: { changes: 0 } };
    const stmts = items.map(item => 
      this.db.prepare("UPDATE categories SET sort_order = ? WHERE id = ?").bind(item.sort_order, item.id)
    );
    return await this.db.batch(stmts);
  }

  // ===========================================
  // 链接管理 (Link CRUD)
  // ===========================================

  async addLink({ category_id, title, url, icon = "", description = "" }) {
    return await this.db.prepare(
      `INSERT INTO links (category_id, title, url, description, icon, sort_order, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM links WHERE category_id = ?), ?, ?)`
    ).bind(category_id, title, url, description, icon, category_id, this._now(), this._now()).run();
  }

  async updateLink({ id, category_id, title, url, description, icon }) {
    if (category_id === undefined && title === undefined && url === undefined && 
        description === undefined && icon === undefined) {
        return { success: true, meta: { changes: 0 } };
    }
    let sql = "UPDATE links SET updated_at = ?";
    const args = [this._now()];
    if (category_id !== undefined) { sql += ", category_id = ?"; args.push(category_id); }
    if (title !== undefined) { sql += ", title = ?"; args.push(title); }
    if (url !== undefined) { sql += ", url = ?"; args.push(url); }
    if (description !== undefined) { sql += ", description = ?"; args.push(description); }
    if (icon !== undefined) { sql += ", icon = ?"; args.push(icon); }
    sql += " WHERE id = ?";
    args.push(id);
    return await this.db.prepare(sql).bind(...args).run();
  }

  async deleteLink(id) {
    return await this.db.prepare("DELETE FROM links WHERE id = ?").bind(id).run();
  }

  async batchUpdateLinksOrder(items) {
    if (!items?.length) return { success: true, meta: { changes: 0 } };
    const stmts = items.map(item => {
      if (item.category_id !== undefined) {
        return this.db.prepare("UPDATE links SET sort_order = ?, category_id = ? WHERE id = ?")
          .bind(item.sort_order, item.category_id, item.id);
      } else {
        return this.db.prepare("UPDATE links SET sort_order = ? WHERE id = ?")
          .bind(item.sort_order, item.id);
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
  
  /**
   * 🚀 优化版批量导入
   * 策略：
   * 1. 预读所有现有分类 Map (避免 N+1 查询)
   * 2. 批量插入缺失的分类
   * 3. 刷新分类 Map
   * 4. 批量插入所有链接
   * 
   * @param {Array} data - [{category: "Dev", items: [...]}]
   */
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
      if (catTitle && !catMap.has(catTitle) && !newCatNames.has(catTitle)) {
        newCatStmts.push(
          this.db.prepare("INSERT INTO categories (title, created_at, updated_at) VALUES (?, ?, ?)")
          .bind(catTitle, now, now)
        );
        newCatNames.add(catTitle);
      }
    }

    if (newCatStmts.length > 0) {
      // 执行批量插入新分类
      await this.db.batch(newCatStmts);
      
      // 3. 重新获取完整 Map (为了拿到新插入分类的 ID)
      // 虽然多了一次读操作，但保证了 ID 的绝对正确性，且比 N 次 Select 快得多
      existingCats = await this.db.prepare("SELECT id, title FROM categories").all();
      (existingCats.results || []).forEach(c => catMap.set(c.title, c.id));
    }

    // 4. 构建所有链接的插入语句
    const linkStmts = [];
    for (const group of data) {
      const catTitle = group.category || group.title;
      const catId = catMap.get(catTitle);

      if (catId && Array.isArray(group.items)) {
        for (const item of group.items) {
           linkStmts.push(this.db.prepare(
             `INSERT INTO links (category_id, title, url, description, icon, created_at, updated_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?)`
           ).bind(catId, item.name||item.title, item.url, item.description||'', item.icon||'', now, now));
        }
      }
    }

    // 5. 分片执行链接插入 (D1 Batch 限制通常为 100 条)
    if (linkStmts.length > 0) {
      const CHUNK_SIZE = 50; 
      for (let i = 0; i < linkStmts.length; i += CHUNK_SIZE) {
        await this.db.batch(linkStmts.slice(i, i + CHUNK_SIZE));
      }
    }
    
    return { success: true, count: linkStmts.length, categories_added: newCatStmts.length };
  }
}
