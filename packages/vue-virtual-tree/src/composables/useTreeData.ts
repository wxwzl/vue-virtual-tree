import { computed, nextTick, onUnmounted, ref, shallowReactive, shallowRef, watch } from "vue";
import type {
  TreeNodeData,
  FlatTreeNode,
  TreePropsConfig,
  VirtualTreeProps,
  VirtualTreeEmits,
} from "../types";
import {
  resolveTreeConfig,
  getNodeIdByConfig,
  getNodeChildrenByConfig,
  isNodeDisabledByConfig,
  isLeafNodeByConfig,
} from "../utils/tree";
import { useTreeSelection } from "../composables/useTreeSelection";
import { useTreeExpand } from "./useTreeExpand";
import { useTreeFilter } from "./useTreeFilter";
import { useTreeDrag } from "./useTreeDrag";

/**
 * Emit function type helper
 */
type EmitFn<T> = <K extends keyof T>(event: K, ...args: T[K] extends any[] ? T[K] : never) => void;

/**
 * 扁平化结果
 */
interface FlattenResult {
  nodes: FlatTreeNode[];
  flatNodes: FlatTreeNode[];
  nodeMap: Map<string | number, FlatTreeNode>;
  visibleNodes: FlatTreeNode[];
}

/**
 * 扁平化栈帧（迭代遍历用）
 */
interface FlattenFrame {
  nodes: TreeNodeData[];
  level: number;
  parentId: string | number | null;
  visible: boolean;
  result: FlatTreeNode[];
  i: number;
  /** 等待子树结果挂载的父扁平节点 */
  pendingNode: FlatTreeNode | null;
}

/** 单个时间片预算（ms），超过则让出主线程，避免页面卡顿 */
const FLATTEN_SLICE_BUDGET = 8;

const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * 让出主线程，优先使用 scheduler.yield，降级 MessageChannel（宏任务，不阻塞渲染与交互）
 */
const yieldToMain = (): Promise<void> => {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler && typeof scheduler.yield === "function") {
    return scheduler.yield();
  }
  if (typeof MessageChannel !== "undefined") {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve();
      channel.port2.postMessage(null);
    });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
};

/**
 * 创建扁平化步进器
 * 迭代式 DFS，与递归版本语义一致（index 单调递增、先序排列），
 * 同时支持分片执行：每次 step 处理一个节点，可随时中断/恢复。
 *
 * 扁平节点使用 shallowReactive：仅节点自身字段（isChecked/isExpanded 等）响应式，
 * 嵌套的 data/children 不做深度 Proxy，大幅降低大数据量初始化开销。
 */
function createFlattener(
  rootNodes: TreeNodeData[],
  startLevel: number,
  parentNode: FlatTreeNode | null,
  startIndex: number,
  rootVisible: boolean,
  config: Required<TreePropsConfig>,
  expandedKeys: Set<string | number>
) {
  const nodeMap = new Map<string | number, FlatTreeNode>();
  const flatNodes: FlatTreeNode[] = [];
  const visibleList: FlatTreeNode[] = [];
  const rootResult: FlatTreeNode[] = [];
  let index = startIndex;
  const stack: FlattenFrame[] = [
    {
      nodes: rootNodes,
      level: startLevel,
      parentId: parentNode?.id ?? null,
      visible: rootVisible,
      result: rootResult,
      i: 0,
      pendingNode: null,
    },
  ];

  /** 处理一个节点，返回 false 表示全部完成 */
  const step = (): boolean => {
    let frame = stack[stack.length - 1];
    // 弹出已完成的层，并把结果挂载到父扁平节点的 children 上
    while (frame && frame.i >= frame.nodes.length) {
      stack.pop();
      const parentFrame = stack[stack.length - 1];
      if (parentFrame && parentFrame.pendingNode) {
        parentFrame.pendingNode.children = frame.result;
        parentFrame.pendingNode = null;
      }
      frame = stack[stack.length - 1];
    }
    if (!frame) {
      return false;
    }

    const node = frame.nodes[frame.i++];
    index++;
    const id = getNodeIdByConfig(node, config);
    const children = getNodeChildrenByConfig(node, config);
    const isExpanded = expandedKeys.has(id);

    const flatNode = shallowReactive({
      id,
      data: node,
      level: frame.level,
      parentId: frame.parentId,
      index,
      isExpanded,
      isDisabled: isNodeDisabledByConfig(node, config),
      isLeaf: isLeafNodeByConfig(node, config),
      isLoading: false,
      isLoaded: false,
      isChecked: false,
      rawChildren: children.length > 0 ? children : undefined,
    }) as FlatTreeNode;

    frame.result.push(flatNode);
    flatNodes.push(flatNode);
    if (frame.visible) {
      visibleList.push(flatNode);
    }
    nodeMap.set(id, flatNode);

    if (children.length > 0) {
      frame.pendingNode = flatNode;
      stack.push({
        nodes: children,
        level: frame.level + 1,
        parentId: id,
        visible: frame.visible && isExpanded,
        result: [],
        i: 0,
        pendingNode: null,
      });
    }
    return true;
  };

  const finish = (): FlattenResult => ({
    nodes: rootResult,
    flatNodes,
    nodeMap,
    visibleNodes: visibleList,
  });

  return { step, finish };
}

