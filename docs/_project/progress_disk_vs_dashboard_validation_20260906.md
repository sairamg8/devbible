---
name: devbible-disk-vs-dashboard-validation-20260906
description: Full disk-vs-dashboard reconciliation of 2026-09-06 — every track's page count, topic count, validated count and freshness stamp measured off disk and compared to what src/data/progress.js and page-counts.json make the site say. Six real discrepancies, and the by-design cases that must NOT be "fixed".
metadata:
  type: project
---

# Disk vs dashboard — full reconciliation, 2026-09-06

> ✅ **ALL SIX FIXED AND PUSHED — repo commit `d924ae26`, on `origin/main`,
> verified by ancestry.** This file is the record of what was wrong, what the
> evidence was, and what each fix decided. §2 is history now; §6 is the fixes.
> Measured against a clean `main` while an Angular session was live. Scripts:
> `scratchpad/audit.mjs`, `syllabus3.mjs` (session `6d1f050c`), reproducible from §5.

**Corpus at the time:** 29 tracks · **5,965** leaf pages · **1,357,653** lines
(leaf pages only, README/syllabus/reviews/`_*` excluded). Site model:
**2,500 / 3,355 topics = 75%**.

⚠️ The 1,391,717 in [[devbible-cursor-audit]] uses a different inclusion rule —
leaf-only is 1,357,653 and everything under `docs/` is 1,432,769. Say which rule
you used or the number is unfalsifiable.

---

## 1 · What was checked, and against what

| Dashboard number | Source of truth on disk |
|---|---|
| track / phase page counts | leaf `.md` under `docs/<t>/pages/`, page-counts.mjs rules |
| `topics` per phase | the `\| Topic \| Tier \|` rows under that phase's `## ` heading in `docs/<t>/syllabus/` |
| `pages` per phase | phase directory exists / has files; Coverage tables in phase READMEs |
| `verified` / `pagesValidated` | pages carrying BOTH `db-tier t-` and a `^> Verified:` line |
| `updated` stamp | `git log -1 --date=... -- docs/<track>` |

---

## 2 · 🔴 The six real discrepancies

**D1 · Jest & RTL reads 100% against its own 59-topic syllabus.**
`progress.js` models the track as **16 imported chapter dirs × `topics: 1`**, all
`verified: 1` → 16/16 = **100%**. `docs/jest-rtl/syllabus/` describes **12 phases,
59 topic rows**, and **4 of the 16 chapters (13–16) have no syllabus section at
all**. Two taxonomies — the syllabus's 12 phases vs the import's 16 chapter
directories — were never reconciled, and the chapter list won. This is the only
track advertised as *finished* on a count its own syllabus contradicts.

**D2 · The homepage prints "526/526 validated" for JavaScript; disk says 525.**
`docs/javascript/pages/phase-0-how-javascript-runs/07-loading-scripts.md` carries
the tier badge but **no `> Verified:` line** (its sibling `06-*` has one).
`summarise()` computes `pagesValidated` as `p.verified ?? p.files` — on a track
written here it **falls back to the file count instead of measuring**, so a
missing Verified line is invisible to the number that reports it. One page
corpus-wide; the mechanism is the finding, not the page.

