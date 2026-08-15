---
title: "What `const` inference does"
sidebar_label: "01 · What `const` inference does"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 5.0 release notes** (*const Type
> Parameters*). The `getNamesExactly` example and its two inferred types are
> quoted verbatim. **No console block** — no sandbox run covers this phase.

## The problem: the call site throws the literals away

Write a helper that takes a shape and hands part of it back:

```ts
type HasNames = { names: readonly string[] };

function getNamesExactly<T extends HasNames>(arg: T): T["names"] {
    return arg.names;
}

// Inferred type: string[]
const names1 = getNamesExactly({ names: ["Alice", "Bob", "Eve"]});
```

The return type is an [indexed access](../06-indexed-access-types.md), so it is
exactly as specific as `T` is — and `T` is only as specific as inference made it.
An array literal in an argument position infers `string[]`. The three names are
gone before the function body is even considered.

This is not a bug. It is [widening](../../phase-1-type-vocabulary/02-literal-types-and-as-const.md),
the same rule that makes `let x = 'red'` a `string`: TypeScript assumes a value
you are passing around is a value you might change, so it generalises. Almost
always right, and exactly wrong for a function whose entire job is to remember
what it was given.

The caller's workaround has always been `as const`:

```ts
const names2 = getNamesExactly({ names: ["Alice", "Bob", "Eve"] as const });
```

That works, and it is in the wrong place. The **author** of `getNamesExactly`
knows the whole point of the function is to preserve those literals. Every caller
now has to know it too, and a caller who forgets does not get an error — they get
a quietly wider type, and the failure shows up later as "why is this `string`
instead of my union".

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

One keyword on the type parameter. Read `<const T>` as **"infer this parameter as
if the caller had written `as const`"**.

The obligation has moved from *n* call sites to one declaration, and the
declaration is the place that actually knows. That is the whole value of the
feature — not the four saved keystrokes per call.

## Three things you get back, not one

`readonly ["Alice", "Bob", "Eve"]` is doing three separate jobs, and it is worth
being able to name them, because different callers care about different ones:

1. **Literal types** — `"Alice"`, not `string`. This is what makes
   `T["names"][number]` a union of the actual names.
2. **A tuple, not an array** — length 3, with a known type at each position. This
   is what makes `T["names"][0]` mean something.
3. **`readonly`** — no `push`, no index assignment, and assignable only to
   `readonly` positions.

You do not get to pick a subset. `as const` produces all three together and
`<const T>` reproduces `as const`, so the modifier is all-or-nothing. Point (3)
is the one that surprises people downstream, and it is the source of the second
failure mode in [chunk 02](./02-where-it-silently-does-nothing.md).

## What it looks like without a constraint

The constraint is not required:

```ts
declare function tag<const T>(value: T): T;

const a = tag("hello");            // "hello"
const b = tag([1, 2, 3]);          // readonly [1, 2, 3]
const c = tag({ kind: "circle" }); // { readonly kind: "circle" }
```

Note the object case: `as const` marks **every property `readonly`** and narrows
every literal, so `<const T>` on an unconstrained parameter does the same. An
unconstrained `<const T>` is the "remember exactly what I was handed" signature,
and it is what a `defineConfig`-style helper wants when it does not care about
the shape.

## How it relates to `<T extends string>`

Both preserve literals; they cover different halves of the type space.

| | Preserves literals for | Mechanism |
|---|---|---|
| `<T extends string>` | primitives | A constraint to a primitive type suppresses widening — [topic 02](../02-constraints/README.md) |
| `<const T>` | objects, arrays **and** primitives | `as const`-style inference at the call |

For a plain `(s: string)` parameter the constraint form is the lighter tool and
the more common idiom, and it is what most library code still uses. Reach for
`const` when the argument is a **structure** — which is precisely the case the
constraint trick cannot reach.

They compose without drama: `<const T extends readonly string[]>` uses the
constraint to restrict *what may be passed* and the modifier to control *how it
is inferred*. Those are different jobs, which is why both can appear on one
parameter.

## The mental model to carry

**`<const T>` is not a property of the parameter that reaches backwards through
your program.** It is an instruction to the inference step, at one call, working
only with the text written at that call.

Hold that sentence and both failure modes in the next chunk follow from it rather
than needing to be memorised — one is about text that was written *somewhere
else*, and the other is about the inference step being overruled by the
constraint.

---

← [Overview](./README.md) · Next → [02 · Where it silently does nothing](./02-where-it-silently-does-nothing.md)
