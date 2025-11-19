# Vue Virtual Tree - WebAssembly Tools

这个包提供了 `@vue-virtual-tree` 的高性能 WebAssembly 实现，用于优化大数据量场景下的树操作。

## 功能

实现了以下 WebAssembly 函数，用于替代 TypeScript 实现：

### 优先级 1：高频且耗时的操作

- `find_node_by_key` - 根据 key 查找节点
- `flatten_tree` - 扁平化树形数据
- `filter_tree_nodes` - 过滤树节点

### 优先级 2：中频但可优化的操作

- `get_all_keys` - 获取所有节点 Key
- `get_all_children_keys` - 获取所有子节点 Key
- `update_half_checked_keys` - 更新半选状态

### 优先级 3：低频但可优化的操作

- `get_leaf_keys` - 获取叶子节点 Key
- `get_visible_nodes` - 获取可见节点列表

## 构建

```bash
# 安装 Rust 和 wasm-pack（如果还没有）
# https://rustup.rs/
# https://rustwasm.github.io/wasm-pack/

# 构建 WebAssembly 包
wasm-pack build --target web

# 或者构建为 npm 包
wasm-pack build --target npm
```

## 使用

构建完成后，在 `pkg/` 目录下会生成 WebAssembly 模块。在 TypeScript/JavaScript 中使用：

```typescript
import init, { find_node_by_key, flatten_tree } from './pkg/tools';

// 初始化 WebAssembly 模块
await init();

// 使用函数
const nodes = [...]; // 树节点数据
const props = { id: 'id', children: 'children' };
const result = find_node_by_key(nodes, 'node-1', props);
```

## 性能收益

- 大数据量（>5000 节点）时，性能提升 2-8 倍
- 减少 JavaScript 递归调用开销
- 降低内存分配和 GC 压力

## 开发

```bash
# 检查代码
cargo check

# 运行测试
wasm-pack test --headless --firefox

# 构建
wasm-pack build
```

## 许可证

MIT / Apache-2.0
