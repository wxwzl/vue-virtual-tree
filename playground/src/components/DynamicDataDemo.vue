<template>
  <div class="demo-section">
    <h2>动态数据操作（replace / append / remove）</h2>

    <div class="control-panel">
      <input v-model="nodeLabel" class="input" placeholder="节点 label（如：新节点）" />
      <input v-model="targetKey" class="input" placeholder="目标位置 key，点击树节点可回填" />
    </div>

    <div class="control-panel">
      <button class="btn" :disabled="!nodeLabel" @click="handleAppend">追加为目标子节点</button>
      <button class="btn" :disabled="!nodeLabel || !targetKey" @click="handleInsertBefore">
        插入到目标前
      </button>
      <button class="btn" :disabled="!nodeLabel || !targetKey" @click="handleInsertAfter">
        插入到目标后
      </button>
      <button class="btn btn-danger" :disabled="!targetKey" @click="handleRemove">
        删除目标节点
      </button>
      <button class="btn" :disabled="!nodeLabel || !targetKey" @click="handleReplace">
        替换目标节点
      </button>
      <button class="btn btn-plain" @click="handleReset">重置数据</button>
    </div>

    <div class="metrics">
      <span>总节点数：{{ totalNodeCount.toLocaleString() }}</span>
      <span>最近操作耗时：{{ lastOpTime.toFixed(2) }} ms</span>
      <span v-if="message" class="message" :class="{ 'is-error': isError }">
        {{ message }}
      </span>
    </div>

    <p class="tip">
      提示：点击树节点可回填目标 key。「替换目标节点」用新节点替换目标（不含
      children，原子树保留）；替换后原节点的展开/勾选状态会迁移到新节点。
    </p>

    <div class="tree-container">
      <div class="tree-shell">
        <VirtualTree
          ref="treeRef"
          :data="treeData"
          :loading="isLoading"
          show-checkbox
          :buffer="50"
          class="tree-scroll"
          :default-expanded-keys="['node-1']"
          @node-click="handleNodeClick"
          @node-generated="handleDataGenerated"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { VirtualTree } from "@wxwzl/vue-virtual-tree";
  import type { TreeNodeData, VirtualTreeMethods } from "@wxwzl/vue-virtual-tree";
  import { useDemoTree } from "../composables/useDemoTree";
  import { ref } from "vue";

  const treeRef = ref<VirtualTreeMethods | null>(null);
  const nodeLabel = ref("");
  const targetKey = ref("");
  const lastOpTime = ref(0);
  const message = ref("");
  const isError = ref(false);
  let newNodeSeq = 1;

  // 100 根 × 5 子 × 5 孙 = 3,100 节点，便于观察操作效果
  const {
    treeData,
    isLoading,
    totalNodeCount,
    regenerateData: originalRegenerateData,
    handleDataGenerated,
  } = useDemoTree({
    initialCount: 100,
    generatorOptions: { childCount: 5, grandChildCount: 5, chunkSize: 100 },
  });

  const showMessage = (text: string, error = false) => {
    message.value = text;
    isError.value = error;
  };

  const timed = (fn: () => void) => {
    const start = performance.now();
    fn();
    lastOpTime.value = performance.now() - start;
  };

  const ensureTargetExists = (): boolean => {
    if (!targetKey.value) {
      showMessage("请填写目标位置 key（可点击树节点回填）", true);
      return false;
    }
    if (!treeRef.value?.getNode(targetKey.value)) {
      showMessage(`目标节点 "${targetKey.value}" 不存在`, true);
      return false;
    }
    return true;
  };

  const makeNode = (): TreeNodeData => ({
    id: `new-${newNodeSeq++}`,
    label: nodeLabel.value,
  });

  const handleAppend = () => {
    timed(() => {
      // 不填目标时追加到根层级
      treeRef.value?.append(makeNode(), targetKey.value || undefined);
    });
    showMessage(targetKey.value ? `已追加为 "${targetKey.value}" 的子节点` : "已追加到根层级");
    nodeLabel.value = "";
  };

  const handleInsertBefore = () => {
    if (!ensureTargetExists()) {
      return;
    }
    timed(() => treeRef.value?.insertBefore(makeNode(), targetKey.value));
    showMessage(`已插入到 "${targetKey.value}" 之前`);
    nodeLabel.value = "";
  };

  const handleInsertAfter = () => {
    if (!ensureTargetExists()) {
      return;
    }
    timed(() => treeRef.value?.insertAfter(makeNode(), targetKey.value));
    showMessage(`已插入到 "${targetKey.value}" 之后`);
    nodeLabel.value = "";
  };

  const handleRemove = () => {
    if (!ensureTargetExists()) {
      return;
    }
    const key = targetKey.value;
    timed(() => treeRef.value?.remove(key));
    totalNodeCount.value = Math.max(0, totalNodeCount.value - 1);
    showMessage(`已删除节点 "${key}" 及其子树`);
    targetKey.value = "";
  };

  // 节点级替换：用输入的新节点替换目标节点（不含 children，原子树保留）
  const handleReplace = () => {
    if (!ensureTargetExists()) {
      return;
    }
    const key = targetKey.value;
    const newNode = makeNode();
    timed(() => treeRef.value?.replace(newNode, key));
    showMessage(`已将 "${key}" 替换为 "${newNode.id}（${newNode.label}）"，原子树与状态已保留`);
    nodeLabel.value = "";
    targetKey.value = "";
  };

  const handleReset = async () => {
    const start = performance.now();
    await originalRegenerateData();
    lastOpTime.value = performance.now() - start;
    showMessage("数据已重置");
  };

  const handleNodeClick = (data: TreeNodeData) => {
    targetKey.value = String(data.id ?? "");
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

  .input {
    padding: 6px 10px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    font-size: 14px;
    width: 260px;
    outline: none;
  }

  .input:focus {
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

  .btn:hover:not(:disabled) {
    background-color: #66b1ff;
  }

  .btn:disabled {
    background-color: #a0cfff;
    cursor: not-allowed;
  }

  .btn-danger {
    background-color: #f56c6c;
  }

  .btn-danger:hover:not(:disabled) {
    background-color: #f78989;
  }

  .btn-plain {
    background-color: #909399;
  }

  .btn-plain:hover:not(:disabled) {
    background-color: #a6a9ad;
  }

  .metrics {
    display: flex;
    gap: 16px;
    font-size: 14px;
    color: #606266;
    flex-wrap: wrap;
    align-items: center;
  }

  .message {
    color: #67c23a;
  }

  .message.is-error {
    color: #f56c6c;
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
