# Vue Virtual Tree - WebAssembly 优化方案

## 概述

本文档描述了将 `@vue-virtual-tree` 包中耗时的数据搜索和过滤操作替换为 Rust WebAssembly 实现的方案。通过使用 WebAssembly，可以在大数据量场景下显著提升性能。

## 优化目标

1. **性能提升**：在大数据量（>1000 节点）场景下，提升搜索、过滤、遍历操作的性能
2. **保持兼容性**：保持现有 TypeScript API 不变，仅替换底层实现
3. **渐进式迁移**：可以逐步替换，不影响现有功能

## 数据结构约定

所有 Rust 结构体的属性命名与 TypeScript 保持一致：

### 类型映射规则

1. **结构体字段命名**：
   - Rust 中使用 `snake_case` 字段名（如 `parent_id`, `is_visible`）
   - 通过 `#[serde(rename_all = "camelCase")]` 自动序列化为 TypeScript 的 `camelCase` 格式（如 `parentId`, `isVisible`）
   - 确保与 TypeScript 接口完全兼容

2. **类型对应关系**：
   - `TreeNodeData`: TypeScript 中是索引签名 `[key: string]: any`，Rust 中使用 `serde_json::Value` 配合 `#[serde(flatten)]`
   - `TreePropsConfig`: 所有字段都是可选的，使用 `Option<T>`，并通过 `#[serde(rename_all = "camelCase")]` 确保 `is_leaf` → `isLeaf`
   - `FlatTreeNode`: 所有字段与 TypeScript 接口一一对应，`id` 和 `parentId` 使用 `serde_json::Value` 以支持 `string | number` 类型
   - **注意**：`FlatTreeNode` 中不包含 `parentNode` 字段（已移除），通过 `parentId` 和 `flatNodeMap` 查找父节点，避免循环引用

3. **特殊类型处理**：
   - `string | number` 类型在 Rust 中使用 `serde_json::Value` 表示
   - `string | number | null` 使用 `Option<serde_json::Value>`
   - 可选字段使用 `Option<T>` 并配合 `#[serde(skip_serializing_if = "Option::is_none")]`

## 可优化的函数列表

### 优先级 1：高频且耗时的操作

#### 1.1 树节点搜索 - `findNodeByKey`

**位置**: `packages/vue-virtual-tree/src/utils/tree.ts`

**TS 代码**:
```typescript
export function findNodeByKey(
  nodes: TreeNodeData[],
  key: string | number,
  props: TreePropsConfig = {}
): TreeNodeData | null {
  return findNode(nodes, (node) => getNodeId(node, props) === key, props)
}

export function findNode(
  nodes: TreeNodeData[],
  predicate: (node: TreeNodeData) => boolean,
  props: TreePropsConfig = {}
): TreeNodeData | null {
  for (const node of nodes) {
    if (predicate(node)) {
      return node
    }
    const children = getNodeChildren(node, props)
    if (children.length > 0) {
      const found = findNode(children, predicate, props)
      if (found) return found
    }
  }
  return null
}
```

