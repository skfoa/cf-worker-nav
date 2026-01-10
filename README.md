# ☁️ Cloudflare Worker Nav

一个极简、美观、安全的个人导航页，基于 Cloudflare Workers + D1 数据库构建。
<img width="1811" height="921" alt="image" src="https://github.com/user-attachments/assets/6f5992ad-f319-4d9b-9a55-93d0b781e620" />



## ✨ 功能特性

- ⚡ **零成本部署** - Cloudflare Workers 免费额度足够个人使用
- 💾 **D1 数据库** - 无需额外配置数据库服务器
- 🔒 **安全加固** - XSS 防护、速率限制、时序安全密码验证
- 🔥 **热门推荐** - 自动统计点击量，智能推荐常用链接
- 🎨 **精美 UI** - 毛玻璃效果、响应式设计、拖拽排序
- 🌙 **主题切换** - 支持亮色/暗色主题，跟随系统偏好
- 🔑 **API Token 管理** - 可视化生成和管理 API 访问令牌
- 🔐 **私有模式** - 开启后首页需登录才能查看内容
- 📱 **PWA 支持** - 可添加到手机主屏幕
- 🚀 **图片 CDN 加速** - 使用 wsrv.nl 全球加速用户图标
- ⚡ **边缘缓存** - 配置接口启用 Cloudflare Cache API
- 📱 **移动端触摸拖拽** - 长按 400ms 触发拖拽，支持震动反馈

---

## 🚀 部署教程（Fork 一键部署）

> 整个过程约 **10 分钟**，无需本地安装任何开发环境

### 📋 你需要准备

