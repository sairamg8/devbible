---
title: "Lifting state up"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Sharing State Between Components](https://react.dev/learn/sharing-state-between-components),
> [Thinking in React](https://react.dev/learn/thinking-in-react) and
> [`memo`](https://react.dev/reference/react/memo). No sandbox script backs this
> topic; claims are cited, not measured.

Two components must agree, so the information moves above both. A three-step
mechanical procedure — and a consequence nobody mentions until the app is slow.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The procedure](01-the-procedure.md)** | Remove, hardcode, then add state — and how to find the right owner |
| 02 | **[The cost, and how to pay less of it](02-the-cost.md)** | The re-render moves up with the state; four ways to narrow it |

**Split at 300 lines on a concept boundary.** Chunk 01 is the mechanics and the
single-source rule; chunk 02 is the structural consequence and the four fixes,
ordered cheapest-first.

## Where this connects

- **← [Controlled vs uncontrolled](../04-controlled-vs-uncontrolled/README.md)**
  — controlling a value is lifting it. Same operation, same cost.
- **← [Composition](../03-composition/02-slots-and-children.md)** — passing
  elements is the fix for the prop drilling that lifting produces, and it is
  also the cheapest way to stop a subtree re-rendering.
- **→ Phase 3** — immutable updates, derived state, and why an effect that syncs
  state to state is the antipattern behind most duplicated state.
- **→ Phase 5** — context, for when lifting has to cross too many layers.
- **→ Phase 6** — `memo`, the Compiler, and the measured version of the
  re-render cost described here.
- **→ Phase 12** — server data is a cache, not lifted UI state.

---

← Index: [Phase 2](../README.md) · Start → [The procedure](01-the-procedure.md)
