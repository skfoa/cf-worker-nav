/**
 * src/client/settings.ts - 系统设置弹窗（站点标题、背景图、分片导入导出与 API Token 管理）
 */
import type { ImportResponse, TokenCreateResponse, TokenItem } from './types'
import { api } from './api'
import { chunkImportGroups, normalizeImportGroups, parseBookmarksHtml } from './bookmarks'
import { $, $$, escapeHtml, formatDateUtc8, openModal, sanitizeCssUrl, sysAlert, sysConfirm, toast } from './dom'
import { reloadData } from './refresh'
import { applyBackground } from './render'
import { navState } from './state'

function renderBgPreview(preview: HTMLElement | null, url: string): void {
  if (!preview) return
  if (!url) {
    preview.innerHTML = '<span class="text-xs text-base-content/30">暂无背景</span>'
    return
  }
  if (!sanitizeCssUrl(url)) {
    preview.innerHTML = '<span class="text-xs text-error">仅支持 http/https URL</span>'
    return
  }
  preview.innerHTML = '<img src="' + escapeHtml(url) + '" class="w-full h-full object-cover">'
  preview.querySelector('img')?.addEventListener('error', () => {
    preview.innerHTML = '<span class="text-xs text-base-content/30">加载失败</span>'
  })
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallback below */
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  document.body.removeChild(ta)
  return copied
}

async function loadTokenList(): Promise<void> {
  const listEl = $('#token-list')
  if (!listEl) return
  listEl.innerHTML = '<div class="text-xs text-base-content/40 py-2">加载中...</div>'
  try {
    const tokens = await api<TokenItem[]>('/api/token/list')
    if (!Array.isArray(tokens) || tokens.length === 0) {
      listEl.innerHTML = '<div class="text-xs text-base-content/40 py-2">暂无只读 API 令牌</div>'
      return
    }
    listEl.innerHTML = tokens
      .map(
        (t) =>
          '<div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-base-content/[0.04]">' +
          '<div class="min-w-0 flex-1">' +
          '<div class="text-xs font-medium truncate">' +
          escapeHtml(t.name) +
          '</div>' +
          '<div class="text-[11px] text-base-content/40">' +
          formatDateUtc8(t.created_at) +
          '</div></div>' +
          '<button type="button" class="btn btn-ghost btn-xs text-error/70 btn-del-token" data-token-id="' +
          t.id +
          '" data-token-name="' +
          escapeHtml(t.name) +
          '">🗑️</button>' +
          '</div>'
      )
      .join('')

    $$<HTMLButtonElement>('.btn-del-token').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.tokenId || '', 10)
        const name = btn.dataset.tokenName || ''
        sysConfirm('确定吊销令牌「' + name + '」？使用该令牌的客户端将立即失效。', async () => {
          try {
            await api('/api/token/delete', { method: 'POST', body: JSON.stringify({ id }) })
            toast('令牌已吊销', 'success')
            void loadTokenList()
          } catch (err) {
            toast('吊销失败: ' + (err as Error).message, 'error')
          }
        })
      })
    })
  } catch (err) {
    listEl.innerHTML = '<div class="text-xs text-error py-2">' + escapeHtml((err as Error).message) + '</div>'
  }
}

