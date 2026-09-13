<template>
  <div class="demo-section">
    <h2>自研虚拟列表 · 动态行高（实测回写 + 滚动锚定）</h2>
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
        估计行高：
        <select v-model.number="estimate">
          <option :value="24">24</option>
          <option :value="40">40</option>
          <option :value="64">64</option>
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
      <span>已缓存行高：{{ measuredCount.toLocaleString() }}</span>
    </div>
    <p class="tip">
      行高由内容决定（1~3 行文本，约 32~80px），未测量行按估计高度参与定位，渲染后 ResizeObserver
      实测回写 Fenwick 树；视口顶以上的行高变化会补偿
      scrollTop，视口内容保持不动。跳转基于估计值为近似定位，随测量逐步精确。
    </p>
    <div class="list-shell">
      <VirtualList
        ref="listRef"
        :item-count="rowCount"
        :get-item-at="getItemAt"
        :item-size="estimate"
        :dynamic="true"
        :buffer="300"
        height="100%"
        @scroll.passive="onScroll"
      >
        <template #default="{ item, index }">
          <div class="row">
            <span class="row-index">#{{ index.toLocaleString() }}</span>
            <div class="row-body">
              <div v-for="line in item.lines" :key="line" class="row-line">
                {{ line }}
              </div>
            </div>
          </div>
        </template>
      </VirtualList>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from "vue";
  import { VirtualList } from "@wxwzl/vue-virtual-list";

  interface RowData {
    id: number;
    lines: string[];
  }

  const rowCount = ref(1_000_000);
  const estimate = ref(40);
  const jumpIndex = ref(500_000);
  const scrollTop = ref(0);
  const measuredCount = ref(0);
  const listRef = ref<InstanceType<typeof VirtualList> | null>(null);

  /** 确定性伪随机行高：1~3 行文本 */
  const getItemAt = (index: number): RowData => {
    const h = (Math.imul(index, 2654435761) >>> 0) % 3;
    const lines: string[] = [];
    for (let l = 0; l <= h; l++) {
      lines.push(
        l === 0
          ? `Row ${index.toLocaleString()} — 动态行高内容首行`
          : `第 ${l + 1} 行补充文本，把这行撑得更高`
      );
    }
    return { id: index, lines };
  };

  let metricRafId = 0;
  const onScroll = (e: Event) => {
    const st = (e.target as HTMLElement).scrollTop;
    // 指标更新按帧节流：避免每个 scroll 事件触发整页重渲染
    if (metricRafId) {
      return;
    }
    metricRafId = requestAnimationFrame(() => {
      metricRafId = 0;
      scrollTop.value = st;
      measuredCount.value = listRef.value?.getMeasuredCount() ?? 0;
    });
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
    gap: 12px;
    padding: 6px 12px;
    box-sizing: border-box;
    border-bottom: 1px solid #f2f3f5;
  }

  .row-index {
    color: #409eff;
    font-variant-numeric: tabular-nums;
    min-width: 90px;
    flex: none;
  }

  .row-body {
    flex: 1;
    min-width: 0;
  }

  .row-line {
    line-height: 20px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
