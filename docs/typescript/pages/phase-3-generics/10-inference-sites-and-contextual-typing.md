---
title: "Inference sites and contextual typing"
sidebar_label: "10 · Inference and context"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Type Inference*,
> *Contextual Typing*, *Generics → Type argument inference*). `TS7006`
> (*"Parameter '{0}' implicitly has an '{1}' type."*) and `TS2345` were read out
> of the **compiler's own diagnostic table**. ⚠️ Install inspected: TypeScript
> **6.0.3**, not the 7.0.2 this corpus targets. **No console block** — no sandbox
> run covers this phase.

Types move in **two directions** and most confusion about generics is a
disagreement about which one is running.

- **Inference is bottom-up.** The compiler looks at the values you passed and
  works out the type — `first([1, 2, 3])` gives `T = number`.
- **Contextual typing is top-down.** The compiler looks at the position an
  expression sits in and pushes a type *into* it — `const f: (x: string) => void
  = x => …` gives `x` the type `string` with no annotation.

Both run, they interleave, and knowing which one you are relying on is the
difference between a signature that works and one that mysteriously produces
`any`.

## Contextual typing, on its own

An expression in a typed position inherits that type:

```ts
const handler: (e: MouseEvent) => void = e => e.clientX;    // e: MouseEvent

window.addEventListener('click', e => e.clientX);           // e: MouseEvent

const users: User[] = [{ id: '1', name: 'Ada' }];           // the literal is a User

[1, 2, 3].map(n => n * 2);                                  // n: number
```

**None of those parameters is annotated and none is `any`.** The context supplies
the type: an annotation on the variable, the declared parameter type of
`addEventListener`, the element type of the array being assigned.

Take the context away and you get the error that names the whole mechanism:

```ts
const handler = e => e.clientX;
```

```text
error TS7006: Parameter 'e' implicitly has an 'any' type.
```

`TS7006` almost always means *"this expression is not in a typed position"* — the
fix is usually to give it one rather than to annotate the parameter.

## How the two directions interleave in a generic call

This is the part that matters, and it is the ordering already used in
[topic 01](./01-generic-functions-and-inference/02-where-inference-comes-from.md):

```ts
declare function map<T, U>(arr: T[], fn: (item: T) => U): U[];

map(['a', 'bb'], s => s.length);
```

1. **Inference (bottom-up)** solves `T = string` from the first argument.
2. **Contextual typing (top-down)** then pushes `(item: string) => U` into the
   arrow, which is what types `s`.
3. **Inference again** reads `U = number` from the arrow's return.

The compiler alternates. And because step 2 depends on step 1, **argument order
is load-bearing**:

```ts
declare function badMap<T, U>(fn: (item: T) => U, arr: T[]): U[];

badMap(s => s.length, ['a', 'bb']);
```

`T` has not been solved when the arrow is checked, so there is no context to push
in, and `s` is an implicit `any` (`TS7006`) — or, with the flag off, a silent
`any`, which is worse. **Put the type-determining argument first.** Every
well-designed API of this shape does.

## Inference from the contextual type

When there is *nothing* to infer from in the arguments, the contextual type can
supply the answer:

```ts
declare function create<T>(): T[];

const xs = create();                  // T = unknown  → unknown[]
const ys: string[] = create();        // T = string   → the context supplied it
```

This refines the statement in [topic 01](./01-generic-functions-and-inference/README.md)
that a parameter with no inference site falls back to `unknown`: that is what
happens **with no context**. Given one, the compiler will use it.

⚠️ **Do not design around this.** It is a lower-priority source than the
arguments, it fails the moment the call is not in an annotated position, and it
is exactly what makes `getJson<T>(url): Promise<T>` *feel* safe while checking
nothing — the caller's annotation becomes the answer
([topic 08](./08-default-type-parameters.md)). Use it, do not rely on it.

## The three places inference commonly fails

**1. The type parameter appears only in the return position.**

```ts
declare function parse<T>(s: string): T;
```

Nothing to infer from, so the caller decides — an unchecked `as` in generic
clothing. Return `unknown` and make the caller narrow, or take a schema.

**2. The callback comes before the type-determining argument.** Covered above:
`TS7006` on the callback parameter, or a silent `any`.

**3. Two arguments disagree about the same parameter.**

```ts
declare function fill<T>(items: T[], fallback: T): T[];

fill([1, 2, 3], 'zero');    // T widens to number | string
```

Both parameters are inference sites, so a wrong second argument **widens** rather
than erroring. The fix is `NoInfer<T>` on the parameters that should conform
rather than decide ([topic 02](./02-constraints/02-constraints-in-practice.md)) —
the compiler intrinsic that exists for exactly this.

## Object and array literals get context too

```ts
type Options = { retries: number; onError?: (e: Error) => void };

configure({
  retries: 3,
  onError: e => e.message,       // e: Error, from the parameter's declared type
  retires: 1,                    // excess property check fires here
});
```

