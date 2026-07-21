import { Document, Font, Link, Page, Text, View, pdf } from "@react-pdf/renderer";
import {
  contactHref,
  entryHasContent,
  entryOrgLine,
  formatEntryDates,
  getSectionEntries,
  getSectionFormat,
  getSectionTagGroups,
  getSectionText,
  getSectionTitle,
  normalizeAccent,
  resumeHeaderLinks,
  visibleSectionOrder,
  type ResumeState,
} from "@/lib/resume";
import { inlineRuns, parseRichContent, stripRichMarks } from "@/lib/rich-text";

const LETTER_SIZE: [number, number] = [612, 792];
const VERTICAL_MARGIN = 0.4 * 72;
type ResumePdfBreak = { targetId: string };

const PDF_FONT_FAMILIES = {
  merriweather: "Resume Merriweather",
  georgia: "Resume Gelasio",
  times: "Resume Tinos",
  inter: "Resume Inter",
  arial: "Resume Arimo",
  calibri: "Resume Carlito",
} as const;

let fontsRegistered = false;

function registerPdfFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;

  for (const [fontId, family] of Object.entries(PDF_FONT_FAMILIES)) {
    const assetName = fontId === "georgia" ? "gelasio" : fontId === "times" ? "tinos" : fontId;
    Font.register({
      family,
      fonts: [
        { src: `/fonts/resume/${assetName}-400-normal.woff`, fontWeight: 400 },
        {
          src: `/fonts/resume/${assetName}-400-italic.woff`,
          fontWeight: 400,
          fontStyle: "italic",
        },
        { src: `/fonts/resume/${assetName}-700-normal.woff`, fontWeight: 700 },
        {
          src: `/fonts/resume/${assetName}-700-italic.woff`,
          fontWeight: 700,
          fontStyle: "italic",
        },
      ],
    });
  }

  // Resume prose should not acquire renderer-specific discretionary hyphens.
  // Keeping words intact also makes PDF text extraction more predictable.
  Font.registerHyphenationCallback((word) => [word]);
}

type PdfTheme = {
  accent: string;
  baseFontSize: number;
  bullet: string;
  entryGap: number;
  fontFamily: string;
  headingGap: number;
  horizontalMargin: number;
  lineHeight: number;
  sectionGap: number;
};

function pdfTheme(state: ResumeState): PdfTheme {
  const compact = state.theme.density === "compact";
  const cozy = state.theme.density === "cozy";
  const baseFontSize = (compact ? 9.35 : 10) * state.textScale;

  return {
    accent: normalizeAccent(state.theme.accent),
    baseFontSize,
    bullet:
      state.theme.bulletStyle === "dash" ? "–" : state.theme.bulletStyle === "circle" ? "◦" : "•",
    entryGap: compact ? 3.75 : 6,
    fontFamily:
      PDF_FONT_FAMILIES[state.theme.font as keyof typeof PDF_FONT_FAMILIES] ??
      PDF_FONT_FAMILIES.merriweather,
    headingGap: compact ? 3 : 4.5,
    horizontalMargin: (compact ? 0.42 : cozy ? 0.46 : 0.5) * 72,
    lineHeight: compact ? 1.26 : cozy ? 1.3 : 1.35,
    sectionGap: compact ? 4.5 : cozy ? 5.25 : 6.75,
  };
}

function InlineRuns({ value, theme }: { value: string; theme: PdfTheme }) {
  return inlineRuns(value).map((run, index) => (
    <Text
      key={`${index}-${run.text}`}
      style={{
        fontFamily: theme.fontFamily,
        fontStyle: run.italic ? "italic" : "normal",
        fontWeight: run.bold ? 700 : 400,
        textDecoration: run.underline ? "underline" : "none",
      }}
    >
      {run.text}
    </Text>
  ));
}

