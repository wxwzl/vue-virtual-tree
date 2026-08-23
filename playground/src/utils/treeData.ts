import type { TreeNodeData } from "@wxwzl/vue-virtual-tree";
import { generateVirtualTreeDataWasm } from "./wasmTreeData";

export interface VirtualNodeContext {
  level: number;
  parentId: string | number | null;
  index: number;
}

export interface VirtualTreeOptions {
  /** 兼容旧版：每个根节点的一级子节点数量 */
  childCount?: number;
  /** 兼容旧版：每个一级子节点的二级子节点数量 */
  grandChildCount?: number;
  /**
   * 指定树深度（包含根节点层）。
   * 与 childrenPerNode 一起使用，可生成任意深度的树。
   * 未指定时沿用 childCount + grandChildCount 的 3 层逻辑。
   */
  depth?: number;
  /** 与 depth 配合使用，每层节点的子节点数量 */
  childrenPerNode?: number;
  /** 每次 requestAnimationFrame 处理的节点数量 */
  chunkSize?: number;
  decorator?: (node: TreeNodeData, context: VirtualNodeContext) => void;
  /** 是否强制使用 JS 版本（跳过 WASM） */
  forceJS?: boolean;
}

const ensurePositiveInt = (value: number, fallback: number) => {
  if (Number.isNaN(value) || value <= 0) return fallback;
  return Math.floor(value);
};

export interface GenerateTreeDataResult {
  data: TreeNodeData[];
  totalCount: number;
}

interface GenerationFrame {
  children: TreeNodeData[];
  level: number;
  parentId: string;
  remaining: number;
  current: number;
}

/**
 * 多层树数据生成（按节点数分片，避免阻塞主线程）
 */
const generateDeepTreeData = (
  rootCount: number,
  depth: number,
  childrenPerNode: number,
  chunkSize: number,
  decorator?: VirtualTreeOptions["decorator"]
): Promise<GenerateTreeDataResult> => {
  return new Promise((resolve) => {
    const data: TreeNodeData[] = [];
    let rootIndex = 1;
    let totalCount = 0;
    const stack: GenerationFrame[] = [];

    const processBatch = () => {
      let batchCount = 0;

      while (batchCount < chunkSize && (rootIndex <= rootCount || stack.length > 0)) {
        if (stack.length === 0) {
          const id = `node-${rootIndex}`;
          const node: TreeNodeData = { id, label: `节点 ${id}` };
          decorator?.(node, { level: 0, parentId: null, index: rootIndex });
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
        decorator?.(node, { level: frame.level, parentId: frame.parentId, index: frame.current });
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
};

/**
 * 兼容旧版的 3 层树数据生成
 */
const generateLegacyTreeData = (
  rootCount: number,
  childCount: number,
  grandChildCount: number,
  chunkSize: number,
  decorator?: VirtualTreeOptions["decorator"]
): Promise<GenerateTreeDataResult> => {
  return new Promise((resolve) => {
    const data: TreeNodeData[] = [];
    let currentIndex = 1;
    let totalCount = 0;

    const generateChunk = () => {
      const endIndex = Math.min(currentIndex + chunkSize, rootCount + 1);

      for (let i = currentIndex; i < endIndex; i++) {
        const node: TreeNodeData = {
          id: `node-${i}`,
          label: `节点 ${i}`,
        };
        decorator?.(node, { level: 0, parentId: null, index: i });
        totalCount++;

        const children: TreeNodeData[] = [];
        for (let j = 1; j <= childCount; j++) {
          const child: TreeNodeData = {
            id: `node-${i}-${j}`,
            label: `节点 ${i}-${j}`,
          };
          decorator?.(child, { level: 1, parentId: node.id, index: j });
          totalCount++;

          const grandchildren: TreeNodeData[] = [];
          for (let k = 1; k <= grandChildCount; k++) {
            const grandChild: TreeNodeData = {
              id: `node-${i}-${j}-${k}`,
              label: `节点 ${i}-${j}-${k}`,
            };
            decorator?.(grandChild, { level: 2, parentId: child.id, index: k });
            totalCount++;
            grandchildren.push(grandChild);
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
};

/**
 * JS 版本的树数据生成
 */
const generateVirtualTreeDataJS = (
  rootCount = 5000,
  options: VirtualTreeOptions = {}
): Promise<GenerateTreeDataResult> => {
  const safeRootCount = ensurePositiveInt(rootCount, 1);
  const chunkSize = ensurePositiveInt(options.chunkSize ?? 1000, 1000);

  if (
    options.depth &&
    options.depth > 0 &&
    options.childrenPerNode &&
    options.childrenPerNode > 0
  ) {
    const depth = ensurePositiveInt(options.depth, 2);
    const childrenPerNode = ensurePositiveInt(options.childrenPerNode, 2);
    return generateDeepTreeData(
      safeRootCount,
      depth,
      childrenPerNode,
      chunkSize,
      options.decorator
    );
  }

  const childCount = ensurePositiveInt(options.childCount ?? 5, 5);
  const grandChildCount = ensurePositiveInt(options.grandChildCount ?? 5, 5);
  return generateLegacyTreeData(
    safeRootCount,
    childCount,
    grandChildCount,
    chunkSize,
    options.decorator
  );
};

/**
 * 生成虚拟树数据（优先使用 WASM 路径，装饰器/强制 JS 时回退到 JS 版本）
 */
export const generateVirtualTreeData = async (
  rootCount = 5000,
  options: VirtualTreeOptions = {}
): Promise<GenerateTreeDataResult> => {
  if (options.decorator || options.forceJS) {
    return generateVirtualTreeDataJS(rootCount, options);
  }
  return generateVirtualTreeDataWasm(rootCount, options);
};

export interface AsyncTreeOptions extends VirtualTreeOptions {
  delay?: number;
}

export const generateTreeDataAsync = (
  count = 5000,
  options: AsyncTreeOptions = {}
): Promise<GenerateTreeDataResult> => {
  const delay = options.delay ?? 1000;
  return new Promise((resolve) => {
    setTimeout(async () => {
      const result = await generateVirtualTreeData(count, options);
      resolve(result);
    }, delay);
  });
};
