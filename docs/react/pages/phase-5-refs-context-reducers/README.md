---
title: "Phase 5 — Refs, context and reducers"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8.** No sandbox and **no console blocks** — every claim is
> validated against primary documentation and each page's `> Verified:` line
> names its sources.

🚧 **In progress — 1 of 16 topics written.** The table below links what exists;
unlinked rows are not written yet.

The three escape hatches from pure top-down state, and the two hooks that connect
React to the world outside it. Each escape hatch exists because the default model
genuinely cannot express something — and each is misused as a way to avoid the
default model rather than to supplement it.

| # | Topic | Tier | In one line |
|---|---|---|---|
| 01 | **[`useRef`](01-useref.md)** | <span className="db-tier t-master">Master</span> | A mutable box that survives renders and never causes one |
| 02 | DOM refs | <span className="db-tier t-master">Master</span> | Attaching, measuring, focusing, and `.current` being `null` during render |
| 03 | `useReducer` | <span className="db-tier t-master">Master</span> | State transitions as data, and why that makes them testable |
| 04 | `createContext` and `useContext` | <span className="db-tier t-master">Master</span> | Dependency injection for a subtree |
| 05 | The context re-render problem | <span className="db-tier t-master">Master</span> | Every consumer re-renders when the `value` identity changes |
| 06 | Ref callbacks | <span className="db-tier t-understand">Understand</span> | Tied to the node, not the component — and React 19 cleanup |
| 07 | `useImperativeHandle` | <span className="db-tier t-understand">Understand</span> | A deliberately narrow imperative API instead of the raw node |
| 08 | When a ref is the wrong tool | <span className="db-tier t-understand">Understand</span> | The "it works but the UI is stale" bug |
| 09 | `useState` vs `useReducer` | <span className="db-tier t-understand">Understand</span> | The honest decision rule |
| 10 | Reducer patterns | <span className="db-tier t-understand">Understand</span> | Action shape, lazy `init`, and `dispatch` being stable |
| 11 | What context is and is not | <span className="db-tier t-understand">Understand</span> | Not a state manager, and it does not prevent re-renders |
| 12 | Context plus reducer | <span className="db-tier t-understand">Understand</span> | React's own built-in app-state pattern |
| 13 | The default context value | <span className="db-tier t-understand">Understand</span> | The missing-provider bug it silently hides |
| 14 | `useId` | <span className="db-tier t-understand">Understand</span> | Ids that match between server and client; never for keys |
| 15 | `useSyncExternalStore` | <span className="db-tier t-understand">Understand</span> | The reference; the *why* is [Phase 4 · 16](../phase-4-effects/16-external-store.md) |
| 16 | `useDebugValue` | <span className="db-tier t-when">When Needed</span> | Labelling a custom hook in DevTools |

## Coverage so far

**1 topic → 1 content file.** No topic has needed chunking yet.

## Where this phase connects backwards

Phase 4 established several things this phase depends on, and they are linked
rather than restated:

- **[Phase 4 · 15](../phase-4-effects/15-effects-and-refs.md)** — why `ref.current`
  is usable in an effect but not during render, and why a ref cannot be *reacted
  to*. Topics 02 and 06 build directly on it.
- **[Phase 4 · 16](../phase-4-effects/16-external-store.md)** — tearing, and why
  `useSyncExternalStore` exists at all. Topic 15 is the reference half.
- **[Phase 4 · 09](../phase-4-effects/09-effect-lifecycle.md)** — why a ref is not
  a reactive value.
- **[Phase 3 · 03](../phase-3-state/03-updater-functions.md)** — the reducer is
  the same idea generalised: describe the transition, not the result.

## Gate

**Deliverable:** an auth context that a consumer can read without re-rendering
when unrelated context state changes, throws a clear error when its provider is
missing, and exposes `logout()` through a dispatch context that never changes
identity.

---

← Index: [React — Explanations](../README.md) ·
Prev: [Phase 4 — Effects and synchronization](../phase-4-effects/README.md) ·
Start → [`useRef`](01-useref.md)
