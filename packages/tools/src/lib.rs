mod utils;
mod types;
mod tree;

use wasm_bindgen::prelude::*;

// 导出所有树操作函数
pub use tree::*;

// 初始化函数，设置 panic hook
#[wasm_bindgen]
pub fn init() {
    utils::set_panic_hook();
}
