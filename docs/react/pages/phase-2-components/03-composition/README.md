---
title: "Composition over configuration"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component),
> [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context)
> and [`Children` — alternatives](https://react.dev/reference/react/Children).
> No sandbox script backs this topic; claims are cited, not measured.

Passing elements instead of growing a twelve-boolean API — and the reason it is
more than a style preference: it is how you fix prop drilling, and in a Server
Components app it is the only way to put server content inside a client
boundary.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The configuration trap](01-the-configuration-trap.md)** | How a three-prop component becomes twenty-three, and what that actually costs |
| 02 | **[Slots, children and the context hole](02-slots-and-children.md)** | One slot, many slots, compound components — and why composition beats drilling |

**Split at 300 lines on a concept boundary.** Chunk 01 is the problem and the
inversion; chunk 02 is the three concrete patterns and the scope mechanism
behind them.

## Where this connects

- **← Phase 1** — [`children`](../../phase-1-jsx/09-children.md) has the
  mechanics: the shape the compiler picks, and why `children.map()` throws on a
  single child.
- **→ [Children patterns](../08-children-patterns.md)** — the wrapper, layout
  and function-as-children shapes in detail.
- **→ [Render props](../12-render-props/README.md)** — the fourth slot form, for when
  the parent must supply values to what it renders.
- **→ [Element manipulation](../16-element-manipulation.md)** — why slicing
  `children` apart is the fragile way to fake multiple slots.
- **→ Phase 5** — context, and splitting a context that re-renders too much.
- **→ Phase 10** — composition stops being a style choice and becomes the
  mechanism keeping Server Components out of the client bundle.

---

← Index: [Phase 2](../README.md) · Start → [The configuration trap](01-the-configuration-trap.md)
