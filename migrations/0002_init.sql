-- Migration number: 0001 	 2025-01-01T00:00:00Z

-- ==========================================
-- 1. Categories (分类表)
-- ==========================================
DROP TABLE IF EXISTS categories;
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL CHECK(length(title) > 0),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_private INTEGER NOT NULL DEFAULT 0, -- 0:公开, 1:私有
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- ==========================================
-- 2. Links (链接表)
-- ==========================================
DROP TABLE IF EXISTS links;
CREATE TABLE links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    title TEXT NOT NULL CHECK(length(title) > 0),
    url TEXT NOT NULL CHECK(length(url) > 0),
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    updated_at INTEGER DEFAULT (unixepoch() * 1000),
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- ==========================================
-- 3. Configs (通用配置表)
-- ==========================================
DROP TABLE IF EXISTS configs;
CREATE TABLE configs (
    key TEXT PRIMARY KEY CHECK(length(key) > 0),
    value TEXT,
    description TEXT,
    updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- ==========================================
-- 4. Tokens (API 令牌表 - 仅存储 Hash)
-- ==========================================
DROP TABLE IF EXISTS tokens;
CREATE TABLE tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE, -- 核心安全设计：只存 SHA-256 哈希
    created_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- ==========================================
-- 5. Indexes (性能优化)
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_links_cat ON links(category_id);
CREATE INDEX IF NOT EXISTS idx_links_sort ON links(sort_order);
CREATE INDEX IF NOT EXISTS idx_cat_sort ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON tokens(token_hash); 

-- ==========================================
-- 6. Seed Data (初始数据)
-- ==========================================
-- 插入默认分类
INSERT INTO categories (title, sort_order) VALUES ('常用推荐', 0);

-- 插入默认链接
INSERT INTO links (category_id, title, url, description, sort_order) 
SELECT id, 'GitHub', 'https://github.com', 'Where the world builds software', 0 
FROM categories WHERE title='常用推荐';

INSERT INTO links (category_id, title, url, description, sort_order) 
SELECT id, 'Cloudflare', 'https://dash.cloudflare.com', 'Web Performance & Security', 1 
FROM categories WHERE title='常用推荐';

-- 插入默认配置
INSERT OR IGNORE INTO configs (key, value, description) VALUES 
('title', 'My Navigation', '网站标题'),
('bg_image', '', '背景图片 URL'),
('allow_search', 'true', '是否显示搜索框 (true/false)');
