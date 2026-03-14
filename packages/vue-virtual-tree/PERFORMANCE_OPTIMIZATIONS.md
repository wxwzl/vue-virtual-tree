# vue-virtual-tree 性能优化计划

## 优化点清单

### 1. 【高优先级】useTreeSelection.ts - O(n²) 选择算法优化

**文件**: `src/composables/useTreeSelection.ts:91-104`

**问题**:

- `updateHalfCheckedKeys` 是 O(n²) 复杂度
- 每次选中/取消选中都会遍历所有节点来查找子节点
- `checkedKeys` 和 `halfCheckedKeys` 使用 computed，每次访问都会重新计算

**优化方案**:

- 使用 ref 替代 computed 存储选中状态
- 预计算节点元数据缓存（parentId, childIds, allDescendantIds）
- 使用自底向上更新策略，仅更新祖先节点（O(h)）
- 使用计数缓存（checkedCountMap）避免重复计算

**预期提升**:

- 10,000 节点: 从 150ms → 2ms (75× 提升)
- 初始化: 从 800ms → 15ms (50× 提升)

---

### 2. 【高优先级】useTreeData.ts - 全树重组优化

**文件**: `src/composables/useTreeData.ts:216-225`

**问题**:

- 任何数据变化都会触发 `regenerateFlatTree()`，重组整个树
- 深度监听 `props.data` 导致频繁触发
- 没有增量更新机制

**优化方案**:

- 实现增量更新 API（updateNode, removeNode, insertNode）
- 使用浅层监听 + 手动标记更新
- 批量处理多个节点变更

**预期提升**:

- 单节点更新: 从 O(n) → O(1)
- 大数据量更新减少 90% 计算量

---

### 3. ✅【已完成】useTreeExpand.ts - 数组操作优化

**文件**: `src/composables/useTreeExpand.ts`

**问题**:

- `splice(...descendants)` 展开操作会创建中间数组
- `collectVisibleDescendants` 递归收集节点
- 大范围展开/收起时触发多次响应式更新

**优化方案**:

- ✅ 使用迭代替代递归 (`collectVisibleDescendantsIterative`)，避免栈溢出
- ✅ 使用数组拼接 (`insertNodesOptimized`) 替代 `splice + spread`，减少 GC
- ✅ 使用 `filter` 替代 `splice` 进行批量删除 (`removeNodesOptimized`)
- ✅ 添加批量操作队列 (`batchQueue`)，合并多次更新为一次响应式更新
- ✅ 新增 `batchToggleNodes` 批量操作 API
- ✅ 新增 `flushPendingOperations` 手动刷新操作

**实现详情**:

```typescript
// 1. 迭代替代递归
const collectVisibleDescendantsIterative = (parent: FlatTreeNode): FlatTreeNode[] => {
  const result: FlatTreeNode[] = [];
  const stack: FlatTreeNode[] = [...parent.children].reverse();
  while (stack.length > 0) {
    const node = stack.pop()!;
    result.push(node);
    if (node.isExpanded && node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]);
      }
    }
  }
  return result;
};

// 2. 优化数组插入
const insertNodesOptimized = (
  visibleNodes: FlatTreeNode[],
  insertIndex: number,
  nodesToInsert: FlatTreeNode[]
): FlatTreeNode[] => {
  const before = visibleNodes.slice(0, insertIndex + 1);
  const after = visibleNodes.slice(insertIndex + 1);
  return before.concat(nodesToInsert, after);
};

// 3. 批量操作
const batchToggleNodes = (nodes: FlatTreeNode[], expand: boolean) => {
  nodes.forEach((node) => queueBatchOperation({ type: expand ? "expand" : "collapse", node }));
};
```

**预期提升**:

- 展开 1000 节点: 从 50ms → 5ms (10× 提升)
- 深层树 (1000+ 层): 从栈溢出 → 正常处理
- 减少 GC 压力，批量操作减少 80% 响应式更新

---

### 4. 【中优先级】useTreeExpand.ts - 递归展开优化

**文件**: `src/composables/useTreeExpand.ts:109-121`

**问题**:

- `setRecursionExpanded` 使用递归遍历所有后代
- 收起时仍会递归访问所有已收起子节点
- 可能导致栈溢出（深层树）

