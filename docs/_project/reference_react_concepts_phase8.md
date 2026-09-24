---
name: devbible-react-concepts-phase8
description: React Phase 8 (concurrent rendering, Suspense, transitions) — the load-bearing claims and their sources, so a later session can review or reuse without re-reading 20 pages
metadata:
  type: reference
---

Written 2026-08-14 by session `2ee7a9a3`, on branch `react-phase-7` in the
`devbible-react` worktree. **18 topics · 20 leaf pages · 4,827 lines · 0 files over 300.**
No sandbox, no console blocks; every claim documentation-validated with sources named per
page. Build-verified: zero broken links and zero MDX errors in `docs/react/`.

## The spine

1. **Concurrency is not a feature.** *"Concurrency is not a feature, per se … an
   implementation detail."* The one property everything follows from: *"rendering is
   interruptible … React may start rendering an update, pause in the middle, then continue
   later. It may even abandon an in-progress render altogether."*
2. **The consistency guarantee has a precise boundary.** React *"waits to perform DOM
   mutations until the end"*, so its **output** is consistent — commit is atomic though
   render is not. It cannot cover values components read from **outside** themselves. That
   gap is **tearing**.
3. **A transition is a permission, not a delay.** Non-blocking, interruptible, and
   **restarted** (not resumed). The marking window is **synchronous only** — an update in a
   `setTimeout` or after an `await` silently stays urgent.
4. **Suspense reacts to *suspending*, which is a short closed list.** `lazy` · `use` ·
   stylesheets with `precedence`, fonts, images. 🔴 *"Suspense does not detect when data is
   fetched inside an Effect or event handler."*
5. **The re-suspend rule is the phase's biggest surprise.** The fallback is shown again
   *"unless the update causing it was caused by `startTransition` or `useDeferredValue`"* —
   stated precisely: transitions only wait long enough to avoid hiding **already revealed**
   content.
6. **The stable thing is created once, outside the render that consumes it.** Produced
   three separate times: `lazy` at module scope, the promise for `use`, and `cache` at
   module scope. Every failure is "a new thing every render".

## Findings worth not re-deriving

- **`use(promise)` with an inline promise is a hang plus a request flood**, not a slow
  load: a tree suspended before first mount is *"retried … from scratch"*, so each retry
  creates a new promise. `useMemo` cannot fix it — memoization is not a guarantee and the
  cache is **discarded on suspend**, exactly when it is needed.
- **Waterfalls are structural, not a mistake**, and nested boundaries make them *look*
  better while they happen — which is why they survive review. Fix by starting requests
  high (props, or call cached fetchers for their side effect so children **join** the
  in-flight promise). **Boundaries control reveal, not request start** — flattening them
  fixes nothing.
- **`useDeferredValue` is not a debounce**: no fixed delay, adapts to the device, and its
  background render is interruptible. The sentence people miss — *"debouncing and
  throttling still produce a janky experience because they're **blocking**: they merely
  postpone the moment when rendering blocks the keystroke."* It **does not prevent extra
  network requests**, so the two compose.
- **The `await` limitation is a JavaScript problem** — *"React losing the scope of the
  async context … when AsyncContext is available, this limitation will be removed."*
  Re-wrap after **each** await. Fails silently.
- **`isPending` spans everything** — true from the first `startTransition` *"until all
  Actions complete and the final state is shown"*, so a separate `isSubmitting` is
  redundant. And it is often the **only** feedback, since fallbacks are suppressed.
- **The `action` prop convention**: own the transition inside the component and **`await`
  the prop**, so callers may pass sync or async and never learn about transitions.
- **Boundary placement decides three things at once** — what disappears together, what the
  server can **stream** first, and what React can **hydrate** first (Streaming SSR and
  Selective Hydration are integrated with Suspense). Most codebases decide only the first.
- **A fallback that suspends escalates to the parent boundary.** Keep fallbacks dumb.
- **Reveals are throttled to at most once every 300 ms** and grouped — so content can
  appear later than its data arrived, and design must not depend on reveal order. Ordering
  siblings would be `SuspenseList`, which is still `unstable_`.
- **`cache` at module scope fails silently otherwise** — each call creates a new function
  with its own cache, so calling it in a component is pure overhead with no error. Its
  per-request invalidation is both the safety property (no cross-user leak) and the limit
  (not a cache between requests). It **caches errors** too.
- **`cacheSignal` aborts on success, on abort, and on failure.** The middle one is why it
  exists: a discarded server render otherwise leaves queries running. Returns **`null`**
  outside rendering and always in Client Components.
- **`<Activity>` does four things**: hides with `display:none`, **preserves state**,
  **destroys effects**, and keeps rendering at low priority. The effects row is the point —
  a CSS-hidden tab keeps its sockets open. **Shipped in `react@19.2`.**
- **Tearing is the runtime consequence of the purity rule already given**, not a new rule.
  `useSyncExternalStore` is the only fix because it lets React detect a mid-render change
  and restart — userland cannot implement that.
- **Error boundaries and Suspense are a pair.** Does-not-catch list: event handlers, SSR,
  the boundary itself, async code — **with `startTransition` named as the exception**.
  Error boundary **outside**, Suspense inside. Still **no function-component form**.
- 🔴 **`ViewTransition` and `addTransitionType` are canary-only**; `SuspenseList` is
  `unstable_SuspenseList`. `<Activity>` from the same feature family **is** stable. The
  contrast is the single most useful thing on those two pages.

## Traps hit while writing

- 🔴 **Mid-phase forward links warn in a way that mimics the rule-1 slug bug and is not
  it.** A `.md` link resolves **file-relative** and is correct; when the target does not
  exist **yet**, Docusaurus falls back to URL resolution, and from a `README.md` index
  `../X.md` then lands one level too high. Verified: Phase 8's forward links warned while
  **Phase 7 stayed clean in the same build**. Do not "fix" the link form — write the file.
- **react.dev's `<ViewTransition>` reference could not be fetched** during this session
  ("Unable to verify if domain react.dev is safe to fetch" — transient). The page was
  written from the React Labs post, MDN and a corroborating search, and **says so
  explicitly** rather than implying reference coverage.
- **Backticks in a `git commit -m "…"` double-quoted string get command-substituted** — one
  message lost a `` `defer` `` and had to be amended. Use `-F -` with a quoted heredoc.
- A phase-table row lost a cell during a status edit and would have rendered broken; check
  cell counts with `awk -F'|' '/^\|/ {print NF-2}'` after editing markdown tables.

## Sources used

react.dev: `useTransition` (incl. the Actions sections and the post-`await` troubleshooting
entry) · `startTransition` · `<Suspense>` · `lazy` · `use` · `useDeferredValue` ·
`preload` · `cache` · `cacheSignal` · `<Activity>` · `Component` (error boundaries) ·
`useContext` · React v18.0 release post · React Labs: View Transitions, Activity, and more.
MDN: `Document.startViewTransition`.
Corroborating: DefinitelyTyped `types/react/experimental.d.ts` and facebook/react issues
17277 / 17779 for `SuspenseList`'s status and known problems.

Related: [[devbible-react-phase7]] · [[devbible-react-concepts-phase7]] ·
[[devbible-react-syllabus]]