Two things are happening at once. The nested arrow is contextually typed, **and**
the literal is subject to *excess property checking* — which only applies to
**fresh** object literals in a typed position
([Phase 1 · topic 09](../phase-1-type-vocabulary/09-structural-typing.md)).
Assign the same object to a variable first and the typo stops being reported,
which is the classic reason "it errors inline but not when I extract it".

## Making the context explicit when it is missing

Three ways, in order of preference.

**Annotate the receiving position.** Best, because it types everything inside:

```ts
const handlers: Record<string, (e: Event) => void> = {
  click: e => e.type,          // typed
};
```

**Use `satisfies`.** Gives the same contextual typing *and* keeps the inferred
type ([Phase 2 · topic 10](../phase-2-narrowing/10-satisfies/README.md)) — the
better choice when you also want the literal keys:

```ts
const handlers = {
  click: e => e.type,
} satisfies Record<string, (e: Event) => void>;
```

**Annotate the parameter.** The fallback, and the noisiest — it duplicates
information the context should have carried, and it drifts.

## Reading what actually happened

The technique from [Phase 2](../phase-2-narrowing/README.md) works here too:
assign the result to the literal type `1` and read the error, which names the
type the checker is holding. For a *parameter* whose type you are unsure of,
`noImplicitAny` is the cheaper instrument — if it stays silent, the context
supplied a type; if it reports `TS7006`, there was none.

## Trade-off

**Relying on contextual typing** keeps call sites free of annotations, and those
annotations cannot drift out of date because they do not exist. It costs
fragility: reorder a signature, extract an expression into a variable, or move a
callback out of its typed position, and the type quietly disappears.

**Annotating explicitly** is stable under refactoring and self-documenting, at
the cost of verbosity and of two places that can disagree.

The pragmatic line: **rely on context inside a call you control the signature
of; annotate at module boundaries**, where an accidental `any` would spread.

## Gotchas

**Symptom:** `TS7006: Parameter 'e' implicitly has an 'any' type`
**Cause:** The expression is not in a typed position, so there is no context.
**Fix:** Annotate the receiving variable or use `satisfies` — better than
annotating the parameter, because it types everything else in the expression too.

**Symptom:** A callback parameter is `any` in a generic call
**Cause:** The callback appears before the argument that determines `T`.
**Fix:** Reorder the parameters. This is a signature bug, not a call-site one.

**Symptom:** A wrong argument widens `T` instead of erroring
**Cause:** Every parameter mentioning `T` is an inference site.
**Fix:** `NoInfer<T>` on the ones that should conform.

**Symptom:** An excess-property typo is reported inline but not after extracting
it to a variable
**Cause:** Excess property checking applies only to fresh object literals in a
typed position.
**Fix:** Annotate the variable, or use `satisfies` on it.

**Symptom:** A generic call infers correctly in one file and gives `unknown` in
another
**Cause:** The first call was in an annotated position and the second was not, so
the contextual-type fallback vanished.
**Fix:** Do not depend on it — give the signature something in the arguments to
infer from.

## Interview questions

**★ What is the difference between inference and contextual typing?**
Inference is bottom-up — the compiler reads the values you passed and works out
the type. Contextual typing is top-down — it reads the position an expression
sits in and pushes a type into it, which is why `[1,2,3].map(n => n * 2)` types
`n` with no annotation. Both run in a single generic call, alternating.

**★ Why is a callback's parameter sometimes an implicit `any` inside a generic
call?**
Because the type parameter it depends on had not been solved yet. Inference runs
over arguments in order, and the solved `T` is what becomes the callback's
context — so a callback declared *before* the type-determining argument has no
context and gets `TS7006`. Reorder the signature.

**★ Does the contextual type ever supply a generic's type argument?**
Yes, when the arguments give nothing: `const ys: string[] = create()` can infer
`T = string` where a bare `create()` gives `unknown`. It is a lower-priority
source and it disappears the moment the call is not in an annotated position, so
it is not something to design an API around — it is also what makes
`parse<T>(s: string): T` feel safe while checking nothing.

**Why does an excess-property typo disappear when you extract the object into a
variable?**
Excess property checking only applies to *fresh* object literals in a typed
position. Once the literal is assigned to an unannotated variable it is no longer
fresh, and only ordinary structural assignability applies. Annotate the variable
or use `satisfies`.

**What is the better fix for `TS7006` — annotating the parameter or the
variable?**
The variable, or `satisfies` on the expression. Annotating the parameter fixes
one symptom and leaves everything else in the expression uncontextualised;
annotating the receiving position supplies context to the whole thing at once.

---

← Prev: [09 · Generic classes](./09-generic-classes.md) · Next → **11 · `infer` in conditional types** *(not written yet)*
