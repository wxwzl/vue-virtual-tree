import VirtualTree from './components/VirtualTree.vue'
import type { App } from 'vue'
import type { VirtualTreeProps, VirtualTreeEmits, VirtualTreeMethods } from './types'
import { loadToolsWasm } from './utils/wasmUtils'

export { VirtualTree }
export type { VirtualTreeProps, VirtualTreeEmits, VirtualTreeMethods }
export type { TreeNodeData, FlatTreeNode, TreePropsConfig, TreeNodeInstance } from './types'
loadToolsWasm();
export default {
  install(app: App) {
    app.component('VirtualTree', VirtualTree)
  }
}

