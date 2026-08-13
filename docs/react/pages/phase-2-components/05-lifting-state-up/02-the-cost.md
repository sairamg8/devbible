---
title: "The cost, and how to pay less of it"
sidebar_label: "02 · The cost"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Render and Commit](https://react.dev/learn/render-and-commit),
> [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context)
> and [`memo`](https://react.dev/reference/react/memo). No sandbox script backs
> this page; claims are cited, not measured. Phase 6 carries the performance
> treatment; this page is about the structural consequence.

**Lifting state moves the re-render with it. The state now belongs to a
component higher up, so updating it re-renders that component and — by default
— everything beneath it, including the nine tenths of the tree that does not
care.**

## What actually re-renders

React's model is simple and worth being exact about, because the fix depends on
it: when a component's state changes, React re-renders **that component and all
of its descendants**, unless something stops the descent.

It does *not* re-render because a prop "changed" — a child re-renders because
its parent did. Prop comparison is not part of the default path at all; that is
what `memo` adds.

So lifting a search query from `<SearchBar>` to `<ProductPage>` changes the blast
radius from one input to the entire page. The value is the same, the component
using it is the same, and the work per keystroke has gone up by whatever else
`<ProductPage>` renders.

This is not an argument against lifting — coordination requires it. It is an
argument for lifting *precisely*, and for knowing the four ways to narrow the
damage afterwards.

## Fix 1: own the state at the right level

The most effective fix is not an optimisation. It is not lifting further than
the procedure requires.

```jsx
// 🔴 the query lives at the root "so anything can use it"
function App() {
  const [query, setQuery] = useState('');
  return <Layout><Sidebar /><ProductPage query={query} onQuery={setQuery} /></Layout>;
}

// ✅ the closest common parent of the two components that use it
function ProductPage() {
  const [query, setQuery] = useState('');
  return <><SearchBar value={query} onChange={setQuery} /><Table query={query} /></>;
}
```

"Closest common parent" in the procedure is a performance instruction as much as
a correctness one. Every level higher than necessary adds a subtree to each
update.

The mirror operation is worth naming because it is under-used: **pushing state
down.** If a piece of state is read by one branch of a large component, extract
that branch into a child and move the state into it. The large component stops
re-rendering entirely.

## Fix 2: pass the expensive subtree as `children`

The cheapest optimisation in React, and it is not an optimisation API at all —
it is reconciliation working as designed.

```jsx
// 🔴 Everything inside Layout re-renders when `open` changes
function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Sidebar open={open} onToggle={() => setOpen(!open)} />
      <ExpensiveDashboard />       {/* re-created every toggle */}
    </div>
  );
}
```

```jsx
// ✅ The dashboard element is created by App, and Layout only passes it through
function Layout({children}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Sidebar open={open} onToggle={() => setOpen(!open)} />
      {children}
    </div>
  );
}

function App() {
  return <Layout><ExpensiveDashboard /></Layout>;
}
```

Why it works: when `Layout` re-renders, `props.children` is **the same element
object** it was before — `App` did not re-render, so it did not create a new
one. React compares the element, finds it identical, and skips the subtree. No
`memo`, no dependency array, no comparison function.

This is the structural version of the same insight as the
[context hole](../03-composition/02-slots-and-children.md): where an element is
*created* decides what re-renders it. Moving state into a wrapper that receives
its content is often a better answer than memoizing that content.

## Fix 3: split the state, or split the component

If one owner holds several unrelated pieces of state, every consumer pays for
every update. Two separations help:

**Split the state by consumer.** A form holding `{values, errors, isSubmitting}`
in one object re-renders everything on every keystroke. Three pieces of state,
or a reducer with a narrower dispatch, limits what each change touches.

**Split the component by update frequency.** Put the fast-changing state in a
small component that owns it, and leave the slow-changing structure above.

```jsx
// The whole table re-rendered on every keystroke
function Table({rows}) {
  const [hoveredId, setHoveredId] = useState(null);
  …
}

// ✅ Hover state lives in the row that has it
function Row({row}) {
  const [hovered, setHovered] = useState(false);
  …
}
```

## Fix 4: memoize — last, and knowingly

`memo` makes a component compare its props and skip the render when they are
shallow-equal. It is the tool people reach for first and it should be the tool
they reach for last, for three reasons:

- **It is not free.** Every render pays a shallow comparison of every prop.
- **It fails silently on object and function props.** A new `{}` or a new arrow
  each render makes every comparison `false`, so you pay the comparison and
  never skip anything. Fixing that means `useMemo`/`useCallback` on every such
  prop, which is where the memoization tax compounds.
- **It does not stop context updates.** A memoized component still re-renders
  when a context it consumes changes.

And the reason it may be moot: the **React Compiler** memoizes automatically,
correctly, and at a finer grain than hand-written `memo` — provided the
components are pure. In a compiled codebase most manual memoization is
redundant. Phase 6 covers both properly; the point here is that structural fixes
1–3 survive the Compiler and hand-memoization largely does not.

## Lifting versus context versus a store

At some size, lifting stops being the right shape. The signals are concrete:

| Signal | Better tool |
|---|---|
| Two or three components, one common parent | **Lift** |
| The value threads through layers that ignore it | **Composition** — pass elements, remove the layers |
| Many consumers, many depths, changes rarely (theme, user, locale) | **Context** |
| Many consumers, changes often, consumers need slices | **An external store** with `useSyncExternalStore`, or a state library |
| The value is server data | **A data library** — it is a cache, not UI state |

The last row is the one most often got wrong. Server data lifted into `useState`
at the top of the app becomes a hand-written cache with no invalidation, no
deduplication and no staleness policy — the problem Phase 12 exists to address.

react.dev's ordering is worth keeping: props first, composition next, context
when props become unwieldy. Skipping to a global store because lifting felt
tedious usually trades a small structural problem for a large architectural one.

## Gotchas

**Symptom:** typing in one field re-renders the entire page.
**Cause:** the field's value was lifted to a component that renders far more
than the two things that use it.
**Fix:** move the owner down to the closest common parent; if the value truly is
needed at the top, isolate the fast-changing part into its own component.

**Symptom:** `memo` was added and nothing got faster.
**Cause:** an object, array or inline function prop is recreated every render,
so the shallow comparison always fails.
**Fix:** stabilise those props, or — usually better — restructure with
`children` so there is nothing to compare.

**Symptom:** a memoized component still re-renders on every update.
**Cause:** it consumes a context whose value is a new object each render.
**Fix:** memoize the context value, or split the context. `memo` cannot stop a
context update.

**Symptom:** lifting fixed the bug and made the app feel slow.
**Cause:** correct fix, wrong altitude — or the subtree below the new owner is
expensive.
**Fix:** keep the lift, then apply fix 2. Passing the expensive subtree as
`children` costs nothing and usually removes the regression entirely.

**Symptom:** state was lifted to the root and now every feature imports from
one file.
**Cause:** lifting used as a substitute for structure.
**Fix:** context for cross-cutting values, a data library for server data, and
local state for everything else. A single root state object is not a single
source of truth — it is one owner for pieces that should have had ten.

## Interview questions

**★ What does lifting state up cost?**
The re-render moves up with the state. React re-renders the component whose
state changed and its whole subtree by default, so a value that used to affect
one input now affects everything under its new owner. That is why "closest
common parent" is a performance instruction as well as a correctness one.

**★ How do you stop a subtree re-rendering without `memo`?**
Pass it as `children` to the component that owns the changing state. The element
was created by the outer component, so when the stateful wrapper re-renders,
`props.children` is the identical object and React skips that subtree. It is
ordinary reconciliation, costs nothing, and needs no dependency arrays.

**★ Why is `memo` the last resort rather than the first?**
It costs a shallow comparison on every render, it fails silently whenever a
prop is a fresh object or inline function, and it does not stop context-driven
re-renders. Structural fixes — owning state at the right level, passing children,
splitting components — are cheaper and survive the React Compiler, which
memoizes automatically and more finely than hand-written `memo`.

**When should lifting give way to context?**
When the value passes through layers that do not use it, and there are many
consumers at many depths. Try composition first — passing elements often removes
the intermediate layers entirely — and use context for genuinely cross-cutting
values that change rarely, like theme, locale or the current user.

**What is pushing state down?**
The mirror of lifting: if state is read by only one branch of a large component,
extract that branch and move the state into it. The large component stops
re-rendering. It is usually the cheapest available performance fix and it makes
the code clearer at the same time.

**Why is server data a poor fit for lifted `useState`?**
Because it is a cache, not UI state. Lifting it to the top means hand-rolling
invalidation, deduplication, staleness and refetch-on-focus — everything a data
library provides. The state you lift should be state the UI owns.

---

← Prev: [The procedure](01-the-procedure.md) ·
Index: [Lifting state up](README.md) ·
Next → [Props are read-only](../06-props-are-read-only.md)
