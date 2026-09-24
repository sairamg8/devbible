---
name: devbible-frontend-toolchain-currency-plan
description: THE plan for bringing the 12 imported frontend-toolchain tracks current to September 2026 — the version-truth pass, the syllabus that does not exist for 10 of them, the four lanes, and the per-file stamp. Open on "frontend toolchain currency" or "currency lane L<n>".
metadata:
  type: project
---

# Frontend toolchain — validating the syllabus is current to September 2026

**Written 2026-08-31.** Measured on disk and against the live npm registry the same day —
every number below is reproducible with the commands in the last section, none is estimated.

## 1 · What is actually there — the fact that reshapes the request

The user asked to *validate the syllabus*. **Ten of the twelve tracks have no syllabus at
all.** They are the raw `frontend-bible` import of 2026-08-14 (`progress_frontend_import_bucket_a.md`):
a flat `pages/NN-section/NN-topic.md` tree, one topic per section, no `syllabus/` directory,
no `> Verified:` line, no tier badge, no interview section.

| Track | leaf pages | `syllabus/` | `> Verified:` | tier badge | interview |
|---|---|---|---|---|---|
| storybook | 44 | ✅ 4 parts | 28 | 31 | 22 |
| jest-rtl | 32 | ✅ 4 parts | 37 | 40 | 30 |
| eslint-oxlint | 21 | ❌ | 0 | 0 | 0 |
| webpack | 21 | ❌ | 0 | 0 | 0 |
| vite · babel · playwright · redux-toolkit · tanstack-query · framer-motion | 16 each | ❌ | 0 | 0 | 0 |
| frontend-architecture | 15 | ❌ | 0 | 0 | 0 |
| web-vitals-performance | 11 | ❌ | 0 | 0 | 0 |

**240 leaf pages, ~37,100 lines, 12 tracks.** Storybook and jest-rtl are partly converted
(native phases written to devbible depth); the other ten are untouched drafts.

So "validate the syllabus" splits into two different jobs, and they must not be confused:

- **10 tracks:** there is nothing to validate. The deliverable is a **syllabus authored
  against the September-2026 release of each tool**, with the existing 16-ish imported pages
  mapped onto it as source material.
- **2 tracks (storybook, jest-rtl):** a real syllabus exists. The deliverable is a
  **currency diff** — which topics are stale, which are missing, which no longer exist.

🔴 **These 240 pages are explicitly OUT of scope for `project_validation_plan_multisession.md`**
(lanes V1–V7). That plan validates *converted* pages. This is the separate project it defers
to. Do not run both against the same file.

## 2 · The version gap, measured 2026-08-31 against the npm registry

| Track | package | latest today | published | what the imported pages actually describe |
|---|---|---|---|---|
| Vite | `vite` | **8.2.2** | 2026-08-20 | 🔴 **0 mentions of Rolldown, 0 of the Environment API** — the two defining changes of 6/7/8. Content is Vite 4/5 era. `esbuild` 6 files, `rollup` 7 files |
| Webpack | `webpack` | **5.110.2** | 2026-08-30 | Module Federation 7 files, Tapable 3 — 🔴 **0 mentions of Rspack**, the migration every webpack team now faces |
| Babel | `@babel/core` | **8.0.1** | 2026-07-22 | 🔴 **0 mentions of Babel 8.** Written entirely against 7.x. `swc` 12 files, `esbuild` 9 — the "should you still use Babel" framing is the live question |
| ESLint | `eslint` **10.9.1** · `oxlint` **1.80.0** | 2026-08-24 | 🔴 **0 mentions of ESLint 10**; 4 files say "ESLint 9". **6 files still teach `.eslintrc`** |
| Jest & RTL | `jest` **30.5.0** · `@testing-library/react` **16.3.3** | 2026-08-28 | 11 files pinned to **Jest 29**, 1 to Jest 30. React 19 in 2, React 18 in 3 |
| Playwright | `playwright` | **1.62.1** | 2026-08-30 | 🔴 **no version anchor anywhere** — 0 files name a Playwright version. `test.step` 0 files |
| Storybook | `storybook` | **10.5.10** | 2026-08-27 | Native pages pinned `storybook@10.5.8` (27 mentions) — **1 patch behind, healthy**. The 22 **legacy `NN-*` imported pages are Storybook 8/9** and 12 of them import deleted packages |
| Redux Toolkit | `@reduxjs/toolkit` | **2.12.0** | 2026-05-15 | RTK 2 named in 2 files. Slowest-moving track — lowest risk |
| TanStack Query | `@tanstack/react-query` | **5.102.8** | 2026-08-27 | 🔴 **0 mentions of v5**, `queryOptions` in 1 file, `streamedQuery` in 0 |
| Framer Motion | `motion` | **13.1.1** | 2026-08-20 | 🔴 **14 files import `framer-motion`, 0 import `motion/react`.** The package was renamed; every code block in the track is a wrong import |
| Web Vitals | `web-vitals` | **6.2.1** | 2026-08-26 | INP 8 files, **FID still in 2** — FID was retired in 2024 |
| Frontend architecture | — | n/a | — | Not version-pinned by nature; risk is *stale practice*, not stale API |

