/**
 * src/components/Navbar.tsx - 分类导航栏
 */
import type { FC } from 'hono/jsx'
import type { CategoryWithItems } from '../types'

interface NavbarProps {
  categories: CategoryWithItems[]
}

export const Navbar: FC<NavbarProps> = ({ categories }) => (
  <nav class="sticky top-0 z-50 bg-gradient-to-b from-base-300/95 via-base-300/60 to-transparent pt-[max(12px,env(safe-area-inset-top))] pb-4">
    <div class="flex justify-center">
      <div
        id="nav-scroll"
        class="flex gap-6 px-6 overflow-x-auto scrollbar-hide max-w-full"
      >
        {categories.map((cat, idx) => (
          <button
            type="button"
            class={`nav-tab whitespace-nowrap text-sm font-medium transition-all duration-200 border-b-2 pb-1
              ${idx === 0
                ? 'text-primary border-primary opacity-100'
                : 'text-base-content/60 border-transparent opacity-70 hover:opacity-100 hover:text-base-content'
              }`}
            data-cat-id={cat.id}
            data-idx={idx}
          >
            {cat.title}
          </button>
        ))}
      </div>
    </div>
  </nav>
)
