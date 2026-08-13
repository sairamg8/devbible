---
title: "Controlled vs uncontrolled components"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Sharing State Between Components](https://react.dev/learn/sharing-state-between-components)
> and [`<input>`](https://react.dev/reference/react-dom/components/input).
> No sandbox script backs this topic; claims are cited, not measured.

Who owns the value — the component or its caller. Asked per piece of state, not
per component, and answered by whether the important information lives in props
or in local state.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Who owns the value](01-who-owns-the-value.md)** | The general definition, the trade, and the five triggers for controlling something |
| 02 | **[The switch warning, and supporting both](02-the-switch-warning.md)** | Why `undefined` decides the mode, and the dual-mode component pattern |

**Split at 300 lines on a concept boundary.** Chunk 01 is design — which mode,
and why; chunk 02 is the failure mode and the both-modes pattern the phase gate
needs.

## Where this connects

- **← Phase 1** —
  [Controlled and uncontrolled form elements](../../phase-1-jsx/13-form-elements/01-controlled-and-uncontrolled.md)
  has the measured DOM behaviour: the markup React produces for each case and
  the real event sequence per keystroke. This topic generalises it past inputs.
- **→ [Lifting state up](../05-lifting-state-up/README.md)** — controlling a
  value *is* lifting it, and carries the same re-render cost.
- **→ Phase 3** — copying props into state, and why an effect that syncs state
  to state renders the wrong value first.
- **→ Phase 9** — uncontrolled forms plus Actions and `FormData`, which changed
  the calculation for large forms in React 19.

---

← Index: [Phase 2](../README.md) · Start → [Who owns the value](01-who-owns-the-value.md)
