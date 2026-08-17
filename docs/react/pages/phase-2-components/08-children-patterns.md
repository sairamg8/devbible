---
title: "Children patterns"
sidebar_label: "08 · Children patterns"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component),
> [`Children` — alternatives](https://react.dev/reference/react/Children) and
> [`createContext`](https://react.dev/reference/react/createContext). No sandbox
> script backs this page; claims are cited, not measured. "Compound components"
> is a community name, not a React API.

**Four things get built with `children`, and they are genuinely different
patterns with different costs. Knowing which one a problem calls for is most of
the skill; the syntax is trivial in all four cases.**

The mechanics of `children` — what shape it takes, why `.map()` throws on a
single child, what `Children.toArray` does to keys — are Phase 1's
[`children`](../phase-1-jsx/09-children.md). The design question of when to
compose at all is [topic 03](03-composition/README.md). This page is the
catalogue in between.

## Pattern 1 — the wrapper

The simplest and by far the most common. A component that adds markup or
behaviour around whatever it is given, and has no opinion about what that is.

```jsx
function Card({children}) {
  return <div className="card">{children}</div>;
}

function ErrorBoundaryFallback({children}) { … }
function Suspense({children}) { … }
```

Everything interesting about the wrapper is what it does *not* do: it does not
inspect `children`, count them, clone them, or care what type they are. That is
what makes it composable with anything, forever.

**A wrapper is also the cheapest performance tool in React.** Because the
`children` element is created by the caller, a wrapper re-rendering does not
re-render its children — the element object is unchanged. Moving state into a
wrapper is often a better optimisation than memoizing what it wraps
([lifting state up · the cost](05-lifting-state-up/02-the-cost.md)).

## Pattern 2 — the layout with named regions

Two or more content areas, so `children` alone is not enough. Named element
props fill the rest:

```jsx
function AppShell({header, sidebar, footer, children}) {
  return (
    <div className="shell">
      <header>{header}</header>
      <aside>{sidebar}</aside>
      <main>{children}</main>
      <footer>{footer}</footer>
    </div>
  );
}
```

The rules that make this pleasant to use rather than merely possible:

- **Name for the region, not the content** — `header`, not `pageTitle`.
- **Keep the primary content in `children`.** Callers expect the nested thing to
  be the main thing.
- **Make every slot optional and render nothing when empty.** `{header && …}`
  rather than an empty `<header>` that still takes up space.
- **Do not slice `children` positionally.** `Children.toArray(children)[0]` for
  the header breaks the moment a caller wraps something in a fragment or adds a
  conditional. React's own `Children` docs recommend named components or props
  instead.

## Pattern 3 — compound components

:::tip Full treatment
This section introduces the shape. The working treatment — how a part learns which
one it is, controlled vs uncontrolled parents, dot notation vs named exports, the
re-render bill and the Server Component boundary — is
[**Compound components**](../patterns/03-compound-components/README.md) in the
patterns section.
:::

The parts need shared state. The parent provides it through context and the
caller arranges the parts however they like.

```jsx
const AccordionContext = createContext(null);

export function Accordion({children}) {
  const [openId, setOpenId] = useState(null);
  const value = useMemo(() => ({openId, setOpenId}), [openId]);
  return <AccordionContext value={value}>{children}</AccordionContext>;
}

function useAccordion(part) {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error(`<${part}> must be rendered inside <Accordion>`);
  return ctx;
}

export function AccordionItem({id, title, children}) {
  const {openId, setOpenId} = useAccordion('AccordionItem');
  const open = openId === id;
  return (
    <section>
      <button aria-expanded={open} onClick={() => setOpenId(open ? null : id)}>
        {title}
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}
```

```jsx
<Accordion>
  <AccordionItem id="a" title="First">…</AccordionItem>
  <Tooltip text="why not">                   {/* arbitrary nesting is fine */}
    <AccordionItem id="b" title="Second">…</AccordionItem>
  </Tooltip>
</Accordion>
```

Why context rather than cloning children with `cloneElement`: context does not
care about the structure between provider and consumer, so the caller can nest,
wrap, reorder, or conditionally render parts freely. The `cloneElement` version
works only for direct children and silently does nothing one level deeper —
[topic 16](16-element-manipulation.md).

Three details that separate a good implementation from a fragile one:

- **Throw a real error when used outside the parent.** Returning `null` from
  context gives the caller `Cannot destructure property 'openId' of 'null'`,
  which names nothing useful.
- **Memoize the context value.** A fresh `{openId, setOpenId}` object each render
  re-renders every consumer on every parent render. `useMemo` with the right
  deps is the standard fix — or let the React Compiler do it.
- **Export the parts from the same module.** `Accordion.Item = AccordionItem` is
  a popular dot-notation style; plain named exports work just as well and play
  better with tree-shaking and with `import type`.

The cost, stated plainly: the parts only work inside the parent, and every
consumer re-renders when the context value changes. For a tab index that is
nothing. For a value changing on every keystroke, split the context — Phase 5.

## Pattern 4 — children as a function

The escape hatch, for when the parent has values the caller's markup needs.

```jsx
function MousePosition({children}) {
  const [pos, setPos] = useState({x: 0, y: 0});
  useEffect(() => {
    const on = e => setPos({x: e.clientX, y: e.clientY});
    window.addEventListener('pointermove', on);
    return () => window.removeEventListener('pointermove', on);
  }, []);
  return children(pos);          // children is a FUNCTION here
}
```

```jsx
<MousePosition>
  {({x, y}) => <p>{x}, {y}</p>}
</MousePosition>
```

This is a render prop that happens to be called `children`, and the legacy
documentation makes the equivalence explicit — the prop does not have to be
named `render`; you can put the function directly inside the element.

**In modern React this is usually the wrong tool**, because a custom hook does
the same job with better ergonomics:

```jsx
const {x, y} = useMousePosition();      // ✅ no wrapper, no nesting
```

The hook wins on almost every axis: no extra component in the tree, no
"wrapper hell" when you need three of them, values usable anywhere in the
component rather than only inside one JSX subtree, and composable with other
hooks.

Where function-as-children still earns its place:

- **The component controls *where* as well as *what*.** A virtualised list
  decides which rows exist and where they are positioned; the caller only says
  what a row looks like. A hook cannot do that.
- **The values are per-item, not per-component.** `<List>{item => …}</List>`
  gives each item its own values; a hook returns one set.
- **A render must be scoped to a boundary** — inside a Suspense boundary, inside
  an error boundary, inside a portal.

[Topic 12](12-render-props/README.md) covers the pattern in full, including why it
mostly lost to hooks.

## Choosing

| The caller needs to… | Pattern |
|---|---|
| Put arbitrary content inside a box | **Wrapper** — `children` |
| Fill several fixed regions | **Layout** — named element props |
| Arrange parts that share state | **Compound** — context |
| Use values the component owns, inside their own markup | **Function as children** |
| Use values the component owns, anywhere | **A custom hook** — not a children pattern at all |

The last row is the one to check first. A great many render-prop components in
existing codebases are hooks that were written before hooks existed.

## Gotchas

**Symptom:** `props.children.map is not a function`.
**Cause:** exactly one child was passed, so `children` is the element itself
rather than an array — the compiler emits `jsx` for one child and `jsxs` for
several.
**Fix:** `Children.map` or `Children.toArray`, both of which normalise. Better,
restructure so you do not need to iterate children at all.

**Symptom:** a compound component's part renders but does nothing.
**Cause:** it is outside the provider and read the context default.
**Fix:** throw from the hook that reads the context, naming the part and the
required parent.

**Symptom:** every part of a compound component re-renders on every parent
render.
**Cause:** the context value is a new object literal each time.
**Fix:** `useMemo` the value, or adopt the React Compiler.

**Symptom:** a `children`-as-function component renders `[object Object]` or
throws `children is not a function`.
**Cause:** the caller passed JSX where a function was expected, or the reverse.
**Fix:** the API is unusual enough to warrant a development-time check —
`typeof children !== 'function'` with a clear error.

**Symptom:** positional slot slicing puts the footer in the header.
**Cause:** a caller added a fragment, a conditional, or a mapped array, changing
positions.
**Fix:** named props. This failure has no safe version.

**Symptom:** three nested render-prop components make the JSX unreadable.
**Cause:** "wrapper hell" — the pattern composes badly with itself.
**Fix:** convert each to a custom hook, which composes linearly.

## Interview questions

**★ What are the main `children` patterns and when does each apply?**
The wrapper, when the component adds markup around arbitrary content; the layout
with named element props, when there are several fixed regions; compound
components with context, when parts must share state but be arranged freely; and
children-as-a-function, when the caller's markup needs values the component
owns. Before the last one, check whether a custom hook is the real answer — it
usually is.

**★ Why do compound components use context rather than `cloneElement`?**
Because context reaches consumers at any depth, so the caller can nest, wrap or
reorder the parts freely. `cloneElement` only touches direct children, so it
silently fails as soon as a part is wrapped in anything, and it makes the data
flow invisible. React's own `cloneElement` documentation recommends render props
or context instead.

**★ Why did hooks largely replace children-as-a-function?**
A hook gives you the same values without adding a component to the tree, without
nesting, usable anywhere in the component rather than only inside one JSX
subtree, and composable with other hooks. Function-as-children survives where
the component must control placement as well as content — virtualised lists — or
where the values are per-item rather than per-component.

**Why does a wrapper component not re-render its children?**
Because the child elements were created by the caller. When the wrapper's own
state changes, `props.children` is the same object it was, so reconciliation
finds nothing to update. It is free memoization, and it makes "put the state in
a wrapper" a genuine performance technique.

**What is wrong with `Children.toArray(children)[0]` for a header slot?**
It assumes a positional structure the caller does not know they have to
preserve. A fragment, a conditional rendering `false`, or a `.map()` changes the
indices and the wrong element lands in the wrong slot. React's `Children`
documentation warns about exactly this and points at named props instead.

**How do you make a compound component fail clearly when misused?**
Read the context through a custom hook that throws when the value is missing,
with a message naming both the part and the required parent. The default
behaviour — `null` propagating into a destructuring failure — produces an error
that names neither.

---

← Prev: [Destructuring and default values](07-destructuring-and-defaults.md) · Index: [Phase 2](README.md) · Next → [`ref` as a prop](09-ref-as-a-prop.md)
