import { FlatTreeNode, TreeNodeData, TreePropsConfig, VirtualTreeProps } from "@/types";
import {
  getAllKeys,
  getNodeChildren,
  getNodeId,
  getNodeLabel,
  isLeafNode,
  isNodeDisabled,
} from "../../utils/tree";
import { mergeSort } from "./utils";

// 默认过滤方法
const defaultFilterMethod = (value: string, data: any, props: TreePropsConfig): boolean => {
  if (!value) return true;
  const label = getNodeLabel(data, props);
  return label.toLowerCase().includes(value.toLowerCase());
};

let _visibleNodes: Array<FlatTreeNode> = [];
let _watchVisibleNodes: (nodes: Array<FlatTreeNode>) => void;
export default class DataEngine {
  public expandedKeys: Set<string | number> = new Set();
  public checkedKeys: Set<string | number> = new Set();
  public selectedKey: string | number | null = null;
  public currentNode: TreeNodeData | null = null;
  public halfCheckedKeys: Set<string | number> = new Set();
  private rawData: TreeNodeData[] = [];
  private flatTree: Array<FlatTreeNode> = [];
  private flatNodeMap: Map<string | number, FlatTreeNode> = new Map();
  private visibleNodes: { value: Array<FlatTreeNode> } = new Proxy({
    value: _visibleNodes
  }, {
    get(target: { value: Array<FlatTreeNode> }, property, receiver: any): any {
      return new Proxy(_visibleNodes, {
        get(target: Array<FlatTreeNode>, property, receiver: any): any {
          // 拦截数组方法
          if (typeof target[property as unknown as number] === "function") {
            return function (...args: any[]) {
              const result = Reflect.apply(
                target[property as unknown as number] as unknown as Function,
                target,
                args
              );
              _watchVisibleNodes?.(target as Array<FlatTreeNode>);

              return result;
            };
          }

          // 拦截属性访问
          return Reflect.get(target, property, receiver);
        },
      });
    },
    set(_target: { value: Array<FlatTreeNode> }, _property, value: any, _receiver: any): boolean {
      _visibleNodes = value as Array<FlatTreeNode>;
      return true;
    },
  });
  private filteredFlatTree: Array<FlatTreeNode> = [];
  private filteredFlatNodeMap: Map<string | number, FlatTreeNode> = new Map();
  private isFiltered: boolean = false;
  private config: TreePropsConfig = {};
  private props: Omit<VirtualTreeProps, "data"> = {};

  constructor(
    data: Array<TreeNodeData>,
    props?: VirtualTreeProps,
    watchVisibleNodes?: (nodes: Array<FlatTreeNode>) => void
  ) {
    _watchVisibleNodes = watchVisibleNodes || (() => { });
    this.loadTree(data, props);
  }
  getTreeDataWrapper(): Array<FlatTreeNode> {
    return this.isFiltered ? this.filteredFlatTree : this.flatTree;
  }
  getTreeDataMapWrapper(): Map<string | number, FlatTreeNode> {
    return this.isFiltered ? this.filteredFlatNodeMap : this.flatNodeMap;
  }
  loadTree(data: TreeNodeData[], props?: VirtualTreeProps): void {
    this.rawData = data;
    if (props) {
      this.props = props as Omit<VirtualTreeProps, "data">;
      this.config = props?.props || {};
    }
    const { flatNodes, nodeMap, visibleNodes } = this.flattenTree(
      data,
      0,
      null,
      0,
      true,
      this.config
    );
    this.flatTree = flatNodes;
    this.flatNodeMap = nodeMap;
    this.setVisibleNodes(visibleNodes);
  }

  refreshVisibleIndexes(): void {
    this.visibleNodes.value.forEach((node, index) => {
      node.visibleIndex = index;
    });
  }

