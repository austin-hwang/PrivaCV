import type { Metadata } from "next";
import Link from "next/link";
import { GuideLayout } from "@/components/guide-layout";
import { getGuide, guidePath } from "@/lib/guides";
import { createPageMetadata } from "@/lib/seo";

const guide = getGuide("ats-friendly-resume")!;

export const metadata: Metadata = createPageMetadata({
  title: guide.title,
  description: guide.description,
  path: guidePath(guide.slug),
  socialImage: "ats-friendly-resume",
  type: "article",
});

export default function AtsFriendlyResumeGuide() {
  return (
    <GuideLayout
      guide={guide}
      related={[
        { href: "/ats-resume-checker", label: "ATS resume checker" },
        { href: "/plain-text-resume", label: "Plain-text resume" },
        { href: "/resume-templates", label: "Resume templates" },
      ]}
    >
      <p>
        Most advice about applicant tracking systems is equal parts fear and folklore. The reality
        is more manageable. An ATS is mostly a database that reads the text of your resume so a
        recruiter can search and sort it. You don&apos;t need to trick it. You need to make sure it
        can read your resume cleanly, and that a person likes what they see afterward. Here is how
        to do both.
      </p>

      <h2>What an ATS actually does</h2>
      <p>
        An applicant tracking system is software employers use to collect and organize applications.
        When you submit a resume, the ATS pulls the text out of your file and sorts it into fields
        like name, work history, and skills. Recruiters then search and filter that database.
      </p>
      <p>A few things follow from that:</p>
      <ul>
        <li>
          It reads text, not design. Anything it can&apos;t turn into plain text is invisible to it.
        </li>
        <li>
          Most modern systems parse a clean, standard resume without trouble. The horror stories
          usually trace back to unusual formatting, not a secret gate.
        </li>
        <li>
          There is no universal &ldquo;ATS score&rdquo; that decides your fate. Employers run
          different software, configured differently, so be skeptical of any tool promising a single
          pass-or-fail number.
        </li>
      </ul>

      <h2>Where resumes actually break</h2>
      <p>
        Parsing problems come from formatting that hides or scrambles your text. The usual culprits:
      </p>
      <ul>
        <li>Multiple columns, which can get read out of order.</li>
        <li>Tables and text boxes, which some parsers skip or jumble.</li>
        <li>
          Contact details tucked into the file&apos;s header or footer, which parsers sometimes
          ignore.
        </li>
        <li>Images or icons standing in for text, including a logo in place of your name.</li>
        <li>Decorative fonts that don&apos;t map cleanly to real characters.</li>
      </ul>
      <p>Keep the structure simple and the text real, and most of these problems never come up.</p>

      <h2>The formatting rules that matter</h2>
      <ul>
        <li>
          <strong>Use a single column.</strong> It reads top to bottom, the way a parser expects.
        </li>
        <li>
          <strong>Use standard section headings.</strong> &ldquo;Experience,&rdquo;
          &ldquo;Education,&rdquo; &ldquo;Skills,&rdquo; and &ldquo;Projects&rdquo; are understood
          everywhere. Clever headings like &ldquo;Where I&apos;ve Made an Impact&rdquo; can confuse
          the mapping.
        </li>
        <li>
          <strong>Keep everything as selectable text.</strong> If you can&apos;t highlight it with
          your cursor, an ATS can&apos;t read it.
        </li>
        <li>
          <strong>Put your name and contact details in the body</strong> of the document, not in a
          header or footer.
        </li>
        <li>
          <strong>Use a common font</strong> such as Arial, Calibri, Georgia, or Times. The{" "}
          <Link href="/resume-templates">PrivaCV templates</Link> already stick to safe, readable
          typefaces.
        </li>
        <li>
          <strong>Write dates plainly and consistently,</strong> for example &ldquo;Mar 2022 -
          Present.&rdquo;
        </li>
      </ul>

      <h2>Use the words the job description uses</h2>
      <p>
        Recruiters and their software search for the terms in the posting. If the role asks for
        &ldquo;accounts receivable&rdquo; and your resume only says &ldquo;AR,&rdquo; you may not
        surface. Mirror the posting&apos;s language where it&apos;s genuinely true of your
        experience, and spell out acronyms at least once.
      </p>
      <p>
        This is not about stuffing keywords. A person reads your resume next, and a wall of
        buzzwords reads worse than clear accomplishments. Tailor honestly: describe what you
        actually did, in the words the employer is already using.
      </p>

      <h2>PDF or Word: which to send</h2>
      <p>
        Send exactly what the application asks for. If it doesn&apos;t say, a PDF is usually the
        safe default now, because it holds your layout and modern systems read it well. If a posting
        specifically wants a Word document, send DOCX. Either way, make sure it&apos;s the
        text-based kind and not a scan or an exported image. PrivaCV exports both a clean PDF and an{" "}
        <Link href="/pdf-to-docx-resume">editable Word file</Link>, so you can match whatever the
        employer requests.
      </p>

      <h2>Check it before you apply</h2>
      <p>
        The most useful habit is to look at your resume the way a machine does: as plain text. Read
        the extracted text top to bottom and ask:
      </p>
      <ul>
        <li>Is my name first, with my email and phone right beside it?</li>
        <li>Are the section headings clear and in a sensible order?</li>
        <li>Did every bullet survive, in the right place?</li>
        <li>Did anything turn into gibberish or disappear?</li>
      </ul>
      <p>
        If the <Link href="/plain-text-resume">plain text</Link> reads cleanly, an ATS almost
        certainly can too. The <Link href="/ats-resume-checker">PrivaCV ATS resume checker</Link>{" "}
        does this in your browser and also flags missing contact details and thin sections.
      </p>

      <h2>Myths you can ignore</h2>
      <ul>
        <li>
          <strong>&ldquo;Hide keywords in white text.&rdquo;</strong> Don&apos;t. It&apos;s easy to
          detect and gets applications tossed.
        </li>
        <li>
          <strong>&ldquo;You need an ATS score above some number.&rdquo;</strong> There is no shared
          score. Focus on clean text and relevance.
        </li>
        <li>
          <strong>&ldquo;Never use a PDF.&rdquo;</strong> Outdated. Modern systems handle text-based
          PDFs well. Follow the posting&apos;s instructions.
        </li>
        <li>
          <strong>&ldquo;Fancy design gets you noticed.&rdquo;</strong> In a parser, design mostly
          gets in the way. Save the flourishes for a portfolio.
        </li>
      </ul>

      <h2>The quick checklist</h2>
      <ol>
        <li>One column, standard headings, selectable text.</li>
        <li>Name and contact details in the body, not the header or footer.</li>
        <li>A common font and a consistent date format.</li>
        <li>No tables, text boxes, or images carrying real information.</li>
        <li>Language that mirrors the job posting, honestly.</li>
        <li>The file format the application asks for.</li>
        <li>A final read of the plain text before you submit.</li>
      </ol>

      <p>
        Do those seven things and you&apos;ve handled the parts of ATS-friendliness that are
        actually in your control. The rest is a strong, clearly written resume, which was the real
        goal all along.
      </p>
    </GuideLayout>
  );
}
