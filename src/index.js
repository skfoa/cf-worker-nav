import { DAO } from './db.js';
import { renderUI } from './ui.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const db = new DAO(env.DB);
    
    // 1. 基础配置
    const CONFIG = {
      TITLE: env.TITLE || "My Nav",
      BG_IMAGE: env.BG_IMAGE || "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?q=80&w=2070&auto=format&fit=crop"
    };

    // 2. PWA Manifest (带版本号缓存控制)
    if (url.pathname === '/manifest.json') {
       return new Response(JSON.stringify({
        name: CONFIG.TITLE, display: "standalone", start_url: "/"
      }), { headers: { "content-type": "application/json" } });
    }

    // 3. 首页渲染
    if (url.pathname === '/' || url.pathname === '/index.html') {
      try {
        const data = await db.getAllData();
        return new Response(renderUI(data, CONFIG), {
          headers: { "content-type": "text/html;charset=UTF-8" }
        });
      } catch (e) {
        return new Response(`DB Error: ${e.message}. Check Migrations.`, { status: 500 });
      }
    }

    // 4. API 鉴权
    if (url.pathname.startsWith('/api/')) {
      const auth = request.headers.get("Authorization");
      if (!env.PASSWORD || auth !== env.PASSWORD) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
    }

    // 5. API 路由
    try {
      const body = request.method !== 'GET' ? await request.json() : {};

      // === POST (新增) ===
      if (request.method === 'POST') {
        if (url.pathname === '/api/category') {
          await db.addCategory(body.title);
          return Response.json({ status: 'ok' });
        }
        if (url.pathname === '/api/link') {
          await db.addLink(body.category_id, body.title, body.url);
          return Response.json({ status: 'ok' });
        }
      }

      // === PUT (修改) - 新增 ===
      if (request.method === 'PUT') {
        if (url.pathname === '/api/category') {
          await db.updateCategory(body.id, body.title);
          return Response.json({ status: 'ok' });
        }
        if (url.pathname === '/api/link') {
          await db.updateLink(body.id, body.title, body.url, body.category_id);
          return Response.json({ status: 'ok' });
        }
      }

      // === DELETE (删除) ===
      if (request.method === 'DELETE') {
        if (url.pathname === '/api/category') {
          await db.deleteCategory(body.id);
          return Response.json({ status: 'ok' });
        }
        if (url.pathname === '/api/link') {
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