  setVisibleNodes(nodes: Array<FlatTreeNode>): void {
    this.visibleNodes.value = nodes;
    this.refreshVisibleIndexes();
  }
  getNodeData(id: string | number): TreeNodeData | null {
    const flatNode = this.getTreeDataMapWrapper().get(id);
    return flatNode ? flatNode.data : null;
  }
  getFlatNode(id: string | number): FlatTreeNode | null {
    return this.getTreeDataMapWrapper().get(id) || null;
  }
  flattenTree(
    nodes: TreeNodeData[],
    level: number = 0,
    parentNode: FlatTreeNode | null = null,
    startIndex: number = 0,
    visible: boolean = true,
    config?: TreePropsConfig
  ): {
    nodes: FlatTreeNode[];
    flatNodes: FlatTreeNode[];
    nodeMap: Map<string | number, FlatTreeNode>;
    visibleNodes: FlatTreeNode[];
  } {
    const map = new Map<string | number, FlatTreeNode>();
    const visibleList: FlatTreeNode[] = [];
    const genenrateFlatNodes = (
      nodes: TreeNodeData[],
      level: number = 0,
      parentNode: FlatTreeNode | null = null,
      startIndex: number = 0,
      visible: boolean = true,
      container: FlatTreeNode[] = [],
      config?: TreePropsConfig
    ): { nodes: FlatTreeNode[]; index: number } => {
      const result: FlatTreeNode[] = [];
      let length = nodes.length;
      for (let i = 0; i < length; i++) {
        startIndex++;
        const node: TreeNodeData = nodes[i];
        const id = getNodeId(node, config);
        const children = getNodeChildren(node, config);
        const isExpanded = this.expandedKeys.has(id);
        const isLeaf = isLeafNode(node, config);

        const flatNode: FlatTreeNode = {
          id,
          data: node,
          level,
          parentId: parentNode?.id || null,
          index: startIndex,
          isExpanded,
          isDisabled: isNodeDisabled(node, config),
          isLeaf: isLeaf,
          isLoading: false,
          isLoaded: false,
          isChecked: false,
          rawChildren: children.length > 0 ? children : undefined,
        };
        result.push(flatNode);
        container.push(flatNode);
        if (visible) {
          visibleList.push(flatNode);
        }
        // 如果节点展开且有子节点，递归处理子节点
        if (children.length > 0) {
          const { nodes: childNodes, index } = genenrateFlatNodes(
            children,
            level + 1,
            flatNode,
            startIndex,
            isExpanded && visible,
            container,
            config
          );
          flatNode.children = childNodes;
          startIndex = index;
        }
        map.set(id, flatNode);
      }

      return { nodes: result, index: startIndex };
    };

    const container: FlatTreeNode[] = [];
    const { nodes: result } = genenrateFlatNodes(
      nodes,
      level,
      parentNode,
      startIndex,
      visible,
      container,
      config
    );
    return { nodes: result, flatNodes: container, nodeMap: map, visibleNodes: visibleList };
  }

  insertFlatTree(node: FlatTreeNode, children: TreeNodeData[]) {
    const {
      nodes: result,
      flatNodes: container,
      nodeMap,
    } = this.flattenTree(children, node.level + 1, node, node.index + 1, true, this.config);
    node.children = result;
    nodeMap.forEach((value, key) => {
      this.flatNodeMap.set(key, value);
    });
    this.flatTree.splice(node.index + 1, 0, ...container);
    requestAnimationFrame(() => {
      for (let i = node.index + container.length; i < this.flatTree.length; i++) {
        const child = this.flatTree[i];
        child.index = i;
      }
    });
  }
  // 初始化展开的节点
  initExpandedKeys() {
    // 重置展开状态
    if (this.props.defaultExpandAll) {
      const allKeys = getAllKeys(this.rawData, this.config);
      this.expandedKeys = new Set(allKeys);
    } else if (this.props.defaultExpandedKeys && this.props.defaultExpandedKeys.length > 0) {
      this.expandedKeys = new Set(this.props.defaultExpandedKeys);
    } else {
      this.expandedKeys = new Set();
    }
  }
  // 初始化选中的节点（处理父子关联和半选状态）
  initNodeChecked() {
    // 先清除所有节点的选中状态和半选状态
    this.flatTree.forEach((node) => {
      node.isChecked = false;
      node.isIndeterminate = false;
    });

    // 如果有默认选中的节点，设置它们并处理父子关联
    if (this.props.defaultCheckedKeys && this.props.defaultCheckedKeys.length > 0) {
      this.props.defaultCheckedKeys.forEach((key) => {
        const node = this.getFlatNode(key);
        if (node) {
          this.setNodeChecked(key, true);
        }
      });
    }
  }

