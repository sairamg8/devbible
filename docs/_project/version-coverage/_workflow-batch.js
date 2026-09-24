export const meta = {
  name: 'devbible-version-coverage-batch',
  description: 'Per track: which upstream version the content applies up to, vs the supported LTS lines, and every missing/contradicted change — adversarially verified',
  phases: [
    { title: 'Audit', detail: 'one agent per unit: LTS lines, applies-up-to, delta table, coverage grading' },
    { title: 'Verify', detail: 'one skeptic per unit re-checks every gap row and adds omissions' },
  ],
}

const STORE = '/mnt/Storage/my-learning/claude'
const REPO = '/mnt/Storage/Backup/Knowledge/devbible'
const TODAY = args.today
// Tracking moved into the repo 2026-09-24 (docs/_project/); the store's devbible/ is a symlink to it.
const OUT = `${REPO}/docs/_project/version-coverage`
const COMMIT = `${STORE}/shared/scripts/store-commit.sh`

const COUNTS = {
  type: 'object',
  properties: {
    covered: { type: 'number' }, partial: { type: 'number' }, missing: { type: 'number' },
    contradicted: { type: 'number' }, planned: { type: 'number' },
  },
  required: ['covered', 'partial', 'missing', 'contradicted', 'planned'],
}
const GAP = {
  type: 'object',
  properties: { id: { type: 'string' }, since: { type: 'string' }, change: { type: 'string' }, status: { type: 'string' } },
  required: ['id', 'since', 'change', 'status'],
}
const FINDER_SCHEMA = {
  type: 'object',
  properties: {
    unit: { type: 'string' },
    applies_up_to: { type: 'string' },
    floor: { type: 'string' },
    baseline_evidence: { type: 'string' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          line: { type: 'string' }, status: { type: 'string' }, eol: { type: 'string' },
          covered: { type: 'number' }, partial: { type: 'number' }, missing: { type: 'number' }, contradicted: { type: 'number' },
          verdict: { type: 'string' },
        },
        required: ['line', 'status', 'verdict'],
      },
    },
    latest_stable: { type: 'string' },
    next_lts: { type: 'string' },
    counts: COUNTS,
    gaps: { type: 'array', items: GAP },
    stale_claims: { type: 'number' },
    report_files: { type: 'array', items: { type: 'string' } },
    fetch_failures: { type: 'array', items: { type: 'string' } },
  },
  required: ['unit', 'applies_up_to', 'lines', 'counts', 'gaps', 'report_files'],
}
const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    unit: { type: 'string' },
    applies_up_to_agreed: { type: 'boolean' },
    applies_up_to_final: { type: 'string' },
    lts_dates_agreed: { type: 'boolean' },
    corrections: { type: 'string' },
    refuted: { type: 'number' },
    added_by_verify: { type: 'number' },
    final_counts: COUNTS,
    confirmed_gaps: { type: 'array', items: GAP },
    report_files: { type: 'array', items: { type: 'string' } },
  },
  required: ['unit', 'applies_up_to_final', 'refuted', 'final_counts', 'confirmed_gaps', 'report_files'],
}

const RULES = `## Hard rules
1. **READ-ONLY on ${REPO} except your own report files in ${OUT}/.** No other edits, no git commands of your own (commit ONLY through the helper in rule 4), no \`yarn\`, and never \`node scripts/currency.mjs\` (it rewrites a tracked file). grep / rg / sed / find / wc / cat / ls are fine. When grepping the corpus, exclude \`docs/_project/\` — it is tracking, not content.
2. **No sandbox.** Never write or run a program to test behaviour. Evidence is the corpus (grep) and primary sources fetched THIS session.
3. **Every upstream version, date and feature attribution comes from a source you fetched in this session** — the endoflife.date API (\`curl -s https://endoflife.date/api/<product>.json\`), official release notes / changelogs / "what's new" pages / JEP / PEP / proposal pages / GitHub releases. Cite the URL. Never from memory. If a fetch fails, record it in the report and leave the cell as "unverified" — do not fill it from memory. Prefer vendor pages over blogs.
4. **Write only inside ${OUT}/.** Commit each file after each section with:
   \`${COMMIT} "devbible version-coverage: <unit> §<n>" <file(s)>\`
   Never \`git add -A\`, never push. Every file you create gets YAML frontmatter (name / description / metadata.type: project).
5. **300 lines is a FILE-SIZE cap, never a content budget.** When a file would pass 300 lines, continue in \`<unit>-02.md\`, \`-03.md\` … split at a version/section boundary, each with its own frontmatter. Never trim, never cap a list to fit.
6. Quotes from pages or upstream docs: ≤ 15 words each.
7. Today is ${TODAY}.`

