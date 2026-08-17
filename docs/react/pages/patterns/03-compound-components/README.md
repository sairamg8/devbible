---
title: "Compound components"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`createContext`](https://react.dev/reference/react/createContext),
> [`useContext`](https://react.dev/reference/react/useContext),
> [`Children`](https://react.dev/reference/react/Children),
> [`cloneElement`](https://react.dev/reference/react/cloneElement),
> [`useMemo`](https://react.dev/reference/react/useMemo),
> [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context),
> and the [React 19 release notes](https://react.dev/blog/2024/12/05/react-19)
> for `<Context>` usable directly as a provider.
> ⚠️ **"Compound components" is a community name for a composition built out of
> documented React APIs.** React documents context and `children`; the pattern
> name and its conventions come from the ecosystem. Judgements are marked.
> No sandbox script backs this topic; claims are cited, not measured.

**Several components that only make sense together, coordinating through context
instead of props.**

```jsx
<Tabs defaultValue="billing">
  <Tabs.List>
    <Tabs.Tab value="billing">Billing</Tabs.Tab>
    <Tabs.Tab value="team">Team</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="billing">…</Tabs.Panel>
  <Tabs.Panel value="team">…</Tabs.Panel>
</Tabs>
```

## Why this is its own topic now

It was a **66-line section** inside
[children patterns](../../phase-2-components/08-children-patterns.md) — which is
the right place to *introduce* it and nowhere near enough to *use* it. Compound
components is one of the small set of patterns every React UI library is built
from, and the parts that decide whether an implementation is good or fragile —
how a part learns its own index, whether the parent is controlled, what dot
notation costs, what happens under RSC — were all missing.

Phase 2 keeps the introduction. This topic is the working treatment.

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | **[The mechanism](01-the-mechanism.md)** | The gap the pattern fills — sibling parts with no prop between them — and the context wiring that fills it |
| 02 | **[Why context, not `cloneElement`](02-why-context.md)** | The obvious alternative and how it fails silently; the guard that throws; what memoizing the value does and does not fix |
| 03 | **[Designing the parts](03-designing-the-parts.md)** | Dot notation vs named exports, the three ways a part learns which one it is, controlled vs uncontrolled parents, recovering structural freedom |
| 04 | **[The costs and the limits](04-the-costs-and-limits.md)** | Re-renders, tree-shaking, typing, Server Components, testing, discoverability — and when not to reach for it |

**Four chunks, ~1,050 lines.** Master tier: this is a pattern you build from, and
the failure modes are not obvious from the call site.

## The one-paragraph version

The parent owns state and publishes it through context. Each part reads that
context to find out what to render. The caller arranges the parts however they
like — nested, wrapped, reordered, conditionally rendered — and it keeps working,
because **context does not care about the structure between provider and
consumer.** That single property is the entire reason the pattern uses context
rather than inspecting `children`.

## Where this connects

- **→ [Children patterns](../../phase-2-components/08-children-patterns.md)** —
  where the pattern is introduced alongside the wrapper, layout and
  children-as-a-function shapes.
- **→ [Composition over configuration](../../phase-2-components/03-composition/README.md)** —
  the problem compound components solve at multi-part scale.
- **→ [Headless components](../06-headless-components/README.md)** — compound
  components are one of the four delivery shapes for a headless widget, and the
  least headless of them.
- **→ [The context re-render problem](../../phase-5-refs-context-reducers/05-context-re-render-problem.md)** —
  the cost this pattern pays, and the split that reduces it.
- **→ [The default context value](../../phase-5-refs-context-reducers/13-default-context-value.md)** —
  why the context defaults to `null` and the guard hook throws.
- **→ [Element manipulation](../../phase-2-components/16-element-manipulation.md)** —
  `cloneElement` and `Children`, which React's own docs call fragile, and which
  chunk 01 explains you should not use here.
- **→ [Polymorphic components](../supporting/polymorphic-components.md)** — the
  `as` prop that gives back the structural freedom this pattern takes away.

---

Index: [React patterns](../README.md) · Start → [01 · The mechanism](01-the-mechanism.md)
