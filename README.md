# ☁️ Cloudflare Worker Nav

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=Cloudflare&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?style=for-the-badge&logo=hono&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)

一个运行在 Cloudflare Workers + D1 上的个人书签导航站，基于 `Hono`、`TypeScript` 与 `Tailwind CSS v4` + `DaisyUI v5` 构建。支持公开访问、私有书签隔离、边缘缓存与基础管理后台。

<div align="center">
  <img width="1853" height="915" alt="image" src="https://github.com/user-attachments/assets/3aae9fbc-b383-4fbf-8717-91513233e81a" />
</div>

---

## ✨ 功能特性

### ⚙️ 架构与缓存设计
- **Cloudflare Workers + D1**：无独立服务器运维成本；Workers Free 计划提供每天 `100,000` 次免费请求额度，D1 免费额度为每天 `5,000,000` 行读取与 `100,000` 行写入，个人与小团队日常使用足够覆盖。
- **访客首页与 Manifest 边缘缓存**：未登录访客访问 `/`（TTL 5 分钟，`s-maxage=300`）与 `/manifest.json`（TTL 1 小时）优先命中 `caches.default`；命中缓存时不重复查询 D1。
- **静态资源版本化与长缓存**：构建时为 `public/output.css` 和 `public/client.min.js` 生成短哈希指纹并自动注入 `?v=<hash>`，通过 [public/_headers](public/_headers) 下发 `Cache-Control: public, max-age=31536000, immutable`；配合 [wrangler.toml.example](wrangler.toml.example) 中的 `assets = { directory = "public" }`（`Assets-First` 路由）与静态 `public/favicon.ico`，静态资源请求不触发 Worker 调用，发版后新哈希 URL 即时生效。
- **写操作自动清理缓存**：新增、编辑、删除、排序、批量操作或导入配置后，自动清除 `/`、`/api/config` 与 `/manifest.json` 的边缘缓存。
- **图标懒加载与兜底**：首屏仅加载当前可见分类的图标，未激活分类通过 `data-src` 在切换时再请求；全局捕获阶段图片错误监听搭配首屏初始化检查，加载失败时回退为首字母 SVG，移除每张卡片重复的内联 `onerror` 属性。
- **图标代理服务（`GET /api/icon`）**：按「DuckDuckGo → 网页 `<head>` 与 Manifest 解析 → 常见路径探测（`/favicon.ico`、`/favicon.svg`、`/favicon.png`、`/apple-touch-icon.png`）→ 首字母 SVG」顺序降级获取（5 秒超时、512KB 上限），并跳过 DAO/鉴权中间件以降低 CPU 消耗；Worker 内使用 `caches.default` 缓存（成功抓取浏览器缓存 7 天，兜底 SVG 缓存 24 小时）。
- **添加到主屏幕（Manifest）**：提供 `/manifest.json` 支持添加到桌面以独立窗口打开；为避免同 URL（`/`）在登录态与访客态之间出现 HTML 缓存撕裂，项目有意不启用离线 Service Worker，需联网使用。

### 🛡️ 安全与访问控制
- **隐藏后台入口**：普通首页 `/` 不展示登录按钮，访问 `/admin`（或带 `?admin` 参数）时底部 Dock 栏才会显示「登录」入口；未鉴权请求私有或管理接口统一返回 `404 Not Found` 伪装。
- **基础防护**：配置 CSP 安全头、`hono/csrf` 同源校验、`/api/*` 请求体上限 `50KB`、基于 `Web Crypto` 的 `timingSafeEqual` 密钥比对（`safeCompare`），以及基于 D1 的登录失败限流（连续失败 5 次锁定该 IP 15 分钟）。
- **元数据抓取 SSRF 防护（`POST /api/link/meta`）**：仅 Root 管理员可用；限制 `http/https` 协议，拦截 URL 凭据、私网/回环/保留 IP 字面量与同域自请求，手动检查 3xx 重定向跳转目标（最多 3 跳），5 秒超时并流式截断前 64KB（兼容 UTF-8 与 GBK/GB18030/Big5 等常见中文编码）；由于 Workers 在 `fetch()` 前无法自行做 DNS 解析，域名若通过 DNS 解析到内网地址依赖 Workers 平台自身的出站限制。

### 🎨 交互与书签管理
- **界面与主题**：Tailwind CSS v4 + DaisyUI v5 玻璃拟态卡片，支持暗色/亮色主题切换，支持自定义背景图 URL（经 `http/https` 安全校验后支持实时预览与保存）。
- **两级分类结构**：支持顶级分类与子分类，桌面端悬浮、移动端点击展开子分类菜单，支持右键分类 Tab 编辑或删除。
- **管理操作与批量整理**：
  - 管理员登录后可动态加载 `SortableJS` 开启拖拽排序；
  - 支持开启「多选」模式，通过底部悬浮操作栏一次性批量移动分类、切换公开/私有状态或删除；
  - 鼠标悬停卡片点击编辑/删除按钮，或移动端长按卡片 500ms 唤出操作菜单。
