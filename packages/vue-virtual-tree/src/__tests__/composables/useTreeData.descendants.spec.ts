import { describe, it, expect } from "vitest";
import { useTreeData } from "../../composables/useTreeData";
import type { TreeNodeData, VirtualTreeEmits } from "../../types";

const createTestData = (): TreeNodeData[] => [
  {
    id: "1",
    label: "root",
    children: [
      { id: "1-1", label: "child1" },
      { id: "1-2", label: "child2" },
    ],
  },
];

describe("useTreeData descendant range", () => {
  it("calculates lastDescendantIndex for nodes", async () => {
    const emit = () => {};
    const { flatTree } = useTreeData(
      { data: createTestData(), defaultExpandAll: true },
      emit as any
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    const root = flatTree.value.find((n) => n.id === "1")!;
    const child1 = flatTree.value.find((n) => n.id === "1-1")!;
    const child2 = flatTree.value.find((n) => n.id === "1-2")!;
    expect(root.firstDescendantIndex).toBe(2);
    expect(root.lastDescendantIndex).toBe(3);
    expect(child1.firstDescendantIndex).toBe(2);
    expect(child1.lastDescendantIndex).toBe(2);
    expect(child2.firstDescendantIndex).toBe(3);
    expect(child2.lastDescendantIndex).toBe(3);
  });

  it("handles leaf nodes correctly", async () => {
    const emit = () => {};
    const { flatTree } = useTreeData({ data: createTestData() }, emit as any);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const leaf = flatTree.value.find((n) => n.id === "1-1")!;
    expect(leaf.firstDescendantIndex).toBe(leaf.index);
    expect(leaf.lastDescendantIndex).toBe(leaf.index);
  });
});
