import { ImageResponse } from "next/og";
import { RESUME_TEMPLATES, type ResumeTemplateId } from "@/lib/resume";

const styles: Record<ResumeTemplateId, { accent: string; font: string; align: "left" | "center"; heading: "rule" | "bar" | "underline"; dense?: boolean }> = {
  classic: { accent: "#1f2937", font: "Georgia", align: "left", heading: "rule" },
  minimal: { accent: "#334155", font: "Arial", align: "left", heading: "underline" },
  modern: { accent: "#1f3a5f", font: "Arial", align: "center", heading: "bar" },
  compact: { accent: "#334155", font: "Arial", align: "left", heading: "underline", dense: true },
  executive: { accent: "#7f1d3a", font: "Georgia", align: "center", heading: "rule" },
  technical: { accent: "#0f5f5c", font: "Arial", align: "left", heading: "rule", dense: true },
};

function SectionHeading({ label, style }: { label: string; style: (typeof styles)[ResumeTemplateId] }) {
  if (style.heading === "bar") {
    return <div style={{ background: style.accent, color: "#fff", display: "flex", fontSize: 17, fontWeight: 800, letterSpacing: 1.5, marginTop: 27, padding: "8px 11px", textTransform: "uppercase", width: "100%" }}>{label}</div>;
  }
  return (
    <div style={{ borderBottom: `${style.heading === "underline" ? 2 : 4}px solid ${style.accent}`, color: style.accent, display: "flex", fontSize: 17, fontWeight: 800, letterSpacing: 1.5, marginTop: 27, paddingBottom: 7, textTransform: "uppercase", width: "100%" }}>{label}</div>
  );
}

function TextLine({ width = "100%", height = 7 }: { width?: string; height?: number }) {
  return <div style={{ background: "#d9dee7", borderRadius: 10, display: "flex", height, width }} />;
}

export async function GET(_request: Request, { params }: { params: Promise<{ template: string }> }) {
  const { template: rawTemplate } = await params;
  const id = rawTemplate.replace(/\.png$/, "") as ResumeTemplateId;
  const template = RESUME_TEMPLATES.find((candidate) => candidate.id === id) ?? RESUME_TEMPLATES[0];
  const style = styles[template.id];
  const gap = style.dense ? 8 : 12;

  return new ImageResponse(
    (
      <div style={{ alignItems: "center", background: "#e9edf3", display: "flex", height: "100%", justifyContent: "center", padding: 44, width: "100%" }}>
        <div style={{ background: "#fff", boxShadow: "0 18px 46px rgba(15,23,42,.18)", color: "#111827", display: "flex", flexDirection: "column", fontFamily: style.font, height: 944, padding: style.dense ? "52px 58px" : "62px 66px", width: 690 }}>
          <div style={{ alignItems: style.align === "center" ? "center" : "flex-start", display: "flex", flexDirection: "column", width: "100%" }}>
            <div style={{ color: style.accent, display: "flex", fontSize: 37, fontWeight: 800, letterSpacing: -.5 }}>Jordan Lee</div>
            <div style={{ color: "#475569", display: "flex", fontSize: 18, marginTop: 7 }}>Senior Product Designer</div>
            <div style={{ color: "#64748b", display: "flex", fontFamily: "Arial", fontSize: 13, marginTop: 10 }}>Seattle, WA · jordan@example.com · portfolio.example</div>
          </div>

          <SectionHeading label="Summary" style={style} />
          <div style={{ display: "flex", flexDirection: "column", gap, marginTop: 15 }}><TextLine /><TextLine width="93%" /><TextLine width="71%" /></div>

          <SectionHeading label="Experience" style={style} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 17 }}><div style={{ display: "flex", fontSize: 17, fontWeight: 800 }}>Senior Product Designer</div><div style={{ color: "#64748b", display: "flex", fontFamily: "Arial", fontSize: 13 }}>2022 — Present</div></div>
          <div style={{ color: "#475569", display: "flex", fontSize: 14, marginTop: 5 }}>Northstar Labs</div>
          <div style={{ display: "flex", flexDirection: "column", gap, marginTop: 14 }}><TextLine width="96%" /><TextLine width="88%" /><TextLine width="91%" /></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 21 }}><div style={{ display: "flex", fontSize: 17, fontWeight: 800 }}>Product Designer</div><div style={{ color: "#64748b", display: "flex", fontFamily: "Arial", fontSize: 13 }}>2019 — 2022</div></div>
          <div style={{ color: "#475569", display: "flex", fontSize: 14, marginTop: 5 }}>Brightworks</div>
          <div style={{ display: "flex", flexDirection: "column", gap, marginTop: 14 }}><TextLine width="94%" /><TextLine width="82%" /></div>

          <SectionHeading label="Skills" style={style} />
          <div style={{ display: "flex", gap: 14, marginTop: 17 }}><TextLine width="28%" height={10} /><TextLine width="21%" height={10} /><TextLine width="31%" height={10} /></div>
          <div style={{ color: "#64748b", display: "flex", fontFamily: "Arial", fontSize: 13, marginTop: "auto" }}>{template.label} · ATS-friendly single-column template</div>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 1040,
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    },
  );
}
