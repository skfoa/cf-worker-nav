/**
 * src/components/Layout.tsx - 全局 HTML 骨架
 */
import type { FC } from 'hono/jsx'

interface LayoutProps {
  title: string
  bgImage?: string
  children: unknown
  nonce?: string
}

export const Layout: FC<LayoutProps> = ({ title, bgImage, children, nonce }) => (
  <html lang="zh-CN" data-theme="dark">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      <meta name="robots" content="noindex, nofollow" />
      <title>{title}</title>
      <link rel="icon" href="https://cdn-icons-png.flaticon.com/512/1006/1006771.png" />
      <link rel="manifest" href="/manifest.json" />
      <meta name="theme-color" content="#1a1a1a" />
      <link rel="stylesheet" href="/output.css" />
      {/* HTMX */}
      <script src="https://unpkg.com/htmx.org@2.0.4" nonce={nonce} />
      {/* SortableJS */}
      <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js" nonce={nonce} />
    </head>
    <body class="min-h-screen tap-none bg-base-300 text-base-content pb-28">
      {/* 背景图 */}
      {bgImage && (
        <div
          class="fixed inset-0 z-[-2] bg-cover bg-center bg-no-repeat pointer-events-none"
          style={`background-image: url('${bgImage}')`}
        />
      )}
      {/* 遮罩层 */}
      <div class="bg-overlay bg-overlay-dark" />
      {children}
      {/* Toast 容器 */}
      <div id="toast-container" class="toast toast-end toast-bottom z-[100]" />
    </body>
  </html>
)
