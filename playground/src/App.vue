<template>
  <div class="app">
    <h1>Vue Virtual Tree Playground</h1>

    <div class="demo-section">
      <h2>基础用法</h2>
      <div class="tree-container">
        <VirtualTree v-if="!isLoadingTreeData1" :data="treeData1" :height="400" />
        <div v-else class="loading">数据加载中...</div>
      </div>
    </div>

    <div class="demo-section">
      <h2>带复选框</h2>
      <div class="tree-container">
        <VirtualTree v-if="!isLoadingTreeData" :data="treeData" :height="400" show-checkbox
          @node-check="handleNodeCheck" />
        <div v-else class="loading">数据加载中...</div>
      </div>
    </div>

    <div class="demo-section">
      <h2>默认展开所有</h2>
      <div class="tree-container">
        <VirtualTree v-if="!isLoadingTreeData" :data="treeData" :height="400" default-expand-all />
        <div v-else class="loading">数据加载中...</div>
      </div>
    </div>

    <div class="demo-section">
      <h2>可拖拽</h2>
      <div class="info-box">
        <p><strong>说明：</strong>拖拽节点可以重新排序，支持拖拽到节点前、节点内、节点后三种位置</p>
      </div>
      <div class="tree-container">
        <VirtualTree :data="dragTreeData" :height="400" draggable @node-drag-start="handleDragStart"
          @node-drag-enter="handleDragEnter" @node-drag-leave="handleDragLeave" @node-drag-over="handleDragOver"
          @node-drag-end="handleDragEnd" @node-drop="handleNodeDrop" />
      </div>
      <div class="control-panel">
        <button @click="resetDragTreeData" class="btn">重置拖拽数据</button>
      </div>
      <div class="drag-log" v-if="dragLogs.length > 0">
        <h3>拖拽日志：</h3>
        <div class="log-item" v-for="(log, index) in dragLogs" :key="index">
          {{ log }}
        </div>
        <button @click="clearDragLogs" class="btn btn-small">清空日志</button>
      </div>
    </div>

    <div class="demo-section">
      <h2>过滤</h2>
      <div class="tree-container">
        <input v-model="filterText" placeholder="输入关键字过滤" @input="handleFilter" class="filter-input" />
        <VirtualTree v-show="!isLoadingTreeData && !searching" ref="treeRef" :data="treeData" :height="400" />
        <div v-show="isLoadingTreeData || searching" class="loading">数据加载中...</div>
      </div>
    </div>

    <div class="demo-section">
      <h2>默认展开和选中（defaultExpandedKeys & defaultCheckedKeys）</h2>
      <div class="info-box">
        <p><strong>说明：</strong></p>
        <ul>
          <li>默认展开：node-1, node-2, node-1-1, node-2-1</li>
          <li>默认选中：node-1, node-1-1, node-2-2, node-3</li>
          <li>验证：展开的节点应该显示，选中的节点应该有复选框标记</li>
        </ul>
      </div>
      <div class="tree-container">
        <VirtualTree v-if="!isLoadingTreeData" :data="treeData" :height="400"
          :default-expanded-keys="defaultExpandedKeys" :default-checked-keys="defaultCheckedKeys" show-checkbox
          @node-check="handleNodeCheck" />
        <div v-else class="loading">数据加载中...</div>
      </div>
      <div class="control-panel">
        <button @click="resetExpandedKeys" class="btn">重置展开状态</button>
        <button @click="resetCheckedKeys" class="btn">重置选中状态</button>
        <button @click="updateExpandedKeys" class="btn">更新展开节点</button>
        <button @click="updateCheckedKeys" class="btn">更新选中节点</button>
      </div>
    </div>

    <div class="demo-section">
      <h2>使用插槽自定义节点</h2>
      <div class="info-box">
        <p><strong>说明：</strong>使用插槽自定义节点渲染，展示节点ID和标签，并添加简单的图标</p>
      </div>
      <div class="tree-container">
        <VirtualTree v-if="!isLoadingTreeData" :data="treeData" :height="400">
          <template #default="{ node, data }">
            <div class="custom-node">
              <span class="node-icon">{{ node.level === 0 ? '🏠' : node.level === 1 ? '📁' : '📄' }}</span>
              <span class="node-id">[{{ data.id }}]</span>
              <span class="node-label">{{ data.label }}</span>
              <span class="node-status" v-if="data.children && data.children.length > 0">
                ({{ data.children.length }} 子项)
              </span>
            </div>
          </template>
        </VirtualTree>
        <div v-else class="loading">数据加载中...</div>
      </div>
    </div>

    <div class="demo-section">
      <h2>异步数据加载测试</h2>
      <div class="info-box">
        <p><strong>说明：</strong>模拟异步加载数据，验证在数据加载后 defaultExpandedKeys 和 defaultCheckedKeys 是否正常工作</p>
      </div>
      <div class="tree-container">
        <VirtualTree v-if="asyncTreeData.length > 0" :data="asyncTreeData" :height="400"
          :default-expanded-keys="asyncExpandedKeys" :default-checked-keys="asyncCheckedKeys" show-checkbox />
        <div v-else class="loading">加载中...</div>
      </div>
      <div class="control-panel">
        <button @click="loadAsyncData" class="btn">重新加载数据</button>
      </div>
    </div>

    <div class="demo-section">
      <h2>子节点懒加载</h2>
      <div class="info-box">
        <p><strong>说明：</strong>演示懒加载功能，点击展开图标时异步加载子节点</p>
        <ul>
          <li>根节点预设为可展开状态，但没有预加载子节点</li>
          <li>点击展开时触发load回调函数异步获取子节点</li>
          <li>支持加载状态显示和错误处理</li>
        </ul>
      </div>
      <div class="tree-container">
        <VirtualTree :data="lazyTreeData" :height="400" lazy :load="handleLazyLoad" />
      </div>
      <div class="control-panel">
        <button @click="resetLazyData" class="btn">重置懒加载数据</button>
      </div>
      <div class="lazy-log" v-if="lazyLogs.length > 0">
        <h3>懒加载日志：</h3>
        <div class="log-item" v-for="(log, index) in lazyLogs" :key="index">
          {{ log }}
        </div>
        <button @click="clearLazyLogs" class="btn btn-small">清空日志</button>
      </div>
    </div>

    <div class="demo-section">
      <h2>自定义loading效果</h2>
      <div class="info-box">
        <p><strong>说明：</strong>使用loading插槽自定义懒加载时的loading显示效果</p>
        <ul>
          <li>使用loading插槽可以完全自定义loading的UI</li>
          <li>插槽接收node和data参数，可以根据不同节点显示不同效果</li>
          <li>支持文本、动画、图标等多种自定义loading样式</li>
        </ul>
      </div>
      <div class="tree-container">
        <VirtualTree :data="customLoadingTreeData" :height="400" lazy :load="handleLazyLoad">
          <template #loading="{ node, data }">
            <div class="custom-loading">
              <div class="loading-spinner"></div>
              <span class="loading-text">正在加载 {{ data.label }}...</span>
            </div>
          </template>
        </VirtualTree>
      </div>
      <div class="control-panel">
        <button @click="resetCustomLoadingData" class="btn">重置自定义loading数据</button>
      </div>
    </div>

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
              <!-- 根据节点类型和展开状态显示不同图标 -->
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { VirtualTree } from 'vue-virtual-tree'
import type { TreeNodeData, VirtualTreeMethods } from 'vue-virtual-tree'