- **元数据自动识别与缓存控制**：添加或编辑链接时可点击「🔍 自动识别」填充空白标题、描述与图标 URL；编辑弹窗支持一键清除对应域名或自定义图标 URL 的边缘缓存（`POST /api/icon/purge`），以及清零单条链接的点击次数。
- **常用推荐与点击去重**：客户端记录 30 分钟同链接点击冷却防刷；管理员登录后自动置顶展示「🔥 常用推荐」虚拟分类（按点击量取前 24 条公开链接）。
- **站内搜索与快捷键**：支持站内加权搜索（标题 > 描述 > URL，200ms 防抖）及外链搜索引擎切换；支持 `Ctrl/Cmd + K` 聚焦搜索、`Esc` 关闭弹窗或清空搜索、站内搜索按 `Enter` 打开首条结果。
- **备份导出与 HTML 书签导入**：支持导出完整 JSON 备份；导入同时兼容 JSON 备份文件与 Chrome / Edge / Firefox 导出的 HTML 书签文件（自动忽略非 `http/https` 链接及大体积内联 `data:` 图标，两级以上目录自动扁平化并完成同名消歧，按字节与条数自动分片上传以匹配 `50KB` 接口上限）。
- **只读 API Token 与审计日志**：设置弹窗可直接创建、一次性复制、查看与吊销只读 API Token；日志弹窗记录管理员访问、登录成功/失败、IP 锁定与伪造会话等事件，支持分页（5 条/15 条）与清空。

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| **运行时** | Cloudflare Workers | 免费版每日 `100,000` 次请求、单次 `10ms` CPU 时间、`128 MB` 内存 |
| **Web 框架** | Hono v4 | 路由、JSX 服务端渲染（SSR）、安全头与 CSRF 中间件 |
| **数据库** | Cloudflare D1 | 边缘 SQLite 数据库（免费版每日 `500 万` 行读、`10 万` 行写，单库上限 `500 MB`） |
| **开发语言** | TypeScript v5 | 服务端与客户端（`src/client/`）独立 tsconfig 类型校验 |
| **前端构建 & 样式** | esbuild + Tailwind CSS v4 + DaisyUI v5 | 客户端 TS 模块打包为 `public/client.min.js`，按需生成 `public/output.css` |
| **输入校验** | Zod v3 | 配合 `@hono/zod-validator` 进行请求参数校验 |
| **测试框架** | Vitest + Miniflare | 在本地 `workerd` + D1 模拟环境中执行单元测试与端到端集成测试 |

---

## 🚀 部署指南

### 前置步骤：创建 D1 数据库
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)。
2. 进入 **Workers & Pages** → **D1 SQL Database**，创建名为 `nav-db` 的数据库。
3. 复制生成的 **Database ID**（UUID 格式）备用。

---

### 方式一：GitHub Actions 自动化部署（推荐）

#### 1. Fork 本仓库
点击右上角 **Fork** 将仓库复制到你的 GitHub 账号下。

