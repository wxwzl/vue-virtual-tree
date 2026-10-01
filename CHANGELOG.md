# [1.0.0](https://github.com/wxwzl/vue-virtual-tree/compare/0.3.1...1.0.0) (2026-10-01)

### Bug Fixes

- **virtual-list:** 隐藏测量通道在节点数少于采样数时报 duplicate keys ([6099f72](https://github.com/wxwzl/vue-virtual-tree/commit/6099f72ca91ea6948c57e306f40b9d0856337269))
- **virtual-list:** vapor 编译下禁用手写 h() 通道，修复滚动后几何持续漂移 ([12294ca](https://github.com/wxwzl/vue-virtual-tree/commit/12294ca51a6602a2d40f4f8ca2828872a55c409b))

### Features

- **playground:** 接入 vaporInteropPlugin，新增 Vapor vs Vdom 基准对比页 ([cfb9ec0](https://github.com/wxwzl/vue-virtual-tree/commit/cfb9ec032eda998a1611cf46948966dce4a0646d))
- **playground:** 头部显示 tree/list/vue 版本徽章 ([4416b7e](https://github.com/wxwzl/vue-virtual-tree/commit/4416b7e37eb88201e13063d2c07a7045fc2cef60))
- **tree:** 新增 opt-in Vapor 子路径 @wxwzl/vue-virtual-tree/vapor ([fd857d0](https://github.com/wxwzl/vue-virtual-tree/commit/fd857d03220d3dcbb78cf49bf39e6ecddcca75ff))
- **tree:** TreeNode/TreeNodeItem 双模单源支持 Vapor 编译 ([9f83288](https://github.com/wxwzl/vue-virtual-tree/commit/9f83288bf93583c872d5d2bbd85424e55d6cbaa6))
- **tree:** vapor 子路径升级为整链 vapor 编译 ([8671b33](https://github.com/wxwzl/vue-virtual-tree/commit/8671b33255d0d6575010acef04ce5e90c3edba96))

## [0.3.1](https://github.com/wxwzl/vue-virtual-tree/compare/0.2.1...0.3.1) (2026-09-27)

### Bug Fixes

- **playground:** 修复拖拽放置同父下移时落点偏前一位 ([923fff5](https://github.com/wxwzl/vue-virtual-tree/commit/923fff573a7c0cecd483db8f09d36d5411af6d01))
- **tree-selection:** 默认选中的父节点按 Element Plus 语义级联勾选后代 ([8b7d962](https://github.com/wxwzl/vue-virtual-tree/commit/8b7d962c4ea0c6a96fd82694999d898779616814))
- **virtual-list:** 冻结渲染总跨度消除滚动条漂移，修复初始渲染行数不足 ([8e38990](https://github.com/wxwzl/vue-virtual-tree/commit/8e38990e2afa296f1f115c1605ea01f31184f1b0))
- **virtual-list:** 固定模式快速滚动时视口底边露空白带 ([d5519fb](https://github.com/wxwzl/vue-virtual-tree/commit/d5519fb450f8ad752b2ac94ece45bd00cb30c86c))
- **virtual-list:** 近底吸附，修复拖拽滚动条到底后够不到末行 ([6638758](https://github.com/wxwzl/vue-virtual-tree/commit/6638758f8a570fbd0bcf2b58957566d0363c559d))
- **virtual-list:** 快速滚动期间抑制锚定补偿，修复拖拽滚动条不跟手 ([882ac2c](https://github.com/wxwzl/vue-virtual-tree/commit/882ac2c01caf7798206d430441321fcc36bbac4a))
- **virtual-list:** 消除贴底后的内容闪烁与吸附振荡 ([893ff23](https://github.com/wxwzl/vue-virtual-tree/commit/893ff238331b28e2c14cb2fcb18951fec041b9e7))
- **virtual-list:** 修复 vue-tsc 类型检查报错 ([75b1710](https://github.com/wxwzl/vue-virtual-tree/commit/75b171015722bd4d56e8086b52b99ff55b398854))

### Features

- **playground:** 基准对比页两侧压测改为独立按钮 ([300088a](https://github.com/wxwzl/vue-virtual-tree/commit/300088a286d7832ae84637f15bf66e342aee8882))
- **virtual-list:** 新增自研 spacer 流式虚拟列表 ([8e28905](https://github.com/wxwzl/vue-virtual-tree/commit/8e289053854f261678052e3f02f502c6e1802579))
- **virtual-list:** 隐藏预测量通道 + 自适应均值高度缓存 ([2186909](https://github.com/wxwzl/vue-virtual-tree/commit/21869091a6bb996a9c59823a4405c1143a2468e1))
- **virtual-list:** 支持动态行高（实测回写 + 滚动锚定） ([9aef40f](https://github.com/wxwzl/vue-virtual-tree/commit/9aef40f174a6f103f7a9b05b77bf621fd1c70d3a))

### Performance Improvements

- **expand:** 移除 visibleIndex 缓存与 batchToggleNodes 死代码 ([52af3ed](https://github.com/wxwzl/vue-virtual-tree/commit/52af3eda72dae68d58f6ed6fb6c41da7e17f8c60))
- **expand:** visibleNodes 重建改为单次预分配+一遍拷贝，降低分配与 GC 压力 ([083bb63](https://github.com/wxwzl/vue-virtual-tree/commit/083bb634634470cbdbd7e96c8f6a7db2dff51d7c))
- **playground:** 修复切换到基准对比页整页卡死 12s ([8ba731c](https://github.com/wxwzl/vue-virtual-tree/commit/8ba731c4ce8523953813e9b47d303ec6a3c34120))
- **tree-filter:** 消除大树过滤时的主线程卡死 ([d92711a](https://github.com/wxwzl/vue-virtual-tree/commit/d92711a4c963697e855a92e7ec1eb8e5cee9bfde))
- **virtual-list:** 消除动态行高滚动卡顿（7 项滚动关键路径减负） ([59d4efc](https://github.com/wxwzl/vue-virtual-tree/commit/59d4efc776f5fdfbbffc7c434b0b1c41be1f6c4f))
- **virtual-list:** 行池化 + 冻结总高 + 锚定补偿替代 scrollTop 回写 ([e3efab7](https://github.com/wxwzl/vue-virtual-tree/commit/e3efab7ee499a8f83a88183188392d2f418314a6))
- **virtual-tree:** 动态模式换用自研 VirtualList，消除百万节点展开/收起卡顿 ([23f90dc](https://github.com/wxwzl/vue-virtual-tree/commit/23f90dc37b8d890208d617c6d674387144cdc64b))

## [0.2.1](https://github.com/wxwzl/vue-virtual-tree/compare/0.1.13...0.2.1) (2026-09-06)

### Bug Fixes

- 手风琴效果 ([aa37550](https://github.com/wxwzl/vue-virtual-tree/commit/aa375501f9af18a68ca0e8363e3e3bc7131a8a30))

### Features

- **scroller:** 新增 fixedHeight 固定行高模式，解决快速滚动白屏 ([ae74b46](https://github.com/wxwzl/vue-virtual-tree/commit/ae74b4692d0a7b7a51a26b943a49d5f5e0b4ab7f))

### Performance Improvements

- **expand:** 重新优化 useTreeExpand 数组操作与递归 ([ce86085](https://github.com/wxwzl/vue-virtual-tree/commit/ce860850db87a4a7804b9e70735d55c38a3ad399))
- **init:** 大数据量初始化性能优化，新增节点级 replace 方法 ([ea7c903](https://github.com/wxwzl/vue-virtual-tree/commit/ea7c90367bae47a5ef8b1da383805b72b1b55cbe))
- **selection:** 优化 O(n²) 选择算法为 O(h) 复杂度 ([6447cf8](https://github.com/wxwzl/vue-virtual-tree/commit/6447cf857b8f1f3c2b1cc514bd3bd6d599f35f6e))

## [0.1.13](https://github.com/wxwzl/vue-virtual-tree/compare/0.1.12...0.1.13) (2026-03-12)

### Bug Fixes

- 懒加载插入节点不应该存在异步更新 ([98d9eb9](https://github.com/wxwzl/vue-virtual-tree/commit/98d9eb9e5c3483ec88c15d699c65ec53e3e306e4))

### Features

- 提升vue-virtual-scroller依赖版本和增加vue-virtual-scroller 属性传递 ([f7ed087](https://github.com/wxwzl/vue-virtual-tree/commit/f7ed0879bcdc19c2d7b0c690c597a22262ad86d9))

## [0.1.12](https://github.com/wxwzl/vue-virtual-tree/compare/0.1.7...0.1.12) (2025-11-24)

### Bug Fixes

- 修复默认选中 ([9c3a595](https://github.com/wxwzl/vue-virtual-tree/commit/9c3a59553099b63cf4c533aeee2b040dff04836f))
- scrollToNode ([e5a3b79](https://github.com/wxwzl/vue-virtual-tree/commit/e5a3b79f02d3f3fb5ab8aa34effbc0b237dc3521))

### Features

- 增加当前选中节点标记 ([5c8bcc7](https://github.com/wxwzl/vue-virtual-tree/commit/5c8bcc786532117b825cddabc4e727d4fd9e97dd))
- 增加滚动到指定节点 ([da11aa5](https://github.com/wxwzl/vue-virtual-tree/commit/da11aa5c8d6a0952a77090686130c4f8f402fe3d))

### Performance Improvements

- 优化过滤功能和复选框性能 ([2082ba9](https://github.com/wxwzl/vue-virtual-tree/commit/2082ba96d26774aa282c8277d5cf9e7990215122))
- 优化性能 ([6c3f6a8](https://github.com/wxwzl/vue-virtual-tree/commit/6c3f6a86fa1fb1cbfc697e71f5d914b6f7356b9b))

## [0.1.7](https://github.com/wxwzl/vue-virtual-tree/compare/0.1.6...0.1.7) (2025-11-20)

### Features

- 增加数据加载中的状态prop和插槽 ([973f18a](https://github.com/wxwzl/vue-virtual-tree/commit/973f18ae697f8dd38b4ba6adac7cae4c27b69a5d))

## [0.1.6](https://github.com/wxwzl/vue-virtual-tree/compare/6ed73595f63c36478254a6f5c4e94e7f96a71e33...0.1.6) (2025-11-20)

### Bug Fixes

- 复选框选中状态 ([a7863a3](https://github.com/wxwzl/vue-virtual-tree/commit/a7863a33a28d2371f3794491d27c3e848a94e4fd))
- 复选框选中状态丢失问题 ([1f1438f](https://github.com/wxwzl/vue-virtual-tree/commit/1f1438f28da98b70055dda743f5a7e7e58e08c76))
- 懒加载数据 ([f20ce1f](https://github.com/wxwzl/vue-virtual-tree/commit/f20ce1fa39504f1c49aeca36c7a512cba7dc2a34))
- 循环递归，导致栈溢出 ([193a1ce](https://github.com/wxwzl/vue-virtual-tree/commit/193a1ce9554fc73bda6649115b7bd6f295b04324))
- 暂无数据的判断 ([ce7a126](https://github.com/wxwzl/vue-virtual-tree/commit/ce7a12668448060298285c1c6112925251b56723))
- defaultCheckedKeys 没有生效 ([cfdfc60](https://github.com/wxwzl/vue-virtual-tree/commit/cfdfc60856c59b85ae17630a0cd9e63709813c79))

### Features

- 产物类型声明生成 ([8f5966f](https://github.com/wxwzl/vue-virtual-tree/commit/8f5966f4bc25ddc228f94847184ecbc7d67890bc))
- 懒加载 ([adcb216](https://github.com/wxwzl/vue-virtual-tree/commit/adcb2162395d8bdf37aae325c97582d824039e78))
- 图标插槽 ([5030821](https://github.com/wxwzl/vue-virtual-tree/commit/5030821b900d18fb82c751a8661f2c752075cccc))
- 移除isVisible属性，重构可见数据列表展示机制 ([e97cb25](https://github.com/wxwzl/vue-virtual-tree/commit/e97cb25ff38ac22379e00328a3cc11f615414186))
- 源代码面板 ([8936640](https://github.com/wxwzl/vue-virtual-tree/commit/89366400cb9d004cab89b2cc5c2c9410fd621f0e))
- 增加缩进定制配置 ([8f74dcf](https://github.com/wxwzl/vue-virtual-tree/commit/8f74dcfcbbdf41567dc2db6386c231cb1c50eaae))
- init ([6ed7359](https://github.com/wxwzl/vue-virtual-tree/commit/6ed73595f63c36478254a6f5c4e94e7f96a71e33))

### Performance Improvements

- 性能优化、重构代码 ([737b61b](https://github.com/wxwzl/vue-virtual-tree/commit/737b61b77d06076f6ace4efd42cf3a28194b11d7))
- 移除节点的parentNode属性 ([7f1f373](https://github.com/wxwzl/vue-virtual-tree/commit/7f1f3735225d652b047ab5e71982bfb1b3c982ee))
- 增加click事件委托 ([bc070ad](https://github.com/wxwzl/vue-virtual-tree/commit/bc070ad06f64337d5fa7f78d0891fa853de45ccf))
