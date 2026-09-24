---
name: devbible-validation-ledger
description: The append-only ledger of devbible validation passes — one row per unit, banked the moment that unit closes. Open it when validating pages, when asked what has been checked, or when a finding needs recording. The queue lives on disk (`yarn validate --queue`); this file holds only what a script cannot compute.
metadata:
  type: project
---

# devbible — the validation ledger

**Seeded 2026-09-06.** One row per **unit** (one topic directory), appended the moment that
unit closes — never at the end of a campaign.

🔴 **Why this file is append-only and lives here, not in the repo:** on 2026-09-05 two
multi-agent audit runs dispatched 31 agents; 17 hit the usage limit, **including both
synthesis agents**, and everything they produced lived in `/tmp/claude-1000/…`, which was
**empty by 05:34 the next morning**. The findings that survived did so only because a
conversation happened to be compacted rather than closed. *A finding is not banked until it
is in this store.* See [[devbible-audit-workflow-findings-20260906]].

## What goes here, and what does not

| | |
|---|---|
| **Here** | S1–S5 findings · what a source would not settle · gaps found · anything wrong **outside** the unit, found-not-fixed |
| **Not here** | *which pages are validated* — that is `grep -c '^> Validated:'` over `docs/`, computed by `yarn validate`. A hand-kept progress number is the thing that failed twice already. |

## How to add a row

```bash
yarn validate --queue                 # pick the top unit
yarn validate --unit <dir>            # prints the brief AND this row, pre-filled
```

Then run it per `.agents/references/validation-pipeline.md`, stamp the files, **append the
row, and commit** — before starting the next unit.

🔴 **S5 findings are rows, not edits.** Wording, ordering and heading style get logged here
and nothing else. A validation pass that rewrites prose stops being a validation pass — it
has already happened to this corpus once.

---

## Baseline — measured 2026-09-06, `yarn validate`

**5,902 pages · 68 validated · 1,036 units pending** (2026-09-06, after framer-motion batch 1).
47 are Next.js (session `d2e9b9fe`); **21 are framer-motion**, which went 16 → 29 pages as
over-cap chapters were split. Page total moved 5,984 → 5,902 because `syllabus/` and
`reviews/` are now correctly excluded from the content queue.

Ranked by risk per file, which reproduces the audit's own priorities from marks alone:

| Rank | Tracks | Pages | Risk/page | Condition |
|---|---|---:|---:|---|
| 1 | babel · eslint-oxlint · framer-motion · frontend-architecture · playwright · ~~redux-toolkit~~ (✅ **DONE 2026-09-06**) · tanstack-query · vite · webpack · web-vitals-performance | 164 | **83** | 🔴 **Never sourced.** 0 `> Verified:` lines, 0 tier badges, 0 Interview sections. Live on the site with no signal to the reader. framer-motion's 13 wrong imports are already proven, so this class is known to contain real errors. |
| 2 | storybook | 44 | 42 | Half-converted: 56% sourced, 22 without Interview sections, 7 over the 300-line cap |
| 3 | git | 57 | 14 | **36 pages missing `## Interview questions`** — in a track the homepage shows as 100% |
| 4 | nodejs · postgresql | 532 | 12 | The console-block risk set (Node 174 files, PG 262) — ⚠️ a flag, not a verdict; see below |
| 5 | everything else | ~5,100 | <10 | Sourced, badged, structurally sound; unchecked by a second pair of eyes |