- 一个 [GitHub](https://github.com) 账号
- 一个 [Cloudflare](https://dash.cloudflare.com) 账号（免费注册）

---

### 第一步：Fork 本仓库

点击右上角 **Fork** 按钮，将项目复制到你的 GitHub 账号下。



---

### 第二步：创建 Cloudflare API Token

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击右上角头像 → **My Profile**
3. 左侧菜单选择 **API Tokens**
4. 点击 **Create Token**
5. 选择 **Edit Cloudflare Workers** 模板
6. 点击 **Continue to summary** → **Create Token**
7. ⚠️ **复制并保存 Token**（只显示一次！）



---

### 第三步：获取 Account ID

1. 进入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击左侧菜单 **Workers & Pages**
3. 右侧会显示 **Account ID**，点击复制



---

### 第四步：创建 D1 数据库

1. 在 Cloudflare Dashboard 左侧菜单，展开 **Workers & Pages**
2. 点击 **D1 SQL Database**
3. 点击 **Create database**
4. 数据库名称填写：`nav-db`
5. 点击 **Create**
6. 创建完成后，复制页面上显示的 **Database ID**



---

### 第五步：配置 GitHub Secrets

回到你 Fork 的 GitHub 仓库：

1. 点击 **Settings** → 左侧 **Secrets and variables** → **Actions**
2. 点击 **New repository secret**，依次添加以下 4 个 Secret：

| Name | Value | 说明 |
|------|-------|------|
| `CLOUDFLARE_API_TOKEN` | 第二步获取的 Token | Cloudflare API 令牌 |
| `CLOUDFLARE_ACCOUNT_ID` | 第三步获取的 ID | Cloudflare 账户 ID |
| `CLOUDFLARE_D1_ID` | 第四步获取的 Database ID | D1 数据库 ID |
| `PASSWORD` | 自己设置一个密码 | 管理员登录密码 |

可选 Secret（推荐添加）：

| Name | Value | 说明 |
|------|-------|------|
| `TOKEN_SALT` | 随机字符串（如 `abc123xyz`） | Token 加密盐值，增强安全性 |



---

### 第六步：触发部署

1. 进入你 Fork 的仓库，点击 **Actions** 标签页
2. 如果提示需要启用 Actions，点击 **I understand my workflows, go ahead and enable them**
3. 点击左侧 **Deploy Worker & D1**
4. 点击 **Run workflow** → **Run workflow**

等待约 1-2 分钟，部署完成后会显示绿色 ✓



---

### 第七步：访问你的导航页

部署成功后，访问：

```
https://cf-worker-nav.<你的子域名>.workers.dev
```

> 💡 你的子域名可以在 Cloudflare Dashboard → Workers & Pages → Overview 页面查看

---

## 🔧 自定义域名（可选）

1. 在 Cloudflare Dashboard 进入 **Workers & Pages**
2. 点击你的 Worker（`cf-worker-nav`）
3. 点击 **Settings** → **Triggers** → **Custom Domains**
4. 添加你的域名（需要先将域名 DNS 托管到 Cloudflare）

---

## 📖 使用说明

### 登录管理后台

1. 访问你的导航页
2. 点击底部 Dock 栏的 **🔐 登录** 按钮（或按 **Ctrl + /** 快捷键）
3. 输入你设置的 `PASSWORD` 密码
4. 登录成功后即可管理分类和链接

### 功能操作

| 功能 | 操作方式 |
|------|----------|
| **添加分类** | 点击底部 Dock 的 📁 按钮 |
| **添加链接** | 点击底部 Dock 的 ➕ 按钮 |
| **编辑模式** | 点击底部 Dock 的 ✏️ 按钮，可拖拽排序、删除 |
| **全局设置** | 点击底部 Dock 的 ⚙️ 按钮 |
| **切换主题** | 点击底部 Dock 的 🌙/☀️ 按钮 |

### 全局设置功能

- **网站标题**：自定义导航页标题
- **背景图片**：设置背景图片 URL
- **私有模式**：开启后访问首页需要先登录
- **数据备份**：导出/导入 JSON 格式的分类和链接数据
- **API Token 管理**：生成和管理 API 访问令牌

### 🔥 常用推荐

系统会自动统计链接点击量，点击量高的链接会显示在「🔥 常用推荐」虚拟分类中（最多显示 8 个）。这个分类是动态生成的，不能编辑或删除。

---

## ❓ 常见问题

### Q: 部署失败显示 "D1_ID_PLACEHOLDER"

**A:** 你没有正确配置 `CLOUDFLARE_D1_ID` Secret。请检查：
- Secret 名称必须是 `CLOUDFLARE_D1_ID`（全大写）
- 值是 D1 数据库的 ID（不是数据库名称）

### Q: 访问显示 "Database D1 is not bound"

**A:** D1 数据库绑定失败。请确认：
1. 数据库名称是 `nav-db`
2. `CLOUDFLARE_D1_ID` 配置正确
3. 重新运行一次 GitHub Actions

### Q: 登录提示 "Unauthorized"

**A:** 密码错误。请检查：
- 确认在 GitHub Secrets 中配置了 `PASSWORD`
- 密码区分大小写
- 重新部署后密码才会生效

### Q: 如何重置数据库？

**A:** 在 Cloudflare Dashboard 删除 D1 数据库，重新创建同名数据库，然后运行 GitHub Actions。

---

## 📁 项目结构

```
cf-worker-nav/
├── src/
│   ├── index.js       # Worker 主入口
│   ├── db.js          # 数据库操作层
│   └── ui.js          # 前端页面渲染
├── migrations/
│   └── 0001_init.sql  # 数据库初始化
├── .github/workflows/
│   └── deploy.yml     # 自动部署配置
├── wrangler.toml      # Cloudflare 配置
└── .env.example       # 环境变量示例
```

---

## 🔒 安全说明

- 🔐 **时序安全密码验证** - 使用 Web Crypto API 防止计时攻击
- 🚫 **暴力破解防护** - 5 次密码错误后锁定 15 分钟，记录自动过期清理（24小时）
- 🛡️ **XSS 防护** - 所有用户输入经过转义过滤
- 🔗 **协议白名单** - 链接仅允许 http/https 协议
- 🤖 **SEO 防护** - robots.txt + X-Robots-Tag + meta 标签三重禁止爬虫索引
- 🔑 **Token 哈希存储** - API Token 使用 SHA-256 加盐哈希，数据库不存储明文
- 📋 **CSP 安全头** - 配置 Content-Security-Policy 防止代码注入
- 🚷 **Clickjacking 防护** - X-Frame-Options: DENY 禁止 iframe 嵌入
- 🛡️ **防刷量保护** - /api/visit 接口校验 Referer/Origin 来源
- 🧹 **数据库自动清理** - login_attempts 表定期清理过期记录

---

## 📄 License

MIT

---

Made with ❤️ by Cloudflare Workers
