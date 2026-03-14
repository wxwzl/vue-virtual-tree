<template>
  <div class="demo-section">
    <h2>手风琴模式</h2>
    <p class="demo-desc">
      手风琴模式下，同级节点只能同时展开一个，展开新节点会自动折叠其他同级节点
    </p>
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
      <span class="tag">accordion 属性</span>
      <span class="tag highlight">同级节点互斥展开</span>
    </div>
    <div class="tree-container">
      <div class="tree-shell">
        <VirtualTree
          :data="treeData"
          :loading="isLoading"
          :buffer="500"
          class="tree-scroll"
          :accordion="true"
          @node-expand="handleNodeExpand"
          @node-collapse="handleNodeCollapse"
          @node-generated="handleDataGenerated"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { VirtualTree } from "@wxwzl/vue-virtual-tree";
  import type { TreeNodeData } from "@wxwzl/vue-virtual-tree";
  import { useDemoTree } from "../composables/useDemoTree";

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

  const handleNodeExpand = (data: TreeNodeData) => {
    console.log("节点展开:", data);
  };

  const handleNodeCollapse = (data: TreeNodeData) => {
    console.log("节点折叠:", data);
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
