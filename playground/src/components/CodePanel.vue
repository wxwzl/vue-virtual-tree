<template>
  <div class="code-panel">
    <div class="code-panel__header" @click="toggle">
      <span class="code-panel__title">
        <svg
          class="code-panel__icon"
          :class="{ 'is-expanded': isExpanded }"
          viewBox="0 0 1024 1024"
          width="16"
          height="16"
        >
          <path d="M384 384l256 256-256 256z" fill="currentColor" />
        </svg>
        查看代码
      </span>
      <button class="code-panel__copy" @click.stop="copyCode" title="复制代码">
        <svg viewBox="0 0 1024 1024" width="16" height="16">
          <path
            d="M832 64H296c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h496v688c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V96c0-17.7-14.3-32-32-32zM704 192H192c-17.7 0-32 14.3-32 32v530.7c0 8.5 3.4 16.6 9.4 22.6l173.3 173.3c2.2 2.2 4.7 4 7.4 5.5v1.9h4.2c3.5 1.3 7.2 2 11 2H704c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32zM350 856.2L263.9 770H350v86.2zM664 888H414V746c0-22.1-17.9-40-40-40H232V264h432v624z"
            fill="currentColor"
          />
        </svg>
        <span v-if="copied" class="code-panel__copied">已复制</span>
      </button>
    </div>
    <transition name="code-panel">
      <div v-show="isExpanded" class="code-panel__content">
        <pre class="code-panel__code"><code>{{ code }}</code></pre>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
  import { ref } from "vue";

  interface Props {
    code: string;
  }

  const props = defineProps<Props>();

  const isExpanded = ref(false);
  const copied = ref(false);

  const toggle = () => {
    isExpanded.value = !isExpanded.value;
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(props.code);
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
      // 降级方案
      const textarea = document.createElement("textarea");
      textarea.value = props.code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 2000);
    }
  };
</script>

<style scoped>
  .code-panel {
    margin-top: 20px;
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    overflow: hidden;
  }

  .code-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background-color: #fafafa;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.3s;
  }

  .code-panel__header:hover {
    background-color: #f5f7fa;
  }

  .code-panel__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #606266;
    font-weight: 500;
  }

  .code-panel__icon {
    transition: transform 0.3s;
    color: #909399;
  }

  .code-panel__icon.is-expanded {
    transform: rotate(90deg);
  }

  .code-panel__copy {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: none;
    border: none;
    cursor: pointer;
    color: #909399;
    font-size: 12px;
    transition: color 0.3s;
  }

  .code-panel__copy:hover {
    color: #409eff;
  }

  .code-panel__copied {
    font-size: 12px;
    color: #67c23a;
  }

  .code-panel__content {
    background-color: #fafafa;
    border-top: 1px solid #e4e7ed;
  }

  .code-panel__code {
    margin: 0;
    padding: 16px;
    background-color: #282c34;
    color: #abb2bf;
    font-family: "Consolas", "Monaco", "Courier New", monospace;
    font-size: 13px;
    line-height: 1.6;
    overflow-x: auto;
  }

  .code-panel__code code {
    display: block;
    white-space: pre;
  }

  /* 过渡动画 */
  .code-panel-enter-active,
  .code-panel-leave-active {
    transition: all 0.3s ease;
    overflow: hidden;
  }

  .code-panel-enter-from,
  .code-panel-leave-to {
    max-height: 0;
    opacity: 0;
  }

  .code-panel-enter-to,
  .code-panel-leave-from {
    max-height: 1000px;
    opacity: 1;
  }
</style>
