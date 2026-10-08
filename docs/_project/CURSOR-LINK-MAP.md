---
name: cursor-link-map
description: 🔴 START HERE to resume the LINK MAP — for every topic in our existing syllabus (written or not), the best explanation found anywhere on the web, in one place. Pilot Redux Toolkit DONE 2026-10-05 (21/21 topics, awaiting the user's review). Cold-start state, results, findings, the next step by name.
metadata:
  type: project
---

# 🔴 START HERE — the link map ("hub + delta", one place)

## Cold start — state at the end of 2026-10-05

- **What it is:** for each topic in our *existing* syllabus, the page on the internet that explains it best —
  verified, dated, with what it leaves out. Official docs get no preference. Staged in
  `docs/_project/link-map/` (outside the site build); **nothing is on the site**.
- **Done:** the Redux Toolkit pilot — **21 of 21 topics** mapped in 4 files (below). After writing, an automated
  pass re-fetched every link: **55 unique URLs, all HTTP 200; 20 deep-link `#anchors`, all found** as heading ids.
- **Not done:** the user has **not reviewed the format**. The *not-written* side (topics with no page of ours yet)
  is untested — every RTK page is already written. No other track is mapped.
- **Next step, by name:** wait for the user's verdict on the pilot (open `link-map/README.md`, then the four
  files). Do **not** start another track until they pick one. My proposal was **MongoDB** — 39 pages written, 43 topics
  not (it tests both sides). Put the cost question below to them *before* scaling.
- **Git: NOT committed.** `git` is missing in the Claude desktop shell **and** in the user's `ubuntu` container terminal
  tab (checked 2026-10-05), so the files are saved on disk only. Commit from a shell that has git, exact paths only
  (never `git add -A`): `docs/_project/CURSOR-LINK-MAP.md` · `docs/_project/link-map/` · `docs/_project/LOCKS.md` ·
  `docs/_project/CHECKLIST.md` · `docs/_project/INDEX-meta.md`. A push touching only `docs/_project/**` does not
  trigger a Pages build.

**Files this lane wrote** (all ≤ 300 lines):

| File | Holds |
|---|---|
| [link-map/README.md](link-map/README.md) | what the folder is, how to read a block |
| [link-map/redux-toolkit/01-store-slices-thunks.md](link-map/redux-toolkit/01-store-slices-thunks.md) | T01–T06 · configureStore → cancellation |
| [link-map/redux-toolkit/02-rtk-query.md](link-map/redux-toolkit/02-rtk-query.md) | T07–T10 · RTK Query |
| [link-map/redux-toolkit/03-selectors-to-immer.md](link-map/redux-toolkit/03-selectors-to-immer.md) | T11–T15 · selectors, adapter, middleware, hooks, Immer |
| [link-map/redux-toolkit/04-typescript-to-migration.md](link-map/redux-toolkit/04-typescript-to-migration.md) | T16–T21 · TypeScript, DevTools, code splitting, testing ×2, migration |

Board entries added: a row in [LOCKS.md](LOCKS.md), an item in [CHECKLIST.md](CHECKLIST.md) §1 and a finding in §4,
an entry in [INDEX-meta.md](INDEX-meta.md). Nothing in `docs/` outside `_project/` and nothing in `instructions.md` was touched.

## Standing order — 2026-10-05, the user's words

> *"all the topics are already existing on internet keeping existing syllabus as it is and including
> existing completed / non completed syllabus we need to source proper explanations we have to link
> the articals in one place"*

> *"lets pick this way no need to specifically link with official docs wherever in internet explained
> topic better that place we need to point pick this task and which language will pick for testing ?"*

> *"No agents please pick the task and pick redux toolkit language lets see how it goes and make sure
> your saving session progress on each step"*

> *"Enough for the day please save the session progress for cold start and compelted files"*

This is the plan behind [feedback_hub_plus_delta_20260914.md](feedback_hub_plus_delta_20260914.md)
(2026-09-14, reconfirmed 2026-09-24). Nothing for it existed before 2026-10-05: the 09-14 research was
killed with 0 results banked, and the 09-24 audit mapped release changes, not links.

## Result of the pilot — Redux Toolkit, 21 topics

