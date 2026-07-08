/* ============================================================
   Resume Editor — state, binding, live preview, PDF export
   ============================================================ */

const STORAGE_KEY = "resume-editor-data-v1";

// Field labels per repeatable section
const ENTRY_SCHEMA = {
  experience: {
    title: "Job Title",
    subtitle: "Company",
    meta: "Dates (e.g. Jan 2020 – Present)",
    details: "Responsibilities / achievements (one bullet per line)",
  },
  education: {
    title: "Degree",
    subtitle: "School",
    meta: "Dates / Location",
    details: "Details (one bullet per line, optional)",
  },
  projects: {
    title: "Project Name",
    subtitle: "Technologies / Role",
    meta: "Dates / Link",
    details: "Description (one bullet per line)",
  },
};

function blankEntry() {
  return { title: "", subtitle: "", meta: "", details: "" };
}

// Body sections, in their default order (Education first).
const SECTIONS = ["education", "experience", "projects", "skills"];
const SECTION_LABELS = {
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  skills: "Skills",
};

function emptyState() {
  return {
    name: "",
    title: "",
    email: "",
    phone: "",
    location: "",
    website: "",
    summary: "",
    skills: "",
    experience: [blankEntry()],
    education: [blankEntry()],
    projects: [],
    sectionOrder: SECTIONS.slice(),
    textScale: 1,
  };
}

const MIN_SCALE = 0.8;
const MAX_SCALE = 1.3;

let state = emptyState();

/* ---------------- DOM helpers ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

/* ---------------- Bind simple fields ---------------- */
function bindSimpleFields() {
  $$("[data-bind]").forEach((input) => {
    const key = input.getAttribute("data-bind");
    input.value = state[key] || "";
    input.addEventListener("input", () => {
      state[key] = input.value;
      renderPreview();
      persistSoft();
    });
  });
}

/* ---------------- Repeatable entry sections ---------------- */
function renderEntrySection(section) {
  const listEl = $(`#${section}List`);
  const schema = ENTRY_SCHEMA[section];
  listEl.innerHTML = "";

  state[section].forEach((entry, index) => {
    const card = el("div", { class: "entry" });

    const bar = el("div", { class: "entry__bar" });

    const reorder = el("div", { class: "reorder" });
    const up = el("button", { type: "button", "aria-label": "Move entry up", title: "Move up", text: "↑" });
    const down = el("button", { type: "button", "aria-label": "Move entry down", title: "Move down", text: "↓" });
    up.disabled = index === 0;
    down.disabled = index === state[section].length - 1;
    up.addEventListener("click", () => moveEntry(section, index, -1));
    down.addEventListener("click", () => moveEntry(section, index, 1));
    reorder.appendChild(up);
    reorder.appendChild(down);

    const removeBtn = el("button", { class: "entry__remove", type: "button", text: "Remove" });
    removeBtn.addEventListener("click", () => {
      state[section].splice(index, 1);
      renderEntrySection(section);
      renderPreview();
      persistSoft();
    });

    bar.appendChild(reorder);
    bar.appendChild(removeBtn);
    card.appendChild(bar);

    card.appendChild(makeField(schema.title, entry.title, (v) => (entry.title = v)));
    card.appendChild(makeField(schema.subtitle, entry.subtitle, (v) => (entry.subtitle = v)));
    card.appendChild(makeField(schema.meta, entry.meta, (v) => (entry.meta = v)));
    card.appendChild(makeField(schema.details, entry.details, (v) => (entry.details = v), true));

    listEl.appendChild(card);
  });
}

// Move an entry within its section up (-1) or down (+1).
function moveEntry(section, index, dir) {
  const list = state[section];
  const j = index + dir;
  if (j < 0 || j >= list.length) return;
  [list[index], list[j]] = [list[j], list[index]];
  renderEntrySection(section);
  renderPreview();
  persistSoft();
}

function makeField(labelText, value, onChange, multiline = false) {
  const label = el("label", { class: "field" });
  label.appendChild(el("span", { text: labelText }));
  const input = multiline
    ? el("textarea", { rows: "3" })
    : el("input", { type: "text" });
  input.value = value || "";
  input.addEventListener("input", () => {
    onChange(input.value);
    renderPreview();
    persistSoft();
  });
  label.appendChild(input);
  return label;
}