function finderPrompt(u) {
  return `You are auditing ONE unit of the devbible corpus (a fullstack reference site) for VERSION COVERAGE. The user's words: *"identify the content explanation up to which version they are applicable — first compare LTS versions — what was missing."*

**Write each section of the report to disk COMPLETELY, and commit it, as soon as you have finished it — before you start the next one. Never hold the report in your head to write at the end.**

## The unit
- **Unit:** \`${u.unit}\` — ${u.label}
- **Corpus dirs (read-only, under ${REPO}):** ${u.dirs.join(' · ')}
- **Pins declared in src/data/pins.js:** ${u.pins}
- **Currency check today:** ${u.currency}
- **Scope notes:** ${u.notes}
- **Report file:** \`${OUT}/${u.unit}.md\`

${RULES}

## Method — the report layout. Write §1…§5 in order, committing after each.

Frontmatter first:
\`\`\`
---
name: version-coverage-${u.unit}
description: <unit · applies up to X · LTS lines compared · gap counts — fill in at the end>
metadata:
  type: project
---
# ${u.label} — version coverage vs LTS (${TODAY})
\`\`\`

**§1 · Upstream release lines.** Fetch the release/support table. List every line supported today (LTS / active / maintenance / security-only) with release date, EOL date and latest patch; then latest stable; then the next LTS/major with its announced date. If the product has no LTS concept, say so and use its published support policy instead (cite its URL). Table + sources.

**§2 · Content baseline — "applies up to".** Measure, never guess:
- a. Grep the \`> Verified:\` / \`> Target:\` / \`> Version spine:\` blockquote lines in the unit's dirs for version strings; give the distribution (count per version).
- b. **Feature probes:** for each release line from the oldest supported LTS to latest, take its headline features from the release notes and grep for them. The highest release whose headline features are taught = "applies up to". Also the floor (the oldest version the content still holds for, and why).
- c. **Stale claims:** grep for "latest", "current", "newest", "recently", "upcoming", "will be", "not yet", "experimental", "preview", "LTS" near version numbers. List every one that is false today (file:line, short quote, why).
- Verdict line: **Content applies up to <version> (floor <version>)** + the evidence in two sentences.

**§3 · The delta table.** Every notable, TEACHABLE change from the oldest supported LTS line through the current LTS, then through latest stable (and anything already shipped toward the next LTS): new APIs / syntax / features, changed defaults, deprecations, removals, security-relevant behaviour, CLI/tooling changes a developer meets. Skip pure bug fixes and perf numbers unless they change what a developer writes. **Exhaustive — no top-N.** Group rows under a sub-heading per release line, oldest first.
Columns: \`# | Since | Change | Kind (new/default/deprecated/removed/security) | Status | Evidence | Source\`
Status is exactly one of:
- **COVERED** — a page TEACHES it (file:line). A passing mention is not coverage.
- **PARTIAL** — mentioned but not taught, or taught in an older shape (file:line + what is missing).
- **MISSING** — no page teaches it (list the ≥2 grep terms tried).
- **CONTRADICTED** — a page presents old / removed / deprecated behaviour as current (file:line + short quote). "vN was X, vN+1 is Y" migration teaching is NOT a contradiction.
- **PLANNED** — not written, but listed in the unit's syllabus as a topic (syllabus file:line).
Grep every item with at least 2 terms (API name, flag, JEP/PEP/proposal number, common phrase), case-insensitive, over the unit's dirs; if it is taught in another docs/ track instead, say so in Evidence and grade by that page.

**§4 · Summary by LTS line.** Per supported line: number of changes and the COVERED / PARTIAL / MISSING / CONTRADICTED / PLANNED split, plus a one-sentence verdict (e.g. "complete for 22 LTS; 7 missing from 24 LTS; 12 from 26").

**§5 · Hand-off to the owning lane.** CONTRADICTED rows first (a live page teaching the wrong thing), then MISSING by version — each with the tier it deserves (Master / Understand / Know / When Needed — the corpus's four tier labels) and the existing page it would sit beside (path, \`ls\`-verified). Also any src/data/pins.js correction you would propose (report only — do not edit).

Finally update the frontmatter description with the real numbers and commit. Return the structured result: \`gaps\` lists EVERY row graded MISSING, PARTIAL or CONTRADICTED (id = the row's # in §3).`
}

