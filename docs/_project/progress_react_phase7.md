---
name: devbible-react-phase7
description: React resume point — Phases 0–11 COMPLETE and merged (Part A finished 2026-08-14); only Phase 14 remains, owned by Part B — see devbible-react-split-parts-ab
metadata:
  type: project
---

:::danger CONSOLIDATED 2026-08-15 — THE WORKTREE IN THIS FILE NO LONGER EXISTS
Every devbible worktree and branch was **merged into `main` and DELETED** on 2026-08-15
(*"commit every uncommitted branch to main and delete everything"*). **All the content
described below is on `main`** at `/run/media/sairam/Storage/Backup/Knowledge/devbible`
— nothing was lost, every branch was verified at 0 unique commits first. Ignore any
"worktree", "branch", "not merged" or "merge at the phase close" instruction below and
**work on `main`**. `main` builds 0 warnings / 0 broken links, so a break there is yours.
Full record: `progress_worktree_consolidation_20260815.md`.
:::

# 🔴 REACT — START HERE. Resume automatically, do not ask.

**Session `33f8be33`, 2026-08-14.** Took the claim over from `2ee7a9a3` (itself from
`63fa2a80`) when the user said *"please look into react js"* — a live instruction naming
React, which supersedes the JavaScript-only standing order in `~/.claude/CLAUDE.md`
rule 11 for this session, the same way that order superseded the React and Express ones.
⚠️ **Rule 11's React paragraph is stale** — it still says "Phase 7 is 2 of 12". Phases 7,
8 and 9 are complete. Everything below is committed on the branch named here.

> **Keep this file's name stable** even though Phase 7 is done — `~/.claude/CLAUDE.md`
> rule 11 points at it by name. Repoint its *contents* as phases close.

## Pick up here, in this order

1. **`cd /mnt/Storage/Backup/Knowledge/devbible-react`** — the work is in a
   **worktree**, branch **`react-phase-7`**, *not* in the main checkout. React Phases 7+
   will look missing on `main`; they are not lost, they are on that branch.
   `git worktree list` from either directory shows both.
2. 🔴 **The remaining React work is SPLIT ACROSS TWO SESSIONS.** Read
   **[[devbible-react-split-parts-ab]] first** — it defines Part A and Part B, who owns
   which files, and the three shared board files.
   - **Part A — Phase 11 ✅ COMPLETE (17/17), 2026-08-14, session `bfcb390b`.** Merged into
     `main` at `a583dae2`; nothing is queued and nothing is stranded. **24 leaf pages, 5,495
     lines, 0 over 300**, close build **exit 0 with 0 warnings in `phase-11-ssr-hydration`**.
     Five topics are chunked (08, 09, 10, 11, 13); the other twelve are single files running
     **171–242**. Detail, and the five claims the pages deliberately do not make:
     [[devbible-react-part-a-phase11]].
   - **Part B — Phase 14 · Testing React**, 14 topics, syllabus **approved**, nothing
     written and not yet scaffolded. Syllabus: `docs/react/syllabus/04-building-an-app.md`.
   🔴 **All React work is on `main`, NOT in a worktree** — deliberately, so it cannot drift
   unmerged the way `react-phase-7` did for 45 commits. Stage explicit paths.
   **Already fetched for Phase 11 — do not re-fetch:** `hydrateRoot` · all three renderers
   (`renderToPipeableStream`, `renderToReadableStream`, `renderToString`) · `prerender`
   (the `prelude`/`postponed` return, and that it **waits for all data**) · `resume`
   (signature, `postponedState`, all four caveats) · `<link>` (hoisting, `precedence`,
   dedup by `href`, suspends while loading, both caveats) · `flushSync` (all four caveats
   and the Pitfall) · `<meta>` (hoisting, the `itemProp` exception) · `<script>`
   (`async={true}` required, dedup by `src`, both caveats) · `<Suspense>`'s server sections.
   ✅ **Nothing is left to fetch for Phase 11** — the phase is complete. Everything above,
   plus `prerenderToNodeStream`, the whole preload family (`preload`, `preinit`, `preconnect`,
   `prefetchDNS`, `preloadModule`, `preinitModule`), `createRoot`/`hydrateRoot` error options,
   `renderToStaticMarkup`, `<style>` and `createPortal`, is fetched and its findings recorded
   verbatim in [[devbible-react-part-a-phase11]].
   ⚠️ **Two NEGATIVE findings, both RE-CONFIRMED 2026-08-14 — do not "fix" them by adding
   claims:** react.dev does **not** document selective hydration's scheduling policy (topic 07
   says so explicitly), and **`createPortal`'s reference says nothing about SSR at all** — so
   topic 17 reasons from the documented parameter contract (*"the node must already exist"* +
   no DOM on the server) and states at each step which part is inference.

