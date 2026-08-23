import { describe, it, expect } from "vitest";
import { useTreeExpand } from "../../composables/useTreeExpand";
import type { FlatTreeNode, VirtualTreeProps } from "../../types";

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

const defaultProps: VirtualTreeProps = { data: [] };

describe("useTreeExpand with intervals", () => {
  it("expands a node and updates visible ranges", () => {
    const nodes: FlatTreeNode[] = [
      makeNode("a", 0, 2),
      makeNode("a-1", 1, 1, "a", true),
      makeNode("a-2", 2, 2, "a", true),
      makeNode("b", 3, 3, null, true),
    ];
    const { visibleRanges, expandNode } = useTreeExpand(defaultProps, nodes);
    expandNode(nodes[0]);
    expect(visibleRanges.value).toEqual([{ start: 0, end: 3 }]);
  });

  it("collapses a node and updates visible ranges", () => {
    const nodes: FlatTreeNode[] = [
      makeNode("a", 0, 2),
      makeNode("a-1", 1, 1, "a", true),
      makeNode("a-2", 2, 2, "a", true),
    ];
    const { visibleRanges, expandNode, collapseNode } = useTreeExpand(defaultProps, nodes);
    expandNode(nodes[0]);
    collapseNode(nodes[0]);
    expect(visibleRanges.value).toEqual([{ start: 0, end: 0 }]);
  });

  it("initializes with defaultExpandAll", () => {
    const nodes: FlatTreeNode[] = [
      makeNode("a", 0, 2),
      makeNode("a-1", 1, 1, "a", true),
      makeNode("a-2", 2, 2, "a", true),
    ];
    const { visibleRanges } = useTreeExpand({ ...defaultProps, defaultExpandAll: true }, nodes);
    expect(visibleRanges.value).toEqual([{ start: 0, end: 2 }]);
  });

  it("supports accordion mode", () => {
    const nodes: FlatTreeNode[] = [
      makeNode("a", 0, 1, null, false),
      makeNode("a-1", 1, 1, "a", true),
      makeNode("b", 2, 3, null, false),
      makeNode("b-1", 3, 3, "b", true),
    ];
    const { visibleRanges, expandNode } = useTreeExpand(
      { ...defaultProps, accordion: true },
      nodes
    );
    expandNode(nodes[0]);
    expandNode(nodes[2]);
    expect(visibleRanges.value).toEqual([
      { start: 0, end: 0 },
      { start: 2, end: 3 },
    ]);
  });

  it("preserves descendant expand state when collapsing and re-expanding parent", () => {
    const nodes: FlatTreeNode[] = [
      makeNode("a", 0, 5),
      makeNode("a-1", 1, 3, "a"),
      makeNode("a-1-1", 2, 2, "a-1", true),
      makeNode("a-1-2", 3, 3, "a-1", true),
      makeNode("a-2", 4, 5, "a"),
      makeNode("a-2-1", 5, 5, "a-2", true),
    ];
    const { visibleRanges, expandNode, collapseNode } = useTreeExpand(defaultProps, nodes);

    expandNode(nodes[0]);
    expect(visibleRanges.value).toEqual([
      { start: 0, end: 1 },
      { start: 4, end: 4 },
    ]);

    expandNode(nodes[1]);
    expect(nodes[1].isExpanded).toBe(true);
    expect(visibleRanges.value).toEqual([{ start: 0, end: 4 }]);

    collapseNode(nodes[0]);
    expect(visibleRanges.value).toEqual([{ start: 0, end: 0 }]);

    expandNode(nodes[0]);
    expect(nodes[1].isExpanded).toBe(true);
    expect(nodes[4].isExpanded).toBe(false);
    expect(visibleRanges.value).toEqual([{ start: 0, end: 4 }]);
  });
});
