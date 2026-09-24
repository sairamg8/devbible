---
name: devbible-react-concepts-phase2
description: React Phase 2 concept record — every load-bearing claim on the 16 topics, with its source, so a later session can review or reuse without re-reading the pages
metadata:
  type: reference
---

**Concept record for React Phase 2 (Components, props and composition).** Written
2026-08-13 at the user's instruction: *"save all the concepts per phase or earlier since
lot of sessions active"*. Progress and traps: [[devbible-react-phase2]]. Validation
state: [[devbible-react-validation-status]].

**All doc-validated, no sandbox.** Sources are react.dev unless noted.

## 01 Function components (Master, 2 chunks)

- A component is **a function React calls**, not one you call. That ownership is what
  lets React attach state, effects, a tree position and an identity.
- Definition (*Your First Component*): capital letter + returns JSX. The capital letter is
  a **JSX compilation rule** — lowercase emits a string tag and the component never runs,
  silently.
- **`<Widget />` ≠ `Widget()`.** The call form inlines the result into the caller's
  render: no own state, no DevTools entry, no memo boundary, cannot suspend
  independently, and its **hooks join the caller's hook list** — so a conditional call
  breaks hook order.
- Props are **one argument**. `ref` joined that object in React 19.
- **Nesting rule:** *"you must never nest their definitions"* / *"Always declare component
  functions at the top level"*. Mechanism is reconciliation comparing element `type` by
  reference; a new function object per render = different type at the same position =
  full unmount/mount.
- 🔴 **The nesting rule is really reconciliation-by-type.** Four disguises: an arrow in a
  local variable, **a HOC applied in render**, **`lazy()` called in render**, **`memo()`
  called in render**. Picking a component out of an object map is **safe** — React
  compares the type that came out, not the map.
- Remount destroys: state, refs, effect cleanups run, DOM nodes recreated, focus, scroll,
  CSS animations, uncontrolled input values — recursively.
- No warning exists for this. Detect with DevTools (mount not update),
  `eslint-plugin-react`'s `no-unstable-nested-components` (not in recommended set), or the
  symptom test: state resetting when an *unrelated* sibling updates.
- Deliberate remount = `key`: *"Specifying a `key` tells React to use the `key` itself as
  part of the position"*.

## 02 Purity (Master, **3 chunks** — the re-split)

- Two rules verbatim: **"It minds its own business"** (no changes to objects/variables
  that existed before the call) and **"Same inputs, same output"**. Plus *"React assumes
  that every component you write is a pure function."*
