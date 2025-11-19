use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_wasm_bindgen;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use wasm_bindgen::prelude::*;

use crate::types::{FlatTreeNode, TreeNodeData, TreePropsConfig};

static TREE_STORE: Lazy<Mutex<Option<TreeStore>>> = Lazy::new(|| Mutex::new(None));

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct InitOptions {
    default_expand_all: Option<bool>,
    default_expanded_keys: Option<Vec<Value>>,
    default_checked_keys: Option<Vec<Value>>,
    check_strictly: Option<bool>,
}

#[derive(Clone, Debug)]
struct NodeEntry {
    id_value: Value,
    id_str: String,
    data: Value,
    parent: Option<usize>,
    children: Vec<usize>,
    level: u32,
    index: u32,
    is_expanded: bool,
    is_visible: bool,
    is_checked: bool,
    is_indeterminate: bool,
    is_disabled: bool,
    is_loading: bool,
    is_loaded: bool,
    is_leaf: bool,
    matches_filter: bool,
}

#[derive(Default)]
struct TreeStore {
    props: TreePropsConfig,
    nodes: Vec<NodeEntry>,
    id_to_index: HashMap<String, usize>,
    visible_indices: Vec<usize>,
    checked_keys: HashSet<String>,
    half_checked_keys: HashSet<String>,
    check_strictly: bool,
    next_index: u32,
    filter_text: Option<String>,
}

impl TreeStore {
    fn new(
        data: Vec<TreeNodeData>,
        props: TreePropsConfig,
        options: InitOptions,
    ) -> Result<Self, JsValue> {
        let mut store = TreeStore {
            props,
            nodes: Vec::new(),
            id_to_index: HashMap::new(),
            visible_indices: Vec::new(),
            checked_keys: HashSet::new(),
            half_checked_keys: HashSet::new(),
            check_strictly: options.check_strictly.unwrap_or(false),
            next_index: 0,
            filter_text: None,
        };

        let expanded_keys = values_to_set(options.default_expanded_keys.unwrap_or_default());
        let checked_keys = values_to_set(options.default_checked_keys.unwrap_or_default());
        let default_expand_all = options.default_expand_all.unwrap_or(false);

        store.build_nodes(
            &data,
            None,
            0,
            default_expand_all,
            &expanded_keys,
            &checked_keys,
        )?;

        store.refresh_selection_sets();
        store.rebuild_visibility();
        Ok(store)
    }

    fn id_key(&self) -> &str {
        self.props.id.as_deref().unwrap_or("id")
    }

    fn children_key(&self) -> &str {
        self.props.children.as_deref().unwrap_or("children")
    }

    fn label_key(&self) -> &str {
        self.props.label.as_deref().unwrap_or("label")
    }

    fn disabled_key(&self) -> &str {
        self.props.disabled.as_deref().unwrap_or("disabled")
    }

    fn is_leaf_key(&self) -> Option<&str> {
        self.props.is_leaf.as_deref()
    }

    fn build_nodes(
        &mut self,
        source: &[TreeNodeData],
        parent_idx: Option<usize>,
        level: u32,
        default_expand_all: bool,
        expanded_keys: &HashSet<String>,
        checked_keys: &HashSet<String>,
    ) -> Result<Vec<usize>, JsValue> {
        let mut indices = Vec::new();

        for node in source {
            let (id_value, id_str) = extract_node_id(&node.data, self.id_key())?;
            let children = extract_children(node, self.children_key());
            let is_leaf = self
                .is_leaf_key()
                .and_then(|key| node.data.get(key))
                .and_then(|v| v.as_bool())
                .unwrap_or_else(|| children.is_empty());
            let is_expanded = default_expand_all || expanded_keys.contains(&id_str);
            let is_checked = checked_keys.contains(&id_str);
            let is_disabled = node
                .data
                .get(self.disabled_key())
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            let parent_visible = match parent_idx {
                Some(parent) => {
                    let parent_entry = &self.nodes[parent];
                    parent_entry.is_visible && parent_entry.is_expanded
                }
                None => true,
            };

            let idx = self.nodes.len();
            let entry = NodeEntry {
                id_value: id_value.clone(),
                id_str: id_str.clone(),
                data: node.data.clone(),
                parent: parent_idx,
                children: Vec::new(),
                level,
                index: self.next_index,
                is_expanded,
                is_visible: parent_visible,
                is_checked,
                is_indeterminate: false,
                is_disabled,
                is_loading: false,
                is_loaded: !children.is_empty(),
                is_leaf,
                matches_filter: false,
            };
            self.next_index += 1;
            self.id_to_index.insert(id_str.clone(), idx);
            self.nodes.push(entry);

            let child_indices = self.build_nodes(
                &children,
                Some(idx),
                level + 1,
                default_expand_all,
                expanded_keys,
                checked_keys,
            )?;
            self.nodes[idx].children = child_indices;
            indices.push(idx);
        }

        Ok(indices)
    }

