mod utils;

use serde::Serialize;
use tsify_next::Tsify;
use wasm_bindgen::prelude::*;

/// 树节点数据结构
#[derive(Serialize, Clone, Tsify)]
#[tsify(into_wasm_abi)]
pub struct TreeNodeData {
    pub id: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<TreeNodeData>>,
}

/// 生成结果
#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct GenerateTreeDataResult {
    pub data: Vec<TreeNodeData>,
    pub total_count: u32,
}

/// 生成选项
#[wasm_bindgen]
pub struct GenerateOptions {
    root_count: u32,
    child_count: u32,
    grand_child_count: u32,
}

#[wasm_bindgen]
impl GenerateOptions {
    #[wasm_bindgen(constructor)]
    pub fn new(root_count: u32, child_count: u32, grand_child_count: u32) -> GenerateOptions {
        GenerateOptions {
            root_count: if root_count == 0 { 5000 } else { root_count },
            child_count: if child_count == 0 { 5 } else { child_count },
            grand_child_count: if grand_child_count == 0 { 5 } else { grand_child_count },
        }
    }
}

/// 生成虚拟树数据（同步版本，高性能）
#[wasm_bindgen(js_name = generateVirtualTreeData)]
pub fn generate_virtual_tree_data(options: &GenerateOptions) -> GenerateTreeDataResult {
    utils::set_panic_hook();

    let root_count = options.root_count;
    let child_count = options.child_count;
    let grand_child_count = options.grand_child_count;

    // 预分配容量，减少内存分配次数
    let mut data: Vec<TreeNodeData> = Vec::with_capacity(root_count as usize);
    let mut total_count: u32 = 0;

    for i in 1..=root_count {
        // 生成孙节点和子节点
        let mut children: Vec<TreeNodeData> = Vec::with_capacity(child_count as usize);

        for j in 1..=child_count {
            let mut grandchildren: Vec<TreeNodeData> = Vec::with_capacity(grand_child_count as usize);

            for k in 1..=grand_child_count {
                grandchildren.push(TreeNodeData {
                    id: format!("node-{}-{}-{}", i, j, k),
                    label: format!("节点 {}-{}-{}", i, j, k),
                    children: None,
                });
                total_count += 1;
            }

            children.push(TreeNodeData {
                id: format!("node-{}-{}", i, j),
                label: format!("节点 {}-{}", i, j),
                children: if grandchildren.is_empty() {
                    None
                } else {
                    Some(grandchildren)
                },
            });
            total_count += 1;
        }

        data.push(TreeNodeData {
            id: format!("node-{}", i),
            label: format!("节点 {}", i),
            children: if children.is_empty() {
                None
            } else {
                Some(children)
            },
        });
        total_count += 1;
    }

    GenerateTreeDataResult { data, total_count }
}

/// 快速生成（使用默认参数）
#[wasm_bindgen(js_name = generateTreeDataFast)]
pub fn generate_tree_data_fast(root_count: u32) -> GenerateTreeDataResult {
    let options = GenerateOptions::new(root_count, 5, 5);
    generate_virtual_tree_data(&options)
}
