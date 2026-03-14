import { describe, it, expect } from "vitest";
import {
  getNodeId,
  getNodeLabel,
  getNodeChildren,
  isNodeDisabled,
  isLeafNode,
  traverseTree,
  findNode,
  findNodeByKey,
  getAllKeys,
  getLeafKeys,
} from "../../utils/tree";
import type { TreeNodeData, TreePropsConfig } from "../../types";

describe("tree utils", () => {
  // 测试数据
  const mockTreeData: TreeNodeData[] = [
    {
      id: "1",
      label: "Node 1",
      children: [
        {
          id: "1-1",
          label: "Node 1-1",
          children: [
            { id: "1-1-1", label: "Node 1-1-1" },
            { id: "1-1-2", label: "Node 1-1-2" },
          ],
        },
        { id: "1-2", label: "Node 1-2" },
      ],
    },
    {
      id: "2",
      label: "Node 2",
      disabled: true,
      children: [{ id: "2-1", label: "Node 2-1" }],
    },
    {
      id: "3",
      label: "Node 3",
      isLeaf: true,
    },
  ];

  describe("getNodeId", () => {
    it("should return node id with default props", () => {
      const node = { id: "test-id", label: "Test" };
      expect(getNodeId(node)).toBe("test-id");
    });

    it("should return node id with custom props", () => {
      const node = { key: "custom-key", label: "Test" };
      const props: TreePropsConfig = { id: "key" };
      expect(getNodeId(node, props)).toBe("custom-key");
    });

    it("should fallback to node.id when custom field is undefined", () => {
      const node = { id: "fallback-id", label: "Test" };
      const props: TreePropsConfig = { id: "nonexistent" };
      expect(getNodeId(node, props)).toBe("fallback-id");
    });

    it("should return empty string when no id found", () => {
      const node = { label: "Test" };
      expect(getNodeId(node)).toBe("");
    });
  });

  describe("getNodeLabel", () => {
    it("should return node label with default props", () => {
      const node = { id: "1", label: "Test Label" };
      expect(getNodeLabel(node)).toBe("Test Label");
    });

    it("should return node label with custom props", () => {
      const node = { id: "1", name: "Custom Name" };
      const props: TreePropsConfig = { label: "name" };
      expect(getNodeLabel(node, props)).toBe("Custom Name");
    });

    it("should return empty string when no label found", () => {
      const node = { id: "1" };
      expect(getNodeLabel(node)).toBe("");
    });
  });

  describe("getNodeChildren", () => {
    it("should return children array with default props", () => {
      const node = {
        id: "1",
        children: [{ id: "1-1" }, { id: "1-2" }],
      };
      expect(getNodeChildren(node)).toHaveLength(2);
    });

    it("should return children array with custom props", () => {
      const node = {
        id: "1",
        childNodes: [{ id: "1-1" }],
      };
      const props: TreePropsConfig = { children: "childNodes" };
      expect(getNodeChildren(node, props)).toHaveLength(1);
    });

    it("should return empty array when no children", () => {
      const node = { id: "1" };
      expect(getNodeChildren(node)).toEqual([]);
    });

    it("should return empty array when children is undefined", () => {
      const node = { id: "1", children: undefined };
      expect(getNodeChildren(node)).toEqual([]);
    });
  });

  describe("isNodeDisabled", () => {
    it("should return false for enabled node", () => {
      const node = { id: "1", label: "Test" };
      expect(isNodeDisabled(node)).toBe(false);
    });

    it("should return true for disabled node", () => {
      const node = { id: "1", label: "Test", disabled: true };
      expect(isNodeDisabled(node)).toBe(true);
    });

    it("should work with custom disabled field", () => {
      const node = { id: "1", label: "Test", isDisabled: true };
      const props: TreePropsConfig = { disabled: "isDisabled" };
      expect(isNodeDisabled(node, props)).toBe(true);
    });
  });

  describe("isLeafNode", () => {
    it("should return true when no children", () => {
      const node = { id: "1", label: "Test" };
      expect(isLeafNode(node)).toBe(true);
    });

    it("should return false when has children", () => {
      const node = { id: "1", label: "Test", children: [{ id: "1-1" }] };
      expect(isLeafNode(node)).toBe(false);
    });

    it("should return true when isLeaf is true", () => {
      const node = { id: "1", label: "Test", isLeaf: true };
      expect(isLeafNode(node)).toBe(true);
    });

    it("should return false when isLeaf is false even without children", () => {
      const node = { id: "1", label: "Test", isLeaf: false };
      expect(isLeafNode(node)).toBe(false);
    });

    it("should work with custom isLeaf field", () => {
      const node = { id: "1", label: "Test", leaf: true };
      const props: TreePropsConfig = { isLeaf: "leaf" };
      expect(isLeafNode(node, props)).toBe(true);
    });
  });

  describe("traverseTree", () => {
    it("should traverse all nodes in tree", () => {
      const visited: string[] = [];
      traverseTree(mockTreeData, (node) => {
        visited.push(node.id as string);
      });
      expect(visited).toEqual(["1", "1-1", "1-1-1", "1-1-2", "1-2", "2", "2-1", "3"]);
    });

    it("should stop traversing children when callback returns false", () => {
      const visited: string[] = [];
      traverseTree(mockTreeData, (node) => {
        visited.push(node.id as string);
        if (node.id === "1") {
          return false;
        } // Skip children of node "1"
      });
      expect(visited).toEqual(["1", "2", "2-1", "3"]);
    });

    it("should pass parent node to callback", () => {
      const parentMap: Record<string, string | null> = {};
      traverseTree(
        mockTreeData,
        (node, parent) => {
          parentMap[node.id as string] = (parent?.id as string) || null;
        },
        null
      );
      expect(parentMap["1"]).toBeNull();
      expect(parentMap["1-1"]).toBe("1");
      expect(parentMap["1-1-1"]).toBe("1-1");
    });
  });

  describe("findNode", () => {
    it("should find node by predicate", () => {
      const node = findNode(mockTreeData, (n) => n.id === "1-1-2");
      expect(node).not.toBeNull();
      expect(node?.id).toBe("1-1-2");
    });

    it("should return null when node not found", () => {
      const node = findNode(mockTreeData, (n) => n.id === "nonexistent");
      expect(node).toBeNull();
    });

    it("should find root level node", () => {
      const node = findNode(mockTreeData, (n) => n.id === "3");
      expect(node?.id).toBe("3");
    });
  });

  describe("findNodeByKey", () => {
    it("should find node by key", () => {
      const node = findNodeByKey(mockTreeData, "1-2");
      expect(node?.id).toBe("1-2");
    });

    it("should return null for non-existent key", () => {
      const node = findNodeByKey(mockTreeData, "999");
      expect(node).toBeNull();
    });
  });

  describe("getAllKeys", () => {
    it("should return all node keys", () => {
      const keys = getAllKeys(mockTreeData);
      expect(keys).toHaveLength(8);
      expect(keys).toContain("1");
      expect(keys).toContain("1-1");
      expect(keys).toContain("1-1-1");
      expect(keys).toContain("1-1-2");
      expect(keys).toContain("1-2");
      expect(keys).toContain("2");
      expect(keys).toContain("2-1");
      expect(keys).toContain("3");
    });

    it("should return empty array for empty tree", () => {
      const keys = getAllKeys([]);
      expect(keys).toEqual([]);
    });
  });

  describe("getLeafKeys", () => {
    it("should return only leaf node keys", () => {
      const keys = getLeafKeys(mockTreeData);
      expect(keys).toEqual(["1-1-1", "1-1-2", "1-2", "2-1", "3"]);
    });

    it("should return empty array when all nodes have children", () => {
      const tree: TreeNodeData[] = [
        {
          id: "1",
          children: [{ id: "1-1", children: [{ id: "1-1-1" }] }],
        },
      ];
      const keys = getLeafKeys(tree);
      expect(keys).toEqual(["1-1-1"]);
    });
  });
});
