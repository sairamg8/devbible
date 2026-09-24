---
name: devbible-react-phase5
description: React Phase 5 (Refs, context and reducers) — COMPLETE — 16 topics, 18 files, 0 broken links, 0 over cap
metadata:
  type: project
---

**UI every topic, memory every 3 topics** (hard rule 9, revised 2026-08-14).
Phase 4: [[devbible-react-phase4]] · concepts: [[devbible-react-concepts-phase4]].

## Status — ✅ COMPLETE

**All 16 topics written, 18 content files.** `docs/react/pages/phase-5-refs-context-reducers/`.
Commits: `c1f6361` (01 + phase README), `0528f0a` (02–03), `4dbc07b` (04),
`ffd21b3` (05–06), `92633d9` (07–08), `a3e9adc` (09–10), and the phase close.

**Phase-close verification:** link walker over 19 files → **0 broken links**;
**0 files over 300 lines**; spread **140–273**; **clean rebuild → 0 React broken
links**.

## 🔴🔴 TWO build traps caught at this phase close — both cost real time

**1. The Python link walker is NOT sufficient.** It only checks that the target
*file* exists. Docusaurus resolves links differently and can still report broken
links the walker passes. **Always run the build at phase close** — the walker is a
fast pre-check between topics, not the verification.

**2. `yarn build` uses a STALE `.docusaurus` cache and reports FALSE broken
links.** At this phase close the build reported **4 broken React links** pointing at
files that existed on disk and that the walker had confirmed. They were topics
11–16, written after the cache was last populated.

```bash
rm -rf .docusaurus && yarn build --out-dir build-react-p<N>
```

After clearing the cache: **0 React broken links.** Do not go hunting for a bug
before clearing the cache — the reported links were all real files.

⚠️ Also use a **private `--out-dir`** (`build-react-p5`). A shared `build/` collides
with parallel sessions and produces a bogus
`ENOENT … build/__server/server.bundle.js` failure. That is what the untracked
`build-react-p2` / `p3` directories were for. They are gitignored (`build-react*`);
delete them when done — each is ~65 MB.

🔴 **Next: React Phase 6 — Rendering performance and the React Compiler (17
topics).** React remains claimed by session `6ffd754d`.

Only topic **02 DOM refs** needed chunking (2 chunks), drafted whole at 309.

## 🔴 Material already in hand — do not re-fetch

Two phase-5 topics are largely covered by sources fetched during phase 4:

- **Topic 06 (Ref callbacks)** — react.dev *Common components* was fetched for
  phase 4 topic 15. Key facts already established: **React 19 added cleanup
  functions for ref callbacks**; the null-on-detach fallback is retained for
  backwards compatibility and *"will be removed in a future version"*; an **inline
  arrow ref callback detaches and reattaches every render**. Phase 4 · 15 already
  covers much of this — **check it before writing, and cross-link rather than
  duplicate.**
- **Topic 15 (`useSyncExternalStore`)** — fully fetched for phase 4 topic 16
  (tearing, the `getSnapshot` caching error, module-scope `subscribe`,
  `getServerSnapshot` throwing if omitted). **Phase 4 · 16 owns the *why*;** phase
  5 · 15 should own the *reference* — signature, parameters, caveats — and link
  back rather than re-argue tearing.

⚠️ **Phase 4 topic 15 also covers DOM refs and measuring**, so topic 02 here must
check it first. This is the phase-4 lesson repeating: *check what earlier phases
already own before writing.*

## Topics 01–04 claims

- 🔴 **"React does not re-render… React is not aware of when you change it because
  a ref is a plain JavaScript object."** No setter, no subscription. That is the
  whole definition.
- 🔴 **"Do not write *or read* `ref.current` during rendering, except for
  initialization."** The prohibition is **symmetric** — the *reading* half is the
  part people miss.
