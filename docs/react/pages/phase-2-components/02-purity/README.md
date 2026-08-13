---
title: "Purity"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Keeping Components Pure](https://react.dev/learn/keeping-components-pure),
> [Rules of React](https://react.dev/reference/rules) and
> [`<StrictMode>`](https://react.dev/reference/react/StrictMode). No sandbox
> script backs this topic; claims are cited, not measured.

Same props, state and context produce the same output; no writes during render
to anything that existed before it. React assumes this of every component and
never verifies it at runtime — every optimisation it ships is a bet on it.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The two rules of a pure component](01-the-two-rules.md)** | Mind your own business; same inputs, same output — and the four ways each is broken |
| 02 | **[What purity still allows](02-what-is-allowed.md)** | Local mutation, where side effects belong, and what impurity actually costs |
| 03 | **[StrictMode, the Compiler and how purity is enforced](03-strictmode-and-the-compiler.md)** | Doubling is the test, and a clean dev run is not proof |

**Split at 300 lines on concept boundaries.** Chunk 01 is the rules and their
violations; chunk 02 is what they still permit and what breaking them costs;
chunk 03 is enforcement and what each tool cannot see. The topic ran to three
chunks rather than two because the "what is allowed" half is what stops the rule
being over-applied — it is not filler and was not trimmed to fit.

## Where this connects

- **← [Function components](../01-function-components/README.md)** — purity is
  the second obligation React attaches to a function once it is a component.
- **← Phase 0** —
  [StrictMode](../../phase-0-how-react-runs/07-strictmode.md) has the measured
  dev-vs-prod console output, and
  [The Compiler](../../phase-0-how-react-runs/11-the-compiler.md) has the
  `_c()` slot mechanics.
- **→ [Props are read-only](../06-props-are-read-only.md)** — the most common
  single violation, with its own failure story.
- **→ Phase 3** — immutable state updates are this rule applied to `useState`.
- **→ Phase 4** — effects are where the side effects purity excludes are
  supposed to live.
- **→ Phase 6** — memoization and the Compiler are the features that cash in
  the purity assumption.

---

← Index: [Phase 2](../README.md) · Start → [The two rules](01-the-two-rules.md)
