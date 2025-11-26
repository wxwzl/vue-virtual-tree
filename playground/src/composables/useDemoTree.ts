import { ref, onMounted } from 'vue'
import type { TreeNodeData } from '@wxwzl/vue-virtual-tree'
import { generateVirtualTreeData, type VirtualTreeOptions } from '../utils/treeData'

interface UseDemoTreeOptions {
  initialCount?: number
  minCount?: number
  generatorOptions?: VirtualTreeOptions
  dataLoaded?: (data: TreeNodeData[]) => void
}

export function useDemoTree(options: UseDemoTreeOptions = {}) {
  const { initialCount = 5000, minCount = 100, generatorOptions } = options
  const nodeCount = ref(initialCount)
  const treeData = ref<TreeNodeData[]>([])
  const totalNodeCount = ref(0)
  const isLoading = ref(true)
  const dataLoaded = ref(false)

  const regenerateData = async () => {
    console.time('数据生成到处理结束时间')
    isLoading.value = true
    dataLoaded.value = false
    setTimeout(async () => {
      const result = await generateVirtualTreeData(nodeCount.value, generatorOptions)
      treeData.value = result.data
      totalNodeCount.value = result.totalCount
      dataLoaded.value = true
      options.dataLoaded?.(result.data)
      // 不在这里关闭 loading，等待 VirtualTree 的 node-generated 事件
    }, 1)
  }

  const handleDataGenerated = () => {
    if (!dataLoaded.value) {
      return
    }
    isLoading.value = false
    console.timeEnd('数据生成到处理结束时间')
  }

  const handleCountChange = async () => {
    if (nodeCount.value < minCount) {
      nodeCount.value = minCount
    }
    await regenerateData()
  }

  onMounted(() => {
    regenerateData()
  })

  return {
    treeData,
    isLoading,
    nodeCount,
    totalNodeCount,
    regenerateData,
    handleCountChange,
    handleDataGenerated
  }
}