    fn rebuild_visibility(&mut self) {
        self.visible_indices.clear();

        if let Some(filter) = self.filter_text.clone() {
            if filter.trim().is_empty() {
                self.filter_text = None;
                self.rebuild_visibility();
                return;
            }
            self.apply_filter_visibility(&filter.to_lowercase());
            return;
        }

        let roots: Vec<usize> = self
            .nodes
            .iter()
            .enumerate()
            .filter(|(_, node)| node.parent.is_none())
            .map(|(idx, _)| idx)
            .collect();

        for idx in roots {
            self.update_visibility_recursive(idx, true);
        }
    }

    fn update_visibility_recursive(&mut self, idx: usize, ancestors_visible: bool) {
        let node_visible = ancestors_visible;
        self.nodes[idx].is_visible = node_visible;
        if node_visible {
            self.visible_indices.push(idx);
        }
        let child_visible = node_visible && self.nodes[idx].is_expanded;
        let children = self.nodes[idx].children.clone();
        for child_idx in children {
            self.update_visibility_recursive(child_idx, child_visible);
        }
    }

    fn apply_filter_visibility(&mut self, filter_lower: &str) {
        for node in &mut self.nodes {
            node.matches_filter = false;
            node.is_visible = false;
        }

        let mut matched_indices = Vec::new();
        for (idx, node) in self.nodes.iter().enumerate() {
            if let Some(label) = node
                .data
                .get(self.label_key())
                .and_then(|v| v.as_str())
            {
                if label.to_lowercase().contains(filter_lower) {
                    matched_indices.push(idx);
                }
            }
        }

        for idx in matched_indices {
            self.mark_match(idx);
        }

        self.visible_indices = self
            .nodes
            .iter()
            .enumerate()
            .filter_map(|(idx, node)| if node.is_visible { Some(idx) } else { None })
            .collect();
    }

    fn mark_match(&mut self, idx: usize) {
        self.nodes[idx].matches_filter = true;
        self.expand_ancestors(idx);
        self.mark_descendants_visible(idx);
    }

    fn expand_ancestors(&mut self, mut idx: usize) {
        loop {
            self.nodes[idx].is_visible = true;
            self.nodes[idx].is_expanded = true;
            if let Some(parent) = self.nodes[idx].parent {
                idx = parent;
            } else {
                break;
            }
        }
    }

    fn mark_descendants_visible(&mut self, idx: usize) {
        let children = self.nodes[idx].children.clone();
        for child in children {
            self.nodes[child].is_visible = true;
            self.mark_descendants_visible(child);
        }
    }

    fn require_index(&self, id: &str) -> Result<usize, JsValue> {
        self.id_to_index
            .get(id)
            .copied()
            .ok_or_else(|| JsValue::from_str("Node not found"))
    }

    fn toggle_checked(&mut self, idx: usize) {
        let new_state = !self.nodes[idx].is_checked;
        self.set_checked_state(idx, new_state);
    }

    fn set_checked_state(&mut self, idx: usize, checked: bool) {
        if self.check_strictly {
            self.nodes[idx].is_checked = checked;
            self.nodes[idx].is_indeterminate = false;
        } else {
            self.set_descendants_checked(idx, checked);
            self.update_parent_state(idx);
        }
        self.refresh_selection_sets();
    }

