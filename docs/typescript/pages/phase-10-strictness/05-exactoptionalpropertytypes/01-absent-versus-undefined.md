---
title: "Absent versus undefined"
sidebar_label: "01 · Absent vs undefined"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **compiler's own option table**, read from the
> **TypeScript 5.9.3** build — the `exactOptionalPropertyTypes` record carries
> `type: "boolean"`, `category: Type_Checking`, `defaultValueDescription: false`
> and, notably, **no `strictFlag`** — with the description string
> *"Interpret optional property types as written, rather than adding
> `'undefined'`."* Diagnostic codes and their exact `{0}` text come from the
> **numbered diagnostic table** in the same build, cross-checked against the
> **7.0.2** native binary, where all three messages appear verbatim.
> **No sandbox, no console block.**

Every other flag in this phase adds a check. This one changes what a piece of
syntax you have written a thousand times actually **means**.

> **`name?: string` has always been a lie by one bit.** It reads as "this
> property may be absent". Without this flag it means "this property may be
> absent **or** explicitly present and set to `undefined`" — two different
> runtime objects collapsed into one type.

## The JavaScript fact underneath

Before the type system, the runtime. These are **not** the same object:

```js
const a = {};                    // no 'name' key at all
const b = { name: undefined };   // a 'name' key whose value is undefined
```

JavaScript can tell them apart, and does so in more places than most people
expect:

| Operation | `{}` | `{ name: undefined }` |
|---|---|---|
| `'name' in o` | `false` | **`true`** |
| `Object.keys(o)` | `[]` | **`['name']`** |
| `Object.hasOwn(o, 'name')` | `false` | **`true`** |
| `Object.entries(o).length` | `0` | **`1`** |
| `JSON.stringify(o)` | `'{}'` | **`'{}'`** |
| `o.name` | `undefined` | `undefined` |
| `{ ...defaults, ...o }.name` | keeps the default | **overwrites with `undefined`** |
| `Object.assign(t, o).name` | untouched | **overwritten with `undefined`** |
| `structuredClone(o)` | `{}` | `{ name: undefined }` |
| `const { name = 'x' } = o` | `'x'` | `'x'` |

📌 **Read the last three rows together — they are the whole topic.** Spread and
`Object.assign` treat the two differently, `JSON.stringify` and a destructuring
default treat them identically. So "absent" and "present and `undefined`" are
distinguishable in some of your code and indistinguishable in the rest, and the
boundary between those two halves is where the bugs live.

## What the type meant before the flag

Without `exactOptionalPropertyTypes`, TypeScript adds `undefined` to the type of
every optional property. `name?: string` is treated as `name?: string |
undefined`, so all of this compiles:

```ts
interface User { id: string; name?: string }

const u1: User = { id: 'a' };                   // ok — absent
const u2: User = { id: 'a', name: undefined };  // ok — present, undefined
const u3: User = { id: 'a', name: 'Ada' };      // ok — present, string

u3.name = undefined;                            // ok
```

`u1` and `u2` are different objects that satisfy the same type, and nothing in
the type says which one a function will receive.

## What the flag changes

Turn it on and `?` means only what it says — **the property may be missing**:

```ts
const u1: User = { id: 'a' };                   // ok
const u2: User = { id: 'a', name: undefined };  // TS2375
u3.name = undefined;                            // TS2412
```

That is the entire feature. `undefined` is no longer silently unioned into an
optional property's type; if you want it there, you write it.

```ts
interface User {
  id: string;
  name?: string;              // absent, or a string
  nickname?: string | undefined;  // absent, or a string, or explicitly undefined
}
```

📌 **The flag does not remove a capability — it makes you declare it.** The
second form was always what most code actually meant; it just was not
distinguishable from the first.

## 🔴 It changes writes, not reads

This is the single most misread thing about the flag, and it is worth stating
flatly:

```ts
declare const u: User;
u.name;      // string | undefined   — WITH the flag
u.name;      // string | undefined   — WITHOUT the flag
```

**Reading an optional property still gives you `T | undefined` either way**, and
it must, because an absent property reads as `undefined` at runtime. The flag
constrains what may be **assigned** to the property, not what comes out of it.

Two consequences worth holding on to:

