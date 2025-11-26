import type { TreeNodeData } from '@wxwzl/vue-virtual-tree'
import init, { GenerateOptions, generateVirtualTreeData as wasmGenerate, generateTreeDataFast as wasmGenerateFast } from '../../lib/data_generator'

export interface GenerateTreeDataResult {
  data: TreeNodeData[]
  totalCount: number
}

export interface WasmGeneratorOptions {
  childCount?: number
  grandChildCount?: number
}

let wasmInitialized = false
let wasmInitPromise: Promise<void> | null = null

/**
 * 初始化 WASM 模块
 */
async function ensureWasmInit(): Promise<void> {
  if (wasmInitialized) {
    return
  }

  if (wasmInitPromise) {
    return wasmInitPromise
  }

  wasmInitPromise = (async () => {
    try {
      await init()
      wasmInitialized = true
    } catch (error) {
      console.warn('WASM 模块初始化失败，将使用 JS 回退方案:', error)
      throw error
    }
  })()

  return wasmInitPromise
}

/**
 * 使用 WASM 生成虚拟树数据（高性能版本）
 */
export async function generateVirtualTreeDataWasm(
  rootCount = 5000,
  options: WasmGeneratorOptions = {}
): Promise<GenerateTreeDataResult> {
  const childCount = options.childCount ?? 5
  const grandChildCount = options.grandChildCount ?? 5

  try {
    if(!isWasmAvailable()){
      await ensureWasmInit()
    }
    const wasmOptions = new GenerateOptions(rootCount, childCount, grandChildCount)
    const result = wasmGenerate(wasmOptions) as GenerateTreeDataResult
    wasmOptions.free() // 释放 WASM 内存
    return result
  } catch (error) {
    console.error('WASM 生成失败:', error)
    throw error
  }
}

/**
 * 快速生成（使用默认子节点数量）
 */
export async function generateTreeDataFastWasm(rootCount = 5000): Promise<GenerateTreeDataResult> {
  try {
    await ensureWasmInit()
    return wasmGenerateFast(rootCount) as GenerateTreeDataResult
  } catch (error) {
    console.error('WASM 快速生成失败:', error)
    throw error
  }
}

/**
 * 检查 WASM 是否可用
 */
export function isWasmAvailable(): boolean {
  return wasmInitialized
}

