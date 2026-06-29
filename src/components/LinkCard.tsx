/**
 * src/components/LinkCard.tsx - 链接卡片（深空科技风·居中图标）
 */
import type { FC } from 'hono/jsx'
import type { Link } from '../types'
import { getIconUrl } from '../utils/helpers'

interface LinkCardProps {
  link: Link
  isAdmin?: boolean
}

export const LinkCard: FC<LinkCardProps> = ({ link, isAdmin }) => {
  const iconSrc = getIconUrl(link)

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
        {iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            class="max-w-[2.5rem] max-h-[2.5rem] w-auto h-auto object-contain"
            loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
          />
        ) : null}
        <span
          class="text-3xl"
          style={iconSrc ? 'display:none' : ''}
        >
          🔗
        </span>
      </div>

      {/* 标题 */}
      <div class="text-xs font-medium text-center text-base-content/80 truncate w-full leading-tight">
        {link.is_private ? '🔒 ' : ''}{link.title}
      </div>
    </a>
  )
}
