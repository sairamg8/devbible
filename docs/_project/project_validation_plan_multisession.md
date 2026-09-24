---
name: devbible-validation-plan-multisession
description: THE plan for validating every explanation page already written in devbible — two passes, seven parallel lanes, a per-page stamp that makes it resumable, and the fix-vs-log policy. Open this on "start validation" or "pick validation lane V<n>".
metadata:
  type: project
---

# devbible — validating everything already written

**Written 2026-08-16.** The corpus is **2,212 leaf explanation pages · ~2,700 `.md`
files · ~482,000 lines · 25 technologies**, produced by roughly forty sessions over
four days under three different evidence regimes (sandbox-proven → doc-validated →
no-sandbox). Nothing has ever been checked end to end. This plan is how that gets
done **with several sessions running at once and none of them colliding**.

## The baseline — measured on disk 2026-08-16, not estimated

> 🔴 **SUPERSEDED 2026-09-05 — the counts below are stale, the method is not.** The corpus
> has since **more than doubled**: 2,212 leaf pages → **5,816**, ~482k lines → **1,391,717**,
> 25 tracks → **29**, and the finding that shapes this plan grew **636 → 834**. Re-measured
> totals, the current per-track spread, and the four Python files now over the cap are in
> [[devbible-corpus-audit-20260905]]. **Read that for the numbers and this file for the
> two-pass split, the seven lanes, the per-page stamp and the fix-vs-log policy**, which are
> all unchanged. Also corrected there: `devbible-linkcheck.py` produces **138 false positives
> and zero real findings**, so it must not be used as a lane's mechanical gate — the
> authority is `onBrokenLinks: 'throw'` in a real build.

| | |
|---|---|
| Leaf content pages (non-README, non-syllabus) | **2,212** |
| Files over the 300-line cap | **9** — 7 are the imported Storybook corpus, 2 are `docs/reviews/*` (not doc pages). **Every natively-written track is 0 over.** |
| Pages carrying `sandbox-proven` | **57** |
| 🔴 **Pages with an output-style fenced block and NO `sandbox-proven`** | **636** |
| Master-tier pages (first `db-tier t-` badge per file) | **830** |
| Pages with no `> Verified:` line | ~180 imported + a handful of native strays |

**The 636 is the finding that shapes this plan.** Those pages show a reader a console
block, a number or an error string, and nothing on the page says where it came from.
Some are copied verbatim from official docs (fine, needs a citation), some are
illustrative schema (fine, needs relabelling), and some may be **reconstructed from
memory — which is a rule-2 violation shipped to a reader as fact.** They are not
distinguishable without opening them.

Where they are: **PostgreSQL 262 · Node.js 178 · TypeScript 60 · Express 45 ·
React 31 · CSS 25 · Git 14 · Nginx 14 · Storybook 6 · Docker 1 · JavaScript 0 ·
MongoDB 0.** The two newest tracks are clean because they were written under the
no-sandbox rule; the two oldest carry two thirds of the risk.

## Two kinds of validation. Never mix them in one pass.

**Mechanical** — a script decides, no judgement, no reading. Cap, link resolution,
badge and `> Verified:` presence, Gotchas/Interview presence, `.md` link form,
duplicate headings, chunk-index integrity, `Prev`/`Next` continuity, stale
*(not written yet)* footers, phase-README coverage tables vs disk, `progress.js` vs
disk. **Runs once, over everything, by one session.** Cheap, total, and it must not
be re-derived by each lane.

**Semantic** — a model reads the page and checks what it *claims*. Provenance of every
output block, load-bearing claims against the primary source, version currency, code
correctness, whether a cross-reference points at the page it says it does, whether the
depth matches the tier. **Expensive, and it is the whole point.** This is what the
lanes do.

## The stamp — what makes this resumable and countable

A page is validated **iff it carries a stamp**, directly under its `> Verified:` line:

```
> Verified: <the original source line, unchanged>
> Validated: 2026-08-16 · pass B · claims + output provenance · session 3193693f
```

- Machine-countable: `grep -c '^> Validated:'` per track **is** the progress bar. No
  board to keep in sync, no session's count to trust, no double-validation.
- **Never edit or delete the original `> Verified:` line.** It records how the page was
  written; the stamp records that it was checked. Two different facts.
- A page whose claims changed gets its `> Verified:` line **extended** with the new
  source, not replaced.
- Chunked topics: **every chunk file gets its own stamp**, the topic `README.md` too.

## Severity ladder and the fix-vs-log policy

