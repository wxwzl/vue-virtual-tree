import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { TreeNodeData, FlatTreeNode, TreePropsConfig, VirtualTreeProps } from '../types'
import { getNodeId, getNodeChildren, isNodeDisabled, isLeafNode, getAllKeys } from '../utils/tree'

/**
 * 扁平化树形数据
 */
export function useTreeData(props: VirtualTreeProps) {
  const expandedKeys = ref<Set<string | number>>(new Set())
  const flatTree = ref<FlatTreeNode[]>([])
  const rawData = ref<TreeNodeData[]>(props.data)

  // 初始化展开的节点
  const initExpandedKeys = () => {
    if (props.defaultExpandAll) {
      // 获取所有节点的 key
      const allKeys = getAllKeys(props.data, props.props)
      expandedKeys.value = new Set(allKeys)
    } else if (props.defaultExpandedKeys && props.defaultExpandedKeys.length > 0) {
      expandedKeys.value = new Set(props.defaultExpandedKeys)
    }
  }

  // 扁平化树形数据
  const flattenTree = (
    nodes: TreeNodeData[],
    level: number = 0,
    parentId: string | number | null = null,
    config?: TreePropsConfig
  ): FlatTreeNode[] => {
    const result: FlatTreeNode[] = []

    for (const node of nodes) {
      const id = getNodeId(node, config)
      const children = getNodeChildren(node, config)
      const isExpanded = expandedKeys.value.has(id)
      const isLeaf = isLeafNode(node, config)

      const flatNode: FlatTreeNode = {
        id,
        data: node,
        level,
        parentId,
        isExpanded,
        isVisible: true,
        isDisabled: isNodeDisabled(node, config),
        isLeaf: isLeaf,
        rawChildren: children.length > 0 ? children : undefined
      }

      result.push(flatNode)

      // 如果节点展开且有子节点，递归处理子节点
      if (isExpanded && children.length > 0) {
        const childNodes = flattenTree(children, level + 1, id, config)
        result.push(...childNodes)
        flatNode.children = childNodes
      }
    }

    return result
  }

  // 更新扁平化数据
  const updateFlatTree = () => {
    flatTree.value = flattenTree(rawData.value, 0, null, props.props)
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

  // 初始化
  initExpandedKeys()
  updateFlatTree()

  // 监听数据变化
  watch(
    () => props.data,
    (newData) => {
      rawData.value = newData
      updateFlatTree()
    },
    { deep: true }
  )

  // 监听展开状态变化
  watch(expandedKeys, () => {
    updateFlatTree()
  }, { deep: true })

  // 监听 defaultExpandedKeys 和 defaultExpandAll 变化
  watch(
    () => [props.defaultExpandedKeys, props.defaultExpandAll, props.data],
    () => {
      if (props.defaultExpandAll) {
        // 获取所有节点的 key
        const allKeys = getAllKeys(props.data, props.props)
        expandedKeys.value = new Set(allKeys)
      } else if (props.defaultExpandedKeys && props.defaultExpandedKeys.length > 0) {
        expandedKeys.value = new Set(props.defaultExpandedKeys)
      }
      updateFlatTree()
    },
    { deep: true, immediate: false }
  )

  // 可见节点（用于虚拟滚动）
  const visibleNodes = computed(() => {
    return flatTree.value.filter(node => node.isVisible)
  })

  return {
    flatTree,
    visibleNodes,
    expandedKeys,
    rawData,
    updateRawData,
    getNodeData,
    getFlatNode,
    updateFlatTree
  }
}

