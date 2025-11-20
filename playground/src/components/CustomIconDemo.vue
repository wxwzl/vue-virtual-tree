<template>
  <div class="demo-section">
    <h2>自定义节点图标</h2>
    <div class="info-box">
      <p><strong>说明：</strong>使用icon插槽自定义每个节点的图标显示</p>
      <ul>
        <li>根据节点类型显示不同的图标</li>
        <li>支持展开状态的图标变化</li>
        <li>插槽接收node和data参数，可以根据节点信息定制图标</li>
      </ul>
    </div>
    <div class="control-panel">
      <label class="control-label">
        节点数量：
        <input type="number" min="1000" step="1000" v-model.number="nodeCount" @change="handleCountChange" />
      </label>
      <button class="btn" @click="regenerateData">重新生成</button>
      <button @click="resetIconData" class="btn btn-secondary">重置图标数据</button>
    </div>
    <div class="tree-container">
      <VirtualTree :data="iconTreeData" :height="400">
        <template #icon="{ node, data }">
          <div class="custom-icon">
            <span v-if="node.isExpanded">📂</span>
            <span v-else-if="data.type === 'folder'">📁</span>
            <span v-else-if="data.type === 'image'">🖼️</span>
            <span v-else-if="data.type === 'video'">🎥</span>
            <span v-else-if (data.type === 'audio')>🎵</span>
            <span v-else-if="data.type === 'document'">📄</span>
            <span v-else>📄</span>
          </div>
        </template>
      </VirtualTree>
    </div>
  </div>
</template>

<script setup lang="ts">
import { VirtualTree } from '@wxwzl/vue-virtual-tree'
import { useDemoTree } from '../composables/useDemoTree'

const typePool = ['folder', 'image', 'video', 'audio', 'document']

const { treeData: iconTreeData, isLoading, nodeCount, regenerateData, handleCountChange } = useDemoTree({
  initialCount: 5000,
  generatorOptions: {
    decorator: (node, { level, index }) => {
      if (level === 0) {
        node.type = 'folder'
      } else if (level === 1) {
        node.type = index % 2 === 0 ? 'folder' : 'image'
      } else {
        node.type = typePool[(index - 1) % typePool.length] || 'document'
      }
      node.isLeaf = level > 1
    }
  }
})

const resetIconData = () => {
  regenerateData()
}
</script>
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

.btn-secondary {
  background-color: #67c23a;
}

.btn-secondary:hover {
  background-color: #85ce61;
}

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

.custom-icon {
  display: inline-flex;
  align-items: center;
  font-size: 16px;
}
</style>