3. 🔴 **Phases 12 and 13 are DELETED, and Phase 14 was narrowed to testing.**
   Three instructions on 2026-08-14, in sequence: *"Drop following tasks Phase 13, 12,"* →
   *"drop those from syllabus … if any of them already written let it but we abandoning
   those"* → *"If nothing is written simply delete"*. Nothing of either phase existed, so
   they were **removed outright** (commit `a49793b`), not marked descoped.
   Then: *"Phase 14 i need little more overview i think i just need testing with RTL and
   jest API mocking events like that kind rather than all"* — Part 4 is now **"Testing
   React"** and Phase 14 is **14 topics**, not 18:
   - **Master (6):** what to test and what not to · RTL's model · the query families
     (`getBy`/`queryBy`/`findBy` + the priority order) · `user-event` over `fireEvent` ·
     async testing and what `act()` really means · mocking the API with MSW.
   - **Understand (5):** Jest or Vitest · testing forms and Actions · testing hooks ·
     wrappers for context/providers/router · roles as the query surface.
   - **Know (3):** snapshots · testing Server Components · flaky tests, fake timers, CI.
   Cut as out of scope: error boundaries (Phase 8 already has them), accessibility as its
   own subject, security, Vite/dev loop, deployment, upgrade codemods, `captureOwnerStack`,
   E2E.
   ⚠️ **Phase 14 is a syllabus change only — no pages written, and it was put to the user
   for sign-off before any are.** Do not start writing it without that.
   **Remaining React scope: Phases 0–11 and 14 · 210 topics** (was 244).
   Phase 14 keeps the number **14** deliberately — written pages in Phase 0 already
   reference it, and renumbering would break them for cosmetic gain.
4. ✅ **Phase 14's syllabus is APPROVED** — the user signed it off on 2026-08-14
   (*"yes phase 14 approved"*) after reviewing it in a published artifact. Write it as
   listed in item 3 above; no further sign-off needed.
5. ✅ **DONE — `react-phase-7` was merged into `main`** (`d74e74f`). See the merged section
   below. This retires the standing "the branch is
   unmerged" warning below. `main` is a **shared checkout** with other sessions writing to
   it — merge carefully, stage nothing outside `docs/react/`, `src/data/progress.js`'s
   React rows and `docs/README.md`'s React rows, and expect the JavaScript/TypeScript/
   Express rows to have moved on `main`.

## State as of this stop

