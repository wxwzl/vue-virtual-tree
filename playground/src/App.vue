<template>
  <div class="app">
    <h1>Vue Virtual Tree Playground</h1>
    
    <div class="demo-section">
      <h2>基础用法</h2>
      <div class="tree-container">
        <VirtualTree :data="treeData" :height="400" />
      </div>
    </div>

    <div class="demo-section">
      <h2>带复选框</h2>
      <div class="tree-container">
        <VirtualTree
          :data="treeData"
          :height="400"
          show-checkbox
          @node-check="handleNodeCheck"
        />
      </div>
    </div>

    <div class="demo-section">
      <h2>默认展开所有</h2>
      <div class="tree-container">
        <VirtualTree
          :data="treeData"
          :height="400"
          default-expand-all
        />
      </div>
    </div>

    <div class="demo-section">
      <h2>可拖拽</h2>
      <div class="info-box">
        <p><strong>说明：</strong>拖拽节点可以重新排序，支持拖拽到节点前、节点内、节点后三种位置</p>
      </div>
      <div class="tree-container">
        <VirtualTree
          :data="dragTreeData"
          :height="400"
          draggable
          @node-drag-start="handleDragStart"
          @node-drag-enter="handleDragEnter"
          @node-drag-leave="handleDragLeave"
          @node-drag-over="handleDragOver"
          @node-drag-end="handleDragEnd"
          @node-drop="handleNodeDrop"
        />
      </div>
      <div class="control-panel">
        <button @click="resetDragTreeData" class="btn">重置拖拽数据</button>
      </div>
      <div class="drag-log" v-if="dragLogs.length > 0">
        <h3>拖拽日志：</h3>
        <div class="log-item" v-for="(log, index) in dragLogs" :key="index">
          {{ log }}
        </div>
        <button @click="clearDragLogs" class="btn btn-small">清空日志</button>
      </div>
    </div>

    <div class="demo-section">
      <h2>过滤</h2>
      <div class="tree-container">
        <input
          v-model="filterText"
          placeholder="输入关键字过滤"
          @input="handleFilter"
          class="filter-input"
        />
        <VirtualTree
          ref="treeRef"
          :data="treeData"
          :height="400"
        />
      </div>
    </div>

    <div class="demo-section">
      <h2>默认展开和选中（defaultExpandedKeys & defaultCheckedKeys）</h2>
      <div class="info-box">
        <p><strong>说明：</strong></p>
        <ul>
          <li>默认展开：node-1, node-2, node-1-1, node-2-1</li>
          <li>默认选中：node-1, node-1-1, node-2-2, node-3</li>
          <li>验证：展开的节点应该显示，选中的节点应该有复选框标记</li>
        </ul>
      </div>
      <div class="tree-container">
        <VirtualTree
          :data="treeData"
          :height="400"
          :default-expanded-keys="defaultExpandedKeys"
          :default-checked-keys="defaultCheckedKeys"
          show-checkbox
          @node-check="handleNodeCheck"
        />
      </div>
      <div class="control-panel">
        <button @click="resetExpandedKeys" class="btn">重置展开状态</button>
        <button @click="resetCheckedKeys" class="btn">重置选中状态</button>
        <button @click="updateExpandedKeys" class="btn">更新展开节点</button>
        <button @click="updateCheckedKeys" class="btn">更新选中节点</button>
      </div>
    </div>

    <div class="demo-section">
      <h2>异步数据加载测试</h2>
      <div class="info-box">
        <p><strong>说明：</strong>模拟异步加载数据，验证在数据加载后 defaultExpandedKeys 和 defaultCheckedKeys 是否正常工作</p>
      </div>
      <div class="tree-container">
        <VirtualTree
          v-if="asyncTreeData.length > 0"
          :data="asyncTreeData"
          :height="400"
          :default-expanded-keys="asyncExpandedKeys"
          :default-checked-keys="asyncCheckedKeys"
          show-checkbox
        />
        <div v-else class="loading">加载中...</div>
      </div>
      <div class="control-panel">
        <button @click="loadAsyncData" class="btn">重新加载数据</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { VirtualTree } from 'vue-virtual-tree'
import type { TreeNodeData, VirtualTreeMethods } from 'vue-virtual-tree'

const treeRef = ref<VirtualTreeMethods | null>(null)
const filterText = ref('')

// 生成测试数据
const generateTreeData = (): TreeNodeData[] => {
  const data: TreeNodeData[] = []
  for (let i = 1; i <= 5; i++) {
    const node: TreeNodeData = {
      id: `node-${i}`,
      label: `节点 ${i}`
    }
    const children: TreeNodeData[] = []
    for (let j = 1; j <= 5; j++) {
      const child: TreeNodeData = {
        id: `node-${i}-${j}`,
        label: `节点 ${i}-${j}`
      }
      const grandchildren: TreeNodeData[] = []
      for (let k = 1; k <= 5; k++) {
        grandchildren.push({
          id: `node-${i}-${j}-${k}`,
          label: `节点 ${i}-${j}-${k}`
        })
      }
      child.children = grandchildren
      children.push(child)
    }
    node.children = children
    data.push(node)
  }
  return data
}

