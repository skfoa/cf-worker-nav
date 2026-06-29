-- migrations/0003_logs.sql
CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    ip TEXT NOT NULL,
    region TEXT,
    level TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT
);

-- 创建基于时间的索引，方便做日志清理和查询
CREATE INDEX IF NOT EXISTS idx_logs_created ON operation_logs(created_at);
