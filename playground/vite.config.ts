import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  base: "/vue-virtual-tree/",
  plugins: [vue()],
  resolve: {
    alias: {
      "@wxwzl/vue-virtual-tree": resolve(__dirname, "../packages/vue-virtual-tree/src"),
    },
  },
});
