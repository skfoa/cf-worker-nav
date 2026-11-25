# ☁️ Cloudflare Worker Nav

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=Cloudflare&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?style=for-the-badge&logo=hono&logoColor=white)

一个部署在 Cloudflare Workers + D1 上的个人书签导航站，使用 `Hono`、`TypeScript`、`Tailwind CSS v4` 和 `DaisyUI v5` 开发。适合自用或小范围分享，支持公开/私有书签区分、缓存优化和网页端管理后台。

<div align="center">
  <img width="1853" height="915" alt="image" src="https://github.com/user-attachments/assets/3aae9fbc-b383-4fbf-8717-91513233e81a" />
</div>

---

## ✨ 主要功能

### 书签与页面管理
- **两级分类**：支持顶级分类和子分类；桌面端鼠标悬停、手机端点击可展开子分类，登录后台后右键分类标签可编辑或删除。
- **拖拽排序与批量整理**：登录后可开启拖拽排序（动态加载 `SortableJS`），也可开启「多选」模式批量移动分类、切换公开/私有、设为本地首字母图标或批量删除。
- **添加/编辑链接自动识别**：支持点击「🔍 自动识别」抓取目标网页的标题、描述和图标地址，只填充空白字段；抓取失败时仅提示，不影响手动保存。
- **图标获取与零请求模式**：
  - 默认通过 `/api/icon` 代理获取网站图标（依次尝试 DuckDuckGo、解析网页 `<head>` 与 manifest、常见路径 `/favicon.ico` 等，失败时生成首字母 SVG 兜底），编辑链接时可一键清除单条图标缓存；
  - 对明确没有图标的自建站点，可在添加/编辑时勾选「使用本地首字母图标」（或在图标栏填 `letter`），也可以在多选栏一键批量切换，渲染时直接输出内联首字母 SVG，**不再请求 `/api/icon`**；
  - IP 地址、`localhost` 等非公网域名在未填自定义图标时也会自动使用本地首字母图标。
- **常用推荐**：记录书签点击次数（同一设备 30 分钟内重复点击同一链接只记一次），登录后在顶部展示「🔥 常用推荐」分类（取访问量前 24 条公开书签），编辑链接时可单独清零计数。
- **搜索与快捷键**：支持站内搜索（按标题 > 描述 > 网址排序）和外链搜索引擎切换；支持 `Ctrl/Cmd + K` 聚焦搜索框、`Esc` 关闭弹窗或清空输入、站内搜索按 `Enter` 打开第一条结果。
- **设置、导入导出与令牌**：
  - 可在「设置」弹窗修改站点标题、预览并保存背景图片（仅允许 `http/https` 网址）；
  - 支持导出 JSON 备份，支持导入 JSON 备份及 Chrome / Edge / Firefox 导出的 HTML 书签文件（自动跳过非 `http/https` 链接与内联图标，超过两级的目录自动合并到二级并避免重名覆盖，书签较多时自动分批上传以适应 50KB 请求大小限制）；
  - 可直接在设置页面创建、复制（仅显示一次）和吊销只读 API Token；
  - 「日志」弹窗记录登录成功/失败、进入后台、IP 锁定与无效会话等记录，支持分页查看和一键清空。
- **主题与桌面添加**：支持暗色/亮色主题切换；提供 `/manifest.json` 和本地静态图标（`favicon.svg`、`favicon.ico`、`icon-192.png`），支持添加到主屏幕，但不做离线缓存（避免登录前后页面缓存错乱），需要联网使用。

### 缓存与请求数控制
- **静态文件不耗 Worker 配额**：`public/` 下的 `output.css`、`client.min.js` 及站点图标由 Cloudflare Workers Static Assets 直接返回，不计入 Worker 调用次数；CSS/JS 构建时自动附加内容哈希 `?v=...` 并通过 [public/_headers](public/_headers) 设置 1 年缓存，发版后自动换新链接生效。
- **页面与图标缓存**：未登录访客的 `/` 首页（5 分钟）、`/manifest.json`（1 小时）以及 `/api/icon` 图标均使用 Cloudflare `caches.default` 缓存（真实图标浏览器缓存 7 天，兜底 SVG 缓存 24 小时），命中缓存时不重复查数据库或外部站点；后台修改分类、书签、站点配置或导入数据后会自动清除公开页面缓存。
- **按分类懒加载**：首屏只加载当前可见分类的图标，其他分类切换到对应标签页时再加载。

