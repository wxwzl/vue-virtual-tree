import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'
// import { fileURLToPath } from 'url'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [vue(),dts({
    tsconfigPath: './tsconfig.json',
    outDir: 'dist/types',
    entryRoot: resolve(__dirname, 'src'),
    insertTypesEntry: true, // 生成类型声明入口
    copyDtsFiles: true, // 将生成的类型声明文件复制到输出目录
    include: ['./src/**/*.vue', './src/**/*.ts', './src/vite-env.d.ts'], // 包含的文件，根据你的项目调整
  }),],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VueVirtualTree',
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: ['vue', 'vue-virtual-scroller'],
      output: {
        globals: {
          vue: 'Vue',
          'vue-virtual-scroller': 'VueVirtualScroller'
        }
      }
    },
    cssCodeSplit: false,
    sourcemap: true,
    minify: 'esbuild'
  },
  // resolve: {
  //   alias: {
  //     '@': fileURLToPath(new URL('./src', import.meta.url)),
  //   },
  // }
})

