---
name: devbible-corpus-audit-20260905
description: Corpus-wide QC audit of 2026-09-05 — the measured baseline that replaces the 2026-08-16 one, the two dashboard over-credits that were fixed, the linkcheck script's false positives, and the ranked list of what is actually pending. Open before trusting any "N pages / 0 broken links / N over cap" number written before this date.
metadata:
  type: project
---

# Corpus audit — 2026-09-05

**Ordered by the user:** *"came to a conclusion on 1. completing pending tasks 2. verifying and
reviewing upto written data … 3. if anything else i am missing"*, then *"if any issues you found
or miss matches make sure to update dashboard correctly as well as correct memory too"*.

Everything here was **measured on disk on 2026-09-05**, not carried forward from an older
memory. Every number has its command in §6.

---

## 1 · The baseline — this REPLACES the one in `project_validation_plan_multisession.md`

That plan's table was measured 2026-08-16. The corpus has since **more than doubled**. Use
these numbers instead; the plan's *method* is still right, only its counts are stale.

| | 2026-08-16 | **2026-09-05** |
|---|---|---|
| Leaf content pages (non-README, non-`_*`) | 2,212 | **5,816** |
| `.md`/`.mdx` files under `docs/` | ~2,700 | **6,817** |
| Lines | ~482,000 | **1,391,717** |
| Tracks | 25 | **29** |
| `> Verified:` lines | 4,400 | **6,337** (4,687 dated 2026-08, 1,637 dated 2026-09) |
| Pages carrying `db-tier t-master` | 830 | **2,868** |
| Pages carrying `sandbox-proven` | 57 | **61** |
| 🔴 Output-style fence with NO `sandbox-proven` | 636 | **834** |
| Files over the 300-line cap | 9 | **13** |

🔴 **The 834 is still the largest correctness risk in the corpus** and it has grown by 198,
not shrunk. Where it lives now: **PostgreSQL 262 · Node.js 179 · TypeScript 100 · Java 82 ·
Express 45 · Next.js 40 · React 31 · Python 25 · CSS 25 · Nginx 14 · Git 14 · Storybook 6 ·
Real World 4 · one each in docker/webpack/vite/playwright/tanstack/framer/frontend-arch/
web-vitals.** The plan's fix-vs-log policy still applies unchanged.

**The 13 over-cap files** are 7 Storybook (imported, never chunked), **4 Python in
`phase-1-language-core/12-eafp-vs-lbyl/`** (`06h` 351, `06l` 321, `06m` 320, `06j` 305 — the
split boundaries are ALREADY MEASURED in `progress_python_pages.md`), and 2 `docs/reviews/*`
which are review artifacts, not doc pages. **Every other natively-written track is 0 over.**

---

## 2 · 🔴 The dashboard defect that was found and FIXED — repo commit `a1b89668`

`phaseStatus()` in `src/data/progress.js` reads **any phase with `pages > 0` and no
`pagesPlanned` as `'written'`**, and `summarise()` then credits it its **full `topics`
count**. A phase eight topics into fourteen therefore reported as finished.

Two phases were doing exactly that:

| Phase | On disk | Site credited | Authority for the real number |
|---|---|---|---|
| **Java 13 · OAuth2/OIDC** | 8 of 14 | 14 | [[java-board]] — rows 09–14 FREE, nothing on disk |
| **MongoDB 6 · Aggregation** | 5 of 6 | 6 | `06-unwind.md` is not on disk; [[devbible-locks]] says it is the one file owed |

**Seven topics the site claimed and the corpus does not have.** Both now carry
`pagesPlanned` and count pro rata:

- **Java 83% → 80%**, phases 13/17 → **12/17**
- **MongoDB 49% → 48%**, phases 7/15 → **6/15**
- Site total 2,464 → **2,457 of 3,337 topics = 74%**

⚠️ **`pages < topics` is NOT by itself a gap — do not "fix" the other 20.** Node.js phases
0–5 (17 topics) and React phase 0 (3) **deliberately merge pairs of syllabus rows onto one
page**, and every one of those phase READMEs carries a **Coverage table** naming each row
and the page it landed on. `progress_nodejs_completeness_audit.md` establishes this for
Node; React phase 0's README has the same section. **Check the Coverage table before
touching a number in `progress.js`.** The trap is now documented in that file's own header
comment so it cannot be reintroduced silently.

Also fixed in the same commit: the homepage footer read **"Content verified August 2026 ·
Node 26.7.0 current, Node 24 active LTS"**. Both halves were stale — 1,637 `> Verified:`
lines are dated September, and Node's newest is **26.8.1**. It now derives the month from
the freshest `updated` stamp and the LTS line from `src/data/pins.js`.

---

## 3 · 🔴 `devbible-linkcheck.py` IS UNRELIABLE — its 138 "broken links" are ALL false positives

It reports **138 broken links over 49,268** (postgresql 102 · javascript 21 · nodejs 9 ·
expressjs 3 · typescript 2 · webpack 1). **None of them is real.** Two false-positive classes:

