<template>
  <div class="demo-section">
    <h2>可拖拽</h2>
    <div class="info-box">
      <p><strong>说明：</strong>拖拽节点可以重新排序，支持拖拽到节点前、节点内、节点后三种位置</p>
    </div>
    <div class="tree-container">
      <VirtualTree :data="dragTreeData" :height="400" draggable @node-drag-start="handleDragStart"
        @node-drag-enter="handleDragEnter" @node-drag-leave="handleDragLeave" @node-drag-over="handleDragOver"
        @node-drag-end="handleDragEnd" @node-drop="handleNodeDrop" />
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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { VirtualTree } from '@wxwzl/vue-virtual-tree'
import type { TreeNodeData } from '@wxwzl/vue-virtual-tree'

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
const dragLogs = ref<string[]>([])

const addDragLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString()
  dragLogs.value.unshift(`[${timestamp}] ${message}`)
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
</script>

<style scoped>
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

.tree-container {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
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

.btn-small {
  margin-top: 10px;
  padding: 4px 12px;
  font-size: 12px;
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
</style>

