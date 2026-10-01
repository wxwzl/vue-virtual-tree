import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";

interface TreeDemo {
  path: string;
  component: RouteRecordRaw["component"];
  title: string;
}

/** 树功能示例清单：vdom/vapor 两个模式组复用同一批 demo 组件（实现由 TreeModeProvider 注入） */
const treeDemos: TreeDemo[] = [
  { path: "basic", component: () => import("../components/BasicUsage.vue"), title: "基础用法" },
  {
    path: "checkbox",
    component: () => import("../components/CheckboxDemo.vue"),
    title: "复选框模式",
  },
  {
    path: "accordion",
    component: () => import("../components/AccordionDemo.vue"),
    title: "手风琴模式",
  },
  {
    path: "check-strictly",
    component: () => import("../components/CheckStrictlyDemo.vue"),
    title: "严格模式复选框",
  },
  {
    path: "default-expand-all",
    component: () => import("../components/DefaultExpandAllDemo.vue"),
    title: "默认展开所有",
  },
  {
    path: "draggable",
    component: () => import("../components/DraggableDemo.vue"),
    title: "节点拖拽",
  },
  { path: "filter", component: () => import("../components/FilterDemo.vue"), title: "节点过滤" },
  {
    path: "default-keys",
    component: () => import("../components/DefaultKeysDemo.vue"),
    title: "默认选中/展开",
  },
  {
    path: "custom-node",
    component: () => import("../components/CustomNodeDemo.vue"),
    title: "自定义节点",
  },
  {
    path: "async-data",
    component: () => import("../components/AsyncDataDemo.vue"),
    title: "异步数据加载",
  },
  {
    path: "lazy-load",
    component: () => import("../components/LazyLoadDemo.vue"),
    title: "懒加载",
  },
  {
    path: "custom-loading",
    component: () => import("../components/CustomLoadingDemo.vue"),
    title: "自定义加载节点",
  },
  {
    path: "custom-icon",
    component: () => import("../components/CustomIconDemo.vue"),
    title: "自定义图标",
  },
  {
    path: "tree-loading",
    component: () => import("../components/TreeLoadingDemo.vue"),
    title: "自定义树加载状态",
  },
  {
    path: "custom-checkbox",
    component: () => import("../components/CustomCheckboxDemo.vue"),
    title: "定制复选框样式",
  },
  {
    path: "scroll-to-node",
    component: () => import("../components/ScrollToNodeDemo.vue"),
    title: "滚动到指定节点",
  },
  {
    path: "performance",
    component: () => import("../components/PerformanceDemo.vue"),
    title: "100 万节点性能测试（动态高度）",
  },
  {
    path: "performance-fixed",
    component: () => import("../components/FixedPerformanceDemo.vue"),
    title: "100 万节点性能测试（固定高度）",
  },
  {
    path: "dynamic-data",
    component: () => import("../components/DynamicDataDemo.vue"),
    title: "动态数据操作",
  },
];

const treeModes = ["vdom", "vapor"] as const;

/** 树示例路由：每个模式一个嵌套父路由（TreeModeProvider 按 meta.mode 注入对应 dist 产物） */
const treeRoutes: RouteRecordRaw[] = treeModes.map((mode) => ({
  path: `/tree/${mode}`,
  component: () => import("../components/TreeModeProvider.vue"),
  meta: { mode },
  children: treeDemos.map((d) => ({
    path: d.path,
    name: `${mode}-${d.path}`,
    component: d.component,
    meta: { title: d.title, mode },
  })),
}));

/** 旧平铺路径 → vdom 组（兼容已分享的链接） */
const legacyRedirects: RouteRecordRaw[] = treeDemos.map((d) => ({
  path: `/${d.path}`,
  redirect: `/tree/vdom/${d.path}`,
}));

const benchRoute: RouteRecordRaw = {
  path: "/vapor-bench",
  name: "VaporBenchDemo",
  component: () => import("../components/VaporBenchDemo.vue"),
  meta: { title: "Vapor vs Vdom 基准对比" },
};

const listRoutes: RouteRecordRaw[] = [
  {
    path: "/virtual-list",
    name: "VirtualListDemo",
    component: () => import("../components/VirtualListDemo.vue"),
    meta: { title: "自研虚拟列表" },
  },
  {
    path: "/virtual-list-bench",
    name: "VirtualListBenchDemo",
    component: () => import("../components/VirtualListBenchDemo.vue"),
    meta: { title: "虚拟列表基准对比" },
  },
  {
    path: "/virtual-list-dynamic",
    name: "VirtualListDynamicDemo",
    component: () => import("../components/VirtualListDynamicDemo.vue"),
    meta: { title: "动态行高虚拟列表" },
  },
];

export interface MenuGroup {
  title: string;
  items: { path: string; title: string }[];
}

/** 树功能示例菜单（模式无关的子路径，侧边栏按当前模式拼接 /tree/{mode}/{sub}） */
export const treeMenuItems = treeDemos.map((d) => ({ sub: d.path, title: d.title }));

/** 侧边栏其余分组菜单（树示例由 treeMenuItems + 模式切换器承载） */
export const menuGroups: MenuGroup[] = [
  {
    title: "基准对比",
    items: [{ path: benchRoute.path, title: benchRoute.meta!.title as string }],
  },
  {
    title: "虚拟列表（@wxwzl/vue-virtual-list）",
    items: listRoutes.map((r) => ({ path: r.path, title: r.meta!.title as string })),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/tree/vdom/basic" },
    ...treeRoutes,
    ...legacyRedirects,
    benchRoute,
    ...listRoutes,
  ],
});

export default router;