| | |
|---|---|
| Phases 0–6 | ✅ complete, 129 leaf files (unchanged) |
| **Phase 7** | ✅ **COMPLETE — 12 topics, 25 leaf pages, 7,084 lines, 0 over 300** |
| **Phase 8** | ✅ **COMPLETE — 18 topics, 20 leaf pages, 4,827 lines, 0 over 300.** Two chunked topics: `01-usetransition/` (496) and `02-suspense/` (511); the other 16 are single files |
| **Phase 9** | ✅ **COMPLETE — 14 topics, 15 leaf pages, 3,411 lines, 0 over 300.** One chunked topic: `01-controlled-inputs/` (554); the other 13 are single files |
| **Phase 10** | ✅ **COMPLETE — 19 topics, 21 leaf pages, 4,780 lines, 0 over 300.** Two chunked topics: `01-what-a-server-component-is/` (462) and `06-server-function-security/` (573). The other 17 are single files running **156–282** lines — a genuine spread, not a cluster under the cap |
| **Phase 11** | ✅ **COMPLETE — 17 topics, 24 leaf pages, 5,495 lines, 0 over 300.** Five chunked topics (08 Prerendering 721 · 09 Partial pre-rendering 738 · 10 Document metadata 520 · 11 Resource preloading 523 · 13 Root error options 476); the other twelve are single files running **171–242**. → **Part A, done** |
| **Phase 14** | ⬜ **NOT STARTED — 14 topics, syllabus APPROVED**, not scaffolded. → **Part B**. **12 and 13 are deleted, not pending** |
| **React overall** | **12 of 13 phases done.** ⚠️ **React is NOT finished — only Phase 14 remains**, and it belongs to **Part B** (session `05921047`). Phases 12 and 13 are deleted, not pending |
| React total | **217 leaf pages** (excluding every `README.md`) |
| UI | all four places current — `progress.js` phase 7 `pages: 12`, 8 `pages: 18`, 9 `pages: 14` (each with **`pagesPlanned` dropped**, which is what marks a phase complete), **phase 10 `pages: 19` with `pagesPlanned` DROPPED**; phase READMEs; `docs/react/pages/README.md` rows + claim box; `docs/README.md` claims + technology rows |
| Claim | session `33f8be33` in `docs/README.md` **and** `docs/react/pages/README.md` |
| Commits (newest first) | On **`main`**: `add46a3` P11 t07 · `6227f33` P11 t05–06 · `24b3ee4` P11 t03–04 · `f6b076b` P11 scaffold + t01–02 · **`d74e74f`** the merge of `react-phase-7` (which carried all of P7–P10) |
| **Build** | ✅ **RUN and CLEAN after the Phase 10 close, 2026-08-14.** `rm -rf .docusaurus build node_modules/.cache && yarn build --out-dir build-react-p10` → `[SUCCESS]`. Warning/broken tally by language: **typescript 7, react 0**. `grep -iE 'warning\|broken' build.log \| grep -i react` → exit 1. The 7 TypeScript warnings are another session's and were left alone |

## ✅ MERGED — the worktree warning is retired

**`react-phase-7` was merged into `main` on 2026-08-14 as merge commit `d74e74f`**, on the
user's instruction. Phases 7, 8, 9 and 10 are now on `main`; nothing React is stranded on a
branch any more. This closes the failure mode rule 11 warns about (the JS phase-3 worktree
abandoned pre-merge).

**The worktree `/mnt/Storage/Backup/Knowledge/devbible-react` still exists** and its branch
still points at `5512c7f`. Either keep working there and merge again at the next phase close,
or work Phase 11 directly on `main`. ⚠️ If you keep the worktree, **merge every phase** —
do not let it drift 45 commits again.

### How the merge conflicts were resolved — reuse this

Only two files conflicted, both shared-checkout boards, and `main` had advanced **88
commits** from the JavaScript, Git and Express sessions:

- **`src/data/progress.js`** — the conflict hunk was **entirely JavaScript's rows**, where
  the branch held stale copies from the branch point. Took **main's side wholesale**. Then
  one more JavaScript row (phase 8) had **auto-merged to the branch's older value** without
  conflicting — caught only by diffing each language block against `main` afterwards.
  🔴 **Always verify: every non-React language block byte-identical to `main`, only React's
  changed.** A one-line python check does it and it caught a real regression.
- **`docs/README.md`** — kept **main's** Git and Express rows, took **the branch's** React
  row. Verified with `diff <(git show HEAD:docs/README.md | grep '^| \*\*\[') <(...)` →
  only the React line differs.

Nothing outside `docs/react/`, `docs/README.md` and `src/data/progress.js` was staged; the
other sessions' uncommitted working-tree changes (`.claude/settings.local.json`,
`graphify-out/*`) were left untouched.

**Post-merge build on `main`: `[SUCCESS]`**, warning tally by language **git 4, typescript 3,
react 0**. Both are other sessions'.

## Build facts learned the hard way

