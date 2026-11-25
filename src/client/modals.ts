/**
 * src/client/modals.ts - 登录、分类/链接增删改及审计日志弹窗
 */
import type { CategoryWithItems, Link, LinkMetaResponse, LogsResponse } from './types'
import { api } from './api'
import {
  $,
  $$,
  closeAppModal,
  escapeHtml,
  formatDateUtc8,
  getFormFieldValue,
  isFormCheckboxChecked,
  openModal,
  sysConfirm,
  toast,
} from './dom'
import { reloadData } from './refresh'
import { findCatById, navState, runtime } from './state'
import { clearVisitCooldown } from './visit'
import { isLetterIcon, isProxyableIconDomain, LETTER_ICON_TOKEN } from './icons'

export function doLogin(): void {
  openModal(
    '',
    '<form id="login-form" class="flex flex-col items-center gap-5 pt-2">' +
      '<div class="w-14 h-14 rounded-2xl flex items-center justify-center" style="background:linear-gradient(135deg,rgba(99,102,241,.2),rgba(139,92,246,.15));border:1px solid rgba(99,102,241,.2)"><svg class="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg></div>' +
      '<div class="text-center"><h3 class="text-lg font-semibold text-base-content/90">管理员登录</h3><p class="text-sm text-base-content/30 mt-1">请输入密码以继续</p></div>' +
      '<div class="w-full relative">' +
      '<input type="password" id="login-pwd" name="password" class="w-full h-12 pl-4 pr-12 rounded-xl text-sm text-base-content placeholder:text-base-content/25 outline-none" style="background:rgba(15,23,42,.65);border:1px solid rgba(255,255,255,.06);backdrop-filter:blur(12px)" placeholder="请输入密码" required autofocus>' +
      '<button type="button" id="toggle-pwd-vis" class="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-base-content/60 transition-colors cursor-pointer text-sm">👁️</button>' +
      '</div>' +
      '<button type="submit" class="w-full h-11 rounded-xl text-sm font-medium text-white cursor-pointer transition-all duration-200 hover:opacity-90 active:scale-[0.98]" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);box-shadow:0 4px 16px rgba(99,102,241,.3)">登 录</button>' +
      '</form>'
  )

  const titleEl = $('#modal-title')
  if (titleEl) titleEl.style.display = 'none'

  $('#toggle-pwd-vis')?.addEventListener('click', function (this: HTMLElement) {
    const inp = $<HTMLInputElement>('#login-pwd')
    if (!inp) return
    inp.type = inp.type === 'password' ? 'text' : 'password'
    this.textContent = inp.type === 'password' ? '👁️' : '🙈'
  })

  $<HTMLFormElement>('#login-form')?.addEventListener('submit', async function (e) {
    e.preventDefault()
    const pwdInput = $<HTMLInputElement>('#login-pwd')
    const pwd = pwdInput?.value?.trim()
    if (!pwd) return
    const btn = this.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (btn) {
      btn.disabled = true
      btn.textContent = '登录中...'
    }
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      })
      const data = (await res.json()) as {
        success?: boolean
        blocked?: boolean
        remainingMs?: number
        lockoutMs?: number
        attemptsRemaining?: number
      }
      if (data.success) {
        toast('登录成功', 'success')
        setTimeout(() => window.location.reload(), 500)
      } else if (data.blocked) {
        const lockMin = Math.ceil((data.remainingMs || data.lockoutMs || 900000) / 60000)
        toast('⛔ 尝试次数过多，已锁定 ' + lockMin + ' 分钟', 'error')
        if (btn) {
          btn.disabled = true
          btn.textContent = '已锁定 ' + lockMin + ' 分钟'
        }
        if (pwdInput) pwdInput.value = ''
        setTimeout(() => {
          if (btn) {
            btn.disabled = false
            btn.textContent = '登 录'
          }
        }, Math.min(data.remainingMs || data.lockoutMs || 60000, 120000))
      } else {
        const remaining = data.attemptsRemaining
        toast(remaining !== undefined ? '密码错误，剩余 ' + remaining + ' 次机会' : '密码错误', 'error')
        if (btn) {
          btn.disabled = false
          btn.textContent = '登 录'
        }
        if (pwdInput) {
          pwdInput.value = ''
          pwdInput.focus()
        }
      }
    } catch {
      toast('登录失败', 'error')
      if (btn) {
        btn.disabled = false
        btn.textContent = '登 录'
      }
    }
  })
}

