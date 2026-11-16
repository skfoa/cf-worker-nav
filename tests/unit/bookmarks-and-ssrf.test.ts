import { afterEach, describe, expect, it } from 'vitest'
import { chunkImportGroups, normalizeImportGroups, parseBookmarksHtml } from '../../src/client/bookmarks'
import { ConfigUpdateSchema, IconPurgeSchema, LinkBatchSchema, LinkMetaSchema } from '../../src/types'
import { assertSafePublicUrl, extractHtmlMetadata, fetchUrlMetadata, isPrivateOrReservedHostname } from '../../src/utils/ssrf'

const origDOMParser = (globalThis as Record<string, unknown>).DOMParser
const origFetch = globalThis.fetch

afterEach(() => {
  ;(globalThis as Record<string, unknown>).DOMParser = origDOMParser
  globalThis.fetch = origFetch
})

describe('SSRF protection & HTML metadata extraction', () => {
  it('blocks loopback, private, link-local, numeric IP, credentials, and self hostname', () => {
    for (const host of [
      'localhost',
      'sub.localhost',
      'redis.internal',
      'printer.local',
      'singlelabel',
      '127.0.0.1',
      '10.2.3.4',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '2130706433',
      '0x7f000001',
      '0177.0.0.1',
      '[::1]',
      '[fc00::1]',
      '[fd12:3456::1]',
      '[fe80::1]',
      '[::ffff:127.0.0.1]',
      '[::ffff:7f00:1]',
    ]) {
      expect(isPrivateOrReservedHostname(host), `expected blocked: ${host}`).toBe(true)
    }

    expect(isPrivateOrReservedHostname('github.com')).toBe(false)
    expect(isPrivateOrReservedHostname('1.1.1.1')).toBe(false)
    expect(() => assertSafePublicUrl('https://user:pass@github.com/')).toThrow(/凭据/)
    expect(() => assertSafePublicUrl('https://123.pixel5.de5.net/page', '123.pixel5.de5.net')).toThrow(/本站/)
    expect(() => assertSafePublicUrl('ftp://github.com/file')).toThrow(/http/)
  })

  it('extracts title, description, and safe icon URL regardless of meta attribute order', () => {
    const html = `
      <!doctype html><html><head>
        <title>Fallback Title &amp; Docs &#99999999;</title>
        <meta content="OpenGraph &quot;Title&quot;" property="og:title">
        <meta content="Fast edge platform &#39;summary&#39;" name="description">
        <link href="/assets/apple-icon.png" rel="apple-touch-icon">
      </head></html>
    `
    const meta = extractHtmlMetadata(html, 'https://docs.example.com/guide/intro')
    expect(meta.title).toBe('OpenGraph "Title"')
    expect(meta.description).toBe("Fast edge platform 'summary'")
    expect(meta.icon).toBe('https://docs.example.com/assets/apple-icon.png')

    const badIconHtml = `<head><title>Test</title><link rel="icon" href="javascript:alert(1)"></head>`
    const badMeta = extractHtmlMetadata(badIconHtml, 'https://docs.example.com/')
    expect(badMeta.title).toBe('Test')
    expect(badMeta.icon).toBe('')
  })

  it('validates new Zod schemas for config title, link meta, link batch, and icon purge', () => {
    expect(ConfigUpdateSchema.safeParse({ key: 'title', value: '   ' }).success).toBe(false)
    expect(ConfigUpdateSchema.safeParse({ key: 'title', value: 'My Nav' }).success).toBe(true)
    expect(LinkMetaSchema.safeParse({ url: 'javascript:alert(1)' }).success).toBe(false)
    expect(LinkMetaSchema.safeParse({ url: 'https://example.com' }).success).toBe(true)
    expect(LinkBatchSchema.safeParse({ action: 'move', ids: [], category_id: 1 }).success).toBe(false)
    expect(LinkBatchSchema.safeParse({ action: 'privacy', ids: [1, 2], is_private: 1 }).success).toBe(true)
    expect(IconPurgeSchema.safeParse({}).success).toBe(false)
    expect(IconPurgeSchema.safeParse({ url: 'https://cdn.example.com/logo.png' }).success).toBe(true)
  })

  it('blocks 302 redirects to private IPs before following and follows safe public redirects with GBK decoding', async () => {
    const calledUrls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const u = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      calledUrls.push(u)
      if (u === 'https://redir.example.com/go') {
        return new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1:8080/secret' } })
      }
      throw new Error('unexpected fetch: ' + u)
    }) as typeof fetch

    await expect(fetchUrlMetadata('https://redir.example.com/go', '123.pixel5.de5.net')).rejects.toThrow(/内网/)
    expect(calledUrls).toEqual(['https://redir.example.com/go'])

    // 安全公网 301 重定向 + 相对图标解析
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const u = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (u === 'https://short.example.com/a') {
        return new Response(null, { status: 301, headers: { Location: 'https://final.example.com/home' } })
      }
      return new Response(
        '<html><head><title>Final Page</title><meta name="description" content="Loaded"><link rel="icon" href="/icon.svg"></head></html>',
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }) as typeof fetch

    const ok = await fetchUrlMetadata('https://short.example.com/a', '123.pixel5.de5.net')
    expect(ok.title).toBe('Final Page')
    expect(ok.description).toBe('Loaded')
    expect(ok.icon).toBe('https://final.example.com/icon.svg')
  })
})

