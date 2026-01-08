import DAO from './db.js';
import { renderUI, renderLoginPage } from './ui.js';

// ==============================================
// 1. 安全工具与全局配置
// ==============================================

// 🔒 HTML 转义防止 XSS
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 🔒 时序安全的字符串比对 (使用 Web Crypto API)
async function safeCompare(a, b) {
  if (!a || !b) return false;
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);

  // 长度不等时仍需执行伪比较以防止长度泄漏
  if (aBuf.byteLength !== bBuf.byteLength) {
    // 执行一次伪比较，消耗相同时间
    await crypto.subtle.timingSafeEqual(aBuf, aBuf);
    return false;
  }

  return crypto.subtle.timingSafeEqual(aBuf, bBuf);
}

// 🔒 CORS 配置 - 可通过 env.ALLOWED_ORIGIN 限制来源
function getCorsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env?.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// 🔒 安全响应头 (CSP + 其他安全策略)
function getSecurityHeaders() {
  // Content Security Policy 配置
  // 注意：'unsafe-inline' 是因为 ui.js 大量使用内联事件 (onclick 等)
  // 未来可考虑重构为 addEventListener 以移除 unsafe-inline
  const cspDirectives = [
    "default-src 'self'",                              // 默认只允许同源
    "script-src 'self' 'unsafe-inline'",               // JS: 同源 + 内联 (内联事件需要)
    "style-src 'self' 'unsafe-inline'",                // CSS: 同源 + 内联样式
    "img-src 'self' data: https: blob:",               // 图片: 同源 + data URI + 所有 HTTPS + Blob
    "font-src 'self' https://fonts.gstatic.com",       // 字体: 同源 + Google Fonts
    "connect-src 'self'",                              // XHR/Fetch: 仅同源
    "frame-ancestors 'none'",                          // 禁止被嵌入 iframe (防点击劫持)
    "base-uri 'self'",                                 // <base> 标签限制
    "form-action 'self'"                               // 表单提交限制
  ];

  return {
    'Content-Security-Policy': cspDirectives.join('; '),
    'X-Content-Type-Options': 'nosniff',               // 禁止 MIME 类型嗅探
    'X-Frame-Options': 'DENY',                         // 禁止 iframe 嵌入
    'X-XSS-Protection': '1; mode=block',               // 旧版浏览器 XSS 过滤
    'Referrer-Policy': 'strict-origin-when-cross-origin',  // 控制 Referer 信息泄露
    'X-Robots-Tag': 'noindex, nofollow'                // 🔒 禁止搜索引擎索引
  };
}

function json(data, status = 200, env = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
  });
}

function errorResp(msg, status = 500, env = null) {
  return json({ error: msg, success: false }, status, env);
}

