import type { Ref } from 'vue'
import type { VirtualTreeProps, FlatTreeNode } from '../types'

/**
 * 树节点展开/折叠逻辑
 */
export function useTreeExpand(
  props: VirtualTreeProps,
  flatTree: Ref<FlatTreeNode[]>,
  expandedKeys: Ref<Set<string | number>>
) {
  /**
   * 展开节点
   */
  const expandNode = (node: FlatTreeNode) => {
    if (props.accordion) {
      // 手风琴模式：折叠同级其他节点（只处理可见的兄弟节点）
      const siblings = flatTree.value.filter(
        n => n.parentId === node.parentId && n.id !== node.id && n.isVisible
      )
      siblings.forEach(sibling => {
        expandedKeys.value.delete(sibling.id)
      })
    }
    expandedKeys.value.add(node.id)
  }

  /**
   * 折叠节点
   */
  const collapseNode = (node: FlatTreeNode) => {
    expandedKeys.value.delete(node.id)
    
    // 折叠所有子节点
    const collapseChildren = (parentId: string | number) => {
      const children = flatTree.value.filter(n => n.parentId === parentId)
      children.forEach(child => {
        expandedKeys.value.delete(child.id)
        collapseChildren(child.id)
      })
    }
    collapseChildren(node.id)
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
    expandNode,
    collapseNode,
    toggleNode
  }
}