  // 设置节点选中状态（考虑父子关联）
  setNodeChecked(nodeId: string | number, checked: boolean, checkStrictly?: boolean) {
    const node = this.getFlatNode(nodeId);
    if (!node) return;

    const isStrictly = checkStrictly ?? this.props.checkStrictly ?? false;

    if (isStrictly) {
      // 严格模式：只设置当前节点
      node.isChecked = checked;
      node.isIndeterminate = false;
    } else {
      // 非严格模式：关联父子节点
      this.setNodeCheckedInTree(node, checked);
    }
  }

  // 直接操作flatTree中的节点状态
  setNodeCheckedInTree(node: FlatTreeNode, checked: boolean) {
    node.isChecked = checked;
    node.isIndeterminate = false;

    // 递归处理子节点
    const setChildrenChecked = (parentNode: FlatTreeNode, checkedState: boolean) => {
      if (parentNode.children) {
        parentNode.children.forEach((child) => {
          child.isChecked = checkedState;
          child.isIndeterminate = false;
          setChildrenChecked(child, checkedState);
        });
      }
    };
    setChildrenChecked(node, checked);

    // 更新父节点的选中状态
    const updateParentChecked = (childNode: FlatTreeNode) => {
      const parentId = childNode.parentId;
      if (parentId !== null) {
        const parent = this.getFlatNode(parentId);
        if (parent) {
          const siblings = parent.children || [];
          const checkedCount = siblings.filter((n) => n.isChecked).length;
          const indeterminateCount = siblings.filter((n) => n.isIndeterminate).length;

          if (checkedCount === siblings.length) {
            // 所有子节点都选中
            parent.isChecked = true;
            parent.isIndeterminate = false;
          } else if (checkedCount === 0 && indeterminateCount === 0) {
            // 所有子节点都未选中
            parent.isChecked = false;
            parent.isIndeterminate = false;
          } else {
            // 部分选中
            parent.isChecked = false;
            parent.isIndeterminate = true;
          }

          // 递归更新父节点
          updateParentChecked(parent);
        }
      }
    };
    updateParentChecked(node);
  }

  // 初始化当前选中节点
  initCurrentNode() {
    if (this.props.currentNodeKey !== undefined) {
      this.selectedKey = this.props.currentNodeKey;
      const node = this.getNodeData(this.props.currentNodeKey);
      this.currentNode = node;
    }
  }

  // 获取节点的所有子节点 key（从原始数据递归获取，包括未展开的子节点）
  getAllChildrenKeys(nodeId: string | number): (string | number)[] {
    const keys: (string | number)[] = [];
    const nodeData = this.getNodeData(nodeId);
    if (!nodeData) return keys;

    // 从原始数据递归获取所有子节点
    const traverse = (data: TreeNodeData) => {
      const children = getNodeChildren(data, this.props.props);
      children.forEach((child) => {
        const childId = getNodeId(child, this.props.props);
        keys.push(childId);
        // 递归获取子节点的子节点
        traverse(child);
      });
    };

    traverse(nodeData);
    return keys;
  }

  // 更新半选状态
  updateHalfCheckedKeys() {
    this.halfCheckedKeys.clear();
    const allKeys = new Set(this.flatTree.map((n) => n.id));

    for (const key of allKeys) {
      const childrenKeys = this.getAllChildrenKeys(key);
      if (childrenKeys.length === 0) continue;

      const checkedChildren = childrenKeys.filter((k) => this.checkedKeys.has(k));
      if (checkedChildren.length > 0 && checkedChildren.length < childrenKeys.length) {
        this.halfCheckedKeys.add(key);
      }
    }
  }
  // 切换节点选中状态
  toggleNodeChecked(nodeId: string | number) {
    const isChecked = this.checkedKeys.has(nodeId);
    this.setNodeChecked(nodeId, !isChecked);
  }

