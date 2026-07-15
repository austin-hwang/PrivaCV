import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { resumeDocx } from "@/lib/docx-export";
import {
  docxArchiveUncompressedSize,
  docxFooterPartPathsFromXml,
  docxHeaderPartPathsFromXml,
  docxHyperlinkTargetsFromXml,
  docxParagraphsFromXml,
  extractDocxText,
  MAX_DOCX_EXPANDED_BYTES,
} from "@/lib/docx-import";
import {
  applicationCopyGroups,
  buildResumeChecks,
  contactHref,
  contactFieldIssues,
  CUSTOM_SECTION_PRESETS,
  emptyState,
  entryFieldSchema,
  exportChangeSummary,
  getSectionEntries,
  includedBulletsFrom,
  inferHeaderLinkIcon,
  normalizeResume,
  normalizeTagGroups,
  resumeExportFingerprint,
  resumePlainText,
  resolveHeaderLinkIcon,
  sampleState,
  summarizeBulletOpenings,
  summarizeEvidence,
  RESUME_TEMPLATES,
  TEMPLATE_THEMES,
} from "@/lib/resume";
import {
  detectSection,
  importResumePdfWithSource,
  importResumeText,
  importResumeTextWithSource,
  linesFromPositionedTextItems,
  MAX_PDF_BYTES,
} from "@/lib/pdf-import";
import {
  VERSION_HISTORY_BACKUP_FORMAT,
  VERSION_HISTORY_BACKUP_VERSION,
  buildImportCoverage,
  buildImportReview,
  importSectionExcerpt,
  importSourceExcerpt,
  importReviewProgress,
  mergeVersionHistory,
  parseCheckpointHistory,
  parseResumeLibrary,
  parseStoredImportReview,
  parseVersionHistoryBackup,
  storedImportReview,
  versionContentBadges,
  versionHistoryFingerprint,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";

describe("resume helpers", () => {
  it("drops the legacy excludedBulletIndexes field from older saved resumes and shows every bullet", () => {
    const base = sampleState();
    const bullet = "Launched a weekly KPI dashboard used by 12 leaders to track adoption, risk, and delivery.";
    // A resume saved while the removed "Tailor this version" control excluded a
    // bullet still carries the field; normalizing must strip it and keep every
    // bullet visible everywhere.
    const state = normalizeResume({
      ...base,
      experience: base.experience.map((entry, index) =>
        index === 0 ? { ...entry, excludedBulletIndexes: [1] } : entry,
      ),
    });

    expect((state.experience[0] as Record<string, unknown>).excludedBulletIndexes).toBeUndefined();
    expect(includedBulletsFrom(state.experience[0])).toContain(bullet);
    expect(resumePlainText(state)).toContain(bullet);
    expect(applicationCopyGroups(state).find((group) => group.id === "experience-0")?.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Achievements", text: expect.stringContaining(bullet) }),
    ]));
    expect(strFromU8(unzipSync(resumeDocx(state))["word/document.xml"])).toContain(bullet);
  });

  it("migrates legacy skills text into editable tag groups and honors later text-only edits", () => {
    const migrated = normalizeResume({
      sectionOrder: ["skills"],
      skills: "Languages: TypeScript, Go\nTools: Docker, AWS",
    });

    expect(migrated.sectionFormats.skills).toBe("tag-groups");
    expect(migrated.sectionTagGroups.skills).toEqual([
      { id: "skills-group-1", label: "Languages", tags: ["TypeScript", "Go"] },
      { id: "skills-group-2", label: "Tools", tags: ["Docker", "AWS"] },
    ]);
    expect(migrated.skills).toBe("Languages: TypeScript, Go\nTools: Docker, AWS");

    const editedByLegacyConsumer = normalizeResume({
      ...migrated,
      skills: "Tools: Kubernetes, Terraform",
    });
    expect(editedByLegacyConsumer.sectionTagGroups.skills).toEqual([
      { id: "skills-group-1", label: "Tools", tags: ["Kubernetes", "Terraform"] },
    ]);
  });

  it("keeps a blank tag-group draft only while the live editor requests it", () => {
    const draft = { id: "group-draft", label: "", tags: [] };

    expect(normalizeTagGroups([draft], "skills")).toEqual([]);
    expect(normalizeTagGroups([draft], "skills", true)).toEqual([draft]);
  });

  it("keeps structured Skills entries while grouped tags remain the default", () => {
    const blank = emptyState();
    expect(blank.sectionFormats.skills).toBe("tag-groups");

    const state = normalizeResume({
      sectionOrder: ["skills"],
      sectionFormats: { skills: "entries" },
      skillEntries: [{
        title: "Cloud platforms",
        subtitle: "AWS and Azure",
        meta: "",
        details: "Architecture and operations",
      }],
    });

    expect(state.sectionFormats.skills).toBe("entries");
    expect(getSectionEntries(state, "skills")).toEqual(state.skillEntries);
    expect(resumePlainText(state)).toContain("Cloud platforms");
    expect(resumePlainText(state)).toContain("AWS and Azure");
  });

  it("exports flexible custom-section formats as readable ATS text and Word paragraphs", () => {
    const state = normalizeResume({
      sectionOrder: ["custom-certifications"],
      customSections: [{ id: "custom-certifications", title: "Certifications", entries: [] }],
      sectionFormats: { "custom-certifications": "bullets" },
      sectionText: { "custom-certifications": "AWS Certified Developer\nCertified Kubernetes Administrator" },
    });

    expect(resumePlainText(state)).toContain("Certifications\n- AWS Certified Developer\n- Certified Kubernetes Administrator");
    const document = strFromU8(unzipSync(resumeDocx(state))["word/document.xml"]);
    expect(document).toContain("AWS Certified Developer");
    expect(document).toContain("Certified Kubernetes Administrator");
  });

  it("lets an entry use paragraph details without treating the text as bullets", () => {
    const state = normalizeResume({
      sectionOrder: ["education"],
      education: [{
        title: "B.S. Computer Science",
        subtitle: "State University",
        meta: "2024",
        details: "Relevant coursework included distributed systems, compilers, and database design.",
        detailsFormat: "paragraph",
      }],
    });

    expect(state.education[0].detailsFormat).toBe("paragraph");
    expect(includedBulletsFrom(state.education[0])).toEqual([]);
    expect(resumePlainText(state)).toContain("\nRelevant coursework included distributed systems, compilers, and database design.");
    expect(resumePlainText(state)).not.toContain("- Relevant coursework");
    const document = strFromU8(unzipSync(resumeDocx(state))["word/document.xml"]);
    expect(document).toContain("Relevant coursework included distributed systems, compilers, and database design.");
    expect(document).not.toContain('w:hanging="180"');

    const legacy = normalizeResume({ education: [{ title: "B.A.", details: "Honors" }] });
    expect(legacy.education[0].detailsFormat).toBe("bullets");
  });

  it("creates granular, portal-friendly copy fields without adding empty values", () => {
    const state = sampleState();
    state.customSections = [{
      id: "custom-certifications",
      title: "Certifications",
      entries: [{ title: "AWS Certified Developer", subtitle: "Amazon", meta: "", details: "Renewed through 2028" }],
    }];
    state.sectionOrder = ["experience", "skills", "custom-certifications"];

    const groups = applicationCopyGroups(state);
    const experience = groups.find((group) => group.id === "experience-0");
    const certification = groups.find((group) => group.id === "custom-certifications-0");

    expect(groups.find((group) => group.id === "profile")?.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Full name", text: "John Doe" }),
      expect.objectContaining({ label: "Email", text: "john.doe@example.com" }),
    ]));
    expect(experience?.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Job title" }),
      expect.objectContaining({ label: "Employer" }),
      expect.objectContaining({ label: "Achievements", text: expect.stringContaining("•") }),
    ]));
    expect(certification).toMatchObject({ label: "Certifications 1", detail: "AWS Certified Developer · Amazon" });
    expect(certification?.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "License / certification" }),
      expect.objectContaining({ label: "Issuing organization" }),
      expect.objectContaining({ label: "Credential ID / verification link / details (optional)" }),
    ]));
    expect(certification?.fields.map((field) => field.label)).not.toContain("Earned / expiration dates");
  });

  it("creates a local, editable Word document with simple resume structure", () => {
    const files = unzipSync(resumeDocx(sampleState()));
    const document = strFromU8(files["word/document.xml"]);
    const relationships = strFromU8(files["word/_rels/document.xml.rels"]);

    expect(Object.keys(files)).toEqual(expect.arrayContaining([
      "[Content_Types].xml",
      "word/document.xml",
      "word/_rels/document.xml.rels",
    ]));
    expect(document).toContain("John Doe");
    expect(document).toContain("EXPERIENCE");
    expect(document).toContain("•");
    expect(relationships).toContain("mailto:john.doe@example.com");
    expect(relationships).toContain("https://linkedin.com/in/johndoe");
  });

  it("extracts Word paragraphs locally before using the normal resume parser", () => {
    const state = sampleState();
    state.title = "Senior Product Engineer";
    const files = unzipSync(resumeDocx(state));
    const document = strFromU8(files["word/document.xml"]);
    const text = extractDocxText(resumeDocx(state).buffer);

    expect(docxParagraphsFromXml(document)).toEqual(expect.arrayContaining([
      "John Doe",
      "Senior Product Engineer",
      "EXPERIENCE",
    ]));
    expect(text).toContain("John Doe");
    const imported = importResumeText(text);
    expect(imported).toMatchObject({
      name: "John Doe",
      title: "Senior Product Engineer",
    });
    expect(imported.experience).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Product Operations Manager", subtitle: "Northstar Health - Chicago, IL" }),
    ]));
  });

  it("checks a Word archive's expanded size before decompressing it", () => {
    const archive = resumeDocx(sampleState());
    expect(docxArchiveUncompressedSize(archive.buffer)).toBeGreaterThan(0);

    // A minimal central directory is sufficient for this guard: extraction
    // must reject the claimed expansion before it tries to unzip any payload.
    const oversizedArchive = new ArrayBuffer(68);
    const view = new DataView(oversizedArchive);
    view.setUint32(0, 0x02014b50, true);
    view.setUint32(24, MAX_DOCX_EXPANDED_BYTES + 1, true);
    view.setUint32(46, 0x06054b50, true);
    view.setUint16(54, 1, true);
    view.setUint16(56, 1, true);
    view.setUint32(58, 46, true);

    expect(() => extractDocxText(oversizedArchive)).toThrow(/expand to too much data/i);
  });

  it("keeps simple Word table cell text in document order", () => {
    const document = '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>ada@example.com</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';

    expect(docxParagraphsFromXml(document)).toEqual(["Ada Lovelace", "ada@example.com"]);
  });

  it("recovers label-only external Word contact links without duplicating visible URLs", () => {
    const document = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>',
      '<w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Platform Engineer</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>ada@example.com | </w:t></w:r><w:hyperlink r:id="rIdLinkedIn"><w:r><w:t>LinkedIn</w:t></w:r></w:hyperlink></w:p>',
      '<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Engineer | Analytical Engines | 2022–Present</w:t></w:r></w:p>',
      '</w:body></w:document>',
    ].join("");
    const relationships = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLinkedIn" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://www.linkedin.com/in/ada?trk=resume&amp;source=word" TargetMode="External"/><Relationship Id="rIdUnsafe" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/></Relationships>';
    const archive = zipSync({
      "word/document.xml": strToU8(document),
      "word/_rels/document.xml.rels": strToU8(relationships),
    });

    expect(docxHyperlinkTargetsFromXml(relationships)).toEqual(new Map([
      ["rIdLinkedIn", "https://www.linkedin.com/in/ada?trk=resume&source=word"],
    ]));
    expect(docxParagraphsFromXml(document, docxHyperlinkTargetsFromXml(relationships))).toContain(
      "ada@example.com | LinkedIn — https://www.linkedin.com/in/ada?trk=resume&source=word",
    );

    const imported = importResumeText(extractDocxText(archive.buffer));
    expect(imported).toMatchObject({
      name: "Ada Lovelace",
      title: "Platform Engineer",
      email: "ada@example.com",
      website: "https://www.linkedin.com/in/ada?trk=resume&source=word",
    });
  });

  it("recovers label-only Word field hyperlinks while ignoring unsafe field targets", () => {
    const document = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
      '<w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Platform Engineer</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>ada@example.com | </w:t></w:r><w:fldSimple w:instr=" HYPERLINK &quot;https://ada.example.com/portfolio&quot; "><w:r><w:t>Portfolio</w:t></w:r></w:fldSimple></w:p>',
      '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> HYPERLINK "https://github.com/ada" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>GitHub</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>',
      '<w:p><w:fldSimple w:instr=" HYPERLINK &quot;javascript:alert(1)&quot; "><w:r><w:t>Unsafe link</w:t></w:r></w:fldSimple></w:p>',
      '<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Engineer | Analytical Engines | 2022–Present</w:t></w:r></w:p>',
      '</w:body></w:document>',
    ].join("");
    const archive = zipSync({ "word/document.xml": strToU8(document) });
    const text = extractDocxText(archive.buffer);

    expect(text).toContain("Portfolio — https://ada.example.com/portfolio");
    expect(text).toContain("GitHub — https://github.com/ada");
    expect(text).not.toContain("javascript:alert");
    expect(importResumeText(text)).toMatchObject({
      name: "Ada Lovelace",
      title: "Platform Engineer",
      email: "ada@example.com",
      website: "https://ada.example.com/portfolio",
    });
  });

  it("recovers referenced Word header contact details before parsing the body", () => {
    const header = [
      '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      '<w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Platform Engineer</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>ada@example.com | </w:t></w:r><w:hyperlink r:id="rIdPortfolio"><w:r><w:t>Portfolio</w:t></w:r></w:hyperlink></w:p>',
      '</w:hdr>',
    ].join("");
    const document = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
      '<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Engineer | Analytical Engines | 2022–Present</w:t></w:r></w:p>',
      '</w:body></w:document>',
    ].join("");
    const documentRelationships = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>';
    const headerRelationships = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdPortfolio" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://ada.example.com" TargetMode="External"/></Relationships>';
    const archive = zipSync({
      "word/document.xml": strToU8(document),
      "word/_rels/document.xml.rels": strToU8(documentRelationships),
      "word/header1.xml": strToU8(header),
      "word/_rels/header1.xml.rels": strToU8(headerRelationships),
    });

    expect(docxHeaderPartPathsFromXml(documentRelationships)).toEqual(["word/header1.xml"]);
    expect(extractDocxText(archive.buffer)).toMatch(/^Ada Lovelace\nPlatform Engineer\nada@example.com/);
    expect(importResumeText(extractDocxText(archive.buffer))).toMatchObject({
      name: "Ada Lovelace",
      title: "Platform Engineer",
      email: "ada@example.com",
      website: "https://ada.example.com",
      experience: [expect.objectContaining({ title: "Engineer", subtitle: "Analytical Engines" })],
    });
  });

  it("recovers only explicit contact details from a referenced Word footer", () => {
    const footer = [
      '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      '<w:p><w:r><w:t>ada@example.com | </w:t></w:r><w:hyperlink r:id="rIdPortfolio"><w:r><w:t>Portfolio</w:t></w:r></w:hyperlink></w:p>',
      '<w:p><w:r><w:t>Page 1</w:t></w:r></w:p>',
      '</w:ftr>',
    ].join("");
    const document = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
      '<w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Platform Engineer</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Engineer | Analytical Engines | 2022–Present</w:t></w:r></w:p>',
      '</w:body></w:document>',
    ].join("");
    const documentRelationships = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>';
    const footerRelationships = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdPortfolio" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://ada.example.com" TargetMode="External"/></Relationships>';
    const archive = zipSync({
      "word/document.xml": strToU8(document),
      "word/_rels/document.xml.rels": strToU8(documentRelationships),
      "word/footer1.xml": strToU8(footer),
      "word/_rels/footer1.xml.rels": strToU8(footerRelationships),
    });
    const text = extractDocxText(archive.buffer);

    expect(docxFooterPartPathsFromXml(documentRelationships)).toEqual(["word/footer1.xml"]);
    expect(text).toContain("ada@example.com | Portfolio — https://ada.example.com");
    expect(text).not.toContain("Page 1");
    expect(importResumeText(text)).toMatchObject({
      name: "Ada Lovelace",
      title: "Platform Engineer",
      email: "ada@example.com",
      website: "https://ada.example.com",
      experience: [expect.objectContaining({ title: "Engineer", subtitle: "Analytical Engines" })],
    });
  });

  it("keeps Word import failures specific when the archive has no document XML", () => {
    expect(() => extractDocxText(new Uint8Array([80, 75, 3, 4]).buffer)).toThrow(/readable Word/i);
  });

  it("rejects oversized PDF imports before loading the local parser", async () => {
    const file = new File([new Uint8Array(MAX_PDF_BYTES + 1)], "large-resume.pdf", { type: "application/pdf" });

    await expect(importResumePdfWithSource(file)).rejects.toThrow(/too large to import locally/i);
  });

  it("creates safe contact links without turning invalid values into links", () => {
    expect(contactHref("email", "ada@example.com")).toBe("mailto:ada@example.com");
    expect(contactHref("phone", "+1 (415) 555-0123")).toBe("tel:+1 (415) 555-0123");
    expect(contactHref("website", "linkedin.com/in/ada")).toBe("https://linkedin.com/in/ada");
    expect(contactHref("website", "javascript:alert(1)")).toBeUndefined();
    expect(contactHref("email", "not-an-email")).toBeUndefined();
  });

  it("migrates the legacy website field and exports multiple clickable header links", () => {
    const migrated = normalizeResume({ website: "linkedin.com/in/ada" });
    expect(migrated.headerLinks).toEqual([
      { id: "header-link-1", label: "LinkedIn", url: "linkedin.com/in/ada", icon: "linkedin" },
    ]);
    expect(normalizeResume({
      headerLinks: [{ id: "legacy", label: "GitHub", url: "github.com/ada", icon: "auto" }],
    }).headerLinks[0].icon).toBe("github");

    const state = normalizeResume({
      ...sampleState(),
      headerLinks: [
        { id: "linkedin", label: "LinkedIn", url: "linkedin.com/in/johndoe" },
        { id: "github", label: "GitHub", url: "github.com/johndoe" },
      ],
    });
    const relationships = strFromU8(unzipSync(resumeDocx(state))["word/_rels/document.xml.rels"]);
    expect(relationships).toContain("https://linkedin.com/in/johndoe");
    expect(relationships).toContain("https://github.com/johndoe");
    expect(applicationCopyGroups(state).find((group) => group.id === "profile")?.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "LinkedIn", text: "linkedin.com/in/johndoe" }),
      expect.objectContaining({ label: "GitHub", text: "github.com/johndoe" }),
    ]));
    expect(resolveHeaderLinkIcon(state.headerLinks[0])).toBe("linkedin");
    expect(resolveHeaderLinkIcon({ ...state.headerLinks[0], icon: "portfolio" })).toBe("portfolio");
    expect(inferHeaderLinkIcon("GitLab gitlab.com/ada")).toBe("gitlab");
  });

  it("offers concise, ATS-readable custom section presets", () => {
    expect(CUSTOM_SECTION_PRESETS).toEqual([
      "Leadership & Activities",
      "Research Experience",
      "Relevant Coursework",
      "Licenses & Certifications",
      "Professional Affiliations",
      "Volunteer Experience",
      "Publications & Presentations",
      "Awards & Honors",
      "Languages",
      "Training & Professional Development",
    ]);
  });

  it("uses section-aware entry prompts without changing the portable entry shape", () => {
    expect(entryFieldSchema("education", "Education")).toMatchObject({
      title: "Degree",
      details: expect.stringContaining("Honors / relevant coursework"),
    });
    expect(entryFieldSchema("custom-certifications", "Licenses & Certifications")).toEqual({
      title: "License / certification",
      subtitle: "Issuing organization",
      meta: "Earned / expiration dates",
      details: "Credential ID / verification link / details (optional)",
    });
    expect(entryFieldSchema("custom-languages", "Languages").subtitle).toBe("Proficiency");
    expect(entryFieldSchema("custom-publications", "Publications").meta).toBe("Date / DOI / link");
    expect(entryFieldSchema("custom-renamed", "Professional Memberships").subtitle).toBe("Membership / role");
  });

  it("offers multiple clean, ATS-readable visual templates", () => {
    expect(RESUME_TEMPLATES.map((template) => template.id)).toEqual([
      "classic",
      "minimal",
      "modern",
      "compact",
      "executive",
      "technical",
    ]);
    expect(new Set(Object.values(TEMPLATE_THEMES).map((theme) => JSON.stringify(theme))).size).toBe(RESUME_TEMPLATES.length);
    expect(TEMPLATE_THEMES.minimal).toMatchObject({ headingStyle: "plain", bulletStyle: "dash" });
    expect(TEMPLATE_THEMES.modern).toMatchObject({ headerAlign: "center", headingStyle: "bar", density: "cozy" });
    expect(TEMPLATE_THEMES.compact).toMatchObject({ font: "calibri", headingStyle: "underline", density: "compact" });
    expect(TEMPLATE_THEMES.executive).toMatchObject({ font: "georgia", accent: "#7f1d3a", headerAlign: "center" });
    expect(TEMPLATE_THEMES.technical).toMatchObject({ font: "arial", accent: "#0f5f5c", density: "cozy" });
  });

  it("imports pasted resume text with line-ending cleanup", () => {
    const state = importResumeText(
      "Ada Lovelace\r\nPlatform Engineer\r\nada@example.com | San Francisco, CA\r\n\r\nExperience\r\nEngineer | Analytical Engines | 2022–Present\r\n• Built reliable systems.",
    );

    expect(state).toMatchObject({
      name: "Ada Lovelace",
      title: "Platform Engineer",
      email: "ada@example.com",
      location: "San Francisco, CA",
    });
    expect(state.experience[0]).toMatchObject({ title: "Engineer", subtitle: "Analytical Engines" });
  });

  it("imports every distinct profile link from the resume header", () => {
    const state = importResumeText([
      "Ada Lovelace",
      "Platform Engineer",
      "ada@example.com | linkedin.com/in/ada | github.com/ada | ada.dev",
      "San Francisco, CA",
      "",
      "Experience",
      "Engineer | Analytical Engines | 2022–Present",
    ].join("\n"));

    expect(state.headerLinks).toEqual([
      { id: "header-link-1", label: "LinkedIn", url: "linkedin.com/in/ada", icon: "linkedin" },
      { id: "header-link-2", label: "GitHub", url: "github.com/ada", icon: "github" },
      { id: "header-link-3", label: "Website", url: "ada.dev", icon: "website" },
    ]);
    expect(resumePlainText(state)).toContain("linkedin.com/in/ada | github.com/ada | ada.dev");
  });

  it("recovers a role-before-name preamble, full state name, and bare portfolio domain", () => {
    const state = importResumeText([
      "Data Analyst / Business Analyst",
      "Alex Sample",
      "alex@example.com | (333) 222-1111 | alexsample.dev/portfolio",
      "Seattle, Washington",
      "",
      "Experience",
      "Analyst | Example Co. | 2023 - Present",
    ].join("\n"));

    expect(state).toMatchObject({
      name: "Alex Sample",
      title: "Data Analyst / Business Analyst",
      email: "alex@example.com",
      phone: "(333) 222-1111",
      location: "Seattle, Washington",
      website: "alexsample.dev/portfolio",
    });
  });

  it("joins a name split across all-caps PDF lines without joining later headings", () => {
    const state = importResumeText([
      "ANDREY",
      "VOLKOV",
      "Senior Software Developer",
      "andrey@example.com",
      "",
      "PROFESSIONAL EXPIRIENCE",
      "Developer | Example Co. | 2023 - Present",
    ].join("\n"));

    expect(state).toMatchObject({
      name: "ANDREY VOLKOV",
      title: "Senior Software Developer",
      experience: [expect.objectContaining({ title: "Developer", subtitle: "Example Co." })],
    });
  });

  it("recovers a name merged onto a compact contact line", () => {
    const state = importResumeText([
      "Sourabh Bajaj Email: sourabh@example.com",
      "sourabh.example.com Mobile: +1-123-456-7890",
      "",
      "Experience",
      "Engineer | Example Co. | 2023 - Present",
    ].join("\n"));

    expect(state).toMatchObject({
      name: "Sourabh Bajaj",
      email: "sourabh@example.com",
      phone: "+1-123-456-7890",
      website: "sourabh.example.com",
    });
  });

  it("prefers a line-local phone and city/state over an adjacent street address and ZIP", () => {
    const state = importResumeText([
      "Nicholas DeSteffen",
      "2032 W Estes Ave., Chicago, IL 60645",
      "(312) 914-2345",
      "nick@example.com",
      "",
      "Experience",
      "Director | Example Co. | 2020 - Present",
    ].join("\n"));

    expect(state.phone).toBe("(312) 914-2345");
    expect(state.location).toBe("Chicago, IL");
  });

  it("keeps the normalized source text available during import review", () => {
    const imported = importResumeTextWithSource("Ada Lovelace\r\n\r\nExperience\r\nEngineer | Example Co.");

    expect(imported.sourceText).toBe("Ada Lovelace\n\nExperience\nEngineer | Example Co.");
    expect(imported.state.experience[0]).toMatchObject({ title: "Engineer", subtitle: "Example Co." });
  });

  it("keeps PDF text fragments with tiny baseline offsets on one readable line", () => {
    const lines = linesFromPositionedTextItems([
      { str: "Ada", transform: [1, 0, 0, 1, 72, 720] },
      { str: "Lovelace", transform: [1, 0, 0, 1, 98, 719.1] },
      { str: "ada@example.com", transform: [1, 0, 0, 1, 72, 700] },
      { str: "Experience", transform: [1, 0, 0, 1, 72, 650] },
      { str: "Engineer", transform: [1, 0, 0, 1, 72, 630] },
      { str: "Example Co.", transform: [1, 0, 0, 1, 140, 631.2] },
    ]);

    expect(lines).toEqual([
      "Ada Lovelace",
      "ada@example.com",
      "",
      "Experience",
      "Engineer Example Co.",
    ]);
    expect(importResumeText(lines.join("\n"))).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      experience: [expect.objectContaining({ title: "Engineer Example Co." })],
    });
  });

  it("recognizes common alternate resume section headings before parsing content", () => {
    expect(detectSection("Career Profile")).toBe("summary");
    expect(detectSection("Professional Overview")).toBe("summary");
    expect(detectSection("Relevant Experience")).toBe("experience");
    expect(detectSection("Professional History")).toBe("experience");
    expect(detectSection("Education & Training")).toBe("education");
    expect(detectSection("Education & Credentials")).toBe("education");
    expect(detectSection("Academic Projects")).toBe("projects");
    expect(detectSection("Key Skills")).toBe("skills");
    expect(detectSection("Skills & Tools")).toBe("skills");
    expect(detectSection("Technology Stack")).toBe("skills");
  });

  it("recognizes styled and qualification-style headings before parsing content", () => {
    expect(detectSection("— CAREER HIGHLIGHTS —")).toBe("summary");
    expect(detectSection("• Professional Roles •")).toBe("experience");
    expect(detectSection("— SELECTED WORK —")).toBe("projects");
    expect(detectSection("| Technical Expertise |")).toBe("skills");
  });

  it("imports content beneath styled headings without treating the decorations as resume text", () => {
    const state = importResumeText([
      "Ada Lovelace",
      "ada@example.com",
      "",
      "— CAREER HIGHLIGHTS —",
      "Platform engineer building dependable developer tools.",
      "",
      "• PROFESSIONAL ROLES •",
      "Staff Engineer | Analytical Engines | 2022–Present",
      "• Built reliable systems.",
      "",
      "| TECHNICAL EXPERTISE |",
      "TypeScript, React, systems design",
    ].join("\n"));

    expect(state).toMatchObject({
      summary: "Platform engineer building dependable developer tools.",
      skills: "TypeScript, React, systems design",
    });
    expect(state.experience[0]).toMatchObject({ title: "Staff Engineer", subtitle: "Analytical Engines" });
  });

  it("imports content under common alternate resume section headings", () => {
    const state = importResumeText([
      "Ada Lovelace",
      "ada@example.com",
      "",
      "Career Profile",
      "Platform engineer building dependable developer tools.",
      "",
      "Relevant Experience",
      "Staff Engineer | Analytical Engines | 2022–Present",
      "• Built reliable systems.",
      "",
      "Education & Training",
      "M.S. Computer Science | Example University | 2018–2020",
      "",
      "Academic Projects",
      "Compiler | TypeScript | 2020",
      "• Built a teaching compiler.",
      "",
      "Key Skills",
      "TypeScript, React, systems design",
    ].join("\n"));

    expect(state).toMatchObject({
      summary: "Platform engineer building dependable developer tools.",
      skills: "TypeScript, React, systems design",
    });
    expect(state.experience[0]).toMatchObject({ title: "Staff Engineer", subtitle: "Analytical Engines" });
    expect(state.education[0]).toMatchObject({ title: "M.S. Computer Science", subtitle: "Example University" });
    expect(state.projects[0]).toMatchObject({ title: "Compiler", subtitle: "TypeScript" });
  });

  it("keeps skills and overview content under common concise headings", () => {
    const state = importResumeText([
      "Ada Lovelace",
      "ada@example.com",
      "",
      "Professional Overview",
      "Platform engineer building dependable developer tools.",
      "",
      "Skills & Tools",
      "TypeScript, React, systems design",
    ].join("\n"));

    expect(state.summary).toBe("Platform engineer building dependable developer tools.");
    expect(state.skills).toBe("TypeScript, React, systems design");
  });

  it("keeps short technology acronyms inside skills instead of inventing sections", () => {
    const state = importResumeText([
      "Alex Sample",
      "alex@example.com",
      "",
      "Skills",
      "Python",
      "SQL",
      "Software: SQLite, MySQL",
      "AWS",
      "Tools: Lambda, S3",
      "",
      "Projects",
      "Analytics Dashboard - Personal Project - April 2020",
      "Analyzed customer trends and visualized the results.",
    ].join("\n"));

    expect(state.skills).toContain("SQL\nSoftware: SQLite, MySQL\nAWS");
    expect(state.customSections).toEqual([]);
  });

  it("keeps recognized custom PDF headings out of experience", () => {
    const state = importResumeText([
      "Karan Pratap Singh",
      "San Francisco, CA | contact@example.com",
      "",
      "EXPERIENCE",
      "Software Engineer | Example Co. | 2024 - Present",
      "• Built reliable systems.",
      "",
      "PUBLICATIONS",
      "• Learn Go - Published Jan 2023.",
      "",
      "ACHIEVEMENTS",
      "• Published 50+ technical articles.",
      "",
      "PROJECTS",
      "• ScaleETL - High-performance CLI for large CSV datasets.",
      "",
      "EDUCATION",
      "Bachelors of Technology | SRM Institute | 2017 - 2021",
    ].join("\n"));

    expect(state.experience).toHaveLength(1);
    expect(state.experience[0]).toMatchObject({ title: "Software Engineer", subtitle: "Example Co." });
    expect(state.projects).toEqual([expect.objectContaining({ title: "ScaleETL", details: "High-performance CLI for large CSV datasets." })]);
    expect(state.customSections).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Publications", entries: [expect.objectContaining({ title: "Learn Go" })] }),
      expect.objectContaining({ title: "Achievements", entries: [expect.objectContaining({ title: "Published 50+ technical articles." })] }),
    ]));
  });

  it("preserves common specialty sections and unfamiliar all-caps headings", () => {
    const state = importResumeText([
      "Ada Lovelace",
      "ada@example.com",
      "",
      "QUALIFICATIONS SUMMARY",
      "Engineering leader with distributed-systems experience.",
      "",
      "TECHNICAL PROFICIENCIES",
      "TypeScript, Go, PostgreSQL",
      "",
      "RESEARCH EXPERIENCE",
      "Research Assistant | Example Lab | 2024 - Present",
      "• Presented findings to 50 attendees.",
      "",
      "LEADERSHIP EXPERIENCE",
      "President | Engineering Society | 2023 - 2024",
      "• Organized mentorship events.",
      "",
      "SELECTED HIGHLIGHTS",
      "• Coordinated a local technology workshop.",
    ].join("\n"));

    expect(state.summary).toBe("Engineering leader with distributed-systems experience.");
    expect(state.skills).toBe("TypeScript, Go, PostgreSQL");
    expect(state.customSections).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Research Experience" }),
      expect.objectContaining({ title: "Leadership & Activities" }),
      expect.objectContaining({ title: "Selected Highlights" }),
    ]));
  });

  it("preserves content written inline with common resume section headings", () => {
    const state = importResumeText([
      "Ada Lovelace",
      "ada@example.com",
      "",
      "Professional Summary: Platform engineer building dependable developer tools.",
      "Skills: TypeScript, React, systems design",
      "Experience: Staff Engineer | Analytical Engines | 2022–Present",
      "• Built reliable systems.",
    ].join("\n"));

    expect(state).toMatchObject({
      summary: "Platform engineer building dependable developer tools.",
      skills: "TypeScript, React, systems design",
    });
    expect(state.experience[0]).toMatchObject({
      title: "Staff Engineer",
      subtitle: "Analytical Engines",
      meta: "2022–Present",
      details: "Built reliable systems.",
    });
  });

  it("keeps adjacent dated roles separate when exported resumes put dates on their own line", () => {
    const state = importResumeText([
      "Ada Lovelace",
      "ada@example.com",
      "",
      "Experience",
      "Staff Engineer",
      "Analytical Engines",
      "Jan 2022 – Present",
      "• Built reliable systems.",
      "Software Engineer",
      "Example Company",
      "Jun 2018 – Dec 2021",
      "• Improved deployment tooling.",
    ].join("\n"));

    expect(state.experience).toEqual([
      expect.objectContaining({
        title: "Staff Engineer",
        subtitle: "Analytical Engines",
        meta: "Jan 2022 – Present",
        details: "Built reliable systems.",
      }),
      expect.objectContaining({
        title: "Software Engineer",
        subtitle: "Example Company",
        meta: "Jun 2018 – Dec 2021",
        details: "Improved deployment tooling.",
      }),
    ]);
  });

  it("recognizes full numeric date ranges common in exported PDFs", () => {
    const state = importResumeText([
      "Ada Lovelace",
      "",
      "Experience",
      "Software Engineer 02/05/2024 - Present",
      "Example Co. San Francisco, CA",
      "• Built reliable systems.",
      "Senior Engineer 05/03/2023 - 01/26/2024",
      "Previous Co. New York, NY",
      "• Improved deployment tooling.",
    ].join("\n"));

    expect(state.experience).toEqual([
      expect.objectContaining({ title: "Software Engineer", meta: "02/05/2024 - Present" }),
      expect.objectContaining({ title: "Senior Engineer", meta: "05/03/2023 - 01/26/2024" }),
    ]);
  });

  it("keeps a dated role when an employer-first PDF header puts the job title on its second line", () => {
    const state = importResumeText([
      "Ada Lovelace",
      "",
      "Experience",
      "Northstar Labs | Seattle, WA",
      "Senior Product Engineer | Feb 2022 – Present",
      "• Led dependable platform work.",
    ].join("\n"));

    expect(state.experience).toEqual([
      expect.objectContaining({
        title: "Senior Product Engineer",
        subtitle: "Northstar Labs",
        meta: "Feb 2022 – Present",
        details: "Led dependable platform work.",
      }),
    ]);
  });

  it("keeps adjacent employer-first headers separate when a PDF omits blank lines", () => {
    const state = importResumeText([
      "Ada Lovelace",
      "",
      "Experience",
      "Northstar Labs | Seattle, WA",
      "Senior Product Engineer | Feb 2022 – Present",
      "• Led dependable platform work.",
      "Example Co. | Remote",
      "Software Engineer | Jun 2018 – Jan 2022",
      "• Improved deployment tooling.",
    ].join("\n"));

    expect(state.experience).toEqual([
      expect.objectContaining({
        title: "Senior Product Engineer",
        subtitle: "Northstar Labs",
        meta: "Feb 2022 – Present",
        details: "Led dependable platform work.",
      }),
      expect.objectContaining({
        title: "Software Engineer",
        subtitle: "Example Co.",
        meta: "Jun 2018 – Jan 2022",
        details: "Improved deployment tooling.",
      }),
    ]);
  });

  it("keeps adjacent role-first headers separate when organizations carry the dates", () => {
    const state = importResumeText([
      "Ankush Singh Gandhi",
      "ankush@example.com",
      "",
      "Experience",
      "Software Developer",
      "Desi Diaries Pvt. Ltd. | Jaipur May 2023 – Present",
      "• Built reliable mobile features.",
      "Flutter Developer Intern",
      "Desi Diaries Pvt. Ltd. | Jaipur Dec 2022 – May 2023",
      "• Improved application performance.",
    ].join("\n"));

    expect(state.experience).toEqual([
      expect.objectContaining({
        title: "Software Developer",
        subtitle: "Desi Diaries Pvt. Ltd. | Jaipur",
        meta: "May 2023 – Present",
      }),
      expect.objectContaining({
        title: "Flutter Developer Intern",
        subtitle: "Desi Diaries Pvt. Ltd. | Jaipur",
        meta: "Dec 2022 – May 2023",
      }),
    ]);
  });

  it("uses role words to normalize company-first headers and keeps wrapped metrics in their bullet", () => {
    const state = importResumeText([
      "Manish Example",
      "manish@example.com",
      "",
      "Experience",
      "ByteCraft Technologies | Software Wizard-1 August 2023 – Present",
      "• Reduced production issues and assisted the debug team over",
      "100 coffee breaks per month",
      "• Crafted reusable services.",
      "ByteCraft Technologies | Code Apprentice January 2023 – July 2023",
      "• Automated releases.",
    ].join("\n"));

    expect(state.experience.map((entry) => entry.title)).toEqual(["Software Wizard-1", "Code Apprentice"]);
    expect(state.experience[0].subtitle).toBe("ByteCraft Technologies");
    expect(state.experience[0].details).toContain("100 coffee breaks per month");
  });

  it("keeps inline language labels within a skills section", () => {
    const state = importResumeText([
      "Ada Lovelace",
      "ada@example.com",
      "",
      "Skills",
      "Languages: Python, C",
      "Frameworks: React, Flutter",
      "",
      "Achievements",
      "Awarded first place.",
    ].join("\n"));

    expect(state.skills).toContain("Languages: Python, C");
    expect(state.skills).toContain("Frameworks: React, Flutter");
    expect(state.customSections.map((section) => section.title)).toEqual(["Achievements"]);
  });

  it("handles comma-style month dates, related projects, page counters, and DOI-like numbers", () => {
    const state = importResumeText([
      "Tesla Zhang",
      "tesla@example.com | tesla.dev",
      "",
      "Education",
      "B.S. in Computer Science at Example University Aug, 2018 – Dec, 2022",
      "",
      "Work Experience",
      "JetBrains Research, Remote Jan, 2020 – Dec, 2020",
      "Implemented language tooling.",
      "PLCT Lab, Remote Dec, 2020 – Present",
      "Built compiler infrastructure.",
      "",
      "Related Projects",
      "Aya – A programming language",
      "• Developed the type checker.",
      "",
      "Misc",
      "Open-source contributor.",
      "",
      "Publications",
      "A paper. doi:10.1145/3471875.3472991.",
      "1 / 1",
    ].join("\n"));

    expect(state.phone).toBe("");
    expect(state.education[0]).toMatchObject({
      title: "B.S. in Computer Science",
      subtitle: "Example University",
      meta: "Aug, 2018 – Dec, 2022",
    });
    expect(state.experience.map((entry) => entry.title)).toEqual(["JetBrains Research", "PLCT Lab"]);
    expect(state.projects[0].title).toBe("Aya");
    expect(state.customSections.map((section) => section.title)).toEqual(["Additional Information", "Publications"]);
    expect(state.customSections[1].entries[0].details).not.toContain("1 / 1");
  });

  it("handles Unicode date hyphens and wrapped bullets in repeated employer-first entries", () => {
    const state = importResumeText([
      "Matthew Cha",
      "matthew@example.com",
      "",
      "Work Experience",
      "Car Media Group Irvine, California",
      "Web Developer November 2023 ‑ Present",
      "• Rebuilt a responsive interface with reusable components and",
      "Figma mockups in an Agile work environment",
      "• Increased conversion by 30%.",
      "Alpine IT Remote",
      "Software Engineer Contractor June 2023 ‑ August 2023",
      "• Implemented authentication and role management.",
    ].join("\n"));

    expect(state.experience).toEqual([
      expect.objectContaining({
        title: "Web Developer",
        subtitle: "Car Media Group Irvine, California",
        meta: "November 2023 ‑ Present",
        details: expect.stringContaining("Figma mockups in an Agile work environment"),
      }),
      expect.objectContaining({
        title: "Software Engineer Contractor",
        subtitle: "Alpine IT",
        meta: "June 2023 ‑ August 2023",
      }),
    ]);
  });

  it("splits repeated single-date entries even when Word list markers are not literal text", () => {
    const state = importResumeText([
      "Alex Sample",
      "alex@example.com",
      "",
      "Projects",
      "Market Analysis - Personal Project - April 2020",
      "Analyzed 7,000 job listings.",
      "Benefits Dashboard - Client Project - February 2020",
      "Created a comparison dashboard.",
      "sentiment analysis - Research Project - December 2019",
      "Applied regression to airline reviews.",
    ].join("\n"));

    expect(state.projects.map((project) => project.title)).toEqual([
      "Market Analysis",
      "Benefits Dashboard",
      "sentiment analysis",
    ]);
  });

  it("preserves nested bullet details without turning them into experience entries or sections", () => {
    const state = importResumeText([
      "Sourabh Bajaj",
      "sourabh@example.com",
      "",
      "Experience",
      "• Google Mountain View, CA",
      "Software Engineer Oct 2016 – Present",
      "◦ TensorFlow : Built numerical-computing APIs.",
      "◦ Course Dashboards : Built instructor surveying tools.",
      "• Lucena Research Atlanta, GA",
      "Data Scientist Summer 2012 and 2013",
      "◦ QuantDesk : Built portfolio-management services.",
      "",
      "Projects",
      "• QuantSoftware Toolkit : Open source financial-analysis library.",
    ].join("\n"));

    expect(state.experience).toEqual([
      expect.objectContaining({
        title: "Software Engineer",
        subtitle: "Google Mountain View, CA",
        details: expect.stringContaining("Course Dashboards : Built instructor surveying tools."),
      }),
      expect.objectContaining({
        title: "Data Scientist",
        subtitle: "Lucena Research Atlanta, GA",
        meta: "Summer 2012 and 2013",
        details: "QuantDesk : Built portfolio-management services.",
      }),
    ]);
    expect(state.projects).toEqual([
      expect.objectContaining({ title: "QuantSoftware Toolkit", details: "Open source financial-analysis library." }),
    ]);
    expect(state.customSections).toEqual([]);
  });

  it("inherits an employer printed once above consecutive dated roles", () => {
    const state = importResumeText([
      "Nicholas DeSteffen",
      "nick@example.com",
      "",
      "Professional Experience",
      "BenchPrep Chicago, IL",
      "Director of Engineering Jan 2020 – Present",
      "• Directed the engineering department.",
      "Lead Software Engineer Jan 2016 – Jan 2020",
      "• Led the engineering team.",
      "Senior Software Engineer Jan 2012 – Jan 2016",
      "• Built the platform.",
    ].join("\n"));

    expect(state.experience.map(({ title, subtitle }) => ({ title, subtitle }))).toEqual([
      { title: "Director of Engineering", subtitle: "BenchPrep Chicago, IL" },
      { title: "Lead Software Engineer", subtitle: "BenchPrep Chicago, IL" },
      { title: "Senior Software Engineer", subtitle: "BenchPrep Chicago, IL" },
    ]);
  });

  it("attaches a shared school to consecutive dated degrees", () => {
    const state = importResumeText([
      "Daniel Phang",
      "daniel@example.com",
      "",
      "Education",
      "Lehigh University Bethlehem, PA",
      "M.S. Computer Science August 2013 – May 2014",
      "B.S. Computer Engineering August 2009 – May 2013",
    ].join("\n"));

    expect(state.education).toEqual([
      expect.objectContaining({ title: "M.S. Computer Science", subtitle: "Lehigh University Bethlehem, PA" }),
      expect.objectContaining({ title: "B.S. Computer Engineering", subtitle: "Lehigh University Bethlehem, PA" }),
    ]);
  });

  it("keeps compact education entries separate when their standalone dates have no bullets", () => {
    const state = importResumeText([
      "Ada Lovelace",
      "ada@example.com",
      "",
      "Education",
      "Master of Science in Computer Science",
      "University of Example",
      "2016 – 2018",
      "Bachelor of Science in Mathematics",
      "Example College",
      "2012 – 2016",
    ].join("\n"));

    expect(state.education).toEqual([
      expect.objectContaining({
        title: "Master of Science in Computer Science",
        subtitle: "University of Example",
        meta: "2016 – 2018",
      }),
      expect.objectContaining({
        title: "Bachelor of Science in Mathematics",
        subtitle: "Example College",
        meta: "2012 – 2016",
      }),
    ]);
  });

  it("puts a short matching source excerpt beside imported fields", () => {
    const sourceText = [
      "Ada Lovelace",
      "Platform Engineer",
      "ada@example.com | San Francisco, CA",
      "",
      "Experience",
      "Engineer | Analytical Engines | 2022–Present",
      "• Built reliable systems.",
    ].join("\n");
    const state = importResumeText(sourceText);
    const review = buildImportReview(state, "pasted resume text", sourceText);

    expect(importSourceExcerpt(sourceText, ["Engineer", "Analytical Engines"])).toContain("Engineer | Analytical Engines | 2022–Present");
    expect(review.items.find((item) => item.id === "contact")?.sourceExcerpt).toContain("Ada Lovelace");
    expect(review.items.find((item) => item.id === "experience-0")?.sourceExcerpt).toContain("Built reliable systems.");
  });

  it("rejects an empty pasted resume", () => {
    expect(() => importResumeText(" \n\t ")).toThrow("Paste some resume text to import.");
  });

  it("tracks explicit confirmation for each imported field", () => {
    const review = buildImportReview(sampleState(), "pasted resume text");

    expect(importReviewProgress(review)).toMatchObject({
      reviewedCount: 0,
      remainingCount: review.items.length,
      isComplete: false,
    });
    expect(importReviewProgress({ ...review, reviewedItemIds: review.items.map((item) => item.id) })).toMatchObject({
      reviewedCount: review.items.length,
      remainingCount: 0,
      isComplete: true,
    });
  });

  it("keeps an interrupted import review and its source reload-safe", () => {
    const sourceText = [
      "Ada Lovelace",
      "ada@example.com",
      "",
      "Experience",
      "Platform Engineer | Analytical Engines | 2022–Present",
      "• Built reliable systems.",
    ].join("\n");
    const review = buildImportReview(importResumeText(sourceText), "ada-resume.txt", sourceText);
    const stored = storedImportReview({ ...review, reviewedItemIds: ["contact"] });
    const restored = parseStoredImportReview(JSON.stringify(stored));

    expect(stored.sourceText).toBe(sourceText);
    expect(stored.draftFingerprint).toMatch(/^.+-.+-.+$/);
    expect(restored).toMatchObject({ fileName: "ada-resume.txt", reviewedItemIds: ["contact"] });
    expect(restored?.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: "contact" })]));
    expect(restored?.sourceText).toBe(sourceText);
    expect(restored?.coverage?.find((item) => item.id === "experience")?.sourceExcerpt).toContain("Built reliable systems.");
  });

  it("rejects malformed persisted import-review metadata", () => {
    expect(parseStoredImportReview('{"fileName":"resume.pdf","items":[{"id":"contact"}]}')).toBeNull();
    expect(parseStoredImportReview("not json")).toBeNull();
  });

  it("includes every imported standard and custom entry in the review", () => {
    const state = sampleState();
    state.experience.push({
      title: "Software Engineer",
      subtitle: "Example Co.",
      meta: "2018 - 2021",
      details: "Built customer-facing tools.",
    });
    state.education.push({
      title: "B.S. Computer Science",
      subtitle: "Example University",
      meta: "2014 - 2018",
      details: "",
    });
    state.customSections = [{
      id: "custom-certifications",
      title: "Certifications",
      entries: [{
        title: "Certified Kubernetes Administrator",
        subtitle: "Cloud Native Computing Foundation",
        meta: "2026",
        details: "Validated Kubernetes administration skills.",
      }],
    }];
    state.sectionOrder.push("custom-certifications");

    const review = buildImportReview(state, "resume.pdf");

    expect(review.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "experience-0", label: "Experience entry 1", targetId: "field-experience-0-title" }),
      expect.objectContaining({ id: "experience-1", label: "Experience entry 2", targetId: "field-experience-1-title" }),
      expect.objectContaining({ id: "education-0", label: "Education entry 1", targetId: "field-education-0-title" }),
      expect.objectContaining({ id: "education-1", label: "Education entry 2", targetId: "field-education-1-title" }),
      expect.objectContaining({
        id: "custom-certifications-0",
        label: "Certifications entry 1",
        targetId: "field-custom-certifications-0-title",
      }),
    ]));
    expect(importReviewProgress({ ...review, reviewedItemIds: ["experience-0"] })).toMatchObject({
      reviewedCount: 1,
      remainingCount: review.items.length - 1,
    });
  });

  it("shows what an import did and did not place in the resume", () => {
    const state = emptyState();
    state.name = "Ada Lovelace";
    state.email = "ada@example.com";
    state.experience = [{ title: "Engineer", subtitle: "Example Co.", meta: "2022 - Present", details: "Built reliable systems." }];

    const coverage = buildImportCoverage(state);

    expect(coverage).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "header", detected: true, detail: "Name and 1 contact detail detected" }),
      expect.objectContaining({ id: "experience", detected: true, detail: "1 entry detected", targetId: "field-experience-0-title" }),
      expect.objectContaining({ id: "education", detected: false, detail: "No education entries detected", targetId: "add-education-entry" }),
      expect.objectContaining({ id: "skills", detected: false, detail: "No skills detected", targetId: "review-region-skills" }),
    ]));
  });

  it("calls out recognizable core and specialty source sections that produced no draft content", () => {
    const state = emptyState();
    state.name = "Ada Lovelace";
    state.experience = [{ title: "Engineer", subtitle: "Example Co.", meta: "2022 - Present", details: "Built reliable systems." }];

    const coverage = buildImportCoverage(state, [
      "Ada Lovelace",
      "Experience",
      "Engineer | Example Co. | 2022 - Present",
      "Education",
      "Certifications",
    ].join("\n"));

    expect(coverage.find((item) => item.id === "education")).toMatchObject({
      detected: false,
      sourceDetected: true,
      detail: "Education heading found in source, but no entries detected",
    });
    expect(coverage.find((item) => item.id === "skills")).toMatchObject({
      detected: false,
      sourceDetected: false,
      detail: "No skills detected",
    });
    expect(coverage.find((item) => item.id === "custom-certifications")).toMatchObject({
      label: "Certifications",
      detected: false,
      sourceDetected: true,
      detail: "Certifications heading found in source, but no entries detected",
      targetId: "add-custom-section",
      sourceExcerpt: "Certifications",
    });
  });

  it("keeps a short source excerpt with a recognized section coverage card", () => {
    const sourceText = [
      "Ada Lovelace",
      "Experience",
      "Engineer | Example Co. | 2022 - Present",
      "• Built reliable systems.",
      "• Improved incident response.",
      "Education",
      "B.S. Computer Science | Example University | 2012 - 2016",
      "Skills",
      "TypeScript, React, accessibility",
      "Certifications",
      "AWS Certified Developer",
    ].join("\n");
    const state = importResumeText(sourceText);
    const coverage = buildImportCoverage(state, sourceText);

    expect(importSectionExcerpt(sourceText, "experience")).toBe([
      "Experience",
      "Engineer | Example Co. | 2022 - Present",
      "• Built reliable systems.",
      "• Improved incident response.",
    ].join("\n"));
    expect(coverage.find((item) => item.id === "education")?.sourceExcerpt).toContain("Example University");
    expect(coverage.find((item) => item.id === "skills")?.sourceExcerpt).toBe("Skills\nTypeScript, React, accessibility");
    expect(coverage.find((item) => item.id === "custom-certifications")?.sourceExcerpt).toBe("Certifications\nAWS Certified Developer");
  });

  it("preserves intentionally removed default sections while normalizing legacy JSON", () => {
    const state = normalizeResume({ name: "Ada", sectionOrder: ["skills"] });

    expect(state.name).toBe("Ada");
    expect(state.sectionOrder).toEqual(["skills"]);
    expect(state.experience).toHaveLength(0);
    expect(state.template).toBe("classic");
  });

  it("preserves editable headings and custom sections while normalizing", () => {
    const state = normalizeResume({
      sectionTitles: { experience: "Selected Experience" },
      customSections: [{
        id: "custom-publications",
        title: "Publications",
        entries: [{ title: "Reliable Interfaces", subtitle: "ACM", meta: "2025", details: "Published with 3 collaborators." }],
      }],
      sectionOrder: ["experience", "custom-publications", "skills"],
    });

    expect(state.sectionTitles.experience).toBe("Selected Experience");
    expect(state.sectionTitles.education).toBe("Education");
    expect(state.sectionOrder).toEqual(["experience", "custom-publications", "skills"]);
    expect(resumePlainText(state)).toContain("Publications\nReliable Interfaces");
  });

  it("drops invalid custom section IDs and repairs section order", () => {
    const state = normalizeResume({
      customSections: [{ id: "not-custom", title: "Ignored", entries: [] }],
      sectionOrder: ["not-custom", "skills"],
    });

    expect(state.customSections).toEqual([]);
    expect(state.sectionOrder).toEqual(["skills"]);
  });

  it("keeps intentionally blank section titles blank in saved resumes and plain text", () => {
    const state = normalizeResume({
      sectionTitles: { experience: "" },
      experience: [{ title: "Engineer", subtitle: "Example Co.", meta: "2025", details: "Built reliable systems." }],
      sectionOrder: ["experience"],
    });

    expect(state.sectionTitles.experience).toBe("");
    expect(resumePlainText(state)).toContain("Engineer\nExample Co. | 2025");
    expect(resumePlainText(state)).not.toContain("Experience\nEngineer");
  });

  it("renders deterministic plain text in section order", () => {
    const state = sampleState();
    const text = resumePlainText(state);

    expect(text).toContain("John Doe");
    expect(text.indexOf("Education")).toBeLessThan(text.indexOf("Experience"));
    expect(text).toContain("- Rebuilt intake and prioritization across four teams, reducing request turnaround by 35%.");
  });

  it("builds useful export-readiness checks", () => {
    const state = sampleState();
    const checks = buildResumeChecks(state, 1);

    expect(checks).toHaveLength(5);
    expect(checks.every((check) => check.ok)).toBe(true);
  });

  it("keeps a two-page resume as an advisory instead of an export failure", () => {
    const twoPageLength = buildResumeChecks(sampleState(), 2).find((check) => check.id === "length");
    const threePageLength = buildResumeChecks(sampleState(), 3).find((check) => check.id === "length");

    expect(twoPageLength).toMatchObject({
      ok: true,
      advisory: true,
      detail: "Two pages — review relevance",
      actionLabel: "Adjust size",
    });
    expect(threePageLength).toMatchObject({
      ok: false,
      detail: "3 pages in preview",
    });
  });

  it("points a long-bullet check at the entry containing the long bullet", () => {
    const state = sampleState();
    state.experience = [
      { ...state.experience[0], details: "Shipped a reliable service." },
      {
        title: "Engineer",
        subtitle: "Analytical Engines",
        meta: "2020–2022",
        details: Array.from({ length: 31 }, (_, index) => `word${index}`).join(" "),
      },
    ];

    expect(buildResumeChecks(state, 1).find((check) => check.id === "bullets")).toMatchObject({
      ok: false,
      targetId: "field-experience-1-details",
    });
  });

  it("keeps a missing summary as an optional prompt instead of an export issue", () => {
    const state = sampleState();
    state.summary = "";

    const summary = buildResumeChecks(state, 1).find((check) => check.id === "summary");

    expect(summary).toMatchObject({
      ok: true,
      advisory: true,
      detail: "Optional — experience leads",
      actionLabel: "Add optional summary",
      targetId: "field-summary",
    });
    expect(summary?.guidance).toContain("career direction");
  });

  it("flags experience and project bullets that lack enough measurable evidence", () => {
    const state = sampleState();
    state.experience[0].details = "Led a migration to improve deployment reliability.\nMentored engineers and established review standards.\nDesigned a billing service for enterprise customers.";
    const evidence = buildResumeChecks(state, 1).find((check) => check.id === "evidence");

    expect(evidence).toMatchObject({
      ok: false,
      detail: "3 of 9 experience or project bullets show scope or results",
      actionLabel: "Strengthen a bullet",
      targetId: "field-experience-0-details",
    });
    expect(evidence?.guidance).toContain("Not every bullet needs a number");
  });

  it("summarizes the specific bullets that could use stronger evidence", () => {
    expect(
      summarizeEvidence("Migrated the payment flow for 2 teams.\nMentored engineers through a release.\nReduced support tickets by 30%."),
    ).toEqual({
      bulletCount: 3,
      measuredCount: 2,
      unmeasuredIndexes: [1],
    });
  });

  it("flags only clearly vague bullet openings without judging the achievement", () => {
    expect(
      summarizeBulletOpenings("Responsible for release planning.\nWorked on a migration for 3 teams.\nBuilt a new billing flow.\nAssisted in customer interviews."),
    ).toEqual({
      bulletCount: 4,
      vagueOpeningIndexes: [0, 1, 3],
    });
  });

  it("targets the first missing contact field", () => {
    const checks = buildResumeChecks({ ...sampleState(), phone: "" }, 1);
    const contact = checks.find((check) => check.id === "contact");

    expect(contact).toMatchObject({
      ok: false,
      actionLabel: "Fix contact",
      targetId: "field-phone",
    });
  });

  it("catches unusable contact details without imposing a country-specific format", () => {
    const state = {
      ...sampleState(),
      email: "ada-at-example",
      phone: "+44 20 7946 0958",
      website: "linkedin.com/in/ada",
    };
    const contact = buildResumeChecks(state, 1).find((check) => check.id === "contact");

    expect(contactFieldIssues(state)).toEqual([
      { field: "email", label: "email", detail: "Invalid email" },
    ]);
    expect(contact).toMatchObject({
      ok: false,
      detail: "Invalid email",
      targetId: "field-email",
    });
    expect(contact?.guidance).toContain("valid domain");
  });

  it("targets an invalid optional header link after required contact details are complete", () => {
    const state = {
      ...sampleState(),
      headerLinks: [{ id: "linkedin", label: "LinkedIn", url: "linkedin profile", icon: "linkedin" as const }],
    };
    const contact = buildResumeChecks(state, 1).find((check) => check.id === "contact");

    expect(contact).toMatchObject({
      ok: false,
      detail: "Invalid linkedin link",
      targetId: "field-header-link-linkedin-url",
    });
  });

  it("fingerprints export-relevant resume changes", () => {
    const exported = sampleState();
    const edited = { ...exported, summary: `${exported.summary} Edited.` };
    const resized = { ...exported, textScale: 0.9 };

    expect(resumeExportFingerprint(exported)).toBe(resumeExportFingerprint(normalizeResume(exported)));
    expect(resumeExportFingerprint(edited)).not.toBe(resumeExportFingerprint(exported));
    expect(resumeExportFingerprint(resized)).not.toBe(resumeExportFingerprint(exported));
  });

  it("summarizes changes between resume snapshots", () => {
    const exported = sampleState();
    const edited = {
      ...exported,
      phone: "",
      summary: "Focused product engineer with strong launch experience.",
      textScale: 0.92,
    };

    expect(exportChangeSummary(exported, edited)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "contact", label: "Header changed", targetId: "field-phone" }),
        expect.objectContaining({ id: "summary", label: "Summary changed", targetId: "field-summary" }),
        expect.objectContaining({ id: "text-size", label: "Text size changed", targetId: "resume-text-scale" }),
      ]),
    );
  });

  it("includes before and after snippets for edited export areas", () => {
    const exported = sampleState();
    const edited = {
      ...exported,
      summary: "Focused product engineer with strong launch experience.",
      skills: "Languages: TypeScript, Go\nTools: Docker, AWS",
    };
    const changes = exportChangeSummary(exported, edited);

    expect(changes.find((change) => change.id === "summary")).toMatchObject({
      before: expect.stringContaining("Product operations leader"),
      after: "Focused product engineer with strong launch experience.",
    });
    expect(changes.find((change) => change.id === "skills")).toMatchObject({
      before: expect.stringContaining("Analysis: SQL"),
      after: "Languages: TypeScript, Go / Tools: Docker, AWS",
    });
  });

  it("explains visual changes that make a PDF export stale", () => {
    const exported = sampleState();
    const edited = normalizeResume({
      ...exported,
      template: "modern",
      theme: {
        ...exported.theme,
        font: "inter",
        accent: "#1f3a5f",
        headerAlign: "center",
        headerDivider: true,
        headingStyle: "bar",
        density: "cozy",
      },
    });

    expect(exportChangeSummary(exported, edited)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "visual-style",
          label: "Visual style changed",
          detail: "7 settings edited",
          targetId: "edit-layout",
          fieldLabels: [
            "Layout template",
            "Font",
            "Accent color",
            "Header alignment",
            "Header divider",
            "Heading style",
            "Spacing density",
          ],
          before: expect.stringContaining("Classic · Merriweather"),
          after: expect.stringContaining("Modern · Inter"),
        }),
      ]),
    );
  });

  it("names exact fields changed inside repeatable sections", () => {
    const exported = sampleState();
    const edited = {
      ...exported,
      experience: exported.experience.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              title: "Staff Software Engineer",
              details: `${entry.details}\nLaunched a hiring dashboard used by every recruiting coordinator.`,
            }
          : entry,
      ),
    };

    expect(exportChangeSummary(exported, edited).find((change) => change.id === "experience")).toMatchObject({
      detail: "2 fields edited",
      targetId: "field-experience-0-title",
      fieldLabels: ["Entry 1 Job title", "Entry 1 Achievements"],
    });
  });

  it("returns no export changes when normalized resume states match", () => {
    const saved = sampleState();

    expect(exportChangeSummary(saved, normalizeResume(saved))).toEqual([]);
  });

  it("parses every checkpoint in a version-history backup", () => {
    const checkpoints = Array.from({ length: 7 }, (_, index): VersionHistoryItem => ({
      id: `${index}`,
      savedAt: `2026-07-0${index + 1}T12:00:00.000Z`,
      label: `Draft ${index}`,
      fingerprint: `fingerprint-${index}`,
      state: sampleState(),
      importReview: null,
    }));

    expect(
      parseVersionHistoryBackup({
        format: VERSION_HISTORY_BACKUP_FORMAT,
        version: VERSION_HISTORY_BACKUP_VERSION,
        exportedAt: "2026-07-09T12:00:00.000Z",
        checkpoints,
      }),
    ).toHaveLength(7);
  });

  it("keeps separate resume-library documents and checkpoint timelines well formed", () => {
    const resume = sampleState();
    const library = parseResumeLibrary(JSON.stringify([
      {
        id: "resume-product",
        label: "Product roles",
        createdAt: "2026-07-10T12:00:00.000Z",
        updatedAt: "2026-07-11T12:00:00.000Z",
        state: resume,
        importReview: null,
      },
      { id: "resume-product", label: "Duplicate id" },
    ]));
    expect(library).toHaveLength(1);
    expect(library[0]).toMatchObject({ id: "resume-product", label: "Product roles" });

    const checkpoint: VersionHistoryItem = {
      id: "checkpoint-1",
      savedAt: "2026-07-11T13:00:00.000Z",
      label: "Before tailoring",
      fingerprint: "product-before-tailoring",
      state: resume,
      importReview: null,
    };
    expect(parseCheckpointHistory(JSON.stringify({ "resume-product": [checkpoint] }))).toMatchObject({
      "resume-product": [expect.objectContaining({ id: "checkpoint-1", label: "Before tailoring" })],
    });
  });

  it("deduplicates version history by resume content when merging backups", () => {
    const baseState = sampleState();
    const existing: VersionHistoryItem[] = [
      {
        id: "1",
        savedAt: "2026-07-09T12:00:00.000Z",
        label: "Current",
        fingerprint: "same-resume",
        state: baseState,
        importReview: null,
      },
    ];
    const incoming: VersionHistoryItem[] = [
      {
        ...existing[0],
        id: "incoming-duplicate",
      },
      {
        ...existing[0],
        id: "incoming-duplicate-again",
        savedAt: "2026-07-10T12:00:00.000Z",
        label: "Duplicate",
      },
    ];

    const merged = mergeVersionHistory(existing, incoming);

    expect(merged.matchingCheckpoints).toHaveLength(2);
    expect(merged.incomingUnique).toHaveLength(0);
    expect(merged.checkpoints.map((item) => item.label)).toEqual(["Current"]);
    expect(versionHistoryFingerprint(existing[0])).toBe("same-resume");
  });

  it("builds import-review targets for likely PDF parser guesses", () => {
    const state = sampleState();
    const review = buildImportReview(state, "resume.pdf");

    expect(review.fileName).toBe("resume.pdf");
    expect(review.sections).toEqual(expect.arrayContaining(["Header", "Summary", "Experience", "Education", "Projects", "Skills"]));
    expect(review.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "contact", targetId: "field-name" }),
        expect.objectContaining({ id: "experience-0", targetId: "field-experience-0-title" }),
        expect.objectContaining({ id: "skills", targetId: "review-region-skills" }),
      ]),
    );
  });

  it("summarizes version content badges from normalized resume content", () => {
    expect(versionContentBadges(emptyState())).toEqual(["Empty draft"]);
    expect(versionContentBadges(sampleState())).toEqual(
      expect.arrayContaining(["3 roles", "2 education", "2 projects", "4 skill lines"]),
    );
  });
});
