import { inject, type Component, type InjectionKey } from "vue";

/** 树实现注入 key：由 TreeModeProvider 按路由组（vdom/vapor）提供对应 dist 产物组件 */
export const VirtualTreeImplKey: InjectionKey<Component> = Symbol("VirtualTreeImpl");

/**
 * 取当前路由组注入的 VirtualTree 实现（vdom → dist/index.js，vapor → dist/vapor/index.js）。
 * 在 script setup 顶层调用并赋给大写常量即可直接用于模板：
 *   const VirtualTree = useVirtualTree();
 */
export const useVirtualTree = (): Component => {
  const impl = inject(VirtualTreeImplKey);
  if (!impl) {
    throw new Error("useVirtualTree 必须在 /tree/:mode 路由组内使用（缺少 TreeModeProvider）");
  }
  return impl;
};
