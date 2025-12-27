-- Migration number: 0001 	 2025-01-01T00:00:00Z

-- 1. 分类表
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
);

-- 2. 链接表
CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT, -- 可选：自定义图标URL
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- 3. 索引 (提升查询性能)
CREATE INDEX IF NOT EXISTS idx_links_cat ON links(category_id);

-- 4. 预置数据 (可选，防止首页为空)
INSERT INTO categories (title, sort_order) VALUES ('常用推荐', 0);
INSERT INTO links (category_id, title, url, sort_order) 
SELECT id, 'GitHub', 'https://github.com', 0 FROM categories WHERE title='常用推荐';
INSERT INTO links (category_id, title, url, sort_order) 
SELECT id, 'Cloudflare', 'https://dash.cloudflare.com', 1 FROM categories WHERE title='常用推荐';
