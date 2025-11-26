declare module "vue-virtual-scroller" {
  import type { App, DefineComponent } from "vue";

  interface DynamicScrollerProps {
    items?: any[];
    minItemSize?: number;
    keyField?: string;
    [key: string]: any;
  }

  interface DynamicScrollerItemProps {
    item?: any;
    active?: boolean;
    sizeDependencies?: any[];
    [key: string]: any;
  }

  interface DynamicScrollerSlots {
    default?: (props: { item: any; index: number; active: boolean }) => any;
    [key: string]: any;
  }

  export const DynamicScroller: DefineComponent<
    DynamicScrollerProps,
    any,
    any,
    any,
    any,
    any,
    DynamicScrollerSlots,
    any
  > & {
    scrollToItem?: (index: number, align?: "start" | "center" | "end", offset?: number) => void;
    forceUpdate?: () => void;
  };

  export const DynamicScrollerItem: DefineComponent<DynamicScrollerItemProps, any, any>;

  const VueVirtualScroller: {
    install(app: App): void;
  };

  export default VueVirtualScroller;
}