const treeRef = ref<VirtualTreeMethods | null>(null)
const filterText = ref('')

// 生成测试数据 - 异步分片生成，避免阻塞主线程
const generateTreeDataAsync = (number: number): Promise<TreeNodeData[]> => {
  return new Promise((resolve) => {
    const data: TreeNodeData[] = []
    let currentIndex = 1
    const chunkSize = 50 // 每次生成50个根节点

    const generateChunk = () => {
      const endIndex = Math.min(currentIndex + chunkSize, number + 1)

      for (let i = currentIndex; i < endIndex; i++) {
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

      currentIndex = endIndex

      if (currentIndex <= number) {
        // 还有更多数据，使用requestAnimationFrame在下一帧继续生成
        requestAnimationFrame(generateChunk)
      } else {
        // 生成完成
        resolve(data)
      }
    }

    // 开始生成
    requestAnimationFrame(generateChunk)
  })
}

// 数据状态管理
const treeData1 = ref<TreeNodeData[]>([])
const treeData = ref<TreeNodeData[]>([])
const isLoadingTreeData1 = ref(true)
const isLoadingTreeData = ref(true)

// 异步初始化数据
const initData = async () => {
  // 并行生成两个数据集
  const [data1, data] = await Promise.all([
    generateTreeDataAsync(10000),
    generateTreeDataAsync(1000)
  ])

  treeData1.value = data1
  treeData.value = data
  isLoadingTreeData1.value = false
  isLoadingTreeData.value = false
}

// 拖拽示例专用数据
const generateDraggableTreeData = (): TreeNodeData[] => [
  {
    id: 'drag-1',
    label: '拖拽节点 1',
    children: [
      { id: 'drag-1-1', label: '拖拽节点 1-1' },
      { id: 'drag-1-2', label: '拖拽节点 1-2' }
    ]
  },
  {
    id: 'drag-2',
    label: '拖拽节点 2',
    children: [
      {
        id: 'drag-2-1',
        label: '拖拽节点 2-1',
        children: [
          { id: 'drag-2-1-1', label: '拖拽节点 2-1-1' },
          { id: 'drag-2-1-2', label: '拖拽节点 2-1-2' }
        ]
      },
      { id: 'drag-2-2', label: '拖拽节点 2-2' }
    ]
  },
  {
    id: 'drag-3',
    label: '拖拽节点 3'
  }
]

const dragTreeData = ref<TreeNodeData[]>(generateDraggableTreeData())

// 默认展开的节点
const defaultExpandedKeys = ref<(string | number)[]>([
  'node-1',
  'node-2',
  'node-1-1',
  'node-2-1'
])

// 默认选中的节点
const defaultCheckedKeys = ref<(string | number)[]>([
  'node-1',
  'node-1-1',
  'node-2-2',
  'node-3'
])

// 异步数据相关
const asyncTreeData = ref<TreeNodeData[]>([])
const asyncExpandedKeys = ref<(string | number)[]>(['async-1', 'async-1-1'])
const asyncCheckedKeys = ref<(string | number)[]>(['async-1', 'async-2', 'async-1-1'])

// 生成异步测试数据
const generateAsyncData = (): TreeNodeData[] => {
  return [
    {
      id: 'async-1',
      label: '异步节点 1',
      children: [
        {
          id: 'async-1-1',
          label: '异步节点 1-1',
          children: [
            { id: 'async-1-1-1', label: '异步节点 1-1-1' },
            { id: 'async-1-1-2', label: '异步节点 1-1-2' }
          ]
        },
        { id: 'async-1-2', label: '异步节点 1-2' }
      ]
    },
    {
      id: 'async-2',
      label: '异步节点 2',
      children: [
        { id: 'async-2-1', label: '异步节点 2-1' },
        { id: 'async-2-2', label: '异步节点 2-2' }
      ]
    },
    {
      id: 'async-3',
      label: '异步节点 3'
    }
  ]
}

// 加载异步数据
const loadAsyncData = () => {
  asyncTreeData.value = []
  setTimeout(() => {
    asyncTreeData.value = generateAsyncData()
  }, 1000)
}

// 懒加载相关数据
const lazyTreeData = ref<TreeNodeData[]>([
  {
    id: 'lazy-1',
    label: '懒加载节点 1',
    isLeaf: false, // 明确设置为false，表示可以展开
    // 注意：这里不设置children，表示该节点有子节点但未加载
  },
  {
    id: 'lazy-2',
    label: '懒加载节点 2',
    isLeaf: false,
  },
  {
    id: 'lazy-3',
    label: '懒加载节点 3',
    isLeaf: false,
  },
  {
    id: 'lazy-4',
    label: '懒加载节点 4',
    isLeaf: false,
  }
])

// 懒加载日志
const lazyLogs = ref<string[]>([])

const addLazyLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString()
  lazyLogs.value.unshift(`[${timestamp}] ${message}`)
  // 最多保留20条日志
  if (lazyLogs.value.length > 20) {
    lazyLogs.value = lazyLogs.value.slice(0, 20)
  }
}

