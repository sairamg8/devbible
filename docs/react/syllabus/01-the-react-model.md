---
title: "Part 1 — The React model"
sidebar_label: "1 · The React model"
sidebar_position: 1
---

> Phases 0–3 · 65 topics · How React runs, JSX, components, state and the render cycle

This is the part you cannot skim, and the part most courses rush through on the
way to `useEffect`. Every later phase is these four applied. If you can say
exactly what happens between calling `setCount` and the browser painting, the
rest of React stops being surprising.

---

## Phase 0 — How React runs

*17 topics.* The mental model everything else hangs off. Nothing here is a hook
and nothing here is JSX — this is the machine underneath both.

| Topic | Tier |
|---|---|
| **What React is** — a library that computes a *description* of the UI, plus a **renderer** that applies it. `react` (the core, no DOM in it) vs `react-dom` (the DOM renderer); why they are two packages and must be the same version | <span className="db-tier t-master">Master</span> |
| **Render → reconcile → commit** — the three phases. Render is pure and can be thrown away; commit touches the DOM and cannot be undone. Almost every React rule follows from this split | <span className="db-tier t-master">Master</span> |
| **Reconciliation and the diffing rules** — same element type reuses the node and its state, different type unmounts the whole subtree; the two assumptions that make the algorithm O(n) instead of O(n³) | <span className="db-tier t-master">Master</span> |
| **`StrictMode`** — double-renders components and double-mounts effects, **in development only**. It is a bug detector, not a bug, and switching it off is how you ship the bug | <span className="db-tier t-master">Master</span> |
| **The element** — `createElement`/JSX returns a plain immutable object (`type`, `props`, `key`, `ref`). Not a DOM node, not a component instance, and not something you should ever mutate | <span className="db-tier t-understand">Understand</span> |
| **Declarative vs imperative** — you describe the target UI for a given state; React computes the operations. What you give up (direct control) and what you get (no manual sync) | <span className="db-tier t-understand">Understand</span> |
| **Fiber** — the unit of work and the linked tree; why the render phase became interruptible, and what "work loop", "double buffering" and "alternate" mean when you see them in a stack trace | <span className="db-tier t-understand">Understand</span> |
| **`createRoot` and `root.render`** — the entry point. `ReactDOM.render` and `ReactDOM.hydrate` are **removed** in React 19, along with `unmountComponentAtNode` | <span className="db-tier t-understand">Understand</span> |
| **Release channels** — Latest, Canary, Experimental; why frameworks ship Canary and applications should not; how to read a version string like `19.3.0-canary-22e4f993-20260811` | <span className="db-tier t-understand">Understand</span> |
| **What React 19 changed** — `use`, Actions, `ref` as a prop, document metadata, resource preloading, `useActionState`/`useOptimistic`, better hydration errors — and the removals that break upgrades | <span className="db-tier t-understand">Understand</span> |
| **What React 19.2 added** — `<Activity>`, `useEffectEvent`, `cacheSignal`, Partial Pre-rendering (`resume`), `useId` prefix change, and Performance Tracks in Chrome DevTools | <span className="db-tier t-understand">Understand</span> |
| **Starting a React project in 2026** — Vite + `@vitejs/plugin-react` for an SPA, React Router framework mode, or Next.js. **Create React App is sunset**; `npx create-react-app` is not an answer | <span className="db-tier t-understand">Understand</span> |
| **The React Compiler exists** — build-time automatic memoization, stable at v1.0. Named here because it changes what "good React code" looks like; taught properly in Phase 6 | <span className="db-tier t-understand">Understand</span> |
| **React DevTools** — the component tree, props and hooks inspection, "highlight updates", the Profiler tab, and the 19.2 Performance Tracks in the browser's own performance panel | <span className="db-tier t-understand">Understand</span> |
| React on other renderers — React Native, `react-three-fiber`, Ink, custom reconcilers. The reason `react` itself contains no DOM code | <span className="db-tier t-know">Know</span> |
| Governance and cadence — the **React Foundation** under the Linux Foundation since Feb 2026, the RFC process, and how to read the changelog for an upgrade | <span className="db-tier t-know">Know</span> |
| React vs Vue, Svelte and Solid — the re-render model against fine-grained signals; what React trades away and what it buys | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain why changing a component's `type` in a
conditional throws away its state, but changing its props does not — without
using the word "virtual DOM".

---

## Phase 1 — JSX and what a component returns

*15 topics.* JSX is not a template language and not HTML. It is a syntax for one
function call, and every confusing thing about it follows from that.

