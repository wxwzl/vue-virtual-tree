<template>
  <div class="demo-section">
    <h2>子节点懒加载</h2>
    <div class="info-box">
      <p><strong>说明：</strong>演示懒加载功能，点击展开图标时异步加载子节点</p>
      <ul>
        <li>根节点预设为可展开状态，但没有预加载子节点</li>
        <li>点击展开时触发load回调函数异步获取子节点</li>
        <li>支持加载状态显示和错误处理</li>
      </ul>
    </div>
    <div class="tree-container">
      <VirtualTree :data="lazyTreeData" :height="400" lazy :load="handleLazyLoad" />
    </div>
    <div class="control-panel">
      <button @click="resetLazyData" class="btn">重置懒加载数据</button>
    </div>
    <div class="lazy-log" v-if="lazyLogs.length > 0">
      <h3>懒加载日志：</h3>
      <div class="log-item" v-for="(log, index) in lazyLogs" :key="index">
        {{ log }}
      </div>
      <button @click="clearLazyLogs" class="btn btn-small">清空日志</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { VirtualTree } from '@wxwzl/vue-virtual-tree'
import type { TreeNodeData } from '@wxwzl/vue-virtual-tree'

const lazyTreeData = ref<TreeNodeData[]>([
  {
    id: 'lazy-1',
    label: '懒加载节点 1',
    isLeaf: false,
  },
  {
    id: 'lazy-2',
    label: '懒加载节点 2',
    isLeaf: false,
  },
  {
    id: 'lazy-3',
    label: '懒加载节点 3',
    isLeaf: false,
  },
  {
    id: 'lazy-4',
    label: '懒加载节点 4',
    isLeaf: false,
  }
])

const lazyLogs = ref<string[]>([])

const addLazyLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString()
  lazyLogs.value.unshift(`[${timestamp}] ${message}`)
  if (lazyLogs.value.length > 20) {
    lazyLogs.value = lazyLogs.value.slice(0, 20)
  }
}

const clearLazyLogs = () => {
  lazyLogs.value = []
}

const handleLazyLoad = (node: TreeNodeData, resolve: (data: TreeNodeData[]) => void) => {
  addLazyLog(`开始加载节点: ${node.label || node.id}`)

  setTimeout(() => {
    const nodeId = node.id as string
    let children: TreeNodeData[] = []

    if (nodeId === 'lazy-1') {
      children = [
        { id: 'lazy-1-1', label: '懒加载子节点 1-1', isLeaf: true },
        { id: 'lazy-1-2', label: '懒加载子节点 1-2', isLeaf: true },
        {
          id: 'lazy-1-3',
          label: '懒加载子节点 1-3',
          isLeaf: false,
        }
      ]
    } else if (nodeId === 'lazy-2') {
      children = [
        { id: 'lazy-2-1', label: '懒加载子节点 2-1', isLeaf: true },
        { id: 'lazy-2-2', label: '懒加载子节点 2-2', isLeaf: true },
        { id: 'lazy-2-3', label: '懒加载子节点 2-3', isLeaf: true },
        { id: 'lazy-2-4', label: '懒加载子节点 2-4', isLeaf: true }
      ]
    } else if (nodeId === 'lazy-3') {
      addLazyLog(`加载节点失败: ${node.label || node.id}`)
      resolve([])
      return
    } else if (nodeId === 'lazy-4') {
      children = [
        { id: 'lazy-4-1', label: '懒加载子节点 4-1', isLeaf: true }
      ]
    } else if (nodeId === 'lazy-1-3') {
      children = [
        { id: 'lazy-1-3-1', label: '懒加载孙节点 1-3-1', isLeaf: true },
        { id: 'lazy-1-3-2', label: '懒加载孙节点 1-3-2', isLeaf: true }
      ]
    }

    addLazyLog(`加载完成: ${node.label || node.id} -> ${children.length} 个子节点`)
    resolve(children)
  }, Math.random() * 1000 + 500)
}

const resetLazyData = () => {
  lazyTreeData.value = [
    {
      id: 'lazy-1',
      label: '懒加载节点 1',
      isLeaf: false,
    },
    {
      id: 'lazy-2',
      label: '懒加载节点 2',
      isLeaf: false,
    },
    {
      id: 'lazy-3',
      label: '懒加载节点 3',
      isLeaf: false,
    },
    {
      id: 'lazy-4',
      label: '懒加载节点 4',
      isLeaf: false,
    }
  ]
  lazyLogs.value = []
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

.info-box ul {
  margin-left: 20px;
  margin-top: 8px;
}

.info-box li {
  margin-bottom: 4px;
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

.lazy-log {
  margin-top: 15px;
  padding: 12px;
  background-color: #f0f9ff;
  border: 1px solid #b3d8ff;
  border-radius: 4px;
}

.lazy-log h3 {
  margin-bottom: 10px;
  font-size: 14px;
  color: #409eff;
  font-weight: 500;
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