- **Your reading code does not change at all.** Every `if (u.name)`, every
  `u.name ?? 'anon'`, every `u.name?.trim()` compiles exactly as before. This is
  why the flag's error count, though large, is concentrated in a small number of
  *construction* sites rather than spread across the whole codebase.
- **It is not a narrowing feature.** Nothing about `exactOptionalPropertyTypes`
  lets you skip a check on read. If you were hoping the flag would let
  `u.name` be `string` — it cannot, and no flag can.

## The three diagnostics, and what the wording tells you

The table carries **three** distinct codes for this flag, not one. The
difference between them is entirely in the last sentence:

| Code | Message |
|---|---|
| **`TS2375`** | *"Type `'{0}'` is not assignable to type `'{1}'` with `'exactOptionalPropertyTypes: true'`. Consider adding `'undefined'` to the types of the target's **properties**."* |
| **`TS2379`** | *"**Argument** of type `'{0}'` is not assignable to parameter of type `'{1}'` with `'exactOptionalPropertyTypes: true'`. Consider adding `'undefined'` to the types of the target's **properties**."* |
| **`TS2412`** | *"Type `'{0}'` is not assignable to type `'{1}'` with `'exactOptionalPropertyTypes: true'`. Consider adding `'undefined'` to the type of the **target**."* |

📌 **The plural/singular split is the useful signal.** *"the target's
properties"* means a whole object failed to assign and one of its properties is
the reason — you must read the property path, exactly as
[topic 04](../04-reading-a-typescript-error.md) describes. *"the type of the
target"* means you assigned `undefined` **directly to one property**, and the
error is already pointing at the line you need.

⚠️ **That mapping is read off the message wording, not proved from the
checker.** The 7.0.2 compiler is a Go binary, so its string table is readable
and its control flow is not — the same limit
[phase 3 recorded](../../phase-3-generics/README.md). All three strings are
present verbatim in both 5.9.3 and 7.0.2 under the same numbers.

🔴 **Do not take the suggestion literally.** All three messages end with
*"Consider adding `'undefined'`…"*, and doing so mechanically converts every
`name?: string` into `name?: string | undefined` and puts the codebase back
exactly where it started with more characters. The suggestion is correct only
when explicit `undefined` is genuinely part of the contract —
[chunk 02](./02-the-json-boundary.md) is about telling those cases apart.

## Where the flag does nothing

Worth knowing, because it bounds the blast radius:

- **Required properties.** `name: string | undefined` is unaffected — it was
  always explicit, and it still requires the key to be present.
- **Index signatures.** `Record<string, T>` has no optional properties, so this
  flag has no opinion on it. That gap belongs to
  [`noUncheckedIndexedAccess`](../02-nouncheckedindexedaccess.md), and the two
  flags are complementary rather than overlapping.
- **Optional parameters.** `function f(x?: string)` still accepts `f(undefined)`.
  Parameter optionality and property optionality are different rules, and only
  the property one moved.
- **Optional methods.** `m?(): void` is unaffected by assignment of `undefined`
  in the same way a property would be, because you rarely assign to one.
- 🔴 **Without `strictNullChecks`.** If `strictNullChecks` is off, `undefined` is
  a member of every type anyway, so there is nothing for this flag to exclude.
  Turning it on in a non-strict codebase changes nothing and gives a false
  impression that it did. See
  [topic 01 chunk 02](../01-strict-flag-by-flag/02-strictnullchecks.md).

## Why it is not in `strict`

The option record has no `strictFlag`, so `strict: true` does not enable it —
the same status as
[`noUncheckedIndexedAccess`](../02-nouncheckedindexedaccess.md), and for a
related reason. Both are correct rules that produce a large number of errors on
code written under the assumption they were off, and the errors are concentrated
in object construction, which is everywhere.

The difference in character is worth naming, because it changes how you adopt
them: `noUncheckedIndexedAccess` errors are mostly **real latent bugs**;
`exactOptionalPropertyTypes` errors are mostly **imprecise types** that were
never wrong at runtime, plus a small and valuable minority that are genuine data
bugs. [Chunk 04](./04-living-with-it.md) costs that out.

## Gotchas

**Symptom:** the flag was enabled and nothing changed.
**Cause:** `strictNullChecks` is off, so `undefined` is already assignable
everywhere and there is nothing to reject.
**Fix:** enable `strictNullChecks` first. Until then this flag is decoration.

