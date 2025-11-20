import type { TreeNodeData } from '@wxwzl/vue-virtual-tree'

const ASYNC_TREE_TEMPLATE: TreeNodeData[] = [
  {
    id: 'async-1',
    label: '异步节点 1',
    children: [
      {
        id: 'async-1-1',
        label: '异步节点 1-1',
        children: [
          { id: 'async-1-1-1', label: '异步节点 1-1-1' },
          { id: 'async-1-1-2', label: '异步节点 1-1-2' }
        ]
      },
      { id: 'async-1-2', label: '异步节点 1-2' }
    ]
  },
  {
    id: 'async-2',
    label: '异步节点 2',
    children: [
      { id: 'async-2-1', label: '异步节点 2-1' },
      { id: 'async-2-2', label: '异步节点 2-2' }
    ]
  },
  {
    id: 'async-3',
    label: '异步节点 3'
  }
]

const cloneTemplate = (): TreeNodeData[] => JSON.parse(JSON.stringify(ASYNC_TREE_TEMPLATE))

export const generateTreeDataAsync = (delay = 1000): Promise<TreeNodeData[]> => {
  return new Promise(resolve => {
    setTimeout(() => resolve(cloneTemplate()), delay)
  })
}