function bindLetterIconToggle(form: HTMLFormElement): void {
  const checkbox = form.elements.namedItem('use_letter_icon') as HTMLInputElement | null
  const iconInput = form.elements.namedItem('icon') as HTMLInputElement | null
  if (!checkbox || !iconInput) return

  const sync = (): void => {
    iconInput.disabled = checkbox.checked
    iconInput.placeholder = checkbox.checked ? '已启用本地首字母图标（0 请求）' : '留空自动获取，或填 letter 使用本地首字母图标'
  }
  sync()
  checkbox.addEventListener('change', sync)
}

function getSubmittedIconValue(form: HTMLFormElement): string {
  if (isFormCheckboxChecked(form, 'use_letter_icon')) {
    return LETTER_ICON_TOKEN
  }
  return getFormFieldValue(form, 'icon').trim()
}

function bindMetaFetch(form: HTMLFormElement): void {
  const btn = form.querySelector<HTMLButtonElement>('#btn-fetch-meta')
  if (!btn) return
  btn.addEventListener('click', async () => {
    const urlInput = form.elements.namedItem('url') as HTMLInputElement | null
    if (!urlInput || !urlInput.reportValidity()) return
    const url = urlInput.value.trim()
    btn.disabled = true
    btn.textContent = '⏳ 识别中...'
    try {
      const res = await api<LinkMetaResponse>('/api/link/meta', {
        method: 'POST',
        body: JSON.stringify({ url }),
      })
      let filled = 0
      const fillIfEmpty = (name: string, val: string): void => {
        const el = form.elements.namedItem(name) as HTMLInputElement | null
        if (el && !el.disabled && !el.value.trim() && val) {
          el.value = val
          filled++
        }
      }
      fillIfEmpty('title', res.title)
      fillIfEmpty('description', res.description)
      if (!isFormCheckboxChecked(form, 'use_letter_icon')) {
        fillIfEmpty('icon', res.icon)
      }
      if (filled > 0) {
        toast('已识别并填充空白字段', 'success')
      } else if (res.warning) {
        toast(res.warning, 'info')
      } else {
        toast('未检测到需要填充的新信息', 'info')
      }
    } catch (err) {
      toast('识别失败: ' + (err as Error).message, 'error')
    } finally {
      btn.disabled = false
      btn.textContent = '🔍 自动识别'
    }
  })
}

