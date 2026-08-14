---
title: "Parameter placement and merging"
sidebar_label: "02 · Placement and merging"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Generics → Generic
> Types*, *Declaration Merging*). `TS2428` (*"All declarations of '{0}' must have
> identical type parameters."*) and `TS2589` (*"Type instantiation is excessively
> deep and possibly infinite."*) were read out of the **compiler's own diagnostic
> table**. ⚠️ Install inspected: TypeScript **6.0.3**, not the 7.0.2 this corpus
> targets. The recursion-depth figure is **sandbox-measured** in
> `sandbox/ts-p1/` and is quoted from that recorded finding, in prose — that run
> saved no output file, so there is **no console block**.

Two things decide how a parameterised type behaves, and neither is about what it
contains: **where the parameter is declared**, and **whether the declaration can
merge**.

## 🔴 Interface-level vs method-level parameters

This is the distinction that separates people who can read library types from
people who cannot.

```ts
interface Box<T> {
  value: T;
  map<U>(fn: (value: T) => U): Box<U>;
}
```

- **`T` is fixed when the type is written.** `Box<string>` picks `T = string`
  once, and every member of that type sees `string`.
- **`U` is chosen at every call.** `box.map(s => s.length)` picks `U = number`
  for that call and no other.

Read it as scope: `T` is a parameter of the *type*, `U` is a parameter of the
*method*. A member can use both, and which one you reach for is a design
decision about **who gets to choose** — the person writing the type annotation,
or the person making the call.

The same distinction, in alias form, is where it catches people out:

```ts
type Identity1<T> = (x: T) => T;      // a type constructor
type Identity2 = <T>(x: T) => T;      // a generic FUNCTION type

const a: Identity1<string> = x => x;  // must say string here
const b: Identity2 = x => x;          // caller picks, at every call
b(1);        // number
b('x');      // string
```

`Identity1` needs an argument before it is a type at all. `Identity2` *is* a
type — the type of a function that is itself generic. **The angle brackets moved
one position and the meaning changed completely.**

Practical rule: if the caller should choose per call, the parameter belongs on
the **signature**. If the choice is made once, when the type is named, it belongs
on the **type**.

## Declaration merging, and the rule that governs it

An interface may be declared more than once and the declarations combine. With
type parameters there is a hard requirement:

```ts
interface Box<T> { value: T; }
interface Box<U> { label: string; }
```

```text
error TS2428: All declarations of 'Box' must have identical type parameters.
```

"Identical" covers **the names, the order, the constraints and the defaults** —
not just the count. Written consistently, it works and is genuinely useful:

```ts
interface Box<T> { value: T; }
interface Box<T> { describe(): string; }     // fine — same parameter list
```

This is the property aliases do not have, and it is what makes interfaces the
right choice for **types other people extend from outside**: a library's
`Request`, a plugin surface, anything a consumer augments through
`declare module`. Phase 6 covers module augmentation properly; here the point is
just that **merging is the reason to reach for `interface` in a generic
context**, and there are very few others.

## Defaults make the bare name legal

```ts
interface Box<T = string> { value: T; }

const b: Box = { value: 'hi' };    // Box, with no argument — legal now
const n: Box<number> = { value: 1 };
```

Without the default, `Box` alone is `TS2314`
([chunk 01](./01-parameterising-a-type.md)). Defaults compose with constraints in
the order `<T extends Bound = Default>`, and the default must satisfy the bound.

**Where this genuinely pays is a type with one common configuration and several
rare ones** — `Result<T, E = Error>`, `Repository<T, Id = string>`. It keeps the
usual case to one argument without hiding the second from anyone who needs it.
Full treatment in **topic 08 · Default type parameters** *(not written yet)*.

## Recursive generic aliases, and the depth limit

An alias may refer to itself, which is how nested structures get modelled:

```ts
type Json =
  | string | number | boolean | null
  | Json[]
  | { [k: string]: Json };

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
```

Both are legal and both are useful. The limit is instantiation depth:

```text
error TS2589: Type instantiation is excessively deep and possibly infinite.
```

⚠️ **The threshold is much higher than folklore suggests.** The `ts-p1` sandbox
measured this directly while phase 1 was being written: **TS2589 did not fire at
a nesting depth of 50, or of 500 — only at 5000.** So "recursive types blow up
quickly" is not a reason to avoid them for ordinary data; real payloads do not
nest anywhere near that. Where it *does* bite is type-level computation that
recurses per union member or per character of a string literal, which is Phase 5
territory.

When you do hit it, the fixes are structural rather than clever: add a
termination case to the conditional, cap the recursion with a depth counter, or
model the shape less generically.

## Choosing between them, honestly

The general `type` vs `interface` question belongs to
[Phase 1 · topic 07](../../phase-1-type-vocabulary/07-type-vs-interface.md). The
**generic-specific** version is short:

| Want | Use |
|---|---|
| A union, conditional, mapped type, tuple, primitive or function type | **alias** — an interface cannot express it |
| A shape that consumers augment from outside | **interface** — merging |
| A set of operations a class will `implements` | **interface** — reads better, and merging stays available |
| Anything else | either; be consistent within a file |

⚠️ **One piece of received wisdom did not survive measurement.** The claim that
*"interfaces give better error messages than aliases"* was tested in `ts-p1`
against a plain object alias and **failed to reproduce** — both produced an
identical `TS2741` naming the same missing property. It may still hold for large
intersections; for the everyday object shape it did not, and the pages in this
corpus do not repeat it as a reason to prefer one form.

## Gotchas

**Symptom:** `TS2428: All declarations of 'X' must have identical type
parameters`
**Cause:** Two interface declarations disagree on parameter names, order,
constraints or defaults — not just count.
**Fix:** Make the lists identical, character for character.

**Symptom:** A callback typed `<T>(x: T) => T` will not accept different types at
different calls
**Cause:** The parameter is on the alias (`type F<T> = (x: T) => T`) rather than
on the signature.
**Fix:** Move the brackets: `type F = <T>(x: T) => T`.

**Symptom:** A method's type parameter is fixed by the object's type argument
**Cause:** It was declared on the interface rather than on the method.
**Fix:** Move it to the method — `map<U>(…)` — so each call chooses.

**Symptom:** `TS2589` on a recursive utility type
**Cause:** Instantiation depth, almost always from type-level recursion rather
than from data nesting — the measured threshold is around 5000 levels.
**Fix:** Add a termination branch to the conditional, or cap the depth
explicitly.

**Symptom:** A library type cannot be augmented from your code
**Cause:** It is a type alias; aliases do not merge.
**Fix:** Nothing you can do from outside — which is exactly why library authors
declare extensible surfaces as interfaces.

## Interview questions

**★ What is the difference between `type F<T> = (x: T) => T` and
`type F = <T>(x: T) => T`?**
The first is a type constructor — you must write `F<string>` and the type is
fixed there. The second is the type of a *generic function*, so the caller
chooses `T` at every call. The brackets moved one position and the meaning
changed entirely.

**★ When would you put a type parameter on a method rather than on the
interface?**
When the caller should choose it per call. `Box<T>` fixes `T` when the type is
written; `map<U>(fn: (v: T) => U): Box<U>` lets each call pick `U`. The question
is always *who gets to choose, and when*.

**★ Why do library authors declare extensible types as interfaces?**
Because interfaces merge and aliases do not. A consumer can add properties to an
`interface Request` through declaration merging or module augmentation; there is
no way to do that to an alias from outside. `TS2428` enforces that every
declaration agrees on the type parameter list.

**Are recursive type aliases dangerous?**
Less than their reputation. Measured in this project's sandbox, `TS2589` did not
fire at nesting depth 50 or 500 — only at 5000 — so ordinary recursive data
models like `Json` or `DeepPartial` are fine. The limit matters for type-level
computation that recurses per union member or per character.

**Is it true that interfaces give better error messages?**
Not in the case that was actually tested here. For a plain object shape, an alias
and an interface produced the identical `TS2741` naming the same missing
property. It may still differ for large intersections; as a general rule it did
not reproduce, so it is not used as a reason to prefer one.

---

← Prev: [01 · Parameterising a type](./01-parameterising-a-type.md) · Next → **04 · `keyof`** *(not written yet)*
