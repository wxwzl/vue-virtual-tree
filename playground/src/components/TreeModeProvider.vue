<template>
  <router-view />
</template>

<script setup lang="ts">
  import { markRaw, provide } from "vue";
  import { useRoute } from "vue-router";
  // @ts-ignore -- dist 产物无内联类型声明，类型与源码入口一致
  import { VirtualTree as VdomTree } from "../../../packages/vue-virtual-tree/dist/index.js";
  // @ts-ignore -- dist 产物无内联类型声明，类型与源码入口一致
  import { VirtualTree as VaporTree } from "../../../packages/vue-virtual-tree/dist/vapor/index.js";
  // 两个模式组的样式同源（tree 选择器一致，重复加载无副作用）；
  // vapor 产物内联了 VirtualList，其 style.css 额外含 vv-list 样式（vdom 组的 list
  // 经 alias 解析到 src，样式由 SFC 编译自动注入，无需单独引入）
  import "../../../packages/vue-virtual-tree/dist/style.css";
  import "../../../packages/vue-virtual-tree/dist/vapor/style.css";
  import { VirtualTreeImplKey } from "../composables/useVirtualTree";

  const route = useRoute();
  // 按路由组注入整链产物：vdom 组 = 3.4 工具链全 vdom（npm 默认入口）；
  // vapor 组 = features.vapor 整链 vapor 编译（npm /vapor 子路径）
  provide(VirtualTreeImplKey, markRaw(route.meta.mode === "vapor" ? VaporTree : VdomTree));
</script>
