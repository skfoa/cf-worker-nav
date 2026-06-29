/**
 * src/components/Navbar.tsx - 分类导航栏
 */
import type { FC } from 'hono/jsx'
import type { CategoryWithItems } from '../types'

interface NavbarProps {
  categories: CategoryWithItems[]
}

export const Navbar: FC<NavbarProps> = ({ categories }) => (
  <nav class="sticky top-0 z-50 bg-gradient-to-b from-base-300/95 via-base-300/60 to-transparent pt-[max(12px,env(safe-area-inset-top))] pb-1">
    <div class="flex justify-center">
      <div
        id="nav-scroll"
        class="flex gap-7 px-6 overflow-x-auto scrollbar-hide max-w-full"
      >
        {categories.map((cat, idx) => (
          <button
            type="button"
            class={`nav-tab whitespace-nowrap text-base font-medium transition-all duration-200 border-b-2 pb-1.5 px-1
              ${idx === 0
                ? 'text-primary border-primary opacity-100'
                : 'text-base-content/60 border-transparent opacity-70 hover:opacity-100 hover:text-base-content'
              }`}
            data-cat-id={cat.id}
            data-idx={idx}
            {...(cat.children && cat.children.length > 0 ? { 'data-has-children': '1' } : {})}
          >
            {cat.title}
          </button>
        ))}
      </div>
    </div>
    <div id="sub-dropdown-container" class="relative w-full flex justify-center" style="height:20px">
      {categories.map((cat, idx) => {
        if (!cat.children || cat.children.length === 0) return null
        return (
          <div class="sub-dropdown" data-parent-idx={idx}>
            {cat.children.map(ch => (
              <button type="button" class="sub-dropdown-item" data-sub-id={ch.id}>
                {ch.title}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  </nav>
)
