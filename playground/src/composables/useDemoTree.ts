import { ref, onMounted } from 'vue'
import type { TreeNodeData } from '@wxwzl/vue-virtual-tree'
import { generateVirtualTreeData, type VirtualTreeOptions } from '../utils/treeData'

interface UseDemoTreeOptions {
  initialCount?: number
  minCount?: number
  generatorOptions?: VirtualTreeOptions
}

export function useDemoTree(options: UseDemoTreeOptions = {}) {
  const { initialCount = 5000, minCount = 1000, generatorOptions } = options
  const nodeCount = ref(initialCount)
  const treeData = ref<TreeNodeData[]>([])
  const isLoading = ref(true)

  const regenerateData = async () => {
    isLoading.value = true
    treeData.value = await generateVirtualTreeData(nodeCount.value, generatorOptions)
    isLoading.value = false
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
    regenerateData,
    handleCountChange
  }
}

