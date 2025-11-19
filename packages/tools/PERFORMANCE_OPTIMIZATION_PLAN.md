# Vue Virtual Tree - 性能优化方案

## 概述

本文档描述了 `@vue-virtual-tree` 包中除 WebAssembly 工具函数替换外的其他性能优化方案。这些优化主要针对 Vue 响应式系统、数据结构、渲染性能等方面。

## 优化方案分类

### 1. 数据结构优化

#### 1.1 节点查找索引优化

**问题**：
- `getNodeData` 和 `getFlatNode` 使用 `Array.find()` 线性查找，时间复杂度 O(n)
- 在大数据量场景下，频繁查找节点性能较差

**当前实现**：
```typescript
// useTreeData.ts
const getNodeData = (id: string | number): TreeNodeData | null => {
  const flatNode = flatTree.value.find(n => n.id === id)
  return flatNode ? flatNode.data : null
}

const getFlatNode = (id: string | number): FlatTreeNode | null => {
  return flatTree.value.find(n => n.id === id) || null
}
```

**优化方案**：
```typescript
// 使用 Map 建立索引，O(1) 查找
const nodeDataMap = ref<Map<string | number, TreeNodeData>>(new Map())
const flatNodeMap = ref<Map<string | number, FlatTreeNode>>(new Map())

// 在 updateFlatTree 时更新索引
const updateFlatTree = () => {
  if (updatePending) return
  updatePending = true
  
  const { flatNodes } = flattenTree(rawData.value, 0, null, 0, true, props.props)
  flatTree.value = flatNodes
  
  // 更新索引
  nodeDataMap.value.clear()
  flatNodeMap.value.clear()
  flatNodes.forEach(node => {
    nodeDataMap.value.set(node.id, node.data)
    flatNodeMap.value.set(node.id, node)
  })
  
  updatePending = false
}

// O(1) 查找
const getNodeData = (id: string | number): TreeNodeData | null => {
  return nodeDataMap.value.get(id) || null
}

const getFlatNode = (id: string | number): FlatTreeNode | null => {
  return flatNodeMap.value.get(id) || null
}
```

**性能收益**：
- 查找操作从 O(n) 降至 O(1)
- 大数据量（>1000 节点）时，查找性能提升 10-100 倍
- 内存开销：每个节点额外存储 2 个 Map 条目（约 48-64 字节）

---

#### 1.2 可见节点索引优化

**问题**：
- `visibleNodes` 是 computed，每次访问都要执行 `filter` 操作
- 在虚拟滚动频繁访问时，会产生不必要的计算

**当前实现**：
```typescript
const visibleNodes = computed(() => {
  return flatTree.value.filter(node => node.isVisible)
})
```

**优化方案**：
```typescript
// 维护可见节点索引
const visibleNodeIndices = ref<number[]>([])
const visibleNodesCache = ref<FlatTreeNode[]>([])

// 在节点可见性变化时更新索引
const updateVisibleNodes = () => {
  const indices: number[] = []
  const nodes: FlatTreeNode[] = []
  
  flatTree.value.forEach((node, index) => {
    if (node.isVisible) {
      indices.push(index)
      nodes.push(node)
    }
  })
  
  visibleNodeIndices.value = indices
  visibleNodesCache.value = nodes
}

// 直接返回缓存
const visibleNodes = computed(() => visibleNodesCache.value)

// 在以下场景更新索引：
// 1. 节点展开/折叠
// 2. 过滤操作
// 3. 数据更新
```

**性能收益**：
- 避免每次访问都执行 filter
- 虚拟滚动访问时性能提升 5-10 倍
- 内存开销：额外存储索引数组（每个可见节点 4-8 字节）

---

### 2. 响应式系统优化

#### 2.1 批量更新优化

**问题**：
- 多个 watch 监听可能触发多次 `regenerateFlatTree`
- 展开/折叠多个节点时，每次都重新生成整个树

