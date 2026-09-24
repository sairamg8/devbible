---
name: devbible-react-concepts-phase3
description: React Phase 3 concept record — the load-bearing claims across the 17 state/render-cycle topics, with sources
metadata:
  type: reference
---

**Concept record for React Phase 3 (State and the render cycle).** Hard rule 9 —
per-phase concepts saved so later sessions need not re-read the pages.
Progress: [[devbible-react-phase3]]. Phase 2 concepts:
[[devbible-react-concepts-phase2]].

**All doc-validated, no sandbox.** 🔴 **The `useState` reference caveats are the single
richest source in the phase** — most of the precision below comes from there.

## The three facts everything reduces to

1. **State is a snapshot** — fixed within a render.
2. **React compares with `Object.is`** — hence bail-outs and the silence of mutation.
3. **State belongs to a position in the tree** — hence `key`, list bugs, and resets.

## 01 `useState`

- React stores state **"outside of your component, as if on a shelf"**, keyed by position.
  The destructured variable is a per-render copy — reassigning it does nothing.
- **Matched by call order into a slot list.** No names. Hence the top-level rule; the
  docs' own remedy for conditional state is *"extract a new component"*.
- **Initial value is read once** at the first render in that position. A prop passed as
  initial state will not track later changes.
- StrictMode calls the **initialiser twice**; one result discarded.

## 02 State is a snapshot 🔴

- *"Setting state only changes it for the next render."* Docs: *"State behaves more like a
  snapshot."*
- The `setTimeout` demo: alert shows **0** three seconds later with 5 on screen. *"the
  state value captured in the event handler remains fixed at the time the user
  interacted"*.
- **Mechanism is ordinary JS closure**: each render is a new invocation with new `const`s
  and new closures. Nothing React-specific except that React swaps which closure is
  attached.
- Technique from the docs: **mentally substitute** the literal value into handlers.
- Four real-world bites: interval/timeout callbacks, async after `await`, wrong effect
  deps, handlers held by memoized children.
- **A stale closure is usually correct** — it is the state as of when the action began.

## 03 Updater functions

- *"An updater function gets added to React's queue and is processed based on the previous
  state in the queue."* — **previous in the QUEUE, not in the render**.
- **Three cases where it is required**: multiple updates to the same state in one event;
  the update runs later than its render (timeout/interval/promise/listener); several
  concurrent sources.
- 🔴 **Often the fix for a *dependency array*** — `setCount(c => c+1)` removes `count`
  from effect deps, so the interval stops being torn down.
- **Updaters must be pure** — StrictMode double-invokes them, one result discarded.
- Naming conventions are documented: initials (`e => !e`), or `prevEnabled`.
  ⚠️ Full-name form risk: `setEnabled(() => !enabled)` (dropped parameter) silently reads
  the outer snapshot again.
- Mutating and returning the same object = double failure (mutation + bail-out).

## 04 Automatic batching

- *"React waits until all code in the event handlers has run before processing your state
  updates."* Prevents **"half-finished" renders** — a correctness feature, not just perf.
- React 18: previously **only React event handlers** batched; promises, `setTimeout`,
  native handlers did not. Post's own before/after example.
- 🔴 **Batching ≠ snapshot.** Batching decides *how many renders*; the snapshot decides
  *what the value is*. Turning batching off would not fix `setCount(count+1)` ×3.
- **An `await` is a boundary** — before and after are different tasks, so two batches.
- `unstable_batchedUpdates` is obsolete post-18.
- `flushSync`: docs say it is uncommon / hurts perf / last resort **three separate times**.
  Caveats: **may force pending Suspense boundaries to show fallbacks**, may run pending
  effects, **may flush updates outside the callback**.

## 05 Immutable updates (2 chunks)

- *"treat any JavaScript object that you put into state as read-only."*
- 🔴 Recap: mutating *"will not trigger renders **and will change the state in previous
  render 'snapshots'**"* — it corrupts earlier closures retroactively.
- **Two distinct failures**: no setter called → no render; setter called with the same
  reference → **bail-out**, silent.
- **Local mutation is explicitly fine** — *"absolutely fine because you're mutating a fresh
  object you have just created"*. Build then hand over.
- **Spread is shallow** — `{...person}` copies the *reference* to `person.artwork`.
  Rule: **copy every level on the path**; everything off the path stays shared.
- Array table verbatim: add `push`/`unshift` → `concat`/spread; remove
  `pop`/`shift`/`splice` → `filter`/`slice`; replace `splice`/index assignment → `map`;
  sort `reverse`/`sort` → **copy first**.
