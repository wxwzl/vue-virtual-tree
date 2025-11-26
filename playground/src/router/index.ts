import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";

export const demoRoutes: RouteRecordRaw[] = [
  {
    path: "/basic",
    name: "BasicUsage",
    component: () => import("../components/BasicUsage.vue"),
    meta: { title: "基础用法" },
  },
  {
    path: "/checkbox",
    name: "CheckboxDemo",
    component: () => import("../components/CheckboxDemo.vue"),
    meta: { title: "复选框模式" },
  },
  {
    path: "/default-expand-all",
    name: "DefaultExpandAllDemo",
    component: () => import("../components/DefaultExpandAllDemo.vue"),
    meta: { title: "默认展开所有" },
  },
  {
    path: "/draggable",
    name: "DraggableDemo",
    component: () => import("../components/DraggableDemo.vue"),
    meta: { title: "节点拖拽" },
  },
  {
    path: "/filter",
    name: "FilterDemo",
    component: () => import("../components/FilterDemo.vue"),
    meta: { title: "节点过滤" },
  },
  {
    path: "/default-keys",
    name: "DefaultKeysDemo",
    component: () => import("../components/DefaultKeysDemo.vue"),
    meta: { title: "默认选中/展开" },
  },
  {
    path: "/custom-node",
    name: "CustomNodeDemo",
    component: () => import("../components/CustomNodeDemo.vue"),
    meta: { title: "自定义节点" },
  },
  {
    path: "/async-data",
    name: "AsyncDataDemo",
    component: () => import("../components/AsyncDataDemo.vue"),
    meta: { title: "异步数据加载" },
  },
  {
    path: "/lazy-load",
    name: "LazyLoadDemo",
    component: () => import("../components/LazyLoadDemo.vue"),
    meta: { title: "懒加载" },
  },
  {
    path: "/custom-loading",
    name: "CustomLoadingDemo",
    component: () => import("../components/CustomLoadingDemo.vue"),
    meta: { title: "自定义加载节点" },
  },
  {
    path: "/custom-icon",
    name: "CustomIconDemo",
    component: () => import("../components/CustomIconDemo.vue"),
    meta: { title: "自定义图标" },
  },
  {
    path: "/tree-loading",
    name: "TreeLoadingDemo",
    component: () => import("../components/TreeLoadingDemo.vue"),
    meta: { title: "自定义树加载状态" },
  },
  {
    path: "/custom-checkbox",
    name: "CustomCheckboxDemo",
    component: () => import("../components/CustomCheckboxDemo.vue"),
    meta: { title: "定制复选框样式" },
  },
  {
    path: "/scroll-to-node",
    name: "ScrollToNodeDemo",
    component: () => import("../components/ScrollToNodeDemo.vue"),
    meta: { title: "滚动到指定节点" },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: "/", redirect: demoRoutes[0].path }, ...demoRoutes],
});

export default router;
