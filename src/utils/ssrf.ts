/**
 * src/utils/ssrf.ts - 外链安全校验、防重定向绕过抓取与 HTML 元数据提取
 */

function parseIpv4Literal(host: string): number[] | null {
  const clean = host.replace(/^\[|\]$/g, '')
  // 拦截单整数 / 十六进制 / 八进制形式的 IPv4 绕过（如 2130706433、0x7f000001、0177.0.0.1）
  if (/^\d+$/.test(clean) || /^0x[0-9a-f]+$/i.test(clean)) {
    return [0, 0, 0, 0]
  }
  const parts = clean.split('.')
  if (parts.length !== 4 || !parts.every((p) => /^\d+$/.test(p))) return null
  if (parts.some((p) => p.length > 1 && p.startsWith('0'))) {
    // 八进制表示法直接按危险 IP 处理
    return [0, 0, 0, 0]
  }
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return nums
}

function isPrivateIpv4Octets(octets: number[]): boolean {
  const [a, b] = octets
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
  if (a === 169 && b === 254) return true // Link-local / 云元数据 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0) return true
  if (a >= 224) return true // 多播及保留地址
  return false
}

export function isPrivateOrReservedHostname(rawHostname: string): boolean {
  const host = rawHostname.trim().toLowerCase().replace(/\.$/, '')
  if (!host) return true

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.arpa')
  ) {
    return true
  }

  // IPv6 字面量检查
  if (host.startsWith('[') && host.endsWith(']')) {
    const inner = host.slice(1, -1)
    if (inner === '::' || inner === '::1') return true
    if (inner.startsWith('fc') || inner.startsWith('fd')) return true // ULA fc00::/7
    if (/^fe[89ab]/.test(inner)) return true // Link-local fe80::/10
    if (inner.includes('::ffff:') || inner.startsWith('::ffff')) {
      const mapped = inner.replace(/^.*::ffff:/i, '')
      const v4 = parseIpv4Literal(mapped)
      if (v4) return isPrivateIpv4Octets(v4)
      // 十六进制 IPv4 映射形态如 ::ffff:7f00:1 直接拒绝内网常见段或无法确认段
      return true
    }
    return false
  }

  const ipv4 = parseIpv4Literal(host)
  if (ipv4) {
    return isPrivateIpv4Octets(ipv4)
  }

  // 无点号的单标签主机名（内网服务别名如 redis / metadata）一律阻止
  if (!host.includes('.')) {
    return true
  }

  return false
}

export function assertSafePublicUrl(rawUrl: string, selfHostname?: string): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('URL 格式不正确')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('仅支持 http/https 协议')
  }
  if (parsed.username || parsed.password) {
    throw new Error('URL 不允许携带认证凭据')
  }
  if (isPrivateOrReservedHostname(parsed.hostname)) {
    throw new Error('不允许访问内网或保留地址')
  }
  if (selfHostname && parsed.hostname.toLowerCase() === selfHostname.toLowerCase()) {
    throw new Error('不允许抓取本站自身地址')
  }
  return parsed
}

export async function fetchWithSafeRedirects(
  rawUrl: string,
  opts: { selfHostname?: string; headers?: Record<string, string>; timeoutMs?: number; maxRedirects?: number } = {}
): Promise<{ response: Response; finalUrl: string }> {
  const { selfHostname, headers = {}, timeoutMs = 5000, maxRedirects = 3 } = opts
  let currentUrl = assertSafePublicUrl(rawUrl, selfHostname).toString()

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const res = await fetch(currentUrl, {
        headers,
        redirect: 'manual',
        signal: ac.signal,
      })

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('Location')
        res.body?.cancel().catch(() => {})
        if (!location) {
          throw new Error('目标返回无效重定向')
        }
        const nextUrl = new URL(location, currentUrl).toString()
        currentUrl = assertSafePublicUrl(nextUrl, selfHostname).toString()
        continue
      }

      return { response: res, finalUrl: currentUrl }
    }
    throw new Error('重定向次数过多')
  } finally {
    clearTimeout(timer)
  }
}

function safeFromCodePoint(cp: number): string {
  return Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ''
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/\s+/g, ' ')
    .trim()
}

