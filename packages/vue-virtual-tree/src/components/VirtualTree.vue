<template>
  <div class="vue-virtual-tree" :style="{ height: typeof height === 'number' ? `${height}px` : height }"
    @click="handleTreeClick">
    <template v-if="loading">
      <slot name="tree-loading">
        <div v-if="loading" class="vue-virtual-tree__loading">
          <!-- 默认loading -->
          <span class="vue-virtual-tree-loading-text">加载中...</span>
        </div>
      </slot>
    </template>
    <template v-else>
      <DynamicScroller ref="dynamicScrollerRef" v-if="data.length > 0" :items="visibleNodes"
        :min-item-size="itemSize || 32" class="vue-virtual-tree__scroller">
        <template #default="{ item, index, active }">
          <DynamicScrollerItem :item="item" :active="active" :data-index="index"
            :size-dependencies="getNodeSizeDependencies(item)" class="vue-virtual-tree__item">
            <TreeNode :node="item" :key="item.id" :index="index" :props="props.props" :show-checkbox="showCheckbox"
              :expand-on-click-node="expandOnClickNode" :draggable="draggable" :indent="props.indent"
              :current-key="selectedKey"
              :drop-type="dragState.dropNode?.value?.id === item.id ? dragState.dropType?.value ?? null : null"
              @drag-start="handleDragStart" @drag-enter="handleDragEnter" @drag-leave="handleDragLeave"
              @drag-over="handleDragOver" @drag-end="handleDragEnd" @drop="handleDrop">
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
                  <span class="default-icon">
                    <svg v-if="!node.isLeaf" viewBox="0 0 1024 1024" width="16" height="16">
                      <path d="M384 384l256 256-256 256z" fill="currentColor" />
                    </svg>
                  </span>
                </slot>
              </template>
            </TreeNode>
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>
      <div v-else class="vue-virtual-tree__empty">
        <slot name="empty">
          <span>暂无数据</span>
        </slot>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import TreeNode from './TreeNode.vue'
import type { VirtualTreeProps, VirtualTreeEmits, VirtualTreeMethods, FlatTreeNode, TreeNodeData, TreeNodeInstance } from '../types'
import { useTreeData } from '../composables/useTreeData'
import { getNodeId, findNodeByKey, getNodeChildren, isLeafNode, getNodeLabel } from '../utils/tree'


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
  indent: 18,
  loading: false
})

const emit = defineEmits<VirtualTreeEmits>()

// 数据扁平化
const {
  visibleNodes,
  rawData,
  getNodeData,
  getFlatNode,
  regenerateFlatTree,
  insertFlatTree,
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
  expandNode,
  collapseNode,
  dragState,
  filter: filterNodes,
} = useTreeData(props, emit)

const dynamicScrollerRef = ref<InstanceType<typeof DynamicScroller> | null>(null)

// 计算节点高度依赖项，用于 DynamicScroller 重新计算高度
const getNodeSizeDependencies = (item: FlatTreeNode) => {
  // 包含所有可能影响节点高度的状态和数据
  return [
    item.data,
    item.isExpanded,
    item.isChecked,
    item.isLoading,
    item.isDisabled,
    item.level,
    // 如果节点数据中有 label，也包含进来，因为长文本可能换行
    getNodeLabel(item.data, props.props)
  ]
}

// 事件委托：从事件目标查找节点
const getNodeFromEvent = (event: Event): FlatTreeNode | null => {
  const target = event.target as HTMLElement
  if (!target) return null

  // 查找最近的带有 data-node-id 属性的元素
  const nodeElement = target.closest('[data-node-id]')
  if (!nodeElement) return null

  const nodeId = nodeElement.getAttribute('data-node-id')
  const nodeIndex = nodeElement.getAttribute('data-node-index')
  if (!nodeId) return null
  // 尝试解析为 number 或 string
  const id = isNaN(Number(nodeId)) ? nodeId : Number(nodeId)
  const index = isNaN(Number(nodeIndex)) ? undefined : Number(nodeIndex)
  const flatNode = getFlatNode(id)
  if (flatNode) {
    flatNode.visibleIndex = index
  }
  return flatNode
}

