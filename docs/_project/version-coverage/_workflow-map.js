export const meta = {
  name: 'devbible-free-content-map',
  description: 'Per track: official-docs LTS syllabus mapped against our pages and the best free content — LINK / KEEP / WRITE / PLANNED — plus an outdated check, adversarially verified',
  phases: [
    { title: 'Map', detail: 'one agent per track: LTS syllabus from official docs, free resources, verdict per topic' },
    { title: 'Verify', detail: 'one skeptic per track re-checks every WRITE, LINK and OUTDATED verdict' },
  ],
}

// The "new way", chosen by the user 2026-09-24 ("yes switch to the new way"): take the official
// docs' topic list for the LTS version, and sort every topic into LINK (free sites teach it well),
// KEEP (ours is deeper), WRITE (nobody teaches it well). Standing direction since 2026-09-14:
// devbible is the hub + the delta — see docs/_project/feedback_hub_plus_delta_20260914.md.

const STORE = '/mnt/Storage/my-learning/claude'
const REPO = '/mnt/Storage/Backup/Knowledge/devbible'
const TODAY = args.today
const OUT = `${REPO}/docs/_project/version-coverage`
const COMMIT = `${STORE}/shared/scripts/store-commit.sh`

const ITEM = {
  type: 'object',
  properties: { id: { type: 'string' }, topic: { type: 'string' }, detail: { type: 'string' } },
  required: ['id', 'topic'],
}
const COUNTS = {
  type: 'object',
  properties: {
    link: { type: 'number' }, keep: { type: 'number' }, write: { type: 'number' },
    planned: { type: 'number' }, skip: { type: 'number' }, outdated: { type: 'number' },
  },
  required: ['link', 'keep', 'write', 'planned', 'skip', 'outdated'],
}
const MAP_SCHEMA = {
  type: 'object',
  properties: {
    unit: { type: 'string' },
    syllabus_version: { type: 'string' },
    lts_lines: { type: 'string' },
    applies_up_to: { type: 'string' },
    syllabus_sources: { type: 'array', items: { type: 'string' } },
    free_resources: { type: 'array', items: { type: 'string' } },
    counts: COUNTS,
    write_list: { type: 'array', items: ITEM },
    outdated_list: { type: 'array', items: ITEM },
    link_list: { type: 'array', items: ITEM },
    report_files: { type: 'array', items: { type: 'string' } },
    fetch_failures: { type: 'array', items: { type: 'string' } },
  },
  required: ['unit', 'syllabus_version', 'applies_up_to', 'counts', 'write_list', 'outdated_list', 'link_list', 'report_files'],
}
const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    unit: { type: 'string' },
    changed: { type: 'number' },
    added_rows: { type: 'number' },
    final_counts: COUNTS,
    write_list: { type: 'array', items: ITEM },
    outdated_list: { type: 'array', items: ITEM },
    link_list: { type: 'array', items: ITEM },
    applies_up_to_final: { type: 'string' },
    report_files: { type: 'array', items: { type: 'string' } },
  },
  required: ['unit', 'changed', 'final_counts', 'write_list', 'outdated_list', 'report_files'],
}

const RULES = `## Hard rules
1. **READ-ONLY on ${REPO} except your own report files in ${OUT}/.** No other edits, no git commands of your own (commit ONLY through the helper in rule 4), no \`yarn\`, never \`node scripts/currency.mjs\`. grep / rg / sed / find / wc / cat / ls are fine. When grepping the corpus, exclude \`docs/_project/\` — it is tracking, not content.
2. **No sandbox.** Never write or run a program to test behaviour. Evidence is the corpus (grep) and pages fetched THIS session.
3. **Every version, date, topic list and "a free page teaches this" judgement comes from something you fetched in this session.** Cite URLs. Never from memory. A free resource that returns 404 does not exist — say so. If a fetch fails, record it and leave the cell "unverified".
4. **Write only inside ${OUT}/.** Commit each file after each section with:
   \`${COMMIT} "devbible free-content map: <unit> §<n>" <absolute path(s)>\`
   Never \`git add -A\`, never push. Every file you create gets YAML frontmatter (name / description / metadata.type: project).
5. **300 lines is a FILE-SIZE cap, never a content budget.** When a file would pass 300 lines, continue in the next file (\`-02.md\`, \`-03.md\` …), split at a section boundary, each with its own frontmatter. Never trim, never cap a list to fit.
6. Quotes from any page: ≤ 15 words each.
7. Today is ${TODAY}.`