**Rust 实现方案**:
```rust
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct TreeNodeData {
    #[serde(flatten)]
    pub data: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TreePropsConfig {
    pub id: Option<String>,
    pub children: Option<String>,
    pub label: Option<String>,
    pub disabled: Option<String>,
    pub is_leaf: Option<String>, // 序列化为 isLeaf
}

#[wasm_bindgen]
pub fn find_node_by_key(
    nodes: &JsValue,
    key: &str,
    props: &JsValue,
) -> Result<JsValue, JsValue> {
    // 反序列化输入
    let nodes: Vec<TreeNodeData> = serde_wasm_bindgen::from_value(nodes.clone())?;
    let props: TreePropsConfig = serde_wasm_bindgen::from_value(props.clone())?;
    
    // 递归查找
    fn find_recursive(
        nodes: &[TreeNodeData],
        key: &str,
        props: &TreePropsConfig,
    ) -> Option<&TreeNodeData> {
        let id_key = props.id.as_deref().unwrap_or("id");
        
        for node in nodes {
            // 获取节点 ID
            if let Some(node_id) = node.data.get(id_key) {
                let node_id_str = match node_id {
                    serde_json::Value::String(s) => s.as_str(),
                    serde_json::Value::Number(n) => n.to_string().as_str(),
                    _ => continue,
                };
                
                if node_id_str == key {
                    return Some(node);
                }
            }
            
            // 递归查找子节点
            let children_key = props.children.as_deref().unwrap_or("children");
            if let Some(children) = node.data.get(children_key) {
                if let Ok(children) = serde_json::from_value::<Vec<TreeNodeData>>(children.clone()) {
                    if let Some(found) = find_recursive(&children, key, props) {
                        return Some(found);
                    }
                }
            }
        }
        None
    }
    
    match find_recursive(&nodes, key, &props) {
        Some(node) => Ok(serde_wasm_bindgen::to_value(node)?),
        None => Ok(JsValue::NULL),
    }
}
```

**性能收益**: 
- 大数据量（>5000 节点）时，性能提升 2-5 倍
- 减少 JavaScript 递归调用开销

---

#### 1.2 扁平化树形数据 - `flattenTree`

**位置**: `packages/vue-virtual-tree/src/composables/useTreeData.ts`

**TS 代码**:
```typescript
const flattenTree = (
  nodes: TreeNodeData[],
  level: number = 0,
  parentNode: FlatTreeNode | null = null,
  startIndex: number = 0,
  visible: boolean = true,
  config?: TreePropsConfig
): { nodes: FlatTreeNode[], flatNodes: FlatTreeNode[], nodeMap: Map<string | number, FlatTreeNode> } => {
  const map = new Map<string | number, FlatTreeNode>()
  function genenrateFlatNodes(
    nodes: TreeNodeData[],
    level: number = 0,
    parentNode: FlatTreeNode | null = null,
    startIndex: number = 0,
    visible: boolean = true,
    container: FlatTreeNode[] = [],
    config?: TreePropsConfig
  ) {
    const result: FlatTreeNode[] = [];
    let length = nodes.length;
    for (let i = 0; i < length; i++) {
      let index = startIndex + i;
      const node: TreeNodeData = nodes[i]
      const id = getNodeId(node, config)
      const children = getNodeChildren(node, config)
      const isExpanded = expandedKeys.value.has(id)
      const isLeaf = isLeafNode(node, config)
      
      const flatNode: FlatTreeNode = {
        id,
        data: node,
        level,
        parentId: parentNode?.id || null,
        index,
        isExpanded,
        isVisible: visible,
        isDisabled: isNodeDisabled(node, config),
        isLeaf: isLeaf,
        isLoading: false,
        isLoaded: false,
        isChecked: false,
        rawChildren: children.length > 0 ? children : undefined
      }
      result.push(flatNode);
      container.push(flatNode);
      
      // 如果节点展开且有子节点，递归处理子节点
      if (children.length > 0) {
        const childNodes = genenrateFlatNodes(
          children, 
          level + 1, 
          flatNode, 
          index, 
          isExpanded && visible, 
          container, 
          config
        )
        flatNode.children = childNodes
      }
      map.set(id, flatNode);
    }
    return result
  }
  
  const container: FlatTreeNode[] = [];
  const result = genenrateFlatNodes(nodes, level, parentNode, startIndex, visible, container, config)
  return { nodes: result, flatNodes: container, nodeMap: map };
}
```

