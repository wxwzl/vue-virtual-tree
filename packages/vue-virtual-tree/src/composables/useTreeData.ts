import { nextTick, onUnmounted, ref, watch } from 'vue'
import type { TreeNodeData, FlatTreeNode, VirtualTreeProps, VirtualTreeEmits } from '../types'
import { useTreeDrag } from './useTreeDrag'
import DataEngine from '../engine/js-engine/DataEngine'

/**
 * Emit function type helper
 */
type EmitFn<T> = <K extends keyof T>(event: K, ...args: T[K] extends any[] ? T[K] : never) => void

/**
 * 扁平化树形数据
 */
export function useTreeData(props: VirtualTreeProps, emit: EmitFn<VirtualTreeEmits>,forceUpdate: () => void) {
  const visibleNodes = ref<FlatTreeNode[]>([])
  const rawData = ref<TreeNodeData[]>(props.data)
  let updateTimer: ReturnType<typeof setTimeout> | null = null
  const dataEngine = new DataEngine(props.data, props, (nodes: Array<FlatTreeNode>) => {
    if (updateTimer) {
      clearTimeout(updateTimer)
    }
    updateTimer = setTimeout(() => {
      visibleNodes.value = nodes
      console.log('visibleNodes', visibleNodes.value)
      forceUpdate();
      updateTimer = null
    }, 5)
  })

  // 拖拽逻辑
  const dragState = useTreeDrag(props, dataEngine.getNodeData.bind(dataEngine))


  const regenerateState: RegenerateOptions = {
    needEmit: true,
    resetExpanded: true,
    resetChecked: true
  }

  // 只在数据变化时重新生成flatTree
  watch(
    () => props.data,
    (newData) => {
      rawData.value = newData
      regenerateState.needEmit = true
      regenerateState.resetChecked = true
      regenerateFlatTree()
    },
    { deep: true }
  )

  // 监听 defaultExpandedKeys 和 defaultExpandAll 变化时重新生成
  watch(
    () => [props.defaultExpandedKeys, props.defaultExpandAll],
    () => {
      regenerateState.resetExpanded = true
      regenerateFlatTree()
    },
    { deep: true, immediate: false }
  )

  // 监听 defaultCheckedKeys 变化时重新生成
  watch(
    () => props.defaultCheckedKeys,
    () => {
      regenerateState.resetChecked = true
      regenerateFlatTree()
    },
    { deep: true, immediate: false }
  )
  let regenerateTimer: ReturnType<typeof setTimeout> | null = null


  type RegenerateOptions = {
    resetExpanded?: boolean
    resetChecked?: boolean
    needEmit?: boolean
  }

  // 重新生成flatTree的函数（只在必要时调用）
  const regenerateFlatTree = () => {
    if (regenerateTimer) {
      clearTimeout(regenerateTimer)
    }
    regenerateTimer = setTimeout(() => {
      if (regenerateState.resetExpanded) {
        dataEngine.initExpandedKeys()
      }
      dataEngine.loadTree(rawData.value)
      if (regenerateState.resetChecked) {
        dataEngine.initNodeChecked()
      }
      if (regenerateState.needEmit) {
        nextTick(() => {
          emit('node-generated')
        })
      }
      regenerateState.needEmit = false
      regenerateState.resetExpanded = false
      regenerateState.resetChecked = false
      regenerateTimer = null
    }, 5)
  }

  // 初始化
  regenerateFlatTree()

  // 组件卸载时清理定时器
  onUnmounted(() => {
    if (regenerateTimer) {
      clearTimeout(regenerateTimer)
      regenerateTimer = null
    }
  })

  const useTreeInstance = {
    visibleNodes,
    rawData,
    checkedKeys: dataEngine.checkedKeys,
    halfCheckedKeys: dataEngine.halfCheckedKeys,
    selectedKey: dataEngine.selectedKey,
    currentNode: dataEngine.currentNode,
    getNodeData: dataEngine.getNodeData.bind(dataEngine),
    getFlatNode: dataEngine.getFlatNode.bind(dataEngine),
    regenerateFlatTree,
    insertFlatTree: dataEngine.insertFlatTree.bind(dataEngine),
    toggleNodeChecked: dataEngine.toggleNodeChecked.bind(dataEngine),
    setCurrentNode: dataEngine.setCurrentNode.bind(dataEngine),
    getCheckedNodes: dataEngine.getCheckedNodes.bind(dataEngine),
    getCheckedKeys: dataEngine.getCheckedKeys.bind(dataEngine),
    setCheckedNodes: dataEngine.setCheckedNodes.bind(dataEngine),
    setCheckedKeys: dataEngine.setCheckedKeys.bind(dataEngine),
    expandNode: dataEngine.expandNode.bind(dataEngine),
    collapseNode: dataEngine.collapseNode.bind(dataEngine),
    dragState,
    filter: dataEngine.filter.bind(dataEngine)
  }
  Object.defineProperty(useTreeInstance, 'checkedKeys', {
    get: () => {
      return dataEngine.checkedKeys
    },
  })
  Object.defineProperty(useTreeInstance, 'halfCheckedKeys', {
    get: () => {
      return dataEngine.halfCheckedKeys
    },
  })
  Object.defineProperty(useTreeInstance, 'selectedKey', {
    get: () => {
      return dataEngine.selectedKey
    },
  })
  Object.defineProperty(useTreeInstance, 'currentNode', {
    get: () => {
      return dataEngine.currentNode
    },
  })
  return useTreeInstance
}

