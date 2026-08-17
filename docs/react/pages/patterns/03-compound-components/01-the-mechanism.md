---
title: "The mechanism"
sidebar_label: "01 · The mechanism"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`createContext`](https://react.dev/reference/react/createContext),
> [`useContext`](https://react.dev/reference/react/useContext),
> [`Children`](https://react.dev/reference/react/Children),
> [`cloneElement`](https://react.dev/reference/react/cloneElement),
> [`useMemo`](https://react.dev/reference/react/useMemo) and the
> [React 19 release notes](https://react.dev/blog/2024/12/05/react-19).
> ⚠️ Community pattern built from documented APIs — see the topic
> [index](README.md). Judgements marked as judgements.
> No sandbox script backs this page; claims are cited, not measured.

**Two components that must agree about something, and no prop connecting them.**


## The problem it solves

A tab widget as a configuration API:

```jsx
<Tabs
  items={[
    { value: 'billing', label: 'Billing', content: <Billing /> },
    { value: 'team',    label: 'Team',    content: <Team /> },
  ]}
  defaultValue="billing"
  tabListClassName="…"
  panelClassName="…"
  renderTabLabel={(item) => <>{item.icon}{item.label}</>}
/>
```

Every request adds a prop. An icon between label and count, a badge on one tab
only, a divider after the third, a tab that is a link — each one either a new
prop or a `render*` callback, and the `items` array quietly becomes a small
templating language. This is
[the configuration trap](../../phase-2-components/03-composition/01-the-configuration-trap.md)
at multi-part scale.

The compositional version:

```jsx
<Tabs defaultValue="billing">
  <Tabs.List>
    <Tabs.Tab value="billing">💳 Billing <Badge count={3} /></Tabs.Tab>
    <Divider />
    <Tabs.Tab value="team">Team</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="billing"><Billing /></Tabs.Panel>
  <Tabs.Panel value="team"><Team /></Tabs.Panel>
</Tabs>
```

No new props were needed for any of it. **But now `Tabs.Tab` and `Tabs.Panel`
have to agree on which tab is active, and there is no prop between them** —
they are siblings, arbitrarily deep, arranged by someone else. That gap is what
the pattern fills.

## Context is the channel

```jsx
import { createContext, useContext, useMemo, useState, useId } from 'react';

const TabsContext = createContext(null);

function useTabsContext(part) {
  const context = useContext(TabsContext);
  if (context === null) {
    throw new Error(`<Tabs.${part}> must be rendered inside <Tabs>`);
  }
  return context;
}

export function Tabs({ defaultValue, children, ...rest }) {
  const [value, setValue] = useState(defaultValue);
  const baseId = useId();

  const context = useMemo(
    () => ({ value, setValue, baseId }),
    [value, baseId],
  );

  return (
    <TabsContext value={context}>
      <div {...rest}>{children}</div>
    </TabsContext>
  );
}

function Tab({ value: tabValue, children, ...rest }) {
  const { value, setValue, baseId } = useTabsContext('Tab');
  const selected = value === tabValue;

  return (
    <button
      role="tab"
      id={`${baseId}-tab-${tabValue}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${tabValue}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => setValue(tabValue)}
      {...rest}
    >
      {children}
    </button>
  );
}

function Panel({ value: panelValue, children, ...rest }) {
  const { value, baseId } = useTabsContext('Panel');
  if (value !== panelValue) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${panelValue}`}
      aria-labelledby={`${baseId}-tab-${panelValue}`}
      tabIndex={0}
      {...rest}
    >
      {children}
    </div>
  );
}

Tabs.List  = function List({ children, ...rest }) {
  return <div role="tablist" {...rest}>{children}</div>;
};
Tabs.Tab   = Tab;
Tabs.Panel = Panel;
```

`useId` is doing the same job it does everywhere ARIA relationships appear: the
tab and its panel must reference each other by id, those ids must be unique
across the page, and they must match between server and client —
[`useId`](../../phase-5-refs-context-reducers/14-useid.md).

## Gotchas

**`<TabsContext value={…}>` is the React 19 form; `.Provider` still works.**
Mixing both in one codebase is confusing but harmless. What is not harmless is
assuming the shorthand changed the re-render semantics — it did not.

**Conditionally rendering a part is fine; conditionally rendering the *provider*
is not.** `{isReady && <Tabs>…</Tabs>}` unmounts the whole subtree and destroys
the selected tab. Keep the provider mounted and switch what it contains.

**Panels that return `null` when inactive lose their state.** The unselected
panel's subtree is unmounted, so scroll position, uncontrolled input values and
component state are gone when the user comes back. Rendering all panels with
`hidden` keeps them — at the cost of mounting everything up front. Neither is
right in general; pick one and document it.

**The `hidden` attribute is overridable by CSS.** `display: flex` on a panel
beats the UA's `[hidden] { display: none }`, so the "hidden" panel stays visible.
Add `[hidden] { display: none !important; }` to your reset if you go that route.

**Spreading `{...rest}` after your own props lets callers clobber the ARIA
wiring.** In `Tab` above, a caller passing `role="button"` wins. Whether that is
a feature or a bug is the default-versus-invariant decision from
[prop getters](../supporting/prop-getters.md).

**Two `<Tabs>` on one page work correctly only because `useId` is per-instance.**
A hand-rolled `id` constant would make both widgets claim the same ids and break
`aria-controls` for one of them.

**Nesting the same compound component inside itself picks the nearest
provider** — usually what you want, occasionally a surprise. Nested tabs work; a
`Tabs.Panel` inside another `Tabs` belongs to the inner one.

**The parent still renders a wrapper element.** `<div {...rest}>{children}</div>`
is a real DOM node the caller did not ask for. If that breaks a grid or a table,
the parent needs `as` too — not just the parts.

## Interview questions

**What problem do compound components solve?**
Several components that must coordinate but have no prop connecting them, because
the caller arranges them. The alternative — a configuration API with an `items`
array — grows a prop per variation and turns into a small templating language.

**Why can the parts not just take props?**
Because they are siblings, arbitrarily deep, and arranged by the caller. There is
no prop path between `Tabs.Tab` and `Tabs.Panel`.

**What does the parent actually publish?**
The shared state, the setter, and the id base that lets parts reference each
other with `aria-controls` and `aria-labelledby`.

**Why is `useId` needed rather than a module constant?**
The ids must be unique per widget instance — two `<Tabs>` on one page would
otherwise collide — and must match between the server and client renders.

**What happens to a panel's state when it is inactive?**
If the panel returns `null`, its subtree unmounts and its state, scroll position
and uncontrolled input values are lost. Rendering it with `hidden` preserves them
and mounts everything up front.

**What breaks if you conditionally render the provider?**
Everything below it unmounts, so the widget's state resets. Conditionally
rendering the *parts* is fine.

**Can the parts be nested inside other elements?**
Yes — that is the whole point of using context, and chunk 02 explains what would
break if they were not.

---

Index: [Compound components](README.md) · Next → [02 · Why context, not `cloneElement`](02-why-context.md)
