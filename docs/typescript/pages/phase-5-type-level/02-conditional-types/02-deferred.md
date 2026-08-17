---
title: "When it is deferred"
sidebar_label: "02 · When it is deferred"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Conditional Types* —
> the `createLabel` / `NameOrId` section), whose `IdLabel`, `NameLabel`,
> `NameOrId` and `createLabel` examples are **quoted verbatim**. `TS2322`,
> `TS2344` and `TS2321` are read out of the compiler's own message table and
> confirmed present in **TypeScript 7.0.2**. **No console block** — no sandbox
> run covers this phase.

A conditional type whose checked type is still a type *parameter* cannot be
resolved: the compiler does not know which branch applies until a caller
supplies the argument. It **defers** — carries the unresolved conditional around
— and that single behaviour explains both the pattern's best use and its sharpest
edge.

## The best use: one signature instead of overloads

The handbook's motivating example, verbatim:

```ts
interface IdLabel {
  id: number /* some fields */;
}
interface NameLabel {
  name: string /* other fields */;
}

type NameOrId<T extends number | string> = T extends number
  ? IdLabel
  : NameLabel;
```

```ts
function createLabel<T extends number | string>(idOrName: T): NameOrId<T> {
  throw "unimplemented";
}

let a = createLabel("typescript");
// let a: NameLabel

let b = createLabel(2.8);
// let b: IdLabel

let c = createLabel(Math.random() ? "hello" : 42);
// let c: NameLabel | IdLabel
```

Three call sites, three correct results, one signature. The third is the one that
sells the technique: passing `string | number` gives `NameLabel | IdLabel`,
because the conditional distributed over the union — a set of overloads would
have needed a third declaration to say the same thing, and would have needed a
fourth for the next combination.

**When to reach for this over overloads:** when the output type is a *function* of
the input type. When the two forms genuinely differ in arity or in parameter
names, overloads still read better.

## The sharp edge: the body cannot see what the signature promised

Write an implementation and the trouble starts:

```ts
function createLabel<T extends number | string>(idOrName: T): NameOrId<T> {
  if (typeof idOrName === "number") {
    return { id: idOrName };      // ❌ TS2322
  }
  return { name: idOrName };      // ❌ TS2322
}
```

> **`TS2322`: Type `'{0}'` is not assignable to type `'{1}'`.**

The narrowing worked — inside the `if`, `idOrName` really is a `number`. What did
*not* happen is any narrowing of `T` itself. `NameOrId<T>` is still deferred, and
`{ id: number }` is not assignable to an unresolved conditional, because the
compiler cannot prove the branch. This is a known limitation, not a mistake in
your code, and there are three honest responses:

**1. An internal overload — the usual answer.** Declare the conditional signature
publicly, implement against a looser one:

```ts
function createLabel<T extends number | string>(idOrName: T): NameOrId<T>;
function createLabel(idOrName: number | string): IdLabel | NameLabel {
  return typeof idOrName === "number" ? { id: idOrName } : { name: idOrName };
}
```

The implementation signature is not visible to callers, so the public API keeps
its precision while the body gets a type it can actually satisfy. The cost is
that the compiler no longer checks the two against each other in any deep way —
**the overload is a promise you are making**, and it should be short enough to
read in one screen.

**2. One assertion at the return.** `return { id: idOrName } as NameOrId<T>` is
honest if it is *one* place, commented, in a function small enough to verify by
eye. It is the same trade as the constructor-validated brand in
[phase 4 · topic 07](../../phase-4-classes-declarations/07-branded-nominal-types.md):
the unsafe step appears once, in a place you can review.

**3. Do not return a conditional at all.** If the function is not really a
type-level function — if it has two behaviours that happen to share a name — two
functions are better than one clever signature. Topic 08 makes this argument in
general.

## Deferral is why generic code sees so little

The same rule explains a frustration that shows up all over generic code:

```ts
type Unwrap<T> = T extends Promise<infer U> ? U : T;

function use<T>(value: Unwrap<T>) {
  value.toString();   // ❌ nothing is known about `value`
}
```

While `T` is a parameter, `Unwrap<T>` is a *description of a future type*, and
almost nothing can be assumed about it. Constraints are the tool that gives some
of it back:

```ts
function use<T extends { toString(): string }>(value: T) {
  value.toString();   // ✅ the constraint is what is known
}
```

