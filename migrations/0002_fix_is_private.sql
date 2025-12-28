-- Migration number: 0002     2025-12-28
-- 修复 is_private 字段异常值问题

-- 将所有非 0 和非 1 的 is_private 值修正为 0 (公开)
UPDATE categories SET is_private = 0 WHERE is_private IS NULL OR (is_private != 0 AND is_private != 1);
UPDATE links SET is_private = 0 WHERE is_private IS NULL OR (is_private != 0 AND is_private != 1);
