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

-- 【新增】触发器：分类更新时自动刷新 updated_at
CREATE TRIGGER IF NOT EXISTS idx_categories_updated_at 
AFTER UPDATE ON categories
BEGIN
    UPDATE categories SET updated_at = (unixepoch() * 1000) WHERE id = OLD.id;
END;

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
    -- 【合并】直接在这里包含 is_private，无需额外的 Migration
    is_private INTEGER DEFAULT 0, 
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    updated_at INTEGER DEFAULT (unixepoch() * 1000),
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- 【新增】触发器：链接更新时自动刷新 updated_at
CREATE TRIGGER IF NOT EXISTS idx_links_updated_at 
AFTER UPDATE ON links
BEGIN
    UPDATE links SET updated_at = (unixepoch() * 1000) WHERE id = OLD.id;
END;

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

-- 【新增】触发器：配置更新时自动刷新 updated_at
CREATE TRIGGER IF NOT EXISTS idx_configs_updated_at 
AFTER UPDATE ON configs
BEGIN
    UPDATE configs SET updated_at = (unixepoch() * 1000) WHERE key = OLD.key;
END;

-- ==========================================
-- 4. Tokens (API 令牌表 - 预留功能)
-- ==========================================
-- 注意：如果你目前只打算用单密码模式 (PASSWORD env)，这个表暂时用不上
-- 但保留它作为扩展功能是非常好的设计。
DROP TABLE IF EXISTS tokens;
CREATE TABLE tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- ==========================================
-- 5. Indexes (性能优化)
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_links_cat ON links(category_id);
CREATE INDEX IF NOT EXISTS idx_links_sort ON links(sort_order);
CREATE INDEX IF NOT EXISTS idx_cat_sort ON categories(sort_order);
-- is_private 经常作为过滤条件，建议加上索引
CREATE INDEX IF NOT EXISTS idx_links_private ON links(is_private);
CREATE INDEX IF NOT EXISTS idx_cat_private ON categories(is_private);

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
