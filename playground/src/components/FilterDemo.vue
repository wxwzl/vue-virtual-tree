<template>
  <div class="demo-section">
    <h2>过滤</h2>
    <div class="control-panel">
      <label class="control-label">
        节点数量：
        <input type="number" min="1000" step="1000" v-model.number="nodeCount" @change="handleNodeCountChange" />
      </label>
      <button class="btn" @click="handleRegenerate">重新生成</button>
    </div>
    <div class="tree-container">
      <div class="tree-shell">
      <input v-model="filterText" placeholder="输入关键字过滤" @input="handleFilter" class="filter-input" />
      <VirtualTree :loading="isLoading || searching" ref="treeRef" :data="treeData" class="tree-scroll" @node-generated="handleDataGenerated" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { VirtualTree } from '@wxwzl/vue-virtual-tree'
import type { VirtualTreeMethods } from '@wxwzl/vue-virtual-tree'
import { useDemoTree } from '../composables/useDemoTree'

const treeRef = ref<VirtualTreeMethods | null>(null)
const filterText = ref('')
const searching = ref(false)
let filterTimer: ReturnType<typeof setTimeout> | null = null
let filterTaskId = 0

const { treeData, isLoading, nodeCount, regenerateData, handleCountChange, handleDataGenerated } = useDemoTree({
  initialCount: 5000
})

const runFilter = async (taskId: number) => {
  if (!treeRef.value) {
    searching.value = false
    return
  }
  try {
    await treeRef.value.filter(filterText.value)
  } finally {
    if (taskId === filterTaskId) {
      searching.value = false
    }
  }
}

const handleFilter = () => {
  if (!treeRef.value) return
  searching.value = true
  if (filterTimer) {
    clearTimeout(filterTimer)
  }
  const taskId = ++filterTaskId
  filterTimer = setTimeout(() => {
    runFilter(taskId)
  }, 250)
}

const reapplyFilter = () => {
  if (!filterText.value) {
    searching.value = false
    return
  }
  const taskId = ++filterTaskId
  searching.value = true
  runFilter(taskId)
}

const handleNodeCountChange = async () => {
  await handleCountChange()
  reapplyFilter()
}

const handleRegenerate = async () => {
  await regenerateData()
  reapplyFilter()
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
  padding: 12px;
  gap: 10px;
}

.tree-scroll {
  flex: 1;
}

.filter-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
}

.filter-input:focus {
  outline: none;
  border-color: #409eff;
}
</style>