const clearLazyLogs = () => {
  lazyLogs.value = []
}

// 模拟懒加载函数
const handleLazyLoad = (node: TreeNodeData, resolve: (data: TreeNodeData[]) => void) => {
  addLazyLog(`开始加载节点: ${node.label || node.id}`)

  // 模拟网络延迟
  setTimeout(() => {
    // 模拟不同的加载结果
    const nodeId = node.id as string
    let children: TreeNodeData[] = []

    if (nodeId === 'lazy-1') {
      children = [
        { id: 'lazy-1-1', label: '懒加载子节点 1-1', isLeaf: true },
        { id: 'lazy-1-2', label: '懒加载子节点 1-2', isLeaf: true },
        {
          id: 'lazy-1-3',
          label: '懒加载子节点 1-3',
          isLeaf: false, // 这个子节点也有子节点，可以继续展开
        }
      ]
    } else if (nodeId === 'lazy-2') {
      children = [
        { id: 'lazy-2-1', label: '懒加载子节点 2-1', isLeaf: true },
        { id: 'lazy-2-2', label: '懒加载子节点 2-2', isLeaf: true },
        { id: 'lazy-2-3', label: '懒加载子节点 2-3', isLeaf: true },
        { id: 'lazy-2-4', label: '懒加载子节点 2-4', isLeaf: true }
      ]
    } else if (nodeId === 'lazy-3') {
      // 模拟加载失败的情况
      addLazyLog(`加载节点失败: ${node.label || node.id}`)
      resolve([]) // 返回空数组表示没有子节点
      return
    } else if (nodeId === 'lazy-4') {
      children = [
        { id: 'lazy-4-1', label: '懒加载子节点 4-1', isLeaf: true }
      ]
    } else if (nodeId === 'lazy-1-3') {
      // 嵌套的懒加载
      children = [
        { id: 'lazy-1-3-1', label: '懒加载孙节点 1-3-1', isLeaf: true },
        { id: 'lazy-1-3-2', label: '懒加载孙节点 1-3-2', isLeaf: true }
      ]
    }

    addLazyLog(`加载完成: ${node.label || node.id} -> ${children.length} 个子节点`)
    resolve(children)
  }, Math.random() * 1000 + 500) // 500-1500ms的随机延迟
}