- 🔴 **The worktree had no `node_modules`** — which is why no build had ever run on this
  branch. `yarn install` inside the worktree is safe (it is gitignored and isolated from
  the shared checkout); **revert `.yarn/install-state.gz` afterwards**, it is tracked.
- 🔴 **MDX trap that cost a build failure:** an inline code span that **wraps a line
  inside a blockquote and contains `{`** is parsed as a JSX expression —
  *"Unexpected lazy line in expression in container"*. Keep such code on one line or move
  it to a fenced block. Hit in `08-hooks-that-wrap-effects/01`.
- **4 build warnings remain and are NOT mine:** `docs/typescript/pages/phase-2-narrowing`
  (`./08-as-assertions.md`, `./12-unknown-in-catch.md`, `./README.md`). Another session
  owns TypeScript. Left untouched, deliberately.
- `rm -rf .docusaurus` alone is not enough; `node_modules/.cache` holds stale routes too.
- 🔴 **Backticks inside `git commit -m "…"` are command-substituted by bash** and silently
  delete the word. Always `git commit -F -` with a **quoted** heredoc (`<<'EOF'`).
- Editing a markdown table's status cell can drop a column and render broken; verify with
  `awk -F'|' '/^\|/ {print NF-2}'`.
- ✅ **NO SANDBOXING, verified 2026-08-14.** Rule 8 has been held for the whole of Phase 10.
  `git diff --name-only 373eb2f..HEAD` returns **only** `.md`, `_category_.json` and
  `src/data/progress.js` — no scripts, no harness, nothing under `sandbox/`. The existing
  `sandbox/react-p0` and `react-p1` trees (Phases 0–1, from an earlier session) were **not
  touched**. Every Phase 10 page carries "No sandbox script backs this page; claims are
  cited, not measured."
- 🔴 **`src/data/progress.js` edits MUST be anchored on the row's `slug`, never on the
  numeric fields.** `topics: 19, pages: N, pagesPlanned: 19` is **not unique** — JavaScript's
  phase 9 (The DOM) carries the same `topics`/`pagesPlanned` pair and sits earlier in the
  file, so a first-match string replace silently edits **another language's row**. This
  happened three times (commits `4d3c6d6`, `c1bab07`, `6cec70f`): React phase 10 stayed at
  `pages: 6` while claiming 8/10/12, and JavaScript phase 9 was walked 6 → 12. Repaired in
  **`8643eb0`** — React set to 12, JavaScript restored to 6 (which is what `main` has, so
  the merge is a no-op for that row). Caught only by re-reading the file, not by any check.
  **The other three UI places were fine** — they were anchored on unique strings.
- 🔴 **Mid-phase forward links produce warnings that LOOK like the rule-1 slug bug and are
  not.** A `.md` link resolves **file-relative** and is correct — but when the target file
  **does not exist yet**, Docusaurus falls back to URL resolution, and from a `README.md`
  index page `../X.md` then resolves **one level too high** (`pages/X.md` instead of
  `phase-N/X.md`). Verified 2026-08-14: Phase 8's forward links to unwritten topics
  06/08/09/10/11 warned exactly this way while **Phase 7 stayed clean in the same build**.
  **Do not "fix" these by changing the link form** — write the missing file and they
  resolve. Confirm with `... | grep -iE 'warning|broken' | grep -i 'phase-7'` → exit 1.

## Chunking rules confirmed by this phase

**Six of twelve topics became directories. Nothing was trimmed to fit the cap** — write
the explanation the topic deserves, then split on a concept boundary.

| Topic | Chunks | Lines |
|---|---|---|
| 03 share logic not state | 4 | 1,055 |
| 04 rules of React beyond hooks | 4 | 1,147 |
| 05 why the rules exist | 2 | 555 |
| 06 designing a hook's API | 2 | 575 |
| 07 the standard set (ten hooks) | 5 | 1,337 |
| 08 hooks that wrap effects | 2 | 551 |

01, 02, 09, 10, 11, 12 fit one file each **without compression** (295 / 234 / 298 / 246 /
270 / 196).

