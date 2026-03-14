import { describe, it, expect } from "vitest";

// 简化测试 - 仅验证核心功能
describe("useTreeExpand", () => {
  it("should export composable and utilities", async () => {
    const mod = await import("../../composables/useTreeExpand");
    expect(mod.useTreeExpand).toBeDefined();
    expect(typeof mod.useTreeExpand).toBe("function");
    expect(mod.findVisibleNodeIndex).toBeDefined();
  });

  it("should find visible node index correctly", async () => {
    const { findVisibleNodeIndex } = await import("../../composables/useTreeExpand");

    const visibleNodes = [
      { id: "1", index: 0 },
      { id: "2", index: 5 },
      { id: "3", index: 10 },
    ] as any;

    expect(findVisibleNodeIndex(visibleNodes, 0)).toBe(0);
    expect(findVisibleNodeIndex(visibleNodes, 5)).toBe(1);
    expect(findVisibleNodeIndex(visibleNodes, 10)).toBe(2);
    expect(findVisibleNodeIndex(visibleNodes, 999)).toBe(-1);
    expect(findVisibleNodeIndex([], 0)).toBe(-1);
  });
});
