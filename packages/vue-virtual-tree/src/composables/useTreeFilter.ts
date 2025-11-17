import type { Ref } from 'vue'
import type { VirtualTreeProps, FlatTreeNode } from '../types'
import { getNodeLabel } from '../utils/tree'

/**
 * 树节点过滤逻辑
 */
export function useTreeFilter(
  props: VirtualTreeProps,
  flatTree: Ref<FlatTreeNode[]>,
  expandedKeys: Ref<Set<string | number>>
) {

  // 默认过滤方法
  const defaultFilterMethod = (value: string, data: any): boolean => {
    if (!value) return true
    const label = getNodeLabel(data, props.props)
    return label.toLowerCase().includes(value.toLowerCase())
  }

  // 过滤节点
  const filter = (value: string) => {

    if (!value) {
      // 清空过滤，恢复所有节点可见
      flatTree.value.forEach(node => {
        node.isVisible = true
      })
      return Promise.resolve()
    }
    return new Promise(async (resolve) => {
      const filterMethod = props.filterNodeMethod || defaultFilterMethod

      // 先标记所有节点为不可见
      flatTree.value.forEach(node => {
        node.isVisible = false
        if (filterMethod(value, node.data)) {
          // 标记当前节点为可见
          node.isVisible = true

          // 标记所有父节点为可见并展开
          let parentNode: FlatTreeNode | null = node.parentNode || null
          while (parentNode) {
            parentNode.isVisible = true
            parentNode.isExpanded = true
            expandedKeys.value.add(parentNode.id)
            parentNode = parentNode.parentNode || null
          }
        }
      })
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