🔴 **Phase 10 chunking so far:** topic 01 (462, split definition / limits) and topic 06
(573, split "everything is an endpoint" / "what the framework does"). Topics 02–05 each fit
one file at 249–255 **without compression** — that band is genuine here because the four
share one source and one shape, not because anything was budgeted.

🔴 **The routine, every time a topic chunks:** from `docs/react/pages`, run
`grep -rn "NN-topic-name.md" --include=*.md .` **before** creating the directory, then
repoint every hit to `NN-topic-name/README.md` — **bodies as well as footers**. Missing a
body link is the one that gets shipped.

## Where the phase content is recorded

The load-bearing claims, their sources, and the findings worth not re-deriving are in
**[[devbible-react-concepts-phase7]]**, **[[devbible-react-concepts-phase8]]** and
**[[devbible-react-concepts-phase9]]** — read those instead of re-reading 60 pages.

## Sources already fetched for React — do not re-fetch

react.dev: Rules of React · Rules of Hooks · Components and Hooks must be pure · React
calls Components and Hooks · Reusing Logic with Custom Hooks · State: A Component's Memory
· Sharing State Between Components · Passing Data Deeply with Context · You Might Not Need
an Effect · Preserving and Resetting State · Removing Effect Dependencies · `useRef` ·
`useSyncExternalStore` · `useEffectEvent` · `use` · `act` · ref callbacks · `createPortal`
· Invalid hook call warning.
MDN: `Window: storage` event · `matchMedia` · `IntersectionObserver`.
Testing Library: `renderHook`.

**Phase 9, already fetched:** `<input>` / `<select>` / `<textarea>` (differences from
HTML + full Caveats), MDN `input type=file` (**value cannot be set from script**), and
`<form>` — the action prop in both forms, the **four things React does with a function
action** (calls it with FormData · runs it in a Transition · tracks pending · **resets all
uncontrolled fields after it SUCCEEDS**), the caveat that a function action is **POST
regardless of `method`**, `formAction` overriding on buttons, and progressive enhancement
requiring **a Server Component rendering the form AND a Server Function as the action**.

**Phase 8, already fetched:** `useTransition` and `startTransition` — definition,
parameters, returns and **both full Caveats lists**. Key claims now on the page: the
action *"is called immediately"* and only updates scheduled **synchronously** during it
are marked (a `setTimeout` or post-`await` update silently stays urgent); updates after an
`await` need **a second `startTransition`** (a documented known limitation); a transition
*"will be interrupted by other state updates"* and React **restarts** the work; *"Transition
updates can't be used to control text inputs"*; `startTransition` **has a stable identity**;
multiple transitions are **currently batched together**; and the decision rule — *"You can
wrap an update into a Transition only if you have access to the `set` function … otherwise
try `useDeferredValue`."*

**Phase 8, also fetched:** `<Suspense>` — definition, props, **full Caveats list** and
the four usage sections. Load-bearing: *"Suspense does not detect when data is fetched
inside an Effect or event handler"*; the activating sources are `lazy`, `use`, stylesheets
with `precedence`, fonts/images; *"a Suspense-enabled framework maintains a cache of
Promises and calls `use`"*; the whole tree inside a boundary is **one unit**; the closest
parent boundary shows the fallback; **reveals throttled to at most once every 300 ms**;
a fallback that suspends **activates the parent boundary**; **no state preserved for a
render suspended before first mount — retried from scratch**; 🔴 *"the `fallback` will be
shown again **unless** the update … was caused by `startTransition` or
`useDeferredValue`"*; layout effects cleaned up while content is hidden and fired again;
Streaming SSR and Selective Hydration are integrated with it. ⚠️ The **`defer` prop is
experimental**. Also has the documented stale-content pattern including the
`query !== deferredQuery` opacity indicator.

**Phase 8, also fetched:** `lazy` — *"React will not call `load` until the first time you
attempt to render"*, **both the promise and its resolved value are cached so `load` is
never called more than once**, the resolved value's **`.default`** is rendered, a
rejection is **thrown for the nearest Error Boundary**, and 🔴 *"Do not declare `lazy`
components inside other components … this will cause all state to be reset on re-renders."*