export function showAddLinkModal(): void {
  const cats = navState.data.filter((c) => c.id !== -1)
  let options = ''
  cats.forEach((c) => {
    options += '<option value="' + c.id + '">' + escapeHtml(c.title) + '</option>'
    c.children?.forEach((ch) => {
      options += '<option value="' + ch.id + '">└ ' + escapeHtml(ch.title) + '</option>'
    })
  })

  openModal(
    '添加链接',
    '<form id="link-form" class="flex flex-col gap-3">' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">分类</span></div><select name="category_id" class="select select-bordered w-full" required>' +
      options +
      '</select></label>' +
      '<div class="form-control w-full"><div class="label"><span class="label-text">URL</span></div><div class="flex gap-2"><input type="url" name="url" class="input input-bordered flex-1" required placeholder="https://..."><button type="button" id="btn-fetch-meta" class="btn btn-outline btn-sm shrink-0">🔍 自动识别</button></div></div>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">标题</span></div><input type="text" name="title" class="input input-bordered w-full" required placeholder="网站名称"></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">描述</span></div><input type="text" name="description" class="input input-bordered w-full" placeholder="简短描述"></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">图标 URL</span></div><input type="text" name="icon" class="input input-bordered w-full" placeholder="留空自动获取，或填 letter 使用本地首字母图标"></label>' +
      '<label class="flex items-center gap-2 cursor-pointer text-xs text-base-content/70"><input type="checkbox" name="use_letter_icon" class="checkbox checkbox-xs"><span>🔤 使用本地首字母图标（不请求外部图标）</span></label>' +
      '<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="is_private" class="toggle toggle-sm"><span class="label-text">🔒 私有链接</span></label>' +
      '<div class="modal-action"><button type="submit" class="btn btn-primary">添加链接</button></div></form>'
  )

  const linkForm = $<HTMLFormElement>('#link-form')
  if (linkForm) {
    bindLetterIconToggle(linkForm)
    bindMetaFetch(linkForm)
    linkForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const form = e.currentTarget as HTMLFormElement
      const data = {
        category_id: parseInt(getFormFieldValue(form, 'category_id'), 10),
        title: getFormFieldValue(form, 'title'),
        url: getFormFieldValue(form, 'url'),
        description: getFormFieldValue(form, 'description'),
        icon: getSubmittedIconValue(form),
        is_private: isFormCheckboxChecked(form, 'is_private') ? 1 : 0,
      }
      try {
        await api('/api/link', { method: 'POST', body: JSON.stringify(data) })
        closeAppModal()
        toast('链接已添加', 'success')
        await reloadData()
      } catch (err) {
        toast('添加失败: ' + (err as Error).message, 'error')
      }
    })
  }
}

