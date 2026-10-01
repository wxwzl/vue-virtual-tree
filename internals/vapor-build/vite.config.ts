import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
// 显式固定 3.6 编译器：root 指向 tree 包（其 node_modules 是 vue 3.4），
// plugin-vue 默认按 root 就近解析 vue/compiler-sfc 会拿到 3.4，必须显式注入本包的 3.6
import * as compiler from "vue/compiler-sfc";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const pkgRoot = resolve(__dirname, "../../packages/vue-virtual-tree");

export default defineConfig({
  root: pkgRoot,
  plugins: [
    // features.vapor 全局强制：整链（VirtualTree/VirtualList/TreeNodeItem/TreeNode）
    // 全部按 vapor 编译，消除 vdom↔vapor 的逐行 interop 边界（仅构建期生效，
    // 共享源码与主构建链不受影响）。已知边界：VirtualList 内联的 MemoRows/
    // MeasureLane 是手写 h() 的 vdom 子组件，开启 rowMemo 或 dynamic 时经
    // interop 混跑（消费方需安装 vaporInteropPlugin）。
    vue({ compiler, features: { vapor: true } }),
  ],
  resolve: {
    alias: {
      // VirtualList 必须内联进 vapor 产物（否则 external 解析到其 vdom dist，
      // 行容器仍是 vdom，逐行边界依旧存在）——直接别名到源码随本构建一起 vapor 编译
      "@wxwzl/vue-virtual-list": resolve(__dirname, "../../packages/vue-virtual-list/src/index.ts"),
    },
  },
  build: {
    lib: {
      entry: resolve(pkgRoot, "src/index.ts"),
      name: "VueVirtualTree",
      fileName: (format) => `index.${format === "es" ? "js" : "cjs"}`,
      formats: ["es", "cjs"],
    },
    // 输出到 tree 包 dist/vapor（主构建产物 dist/index.js 不动，故不清空目录）
    outDir: "dist/vapor",
    emptyOutDir: false,
    rollupOptions: {
      external: ["vue"],
      output: {
        exports: "named",
        globals: {
          vue: "Vue",
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    minify: "esbuild",
  },
});
