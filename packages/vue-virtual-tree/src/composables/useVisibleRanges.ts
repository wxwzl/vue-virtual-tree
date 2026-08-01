import { ref, computed } from "vue";
import type { FlatTreeNode } from "../types";
import {
  insertRange,
  removeRange,
  getVisibleCount,
  getFlatIndexAtVisibleIndex,
  getVisibleIndexAtFlatIndex,
} from "@wxwzl/vue-virtual-scroller";
import type { VisibleRange } from "@wxwzl/vue-virtual-scroller";

export function useVisibleRanges(initialFlatTree: FlatTreeNode[] = []) {
  const flatTree = ref<FlatTreeNode[]>(initialFlatTree);
  const visibleRanges = ref<VisibleRange[]>([]);

  const rebuildRanges = () => {
    const ranges: VisibleRange[] = [];
    for (let i = 0; i < flatTree.value.length; i++) {
      const node = flatTree.value[i];
      if (node.parentId === null) {
        ranges.push({ start: node.index, end: node.index });
      }
    }
    visibleRanges.value = ranges;
  };

  const expandNode = (node: FlatTreeNode) => {
    const start = node.index + 1;
    const end = node.lastDescendantIndex ?? node.index;
    if (start > end) return;
    visibleRanges.value = insertRange(visibleRanges.value, start, end);
  };

  const collapseNode = (node: FlatTreeNode) => {
    const start = node.index + 1;
    const end = node.lastDescendantIndex ?? node.index;
    if (start > end) return;
    visibleRanges.value = removeRange(visibleRanges.value, start, end);
  };

  const visibleCount = computed(() => getVisibleCount(visibleRanges.value));

  const setFlatTree = (nodes: FlatTreeNode[]) => {
    flatTree.value = nodes;
    rebuildRanges();
  };

  rebuildRanges();

  return {
    visibleRanges,
    visibleCount,
    expandNode,
    collapseNode,
    setFlatTree,
    getFlatIndexAtVisibleIndex: (index: number) =>
      getFlatIndexAtVisibleIndex(visibleRanges.value, index),
    getVisibleIndexAtFlatIndex: (index: number) =>
      getVisibleIndexAtFlatIndex(visibleRanges.value, index),
  };
}
