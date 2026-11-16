/**
 * src/client/api.ts - Fetch 请求封装（鉴权失效重载 + 结构化错误提取）
 */
import { $ } from './dom'
import { runtime } from './state'

interface ApiErrorPayload {
  success?: boolean
  error?: string | { issues?: Array<{ message?: string }> }
  message?: string
}

export async function api<T = Record<string, unknown>>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string> | undefined) || {}),
  }
  if (runtime.token) {
    headers['Authorization'] = 'Bearer ' + runtime.token
  }
  const res = await fetch(path, { ...opts, credentials: 'include', headers })
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    const searchInput = $<HTMLInputElement>('#search-input')
    if (searchInput) searchInput.value = ''
    window.location.reload()
    throw new Error('登录已过期或无权限')
  }
  const text = await res.text()
  let data: ApiErrorPayload = {}
  if (text) {
    try {
      data = JSON.parse(text) as ApiErrorPayload
    } catch {
      throw new Error(res.ok ? '响应格式无效' : text)
    }
  }
  if (!res.ok || data.success === false) {
    const zodMsg = typeof data.error === 'object' ? data.error?.issues?.[0]?.message : undefined
    const msg =
      (typeof data.error === 'string' && data.error) ||
      zodMsg ||
      data.message ||
      `请求失败 (${res.status})`
    throw new Error(msg)
  }
  return data as T
}