### 安全机制
- **隐藏后台登录**：访问 `/` 不显示登录按钮，访问 `/admin`（或带 `?admin` 参数）时底部 Dock 栏才会出现「登录」按钮；未登录请求后台或私有接口统一返回 `404`。
- **登录与请求限制**：开启 CSP、CSRF 同源校验、`/api/*` 请求体 `50KB` 上限、常量时间密码比对以及 D1 登录失败限流（连续输错 5 次锁定该 IP 15 分钟）。
- **图标代理防盗链与链接校验**：
  - `GET /api/icon` 检查同源 `Sec-Fetch-Site` / `Referer` / `Origin`，拦截外站盗链和无来源直刷（返回 `403`），并提前拒绝非公网地址、保留域名和本站自身（返回 `400`）；
  - `POST /api/link/meta` 仅管理员可用，只抓取公网 `http/https` 网页（拦截内网 IP、带账号密码的链接和本站自身，最多跟随 3 次跳转，5 秒超时、只读前 64KB，兼容 UTF-8 及 GBK 等中文编码）；域名经 DNS 解析到内网地址的情况由 Cloudflare 平台自身出站限制兜底。

---

## 🛠️ 技术栈

| 部分 | 使用技术 | 说明 |
|---|---|---|
| **运行平台** | Cloudflare Workers | 免费计划每日 `100,000` 次请求，单次 `10ms` CPU、`128 MB` 内存 |
| **后端框架** | Hono v4 | 路由、JSX 服务端渲染、安全头与 CSRF 中间件 |
| **数据库** | Cloudflare D1 | SQLite 数据库（免费计划每日 `500 万` 行读、`10 万` 行写，单库上限 `500 MB`） |
| **语言与校验** | TypeScript v5 + Zod v3 | 服务端与客户端分别做类型检查，接口参数使用 Zod 校验 |
| **前端与样式** | esbuild + Tailwind CSS v4 + DaisyUI v5 | `src/client/` 打包为 `public/client.min.js`，样式编译为 `public/output.css` |
| **测试** | Vitest + Miniflare | 本地 `workerd` + D1 单元测试与接口集成测试 |

---

## 🚀 部署指南

### 前置步骤：创建 D1 数据库
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)。
2. 进入 **Workers & Pages** → **D1 SQL Database**，创建名为 `nav-db` 的数据库。
3. 复制页面上的 **Database ID**（UUID 格式）备用。

---

### 方式一：GitHub Actions 自动部署（推荐）