**Rust 实现方案**:
```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FlatTreeNode {
    pub id: serde_json::Value, // string | number
    pub data: serde_json::Value, // TreeNodeData
    pub level: u32,
    pub index: u32,
    pub parent_id: Option<serde_json::Value>, // string | number | null (序列化为 parentId)
    pub is_expanded: bool, // 序列化为 isExpanded
    pub is_visible: bool, // 序列化为 isVisible
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_checked: Option<bool>, // 序列化为 isChecked
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_indeterminate: Option<bool>, // 序列化为 isIndeterminate
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_disabled: Option<bool>, // 序列化为 isDisabled
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_loading: Option<bool>, // 序列化为 isLoading
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_loaded: Option<bool>, // 序列化为 isLoaded
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_leaf: Option<bool>, // 序列化为 isLeaf
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FlatTreeNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_children: Option<Vec<serde_json::Value>>, // TreeNodeData[] (序列化为 rawChildren)
    // 注意：已移除 parentNode 字段，避免循环引用，通过 parentId 和 nodeMap 查找父节点
}

#[wasm_bindgen]
pub fn flatten_tree(
    nodes: &JsValue,
    level: u32,
    parent_id: Option<String>,
    start_index: u32,
    visible: bool,
    expanded_keys: &JsValue,
    config: &JsValue,
) -> Result<JsValue, JsValue> {
    let nodes: Vec<TreeNodeData> = serde_wasm_bindgen::from_value(nodes.clone())?;
    let expanded_keys: std::collections::HashSet<String> = 
        serde_wasm_bindgen::from_value(expanded_keys.clone())?;
    let config: TreePropsConfig = serde_wasm_bindgen::from_value(config.clone())?;
    
    let mut container = Vec::new();
    let mut current_index = start_index;
    
    fn generate_flat_nodes(
        nodes: &[TreeNodeData],
        level: u32,
        parent_id: Option<&String>,
        start_index: &mut u32,
        visible: bool,
        expanded_keys: &std::collections::HashSet<String>,
        config: &TreePropsConfig,
        container: &mut Vec<FlatTreeNode>,
    ) -> Vec<FlatTreeNode> {
        let mut result = Vec::new();
        let id_key = config.id.as_deref().unwrap_or("id");
        let children_key = config.children.as_deref().unwrap_or("children");
        
        for node in nodes {
            let index = *start_index;
            *start_index += 1;
            
            // 获取节点 ID
            let id = node.data.get(id_key)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            
            // 获取子节点
            let children = node.data.get(children_key)
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| serde_json::from_value::<TreeNodeData>(v.clone()).ok())
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            
            let is_expanded = expanded_keys.contains(&id);
            let is_leaf = children.is_empty();
            
            let flat_node = FlatTreeNode {
                id: serde_json::Value::String(id.clone()),
                data: node.data.clone(),
                level,
                parent_id: parent_id.map(|pid| serde_json::Value::String(pid.clone())),
                index,
                is_expanded,
                is_visible: visible,
                is_checked: Some(false),
                is_indeterminate: None,
                is_disabled: Some(false), // 需要从 config 获取
                is_loading: Some(false),
                is_loaded: Some(false),
                is_leaf: Some(is_leaf),
                children: None, // 将在递归后设置
                raw_children: if children.is_empty() { 
                    None 
                } else { 
                    Some(children.iter().map(|c| c.data.clone()).collect()) 
                },
            };
            
            result.push(flat_node.clone());
            container.push(flat_node.clone());
            
            // 递归处理子节点
            if !children.is_empty() {
                let child_nodes = generate_flat_nodes(
                    &children,
                    level + 1,
                    Some(&id),
                    start_index,
                    is_expanded && visible,
                    expanded_keys,
                    config,
                    container,
                );
                // 注意：这里需要更新 result 中最后一个节点的 children
                // 但由于 FlatTreeNode 是值类型，需要重新构建
            }
        }
        
        result
    }
    
    let nodes_result = generate_flat_nodes(
        &nodes,
        level,
        parent_id.as_ref(),
        &mut current_index,
        visible,
        &expanded_keys,
        &config,
        &mut container,
    );
    
    // 构建节点映射
    let mut node_map: std::collections::HashMap<String, FlatTreeNode> = 
        std::collections::HashMap::new();
    for node in &container {
        let id_str = match &node.id {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Number(n) => n.to_string(),
            _ => continue,
        };
        node_map.insert(id_str, node.clone());
    }
    
    let result = serde_json::json!({
        "nodes": nodes_result,
        "flatNodes": container,
        "nodeMap": node_map
    });
    
    Ok(serde_wasm_bindgen::to_value(&result)?)
}
```