- **`useRef` has no lazy initializer** (unlike `useState`), so `useRef(new Thing())`
  constructs on every render and discards all but the first. Documented idiom:
  `if (ref.current === null) ref.current = new Thing()` — allowed because *"the
  result is always the same, and the condition only executes during
  initialization"*. ⚠️ Under StrictMode **each ref object is created twice and one
  discarded**, so this idiom is wrong for anything with side effects.
- **Do not mutate an object held in a ref if it is also used for rendering** — same
  failure as mutating state.
- The initial value **"is ignored after the initial render"**; the returned object
  is the same one every render.

**02 DOM refs**
- `ref.current` is `null` **before the commit** — not a failure state.
- A ref per list item: `useRef` inside `map()` is illegal (hook rules); the
  documented answer is **one ref holding a `Map`**, filled by a ref callback that
  **returns a cleanup deleting the entry**. Without the cleanup, StrictMode's extra
  ref-callback cycle leaves **double the entries** — that is the diagnostic.
- 🔴 **React 19: `ref` is a regular prop — `forwardRef` is not required.** Every
  pre-2024 tutorial wraps this.
- 🔴 The DOM-safety rule is **sharper than "never touch it"**: *"You can safely
  modify parts of the DOM that React has **no reason** to update"* — the
  always-empty-`<div>` carve-out is what makes mounting a chart/editor library
  legal. Unsafe = modifying/adding/removing children React manages.
- **`flushSync`** commits synchronously so the DOM is readable on the next line
  (add-then-scroll). It is a commit barrier, **not** a fix for snapshot semantics.

**03 useReducer**
- The reducer **must be pure** — that is what makes it testable without React,
  replayable, and safe for React to call twice.
- 🔴 **StrictMode calls the reducer AND the initializer twice.** The documented
  failure: a reducer that does `state.todos.push(...)` **adds the todo twice** in
  dev. Two bugs in one line — mutation means `Object.is` sees no change (possible
  bail-out) *and* the side effect is applied twice.
- **`dispatch` does not change `state` in running code** — same snapshot semantics
  as `useState`, including inside a `setTimeout` 5s later. If you need the next
  value now: **call `reducer(state, action)` yourself** — only possible because it
  is pure.
- 🔴 **`dispatch` has a stable identity** — *"including it will not cause the Effect
  to fire"*. This is the basis for a separate **dispatch context** (topic 12).
- The **third argument `init`** is the lazy initializer (which `useRef` lacks).

**04 createContext / useContext**
- 🔴 **The context object holds no information** — it is a *key*, not a store.
  *"It represents which context other components read or provide."*
- 🔴 **React 19: render `<SomeContext>` directly.** `SomeContext.Provider` is now
  described as **"a legacy way to provide the context value before React 19"**;
  `SomeContext.Consumer` is *"an alternative and rarely used way"*.
- 🔴 **A provider returned from the SAME component does not affect that
  component's `useContext` call** — it must be *above*. Top cause of "context isn't
  working".
- ⚠️ Second cause, looks impossible: **duplicate context modules** (symlinks,
  monorepo, mixed ESM/CJS) → provider and reader hold different objects. Context
  only works if they are `===`. Documented diagnostic: assign both to globals and
  compare.
- **`memo` does NOT block context updates** — *"Skipping re-renders with `memo`
  does not prevent the children from receiving fresh context values."* Required for
  correctness, and why memo is not the fix for context re-renders.
- Value compared with **`Object.is`** → `useMemo` the value, `useCallback` the
  functions in it. That is the **floor**, not the solution (topic 05).
- The **defaultValue is static and never changes** — a last-resort fallback for *no
  provider*, not an initial value.

## Topics 05–08 claims

**05 The context re-render problem**
- 🔴 **There is no selector.** `useContext(SomeContext)` takes **one parameter** —
  no field, no equality fn. A consumer subscribes to the **context**, not a field.
  So every fix is **splitting the value**, never filtering the subscription. (This
  is also the honest answer to "why do Zustand/Redux exist" — they offer selector
  subscriptions.)
