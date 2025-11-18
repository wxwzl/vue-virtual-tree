<template>
  <div class="vue-virtual-tree" :style="{ height: typeof height === 'number' ? `${height}px` : height }">
    <DynamicScroller ref="dynamicScrollerRef" v-if="visibleNodes.length > 0" :items="visibleNodes" :min-item-size="itemSize || 32"
      class="vue-virtual-tree__scroller" v-slot="{ item, index, active }">
      <DynamicScrollerItem :item="item" :active="active" :data-index="index" class="vue-virtual-tree__item">
        <TreeNode :ref="(el) => setNodeRef(item.id, el)" :node="item" :key="item.id" :props="props.props" :show-checkbox="showCheckbox"
          :expand-on-click-node="expandOnClickNode" :draggable="draggable" :indent="props.indent"
          :drop-type="dragState.dropNode?.value?.id === item.id ? dragState.dropType?.value ?? null : null"
          @node-click="handleNodeClick" @node-expand="handleNodeExpand" @node-collapse="handleNodeCollapse"
          @node-check="handleNodeCheck" @drag-start="handleDragStart" @drag-enter="handleDragEnter"
          @drag-leave="handleDragLeave" @drag-over="handleDragOver" @drag-end="handleDragEnd" @drop="handleDrop">
          <template #default="{ node, data }">
            <slot :node="node" :data="data" />
          </template>
          <template #loading="{ node, data }">
            <slot name="loading" :node="node" :data="data">
              <!-- 默认loading图标 -->
              <svg class="vue-virtual-tree-node__loading-icon" viewBox="0 0 24 24" width="16" height="16">
                <g transform="translate(12,12)">
                  <!-- 轨道圆环 -->
                  <circle cx="0" cy="0" r="8" fill="none" stroke="currentColor" stroke-width="1" opacity="0.2" />
                  <!-- 旋转的3个点 -->
                  <g class="vue-virtual-tree-loading-dots">
                    <circle cx="0" cy="-8" r="2" fill="currentColor" />
                    <circle cx="6.928" cy="-4" r="2" fill="currentColor" opacity="0.7" />
                    <circle cx="6.928" cy="4" r="2" fill="currentColor" opacity="0.4" />
                  </g>
                </g>
              </svg>
            </slot>
          </template>
          <template #icon="{ node, data }">
            <slot name="icon" :node="node" :data="data">
              <!-- 默认图标 -->
              <svg v-if="!node.isLeaf" viewBox="0 0 1024 1024" width="16" height="16">
                <path d="M384 384l256 256-256 256z" fill="currentColor" />
              </svg>
            </slot>
          </template>
        </TreeNode>
      </DynamicScrollerItem>
    </DynamicScroller>
    <div v-else class="vue-virtual-tree__empty">
      <slot name="empty">
        <span>暂无数据</span>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import TreeNode from './TreeNode.vue'
import type { VirtualTreeProps, VirtualTreeEmits, VirtualTreeMethods, FlatTreeNode, TreeNodeData, TreeNodeInstance } from '../types'
import { useTreeData } from '../composables/useTreeData'
import { useTreeExpand } from '../composables/useTreeExpand'
import { useTreeSelection } from '../composables/useTreeSelection'
import { useTreeFilter } from '../composables/useTreeFilter'
import { useTreeDrag } from '../composables/useTreeDrag'
import { getNodeId, findNodeByKey, getNodeChildren, isLeafNode, getNodeLabel, getAllKeys } from '../utils/tree'
import '../style/index.scss'

defineOptions({
  name: 'VirtualTree'
})

const props = withDefaults(defineProps<VirtualTreeProps>(), {
  data: () => [],
  props: () => ({}),
  showCheckbox: false,
  checkStrictly: false,
  defaultExpandAll: false,
  defaultExpandedKeys: () => [],
  defaultCheckedKeys: () => [],
  expandOnClickNode: true,
  lazy: false,
  accordion: false,
  draggable: false,
  itemSize: 32,
  height: '100%',
  indent: 18
})

const emit = defineEmits<VirtualTreeEmits>()

// 节点引用
const nodeRefs = ref<Map<string | number, any>>(new Map())

const setNodeRef = (id: string | number, el: any) => {
  if (el) {
    nodeRefs.value.set(id, el)
  } else {
    nodeRefs.value.delete(id)
  }
}

// 数据扁平化
const {
  flatTree,
  visibleNodes,
  expandedKeys,
  rawData,
  getNodeData,
  getFlatNode,
  regenerateFlatTree,
  setNodeState,
  insertFlatTree
} = useTreeData(props)

