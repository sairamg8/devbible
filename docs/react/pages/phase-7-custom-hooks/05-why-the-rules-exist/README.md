---
title: "Why the rules exist"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [State: A Component's Memory](https://react.dev/learn/state-a-components-memory),
> [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks), and
> [Invalid hook call warning](https://react.dev/warnings/invalid-hook-call-warning).
> React runtime error strings are corroborated from issue threads, **not** reproduced
> in a sandbox — this topic carries no console blocks.
> No sandbox script backs this topic; claims are cited, not measured.

**`useState` receives no identifier. React holds an array of state pairs per component
and an index reset to `0` before every render; each call returns the next pair and
increments. Every rule in this phase protects that counter.**

Phase 7 · 01 gave the rules and Phase 7 · 04 gave the wider family. This topic answers
the question that makes them memorable: *why those, and not others?* — because "the
linter says so" survives neither an interview nor a 2 a.m. debugging session.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The array and the index](01-the-array-and-the-index.md)** | The mechanism, a conditional hook traced slot by slot, and why React's two errors catch less than you think |
| 02 | **[Deriving every forbidden place](02-deriving-the-forbidden-places.md)** | Each 🔴 item derived from the mechanism, plus the invalid hook call that is not your fault |

**Split at 300 lines on a concept boundary.** Chunk 01 is the mechanism and its direct
consequence; chunk 02 applies it to the six forbidden places and the second rule.

## The one sentence to keep

**Hook identity is positional, so the rule is: every render must reach the same hooks,
in the same order, while React is rendering that component.** The forbidden list is
that sentence's contrapositive, split into cases — three ways to change the order,
three ways to miss the moment.

## Where this connects

- **← [The Rules of Hooks](../01-the-rules-of-hooks.md)** — the rules themselves, with
  the full ✅/🔴 lists this topic explains.
- **← [Share logic, not state](../03-share-logic-not-state/README.md)** — two callers
  get two states because the state was always in the caller's array, never in the hook.
- **← [Rules of React beyond hooks](../04-rules-of-react-beyond-hooks/README.md)** —
  calling a component as a function puts its hooks in the caller's array, which is this
  mechanism producing that bug.
- **→ [Conditional hooks and the correct restructure](../09-conditional-hooks.md)** —
  what to do instead, once you know why you cannot skip one.
- **→ [`use` breaks the rule on purpose](../10-use-breaks-the-rule.md)** — the one hook
  that may sit in a condition, and why that is safe.
- **↔ [Phase 6 · `eslint-plugin-react-hooks`](../../phase-6-performance/10-eslint-plugin-react-hooks.md)**
  — what catches this statically, and what it cannot see.

---

← Index: [Phase 7](../README.md) · Start → [The array and the index](01-the-array-and-the-index.md)
