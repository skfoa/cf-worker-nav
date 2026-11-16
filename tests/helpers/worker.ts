import fs from 'node:fs'
import path from 'node:path'
import esbuild from 'esbuild'
import { createFetchMock, Miniflare } from 'miniflare'

let cachedBundle: string | null = null

export function buildWorkerBundle(): string {
  if (cachedBundle) return cachedBundle
  const res = esbuild.buildSync({
    entryPoints: [path.resolve('src/index.tsx')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    jsxImportSource: 'hono/jsx',
  })
  cachedBundle = res.outputFiles[0].text
  return cachedBundle
}

export async function applyInitSchema(db: D1Database): Promise<void> {
  const initSql = fs.readFileSync(path.resolve('migrations/0001_init.sql'), 'utf8')
  const cleanSql = initSql.replace(/--.*$/gm, '')
  let buf = ''
  let inBegin = false
  for (const line of cleanSql.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    if (/^BEGIN$/i.test(t)) inBegin = true
    buf += (buf ? ' ' : '') + t
    if (inBegin && /^END;$/i.test(t)) {
      inBegin = false
      await db.exec(buf)
      buf = ''
    } else if (!inBegin && t.endsWith(';')) {
      await db.exec(buf)
      buf = ''
    }
  }
}

export async function createTestWorker(extraBindings: Record<string, string> = {}) {
  const script = buildWorkerBundle()
  const fetchMock = createFetchMock()
  fetchMock.disableNetConnect()

  const mf = new Miniflare({
    modules: [{ type: 'ESModule', path: 'index.mjs', contents: script }],
    compatibilityDate: '2024-12-01',
    d1Databases: { DB: 'test-nav-db' },
    fetchMock,
    bindings: {
      PASSWORD: 'test-root-password',
      TOKEN_SALT: 'test-salt-value',
      COOKIE_SECRET: 'test-cookie-secret',
      ...extraBindings,
    },
  })

  const db = await mf.getD1Database('DB')
  await applyInitSchema(db)

  return { mf, db, fetchMock }
}

