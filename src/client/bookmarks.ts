/**
 * src/client/bookmarks.ts - 浏览器 HTML 书签解析与安全分片导入构造器
 */
import type { ImportGroup, ImportLinkItem } from './types'

function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function getDirectDl(dt: Element): Element | null {
  for (const child of Array.from(dt.children)) {
    if (child.tagName === 'DL') return child
  }
  return null
}

function getDirectHeading(dt: Element): string {
  for (const child of Array.from(dt.children)) {
    if (child.tagName === 'H3') return (child.textContent || '').trim()
  }
  return ''
}

function getDirectAnchor(dt: Element): HTMLAnchorElement | null {
  for (const child of Array.from(dt.children)) {
    if (child.tagName === 'A') return child as HTMLAnchorElement
  }
  return null
}

/**
 * 解析 Netscape Bookmarks HTML（Chrome / Edge / Firefox 导出格式）
 * - 自动忽略大体积 ICON="data:..." 内联图片，避免超过 50KB 接口限制
 * - 超过两级的深层目录扁平映射到二级分类，并对不同父分类下同名子目录自动消歧
 */
export function parseBookmarksHtml(html: string): { groups: ImportGroup[]; skippedNonHttp: number } {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const groupsByKey = new Map<string, ImportGroup>()
  const topNames = new Set<string>()
  const pendingChildren: Array<{ group: ImportGroup; parentName: string; rawChild: string }> = []
  let skippedNonHttp = 0

  function ensureTopGroup(topName: string): ImportGroup {
    const key = '\0' + topName
    let group = groupsByKey.get(key)
    if (!group) {
      topNames.add(topName)
      group = { category: topName, is_private: 0, items: [] }
      groupsByKey.set(key, group)
    }
    return group
  }

  function ensureChildGroup(parentName: string, rawChild: string): ImportGroup {
    ensureTopGroup(parentName)
    const key = parentName + '\0' + rawChild
    let group = groupsByKey.get(key)
    if (!group) {
      group = { category: rawChild, parent_category: parentName, is_private: 0, items: [] }
      groupsByKey.set(key, group)
      pendingChildren.push({ group, parentName, rawChild })
    }
    return group
  }

  function resolveTargetGroup(path: string[]): ImportGroup {
    if (path.length === 0) {
      return ensureTopGroup('书签栏')
    }
    if (path.length === 1) {
      return ensureTopGroup(path[0].slice(0, 100) || '书签栏')
    }
    const parentName = path[0].slice(0, 100) || '书签栏'
    const rawChild = path.slice(1).map((s) => s || '未命名').join(' / ').slice(0, 100) || '未命名'
    return ensureChildGroup(parentName, rawChild)
  }

  function walkDl(dl: Element, path: string[]): void {
    const children = Array.from(dl.children)
    for (let i = 0; i < children.length; i++) {
      const node = children[i]
      // 标准格式：<DT><H3>...</H3><DL>...</DL></DT> 或 <DT><H3>...</H3></DT><DL>...</DL>
      if (node.tagName === 'DT') {
        const heading = getDirectHeading(node)
        const nestedDl = getDirectDl(node) || (children[i + 1]?.tagName === 'DL' ? children[i + 1] : null)
        if (heading && nestedDl) {
          walkDl(nestedDl, [...path, heading])
          if (nestedDl === children[i + 1]) i++
          continue
        }
        const anchor = getDirectAnchor(node)
        if (anchor) {
          const url = (anchor.getAttribute('href') || '').trim()
          if (!isHttpUrl(url)) {
            skippedNonHttp++
            continue
          }
          const title = (anchor.textContent || '').trim().slice(0, 200) || url.slice(0, 200)
          resolveTargetGroup(path).items.push({ title, url })
          continue
        }
        if (nestedDl) {
          walkDl(nestedDl, path)
          if (nestedDl === children[i + 1]) i++
        }
      } else if (node.tagName === 'DL') {
        walkDl(node, path)
      }
    }
  }

  const rootDl = doc.querySelector('dl')
  if (!rootDl) {
    throw new Error('未检测到有效的浏览器书签 HTML 结构')
  }
  walkDl(rootDl, [])

  // 等整棵书签树扫描完毕后再统一消歧子目录名称，避免后出现的同名顶级目录被误并
  const usedNames = new Set<string>(topNames)
  for (const { group, parentName, rawChild } of pendingChildren) {
    let finalName = rawChild
    if (usedNames.has(finalName)) {
      finalName = (parentName + ' / ' + rawChild).slice(0, 100)
    }
    if (usedNames.has(finalName)) {
      const base = finalName
      let seq = 2
      while (usedNames.has(finalName)) {
        const suffix = ` (${seq++})`
        finalName = base.slice(0, Math.max(1, 100 - suffix.length)) + suffix
      }
    }
    usedNames.add(finalName)
    group.category = finalName
  }

  const groups = Array.from(groupsByKey.values()).filter(
    (g) => g.items.length > 0 || !g.parent_category
  )
  return { groups, skippedNonHttp }
}

