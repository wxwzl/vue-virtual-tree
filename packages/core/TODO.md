# Vue Virtual Tree WASM 开发任务清单

## Phase 1: 方案 A - 基础实现

### 1.1 项目配置
- [ ] 更新 `Cargo.toml` 添加必要依赖（serde, serde_json）
- [ ] 配置 wasm-pack 构建选项
- [ ] 设置开发环境

### 1.2 模块结构创建
- [ ] 创建 `src/engine/` 目录和模块
- [ ] 创建 `src/flatten/` 目录和模块
- [ ] 创建 `src/visible/` 目录和模块
- [ ] 创建 `src/state/` 目录和模块
- [ ] 创建 `src/filter/` 目录和模块
- [ ] 创建 `src/utils/` 目录和模块
- [ ] 创建 `src/wasm/` 目录和模块（WASM 绑定层）

### 1.3 数据结构设计（按模块隔离）
- [ ] `engine/node.rs`: 定义 `NodeId` 类型（u64）
- [ ] `engine/node.rs`: 定义 `NodeFlags` 位掩码结构
- [ ] `engine/node.rs`: 定义 `TreeNode` 内部结构
- [ ] `visible/visible_nodes.rs`: 定义 `VisibleNodeInfo` 精简结构
- [ ] `engine/tree_engine.rs`: 定义 `TreeEngine` 核心结构
- [ ] `utils/config.rs`: 定义 `TreeConfig` 配置结构

### 1.4 核心功能实现（按模块实现）
- [ ] `engine/tree_engine.rs`: 实现 `TreeEngine::new()`
- [ ] `engine/tree_engine.rs`: 实现 `TreeEngine::load_tree()` - 调用各模块
- [ ] `flatten/flatten_tree.rs`: 实现 `flatten_tree()` - 独立扁平化算法
- [ ] `visible/visible_nodes.rs`: 实现 `calculate_visible_nodes()` - 独立可见节点计算
- [ ] `engine/tree_engine.rs`: 整合各模块功能
- [ ] 确保模块间通过接口通信，不直接依赖

### 1.5 展开/折叠功能（state 模块）
- [ ] `state/expand.rs`: 实现展开/折叠状态管理（独立模块）
- [ ] `state/expand.rs`: 实现 `expand_node()`、`collapse_node()` 等
- [ ] `engine/tree_engine.rs`: 通过状态模块接口调用
- [ ] 确保状态模块不依赖其他业务模块

### 1.6 WASM 绑定（wasm 模块隔离）
- [ ] `wasm/bindings.rs`: 使用 `#[wasm_bindgen]` 导出 `TreeEngine`
- [ ] `wasm/bindings.rs`: 导出初始化方法
- [ ] `wasm/bindings.rs`: 导出可见节点获取方法
- [ ] `wasm/bindings.rs`: 导出展开/折叠方法
- [ ] `wasm/bindings.rs`: 实现错误转换（Rust Error → JsValue）
- [ ] `wasm/mod.rs`: 只导出公共 API，隐藏内部实现
- [ ] 确保 wasm 模块不暴露 engine 内部结构

### 1.6 测试
- [ ] 编写 Rust 单元测试
- [ ] 编写 WASM 测试
- [ ] 测试小数据量（< 1000 节点）
- [ ] 测试中等数据量（10K 节点）

---

## Phase 2: 方案 A - 完整功能

### 2.1 选中状态管理（state/check 模块）
- [ ] `state/check.rs`: 实现选中状态管理（独立模块）
- [ ] `state/check.rs`: 实现 `set_checked()`、`toggle_checked()` 等
- [ ] `state/check.rs`: 实现父子关联逻辑（非严格模式）
- [ ] `state/check.rs`: 实现半选状态计算
- [ ] `engine/tree_engine.rs`: 通过状态模块接口调用
- [ ] 确保 check 模块不依赖 expand 模块

### 2.2 过滤功能（filter 模块）
- [ ] `filter/filter_tree.rs`: 实现过滤逻辑（独立模块）
- [ ] `filter/filter_tree.rs`: 设计过滤接口（JS 端执行过滤函数）
- [ ] `filter/filter_tree.rs`: 实现 `set_filtered_nodes()`、`clear_filter()` 等
- [ ] `filter/filter_tree.rs`: 实现过滤后自动展开父节点（调用 state 模块接口）
- [ ] `engine/tree_engine.rs`: 通过过滤模块接口调用
- [ ] 确保 filter 模块通过接口调用 state 模块，不直接依赖

### 2.3 查询功能
- [ ] 实现 `TreeEngine::get_node_by_id()`
- [ ] 实现 `TreeEngine::get_children_ids()`
- [ ] 实现 `TreeEngine::get_all_descendant_ids()`
- [ ] 实现 `TreeEngine::get_all_ancestor_ids()`
- [ ] 实现 `TreeEngine::get_sibling_ids()`

