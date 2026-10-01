<template>
  <div class="demo-section">
    <h2>Vapor vs Vdom 基准对比（整链 vapor）</h2>
    <div class="control-panel">
      <label>
        节点规模：
        <select v-model.number="rootCount" :disabled="isLoading">
          <option :value="1000">约 11 万（1,000 × 10 × 10）</option>
          <option :value="10000">约 111 万（10,000 × 10 × 10）</option>
        </select>
      </label>
      <button class="btn" :disabled="isLoading" @click="regenerate">
        {{ isLoading ? "生成中..." : "重新生成两侧数据" }}
      </button>
      <span class="node-count-info">总节点数：{{ totalNodeCount.toLocaleString() }}</span>
    </div>
    <p class="tip">
      左侧为 dist vdom 产物（VirtualList 经 alias 用源码、同样按 vdom 编译）；右侧为 dist/vapor 整链
      vapor 产物（VirtualTree/VirtualList/TreeNodeItem/TreeNode 全部 vapor 编译、VirtualList
      已内联，仅应用根一处 vdom↔vapor interop 边界）。 计时口径：点击 →
      node-generated（扁平化完成）→ nextTick → 双 rAF（帧提交）。
      两侧按钮相互独立，请分别单侧压测（同时跑会互相干扰）。
    </p>
    <div class="panes">
      <div v-for="side in sides" :key="side.key" class="pane">
        <h3>
          {{ side.title }}
          <span v-if="side.verified" class="badge">{{ side.verified }}</span>
        </h3>
        <div class="actions">
          <button class="btn" :disabled="isLoading || side.running !== ''" @click="runExpand(side)">
            {{ side.running === "expand" ? "展开中..." : "全部展开" }}
          </button>
          <button
            class="btn"
            :disabled="isLoading || side.running !== ''"
            @click="runCollapse(side)"
          >
            {{ side.running === "collapse" ? "收起中..." : "全部收起" }}
          </button>
          <button
            class="btn btn-secondary"
            :disabled="isLoading || side.running !== ''"
            @click="runScrollBottom(side)"
          >
            {{ side.running === "scroll" ? "滚动中..." : "滚动到底部" }}
          </button>
        </div>
        <div class="tree-shell" :ref="(el) => setShellRef(side.key, el)">
          <component
            :is="side.component"
            :key="side.treeKey"
            :data="side.data"
            :buffer="500"
            :item-size="32"
            fixed-height
            class="tree-scroll"
            :default-expand-all="side.expandAll"
            @node-generated="side.onGenerated"
          />
        </div>
        <pre class="result">{{ side.result || "（未压测）" }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { markRaw, nextTick, reactive, ref } from "vue";
  // vapor 侧：dist/vapor 整链 vapor 产物（features.vapor 全局强制编译，VirtualList 已内联）
  // @ts-ignore -- dist 产物无内联类型声明，类型与源码入口一致
  import { VirtualTree as VaporTree } from "../../../packages/vue-virtual-tree/dist/vapor/index.js";
  // vdom 基线：dist 主产物（3.4 工具链全 vdom；其 external 的 VirtualList 经 alias 解析到
  // 源码、由 playground 按 vdom 编译，基侧不含任何 vapor 组件）
  // @ts-ignore -- dist 产物无内联类型声明，类型与源码入口一致
  import { VirtualTree as VdomTree } from "../../../packages/vue-virtual-tree/dist/index.js";
  import "../../../packages/vue-virtual-tree/dist/style.css";
  // vapor 产物内联了 VirtualList，样式也含 vv-list（主 dist/style.css 因 list external 不含）
  import "../../../packages/vue-virtual-tree/dist/vapor/style.css";
  import type { TreeNodeData } from "@wxwzl/vue-virtual-tree";
  import { generateVirtualTreeData } from "../utils/treeData";

  interface SideState {
    key: "vdom" | "vapor";
    title: string;
    component: unknown;
    data: TreeNodeData[];
    expandAll: boolean;
    treeKey: number;
    running: "" | "expand" | "collapse" | "scroll";
    result: string;
    verified: string;
    onGenerated: () => void;
  }

  const rootCount = ref(1000);
  const totalNodeCount = ref(0);
  const isLoading = ref(true);

  const sides = reactive<SideState[]>([
    {
      key: "vdom",
      title: "vdom（dist 产物）",
      // 组件定义必须 markRaw：reactive 深代理组件对象会导致递归更新死循环
      component: markRaw(VdomTree),
      data: [],
      expandAll: false,
      treeKey: 0,
      running: "",
      result: "",
      verified: "",
      onGenerated: () => {},
    },
    {
      key: "vapor",
      title: "vapor（dist/vapor 整链）",
      component: markRaw(VaporTree),
      data: [],
      expandAll: false,
      treeKey: 0,
      running: "",
      result: "",
      verified: "",
      onGenerated: () => {},
    },
  ]);

  // 滚动容器引用不需要响应式（模板 ref 回调在 patch 期触发，写响应式数据易引发循环更新）
  const shellEls: Record<string, HTMLElement | null> = {};
  const setShellRef = (key: string, el: unknown) => {
    shellEls[key] = (el as HTMLElement) ?? null;
  };

  // 生成器完全确定性（无随机），调两次得到两份独立但同构的数据，避免共享对象互相污染
  const regenerate = async () => {
    isLoading.value = true;
    for (const side of sides) {
      side.data = [];
      side.result = "";
      side.expandAll = false;
      side.treeKey++;
    }
    const opts = { childCount: 10, grandChildCount: 10, chunkSize: 10000 };
    for (const side of sides) {
      const r = await generateVirtualTreeData(rootCount.value, opts);
      side.data = r.data;
      totalNodeCount.value = r.totalCount;
      side.treeKey++;
    }
    isLoading.value = false;
    await nextTick();
    verifyModes();
  };

  /** 行元素 vdom 实例链检测：vapor 组件不创建 vdom 实例，__vueParentComponent 为空。
   *  扁平化是分片异步的，首行渲染晚于 nextTick，需轮询等待两侧都出现行元素再判定 */
  const verifyModes = async () => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const ready = sides.every((s) => shellEls[s.key]?.querySelector(".vue-virtual-tree-node"));
      if (ready) break;
      await sleep(200);
    }
    for (const side of sides) {
      const row = shellEls[side.key]?.querySelector(".vue-virtual-tree-node");
      if (!row) {
        side.verified = "⚠ 未找到行元素";
        continue;
      }
      const hasVdomInstance = !!(row as unknown as Record<string, unknown>).__vueParentComponent;
      side.verified =
        side.key === "vapor"
          ? hasVdomInstance
            ? "⚠ 行组件仍是 vdom"
            : "✓ 已验证 vapor 渲染"
          : hasVdomInstance
            ? "✓ 已验证 vdom 渲染"
            : "⚠ 行组件不是 vdom";
    }
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () =>
    new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  /** 等待该侧下一次 node-generated（扁平化完成信号），带 30s 兜底 */
  const waitGenerated = (side: SideState) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 30000);
      side.onGenerated = () => {
        clearTimeout(timer);
        resolve();
      };
    });

  interface MeasureResult {
    ms: number;
    longTasks: number;
    longTaskTotal: number;
  }

  const measure = async (side: SideState, action: () => Promise<void>): Promise<MeasureResult> => {
    const longTasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) longTasks.push(e.duration);
    });
    observer.observe({ entryTypes: ["longtask"] });

    const t0 = performance.now();
    await action();
    await nextTick();
    await nextFrame();
    const ms = performance.now() - t0;
    observer.disconnect();
    return { ms, longTasks: longTasks.length, longTaskTotal: longTasks.reduce((a, b) => a + b, 0) };
  };

  const record = (side: SideState, label: string, r: MeasureResult) => {
    side.result =
      `${label}：${r.ms.toFixed(1)} ms（长任务 ${r.longTasks} 个 / ${r.longTaskTotal.toFixed(0)} ms）\n` +
      side.result;
  };

  const runExpand = async (side: SideState) => {
    side.running = "expand";
    await sleep(50);
    try {
      const r = await measure(side, async () => {
        const done = waitGenerated(side);
        side.expandAll = true;
        side.treeKey++;
        await done;
      });
      record(side, "全部展开", r);
    } finally {
      side.running = "";
    }
  };

  const runCollapse = async (side: SideState) => {
    side.running = "collapse";
    await sleep(50);
    try {
      const r = await measure(side, async () => {
        const done = waitGenerated(side);
        side.expandAll = false;
        side.treeKey++;
        await done;
      });
      record(side, "全部收起", r);
    } finally {
      side.running = "";
    }
  };

  const runScrollBottom = async (side: SideState) => {
    const scroller = shellEls[side.key]?.querySelector(
      ".vue-virtual-tree__scroller"
    ) as HTMLElement | null;
    if (!scroller) return;
    side.running = "scroll";
    await sleep(50);
    try {
      const r = await measure(side, async () => {
        scroller.scrollTop = scroller.scrollHeight;
      });
      record(side, `滚动到底部（${scroller.scrollHeight.toLocaleString()} px）`, r);
    } finally {
      side.running = "";
    }
  };

  regenerate();
</script>

<style scoped>
  .demo-section {
    padding: 16px;
    height: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    gap: 8px;
  }

  .demo-section h2 {
    color: #606266;
    font-size: 18px;
    margin: 0;
  }

  .control-panel {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .node-count-info {
    font-size: 14px;
    color: #909399;
    margin-left: auto;
  }

  .tip {
    color: #909399;
    font-size: 12px;
    margin: 0;
  }

  .btn {
    padding: 6px 14px;
    background-color: #409eff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: #67c23a;
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
  }

  .pane h3 {
    margin: 0 0 6px;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .badge {
    font-size: 12px;
    font-weight: normal;
    color: #67c23a;
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
  }

  .tree-shell {
    flex: 1;
    min-height: 0;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .tree-scroll {
    flex: 1;
  }

  .result {
    margin: 6px 0 0;
    padding: 8px;
    background: #f5f7fa;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.7;
    color: #606266;
    min-height: 72px;
    white-space: pre-wrap;
  }
</style>
