import { ref, type Ref } from 'vue'
import type { VirtualTreeProps, FlatTreeNode } from '../types'
import { getAllKeys } from '../utils/tree'

/**
 * 在有序的 visibleNodes 中根据节点 index 找到对应的数组下标（不存在返回 -1）
 */
export function findVisibleNodeIndex(
  visibleNodes: FlatTreeNode[],
  targetIndex: number
): number {
  if (!Array.isArray(visibleNodes) || visibleNodes.length === 0) {
    return -1
  }

  let left = 0
  let right = visibleNodes.length - 1

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2)
    const currentIndex = visibleNodes[mid].index

    if (currentIndex === targetIndex) {
      return mid
    }

    if ((currentIndex ?? -Infinity) < targetIndex) {
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  return -1
}

/**
 * 树节点展开/折叠逻辑
 */
export function useTreeExpand(
  props: VirtualTreeProps,
  flatTree: Ref<FlatTreeNode[]>,
  visibleNodes: Ref<FlatTreeNode[]>,
) {

  const expandedKeys = ref<Set<string | number>>(new Set())

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

  const collectVisibleDescendants = (parent: FlatTreeNode): FlatTreeNode[] => {
    const result: FlatTreeNode[] = []
    if (!parent.children) return result
    parent.children.forEach(child => {
      result.push(child)
      if (child.isExpanded) {
        result.push(...collectVisibleDescendants(child))
      }
    })
    return result
  }

  const expandVisibleNode = (node: FlatTreeNode) => {
    if (typeof node.visibleIndex !== 'number') {
      node.visibleIndex = findVisibleNodeIndex(visibleNodes.value, node.index)
    }
    const descendants = collectVisibleDescendants(node)
    if (descendants.length === 0) return
    visibleNodes.value.splice(node.visibleIndex + 1, 0, ...descendants)
  }
  const collapseVisibleNode = (node: FlatTreeNode) => {
    if (typeof node.visibleIndex !== 'number') {
      node.visibleIndex = findVisibleNodeIndex(visibleNodes.value, node.index)
    }
    const children = collectVisibleDescendants(node)
    if (children.length === 0) return
    visibleNodes.value.splice(node.visibleIndex + 1, children.length)
  }

  /**
   * 展开节点
   */
  const expandNode = (node: FlatTreeNode) => {
    if (props.accordion) {
      // 手风琴模式：折叠同级其他节点
      // 查找兄弟节点（需要从flatTree中查找，因为node.parentId可能为null）
      const siblings = flatTree.value.filter(
        n => n.parentId === node.parentId && n.id !== node.id && n.isExpanded
      )
      siblings.forEach(sibling => {
        sibling.isExpanded = false
        expandedKeys.value.delete(sibling.id)
        collapseVisibleNode(sibling)
      })
    }

    // 展开当前节点
    node.isExpanded = true
    expandedKeys.value.add(node.id)
    expandVisibleNode(node)
  }

  const setRecursionExpanded = (node: FlatTreeNode, isExpanded: boolean) => {
    node.isExpanded = isExpanded
    if (isExpanded) {
      expandedKeys.value.add(node.id)
    } else {
      expandedKeys.value.delete(node.id)
    }
    if (node.children) {
      node.children.forEach(child => {
        setRecursionExpanded(child, isExpanded)
      })
    }
  }
  /**
   * 折叠节点
   */
  const collapseNode = (node: FlatTreeNode) => {
    collapseVisibleNode(node)
    setRecursionExpanded(node, false)
  }

  /**
   * 切换节点展开状态
   */
  const toggleNode = (node: FlatTreeNode) => {
    if (node.isExpanded) {
      collapseNode(node)
    } else {
      expandNode(node)
    }
  }

  return {
    expandedKeys,
    initExpandedKeys,
    expandNode,
    collapseNode,
    toggleNode
  }
}

