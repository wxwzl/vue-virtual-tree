import { FlatTreeNode } from "@/types"

/**
 * 归并排序：按 index 从小到大排序
 */
export function mergeSort(nodes: FlatTreeNode[]): FlatTreeNode[] {
    if (nodes.length <= 1) {
      return nodes
    }
  
    const mid = Math.floor(nodes.length / 2)
    const left = mergeSort(nodes.slice(0, mid))
    const right = mergeSort(nodes.slice(mid))
  
    return merge(left, right)
  }
  
  /**
   * 合并两个有序数组
   */
  function merge(left: FlatTreeNode[], right: FlatTreeNode[]): FlatTreeNode[] {
    const result: FlatTreeNode[] = []
    let i = 0
    let j = 0
  
    while (i < left.length && j < right.length) {
      if (left[i].index <= right[j].index) {
        result.push(left[i])
        i++
      } else {
        result.push(right[j])
        j++
      }
    }
  
    // 将剩余元素添加到结果数组
    while (i < left.length) {
      result.push(left[i])
      i++
    }
  
    while (j < right.length) {
      result.push(right[j])
      j++
    }
  
    return result
  }