    fn set_descendants_checked(&mut self, idx: usize, checked: bool) {
        self.nodes[idx].is_checked = checked;
        self.nodes[idx].is_indeterminate = false;
        let children = self.nodes[idx].children.clone();
        for child in children {
            self.set_descendants_checked(child, checked);
        }
    }

    fn update_parent_state(&mut self, idx: usize) {
        let mut current = self.nodes[idx].parent;

        while let Some(parent_idx) = current {
            let child_indices = self.nodes[parent_idx].children.clone();
            let total = child_indices.len();
            let mut checked_count = 0usize;
            let mut has_indeterminate_child = false;

            for child_idx in &child_indices {
                if self.nodes[*child_idx].is_indeterminate {
                    has_indeterminate_child = true;
                }
                if self.nodes[*child_idx].is_checked {
                    checked_count += 1;
                }
            }

            {
                let parent_node = &mut self.nodes[parent_idx];
                if checked_count == total && !has_indeterminate_child && total > 0 {
                    parent_node.is_checked = true;
                    parent_node.is_indeterminate = false;
                } else if checked_count == 0 && !has_indeterminate_child {
                    parent_node.is_checked = false;
                    parent_node.is_indeterminate = false;
                } else {
                    parent_node.is_checked = false;
                    parent_node.is_indeterminate = true;
                }
                current = parent_node.parent;
            }
        }
    }

    fn refresh_selection_sets(&mut self) {
        self.checked_keys.clear();
        self.half_checked_keys.clear();

        for node in &self.nodes {
            if node.is_checked {
                self.checked_keys.insert(node.id_str.clone());
            } else if node.is_indeterminate {
                self.half_checked_keys.insert(node.id_str.clone());
            }
        }
    }

    fn collect_checked_keys(&self, leaf_only: bool, include_half: bool) -> Vec<Value> {
        self.nodes
            .iter()
            .filter(|node| {
                if include_half && node.is_indeterminate {
                    return true;
                }
                if !node.is_checked {
                    return false;
                }
                if leaf_only {
                    node.is_leaf
                } else {
                    true
                }
            })
            .map(|node| node.id_value.clone())
            .collect()
    }

    fn collect_checked_nodes(
        &self,
        leaf_only: bool,
        include_half: bool,
    ) -> Vec<Value> {
        self.nodes
            .iter()
            .filter(|node| {
                if include_half && node.is_indeterminate {
                    return true;
                }
                if !node.is_checked {
                    return false;
                }
                if leaf_only {
                    node.is_leaf
                } else {
                    true
                }
            })
            .map(|node| node.data.clone())
            .collect()
    }

    fn set_checked_keys(&mut self, keys: Vec<Value>, leaf_only: bool) -> Result<(), JsValue> {
        for node in &mut self.nodes {
            node.is_checked = false;
            node.is_indeterminate = false;
        }

        if self.check_strictly {
            for key in keys {
                let key_str = value_to_key(&key)?;
                if let Some(idx) = self.id_to_index.get(&key_str).copied() {
                    if leaf_only && !self.nodes[idx].is_leaf {
                        continue;
                    }
                    self.nodes[idx].is_checked = true;
                }
            }
        } else {
            for key in keys {
                let key_str = value_to_key(&key)?;
                if let Some(idx) = self.id_to_index.get(&key_str).copied() {
                    if leaf_only && !self.nodes[idx].is_leaf {
                        continue;
                    }
                    self.set_descendants_checked(idx, true);
                    self.update_parent_state(idx);
                }
            }
        }

        self.refresh_selection_sets();
        Ok(())
    }

    fn set_filter(&mut self, filter: Option<String>) {
        self.filter_text = filter;
        self.rebuild_visibility();
    }

    fn visible_flat_nodes(&self) -> Vec<FlatTreeNode> {
        self.visible_indices
            .iter()
            .map(|idx| self.to_flat_node(*idx, false))
            .collect()
    }

    fn get_flat_node(&self, idx: usize, include_children: bool) -> FlatTreeNode {
        self.to_flat_node(idx, include_children)
    }

