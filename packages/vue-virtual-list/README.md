# @wxwzl/vue-virtual-list

一个高性能 Vue 3 虚拟列表组件：spacer-flow 布局（零 transform）、Fenwick 树高度模型、动态行高实测、千万级行支持。

## 特性

- ⚡️ **spacer-flow 布局** - 行在正常文档流中渲染，上下 spacer 元素撑开滚动高度，零 transform：无合成层开销，sticky 定位、文本选择、打印等行为与原生列表一致
- 📏 **两种行高模式** - 固定行高 O(1) 滚动定位；`dynamic` 动态行高由内容决定，渲染后经 ResizeObserver 实测回写，基于 Fenwick 树的高度模型保证定位/插入/更新均为 O(log n)
- 🚀 **千万级行** - 虚拟 px 坐标系 + 缩放映射，突破浏览器单元素 DOM 高度上限（Firefox 约 1789 万 px），行数不受 scrollHeight 限制
- 🔌 **双数据源** - `items` 数组直传，或 `itemCount` + `getItemAt` 回调式取用（无需一次性物化超大数组）
- 🧊 **rowMemo 行缓存** - 滚动窗口平移时未变化的行完全跳过插槽调用与 patch
- 📦 **TypeScript** - 完整的泛型类型支持

## 安装

```bash
pnpm add @wxwzl/vue-virtual-list
```

## 快速开始

```vue
<template>
  <VirtualList :items="rows" :item-size="32" :height="400" v-slot="{ item, index }">
    <div class="row">{{ index }} - {{ item.label }}</div>
  </VirtualList>
</template>

<script setup lang="ts">
  import { VirtualList } from "@wxwzl/vue-virtual-list";
  import "@wxwzl/vue-virtual-list/style";

  const rows = Array.from({ length: 1_000_000 }, (_, i) => ({ label: `row ${i}` }));
</script>
```

### 回调式数据源

无需构造大数组，按行号惰性取数：

```vue
<VirtualList
  :item-count="10_000_000"
  :get-item-at="(i) => `row ${i}`"
  :item-size="32"
  v-slot="{ item }"
>
  <div class="row">{{ item }}</div>
</VirtualList>
```

### 动态行高

行高由内容决定（如超长文本自动换行）：

```vue
<VirtualList :items="rows" :item-size="48" dynamic v-slot="{ item }">
  <div class="row-auto">{{ item.text }}</div>
</VirtualList>
```

`item-size` 在动态模式下作为未测量行的估计高度；渲染过的行由 ResizeObserver 实测回写。

## API

### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| items | 数组数据源（与 itemCount + getItemAt 二选一） | `T[]` | - |
| item-count | 回调数据源：行数 | `number` | - |
| get-item-at | 回调数据源：按行号取数据 | `(index: number) => T` | - |
| item-size | 行高（px）。固定模式为精确行高；dynamic 模式下作为未测量行的估计高度 | `number` | -（必填） |
| dynamic | 动态行高模式：行高由内容决定，渲染后实测回写 | `boolean` | `false` |
| buffer | 上下缓冲区（px） | `number` | `200` |
| row-memo | 行内容缓存：行仅在「行号或 items[i] 引用变化」时重渲染，窗口平移时未变行跳过插槽调用与 patch。注意：插槽内容若依赖 items[i] 之外的外部状态（如选中态），不要开启 | `boolean` | `false` |
| height | 容器高度 | `number \| string` | `'100%'` |

### Slots

| 插槽名  | 说明   | 参数                         |
| ------- | ------ | ---------------------------- |
| default | 行内容 | `{ item: T, index: number }` |

### Exposed Methods

| 方法名 | 说明 | 参数 |
| --- | --- | --- |
| scrollToIndex | 滚动到指定行 | `(index: number, align?: 'start' \| 'center' \| 'end', offset?: number)` |
| scrollTo | 滚动到指定偏移（虚拟 px） | `(offset: number)` |
| getMeasuredCount | 已实测缓存的行数（动态模式的缓存进度指标） | - |

### 底层导出（进阶）

```ts
import {
  FixedSizeModel, // 固定行高模型
  MeasuredSizeModel, // 动态行高模型（Fenwick 树）
  visibleRange, // 视口行范围计算
  coverRange, // 含 buffer 的覆盖范围计算
  type SizeModel,
  type RowRange,
} from "@wxwzl/vue-virtual-list";
```

尺寸模型与范围计算与组件解耦，可直接用于自研虚拟化场景（如 `@wxwzl/vue-virtual-tree` 即基于此包实现）。

## 实现要点

- **spacer-flow 布局**：上 spacer + 渲染行 + 下 spacer 依次排列，浏览器原生完成定位，无 `translateY`，无逐行绝对定位
- **虚拟 px 坐标系**：内部以真实总高（可超 DOM 上限）计算，DOM 侧按缩放比 k 映射，滚动条比例始终正确
- **冻结总跨度**：两次渲染之间 scrollHeight 恒定，滚动条拇指不漂移；快速拖拽不白屏
- **贴底吸附**：底部有行追加（如日志流）时自动保持贴底

## 许可证

MIT