**优化方案**:

- 使用迭代替代递归（while + stack）
- 提前终止已收起的分支
- 使用队列避免栈溢出

**预期提升**:

- 深层树 (1000+ 层): 从栈溢出 → 正常处理
- 整体展开速度提升 30%

---

### 5. 【中优先级】useTreeSelection.ts - computed 缓存优化

**文件**: `src/composables/useTreeSelection.ts:16-35`

**问题**:

- `checkedKeys` 和 `halfCheckedKeys` 是 computed
- 每次访问都遍历整个 `flatTree`
- 在 `toggleNodeChecked` 中被多次访问

**优化方案**:

- 改用 `ref` 维护状态
- 在状态变更时同步更新 Set
- 避免重复遍历

**预期提升**:

- 选中操作: 减少 2-3 次全树遍历
- 响应速度提升 20%

---

### 6. 【低优先级】VirtualTree.vue - getNodeSizeDependencies 缓存

**文件**: `src/components/VirtualTree.vue:183-195`

**问题**:

- 每次调用都创建新数组
- 触发 DynamicScroller 不必要的重新计算
- GC 压力

**优化方案**:

- 使用 WeakMap 缓存依赖数组
- 只在必要时更新缓存

**预期提升**:

- 减少 GC 暂停
- 滚动性能提升 10%

---

### 7. 【架构优化】Web Worker 支持（大数据量）

**问题**:

- 50,000+ 节点时主线程被阻塞
- 初始化/过滤操作卡顿

**优化方案**:

- 将 flattenTree 移至 Web Worker
- 异步处理大数据量操作
- 添加 loading 状态

**预期提升**:

- 100,000 节点: 从 UI 卡顿 → 流畅
- 主线程保持响应

---

### 8. 【架构优化】批量 DOM 更新

**问题**:

- 每个操作都立即触发 Vue 响应式
- 批量操作时产生中间状态

**优化方案**:

- 添加 batchUpdate 工具函数
- 使用 `pauseTracking()` / `resumeTracking()`
- 批量操作完成后统一触发更新

**预期提升**:

- 批量操作: 从 O(n×m) → O(n)
- 减少 80% 渲染次数

---

## 执行计划

1. ✅ **已完成**: 分析代码，识别优化点
2. ✅ **已完成**: 优化 #1 - useTreeSelection O(n²) 算法
   - `checkedKeys` / `halfCheckedKeys` 改用 `ref` 替代 `computed`
   - 添加 `nodeMetaMap` 缓存节点关系（parentId, childIds, allDescendantIds）
   - 添加 `checkedCountMap` 计数缓存
   - 实现 `updateAncestorStates` O(h) 更新
   - 实现 `batchUpdateAllStates` O(n) 批量初始化
3. ✅ **已完成**: 完善测试用例
   - `src/__tests__/utils/tree.spec.ts` - 工具函数测试 (31项通过)
   - `src/__tests__/composables/useTreeSelection.spec.ts` - 选择逻辑测试 (3项通过)
   - `src/__tests__/composables/useTreeExpand.spec.ts` - 展开/折叠测试 (2项通过)
   - `src/__tests__/composables/useTreeFilter.spec.ts` - 过滤功能测试 (2项通过)
   - `src/__tests__/composables/useTreeDrag.spec.ts` - 拖拽功能测试 (2项通过)
   - `src/__tests__/composables/useTreeData.spec.ts` - 数据管理测试 (3项通过)
   - `src/__tests__/components/VirtualTree.spec.ts` - 组件集成测试 (2项通过)
   - **总计**: 45项测试通过
4. ⏳ **待定**: 优化 #2 - useTreeData 增量更新
5. ✅ **已完成**: 优化 #3 - useTreeExpand 数组操作与批量更新
6. ✅ **已完成**: 优化 #4 - useTreeExpand 递归优化（迭代替代递归）
7. ⏳ **待定**: 优化 #5 - computed 缓存
8. ⏳ **待定**: 优化 #6 - getNodeSizeDependencies
9. ⏳ **待定**: 架构优化 Web Worker

---

## 测试建议

每次优化后应测试：

1. 10,000 节点展开/收起性能
2. 1,000 节点批量选中性能
3. 内存占用变化
4. 初始化时间