    fn to_flat_node(&self, idx: usize, include_children: bool) -> FlatTreeNode {
        let node = &self.nodes[idx];
        let children = if include_children && !node.children.is_empty() {
            Some(
                node.children
                    .iter()
                    .map(|child_idx| self.to_flat_node(*child_idx, true))
                    .collect(),
            )
        } else {
            None
        };

        let raw_children = if node.children.is_empty() {
            None
        } else {
            Some(
                node.children
                    .iter()
                    .map(|child_idx| self.nodes[*child_idx].data.clone())
                    .collect(),
            )
        };

        FlatTreeNode {
            id: node.id_value.clone(),
            data: node.data.clone(),
            level: node.level,
            index: node.index,
            parent_id: node
                .parent
                .map(|parent_idx| self.nodes[parent_idx].id_value.clone()),
            is_expanded: node.is_expanded,
            is_visible: node.is_visible,
            is_checked: Some(node.is_checked),
            is_indeterminate: Some(node.is_indeterminate),
            is_disabled: Some(node.is_disabled),
            is_loading: Some(node.is_loading),
            is_loaded: Some(node.is_loaded),
            is_leaf: Some(node.is_leaf),
            children,
            raw_children,
        }
    }

    fn visible_children(&self, idx: usize) -> Vec<FlatTreeNode> {
        self.nodes[idx]
            .children
            .iter()
            .filter(|child_idx| self.nodes[**child_idx].is_visible)
            .map(|child_idx| self.to_flat_node(*child_idx, false))
            .collect()
    }

    fn visible_siblings(&self, idx: usize) -> Vec<FlatTreeNode> {
        if let Some(parent_idx) = self.nodes[idx].parent {
            self.nodes[parent_idx]
                .children
                .iter()
                .filter(|child_idx| **child_idx != idx)
                .filter(|child_idx| self.nodes[**child_idx].is_visible)
                .map(|child_idx| self.to_flat_node(*child_idx, false))
                .collect()
        } else {
            self.nodes
                .iter()
                .enumerate()
                .filter(|(node_idx, node)| node.parent.is_none() && *node_idx != idx && node.is_visible)
                .map(|(node_idx, _)| self.to_flat_node(node_idx, false))
                .collect()
        }
    }

    fn visible_descendants(&self, idx: usize) -> Vec<FlatTreeNode> {
        let mut result = Vec::new();
        self.collect_descendants(idx, &mut result);
        result
    }

    fn collect_descendants(&self, idx: usize, acc: &mut Vec<FlatTreeNode>) {
        let children = self.nodes[idx]
            .children
            .iter()
            .filter(|child_idx| self.nodes[**child_idx].is_visible)
            .cloned()
            .collect::<Vec<_>>();

        for child in children {
            acc.push(self.to_flat_node(child, false));
            self.collect_descendants(child, acc);
        }
    }

    fn ancestor_chain(&self, idx: usize) -> Vec<FlatTreeNode> {
        let mut result = Vec::new();
        let mut current = self.nodes[idx].parent;
        while let Some(parent_idx) = current {
            result.push(self.to_flat_node(parent_idx, false));
            current = self.nodes[parent_idx].parent;
        }
        result
    }

    fn collect_roots(&self) -> Vec<usize> {
        self.nodes
            .iter()
            .enumerate()
            .filter(|(_, node)| node.parent.is_none())
            .map(|(idx, _)| idx)
            .collect()
    }

    fn update_node_expanded(&mut self, idx: usize, expanded: bool) {
        self.nodes[idx].is_expanded = expanded;
        self.rebuild_visibility();
    }

    fn update_nodes_with_data(
        &mut self,
        data: Vec<TreeNodeData>,
        options: InitOptions,
    ) -> Result<(), JsValue> {
        let props = self.props.clone();
        let new_store = TreeStore::new(data, props, options)?;
        *self = new_store;
        Ok(())
    }
}

fn with_store_mut<T, F>(f: F) -> Result<T, JsValue>
where
    F: FnOnce(&mut TreeStore) -> Result<T, JsValue>,
{
    let mut guard = TREE_STORE
        .lock()
        .map_err(|_| JsValue::from_str("Tree store lock poisoned"))?;
    let store = guard
        .as_mut()
        .ok_or_else(|| JsValue::from_str("Tree store is not initialized"))?;
    f(store)
}

