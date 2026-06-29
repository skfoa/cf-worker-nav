-- Migration: 0002_subcategories.sql
-- 添加子分类支持：parent_id 字段

-- ALTER TABLE categories ADD COLUMN parent_id INTEGER DEFAULT NULL REFERENCES categories(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_cat_parent ON categories(parent_id);