**Phase 8, also fetched:** `preload` — signature/options (`as` required; **`crossOrigin`
required when `as` is `"fetch"`**), *"Multiple equivalent calls … have the same effect as
a single call"*, callable anywhere in the browser but on the server **only during
component rendering**, and the sibling gradient `prefetchDNS` → `preconnect` → `preload`
→ `preinit` (+ the Module variants). And the **React v18.0 release post** — *"Concurrency
is not a feature, per se … an implementation detail"*, *"rendering is interruptible"*,
*"React may start rendering an update, pause in the middle, then continue later. It may
even abandon an in-progress render altogether."*, the consistency guarantee (*"it waits to
perform DOM mutations until the end"*), and **reusable state**.

**Phase 8, also fetched:** `useDeferredValue` — full Caveats plus the debouncing section.
Load-bearing: **no fixed delay, it adapts to the device**; the background re-render is
**interruptible and restarted from scratch**; *"debouncing and throttling still produce a
janky experience because they're **blocking** — they merely postpone the moment when
rendering blocks the keystroke"*; **"does not by itself prevent extra network requests"**
so the two compose; `initialValue` exists because there is no previous value on mount;
a freshly-created object differs by `Object.is` every render and spawns a background
render every time; inside a Transition it returns the new value and spawns nothing;
background re-renders **do not fire Effects until committed**.
And `useTransition`'s **Actions** sections: *"Functions called in `startTransition` are
called 'Actions'"*; `isPending` is true *"at the first call … until all Actions complete
and the final state is shown"*; the **`action` prop convention** (await it so callers may
pass sync or async); errors go to an **error boundary around the component calling
`useTransition`**; and the troubleshooting entry — updates after `await` are not marked,
must be re-wrapped after **each** await, *"a JavaScript limitation due to React losing the
scope of the async context … when AsyncContext is available, this limitation will be
removed."*

**Phase 10, already fetched (2026-08-14) — all four RSC reference pages:**
- **Server Components** — the definition (*"renders ahead of time, before bundling, in an
  environment separate from your client app or SSR server"*), *"This separate environment
  is the 'server' in React Server Components"*, both modes (**build time on CI, no web
  server required** / per request), the **75K gzipped** markdown example and the "second
  request" cost, *"The client will only see the rendered output"*, *"letting you access
  your data layer without having to build an API"*, the MPA+SPA architecture sentence,
  🔴 *"Server Components are not sent to the browser, so they cannot use interactive APIs
  like `useState`"*, 🔴 *"there is no directive for Server Components. The `'use server'`
  directive is used for Server Functions"*, *"Async Components … allow you to `await` in
  render"*, and the **stability note** (stable in 19 for apps; bundler/framework APIs
  **do not follow semver** in 19.x — pin an exact version or use Canary).
- **`'use client'`** — all six caveats, including 🔴 *"A component usage is considered a
  Client Component if it is defined in module with `'use client'` directive or when it is
  a transitive dependency of a module that contains a `'use client'` directive.
  **Otherwise, it is a Server Component**"* (this is the "Server Components are the
  default" claim, verbatim), *"introduces a server-client boundary in the module
  dependency tree"*, *"All code that is a part of the Client module sub-tree is sent to
  and run by the client"*, and the **full serializable-props list** (primitives incl.
  bigint and `Symbol.for` symbols · String/Array/Map/Set/TypedArray/ArrayBuffer · Date ·
  plain objects · **Server Functions** · JSX elements · Promises) and the non-serializable
  list (non-Server-Function functions · classes · class instances · null-prototype objects
  · non-global symbols).
- **`'use server'`** — definition, all caveats (must be first, single/double quotes not
  backticks · server-side files only · module-level to import from client code · async
  only · 🔴 *"Always treat arguments to Server Functions as untrusted input and authorize
  any mutations"* · should be called in a Transition, and `<form action>`/`formAction` do
  that automatically · **designed for mutations, not data fetching** — frameworks process
  one action at a time and do not cache the return value), the two Security Considerations
  sections, and the **argument** serialization list — which differs from props: it
  **adds `FormData`** and **excludes React elements / JSX** and **events from event
  handlers**.