1. **Fork 本仓库**到你的 GitHub 账号下。
2. **准备 Cloudflare 凭证**：
   - **API Token**：在 [API Tokens](https://dash.cloudflare.com/profile/api-tokens) 使用 `Edit Cloudflare Workers` 模板创建。
   - **Account ID**：在 Cloudflare Dashboard → **Workers & Pages** 页面右侧复制。
3. **配置 GitHub Secrets**：进入仓库 **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，添加以下 **6 个密钥**：

| 密钥名称 | 说明 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `CLOUDFLARE_D1_ID` | 前置步骤创建的 D1 Database ID |
| `PASSWORD` | 管理员登录密码 |
| `COOKIE_SECRET` | Cookie 签名密钥（建议用随机长字符串） |
| `TOKEN_SALT` | API Token 哈希盐值（建议用随机长字符串） |

4. **触发部署**：
   - **首次部署**：在仓库 **Actions** → **Deploy Worker** → 点击 **Run workflow**（`init_db` 保持默认 `auto`，检测到全新空库时会自动执行 `migrations/0001_init.sql` 建表，已有数据不会覆盖）。
   - **后续更新**：推送代码到 `main` 分支即自动执行构建、类型检查、测试并部署。

---

### 方式二：本地 Wrangler CLI 部署

本地需安装 Node.js（建议 v20/v22+）：

```bash
# 1. 克隆并安装依赖
git clone https://github.com/<你的用户名>/cf-worker-nav.git
cd cf-worker-nav
npm install

# 2. 登录 Cloudflare
npx wrangler login

# 3. 创建本地配置并填入真实的 D1 Database ID
cp wrangler.toml.example wrangler.toml

# 4. 初始化远程数据库（仅全新空库执行，切勿对已有数据的库重复执行！）
npx wrangler d1 execute nav-db --remote --file=migrations/0001_init.sql

# 5. 构建并部署
npm run deploy
```

> 首次本地部署后，请在 Cloudflare Dashboard → Workers & Pages → `cf-worker-nav` → **Settings** → **Variables and Secrets** 中添加 `PASSWORD`、`COOKIE_SECRET` 和 `TOKEN_SALT`。

### Cloudflare 域名缓存设置建议
- 在域名控制台的 **缓存（Caching）→ 配置（Configuration）** 中，将 **浏览器缓存 TTL（Browser Cache TTL）** 设为 **`遵循现有标头（Respect Existing Headers）`**。
- 这样浏览器会直接使用代码和 `public/_headers` 返回的缓存时长（CSS/JS 1 年、图标 7 天、访客首页 `max-age=0` 由边缘缓存命中并在后台改动后及时刷新）。
- 无需额外配置 Cache Rules 或 Page Rules：静态资源已直接由 Workers Static Assets 返回，动态接口由代码里的 `caches.default` 处理。

---

## 📖 使用说明

1. 访问 `/` 只看到公开书签；访问 `/admin`（例如 `https://nav.yourdomain.com/admin`）后，底部 Dock 栏会出现 **「登录」** 按钮。
2. 输入 `PASSWORD` 登录后，底部 Dock 栏会展开全部管理按钮：

| 按钮 | 功能 |
|---|---|
| **添加 / 分类** | 新增书签（支持自动识别与勾选本地首字母图标）或新增一/二级分类 |
| **排序** | 开启拖拽排序，拖动后自动保存 |
| **多选** | 勾选多张卡片后批量移动分类、设私有/公开、设为本地首字母图标或删除 |
| **设置** | 修改站点标题、预览并保存背景图、导入 JSON / HTML 书签、导出 JSON、管理只读 API Token |
| **日志** | 分页查看登录与安全记录，或清空日志 |

---

## ❓ 常见问题

**Q: 部署后提示 `"Database D1 is not bound"`？**
> 检查 `CLOUDFLARE_D1_ID`（或本地 `wrangler.toml` 的 `database_id`）是否填成了数据库名字 `nav-db`，这里需要填 UUID 格式的 Database ID。

**Q: 输错 5 次密码被锁了怎么解封？**
> 默认锁定 15 分钟自动解除；如果想立刻解封，可以在 Cloudflare D1 控制台执行 `DELETE FROM login_attempts;`。

**Q: 只读 API Token 怎么用？能不能给它写权限？**
> 登录后在 **「设置」→「只读 API 令牌」** 生成并复制（明文只显示一次）。请求时带请求头 `Authorization: Bearer <token>` 可调用 `GET /api/data` 读取全部书签（含私有书签），默认不能修改数据。如确实需要写权限，可修改 [src/middleware/auth.ts](src/middleware/auth.ts#L71) 后重新部署。

**Q: 某个网站抓不到图标或图标显示错了怎么办？**
> 编辑该链接时可以点 **「🔄 刷新图标缓存」** 重新抓取，或者直接填一个稳定的图标 URL；如果该站点本来就没有图标，勾选 **「使用本地首字母图标」**（或用多选栏批量设置）即可，之后不会再发图标请求。

**Q: 同一个网址能加两次吗？**
> 同一个分类下不能添加重复网址，但可以把同一网址分别添加到不同分类里。

---

## 👨‍💻 本地开发与测试

```bash
# 1. 复制环境变量和 Wrangler 配置模板
cp .env.example .dev.vars
cp wrangler.toml.example wrangler.toml
# 编辑 wrangler.toml 填入你的 D1 Database ID

# 2. 初始化本地模拟数据库
npx wrangler d1 execute nav-db --local --file=migrations/0001_init.sql

# 3. 启动本地开发服务器
npm run dev

# 4. 运行类型检查和测试
npm run typecheck
npm test
```
