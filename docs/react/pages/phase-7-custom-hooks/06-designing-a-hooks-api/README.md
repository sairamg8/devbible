---
title: "Designing a hook's API"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
> and [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore).
> Tuple-versus-object guidance is reasoning from React's own conventions, and is
> labelled as such on the page.
> No sandbox script backs this topic; claims are cited, not measured.

**Name it first — an unclear name is React's own diagnostic that the logic is not ready
to be extracted. Then take reactive values as arguments, wrap handlers in
`useEffectEvent`, and return the thing the caller wants rather than what your
implementation happens to have.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The name and the arguments](01-the-name-and-the-arguments.md)** | Naming as a gate, constraint as the feature, and why arguments are reactive values rather than getters |
| 02 | **[The return value, and the seam](02-the-return-value-and-the-seam.md)** | Tuple vs object, one hook one job, and the rewrite that changed everything except the call sites |

**Split at 300 lines on a concept boundary** — the signature going in, and the contract
coming out.

## The two sentences the topic turns on

> **A good custom Hook makes the calling code more declarative by constraining what it
> does.**

> **You didn't need to change any of the components** to make this migration.

The first is the design principle: finish the sentence *"this hook can only ___"*. The
second is the payoff: `useOnlineStatus` was rewritten from `useState` + `useEffect` to
`useSyncExternalStore`, and no call site moved.

## Where this connects

- **← [Writing a custom hook](../02-writing-a-custom-hook.md)** — the `use` prefix, the
  linter, and the 🔴 `useMount` list this topic gives the principle behind.
- **← [Share logic, not state](../03-share-logic-not-state/README.md)** — a hook that
  reads shared state has a different signature from one that owns it.
- **← [Rules of React beyond hooks](../04-rules-of-react-beyond-hooks/README.md)** —
  arguments and return values are immutable in both directions.
- **→ [The standard set, written out](../07-the-standard-set.md)** — ten hooks whose
  APIs are worth reading as design decisions, not just implementations.
- **→ [Hooks that wrap effects](../08-hooks-that-wrap-effects.md)** — honest
  dependencies across the boundary, in full.
- **→ [Extracting too early](../12-extracting-too-early.md)** — the failure this topic's
  "some duplication is fine" is guarding against.
- **↔ [Phase 4 · `useEffectEvent`](../../phase-4-effects/10-useeffectevent.md)** — the
  mechanism behind the handler-wrapping rule.

---

← Index: [Phase 7](../README.md) · Start → [The name and the arguments](01-the-name-and-the-arguments.md)