1. **It does not strip Docusaurus numeric prefixes.** `./transform-streams/` resolves fine —
   the directory is `09-transform-streams/` and Docusaurus's `numberPrefixParser` removes the
   `NN-`. Nearly every PostgreSQL and Node hit is this.
2. **It treats any `[...]` as a link target.** `m[i]`, `request.path`, `path`, `arg`, `hint`,
   `react|react-dom` — prose and code, not links.

**The authority is Docusaurus itself:** `docusaurus.config.js` sets **`onBrokenLinks: 'throw'`**,
so a genuinely broken link fails the build, and `.github/workflows/deploy.yml` runs that build
on every push to `main`. ✅ **The "0 broken links" claims in `INDEX.md` and the TypeScript
memories are correct** — they were verified by a clean build, which is the right method.

🔴 **Do not run `devbible-linkcheck.py` as a gate and do not "repair" links it flags** — that
would break working links. Fixing the script (strip `^\d+-`, only accept `](...)` forms) is
worthwhile but is its own task.

`mdxcheck.py` is in better shape: **15 hazards in 8 files**, and those too are mostly
`RAW-TAG` false positives on `<` in prose (`timeout < client timeout`). Two look real and
are in non-shipping files (`docs/reviews/review-prompt.md`, `postgresql/reviews/`).

---

## 4 · What is actually pending, ranked

**Not started at all**

| Track | Owed | Note |
|---|---|---|
| **Angular** | **211 topics, 16 phases** | Syllabus written 2026-08-31, **0 pages**. Largest single block of unwritten work in the project. Cursor: [[cursor-angular]] |
| **Redis** | **73 of 74**, 10 phase dirs missing | 1 page exists. Cursor exists, nothing moving since 2026-08-17 |
| **Nginx** | **164 of 210**, phases 3–11 missing | Phases 0–2 done. Untouched since 2026-08-15 |
| **Python** | **143 of 180**, phases 3–13 missing | Phase 1 is 15/16 — finish topic 12 first, and split its 4 over-cap files |
| **MongoDB** | **43 of 82**, phases 7–14 missing | Next file is named exactly in [[devbible-locks]] |
| **Storybook** | **35 of 58**, phases 4–10 missing | Plus 22 legacy imported pages, see §5 |
| **Java** | **46 of 233** | Phases 12→13→14→15→16, standing order of 2026-09-02. Board: [[java-board]] |

**Effectively finished:** CSS, JavaScript, TypeScript, React, Node.js, Express, PostgreSQL,
Git, Docker & Podman, Next.js, Jest & RTL. **Real World** is one topic short —
`docs/real-world/pages/phase-8-mongodb-mirror/06-change-streams/` holds only an untracked
`_category_.json`.

---

## 5 · 🔴 The 11 imported toolchain tracks are the real accuracy problem — 164 pages, 0 validated

Confirmed on disk 2026-09-05, not taken from the plan:

| Track | Measured today | Why it matters |
|---|---|---|
| **Framer Motion** | **13 files import `framer-motion`, 0 import `motion/react`** | The package was **renamed**. Every code block in the track has a wrong import |
| **TanStack Query** | **0 mentions of v5** anywhere | Current is 5.102.8 |
| **Babel** | **0 mentions of Babel 8** | 8.0.1 shipped 2026-07-22 |
| **Vite** | **0 mentions of Rolldown** | Content is Vite 4/5 era; current is 8.2.2 |
| **ESLint** | `.eslintrc` in 3 files, none name ESLint 10 | Two are legitimately titled "legacy"; one is not |
| **Web Vitals** | FID in 2 files | Both are the "legacy metrics" pages, so defensible |

These pages are **live on the site with no tier badge and no `> Verified:` line**, so a reader
gets no signal that they are unchecked. ✅ The homepage card `desc` strings already say so in
prose (`src/pages/index.js`) and the tracks correctly read **0%**, which is the honest
description — the plan is [[devbible-frontend-toolchain-currency-plan]] (passes F0–F3).
**Ten of the twelve have no `syllabus/` at all**, so this is *authoring a syllabus*, not
validating one — do not confuse the two jobs.

---

## 6 · Version currency — `yarn currency --check` says **8 items need a human**

Run 2026-09-05. Patch drift is ignored by design; these are not patches:

- 🔴 **Flyway 12 → 13.5.0 — a MAJOR, 50 pages.** The only major-class drift in the corpus.
- ⚠️ **JUnit 6.0.3 → 6.1.3**, 113 pages · **Zod 4.4.3 → 4.5.4**, 70 pages ·
  **MongoDB 8.0 → 8.3.8**, 16 pages · **Storybook 10.5.8 → 10.6.0**, 26 pages ·
  **Docker Engine 29.7.2 → 29.8.0**, 1 page
- 🔴 **2 inconsistent — the pin and the pages disagree:** TypeScript pin **7.0.2** but
  **363 pages say 5.9.3**; TanStack Query pin **5.102.8** but pages say **5.40.0**.
  One of the two is wrong in each case and only a human can say which.
