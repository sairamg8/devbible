---
title: "Limits and misreadings"
sidebar_label: "04 · Limits and misreadings"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Mapped Types*,
> *Keyof Type Operator*, *Indexed Access Types*) and the compiler's own message
> table for `TS7061`, `TS2615`, `TS2536`, `TS2542` and `TS2589` — every message
> quoted here was confirmed present in the installed **TypeScript 7.0.2**.
> **No console block** — no sandbox run covers this phase.

The mechanism is now complete: a loop, modifiers, a value expression. This chunk
is what the mechanism **cannot** do, and the handful of results that look like
bugs and are not.

## Four things a mapped type cannot do

**1. Add a member beside the loop.**

```ts
type Bad<T> = {
  [K in keyof T]: T[K];
  id: string;              // ❌ TS7061
};
```

> **`TS7061`: A mapped type may not declare properties or methods.**

The mapping *is* the object type. Intersect instead:
`{ [K in keyof T]: T[K] } & { id: string }`.

**2. Skip a key, without remapping.** The loop produces exactly one property per
key it iterates. Removing a key means changing what you iterate — either compute
the key union first (`Pick<T, Exclude<keyof T, "id">>`) or filter inside an `as`
clause by mapping the unwanted key to `never`, which is topic 04's subject.

**3. Produce two properties from one key.** One iteration, one property. A type
that needs `name` and `nameChanged` is two mapped types intersected, not one
mapping.

**4. Read a value.** Everything here is types. A mapped type cannot see that
`config.debug` is `true` at runtime, only that its type is `boolean` — or
`true`, if the value was declared `as const`. That is a question about
[literal types](../../phase-1-type-vocabulary/02-literal-types-and-as-const.md),
not about mapping.

## `keyof` surprises that get blamed on the mapping

Most "the mapped type is wrong" reports are `keyof` doing something correct and
unexpected. Check the key union *before* debugging the loop.

| Input | `keyof` gives | Consequence for the mapping |
|---|---|---|
| `{ a: 1; b: 2 }` | `"a" \| "b"` | the ordinary case |
| `A \| B` | only the **shared** keys | far fewer properties than expected |
| `A & B` | the keys of **both** | more than expected |
| `{ [k: string]: number }` | `string \| number` | the result keeps an index signature |
| `any` | `string \| number \| symbol` | maps to an index-signature-ish shape |
| `unknown` | `never` | the mapping produces `{}` |
| `string` | every method name on `String` | almost never what was meant |
| `number[]` | `number \| "length" \| "push" \| …` | see the homomorphic array rule in [chunk 02](./02-modifiers.md) |

The union case is the one that costs time: `keyof (A | B)` is the *intersection*
of their key sets, because only a shared key is guaranteed to exist on whichever
member you have. It is correct, it is documented, and it looks like a bug every
time.

## Number and symbol keys survive

`keyof` includes numeric and symbol keys, and the mapping carries them through:

```ts
const tag = Symbol("tag");

type Weird = { 0: string; [tag]: number; name: string };
type Mapped = { [K in keyof Weird]: boolean };
// { 0: boolean; [tag]: boolean; name: boolean }
```

This matters when the value expression does something string-specific — a
template literal key, `Capitalize`, a `${K}` interpolation. Those need
`K & string`, and the moment you write `[K in keyof T & string]` the mapping is
no longer homomorphic ([chunk 02](./02-modifiers.md)), so modifiers stop being
preserved. That trade is the single most common cause of "my helper type
silently dropped `readonly`".

## Index signatures are preserved, not enumerated

```ts
type Dict = { [k: string]: number; id: string };
type Flags = { [K in keyof Dict]: boolean };
// { [x: string]: boolean; id: boolean }
```

The mapping does not expand an index signature into concrete keys — it cannot,
because there are infinitely many. It maps the signature itself. If you needed
only the declared keys, remove the index signature from the input or filter with
`as`.

A related pair of diagnostics worth recognising:

> **`TS2536`: Type `'{0}'` cannot be used to index type `'{1}'`.**
>
> **`TS2542`: Index signature in type `'{0}'` only permits reading.**

The first is the error when a key union is not constrained to `keyof T` — the
fix is the constraint. The second appears when you assign through a mapping that
produced `readonly` properties, and is the compiler correctly enforcing what the
mapping asked for.

## A mapped type over an unresolved generic stays deferred

This is the practical limit that surprises people inside generic functions:

```ts
function reset<T extends object>(input: T): Partial<T> {
  const out: Partial<T> = {};
  out.someKey = undefined;      // ❌ no such property is known
  return out;
}
```

While `T` is still a type parameter, `Partial<T>` cannot be resolved to a
concrete object type, so the compiler knows almost nothing about its members.
Everything works at the call site, where `T` is known, and very little works
inside the function body. The usual resolutions are to build the object as a
`Record<string, unknown>` and assert once at the boundary, or to accept the keys
as a parameter so they are literal types rather than an unresolved `keyof T`.

The general shape of this rule is worth carrying: **a computed type is a promise
about a type you do not have yet; it does not become concrete until the type
parameter does.**

