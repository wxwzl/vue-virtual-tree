<template>
  <div
    ref="containerRef"
    class="vv-list"
    :style="{ height: typeof height === 'number' ? `${height}px` : height }"
    @scroll.passive="onScroll"
  >
    <div
      class="vv-list__spacer"
      :style="{ height: `${spacerTop}px` }"
    ></div>
    <div
      v-for="i in rowIndexes"
      :key="i - range.start"
      class="vv-list__row"
      :data-index="i"
      :style="dynamic ? undefined : { height: `${itemSize}px` }"
    >
      <slot
        :item="itemAt(i)"
        :index="i"
      ></slot>
    </div>
    <div
      class="vv-list__spacer"
      :style="{ height: `${spacerBottom}px` }"
    ></div>
  </div>
</template>

<script setup lang="ts" generic="T">
  import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
  import { FixedSizeModel, MeasuredSizeModel, type SizeModel } from "./core/sizeModel";
  import { coverRange, EMPTY_RANGE, type RowRange } from "./core/range";

  /**
   * 通用虚拟列表（spacer 流式 + 边界回收 + 行池化）
   *
   * 与 transform 池化路线不同：行是普通流式内容，行内滚动完全由浏览器
   * 原生处理（每帧零 DOM 操作），仅当可见范围逃出渲染范围时才平移窗口，
   * 由上下 spacer 补偿高度，视觉零跳动。行 key 用窗口槽位号而非数据 key，
   * 窗口平移时 Vue 就地 patch 复用 DOM，避免整窗拆装。
   * 动态行高实测回写后永不回写 scrollTop：锚定补偿由 cumDelta 虚拟修正项
   * 吸收进 spacerTop 公式，滚动条拖拽全程不被干扰。
   */

  export interface VirtualListProps<T> {
    /** 数组数据源（与 itemCount + getItemAt 二选一） */
    items?: T[];
    /** 回调数据源：行数 */
    itemCount?: number;
    /** 回调数据源：按行号取数据 */
    getItemAt?: (index: number) => T;
    /** 行高（px）。固定模式为精确行高；dynamic 模式下作为未测量行的估计高度 */
    itemSize: number;
    /** 动态行高模式：行高由内容决定，渲染后经 ResizeObserver 实测回写 */
    dynamic?: boolean;
    /** 上下缓冲（px），默认 200 */
    buffer?: number;
    /** 容器高度，默认 100%（由父容器决定） */
    height?: number | string;
  }

  const props = withDefaults(defineProps<VirtualListProps<T>>(), {
    items: undefined,
    itemCount: undefined,
    getItemAt: undefined,
    dynamic: false,
    buffer: 200,
    height: "100%",
  });

  /** 单元素 DOM 高度安全上限：Firefox 约 1789 万 px，取 1600 万留余量 */
  const MAX_SPACER_PX = 16_000_000;

  const containerRef = ref<HTMLElement | null>(null);
  const viewportH = ref(0);
  /** 视口顶锚点（虚拟 px）= baseOffset + cumDelta */
  const scrollOffset = ref(0);
  /** el.scrollTop × k 的原始值（最近一次滚动同步），非响应式 */
  let baseOffset = 0;
  /** 锚定补偿累积（虚拟 px）：代替 scrollTop 回写，由 spacerTop 公式吸收 */
  const cumDelta = ref(0);
  const range = shallowRef<RowRange>(EMPTY_RANGE);
  /** model 非响应式，结构变化时 bump 触发重算 */
  const modelTick = ref(0);

  const count = computed(() => (props.items ? props.items.length : (props.itemCount ?? 0)));

  const createModel = (n: number, size: number, dyn: boolean): SizeModel =>
    dyn ? new MeasuredSizeModel(n, size) : new FixedSizeModel(n, size);

  let model: SizeModel = createModel(count.value, props.itemSize, props.dynamic);

  /** 冻结总高：滚动期间 scale 与 spacerBottom 以其为准，避免测量回写改变 scrollHeight 干扰拖拽；空闲时同步 */
  const frozenTotal = ref(model.totalSize);

  watch([count, () => props.itemSize, () => props.dynamic], ([n, size, dyn], [, prevSize]) => {
    const sameKind = dyn ? model instanceof MeasuredSizeModel : model instanceof FixedSizeModel;
    if (sameKind && size === prevSize) {
      // 仅 count 变化：保留已测量行高
      model.setCount(n);
    } else {
      model = createModel(n, size, dyn);
    }
    range.value = EMPTY_RANGE;
    modelTick.value++;
    cumDelta.value = 0;
    frozenTotal.value = model.totalSize;
    // scale 可能随 count 变化，须按新 scale 重新同步虚拟偏移
    const el = containerRef.value;
    baseOffset = el ? el.scrollTop * scale.value : 0;
    scrollOffset.value = baseOffset;
    updateRange();
  });

  /** 高度缩放因子：spacer 存 scaled 高度，scrollTop × k 还原虚拟偏移；滚动期间随 frozenTotal 冻结 */
  const scale = computed(() => {
    return Math.max(1, Math.ceil(frozenTotal.value / MAX_SPACER_PX));
  });

  const itemAt = (i: number): T => {
    return props.items ? props.items[i] : props.getItemAt!(i);
  };

  /** 渲染窗口平移：可见范围逃出当前渲染范围时才更新 */
  const updateRange = () => {
    const next = coverRange(model, scrollOffset.value, viewportH.value, props.buffer, range.value);
    if (next.start !== range.value.start || next.end !== range.value.end) {
      range.value = next;
    }
  };

  const rowIndexes = computed(() => {
    const { start, end } = range.value;
    const n = end - start + 1;
    const arr = new Array(n);
    for (let i = 0; i < n; i++) {
      arr[i] = start + i;
    }
    return arr;
  });

  /**
   * 顶部 spacer：以「视口顶精确映射」为锚。
   * 行是真实高度而 spacer 按 1/k 缩放，若 spacerTop 直接取 offset(start)/k，
   * 窗口内行会整体下移 (k-1)/k × 窗口内距离，列表末尾行将永远无法对齐。
   * 改为 offset(start) - base×(k-1)/k - cumDelta 后，DOMpos(u) = u - base×(k-1)/k - cumDelta，
   * 视口顶恰好展示虚拟行 base + cumDelta（= scrollTop×k + 锚定补偿），窗口内映射处处精确。
   * 接近顶部时钳位到 0，误差 < buffer，由渲染缓冲遮盖。
   */
  const spacerTop = computed(() => {
    void modelTick.value; // 依赖 model 结构变化
    const k = scale.value;
    const base = scrollOffset.value - cumDelta.value;
    const drift = base * ((k - 1) / k);
    return Math.max(0, model.offsetOf(range.value.start) - drift - cumDelta.value);
  });

  /** 底部 spacer：窗口之后剩余高度的 1/k 缩放，钳位到 0；滚动期间随 frozenTotal 冻结 */
  const spacerBottom = computed(() => {
    void modelTick.value;
    return Math.max(0, (frozenTotal.value - model.offsetOf(range.value.end + 1)) / scale.value);
  });

  /** 同步冻结总高：空闲 150ms 后执行；接近底部时立即执行，保证底部可达 */
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  const flushTotal = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    frozenTotal.value = model.totalSize;
    // scale 可能变化，按新 scale 重新同步基准偏移（内容不动，仅 spacerBottom 变化）
    const el = containerRef.value;
    if (el) {
      baseOffset = el.scrollTop * scale.value;
      scrollOffset.value = baseOffset + cumDelta.value;
      updateRange();
    }
  };
  const scheduleFlush = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
    }
    flushTimer = setTimeout(flushTotal, 150);
  };

  const onScroll = () => {
    const el = containerRef.value;
    if (!el) {
      return;
    }
    const next = el.scrollTop * scale.value;
    // 单帧位移超过一个视口视为快速滚动/跳转：内容整体换帧，锚定补偿清零防累积
    if (Math.abs(next - baseOffset) > viewportH.value) {
      cumDelta.value = 0;
    }
    baseOffset = next;
    scrollOffset.value = next + cumDelta.value;
    updateRange();
    if (scrollOffset.value + viewportH.value * 2 >= frozenTotal.value) {
      flushTotal();
    } else {
      scheduleFlush();
    }
  };

  let resizeObserver: ResizeObserver | null = null;
  /** 动态模式：行高实测观察器与当前被观察的行元素集合 */
  let rowObserver: ResizeObserver | null = null;
  let observedRows = new Set<HTMLElement>();

  /**
   * 行实测回写与滚动锚定补偿。
   * 视口顶以上的行变高 delta 会把视口内容整体下推 delta px，补偿
   * cumDelta += delta（由 spacerTop 公式吸收，k>1 时同样精确）；
   * 视口顶以下的行变化不影响当前视口内容，无需补偿。
   * 永不回写 scrollTop：回写会与滚动条拖拽打架，快速滚动时也无法感知修正。
   */
  const onRowResize = (entries: ResizeObserverEntry[]) => {
    let deltaAbove = 0;
    let changed = false;
    for (const entry of entries) {
      const rowEl = entry.target as HTMLElement;
      const i = Number(rowEl.dataset.index);
      if (Number.isNaN(i)) {
        continue;
      }
      const oldOffset = model.offsetOf(i);
      const delta = model.measure(i, rowEl.offsetHeight);
      if (delta === 0) {
        continue;
      }
      changed = true;
      if (oldOffset < scrollOffset.value) {
        deltaAbove += delta;
      }
    }
    if (!changed) {
      return;
    }
    cumDelta.value += deltaAbove;
    scrollOffset.value += deltaAbove;
    modelTick.value++;
    updateRange();
  };

  /**
   * 窗口平移后显式实测一遍所有渲染行：行池化下 DOM 元素复用，
   * 尺寸不变时 RO 不触发，必须主动测量，否则模型长期停留在估计值。
   */
  const measureWindow = () => {
    if (!props.dynamic || !containerRef.value) {
      return;
    }
    let deltaAbove = 0;
    let changed = false;
    containerRef.value.querySelectorAll<HTMLElement>(".vv-list__row").forEach((rowEl) => {
      const i = Number(rowEl.dataset.index);
      if (Number.isNaN(i)) {
        return;
      }
      const oldOffset = model.offsetOf(i);
      const delta = model.measure(i, rowEl.offsetHeight);
      if (delta === 0) {
        return;
      }
      changed = true;
      if (oldOffset < scrollOffset.value) {
        deltaAbove += delta;
      }
    });
    if (changed) {
      cumDelta.value += deltaAbove;
      scrollOffset.value += deltaAbove;
      modelTick.value++;
      updateRange();
    }
  };

  /** 渲染窗口变化后同步行观察：观察新行、解除移除的行 */
  const syncRowObserver = () => {
    if (!props.dynamic || !rowObserver || !containerRef.value) {
      return;
    }
    const seen = new Set<HTMLElement>();
    containerRef.value.querySelectorAll<HTMLElement>(".vv-list__row").forEach((el) => {
      seen.add(el);
      if (!observedRows.has(el)) {
        rowObserver!.observe(el);
      }
    });
    for (const el of observedRows) {
      if (!seen.has(el)) {
        rowObserver.unobserve(el);
      }
    }
    observedRows = seen;
  };

  const afterWindowShift = () => {
    measureWindow();
    syncRowObserver();
  };

  watch(range, afterWindowShift, { flush: "post" });

  onMounted(() => {
    const el = containerRef.value;
    if (!el) {
      return;
    }
    viewportH.value = el.clientHeight;
    frozenTotal.value = model.totalSize;
    baseOffset = el.scrollTop * scale.value;
    scrollOffset.value = baseOffset;
    updateRange();
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        viewportH.value = el.clientHeight;
        range.value = EMPTY_RANGE;
        updateRange();
      });
      resizeObserver.observe(el);
      if (props.dynamic) {
        rowObserver = new ResizeObserver(onRowResize);
        syncRowObserver();
      }
    }
  });

  onBeforeUnmount(() => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    resizeObserver?.disconnect();
    resizeObserver = null;
    rowObserver?.disconnect();
    rowObserver = null;
    observedRows.clear();
  });

  const scrollToIndex = (
    index: number,
    align: "start" | "center" | "end" = "start",
    offset = 0
  ) => {
    const el = containerRef.value;
    if (!el || index < 0 || index >= count.value) {
      return;
    }
    const itemOffset = model.offsetOf(index);
    const size = model.sizeOf(index);
    let target: number;
    if (align === "center") {
      target = itemOffset - (viewportH.value - size) / 2;
    } else if (align === "end") {
      target = itemOffset - viewportH.value + size;
    } else {
      target = itemOffset;
    }
    target += offset;
    flushTotal();
    // 精确映射下虚拟可滚上限即 total - 视口高，且任意位置均可达
    const maxOffset = Math.max(0, model.totalSize - viewportH.value);
    el.scrollTop = Math.min(Math.max(0, target), maxOffset) / scale.value;
    // 跳转后锚定补偿清零，以新位置为基准重新累积
    cumDelta.value = 0;
    // scroll 事件异步触发，这里同步一次保证渲染窗口立即覆盖目标位置
    baseOffset = el.scrollTop * scale.value;
    scrollOffset.value = baseOffset;
    updateRange();
  };

  const scrollTo = (offset: number) => {
    const el = containerRef.value;
    if (!el) {
      return;
    }
    cumDelta.value = 0;
    el.scrollTop = offset / scale.value;
    baseOffset = el.scrollTop * scale.value;
    scrollOffset.value = baseOffset;
    updateRange();
  };

  defineExpose({ scrollToIndex, scrollTo });
</script>

<style scoped>
  .vv-list {
    overflow-y: auto;
    position: relative;
    contain: strict;
    /* 关闭浏览器滚动锚定：spacer 大幅变化时锚定会篡改 scrollTop，定位由组件自身保证 */
    overflow-anchor: none;
  }

  .vv-list__spacer {
    flex: none;
    pointer-events: none;
  }

  .vv-list__row {
    overflow: hidden;
  }
</style>