fn with_store<T, F>(f: F) -> Result<T, JsValue>
where
    F: FnOnce(&TreeStore) -> Result<T, JsValue>,
{
    let guard = TREE_STORE
        .lock()
        .map_err(|_| JsValue::from_str("Tree store lock poisoned"))?;
    let store = guard
        .as_ref()
        .ok_or_else(|| JsValue::from_str("Tree store is not initialized"))?;
    f(store)
}

fn extract_node_id(data: &Value, key: &str) -> Result<(Value, String), JsValue> {
    if let Some(value) = data.get(key) {
        let id_str = value_to_key(value)?;
        Ok((value.clone(), id_str))
    } else {
        Err(JsValue::from_str("Node id is missing"))
    }
}

fn extract_children(node: &TreeNodeData, key: &str) -> Vec<TreeNodeData> {
    node.data
        .get(key)
        .and_then(|value| serde_json::from_value::<Vec<TreeNodeData>>(value.clone()).ok())
        .unwrap_or_default()
}

fn value_to_key(value: &Value) -> Result<String, JsValue> {
    match value {
        Value::String(s) => Ok(s.clone()),
        Value::Number(n) => Ok(n.to_string()),
        _ => Err(JsValue::from_str("Unsupported node id type")),
    }
}

fn js_value_to_key(value: JsValue) -> Result<(Value, String), JsValue> {
    let raw: Value = serde_wasm_bindgen::from_value(value)?;
    let key = value_to_key(&raw)?;
    Ok((raw, key))
}

fn values_to_set(values: Vec<Value>) -> HashSet<String> {
    values
        .iter()
        .filter_map(|value| value_to_key(value).ok())
        .collect()
}

fn to_js_value<T>(value: &T) -> Result<JsValue, JsValue>
where
    T: Serialize,
{
    serde_wasm_bindgen::to_value(value).map_err(|err| JsValue::from_str(&err.to_string()))
}

#[wasm_bindgen]
pub fn init_tree(data: JsValue, props: JsValue, options: JsValue) -> Result<(), JsValue> {
    let data: Vec<TreeNodeData> = serde_wasm_bindgen::from_value(data)?;
    let props: TreePropsConfig = serde_wasm_bindgen::from_value(props)?;
    let options: InitOptions = serde_wasm_bindgen::from_value(options)?;

    let store = TreeStore::new(data, props, options)?;
    let mut guard = TREE_STORE
        .lock()
        .map_err(|_| JsValue::from_str("Tree store lock poisoned"))?;
    *guard = Some(store);
    Ok(())
}

#[wasm_bindgen]
pub fn rebuild_tree(data: JsValue, options: JsValue) -> Result<(), JsValue> {
    let data: Vec<TreeNodeData> = serde_wasm_bindgen::from_value(data)?;
    let options: InitOptions = serde_wasm_bindgen::from_value(options)?;

    with_store_mut(|store| store.update_nodes_with_data(data, options))
}

#[wasm_bindgen]
pub fn get_visible_nodes() -> Result<JsValue, JsValue> {
    with_store(|store| to_js_value(&store.visible_flat_nodes()))
}

#[wasm_bindgen]
pub fn set_node_expanded(node_id: JsValue, expanded: bool) -> Result<(), JsValue> {
    let (_, key) = js_value_to_key(node_id)?;
    with_store_mut(|store| {
        let idx = store.require_index(&key)?;
        store.update_node_expanded(idx, expanded);
        Ok(())
    })
}

#[wasm_bindgen]
pub fn toggle_node_checked(node_id: JsValue) -> Result<(), JsValue> {
    let (_, key) = js_value_to_key(node_id)?;
    with_store_mut(|store| {
        let idx = store.require_index(&key)?;
        store.toggle_checked(idx);
        Ok(())
    })
}

#[wasm_bindgen]
pub fn set_node_checked(node_id: JsValue, checked: bool) -> Result<(), JsValue> {
    let (_, key) = js_value_to_key(node_id)?;
    with_store_mut(|store| {
        let idx = store.require_index(&key)?;
        store.set_checked_state(idx, checked);
        Ok(())
    })
}

