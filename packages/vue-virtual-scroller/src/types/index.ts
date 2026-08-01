export interface VirtualScrollerProps {
  totalCount: number;
  itemSize: number;
  buffer?: number;
  height?: number | string;
}

export interface VirtualScrollerExpose {
  scrollToIndex: (index: number, align?: "start" | "center" | "end") => void;
  getScrollTop: () => number;
}
