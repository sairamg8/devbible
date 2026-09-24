---
name: progress-realworld-build
description: Real World track — build progress · session 08ab5390
metadata:
  type: progress
---

# Real World track — build progress · session 08ab5390

**The resume file for "continue real world" / "real world scenarios".**
User instruction chain (2026-08-16): design real-world scenario addons → *"hope
your not duplicated any existing scenarios and write all of them please inside
the docs"* → *"Lets all the real world scenarios in one place"*. Design:
`devbible/project_realworld_addon_syllabus_design.md` (now implemented as ONE
section, not per-language addons).

## What it is

`docs/real-world/` — one storefront app implemented across the whole stack.
9 phases, 79 topics, 3 syllabus parts. **PERN-first, raw `pg`, no ORM** (user's
choice). **No duplication rule:** chapters compose existing concept pages and
LINK to them (React phase-7-custom-hooks, Express phase-8/10, PG part 3, JS
phase 17, Node phases); if a chapter re-teaches a concept, that is a bug.
Doc-validated, no sandbox, no console blocks (rule 8).

## State

- ✅ Syllabus complete + committed `a93a6724` (2026-08-16): 3 parts under
  `docs/real-world/syllabus/`, wired into `sidebars.js` (realworldSidebar),
  `src/data/progress.js` (key `realworld`, 9 phase rows, all pages: 0),
  homepage card (group "Real world", n 25), `docs/README.md` claims row +
  coverage row. Claim held by session `08ab5390`.
- ✅ **Phase 0 · The app COMPLETE 3/3** (2026-08-16): 01 spec (151 lines) ·
  02 architecture + data model (145) · 03 how to read (91) + README. Boards
  updated (progress.js phase-0 pages:3, pages/README ✅). All cross-section
  link targets verified on filesystem.
- ✅ **Phase 4 · The React UI COMPLETE 12/12** (2026-08-16, 13 files flat).
- ✅ **Phase 3 · The Express API COMPLETE 12/12** (2026-08-16; auth chunked). 🏁 WAVE 1 done — phases 0–3, 37/79 topics, 45 files.
- ✅ **Phase 2 · Node services COMPLETE 10/10** (2026-08-16, 11 files all flat). Boards closed.
- ✅ **Phase 1 · The database COMPLETE 12/12** (2026-08-16, 17 files: 2 chunked topics — schema, checkout txn). Boards closed on all four surfaces.
- ✅ **Phase 5 · JS functions COMPLETE 10/10** (2026-08-17) — 13 files, 2,600 lines,
  largest 291, 0 over cap, `pagesPlanned` dropped on all four boards.
- ✅ **Phase 6 · 01 The shared types package** (Master, 2 chunks / 489 lines, `6c33d198`).
- 🔴🔴 **THE REMAINING 19 TOPICS ARE SPLIT THREE WAYS (2026-08-17)** —
  [[devbible-realworld-split-3way]] carries the design and three paste-ready prompts.
  **A** = phase 6 TypeScript (7 left, start 6·02) · **B** = phase 7 CSS recipes (6, dir
  not created yet) · **C** = phase 8 MongoDB mirror (6, dir not created yet).
  "real world A" / "RW C" is the whole instruction — claim and start writing.
  Chapter code composes
  postgresql phases 2-3 concepts; the 11-table map is fixed in phase-0/02.

## Phase order and topic counts (from the syllabus files — read them, they are
the worklist)

0 The app (3) → 1 Database raw pg (12) → 2 Node services (10) → 3 Express API
(12) → 4 React UI (12) → 5 JS functions (10) → 6 TypeScript (8) → 7 CSS (6) →
8 MongoDB mirror (6).

## Conventions for every chapter

- Page contract: problem → design choices w/ costs → full implementation
  (complete, copyable, no elisions) → using it in the app → gotchas
  (symptom→cause→fix) → interview Qs (★ marked).
- 🔴 **Rule 13 (2026-08-17) SUPERSEDES the old "interview Qs (3–8)" here.**
  Gotchas and Q&A get **as many entries as the topic has** — never a quota.
  Write it all, THEN split so no file passes 300. **Uniform section counts
  across a run of pages are proof the topic was not exhausted.**
- `> Verified: 2026-08` naming the docs consulted + the concept pages composed.
- 300-line cap = file size only; split on concept boundary at 301, chunk dirs
  per house layout. NEVER trim content to fit.
- Links: always end .md, keep numeric prefixes. Cross-language links relative
  (`../../nodejs/pages/...`).
