/**
 * src/components/LinkCard.tsx - 链接卡片
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
      class="link-card glass-card rounded-2xl p-3 flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group cursor-pointer no-underline"
      data-link-id={link.id}
      data-cat-id={link.category_id}
      data-title={link.title}
      data-url={link.url}
      data-desc={link.description || ''}
    >
      {/* 图标 */}
      <div class="w-10 h-10 rounded-xl bg-base-300/50 flex items-center justify-center shrink-0 overflow-hidden">
        {iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            class="w-6 h-6 object-contain"
            loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
          />
        ) : null}
        <span
          class="text-lg"
          style={iconSrc ? 'display:none' : ''}
        >
          🔗
        </span>
      </div>

      {/* 文字 */}
      <div class="min-w-0 flex-1">
        <div class="text-sm font-medium truncate text-base-content">
          {link.is_private ? '🔒 ' : ''}{link.title}
        </div>
        {link.description && (
          <div class="text-xs text-base-content/50 truncate mt-0.5">{link.description}</div>
        )}
      </div>

      {/* 管理按钮 */}
      {isAdmin && (
        <div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-circle edit-link-btn"
            data-link-id={link.id}
            onclick="event.preventDefault();event.stopPropagation()"
          >
            ✏️
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-circle delete-link-btn"
            data-link-id={link.id}
            onclick="event.preventDefault();event.stopPropagation()"
          >
            🗑️
          </button>
        </div>
      )}
    </a>
  )
}
