import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { readFileSync } from "fs";

/** 头部版本徽章：构建期从各包 package.json 读取（包未导出 version 字段，运行时拿不到） */
const pkgVersion = (pkgDir: string): string =>
  (JSON.parse(readFileSync(resolve(pkgDir, "package.json"), "utf-8")) as { version: string })
    .version;
const treeVersion = pkgVersion(resolve(__dirname, "../packages/vue-virtual-tree"));
const listVersion = pkgVersion(resolve(__dirname, "../packages/vue-virtual-list"));

export default defineConfig({
  base: "/vue-virtual-tree/",
  plugins: [vue()],
  define: {
    __TREE_VERSION__: JSON.stringify(treeVersion),
    __LIST_VERSION__: JSON.stringify(listVersion),
  },
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
