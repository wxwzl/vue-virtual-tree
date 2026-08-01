import { ref, type Ref } from "vue";
import type { VirtualTreeProps, FlatTreeNode } from "../types";
import { getAllKeys } from "../utils/tree";
import { useVisibleRanges } from "./useVisibleRanges";

export function useTreeExpand(
  props: VirtualTreeProps,
  flatTree: FlatTreeNode[] | Ref<FlatTreeNode[]>
) {
  const flatTreeRef = Array.isArray(flatTree) ? ref(flatTree) : flatTree;
  const expandedKeys = ref<Set<string | number>>(new Set());

  const {
    visibleRanges,
    visibleCount,
    expandNode: expandRange,
    collapseNode: collapseRange,
    setFlatTree,
    getFlatIndexAtVisibleIndex,
    getVisibleIndexAtFlatIndex,
  } = useVisibleRanges(flatTreeRef.value);

  const initExpandedKeys = () => {
    expandedKeys.value.clear();
    if (props.defaultExpandAll) {
      const allKeys = getAllKeys(props.data, props.props);
      allKeys.forEach((key) => expandedKeys.value.add(key));
      let minIndex = Infinity;
      let maxLastDescendantIndex = -Infinity;
      for (const node of flatTreeRef.value) {
        minIndex = Math.min(minIndex, node.index);
        maxLastDescendantIndex = Math.max(
          maxLastDescendantIndex,
          node.lastDescendantIndex ?? node.index
        );
      }
      visibleRanges.value =
        minIndex <= maxLastDescendantIndex
          ? [{ start: minIndex, end: maxLastDescendantIndex }]
          : [];
    } else if (props.defaultExpandedKeys && props.defaultExpandedKeys.length > 0) {
      props.defaultExpandedKeys.forEach((key) => expandedKeys.value.add(key));
      rebuildRangesFromExpanded();
    } else {
      setFlatTree(flatTreeRef.value);
    }
  };

  const rebuildRangesFromExpanded = () => {
    const ranges: { start: number; end: number }[] = [];
    const isVisibleAt = (idx: number): boolean => {
      const node = flatTreeRef.value[idx];
      if (!node) return false;
      if (node.parentId === null) return true;
      const parentIndex = flatTreeRef.value.findIndex((n) => n.id === node.parentId);
      if (parentIndex < 0) return false;
      const parent = flatTreeRef.value[parentIndex];
      return expandedKeys.value.has(parent.id) && isVisibleAt(parentIndex);
    };

    let current: { start: number; end: number } | null = null;
    for (let i = 0; i < flatTreeRef.value.length; i++) {
      if (isVisibleAt(i)) {
        const idx = flatTreeRef.value[i].index;
        if (!current) current = { start: idx, end: idx };
        else current.end = idx;
      } else if (current) {
        ranges.push(current);
        current = null;
      }
    }
    if (current) ranges.push(current);
    visibleRanges.value = ranges;
  };

  const expandNode = (node: FlatTreeNode) => {
    if (props.accordion) {
      const siblings = flatTreeRef.value.filter(
        (n) => n.parentId === node.parentId && n.id !== node.id && expandedKeys.value.has(n.id)
      );
      siblings.forEach((sibling) => {
        expandedKeys.value.delete(sibling.id);
        collapseRange(sibling);
      });
    }
    node.isExpanded = true;
    expandedKeys.value.add(node.id);
    expandRange(node);
  };

  const collapseNode = (node: FlatTreeNode) => {
    collapseRange(node);
    const stack = [node];
    while (stack.length > 0) {
      const current = stack.pop()!;
      current.isExpanded = false;
      expandedKeys.value.delete(current.id);
      if (current.children) {
        for (let i = current.children.length - 1; i >= 0; i--) {
          stack.push(current.children[i]);
        }
      }
    }
  };

  const toggleNode = (node: FlatTreeNode) => {
    if (node.isExpanded) collapseNode(node);
    else expandNode(node);
  };

  const batchToggleNodes = (nodes: FlatTreeNode[], expand: boolean) => {
    nodes.forEach((node) => {
      if (expand && !node.isExpanded) {
        node.isExpanded = true;
        expandedKeys.value.add(node.id);
        expandRange(node);
      } else if (!expand && node.isExpanded) {
        expandedKeys.value.delete(node.id);
        collapseRange(node);
      }
    });
  };

  initExpandedKeys();

  return {
    expandedKeys,
    visibleRanges,
    visibleCount,
    initExpandedKeys,
    expandNode,
    collapseNode,
    toggleNode,
    batchToggleNodes,
    getFlatIndexAtVisibleIndex,
    getVisibleIndexAtFlatIndex,
  };
}