// 重置懒加载数据
const resetLazyData = () => {
  lazyTreeData.value = [
    {
      id: 'lazy-1',
      label: '懒加载节点 1',
      isLeaf: false,
    },
    {
      id: 'lazy-2',
      label: '懒加载节点 2',
      isLeaf: false,
    },
    {
      id: 'lazy-3',
      label: '懒加载节点 3',
      isLeaf: false,
    },
    {
      id: 'lazy-4',
      label: '懒加载节点 4',
      isLeaf: false,
    }
  ]
  lazyLogs.value = []
}

// 自定义loading效果的数据
const customLoadingTreeData = ref<TreeNodeData[]>([
  {
    id: 'custom-1',
    label: '文件夹 A',
    isLeaf: false,
  },
  {
    id: 'custom-2',
    label: '文件夹 B',
    isLeaf: false,
  },
  {
    id: 'custom-3',
    label: '文件夹 C',
    isLeaf: false,
  }
])

// 重置自定义loading数据
const resetCustomLoadingData = () => {
  customLoadingTreeData.value = [
    {
      id: 'custom-1',
      label: '文件夹 A',
      isLeaf: false,
    },
    {
      id: 'custom-2',
      label: '文件夹 B',
      isLeaf: false,
    },
    {
      id: 'custom-3',
      label: '文件夹 C',
      isLeaf: false,
    }
  ]
}

