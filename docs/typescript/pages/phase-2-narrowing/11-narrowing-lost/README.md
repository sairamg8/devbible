---
title: "Narrowing you lose without noticing"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. The reassignment, callback and
> `await` results are **sandbox-measured** in
> `sandbox/ts-p2/ex2-guards-and-loss.sh`; that run saved no output file, so the
> findings appear in prose and neither chunk carries a console block. `TS18047`
> was read out of the compiler's diagnostic table (⚠️ TypeScript **6.0.3**).
> Aliased conditions from the **4.4** release notes, element access from **4.7**.

*"I checked it three lines ago. Why is it possibly `undefined` again?"*

Every other page in this phase creates a narrowing. This one is about where they
go, and it is the page that explains most of the phase's real-world friction.
The organising idea is one sentence:

> **A narrowing belongs to a reference, and lasts only while the compiler can be
> sure that reference still denotes what it denoted at the check.**

| # | Chunk | What it covers |
|---|---|---|
| 01 | [How a narrowing dies](./01-how-a-narrowing-dies.md) | The reference model, reassignment, the callback case and `TS18047`, why `const` is the fix and why `!` is not |
| 02 | [The cases that surprise you](./02-the-surprising-cases.md) | `await` **keeps** the narrowing and why that is unsound, properties across function calls, aliased conditions (4.4), element access (4.7), and the four patterns that end the problem |

## 🔴 The measurement that reshaped this topic

The `ex2` script was written expecting **both** a callback and an `await` to
destroy a narrowing. Only the callback did — one `TS18047` on the `forEach`
line, nothing on the `await`.

That result is not a detail. It means the two cases are opposite in character:

- **The callback case is a false positive.** `forEach` really does call its
  argument immediately; the compiler refuses to assume so and you work around it.
- **The `await` case is a false negative.** Other code genuinely runs during the
  suspension, and the compiler keeps the narrowing anyway.

A claim already shipped on
[Phase 1 · `null` and `undefined`](../../phase-1-type-vocabulary/10-null-and-undefined.md)
was corrected because of this run.

## Phase gate

You are done with this topic when you can predict, before compiling, whether a
narrowing survives into a callback, across an `await`, and across a function call
that touches a property — and when your reflex on seeing `TS18047` is a `const`
capture rather than a `!`.

## Where this connects

- **← [02 · Truthiness and equality](../02-truthiness-and-equality.md)** — the
  narrowings that get lost here are the ones created there.
- **← [09 · Assertion functions](../09-assertion-functions/README.md)** — an
  assertion produces an ordinary narrowing, so it is lost in all the ordinary
  ways.
- **→ [13 · The non-null assertion `!`](../13-non-null-assertion.md)** — the
  wrong fix for everything on this page, and why it is so tempting.
- **→ [05 · Discriminated unions](../05-discriminated-unions.md)** — attaching
  the narrowing to the value instead of to a moment in the control flow.
- **→ Phase 8 (TypeScript in React)** — a component body is almost entirely
  callbacks that outlive the render they were created in, which is why this is
  the single most-hit page of the phase in React code.

---

← Prev: [10 · `satisfies`](../10-satisfies/README.md) · Next → [12 · `unknown` in `catch`](../12-unknown-in-catch.md)
