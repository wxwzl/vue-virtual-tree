<template>
  <div class="demo-section">
    <h2>自研虚拟列表（spacer 流式 + 边界回收）</h2>
    <div class="control-panel">
      <label>
        行数：
        <select v-model.number="rowCount">
          <option :value="100000">10 万</option>
          <option :value="1000000">100 万</option>
          <option :value="10000000">1000 万（触发 k 缩放）</option>
        </select>
      </label>
      <label>
        行高：
        <select v-model.number="rowHeight">
          <option :value="24">24</option>
          <option :value="32">32</option>
          <option :value="48">48</option>
        </select>
      </label>
      <button class="btn" @click="jumpTo('start')">顶部</button>
      <button class="btn" @click="jumpTo('middle')">中部</button>
      <button class="btn" @click="jumpTo('end')">底部</button>
      <label>
        跳转到行：
        <input v-model.number="jumpIndex" class="jump-input" type="number" min="0" />
      </label>
      <button class="btn" @click="doScrollToIndex('start')">start</button>
      <button class="btn" @click="doScrollToIndex('center')">center</button>
      <button class="btn" @click="doScrollToIndex('end')">end</button>
    </div>
    <div class="metrics">
      <span>scrollTop：{{ scrollTop.toFixed(0) }} px</span>
      <span>首行：{{ firstRow.toLocaleString() }}</span>
      <span>滚动帧均耗时：{{ frameCost.toFixed(2) }} ms</span>
    </div>
    <p class="tip">
      行是普通流式内容，零 transform；行内滚动由浏览器原生处理，仅跨越缓冲边界时才平移渲染窗口。
      回调数据源（itemCount + getItemAt），不物化数据数组。
    </p>
    <div class="list-shell">
      <VirtualList
        ref="listRef"
        :item-count="rowCount"
        :get-item-at="getItemAt"
        :item-size="rowHeight"
        :buffer="300"
        height="100%"
        @scroll.passive="onScroll"
      >
        <template #default="{ item, index }">
          <div class="row">
            <span class="row-index">#{{ index.toLocaleString() }}</span>
            <span class="row-label">{{ item.label }}</span>
            <span class="row-meta">{{ item.meta }}</span>
          </div>
        </template>
      </VirtualList>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from "vue";
  import { VirtualList } from "@wxwzl/vue-virtual-list";

  interface RowData {
    id: number;
    label: string;
    meta: string;
  }

  const rowCount = ref(1_000_000);
  const rowHeight = ref(32);
  const jumpIndex = ref(500_000);
  const scrollTop = ref(0);
  const frameCost = ref(0);
  const listRef = ref<InstanceType<typeof VirtualList> | null>(null);

  // 回调数据源：按行号即时生成，不占用内存
  const getItemAt = (index: number): RowData => ({
    id: index,
    label: `Row ${index.toLocaleString()} — 自研 spacer 流式虚拟列表`,
    meta: `offset ${(index * rowHeight.value).toLocaleString()} px`,
  });

  const firstRow = computed(() => Math.floor(scrollTop.value / rowHeight.value));

  let frames = 0;
  let costSum = 0;
  let metricTimer: ReturnType<typeof setTimeout> | null = null;
  const onScroll = (e: Event) => {
    const t0 = performance.now();
    const st = (e.target as HTMLElement).scrollTop;
    costSum += performance.now() - t0;
    frames++;
    // 指标 150ms 节流：demo 组件每次重渲染都要重建插槽 vnode 树，
    // 逐帧更新会成为滚动帧耗时大头
    if (metricTimer) {
      return;
    }
    metricTimer = setTimeout(() => {
      metricTimer = null;
      scrollTop.value = st;
      frameCost.value = costSum / frames;
    }, 150);
  };

  const jumpTo = (pos: "start" | "middle" | "end") => {
    const targets = { start: 0, middle: rowCount.value >> 1, end: rowCount.value - 1 };
    listRef.value?.scrollToIndex(targets[pos]);
  };

  const doScrollToIndex = (align: "start" | "center" | "end") => {
    const i = Math.min(Math.max(0, jumpIndex.value || 0), rowCount.value - 1);
    listRef.value?.scrollToIndex(i, align);
  };
</script>

<style scoped lang="scss">
  .demo-section {
    padding: 16px;
    height: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .control-panel {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }

  .jump-input {
    width: 100px;
  }

  .metrics {
    display: flex;
    gap: 16px;
    color: #606266;
    font-size: 13px;
    margin-bottom: 4px;
  }

  .tip {
    color: #909399;
    font-size: 12px;
    margin: 0 0 8px;
  }

  .list-shell {
    flex: 1;
    min-height: 0;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    overflow: hidden;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 100%;
    padding: 0 12px;
    box-sizing: border-box;
    border-bottom: 1px solid #f2f3f5;
    white-space: nowrap;
    overflow: hidden;
  }

  .row-index {
    color: #409eff;
    font-variant-numeric: tabular-nums;
    min-width: 90px;
  }

  .row-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-meta {
    color: #c0c4cc;
    font-size: 12px;
  }
</style>