export function showSettings(): void {
  const currentTitle = navState.config?.title ?? document.title ?? ''
  const currentBg = navState.config?.bg_image ?? navState.config?.BG_IMAGE ?? ''

  openModal(
    '⚙️ 设置',
    '<div class="flex flex-col gap-4">' +
      '<div class="flex flex-col gap-2">' +
      '<h3 class="text-sm font-semibold text-base-content/70">🏷️ 站点标题</h3>' +
      '<div class="flex gap-2">' +
      '<input type="text" id="site-title-input" maxlength="100" class="input input-bordered input-sm flex-1" placeholder="输入站点名称" value="' +
      escapeHtml(currentTitle) +
      '">' +
      '<button type="button" id="btn-title-save" class="btn btn-primary btn-sm shrink-0">保存</button>' +
      '</div></div>' +
      '<div class="divider my-0"></div>' +
      '<div class="flex flex-col gap-2">' +
      '<h3 class="text-sm font-semibold text-base-content/70">🖼️ 背景图片</h3>' +
      '<input type="text" id="bg-input" class="input input-bordered input-sm w-full" placeholder="输入图片 URL（留空使用纯色）" value="' +
      escapeHtml(currentBg) +
      '">' +
      '<div id="bg-preview" class="rounded-xl overflow-hidden h-24 bg-base-content/5 flex items-center justify-center"></div>' +
      '<div class="flex gap-2">' +
      '<button type="button" id="btn-bg-preview" class="btn btn-outline btn-xs flex-1">预览</button>' +
      '<button type="button" id="btn-bg-save" class="btn btn-primary btn-xs flex-1">保存背景</button>' +
      '<button type="button" id="btn-bg-clear" class="btn btn-ghost btn-xs">清除</button>' +
      '</div></div>' +
      '<div class="divider my-0"></div>' +
      '<div class="flex flex-col gap-2">' +
      '<h3 class="text-sm font-semibold text-base-content/70">📦 数据管理</h3>' +
      '<p class="text-[11px] text-base-content/40">支持 JSON 备份或 Chrome/Edge 导出的 HTML 书签文件（自动分片上传）</p>' +
      '<div class="flex gap-2">' +
      '<button type="button" class="btn btn-outline btn-sm flex-1" id="btn-import">📥 导入 JSON / HTML</button>' +
      '<button type="button" class="btn btn-outline btn-sm flex-1" id="btn-export">📤 导出 JSON</button>' +
      '</div></div>' +
      '<div class="divider my-0"></div>' +
      '<div class="flex flex-col gap-2">' +
      '<h3 class="text-sm font-semibold text-base-content/70">🔑 只读 API 令牌</h3>' +
      '<p class="text-[11px] text-base-content/40">用于外部工具通过 Authorization: Bearer 读取书签（仅限读取，无法修改数据）</p>' +
      '<form id="token-create-form" class="flex gap-2">' +
      '<input type="text" id="token-name-input" maxlength="100" required class="input input-bordered input-sm flex-1" placeholder="令牌备注名（如 Raycast）">' +
      '<button type="submit" class="btn btn-outline btn-sm shrink-0">+ 生成</button>' +
      '</form>' +
      '<div id="token-once-box" class="hidden p-2.5 rounded-xl bg-primary/10 border border-primary/30 flex flex-col gap-1.5">' +
      '<div class="text-xs text-primary font-medium">新令牌已创建，请立即复制（关闭后不再显示明文）：</div>' +
      '<div class="flex gap-2">' +
      '<input type="text" id="token-once-val" readonly class="input input-bordered input-xs flex-1 font-mono">' +
      '<button type="button" id="btn-copy-token" class="btn btn-primary btn-xs shrink-0">复制</button>' +
      '</div></div>' +
      '<div id="token-list" class="flex flex-col gap-1.5 max-h-40 overflow-y-auto"></div>' +
      '</div></div>'
  )

  renderBgPreview($('#bg-preview'), currentBg)
  void loadTokenList()

  $('#btn-title-save')?.addEventListener('click', async () => {
    const title = $<HTMLInputElement>('#site-title-input')?.value?.trim() || ''
    if (!title) {
      toast('站点标题不能为空', 'error')
      return
    }
    try {
      await api('/api/config', { method: 'POST', body: JSON.stringify({ key: 'title', value: title }) })
      document.title = title
      navState.config.title = title
      toast('站点标题已保存', 'success')
    } catch (err) {
      toast('保存失败: ' + (err as Error).message, 'error')
    }
  })

  $('#btn-bg-preview')?.addEventListener('click', () => {
    const url = $<HTMLInputElement>('#bg-input')?.value?.trim() || ''
    renderBgPreview($('#bg-preview'), url)
  })

  $('#btn-bg-save')?.addEventListener('click', async () => {
    const url = $<HTMLInputElement>('#bg-input')?.value?.trim() || ''
    try {
      await api('/api/config', { method: 'POST', body: JSON.stringify({ key: 'bg_image', value: url }) })
      toast('背景已保存，刷新生效', 'success')
      applyBackground(url)
      navState.config.bg_image = url
    } catch (err) {
      toast('保存失败: ' + (err as Error).message, 'error')
    }
  })

  $('#btn-bg-clear')?.addEventListener('click', () => {
    const inp = $<HTMLInputElement>('#bg-input')
    if (inp) inp.value = ''
    renderBgPreview($('#bg-preview'), '')
  })

  $<HTMLFormElement>('#token-create-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const inp = $<HTMLInputElement>('#token-name-input')
    const name = inp?.value?.trim() || ''
    if (!name) return
    try {
      const res = await api<TokenCreateResponse>('/api/token/create', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      if (inp) inp.value = ''
      const box = $('#token-once-box')
      const valInput = $<HTMLInputElement>('#token-once-val')
      if (box && valInput) {
        valInput.value = res.token
        box.classList.remove('hidden')
      }
      toast('令牌已生成', 'success')
      void loadTokenList()
    } catch (err) {
      toast('生成失败: ' + (err as Error).message, 'error')
    }
  })

  $('#btn-copy-token')?.addEventListener('click', async () => {
    const token = $<HTMLInputElement>('#token-once-val')?.value || ''
    if (!token) return
    const ok = await copyText(token)
    toast(ok ? '令牌已复制到剪贴板' : '请手动选中输入框复制', ok ? 'success' : 'info')
  })

  $<HTMLButtonElement>('#btn-export')?.addEventListener('click', async function () {
    const btn = this
    btn.disabled = true
    btn.textContent = '⏳ 导出中...'
    try {
      const data = await api('/api/export')
      const jsonStr = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateStr = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = 'nav-backup-' + dateStr + '.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast('数据全量备份导出成功', 'success')
    } catch (err) {
      toast('导出失败: ' + ((err as Error).message || '网络错误'), 'error')
    } finally {
      btn.disabled = false
      btn.textContent = '📤 导出 JSON'
    }
  })

  $<HTMLButtonElement>('#btn-import')?.addEventListener('click', function () {
    const importBtn = this
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.html,.htm'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      importBtn.disabled = true
      importBtn.textContent = '⏳ 解析中...'
      try {
        const text = await file.text()
        const isHtml = /\.html?$/i.test(file.name) || text.trimStart().startsWith('<')
        let groups
        let nonHttpCount = 0
        if (isHtml) {
          const parsed = parseBookmarksHtml(text)
          groups = parsed.groups
          nonHttpCount = parsed.skippedNonHttp
        } else {
          let json: unknown
          try {
            json = JSON.parse(text)
          } catch {
            throw new Error('JSON 文件格式无效')
          }
          groups = normalizeImportGroups(json)
        }

        const chunks = chunkImportGroups(groups)
        if (chunks.length === 0) {
          toast('未解析到可导入的分类或链接', 'info')
          return
        }

        let totalAdded = 0
        let totalCatsAdded = 0
        let totalSkipped = nonHttpCount
        const skippedUrls: string[] = []

        for (let i = 0; i < chunks.length; i++) {
          importBtn.textContent = `⏳ 导入 (${i + 1}/${chunks.length})...`
          const res = await api<ImportResponse>('/api/import', {
            method: 'POST',
            body: JSON.stringify(chunks[i]),
          })
          totalAdded += res.count || 0
          totalCatsAdded += res.categories_added || 0
          totalSkipped += res.skipped_count || 0
          if (res.skipped_urls?.length) skippedUrls.push(...res.skipped_urls)
        }

        let msg = '导入完成：新增 ' + totalAdded + ' 条链接'
        if (totalCatsAdded > 0) msg += '，创建 ' + totalCatsAdded + ' 个新分类'
        toast(msg, 'success')
        if (skippedUrls.length > 0 || nonHttpCount > 0) {
          const listStr =
            skippedUrls.slice(0, 10).join('\n') +
            (skippedUrls.length > 10 ? '\n...等共 ' + skippedUrls.length + ' 条' : '')
          const nonHttpNote = nonHttpCount > 0 ? `另已跳过 ${nonHttpCount} 条非 http/https 书签。\n\n` : ''
          sysAlert('提示：共有 ' + totalSkipped + ' 条数据未导入（URL 无效或已存在）。\n\n' + nonHttpNote + listStr)
        }
        await reloadData()
      } catch (err) {
        toast('导入失败: ' + (err as Error).message, 'error')
      } finally {
        importBtn.disabled = false
        importBtn.textContent = '📥 导入 JSON / HTML'
      }
    }
    input.click()
  })
}
