<template>
  <div class="app">
    <header class="app-header">
      <h1>Vue Virtual Tree Playground</h1>
      <a
        class="github-link"
        href="https://github.com/wxwzl/vue-virtual-tree/tree/master/playground"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
      >
        <svg viewBox="0 0 1024 1024" class="github-icon" aria-hidden="true">
          <path
            d="M511.6 76.3C264.3 76.3 64 276.6 64 523.9c0 197.4 128 364.6 305.3 423.8 22.3 4.1 30.4-9.7 30.4-21.5 0-10.6-.4-38.7-.6-76-124.2 27-150.4-53.7-150.4-53.7-20.3-51.7-49.6-65.5-49.6-65.5-40.6-27.8 3.1-27.3 3.1-27.3 44.9 3.2 68.5 46.1 68.5 46.1 39.9 68.4 104.7 48.6 130.3 37.2 4-28.9 15.6-48.6 28.4-59.8-99.2-11.3-203.5-49.6-203.5-221 0-48.8 17.4-88.7 46-120-4.6-11.3-20-56.8 4.4-118.5 0 0 37.6-12 123.2 45.9 35.7-9.9 74-14.9 112.1-15.1 38.1.2 76.4 5.2 112.2 15.1 85.5-58 123.1-45.9 123.1-45.9 24.5 61.7 9.1 107.2 4.5 118.5 28.6 31.3 46 71.2 46 120 0 171.9-104.5 209.6-203.9 220.7 16 13.8 30.3 41.1 30.3 82.8 0 59.8-.5 108-.5 122.7 0 11.9 8 25.9 30.6 21.5C832 888.5 960 721.2 960 523.9c0-247.3-200.3-447.6-448.4-447.6z"
          />
        </svg>
      </a>
    </header>
    <div class="app-body">
      <aside class="sidebar">
        <div class="mode-switch" role="tablist" aria-label="渲染模式">
          <button
            v-for="m in treeModes"
            :key="m"
            class="mode-tab"
            :class="{ 'is-active': mode === m }"
            role="tab"
            :aria-selected="mode === m"
            @click="switchMode(m)"
          >
            {{ m }}
          </button>
        </div>
        <div class="menu-group">
          <div class="menu-group-title">虚拟树功能示例</div>
          <RouterLink
            v-for="item in treeMenuItems"
            :key="item.sub"
            :to="`/tree/${mode}/${item.sub}`"
            class="menu-link"
            active-class="is-active"
          >
            {{ item.title }}
          </RouterLink>
        </div>
        <div v-for="group in menuGroups" :key="group.title" class="menu-group">
          <div class="menu-group-title">{{ group.title }}</div>
          <RouterLink
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="menu-link"
            active-class="is-active"
          >
            {{ item.title }}
          </RouterLink>
        </div>
      </aside>
      <main class="content">
        <!-- 顶级路由记录作 key：vdom/vapor 两组共用 TreeModeProvider 组件，
             不加 key 时跨组导航复用 provider 实例，provide 的实现不会切换 -->
        <RouterView v-slot="{ Component, route }">
          <component :is="Component" :key="route.matched[0]?.path" />
        </RouterView>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from "vue";
  import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
  import { menuGroups, treeMenuItems } from "./router";

  const treeModes = ["vdom", "vapor"] as const;

  const route = useRoute();
  const router = useRouter();

  /** 当前树路由携带的模式（非树页面为 undefined） */
  const routeMode = computed(
    () => route.path.match(/^\/tree\/(vdom|vapor)\//)?.[1] as "vdom" | "vapor" | undefined
  );
  /** 最近所处的树模式：基准/列表页时 Tab 保持上次选择，不掉回 vdom */
  const lastMode = ref<"vdom" | "vapor">("vdom");
  watch(routeMode, (m) => {
    if (m) lastMode.value = m;
  });
  const mode = computed<"vdom" | "vapor">(() => routeMode.value ?? lastMode.value);
  /** 当前树示例子路径（非树页面为 undefined） */
  const currentSub = computed(() => route.path.match(/^\/tree\/(?:vdom|vapor)\/(.+)$/)?.[1]);

  /** 切换模式：树示例页内保留当前示例（vdom/draggable ↔ vapor/draggable），其余页进该模式基础页 */
  const switchMode = (m: "vdom" | "vapor") => {
    if (m === mode.value) return;
    router.push(`/tree/${m}/${currentSub.value ?? "basic"}`);
  };
</script>

<style>
  :root {
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html,
  body {
    height: 100%;
  }

  body {
    overflow: hidden;
    background-color: #f5f5f5;
  }

  #app {
    height: 100%;
  }

  .app {
    height: 100%;
    padding: 0 20px 12px 20px;
    display: flex;
    flex-direction: column;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
  }

  h1 {
    color: #303133;
    font-size: 28px;
  }

  .github-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid #dcdfe6;
    background-color: #fff;
    color: #1f2d3d;
    text-decoration: none;
    font-size: 14px;
    transition:
      border-color 0.2s,
      background-color 0.2s,
      color 0.2s;
  }

  .github-icon {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  .github-link:hover {
    border-color: #409eff;
    color: #409eff;
    background-color: #ecf5ff;
  }

  .app-body {
    display: flex;
    gap: 16px;
    margin-top: 16px;
    flex: 1;
    min-height: 0;
  }

  .sidebar {
    width: 220px;
    background: #fff;
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
    overflow-y: auto;
  }

  .mode-switch {
    display: flex;
    padding: 3px;
    background: #f5f7fa;
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .mode-tab {
    flex: 1;
    padding: 6px 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #606266;
    font-size: 13px;
    cursor: pointer;
    transition:
      background-color 0.2s,
      color 0.2s;
  }

  .mode-tab.is-active {
    background: #fff;
    color: #409eff;
    font-weight: 600;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  .menu-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .menu-group + .menu-group {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #ebeef5;
  }

  .menu-group-title {
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #909399;
  }

  .menu-link {
    padding: 10px 12px;
    border-radius: 6px;
    color: #606266;
    text-decoration: none;
    font-size: 14px;
    transition:
      background-color 0.2s,
      color 0.2s;
  }

  .menu-link:hover {
    background-color: #f5f7fa;
    color: #409eff;
  }

  .menu-link.is-active {
    background-color: #ecf5ff;
    color: #409eff;
    font-weight: 600;
  }

  .content {
    flex: 1;
    background: #fff;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
    overflow-y: auto;
    min-height: 0;
  }
</style>
