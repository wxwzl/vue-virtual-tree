<template>
  <div class="demo-section">
    <h2>自定义树加载状态</h2>
    <div class="info-box">
      <p><strong>说明：</strong>使用 tree-loading 插槽自定义整个树的加载状态显示</p>
      <ul>
        <li>当 loading prop 为 true 时，显示自定义的加载状态</li>
        <li>可以通过 tree-loading 插槽完全自定义加载 UI</li>
        <li>支持文本、动画、图标等多种自定义 loading 样式</li>
      </ul>
    </div>
    <div class="control-panel">
      <button @click="toggleLoading" class="btn">{{ isLoading ? '停止加载' : '开始加载' }}</button>
      <button @click="loadData" class="btn btn-secondary">模拟加载数据</button>
      <span class="node-count-info" v-if="totalNodeCount > 0">总节点数：{{ totalNodeCount.toLocaleString() }}</span>
    </div>
    <div class="tree-container">
      <div class="tree-shell">
        <VirtualTree :data="treeData" :loading="isLoading" class="tree-scroll" @node-generated="handleDataGenerated">
          <template #tree-loading>
            <div class="custom-tree-loading">
              <div class="loading-spinner">
                <div class="spinner-dot"></div>
                <div class="spinner-dot"></div>
                <div class="spinner-dot"></div>
              </div>
              <p class="loading-text">正在加载树形数据...</p>
              <p class="loading-subtitle">请稍候</p>
            </div>
          </template>
        </VirtualTree>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { VirtualTree } from '@wxwzl/vue-virtual-tree'
import { useDemoTree } from '../composables/useDemoTree'

const { treeData, regenerateData, isLoading, totalNodeCount, handleDataGenerated } = useDemoTree({
  initialCount: 5000
})

const toggleLoading = () => {
  isLoading.value = !isLoading.value
  if (!isLoading.value) {
    // 如果手动关闭 loading，也需要通知 VirtualTree
    handleDataGenerated()
  }
}

const loadData = async () => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 2000))
  await regenerateData()
  // 不在这里关闭 loading，等待 VirtualTree 的 node-generated 事件
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
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
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

.btn-secondary {
  background-color: #67c23a;
}

.btn-secondary:hover {
  background-color: #85ce61;
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

.custom-tree-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.loading-spinner {
  display: flex;
  gap: 8px;
  align-items: center;
}

.spinner-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #409eff;
  animation: loading-bounce 1.4s ease-in-out infinite both;
}

.spinner-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.spinner-dot:nth-child(2) {
  animation-delay: -0.16s;
}

.loading-text {
  font-size: 16px;
  color: #606266;
  font-weight: 500;
  margin: 0;
}

.loading-subtitle {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

@keyframes loading-bounce {

  0%,
  80%,
  100% {
    transform: scale(0);
    opacity: 0.5;
  }

  40% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
