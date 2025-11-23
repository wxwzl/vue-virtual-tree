/**
 * 树节点数据接口
 */
export interface TreeNodeData {
  [key: string]: any
  children?: TreeNodeData[]
}

/**
 * 扁平化后的树节点
 */
export interface FlatTreeNode {
  /** 节点唯一标识 */
  id: string | number
  /** 原始节点数据 */
  data: TreeNodeData
  /** 节点层级，从 0 开始 */
  level: number
  /** 节点索引，从 0 开始 */
  index: number
  /** 在虚拟列表中的索引 */
  visibleIndex?: number
  /** 父节点 ID */
  parentId: string | number | null
  /** 是否展开 */
  isExpanded: boolean
  /** 是否选中 */
  isChecked?: boolean
  /** 是否半选（部分子节点选中） */
  isIndeterminate?: boolean
  /** 是否禁用 */
  isDisabled?: boolean
  /** 是否加载中（懒加载） */
  isLoading?: boolean
  /** 是否已加载（懒加载） */
  isLoaded?: boolean
  /** 是否为叶子节点 */
  isLeaf?: boolean
  /** 子节点列表（扁平化后的） */
  children?: FlatTreeNode[]
  /** 原始子节点数据 */
  rawChildren?: TreeNodeData[],
}

/**
 * 数据字段映射配置
 */
export interface TreePropsConfig {
  /** 节点唯一标识字段名 */
  id?: string
  /** 子节点字段名 */
  children?: string
  /** 节点标签字段名 */
  label?: string
  /** 是否禁用字段名 */
  disabled?: string
  /** 是否为叶子节点字段名 */
  isLeaf?: string
}

/**
 * 树组件 Props
 */
export interface VirtualTreeProps {
  /** 树形数据 */
  data: TreeNodeData[]
  /** 数据字段映射配置 */
  props?: TreePropsConfig
  /** 是否显示复选框 */
  showCheckbox?: boolean
  /** 是否严格遵循父子不关联 */
  checkStrictly?: boolean
  /** 是否默认展开所有节点 */
  defaultExpandAll?: boolean
  /** 默认展开的节点 key 数组 */
  defaultExpandedKeys?: (string | number)[]
  /** 默认选中的节点 key 数组 */
  defaultCheckedKeys?: (string | number)[]
  /** 当前选中的节点 key */
  currentNodeKey?: string | number
  /** 是否点击节点展开 */
  expandOnClickNode?: boolean
  /** 是否懒加载 */
  lazy?: boolean
  /** 懒加载方法 */
  load?: (node: TreeNodeData, resolve: (data: TreeNodeData[]) => void) => void
  /** 节点过滤方法 */
  filterNodeMethod?: (value: string, data: TreeNodeData) => boolean
  /** 是否手风琴模式 */
  accordion?: boolean
  /** 是否可拖拽 */
  draggable?: boolean
  /** 拖拽时判断是否允许放置 */
  allowDrop?: (draggingNode: TreeNodeData, dropNode: TreeNodeData, type: 'prev' | 'inner' | 'next') => boolean
  /** 拖拽时判断节点是否允许拖拽 */
  allowDrag?: (node: TreeNodeData) => boolean
  /** 节点高度（固定高度时使用） */
  itemSize?: number
  /** 虚拟滚动容器高度 */
  height?: number | string
  /** 每一层级的缩进距离 */
  indent?: number | ((node: FlatTreeNode) => number)
  /** 是否显示加载状态 */
  loading?: boolean
}

/**
 * 树节点实例
 */
export interface TreeNodeInstance {
  /** 节点数据 */
  data: TreeNodeData
  /** 节点 key */
  key: string | number
  /** 节点层级 */
  level: number
  /** 父节点 */
  parent: TreeNodeInstance | null
  /** 子节点 */
  children: TreeNodeInstance[]
  /** 是否展开 */
  expanded: boolean
  /** 是否选中 */
  checked: boolean
  /** 是否禁用 */
  disabled: boolean
  /** 是否为叶子节点 */
  isLeaf: boolean
  /** 获取节点标签 */
  getLabel: () => string
  /** 获取节点数据 */
  getData: () => TreeNodeData
  /** 获取父节点 */
  getParent: () => TreeNodeInstance | null
  /** 获取子节点 */
  getChildren: () => TreeNodeInstance[]
  /** 获取兄弟节点 */
  getSiblings: () => TreeNodeInstance[]
  /** 获取所有子节点（包括子节点的子节点） */
  getAllChildren: () => TreeNodeInstance[]
  /** 获取所有父节点 */
  getAllParents: () => TreeNodeInstance[]
}

