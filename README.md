# ☁️ Cloudflare Worker Nav

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=Cloudflare&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?style=for-the-badge&logo=hono&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)

这是一个**极简、极速、极度安全**的个人导航站。基于 `Hono` 边缘计算框架与 `Tailwind CSS v4` 构建，完全运行在 Cloudflare 的 Serverless 边缘网络上。

它不仅拥有现代化的毛玻璃 UI 设计，更在底层融入了**“零信任” (Zero-Trust) 安全理念**，是为您量身打造的下一代纯净无界导航引擎。

<div align="center">
  <img width="1853" height="915" alt="image" src="https://github.com/user-attachments/assets/3aae9fbc-b383-4fbf-8717-91513233e81a" />
</div>

---

## ✨ 核心特性 (Features)

### 🚀 极致的性能与架构
- ⚡ **Serverless 边缘部署** — 依托 Cloudflare 全球数百个节点，访问请求就近渲染，毫秒级响应。告别传统服务器，**永久免费，零维护成本**。
- 💾 **D1 原生边缘数据库** — 彻底抛弃臃肿的 MySQL/Redis，采用 Cloudflare 原生 SQLite 边缘数据库，支持强一致性事务，数据永不丢失。
- 📦 **自动化深度优化** — 构建时自动剔除无用 CSS 样式，并对 JS 进行混淆压缩，配合全球 CDN 缓存，打造极致首屏加载体验。
- 📱 **全平台 PWA 支持** — 支持添加到手机或电脑的主屏幕，沉浸式全屏体验，离线可用。

### 🛡️ Zero-Trust 幽灵防御体系
- 👻 **隐身模式 (Ghost Admin)** — 彻底摒弃传统的 `/login` 暴露入口。采用全站隐藏的 `/admin` 幽灵路由，只有您自己知道控制台的唤醒密码。
- 🚫 **404 伪装拦截** — 面对未经授权的 API 请求或恶意嗅探，系统不再返回 `401/403` 报错，而是直接强制返回 `404 Not Found` 伪装，让漏洞扫描器误以为这是一个静态空站，杜绝算力消耗。
- 🔐 **法医级安全加固** — 内置 CSP 安全头、CSRF 跨站防御、请求体体积限制、基于 `Web Crypto` 的时序安全密码比对，以及防暴力破解 IP 锁定机制。
- 🕵️ **隐私级图标代理** — 独创的 `DuckDuckGo API` 站点图标边缘代理机制，彻底切断第三方追踪器对您私有书签域名的隐私窥探。

### 🎨 现代美学与卓越交互
- 💠 **自适应毛玻璃 UI** — 采用最新的 DaisyUI v5 组件库，融合动态高斯模糊与暗黑模式 (Dark Mode)，一键切换，视觉体验极具未来感。
- 📁 **多级嵌套分类** — 原生支持父子两级嵌套分类（Subcategories），通过平滑的悬浮下拉菜单呈现海量书签。
- 🖱️ **无缝拖拽排序** — 深度集成 SortableJS，鼠标拖拽卡片即可实时完成重排，位置信息瞬间持久化至边缘云端。
- 🔥 **智能高频推荐** — 自动统计每一次书签点击，智能萃取并置顶“常用推荐”集合（最高展示 16 个），越用越懂你。

---

## 🛠️ 技术栈 (Tech Stack)

| 架构层级 | 使用技术 | 版本 | 为什么选择它？(核心优势) |
|---|---|---|---|
| **边缘计算** | Cloudflare Workers | — | 全球边缘节点覆盖，零冷启动延迟，每月 10 万次免费读写额度。 |
| **边缘框架** | Hono | v4 | 专为边缘计算打造的 Web 框架，极速路由映射，体积小到极致。 |
| **开发语言** | TypeScript | v5 | 提供严苛的静态类型推断，在编译期扼杀 90% 的低级错误。 |
| **边缘数据** | Cloudflare D1 | — | Serverless 架构下的原生 SQLite，无缝接入 Worker 且极度稳定。 |
| **样式引擎** | Tailwind CSS | v4 | 原子化 CSS 鼻祖，配合 JIT 引擎实现真正的零冗余代码打包。 |
| **组件设计** | DaisyUI | v5 | 极其优雅的语义化 UI 组件库，极大地简化了 Tailwind 类名堆砌。 |
| **前端交互** | Vanilla JS (原生) | — | 彻底抛弃 React/Vue 沉重的客户端运行时，实现毫秒级页面注水。 |
| **输入校验** | Zod | v3 | 完美契合 TypeScript 的前后端同构校验方案，拦截一切脏数据。 |

---

## 🚀 部署指南 (Deployment)

我们为您提供了两种主流部署方式，请根据您的开发习惯任选其一。

### 📋 必须的前置步骤：创建 D1 数据库
> 无论您选择哪种部署方式，都必须先在 Cloudflare 创建好数据库承载空间。

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 左侧菜单展开 **Workers & Pages** → 点击 **D1 SQL Database**
3. 点击 **Create database**，名称填写 `nav-db`
4. 创建完成后，复制页面上显示的 **Database ID**（由横线连接的长字符串，后面要用）。

---

### 🌟 方式一：自动化流水线部署 (GitHub Actions) - 强烈推荐
> **全程在浏览器端操作，无需配置任何本地开发环境，后续更新完全自动化！**

#### 1. Fork 本仓库
点击页面右上角 **Fork** 按钮，将本仓库复制到您的账号下。

