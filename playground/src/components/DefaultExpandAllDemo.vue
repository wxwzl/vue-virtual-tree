<template>
  <div class="demo-section">
    <h2>默认展开所有</h2>
    <div class="control-panel">
      <label class="control-label">
        节点数量：
        <input type="number" min="1000" step="1000" v-model.number="nodeCount" @change="handleCountChange" />
      </label>
      <button class="btn" @click="regenerateData">重新生成</button>
      <span class="node-count-info" v-if="totalNodeCount > 0">总节点数：{{ totalNodeCount.toLocaleString() }}</span>
    </div>
    <div class="tree-container">
      <div class="tree-shell">
        <VirtualTree :data="treeData" :loading="isLoading" class="tree-scroll" :default-expand-all="expandAll"
          @node-generated="handleDataGenerated" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { VirtualTree } from '@wxwzl/vue-virtual-tree'
import { useDemoTree } from '../composables/useDemoTree'
import { ref } from 'vue'

const expandAll = ref(false)
const { treeData, isLoading, nodeCount, totalNodeCount, regenerateData, handleCountChange, handleDataGenerated } = useDemoTree({
  initialCount: 5000,
  dataLoaded: (data) => {
    expandAll.value = true
  }
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
  color: #606266;
  font-size: 18px;
}

.control-panel {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
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

.btn {
  padding: 6px 14px;
  background-color: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn:hover {
  background-color: #66b1ff;
}

.node-count-info {
  font-size: 14px;
  color: #909399;
  margin-left: auto;
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
</style>
