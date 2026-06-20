/**
 * src/components/LoginForm.tsx - 登录页面
 */
import type { FC } from 'hono/jsx'

interface LoginFormProps {
  title: string
  bgImage?: string
  nonce?: string
}

export const LoginForm: FC<LoginFormProps> = ({ title, bgImage, nonce }) => (
  <html lang="zh-CN" data-theme="dark">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="robots" content="noindex, nofollow" />
      <title>{title} - 登录</title>
      <link rel="icon" href="https://cdn-icons-png.flaticon.com/512/1006/1006771.png" />
      <link rel="stylesheet" href="/output.css" />
    </head>
    <body class="min-h-screen flex items-center justify-center bg-base-300">
      {bgImage && (
        <div
          class="fixed inset-0 z-[-2] bg-cover bg-center bg-no-repeat pointer-events-none"
          style={`background-image: url('${bgImage}')`}
        />
      )}
      <div class="fixed inset-0 z-[-1] bg-black/60 pointer-events-none" />
      <div class="card bg-base-200/95 shadow-2xl border border-base-content/10 w-[90%] max-w-sm">
        <div class="card-body">
          <h1 class="card-title justify-center text-xl">🔐 私有站点</h1>
          <p class="text-center text-base-content/60 text-sm">此站点需要管理员权限才能访问</p>
          <div class="form-control mt-4">
            <input
              type="password"
              id="pwd"
              placeholder="请输入密码"
              class="input input-bordered w-full"
              autocomplete="current-password"
            />
          </div>
          <div class="form-control mt-2">
            <button type="button" id="login-btn" class="btn btn-primary w-full">登录</button>
          </div>
          <div id="login-err" class="text-error text-center text-sm mt-2 hidden" />
        </div>
      </div>
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `
        document.getElementById('pwd').addEventListener('keydown', function(e) {
          if (e.key === 'Enter') doLogin();
        });
        document.getElementById('login-btn').addEventListener('click', doLogin);
        async function doLogin() {
          var pwd = document.getElementById('pwd').value;
          if (!pwd) return;
          try {
            var res = await fetch('/api/auth/verify', {
              headers: { 'Authorization': 'Bearer ' + pwd }
            });
            var json = await res.json();
            if (json.status === 'ok') {
              localStorage.setItem('nav_token', pwd);
              location.href = '/?auth=1';
            } else {
              showErr(json.error || '密码错误');
            }
          } catch (e) {
            showErr('登录失败: ' + e.message);
          }
        }
        function showErr(msg) {
          var el = document.getElementById('login-err');
          el.textContent = msg;
          el.classList.remove('hidden');
        }
        // 自动登录检查
        (function() {
          var token = localStorage.getItem('nav_token');
          if (token) {
            fetch('/api/auth/verify', { headers: { 'Authorization': 'Bearer ' + token } })
              .then(function(r) { return r.json(); })
              .then(function(j) { if (j.status === 'ok') location.href = '/?auth=1'; })
              .catch(function() {});
          }
        })();
      ` }} />
    </body>
  </html>
)