| | Defect | What the lane does |
|---|---|---|
| **S1** | Claim contradicted by the primary source · output block with no provenance · code that cannot work | **Fix in place, now.** One file, one commit. |
| **S2** | True once, wrong for the version the track pins | **Fix**, name the new source and the version boundary. |
| **S3** | Load-bearing claim, plausible, **no source found** | One fetch attempt. If the docs will not settle it → **rewrite the sentence as explicitly uncertain** (rule 8). Never delete, never assert. |
| **S4** | Structural — cap, link, badge, missing section, coverage/board drift | **Fix in place**, batched per file with the S1/S2 work. |
| **S5** | Cosmetic — wording, ordering, a heading style | **Ledger only.** Do not touch. A validation pass that rewrites prose stops being a validation pass. |

🔴 **The output-block decision tree — this is the pass's core judgement.** For each of
the 636:

1. **A real run exists** in `sandbox/<dir>` covering it → keep the block, add
   `sandbox-proven` and name the script and its recorded output file.
2. **It is copied from official documentation** → keep it, cite the exact doc page in
   `> Verified:`, and say on the page that the output is quoted from the docs.
3. **It is illustrative** — a shape, a schema, a "what a row looks like" → relabel the
   fence (`text` → not a console), and make the prose say it is illustrative.
4. **No provenance at all** → 🔴 **delete the block and write the explanation without
   it.** Do not re-run anything (rule 8, sandboxing is closed). Do not reconstruct
   anything (rule 2). A page that explains the behaviour in prose is worth more than a
   page with a plausible invented transcript.

Log every case-4 deletion in the ledger with the file and what was removed — that list
is the audit trail for how much invented output was actually shipped.

## The three passes

**Pass A · mechanical sweep — one session, whole corpus, first.**
Build `shared/scripts/validate.py` in the store (dry-run by default, `--apply` for the
safe auto-fixes, `--lane <name>` to scope). It emits one CSV per lane:
`file, line, check, severity, detail`. Nothing else starts until this CSV exists,
because it is what stops seven lanes each re-discovering the same 40 broken footers.

**Pass B · the risk set — seven lanes in parallel.** Every page that is (a) in the 636,
or (b) Master tier, or (c) makes a version-pinned claim. That is the set where being
wrong actually costs the reader something. **This is the pass that matters and the one
to run first after A.**

**Pass C · the remainder** — Understand/Know pages with no output blocks. Lowest yield;
run it per lane only after that lane's B set is closed, and treat it as sampling
(every page skimmed for cross-reference correctness and version drift, not re-sourced
claim by claim) unless pass B in that track found a systemic defect.

## The lane split — whole tracks only, seven lanes

Whole tracks, never a shared directory, never a shared phase README. Weight is
`leaf pages + 2 × risk pages`, so a lane's size reflects real work, not file count.

| Lane | Tracks | Pages | Risk pages (pass B) | Notes |
|---|---|---|---|---|
| **V1** | JavaScript phases **0–8** | ~388 | 193 Master, **0** output-block | Big but clean — no invented-output risk at all |
| **V2** | JavaScript phases **9–18** | ~368 | shares JS's 193 Master, **0** | Includes the parked phases 13–16, which are published and therefore in scope |
| **V3** | **PostgreSQL** | 367 | 🔴 **262** + 89 Master | The heaviest lane by far. Oldest track, most console blocks, `sandbox/pg-api` exists so many will resolve to case 1 |
| **V4** | **Node.js + Express** | 449 | 🔴 **223** + 161 Master | Second heaviest. Express's two known `body: undefined` blocks live here |
| **V5** | **React + CSS** | 410 | 56 + 151 Master | React's 31 are mostly `sandbox/react-p*`-backed |
| **V6** | **Docker + Nginx + MongoDB** | 346 | 15 + 131 Master | Newest tracks, written under no-sandbox — expect structural findings, not claim findings |
| **V7** | **TypeScript + Git + Storybook (native phases 0–3 only)** | ~266 | 80 + 105 Master | ⚠️ Git has **no interview sections by design** — that is not a defect, do not "fix" it |

**Out of scope for validation, deliberately:** the **180 imported toolchain pages**
(vite, webpack, babel, eslint-oxlint, jest-rtl, playwright, redux-toolkit,
tanstack-query, framer-motion, web-vitals, frontend-architecture, and Storybook's
legacy `NN-*` dirs). They have no `> Verified:` line, no tier badge and no interview
section because **they were never converted**, not because they failed validation.
That is a conversion project waiting on a user decision — validating them first would
mean validating pages that are about to be rewritten.

## Session protocol — what a lane session actually does

**On arrival:**

1. Read this file, then the lane's CSV from pass A.
2. **Claim the lane** — add a row to the validation board in `docs/README.md`'s active
   work table: `Validation lane V3 · PostgreSQL | session <id> | <date> | pass B, n/262`.
   Naming a lane transfers it; take it over from a stale id and say so.
3. Start at the first unstamped page in the lane's B set. Do not re-derive the position
   from git.

**Per file — the loop, and it is per FILE, not per topic:**