function RichBlocks({
  value,
  legacyFormat,
  theme,
  compact = false,
}: {
  value: string;
  legacyFormat: string;
  theme: PdfTheme;
  compact?: boolean;
}) {
  let ordinal = 0;
  return parseRichContent(value, legacyFormat).map((block, index) => {
    if (block.type === "paragraph") {
      ordinal = 0;
      return (
        <Text
          key={`${index}-${block.html}`}
          orphans={2}
          widows={2}
          style={{ marginBottom: compact ? 1.5 : 2.25 }}
        >
          <InlineRuns value={block.html} theme={theme} />
        </Text>
      );
    }

    ordinal = block.type === "number" ? ordinal + 1 : 0;
    const marker = block.type === "number" ? `${ordinal}.` : theme.bullet;
    return (
      <View
        key={`${index}-${block.html}`}
        wrap={false}
        style={{ flexDirection: "row", marginBottom: 0.75, paddingLeft: 0.75 }}
      >
        <Text style={{ width: 11.25 }}>{marker}</Text>
        <Text style={{ flexGrow: 1, flexBasis: 0 }}>
          <InlineRuns value={block.html} theme={theme} />
        </Text>
      </View>
    );
  });
}

function SectionHeading({
  title,
  state,
  theme,
}: {
  title: string;
  state: ResumeState;
  theme: PdfTheme;
}) {
  if (!title) return null;

  const style = {
    color: theme.accent,
    fontSize: theme.baseFontSize * (state.theme.headingStyle === "underline" ? 1 : 1.05),
    fontWeight: 700,
    letterSpacing: state.theme.headingStyle === "underline" ? 0.6 : 0.75,
    marginBottom: theme.headingGap,
    paddingBottom: 1.5,
    textTransform: "uppercase",
    ...(state.theme.headingStyle === "ruled"
      ? { borderBottomColor: theme.accent, borderBottomWidth: 0.8 }
      : {}),
    ...(state.theme.headingStyle === "underline"
      ? { borderBottomColor: theme.accent, borderBottomWidth: 0.75 }
      : {}),
    ...(state.theme.headingStyle === "bar"
      ? {
          borderLeftColor: theme.accent,
          borderLeftWidth: 2.25,
          paddingBottom: 0,
          paddingLeft: 6,
        }
      : {}),
  } as const;

  return (
    <Text minPresenceAhead={36} style={style}>
      {title}
    </Text>
  );
}

function Entry({
  entry,
  forceBreak,
  theme,
}: {
  entry: ReturnType<typeof getSectionEntries>[number];
  forceBreak: boolean;
  theme: PdfTheme;
}) {
  const dates = formatEntryDates(entry);
  const organization = entryOrgLine(entry);
  const hasDetails = Boolean(stripRichMarks(entry.details).trim());

  return (
    <View break={forceBreak} style={{ marginBottom: theme.entryGap }}>
      <View minPresenceAhead={hasDetails ? 24 : 0} wrap={false}>
        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
          <Text style={{ flexGrow: 1, flexBasis: 0, fontWeight: 700 }}>{entry.title}</Text>
          {dates ? (
            <Text
              style={{
                color: "#333333",
                fontSize: theme.baseFontSize * 0.9,
                marginLeft: 9,
                textAlign: "right",
              }}
            >
              {dates}
            </Text>
          ) : null}
        </View>
        {organization ? (
          <Text style={{ fontStyle: "italic", marginTop: 0.75 }}>{organization}</Text>
        ) : null}
      </View>
      {hasDetails ? (
        <View style={{ marginTop: 2.25 }}>
          <RichBlocks value={entry.details} legacyFormat="bullets" theme={theme} compact />
        </View>
      ) : null}
    </View>
  );
}

function ResumeSection({
  printBreaks,
  section,
  state,
  theme,
}: {
  printBreaks: ResumePdfBreak[];
  section: string;
  state: ResumeState;
  theme: PdfTheme;
}) {
  const title = getSectionTitle(state, section).trim();
  const format = getSectionFormat(state, section);
  const sectionBreak = printBreaks.some((item) => item.targetId === `section:${section}`);

  if (format === "tag-groups") {
    const groups = getSectionTagGroups(state, section).filter(
      (group) => group.label || group.tags.length,
    );
    if (!groups.length) return null;
    return (
      <View break={sectionBreak} style={{ marginBottom: theme.sectionGap }}>
        <SectionHeading title={title} state={state} theme={theme} />
        {groups.map((group) => (
          <Text key={group.id} style={{ marginBottom: 1.5 }}>
            {group.label ? <Text style={{ fontWeight: 700 }}>{group.label}: </Text> : null}
            {group.tags.join(" · ")}
          </Text>
        ))}
      </View>
    );
  }

  if (format === "text") {
    const value = getSectionText(state, section).trim();
    if (!value) return null;
    return (
      <View break={sectionBreak} style={{ marginBottom: theme.sectionGap }}>
        <SectionHeading title={title} state={state} theme={theme} />
        <View
          style={{
            fontSize: theme.baseFontSize * 0.9,
            lineHeight: 1.45,
          }}
        >
          <RichBlocks value={value} legacyFormat="bullets" theme={theme} compact />
        </View>
      </View>
    );
  }

  const entries = getSectionEntries(state, section)
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .filter(({ entry }) => entryHasContent(entry));
  if (!entries.length) return null;
  return (
    <View break={sectionBreak} style={{ marginBottom: theme.sectionGap }}>
      <SectionHeading title={title} state={state} theme={theme} />
      {entries.map(({ entry, originalIndex }) => (
        <Entry
          key={`${section}-${originalIndex}`}
          entry={entry}
          forceBreak={printBreaks.some(
            (item) => item.targetId === `entry:${section}:${originalIndex}`,
          )}
          theme={theme}
        />
      ))}
    </View>
  );
}

