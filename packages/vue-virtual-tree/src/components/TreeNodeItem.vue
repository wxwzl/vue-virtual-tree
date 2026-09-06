<template>
  <TreeNode
    :node="item"
    :index="index"
    :props="props"
    :show-checkbox="showCheckbox"
    :expand-on-click-node="expandOnClickNode"
    :draggable="draggable"
    :indent="indent"
    :current-key="currentKey"
    :drop-type="dropType"
    class="vue-virtual-tree-item__node"
  >
    <template #default="{ node, data }">
      <slot
        :node="node"
        :data="data"
      ></slot>
    </template>
    <template #loading="{ node, data }">
      <slot
        name="loading"
        :node="node"
        :data="data"
      >
        <!-- 默认loading图标 -->
        <svg
          class="vue-virtual-tree-node__loading-icon"
          viewBox="0 0 24 24"
          width="16"
          height="16"
        >
          <g transform="translate(12,12)">
            <!-- 轨道圆环 -->
            <circle
              cx="0"
              cy="0"
              r="8"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
              opacity="0.2"
            />
            <!-- 旋转的3个点 -->
            <g class="vue-virtual-tree-loading-dots">
              <circle
                cx="0"
                cy="-8"
                r="2"
                fill="currentColor"
              />
              <circle
                cx="6.928"
                cy="-4"
                r="2"
                fill="currentColor"
                opacity="0.7"
              />
              <circle
                cx="6.928"
                cy="4"
                r="2"
                fill="currentColor"
                opacity="0.4"
              />
            </g>
          </g>
        </svg>
      </slot>
    </template>
    <template #icon="{ node, data }">
      <slot
        name="icon"
        :node="node"
        :data="data"
      >
        <!-- 默认图标 -->
        <span class="default-icon">
          <svg
            v-if="!node.isLeaf"
            viewBox="0 0 1024 1024"
            width="16"
            height="16"
          >
            <path
              d="M384 384l256 256-256 256z"
              fill="currentColor"
            />
          </svg>
        </span>
      </slot>
    </template>
  </TreeNode>
</template>

<script setup lang="ts">
  import TreeNode from "./TreeNode.vue";
  import type { FlatTreeNode, TreePropsConfig } from "../types";

  /**
   * 单行节点渲染（供 RecycleScroller / DynamicScroller 两种模式复用）
   * TreeNode 的 drag 事件通过 $attrs 透传，无需重新声明
   */
  interface TreeNodeItemProps {
    item: FlatTreeNode;
    index: number;
    props?: TreePropsConfig;
    showCheckbox?: boolean;
    expandOnClickNode?: boolean;
    draggable?: boolean;
    indent?: number | ((node: FlatTreeNode) => number);
    currentKey?: string | number | null;
    dropType?: "prev" | "inner" | "next" | null;
  }

  defineProps<TreeNodeItemProps>();

  defineOptions({
    name: "TreeNodeItem",
    inheritAttrs: true,
  });
</script>

<style scoped lang="scss">
  /* 这些样式作用的元素（默认图标 / 默认 loading 图标）在本组件模板内，
     必须跟随组件迁移，否则 scoped 选择器匹配不到 */
  .vue-virtual-tree-node {
    &.is-expanded .vue-virtual-tree-node__expand-icon .default-icon {
      transform: rotate(90deg);
    }

    &.is-loading {
      .vue-virtual-tree-node__expand-icon {
        color: #409eff;
      }
    }

    &__loading-icon {
      animation: vue-virtual-tree-loading-rotate 1.5s linear infinite;
    }

    &__loading-dots {
      animation: vue-virtual-tree-loading-dots-rotate 1.5s linear infinite;
    }

    @keyframes vue-virtual-tree-loading-rotate {
      0% {
        transform: rotate(0deg);
      }

      100% {
        transform: rotate(360deg);
      }
    }

    @keyframes vue-virtual-tree-loading-dots-rotate {
      0% {
        transform: rotate(0deg);
      }

      100% {
        transform: rotate(360deg);
      }
    }
  }
</style>
