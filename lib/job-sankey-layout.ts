import type {
  JobSankeyData,
  JobSankeyLink,
  JobSankeyNode,
  JobSankeyNodeId,
} from "@/lib/job-application-sankey";

export type JobSankeyLayoutOptions = {
  width: number;
  height: number;
  chartTop: number;
  chartHeight: number;
  nodeWidth: number;
  nodeGap: number;
  /** Left/right x of the first and last columns; inner columns are spaced evenly. */
  columnLeft: number;
  columnRight: number;
  /**
   * Minimum horizontal gap between columns. When a deep funnel would compress
   * columns below this, the canvas widens instead so labels stay legible.
   */
  columnGap?: number;
  /** Smallest node height, so single-application outcomes stay visible. */
  minNodeHeight?: number;
};

export type PositionedJobSankeyNode = JobSankeyNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PositionedJobSankeyLink = JobSankeyLink & {
  color: string;
  path: string;
  sourceX: number;
  sourceTop: number;
  targetX: number;
  targetTop: number;
  thickness: number;
};

export const DEFAULT_JOB_SANKEY_LAYOUT: JobSankeyLayoutOptions = {
  width: 1200,
  height: 680,
  chartTop: 142,
  chartHeight: 430,
  nodeWidth: 22,
  nodeGap: 28,
  columnLeft: 110,
  // Edge labels use the outer margins; intermediate labels sit below their
  // nodes so even a six-round funnel can stay on the original compact canvas.
  columnRight: 1010,
  columnGap: 0,
  minNodeHeight: 5,
};

/**
 * Shared Sankey geometry for the live chart, PNG export, and public artwork.
 * The returned `width`/`height` are authoritative for rendering and export.
 */
export function buildJobSankeyLayout(
  data: JobSankeyData,
  options: JobSankeyLayoutOptions = DEFAULT_JOB_SANKEY_LAYOUT,
) {
  const maxColumn = Math.max(0, data.maxColumn);
  const rightMargin = options.width - options.columnRight;
  const evenSpacing = maxColumn === 0 ? 0 : (options.columnRight - options.columnLeft) / maxColumn;
  // Custom artwork can request a minimum gap, but the default layout divides
  // the fixed canvas evenly and places intermediate labels below their nodes.
  const spacing = Math.max(evenSpacing, options.columnGap ?? 0);
  const columnRight = options.columnLeft + spacing * maxColumn;
  const width = columnRight + rightMargin;
  const columnX = (column: number) => options.columnLeft + spacing * column;
  const minNodeHeight = options.minNodeHeight ?? 0;
  const columns = Array.from({ length: maxColumn + 1 }, (_unused, column) =>
    data.nodes.filter((node) => node.column === column),
  );
  const largestGapCount = Math.max(0, ...columns.map((nodes) => nodes.length - 1));
  const scale = data.total
    ? (options.chartHeight - largestGapCount * options.nodeGap) / data.total
    : 0;
  const nodeHeight = (count: number) => (count > 0 ? Math.max(count * scale, minNodeHeight) : 0);
  const nodes: PositionedJobSankeyNode[] = [];

  // Stack dead-end outcomes before continuing round/offer nodes. This groups
  // exit branches together and reduces ribbon crossings between phases.
  const sourceIds = new Set(data.links.map((link) => link.source));
  columns.forEach((columnNodes) =>
    columnNodes.sort((left, right) => {
      const sourceOrder = (sourceIds.has(left.id) ? 1 : 0) - (sourceIds.has(right.id) ? 1 : 0);
      return sourceOrder || right.count - left.count || left.label.localeCompare(right.label);
    }),
  );

  // The source node establishes a shared lower baseline. Rounds and Offers sit
  // on that baseline, producing the compact descending staircase seen in
  // traditional job-search Sankeys as the surviving cohort gets smaller.
  const sourceHeight = nodeHeight(data.total);
  const processBottom = options.chartTop + (options.chartHeight + sourceHeight) / 2;

  columns.forEach((columnNodes, column) => {
    const contentHeight =
      columnNodes.reduce((sum, node) => sum + nodeHeight(node.count), 0) +
      Math.max(0, columnNodes.length - 1) * options.nodeGap;
    let y =
      column > 0 && column < maxColumn && columnNodes.length === 1
        ? processBottom - nodeHeight(columnNodes[0].count)
        : options.chartTop + (options.chartHeight - contentHeight) / 2;
    columnNodes.forEach((node) => {
      const height = nodeHeight(node.count);
      nodes.push({ ...node, x: columnX(column), y, width: options.nodeWidth, height });
      y += height + options.nodeGap;
    });
  });

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const outgoingTotals = new Map<JobSankeyNodeId, number>();
  const incomingTotals = new Map<JobSankeyNodeId, number>();
  data.links.forEach((link) => {
    outgoingTotals.set(link.source, (outgoingTotals.get(link.source) ?? 0) + link.value);
    incomingTotals.set(link.target, (incomingTotals.get(link.target) ?? 0) + link.value);
  });
  const sourceOffsets = new Map<JobSankeyNodeId, number>();
  const targetOffsets = new Map<JobSankeyNodeId, number>();
  nodes.forEach((node) => {
    sourceOffsets.set(
      node.id,
      Math.max(0, (node.height - (outgoingTotals.get(node.id) ?? 0) * scale) / 2),
    );
    targetOffsets.set(
      node.id,
      Math.max(0, (node.height - (incomingTotals.get(node.id) ?? 0) * scale) / 2),
    );
  });

  const links = [...data.links]
    .sort((left, right) => {
      const leftSource = byId.get(left.source);
      const rightSource = byId.get(right.source);
      const leftTarget = byId.get(left.target);
      const rightTarget = byId.get(right.target);
      return (
        (leftSource?.column ?? 0) - (rightSource?.column ?? 0) ||
        (leftSource?.y ?? 0) - (rightSource?.y ?? 0) ||
        (leftTarget?.y ?? 0) - (rightTarget?.y ?? 0)
      );
    })
    .flatMap<PositionedJobSankeyLink>((link) => {
      const source = byId.get(link.source);
      const target = byId.get(link.target);
      if (!source || !target) return [];
      const thickness = link.value * scale;
      const sourceOffset = sourceOffsets.get(source.id) ?? 0;
      const targetOffset = targetOffsets.get(target.id) ?? 0;
      const sourceTop = source.y + sourceOffset;
      const targetTop = target.y + targetOffset;
      sourceOffsets.set(source.id, sourceOffset + thickness);
      targetOffsets.set(target.id, targetOffset + thickness);
      const sourceX = source.x + source.width;
      const targetX = target.x;
      const curveX = sourceX + (targetX - sourceX) * 0.5;
      return [
        {
          ...link,
          color: target.color,
          sourceX,
          sourceTop,
          targetX,
          targetTop,
          thickness,
          path: [
            `M ${sourceX} ${sourceTop}`,
            `C ${curveX} ${sourceTop}, ${curveX} ${targetTop}, ${targetX} ${targetTop}`,
            `L ${targetX} ${targetTop + thickness}`,
            `C ${curveX} ${targetTop + thickness}, ${curveX} ${sourceTop + thickness}, ${sourceX} ${sourceTop + thickness}`,
            "Z",
          ].join(" "),
        },
      ];
    });

  return { ...options, width, columnRight, nodes, links };
}
