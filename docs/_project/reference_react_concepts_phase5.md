---
name: devbible-react-concepts-phase5
description: React Phase 5 (Refs, context and reducers) — the load-bearing claims per topic and the primary source each came from
metadata:
  type: reference
---

Phase 5 = **16 topics, 18 content files**, documentation-validated, no sandbox, no
console blocks. Progress: [[devbible-react-phase5]].
Phase 4 concepts: [[devbible-react-concepts-phase4]].

## Sources used (all primary, all react.dev)

`useRef` · Manipulating the DOM with Refs · Common components (`ref` callback) ·
`useReducer` · Extracting State Logic into a Reducer · `createContext` ·
`useContext` · Passing Data Deeply with Context · Scaling Up with Reducer and
Context · `useImperativeHandle` · `useId` · `useSyncExternalStore` ·
`useDebugValue`.

## The claims, by topic

**01 `useRef`** — 🔴 *"React is not aware of when you change it because a ref is a
plain JavaScript object."* 🔴 *"Do not write **or read** `ref.current` during
rendering, except for initialization"* — **symmetric**; the reading half is what
people miss. **No lazy initializer** (unlike `useState`) → the
`if (ref.current === null)` idiom, allowed because it is idempotent. ⚠️ StrictMode
**creates each ref object twice** and discards one, so that idiom is wrong for
anything with side effects. Never mutate a ref's contents if they are also rendered.

**02 DOM refs** — `ref.current` is `null` **before the commit**, not a failure.
`useRef` inside `map()` is illegal → **one ref holding a `Map`**, filled by a ref
callback returning a cleanup; without the cleanup StrictMode leaves **double the
entries**. 🔴 **React 19: `ref` is a regular prop, `forwardRef` not required.**
🔴 The DOM rule is sharper than "never touch it": *"You can safely modify parts of
the DOM that React has **no reason** to update"* — the **always-empty-`<div>`
carve-out** is what makes mounting a chart/editor library legal. `flushSync` is a
**commit barrier** for add-then-scroll, not a fix for snapshot semantics.

**03 `useReducer`** — the reducer **must be pure**, which is what makes it testable
without React, replayable, and safe to call twice. 🔴 **StrictMode calls the reducer
AND initializer twice**; the documented failure is `state.todos.push(...)` **adding
the todo twice** — two bugs in one line (no identity change → possible bail-out,
*and* the side effect applied twice). **`dispatch` does not change `state` in
running code**; if you need the next value, **call `reducer(state, action)`
yourself**. 🔴 **`dispatch` has a stable identity** — *"including it will not cause
the Effect to fire."* Third arg `init` is the lazy initializer.

**04 `createContext` / `useContext`** — 🔴 **the context object holds no
information**; it is a *key*. 🔴 **React 19: render `<SomeContext>` directly** —
`.Provider` is documented as **"a legacy way"**, `.Consumer` as *"rarely used"*.
🔴 **A provider returned from the SAME component does not affect that component's
`useContext`** — top cause of "context isn't working". ⚠️ Second cause: **duplicate
context modules** (symlinks/monorepo/mixed ESM-CJS) → provider and reader hold
different objects; only works if `===`. **`memo` does NOT block context updates**
(documented, and required for correctness). Value compared with `Object.is`.
Default value is **static and never changes**.

**05 The context re-render problem** — 🔴 **there is no selector**: `useContext`
takes **one parameter**, so a consumer subscribes to the whole value. Therefore
every fix is **splitting the value**, never filtering the subscription. Fix ladder:
memoize the value (**the floor** — fixes only spurious re-renders) → **split state
from dispatch** (needs no memoization; `dispatch` is stable for free) → split by
**change frequency**. ⚠️ Proportionality section written deliberately: only 4 cases
actually matter (high in tree / expensive render / very frequent value / long list
of consumers).

**06 Ref callbacks** — identity change → **previous cleanup, then next
callback(node)**. 🔴 **React 19 added cleanup functions**; the null-on-detach
fallback *"will be removed in a future version"*. The cleanup form is better on its
merits because it **closes over the node**. ⚠️ **TypeScript hazard:** a concise
arrow body returns its expression, so `ref={node => map.set(k, node)}` returns the
**Map**, which React calls as a cleanup.

**07 `useImperativeHandle`** — returns **`undefined`**. Third arg is a real
dependency array; **omitting it rebuilds the handle every render**, breaking any
parent that cached `ref.current`. 🔴 **The pitfall is the point:** *"If you can
express something as a prop, you should not use a ref"*, with `Modal { open, close }`
named as the wrong answer. Test written for the page: **would you want it re-applied
on remount?** state yes, action no. **A good handle is verbs, not nodes.**

