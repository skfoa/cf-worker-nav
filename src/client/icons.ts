/**
 * src/client/icons.ts - 图标 URL 构建、懒加载与全局容错 SVG 兜底
 */
import { buildLetterAvatarDataUrl, isLetterIcon, isProxyableIconDomain, LETTER_ICON_TOKEN, resolveLinkIcon } from '../shared/icon'

export { buildLetterAvatarDataUrl, isLetterIcon, isProxyableIconDomain, LETTER_ICON_TOKEN }

export const LAZY_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"

export function getClientIconSrc(link: {
  icon?: string
  url: string
  title?: string
}): { iconSrc: string; originalIcon: string; isInline: boolean } {
  return resolveLinkIcon(link)
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