**Symptom:** `u.name` is still `string | undefined` after enabling the flag, and
that was the reason for enabling it.
**Cause:** a misunderstanding of what the flag does — it constrains writes, not
reads. An absent property reads as `undefined`; nothing can change that.
**Fix:** none needed. If you want `name` to be a `string` on read, it must not be
optional.

**Symptom:** every error was fixed by adding `| undefined`, and the flag now
reports nothing.
**Cause:** the compiler's own suggestion, applied mechanically. `name?: string |
undefined` is exactly the pre-flag meaning.
**Fix:** revert those and decide per property. If explicit `undefined` is a real
state, keep it and say so; if it is not, fix the construction site instead.

**Symptom:** `TS2375` points at a whole object and the message is enormous.
**Cause:** an object-to-object assignment failed and one property is responsible.
**Fix:** read the trailing property path first —
[topic 04](../04-reading-a-typescript-error.md). The plural *"target's
properties"* wording is the marker for this shape.

**Symptom:** `Record<string, string>` still accepts `undefined` values.
**Cause:** an index signature is not an optional property. Different rule,
different flag.
**Fix:** `noUncheckedIndexedAccess` for the read side; for the write side, model
the map's values as `string | undefined` if that is the truth.

**Symptom:** a function still accepts `f(undefined)` for `f(x?: string)`.
**Cause:** optional **parameters** are outside this flag's scope.
**Fix:** none available via this flag. Use an overload or `x: string | undefined`
if the distinction matters, though it rarely does for parameters.

**Symptom:** the same object literal errors when assigned to a variable but not
when returned from a function.
**Cause:** different assignability contexts, and possibly a widened return type
that already includes `undefined`.
**Fix:** annotate the return type explicitly so the check happens where you can
see it.

## Interview questions

**What does `exactOptionalPropertyTypes` actually change?**
It stops the compiler from implicitly adding `undefined` to the type of an
optional property. `name?: string` goes from meaning "absent or a string or
explicitly `undefined`" to meaning "absent or a string". If you want explicit
`undefined` in the contract you now write `name?: string | undefined`.

**Does it change what you get when you read an optional property?**
No, and this is the most common misconception about it. Reading `u.name` gives
`string | undefined` with or without the flag, because an absent property
evaluates to `undefined` at runtime. The flag constrains assignment only. Its
practical effect is that errors cluster at object construction sites rather than
across all consuming code.

**Name a way JavaScript itself can tell an absent property from one set to
`undefined`.**
`'name' in o`, `Object.keys(o)`, `Object.hasOwn(o, 'name')`, and — the one that
causes real bugs — object spread and `Object.assign`, where a present-but-
`undefined` value overwrites whatever it is spread over. `JSON.stringify` and a
destructuring default, by contrast, cannot tell them apart.

**Why does the compiler emit three different codes for this flag?**
Because the shape of the failure differs and the message is the only way to tell
which you have. `TS2412` is a direct assignment to one property, and its message
says *"the type of the target"* — singular. `TS2375` and `TS2379` are a whole
object failing to assign to a variable or to a parameter respectively, and both
say *"the target's properties"* — plural, meaning you must read the property path
to find the culprit.

**Is `exactOptionalPropertyTypes` part of `strict`?**
No. The compiler's option record carries no `strictFlag`, so `strict: true` does
not enable it, and its documented default is `false`. It is in the same category
as `noUncheckedIndexedAccess`: correct, but disruptive enough on existing code
that the team declined to turn it on for everyone.

**A team enables it on a codebase with `strictNullChecks: false`. What happens?**
Nothing. Without `strictNullChecks`, `undefined` is assignable to every type, so
there is no case for this flag to reject. Worse than nothing, arguably — the
config now advertises a guarantee that is not being enforced.

**The error suggests adding `'undefined'`. When should you take that advice?**
Only when explicit `undefined` is genuinely part of the contract — for example a
field that a caller may deliberately pass as `undefined` to mean "no opinion".
Applying it to every error restores the pre-flag semantics with extra syntax,
which is the most common way a team enables this flag and gains nothing.

---

← [Topic index](./README.md) · Next → [02 · The JSON boundary](./02-the-json-boundary.md)
