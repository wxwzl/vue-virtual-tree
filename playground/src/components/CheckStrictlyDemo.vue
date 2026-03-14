<template>
  <div class="demo-section">
    <h2>严格模式复选框</h2>
    <p class="demo-desc">严格模式下，父子节点选中状态不关联，每个节点的选中状态独立控制</p>

    <div class="control-panel">
      <label class="control-label">
        一级节点数量：
        <input type="number" v-model.number="nodeCount" @change="handleCountChange" />
      </label>
      <button class="btn" @click="regenerateData">重新生成</button>
      <span class="node-count-info" v-if="totalNodeCount > 0">
        总节点数：{{ totalNodeCount.toLocaleString() }}
      </span>
    </div>

    <div class="feature-tags">
      <span class="tag">show-checkbox 属性</span>
      <span class="tag">check-strictly 属性</span>
      <span class="tag highlight">父子节点不关联</span>
    </div>

    <div class="status-panel">
      <div class="status-item">
        <span class="status-label">已选中节点数：</span>
        <span class="status-value">{{ checkedKeys.length }}</span>
      </div>
      <div class="status-item" v-if="checkedKeys.length > 0">
        <span class="status-label">选中节点 keys：</span>
        <span class="status-value keys">
          {{ checkedKeys.slice(0, 5).join(", ") }}{{ checkedKeys.length > 5 ? "..." : "" }}
        </span>
      </div>
    </div>

    <div class="tree-container">
      <div class="tree-shell">
        <VirtualTree
          ref="treeRef"
          :data="treeData"
          :loading="isLoading"
          :buffer="500"
          class="tree-scroll"
          show-checkbox
          check-strictly
          @node-check="handleNodeCheck"
          @node-generated="handleDataGenerated"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from "vue";
  import { VirtualTree } from "@wxwzl/vue-virtual-tree";
  import type { TreeNodeData } from "@wxwzl/vue-virtual-tree";
  import { useDemoTree } from "../composables/useDemoTree";

  const treeRef = ref<InstanceType<typeof VirtualTree>>();
  const checkedKeys = ref<string[]>([]);

  const {
    treeData,
    isLoading,
    nodeCount,
    totalNodeCount,
    regenerateData,
    handleCountChange,
    handleDataGenerated,
  } = useDemoTree({
    initialCount: 1000,
  });

  const handleNodeCheck = (data: TreeNodeData, info: any) => {
    console.log("Node checked:", data, info);
    checkedKeys.value = info.checkedKeys || [];
  };
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

  .demo-desc {
    color: #909399;
    font-size: 14px;
    line-height: 1.5;
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

  .feature-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .tag {
    padding: 4px 12px;
    background-color: #f0f9ff;
    color: #409eff;
    border: 1px solid #b3d8ff;
    border-radius: 4px;
    font-size: 13px;
  }

  .tag.highlight {
    background-color: #ecf5ff;
    color: #409eff;
    border-color: #409eff;
    font-weight: 500;
  }

  .status-panel {
    display: flex;
    gap: 24px;
    padding: 12px 16px;
    background-color: #f5f7fa;
    border-radius: 4px;
    flex-wrap: wrap;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-label {
    font-size: 14px;
    color: #606266;
  }

  .status-value {
    font-size: 14px;
    color: #409eff;
    font-weight: 600;
  }

  .status-value.keys {
    color: #67c23a;
    font-family: monospace;
    font-weight: normal;
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
