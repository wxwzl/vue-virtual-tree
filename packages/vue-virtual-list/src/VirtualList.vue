<template>
  <div
    ref="containerRef"
    class="vv-list"
    :style="{ height: typeof height === 'number' ? `${height}px` : height }"
    @scroll.passive="onScroll"
  >
    <!-- spacer 高度不经响应式渲染：scrollOffset/cumDelta 每个滚动事件都变，
         绑定式更新会让整棵行 vnode 树每事件重建（占滚动帧耗时大头）。
         改为静态节点 + 命令式 style 写入，组件仅在 range/测量批次变化时重渲染 -->
    <div
      ref="spacerTopEl"
      class="vv-list__spacer"
    ></div>
    <!-- rowMemo：行号 key + 按行号缓存 vnode，窗口平移时未变行复用同一 vnode
         对象（Vue 对相同引用直接跳过 patch，连插槽都不再调用），仅进出窗口的
         行挂载/卸载；插槽依赖 items[i] 之外的外部状态时不要开启。
         默认槽位 key 池化：DOM 全复用但每行内容随平移就地重渲染 -->
    <MemoRows v-if="rowMemo" />
    <template v-else>
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
    </template>
    <div
      ref="spacerBottomEl"
      class="vv-list__spacer"
    ></div>
    <!-- 预测量通道独立成子组件：批次队列每帧变化，隔离后其重渲染不再
         连带重建上方可见行的 vnode 树 -->
    <MeasureLane v-if="dynamic" />
  </div>
</template>

