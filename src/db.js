export class DAO {
  constructor(db) {
    this.db = db;
  }

  // 获取所有数据（嵌套结构，用于首页渲染）
  async getAllData() {
    // D1 目前不支持复杂的 JSON_GROUP_ARRAY 完美聚合，这里用两次查询在 JS 组装，性能依然极快
    const cats = await this.db.prepare("SELECT * FROM categories ORDER BY sort_order ASC, id ASC").all();
    const links = await this.db.prepare("SELECT * FROM links ORDER BY sort_order ASC, id ASC").all();
    
    // 组装数据
    const result = cats.results.map(cat => ({
      ...cat,
      items: links.results.filter(l => l.category_id === cat.id)
    }));
    return result;
  }

  async addCategory(title) {
    return await this.db.prepare("INSERT INTO categories (title) VALUES (?)").bind(title).run();
  }

  async deleteCategory(id) {
    // 级联删除由数据库外键保证，但在 D1 中显式执行更安全
    return await this.db.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  }

  async addLink(catId, title, url) {
    return await this.db.prepare(
      "INSERT INTO links (category_id, title, url) VALUES (?, ?, ?)"
    ).bind(catId, title, url).run();
  }

  async deleteLink(id) {
    return await this.db.prepare("DELETE FROM links WHERE id = ?").bind(id).run();
  }
}
