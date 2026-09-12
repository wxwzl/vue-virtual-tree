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
 */
export function coverRange(
  model: SizeModel,
  offset: number,
  viewport: number,
  buffer: number,
  current: RowRange
): RowRange {
  const vis = visibleRange(model, offset, viewport);
  if (vis.end < 0) {
    return { start: 0, end: -1 };
  }
  if (current.end >= current.start && vis.start >= current.start && vis.end <= current.end) {
    return current;
  }
  const start = Math.max(0, model.indexAt(Math.max(0, offset - buffer)));
  const end = Math.min(model.count - 1, model.indexAt(offset + viewport + buffer));
  return { start, end };
}
