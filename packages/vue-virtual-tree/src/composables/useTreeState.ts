import { ref } from 'vue'
import type { TreeNodeData } from '../types'

/**
 * 树组件状态管理
 */
export function useTreeState() {
  // 展开的节点 key 集合
  const expandedKeys = ref<Set<string | number>>(new Set())
  
  // 选中的节点 key 集合（多选）
  const checkedKeys = ref<Set<string | number>>(new Set())
  
  // 半选状态的节点 key 集合（部分子节点选中）
  const halfCheckedKeys = ref<Set<string | number>>(new Set())
  
  // 当前选中的节点 key（单选）
  const selectedKey = ref<string | number | null>(null)
  
  // 当前选中的节点数据
  const currentNode = ref<TreeNodeData | null>(null)

  /**
   * 展开节点
   */
  const expandNode = (key: string | number) => {
    expandedKeys.value.add(key)
  }

  /**
   * 折叠节点
   */
  const collapseNode = (key: string | number) => {
    expandedKeys.value.delete(key)
  }

  /**
   * 切换节点展开状态
   */
  const toggleNode = (key: string | number) => {
    if (expandedKeys.value.has(key)) {
      collapseNode(key)
    } else {
      expandNode(key)
    }
  }

  /**
   * 展开所有节点
   */
  const expandAll = (allKeys: (string | number)[]) => {
    expandedKeys.value = new Set(allKeys)
  }

  /**
   * 折叠所有节点
   */
  const collapseAll = () => {
    expandedKeys.value.clear()
  }

  /**
   * 设置选中的节点
   */
  const setChecked = (key: string | number, checked: boolean) => {
    if (checked) {
      checkedKeys.value.add(key)
    } else {
      checkedKeys.value.delete(key)
    }
  }

  /**
   * 设置半选状态
   */
  const setHalfChecked = (key: string | number, halfChecked: boolean) => {
    if (halfChecked) {
      halfCheckedKeys.value.add(key)
    } else {
      halfCheckedKeys.value.delete(key)
    }
  }

  /**
   * 设置当前选中节点
   */
  const setCurrentNode = (key: string | number | null, node: TreeNodeData | null = null) => {
    selectedKey.value = key
    currentNode.value = node
  }

  return {
    expandedKeys,
    checkedKeys,
    halfCheckedKeys,
    selectedKey,
    currentNode,
    expandNode,
    collapseNode,
    toggleNode,
    expandAll,
    collapseAll,
    setChecked,
    setHalfChecked,
    setCurrentNode
  }
}

