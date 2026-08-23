import { ref, type Ref } from "vue";
import type { VirtualTreeProps, FlatTreeNode } from "../types";
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
    setFlatTree,
    getFlatIndexAtVisibleIndex,
    getVisibleIndexAtFlatIndex,
  } = useVisibleRanges(flatTreeRef.value);

  const initExpandedKeys = () => {
    expandedKeys.value.clear();
    if (props.defaultExpandAll) {
      // 全部展开时直接设置为一个连续区间，避免 O(n) 遍历构建区间
      const length = flatTreeRef.value.length;
      visibleRanges.value = length > 0 ? [{ start: 0, end: length - 1 }] : [];
      flatTreeRef.value.forEach((node) => {
        if (!node.isLeaf) {
          expandedKeys.value.add(node.id);
        }
      });
    } else if (props.defaultExpandedKeys && props.defaultExpandedKeys.length > 0) {
      props.defaultExpandedKeys.forEach((key) => expandedKeys.value.add(key));
      rebuildRangesFromExpanded();
    } else {
      setFlatTree(flatTreeRef.value);
    }
    // 同步每个节点的 isExpanded 状态，确保展开图标样式正确
    flatTreeRef.value.forEach((node) => {
      node.isExpanded = expandedKeys.value.has(node.id);
    });
  };

  const rebuildRangesFromExpanded = () => {
    const ranges: { start: number; end: number }[] = [];
    const flatTree = flatTreeRef.value;
    const idToFlatIndex = new Map<string | number, number>();
    for (let i = 0; i < flatTree.length; i++) {
      idToFlatIndex.set(flatTree[i].id, i);
    }

    const isVisibleAt = (idx: number): boolean => {
      let current = flatTree[idx];
      while (current) {
        if (current.parentId === null) return true;
        const parentIndex = idToFlatIndex.get(current.parentId);
        if (parentIndex === undefined) return false;
        const parent = flatTree[parentIndex];
        if (!expandedKeys.value.has(parent.id)) return false;
        current = parent;
      }
      return false;
    };

    let current: { start: number; end: number } | null = null;
    for (let i = 0; i < flatTree.length; i++) {
      if (isVisibleAt(i)) {
        if (!current) current = { start: i, end: i };
        else current.end = i;
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
        sibling.isExpanded = false;
      });
    }
    node.isExpanded = true;
    expandedKeys.value.add(node.id);
    rebuildRangesFromExpanded();
  };

  const collapseNode = (node: FlatTreeNode) => {
    expandedKeys.value.delete(node.id);
    node.isExpanded = false;
    rebuildRangesFromExpanded();
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
      } else if (!expand && node.isExpanded) {
        expandedKeys.value.delete(node.id);
        node.isExpanded = false;
      }
    });
    rebuildRangesFromExpanded();
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
    rebuildRangesFromExpanded,
  };
}