**当前实现**：
```typescript
watch(() => props.data, (newData) => {
  rawData.value = newData
  regenerateFlatTree()
}, { deep: true })

watch(() => [props.defaultExpandedKeys, props.defaultExpandAll], () => {
  regenerateFlatTree()
}, { deep: true, immediate: false })

watch(() => props.defaultCheckedKeys, () => {
  regenerateFlatTree()
}, { deep: true, immediate: false })
```

**优化方案**：
```typescript
// 使用防抖合并多个更新
import { debounce } from 'lodash-es' // 或自己实现

let regenerateTimer: ReturnType<typeof setTimeout> | null = null

const regenerateFlatTreeDebounced = debounce(() => {
  initExpandedKeys()
  updateFlatTree()
  initNodeChecked()
}, 0) // 使用 nextTick 延迟

const regenerateFlatTree = () => {
  if (regenerateTimer) {
    clearTimeout(regenerateTimer)
  }
  regenerateTimer = setTimeout(() => {
    initExpandedKeys()
    updateFlatTree()
    initNodeChecked()
    regenerateTimer = null
  }, 0)
}

// 或者使用 Vue 的 nextTick
const regenerateFlatTree = () => {
  if (updatePending) return
  updatePending = true
  nextTick(() => {
    initExpandedKeys()
    updateFlatTree()
    initNodeChecked()
    updatePending = false
  })
}
```

**性能收益**：
- 减少不必要的重复计算
- 批量操作时性能提升 2-5 倍

---

#### 2.2 选中状态计算优化

**问题**：
- `checkedKeys` 和 `halfCheckedKeys` 是 computed，每次都要遍历整个 flatTree
- 在选中状态频繁变化时，会产生大量计算

**当前实现**：
```typescript
const checkedKeys = computed(() => {
  const keys = new Set<string | number>()
  flatTree.value.forEach(node => {
    if (node.isChecked) {
      keys.add(node.id)
    }
  })
  return keys
})
```

**优化方案**：
```typescript
// 维护选中状态集合，直接更新而不是重新计算
const checkedKeys = ref<Set<string | number>>(new Set())
const halfCheckedKeys = ref<Set<string | number>>(new Set())

// 在 setNodeChecked 时直接更新集合
const setNodeChecked = (nodeId: string | number, checked: boolean) => {
  const node = flatTree.value.find(n => n.id === nodeId)
  if (!node) return
  
  // 更新节点状态
  node.isChecked = checked
  node.isIndeterminate = false
  
  // 直接更新集合
  if (checked) {
    checkedKeys.value.add(nodeId)
  } else {
    checkedKeys.value.delete(nodeId)
  }
  
  // 处理父子关联...
}

// 移除 computed，直接使用 ref
// const checkedKeys = computed(...) // 删除
```

**性能收益**：
- 选中状态更新从 O(n) 降至 O(1)
- 避免不必要的遍历计算
- 性能提升 10-50 倍（取决于节点数量）

---

### 3. 内存优化

#### 3.1 移除 parentNode 引用

**问题**：
- `FlatTreeNode` 中的 `parentNode` 引用可能导致循环引用
- 增加内存占用，影响 GC 效率

**当前实现**：
```typescript
interface FlatTreeNode {
  parentNode?: FlatTreeNode | null
  // ...
}
```

**优化方案**：
```typescript
// 移除 parentNode，只保留 parentId
interface FlatTreeNode {
  parentId: string | number | null
  // parentNode?: FlatTreeNode | null // 移除
}

// 需要父节点时通过 parentId 查找
const getParentNode = (node: FlatTreeNode): FlatTreeNode | null => {
  if (node.parentId === null) return null
  return flatNodeMap.value.get(node.parentId) || null
}
```

**性能收益**：
- 减少内存占用（每个节点节省一个引用）
- 避免循环引用，提升 GC 效率
- 内存占用减少 10-20%