// 展开/折叠逻辑
const { expandNode, collapseNode } = useTreeExpand(props, flatTree, expandedKeys)

const dynamicScrollerRef = ref<InstanceType<typeof DynamicScroller> | null>(null)

// 选择逻辑
const {
  checkedKeys,
  halfCheckedKeys,
  selectedKey,
  currentNode,
  toggleNodeChecked,
  setCurrentNode: setSelectionCurrentNode,
  getCheckedNodes,
  getCheckedKeys,
  setCheckedNodes,
  setCheckedKeys,
} = useTreeSelection(props, flatTree, getNodeData)

// 过滤逻辑
const { filter: filterNodes } = useTreeFilter(props, flatTree, expandedKeys)

// 拖拽逻辑
const dragState = useTreeDrag(props, flatTree, getNodeData)

// 选中状态由useTreeSelection管理，这里不需要额外的同步逻辑

// 更新节点的选中状态到扁平树
watch(selectedKey, () => {
  flatTree.value.forEach(node => {
    // 可以添加当前选中节点的样式类
  })
})

// 节点点击
const handleNodeClick = (node: FlatTreeNode, event: MouseEvent) => {
  if (node.isDisabled) return

  // 设置当前选中节点
  setSelectionCurrentNode(node.id, node.data)
  emit('current-change', node.data, createNodeInstance(node))

  emit('node-click', node.data, createNodeInstance(node), event)
}

// 节点展开
const handleNodeExpand = async (node: FlatTreeNode) => {
  if (node.isDisabled) return

  // 懒加载
  if (props.lazy && !node.isLoaded && props.load) {
    // 设置loading状态到缓存和节点
    setNodeState(node.id, { isLoading: true })
    node.isLoading = true

    try {
      await new Promise<void>((resolve, reject) => {
        let resolved = false
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true
            setNodeState(node.id, { isLoading: false })
            console.warn('Lazy load timeout: load function did not call resolve callback')
            reject(new Error('Lazy load timeout'))
          }
        }, 30000) // 30秒超时

        props.load!(node.data, (children: TreeNodeData[]) => {
          if (resolved) return
          resolved = true
          clearTimeout(timeout)
          setNodeState(node.id, { isLoading: false, isLoaded: true });
          // 更新节点的子节点
          if (children && children.length > 0) {
            insertFlatTree(node, children);
          }
          resolve()
        })
      })
    } catch (error) {
      setNodeState(node.id, { isLoading: false });
      node.isLoading = false
      console.error('Lazy load error:', error)
    }
  }
  expandNode(node)
  emit('node-expand', node.data, createNodeInstance(node))
}

// 节点折叠
const handleNodeCollapse = (node: FlatTreeNode) => {
  if (node.isDisabled) return
  collapseNode(node)
  emit('node-collapse', node.data, createNodeInstance(node))
}

// 节点复选框点击
const handleNodeCheck = (node: FlatTreeNode) => {
  if (node.isDisabled) return
  toggleNodeChecked(node.id)

  const checkedNodes = getCheckedNodes()
  const checkedKeysArray = getCheckedKeys()
  const halfCheckedNodes = getCheckedNodes(false, true).filter(n => {
    const key = getNodeId(n, props.props)
    return halfCheckedKeys.value.has(key) && !checkedKeys.value.has(key)
  })
  const halfCheckedKeysArray = Array.from(halfCheckedKeys.value).filter(
    key => !checkedKeys.value.has(key)
  )

  emit('node-check', node.data, {
    checkedKeys: checkedKeysArray,
    checkedNodes,
    halfCheckedKeys: halfCheckedKeysArray,
    halfCheckedNodes
  })
}

// 拖拽开始
const handleDragStart = (node: FlatTreeNode, event: DragEvent) => {
  dragState.handleDragStart(node, event)
  emit('node-drag-start', node.data, event)
}

// 拖拽进入
const handleDragEnter = (node: FlatTreeNode, event: DragEvent) => {
  dragState.handleDragEnter(node, event)
  if (dragState.dropNode?.value?.id === node.id && dragState.draggingNode?.value) {
    emit('node-drag-enter', dragState.draggingNode.value.data, event, node.data)
  }
}

// 拖拽离开
const handleDragLeave = (node: FlatTreeNode, event: DragEvent) => {
  dragState.handleDragLeave(node, event)
  if (dragState.draggingNode?.value) {
    emit('node-drag-leave', dragState.draggingNode.value.data, event, node.data)
  }
}