```
read the page  →  check every output block against the decision tree
               →  verify each load-bearing claim against the primary source
               →  fix S1/S2/S4 in place, log S3/S5
               →  add the > Validated: stamp
               →  commit that one file (stage explicit paths, never `git add -A`)
               →  append to the lane ledger in the store
```

Memory cadence: **every 2–3 files, no judgement call** (global rule 9). A lane that
dies mid-pass must lose at most three files of findings.

**Shared-file rules — the same ones that have already cost this repo time:**

- `src/data/progress.js` — **do not touch it.** Validation does not change page counts.
  If a lane finds `progress.js` disagreeing with disk, that is an **S4 ledger entry
  reported to the user**, not a fix, because those rows belong to the writing sessions.
- `docs/README.md` — your own validation row only.
- Never `git add -A`. Expect other lanes' rows in your diff and leave them.

**Builds:** default to **not building**. Verify links with the filesystem walker
(`shared/scripts/fixlinks.py`, dry-run). A full `yarn build` needs a claimed row in
`shared/session_build_devserver_registry.md` (global rule 12) — one build at the *end*
of a lane, not per file, and clear the row the moment it stops.

## The ledger — one file per lane, in the store

`devbible/validation_ledger_V<n>.md`, and a lane writes **only its own**:

```
| file | severity | check | what was wrong | what I did | source |
```

Plus a running header: pages stamped / pages in the B set, and the **case-4 deletion
list** (invented output removed). The ledgers are the deliverable — the stamps prove
coverage, the ledgers say what was actually found.

## Definition of done

**Per lane:** every page in its B set carries a `> Validated:` stamp · its ledger has a
row for every S1–S4 found · zero S1 left open · one clean isolated build with the
registry row claimed · a closing summary in the store.

**Whole pass:** all seven lane ledgers closed · a rollup written to
`devbible/validation_rollup.md` with the total defect counts by severity and by track ·
`grep -c '^> Validated:'` matching the B-set size in every track · the case-4 list
published so the size of the invented-output problem is on the record rather than
quietly fixed.

## Risks, and the traps this pass will hit

- 🔴 **The pass rewrites instead of validating.** The single biggest failure mode: a
  session opens a thin page, decides it deserves more depth, and starts writing. **That
  is a different project.** Depth complaints go in the ledger as S5. The only prose a
  validation session writes is the replacement for a deleted output block or an
  uncertainty hedge.
- **Seven lanes each fixing the same 40 stale footers.** Prevented by pass A running
  first and the CSV being authoritative.
- **A stamp that lies.** Stamping a page you skimmed is worse than not stamping it —
  it removes the page from every future pass. Stamp only what you actually checked, and
  say in the stamp *which* pass it was (`pass B` vs `pass C` are different promises).
- **A directory conversion mid-pass takes the whole site's build down** for every
  session (duplicate routes). Validation should not be converting flat files to
  directories at all — if a page is over the cap, that is an S4 ledger entry.
- **`git commit` can sweep in another session's staged files** in this shared checkout.
  Stage explicit paths and check `git status --short` after `git add`.
- **Store commits need `GIT_AUTHOR_*` / `GIT_COMMITTER_*`** env vars — no `user.*`
  config is readable here.

## Starting a lane — the whole instruction

> *"validation lane V3"* · *"start validation V6"* · *"pick validation lane 1"*

That is enough. Open this file, open the lane's pass-A CSV, claim the row, start at the
first unstamped page. **No plan, no confirmation, no clarifying question.** If the user
says *"start validation"* with no lane, ask which lane — that is the one question worth
blocking on, because guessing duplicates another session's work.

## Reproducing the baseline

```bash
cd /mnt/Storage/Backup/Knowledge/devbible/docs
# leaf pages
find . -name '*.md' ! -name 'README.md' ! -path '*/syllabus/*' ! -path './reviews/*' | wc -l
# the risk set, per track
for d in javascript postgresql react nodejs docker expressjs typescript css git nginx mongodb storybook; do
  printf "%-14s %4s\n" "$d" "$(grep -rlE '^```(console|shell-session|text|output)' "$d" | xargs -r grep -L 'sandbox-proven' | wc -l)"; done
# Master tier, by FIRST badge only (grep -rl over-counts — phase READMEs list every tier)
find "$d" -name '*.md' ! -name 'README.md' -exec awk '/db-tier t-/{if(match($0,/t-[a-z]+/)){print substr($0,RSTART,RLENGTH); exit}}' {} \; | grep -c 't-master'
# validation progress, once the pass is running
for d in */; do printf "%-14s %4s\n" "${d%/}" "$(grep -rc '^> Validated:' "$d" | awk -F: '{s+=$2} END{print s}')"; done
```

Related: [[devbible-overall-snapshot]] · [[devbible-no-new-sandbox-scripts]] ·
[[devbible-count-by-first-tier-badge]] · [[devbible-never-compress-to-fit-cap]] ·
[[session-build-devserver-registry]] · [[devbible-verify-your-own-measurements]]