| Topic | Tier |
|---|---|
| **Embedding expressions** — `{}` takes an *expression*, never a statement. What renders and what silently does not: `null`, `undefined`, `false` and `true` render nothing, `0` renders a zero | <span className="db-tier t-master">Master</span> |
| **Attributes vs props** — `className`, `htmlFor`, `tabIndex`; camelCased DOM properties; which attributes React renames, which it passes through, and how custom `data-*`/`aria-*` behave | <span className="db-tier t-master">Master</span> |
| **Conditional rendering** — ternary, `&&`, early `return null`, and lookup objects. The `&&` trap where `items.length && <List/>` renders a literal `0` on screen | <span className="db-tier t-master">Master</span> |
| **Lists and `key`** — what a key actually is (identity across renders, scoped to siblings), why index-as-key breaks inputs and animations on reorder, and where the key must be placed | <span className="db-tier t-master">Master</span> |
| **`children`** — the special prop, passing elements rather than data, multiple named slots, and `children` as a function | <span className="db-tier t-master">Master</span> |
| **Form elements in JSX** — `value`/`defaultValue`, `checked`/`defaultChecked`, `selected` on `<option>` vs `value` on `<select>`, and why React's `onChange` fires on every keystroke (it is the DOM's `input` event) | <span className="db-tier t-master">Master</span> |
| **JSX is a function call** — the automatic runtime (`jsx`, `jsxs`, `jsxDEV` from `react/jsx-runtime`), why `import React` is no longer required, and what your build tool actually emits | <span className="db-tier t-understand">Understand</span> |
| **Fragments** — `<>…</>` vs `<Fragment key={…}>`, and the one case the shorthand cannot cover | <span className="db-tier t-understand">Understand</span> |
| **Spreading props** — `{...props}`, prop forwarding, and the two costs: unreadable call sites and unknown attributes landing on DOM nodes | <span className="db-tier t-understand">Understand</span> |
| **Inline `style`** — the object form, camelCased properties, automatic `px`, and why it loses media queries, pseudo-classes and the cascade | <span className="db-tier t-understand">Understand</span> |
| **`dangerouslySetInnerHTML`** — the API, the XSS threat model, sanitizing before use, and the safer alternatives | <span className="db-tier t-understand">Understand</span> |
| **Capitalization decides everything** — `<button>` is a host element, `<Button>` is your component; the silent bug when a component name is lowercased | <span className="db-tier t-understand">Understand</span> |
| **What can be rendered** — strings, numbers, arrays, iterables, portals, elements; what throws ("Objects are not valid as a React child") and the three ways people hit it | <span className="db-tier t-understand">Understand</span> |
| Whitespace and text — how JSX collapses whitespace across lines, `{' '}`, entities, and multi-line text formatting | <span className="db-tier t-know">Know</span> |
| The classic runtime and `@jsxImportSource` — the pragma comment, and when you still meet the old `React.createElement` transform | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can hand-compile a small JSX tree into
`jsx()` calls, and say what a list renders after two items swap places with
index keys and with stable keys.

---

## Phase 2 — Components, props and composition

*16 topics.* Components are functions with rules. This phase is where the rules
come from and how you arrange components so that the later phases stay easy.

| Topic | Tier |
|---|---|
| **Function components** — a function of props returning UI. What makes something a component rather than a helper function, and why nesting a component definition inside another remounts everything | <span className="db-tier t-master">Master</span> |
| **Purity** — same props and state produce the same output; no side effects during render, no mutating props, state or module-level values. The rule `StrictMode` and the Compiler both check | <span className="db-tier t-master">Master</span> |
| **Composition over configuration** — passing elements as props instead of growing a twelve-boolean API; the `slots` pattern and when a component should just take `children` | <span className="db-tier t-master">Master</span> |
| **Controlled vs uncontrolled components** — who owns the value, when each is right, and the "changing an uncontrolled input to be controlled" warning and its cause | <span className="db-tier t-master">Master</span> |
| **Lifting state up** — the mechanical procedure, the single source of truth, and its real cost: everything under the new owner re-renders | <span className="db-tier t-master">Master</span> |
| **Props are read-only** — one-way data flow, why mutating a prop object appears to work and then does not, and passing callbacks down instead | <span className="db-tier t-understand">Understand</span> |
| **Destructuring and default values** — default parameters replacing `defaultProps`, which is **removed for function components** in React 19; `propTypes` is removed too | <span className="db-tier t-understand">Understand</span> |
| **Children patterns** — layout and wrapper components, compound components sharing state through context, and the `children`-as-a-function escape hatch | <span className="db-tier t-understand">Understand</span> |
| **`ref` as a prop (React 19)** — `forwardRef` is no longer required; the deprecation path, the codemod, and what still needs `forwardRef` in a library | <span className="db-tier t-understand">Understand</span> |
| **Component boundaries** — when splitting helps, when it hides the flow, and colocation: keep a component next to the only thing that uses it | <span className="db-tier t-understand">Understand</span> |
| **Portals** — `createPortal` renders into a different DOM node while staying in the React tree; events bubble through the *React* tree, which is what makes modals work | <span className="db-tier t-understand">Understand</span> |
| Render props and function-as-children — the pre-hooks sharing pattern, where it is still the right answer, and where a custom hook wins | <span className="db-tier t-know">Know</span> |
| Higher-order components — the pattern, its failure modes (prop collisions, lost refs, unreadable stacks), and why hooks replaced almost all of it | <span className="db-tier t-know">Know</span> |
| Class components — `render`, the lifecycle methods, `this` binding, and the hook each one maps to. The two with **no** hook equivalent: `getDerivedStateFromError` and `componentDidCatch` | <span className="db-tier t-know">Know</span> |
| `Component` vs `PureComponent` and `shouldComponentUpdate` — the class ancestry of `memo`, and reading them in code you inherit | <span className="db-tier t-know">Know</span> |
| `cloneElement`, `Children.map` and `isValidElement` — the legacy element-manipulation API, why it is fragile, and the context-based replacement | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a `<Dialog>` that renders through a portal, takes its
header and footer as element props, closes on `Escape` and on backdrop click,
and works whether the caller controls `open` or lets it manage itself.

