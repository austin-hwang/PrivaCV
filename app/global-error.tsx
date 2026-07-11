"use client";

import { useEffect } from "react";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  useEffect(() => {
    console.error("Resume Editor global error", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f4f5f7", color: "#20242a", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: "24px" }}>
          <section style={{ width: "100%", maxWidth: "448px", border: "1px solid #d6d9de", borderRadius: "12px", background: "#fff", padding: "32px", boxShadow: "0 1px 4px rgb(0 0 0 / 12%)" }} aria-labelledby="global-error-title">
            <p style={{ margin: 0, color: "#5e6670", fontSize: "12px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>Resume Editor</p>
            <h1 id="global-error-title" style={{ margin: "12px 0 0", fontSize: "24px" }}>The editor needs a refresh.</h1>
            <p style={{ margin: "12px 0 0", color: "#5e6670", fontSize: "14px", lineHeight: 1.55 }}>
              Something unexpected interrupted this page. Your saved resume data stays in this browser. Try again to continue.
            </p>
            <button type="button" onClick={reset} style={{ marginTop: "24px", minHeight: "36px", border: 0, borderRadius: "6px", background: "#28303d", color: "#fff", cursor: "pointer", padding: "8px 16px", fontSize: "14px", fontWeight: 600 }}>
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