- **Server Functions** — *"allow Client Components to call async functions executed on the
  server"*, the naming note (**"Server Actions" until September 2024**; a Server Function
  is a Server Action only when passed to an `action` prop or called inside an action), both
  creation forms, *"your framework will automatically create a reference … and pass that
  reference to the Client Component"*, form auto-reset, calling from `useTransition`,
  `useActionState` **replaying form submissions entered before hydration finishes**, the
  `permalink` redirect for pre-JS submits, and the same semver caveat.
- **The Dec 2025 advisories** (search only so far, blog posts NOT yet fetched):
  **CVE-2025-55182**, CVSS **10.0**, unauthenticated RCE in `react-server-dom-webpack` /
  `-parcel` / `-turbopack` **19.0, 19.1.0, 19.1.1, 19.2.0**, fixed in **19.0.1 / 19.1.2 /
  19.2.1**; cause: `requireModule` did not validate that the requested export name was a
  direct prop of the module, so `constructor` reached the global `Function`. Follow-ups:
  DoS **CVE-2025-55184** and **CVE-2025-67779** (CVSS 7.5) and source-code exposure
  **CVE-2025-55183** (CVSS 5.3). Not affected if the app uses no server, or no
  RSC-supporting framework/bundler. ⚠️ **Fetch the two react.dev blog posts before
  writing topic 12** — 2025/12/03 and 2025/12/11.

**Phase 10, also fetched — the `'use client'` USAGE sections** (separate from the reference
caveats above, and the source of topic 03):
- 🔴 **The exact list of React APIs that force a component onto the client:**
  *"Third-party components that use any of the following React APIs must run on the client:
  `createContext`, `react` and `react-dom` Hooks (excluding `use` and `useId`),
  `forwardRef`, `memo`, `startTransition`, and if they use client APIs."*
  **`memo` and `forwardRef` are on the list** (neither implies interactivity);
  **`use` and `useId` are the only hook exceptions**.
- 🔴 **Agnostic components:** with no directive, a component's *"**output** (rather than its
  source code)"* is sent to the browser when referenced from a Server Component. So adding
  `'use client'` "for safety" converts free output into shipped JS.
- The documented container shape — `CounterContainer` *"does not require `'use client'` as
  it is not interactive"* and *"must be a Server Component as it reads from the local file
  system"*, passing a serializable prop to the interactive leaf.
- **Third-party libraries:** updated packages *"will already include `'use client'` markers
  of their own"*; you need your own wrapper file *"if a library hasn't been updated, **or if
  a component needs props like event handlers that can only be specified on the client**"* —
  the second reason catches modern libraries too.

🔴 **Phase 10 — a NEGATIVE finding worth not re-deriving:** react.dev's `'use server'`
**Security considerations section is only three sentences** — treat arguments as untrusted
input and validate/escape them; validate that the logged-in user is allowed to perform the
action; and a WIP box pointing at the two experimental taint APIs. **It says nothing about
closures, captured variables, encryption or `bind`.** Do not attribute the encrypted-closure
material to react.dev.

**Phase 10, fetched instead for topic 06 — Next.js `app/guides/data-security`** (v16.3.1,
page lastUpdated 2026-08-10). This is **framework-level**, and must be cited as Next.js,
not React:
- 🔴 *"By default, when a Server Action is created and exported, it is reachable via a direct
  POST request, not just through your application's UI. This means, even if a Server Action
  or utility function is not imported elsewhere in your code, it can still be called
  externally."*
- **Secure action IDs** — *"encrypted, non-deterministic IDs"*, recalculated between builds,
  **cached for a maximum of 14 days**; and **dead code elimination** removes unused Server
  Actions so they get no public endpoint. Both are explicitly *"not"* a substitute:
  *"you should still treat Server Actions as reachable via direct POST requests and verify
  authentication and authorization inside each one."*
