<template>
  <div class="demo-section">
    <h2>异步数据加载测试</h2>
    <div class="info-box">
      <p><strong>说明：</strong>模拟异步加载数据，验证在数据加载后 defaultExpandedKeys 和 defaultCheckedKeys 是否正常工作</p>
    </div>
    <div class="tree-container">
      <VirtualTree v-if="asyncTreeData.length > 0" :data="asyncTreeData" :height="400"
        :default-expanded-keys="asyncExpandedKeys" :default-checked-keys="asyncCheckedKeys" show-checkbox />
      <div v-else class="loading">加载中...</div>
    </div>
    <div class="control-panel">
      <button @click="loadAsyncData" class="btn">重新加载数据</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { VirtualTree } from '@wxwzl/vue-virtual-tree'
import type { TreeNodeData } from '@wxwzl/vue-virtual-tree'

const asyncTreeData = ref<TreeNodeData[]>([])
const asyncExpandedKeys = ref<(string | number)[]>(['async-1', 'async-1-1'])
const asyncCheckedKeys = ref<(string | number)[]>(['async-1', 'async-2', 'async-1-1'])

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

const loadAsyncData = () => {
  asyncTreeData.value = []
  setTimeout(() => {
    asyncTreeData.value = generateAsyncData()
  }, 1000)
}

onMounted(() => {
  loadAsyncData()
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