function wireAddButtons() {
  $$("[data-add]").forEach((btn) => {
    const section = btn.getAttribute("data-add");
    btn.addEventListener("click", () => {
      state[section].push(blankEntry());
      renderEntrySection(section);
      renderPreview();
      persistSoft();
    });
  });
}

/* ---------------- Section reordering ---------------- */
// Build ↑/↓ controls in each section's bar and reorder both the
// editor panels and the preview to match state.sectionOrder.
function initReorder() {
  SECTIONS.forEach((key) => {
    const panel = document.querySelector(`.field-group[data-section="${key}"]`);
    if (!panel) return;
    const bar = panel.querySelector(".field-group__bar");
    if (!bar) return;

    const tools = el("div", { class: "field-group__tools" });
    // Move the existing "+ Add" button (if any) into the tools group.
    const addBtn = bar.querySelector("[data-add]");

    const reorder = el("div", { class: "reorder" });
    const up = el("button", { type: "button", "aria-label": `Move ${key} up`, title: "Move up", text: "↑" });
    const down = el("button", { type: "button", "aria-label": `Move ${key} down`, title: "Move down", text: "↓" });
    up.addEventListener("click", () => moveSection(key, -1));
    down.addEventListener("click", () => moveSection(key, 1));
    reorder.appendChild(up);
    reorder.appendChild(down);

    tools.appendChild(reorder);
    if (addBtn) tools.appendChild(addBtn);
    bar.appendChild(tools);

    panel._upBtn = up;
    panel._downBtn = down;
  });
  syncEditorOrder();
}

function moveSection(key, dir) {
  const order = state.sectionOrder;
  const i = order.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  syncEditorOrder();
  renderPreview();
  persistSoft();
}

function syncEditorOrder() {
  const panels = {};
  SECTIONS.forEach((k) => {
    panels[k] = document.querySelector(`.field-group[data-section="${k}"]`);
  });
  const parent = panels[SECTIONS[0]] && panels[SECTIONS[0]].parentNode;
  if (!parent) return;
  // Re-append in the chosen order; they move to the end, after the
  // fixed Header/Summary panels which keep their positions.
  state.sectionOrder.forEach((k) => panels[k] && parent.appendChild(panels[k]));
  // Disable arrows at the ends.
  state.sectionOrder.forEach((k, idx) => {
    const p = panels[k];
    if (!p) return;
    if (p._upBtn) p._upBtn.disabled = idx === 0;
    if (p._downBtn) p._downBtn.disabled = idx === state.sectionOrder.length - 1;
  });
}