const treeData = ref<TreeNodeData[]>(generateTreeData())

// 拖拽示例专用数据
const generateDraggableTreeData = (): TreeNodeData[] => [
  {
    id: 'drag-1',
    label: '拖拽节点 1',
    children: [
      { id: 'drag-1-1', label: '拖拽节点 1-1' },
      { id: 'drag-1-2', label: '拖拽节点 1-2' }
    ]
  },
  {
    id: 'drag-2',
    label: '拖拽节点 2',
    children: [
      {
        id: 'drag-2-1',
        label: '拖拽节点 2-1',
        children: [
          { id: 'drag-2-1-1', label: '拖拽节点 2-1-1' },
          { id: 'drag-2-1-2', label: '拖拽节点 2-1-2' }
        ]
      },
      { id: 'drag-2-2', label: '拖拽节点 2-2' }
    ]
  },
  {
    id: 'drag-3',
    label: '拖拽节点 3'
  }
]

const dragTreeData = ref<TreeNodeData[]>(generateDraggableTreeData())

// 默认展开的节点
const defaultExpandedKeys = ref<(string | number)[]>([
  'node-1',
  'node-2',
  'node-1-1',
  'node-2-1'
])

// 默认选中的节点
const defaultCheckedKeys = ref<(string | number)[]>([
  'node-1',
  'node-1-1',
  'node-2-2',
  'node-3'
])

// 异步数据相关
const asyncTreeData = ref<TreeNodeData[]>([])
const asyncExpandedKeys = ref<(string | number)[]>(['async-1', 'async-1-1'])
const asyncCheckedKeys = ref<(string | number)[]>(['async-1', 'async-2', 'async-1-1'])

// 生成异步测试数据
const generateAsyncData = (): TreeNodeData[] => {
  return [
    {
      id: 'async-1',
      label: '异步节点 1',
      children: [
        {
          id: 'async-1-1',
          label: '异步节点 1-1',
          children: [
            { id: 'async-1-1-1', label: '异步节点 1-1-1' },
            { id: 'async-1-1-2', label: '异步节点 1-1-2' }
          ]
        },
        { id: 'async-1-2', label: '异步节点 1-2' }
      ]
    },
    {
      id: 'async-2',
      label: '异步节点 2',
      children: [
        { id: 'async-2-1', label: '异步节点 2-1' },
        { id: 'async-2-2', label: '异步节点 2-2' }
      ]
    },
    {
      id: 'async-3',
      label: '异步节点 3'
    }
  ]
}

// 加载异步数据
const loadAsyncData = () => {
  asyncTreeData.value = []
  setTimeout(() => {
    asyncTreeData.value = generateAsyncData()
  }, 1000)
}

// 重置展开状态
const resetExpandedKeys = () => {
  defaultExpandedKeys.value = []
}

// 重置选中状态
const resetCheckedKeys = () => {
  defaultCheckedKeys.value = []
}

// 更新展开节点
const updateExpandedKeys = () => {
  defaultExpandedKeys.value = ['node-1', 'node-3', 'node-1-2']
}

// 更新选中节点
const updateCheckedKeys = () => {
  defaultCheckedKeys.value = ['node-1', 'node-2', 'node-3', 'node-1-1', 'node-1-2']
}

const handleNodeCheck = (data: TreeNodeData, info: any) => {
  console.log('Node checked:', data, info)
}

// 拖拽日志
const dragLogs = ref<string[]>([])

const addDragLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString()
  dragLogs.value.unshift(`[${timestamp}] ${message}`)
  // 最多保留20条日志
  if (dragLogs.value.length > 20) {
    dragLogs.value = dragLogs.value.slice(0, 20)
  }
}

const clearDragLogs = () => {
  dragLogs.value = []
}

const resetDragTreeData = () => {
  dragTreeData.value = generateDraggableTreeData()
  dragLogs.value = []
}

const handleDragStart = (node: TreeNodeData, event: DragEvent) => {
  addDragLog(`开始拖拽节点: ${node.label || node.id}`)
  console.log('Drag start:', node)
}

const handleDragEnter = (draggingNode: TreeNodeData, event: DragEvent, node: TreeNodeData) => {
  addDragLog(`进入节点: ${node.label || node.id}`)
  console.log('Drag enter:', { draggingNode, node })
}

const handleDragLeave = (draggingNode: TreeNodeData, event: DragEvent, node: TreeNodeData) => {
  addDragLog(`离开节点: ${node.label || node.id}`)
  console.log('Drag leave:', { draggingNode, node })
}

const handleDragOver = (draggingNode: TreeNodeData, event: DragEvent, node: TreeNodeData) => {
  // 悬停事件太频繁，不记录日志
  console.log('Drag over:', { draggingNode, node })
}

