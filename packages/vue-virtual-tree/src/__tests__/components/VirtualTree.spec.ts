import { describe, it, expect } from "vitest";

// 简化测试 - 仅验证组件可导入
describe("VirtualTree", () => {
  it("should export component", async () => {
    const mod = await import("../../components/VirtualTree.vue");
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it("should export TreeNode component", async () => {
    const mod = await import("../../components/TreeNode.vue");
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });
});
