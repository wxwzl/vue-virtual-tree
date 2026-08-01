import VirtualScroller from "./components/VirtualScroller.vue";

export { VirtualScroller };
export type { VirtualScrollerProps, VirtualScrollerExpose } from "./types";

export default {
  install(app: any) {
    app.component("VirtualScroller", VirtualScroller);
  },
};
