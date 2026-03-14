import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "happy-dom",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/__tests__/", "**/*.d.ts", "**/*.config.ts", "playground/"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