- ⚠️ `slice` copies, `splice` mutates — one letter apart, opposite.
- *"even if you copy an array, you can't mutate existing items inside of it"* — copying is
  shallow.
- **ES2023** `toSorted`/`toReversed`/`toSpliced`/`with` (cited to MDN; react.dev's table
  predates them).
- **`structuredClone` is almost never right**: destroys structural sharing (every
  memo boundary re-renders), throws `DataCloneError` on functions/DOM/unknown classes,
  costs O(whole tree).
- **Immer** copies only along touched paths — recommended by name in the docs. Drafts are
  Proxies: use `current(draft)` to log, never let one escape.

## 06 Derived state 🔴

- *"When something can be calculated from the existing props or state, don't put it in
  state. Instead, calculate it during rendering."*
- 🔴 **The cost is a visible frame**, and the docs spell the sequence out: render with
  stale value → **commit to the DOM** → run effect → set state → render again → commit.
- Expensive → **`useMemo`, not state**. Still derived, so it cannot go stale. Docs note the
  **React Compiler** does this automatically.
- Legitimate storage: a **draft**, a **deliberate snapshot** (price at purchase), or
  something genuinely uncomputable. Test from the recap: *"Don't put props into state
  unless you specifically want to prevent updates."*
- **Review tell:** a `useEffect` whose body is only `setX(...)` with the calculation's
  inputs as deps.

## 07 Resetting state with `key`

- *"Specifying a `key` tells React to use the `key` itself as part of the position."*
- Replaces reset-by-effect: the effect version *"will first render with the stale value,
  and then render again"*, resets only the variables it names, and needs maintenance.
- 🔴 **Structural requirement: a component cannot key itself** — hence react.dev's
  `ProfilePage` renders `<Profile key={userId}>`. Often needs a thin wrapper.
- Destroys the whole subtree: state, refs, cleanups, DOM, **focus**, scroll, animations,
  uncontrolled values.
- Bad keys: `JSON.stringify(record)` (remounts per edit), `Math.random()` (per render),
  index. Composite keys are fine. An incrementing counter is a legitimate "start over".

## 08 What triggers a re-render 🔴

- Exactly two: **initial render**, and **its own or an ancestor's state updated**.
- 🔴 **"A prop changed" is NOT a trigger** — props change *because* the parent rendered.
  A child with identical props still re-renders when its parent does.
- Not triggers: mutation, ref writes, module variables, time, external DOM, promise
  resolution.
- Rendering is **recursive**; commit is minimal — *"React does not touch the DOM if the
  rendering result is the same as last time"*. So an "unnecessary re-render" producing no
  DOM change is nearly free.
- Four things that stop the descent: bail-out, `memo`, **unchanged element identity
  (`children`)**, the Compiler.

## 09 Lazy initial state

- `useState(fn())` evaluates every render; `useState(fn)` / `useState(() => fn())` once.
- Worth it for `localStorage` parses, `Map`/index construction, uuid. Pointless for
  literals.
- ⚠️ React calls the initialiser with **no arguments** — wrap if the function takes any.
- `() => {}` returns `undefined`, not `{}` — needs `() => ({})`.
- 🔴 **`useRef` has NO lazy form** — `useRef(new Thing())` constructs every render. Idiom:
  `if (ref.current === null) ref.current = expensive()`.
- `useReducer`'s third argument is the equivalent, and also enables reset-by-`init`.

## 10 Structuring state

Five principles verbatim: **group related**, **avoid contradictions**, **avoid redundant**,
**avoid duplication**, **avoid deep nesting**. Framing: database normalisation; *"Make
your state as simple as it can be—but no simpler."*
- Two booleans = four combinations, two nonsense → **one status string** (or a TS
  discriminated union). Highest-leverage of the five.
- Recap: *"For UI patterns like selection, keep ID or index in state instead of the object
  itself."*
- Flattening trade: trivial updates, but the tree must be read by following id refs. Docs
  keep it conditional — flatten **in response to pain**.
- Signal for `useReducer`: the same combination of updates appearing in three handlers.

## 11 Bailing out 🔴

- Caveat verbatim: `Object.is` equal → *"skip re-rendering the component and its
  children"*, **"Although in some cases React may still need to call your component before
  skipping the children"**.
- 🔴 **A bail-out is NOT a promise your function will not run.** Safe only because purity
  is assumed.
- `{...user}` unchanged → **renders** (new reference). `setItems([])` on an empty list →
  renders every time.