**性能收益**:
- 大数据量（>10000 节点）时，性能提升 3-8 倍
- 减少内存分配和 GC 压力

---

#### 1.3 树节点过滤 - `filter`

**位置**: `packages/vue-virtual-tree/src/composables/useTreeFilter.ts`

**TS 代码**:
```typescript
const filter = (value: string) => {
  if (!value) {
    flatTree.value.forEach(node => {
      node.isVisible = true
    })
    return Promise.resolve()
  }
  return new Promise(async (resolve) => {
    const filterMethod = props.filterNodeMethod || defaultFilterMethod
    
    flatTree.value.forEach(node => {
      node.isVisible = false
      if (filterMethod(value, node.data)) {
        node.isVisible = true
        
        // 标记所有父节点为可见并展开（使用 flatNodeMap 查找）
        let parentId: string | number | null = node.parentId
        while (parentId) {
          const parentNode = flatNodeMap.value.get(parentId)
          if (parentNode) {
            parentNode.isVisible = true
            parentNode.isExpanded = true
            expandedKeys.value.add(parentNode.id)
            parentId = parentNode.parentId
          } else {
            parentId = null
          }
        }
      }
    })
    resolve(void 0)
  })
}

const defaultFilterMethod = (value: string, data: any): boolean => {
  if (!value) return true
  const label = getNodeLabel(data, props.props)
  return label.toLowerCase().includes(value.toLowerCase())
}
```

**Rust 实现方案**:
```rust
#[wasm_bindgen]
pub fn filter_tree_nodes(
    flat_tree: &JsValue,
    flat_node_map: &JsValue,
    filter_value: &str,
    label_key: Option<String>,
    expanded_keys: &JsValue,
) -> Result<JsValue, JsValue> {
    let mut nodes: Vec<FlatTreeNode> = serde_wasm_bindgen::from_value(flat_tree.clone())?;
    let mut node_map: std::collections::HashMap<String, FlatTreeNode> = 
        serde_wasm_bindgen::from_value(flat_node_map.clone())?;
    let mut expanded_keys_set: std::collections::HashSet<String> = 
        serde_wasm_bindgen::from_value(expanded_keys.clone())?;
    let label_key = label_key.unwrap_or_else(|| "label".to_string());
    let filter_lower = filter_value.to_lowercase();
    
    if filter_value.is_empty() {
        // 清空过滤，恢复所有节点可见
        for node in &mut nodes {
            node.is_visible = true;
        }
        // 同时更新 node_map
        for node in &mut node_map.values_mut() {
            node.is_visible = true;
        }
        return Ok(serde_wasm_bindgen::to_value(&nodes)?);
    }
    
    // 第一步：标记匹配的节点
    let mut matched_node_ids = std::collections::HashSet::new();
    for node in &mut nodes {
        // 获取节点 ID 字符串
        let node_id_str = match &node.id {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Number(n) => n.to_string(),
            _ => continue,
        };
        
        // 获取节点标签
        if let Some(label) = node.data.get(&label_key)
            .and_then(|v| v.as_str())
        {
            if label.to_lowercase().contains(&filter_lower) {
                matched_node_ids.insert(node_id_str.clone());
                node.is_visible = true;
                
                // 更新 node_map
                if let Some(map_node) = node_map.get_mut(&node_id_str) {
                    map_node.is_visible = true;
                }
            } else {
                node.is_visible = false;
                if let Some(map_node) = node_map.get_mut(&node_id_str) {
                    map_node.is_visible = false;
                }
            }
        } else {
            node.is_visible = false;
            if let Some(map_node) = node_map.get_mut(&node_id_str) {
                map_node.is_visible = false;
            }
        }
    }
    
    // 第二步：标记所有匹配节点的父节点为可见并展开
    for matched_id in &matched_node_ids {
        let mut current_id: Option<String> = Some(matched_id.clone());
        
        while let Some(id) = current_id {
            // 从 node_map 获取当前节点
            if let Some(node) = node_map.get(&id) {
                // 获取父节点 ID
                if let Some(parent_id) = &node.parent_id {
                    let parent_id_str = match parent_id {
                        serde_json::Value::String(s) => s.clone(),
                        serde_json::Value::Number(n) => n.to_string(),
                        _ => break,
                    };
                    
                    // 更新父节点
                    if let Some(parent_node) = node_map.get_mut(&parent_id_str) {
                        parent_node.is_visible = true;
                        parent_node.is_expanded = true;
                        expanded_keys_set.insert(parent_id_str.clone());
                        
                        // 同时更新 nodes 数组中的父节点
                        if let Some(parent_in_array) = nodes.iter_mut()
                            .find(|n| {
                                match &n.id {
                                    serde_json::Value::String(s) => s == &parent_id_str,
                                    serde_json::Value::Number(n) => n.to_string() == parent_id_str,
                                    _ => false,
                                }
                            }) {
                            parent_in_array.is_visible = true;
                            parent_in_array.is_expanded = true;
                        }
                        
                        current_id = Some(parent_id_str);
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            } else {
                break;
            }
        }
    }
    
    Ok(serde_wasm_bindgen::to_value(&nodes)?)
}
```

