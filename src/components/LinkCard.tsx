/**
 * src/components/LinkCard.tsx - 链接卡片（深空科技风·居中图标）
 */
import type { FC } from 'hono/jsx'
import type { Link } from '../types'
import { resolveLinkIcon } from '../shared/icon'

interface LinkCardProps {
  link: Link
  isAdmin?: boolean
  lazy?: boolean
}

const LAZY_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"

export const LinkCard: FC<LinkCardProps> = ({ link, isAdmin, lazy = false }) => {
  const { iconSrc: targetSrc, originalIcon, isInline } = resolveLinkIcon(link)
  const shouldLazy = lazy && !isInline

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      class={`link-card glass-card rounded-3xl p-4 flex flex-col items-center justify-center gap-3 group cursor-pointer no-underline relative aspect-square${link.description ? ' tooltip tooltip-top' : ''}`}
      data-tip={link.description || undefined}
      data-link-id={link.id}
      data-cat-id={link.category_id}
      data-title={link.title}
      data-url={link.url}
    >
      {/* 管理按钮 */}
      {isAdmin && (
        <div class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-circle edit-link-btn text-xs"
            data-link-id={link.id}
          >
            ✏️
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-circle delete-link-btn text-xs"
            data-link-id={link.id}
          >
            🗑️
          </button>
        </div>
      )}

      {/* 图标 — 无背景块，直接悬浮 */}
      <div class="w-14 h-14 flex items-center justify-center flex-shrink-0">
        <img
          src={shouldLazy ? LAZY_PLACEHOLDER : targetSrc}
          data-src={shouldLazy ? targetSrc : undefined}
          alt=""
          class="w-10 h-10 object-contain"
          loading={isInline ? undefined : 'lazy'}
          data-original-icon={originalIcon || undefined}
        />
      </div>

      {/* 标题 */}
      <div class="text-xs font-medium text-center text-base-content/80 truncate w-full leading-tight">
        {link.is_private ? '🔒 ' : ''}{link.title}
      </div>
    </a>
  )
}
