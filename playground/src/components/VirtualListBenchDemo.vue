<template>
  <div class="demo-section">
    <h2>虚拟列表基准对比：自研 spacer 流式 vs RecycleScroller</h2>
    <div class="control-panel">
      <label>
        行数：
        <select v-model.number="rowCount">
          <option :value="100000">10 万</option>
          <option :value="1000000">100 万</option>
        </select>
      </label>
      <label>
        单帧滚动距离：
        <select v-model.number="stepPx">
          <option :value="100">100 px（普通快速滚动）</option>
          <option :value="800">800 px（甩动）</option>
          <option :value="4000">4000 px（疯狂甩动）</option>
        </select>
      </label>
      <button class="btn" :disabled="running" @click="runBench">
        {{ running ? "压测中..." : "开始压测（两侧各扫一遍全量行程）" }}
      </button>
    </div>
    <p class="tip">
      压测方式：rAF 驱动每帧滚动固定距离，从顶部扫过 32 万 px（1 万行），统计帧率/掉帧/长任务/DOM
      节点数/堆增量。两侧行 DOM 结构完全一致，仅虚拟化实现不同。
    </p>
    <div class="panes">
      <div class="pane">
        <h3>自研 VirtualList（spacer 流式）</h3>
        <div class="list-shell">
          <VirtualList
            ref="oursRef"
            :item-count="rowCount"
            :get-item-at="getItemAt"
            :item-size="32"
            :buffer="300"
            height="100%"
          >
            <template #default="{ item, index }">
              <BenchRow :item="item" :index="index" />
            </template>
          </VirtualList>
        </div>
        <pre class="result">{{ resultOurs || "（未压测）" }}</pre>
      </div>
      <div class="pane">
        <h3>RecycleScroller（transform 池化）</h3>
        <div class="list-shell">
          <RecycleScroller
            ref="theirsRef"
            class="bench-scroller"
            :items="items"
            :item-size="32"
            :buffer="300"
            key-field="id"
          >
            <template #default="{ item, index }">
              <BenchRow :item="item" :index="index" />
            </template>
          </RecycleScroller>
        </div>
        <pre class="result">{{ resultTheirs || "（未压测）" }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, h, ref, shallowRef, watch, type FunctionalComponent } from "vue";
  import { VirtualList } from "@wxwzl/vue-virtual-list";
  import { RecycleScroller } from "vue-virtual-scroller";
  import "vue-virtual-scroller/dist/vue-virtual-scroller.css";

  interface RowData {
    id: number;
    label: string;
    meta: string;
  }

  // 两侧完全一致的行内容
  const BenchRow: FunctionalComponent<{ item: RowData; index: number }> = (props) =>
    h("div", { class: "bench-row" }, [
      h("span", { class: "bench-row__index" }, `#${props.index.toLocaleString()}`),
      h("span", { class: "bench-row__label" }, props.item.label),
      h("span", { class: "bench-row__meta" }, props.item.meta),
    ]);

  const rowCount = ref(1_000_000);
  const stepPx = ref(800);
  const running = ref(false);
  const resultOurs = ref("");
  const resultTheirs = ref("");
  const oursRef = ref<InstanceType<typeof VirtualList> | null>(null);
  const theirsRef = ref<InstanceType<typeof RecycleScroller> | null>(null);

  // RecycleScroller 必须物化数组；自研侧用回调源零内存占用（差异本身也是对比点）
  // shallowRef：100 万行数组不需要深层响应式代理（只整体替换，从不原地修改）
  const items = shallowRef<RowData[]>([]);
  // 注意：行标签不能用 toLocaleString——百万次 Intl 格式化约 9s，整页卡死；
  // 千分位只留在渲染侧（可见行才格式化，每屏仅几十次）
  const genItems = (n: number) => {
    const arr = new Array<RowData>(n);
    for (let i = 0; i < n; i++) {
      arr[i] = { id: i, label: `Row ${i} — 基准对比行内容`, meta: `${i * 32} px` };
    }
    return arr;
  };
  watch(
    rowCount,
    (n) => {
      items.value = genItems(n);
      resultOurs.value = "";
      resultTheirs.value = "";
    },
    { immediate: true }
  );

  const getItemAt = (index: number): RowData => items.value[index];

  interface BenchResult {
    frames: number;
    fps: string;
    jankCount: number;
    jankRatio: string;
    longTasks: number;
    longTaskTotal: string;
    domNodes: number;
    heapDeltaMB: string;
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** rAF 驱动滚动固定行程，统计帧指标 */
  const sweep = async (el: HTMLElement): Promise<BenchResult> => {
    const max = el.scrollHeight - el.clientHeight;
    const step = stepPx.value;
    // 固定行程 32 万 px（1 万行），保证两侧对比公平且耗时可控
    const trip = Math.min(max, 320_000);
    const longTasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        longTasks.push(e.duration);
      }
    });
    observer.observe({ entryTypes: ["longtask"] });

    const heapBefore = (performance as any).memory?.usedJSHeapSize ?? 0;
    const frameTimes: number[] = [];
    let last = performance.now();

    el.scrollTop = 0;
    await sleep(100);

    await new Promise<void>((resolve) => {
      const tick = () => {
        const now = performance.now();
        frameTimes.push(now - last);
        last = now;
        if (el.scrollTop >= Math.min(max - 1, trip)) {
          resolve();
          return;
        }
        el.scrollTop = Math.min(max, el.scrollTop + step);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await sleep(100);
    observer.disconnect();

    const heapAfter = (performance as any).memory?.usedJSHeapSize ?? 0;
    const total = frameTimes.reduce((a, b) => a + b, 0);
    const jank = frameTimes.filter((t) => t > 32).length;
    return {
      frames: frameTimes.length,
      fps: (frameTimes.length / (total / 1000)).toFixed(1),
      jankCount: jank,
      jankRatio: ((jank / frameTimes.length) * 100).toFixed(1) + "%",
      longTasks: longTasks.length,
      longTaskTotal: longTasks.reduce((a, b) => a + b, 0).toFixed(0) + " ms",
      domNodes: el.querySelectorAll("*").length,
      heapDeltaMB: ((heapAfter - heapBefore) / 1048576).toFixed(1),
    };
  };

  const fmt = (r: BenchResult) =>
    [
      `帧数：${r.frames}　平均 FPS：${r.fps}`,
      `掉帧(>32ms)：${r.jankCount}（${r.jankRatio}）`,
      `长任务：${r.longTasks} 个 / 共 ${r.longTaskTotal}`,
      `DOM 节点数：${r.domNodes}`,
      `堆增量：${r.heapDeltaMB} MB`,
    ].join("\n");

  const oursEl = computed(() => oursRef.value?.$el as HTMLElement | undefined);
  const theirsEl = computed(() => {
    const root = theirsRef.value?.$el as HTMLElement | undefined;
    // RecycleScroller 的滚动容器是自身
    return root;
  });

  const runBench = async () => {
    running.value = true;
    resultOurs.value = "压测中...";
    await sleep(100);
    const rOurs = await sweep(oursEl.value!);
    resultOurs.value = fmt(rOurs);
    resultTheirs.value = "压测中...";
    await sleep(300);
    const rTheirs = await sweep(theirsEl.value!);
    resultTheirs.value = fmt(rTheirs);
    running.value = false;
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

  .tip {
    color: #909399;
    font-size: 12px;
    margin: 0 0 8px;
  }

  .panes {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 12px;
  }

  .pane {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;

    h3 {
      margin: 0 0 6px;
      font-size: 14px;
    }
  }

  .list-shell {
    flex: 1;
    min-height: 0;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    overflow: hidden;
  }

  .bench-scroller {
    height: 100%;
  }

  .result {
    margin: 6px 0 0;
    padding: 8px;
    background: #f5f7fa;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.7;
    color: #606266;
    min-height: 96px;
    white-space: pre-wrap;
  }

  :deep(.bench-row) {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 32px;
    padding: 0 12px;
    box-sizing: border-box;
    border-bottom: 1px solid #f2f3f5;
    white-space: nowrap;
    overflow: hidden;
  }

  :deep(.bench-row__index) {
    color: #409eff;
    font-variant-numeric: tabular-nums;
    min-width: 90px;
  }

  :deep(.bench-row__label) {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :deep(.bench-row__meta) {
    color: #c0c4cc;
    font-size: 12px;
  }
</style>
