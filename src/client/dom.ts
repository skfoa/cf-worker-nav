/**
 * src/client/dom.ts - DOM 辅助、安全转义、Toast 与弹窗控制
 */

export const $ = <T extends Element = HTMLElement>(sel: string): T | null =>
  document.querySelector<T>(sel)

export const $$ = <T extends Element = HTMLElement>(sel: string): NodeListOf<T> =>
  document.querySelectorAll<T>(sel)

export function escapeHtml(s: unknown): string {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function sanitizeCssUrl(raw: unknown): string {
  const u = String(raw || '').trim()
  if (!u) return ''
  try {
    const parsed = new URL(u, window.location.origin)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    return u.replace(/['"\\()\s]/g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase())
  } catch {
    return ''
  }
}

export function toast(msg: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const container = $('#toast-container')
  if (!container) return
  const clsMap = { success: 'alert-success', error: 'alert-error', info: 'alert-info' } as const
  const el = document.createElement('div')
  el.className = `alert ${clsMap[type]} text-sm shadow-lg`
  el.textContent = msg
  container.appendChild(el)
  setTimeout(() => {
    el.remove()
  }, 3000)
}

export function openModal(title: string, bodyHtml: string): void {
  const modal = $<HTMLDialogElement>('#app-modal')
  const modalBox = $<HTMLElement>('#app-modal .modal-box')
  const modalTitle = $('#modal-title')
  const modalBody = $('#modal-body')
  if (!modal || !modalTitle || !modalBody) return
  if (modalBox) modalBox.style.maxWidth = ''
  modalTitle.style.display = ''
  modalTitle.textContent = title
  modalBody.innerHTML = bodyHtml
  modal.showModal()
}

export function closeAppModal(): void {
  $<HTMLDialogElement>('#app-modal')?.close()
}

function replaceConfirmButton(text: string): HTMLButtonElement | null {
  const confirmBtn = $<HTMLButtonElement>('#sys-modal-confirm')
  if (!confirmBtn || !confirmBtn.parentNode) return null
  const newConfirmBtn = confirmBtn.cloneNode(true) as HTMLButtonElement
  newConfirmBtn.textContent = text
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn)
  return newConfirmBtn
}

export function sysConfirm(text: string, onConfirm: () => void): void {
  const modal = $<HTMLDialogElement>('#sys-modal')
  if (!modal) return
  const titleEl = $('#sys-modal-title')
  const bodyEl = $('#sys-modal-body')
  const cancelEl = $('#sys-modal-cancel')
  if (titleEl) titleEl.textContent = '操作确认'
  if (bodyEl) bodyEl.textContent = text
  cancelEl?.classList.remove('hidden')

  const confirmBtn = replaceConfirmButton('确定')
  confirmBtn?.addEventListener('click', (e) => {
    e.preventDefault()
    modal.close()
    onConfirm()
  })

  modal.showModal()
}

export function sysAlert(text: string): void {
  const modal = $<HTMLDialogElement>('#sys-modal')
  if (!modal) return
  const titleEl = $('#sys-modal-title')
  const bodyEl = $('#sys-modal-body')
  const cancelEl = $('#sys-modal-cancel')
  if (titleEl) titleEl.textContent = '系统提示'
  if (bodyEl) bodyEl.textContent = text
  cancelEl?.classList.add('hidden')

  const confirmBtn = replaceConfirmButton('知道了')
  confirmBtn?.addEventListener('click', (e) => {
    e.preventDefault()
    modal.close()
  })

  modal.showModal()
}

export function formatDateUtc8(input: number | string): string {
  const ts = typeof input === 'number' ? input : new Date(input).getTime()
  const d = new Date(ts + 8 * 3600 * 1000)
  if (Number.isNaN(d.getTime())) {
    return escapeHtml(String(input || ''))
  }
  return (
    d.getUTCFullYear() +
    '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getUTCDate()).padStart(2, '0') +
    ' ' +
    String(d.getUTCHours()).padStart(2, '0') +
    ':' +
    String(d.getUTCMinutes()).padStart(2, '0') +
    ':' +
    String(d.getUTCSeconds()).padStart(2, '0')
  )
}

export function getFormFieldValue(form: HTMLFormElement, name: string): string {
  const field = form.elements.namedItem(name)
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
    return field.value || ''
  }
  return ''
}

export function isFormCheckboxChecked(form: HTMLFormElement, name: string): boolean {
  const field = form.elements.namedItem(name)
  if (field instanceof HTMLInputElement) {
    return field.checked
  }
  return false
}
