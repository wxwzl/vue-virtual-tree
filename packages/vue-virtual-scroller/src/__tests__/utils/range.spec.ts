import { describe, it, expect } from "vitest";
import {
  insertRange,
  removeRange,
  findRangeIndex,
  getVisibleIndexAtFlatIndex,
  getFlatIndexAtVisibleIndex,
  getVisibleCount,
} from "../../utils/range";
import type { VisibleRange } from "../../utils/range";

describe("range utils", () => {
  describe("insertRange", () => {
    it("creates the first range in an empty array", () => {
      expect(insertRange([], 0, 5)).toEqual([{ start: 0, end: 5 }]);
    });

    it("merges truly overlapping ranges", () => {
      const ranges: VisibleRange[] = [{ start: 0, end: 4 }];
      expect(insertRange(ranges, 3, 7)).toEqual([{ start: 0, end: 7 }]);
    });

    it("merges adjacent ranges", () => {
      const ranges: VisibleRange[] = [{ start: 0, end: 2 }];
      expect(insertRange(ranges, 3, 5)).toEqual([{ start: 0, end: 5 }]);
    });

    it("keeps separate non-adjacent ranges", () => {
      const ranges: VisibleRange[] = [{ start: 0, end: 1 }];
      expect(insertRange(ranges, 3, 5)).toEqual([
        { start: 0, end: 1 },
        { start: 3, end: 5 },
      ]);
    });

    it("inserts at the beginning of the list", () => {
      const ranges: VisibleRange[] = [{ start: 5, end: 7 }];
      expect(insertRange(ranges, 0, 3)).toEqual([
        { start: 0, end: 3 },
        { start: 5, end: 7 },
      ]);
    });

    it("inserts at the end of the list", () => {
      const ranges: VisibleRange[] = [{ start: 0, end: 2 }];
      expect(insertRange(ranges, 5, 7)).toEqual([
        { start: 0, end: 2 },
        { start: 5, end: 7 },
      ]);
    });

    it("merges a range inserted adjacent to the first range", () => {
      const ranges: VisibleRange[] = [{ start: 3, end: 5 }];
      expect(insertRange(ranges, 0, 2)).toEqual([{ start: 0, end: 5 }]);
    });

    it("merges a new range that spans multiple existing ranges", () => {
      const ranges: VisibleRange[] = [
        { start: 0, end: 1 },
        { start: 10, end: 11 },
      ];
      expect(insertRange(ranges, 2, 9)).toEqual([{ start: 0, end: 11 }]);
    });
  });

  describe("removeRange", () => {
    it("returns an empty array when the input is empty", () => {
      expect(removeRange([], 0, 5)).toEqual([]);
    });

    it("returns the original range when there is no overlap", () => {
      const ranges: VisibleRange[] = [{ start: 0, end: 2 }];
      expect(removeRange(ranges, 5, 7)).toEqual([{ start: 0, end: 2 }]);
    });

    it("removes a range that is fully covered", () => {
      const ranges: VisibleRange[] = [{ start: 0, end: 10 }];
      expect(removeRange(ranges, 0, 10)).toEqual([]);
    });

    it("trims the start when only the first index is covered", () => {
      const ranges: VisibleRange[] = [{ start: 0, end: 10 }];
      expect(removeRange(ranges, 0, 0)).toEqual([{ start: 1, end: 10 }]);
    });

    it("trims the end when only the last index is covered", () => {
      const ranges: VisibleRange[] = [{ start: 0, end: 10 }];
      expect(removeRange(ranges, 10, 10)).toEqual([{ start: 0, end: 9 }]);
    });

    it("splits a covered range", () => {
      const ranges: VisibleRange[] = [{ start: 0, end: 10 }];
      expect(removeRange(ranges, 3, 7)).toEqual([
        { start: 0, end: 2 },
        { start: 8, end: 10 },
      ]);
    });

    it("removes a single index from the middle", () => {
      const ranges: VisibleRange[] = [{ start: 0, end: 10 }];
      expect(removeRange(ranges, 5, 5)).toEqual([
        { start: 0, end: 4 },
        { start: 6, end: 10 },
      ]);
    });

    it("removes across multiple existing ranges", () => {
      const ranges: VisibleRange[] = [
        { start: 0, end: 2 },
        { start: 5, end: 7 },
      ];
      expect(removeRange(ranges, 1, 6)).toEqual([
        { start: 0, end: 0 },
        { start: 7, end: 7 },
      ]);
    });
  });

  describe("findRangeIndex", () => {
    it("returns -1 for an empty array", () => {
      expect(findRangeIndex([], 0)).toBe(-1);
    });

    it("finds the range containing the first and last indices", () => {
      const ranges: VisibleRange[] = [
        { start: 0, end: 2 },
        { start: 5, end: 8 },
      ];
      expect(findRangeIndex(ranges, 0)).toBe(0);
      expect(findRangeIndex(ranges, 2)).toBe(0);
      expect(findRangeIndex(ranges, 5)).toBe(1);
      expect(findRangeIndex(ranges, 8)).toBe(1);
    });

    it("returns -1 for out-of-bounds indices of a single range", () => {
      const ranges: VisibleRange[] = [{ start: 0, end: 2 }];
      expect(findRangeIndex(ranges, -1)).toBe(-1);
      expect(findRangeIndex(ranges, 3)).toBe(-1);
    });

    it("returns -1 for uncovered or out-of-bounds indices", () => {
      const ranges: VisibleRange[] = [
        { start: 0, end: 2 },
        { start: 5, end: 8 },
      ];
      expect(findRangeIndex(ranges, -1)).toBe(-1);
      expect(findRangeIndex(ranges, 4)).toBe(-1);
      expect(findRangeIndex(ranges, 9)).toBe(-1);
    });
  });

  describe("getVisibleIndexAtFlatIndex", () => {
    it("returns -1 for an empty array", () => {
      expect(getVisibleIndexAtFlatIndex([], 0)).toBe(-1);
    });

    it("maps the first and last flat indices of each range", () => {
      const ranges: VisibleRange[] = [
        { start: 0, end: 2 },
        { start: 5, end: 7 },
      ];
      expect(getVisibleIndexAtFlatIndex(ranges, 0)).toBe(0);
      expect(getVisibleIndexAtFlatIndex(ranges, 2)).toBe(2);
      expect(getVisibleIndexAtFlatIndex(ranges, 5)).toBe(3);
      expect(getVisibleIndexAtFlatIndex(ranges, 7)).toBe(5);
    });

    it("returns -1 for uncovered or out-of-bounds flat indices", () => {
      const ranges: VisibleRange[] = [
        { start: 0, end: 2 },
        { start: 5, end: 7 },
      ];
      expect(getVisibleIndexAtFlatIndex(ranges, 4)).toBe(-1);
      expect(getVisibleIndexAtFlatIndex(ranges, 99)).toBe(-1);
    });
  });

  describe("getFlatIndexAtVisibleIndex", () => {
    it("returns -1 for an empty array", () => {
      expect(getFlatIndexAtVisibleIndex([], 0)).toBe(-1);
    });

    it("maps the first and last visible indices of each range", () => {
      const ranges: VisibleRange[] = [
        { start: 0, end: 2 },
        { start: 5, end: 7 },
      ];
      expect(getFlatIndexAtVisibleIndex(ranges, 0)).toBe(0);
      expect(getFlatIndexAtVisibleIndex(ranges, 2)).toBe(2);
      expect(getFlatIndexAtVisibleIndex(ranges, 3)).toBe(5);
      expect(getFlatIndexAtVisibleIndex(ranges, 5)).toBe(7);
    });

    it("returns -1 for out-of-bounds visible indices", () => {
      const ranges: VisibleRange[] = [
        { start: 0, end: 2 },
        { start: 5, end: 7 },
      ];
      expect(getFlatIndexAtVisibleIndex(ranges, -1)).toBe(-1);
      expect(getFlatIndexAtVisibleIndex(ranges, 99)).toBe(-1);
    });
  });

  describe("getVisibleCount", () => {
    it("returns 0 for an empty array", () => {
      expect(getVisibleCount([])).toBe(0);
    });

    it("accumulates sizes across multiple ranges", () => {
      const ranges: VisibleRange[] = [
        { start: 0, end: 2 },
        { start: 5, end: 7 },
      ];
      expect(getVisibleCount(ranges)).toBe(6);
    });
  });
});
