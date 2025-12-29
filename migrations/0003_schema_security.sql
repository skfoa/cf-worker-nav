-- Migration number: 0003   2025-12-29
-- Security Audit Remediation
-- Fixes: Trigger recursion, XSS URL whitelist, Boolean constraints, CASCADE→RESTRICT

-- ==========================================
-- Step 1: Drop old triggers (will be recreated at the end)
-- ==========================================
DROP TRIGGER IF EXISTS idx_categories_updated_at;
DROP TRIGGER IF EXISTS idx_links_updated_at;
DROP TRIGGER IF EXISTS idx_configs_updated_at;

-- ==========================================
-- Step 2: Rebuild categories table with constraints
-- ==========================================
CREATE TABLE categories_new (
    id INTEGER PRIMARY KEY,  -- Removed AUTOINCREMENT for performance
    title TEXT NOT NULL CHECK(length(title) > 0),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_private INTEGER NOT NULL DEFAULT 0 CHECK(is_private IN (0, 1)),
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- Explicit column mapping to prevent data misalignment
INSERT INTO categories_new (id, title, sort_order, is_private, created_at, updated_at)
SELECT id, title, sort_order, COALESCE(is_private, 0), created_at, updated_at
FROM categories;

DROP TABLE categories;
ALTER TABLE categories_new RENAME TO categories;

-- Recreate category indexes
CREATE INDEX IF NOT EXISTS idx_cat_sort ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_cat_private ON categories(is_private);

-- ==========================================
-- Step 3: Rebuild links table with constraints
-- ==========================================
CREATE TABLE links_new (
    id INTEGER PRIMARY KEY,  -- Removed AUTOINCREMENT for performance
    category_id INTEGER NOT NULL,
    title TEXT NOT NULL CHECK(length(title) > 0),
    -- XSS Defense: Only allow http/https URLs
    url TEXT NOT NULL CHECK(length(url) > 0 AND (url LIKE 'http://%' OR url LIKE 'https://%')),
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_private INTEGER NOT NULL DEFAULT 0 CHECK(is_private IN (0, 1)),
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    updated_at INTEGER DEFAULT (unixepoch() * 1000),
    -- Changed from CASCADE to RESTRICT to prevent accidental data loss
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

-- Explicit column mapping to prevent data misalignment
INSERT INTO links_new (id, category_id, title, url, description, icon, sort_order, is_private, created_at, updated_at)
SELECT id, category_id, title, url, COALESCE(description, ''), COALESCE(icon, ''), sort_order, COALESCE(is_private, 0), created_at, updated_at
FROM links;

DROP TABLE links;
ALTER TABLE links_new RENAME TO links;

-- Recreate link indexes
CREATE INDEX IF NOT EXISTS idx_links_cat ON links(category_id);
CREATE INDEX IF NOT EXISTS idx_links_sort ON links(sort_order);
CREATE INDEX IF NOT EXISTS idx_links_private ON links(is_private);

-- ==========================================
-- Step 4: Create triggers AFTER table rebuild (Critical!)
-- ==========================================
-- WHEN clause prevents infinite recursion by only firing
-- when updated_at wasn't already changed by the application

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
