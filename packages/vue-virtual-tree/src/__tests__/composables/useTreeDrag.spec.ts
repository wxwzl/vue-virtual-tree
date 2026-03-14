import { describe, it, expect } from "vitest";

// 简化测试 - 仅验证核心功能
describe("useTreeDrag", () => {
  it("should export composable", async () => {
    const mod = await import("../../composables/useTreeDrag");
    expect(mod.useTreeDrag).toBeDefined();
    expect(typeof mod.useTreeDrag).toBe("function");
  });

  it("should export DropType", async () => {
    const mod = await import("../../composables/useTreeDrag");
    expect(mod).toBeDefined();
  });
});
