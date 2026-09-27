import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  base: "/vue-virtual-tree/",
  plugins: [vue()],
  resolve: {
    alias: {
      // vue 3.6 RC 的 vapor runtime 只在独立的 with-vapor dist 中（含 vaporInteropPlugin
      // 与 vapor DOM helpers），默认 bundler runtime 不含——必须整应用统一切换，不可混用
      vue: "vue/dist/vue.runtime-with-vapor.esm-browser.js",
      "@wxwzl/vue-virtual-tree": resolve(__dirname, "../packages/vue-virtual-tree/src"),
      "@wxwzl/vue-virtual-list": resolve(__dirname, "../packages/vue-virtual-list/src"),
    },
  },
});