- **13 topics fully covered** by the pages linked; **8 partial** (T01 T02 T06 T07 T15 T16 T20 T21 — each says what is
  missing). **3 "Our delta" notes** where our page must keep saying something nobody else does: **T06** the `requestId`
  stale-response race · **T20** RTK Query endpoint testing · **T21** what RTK does *not* fix.
- **Official pages are "Read this" for 20 topics outright** (RTK 2 is the ground truth and its maintainers wrote the docs);
  T15's first pick is a third-party mechanism explainer (OpenReplay, 2026-01) paired with an official page. **Third-party
  links recommended: 3** — T13 (LogRocket, listeners vs sagas), T14 (Mark Erikson's React rendering guide), T15.
- **One real gap: T20.** No current RTK Query-specific testing guide exists: the two I opened use MSW 1 handlers
  (`rest.get`), MSW 2 replaced them; the RTK repo's Vitest example (`examples/query/react/vitest`) now 404s.
- **What the map adds even where official docs win:** the canonical URL, a verified deep-link anchor, a version note,
  and an honest "covers our angle" verdict. That is the value, more than finding a surprising third-party page.
- **Cost, by the session token counter:** about **250k tokens** for the whole session, the pilot being most of it —
  roughly **10k tokens per topic** at this depth, no agents. The docs tree holds ~7,500 page files in 21 tracks
  (chunks and READMEs included), so mapping everything at this depth would cost tens of millions of tokens.
  🔴 **Decision for the user before scaling: depth per topic vs coverage** (a lighter pass for the big tracks).

## Findings to pass to the user (reported, not acted on)

1. **The Redux docs merged into one site.** `redux-toolkit.js.org`, `react-redux.js.org` and `reselect.js.org` now redirect to
   `redux.js.org/toolkit/…`, `/react-redux/…`, `/reselect/…`. **20 of our pages cite the retired hosts** (18 in
   `docs/redux-toolkit`). They redirect, so nothing is broken; canonicalize when each page is next touched (added to CHECKLIST §4).
2. **The MongoDB board is stale:** [LOCKS.md](LOCKS.md) and the progress file's table say 34/82, but the pages tree holds
   **39** — phase 6's five pages (written 2026-09-01) are on disk; `$unwind` is the only phase-6 file owed.
3. **`instructions.md` §11 is stale:** it still says "strict focus: Node.js, Phase 2 done". Not edited.
4. **Traps for future links:** React-Redux's `usage-with-typescript` page is now `connect`-only (typed hooks moved to the
   Redux "Usage with TypeScript" page and the FAQ); `immer/es5` is gone (Immer 10 dropped the ES5 fallback).
   Our `docs/redux-toolkit/pages/07-react-redux-integration/01-hooks-api.md` cites `react-redux.js.org/api/hooks` and
   `/api/provider`, which are fine — not that TypeScript page.

## Decisions (made 2026-10-05)

1. **The spine is OUR existing syllabus, as it is** — every topic, written or not. Not the official LTS syllabus; no topic
   is added or dropped by this lane. (RTK has no `syllabus/` folder: its spine is the chunk table in
   `docs/redux-toolkit/pages/README.md`.)
2. **Point at whichever page explains the topic best.** Criteria, in order: explains the concept (why/how) · correct for the
   current version · clear, with runnable examples · covers the angle our topic names · free, no login · stable URL.
   One "Read this", up to two "Also good" only if each adds something distinct (a topic that joins two or three concepts may
   have `(1/2) (2/2)` Read-this lines). Articles only, no video.
3. **No agents, no Workflow** (user). The session researches with WebSearch / WebFetch / curl. Overrides the multi-agent
   design in [CURSOR-VERSION-COVERAGE.md](CURSOR-VERSION-COVERAGE.md) for this lane.
4. **"One place" (my default — the user has not confirmed):** one file per syllabus part, staged in
   `docs/_project/link-map/<track>/`; onto the site only after the user approves the format.
5. **Do not edit written pages or `instructions.md`.** §5 ("not a pointer to the official docs") conflicts with linking out
   and the user has not ruled.
6. **Save progress at every step** (user order) — the Progress table below was updated after each section.
7. The **version/outdated audit** (batch 1 verify, the 🐞 list in [CHECKLIST.md](CHECKLIST.md)) is separate and stays held.
   Do not launch batches 2–9 of the "new way" until the user says whether they still want them.

## Record format (one block per topic)

