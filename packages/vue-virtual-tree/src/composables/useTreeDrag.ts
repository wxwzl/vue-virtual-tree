import { ref } from "vue";
import type { VirtualTreeProps, FlatTreeNode, TreeNodeData } from "../types";
import { getNodeId, getNodeChildren } from "../utils/tree";

/**
 * 拖拽类型
 */
export type DropType = "prev" | "inner" | "next";

/**
 * 树节点拖拽逻辑
 */
export function useTreeDrag(
  props: VirtualTreeProps,
  getNodeData: (id: string | number) => TreeNodeData | null
) {
  const draggingNode = ref<FlatTreeNode | null>(null);
  const dropNode = ref<FlatTreeNode | null>(null);
  const dropType = ref<DropType | null>(null);

  // 默认允许拖拽
  const defaultAllowDrag = (_node: TreeNodeData): boolean => {
    return true;
  };

  // 默认允许放置
  const defaultAllowDrop = (
    draggingNode: TreeNodeData,
    dropNode: TreeNodeData,
    type: DropType,
    props: VirtualTreeProps
  ): boolean => {
    // 不能拖拽到自己内部
    if (type === "inner") {
      const draggingId = getNodeId(draggingNode, props.props);
      const isDescendant = (node: TreeNodeData): boolean => {
        if (getNodeId(node, props.props) === draggingId) return true;
        const children = getNodeChildren(node, props.props);
        return children.some((child) => isDescendant(child));
      };
      return !isDescendant(dropNode);
    }
    return true;
  };

  // 开始拖拽
  const handleDragStart = (node: FlatTreeNode, event: DragEvent) => {
    draggingNode.value = node;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  };

  // 拖拽进入
  const handleDragEnter = (node: FlatTreeNode, event: DragEvent) => {
    if (!draggingNode.value) return;

    const draggingData = getNodeData(draggingNode.value.id);
    const dropData = getNodeData(node.id);

    if (!draggingData || !dropData) return;

    // 判断是否允许拖拽
    const allowDrag = props.allowDrag || defaultAllowDrag;
    if (!allowDrag(draggingData)) {
      return;
    }

    dropNode.value = node;

    // 计算拖拽位置类型
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const y = event.clientY - rect.top;
    const height = rect.height;
    const threshold = height / 3;

    if (y < threshold) {
      dropType.value = "prev";
    } else if (y > height - threshold) {
      dropType.value = "next";
    } else {
      dropType.value = "inner";
    }

    // 判断是否允许放置
    const allowDrop =
      props.allowDrop ||
      ((dragging, dropping, type) => defaultAllowDrop(dragging, dropping, type, props));
    if (!allowDrop(draggingData, dropData, dropType.value)) {
      dropType.value = null;
      return;
    }

    event.preventDefault();
  };

  // 拖拽离开
  const handleDragLeave = (node: FlatTreeNode, event: DragEvent) => {
    // 检查是否真的离开了节点（而不是进入子元素）
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (relatedTarget && (event.currentTarget as HTMLElement).contains(relatedTarget)) {
      return;
    }
    if (dropNode.value?.id === node.id) {
      dropNode.value = null;
      dropType.value = null;
    }
  };

  // 拖拽悬停
  const handleDragOver = (node: FlatTreeNode, event: DragEvent) => {
    if (!draggingNode.value || !dropNode.value || dropNode.value.id !== node.id) return;

    const draggingData = getNodeData(draggingNode.value.id);
    const dropData = getNodeData(node.id);

    if (!draggingData || !dropData) return;

    // 计算拖拽位置类型
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const y = event.clientY - rect.top;
    const height = rect.height;
    const threshold = height / 3;

    let newDropType: DropType;
    if (y < threshold) {
      newDropType = "prev";
    } else if (y > height - threshold) {
      newDropType = "next";
    } else {
      newDropType = "inner";
    }

    // 判断是否允许放置
    const allowDrop =
      props.allowDrop ||
      ((dragging, dropping, type) => defaultAllowDrop(dragging, dropping, type, props));
    if (!allowDrop(draggingData, dropData, newDropType)) {
      dropType.value = null;
      event.preventDefault();
      return;
    }

    dropType.value = newDropType;
    event.preventDefault();
  };

  // 拖拽结束
  const handleDragEnd = (_node: FlatTreeNode, _event: DragEvent) => {
    draggingNode.value = null;
    dropNode.value = null;
    dropType.value = null;
  };

  // 放置
  const handleDrop = (node: FlatTreeNode, _event: DragEvent) => {
    if (!draggingNode.value || !dropNode.value || dropType.value === null) {
      return;
    }

    const draggingData = getNodeData(draggingNode.value.id);
    const dropData = getNodeData(node.id);

    if (!draggingData || !dropData) return;

    // 判断是否允许放置
    const allowDrop =
      props.allowDrop ||
      ((dragging, dropping, type) => defaultAllowDrop(dragging, dropping, type, props));
    if (!allowDrop(draggingData, dropData, dropType.value)) {
      return;
    }

    // 这里不直接修改数据，而是通过事件通知父组件
    // 父组件负责更新数据

    draggingNode.value = null;
    dropNode.value = null;
    const finalDropType = dropType.value;
    dropType.value = null;

    return {
      draggingNode: draggingData,
      dropNode: dropData,
      dropType: finalDropType,
    };
  };

  return {
    draggingNode,
    dropNode,
    dropType,
    handleDragStart,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDragEnd,
    handleDrop,
  };
}
