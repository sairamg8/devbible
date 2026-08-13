---
title: "`symbol` and `unique symbol`"
sidebar_label: "17 · symbol"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Declarations and results from
> `sandbox/ts-p1/ex7-object-types.sh`. One widely-documented restriction did
> **not** reproduce — see "The restriction that did not fire".

**A symbol is a unique key that cannot collide with any other key.** TypeScript
adds one wrinkle to JavaScript's version: `unique symbol`, a type that identifies
*one specific* symbol rather than symbols in general.

## The two types

```ts
export const KEY = Symbol('key');
export let loose = Symbol('loose');
```

```console
$ tsc --declaration --emitDeclarationOnly --strict --outDir out-ex7 src-ex7/symdecl.ts
$ cat out-ex7/symdecl.d.ts
export declare const KEY: unique symbol;
export declare let loose: symbol;
```

**`const` produces `unique symbol`; `let` widens to `symbol`.** Exactly the
widening rule from [01 · Primitives and inference](./01-primitives-and-inference.md),
applied to symbols: an immutable binding keeps the precise type, a mutable one
loses it.

`unique symbol` is the type of *that one symbol*. Two symbols created with the
same description are still different values and different types:

```ts
const a = Symbol('key');
const b = Symbol('key');
type A = typeof a;
type B = typeof b;
declare const x: A;
const y: B = x;   // error: they are distinct unique symbols
```

## What symbols are actually for

**1. Keys that cannot collide.** Attaching metadata to an object you do not own,
without risking an existing property name:

```ts
const INTERNAL = Symbol('internal');

interface Request { url: string; [INTERNAL]?: { startedAt: number } }

function mark(req: Request) {
  req[INTERNAL] = { startedAt: Date.now() };
}
```

No string key can clash with it, and it is invisible to `Object.keys`,
`JSON.stringify` and `for...in` — which is the point, and also the trap.

**2. The well-known symbols**, which are how a class hooks into language
behaviour:

```ts
class Range {
  constructor(private from: number, private to: number) {}

  *[Symbol.iterator]() {
    for (let i = this.from; i <= this.to; i++) yield i;
  }

  [Symbol.toPrimitive](hint: string) {
    return hint === 'number' ? this.to - this.from : `${this.from}..${this.to}`;
  }
}

[...new Range(1, 4)];          // [1, 2, 3, 4]
`${new Range(1, 4)}`;          // "1..4"
```

`Symbol.iterator`, `Symbol.asyncIterator`, `Symbol.toPrimitive`,
`Symbol.hasInstance` and `Symbol.toStringTag` are the ones worth recognising.
Typing them is ordinary — they are just computed keys with well-known types.

**3. Branded types.** The nominal-typing trick uses a symbol so the brand cannot
be reproduced by accident:

```ts
declare const brand: unique symbol;
type UserId = string & { readonly [brand]: 'UserId' };
```

`declare const` means the symbol never exists at runtime — it is a type-level
tag only ([09 · Structural typing](./09-structural-typing.md)).

## The restriction that did not fire

Most references — and older TypeScript — say a computed property key must be a
`unique symbol`, giving `TS1170` for a plain `symbol`. Measured on 7.0.2, it did
not:

```ts
let loose = Symbol('loose');

interface Maybe { [loose]: string }      // accepted
type Alias = { [loose]: string };        // accepted
```

```console
$ tsc --noEmit --strict src-ex7/sym.ts
exit=0
```

Both forms compiled clean. **Treat "a computed key must be a `unique symbol`" as
version-dependent folklore rather than a current rule**, and if you are targeting
an older compiler, check it there before relying on either behaviour.

The practical advice is unchanged for a different reason: declare symbol keys
with `const` anyway, because a `let` symbol can be reassigned and the key it
names then points somewhere else.

## Symbols and serialisation

```ts
const S = Symbol('s');
const o = { a: 1, [S]: 2 };

Object.keys(o);           // ['a']
JSON.stringify(o);        // {"a":1}
Object.getOwnPropertySymbols(o);   // [Symbol(s)]
```

**Symbol-keyed data does not survive JSON.** That is useful for genuinely
internal metadata and a silent data-loss bug if you use symbol keys for anything
that must cross a network or a `structuredClone`
([Phase 9](../../syllabus/03-in-the-stack.md)).

`Symbol.for('key')` uses a global registry and returns the *same* symbol across
calls and realms — typed as plain `symbol`, not `unique symbol`, precisely
because it is not unique.

## Trade-off

**Symbols** give collision-proof keys and are the only way to implement the
language's protocols. They cost discoverability — invisible to `Object.keys` and
JSON, harder to debug, and awkward to type when they cross module boundaries.

**String keys** are visible, serialisable and easy, and can collide. For
application data that is fine; for metadata attached to somebody else's object it
is not.

## Gotchas

**Symptom:** Symbol-keyed properties vanished from an API response
**Cause:** `JSON.stringify` ignores symbol keys.
**Fix:** Use string keys for anything serialised; keep symbols for in-process
metadata.

**Symptom:** Two `Symbol('key')` values are not equal
**Cause:** Every `Symbol()` call creates a new one — that is the whole feature.
**Fix:** Share one exported constant, or `Symbol.for('key')` for a global
registry.

**Symptom:** A symbol type is `symbol` when you needed `unique symbol`
**Cause:** It was declared with `let`, or returned from a function.
**Fix:** `const`, at module scope.

**Symptom:** `Object.keys` does not show the property
**Cause:** Symbol keys are excluded by design.
**Fix:** `Object.getOwnPropertySymbols`, or `Reflect.ownKeys` for both.

**Symptom:** A branded type can be constructed accidentally
**Cause:** The brand used a string key, which anything can supply.
**Fix:** `declare const brand: unique symbol` and key the brand on it.

## Interview questions

**★ What is the difference between `symbol` and `unique symbol`?**
`symbol` is the type of all symbols; `unique symbol` identifies one specific
symbol value and can only come from a `const` declaration or a `readonly static`
property. `const KEY = Symbol()` gives `unique symbol`; `let loose = Symbol()`
widens to `symbol` — verified in the emitted declarations.

**★ What are symbols actually used for?**
Collision-proof property keys for metadata on objects you do not own; the
well-known symbols that implement language protocols (`Symbol.iterator`,
`Symbol.toPrimitive`); and as the tag in a branded type, where
`declare const brand: unique symbol` guarantees nobody can produce it by
accident.

**★ What happens to symbol-keyed properties when you serialise an object?**
They disappear. `Object.keys`, `for...in` and `JSON.stringify` all skip them —
useful for internal metadata, and a silent data loss if you used them for
anything that crosses a boundary.

**How do `Symbol('x')` and `Symbol.for('x')` differ?**
`Symbol('x')` creates a fresh unique symbol every call; the string is only a
description. `Symbol.for('x')` looks up a global registry and returns the same
symbol for the same key, so it is typed `symbol` rather than `unique symbol`.

**Must a computed property key be a `unique symbol`?**
That is the widely-documented rule and it did **not** reproduce on 7.0.2 — both
an interface and a type alias accepted a plain `let` symbol as a key. Treat it as
version-dependent, and still prefer `const` so the binding cannot be reassigned.

---

← Prev: [`object`, `Object` and `{}`](./16-object-Object-braces.md) · [Phase 1 index](./README.md) · Next phase → [Phase 2 — Narrowing](../../syllabus/01-type-system.md)
