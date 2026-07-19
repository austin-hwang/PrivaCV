import { ImageResponse } from "next/og";

type SocialCard = {
  eyebrow: string;
  title: string;
  detail: string;
  accent: string;
  visual: "editor" | "ats" | "templates" | "convert" | "text" | "compare" | "guide" | "privacy";
};

const cards: Record<string, SocialCard> = {
  home: {
    eyebrow: "Free · private · no sign-up",
    title: "Build a resume without handing it over",
    detail: "Local editing · PDF & Word export · ATS review",
    accent: "#60a5fa",
    visual: "editor",
  },
  "free-resume-builder": {
    eyebrow: "No account · no watermark · no paywall",
    title: "A resume builder that stays free",
    detail: "Import, edit, tailor, and export on your device",
    accent: "#60a5fa",
    visual: "editor",
  },
  "ats-resume-checker": {
    eyebrow: "Free ATS resume checker",
    title: "See the exact text an ATS reads",
    detail: "Catch contact, structure, density, and evidence issues",
    accent: "#34d399",
    visual: "ats",
  },
  "resume-templates": {
    eyebrow: "Six free ATS-friendly templates",
    title: "Clean layouts. Your content stays readable.",
    detail: "Customize type, spacing, headings, and color",
    accent: "#a78bfa",
    visual: "templates",
  },
  "pdf-to-docx-resume": {
    eyebrow: "Free · private · browser-only",
    title: "Turn a PDF resume into editable Word",
    detail: "Import locally, review each field, export DOCX",
    accent: "#f59e0b",
    visual: "convert",
  },
  "plain-text-resume": {
    eyebrow: "Plain-text resume builder",
    title: "Preview what application systems receive",
    detail: "Copy clean text or download a .txt file",
    accent: "#22d3ee",
    visual: "text",
  },
  "resume-builder-comparison": {
    eyebrow: "Price · privacy · exports · ATS output",
    title: "Free and paid resume builders compared",
    detail: "PrivaCV, Zety, Resume.io, Teal, Rezi, and Canva",
    accent: "#fb7185",
    visual: "compare",
  },
  "resume-guides": {
    eyebrow: "Practical resume guidance",
    title: "Clear advice without ATS folklore",
    detail: "Formatting, tailoring, file types, and final checks",
    accent: "#818cf8",
    visual: "guide",
  },
  "ats-friendly-resume": {
    eyebrow: "Seven formatting rules that work",
    title: "Make your resume easy for an ATS to read",
    detail: "A practical checklist for layout, keywords, and files",
    accent: "#34d399",
    visual: "guide",
  },
  about: {
    eyebrow: "Private by design",
    title: "Resume editing that stays in your browser",
    detail: "No account, subscription, watermark, or resume database",
    accent: "#60a5fa",
    visual: "editor",
  },
  privacy: {
    eyebrow: "Privacy in plain language",
    title: "Your resume stays on your device",
    detail: "Local imports, editing, history, AI, and exports",
    accent: "#34d399",
    visual: "privacy",
  },
};

function Line({ width = "100%", accent = false }: { width?: string; accent?: boolean }) {
  return <div style={{ background: accent ? "#60a5fa" : "#d8dee8", borderRadius: 8, display: "flex", height: accent ? 7 : 5, width }} />;
}

function CheckIcon({ size = 32 }: { size?: number }) {
  return (
    <div style={{ alignItems: "center", background: "#dcfce7", borderRadius: 99, display: "flex", height: size, justifyContent: "center", width: size }}>
      <div style={{ borderBottom: "3px solid #15803d", borderLeft: "3px solid #15803d", display: "flex", height: size * .28, transform: "rotate(-45deg) translateY(-1px)", width: size * .5 }} />
    </div>
  );
}

function ResumePage({ accent }: { accent: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 22px 55px rgba(0,0,0,.28)", color: "#111827", display: "flex", flexDirection: "column", height: 470, padding: "38px 42px", width: 360 }}>
      <div style={{ display: "flex", fontSize: 28, fontWeight: 800 }}>Jordan Lee</div>
      <div style={{ color: "#475569", display: "flex", fontSize: 14, marginTop: 7 }}>Product Designer · Seattle, WA</div>
      <div style={{ background: accent, display: "flex", height: 5, marginTop: 22, width: "100%" }} />
      <div style={{ color: accent, display: "flex", fontSize: 13, fontWeight: 800, letterSpacing: 1.5, marginTop: 24 }}>EXPERIENCE</div>
      <div style={{ display: "flex", fontSize: 15, fontWeight: 700, marginTop: 14 }}>Senior Product Designer</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        <Line width="92%" /><Line width="82%" /><Line width="88%" />
      </div>
      <div style={{ color: accent, display: "flex", fontSize: 13, fontWeight: 800, letterSpacing: 1.5, marginTop: 28 }}>PROJECTS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        <Line width="96%" /><Line width="76%" /><Line width="86%" />
      </div>
      <div style={{ color: accent, display: "flex", fontSize: 13, fontWeight: 800, letterSpacing: 1.5, marginTop: 28 }}>SKILLS</div>
      <div style={{ display: "flex", gap: 9, marginTop: 12 }}><Line width="28%" accent /><Line width="23%" accent /><Line width="31%" accent /></div>
    </div>
  );
}

