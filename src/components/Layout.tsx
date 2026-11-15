/**
 * src/components/Layout.tsx - 全局 HTML 骨架
 */
import type { FC } from 'hono/jsx'
import { SafeUrlSchema } from '../types'

interface LayoutProps {
  title: string
  bgImage?: string
  children: unknown
  nonce?: string
}

function sanitizeCssUrl(raw?: string): string {
  if (!raw || !SafeUrlSchema.safeParse(raw).success) return ''
  return raw.replace(/['"\\()\s]/g, ch => `%${ch.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()}`)
}

export const Layout: FC<LayoutProps> = ({ title, bgImage, children, nonce }) => {
  const safeBgImage = sanitizeCssUrl(bgImage)
  return (
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
    </head>
    <body class={`min-h-screen tap-none text-base-content pb-28 ${safeBgImage ? 'bg-transparent' : 'bg-base-300'}`}>
      {/* 背景图 */}
      {safeBgImage && (
        <div
          class="bg-image-layer fixed inset-0 z-[-2] bg-cover bg-center bg-no-repeat pointer-events-none"
          style={`background-image: url('${safeBgImage}')`}
        />
      )}
      {/* 遮罩层 */}
      <div class="bg-overlay bg-overlay-dark" />
      {children}
      {/* Toast 容器 */}
      <div id="toast-container" class="toast toast-end toast-top z-[9999]" />
    </body>
  </html>
  )
}