// 自定义图标的数据
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

// 重置图标数据
const resetIconData = () => {
  // 重新赋值来触发响应式更新
  iconTreeData.value = [...iconTreeData.value]
}

// 重置展开状态
const resetExpandedKeys = () => {
  defaultExpandedKeys.value = []
}

// 重置选中状态
const resetCheckedKeys = () => {
  defaultCheckedKeys.value = []
}

// 更新展开节点
const updateExpandedKeys = () => {
  defaultExpandedKeys.value = ['node-1', 'node-3', 'node-1-2']
}

// 更新选中节点
const updateCheckedKeys = () => {
  defaultCheckedKeys.value = ['node-1', 'node-2', 'node-3', 'node-1-1', 'node-1-2']
}

const handleNodeCheck = (data: TreeNodeData, info: any) => {
  console.log('Node checked:', data, info)
}

// 拖拽日志
const dragLogs = ref<string[]>([])

const addDragLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString()
  dragLogs.value.unshift(`[${timestamp}] ${message}`)
  // 最多保留20条日志
  if (dragLogs.value.length > 20) {
    dragLogs.value = dragLogs.value.slice(0, 20)
  }
}

const clearDragLogs = () => {
  dragLogs.value = []
}

const resetDragTreeData = () => {
  dragTreeData.value = generateDraggableTreeData()
  dragLogs.value = []
}

const handleDragStart = (node: TreeNodeData, event: DragEvent) => {
  addDragLog(`开始拖拽节点: ${node.label || node.id}`)
  console.log('Drag start:', node)
}

const handleDragEnter = (draggingNode: TreeNodeData, event: DragEvent, node: TreeNodeData) => {
  addDragLog(`进入节点: ${node.label || node.id}`)
  console.log('Drag enter:', { draggingNode, node })
}

const handleDragLeave = (draggingNode: TreeNodeData, event: DragEvent, node: TreeNodeData) => {
  addDragLog(`离开节点: ${node.label || node.id}`)
  console.log('Drag leave:', { draggingNode, node })
}

const handleDragOver = (draggingNode: TreeNodeData, event: DragEvent, node: TreeNodeData) => {
  // 悬停事件太频繁，不记录日志
  console.log('Drag over:', { draggingNode, node })
}

const handleDragEnd = (draggingNode: TreeNodeData, event: DragEvent) => {
  addDragLog(`结束拖拽: ${draggingNode.label || draggingNode.id}`)
  console.log('Drag end:', draggingNode)
}

interface NodeMeta {
  node: TreeNodeData
  parent: TreeNodeData | null
  siblings: TreeNodeData[]
  index: number
}

const findNodeMeta = (nodes: TreeNodeData[], id: string | number, parent: TreeNodeData | null = null): NodeMeta | null => {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.id === id) {
      return { node, parent, siblings: nodes, index: i }
    }
    if (node.children?.length) {
      const result = findNodeMeta(node.children, id, node)
      if (result) return result
    }
  }
  return null
}

const removeNodeById = (nodes: TreeNodeData[], id: string | number): NodeMeta | null => {
  const meta = findNodeMeta(nodes, id)
  if (!meta) return null
  meta.siblings.splice(meta.index, 1)
  return meta
}

const isDescendant = (root: TreeNodeData, targetId: string | number): boolean => {
  const children = root.children || []
  for (const child of children) {
    if (child.id === targetId || isDescendant(child, targetId)) {
      return true
    }
  }
  return false
}

