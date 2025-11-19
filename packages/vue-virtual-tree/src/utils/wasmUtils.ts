import init, * as wasmExports from '../../lib/tools/tools';

let ready: Promise<typeof wasmExports> | null = null;
let isLoaded = false;

export function loadToolsWasm() {
  if (!ready) {
    ready = init().then(() => {
      isLoaded = true
      return wasmExports
    })
  }
  return ready!
}

export function isToolsWasmLoaded() {
  return isLoaded
}