```
### Tnn · Topic title — Tier · ✅ written `docs/<track>/pages/…` | 🔲 not written
- **Read this:** [Title](URL#anchor) · site · why it is the best, one line · covers our angle: full | **partial** — what is missing · fetched YYYY-MM-DD
- **Also good:** [Title](URL) · site · what it adds · fetched YYYY-MM-DD
- **Our delta:** one line — only when partial; what our own page must keep saying
- *Checked, not chosen:* an alternative I opened and the objective reason it lost (length, date, a missing marker)
- *Not opened:* what search surfaced that I did not read (honest about what is unevaluated)
```

A topic nobody explains well: `Read this: none found — tried: <queries / sites>` (that topic is ours to own). A URL goes in only after
it was fetched in-session and its content matched the claim; a site that blocks fetching is `(not fetchable — unverified)` and
can never be "Read this". Quotes stay under 15 words; the "why" is our own words. Third-party links carry their date.

## Method (the helpers lived in the session scratchpad and are gone — re-create, ~40 lines each; no repo script was added on purpose)

- **heads** — fetch with a browser User-Agent; parse with Python `html.parser`: `<title>`, meta `article:published_time` /
  `modified_time` (or JSON-LD `datePublished`), h1–h3 text **with their `id` attributes** (the id is the `#anchor`), word count,
  and a count per keyword you pass. Keyword counts are the fast check that a page documents an RTK 2 API.
- **sect** — print one heading's section text; **ctx** — print text around a keyword. Use them when a claim rests on exact
  wording. (Code is tokenized with spaces: search `rest\s*\.\s*get`, not `rest.get`.)
- **linkcheck** — extract every `](https://…)` from the map files, GET each, require 200, and require `id="<fragment>"` for deep links.
- **Candidates:** a short WebSearch per topic (long queries often return nothing — retry shorter), then open the official page and
  the best third-party hits. Official site map: `https://redux.js.org/sitemap.xml` (173 URLs); Immer's docs publish none — probe paths.
- **Third-party currency tells:** `Tuple`, `.withTypes`, `weakMapMemoize` (RTK 2); MSW `http.get` + `HttpResponse` (v2) vs `rest.get` +
  `res(ctx.json())` (v1); Immer `enableES5` / `immer/es5` (old). Medium answers `curl` with 403 — unverified, never listed.
  Aggregator pages (DeepWiki, studyraid) are summaries, not explanations.
- **Environment:** `curl` reaches most sites; w3schools answers curl with 403 (use WebFetch). **No `git` in the desktop shell
  (Fedora 44) and none in the user's `ubuntu` container terminal tab** — a session cannot commit here; leave the paths
  listed in the cold-start block and say so.

## Progress — pilot: Redux Toolkit

| Step | What | State |
|---|---|---|
| 1 | Order + decisions saved (this file) | ✅ |
| 2 | RTK structure read: 21 topics in 13 sections; boards + index registered | ✅ |
| 3 | Official URL base banked (redux.js.org sitemap; 54 of 55 probed official URLs answered 200) | ✅ |
| 4 | T01–T06 → `01-store-slices-thunks.md` — official docs won all six; deltas T01, T06 | ✅ |
| 5 | T07–T10 → `02-rtk-query.md` — official docs won; 6 third-party posts opened, 2 Medium 403 (unverified); T07 partial | ✅ |
| 6 | T11–T15 → `03-selectors-to-immer.md` — first third-party picks: T13, T14, T15 | ✅ |
| 7 | T16–T21 → `04-typescript-to-migration.md` — the one real gap, T20 | ✅ |
| 8 | Automated re-check of every link (55/55 HTTP 200, 20/20 anchors); results summarised above | ✅ |
| 9 | The user reviews the format; picks the next track and the depth | ⏳ **the user's** |

## Open — the user's

1. **Review the format** — open `docs/_project/link-map/README.md`, then one file. Is this what "link the articles in one place" meant?
2. **Place:** staging in `docs/_project/link-map/` now, site pages after approval — and the site pages put link-outs on written pages,
   which needs a ruling on **`instructions.md` §5**.
3. **Next track and depth:** MongoDB next (the not-written side), and at what depth (see the cost note).
4. **Commit and push:** nothing from this lane is committed or pushed (no `git` where the session can reach it).