### 2.4 JS 端集成（按模块隔离）
- [ ] `wasm/loader.ts`: WASM 模块加载（独立模块，不依赖业务逻辑）
- [ ] `wasm/bridge/id-converter.ts`: ID 类型转换（独立模块）
- [ ] `wasm/bridge/data-mapper.ts`: 数据格式映射（独立模块）
- [ ] `wasm/bridge/data-mapper.ts`: 实现数据映射（ID → 完整数据）
- [ ] `wasm/bridge/data-mapper.ts`: 实现可见节点合并（精简信息 + 完整数据）
- [ ] `wasm/engine/interface.ts`: 创建 `ITreeEngine` 接口（统一接口）
- [ ] `wasm/engine/js-engine.ts`: 创建 `JsTreeEngine` 类（封装现有 JS 实现）
- [ ] `wasm/engine/wasm-engine.ts`: 创建 `WasmTreeEngine` 类（WASM 实现）
- [ ] `wasm/index.ts`: 统一导出（只导出公共 API）
- [ ] 确保各模块职责单一，依赖关系清晰

### 2.5 Prop 和组件集成
- [ ] 在 `VirtualTreeProps` 中添加 `useWasm?: boolean` prop
- [ ] 默认值设为 `false`（保持向后兼容）
- [ ] 添加 WASM 可用性检测函数
- [ ] 实现引擎工厂函数（根据 prop 选择引擎）
- [ ] 实现自动降级逻辑

### 2.6 Composables 集成
- [ ] 修改 `useTreeData.ts` 支持双模式
- [ ] 根据 `useWasm` prop 选择引擎
- [ ] 统一引擎接口调用
- [ ] 保持现有 API 完全兼容
- [ ] 测试 JS 模式和 WASM 模式切换

### 2.6 测试和优化
- [ ] 功能完整性测试
- [ ] 性能对比测试（JS vs WASM）
- [ ] 大数据量测试（100K - 1M 节点）
- [ ] 边界情况测试
- [ ] 错误处理测试

---

## Phase 3: 方案 B - 共享内存优化

### 3.1 内存布局设计
- [ ] 定义 `NodeData` 结构（`#[repr(C)]`）
- [ ] 设计线性内存布局
- [ ] 实现 `TreeMemory` 结构
- [ ] 实现内存预分配策略

### 3.2 共享内存实现
- [ ] 实现 `TreeEngine::get_memory_ptr()`
- [ ] 实现 `TreeEngine::get_memory_size()`
- [ ] 实现 `TreeEngine::get_visible_indices()` - 返回 TypedArray
- [ ] 导出 WebAssembly.Memory

### 3.3 JS 端零拷贝访问
- [ ] 创建 `SharedMemoryTreeEngine` 类
- [ ] 实现直接内存读取（DataView/TypedArray）
- [ ] 实现 `readNodeData()` - 零拷贝读取
- [ ] 实现 `getVisibleNodesBatch()` - 批量读取
- [ ] 优化内存访问模式

### 3.4 增量更新机制
- [ ] 实现 `TreeEngine::calculate_diff()` - 差异计算
- [ ] 定义 `VisibleNodesDiff` 结构
- [ ] 实现 JS 端增量应用
- [ ] 优化更新性能

### 3.5 性能优化
- [ ] 并行扁平化（使用 rayon）
- [ ] 内存池优化
- [ ] 批量操作优化
- [ ] 缓存策略优化

### 3.6 测试
- [ ] 零拷贝性能测试
- [ ] 内存泄漏测试
- [ ] 并发安全测试
- [ ] 超大数据量测试（> 1M 节点）

---

## Phase 4: 优化和文档

### 4.1 性能调优
- [ ] 分析性能瓶颈
- [ ] 优化热点代码
- [ ] 内存使用优化
- [ ] 序列化优化

### 4.2 错误处理和日志
- [ ] 完善错误处理
- [ ] 添加日志输出
- [ ] 提供调试模式
- [ ] 性能指标收集

### 4.3 文档完善
- [ ] API 文档
- [ ] 使用示例
- [ ] 性能基准测试报告
- [ ] 迁移指南

### 4.4 最终测试
- [ ] 完整功能测试
- [ ] 性能回归测试
- [ ] 兼容性测试
- [ ] 压力测试

---

## 当前进度

**当前阶段**: Phase 1 - 方案 A 基础实现  
**完成度**: 0%  
**下一步**: 更新 Cargo.toml 添加依赖

---

## 备注

- 每个任务完成后请更新此清单
- 遇到问题及时记录在 IMPLEMENTATION.md 中
- 性能测试结果记录在性能报告中

