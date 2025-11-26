import { ref, type Ref } from "vue";
import type { VirtualTreeProps, FlatTreeNode } from "../types";
import { getNodeLabel } from "../utils/tree";

/**
 * 归并排序：按 index 从小到大排序
 */
function mergeSort(nodes: FlatTreeNode[]): FlatTreeNode[] {
  if (nodes.length <= 1) {
    return nodes;
  }

  const mid = Math.floor(nodes.length / 2);
  const left = mergeSort(nodes.slice(0, mid));
  const right = mergeSort(nodes.slice(mid));

  return merge(left, right);
}

/**
 * 合并两个有序数组
 */
function merge(left: FlatTreeNode[], right: FlatTreeNode[]): FlatTreeNode[] {
  const result: FlatTreeNode[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (left[i].index <= right[j].index) {
      result.push(left[i]);
      i++;
    } else {
      result.push(right[j]);
      j++;
    }
  }

  // 将剩余元素添加到结果数组
  while (i < left.length) {
    result.push(left[i]);
    i++;
  }

  while (j < right.length) {
    result.push(right[j]);
    j++;
  }

  return result;
}

/**
 * 树节点过滤逻辑
 */
export function useTreeFilter(
  props: VirtualTreeProps,
  flatTree: Ref<FlatTreeNode[]>,
  flatNodeMap: Ref<Map<string | number, FlatTreeNode>>,
  filteredFlatTree: Ref<FlatTreeNode[]>,
  filteredFlatNodeMap: Ref<Map<string | number, FlatTreeNode>>,
  isFiltered: Ref<boolean>,
  expandedKeys: Ref<Set<string | number>>,
  setVisibleNodes: (nodes: FlatTreeNode[]) => void
) {
  const rebuildVisibleNodes = () => {
    const roots = flatTree.value.filter((node) => node.parentId === null);
    const result: FlatTreeNode[] = [];
    const traverse = (node: FlatTreeNode) => {
      result.push(node);
      if (node.isExpanded && node.children) {
        node.children.forEach((child) => traverse(child));
      }
    };
    roots.forEach((root) => traverse(root));
    setVisibleNodes(result);
  };

  // 默认过滤方法
  const defaultFilterMethod = (value: string, data: any): boolean => {
    if (!value) return true;
    const label = getNodeLabel(data, props.props);
    return label.toLowerCase().includes(value.toLowerCase());
  };
  /**
   * 克隆节点（浅拷贝基本属性，children 需要重新构造）
   */
  const cloneNode = (node: FlatTreeNode): FlatTreeNode => {
    return {
      ...node,
      children: undefined, // children 需要重新构造
    };
  };

  const filterText = ref("");
  // 过滤节点
  const filter = (value: string) => {
    filterText.value = value;
    filteredFlatTree.value = [];
    filteredFlatNodeMap.value = new Map();
    if (!value) {
      isFiltered.value = false;
      flatTree.value.forEach((node) => {
        if (!node.isLeaf) {
          node.isExpanded = true;
          expandedKeys.value.add(node.id);
        }
      });
      rebuildVisibleNodes();
      return Promise.resolve();
    }
    isFiltered.value = true;
    expandedKeys.value.clear();
    return new Promise(async (resolve) => {
      const filterMethod = props.filterNodeMethod || defaultFilterMethod;

      // 第一步：收集所有匹配的节点（包括需要显示的父节点），并克隆它们
      const clonedNodes = new Map<string | number, FlatTreeNode>();

      // 收集直接匹配的节点并克隆
      flatTree.value.forEach((node) => {
        if (filterMethod(value, node.data)) {
          // 克隆匹配的节点
          if (!clonedNodes.has(node.id)) {
            clonedNodes.set(node.id, cloneNode(node));
          }

          // 收集并克隆所有父节点
          let parentId: string | number | null = node.parentId;
          while (parentId) {
            const parentNode = flatNodeMap.value.get(parentId);
            if (parentNode && !clonedNodes.has(parentId)) {
              clonedNodes.set(parentId, cloneNode(parentNode));
            }
            parentId = parentNode?.parentId || null;
          }
        }
      });

      // 第二步：根据 parentId 关系重建每个节点的 children 属性
      clonedNodes.forEach((clonedNode) => {
        filteredFlatNodeMap.value.set(clonedNode.id, clonedNode);
        // 查找所有子节点（在 clonedNodes 中的）
        const children: FlatTreeNode[] = [];
        clonedNodes.forEach((childNode) => {
          if (childNode.parentId === clonedNode.id) {
            children.push(childNode);
          }
        });

        // 按 index 排序子节点，保持原始顺序
        if (children.length > 0) {
          clonedNode.children = mergeSort(children);
          clonedNode.isExpanded = true;
          expandedKeys.value.add(clonedNode.id);
        } else {
          clonedNode.children = undefined;
          clonedNode.isLeaf = true;
        }
      });

      // 第三步：按 index 排序
      const sortedNodes = mergeSort(Array.from(clonedNodes.values()));

      setVisibleNodes(sortedNodes);
      filteredFlatTree.value = sortedNodes;
      resolve(void 0);
    });
  };
  // 清空过滤
  const clearFilter = () => {
    filter("");
  };

  return {
    filterText,
    filter,
    clearFilter,
  };
}
