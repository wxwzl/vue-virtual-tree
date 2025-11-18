<template>
  <div class="app">
    <header class="app-header">
      <h1>Vue Virtual Tree Playground</h1>
      <a class="github-link" href="https://github.com/wxwzl/vue-virtual-tree/tree/master/playground" target="_blank"
        rel="noopener noreferrer" aria-label="GitHub">
        <svg viewBox="0 0 1024 1024" class="github-icon" aria-hidden="true">
          <path
            d="M511.6 76.3C264.3 76.3 64 276.6 64 523.9c0 197.4 128 364.6 305.3 423.8 22.3 4.1 30.4-9.7 30.4-21.5 0-10.6-.4-38.7-.6-76-124.2 27-150.4-53.7-150.4-53.7-20.3-51.7-49.6-65.5-49.6-65.5-40.6-27.8 3.1-27.3 3.1-27.3 44.9 3.2 68.5 46.1 68.5 46.1 39.9 68.4 104.7 48.6 130.3 37.2 4-28.9 15.6-48.6 28.4-59.8-99.2-11.3-203.5-49.6-203.5-221 0-48.8 17.4-88.7 46-120-4.6-11.3-20-56.8 4.4-118.5 0 0 37.6-12 123.2 45.9 35.7-9.9 74-14.9 112.1-15.1 38.1.2 76.4 5.2 112.2 15.1 85.5-58 123.1-45.9 123.1-45.9 24.5 61.7 9.1 107.2 4.5 118.5 28.6 31.3 46 71.2 46 120 0 171.9-104.5 209.6-203.9 220.7 16 13.8 30.3 41.1 30.3 82.8 0 59.8-.5 108-.5 122.7 0 11.9 8 25.9 30.6 21.5C832 888.5 960 721.2 960 523.9c0-247.3-200.3-447.6-448.4-447.6z" />
        </svg>
      </a>
    </header>

    <BasicUsage />
    <CheckboxDemo />
    <DefaultExpandAllDemo />
    <DraggableDemo />
    <FilterDemo />
    <DefaultKeysDemo />
    <CustomNodeDemo />
    <AsyncDataDemo />
    <LazyLoadDemo />
    <CustomLoadingDemo />
    <CustomIconDemo />
  </div>
</template>

<script setup lang="ts">
import BasicUsage from './components/BasicUsage.vue'
import CheckboxDemo from './components/CheckboxDemo.vue'
import DefaultExpandAllDemo from './components/DefaultExpandAllDemo.vue'
import DraggableDemo from './components/DraggableDemo.vue'
import FilterDemo from './components/FilterDemo.vue'
import DefaultKeysDemo from './components/DefaultKeysDemo.vue'
import CustomNodeDemo from './components/CustomNodeDemo.vue'
import AsyncDataDemo from './components/AsyncDataDemo.vue'
import LazyLoadDemo from './components/LazyLoadDemo.vue'
import CustomLoadingDemo from './components/CustomLoadingDemo.vue'
import CustomIconDemo from './components/CustomIconDemo.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  padding: 20px;
  background-color: #f5f5f5;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
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
  transition: border-color 0.2s, background-color 0.2s, color 0.2s;
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
</style>
