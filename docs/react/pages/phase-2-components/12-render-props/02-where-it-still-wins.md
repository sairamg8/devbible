---
title: "Where it still wins"
sidebar_label: "02 · Where it still wins"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`Children`](https://react.dev/reference/react/Children), which recommends a
> `renderItem`-style prop as an alternative to manipulating children and notes
> that it *"explicitly traces where values come from"*;
> [`Suspense`](https://react.dev/reference/react/Suspense) and
> [`createPortal`](https://react.dev/reference/react-dom/createPortal) for the
> boundary-scoping argument.
> ⚠️ The library examples are named as illustrations of the shape, not as
> endorsements or version-specific API claims.
> No sandbox script backs this page; claims are cited, not measured.

**[Chunk 01](01-the-pattern.md) argued hooks won. This is the part they cannot
take, and it is narrower and more specific than "sometimes render props are
fine".**

## The rule that decides it

**A hook cannot render anything.** It returns values; the caller renders. So the
moment the *component* needs to decide **where**, **how many times**, or **inside
what** the caller's markup appears, a hook is structurally incapable and a render
prop is not.

Everything below is a consequence of that one sentence.

## Where render props still win

Three cases, and they are genuinely not hook-shaped.

**1. The component controls placement, not just values.** A virtualised list
decides which rows exist and positions them; the caller only describes a row.
A hook cannot render anything, so it cannot do this.

```jsx
<VirtualList items={rows} rowHeight={32}>
  {(item, style) => <div style={style}>{item.name}</div>}
</VirtualList>
```

**2. The values are per-item.** A hook returns one set of values per component.
A render prop is called once per item, with that item's values.

**3. The rendering must be scoped to a boundary** the component owns — inside
its Suspense boundary, inside its error boundary, inside its portal. The
function runs where the component chooses to call it.

react.dev's `Children` reference lists render props as one of the recommended
alternatives to manipulating `children`, for exactly this reason: a `renderItem`
prop makes the data flow explicit, and the docs note the benefit as *"explicitly
traces where values come from"*.

## Two more that follow from the same rule

**4. The component owns a boundary.** If the caller's markup must render inside
a `<Suspense>`, an error boundary, or a
[portal](../11-portals.md) that the component created, the component has to be the
one placing it. A hook returning values leaves the caller rendering outside the
boundary, which defeats the point.

```jsx
<AsyncBoundary fallback={<Spinner />}>
  {(data) => <Report data={data} />}      {/* runs INSIDE the Suspense boundary */}
</AsyncBoundary>
```

**5. The component needs to inject per-call context.** A `<Field>` in a form
library gives each call its own `field`/`meta` objects tied to a name it manages.
A hook could do this — `useField('email')` — and many libraries offer both. The
render-prop version wins when the caller should not have to repeat the name, or
when the component wants to control the boundary around each field.

## Multiple render props on one component

Once a component has more than one hole to fill, the pattern stops competing with
hooks at all and starts competing with
[slots](../03-composition/02-slots-and-children.md):

```jsx
<DataTable
  rows={rows}
  renderRow={(row) => <Row {...row} />}
  renderEmpty={() => <EmptyState />}
  renderError={(error) => <Error error={error} />}
/>
```

*(Judgement:)* **if the hole needs no arguments, it should be an element prop,
not a function.** `renderEmpty={() => <EmptyState/>}` is a function that ignores
its arguments — `empty={<EmptyState/>}` says the same thing with less ceremony
and no closure. Keep the function form only where the component passes something
in.

That is the honest dividing line between render props and slots: **arguments.**

## Reading it in existing code

Render props are not historical trivia; they are in current libraries. You will
meet them in:

- **Virtualisation** — `react-window`, `react-virtuoso`.
- **Charting** — `<ResponsiveContainer>{({width, height}) => …}`.
- **Form libraries** — Formik's `<Field>{({field, meta}) => …}`, and
  `react-hook-form`'s `<Controller render={…}>`.
- **Headless UI kits**, where a part exposes its state to the caller's markup.
- **Older data-fetching wrappers**, which are the ones worth migrating.

The recognition rule: if a prop's value is a function that returns JSX, it is a
render prop, whatever it is called.

**How to recognise one in unfamiliar code:** if a prop's value is a function that
returns JSX, it is a render prop, whatever it is called. `renderItem`, `children`,
`render`, `component`, `item` — the name tells you nothing; the return type does.

⚠️ **A `component={Foo}` prop is *not* a render prop** — it passes a type, not a
function that returns elements. The distinction matters because a component prop
can be memoized by identity and a render prop usually cannot, and because
`component={() => <Foo/>}` remounts on every render while `component={Foo}` does
not.

## Gotchas

**"Where render props still win" is not "where they are acceptable".** All five
cases above are structural — a hook literally cannot do them. If your reason is
"it reads nicer" or "we already use them here", that is not one of the five.

**A virtualised list's render prop runs for visible rows only.** Anything the
caller does per call — analytics, an id, a subscription — fires on scroll, not
once per item, and stops firing for rows that scroll away.

**Per-item render props and `key` are the caller's problem in the wrong place.**
The component usually sets `key` from the item it owns, so a caller who also sets
one may be overridden or may fight it. Document which.

**A render prop inside a boundary still runs on the client.** Putting the call
inside `<Suspense>` scopes *where* it renders, not *whether* it is client code.

**Form-library render props often re-render on every keystroke of every field**
unless the library isolates them. That is a property of the library, not of the
pattern, and it is worth checking rather than assuming.

**Offering both a hook and a render prop doubles your API surface.** It is the
right call for a widely used library and overkill for an internal component —
two ways to do one thing means two sets of docs and two sets of bugs.

## Interview questions

**What is the single rule that decides when a render prop beats a hook?**
A hook cannot render anything. If the *component* must decide where, how many
times, or inside what the caller's markup appears, only a render prop can express
it.

**Give the canonical example.**
A virtualised list: the component decides which rows exist and positions them,
and the caller only describes what one row looks like.

**Why can't a hook handle per-item values?**
A hook returns one set of values per component call. A render prop is invoked
once per item, with that item's values.

**What does "the component owns a boundary" mean here?**
The caller's markup must render inside a `Suspense`, error boundary or portal
that the component created. Only the component can place it there; a hook leaves
the caller rendering outside it.

**When should a fill-in-the-blank prop be an element rather than a function?**
When it takes no arguments. `empty={<EmptyState/>}` beats
`renderEmpty={() => <EmptyState/>}` — the function form earns its place only when
the component passes something in. That is the real boundary between render props
and slots.

**How do you recognise a render prop in unfamiliar code?**
Any prop whose value is a function returning JSX, whatever it is named.

**How is `component={Foo}` different?**
It passes a component *type*, not a function returning elements. It can be
compared by identity, and `component={() => <Foo/>}` remounts every render while
`component={Foo}` does not.

**Is "it reads better here" a valid reason to choose a render prop?**
No. The five cases are structural — a hook cannot do them. Anything else is a
preference, and the nesting cost is real.

---

← Prev: [01 · The pattern](01-the-pattern.md) · Index: [Render props](README.md) · Next → [03 · The costs and the limits](03-the-costs-and-limits.md)
