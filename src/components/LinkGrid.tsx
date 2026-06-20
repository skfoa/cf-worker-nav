/**
 * src/components/LinkGrid.tsx - 卡片网格容器
 */
import type { FC } from 'hono/jsx'
import type { CategoryWithItems } from '../types'
import { LinkCard } from './LinkCard'

interface LinkGridProps {
  categories: CategoryWithItems[]
  isAdmin?: boolean
}

export const LinkGrid: FC<LinkGridProps> = ({ categories, isAdmin }) => (
  <div id="link-sections" class="px-4 max-w-6xl mx-auto">
    {categories.map((cat, idx) => (
      <section
        class={`cat-section ${idx === 0 ? '' : 'hidden'}`}
        data-cat-id={cat.id}
      >
        <div
          id={`grid-${cat.id}`}
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
        >
          {cat.items.map(link => (
            <LinkCard link={link} isAdmin={isAdmin} />
          ))}
        </div>
        {cat.items.length === 0 && (
          <div class="text-center text-base-content/30 py-16 text-sm">
            暂无链接
          </div>
        )}
      </section>
    ))}
    {/* 搜索结果区域 */}
    <section id="search-results" class="hidden">
      <div
        id="search-results-grid"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
      />
      <div id="search-empty" class="text-center text-base-content/30 py-16 text-sm hidden">
        未找到匹配的链接
      </div>
    </section>
  </div>
)
