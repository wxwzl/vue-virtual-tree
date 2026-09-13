import { describe, it, expect } from "vitest";
import { Fenwick } from "../core/fenwick";
import { FixedSizeModel, MeasuredSizeModel } from "../core/sizeModel";
import { visibleRange, coverRange, EMPTY_RANGE } from "../core/range";

describe("Fenwick", () => {
  it("前缀和与单点更新", () => {
    const bit = new Fenwick(5);
    [10, 20, 30, 40, 50].forEach((v, i) => bit.add(i, v));
    expect(bit.sum(0)).toBe(0);
    expect(bit.sum(1)).toBe(10);
    expect(bit.sum(3)).toBe(60);
    expect(bit.total()).toBe(150);

    bit.add(2, -10);
    expect(bit.sum(3)).toBe(50);
    expect(bit.total()).toBe(140);
  });

  it("lowerBound 定位 target 所在元素", () => {
    const bit = new Fenwick(4);
    [10, 20, 30, 40].forEach((v, i) => bit.add(i, v));
    // 元素区间: [0,10) [10,30) [30,60) [60,100)
    expect(bit.lowerBound(0)).toBe(0);
    expect(bit.lowerBound(9)).toBe(0);
    expect(bit.lowerBound(10)).toBe(1);
    expect(bit.lowerBound(29)).toBe(1);
    expect(bit.lowerBound(59)).toBe(2);
    expect(bit.lowerBound(60)).toBe(3);
    expect(bit.lowerBound(99)).toBe(3);
    expect(bit.lowerBound(100)).toBe(4); // 越界返回 n
    expect(bit.lowerBound(-5)).toBe(0); // 负数 clamp 到 0
  });

  it("Int32 存储模式", () => {
    const bit = new Fenwick(5, true);
    [1, 2, 3, 4, 5].forEach((v, i) => bit.add(i, v));
    expect(bit.sum(3)).toBe(6);
    expect(bit.total()).toBe(15);
  });

  it("空树", () => {
    const bit = new Fenwick(0);
    expect(bit.total()).toBe(0);
    expect(bit.lowerBound(10)).toBe(0);
  });
});

describe("FixedSizeModel", () => {
  it("基础换算", () => {
    const m = new FixedSizeModel(100, 32);
    expect(m.totalSize).toBe(3200);
    expect(m.offsetOf(10)).toBe(320);
    expect(m.sizeOf(99)).toBe(32);
    expect(m.indexAt(0)).toBe(0);
    expect(m.indexAt(319)).toBe(9);
    expect(m.indexAt(320)).toBe(10);
    expect(m.indexAt(3199)).toBe(99);
    expect(m.indexAt(99999)).toBe(99); // 越界 clamp
    expect(m.indexAt(-1)).toBe(0);
  });

  it("setCount 与空数据", () => {
    const m = new FixedSizeModel(0, 32);
    expect(m.totalSize).toBe(0);
    expect(m.indexAt(100)).toBe(0);
    m.setCount(1_000_000);
    expect(m.totalSize).toBe(32_000_000);
    expect(m.indexAt(31_999_999)).toBe(999_999);
  });

  it("measure 为 no-op", () => {
    const m = new FixedSizeModel(10, 32);
    expect(m.measure(0, 100)).toBe(0);
    expect(m.sizeOf(0)).toBe(32);
  });
});

