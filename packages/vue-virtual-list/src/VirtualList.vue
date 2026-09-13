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
    <div
      v-if="dynamic"
      ref="measureRef"
      class="vv-list__measure"
      aria-hidden="true"
    >
      <div
        v-for="i in measureQueue"
        :key="i"
        class="vv-list__row"
        :data-index="i"
      >
        <slot
          :item="itemAt(i)"
          :index="i"
        ></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
  import { FixedSizeModel, MeasuredSizeModel, type SizeModel } from "./core/sizeModel";
  import { coverRange, EMPTY_RANGE, type RowRange } from "./core/range";

  /**
   * 通用虚拟列表（spacer 流式 + 边界回收 + 行池化 + 隐藏预测量）
   *
   * 与 transform 池化路线不同：行是普通流式内容，行内滚动完全由浏览器
   * 原生处理（每帧零 DOM 操作），仅当可见范围逃出渲染范围时才平移窗口，
   * 由上下 spacer 补偿高度，视觉零跳动。行 key 用窗口槽位号而非数据 key，
   * 窗口平移时 Vue 就地 patch 复用 DOM，避免整窗拆装。
   * 动态行高由隐藏预测量通道在滚动前提前实测并缓存（前瞻窗口 + 空闲向外扩散，
   * 未测行用自适应均值），可见路径几乎不再产生测量回写；少量逃逸行与内容
   * 异步变化的补偿永不回写 scrollTop，由 cumDelta 虚拟修正项吸收进
   * spacerTop 公式，滚动条拖拽全程不被干扰。
   * 注意：动态模式下插槽内容会在隐藏通道额外渲染一份（限速、不可见），
   * 插槽内不应依赖可见性或产生副作用。
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

  /** 冻结总高：滚动期间 scale 以其为准；空闲时同步 */
  const frozenTotal = ref(model.totalSize);
  /** 冻结渲染总跨度（DOM px）：两次 flush 之间 spacerBottom 吸收一切变化，scrollHeight 恒定，滚动条拇指不漂移 */
  const frozenSpan = ref(0);

  /** 按当前模型重算 frozenSpan（= spacerTop + 渲染行高 + 旧公式 spacerBottom，flush 时刻前后连续） */
  const updateFrozenSpan = () => {
    const k = scale.value;
    const base = scrollOffset.value - cumDelta.value;
    const top = Math.max(
      0,
      model.offsetOf(range.value.start) - base * ((k - 1) / k) - cumDelta.value
    );
    const rendered = model.offsetOf(range.value.end + 1) - model.offsetOf(range.value.start);
    const bottom = Math.max(0, (frozenTotal.value - model.offsetOf(range.value.end + 1)) / k);
    frozenSpan.value = top + rendered + bottom;
  };

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
    // 数据源变化：清空预测量队列并重建抽样种子，前沿由 range watch 重置
    measureQueue.value = [];
    buildSeeds(n);
    // scale 可能随 count 变化，须按新 scale 重新同步虚拟偏移
    const el = containerRef.value;
    baseOffset = el ? el.scrollTop * scale.value : 0;
    scrollOffset.value = baseOffset;
    updateRange();
    updateFrozenSpan();
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

  /**
   * 底部 spacer = frozenSpan − spacerTop − 渲染行高（模型估值）。
   * 两次 flush 之间 scrollHeight 恒定：spacerTop 随滚动/锚定补偿逐帧变化、
   * 测量回写改变模型偏移，全部被本式吸收，滚动条拇指不漂移；
   * 仅 flush 时 frozenSpan 步进一次（空闲 150ms 后或近底立即）。
   */
  const spacerBottom = computed(() => {
    void modelTick.value;
    const rendered = model.offsetOf(range.value.end + 1) - model.offsetOf(range.value.start);
    return Math.max(0, frozenSpan.value - spacerTop.value - rendered);
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
    updateFrozenSpan();
  };
  const scheduleFlush = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
    }
    flushTimer = setTimeout(flushTotal, 150);
  };

  /** 最近一次滚动时间（决定预测量批次大小）与快速滚动暂停窗口 */
  let lastScrollAt = 0;
  let pauseMeasureUntil = 0;

  const onScroll = () => {
    const el = containerRef.value;
    if (!el) {
      return;
    }
    lastScrollAt = performance.now();
    const next = el.scrollTop * scale.value;
    // 单帧位移超过一个视口视为快速滚动/跳转：内容整体换帧，锚定补偿清零防累积；
    // 同时暂停预测量，把主线程让给滚动帧
    if (Math.abs(next - baseOffset) > viewportH.value) {
      cumDelta.value = 0;
      pauseMeasureUntil = lastScrollAt + 200;
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
  /** 容器内容宽度：变化时动态模式的实测缓存全部失效 */
  let lastWidth = 0;
  /** 动态模式：行高实测观察器与当前被观察的行元素集合 */
  let rowObserver: ResizeObserver | null = null;
  let observedRows = new Set<HTMLElement>();

  /**
   * 批量回写实测高度并做锚定补偿。
   * 补偿量 = 锚点所在行顶部在测量前后的偏移差（精确含行 delta 与均值漂移），
   * 并入 cumDelta 由 spacerTop 公式吸收，永不回写 scrollTop。
   */
  const applyMeasurements = (list: Array<{ index: number; size: number }>) => {
    if (!list.length || !props.dynamic) {
      return;
    }
    const m = model as MeasuredSizeModel;
    const beforeCount = m.measuredCount;
    const anchorRow = m.indexAt(scrollOffset.value);
    const offBefore = m.offsetOf(anchorRow);
    let changed = false;
    for (const { index, size } of list) {
      if (m.measure(index, size) !== 0) {
        changed = true;
      }
    }
    if (!changed && m.measuredCount === beforeCount) {
      return;
    }
    const deltaAbove = m.offsetOf(anchorRow) - offBefore;
    cumDelta.value += deltaAbove;
    scrollOffset.value += deltaAbove;
    modelTick.value++;
    updateRange();
  };

  /** RO 兜底：可见行内容异步变化（图片加载等）时的尺寸回写 */
  const onRowResize = (entries: ResizeObserverEntry[]) => {
    const list: Array<{ index: number; size: number }> = [];
    for (const entry of entries) {
      const rowEl = entry.target as HTMLElement;
      const i = Number(rowEl.dataset.index);
      if (!Number.isNaN(i)) {
        list.push({ index: i, size: rowEl.offsetHeight });
      }
    }
    applyMeasurements(list);
  };

  /**
   * 窗口平移后的兜底补测：行池化下 DOM 元素复用，尺寸不变时 RO 不触发。
   * 已被预测量通道缓存的行直接跳过（滚动关键路径零强制重排）；
   * 快速滚动帧整段跳过，让位给滚动。
   */
  const measureWindow = () => {
    if (!props.dynamic || !containerRef.value) {
      return;
    }
    if (performance.now() < pauseMeasureUntil) {
      return;
    }
    const list: Array<{ index: number; size: number }> = [];
    containerRef.value.querySelectorAll<HTMLElement>(":scope > .vv-list__row").forEach((rowEl) => {
      const i = Number(rowEl.dataset.index);
      if (Number.isNaN(i) || model.isMeasured(i)) {
        return;
      }
      list.push({ index: i, size: rowEl.offsetHeight });
    });
    applyMeasurements(list);
  };

  /** 渲染窗口变化后同步行观察：观察新行、解除移除的行（:scope 限定可见行，排除测量通道） */
  const syncRowObserver = () => {
    if (!props.dynamic || !rowObserver || !containerRef.value) {
      return;
    }
    const seen = new Set<HTMLElement>();
    containerRef.value.querySelectorAll<HTMLElement>(":scope > .vv-list__row").forEach((el) => {
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

  /** 隐藏预测量：当前批次待渲染测量的行号 */
  const measureQueue = ref<number[]>([]);
  const measureRef = ref<HTMLElement | null>(null);
  /** 预测量双前沿：围绕当前渲染窗口向外扩散 */
  let frontAbove = -1;
  let frontBelow = 0;
  let measureRafId = 0;
  let measureTimer: ReturnType<typeof setTimeout> | null = null;
  /** 空闲批次 / 滚动中批次 */
  const IDLE_BATCH = 24;
  const SCROLL_BATCH = 8;

  /**
   * 全局均匀抽样种子：数据就绪后先抽样测量（~256 行均布），
   * avg 约 0.2s 内收敛到真实均值，总高尽早算准、scrollHeight 一次到位，
   * 避免局部扩散期间滚动条拇指长时间漂移
   */
  let seedIndexes: number[] = [];
  let seedCursor = 0;
  let seedFlushed = true;
  const SEED_SAMPLES = 256;
  const buildSeeds = (n: number) => {
    seedIndexes = [];
    seedCursor = 0;
    seedFlushed = true;
    if (!props.dynamic || n <= 0) {
      return;
    }
    const stride = n / SEED_SAMPLES;
    for (let s = 0; s < SEED_SAMPLES; s++) {
      seedIndexes.push(Math.floor(s * stride));
    }
    seedFlushed = false;
  };

  /** 取一批待测行号：抽样种子优先，其次下方（滚动前进方向）为主约 2:1；已测行跳过 */
  const pickBatch = (size: number): number[] => {
    const m = model as MeasuredSizeModel;
    const n = count.value;
    const out: number[] = [];
    while (out.length < size && seedCursor < seedIndexes.length) {
      const i = seedIndexes[seedCursor++];
      if (i < n && !m.isMeasured(i)) {
        out.push(i);
      }
    }
    let picked = 0;
    while (out.length < size) {
      while (frontBelow < n && m.isMeasured(frontBelow)) {
        frontBelow++;
      }
      while (frontAbove >= 0 && m.isMeasured(frontAbove)) {
        frontAbove--;
      }
      const canBelow = frontBelow < n;
      const canAbove = frontAbove >= 0;
      if (!canBelow && !canAbove) {
        break;
      }
      if (picked % 3 === 2 && canAbove) {
        out.push(frontAbove--);
      } else if (canBelow) {
        out.push(frontBelow++);
      } else {
        out.push(frontAbove--);
      }
      picked++;
    }
    return out;
  };

  const scheduleMeasure = () => {
    if (!props.dynamic || measureRafId || measureTimer) {
      return;
    }
    measureRafId = requestAnimationFrame(stepMeasure);
  };

  /** rAF 时间片：渲染一批隐藏行 → 一次性读高度 → 批量回写（每批至多一次排版） */
  const stepMeasure = () => {
    measureRafId = 0;
    const lane = measureRef.value;
    if (!props.dynamic || !lane) {
      return;
    }
    const now = performance.now();
    if (now < pauseMeasureUntil) {
      // 快速滚动期间暂停，稍后重试
      measureTimer = setTimeout(() => {
        measureTimer = null;
        scheduleMeasure();
      }, 200);
      return;
    }
    const batch = pickBatch(now - lastScrollAt < 100 ? SCROLL_BATCH : IDLE_BATCH);
    if (batch.length === 0) {
      return; // 缓存已覆盖全部行，休眠（range/数据变化时唤醒）
    }
    measureQueue.value = batch;
    void nextTick(() => {
      const list: Array<{ index: number; size: number }> = [];
      for (const rowEl of Array.from(lane.children)) {
        const el = rowEl as HTMLElement;
        const i = Number(el.dataset.index);
        if (!Number.isNaN(i)) {
          list.push({ index: i, size: el.offsetHeight });
        }
      }
      applyMeasurements(list);
      if (!seedFlushed && seedCursor >= seedIndexes.length) {
        // 抽样完成：avg 已收敛，立即 flush 一次让 scrollHeight 到位
        seedFlushed = true;
        flushTotal();
      } else if (
        performance.now() - lastScrollAt > 300 &&
        Math.abs(model.totalSize - frozenTotal.value) >
          Math.max(frozenTotal.value * 0.005, viewportH.value * 2)
      ) {
        // 空闲扩散期间总高漂移超阈值时步进同步（滚动期间绝不 flush）
        flushTotal();
      }
      scheduleMeasure();
    });
  };

  const afterWindowShift = () => {
    measureWindow();
    syncRowObserver();
    // 窗口平移后重置预测量前沿并唤醒调度器
    frontAbove = range.value.start - 1;
    frontBelow = range.value.end + 1;
    scheduleMeasure();
  };

  watch(range, afterWindowShift, { flush: "post" });

  onMounted(() => {
    const el = containerRef.value;
    if (!el) {
      return;
    }
    viewportH.value = el.clientHeight;
    lastWidth = el.clientWidth;
    frozenTotal.value = model.totalSize;
    baseOffset = el.scrollTop * scale.value;
    scrollOffset.value = baseOffset;
    updateRange();
    updateFrozenSpan();
    if (props.dynamic) {
      buildSeeds(count.value);
    }
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        viewportH.value = el.clientHeight;
        if (props.dynamic && lastWidth && el.clientWidth !== lastWidth) {
          // 宽度变化 => 已测高度全部失效，清缓存重测
          (model as MeasuredSizeModel).invalidateAll();
          modelTick.value++;
        }
        lastWidth = el.clientWidth;
        range.value = EMPTY_RANGE;
        updateRange();
      });
      resizeObserver.observe(el);
      if (props.dynamic) {
        rowObserver = new ResizeObserver(onRowResize);
        syncRowObserver();
        frontAbove = range.value.start - 1;
        frontBelow = range.value.end + 1;
        scheduleMeasure();
      }
    }
  });

  onBeforeUnmount(() => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (measureRafId) {
      cancelAnimationFrame(measureRafId);
      measureRafId = 0;
    }
    if (measureTimer) {
      clearTimeout(measureTimer);
      measureTimer = null;
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
    const clamped = Math.min(Math.max(0, target), maxOffset);
    // 跳转后锚定补偿清零，以新位置为基准重新累积
    cumDelta.value = 0;
    // scroll 事件异步触发，这里同步一次保证渲染窗口立即覆盖目标位置
    baseOffset = clamped;
    scrollOffset.value = clamped;
    updateRange();
    // flushTotal 刚更新 frozenTotal，spacer 的 DOM 高度要等 Vue 刷新后才生效；
    // 立即写 scrollTop 可能被旧 scrollHeight 钳位（跳底部时差最后一截），延到刷新后写入
    void nextTick(() => {
      el.scrollTop = clamped / scale.value;
    });
  };

  const scrollTo = (offset: number) => {
    const el = containerRef.value;
    if (!el) {
      return;
    }
    cumDelta.value = 0;
    baseOffset = offset;
    scrollOffset.value = offset;
    updateRange();
    void nextTick(() => {
      el.scrollTop = offset / scale.value;
    });
  };

  /** 已实测缓存的行数（动态模式为缓存进度指标） */
  const getMeasuredCount = () => model.measuredCount;

  defineExpose({ scrollToIndex, scrollTo, getMeasuredCount });
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

  /*
   * 隐藏预测量通道：脱离文档流且 0 高 + contain，内部行正常排版但
   * 不影响 scrollHeight；宽度与可见行一致（同容器 content box），
   * 保证测得的高度与真实渲染一致。
   */
  .vv-list__measure {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 0;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
    contain: strict;
  }
</style>
