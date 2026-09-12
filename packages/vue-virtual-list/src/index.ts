import VirtualList from "./VirtualList.vue";
import type { App } from "vue";

export { VirtualList };
export type { VirtualListProps } from "./VirtualList.vue";
export { FixedSizeModel, MeasuredSizeModel, type SizeModel } from "./core/sizeModel";
export { visibleRange, coverRange, EMPTY_RANGE, type RowRange } from "./core/range";

export default {
  install(app: App) {
    app.component("VirtualList", VirtualList);
  },
};
