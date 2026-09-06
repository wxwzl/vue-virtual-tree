import { ref, watch } from "vue";
import type { Ref } from "vue";
import type { VirtualTreeProps, FlatTreeNode, TreeNodeData } from "../types";
import { getNodeId, isLeafNode } from "../utils/tree";

/**
 * 树节点选择逻辑
 *
 * 优化说明（相对旧版）：
 * - 不再预计算 nodeMetaMap / allDescendantIds / checkedCountMap
 *   （旧版每个节点存全部后代 Set，深链树下为 O(n²) 时间与内存）
 * - 父子关系直接复用扁平节点的 children / parentId 链
 * - 全量半选状态：利用 flatTree 的 DFS 先序排列，倒序遍历一次即 O(n) 完成
 * - 单点选中：O(d) 迭代更新后代 + O(h) 沿 parentId 链更新祖先
 */
export function useTreeSelection(
  props: VirtualTreeProps,
  flatTree: Ref<FlatTreeNode[]>,
  getNodeData: (id: string | number) => TreeNodeData | null,
  getFlatNode: (id: string | number) => FlatTreeNode | null
) {
  // 使用 ref 替代 computed，O(1) 访问
  const checkedKeys = ref<Set<string | number>>(new Set());
  const halfCheckedKeys = ref<Set<string | number>>(new Set());

  // 当前选中的节点 key（单选）
  const selectedKey = ref<string | number | null>(null);
  // 当前选中的节点数据
  const currentNode = ref<TreeNodeData | null>(null);

  const getChildren = (node: FlatTreeNode): FlatTreeNode[] => node.children || [];

  const isLeafFlatNode = (node: FlatTreeNode | null): boolean => {
    return !node || !node.children || node.children.length === 0;
  };

  /**
   * O(h × s) 自底向上更新祖先节点状态
   * h = 树高度，s = 每层兄弟节点数；沿 parentId 链逐层统计直接子节点状态
   */
  const updateAncestorStates = (nodeId: string | number) => {
    let parentId: string | number | null = getFlatNode(nodeId)?.parentId ?? null;

    while (parentId !== null) {
      const parent = getFlatNode(parentId);
      if (!parent) {
        break;
      }

      const children = getChildren(parent);
      let checkedChildren = 0;
      let indeterminateChildren = 0;
      for (const child of children) {
        if (checkedKeys.value.has(child.id)) {
          checkedChildren++;
        } else if (halfCheckedKeys.value.has(child.id)) {
          indeterminateChildren++;
        }
      }

      if (children.length > 0 && checkedChildren === children.length) {
        // 全选
        checkedKeys.value.add(parentId);
        halfCheckedKeys.value.delete(parentId);
        parent.isChecked = true;
        parent.isIndeterminate = false;
      } else if (checkedChildren > 0 || indeterminateChildren > 0) {
        // 半选
        checkedKeys.value.delete(parentId);
        halfCheckedKeys.value.add(parentId);
        parent.isChecked = false;
        parent.isIndeterminate = true;
      } else {
        // 未选
        checkedKeys.value.delete(parentId);
        halfCheckedKeys.value.delete(parentId);
        parent.isChecked = false;
        parent.isIndeterminate = false;
      }

      parentId = parent.parentId;
    }
  };

  /**
   * 批量更新所有节点状态 - O(n) 一次性计算
   * flatTree 为 DFS 先序排列（后代 index 恒大于祖先），
   * 倒序遍历即可保证子节点先于父节点处理，无需排序
   */
  const batchUpdateAllStates = () => {
    halfCheckedKeys.value.clear();
    const nodes = flatTree.value;

    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const children = getChildren(node);
      if (children.length === 0) {
        // 叶子节点，保持当前状态
        continue;
      }

      let checkedChildren = 0;
      let indeterminateChildren = 0;
      for (const child of children) {
        if (checkedKeys.value.has(child.id)) {
          checkedChildren++;
        } else if (halfCheckedKeys.value.has(child.id)) {
          indeterminateChildren++;
        }
      }

      if (checkedChildren === children.length) {
        // 全选
        checkedKeys.value.add(node.id);
        node.isChecked = true;
        node.isIndeterminate = false;
      } else if (checkedChildren > 0 || indeterminateChildren > 0) {
        // 半选
        checkedKeys.value.delete(node.id);
        node.isChecked = false;
        node.isIndeterminate = true;
        halfCheckedKeys.value.add(node.id);
      } else {
        // 未选
        checkedKeys.value.delete(node.id);
        node.isChecked = false;
        node.isIndeterminate = false;
      }
    }
  };

  // 初始化选中的节点（处理父子关联和半选状态）
  const initNodeChecked = () => {
    // 无复选框且无默认选中时无需任何处理（新扁平节点默认未选中）
    if (
      !props.showCheckbox &&
      (!props.defaultCheckedKeys || props.defaultCheckedKeys.length === 0)
    ) {
      return;
    }

    // 先清除所有节点的选中状态和半选状态
    const nodes = flatTree.value;
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].isChecked = false;
      nodes[i].isIndeterminate = false;
    }

    // 如果有默认选中的节点，批量设置
    if (props.defaultCheckedKeys && props.defaultCheckedKeys.length > 0) {
      for (const key of props.defaultCheckedKeys) {
        const node = getFlatNode(key);
        if (node) {
          checkedKeys.value.add(key);
          node.isChecked = true;
          node.isIndeterminate = false;
        }
      }

      // 批量计算所有祖先状态
      if (!props.checkStrictly) {
        batchUpdateAllStates();
      }
    }
  };

  // 初始化当前选中节点
  const initCurrentNode = () => {
    if (props.currentNodeKey !== undefined) {
      selectedKey.value = props.currentNodeKey;
      const node = getNodeData(props.currentNodeKey);
      currentNode.value = node;
    }
  };

  /**
   * 更新半选状态 - 使用批量更新
   * 仅为兼容旧 API，实际使用 batchUpdateAllStates
   */
  const updateHalfCheckedKeys = () => {
    batchUpdateAllStates();
  };

  /**
   * 节点选中（关联父子）- O(d + h) 复杂度
   * d = 后代节点数, h = 树高度
   */
  const setNodeCheckedInTree = (node: FlatTreeNode, checked: boolean) => {
    if (node.isChecked === checked && !node.isIndeterminate) {
      return;
    }

    const nodeId = node.id;

    // 更新当前节点
    node.isChecked = checked;
    node.isIndeterminate = false;
    if (checked) {
      checkedKeys.value.add(nodeId);
    } else {
      checkedKeys.value.delete(nodeId);
    }

    // O(d) 迭代更新所有后代（避免递归栈溢出）
    if (node.children && node.children.length > 0) {
      const stack: FlatTreeNode[] = [...node.children];
      while (stack.length > 0) {
        const child = stack.pop()!;
        child.isChecked = checked;
        child.isIndeterminate = false;
        if (checked) {
          checkedKeys.value.add(child.id);
        } else {
          checkedKeys.value.delete(child.id);
        }
        if (child.children && child.children.length > 0) {
          for (let i = child.children.length - 1; i >= 0; i--) {
            stack.push(child.children[i]);
          }
        }
      }
    }

    // O(h) 更新祖先路径
    updateAncestorStates(nodeId);
  };

  // 设置节点选中状态（考虑父子关联）
  const setNodeChecked = (nodeId: string | number, checked: boolean, checkStrictly?: boolean) => {
    const node = getFlatNode(nodeId);
    if (!node) {
      return;
    }

    const isStrictly = checkStrictly ?? props.checkStrictly ?? false;

    if (isStrictly) {
      // 严格模式：只设置当前节点
      node.isChecked = checked;
      node.isIndeterminate = false;

      if (checked) {
        checkedKeys.value.add(nodeId);
      } else {
        checkedKeys.value.delete(nodeId);
      }
    } else {
      // 非严格模式：关联父子节点
      setNodeCheckedInTree(node, checked);
    }
  };

  // 切换节点选中状态
  const toggleNodeChecked = (nodeId: string | number) => {
    const isChecked = checkedKeys.value.has(nodeId);
    setNodeChecked(nodeId, !isChecked);
  };

  // 设置当前选中节点
  const setCurrentNode = (key: string | number | null, node: TreeNodeData | null = null) => {
    selectedKey.value = key;
    currentNode.value = node;
  };

  // 获取选中的节点数据
  const getCheckedNodes = (
    leafOnly: boolean = false,
    includeHalfChecked: boolean = false
  ): TreeNodeData[] => {
    const nodes: TreeNodeData[] = [];
    const keys = includeHalfChecked
      ? new Set([...checkedKeys.value, ...halfCheckedKeys.value])
      : checkedKeys.value;

    for (const key of keys) {
      const node = getNodeData(key);
      if (!node) {
        continue;
      }

      if (leafOnly && !isLeafFlatNode(getFlatNode(key))) {
        continue;
      }
      nodes.push(node);
    }

    return nodes;
  };

  // 获取选中的节点 key
  const getCheckedKeys = (leafOnly: boolean = false): (string | number)[] => {
    if (leafOnly) {
      const result: (string | number)[] = [];
      for (const key of checkedKeys.value) {
        if (isLeafFlatNode(getFlatNode(key))) {
          result.push(key);
        }
      }
      return result;
    }
    return Array.from(checkedKeys.value);
  };

  /** 清空所有节点选中状态 */
  const clearAllCheckedStates = () => {
    checkedKeys.value.clear();
    halfCheckedKeys.value.clear();
    const nodes = flatTree.value;
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].isChecked = false;
      nodes[i].isIndeterminate = false;
    }
  };

  // 设置选中的节点 - 批量优化
  const setCheckedNodes = (nodes: TreeNodeData[], leafOnly: boolean = false) => {
    clearAllCheckedStates();

    const keys = nodes
      .filter((node) => {
        if (leafOnly) {
          return isLeafNode(node, props.props);
        }
        return true;
      })
      .map((node) => getNodeId(node, props.props));

    for (const key of keys) {
      const node = getFlatNode(key);
      if (node) {
        checkedKeys.value.add(key);
        node.isChecked = true;
      }
    }

    // 批量更新所有状态
    if (!props.checkStrictly) {
      batchUpdateAllStates();
    }
  };

  // 设置选中的节点 key - 批量优化
  const setCheckedKeys = (keys: (string | number)[], leafOnly: boolean = false) => {
    clearAllCheckedStates();

    const keysToSet = leafOnly
      ? keys.filter((key) => {
          const node = getNodeData(key);
          return node && isLeafNode(node, props.props);
        })
      : keys;

    for (const key of keysToSet) {
      const node = getFlatNode(key);
      if (node) {
        checkedKeys.value.add(key);
        node.isChecked = true;
      }
    }

    // 批量更新所有状态
    if (!props.checkStrictly) {
      batchUpdateAllStates();
    }
  };

  // 初始化
  initCurrentNode();

  // 监听 props.currentNodeKey 变化
  watch(
    () => props.currentNodeKey,
    (newKey) => {
      if (newKey !== undefined) {
        setCurrentNode(newKey, getNodeData(newKey));
      }
    }
  );

  // 监听 defaultCheckedKeys 变化
  watch(
    () => props.defaultCheckedKeys,
    () => {
      initNodeChecked();
    },
    { deep: true }
  );

  return {
    checkedKeys,
    halfCheckedKeys,
    selectedKey,
    currentNode,
    initNodeChecked,
    setNodeChecked,
    toggleNodeChecked,
    setCurrentNode,
    getCheckedNodes,
    getCheckedKeys,
    setCheckedNodes,
    setCheckedKeys,
    updateHalfCheckedKeys,
    batchUpdateAllStates,
  };
}
