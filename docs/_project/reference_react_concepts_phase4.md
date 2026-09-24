---
name: devbible-react-concepts-phase4
description: React Phase 4 (Effects) — the load-bearing claims per topic and the primary source each came from, for review or reuse without re-reading the pages
metadata:
  type: reference
---

Phase 4 = **18 topics, 27 content files**, all documentation-validated (no sandbox,
no console blocks) under hard rule 8. Progress: [[devbible-react-phase4]].
Phase 3 concepts: [[devbible-react-concepts-phase3]].

## Sources used (all primary)

| Source | Topics |
|---|---|
| react.dev **`useEffect` reference** | 01–05, 07, 12 — richest single source; caveats, three array forms, cleanup ordering, both troubleshooting entries |
| react.dev **Synchronizing with Effects** | 01, 04, 05 — effects vs events, the 5 cleanup recipes, the 🚩 ref anti-fix, the remount principle |
| react.dev **You Might Not Need an Effect** | 06, 07, 16 — all 12 cases |
| react.dev **Lifecycle of Reactive Effects** | 09 — start/stop framing, reactive values, the door-lock analogy |
| react.dev **Separating Events from Effects** + **`useEffectEvent`** | 10 |
| react.dev **Removing Effect Dependencies** | 11 — the eight moves, the counter bug |
| react.dev **`StrictMode`** | 05 |
| react.dev **`useLayoutEffect`** | 12, 13 |
| react.dev **`useInsertionEffect`** | 13, 17 — **also the source for the tree-wide cleanup/setup ordering, by contrast** |
| react.dev **`useSyncExternalStore`** | 16 |
| react.dev **Common components (`ref` callback)** | 15 — React 19 ref cleanup |
| **MDN** `AbortController` / `AbortSignal` | 08 |
| **MDN** `removeEventListener` / `ResizeObserver` | 14 |
| **React 19.2 release post** (1 Oct 2025) | 10 — `useEffectEvent` stability |

## The claims, by topic

**01 What an effect is for** — *"If you're not trying to synchronize with some
external system, you probably don't need an Effect."* Effects are caused by
rendering; events by an interaction. ⚠️ Effect timing relative to paint is **not
guaranteed in either direction**. Effects are client-only.

**02 Anatomy** — three array forms are three behaviours, not degrees. Re-run order is
**cleanup(old) → setup(new)**. Array must be a constant-size **inline literal** (a
variable defeats the linter). `async` setup returns a promise, not a cleanup.

**03 The dependency array** — *"To remove a dependency, you need to 'prove' to the
linter that it doesn't need to be a dependency."* Lying does not make the effect run
less; it makes it **read one render's values forever**.

**04 Cleanup** —
- 🔴 The invariant is **testable**: *"the user shouldn't be able to distinguish
  between the setup being called once (as in production) and a setup → cleanup →
  setup sequence."*
- 🔴 **Cleanup is tied to dependencies, not to the component's lifetime.** Three
  occasions: dependency change (with the OLD values), unmount, StrictMode extra cycle.
  react.dev has a troubleshooting entry for people who think this is a bug.
- **Same HTTP verb, opposite answers** — analytics POST stays in the effect (caused by
  rendering, duplicate is dev-only and harmless); a purchase POST moves to a handler
  (caused by an interaction, duplicate costs money). Test = **causation and
  consequence**, never the method name. Sharpest worked example in the phase.
- **No effect can promise "once"** → module scope with a `typeof window` guard,
  because the module is also evaluated during SSR.
- **A cleanup added where none was needed is not free** — it introduces a visible
  flicker. Cleanup is not a safe default.
- Cleanup-without-setup is *"usually a code smell"*.

**05 StrictMode** — 🔴 **it only doubles the MOUNT.** The caveat says the extra cycle
runs *"before the first real setup"*, so an effect whose cleanup is wrong on the
**dependency-change path** passes cleanly and still leaks. A green StrictMode proves
the mount path alone. Callback refs get their own extra cycle. **Partial StrictMode is
not per-subtree** — *"React will only enable behaviors that are possible in
production"*, so wrapping one component gives **no** extra effect cycle on initial
mount. DevTools **dims** second-render logs → log count is never a measurement.

**06 You might not need an effect** — **12 cases, not 8.** Only case 12 (fetching)
survives as an effect. *"By the time an Effect runs, you don't know what the user
did."* **A guard clause at the top of an effect** is intent reconstructed after the
fact. **State used as a message queue** → delete both. 🔴 **An effect chain cannot be
replayed** — undo, history, session restore and tests that seed state all re-fire it;
handler logic is **inert until called**. A chain is usually **derived values that were
stored**. Batching cannot merge across a render boundary. Lifting state up deletes the
synchronisation problem rather than solving it.

**07 Fetching** — the four downsides verbatim (no SSR, waterfalls, no cache/preload,
not ergonomic). 🔴 *"This list of downsides is not specific to React."* The weak
strategy is **fetching on mount**. **The waterfall is structural** — a child cannot
fetch until its parent rendered. **Extracting `useData` fixes ergonomics ONLY.**
`setBio(null)` is a separate fix from `ignore`. Six concerns to build yourself: dedup,
cache, waterfall avoidance + error handling + loading state.