#### 2. 获取 Cloudflare 凭证
- **API Token**：[点击这里生成 Token](https://dash.cloudflare.com/profile/api-tokens) → 选择 `Edit Cloudflare Workers` 模板 → 生成并**妥善保存**。
- **Account ID**：在 Cloudflare Dashboard → Workers & Pages 面板右侧复制。

#### 3. 配置 GitHub 密钥
在您 Fork 后的仓库页面 → **Settings** → **Secrets and variables** → **Actions** → 点击 **New repository secret**，依次添加以下五个变量：

| 密钥名称 (Name) | 密钥内容 (Value) |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 刚刚生成的 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | 您的 Cloudflare 账户 ID |
| `CLOUDFLARE_D1_ID` | **前置步骤**中创建的 D1 Database ID |
| `PASSWORD` | 您想设置的后台最高权限登录密码 |
| `TOKEN_SALT` | 随意填写一段复杂的英文字符串，用于数据加密 |

#### 4. 一键触发部署
进入仓库的 **Actions** 标签页 → 允许运行工作流 → 点击左侧 **Deploy Worker** → 右侧点击 **Run workflow**。
*(等待 1-2 分钟，出现绿色对勾即代表全世界都能访问您的专属导航站了！)*

---

### 💻 方式二：本地硬核部署 (Wrangler CLI)
> **适合前端开发者，可以在本地修改代码后直接一键推送到云端。**

**前置要求**：已安装 Node.js v18+ 并且具备基本的终端操作能力。

```bash
# 1. 克隆并进入目录
git clone https://github.com/<你的用户名>/cf-worker-nav.git
cd cf-worker-nav
npm install

# 2. 登录您的 Cloudflare 账号
npx wrangler login

# 3. 创建本地配置文件
# 复制模板并填写您真实的 D1 Database ID
cp wrangler.toml.example wrangler.toml
# 打开 wrangler.toml，将 YOUR_D1_DATABASE_ID_HERE 替换为您真实获取到的 ID。

# 4. 初始化远程云端数据库表结构
npx wrangler d1 execute nav-db --remote --file=migrations/0001_init.sql

# 5. 构建代码并部署到云端
npm run deploy
```

> **注意**：部署完成后，请前往 Cloudflare 控制台 -> Workers -> `cf-worker-nav` -> Settings -> Variables，手动添加 `PASSWORD` 环境变量作为您的登录密码。

---

## 📖 使用指南

### 👻 如何召唤幽灵后台？
由于系统取消了常规的登录入口，访客只能看到您公开的干净书签。
1. 在浏览器地址栏，于您的域名后加上 `/admin` (例如：`https://nav.yourdomain.com/admin`)
2. 此时页面右下角将“幽灵浮现”一个隐藏的 🔑 图标。
3. 点击它，输入您的 `PASSWORD`。验证成功后，全功能的管理 Dock 栏将从底部弹出，私密书签也将瞬间解密展现。

### 🕹️ 核心操作
| 需求 | 操作方式 |
|---|---|
| **新增书签/分类** | 唤出 Dock 栏后，点击对应的「➕ 添加」或「📁 分类」按钮。 |
| **拖拽排序** | 在 Dock 栏点击「🔀 排序」解锁卡片，拖动调整位置后点击保存。 |
| **导入旧数据** | 在 Dock 栏点击「⚙️ 设置」，选择您的旧版 JSON 备份文件一键导入。 |

---

## ❓ 极客问答 (FAQ)

**Q: 部署后访问显示 "Database D1 is not bound" 是怎么回事？**
> 这是因为云端没有找到对应的数据库。请检查 `wrangler.toml` (方式二) 或 GitHub Secrets 中的 `CLOUDFLARE_D1_ID` (方式一) 是否填写了正确的**数据库 ID**（注意：是 UUID 格式的 ID，不是数据库名字）。

**Q: 连续输错密码被锁定了怎么办？**
> 系统为了防止被暴力破解，连续输错 5 次会封禁您的 IP 15 分钟。您只能等待 15 分钟，或者进入 Cloudflare D1 控制台，执行 `DELETE FROM login_attempts;` 手动解封。

**Q: API Token 怎么生成？为什么前端没有管理按钮？**
> 本项目已完整内置了极其安全的 API Token 后台逻辑（生成、哈希加盐存储、校验），但遵循极简原则，**目前未提供前端 UI**。
> - **如何生成**：您可以使用开发者工具或 cURL，在登录状态下（携带 Cookie）向 `POST /api/token/create` 发送 `{"name": "my-token"}` 即可获取。
> - **纯只读设计**：目前的 Token 仅拥有**只读权限**（系统仅赋予 `isUser = true`），只能用来读取私有书签，无法进行增删改操作。
> - **如何开启读写权限（供插件使用）**：如果您想开发自动化工具（如一键收藏浏览器扩展），只需打开 `src/middleware/auth.ts`，将 Token 校验成功后的逻辑改为 `isRoot = true; isUser = true;`，重新部署后您的 Token 即拥有完整读写权限。

**Q: 本地开发时图标显示为空白？**
> 为了保护隐私，图标现在通过 DuckDuckGo API 进行边缘代理。国内部分网络环境直接请求可能会超时，但部署到 Cloudflare 边缘节点后会自动穿透屏蔽，均可正常显示。

---

## 👨‍💻 二次开发

```bash
# 拷贝环境配置并填写本地密码
cp .env.example .dev.vars

# 初始化本地测试数据库
npx wrangler d1 execute nav-db --local --file=migrations/0001_init.sql

# 启动包含 CSS 实时编译的本地服务器
npm run dev
```

## 📄 License
[MIT License](./LICENSE)
