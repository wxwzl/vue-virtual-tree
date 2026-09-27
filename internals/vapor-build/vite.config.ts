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
    // 不开 features.vapor：按 <script setup vapor> attr 逐文件 opt-in，
    // VirtualTree.vue 等不带 attr 的组件仍按 vdom 编译，与 playground 行为一致
    vue({ compiler }),
  ],
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
      external: ["vue", "@wxwzl/vue-virtual-list"],
      output: {
        exports: "named",
        globals: {
          vue: "Vue",
          "@wxwzl/vue-virtual-list": "VueVirtualList",
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    minify: "esbuild",
  },
});
