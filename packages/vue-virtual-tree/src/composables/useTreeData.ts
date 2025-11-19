import { ref, watch } from 'vue'
import type { TreeNodeData, FlatTreeNode, VirtualTreeProps } from '../types'
import { findNodeByKey, getNodeId, isLeafNode } from '../utils/tree'
import { useTreeDrag } from './useTreeDrag'
import { loadToolsWasm } from '../utils/wasmUtils'

type ToolsModule = typeof import('../../lib/tools/tools')

const createOptionsPayload = (props: VirtualTreeProps) => ({
  defaultExpandAll: props.defaultExpandAll ?? false,
  defaultExpandedKeys: props.defaultExpandedKeys ?? [],
  defaultCheckedKeys: props.defaultCheckedKeys ?? [],
  checkStrictly: props.checkStrictly ?? false
})

export function useTreeData(props: VirtualTreeProps) {
  const rawData = ref<TreeNodeData[]>(props.data)
  const visibleNodes = ref<FlatTreeNode[]>([])
  const checkedKeys = ref<Set<string | number>>(new Set())
  const halfCheckedKeys = ref<Set<string | number>>(new Set())
  const selectedKey = ref<string | number | null>(props.currentNodeKey ?? null)
  const currentNode = ref<TreeNodeData | null>(null)
  const loadingKeys = new Set<string | number>()
  const loadedKeys = new Set<string | number>()

  let wasm: ToolsModule | null = null
  let initialized = false

  const wasmReady = loadToolsWasm().then(module => {
    wasm = module
    return module
  })

  const ensureReady = async () => {
    if (!wasm) {
      wasm = await wasmReady
    }
    return wasm!
  }

  const applyUiState = (nodes: FlatTreeNode[]) => {
    nodes.forEach(node => {
      node.isLoading = loadingKeys.has(node.id)
      if (loadedKeys.has(node.id)) {
        node.isLoaded = true
      }
    })
    return nodes
  }

  const syncVisibleNodes = () => {
    if (!wasm) return
    const nodes = wasm.get_visible_nodes() as FlatTreeNode[]
    visibleNodes.value = applyUiState(nodes)
  }

  const syncSelectionState = () => {
    if (!wasm) return
    const state = wasm.get_selection_state() as {
      checkedKeys: (string | number)[]
      halfCheckedKeys: (string | number)[]
    }
    checkedKeys.value = new Set(state.checkedKeys)
    halfCheckedKeys.value = new Set(state.halfCheckedKeys)
  }

  const bootstrapTree = async () => {
    const module = await ensureReady()
    const options = createOptionsPayload(props)
    if (!initialized) {
      module.init_tree(rawData.value, props.props ?? {}, options)
      initialized = true
    } else {
      module.rebuild_tree(rawData.value, options)
    }
    syncVisibleNodes()
    syncSelectionState()
  }

  const regenerateFlatTree = () => {
    bootstrapTree().catch(error => {
      console.error('[vue-virtual-tree] Failed to rebuild tree', error)
    })
  }

  const getNodeData = (id: string | number): TreeNodeData | null => {
    if (!wasm) return null
    try {
      return wasm.get_node_data(id) as TreeNodeData
    } catch {
      return null
    }
  }

  const getFlatNode = (id: string | number): FlatTreeNode | null => {
    if (!wasm) return null
    try {
      return wasm.get_flat_node(id) as FlatTreeNode
    } catch {
      return null
    }
  }

  const getVisibleChildrenNodes = (id: string | number): FlatTreeNode[] => {
    if (!wasm) return []
    try {
      return wasm.get_visible_children(id) as FlatTreeNode[]
    } catch {
      return []
    }
  }

  const getVisibleSiblingsNodes = (id: string | number): FlatTreeNode[] => {
    if (!wasm) return []
    try {
      return wasm.get_visible_siblings(id) as FlatTreeNode[]
    } catch {
      return []
    }
  }

  const getVisibleDescendantNodes = (id: string | number): FlatTreeNode[] => {
    if (!wasm) return []
    try {
      return wasm.get_visible_descendants(id) as FlatTreeNode[]
    } catch {
      return []
    }
  }

  const getParentChainNodes = (id: string | number): FlatTreeNode[] => {
    if (!wasm) return []
    try {
      return wasm.get_parent_chain(id) as FlatTreeNode[]
    } catch {
      return []
    }
  }

  const toggleNodeChecked = (id: string | number) => {
    if (!wasm || !initialized) return
    wasm.toggle_node_checked(id)
    syncSelectionState()
    syncVisibleNodes()
  }

  const setCurrentNode = (key: string | number | null, node: TreeNodeData | null) => {
    selectedKey.value = key
    currentNode.value = node
  }

  const getCheckedNodes = (leafOnly = false, includeHalfChecked = false): TreeNodeData[] => {
    if (!wasm) return []
    return wasm.get_checked_nodes(leafOnly, includeHalfChecked) as TreeNodeData[]
  }

  const getCheckedKeys = (leafOnly = false): (string | number)[] => {
    if (!wasm) return []
    return wasm.get_checked_keys(leafOnly) as (string | number)[]
  }

  const setCheckedKeys = (keys: (string | number)[], leafOnly = false) => {
    if (!wasm) return
    wasm.set_checked_keys(keys, leafOnly)
    syncSelectionState()
    syncVisibleNodes()
  }

  const setCheckedNodes = (nodes: TreeNodeData[], leafOnly = false) => {
    const keys = nodes
      .filter(node => (leafOnly ? isLeafNode(node, props.props) : true))
      .map(node => getNodeId(node, props.props))
    setCheckedKeys(keys, leafOnly)
  }

  const expandNode = (node: FlatTreeNode) => {
    if (!wasm) return
    wasm.set_node_expanded(node.id, true)
    syncVisibleNodes()
  }

  const collapseNode = (node: FlatTreeNode) => {
    if (!wasm) return
    wasm.set_node_expanded(node.id, false)
    syncVisibleNodes()
  }

  const filter = (value: string) => {
    if (!wasm) return Promise.resolve()
    wasm.filter_nodes(value?.trim() ? value : undefined)
    syncVisibleNodes()
    return Promise.resolve()
  }

  const setNodeLoadingState = (id: string | number, loading: boolean) => {
    if (loading) {
      loadingKeys.add(id)
    } else {
      loadingKeys.delete(id)
    }
    const target = visibleNodes.value.find(n => n.id === id)
    if (target) {
      target.isLoading = loading
    }
  }

  const markNodeLoaded = (id: string | number) => {
    loadedKeys.add(id)
    const target = visibleNodes.value.find(n => n.id === id)
    if (target) {
      target.isLoaded = true
      target.isLoading = false
    }
    loadingKeys.delete(id)
  }

  const insertFlatTree = (node: FlatTreeNode, children: TreeNodeData[]) => {
    const target = findNodeByKey(rawData.value, node.id, props.props)
    if (!target) return
    const childrenKey = props.props?.children || 'children'
    if (!Array.isArray(target[childrenKey])) {
      target[childrenKey] = []
    }
    target[childrenKey].push(...children)
    markNodeLoaded(node.id)
    regenerateFlatTree()
  }

  const dragState = useTreeDrag(props, getNodeData)

  watch(
    () => props.data,
    newData => {
      rawData.value = newData
      regenerateFlatTree()
    },
    { deep: true }
  )

  watch(
    () => props.defaultExpandedKeys,
    () => regenerateFlatTree(),
    { deep: true }
  )

  watch(
    () => props.defaultCheckedKeys,
    () => regenerateFlatTree(),
    { deep: true }
  )

  watch(
    () => props.defaultExpandAll,
    () => regenerateFlatTree()
  )

  watch(
    () => props.currentNodeKey,
    newKey => {
      if (newKey !== undefined && newKey !== null) {
        setCurrentNode(newKey, getNodeData(newKey))
      }
    }
  )

  regenerateFlatTree()

  return {
    visibleNodes,
    rawData,
    checkedKeys,
    halfCheckedKeys,
    selectedKey,
    currentNode,
    getNodeData,
    getFlatNode,
    getVisibleChildren: getVisibleChildrenNodes,
    getVisibleSiblings: getVisibleSiblingsNodes,
    getVisibleDescendants: getVisibleDescendantNodes,
    getParentChain: getParentChainNodes,
    toggleNodeChecked,
    setCurrentNode,
    getCheckedNodes,
    getCheckedKeys,
    setCheckedNodes,
    setCheckedKeys,
    regenerateFlatTree,
    insertFlatTree,
    setNodeLoadingState,
    markNodeLoaded,
    expandNode,
    collapseNode,
    dragState,
    filter
  }
}