**性能收益**:
- 大数据量过滤时，性能提升 2-4 倍
- 减少字符串操作开销

---

### 优先级 2：中频但可优化的操作

#### 2.1 获取所有节点 Key - `getAllKeys`

**位置**: `packages/vue-virtual-tree/src/utils/tree.ts`

**TS 代码**:
```typescript
export function getAllKeys(nodes: TreeNodeData[], props: TreePropsConfig = {}): (string | number)[] {
  const keys: (string | number)[] = []
  traverseTree(nodes, (node) => {
    keys.push(getNodeId(node, props))
  }, null, props)
  return keys
}
```

**Rust 实现方案**:
```rust
#[wasm_bindgen]
pub fn get_all_keys(
    nodes: &JsValue,
    id_key: Option<String>,
    children_key: Option<String>,
) -> Result<JsValue, JsValue> {
    let nodes: Vec<TreeNodeData> = serde_wasm_bindgen::from_value(nodes.clone())?;
    let id_key = id_key.unwrap_or_else(|| "id".to_string());
    let children_key = children_key.unwrap_or_else(|| "children".to_string());
    
    let mut keys = Vec::new();
    
    fn collect_keys(
        nodes: &[TreeNodeData],
        id_key: &str,
        children_key: &str,
        keys: &mut Vec<String>,
    ) {
        for node in nodes {
            if let Some(id) = node.data.get(id_key) {
                if let Some(id_str) = id.as_str() {
                    keys.push(id_str.to_string());
                } else if let Some(id_num) = id.as_u64() {
                    keys.push(id_num.to_string());
                }
            }
            
            if let Some(children) = node.data.get(children_key) {
                if let Ok(children) = serde_json::from_value::<Vec<TreeNodeData>>(children.clone()) {
                    collect_keys(&children, id_key, children_key, keys);
                }
            }
        }
    }
    
    collect_keys(&nodes, &id_key, &children_key, &mut keys);
    Ok(serde_wasm_bindgen::to_value(&keys)?)
}
```

---

#### 2.2 获取所有子节点 Key - `getAllChildrenKeys`

**位置**: `packages/vue-virtual-tree/src/composables/useTreeSelection.ts`

