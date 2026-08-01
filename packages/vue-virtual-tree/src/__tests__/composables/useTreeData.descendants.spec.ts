import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nextTick } from "vue";
import { useTreeData } from "../../composables/useTreeData";
import type { TreeNodeData, VirtualTreeProps } from "../../types";

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

const setupUseTreeData = async (props: Partial<VirtualTreeProps> = {}) => {
  const emit = () => {};
  const result = useTreeData({ data: createTestData(), ...props }, emit as any);
  vi.advanceTimersByTime(10);
  await nextTick();
  return result;
};

describe("useTreeData descendant range", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates lastDescendantIndex for nodes", async () => {
    const { flatTree } = await setupUseTreeData({ defaultExpandAll: true });
    const root = flatTree.value.find((n) => n.id === "1")!;
    const child1 = flatTree.value.find((n) => n.id === "1-1")!;
    const child2 = flatTree.value.find((n) => n.id === "1-2")!;
    expect(root.firstDescendantIndex).toBe(1);
    expect(root.lastDescendantIndex).toBe(2);
    expect(child1.firstDescendantIndex).toBe(1);
    expect(child1.lastDescendantIndex).toBe(1);
    expect(child2.firstDescendantIndex).toBe(2);
    expect(child2.lastDescendantIndex).toBe(2);
  });

  it("handles leaf nodes correctly", async () => {
    const { flatTree } = await setupUseTreeData();
    const leaf = flatTree.value.find((n) => n.id === "1-1")!;
    expect(leaf.firstDescendantIndex).toBe(leaf.index);
    expect(leaf.lastDescendantIndex).toBe(leaf.index);
  });
});
