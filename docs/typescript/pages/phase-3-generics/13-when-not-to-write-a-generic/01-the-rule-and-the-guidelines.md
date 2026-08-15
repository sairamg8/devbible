---
title: "The rule and the three guidelines"
sidebar_label: "01 · The rule and the guidelines"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Functions → Guidelines
> for Writing Good Generic Functions*) — all three guideline titles, rule texts
> and code examples are **quoted verbatim**, comments included — and against
> **typescript-eslint**'s `no-unnecessary-type-parameters` rule page. **No console
> block** — no sandbox run covers this phase.

## Type Parameters Should Appear Twice

> **Rule**: If a type parameter only appears in one location, strongly reconsider
> if you actually need it

```ts
function greet<Str extends string>(s: Str) {
  console.log("Hello, " + s);
}

greet("world");
```

The handbook's own simpler version:

```ts
function greet(s: string) {
  console.log("Hello, " + s);
}
```

Identical behaviour, less to read, and one fewer thing a caller can specify.
`Str` took a literal type in and threw it away — it was never used for anything.

### 🔴 The nuance that makes the rule usable

Stated by the handbook itself: this *"includes the inferred return type"*.

> if `Str` was part of the inferred return type of `greet`, it would be relating
> the argument and return types, so would be used *twice* despite appearing only
> once in the written code.

So **do not count occurrences in the source. Count positions in the signature,
inferred ones included.**

```ts
// ONE position — Str appears once, and the return type is void
function greet<Str extends string>(s: Str): void { }

// TWO positions — appears once in writing, but flows into the inferred return
function echo<Str extends string>(s: Str) { return s; }
```

Without that nuance the rule over-fires on exactly the functions that are most
obviously correct, which is why people who half-remember it end up dismissing it.
`identity` is the canonical case: written once, used twice.

## Use Fewer Type Parameters

> **Rule**: Always use as few type parameters as possible

```ts
function filter1<Type>(arr: Type[], func: (arg: Type) => boolean): Type[] {
  return arr.filter(func);
}

function filter2<Type, Func extends (arg: Type) => boolean>(
  arr: Type[],
  func: Func
): Type[] {
  return arr.filter(func);
}
```

The handbook on `filter2`:

> We've created a type parameter `Func` that *doesn't relate two values*. That's
> always a red flag, because it means callers wanting to specify type arguments
> have to manually specify an extra type argument for no reason. `Func` doesn't do
> anything but make the function harder to read and reason about!

Note the cost named there, because it is the concrete one. It is not merely
noise: type argument lists are **all-or-nothing** (`TS2558`,
[topic 02](../02-constraints/README.md)). A caller who wants to pin `Type`
explicitly must now supply `Func` as well — a type they have no reason to know
and no good way to write.

`(arg: Type) => boolean` already described the parameter perfectly. `Func` added
a name for it and nothing else.

## Push Type Parameters Down

> **Rule**: When possible, use the type parameter itself rather than constraining
> it

```ts
function firstElement1<Type>(arr: Type[]) {
  return arr[0];
}

function firstElement2<Type extends any[]>(arr: Type) {
  return arr[0];
}

// a: number (good)
const a = firstElement1([1, 2, 3]);

// b: any (bad)
const b = firstElement2([1, 2, 3]);
```

Same call, and one returns `any`. The handbook's labels — "good" and "bad" — are
its own.

**Why it happens:** `firstElement1` parameterises the *element*, so `Type` is
solved as `number` and `arr[0]` is `number`. `firstElement2` parameterises the
*whole array* with an `any[]` bound; indexing a value whose type is only known to
extend `any[]` yields `any`, and `any` then spreads silently through everything
downstream.

**The general form:** parameterise the smallest thing you need to name, and write
the surrounding structure out literally. `Type[]` is more informative to the
compiler than `Type extends any[]` — and much more informative to a reader.

This is the constraint-shaped version of the same disease as the other two:
`Type extends any[]` is a bound that proves the parameter is ceremony.

## The lint that enforces all three

`@typescript-eslint/no-unnecessary-type-parameters` — *"Disallow type parameters
that aren't used multiple times."* Its own summary of the principle:

> Type parameters relate two types. If a type parameter is only used once, then
> it is not relating anything.

```ts
// incorrect
function second<A, B>(a: A, b: B): B {
  return b;
}

// correct
function second<B>(a: unknown, b: B): B {
  return b;
}
```

`A` was doing nothing that `unknown` does not do, and `unknown` says so honestly
— it documents "this function does not care what this is", which `A` actively
obscured.

The rule's page cites *The Golden Rule of Generics* from **Effective TypeScript**
and the handbook principle above as its background reading. Turning it on is the
cheapest way to stop this entire category, and the fixes it suggests are almost
always the three guidelines here.

⚠️ **Expect it to fire on existing library-facing code**, where extra parameters
accumulate for compatibility reasons rather than design ones
([topic 08](../08-default-type-parameters.md)). Read each hit; do not bulk-fix.

---

← [Overview](./README.md) · Next → [02 · The unsafe shape](./02-the-unsafe-shape.md)
