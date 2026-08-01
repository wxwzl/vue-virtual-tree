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
  import { computed, ref, onMounted, onUpdated, onUnmounted } from "vue";

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

  const safeItemSize = computed(() => Math.max(1, props.itemSize));
  const safeBuffer = computed(() => Math.max(0, Math.floor(props.buffer ?? 5)));
  const safeTotalCount = computed(() => Math.max(0, props.totalCount));

  const totalHeight = computed(() => safeTotalCount.value * safeItemSize.value);

  const startIndex = computed(() => {
    return Math.max(0, Math.floor(scrollTop.value / safeItemSize.value) - safeBuffer.value);
  });

  const visibleCount = computed(() => {
    if (viewportHeight.value <= 0) return 0;
    return Math.ceil(viewportHeight.value / safeItemSize.value) + safeBuffer.value * 2;
  });

  const visibleIndices = computed(() => {
    const count = Math.min(safeTotalCount.value - startIndex.value, visibleCount.value);
    if (count <= 0) return [];
    const indices: number[] = [];
    for (let i = 0; i < count; i++) {
      indices.push(startIndex.value + i);
    }
    return indices;
  });

  const offsetY = computed(() => startIndex.value * safeItemSize.value);

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

  onUnmounted(() => {
    window.removeEventListener("resize", measureViewport);
  });

  const scrollToIndex = (index: number, align: "start" | "center" | "end" = "start") => {
    if (!scrollerRef.value || safeTotalCount.value === 0) return;
    const clamped = Math.max(0, Math.min(index, safeTotalCount.value - 1));
    const targetTop = clamped * safeItemSize.value;
    let finalScrollTop = targetTop;
    if (align === "center") {
      finalScrollTop = targetTop - viewportHeight.value / 2 + safeItemSize.value / 2;
    } else if (align === "end") {
      finalScrollTop = targetTop - viewportHeight.value + safeItemSize.value;
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
