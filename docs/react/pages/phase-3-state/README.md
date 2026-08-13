---
title: "Phase 3 — State and the render cycle"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8.** No sandbox and **no console blocks** — every claim is
> validated against primary documentation and each page's `> Verified:` line
> names its sources. The two measured facts this phase leans on (index keys not
> remounting, and the missing-key warning being deduped) come from Phase 1's
> `sandbox/react-p1` and are linked to the pages that own them.

The phase that decides whether React makes sense to you. Every "why didn't it
update", every stale value, every infinite loop is here — and almost all of it
reduces to three facts: **state is a snapshot**, **React compares with
`Object.is`**, and **state belongs to a position in the tree**.

The load-bearing pages are **02**, **03**, **06** and **08**. If you read four,
read those.

| # | Topic | Tier | In one line |
|---|---|---|---|
| 01 | **[`useState`](01-usestate.md)** | <span className="db-tier t-master">Master</span> | State belongs to a position, and React finds it by counting hook calls |
| 02 | **[State is a snapshot](02-state-is-a-snapshot.md)** | <span className="db-tier t-master">Master</span> | Setting state only changes it for the *next* render |
| 03 | **[Updater functions](03-updater-functions.md)** | <span className="db-tier t-master">Master</span> | Three cases where it is required, not stylistic |
| 04 | **[Automatic batching](04-automatic-batching.md)** | <span className="db-tier t-master">Master</span> | Everywhere since React 18 — and not the same thing as the snapshot |
| 05 | **[Immutable updates](05-immutable-updates/README.md)** | <span className="db-tier t-master">Master</span> | Mutate and the update vanishes with no error |
| 06 | **[Derived state](06-derived-state.md)** | <span className="db-tier t-master">Master</span> | The sync-with-an-effect antipattern costs a visible frame |
| 07 | **[Resetting state with `key`](07-resetting-state-with-key.md)** | <span className="db-tier t-master">Master</span> | The supported "this is a different thing now" |
| 08 | **[What triggers a re-render](08-what-triggers-a-re-render.md)** | <span className="db-tier t-master">Master</span> | Two reasons — and "props changed" is not one |
| 09 | **[Lazy initial state](09-lazy-initial-state.md)** | <span className="db-tier t-understand">Understand</span> | One pair of parentheses between once and every render |
| 10 | **[Structuring state](10-structuring-state.md)** | <span className="db-tier t-understand">Understand</span> | Five principles; make impossible states unrepresentable |
| 11 | **[Bailing out](11-bailing-out.md)** | <span className="db-tier t-understand">Understand</span> | Why mutation fails *silently* |
| 12 | **[Render order](12-render-order.md)** | <span className="db-tier t-understand">Understand</span> | Renders top-down, effects bottom-up |
| 13 | **[The update queue](13-the-update-queue.md)** | <span className="db-tier t-understand">Understand</span> | Predict the final value on paper |
| 14 | **[State in lists](14-state-in-lists.md)** | <span className="db-tier t-understand">Understand</span> | Index keys corrupt data rather than losing state |
| 15 | **[Preserving and resetting](15-preserving-and-resetting.md)** | <span className="db-tier t-understand">Understand</span> | A conditional wrapper silently wipes the subtree |
| 16 | **[Updating state during render](16-updating-state-during-render.md)** | <span className="db-tier t-understand">Understand</span> | Legal, documented, and usually the wrong tool |
| 17 | **[Infinite render loops](17-infinite-render-loops.md)** | <span className="db-tier t-understand">Understand</span> | Three shapes; the error names none of them |

## Coverage

**17 topics → 17 pages**, one for one. One topic runs past the 300-line file cap
and becomes a topic directory:

| Topic | Chunks | Split at |
|---|---|---|
| 05 Immutable updates | 2 | objects and nesting ↔ arrays and tooling |

**19 content files.** Longest file 300 lines; nothing over.

## How these pages were verified

| Source | Used for |
|---|---|
| react.dev **Learn** — State as a Snapshot, Queueing a Series of State Updates, Updating Objects/Arrays in State, Choosing the State Structure, You Might Not Need an Effect, Render and Commit, Preserving and Resetting State, Rendering Lists | Most of the phase |
| react.dev **Reference** — `useState`, `flushSync` | The precise caveats: bail-out semantics, StrictMode double-invocation, the rules for setting state during render |
| **React v18 blog** §Automatic batching | Which cases were not batched before 18 |
| **MDN** — `Array.prototype.toSorted` | The ES2023 copying methods, noted on the page as an addition to react.dev's table |
| **Phase 1 sandbox** (`react-p1/ex06`) | Index-key behaviour and the deduped key warning, linked rather than restated |

## Four results worth carrying forward

- **A bail-out is not a promise your component will not run.** The `useState`
  caveat says React *"may still need to call your component before skipping the
  children"*. Safe only because purity is assumed
  ([11](11-bailing-out.md)).
- **Batching and the snapshot are different things.** Batching decides how many
  renders; the snapshot decides what the value is. Turning batching off would
  not fix three `setCount(count + 1)` calls
  ([04](04-automatic-batching.md)).
- **The updater form is often a fix for a dependency array**, not just a value —
  it removes the state from the effect's dependencies entirely
  ([03](03-updater-functions.md)).
- **Index keys do not remount.** State stays with the *position* while the data
  moves, so the symptom is a ticked checkbox on the wrong row — worse than a
  reset, and it never errors ([14](14-state-in-lists.md)).

## Gate

Move on when you can, **on paper and without running it**:

1. Predict the exact sequence of renders and the final state for a handler that
   calls `setCount(count + 1)` three times, then the same handler using the
   updater form — and explain the difference.
2. Say why mutating state and calling the setter produces no error and no
   update.
3. Name the three shapes of an infinite render loop and the different fix for
   each.
4. Decide, for a given value, whether it belongs in state at all.

---

← Index: [React — Explanations](../README.md) ·
Prev: [Phase 2 — Components, props and composition](../phase-2-components/README.md) ·
Start → [`useState`](01-usestate.md)