const VERDICTS = `Verdict is exactly one of:
- **LINK** — a free page teaches this well already; our page mostly restates it. (We never delete our page — LINK means: add the link for the basics, keep our words for the delta.)
- **KEEP** — our page adds real depth the free pages lack: gotchas, internals, production / security concerns, cross-stack wiring, interview Q&A.
- **WRITE** — nobody explains it well, and we do not either (or ours is thin). A real gap worth our words.
- **PLANNED** — in our syllabus but not written yet (syllabus file:line). Add →LINK or →WRITE for when its turn comes (e.g. \`PLANNED→WRITE\`).
- **SKIP** — not relevant to a fullstack developer (say why in ≤ 6 words).`

function reportName(u) { return u.report || u.unit }

function mapPrompt(u) {
  const name = reportName(u)
  return `You are mapping ONE devbible track (a fullstack reference site) against the free content that already exists online. The user's direction: devbible must not re-explain what free sites already teach well — it links to them — and spends its own words only where nobody explains it well. Your job: take the OFFICIAL DOCS' topic list for the LTS version, and sort every topic into LINK / KEEP / WRITE.

**Write each section of the report to disk COMPLETELY, and commit it, as soon as you have finished it — before you start the next one. Never hold the report in your head to write at the end.**

## The track
- **Unit:** \`${u.unit}\` — ${u.label}
- **Our pages (read-only, under ${REPO}):** ${u.dirs.join(' · ')}
- **Pins in src/data/pins.js:** ${u.pins}
- **Currency check today:** ${u.currency}
- **Where the LTS syllabus and free content live (hints — verify, do not trust):** ${u.syllabus_hint}
- **Notes:** ${u.notes}
- **Report file:** \`${OUT}/${name}.md\`${u.prior ? `\n- **Already done for this track:** ${u.prior}` : ''}

${RULES}

## Report layout — write §1…§6 in order, committing after each.

Frontmatter first:
\`\`\`
---
name: free-content-map-${name}
description: <track · syllabus version · LINK/KEEP/WRITE/PLANNED/OUTDATED counts — fill in at the end>
metadata:
  type: project
---
# ${u.label} — LTS syllabus vs our pages vs free content (${TODAY})
\`\`\`

**§1 · LTS versions (short).** A small table: supported LTS / active lines, latest stable, next LTS with its date (endoflife.date API \`curl -s https://endoflife.date/api/<product>.json\` or the vendor's release page). If the product has no LTS, say so and use its current stable major + support policy. End with one line: **Syllabus version = <X>** (the current LTS, or the latest stable when there is no LTS).

**§2 · The LTS syllabus, from the official docs.** Fetch the official documentation's table of contents for that version (docs index, sidebar, manual TOC, "learn" path). List its topics at the granularity of one devbible topic — a chapter, guide or section, NOT every function. Where the docs have both a learn/guide part and a reference, take the guide topics plus the reference areas a developer uses daily. Number them S1…Sn. Cite the TOC URL(s). This list is the yardstick: be complete.

**§3 · The free resources.** Always the official docs; plus whichever exist for this track (check, don't assume): MDN, w3schools, javascript.info, web.dev/learn, dev.java/learn, Baeldung, freeCodeCamp, The Odin Project, Full Stack Open, roadmap.sh, the project's own tutorial or free course, free books (Pro Git, Eloquent JavaScript, TypeScript Deep Dive…), well-known free blogs (e.g. TkDodo for TanStack Query). Fetch each one's table of contents / index ONCE. A table: resource · URL · exists? · what it covers · depth (basics / solid / deep).

**§4 · The mapping table — the core.** One row per syllabus topic S1…Sn:
\`# | Topic (official link) | Our page(s) | Best free page (URL) | Verdict | Why (≤ 20 words)\`
${VERDICTS}
Our pages: grep the track's dirs (and the whole docs/ tree if it may live in another track); give the path(s). Judge "a free page teaches this well" by OPENING the free page whenever it is not obvious — never by its title alone. Group rows under the syllabus's own section headings.
After the table, list **our extras** — topics we teach that are NOT in the official syllabus (production recipes, interview prep, cross-stack wiring…): one line each, verdict KEEP or LINK.

**§5 · Outdated check (short).** Grep our pages for what the syllabus version changed: removed or deprecated APIs taught as current, "latest / current / new / upcoming / experimental" claims now false, version numbers behind the pin, and the headline changes of the last two LTS releases that our pages contradict. One row each: \`file:line | what it says | what is true now | source URL\`. "vN was X, vN+1 is Y" migration teaching is NOT outdated.

**§6 · Summary.** Counts per verdict. One line: **Content applies up to <version>** (the newest version whose topics and headline changes our pages actually teach). Then three ranked lists for the owning lane:
1. **WRITE** — highest value first; each with its tier (Master / Understand / Know / When Needed) and the existing page or phase it would sit beside (\`ls\`-verified path).
2. **OUTDATED** — file:line and the fix in one line.
3. **LINK candidates** — our page → the free URL to add at its top.

Finally update the frontmatter description with the real numbers and commit. Return the structured result (\`write_list\` / \`outdated_list\` / \`link_list\` complete — every row, not a sample).`
}

