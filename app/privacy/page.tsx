import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { createPageMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "Privacy",
  description:
    "See what PrivaCV keeps on your device, how optional device handoff works, what anonymous web metrics contain, and when local AI downloads occur.",
  path: "/privacy",
  socialImage: "privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-medium text-primary">How {SITE_NAME} handles your data</p>
        <h1 className="mt-4 font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Privacy, in plain language
        </h1>
        <div className="mt-10 grid gap-8 text-base leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-foreground">
              Your resume and job search stay on your device
            </h2>
            <p className="mt-3">
              PrivaCV runs as a local-first editor. Resume drafts, saved versions, applications,
              notes, timeline events, job descriptions, and submitted-resume snapshots are stored in
              IndexedDB in your browser profile or the desktop app&apos;s Electron profile. PrivaCV
              does not require an account or upload this information to a PrivaCV server. The
              website and desktop app use separate profiles, so use a JSON backup to move data
              between them.
            </p>
            <p className="mt-3">
              Resume edits also use local browser storage for a temporary recovery copy until a save
              completes. Compatibility copies may remain for older versions of the editor. Delete
              all data removes these copies along with your workspace.
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">Files you choose to import</h2>
            <p className="mt-3">
              PDF, DOCX, JSON, and pasted resume content are used by the editor on your device.
              Review imported content before exporting because document formats can contain layout
              artifacts that need correction.
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">Optional local AI</h2>
            <p className="mt-3">
              If you explicitly prepare a local AI model, PrivaCV downloads model files from the
              listed model hosts into the current browser or desktop profile. The model runs locally
              in that profile; PrivaCV does not send your resume text to an AI API for that feature.
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">
              Optional device-to-device handoff
            </h2>
            <p className="mt-3">
              If you explicitly use the experimental Continue on another device feature, the first
              browser creates a private random secret shown as a short pairing code and included in
              the QR link fragment. The browsers derive the temporary room ID and encryption key
              from that secret; only the derived room ID is sent to the signaling service. A
              Cloudflare signaling room retains only encrypted WebRTC connection details for up to
              five minutes and cannot decrypt them. You choose whether to transfer the active
              resume, the application pipeline, or both. Application transfers can include timeline
              events, job-description snapshots, and submitted-resume snapshots. That selected data
              is not sent to or stored in the signaling room; it transfers over the encrypted WebRTC
              data channel after the devices connect. The browsers also contact Cloudflare&apos;s
              STUN service, which processes network metadata such as IP addresses and ports. When a
              direct connection is blocked, Cloudflare&apos;s TURN service can relay the encrypted
              WebRTC packets using a ten-minute credential. TURN processes the encrypted packet
              bytes and connection metadata but cannot read the transferred payload. Anyone with the
              temporary QR link or pairing code could attempt to join the transfer, so show it only
              to the intended device.
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">Limited product metrics</h2>
            <p className="mt-3">
              The hosted website records limited metrics for resume exports, local-AI usage
              milestones, and applications created. These metrics contain no company names, roles,
              job descriptions, notes, resume content, prompts, or generated text.
            </p>
            <p className="mt-3">
              Each resume export and each application-creation event include the same randomly
              generated browser-profile ID. This pseudonymous ID stays in local browser storage
              across days and sessions, letting us count returning browsers and unique users of
              these features. It is not derived from your identity, IP address, or device
              fingerprint. Different browsers, profiles, and devices have different IDs. Public
              information pages do not record visits, and local-AI events do not include this ID.
            </p>
            <p className="mt-3">
              We skip export and application-creation metrics when Global Privacy Control or Do Not
              Track is enabled, or local storage is blocked. Desktop builds do not submit these
              metrics. Delete all data removes the local identifier; future activity gets a new one.
              Clearing local data does not erase metrics already recorded by Cloudflare.
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">Your control</h2>
            <p className="mt-3">
              You can save portable JSON backups, export the job pipeline as CSV, delete individual
              applications, or delete all saved data from the current profile. If you share a
              device, export or back up anything you want to keep before deleting local data.
            </p>
          </section>
        </div>
        <nav className="mt-12 flex flex-wrap gap-5 text-sm font-medium" aria-label="Related pages">
          <Link className="underline underline-offset-4" href="/" prefetch={false}>
            Open the editor
          </Link>
          <Link className="underline underline-offset-4" href="/job-application-tracker">
            Learn about the private job tracker
          </Link>
          <Link className="underline underline-offset-4" href="/applications">
            Open the job pipeline
          </Link>
          <Link className="underline underline-offset-4" href="/about">
            About PrivaCV
          </Link>
        </nav>
      </main>
      <SiteFooter />
    </>
  );
}
