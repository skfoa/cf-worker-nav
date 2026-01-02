import DAO from './db.js';
import { renderUI } from './ui.js';

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
  async fetch(request, env) {
    // 0. 数据库绑定检查 (防止本地开发未配置导致崩溃)
    if (!env.DB) {
      return errorResp("Database D1 is not bound. Check wrangler.toml", 500);
    }

    const url = new URL(request.url);
    // 🛠️ 修复：移除路径末尾的斜杠，防止 '/api/data/' 匹配失败
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
    // 3. 鉴权逻辑 (修复 Bearer 格式问题)
    // ==========================================
    const authHeader = request.headers.get("Authorization");
    let token = "";

    // 🛠️ 修复：自动提取 'Bearer ' 后的 Token
    if (authHeader) {
      token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : authHeader.trim();
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

    // ==========================================
    // 4. 公开路由 (Public Routes)
    // ==========================================

    // [GET] PWA Manifest
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
      }), { headers: { "content-type": "application/json", ...getCorsHeaders(env) } });
    }

    // [GET] 健康检查
    if (path === '/api/health') {
      return json({ status: 'ok', ...(await dao.getStats()) });
    }

    // [GET] 获取公共配置
    if (path === '/api/config' && method === 'GET') {
      const conf = await dao.getConfigs();
      return json({
        title: conf.title || env.TITLE || "My Nav",
        bg_image: conf.bg_image || env.BG_IMAGE || "",
        allow_search: conf.allow_search !== 'false'
      });
    }

    // [SSR] 首页渲染
    if (path === '/' || path === '/index.html') {
      try {
        const data = await dao.getAllData(false); // false = 仅公开数据
        const uiConfig = {
          TITLE: data.config.title || env.TITLE || "My Nav",
          BG_IMAGE: data.config.bg_image || env.BG_IMAGE || "",
        };
        // 渲染 UI (ui.js 提供)
        return new Response(renderUI(data.nav, uiConfig), {
          headers: { "content-type": "text/html;charset=UTF-8" }
        });
      } catch (e) {
        // 🔒 XSS 修复：转义错误信息防止反射型攻击
        return new Response(
          `<!DOCTYPE html><html><body style="background:#111;color:#fff;font-family:sans-serif;padding:2rem;">
           <h1>🚧 System Error</h1>
           <p>${escapeHtml(e.message)}</p>
           </body></html>`,
          { status: 500, headers: { "content-type": "text/html" } }
        );
      }
    }

    // ==========================================
    // 5. 保护接口 (Protected API Routes)
    // ==========================================

    if (path.startsWith('/api/')) {

      // 🔥 点击上报接口 (无需鉴权，公开可用)
      if (path === '/api/visit' && method === 'POST') {
        try {
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

      // 🔒 鉴权拦截
      if (!isUser) {
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

    return new Response("Not Found", { status: 404 });
  }
};
