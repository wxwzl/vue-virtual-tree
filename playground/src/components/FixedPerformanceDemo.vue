<template>
  <div class="demo-section">
    <h2>100 万节点性能测试（固定高度）</h2>
    <div class="control-panel">
      <span class="node-count-info">总节点数：{{ totalNodeCount.toLocaleString() }}</span>
      <button class="btn" @click="regenerateData">重新生成</button>
      <button class="btn" @click="toggleExpandAll">
        {{ expandAll ? "全部收起" : "全部展开" }}
      </button>
      <RouterLink class="btn btn-link" to="/performance">切换到动态高度版本</RouterLink>
    </div>
    <div class="metrics">
      <span>数据生成：{{ generationTime.toFixed(2) }} ms</span>
      <span>树初始化：{{ initTime.toFixed(2) }} ms</span>
      <span>展开/收起耗时：{{ toggleTime.toFixed(2) }} ms</span>
    </div>
    <p class="tip">
      fixed-height 模式：行高恒定（itemSize=32），超长文本省略号截断； RecycleScroller O(1)
      滚动定位，拖动滚动条快速滚动不白屏。
    </p>
    <div class="tree-container">
      <div class="tree-shell">
        <VirtualTree
          :key="treeKey"
          :data="treeData"
          :loading="isLoading"
          :item-size="32"
          fixed-height
          class="tree-scroll"
          :default-expand-all="expandAll"
          @node-generated="handleGenerated"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { VirtualTree } from "@wxwzl/vue-virtual-tree";
  import { useDemoTree } from "../composables/useDemoTree";
  import { ref, watch } from "vue";

  const expandAll = ref(false);
  const treeKey = ref(0);
  const generationTime = ref(0);
  const initTime = ref(0);
  const toggleTime = ref(0);

  // 1 万个根 × 10 个子 × 10 个孙 = 1,110,000 节点
  // decorator：每 7 个节点给一条超长 label，验证固定高度下的省略截断
  const {
    treeData,
    isLoading,
    totalNodeCount,
    regenerateData: originalRegenerateData,
    handleDataGenerated,
  } = useDemoTree({
    initialCount: 10000,
    generatorOptions: {
      childCount: 10,
      grandChildCount: 10,
      chunkSize: 10000,
      decorator: (node, ctx) => {
        if (ctx.index % 7 === 0) {
          node.label = `${node.label} —— 这是一段超长文本内容，固定高度模式下会被省略号截断而不会撑高行`;
        }
      },
    },
  });

  let genStart = 0;
  let initStart = 0;

  // 数据赋值时刻 = 生成结束 + 树初始化开始
  watch(treeData, () => {
    if (genStart > 0) {
      generationTime.value = performance.now() - genStart;
      genStart = 0;
    }
    initStart = performance.now();
  });

  const handleGenerated = () => {
    if (initStart > 0) {
      initTime.value = performance.now() - initStart;
      initStart = 0;
    }
    handleDataGenerated();
  };

  const regenerateData = async () => {
    genStart = performance.now();
    await originalRegenerateData();
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

  .btn-link {
    text-decoration: none;
    background-color: #67c23a;
  }

  .btn-link:hover {
    background-color: #85ce61;
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
    flex-wrap: wrap;
  }

  .tip {
    font-size: 13px;
    color: #909399;
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
