/**
 * src/db.js
 * D1 Database Access Object (DAO)
 * v3.0 Final - Security, Atomicity & Consistency
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
   * 使用 Web Crypto API，适用于 Cloudflare Workers 环境
   */
  async _hash(input) {
    const msgBuffer = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 核心：获取首页所需的所有数据
   * 🔒 安全特性：在 SQL 层过滤私有数据，防止脏数据进入内存
   */
  async getAllData(isLogin = false) {
    // 1. 获取系统配置
    const configRes = await this.db.prepare("SELECT key, value FROM configs").all();
    const config = (configRes.results || []).reduce((acc, cur) => {
      acc[cur.key] = cur.value;
      return acc;
    }, {});

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

    // 3. 并行查询 (减少 Round-trip)
    const [catsData, linksData] = await Promise.all([
      this.db.prepare(catSql).all(),
      this.db.prepare(linksSql).all()
    ]);

    const categories = catsData.results || [];
    const links = linksData.results || [];

    // 4. 组装数据 (Category -> Items)
    const nav = categories.map(cat => ({
      ...cat,
      items: links.filter(l => l.category_id === cat.id)
    }));

    return { nav, config };
  }

  // ===========================================
  // Token 管理 (仅存 Hash)
  // ===========================================
  
  /**
   * 验证 Token
   * @param {string} inputToken - 用户传入的明文 Token
   */
  async validateToken(inputToken) {
    if (!inputToken) return false;
    const inputHash = await this._hash(inputToken);
    // 查库比对哈希
    const res = await this.db.prepare("SELECT 1 FROM tokens WHERE token_hash = ?").bind(inputHash).first();
    return !!res;
  }

  /**
   * 创建 Token
   * @returns {Object} { id, token, name } - 注意：token 明文只返回这一次
   */
  async createToken(name) {
    // 生成随机 32 字节 Hex 字符串 (64 chars)
    const randomBuffer = new Uint8Array(32);
    crypto.getRandomValues(randomBuffer);
    const token = Array.from(randomBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // 计算哈希并存储
    const tokenHash = await this._hash(token);

    const res = await this.db.prepare(
      "INSERT INTO tokens (name, token_hash, created_at) VALUES (?, ?, ?)"
    ).bind(name, tokenHash, this._now()).run();

    // 返回明文给前端展示（仅此一次），数据库存 Hash
    return { id: res.meta.last_row_id, name, token };
  }

  async deleteToken(id) {
    return await this.db.prepare("DELETE FROM tokens WHERE id = ?").bind(id).run();
  }

  // ===========================================
  // 分类管理 (Categories)
  // ===========================================

  async addCategory({ title, is_private = 0 }) {
    // ⚛️ 原子性：使用 SQL 子查询解决 sort_order 竞态条件
    return await this.db.prepare(
      `INSERT INTO categories (title, sort_order, is_private, created_at, updated_at) 
       VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories), ?, ?, ?)`
    ).bind(title, is_private, this._now(), this._now()).run();
  }

  async updateCategory({ id, title, is_private }) {
    // 🛠️ 修复：返回一致的空操作对象，避免 TypeError
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
    // 级联删除由外键保证
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
  // 链接管理 (Links)
  // ===========================================

  async addLink({ category_id, title, url, icon = "", description = "" }) {
    // ⚛️ 原子性：同分类下 Max(sort_order) + 1
    return await this.db.prepare(
      `INSERT INTO links (category_id, title, url, description, icon, sort_order, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM links WHERE category_id = ?), ?, ?)`
    ).bind(category_id, title, url, description, icon, category_id, this._now(), this._now()).run();
  }

  async updateLink({ id, category_id, title, url, description, icon }) {
    // 🛠️ 修复：返回一致的空操作对象
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
        // 跨分类拖拽
        return this.db.prepare("UPDATE links SET sort_order = ?, category_id = ? WHERE id = ?")
          .bind(item.sort_order, item.category_id, item.id);
      } else {
        // 同分类排序
        return this.db.prepare("UPDATE links SET sort_order = ? WHERE id = ?")
          .bind(item.sort_order, item.id);
      }
    });
    return await this.db.batch(stmts);
  }

  // ===========================================
  // 配置更新 (Configs)
  // ===========================================
  async updateConfig(key, value) {
    return await this.db.prepare(
      `INSERT INTO configs (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
    ).bind(key, value, this._now()).run();
  }
}
