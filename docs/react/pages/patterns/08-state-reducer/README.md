---
title: "The state reducer pattern"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`useReducer`](https://react.dev/reference/react/useReducer),
> [Extracting State Logic into a Reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer),
> [Keeping Components Pure](https://react.dev/learn/keeping-components-pure).
> ⚠️ **Community convention, not a React API.** React documents `useReducer`; it
> does not document or name this use of it. The name comes from the
> Downshift / `react-table` lineage. Judgements are marked as judgements.
> No sandbox script backs this topic; claims are cited, not measured.

**Your component is right for nine callers and wrong for the tenth. Instead of
adding a prop for the exception, let the caller intercept the state transition.**

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | **[The problem and the shape](01-the-problem-and-the-shape.md)** | Why a prop per exception fails, the `(state, action, changes)` signature, and why the third argument is the whole pattern |
| 02 | **[Designing the action surface](02-designing-the-action-surface.md)** | Action types are public API from the first caller — naming, granularity, payloads, typing, and how to change one later |
| 03 | **[Living with it](03-living-with-it.md)** | Testing, debugging, composing it with prop getters and headless hooks, and the honest limits |

**Three chunks, ~750 lines.** Tiered **Understand** rather than Master: you reach
for this when designing a reusable component's API, which is narrower than a
foundational skill — but it has enough surface that one file cannot hold it.

## The one-paragraph version

The component owns a reducer describing all its transitions. It accepts an
optional **`stateReducer(state, action, changes)`** from the caller, which sees
every proposed transition and returns the one to actually apply. The caller
overrides the transitions they care about and inherits the rest.

```jsx
const select = useSelect({
  stateReducer(state, action, changes) {
    if (action.type === useSelect.actions.select) {
      return { ...changes, isOpen: true };   // keep it open, take the rest
    }
    return changes;
  },
});
```

**The whole design is in that third argument.** Without it the caller has to
reimplement the transition and hard-code your state shape; with it they amend a
proposal and stay compatible when the shape grows.

## Where this connects

- **→ [Headless components](../01-headless-components/README.md)** — the pattern
  this is usually shipped alongside. A headless widget encapsulates behaviour; a
  state reducer is how one caller changes part of that behaviour without a fork.
- **→ [Prop getters](../04-prop-getters.md)** — the other half of the same API.
  Chunk 03 shows the two composing.
- **→ [Reducer patterns](../../phase-5-refs-context-reducers/10-reducer-patterns.md)** —
  action shape, discriminated unions and lazy `init`. Read that first if reducers
  themselves are new.
- **→ [`useState` vs `useReducer`](../../phase-5-refs-context-reducers/09-usestate-vs-usereducer.md)** —
  whether you needed a reducer at all, which is the question that comes before
  this one.
- **→ [Controlled vs uncontrolled](../../phase-2-components/04-controlled-vs-uncontrolled/README.md)** —
  the alternative way to hand power to the caller, and chunk 01 sets the two
  against each other.
- **→ [Composition over configuration](../../phase-2-components/03-composition/README.md)** —
  the failure this pattern exists to avoid, arriving one boolean prop at a time.

---

Index: [React patterns](../README.md) · Start → [01 · The problem and the shape](01-the-problem-and-the-shape.md)