function verifyPrompt(u, f) {
  return `You are the ADVERSARIAL VERIFIER for one unit of a devbible version-coverage audit. A finder agent wrote: ${f.report_files.join(', ')}. Read them fully first. Your job is to try to REFUTE every gap it reported — a gap survives only if you also fail to disprove it. Default to skepticism in both directions: a "MISSING" that is actually taught is a false alarm; a "COVERED" pointing at a page that does not teach it is a hidden gap.

**Write your verification to disk and commit it as soon as each part is done — never hold it all to write at the end.**

## The unit
- **Unit:** \`${u.unit}\` — ${u.label}
- **Corpus dirs:** ${u.dirs.join(' · ')}
- **Pins:** ${u.pins}
- **Finder's verdict:** applies up to ${f.applies_up_to}${f.floor ? ` (floor ${f.floor})` : ''} · counts ${JSON.stringify(f.counts)}

${RULES}

## What to check
1. For **every** row graded MISSING, PARTIAL, CONTRADICTED or PLANNED:
   - **Search harder:** ≥3 alternate terms (API / flag names, JEP / PEP / proposal numbers, informal names, older and newer spellings) over the WHOLE \`${REPO}/docs\` tree (except \`docs/_project/\`), syllabus and README files included.
   - **Check the attribution:** is the change real, and did it land in the stated version? Use the cited source; fetch the primary release note if the citation does not settle it.
   - **For CONTRADICTED:** open the cited file:line and confirm the page really presents old behaviour as current — not history or migration teaching.
   - Verdict: CONFIRMED · REFUTED-covered (file:line) · REFUTED-version (actual version) · REFUTED-not-real · REFUTED-not-contradicted · RECLASSIFIED (→ new status, why).
2. **Spot-check COVERED rows** — at least 8, choosing the ones most likely to be wrong (a bare mention graded as teaching).
3. **Re-check §1** dates against endoflife.date or the vendor table (one fetch), and whether §2's "applies up to" follows from its evidence.
4. **Completeness pass:** read the release notes for the current LTS line and the latest line yourself. Every notable teachable change the finder's §3 omitted becomes a new row, graded the same way, tagged "(added by verify)". No cap.

## Output
Append \`## 6 · Verification\` to the LAST report file — or, if that would pass 300 lines, write \`${OUT}/${u.unit}-verify.md\` with its own frontmatter (continue in \`-verify-02.md\` if needed). It holds: the verdict table (\`# | original status | verdict | evidence\`), the §1/§2 check, the added rows, and final counts. Then edit the §3 table: change each refuted row's Status cell to e.g. \`~~MISSING~~ COVERED (verify)\` — never delete a row. Update the frontmatter description with the final numbers. Commit after each part.

Return the structured result: \`confirmed_gaps\` = every row whose FINAL status is MISSING, PARTIAL or CONTRADICTED (added rows included).`
}

const units = args.units
log(`Batch ${args.batch}: ${units.map(u => u.unit).join(', ')}`)

const results = await pipeline(
  units,
  u => agent(finderPrompt(u), { label: `audit:${u.unit}`, phase: 'Audit', schema: FINDER_SCHEMA }),
  (f, u) => f
    ? agent(verifyPrompt(u, f), { label: `verify:${u.unit}`, phase: 'Verify', schema: VERIFY_SCHEMA })
        .then(v => ({ unit: u.unit, finder: f, verify: v }))
    : { unit: u.unit, finder: null, verify: null },
)
return results
