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
  columnX: readonly [number, number, number, number];
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
  nodeGap: 18,
  columnX: [72, 398, 724, 1030],
};

/** Shared Sankey geometry for the live chart, PNG export, and public artwork. */
export function buildJobSankeyLayout(
  data: JobSankeyData,
  options: JobSankeyLayoutOptions = DEFAULT_JOB_SANKEY_LAYOUT,
) {
  const columns = [0, 1, 2, 3].map((column) => data.nodes.filter((node) => node.column === column));
  const largestGapCount = Math.max(0, ...columns.map((nodes) => nodes.length - 1));
  const scale = data.total
    ? (options.chartHeight - largestGapCount * options.nodeGap) / data.total
    : 0;
  const nodes: PositionedJobSankeyNode[] = [];

  columns.forEach((columnNodes, column) => {
    const contentHeight =
      columnNodes.reduce((sum, node) => sum + node.count * scale, 0) +
      Math.max(0, columnNodes.length - 1) * options.nodeGap;
    let y = options.chartTop + (options.chartHeight - contentHeight) / 2;
    columnNodes.forEach((node) => {
      const height = node.count * scale;
      nodes.push({ ...node, x: options.columnX[column], y, width: options.nodeWidth, height });
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

  return { ...options, nodes, links };
}
