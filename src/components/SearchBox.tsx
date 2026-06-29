/**
 * src/components/SearchBox.tsx - 搜索框 + 搜索引擎切换 (深空科技风)
 */
import type { FC } from 'hono/jsx'

export const SearchBox: FC = () => (
  <div class="px-4 mb-3 max-w-3xl mx-auto">
    {/* 搜索引擎切换标签 */}
    <div class="flex justify-center gap-2 mb-2" id="search-engines">
      <button type="button" data-engine="google" data-url="https://www.google.com/search?q="
        class="search-engine-tab px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-primary-content shadow-md shadow-primary/30">
        Google
      </button>
      <button type="button" data-engine="baidu" data-url="https://www.baidu.com/s?wd="
        class="search-engine-tab px-4 py-1.5 rounded-full text-sm font-medium text-base-content/50 hover:text-base-content/80">
        百度
      </button>
      <button type="button" data-engine="bing" data-url="https://www.bing.com/search?q="
        class="search-engine-tab px-4 py-1.5 rounded-full text-sm font-medium text-base-content/50 hover:text-base-content/80">
        Bing
      </button>
      <button type="button" data-engine="github" data-url="https://github.com/search?q="
        class="search-engine-tab px-4 py-1.5 rounded-full text-sm font-medium text-base-content/50 hover:text-base-content/80">
        GitHub
      </button>
      <button type="button" data-engine="local" data-url=""
        class="search-engine-tab px-4 py-1.5 rounded-full text-sm font-medium text-base-content/50 hover:text-base-content/80">
        🔍 站内
      </button>
    </div>
    {/* 搜索输入框 */}
    <div class="relative">
      <input
        type="text"
        id="search-input"
        placeholder="搜索..."
        class="search-box-input w-full pl-6 pr-14 h-14 text-base rounded-2xl text-base-content placeholder:text-base-content/30"
        autocomplete="off"
      />
      <button
        type="button"
        id="search-go"
        class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-primary hover:bg-primary/90 flex items-center justify-center shadow-lg shadow-primary/30 transition-all duration-200 cursor-pointer"
      >
        <svg class="w-5 h-5 text-primary-content" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
      <button
        type="button"
        id="search-clear"
        class="absolute right-14 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-base-content/60 hidden text-sm transition-colors"
      >
        ✕
      </button>
    </div>
  </div>
)
