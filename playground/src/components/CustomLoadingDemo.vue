<template>
  <div class="demo-section">
    <h2>自定义loading效果</h2>
    <div class="info-box">
      <p>
        <strong>说明：</strong>
        使用loading插槽自定义懒加载时的loading显示效果
      </p>
      <ul>
        <li>使用loading插槽可以完全自定义loading的UI</li>
        <li>插槽接收node和data参数，可以根据不同节点显示不同效果</li>
        <li>支持文本、动画、图标等多种自定义loading样式</li>
      </ul>
    </div>
    <div class="tree-container">
      <div class="tree-shell">
        <VirtualTree :data="customLoadingTreeData" class="tree-scroll" lazy :load="handleLazyLoad">
          <template #loading="{ node, data }">
            <div class="custom-loading">
              <div class="loading-spinner"></div>
              <span class="loading-text">正在加载 {{ data.label }}...</span>
            </div>
          </template>
        </VirtualTree>
      </div>
    </div>
    <div class="control-panel">
      <button @click="resetCustomLoadingData" class="btn">重置自定义loading数据</button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from "vue";
  import { VirtualTree } from "@wxwzl/vue-virtual-tree";
  import type { TreeNodeData } from "@wxwzl/vue-virtual-tree";

  const customLoadingTreeData = ref<TreeNodeData[]>([
    {
      id: "custom-1",
      label: "文件夹 A",
      isLeaf: false,
    },
    {
      id: "custom-2",
      label: "文件夹 B",
      isLeaf: false,
    },
    {
      id: "custom-3",
      label: "文件夹 C",
      isLeaf: false,
    },
  ]);

  const handleLazyLoad = (node: TreeNodeData, resolve: (data: TreeNodeData[]) => void) => {
    setTimeout(
      () => {
        const children: TreeNodeData[] = [
          { id: `${node.id}-1`, label: `${node.label} 子项 1`, isLeaf: true },
          { id: `${node.id}-2`, label: `${node.label} 子项 2`, isLeaf: true },
          { id: `${node.id}-3`, label: `${node.label} 子项 3`, isLeaf: true },
        ];
        resolve(children);
      },
      Math.random() * 1000 + 500
    );
  };

  const resetCustomLoadingData = () => {
    customLoadingTreeData.value = [
      {
        id: "custom-1",
        label: "文件夹 A",
        isLeaf: false,
      },
      {
        id: "custom-2",
        label: "文件夹 B",
        isLeaf: false,
      },
      {
        id: "custom-3",
        label: "文件夹 C",
        isLeaf: false,
      },
    ];
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

  .custom-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }

  .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #e4e7ed;
    border-top-color: #409eff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading-text {
    font-size: 12px;
    color: #909399;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