⚠️ **The console-block signal is weaker than it looks and must not be over-read.** The test
(a ` ```console ` fence in a file with no `sandbox-proven` marker) reproduces the known
636-file risk set exactly — but a spot check of
`docs/postgresql/pages/phase-7-pg-driver/01-install-wire.md` found a `> Verified:` line
naming the container and port it was run in (`postgres:18-alpine`, `127.0.0.1:55432`). It
was sandbox-run; it simply predates the marker. **Weighted at 12, not 30**, because scoring
it as a defect buried the raw imports — which have proven errors — thirteen places down.

---

## Rows

| Unit | Date | Pages | S1 / S2 / S3 / S4 / S5 | Finding | Session |
|---|---|---:|---|---|---|
| `docs/eslint-oxlint/pages/01-linting-landscape-and-tooling-decisions` | 2026-09-08 | 1 | **0 / 0 / 1 / 4 / 2** | First unit of the eslint-oxlint import, and the prose held up: the 50–100× speed claim, the ESLint-only/Oxlint-only/dual-run/Vite+ table and `eslint-plugin-oxlint`'s role all match oxc.rs verbatim. S3: layout rules moved to `@stylistic/eslint-plugin-js` **and** `-ts`, not a single `@stylistic/eslint-plugin`. S4: no badge, no `> Verified:`, no `## Gotchas` heading, no `## Interview questions` — all four added, 6★. S5 (untouched): numbered `## 1./2./3.` headings, emoji title. Research banked: [[research-eslint-oxlint-01-landscape]] | `098d4888f` |

| `docs/framer-motion/pages/01-core-concepts` | 2026-09-06 | 1 | **1 / 1 / 0 / 4 / 3** | 🔴 **S1: taught `motion(Component)` — ZERO hits in all 131 current docs; the documented API is `motion.create()`.** S2: asserted `forwardRef` is *required*, but upstream splits it by React version and this corpus pins React **19.2.8**, where `ref` is an ordinary prop — Pitfall 1 was built entirely on that premise. S4: no badge, no `> Verified:`, no `## Gotchas`, no `## Interview questions`, no footer. S5 (untouched): emoji heading, "Under-The-Hood Mechanics" naming, prose voice. `3b05106b` | `f53ba511` |

| `docs/framer-motion/pages/02-basic-animation-props` | 2026-09-06 | 3 | — | 141→744 lines, 39★. Split ×2 on concept boundaries | `7bd62b25` |
| `docs/framer-motion/pages/03-transition-types` | 2026-09-06 | 2 | — | 118→446, 0★ (uses the `### ⚠️ Pitfall` alt form — valid house style, consistent within the page). Kills the *"duration is ignored on a spring"* folklore with the precedence rule quoted verbatim | `7bd62b25` |
| `docs/framer-motion/pages/04-variants` | 2026-09-06 | 1 | — | 137→299, 23★ | `7bd62b25` |
| `docs/framer-motion/pages/05-gestures` | 2026-09-06 | 4 | — | 114→986, 17★. Split ×3 | `7bd62b25` |
| `docs/framer-motion/pages/06-animatepresence` | 2026-09-06 | 4 | — | 130→764, 12★. Split ×3 | `7bd62b25` |
| `docs/framer-motion/pages/07-layout-animations` | 2026-09-06 | 4 | — | 130→804, 27★. Split ×3 | `7bd62b25` |
| `docs/framer-motion/pages/08-scroll-linked-animations` | 2026-09-06 | 2 | — | 132→527, 40★. 🔴 **The agent wrote two links to a `01b` sibling BEFORE creating it** — a dangling link breaks the build for every session, and the verify stage did not catch it. Landed later; links restored. Also left `_qcheck.py` inside `docs/` (removed) | `48aded9b` `738d8e5b` |

### What the first unit taught

🔴 **A mechanical rename sweep is NOT validation, and running one first would have hidden
the worse defect.** The import fix (`framer-motion` → `motion/react`, 20 imports across 13
files, `977a22fe`) is real and cheap. But the page's *worse* error — teaching an API that
upstream no longer documents at all — sits in the same code block and no import sweep would
have touched it. **Pass A buys coverage, not correctness. Do not let a green mechanical
sweep read as a validated track.**

🔴 **The defect class no tooling can catch, demonstrated.** The `forwardRef` claim was
correct when written and was silently falsified by **React 19 — a different library's**
release. There is no version string on the page, no quote to check, no import to grep. Only
someone re-reading the claim against the source finds it. `yarn currency` will never see it.

⚠️ **`--guard` trips on every first conversion, and that is expected.** This unit came back
`+85/-20`, over the 40-line churn threshold, because a raw import gains a badge, a
`> Verified:` line, `## Gotchas`, `## Interview questions` and a footer all at once. **The
signal that means stop is a file that got SHORTER** — that is a trim. Growth on a first
conversion is the job.

⚠️ **`mdxcheck.py` prints `0 hazard(s) in 0 file(s)` on a clean run** — `files` counts files
*with* hazards, not files scanned. It is not a no-op; verified with a positive control
(a bare `<!-- -->` is caught, exit 1). Do not "fix" it.

---


### What batch 1 taught — 8 agents, 7 chapters, 902 → 4,326 lines

🔴 **An agent can stamp a page it has left in a broken state.** Chapter 08 came back
`> Validated:` with two links to a file that did not exist yet. The adversarial verify stage
was told to `ls` every link target and still did not report it before the run ended. **A
coordinator-side link check is not optional** — the one in `.agents/references/validation-pipeline.md`
step 7 caught it, the agent's own QC did not.

⚠️ **Do not conclude "the agent failed" from a file's absence mid-run.** `01b` was written
minutes after I recorded it as missing and repointed around it. Both moves then had to be
undone. **Wait for the workflow to return, or stop it, before judging disk state.**

⚠️ **Agents leave debris in the tree.** `_qcheck.py` was written into
`docs/framer-motion/pages/08-scroll-linked-animations/`. Docusaurus ignores `_`-prefixed
files so nothing broke and no check flagged it. **Grep for non-`.md` files under `docs/`
before committing.**

✅ **Splitting works when it is instructed explicitly.** Four chapters passed 300 lines and
produced 12 new `01b`/`01c`/`01d` siblings. **Every chapter grew; not one shrank.** The
transient over-cap states the hook reported (480, 416, 344, 332 lines) were mid-write, not
trims.

⛔ **09-motion-values was never written** — its agent produced nothing before the run was
stopped. It stays in the queue. **Absence of a finding is not a clean bill of health.**

---

## Known findings that predate the ledger

Banked here so a validation pass does not rediscover them. Each is a **live defect on a
published page**.

| Unit | Severity | Finding | Source |
|---|---|---|---|
| `docs/tanstack-query/pages/09-prefetching-and-ssr/` | **S2** | Headlines `prefetchQuery`, now `@deprecated` — should teach `queryClient.query()` | [[devbible-audit-workflow-findings-20260906]] |
| `docs/tanstack-query/pages/01-core-concepts/01-the-server-state-model.md:25` | **S2** | v4 positional form `useQuery(['user', 1])`; v5 is object-only | ibid. |
| ~~`docs/framer-motion/` (13 files)~~ | ~~S1~~ → **S2, FIXED `977a22fe`** | 20 imports swapped to `motion/react`. ⚠️ **Reclassified: `framer-motion` 13.2.0 is still published in lockstep with `motion` 13.2.0 and is NOT deprecated on npm** — out of date with upstream's instruction, not broken code. Do not tell a reader the old name breaks their build | [[research-framer-motion-track]] |
| `docs/nextjs/pages/05-caching-ppr-and-cache-components/01c-…md` | **S2** | Prescribes `connection()`; 16.3 prefers `io()`. 🔴 **Do not sweep the ~50 other files** — one new page plus a pointer | [[devbible-audit-workflow-findings-20260906]] |
| `docs/git/pages/**` (36 files) | **S4** | No `## Interview questions`. All 145–238 lines, so the section fits with no split | [[devbible-corpus-audit-20260905]] |

⚠️ **Never measured, and absence of a finding is not a clean bill of health:** `git`,
`docker`, `expressjs`, `jest-rtl`, `css` were dispatched to audit agents on 2026-09-05 and
all five died before returning.

Related: [[cursor-audit]] · [[devbible-corpus-audit-20260905]] ·
[[devbible-audit-workflow-findings-20260906]] · [[devbible-locks]] ·
[[devbible-feedback-memory-update-cadence]]

## 2026-09-06 · session `4e8d4393` · audit A2 first round + A3

⚠️ **Only the tanstack-query agent's report was received before the session wound down.**
babel, vite and playwright pages are stamped and committed, but their agents' reports never
arrived — **their provenance exists only in each page's own `> Verified:` line.** A later pass
should verify a sample of those claims before trusting the stamps.

| Track | Units stamped | Lines before → after | Report? |
|---|---:|---|---|
| tanstack-query | 4 (+ A3 page) | 117→248 · 133→286 · 112→238 · 133→294 · 136→175 | ✅ full |
| playwright | 6 | 132→189 · 139→213 · 114→171 · 128→199 · 127→209 · 114→194 | ❌ none |
| vite | 5 | 99→180 · 95→160 · 112→179 · 124→203 · 126→238 | ❌ none |
| babel | 4 | 95→215 · 103→257 · 91→238 · 103→153 | ❌ none |

**Gates, all four tracks:** mdxcheck **with raw-tag detection ON** 0 hazards · linkcheck 18
files per track, 0 problems · nothing over the 300-line cap · **no file shrank** (a validation
pass must never delete content).

### tanstack-query — the defects that were real

- 🔴 **S1, topic 02 — the page's stated failure mode was backwards.** It claimed a function in a
  `queryKey` "produces a DIFFERENT queryKey every time… causing a refetch on every render".
  `JSON.stringify` **drops** function-valued properties, so the key hashes as `['todos', {}]` —
  the real failure is a **silent collision**, not a refetch loop. Settled by *"As long as the
  query key is serializable using `JSON.stringify`…"*
- 🔴 **S1, topic 04 — two `setQueryData` updaters assumed the cache entry exists.**
  `(old) => old.map(…)` throws when it does not; the reference says *"If the query does not
  exist, it will be created."* Fixed to `old?.map(…)` and `(old = []) => […]`.
- 🔴 **S1, topic 04 — the optimistic-update example raced an in-flight refetch.** Added
  `await queryClient.cancelQueries({ queryKey })` before the first write.
- **S2, topic 03 — `keepPreviousData` taught as a v4-shaped option.** In v5 it is a *function*
  passed to `placeholderData`.
- **A3 (topic 09) — `prefetchQuery` → `queryClient.query()`**, confirmed deprecated verbatim.
  🔴 **The behavioural half matters more than the rename: `prefetchQuery` swallowed errors,
  `query()` resolves or throws** — so a straight rename in a Server Component turns a flaky
  backend into a failed page render. The docs' own example guards it with `.catch(noop)`.

### Written as explicitly uncertain rather than asserted
`select` re-run frequency · the inactive-query half of `invalidateQueries` ·
`refetchOn*` default values · why `cancelQueries` is needed. Details and the follow-up fetch:
[[research-tanstack-query-v5-quotes]].

### Found outside the lane, NOT fixed
- `docs/tanstack-query/README.md` still carries a `:::caution Imported corpus — not yet
  validated` box saying the track has no `> Verified:` lines, no tier badges and no Interview
  questions. **That is now false for topics 01–04 and partly false for 09.** Coordinator call.
- **Every topic directory in this track lacks a `README.md`**, so no page can carry the house
  `← Prev · Index · Next →` footer without shipping a 404. No footers were added and no
  `{/* FOOTER */}` markers were left. Structural gap for the authoring lane.
- babel `04-presets` is **stamped but has no `## Gotchas` / `## Interview questions`** — the
  agent was mid-write at wind-down. House-style gap, not a false stamp.

---

## Session `352cf446` — 2026-09-07 — A2 lane: tanstack-query → vite → webpack → babel

**Backlog measured at arrival** (`> Validated:` lines counted off disk, not inferred):
tanstack-query **4/17** · vite **6/17** · webpack **0/22** · babel **5/18** · redux-toolkit
**22/22 ✅ already complete** (2026-09-06 — reported to the user, not re-run). **58 units owed.**

✅ **A3 is already CLOSED on disk** and the audit row can be struck: `09-prefetching-and-ssr`
teaches `queryClient.query()` with the deprecation quoted, and `01-core-concepts` uses the v5
object form. The only `useQuery([` left in the track is a deliberate v4→v5 exercise inside an
interview question.

| Unit | Files | Lines | ★ | Defects |
|---|---:|---|---:|---|
| `docs/tanstack-query/pages/05-usemutation/` | 1 | 157→246 | 0→18 | **S1×2, S2×1** — commit `22004524` |
| `docs/tanstack-query/pages/09-prefetching-and-ssr/` | 1 | 175→273 | 0→13 | **S2×1** — commit after `22004524` |
| `docs/tanstack-query/pages/13-global-configuration/` | 1 | 117→210 | 0→15 | **S2×2** |
| `docs/tanstack-query/pages/12-query-cancellation/` | 1 | 138→231 | 0→15 | 🔴 **S1×2** |
| `docs/tanstack-query/pages/07-pagination-and-infinite-queries/` | **4** | 146→914 | 0→64 | **S1×2, S2×2** — agent-written, session-QCd — `8403f274` |
| `docs/tanstack-query/pages/06-background-refetching/` | **4** | 125→1075 | 0→67 | **S1×3, S2×1, S4×2** — agent-written, session-QCd |
| `docs/tanstack-query/pages/08-dependent-and-parallel-queries/` | **7** | 136→1758 | 0→76 | 🔴 **4 blocks recovered** — agent-written, session-QCd — `002156ef` |

### 05-usemutation — the defects that were real
- 🔴 **S1 — the `setQueryData` updater dereferenced `old` unguarded**, in the production example
  and in two of the three pitfalls. Same defect class as topic 04: the reference says *"If the
  query does not exist, it will be created"*, so the updater is handed `T | undefined`.
- 🔴 **S1 — the rollback read `context.previousPost` with no guard.** The typed third argument is
  `TOnMutateResult | undefined`; if `onMutate` throws before returning, the rollback throws
  **inside `onError`** — an unhandled exception replacing a handled failure path.
- **S2 — the callback signatures were the pre-rename shape.** The third positional parameter is
  `onMutateResult`; `context` is now a **fourth** parameter (`MutationFunctionContext`) carrying
  `context.client`. 🔴 **Checked on both the `/latest/` and the version-pinned `/v5/` doc paths**
  before acting — the `pins.js` note demands exactly that check after the `queryClient.query()`
  scare, and it is the pinned 5.102.8 shape, not unreleased v6.

### Gaps the page did not cover at all, now taught
Mutations **do not retry** while queries retry 3× · callbacks passed to `mutate()` *"won't run if
your component unmounts"* while the hook's do · `scope.id` runs same-scope mutations in serial
where the default is parallel · returning the promise from `onSettled` to keep `isPending` true
until the refetch settles · `mutateAsync` rejections are the caller's to catch.

### Still unsettled after this pass — do NOT assert
The relative **order** of the hook-level callback and the `mutate()`-level callback. Both fire;
which runs first is not stated on the guide. Banked in
[[research-tanstack-query-v5-quotes]].

### 09-prefetching-and-ssr — closing a page that said so itself
Its own `> Verified:` line carried the admission *"the rest of this page has not yet had a full
validation pass"* — the 2026-09-06 pass corrected the A3 API surface and stopped. Now closed.

- 🔴 **S2 — the scenario claimed hydration meant *"no redundant client-side fetch occurred"*.**
  That is false at the default `staleTime: 0`. Hydrated data arrives **stale**, and *"New instances
  of the query mount"* is one of the three documented refetch triggers, so the spinner disappears
  and the request does not. Advanced SSR says it outright: *"With SSR, we usually want to set some
  default staleTime above 0 to avoid refetching immediately on the client"*. 🔴 **This is the
  dangerous shape of defect in this corpus** — the page is not wrong about the API, it is wrong
  about the OUTCOME, so it passes an API-level review and still teaches a setup that half-works.
  Worth checking every other SSR/hydration page in the corpus for the same claim.
- Added: `HydrationBoundary` is a Client Component so the payload must survive JSON · `dehydrate`
  ships the **whole** cache, not just what renders · a key mismatch is a **silent cache miss**, not
  an error · prefetched entries have no observer and go on `gcTime` · the per-request `QueryClient`
  is a **data-leak boundary**, not a perf note.

**Position after these two: tanstack-query 6 / 17 validated.** Wave 1 (06, 07, 08) is with three
agents; the session QCs and commits what they return.

### 13-global-configuration — configuring what was already true
- **S2 — `mutations: { retry: 0 }` taught as a deliberate safety choice**, with the page saying it
  *"commonly defaults to 0"*. It **is** the library default (*"By default, TanStack Query will not
  retry a mutation on error"*), so the line changes nothing while reading like the guard-rail that
  prevents duplicate orders. The real decision is the opposite one: opting **in** per mutation.
- **S2 — pitfall 3 claimed runtime changes to `defaultOptions` are unsupported.** `setDefaultOptions`
  is documented; the actual trap is that it **replaces**: *"Previously defined default options will
  be overwritten"*, so a partial object silently drops every default it does not name.
- **Missing layer added:** `setQueryDefaults` / `setMutationDefaults`, with the registration-order
  rule quoted (*"from the most generic key to the least generic one"*) — silent when reversed.

### 12-query-cancellation — 🔴 the sharpest defects found in this track so far
Both were **reassurances**, which is why they survived four passes: the page explicitly told the
reader not to worry about the exact thing that bites.
- 🔴 **S1 — "the component UNMOUNTS" was listed as an automatic cancellation trigger.** The guide:
  *"queries that unmount or become unused before their promises are resolved are _not_ cancelled."*
  There is no unmount cancellation. *"If you consume the `AbortSignal`, the Promise will be
  cancelled … and therefore, also the Query must be cancelled"* — causation runs **up** from your
  `fetch`, not **down** from the library, which is why the fix is never in the options.
- 🔴 **S1 — a subsection titled "Why Ignoring `signal` Doesn't Cause Bugs"** asserted the library
  discards superseded results. The guide: *"after the promise has resolved, the resulting data will
  be available in the cache."* It is **written**. On a key that is stable across attempts (a
  refetch, a retry) a slow earlier response can land last and win — the out-of-order race the page
  claimed was impossible.

🔴 **Pattern worth carrying to the other tracks: the dangerous defect in this corpus is not a wrong
API name — it is a correct API with a wrong OUTCOME claim.** 09 (hydration "no redundant fetch"),
13 (a no-op presented as protection) and 12 (both) are all that shape. An API-level review passes
every one of them.

**Position: tanstack-query 8 / 17 validated** (01-05, 09, 12, 13). Agents hold 06, 07, 08.

### 07-pagination-and-infinite-queries — agent-written, session-QCd (4 files)
🔴 **The reversal was re-verified from the migration guide by the session before being accepted**,
because it inverts what the page taught. Confirmed: heading *"Returning `null` from
`getNextPageParam` or `getPreviousPageParam` now indicates that there is no further page
available"*, body *"In v4, you needed to explicitly return `undefined` … We've widened this check
to include `null`."*
- 🔴 **S1 — Pitfall 1 taught the v4 rule as v5**, asserting `null` leaves `hasNextPage` true. The
  real defect is the inverse: `nextCursor || null` coerces a legitimately falsy cursor (`0`, `''`)
  into a stop and ends the list **one page early**.
- 🔴 **S1 — Pitfall 3's example could not run under v5** (no `initialPageParam`, now required).
- **S2×2** — the prose and the ASCII diagram both asserted `undefined`-only. **S4** — no marks.

**Split arithmetic: 876 → 914 lines, 60 → 64 ★, both UP.** The agent returned `01b` at **exactly
300** — the documented tell for a page sized to the cap. Adding the house footer put it at 304, and
it was **split on the real concept boundary** (options you pass in ‖ what happens once it renders),
not trimmed. Agent's `01c` renamed `01d`; three inbound links repointed.

### 🔴 Tooling defect found by the agent — affects EVERY agent in this corpus
`/mnt/Storage/my-learning/claude/shared/scripts/mdxcheck.py` **scans zero files in this
environment** — `0 MDX hazard(s) in 0 file(s)` for an absolute topic path, a relative path,
explicit file arguments, and the whole `docs/` tree. It exits 0, so **any agent trusting its exit
code is getting a vacuous pass.** The repo's own `yarn mdxcheck` works correctly. Every dispatch
prompt must name `yarn mdxcheck`, never the shared script, until this is fixed.

### Bank corrections from this unit
- `.../reference/useInfiniteQuery` **does** resolve on the site, unlike `.../reference/useQuery`
  (recorded in the bank as `isNotFound`).
- `prefetchInfiniteQuery` / `fetchInfiniteQuery` are **absent** from the `QueryClient` reference;
  `queryClient.infiniteQuery` is the documented method. Extends the bank's structural finding.
- Prefetch defaults to ONE page: *"By default, only the first page gets prefetched. To prefetch
  multiple pages, use the `pages` option"* — for topic 09 if it is ever revisited.
- `placeholderData` vs `keepPreviousData`: *"placeholderData will always put you into `success`
  state, while keepPreviousData gave you the status of the previous query"* · `dataUpdatedAt`
  *"will stay at 0"* · *"the data is not persisted to the cache"* — for topics 02/03/14.

**Position: tanstack-query 12 / 20 pages validated** (the track grew from 17 to 20+ as topics split).

### 06-background-refetching — agent-written, session-QCd (4 files)
- 🔴 **S1 — `refetchOnReconnect (default: true)` stated flat.** TSDoc at the pin: *"Defaults to
  `true` unless `networkMode` is `'always'`."*
- 🔴 **S1 — `refetchInterval` said to poll "regardless of focus".** Each tick is gated on
  `refetchIntervalInBackground || focusManager.isFocused()`; Polling guide: *"By default, polling
  pauses when the browser tab loses focus."*
- 🔴 **S1 — "browser tab regains focus" given as the focus trigger.** The default listener is
  `visibilitychange`, testing `visibilityState !== 'hidden'` — **alt-tabbing to another application
  does not fire it**, which is the case people actually test by hand.
- **S2** — `staleTime: Infinity` taught as the lock for session-stable config; at this pin the
  documented answer is `staleTime: 'static'`. Original kept, variant added beside it.

## 🔴 METHOD THAT UNLOCKS EVERY REMAINING DEFAULT IN THIS TRACK — verify before reuse, then reuse
**`TanStack/query@main` reads `5.102.8` in `packages/query-core/package.json` — the exact pin.**
🔴 **The session re-verified this directly before accepting anything built on it**, because the
whole method rests on it. So the **TSDoc in the repo IS the pinned version's reference**, and it
prints defaults the rendered docs site omits.

⛔ **This SUPERSEDES the bank's standing warning** that Important Defaults *"NAMES these options
but does NOT print their default values"*, and its open question 3 (per-option defaults). Defaults
are now T0-quotable. Re-check that `main` still reads the pin before reusing the method — the day
it moves ahead of the pin, this becomes a v6 trap of exactly the shape `pins.js` warns about.

### Newly settled — closes bank open question 1
**Render Optimizations** https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations
> *"The `select` function will only re-run if: the `select` function itself changed referentially
> [or] `data` changed."* · *"If you use object rest destructuring, you will disable this
> optimization."*
**Topic 02 currently states `select` re-run frequency as explicitly uncertain — it can now be
asserted.** Worth a revisit pass on 02.

### Defaults now quotable (`packages/query-core/src/types.ts` @ `a1119e5a`)
`staleTime` **0** · `refetchInterval` **false** · `refetchIntervalInBackground` **false** ·
`refetchOnMount` / `refetchOnWindowFocus` **true** · `refetchOnReconnect` **true unless
`networkMode: 'always'`** · `structuralSharing` **true** · `enabled` **true** ·
`isLoading` = *"the same as `isFetching && isPending`"* · `isRefetching` = *"`isFetching &&
!isPending`"* · `gcTime` — *"When different garbage collection times are specified, the longest one
will be used."*

**`staleTime: 'static'` exists** and differs from `Infinity`: *"`queryClient.invalidateQueries()`
can invalidate a query with `staleTime: Infinity`, but has no effect on `staleTime: 'static'`."*

**Position: tanstack-query 16 / 24 pages validated.** Only unit 08 outstanding in wave 1.

### 08-dependent-and-parallel-queries — 🔴 THE CONTENT-LOSS INCIDENT
The agent hit the cap repeatedly and ran scripts that **deleted `★` blocks and wrote the file back
with no destination file**. Most removals were genuine split moves. **Four were not, and were gone
from the corpus entirely** — recovered verbatim from the scripts and restored:

1. *"An empty `queries` array is not a disabled query"* (`trim1b.py`) → restored to **01e**, where
   the gate falling back to `: []` belongs.
2. *"`placeholderData: (prev) => prev` in a chain shows the previous entity"* (`split1e.py`)
3. *"`placeholderData` is not written to the cache; `initialData` is"* (`split1e.py`)
4. *"`placeholderData` versus `initialData` — which one do you use…"* — an interview question
   (`split1e.py`) → 2-4 restored to the `placeholderData` chunk.

🔴 **HOW IT WAS CAUGHT, AND WHY NOTHING ELSE WOULD HAVE.** A **sibling agent** (unit 06) listed the
shared scratchpad in its own report and flagged that two files were named `trim`. **A trimmed file
passes the cap check, `mdxcheck` and `linkcheck`, and is indistinguishable from a split in a file
listing** — exactly the failure the global rule says has silently destroyed content four times.

**Countermeasures now proven and worth making standard:**
- **Make agents report their scratchpad contents.** That single line is what saved this.
- **Audit every script an agent leaves behind** for `replace(block, "")` / `write` with no
  destination, then prove each removed block exists somewhere else — a mid-block 12-word probe,
  not a first-line match (a first-line probe gave two false "FOUND"s here).
- ⛔ **Never trust a per-file `wc -l` as evidence of a split.** Only the topic's BEFORE/AFTER totals
  for both `wc -l` and `grep -c '^\*\*★'` mean anything.

**Split arithmetic after recovery:** restoring pushed `01f` to 316, split on the real boundary —
`initialData` (a cache write) stays `01f`, `placeholderData` (a render-time guess, never persisted)
becomes `01g`. **1721 → 1737 lines, 76 ★ preserved.** `01b` was at 297 and would have breached the
cap once footered, so the suspense-waterfall gotcha **moved** to `01d` (a serialised waterfall is a
composition cost) — relocation, not a trim; topic totals unchanged.

Recovery record: [RECOVERED-tanstack-08-lost-gotcha.md](RECOVERED-tanstack-08-lost-gotcha.md).

## Position — tanstack-query **23 / 28 pages, 11 / 16 topics**
🔴 **`yarn linkcheck docs/tanstack-query`: 30 files, 0 problems — first fully clean run.** Footers
now wired across the whole track via the shared `pages/README.md` (the redux-toolkit pattern); the
2026-09-06 note claiming per-topic READMEs were required was the wrong diagnosis.

**Remaining 5 topics:** 10 suspense (126) · 11 devtools (103) · 14 optimistic updates (148) ·
15 testing (148) · 16 migration recipes (157).

---

## 2026-09-08 · session `d0684ffb` — topic 10 suspense, and a board that was stale for the whole track

### ✅ `10-suspense-integration` — 1 page → 4 chunks, **126 → 1,085 lines, 0 → 51 ★**
Commit `4580953c`. Chunks: `01-suspense-driven-fetching` (274 L / 12 ★) ·
`01b-what-suspense-mode-removes` (283 / 12) · `01c-errors-boundaries-and-reset` (277 / 14) ·
`01d-fetch-on-render-and-streaming` (251 / 13). Cap clean, raw-tag mdxcheck clean,
`yarn linkcheck docs/tanstack-query` **33 files 0 problems**, `yarn validate --guard` clean.

**S1 — the page's central claim was wrong.** It taught that a query failure with no error boundary
crashes the app, full stop. The guide says *"Not all errors are thrown to the nearest Error Boundary
per default - we're only throwing errors if there is no other data to show."* The default is a
predicate — `throwOnError: (error, query) => typeof query.state.data === 'undefined'` — so a
cold-load failure reaches the boundary and a **background-refetch failure is silent**, on a page that
no longer has an `isError` flag to render a banner from. The old claim is true only for an empty
cache, which is why it survives local testing and surfaces in production.

**S4 — everything structural was missing:** no tier badge, no `> Verified:`, no `## Gotchas`, no
`## Interview questions`. All four chunks now carry them.

**New ground the single page never had:** `enabled` is unsupported (*"you therefore can't
conditionally enable / disable the Query"*) so the gate becomes a component split ·
`placeholderData` is unsupported, `startTransition` replaces it · `QueryErrorResetBoundary` /
`useQueryErrorResetBoundary` and why a bare `resetErrorBoundary()` does nothing (boundary reset ≠
query-error reset, so the remount re-throws) · the manual-throw pattern and why its `!isFetching`
guard is load-bearing · fetch-on-render vs render-as-you-fetch · `queryClient.query()` prefetching
and its mandatory `.catch` · the experimental `ReactQueryStreamedHydration` provider, incl.
`environmentManager.isServer()` as the current spelling.

🔴 **The Suspense guide was NOT in the research bank.** It is now —
[research_tanstack_query_v5_quotes.md](research_tanstack_query_v5_quotes.md), 3 fetches, marked do
not re-derive.

### ✅ Audit item **A3 is CLOSED** — it was already fixed on disk
Both files verified plus a track-wide sweep for `useQuery([`, `cacheTime`, `ensureQueryData`,
`isInitialLoading`, `keepPreviousData`. Every remaining hit is deliberate v4-was/deprecated
teaching. 🔴 **Do not re-open A3 on a grep hit.** Row struck in
[CURSOR-AUDIT.md](CURSOR-AUDIT.md).

### 🔴 THE FINDING WORTH CARRYING TO EVERY OTHER IMPORTED TRACK
**All 16 tanstack rows in `src/data/progress.js` still read `pages: 1, verified: 0`** from the
2026-08-14 import. Topics 06, 07 and 08 had been validated and split into 4, 4 and 7 chunks in
earlier waves and **none of it ever reached the board**; nine further validated topics still showed
`verified: 0`. Twelve rows corrected off disk, `page-counts.json` and `status.json` regenerated —
commit `ecc6d24f`.

⚠️ **A wave that commits pages but not the board leaves no trace anywhere except disk.** Measure
`pages`/`verified` per topic directory before trusting any imported track's row.

### ✅ The last four topics, same session — 🟢 the track is CONTENT-COMPLETE

| Topic | Before | After | Commit |
|---|---|---|---|
| 11 devtools | 103 L / 0 ★ | **6 chunks, 908 L, 89 ★** | `5683e48c` |
| 14 optimistic updates | 148 / 0 | **4 chunks, 718 L, 64 ★** | `3284d6c0` |
| 15 testing | 148 / 0 | **4 chunks, 920 L, 68 ★** | `7a290089` |
| 16 migration recipes | 157 / 0 | **4 chunks, 786 L, 49 ★** 🔴 incomplete | `3a06e0fa` |

**Track: 16 / 16 topics, 45 / 45 pages.** `yarn linkcheck docs/tanstack-query` → 47 files, 0
problems. Raw-tag `mdxcheck` clean. `yarn validate --guard` clean. Boards synced off disk.

### 🔴🔴 THE FINDING OF THE SESSION — six of eight agents died on the 600s watchdog

| Brief said | Agents | Outcome |
|---|---:|---|
| *"Write it ALL first, THEN split"* | 4 | **4 of 4 killed**, two having written nothing |
| *"write each chunk to disk before starting the next"* | 4 | 2 finished clean; 2 stalled only after 4 chunks each |

🔴 **The trap: `authoring-contract.md` Rule 1 genuinely says "Write it ALL first, then split" — but
that rule is about not sizing CONTENT to the 300-line cap, not about when bytes hit disk.** Quoting
it into an agent brief converts it into "research everything, write at the end", which is the
pattern that dies. This is the **second** rediscovery — the Next.js chapter forks hit it and the fix
was already recorded. Now its own memory: [DISPATCH-ANTI-STALL.md](DISPATCH-ANTI-STALL.md).

### 🔴 STILL OWED — topic 16 promises four chunks nobody wrote
`01f-v4-to-v5-mechanical-versus-semantic` · `01h-the-status-rename-and-the-isloading-trap` ·
`01n-prefetchquery-to-queryclient-query` · `01e-running-both-caches-at-once`. De-linked to bold
*(not written yet)* so the build stays green; **re-link each as it lands.** The research bank
already carries everything they need — no fetching.

### Defects and traps found at QC
- 🔴 **A `{/* FOOTER */}` marker can sit AFTER a real, correct footer.** Topic 15 had four; the cap,
  MDX and link checks all passed them. Only the dedicated grep catches it.
- 🔴 **`https://tanstack.com/query/latest/docs/reference/QueryClient` now returns
  `{"isNotFound":true}`** on both `/latest/` and `/v5/` — it worked on 2026-09-06. Do not spend a
  fetch on it; the bank's quotes from it stand.
- ⚠️ **`@tanstack/react-query-devtools` has no pin in `src/data/pins.js`** though topic 11 now
  teaches it across 6 pages. Found, not fixed.
- ⚠️ **`yarn validate --queue --scope docs/<track>` does not filter to that track.** Use
  `--scope imported` or measure off disk.

## Position — tanstack-query **45 / 45 pages, 16 / 16 topics** 🟢
🔴 **45/45 is a PAGE count, not a completeness claim** — topic 16 is content-incomplete (above).
**Next on the A2 lane:** `yarn validate --queue --scope imported` now reports **70 units pending**
(was 71). It ranks **eslint-oxlint 02–21** next, all 1-page units at risk 85 — same shape as unit 01,
so work them from the banked research rather than re-fetching. Then ORM → CI/CD (both rule-5:
syllabus + card, then STOP AND ASK) → webpack (0/22) → babel (5/18).
