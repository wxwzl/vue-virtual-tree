import { ref, watch } from "vue";
import type { Ref } from "vue";
import type { VirtualTreeProps, FlatTreeNode, TreeNodeData } from "../types";
import { getNodeId, getNodeChildren, isLeafNode } from "../utils/tree";

/**
 * 节点元数据缓存接口
 */
interface NodeMeta {
  parentId: string | number | null;
  childIds: Set<string | number>;
  allDescendantIds: Set<string | number>;
  depth: number;
}

/**
 * 优化的树节点选择逻辑 - O(h) 更新复杂度
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

  // 节点元数据缓存：构建一次，长期使用
  const nodeMetaMap = ref<Map<string | number, NodeMeta>>(new Map());

  // 选中计数缓存：key -> 选中的后代数量
  const checkedCountMap = ref<Map<string | number, number>>(new Map());

  /**
   * 构建节点元数据缓存 - O(n)
   * 预计算所有节点的父子关系和后代集合
   */
  const buildNodeMetaCache = () => {
    const metaMap = new Map<string | number, NodeMeta>();

    // 第一遍：构建基本关系和计算深度
    for (const node of flatTree.value) {
      const childIds = new Set<string | number>(node.children?.map((c) => c.id) || []);
      metaMap.set(node.id, {
        parentId: node.parentId,
        childIds,
        allDescendantIds: new Set(), // 第二遍填充
        depth: node.level,
      });
    }

    // 第二遍：后序遍历计算所有后代（自底向上）
    // 按深度降序遍历，确保子节点先于父节点处理
    const nodesByDepth = [...flatTree.value].sort((a, b) => b.level - a.level);

    for (const node of nodesByDepth) {
      const meta = metaMap.get(node.id)!;
      const allDescendants = new Set<string | number>();

      // 添加直接子节点的所有后代
      for (const childId of meta.childIds) {
        allDescendants.add(childId);
        const childMeta = metaMap.get(childId);
        if (childMeta) {
          childMeta.allDescendantIds.forEach((id) => allDescendants.add(id));
        }
      }

      meta.allDescendantIds = allDescendants;
    }

    nodeMetaMap.value = metaMap;

    // 初始化选中计数缓存
    const countMap = new Map<string | number, number>();
    for (const [id, meta] of metaMap) {
      let count = 0;
      for (const descId of meta.allDescendantIds) {
        if (checkedKeys.value.has(descId)) count++;
      }
      countMap.set(id, count);
    }
    checkedCountMap.value = countMap;
  };

  /**
   * O(h) 更新祖先节点状态
   * 只更新从当前节点到根节点的路径
   */
  const updateAncestorStates = (nodeId: string | number, delta: number) => {
    let currentId: string | number | null = nodeId;

    while (currentId !== null) {
      const meta = nodeMetaMap.value.get(currentId);
      if (!meta) break;

      const parentId = meta.parentId;
      if (parentId === null) break;

      const parentMeta = nodeMetaMap.value.get(parentId);
      if (!parentMeta) break;

      // 更新父节点的选中后代计数
      const currentCount = checkedCountMap.value.get(parentId) || 0;
      const newCount = Math.max(0, currentCount + delta);
      checkedCountMap.value.set(parentId, newCount);

      // 确定父节点的状态
      const parent = getFlatNode(parentId);
      if (parent) {
        const totalChildren = parentMeta.childIds.size;
        let checkedChildren = 0;
        let indeterminateChildren = 0;

        for (const childId of parentMeta.childIds) {
          if (checkedKeys.value.has(childId)) {
            checkedChildren++;
          } else if (halfCheckedKeys.value.has(childId)) {
            indeterminateChildren++;
          }
        }

        // 全选：所有子节点都被选中
        if (checkedChildren === totalChildren && totalChildren > 0) {
          checkedKeys.value.add(parentId);
          halfCheckedKeys.value.delete(parentId);
          parent.isChecked = true;
          parent.isIndeterminate = false;
        }
        // 半选：部分子节点被选中，或有半选子节点
        else if (checkedChildren > 0 || indeterminateChildren > 0 || newCount > 0) {
          checkedKeys.value.delete(parentId);
          halfCheckedKeys.value.add(parentId);
          parent.isChecked = false;
          parent.isIndeterminate = true;
        }
        // 未选
        else {
          checkedKeys.value.delete(parentId);
          halfCheckedKeys.value.delete(parentId);
          parent.isChecked = false;
          parent.isIndeterminate = false;
        }
      }

      currentId = parentId;
    }
  };

  /**
   * 批量更新所有节点状态 - 用于初始化
   * 后序遍历，O(n) 一次性计算
   */
  const batchUpdateAllStates = () => {
    halfCheckedKeys.value.clear();

    // 按深度降序遍历（子节点先于父节点）
    const sortedNodes = [...flatTree.value].sort((a, b) => b.level - a.level);

    for (const node of sortedNodes) {
      const meta = nodeMetaMap.value.get(node.id);
      if (!meta || meta.childIds.size === 0) {
        // 叶子节点，保持当前状态
        continue;
      }

      let checkedChildren = 0;
      let indeterminateChildren = 0;

      for (const childId of meta.childIds) {
        if (checkedKeys.value.has(childId)) {
          checkedChildren++;
        } else if (halfCheckedKeys.value.has(childId)) {
          indeterminateChildren++;
        }
      }

      const totalChildren = meta.childIds.size;

      if (checkedChildren === totalChildren) {
        // 全选
        if (!node.isChecked) {
          checkedKeys.value.add(node.id);
          node.isChecked = true;
        }
        node.isIndeterminate = false;
        halfCheckedKeys.value.delete(node.id);
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
        halfCheckedKeys.value.delete(node.id);
      }
    }
  };

  // 初始化选中的节点（处理父子关联和半选状态）
  const initNodeChecked = () => {
    // 先清除所有节点的选中状态和半选状态
    flatTree.value.forEach((node) => {
      node.isChecked = false;
      node.isIndeterminate = false;
    });

    // 重建缓存（树结构可能已改变）
    buildNodeMetaCache();

    // 如果有默认选中的节点，批量设置
    if (props.defaultCheckedKeys && props.defaultCheckedKeys.length > 0) {
      // 第一遍：添加所有选中的叶子节点
      for (const key of props.defaultCheckedKeys) {
        const node = getFlatNode(key);
        if (node) {
          checkedKeys.value.add(key);
          node.isChecked = true;
          node.isIndeterminate = false;
        }
      }

      // 第二遍：批量计算所有祖先状态
      batchUpdateAllStates();
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
   * 优化的节点选中 - O(h + d) 复杂度
   * h = 树高度, d = 后代节点数
   */
  const setNodeCheckedInTree = (node: FlatTreeNode, checked: boolean) => {
    if (node.isChecked === checked && !node.isIndeterminate) return;

    const nodeId = node.id;
    const meta = nodeMetaMap.value.get(nodeId);

    // 计算选中状态变化量（用于祖先更新）
    const wasCheckedCount = checkedCountMap.value.get(nodeId) || 0;
    const newCheckedCount = checked ? meta?.allDescendantIds.size || 0 : 0;
    const delta = newCheckedCount - wasCheckedCount;

    // 更新当前节点
    node.isChecked = checked;
    node.isIndeterminate = false;
    if (checked) {
      checkedKeys.value.add(nodeId);
    } else {
      checkedKeys.value.delete(nodeId);
    }
    checkedCountMap.value.set(nodeId, newCheckedCount);

    // O(d) 批量更新所有后代
    if (meta && meta.allDescendantIds.size > 0) {
      for (const descId of meta.allDescendantIds) {
        const child = getFlatNode(descId);
        if (child) {
          child.isChecked = checked;
          child.isIndeterminate = false;
          if (checked) {
            checkedKeys.value.add(descId);
          } else {
            checkedKeys.value.delete(descId);
          }
        }
      }

      // 批量更新后代计数
      if (checked) {
        for (const descId of meta.allDescendantIds) {
          const descMeta = nodeMetaMap.value.get(descId);
          if (descMeta) {
            checkedCountMap.value.set(descId, descMeta.allDescendantIds.size);
          }
        }
      } else {
        for (const descId of meta.allDescendantIds) {
          checkedCountMap.value.set(descId, 0);
        }
      }
    }

    // O(h) 更新祖先路径
    updateAncestorStates(nodeId, delta);
  };

  // 设置节点选中状态（考虑父子关联）
  const setNodeChecked = (nodeId: string | number, checked: boolean, checkStrictly?: boolean) => {
    const node = getFlatNode(nodeId);
    if (!node) return;

    const isStrictly = checkStrictly ?? props.checkStrictly ?? false;

    if (isStrictly) {
      // 严格模式：只设置当前节点
      const wasChecked = node.isChecked;
      node.isChecked = checked;
      node.isIndeterminate = false;

      if (checked) {
        checkedKeys.value.add(nodeId);
      } else {
        checkedKeys.value.delete(nodeId);
      }

      // 严格模式下仍需要更新祖先的半选状态
      if (wasChecked !== checked && !isStrictly) {
        const delta = checked ? 1 : -1;
        updateAncestorStates(nodeId, delta);
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
      if (!node) continue;

      if (leafOnly) {
        const meta = nodeMetaMap.value.get(key);
        // 叶子节点：没有子节点
        if (!meta || meta.childIds.size === 0) {
          nodes.push(node);
        }
      } else {
        nodes.push(node);
      }
    }

    return nodes;
  };

  // 获取选中的节点 key
  const getCheckedKeys = (leafOnly: boolean = false): (string | number)[] => {
    if (leafOnly) {
      // 使用缓存的元数据快速筛选叶子节点
      const result: (string | number)[] = [];
      for (const key of checkedKeys.value) {
        const meta = nodeMetaMap.value.get(key);
        if (!meta || meta.childIds.size === 0) {
          result.push(key);
        }
      }
      return result;
    }
    return Array.from(checkedKeys.value);
  };

  // 设置选中的节点 - 批量优化
  const setCheckedNodes = (nodes: TreeNodeData[], leafOnly: boolean = false) => {
    // 清除之前的状态
    checkedKeys.value.clear();
    halfCheckedKeys.value.clear();

    // 清除所有节点的选中状态
    flatTree.value.forEach((node) => {
      node.isChecked = false;
      node.isIndeterminate = false;
    });

    // 批量设置选中
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
    // 清除之前的状态
    checkedKeys.value.clear();
    halfCheckedKeys.value.clear();

    // 清除所有节点的选中状态
    flatTree.value.forEach((node) => {
      node.isChecked = false;
      node.isIndeterminate = false;
    });

    // 批量设置选中
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

  // 监听树结构变化，重建缓存
  watch(
    () => flatTree.value.length,
    () => {
      buildNodeMetaCache();
      // 重建后需要重新计算所有状态
      batchUpdateAllStates();
    }
  );

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
    // 暴露缓存构建函数供外部使用
    buildNodeMetaCache,
    batchUpdateAllStates,
  };
}
