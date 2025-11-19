<template>
  <div class="vue-virtual-tree-node" :class="{
    'is-expanded': node.isExpanded,
    'is-checked': node.isChecked,
    'is-disabled': node.isDisabled,
    'is-leaf': isLeaf,
    'is-loading': node.isLoading,
    'is-dragging': isDragging,
    [`drop-${dropType}`]: dropType
  }" :style="{ paddingLeft: `${node.level * indent}px` }" :draggable="draggable && !node.isDisabled"
    :data-node-id="node.id"
    @dragstart="handleDragStart" @dragenter="handleDragEnter" @dragleave="handleDragLeave" @dragover="handleDragOver"
    @dragend="handleDragEnd" @drop="handleDrop">
    <div class="vue-virtual-tree-node__content">
      <span class="vue-virtual-tree-node__expand-icon" :class="{ 'is-leaf': isLeaf, 'is-loading': node.isLoading }">
        <!-- 图标区域 -->
        <span v-if="node.isLoading">
          <slot name="loading" :node="node" :data="node.data">
          </slot>
        </span>

        <slot v-else name="icon" :node="node" :data="node.data">
        </slot>
      </span>
      <span v-if="showCheckbox" class="vue-virtual-tree-node__checkbox">
        <input type="checkbox" :checked="node.isChecked" :indeterminate="node.isIndeterminate"
          :disabled="node.isDisabled" />
      </span>
      <span class="vue-virtual-tree-node__label">
        <slot :node="node" :data="node.data">
          {{ label }}
        </slot>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FlatTreeNode, TreePropsConfig } from '../types'
import { getNodeLabel, isLeafNode } from '../utils/tree'

interface TreeNodeProps {
  node: FlatTreeNode
  props?: TreePropsConfig
  showCheckbox?: boolean
  expandOnClickNode?: boolean
  draggable?: boolean
  dropType?: 'prev' | 'inner' | 'next' | null
  indent?: number | ((node: FlatTreeNode) => number)
}

const props = defineProps<TreeNodeProps>()

const emit = defineEmits<{
  'drag-start': [node: FlatTreeNode, event: DragEvent]
  'drag-enter': [node: FlatTreeNode, event: DragEvent]
  'drag-leave': [node: FlatTreeNode, event: DragEvent]
  'drag-over': [node: FlatTreeNode, event: DragEvent]
  'drag-end': [node: FlatTreeNode, event: DragEvent]
  'drop': [node: FlatTreeNode, event: DragEvent]
}>()

const isDragging = ref(false)

const label = computed(() => getNodeLabel(props.node.data, props.props))
const isLeaf = computed(() => isLeafNode(props.node.data, props.props))
const indent = computed(() => {
  const indentProp = props.indent
  if (typeof indentProp === 'function') {
    try {
      return indentProp(props.node) ?? 18
    } catch {
      return 18
    }
  }
  return indentProp ?? 18
})

// click 事件已改为事件委托，在父组件 VirtualTree 中统一处理

const handleDragStart = (event: DragEvent) => {
  if (props.node.isDisabled || !props.draggable) return
  isDragging.value = true
  emit('drag-start', props.node, event)
}

const handleDragEnter = (event: DragEvent) => {
  if (!props.draggable) return
  emit('drag-enter', props.node, event)
}

const handleDragLeave = (event: DragEvent) => {
  if (!props.draggable) return
  emit('drag-leave', props.node, event)
}

const handleDragOver = (event: DragEvent) => {
  if (!props.draggable) return
  emit('drag-over', props.node, event)
}

const handleDragEnd = (event: DragEvent) => {
  isDragging.value = false
  emit('drag-end', props.node, event)
}

const handleDrop = (event: DragEvent) => {
  if (!props.draggable) return
  emit('drop', props.node, event)
}
</script>

<style scoped lang="scss">
.vue-virtual-tree-node {
  position: relative;
  user-select: none;

  &__content {
    display: flex;
    align-items: center;
    height: 32px;
    line-height: 32px;
    cursor: pointer;
    transition: background-color 0.2s;
    padding-right: 8px;

    &:hover {
      background-color: #f5f7fa;
    }
  }

  &.is-disabled {
    .vue-virtual-tree-node__content {
      cursor: not-allowed;
      color: #c0c4cc;
    }
  }

  &__expand-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    margin-right: 4px;
    transition: transform 0.2s;
    color: #606266;
    flex-shrink: 0;

    &.is-leaf {
      visibility: hidden;
    }
  }
  &__checkbox {
    margin-right: 8px;
    flex-shrink: 0;

    input[type='checkbox'] {
      cursor: pointer;
    }
  }

  &__label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &.is-dragging {
    opacity: 0.5;
  }

  &.drop-prev::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background-color: #409eff;
    z-index: 1;
  }

  &.drop-next::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background-color: #409eff;
    z-index: 1;
  }

  &.drop-inner {
    background-color: #ecf5ff;
  }
}
</style>