#[wasm_bindgen]
pub fn get_selection_state() -> Result<JsValue, JsValue> {
    with_store(|store| {
        let checked: Vec<Value> = store
            .checked_keys
            .iter()
            .filter_map(|key| store.id_to_index.get(key).copied())
            .map(|idx| store.nodes[idx].id_value.clone())
            .collect();

        let half_checked: Vec<Value> = store
            .half_checked_keys
            .iter()
            .filter_map(|key| store.id_to_index.get(key).copied())
            .map(|idx| store.nodes[idx].id_value.clone())
            .collect();

        let payload = serde_json::json!({
            "checkedKeys": checked,
            "halfCheckedKeys": half_checked
        });

        to_js_value(&payload)
    })
}

#[wasm_bindgen]
pub fn get_checked_keys(leaf_only: Option<bool>) -> Result<JsValue, JsValue> {
    let leaf_only = leaf_only.unwrap_or(false);
    with_store(|store| to_js_value(&store.collect_checked_keys(leaf_only, false)))
}

#[wasm_bindgen]
pub fn get_checked_nodes(
    leaf_only: Option<bool>,
    include_half_checked: Option<bool>,
) -> Result<JsValue, JsValue> {
    let leaf_only = leaf_only.unwrap_or(false);
    let include_half = include_half_checked.unwrap_or(false);
    with_store(|store| {
        let nodes = store.collect_checked_nodes(leaf_only, include_half);
        to_js_value(&nodes)
    })
}

#[wasm_bindgen]
pub fn set_checked_keys(keys: JsValue, leaf_only: Option<bool>) -> Result<(), JsValue> {
    let keys: Vec<Value> = serde_wasm_bindgen::from_value(keys)?;
    let leaf_only = leaf_only.unwrap_or(false);
    with_store_mut(|store| store.set_checked_keys(keys, leaf_only))
}

#[wasm_bindgen]
pub fn filter_nodes(filter_value: Option<String>) -> Result<(), JsValue> {
    with_store_mut(|store| {
        store.set_filter(filter_value);
        Ok(())
    })
}

#[wasm_bindgen]
pub fn clear_filter() -> Result<(), JsValue> {
    with_store_mut(|store| {
        store.set_filter(None);
        Ok(())
    })
}

#[wasm_bindgen]
pub fn get_node_data(node_id: JsValue) -> Result<JsValue, JsValue> {
    let (_, key) = js_value_to_key(node_id)?;
    with_store(|store| {
        let idx = store.require_index(&key)?;
        to_js_value(&store.nodes[idx].data)
    })
}

#[wasm_bindgen]
pub fn get_flat_node(node_id: JsValue) -> Result<JsValue, JsValue> {
    let (_, key) = js_value_to_key(node_id)?;
    with_store(|store| {
        let idx = store.require_index(&key)?;
        to_js_value(&store.get_flat_node(idx, true))
    })
}

#[wasm_bindgen]
pub fn get_visible_children(node_id: JsValue) -> Result<JsValue, JsValue> {
    let (_, key) = js_value_to_key(node_id)?;
    with_store(|store| {
        let idx = store.require_index(&key)?;
        to_js_value(&store.visible_children(idx))
    })
}

#[wasm_bindgen]
pub fn get_visible_siblings(node_id: JsValue) -> Result<JsValue, JsValue> {
    let (_, key) = js_value_to_key(node_id)?;
    with_store(|store| {
        let idx = store.require_index(&key)?;
        to_js_value(&store.visible_siblings(idx))
    })
}

#[wasm_bindgen]
pub fn get_visible_descendants(node_id: JsValue) -> Result<JsValue, JsValue> {
    let (_, key) = js_value_to_key(node_id)?;
    with_store(|store| {
        let idx = store.require_index(&key)?;
        to_js_value(&store.visible_descendants(idx))
    })
}

#[wasm_bindgen]
pub fn get_parent_chain(node_id: JsValue) -> Result<JsValue, JsValue> {
    let (_, key) = js_value_to_key(node_id)?;
    with_store(|store| {
        let idx = store.require_index(&key)?;
        to_js_value(&store.ancestor_chain(idx))
    })
}