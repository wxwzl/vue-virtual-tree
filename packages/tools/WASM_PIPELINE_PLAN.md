# WebAssembly 全量管线重构方案

本文档描述如何将 `@vue-virtual-tree` 的数据处理逻辑整体迁移到 WebAssembly 侧，实现“完整的 wasm 数据管线”。目标是让 JS 端只专注于 UI 渲染与事件转发，所有数据状态和重计算都在 wasm 内部完成，从而降低序列化开销并提升整体性能、可维护性。

---

## 总体目标

1. **管线化**：在 wasm 中维护完整的树形数据结构（扁平化列表、索引、状态），所有计算（展开/收起、选中/半选、过滤、可见节点生成）都在 wasm 内进行，避免频繁跨边界传输大对象。
2. **最小化 JS↔WASM 交互**：JS 侧只在必要时调用少量接口，如初始化、请求可见片段、触发操作（展开/选择/过滤/增删节点）。
3. **保持现有 API**：从外部使用 `VirtualTree` 的方式不变，内部逻辑透明迁移。若有需要，可以提供同步/异步接口保证兼容性。

---

## 实施步骤

### 1. 数据管理与 API 设计

1. **在 `packages/tools/src` 中新增 `tree_store` 模块**：
   - 定义 `TreeStore` 结构，包含：
     - 原始数据（或引用）
     - 扁平化后的 `Vec<FlatNode>`（包含 id、level、parent、children、状态标记等）
     - `HashMap<Id, Index>` 索引
     - 状态集合（已展开、已选中、半选、可见列表、过滤关键字等）
   - 提供内部方法：`recompute_visible()`, `toggle_expand()`, `set_checked()`, `apply_filter()`, `insert_children()`, `remove_node()` 等。

2. **用全局单例管理 store**：
   - 使用 `once_cell::sync::Lazy<Mutex<Option<TreeStore>>>` 或类似模式，确保 wasm 端可跨调用复用状态。

3. **设计导出接口**（示例）：
   - `init_tree(data: JsValue, props: JsValue, stateOptions: JsValue)`：初始化 store。
   - `get_visible_nodes(start: u32, limit: u32) -> JsValue`：返回可见区间的节点数组。
   - `get_node(id: JsValue) -> JsValue`、`get_checked_keys()`, `get_half_checked_keys()`。
   - `toggle_node(id: JsValue)`, `set_node_checked(id: JsValue, checked: bool, strict: bool)`。
   - `apply_filter(keyword: String)`。
   - 后续可扩展 `insert_nodes`, `remove_node`, `update_node` 等。

4. **数据返回格式**：
   - 初期可直接返回 `Vec<FlatTreeNode>` 的序列化结果，与现有 TS 类型兼容。
   - 长期可考虑仅返回轻量化结构（例如 { id, level, flags, label }），并通过额外接口按需获取 `data`，减少重复传输。

### 2. JS/TS 层桥接

1. **替换 `wasmUtils`**：
   - 仅保留 `loadToolsWasm()` 与 `isToolsWasmLoaded()`，负责拉起 wasm 模块并缓存导出的 API。
   - 不再在 JS 内部对 `flatTree` 做处理；JS 调用的都是如 `treeService.initTree`, `treeService.getVisibleNodes` 等高层封装。

2. **新增 `treeService`（或 `treeBridge`）**：
   - 封装对 wasm API 的调用，提供 Promise/async 接口。
   - 管理内部缓存（如上一次的可见节点数据、当前选中键列表等），并把 wasm 返回的数据转换成 `FlatTreeNode[]`、`Set<string|number>` 等前端可直接使用的形式。
   - 提供事件机制或简单的 `refresh()` 方法，供 `useTreeData` 在操作后重新拉取可见节点/状态。

3. **调整 `useTreeData`**：
   - 初始化时：`await treeService.initTree(props.data, props.props, { defaultExpandAll, defaultCheckedKeys, ... })`，随后 `visibleNodes`、`checkedKeys` 等从 service 获取。
   - `expandNode / collapseNode / toggleNode`：调用对应的 service 方法，然后刷新 `visibleNodes`.
   - `setCheckedNodes / setCheckedKeys / updateHalfCheckedKeys`：全部改为调用 service，实现 + 拉取最新状态。
   - `filter`：改为调用 `treeService.applyFilter(keyword)`，内部链路负责更新可见列表。
   - `getNodeData`: 通过 service 的 `getNode(id)` 获取最新数据。

4. **组件层改造**：
   - `VirtualTree.vue` 中的 `regenerateFlatTree`、`expandNode` 等函数改为等待 Promise（因为内部会调用异步 service）。
   - 确保事件 handler 支持 async/await，并在操作后刷新 `visibleNodes`.

### 3. 状态同步与增量更新

1. **Lazy Load / Append / Remove**：
   - 先在 wasm 里实现 `insert_children(parent_id, children)`、`remove_node(id)` 两个基础接口。
   - JS 调用 `props.load` 后，将新的子节点数组传入 `treeService.insertChildren(parentId, children)`，内部负责更新 store 并返回最新的可见列表。

2. **外部更新数据时**：
   - 在 `useTreeData` 中监听 `props.data` 变化后，选择合适策略：
     - 简单方案：对比数据后直接重新调用 `init_tree`（可能重新构建整棵树）。
     - 进阶方案：提供 `replace_tree(newData)`，让 wasm 自己做差分更新。

3. **性能监控**：
   - 在 wasm 侧记录操作耗时（可在 debug 模式下通过 `console_log` 输出），方便对比重构前后的性能差异。
   - 若需要，可暴露 `get_stats()` 返回节点数、visible 数、最近一次操作耗时等，供前端调试面板展示。

### 4. 分阶段实施路线

1. **阶段 A：基础状态迁移**
   - 实现 `TreeStore`、`init_tree`、`get_visible_nodes`、`toggle_node`, `set_node_checked`, `apply_filter`.
   - JS 侧保留原有逻辑，但在 `useTreeData` 中提供一个可选开关（例如 `useWasmPipeline`），用来验证新管线输出是否正确。

2. **阶段 B：全面切换**
   - 删除 `useTreeSelection`, `useTreeExpand`, `useTreeFilter` 中的状态逻辑，全部由 `treeService` 驱动。
   - `useTreeData` 只负责订阅 wasm 输出 -> 转为 `ref`，与 `VirtualTree` 像之前一样。

3. **阶段 C：进阶优化**
   - 优化 wasm 输出格式、减少序列化。
   - 实现增量更新、持久化（如保存/恢复必要状态）。
   - 针对拖拽或其他高级操作扩展 API。

### 5. 风险与注意事项

- **大范围重构**：要先保障单元测试/集成测试覆盖关键路径，避免 UI 行为回退。
- **加载与错误处理**：`treeService` 初始化失败时（如 wasm 加载异常）要能 fallback 至 JS 实现，或给出清晰的错误提示。
- **类型同步**：TS 定义需与 wasm 返回结构一致，必要时在 `packages/vue-virtual-tree/src/types` 中新增 `VisibleNode` 等类型。
- **构建流程**：确保 `npm run build:tools` 产物更新，且 `package.json`/tsconfig/vite.config 的 alias/路径设置与新结构匹配。
- **调试与文档**：更新 README / docs，说明如何启用 wasm 管线、如何扩展 `TreeStore` API，以及常见问题处理方式。

---

后续编码步骤将以本方案为参考，分阶段提交。请在确认无误后告知，我再根据本计划执行具体实现。`

