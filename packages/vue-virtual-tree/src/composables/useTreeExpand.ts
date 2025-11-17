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
   * 更新节点及其子孙节点的可见性
   */
  const updateNodeVisibility = (node: FlatTreeNode, isVisible: boolean) => {
    if (node.children) {
      node.children.forEach(child => {
        child.isVisible = isVisible
        // 如果子节点未展开，则递归隐藏其子孙节点
        // if (!isVisible) {
        //   // 如果子节点已展开，则确保其子孙节点可见
        //   updateNodeVisibility(child, false)
        // }
      })
    }
  }

  /**
   * 展开节点
   */
  const expandNode = (node: FlatTreeNode) => {
    if (props.accordion) {
      // 手风琴模式：折叠同级其他节点
      // 查找兄弟节点（需要从flatTree中查找，因为node.parentId可能为null）
      const siblings = flatTree.value.filter(
        n => n.parentId === node.parentId && n.id !== node.id && n.isVisible
      )
      siblings.forEach(sibling => {
        if (sibling.isExpanded) {
          sibling.isExpanded = false
          expandedKeys.value.delete(sibling.id)
          updateNodeVisibility(sibling, false)
        }
      })
    }

    // 展开当前节点
    node.isExpanded = true
    expandedKeys.value.add(node.id)
    updateNodeVisibility(node, true)
  }

  /**
   * 折叠节点
   */
  const collapseNode = (node: FlatTreeNode) => {
    node.isExpanded = false
    expandedKeys.value.delete(node.id)
    if (node.children) {
      node.children.forEach(child => {
        collapseNode(child);
      })
    }
    updateNodeVisibility(node, false)
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

