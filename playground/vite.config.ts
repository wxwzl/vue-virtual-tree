import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'vue-virtual-tree': resolve(__dirname, '../packages/vue-virtual-tree/src')
    }
  }
})

