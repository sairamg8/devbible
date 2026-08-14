---
title: "Phase 8 — Concurrent rendering, Suspense and transitions"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8.** No sandbox and **no console blocks** — every claim is
> validated against primary documentation and each page's `> Verified:` line names
> its sources.

🚧 **In progress — 7 of 18 topics written.**

**React can start rendering, stop, do something more urgent, and throw the unfinished
work away.** Everything in this phase is a consequence of that one sentence — including
why the purity rules of [Phase 7](../phase-7-custom-hooks/README.md) stopped being style
advice and became a correctness requirement.

| # | Topic | Tier | In one line |
|---|---|---|---|
| 01 | **[`startTransition` and `useTransition`](01-usetransition/README.md)** | <span className="db-tier t-master">Master</span> | Marking an update non-urgent, and what `isPending` really tells you |
| 02 | **[`<Suspense>`](02-suspense/README.md)** | <span className="db-tier t-master">Master</span> | The boundary, the fallback, and what "suspending" means |
| 03 | **[What can actually suspend](03-what-can-suspend.md)** | <span className="db-tier t-master">Master</span> | `lazy`, `use`, server data — and why a `fetch` in an effect never will |
| 04 | **[`use(promise)`](04-use-promise.md)** | <span className="db-tier t-master">Master</span> | Reading a promise during render, and the stability requirement |
| 05 | **[Request waterfalls](05-request-waterfalls.md)** | <span className="db-tier t-master">Master</span> | Three boundaries, three sequential round trips — and the fixes |
| 06 | **[What concurrent rendering means](06-what-concurrent-rendering-means.md)** | <span className="db-tier t-understand">Understand</span> | Interruptible, prioritised, discardable renders |
| 07 | **[Urgent vs transition updates](07-urgent-vs-transition.md)** | <span className="db-tier t-understand">Understand</span> | Which interactions belong in which bucket |
| 08 | `useDeferredValue` | <span className="db-tier t-understand">Understand</span> | A value that lags, versus an update you control |
| 09 | Async transitions (React 19) | <span className="db-tier t-understand">Understand</span> | Pending state spanning an `await`, and the rules after it |
| 10 | Suspense boundary placement | <span className="db-tier t-understand">Understand</span> | Granularity, layout shift, and getting the shell out first |
| 11 | Suspense inside a transition | <span className="db-tier t-understand">Understand</span> | The fallback is deliberately *not* shown — the phase's biggest surprise |
| 12 | `use(context)` | <span className="db-tier t-understand">Understand</span> | Reading context conditionally, the one legal exception |
| 13 | `cache` and `cacheSignal` | <span className="db-tier t-understand">Understand</span> | Deduplicating across one server render, and aborting a discarded one |
| 14 | `<Activity>` (19.2) | <span className="db-tier t-understand">Understand</span> | Hiding a subtree while keeping its state |
| 15 | Tearing | <span className="db-tier t-understand">Understand</span> | One render, two values, because it was interrupted |
| 16 | Error boundaries and Suspense together | <span className="db-tier t-understand">Understand</span> | The loading/error pair, and the order they nest in |
| 17 | ⚠ `<ViewTransition>` and friends | <span className="db-tier t-know">Know</span> | **Experimental — not in 19.2.8.** What today's answer is instead |
| 18 | ⚠ `SuspenseList` | <span className="db-tier t-when">When Needed</span> | Still `unstable_`; ordering how sibling boundaries reveal |

## Why this phase sits after Phase 7

Because the Rules of React are its precondition, not its neighbour. A render that can be
**interrupted, discarded and re-run** is only safe if rendering does nothing but compute
— which is exactly what
[Phase 7 · 04](../phase-7-custom-hooks/04-rules-of-react-beyond-hooks/README.md) spends
four chunks establishing. Phase 8 is where the bill for breaking those rules arrives:
tearing, duplicated side effects, and state that disagrees with itself inside a single
commit.

## The experimental trap

🔴 **`ViewTransition`, `addTransitionType` and `SuspenseList` are not in stable React
19.2.8.** They appear throughout 2025–26 blog posts, conference talks and tutorials, and
adopting them means shipping the experimental channel. Topics 17 and 18 carry them with
that warning attached rather than omitting them, because the reason people meet them is
that everyone else is writing about them.

## Where this phase connects backwards

- **[Phase 7 · Rules of React](../phase-7-custom-hooks/04-rules-of-react-beyond-hooks/README.md)**
  — purity as the precondition for interruptible rendering.
- **[Phase 7 · `use`](../phase-7-custom-hooks/10-use-breaks-the-rule.md)** — the API
  topics 04 and 12 are built on, including the promise-caching requirement.
- **[Phase 5 · `useSyncExternalStore`](../phase-5-refs-context-reducers/15-usesyncexternalstore.md)**
  — the fix for tearing, which only exists because rendering is concurrent.
- **[Phase 6 · `useDeferredValue`](../phase-6-performance/17-usedeferredvalue.md)** —
  introduced there as a performance tool, explained here as a concurrency one.
- **[Phase 6 · Lazy loading](../phase-6-performance/12-lazy-loading.md)** — `lazy()` plus
  a boundary, which topic 03 generalises.

## Coverage

**18 topics.** 7 written so far → 11 files. Both are chunked into two parts each — topic
01 (496 lines) into what a transition *is* and how you observe and choose it; topic 02
(511 lines) into the boundary's own behaviour and what it does to the tree inside it.

## Gate

Explain why a filter typed into a search box stays responsive with `useDeferredValue`
but not with `useState` alone, and why wrapping a navigation in `startTransition` makes
the spinner **disappear** rather than appear.

---

← Index: [React — Explanations](../README.md) ·
Prev: [Phase 7 — Custom hooks and the Rules of React](../phase-7-custom-hooks/README.md)
