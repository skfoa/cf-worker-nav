import { describe, expect, it } from 'vitest'
import nodeCrypto from 'node:crypto'
import { signSession, verifySession } from '../../src/utils/session'
import { safeCompare, hashWithSalt } from '../../src/utils/security'
import {
  CategoryCreateSchema,
  CategoryUpdateSchema,
  ConfigUpdateSchema,
  IdSchema,
  TokenCreateSchema,
} from '../../src/types'
import { Layout } from '../../src/components/Layout'
import { LinkCard } from '../../src/components/LinkCard'
import { LinkGrid } from '../../src/components/LinkGrid'

if (!globalThis.crypto?.subtle?.timingSafeEqual) {
  Object.defineProperty(globalThis.crypto.subtle, 'timingSafeEqual', {
    value: (a: ArrayBuffer, b: ArrayBuffer) => nodeCrypto.timingSafeEqual(new Uint8Array(a), new Uint8Array(b)),
    configurable: true,
  })
}

describe('Security helpers & Zod schemas', () => {
  it('signs and verifies sessions using constant-time verification', async () => {
    const token = await signSession('root', 'sec-123')
    expect(await verifySession(token, 'sec-123')).toBe('root')
    expect(await verifySession(token, 'wrong-sec')).toBeNull()
    expect(await verifySession('tampered.' + token.split('.')[1], 'sec-123')).toBeNull()
    expect(await verifySession('', 'sec-123')).toBeNull()
  })

  it('compares secrets safely and hashes with salt', async () => {
    expect(await safeCompare('abc', 'abc')).toBe(true)
    expect(await safeCompare('abc', 'abcd')).toBe(false)
    expect(await safeCompare('', '')).toBe(false)
    const h1 = await hashWithSalt('tok', 'saltA')
    const h2 = await hashWithSalt('tok', 'saltB')
    expect(h1).toHaveLength(64)
    expect(h1).not.toBe(h2)
  })

  it('validates Category, Config, Id, and Token schemas', () => {
    expect(CategoryCreateSchema.safeParse({ title: 'Tools', is_private: 0 }).success).toBe(true)
    expect(CategoryUpdateSchema.safeParse({ id: 2, parent_id: 2 }).success).toBe(false)
    expect(ConfigUpdateSchema.safeParse({ key: 'bg_image', value: '' }).success).toBe(true)
    expect(ConfigUpdateSchema.safeParse({ key: 'bg_image', value: 'javascript:alert(1)' }).success).toBe(false)
    expect(ConfigUpdateSchema.safeParse({ key: 'bg_image', value: "https://a.com/x(1)'y.png" }).success).toBe(true)
    expect(TokenCreateSchema.safeParse({ name: '   ' }).success).toBe(false)
    expect(TokenCreateSchema.safeParse({ name: ' Raycast ' }).data?.name).toBe('Raycast')
    expect(IdSchema.safeParse({ id: 0 }).success).toBe(false)
    expect(IdSchema.safeParse({ id: 1 }).success).toBe(true)
  })
})

describe('SSR JSX components', () => {
  it('sanitizes bg_image CSS url and blocks non-http protocols in Layout', () => {
    const okHtml = String(Layout({ title: 'Nav', bgImage: "https://img.example.com/a(1)'b c.jpg", children: 'body' }))
    expect(okHtml).toContain("background-image: url(&#39;https://img.example.com/a%281%29%27b%20c.jpg&#39;)")

    const badHtml = String(Layout({ title: 'Nav', bgImage: "javascript:alert('xss')", children: 'body' }))
    expect(badHtml).not.toContain('bg-image-layer')
    expect(badHtml).toContain('bg-base-300')
  })

  it('renders LinkCard without inline onerror attribute while preserving DOM fallback attributes', () => {
    const html = String(
      LinkCard({
        link: {
          id: 1,
          category_id: 2,
          title: '<Bad&"Title\'>',
          url: 'https://example.com',
          description: '',
          icon: 'https://cdn.example.com/logo.png',
          sort_order: 0,
          is_private: 0,
          visits: 0,
          created_at: 1,
          updated_at: 1,
        },
        isAdmin: false,
        lazy: false,
      })
    )
    expect(html).not.toContain('onerror=')
    expect(html).toContain('data-title="&lt;Bad&amp;&quot;Title&#39;&gt;"')
    expect(html).toContain('data-original-icon="https://cdn.example.com/logo.png"')
  })

  it('renders empty state marker for parent category even when children exist in LinkGrid', () => {
    const html = String(
      LinkGrid({
        categories: [
          {
            id: 2,
            title: 'Parent',
            sort_order: 0,
            is_private: 0,
            created_at: 1,
            updated_at: 1,
            items: [],
            children: [
              {
                id: 3,
                title: 'Child',
                sort_order: 1,
                is_private: 0,
                parent_id: 2,
                created_at: 1,
                updated_at: 1,
                items: [
                  {
                    id: 10,
                    category_id: 3,
                    title: 'A',
                    url: 'https://a.example.com',
                    description: '',
                    icon: '',
                    sort_order: 0,
                    is_private: 0,
                    visits: 0,
                    created_at: 1,
                    updated_at: 1,
                  },
                ],
              },
            ],
          },
        ],
        isAdmin: false,
      })
    )
    expect(html).toContain('grid-empty-msg" data-sub-id="2"')
  })
})