#### 2. 获取 Cloudflare 凭证
- **API Token**：前往 [API Tokens](https://dash.cloudflare.com/profile/api-tokens) 使用 `Edit Cloudflare Workers` 模板生成并保存。
- **Account ID**：在 Cloudflare Dashboard → **Workers & Pages** 页面右侧复制。

#### 3. 配置 GitHub Actions Secrets
进入仓库 **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，依次添加以下 **6 个密钥**：

| 密钥名称 | 说明 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `CLOUDFLARE_D1_ID` | 前置步骤创建的 D1 Database ID |
| `PASSWORD` | 管理员登录密码 |
| `COOKIE_SECRET` | Cookie Session 签名密钥（建议为随机长字符串） |
| `TOKEN_SALT` | API Token 哈希盐值（建议为随机长字符串） |

#### 4. 触发部署
- **首次部署**：进入仓库 **Actions** 标签页 → 选择 **Deploy Worker** → 点击 **Run workflow**（`init_db` 保持默认 `auto` 即可在检测到全新空库时自动执行 `migrations/0001_init.sql` 初始化建表）。
- **后续更新**：推送代码到 `main` 分支即会自动执行 CSS/JS 构建、类型检查（`npm run typecheck`）、自动化测试（`npm test`）并部署到 Cloudflare Workers。

---

### 方式二：本地 Wrangler CLI 部署

需要本地已安装 Node.js（建议 v20/v22+）：

```bash
# 1. 克隆并安装依赖
git clone https://github.com/<你的用户名>/cf-worker-nav.git
cd cf-worker-nav
npm install

# 2. 登录 Cloudflare 账号
npx wrangler login

# 3. 创建本地 wrangler.toml 并填入真实 D1 Database ID
cp wrangler.toml.example wrangler.toml

# 4. 初始化远程数据库表结构（仅全新空库执行，切勿对已有数据的库重复执行！）
npx wrangler d1 execute nav-db --remote --file=migrations/0001_init.sql

# 5. 构建并部署
npm run deploy
```

> **提示**：首次部署后请前往 Cloudflare Dashboard → Workers & Pages → `cf-worker-nav` → **Settings** → **Variables and Secrets** 添加 `PASSWORD`、`COOKIE_SECRET` 与 `TOKEN_SALT`。

### Cloudflare 域名缓存建议
- 在域名的 **缓存（Caching）→ 配置（Configuration）** 中，建议将 **浏览器缓存 TTL（Browser Cache TTL）** 设为 **`遵循现有标头（Respect Existing Headers）`**。
- 这样浏览器会严格遵循代码与 `public/_headers` 下发的缓存时长（CSS/JS 1 年、图标 7 天、访客首页 HTML `max-age=0`：由边缘 `caches.default` 命中并返回、不查 D1，后台修改后清缓存即可实时刷新）。
- **无需**在控制台额外创建 Cache Rules 或 Page Rules：静态资产由 Workers Static Assets（`Assets-First`）直接托管，而动态路由由 Worker 内部的 `caches.default` 管理。

---

## 📖 使用指南

### 登录与基础管理
1. 正常访问域名 `/` 仅展示公开书签；在域名后加上 `/admin`（例如 `https://nav.yourdomain.com/admin`）后，底部悬浮 Dock 栏会出现 **「登录」** 按钮。
2. 点击登录并输入 `PASSWORD`，验证通过后 Dock 栏会展开全部管理功能：

| 功能入口 | 用途 |
|---|---|
| **添加 / 分类** | 新增书签（支持「🔍 自动识别」抓取标题、描述与图标）或新增一/二级分类 |
| **排序** | 开启拖拽排序模式，拖动卡片即时保存顺序 |
| **多选** | 进入批量整理模式，跨卡片选中后批量移动分类、设私有/公开或删除 |
| **设置** | 修改站点标题、预览并保存背景图片、导入 JSON / 浏览器 HTML 书签、导出 JSON 备份、创建/吊销只读 API Token |
| **日志** | 分页查看安全与登录审计日志或清空日志 |

---

## ❓ 常见问题 (FAQ)

**Q: 部署后提示 `"Database D1 is not bound"` 怎么办？**
> 请核对 GitHub Secret 中的 `CLOUDFLARE_D1_ID`（或本地 `wrangler.toml` 中的 `database_id`）是否填入了正确的 UUID 格式 Database ID（而非数据库名称 `nav-db`）。

**Q: 连续输错密码被锁定怎么办？**
> 连续失败 5 次会锁定对应 IP 15 分钟。可等待自动解锁，或在 Cloudflare D1 控制台执行 `DELETE FROM login_attempts;` 手动清除锁定记录。

**Q: 只读 API Token 怎么创建和使用？能否开放写入权限？**
> 登录后在底部 Dock 打开 **「设置」→「只读 API 令牌」**，输入备注名点击「+ 生成」并立即复制明文 Token（仅在创建时显示一次）。外部客户端请求时携带请求头 `Authorization: Bearer <token>` 可读取包含私有书签在内的 `GET /api/data`，默认仅只读权限。如需将其改为读写权限，可自行修改 [src/middleware/auth.ts](src/middleware/auth.ts#L71) 的权限判定后重新部署。

**Q: 某个网站的图标抓取错了或想刷新怎么处理？**
> 编辑该链接时点击 **「🔄 刷新图标缓存」**，系统会同时清理对应域名与自定义图标 URL 的 Worker 边缘缓存；或者在「图标 URL」栏直接填入指定图片地址。

**Q: 为什么同分类下不能添加相同 URL 的链接？**
> 系统按 `(category_id, url)` 做了同分类去重限制以防误操作重复添加；同一网址仍可分别归档到不同分类中。

---

## 👨‍💻 本地开发与测试

```bash
# 1. 复制本地环境变量与 Wrangler 配置
cp .env.example .dev.vars
cp wrangler.toml.example wrangler.toml
# 编辑 wrangler.toml 填入你的 D1 Database ID

# 2. 初始化本地模拟数据库
npx wrangler d1 execute nav-db --local --file=migrations/0001_init.sql

# 3. 启动本地开发服务器（含 CSS 与客户端 JS 构建）
npm run dev

# 4. 类型检查与自动化测试（Vitest + Miniflare）
npm run typecheck
npm test
```

## 📄 License
[MIT License](./LICENSE)