/**
 * 扁平化树形数据
 */
export function useTreeData(props: VirtualTreeProps, emit: EmitFn<VirtualTreeEmits>) {
  // 使用 shallowRef：数组/Map 整体替换才触发更新，避免深度 Proxy 全量数据
  const flatTree = shallowRef<FlatTreeNode[]>([]);
  const rawData = shallowRef<TreeNodeData[]>(props.data);
  // 使用 Map 建立索引，O(1) 查找
  const flatNodeMap = shallowRef<Map<string | number, FlatTreeNode>>(new Map());
  const visibleNodes = shallowRef<FlatTreeNode[]>([]);
  const filteredFlatTree = shallowRef<FlatTreeNode[]>([]);
  const filteredFlatNodeMap = shallowRef<Map<string | number, FlatTreeNode>>(new Map());
  const isFiltered = ref(false);
  /** 初始化/大数据量重建进行中（分片处理期间为 true），用于展示 loading，避免空白闪烁 */
  const initializing = ref(false);
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
    batchUpdateAllStates,
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

  /**
   * 同步扁平化（迭代实现，无递归栈溢出风险）
   * 用于懒加载子树等小数据量场景
   */
  const flattenTree = (
    nodes: TreeNodeData[],
    level: number = 0,
    parentNode: FlatTreeNode | null = null,
    startIndex: number = 0,
    visible: boolean = true,
    config?: TreePropsConfig
  ): FlattenResult => {
    const flattener = createFlattener(
      nodes,
      level,
      parentNode,
      startIndex,
      visible,
      resolveTreeConfig(config),
      expandedKeys.value
    );
    while (flattener.step()) {
      // 同步跑完
    }
    return flattener.finish();
  };

  /** 扁平化任务版本号：新任务使进行中的旧任务作废 */
  let flattenVersion = 0;

  /**
   * 分片异步扁平化：每个时间片（约 8ms）处理一批节点后让出主线程，
   * 大数据量初始化时页面保持可交互，不会卡顿/无响应。
   * 若期间有新的扁平化任务产生，返回 null（结果作废）。
   */
  const flattenTreeAsync = async (
    nodes: TreeNodeData[],
    level: number,
    parentNode: FlatTreeNode | null,
    startIndex: number,
    visible: boolean,
    config?: TreePropsConfig
  ): Promise<FlattenResult | null> => {
    const version = flattenVersion;
    const flattener = createFlattener(
      nodes,
      level,
      parentNode,
      startIndex,
      visible,
      resolveTreeConfig(config),
      expandedKeys.value
    );
    let deadline = now() + FLATTEN_SLICE_BUDGET;
    while (flattener.step()) {
      if (now() >= deadline) {
        await yieldToMain();
        if (version !== flattenVersion) {
          return null;
        }
        deadline = now() + FLATTEN_SLICE_BUDGET;
      }
    }
    return flattener.finish();
  };

  /**
   * 更新扁平化数据 - 分片执行，过期结果自动丢弃
   */
  const updateFlatTree = async () => {
    const version = ++flattenVersion;
    const result = await flattenTreeAsync(rawData.value, 0, null, 0, true, props.props);
    if (!result || version !== flattenVersion) {
      return;
    }
    flatTree.value = result.flatNodes;
    flatNodeMap.value = result.nodeMap;
    setVisibleNodes(result.visibleNodes);
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
    // 就地插入，避免 splice + spread 在大子树下的栈溢出与中间数组开销
    const array = flatTree.value;
    const insertAt = node.index + 1;
    const oldLength = array.length;
    array.length = oldLength + container.length;
    for (let i = oldLength - 1; i >= insertAt; i--) {
      array[i + container.length] = array[i];
    }
    for (let i = 0; i < container.length; i++) {
      array[insertAt + i] = container[i];
    }
    // 重建 index 单调递增不变量（flatTree[i].index === i + 1），保证二分查找有效
    for (let i = insertAt; i < array.length; i++) {
      array[i].index = i + 1;
    }
    // 懒加载子树插入后，重算选中/半选状态
    if (props.showCheckbox && !props.checkStrictly) {
      batchUpdateAllStates();
    }
  };
  /**
   * 替换指定节点的数据（节点级局部更新）
   * - 新数据不包含 children 时保留原子树，原地更新（O(1) 视图刷新，不重建整树）
   * - 新数据包含 children 时整体替换子树，走全量分片重建
   * - 新数据 key 与原 key 不同时，自动迁移展开/勾选/半选/当前选中状态与索引
   */
  const replaceNode = (data: TreeNodeData, key: string | number): boolean => {
    // 过滤状态下克隆节点与原节点已分离，直接走全量重建
    if (isFiltered.value) {
      return replaceNodeWithRebuild(data, key);
    }
    const flatNode = getFlatNode(key);
    if (!flatNode) {
      return false;
    }
    const config = resolveTreeConfig(props.props);
    if (!replaceRawNode(rawData.value, key, data, config)) {
      return false;
    }

    const newChildren = getNodeChildrenByConfig(data, config);
    if (newChildren.length > 0) {
      // 子树结构变化：全量分片重建
      regenerateState.needEmit = true;
      regenerateFlatTree();
      return true;
    }

    // 保留原子树
    if (flatNode.rawChildren && flatNode.rawChildren.length > 0) {
      data[config.children] = flatNode.rawChildren;
    }
    const newId = getNodeIdByConfig(data, config);
    flatNode.data = data;
    flatNode.isDisabled = isNodeDisabledByConfig(data, config);
    flatNode.isLeaf = isLeafNodeByConfig(data, config);

    // key 变化时迁移索引与状态
    if (newId !== key) {
      flatNode.id = newId;
      flatNodeMap.value.delete(key);
      flatNodeMap.value.set(newId, flatNode);
      if (flatNode.children) {
        for (const child of flatNode.children) {
          child.parentId = newId;
        }
      }
      for (const set of [expandedKeys.value, checkedKeys.value, halfCheckedKeys.value]) {
        if (set.delete(key)) {
          set.add(newId);
        }
      }
      if (selectedKey.value === key) {
        selectedKey.value = newId;
      }
    }
    return true;
  };

  /** 在原始数据中替换节点引用 */
  const replaceRawNode = (
    arr: TreeNodeData[],
    key: string | number,
    data: TreeNodeData,
    config: Required<TreePropsConfig>
  ): boolean => {
    for (let i = 0; i < arr.length; i++) {
      if (getNodeIdByConfig(arr[i], config) === key) {
        arr[i] = data;
        return true;
      }
      const children = getNodeChildrenByConfig(arr[i], config);
      if (children.length > 0 && replaceRawNode(children, key, data, config)) {
        return true;
      }
    }
    return false;
  };

  /** 全量重建方式的节点替换（过滤状态/子树变化时使用） */
  const replaceNodeWithRebuild = (data: TreeNodeData, key: string | number): boolean => {
    const config = resolveTreeConfig(props.props);
    if (!replaceRawNode(rawData.value, key, data, config)) {
      return false;
    }
    regenerateState.needEmit = true;
    regenerateFlatTree();
    return true;
  };

  /**
   * 清理已不存在节点的残留状态（展开/勾选/半选）
   * 修复 remove/replace 后 checkedKeys 等集合残留已删除 key 的问题
   */
  const pruneStaleState = () => {
    const map = flatNodeMap.value;
    for (const key of [...expandedKeys.value]) {
      if (!map.has(key)) {
        expandedKeys.value.delete(key);
      }
    }
    for (const key of [...checkedKeys.value]) {
      if (!map.has(key)) {
        checkedKeys.value.delete(key);
      }
    }
    for (const key of [...halfCheckedKeys.value]) {
      if (!map.has(key)) {
        halfCheckedKeys.value.delete(key);
      }
    }
  };

  const regenerateState: RegenerateOptions = {
    needEmit: true,
    resetExpanded: true,
    resetChecked: true,
  };
  // 只在数据变化时重新生成flatTree（浅监听：数组引用变化才触发；
  // 原地修改请使用 append/remove/insertBefore/insertAfter/updateKeyChildren 方法）
  watch(
    () => props.data,
    (newData) => {
      // replace() 已同步过同一引用的数据，跳过重复重建
      if (newData === rawData.value) {
        return;
      }
      rawData.value = newData;
      regenerateState.needEmit = true;
      regenerateState.resetChecked = true;
      regenerateFlatTree();
    }
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

  /** 重建周期号：新周期使进行中的旧周期作废 */
  let regenCycle = 0;

  // 重新生成flatTree的函数（只在必要时调用）
  const regenerateFlatTree = () => {
    if (regenerateTimer) {
      clearTimeout(regenerateTimer);
    }
    initializing.value = true;
    const cycle = ++regenCycle;
    regenerateTimer = setTimeout(async () => {
      regenerateTimer = null;
      if (regenerateState.resetExpanded) {
        initExpandedKeys();
      }
      await updateFlatTree();
      if (cycle !== regenCycle) {
        return; // 已有新的重建任务，状态由其负责收尾
      }
      // 先清理残留状态，再按需重置选中
      pruneStaleState();
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
      initializing.value = false;
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
    // 使进行中的扁平化任务作废
    flattenVersion++;
    regenCycle++;
  });

  return {
    flatTree,
    visibleNodes,
    expandedKeys,
    checkedKeys,
    rawData,
    initializing,
    getNodeData,
    getFlatNode,
    regenerateFlatTree,
    replaceNode,
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
