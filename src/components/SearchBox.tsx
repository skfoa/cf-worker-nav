/**
 * src/components/SearchBox.tsx - 搜索框
 */
import type { FC } from 'hono/jsx'

export const SearchBox: FC = () => (
  <div class="px-4 mb-4 max-w-2xl mx-auto">
    <div class="relative">
      <input
        type="text"
        id="search-input"
        placeholder="🔍 搜索链接..."
        class="input input-bordered w-full bg-base-200/80 backdrop-blur-sm border-base-content/10 focus:border-primary pl-4 pr-10"
        autocomplete="off"
      />
      <button
        type="button"
        id="search-clear"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content hidden"
      >
        ✕
      </button>
    </div>
  </div>
)
