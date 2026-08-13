---
title: "Slots, children and the context hole"
sidebar_label: "02 · Slots and children"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component),
> [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context)
> and [`Children` — alternatives](https://react.dev/reference/react/Children).
> No sandbox script backs this page; claims are cited, not measured. "Slots" is
> a community name, not a React API.

**`children` is the slot you get for free. Named element props are the slots you
declare. And the difference between wrapping a component and rendering it is
what makes composition solve prop drilling.**

## One slot: `children`

react.dev describes `children` in terms worth keeping:

> You can think of a component with a `children` prop as having a "hole" that
> can be "filled in" by its parent components with arbitrary JSX. You will often
> use the `children` prop for visual wrappers: panels, grids, etc.

The "hole" framing is the useful part. A wrapper does not need to know what goes
in it — that is precisely what makes it a wrapper.

```jsx
function Card({children}) {
  return <div className="card">{children}</div>;
}
```

Use `children` when the component has **one** content area and no opinion about
what fills it. Phase 1's [`children`](../../phase-1-jsx/09-children.md) covers
the mechanics — the shape the compiler chooses, why `props.children.map()`
throws on a single child, what `Children.toArray` does to keys. This page is
about when to reach for it.

## Several slots: named element props

The moment a component has two content areas, `children` stops being enough, and
the answer is ordinary props holding elements:

```jsx
function PageLayout({sidebar, header, footer, children}) {
  return (
    <div className="layout">
      <header>{header}</header>
      <aside>{sidebar}</aside>
      <main>{children}</main>
      <footer>{footer}</footer>
    </div>
  );
}

<PageLayout
  header={<Toolbar />}
  sidebar={<Nav items={nav} />}
  footer={<Legal />}
>
  <Article body={body} />
</PageLayout>
```

This is what the community calls the **slots pattern**. There is no React API
behind the name — they are just props whose values happen to be elements. Two
conventions have settled, both worth following:

- **Name the slot for the region, not the content.** `header`, not `titleBar`;
  `actions`, not `saveButton`. The name is part of the layout's contract.
- **Keep the main content in `children`.** Callers expect the primary slot to be
  the nested one, and it reads better at the call site.

**Do not slice `children` apart to fake multiple slots.** The temptation is
`Children.toArray(children)[0]` for the header and `[1]` for the body. The
`Children` reference warns against exactly this — *"Using `Children` is uncommon
and can lead to fragile code"* — and it names multiple named components or
element props as the alternatives. Positional slicing breaks when a caller wraps
a child in a fragment, adds a conditional, or reorders. It is covered in full
in [topic 16](../16-element-manipulation.md).

## The third form: compound components

When several parts must share state, neither `children` nor named slots quite
fits — the parts need something from the parent. Compound components solve it by
pairing a free-form `children` slot with context:

```jsx
const TabsContext = createContext(null);

function Tabs({defaultTab, children}) {
  const [active, setActive] = useState(defaultTab);
  return (
    <TabsContext value={{active, setActive}}>
      <div className="tabs">{children}</div>
    </TabsContext>
  );
}

function Tab({id, children}) {
  const {active, setActive} = useContext(TabsContext);
  return (
    <button aria-selected={active === id} onClick={() => setActive(id)}>
      {children}
    </button>
  );
}

function TabPanel({id, children}) {
  const {active} = useContext(TabsContext);
  return active === id ? <div role="tabpanel">{children}</div> : null;
}
```

```jsx
<Tabs defaultTab="a">
  <Tab id="a">First</Tab>
  <Tab id="b">Second</Tab>
  <TabPanel id="a"><ThingOne /></TabPanel>
  <TabPanel id="b"><ThingTwo /></TabPanel>
</Tabs>
```

The caller arranges the parts freely — wrap a `Tab` in a tooltip, put the panels
above the tabs, insert a divider — and the shared state still reaches every part,
because context does not care about the DOM structure between provider and
consumer.

Note the React 19 form: `<TabsContext value={…}>` renders the context object
directly as a provider. `<TabsContext.Provider>` still works and is what older
versions require, but the shorter form is the documented one now.

Two things this pattern costs, and they are real:

- **The parts are only usable inside the parent.** A `<Tab>` rendered outside
  `<Tabs>` reads the context default. Throw a clear error from the hook rather
  than letting `null` propagate into a destructuring failure.
- **Context changes re-render every consumer.** Fine for a tab index; not fine
  for a value that changes on every keystroke. Phase 5 covers splitting a context
  in two when that bites.

## The context hole — why composition fixes prop drilling

This is the part of composition that is not about API design at all, and it is
the reason the pattern earns its Master tier.

Prop drilling: a value is needed six levels down, so it is threaded through six
components that do not use it.

```jsx
<Layout user={user}>            {/* Layout doesn't use user */}
  <Sidebar user={user}>          {/* Sidebar doesn't use user */}
    <Nav user={user}>            {/* Nav doesn't use user */}
      <Avatar user={user} />     {/* finally */}
```

Composition removes the middle entirely:

```jsx
<Layout sidebar={<Sidebar nav={<Nav avatar={<Avatar user={user} />} />} />} />
```

`Layout`, `Sidebar` and `Nav` never mention `user`. **The `<Avatar user={user}
/>` element is created in the scope that has `user`**, and everything below just
carries the finished element down. react.dev names this as the first thing to
try before reaching for context:

> Before you use context: Start by passing props… Extracting components and
> passing JSX as `children` to them is a common way to fix this.

The mechanism is scope, not React. An element created in the outer scope closes
over that scope's variables at creation time; the components that receive it as
a prop are just moving an object around. They cannot see inside it and do not
need to.

**Where this matters most is Server Components.** A Server Component cannot be
imported by a Client Component — but a Client Component can *receive* one as
`children` or as an element prop, because the element was created on the server
and passed down as data. So:

```jsx
// ✅ ClientProvider is a Client Component receiving server-rendered children
<ClientProvider>
  <ServerRenderedThing />
</ClientProvider>
```

works, while importing `ServerRenderedThing` inside `ClientProvider` does not.
In a client-only app composition is a style choice. In an RSC app it is the
mechanism that keeps server code out of the client bundle — which is why the
syllabus's cross-phase note points Phase 2 at Phase 10.

## Choosing between the three

| Situation | Reach for |
|---|---|
| One content area, no opinion about it | `children` |
| Several fixed regions | Named element props |
| Parts that must share state and be arranged freely | Compound components + context |
| The parent must supply values to what it renders | Render props ([topic 12](../12-render-props.md)) |
| A value is needed by many components at many depths | Context (Phase 5) |

The order is deliberate: reach for the simplest that works. `children` costs
nothing; context costs a re-render on every consumer and a rule about where the
parts may be used.

## Gotchas

**Symptom:** a wrapper component re-renders its children unnecessarily — or
notably, *doesn't*, and someone is confused about why.
**Cause:** when children are passed in as an element prop, the parent that
re-renders is the one that *created* the element, not the one that renders it.
A `<Layout>` re-rendering does not re-render `children` it merely received,
because the child element object is unchanged.
**Fix:** nothing to fix — this is a genuine and useful property. It is also the
cheapest optimisation in React: pass an expensive subtree as `children` to the
component whose state changes often, and that subtree stops re-rendering with it.

**Symptom:** `Cannot destructure property 'active' of 'null'` in a compound
component part.
**Cause:** the part was rendered outside its provider, so `useContext` returned
the default.
**Fix:** create a custom hook that throws a useful message:
`if (!ctx) throw new Error('<Tab> must be used inside <Tabs>')`.

**Symptom:** slicing `children` by index puts the wrong element in the wrong
slot.
**Cause:** a caller wrapped children in a fragment, added a conditional that
rendered `false`, or mapped an array — all of which change the positions.
**Fix:** named element props. The `Children` API is documented as fragile for
this reason.

**Symptom:** every consumer of a compound component's context re-renders on
every keystroke.
**Cause:** one context value carrying both rarely-changing config and
frequently-changing input state, plus a new object literal each render.
**Fix:** split the context, and memoize the value object. Phase 5.

**Symptom:** in an RSC app, adding a client-side provider turns the whole page
into client code.
**Cause:** the provider *imports* its children instead of receiving them.
**Fix:** have it take `children` and compose from the server side.

## Interview questions

**★ How do you build a component with more than one content slot?**
Take elements as ordinary props — `header`, `sidebar`, `footer` — and keep the
primary content in `children`. Do not slice `children` apart by index: React's
own `Children` documentation warns that this is fragile, because a fragment, a
conditional or a mapped array changes the positions under you.

**★ How does composition solve prop drilling, and when would you use context
instead?**
By creating the element in the scope that has the value and passing the finished
element down. The intermediate components carry an opaque object and never
mention the value. React's own guidance is to try this before context. Context
wins when many components at many depths need the value, or when the consumers
are not known to whoever holds it — theming, the current user, a locale.

**★ What is a compound component?**
A parent that provides shared state through context and a set of parts that
consume it — `<Tabs>` with `<Tab>` and `<TabPanel>`. The caller arranges the
parts freely because the state travels through context rather than through the
markup. The costs are that the parts only work inside the parent, and that every
consumer re-renders when the context value changes.

**Why does passing a subtree as `children` sometimes stop it re-rendering?**
Because the element object is created by the outer component. When the wrapper's
own state changes and it re-renders, `props.children` is the same object it was,
so React reconciles it as unchanged and does not re-render that subtree. It is
memoization you get for free from ordinary reconciliation.

**Why is composition a hard requirement rather than a style choice in Server
Components?**
A Client Component cannot import a Server Component — the import would pull
server code into the client bundle. It *can* receive one as `children` or as an
element prop, because by then the element is data produced on the server. So
composition is the only way to put server-rendered content inside a client
boundary.

**What changed about context providers in React 19?**
You can render the context object directly — `<ThemeContext value={theme}>` —
instead of `<ThemeContext.Provider value={theme}>`. The `.Provider` form still
works; the direct form is what the current documentation uses.

---

← Prev: [The configuration trap](01-the-configuration-trap.md) ·
Index: [Composition over configuration](README.md) ·
Next → [Controlled vs uncontrolled components](../04-controlled-vs-uncontrolled/README.md)