/**
 * 树组件事件
 */
export type VirtualTreeEmits = {
  /** 节点点击事件 */
  'node-click': [data: TreeNodeData, node: TreeNodeInstance, event: MouseEvent]
  /** 节点复选框点击事件 */
  'node-check': [data: TreeNodeData, checked: { checkedKeys: (string | number)[], checkedNodes: TreeNodeData[], halfCheckedKeys: (string | number)[], halfCheckedNodes: TreeNodeData[] }]
  /** 节点展开事件 */
  'node-expand': [data: TreeNodeData, node: TreeNodeInstance]
  /** 节点折叠事件 */
  'node-collapse': [data: TreeNodeData, node: TreeNodeInstance]
  /** 当前选中节点变化事件 */
  'current-change': [data: TreeNodeData | null, node: TreeNodeInstance | null]
  /** 拖拽开始 */
  'node-drag-start': [node: TreeNodeData, event: DragEvent]
  /** 拖拽进入 */
  'node-drag-enter': [draggingNode: TreeNodeData, event: DragEvent, node: TreeNodeData]
  /** 拖拽离开 */
  'node-drag-leave': [draggingNode: TreeNodeData, event: DragEvent, node: TreeNodeData]
  /** 拖拽悬停 */
  'node-drag-over': [draggingNode: TreeNodeData, event: DragEvent, node: TreeNodeData]
  /** 拖拽结束 */
  'node-drag-end': [draggingNode: TreeNodeData, event: DragEvent]
  /** 拖拽放置 */
  'node-drop': [draggingNode: TreeNodeData, dropNode: TreeNodeData, dropType: 'prev' | 'inner' | 'next', event: DragEvent]
  /** 数据处理完成 */
  'node-generated': []
}

/**
 * 树组件方法
 */
export interface VirtualTreeMethods {
  /** 获取选中的节点 */
  getCheckedNodes: (leafOnly?: boolean, includeHalfChecked?: boolean) => TreeNodeData[]
  /** 获取选中的节点 key */
  getCheckedKeys: (leafOnly?: boolean) => (string | number)[]
  /** 设置选中的节点 */
  setCheckedNodes: (nodes: TreeNodeData[], leafOnly?: boolean) => void
  /** 设置选中的节点 key */
  setCheckedKeys: (keys: (string | number)[], leafOnly?: boolean) => void
  /** 获取当前选中节点 */
  getCurrentNode: () => TreeNodeData | null
  /** 设置当前选中节点 */
  setCurrentNode: (node: TreeNodeData | string | number) => void
  /** 获取当前选中节点的 key */
  getCurrentKey: () => string | number | null
  /** 设置当前选中节点的 key */
  setCurrentKey: (key: string | number) => void
  /** 过滤节点 */
  filter: (value: string) => void
  /** 根据 key 获取节点 */
  getNode: (key: string | number) => TreeNodeInstance | null
  /** 删除节点 */
  remove: (key: string | number) => void
  /** 追加节点 */
  append: (data: TreeNodeData, parentKey?: string | number) => void
  /** 在节点前插入 */
  insertBefore: (data: TreeNodeData, key: string | number) => void
  /** 在节点后插入 */
  insertAfter: (data: TreeNodeData, key: string | number) => void
  /** 更新节点的子节点（懒加载） */
  updateKeyChildren: (key: string | number, data: TreeNodeData[]) => void
  /** 滚动到指定节点 */
  scrollToNode: (key: string | number | TreeNodeData, options?: { align?: 'top' | 'center' | 'bottom', offset?: number }) => void
}