describe('Bookmark import chunking & HTML parser', () => {
  it('chunks large import lists strictly under maxBytes and keeps parent categories ahead of children', () => {
    const groups = normalizeImportGroups([
      {
        category: 'Sub',
        parent_category: 'Parent',
        items: Array.from({ length: 120 }, (_, i) => ({
          title: `Item ${i}`,
          url: `https://example.com/path/${i}?q=${'x'.repeat(250)}`,
        })),
      },
      { category: 'Parent', items: [] },
    ])

    const chunks = chunkImportGroups(groups, 12 * 1024, 50)
    expect(chunks.length).toBeGreaterThan(2)

    const enc = new TextEncoder()
    for (const chunk of chunks) {
      expect(enc.encode(JSON.stringify(chunk)).byteLength).toBeLessThanOrEqual(12 * 1024)
    }

    // 首个分片必须先声明父分类 Parent，再出现引用它的 Sub
    const firstChunk = chunks[0]
    const parentIdx = firstChunk.findIndex((g) => g.category === 'Parent' && !g.parent_category)
    const subIdx = firstChunk.findIndex((g) => g.category === 'Sub' && g.parent_category === 'Parent')
    expect(parentIdx).toBeGreaterThanOrEqual(0)
    expect(subIdx).toBeGreaterThan(parentIdx)
  })

  interface NodeStub {
    tagName: string
    textContent: string
    children: NodeStub[]
    getAttribute(k: string): string | null
    querySelector(sel: string): NodeStub | null
  }

  const el = (tag: string, text = '', attrs: Record<string, string> = {}, children: NodeStub[] = []): NodeStub => ({
    tagName: tag.toUpperCase(),
    textContent: text,
    children,
    getAttribute: (k) => attrs[k.toLowerCase()] ?? null,
    querySelector: (sel) => (sel === 'dl' ? (children.find((c) => c.tagName === 'DL') ?? null) : null),
  })

  const mockDomTree = (tree: NodeStub): void => {
    ;(globalThis as Record<string, unknown>).DOMParser = class {
      parseFromString() {
        return tree
      }
    }
  }

  it('parses nested bookmark DOM structure, skips non-http URLs, and disambiguates duplicate child names', () => {
    const rootTree = el('body', '', {}, [
      el('dl', '', {}, [
        el('dt', '', {}, [
          el('h3', 'Work'),
          el('dl', '', {}, [
            el('dt', '', {}, [
              el('h3', 'Tools'),
              el('dl', '', {}, [
                el('dt', '', {}, [el('a', 'GitHub', { href: 'https://github.com', icon: 'data:image/png;base64,AAA' })]),
                el('dt', '', {}, [el('a', 'Settings', { href: 'chrome://settings' })]),
              ]),
            ]),
          ]),
        ]),
        el('dt', '', {}, [
          el('h3', 'Life'),
          el('dl', '', {}, [
            el('dt', '', {}, [
              el('h3', 'Tools'),
              el('dl', '', {}, [
                el('dt', '', {}, [el('a', 'Maps', { href: 'https://maps.example.com' })]),
              ]),
            ]),
          ]),
        ]),
      ]),
    ])

    mockDomTree(rootTree)

    const parsed = parseBookmarksHtml('<DL></DL>')
    expect(parsed.skippedNonHttp).toBe(1)
    const workTools = parsed.groups.find((g) => g.parent_category === 'Work' && g.items.some((i) => i.url === 'https://github.com'))
    const lifeTools = parsed.groups.find((g) => g.parent_category === 'Life' && g.items.some((i) => i.url === 'https://maps.example.com'))
    expect(workTools?.category).toBe('Tools')
    expect(lifeTools?.category).toBe('Life / Tools')
    expect(workTools?.items[0].icon).toBeUndefined()
  })

  it('disambiguates child folders even when a same-named top-level folder appears later in HTML', () => {
    const rootTree = el('body', '', {}, [
      el('dl', '', {}, [
        el('dt', '', {}, [
          el('h3', 'Work'),
          el('dl', '', {}, [
            el('dt', '', {}, [
              el('h3', 'Tools'),
              el('dl', '', {}, [
                el('dt', '', {}, [el('a', 'CLI', { href: 'https://cli.example.com' })]),
              ]),
            ]),
          ]),
        ]),
        el('dt', '', {}, [
          el('h3', 'Work / Tools'),
          el('dl', '', {}, [
            el('dt', '', {}, [el('a', 'Collision Top', { href: 'https://collision.example.com' })]),
          ]),
        ]),
        el('dt', '', {}, [
          el('h3', 'Tools'),
          el('dl', '', {}, [
            el('dt', '', {}, [el('a', 'Top Tools', { href: 'https://top-tools.example.com' })]),
          ]),
        ]),
      ]),
    ])

    mockDomTree(rootTree)

    const parsed = parseBookmarksHtml('<DL></DL>')
    const topTools = parsed.groups.find((g) => !g.parent_category && g.items.some((i) => i.url === 'https://top-tools.example.com'))
    const collisionTop = parsed.groups.find((g) => !g.parent_category && g.items.some((i) => i.url === 'https://collision.example.com'))
    const childTools = parsed.groups.find((g) => g.parent_category === 'Work' && g.items.some((i) => i.url === 'https://cli.example.com'))

    expect(topTools?.category).toBe('Tools')
    expect(collisionTop?.category).toBe('Work / Tools')
    expect(childTools?.category).toBe('Work / Tools (2)')
  })
})