- Per-file cadence: write file → update boards (progress.js realworld row w/
  pages+pagesPlanned, phase README, pages/README, docs/README rows) → commit
  (explicit paths, never `git add -A`) → update this memory.
- No `yarn build`/`yarn start` without claiming
  `shared/session_build_devserver_registry.md` (rule 12). Link-check against
  the filesystem instead.
- 🔴🔴 **A MDX COMPILE DOES NOT PROVE A PAGE RENDERS.** `{kind}` is valid MDX, so
  `compile()` passes and the page dies at static render with `ReferenceError: kind is
  not defined`. **This kept the Pages deploy RED on 2026-08-17 while TWO independent
  full-corpus compiles reported green** — mine at 2,919 and 2,925 pages. The cause was
  my own 5·07 line 196: a template literal inside an inline code span written with
  **backslash-escaped backticks**, which do NOT escape inside a code span, so the span
  closed early and `${kind}-${id}` became live JSX. **Use double-backtick delimiters.**
  The check that catches it walks the AST for `mdxTextExpression`/`mdxFlowExpression`
  nodes whose value is a bare identifier — script in [[devbible-realworld-split-3way]].
  Verified 2,926 pages, zero remaining, at `c98b22ae`.
- 🔴 **AND run the MDX wrapped-code-span check** — a link check cannot see it,
  and it broke the Pages deploy on 2026-08-17 (12 errors, all chunk A's React
  patterns). **An inline code span that wraps across a line break, where the
  continuation line starts with `{`, fails the MDX build**: MDX reads the `{`
  as a JSX expression before the span resolves. Fix by keeping the span on one
  line. Detail: [[devbible-search-chunk-b]].
- 🔴 **The authoritative check is compiling with MDX itself**, not a regex —
  `@mdx-js/mdx` is already in `node_modules`, ~2,900 pages take a couple of
  minutes, and it needs **no build-registry claim** because it is a per-file
  parse, not a bundle. **Verified 2026-08-17: 2,919 pages, all clean.**
  Two footguns that each gave a WRONG answer before I got it right:
  **(a) `compile()` is async** — without `await` inside the `try`, rejections
  escape the `catch` and the sweep prints "all clean" then dies on an unhandled
  rejection. **(b) Strip the YAML frontmatter first**, as Docusaurus does —
  otherwise `---` parses as a setext heading and a JSX-looking tag in a *title*
  (`<script>`, `<Suspense>`, `<Activity>`, `<ViewTransition>`) reads as an
  unclosed element. That produced 4 false positives on healthy React pages.
  And ⚠️ **a sweep of the shared checkout while another session writes yields
  transient hits** — two files were caught mid-rewrite. Re-run before believing
  a hit in someone else's tree.

## 🔴 After this track: pick up the Node.js gaps worklist

User instruction mid-session (2026-08-16): *"Once you done with current task
please pick a language and start work on"*. The chosen next work is the
**Node.js gaps worklist** (`progress_nodejs_improve_review.md`) — it is this
session's locked language and its P1 accuracy fixes are queued. Do that before
taking any other language.

## Interlock with the Node.js gaps worklist

`devbible/progress_nodejs_improve_review.md` has the review findings. The
outbox chapter (phase 2 topic 4) MUST implement the CORRECT at-least-once
order (enqueue-then-mark / mark-in-txn) — the existing Node page
`phase-7-background-work/06-transactional-outbox.md` has the inverted claim
(P1 item 1 of the gaps worklist). Do not copy from it until fixed; cite the
pattern correctly and flag the pending fix.

## Written so far

