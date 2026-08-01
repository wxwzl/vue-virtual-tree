import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import VirtualScroller from "../../components/VirtualScroller.vue";

const defaultSlot = `<template #default="{ index }"><div class="item" :data-index="index">{{ index }}</div></template>`;

describe("VirtualScroller", () => {
  it("renders only visible items", async () => {
    const wrapper = mount(VirtualScroller, {
      props: {
        totalCount: 1000,
        itemSize: 32,
        height: 160,
      },
      slots: {
        default: defaultSlot,
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
        default: defaultSlot,
      },
      attachTo: document.body,
    });
    await nextTick();
    (wrapper.vm as any).scrollToIndex(100);
    expect((wrapper.vm as any).getScrollTop()).toBeGreaterThan(0);
  });

  it("renders no items when totalCount is 0", async () => {
    const wrapper = mount(VirtualScroller, {
      props: { totalCount: 0, itemSize: 32, height: 160 },
      slots: {
        default: defaultSlot,
      },
      attachTo: document.body,
    });
    await nextTick();
    expect(wrapper.findAll(".item").length).toBe(0);
    expect(wrapper.find(".virtual-scroller__spacer").attributes("style")).toMatch(/height:\s*0px/);
  });

  it("handles string height correctly", async () => {
    const wrapper = mount(VirtualScroller, {
      props: { totalCount: 100, itemSize: 32, height: "200px" },
      slots: {
        default: defaultSlot,
      },
      attachTo: document.body,
    });
    await nextTick();
    const style = wrapper.find(".virtual-scroller").attributes("style");
    expect(style).toMatch(/height:\s*200px/);
    expect((wrapper.find(".virtual-scroller").element as HTMLElement).style.height).toBe("200px");
  });

  it("aligns scrollTop after scrollToIndex", async () => {
    const itemSize = 32;
    const wrapper = mount(VirtualScroller, {
      props: { totalCount: 1000, itemSize, height: 160 },
      slots: {
        default: defaultSlot,
      },
      attachTo: document.body,
    });
    await nextTick();
    (wrapper.vm as any).scrollToIndex(10);
    await nextTick();
    const top = (wrapper.vm as any).getScrollTop();
    expect(top).toBeGreaterThanOrEqual(10 * itemSize - 1);
    expect(top).toBeLessThanOrEqual(10 * itemSize + 1);
  });

  it("does not leak errors when mounted and unmounted repeatedly", async () => {
    for (let i = 0; i < 5; i++) {
      const wrapper = mount(VirtualScroller, {
        props: { totalCount: 100, itemSize: 32, height: 160 },
        slots: {
          default: defaultSlot,
        },
        attachTo: document.body,
      });
      await nextTick();
      (wrapper.vm as any).scrollToIndex(50);
      await nextTick();
      wrapper.unmount();
    }
  });
});