**08 When a ref is the wrong tool** — 🔴 the signature bug is **"it works but the UI
is stale"**: the handler reads the latest value correctly and only the *render* is
wrong. Worse than a plain failure because an unrelated state change makes the right
value appear, so it looks **intermittent**. Five misuses, one cause: a ref chosen to
*avoid* something (a re-render, a dependency, a double-run).

**09 `useState` vs `useReducer`** — 🔴 **they are equivalent and convertible**; the
docs list **personal preference** as a legitimate axis, and say to **mix and match,
even in one component**. The recommendation is **symptom-driven**: reach for a
reducer where update bugs actually happen. 🔴 **Reducers run DURING RENDERING**
(actions are queued until the next render) — the mechanical reason purity is
mandatory. **One action per user interaction**, and the test: *"If you log every
action … that log should be clear enough for you to reconstruct what interactions
happened in what order."*

**10 Reducer patterns** — 🔴 **React requires no action shape at all** (*"can be of
any type"*); the object-with-`type` is convention. react.dev's own names are
**past-tense** (`added_todo`), following from "describe what happened". Braces per
`case` (shared block scope). **Throw on unknown actions** — a returning `default`
makes a typo indistinguishable from a bail-out. `init` gives a **reusable reset
path**. Do not store derived values in the reducer. **Immer** is named in the recap.

**11 What context is and is not** — 🔴 the docs open with **two alternatives before
context**: pass props (*"makes it very clear which components use which data"*), and
**extract components passing JSX as `children`** — *"this often means that you
forgot to extract some components along the way."* Prop drilling is frequently a
**composition** problem. Use cases: theming, current account (**with nested
providers** — proof it is scoped, not global), routing, managing state. Context is
**not** global / storage / a re-render optimisation / a state manager — the decisive
missing feature is **selectors**.

**12 Context plus reducer** — **two contexts, not one object.** Move all wiring into
one file exporting `TasksProvider`, `useTasks`, `useTasksDispatch` — after which
**the contexts stop being part of the interface**. *"Your function is considered a
custom Hook if its name starts with `use`. This lets you use other Hooks, like
`useContext`, inside it."* **Many context-reducer pairs**, not one store.

**13 The default context value** — used **only when there is no provider**; static,
never changes, *"last resort"*. 🔴 A **plausible default converts a structural error
into a cosmetic one**, which is the worst trade because cosmetic errors ship. Docs
advise `null` when nothing is meaningful. ⚠️ **The guard hook is community
convention, not documented API** — the page says so. A real default is right when
rendering without a provider is a **supported use** (library component, locale
fallback, no-op analytics).

**14 `useId`** — for **accessibility attributes**. 🔴 Two prohibitions with one
root — **it describes a place, not a thing**: never for **list keys**, never for
**cache keys** (*"stable when a component is mounted but **may change during
rendering**"*). Requires an **identical tree on server and client**. One call,
suffixed per field. `identifierPrefix` for multiple apps on a page; must match
server↔client. ⚠️ **Could NOT confirm** the syllabus's "prefix changed in 19.2"
claim — the reference documents no format, so the page treats it as opaque and says
so.

**15 `useSyncExternalStore`** — the **reference** half; the *why* (tearing) is
Phase 4 · 16. `subscribe` must be **module scope or `useCallback`** — there is no
dependency array on the hook, so `useCallback` is **load-bearing, not an
optimisation**. `getSnapshot` must return the **same value while unchanged** and be
**immutable**, or infinite loop; for a mutable store the **caching belongs in the
store**, which is a hint this is library territory. **Omitting `getServerSnapshot`
makes server rendering throw.** Do not **suspend** on a store value.

**16 `useDebugValue`** — returns nothing, DevTools only. The **second argument
defers formatting** so expensive work runs only when inspected. 🔴 The bar is **two
conditions together**: *"part of shared libraries"* **and** *"complex internal data
structure that's difficult to inspect"* — which excludes almost every application
hook.

## Traps for the next phase

- 🔴 **A Python link walker is NOT sufficient.** It checks that target files exist;
  Docusaurus resolves differently and can still report broken links. **Run the
  build.** See [[devbible-react-phase5]] for the stale-`.docusaurus`-cache
  variant of this.
- **Converting a topic to a directory breaks inbound links** — grep for the old
  filename in **bodies**, not just footers. Topic 02 had one hiding mid-page.
- **Check what earlier phases already own before writing** — topics 06 and 15 were
  both largely covered by Phase 4, and rescoping them saved duplication.
