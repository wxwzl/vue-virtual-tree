<template>
  <div class="app">
    <h1>Vue Virtual Tree Playground</h1>
    
    <div class="demo-section">
      <h2>基础用法</h2>
      <div class="tree-container">
        <VirtualTree :data="treeData" :height="400" />
      </div>
    </div>

    <div class="demo-section">
      <h2>带复选框</h2>
      <div class="tree-container">
        <VirtualTree
          :data="treeData"
          :height="400"
          show-checkbox
          @node-check="handleNodeCheck"
        />
      </div>
    </div>

    <div class="demo-section">
      <h2>默认展开所有</h2>
      <div class="tree-container">
        <VirtualTree
          :data="treeData"
          :height="400"
          default-expand-all
        />
      </div>
    </div>

    <div class="demo-section">
      <h2>可拖拽</h2>
      <div class="tree-container">
        <VirtualTree
          :data="treeData"
          :height="400"
          draggable
          @node-drop="handleNodeDrop"
        />
      </div>
    </div>

    <div class="demo-section">
      <h2>过滤</h2>
      <div class="tree-container">
        <input
          v-model="filterText"
          placeholder="输入关键字过滤"
          @input="handleFilter"
          class="filter-input"
        />
        <VirtualTree
          ref="treeRef"
          :data="treeData"
          :height="400"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { VirtualTree } from 'vue-virtual-tree'
import type { TreeNodeData, VirtualTreeMethods } from 'vue-virtual-tree'

const treeRef = ref<VirtualTreeMethods | null>(null)
const filterText = ref('')

// 生成测试数据
const generateTreeData = (): TreeNodeData[] => {
  const data: TreeNodeData[] = []
  for (let i = 1; i <= 5; i++) {
    const node: TreeNodeData = {
      id: `node-${i}`,
      label: `节点 ${i}`
    }
    const children: TreeNodeData[] = []
    for (let j = 1; j <= 5; j++) {
      const child: TreeNodeData = {
        id: `node-${i}-${j}`,
        label: `节点 ${i}-${j}`
      }
      const grandchildren: TreeNodeData[] = []
      for (let k = 1; k <= 5; k++) {
        grandchildren.push({
          id: `node-${i}-${j}-${k}`,
          label: `节点 ${i}-${j}-${k}`
        })
      }
      child.children = grandchildren
      children.push(child)
    }
    node.children = children
    data.push(node)
  }
  return data
}

const treeData = ref<TreeNodeData[]>(generateTreeData())

const handleNodeCheck = (data: TreeNodeData, info: any) => {
  console.log('Node checked:', data, info)
}

const handleNodeDrop = (draggingNode: TreeNodeData, dropNode: TreeNodeData, dropType: string, event: DragEvent) => {
  console.log('Node dropped:', { draggingNode, dropNode, dropType })
}

const handleFilter = () => {
  if (treeRef.value) {
    treeRef.value.filter(filterText.value)
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  padding: 20px;
  background-color: #f5f5f5;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
}

h1 {
  margin-bottom: 30px;
  color: #303133;
}

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

.tree-container {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.filter-input {
  width: 100%;
  padding: 8px 12px;
  margin-bottom: 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
}

.filter-input:focus {
  outline: none;
  border-color: #409eff;
}
</style>

