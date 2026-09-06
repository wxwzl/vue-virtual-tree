import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import VirtualTree from "../../components/VirtualTree.vue";
import type { TreeNodeData } from "../../types";

/** 生成大树：width 个根，每个根 depth 层，每层 width 个子节点 */
function generateTree(roots: number, childrenPerNode: number, depth: number): TreeNodeData[] {
  let id = 0;
  const build = (level: number): TreeNodeData[] => {
    const list: TreeNodeData[] = [];
    for (let i = 0; i < (level === 0 ? roots : childrenPerNode); i++) {
      const node: TreeNodeData = { id: `n-${id++}`, label: `Node ${id}` };
      if (level < depth) {
        node.children = build(level + 1);
      }
      list.push(node);
    }
    return list;
  };
  return build(0);
}

function countNodes(nodes: TreeNodeData[]): number {
  let count = 0;
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    count++;
    if (n.children) {
      stack.push(...n.children);
    }
  }
  return count;
}

/** 轮询等待条件满足 */
function waitUntil(cond: () => boolean, timeout = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("waitUntil timeout")), timeout);
    const check = () => {
      if (cond()) {
        clearTimeout(timer);
        resolve();
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

/** 等待 node-generated 事件（内部 5ms 防抖 + 分片异步扁平化） */
function waitForGenerated(wrapper: ReturnType<typeof mount>, timeout = 15000): Promise<void> {
  return waitUntil(() => !!wrapper.emitted("node-generated")?.length, timeout);
}

describe("VirtualTree - 大数据量初始化", () => {
  it("100 万节点初始化不栈溢出且最终渲染", async () => {
    // 100 根 × 10 × 10 × 10 × 10 = 1,111,100 节点
    const data = generateTree(100, 10, 4);
    expect(countNodes(data)).toBe(1111100);

    const wrapper = mount(VirtualTree, {
      props: { data, height: 400, itemSize: 32 },
    });
    await waitForGenerated(wrapper, 120000);

    const vm = wrapper.vm as unknown as { getNode: (k: string) => { key: string } | null };
    expect(vm.getNode("n-0")).toBeTruthy();
    wrapper.unmount();
  }, 150000);

  it("深链树（1 万层）不栈溢出", async () => {
    const root: TreeNodeData = { id: "deep-0", label: "0" };
    let current = root;
    for (let i = 1; i < 10000; i++) {
      const child: TreeNodeData = { id: `deep-${i}`, label: `${i}` };
      current.children = [child];
      current = child;
    }
    // 通过包装组件传入数据，绕过 test-utils 对 mount props 的递归检查
    const emitted: string[][] = [];
    const Host = defineComponent({
      setup() {
        return () =>
          h(VirtualTree, {
            data: [root],
            height: 400,
            onNodeGenerated: () => emitted.push(["node-generated"]),
          });
      },
    });
    const wrapper = mount(Host);
    await waitUntil(() => emitted.length > 0);
    wrapper.unmount();
  }, 20000);

  it("defaultCheckedKeys 父子联动与半选状态正确", async () => {
    const data: TreeNodeData[] = [
      {
        id: "1",
        label: "父1",
        children: [
          { id: "1-1", label: "子1-1" },
          { id: "1-2", label: "子1-2" },
        ],
      },
      { id: "2", label: "父2", children: [{ id: "2-1", label: "子2-1" }] },
    ];
    const wrapper = mount(VirtualTree, {
      props: { data, height: 400, showCheckbox: true, defaultCheckedKeys: ["1-1"] },
    });
    await waitForGenerated(wrapper);

    const vm = wrapper.vm as unknown as {
      getCheckedKeys: (leafOnly?: boolean) => (string | number)[];
      getNode: (k: string) => { checked: boolean } | null;
    };
    // 子节点选中，父节点半选（不计入 checkedKeys）
    expect(vm.getCheckedKeys()).toContain("1-1");
    expect(vm.getCheckedKeys()).not.toContain("1");

    // 全选 2-1 后父节点 2 应自动勾选
    const vm2 = wrapper.vm as unknown as { setCheckedKeys: (k: string[]) => void };
    vm2.setCheckedKeys(["1-1", "1-2", "2-1"]);
    await wrapper.vm.$nextTick();
    expect(vm.getCheckedKeys()).toContain("2");
    expect(vm.getCheckedKeys()).toContain("1");
    wrapper.unmount();
  }, 20000);

  it("分片初始化期间保持 initializing 加载态", async () => {
    const data = generateTree(50, 10, 2);
    const wrapper = mount(VirtualTree, {
      props: { data, height: 400 },
    });
    // 挂载后、扁平化完成前应处于加载态（而不是闪烁"暂无数据"）
    expect(wrapper.find(".vue-virtual-tree__loading").exists()).toBe(true);
    await waitForGenerated(wrapper);
    expect(wrapper.find(".vue-virtual-tree__loading").exists()).toBe(false);
    wrapper.unmount();
  }, 20000);

  it("replace 节点替换：原地更新 label 且保留子树与勾选状态", async () => {
    const data: TreeNodeData[] = [
      { id: "1", label: "甲", children: [{ id: "1-1", label: "甲-1" }] },
      { id: "2", label: "乙", children: [{ id: "2-1", label: "乙-1" }] },
    ];
    const wrapper = mount(VirtualTree, {
      props: { data, height: 400, showCheckbox: true, defaultCheckedKeys: ["1-1"] },
    });
    await waitForGenerated(wrapper);

    const vm = wrapper.vm as unknown as {
      replace: (d: TreeNodeData, k: string) => void;
      getCheckedKeys: () => (string | number)[];
      getNode: (k: string) => { key: string; checked: boolean } | null;
    };

    // 替换节点 2（不带 children → 保留原子树 2-1）
    vm.replace({ id: "2", label: "乙（替换）" }, "2");
    await wrapper.vm.$nextTick();

    const node2 = vm.getNode("2");
    expect(node2).toBeTruthy();
    expect(vm.getNode("2-1")).toBeTruthy(); // 子树保留
    // 节点 1 的勾选状态不受影响
    expect(vm.getCheckedKeys()).toContain("1-1");
    // 页面文案已更新
    expect(wrapper.text()).toContain("乙（替换）");
    wrapper.unmount();
  }, 20000);

  it("replace 节点替换：key 变化时迁移勾选状态", async () => {
    const data: TreeNodeData[] = [
      { id: "1", label: "甲" },
      { id: "2", label: "乙" },
    ];
    const wrapper = mount(VirtualTree, {
      props: { data, height: 400, showCheckbox: true, defaultCheckedKeys: ["2"] },
    });
    await waitForGenerated(wrapper);

    const vm = wrapper.vm as unknown as {
      replace: (d: TreeNodeData, k: string) => void;
      getCheckedKeys: () => (string | number)[];
      getNode: (k: string) => { key: string; checked: boolean } | null;
    };

    // 用新 key 替换节点 2
    vm.replace({ id: "2-new", label: "乙（新）" }, "2");
    await wrapper.vm.$nextTick();

    expect(vm.getNode("2")).toBeNull();
    const newNode = vm.getNode("2-new");
    expect(newNode).toBeTruthy();
    // 勾选状态从旧 key 迁移到新 key
    expect(vm.getCheckedKeys()).toContain("2-new");
    expect(vm.getCheckedKeys()).not.toContain("2");
    wrapper.unmount();
  }, 20000);

  it("replace 节点替换：带 children 时整体替换子树", async () => {
    const data: TreeNodeData[] = [
      { id: "1", label: "甲", children: [{ id: "1-1", label: "甲-1" }] },
    ];
    const wrapper = mount(VirtualTree, {
      props: { data, height: 400, showCheckbox: true, defaultCheckedKeys: ["1-1"] },
    });
    await waitForGenerated(wrapper);

    const vm = wrapper.vm as unknown as {
      replace: (d: TreeNodeData, k: string) => void;
      getNode: (k: string) => { key: string } | null;
      getCheckedKeys: () => (string | number)[];
    };

    // 带 children 替换 → 子树被整体替换
    vm.replace({ id: "1", label: "甲", children: [{ id: "1-x", label: "甲-x" }] }, "1");
    await waitUntil(() => (wrapper.emitted("node-generated")?.length ?? 0) >= 2);

    expect(vm.getNode("1-1")).toBeNull();
    expect(vm.getNode("1-x")).toBeTruthy();
    // 已删除节点 1-1 的勾选状态被清理
    expect(vm.getCheckedKeys()).not.toContain("1-1");
    wrapper.unmount();
  }, 20000);

  it("固定高度模式（fixed-height）使用 RecycleScroller 渲染", async () => {
    const data: TreeNodeData[] = [
      { id: "1", label: "甲", children: [{ id: "1-1", label: "甲-1" }] },
      { id: "2", label: "乙" },
    ];
    const wrapper = mount(VirtualTree, {
      props: { data, height: 400, fixedHeight: true, itemSize: 32 },
    });
    await waitForGenerated(wrapper);

    // RecycleScroller 容器存在，节点行内高度固定为 itemSize
    expect(wrapper.find(".vue-recycle-scroller").exists()).toBe(true);
    const firstNode = wrapper.find(".vue-virtual-tree-node");
    expect(firstNode.exists()).toBe(true);

    const vm = wrapper.vm as unknown as {
      getNode: (k: string) => { key: string } | null;
      scrollToNode: (k: string) => void;
    };
    expect(vm.getNode("1-1")).toBeTruthy();
    // 固定模式下 scrollToNode 不抛错
    expect(() => vm.scrollToNode("2")).not.toThrow();
    wrapper.unmount();
  }, 20000);

  it("remove 后清理已删除节点的勾选状态", async () => {
    const data: TreeNodeData[] = [
      { id: "1", label: "甲" },
      { id: "2", label: "乙" },
    ];
    const wrapper = mount(VirtualTree, {
      props: { data, height: 400, showCheckbox: true, defaultCheckedKeys: ["1", "2"] },
    });
    await waitForGenerated(wrapper);

    const vm = wrapper.vm as unknown as {
      remove: (k: string) => void;
      getCheckedKeys: () => (string | number)[];
    };
    vm.remove("2");
    // remove 走内部重建（不发 node-generated），轮询等待状态清理完成
    await waitUntil(() => vm.getCheckedKeys().length === 1);
    expect(vm.getCheckedKeys()).toEqual(["1"]);
    wrapper.unmount();
  }, 20000);
});
