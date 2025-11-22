<template>
  <div class="demo-section">
    <h2>定制复选框样式</h2>
    <div class="info-box">
      <p><strong>说明：</strong>通过 CSS 深度选择器定制复选框的选中和半选中状态样式</p>
      <p>本示例展示了如何自定义复选框的外观，包括选中状态（蓝色圆形）和半选中状态（橙色方形）</p>
    </div>
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
        <VirtualTree :data="treeData" :loading="isLoading" class="tree-scroll custom-checkbox-tree" show-checkbox
          @node-check="handleNodeCheck" @node-generated="handleDataGenerated" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { VirtualTree } from '@wxwzl/vue-virtual-tree'
import type { TreeNodeData } from '@wxwzl/vue-virtual-tree'
import { useDemoTree } from '../composables/useDemoTree'

const { treeData, isLoading, nodeCount, totalNodeCount, regenerateData, handleCountChange, handleDataGenerated } = useDemoTree({
  initialCount: 5000
})

const handleNodeCheck = (data: TreeNodeData, info: any) => {
  console.log('Node checked:', data, info)
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

.info-box p:last-child {
  margin-bottom: 0;
  font-weight: normal;
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

/* 定制复选框样式 */
:deep(.custom-checkbox-tree) {
  /* 隐藏原生复选框 */
  .vue-virtual-tree-node__checkbox input[type='checkbox'] {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    width: 18px;
    height: 18px;
    margin: 0;
    padding: 0;
    border: 2px solid #dcdfe6;
    border-radius: 4px;
    background-color: #fff;
    cursor: pointer;
    position: relative;
    transition: all 0.3s ease;
    outline: none;
  }

  /* 未选中状态 hover */
  .vue-virtual-tree-node__checkbox input[type='checkbox']:hover:not(:disabled) {
    border-color: #409eff;
  }

  /* 选中状态 */
  .vue-virtual-tree-node__checkbox input[type='checkbox']:checked {
    background-color: #409eff;
    border-color: #409eff;
    border-radius: 50%;
  }

  /* 选中状态的勾选标记 */
  .vue-virtual-tree-node__checkbox input[type='checkbox']:checked::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(45deg);
    width: 5px;
    height: 10px;
    border: solid white;
    border-width: 0 2px 2px 0;
    border-radius: 1px;
  }

  /* 半选中状态（indeterminate） */
  .vue-virtual-tree-node__checkbox input[type='checkbox']:indeterminate {
    background-color: #ff9800;
    border-color: #ff9800;
    border-radius: 2px;
  }

  /* 半选中状态的横线标记 */
  .vue-virtual-tree-node__checkbox input[type='checkbox']:indeterminate::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 2px;
    background-color: white;
    border-radius: 1px;
  }

  /* 禁用状态 */
  .vue-virtual-tree-node__checkbox input[type='checkbox']:disabled {
    background-color: #f5f7fa;
    border-color: #e4e7ed;
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* 选中且禁用状态 */
  .vue-virtual-tree-node__checkbox input[type='checkbox']:checked:disabled {
    background-color: #c0c4cc;
    border-color: #c0c4cc;
  }

  /* 半选中且禁用状态 */
  .vue-virtual-tree-node__checkbox input[type='checkbox']:indeterminate:disabled {
    background-color: #e4e7ed;
    border-color: #c0c4cc;
  }

  /* 节点选中状态的背景色 */
  .vue-virtual-tree-node.is-checked .vue-virtual-tree-node__content {
    background-color: #ecf5ff;
  }

  /* 节点选中状态的文字颜色 */
  .vue-virtual-tree-node.is-checked .vue-virtual-tree-node__label {
    color: #409eff;
    font-weight: 500;
  }
}
</style>