describe("MeasuredSizeModel", () => {
  it("未测量时按估计高度计算", () => {
    const m = new MeasuredSizeModel(100, 30);
    expect(m.totalSize).toBe(3000);
    expect(m.offsetOf(10)).toBe(300);
    expect(m.indexAt(299)).toBe(9);
    expect(m.indexAt(300)).toBe(10);
  });

  it("measure 修正前缀和，均值随测量收缩", () => {
    const m = new MeasuredSizeModel(10, 30);
    // 第 0 行实测 100：行级 delta = 100 − 当前估计 30
    expect(m.measure(0, 100)).toBe(70);
    // 均值 = (100 + 32×30) / 33（先验收缩）
    const avg1 = (100 + 32 * 30) / 33;
    expect(m.totalSize).toBeCloseTo(100 + avg1 * 9, 10);
    expect(m.offsetOf(1)).toBe(100);
    expect(m.indexAt(99)).toBe(0);
    expect(m.indexAt(100)).toBe(1);
    // 重复测量返回相对当前值的 delta
    expect(m.measure(0, 100)).toBe(0);
    expect(m.measure(0, 50)).toBe(-50);
    const avg2 = (50 + 32 * 30) / 33;
    expect(m.totalSize).toBeCloseTo(50 + avg2 * 9, 10);
  });

  it("measure 忽略非法输入", () => {
    const m = new MeasuredSizeModel(10, 30);
    expect(m.measure(-1, 50)).toBe(0);
    expect(m.measure(10, 50)).toBe(0);
    expect(m.measure(0, 0)).toBe(0);
    expect(m.measure(0, NaN)).toBe(0);
    expect(m.totalSize).toBe(300);
  });

  it("setCount 保留已测量前缀", () => {
    const m = new MeasuredSizeModel(5, 30);
    m.measure(0, 100);
    const avg = (100 + 32 * 30) / 33;
    m.setCount(3);
    expect(m.count).toBe(3);
    expect(m.sizeOf(0)).toBe(100);
    expect(m.totalSize).toBeCloseTo(100 + avg * 2, 10);
    m.setCount(10);
    expect(m.sizeOf(0)).toBe(100);
    expect(m.totalSize).toBeCloseTo(100 + avg * 9, 10);
  });

  it("已测标记与未测行计数", () => {
    const m = new MeasuredSizeModel(10, 30);
    expect(m.isMeasured(0)).toBe(false);
    expect(m.measuredCount).toBe(0);
    m.measure(3, 90);
    m.measure(7, 60);
    expect(m.isMeasured(3)).toBe(true);
    expect(m.isMeasured(4)).toBe(false);
    expect(m.measuredCount).toBe(2);
    expect(m.unmeasuredCountBelow(3)).toBe(3); // [0,3) 全未测
    expect(m.unmeasuredCountBelow(4)).toBe(3); // 3 已测
    expect(m.unmeasuredCountBelow(10)).toBe(8);
  });

  it("均值自适应收敛", () => {
    const m = new MeasuredSizeModel(1000, 30);
    expect(m.avg).toBe(30);
    for (let i = 0; i < 500; i++) {
      m.measure(i, 60);
    }
    expect(m.avg).toBeCloseTo((500 * 60 + 32 * 30) / 532, 10);
    expect(m.sizeOf(999)).toBeCloseTo(m.avg, 10);
    expect(m.totalSize).toBeCloseTo(500 * 60 + m.avg * 500, 10);
  });

  it("invalidateAll 清空缓存并沉淀均值", () => {
    const m = new MeasuredSizeModel(10, 30);
    m.measure(0, 90);
    const avgBefore = m.avg;
    m.invalidateAll();
    expect(m.measuredCount).toBe(0);
    expect(m.isMeasured(0)).toBe(false);
    expect(m.avg).toBeCloseTo(avgBefore, 10); // 均值沉淀为估计值
    expect(m.totalSize).toBeCloseTo(avgBefore * 10, 10);
    m.measure(0, 90);
    expect(m.offsetOf(1)).toBe(90);
  });

  it("一百万行混合测量后的精度", () => {
    const n = 1_000_000;
    const m = new MeasuredSizeModel(n, 32);
    let measuredTotal = 0;
    for (let i = 0; i < n; i += 1000) {
      const size = 16 + ((i * 7919) % 96); // 16~111 确定性伪随机
      measuredTotal += size;
      m.measure(i, size);
    }
    const avg = (measuredTotal + 32 * 32) / (1000 + 32);
    expect(m.totalSize).toBeCloseTo(measuredTotal + avg * (n - 1000), 6);
    // 抽点验证 offsetOf 与暴力求和一致（sizeOf 为唯一事实源；均值非 2 的幂，用相对误差）
    let brute = 0;
    for (let i = 0; i < 500_000; i++) {
      brute += m.sizeOf(i);
    }
    expect(Math.abs(m.offsetOf(500_000) - brute) / brute).toBeLessThan(1e-9);
    expect(m.indexAt(m.offsetOf(500_000))).toBe(500_000);
  });
});

describe("range", () => {
  it("visibleRange 边界", () => {
    const m = new FixedSizeModel(100, 32);
    expect(visibleRange(m, 0, 320)).toEqual({ start: 0, end: 10 });
    expect(visibleRange(m, 320, 320)).toEqual({ start: 10, end: 20 });
    expect(visibleRange(m, 3168, 320)).toEqual({ start: 99, end: 99 }); // 末尾 clamp
    expect(visibleRange(m, 0, 0)).toEqual({ start: 0, end: -1 }); // 无视口
    const empty = new FixedSizeModel(0, 32);
    expect(visibleRange(empty, 0, 320)).toEqual({ start: 0, end: -1 });
  });

  it("coverRange 行内滚动不重算，逃出才外扩", () => {
    const m = new FixedSizeModel(1000, 32);
    const buffer = 64; // 2 行
    // 首次：可见 [0, 10]，渲染范围向左 clamp
    const r1 = coverRange(m, 0, 320, buffer, EMPTY_RANGE);
    expect(r1).toEqual({ start: 0, end: 12 });
    // 行内滚动（可见范围仍在渲染范围内）：不重算
    const r2 = coverRange(m, 32, 320, buffer, r1);
    expect(r2).toBe(r1);
    // 逃出底部：外扩重算
    const r3 = coverRange(m, 320, 320, buffer, r2);
    expect(r3).toEqual({ start: 8, end: 22 });
    // 快速滚到远处
    const r4 = coverRange(m, 16000, 320, buffer, r3);
    expect(r4).toEqual({ start: 498, end: 512 });
  });

  it("coverRange 行号包含但像素 buffer 不足时重算", () => {
    const m = new FixedSizeModel(1000, 32);
    const buffer = 64;
    const r1 = coverRange(m, 0, 288, buffer, EMPTY_RANGE);
    expect(r1).toEqual({ start: 0, end: 11 });
    // 视口 288 → 352：可见 end=11 仍被行号包含，但下方像素 buffer 不足 → 重算
    const r2 = coverRange(m, 0, 352, buffer, r1);
    expect(r2).toEqual({ start: 0, end: 13 });
    // 覆盖充足后保持稳定
    expect(coverRange(m, 0, 352, buffer, r2)).toBe(r2);
  });
});
