---
title: "`const` type parameters"
sidebar_label: "12 · `const` type parameters"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 5.0 release notes** (*const Type
> Parameters*) — the `getNamesExactly`, `fnGood` and `fnBad` examples below and
> their inferred types are **quoted from that page**, not reconstructed. Modifier
> placement messages are read out of the **compiler's own diagnostic table**
> (⚠️ install inspected: TypeScript **6.0.3**, not the 7.0.2 this corpus targets).
> **No console block** — no sandbox run covers this phase.

[Topic 02](./02-constraints/README.md) established that `<T extends string>`
preserves literal types: constrain a parameter to `string` and a call with
`'red'` infers `'red'`, not `string`. That trick works for primitives and stops
dead at objects and arrays. `const` type parameters (TypeScript **5.0**) are the
missing half.

## The problem: the call site widens

Write a helper that takes a shape and hands part of it back:

```ts
type HasNames = { names: readonly string[] };

function getNamesExactly<T extends HasNames>(arg: T): T["names"] {
    return arg.names;
}

// Inferred type: string[]
const names1 = getNamesExactly({ names: ["Alice", "Bob", "Eve"]});
```

The return type is an [indexed access](./06-indexed-access-types.md), so it is
exactly as specific as `T` is — and `T` here is only as specific as inference
made it. An array literal in an argument position infers `string[]`. The three
names are gone before the function body is even considered.

The caller's workaround has always been `as const`:

```ts
const names2 = getNamesExactly({ names: ["Alice", "Bob", "Eve"] as const });
```

That works, and it is the wrong place for it. The *author* of `getNamesExactly`
knows the whole point of the function is to preserve those literals; every caller
now has to know it too, and one who forgets gets a silently wider type rather
than an error.

## The fix: move `as const` into the signature

```ts
function getNamesExactly<const T extends HasNames>(arg: T): T["names"] {
//                       ^^^^^
    return arg.names;
}

// Inferred type: readonly ["Alice", "Bob", "Eve"]
// Note: Didn't need to write 'as const' here
const names = getNamesExactly({ names: ["Alice", "Bob", "Eve"] });
```

One keyword on the type parameter, and the obligation moves from every call site
to the one declaration. Read `<const T>` as **"infer this parameter as if the
caller had written `as const`"**.

Note what came back: `readonly ["Alice", "Bob", "Eve"]` — a **readonly tuple**,
not `string[]` and not `("Alice" | "Bob" | "Eve")[]`. That is precisely what
`as const` produces, which is the point. If the readonly and the tuple-ness are
surprising, [Phase 1 · literal types and `as const`](../phase-1-type-vocabulary/02-literal-types-and-as-const.md)
is the page that establishes them.

## 🔴 It only applies to expressions written at the call

This is the limitation that catches everyone, and the release notes state it
flatly: the modifier affects inference of object, array and primitive
expressions **written within the call**. A variable declared elsewhere is
already widened by the time the call sees it, and nothing can undo that:

```ts
declare function fnGood<const T extends readonly string[]>(args: T): void;

const arr = ["a", "b" ,"c"];
// 'T' is still 'string[]' -- the 'const' modifier has no effect here
fnGood(arr);
```

`const arr = [...]` gives `arr` the type `string[]` at its own declaration —
`const` on a *variable* stops the binding being reassigned, it does not stop the
initialiser widening. By the time `fnGood` is called there is no literal left to
preserve. The fix is the one that was always the fix: `as const` on the
declaration.

**The mental model:** `<const T>` is not a property of the parameter that reaches
back through the program. It is an instruction to the inference step at a single
call, and it can only work with what is written there.

## 🔴 A mutable constraint silently defeats it

Worse than the above, because it fails without a word:

```ts
declare function fnBad<const T extends string[]>(args: T): void;
// 'T' is still 'string[]' since 'readonly ["a", "b", "c"]' is not assignable to 'string[]'
fnBad(["a", "b" ,"c"]);
```

Follow the arithmetic. `const` produces the candidate `readonly ["a", "b", "c"]`.
The constraint demands `string[]`, which is **mutable**. A readonly array is not
assignable to a mutable one — that direction is exactly what `readonly` exists to
forbid. The candidate fails the constraint, so inference falls back to the
constraint itself, and `T` is `string[]`.

There is **no error**. The `const` is present, correct-looking, and doing
nothing.

```ts
declare function fnGood<const T extends readonly string[]>(args: T): void;
// T is readonly ["a", "b", "c"]
fnGood(["a", "b" ,"c"]);
```

**Rule that follows: a `const` type parameter's constraint must be `readonly`
throughout.** `readonly string[]`, `readonly unknown[]`, and object types whose
array properties are declared `readonly` — which is why the handbook's own
`HasNames` is `{ names: readonly string[] }` and not `{ names: string[] }`. That
detail is not decoration; remove the `readonly` and the first example on this
page stops working too.

## Where the modifier is allowed

`const` goes on the type parameters of **functions, methods and constructors** —
things with call sites, because a call site is the only place inference of this
kind happens. A type alias or an interface has no call site and no arguments, so
there is nothing for `const` to act on; its type arguments are written out by
hand or defaulted.

The compiler's diagnostic table carries three placement messages, and their
wording maps cleanly onto the two modifiers that can appear here:

| Code | Message text (verbatim from the table) |
|---|---|
| **TS1273** | *"'{0}' modifier cannot appear on a type parameter"* |
| **TS1274** | *"'{0}' modifier can only appear on a type parameter of a class, interface or type alias"* |
| **TS1277** | *"'{0}' modifier can only appear on a type parameter of a function, method or class"* |