---

## Phase 3 — State and the render cycle

*17 topics.* The phase that decides whether React makes sense to you. Every
"why didn't it update", every stale value, every infinite loop is here.

| Topic | Tier |
|---|---|
| **`useState`** — the pair, the initializer, and the fact that state belongs to a *position in the tree*, not to a variable | <span className="db-tier t-master">Master</span> |
| **State is a snapshot** — the value in a given render is frozen for that render. This is the whole explanation for stale closures, and it is not a bug | <span className="db-tier t-master">Master</span> |
| **Updater functions** — `setCount(c => c + 1)`; exactly when the updater form is *required* rather than stylistic, and what the queue does with a mix of values and updaters | <span className="db-tier t-master">Master</span> |
| **Automatic batching** — multiple `setState` calls become one render, including inside promises, timeouts and native event handlers since React 18; `flushSync` as the deliberate escape | <span className="db-tier t-master">Master</span> |
| **Immutable updates** — objects, nested objects and arrays; the six mutating array methods and their non-mutating equivalents; `structuredClone`, spread depth, and Immer as the pragmatic answer | <span className="db-tier t-master">Master</span> |
| **Derived state** — compute during render instead of storing a second copy. The `useEffect`-to-sync-state antipattern and what it costs (an extra render and a moment of wrong UI) | <span className="db-tier t-master">Master</span> |
| **Resetting state with `key`** — the idiomatic remount when the identity of the thing being edited changes, versus the "adjust state while rendering" alternative | <span className="db-tier t-master">Master</span> |
| **What triggers a re-render** — a state update, a parent re-render, or a context value change. And what does *not*: mutating an object, writing to a ref, or a prop "changing" without a render | <span className="db-tier t-master">Master</span> |
| **Lazy initial state** — `useState(() => parse(localStorage.x))` versus `useState(parse(localStorage.x))`, which runs on every single render | <span className="db-tier t-understand">Understand</span> |
| **Structuring state** — group what changes together, avoid contradictory flags, avoid redundancy, avoid duplication, avoid deep nesting. Five rules that remove most state bugs before they exist | <span className="db-tier t-understand">Understand</span> |
| **Bailing out** — `Object.is` comparison, why setting the same value can still cost one render, and why React sometimes renders children anyway | <span className="db-tier t-understand">Understand</span> |
| **Render order** — parents before children, top-down; why "the parent re-rendered" is the most common answer to "why did this render" | <span className="db-tier t-understand">Understand</span> |
| **The update queue** — how React processes several `setState` calls from one event, and how to predict the final value on paper | <span className="db-tier t-understand">Understand</span> |
| **State in lists** — how position and `key` together decide which instance keeps which state when items are added, removed or reordered | <span className="db-tier t-understand">Understand</span> |
| **Preserving and resetting state across the tree** — same component at the same position keeps state; the conditional render that silently remounts a subtree and wipes it | <span className="db-tier t-understand">Understand</span> |
| **Updating state during render** — the legitimate narrow case (adjusting state when a prop changes), and the "Cannot update a component while rendering a different component" error when you get it wrong | <span className="db-tier t-understand">Understand</span> |
| **Infinite render loops** — the three shapes: setting state unconditionally during render, an effect that sets its own dependency, and a new object identity in a dependency array. Reading "Maximum update depth exceeded" | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can predict, on paper, the exact sequence of
renders and the final state for a handler that calls `setCount(count + 1)`
three times, then the same handler using the updater form — and explain the
difference without running it.

---

## Where this connects

- **Phase 0 → Phase 8** — "a render can be thrown away" is stated here and
  becomes the whole point once rendering is concurrent.
- **Phase 1 → Phase 9** — controlled inputs are introduced here as JSX
  mechanics and become form architecture once Actions exist.
- **Phase 2 → Phase 10** — composition (passing elements as props) is a style
  choice in a client app and a hard requirement for keeping Server Components
  out of the client bundle.
- **Phase 3 → Phase 4** — most `useEffect` misuse is a misunderstanding of this
  phase. Do not go on until the gate is clear.
- **Phase 3 → Phase 6** — "what triggers a re-render" is the question
  memoization answers. Optimising before you can answer it is guesswork.
- **Deliberately not here:** closures, `this`, prototypes and the event loop.
  Those are the **JavaScript** syllabus, and this one assumes them. Typing props
  and hooks is **TypeScript** Phase 8.

---

← Index: [React](../README.md) · Next → [Part 2 — Hooks, completely](02-hooks.md)