- This is *why mutation is silent* rather than an error.
- Deliberate no-op idiom: return the existing value from an updater.
- `useState` bail-out (state, every set call) vs `memo` (props, on parent render) —
  different jobs. `memo` doesn't compare state because the bail-out already does.
- ⚠️ A render counter is both a purity violation and an unreliable instrument here.

## 12 Render order

- Top-down, depth-first; *"This process is recursive"*.
- 🔴 **Effects run bottom-up (children → parents)** while rendering runs top-down — so a
  parent's effect can measure its children. Explains `ref.current === null` during render.
- Phases: render → commit → **layout effects** → paint → effects.
- 🔴 **Props are computed during the parent's render** — memoizing a child does NOT stop
  `<Child value={expensive()} />` from running `expensive()`.
- Order ≠ timing: concurrent rendering can yield mid-tree, and a render may never commit.

## 13 The update queue

- Two-line rule: a **plain value replaces**; an **updater transforms** the running value.
- Docs' three trace tables reproduced: 3 updaters → 3; value-then-updater → 6;
  value/updater/value → **42** (the updater ran and was discarded).
- 🔴 **A plain value after an updater throws the updater's work away.**
- Reading procedure: write the snapshot, list calls, **substitute the snapshot into every
  value expression**, walk carrying the running value. Step 3 is where mistakes happen.
- **Each state variable has its own queue**; batching does not merge them.
- Same fold as `useReducer` with the reducer named.

## 14 State in lists

- 🔴 **Index keys do NOT remount** (Phase 1 measurement). React matches key 0 to key 0, so
  the instance and DOM node stay and only props change — **state stays with the position
  while data moves**. Symptom is a ticked checkbox on the wrong row: corrupted data, not
  lost state, and it never errors.
- Index keys acceptable only if: never reordered/filtered/sorted, appended only, no
  per-item or uncontrolled DOM state.
- **Generating a key during render is worse than an index** — remounts everything, every
  render.
- **Keys are unique among siblings only.** Corollary: moving an item between two arrays is
  a remount.
- 🔴 **The missing-key warning is deduped** (Phase 1 measurement) — absence proves nothing.
- **Deeper fix: lift per-item UI state and key it by id** — then no per-position state
  exists to corrupt. Exception: uncontrolled inputs, where keys are the only defence.

## 15 Preserving and resetting across the tree

- Same type + same position → kept. Different type at that position → **entire subtree
  destroyed**.
- Survives: props changing completely, the two branches of a ternary rendering the same
  type.
- 🔴 **A conditional wrapper element changes position** — `{withBorder ? <div><Form/></div>
  : <Form/>}` wipes the form. Fix: one tree shape, vary the `className`.
- Rewriting a ternary as two `&&`s moves the component to a different sibling slot →
  accidental reset (react.dev presents this as deliberate "Option 1").
- Heuristic: **if the two branches don't have identical tree shapes, state resets.**

## 16 Updating state during render

- Five rules verbatim: condition checked; update inside the condition; **currently
  rendering component only**; **never another component's setter**; no mutation.
- *"React will discard its output and immediately attempt to render it again."*
- Beats an effect because the re-render happens **before children render and before
  commit** — *"this lets the List children skip rendering the stale selection value"*.
- 🔴 But the docs immediately say **"most components shouldn't need this pattern either"**
  and show the fix: store `selectedId`, derive with `find` — *"Now there is no need to
  'adjust' the state at all."*
- Shape: `prevX` state initialised to the prop + comparison + updates inside the branch,
  including resetting `prevX`. Missing that reset = infinite loop.
- Function-component successor to `getDerivedStateFromProps`.

## 17 Infinite render loops

- Three shapes: **(1)** unconditional set during render — always throws `Too many
  re-renders`; **(2)** an effect that sets its own dependency; **(3)** a **new object
  identity in a dependency array**.
- 🔴 **An effect loop often throws nothing** — each iteration is a separately scheduled
  update, so the render-count guard never trips. **No error ≠ no loop.**
- Disguise for shape 1: `onClick={handleClick()}` — accidental parentheses.
- 🔴 **The bail-out makes two near-identical effects differ**:
  `setCount(0)` on `[items]` terminates (primitive compares equal);
  `setItems([])` on `[items]` loops forever (new array). **A loop can hide behind a value
  that happens to compare equal.**
- Fixes for shape 3, best first: **depend on primitives**, `useMemo`, move the value inside
  the effect, or the Compiler.
- ⚠️ The hooks linter **cannot see shape 3** — it will tell you to add the unstable object.
- Class-era wording of the same guard: `Maximum update depth exceeded`.