function verifyPrompt(u, m) {
  const name = reportName(u)
  return `You are the ADVERSARIAL VERIFIER for one track's free-content map. A mapper wrote: ${m.report_files.join(', ')}. Read them fully first. Try to overturn every verdict that decides work: a wrong WRITE wastes our effort, a wrong LINK throws away depth we have, a wrong OUTDATED sends someone to "fix" correct text.

**Write your verification to disk and commit it as soon as each part is done — never hold it all to write at the end.**

## The track
- **Unit:** \`${u.unit}\` — ${u.label}
- **Our pages:** ${u.dirs.join(' · ')}
- **Syllabus / free-content hints:** ${u.syllabus_hint}
- **Mapper's result:** syllabus version ${m.syllabus_version} · applies up to ${m.applies_up_to} · counts ${JSON.stringify(m.counts)}

${RULES}

## What to check
1. **Every WRITE row:** try hard to find a free resource that already teaches it well — at least 3 web searches or index lookups across different resources. Found one that is genuinely good → \`LINK\` (URL). Also search our WHOLE \`${REPO}/docs\` tree (except docs/_project/) under other names → if we already teach it well, \`KEEP\`.
2. **Every LINK row:** open BOTH the free page and our page. If ours has substantial depth the free page lacks (gotchas, internals, production, security, interview Q&A) → \`KEEP\`. If the free page is thin, outdated or for an older version → \`KEEP\` or \`WRITE\`.
3. **Spot-check at least 8 KEEP rows** (pick the likeliest to be wrong): is our page really deeper than the best free page?
4. **Every OUTDATED row:** confirm against the primary source and the page's actual context; refute migration/history teaching.
5. **Completeness:** re-open the official TOC. Every syllabus topic the mapper missed becomes a new row, graded the same way, tagged "(added by verify)".
6. Re-check §1 dates with one endoflife.date / vendor fetch.

## Output
Append \`## 7 · Verification\` to the LAST report file — or, if that would pass 300 lines, write \`${OUT}/${name}-verify.md\` with its own frontmatter. It holds: a table \`# | original verdict | final verdict | evidence\` for every row you changed or confirmed, the added rows, the §1 check, and final counts. Then edit the §4 table: change each overturned verdict cell to e.g. \`~~WRITE~~ LINK (verify)\` — never delete a row. Update §6's lists and the frontmatter description to the final numbers. Commit after each part.

Return the structured result: final lists complete — every WRITE, OUTDATED and LINK row after verification.`
}

const units = args.units
log(`Batch ${args.batch} (free-content map): ${units.map(u => u.unit).join(', ')}`)

const results = await pipeline(
  units,
  u => agent(mapPrompt(u), { label: `map:${u.unit}`, phase: 'Map', schema: MAP_SCHEMA }),
  (m, u) => m
    ? agent(verifyPrompt(u, m), { label: `verify:${u.unit}`, phase: 'Verify', schema: VERIFY_SCHEMA })
        .then(v => ({ unit: u.unit, map: m, verify: v }))
    : { unit: u.unit, map: null, verify: null },
)
return results