function FeatureVisual({ card }: { card: SocialCard }) {
  if (card.visual === "editor") {
    return (
      <div style={{ display: "flex", position: "relative", width: 430 }}>
        <div style={{ background: "#252a35", border: "1px solid #3b4352", borderRadius: 14, display: "flex", flexDirection: "column", gap: 15, height: 380, marginTop: 45, padding: 25, width: 205 }}>
          <div style={{ color: "#f8fafc", display: "flex", fontSize: 16, fontWeight: 700 }}>Resume editor</div>
          <Line width="85%" /><Line width="100%" /><Line width="72%" />
          <div style={{ background: card.accent, borderRadius: 7, display: "flex", height: 34, marginTop: 5, width: 118 }} />
          <Line width="92%" /><Line width="78%" /><Line width="98%" /><Line width="66%" />
        </div>
        <div style={{ display: "flex", marginLeft: -28 }}><ResumePage accent={card.accent} /></div>
      </div>
    );
  }

  if (card.visual === "templates") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, height: 450, width: 430 }}>
        {["#1f3a5f", "#7f1d3a", "#0f5f5c", "#334155"].map((accent, index) => (
          <div key={accent} style={{ background: "#fff", borderRadius: 8, display: "flex", flexDirection: "column", height: 210, padding: 20, width: 196 }}>
            <div style={{ color: "#111827", display: "flex", fontFamily: index % 2 ? "Georgia" : "Arial", fontSize: 15, fontWeight: 700 }}>{["Classic", "Executive", "Technical", "Minimal"][index]}</div>
            <div style={{ background: accent, display: "flex", height: 4, marginTop: 12, width: "100%" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}><Line /><Line width="80%" /><Line width="92%" /><Line width="65%" /></div>
          </div>
        ))}
      </div>
    );
  }

  if (card.visual === "convert") {
    return (
      <div style={{ alignItems: "center", display: "flex", gap: 24, width: 430 }}>
        {[["PDF", "#ef4444"], ["DOCX", "#2563eb"]].map(([label, color], index) => (
          <div key={label} style={{ alignItems: "center", background: "#fff", borderRadius: 16, boxShadow: "0 22px 55px rgba(0,0,0,.25)", color, display: "flex", flexDirection: "column", fontSize: 24, fontWeight: 800, height: 280, justifyContent: "center", width: 165 }}>
            <div style={{ border: `5px solid ${color}`, borderRadius: 10, display: "flex", padding: "16px 12px" }}>{label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 28, width: 105 }}><Line /><Line width="85%" /><Line width="92%" /></div>
            {index === 0 ? <div style={{ color: "#f8fafc", display: "flex", fontSize: 38, position: "absolute", transform: "translateX(106px)" }}>→</div> : null}
          </div>
        ))}
      </div>
    );
  }

  if (card.visual === "compare") {
    return (
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 22px 55px rgba(0,0,0,.25)", color: "#111827", display: "flex", flexDirection: "column", padding: 28, width: 430 }}>
        {["Free export", "No account", "Local privacy", "Word export", "ATS output"].map((label, index) => (
          <div key={label} style={{ alignItems: "center", borderBottom: index === 4 ? "0" : "1px solid #e5e7eb", display: "flex", fontSize: 15, justifyContent: "space-between", padding: "14px 0" }}>
            <div style={{ display: "flex" }}>{label}</div><CheckIcon size={27} />
          </div>
        ))}
      </div>
    );
  }

  if (card.visual === "ats" || card.visual === "guide" || card.visual === "privacy") {
    const labels = card.visual === "privacy"
      ? ["Resume text stays local", "No account identifier", "Local AI is optional", "Exports happen on-device"]
      : card.visual === "guide"
        ? ["Use one column", "Keep headings standard", "Write selectable text", "Check the plain-text result"]
        : ["Contact details found", "Sections read in order", "Bullets parsed cleanly", "Evidence review ready"];
    return (
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 22px 55px rgba(0,0,0,.25)", color: "#111827", display: "flex", flexDirection: "column", gap: 18, padding: 32, width: 430 }}>
        {labels.map((label) => <div key={label} style={{ alignItems: "center", display: "flex", fontSize: 18, gap: 14 }}><CheckIcon /><div style={{ display: "flex" }}>{label}</div></div>)}
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 22px 55px rgba(0,0,0,.25)", color: "#334155", display: "flex", flexDirection: "column", fontFamily: "monospace", fontSize: 17, gap: 14, padding: 34, width: 430 }}>
      {["JORDAN LEE", "PRODUCT DESIGNER", "", "EXPERIENCE", "Senior Product Designer", "Improved activation by 24%", "", "SKILLS", "Research · Prototyping · UX"].map((line, index) => <div key={index} style={{ display: "flex", minHeight: 8 }}>{line}</div>)}
    </div>
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = cards[slug] ?? cards.home;

  return new ImageResponse(
    (
      <div style={{ alignItems: "center", background: "#16181d", color: "#f8fafc", display: "flex", height: "100%", justifyContent: "space-between", padding: "60px 68px", width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 600 }}>
          <div style={{ alignItems: "center", display: "flex", gap: 14 }}>
            <div style={{ alignItems: "center", background: "#2563eb", borderRadius: 12, display: "flex", fontSize: 24, fontWeight: 900, height: 48, justifyContent: "center", width: 48 }}>P</div>
            <div style={{ display: "flex", fontSize: 27, fontWeight: 800 }}>PrivaCV</div>
          </div>
          <div style={{ color: card.accent, display: "flex", fontSize: 22, fontWeight: 800, letterSpacing: 1.6, marginTop: 56, textTransform: "uppercase" }}>{card.eyebrow}</div>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 800, letterSpacing: -2.2, lineHeight: 1.08, marginTop: 20 }}>{card.title}</div>
          <div style={{ color: "#cbd5e1", display: "flex", fontSize: 23, lineHeight: 1.35, marginTop: 26 }}>{card.detail}</div>
        </div>
        <FeatureVisual card={card} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    },
  );
}
