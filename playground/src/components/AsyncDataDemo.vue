<template>
  <div class="demo-section">
    <h2>异步数据加载测试</h2>
    <div class="info-box">
      <p><strong>说明：</strong>模拟异步加载数据，验证在数据加载后 defaultExpandedKeys 和 defaultCheckedKeys 是否正常工作</p>
    </div>
    <div class="tree-container">
      <div class="tree-shell">
        <VirtualTree :data="asyncTreeData" :loading="isLoading" class="tree-scroll"
        :default-expanded-keys="asyncExpandedKeys" :default-checked-keys="asyncCheckedKeys" show-checkbox
        @node-generated="handleDataGenerated" />
      </div>
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

import { generateTreeDataAsync } from '../utils/treeData'

const asyncTreeData = ref<TreeNodeData[]>([])
const isLoading = ref(false)
const asyncExpandedKeys = ref<(string | number)[]>(['async-1', 'async-1-1'])
const asyncCheckedKeys = ref<(string | number)[]>(['async-1', 'async-2', 'async-1-1'])

const handleDataGenerated = () => {
  isLoading.value = false
}

const loadAsyncData = async () => {
  isLoading.value = true
  asyncTreeData.value = []
  asyncTreeData.value = await generateTreeDataAsync()
  // 不在这里关闭 loading，等待 VirtualTree 的 node-generated 事件
}

onMounted(() => {
  loadAsyncData()
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
  flex: 1;
  display: flex;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  min-height: 0;
}

.tree-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tree-scroll {
  flex: 1;
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
</style>

