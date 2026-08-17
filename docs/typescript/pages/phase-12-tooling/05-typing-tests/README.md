---
title: "Typing tests"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** for `satisfies`, `Partial`
> and `as const`. ⚠️ **No test framework is installed in this repository**, so any
> framework claim is documentation-attributed. **No sandbox run, no console block.**

⚠️ **Not to be confused with [topic 04 · Testing types](../04-testing-types/README.md)**,
despite the names. **That topic tests your types. This one keeps test code honestly
typed** — a different problem, and the one with the higher failure rate.

The intuition that tests do not need production-grade design is half right. The
other half is the expensive one:

> 🔴 **A mistyped fixture makes a test pass for the wrong reason — strictly worse
> than a failing test, because a failing test tells you something.**
>
> 🔴 **And the specific failure has no symptom:** a fixture written as
> `{ id: '1' } as User` stops matching `User` the moment `User` gains a required
> field. Production code fails to compile everywhere; **the fixture does not**, and
> the test carries on exercising a contract that no longer exists.

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [Fixtures that cannot lie](./01-fixtures-that-cannot-lie.md) | The factory that **concentrates a contract change into one compile error**; `as const satisfies` for test tables; where `Partial<T>` stops being honest; and how to spend the `as` you genuinely need |
| 02 | [Mocks, spies, and the test directory's type budget](./02-mocks-and-the-test-type-budget.md) | 🔴 An untyped mock **certifies a call signature the codebase does not have** — the assertion passes for a call that could never happen. Derive from the real function; and ⚠️ **none of it matters if the test directory is not in the checked program**, which hides the errors, the `as any` population and your type tests at once |

## Phase gate

You are done when a required field added to a core type **breaks exactly one line in
your test suite** — the factory — rather than none.

The tell that it has not landed: a type change that production code rejects
everywhere and the tests absorb silently.

## Where this connects

- **← [Phase 10 · 12 · chunk 02](../../phase-10-strictness/12-assertion-discipline/02-what-an-as-is-standing-in-for.md)**
  — names the test double as the **one honest `as`** and costs it. This topic is
  what to do about the cost.
- **← [Phase 2 · 10 · `satisfies`](../../phase-2-narrowing/10-satisfies/README.md)**
  and **[Phase 10 · 09 · Excess property checks](../../phase-10-strictness/09-excess-property-checks/README.md)**
  — check without widening, which is exactly what a test table wants.
- **← [01 · Type checking in CI · chunk 02](../01-type-checking-in-ci/02-what-the-gate-guarantees.md)**
  — ⚠️ **if the test directory is excluded from the gate, none of this is enforced**,
  and the unchecked directory hides the assertions as well as the errors.
- **→ [04 · Testing types](../04-testing-types/README.md)** — the other direction,
  and the reason to read the two topic names carefully.

---

← [Phase 12 index](../README.md) · Start → [01 · Fixtures that cannot lie](./01-fixtures-that-cannot-lie.md)
