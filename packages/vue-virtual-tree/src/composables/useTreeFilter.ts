import { ref, computed } from 'vue'
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
  const filterText = ref<string>('')

  // 默认过滤方法
  const defaultFilterMethod = (value: string, data: any): boolean => {
    if (!value) return true
    const label = getNodeLabel(data, props.props)
    return label.toLowerCase().includes(value.toLowerCase())
  }

  // 过滤节点
  const filter = (value: string) => {
    filterText.value = value

    if (!value) {
      // 清空过滤，恢复所有节点可见
      flatTree.value.forEach(node => {
        node.isVisible = true
      })
      return
    }

    const filterMethod = props.filterNodeMethod || defaultFilterMethod

    // 先标记所有节点为不可见
    flatTree.value.forEach(node => {
      node.isVisible = false
    })

    // 标记匹配的节点及其所有父节点为可见
    flatTree.value.forEach(node => {
      if (filterMethod(value, node.data)) {
        // 标记当前节点为可见
        node.isVisible = true

        // 标记所有父节点为可见并展开
        let parentId: string | number | null = node.parentId
        while (parentId !== null) {
          const parent = flatTree.value.find(n => n.id === parentId)
          if (parent) {
            parent.isVisible = true
            expandedKeys.value.add(parent.id)
            parentId = parent.parentId
          } else {
            break
          }
        }
      }
    })
  }

  // 清空过滤
  const clearFilter = () => {
    filter('')
  }

  return {
    filterText,
    filter,
    clearFilter
  }
}