**TS 代码**:
```typescript
const getAllChildrenKeys = (nodeId: string | number): (string | number)[] => {
  const keys: (string | number)[] = []
  const nodeData = getNodeData(nodeId)
  if (!nodeData) return keys
  
  const traverse = (data: TreeNodeData) => {
    const children = getNodeChildren(data, props.props)
    children.forEach(child => {
      const childId = getNodeId(child, props.props)
      keys.push(childId)
      traverse(child)
    })
  }
  
  traverse(nodeData)
  return keys
}
```

**Rust 实现方案**:
```rust
#[wasm_bindgen]
pub fn get_all_children_keys(
    node_data: &JsValue,
    id_key: Option<String>,
    children_key: Option<String>,
) -> Result<JsValue, JsValue> {
    let node: TreeNodeData = serde_wasm_bindgen::from_value(node_data.clone())?;
    let id_key = id_key.unwrap_or_else(|| "id".to_string());
    let children_key = children_key.unwrap_or_else(|| "children".to_string());
    
    let mut keys = Vec::new();
    
    fn traverse(
        node: &TreeNodeData,
        id_key: &str,
        children_key: &str,
        keys: &mut Vec<String>,
    ) {
        if let Some(children) = node.data.get(children_key) {
            if let Ok(children) = serde_json::from_value::<Vec<TreeNodeData>>(children.clone()) {
                for child in &children {
                    if let Some(id) = child.data.get(id_key) {
                        if let Some(id_str) = id.as_str() {
                            keys.push(id_str.to_string());
                        } else if let Some(id_num) = id.as_u64() {
                            keys.push(id_num.to_string());
                        }
                    }
                    traverse(child, id_key, children_key, keys);
                }
            }
        }
    }
    
    traverse(&node, &id_key, &children_key, &mut keys);
    Ok(serde_wasm_bindgen::to_value(&keys)?)
}
```

---

#### 2.3 更新半选状态 - `updateHalfCheckedKeys`

**位置**: `packages/vue-virtual-tree/src/composables/useTreeSelection.ts`

**TS 代码**:
```typescript
const updateHalfCheckedKeys = () => {
  halfCheckedKeys.value.clear()
  const allKeys = new Set(flatTree.value.map(n => n.id))
  
  for (const key of allKeys) {
    const childrenKeys = getAllChildrenKeys(key)
    if (childrenKeys.length === 0) continue
    
    const checkedChildren = childrenKeys.filter(k => checkedKeys.value.has(k))
    if (checkedChildren.length > 0 && checkedChildren.length < childrenKeys.length) {
      halfCheckedKeys.value.add(key)
    }
  }
}
```

**Rust 实现方案**:
```rust
#[wasm_bindgen]
pub fn update_half_checked_keys(
    flat_tree: &JsValue,
    checked_keys: &JsValue,
    node_data_map: &JsValue, // 节点 ID 到节点数据的映射
) -> Result<JsValue, JsValue> {
    let nodes: Vec<FlatTreeNode> = serde_wasm_bindgen::from_value(flat_tree.clone())?;
    let checked_keys: std::collections::HashSet<String> = 
        serde_wasm_bindgen::from_value(checked_keys.clone())?;
    let node_data_map: std::collections::HashMap<String, TreeNodeData> = 
        serde_wasm_bindgen::from_value(node_data_map.clone())?;
    
    let mut half_checked_keys = std::collections::HashSet::new();
    
    // 为每个节点计算半选状态
    for node in &nodes {
        // 将 node.id (serde_json::Value) 转换为 String 用于查找
        let node_id_str = match &node.id {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Number(n) => n.to_string(),
            _ => continue,
        };
        
        // 获取所有子节点 keys（需要从原始数据获取）
        if let Some(node_data) = node_data_map.get(&node_id_str) {
            let children_keys = get_all_children_keys_internal(node_data, &node_data_map);
            
            if !children_keys.is_empty() {
                let checked_count = children_keys.iter()
                    .filter(|k| checked_keys.contains(*k))
                    .count();
                
                if checked_count > 0 && checked_count < children_keys.len() {
                    half_checked_keys.insert(node_id_str);
                }
            }
        }
    }
    
    Ok(serde_wasm_bindgen::to_value(&half_checked_keys)?)
}
```

