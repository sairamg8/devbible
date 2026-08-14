---
title: "Phase 4 — Effects and synchronization"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8.** No sandbox and **no console blocks** — every claim is
> validated against primary documentation and each page's `> Verified:` line
> names its sources.

🚧 **In progress — 4 of 18 topics written.** The table below links what exists;
unlinked rows are not written yet.

The most misused hook in React, almost always because it is understood as "run
code after render" instead of **"synchronize with something outside React"**.
Almost everything in this phase follows from two ideas: an effect is caused by
*rendering* rather than by an interaction, and **setup and cleanup are a pair
React may run any number of times**.

| # | Topic | Tier | In one line |
|---|---|---|---|
| 01 | **[What an effect is for](01-what-an-effect-is-for.md)** | <span className="db-tier t-master">Master</span> | Synchronizing with an external system — not a lifecycle callback |
| 02 | **[`useEffect` anatomy](02-useeffect-anatomy.md)** | <span className="db-tier t-master">Master</span> | Setup, cleanup, dependencies — and the three array forms |
| 03 | **[The dependency array is not a preference](03-the-dependency-array.md)** | <span className="db-tier t-master">Master</span> | Lying produces an effect that reads one render's values forever |
| 04 | **[Cleanup](04-cleanup/README.md)** | <span className="db-tier t-master">Master</span> | setup → cleanup → setup must be indistinguishable from setup alone |
| 05 | `StrictMode` double-invocation | <span className="db-tier t-master">Master</span> | What the extra cycle is stress-testing |
| 06 | You might not need an effect | <span className="db-tier t-master">Master</span> | The eight cases and their fixes |
| 07 | Fetching data in an effect | <span className="db-tier t-master">Master</span> | Everyone's first answer, and a poor one |
| 08 | Race conditions | <span className="db-tier t-understand">Understand</span> | The `ignore` flag and `AbortController` |
| 09 | An effect has its own lifecycle | <span className="db-tier t-understand">Understand</span> | It starts and stops, independent of mounting |
| 10 | `useEffectEvent` | <span className="db-tier t-understand">Understand</span> | Latest props and state without a dependency |
| 11 | Removing dependencies legitimately | <span className="db-tier t-understand">Understand</span> | Four legitimate moves and two illegitimate ones |
| 12 | `useLayoutEffect` | <span className="db-tier t-understand">Understand</span> | After DOM mutation, before paint |
| 13 | Effect ordering | <span className="db-tier t-understand">Understand</span> | Children before parents, cleanups before setups |
| 14 | Timers, listeners and observers | <span className="db-tier t-understand">Understand</span> | Each API's inverse, and the leak without it |
| 15 | Effects and refs together | <span className="db-tier t-understand">Understand</span> | Measuring, focusing, and React 19 ref cleanup |
| 16 | Subscribing to an external store | <span className="db-tier t-understand">Understand</span> | The tearing problem `useSyncExternalStore` exists to fix |
| 17 | `useInsertionEffect` | <span className="db-tier t-know">Know</span> | For CSS-in-JS libraries, explicitly not application code |
| 18 | Skipping the first run | <span className="db-tier t-know">Know</span> | Usually a sign the logic belonged in a handler |

## Coverage so far

**4 topics → 7 content files.** One topic runs past the 300-line file cap and
becomes a topic directory:

| Topic | Chunks | Split at |
|---|---|---|
| 04 Cleanup | 3 | the contract ↔ the recipes ↔ when it is not the answer |

Longest file 294 lines; nothing over.

## How these pages are verified

| Source | Used for |
|---|---|
| react.dev **[`useEffect` reference](https://react.dev/reference/react/useEffect)** | The richest single source in the phase — every caveat, the three dependency forms, cleanup ordering, both troubleshooting entries |
| react.dev **[Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)** | Effects versus events, the cleanup recipes, the ref anti-fix, the remount principle |
| react.dev **You Might Not Need an Effect** | Topics 06 and the "not an effect" cases |
| react.dev **[`useEffectEvent`](https://react.dev/reference/react/useEffectEvent)** | Topic 10 — rules and caveats |
| **React 19.2 release post** (1 Oct 2025) | Confirming `useEffectEvent` is stable, not experimental, on the 19.2 target |

## Results worth carrying forward

- **You cannot "choose" your dependencies.** To remove one you have to *prove* to
  the linter it is not read — which means changing the code, not the comment.
  Lying does not make the effect run less; it makes it read one render's values
  forever ([03](03-the-dependency-array.md)).
- **Cleanup runs with the old values, before the next setup.** That closure is
  the mechanism that lets it undo the right thing — disconnect from the room it
  was connected to ([04](04-cleanup/01-the-cleanup-contract.md)).
- **Cleanup is tied to the dependencies, not the component's lifetime.** It runs
  on every dependency change while the component sits there alive, which is why
  `componentWillUnmount` is the wrong model
  ([04](04-cleanup/01-the-cleanup-contract.md)).
- ⚠️ **Effect timing relative to paint is not guaranteed in either direction** —
  an interaction-caused effect may run *before* paint, and React may repaint
  before processing state set inside an effect
  ([01](01-what-an-effect-is-for.md)).
- **The double-invocation is testing a real user journey** — visit, navigate
  away, press Back — which remounts components in production too
  ([04](04-cleanup/03-when-cleanup-is-not-the-answer.md)).

## Gate

Move on when you can take a component that fetches on every keystroke with a
`useEffect` and rewrite it so that it debounces, cancels superseded requests,
never renders a response for an old query, and survives `StrictMode` — and
explain, for each of those four, which mechanism does the work.

---

← Index: [React — Explanations](../README.md) ·
Prev: [Phase 3 — State and the render cycle](../phase-3-state/README.md) ·
Start → [What an effect is for](01-what-an-effect-is-for.md)