| Phase | Topic | Files | State |
|---|---|---|---|
| 0 | 01 spec · 02 architecture · 03 reading | 4 (incl. README) | ✅ complete, committed |
| 1 | 01 the schema (chunked: conventions+catalog / carts+orders+outbox) | 3 | ✅ committed |
| 1 | 02 migrations (flat, 198) | 1 | ✅ committed |
| 1 | 03 seeds & fixtures (flat, 188) | 1 | ✅ committed |
| 1 | 04 catalog query (184) · 05 full-text search (168) | 2 | ✅ committed |
| 1 | 06 checkout txn (CHUNKED: transaction / concurrency+failure) | 3 | ✅ committed |
| 1 | 07 money & time (156) · 08 jsonb attributes (147) | 2 | ✅ committed |
| 1 | 09 dashboards (166) · 10 indexes (183) | 2 | ✅ committed |
| 1 | 11 soft delete (145) · 12 LISTEN/NOTIFY (138) | 2 | ✅ committed — 🏁 **PHASE 1 COMPLETE 12/12** |
| 2 | 01 API boot (188) · 02 data layer (207) | 2 | ✅ committed |
| 2 | 03 upload service (221 w/ sweepTmp) · 04 outbox relay+email (224, correct send-then-mark) | 2 | ✅ committed |
| 2 | 05 scheduled jobs (185) · 06 webhook dispatcher (177) | 2 | ✅ committed |
| 2 | 07 search indexer (90) · 08 cache layer (186) · 09 health+metrics (171) | 3 | ✅ committed |
| 2 | 10 ops CLI (183) | 1 | ✅ committed — 🏁 **PHASE 2 COMPLETE 10/10** |
| 3 | 01 structure (172) · 02 validation boundary (175) · 03 auth (CHUNKED sessions/JWT, 3 files) | 5 | ✅ committed |
| 3 | 04 authorization (190) · 05 catalog endpoints (184) | 2 | ✅ committed |
| 3 | 06 cart endpoints (190) · 07 checkout endpoint (176) | 2 | ✅ committed |
| 3 | 08 uploads endpoint (188) · 09 error contract (199) · 10 rate limiting (190) | 3 | ✅ committed |
| 3 | 11 inbound webhooks (190) · 12 OpenAPI (168) | 2 | ✅ committed — 🏁 **PHASE 3 COMPLETE 12/12 — WAVE 1 (backend spine) DONE 37/79** |
| 4 | 01 useAsync+api client (179) · 02 useDebounce+search (161) | 2 | ✅ committed |
| 4 | 03 infinite list (203) · 04 useForm+checkout (208) | 2 | ✅ committed |
| 4 | 05 useLocalStorage (157) · 06 cart state (210) | 2 | ✅ committed |
| 4 | 07 modal/portal/focus (181) · 08 upload with progress (194) | 2 | ✅ committed |
| 4 | 09 auth in client (194) · 10 admin table (201) · 11 error boundaries (187) | 3 | ✅ committed |
| 4 | 12 when TanStack Query (130) | 1 | ✅ committed — 🏁 **PHASE 4 COMPLETE 12/12** |
| 5 | 01 fetch wrapper (186) · 02 TTL/SWR cache (195) | 2 | ✅ committed |
| 5 | 03 task queue (172) · 04 event bus (166) | 2 | ✅ committed |
| 5 | 05 validation engine (181) | 1 | ✅ committed `0f6445d3` |
| 5 | **06 money and dates with `Intl` (Master, CHUNKED: formatter / dates+windows / where it breaks)** | 4 | ✅ committed `f2715cf7` — 232+223+187+67 = **709 lines** |
| 5 | 07 slug & search normalization (291) | 1 | ✅ committed `643b0746` |
| 5 | 08 feature flags (224) | 1 | ✅ committed `2eac1946` |
| 5 | 09 optimistic-update helpers (234) | 1 | ✅ committed `522400ef` |
| 5 | 10 debounce & throttle applied (208) | 1 | ✅ committed `81091c5c` — 🏁 **PHASE 5 COMPLETE 10/10** |
| 6 | **01 the shared types package (Master, CHUNKED: why a package / consuming it)** | 4 | ✅ committed `6c33d198` — 489 lines |

**Totals as of 2026-08-17: 60 of 79 topics, 79 files, 0 over the 300-line cap.**

🔴 **5·06 onward are written under rule 13** (set 2026-08-17): written exhaustively
first, then split. Section counts are deliberately NOT uniform — 5·06 chunks run
gotchas 7/8/8 and Q&A 7/8/9, **5·07 runs 10 and 10** (291 lines, the longest flat page
in the track), 5·08 and 5·09 run 8/8, 5·10 runs 9/8. Phase 5's pages span
186–291 lines — a real spread, not a band under the cap. Doc-validated against MDN's `Intl` reference; the load-bearing fact is that
**currency fraction digits default from the ISO 4217 minor-unit list**, which is what makes
a hardcoded `/100` a bug rather than a shortcut.

⚠️ **Cadence slip caught 2026-08-17.** 5·05 was written but left uncommitted with
its boards untouched across a session boundary — the phase README still read
*(not written yet)* while the file existed on disk. The per-file rule is write →
boards → commit → memory, and the file half ran without the other three. Closed
on all four surfaces at `0f6445d3`.