---

### 优先级 3：低频但可优化的操作

#### 3.1 获取叶子节点 Key - `getLeafKeys`

**位置**: `packages/vue-virtual-tree/src/utils/tree.ts`

**TS 代码**:
```typescript
export function getLeafKeys(nodes: TreeNodeData[], props: TreePropsConfig = {}): (string | number)[] {
  const keys: (string | number)[] = []
  traverseTree(nodes, (node) => {
    if (isLeafNode(node, props)) {
      keys.push(getNodeId(node, props))
    }
  }, null, props)
  return keys
}
```

**Rust 实现方案**:
```rust
#[wasm_bindgen]
pub fn get_leaf_keys(
    nodes: &JsValue,
    id_key: Option<String>,
    children_key: Option<String>,
    is_leaf_key: Option<String>,
) -> Result<JsValue, JsValue> {
    let nodes: Vec<TreeNodeData> = serde_wasm_bindgen::from_value(nodes.clone())?;
    let id_key = id_key.unwrap_or_else(|| "id".to_string());
    let children_key = children_key.unwrap_or_else(|| "children".to_string());
    
    let mut keys = Vec::new();
    
    fn collect_leaf_keys(
        nodes: &[TreeNodeData],
        id_key: &str,
        children_key: &str,
        keys: &mut Vec<String>,
    ) {
        for node in nodes {
            let children = node.data.get(children_key)
                .and_then(|v| v.as_array())
                .map(|arr| arr.len())
                .unwrap_or(0);
            
            let is_leaf = children == 0;
            
            if is_leaf {
                if let Some(id) = node.data.get(id_key) {
                    if let Some(id_str) = id.as_str() {
                        keys.push(id_str.to_string());
                    } else if let Some(id_num) = id.as_u64() {
                        keys.push(id_num.to_string());
                    }
                }
            } else {
                if let Ok(children) = serde_json::from_value::<Vec<TreeNodeData>>(
                    node.data.get(children_key).unwrap().clone()
                ) {
                    collect_leaf_keys(&children, id_key, children_key, keys);
                }
            }
        }
    }
    
    collect_leaf_keys(&nodes, &id_key, &children_key, &mut keys);
    Ok(serde_wasm_bindgen::to_value(&keys)?)
}
```

---

#### 3.2 计算可见节点列表 - `getVisibleNodes`

**位置**: `packages/vue-virtual-tree/src/composables/useTreeData.ts`（`syncVisibleNodes`）

**现状（TS 调用代码）**:
```ts
const syncVisibleNodes = () => {
  if (!wasm) return
  const nodes = wasm.get_visible_nodes() as FlatTreeNode[]
  visibleNodes.value = applyUiState(nodes)
}
```

**Rust 方案**（TreeStore 内部状态）:
```rust
#[wasm_bindgen]
pub fn get_visible_nodes() -> Result<JsValue, JsValue> {
    with_store(|store| to_js_value(&store.visible_flat_nodes()))
}
```

**说明**:
- `TreeStore` 在 Wasm 侧维护 `visible_indices`，任何展开/折叠/过滤操作都会原子更新该列表；
- JS 层只需读取 `get_visible_nodes()` 的结果并补齐 UI 状态（loading / loaded），不再携带 `flatTree`；
- `visible_flat_nodes()` 直接复用扁平化缓存，避免了 JS↔Wasm 间的大数组复制。

**性能收益**:
- 每次滚动或过滤只需要一次 Wasm -> JS 拷贝，JS 不再进行 `Array.filter`；
- 展开/折叠只在 Wasm 中递归，主线程的 GC 压力显著降低；
- 可见节点列表与 TreeStore 共享索引映射，事件委托/查找直接调用 `get_flat_node` 即可。