// 拖拽悬停
const handleDragOver = (node: FlatTreeNode, event: DragEvent) => {
  dragState.handleDragOver(node, event)
  if (dragState.dropNode?.value?.id === node.id && dragState.draggingNode?.value) {
    emit('node-drag-over', dragState.draggingNode.value.data, event, node.data)
  }
}

// 拖拽结束
const handleDragEnd = (node: FlatTreeNode, event: DragEvent) => {
  if (dragState.draggingNode?.value) {
    emit('node-drag-end', dragState.draggingNode.value.data, event)
  }
  dragState.handleDragEnd(node, event)
}

// 放置
const handleDrop = (node: FlatTreeNode, event: DragEvent) => {
  const result = dragState.handleDrop(node, event)
  if (result) {
    emit('node-drop', result.draggingNode, result.dropNode, result.dropType, event)
  }
}

// 节点实例缓存，避免重复创建和循环引用
const nodeInstanceCache = new WeakMap<FlatTreeNode, TreeNodeInstance>()

// 创建节点实例
const createNodeInstance = (flatNode: FlatTreeNode): TreeNodeInstance => {
  // 如果已经缓存，直接返回
  if (nodeInstanceCache.has(flatNode)) {
    return nodeInstanceCache.get(flatNode)!
  }

  // 延迟计算 parent 和 children，避免循环引用
  let parentInstance: TreeNodeInstance | null = null
  let childrenInstances: TreeNodeInstance[] | null = null

  const getParent = (): TreeNodeInstance | null => {
    if (parentInstance !== null) return parentInstance
    if (flatNode.parentId === null) {
      parentInstance = null
      return null
    }
    const parent = getFlatNode(flatNode.parentId)
    if (!parent) {
      parentInstance = null
      return null
    }
    parentInstance = createNodeInstance(parent)
    return parentInstance
  }

  const getChildren = (): TreeNodeInstance[] => {
    if (childrenInstances !== null) return childrenInstances
    const children = flatTree.value.filter(n => n.parentId === flatNode.id && n.isVisible)
    childrenInstances = children.map(child => createNodeInstance(child))
    return childrenInstances
  }

  const getSiblings = (): TreeNodeInstance[] => {
    const siblings = flatTree.value.filter(
      n => n.parentId === flatNode.parentId && n.id !== flatNode.id && n.isVisible
    )
    return siblings.map(sibling => createNodeInstance(sibling))
  }

  const getAllChildren = (): TreeNodeInstance[] => {
    const result: TreeNodeInstance[] = []
    const visited = new Set<string | number>()
    const traverse = (parentId: string | number) => {
      const children = flatTree.value.filter(n => n.parentId === parentId && n.isVisible)
      children.forEach(child => {
        if (visited.has(child.id)) return // 防止循环引用
        visited.add(child.id)
        result.push(createNodeInstance(child))
        traverse(child.id)
      })
    }
    traverse(flatNode.id)
    return result
  }

  const getAllParents = (): TreeNodeInstance[] => {
    const result: TreeNodeInstance[] = []
    const visited = new Set<string | number>()
    let currentId: string | number | null = flatNode.parentId
    while (currentId !== null) {
      if (visited.has(currentId)) break // 防止循环引用
      visited.add(currentId)
      const parent = getFlatNode(currentId)
      if (parent) {
        result.push(createNodeInstance(parent))
        currentId = parent.parentId
      } else {
        break
      }
    }
    return result
  }

  const instance: TreeNodeInstance = {
    data: flatNode.data,
    key: flatNode.id,
    level: flatNode.level,
    get parent() {
      return getParent()
    },
    get children() {
      return getChildren()
    },
    expanded: flatNode.isExpanded,
    checked: flatNode.isChecked || false,
    disabled: flatNode.isDisabled || false,
    isLeaf: isLeafNode(flatNode.data, props.props),
    getLabel: () => getNodeLabel(flatNode.data, props.props),
    getData: () => flatNode.data,
    getParent,
    getChildren,
    getSiblings,
    getAllChildren,
    getAllParents
  }

  // 缓存实例
  nodeInstanceCache.set(flatNode, instance)
  return instance
}

// 根据 key 获取节点实例
const getNode = (key: string | number): TreeNodeInstance | null => {
  const flatNode = getFlatNode(key)
  return flatNode ? createNodeInstance(flatNode) : null
}