export function showAddCatModal(): void {
  let catListHtml = ''
  navState.data.forEach((cat) => {
    if (cat.id === -1) return
    catListHtml +=
      '<div class="cat-group" data-group-id="' +
      cat.id +
      '">' +
      '<div class="cat-manage-item flex items-center gap-2 p-2 rounded-xl group" data-cat-id="' +
      cat.id +
      '">' +
      '<span class="cursor-grab text-base-content/30 cat-group-handle">⠿</span>' +
      '<span class="flex-1 text-sm font-medium truncate">' +
      (cat.is_private ? '🔒 ' : '') +
      escapeHtml(cat.title) +
      '</span>' +
      '<button type="button" class="btn btn-ghost btn-xs cat-edit-btn" data-cat-id="' +
      cat.id +
      '">✏️</button>' +
      '<button type="button" class="btn btn-ghost btn-xs cat-del-btn text-error/60" data-cat-id="' +
      cat.id +
      '">🗑️</button>' +
      '</div>'
    if (cat.children && cat.children.length > 0) {
      catListHtml += '<div class="cat-sub-sort flex flex-col gap-1">'
      cat.children.forEach((ch) => {
        catListHtml +=
          '<div class="cat-manage-item cat-sub-item flex items-center gap-2 p-2 rounded-xl group ml-6" data-cat-id="' +
          ch.id +
          '">' +
          '<span class="cursor-grab text-base-content/30 cat-sub-handle">⠿</span>' +
          '<span class="text-base-content/30 text-xs mr-1">└</span>' +
          '<span class="flex-1 text-sm font-medium truncate">' +
          (ch.is_private ? '🔒 ' : '') +
          escapeHtml(ch.title) +
          '</span>' +
          '<button type="button" class="btn btn-ghost btn-xs cat-edit-btn" data-cat-id="' +
          ch.id +
          '">✏️</button>' +
          '<button type="button" class="btn btn-ghost btn-xs cat-del-btn text-error/60" data-cat-id="' +
          ch.id +
          '">🗑️</button>' +
          '</div>'
      })
      catListHtml += '</div>'
    }
    catListHtml += '</div>'
  })

  openModal(
    '分类管理',
    '<div class="flex flex-col gap-3">' +
      '<p class="text-xs text-base-content/40">拖拽调整顺序 · 点击编辑或删除</p>' +
      '<div id="cat-sort-list" class="flex flex-col gap-2">' +
      catListHtml +
      '</div>' +
      '<div class="divider text-xs text-base-content/30 my-1">添加新分类</div>' +
      '<form id="cat-form" class="flex flex-wrap gap-2 items-center">' +
      '<input type="text" name="title" class="input input-bordered input-sm flex-1 min-w-[120px]" required placeholder="分类名称">' +
      '<select name="parent_id" class="select select-bordered select-sm w-auto max-w-[140px]">' +
      '<option value="">顶级分类</option>' +
      navState.data
        .filter((c) => c.id !== -1)
        .map((c) => '<option value="' + c.id + '">↳ ' + escapeHtml(c.title) + '</option>')
        .join('') +
      '</select>' +
      '<label class="flex items-center gap-1 cursor-pointer shrink-0"><input type="checkbox" name="is_private" class="toggle toggle-xs"><span class="text-xs">🔒 私有</span></label>' +
      '<button type="submit" class="btn btn-primary btn-sm shrink-0">添加</button>' +
      '</form></div>'
  )

  const SortableCls = window.Sortable
  if (typeof SortableCls !== 'undefined') {
    const sortList = $('#cat-sort-list')
    if (sortList) {
      const saveCatOrder = async (): Promise<void> => {
        const items = Array.from(sortList.querySelectorAll<HTMLElement>('.cat-manage-item[data-cat-id]'))
          .map((el, i) => ({
            id: parseInt(el.dataset.catId || '', 10),
            sort_order: i,
          }))
          .filter((x) => !Number.isNaN(x.id))
        try {
          await api('/api/category/reorder', { method: 'POST', body: JSON.stringify(items) })
          toast('分类顺序已保存', 'success')
          await reloadData()
        } catch {
          toast('排序失败', 'error')
        }
      }
      new SortableCls(sortList, {
        animation: 200,
        draggable: '.cat-group',
        handle: '.cat-group-handle',
        ghostClass: 'opacity-30',
        onEnd: saveCatOrder,
      })
      sortList.querySelectorAll<HTMLElement>('.cat-sub-sort').forEach((subList) => {
        new SortableCls(subList, {
          animation: 200,
          draggable: '.cat-sub-item',
          handle: '.cat-sub-handle',
          ghostClass: 'opacity-30',
          onEnd: saveCatOrder,
        })
      })
    }
  }

  $$('.cat-edit-btn').forEach((btn) => {
    btn.addEventListener('click', function (this: HTMLElement) {
      const catId = parseInt(this.dataset.catId || '', 10)
      const cat = findCatById(catId)
      if (cat) showEditCatModal(cat)
    })
  })

  $$('.cat-del-btn').forEach((btn) => {
    btn.addEventListener('click', function (this: HTMLElement) {
      const catId = parseInt(this.dataset.catId || '', 10)
      const cat = findCatById(catId)
      if (!cat) return
      sysConfirm('确定删除分类「' + cat.title + '」？分类下的链接也会被删除！', async () => {
        try {
          await api('/api/category/delete', { method: 'POST', body: JSON.stringify({ id: catId }) })
          toast('分类已删除', 'success')
          runtime.currentCatIdx = 0
          runtime.currentSubId = null
          await reloadData()
          showAddCatModal()
        } catch (err) {
          toast('删除失败: ' + (err as Error).message, 'error')
        }
      })
    })
  })

  $<HTMLFormElement>('#cat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const data: { title: string; is_private: number; parent_id?: number } = {
      title: getFormFieldValue(form, 'title'),
      is_private: isFormCheckboxChecked(form, 'is_private') ? 1 : 0,
    }
    const parentId = getFormFieldValue(form, 'parent_id')
    if (parentId) data.parent_id = parseInt(parentId, 10)
    try {
      await api('/api/category', { method: 'POST', body: JSON.stringify(data) })
      closeAppModal()
      toast('分类已添加', 'success')
      await reloadData()
    } catch (err) {
      toast('添加失败: ' + (err as Error).message, 'error')
    }
  })
}

