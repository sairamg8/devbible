---
title: "Link map · React · Part 2 (phases 3–4)"
sidebar_label: "02 · state and effects"
sidebar_position: 2
---

# Link map · React · Part 2 (phases 3–4)

Covers every topic row of phase 3 (T03-01 to T03-17, state and the render cycle) from `docs/react/syllabus/01-the-react-model.md` and phase 4 (T04-01 to T04-18, effects and synchronization) from `docs/react/syllabus/02-hooks.md`. That is 35 rows, all with a written page of ours. Numbering follows row order in the syllabus; the last two rows of phase 4 (`useInsertionEffect`, skipping the first run) are plain table rows without a bold lead-in, which is why an earlier pass missed them.
*read* = I read the passage; *headings only* = fetched, headings checked. Third-party links carry a date where the page shows one; "(page metadata)" means the date sits in the page's structured data, not on screen. No `#anchors` are given.

🔴 **Version note.** Our syllabus targets **React 19.2.8** (`docs/react/README.md`). react.dev pages below are the current docs and were fetched at 200. `useEffectEvent` is stable from 19.2; the react.dev "Separating Events from Effects" page does not state a version. Several third-party picks are older: Dan Abramov's overreacted posts (2019) and Brian Vaughn's derived-state post (2018) predate StrictMode's double-mounted effects and `useEffectEvent`, and use class-era or early-hooks wording. The mental models still hold; each block says when a pick is old.

---

## Phase 3 — State and the render cycle

