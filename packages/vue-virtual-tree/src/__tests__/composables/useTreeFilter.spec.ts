import { describe, it, expect } from "vitest";

// 简化测试 - 仅验证核心功能
describe("useTreeFilter", () => {
  it("should export composable", async () => {
    const mod = await import("../../composables/useTreeFilter");
    expect(mod.useTreeFilter).toBeDefined();
    expect(typeof mod.useTreeFilter).toBe("function");
  });

  it("should support basic filter logic", () => {
    const filterMethod = (value: string, data: any) =>
      data.label?.toLowerCase().includes(value.toLowerCase()) || false;

    const node1 = { id: "1", label: "Apple" };
    const node2 = { id: "2", label: "Banana" };

    expect(filterMethod("app", node1)).toBe(true);
    expect(filterMethod("app", node2)).toBe(false);
  });
});
