export interface VisibleRange {
  start: number;
  end: number;
}

export function insertRange(ranges: VisibleRange[], start: number, end: number): VisibleRange[] {
  if (ranges.length === 0) return [{ start, end }];

  const result: VisibleRange[] = [];
  let newStart = start;
  let newEnd = end;
  let inserted = false;

  for (const range of ranges) {
    if (range.end < newStart - 1) {
      result.push(range);
    } else if (range.start > newEnd + 1) {
      if (!inserted) {
        result.push({ start: newStart, end: newEnd });
        inserted = true;
      }
      result.push(range);
    } else {
      newStart = Math.min(newStart, range.start);
      newEnd = Math.max(newEnd, range.end);
    }
  }

  if (!inserted) {
    result.push({ start: newStart, end: newEnd });
  }

  return result;
}

export function removeRange(ranges: VisibleRange[], start: number, end: number): VisibleRange[] {
  const result: VisibleRange[] = [];
  for (const range of ranges) {
    if (range.end < start || range.start > end) {
      result.push(range);
      continue;
    }
    if (range.start < start) {
      result.push({ start: range.start, end: start - 1 });
    }
    if (range.end > end) {
      result.push({ start: end + 1, end: range.end });
    }
  }
  return result;
}

export function findRangeIndex(ranges: VisibleRange[], flatIndex: number): number {
  let left = 0;
  let right = ranges.length - 1;
  while (left <= right) {
    const mid = (left + right) >>> 1;
    const range = ranges[mid];
    if (flatIndex >= range.start && flatIndex <= range.end) return mid;
    if (flatIndex < range.start) right = mid - 1;
    else left = mid + 1;
  }
  return -1;
}

export function getVisibleIndexAtFlatIndex(ranges: VisibleRange[], flatIndex: number): number {
  const idx = findRangeIndex(ranges, flatIndex);
  if (idx < 0) return -1;
  let count = 0;
  for (let i = 0; i < idx; i++) {
    count += ranges[i].end - ranges[i].start + 1;
  }
  return count + (flatIndex - ranges[idx].start);
}

export function getFlatIndexAtVisibleIndex(ranges: VisibleRange[], visibleIndex: number): number {
  let count = 0;
  for (const range of ranges) {
    const size = range.end - range.start + 1;
    if (visibleIndex < count + size) {
      return range.start + (visibleIndex - count);
    }
    count += size;
  }
  return -1;
}

export function getVisibleCount(ranges: VisibleRange[]): number {
  return ranges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
}