---

## 实现计划

### 阶段 1：基础框架搭建（1-2 天）

1. 更新 `Cargo.toml` 依赖
   - 添加 `serde`, `serde-wasm-bindgen`, `serde_json`
   - 更新 `wasm-bindgen` 到最新版本

2. 定义数据结构
   - 创建与 TypeScript 类型对应的 Rust 结构体
   - 实现序列化/反序列化

3. 设置构建脚本
   - 配置 `wasm-pack` 构建
   - 设置 TypeScript 类型定义生成

### 阶段 2：核心函数实现（3-5 天）

按优先级实现函数：

1. **优先级 1**（必须实现）:
   - `find_node_by_key`
   - `flatten_tree`
   - `filter_tree_nodes`

2. **优先级 2**（建议实现）:
   - `get_all_keys`
   - `get_all_children_keys`
   - `update_half_checked_keys`

3. **优先级 3**（可选实现）:
   - `get_leaf_keys`
   - `get_visible_nodes`

### 阶段 3：集成与测试（2-3 天）

1. 在 TypeScript 中创建 WebAssembly 包装层
2. 实现渐进式降级（WASM 不可用时回退到 TS）
3. 编写性能测试和单元测试
4. 基准测试对比

### 阶段 4：优化与文档（1-2 天）

1. 性能优化
2. 代码文档
3. 使用示例

---

## 技术考虑

### 数据序列化

- **方案**: 使用 `serde` + `serde-wasm-bindgen` 进行 JSON 序列化
- **开销**: 序列化/反序列化有一定开销，但计算密集型操作仍能获得收益
- **优化**: 对于频繁调用的函数，考虑使用更高效的序列化格式（如 MessagePack）

### 内存管理

- WebAssembly 内存与 JavaScript 内存分离
- 注意避免频繁的数据拷贝
- 考虑使用 `SharedArrayBuffer`（需要 HTTPS）

### 错误处理

- Rust panic 会转换为 JavaScript 错误
- 使用 `Result<T, JsValue>` 进行错误处理
- 提供友好的错误信息

### 兼容性

- 需要支持现代浏览器（支持 WebAssembly）
- 提供降级方案（WASM 加载失败时使用 TS 实现）

---

## 预期性能提升

基于初步分析，预期性能提升如下：

| 操作 | 数据量 | 预期提升 |
|------|--------|----------|
| `findNodeByKey` | 5000 节点 | 2-3x |
| `flattenTree` | 10000 节点 | 3-5x |
| `filter` | 5000 节点 | 2-4x |
| `getAllKeys` | 10000 节点 | 2-3x |
| `updateHalfCheckedKeys` | 5000 节点 | 2-3x |

**注意**: 实际性能提升取决于：
- 数据结构和复杂度
- 浏览器和硬件性能
- 序列化开销

---

## 风险评估

### 高风险

1. **序列化开销**: 大量数据序列化可能抵消性能收益
   - **缓解**: 优化数据结构，减少序列化数据量

2. **浏览器兼容性**: 需要 WebAssembly 支持
   - **缓解**: 提供降级方案

### 中风险

1. **开发复杂度**: Rust + WebAssembly 开发周期较长
   - **缓解**: 分阶段实现，优先实现收益最大的函数

2. **维护成本**: 需要维护两套代码（TS + Rust）
   - **缓解**: 完善的测试覆盖，清晰的文档

---

## 下一步行动

1. **确认方案**: 请确认此方案是否符合预期
2. **优先级调整**: 如有需要，可调整函数实现优先级
3. **开始实现**: 确认后开始阶段 1 的实现

---

## 参考资料

- [wasm-bindgen 文档](https://rustwasm.github.io/wasm-bindgen/)
- [serde-wasm-bindgen](https://github.com/cloudflare/serde-wasm-bindgen)
- [WebAssembly 性能最佳实践](https://web.dev/webassembly/)

