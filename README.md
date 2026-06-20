# ☁️ Cloudflare Worker Nav

一个极简、美观、安全的个人导航站，基于 **Hono + TypeScript + Tailwind CSS v4 + DaisyUI v5** 构建，运行在 Cloudflare Workers 边缘网络上。

## ✨ 功能特性

- ⚡ **零成本部署** — Cloudflare Workers 免费额度足够个人使用
- 💾 **D1 数据库** — SQLite 边缘数据库，强一致性，无需额外服务
- 🔒 **安全加固** — CSP 安全头、CSRF 防护、速率限制、时序安全密码验证
- 🔥 **热门推荐** — 自动统计点击量，智能推荐常用链接（最多 16 个）
- 🎨 **精美 UI** — 毛玻璃效果、DaisyUI 组件库、响应式设计
- 🌙 **主题切换** — 亮色 / 暗色主题一键切换，持久化保存
- 🔑 **API Token** — SHA-256 加盐哈希存储，支持多用户分权
- 🔐 **私有模式** — 开启后首页变为登录页，需认证才能查看
- 📱 **PWA 支持** — 可添加到手机主屏幕，离线可用
- 🖱️ **拖拽排序** — SortableJS 拖拽排序，实时持久化到 D1
- ⚡ **边缘缓存** — 配置接口 5 分钟缓存，图标代理 7 天缓存
- 📦 **数据导入导出** — JSON 格式备份，支持批量导入

---

## 🛠️ 技术栈

| 层 | 技术 | 版本 |
|---|------|------|
| 运行时 | Cloudflare Workers | — |
| 后端框架 | Hono | v4 |
| 语言 | TypeScript | v5 |
| 数据库 | Cloudflare D1 (SQLite) | — |
| 输入校验 | Zod | v3 |
| CSS 框架 | Tailwind CSS | v4 |
| UI 组件 | DaisyUI | v5 |
| 拖拽 | SortableJS | v1.15 |
| 前端交互 | HTMX + Vanilla JS | — |

---

## 🚀 部署教程

提供三种部署方式，选择其中一种即可。

### 📋 前置条件

