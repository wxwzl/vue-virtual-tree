import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { VirtualTreeProps, FlatTreeNode, TreeNodeData } from '../types'
import { getNodeId, getNodeChildren, traverseTree } from '../utils/tree'

/**
 * 树节点选择逻辑
 */
export function useTreeSelection(
  props: VirtualTreeProps,
  flatTree: Ref<FlatTreeNode[]>,
  getNodeData: (id: string | number) => TreeNodeData | null
) {
  // 选中的节点 key 集合
  const checkedKeys = ref<Set<string | number>>(new Set())
  // 半选状态的节点 key 集合
  const halfCheckedKeys = ref<Set<string | number>>(new Set())
  // 当前选中的节点 key（单选）
  const selectedKey = ref<string | number | null>(null)
  // 当前选中的节点数据
  const currentNode = ref<TreeNodeData | null>(null)

  // 初始化选中的节点
  const initCheckedKeys = () => {
    if (props.defaultCheckedKeys && props.defaultCheckedKeys.length > 0) {
      checkedKeys.value = new Set(props.defaultCheckedKeys)
      if (!props.checkStrictly) {
        updateHalfCheckedKeys()
      }
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

  // 获取节点的所有子节点 key
  const getAllChildrenKeys = (nodeId: string | number): (string | number)[] => {
    const keys: (string | number)[] = []
    const node = flatTree.value.find(n => n.id === nodeId)
    if (!node) return keys

    const traverse = (id: string | number) => {
      const children = flatTree.value.filter(n => n.parentId === id)
      children.forEach(child => {
        keys.push(child.id)
        traverse(child.id)
      })
    }

    traverse(nodeId)
    return keys
  }

  // 获取节点的所有父节点 key
  const getAllParentKeys = (nodeId: string | number): (string | number)[] => {
    const keys: (string | number)[] = []
    let currentId: string | number | null = nodeId

    while (currentId !== null) {
      const node = flatTree.value.find(n => n.id === currentId)
      if (node && node.parentId !== null) {
        keys.push(node.parentId)
        currentId = node.parentId
      } else {
        break
      }
    }

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

  // 设置节点选中状态（考虑父子关联）
  const setNodeChecked = (nodeId: string | number, checked: boolean, checkStrictly: boolean = false) => {
    if (checkStrictly) {
      // 严格模式：不关联父子节点
      if (checked) {
        checkedKeys.value.add(nodeId)
      } else {
        checkedKeys.value.delete(nodeId)
      }
    } else {
      // 非严格模式：关联父子节点
      if (checked) {
        // 选中节点及其所有子节点
        checkedKeys.value.add(nodeId)
        const childrenKeys = getAllChildrenKeys(nodeId)
        childrenKeys.forEach(key => {
          checkedKeys.value.add(key)
        })

        // 检查父节点是否应该被选中
        const parentKeys = getAllParentKeys(nodeId)
        for (const parentKey of parentKeys) {
          const childrenKeys = getAllChildrenKeys(parentKey)
          const allChecked = childrenKeys.every(key => checkedKeys.value.has(key))
          if (allChecked) {
            checkedKeys.value.add(parentKey)
          }
        }
      } else {
        // 取消选中节点及其所有子节点
        checkedKeys.value.delete(nodeId)
        const childrenKeys = getAllChildrenKeys(nodeId)
        childrenKeys.forEach(key => {
          checkedKeys.value.delete(key)
        })

        // 取消选中所有父节点
        const parentKeys = getAllParentKeys(nodeId)
        parentKeys.forEach(key => {
          checkedKeys.value.delete(key)
        })
      }

      // 更新半选状态
      updateHalfCheckedKeys()
    }
  }

  // 切换节点选中状态
  const toggleNodeChecked = (nodeId: string | number) => {
    const isChecked = checkedKeys.value.has(nodeId)
    setNodeChecked(nodeId, !isChecked, props.checkStrictly)
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
    const keys = nodes.map(node => getNodeId(node, props.props))
    keys.forEach(key => {
      setNodeChecked(key, true, props.checkStrictly)
    })
  }

  // 设置选中的节点 key
  const setCheckedKeys = (keys: (string | number)[], leafOnly: boolean = false) => {
    checkedKeys.value.clear()
    keys.forEach(key => {
      setNodeChecked(key, true, props.checkStrictly)
    })
  }

  // 初始化
  initCheckedKeys()
  initCurrentNode()

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