## Circularity

```ts
type Bad<T> = { [K in keyof T]: Bad<T>[K] };
```

> **`TS2615`: Type of property `'{0}'` circularly references itself in mapped type
> `'{1}'`.**

Recursion through a mapped type is fine when each step consumes structure
(`T[K] extends object ? Deep<T[K]> : T[K]`); it fails when a property's type
depends on itself at the same level. And when recursion is legal but deep, the
other limit arrives:

> **`TS2589`: Type instantiation is excessively deep and possibly infinite.**

Both belong to **09 · Type-level performance** *(not written yet)*; they are
listed here so the message is recognisable when a mapping is the thing that
produced it.

## The readability limit, which has no error code

A mapped type earns its place when it keeps several types in step with one
source of truth. It loses its place when the reader has to run the mapping in
their head to know what a function accepts.

Two questions worth asking before keeping one:

- **Would writing the type out be shorter and clearer?** For a three-property
  object that will not change, `{ name?: string; age?: number }` beats
  `Partial<Pick<Model, "name" | "age">>`.
- **What does a caller see when they get it wrong?** That is the phase's
  discipline, and it is topic 08's whole subject: a clever type that produces an
  unreadable error message is a net loss.

## Gotchas

**Symptom:** `TS7061` on a mapping with an extra member
**Cause:** A mapped type is the entire object type.
**Fix:** Intersect the fixed members on.

**Symptom:** The mapping produced `{}`
**Cause:** `keyof T` was `never` — usually because `T` is `unknown`, or a union
with no shared keys.
**Fix:** Hover the key union first. Constrain `T extends object` if the input is
meant to be an object.

**Symptom:** A helper works on a concrete type and produces nothing useful inside
a generic function
**Cause:** The mapped type is deferred while the type parameter is unresolved.
**Fix:** Do the work at the boundary where the type is concrete, or take the keys
as literal parameters.

**Symptom:** Adding `& string` to the key fixed a template-literal error and broke
`readonly` preservation
**Cause:** `[K in keyof T & string]` is not homomorphic.
**Fix:** Re-apply the modifiers explicitly, or do the string work in an `as`
clause where the key union is still `keyof T`.

**Symptom:** Mapping a type with an index signature produced an index signature
**Cause:** Correct — a signature cannot be enumerated into concrete keys.
**Fix:** Filter it out with `as`, or map over a declared key union instead.

**Symptom:** `TS2542` when assigning to a property of a mapped result
**Cause:** The mapping added `readonly`.
**Fix:** Map with `-readonly` if mutability was intended, or assign before
freezing the type.

**Symptom:** `TS2615` on a recursive helper
**Cause:** A property's type references the mapping at the same level rather than
descending into a smaller structure.
**Fix:** Recurse into `T[K]`, not into the mapped type itself, and give the
recursion a base case.

**Symptom:** Symbol or numeric keys vanished from the result
**Cause:** The key union was narrowed with `& string` somewhere in the chain.
**Fix:** Keep `keyof T` intact and narrow only in the position that needs a
string.

## Interview questions

**★ Name three things a mapped type cannot do.**
Declare a fixed member beside the loop (`TS7061` — intersect instead); skip or add
keys without changing what it iterates (that needs `Exclude` on the key union or
an `as` clause); and produce more than one property per key. A fourth, if the
interviewer wants it: it cannot see runtime values, only types.

**★ Why does `keyof (A | B)` give fewer keys than expected?**
Because only the keys present on *every* member of the union are guaranteed to
exist on the value you actually hold, so `keyof` over a union is the
intersection of the key sets. Mapping over it therefore produces the shared
properties only. It is correct and it looks wrong; check the key union before
blaming the mapping.

**★ Why does a mapped helper stop being useful inside a generic function?**
Because the mapping is deferred until the type parameter is resolved. `Partial<T>`
with `T` still generic is not a concrete object type, so the compiler knows
almost nothing about its properties — even though every call site works fine. Do
the work where the type is concrete, or pass the keys in as literal types.

**What happens when you map over a type with an index signature?**
The signature is mapped, not expanded — you get an index signature in the result
alongside the mapped declared keys. There is no way to enumerate an index
signature into concrete keys, because it describes an unbounded set.

**Why does `[K in keyof T & string]` change more than the key type?**
It breaks homomorphism. Homomorphic mappings — the `[K in keyof T]` form over a
type parameter — preserve `readonly` and `?`, map arrays to arrays, and distribute
over unions. Intersecting the key union with `string` opts out of all three, so a
mapping that only meant to satisfy a template literal quietly stops preserving
modifiers.

**When should you not write a mapped type at all?**
When writing the object type out is shorter and the source type is not going to
change, and whenever the mapping makes the caller's error message worse than the
bug it prevents. The second is the phase's stated discipline — a type nobody can
read the failure of has negative value, however elegant it is.

---

← Prev: [03 · Writing your own](./03-writing-your-own.md) · [Topic index](./README.md) · Next → **02 · Conditional types** *(not written yet)*
