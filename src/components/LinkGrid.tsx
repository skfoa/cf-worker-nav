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
          class="sub-grid grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3"
          data-sub-id={cat.id}
        >
          {cat.items.map(link => (
            <LinkCard link={link} isAdmin={isAdmin} />
          ))}
        </div>
        {(!cat.children || cat.children.length === 0) && cat.items.length === 0 && (
          <div class="text-center text-base-content/30 py-16 text-sm grid-empty-msg" data-sub-id={cat.id}>
            暂无链接
          </div>
        )}
        
        {cat.children && cat.children.map(ch => (
          <div
            id={`grid-${ch.id}`}
            class="sub-grid grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 hidden"
            data-sub-id={ch.id}
          >
            {ch.items.map(link => (
              <LinkCard link={link} isAdmin={isAdmin} />
            ))}
          </div>
        ))}
        {cat.children && cat.children.map(ch => (
          ch.items.length === 0 && (
            <div id={`empty-${ch.id}`} class="text-center text-base-content/30 py-16 text-sm grid-empty-msg hidden" data-sub-id={ch.id}>
              暂无链接
            </div>
          )
        ))}
      </section>
    ))}
    {/* 搜索结果区域 */}
    <section id="search-results" class="hidden">
      <div
        id="search-results-grid"
        class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3"
      />
      <div id="search-empty" class="text-center text-base-content/30 py-16 text-sm hidden">
        未找到匹配的链接
      </div>
    </section>
  </div>
)