**A constraint is what the body may rely on; a conditional is what the caller
gets.** Keeping those two roles separate is most of the skill in writing generic
signatures.

## Assignability between conditionals

Two deferred conditionals are assignable to each other only when the compiler can
see they are the same — identical check, identical branches:

```ts
type A<T> = T extends string ? 1 : 2;
type B<T> = T extends string ? 1 : 2;

declare function f<T>(x: A<T>): B<T>;   // ✅ recognised as the same
```

Anything more clever than that is usually rejected, and the rejection is correct:
proving two arbitrary type-level programs equivalent is not something a checker
does. When you find yourself fighting this, the answer is nearly always to
compute the type once, name it, and pass the name around.

Two more diagnostics belong to this territory:

> **`TS2344`: Type `'{0}'` does not satisfy the constraint `'{1}'`.**

The argument fails the type parameter's constraint — the check the conditional
was relying on never got a chance to run. Read the constraint, not the
conditional.

> **`TS2321`: Excessive stack depth comparing types `'{0}'` and `'{1}'`.**

The compiler gave up while comparing two deferred types. It means the same thing
as its better-known sibling `TS2589` — the type-level program is too deep — and
the fix is the same: simplify, name intermediate results, or add a base case.

## Gotchas

**Symptom:** `TS2322` returning an obviously correct value from a function with a
conditional return type
**Cause:** Narrowing the *value* does not narrow the type parameter, and a
deferred conditional accepts almost nothing.
**Fix:** Implement behind an overload, or assert once at the return with a
comment. Do not widen the public signature to make the body compile.

**Symptom:** A generic helper works at every call site but nothing works inside it
**Cause:** The conditional is deferred while the parameter is unresolved.
**Fix:** Put a constraint on the parameter for what the body needs; keep the
conditional for what the caller receives.

**Symptom:** `TS2344` from a caller
**Cause:** The type argument fails the parameter's constraint, so the conditional
never applies.
**Fix:** Fix the argument or loosen the constraint — reading the conditional will
not help.

**Symptom:** Two conditionals that "clearly" produce the same type are not
assignable
**Cause:** The checker only recognises structurally identical conditionals.
**Fix:** Compute once, alias it, and use the alias in both positions.

**Symptom:** `TS2321` or `TS2589` from a chain of conditionals
**Cause:** Depth. Each nested conditional multiplies the work of comparison.
**Fix:** Name intermediate types, cap recursion, and reconsider whether the type
is earning its keep.

**Symptom:** A conditional return type produces a union at a call site where you
expected one branch
**Cause:** The argument's type was a union and the conditional distributed —
`createLabel(Math.random() ? "hello" : 42)` gives `NameLabel | IdLabel`.
**Fix:** That is usually correct. Narrow the argument at the call site if you want
one branch.

## Interview questions

**★ When is a conditional type "deferred", and what follows from that?**
When its checked type is still an unresolved type parameter. The compiler cannot
pick a branch, so it carries the conditional around unresolved. Two consequences:
call sites get precise results once they supply the argument, and the function
*body* can assume almost nothing — narrowing a parameter's value does not narrow
`T`, so returning a concrete object from a function typed `NameOrId<T>` is
`TS2322`.

**★ How do you implement a function whose return type is conditional?**
Declare the conditional signature as an overload and implement against a looser
one — the implementation signature is invisible to callers, so the public API
stays precise. The alternative is a single asserted return in a function small
enough to verify by eye. Both are promises the compiler is not checking, so keep
them short.

**★ When should you prefer a conditional return type over overloads?**
When the output type is genuinely a function of the input type, and especially
when the input can be a union — `createLabel(string | number)` gives
`NameLabel | IdLabel` for free through distribution, where overloads need another
declaration for every combination. Prefer overloads when the forms differ in
arity or parameter meaning rather than in type.

**Why does a constraint help inside a generic function when a conditional does
not?**
Because a constraint is a statement about what `T` *is*, available immediately;
a conditional is a computation about what the caller will *receive*, unavailable
until `T` is known. Constrain for the body, compute for the caller.

**What does `TS2344` tell you that `TS2322` does not?**
That the type *argument* failed the parameter's constraint — the conditional
never got to run. It points at the call site's type argument and the constraint,
not at the branches. `TS2322` is about a value not fitting the type the
conditional produced.

---

← Prev: [01 · The question it asks](./01-the-question.md) · Next → [03 · Composing them](./03-composing.md)
