import { ref, watch, computed } from 'vue'
import type { Ref } from 'vue'
import type { VirtualTreeProps, FlatTreeNode, TreeNodeData } from '../types'
import { getNodeId, getNodeChildren, isLeafNode } from '../utils/tree'

/**
 * 树节点选择逻辑
 */
export function useTreeSelection(
  props: VirtualTreeProps,
  flatTree: Ref<FlatTreeNode[]>,
  getNodeData: (id: string | number) => TreeNodeData | null,
  getFlatNode: (id: string | number) => FlatTreeNode | null
) {
  // 从flatTree计算选中的节点key集合
  const checkedKeys = computed(() => {
    const keys = new Set<string | number>()
    flatTree.value.forEach(node => {
      if (node.isChecked) {
        keys.add(node.id)
      }
    })
    return keys
  })

  // 从flatTree计算半选状态的节点key集合
  const halfCheckedKeys = computed(() => {
    const keys = new Set<string | number>()
    flatTree.value.forEach(node => {
      if (node.isIndeterminate) {
        keys.add(node.id)
      }
    })
    return keys
  })
  // 当前选中的节点 key（单选）
  const selectedKey = ref<string | number | null>(null)
  // 当前选中的节点数据
  const currentNode = ref<TreeNodeData | null>(null)

  // 初始化选中的节点（处理父子关联和半选状态）
  const initNodeChecked = () => {
    // 先清除所有节点的选中状态和半选状态
    flatTree.value.forEach(node => {
      node.isChecked = false
      node.isIndeterminate = false
    })

     // 如果有默认选中的节点，设置它们并处理父子关联
     if (props.defaultCheckedKeys && props.defaultCheckedKeys.length > 0) {
      props.defaultCheckedKeys.forEach(key => {
        const node = getFlatNode(key)
        if (node) {
          setNodeChecked(key, true)
        }
      })
    }
  }

  // 初始化当前选中节点
  const initCurrentNode = () => {
    if (props.currentNodeKey !== undefined) {
      selectedKey.value = props.currentNodeKey
      const node = getNodeData(props.currentNodeKey)
      currentNode.value = node
    }
  }

  // 获取节点的所有子节点 key（从原始数据递归获取，包括未展开的子节点）
  const getAllChildrenKeys = (nodeId: string | number): (string | number)[] => {
    const keys: (string | number)[] = []
    const nodeData = getNodeData(nodeId)
    if (!nodeData) return keys

    // 从原始数据递归获取所有子节点
    const traverse = (data: TreeNodeData) => {
      const children = getNodeChildren(data, props.props)
      children.forEach(child => {
        const childId = getNodeId(child, props.props)
        keys.push(childId)
        // 递归获取子节点的子节点
        traverse(child)
      })
    }

    traverse(nodeData)
    return keys
  }


  // 更新半选状态
  const updateHalfCheckedKeys = () => {
    halfCheckedKeys.value.clear()
    const allKeys = new Set(flatTree.value.map(n => n.id))

    for (const key of allKeys) {
      const childrenKeys = getAllChildrenKeys(key)
      if (childrenKeys.length === 0) continue

      const checkedChildren = childrenKeys.filter(k => checkedKeys.value.has(k))
      if (checkedChildren.length > 0 && checkedChildren.length < childrenKeys.length) {
        halfCheckedKeys.value.add(key)
      }
    }
  }

  // 直接操作flatTree中的节点状态
  const setNodeCheckedInTree = (node: FlatTreeNode, checked: boolean) => {
    node.isChecked = checked
    node.isIndeterminate = false

    // 递归处理子节点
    const setChildrenChecked = (parentNode: FlatTreeNode, checkedState: boolean) => {
      if (parentNode.children) {
        parentNode.children.forEach(child => {
          child.isChecked = checkedState
          child.isIndeterminate = false
          setChildrenChecked(child, checkedState)
        })
      }
    }
    setChildrenChecked(node, checked)

    // 更新父节点的选中状态
    const updateParentChecked = (childNode: FlatTreeNode) => {
      const parentId = childNode.parentId
      if (parentId !== null) {
        const parent = getFlatNode(parentId)
        if (parent) {
          const siblings = parent.children || []
          const checkedCount = siblings.filter(n => n.isChecked).length
          const indeterminateCount = siblings.filter(n => n.isIndeterminate).length

          if (checkedCount === siblings.length) {
            // 所有子节点都选中
            parent.isChecked = true
            parent.isIndeterminate = false
          } else if (checkedCount === 0 && indeterminateCount === 0) {
            // 所有子节点都未选中
            parent.isChecked = false
            parent.isIndeterminate = false
          } else {
            // 部分选中
            parent.isChecked = false
            parent.isIndeterminate = true
          }

          // 递归更新父节点
          updateParentChecked(parent)
        }
      }
    }
    updateParentChecked(node)
  }

  // 设置节点选中状态（考虑父子关联）
  const setNodeChecked = (nodeId: string | number, checked: boolean, checkStrictly?: boolean) => {
    const node = getFlatNode(nodeId)
    if (!node) return

    const isStrictly = checkStrictly ?? props.checkStrictly ?? false

    if (isStrictly) {
      // 严格模式：只设置当前节点
      node.isChecked = checked
      node.isIndeterminate = false
    } else {
      // 非严格模式：关联父子节点
      setNodeCheckedInTree(node, checked)
    }
  }

  // 切换节点选中状态
  const toggleNodeChecked = (nodeId: string | number) => {
    const isChecked = checkedKeys.value.has(nodeId)
    setNodeChecked(nodeId, !isChecked)
  }

  // 设置当前选中节点
  const setCurrentNode = (key: string | number | null, node: TreeNodeData | null = null) => {
    selectedKey.value = key
    currentNode.value = node
  }

  // 获取选中的节点数据
  const getCheckedNodes = (leafOnly: boolean = false, includeHalfChecked: boolean = false): TreeNodeData[] => {
    const nodes: TreeNodeData[] = []
    const keys = includeHalfChecked
      ? new Set([...checkedKeys.value, ...halfCheckedKeys.value])
      : checkedKeys.value

    for (const key of keys) {
      const node = getNodeData(key)
      if (!node) continue

      if (leafOnly) {
        const children = getNodeChildren(node, props.props)
        if (children.length === 0) {
          nodes.push(node)
        }
      } else {
        nodes.push(node)
      }
    }

    return nodes
  }

  // 获取选中的节点 key
  const getCheckedKeys = (leafOnly: boolean = false): (string | number)[] => {
    if (leafOnly) {
      const leafNodes = getCheckedNodes(true)
      return leafNodes.map(node => getNodeId(node, props.props))
    }
    return Array.from(checkedKeys.value)
  }

  // 设置选中的节点
  const setCheckedNodes = (nodes: TreeNodeData[], leafOnly: boolean = false) => {
    checkedKeys.value.clear()
    const keys = nodes
      .filter(node => {
        if (leafOnly) {
          return isLeafNode(node, props.props)
        }
        return true
      })
      .map(node => getNodeId(node, props.props))
    keys.forEach(key => {
      setNodeChecked(key, true)
    })
    if (!props.checkStrictly) {
      updateHalfCheckedKeys()
    }
  }

  // 设置选中的节点 key
  const setCheckedKeys = (keys: (string | number)[], leafOnly: boolean = false) => {
    checkedKeys.value.clear()
    const keysToSet = leafOnly
      ? keys.filter(key => {
          const node = getNodeData(key)
          return node && isLeafNode(node, props.props)
        })
      : keys
    keysToSet.forEach(key => {
      setNodeChecked(key, true)
    })
    if (!props.checkStrictly) {
      updateHalfCheckedKeys()
    }
  }

  // 初始化
  initCurrentNode()

  // 选中状态现在直接在flatTree中管理，不需要额外的监听器

  // 监听 props.currentNodeKey 变化
  watch(
    () => props.currentNodeKey,
    (newKey) => {
      if (newKey !== undefined) {
        setCurrentNode(newKey, getNodeData(newKey))
      }
    }
  )

  return {
    checkedKeys,
    halfCheckedKeys,
    selectedKey,
    currentNode,
    initNodeChecked,
    setNodeChecked,
    toggleNodeChecked,
    setCurrentNode,
    getCheckedNodes,
    getCheckedKeys,
    setCheckedNodes,
    setCheckedKeys,
    updateHalfCheckedKeys
  }
}

