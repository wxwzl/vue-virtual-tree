import { createApp, vaporInteropPlugin } from "vue";
import App from "./App.vue";
import router from "./router";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";

const app = createApp(App);
// TreeNode/TreeNodeItem 带 vapor attr，在 vue 3.6 下按 vapor 编译；
// 混合模式（vdom VirtualTree/VirtualList 父 → vapor 子）需安装 interop 插件
app.use(vaporInteropPlugin);
app.use(router);
app.mount("#app");
