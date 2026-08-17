---
title: "The other eight"
sidebar_label: "03 · The other eight"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08. Every flag description quoted here is the **verbatim
> `description` string from the compiler's own option table**, extracted in
> [chunk 01](./01-what-strict-actually-is.md) from the **TypeScript 5.9.3**
> build and cross-checked against the **7.0.2** binary. `TS7006`, `TS7005`,
> `TS7053`, `TS2564`, `TS2683` and `TS18046` and their exact `{0}` text were
> read from the same numbered table. Version numbers for
> `useUnknownInCatchVariables` (4.4) and `strictBuiltinIteratorReturn` (5.6) are
> from the **TypeScript release notes**. **No sandbox, no console block.**

[Chunk 02](./02-strictnullchecks.md) covered the flag that changes the language.
These eight add checks. Each one closes a specific hole, and knowing which hole
is what lets you adopt them in a sensible order on a codebase that has none of
them.

## `noImplicitAny`

> Enable error reporting for expressions and declarations with an implied 'any' type.

The second-most-expensive flag to adopt, and the one that decides whether the
codebase is typed at all.

```ts
function send(payload) { … }     // payload: implicitly any
```

```text
error TS7006: Parameter '{0}' implicitly has an '{1}' type.
```

Without it, every un-annotated parameter, every un-inferable variable
(`TS7005`), and every index into a type with no index signature (`TS7053`) is
silently `any` — and `any` is contagious, which is topic 03's subject.

📌 **Adopt this before `strictNullChecks`.** Nullable analysis over values whose
types nobody stated is the worst of both worlds — you get noise about `undefined`
on a value that is `any` anyway.

## `strictFunctionTypes`

> When assigning functions, check to ensure parameters and the return values are subtype-compatible.

Makes function-parameter positions **contravariant**, which is the mathematically
correct rule: a function that accepts `Animal` can stand in for one that accepts
`Dog`, not the other way round.

```ts
type Handler = (a: Animal) => void;
const dogHandler = (d: Dog) => d.bark();
const h: Handler = dogHandler;      // error with the flag: a Cat may arrive
```

🔴 **The exception that surprises everyone: it does not apply to methods.**
Parameters declared with method syntax stay **bivariant**, deliberately, so that
`Array<Dog>` remains assignable to `Array<Animal>` — which the standard library
and most real code depend on.

```ts
interface A { f(x: Dog): void }      // method syntax   → bivariant, unchecked
interface B { f: (x: Dog) => void }  // property syntax → contravariant, checked
```

That is a **deliberate unsoundness**, and
[topic 07](../07-unsound-by-design/04-mutation-and-variance.md) lists it as one. The
practical takeaway: if you want the check, declare the callback as a **property**,
not a method.

## `strictBindCallApply`

> Check that the arguments for 'bind', 'call', and 'apply' methods match the original function.

Narrow, cheap, no downside. Without it these three are typed with `any[]`
arguments, so `f.call(null, 'wrong', 'args')` is unchecked. With it they use the
function's real parameter types.

Costs essentially nothing to enable, since almost no code calls them.

## `strictPropertyInitialization`

> Check for class properties that are declared but not set in the constructor.

```ts
class Service {
  private client: Client;      // never assigned
}
```

```text
error TS2564: Property '{0}' has no initializer and is not definitely assigned in the constructor.
```

⚠️ **Requires `strictNullChecks`** — without it, `Client` already includes
`undefined`, so there is nothing to complain about.

The three legitimate answers:

```ts
private client: Client = new Client();      // initialise
private client: Client | undefined;         // admit it
private client!: Client;                    // definite assignment — a promise
```

The third is the declaration-position `!` from
[chunk 02](./02-strictnullchecks.md), and it is the standard escape for classes
populated by an ORM, a DI container or a `setUp` method. It is also the flag
most often disabled wholesale for exactly that reason — a defensible override
([chunk 01](./01-what-strict-actually-is.md)), unlike disabling
`strictNullChecks`.

## `strictBuiltinIteratorReturn`

> Built-in iterators are instantiated with a 'TReturn' type of 'undefined' instead of 'any'.

TypeScript **5.6**, and the narrowest of the nine. `IteratorResult`'s third type
parameter — what a generator returns when it finishes, as opposed to what it
yields — was `any` for built-ins. Now it is `undefined`, which is what built-ins
actually return.

You will meet it only when writing generic code over iterators. It is included
here for completeness and because it is the most common reason a list of "the
strict flags" copied from an article is out of date.

## `noImplicitThis`

> Enable error reporting when 'this' is given the type 'any'.

```ts
const counter = {
  count: 0,
  start() {
    setInterval(function () {
      this.count++;              // 'this' implicitly has type 'any'
    }, 1000);
  },
};
```

```text
error TS2683: 'this' implicitly has type 'any' because it does not have a type annotation.
```

The fix is usually an arrow function, which captures `this` lexically, or an
explicit `this` parameter:

```ts
function handler(this: HTMLButtonElement, ev: Event) { … }
```

That fake first parameter is erased at runtime and exists purely to type `this`
— one of the cleanest examples of a type-only construct in the language.

## `useUnknownInCatchVariables`

