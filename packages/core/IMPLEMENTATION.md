# Vue Virtual Tree WASM 核心实现文档

## 目录

1. [概述](#概述)
2. [架构设计](#架构设计)
3. [方案 A：最小化数据传输](#方案-a最小化数据传输)
4. [方案 B：共享内存优化](#方案-b共享内存优化)
5. [数据结构设计](#数据结构设计)
6. [API 接口设计](#api-接口设计)
7. [集成步骤](#集成步骤)
8. [测试计划](#测试计划)
9. [性能优化策略](#性能优化策略)

---

## 概述

### 目标
将树形数据的核心处理逻辑（扁平化、可见节点计算、状态管理）从 Vue composables 中抽离到独立的引擎层，先实现纯 JS 引擎（js-engine），后续再考虑迁移到 Rust + WASM 以提升百万级节点的处理性能。

### 开发优先级
**Phase 0: JS Engine 实现（优先）**
- 将 `packages/vue-virtual-tree` 中的数据处理相关代码抽离到 `packages/core` 的 JS 引擎中
- 实现统一的 `ITreeEngine` 接口
- 实现 `JsTreeEngine` 类，封装所有数据处理逻辑
- 重构 `useTreeData`、`useTreeExpand`、`useTreeSelection`、`useTreeFilter` 等 composables，使其通过引擎接口操作数据
- 确保 js-engine 完全顶替现有的所有数据处理功能代码

**Phase 1: Rust WASM 实现（后续）**
- 在 js-engine 完全稳定后，再开始开发 Rust WASM 相关代码
- 实现 `WasmTreeEngine` 类，提供与 `JsTreeEngine` 相同的接口
- 通过 `useWasm` prop 控制使用哪个引擎

### 性能目标（WASM 阶段）
- **方案 A**：百万节点扁平化时间 < 200ms，可见节点更新 < 20ms
- **方案 B**：在方案 A 基础上，序列化开销 < 0.1ms

### 核心原则
1. **数据分离**：引擎只处理结构信息，JS 存储完整数据
2. **最小传输**：只传递可见节点的精简信息
3. **按需获取**：完整数据按需从 JS Map 中获取
4. **增量更新**：只返回变化的部分
5. **向后兼容**：保留纯 JS 版本，通过 prop 控制使用哪个版本
6. **模块解耦**：清晰的模块边界，低耦合高内聚
7. **分阶段实现**：先完成 JS 引擎，再考虑 WASM 优化

---

## 架构设计

### 模块划分

#### 1. JS Engine 核心模块（packages/vue-virtual-tree/src/js-engine - Phase 0 优先实现）

```
packages/vue-virtual-tree/src/
├── js-engine/
│   ├── index.ts            # 模块导出入口
│   ├── engine/
│   │   ├── interface.ts    # ITreeEngine 接口定义
│   │   ├── js-engine.ts     # JsTreeEngine 实现（抽离自 composables）
│   │   └── factory.ts       # 引擎工厂函数
│   ├── flatten/            # 扁平化模块
│   │   └── flatten-tree.ts # 扁平化算法（抽离自 useTreeData）
│   ├── visible/            # 可见节点计算模块
│   │   └── visible-nodes.ts # 可见节点计算（抽离自 useTreeData）
│   ├── state/              # 状态管理模块
│   │   ├── expand.ts       # 展开/折叠状态（抽离自 useTreeExpand）
│   │   └── check.ts        # 选中状态（抽离自 useTreeSelection）
│   ├── filter/             # 过滤模块
│   │   └── filter-tree.ts  # 过滤逻辑（抽离自 useTreeFilter）
│   └── utils/              # 工具模块
│       ├── tree.ts         # 树工具函数（抽离自 utils/tree.ts）
│       └── config.ts       # 配置处理
└── ...
```

**模块职责（Phase 0）：**
- `engine/`: 树引擎核心逻辑，纯 JS 实现
- `flatten/`: 独立的扁平化算法（从 `useTreeData.flattenTree` 抽离）
- `visible/`: 独立的可见节点计算（从 `useTreeData` 抽离）
- `state/`: 独立的状态管理（从 `useTreeExpand` 和 `useTreeSelection` 抽离）
- `filter/`: 独立的过滤逻辑（从 `useTreeFilter` 抽离）
- `utils/`: 工具函数（从 `utils/tree.ts` 抽离）

#### 1.1 Rust WASM 核心模块（packages/core - Phase 1 后续实现）

```
packages/core/
├── src/
│   ├── lib.rs              # WASM 导出入口
│   ├── engine/             # 树引擎核心
│   │   ├── mod.rs
│   │   ├── tree_engine.rs  # TreeEngine 主结构
│   │   └── node.rs         # TreeNode 结构
│   ├── flatten/            # 扁平化模块
│   │   ├── mod.rs
│   │   └── flatten_tree.rs # 扁平化算法
│   ├── visible/            # 可见节点计算模块
│   │   ├── mod.rs
│   │   └── visible_nodes.rs
│   ├── state/              # 状态管理模块
│   │   ├── mod.rs
│   │   ├── expand.rs       # 展开/折叠状态
│   │   └── check.rs        # 选中状态
│   ├── filter/             # 过滤模块
│   │   ├── mod.rs
│   │   └── filter_tree.rs
│   ├── utils/              # 工具模块
│   │   ├── mod.rs
│   │   ├── id_converter.rs # ID 转换
│   │   └── config.rs       # 配置处理
│   └── wasm/               # WASM 绑定层
│       ├── mod.rs
│       └── bindings.rs     # wasm-bindgen 导出
├── Cargo.toml              # Rust 项目配置
└── tests/
    └── integration/
```

**模块职责（Phase 1）：**
- `engine/`: 树引擎核心逻辑，不依赖 WASM
- `flatten/`: 独立的扁平化算法
- `visible/`: 独立的可见节点计算
- `state/`: 独立的状态管理
- `filter/`: 独立的过滤逻辑
- `wasm/`: WASM 绑定层，隔离 WASM 相关代码

**构建输出：**
- 使用 `wasm-pack build --target web --out-dir ../vue-virtual-tree/lib --out-name lib` 命令
- 打包产物输出到 `packages/vue-virtual-tree/lib/` 目录

#### 2. JS Engine 集成层（packages/vue-virtual-tree/src/wasm - Phase 0）

```
packages/vue-virtual-tree/src/
├── wasm/
│   ├── index.ts            # 模块导出
│   ├── engine/
│   │   ├── interface.ts    # ITreeEngine 接口定义（从 js-engine 导入）
│   │   └── factory.ts       # 引擎工厂函数（从 js-engine 导入）
│   └── types.ts            # 类型定义
```

**模块职责（Phase 0）：**
- `engine/interface.ts`: 从 `../js-engine` 重新导出接口
- `engine/factory.ts`: 从 `../js-engine` 重新导出工厂函数
- `index.ts`: 统一导出，供 composables 使用

#### 2.1 WASM 桥接层（packages/vue-virtual-tree/src/wasm - Phase 1）

```
packages/vue-virtual-tree/src/
├── wasm/
│   ├── index.ts            # 模块导出
│   ├── loader.ts           # WASM 加载器（Phase 1 新增）
│   ├── engine/
│   │   ├── interface.ts    # ITreeEngine 接口定义（从 js-engine 导入）
│   │   ├── js-engine.ts    # JsTreeEngine 实现（从 js-engine 导入）
│   │   └── wasm-engine.ts  # WasmTreeEngine 实现（Phase 1 新增）
│   ├── bridge/
│   │   ├── id-converter.ts # ID 类型转换（Phase 1 新增）
│   │   └── data-mapper.ts  # 数据映射（Phase 1 新增）
│   └── types.ts            # 类型定义
├── lib/                    # wasm-pack 打包产物（Phase 1）
│   ├── lib.js              # WASM 绑定 JS 文件
│   ├── lib_bg.wasm         # WASM 二进制文件
│   ├── lib.d.ts            # TypeScript 类型定义
│   └── package.json        # WASM 包配置
└── ...
```

**模块职责（Phase 1）：**
- `loader.ts`: 只负责 WASM 模块加载，从 `lib/` 目录加载 WASM 文件
- `engine/js-engine.ts`: 从 `../js-engine` 导入
- `engine/wasm-engine.ts`: WASM 引擎实现，通过接口隔离
- `bridge/`: 数据转换桥接，隔离 Rust 和 JS 的数据格式差异
- `lib/`: wasm-pack 打包产物，由 `build:core` 命令生成

#### 3. Composables 层（packages/vue-virtual-tree/src/composables）

```
packages/vue-virtual-tree/src/composables/
├── useTreeData.ts          # 主 composable（依赖引擎接口）
├── useTreeExpand.ts        # 展开逻辑（可选，WASM 模式下由引擎处理）
├── useTreeSelection.ts     # 选中逻辑（可选，WASM 模式下由引擎处理）
├── useTreeFilter.ts        # 过滤逻辑（可选，WASM 模式下由引擎处理）
└── useTreeDrag.ts          # 拖拽逻辑（纯 JS，不依赖引擎）
```

**模块职责：**
- `useTreeData.ts`: 协调各个模块，通过接口使用引擎
- 其他 composables: 独立的业务逻辑模块，可选择性使用

### 依赖关系图

```
┌─────────────────────────────────────────────────────────┐
│              Vue Component Layer                       │
│  (VirtualTree.vue, TreeNode.vue)                       │
└──────────────────┬──────────────────────────────────────┘
                   │ 使用
                   ▼
┌─────────────────────────────────────────────────────────┐
│           Composables Layer                            │
│  (useTreeData, useTreeExpand, etc.)                   │
└──────────────────┬──────────────────────────────────────┘
                   │ 依赖接口
                   ▼
┌─────────────────────────────────────────────────────────┐
│           Engine Interface Layer                       │
│  (ITreeEngine)                                         │
└───────────┬───────────────────────┬─────────────────────┘
            │                       │
            │ 实现                  │ 实现
            ▼                       ▼
┌──────────────────────┐  ┌──────────────────────┐
│   JsTreeEngine      │  │   WasmTreeEngine     │
│   (纯 JS 实现)      │  │   (WASM 桥接)        │
└──────────────────────┘  └──────────┬───────────┘
                                     │
                                     │ 调用
                                     ▼
                        ┌──────────────────────────┐
                        │   WASM Bridge Layer      │
                        │   (loader, converter)    │
                        └──────────┬───────────────┘
                                   │
                                   │ 绑定
                                   ▼
                        ┌──────────────────────────┐
                        │   Rust Core Engine       │
                        │   (TreeEngine)           │
                        └──────────────────────────┘
```

### 模块隔离原则

#### 1. 接口隔离（Interface Segregation）

```typescript
// engine/interface.ts
// 最小化接口，只暴露必要方法
export interface ITreeEngine {
  // 核心方法
  loadTree(data: TreeNodeData[]): Promise<void>
  getVisibleNodes(): FlatTreeNode[]
  
  // 状态操作
  expandNode(id: string | number): void
  collapseNode(id: string | number): void
  setChecked(id: string | number, checked: boolean): void
  
  // 查询方法
  getCheckedKeys(): (string | number)[]
  // ... 其他必要方法
}

// 不暴露内部实现细节
// 不暴露 WASM 特定方法
// 不暴露 Rust 特定类型
```

#### 2. 依赖倒置（Dependency Inversion）

```typescript
// useTreeData.ts
// 依赖抽象接口，不依赖具体实现
export function useTreeData(props: VirtualTreeProps, emit: EmitFn<VirtualTreeEmits>) {
  // 通过工厂函数获取引擎，不直接依赖具体实现
  const engine = createEngine(props.useWasm)
  
  // 只使用接口方法
  engine.loadTree(props.data)
  const visibleNodes = engine.getVisibleNodes()
  // ...
}
```

#### 3. 单一职责（Single Responsibility）

**每个模块只负责一件事：**

- `id-converter.ts`: 只负责 ID 类型转换
- `data-mapper.ts`: 只负责数据格式映射
- `loader.ts`: 只负责 WASM 加载
- `js-engine.ts`: 只负责 JS 引擎实现
- `wasm-engine.ts`: 只负责 WASM 引擎实现

#### 4. 模块边界清晰

```rust
// Rust 端模块边界
// engine/mod.rs - 不依赖 wasm
pub mod tree_engine;
pub mod node;

// wasm/mod.rs - 依赖 engine，但不暴露 engine 内部
use crate::engine::TreeEngine;

#[wasm_bindgen]
pub struct TreeEngine {
    inner: tree_engine::TreeEngine,  // 内部实现
}
```

```typescript
// JS 端模块边界
// wasm/loader.ts - 不依赖业务逻辑
export async function initWasm() { ... }

// wasm/engine/wasm-engine.ts - 依赖 loader 和 bridge，不依赖 composables
import { initWasm } from '../loader'
import { convertId } from '../bridge/id-converter'

// composables/useTreeData.ts - 依赖 engine 接口，不依赖具体实现
import type { ITreeEngine } from '../wasm/engine/interface'
```

### 解耦策略

#### 1. 数据转换层隔离

```typescript
// bridge/id-converter.ts
// 独立的转换模块，隔离 Rust u64 和 JS string|number
export class IdConverter {
  static toRust(id: string | number): number { ... }
  static toJs(id: number): string | number { ... }
}

// bridge/data-mapper.ts
// 独立的映射模块，隔离精简数据和完整数据
export class DataMapper {
  static mergeVisibleNode(
    info: VisibleNodeInfo,
    data: TreeNodeData
  ): FlatTreeNode { ... }
}
```

#### 2. 错误处理隔离

```rust
// Rust 端：统一的错误类型
#[derive(Debug)]
pub enum TreeError {
    NodeNotFound(NodeId),
    InvalidData(String),
    // ...
}

// WASM 绑定层：错误转换
#[wasm_bindgen]
impl TreeEngine {
    pub fn expand_node(&mut self, id: u64) -> Result<(), JsValue> {
        self.inner.expand_node(id)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }
}
```

```typescript
// JS 端：统一的错误处理
class WasmTreeEngine {
  expandNode(id: string | number): void {
    try {
      const rustId = IdConverter.toRust(id)
      this.wasmEngine.expandNode(rustId)
    } catch (error) {
      throw new TreeError(`Failed to expand node: ${error}`)
    }
  }
}
```

#### 3. 配置隔离

```rust
// utils/config.rs
// 独立的配置模块
pub struct TreeConfig {
    pub id_field: String,
    pub children_field: String,
    // ...
}

impl TreeConfig {
    pub fn from_js(config: &JsValue) -> Result<Self, TreeError> {
        // 从 JS 配置转换为 Rust 配置
    }
}
```

#### 4. 测试隔离

```rust
// tests/unit/ - 单元测试，不依赖 WASM
#[cfg(test)]
mod tests {
    use crate::engine::TreeEngine;
    // 直接测试 Rust 代码
}

// tests/integration/ - 集成测试，测试 WASM 绑定
#[cfg(test)]
mod wasm_tests {
    use wasm_bindgen_test::*;
    // 测试 WASM 接口
}
```

### 模块通信规范

#### 1. 只通过接口通信

```typescript
// ✅ 正确：通过接口
const engine: ITreeEngine = createEngine(useWasm)
engine.loadTree(data)

// ❌ 错误：直接访问内部实现
const engine = new WasmTreeEngine()
engine.wasmEngine.loadTree(data)  // 暴露了内部实现
```

#### 2. 使用事件/回调而非直接调用

```typescript
// ✅ 正确：通过回调
engine.onNodeExpanded((node) => {
  emit('node-expand', node)
})

// ❌ 错误：直接访问内部状态
if (engine.expandedKeys.has(nodeId)) { ... }
```

#### 3. 数据传递最小化

```typescript
// ✅ 正确：只传递必要数据
engine.expandNode(nodeId)

// ❌ 错误：传递完整对象
engine.expandNode(fullNodeData)
```

### 解耦检查清单

在实现每个模块时，检查以下问题：

#### Rust 端检查

- [ ] **模块独立性**：每个模块（flatten, visible, state）是否可以独立测试？
- [ ] **依赖方向**：是否遵循单向依赖（上层依赖下层）？
- [ ] **接口隔离**：模块间是否通过 trait/接口通信？
- [ ] **WASM 隔离**：业务逻辑是否不依赖 `wasm-bindgen`？
- [ ] **错误处理**：错误类型是否在模块内定义，不泄露到外部？

#### JS 端检查

- [ ] **接口依赖**：Composables 是否只依赖 `ITreeEngine` 接口？
- [ ] **实现隔离**：`JsEngine` 和 `WasmEngine` 是否互不依赖？
- [ ] **桥接层独立**：`id-converter` 和 `data-mapper` 是否独立可测试？
- [ ] **加载器独立**：`loader.ts` 是否不包含业务逻辑？
- [ ] **类型安全**：是否使用 TypeScript 接口而非具体类型？

#### 通用检查

- [ ] **单一职责**：每个模块是否只有一个明确的职责？
- [ ] **最小接口**：模块是否只暴露必要的方法？
- [ ] **无循环依赖**：模块间是否存在循环依赖？
- [ ] **可测试性**：每个模块是否可以独立进行单元测试？
- [ ] **可替换性**：实现是否可以轻松替换而不影响其他模块？

### 文件组织规范

```
packages/core/src/
├── lib.rs                    # 只导出公共 API
├── engine/                   # 核心引擎（无 WASM 依赖）
│   ├── mod.rs
│   ├── tree_engine.rs
│   └── node.rs
├── flatten/                  # 扁平化（独立模块）
├── visible/                  # 可见节点（独立模块）
├── state/                    # 状态管理（独立模块）
├── filter/                   # 过滤（独立模块）
├── utils/                    # 工具（独立模块）
└── wasm/                     # WASM 绑定（隔离层）
    ├── mod.rs
    └── bindings.rs

packages/vue-virtual-tree/src/wasm/
├── index.ts                  # 统一导出
├── loader.ts                 # WASM 加载（独立）
├── engine/                   # 引擎实现（通过接口隔离）
│   ├── interface.ts         # 接口定义
│   ├── js-engine.ts         # JS 实现
│   └── wasm-engine.ts       # WASM 实现
└── bridge/                   # 桥接层（数据转换）
    ├── id-converter.ts
    └── data-mapper.ts
```

### 模块解耦示例

#### Rust 端模块解耦示例

```rust
// engine/mod.rs - 只导出公共接口
pub mod tree_engine;
pub mod node;

pub use tree_engine::TreeEngine;
pub use node::{TreeNode, NodeId, NodeFlags};

// engine/tree_engine.rs - 核心引擎，通过 trait 依赖其他模块
use crate::flatten::FlattenTree;
use crate::visible::VisibleNodes;
use crate::state::expand::ExpandState;
use crate::state::check::CheckState;

pub struct TreeEngine {
    nodes: Vec<TreeNode>,
    flatten: FlattenTree,      // 通过接口依赖
    visible: VisibleNodes,      // 通过接口依赖
    expand_state: ExpandState, // 通过接口依赖
    check_state: CheckState,    // 通过接口依赖
}

// flatten/mod.rs - 独立模块，不依赖其他业务模块
pub struct FlattenTree {
    // 只处理扁平化逻辑
}

impl FlattenTree {
    pub fn flatten(&self, nodes: &[TreeNode]) -> Vec<FlatNode> {
        // 独立的扁平化实现
    }
}

// state/expand.rs - 独立的状态模块
pub struct ExpandState {
    expanded_keys: HashSet<NodeId>,
}

impl ExpandState {
    pub fn expand(&mut self, node_id: NodeId) {
        // 独立的展开逻辑
    }
    
    pub fn is_expanded(&self, node_id: NodeId) -> bool {
        self.expanded_keys.contains(&node_id)
    }
}

// wasm/bindings.rs - WASM 绑定层，隔离 WASM 相关代码
use wasm_bindgen::prelude::*;
use crate::engine::TreeEngine;  // 只依赖公共接口

#[wasm_bindgen]
pub struct WasmTreeEngine {
    inner: TreeEngine,  // 内部实现，不暴露给 JS
}

#[wasm_bindgen]
impl WasmTreeEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: TreeEngine::new(),
        }
    }
    
    // 只暴露必要的方法，隐藏内部实现
    #[wasm_bindgen]
    pub fn expand_node(&mut self, id: u64) -> Result<(), JsValue> {
        self.inner.expand_node(id)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }
}
```

#### JS 端模块解耦示例

```typescript
// wasm/engine/interface.ts - 接口定义（不依赖实现）
export interface ITreeEngine {
  loadTree(data: TreeNodeData[]): Promise<void>
  getVisibleNodes(): FlatTreeNode[]
  expandNode(id: string | number): void
  collapseNode(id: string | number): void
  // ... 其他方法
}

// wasm/engine/js-engine.ts - JS 实现（不依赖 WASM）
import type { ITreeEngine } from './interface'
import { useTreeData as useJsTreeData } from '../../../composables/useTreeData'

export class JsTreeEngine implements ITreeEngine {
  private treeData: ReturnType<typeof useJsTreeData>
  
  async loadTree(data: TreeNodeData[]): Promise<void> {
    // 使用现有的 JS 实现
    this.treeData.regenerateFlatTree()
  }
  
  getVisibleNodes(): FlatTreeNode[] {
    return this.treeData.visibleNodes.value
  }
  
  // ... 实现其他接口方法
}

// wasm/engine/wasm-engine.ts - WASM 实现（不依赖 JS 实现细节）
import type { ITreeEngine } from './interface'
import { initWasm, TreeEngine } from '../loader'
import { IdConverter } from '../bridge/id-converter'
import { DataMapper } from '../bridge/data-mapper'

export class WasmTreeEngine implements ITreeEngine {
  private wasmEngine: TreeEngine
  private nodeDataMap: Map<number, TreeNodeData>
  
  constructor() {
    this.wasmEngine = new TreeEngine()
    this.nodeDataMap = new Map()
  }
  
  async loadTree(data: TreeNodeData[]): Promise<void> {
    await initWasm()
    // 建立数据映射
    data.forEach(node => {
      const id = IdConverter.toRust(node.id)
      this.nodeDataMap.set(id, node)
    })
    // 调用 WASM
    await this.wasmEngine.loadTree(JSON.stringify(data))
  }
  
  getVisibleNodes(): FlatTreeNode[] {
    // 获取精简信息
    const infos = JSON.parse(this.wasmEngine.getVisibleNodes())
    // 合并完整数据
    return infos.map((info: VisibleNodeInfo) => 
      DataMapper.mergeVisibleNode(info, this.nodeDataMap.get(info.id)!)
    )
  }
  
  // ... 实现其他接口方法
}

// wasm/bridge/id-converter.ts - 独立的转换模块
export class IdConverter {
  private static stringIdMap = new Map<string, number>()
  private static numberIdMap = new Map<number, number>()
  private static nextId = 1
  
  static toRust(id: string | number): number {
    if (typeof id === 'string') {
      if (!this.stringIdMap.has(id)) {
        this.stringIdMap.set(id, this.nextId++)
      }
      return this.stringIdMap.get(id)!
    }
    return id as number
  }
  
  static toJs(rustId: number): string | number {
    // 反向查找
    for (const [strId, numId] of this.stringIdMap.entries()) {
      if (numId === rustId) return strId
    }
    return rustId
  }
}

// wasm/bridge/data-mapper.ts - 独立的数据映射模块
export class DataMapper {
  static mergeVisibleNode(
    info: VisibleNodeInfo,
    data: TreeNodeData
  ): FlatTreeNode {
    return {
      id: IdConverter.toJs(info.id),
      data,
      level: info.level,
      parentId: info.parentId ? IdConverter.toJs(info.parentId) : null,
      index: info.index,
      ...this.parseFlags(info.flags),
    }
  }
  
  private static parseFlags(flags: number) {
    return {
      isExpanded: !!(flags & 0x01),
      isChecked: !!(flags & 0x02),
      // ...
    }
  }
}

// composables/useTreeData.ts - 通过接口使用引擎
import type { ITreeEngine } from '../wasm/engine/interface'
import { createEngine } from '../wasm/engine/factory'

export function useTreeData(props: VirtualTreeProps, emit: EmitFn<VirtualTreeEmits>) {
  const engineRef = ref<ITreeEngine | null>(null)
  
  // 通过工厂函数创建引擎（依赖注入）
  onMounted(async () => {
    engineRef.value = await createEngine(props.useWasm)
  })
  
  // 只使用接口方法，不依赖具体实现
  const getVisibleNodes = () => {
    return engineRef.value?.getVisibleNodes() || []
  }
  
  // ...
}
```

### 模块依赖规则

#### ✅ 允许的依赖方向

```
Vue Component
    ↓
Composables
    ↓
Engine Interface
    ↓
Engine Implementations (JsEngine / WasmEngine)
    ↓
Bridge Layer (Converter / Mapper)
    ↓
WASM Loader
    ↓
Rust WASM Bindings
    ↓
Rust Engine Core
    ↓
Rust Modules (flatten, visible, state, filter)
```

#### ❌ 禁止的依赖方向
- Engine 实现不能互相依赖
- Bridge 模块不能依赖 Composables
- Rust 模块不能依赖 WASM 绑定层
- 业务模块不能依赖工具模块的实现细节

---

## 方案 A：最小化数据传输

### 阶段 1：基础数据结构设计

#### 1.1 Rust 端数据结构

```rust
// 节点 ID 类型（统一使用 u64，JS 端需要转换）
pub type NodeId = u64;

// 节点状态标志位（位掩码优化）
#[derive(Clone, Copy, Debug)]
pub struct NodeFlags(u8);

impl NodeFlags {
    const EXPANDED: u8 = 1 << 0;
    const CHECKED: u8 = 1 << 1;
    const INDETERMINATE: u8 = 1 << 2;
    const DISABLED: u8 = 1 << 3;
    const LOADING: u8 = 1 << 4;
    const LOADED: u8 = 1 << 5;
    const LEAF: u8 = 1 << 6;
}

// 精简的可见节点信息（只包含必要字段）
#[derive(Clone, Debug)]
pub struct VisibleNodeInfo {
    pub id: NodeId,
    pub level: u8,
    pub parent_id: Option<NodeId>,
    pub index: u32,
    pub flags: NodeFlags,
}

// 树节点结构（内部使用）
struct TreeNode {
    id: NodeId,
    parent_id: Option<NodeId>,
    level: u8,
    index: u32,
    children_ids: Vec<NodeId>,
    flags: NodeFlags,
}

// 树引擎（核心结构）
pub struct TreeEngine {
    nodes: Vec<TreeNode>,
    id_to_index: HashMap<NodeId, usize>,
    visible_indices: Vec<usize>,
    expanded_keys: HashSet<NodeId>,
    checked_keys: HashSet<NodeId>,
    config: TreeConfig,
}
```

#### 1.2 JS 端数据结构

```typescript
// 精简的可见节点信息（对应 Rust 的 VisibleNodeInfo）
interface VisibleNodeInfo {
  id: number
  level: number
  parentId: number | null
  index: number
  flags: number  // 位掩码
}

// 从 flags 解析状态
function parseFlags(flags: number) {
  return {
    isExpanded: !!(flags & 0x01),
    isChecked: !!(flags & 0x02),
    isIndeterminate: !!(flags & 0x04),
    isDisabled: !!(flags & 0x08),
    isLoading: !!(flags & 0x10),
    isLoaded: !!(flags & 0x20),
    isLeaf: !!(flags & 0x40),
  }
}
```

### 阶段 2：核心功能实现

#### 2.1 树数据初始化

**功能列表：**
- [ ] `TreeEngine::new()` - 创建引擎实例
- [ ] `TreeEngine::load_tree()` - 加载树形数据（接收 JSON）
- [ ] `TreeEngine::build_tree()` - 构建内部树结构
- [ ] `TreeEngine::flatten_tree()` - 扁平化树结构

**实现步骤：**
1. 实现 JSON 解析（使用 `serde` 和 `serde_json`）
2. 递归构建树节点结构
3. 建立 ID 到索引的映射
4. 计算初始可见节点列表

#### 2.2 可见节点计算

**功能列表：**
- [ ] `TreeEngine::calculate_visible_nodes()` - 计算可见节点
- [ ] `TreeEngine::get_visible_nodes()` - 获取可见节点信息
- [ ] `TreeEngine::expand_node()` - 展开节点
- [ ] `TreeEngine::collapse_node()` - 折叠节点

**实现步骤：**
1. 基于 `expanded_keys` 计算可见节点索引
2. 返回可见节点的精简信息数组
3. 实现展开/折叠操作，更新 `expanded_keys`
4. 重新计算可见节点列表

#### 2.3 状态管理

**功能列表：**
- [ ] `TreeEngine::set_expanded()` - 设置节点展开状态
- [ ] `TreeEngine::set_checked()` - 设置节点选中状态
- [ ] `TreeEngine::get_checked_keys()` - 获取选中的节点 ID
- [ ] `TreeEngine::get_half_checked_keys()` - 获取半选节点 ID
- [ ] `TreeEngine::update_check_state()` - 更新父子关联的选中状态

**实现步骤：**
1. 实现选中状态管理（支持严格模式）
2. 实现父子关联逻辑
3. 计算半选状态
4. 批量操作优化

#### 2.4 过滤功能

**功能列表：**
- [ ] `TreeEngine::filter_nodes()` - 过滤节点
- [ ] `TreeEngine::clear_filter()` - 清除过滤
- [ ] `TreeEngine::get_filtered_visible_nodes()` - 获取过滤后的可见节点

**实现步骤：**
1. 实现节点过滤逻辑（需要 JS 端传入过滤函数或过滤结果）
2. 计算过滤后的可见节点
3. 自动展开匹配节点的父节点

### 阶段 3：WASM 绑定

#### 3.1 导出函数

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct TreeEngine {
    engine: tree_engine::TreeEngine,
}

#[wasm_bindgen]
impl TreeEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> TreeEngine { ... }

    // 加载树数据
    #[wasm_bindgen]
    pub fn load_tree(&mut self, json_data: &str) -> Result<(), JsValue> { ... }

    // 获取可见节点（返回 JSON 字符串）
    #[wasm_bindgen]
    pub fn get_visible_nodes(&self) -> String { ... }

    // 展开节点
    #[wasm_bindgen]
    pub fn expand_node(&mut self, node_id: u64) -> Result<(), JsValue> { ... }

    // 折叠节点
    #[wasm_bindgen]
    pub fn collapse_node(&mut self, node_id: u64) -> Result<(), JsValue> { ... }

    // 设置选中状态
    #[wasm_bindgen]
    pub fn set_checked(&mut self, node_id: u64, checked: bool) -> Result<(), JsValue> { ... }

    // 获取选中的节点 ID
    #[wasm_bindgen]
    pub fn get_checked_keys(&self) -> Vec<u64> { ... }
}
```

#### 3.2 类型转换

**需要实现的转换：**
- [ ] JS `string | number` ID → Rust `u64`
- [ ] Rust `VisibleNodeInfo` → JS 对象
- [ ] JS JSON → Rust 树结构
- [ ] Rust 错误 → JS Error

### 阶段 4：JS 端集成

#### 4.1 WASM 模块加载

```typescript
// wasm-loader.ts
import init, { TreeEngine } from '@wxwzl/vue-virtual-tree-core'

let wasmInitialized = false

export async function initWasm() {
  if (!wasmInitialized) {
    await init()
    wasmInitialized = true
  }
}

export function createTreeEngine() {
  return new TreeEngine()
}
```

#### 4.2 数据映射层

```typescript
// tree-wasm-bridge.ts
class TreeWasmBridge {
  private engine: TreeEngine
  private nodeDataMap: Map<number, TreeNodeData>  // ID -> 完整数据
  private idConverter: IdConverter  // string/number <-> u64

  // 加载数据
  async loadTree(data: TreeNodeData[]) {
    // 1. 转换 ID 为 u64
    // 2. 建立 ID -> 数据的映射
    // 3. 序列化为 JSON 传给 WASM
    // 4. 调用 engine.load_tree()
  }

  // 获取可见节点（完整对象）
  getVisibleNodes(): FlatTreeNode[] {
    // 1. 调用 engine.get_visible_nodes() 获取精简信息
    // 2. 从 nodeDataMap 获取完整数据
    // 3. 合并为完整的 FlatTreeNode
  }
}
```

#### 4.3 Composables 集成

**修改 `useTreeData.ts`：**
- [ ] 添加 `useWasm` prop 支持（控制使用 JS 还是 WASM）
- [ ] 添加 WASM 引擎初始化（仅在 `useWasm=true` 时）
- [ ] 实现双模式支持（JS 模式和 WASM 模式）
- [ ] 替换 `flattenTree` 为 WASM 调用（WASM 模式）
- [ ] 替换 `expandNode`/`collapseNode` 为 WASM 调用（WASM 模式）
- [ ] 保持现有 API 不变（向后兼容）
- [ ] 实现自动降级（WASM 加载失败时回退到 JS）

---

## 方案 B：共享内存优化

### 阶段 1：内存布局设计

#### 1.1 线性内存结构

```rust
// 使用线性数组存储，避免指针跳转
pub struct TreeMemory {
    // 节点数据（固定大小结构）
    nodes: Vec<NodeData>,
    
    // 可见节点索引数组
    visible_indices: Vec<usize>,
    
    // ID 到索引的映射
    id_map: HashMap<NodeId, usize>,
}

// 固定大小的节点数据（便于直接内存访问）
#[repr(C)]
pub struct NodeData {
    pub id: NodeId,
    pub parent_id: NodeId,  // 0 表示无父节点
    pub level: u8,
    pub index: u32,
    pub flags: u8,
    pub children_start: u32,  // 子节点在 children_array 中的起始索引
    pub children_count: u16,  // 子节点数量
}
```

#### 1.2 WebAssembly.Memory 共享

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct TreeEngine {
    memory: TreeMemory,
}

#[wasm_bindgen]
impl TreeEngine {
    // 获取内存指针和大小
    #[wasm_bindgen]
    pub fn get_memory_ptr(&self) -> *const NodeData { ... }

    #[wasm_bindgen]
    pub fn get_memory_size(&self) -> usize { ... }

    // 获取可见节点索引数组（TypedArray）
    #[wasm_bindgen]
    pub fn get_visible_indices(&self) -> Vec<usize> { ... }
}
```

### 阶段 2：零拷贝数据访问

#### 2.1 JS 端直接访问内存

```typescript
// 使用 WebAssembly.Memory 和 TypedArray
class SharedMemoryTreeEngine {
  private memory: WebAssembly.Memory
  private nodeDataView: DataView
  private nodeDataArray: Uint8Array

  constructor(engine: TreeEngine) {
    // 获取 WASM 内存
    this.memory = engine.get_memory()
    
    // 创建视图直接访问内存
    const ptr = engine.get_memory_ptr()
    const size = engine.get_memory_size()
    this.nodeDataArray = new Uint8Array(this.memory.buffer, ptr, size)
    this.nodeDataView = new DataView(this.memory.buffer, ptr, size)
  }

  // 直接读取节点数据（零拷贝）
  readNodeData(index: number): NodeData {
    const offset = index * NodeData.SIZE
    return {
      id: this.nodeDataView.getBigUint64(offset, true),
      parentId: this.nodeDataView.getBigUint64(offset + 8, true),
      level: this.nodeDataView.getUint8(offset + 16),
      // ...
    }
  }
}
```

#### 2.2 批量读取优化

```typescript
// 批量读取可见节点数据
getVisibleNodesBatch(start: number, count: number): VisibleNodeInfo[] {
  const indices = this.engine.get_visible_indices()
  const result: VisibleNodeInfo[] = []
  
  for (let i = start; i < Math.min(start + count, indices.length); i++) {
    const nodeIndex = indices[i]
    const nodeData = this.readNodeData(nodeIndex)
    result.push(this.convertToVisibleNodeInfo(nodeData))
  }
  
  return result
}
```

### 阶段 3：增量更新机制

#### 3.1 差异计算

```rust
pub struct VisibleNodesDiff {
    pub added: Vec<usize>,      // 新增的节点索引
    pub removed: Vec<usize>,    // 移除的节点索引
    pub updated: Vec<usize>,    // 更新的节点索引
}

impl TreeEngine {
    pub fn calculate_diff(&self, old_visible: &[usize]) -> VisibleNodesDiff {
        // 计算新旧可见节点列表的差异
    }
}
```

#### 3.2 JS 端增量应用

```typescript
applyDiff(diff: VisibleNodesDiff) {
  // 只更新变化的部分，而不是重建整个列表
  for (const index of diff.removed) {
    this.visibleNodes.splice(index, 1)
  }
  for (const index of diff.added) {
    // 插入新节点
  }
  for (const index of diff.updated) {
    // 更新节点状态
  }
}
```

---

## 数据结构设计

### Rust 端完整结构

```rust
// 树配置
pub struct TreeConfig {
    pub id_field: String,
    pub children_field: String,
    pub label_field: String,
    pub disabled_field: String,
    pub is_leaf_field: String,
}

// 节点数据（内部）
struct TreeNode {
    id: NodeId,
    parent_id: Option<NodeId>,
    level: u8,
    index: u32,
    children_ids: Vec<NodeId>,
    flags: NodeFlags,
}

// 树引擎
pub struct TreeEngine {
    nodes: Vec<TreeNode>,
    id_to_index: HashMap<NodeId, usize>,
    visible_indices: Vec<usize>,
    expanded_keys: HashSet<NodeId>,
    checked_keys: HashSet<NodeId>,
    half_checked_keys: HashSet<NodeId>,
    config: TreeConfig,
}
```

### JS 端接口

```typescript
interface TreeWasmEngine {
  // 初始化
  loadTree(data: TreeNodeData[]): Promise<void>
  
  // 可见节点
  getVisibleNodes(): VisibleNodeInfo[]
  getVisibleNodesCount(): number
  
  // 展开/折叠
  expandNode(id: string | number): void
  collapseNode(id: string | number): void
  setExpanded(id: string | number, expanded: boolean): void
  
  // 选中
  setChecked(id: string | number, checked: bool): void
  getCheckedKeys(): (string | number)[]
  getHalfCheckedKeys(): (string | number)[]
  
  // 过滤
  filterNodes(filterFn: (node: TreeNodeData) => boolean): void
  clearFilter(): void
  
  // 查询
  getNodeById(id: string | number): VisibleNodeInfo | null
  getChildrenIds(id: string | number): (string | number)[]
  getAllDescendantIds(id: string | number): (string | number)[]
}

// 统一的树引擎接口（支持 JS 和 WASM 两种实现）
interface ITreeEngine {
  // 所有方法签名与 TreeWasmEngine 相同
  // JS 实现和 WASM 实现都实现此接口
}
```

---

## API 接口设计

### 核心 API

#### 1. 初始化 API

```rust
// Rust
#[wasm_bindgen]
impl TreeEngine {
    pub fn new() -> TreeEngine
    pub fn load_tree(&mut self, json: &str) -> Result<(), JsValue>
    pub fn get_total_count(&self) -> usize
}
```

```typescript
// TypeScript
const engine = new TreeEngine()
await engine.loadTree(treeData)
const totalCount = engine.getTotalCount()
```

#### 2. 可见节点 API

```rust
// Rust
#[wasm_bindgen]
impl TreeEngine {
    pub fn get_visible_nodes(&self) -> String  // JSON
    pub fn get_visible_count(&self) -> usize
    pub fn get_visible_indices(&self) -> Vec<usize>  // 方案 B
}
```

```typescript
// TypeScript
const visibleNodes = engine.getVisibleNodes()  // 方案 A: JSON
const indices = engine.getVisibleIndices()     // 方案 B: TypedArray
```

#### 3. 展开/折叠 API

```rust
// Rust
#[wasm_bindgen]
impl TreeEngine {
    pub fn expand_node(&mut self, id: u64) -> Result<(), JsValue>
    pub fn collapse_node(&mut self, id: u64) -> Result<(), JsValue>
    pub fn set_expanded(&mut self, id: u64, expanded: bool) -> Result<(), JsValue>
    pub fn expand_all(&mut self)
    pub fn collapse_all(&mut self)
}
```

#### 4. 选中状态 API

```rust
// Rust
#[wasm_bindgen]
impl TreeEngine {
    pub fn set_checked(&mut self, id: u64, checked: bool) -> Result<(), JsValue>
    pub fn toggle_checked(&mut self, id: u64) -> Result<(), JsValue>
    pub fn get_checked_keys(&self) -> Vec<u64>
    pub fn get_half_checked_keys(&self) -> Vec<u64>
    pub fn set_check_strictly(&mut self, strictly: bool)
}
```

#### 5. 过滤 API

```rust
// Rust
// 注意：过滤函数需要在 JS 端执行，Rust 只处理结果
#[wasm_bindgen]
impl TreeEngine {
    pub fn set_filtered_nodes(&mut self, node_ids: Vec<u64>)
    pub fn clear_filter(&mut self)
    pub fn is_filtered(&self) -> bool
}
```

---

## 集成步骤

### 步骤 0：JS Engine 实现（优先）

**目标**：将 `packages/vue-virtual-tree` 中的数据处理相关代码全部抽离到 `packages/core` 的 JS 引擎中。

#### 0.1 创建 JS Engine 项目结构

1. **创建目录结构**
   ```
   packages/vue-virtual-tree/src/js-engine/
   ├── index.ts
   ├── engine/
   │   ├── interface.ts
   │   ├── js-engine.ts
   │   └── factory.ts
   ├── flatten/
   │   └── flatten-tree.ts
   ├── visible/
   │   └── visible-nodes.ts
   ├── state/
   │   ├── expand.ts
   │   └── check.ts
   ├── filter/
   │   └── filter-tree.ts
   └── utils/
       ├── tree.ts
       └── config.ts
   ```

2. **说明**
   - JS Engine 代码直接放在 `packages/vue-virtual-tree/src/js-engine/` 目录下
   - 不需要单独的 TypeScript 配置，使用 `packages/vue-virtual-tree` 的 tsconfig.json
   - 不需要单独的打包配置，由 `packages/vue-virtual-tree` 的构建流程统一处理

#### 0.2 定义 ITreeEngine 接口

```typescript
// packages/vue-virtual-tree/src/js-engine/engine/interface.ts
export interface ITreeEngine {
  // 初始化
  loadTree(data: TreeNodeData[], config?: TreeConfig): Promise<void>
  
  // 可见节点
  getVisibleNodes(): FlatTreeNode[]
  getVisibleNodesCount(): number
  
  // 展开/折叠
  expandNode(id: string | number): void
  collapseNode(id: string | number): void
  setExpanded(id: string | number, expanded: boolean): void
  expandAll(): void
  collapseAll(): void
  
  // 选中
  setChecked(id: string | number, checked: boolean): void
  toggleChecked(id: string | number): void
  getCheckedKeys(): (string | number)[]
  getHalfCheckedKeys(): (string | number)[]
  
  // 过滤
  filterNodes(filterFn: (node: TreeNodeData) => boolean): void
  clearFilter(): void
  
  // 查询
  getNodeById(id: string | number): FlatTreeNode | null
  getNodeData(id: string | number): TreeNodeData | null
  getChildrenIds(id: string | number): (string | number)[]
  getAllDescendantIds(id: string | number): (string | number)[]
}
```

#### 0.3 抽离代码到各模块

**重要原则**：每抽离一个方法，立即编写单元测试，确保抽离后的方法输出与原代码完全一致。测试通过后才能继续下一个方法的抽离。

**测试策略**：
1. 使用相同的输入数据，分别调用原代码和抽离后的代码
2. 对比输出结果，确保完全一致（包括数据结构、顺序、状态等）
3. 覆盖各种边界情况（空数据、单节点、深层嵌套、大数据量等）
4. 每个方法都要有对应的测试用例

1. **抽离扁平化逻辑**
   - 从 `useTreeData.ts` 的 `flattenTree` 函数抽离到 `flatten/flatten-tree.ts`
   - **立即测试**：编写 `flattenTree` 的单元测试，对比原代码和抽离后的输出
   - 从 `useTreeData.ts` 的 `insertFlatTree` 函数抽离
   - **立即测试**：编写 `insertFlatTree` 的单元测试，对比原代码和抽离后的输出

2. **抽离可见节点计算**
   - 从 `useTreeData.ts` 的可见节点相关逻辑抽离到 `visible/visible-nodes.ts`
   - **立即测试**：编写可见节点计算的单元测试，对比原代码和抽离后的输出

3. **抽离展开/折叠逻辑**
   - 从 `useTreeExpand.ts` 抽离到 `state/expand.ts`
   - **立即测试**：为每个方法（`initExpandedKeys`、`expandNode`、`collapseNode` 等）编写单元测试

4. **抽离选中状态管理**
   - 从 `useTreeSelection.ts` 抽离到 `state/check.ts`
   - **立即测试**：为每个方法（`setNodeChecked`、`updateHalfCheckedKeys` 等）编写单元测试

5. **抽离过滤逻辑**
   - 从 `useTreeFilter.ts` 抽离到 `filter/filter-tree.ts`
   - **立即测试**：为每个方法（`filter`、`clearFilter`、`mergeSort` 等）编写单元测试

6. **抽离工具函数**
   - 从 `utils/tree.ts` 抽离到 `utils/tree.ts`（复制到 js-engine）
   - **立即测试**：为每个工具函数编写单元测试，确保输出一致

#### 0.4 实现 JsTreeEngine

```typescript
// packages/vue-virtual-tree/src/js-engine/engine/js-engine.ts
import type { ITreeEngine } from './interface'
import { flattenTree } from '../flatten/flatten-tree'
import { calculateVisibleNodes } from '../visible/visible-nodes'
import { ExpandState } from '../state/expand'
import { CheckState } from '../state/check'
import { FilterState } from '../filter/filter-tree'

export class JsTreeEngine implements ITreeEngine {
  private flatTree: FlatTreeNode[] = []
  private flatNodeMap: Map<string | number, FlatTreeNode> = new Map()
  private visibleNodes: FlatTreeNode[] = []
  private expandState: ExpandState
  private checkState: CheckState
  private filterState: FilterState
  private config: TreeConfig

  constructor(config?: TreeConfig) {
    this.config = config || {}
    this.expandState = new ExpandState()
    this.checkState = new CheckState()
    this.filterState = new FilterState()
  }

  async loadTree(data: TreeNodeData[], config?: TreeConfig): Promise<void> {
    // 实现数据加载和扁平化
    const result = flattenTree(data, 0, null, 0, true, config || this.config)
    this.flatTree = result.flatNodes
    this.flatNodeMap = result.nodeMap
    this.visibleNodes = calculateVisibleNodes(this.flatTree, this.expandState)
  }

  getVisibleNodes(): FlatTreeNode[] {
    return this.visibleNodes
  }

  expandNode(id: string | number): void {
    this.expandState.expand(id)
    this.visibleNodes = calculateVisibleNodes(this.flatTree, this.expandState)
  }

  // ... 实现其他接口方法
}
```

#### 0.5 重构 Composables

```typescript
// packages/vue-virtual-tree/src/composables/useTreeData.ts
import { createEngine } from '../js-engine/engine/factory'
import type { ITreeEngine } from '../js-engine/engine/interface'

export function useTreeData(props: VirtualTreeProps, emit: EmitFn<VirtualTreeEmits>) {
  const engine = createEngine(false) // 使用 JS 引擎

  // 使用引擎接口操作数据
  watch(() => props.data, async (newData) => {
    await engine.loadTree(newData, props.props)
    // ...
  })

  // ...
}
```

#### 0.6 测试验证

**注意**：单元测试应在每个模块抽离时完成（见 0.3），这里主要是集成测试和整体验证。

1. [ ] 运行所有单元测试，确保 100% 通过
2. [ ] 集成测试（composables 与引擎）
3. [ ] 对比测试：使用相同的测试数据，对比使用原 composables 和使用引擎后的输出
4. [ ] 功能完整性测试（确保所有现有功能正常工作）
5. [ ] 性能测试（确保性能不下降）
6. [ ] 边界情况测试（空数据、大数据量、深层嵌套等）

### 步骤 1：Rust WASM 核心实现（Phase 1，后续实现）

1. **添加依赖**
   ```toml
   // packages/core/Cargo.toml
   [dependencies]
   wasm-bindgen = "0.2"
   serde = { version = "1.0", features = ["derive"] }
   serde_json = "1.0"
   ```

2. **实现基础结构**
   - [ ] 定义 `TreeNode`、`TreeEngine` 结构
   - [ ] 实现 `load_tree` 方法
   - [ ] 实现 `flatten_tree` 方法
   - [ ] 实现 `calculate_visible_nodes` 方法

3. **实现状态管理**
   - [ ] 实现展开/折叠逻辑
   - [ ] 实现选中状态管理
   - [ ] 实现父子关联逻辑

4. **WASM 绑定**
   - [ ] 导出 `TreeEngine` 结构
   - [ ] 导出核心方法
   - [ ] 实现错误处理

5. **构建 WASM**
   ```bash
   # 使用根目录的 build:core 命令
   pnpm run build:core
   # 或直接执行
   cd packages/core && wasm-pack build --target web --out-dir ../vue-virtual-tree/lib --out-name lib
   ```
   - 打包产物输出到 `packages/vue-virtual-tree/lib/` 目录
   - 生成 `lib.js`、`lib_bg.wasm`、`lib.d.ts` 等文件

6. **测试**
   - [ ] 单元测试（Rust）
   - [ ] WASM 测试（wasm-bindgen-test）
   - [ ] 性能测试

### 步骤 2：WASM 桥接层实现（Phase 1）

1. **创建 WASM 加载器**
   - [ ] `wasm/loader.ts`: WASM 模块加载，从 `lib/` 目录加载
   ```typescript
   // packages/vue-virtual-tree/src/wasm/loader.ts
   import init, { TreeEngine } from '../lib/lib.js'
   
   let wasmInitialized = false
   
   export async function initWasm() {
     if (!wasmInitialized) {
       await init()
       wasmInitialized = true
     }
   }
   
   export function createWasmEngine() {
     return new TreeEngine()
   }
   ```

2. **创建桥接层（按模块隔离）**
   - [ ] `wasm/bridge/id-converter.ts`: ID 类型转换（独立模块）
   - [ ] `wasm/bridge/data-mapper.ts`: 数据格式映射（独立模块）
   - [ ] `wasm/engine/wasm-engine.ts`: 实现 `WasmTreeEngine`（WASM 桥接）
   - [ ] `wasm/engine/interface.ts`: 从 `js-engine` 导入接口
   - [ ] `wasm/engine/js-engine.ts`: 从 `js-engine` 导入实现
   - [ ] `wasm/index.ts`: 统一导出（不暴露内部实现）

3. **更新引擎工厂函数**
   - [ ] 修改 `js-engine/engine/factory.ts`，支持根据 `useWasm` 选择引擎
   - [ ] 实现自动降级逻辑（WASM 不可用时回退 JS）

4. **添加 Prop 支持**
   - [ ] 在 `VirtualTreeProps` 中添加 `useWasm?: boolean` prop
   - [ ] 默认值为 `false`（保持向后兼容）
   - [ ] 添加 WASM 可用性检测

5. **集成到 Composables**
   - [ ] 修改 `useTreeData.ts`，根据 `useWasm` prop 选择引擎
   - [ ] 保持现有 API 完全兼容

6. **测试**
   - [ ] JS 模式功能测试
   - [ ] WASM 模式功能测试
   - [ ] 模式切换测试
   - [ ] 性能对比测试
   - [ ] 降级机制测试
   - [ ] 边界情况测试

### 步骤 3：共享内存优化（方案 B）

1. **内存布局设计**
   - [ ] 定义 `NodeData` 结构（`#[repr(C)]`）
   - [ ] 实现线性存储
   - [ ] 实现内存管理

2. **WASM 内存导出**
   - [ ] 导出内存指针
   - [ ] 导出内存大小
   - [ ] 导出可见节点索引数组

3. **JS 端零拷贝访问**
   - [ ] 实现 `SharedMemoryTreeEngine`
   - [ ] 实现直接内存读取
   - [ ] 实现批量读取优化

4. **增量更新**
   - [ ] 实现差异计算
   - [ ] 实现增量应用
   - [ ] 性能优化

5. **测试和优化**
   - [ ] 性能测试
   - [ ] 内存泄漏测试
   - [ ] 并发安全测试

---

## 测试计划

### 单元测试（Rust）

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tree_loading() { ... }

    #[test]
    fn test_flatten_tree() { ... }

    #[test]
    fn test_expand_collapse() { ... }

    #[test]
    fn test_check_state() { ... }
}
```

### WASM 测试

```rust
#[cfg(test)]
mod wasm_tests {
    use wasm_bindgen_test::*;
    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn test_wasm_engine() { ... }
}
```

### 性能测试

```typescript
// performance-test.ts
describe('Performance Tests', () => {
  it('should flatten 1M nodes in < 200ms', async () => {
    const data = generateTreeData(1000000)
    const start = performance.now()
    await engine.loadTree(data)
    const duration = performance.now() - start
    expect(duration).toBeLessThan(200)
  })
})
```

### 集成测试

- [ ] 小数据量测试（< 1000 节点）
- [ ] 中等数据量测试（10K - 100K 节点）
- [ ] 大数据量测试（100K - 1M 节点）
- [ ] 超大数据量测试（> 1M 节点）

---

## 性能优化策略

### 1. 算法优化

- [ ] **迭代替代递归**：避免栈溢出，提升性能
- [ ] **批量操作**：减少 WASM 调用次数
- [ ] **增量更新**：只计算变化的部分
- [ ] **缓存优化**：缓存计算结果

### 2. 内存优化

- [ ] **紧凑数据结构**：使用位掩码存储状态
- [ ] **预分配内存**：减少动态分配
- [ ] **内存池**：重用节点对象
- [ ] **零拷贝**：方案 B 的直接内存访问

### 3. 序列化优化

- [ ] **最小化数据**：只传递必要字段
- [ ] **二进制格式**：考虑 MessagePack 或 Protobuf
- [ ] **流式传输**：大数据量分批传输
- [ ] **共享内存**：方案 B 的零拷贝

### 4. 并发优化

- [ ] **并行扁平化**：使用 rayon 并行处理
- [ ] **异步加载**：WASM 初始化异步化
- [ ] **Web Worker**：在 Worker 中运行 WASM

---

## 开发优先级

### Phase 0：JS Engine 实现（优先，2-3 周）

**目标**：将 `packages/vue-virtual-tree` 中的数据处理相关代码全部抽离到 `packages/core` 的 JS 引擎中，直到 js-engine 完全顶替了现在的所有数据处理功能代码。

#### 0.1 项目结构调整
1. [ ] 在 `packages/core` 中创建 JS 引擎目录结构
2. [ ] 配置 TypeScript 编译和打包
3. [ ] 设置测试环境

#### 0.2 接口设计
1. [ ] 定义 `ITreeEngine` 接口（包含所有数据处理方法）
2. [ ] 定义引擎配置类型
3. [ ] 定义数据结构和类型

#### 0.3 代码抽离
1. [ ] 抽离 `flattenTree` 函数（从 `useTreeData.ts`）
2. [ ] 抽离可见节点计算逻辑（从 `useTreeData.ts`）
3. [ ] 抽离展开/折叠逻辑（从 `useTreeExpand.ts`）
4. [ ] 抽离选中状态管理（从 `useTreeSelection.ts`）
5. [ ] 抽离过滤逻辑（从 `useTreeFilter.ts`）
6. [ ] 抽离工具函数（从 `utils/tree.ts`）

#### 0.4 JsTreeEngine 实现
1. [ ] 实现 `JsTreeEngine` 类，实现 `ITreeEngine` 接口
2. [ ] 整合所有抽离的模块
3. [ ] 实现数据加载和初始化
4. [ ] 实现扁平化功能
5. [ ] 实现可见节点计算
6. [ ] 实现展开/折叠功能
7. [ ] 实现选中状态管理
8. [ ] 实现过滤功能

#### 0.5 Composables 重构
1. [ ] 重构 `useTreeData.ts`，使用引擎接口
2. [ ] 重构 `useTreeExpand.ts`，使用引擎接口
3. [ ] 重构 `useTreeSelection.ts`，使用引擎接口
4. [ ] 重构 `useTreeFilter.ts`，使用引擎接口
5. [ ] 确保所有功能正常工作

#### 0.6 测试和验证
1. [ ] 单元测试（引擎各模块）
2. [ ] 集成测试（composables 与引擎）
3. [ ] 功能完整性测试
4. [ ] 性能测试
5. [ ] 确保 js-engine 完全顶替现有数据处理功能

### Phase 1：Rust WASM 基础实现（后续，2-3 周）

**前提条件**：Phase 0 完成，js-engine 完全稳定

1. [ ] Rust 核心数据结构
2. [ ] 树加载和扁平化
3. [ ] 可见节点计算
4. [ ] 展开/折叠功能
5. [ ] WASM 绑定
6. [ ] JS 端基础集成（WasmTreeEngine）

### Phase 2：Rust WASM 完整功能（1-2 周）

1. [ ] 选中状态管理
2. [ ] 过滤功能
3. [ ] 查询功能
4. [ ] 错误处理
5. [ ] 完整测试

### Phase 3：方案 B 优化（2-3 周）

1. [ ] 内存布局设计
2. [ ] 共享内存实现
3. [ ] 零拷贝访问
4. [ ] 增量更新
5. [ ] 性能优化

### Phase 4：优化和测试（1 周）

1. [ ] 性能调优
2. [ ] 内存优化
3. [ ] 完整测试
4. [ ] 文档完善

---

## 注意事项

### 1. ID 类型转换
- JS 端使用 `string | number`
- Rust 端统一使用 `u64`
- 需要实现双向转换，处理字符串 ID 的哈希

### 2. 错误处理
- Rust 错误需要转换为 JS Error
- 使用 `Result<T, JsValue>` 返回错误
- JS 端需要 try-catch 处理

### 3. 内存管理
- WASM 内存需要手动管理
- 注意避免内存泄漏
- 大数据量时注意内存限制

### 4. 向后兼容
- 保持现有 API 完全不变
- 通过 `useWasm` prop 控制使用哪个版本
- 默认使用 JS 版本（`useWasm=false`），确保向后兼容
- 提供自动降级方案（WASM 加载失败时自动回退到 JS）
- 两种模式功能完全一致，只是性能不同

### 5. 调试支持
- 添加日志输出
- 提供调试模式
- 性能指标收集

### 6. 双模式支持
- 通过 `useWasm` prop 控制使用哪个版本
- 默认使用 JS 版本（`useWasm=false`），确保向后兼容
- 提供统一的 `ITreeEngine` 接口
- 实现 `JsTreeEngine`（封装现有 JS 代码）和 `WasmTreeEngine`（WASM 实现）
- 自动降级机制（WASM 加载失败时回退到 JS）
- 两种模式功能完全一致，仅性能不同

---

## 参考资料

- [wasm-bindgen 文档](https://rustwasm.github.io/wasm-bindgen/)
- [WebAssembly.Memory](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/Memory)
- [serde 文档](https://serde.rs/)
- [rayon 并行库](https://docs.rs/rayon/)

---

**文档版本**: 1.0  
**最后更新**: 2024  
**维护者**: vue-virtual-tree 团队

