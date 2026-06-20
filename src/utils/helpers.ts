/**
 * src/utils/helpers.ts - 通用工具函数
 */

/**
 * 构建图标代理 URL
 */
export function getIconUrl(link: { icon?: string; url: string }): string {
  if (link.icon) return link.icon
  try {
    const domain = new URL(link.url).hostname
    return `/api/icon?domain=${encodeURIComponent(domain)}`
  } catch {
    return ''
  }
}

/**
 * 🔒 HTML 转义防止 XSS
 * 注：Hono JSX 自动转义，此函数仅用于 JSON 注入到 <script> 时
 */
export function escapeHtml(str: string | undefined | null): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * 安全地将数据注入到 <script> 标签中
 * 防止 XSS + JSON 截断 + 模板字符串注入
 */
export function safeJsonStringify(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')       // 防止 </script> 注入
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')  // Line Separator
    .replace(/\u2029/g, '\\u2029')  // Paragraph Separator
}
