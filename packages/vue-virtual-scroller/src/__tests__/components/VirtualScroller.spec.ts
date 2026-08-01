import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import VirtualScroller from "../../components/VirtualScroller.vue";

describe("VirtualScroller", () => {
  it("renders only visible items", async () => {
    const wrapper = mount(VirtualScroller, {
      props: {
        totalCount: 1000,
        itemSize: 32,
        height: 160,
      },
      slots: {
        default: `<template #default="{ index }"><div class="item" :data-index="index">{{ index }}</div></template>`,
      },
      attachTo: document.body,
    });
    await nextTick();
    const items = wrapper.findAll(".item");
    expect(items.length).toBeLessThan(100);
  });

  it("exposes scrollToIndex", async () => {
    const wrapper = mount(VirtualScroller, {
      props: { totalCount: 1000, itemSize: 32, height: 160 },
      slots: {
        default: `<template #default="{ index }"><div class="item">{{ index }}</div></template>`,
      },
      attachTo: document.body,
    });
    await nextTick();
    (wrapper.vm as any).scrollToIndex(100);
    expect((wrapper.vm as any).getScrollTop()).toBeGreaterThan(0);
  });
});
