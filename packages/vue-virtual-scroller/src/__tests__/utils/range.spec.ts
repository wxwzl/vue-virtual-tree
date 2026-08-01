import { describe, it, expect } from "vitest";
import {
  insertRange,
  removeRange,
  findRangeIndex,
  getVisibleIndexAtFlatIndex,
  getFlatIndexAtVisibleIndex,
} from "../../utils/range";
import type { VisibleRange } from "../../utils/range";

describe("range utils", () => {
  it("insertRange merges overlapping ranges", () => {
    const ranges: VisibleRange[] = [{ start: 0, end: 2 }];
    expect(insertRange(ranges, 3, 5)).toEqual([{ start: 0, end: 5 }]);
  });

  it("insertRange keeps separate non-adjacent ranges", () => {
    const ranges: VisibleRange[] = [{ start: 0, end: 1 }];
    expect(insertRange(ranges, 3, 5)).toEqual([
      { start: 0, end: 1 },
      { start: 3, end: 5 },
    ]);
  });

  it("removeRange splits a covered range", () => {
    const ranges: VisibleRange[] = [{ start: 0, end: 10 }];
    expect(removeRange(ranges, 3, 7)).toEqual([
      { start: 0, end: 2 },
      { start: 8, end: 10 },
    ]);
  });

  it("findRangeIndex locates range containing index", () => {
    const ranges: VisibleRange[] = [
      { start: 0, end: 2 },
      { start: 5, end: 8 },
    ];
    expect(findRangeIndex(ranges, 1)).toBe(0);
    expect(findRangeIndex(ranges, 6)).toBe(1);
    expect(findRangeIndex(ranges, 4)).toBe(-1);
  });

  it("getVisibleIndexAtFlatIndex counts visible nodes before flat index", () => {
    const ranges: VisibleRange[] = [
      { start: 0, end: 2 },
      { start: 5, end: 7 },
    ];
    expect(getVisibleIndexAtFlatIndex(ranges, 1)).toBe(1);
    expect(getVisibleIndexAtFlatIndex(ranges, 6)).toBe(4);
    expect(getVisibleIndexAtFlatIndex(ranges, 4)).toBe(-1);
  });

  it("getFlatIndexAtVisibleIndex maps visible index back to flat index", () => {
    const ranges: VisibleRange[] = [
      { start: 0, end: 2 },
      { start: 5, end: 7 },
    ];
    expect(getFlatIndexAtVisibleIndex(ranges, 0)).toBe(0);
    expect(getFlatIndexAtVisibleIndex(ranges, 3)).toBe(5);
    expect(getFlatIndexAtVisibleIndex(ranges, 99)).toBe(-1);
  });
});