export function showEditCatModal(cat: CategoryWithItems): void {
  const hasChildren = Boolean(cat.children && cat.children.length > 0)
  const parentOptions = hasChildren
    ? '<option value="">无（含子分类，不可设为子分类）</option>'
    : '<option value="">无（顶级分类）</option>' +
      navState.data
        .filter((c) => c.id !== -1 && c.id !== cat.id)
        .map(
          (c) =>
            '<option value="' +
            c.id +
            '" ' +
            (cat.parent_id === c.id ? 'selected' : '') +
            '>↳ ' +
            escapeHtml(c.title) +
            '</option>'
        )
        .join('')

  openModal(
    '编辑分类',
    '<form id="edit-cat-form" class="flex flex-col gap-3">' +
      '<input type="hidden" name="id" value="' +
      cat.id +
      '">' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">分类名称</span></div><input type="text" name="title" class="input input-bordered w-full" required value="' +
      escapeHtml(cat.title) +
      '"></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">所属父分类</span></div><select name="parent_id" class="select select-bordered w-full"' +
      (hasChildren ? ' disabled' : '') +
      '>' +
      parentOptions +
      '</select></label>' +
      '<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="is_private" class="toggle toggle-sm" ' +
      (cat.is_private ? 'checked' : '') +
      '><span class="label-text">🔒 私有分类</span></label>' +
      '<div class="modal-action flex gap-2">' +
      '<button type="button" id="btn-delete-cat" class="btn btn-error btn-outline">删除分类</button>' +
      '<button type="submit" class="btn btn-primary flex-1">保存修改</button>' +
      '</div></form>'
  )

  $<HTMLFormElement>('#edit-cat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const rawParent = getFormFieldValue(form, 'parent_id')
    const data = {
      id: parseInt(getFormFieldValue(form, 'id'), 10),
      title: getFormFieldValue(form, 'title'),
      is_private: isFormCheckboxChecked(form, 'is_private') ? 1 : 0,
      parent_id: !hasChildren && rawParent ? parseInt(rawParent, 10) : null,
    }
    try {
      await api('/api/category/update', { method: 'POST', body: JSON.stringify(data) })
      closeAppModal()
      toast('分类已更新', 'success')
      await reloadData()
    } catch (err) {
      toast('更新失败: ' + (err as Error).message, 'error')
    }
  })

  $('#btn-delete-cat')?.addEventListener('click', () => {
    sysConfirm('确定删除分类「' + cat.title + '」？分类下的链接也会被删除！', async () => {
      try {
        await api('/api/category/delete', { method: 'POST', body: JSON.stringify({ id: cat.id }) })
        closeAppModal()
        toast('分类已删除', 'success')
        runtime.currentCatIdx = 0
        runtime.currentSubId = null
        await reloadData()
      } catch (err) {
        toast('删除失败: ' + (err as Error).message, 'error')
      }
    })
  })
}

export function showLinkActionModal(link: Link): void {
  openModal(
    escapeHtml(link.title),
    '<div class="flex flex-col gap-3">' +
      '<a href="' +
      escapeHtml(link.url) +
      '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">🔗 打开链接</a>' +
      '<button type="button" id="act-edit" class="btn btn-primary btn-sm">✏️ 编辑</button>' +
      '<button type="button" id="act-delete" class="btn btn-error btn-outline btn-sm">🗑️ 删除</button>' +
      '</div>'
  )
  $('#act-edit')?.addEventListener('click', () => {
    showEditLinkModal(link)
  })
  $('#act-delete')?.addEventListener('click', () => {
    sysConfirm('确定删除「' + link.title + '」？', () => {
      void deleteLink(link.id)
      closeAppModal()
    })
  })
}

