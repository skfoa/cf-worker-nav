-- Migration number: 0002 	 2025-01-01T00:00:00Z

-- 给 links 表增加 is_private 字段，默认为 0 (公开)
ALTER TABLE links ADD COLUMN is_private INTEGER DEFAULT 0;
