---
title: "Moving state down and lifting content up"
sidebar_label: "13 · Moving state down"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useMemo`](https://react.dev/reference/react/useMemo),
> [`useCallback`](https://react.dev/reference/react/useCallback) and
> [`memo`](https://react.dev/reference/react/memo) (which all carry the same
> "principles that make memoization unnecessary" list), and
> [Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component)
> (§ Passing JSX as children).
> No sandbox script backs this page; claims are cited, not measured.

**The two structural fixes. They are the first two principles on react.dev's own
list of things that make memoization unnecessary, they cost nothing to maintain,
and the React Compiler does not do either of them.**

## The problem both solve

```jsx
function App() {
  const [text, setText] = useState('');
  return (
    <div>
      <input value={text} onChange={e => setText(e.target.value)} />
      <ExpensiveTree />
    </div>
  );
}
```

Every keystroke re-renders `App`, and therefore `ExpensiveTree` — which takes no
props and depends on nothing that changed.

The memoization answer is `memo(ExpensiveTree)`, and it works. But it is a cache
you now maintain: add one prop later and it may stop working silently
([topic 06](06-the-memoization-trap.md)).

## Fix 1 — move state down

> **Prefer local state and don't lift state up any further than necessary.** For
> example, don't keep transient state like **forms and whether an item is hovered**
> at the top of your tree or in a global state library.

```jsx
function SearchInput() {
  const [text, setText] = useState('');
  return <input value={text} onChange={e => setText(e.target.value)} />;
}

function App() {
  return (
    <div>
      <SearchInput />
      <ExpensiveTree />
    </div>
  );
}
```

`App` no longer has state, so a keystroke re-renders only `SearchInput`.
`ExpensiveTree` is not skipped by a comparison — **it is never asked to render**.

The two are not equivalent. `memo` means "render the parent, then check whether the
child's props changed, then skip". Moving state down means the parent does not
re-render, so there is nothing to check. Fewer moving parts, and it is enforced by
where the `useState` call physically is.

**The named candidates:** form field values, hover and focus, whether a dropdown is
open, a local filter, an editing flag. These get lifted because it is easy, and each
one converts a local update into a whole-tree re-render.

## Fix 2 — lift content up (`children`)

Moving state down needs a component you can extract. When the state genuinely
belongs where it is — a layout that owns a sidebar toggle, say — invert the other
way:

> When a component **visually wraps other components, let it accept JSX as
> children.** This way, when the wrapper component updates its own state, **React
> knows that its children don't need to re-render.**

```jsx
function Layout({ children }) {
  const [text, setText] = useState('');
  return (
    <div>
      <input value={text} onChange={e => setText(e.target.value)} />
      {children}
    </div>
  );
}

