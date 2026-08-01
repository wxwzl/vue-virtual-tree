import type { App } from "vue";
import VirtualScroller from "./components/VirtualScroller.vue";

export { VirtualScroller };
export * from "./utils/range";
export type { VirtualScrollerProps, VirtualScrollerExpose } from "./types";

export default {
  install(app: App) {
    app.component("VirtualScroller", VirtualScroller);
  },
};