export function showEditLinkModal(link: Link): void {
  const cats = navState.data.filter((c) => c.id !== -1)
  let options = ''
  cats.forEach((c) => {
    options += '<option value="' + c.id + '" ' + (c.id === link.category_id ? 'selected' : '') + '>' + escapeHtml(c.title) + '</option>'
    c.children?.forEach((ch) => {
      options +=
        '<option value="' + ch.id + '" ' + (ch.id === link.category_id ? 'selected' : '') + '>└ ' + escapeHtml(ch.title) + '</option>'
    })
  })
  let linkDomain = ''
  try {
    linkDomain = new URL(link.url).hostname
  } catch {
    /* ignore */
  }
  const useLetterIcon = isLetterIcon(link.icon)
  const customIconUrl = !useLetterIcon && link.icon && (link.icon.startsWith('http://') || link.icon.startsWith('https://')) ? link.icon : ''

  openModal(
    '编辑链接',
    '<form id="edit-form" class="flex flex-col gap-3"><input type="hidden" name="id" value="' +
      link.id +
      '">' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">分类</span></div><select name="category_id" class="select select-bordered w-full" required>' +
      options +
      '</select></label>' +
      '<div class="form-control w-full"><div class="label"><span class="label-text">URL</span></div><div class="flex gap-2"><input type="url" name="url" class="input input-bordered flex-1" required value="' +
      escapeHtml(link.url) +
      '"><button type="button" id="btn-fetch-meta" class="btn btn-outline btn-sm shrink-0">🔍 自动识别</button></div></div>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">标题</span></div><input type="text" name="title" class="input input-bordered w-full" required value="' +
      escapeHtml(link.title) +
      '"></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">描述</span></div><input type="text" name="description" class="input input-bordered w-full" value="' +
      escapeHtml(link.description || '') +
      '"></label>' +
      '<label class="form-control w-full"><div class="label"><span class="label-text">图标 URL</span></div><input type="text" name="icon" class="input input-bordered w-full" placeholder="留空自动获取，或填 letter 使用本地首字母图标" value="' +
      escapeHtml(useLetterIcon ? '' : link.icon || '') +
      '"></label>' +
      '<label class="flex items-center gap-2 cursor-pointer text-xs text-base-content/70"><input type="checkbox" name="use_letter_icon" class="checkbox checkbox-xs" ' +
      (useLetterIcon ? 'checked' : '') +
      '><span>🔤 使用本地首字母图标（不请求外部图标）</span></label>' +
      (!useLetterIcon && (isProxyableIconDomain(linkDomain) || customIconUrl)
        ? '<button type="button" id="btn-purge-icon" class="btn btn-outline btn-xs self-start" data-domain="' +
          escapeHtml(isProxyableIconDomain(linkDomain) ? linkDomain : '') +
          '" data-icon-url="' +
          escapeHtml(customIconUrl) +
          '">🔄 刷新图标缓存</button>'
        : '') +
      '<button type="button" id="btn-reset-visits" class="btn btn-outline btn-xs self-start" data-link-id="' +
      link.id +
      '">🧹 清除点击次数' +
      (link.visits ? ' (' + link.visits + ')' : '') +
      '</button>' +
      '<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="is_private" class="toggle toggle-sm" ' +
      (link.is_private ? 'checked' : '') +
      '><span class="label-text">🔒 私有链接</span></label>' +
      '<div class="modal-action"><button type="submit" class="btn btn-primary">保存修改</button></div></form>'
  )

  const editForm = $<HTMLFormElement>('#edit-form')
  if (editForm) {
    bindLetterIconToggle(editForm)
    bindMetaFetch(editForm)
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const form = e.currentTarget as HTMLFormElement
      const data = {
        id: parseInt(getFormFieldValue(form, 'id'), 10),
        category_id: parseInt(getFormFieldValue(form, 'category_id'), 10),
        title: getFormFieldValue(form, 'title'),
        url: getFormFieldValue(form, 'url'),
        description: getFormFieldValue(form, 'description'),
        icon: getSubmittedIconValue(form),
        is_private: isFormCheckboxChecked(form, 'is_private') ? 1 : 0,
      }
      try {
        await api('/api/link/update', { method: 'POST', body: JSON.stringify(data) })
        closeAppModal()
        toast('链接已更新', 'success')
        await reloadData()
      } catch (err) {
        toast('更新失败: ' + (err as Error).message, 'error')
      }
    })
  }

  $<HTMLButtonElement>('#btn-purge-icon')?.addEventListener('click', async function () {
    const domain = this.dataset.domain
    const iconUrl = this.dataset.iconUrl
    this.disabled = true
    this.textContent = '⏳ 刷新中...'
    try {
      await api('/api/icon/purge', {
        method: 'POST',
        body: JSON.stringify({
          ...(domain ? { domain } : {}),
          ...(iconUrl ? { url: iconUrl } : {}),
        }),
      })
      toast('图标缓存已清除，刷新页面后生效', 'success')
      this.textContent = '✅ 已刷新'
    } catch (err) {
      toast('刷新失败: ' + (err as Error).message, 'error')
      this.disabled = false
      this.textContent = '🔄 刷新图标缓存'
    }
  })

  $<HTMLButtonElement>('#btn-reset-visits')?.addEventListener('click', async function () {
    const linkId = parseInt(this.dataset.linkId || '', 10)
    this.disabled = true
    this.textContent = '⏳ 清除中...'
    try {
      await api('/api/link/reset-visits', { method: 'POST', body: JSON.stringify({ id: linkId }) })
      clearVisitCooldown(linkId)
      toast('点击次数已清零', 'success')
      this.textContent = '✅ 已清除'
      await reloadData()
    } catch (err) {
      toast('清除失败: ' + (err as Error).message, 'error')
      this.disabled = false
      this.textContent = '🧹 清除点击次数'
    }
  })
}

