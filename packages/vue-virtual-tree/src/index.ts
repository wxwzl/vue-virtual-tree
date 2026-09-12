import VirtualTree from "./components/VirtualTree.vue";
import VirtualList from "./virtual-list/VirtualList.vue";
import type { App } from "vue";
import type { VirtualTreeProps, VirtualTreeEmits, VirtualTreeMethods } from "./types";

export { VirtualTree, VirtualList };
export type { VirtualTreeProps, VirtualTreeEmits, VirtualTreeMethods };
export type { TreeNodeData, FlatTreeNode, TreePropsConfig, TreeNodeInstance } from "./types";

export default {
  install(app: App) {
    app.component("VirtualTree", VirtualTree);
    app.component("VirtualList", VirtualList);
  },
};
