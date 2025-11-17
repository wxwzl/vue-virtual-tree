import { ref, computed, watch, nextTick, unref } from 'vue'
import type { TreeNodeData, FlatTreeNode, TreePropsConfig, VirtualTreeProps } from '../types'
import { getNodeId, getNodeChildren, isNodeDisabled, isLeafNode, getAllKeys } from '../utils/tree'

/**
 * 扁平化树形数据
 */
export function useTreeData(props: VirtualTreeProps) {
  const expandedKeys = ref<Set<string | number>>(new Set())
  const flatTree = ref<FlatTreeNode[]>([])
  const rawData = ref<TreeNodeData[]>(props.data)

  // 节点状态缓存，用于保存 isLoading 和 isLoaded 状态
  const nodeStateCache = ref<Map<string | number, { isLoading?: boolean; isLoaded?: boolean }>>(new Map())

  // 防抖更新标记
  let updatePending = false

  // 初始化展开的节点
  const initExpandedKeys = () => {
    // 重置展开状态
    if (props.defaultExpandAll) {
      const allKeys = getAllKeys(props.data, props.props)
      expandedKeys.value = new Set(allKeys)
    } else if (props.defaultExpandedKeys && props.defaultExpandedKeys.length > 0) {
      expandedKeys.value = new Set(props.defaultExpandedKeys)
    } else {
      expandedKeys.value = new Set()
    }
  }

  // 扁平化树形数据
  const flattenTree = (
    nodes: TreeNodeData[],
    level: number = 0,
    parentNode: FlatTreeNode | null = null,
    startIndex: number = 0,
    visible: boolean = true,
    container: FlatTreeNode[] = [],
    config?: TreePropsConfig
  ): FlatTreeNode[] => {
    const result: FlatTreeNode[] = [];
    let length = nodes.length;
    for (let i = 0; i < length; i++) {
      let index = startIndex + i;
      const node: TreeNodeData = nodes[i]
      const id = getNodeId(node, config)
      const children = getNodeChildren(node, config)
      const isExpanded = expandedKeys.value.has(id)
      const isLeaf = isLeafNode(node, config)

      // 从缓存中恢复状态
      const cachedState = nodeStateCache.value.get(id) || {}

      const flatNode: FlatTreeNode = {
        id,
        data: node,
        level,
        parentId: parentNode?.id || null,
        parentNode: parentNode || null,
        index,
        isExpanded,
        isVisible: visible,
        isDisabled: isNodeDisabled(node, config),
        isLeaf: isLeaf,
        isLoading: cachedState.isLoading || false,
        isLoaded: cachedState.isLoaded || false,
        rawChildren: children.length > 0 ? children : undefined
      }
      result.push(flatNode);
      container.push(flatNode)

      // 如果节点展开且有子节点，递归处理子节点
      if (children.length > 0) {
        const childNodes = flattenTree(children, level + 1, flatNode, index, isExpanded && visible, container, config)
        flatNode.children = childNodes
      }
    }

    return result
  }

  // 更新扁平化数据 - 优化大数据量的性能
  const updateFlatTree = () => {
    if (updatePending) return // 如果已经有更新在等待中，跳过

    updatePending = true

    // 使用nextTick合并多次调用，避免频繁重新计算
    nextTick(() => {
      let flatTreeResult: FlatTreeNode[] = [];
      flattenTree(rawData.value, 0, null, 0, true, flatTreeResult, props.props);
      flatTree.value = flatTreeResult;
      updatePending = false
    })
  }

  const insertFlatTree = (node: FlatTreeNode, children: TreeNodeData[]) => {
    const config = props.props || {}
    const childrenKey = config.children || 'children'
    node.data[childrenKey] = children
    let container: FlatTreeNode[] = [];
    let result = flattenTree(children, node.level + 1, node, node.index + 1, true, container, props.props);
    node.children = result;
    flatTree.value.splice(node.index + 1, 0, ...container);
    for (let i = node.index + container.length; i < flatTree.value.length; i++) {
      const child = flatTree.value[i]
      child.index = i
    }
  }

  // 更新原始数据
  const updateRawData = (data: TreeNodeData[]) => {
    rawData.value = data
    updateFlatTree()
  }

  // 根据 key 获取节点数据
  const getNodeData = (id: string | number): TreeNodeData | null => {
    const flatNode = flatTree.value.find(n => n.id === id)
    return flatNode ? flatNode.data : null
  }

  // 根据 key 获取扁平节点
  const getFlatNode = (id: string | number): FlatTreeNode | null => {
    return flatTree.value.find(n => n.id === id) || null
  }

  // 设置节点状态
  const setNodeState = (id: string | number, state: { isLoading?: boolean; isLoaded?: boolean }) => {
    const currentState = nodeStateCache.value.get(id) || {}
    nodeStateCache.value.set(id, { ...currentState, ...state })
  }

  // 只在数据变化时重新生成flatTree
  watch(
    () => props.data,
    (newData) => {
      rawData.value = newData
      regenerateFlatTree()
    },
    { deep: true }
  )

  // 监听 defaultExpandedKeys 和 defaultExpandAll 变化时重新生成
  watch(
    () => [props.defaultExpandedKeys, props.defaultExpandAll],
    () => {
      regenerateFlatTree()
    },
    { deep: true, immediate: false }
  )

  // 重新生成flatTree的函数（只在必要时调用）
  const regenerateFlatTree = () => {
    initExpandedKeys();
    updateFlatTree();
  }

  // 可见节点（用于虚拟滚动）
  const visibleNodes = computed(() => {
    return flatTree.value.filter(node => node.isVisible)
  })
  // 初始化
  regenerateFlatTree()
  return {
    flatTree,
    visibleNodes,
    expandedKeys,
    rawData,
    updateRawData,
    getNodeData,
    getFlatNode,
    regenerateFlatTree,
    setNodeState,
    flattenTree,
    insertFlatTree
  }
}

