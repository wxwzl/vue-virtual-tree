<template>
  <div class="demo-section">
    <h2>滚动到指定节点</h2>
    <div class="control-panel">
      <div class="scroll-controls">
        <div class="control-group">
          <label class="control-label">
            节点 ID：
            <input type="text" v-model="targetKey" placeholder="输入节点 ID，如: 100, 200, 300" class="input"
              @keyup.enter="handleScrollToNode" />
          </label>
        </div>
        <div class="control-group">
          <label class="control-label">
            对齐方式：
            <select v-model="alignOption" class="select">
              <option value="top">顶部对齐</option>
              <option value="center">居中</option>
              <option value="bottom">底部对齐</option>
            </select>
          </label>
        </div>
        <div class="control-group">
          <label class="control-label">
            偏移量：
            <input type="number" v-model.number="offsetValue" placeholder="0" class="input-number" />
          </label>
        </div>
        <button class="btn btn-primary" @click="handleScrollToNode">滚动到节点</button>
      </div>
      <div class="quick-actions">
        <span class="label">快速测试：</span>
        <button class="btn btn-small" @click="scrollToRandomNode">随机节点</button>
        <button class="btn btn-small" @click="scrollToDeepNode">深层节点</button>
        <button class="btn btn-small" @click="scrollToFirstNode">第一个节点</button>
        <button class="btn btn-small" @click="scrollToLastNode">最后一个节点</button>
      </div>
      <div class="data-controls">
        <div class="control-group">
          <label class="control-label">
            节点数量：
            <input type="number" min="100" step="100" v-model.number="nodeCount" @change="handleCountChange"
              class="input-number" />
          </label>
        </div>
        <button class="btn btn-secondary" @click="regenerateData">重新生成</button>
      </div>
      <div class="info-panel">
        <div class="info-item">
          <span class="info-label">总节点数：</span>
          <span class="info-value">{{ totalNodeCount.toLocaleString() }}</span>
        </div>
        <div class="info-item" v-if="lastScrolledNode">
          <span class="info-label">上次滚动到：</span>
          <span class="info-value">{{ lastScrolledNode }}</span>
        </div>
      </div>
    </div>
    <div class="tree-container">
      <div class="tree-shell">
        <VirtualTree ref="treeRef" :data="treeData" :loading="isLoading" class="tree-scroll"
          @node-generated="handleDataGenerated" @node-click="handleNodeClick" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { VirtualTree } from '@wxwzl/vue-virtual-tree'
// @ts-ignore - 类型定义可能未完全导出，但不影响运行时
import type { VirtualTreeMethods, TreeNodeData } from '@wxwzl/vue-virtual-tree'
import { generateVirtualTreeData } from '../utils/treeData'

const treeRef = ref<VirtualTreeMethods | null>(null)
const treeData = ref<TreeNodeData[]>([])
const isLoading = ref(true)
const totalNodeCount = ref(0)
const nodeCount = ref(2000)
const targetKey = ref('')
const alignOption = ref<'top' | 'center' | 'bottom'>('top')
const offsetValue = ref(0)
const lastScrolledNode = ref<string | number | null>(null)

// 生成测试数据
const generateTestData = async (count?: number) => {
  isLoading.value = true
  const countToUse = count ?? nodeCount.value
  // 生成一个包含多个层级的树，方便测试
  const result = await generateVirtualTreeData(countToUse)
  treeData.value = result.data
  totalNodeCount.value = result.totalCount
}

// 重新生成数据
const regenerateData = async () => {
  await generateTestData()
}

// 处理节点数量变化
const handleCountChange = async () => {
  if (nodeCount.value < 100) {
    nodeCount.value = 100
  }
  await generateTestData()
}

const handleDataGenerated = () => {
  isLoading.value = false
}

// 滚动到指定节点
const handleScrollToNode = () => {
  if (!treeRef.value || !targetKey.value) {
    return
  }

  const key = targetKey.value.trim()
  // 尝试转换为数字，如果失败则使用字符串
  const nodeKey = isNaN(Number(key)) ? key : Number(key)

  try {
    treeRef.value.scrollToNode(nodeKey, {
      align: alignOption.value,
      offset: offsetValue.value
    })
    lastScrolledNode.value = nodeKey
  } catch (error) {
    console.error('滚动失败:', error)
  }
}

// 滚动到随机节点
const scrollToRandomNode = () => {
  if (!treeRef.value || treeData.value.length === 0) return

  // 递归收集所有节点 ID
  const collectNodeIds = (nodes: TreeNodeData[]): (string | number)[] => {
    const ids: (string | number)[] = []
    const traverse = (nodeList: TreeNodeData[]) => {
      nodeList.forEach(node => {
        ids.push(node.id)
        if (node.children && node.children.length > 0) {
          traverse(node.children)
        }
      })
    }
    traverse(nodes)
    return ids
  }

  const allIds = collectNodeIds(treeData.value)
  if (allIds.length === 0) return

  const randomId = allIds[Math.floor(Math.random() * allIds.length)]
  targetKey.value = String(randomId)
  alignOption.value = 'center'
  offsetValue.value = 0
  handleScrollToNode()
}

