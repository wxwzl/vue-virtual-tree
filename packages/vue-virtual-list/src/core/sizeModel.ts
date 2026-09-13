import { Fenwick } from "./fenwick";

/**
 * 尺寸模型：统一固定行高与动态测量两种模式的前缀和查询
 * 所有坐标均为「虚拟 px」（未做浏览器高度上限缩放）
 */
export interface SizeModel {
  readonly count: number;
  /** 全部行总高度（虚拟 px） */
  readonly totalSize: number;
  /** 已实测缓存的行数（固定模式等于 count） */
  readonly measuredCount: number;
  /** 第 index 行起始偏移，index ∈ [0, count]（count 时等于 totalSize） */
  offsetOf(index: number): number;
  /** 第 index 行高度 */
  sizeOf(index: number): number;
  /** 虚拟偏移所在行索引（clamp 到 [0, count-1]） */
  indexAt(offset: number): number;
  /** 该行是否已有实测缓存 */
  isMeasured(index: number): boolean;
  setCount(count: number): void;
  /** 回写实测高度，返回该行相对旧值的变化量；固定行高模式为 no-op 返回 0 */
  measure(index: number, size: number): number;
}

/**
 * 固定行高模型：纯乘法，O(1)
 */
export class FixedSizeModel implements SizeModel {
  private size: number;
  private _count: number;

  constructor(count: number, size: number) {
    this._count = Math.max(0, count);
    this.size = size;
  }

  get count(): number {
    return this._count;
  }

  get totalSize(): number {
    return this._count * this.size;
  }

  get measuredCount(): number {
    return this._count;
  }

  offsetOf(index: number): number {
    return Math.min(Math.max(0, index), this._count) * this.size;
  }

  sizeOf(_index: number): number {
    return this.size;
  }

  indexAt(offset: number): number {
    if (this._count === 0) {
      return 0;
    }
    const i = Math.floor(Math.max(0, offset) / this.size);
    return Math.min(i, this._count - 1);
  }

  isMeasured(_index: number): boolean {
    return true;
  }

  setCount(count: number): void {
    this._count = Math.max(0, count);
  }

  measure(_index: number, _size: number): number {
    return 0;
  }
}

/** 均值先验强度：相当于 32 个估计值样本，防止少量测量时均值剧烈摆动 */
const AVG_PRIOR = 32;

/**
 * 动态测量模型：已测行存精确值，未测行用自适应均值（已测均值 + 估计值先验收缩）。
 * 双 Fenwick：bitH 记已测行高度和，bitC 记已测行计数；
 * offsetOf(i) = bitH.sum(i) + avg × (i − bitC.sum(i))，
 * 均值随测量自动收敛，无需重写任何前缀树。
 * offsetOf / indexAt / measure 均为 O(log n)（indexAt 为 O(log²n) 二分）。
 */
export class MeasuredSizeModel implements SizeModel {
  private estimate: number;
  private sizes: Float64Array;
  private flags: Uint8Array;
  private bitH: Fenwick;
  private bitC: Fenwick;
  private _count: number;
  private _measuredCount = 0;
  private _measuredTotal = 0;

  constructor(count: number, estimate: number) {
    this.estimate = estimate;
    this._count = Math.max(0, count);
    this.sizes = new Float64Array(this._count);
    this.flags = new Uint8Array(this._count);
    this.bitH = new Fenwick(this._count);
    this.bitC = new Fenwick(this._count, true);
  }

  get count(): number {
    return this._count;
  }

  get measuredCount(): number {
    return this._measuredCount;
  }

  /** 未测行的自适应高度 */
  get avg(): number {
    return (this._measuredTotal + AVG_PRIOR * this.estimate) / (this._measuredCount + AVG_PRIOR);
  }

  get totalSize(): number {
    return this._measuredTotal + this.avg * (this._count - this._measuredCount);
  }

  offsetOf(index: number): number {
    const i = Math.min(Math.max(0, index), this._count);
    return this.bitH.sum(i) + this.avg * (i - this.bitC.sum(i));
  }

  sizeOf(index: number): number {
    return this.flags[index] ? this.sizes[index] : this.avg;
  }

  isMeasured(index: number): boolean {
    return !!this.flags[index];
  }

  /** [0, index) 内未测行数（供均值漂移补偿计算） */
  unmeasuredCountBelow(index: number): number {
    const i = Math.min(Math.max(0, index), this._count);
    return i - this.bitC.sum(i);
  }

  indexAt(offset: number): number {
    if (this._count === 0) {
      return 0;
    }
    if (offset <= 0) {
      return 0;
    }
    // offsetOf 单调不减：二分最大的 i 使 offsetOf(i) <= offset
    let lo = 0;
    let hi = this._count;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.offsetOf(mid) <= offset) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return Math.min(lo, this._count - 1);
  }

  measure(index: number, size: number): number {
    if (index < 0 || index >= this._count || !(size > 0)) {
      return 0;
    }
    if (this.flags[index]) {
      const delta = size - this.sizes[index];
      if (delta === 0) {
        return 0;
      }
      this.sizes[index] = size;
      this.bitH.add(index, delta);
      this._measuredTotal += delta;
      return delta;
    }
    const delta = size - this.avg;
    this.flags[index] = 1;
    this.sizes[index] = size;
    this.bitH.add(index, size);
    this.bitC.add(index, 1);
    this._measuredCount++;
    this._measuredTotal += size;
    return delta;
  }

  /** 重建（count 变化频率低，直接 O(n) 重建保持实现简单），保留已测数据 */
  setCount(count: number): void {
    count = Math.max(0, count);
    if (count === this._count) {
      return;
    }
    const nextSizes = new Float64Array(count);
    const nextFlags = new Uint8Array(count);
    const copyLen = Math.min(count, this._count);
    nextSizes.set(this.sizes.subarray(0, copyLen));
    nextFlags.set(this.flags.subarray(0, copyLen));
    this.sizes = nextSizes;
    this.flags = nextFlags;
    this._count = count;
    this.bitH = new Fenwick(count);
    this.bitC = new Fenwick(count, true);
    let total = 0;
    let measured = 0;
    for (let i = 0; i < count; i++) {
      if (nextFlags[i]) {
        this.bitH.add(i, nextSizes[i]);
        this.bitC.add(i, 1);
        total += nextSizes[i];
        measured++;
      }
    }
    this._measuredTotal = total;
    this._measuredCount = measured;
  }

  /** 宽度变化等场景：清空实测缓存（均值沉淀为新的估计值，重测收敛更快），O(n) */
  invalidateAll(): void {
    this.estimate = this.avg;
    this.flags.fill(0);
    this.bitH = new Fenwick(this._count);
    this.bitC = new Fenwick(this._count, true);
    this._measuredCount = 0;
    this._measuredTotal = 0;
  }
}
