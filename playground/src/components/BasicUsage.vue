<template>
  <div class="demo-section">
    <h2>基础用法</h2>
    <div class="tree-container">
      <VirtualTree v-if="!isLoading" :data="treeData" :height="400" />
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

// 生成测试数据 - 异步分片生成，避免阻塞主线程
const generateTreeDataAsync = (number: number): Promise<TreeNodeData[]> => {
  return new Promise((resolve) => {
    const data: TreeNodeData[] = []
    let currentIndex = 1
    const chunkSize = 50 // 每次生成50个根节点

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
  const data = await generateTreeDataAsync(10000)
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
</style>