<script setup lang="ts" generic="T">
  import {
    computed,
    defineComponent,
    h,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    shallowRef,
    useSlots,
    watch,
    type VNode,
  } from "vue";
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
    /**
     * 行内容缓存：开启后行仅在「行号或 items[i] 引用变化」时重渲染，
     * 窗口平移时未变行完全跳过 slot 调用与 patch（滚动帧耗时大头）。
     * 注意：插槽内容若依赖 items[i] 之外的外部状态（如选中态、拖拽态），
     * 不要开启——那些变化不会触发重渲染
     */
    rowMemo?: boolean;
    /** 容器高度，默认 100%（由父容器决定） */
    height?: number | string;
  }

  const props = withDefaults(defineProps<VirtualListProps<T>>(), {
    items: undefined,
    itemCount: undefined,
    getItemAt: undefined,
    dynamic: false,
    buffer: 200,
    rowMemo: false,
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
    rowVNodeCache.clear();
    buildSeeds(n);
    // scale 可能随 count 变化，须按新 scale 重新同步虚拟偏移
    const el = containerRef.value;
    baseOffset = el ? el.scrollTop * scale.value : 0;
    scrollOffset.value = baseOffset;
    updateRange();
    updateFrozenSpan();
  });

  // items 数组身份变化（等长替换也算）：缓存的行 vnode 内容可能已过期，全部作废
  watch(
    () => props.items,
    () => {
      rowVNodeCache.clear();
    }
  );

  /** 高度缩放因子：spacer 存 scaled 高度，scrollTop × k 还原虚拟偏移；滚动期间随 frozenTotal 冻结 */
  const scale = computed(() => {
    return Math.max(1, Math.ceil(frozenTotal.value / MAX_SPACER_PX));
  });

  const itemAt = (i: number): T => {
    return props.items ? props.items[i] : props.getItemAt!(i);
  };

  /**
   * 滚动速度 EMA（虚拟 px/事件）。k 缩放会把 DOM 位移放大 k 倍（如 1M 行 k=4，
   * DOM 滚 120px/帧 = 虚拟 480px/帧），固定 buffer 一帧即被耗尽、窗口帧帧平移；
   * 用速度自适应 buffer 让窗口余量覆盖约 3 帧位移，上限 4 个视口
   */
  let velEma = 0;
  const effBuffer = (): number => {
    // 固定/动态模式都需要速度自适应：scroll 事件异步，窗口天然滞后一帧，
    // 位移超过固定 buffer（如压测 800px/帧 > 300px）时视口底边会露出空白带
    const cap = Math.max(viewportH.value * 4, props.buffer);
    return Math.min(Math.max(props.buffer, velEma * 3), cap);
  };

  /** 渲染窗口平移：可见范围逃出当前渲染范围时才更新；strict 见 coverRange */
  const updateRange = (strict = false, lead = 0) => {
    const next = coverRange(
      model,
      // lead：按当前速度向滚动方向预见一帧位移——scroll 事件异步，DOM 总比
      // 滚动位置滞后一帧，仅覆盖当前位置会让视口边缘在逃出帧露出空白条
      scrollOffset.value + lead,
      // 视口兜底：容器暂不可测（0 高，如挂载初期/隐藏容器/无布局环境）时
      // 至少渲染一行高度 + buffer，避免完全空白；RO 就位后按真实视口重算
      Math.max(viewportH.value, props.itemSize),
      effBuffer(),
      range.value,
      strict
    );
    // 近底吸附期间浏览器锚定的是内容末尾，渲染窗口必须覆盖到末行，
    // 否则虚拟锚点与估计总高的残差会让底部出现一段空白 spacer
    if (
      stickToBottom &&
      next.end >= 0 &&
      next.end < count.value - 1 &&
      scrollOffset.value + viewportH.value >= model.totalSize - viewportH.value
    ) {
      range.value = { start: next.start, end: count.value - 1 };
      return;
    }
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

  /**
   * spacer 高度命令式写入（不经响应式渲染）。
   * spacerTop 每个滚动事件都变，若走模板绑定，组件每次都要重建整棵行
   * vnode 树再 patch——这是滚动帧耗时大头；静态节点 + 直接写 style 后，
   * 组件仅在 range / 测量批次变化时重渲染。post flush 批量合并同一帧的
   * 多次变化，绘制前生效，视觉与绑定式一致。
   */
  const spacerTopEl = ref<HTMLElement | null>(null);
  const spacerBottomEl = ref<HTMLElement | null>(null);
  const applySpacers = () => {
    if (spacerTopEl.value) {
      spacerTopEl.value.style.height = `${spacerTop.value}px`;
    }
    if (spacerBottomEl.value) {
      spacerBottomEl.value.style.height = `${spacerBottom.value}px`;
    }
  };
  watch([spacerTop, spacerBottom], applySpacers, { flush: "post" });

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
    stickBottomIfNeeded();
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
    const next = el.scrollTop * scale.value;
    // 吸附写入（贴底位置维护）产生的 scroll 事件不视为用户滚动：跳过快速滚动重置
    // 与滚动时间戳更新，否则 cumDelta 清零改变几何 → scrollHeight 变化 → 再次吸附，
    // 且吸附事件反复刷新 lastScrollAt 会让空闲调度（预测量提速/flush 防抖）永远失效
    const selfSnap = snappingToBottom && Math.abs(el.scrollTop - lastSnapTarget) <= 1;
    snappingToBottom = false;
    if (selfSnap) {
      baseOffset = next;
      // 贴底期间 scrollOffset 钉在模型底部而非由 scrollTop 反推（frozenTotal 滞后
      // 于 totalSize，反推值漂移后 updateRange 的贴底强制末行条件会失效）
      scrollOffset.value = Math.max(0, model.totalSize - viewportH.value);
      updateRange();
      stickToBottom = el.scrollHeight - el.clientHeight - el.scrollTop <= 4;
      return;
    }
    lastScrollAt = performance.now();
    // 滚动方向（供窗口预见一帧位移的方向）
    const dir = next > baseOffset ? 1 : next < baseOffset ? -1 : 0;
    // 滚动速度 EMA：供 effBuffer 自适应窗口余量（先于 baseOffset 更新取样）
    velEma = velEma * 0.6 + Math.abs(next - baseOffset) * 0.4;
    // 单帧位移超过一个视口视为快速滚动/跳转：内容整体换帧，锚定补偿清零防累积；
    // 同时暂停预测量，把主线程让给滚动帧
    if (Math.abs(next - baseOffset) > viewportH.value) {
      cumDelta.value = 0;
      pauseMeasureUntil = lastScrollAt + 200;
    }
    baseOffset = next;
    scrollOffset.value = next + cumDelta.value;
    updateRange(false, dir * Math.min(velEma, viewportH.value));
    // 近底吸附标记：仅在 scroll 事件里维护（scrollHeight 增长不触发事件，不会误置位）
    const wasStuck = stickToBottom;
    stickToBottom = el.scrollHeight - el.clientHeight - el.scrollTop <= 4;
    if (!wasStuck && stickToBottom) {
      // 刚贴底：flush 一次让 spacerBottom 归零（否则底部露出空白 spacer），
      // 随后预测量暂停（stepMeasure 检查 stickToBottom），几何完全静止
      flushTotal();
      return;
    }
    // 贴底后预测量仍在回写，totalSize 每批抖动 ±数百 px；若每个滚动事件都 flush，
    // scrollHeight 跟随抖动并与吸附互激。漂移超过两个视口才 flush（贴底时吸附会
    // 吸收误差，精度让位于稳定）；未贴底的近底滚动维持即时 flush 保证底部可达。
    if (scrollOffset.value + viewportH.value * 2 >= frozenTotal.value) {
      if (!stickToBottom || Math.abs(model.totalSize - frozenTotal.value) > viewportH.value * 2) {
        flushTotal();
      }
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
    // 贴底期间不做锚定补偿（补偿只扰动 spacerTop，与吸附互激成限幅振荡），
    // 但 scrollOffset 必须钉在底部（totalSize − 视口），否则 totalSize 漂移后
    // updateRange 的贴底强制末行条件失效，窗口萎缩导致底部露白
    if (stickToBottom) {
      scrollOffset.value = Math.max(0, m.totalSize - viewportH.value);
      // 贴底前的在途批次可能在 engage-flush 之后才回写，frozenTotal 过期会让
      // spacerBottom = (frozenTotal − totalSize)/k 常驻为底部空白；同步后再冻结跨度
      frozenTotal.value = m.totalSize;
      updateFrozenSpan();
    } else {
      const deltaAbove = m.offsetOf(anchorRow) - offBefore;
      cumDelta.value += deltaAbove;
      scrollOffset.value += deltaAbove;
    }
    modelTick.value++;
    updateRange();
    stickBottomIfNeeded();
  };

  /**
   * 近底吸附：用户已滚到底（scrollTop ≈ maxScroll）时，测量/flush 导致的
   * scrollHeight 增长会重新拉开与底部的距离（浏览器不会跟随），吸附回底部；
   * 用户向上滚动后自动解除。scrollHeight 增长不触发 scroll 事件，
   * 故标记只在 onScroll 里维护，吸附写入的事件仍满足 ≈max，状态自保持。
   */
  let stickToBottom = false;
  /**
   * 吸附写入标记与目标位置：贴底是位置维护而非用户滚动，其 scroll 事件不应触发
   * 快速滚动重置（否则与吸附形成振荡）。但 scroll 事件按帧合并派发，用户紧接
   * 吸附写入后的滚动会并入同一事件——须比对目标位置，偏差即用户滚动，照常解除吸附
   */
  let snappingToBottom = false;
  let lastSnapTarget = -1;
  const stickBottomIfNeeded = () => {
    const el = containerRef.value;
    if (!stickToBottom || !el) {
      return;
    }
    void nextTick(() => {
      const target = el.scrollHeight - el.clientHeight;
      lastSnapTarget = target;
      snappingToBottom = true;
      el.scrollTop = target;
    });
  };

  /** RO 兜底：可见行内容异步变化（图片加载等）时的尺寸回写 */
  const onRowResize = (entries: ResizeObserverEntry[]) => {
    const list: Array<{ index: number; size: number }> = [];
    for (const entry of entries) {
      const rowEl = entry.target as HTMLElement;
      const i = Number(rowEl.dataset.index);
      if (Number.isNaN(i)) {
        continue;
      }
      // 尺寸取 entry 自带值（border-box ≈ offsetHeight）：回调常紧跟 DOM 写入，
      // 此时读 offsetHeight 会逐批触发强制同步重排（滚动帧耗时大头之一）
      const bs = entry.borderBoxSize as
        | ResizeObserverSize
        | readonly ResizeObserverSize[]
        | undefined;
      const size = Array.isArray(bs)
        ? (bs[0]?.blockSize ?? entry.contentRect.height)
        : (bs?.blockSize ?? entry.contentRect.height);
      list.push({ index: i, size });
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

  /**
   * 预测量通道（独立子组件）：批次队列每个测量帧都变，若在主组件模板内
   * 渲染，主组件会随之重渲染并连带重建全部可见行的 vnode 树；
   * 隔离后只有本组件自身随批次重渲染。渲染函数直接闭包读取
   * measureQueue / itemAt / 父级插槽，响应式追踪限定在本组件内。
   */
  const slots = useSlots();

  /**
   * 行 vnode 缓存（rowMemo 模式）：按行号缓存渲染结果，窗口平移时未变行复用
   * 同一 vnode 对象——patch 对相同引用直接短路，连插槽都不再调用（v-memo 的
   * 缓存按位置索引，窗口滑动后整体错位失效，故手写按键缓存）。仅新入行产生
   * 插槽调用与挂载开销。items 身份/行高/模式变化时整体作废。
   */
  const rowVNodeCache = new Map<number, VNode>();
  const renderRow = (i: number): VNode => {
    let v = rowVNodeCache.get(i);
    if (!v) {
      v = h(
        "div",
        {
          key: i,
          class: "vv-list__row",
          "data-index": i,
          style: props.dynamic ? undefined : { height: `${props.itemSize}px` },
        },
        [slots.default?.({ item: itemAt(i), index: i })]
      );
      rowVNodeCache.set(i, v);
    }
    return v;
  };
  const MemoRows = defineComponent({
    name: "VirtualListMemoRows",
    setup() {
      return () => {
        const { start, end } = range.value;
        const rows = rowIndexes.value.map(renderRow);
        // 缓存只留窗口附近：长时间滚动不累积（窗外行重新进入时重新调用插槽）
        if (rowVNodeCache.size > rows.length * 4) {
          for (const key of rowVNodeCache.keys()) {
            if (key < start || key > end) {
              rowVNodeCache.delete(key);
            }
          }
        }
        return rows;
      };
    },
  });
  const MeasureLane = defineComponent({
    name: "VirtualListMeasureLane",
    setup() {
      return () =>
        h(
          "div",
          { ref: measureRef, class: "vv-list__measure", "aria-hidden": "true" },
          measureQueue.value.map((i) =>
            h("div", { key: i, class: "vv-list__row", "data-index": i }, [
              slots.default?.({ item: itemAt(i), index: i }),
            ])
          )
        );
    },
  });
  /** 预测量双前沿：围绕当前渲染窗口向外扩散 */
  let frontAbove = -1;
  let frontBelow = 0;
  let measureRafId = 0;
  let measureTimer: ReturnType<typeof setTimeout> | null = null;
  /** 空闲预测量批次大小（滚动期间通道整体暂停，无滚动中小批次） */
  const IDLE_BATCH = 24;

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
    // 扩散范围限于窗口前后 ~8 个视口：均值已被种子收敛，远处逐行实测没有收益，
    // 无界扩散会让通道在空闲时永远全速渲染+回读（每帧都在偷主线程）
    const lead = Math.max(64, Math.ceil((viewportH.value * 8) / Math.max(1, m.avg)));
    const belowCap = Math.min(n - 1, range.value.end + lead);
    const aboveCap = Math.max(0, range.value.start - lead);
    let picked = 0;
    while (out.length < size) {
      while (frontBelow <= belowCap && m.isMeasured(frontBelow)) {
        frontBelow++;
      }
      while (frontAbove >= aboveCap && m.isMeasured(frontAbove)) {
        frontAbove--;
      }
      const canBelow = frontBelow <= belowCap;
      const canAbove = frontAbove >= aboveCap;
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
    // 任何滚动活动期间都暂停预测量：通道渲染 + 批次回读会与滚动帧争抢主线程，
    // 且回读发生在 spacer 写入之后，每次都触发整树强制重排；窗口内未测行由
    // measureWindow 兜底（平移后一次性批量读），正确性不依赖滚动期的通道
    if (now < pauseMeasureUntil || now - lastScrollAt < 150) {
      measureTimer = setTimeout(() => {
        measureTimer = null;
        scheduleMeasure();
      }, 180);
      return;
    }
    if (stickToBottom) {
      // 贴底期间暂停扩散：回写扰动 totalSize/spacer 会与吸附互激成振荡。
      // 模型冻结后 scrollHeight/内容完全静止；离开底部经 onScroll → range 变化唤醒
      measureTimer = setTimeout(() => {
        measureTimer = null;
        scheduleMeasure();
      }, 300);
      return;
    }
    const batch = pickBatch(IDLE_BATCH);
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
    // 窗口平移改变 spacer（不经 applyMeasurements），吸附状态需要补一次贴底
    stickBottomIfNeeded();
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
    updateRange(true);
    updateFrozenSpan();
    applySpacers();
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
        updateRange(true);
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
    // 显式定位先解除贴底吸附：否则 updateRange 触发的窗口平移会调
    // stickBottomIfNeeded，其 nextTick 吸附写入排在本函数的 scrollTop
    // 写入之后执行，把跳转目标重新拉回底部（吸附事件还被判为 selfSnap，
    // 吸附状态自保持，跳转被完全吞掉）。目标即底部时由随后的 onScroll 重新吸附
    stickToBottom = false;
    snappingToBottom = false;
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
    // 同 scrollToIndex：显式定位前解除贴底吸附
    stickToBottom = false;
    snappingToBottom = false;
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

<style>
  /* MeasureLane 子组件内渲染的测量行不带本组件 scoped 属性，补同款
     overflow（BFC 防 margin 折叠，保证实测高度与可见行一致） */
  .vv-list__measure > .vv-list__row {
    overflow: hidden;
  }
</style>
