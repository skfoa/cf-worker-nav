# Cloudflare Worker Navigation (D1 Edition)

极简、开源、基于 D1 数据库的个人导航页。

## 特性
- ⚡ **无服务器**: 完全运行在 Cloudflare Workers 上
- 💾 **D1 数据库**: 使用 SQLite 存储，支持分类管理
- 🔒 **安全**: 环境变量管理密钥，代码无硬编码
- 🚀 **自动化**: GitHub Actions 自动处理数据库迁移和部署

## 快速开始

### 1. 准备工作
- Fork 本仓库
- 在 Cloudflare Dashboard 创建一个 D1 数据库，命名为 `nav-db`
- 复制该数据库的 ID

### 2. 配置项目
修改 `wrangler.toml`，填入你的 D1 数据库 ID：
```toml
[[d1_databases]]
binding = "DB"
database_name = "nav-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" <--- 填这里
