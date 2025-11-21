import type { TreeNodeData } from '@wxwzl/vue-virtual-tree'

export interface VirtualNodeContext {
  level: number
  parentId: string | number | null
  index: number
}

export interface VirtualTreeOptions {
  childCount?: number
  grandChildCount?: number
  chunkSize?: number
  decorator?: (node: TreeNodeData, context: VirtualNodeContext) => void
}

const ensurePositiveInt = (value: number, fallback: number) => {
  if (Number.isNaN(value) || value <= 0) return fallback
  return Math.floor(value)
}

export interface GenerateTreeDataResult {
  data: TreeNodeData[]
  totalCount: number
}

export const generateVirtualTreeData = (
  rootCount = 5000,
  options: VirtualTreeOptions = {}
): Promise<GenerateTreeDataResult> => {
  const safeRootCount = ensurePositiveInt(rootCount, 1)
  const chunkSize = ensurePositiveInt(options.chunkSize ?? 50, 50)
  const childCount = ensurePositiveInt(options.childCount ?? 5, 5)
  const grandChildCount = ensurePositiveInt(options.grandChildCount ?? 5, 5)
  const decorator = options.decorator

  return new Promise(resolve => {
    const data: TreeNodeData[] = []
    let currentIndex = 1
    let totalCount = 0 // 统计总节点数

    const generateChunk = () => {
      const endIndex = Math.min(currentIndex + chunkSize, safeRootCount + 1)

      for (let i = currentIndex; i < endIndex; i++) {
        const node: TreeNodeData = {
          id: `node-${i}`,
          label: `节点 ${i}`
        }
        decorator?.(node, { level: 0, parentId: null, index: i })
        totalCount++ // 根节点

        const children: TreeNodeData[] = []
        for (let j = 1; j <= childCount; j++) {
          const child: TreeNodeData = {
            id: `node-${i}-${j}`,
            label: `节点 ${i}-${j}`
          }
          decorator?.(child, { level: 1, parentId: node.id, index: j })
          totalCount++ // 子节点

          const grandchildren: TreeNodeData[] = []
          for (let k = 1; k <= grandChildCount; k++) {
            const grandChild: TreeNodeData = {
              id: `node-${i}-${j}-${k}`,
              label: `节点 ${i}-${j}-${k}`
            }
            decorator?.(grandChild, { level: 2, parentId: child.id, index: k })
            totalCount++ // 孙节点
            grandchildren.push(grandChild)
          }
          child.children = grandchildren
          children.push(child)
        }

        node.children = children
        data.push(node)
      }

      currentIndex = endIndex
      if (currentIndex <= safeRootCount) {
        requestAnimationFrame(generateChunk)
      } else {
        resolve({ data, totalCount })
      }
    }

    generateChunk()
  })
}

export interface AsyncTreeOptions extends VirtualTreeOptions {
  delay?: number
}

export const generateTreeDataAsync = (
  count = 5000,
  options: AsyncTreeOptions = {}
): Promise<GenerateTreeDataResult> => {
  const delay = options.delay ?? 1000
  return new Promise(resolve => {
    setTimeout(async () => {
      const result = await generateVirtualTreeData(count, options)
      resolve(result)
    }, delay)
  })
}