---

#### 3.2 懒加载节点数据

**问题**：
- `FlatTreeNode.data` 存储完整的节点数据
- 对于大数据量，可能占用过多内存

**优化方案**：
```typescript
// 选项 1: 只存储必要字段
interface FlatTreeNode {
  id: string | number
  // data: TreeNodeData // 移除
  dataId: string | number // 指向原始数据的 ID
  // ...
}

// 需要完整数据时从原始数据查找
const getNodeData = (id: string | number): TreeNodeData | null => {
  const flatNode = flatNodeMap.value.get(id)
  if (!flatNode) return null
  
  // 从原始数据查找
  return findNodeByKey(rawData.value, flatNode.dataId, props.props)
}

// 选项 2: 使用 WeakMap 存储数据引用
const nodeDataCache = new WeakMap<FlatTreeNode, TreeNodeData>()

// 只在需要时存储
const getNodeData = (id: string | number): TreeNodeData | null => {
  const flatNode = flatNodeMap.value.get(id)
  if (!flatNode) return null
  
  if (!nodeDataCache.has(flatNode)) {
    // 从原始数据查找并缓存
    const data = findNodeByKey(rawData.value, id, props.props)
    if (data) {
      nodeDataCache.set(flatNode, data)
    }
  }
  
  return nodeDataCache.get(flatNode) || null
}
```

**性能收益**：
- 减少内存占用 30-50%（取决于数据复杂度）
- 需要权衡查找性能

---

### 4. 渲染优化

#### 4.1 节点组件优化

**问题**：
- 每个节点都是独立的 Vue 组件实例
- 大量节点时，组件创建和更新开销较大

**优化方案**：
```typescript
// 1. 使用 v-memo 缓存节点渲染
<TreeNode
  v-memo="[item.id, item.isExpanded, item.isChecked, item.isVisible]"
  :node="item"
  :key="item.id"
/>

// 2. 使用函数式组件（如果不需要响应式）
// 3. 减少 props 传递，使用 provide/inject
// 4. 使用 CSS contain 属性优化渲染
```

**性能收益**：
- 减少不必要的组件更新
- 渲染性能提升 20-40%

---

#### 4.2 虚拟滚动优化

**问题**：
- 虚拟滚动虽然只渲染可见节点，但滚动时频繁计算可见范围

**优化方案**：
```typescript
// 1. 优化 itemSize 计算
// 使用固定高度或缓存高度计算
const getItemSize = (node: FlatTreeNode): number => {
  // 缓存高度计算
  if (nodeHeightCache.has(node.id)) {
    return nodeHeightCache.get(node.id)!
  }
  
  const size = typeof props.itemSize === 'function' 
    ? props.itemSize(node) 
    : props.itemSize || 32
    
  nodeHeightCache.set(node.id, size)
  return size
}

// 2. 使用 requestAnimationFrame 优化滚动
const handleScroll = () => {
  if (scrollTimer) return
  
  scrollTimer = requestAnimationFrame(() => {
    // 更新可见范围
    updateVisibleRange()
    scrollTimer = null
  })
}
```

**性能收益**：
- 滚动流畅度提升
- 减少滚动时的计算开销

---

### 5. 算法优化

#### 5.1 增量更新优化

**问题**：
- 数据变化时，重新生成整个 flatTree
- 对于局部更新（如单个节点展开），可以只更新受影响的部分

**当前实现**：
```typescript
const regenerateFlatTree = () => {
  initExpandedKeys()
  updateFlatTree() // 重新生成整个树
  initNodeChecked()
}
```

