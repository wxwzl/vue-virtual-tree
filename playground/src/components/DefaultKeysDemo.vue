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
    <div class="control-panel control-panel--spacing">
      <label class="control-label">
        节点数量：
        <input type="number" min="1000" step="1000" v-model.number="nodeCount" @change="handleCountChange" />
      </label>
      <button class="btn" @click="regenerateData">重新生成</button>
    </div>
    <div class="tree-container">
      <div class="tree-shell">
        <VirtualTree v-if="!isLoading" :data="treeData" class="tree-scroll"
        :default-expanded-keys="defaultExpandedKeys" :default-checked-keys="defaultCheckedKeys" show-checkbox
        @node-check="handleNodeCheck" />
      <div v-else class="loading">数据加载中...</div>
      </div>
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
import { ref } from 'vue'
import { VirtualTree } from '@wxwzl/vue-virtual-tree'
import type { TreeNodeData } from '@wxwzl/vue-virtual-tree'
import { useDemoTree } from '../composables/useDemoTree'

const { treeData, isLoading, nodeCount, regenerateData, handleCountChange } = useDemoTree({
  initialCount: 5000
})
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
  align-items: center;
}

.control-panel--spacing {
  margin-top: 0;
  margin-bottom: 16px;
}

.control-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
}

.control-label input {
  width: 140px;
  padding: 6px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.control-label input:focus {
  border-color: #409eff;
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
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
}
</style>

