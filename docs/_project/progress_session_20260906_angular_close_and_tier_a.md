---
name: devbible-session-20260906-angular-close-and-tier-a
description: 🔴 Session save 2026-09-06 (evening). Angular topic 01 CLOSED, dashboard corrected, audit A1 CLOSED (36 git pages), A2 started with four agents IN FLIGHT at save time. Read this before assuming any of that is unfinished.
metadata:
  type: project
---

# Session save — 2026-09-06 evening, session `4e8d4393`

Saved at the user's instruction with context near 55%. **Everything below is committed and
pushed** except the four agents' output, which was still being written when this was saved.

## What closed, in order

### 1 · Angular phase 0 topic 01 — CLOSED
`docs/angular/pages/phase-0-how-angular-runs/01-compiler-with-a-framework-attached/`.
All 17 chunks: **70 files, 17,807 lines, 421 ★**. Commits `29174960` `3e2da484` `88a5787a`.
Full record: [[devbible-angular-topic01-closed-20260906]]. Cursor repointed to topic 03,
next file `05e-provide-check-no-changes-config.md`.

### 2 · Dashboard — Angular phase 0 `pages: 1 → 2`
`summarise()` credits a writing phase `topics × pages / pagesPlanned`, so **the unit is a
finished TOPIC**: 70 files moved Angular from 1 to **2 of 211 topics**, about half a point.
`page-counts.json` regenerated from disk (angular 47 → 125). Commits `2c1aaded` `8cb6dd25`.

### 3 · Audit item A1 — CLOSED
All **36** git pages that lacked `## Interview questions` now have it; the whole 57-page
track carries the section. 36 per-file commits. Record:
[[devbible-git-a1-interview-questions-20260906]].

### 4 · 🔴 One build break, and the lesson
A bare `<sha>` inside an italic quote is a JSX tag to MDX and **failed the build** —
run `34043917136` is red for exactly this. The fix is committed (`ceb0bfcc`) and rides in
run `34044233496`, which was still in progress at save time. ⚠️ **Confirm that run went
green before assuming the deploy recovered.**
The reusable lesson — the project's own documented `mdxcheck --no-rawtag` is the flag that
*hides* this class — is [[devbible-feedback-mdxcheck-no-rawtag-hides-a-build-breaker]].

## 🔴 IN FLIGHT AT SAVE TIME — four validation agents (audit item A2)

Launched from this session, **bounded slices so each finishes**, each barred from
committing; the coordinator QCs and commits as each reports. The user then said **deploy no
more agents** — when these four report, A2's first round is done and the rest of the 164
pages is a fresh decision, not an assumed continuation.

| Agent | Scope | Notes given to it |
|---|---|---|
| babel | 6 named units, `docs/babel/pages/01…06` | pin is `latest`/null — cite versions where read |
| vite | first 6 topic dirs under `docs/vite/pages/` | Rollup-vs-Rolldown is live upstream — verify, do not assume |
| playwright | first 6 topic dirs | watch auto-waiting, timeouts, fixtures |
| tanstack-query | **A3 first**, then 4 units | banked pin note handed over: `queryClient.query()` **ships in 5.102.8**, not v6 |

Each was told: verify load-bearing claims only · fix S1–S4, 🔴 **S5 is ledger-only** · add
tier badge + `> Verified:` + `## Gotchas` + `## Interview questions` · stamp
`> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393` · ≤8 fetches ·
no builds, no installs, no git.

**At save time only one file had appeared on disk** —
`docs/vite/pages/01-core-architecture/01-dual-engine-model.md`, modified, uncommitted,
still being written. ⚠️ **A cold session must NOT assume that file is finished.** Check
mtime; if it is stale and the agents are gone, QC it as salvage before committing.

### The commit procedure owed for each agent's output
```bash
python3 /mnt/Storage/my-learning/claude/shared/scripts/mdxcheck.py docs/<track>   # raw-tag ON
yarn linkcheck docs/<track>
wc -l docs/<track>/pages/*/*.md            # nothing over 300
yarn validate --guard HEAD~1               # proves it checked, did not rewrite or shorten
git add <exact paths> && git commit
```
Then append the row to [VALIDATION-LEDGER.md](VALIDATION-LEDGER.md).

## 🔴 Gaps this save would otherwise have left (patched 2026-09-06, same session)

**1 · The user deprioritised the build.** Verbatim intent: *do not chase CI for now — focus
on validating and content checking; the build can be dealt with at the end or another
time.* The CI watcher was stopped. ⚠️ This is a **session preference, not a policy change**:
`onBrokenLinks: 'throw'` still means one bad link fails `build` and **skips** `deploy`, so
the local gates (linkcheck, mdxcheck **without** `--no-rawtag`) are now the only thing
standing between a bad page and a silently stale site. Run them per file regardless.

**2 · An agent's report exists ONLY in the conversation.** The files land on disk, but the
findings — which claim was checked against which URL, what could not be confirmed — live in
the agent's returned text and nowhere else. 🔴 **Bank each row into
[VALIDATION-LEDGER.md](VALIDATION-LEDGER.md) as that agent reports, not at the end.** A
compaction or a dead session loses every unreported report, and the pages would then carry
a `> Validated:` stamp with no record of what was actually checked — worse than unstamped.

**3 · The bar their output is being held to**, so a later session judges it the same way:
- **Verified, not asserted** — every S1–S4 fix names the source that settled it, a URL and
  the sentence. "Per the docs" is not a citation.
- **Checked, not rewritten** — `yarn validate --guard HEAD~1` flags rewrite-shaped churn and
  🔴 any file that got **shorter**. S5 (wording, ordering, heading style) is ledger-only.
- **Grounded sections** — added `## Gotchas` / `## Interview questions` must come from what
  the page teaches, not from general knowledge of the tool.
- **Honest provenance** — `> Verified:` names pages actually read; `> Validated:` sits
  **under** it and never replaces it. They record two different facts.
- **Version claims** — babel, vite and playwright are all pinned `latest`/`null`, so a
  version may only be stated where it was read. Vite's Rollup-vs-Rolldown question is the
  most likely place to produce a confident wrong sentence.

**4 · If the session ends before the agents report:** their files are on disk, unstamped or
half-stamped, and the reports are gone. Treat every modified file under `docs/babel/`,
`docs/vite/`, `docs/playwright/` and `docs/tanstack-query/` as salvage — QC it, and if it
carries a `> Validated:` stamp with no ledger row, **verify a sample of its claims before
trusting the stamp**.

## State of the audit board

A1 ✅ closed · A2 🚧 first round in flight, **0 of 164 pages stamped at save time** ·
A3 🚧 inside the tanstack agent · B1 (Node 26, 311 pages, deadline 2026-10-28), B2, the four
tier-C decisions and tier D's 715 topics all **untouched**. [[cursor-audit]] is the board.

Related: [[cursor-audit]] · [[devbible-locks]] · [[devbible-angular-topic01-closed-20260906]] ·
[[devbible-git-a1-interview-questions-20260906]] ·
[[devbible-feedback-mdxcheck-no-rawtag-hides-a-build-breaker]]