function ResumePdfDocument({
  printBreaks,
  state,
}: {
  printBreaks: ResumePdfBreak[];
  state: ResumeState;
}) {
  const theme = pdfTheme(state);
  const contacts = [
    { value: state.email, href: contactHref("email", state.email) },
    { value: state.phone, href: contactHref("phone", state.phone) },
    { value: state.location, href: undefined },
    ...resumeHeaderLinks(state).map((link) => ({
      value: link.url,
      href: contactHref("website", link.url),
    })),
  ].filter(({ value }) => Boolean(value.trim()));
  const centered = state.theme.headerAlign === "center";

  return (
    <Document
      author="PrivaCV"
      creator="PrivaCV"
      producer="PrivaCV"
      subject="Resume"
      title={state.name ? `${state.name} Resume` : "Resume"}
    >
      <Page
        size={LETTER_SIZE}
        wrap
        style={{
          color: "#000000",
          fontFamily: theme.fontFamily,
          fontSize: theme.baseFontSize,
          lineHeight: theme.lineHeight,
          paddingBottom: VERTICAL_MARGIN,
          paddingHorizontal: theme.horizontalMargin,
          paddingTop: VERTICAL_MARGIN,
        }}
      >
        <Text
          style={{
            color: theme.accent,
            fontSize: theme.baseFontSize * 1.9,
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: 2.25,
            textAlign: centered ? "center" : "left",
          }}
        >
          {state.name || "Your Name"}
        </Text>
        {state.title ? (
          <Text
            style={{
              fontSize: theme.baseFontSize * 1.05,
              fontStyle: "italic",
              marginBottom: 2.25,
              textAlign: centered ? "center" : "left",
            }}
          >
            {state.title}
          </Text>
        ) : null}
        {contacts.length ? (
          <Text
            style={{
              borderBottomColor: theme.accent,
              borderBottomWidth: state.theme.headerDivider ? 0.75 : 0,
              color: "#333333",
              fontSize: theme.baseFontSize * 0.9,
              marginBottom: 6,
              paddingBottom: state.theme.headerDivider ? 5.25 : 0,
              textAlign: centered ? "center" : "left",
            }}
          >
            {contacts.map(({ value, href }, index) => (
              <Text key={`${value}-${index}`}>
                {index ? "  •  " : ""}
                {href ? (
                  <Link src={href} style={{ color: "#333333", textDecoration: "none" }}>
                    {value}
                  </Link>
                ) : (
                  value
                )}
              </Text>
            ))}
          </Text>
        ) : null}
        {stripRichMarks(state.summary).trim() ? (
          <View
            style={{
              fontSize: theme.baseFontSize * 0.95,
              lineHeight: theme.lineHeight,
              marginBottom: 7.5,
            }}
          >
            <RichBlocks value={state.summary} legacyFormat="paragraph" theme={theme} />
          </View>
        ) : null}
        {visibleSectionOrder(state).map((section) => (
          <ResumeSection
            key={section}
            printBreaks={printBreaks}
            section={section}
            state={state}
            theme={theme}
          />
        ))}
      </Page>
    </Document>
  );
}

/** Generate a deterministic, selectable-text PDF entirely in the browser. */
export async function resumePdfBlob(state: ResumeState, printBreaks: ResumePdfBreak[] = []) {
  registerPdfFonts();
  return pdf(<ResumePdfDocument printBreaks={printBreaks} state={state} />).toBlob();
}