  // 设置当前选中节点
  setCurrentNode(key: string | number | null, node: TreeNodeData | null = null) {
    this.selectedKey = key;
    this.currentNode = node;
  }
  // 获取选中的节点数据
  getCheckedNodes(leafOnly: boolean = false, includeHalfChecked: boolean = false): TreeNodeData[] {
    const nodes: TreeNodeData[] = [];
    const keys = includeHalfChecked
      ? new Set([...this.checkedKeys, ...this.halfCheckedKeys])
      : this.checkedKeys;

    for (const key of keys) {
      const node = this.getNodeData(key);
      if (!node) continue;

      if (leafOnly) {
        const children = getNodeChildren(node, this.props.props);
        if (children.length === 0) {
          nodes.push(node);
        }
      } else {
        nodes.push(node);
      }
    }

    return nodes;
  }

  // 获取选中的节点 key
  getCheckedKeys(leafOnly: boolean = false): (string | number)[] {
    if (leafOnly) {
      const leafNodes = this.getCheckedNodes(true);
      return leafNodes.map((node) => getNodeId(node, this.props.props));
    }
    return Array.from(this.checkedKeys);
  }

  // 设置选中的节点
  setCheckedNodes(nodes: TreeNodeData[], leafOnly: boolean = false) {
    this.checkedKeys.clear();
    const keys = nodes
      .filter((node) => {
        if (leafOnly) {
          return isLeafNode(node, this.props.props);
        }
        return true;
      })
      .map((node) => getNodeId(node, this.props.props));
    keys.forEach((key) => {
      this.setNodeChecked(key, true);
    });
    if (!this.props.checkStrictly) {
      this.updateHalfCheckedKeys();
    }
  }

  // 设置选中的节点 key
  setCheckedKeys(keys: (string | number)[], leafOnly: boolean = false) {
    this.checkedKeys.clear();
    const keysToSet = leafOnly
      ? keys.filter((key) => {
        const node = this.getNodeData(key);
        return node && isLeafNode(node, this.props.props);
      })
      : keys;
    keysToSet.forEach((key) => {
      this.setNodeChecked(key, true);
    });
    if (!this.props.checkStrictly) {
      this.updateHalfCheckedKeys();
    }
  }
  rebuildVisibleNodes() {
    const roots = this.flatTree.filter((node) => node.parentId === null);
    const result: FlatTreeNode[] = [];
    const traverse = (node: FlatTreeNode) => {
      result.push(node);
      if (node.isExpanded && node.children) {
        node.children.forEach((child: FlatTreeNode) => traverse(child));
      }
    };
    roots.forEach((root: FlatTreeNode) => traverse(root));
    this.setVisibleNodes(result);
  }

  /**
   * 克隆节点（浅拷贝基本属性，children 需要重新构造）
   */
  cloneNode(node: FlatTreeNode): FlatTreeNode {
    return {
      ...node,
      children: undefined, // children 需要重新构造
    };
  }

  // 过滤节点
  filter(value: string) {
    this.filteredFlatTree = [];
    this.filteredFlatNodeMap = new Map();
    if (!value) {
      this.isFiltered = false;
      this.flatTree.forEach((node: FlatTreeNode) => {
        if (!node.isLeaf) {
          node.isExpanded = true;
          this.expandedKeys.add(node.id);
        }
      });
      this.rebuildVisibleNodes();
      return Promise.resolve();
    }
    this.isFiltered = true;
    this.expandedKeys.clear();
    return new Promise(async (resolve) => {
      const filterMethod = this.props.filterNodeMethod || defaultFilterMethod;

      // 第一步：收集所有匹配的节点（包括需要显示的父节点），并克隆它们
      const clonedNodes = new Map<string | number, FlatTreeNode>();

      // 收集直接匹配的节点并克隆
      this.flatTree.forEach((node: FlatTreeNode) => {
        if (filterMethod(value, node.data, this.props.props as TreePropsConfig)) {
          // 克隆匹配的节点
          if (!clonedNodes.has(node.id)) {
            clonedNodes.set(node.id, this.cloneNode(node));
          }

          // 收集并克隆所有父节点
          let parentId: string | number | null = node.parentId;
          while (parentId) {
            const parentNode = this.flatNodeMap.get(parentId);
            if (parentNode && !clonedNodes.has(parentId)) {
              clonedNodes.set(parentId, this.cloneNode(parentNode));
            }
            parentId = parentNode?.parentId || null;
          }
        }
      });

      // 第二步：根据 parentId 关系重建每个节点的 children 属性
      clonedNodes.forEach((clonedNode) => {
        this.filteredFlatNodeMap.set(clonedNode.id, clonedNode);
        // 查找所有子节点（在 clonedNodes 中的）
        const children: FlatTreeNode[] = [];
        clonedNodes.forEach((childNode) => {
          if (childNode.parentId === clonedNode.id) {
            children.push(childNode);
          }
        });

        // 按 index 排序子节点，保持原始顺序
        if (children.length > 0) {
          clonedNode.children = mergeSort(children);
          clonedNode.isExpanded = true;
          this.expandedKeys.add(clonedNode.id);
        } else {
          clonedNode.children = undefined;
          clonedNode.isLeaf = true;
        }
      });

      // 第三步：按 index 排序
      const sortedNodes = mergeSort(Array.from(clonedNodes.values()));

      this.setVisibleNodes(sortedNodes);
      this.filteredFlatTree = sortedNodes;
      resolve(void 0);
    });
  }

