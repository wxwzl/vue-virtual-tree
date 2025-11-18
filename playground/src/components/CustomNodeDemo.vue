<template>
  <div class="demo-section">
    <h2>使用插槽自定义节点</h2>
    <div class="info-box">
      <p><strong>说明：</strong>使用插槽自定义节点渲染，展示节点ID和标签，并添加简单的图标</p>
    </div>
    <div class="tree-container">
      <VirtualTree v-if="!isLoading" :data="treeData" :height="400">
        <template #default="{ node, data }">
          <div class="custom-node">
            <span class="node-icon">{{ node.level === 0 ? '🏠' : node.level === 1 ? '📁' : '📄' }}</span>
            <span class="node-id">[{{ data.id }}]</span>
            <span class="node-label">{{ data.label }}</span>
            <span class="node-status" v-if="data.children && data.children.length > 0">
              ({{ data.children.length }} 子项)
            </span>
          </div>
        </template>
      </VirtualTree>
      <div v-else class="loading">数据加载中...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { VirtualTree } from '@wxwzl/vue-virtual-tree'
import type { TreeNodeData } from '@wxwzl/vue-virtual-tree'

const treeData = ref<TreeNodeData[]>([])
const isLoading = ref(true)

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

.tree-container {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.loading {
  padding: 40px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

.custom-node {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.node-icon {
  font-size: 16px;
}

.node-id {
  color: #909399;
  font-size: 12px;
  font-weight: 500;
}

.node-label {
  flex: 1;
  color: #303133;
}

.node-status {
  color: #606266;
  font-size: 12px;
  font-style: italic;
}
</style>

