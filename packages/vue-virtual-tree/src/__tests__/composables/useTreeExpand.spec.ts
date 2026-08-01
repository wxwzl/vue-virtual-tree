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
    const nodes: FlatTreeNode[] = [makeNode("a", 1, 3), makeNode("b", 4, 4, null, true)];
    const { visibleRanges, expandNode } = useTreeExpand(defaultProps, nodes);
    expandNode(nodes[0]);
    expect(visibleRanges.value).toEqual([{ start: 1, end: 4 }]);
  });

  it("collapses a node and updates visible ranges", () => {
    const nodes: FlatTreeNode[] = [makeNode("a", 1, 3)];
    const { visibleRanges, expandNode, collapseNode } = useTreeExpand(defaultProps, nodes);
    expandNode(nodes[0]);
    collapseNode(nodes[0]);
    expect(visibleRanges.value).toEqual([{ start: 1, end: 1 }]);
  });

  it("initializes with defaultExpandAll", () => {
    const nodes: FlatTreeNode[] = [makeNode("a", 1, 3)];
    const { visibleRanges } = useTreeExpand({ ...defaultProps, defaultExpandAll: true }, nodes);
    expect(visibleRanges.value).toEqual([{ start: 1, end: 3 }]);
  });

  it("supports accordion mode", () => {
    const nodes: FlatTreeNode[] = [
      makeNode("a", 1, 2, null, false),
      makeNode("b", 3, 4, null, false),
    ];
    const { visibleRanges, expandNode } = useTreeExpand(
      { ...defaultProps, accordion: true },
      nodes
    );
    expandNode(nodes[0]);
    expandNode(nodes[1]);
    expect(visibleRanges.value).toEqual([
      { start: 1, end: 1 },
      { start: 3, end: 4 },
    ]);
  });
});