- 🔴 **Closures:** *"the captured variables are sent to the client and back to the server
  when the action is invoked. To prevent sensitive data from being exposed to the client,
  Next.js automatically encrypts the closed-over variables. A new private key is generated
  for each action every time a Next.js application is built."* Plus the caveat
  *"We don't recommend relying on encryption alone."* Self-hosted multi-server needs
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (base64, 16/24/32 bytes; 32 by default).
- **CSRF:** Server Actions are POST-only, and Next.js compares the **Origin** header to
  **Host** / `X-Forwarded-Host`, aborting on mismatch; `serverActions.allowedOrigins` for
  reverse proxies.
- *"A page-level authentication check does not extend to the Server Actions defined within
  it. Always re-verify inside the action"* — plus authorization vs authentication (IDOR),
  controlling return values, rate limiting, the Data Access Layer / DTO pattern, `server-only`,
  and the audit checklist for `"use server"` files.

**Phase 10, fetched for topic 12 — both react.dev advisory blog posts, in full:**
- **3 Dec 2025, CVE-2025-55182, CVSS 10.0.** *"An unauthenticated attacker could craft a
  malicious HTTP request to any Server Function endpoint that, when deserialized by React,
  achieves remote code execution on the server."* Affected `react-server-dom-webpack` /
  `-parcel` / `-turbopack` **19.0, 19.1.0, 19.1.1, 19.2.0**; fixed **19.0.1, 19.1.2,
  19.2.1**. 🔴 *"Even if your app does not implement any React Server Function endpoints it
  may still be vulnerable if your app supports React Server Components."* Named frameworks:
  `next`, `react-router`, `waku`, `@parcel/rsc`, `@vitejs/plugin-rsc`, `rwsdk`. Not affected
  if the app's React code does not use a server, or no RSC-supporting toolchain. Timeline:
  reported 29 Nov by Lachlan Davidson via Meta Bug Bounty → confirmed 30 Nov → fix 1 Dec →
  published and disclosed 3 Dec.
- **11 Dec 2025.** DoS **CVE-2025-55184, CVE-2025-67779, CVE-2026-23864** (CVSS 7.5) —
  *"can cause an infinite loop that hangs the server process and consumes CPU"*, later
  broadened to *"server crashes, out-of-memory exceptions or excessive CPU usage"*. Source
  code exposure **CVE-2025-55183** (CVSS 5.3) — *"may unsafely return the source code of any
  Server Function"*, requiring a function that *"explicitly or implicitly exposes a
  stringified argument"*; **hardcoded literals leak, and *"runtime secrets such as
  `process.env.SECRET` are not affected"***. Affected 19.0.0–19.2.3 of the same three
  packages; **fixed 19.0.4, 19.1.5, 19.2.4**. 🔴 *"If you updated to 19.0.3, 19.1.4, and
  19.2.3, these are incomplete, and you will need to update again."*
- ⚠️ **NEGATIVE finding:** neither blog post describes the underlying code defect, and
  **GHSA-fv66-9v8q-g76r carries only the CVSS vector and version ranges** — no root cause.
  A `requireModule` / `constructor` / `Function` explanation circulates in search summaries
  and third-party writeups; it is **not** in any primary source. Topic 12 says so explicitly
  and does not reconstruct it. Do not add it later without a real citation.

**Still to fetch for Phase 10 (topics 13–19):** the Flight/RSC payload wire format for 13,
`react-server-dom-*` packages and the `react-server` export condition for 14, `cache` and
`cacheSignal` for 15, Next.js App Router vs React Router 7/8 for 16, RSC-without-a-framework
for 18, and `experimental_taintObjectReference` / `experimental_taintUniqueValue` for 19.
Topic 17 (when RSC is the wrong choice) is judgement built on what is already recorded.

**Still to fetch for Phase 8:** `Activity`,
`cache`/`cacheSignal`, error boundaries, and the React 19 / 19.2 release notes.

Related: [[devbible-react-concepts-phase7]] · [[devbible-react-syllabus]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-react-only-worktree-20260814]]
