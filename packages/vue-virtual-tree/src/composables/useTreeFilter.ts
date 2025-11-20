import type { Ref } from 'vue'
import type { VirtualTreeProps, FlatTreeNode } from '../types'
import { getNodeLabel } from '../utils/tree'

/**
 * 树节点过滤逻辑
 */
export function useTreeFilter(
  props: VirtualTreeProps,
  flatTree: Ref<FlatTreeNode[]>,
  flatNodeMap: Ref<Map<string | number, FlatTreeNode>>,
  expandedKeys: Ref<Set<string | number>>,
  setVisibleNodes: (nodes: FlatTreeNode[]) => void
) {

  const rebuildVisibleNodes = () => {
    const roots = flatTree.value.filter(node => node.parentId === null)
    const result: FlatTreeNode[] = []
    const traverse = (node: FlatTreeNode) => {
      result.push(node)
      if (node.isExpanded && node.children) {
        node.children.forEach(child => traverse(child))
      }
    }
    roots.forEach(root => traverse(root))
    setVisibleNodes(result)
  }

  // 默认过滤方法
  const defaultFilterMethod = (value: string, data: any): boolean => {
    if (!value) return true
    const label = getNodeLabel(data, props.props)
    return label.toLowerCase().includes(value.toLowerCase())
  }

  // 过滤节点
  const filter = (value: string) => {

    if (!value) {
      flatTree.value.forEach(node => {
        if (!node.isLeaf) {
          node.isExpanded = true
          expandedKeys.value.add(node.id)
        }
      })
      rebuildVisibleNodes()
      return Promise.resolve()
    }
    return new Promise(async (resolve) => {
      const filterMethod = props.filterNodeMethod || defaultFilterMethod
      const matchedNodes = new Set<FlatTreeNode>()
      flatTree.value.forEach(node => {
        if (filterMethod(value, node.data)) {
          matchedNodes.add(node)
          // 标记所有父节点为可见并展开
          let parentId: string | number | null = node.parentId
          while (parentId) {
            const parentNode: FlatTreeNode | undefined = flatNodeMap.value.get(parentId)
            if (parentNode) {
              matchedNodes.add(parentNode)
              parentNode.isExpanded = true
              expandedKeys.value.add(parentNode.id)
              parentId = parentNode.parentId
            } else {
              parentId = null
            }
          }
        }
      })
      setVisibleNodes(flatTree.value.filter(node => matchedNodes.has(node)))
      resolve(void 0)
    })
  }
  // 清空过滤
  const clearFilter = () => {
    filter('')
  }

  return {
    filter,
    clearFilter
  }
}