- **`memo` cannot help** (documented) — but it *does* still stop **intermediate**
  components that don't read the context.
- Fix ladder: (1) `useMemo` the value + `useCallback` its functions — **the floor,
  fixes only spurious re-renders**; (2) 🔴 **split state from dispatch** — needs no
  memoization at all because `dispatch` is stable for free; (3) split by **change
  frequency** — one context per thing that changes for its own reasons.
- ⚠️ **Proportionality section written deliberately**: a re-render producing
  identical output is a function call + a diff that finds nothing. Only 4 cases
  actually matter (high in tree / expensive render / very frequent value / long
  list of consumers). Profile before splitting five ways.

**06 Ref callbacks**
- Identity change → **previous cleanup, then next callback(node)** — same ordering
  as an effect's cleanup-then-setup.
- ⚠️ **TypeScript hazard**: a concise arrow body returns its expression, so
  `ref={node => map.set(k, node)}` returns the **Map**, which React calls as the
  cleanup. Use a block body.
- The cleanup form is better *on its merits*: it **closes over the node**; the
  legacy null form is called without it.
- Deferred deliberately: *when* to use one vs an effect → Phase 4 · 15; the
  list-of-refs `Map` → phase 5 topic 02 · 01.

**07 useImperativeHandle**
- Returns **`undefined`** — the handle is what `createHandle` returns.
- Third arg is a **real dependency array** (inline, constant size, `Object.is`).
  **Omitting it rebuilds the handle every render**, breaking any parent that cached
  `ref.current`.
- 🔴 **The pitfall is the point:** *"If you can express something as a prop, you
  should not use a ref"*, with the docs' own `Modal { open, close }` named as wrong.
  Test written for the page: **would you want it re-applied on remount?** State yes,
  action no.
- **A good handle is verbs, not nodes** — the `scrollAndFocusAddComment()` example.
- React 19: `forwardRef` **not** needed.

**08 When a ref is the wrong tool**
- 🔴 The signature bug: **"it works but the UI is stale"** — the handler reads the
  latest value correctly and only the *render* is wrong. Worse than a plain failure
  because an unrelated state change makes the right value appear, so it looks
  **intermittent**.
- Five misuses, one cause: a ref chosen to *avoid* something (a re-render, a
  dependency, a double-run) rather than because it fits.
- Written from material already in hand — **no new fetch needed**, everything
  quoted was already sourced in phase 4 and topics 01/07.

## 🔴 Correction recorded: do not switch languages mid-way

After finishing phase 4 I parked React and claimed MongoDB, reading "once complete"
as *phase*-complete. **The user corrected this: finish the CURRENT language before
picking a new one** — *"pick next untill you complete current lang … and then check
the damn readme.md to pick new one"*.

React was re-claimed the same turn. **MongoDB was left in a coherent handoff state
rather than abandoned half-planned**: its syllabus was finished (204 topics,
[[devbible-mongodb-syllabus]]) and released unclaimed, so the effort is not lost
and no session has to re-plan it.

**The rule going forward: React through to Phase 14, then check the claims table.**

## Coordination

`docs/README.md` claims table as of 2026-08-14:
- **React** — session `6ffd754d` 🔴 active, phases 0–4 done, phase 5 in progress.
- **MongoDB** — 🟢 no owner, **syllabus complete, 0 pages**, free to start.
- **PostgreSQL** — ✅ complete (298 pages), review only.
- **Node.js** — ✅ complete and audited (248/248).
- **Express** — session `8679dc8c` active, phases 0–4 done.
- **JavaScript** — session `01ECVvH5` active, phase 7.
- **Unclaimed, zero pages:** Docker & Podman, Redis, Nginx.

⚠️ **CSS and TypeScript currently have broken links in the build** (3 and 4) from
other sessions mid-write. **Not mine to fix** — the user said so explicitly:
*"care about your build errors not other langs"*. React's own count is **0**.
