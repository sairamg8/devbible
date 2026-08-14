---
title: "The problem `satisfies` solves"
sidebar_label: "01 · The problem it solves"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript 4.9 release notes** (which
> introduced the operator) and the **handbook**. `TS1360`'s exact text —
> *"Type '{0}' does not satisfy the expected type '{1}'."* — was read out of the
> **compiler's own diagnostic table**, not recalled. ⚠️ The compiler inspected was
> TypeScript **6.0.3**, not the 7.0.2 this corpus targets; that is the version
> actually read. **No console block** — no recorded run covers this topic, and a
> plausible `tsc` transcript written from memory is not evidence.

Everything in this phase so far has been about **taking a wide type and getting a
narrow one back**. `satisfies` is the same instinct applied one level earlier: it
stops you from throwing the narrow type away in the first place.

## The problem, in one example

You have a palette. Each entry is either a hex string or an RGB triple. You want
the compiler to check that every colour name is covered and every value has one
of those two shapes.

So you annotate it:

```ts
type ColorName = 'red' | 'green' | 'blue';

const palette: Record<ColorName, string | [number, number, number]> = {
  red:   '#ff0000',
  green: [0, 255, 0],
  blue:  '#0000ff',
};

palette.red.toUpperCase();
```

```text
error TS2339: Property 'toUpperCase' does not exist on type
'string | [number, number, number]'.
```

**The check worked and the knowledge is gone.** You know `red` is a string —
you wrote it two lines up — but the annotation told the compiler that *every*
entry is `string | [number, number, number]`, and it believed you.

This is not a bug. **An annotation is a declaration of what the variable's type
*is*, not a test the value has to pass.** The value is checked against it once,
and from then on the annotation is the type. Anything more specific about the
value is discarded on the spot.

### The two escapes, and why neither works

**Drop the annotation.** Now `palette.red` is `string` and `palette.green` is
`number[]` — but nothing checks the shape. A typo'd key, a missing colour, a
value that is neither a string nor a triple: all fine.

```ts
const palette = {
  red:  '#ff0000',
  gren: [0, 255, 0],     // typo. No error. `blue` is missing. No error.
};
```

**Use `as`.** `as Record<ColorName, string | [number, number, number]>` gets you
the checking-shaped feeling with none of the checking — [08](../08-as-assertions/README.md)
covers exactly what that does, which is nothing. And it lands you back with the
wide type anyway.

So the two options are *check it and lose the detail*, or *keep the detail and
check nothing*. That is the gap.

## What `satisfies` does

```ts
const palette = {
  red:   '#ff0000',
  green: [0, 255, 0],
  blue:  '#0000ff',
} satisfies Record<ColorName, string | [number, number, number]>;

palette.red.toUpperCase();       // string — fine
palette.green[0];                // number — fine
```

**The value is validated against the type, and then the *inferred* type is what
you keep.** The operator is a test, not a declaration. It sits after the
expression, it produces no code, and it is erased along with everything else in
the type layer ([Phase 0 · Erasure](../../phase-0-how-typescript-runs/02-erasure.md)).

Both errors from the "drop the annotation" version now fire:

```ts
const palette = {
  red:  '#ff0000',
  gren: [0, 255, 0],
} satisfies Record<ColorName, string | [number, number, number]>;
```

The missing `blue` and the unknown `gren` are both reported — an object literal
is still subject to excess property checking here, exactly as it would be under
an annotation. The operator's own failure diagnostic is:

```text
error TS1360: Type '{0}' does not satisfy the expected type '{1}'.
```

## The three-way comparison

This is the table worth memorising, because the whole topic collapses into it:

| | Checks the value? | Type you end up with | Runtime cost |
|---|---|---|---|
| **Annotation** `const x: T = …` | ✅ fully | **`T`** — the detail is discarded | none |
| **Assertion** `… as T` | ❌ only that the types overlap | **`T`** — asserted, not verified | none |
| **`satisfies`** `… satisfies T` | ✅ fully | **the inferred type of the expression** | none |

Read the middle column again. **`satisfies` is the only one of the three that
does not change the type of the expression.** That is the entire feature.

A useful way to hold it: an annotation and an assertion both *answer the
question* "what type is this?", and disagree only about whether they checked.
`satisfies` refuses to answer the question at all — it asks a different one,
"would this be acceptable as a `T`?", and leaves the answer to the first question
to inference.

## Where it can and cannot go

`satisfies` is an **expression** operator. It goes after a value:

