import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { resumeDocx } from "@/lib/docx-export";
import {
  docxArchiveUncompressedSize,
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
  exportChangeSummary,
  normalizeResume,
  resumeExportFingerprint,
  resumePlainText,
  sampleState,
  summarizeBulletOpenings,
  summarizeEvidence,
  RESUME_TEMPLATES,
} from "@/lib/resume";
import { buildRoleFocus, buildRolePhraseSuggestions, reviewRolePhrase } from "@/lib/job-match";
import { detectSection, importResumeText, importResumeTextWithSource, linesFromPositionedTextItems } from "@/lib/pdf-import";
import {
  MAX_VERSION_HISTORY,
  VERSION_HISTORY_BACKUP_FORMAT,
  VERSION_HISTORY_BACKUP_VERSION,
  buildImportCoverage,
  buildImportReview,
  importSectionExcerpt,
  importSourceExcerpt,
  importReviewProgress,
  mergeVersionHistory,
  parseExportCheckpoint,
  parseVersionHistoryBackup,
  roleContextFingerprint,
  versionContentBadges,
  versionHistoryFingerprint,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";

describe("resume helpers", () => {
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
      expect.objectContaining({ label: "Full name", text: "Jane Doe" }),
      expect.objectContaining({ label: "Email", text: "jane.doe@example.com" }),
    ]));
    expect(experience?.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Job title" }),
      expect.objectContaining({ label: "Employer" }),
      expect.objectContaining({ label: "Achievements", text: expect.stringContaining("•") }),
    ]));
    expect(certification).toMatchObject({ label: "Certifications 1", detail: "AWS Certified Developer · Amazon" });
    expect(certification?.fields.map((field) => field.label)).not.toContain("Dates / details");
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
    expect(document).toContain("Jane Doe");
    expect(document).toContain("EXPERIENCE");
    expect(document).toContain("•");
    expect(relationships).toContain("mailto:jane.doe@example.com");
    expect(relationships).toContain("https://linkedin.com/in/janedoe");
  });

  it("extracts Word paragraphs locally before using the normal resume parser", () => {
    const state = sampleState();
    state.title = "Senior Product Engineer";
    const files = unzipSync(resumeDocx(state));
    const document = strFromU8(files["word/document.xml"]);
    const text = extractDocxText(resumeDocx(state).buffer);

    expect(docxParagraphsFromXml(document)).toEqual(expect.arrayContaining([
      "Jane Doe",
      "Senior Product Engineer",
      "EXPERIENCE",
    ]));
    expect(text).toContain("Jane Doe");
    const imported = importResumeText(text);
    expect(imported).toMatchObject({
      name: "Jane Doe",
      title: "Senior Product Engineer",
    });
    expect(imported.experience).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Senior Software Engineer", subtitle: "Acme Corp - San Francisco, CA" }),
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

  it("keeps Word import failures specific when the archive has no document XML", () => {
    expect(() => extractDocxText(new Uint8Array([80, 75, 3, 4]).buffer)).toThrow(/readable Word/i);
  });

  it("creates safe contact links without turning invalid values into links", () => {
    expect(contactHref("email", "ada@example.com")).toBe("mailto:ada@example.com");
    expect(contactHref("phone", "+1 (415) 555-0123")).toBe("tel:+1 (415) 555-0123");
    expect(contactHref("website", "linkedin.com/in/ada")).toBe("https://linkedin.com/in/ada");
    expect(contactHref("website", "javascript:alert(1)")).toBeUndefined();
    expect(contactHref("email", "not-an-email")).toBeUndefined();
  });

  it("offers concise, ATS-readable custom section presets", () => {
    expect(CUSTOM_SECTION_PRESETS).toEqual([
      "Certifications",
      "Volunteer Experience",
      "Publications",
      "Awards",
      "Languages",
      "Training",
    ]);
  });

  it("offers multiple clean, ATS-readable visual templates", () => {
    expect(RESUME_TEMPLATES.map((template) => template.id)).toEqual([
      "classic",
      "minimal",
      "modern",
      "compact",
    ]);
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
      expect.objectContaining({ id: "skills", detected: false, detail: "No skills detected", targetId: "field-skills" }),
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

    expect(text).toContain("Jane Doe");
    expect(text.indexOf("Education")).toBeLessThan(text.indexOf("Experience"));
    expect(text).toContain("- Led migration of monolith to microservices, cutting deploy time by 60%.");
  });

  it("builds useful export-readiness checks", () => {
    const state = sampleState();
    const checks = buildResumeChecks(state, 1);

    expect(checks).toHaveLength(7);
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

  it("points to the one entry that cannot fit within a printable page", () => {
    const oversized = buildResumeChecks(sampleState(), 2, { section: "experience", index: 0 })
      .find((check) => check.id === "entry-length");

    expect(oversized).toMatchObject({
      ok: false,
      detail: "Experience entry 1 exceeds one printable page",
      actionLabel: "Shorten entry",
      targetId: "field-experience-0-details",
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
      detail: "2 of 7 experience or project bullets show scope or results",
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

  it("targets an invalid optional website after required contact details are complete", () => {
    const state = { ...sampleState(), website: "linkedin profile" };
    const contact = buildResumeChecks(state, 1).find((check) => check.id === "contact");

    expect(contact).toMatchObject({
      ok: false,
      detail: "Invalid website",
      targetId: "field-website",
    });
  });

  it("explains sparse resumes with actionable density guidance", () => {
    const checks = buildResumeChecks({ ...emptyState(), name: "Ada Lovelace", email: "ada@example.com" }, 1);
    const density = checks.find((check) => check.id === "density");

    expect(density).toMatchObject({
      ok: false,
      actionLabel: "Add proof",
      targetId: "field-experience-0-details",
    });
    expect(density?.guidance).toContain("proof");
  });

  it("fingerprints export-relevant resume changes", () => {
    const exported = sampleState();
    const edited = { ...exported, summary: `${exported.summary} Edited.` };
    const resized = { ...exported, textScale: 0.9 };

    expect(resumeExportFingerprint(exported)).toBe(resumeExportFingerprint(normalizeResume(exported)));
    expect(resumeExportFingerprint(edited)).not.toBe(resumeExportFingerprint(exported));
    expect(resumeExportFingerprint(resized)).not.toBe(resumeExportFingerprint(exported));
  });

  it("summarizes changes since the last export snapshot", () => {
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
      before: expect.stringContaining("Software engineer specializing"),
      after: "Focused product engineer with strong launch experience.",
    });
    expect(changes.find((change) => change.id === "skills")).toMatchObject({
      before: expect.stringContaining("Languages: JavaScript"),
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

  it("surfaces substantive role terms without presenting an ATS score", () => {
    const focus = buildRoleFocus(
      "Product engineer building TypeScript services and React interfaces.",
      "The product engineer will build TypeScript services, partner with product teams, and improve TypeScript systems.",
    );

    expect(focus.terms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ term: "typescript", count: 2, matched: true }),
        expect.objectContaining({ term: "product", matched: true }),
        expect.objectContaining({ term: "services", matched: true }),
        expect.objectContaining({ term: "partner", matched: false }),
      ]),
    );
    expect(focus.matchedCount).toBeGreaterThan(0);
    expect(focus.totalCount).toBeLessThanOrEqual(14);
  });

  it("shows terms from an explicit requirements section before repeated general wording", () => {
    const focus = buildRoleFocus(
      "Product engineer building TypeScript services.",
      [
        "Build reliable product systems and collaborate across product teams.",
        "Requirements",
        "- TypeScript and React experience",
        "- Kubernetes and distributed systems knowledge",
        "Benefits",
        "- Flexible work arrangements",
      ].join("\n"),
    );

    expect(focus.requirementCount).toBeGreaterThan(0);
    expect(focus.terms.slice(0, focus.requirementCount)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ term: "typescript", isRequirement: true, matched: true }),
        expect.objectContaining({ term: "kubernetes", isRequirement: true, matched: false }),
      ]),
    );
    expect(focus.terms.find((term) => term.term === "flexible")?.isRequirement).toBe(false);
  });

  it("locates role terms in concrete experience separately from supporting mentions", () => {
    const state = sampleState();
    state.summary = "Product engineer focused on reliable systems.";
    state.skills = "Languages: TypeScript\nPractices: Product discovery";
    state.experience[0].details = "Built TypeScript services for product teams.";

    const focus = buildRoleFocus(state, "Product engineers build TypeScript services and lead product discovery.");

    expect(focus.terms.find((term) => term.term === "typescript")?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Experience 1", targetId: "field-experience-0-details", isConcrete: true }),
        expect.objectContaining({ label: "Skills", targetId: "field-skills", isConcrete: false }),
      ]),
    );
    expect(focus.terms.find((term) => term.term === "product")?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Summary", targetId: "field-summary", isConcrete: false }),
      ]),
    );
  });

  it("distinguishes detailed role evidence from skills and education references", () => {
    const state = sampleState();
    state.skills = "TypeScript";
    state.experience[0].details = "Built TypeScript services for a billing platform.";
    state.education[0].title = "B.S. Computer Science";

    const focus = buildRoleFocus(state, [
      "Requirements",
      "- TypeScript",
      "- Computer science",
    ].join("\n"));

    expect(focus).toMatchObject({ detailEvidenceCount: 1, referenceOnlyCount: 2 });
    expect(focus.terms.find((term) => term.term === "computer")?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Education 1", targetId: "field-education-0-title", isConcrete: false }),
      ]),
    );
  });

  it("includes custom section wording in role focus and links it to the saved entry", () => {
    const state = sampleState();
    state.customSections = [{
      id: "custom-certifications",
      title: "Certifications",
      entries: [{
        title: "Kubernetes Administrator",
        subtitle: "Cloud Native Computing Foundation",
        meta: "2026",
        details: "Administered Kubernetes clusters for production releases.",
      }],
    }];
    state.sectionOrder.push("custom-certifications");

    const focus = buildRoleFocus(state, [
      "Requirements",
      "- Kubernetes experience",
      "- Certifications",
    ].join("\n"));

    expect(focus.terms.find((term) => term.term === "kubernetes")).toMatchObject({
      matched: true,
      evidence: expect.arrayContaining([
        expect.objectContaining({
          label: "Certifications 1",
          targetId: "field-custom-certifications-0-details",
          isConcrete: true,
        }),
      ]),
    });
    expect(focus.terms.find((term) => term.term === "certifications")).toMatchObject({
      matched: true,
      evidence: expect.arrayContaining([
        expect.objectContaining({
          label: "Certifications heading",
          targetId: "section-title-custom-certifications",
          isConcrete: false,
        }),
      ]),
    });
  });

  it("checks an opted-in role phrase in word order while ignoring punctuation", () => {
    const resume = "Built TypeScript services, improving release reliability.";

    expect(reviewRolePhrase(resume, "TypeScript services")).toMatchObject({
      termCount: 2,
      matched: true,
    });
    expect(reviewRolePhrase(resume, "services TypeScript")).toMatchObject({
      termCount: 2,
      matched: false,
    });
    expect(reviewRolePhrase(resume, "TypeScript")).toMatchObject({
      termCount: 1,
      matched: false,
    });
    expect(reviewRolePhrase("Chart leadership", "art lead")).toMatchObject({
      termCount: 2,
      matched: false,
    });
  });

  it("suggests a small set of exact job-description phrases with transparent matches", () => {
    const suggestions = buildRolePhraseSuggestions(
      "Built TypeScript services and React interfaces for product teams.",
      "Build TypeScript services, partner with product teams, and improve TypeScript services.",
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phrase: "TypeScript services", termCount: 2, matched: true }),
      ]),
    );
  });

  it("normalizes saved export checkpoints and rejects malformed data", () => {
    const state = sampleState();
    const checkpoint = parseExportCheckpoint(
      JSON.stringify({
        fingerprint: "abc",
        exportedAt: "2026-07-09T12:00:00.000Z",
        pageCount: 1,
        issueCount: 0,
        snapshot: { ...state, sectionOrder: ["skills"] },
      }),
    );

    expect(checkpoint?.snapshot?.sectionOrder).toEqual(["skills"]);
    expect(parseExportCheckpoint(JSON.stringify({ fingerprint: "abc" }))).toBeNull();
    expect(parseExportCheckpoint("not json")).toBeNull();
  });

  it("parses version-history backups without applying the browser slot limit early", () => {
    const checkpoints = Array.from({ length: MAX_VERSION_HISTORY + 2 }, (_, index): VersionHistoryItem => ({
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
    ).toHaveLength(MAX_VERSION_HISTORY + 2);
  });

  it("deduplicates version history by resume and role context when merging backups", () => {
    const baseState = sampleState();
    const existing: VersionHistoryItem[] = [
      {
        id: "1",
        savedAt: "2026-07-09T12:00:00.000Z",
        label: "Current",
        fingerprint: "same-resume",
        state: baseState,
        importReview: null,
        roleLabel: "Frontend",
      },
    ];
    const incoming: VersionHistoryItem[] = [
      {
        ...existing[0],
        id: "incoming-duplicate",
      },
      {
        ...existing[0],
        id: "incoming-new-role",
        savedAt: "2026-07-10T12:00:00.000Z",
        label: "Backend",
        roleLabel: "Backend",
      },
    ];

    const merged = mergeVersionHistory(existing, incoming);

    expect(merged.matchingCheckpoints).toHaveLength(1);
    expect(merged.incomingUnique).toHaveLength(1);
    expect(merged.checkpoints.map((item) => item.label)).toEqual(["Backend", "Current"]);
    expect(versionHistoryFingerprint(existing[0])).toBe(`same-resume\u0000${roleContextFingerprint(undefined, "Frontend")}`);
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
        expect.objectContaining({ id: "skills", targetId: "field-skills" }),
      ]),
    );
  });

  it("summarizes version content badges from normalized resume content", () => {
    expect(versionContentBadges(emptyState())).toEqual(["Empty draft"]);
    expect(versionContentBadges(sampleState())).toEqual(
      expect.arrayContaining(["2 roles", "1 education", "1 project", "4 skill lines"]),
    );
  });
});
