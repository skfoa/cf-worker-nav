export class DAO {
  constructor(db) {
    this.db = db;
  }

  async getAllData() {
    // 按 sort_order 和 id 排序，保证顺序稳定
    const cats = await this.db.prepare("SELECT * FROM categories ORDER BY sort_order ASC, id ASC").all();
    const links = await this.db.prepare("SELECT * FROM links ORDER BY sort_order ASC, id ASC").all();
    
    return cats.results.map(cat => ({
      ...cat,
      items: links.results.filter(l => l.category_id === cat.id)
    }));
  }

  // --- Category ---
  async addCategory(title) {
    return await this.db.prepare("INSERT INTO categories (title) VALUES (?)").bind(title).run();
  }

  async updateCategory(id, title) {
    return await this.db.prepare("UPDATE categories SET title = ? WHERE id = ?").bind(title, id).run();
  }

  async deleteCategory(id) {
    return await this.db.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  }

  // --- Link ---
  async addLink(catId, title, url) {
    return await this.db.prepare("INSERT INTO links (category_id, title, url) VALUES (?, ?, ?)").bind(catId, title, url).run();
  }

  async updateLink(id, title, url, catId) {
    // 支持修改内容，同时也支持移动分类 (catId)
    return await this.db.prepare("UPDATE links SET title = ?, url = ?, category_id = ? WHERE id = ?").bind(title, url, catId, id).run();
  }

  async deleteLink(id) {
    return await this.db.prepare("DELETE FROM links WHERE id = ?").bind(id).run();
  }
}