function detectCharset(contentType: string, rawBytes: Uint8Array): string {
  const headerMatch = contentType.match(/charset\s*=\s*["']?([a-zA-Z0-9_-]+)/i)
  if (headerMatch?.[1]) return headerMatch[1].toLowerCase()

  const asciiProbe = new TextDecoder('latin1').decode(rawBytes.subarray(0, 4096))
  const metaMatch =
    asciiProbe.match(/<meta[^>]+charset\s*=\s*["']?\s*([a-zA-Z0-9_-]+)/i) ||
    asciiProbe.match(/<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([a-zA-Z0-9_-]+)/i)
  return metaMatch?.[1]?.toLowerCase() || 'utf-8'
}

function decodeHtmlBytes(bytes: Uint8Array, contentType: string): string {
  const charset = detectCharset(contentType, bytes)
  try {
    return new TextDecoder(charset).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

function extractMetaContent(html: string, keyName: string): string {
  const escaped = keyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re1 = new RegExp(
    `<meta\\s[^>]*?(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*?content\\s*=\\s*["']([^"']*)["'][^>]*>`,
    'i'
  )
  const re2 = new RegExp(
    `<meta\\s[^>]*?content\\s*=\\s*["']([^"']*)["'][^>]*?(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*>`,
    'i'
  )
  const m = html.match(re1) || html.match(re2)
  return m?.[1] ? decodeHtmlEntities(m[1]) : ''
}

export function extractHtmlMetadata(
  html: string,
  baseUrl: string
): { title: string; description: string; icon: string } {
  const ogTitle = extractMetaContent(html, 'og:title')
  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const titleTag = titleTagMatch?.[1] ? decodeHtmlEntities(titleTagMatch[1]) : ''
  const title = (ogTitle || titleTag).slice(0, 200)

  const description = (
    extractMetaContent(html, 'description') || extractMetaContent(html, 'og:description')
  ).slice(0, 500)

  const iconMatch = html.match(
    /<link\s[^>]*?(?:rel\s*=\s*["'](?:icon|shortcut icon|apple-touch-icon(?:-precomposed)?)["'][^>]*?href\s*=\s*["']([^"']+)["']|href\s*=\s*["']([^"']+)["'][^>]*?rel\s*=\s*["'](?:icon|shortcut icon|apple-touch-icon(?:-precomposed)?)["'])[^>]*>/i
  )
  const rawIconHref = (iconMatch?.[1] || iconMatch?.[2] || '').trim()
  let icon = ''
  if (rawIconHref) {
    try {
      const resolved = new URL(rawIconHref, baseUrl)
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
        icon = resolved.toString().slice(0, 500)
      }
    } catch {
      icon = ''
    }
  }

  return { title, description, icon }
}

export async function fetchUrlMetadata(
  rawUrl: string,
  selfHostname?: string
): Promise<{ title: string; description: string; icon: string; warning?: string }> {
  assertSafePublicUrl(rawUrl, selfHostname)

  try {
    const { response, finalUrl } = await fetchWithSafeRedirects(rawUrl, {
      selfHostname,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
      timeoutMs: 5000,
      maxRedirects: 3,
    })

    if (!response.ok) {
      return { title: '', description: '', icon: '', warning: `目标站点返回 HTTP ${response.status}，请手动填写` }
    }

    const ct = response.headers.get('Content-Type') || ''
    if (!ct.includes('text/html') && !ct.includes('application/xhtml+xml')) {
      return { title: '', description: '', icon: '', warning: '目标地址不是 HTML 网页，请手动填写' }
    }

    const reader = response.body?.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    const MAX_BYTES = 64 * 1024

    if (reader) {
      while (totalBytes < MAX_BYTES) {
        const { done, value } = await reader.read()
        if (done || !value) break
        const slice = totalBytes + value.byteLength > MAX_BYTES ? value.subarray(0, MAX_BYTES - totalBytes) : value
        chunks.push(slice)
        totalBytes += slice.byteLength
        const probe = new TextDecoder('latin1').decode(slice)
        if (/<\/head>/i.test(probe)) break
      }
      reader.cancel().catch(() => {})
    }

    const merged = new Uint8Array(totalBytes)
    let offset = 0
    for (const c of chunks) {
      merged.set(c, offset)
      offset += c.byteLength
    }

    const html = decodeHtmlBytes(merged, ct)
    const meta = extractHtmlMetadata(html, finalUrl)
    if (!meta.title && !meta.description && !meta.icon) {
      return { ...meta, warning: '未能从网页提取到元数据，请手动填写' }
    }
    return meta
  } catch (e: unknown) {
    if (e instanceof Error && (e.message.includes('内网') || e.message.includes('本站') || e.message.includes('仅支持') || e.message.includes('凭据'))) {
      throw e
    }
    return { title: '', description: '', icon: '', warning: '抓取目标网页超时或被拦截，请手动填写' }
  }
}