export default {
  async fetch(request, env, ctx) {
    // 0. 数据库绑定检查 (防止本地开发未配置导致崩溃)
    if (!env.DB) {
      return errorResp("Database D1 is not bound. Check wrangler.toml", 500);
    }

    // 🔒 安全提示：PASSWORD 未配置时输出警告（不阻塞请求）
    if (!env.PASSWORD) {
      console.warn('[Security] ⚠️ PASSWORD is not set! Root privileges will be unavailable.');
      console.warn('[Security] 🔧 Set PASSWORD in wrangler.toml: [vars] or as a secret.');
    }

    const url = new URL(request.url);
    // 移除路径末尾斜杠，统一路由匹配
    const path = url.pathname.endsWith('/') && url.pathname.length > 1
      ? url.pathname.slice(0, -1)
      : url.pathname;

    const method = request.method;
    const dao = new DAO(env.DB, env);

    // ==========================================
    // 2. CORS Preflight
    // ==========================================
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders(env) });
    }

    // ==========================================
    // 3. 鉴权逻辑
    // ==========================================
    const authHeader = request.headers.get("Authorization");
    let token = "";

    // 提取 Token（支持 Bearer 格式）
    if (authHeader) {
      token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : authHeader.trim();
    }

    // 🔒 获取客户端 IP（用于速率限制）
    const clientIP = request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      'unknown';

    // 🔒 速率限制检查（在验证密码前）
    if (token) {
      const rateCheck = await dao.checkRateLimit(clientIP);
      if (rateCheck.blocked) {
        const remainingMin = Math.ceil(rateCheck.remainingMs / 60000);
        return json({
          error: `Too many failed attempts. Try again in ${remainingMin} minutes.`,
          blocked: true,
          remainingMs: rateCheck.remainingMs
        }, 429, env);
      }
    }

    // Level 1: Root 身份 (最高权限)
    let isRoot = false;
    if (env.PASSWORD && token) {
      isRoot = await safeCompare(token, env.PASSWORD);
    }

    // Level 2: User 身份 (API 用户)
    let isUser = isRoot;
    if (!isRoot && token) {
      // 如果密码不对，再查库看看是不是普通 Token
      isUser = await dao.validateToken(token);
    }

    // 🔒 登录成功：清除速率限制记录
    if (isUser && token) {
      await dao.clearRateLimit(clientIP);
    }


    // ==========================================
    // 4. 公开路由 (Public Routes)
    // ==========================================

    // 🔒 [GET] robots.txt - 禁止搜索引擎索引（防止域名被收录后触发关键词扫描封锁）
    if (path === '/robots.txt') {
      return new Response(
        `# 🔒 Disallow all crawlers to prevent SEO indexing
User-agent: *
Disallow: /

# Block common crawlers explicitly
User-agent: Googlebot
Disallow: /

User-agent: Bingbot
Disallow: /

User-agent: Baiduspider
Disallow: /

User-agent: YandexBot
Disallow: /
`, {
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=86400',
          'X-Robots-Tag': 'noindex, nofollow'
        }
      }
      );
    }

    // [GET] PWA Manifest (缓存 1 天)
    if (path === '/manifest.json') {
      let title = env.TITLE || "Nav";
      try {
        const config = await dao.getConfigs();
        if (config.title) title = config.title;
      } catch (e) { }

      return new Response(JSON.stringify({
        name: title,
        short_name: title.length > 12 ? "Nav" : title,
        start_url: "/",
        display: "standalone",
        background_color: "#1a1a1a",
        theme_color: "#1a1a1a",
        icons: [{ src: "https://cdn-icons-png.flaticon.com/512/1006/1006771.png", sizes: "192x192", type: "image/png" }]
      }), {
        headers: {
          "content-type": "application/json",
          "Cache-Control": "public, max-age=86400",  // ⚙️ 缓存 1 天
          ...getCorsHeaders(env)
        }
      });
    }

    // [GET] 健康检查
    if (path === '/api/health') {
      return json({ status: 'ok', ...(await dao.getStats()) });
    }

    // [GET] 获取公共配置 (边缘缓存 5 分钟)
    if (path === '/api/config' && method === 'GET') {
      // 🔧 构建规范化的缓存 Key
      const cacheKey = new Request(`${url.origin}/api/config`, { method: 'GET' });
      const cache = caches.default;

      try {
        // ⚡ Step 1: 尝试从 Cloudflare Cache 读取
        let cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          const headers = new Headers(cachedResponse.headers);
          headers.set('X-Cache', 'HIT');
          return new Response(cachedResponse.body, {
            status: cachedResponse.status,
            headers
          });
        }

        // ⚡ Step 2: 缓存未命中，查询数据库
        const conf = await dao.getConfigs();
        const configData = {
          title: conf.title || env.TITLE || "My Nav",
          bg_image: conf.bg_image || env.BG_IMAGE || "",
          allow_search: conf.allow_search !== 'false'
        };

        const responseHeaders = {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300, s-maxage=300",
          "X-Cache": "MISS",
          ...getCorsHeaders(env)
        };

        const response = new Response(JSON.stringify(configData), { headers: responseHeaders });

        // ⚡ Step 3: 写入 Cloudflare Cache（使用 waitUntil 避免阻塞响应）
        const responseToCache = new Response(JSON.stringify(configData), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300, s-maxage=300"
          }
        });
        ctx.waitUntil(cache.put(cacheKey, responseToCache));

        return response;
      } catch (e) {
        // 缓存失败时降级为直接查询
        console.warn('[/api/config] Cache error:', e.message);
        const conf = await dao.getConfigs();
        return new Response(JSON.stringify({
          title: conf.title || env.TITLE || "My Nav",
          bg_image: conf.bg_image || env.BG_IMAGE || "",
          allow_search: conf.allow_search !== 'false'
        }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300, s-maxage=300",
            ...getCorsHeaders(env)
          }
        });
      }
    }

    // [SSR] 首页渲染
    if (path === '/' || path === '/index.html') {
      try {
        // 获取配置（包括 private_mode）
        const config = await dao.getConfigs();
        const uiConfig = {
          TITLE: config.title || env.TITLE || "My Nav",
          BG_IMAGE: config.bg_image || env.BG_IMAGE || "",
        };

        // 🔒 私有模式检查
        const isPrivateMode = config.private_mode === 'true' || config.private_mode === '1';
        const hasAuthParam = url.searchParams.get('auth') === '1';

        if (isPrivateMode && !hasAuthParam) {
          // 返回纯登录页面（不暴露任何链接数据）
          return new Response(renderLoginPage(uiConfig), {
            headers: {
              "content-type": "text/html;charset=UTF-8",
              "Cache-Control": "no-store",  // 私有模式不缓存
              ...getSecurityHeaders()
            }
          });
        }

        // 🔒 私有模式安全保障：私有模式下，即使有 ?auth=1，SSR 也不注入数据
        // 数据完全依赖客户端通过 API (/api/data) 拉取，防止源码泄露
        const ssrData = isPrivateMode ? [] : (await dao.getAllData(false)).nav;

        // 渲染 UI + 🔒 添加安全响应头
        return new Response(renderUI(ssrData, uiConfig), {
          headers: {
            "content-type": "text/html;charset=UTF-8",
            "Cache-Control": isPrivateMode ? "no-store" : "public, max-age=60, s-maxage=60",
            ...getSecurityHeaders()
          }
        });
      } catch (e) {
        // 🔒 XSS 防护：转义错误信息防止反射型攻击
        return new Response(
          `<!DOCTYPE html><html><body style="background:#111;color:#fff;font-family:sans-serif;padding:2rem;">
           <h1>🚧 System Error</h1>
           <p>${escapeHtml(e.message)}</p>
           </body></html>`,
          { status: 500, headers: { "content-type": "text/html", ...getSecurityHeaders() } }
        );
      }
    }

    // ==========================================
    // 5. 保护接口 (Protected API Routes)
    // ==========================================

    if (path.startsWith('/api/')) {

      // 🔥 点击上报接口 (无需鉴权，但校验来源防滥用)
      if (path === '/api/visit' && method === 'POST') {
        try {
          // 🔒 防滥用：校验请求来源（Referer 或 Origin）
          const referer = request.headers.get('Referer') || '';
          const origin = request.headers.get('Origin') || '';
          const allowedOrigin = env.ALLOWED_ORIGIN || url.origin;

          // 检查是否来自允许的域名
          const isValidReferer = referer.startsWith(allowedOrigin) || referer.startsWith(url.origin);
          const isValidOrigin = origin === allowedOrigin || origin === url.origin;

          if (!isValidReferer && !isValidOrigin) {
            // 静默拒绝，不暴露具体原因给攻击者
            return json({ status: 'ok' }, 200, env);
          }

          const body = await request.json().catch(() => ({}));
          if (body.id) {
            // 等待数据库更新完成
            await dao.incrementVisit(body.id);
          }
          return json({ status: 'ok' }, 200, env);
        } catch (e) {
          console.error('[/api/visit] Error:', e.message);
          return json({ status: 'ok' }, 200, env); // 即使失败也返回成功，不影响用户体验
        }
      }

      // 🔒 图标代理接口 (隐私保护：避免浏览器直接请求 Google)
      // ⚡ 使用 Cloudflare Cache API 实现边缘缓存，避免频繁请求 Google
      if (path === '/api/icon' && method === 'GET') {
        const domain = url.searchParams.get('domain');
        if (!domain) {
          return new Response('Missing domain parameter', { status: 400 });
        }

        // 安全检查：只允许有效域名格式
        if (!/^[a-zA-Z0-9][a-zA-Z0-9\-\.]*\.[a-zA-Z]{2,}$/.test(domain)) {
          return new Response('Invalid domain format', { status: 400 });
        }

        // 🔧 构建规范化的缓存 Key（确保同一域名总是使用相同的 key）
        const cacheKey = new Request(`https://icon-cache.internal/icon/${domain.toLowerCase()}`, {
          method: 'GET'
        });
        const cache = caches.default;

        try {
          // ⚡ Step 1: 尝试从 Cloudflare Cache 读取
          let cachedResponse = await cache.match(cacheKey);
          if (cachedResponse) {
            // 命中缓存，直接返回（添加标记头方便调试）
            const headers = new Headers(cachedResponse.headers);
            headers.set('X-Cache', 'HIT');
            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              headers
            });
          }

          // ⚡ Step 2: 缓存未命中，请求 Google Favicon 服务
          const iconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
          const iconRes = await fetch(iconUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NavIconProxy/1.0)' }
          });

          if (!iconRes.ok) {
            return new Response('Icon not found', { status: 404 });
          }

          // 读取图标内容（需要先读取才能同时写入缓存和返回）
          const iconBody = await iconRes.arrayBuffer();
          const contentType = iconRes.headers.get('Content-Type') || 'image/png';

          // 构建响应（7天缓存）
          const responseHeaders = {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=604800, s-maxage=604800', // 浏览器+CDN 缓存 7 天
            'Access-Control-Allow-Origin': '*',
            'X-Cache': 'MISS'
          };

          const response = new Response(iconBody, { headers: responseHeaders });

          // ⚡ Step 3: 写入 Cloudflare Cache（使用 waitUntil 避免阻塞响应）
          // 必须克隆响应，因为 Response body 只能读取一次
          const responseToCache = new Response(iconBody, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=604800, s-maxage=604800'
            }
          });
          ctx.waitUntil(cache.put(cacheKey, responseToCache));

          return response;
        } catch (e) {
          console.error('[/api/icon] Error:', e.message);
          return new Response('Icon fetch failed', { status: 500 });
        }
      }


      // 🔒 鉴权拦截 + 速率限制记录
      if (!isUser) {
        // 只有当提供了 token 但验证失败时才记录（防止无 token 请求也计数）
        if (token) {
          const result = await dao.recordFailedAttempt(clientIP);
          if (result.locked) {
            const lockMin = Math.ceil(result.lockoutMs / 60000);
            return json({
              error: `Account locked due to too many failed attempts. Try again in ${lockMin} minutes.`,
              blocked: true,
              lockoutMs: result.lockoutMs
            }, 429, env);
          }
          // 返回剩余尝试次数提示
          const remaining = 5 - result.attempts;
          return json({
            error: `Unauthorized. ${remaining} attempts remaining before lockout.`,
            attemptsRemaining: remaining
          }, 401, env);
        }
        return json({ error: "Unauthorized" }, 401, env);
      }

      try {
        const isWrite = ['POST', 'PUT', 'DELETE'].includes(method);
        const body = isWrite ? await request.json().catch(() => ({})) : {};

        // ------------------------------------
        // A. 基础状态
        // ------------------------------------
        if (path === '/api/auth/verify') {
          return json({
            status: 'ok',
            role: isRoot ? 'root' : 'user',
            timestamp: Date.now()
          });
        }

        // ------------------------------------
        // B. Root 专属操作
        // ------------------------------------
        const rootEndpoints = [
          '/api/import',
          '/api/export',
          // '/api/config', // 注意：GET 是公开的，POST 需要 Root，下面单独判断
          '/api/token/create',
          '/api/token/delete'
        ];

        // 检查 Root 权限
        if (!isRoot) {
          // 如果是 POST /api/config，必须 Root
          if (path === '/api/config' && method === 'POST') return errorResp("Root privilege required", 403);
          // 如果在黑名单里，拒绝
          if (rootEndpoints.includes(path)) return errorResp("Root privilege required", 403);
        }

        // Root 功能路由
        if (path === '/api/import') return json(await dao.importData(body));

        if (path === '/api/export') {
          const allData = await dao.getAllData(true);
          const exportData = allData.nav.map(cat => ({
            category: cat.title,
            is_private: cat.is_private,
            items: cat.items.map(link => ({
              title: link.title,
              url: link.url,
              description: link.description,
              icon: link.icon,
              is_private: link.is_private
            }))
          }));
          return json({ meta: { version: 1, date: new Date().toISOString() }, data: exportData });
        }

        if (path === '/api/config' && method === 'POST') {
          await dao.updateConfig(body.key, body.value);
          return json({ status: 'ok', key: body.key, value: body.value });
        }
        if (path === '/api/token/create') return json(await dao.createToken(body.name));
        if (path === '/api/token/delete') return json(await dao.deleteToken(body.id));

        // ------------------------------------
        // C. 普通数据操作 (CRUD) - User & Root 均可
        // ------------------------------------

        // [GET] 获取全量数据 (后台模式)
        if (path === '/api/data') return json(await dao.getAllData(true));

        if (method === 'POST') {
          // Category
          if (path === '/api/category') return json(await dao.addCategory(body));
          if (path === '/api/category/update') return json(await dao.updateCategory(body));
          if (path === '/api/category/delete') return json(await dao.deleteCategory(body.id));
          if (path === '/api/category/reorder') return json(await dao.batchUpdateCategoriesOrder(body));

          // Link
          if (path === '/api/link') return json(await dao.addLink(body));
          if (path === '/api/link/update') return json(await dao.updateLink(body));
          if (path === '/api/link/delete') return json(await dao.deleteLink(body.id));
          if (path === '/api/link/reorder') return json(await dao.batchUpdateLinksOrder(body));
        }

        return errorResp(`Endpoint not found: ${path}`, 404);

      } catch (e) {
        console.error(`[API Error] ${path}:`, e);
        return errorResp(e.message, 500);
      }
    }

    // 🔒 404 伪装：私有模式下返回登录页，迷惑爬虫/扫描器
    // 无论访问 /admin, /wp-login.php 还是任何路径，都只看到登录框
    try {
      const config = await dao.getConfigs();
      const isPrivateMode = config.private_mode === 'true' || config.private_mode === '1';

      if (isPrivateMode) {
        const uiConfig = {
          TITLE: config.title || env.TITLE || "My Nav",
          BG_IMAGE: config.bg_image || env.BG_IMAGE || "",
        };
        return new Response(renderLoginPage(uiConfig), {
          status: 200,  // 返回 200 而非 404，完全伪装
          headers: {
            "content-type": "text/html;charset=UTF-8",
            "Cache-Control": "no-store",
            ...getSecurityHeaders()
          }
        });
      }
    } catch (e) { /* 配置读取失败，降级为普通 404 */ }

    return new Response("Not Found", { status: 404 });
  }
};