  collectVisibleDescendants(parent: FlatTreeNode): FlatTreeNode[] {
    const result: FlatTreeNode[] = [];
    if (!parent.children) return result;
    parent.children.forEach((child) => {
      result.push(child);
      if (child.isExpanded) {
        result.push(...this.collectVisibleDescendants(child));
      }
    });
    return result;
  }

  expandVisibleNode(node: FlatTreeNode) {
    if (typeof node.visibleIndex !== "number") return;
    const descendants = this.collectVisibleDescendants(node);
    if (descendants.length === 0) return;
    this.visibleNodes.value.splice(node.visibleIndex + 1, 0, ...descendants);
    this.refreshVisibleIndexes();
  }
  collapseVisibleNode(node: FlatTreeNode) {
    if (typeof node.visibleIndex !== "number") return;
    const children = this.collectVisibleDescendants(node);
    if (children.length === 0) return;
    this.visibleNodes.value.splice(node.visibleIndex + 1, children.length);
    this.refreshVisibleIndexes();
  }

  /**
   * 展开节点
   */
  expandNode(node: FlatTreeNode) {
    if (this.props.accordion) {
      // 手风琴模式：折叠同级其他节点
      // 查找兄弟节点（需要从flatTree中查找，因为node.parentId可能为null）
      const siblings = this.flatTree.filter(
        (n: FlatTreeNode) => n.parentId === node.parentId && n.id !== node.id && n.isExpanded
      );
      siblings.forEach((sibling: FlatTreeNode) => {
        sibling.isExpanded = false;
        this.expandedKeys.delete(sibling.id);
        this.collapseVisibleNode(sibling);
      });
    }

    // 展开当前节点
    node.isExpanded = true;
    this.expandedKeys.add(node.id);
    this.expandVisibleNode(node);
  }

  setRecursionExpanded(node: FlatTreeNode, isExpanded: boolean) {
    node.isExpanded = isExpanded;
    if (isExpanded) {
      this.expandedKeys.add(node.id);
    } else {
      this.expandedKeys.delete(node.id);
    }
    if (node.children) {
      node.children.forEach((child) => {
        this.setRecursionExpanded(child, isExpanded);
      });
    }
  }
  /**
   * 折叠节点
   */
  collapseNode(node: FlatTreeNode) {
    this.collapseVisibleNode(node);
    this.setRecursionExpanded(node, false);
  }

  /**
   * 切换节点展开状态
   */
  toggleNode(node: FlatTreeNode) {
    if (node.isExpanded) {
      this.collapseNode(node);
    } else {
      this.expandNode(node);
    }
  }
  refreshCheckedKeys() {
    const keys = new Set<string | number>();
    this.flatTree.forEach((node: FlatTreeNode) => {
      if (node.isChecked) {
        keys.add(node.id);
      }
    });
    this.checkedKeys = keys;
  }
  refreshHalfCheckedKeys() {
    const keys = new Set<string | number>();
    this.flatTree.forEach((node: FlatTreeNode) => {
      if (node.isIndeterminate) {
        keys.add(node.id);
      }
    });
    this.halfCheckedKeys = keys;
  }
}
