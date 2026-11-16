/**
 * src/client/icons.ts - 图标 URL 构建、懒加载与全局容错 SVG 兜底
 */

export const LAZY_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"

export function getClientIconSrc(link: { icon?: string; url: string }): { iconSrc: string; originalIcon: string } {
  if (link.icon && (link.icon.startsWith('http://') || link.icon.startsWith('https://'))) {
    return {
      iconSrc: '/api/icon?url=' + encodeURIComponent(link.icon),
      originalIcon: link.icon,
    }
  }
  try {
    return {
      iconSrc: '/api/icon?domain=' + encodeURIComponent(new URL(link.url).hostname),
      originalIcon: '',
    }
  } catch {
    return {
      iconSrc: '/api/icon?domain=default',
      originalIcon: '',
    }
  }
}

export function buildLetterAvatarDataUrl(title: string): string {
  const letter = (title.trim().charAt(0) || '?').toUpperCase()
  const hue = (letter.charCodeAt(0) * 37) % 360
  const safeLetter = letter.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="14" fill="hsl(${hue},60%,50%)"/>` +
    `<text x="32" y="32" font-family="system-ui,sans-serif" font-size="30" font-weight="600" fill="white" text-anchor="middle" dominant-baseline="central">${safeLetter}</text>` +
    `</svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

export function applyImageFallback(img: HTMLImageElement): void {
  const originalIcon = img.getAttribute('data-original-icon')
  if (originalIcon && (originalIcon.startsWith('http://') || originalIcon.startsWith('https://'))) {
    img.removeAttribute('data-original-icon')
    img.src = originalIcon
    return
  }
  if (img.dataset.fallbackApplied === '1') return
  img.dataset.fallbackApplied = '1'
  const card = img.closest('.link-card')
  const title = card?.getAttribute('data-title') || ''
  img.src = buildLetterAvatarDataUrl(title)
}

export function initImageErrorFallback(): void {
  // 捕获阶段统一处理图片加载失败，消除每张卡片重复的内联 onerror
  document.addEventListener(
    'error',
    (e) => {
      const target = e.target
      if (target instanceof HTMLImageElement && target.closest('.link-card')) {
        applyImageFallback(target)
      }
    },
    true
  )

  // 兜底扫描：首屏 SSR 图片可能在脚本执行前已经加载失败（此时错过了 error 事件）
  document.querySelectorAll<HTMLImageElement>('.link-card img:not([data-src])').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) {
      applyImageFallback(img)
    }
  })
}

export function loadLazyImages(container: Element | null): void {
  if (!container) return
  container.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((img) => {
    const src = img.getAttribute('data-src')
    if (src) {
      img.src = src
      img.removeAttribute('data-src')
    }
  })
}

