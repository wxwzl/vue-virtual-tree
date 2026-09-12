import { Fenwick } from "./fenwick";

/**
 * 尺寸模型：统一固定行高与动态测量两种模式的前缀和查询
 * 所有坐标均为「虚拟 px」（未做浏览器高度上限缩放）
 */
export interface SizeModel {
  readonly count: number;
  /** 全部行总高度（虚拟 px） */
  readonly totalSize: number;
  /** 第 index 行起始偏移，index ∈ [0, count]（count 时等于 totalSize） */
  offsetOf(index: number): number;
  /** 第 index 行高度 */
  sizeOf(index: number): number;
  /** 虚拟偏移所在行索引（clamp 到 [0, count-1]） */
  indexAt(offset: number): number;
  setCount(count: number): void;
  /** 回写实测高度，返回总高度变化量；固定行高模式为 no-op 返回 0 */
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

  setCount(count: number): void {
    this._count = Math.max(0, count);
  }

  measure(_index: number, _size: number): number {
    return 0;
  }
}

/**
 * 动态测量模型：未测量行用估计高度，实测值写回后按前缀和修正
 * offsetOf / indexAt / measure 均为 O(log n)
 */
export class MeasuredSizeModel implements SizeModel {
  private estimate: number;
  private sizes: Float64Array;
  private bit: Fenwick;
  private _count: number;

  constructor(count: number, estimate: number) {
    this.estimate = estimate;
    this._count = Math.max(0, count);
    this.sizes = new Float64Array(this._count).fill(estimate);
    this.bit = new Fenwick(this._count);
    for (let i = 0; i < this._count; i++) {
      this.bit.add(i, estimate);
    }
  }

  get count(): number {
    return this._count;
  }

  get totalSize(): number {
    return this.bit.total();
  }

  offsetOf(index: number): number {
    return this.bit.sum(Math.min(Math.max(0, index), this._count));
  }

  sizeOf(index: number): number {
    return this.sizes[index] ?? this.estimate;
  }

  indexAt(offset: number): number {
    if (this._count === 0) {
      return 0;
    }
    // target < 0 时 lowerBound 返回 0，天然 clamp
    return Math.min(this.bit.lowerBound(offset), this._count - 1);
  }

  measure(index: number, size: number): number {
    if (index < 0 || index >= this._count || !(size > 0)) {
      return 0;
    }
    const delta = size - this.sizes[index];
    if (delta === 0) {
      return 0;
    }
    this.sizes[index] = size;
    this.bit.add(index, delta);
    return delta;
  }

  /** 重建（count 变化频率低，直接 O(n) 重建保持实现简单） */
  setCount(count: number): void {
    count = Math.max(0, count);
    if (count === this._count) {
      return;
    }
    const next = new Float64Array(count).fill(this.estimate);
    const copyLen = Math.min(count, this._count);
    next.set(this.sizes.subarray(0, copyLen));
    this.sizes = next;
    this._count = count;
    this.bit = new Fenwick(count);
    for (let i = 0; i < count; i++) {
      this.bit.add(i, next[i]);
    }
  }
}
