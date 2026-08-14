---
title: "Cleanup"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
> and [`useEffect`](https://react.dev/reference/react/useEffect)
> (Parameters, Caveats, Troubleshooting).
> No sandbox script backs this topic; claims are cited, not measured.

React runs setup and cleanup as many times as it needs to, not once each. So the
only correct effect is one where **setup → cleanup → setup is indistinguishable
from setup alone** — an invariant you can check, not a style preference.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The cleanup contract](01-the-cleanup-contract.md)** | Why cleanup is not unmount code, the old-values closure, symmetry, and the ref anti-fix |
| 02 | **[Cleanup recipes](02-cleanup-recipes.md)** | react.dev's five cases — widgets, events, animations, fetching, analytics — and when none is needed |
| 03 | **[When cleanup is not the answer](03-when-cleanup-is-not-the-answer.md)** | Buying a product, initializing the application, and what the remount is really testing |

**Split at 300 lines on concept boundaries.** Chunk 01 is the contract and how
to satisfy it; chunk 02 is the catalogue of setups and their inverses; chunk 03
is the two cases where the double-invocation means the code was never an effect.

## Where this connects

- **← [What an effect is for](../01-what-an-effect-is-for.md)** — the
  effects-versus-events test, which chunk 03 is a direct application of, and the
  client-only constraint behind the `typeof window` guard.
- **← [`useEffect` anatomy](../02-useeffect-anatomy.md)** — the cleanup-then-setup
  ordering and the `async`-setup warning that stops cleanup existing at all.
- **← [The dependency array](../03-the-dependency-array.md)** — a lied-about
  dependency leaves the cleanup holding handles it is never asked to release.
- **→ [`StrictMode` double-invocation](../05-strictmode-double-invocation.md)** —
  the extra cycle from the other direction: what it is stress-testing and why.
- **→ [Race conditions](../08-race-conditions.md)** — the `ignore` flag in full,
  plus the `AbortController` variant.
- **→ [Timers, listeners and observers](../14-timers-listeners-observers.md)** —
  each API's specific inverse and the leak you get without it.

---

← Index: [Phase 4](../README.md) · Start → [The cleanup contract](01-the-cleanup-contract.md)