const handleDragEnd = (draggingNode: TreeNodeData, event: DragEvent) => {
  addDragLog(`结束拖拽: ${draggingNode.label || draggingNode.id}`)
  console.log('Drag end:', draggingNode)
}

interface NodeMeta {
  node: TreeNodeData
  parent: TreeNodeData | null
  siblings: TreeNodeData[]
  index: number
}

const findNodeMeta = (nodes: TreeNodeData[], id: string | number, parent: TreeNodeData | null = null): NodeMeta | null => {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.id === id) {
      return { node, parent, siblings: nodes, index: i }
    }
    if (node.children?.length) {
      const result = findNodeMeta(node.children, id, node)
      if (result) return result
    }
  }
  return null
}

const removeNodeById = (nodes: TreeNodeData[], id: string | number): NodeMeta | null => {
  const meta = findNodeMeta(nodes, id)
  if (!meta) return null
  meta.siblings.splice(meta.index, 1)
  return meta
}

const isDescendant = (root: TreeNodeData, targetId: string | number): boolean => {
  const children = root.children || []
  for (const child of children) {
    if (child.id === targetId || isDescendant(child, targetId)) {
      return true
    }
  }
  return false
}

const handleNodeDrop = (
  draggingNode: TreeNodeData,
  dropNode: TreeNodeData,
  dropType: 'prev' | 'inner' | 'next',
  event: DragEvent
) => {
  const typeMap: Record<'prev' | 'inner' | 'next', string> = {
    prev: '之前',
    inner: '内部',
    next: '之后'
  }
  addDragLog(`放置节点: ${draggingNode.label || draggingNode.id} -> ${dropNode.label || dropNode.id} (${typeMap[dropType]})`)
  console.log('Node dropped:', { draggingNode, dropNode, dropType })

  if (draggingNode.id === dropNode.id) return
  if (isDescendant(draggingNode, dropNode.id)) {
    addDragLog('无法将节点放置到其自身的子节点位置')
    return
  }

  const workingData = [...dragTreeData.value]
  const removedMeta = removeNodeById(workingData, draggingNode.id)
  if (!removedMeta) return

  const targetMeta = findNodeMeta(workingData, dropNode.id)
  if (!targetMeta) {
    // 如果目标节点在移除后不存在，恢复原数据
    dragTreeData.value = [...generateDraggableTreeData()]
    return
  }

  const insertIntoParent = (parent: TreeNodeData | null, index: number) => {
    const siblings = parent ? (parent.children = parent.children || []) : workingData
    if (
      removedMeta.parent &&
      parent &&
      removedMeta.parent.id === parent.id &&
      removedMeta.index < index
    ) {
      index -= 1
    }
    siblings.splice(index, 0, removedMeta.node)
  }

  if (dropType === 'inner') {
    targetMeta.node.children = targetMeta.node.children || []
    targetMeta.node.children.push(removedMeta.node)
  } else if (dropType === 'prev') {
    insertIntoParent(targetMeta.parent, targetMeta.index)
  } else if (dropType === 'next') {
    insertIntoParent(targetMeta.parent, targetMeta.index + 1)
  }

  dragTreeData.value = [...workingData]
}

const handleFilter = () => {
  if (treeRef.value) {
    treeRef.value.filter(filterText.value)
  }
}

// 组件挂载后加载异步数据
onMounted(() => {
  loadAsyncData()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  padding: 20px;
  background-color: #f5f5f5;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
}

h1 {
  margin-bottom: 30px;
  color: #303133;
}

.demo-section {
  margin-bottom: 40px;
  background: white;
  padding: 20px;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.demo-section h2 {
  margin-bottom: 20px;
  color: #606266;
  font-size: 18px;
}

.tree-container {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.filter-input {
  width: 100%;
  padding: 8px 12px;
  margin-bottom: 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
}

.filter-input:focus {
  outline: none;
  border-color: #409eff;
}

.info-box {
  background-color: #f0f9ff;
  border: 1px solid #b3d8ff;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 15px;
  font-size: 14px;
  color: #606266;
}

.info-box p {
  margin-bottom: 8px;
  font-weight: 500;
}

.info-box ul {
  margin-left: 20px;
  margin-top: 8px;
}

.info-box li {
  margin-bottom: 4px;
}

.control-panel {
  margin-top: 15px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 16px;
  background-color: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.btn:hover {
  background-color: #66b1ff;
}

.btn:active {
  background-color: #3a8ee6;
}

.loading {
  padding: 40px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

.drag-log {
  margin-top: 15px;
  padding: 12px;
  background-color: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.drag-log h3 {
  margin-bottom: 10px;
  font-size: 14px;
  color: #606266;
}

.log-item {
  padding: 4px 0;
  font-size: 12px;
  color: #909399;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  border-bottom: 1px solid #ebeef5;
}

.log-item:last-child {
  border-bottom: none;
}

.btn-small {
  margin-top: 10px;
  padding: 4px 12px;
  font-size: 12px;
}
</style>