/* ---------------- Preview rendering ---------------- */
function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function bulletsFrom(details) {
  return String(details || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function allBullets() {
  return ["experience", "education", "projects"].flatMap((section) =>
    state[section].flatMap((entry) => bulletsFrom(entry.details))
  );
}

function hasAnyContent() {
  if (state.name || state.title || state.summary || state.skills) return true;
  if (state.email || state.phone || state.location || state.website) return true;
  return ["experience", "education", "projects"].some((s) =>
    state[s].some((e) => e.title || e.subtitle || e.meta || e.details)
  );
}

function updateStartPanel() {
  const panel = $("#startPanel");
  if (!panel) return;
  panel.hidden = hasAnyContent();
}

function buildResumeChecks(pageCount) {
  const missingContact = [
    ["name", "name"],
    ["email", "email"],
    ["phone", "phone"],
    ["location", "location"],
  ]
    .filter(([key]) => !String(state[key] || "").trim())
    .map(([, label]) => label);

  const bullets = allBullets();
  const longBullets = bullets.filter((bullet) => wordCount(bullet) > 28);
  const summaryWords = wordCount(state.summary);

  return [
    {
      label: "Length",
      ok: pageCount <= 1,
      detail: pageCount <= 1 ? "One-page PDF" : `${pageCount} pages in preview`,
    },
    {
      label: "Contact",
      ok: missingContact.length === 0,
      detail: missingContact.length
        ? `Missing ${missingContact.join(", ")}`
        : "Core details present",
    },
    {
      label: "Bullets",
      ok: bullets.length > 0 && longBullets.length === 0,
      detail: longBullets.length
        ? `${longBullets.length} over 28 words`
        : bullets.length
          ? "Concise bullet length"
          : "Add achievement bullets",
    },
    {
      label: "Summary",
      ok: summaryWords > 0 && summaryWords <= 65,
      detail: summaryWords === 0
        ? "Missing summary"
        : summaryWords > 65
          ? `${summaryWords} words`
          : "Focused opening",
    },
  ];
}

function renderResumeCheck(pageCount = 1) {
  const panel = $("#resumeCheck");
  const title = $("#resumeCheckTitle");
  const score = $("#resumeCheckScore");
  const list = $("#resumeCheckList");
  if (!panel || !title || !score || !list) return;

  if (!hasAnyContent()) {
    panel.hidden = true;
    return;
  }

  const checks = buildResumeChecks(pageCount);
  const passed = checks.filter((check) => check.ok).length;
  panel.hidden = false;
  title.textContent = passed === checks.length ? "Ready to export" : "Needs attention";
  score.textContent = `${passed}/${checks.length}`;
  list.innerHTML = "";

  checks.forEach((check) => {
    const item = el("div", {
      class: `resume-check__item ${check.ok ? "is-ok" : "is-warn"}`,
    });
    item.appendChild(el("span", { class: "resume-check__mark", text: check.ok ? "✓" : "!" }));
    const copy = el("div", { class: "resume-check__copy" });
    copy.appendChild(el("strong", { text: check.label }));
    copy.appendChild(el("span", { text: check.detail }));
    item.appendChild(copy);
    list.appendChild(item);
  });
}

function entryHtml(entry) {
  const bullets = bulletsFrom(entry.details);
  const head = `
    <div class="resume__entry-head">
      <div>${entry.title ? `<span class="resume__entry-role">${esc(entry.title)}</span>` : ""}</div>
      ${entry.meta ? `<div class="resume__entry-meta">${esc(entry.meta)}</div>` : ""}
    </div>`;
  const sub = entry.subtitle
    ? `<div class="resume__entry-sub">${esc(entry.subtitle)}</div>`
    : "";
  const list = bullets.length
    ? `<ul class="resume__bullets">${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
    : "";
  return `<div class="resume__entry">${head}${sub}${list}</div>`;
}

function sectionHtml(label, section) {
  const entries = state[section].filter(
    (e) => e.title || e.subtitle || e.meta || e.details
  );
  if (!entries.length) return "";
  return `
    <div class="resume__section">
      <h2 class="resume__section-title">${label}</h2>
      ${entries.map(entryHtml).join("")}
    </div>`;
}

function skillsHtml() {
  const lines = String(state.skills || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return "";
  const items = lines
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx > -1) {
        const cat = line.slice(0, idx).trim();
        const rest = line.slice(idx + 1).trim();
        return `<div class="resume__skill-line"><span class="resume__skill-cat">${esc(cat)}:</span> ${esc(rest)}</div>`;
      }
      return `<div class="resume__skill-line">${esc(line)}</div>`;
    })
    .join("");
  return `
    <div class="resume__section">
      <h2 class="resume__section-title">Skills</h2>
      <div class="resume__skills">${items}</div>
    </div>`;
}

// Letter page height in CSS px (1in = 96px) minus a safety margin so
// browser sub-pixel rounding can't spill a sheet onto a second page.
const PAGE_LIMIT_PX = 11 * 96 - 16;

function renderPreview() {
  const pagesEl = $("#pages");
  pagesEl.style.setProperty("--text-scale", String(state.textScale));
  updateStartPanel();

  if (!hasAnyContent()) {
    pagesEl.innerHTML = "";
    const sheet = el("div", { class: "resume resume--empty" });
    sheet.innerHTML = `
      <div class="resume__empty-guide" aria-label="Empty resume preview">
        <p class="resume__empty-kicker">Clean one-page structure</p>
        <h1 class="resume__name">Your Name</h1>
        <div class="resume__contact">
          <span>email@example.com</span><span>(555) 123-4567</span><span>City, ST</span><span>linkedin.com/in/you</span>
        </div>
        <div class="resume__empty-line resume__empty-line--wide"></div>
        <div class="resume__empty-line"></div>
        <div class="resume__section">
          <h2 class="resume__section-title">Experience</h2>
          <div class="resume__empty-role"></div>
          <ul class="resume__bullets">
            <li>Lead with measurable impact, scope, and outcomes.</li>
            <li>Keep each bullet concise enough to scan quickly.</li>
          </ul>
        </div>
        <div class="resume__section">
          <h2 class="resume__section-title">Skills</h2>
          <div class="resume__empty-line resume__empty-line--short"></div>
        </div>
      </div>`;
    pagesEl.appendChild(sheet);
    renderResumeCheck(1);
    return;
  }

  const contactParts = [state.email, state.phone, state.location, state.website]
    .filter(Boolean)
    .map((p) => `<span>${esc(p)}</span>`)
    .join("");

  const summary = state.summary
    ? `<p class="resume__lead">${esc(state.summary)}</p>`
    : "";

  // Build the full document in a detached node, then paginate it.
  const source = el("div");
  source.innerHTML = `
    <h1 class="resume__name">${esc(state.name) || "Your Name"}</h1>
    ${state.title ? `<div class="resume__title">${esc(state.title)}</div>` : ""}
    ${contactParts ? `<div class="resume__contact">${contactParts}</div>` : ""}
    ${summary}
    ${state.sectionOrder.map(renderSectionByKey).join("")}
  `;

  const pageCount = paginate(flowUnits(source), pagesEl);
  renderResumeCheck(pageCount);
}

function renderSectionByKey(key) {
  if (key === "skills") return skillsHtml();
  return sectionHtml(SECTION_LABELS[key], key);
}

// Flatten the document into a list of placeable blocks. Sections are
// unwrapped so entries can flow across pages; the section heading is
// flagged so it never sits alone at the bottom of a page.
function flowUnits(source) {
  const units = [];
  Array.from(source.children).forEach((child) => {
    if (child.classList.contains("resume__section")) {
      Array.from(child.children).forEach((node) => {
        units.push({
          node,
          keepWithNext: node.classList.contains("resume__section-title"),
        });
      });
    } else {
      units.push({ node: child, keepWithNext: false });
    }
  });
  return units;
}

// Distribute blocks into Letter-sized .resume sheets by measuring height.
// When an entry doesn't fit, its bullet list is split across the page break
// (keeping the heading with at least its first bullet) so pages fill up
// instead of leaving a gap — matching how a PDF actually flows.
function paginate(units, pagesEl) {
  pagesEl.innerHTML = "";

  let page;
  let count;
  const newSheet = (initial) => {
    page = el("div", { class: "resume" });
    page.style.minHeight = "0"; // measure true content height while filling
    pagesEl.appendChild(page);
    count = 0;
    (initial || []).forEach((n) => {
      page.appendChild(n);
      count++;
    });
  };
  const fits = () => page.offsetHeight <= PAGE_LIMIT_PX;

  newSheet();

  units.forEach((u) => {
    page.appendChild(u.node);
    count++;
    if (fits()) return;

    // Try to split an entry's bullet list to fill the rest of the page.
    const ul = u.node.classList.contains("resume__entry")
      ? u.node.querySelector(".resume__bullets")
      : null;
    if (ul && ul.children.length > 1) {
      const removed = [];
      while (!fits() && ul.children.length > 1) {
        removed.unshift(ul.removeChild(ul.lastElementChild));
      }
      if (fits() && removed.length) {
        const cont = el("div", { class: "resume__entry" });
        const contUl = el("ul", { class: "resume__bullets" });
        removed.forEach((li) => contUl.appendChild(li));
        cont.appendChild(contUl);
        newSheet([cont]);
        return;
      }
      removed.forEach((li) => ul.appendChild(li)); // restore; couldn't split usefully
    }

    if (count === 1) return; // nothing above it; let this one page overflow

    // Move the whole block to a new page, taking a trailing section
    // heading with it so the heading is never orphaned at the foot.
    page.removeChild(u.node);
    count--;
    const moved = [u.node];
    const last = page.lastElementChild;
    if (count >= 1 && last && last.classList.contains("resume__section-title")) {
      page.removeChild(last);
      count--;
      moved.unshift(last);
    }
    newSheet(moved);
  });

  // Restore full-page look (min-height back to the stylesheet's 11in).
  Array.from(pagesEl.children).forEach((p) => (p.style.minHeight = ""));
  return pagesEl.children.length;
}

/* ---------------- Persistence ---------------- */
let persistTimer = null;
function persistSoft() {
  // debounce auto-save to localStorage
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage may be unavailable; ignore */
    }
  }, 400);
}

// Download the current resume as a .json file the user can keep on disk.
function saveJsonFile() {
  try {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const safeName = (state.name || "resume")
      .trim()
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const a = el("a", { href: url, download: `${safeName || "resume"}.json` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    flash("Saved JSON to your downloads");
  } catch (e) {
    flash("Could not save JSON");
  }
}

// Load a previously saved .json file from disk.
function openJsonFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = normalize(JSON.parse(reader.result));
      rebuildAll();
      persistSoft();
      flash("Loaded JSON");
    } catch (e) {
      flash("That file isn't a valid resume JSON");
    }
  };
  reader.onerror = () => flash("Could not read file");
  reader.readAsText(file);
}

function normalize(data) {
  const base = emptyState();
  const merged = Object.assign(base, data || {});
  ["experience", "education", "projects"].forEach((s) => {
    if (!Array.isArray(merged[s])) merged[s] = [];
    merged[s] = merged[s].map((e) => Object.assign(blankEntry(), e));
  });
  // Keep section order valid: only known sections, no dupes, all present.
  const order = Array.isArray(merged.sectionOrder)
    ? merged.sectionOrder.filter((k, i, a) => SECTIONS.includes(k) && a.indexOf(k) === i)
    : [];
  SECTIONS.forEach((k) => {
    if (!order.includes(k)) order.push(k);
  });
  merged.sectionOrder = order;
  // Clamp the text scale into the supported range.
  const s = parseFloat(merged.textScale);
  merged.textScale = isNaN(s) ? 1 : Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
  return merged;
}

// Sync the slider UI to state.textScale. The scale itself is applied
// (and the document re-paginated) by renderPreview.
function applyTextScale() {
  const slider = $("#textScale");
  const out = $("#textScaleOut");
  if (slider) slider.value = String(state.textScale);
  if (out) out.textContent = Math.round(state.textScale * 100) + "%";
}

/* ---------------- Toast ---------------- */
let toastEl = null;
function flash(msg) {
  if (!toastEl) {
    toastEl = el("div", {});
    Object.assign(toastEl.style, {
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#2f3640",
      color: "#fff",
      padding: "8px 16px",
      borderRadius: "6px",
      fontSize: "13px",
      zIndex: "1000",
      opacity: "0",
      transition: "opacity 0.2s ease",
      pointerEvents: "none",
    });
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.style.opacity = "1";
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => (toastEl.style.opacity = "0"), 1400);
}

/* ---------------- Sample data ---------------- */
function sampleState() {
  return normalize({
    name: "Jane Doe",
    title: "",
    email: "jane.doe@example.com",
    phone: "(555) 123-4567",
    location: "San Francisco, CA",
    website: "linkedin.com/in/janedoe",
    summary:
      "Software engineer specializing in applied AI, scaling backend microservices, and optimizing system performance to support high-traffic, production-grade applications.",
    experience: [
      {
        title: "Senior Software Engineer",
        subtitle: "Acme Corp • San Francisco, CA",
        meta: "Jan 2021 – Present",
        details:
          "Led migration of monolith to microservices, cutting deploy time by 60%.\nMentored a team of 5 engineers and established code review standards.\nDesigned the billing service handling $40M in annual transactions.",
      },
      {
        title: "Software Engineer",
        subtitle: "Globex Inc • Palo Alto, CA",
        meta: "Jun 2017 – Dec 2020",
        details:
          "Built customer-facing analytics dashboard used by 10,000+ businesses.\nImproved API response times by 45% through query optimization.",
      },
    ],
    education: [
      {
        title: "B.S. in Computer Science",
        subtitle: "University of California, Berkeley • Berkeley, CA",
        meta: "2013 – 2017",
        details: "",
      },
    ],
    projects: [
      {
        title: "Verichain",
        subtitle: "React, Node.js, Solidity, Web3",
        meta: "",
        details:
          "Built a decentralized open-data marketplace letting consumers bid on high-value IoT data.\nExecuted transactions on the Ethereum testnet via MetaMask.",
      },
    ],
    skills:
      "Languages: JavaScript, TypeScript, Python, Go\nFrameworks: React, Node.js, Django\nDatabases: PostgreSQL, MongoDB, Redis\nTools: Docker, Kubernetes, AWS, Terraform",
  });
}

/* ---------------- Rebuild everything ---------------- */
function rebuildAll() {
  $$("[data-bind]").forEach((input) => {
    const key = input.getAttribute("data-bind");
    input.value = state[key] || "";
  });
  ["experience", "education", "projects"].forEach(renderEntrySection);
  syncEditorOrder();
  renderPreview();
  applyTextScale();
}

/* ---------------- Apply parsed PDF import ---------------- */
// Called by pdf-import.js after extracting text from an uploaded resume PDF.
function applyParsedResume(partial) {
  const next = emptyState();
  ["name", "title", "email", "phone", "location", "website", "summary", "skills"].forEach((k) => {
    if (partial[k]) next[k] = partial[k];
  });
  ["experience", "education", "projects"].forEach((s) => {
    if (Array.isArray(partial[s]) && partial[s].length) {
      next[s] = partial[s].map((e) => Object.assign(blankEntry(), e));
    } else {
      next[s] = s === "experience" ? [blankEntry()] : [];
    }
  });
  state = next;
  rebuildAll();
  persistSoft();
  flash("Imported from PDF — please review");
}
window.applyParsedResume = applyParsedResume;

/* ---------------- Export to PDF ---------------- */
function exportPdf() {
  // Browser print dialog → "Save as PDF". Print CSS isolates the resume
  // and prints it at its real size, paginating across pages if needed.
  window.print();
}

/* ---------------- Init ---------------- */
function init() {
  // try to restore any auto-saved data
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = normalize(JSON.parse(raw));
  } catch (e) {
    /* ignore */
  }

  bindSimpleFields();
  wireAddButtons();
  initReorder();
  ["experience", "education", "projects"].forEach(renderEntrySection);
  syncEditorOrder();
  renderPreview();
  applyTextScale();

  // The serif loads asynchronously; re-paginate once it's ready so page
  // breaks are measured with the real font, not the fallback.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(renderPreview);
  }

  const slider = $("#textScale");
  slider.addEventListener("input", () => {
    state.textScale = parseFloat(slider.value);
    applyTextScale();
    renderPreview(); // re-paginate at the new size
    persistSoft();
  });

  $("#btnExport").addEventListener("click", exportPdf);
  $("#btnSave").addEventListener("click", saveJsonFile);
  const jsonInput = $("#jsonInput");
  $("#btnLoad").addEventListener("click", () => jsonInput.click());
  const startLoad = $("#btnStartLoad");
  if (startLoad) startLoad.addEventListener("click", () => jsonInput.click());
  const startImport = $("#btnStartImport");
  if (startImport) startImport.addEventListener("click", () => $("#pdfInput").click());
  const startSample = $("#btnStartSample");
  if (startSample) startSample.addEventListener("click", () => {
    state = sampleState();
    rebuildAll();
    persistSoft();
    flash("Sample loaded");
  });
  jsonInput.addEventListener("change", () => {
    openJsonFile(jsonInput.files[0]);
    jsonInput.value = ""; // allow re-opening the same file
  });
  $("#btnSample").addEventListener("click", () => {
    state = sampleState();
    rebuildAll();
    persistSoft();
    flash("Sample loaded");
  });
  $("#btnClear").addEventListener("click", () => {
    if (!confirm("Clear all fields? This cannot be undone.")) return;
    state = emptyState();
    rebuildAll();
    persistSoft();
    flash("Cleared");
  });

  // Cmd/Ctrl+P → export
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
      e.preventDefault();
      exportPdf();
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
