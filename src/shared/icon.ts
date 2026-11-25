/**
 * src/shared/icon.ts - 前后端共享的图标地址解析与本地首字母 SVG 生成
 */

export const LETTER_ICON_TOKEN = 'letter'
export const ICON_DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9\-\.]*\.[a-zA-Z]{2,}$/

export function isLetterIcon(icon?: string | null): boolean {
  return (icon || '').trim().toLowerCase() === LETTER_ICON_TOKEN
}

export function isProxyableIconDomain(hostname: string): boolean {
  return ICON_DOMAIN_REGEX.test(hostname)
}

function extractHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname
  } catch {
    return ''
  }
}

export function buildLetterAvatarDataUrl(seed: string): string {
  const clean = (seed || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  const letter = (Array.from(clean)[0] || '?').toUpperCase()
  const hue = ((letter.codePointAt(0) || 63) * 37) % 360
  const safeLetter = letter.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">` +
    `<stop offset="0%" stop-color="hsl(${hue},65%,55%)"/>` +
    `<stop offset="100%" stop-color="hsl(${(hue + 30) % 360},55%,45%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="64" height="64" rx="14" fill="url(#g)"/>` +
    `<text x="32" y="32" font-family="system-ui,sans-serif" font-size="30" font-weight="600" fill="white" text-anchor="middle" dominant-baseline="central">${safeLetter}</text>` +
    `</svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

export function resolveLinkIcon(link: {
  icon?: string
  url: string
  title?: string
}): { iconSrc: string; originalIcon: string; isInline: boolean } {
  const trimmedIcon = (link.icon || '').trim()
  if (isLetterIcon(trimmedIcon)) {
    return {
      iconSrc: buildLetterAvatarDataUrl(link.title || extractHostname(link.url)),
      originalIcon: '',
      isInline: true,
    }
  }
  if (trimmedIcon.startsWith('http://') || trimmedIcon.startsWith('https://')) {
    return {
      iconSrc: '/api/icon?url=' + encodeURIComponent(trimmedIcon),
      originalIcon: trimmedIcon,
      isInline: false,
    }
  }
  const hostname = extractHostname(link.url)
  if (hostname && isProxyableIconDomain(hostname)) {
    return {
      iconSrc: '/api/icon?domain=' + encodeURIComponent(hostname),
      originalIcon: '',
      isInline: false,
    }
  }
  // IP 地址、localhost 或无后缀内网主机名直接本地生成首字母 SVG，避免请求 /api/icon 拿 400
  return {
    iconSrc: buildLetterAvatarDataUrl(link.title || hostname),
    originalIcon: '',
    isInline: true,
  }
}
