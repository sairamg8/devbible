---
title: "Assertion functions"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Narrowing → Assertion
> functions*) and the **3.7 release notes**; `TS2775`/`TS2776` read from the
> compiler's own diagnostic table, and the `asserts` signatures from
> **`@types/node` 26.2.0**. The `asserts v is string` narrowing is
> **sandbox-measured** in `sandbox/ts-p2/ex2-guards-and-loss.sh`. Neither chunk
> carries a console block — that run saved no output file.

[07 · Type guards](../07-type-guards.md) let a check cross a function boundary
and still narrow — inside an `if`. An assertion function is the same idea with
the branch removed: it **throws** when the claim is false, so everything after
the call can assume it held.

```ts
assertIsString(input);
input.toUpperCase();     // string, at the top level — no nesting
```

The cost is that you have deleted the other branch. That makes assertions a
statement about *design*, not just about types: you are declaring that the
failing case is a bug rather than a case.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [What an assertion function is](./01-the-two-forms.md) | Why the narrowing survives the call, `asserts v is T` vs `asserts v`, the guard-vs-assertion decision, the unchecked body, and the runtime obligation to actually throw |
| 02 | [Calling them, and where they belong](./02-calling-and-placing.md) | `TS2775` and the explicit-annotation rule, `TS2776` and qualified names, what `node:assert` really declares, assertion methods on `this`, and the good and bad placements |

## Phase gate

You are done with this topic when you can say why
`const assertIsString = (v: unknown): asserts v is string => …` fails at its
*call site*, fix it two different ways, and name a case in your own code where
an assertion is wrong and a type guard is right.

## Where this connects

- **← [07 · Type guards](../07-type-guards.md)** — the same claim, returned as a
  `boolean` instead of thrown. Both are trusted without verification.
- **← [08 · `as` assertions](../08-as-assertions/README.md)** — the claim with no
  runtime check at all. An assertion function is the version that at least
  promises to fail loudly.
- **→ [06 · Exhaustiveness](../06-exhaustiveness.md)** — `assertNever` is an
  assertion function whose value is the *compile* error, with the throw as a
  backstop.
- **→ [11 · Narrowing you lose](../11-narrowing-lost/README.md)** — an assertion
  produces an ordinary narrowing, so it is lost in all the ordinary ways.
- **→ Phase 10 (Strictness)** — asserting a non-empty tuple is what makes
  `xs[0]` safe under `noUncheckedIndexedAccess`.
- **→ Phase 9 (Types at the boundary)** — where assertion functions should
  *not* be used, and what replaces them.

---

← Prev: [08 · `as` assertions](../08-as-assertions/README.md) · Next → [10 · `satisfies`](../10-satisfies/README.md)