export async function deleteLink(id: number): Promise<void> {
  try {
    await api('/api/link/delete', { method: 'POST', body: JSON.stringify({ id }) })
    clearVisitCooldown(id)
    toast('链接已删除', 'success')
    await reloadData()
  } catch (err) {
    toast('删除失败: ' + (err as Error).message, 'error')
  }
}

export async function showLogsModal(page = 1, limit = 5): Promise<void> {
  try {
    const res = await api<LogsResponse>('/api/logs?page=' + page + '&limit=' + limit)
    let html = '<div class="flex flex-col gap-3">'

    if (!res.logs || res.logs.length === 0) {
      html += '<div class="py-20 text-center text-base-content/40">暂无操作日志记录</div>'
    } else {
      const actionMap: Record<string, { text: string; cls: string }> = {
        admin_access: { text: '进入后台', cls: 'bg-primary text-primary-content' },
        login: { text: '登录成功', cls: 'bg-emerald-500 text-white' },
        login_failed: { text: '登录失败', cls: 'bg-amber-500 text-white' },
        ip_lockout: { text: 'IP 锁定', cls: 'bg-rose-500 text-white' },
        session_verification_failed: { text: '伪造会话', cls: 'bg-rose-500 text-white' },
      }
      const getActionBadge = (action: string): string => {
        const match = actionMap[action]
        if (match) {
          return '<span class="inline-block px-2.5 py-1 rounded text-xs font-medium ' + match.cls + '">' + match.text + '</span>'
        }
        return (
          '<span class="inline-block px-2.5 py-1 rounded text-xs font-medium bg-base-content/20 text-base-content">' +
          escapeHtml(action) +
          '</span>'
        )
      }

      html += '<div class="overflow-x-auto"><table class="w-full text-left border-collapse whitespace-nowrap">'
      html +=
        '<thead><tr class="border-b border-base-content/10">' +
        '<th class="py-3 px-3 font-semibold text-xs">时间 (UTC+8)</th>' +
        '<th class="py-3 px-3 font-semibold text-xs">IP</th>' +
        '<th class="py-3 px-3 font-semibold text-xs">地区</th>' +
        '<th class="py-3 px-3 font-semibold text-xs text-center">操作</th>' +
        '</tr></thead><tbody>'

      res.logs.forEach((log) => {
        const dateStr = formatDateUtc8(log.created_at)

        html +=
          '<tr class="border-b border-base-content/5 hover:bg-base-content/[0.02] transition-colors">' +
          '<td class="py-3 px-3 text-xs text-base-content/80">' +
          dateStr +
          '</td>' +
          '<td class="py-3 px-3 text-xs font-mono text-base-content/60">' +
          escapeHtml(log.ip || 'Unknown') +
          '</td>' +
          '<td class="py-3 px-3 text-xs text-base-content/80">' +
          escapeHtml(log.region || 'Unknown') +
          '</td>' +
          '<td class="py-3 px-3 text-center">' +
          getActionBadge(log.action) +
          '</td>' +
          '</tr>'
      })
      html += '</tbody></table></div>'
    }

    html += '<div class="flex flex-col gap-3 pt-3 border-t border-base-content/10">'
    html += '<div class="flex items-center justify-between">'
    html += '<span class="text-xs text-base-content/30">共 ' + (res.total || 0) + ' 条日志</span>'
    html += '<div class="flex gap-2">'
    if (page > 1) {
      html += '<button class="btn btn-outline btn-xs btn-logs-nav" data-page="' + (page - 1) + '" data-limit="' + limit + '">上一页</button>'
    }
    if (res.logs && res.logs.length === limit && page * limit < (res.total || 0)) {
      html += '<button class="btn btn-outline btn-xs btn-logs-nav" data-page="' + (page + 1) + '" data-limit="' + limit + '">下一页</button>'
    }
    html += '</div></div>'

    html += '<div class="flex gap-2">'
    if (limit <= 5) {
      html += '<button class="btn btn-primary btn-sm flex-1" id="btn-logs-all">📋 查看全部日志</button>'
    } else {
      html += '<button class="btn btn-outline btn-sm flex-1" id="btn-logs-brief">📋 简略视图</button>'
    }
    html += '<button class="btn btn-error btn-outline btn-sm" id="btn-logs-clear">🗑️ 清空</button>'
    html += '</div>'
    html += '</div></div>'

    openModal('📋 操作日志', html)

    const modalBox = $<HTMLElement>('#app-modal .modal-box')
    if (modalBox) modalBox.style.maxWidth = '48rem'

    $$<HTMLButtonElement>('.btn-logs-nav').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement
        void showLogsModal(parseInt(target.dataset.page || '1', 10), parseInt(target.dataset.limit || String(limit), 10))
      })
    })

    $('#btn-logs-all')?.addEventListener('click', () => {
      void showLogsModal(1, 15)
    })

    $('#btn-logs-brief')?.addEventListener('click', () => {
      void showLogsModal(1, 5)
    })

    $('#btn-logs-clear')?.addEventListener('click', () => {
      sysConfirm('确定要清空所有操作日志吗？此操作不可恢复！', async () => {
        try {
          await api('/api/logs/clear', { method: 'POST' })
          toast('日志已清空', 'success')
          void showLogsModal(1, limit)
        } catch (err) {
          toast('清空失败: ' + (err as Error).message, 'error')
        }
      })
    })
  } catch (err) {
    toast('获取日志失败: ' + (err as Error).message, 'error')
  }
}