### T03-01 · `useState` — Master · ✅ written `docs/react/pages/phase-3-state/01-usestate.md`
- **Read this:** [useState](https://react.dev/reference/react/useState) · react.dev · reference with usage sections for updater functions, avoiding recreated initial state and storing information from previous renders (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Things to know about useState](https://tkdodo.eu/blog/things-to-know-about-use-state) · TkDodo (blog), 2021-02-13 · five short sections (updater, lazy initializer, bailout, overload, implementation detail) that read as a checklist of what the reference spreads over several pages · fetched 2026-10-13 (*read*)
- **Our delta:** the whole API in one place with the snapshot model stated first.

### T03-02 · State is a snapshot — Master · ✅ written `docs/react/pages/phase-3-state/02-state-is-a-snapshot.md`
- **Read this:** [State as a Snapshot](https://react.dev/learn/state-as-a-snapshot) · react.dev · each render gets a fixed copy of state; calling a setter only queues a re-render with a new snapshot (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Fantastic closures and how to find them in React](https://www.developerway.com/posts/fantastic-closures) · Nadia Makarevich, Developer Way, 2023-08-14 (page metadata) · ties the snapshot to JavaScript closures: a function made during a render keeps that render's values unless it is re-created · fetched 2026-10-13 (*read*)
- **Our delta:** the closure explanation next to the render-cycle diagram.

### T03-03 · Updater functions — Master · ✅ written `docs/react/pages/phase-3-state/03-updater-functions.md`
- **Read this:** [Queueing a Series of State Updates](https://react.dev/learn/queueing-a-series-of-state-updates) · react.dev · updaters are queued and run in order, each receiving the previous result (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [useState](https://react.dev/reference/react/useState) · react.dev · "Updating state based on the previous state" (*read*) · fetched 2026-10-13
- **Beyond the docs:** [useState lazy initialization and function updates](https://kentcdodds.com/blog/use-state-lazy-initialization-and-function-updates) · Kent C. Dodds, 2020-08-03 · a one-rule version: any time new state depends on previous state, use a function update · fetched 2026-10-13 (*read*)
- **Our delta:** when a plain value is correct and an updater is not needed.

### T03-04 · Automatic batching — Master · ✅ written `docs/react/pages/phase-3-state/04-automatic-batching.md`
- **Read this:** [Automatic batching for fewer renders in React 18](https://github.com/reactwg/react-18/discussions/21) · Dan Abramov, React 18 Working Group, 2021-05-27 · before/after for handlers versus promises, timeouts and native handlers, plus `flushSync` as the opt-out (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [React v18.0](https://react.dev/blog/2022/03/29/react-v18) · react.dev blog · the batching section in the release post (*read* that section) · fetched 2026-10-13
- **Our delta:** none needed beyond the 19.2 target; the pre-18 behaviour is history.

### T03-05 · Immutable updates — Master · ✅ written `docs/react/pages/phase-3-state/05-immutable-updates/01-objects-and-nesting.md`
- **Read this:** [Updating Objects in State](https://react.dev/learn/updating-objects-in-state) · react.dev · mutation of state is not detected; copy the object and set the copy (*read*) · covers our angle: **partial** — nested objects and the reference-check reason; arrays are on the next page · fetched 2026-10-13
- **Also good:** [Updating Arrays in State](https://react.dev/learn/updating-arrays-in-state) · react.dev · treat arrays as read-only; use spread, `filter`, `map`, `slice`, or Immer (*read*) · fetched 2026-10-13
- **Our delta:** none found worth adding; the searches returned only near-duplicate tutorials and quiz pages, no better explanation than the two official pages.

### T03-06 · Derived state — Master · ✅ written `docs/react/pages/phase-3-state/06-derived-state.md`
- **Read this:** [Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure) · react.dev · "Avoid redundant state": compute `fullName` during render rather than store it (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) · react.dev · "Updating state based on props or state": storing `fullName` in an Effect costs a render pass with a stale value; calculate it during rendering (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Don't Sync State. Derive It!](https://kentcdodds.com/blog/dont-sync-state-derive-it) · Kent C. Dodds, 2019-09-30 · a tic-tac-toe board stores only `squares` and derives winner and status each render, so adding a feature touches one value · fetched 2026-10-13 (*read*)
- **Our delta:** the effect-sync version of the bug and its extra render.

### T03-07 · Resetting state with `key` — Master · ✅ written `docs/react/pages/phase-3-state/07-resetting-state-with-key.md`
- **Read this:** [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state) · react.dev · the key section: a changed key destroys the old state and creates a fresh one (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [You Probably Don't Need Derived State](https://legacy.reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html) · Brian Vaughn, React blog, 2018-06-07 · "fully uncontrolled component with a key" as the recommended reset, against copying props to state; written for class components, so the lifecycle code is dated · fetched 2026-10-13 (*read*)
- **Also good:** [Understanding React's key prop](https://kentcdodds.com/blog/understanding-reacts-key-prop) · Kent C. Dodds, 2019-11-11 · a changed key unmounts and remounts, removing all state (*read*) · fetched 2026-10-13
- **Our delta:** when remount cost makes `key` the wrong reset.

### T03-08 · What triggers a re-render — Master · ✅ written `docs/react/pages/phase-3-state/08-what-triggers-a-re-render.md`
- **Read this:** [Render and Commit](https://react.dev/learn/render-and-commit) · react.dev · two triggers: initial render, and a state update on the component or an ancestor's state (*read*) · covers our angle: **partial** — does not list context or parent re-render as separate causes · fetched 2026-10-13
- **Beyond the docs:** [React re-renders guide: everything, all at once](https://www.developerway.com/posts/react-re-renders-guide) · Nadia Makarevich, Developer Way, 2022-08-02 (page metadata) · four triggers (own state, parent or children, context, hooks) with state as the root cause · fetched 2026-10-13 (*read*)
- **Our delta:** one table of cause, who re-renders, and how to stop it.

### T03-09 · Lazy initial state — Understand · ✅ written `docs/react/pages/phase-3-state/09-lazy-initial-state.md`
- **Read this:** [useState](https://react.dev/reference/react/useState) · react.dev · "Avoiding recreating the initial state": pass `createInitialTodos`, not `createInitialTodos()` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [useState lazy initialization and function updates](https://kentcdodds.com/blog/use-state-lazy-initialization-and-function-updates) · Kent C. Dodds, 2020-08-03 · you only pay the cost when the function is called, on the first render (*read*) · fetched 2026-10-13
- **Our delta:** when it is not worth it (cheap values).

### T03-10 · Structuring state — Understand · ✅ written `docs/react/pages/phase-3-state/10-structuring-state.md`
- **Read this:** [Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure) · react.dev · five principles: group related, avoid contradictions, redundancy, duplication, deep nesting (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Avoiding impossible states in React](https://www.jackfranklin.co.uk/blog/avoiding-impossible-states-react/) · Jack Franklin, 2019-07-22 · works one tabbed UI through three data structures, showing the structure itself can rule out the bug (*read*) · fetched 2026-10-13 (URL redirects from javascriptplayground.com)
- **Our delta:** a status string in place of several booleans, as a checklist.

### T03-11 · Bailing out — Understand · ✅ written `docs/react/pages/phase-3-state/11-bailing-out.md`
- **Read this:** [useState](https://react.dev/reference/react/useState) · react.dev · the caveat under the `set` function: an `Object.is`-identical value skips re-rendering the component and its children; no heading of its own; the caveat adds that "in some cases React may still need to call your component before skipping the children" (*read*) · covers our angle: **partial** — mentions the extra call in one clause but does not explain when or why · fetched 2026-10-13
- **Beyond the docs:** [Things to know about useState](https://tkdodo.eu/blog/things-to-know-about-use-state) · TkDodo, 2021-02-13 · a section on the update bailout and `Object.is`; shorter than the reference but states it plainly (*read*) · fetched 2026-10-13
- **Our delta:** the "one extra call, then skip" detail, with the cases where it happens.

### T03-12 · Render order — Understand · ✅ written `docs/react/pages/phase-3-state/12-render-order.md`
- **Read this:** [Render and Commit](https://react.dev/learn/render-and-commit) · react.dev · rendering is recursive: React calls the triggering component, then each component it returns (*read*) · covers our angle: **partial** — no statement of effect order · fetched 2026-10-13
- **Beyond the docs:** [React Internals: Which useEffect runs first?](https://blog.master.dev/react-internals-which-useeffect-runs-first/) · Teng Wei Herr, Frontend Masters blog, 2025-04-28 · render goes top-down while effects run child-first because of depth-first fiber traversal in commit; about effects, not render order alone (*read*) · fetched 2026-10-13
- **Our delta:** top-down render versus bottom-up commit in one picture.

### T03-13 · The update queue — Understand · ✅ written `docs/react/pages/phase-3-state/13-the-update-queue.md`
- **Read this:** [Queueing a Series of State Updates](https://react.dev/learn/queueing-a-series-of-state-updates) · react.dev · queued updaters applied in order during the next render (*read*) · covers our angle: **partial** — user-level behaviour, not the internal list · fetched 2026-10-13
- **Beyond the docs:** [Build your own React](https://pomb.us/build-your-own-react/) · Rodrigo Pombo, 2019-11-13 · builds fibers and a work loop, then `useState` with an action queue on the hook, applied on the next render; a simplified model of an older React (*read*) · fetched 2026-10-13
- **Our delta:** which parts of the simplified model match real React and which do not.

### T03-14 · State in lists — Understand · ✅ written `docs/react/pages/phase-3-state/14-state-in-lists.md`
- **Read this:** [Rendering Lists](https://react.dev/learn/rendering-lists) · react.dev · a stable `key` from data, not the array index, which breaks on reorder, insert or delete (*read*) · covers our angle: **partial** — does not show state landing on the wrong row · fetched 2026-10-13
- **Also good:** [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state) · react.dev · state belongs to a position and identity in the tree (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Index as a key is an anti-pattern](https://robinpokorny.com/blog/index-as-a-key-is-an-anti-pattern/) · Robin Pokorny, 2015-10-11 · explains that with an unchanged index key React assumes the DOM element is the same component as before, so a push or removal mid-list can "display wrong data"; the text does not name component state or inputs, and 2015 means class-era (*read*) · fetched 2026-10-13
- **Our delta:** the same bug with hooks and `useState` per row.

### T03-15 · Preserving and resetting state across the tree — Understand · ✅ written `docs/react/pages/phase-3-state/15-preserving-and-resetting.md`
- **Read this:** [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state) · react.dev · state is tied to position in the render tree, not to the JSX markup (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Understanding React's key prop](https://kentcdodds.com/blog/understanding-reacts-key-prop) · Kent C. Dodds, 2019-11-11 · changing `key` unmounts the old instance and mounts a new one (*read*) · fetched 2026-10-13
- **Our delta:** the same-type-same-position rule against component definitions nested inside components.

### T03-16 · Updating state during render — Understand · ✅ written `docs/react/pages/phase-3-state/16-updating-state-during-render.md`
- **Read this:** [useState](https://react.dev/reference/react/useState) · react.dev · "Storing information from previous renders": compare `prevCount` with `count` and set state during render (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Hooks FAQ, "How do I implement getDerivedStateFromProps?"](https://legacy.reactjs.org/docs/hooks-faq.html) · legacy.reactjs.org · the older docs' version of the same pattern: update state right during rendering, and React re-runs the component immediately after the first render (*read* that section) · fetched 2026-10-13
- **Our delta:** the guard that stops the loop. No third-party page on updating state during render was verified; the Brian Vaughn derived-state post cited earlier covers props-copied-to-state in classes and never mentions setState during render, so it was removed from this block (it stays under T03-07).

### T03-17 · Infinite render loops — Understand · ✅ written `docs/react/pages/phase-3-state/17-infinite-render-loops.md`
- **Read this:** [useState](https://react.dev/reference/react/useState) · react.dev · Troubleshooting "Too many re-renders": usually a handler called during render, as in `onClick={handleClick()}` (*read*) · covers our angle: **partial** — the effect-driven loop is on the useEffect page · fetched 2026-10-13
- **Also good:** [useEffect](https://react.dev/reference/react/useEffect) · react.dev · Troubleshooting "My Effect keeps re-running in an infinite cycle": the Effect updates state, and that state change changes the Effect's dependencies (*read* that section) · fetched 2026-10-13
- **Beyond the docs:** [A Complete Guide to useEffect](https://overreacted.io/a-complete-guide-to-useeffect/) · Dan Abramov, 2019-03-09 · loops from an effect with no dependency array or a dependency that changes every render, with the fix at the source of the changing value; 2019 (*read*) · fetched 2026-10-13
- **Our delta:** one list of causes, render-body setter, effect setter, unstable dependency.

---

## Phase 4 — Effects and synchronization

### T04-01 · What an effect is for — Master · ✅ written `docs/react/pages/phase-4-effects/01-what-an-effect-is-for.md`
- **Read this:** [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects) · react.dev · effects run code after rendering to sync with an external system such as a browser API, network or third-party widget (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [A Complete Guide to useEffect](https://overreacted.io/a-complete-guide-to-useeffect/) · Dan Abramov, 2019-03-09 · each render has its own props and state, so effects and handlers keep that render's values; 2019, before StrictMode's double mount (*read*) · fetched 2026-10-13
- **Our delta:** the "is there an external system?" test first.

### T04-02 · `useEffect` anatomy — Master · ✅ written `docs/react/pages/phase-4-effects/02-useeffect-anatomy.md`
- **Read this:** [useEffect](https://react.dev/reference/react/useEffect) · react.dev · reference: setup, cleanup, dependencies, caveats, usage and troubleshooting sections (*read* the headings and the fetching and cleanup sections) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [A Complete Guide to useEffect](https://overreacted.io/a-complete-guide-to-useeffect/) · Dan Abramov, 2019-03-09 · builds the model up from "each render has its own effect" (*read* the render-snapshot passage only) · fetched 2026-10-13
- **Our delta:** the timing relative to paint, in one diagram.

### T04-03 · The dependency array is not a preference — Master · ✅ written `docs/react/pages/phase-4-effects/03-the-dependency-array.md`
- **Read this:** [Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies) · react.dev · the list must match the reactive values the code reads; change the code, do not suppress the linter (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [useEffect](https://react.dev/reference/react/useEffect) · react.dev · "Specifying reactive dependencies" (*read*) · fetched 2026-10-13
- **Beyond the docs:** [A Complete Guide to useEffect](https://overreacted.io/a-complete-guide-to-useeffect/) · Dan Abramov, 2019-03-09 · argues for fixing the source of a changing dependency rather than removing it (*read*) · fetched 2026-10-13
- **Our delta:** the three outcomes of a missing dependency: stale value, missed re-run, loop.

### T04-04 · Cleanup — Master · ✅ written `docs/react/pages/phase-4-effects/04-cleanup/01-the-cleanup-contract.md`
- **Read this:** [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects) · react.dev · "Step 3: Add cleanup if needed" is the one dedicated cleanup section in the official docs (*read* the headings) · covers our angle: **partial** — the contract is stated, the per-resource recipes are scattered · fetched 2026-10-13
- **Also good:** [useEffect](https://react.dev/reference/react/useEffect) · react.dev · cleanup runs with the old values before each re-run with changed dependencies, and once after unmount; Troubleshooting "My cleanup logic runs even though my component didn't unmount" (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Understanding the React useEffect cleanup function](https://blog.logrocket.com/understanding-react-useeffect-cleanup-function) · Chimezie Innocent, LogRocket, 2024-12-02 · when cleanup runs on re-render versus unmount, with the docs sentence quoted (*read*) · fetched 2026-10-13
- **Our delta:** cleanup as an inverse of setup, with recipes per resource.

### T04-05 · `StrictMode` double-invocation — Master · ✅ written `docs/react/pages/phase-4-effects/05-strictmode-double-invocation.md`
- **Read this:** [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects) · react.dev · "How to handle the Effect firing twice in development?" with recipes for widgets, events, animations and fetching (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Why does useEffect run twice](https://blog.openreplay.com/useeffect-runs-twice/) · OpenReplay Team, 2026-10-04 · calls the double run a deliberate test of cleanup and warns against a `useRef` "has run" guard (*read*) · fetched 2026-10-13
- **Our delta:** the production behaviour (once) and why the guard hides the bug.

### T04-06 · You might not need an effect — Master · ✅ written `docs/react/pages/phase-4-effects/06-you-might-not-need-an-effect/01-logic-that-belongs-to-an-event.md`
- **Read this:** [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) · react.dev · twelve cases from derived state to chains of computations, each with the replacement (*read* the headings and the fetching and external-store sections) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** split across three chunks; no third-party page beat the official one in my searches, which returned only summaries of it.

### T04-07 · Fetching data in an effect — Master · ✅ written `docs/react/pages/phase-4-effects/07-fetching-data.md`
- **Read this:** [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) · react.dev · "Fetching data": fetch for what is on screen, add cleanup to avoid races, prefer framework or cache (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects) · react.dev · the `ignore` flag example and the note on TanStack Query, SWR (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Why You Want React Query](https://tkdodo.eu/blog/why-you-want-react-query) · TkDodo, 2023-11-07 · counts the bugs in a 10-line fetch effect: races, no loading state, stale data, StrictMode double fire; "Data Fetching is simple. Async State Management is not." (*read*) · fetched 2026-10-13
- **Our delta:** the hand-written effect shown with every bug fixed.

### T04-08 · Race conditions — Understand · ✅ written `docs/react/pages/phase-4-effects/08-race-conditions.md`
- **Read this:** [useEffect](https://react.dev/reference/react/useEffect) · react.dev · "Fetching data with Effects": the `ignore` flag set in cleanup (*read*) · covers our angle: **partial** — no `AbortController` · fetched 2026-10-13
- **Beyond the docs:** [Handling race conditions when fetching data in React with useEffect](https://maxrozen.com/race-conditions-fetching-data-react-with-useeffect) · Max Rozen · reproduces the race with random delays, then fixes it with a boolean flag and with `AbortController`; the page shows no date (*read*) · fetched 2026-10-13
- **Our delta:** flag versus abort, and what each leaves running.

### T04-09 · An effect has its own lifecycle — Understand · ✅ written `docs/react/pages/phase-4-effects/09-effect-lifecycle.md`
- **Read this:** [Lifecycle of Reactive Effects](https://react.dev/learn/lifecycle-of-reactive-effects) · react.dev · an effect starts and stops synchronizing, repeatedly, separately from mount and unmount (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** none found outside the docs; search results were mirrors and paraphrases of this page.

### T04-10 · `useEffectEvent` — Understand · ✅ written `docs/react/pages/phase-4-effects/10-useeffectevent.md`
- **Read this:** [useEffectEvent](https://react.dev/reference/react/useEffectEvent) · react.dev · wraps a callback so effects read the latest props and state without re-running; call it only from effects or other Effect Events, never list it in dependencies (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Separating Events from Effects](https://react.dev/learn/separating-events-from-effects) · react.dev · the `onConnected` example; names no version, and neither does the `useEffectEvent` reference page (*read* both) · fetched 2026-10-13
- **Beyond the docs:** [React has finally solved its biggest problem: useEffectEvent](https://blog.logrocket.com/react-has-finally-solved-its-biggest-problem-useeffectevent/) · Jack Herrington, LogRocket, 2026-01-07 · compares a `useRef` workaround, a dependency that restarts the timer, and `useEffectEvent` on one example (*read*) · fetched 2026-10-13
- **Our delta:** the restrictions list as a lint-style checklist.

### T04-11 · Removing dependencies legitimately — Understand · ✅ written `docs/react/pages/phase-4-effects/11-removing-dependencies/01-objects-and-functions.md`
- **Read this:** [Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies) · react.dev · move objects and functions inside the effect or outside the component, depend on primitives (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [useEffect](https://react.dev/reference/react/useEffect) · react.dev · "Removing unnecessary object dependencies" and "function dependencies" (*read*) · fetched 2026-10-13
- **Our delta:** none found outside the docs worth citing.

### T04-12 · `useLayoutEffect` — Understand · ✅ written `docs/react/pages/phase-4-effects/12-uselayouteffect.md`
- **Read this:** [useLayoutEffect](https://react.dev/reference/react/useLayoutEffect) · react.dev · fires after DOM commit but before repaint, so updates in it show without flicker (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [useEffect vs useLayoutEffect](https://kentcdodds.com/blog/useeffect-vs-uselayouteffect) · Kent C. Dodds, 2020-12-01 · use it to measure then mutate, or when a visible flicker would occur; otherwise default to `useEffect` (*read*) · fetched 2026-10-13
- **Our delta:** why it blocks paint and when that cost is acceptable.

### T04-13 · Effect ordering — Understand · ✅ written `docs/react/pages/phase-4-effects/13-effect-ordering.md`
- **Read this:** [React Internals: Which useEffect runs first?](https://blog.master.dev/react-internals-which-useeffect-runs-first/) · Teng Wei Herr, Frontend Masters blog, 2025-04-28 · child effects run before parent effects because of depth-first traversal in the commit phase (*read*) · covers our angle: **partial** — mount order only; unmount cleanup order not read · fetched 2026-10-13
- **Our delta:** the react.dev `useEffect` reference gives the order only within one Effect (cleanup with old values, then setup with new) and says nothing about parent versus child or cleanup order across components (*read* by the verifier). The Frontend Masters post does not discuss unmount or cleanup order either, so cleanup order across components has no verified third-party source here.

### T04-14 · Timers, listeners and observers — Understand · ✅ written `docs/react/pages/phase-4-effects/14-timers-listeners-observers.md`
- **Read this:** [Making setInterval Declarative with React Hooks](https://overreacted.io/making-setinterval-declarative-with-react-hooks/) · Dan Abramov, 2019-02-04 · the interval is set once and calls the newest callback stored in a ref; 2019, and `useEffectEvent` is the newer route (*read*) · covers our angle: **partial** — timers only, no listeners or observers · fetched 2026-10-13
- **Also good:** [useEffect](https://react.dev/reference/react/useEffect) · react.dev · "Listening to a global browser event" and "Tracking element visibility" recipes (`IntersectionObserver` with `disconnect()` in cleanup) (*read*) · fetched 2026-10-13
- **Our delta:** one cleanup rule across all three resource kinds.

### T04-15 · Effects and refs together — Understand · ✅ written `docs/react/pages/phase-4-effects/15-effects-and-refs.md`
- **Read this:** [Manipulating the DOM with Refs](https://react.dev/learn/manipulating-the-dom-with-refs) · react.dev · `ref.current` is set in commit, so read it from handlers or effects, not during render (*read*) · covers our angle: **partial** — no cleanup-time ref reads · fetched 2026-10-13
- **Also good:** [Referencing Values with Refs](https://react.dev/learn/referencing-values-with-refs) · react.dev · refs hold values that do not affect rendering; do not read or write `ref.current` during render (*read*) · fetched 2026-10-13
- **Our delta:** none found outside the docs; the one relevant search hit was a lint-warning note I did not verify.

### T04-16 · Subscribing to an external store from an effect — Understand · ✅ written `docs/react/pages/phase-4-effects/16-external-store.md`
- **Read this:** [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore) · react.dev · "Subscribing to a browser API" shows `navigator.onLine` with `subscribe` and `getSnapshot`; the Caveats say React restarts a transition update as blocking if the store changed, so every component shows the same store version; the page never uses the word tearing and never mentions `useEffect` (*read*) · covers our angle: **partial** — the effect-based version is on our page · fetched 2026-10-13
- **Also good:** [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) · react.dev · "Subscribing to an external store": replace the effect with `useSyncExternalStore` for `navigator.onLine` (*read*) · [Concurrent React for Library Maintainers](https://github.com/reactwg/react-18/discussions/70) · Rick Hanlon, React 18 Working Group, 2021-07-07 · defines tearing and says the hook re-starts rendering before showing an inconsistent UI; it does not directly argue against effects (*read*) · fetched 2026-10-13
- **Our delta:** the effect version written out, with the stale first render it causes.

### T04-17 · `useInsertionEffect` — Know · ✅ written `docs/react/pages/phase-4-effects/17-useinsertioneffect.md`
- **Read this:** [useInsertionEffect](https://react.dev/reference/react/useInsertionEffect) · react.dev · a hook for CSS-in-JS library authors that inserts `style` tags before layout effects fire; no state updates inside, refs not attached yet, does not run on the server; has a section on why it beats injecting during render or in `useLayoutEffect` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** "explicitly not for application code" as the first line. No third-party explanation was verified (the verifier's web search budget ran out before this topic could be searched).

### T04-18 · Skipping the first run — Know · ✅ written `docs/react/pages/phase-4-effects/18-skipping-the-first-run.md`
- **Read this:** [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects) · react.dev · Pitfall "Don't use refs to prevent Effects from firing": a `useRef` guard shows "Connecting..." once in development but "doesn't fix the bug", because the Effect must work after a remount (*read*) · covers our angle: **partial** — the double-run guard, not the "skip the first run on purpose" case · fetched 2026-10-13
- **Also good:** [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) · react.dev · "Adjusting some state when a prop changes" and "Sharing logic between event handlers" are the replacements for most skip-first-run effects (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Why does useEffect run twice](https://blog.openreplay.com/useeffect-runs-twice/) · OpenReplay Team, 2026-10-04 · states that a `useRef` flag that skips the second run does not fix a missing cleanup, and why a real remount gets a fresh ref (*read*) · fetched 2026-10-13
- **Our delta:** the rare legitimate case and what to write instead.
