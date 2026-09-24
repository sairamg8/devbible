---
name: devbible-react-phase0
description: Live progress for React Phase 0 pages — updated after every page and at phase end; carries the sandbox harness facts and the measured dataset
metadata:
  type: project
---

**Updated after every completed page, and again when the phase closes** — the user
asked for that cadence explicitly on 2026-08-13 ("update your memory every time you
complete file? and after phase?"). If this file's page table and
`src/data/progress.js` disagree, this file is the one that was updated last.

Syllabus: [[devbible-react-syllabus]]. Phase 0 is **"How React runs", 17 topics → 14
pages** in `docs/react/pages/phase-0-how-react-runs/`.

## Status

**Phase 0: COMPLETE — 14 pages + phase README + pages README.** All 17 syllabus topics
covered. Line counts 148–252, all inside the 300 cap. `src/data/progress.js` bumped to
`pages: 14`.

**Next:** React Phase 1 (JSX and what a component returns, 15 topics).

| # | Page | Topics | Script | Done |
|---|---|---|---|---|
| 01 | what-react-is | 1, 6 | ex01 | ✅ |
| 02 | the-element | 5 | ex02 | ✅ |
| 03 | render-reconcile-commit | 2 | ex03 | ✅ |
| 04 | reconciliation | 3 | ex04 | ✅ |
| 05 | fiber | 7 | ex05 | ✅ |
| 06 | createroot | 8 | ex06 | ✅ |
| 07 | strictmode | 4 | ex07 | ✅ |
| 08 | versions-and-channels | 9, 16 | ex08 | ✅ |
| 09 | what-changed-in-19 | 10, 11 | ex09 | ✅ |
| 10 | starting-a-project | 12 | ex10 | ✅ |
| 11 | the-compiler | 13 | ex11 | ✅ |
| 12 | devtools-and-profiler | 14 | ex12 | ✅ |
| 13 | other-renderers | 15 | ex13 | ✅ |
| 14 | react-vs-alternatives | 17 | ex13 | ✅ |

## 🔴 The sandbox — `sandbox/react-p0/`

`harness.mjs` + `ex*.mjs`. **React 19 ships no UMD build**, so anything that runs in a
browser must be bundled first. The harness therefore does
**esbuild → local http server → system Firefox via `puppeteer-core`**, capturing
`console` and `pageerror` messages. Same Firefox-over-BiDi approach as
[[devbible-css-syllabus]], and the isolated-profile requirement (`userDataDir`) applies
here too.

`process.env.NODE_ENV` is set through esbuild `define`, which is what actually selects
React's dev or prod build — that is a dead-code branch, not a separate file. This is what
makes the StrictMode dev-vs-prod contrast measurable.

Deps pinned: react/react-dom **19.2.8**, esbuild 0.25.12, puppeteer-core 25.6.0,
@babel/core 7.29.7, babel-plugin-react-compiler **1.0.0**.

## Measured facts so far

**ex01 — the two packages**
- `react` has **42 public exports**; `react-dom` splits across four entry points.
- **`document.createElement` appears nowhere in react's source** — a scripted substring
  check, and the cleanest proof that `react` contains no DOM.
- `React.render` and `React.createRoot` are both `undefined`.
- On disk: `react/` **168 KB**, `react-dom/` **7148 KB** — **42.7×**.
- `react-dom@19.2.8` declares `peerDependencies.react: "^19.2.8"`.

**ex02 — the element**
- Automatic runtime compiles to `_jsx("button", {className, onClick, children})` with
  `key` as the **third argument**, not a prop. Classic runtime output captured alongside.
- An element is `{$$typeof: Symbol(react.transitional.element), type, key, props,
  _owner, _store}`. Note **`react.transitional.element`**, not the `react.element` most
  articles still show.
- `Object.isFrozen(el)` and `Object.isFrozen(el.props)` are both **true**; assigning
  throws `TypeError: Cannot assign to read only property 'className' of object '#<Object>'`.
- A component element holds the **function** (`cel.type === Greeting`); nothing has called it.
- 🔴 **`'key' in props` is `true` even though `Object.keys(props)` omits it.** React 19
  installs a non-enumerable, non-configurable **getter** that warns on access:
  ``li: `key` is not a prop. Trying to access it will result in `undefined` being
  returned…`` and returns `undefined`. Worth a gotcha — the naive `'key' in props` check
  gives the wrong answer.

**ex03 — render → commit ordering** (browser, production build)
- `root.render()` returns with the DOM still empty — it schedules, it does not render.
- **During render the DOM still shows the previous UI** (`Parent renders. DOM #label = "count 0"`
  while computing `count 1`). This is why reading the DOM in render is a bug.
- Order: render → **ref callback** → child `useLayoutEffect` → parent `useLayoutEffect` →
  child `useEffect` → parent `useEffect`. **Children commit before parents.**
- 🔴 **An inline `ref={node => …}` fires twice per update** — `null (detach)` then
  `<span> (attach)` — because the arrow's identity changes each render.

**ex04 — reconciliation** (state survival, measured by a counter value)
- Same type + same position → **survives** (5). Parent `<div>`→`<span>` → **destroyed** (0).
  Wrapped in a new `<section>` (depth change) → **destroyed** (0). `key` change → **destroyed** (0).
- 6 Counter instances created across the 4 cases.

**ex05 — fiber**
- DOM nodes carry `__reactFiber$<random>` and `__reactProps$<random>`.
- Walking `.return` reproduces the tree; children are a `child`/`sibling` **linked list**.
- 🔴 **Double buffering caught a wrong first measurement.** After adding an item the DOM had
  **3** `<li>` but the fiber the DOM node points at reported **2** children; its `alternate`
  had 3. The DOM node's fiber pointer is *not* re-targeted each render. First version of the
  script reported "child count = 2" with no explanation — corrected before it shipped.

**ex06 — createRoot** (all error strings real)
- `ReactDOM.render/hydrate/findDOMNode/unmountComponentAtNode` are all `undefined` in 19.2.8.
  `ReactDOM.render(...)` → `TypeError: ReactDOM.render is not a function`.
- Missing container → `Error: Target container is not a DOM element.`
- Second `createRoot` on the same container → the "already been passed to createRoot()" error,
  and then **`NotFoundError: Node.removeChild: The node to be removed is not a child of this
  node`** on unmount — the concrete harm the warning prevents.
- After `unmount()` → `Error: Cannot update an unmounted root.`

**ex07 — StrictMode, same source bundled twice**
- dev: renders **2**, effect setups **2**, cleanups **1**, `useState` initialiser **twice**,
  bundle **1,125,752 bytes**. prod: renders **1**, setups **1**, cleanups **0**, **194,799 bytes**.
- ⚠️ **A wrong console line nearly shipped** — the page's prod block was typed as `renders=2`
  when the run said `renders=1`. Caught by diffing the page against a fresh run. *Always diff
  the page's console block against the script output.*

**ex08 — versions/channels** (npm registry)
- **614 canary builds** vs **3 stable minors**. 19.2.0 released 2025-10-01, **316 days** old.
- Patches land on 19.2.x/19.1.x/19.0.x **the same day** — the security-backport signature;
  the December 2025 dates match the RSC advisories. `backport` tag → 19.0.8.
- `beta` still points at a **2024** build — dist-tags are not retired.
- Sorting canaries by name gives the wrong "newest" (name ends in a hash) — sort by publish time.

**ex09 — export diff 18.3.1 → 19.0.8 → 19.2.8**
- Surface: `react` 35 → 38 → 42. `react-dom/static` did not exist in 18.
- 19 added `use cache useActionState useOptimistic unstable_useCacheRefresh`; removed
  `createFactory`, `findDOMNode`, `render`, `hydrate`, `unmountComponentAtNode`,
  `renderToNodeStream`, `renderToStaticNodeStream`.
- **`createRoot`/`hydrateRoot` "removed" from `react-dom` actually *moved* to
  `react-dom/client`** — do not report that as a deletion.
- 19.2 added `Activity cacheSignal captureOwnerStack useEffectEvent` + `resume`,
  `resumeToPipeableStream`, `prerender`, `resumeAndPrerender`.

**ex10 — a real Vite scaffold + build**
- Template pins react ^19.2.8, vite ^8.2.0, **typescript ~6.0.2**, **oxlint** (not ESLint),
  `@vitejs/plugin-react` ^6.0.4.
- Build: **193.27 kB raw / 60.62 kB gzip**, 20 modules, **306 ms**. `dist/` total 232.7 KB.
- Production-build check: **0** occurrences of `Warning:` — the grep test for "did I ship the
  dev build".
- **CRA is NOT flagged deprecated on npm** (5.1.0, last published 2025-05-07) despite the
  Feb-2025 sunset. That is why it survives in tutorials — say "unmaintained", not "deprecated".

**ex11 — React Compiler 1.0.0**
- Emits `import {c as _c} from "react/compiler-runtime"` and `_c(n)` cache slots; memoizes the
  **JSX itself**, and tracks `product.cents` rather than `product`.
- Slots: component with value+callback+JSX → **9**; component that mutates a prop → **4**;
  component with no hooks → 2; hook calling `useState` → 8; `useMemo` → 5.
- 🔴 **A `use`-prefixed function that calls NO hooks is not compiled**, nor is a plain
  function. Compiles components and hooks-that-call-hooks.
- 🔴 **The compiler is not a linter.** It happily compiled a component that mutates a prop
  during render and said nothing. A *conditional hook* does make it bail out (silently, per
  function). Correctness is `eslint-plugin-react-hooks@7.1.1`'s job.
- ⚠️ **My own script's conclusions were wrong twice** — it grepped for `useMemoCache` when the
  emitted name is `_c`, so it reported "bailed out" for a component that was compiled. Fixed
  before writing the page. Also: the plugin **requires `filename`** or throws
  `Expected a filename but found none.`

**ex13 — renderers and the size comparison** (backs pages 13 *and* 14)
- Live renderers: react-native **0.87.0** (2026-08-11), @react-three/fiber **9.7.0**,
  ink **7.1.1**, react-reconciler **0.33.0**, react-test-renderer **19.2.8**.
- 🔴 **`react-test-renderer` is still published in lockstep with React** (same day, peer
  `^19.2.8`) — deprecated in React 19's docs, **not** removed from npm. Do not write
  "removed".
- Same counter app, same esbuild settings, minified: **react 189.8 KB / 59.2 KB gzip**
  vs **preact 13.0 KB / 5.4 KB gzip** — about **11×**.
- **Solid could not be measured** — its JSX needs `babel-preset-solid`, so esbuild's
  transform fails with "No matching export in solid-js/dist/solid.js for import jsx".
  Left out of the table with the reason stated rather than quoting a number from elsewhere.

**ex12 — Profiler and Performance Tracks**
- 🔴 **`<Profiler onRender>` never fires in a standard production build** — 0 calls. It needs
  the development build (or `react-dom/profiling`). Measured both ways.
- dev timings: mount `actualDuration=50.0ms/base=34.0ms`; update without memo `26.0/24.0`;
  the update that *switches* to the memoised component `31.0/22.0` (higher because swapping
  the component type remounts — do not read it as memo being slow); the next memoised update
  **`8.0ms actual vs 21.0ms base`** — the shape memoization makes.
- **Firefox clamps timer precision to 1 ms**, so every duration is a whole number. Say so.
- **837 `console.timeStamp` marks in development, 0 in production** — React 19.2 Performance
  Tracks. Track names: `Blocking Track, Transition Track, Suspense Track, Idle Track, Render,
  Commit, Waiting for Paint, App, List, Cell, Remaining Effects` — component names included.

## Build verification (2026-08-13)

Built with `yarn build --out-dir build-react-p0` — **an isolated out-dir is required
here**, because a co-session building into the default `build/` at the same time makes
the build die with
`ENOENT: build/__server/server.bundle.js`. That is the shared-working-tree hazard from
[[devbible-parallel-sessions]] showing up in the build, not a code problem.

Result: `[SUCCESS]`, **21 React HTML routes**, and after one fix **zero React
warnings**. All remaining broken links in the log belong to the css/typescript/javascript
pages a co-session is writing — left alone.

🔴 **The exit code lied twice.** `yarn build > log 2>&1; echo exit=$?` reports the
`echo`'s status, so a failed build showed `exit=0`. And Docusaurus reports broken links
as a *warning* with exit 0. **Grep the log; never trust the exit code** — this is the
"a green build proves nothing" rule, hit twice in one session.

**The two broken links were mine**: `01-what-react-is.md` and `12-devtools-and-profiler.md`
linking to `13-other-renderers.md`. Changing them to `./13-other-renderers.md` fixed it.
Cause not fully established — the bare `NN-name.md` form works everywhere else in these
pages (e.g. `06-createroot.md`), so the most likely explanation is a stale `.docusaurus`
cache from the concurrent build rather than a link-form rule. **Prefer `./` for
same-directory page links** and re-grep after every build.

## Traps hit

0. **A `cd` in one Bash call persists into the next**, so `node ex08.mjs` ran from the
   repo root and failed `MODULE_NOT_FOUND`. Use absolute paths or re-`cd` every call.
1. `require.resolve('react/cjs/react.development.js')` throws
   **`ERR_PACKAGE_PATH_NOT_EXPORTED`** — `exports` does not list `./cjs/*`. Read the file
   with `fs` and an explicit path. Same trap [[devbible-css-syllabus]] hit on
   `web-features`.

Related: [[devbible-react-syllabus]] · [[devbible-css-syllabus]] · [[devbible-brief]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-parallel-sessions]]
