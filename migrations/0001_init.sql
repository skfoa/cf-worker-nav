-- Migration: 0001_init.sql
-- 完整数据库初始化脚本（包含所有表、索引、触发器）
-- ⚠️ 警告：包含 DROP TABLE 语句，仅用于全新安装！
-- ⚠️ 请勿在已有数据的生产数据库上运行！

-- ==========================================
-- 1. Categories (分类表)
-- ==========================================
DROP TABLE IF EXISTS categories;
CREATE TABLE categories (
    id INTEGER PRIMARY KEY,  -- 无 AUTOINCREMENT，性能更优
    title TEXT NOT NULL CHECK(length(title) > 0),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_private INTEGER NOT NULL DEFAULT 0 CHECK(is_private IN (0, 1)),
    parent_id INTEGER DEFAULT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- ==========================================
-- 2. Links (链接表)
-- ==========================================
DROP TABLE IF EXISTS links;
CREATE TABLE links (
    id INTEGER PRIMARY KEY,  -- 无 AUTOINCREMENT，性能更优
    category_id INTEGER NOT NULL,
    title TEXT NOT NULL CHECK(length(title) > 0),
    -- 🔒 XSS 防御：仅允许 http/https 协议
    url TEXT NOT NULL CHECK(length(url) > 0 AND (url LIKE 'http://%' OR url LIKE 'https://%')),
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_private INTEGER NOT NULL DEFAULT 0 CHECK(is_private IN (0, 1)),
    -- 🔥 点击计数：用于常用推荐功能
    visits INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    updated_at INTEGER DEFAULT (unixepoch() * 1000),
    -- 🔒 使用 RESTRICT 防止误删导致数据丢失
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

-- ==========================================
-- 3. Configs (通用配置表)
-- ==========================================
-- 🔒 SECURITY NOTE: This table is for PUBLIC UI configuration only.
-- Never store secrets (API keys, passwords, tokens) here.
-- Use environment variables (env.PASSWORD, etc.) for sensitive credentials.
DROP TABLE IF EXISTS configs;
CREATE TABLE configs (
    key TEXT PRIMARY KEY CHECK(length(key) > 0),
    value TEXT,
    description TEXT,
    updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- ==========================================
-- 4. Tokens (API 令牌表 - 预留功能)
-- ==========================================
DROP TABLE IF EXISTS tokens;
CREATE TABLE tokens (
    id INTEGER PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_cat_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_links_private ON links(is_private);
CREATE INDEX IF NOT EXISTS idx_cat_private ON categories(is_private);
-- 🔥 点击量索引：优化常用推荐查询性能
CREATE INDEX IF NOT EXISTS idx_links_visits ON links(visits DESC);

-- ==========================================
-- 6. Triggers (自动更新 updated_at)
-- ==========================================
-- 🔒 WHEN 条件防止无限递归：仅在应用层未更新时间时触发

CREATE TRIGGER idx_categories_updated_at 
AFTER UPDATE ON categories FOR EACH ROW
WHEN OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE categories SET updated_at = (unixepoch() * 1000) WHERE id = OLD.id;
END;

CREATE TRIGGER idx_links_updated_at 
AFTER UPDATE ON links FOR EACH ROW
WHEN OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE links SET updated_at = (unixepoch() * 1000) WHERE id = OLD.id;
END;

CREATE TRIGGER idx_configs_updated_at 
AFTER UPDATE ON configs FOR EACH ROW
WHEN OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE configs SET updated_at = (unixepoch() * 1000) WHERE key = OLD.key;
END;

-- ==========================================
-- 7. Login Attempts (速率限制表 - 防暴力破解)
-- ==========================================
DROP TABLE IF EXISTS login_attempts;
CREATE TABLE login_attempts (
    ip TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    first_attempt INTEGER NOT NULL,  -- 首次尝试时间戳
    locked_until INTEGER DEFAULT 0   -- 锁定截止时间（0=未锁定）
);

CREATE INDEX IF NOT EXISTS idx_attempts_locked ON login_attempts(locked_until);

-- ==========================================
-- 8. Operation Logs (操作日志表)
-- ==========================================
DROP TABLE IF EXISTS operation_logs;
CREATE TABLE operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    ip TEXT NOT NULL,
    region TEXT,
    level TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT
);

CREATE INDEX IF NOT EXISTS idx_logs_created ON operation_logs(created_at);

-- ==========================================
-- 8. Seed Data (初始数据)
-- ==========================================
-- 注意："常用推荐" 现在是动态生成的虚拟分类，不再创建静态分类
INSERT INTO categories (title, sort_order) VALUES ('工具站', 0);

INSERT INTO links (category_id, title, url, description, sort_order) 
SELECT id, 'GitHub', 'https://github.com', 'Where the world builds software', 0 
FROM categories WHERE title='工具站';

INSERT INTO links (category_id, title, url, description, sort_order) 
SELECT id, 'Cloudflare', 'https://dash.cloudflare.com', 'Web Performance & Security', 1 
FROM categories WHERE title='工具站';

INSERT OR IGNORE INTO configs (key, value, description) VALUES 
('title', 'My Navigation', '网站标题'),
('bg_image', '', '背景图片 URL');
