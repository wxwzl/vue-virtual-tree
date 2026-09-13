import type { SizeModel } from "./sizeModel";

/** 闭区间行范围，end 为 -1 表示空 */
export interface RowRange {
  start: number;
  end: number;
}

export const EMPTY_RANGE: RowRange = { start: 0, end: -1 };

/** 可见范围（不含 buffer） */
export function visibleRange(model: SizeModel, offset: number, viewport: number): RowRange {
  if (model.count === 0 || viewport <= 0) {
    return { start: 0, end: -1 };
  }
  const start = model.indexAt(Math.max(0, offset));
  const end = model.indexAt(offset + viewport);
  return { start, end: Math.min(end, model.count - 1) };
}

/**
 * 带 buffer 的渲染范围（cover 策略）：
 * 仅当可见范围逃出当前渲染范围时才外扩重算，
 * 行内滚动/小幅滚动不触发任何渲染更新
 *
 * strict 额外校验像素覆盖（仅在挂载/视口变化等几何重置时开启）：
 * 挂载初期视口可能尚未撑开（或容器事后变大），仅按行号判断会卡在浅 buffer 状态。
 * 滚动期间必须关闭——重算后窗口边缘恰好落在 offset±buffer 上，
 * 任何位移都会让像素余量立即变负，若滚动时也校验会每帧重算
 */
export function coverRange(
  model: SizeModel,
  offset: number,
  viewport: number,
  buffer: number,
  current: RowRange,
  strict = true
): RowRange {
  const vis = visibleRange(model, offset, viewport);
  if (vis.end < 0) {
    return { start: 0, end: -1 };
  }
  if (current.end >= current.start && vis.start >= current.start && vis.end <= current.end) {
    if (!strict) {
      return current;
    }
    // 行号包含之外再校验像素覆盖：渲染窗口像素不足 intended buffer 时重算
    const topCovered = model.offsetOf(current.start) <= Math.max(0, offset - buffer);
    // end 已到末行时下方无法再扩（重算结果相同），视为覆盖充足，避免近底反复重算振荡
    const bottomCovered =
      current.end === model.count - 1 ||
      model.offsetOf(current.end + 1) >= offset + viewport + buffer;
    if (topCovered && bottomCovered) {
      return current;
    }
  }
  const start = Math.max(0, model.indexAt(Math.max(0, offset - buffer)));
  const end = Math.min(model.count - 1, model.indexAt(offset + viewport + buffer));
  return { start, end };
}
