---
title: "The delivery shapes"
sidebar_label: "05 · The delivery shapes"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`useContext`](https://react.dev/reference/react/useContext),
> [`createContext`](https://react.dev/reference/react/createContext),
> [`cloneElement`](https://react.dev/reference/react/cloneElement),
> [`Children`](https://react.dev/reference/react/Children),
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks),
> and the [React 19 release notes](https://react.dev/blog/2024/12/05/react-19)
> for `<Context>` as a provider. Judgements are marked as judgements.
> No sandbox script backs this page; claims are cited, not measured.

**Same behaviour, four ways to hand it over. They are not interchangeable, and
the choice decides how much structural freedom the caller actually keeps.**

## Shape 1 — a hook

What [chunk 03](03-building-it.md) and [chunk 04](04-wiring-it-up.md) built.

```jsx
const { getListboxProps, getOptionProps } = useListbox({ items });
```

- ✅ **Adds nothing to the tree.** No wrapper components, no extra depth, nothing
  in the profiler.
- ✅ **Composes with other hooks** — you can call it alongside `useFloating`,
  `useVirtualizer`, your own state, in any order.
- ✅ **Total structural freedom.** The caller writes every element.
- ⚠️ **Cannot enforce anything.** If the caller forgets to spread
  `getOptionProps`, the widget is broken and nothing warns.
- ⚠️ **Verbose at the call site**, especially with several parts.
- ⚠️ **A hook is client-side by definition** — a module exporting it needs
  `'use client'` in an RSC app.

*(Judgement: this is the right default. The other shapes are built on top of it,
not instead of it.)*

## Shape 2 — children as a function

The hook's return value handed back through `children`.

```jsx
function Listbox({ items, children }) {
  const api = useListbox({ items });
  return children(api);
}
```

```jsx
<Listbox items={fruits}>
  {({ getListboxProps, getOptionProps }) => (
    <ul {...getListboxProps({ 'aria-label': 'Fruit' })}>
      {fruits.map((f, i) => <li key={f.id} {...getOptionProps(i)}>{f.label}</li>)}
    </ul>
  )}
</Listbox>
```

- ✅ Gives the caller a **component boundary** — useful when the widget's state
  should live below something else in the tree, or be conditionally mounted.
- ✅ Still total structural freedom.
- ⚠️ It is a [render prop](../../phase-2-components/12-render-props.md), so it
  inherits the wrapper-nesting problem: three of these nest into a pyramid, which
  is exactly what hooks were introduced to remove.
- ⚠️ The function body re-creates its whole subtree on every render of the
  parent, and it is awkward to memoize.

**Prefer this only when the caller specifically wants a component**, not by
default.

## Shape 3 — compound components over context

The parts become real components that find shared state implicitly.

```jsx
const ListboxContext = createContext(null);

function useListboxContext(component) {
  const context = useContext(ListboxContext);
  if (context === null) {
    throw new Error(`<${component}> must be rendered inside <Listbox>`);
  }
  return context;
}

function Listbox({ items, children, ...rest }) {
  const api = useListbox({ items });
  return (
    <ListboxContext value={api}>
      <ul {...api.getListboxProps(rest)}>{children}</ul>
    </ListboxContext>
  );
}

function Option({ index, children, ...rest }) {
  const { getOptionProps } = useListboxContext('Option');
  return <li {...getOptionProps(index, rest)}>{children}</li>;
}

Listbox.Option = Option;
```

```jsx
<Listbox items={fruits} aria-label="Fruit">
  {fruits.map((f, i) => <Listbox.Option key={f.id} index={i}>{f.label}</Listbox.Option>)}
</Listbox>
```

- ✅ **The nicest call site by a distance**, and the hardest to misuse.
- ✅ The guard hook turns a missing provider into a clear error instead of a
  `null` dereference —
  [the default context value](../../phase-5-refs-context-reducers/13-default-context-value.md).
- ⚠️ 🔴 **This is the least headless of the shapes.** Nothing is styled, but the
  *structure* is now fixed: `Listbox` renders a `<ul>` and `Option` renders an
  `<li>`. A caller who needs `<div>`s is stuck — which is the exact failure
  [chunk 01](01-what-headless-means.md) defines the pattern against.
- ⚠️ Pays the context cost: every consumer re-renders when the provider value's
  identity changes, and `useContext` has no selector —
  [the context re-render problem](../../phase-5-refs-context-reducers/05-context-re-render-problem.md).
- ⚠️ Adds a component per part to the tree.

**The usual repair is a polymorphic `as` prop on each part** — which is
[pattern 03](../supporting/polymorphic-components.md), and is why published kits almost
all ship both.

## Shape 4 — the slot / `asChild` hybrid

Parts that render **no element of their own** and instead merge their props onto
the child the caller already wrote.

```jsx
<Listbox.Option index={i} asChild>
  <li className="picker-option">{f.label}</li>
</Listbox.Option>
```

- ✅ Recovers the structural freedom shape 3 gave away, while keeping its call
  site.
- ⚠️ Requires cloning the child to merge props, and react.dev describes
  [`cloneElement`](https://react.dev/reference/react/cloneElement) as uncommon
  and a route to fragile code.
- ⚠️ The caller must pass **exactly one** element — not a fragment, not a string,
  not two children — and the failure mode when they do not is obscure.
- ⚠️ Prop conflicts are resolved by *your* merge implementation rather than by
  JSX's last-key-wins, so the rules are invisible at the call site.

## Choosing

| | Tree nodes added | Structural freedom | Can enforce correctness | Call-site cost |
|---|---|---|---|---|
| Hook | none | **total** | none | highest |
| Children as a function | one | **total** | none | high, nests badly |
| Compound + context | one per part | **lowest** | **highest** | lowest |
| Slot / `asChild` | none per part | high | high | low, sharp edges |

🔴 **The honest answer is usually "ship more than one."** A headless core as a
hook, compound components built on it for the common case, and `as`/`asChild` as
the escape hatch. The layers cost little because they are all the same hook, and
they cover callers who want different things without any of them forcing a fork.

## Gotchas

**Do not implement compound components by inspecting `children`.**
`Children.map` plus `cloneElement` breaks the moment a caller wraps a part in a
`<div>`, a fragment, or a `.map()` — the parts are no longer direct children.
Context has no such constraint, which is the reason it is the standard mechanism.

**`Listbox.Option = Option` is convenient and not free.** Attaching parts to the
parent means a bundler cannot tree-shake `Option` away when it is unused, because
the assignment is a side effect on an object the caller imported.

**A `null` context default plus a guard hook is deliberate.** Defaulting to a
plausible object means a part rendered outside its parent silently half-works,
and the bug surfaces far from the mistake. Throwing names the component and the
required parent.

**`<ListboxContext value={api}>` is the React 19 form.** `.Provider` still works.
Either way, `api` is a new object every render unless you memoize it, so every
consumer re-renders — memoize the value or split the context.

**Nesting two children-as-a-function widgets produces a pyramid**, and a third
makes it unreadable. That is the original render-props complaint, and it is not
fixed by any of this.

**A component that only calls a hook and returns `children(api)` still re-renders
its whole subtree** when the hook's state changes. That is correct behaviour, and
it is worth knowing before you wrap something expensive in one.

**Shape 3 quietly makes `index` the caller's problem.** `<Listbox.Option
index={i}>` requires the caller to pass an array position, which breaks if they
render options from a nested structure or out of order. Deriving it from context
requires registration, which is a materially more complex hook.

**`asChild` and `key` do not mix well.** Cloning the child preserves its props but
`key` belongs to the element in the parent's list, so it must stay where the
caller wrote it — a common and confusing error.

**Every shape here needs `'use client'` in an RSC app**, because all of them call
hooks. What can stay on the server is the *content* passed as `children` — see
[Server Components as `children`](../../phase-10-server-components/07-server-components-as-children.md).

**Mixing shapes in one library without a documented rule confuses everyone.** If
`Listbox` is compound but `Tooltip` is a hook, callers cannot form a habit. Pick
a house convention and state it.

## Interview questions

**What are the ways to deliver a headless component?**
A hook, a component taking children as a function, compound components sharing
state through context, and a slot/`asChild` form that merges props onto a child
the caller supplies.

**Which is the default, and why?**
The hook. It adds nothing to the tree, composes with other hooks, and leaves the
caller complete structural freedom. The others are built on top of it.

**Why is the compound shape the least headless?**
Because it fixes the structure. Nothing is styled, but the parts render specific
elements — a caller who needs different tags cannot get them without a
polymorphic `as` prop or an `asChild` escape.

**Why do compound components use context rather than inspecting `children`?**
Because `Children.map` and `cloneElement` only reach *direct* children. Any
wrapper, fragment or `.map()` breaks the connection. Context finds consumers at
any depth.

**What does the guard hook that throws buy you?**
It converts "context is `null`, so something downstream crashed confusingly" into
a message naming the component and the parent it needs. It is the reason to
default the context to `null` rather than to a plausible object.

**What does attaching parts as `Listbox.Option` cost?**
Tree-shaking. The assignment is a side effect on the imported object, so a
bundler cannot drop `Option` when nobody uses it.

**Why does children-as-a-function nest badly?**
Each one is a component wrapping the next, so combining several rebuilds the
wrapper pyramid that hooks were introduced to eliminate.

**What is the trade-off with `asChild`?**
It restores structural freedom and keeps a clean call site, but it needs
`cloneElement` — which React's own documentation calls fragile — requires exactly
one child element, and resolves prop conflicts inside your implementation rather
than visibly at the call site.

**Which shape should a library ship?**
Usually several layered on one hook: the hook for full control, compound
components for the common case, and `as`/`asChild` as the escape hatch. They
share an implementation, so the cost is small and no caller is forced to fork.

**Do any of these work in a Server Component?**
No — all of them call hooks, so they need `'use client'`. Server-rendered content
can still be passed through them as `children`.

---

← Prev: [04 · Wiring it to the DOM](04-wiring-it-up.md) · Index: [Headless components](README.md) · Next → [06 · When it is wrong, and the limits](06-when-it-is-wrong.md)
