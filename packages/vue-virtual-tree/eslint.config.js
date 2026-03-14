import js from "@eslint/js";
import ts from "typescript-eslint";
import vue from "eslint-plugin-vue";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
  // 忽略文件
  {
    ignores: ["dist/**/*", "node_modules/**/*", "**/*.d.ts", "coverage/**/*"],
  },

  // JavaScript 基础规则
  js.configs.recommended,

  // TypeScript 规则
  ...ts.configs.recommended,

  // Vue 规则（推荐）
  ...vue.configs["flat/recommended"],

  // 自定义规则
  {
    files: ["**/*.{js,mjs,cjs,ts,vue}"],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: [".vue"],
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    rules: {
      // TypeScript 规则
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // Vue 规则
      "vue/multi-word-component-names": "off",
      "vue/require-default-prop": "off",
      "vue/no-unused-vars": "error",
      "vue/html-self-closing": [
        "error",
        {
          html: {
            void: "always",
            normal: "never",
            component: "always",
          },
          svg: "always",
          math: "always",
        },
      ],

      // 通用规则
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      curly: ["error", "all"],
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  // 测试文件放宽规则
  {
    files: ["**/__tests__/**/*", "**/*.spec.ts", "**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
];
