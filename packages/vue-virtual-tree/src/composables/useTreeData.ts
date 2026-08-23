import { nextTick, onUnmounted, ref, watch } from "vue";
import type {
  TreeNodeData,
  FlatTreeNode,
  TreePropsConfig,
  VirtualTreeProps,
  VirtualTreeEmits,
} from "../types";
import type { VisibleRange } from "@wxwzl/vue-virtual-scroller";
import { getNodeId, getNodeChildren, isNodeDisabled, isLeafNode } from "../utils/tree";
import { useTreeSelection } from "../composables/useTreeSelection";
import { useTreeExpand } from "./useTreeExpand";
import { useTreeFilter } from "./useTreeFilter";
import { useTreeDrag } from "./useTreeDrag";

/**
 * Emit function type helper
 */
type EmitFn<T> = <K extends keyof T>(event: K, ...args: T[K] extends any[] ? T[K] : never) => void;

/**
 * 扁平化树形数据
 */
export function useTreeData(props: VirtualTreeProps, emit: EmitFn<VirtualTreeEmits>) {
  const flatTree = ref<FlatTreeNode[]>([]);
  const rawData = ref<TreeNodeData[]>(props.data);
  // 使用 Map 建立索引，O(1) 查找
  const flatNodeMap = ref<Map<string | number, FlatTreeNode>>(new Map());
  const isFiltered = ref(false);

  // 根据 key 获取节点数据
  const getNodeData = (id: string | number): TreeNodeData | null => {
    const flatNode = flatNodeMap.value.get(id);
    return flatNode ? flatNode.data : null;
  };

  // 根据 key 获取扁平节点
  const getFlatNode = (id: string | number): FlatTreeNode | null => {
    return flatNodeMap.value.get(id) || null;
  };

  // 选择逻辑
  const {
    checkedKeys,
    halfCheckedKeys,
    selectedKey,
    currentNode,
    toggleNodeChecked,
    setCurrentNode: setSelectionCurrentNode,
    getCheckedNodes,
    getCheckedKeys,
    setCheckedNodes,
    setCheckedKeys,
    initNodeChecked,
  } = useTreeSelection(props, flatTree, getNodeData, getFlatNode);

  // 展开/折叠逻辑
  const {
    expandNode,
    collapseNode,
    expandedKeys,
    initExpandedKeys,
    visibleRanges,
    visibleCount,
    getFlatIndexAtVisibleIndex,
    getVisibleIndexAtFlatIndex,
    rebuildRangesFromExpanded,
  } = useTreeExpand(props, flatTree);

  // 根据可见索引获取节点
  const getVisibleNodeAt = (visibleIndex: number): FlatTreeNode | null => {
    const flatIndex = getFlatIndexAtVisibleIndex(visibleIndex);
    return flatTree.value[flatIndex] ?? null;
  };

  // 过滤逻辑
  const { filter } = useTreeFilter(
    props,
    flatTree,
    flatNodeMap,
    isFiltered,
    expandedKeys,
    (filteredNodes: FlatTreeNode[] | null) => {
      if (filteredNodes === null) {
        // 清除过滤：展开所有非叶子节点并重建可见范围
        isFiltered.value = false;
        flatTree.value.forEach((node) => {
          if (!node.isLeaf) {
            node.isExpanded = true;
            expandedKeys.value.add(node.id);
          }
        });
        rebuildRangesFromExpanded();
      } else {
        // 应用过滤结果：按原始 index 构建可见区间
        isFiltered.value = true;
        expandedKeys.value.clear();
        const ranges: VisibleRange[] = [];
        let current: VisibleRange | null = null;
        for (const node of filteredNodes) {
          if (node.children && node.children.length > 0) {
            node.isExpanded = true;
            expandedKeys.value.add(node.id);
          }
          if (current && node.index === current.end + 1) {
            current.end = node.index;
          } else {
            if (current) ranges.push(current);
            current = { start: node.index, end: node.index };
          }
        }
        if (current) ranges.push(current);
        visibleRanges.value = ranges;
      }
    }
  );

  // 拖拽逻辑
  const dragState = useTreeDrag(props, getNodeData);

  // 扁平化树形数据
  const flattenTree = (
    nodes: TreeNodeData[],
    level: number = 0,
    parentNode: FlatTreeNode | null = null,
    startIndex: number = 0,
    visible: boolean = true,
    config?: TreePropsConfig,
    targetContainer?: FlatTreeNode[],
    targetMap?: Map<string | number, FlatTreeNode>
  ): {
    nodes: FlatTreeNode[];
    flatNodes: FlatTreeNode[];
    nodeMap: Map<string | number, FlatTreeNode>;
  } => {
    const map = targetMap || new Map<string | number, FlatTreeNode>();
    const container = targetContainer || [];
    function generateFlatNodes(
      nodes: TreeNodeData[],
      level: number = 0,
      parentNode: FlatTreeNode | null = null,
      startIndex: number = 0,
      visible: boolean = true,
      config?: TreePropsConfig
    ) {
      const result: FlatTreeNode[] = [];
      let length = nodes.length;
      let currentIndex = startIndex;
      for (let i = 0; i < length; i++) {
        const node: TreeNodeData = nodes[i];
        const id = getNodeId(node, config);
        const children = getNodeChildren(node, config);
        const isExpanded = expandedKeys.value.has(id);
        const isLeaf = isLeafNode(node, config);

        const flatNode: FlatTreeNode = {
          id,
          data: node,
          level,
          parentId: parentNode?.id || null,
          index: currentIndex,
          isExpanded,
          isDisabled: isNodeDisabled(node, config),
          isLeaf: isLeaf,
          isLoading: false,
          isLoaded: false,
          isChecked: false,
          rawChildren: children.length > 0 ? children : undefined,
          firstDescendantIndex: currentIndex,
          lastDescendantIndex: currentIndex,
        };
        result.push(flatNode);
        container.push(flatNode);
        // 如果节点展开且有子节点，递归处理子节点
        if (children.length > 0) {
          const childStartIndex = currentIndex + 1;
          const { nodes: childNodes, index } = generateFlatNodes(
            children,
            level + 1,
            flatNode,
            childStartIndex,
            isExpanded && visible,
            config
          );
          flatNode.children = childNodes;
          flatNode.firstDescendantIndex = childStartIndex;
          flatNode.lastDescendantIndex = index;
          currentIndex = index;
        }
        map.set(id, flatNode);
        currentIndex++;
      }

      return { nodes: result, index: currentIndex - 1 };
    }

    const { nodes: result } = generateFlatNodes(
      nodes,
      level,
      parentNode,
      startIndex,
      visible,
      config
    );
    return { nodes: result, flatNodes: container, nodeMap: map };
  };

  // 快速估算节点总数，超过 maxCount 时提前返回
  const countNodes = (
    nodes: TreeNodeData[],
    config?: TreePropsConfig,
    maxCount: number = 5000
  ): number => {
    let count = 0;
    const stack: TreeNodeData[] = nodes.slice();
    while (stack.length > 0) {
      const node = stack.pop()!;
      count++;
      if (count > maxCount) return count;
      const children = getNodeChildren(node, config);
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(children[i]);
      }
    }
    return count;
  };

  interface FlattenFrame {
    nodes: TreeNodeData[];
    level: number;
    parentNode: FlatTreeNode | null;
    i: number;
    result: FlatTreeNode[];
  }

  // 分片异步扁平化：超过阈值时按节点数分批处理，让出主线程
  const flattenTreeAsync = (
    nodes: TreeNodeData[],
    level: number = 0,
    parentNode: FlatTreeNode | null = null,
    startIndex: number = 0,
    _visible: boolean = true,
    config?: TreePropsConfig,
    chunkSize: number = 2000
  ): Promise<{
    nodes: FlatTreeNode[];
    flatNodes: FlatTreeNode[];
    nodeMap: Map<string | number, FlatTreeNode>;
  }> => {
    return new Promise((resolve) => {
      const map = new Map<string | number, FlatTreeNode>();
      const container: FlatTreeNode[] = [];
      const rootResult: FlatTreeNode[] = [];
      const stack: FlattenFrame[] = [];
      let nextIndex = startIndex;

      stack.push({
        nodes,
        level,
        parentNode,
        i: 0,
        result: rootResult,
      });

      const processChunk = () => {
        let batchCount = 0;
        while (stack.length > 0 && batchCount < chunkSize) {
          const frame = stack[stack.length - 1];
          if (frame.i >= frame.nodes.length) {
            stack.pop();
            if (frame.parentNode) {
              frame.parentNode.children = frame.result;
              frame.parentNode.lastDescendantIndex = nextIndex - 1;
              if (frame.result.length > 0) {
                frame.parentNode.firstDescendantIndex = frame.result[0].index;
              }
            }
            continue;
          }

          const node: TreeNodeData = frame.nodes[frame.i];
          const id = getNodeId(node, config);
          const children = getNodeChildren(node, config);
          const isExpanded = expandedKeys.value.has(id);
          const isLeaf = isLeafNode(node, config);
          const index = nextIndex++;

          const flatNode: FlatTreeNode = {
            id,
            data: node,
            level: frame.level,
            parentId: frame.parentNode?.id || null,
            index,
            isExpanded,
            isDisabled: isNodeDisabled(node, config),
            isLeaf,
            isLoading: false,
            isLoaded: false,
            isChecked: false,
            rawChildren: children.length > 0 ? children : undefined,
            firstDescendantIndex: index,
            lastDescendantIndex: index,
          };

          frame.result.push(flatNode);
          container.push(flatNode);
          map.set(id, flatNode);
          frame.i++;
          batchCount++;

          if (children.length > 0) {
            stack.push({
              nodes: children,
              level: frame.level + 1,
              parentNode: flatNode,
              i: 0,
              result: [],
            });
          }
        }

        if (stack.length > 0) {
          requestAnimationFrame(processChunk);
        } else {
          resolve({ nodes: rootResult, flatNodes: container, nodeMap: map });
        }
      };

      processChunk();
    });
  };

  // 更新扁平化数据 - 优化大数据量的性能
  // 防抖更新标记
  let updatePending = false;
  const updateFlatTree = async () => {
    if (updatePending) return; // 如果已经有更新在等待中，跳过
    updatePending = true;
    const shouldAsync = countNodes(rawData.value, props.props, 5000) > 5000;
    const { flatNodes, nodeMap } = shouldAsync
      ? await flattenTreeAsync(rawData.value, 0, null, 0, true, props.props)
      : flattenTree(rawData.value, 0, null, 0, true, props.props);
    flatTree.value = flatNodes;
    flatNodeMap.value = nodeMap;
    initExpandedKeys();
    updatePending = false;
  };

  const insertFlatTree = (node: FlatTreeNode, children: TreeNodeData[]) => {
    const {
      nodes: result,
      flatNodes: container,
      nodeMap,
    } = flattenTree(children, node.level + 1, node, node.index + 1, true, props.props);
    node.children = result;
    nodeMap.forEach((value, key) => {
      flatNodeMap.value.set(key, value);
    });
    flatTree.value.splice(node.index + 1, 0, ...container);
    for (let i = node.index + container.length; i < flatTree.value.length; i++) {
      const child = flatTree.value[i];
      child.index = i;
    }
  };
  const regenerateState: RegenerateOptions = {
    needEmit: true,
    resetExpanded: true,
    resetChecked: true,
  };
  // 只在数据变化时重新生成flatTree
  watch(
    () => props.data,
    (newData) => {
      rawData.value = newData;
      regenerateState.needEmit = true;
      regenerateState.resetChecked = true;
      regenerateFlatTree();
    },
    { deep: true }
  );

  // 监听 defaultExpandedKeys 和 defaultExpandAll 变化时重新生成
  watch(
    () => [props.defaultExpandedKeys, props.defaultExpandAll],
    () => {
      regenerateState.resetExpanded = true;
      regenerateFlatTree();
    },
    { deep: true, immediate: false }
  );

  // 监听 defaultCheckedKeys 变化时重新生成
  watch(
    () => props.defaultCheckedKeys,
    () => {
      regenerateState.resetChecked = true;
      regenerateFlatTree();
    },
    { deep: true, immediate: false }
  );
  let regenerateTimer: ReturnType<typeof setTimeout> | null = null;

  type RegenerateOptions = {
    resetExpanded?: boolean;
    resetChecked?: boolean;
    needEmit?: boolean;
  };

  // 重新生成flatTree的函数（只在必要时调用）
  const regenerateFlatTree = () => {
    if (regenerateTimer) {
      clearTimeout(regenerateTimer);
    }
    regenerateTimer = setTimeout(async () => {
      if (regenerateState.resetExpanded) {
        initExpandedKeys();
      }
      await updateFlatTree();
      if (regenerateState.resetChecked) {
        initNodeChecked();
      }
      if (regenerateState.needEmit) {
        nextTick(() => {
          emit("node-generated");
        });
      }
      regenerateState.needEmit = false;
      regenerateState.resetExpanded = false;
      regenerateState.resetChecked = false;
      regenerateTimer = null;
    }, 5);
  };

  // 初始化
  regenerateFlatTree();

  // 组件卸载时清理定时器
  onUnmounted(() => {
    if (regenerateTimer) {
      clearTimeout(regenerateTimer);
      regenerateTimer = null;
    }
  });

  return {
    flatTree,
    visibleRanges,
    visibleCount,
    expandedKeys,
    checkedKeys,
    rawData,
    getNodeData,
    getFlatNode,
    getVisibleNodeAt,
    getVisibleIndexAtFlatIndex,
    getFlatIndexAtVisibleIndex,
    regenerateFlatTree,
    flattenTree,
    insertFlatTree,
    halfCheckedKeys,
    selectedKey,
    currentNode,
    toggleNodeChecked,
    setCurrentNode: setSelectionCurrentNode,
    getCheckedNodes,
    getCheckedKeys,
    setCheckedNodes,
    setCheckedKeys,
    expandNode,
    collapseNode,
    dragState,
    filter,
  };
}