// 事件委托：树容器点击事件（只代理 click 事件）
const handleTreeClick = (event: MouseEvent) => {
  const node = getNodeFromEvent(event)
  if (!node) return

  const target = event.target as HTMLElement
  if (!target) return

  // 检查点击的是哪个区域
  const expandIcon = target.closest('.vue-virtual-tree-node__expand-icon')
  const checkbox = target.closest('.vue-virtual-tree-node__checkbox')
  const content = target.closest('.vue-virtual-tree-node__content')

  if (checkbox) {
    // 点击复选框
    handleNodeCheck(node)
  } else if (expandIcon) {
    // 点击展开图标
    if (node.isExpanded) {
      handleNodeCollapse(node)
    } else {
      handleNodeExpand(node)
    }
  } else if (content) {
    // 点击节点内容
    handleNodeClick(node, event)
    if (props.expandOnClickNode && !isLeafNode(node.data, props.props)) {
      if (node.isExpanded) {
        handleNodeCollapse(node)
      } else {
        handleNodeExpand(node)
      }
    }
  }
}

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
    node.isLoading = true
    node.isLoaded = false
    function resolveCallback() {
      node.isLoading = false
      node.isLoaded = true
    }
    try {
      await new Promise<void>((resolve) => {
        props.load!(node.data, (children: TreeNodeData[]) => {
          // 更新节点的子节点
          if (children && children.length > 0) {
            insertFlatTree(node, children);
          }
          resolveCallback()
          resolve()
        })
      })
    } catch (error) {
      resolveCallback();
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
    const children = visibleNodes.value.filter(n => n.parentId === flatNode.id)
    childrenInstances = children.map(child => createNodeInstance(child))
    return childrenInstances
  }

  const getSiblings = (): TreeNodeInstance[] => {
    const siblings = visibleNodes.value.filter(
      n => n.parentId === flatNode.parentId && n.id !== flatNode.id
    )
    return siblings.map(sibling => createNodeInstance(sibling))
  }

  const getAllChildren = (): TreeNodeInstance[] => {
    const result: TreeNodeInstance[] = []
    const visited = new Set<string | number>()
    const traverse = (parentId: string | number) => {
      const children = visibleNodes.value.filter(n => n.parentId === parentId)
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
  },
  scrollToNode: (key: string | number | TreeNodeData, options?: { align?: 'top' | 'center' | 'bottom', offset?: number }) => {
    // 获取节点的 key
    let targetKey: string | number
    if (typeof key === 'string' || typeof key === 'number') {
      targetKey = key
    } else {
      targetKey = getNodeId(key, props.props)
    }

    // 查找对应的 FlatTreeNode
    const flatNode = getFlatNode(targetKey)
    if (!flatNode) {
      console.warn(`[VirtualTree] Node with key "${targetKey}" not found`)
      return
    }
    const parents: FlatTreeNode[] = []
    const collectParents = (node: FlatTreeNode) => {
      if (node.parentId !== null) {
        const parent = getFlatNode(node.parentId)
        if (parent && !parent.isExpanded) {
          parents.push(parent)
          collectParents(parent)
        }
      }
    }
    // 如果节点不在可见列表中，需要展开所有父节点
    const ensureNodeVisible = async (node: FlatTreeNode) => {
      collectParents(node)
      while (parents.length > 0) {
        const parent = parents.pop()
        if (parent) {
          // 展开父节点
          await handleNodeExpand(parent)
          // 等待 DOM 更新
          await nextTick()
        }
      }
    }

    // 执行滚动
    const performScroll = async () => {
      // 确保节点可见
      await ensureNodeVisible(flatNode)

      // 等待 DOM 更新完成
      await nextTick()

      // 查找节点在 visibleNodes 中的索引
      const index = visibleNodes.value.findIndex(node => node.id === targetKey)
      if (index === -1) {
        console.warn(`[VirtualTree] Node with key "${targetKey}" is not visible`)
        return
      }

      // 调用 DynamicScroller 的 scrollToItem 方法
      if (dynamicScrollerRef.value) {
        const align = options?.align || 'top'
        const offset = options?.offset || 0

        // DynamicScroller 的 scrollToItem 方法签名: scrollToItem(index, align?, offset?)
        // align: 'start' | 'center' | 'end'
        const alignMap: Record<'top' | 'center' | 'bottom', 'start' | 'center' | 'end'> = {
          top: 'start',
          center: 'center',
          bottom: 'end'
        }

        const scroller = dynamicScrollerRef.value
        if (scroller && typeof scroller.scrollToItem === 'function') {
          if (offset !== 0) {
            // 如果提供了 offset，使用三个参数
            scroller.scrollToItem(index, alignMap[align], offset)
          } else if (align !== 'top') {
            // 如果提供了 align，使用两个参数
            scroller.scrollToItem(index, alignMap[align])
          } else {
            // 只使用 index
            scroller.scrollToItem(index)
          }
        }

        // 强制更新以确保滚动生效
        if (typeof scroller.forceUpdate === 'function') {
          scroller.forceUpdate()
        }
      }
    }

    performScroll()
  },
}

// 暴露方法给父组件
defineExpose(methods)
</script>

<style scoped lang="scss">
.vue-virtual-tree {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-size: 14px;
  color: #606266;

  &__scroller {
    height: 100%;
  }

  &__item {
    width: 100%;
  }
}

.vue-virtual-tree__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  font-size: 14px;
}

.vue-virtual-tree__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
}

.vue-virtual-tree-loading-arc {
  animation: vue-virtual-tree-loading-rotate 1s linear infinite;
  transform-origin: center;
}

.vue-virtual-tree-loading-text {
  font-size: 14px;
  color: #909399;
}

.vue-virtual-tree-node {
  &.is-expanded .vue-virtual-tree-node__expand-icon .default-icon {
    transform: rotate(90deg);
  }

  &.is-loading {
    .vue-virtual-tree-node__expand-icon {
      color: #409eff;
    }
  }

  &__loading-icon {
    animation: vue-virtual-tree-loading-rotate 1.5s linear infinite;
  }

  &__loading-dots {
    animation: vue-virtual-tree-loading-dots-rotate 1.5s linear infinite;
  }

  @keyframes vue-virtual-tree-loading-rotate {
    0% {
      transform: rotate(0deg);
    }

    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes vue-virtual-tree-loading-dots-rotate {
    0% {
      transform: rotate(0deg);
    }

    100% {
      transform: rotate(360deg);
    }
  }
}
</style>
