import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: "./tsconfig.json",
      outDir: "dist/types",
      entryRoot: resolve(__dirname, "src"),
      insertTypesEntry: true,
      copyDtsFiles: true,
      include: ["./src/**/*.vue", "./src/**/*.ts", "./src/vite-env.d.ts"],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "VueVirtualList",
      fileName: (format) => `index.${format === "es" ? "js" : "cjs"}`,
      formats: ["es", "cjs"],
    },
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