const handleNodeDrop = (
  draggingNode: TreeNodeData,
  dropNode: TreeNodeData,
  dropType: 'prev' | 'inner' | 'next',
  event: DragEvent
) => {
  const typeMap: Record<'prev' | 'inner' | 'next', string> = {
    prev: '之前',
    inner: '内部',
    next: '之后'
  }
  addDragLog(`放置节点: ${draggingNode.label || draggingNode.id} -> ${dropNode.label || dropNode.id} (${typeMap[dropType]})`)
  console.log('Node dropped:', { draggingNode, dropNode, dropType })

  if (draggingNode.id === dropNode.id) return
  if (isDescendant(draggingNode, dropNode.id)) {
    addDragLog('无法将节点放置到其自身的子节点位置')
    return
  }

  const workingData = [...dragTreeData.value]
  const removedMeta = removeNodeById(workingData, draggingNode.id)
  if (!removedMeta) return

  const targetMeta = findNodeMeta(workingData, dropNode.id)
  if (!targetMeta) {
    // 如果目标节点在移除后不存在，恢复原数据
    dragTreeData.value = [...generateDraggableTreeData()]
    return
  }

  const insertIntoParent = (parent: TreeNodeData | null, index: number) => {
    const siblings = parent ? (parent.children = parent.children || []) : workingData
    if (
      removedMeta.parent &&
      parent &&
      removedMeta.parent.id === parent.id &&
      removedMeta.index < index
    ) {
      index -= 1
    }
    siblings.splice(index, 0, removedMeta.node)
  }

  if (dropType === 'inner') {
    targetMeta.node.children = targetMeta.node.children || []
    targetMeta.node.children.push(removedMeta.node)
  } else if (dropType === 'prev') {
    insertIntoParent(targetMeta.parent, targetMeta.index)
  } else if (dropType === 'next') {
    insertIntoParent(targetMeta.parent, targetMeta.index + 1)
  }

  dragTreeData.value = [...workingData]
}
const searching = ref(false)
const handleFilter = () => {
  if (treeRef.value) {
    searching.value = true
    nextTick(() => {
      treeRef.value.filter(filterText.value).then(() => {
        searching.value = false
      })
    })
  }
}

// 组件挂载后加载异步数据
onMounted(async () => {
  // 并行加载数据
  await initData()
  loadAsyncData()
})
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

.loading {
  padding: 40px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

.drag-log {
  margin-top: 15px;
  padding: 12px;
  background-color: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.drag-log h3 {
  margin-bottom: 10px;
  font-size: 14px;
  color: #606266;
}

.log-item {
  padding: 4px 0;
  font-size: 12px;
  color: #909399;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  border-bottom: 1px solid #ebeef5;
}

.log-item:last-child {
  border-bottom: none;
}

.btn-small {
  margin-top: 10px;
  padding: 4px 12px;
  font-size: 12px;
}

.lazy-log {
  margin-top: 15px;
  padding: 12px;
  background-color: #f0f9ff;
  border: 1px solid #b3d8ff;
  border-radius: 4px;
}

.lazy-log h3 {
  margin-bottom: 10px;
  font-size: 14px;
  color: #409eff;
  font-weight: 500;
}

/* 自定义节点样式 */
.custom-node {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.node-icon {
  font-size: 16px;
}

.node-id {
  color: #909399;
  font-size: 12px;
  font-weight: 500;
}

.node-label {
  flex: 1;
  color: #303133;
}

.node-status {
  color: #606266;
  font-size: 12px;
  font-style: italic;
}

/* 自定义loading效果样式 */
.custom-loading {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #409eff;
  font-size: 12px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e4e7ed;
  border-top: 2px solid #409eff;
  border-radius: 50%;
  animation: custom-loading-spin 1s linear infinite;
}

.loading-text {
  color: #909399;
  font-style: italic;
}

@keyframes custom-loading-spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

/* 自定义图标样式 */
.custom-icon {
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}
</style>