```ts
const routes = { … } satisfies RouteTable;              // ✅
export default { … } satisfies Config;                  // ✅
fn({ … } satisfies Options);                            // ✅ (rarely useful — see below)

type X = Y satisfies Z;                                 // ❌ not a type operator
function f(a: string satisfies Length) {}               // ❌ not an annotation
```

⚠️ **Passing an argument is the case where it usually buys nothing.** A function
parameter already has a declared type, so the argument is already checked against
it, and the narrower inferred type is discarded the moment it crosses into the
parameter. `satisfies` earns its keep where a value is **stored** and read again
later — a `const`, a module export, a default export — because that is where the
inferred type has a life after the check.

## It composes with `as const`

The two do different jobs and are frequently wanted together:

```ts
const config = {
  retries: 3,
  mode: 'strict',
} as const satisfies { retries: number; mode: 'strict' | 'lax' };

config.mode;      // 'strict'  — the literal, not the union, not `string`
```

**Order matters, and it reads left to right.** `as const` freezes the inferred
type into its most literal form, and `satisfies` then checks *that* frozen type
against the constraint. Written the other way round the phrase is not meaningful
— `as const` is a form of assertion and has to apply to the expression itself.

Without `as const`, `config.mode` would be inferred as `string`, fail the check
against `'strict' | 'lax'`, and you would be back to annotating. Without
`satisfies`, `as const` alone would accept `mode: 'strikt'` without a word.

## Why this belongs in the narrowing phase

Because it is the same subject read backwards. Pages 01–09 are about
**recovering** a specific type from a wide one at runtime — `typeof`, a
discriminant, a guard. `satisfies` is about **never widening in the first
place**, so there is nothing to recover.

Concretely: `palette.red` under the annotation is
`string | [number, number, number]`, and getting back to `string` needs a
`typeof` check that can never fail. Under `satisfies` it is `string` already.
**A narrowing you did not have to write is better than one you did**, and a
surprising number of "why is this a union here?" questions are an annotation
that should have been a `satisfies`.

## Gotchas

**Symptom:** A property that is obviously a string is typed as the whole union
**Cause:** An annotation on the containing object; the annotation *is* the type
once it is applied.
**Fix:** `satisfies` instead, so the inferred type survives the check.

**Symptom:** `satisfies` on a function argument changes nothing
**Cause:** The parameter's declared type is what the value becomes on the way in.
**Fix:** Nothing to fix — use it on stored values (`const`, exports), not
arguments.

**Symptom:** `TS1360: Type '…' does not satisfy the expected type '…'`
**Cause:** The value genuinely does not match — a missing key, a wrong value
shape.
**Fix:** Read the two types in the message; this is the operator working.

**Symptom:** A literal is inferred as `string` and fails the `satisfies` check
against a union of literals
**Cause:** Ordinary widening — a mutable property's type widens to `string`.
**Fix:** `as const satisfies T`, in that order.

**Symptom:** `satisfies` in a type alias or a parameter annotation is a syntax
error
**Cause:** It is an expression operator, not a type operator.
**Fix:** Use it on the value.

## Interview questions

**★ What does `satisfies` do that an annotation does not?**
It checks the value against the type **without becoming** the type. An annotation
validates once and then the annotation *is* the variable's type, so every more
specific fact about the value is discarded. `satisfies` validates and leaves the
inferred type in place, so `palette.red` stays `string` instead of collapsing to
the whole union.

**★ Compare annotation, `as` and `satisfies` in one sentence each.**
An annotation checks the value and gives you the declared type. `as` checks
almost nothing and gives you the asserted type. `satisfies` checks the value
fully and gives you the *inferred* type — it is the only one of the three that
does not change what type the expression has.

**★ Why would you write `as const satisfies T` rather than either alone?**
`as const` keeps literals literal but validates nothing; `satisfies` validates
but cannot stop ordinary widening from turning `'strict'` into `string` before
the check runs. Together, `as const` freezes the inferred type and `satisfies`
checks the frozen version — you get both the literal types and the constraint.

**Does `satisfies` exist at runtime?**
No. It is erased with the rest of the type layer, like an annotation and like
`as`. It has no cost and no observable effect on the emitted JavaScript.

**Where is `satisfies` not worth using?**
On function arguments. The parameter's declared type already checks the value and
already replaces the narrower inferred type on the way in, so there is nothing
for `satisfies` to preserve. It pays off on values that are stored and read
again — `const` declarations and module exports.

---

← [Topic index](./README.md) · Next → [02 · The patterns worth stealing](./02-patterns-and-limits.md)
