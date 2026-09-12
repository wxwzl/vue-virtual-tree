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
      :key="rowKey(i)"
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
   * 通用虚拟列表（spacer 流式 + 边界回收）
   *
   * 与 transform 池化路线不同：行是普通流式内容，行内滚动完全由浏览器
   * 原生处理（每帧零 DOM 操作），仅当可见范围逃出渲染范围时才平移窗口，
   * 由上下 spacer 补偿高度，视觉零跳动。
   */

  export interface VirtualListProps<T> {
    /** 数组数据源（与 itemCount + getItemAt 二选一） */
    items?: T[];
    /** 回调数据源：行数 */
    itemCount?: number;
    /** 回调数据源：按行号取数据 */
    getItemAt?: (index: number) => T;
    /** 行 key，默认用行号（数据顺移时会全量重渲染，建议提供） */
    getKey?: (item: T, index: number) => string | number;
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
    getKey: undefined,
    dynamic: false,
    buffer: 200,
    height: "100%",
  });

  /** 单元素 DOM 高度安全上限：Firefox 约 1789 万 px，取 1600 万留余量 */
  const MAX_SPACER_PX = 16_000_000;

  const containerRef = ref<HTMLElement | null>(null);
  const viewportH = ref(0);
  /** 虚拟滚动偏移（未缩放 px） */
  const scrollOffset = ref(0);
  const range = shallowRef<RowRange>(EMPTY_RANGE);
  /** model 非响应式，结构变化时 bump 触发重算 */
  const modelTick = ref(0);

  const count = computed(() => (props.items ? props.items.length : (props.itemCount ?? 0)));

  const createModel = (n: number, size: number, dyn: boolean): SizeModel =>
    dyn ? new MeasuredSizeModel(n, size) : new FixedSizeModel(n, size);

  let model: SizeModel = createModel(count.value, props.itemSize, props.dynamic);

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
    // scale 可能随 count 变化，须按新 scale 重新同步虚拟偏移
    const el = containerRef.value;
    scrollOffset.value = el ? el.scrollTop * scale.value : 0;
    updateRange();
  });

  /** 高度缩放因子：spacer 存 scaled 高度，scrollTop × k 还原虚拟偏移 */
  const scale = computed(() => {
    void modelTick.value; // 依赖 model 结构变化
    return Math.max(1, Math.ceil(model.totalSize / MAX_SPACER_PX));
  });

  const itemAt = (i: number): T => {
    return props.items ? props.items[i] : props.getItemAt!(i);
  };

  const rowKey = (i: number): string | number => {
    return props.getKey ? props.getKey(itemAt(i), i) : i;
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
   * 改为 offset(start) - scrollOffset×(k-1)/k 后，DOMpos(u) = u - scrollOffset×(k-1)/k，
   * 视口顶恰好展示虚拟行 scrollOffset（= scrollTop×k），窗口内映射处处精确。
   * 接近顶部时钳位到 0，误差 < buffer，由渲染缓冲遮盖。
   */
  const spacerTop = computed(() => {
    void modelTick.value; // 依赖 model 结构变化
    const k = scale.value;
    const drift = scrollOffset.value * ((k - 1) / k);
    return Math.max(0, model.offsetOf(range.value.start) - drift);
  });

  /** 底部 spacer：窗口之后剩余高度的 1/k 缩放，钳位到 0 */
  const spacerBottom = computed(() => {
    void modelTick.value;
    return Math.max(0, (model.totalSize - model.offsetOf(range.value.end + 1)) / scale.value);
  });

  const onScroll = () => {
    const el = containerRef.value;
    if (!el) {
      return;
    }
    scrollOffset.value = el.scrollTop * scale.value;
    updateRange();
  };

  let resizeObserver: ResizeObserver | null = null;
  /** 动态模式：行高实测观察器与当前被观察的行元素集合 */
  let rowObserver: ResizeObserver | null = null;
  let observedRows = new Set<HTMLElement>();

  /**
   * 行实测回写与滚动锚定补偿。
   * 视口顶以上的行变高 delta 会把视口内容整体下推 delta px，补偿
   * scrollOffset += delta（配合 spacerTop 的 drift 重算，k>1 时同样精确）；
   * 视口顶以下的行变化不影响当前视口内容，无需补偿。
   */
  const onRowResize = (entries: ResizeObserverEntry[]) => {
    const el = containerRef.value;
    if (!el) {
      return;
    }
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
    const k = scale.value;
    modelTick.value++;
    if (deltaAbove !== 0) {
      scrollOffset.value += deltaAbove;
      el.scrollTop = scrollOffset.value / k;
    }
    updateRange();
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

  watch(range, syncRowObserver, { flush: "post" });

  onMounted(() => {
    const el = containerRef.value;
    if (!el) {
      return;
    }
    viewportH.value = el.clientHeight;
    scrollOffset.value = el.scrollTop * scale.value;
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
    // 精确映射下虚拟可滚上限即 total - 视口高，且任意位置均可达
    const maxOffset = Math.max(0, model.totalSize - viewportH.value);
    el.scrollTop = Math.min(Math.max(0, target), maxOffset) / scale.value;
    // scroll 事件异步触发，这里同步一次保证渲染窗口立即覆盖目标位置
    scrollOffset.value = el.scrollTop * scale.value;
    updateRange();
  };

  const scrollTo = (offset: number) => {
    const el = containerRef.value;
    if (el) {
      el.scrollTop = offset / scale.value;
    }
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