TS1274's list — class, interface, type alias — is where the **variance**
annotations `in`/`out` belong ([topic 14](./14-variance.md)). TS1277's list is where **`const`**
belongs. ⚠️ Stated from the message text and the documented placement rules, not
from watching each one fire; the version installed here is the Go-port compiler,
whose checker is not readable from the JavaScript package the way the string
table is.

## It changes types, and nothing else

`<const T>` does not freeze anything, does not call `Object.freeze`, and emits no
code — it is erased with the rest of the type annotations. The array in
`fnGood(["a","b","c"])` is an ordinary mutable JavaScript array at runtime; only
the compiler believes it is `readonly`. Same bargain as `as const` itself, and
worth saying out loud because "const" reads like a runtime guarantee to anyone
arriving from another language.

It also does not *reject* mutable values. A caller who passes an already-widened
variable gets the wide inference, not an error — that is limitation one restated
from the other side.

## What it is actually for

The pattern is always the same: **a function whose return type is computed from
the literals it was given.**

```ts
declare function defineRoutes<const T extends readonly { path: string }[]>(
  routes: T,
): T;

const routes = defineRoutes([
  { path: "/" },
  { path: "/checkout" },
]);

type Path = (typeof routes)[number]["path"];   // "/" | "/checkout"
```

Route tables, state-machine definitions, form field lists, permission lists,
config builders — anywhere a library wants `keyof`, `T[number]` or a template
literal type to see the real strings a caller wrote. The alternative is
documenting "remember to write `as const`" and watching people not.

Three neighbours, and the distinction is worth holding:

- **[`as const`](../phase-1-type-vocabulary/02-literal-types-and-as-const.md)** —
  the caller freezes the literals. Still the right tool for a value you are
  declaring, and the only tool when it is declared away from the call.
- **[`as const satisfies T`](../phase-2-narrowing/10-satisfies/README.md)** —
  freeze, then check. For a table you own and want validated in place.
- **`<const T>`** — the *author* declares that this parameter's literals matter.
  Nothing at the call site, and it cannot reach a value declared elsewhere.

## Trade-off

**Adding `const`** removes a footgun from every call site and makes the specific
return type the default rather than an opt-in a caller has to know about. It
costs a small amount of surprise: hovers now show long readonly tuples instead of
`string[]`, and error messages quote them in full, which gets noisy for large
literals. It can also over-specify — a value that genuinely is just a list of
strings now carries a tuple type through everything downstream, and any consumer
expecting a mutable array will reject it.

**Leaving it off** keeps the types small and the messages short, and pushes the
`as const` decision to people who mostly will not make it.

The line worth holding: **add `const` when the function's return type reads the
literals** — through `T[K]`, `T[number]`, `keyof T` or a template literal. If the
parameter is only ever used as "some array", the modifier buys noise.

## Gotchas

**Symptom:** `<const T>` is on the signature and the inferred type is still wide
**Cause:** The argument is a variable declared elsewhere, so it was widened at
its own declaration.
**Fix:** `as const` on that declaration, or inline the literal into the call.

**Symptom:** `const` appears to do nothing even with a literal argument
**Cause:** The constraint is mutable (`T extends string[]`), so the readonly
candidate fails it and inference falls back to the constraint. No error is
reported.
**Fix:** `T extends readonly string[]`, and `readonly` on array properties inside
object constraints too.

**Symptom:** `TS4104: The type '…' is 'readonly' and cannot be assigned to the
mutable type '…'` downstream of a `const` parameter
**Cause:** The inferred readonly tuple is being handed to something that wants a
mutable array — `.push`, or a parameter typed `string[]`.
**Fix:** Widen at that boundary (`[...value]`), not by removing the `const`.

**Symptom:** A modifier-placement error on a type alias or interface
**Cause:** `const` belongs on function, method and constructor type parameters;
`in`/`out` are the ones that belong on a class, interface or type alias.
**Fix:** Drop the `const` — a type alias has no call site for it to affect.

**Symptom:** Someone expects the argument to be frozen at runtime
**Cause:** Reading `const` as a runtime guarantee.
**Fix:** It is erased like every other annotation. `Object.freeze` if the runtime
behaviour is actually wanted.

**Symptom:** Hovers and errors are suddenly enormous
**Cause:** A large literal is now carried as a full readonly tuple.
**Fix:** Intended, mostly — but if the return type never reads the literals, the
`const` is not earning its place
([topic 13](./13-when-not-to-write-a-generic.md)).

## Interview questions

**★ What does `const` on a type parameter do?**
It makes inference at the call site behave as though the caller had written
`as const` on the argument, so object and array literals keep their literal types
and become readonly tuples. TypeScript 5.0. It moves an obligation off every
caller and onto the one declaration.

**★ Why might `<const T>` have no effect?**
Two reasons. Either the argument is a variable declared elsewhere — it was
already widened at its own declaration and the modifier only affects expressions
written inside the call — or the constraint is mutable, in which case the
readonly candidate is not assignable to it and inference silently falls back to
the constraint. The second is the dangerous one, because nothing is reported.

**★ How does it relate to `<T extends string>`?**
Same goal, different halves of the type space. A primitive constraint already
preserves literal types, so `<T extends string>` keeps `'red'` as `'red'`.
Objects and arrays have no equivalent constraint that does this, and `const` is
what fills the gap.

**Does `const` make the argument immutable?**
No. It is erased at compile time and the array is an ordinary mutable array at
runtime. Only the compiler treats it as readonly — the same bargain as `as const`.

**When would you not add it?**
When the return type never reads the literals. If the parameter is used as "some
array" and nothing indexes into `T`, `const` only makes hovers and error messages
larger. The signal to add it is `T[number]`, `T[K]` or `keyof T` in the return
position.

---

← Prev: [11 · `infer` in conditional types](./11-infer-in-conditional-types.md) · Next → [13 · When *not* to write a generic](./13-when-not-to-write-a-generic.md)
