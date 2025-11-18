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
    <div class="tree-container">
      <VirtualTree :data="iconTreeData" :height="400">
        <template #icon="{ node, data }">
          <div class="custom-icon">
            <span v-if="node.isExpanded">📂</span>
            <span v-else-if="data.type === 'folder'">📁</span>
            <span v-else-if="data.type === 'image'">🖼️</span>
            <span v-else-if="data.type === 'video'">🎥</span>
            <span v-else-if="data.type === 'audio'">🎵</span>
            <span v-else-if="data.type === 'document'">📄</span>
            <span v-else>📄</span>
          </div>
        </template>
      </VirtualTree>
    </div>
    <div class="control-panel">
      <button @click="resetIconData" class="btn">重置图标数据</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { VirtualTree } from '@wxwzl/vue-virtual-tree'
import type { TreeNodeData } from '@wxwzl/vue-virtual-tree'

const iconTreeData = ref<TreeNodeData[]>([
  {
    id: 'folder-1',
    label: '我的文件',
    type: 'folder',
    isLeaf: false,
    children: [
      {
        id: 'folder-1-1',
        label: '图片',
        type: 'folder',
        isLeaf: false,
        children: [
          { id: 'file-1', label: '照片1.jpg', type: 'image', isLeaf: true },
          { id: 'file-2', label: '照片2.png', type: 'image', isLeaf: true },
          { id: 'file-3', label: '壁纸.gif', type: 'image', isLeaf: true }
        ]
      },
      {
        id: 'folder-1-2',
        label: '视频',
        type: 'folder',
        isLeaf: false,
        children: [
          { id: 'file-4', label: '电影.mp4', type: 'video', isLeaf: true },
          { id: 'file-5', label: '短片.avi', type: 'video', isLeaf: true }
        ]
      },
      {
        id: 'folder-1-3',
        label: '音乐',
        type: 'folder',
        isLeaf: false,
        children: [
          { id: 'file-6', label: '歌曲1.mp3', type: 'audio', isLeaf: true },
          { id: 'file-7', label: '歌曲2.flac', type: 'audio', isLeaf: true }
        ]
      }
    ]
  },
  {
    id: 'folder-2',
    label: '文档',
    type: 'folder',
    isLeaf: false,
    children: [
      { id: 'file-8', label: '报告.docx', type: 'document', isLeaf: true },
      { id: 'file-9', label: '表格.xlsx', type: 'document', isLeaf: true },
      { id: 'file-10', label: '演示.pptx', type: 'document', isLeaf: true }
    ]
  },
  {
    id: 'file-11',
    label: 'README.md',
    type: 'document',
    isLeaf: true
  }
])

const resetIconData = () => {
  iconTreeData.value = [...iconTreeData.value]
}
</script>

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

