declare module 'vue-virtual-scroller' {
  import type { App, DefineComponent } from 'vue'

  export const DynamicScroller: DefineComponent<any, any, any, any, any, any, any, any>
  export const DynamicScrollerItem: DefineComponent<any, any, any>

  const VueVirtualScroller: {
    install(app: App): void
  }

  export default VueVirtualScroller
}

