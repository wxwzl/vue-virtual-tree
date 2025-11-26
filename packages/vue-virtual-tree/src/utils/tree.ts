import type { TreeNodeData, TreePropsConfig } from "../types";

/**
 * 默认字段映射配置
 */
const DEFAULT_PROPS: Required<TreePropsConfig> = {
  id: "id",
  children: "children",
  label: "label",
  disabled: "disabled",
  isLeaf: "isLeaf",
};

/**
 * 获取节点 ID
 */
export function getNodeId(node: TreeNodeData, props: TreePropsConfig = {}): string | number {
  const config = { ...DEFAULT_PROPS, ...props };
  return node[config.id] ?? node.id ?? "";
}

/**
 * 获取节点标签
 */
export function getNodeLabel(node: TreeNodeData, props: TreePropsConfig = {}): string {
  const config = { ...DEFAULT_PROPS, ...props };
  return node[config.label] ?? node.label ?? "";
}

/**
 * 获取子节点
 */
export function getNodeChildren(node: TreeNodeData, props: TreePropsConfig = {}): TreeNodeData[] {
  const config = { ...DEFAULT_PROPS, ...props };
  return node[config.children] ?? node.children ?? [];
}

/**
 * 判断节点是否禁用
 */
export function isNodeDisabled(node: TreeNodeData, props: TreePropsConfig = {}): boolean {
  const config = { ...DEFAULT_PROPS, ...props };
  return node[config.disabled] ?? node.disabled ?? false;
}

/**
 * 判断是否为叶子节点
 */
export function isLeafNode(node: TreeNodeData, props: TreePropsConfig = {}): boolean {
  const config = { ...DEFAULT_PROPS, ...props };
  const children = getNodeChildren(node, props);
  if (children.length > 0) return false;
  if (node[config.isLeaf] !== undefined) {
    return node[config.isLeaf] ?? false;
  }
  return true;
}

/**
 * 递归遍历树节点
 */
export function traverseTree(
  nodes: TreeNodeData[],
  callback: (node: TreeNodeData, parent: TreeNodeData | null) => void | boolean,
  parent: TreeNodeData | null = null,
  props: TreePropsConfig = {}
): void {
  for (const node of nodes) {
    const result = callback(node, parent);
    if (result === false) {
      continue;
    }
    const children = getNodeChildren(node, props);
    if (children.length > 0) {
      traverseTree(children, callback, node, props);
    }
  }
}

/**
 * 查找节点
 */
export function findNode(
  nodes: TreeNodeData[],
  predicate: (node: TreeNodeData) => boolean,
  props: TreePropsConfig = {}
): TreeNodeData | null {
  for (const node of nodes) {
    if (predicate(node)) {
      return node;
    }
    const children = getNodeChildren(node, props);
    if (children.length > 0) {
      const found = findNode(children, predicate, props);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 根据 key 查找节点
 */
export function findNodeByKey(
  nodes: TreeNodeData[],
  key: string | number,
  props: TreePropsConfig = {}
): TreeNodeData | null {
  return findNode(nodes, (node) => getNodeId(node, props) === key, props);
}

/**
 * 获取所有节点的 key
 */
export function getAllKeys(
  nodes: TreeNodeData[],
  props: TreePropsConfig = {}
): (string | number)[] {
  const keys: (string | number)[] = [];
  traverseTree(
    nodes,
    (node) => {
      keys.push(getNodeId(node, props));
    },
    null,
    props
  );
  return keys;
}

/**
 * 获取所有叶子节点的 key
 */
export function getLeafKeys(
  nodes: TreeNodeData[],
  props: TreePropsConfig = {}
): (string | number)[] {
  const keys: (string | number)[] = [];
  traverseTree(
    nodes,
    (node) => {
      if (isLeafNode(node, props)) {
        keys.push(getNodeId(node, props));
      }
    },
    null,
    props
  );
  return keys;
}