> Default catch clause variables as 'unknown' instead of 'any'.

TypeScript **4.4**. `catch (e)` is `unknown`, so you must prove what you caught.

📌 **Already written, twice, and not repeated here.**
[Phase 2 · `unknown` in `catch`](../../phase-2-narrowing/12-unknown-in-catch.md)
owns the language rule — including the asymmetry that `.catch()` still hands you
`any` — and
[phase 7 · `catch (e: unknown)`](../../phase-7-server/04-catch-e-unknown/README.md)
owns what to do with it on a server, where `instanceof` is the weakest available
guard.

The one line worth having here: this flag reliably finds real bugs the day it is
enabled, because `e.message` on a non-`Error` throw used to compile and print
`undefined`. The error it produces is `TS18046` — `'{0}' is of type 'unknown'.`

## `alwaysStrict`

> Ensure 'use strict' is always emitted.

An **emit** flag, not a type-checking one: it parses your source in strict mode
and emits `"use strict"`.

Close to a no-op in a modern project, because **ES modules are always strict**
regardless — so under `module: nodenext` with ESM-detected files there is
nothing for it to add
([phase 7 · the module format](../../phase-7-server/01-tsconfig-for-a-node-service/02-the-module-format.md)).
It still matters for CommonJS-detected files and for scripts.

## Adoption order, if you cannot do it all at once

Cheapest first, and each row's cost is dominated by how much existing code it
touches:

| Order | Flag | Cost | Why here |
|---|---|---|---|
| 1 | `alwaysStrict` | ~0 | emit-only; ESM already strict |
| 2 | `strictBindCallApply` | ~0 | almost no code calls them |
| 3 | `strictBuiltinIteratorReturn` | ~0 | generic iterator code only |
| 4 | `noImplicitThis` | low | a handful of callbacks |
| 5 | `useUnknownInCatchVariables` | low–medium | every `catch` block, but the fixes are mechanical |
| 6 | `strictFunctionTypes` | medium | callback-heavy code; methods are exempt anyway |
| 7 | **`noImplicitAny`** | high | every un-annotated parameter |
| 8 | **`strictNullChecks`** | highest | changes what every type means |
| — | `strictPropertyInitialization` | medium | needs 8 first; often deliberately left off |

📌 The two at the bottom are the two that matter. The other seven are, in
practice, free — which is a good argument for enabling `strict: true` and
overriding only the one or two you genuinely cannot afford yet, rather than
enabling flags one at a time from zero.

## Gotchas

**Symptom:** `strictFunctionTypes` is on and an obviously-wrong callback
assignment is still accepted.
**Cause:** the parameter is declared with **method** syntax, which stays
bivariant by design.
**Fix:** declare it as a property — `f: (x: Dog) => void` — if you want the
check. Otherwise accept it as one of TypeScript's deliberate soundness holes
([topic 07](../07-unsound-by-design/04-mutation-and-variance.md)).

**Symptom:** `strictPropertyInitialization` reports nothing at all.
**Cause:** `strictNullChecks` is off, so every property type already includes
`undefined`.
**Fix:** the flags are ordered; this one needs that one.

**Symptom:** enabling `strictNullChecks` first produced unreadable noise.
**Cause:** `noImplicitAny` was still off, so the analysis ran over values whose
types nobody stated.
**Fix:** `noImplicitAny` first. Types before nullability.

**Symptom:** `this` is `any` inside a `setInterval` callback despite
`noImplicitThis`.
**Cause:** it is not despite — that is the flag reporting exactly what it is
for.
**Fix:** an arrow function, or an explicit `this` parameter.

**Symptom:** a "complete list of the strict flags" from a blog post is missing
two.
**Cause:** the list predates 4.4 or 5.6.
**Fix:** derive it from the compiler — chunk 01 has the one-liner.

## Interview questions

**Which strict flag has a deliberate exception, and what is it?**
`strictFunctionTypes` — it makes function parameters contravariant, but **not
for parameters declared with method syntax**, which stay bivariant. That is
deliberate, so that `Array<Dog>` remains assignable to `Array<Animal>`. If you
want the check on a callback, declare it as a property rather than a method.

**In what order would you enable the nine flags on a legacy codebase?**
The seven cheap ones together — `alwaysStrict`, `strictBindCallApply`,
`strictBuiltinIteratorReturn`, `noImplicitThis`, `useUnknownInCatchVariables`,
`strictFunctionTypes` — then `noImplicitAny`, then `strictNullChecks`, then
`strictPropertyInitialization` (which depends on `strictNullChecks`). In practice
that means enabling `strict: true` and overriding the last two or three.

**Why must `noImplicitAny` come before `strictNullChecks`?**
Because nullability analysis over `any` produces noise rather than information.
`any` already defeats the null check, so the errors you get are about the values
that happened to be typed, not the ones that matter. Types first, then
nullability.

**What does `alwaysStrict` add to an ES-module project?**
Essentially nothing — ES modules are always in strict mode, so there is nothing
for the flag to enforce or emit that is not already true. It matters for
CommonJS-detected files and plain scripts.

---

← [02 · `strictNullChecks`](./02-strictnullchecks.md) · Next → [Topic index](./README.md)
