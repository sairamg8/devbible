---
title: "Immutable updates"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Updating Objects in State](https://react.dev/learn/updating-objects-in-state)
> and [Updating Arrays in State](https://react.dev/learn/updating-arrays-in-state).
> No sandbox script backs this topic; claims are cited, not measured.

React compares state with `Object.is`. Mutate it and the reference is unchanged,
so React concludes nothing happened — and the update vanishes with no error.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Objects and nesting](01-objects-and-nesting.md)** | Two distinct failures, and why spread being shallow is the real trap |
| 02 | **[Arrays, and the tools](02-arrays-and-tools.md)** | The mutating/copying table, ES2023's new methods, Immer vs `structuredClone` |

**Split at 300 lines on a concept boundary.** Chunk 01 is objects and the
copy-the-whole-path rule; chunk 02 is arrays and choosing a tool.

## Where this connects

- **← [Phase 2 · Purity](../../phase-2-components/02-purity/02-what-is-allowed.md)**
  — the local-mutation exception is the same one, and it is what makes
  build-then-hand-over legal.
- **← [State is a snapshot](../02-state-is-a-snapshot.md)** — why a mutation
  corrupts *previous* renders, not just the current one.
- **→ [Bailing out](../11-bailing-out.md)** — the `Object.is` comparison that
  makes a mutated update disappear.
- **→ [Structuring state](../10-structuring-state.md)** — flattening is
  react.dev's first suggestion when nested spreads get deep.
- **→ Phase 6** — structural sharing is what keeps memoization boundaries
  useful, and what a deep clone destroys.

---

← Index: [Phase 3](../README.md) · Start → [Objects and nesting](01-objects-and-nesting.md)