- **Inputs = props, state, context. Nothing else.**
- Rule-1 violations: mutating a prop, mutating state directly, writing a module-level
  variable (react.dev's `<Cup />` example gives guests **2, 4, 6** under StrictMode), and
  **writing to a ref during render** (a ref predates the render).
- Rule-2 violations and their homes: `Date`/`Math.random` → handler or effect;
  `window`/media queries → **`useSyncExternalStore`**; `localStorage` → lazy initial
  state; module singleton → `useSyncExternalStore` or context; DOM → an effect.
- **Local mutation is explicitly allowed**: *"it's completely fine to change variables and
  objects that you've just created while rendering"* — *"your component's little secret"*.
  Test: **did this object exist before the render started?**
- Side effects: *"side effects usually belong inside event handlers"*, `useEffect` only
  *"If you've exhausted all other options"*. **Handler first, effect as fallback.**
- Three tiers of consequence: StrictMode doubling today → memoization/`Activity`/
  prerendering/Compiler on your next upgrade → **an abandoned concurrent render whose
  side effect already happened** and cannot be undone.
- StrictMode double-invokes: component body, `useState` initialiser, `useMemo`,
  `useCallback`, reducers, `setState` updaters, class `constructor`/`render`/`sCU`.
- 🔴 **What StrictMode cannot catch**: production-only paths, branches that did not run,
  **idempotent impurity**, event handlers, effects after the first mount. A clean dev run
  is weak evidence.
- **The Compiler is the stricter checker because it is static** — it bails out on
  components it cannot prove pure, so the skipped list is a purity report covering code
  that never ran. Its lint rules ship in `eslint-plugin-react-hooks`.

## 03 Composition over configuration (Master, 2 chunks)

- Four costs of the configuration ratchet: the API can only grow; combinations multiply
  untested; the component imports everything any caller might need; the markup is hidden
  from whoever wants to change it.
- Rule: **a prop that exists only to be rendered should have been the rendered thing.**
- Elements are plain objects; **creating one does not render it**, so passing a possibly
  unused element is nearly free. **Where an element is created decides what it can see** —
  the mechanism behind the context hole.
- Keep configuration when the value is data, the decision belongs to the component, the
  variant set is deliberately closed, or consistency is the point.
- Three slot forms: `children` (*"a 'hole' that can be 'filled in'"*), named element props
  (community name "slots"; **no React API**), compound components + context.
- React 19: render `<Context value={…}>` directly; `<Context.Provider>` still works.
- 🔴 **Composition beats prop drilling** because the element is created in the scope that
  has the value. react.dev says try it **before** context.
- 🔴 **In RSC it is not a style choice**: a Client Component cannot *import* a Server
  Component but can *receive* one as `children`.
- **A wrapper does not re-render its `children`** — the element object is unchanged. Free
  memoization, and a real performance technique.

## 04 Controlled vs uncontrolled (Master, 2 chunks)

- General definition (*Sharing State Between Components*): uncontrolled = the important
  info is local state; controlled = it is driven by props. Docs stress these **aren't
  strict technical terms** and components mix both — **ask per piece of state**.
- Trade verbatim: uncontrolled are *"easier to use… but they're less flexible when you
  want to coordinate them"*; controlled are *"maximally flexible, but they require the
  parent components to fully configure them"*.
- Five triggers to control: coordination, persistence, validation/transformation,
  programmatic control, reflecting external data.
- 🔴 **React decides the mode by `value === undefined` on the first render, and it may
  never change.** `value=""` and `value={0}` are **controlled**. `null` is treated as no
  value and warns.
- Four causes of the switch warning: state initialised from data that has not arrived, a
  missing object key, **a nullable API column**, deliberate toggling.
- Fix: `value={x ?? ''}`. **`??` not `||`** — `||` eats a legitimate `0`.
- Reverse direction: clear fields to `''`, never `undefined`.
- **Dual-mode pattern** (the phase gate): decide with `!== undefined`; keep internal state
  for the uncontrolled case; **only set internal state when uncontrolled**; **always call
  the callback**; **never sync the prop into state with an effect**.

## 05 Lifting state up (Master, 2 chunks)

- Three steps: **remove** state from children, **pass hardcoded data**, **add** state +
  handlers. Step 2 separates "is data flowing" from "is state updating".
- Lifting usually **improves the state shape** — two booleans became one active index, so
  "two panels open" is unrepresentable.
- Owner-finding (*Thinking in React*): every component that **renders something based on**
  it → closest common parent → or higher → or **invent a component just to own it** (the
  forgotten third bullet).
- **Single source of truth = one owner per piece**, not all state in one place.
- Pass **handlers, not setters**, more than a level or two down — a setter leaks the
  owner's state shape into the leaf.
- Not for: derivable values, single-consumer values (**push state down**), or values many
  components at many depths need (composition, then context).
- 🔴 **The cost: the re-render moves up with the state.** Four fixes cheapest-first:
  (1) own it at the right level / push down, (2) **pass the expensive subtree as
  `children`**, (3) split state or split components by update frequency, (4) `memo` last.
- Fixes 1–3 survive the React Compiler; hand-memoization largely does not.
- Server data is **a cache, not lifted UI state**.

## 06 Props are read-only (Understand)

- *"props are immutable"*; a component must *"ask" its parent* for different ones. **New
  object every render** — the mutated one is discarded anyway.
- **Read-only by contract, not enforcement.** React does not freeze props.
- Reassigning a destructured parameter is **not** a violation — it is a local binding.
- Five delayed failures: parent re-render discards it; a sibling that rendered first reads
  `undefined`; a memoized ancestor skips the render that performed the mutation;
  StrictMode doubles it; an abandoned concurrent render already did it.
- Unsafe array methods: `sort`, `reverse`, `splice`, `push`, `pop`, `shift`, `unshift`,
  `fill`. **`sort` is the trap — it reads like a query.** ES2023: `toSorted`,
  `toReversed`, `toSpliced`, `with`.
- One-way data flow buys **a working debugging technique**: only the owner can have
  changed it.

## 07 Destructuring and defaults (Understand)

- 🔴 **`propTypes` removed and *silently ignored*** in 19 — *"using them will be silently
  ignored"*. Codemod `npx codemod@latest react/prop-types-typescript`.
- **`defaultProps` removed for function components, KEPT for classes** — *"since there is
  no ES6 alternative"*. No codemod listed for it; grep `.defaultProps` before upgrading.
- Default parameters fire **only on `undefined`** — *"if you pass `size={null}` or
  `size={0}`, the default will not be used"*.
- `...rest` is what makes a design-system wrapper transparent; naming a prop explicitly is
  what keeps it out of the DOM.
- Spread warning: *"Use spread syntax with restraint. If you're using it in every other
  component, something is wrong."*
- Nested destructuring: one level max; deeper → optional chaining in the body.

## 08 Children patterns (Understand)

- Four patterns: **wrapper**, **layout with named regions**, **compound + context**,
  **children-as-a-function**. Fifth answer that is not a children pattern at all: **a
  custom hook** — check this first.
- Compound components need: **throw from the context hook** when used outside;
  **`useMemo` the context value**; export the parts together.
- Function-as-children survives where the component controls **placement**, where values
  are **per-item**, or where the render must be **scoped to a boundary**.
- Do not slice `children` positionally — a fragment, a conditional or a `.map()` moves the
  indices.

## 09 `ref` as a prop (Understand)

- React 19: *"you can now access `ref` as a prop for function components"*.
- 🔴 **`forwardRef` is NOT removed.** Its page says *"no longer necessary… will be
  deprecated in a future release"*. Commonly overstated.
- Why `ref` was special: it was stripped from props like `key`, and a class ref meant the
  instance. Hence *"Function components cannot be given refs"* and the legacy HOC caveat
  *"Ref is not really a prop"*.
- **Ref cleanup functions** (new in 19): a ref callback may return a cleanup. Migration
  hazard is the **implicit arrow return** — `ref={el => (x = el)}` must gain braces.
  Codemod `no-implicit-ref-callback-return`; TS side is `scoped-jsx` in the `react-19`
  preset.
- Also removed in 19: **string refs** (`react/19/replace-string-ref`) and **`findDOMNode`**
  — *"slow to execute, fragile to refactoring, only returned the first child, and broke
  abstraction levels"*.
- ⚠️ **Flagged as reasoning, not citation:** what still needs `forwardRef`. Docs name no
  use case; the page argues React 18 support and says so.

## 10 Component boundaries (Understand)

- *Thinking in React*'s three criteria — programming/separation of concerns, CSS
  (*"components are a bit less granular"* — the skipped parenthesis), design layers.
- Five justifications: second caller, owns state nothing above needs, different update
  frequency, different data source, server/client boundary.
- Three costs: hides the flow, manufactures a props contract, invites premature
  generality. **Length is not a reason.**
- Test before extracting: **count the props.** >5, all local variables → wrong split.
- ⚠️ **Colocation is community practice, labelled as such on the page.** Location
  communicates scope; colocated code dies with its feature.
- Multiple components per file is explicitly fine; **module top level is the hard rule.**

## 11 Portals (Understand)

- `createPortal(children, domNode, key?)`; *"The node must already exist."*
- *"A portal only changes the physical placement of the DOM node."* Events, context, error
  boundaries, Suspense, state and unmounting all follow the **React tree**.
- *"Events from portals propagate according to the React tree rather than the DOM tree."*
- The problem solved is **CSS**: `overflow: hidden`, and stacking contexts from
  `transform`/`filter`/`opacity`/`will-change`/`contain`/`position`+`z-index`.
- Modern alternative: **native top layer** — `<dialog showModal()>` and popover — which
  also brings focus trapping and `Escape` free.
- 🔴 Accessibility is a **Pitfall** in the docs: focus in, trapped, restored, `Escape`,
  background inert. Points at **WAI-ARIA Modal Authoring Practices**.
- Asymmetry: **React events follow the React tree, native listeners follow the DOM** —
  which is why click-outside logic must compare against the portal's node.
- Client-only; no DOM on the server.

## 12 Render props (Know)

- *"A render prop is a function prop that a component uses to know what to render."* The
  prop need not be named `render` — `children` reads better.
- Hooks won on: no extra tree nodes, values usable anywhere, **linear composition vs
  wrapper hell**, passing values between them, DevTools, TS inference.
- Still right for: **component controls placement** (virtualisation), **per-item values**,
  **render scoped to a boundary**.
- Legacy caveat: an inline render prop **negates `PureComponent`** — *"the shallow prop
  comparison will always return `false`"*. Modern equivalent: `memo` + inline arrow →
  `useCallback`, but only if the child is actually memoized.
- Met today in: `react-window`, charting responsive containers, Formik `<Field>`,
  `react-hook-form` `<Controller>`, headless UI kits.

## 13 Higher-order components (Know)

- *"a function that takes a component and returns a new component"*.
- Caveat 1 — **never apply in render**: a new enhanced component per render → remount,
  total state loss. Same bug as the nesting rule.
- Caveat 2 — **statics not copied**; `hoist-non-react-statics`.
- Caveat 3 — **refs not passed through** (*"Ref is not really a prop"*) → 🔴 **fixed in
  React 19** for function components, since a spread now carries the ref. Still applies on
  18, and for a class's instance ref.
- Why hooks won: **silent, order-dependent prop collisions** and unreadable wrapper
  stacks.
- Survives where behaviour goes *around* a component: `memo`, `forwardRef`, **error
  boundaries** (must be classes), instrumentation, injecting Suspense/Activity, legacy
  `connect()`.
- Always set `displayName`.

## 14 Class components (Know, 2 chunks)

- *"still supported by React, but we don't recommend using them in new code."*
- 🔴 **`setState` merges; `useState` replaces** — the classic conversion bug. Also takes an
  after-update callback, which `useState` has no equivalent for.
- `this` binding: extracted method loses its receiver; class bodies are strict mode so
  `this` is `undefined`. Fixes: class-field arrow (modern), constructor bind, call-site
  arrow (**defeats memoization**).
- One context per class via `static contextType`.
- Conversion order; 🔴 **instance fields → `useRef`, not `useState`** (the missed step).
- Lifecycle → hook table; the three collapse into **one** effect.
- `getSnapshotBeforeUpdate` has **no exact equivalent** — `useLayoutEffect` runs after the
  DOM mutation.
- 🔴 **`getDerivedStateFromError` + `componentDidCatch` have no hook equivalent**:
  *"There is currently no way to write an Error Boundary as a function component."*
  Static one is render-phase and must be pure; instance one is commit-phase and gets the
  component stack.
- Boundaries do **not** catch: event handlers, async, SSR, or errors in the boundary
  itself. React 19 added root `onUncaughtError` / `onCaughtError`.
- `UNSAFE_` methods run before commit — unsafe under concurrent rendering.
  `rename-unsafe-lifecycles` codemod.
- Code that **no longer runs on 19**: `this.refs.x`, `contextTypes`/`getChildContext`.

## 15 `Component` vs `PureComponent` (Know)

- `PureComponent` = a `shouldComponentUpdate` that shallowly compares props **and state**.
- Fails whenever a prop is a new object/array/inline function — **you pay the comparison
  and skip nothing**.
- 🔴 **Mutation + `PureComponent` = silently dropped update.** Wrong UI, not slow UI.
- *"your component will still re-render if a context that it's using changes"* — true of
  `memo` too.
- 🔴 *"Returning `false` does not guarantee that the component will not re-render. React
  will use the return value as a hint."* **Memoization is never a correctness mechanism.**
- Docs advise against deep compares / `JSON.stringify` — *"makes performance unpredictable
  and dependent on the data structure of every prop and state"*.
- **`memo` does not compare state**, because `useState` already bails out on an equal
  value.

## 16 `cloneElement` / `Children` / `isValidElement` (Know)

- Neither is deprecated; both say *"uncommon and can lead to fragile code"*.
- `cloneElement` pitfalls: cloning does not modify the original; static vs dynamic
  children argument forms exist so **key warnings still work**; it makes data flow
  untraceable.
- 🔴 Two structural failures: **only reaches direct children** (wrap a part in anything and
  the prop lands on the wrapper), and **`children` is not rendered output** — *"There is no
  way to get the rendered output of an inner component"*.
- `Children` caveats: empty nodes/strings/numbers/elements each count as one; **arrays do
  not count but their children do**; traversal does not go deeper than elements;
  🔴 **fragments are not traversed** — so `<><A/><B/></>` is **one** child.
- `Children.toArray` **rewrites keys** from original key + nesting level + position, so a
  flatten cannot collide keys. `Children.map` combines returned keys with the original's.
- `isValidElement` is narrow — strings, numbers and arrays are renderable but return
  `false`.
- Documented alternatives: expose multiple components, accept an array of objects,
  **render props** (*"explicitly traces where values come from"*), **context**, custom
  hooks.