**Two whole-track defects, not page defects:** Framer Motion's package rename and Babel's
major. Those are decided once and applied everywhere — do not let a per-page lane rediscover
them 16 times.

## 3 · The plan — four passes, in order

### Pass F0 · Version truth — ONE session, whole scope, first. ~1 session.

Nothing else starts until this exists. Produce
`devbible/reference_frontend_toolchain_versions_2026-09.md`, one section per track:

1. `npm view <pkg> version` + `time.modified` — the number, dated, not remembered.
2. The **release notes / migration guide for every major since the import** — this is the
   list of topics the corpus cannot know about.
3. **Deleted, renamed and moved APIs** in a table (`old → new`), the Storybook 9/10
   consolidation table in `progress_frontend_import_bucket_a.md` being the template.
4. A one-line verdict per track: `current` · `minor drift` · `major drift` · `renamed`.

🔴 **The registry is the source of truth for the number; the changelog is the source of truth
for what changed.** The Redis syllabus recorded a web search returning three different
"current" versions — do not repeat that.

### Pass F1 · Syllabus — per track, after F0. The main deliverable.

For each of the 10 tracks with no syllabus, write `docs/<tech>/syllabus/` to the same
standard as every other devbible track (`instructions.md` §3, §7): phases → topics, exactly
one tier per topic, ~25–30% Master, 4 part files, `_category_.json`, sidebar entry.

The syllabus is authored **from the September-2026 docs outward**, then the imported pages
are mapped onto it. Not the reverse. Each syllabus part records, per topic:

| column | meaning |
|---|---|
| tier | Master / Understand / Know / When-Needed |
| source page | the imported file that covers it, or `—` for net-new |
| currency | `reusable` · `needs edit` · `rewrite` · `delete` |

For **storybook** and **jest-rtl**, F1 is a diff instead: walk the existing syllabus topic by
topic against F0's changelog, and produce `added / changed / removed` rows.

**Definition of done for F1:** every imported page appears exactly once in some track's
`currency` column, or is on an explicit delete list with a reason. That is what makes the
next pass finite.

### Pass F2 · Conversion + currency fix — per file, the long pass.

Only after that track's F1 is approved. Per page, in place — **edit, never re-author**
(`feedback_move_dont_rewrite.md`: this exact corpus was rewritten once when a move was asked
for, 5,488 lines to replace 5,412):

```
read the page → fix the API/version defects F0 named → assign the tier badge
              → add the Interview section (3–8 Q+A) → add the > Verified: line, dated,
                naming the doc page and the exact version
              → split if it passes 300 lines (split, never trim)
              → commit that one file, explicit paths
              → append to devbible/currency_ledger_L<n>.md
```

🔴 **`> Verified:` is added by F2 and never before.** Bulk-stamping 240 unchecked files is a
fabricated claim (rules 2 and 8) and was already refused once on 2026-08-14.

Output blocks follow the existing decision tree in `project_validation_plan_multisession.md`
verbatim — real run → mark it · quoted from docs → cite it · illustrative → relabel it ·
**no provenance → delete the block and write prose**. Sandboxing is closed; nothing is re-run.

### Pass F3 · Depth — only where F1 says a topic is net-new.

Net-new topics (Rolldown, the Environment API, Rspack migration, Babel 8, ESLint 10, the
`motion` rename, `streamedQuery`, …) are written full-depth by `devbible-author`, per the
normal per-file cadence. **This is the only pass allowed to write new prose.**

## 4 · The lanes — four (L1–L4), split by risk and by shared-file safety

Whole tracks only, never a shared directory. Weight is `leaf pages + 2 × major-drift pages`.

| Lane | Tracks | pages | why grouped |
|---|---|---|---|
| **L1 · build tools** | vite · webpack · babel | 53 | All three are *bundler-era* drift (Rolldown / Rspack / Babel 8) and share one story: what still needs a bundler in 2026 |
| **L2 · testing** | jest-rtl · playwright · storybook (legacy `NN-*` only) | 70 | The two partly-converted tracks live here, so the one session that learns the conversion standard applies it twice |
| **L3 · state & motion** | redux-toolkit · tanstack-query · framer-motion | 48 | Carries the **whole-track rename** (framer-motion → `motion`) and the lowest-drift track (RTK) to balance it |
| **L4 · quality & architecture** | eslint-oxlint · web-vitals-performance · frontend-architecture | 47 | Config-shaped rather than API-shaped; `.eslintrc` removal and the FID→INP correction are both here |