- ❔ **10 unanchored** — Vite, Webpack, Babel, ESLint, Oxlint, Jest, Testing Library,
  Playwright, Motion, web-vitals name **no version on any page**. Same ten tracks as §5.
- 📅 **Node 26 becomes LTS on 2026-10-28 — 53 days.** **311 pages say "Active LTS"** about
  Node 24 and that claim expires that day. This is the single largest scheduled invalidation
  in the corpus; it is already noted in `pins.js` and needs a plan before late October.

---

## 6b · 🔴 Depth-bar compliance — Git is 63% out of contract, in a track marked DONE

`.agents/references/house-style.md` is unambiguous: **"`## Gotchas` and `## Interview
questions` are not optional and their names are exact."** Measured across every leaf page
on 2026-09-05:

| Track | Leaf pages | No `## Gotchas` | No `## Interview questions` |
|---|---:|---:|---:|
| **Git** | 57 | 0 | 🔴 **36** |
| Next.js | 657 | 19 | 19 |
| Java | 2,036 | 4 | 13 |
| TypeScript | 347 | 6 | 6 |
| Storybook | 44 | 22 | 22 |
| everything else native | — | **0** | **0** |

🔴 **Git — 36 of 57 pages (63%) have no Interview questions section**, and Git is reported
**100% complete** on the homepage. It is not a naming variation: all 57 pages carry
`## Gotchas` and 56 carry `## Trade-off`, so the section was simply never written. Whole
phases are affected — **phase 1 (10 pages), phase 2 (10), phase 4 (8), phase 5 (8)**;
phases 0 and 3 are clean. Every affected file is **145–238 lines**, so there is room under
the cap to add the section without a split. This is the single largest house-style breach
in the corpus and the cheapest real quality win available.

**Next.js: 18 of its 19 are `NN-chapter/01-explanation.md`** — one per chapter, the
chapter-overview page left over from the import. They are leaf pages by filename but
README-shaped by role. Decide once: either rename them to `README.md` or give them the two
sections. The 19th, `15-.../05-edge-functions-and-custom-cache-structures-*`, is a genuine
concept page and a real miss. **Java's 4** are `*-the-traps.md` / `*-the-checklist.md`,
which are Gotchas under another name — cosmetic.

⚠️ **NOT a defect, do not "fix" it:** 146 TypeScript and 71 Python pages carry no `★`.
The house style permits the **bold lead-in** as an alternative to `★` ("`**Symptom:` /
`**Cause:` / `**Fix:`"), and that is what those pages use. `★` is dominant, not mandatory.

## 7 · Infrastructure — healthy, and two things worth knowing

- ✅ **CI exists and is correct.** `.github/workflows/deploy.yml` (push to `main` +
  `workflow_dispatch`, `onBrokenLinks: 'throw'`) and `currency.yml` (Mondays 06:00 UTC).
- ✅ **Working tree clean, one commit unpushed** as of this audit.
- ⚠️ **A sibling session was live in this checkout during the audit** (19:44–19:49), committing
  the homepage-search fix `scripts/merge-root-index.mjs`. Both of this audit's file edits were
  in files it had not touched. **Always re-check `git status` and mtimes before editing a
  shared file; a file touched inside 10 minutes is not yours.**
- ⚠️ `yarn currency --check` and `node scripts/status.mjs` **write** `static/currency.json`
  and `static/status.json` as a side effect. Both were reverted here. Expect a dirty tree
  after running them.

---

## 8 · Commands — every number above is reproducible

```bash
cd /mnt/Storage/Backup/Knowledge/devbible
# leaf content pages
for d in docs/*/; do find "$d/pages" \( -name '*.md' -o -name '*.mdx' \) \
  ! -name 'README.md' ! -name 'index.md' ! -name '_*' 2>/dev/null; done | wc -l
# over the cap
find docs \( -name '*.md' -o -name '*.mdx' \) -print0 | xargs -0 wc -l \
  | awk '$2!="total" && $1>300 {print $1, $2}' | sort -rn
# unattributed output blocks
grep -rlE '^```(text|console|output|sh-session)' --include='*.md' docs \
  | while read f; do grep -q sandbox-proven "$f" || echo "$f"; done | wc -l
# badge + Verified coverage, per track
grep -rl 'db-tier t-' docs/<track>/pages | wc -l
# version drift
node scripts/currency.mjs --check      # then: git checkout -- static/currency.json
```

For the site's own numbers, never re-derive them — import them:

```bash
node -e "import('./src/data/progress.js').then(m=>console.log(m.summarise('java')))"
```

🔴 **`summarise()` is the authority, not a hand-rolled sum.** An ad-hoc
`sum(pages)/sum(topics)` reports Next.js at 131% and PostgreSQL at 128%, because `pages`
counts *files* on those two chunked tracks and *topics* on every other one. `summarise()`
credits a written phase its `topics`, which is why the site has never shown those numbers.

---

Related: [[devbible-validation-plan-multisession]] · [[devbible-frontend-toolchain-currency-plan]] ·
[[java-board]] · [[devbible-locks]] · [[devbible-currency-system]] ·
[[progress-nodejs-completeness-audit]]
