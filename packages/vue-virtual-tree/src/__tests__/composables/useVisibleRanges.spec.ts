import { describe, it, expect } from "vitest";
import { useVisibleRanges } from "../../composables/useVisibleRanges";
import type { FlatTreeNode } from "../../types";

const makeNode = (
  id: string,
  index: number,
  lastDescendantIndex: number,
  parentId: string | null = null,
  isLeaf = false
): FlatTreeNode =>
  ({
    id,
    index,
    firstDescendantIndex: isLeaf ? index : index + 1,
    lastDescendantIndex,
    isLeaf,
    isExpanded: false,
    level: parentId ? 1 : 0,
    parentId,
    data: {},
  }) as FlatTreeNode;

describe("useVisibleRanges", () => {
  it("initializes with root-only ranges when nothing expanded", () => {
    const { visibleRanges } = useVisibleRanges([
      makeNode("a", 1, 3),
      makeNode("b", 4, 4, null, true),
    ]);
    expect(visibleRanges.value).toEqual([
      { start: 1, end: 1 },
      { start: 4, end: 4 },
    ]);
  });

  it("expands a node by inserting its descendant range", () => {
    const { visibleRanges, expandNode } = useVisibleRanges([makeNode("a", 1, 3)]);
    expandNode(makeNode("a", 1, 3));
    expect(visibleRanges.value).toEqual([{ start: 1, end: 3 }]);
  });

  it("collapses a node by removing its descendant range", () => {
    const { visibleRanges, collapseNode } = useVisibleRanges([makeNode("a", 1, 3)]);
    collapseNode(makeNode("a", 1, 3));
    expect(visibleRanges.value).toEqual([{ start: 1, end: 1 }]);
  });

  it("maps visible index to flat index", () => {
    const { expandNode, getFlatIndexAtVisibleIndex } = useVisibleRanges([makeNode("a", 1, 3)]);
    expandNode(makeNode("a", 1, 3));
    expect(getFlatIndexAtVisibleIndex(2)).toBe(3);
  });

  it("setFlatTree updates ranges", () => {
    const { visibleRanges, setFlatTree } = useVisibleRanges([makeNode("a", 1, 3)]);
    setFlatTree([makeNode("a", 1, 1, null, true), makeNode("b", 4, 4, null, true)]);
    expect(visibleRanges.value).toEqual([
      { start: 1, end: 1 },
      { start: 4, end: 4 },
    ]);
  });

  it("visibleCount is calculated correctly", () => {
    const { visibleCount, expandNode } = useVisibleRanges([makeNode("a", 1, 3)]);
    expect(visibleCount.value).toBe(1);
    expandNode(makeNode("a", 1, 3));
    expect(visibleCount.value).toBe(3);
  });

  it("getVisibleIndexAtFlatIndex maps correctly", () => {
    const { expandNode, getVisibleIndexAtFlatIndex } = useVisibleRanges([makeNode("a", 1, 3)]);
    expandNode(makeNode("a", 1, 3));
    expect(getVisibleIndexAtFlatIndex(3)).toBe(2);
  });

  it("initializes with empty ranges for empty tree", () => {
    const { visibleRanges, visibleCount } = useVisibleRanges([]);
    expect(visibleRanges.value).toEqual([]);
    expect(visibleCount.value).toBe(0);
  });
});