export function normalizeImportGroups(raw: unknown): ImportGroup[] {
  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)
      ? ((raw as { data: unknown[] }).data)
      : null
  if (!arr) {
    throw new Error('导入格式无效：根节点或 data 字段必须为数组')
  }
  return arr
    .filter((g): g is Record<string, unknown> => Boolean(g && typeof g === 'object'))
    .map((g) => ({
      category: String(g.category || g.title || '').trim(),
      ...(g.parent_category ? { parent_category: String(g.parent_category).trim() } : {}),
      is_private: g.is_private ? 1 : 0,
      items: Array.isArray(g.items) ? (g.items as ImportLinkItem[]) : [],
    }))
    .filter((g) => g.category.length > 0)
}

/**
 * 将导入组按字节大小与条数切片，确保单次请求严格低于服务端 50KB 限制
 */
export function chunkImportGroups(
  groups: ImportGroup[],
  maxBytes = 36 * 1024,
  maxItemsPerBatch = 100
): ImportGroup[][] {
  if (groups.length === 0) return []
  const encoder = new TextEncoder()
  const byteLen = (val: unknown): number => encoder.encode(JSON.stringify(val)).byteLength

  // 先确保父分类在任意引用它的子分类之前出现，且保留空分类壳
  const ordered = [
    ...groups.filter((g) => !g.parent_category),
    ...groups.filter((g) => Boolean(g.parent_category)),
  ]
  const declaredParents = new Set<string>()
  const chunks: ImportGroup[][] = []
  let currentChunk: ImportGroup[] = []
  let currentCount = 0

  function flush(): void {
    if (currentChunk.length > 0) {
      chunks.push(currentChunk)
      currentChunk = []
      currentCount = 0
    }
  }

  for (const g of ordered) {
    if (!g.parent_category) declaredParents.add(g.category)

    if (g.items.length === 0) {
      const shell: ImportGroup = { ...g, items: [] }
      if (currentChunk.length > 0 && byteLen([...currentChunk, shell]) > maxBytes) {
        flush()
      }
      currentChunk.push(shell)
      continue
    }

    let idx = 0
    while (idx < g.items.length) {
      // 如果跨分片了且是子分类，附带一次父分类占位确保父分类先存在
      const prefix: ImportGroup[] = []
      if (
        g.parent_category &&
        !declaredParents.has(g.parent_category) &&
        !currentChunk.some((c) => c.category === g.parent_category && !c.parent_category)
      ) {
        prefix.push({ category: g.parent_category, is_private: 0, items: [] })
        declaredParents.add(g.parent_category)
      }

      const sliceItems: ImportLinkItem[] = []
      while (idx < g.items.length && currentCount + sliceItems.length < maxItemsPerBatch) {
        const nextItem = g.items[idx]
        const candidateGroup: ImportGroup = { ...g, items: [...sliceItems, nextItem] }
        const candidateChunk = [...currentChunk, ...prefix, candidateGroup]
        if (byteLen(candidateChunk) > maxBytes) {
          if (sliceItems.length === 0 && currentChunk.length === 0) {
            // 极少数单条数据超过上限时仍放行一条交由服务端判定
            sliceItems.push(nextItem)
            idx++
          }
          break
        }
        sliceItems.push(nextItem)
        idx++
      }

      if (sliceItems.length > 0) {
        currentChunk.push(...prefix, { ...g, items: sliceItems })
        currentCount += sliceItems.length
      }

      if (idx < g.items.length || currentCount >= maxItemsPerBatch) {
        flush()
      }
    }
  }

  flush()
  return chunks
}

