import { DAO } from './db.js';
import { renderUI } from './ui.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const db = new DAO(env.DB);
    
    // 1. 基础配置读取 (含默认值)
    const CONFIG = {
      TITLE: env.TITLE || "My Nav",
      BG_IMAGE: env.BG_IMAGE || "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?q=80&w=2070&auto=format&fit=crop"
    };

    // 2. 路由: 静态资源 (favicon 等)
    if (url.pathname === '/manifest.json') {
       return new Response(JSON.stringify({
        name: CONFIG.TITLE, display: "standalone", start_url: "/"
      }), { headers: { "content-type": "application/json" } });
    }

    // 3. 路由: 首页 (GET /)
    if (url.pathname === '/' || url.pathname === '/index.html') {
      try {
        const data = await db.getAllData();
        return new Response(renderUI(data, CONFIG), {
          headers: { "content-type": "text/html;charset=UTF-8" }
        });
      } catch (e) {
        return new Response(`Database Error: ${e.message}. Did you run 'wrangler d1 migrations apply'?`, { status: 500 });
      }
    }

    // 4. API 鉴权 (简单的 Token 验证)
    // 所有 /api/ 开头的请求都需要密码
    if (url.pathname.startsWith('/api/')) {
      const auth = request.headers.get("Authorization");
      if (!env.PASSWORD || auth !== env.PASSWORD) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
    }

    // 5. 路由: API 接口 (RESTful 风格)
    try {
      if (request.method === 'POST') {
        const body = await request.json();
        
        // 新增分类
        if (url.pathname === '/api/category') {
          await db.addCategory(body.title);
          return Response.json({ status: 'ok' });
        }
        
        // 删除分类
        if (url.pathname === '/api/category/delete') {
          await db.deleteCategory(body.id);
          return Response.json({ status: 'ok' });
        }

        // 新增链接
        if (url.pathname === '/api/link') {
          await db.addLink(body.category_id, body.title, body.url);
          return Response.json({ status: 'ok' });
        }

        // 删除链接
        if (url.pathname === '/api/link/delete') {
          await db.deleteLink(body.id);
          return Response.json({ status: 'ok' });
        }
      }
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    return new Response("Not Found", { status: 404 });
  }
};
