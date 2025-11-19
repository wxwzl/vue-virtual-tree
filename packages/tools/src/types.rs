use serde::{Deserialize, Serialize};

/// 树节点数据（原始数据）
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TreeNodeData {
    #[serde(flatten)]
    pub data: serde_json::Value,
}

/// 树属性配置
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct TreePropsConfig {
    pub id: Option<String>,
    pub children: Option<String>,
    pub label: Option<String>,
    pub disabled: Option<String>,
    #[serde(rename = "isLeaf")]
    pub is_leaf: Option<String>, // 序列化为 isLeaf
}

/// 扁平化树节点
#[derive(Serialize, Deserialize, Clone, Debug)]
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

