<template>
  <div
    class="vue-virtual-tree-node"
    :class="{
      'is-expanded': node.isExpanded,
      'is-checked': node.isChecked,
      'is-disabled': node.isDisabled,
      'is-leaf': isLeaf,
      'is-loading': node.isLoading,
      'is-dragging': isDragging,
      [`drop-${dropType}`]: dropType
    }"
    :style="{ paddingLeft: `${node.level * 18}px` }"
    :draggable="draggable && !node.isDisabled"
    @dragstart="handleDragStart"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover="handleDragOver"
    @dragend="handleDragEnd"
    @drop="handleDrop"
  >
    <div class="vue-virtual-tree-node__content" @click="handleClick">
      <span
        class="vue-virtual-tree-node__expand-icon"
        :class="{ 'is-leaf': isLeaf, 'is-loading': node.isLoading }"
        @click.stop="handleExpandClick"
      >
        <!-- Loading 图标 -->
        <svg v-if="node.isLoading" class="vue-virtual-tree-node__loading-icon" viewBox="0 0 24 24" width="16" height="16">
          <g transform="translate(12,12)">
            <!-- 轨道圆环 -->
            <circle cx="0" cy="0" r="8" fill="none" stroke="currentColor" stroke-width="1" opacity="0.2"/>
            <!-- 旋转的3个点 -->
            <g class="vue-virtual-tree-loading-dots">
              <circle cx="0" cy="-8" r="2" fill="currentColor"/>
              <circle cx="6.928" cy="-4" r="2" fill="currentColor" opacity="0.7"/>
              <circle cx="6.928" cy="4" r="2" fill="currentColor" opacity="0.4"/>
            </g>
          </g>
        </svg>
        <!-- 展开/折叠 图标 -->
        <svg v-else-if="!isLeaf" viewBox="0 0 1024 1024" width="16" height="16">
          <path d="M384 384l256 256-256 256z" fill="currentColor" />
        </svg>
      </span>
      <span v-if="showCheckbox" class="vue-virtual-tree-node__checkbox">
        <input
          type="checkbox"
          :checked="node.isChecked"
          :indeterminate="node.isIndeterminate"
          :disabled="node.isDisabled"
          @click.stop="handleCheckboxClick"
        />
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
}

const props = defineProps<TreeNodeProps>()

const emit = defineEmits<{
  'node-click': [node: FlatTreeNode, event: MouseEvent]
  'node-expand': [node: FlatTreeNode]
  'node-collapse': [node: FlatTreeNode]
  'node-check': [node: FlatTreeNode]
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

const handleClick = (event: MouseEvent) => {
  if (props.node.isDisabled) return
  emit('node-click', props.node, event)
  if (props.expandOnClickNode && !isLeaf.value) {
    if (props.node.isExpanded) {
      emit('node-collapse', props.node)
    } else {
      emit('node-expand', props.node)
    }
  }
}

const handleExpandClick = (event: MouseEvent) => {
  if (props.node.isDisabled || isLeaf.value) return
  event.stopPropagation()
  if (props.node.isExpanded) {
    emit('node-collapse', props.node)
  } else {
    emit('node-expand', props.node)
  }
}

const handleCheckboxClick = (event: MouseEvent) => {
  if (props.node.isDisabled) return
  event.stopPropagation()
  emit('node-check', props.node)
}

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

<style scoped>
.vue-virtual-tree-node {
  position: relative;
  user-select: none;
}

.vue-virtual-tree-node__content {
  display: flex;
  align-items: center;
  height: 32px;
  line-height: 32px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.vue-virtual-tree-node__content:hover {
  background-color: #f5f7fa;
}

.vue-virtual-tree-node.is-disabled .vue-virtual-tree-node__content {
  cursor: not-allowed;
  color: #c0c4cc;
}

.vue-virtual-tree-node__expand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: 4px;
  transition: transform 0.2s;
  color: #606266;
}

.vue-virtual-tree-node__expand-icon.is-leaf {
  visibility: hidden;
}

.vue-virtual-tree-node.is-expanded .vue-virtual-tree-node__expand-icon {
  transform: rotate(90deg);
}

.vue-virtual-tree-node__checkbox {
  margin-right: 8px;
}

.vue-virtual-tree-node__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vue-virtual-tree-node.is-dragging {
  opacity: 0.5;
}

.vue-virtual-tree-node.drop-prev::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background-color: #409eff;
  z-index: 1;
}

.vue-virtual-tree-node.drop-next::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background-color: #409eff;
  z-index: 1;
}

.vue-virtual-tree-node.drop-inner {
  background-color: #ecf5ff;
}
</style>

