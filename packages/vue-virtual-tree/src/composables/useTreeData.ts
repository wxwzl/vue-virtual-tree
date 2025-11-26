import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import type {
  TreeNodeData,
  FlatTreeNode,
  TreePropsConfig,
  VirtualTreeProps,
  VirtualTreeEmits,
} from "../types";
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
  const visibleNodes = ref<FlatTreeNode[]>([]);
  const filteredFlatTree = ref<FlatTreeNode[]>([]);
  const filteredFlatNodeMap = ref<Map<string | number, FlatTreeNode>>(new Map());
  const isFiltered = ref(false);
  const treeDataWrapper = computed(() => {
    return isFiltered.value ? filteredFlatTree.value : flatTree.value;
  });
  const treeDataMapWrapper = computed(() => {
    return isFiltered.value ? filteredFlatNodeMap.value : flatNodeMap.value;
  });
  const setVisibleNodes = (nodes: FlatTreeNode[]) => {
    visibleNodes.value = nodes;
  };

  // 根据 key 获取节点数据
  const getNodeData = (id: string | number): TreeNodeData | null => {
    const flatNode = treeDataMapWrapper.value.get(id);
    return flatNode ? flatNode.data : null;
  };

  // 根据 key 获取扁平节点
  const getFlatNode = (id: string | number): FlatTreeNode | null => {
    return treeDataMapWrapper.value.get(id) || null;
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
  const { expandNode, collapseNode, expandedKeys, initExpandedKeys } = useTreeExpand(
    props,
    treeDataWrapper,
    visibleNodes
  );

  // 过滤逻辑
  const { filter } = useTreeFilter(
    props,
    flatTree,
    flatNodeMap,
    filteredFlatTree,
    filteredFlatNodeMap,
    isFiltered,
    expandedKeys,
    setVisibleNodes
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
    config?: TreePropsConfig
  ): {
    nodes: FlatTreeNode[];
    flatNodes: FlatTreeNode[];
    nodeMap: Map<string | number, FlatTreeNode>;
    visibleNodes: FlatTreeNode[];
  } => {
    const map = new Map<string | number, FlatTreeNode>();
    const visibleList: FlatTreeNode[] = [];
    function genenrateFlatNodes(
      nodes: TreeNodeData[],
      level: number = 0,
      parentNode: FlatTreeNode | null = null,
      startIndex: number = 0,
      visible: boolean = true,
      container: FlatTreeNode[] = [],
      config?: TreePropsConfig
    ) {
      const result: FlatTreeNode[] = [];
      let length = nodes.length;
      for (let i = 0; i < length; i++) {
        startIndex++;
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
          index: startIndex,
          isExpanded,
          isDisabled: isNodeDisabled(node, config),
          isLeaf: isLeaf,
          isLoading: false,
          isLoaded: false,
          isChecked: false,
          rawChildren: children.length > 0 ? children : undefined,
        };
        result.push(flatNode);
        container.push(flatNode);
        if (visible) {
          visibleList.push(flatNode);
        }
        // 如果节点展开且有子节点，递归处理子节点
        if (children.length > 0) {
          const { nodes: childNodes, index } = genenrateFlatNodes(
            children,
            level + 1,
            flatNode,
            startIndex,
            isExpanded && visible,
            container,
            config
          );
          flatNode.children = childNodes;
          startIndex = index;
        }
        map.set(id, flatNode);
      }

      return { nodes: result, index: startIndex };
    }

    const container: FlatTreeNode[] = [];
    const { nodes: result } = genenrateFlatNodes(
      nodes,
      level,
      parentNode,
      startIndex,
      visible,
      container,
      config
    );
    return { nodes: result, flatNodes: container, nodeMap: map, visibleNodes: visibleList };
  };

  // 更新扁平化数据 - 优化大数据量的性能
  // 防抖更新标记
  let updatePending = false;
  const updateFlatTree = () => {
    if (updatePending) return; // 如果已经有更新在等待中，跳过
    updatePending = true;
    const {
      flatNodes,
      nodeMap,
      visibleNodes: visibleNodesResult,
    } = flattenTree(rawData.value, 0, null, 0, true, props.props);
    flatTree.value = flatNodes;
    flatNodeMap.value = nodeMap;
    setVisibleNodes(visibleNodesResult);
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
    requestAnimationFrame(() => {
      for (let i = node.index + container.length; i < flatTree.value.length; i++) {
        const child = flatTree.value[i];
        child.index = i;
      }
    });
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
    regenerateTimer = setTimeout(() => {
      if (regenerateState.resetExpanded) {
        initExpandedKeys();
      }
      updateFlatTree();
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
    visibleNodes,
    expandedKeys,
    checkedKeys,
    rawData,
    getNodeData,
    getFlatNode,
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
