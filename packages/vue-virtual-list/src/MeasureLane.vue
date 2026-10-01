<template>
  <div
    class="vv-list__measure"
    aria-hidden="true"
  >
    <div
      v-for="i in getQueue()"
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
</template>

<script setup lang="ts" generic="T">
  /**
   * 隐藏预测量通道（独立 SFC）。
   *
   * 隔离性：批次队列经 getter 取出——父组件渲染只传函数引用、不求值，
   * 不对 measureQueue 形成依赖；只有本组件渲染时调用 getter 才跟踪它。
   * 通道每帧重渲染因此不连带父组件重建可见行的 vnode 树。
   *
   * 双模编译：SFC 随所在构建链编译（主链/plugin-vue 默认 → vdom，
   * vapor-build features.vapor → vapor），插槽全程不跨渲染模式边界。
   * （此前通道为手写 h()，vapor 编译下插槽返回 vapor block、h() 无法
   * 渲染而退化为文本，测出垃圾行高腐蚀尺寸模型。）
   */
  defineProps<{
    /** 批次队列 getter（非直传 ref）：避免父组件渲染期读值形成依赖 */
    getQueue: () => number[];
    itemAt: (index: number) => T;
  }>();

  defineSlots<{
    default(props: { item: T; index: number }): unknown;
  }>();
</script>

<style scoped>
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

  /* BFC 防 margin 折叠，保证实测高度与可见行一致 */
  .vv-list__row {
    overflow: hidden;
  }
</style>
