<template>
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
      <VirtualTree v-if="!isLoading" :data="treeData" :height="400"
        :default-expanded-keys="defaultExpandedKeys" :default-checked-keys="defaultCheckedKeys" show-checkbox
        @node-check="handleNodeCheck" />
      <div v-else class="loading">数据加载中...</div>
    </div>
    <div class="control-panel">
      <button @click="resetExpandedKeys" class="btn">重置展开状态</button>
      <button @click="resetCheckedKeys" class="btn">重置选中状态</button>
      <button @click="updateExpandedKeys" class="btn">更新展开节点</button>
      <button @click="updateCheckedKeys" class="btn">更新选中节点</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { VirtualTree } from '@wxwzl/vue-virtual-tree'
import type { TreeNodeData } from '@wxwzl/vue-virtual-tree'

const treeData = ref<TreeNodeData[]>([])
const isLoading = ref(true)
const defaultExpandedKeys = ref<(string | number)[]>([
  'node-1',
  'node-2',
  'node-1-1',
  'node-2-1'
])
const defaultCheckedKeys = ref<(string | number)[]>([
  'node-1',
  'node-1-1',
  'node-2-2',
  'node-3'
])

const generateTreeDataAsync = (number: number): Promise<TreeNodeData[]> => {
  return new Promise((resolve) => {
    const data: TreeNodeData[] = []
    let currentIndex = 1
    const chunkSize = 50

    const generateChunk = () => {
      const endIndex = Math.min(currentIndex + chunkSize, number + 1)

      for (let i = currentIndex; i < endIndex; i++) {
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

      currentIndex = endIndex

      if (currentIndex <= number) {
        requestAnimationFrame(generateChunk)
      } else {
        resolve(data)
      }
    }

    requestAnimationFrame(generateChunk)
  })
}

const handleNodeCheck = (data: TreeNodeData, info: any) => {
  console.log('Node checked:', data, info)
}

const resetExpandedKeys = () => {
  defaultExpandedKeys.value = []
}

const resetCheckedKeys = () => {
  defaultCheckedKeys.value = []
}

const updateExpandedKeys = () => {
  defaultExpandedKeys.value = ['node-1', 'node-3', 'node-1-2']
}

const updateCheckedKeys = () => {
  defaultCheckedKeys.value = ['node-1', 'node-2', 'node-3', 'node-1-1', 'node-1-2']
}

onMounted(async () => {
  const data = await generateTreeDataAsync(1000)
  treeData.value = data
  isLoading.value = false
})
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

.loading {
  padding: 40px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}
</style>