**08 Race conditions** — *"network responses may arrive in a different order than you
sent them."* 🔴 **`ignore` does not cancel** — the request completes and is discarded.
`AbortController` cancels but the fetch rejects with a **`DOMException` named
`AbortError`** (MDN); `err.name === 'AbortError'` is mandatory. `ignore` works with
**any promise**; a signal only with APIs that accept one. `AbortSignal.any()` composes
a timeout with the cleanup signal.

**09 Lifecycle** — 🔴 *"An Effect can only do two things: to start synchronizing
something, and later to stop synchronizing it."* One mount, many start/stop cycles.
Read every effect by answering only **what does start mean / what does stop mean**.
The **door-lock analogy** for StrictMode. Not reactive, two reasons: mutable-outside-
React (`location.pathname`, `ref.current`) and module-scope constants. *"All errors
flagged by the linter are legitimate."*

**10 `useEffectEvent`** — 🔴 **stable in 19.2**, re-verified 2026-08-14: reference page
carries **no** experimental/canary banner. Solves the case where the array is correct
*and* the behaviour is wrong (theme toggle reconnecting the chat). 🔴 **Identity is
intentionally UNSTABLE** — *"acts as a runtime assertion"*; never put one in a
dependency array, never `useCallback` it. **Never pass one to another component or
Hook.** Explicitly **not** for shrinking dependency arrays.

**11 Removing dependencies** — 🔴 **EIGHT documented moves**, not four: outside the
component · inside the effect · read primitives from an object · calculate primitives
from a **pure** function prop · updater form · Effect Event · move to a handler ·
split the effect. **Move 3 works without the parent changing anything** and must
happen **during render**. ⚠️ Move 4 requires **purity**; for an impure function prop
the answer is `useEffectEvent`. 🔴 **The suppression bug, worked:** a suppressed `[]`
keeps the initial render's `onTick` forever, so `setCount(0 + 1)` runs every second and
the counter **always shows 1** — frozen, not lagging. **A ref hiding a dependency is
worse than eslint-disable** — same lie, no evidence, because refs are non-reactive.
*"There's always a better solution than ignoring the linter!"* is a claim about
**coverage**.

**12 `useLayoutEffect`** — 🔴 **the guarantee IS the blocking.** *"can hurt
performance. Prefer `useEffect` when possible."* Measure-then-place: two renders happen
either way, this only decides whether the user **sees** the first. ⚠️ **A state update
inside it makes React execute all remaining Effects immediately, including
`useEffect`.** Four documented ways out of the SSR warning.

**13 Effect ordering** — 🔴 **all cleanups, then all setups**, documented on the
`useInsertionEffect` page **by contrast**: *"Unlike other types of Effects, which fire
cleanup for every Effect and then setup for every Effect."* Three passes: insertion →
DOM mutation → layout (before paint) → paint → passive. Children before parents, which
is what makes `ref.current` reliable in effects. Ordering is **not** timing, a render
is **not** a commit, and insertion effects' position relative to the DOM mutation is
explicitly unspecified.

**14 Timers, listeners, observers** — 🔴 **only the `capture` flag participates in
`removeEventListener` matching**; `passive` and `once` may differ and removal still
succeeds. A failed removal **has no effect** — no error to look for. `disconnect()`
unobserves **all** targets; prefer it for an observer the effect owns. Capture
`ref.current` into a `const`. Leak signature: **"it gets worse the longer you use the
app"**.

**15 Effects and refs** — a ref cannot be reacted to, so an effect with `[]` cannot see
a node that arrives later. 🔴 **React 19 added cleanup functions for ref callbacks**;
the old null-on-detach behaviour is retained for compatibility and *"will be removed in
a future version"*. An **inline arrow ref callback detaches and reattaches every
render**. Choose by **what owns the lifetime** — the component or the node.

**16 External store** — 🔴 the effect version is **correct and still wrong**: it keeps
a **copy**, and concurrent rendering opens a window in which the copy disagrees →
**tearing**. The documented guarantee: React calls `getSnapshot` **a second time just
before applying changes to the DOM** and restarts as blocking if it moved, *"to ensure
that every component on screen is reflecting the same version of the store."*
`getSnapshot` must be **cached/immutable** or infinite loop. `subscribe` must be
module-scope or `useCallback`. `getServerSnapshot` omitted = server render **throws**.

**17 `useInsertionEffect`** — for CSS-in-JS authors only. Runs before any layout
effect. Gives up: no state, **no refs attached**, DOM position unspecified. **Interleaves
cleanup/setup per component**, the exception that documents the rule in topic 13.

**18 Skipping the first run** — ⚠️ **react.dev documents no recommended pattern for
this**, and the page says so rather than inventing one. The ref guard is the 🚩
anti-fix; "first" is unstable because remounting resets it. The documented near-answer
is the **prev-value comparison during render**, which *compares values* rather than
counting renders — so the first render is skipped because nothing changed, not by a
special case. react.dev still says *"most components shouldn't need this pattern
either."*

## Traps for the next phase

- **Check what earlier phases already own before writing.** Topics 05 and 06 were both
  largely covered elsewhere (Phase 0 · 07 and Phase 2 · 02.03 for StrictMode; Phase 3 ·
  06/07/16 for cases 1–4), and finding that out first changed their shape completely.
- **Do not link a whole unwritten phase** (`../../phase-7-custom-hooks/README.md`).
  Name it in plain text.
- **Converting a topic to a directory breaks inbound links** — grep for the old
  filename and repoint before moving on. Topic 11 had four.