// 滚动到深层节点（找到最深的节点，至少第3层，depth >= 2）
const scrollToDeepNode = () => {
  if (!treeRef.value || treeData.value.length === 0) return

  // 递归查找最深的节点（至少深度为2，即第3层节点）
  let deepestNode: TreeNodeData | null = null
  let maxDepth = -1
  const minDepth = 2 // 至少第3层（depth 0是第1层，depth 1是第2层，depth 2是第3层）

  const findDeepestNode = (nodes: TreeNodeData[], depth: number = 0): void => {
    for (const node of nodes) {
      // 如果当前深度大于等于最小深度，且比之前找到的节点更深，则更新
      if (depth >= minDepth && depth > maxDepth) {
        deepestNode = node
        maxDepth = depth
      }
      // 如果有子节点，继续递归查找
      if (node.children && node.children.length > 0) {
        findDeepestNode(node.children, depth + 1)
      }
    }
  }

  findDeepestNode(treeData.value)

  if (deepestNode) {
    targetKey.value = String(deepestNode.id)
    alignOption.value = 'center'
    offsetValue.value = 0
    handleScrollToNode()
  } else {
    // 如果没有找到深层节点（depth >= 2），尝试找第一个有子节点的子节点（depth = 1）
    const findFirstChildNode = (nodes: TreeNodeData[]): TreeNodeData | null => {
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          // 返回第一个子节点的第一个子节点（即第一个孙节点，depth = 2）
          const firstChild = node.children[0]
          if (firstChild && firstChild.children && firstChild.children.length > 0) {
            return firstChild.children[0]
          }
          // 如果没有孙节点，返回第一个子节点（depth = 1）
          return firstChild
        }
      }
      return null
    }
    const fallbackNode = findFirstChildNode(treeData.value)
    if (fallbackNode) {
      targetKey.value = String(fallbackNode.id)
      alignOption.value = 'center'
      offsetValue.value = 0
      handleScrollToNode()
    }
  }
}

// 滚动到第一个节点
const scrollToFirstNode = () => {
  if (!treeRef.value || treeData.value.length === 0) return
  const firstNode = treeData.value[0]
  if (firstNode) {
    targetKey.value = String(firstNode.id)
    alignOption.value = 'top'
    offsetValue.value = 0
    handleScrollToNode()
  }
}

// 滚动到最后一个节点
const scrollToLastNode = () => {
  if (!treeRef.value || treeData.value.length === 0) return

  // 递归查找最后一个节点
  const findLastNode = (nodes: TreeNodeData[]): TreeNodeData | null => {
    if (nodes.length === 0) return null
    const lastNode = nodes[nodes.length - 1]
    if (lastNode.children && lastNode.children.length > 0) {
      const lastChild = findLastNode(lastNode.children)
      return lastChild || lastNode
    }
    return lastNode
  }

  const lastNode = findLastNode(treeData.value)
  if (lastNode) {
    targetKey.value = String(lastNode.id)
    alignOption.value = 'bottom'
    offsetValue.value = 0
    handleScrollToNode()
  }
}

// 节点点击事件
const handleNodeClick = (data: TreeNodeData) => {
  // 点击节点时，可以自动填充到输入框
  targetKey.value = String(data.id)
}

onMounted(() => {
  generateTestData()
})
</script>

<style scoped>
.demo-section {
  background: white;
  padding: 20px;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.demo-section h2 {
  margin-bottom: 20px;
  color: #606266;
  font-size: 18px;
}

.control-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;
}

.scroll-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.control-label {
  font-size: 14px;
  color: #606266;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input {
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  min-width: 200px;
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: #409eff;
}

.input-number {
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  width: 100px;
  transition: border-color 0.2s;
}

.input-number:focus {
  outline: none;
  border-color: #409eff;
}

.select {
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  min-width: 120px;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;
}

.select:focus {
  outline: none;
  border-color: #409eff;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  background: #409eff;
  color: white;
}

.btn:hover {
  background: #66b1ff;
}

.btn:active {
  background: #3a8ee6;
}

.btn-primary {
  background: #409eff;
  font-weight: 500;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
  background: #909399;
}

.btn-small:hover {
  background: #a6a9ad;
}

.quick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.label {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.info-panel {
  display: flex;
  gap: 24px;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-label {
  font-size: 14px;
  color: #909399;
}

.info-value {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.data-controls {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
}

.data-controls .control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.data-controls .control-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
  color: #606266;
}

.data-controls .input-number {
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  width: 120px;
  height: 36px;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.data-controls .input-number:focus {
  outline: none;
  border-color: #409eff;
}

.data-controls .btn {
  height: 36px;
  padding: 8px 16px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-secondary {
  background: #909399;
}

.btn-secondary:hover {
  background: #a6a9ad;
}

.tree-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tree-shell {
  flex: 1;
  min-height: 0;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
}

.tree-scroll {
  height: 100%;
}
</style>
