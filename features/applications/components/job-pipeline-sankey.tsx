"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JobSankeyData } from "@/lib/job-application-sankey";
import { buildJobSankeyLayout, DEFAULT_JOB_SANKEY_LAYOUT } from "@/lib/job-sankey-layout";

const { width: VIEW_WIDTH, height: VIEW_HEIGHT } = DEFAULT_JOB_SANKEY_LAYOUT;

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function svgToPng(svg: SVGSVGElement, fileName: string) {
  const source = new XMLSerializer().serializeToString(svg);
  const svgUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The Sankey image could not be rendered."));
      image.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = VIEW_WIDTH * 2;
    canvas.height = VIEW_HEIGHT * 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image export is unavailable in this browser.");
    context.scale(2, 2);
    context.drawImage(image, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error("The Sankey image could not be encoded.")),
        "image/png",
      );
    });
    downloadBlob(blob, fileName);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export function JobPipelineSankey({
  data,
  onExport,
}: {
  data: JobSankeyData;
  onExport: (result: { ok: boolean; message: string }) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [exporting, setExporting] = useState(false);
  const layout = useMemo(() => buildJobSankeyLayout(data), [data]);
  const date = new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const saveImage = async () => {
    if (!svgRef.current || !data.total || exporting) return;
    setExporting(true);
    try {
      await svgToPng(
        svgRef.current,
        `privacv-job-search-sankey-${new Date().toISOString().slice(0, 10)}.png`,
      );
      onExport({ ok: true, message: "Sankey image downloaded" });
    } catch (error) {
      onExport({
        ok: false,
        message: error instanceof Error ? error.message : "The Sankey image could not be saved.",
      });
    } finally {
      setExporting(false);
    }
  };

  if (!data.total) {
    return (
      <div className="flex min-h-112 flex-col items-center justify-center px-6 text-center">
        <h2 className="text-lg font-semibold">No submitted applications to chart yet</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Move an opportunity to Applied or a later stage. Saved and Preparing roles are
          intentionally left out of the job-search flow.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold">Job search Sankey</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Flows are reconstructed from recorded application stages. Current filters are reflected.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={saveImage} disabled={exporting}>
          {exporting ? <Loader2 className="animate-spin" /> : <Download />}{" "}
          {exporting ? "Rendering PNG" : "Save as PNG"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-xs">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          width={VIEW_WIDTH}
          height={VIEW_HEIGHT}
          className="h-auto min-w-[760px] w-full"
          role="img"
          aria-labelledby="job-sankey-title job-sankey-description"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title id="job-sankey-title">Job search Sankey diagram</title>
          <desc id="job-sankey-description">
            {data.total} submitted applications flowing through interviews, offers, and outcomes.
          </desc>
          <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="#ffffff" />
          <text
            x="72"
            y="55"
            fill="#0f172a"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="30"
            fontWeight="700"
          >
            My job search
          </text>
          <text
            x="72"
            y="86"
            fill="#475569"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="16"
          >
            {data.total} submitted {data.total === 1 ? "application" : "applications"} · {date}
          </text>
          <text
            x="1128"
            y="55"
            textAnchor="end"
            fill="#2563eb"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="17"
            fontWeight="700"
          >
            PrivaCV
          </text>
          <text
            x="1128"
            y="82"
            textAnchor="end"
            fill="#64748b"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="13"
          >
            Private job search tracker
          </text>

          {layout.links.map((link) => (
            <path
              key={`${link.source}-${link.target}`}
              d={link.path}
              fill={link.color}
              fillOpacity="0.25"
              stroke={link.color}
              strokeOpacity="0.1"
            >
              <title>
                {link.value} {link.value === 1 ? "application" : "applications"}: {link.source} to{" "}
                {link.target}
              </title>
            </path>
          ))}
          {layout.nodes.map((node) => {
            const percentage = Math.round((node.count / data.total) * 100);
            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx="4"
                  fill={node.color}
                />
                <text
                  x={node.column === 3 ? node.x - 10 : node.x + node.width + 10}
                  y={node.y + node.height / 2}
                  textAnchor={node.column === 3 ? "end" : "start"}
                  dominantBaseline="middle"
                  fill="#0f172a"
                  stroke="#ffffff"
                  strokeWidth="5"
                  paintOrder="stroke"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fontSize="14"
                  fontWeight="600"
                >
                  {node.label}
                  <tspan dx="6" fill="#475569" fontWeight="500">
                    {node.count} · {percentage}%
                  </tspan>
                </text>
              </g>
            );
          })}
          <line x1="72" x2="1128" y1="620" y2="620" stroke="#e2e8f0" />
          <text
            x="72"
            y="650"
            fill="#64748b"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="13"
          >
            {data.excluded
              ? `${data.excluded} ${data.excluded === 1 ? "role" : "roles"} still in Saved or Preparing ${data.excluded === 1 ? "was" : "were"} not included.`
              : "All tracked roles shown have reached Applied or a later stage."}
          </text>
        </svg>
      </div>

      <ul className="sr-only">
        {data.nodes.map((node) => (
          <li key={node.id}>
            {node.label}: {node.count}
          </li>
        ))}
      </ul>
    </div>
  );
}