- 一个 [Cloudflare](https://dash.cloudflare.com) 账号（免费注册）
- 一个 [GitHub](https://github.com) 账号（方式二、三需要）

### 公共步骤：创建 D1 数据库

无论选择哪种部署方式，都需要先创建数据库：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 左侧菜单展开 **Workers & Pages** → 点击 **D1 SQL Database**
3. 点击 **Create database**，名称填写 `nav-db`
4. 创建完成后，复制页面上显示的 **Database ID**（后面要用）

---

### 方式一：Cloudflare 上传部署（Wrangler CLI）

> 本地构建后通过命令行直接上传到 Cloudflare，最灵活

**前提**：本地已安装 [Node.js](https://nodejs.org) v18+

#### 1. 克隆仓库并安装依赖

```bash
git clone https://github.com/<你的用户名>/cf-worker-nav.git
cd cf-worker-nav
npm install
```

#### 2. 登录 Cloudflare

```bash
npx wrangler login
```

浏览器会弹出授权页面，点击 **Allow** 完成登录。

#### 3. 修改 `wrangler.toml`

将 `database_id` 替换为你在公共步骤中获取的 Database ID：

```toml
[[d1_databases]]
binding = "DB"
database_name = "nav-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← 替换为你的 ID
```

#### 4. 初始化远程数据库

```bash
npx wrangler d1 execute nav-db --remote --file=migrations/0001_init.sql
```

#### 5. 构建并部署

```bash
npm run deploy
```

#### 6. 配置环境变量

部署成功后，在 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → 点击 `cf-worker-nav` → **Settings** → **Variables and Secrets**，添加：

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `PASSWORD` | Secret | 管理员登录密码（**必填**） |
| `TOKEN_SALT` | Secret | Token 加密盐值（推荐，填一个随机字符串） |

> ⚠️ 添加环境变量后 Worker 会自动重启生效，无需重新部署。

后续更新代码只需再次运行 `npm run deploy`。

---

### 方式二：Cloudflare 绑定部署（Dashboard 连接 Git）

> 在 Cloudflare Dashboard 中绑定 GitHub 仓库，每次 push 自动构建部署

#### 1. Fork 本仓库到你的 GitHub

#### 2. 修改 `wrangler.toml`

在 GitHub 网页端编辑 `wrangler.toml`，将 `D1_ID_PLACEHOLDER` 替换为你的 Database ID。

#### 3. 在 Cloudflare Dashboard 创建 Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → 左侧 **Workers & Pages**
2. 点击 **Create** → 选择 **Worker** 标签
3. 选择 **Import a repository** / **Connect to Git**
4. 授权 GitHub 并选择你 Fork 的仓库

#### 4. 配置构建设置

在构建配置页面填写：

| 配置项 | 值 |
|--------|-----|
| Build command | `npm run build:css` |
| Deploy command | `npx wrangler deploy` |

#### 5. 初始化数据库

在 Dashboard 左侧 **D1** → 点击 `nav-db` → **Console** 标签，将 `migrations/0001_init.sql` 的全部内容粘贴到输入框中执行。

#### 6. 添加环境变量

在 Worker 的 **Settings** → **Variables and Secrets** 中添加：

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `PASSWORD` | Secret | 管理员登录密码（**必填**） |
| `TOKEN_SALT` | Secret | Token 加密盐值（推荐） |

完成后每次 push 到 GitHub 的 `main` 分支会自动触发部署。

---

### 方式三：GitHub Actions 自动部署

> Fork 后全程在网页端操作，无需本地环境

#### 1. Fork 本仓库

点击 GitHub 页面右上角 **Fork** 按钮。

#### 2. 创建 Cloudflare API Token

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 右上角头像 → **My Profile** → **API Tokens**
3. 点击 **Create Token** → 选择 **Edit Cloudflare Workers** 模板
4. 点击 **Continue to summary** → **Create Token**
5. ⚠️ **复制并保存 Token**（只显示一次！）

#### 3. 获取 Account ID

进入 Cloudflare Dashboard → 左侧 **Workers & Pages** → 右侧面板复制 **Account ID**

#### 4. 配置 GitHub Secrets

在 Fork 的仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，逐个添加：

| Name | Value | 说明 |
|------|-------|------|
| `CLOUDFLARE_API_TOKEN` | 第 2 步的 Token | Cloudflare API 令牌 |
| `CLOUDFLARE_ACCOUNT_ID` | 第 3 步的 ID | Cloudflare 账户 ID |
| `CLOUDFLARE_D1_ID` | 公共步骤的 Database ID | D1 数据库 ID |
| `PASSWORD` | 你设置的管理员密码 | 登录密码 |
| `TOKEN_SALT` | 随机字符串（可选） | Token 加密盐值 |

#### 5. 触发首次部署

1. 进入仓库 → **Actions** 标签页
2. 如提示启用 Actions，点击 **I understand my workflows, go ahead and enable them**
3. 左侧选择 **Deploy Worker** → 点击 **Run workflow** → **Run workflow**
4. 等待 1-2 分钟，显示绿色 ✓ 即部署成功

> 💡 首次手动触发（`workflow_dispatch`）会自动执行数据库初始化。后续 push 到 `main` 分支也会自动部署。

---

### 访问你的导航站

部署成功后访问：

```
https://cf-worker-nav.<你的子域名>.workers.dev
```

> 💡 子域名可在 Cloudflare Dashboard → Workers & Pages → Overview 页面查看

### 🌐 自定义域名（可选）

1. 进入 Cloudflare Dashboard → **Workers & Pages** → 点击你的 Worker
2. **Settings** → **Domains & Routes** → **Custom Domains**
3. 添加你的域名（需先将域名的 DNS 托管到 Cloudflare）

---

## 🔧 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 创建本地环境变量
cp .env.example .dev.vars

# 3. 初始化本地 D1 数据库
npx wrangler d1 execute nav-db --local --file=migrations/0001_init.sql

# 4. 构建 CSS + 启动开发服务器
npm run dev
```

编辑 `.dev.vars` 配置本地环境变量（该文件不会被提交到 Git）：

```env
PASSWORD=admin
TOKEN_SALT=my_local_dev_salt
TITLE=我的导航
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 构建 CSS + 启动本地开发服务器 |
| `npm run build:css` | 仅构建 Tailwind CSS |
| `npm run deploy` | 构建 CSS + 部署到 Cloudflare |
| `npm run typecheck` | TypeScript 类型检查 |

---

## 📖 使用说明

### 登录管理

1. 访问你的导航站
2. 如开启了私有模式，首页会显示登录页，输入 `PASSWORD` 即可登录
3. 如未开启私有模式，页面直接显示导航内容。登录方式：在浏览器地址栏输入 `你的域名/?auth=1`，然后在登录页输入密码
4. 登录成功后底部会出现管理 Dock 栏

### 功能操作

| 功能 | 操作 |
|------|------|
| ➕ 添加链接 | 底部 Dock → 点击「添加」按钮 |
| 📁 添加分类 | 底部 Dock → 点击「分类」按钮 |
| 🔀 拖拽排序 | 底部 Dock → 点击「排序」开启，拖拽卡片调整位置 |
| ⚙️ 设置 | 底部 Dock → 点击「设置」（导入/导出数据、退出登录） |
| 🌙 切换主题 | 底部 Dock → 点击「主题」切换亮色/暗色 |
| ✏️ 编辑链接 | 鼠标悬停卡片 → 点击编辑按钮 |
| 🗑️ 删除链接 | 鼠标悬停卡片 → 点击删除按钮 |
| 🔍 搜索 | 顶部搜索框，输入关键词实时过滤 |

### 🔥 常用推荐

系统自动统计每个链接的点击量，高频链接会显示在第一个「🔥 常用推荐」虚拟分类中（最多 16 个）。该分类无法编辑或删除，完全由系统自动生成。

---

## 📁 项目结构

```
cf-worker-nav/
├── src/
│   ├── index.tsx              # Hono 入口 + 全局中间件
│   ├── types.ts               # TypeScript 类型 + Zod Schema
│   ├── db/
│   │   └── dao.ts             # D1 数据库访问层 (DAO)
│   ├── middleware/
│   │   └── auth.ts            # 3 级鉴权 (Root/User/Public) + 速率限制
│   ├── utils/
│   │   ├── security.ts        # 时序安全比对 + SHA-256 哈希
│   │   └── helpers.ts         # 图标 URL、HTML 转义等工具函数
│   ├── routes/
│   │   ├── pages.tsx          # SSR 页面路由 (首页/robots.txt/manifest)
│   │   └── api.ts             # RESTful API (19 个端点)
│   └── components/            # Hono JSX 组件
│       ├── Layout.tsx          # HTML 骨架 (CDN 引入 HTMX/SortableJS)
│       ├── Navbar.tsx          # 分类导航标签栏
│       ├── SearchBox.tsx       # 搜索框
│       ├── LinkCard.tsx        # 链接卡片
│       ├── LinkGrid.tsx        # 卡片网格布局
│       ├── Dock.tsx            # 底部管理操作栏
│       ├── Modal.tsx           # 弹窗组件
│       └── LoginForm.tsx       # 登录页面
├── public/
│   ├── client.js              # 客户端交互逻辑
│   └── output.css             # Tailwind 编译产物 (构建生成)
├── styles/
│   └── app.css                # Tailwind v4 + DaisyUI v5 入口
├── migrations/
│   └── 0001_init.sql          # D1 数据库 Schema + 种子数据
├── .github/workflows/
│   └── deploy.yml             # GitHub Actions 自动部署
├── .env.example               # 环境变量示例 (复制为 .dev.vars 使用)
├── wrangler.toml              # Cloudflare Worker 配置
├── tsconfig.json              # TypeScript 配置
└── package.json               # 依赖 + 构建脚本
```

---

## 🔌 API 端点

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查，返回分类/链接数量 |
| GET | `/api/config` | 公共配置（标题、背景、私有模式），5 分钟边缘缓存 |
| GET | `/api/icon?domain=xxx` | 图标代理（Google Favicon），7 天边缘缓存 |
| POST | `/api/visit` | 点击上报（校验 Referer 来源） |

### 需要登录（Authorization: Bearer token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/verify` | 验证身份，返回角色 (root/user) |
| GET | `/api/data` | 获取全量数据（含私有分类和链接） |
| POST | `/api/link` | 添加链接 |
| POST | `/api/link/update` | 更新链接 |
| POST | `/api/link/delete` | 删除链接 |
| POST | `/api/link/reorder` | 批量排序链接 |
| POST | `/api/category` | 添加分类 |
| POST | `/api/category/update` | 更新分类 |
| POST | `/api/category/delete` | 删除分类（需先清空链接） |
| POST | `/api/category/reorder` | 批量排序分类 |

### 需要 Root 权限

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/config` | 更新站点配置 |
| POST | `/api/import` | 批量导入数据 |
| GET | `/api/export` | 导出全部数据 |
| GET | `/api/token/list` | 列出所有 API Token |
| POST | `/api/token/create` | 创建新 Token |
| POST | `/api/token/delete` | 删除 Token |

---

## 🔒 安全特性

| 防护 | 实现 |
|------|------|
| CSP 安全头 | Hono `secureHeaders()` — 完整 Content-Security-Policy |
| CSRF 防护 | Hono `csrf()` — 校验 Origin / Sec-Fetch-Site |
| 时序安全密码验证 | Web Crypto `timingSafeEqual` 防计时攻击 |
| 暴力破解防护 | 5 次错误锁定 15 分钟，过期记录自动清理 |
| XSS 防护 | Hono JSX 自动转义 + `safeJsonStringify` |
| 协议白名单 | D1 CHECK 约束 + Zod 校验，仅允许 http/https |
| SEO 防爬 | robots.txt + X-Robots-Tag + meta noindex 三重防护 |
| Token 安全 | SHA-256 加盐哈希存储，数据库不保存明文 |
| Clickjacking | X-Frame-Options: DENY 禁止 iframe 嵌入 |
| 请求体限制 | Hono `bodyLimit()` — API 请求体上限 50KB |
| 防刷量 | `/api/visit` 校验 Referer / Origin 来源 |

---

## ❓ 常见问题

**Q: 部署失败显示 "D1_ID_PLACEHOLDER"**
> 检查是否正确配置了 D1 Database ID。方式一需修改 `wrangler.toml`；方式三需配置 `CLOUDFLARE_D1_ID` Secret（值是数据库 ID，不是数据库名称）。

**Q: 访问显示 "Database D1 is not bound"**
> D1 绑定失败。确认数据库名称是 `nav-db`，`wrangler.toml` 中的 `database_id` 正确，然后重新部署。

**Q: 访问显示 "no such table: configs"**
> 数据库尚未初始化。方式一运行 `npx wrangler d1 execute nav-db --remote --file=migrations/0001_init.sql`；方式二在 D1 Console 中手动执行 SQL；方式三手动触发一次 Actions（会自动执行 migration）。

**Q: 登录提示 "Unauthorized"**
> 密码错误。确认在 Cloudflare Dashboard 的 Worker Settings 中配置了 `PASSWORD` 环境变量（区分大小写）。修改后 Worker 自动重启生效。

**Q: 连续输错密码被锁定了？**
> 5 次错误后锁定 15 分钟。等待 15 分钟后自动解锁，或在 D1 Console 执行 `DELETE FROM login_attempts;` 手动解锁。

**Q: 如何重置数据库？**
> 在 Cloudflare Dashboard 删除 D1 数据库，重新创建同名 `nav-db`，执行 migration SQL，然后重新部署。

**Q: 本地开发图标不显示？**
> 图标通过 Google Favicon API 代理获取，部分网络环境可能无法访问。部署到 Cloudflare 后正常显示。

**Q: 如何从旧版本升级？**
> 旧版使用 `index.js` + `db.js` + `ui.js` 单体架构。升级时保留 D1 数据库数据不变，替换代码后重新部署即可，数据库 Schema 完全兼容。

---

## 📄 License

MIT
