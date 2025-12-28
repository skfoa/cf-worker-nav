import { DAO } from './db.js';
import { renderUI } from './ui.js';

// ==============================================
// 1. 安全工具与全局配置
// ==============================================

// 防时序攻击的字符串比对函数
// 即使长度不同或内容错误，也消耗恒定的时间（近似），防止攻击者通过响应时间猜测密码长度或内容
function safeCompare(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// 增强的 CORS 头，包含 Max-Age 缓存预检结果 24 小时
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400', 
};

// 统一 JSON 响应
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

// 统一错误响应
function errorResp(msg, status = 500) {
  return json({ error: msg, success: false }, status);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    
    // 初始化数据库访问对象
    const dao = new DAO(env.DB);

    // ==========================================
    // 2. CORS Preflight (预检请求处理)
    // ==========================================
    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // ==========================================
    // 3. 鉴权逻辑 (Hardened Auth Strategy)
    // ==========================================
    const authHeader = request.headers.get("Authorization");
    
    // Level 1: Root 身份 (最高权限)
    // 使用 safeCompare 防止时序攻击
    let isRoot = false;
    if (env.PASSWORD && authHeader) {
      isRoot = safeCompare(authHeader, env.PASSWORD);
    }
    
    // Level 2: User 身份 (API 用户)
    // 允许 Root 或 持有有效 Token 的用户
    let isUser = isRoot;
    
    // 如果不是 Root，尝试去数据库验证 Token
    if (!isRoot && authHeader) {
       // validateToken 内部是查库匹配 Hash，天然安全
       isUser = await dao.validateToken(authHeader);
    }

    // ==========================================
    // 4. 公开路由 (Public Routes)
    // ==========================================

    // [GET] PWA Manifest
    if (url.pathname === '/manifest.json') {
      let title = env.TITLE || "Nav";
      try {
         const config = await dao.getConfigs();
         if (config.title) title = config.title;
      } catch(e) { /* DB可能未初始化 */ } 

      return new Response(JSON.stringify({
        name: title,
        short_name: title.length > 12 ? "Nav" : title,
        start_url: "/",
        display: "standalone",
        background_color: "#1a1a1a",
        theme_color: "#1a1a1a",
        icons: [{ src: "https://cdn-icons-png.flaticon.com/512/1006/1006771.png", sizes: "192x192", type: "image/png" }]
      }), { headers: { "content-type": "application/json", ...CORS_HEADERS } });
    }

    // [GET] 健康检查
    if (url.pathname === '/api/health') {
      try {
        return json({ status: 'ok', ...(await dao.getStats()) });
      } catch (e) {
        return json({ status: 'error', message: 'Database disconnected' }, 500);
      }
    }

    // [GET] 获取公共配置
    if (url.pathname === '/api/config' && method === 'GET') {
      try {
        const conf = await dao.getConfigs();
        return json({
          title: conf.title || env.TITLE || "My Nav",
          bg_image: conf.bg_image || env.BG_IMAGE || "",
          allow_search: conf.allow_search !== 'false'
        });
      } catch (e) {
        return errorResp("System not ready", 503);
      }
    }

    // [SSR] 首页渲染
    if (url.pathname === '/' || url.pathname === '/index.html') {
      try {
        // false = 仅获取公开数据
        const data = await dao.getAllData(false); 
        
        const uiConfig = {
          TITLE: data.config.title || env.TITLE || "My Nav",
          BG_IMAGE: data.config.bg_image || env.BG_IMAGE || "",
        };
        
        return new Response(renderUI(data.nav, uiConfig), {
          headers: { "content-type": "text/html;charset=UTF-8" }
        });
      } catch (e) {
        return new Response(
          `<!DOCTYPE html><html><body style="background:#111;color:#fff;font-family:sans-serif;padding:2rem;">
           <h1>🚧 System Initializing</h1>
           <p>Database Error: ${e.message}</p>
           <p>Hint: Ensure D1 is bound and migrations are applied.</p>
           <code style="background:#333;padding:5px">npx wrangler d1 migrations apply DB --remote</code>
           </body></html>`, 
          { status: 500, headers: { "content-type": "text/html" } }
        );
      }
    }

    // ==========================================
    // 5. 保护接口 (Protected API Routes)
    // ==========================================
    
    if (url.pathname.startsWith('/api/')) {
      
      // 🔒 鉴权拦截
      if (!isUser) {
        return json({ error: "Unauthorized" }, 401);
      }

      try {
        const isWrite = ['POST', 'PUT', 'DELETE'].includes(method);
        const body = isWrite ? await request.json().catch(() => ({})) : {};

        // ------------------------------------
        // A. 基础状态
        // ------------------------------------
        if (url.pathname === '/api/auth/verify') {
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
          '/api/config', // POST
          '/api/token/create', 
          '/api/token/delete'
        ];
        
        // 如果请求的是 Root 专属接口，且当前不是 Root (仅是 User)
        if (rootEndpoints.includes(url.pathname) && !isRoot) {
            // 特殊处理：/api/config GET 是公开的，POST 是 Root 专属
            if (url.pathname === '/api/config' && method === 'GET') {
                // pass (allow through) - 其实前面已经处理了 GET，这里是防御性编程
            } else {
                return errorResp("Root privilege required", 403);
            }
        }

        // [POST] 导入
        if (url.pathname === '/api/import') return json(await dao.importData(body));

        // [GET] 导出
        if (url.pathname === '/api/export') {
          const allData = await dao.getAllData(true); 
          const exportData = allData.nav.map(cat => ({
            category: cat.title,
            is_private: cat.is_private,
            items: cat.items.map(link => ({
              title: link.title,
              url: link.url,
              description: link.description,
              icon: link.icon
            }))
          }));
          return json({ meta: { version: 1, date: new Date().toISOString() }, data: exportData });
        }

        // [POST] Config / Token
        if (url.pathname === '/api/config' && method === 'POST') {
           await dao.updateConfig(body.key, body.value);
           return json({ status: 'ok', key: body.key, value: body.value });
        }
        if (url.pathname === '/api/token/create') return json(await dao.createToken(body.name));
        if (url.pathname === '/api/token/delete') return json(await dao.deleteToken(body.id));

        // ------------------------------------
        // C. 普通数据操作 (CRUD)
        // ------------------------------------
        
        // [GET] 获取全量数据 (API 模式)
        if (url.pathname === '/api/data') return json(await dao.getAllData(true));

        if (method === 'POST') {
          // Category
          if (url.pathname === '/api/category') return json(await dao.addCategory(body));
          if (url.pathname === '/api/category/update') return json(await dao.updateCategory(body));
          if (url.pathname === '/api/category/delete') return json(await dao.deleteCategory(body.id));
          if (url.pathname === '/api/category/reorder') return json(await dao.batchUpdateCategoriesOrder(body));

          // Link
          if (url.pathname === '/api/link') return json(await dao.addLink(body));
          if (url.pathname === '/api/link/update') return json(await dao.updateLink(body));
          if (url.pathname === '/api/link/delete') return json(await dao.deleteLink(body.id));
          if (url.pathname === '/api/link/reorder') return json(await dao.batchUpdateLinksOrder(body));
        }

        return errorResp("Endpoint not found", 404);

      } catch (e) {
        console.error(`[API Error] ${url.pathname}:`, e);
        return errorResp(e.message, 500);
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