**Shared files, same rules as every other lane:** `src/data/progress.js`, `sidebars.js`,
`src/pages/index.js`, `docs/README.md` — your own rows only, never `git add -A`, and confirm
`git status --short` after staging. Four lanes will be in these four files at once.

## 5 · The brief change this needs — do it before F1, not after

`instructions.md` §2 commits devbible to **12 technologies** and says nothing outside them is
written until all twelve are done. The 12 toolchain tracks are **not in that table** — they
were imported without the brief being updated, and the homepage already ships them as a
"Frontend toolchain" layer numbered 13–24. Authoring twelve syllabi against a brief that does
not name them repeats the scope drift the import already caused.

**Ask the user to confirm §2 gains the toolchain layer** — it is a one-table edit, and it is
the only item in this plan that is genuinely blocking.

## 6 · Risks, in the order they will actually bite

- 🔴 **F1 becomes a rewrite.** A session opens a thin imported page, decides it deserves
  depth, and starts authoring. That is F3, and F3 needs an approved syllabus first. This has
  already happened once to this exact corpus.
- 🔴 **Stamping `> Verified:` to make a track look done.** The stamp is the promise; a page
  stamped without a check is removed from every future pass.
- **The registry number is not the version the docs describe.** `vite@8.2.2` is the tag;
  what a page teaches is a *behaviour*, and behaviours change on majors. Read the migration
  guide, not the version badge.
- **Rediscovering a whole-track defect per page.** The `motion` rename and Babel 8 are F0
  findings applied mechanically, not F2 judgements made 16 times.
- **`src/data/progress.js` truncation.** A scripted splice chopped this file during the
  original import (`s.rstrip()[:-2]`). Any scripted edit is followed by `node --check` on a
  copy.
- **Four lanes, one build.** Builds need a claimed row in
  `shared/session_build_devserver_registry.md`; one build at the *end* of a lane, not per file.
- **Storybook has two page sets.** Native `pages/phase-N-*/` (converted, healthy) and legacy
  `pages/NN-*/` (Storybook 8/9, 12 files importing deleted packages). **Lane L2 touches the
  legacy set only** — the native set belongs to the Storybook writing track.

## 7 · Definition of done

**Per track:** a `syllabus/` directory matching the September-2026 release · every imported
page carrying a tier badge, an Interview section and a dated `> Verified:` line naming the
version · zero pages over 300 lines · zero references to a renamed or deleted API · the
`:::caution Imported corpus — not yet validated` banner **removed from its README** (that
banner coming off is the visible signal the track is done) · a closing entry in the store.

**Whole pass:** four ledgers closed · `reference_frontend_toolchain_versions_2026-09.md`
published as the dated record of what "current" meant · `instructions.md` §2 naming the
layer · the homepage "Frontend toolchain" note rewritten from *"imported — not yet
validated"* to a real status.

## 8 · Reproducing every number in this file

```bash
cd /mnt/Storage/Backup/Knowledge/devbible/docs
for d in babel eslint-oxlint framer-motion frontend-architecture jest-rtl playwright \
         redux-toolkit storybook tanstack-query vite web-vitals-performance webpack; do
  printf "%-24s leaf=%-4s syl=%-3s ver=%-4s tier=%-4s iv=%s\n" "$d" \
    "$(find $d -name '*.md' ! -name README.md ! -path '*/syllabus/*' | wc -l)" \
    "$(ls $d/syllabus/*.md 2>/dev/null | wc -l)" \
    "$(grep -rl '^> Verified:' $d | wc -l)" \
    "$(grep -rl 'db-tier t-' $d | wc -l)" \
    "$(grep -rli '^## .*interview' $d | wc -l)"; done

for p in vite webpack @babel/core eslint oxlint jest @testing-library/react playwright \
         storybook @reduxjs/toolkit @tanstack/react-query motion web-vitals; do
  printf "%-26s %-12s %s\n" "$p" "$(npm view $p version)" "$(npm view $p time.modified)"; done
```

Related: [[devbible-validation-plan-multisession]] · [[progress-frontend-import-bucket-a]] ·
[[progress-session-0fe4e7e0-frontend-import]] · [[feedback-move-dont-rewrite]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-verify-your-own-measurements]] ·
[[devbible-locks]]
