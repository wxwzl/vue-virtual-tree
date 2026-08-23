import type { TreeNodeData } from "@wxwzl/vue-virtual-tree";

export interface GenerateTreeDataResult {
  data: TreeNodeData[];
  totalCount: number;
}

export interface WasmGeneratorOptions {
  childCount?: number;
  grandChildCount?: number;
  /** 树的深度（包含根节点层） */
  depth?: number;
  /** 每层节点的子节点数量 */
  childrenPerNode?: number;
  /** 每次 requestAnimationFrame 处理的节点数量 */
  chunkSize?: number;
}

export class GenerateOptions {
  constructor(
    public rootCount: number,
    public childCount: number,
    public grandChildCount: number
  ) {}
  free() {}
}

let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;

interface GenerationFrame {
  children: TreeNodeData[];
  level: number;
  parentId: string | number;
  remaining: number;
  current: number;
}

/**
 * 初始化 WASM 模块（当前为 JS 回退实现，无需真实 WASM 文件）
 */
async function ensureWasmInit(): Promise<void> {
  if (wasmInitialized) return;
  if (wasmInitPromise) return wasmInitPromise;
  wasmInitPromise = Promise.resolve().then(() => {
    wasmInitialized = true;
  });
  return wasmInitPromise;
}

export default async function init(): Promise<void> {
  await ensureWasmInit();
}

/**
 * 生成虚拟树数据（JS 高性能实现，替代缺失的 WASM 模块）
 */
export async function generateVirtualTreeDataWasm(
  rootCount = 5000,
  options: WasmGeneratorOptions = {}
): Promise<GenerateTreeDataResult> {
  await ensureWasmInit();

  const safeRootCount = Math.max(1, Math.floor(rootCount));
  const chunkSize = Math.max(1, Math.floor(options.chunkSize ?? 10000));

  // 优先使用 depth + childrenPerNode 多层模式
  if (
    options.depth &&
    options.depth > 0 &&
    options.childrenPerNode &&
    options.childrenPerNode > 0
  ) {
    return generateDeepTree(safeRootCount, options.depth, options.childrenPerNode, chunkSize);
  }

  // 兼容旧版 3 层参数
  const childCount = Math.max(1, Math.floor(options.childCount ?? 5));
  const grandChildCount = Math.max(1, Math.floor(options.grandChildCount ?? 5));
  return generateLegacyTree(safeRootCount, childCount, grandChildCount, chunkSize);
}

/**
 * 快速生成（使用默认子节点数量）
 */
export async function generateTreeDataFastWasm(rootCount = 5000): Promise<GenerateTreeDataResult> {
  await ensureWasmInit();
  return generateLegacyTree(Math.max(1, Math.floor(rootCount)), 5, 5, 10000);
}

export function isWasmAvailable(): boolean {
  return wasmInitialized;
}

function generateDeepTree(
  rootCount: number,
  depth: number,
  childrenPerNode: number,
  chunkSize: number
): Promise<GenerateTreeDataResult> {
  return new Promise((resolve) => {
    const data: TreeNodeData[] = [];
    let rootIndex = 1;
    let totalCount = 0;
    const stack: GenerationFrame[] = [];

    const processBatch = () => {
      let batchCount = 0;

      while (batchCount < chunkSize && (rootIndex <= rootCount || stack.length > 0)) {
        if (stack.length === 0) {
          const id = rootIndex;
          const node: TreeNodeData = { id, label: `节点 ${id}` };
          totalCount++;
          data.push(node);
          rootIndex++;
          if (depth > 1) {
            node.children = [];
            stack.push({
              children: node.children,
              level: 1,
              parentId: id,
              remaining: childrenPerNode,
              current: 1,
            });
          }
          batchCount++;
          continue;
        }

        const frame = stack[stack.length - 1];
        if (frame.current > frame.remaining) {
          stack.pop();
          continue;
        }

        const id = `${frame.parentId}-${frame.current}`;
        const node: TreeNodeData = { id, label: `节点 ${id}` };
        totalCount++;
        frame.children.push(node);
        frame.current++;
        batchCount++;

        if (frame.level + 1 < depth) {
          node.children = [];
          stack.push({
            children: node.children,
            level: frame.level + 1,
            parentId: id,
            remaining: childrenPerNode,
            current: 1,
          });
        }
      }

      if (rootIndex <= rootCount || stack.length > 0) {
        requestAnimationFrame(processBatch);
      } else {
        resolve({ data, totalCount });
      }
    };

    processBatch();
  });
}

function generateLegacyTree(
  rootCount: number,
  childCount: number,
  grandChildCount: number,
  chunkSize: number
): Promise<GenerateTreeDataResult> {
  return new Promise((resolve) => {
    const data: TreeNodeData[] = [];
    let currentIndex = 1;
    let totalCount = 0;

    const generateChunk = () => {
      const endIndex = Math.min(currentIndex + chunkSize, rootCount + 1);

      for (let i = currentIndex; i < endIndex; i++) {
        const node: TreeNodeData = { id: i, label: `节点 ${i}` };
        totalCount++;

        const children: TreeNodeData[] = [];
        for (let j = 1; j <= childCount; j++) {
          const child: TreeNodeData = { id: `${i}-${j}`, label: `节点 ${i}-${j}` };
          totalCount++;

          const grandchildren: TreeNodeData[] = [];
          for (let k = 1; k <= grandChildCount; k++) {
            grandchildren.push({ id: `${i}-${j}-${k}`, label: `节点 ${i}-${j}-${k}` });
            totalCount++;
          }
          child.children = grandchildren;
          children.push(child);
        }

        node.children = children;
        data.push(node);
      }

      currentIndex = endIndex;
      if (currentIndex <= rootCount) {
        requestAnimationFrame(generateChunk);
      } else {
        resolve({ data, totalCount });
      }
    };

    generateChunk();
  });
}
