// geometry for the stacked bar card: columns across the width, each a stack of segments rising from the baseline

export interface StackedPoint {
  // the full label read in the tooltip ("Oct 11", "Oct 5 to 11") and the short one under the axis
  label: string;
  short: string;
  values: number[];
}

export interface StackedSegment {
  bottom: number;
  height: number;
}

export interface StackedColumn {
  left: number;
  width: number;
  top: number;
  total: number;
  segments: StackedSegment[];
}

// segments keep a hairline of air between them, and a stack never draws thinner than a visible sliver
const SEGMENT_GAP = 2;
const MIN_SEGMENT = 2;
const MIN_BAR_WIDTH = 3;

export function stackedColumns(points: StackedPoint[], width: number, height: number, gap: number): StackedColumn[] {
  const count = points.length;
  if (count === 0 || width <= 0) return [];
  // the gap gives way before a bar gets thinner than 3 px, so a long range still draws
  const actualGap = count === 1 ? 0 : Math.max(1, Math.min(gap, (width - MIN_BAR_WIDTH * count) / (count - 1)));
  const barWidth = (width - actualGap * (count - 1)) / count;
  const totals = points.map(point => point.values.reduce((sum, value) => sum + value, 0));
  const maxTotal = Math.max(1, ...totals);
  const segmentCount = Math.max(1, ...points.map(point => point.values.length));
  const scale = (height - SEGMENT_GAP * (segmentCount - 1)) / maxTotal;
  return points.map((point, index) => {
    let bottom = 0;
    const segments = point.values.map(value => {
      const segmentHeight = value > 0 ? Math.max(MIN_SEGMENT, value * scale) : 0;
      const segment = { bottom, height: segmentHeight };
      if (segmentHeight > 0) bottom += segmentHeight + SEGMENT_GAP;
      return segment;
    });
    return {
      left: index * (barWidth + actualGap),
      width: barWidth,
      top: Math.max(0, bottom - SEGMENT_GAP),
      total: totals[index],
      segments,
    };
  });
}

// the tooltip sits right of the column while it fits, otherwise left of it, and never past either edge
export function tooltipLeft(column: StackedColumn, width: number, tipWidth: number, offset = 8): number {
  const right = column.left + column.width + offset;
  if (right + tipWidth <= width) return right;
  const left = column.left - offset - tipWidth;
  return left >= 0 ? left : Math.max(0, Math.min(width - tipWidth, right));
}
