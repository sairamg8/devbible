---
name: progress-nextjs-ch14
description: Chapter 14 (agent-driven development) of the Next.js devbible track — CLOSED 2026-09-04 at 10 of 10 pages; the two splits and their proofs, the verbatim-quote correction, and the fork salvage that preceded the close.
metadata:
  type: project
---

# Next.js ch14 · Agent-driven development

**✅ CLOSED 2026-09-04, session `9348b38e`** (commit `4f3d3754`). Earlier state written at the
wind-down of session `833778c4`. The resume cursor is [[cursor-nextjs]]; this file is the record.

## Where it stands — CLOSED

**10 of 10 pages, renumbered gap-free 0–9.** Ten, not eight: **two** pages drafted over the cap
and were split (`05`→`05b`, `06`→`06b`), each proven UP.

| pos | file | lines | ★ | session |
|---:|---|---:|---:|---|
| 0 | `01-explanation.md` — the chapter index | 58 | — | `9348b38e` (`4f3d3754`) |
| 1 | `01-why-the-framework-now-ships-agent-infrastructure-…` | 138 | 16 | `10aadd98` |
| 2 | `02-agentsmd-and-repository-context-maps-…` | 192 | 19 | `10aadd98` |
| 3 | `03-the-nextjs-devtools-mcp-server-…` | 155 | 18 | `10aadd98` |
| 4 | `04-163-preview-first-party-skills-…` | 226 | 9 | `833778c4` (`1eb30217`) |
| 5 | `05-practical-agent-workflows-agent-authored-migrations.md` | 223 | 7 | `833778c4` (`a9bb5ec5`) |
| 6 | `05b-the-verification-loop-guardrails-and-review-discipline.md` | 189 | 7 | `833778c4` (`a9bb5ec5`) |
| 7 | `06-honest-limits-where-agents-fail-…` (was a 30L **EMPTY-bodied** stub) | 181 | 4 | `9348b38e` (`8a700877`) |
| 8 | `06b-what-an-agent-cannot-decide-and-what-context-files-fix.md` | 206 | 6 | `9348b38e` (`8a700877`) |
| 9 | `07-project-milestone-sprintdesk-gets-an-agentsmd.md` | 217 | 4 | `9348b38e` (`41940a72`) |

`src/data/progress.js` line 492 is now `topics: 10, pages: 10`, `pagesPlanned` dropped.

**Whole-chapter QC at close:** 0 over cap · 0 duplicate positions · 0 gaps · 0 missing tier
badges · 0 missing `> Verified:` lines · **0 bare `{/* FOOTER */}` markers** · 0 MDX hazards ·
0 dangling links · footer chain unbroken 0 → 9.

🔴 **Three stale `*(not written yet)*` footers were found and repointed at the close** — pages
03, 04 and 05b each promised a page that had since been written. They passed every mechanical
check the whole time: a plain-bold placeholder is not a dangling link, so nothing flags it. **A
chapter close must `grep -rn 'not written yet'` its own directory**, not just the link checker.

## 🔴 The second split, proven — 06 → 06 + 06b

Drafted as one file at **308 lines / 8 ★** (8 over the cap). Split on the concept boundary:

- **06** — the failures the *platform* produces silently: cache semantics where the type system
  checks arity and never the value, boundary placement that is tree-global while a diff is
  file-local, and the class that returns `200` with correct HTML and passing tests.
- **06b** — what an agent *structurally cannot decide*: the `[stream]`/`[cache]`/`[block]` fix
  menu, an authz check that proves the session and never the relationship, a11y as behaviour
  rather than markup, and changed defaults with no diff — plus exactly where bundled docs and
  MCP stop.

**AFTER: 181 + 206 = 387 lines, 4 + 6 = 10 ★. Both totals UP.** Written at **zero fetches**,
entirely off [[research-nextjs-ch19-appendices]].

🔴 **The page's own organising claim, worth keeping:** agent infrastructure moved the failure
boundary from *the agent does not know Next.js 16* to *the agent does not know your product*.
The bundled docs answer "what does the framework do"; your `AGENTS.md` answers "what has this
repository decided". Every failure worth a page is now on the second side, and the milestone
(page 07) inverts that inventory into policy — its load-bearing test is **could an agent have
derived this line from the code and the framework docs? If yes, delete it.**

