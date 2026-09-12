/**
 * 树状数组（Fenwick / Binary Indexed Tree），Float64 前缀和
 * 用于百万级行高的 offsetOf / indexAt O(log n) 查询
 */
export class Fenwick {
  /** 逻辑长度（元素个数） */
  private n: number;
  /** 1-based 内部存储 */
  private tree: Float64Array;
  /** 不超过 n 的最大 2 的幂，用于二分下降 */
  private highest: number;

  constructor(n: number) {
    this.n = n;
    this.tree = new Float64Array(n + 1);
    let h = 1;
    while (h << 1 <= n) {
      h <<= 1;
    }
    this.highest = h;
  }

  get length(): number {
    return this.n;
  }

  /** 给下标 i（0-based）的元素加 delta */
  add(i: number, delta: number): void {
    const tree = this.tree;
    for (let x = i + 1; x <= this.n; x += x & -x) {
      tree[x] += delta;
    }
  }

  /** 前 i 个元素之和，即 [0, i) 区间和 */
  sum(i: number): number {
    const tree = this.tree;
    let s = 0;
    for (let x = i; x > 0; x -= x & -x) {
      s += tree[x];
    }
    return s;
  }

  /** 全部元素之和 */
  total(): number {
    return this.sum(this.n);
  }

  /**
   * 二分下降：返回最大的 i（0 ≤ i ≤ n），使得 sum(i) <= target
   * 即 target 落在第 i 个元素内（prefix(i) <= target < prefix(i+1)）
   */
  lowerBound(target: number): number {
    const tree = this.tree;
    const n = this.n;
    let i = 0;
    for (let bit = this.highest; bit > 0; bit >>= 1) {
      const next = i + bit;
      if (next <= n && tree[next] <= target) {
        target -= tree[next];
        i = next;
      }
    }
    return i;
  }
}
