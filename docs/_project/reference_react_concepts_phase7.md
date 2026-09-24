---
name: devbible-react-concepts-phase7
description: React Phase 7 (custom hooks and the Rules of React) — the load-bearing claims and their sources, so a later session can review or reuse without re-reading 25 pages
metadata:
  type: reference
---

Written 2026-08-14 by session `2ee7a9a3`, on branch `react-phase-7` in the
`devbible-react` worktree. **12 topics · 25 leaf pages · 7,084 lines · 0 files over
300.** No sandbox, no console blocks anywhere — every claim is documentation-validated
and each page's `> Verified:` line names its sources.

## The spine of the phase, in six claims

1. **Custom hooks share stateful logic, not state.** *"Each call to a Hook is completely
   independent from every other call to the same Hook."* The `useOnlineStatus` example
   misleads because both callers subscribe to the same **external** value — *"two
   completely independent state variables and Effects! They happened to have the same
   value at the same time"*. `useFormInput` called twice in one component is the
   unambiguous proof. (react.dev · Reusing Logic with Custom Hooks)
2. **Hook identity is positional.** `useState` receives no identifier; React *"holds an
   array of state pairs for every component"* plus *"the current pair index, which is set
   to `0` before rendering"*, and each call *"gives you the next state pair and increments
   the index"*. Breaking the order means React *"match[es] the wrong state pairs to the
   wrong variables"*. (react.dev · State: A Component's Memory)
3. **Purity is the rule the others protect.** Idempotent · no side effects in render · no
   mutation of non-local values — and *"all code that runs during render must also be
   idempotent"*. **Local mutation is explicitly fine** (the `FriendList` `push` example):
   the test is whether the mutation *"isn't 'remembered' when the component is rendered
   again"*. (react.dev · Components and Hooks must be pure)
4. **Four things are immutable, and the fourth is a deadline.** Props and state · context
   · hook arguments and return values · **anything already passed to JSX**, because
   *"React may eagerly evaluate the JSX before the component finishes rendering"*. The
   justification for the hook half is **local reasoning** — *"Hooks should be treated like
   'black boxes' when they are called."*
5. **React calls components and hooks, not you.** `{Article()}` creates no element, so no
   fiber, no reconciliation, no DevTools entry, no independent re-render, no working
   `memo` — and its hooks land in the **caller's** slot list. No higher-order hooks, no
   hooks as props: *"Hooks should be as static as possible."*
6. **A hook API should constrain.** *"A good custom Hook makes the calling code more
   declarative by constraining what it does."* The gate is the name: *"If you struggle to
   pick a clear name, it might mean that your Effect is too coupled … and is not yet ready
   to be extracted."*

## Findings worth not re-deriving

- **`useLocalStorage` diverges because the browser will not tell you.** MDN: the `storage`
  event *"is **not** fired on the window that made the change"* — it is a **cross-tab**
  mechanism and is silent for two components in one document. The fix is to emit from the
  writer; `useSyncExternalStore` over a module store with a **cached** snapshot.
- **`getSnapshot` has two opposite failure modes.** A new object each call ⇒ infinite loop
  (*"the result of getSnapshot should be cached"*); mutating in place ⇒ never re-renders.
  `subscribe` must be stable or React re-subscribes every render.
- **A module-level `let` fails in four different environments** — no re-render for other
  components (dev), tearing under concurrent rendering (rare, prod), a purity violation so
  the Compiler silently skips the component (invisible), and **per-process not per-request
  on the server** (cross-user leak).
- **The popular `usePrevious` is wrong twice**: it reads `ref.current` during render (a
  documented Pitfall — *"Do not write **or read** `ref.current` during rendering, except
  for initialization"*), and it tracks the previous **render**, not the previous **value**.
  react.dev's `prevItems`-in-state pattern replaces it, and *"React will re-render the
  `List` immediately after it exits with a `return` statement."*
- **`useOnClickOutside` breaks with portals.** A native `document` listener sees the real
  DOM; *"Events from portals propagate according to the React tree rather than the DOM
  tree."* So `contains(e.target)` is false for a click the user felt was inside.
- **`useIntersectionObserver` needs a ref *callback*.** A ref object is not reactive, so
  the effect runs once — possibly before the node exists — and never again. **React 19
  added cleanup functions for ref callbacks**, so the observer's lifetime binds to the
  node's. `StrictMode` runs *"one extra development-only setup+cleanup cycle"* for them.
- **`useIsMounted` should usually be deleted.** React 18 removed the *"Can't perform a
  React state update on an unmounted component"* warning
  ([reactwg/react-18#82](https://github.com/reactwg/react-18/discussions/82)); the real bug
  is a race between in-flight requests, fixed by an ignore flag or `AbortController`.
- **`use` is the one conditional-capable API.** *"Unlike Hooks, `use` CAN be called within
  loops and conditional statements."* It still may not be called outside a Component or
  Hook, may not sit in `try`/`catch` (**a different reason** from hooks: suspension is
  signalled by throwing), and its context form is unsupported in Server Components.
  Promises must be **cached** or every render suspends on a promise that never resolves.
  ⚠️ The *why* on the page is **labelled as reasoning** — react.dev states the rule but
  publishes no implementation note.
- **RTL recommends against its own `renderHook`**: *"You should prefer `render` since a
  custom test component results in more readable and robust tests."* `result.current`
  holds *"the most recently **committed** return value"*, so destructuring it is the
  classic stale-test bug. `act`: prefer `await act(async …)` — the sync form *"will be
  deprecated and removed"* — and it needs `global.IS_REACT_ACT_ENVIRONMENT=true`.
- **The hook-boundary dependency fix is narrower than the component one.** Of react.dev's
  three solutions for object dependencies, only **"extract primitive values"** works
  inside a hook: the object was built by the caller, so it can be neither hoisted out of
  the component nor moved inside the effect. Callbacks can't be destructured at all —
  they get `useEffectEvent`.

## Traps hit while writing

- 🔴 **MDX**: an inline code span that **wraps a line inside a blockquote and contains
  `{`** fails the build — micromark reads it as a JSX expression ("Unexpected lazy line in
  expression in container"). Keep such code on one line, or use a fenced block. Cost one
  build failure in `08/01`.
- ⚠️ The **worktree had no `node_modules`**, which is why no build had ever run on this
  branch. `yarn install` there is safe and gitignored; revert `.yarn/install-state.gz`
  afterwards.
- Every topic that chunked needed its inbound links repointed to `NN-topic/README.md` —
  **bodies as well as footers**. Grep before creating the directory.
- Do not link `../../phase-8-*/…` from Phase 7; Phase 8 does not exist yet.

## Sources used across the phase

react.dev: Rules of React · Rules of Hooks · Components and Hooks must be pure · React
calls Components and Hooks · Reusing Logic with Custom Hooks · State: A Component's Memory
· Sharing State Between Components · Passing Data Deeply with Context · You Might Not Need
an Effect · Preserving and Resetting State · Removing Effect Dependencies · `useRef` ·
`useSyncExternalStore` · `useEffectEvent` · `use` · `act` · ref callbacks (react-dom
common) · `createPortal` · Invalid hook call warning.
MDN: `Window: storage` event · `Window.matchMedia()` · `IntersectionObserver`.
Testing Library: `renderHook` API.
React runtime error strings (corroborated from issue threads, **not** sandbox-reproduced
and labelled as such on the page): "Rendered fewer hooks than expected…", "Rendered more
hooks than during the previous render." = minified error **#310**.

Related: [[devbible-react-phase7]] · [[devbible-react-syllabus]] ·
[[devbible-never-compress-to-fit-cap]]
