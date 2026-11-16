import fs from 'node:fs'
import vm from 'node:vm'
import { afterEach, describe, expect, it } from 'vitest'
import { escapeHtml, sanitizeCssUrl } from '../../src/client/dom'
import { applyImageFallback, buildLetterAvatarDataUrl, initImageErrorFallback } from '../../src/client/icons'

const origWindow = (globalThis as Record<string, unknown>).window
const origDocument = (globalThis as Record<string, unknown>).document
const origHTMLImageElement = (globalThis as Record<string, unknown>).HTMLImageElement

afterEach(() => {
  ;(globalThis as Record<string, unknown>).window = origWindow
  ;(globalThis as Record<string, unknown>).document = origDocument
  ;(globalThis as Record<string, unknown>).HTMLImageElement = origHTMLImageElement
})

describe('Client DOM & Icon fallback', () => {
  it('escapes HTML and sanitizes CSS background URLs', () => {
    ;(globalThis as Record<string, unknown>).window = { location: { origin: 'https://nav.test' } }
    expect(escapeHtml(`<a "'&>`)).toBe('&lt;a &quot;&#039;&amp;&gt;')
    expect(sanitizeCssUrl("https://a.com/x(1)'y z.jpg")).toBe('https://a.com/x%281%29%27y%20z.jpg')
    expect(sanitizeCssUrl('javascript:alert(1)')).toBe('')
  })

  it('builds safe letter avatar SVG and respects data-original-icon before SVG fallback', () => {
    const svgUrl = buildLetterAvatarDataUrl('<Bad&Title>')
    const decoded = decodeURIComponent(svgUrl.replace('data:image/svg+xml,', ''))
    expect(decoded).toContain('>&lt;</text></svg>')

    const attrs = new Map<string, string>([['data-original-icon', 'https://direct.example.com/icon.png']])
    const img = {
      src: '/api/icon?url=x',
      dataset: {} as Record<string, string>,
      getAttribute: (k: string) => attrs.get(k) ?? null,
      removeAttribute: (k: string) => {
        attrs.delete(k)
      },
      closest: () => ({ getAttribute: () => '<Bad&Title>' }),
    } as unknown as HTMLImageElement

    applyImageFallback(img)
    expect(img.src).toBe('https://direct.example.com/icon.png')

    applyImageFallback(img)
    expect(img.src.startsWith('data:image/svg+xml,')).toBe(true)
    expect(decodeURIComponent(img.src)).toContain('>&lt;</text></svg>')
  })

  it('repairs early-failed SSR images during initImageErrorFallback without touching lazy placeholders', () => {
    class MockImage {
      src = ''
      complete = true
      naturalWidth = 0
      dataset: Record<string, string> = {}
      private attrs = new Map<string, string>()
      private cardTitle: string
      constructor(title: string, lazy = false) {
        this.cardTitle = title
        if (lazy) this.attrs.set('data-src', '/api/icon?domain=lazy.com')
      }
      getAttribute(k: string) {
        return this.attrs.get(k) ?? null
      }
      removeAttribute(k: string) {
        this.attrs.delete(k)
      }
      closest() {
        return { getAttribute: () => this.cardTitle }
      }
    }

    const failedSsrImg = new MockImage('GitHub', false)
    const lazyImg = new MockImage('LazySite', true)
    let captureListener: ((e: { target: unknown }) => void) | null = null

    ;(globalThis as Record<string, unknown>).HTMLImageElement = MockImage
    ;(globalThis as Record<string, unknown>).document = {
      addEventListener: (_type: string, fn: (e: { target: unknown }) => void, useCapture?: boolean) => {
        if (useCapture) captureListener = fn
      },
      querySelectorAll: (sel: string) => (sel === '.link-card img:not([data-src])' ? [failedSsrImg] : [failedSsrImg, lazyImg]),
    }

    initImageErrorFallback()
    expect(failedSsrImg.src.startsWith('data:image/svg+xml,')).toBe(true)
    expect(decodeURIComponent(failedSsrImg.src)).toContain('>G</text>')
    expect(lazyImg.src).toBe('')
    expect(captureListener).not.toBeNull()
  })

  it('executes compiled public/client.min.js cleanly in a minimal DOM sandbox', () => {
    const bundle = fs.readFileSync('public/client.min.js', 'utf8')
    const mkEl = () => ({
      innerHTML: '',
      className: '',
      textContent: '',
      style: {},
      dataset: {},
      value: '',
      open: false,
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild() {},
      remove() {},
      addEventListener() {},
      close() {},
      classList: { toggle() {}, add() {}, remove() {} },
    })
    const sandbox = {
      console,
      URL,
      encodeURIComponent,
      decodeURIComponent,
      JSON,
      Date,
      Math,
      Number,
      String,
      Array,
      parseInt,
      isNaN,
      setTimeout,
      clearTimeout,
      Event: class {},
      navigator: { maxTouchPoints: 0 },
      localStorage: { getItem: () => null, setItem() {} },
      document: {
        documentElement: { setAttribute() {}, getAttribute: () => 'dark' },
        body: { insertBefore() {}, appendChild() {}, firstChild: null, classList: { remove() {}, add() {} } },
        querySelector: () => mkEl(),
        querySelectorAll: () => [],
        getElementById: () => null,
        createElement: () => mkEl(),
        head: { appendChild() {} },
        addEventListener() {},
      },
      window: {
        location: { origin: 'https://nav.test', pathname: '/', search: '', reload() {} },
        __NAV_STATE__: { data: [], config: { title: 'Nav', bg_image: '' }, isRoot: false, isAdmin: false },
      },
      fetch: async () => new Response('{}'),
    }
    expect(() => vm.runInNewContext(bundle, sandbox, { filename: 'public/client.min.js' })).not.toThrow()
  })
})