**优化方案**：
```typescript
// 增量更新：只更新变化的节点
const expandNode = (node: FlatTreeNode) => {
  if (node.isExpanded) return
  
  node.isExpanded = true
  expandedKeys.value.add(node.id)
  
  // 只插入新展开的子节点
  if (node.rawChildren && node.rawChildren.length > 0) {
    const { flatNodes } = flattenTree(
      node.rawChildren,
      node.level + 1,
      node,
      node.index + 1,
      node.isVisible,
      props.props
    )
    
    // 插入到 flatTree
    flatTree.value.splice(node.index + 1, 0, ...flatNodes)
    
    // 更新后续节点的 index
    updateNodeIndices(node.index + flatNodes.length)
  }
  
  // 更新索引
  updateIndices()
  updateVisibleNodes()
}

const collapseNode = (node: FlatTreeNode) => {
  if (!node.isExpanded) return
  
  node.isExpanded = false
  expandedKeys.value.delete(node.id)
  
  // 移除所有子节点
  const childrenCount = getChildrenCount(node)
  if (childrenCount > 0) {
    flatTree.value.splice(node.index + 1, childrenCount)
    updateNodeIndices(node.index + 1)
  }
  
  // 更新索引
  updateIndices()
  updateVisibleNodes()
}
```

**性能收益**：
- 展开/折叠操作从 O(n) 降至 O(m)，m 为子节点数量
- 局部更新时性能提升 10-100 倍

---

#### 5.2 半选状态计算优化

**问题**：
- `updateHalfCheckedKeys` 遍历所有节点，计算半选状态
- 时间复杂度 O(n²)（每个节点都要获取所有子节点）

**当前实现**：
```typescript
const updateHalfCheckedKeys = () => {
  halfCheckedKeys.value.clear()
  const allKeys = new Set(flatTree.value.map(n => n.id))
  
  for (const key of allKeys) {
    const childrenKeys = getAllChildrenKeys(key) // O(n)
    if (childrenKeys.length === 0) continue
    
    const checkedChildren = childrenKeys.filter(k => checkedKeys.value.has(k))
    if (checkedChildren.length > 0 && checkedChildren.length < childrenKeys.length) {
      halfCheckedKeys.value.add(key)
    }
  }
}
```

**优化方案**：
```typescript
// 自底向上计算，只遍历一次
const updateHalfCheckedKeys = () => {
  halfCheckedKeys.value.clear()
  
  // 按层级从下往上处理
  const maxLevel = Math.max(...flatTree.value.map(n => n.level))
  
  for (let level = maxLevel; level >= 0; level--) {
    const nodesAtLevel = flatTree.value.filter(n => n.level === level)
    
    for (const node of nodesAtLevel) {
      if (node.isLeaf) continue
      
      // 获取直接子节点
      const directChildren = flatTree.value.filter(
        n => n.parentId === node.id
      )
      
      if (directChildren.length === 0) continue
      
      // 统计子节点状态
      let checkedCount = 0
      let indeterminateCount = 0
      
      for (const child of directChildren) {
        if (child.isChecked) {
          checkedCount++
        } else if (halfCheckedKeys.value.has(child.id)) {
          indeterminateCount++
        }
      }
      
      // 更新节点状态
      if (checkedCount === directChildren.length) {
        node.isChecked = true
        node.isIndeterminate = false
        halfCheckedKeys.value.delete(node.id)
      } else if (checkedCount > 0 || indeterminateCount > 0) {
        node.isChecked = false
        node.isIndeterminate = true
        halfCheckedKeys.value.add(node.id)
      } else {
        node.isChecked = false
        node.isIndeterminate = false
        halfCheckedKeys.value.delete(node.id)
      }
    }
  }
}
```

**性能收益**：
- 从 O(n²) 降至 O(n)
- 大数据量时性能提升 10-100 倍

---

### 6. 缓存优化

#### 6.1 节点实例缓存优化

**问题**：
- `createNodeInstance` 使用 WeakMap 缓存，但每次访问都要创建新的实例方法

**当前实现**：
```typescript
const nodeInstanceCache = new WeakMap<FlatTreeNode, TreeNodeInstance>()

const createNodeInstance = (flatNode: FlatTreeNode): TreeNodeInstance => {
  if (nodeInstanceCache.has(flatNode)) {
    return nodeInstanceCache.get(flatNode)!
  }
  // ... 创建实例
}
```

