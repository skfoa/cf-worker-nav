# ☁️ Cloudflare Worker Nav

一个极简、美观、安全的个人导航页，基于 Cloudflare Workers + D1 数据库构建。

<!-- TODO: 在此处添加项目截图 -->
<!-- ![首页截图](./screenshots/home.png) -->

## ✨ 特性

- ⚡ **Serverless** - 完全运行在 Cloudflare Workers，全球边缘节点加速
- 💾 **D1 数据库** - 基于 SQLite，支持分类管理、链接排序
- 🔒 **安全加固** - XSS 防护、CSP 策略、速率限制、时序安全密码验证
- � **常用推荐** - 自动统计点击量，智能推荐热门链接
- 🎨 **精美 UI** - 毛玻璃效果、暗色主题、响应式设计
- 🔐 **私有模式** - 可选启用登录保护，隐藏所有链接
- 📱 **PWA 支持** - 可添加到手机主屏幕
- 🚀 **一键部署** - GitHub Actions 自动化 CI/CD

## 📸 预览

<!-- TODO: 添加更多截图 -->
<!-- 
![管理后台](./screenshots/admin.png)
![移动端](./screenshots/mobile.png) 
-->

## 🚀 快速开始

### 前置要求

- [Cloudflare 账号](https://dash.cloudflare.com/)
- [Node.js](https://nodejs.org/) 18+
- Git

### 1️⃣ 克隆项目

```bash
git clone https://github.com/YOUR_USERNAME/cf-worker-nav.git
cd cf-worker-nav
npm install
```

### 2️⃣ 创建 D1 数据库

```bash
# 登录 Cloudflare
npx wrangler login

# 创建数据库
npx wrangler d1 create nav-db
```

复制输出的 `database_id`，填入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "nav-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← 替换这里
```

### 3️⃣ 初始化数据库

```bash
# 本地开发环境
npx wrangler d1 execute nav-db --local --file=./migrations/0001_init.sql

# 远程生产环境
npx wrangler d1 execute nav-db --remote --file=./migrations/0001_init.sql
```

### 4️⃣ 配置环境变量

复制 `.env.example` 为 `.env`，然后设置密码：

```bash
# Cloudflare Secrets (推荐)
npx wrangler secret put PASSWORD
# 输入你的管理密码
```

或在 `wrangler.toml` 中临时配置（仅开发用）：

```toml
[vars]
PASSWORD = "your-super-secret-password"
TITLE = "My Navigation"
```

### 5️⃣ 本地开发

```bash
npm run dev
```

访问 http://localhost:8787

### 6️⃣ 部署到 Cloudflare

```bash
npm run deploy
```

## ⚙️ 配置项

### 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `PASSWORD` | ✅ | 管理员密码（建议用 `wrangler secret` 设置） |
| `TITLE` | ❌ | 网站标题，默认 `My Nav` |
| `BG_IMAGE` | ❌ | 背景图片 URL |
| `ALLOWED_ORIGIN` | ❌ | CORS 允许的来源，默认 `*` |

### 数据库配置

通过管理后台或 API 可设置：

| 配置项 | 说明 |
|--------|------|
| `title` | 网站标题（覆盖环境变量） |
| `bg_image` | 背景图片 URL |
| `private_mode` | 私有模式 (`true`/`false`) |
| `allow_search` | 显示搜索框 (`true`/`false`) |

## 🔌 API 接口

### 公开接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 首页 |
| `/api/health` | GET | 健康检查 |
| `/api/config` | GET | 获取公共配置 |
| `/api/icon?domain=xxx` | GET | 获取网站图标（带缓存） |
| `/api/visit` | POST | 上报链接点击 |

### 需要鉴权（Header: `Authorization: Bearer <PASSWORD>`）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/data` | GET | 获取全部数据 |
| `/api/category` | POST | 添加分类 |
| `/api/category/update` | POST | 更新分类 |
| `/api/category/delete` | POST | 删除分类 |
| `/api/link` | POST | 添加链接 |
| `/api/link/update` | POST | 更新链接 |
| `/api/link/delete` | POST | 删除链接 |
| `/api/import` | POST | 导入数据（Root） |
| `/api/export` | GET | 导出数据（Root） |
| `/api/config` | POST | 更新配置（Root） |

## 🔐 安全特性

- **XSS 防护** - 所有用户输入均经过 HTML 转义
- **CSP 策略** - 严格的内容安全策略
- **时序安全** - 密码验证使用 `crypto.subtle.timingSafeEqual`
- **速率限制** - 5 次失败后锁定 15 分钟
- **HTTPS Only** - URL 仅允许 `http://` 和 `https://` 协议

## 📁 项目结构

```
cf-worker-nav/
├── src/
│   ├── index.js      # Worker 入口 & 路由
│   ├── db.js         # D1 数据库 DAO 层
│   └── ui.js         # SSR 前端渲染
├── migrations/
│   └── 0001_init.sql # 数据库初始化脚本
├── .github/
│   └── workflows/
│       └── deploy.yml # GitHub Actions 自动部署
├── wrangler.toml     # Cloudflare 配置
├── package.json
└── README.md
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT License

---

Made with ❤️ and Cloudflare Workers
