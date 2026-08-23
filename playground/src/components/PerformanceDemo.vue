<template>
  <div class="demo-section">
    <h2>100 万节点性能测试</h2>
    <div class="control-panel">
      <span class="node-count-info">总节点数：{{ totalNodeCount.toLocaleString() }}</span>
      <button class="btn" @click="regenerateData">重新生成</button>
      <button class="btn" @click="toggleExpandAll">
        {{ expandAll ? "全部收起" : "全部展开" }}
      </button>
    </div>
    <div class="metrics">
      <span>数据生成：{{ generationTime.toFixed(2) }} ms</span>
      <span>展开/收起耗时：{{ toggleTime.toFixed(2) }} ms</span>
    </div>
    <div class="tree-container">
      <div class="tree-shell">
        <VirtualTree
          :key="treeKey"
          :data="treeData"
          :loading="isLoading"
          :buffer="100"
          class="tree-scroll"
          :default-expand-all="expandAll"
          @node-generated="handleDataGenerated"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { VirtualTree } from "@wxwzl/vue-virtual-tree";
  import { useDemoTree } from "../composables/useDemoTree";
  import { ref } from "vue";

  const expandAll = ref(true);
  const treeKey = ref(0);
  const generationTime = ref(0);
  const toggleTime = ref(0);

  const {
    treeData,
    isLoading,
    totalNodeCount,
    regenerateData: originalRegenerateData,
    handleDataGenerated,
  } = useDemoTree({
    initialCount: 100,
    generatorOptions: {
      depth: 3,
      childrenPerNode: 100,
      chunkSize: 10000,
    },
  });

  const regenerateData = async () => {
    const start = performance.now();
    await originalRegenerateData();
    generationTime.value = performance.now() - start;
  };

  const toggleExpandAll = () => {
    const start = performance.now();
    expandAll.value = !expandAll.value;
    treeKey.value++;
    toggleTime.value = performance.now() - start;
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

  .control-panel {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
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
    margin-right: auto;
  }

  .metrics {
    display: flex;
    gap: 16px;
    font-size: 14px;
    color: #606266;
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
