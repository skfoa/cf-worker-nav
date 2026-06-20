/**
 * src/components/Modal.tsx - 通用弹窗组件 (DaisyUI modal)
 */
import type { FC } from 'hono/jsx'

export const Modal: FC = () => (
  <dialog id="app-modal" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box bg-base-200 border border-base-content/10">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
      </form>
      <h3 id="modal-title" class="font-bold text-lg mb-4">弹窗标题</h3>
      <div id="modal-body">
        {/* 动态内容由 JS 填充 */}
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
)

/**
 * 添加/编辑链接表单 HTML 模板
 */
export function linkFormHtml(opts: {
  mode: 'add' | 'edit'
  categories: { id: number; title: string }[]
  link?: { id?: number; category_id?: number; title?: string; url?: string; description?: string; icon?: string; is_private?: number }
}): string {
  const { mode, categories, link } = opts
  const isEdit = mode === 'edit'
  return `
    <form id="link-form" class="flex flex-col gap-3">
      ${isEdit ? `<input type="hidden" name="id" value="${link?.id || ''}" />` : ''}
      <label class="form-control w-full">
        <div class="label"><span class="label-text">分类</span></div>
        <select name="category_id" class="select select-bordered w-full" required>
          ${categories.map(c => `<option value="${c.id}" ${c.id === link?.category_id ? 'selected' : ''}>${c.title}</option>`).join('')}
        </select>
      </label>
      <label class="form-control w-full">
        <div class="label"><span class="label-text">标题</span></div>
        <input type="text" name="title" class="input input-bordered w-full" value="${link?.title || ''}" required placeholder="网站名称" />
      </label>
      <label class="form-control w-full">
        <div class="label"><span class="label-text">URL</span></div>
        <input type="url" name="url" class="input input-bordered w-full" value="${link?.url || ''}" required placeholder="https://..." />
      </label>
      <label class="form-control w-full">
        <div class="label"><span class="label-text">描述 (可选)</span></div>
        <input type="text" name="description" class="input input-bordered w-full" value="${link?.description || ''}" placeholder="简短描述" />
      </label>
      <label class="form-control w-full">
        <div class="label"><span class="label-text">图标 URL (可选)</span></div>
        <input type="text" name="icon" class="input input-bordered w-full" value="${link?.icon || ''}" placeholder="留空自动获取" />
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" name="is_private" class="toggle toggle-sm" ${link?.is_private ? 'checked' : ''} />
        <span class="label-text">🔒 私有链接</span>
      </label>
      <div class="modal-action">
        <button type="submit" class="btn btn-primary">${isEdit ? '保存修改' : '添加链接'}</button>
      </div>
    </form>
  `
}

/**
 * 添加分类表单 HTML 模板
 */
export function categoryFormHtml(): string {
  return `
    <form id="category-form" class="flex flex-col gap-3">
      <label class="form-control w-full">
        <div class="label"><span class="label-text">分类名称</span></div>
        <input type="text" name="title" class="input input-bordered w-full" required placeholder="例如：开发工具" />
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" name="is_private" class="toggle toggle-sm" />
        <span class="label-text">🔒 私有分类</span>
      </label>
      <div class="modal-action">
        <button type="submit" class="btn btn-primary">添加分类</button>
      </div>
    </form>
  `
}