<Layout><ExpensiveTree /></Layout>
```

The `<ExpensiveTree />` element is now created **where it is passed from**, not
inside `Layout`. `Layout`'s state changing produces the same `children` value, so
React reuses the existing element and does not re-render it.

**Why this works is worth being precise about**, because it looks like magic: React
skips re-rendering a child when the element is *identical* to the previous one.
`children` arriving as a prop from a parent that did not re-render is exactly that
— the same element object. Nothing is being compared cleverly; the element simply
did not change.

## Which one, when

| Situation | Fix |
|---|---|
| State is used by one small part of the tree | **move it down** |
| State genuinely belongs to a wrapper (layout, modal, tabs) | **`children`** |
| Expensive subtree, state must stay where it is, cannot restructure | `memo` |
| The subtree re-renders because of context | neither — [split the context](../phase-5-refs-context-reducers/05-context-re-render-problem.md) |
| Several commits per interaction | neither — [an effect chain](../phase-4-effects/06-you-might-not-need-an-effect/02-chains-of-effects.md) |

Try them in that order. `memo` is third for a reason.

## Why structural beats memoized

| | Move state down / `children` | `memo` + stable props |
|---|---|---|
| Maintained by | where the code lives | you, forever |
| Broken by | restructuring, visibly | one new inline prop, **silently** |
| Needs measurement to confirm | no | yes ([05](05-measure-before-you-optimise.md)) |
| Helps the first render | yes — less work exists | no |
| Automated by the Compiler | **no** | yes |

The last two rows are the ones that decide it. Memoization only helps updates —
`useMemo` explicitly *"won't make the first render faster"* — while doing less work
helps every render including the first. And the Compiler automates the right-hand
column, which means the left-hand column is the part that still needs a person.

## The other three principles

Completing the documented list, since the first two are this page:

> 3. **Keep your rendering logic pure.** If re-rendering a component causes a problem
>    … **it's a bug in your component! Fix the bug instead of adding memoization.**
> 4. **Avoid unnecessary Effects that update state.** **Most performance problems in
>    React apps are caused by chains of updates originating from Effects.**
> 5. **Try to remove unnecessary dependencies from your Effects.**

Three of the five are about effects and purity, not memoization at all — which is
the phase's argument in one observation.

## Gotchas

**Symptom:** the whole page re-renders on every keystroke in one field.
**Cause:** transient form state at the top of the tree.
**Fix:** move it into the field's own component. The named example in the docs.

**Symptom:** `memo` was added to a component that takes no props.
**Cause:** its element is recreated by the parent's render.
**Fix:** `children`, which removes the render rather than skipping it.

**Symptom:** the `children` fix did not help.
**Cause:** the element is still created inside the component that re-renders —
passing `children` only works if the *caller* is the one that did not re-render.
**Fix:** check where the element is constructed, not where it is rendered.

**Symptom:** hover state on a list row re-renders the whole list.
**Cause:** hover tracked at the list level.
**Fix:** move it into the row. Explicitly named among transient state.

**Symptom:** state was moved down and now two components need it.
**Cause:** it was lifted for a reason.
**Fix:** lift only as far as the nearest common parent — *"don't lift state up any
further than necessary"* — and consider `children` for what sits between.

**Symptom:** structural fixes were skipped because the Compiler is enabled.
**Cause:** assuming it restructures code.
**Fix:** it memoizes; it does not compose or relocate state.

## Interview questions

**★ What are the two structural fixes, and why do they beat memoization?**
Moving state down so a re-render never happens, and accepting `children` so a
wrapper's state change does not recreate its children's elements. They beat
memoization because they remove work rather than caching it: they help the first
render as well as updates, they cannot be silently broken by a later refactor since
they are enforced by where the code lives, and the React Compiler does not automate
either of them.

**★ Why does accepting `children` stop a child re-rendering?**
Because React skips re-rendering a child when the element is identical to the
previous one, and `children` passed from a parent that did not re-render *is* the
same element object. Nothing clever is being compared — the element simply did not
change, because it was created outside the component whose state updated.

**★ In what order should you try the fixes?**
Move state down if it is used by one small part of the tree; accept `children` if the
state genuinely belongs to a wrapper; only then `memo`. And before any of them, check
whether the cause is a context re-rendering every consumer, or several commits per
interaction from an effect chain — neither of which any of these fixes addresses.

**What kinds of state are usually lifted too high?**
The docs name form values and hover state specifically, and warn against keeping
transient state at the top of the tree or in a global state library. Add to that
focus, whether a dropdown is open, local filters and editing flags — each one turns a
local update into a whole-tree re-render, and each is lifted because it was easier at
the time.

**How much of the "make memoization unnecessary" list is actually about
memoization?**
Two of the five. The other three are keeping rendering pure and fixing bugs rather
than memoizing around them, avoiding effects that update state, and removing
unnecessary effect dependencies — with react.dev's own claim that effect chains cause
most React performance problems. The list is mostly Phase 4 wearing a Phase 6 label.

---

← Prev: [Lazy loading components](12-lazy-loading.md) · Index: [Phase 6](README.md) · Next → [List virtualization](14-list-virtualization.md)
