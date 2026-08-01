<template>
  <div
    ref="scrollerRef"
    class="virtual-scroller"
    :style="{ height: typeof height === 'number' ? `${height}px` : height }"
    @scroll="handleScroll"
  >
    <div class="virtual-scroller__spacer" :style="{ height: `${totalHeight}px` }" />
    <div class="virtual-scroller__viewport" :style="{ transform: `translateY(${offsetY}px)` }">
      <div
        v-for="index in visibleIndices"
        :key="index"
        class="virtual-scroller__item"
        :style="{ height: `${itemSize}px` }"
      >
        <slot :index="index" :active="true" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, onMounted, onUpdated } from "vue";

  const props = withDefaults(
    defineProps<{
      totalCount: number;
      itemSize: number;
      buffer?: number;
      height?: number | string;
    }>(),
    {
      buffer: 5,
      height: "100%",
    }
  );

  const scrollerRef = ref<HTMLElement | null>(null);
  const scrollTop = ref(0);
  const viewportHeight = ref(0);

  const totalHeight = computed(() => props.totalCount * props.itemSize);

  const startIndex = computed(() => {
    return Math.max(0, Math.floor(scrollTop.value / props.itemSize) - props.buffer);
  });

  const visibleCount = computed(() => {
    if (viewportHeight.value <= 0) return 0;
    return Math.ceil(viewportHeight.value / props.itemSize) + props.buffer * 2;
  });

  const visibleIndices = computed(() => {
    const count = Math.min(props.totalCount - startIndex.value, visibleCount.value);
    if (count <= 0) return [];
    const indices: number[] = [];
    for (let i = 0; i < count; i++) {
      indices.push(startIndex.value + i);
    }
    return indices;
  });

  const offsetY = computed(() => startIndex.value * props.itemSize);

  const measureViewport = () => {
    if (scrollerRef.value) {
      viewportHeight.value = scrollerRef.value.clientHeight;
    }
  };

  const handleScroll = () => {
    if (scrollerRef.value) {
      scrollTop.value = scrollerRef.value.scrollTop;
    }
  };

  onMounted(() => {
    measureViewport();
    window.addEventListener("resize", measureViewport);
  });

  onUpdated(() => {
    measureViewport();
  });

  const scrollToIndex = (index: number, align: "start" | "center" | "end" = "start") => {
    if (!scrollerRef.value || props.totalCount === 0) return;
    const clamped = Math.max(0, Math.min(index, props.totalCount - 1));
    const targetTop = clamped * props.itemSize;
    let finalScrollTop = targetTop;
    if (align === "center") {
      finalScrollTop = targetTop - viewportHeight.value / 2 + props.itemSize / 2;
    } else if (align === "end") {
      finalScrollTop = targetTop - viewportHeight.value + props.itemSize;
    }
    scrollerRef.value.scrollTop = Math.max(0, finalScrollTop);
    scrollTop.value = scrollerRef.value.scrollTop;
  };

  const getScrollTop = () => scrollTop.value;

  const forceUpdate = () => {
    measureViewport();
    handleScroll();
  };

  defineExpose({
    scrollToIndex,
    getScrollTop,
    forceUpdate,
  });
</script>

<style scoped lang="scss">
  .virtual-scroller {
    position: relative;
    overflow: auto;
    width: 100%;
    height: 100%;

    &__spacer {
      width: 100%;
    }

    &__viewport {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      will-change: transform;
    }

    &__item {
      box-sizing: border-box;
    }
  }
</style>
