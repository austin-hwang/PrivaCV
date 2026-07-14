import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#16181d",
          color: "#f4f5f7",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          padding: "76px",
          width: "100%",
        }}
      >
        <div style={{ color: "#9cc4ff", fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>Private by design</div>
        <div style={{ fontSize: 80, fontWeight: 700, letterSpacing: -3, marginTop: 22 }}>PrivaCV</div>
        <div style={{ fontSize: 38, lineHeight: 1.25, marginTop: 22, maxWidth: 900 }}>A private, ATS-friendly resume editor that works in your browser.</div>
        <div style={{ color: "#c8cdd6", display: "flex", fontSize: 25, gap: 28, marginTop: 44 }}>
          <span>No account</span><span>•</span><span>Local editing</span><span>•</span><span>PDF & DOCX export</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