## 🔴 The split, proven

`05` was written whole, measured at **302 lines / 10 ★**, and split on a concept boundary:
the migration itself (published prompt · three codemods and the gap · `--debug-build-paths`)
vs making the result reviewable (failing assertion first · guardrails · review discipline).

**After: 223 + 189 = 412 lines, 7 + 7 = 14 ★. Both totals UP.** `05b` is parked at
`sidebar_position: 20` and renumbers to 6 at chapter close.

## 🔴 The correction the cursor got wrong

The old cursor told the next session to reproduce **"the upgrade prompt Vercel publishes
verbatim"** on page 05. **That instruction contradicts `AUTHOR-BRIEF.md` rule 9** — one quote
per page, under 25 words — and the prompt is roughly 250 words. Page 05 instead analyses its
seven clauses in its own words and links to the guide. **Do not "fix" this by pasting the prompt
in.** The analysis is the value; the prompt is one click away and will drift.

The clause worth remembering from it: the prompt asks the agent to summarise **what changed,
what was verified, and what could NOT be verified** — separating the third from the second is
what turns a report into a review list.

## Facts spent on 04 and 05, do not re-derive

- **Skills were REPOSITIONED, not withdrawn.** The retired ones carried documentation; the four
  that ship today are workflows — `next-dev-loop`, `next-cache-components-adoption`,
  `next-cache-components-optimizer`, `next-partial-prefetching-adoption`. Installed with
  `npx skills add vercel/next.js --skill <name>`. ⚠️ The docs name three headings (*runtime
  foundations*, *interactive workflows*, *unattended loops*) but publish **no per-Skill mapping**
  to them — page 04 says so explicitly rather than inventing one.
- **`agent-browser` is `vercel-labs`, not part of `next`.** `--enable react-devtools` reports the
  component tree **and which Suspense boundaries are still pending** — the only observable that
  separates a streamed page from a blocking one, since both settle to the same DOM.
- **The fix-menu is `[stream]` / `[cache]` / `[block]`**, `[block]` being
  `export const instant = false`. It prints in the dev overlay (with **Copy prompt**), in the
  `next dev` terminal and in `next build` output.
- **`upgrade latest` is NOT a superset of the migration codemods** — the guide says so. Async
  Request APIs need `next-async-request-api` run separately, or the app fails at runtime.
- **`--debug-build-paths` scopes the route build but NOT the type check**, and combining them
  warns — `next build` shells out to the project-local `tsc`.

## ⚠️ Two forks were live at the wind-down

`833778c4` launched two `devbible-author` forks (ceiling: three agents including the coordinator)
and ended while they were still writing. **Both were told never to commit**, so their output is
uncommitted salvage.

- **ch12** — the six stubs at positions 1–6, overflow parked 100–139. On disk at 19:21:
  `01-static-and-dynamic-metadata-…md` modified and `01b-the-title-algebra-and-the-viewport-export.md`
  new at **304 lines — over the cap, must be SPLIT not trimmed**.
- **ch13** — the five stubs at positions 1–5, cross-linking to the written pages at 10–13 rather
  than re-teaching them. **Nothing on disk; start it fresh.**

Full salvage brief, including both forks' exact scope bullets, is in [[cursor-nextjs]].

## Lessons this session

- 🔴 **A cursor can carry an instruction that violates the author brief.** "Reproduce it verbatim"
  survived into a resume cursor and would have shipped a 250-word blockquote. **Check a cursor's
  content instructions against `AUTHOR-BRIEF.md` before executing them**, the same way you check
  a "CLOSED" claim against `git branch --contains`.
- **A page's own forward references are a hidden dependency.** 04, 05 and 05b all point at page
  06; because the stub file exists, 04's link resolves and the mechanical link check passes.
  Writing 06 is what makes those pointers honest, not what makes them valid.
- **The pre-commit hook catches cap breaches in ANY directory**, including a live fork's. Read the
  path before acting — a breach in someone else's lane is theirs to fix.

Related: [[devbible-locks]] · [[cursor-nextjs]] · [[research-nextjs-ch19-appendices]] (the bank
ch14 has been written from at zero fetches, except one T2 fetch of the version-16 upgrade guide
made this session for the published prompt).
