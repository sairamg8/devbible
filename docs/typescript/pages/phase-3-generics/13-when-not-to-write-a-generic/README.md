---
title: "When *not* to write a generic"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Functions → Guidelines
> for Writing Good Generic Functions*) — the three guidelines and their code
> examples are **quoted verbatim** — and against **typescript-eslint**'s
> `no-unnecessary-type-parameters` rule page. **No console block** — no sandbox
> run covers this phase.

Twelve topics of machinery, and this is the one that decides whether any of it
was worth using. Almost every genuinely bad generic in a real codebase is bad for
the same reason, and the handbook states it in one line:

> Remember, type parameters are for *relating the types of multiple values*. If a
> type parameter is only used once in the function signature, it's not relating
> anything.

That is the whole test. A type parameter is a **variable in the type language**
([topic 01](../01-generic-functions-and-inference/README.md)), and a variable
appearing once in an equation is not being solved for — it is a name for
"whatever".

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The rule and the three guidelines](./01-the-rule-and-the-guidelines.md) | "Appear twice", the nuance that makes it usable, and the handbook's three guidelines with the lint that enforces them |
| 02 | [The unsafe shape](./02-the-unsafe-shape.md) | The return-position-only parameter — an unchecked `as` in angle brackets — and what to write instead |
| 03 | [Dismantling an over-generic API](./03-dismantling-an-over-generic-api.md) | A worked refactor, the full failure-shape catalogue, and when a generic *is* earning its place |

## The two tests, up front

If you take nothing else from this topic:

1. **Count the parameter's positions in the signature**, inferred return type
   included. One position means it relates nothing.
2. **Look for `as T` in the body.** If the implementation has to assert the
   parameter, the compiler cannot see the relationship — because there is not one.

## Where this connects

- **← [01 · Generic functions and inference](../01-generic-functions-and-inference/README.md)**
  — names the return-position-only parameter; this topic dissects it.
- **← [02 · Constraints](../02-constraints/README.md)** — a bound that proves the
  parameter is ceremony, and `TS2558` (type argument lists are all-or-nothing),
  which is what gives an extra parameter a real cost.
- **← [08 · Default type parameters](../08-default-type-parameters.md)** —
  `<T = any>` with no inference site.
- **← [09 · Generic classes](../09-generic-classes.md)** — the `Result` class that
  should have been a discriminated union.
- **← [12 · `const` type parameters](../12-const-type-parameters/README.md)** — a
  `const` on a parameter nothing indexes into.
- **→ Phase 9 (Types at the boundary)** — where "return `unknown` and validate"
  becomes the design of a whole layer rather than one signature.

---

← [Phase 3 index](../README.md) · Next → [01 · The rule and the three guidelines](./01-the-rule-and-the-guidelines.md)
