# Vue Virtual Tree

一个基于自研虚拟列表（`@wxwzl/vue-virtual-list`）的高性能 Vue 3 虚拟树列表组件库，功能参照 Element Plus Tree 组件。

## 特性

- ⚡️ **虚拟滚动** - 支持百万级节点的高性能渲染（分片初始化，主线程不卡顿）
- 🌳 **完整树功能** - 展开/折叠、选择、过滤、拖拽等
- 🎨 **Element Plus 风格** - API 设计与 Element Plus Tree 保持一致
- 📦 **TypeScript** - 完整的类型支持
- 🔧 **灵活配置** - 支持自定义字段映射、节点内容等

## [在线demo](https://wxwzl.github.io/vue-virtual-tree/)

## 安装

```bash
pnpm add @wxwzl/vue-virtual-tree
```

## 快速开始

```vue
<template>
  <VirtualTree :data="treeData" :height="400" />
</template>

<script setup lang="ts">
  import { VirtualTree } from "@wxwzl/vue-virtual-tree";
  import "@wxwzl/vue-virtual-tree/style";

  const treeData = [
    {
      id: 1,
      label: "节点 1",
      children: [
        { id: 2, label: "节点 1-1" },
        { id: 3, label: "节点 1-2" },
      ],
    },
  ];
</script>
```

### 加载状态

```vue
<template>
  <!-- 使用默认加载状态 -->
  <VirtualTree :data="treeData" :loading="isLoading" :height="400" />

  <!-- 自定义加载状态 -->
  <VirtualTree :data="treeData" :loading="isLoading" :height="400">
    <template #tree-loading>
      <div class="custom-loading">数据加载中...</div>
    </template>
  </VirtualTree>
</template>

<script setup lang="ts">
  import { ref } from "vue";
  import { VirtualTree } from "@wxwzl/vue-virtual-tree";

  const isLoading = ref(true);
  const treeData = ref([]);

  // 模拟数据加载
  setTimeout(() => {
    treeData.value = [
      { id: 1, label: "节点 1" },
      { id: 2, label: "节点 2" },
    ];
    isLoading.value = false;
  }, 2000);
</script>
```

## 功能

### 基础功能

- ✅ 树形结构展示
- ✅ 节点展开/折叠
- ✅ 虚拟滚动（支持大量数据）
- ✅ 节点点击事件

### 选择功能

- ✅ 单选模式
- ✅ 多选模式（复选框）
- ✅ 节点选中状态管理
- ✅ 父子节点关联选择

### 数据功能

- ✅ 懒加载节点
- ✅ 节点过滤/搜索
- ✅ 默认展开节点
- ✅ 默认选中节点

### 交互功能

- ✅ 自定义节点内容（插槽）
- ✅ 自定义节点类名
- ✅ 节点拖拽排序
- ✅ 手风琴模式（同级节点互斥展开）

### 高级功能

- ✅ 节点禁用
- ✅ 节点图标自定义
- ✅ 节点加载状态
- ✅ 空状态展示

## API

### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| data | 树形数据 | `TreeNodeData[]` | `[]` |
| props | 数据字段映射配置 | `TreePropsConfig` | `{}` |
| show-checkbox | 是否显示复选框 | `boolean` | `false` |
| check-strictly | 是否严格遵循父子不关联 | `boolean` | `false` |
| default-expand-all | 是否默认展开所有节点 | `boolean` | `false` |
| default-expanded-keys | 默认展开的节点 key 数组 | `(string \| number)[]` | `[]` |
| default-checked-keys | 默认选中的节点 key 数组 | `(string \| number)[]` | `[]` |
| current-node-key | 当前选中的节点 key | `string \| number` | - |
| expand-on-click-node | 是否点击节点展开 | `boolean` | `true` |
| lazy | 是否懒加载 | `boolean` | `false` |
| load | 懒加载方法 | `Function` | - |
| filter-node-method | 节点过滤方法 | `Function` | - |
| accordion | 是否手风琴模式 | `boolean` | `false` |
| draggable | 是否可拖拽 | `boolean` | `false` |
| allow-drop | 拖拽时判断是否允许放置 | `Function` | - |
| allow-drag | 拖拽时判断节点是否允许拖拽 | `Function` | - |
| item-size | 节点高度（固定高度时使用） | `number` | `32` |
| height | 虚拟滚动容器高度 | `number \| string` | `'100%'` |
| indent | 每一级节点的缩进值，支持数字或函数（函数入参为 `node: FlatTreeNode`） | `number \| (node) => number` | `18` |
| loading | 是否显示加载状态 | `boolean` | `false` |
| fixed-height | 固定行高模式。`true` 时行高恒等于 `item-size`：O(1) 滚动定位、无高度测量，大数据量下快速滚动不白屏；此时超长 label 不换行（省略号截断） | `boolean` | `false` |
| buffer | 虚拟滚动缓冲区（px） | `number` | `500` |

### Events