// 暴露的方法
const methods: VirtualTreeMethods = {
  getCheckedNodes: (leafOnly?: boolean, includeHalfChecked?: boolean) => {
    return getCheckedNodes(leafOnly, includeHalfChecked)
  },
  getCheckedKeys: (leafOnly?: boolean) => {
    return getCheckedKeys(leafOnly)
  },
  setCheckedNodes: (nodes: TreeNodeData[], leafOnly?: boolean) => {
    setCheckedNodes(nodes, leafOnly)
  },
  setCheckedKeys: (keys: (string | number)[], leafOnly?: boolean) => {
    setCheckedKeys(keys, leafOnly)
  },
  getCurrentNode: () => {
    return currentNode.value
  },
  setCurrentNode: (node: TreeNodeData | string | number) => {
    if (typeof node === 'string' || typeof node === 'number') {
      const nodeData = getNodeData(node)
      setSelectionCurrentNode(node, nodeData)
    } else {
      const key = getNodeId(node, props.props)
      setSelectionCurrentNode(key, node)
    }
  },
  getCurrentKey: () => {
    return selectedKey.value
  },
  setCurrentKey: (key: string | number) => {
    setSelectionCurrentNode(key, getNodeData(key))
  },
  filter: (value: string) => {
    return filterNodes(value).then(() => {
      nextTick(() => {
        dynamicScrollerRef.value?.scrollToItem(0);
        dynamicScrollerRef.value?.forceUpdate();
      })
    })
  },
  getNode: (key: string | number) => {
    return getNode(key)
  },
  remove: (key: string | number) => {
    const node = findNodeByKey(rawData.value, key, props.props)
    if (!node) return

    // 从原始数据中删除节点
    const removeFromArray = (arr: TreeNodeData[], targetKey: string | number): boolean => {
      for (let i = 0; i < arr.length; i++) {
        if (getNodeId(arr[i], props.props) === targetKey) {
          arr.splice(i, 1)
          return true
        }
        const children = getNodeChildren(arr[i], props.props)
        if (children.length > 0 && removeFromArray(children, targetKey)) {
          return true
        }
      }
      return false
    }

    removeFromArray(rawData.value, key)
    regenerateFlatTree()
  },
  append: (data: TreeNodeData, parentKey?: string | number) => {
    if (parentKey === undefined) {
      rawData.value.push(data)
    } else {
      const parent = findNodeByKey(rawData.value, parentKey, props.props)
      if (parent) {
        const config = props.props || {}
        const childrenKey = config.children || 'children'
        if (!parent[childrenKey]) {
          parent[childrenKey] = []
        }
        parent[childrenKey].push(data)
      }
    }
    regenerateFlatTree()
  },
  insertBefore: (data: TreeNodeData, key: string | number) => {
    const insertIntoArray = (arr: TreeNodeData[], targetKey: string | number, newData: TreeNodeData): boolean => {
      for (let i = 0; i < arr.length; i++) {
        if (getNodeId(arr[i], props.props) === targetKey) {
          arr.splice(i, 0, newData)
          return true
        }
        const children = getNodeChildren(arr[i], props.props)
        if (children.length > 0 && insertIntoArray(children, targetKey, newData)) {
          return true
        }
      }
      return false
    }

    insertIntoArray(rawData.value, key, data)
    regenerateFlatTree()
  },
  insertAfter: (data: TreeNodeData, key: string | number) => {
    const insertIntoArray = (arr: TreeNodeData[], targetKey: string | number, newData: TreeNodeData): boolean => {
      for (let i = 0; i < arr.length; i++) {
        if (getNodeId(arr[i], props.props) === targetKey) {
          arr.splice(i + 1, 0, newData)
          return true
        }
        const children = getNodeChildren(arr[i], props.props)
        if (children.length > 0 && insertIntoArray(children, targetKey, newData)) {
          return true
        }
      }
      return false
    }

    insertIntoArray(rawData.value, key, data)
    regenerateFlatTree()
  },
  updateKeyChildren: (key: string | number, data: TreeNodeData[]) => {
    const node = findNodeByKey(rawData.value, key, props.props)
    if (node) {
      const config = props.props || {}
      const childrenKey = config.children || 'children'
      node[childrenKey] = data
      regenerateFlatTree()
    }
  }
}

// 暴露方法给父组件
defineExpose(methods)
</script>

<style scoped>
.vue-virtual-tree {
  width: 100%;
  overflow: hidden;
}

.vue-virtual-tree__scroller {
  height: 100%;
}

.vue-virtual-tree__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  font-size: 14px;
}
</style>
