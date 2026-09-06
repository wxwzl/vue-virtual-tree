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
 * 解析字段映射配置（在批量遍历前只解析一次，避免循环中反复 spread 分配对象）
 */
export function resolveTreeConfig(props: TreePropsConfig = {}): Required<TreePropsConfig> {
  return { ...DEFAULT_PROPS, ...props };
}

/**
 * 获取节点 ID（已解析配置，供热路径循环使用）
 */
export function getNodeIdByConfig(
  node: TreeNodeData,
  config: Required<TreePropsConfig>
): string | number {
  return node[config.id] ?? node.id ?? "";
}

/**
 * 获取节点标签（已解析配置）
 */
export function getNodeLabelByConfig(
  node: TreeNodeData,
  config: Required<TreePropsConfig>
): string {
  return node[config.label] ?? node.label ?? "";
}

/**
 * 获取子节点（已解析配置）
 */
export function getNodeChildrenByConfig(
  node: TreeNodeData,
  config: Required<TreePropsConfig>
): TreeNodeData[] {
  return node[config.children] ?? node.children ?? [];
}

/**
 * 判断节点是否禁用（已解析配置）
 */
export function isNodeDisabledByConfig(
  node: TreeNodeData,
  config: Required<TreePropsConfig>
): boolean {
  return node[config.disabled] ?? node.disabled ?? false;
}

/**
 * 判断是否为叶子节点（已解析配置）
 */
export function isLeafNodeByConfig(node: TreeNodeData, config: Required<TreePropsConfig>): boolean {
  const children = getNodeChildrenByConfig(node, config);
  if (children.length > 0) {
    return false;
  }
  if (node[config.isLeaf] !== undefined) {
    return node[config.isLeaf] ?? false;
  }
  return true;
}

/**
 * 获取节点 ID
 */
export function getNodeId(node: TreeNodeData, props: TreePropsConfig = {}): string | number {
  return getNodeIdByConfig(node, resolveTreeConfig(props));
}

/**
 * 获取节点标签
 */
export function getNodeLabel(node: TreeNodeData, props: TreePropsConfig = {}): string {
  return getNodeLabelByConfig(node, resolveTreeConfig(props));
}

/**
 * 获取子节点
 */
export function getNodeChildren(node: TreeNodeData, props: TreePropsConfig = {}): TreeNodeData[] {
  return getNodeChildrenByConfig(node, resolveTreeConfig(props));
}

/**
 * 判断节点是否禁用
 */
export function isNodeDisabled(node: TreeNodeData, props: TreePropsConfig = {}): boolean {
  return isNodeDisabledByConfig(node, resolveTreeConfig(props));
}

/**
 * 判断是否为叶子节点
 */
export function isLeafNode(node: TreeNodeData, props: TreePropsConfig = {}): boolean {
  return isLeafNodeByConfig(node, resolveTreeConfig(props));
}

/**
 * 迭代遍历树节点（替代递归，避免深层树栈溢出）
 * callback 返回 false 时跳过该节点的子树
 */
export function traverseTree(
  nodes: TreeNodeData[],
  callback: (node: TreeNodeData, parent: TreeNodeData | null) => void | boolean,
  parent: TreeNodeData | null = null,
  props: TreePropsConfig = {}
): void {
  const config = resolveTreeConfig(props);
  const stack: { node: TreeNodeData; parent: TreeNodeData | null }[] = [];
  for (let i = nodes.length - 1; i >= 0; i--) {
    stack.push({ node: nodes[i], parent });
  }
  while (stack.length > 0) {
    const { node, parent: currentParent } = stack.pop()!;
    const result = callback(node, currentParent);
    if (result === false) {
      continue;
    }
    const children = getNodeChildrenByConfig(node, config);
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ node: children[i], parent: node });
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
      if (found) {
        return found;
      }
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
  const config = resolveTreeConfig(props);
  traverseTree(
    nodes,
    (node) => {
      keys.push(getNodeIdByConfig(node, config));
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
  const config = resolveTreeConfig(props);
  traverseTree(
    nodes,
    (node) => {
      if (isLeafNodeByConfig(node, config)) {
        keys.push(getNodeIdByConfig(node, config));
      }
    },
    null,
    props
  );
  return keys;
}