**D3 · JavaScript phase 18 (storefront): 10 topics declared, 18 on the syllabus,
no scope note anywhere.** Track shows 100%. Every other cut in the corpus is
recorded — in the phase *name* (`phase-16-dynamic-programming` says "Master only
— rest dropped"), in a `:::warning Scope cut` (real-world phase 7), or in an
`:::info In scope` box (Git). Phase 18 has none of the three. Either 8 rows were
dropped silently or `topics: 10` is wrong.

**D4 · Two off-by-one topic counts, both claiming a topic the syllabus lacks.**
`expressjs` phase-5-errors declares **10** against **9** syllabus rows;
`java` phase-11-testing declares **12** against **11**. Express reads 100%.

**D5 · Storybook: 22 pages live on disk in 17 chapters `progress.js` does not
list.** Its phases 4–10 read *planned / 0 pages* while
`05-interaction-testing/`, `07-accessibility-testing/`, `08-documentation/`,
`13-build-and-configuration/`, `17-theming-colors-and-fonts/` and 12 more exist
and are served. The track total (44) is right because it is taken from disk; the
**phase list accounts for only 22 of them**. Storybook is modelled unlike every
other imported track — the other eleven get `verified: 0` and status `imported`,
Storybook's imported half gets nothing and reads as unwritten.

**D6 · Freshness stamps trail the last content commit on 8 tracks.**
`updated` drives the homepage "what moved lately" row and `lastUpdated()`.

| track | stamp | last commit to `docs/<track>` | behind |
|---|---|---|---|
| Storybook | 2026-08-14 13:35 | 2026-09-04 08:36 | **21 d** |
| JavaScript | 2026-08-15 14:06 | 2026-09-04 08:25 | **20 d** |
| CSS | 2026-08-14 09:15 | 2026-08-31 12:04 | **17 d** |
| TypeScript | 2026-08-18 19:16 | 2026-09-04 08:25 | **17 d** |
| Next.js | 2026-09-05 10:15 | 2026-09-05 17:19 | 7 h |
| Java | 2026-09-04 08:42 | 2026-09-05 16:47 | 1.3 d |
| Python · Real World · Java | — | — | 10 h – 1.3 d |

⚠️ **Jest & RTL was a FALSE POSITIVE in the first pass.** Its later commit
(2026-08-30) touched `docs/jest-rtl/syllabus/`, not `pages/`. `updated` is
documented as *"when that language's pages last changed"* — so **scope the
`git log` to `docs/<track>/pages`, not `docs/<track>`**, or a syllabus edit or a
board sweep reads as content drift.

---

## 3 · ⛔ Do NOT "fix" these — measured and correct

- **Git 100% is RIGHT.** The user re-scoped Git on 2026-08-14 to **52 topics
  across phases 0, 1, 2, 4, 5** (LOCKS §11d). The syllabus's 191 rows and 13
  phases are still on disk **under `:::warning Phase parked` banners**, and each
  in-scope phase carries an `:::info In scope — N of these topics` box that
  matches `progress.js` **phase by phase** (12, 10, 8, 8). Verified, not assumed.
- **Node phases 0–5 and React phase 0** — `pages < topics` with no
  `pagesPlanned`, crediting the full topic count. **Correct**: all 7 phase
  READMEs carry the Coverage table, confirmed by grep. These are the documented
  syllabus-row merges, exactly as [[devbible-cursor-audit]] warns.
- **real-world phase 7** — 4 declared vs 6 syllabus rows: `:::warning Scope cut —
  2026-08-17`, two topics dropped on the record.
- **Storybook's per-phase zeros** — documented in the `phaseFiles()` comment.
- **Track page counts** — every track's displayed page count equals disk exactly.
  Angular ran +6 ahead mid-audit because a live session was writing; that drift
  self-corrects, `yarn start` and `yarn build` both regenerate `page-counts.json`.

## 4 · ⚠️ Latent, not live

**`pages` holds FILE counts, not topic counts, in 10 PostgreSQL and 4 Next.js
phases** (`pages: 40` against `topics: 16` etc.). It feeds only `topicsCovered`,
which `summarise()` computes and **nothing renders** — grep confirms
`src/pages/index.js:145` uses `pagesValidated`/`pagesWritten` only. Harmless
today. It becomes a live 128%/131% the day anyone prints `topicsCovered`, which
is the trap [[devbible-cursor-audit]] §5 already names.

**Not machine-comparable:** Next.js (syllabus is prose, no `| Topic | Tier |`
tables — its 495 topics cannot be checked this way) and the 11 imported tracks
with no `syllabus/` directory at all.

## 5 · Reproduce it

```bash
node scripts/page-counts.mjs --check        # generated file vs disk
# per track: stamp vs reality
git log -1 --format=%cd --date=format:'%Y-%m-%d %H:%M' -- docs/<track>
# validated pages, the real measure (not p.files):
grep -l 'db-tier t-' <page> | xargs grep -L '^> Verified:'
```

🔴 **The counter bug to not repeat.** My first syllabus pass reported 42 drifting
phases; **17 were my own error.** Sectioning on `^## Phase N` only meant the
*last* phase in each file swallowed every trailing section — Express phase 10
read 22 rows against a real 11. **Cut sections at every `^## `, then keep the
ones naming a phase.** A syllabus row count is only trustworthy if it also counts
tables whose header is `| Topic |` and nothing else.

Related: [[devbible-cursor-audit]] · [[devbible-corpus-audit-20260905]] ·
[[devbible-locks]]


---

## 6 · 🔴 What each fix decided — repo commit `d924ae26`

**D2 — the mechanism, not the page.** `07-loading-scripts.md` turned out to carry
a deliberate *"Not verified — browser host"* banner and an open
`{/* VERIFY: ... */}` marker: it documents HTML-spec behaviour nobody ran and
declines to claim otherwise. **The page was honest and the dashboard overruled
it.** So the page was NOT touched. Instead `scripts/page-counts.mjs` now emits
`validated` and `validatedPhases` (tier badge AND a dated `> Verified:` line,
measured per file) and `summarise()` reads them. Corpus: **5,802 of 5,965
validated**. 🔴 The lesson generalises — `p.verified ?? p.files` was a *fallback
that asserted the thing it was meant to measure*.

**D3 — JavaScript phase 18: `topics` 10 → 18, with `pagesPlanned: 18`.** The
evidence was the directory numbering: `01`–`07`, `11`, `12`, `15` exist and `08`,
`09`, `10`, `13`, `14`, `16`, `17`, `18` do not — **the gaps preserve the
syllabus row index.** A dropped row gets struck through (real-world phase 7); it
does not get silently renumbered away. **JavaScript 100% → 97%.**

**D4 — the syllabus gained a row; `progress.js` did not lose credit.** Both
"extra" topics are real written pages: express `08-every-error-that-arrives/`
(3 chunks, Master) and java `12-real-world-scenarios/` (10+ chunks, Master, its
own `> Verified:` lines). Express's own phase README **already listed 10 rows in
its Coverage table while its prose said "All 9 syllabus topics"** — the syllabus
was simply behind the writing. Rows added to
`docs/expressjs/syllabus/02-http-surface.md` and
`docs/java/syllabus/04-production.md`; README corrected to 10. No percentage moves.

**D1 — Jest & RTL: the syllabus is the denominator. 100% → 27%.** 16 chapters,
2,516 lines between them, against a 59-topic syllabus. 🔴 **The remainder is ONE
explicit planned row, deliberately not a per-chapter mapping** — chapters 02 and
05 both land in syllabus phase 02, chapters 07 and 08 both in phase 04, and any
split of those is a judgement call. Baking a judgement call into a dashboard
number is how the track came to claim 100% in the first place.

**D5 — Storybook: the 17 imported chapters are listed. 40% → 31%.** With
`verified` measured at **0 of 22** (against 22 of 22 on the four phases written
here). It was the one imported track modelled without its chapters; it now
matches vite, webpack, babel, playwright and the rest.

**D6 — eight stamps repointed** to the last commit touching that track's
`pages/`: css, javascript, typescript, storybook, nextjs, real-world, java,
python. **Angular was left alone — a live session owns that row** and had already
stamped it 20:10.

### The standing rule this settled, now in the `progress.js` header

> **Every directory under `docs/<track>/pages/` gets a row in `progress.js`**, and
> a track whose syllabus asks for more than its chapters deliver carries the
> remainder as an explicit planned row. Finishing the conversion pass is not
> finishing the subject, and the phase list has to be able to say so.

### Gates run before the push

`yarn page-counts --check` current · **mdxcheck 6,890 files, 0 problems** ·
**linkcheck 6,969 files, 0 problems**. Pushed to `origin/main` (a sibling Git-A1
session's commits rode along — normal in this shared checkout; ancestry checked).

### ✅ Everything else now reconciles

The only tracks still showing a `progress.js`-vs-syllabus delta are the ones with
an on-disk record of why: **TypeScript phases 8, 9, 11** (`⛔ DROPPED 2026-08-15.
Nothing written. Kept as a record only.`), **JavaScript phase 16** and
**TypeScript phase 7** (the phase *name* says "rest dropped"), **Git** (the
2026-08-14 re-scope), **React** (`patterns`, an extra phase beyond the syllabus),
**real-world phase 7** (`:::warning Scope cut`), and **Storybook** (58 native +
17 imported, by the fix above). **Nothing unexplained is left.**
