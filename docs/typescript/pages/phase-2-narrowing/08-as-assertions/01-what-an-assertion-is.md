---
title: "What an assertion actually is"
sidebar_label: "01 · What it actually is"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** — *Everyday Types → Type
> Assertions*. **No sandbox run covers this page**; the error text below is
> quoted from the handbook, not from a compile, and there is no console block.

`as` looks like a conversion and is not:

**An assertion has no runtime existence at all.** It is erased with the rest of
the type annotations ([phase 0 · erasure](../../phase-0-how-typescript-runs/02-erasure.md)).
It converts nothing, checks nothing, and throws nothing. `input as HTMLInputElement`
compiles to `input`. The only thing it changes is what the checker believes about
the lines that follow — which means a wrong `as` does not fail where it is
written. It fails somewhere later, in code that trusted it.

## Annotation checks; assertion asserts

The two look similar and do opposite things.

```ts
type User = { id: string; name: string };

const a: User = { id: '1' };        // error — Property 'name' is missing
const b = { id: '1' } as User;      // fine. Nothing is missing as far as anyone knows.
```

An **annotation** is a claim the compiler verifies against the value. An
**assertion** is a claim the compiler records instead of verifying. `b.name` will
happily type-check for the rest of the file and be `undefined` at runtime.

So the default is always the annotation. `as` is for when you genuinely know
something the checker cannot see — and each one is a small piece of correctness
moved off the compiler and onto you.

## The one rule `as` still enforces

You cannot assert between two unrelated types in a single step:

```ts
const n = 'hello' as number;
```

> error TS2352: Conversion of type `'hello'` to type `'number'` may be a mistake
> because neither type sufficiently overlaps with the other. If this was
> intentional, convert the expression to `unknown` first.

The rule is that the assertion must move **along the same assignability chain** —
to a supertype (widening, always safe) or to a subtype (narrowing, your claim).
Sideways is rejected.

This is a weak guard rail, and it is worth knowing exactly how weak. It catches
`string → number`. It does not catch `{ id: string } → User`, because those
overlap. And it does not catch anything at all once you take the escape hatch the
error message itself hands you.

## `as unknown as T` — the two-step escape

```ts
const n = 'hello' as unknown as number;   // compiles
```

Widen to `unknown` — every type is assignable to `unknown`, so step one is always
legal — then assert down to anything, because every assertion out of `unknown` is
legal too. Two legal steps compose into the illegal one.

**This is not a trick; it is documented behaviour.** But treat it as a flag.
`as T` says "I know more than the checker". `as unknown as T` says "I know more
than the checker *and* the checker actively disagrees with me". The legitimate
uses are narrow:

- **Test doubles.** A partial mock standing in for a large interface where the
  test only touches three of its fields.
- **Crossing a boundary the type system does not model** — a structured-clone
  round trip, a value returning from a worker, a branded type being minted.
- **Working around a known-wrong third-party declaration**, with the issue link
  in a comment beside it.

Anything else is a design problem being taped over.

## Why the failure arrives late

This is the part worth internalising, because it is what makes a wrong assertion
expensive rather than merely wrong.

A failed *annotation* is reported at the assignment: one error, one line, the
line you are editing. A failed *assertion* is reported nowhere. The compiler
records your claim and proceeds, and every later inference builds on it — a
return type, a generic instantiation, the shape a caller destructures. The crash
surfaces at the first place the value is actually used in a way the real data
cannot support, which may be a different module written by a different person
months later.

There is no diagnostic that connects the two. That is the real cost, and it does
not show up in the diff where the `as` was added.

## Trade-off

`as` buys movement. When a declaration file is wrong, a boundary is unmodelled,
or a test needs a stub, an assertion gets the work done in one line instead of an
afternoon of type gymnastics — and refusing to ever use one is its own kind of
unproductive.

What it costs is the property that makes TypeScript worth running: **that a
compiling program has had its claims checked.** Every `as` is an unchecked claim
that stays true in the compiler's view forever, including after the code around
it changes.

## Gotchas

**Symptom:** `value as number` did not convert the string
**Cause:** Assertions are erased; they never generate code.
**Fix:** `Number(value)`, and assert nothing.

**Symptom:** `TS2352 … neither type sufficiently overlaps`
**Cause:** The assertion goes sideways rather than up or down the assignability
chain.
**Fix:** Do not reflexively insert `as unknown as` — the error is usually
correct. Check whether you meant a different type, a parse, or a conversion.

**Symptom:** A cast that compiled for months now crashes after a refactor
**Cause:** The asserted type changed; the assertion did not, because there is
nothing in it for the compiler to re-check.
**Fix:** A guard or a validator at that spot. This is the failure mode `as` is
*for*, and the reason to keep them out of boundaries.

**Symptom:** The runtime error is thrown far away from any `as`
**Cause:** Assertions fail at use, not at declaration — every inference
downstream trusted the claim.
**Fix:** Treat an unexplained `undefined` as a reason to grep for assertions on
that type, not just for the property access that threw.

## Interview questions

**★ What does a type assertion do at runtime?**
Nothing. It is erased with every other type annotation — `x as T` emits `x`. It
changes only what the checker believes for the rest of the flow, which is why a
wrong assertion never fails where it is written.

**★ What is the difference between `const x: T = v` and `const x = v as T`?**
The annotation is checked against the value; the assertion replaces the check. An
annotation reports a missing property, an assertion accepts it. The annotation is
the default and the assertion is the exception.

**★ Why does `'hello' as number` fail while `'hello' as unknown as number`
compiles?**
An assertion must move along the assignability chain — to a supertype or a
subtype. `string` and `number` are neither, so `TS2352` fires. Widening to
`unknown` is legal (everything is assignable to `unknown`) and asserting out of
`unknown` is legal, so the two-step composes into what the single step forbids.
The error message documents the escape itself.

**Where does a wrong assertion actually surface?**
At the first use the real data cannot support — potentially a different module,
much later, with no diagnostic linking it back. That distance is the argument for
keeping assertions out of code that handles external data.

---

← Prev: [Overview](./README.md) · Next → [02 · Living with assertions](./02-living-with-assertions.md)