| 事件名          | 说明             | 参数                                        |
| --------------- | ---------------- | ------------------------------------------- |
| node-click      | 节点点击         | `(data, node, event)`                       |
| node-check      | 节点复选框点击   | `(data, checked)`                           |
| node-expand     | 节点展开         | `(data, node)`                              |
| node-collapse   | 节点折叠         | `(data, node)`                              |
| current-change  | 当前选中节点变化 | `(data, node)`                              |
| node-drag-start | 拖拽开始         | `(node, event)`                             |
| node-drag-enter | 拖拽进入         | `(draggingNode, event, node)`               |
| node-drag-leave | 拖拽离开         | `(draggingNode, event, node)`               |
| node-drag-over  | 拖拽悬停         | `(draggingNode, event, node)`               |
| node-drag-end   | 拖拽结束         | `(draggingNode, event)`                     |
| node-drop       | 拖拽放置         | `(draggingNode, dropNode, dropType, event)` |

### Methods

| 方法名            | 说明                           | 参数                               |
| ----------------- | ------------------------------ | ---------------------------------- |
| getCheckedNodes   | 获取选中的节点                 | `(leafOnly?, includeHalfChecked?)` |
| getCheckedKeys    | 获取选中的节点 key             | `(leafOnly?)`                      |
| setCheckedNodes   | 设置选中的节点                 | `(nodes, leafOnly?)`               |
| setCheckedKeys    | 设置选中的节点 key             | `(keys, leafOnly?)`                |
| getCurrentNode    | 获取当前选中节点               | -                                  |
| setCurrentNode    | 设置当前选中节点               | `(node)`                           |
| getCurrentKey     | 获取当前选中节点的 key         | -                                  |
| setCurrentKey     | 设置当前选中节点的 key         | `(key)`                            |
| filter            | 过滤节点                       | `(value)`                          |
| getNode           | 根据 key 获取节点              | `(key)`                            |
| remove            | 删除节点                       | `(key)`                            |
| append            | 追加节点                       | `(data, parentKey?)`               |
| insertBefore      | 在节点前插入                   | `(data, key)`                      |
| insertAfter       | 在节点后插入                   | `(data, key)`                      |
| updateKeyChildren | 更新节点的子节点（懒加载）     | `(key, data)`                      |
| replace           | 替换指定节点的数据（详见下文） | `(data, key)`                      |
| scrollToNode      | 滚动到指定节点                 | `(key, options?)`                  |

#### replace 方法说明

`replace(data, key)` 用于**节点级局部更新**，替换指定节点的数据：

- `data` 中**不包含** `children` 时：保留原子树，原地更新节点数据（O(1) 视图刷新，不重建整树）
- `data` 中**包含** `children` 时：整体替换该节点的子树（走全量重建）
- 新数据的 key 与原 key 不同时：自动迁移该节点的展开 / 勾选 / 半选 / 当前选中状态

```ts
const treeRef = ref();

// 仅更新 label，保留子树
treeRef.value.replace({ id: 1, label: "新名称" }, 1);

// 替换子树
treeRef.value.replace({ id: 1, label: "新名称", children: [{ id: 11, label: "子节点" }] }, 1);
```

### Slots

| 插槽名       | 说明               | 参数             |
| ------------ | ------------------ | ---------------- |
| default      | 自定义节点内容     | `{ node, data }` |
| empty        | 空状态内容         | -                |
| tree-loading | 整个树的加载状态   | -                |
| loading      | 节点懒加载时的状态 | `{ node, data }` |
| icon         | 自定义节点图标     | `{ node, data }` |

## 大数据量与性能

组件针对百万级节点做了专项优化：

- **分片初始化**：扁平化按 8ms 时间片分批执行并让出主线程，初始化期间页面保持可交互（会短暂显示加载状态），百万节点不卡顿
- **O(n) 勾选状态**：父子关联勾选基于扁平数组一次倒序遍历完成，无 O(n²) 的元数据预计算
- **两种滚动模式**（统一由自研 `@wxwzl/vue-virtual-list` 承载，Fenwick 树高度模型，展开/收起仅 O(log n)）：
  - 默认动态行高：支持超长 label 自动换行，行高由 ResizeObserver 实测回写
  - `fixed-height` 固定行高：O(1) 滚动定位、无高度测量，超大数据量下快速拖拽滚动条不白屏，配合 `item-size` 指定行高
- **局部更新**：优先使用 `append` / `remove` / `insertBefore` / `insertAfter` / `replace` / `updateKeyChildren` 方法做运行时数据变更，避免整树重建

> 注意：`data` prop 采用浅监听（数组引用变化才触发重建）。原地修改数组或节点字段不会刷新视图，请改用上述命令式方法，或整体替换 `data` 数组。

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发环境
pnpm dev

# 构建
pnpm build
```

## 技术栈

- Vue 3 (Composition API)
- TypeScript
- @wxwzl/vue-virtual-list（自研虚拟列表）
- Vite
- pnpm

## 许可证

MIT