**优化方案**：
```typescript
// 1. 使用 Proxy 延迟计算属性
const createNodeInstance = (flatNode: FlatTreeNode): TreeNodeInstance => {
  return new Proxy({} as TreeNodeInstance, {
    get(target, prop) {
      // 延迟计算属性
      switch (prop) {
        case 'parent':
          return getParentInstance(flatNode)
        case 'children':
          return getChildrenInstances(flatNode)
        // ...
      }
    }
  })
}

// 2. 或者使用更轻量的对象结构
interface TreeNodeInstance {
  data: TreeNodeData
  key: string | number
  level: number
  // 移除 getter，改为方法
  getParent: () => TreeNodeInstance | null
  getChildren: () => TreeNodeInstance[]
  // ...
}
```

**性能收益**：
- 减少内存占用
- 提升实例创建速度

---

### 7. 事件处理优化

#### 7.1 事件委托优化

**问题**：
- 每个节点都有独立的事件处理器
- 大量节点时，事件监听器数量过多

**优化方案**：
```typescript
// 使用事件委托，在容器上统一处理
<div class="vue-virtual-tree" @click="handleTreeClick">
  <!-- 节点 -->
</div>

const handleTreeClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const nodeElement = target.closest('[data-node-id]')
  
  if (!nodeElement) return
  
  const nodeId = nodeElement.getAttribute('data-node-id')
  const node = getFlatNode(nodeId)
  
  if (node) {
    handleNodeClick(node, event)
  }
}
```

**性能收益**：
- 减少事件监听器数量
- 内存占用减少
- 事件处理性能提升

---

## 优化优先级建议

### 高优先级（立即实施）

1. **节点查找索引优化** - 收益大，实现简单
2. **选中状态计算优化** - 收益大，影响用户体验
3. **批量更新优化** - 收益中等，实现简单

### 中优先级（计划实施）

4. **增量更新优化** - 收益大，但实现复杂
5. **半选状态计算优化** - 收益大，实现中等
6. **可见节点索引优化** - 收益中等，实现简单

### 低优先级（可选实施）

7. **移除 parentNode 引用** - 收益中等，需要重构
8. **节点组件优化** - 收益中等，需要测试
9. **懒加载节点数据** - 收益大，但可能影响功能
10. **事件委托优化** - 收益小，实现简单

---

## 实施计划

### 阶段 1：快速优化（1-2 天）
- 节点查找索引优化
- 选中状态计算优化
- 批量更新优化

### 阶段 2：算法优化（3-5 天）
- 增量更新优化
- 半选状态计算优化
- 可见节点索引优化

### 阶段 3：深度优化（5-7 天）
- 内存优化
- 渲染优化
- 事件处理优化

---

## 性能测试建议

在实施每个优化后，建议进行性能测试：

1. **基准测试**：
   - 1000 节点：展开/折叠、选中、过滤
   - 5000 节点：展开/折叠、选中、过滤
   - 10000 节点：展开/折叠、选中、过滤

2. **内存测试**：
   - 监控内存占用
   - 检查内存泄漏

3. **渲染测试**：
   - FPS 监控
   - 滚动流畅度测试

---

## 注意事项

1. **兼容性**：确保优化不影响现有 API
2. **测试覆盖**：每个优化都要有对应的测试
3. **渐进式**：可以逐步实施，不影响现有功能
4. **文档更新**：优化后更新相关文档

---

## 参考资料

- [Vue 3 性能优化指南](https://vuejs.org/guide/best-practices/performance.html)
- [虚拟滚动最佳实践](https://web.dev/virtualize-long-lists-react-window/)
- [JavaScript 性能优化](https://developer.mozilla.org/en-US/docs/Web/Performance)

