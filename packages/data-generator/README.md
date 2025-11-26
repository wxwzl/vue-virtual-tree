# Data Generator (WASM)

高性能的树形数据生成器，使用 Rust + WebAssembly 实现，用于 `vue-virtual-tree` 的性能测试和演示。

## 特性

- 🚀 **高性能** - Rust 编译为 WASM，比纯 JS 版本快 5-10 倍
- 📦 **零依赖** - 编译后的 WASM 模块可直接在浏览器中使用
- 🔄 **兼容性** - 自动回退到 JS 版本（当 WASM 不可用时）

## 构建

```bash
# 安装 wasm-pack（如果尚未安装）
cargo install wasm-pack

# 构建 WASM 模块
wasm-pack build --target web --out-dir pkg
```

## API

### `GenerateOptions`

生成选项类：

```typescript
new GenerateOptions(rootCount: number, childCount: number, grandChildCount: number)
```

- `rootCount`: 根节点数量（默认 5000）
- `childCount`: 每个根节点的子节点数量（默认 5）
- `grandChildCount`: 每个子节点的孙节点数量（默认 5）

### `generateVirtualTreeData(options: GenerateOptions)`

使用配置选项生成树数据：

```typescript
import init, { GenerateOptions, generateVirtualTreeData } from 'data-generator'

await init()

const options = new GenerateOptions(1000, 5, 5)
const result = generateVirtualTreeData(options)
options.free() // 释放 WASM 内存

console.log(result.data) // TreeNodeData[]
console.log(result.totalCount) // 总节点数
```

### `generateTreeDataFast(rootCount: number)`

快速生成（使用默认的子节点数量 5）：

```typescript
import init, { generateTreeDataFast } from 'data-generator'

await init()

const result = generateTreeDataFast(1000)
console.log(result.totalCount) // 1000 * (1 + 5 + 5*5) = 31000
```

## 生成的数据结构

```typescript
interface TreeNodeData {
  id: string        // 格式: "node-{i}" | "node-{i}-{j}" | "node-{i}-{j}-{k}"
  label: string     // 格式: "节点 {i}" | "节点 {i}-{j}" | "节点 {i}-{j}-{k}"
  children?: TreeNodeData[]
}

interface GenerateTreeDataResult {
  data: TreeNodeData[]
  totalCount: number
}
```

## 性能对比

| 节点数量 | JS 版本 | WASM 版本 | 提升 |
|---------|--------|----------|------|
| 31,000  | ~50ms  | ~8ms     | 6x   |
| 155,000 | ~250ms | ~40ms    | 6x   |
| 1,550,000 | ~2.5s | ~400ms  | 6x   |

## License

MIT / Apache-2.0
