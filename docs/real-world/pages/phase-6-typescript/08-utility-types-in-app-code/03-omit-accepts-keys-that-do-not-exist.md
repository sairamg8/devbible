---
title: "Omit's key parameter is constrained to keyof any rather than keyof T, so omitting a key that does not exist compiles and omits nothing — and zod's mask, which does check, shows exactly what the fix looks like"
sidebar_label: "03 · Omit accepts keys that do not exist"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the `lib.es5.d.ts` declarations read from
> `typescript@6.0.3` (TypeScript is not installed in this checkout) —
> `type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;`,
> `type Pick<T, K extends keyof T> = {[P in K]: T[P]};`,
> `type Exclude<T, U> = T extends U ? never : T;` — the handbook's
> [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
> reference, and the **zod 4.4.3** `ZodObject.omit` declaration read in this
> repo. The comparison was promised by
> [chapter 02·05b](../02-zod-as-the-source-of-truth/05b-composition-and-branded-ids.md).
> Target: **TypeScript 7.0.2** (phase spine), zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**[Chapter 02·05b](../02-zod-as-the-source-of-truth/05b-composition-and-branded-ids.md)
said that `Omit<Order, 'usr_id'>` "compiles happily and silently omits nothing"
and that this chapter carries the comparison in full.** It does, and the whole
of it is one type parameter: `Pick` is constrained `K extends keyof T`, `Omit`
is constrained `K extends keyof any`. Everything else — why the constraint is
loose, what it costs in this app, the strict replacement, and why zod's version
does not have the problem — follows from that difference.

## The two declarations, side by side

```ts
type Pick<T, K extends keyof T> = {
    [P in K]: T[P];
};

type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
```

`keyof any` is `string | number | symbol`. So:

```ts
type A = Pick<OrderRow, 'usr_id'>;
//                       ^^^^^^^^ Type '"usr_id"' does not satisfy the constraint 'keyof OrderRow'

type B = Omit<OrderRow, 'usr_id'>;
//   ^ OrderRow — every field intact, no error, no warning
```

`Exclude<keyof OrderRow, 'usr_id'>` removes nothing, because `'usr_id'` is not
in `keyof OrderRow`. The result is `Pick<OrderRow, keyof OrderRow>`, which is
`OrderRow`. **The type you wrote is a no-op that looks like a redaction.**

### Why the constraint is loose

The looseness is deliberate, not an oversight. `Omit` has to work when `K` is
computed and might not intersect `keyof T` at all — over a union of object
types, where a key exists on one member and not another; in a generic helper
where `T` is a type parameter; when omitting a key that a *subtype* has. A
`K extends keyof T` constraint would reject those. The trade the standard
library made is: never wrong, sometimes silent. **In application code, where
`T` is a concrete row type and `K` is a string you typed, that trade is exactly
backwards.**

## What it costs in this app

```ts
// packages/shared/src/order.ts
export type PublicOrder = Omit<OrderRow, 'internal_notes' | 'cost_cents'>;
```

Rename the column to `internal_note` in a migration and update `OrderRow` to
match. `PublicOrder` now has:

- `internal_note` — because it is a real key of the row type and nothing omits
  it;
- and no error at this line, because `'internal_notes'` is still a valid `K`.

🔴 **The type keeps compiling and the API starts publishing an internal
column.** No test fails unless one asserts the *absence* of a field, which is
an assertion almost nobody writes. This is the single most expensive
consequence of the loose constraint, and it is why
[chunk 02](02-pick-omit-partial-required.md) argues for `Pick` as an allowlist
on anything public.

## The fix, in three sizes

**Small — a checked alias.**

```ts
// packages/shared/src/types.ts
export type StrictOmit<T, K extends keyof T> = Omit<T, K>;
```

```ts
export type PublicOrder = StrictOmit<OrderRow, 'internal_notes' | 'cost_cents'>;
//                                              ^^^^^^^^^^^^^^^ now an error after the rename
```

Eight words, and every existing `Omit` in the codebase can be replaced by a
find-and-replace. The body still delegates to `Omit`; the *constraint* is the
whole contribution.

**Medium — `Pick` the allowlist instead.**

```ts
export type PublicOrder =
  Pick<OrderRow, 'id' | 'status' | 'total_cents' | 'created_at'>;
```

Checked by construction, and the polarity is right for a public type: a new
column is invisible until someone adds it deliberately.

**Large — derive on the schema, not on the type.**

```ts
export const PublicOrder = OrderSchema.omit({internal_notes: true, cost_cents: true});
export type PublicOrder = z.infer<typeof PublicOrder>;
```

Which is the recommendation of the whole phase, and brings us to why zod's
version behaves differently.

## zod's mask is checked, and here is the mechanism

Verbatim from `zod/v4/classic/schemas.d.ts`, as
[chapter 02·05b](../02-zod-as-the-source-of-truth/05b-composition-and-branded-ids.md)
quoted it:

```ts
omit<M extends util.Mask<keyof Shape>>(
  mask: M & Record<Exclude<keyof M, keyof Shape>, never>
): ZodObject<util.Flatten<Omit<Shape, Extract<keyof Shape, keyof M>>>, Config>;
```

Two mechanisms, both worth reading:

1. **`M & Record<Exclude<keyof M, keyof Shape>, never>`** is the check. Any key
   of the mask that is *not* a key of the shape gets type `never` in the
   intersection, and `{usr_id: true}` is not assignable to `{usr_id: never}` —
   so the call fails to compile. `Exclude<keyof M, keyof Shape>` is the set of
   keys you got wrong, and mapping them to `never` is how the signature refuses
   them.
2. **`Omit<Shape, Extract<keyof Shape, keyof M>>`** in the result. Note the
   `Extract`: even internally, zod intersects the mask's keys with the shape's
   before omitting, so the result type is computed from keys that definitely
   exist.

📌 **The `Record<…, never>` intersection is a technique, not a zod
peculiarity.** It is how you write a signature that accepts an object *and*
rejects unknown keys in it — useful any time an options bag should not tolerate
a typo. `StrictOmit` uses the simpler `K extends keyof T` because its parameter
is a key union rather than an object.

## Gotchas

**★ 🔴 `Omit<T, 'typo'>` compiles and returns `T`.** There is no diagnostic
anywhere, and the resulting type is a perfectly valid type — just not the one
you meant. Every `Omit` in application code is a place a rename can silently
un-omit a field.

**★ The failure is asymmetric: renaming the *column* is safe, renaming the
*type's* property is not.** If `OrderRow` keeps `internal_notes` and only the
SQL changes, the omit still works and the row type is what lies
([chapter 03·05](../03-typing-raw-pg-results/05-closing-the-loop.md) owns that
one). The dangerous edit is the one that updates `OrderRow` and leaves the omit
list behind — which is exactly what a careful developer does when they update
the type to match the migration.

**★ `Omit` over a union collapses it, and that surprises people separately
from the constraint problem.** `Omit<A | B, 'k'>` is not `Omit<A,'k'> |
Omit<B,'k'>` — `Omit` is not distributive, because `keyof (A | B)` is only the
*common* keys. For a discriminated union, that means the result loses the
members' distinct properties entirely. Distribute explicitly:
`type OmitU<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;`
— the same distributive-conditional device
[chapter 06·01](../06-typing-the-custom-hooks/01-asyncstate-as-a-union.md) used
for `WithRetry`.

**★ `Omit` on a discriminated union also destroys narrowing even when the key
exists.** Because the union collapses to its common keys, `status` may survive
but the per-member fields do not, so `switch (x.status)` narrows to a member
that no longer has `data`. If you catch yourself omitting from a union, the
answer is almost always to omit from each member and re-union.

**★ `StrictOmit` fixes the constraint and nothing else.** Modifiers, unions and
the public-type coupling all behave exactly as before. It is a one-line alias
that closes one hole, and the reason to prefer it over a cleverer replacement
is that everyone recognises `Omit`'s behaviour and the alias inherits it.

**★ Some codebases name their strict version `Omit` and shadow the global.**
Declaring `type Omit<T, K extends keyof T> = …` in a global `.d.ts` makes every
existing `Omit` in the repo — including inside `node_modules` type definitions
compiled with your config — subject to the stricter constraint, and library
code that relies on the loose behaviour stops compiling. Name it something
else.

**★ `Exclude<keyof T, K>` is the engine, and it is why the no-op is silent.**
`Exclude` filters a union by assignability and quietly returns the whole union
when nothing matches — it has no notion of "you asked me to remove something
that was not there". Understanding `Omit` as `Pick` over a filtered key union
makes the behaviour obvious rather than surprising, and
[chunk 05](05-exclude-extract-and-distributivity.md) is `Exclude` in its own
right.

**★ The same hole exists in every hand-rolled `Omit`-alike you find in a
codebase.** `type Without<T, K extends keyof any>` and friends copy the
standard library's constraint because they were copied *from* it. Grep for
`keyof any` when auditing; it is the tell.

## Interview questions

**★ Why does `Omit<Order, 'usr_id'>` compile?**
Because `Omit`'s key parameter is constrained `K extends keyof any` — that is,
`string | number | symbol` — rather than `keyof T`. The body is
`Pick<T, Exclude<keyof T, K>>`, and `Exclude` filters a union by
assignability, so a key that is not in `keyof T` removes nothing and the result
is `Pick<T, keyof T>`, which is `T`. There is no diagnostic because nothing
went wrong by the rules the declaration states.

**★ Why is the constraint loose in the first place?**
So that `Omit` works when `K` cannot be known to intersect `keyof T`: over
unions, inside generic helpers where `T` is a type parameter, and when omitting
a key that only a subtype has. A `keyof T` constraint would reject all of
those. The standard library chose "never wrong, sometimes silent", which is the
right trade for a general-purpose utility and the wrong one for application
code where both arguments are concrete.

**★ What does that cost in a real codebase?**
A public type that silently re-publishes an internal field. `PublicOrder =
Omit<OrderRow, 'internal_notes'>` survives a rename of the property to
`internal_note`: the omit list still type-checks, the new key is not omitted,
and the API starts returning it. No test fails unless one asserts the absence
of a field, which almost nobody writes. That is the concrete argument for
`Pick` as an allowlist on anything public.

**★ How does zod's `.omit()` avoid the problem?**
Its parameter type is `M & Record<Exclude<keyof M, keyof Shape>, never>`. Any
key in the mask that is not a key of the shape is required to have type
`never`, and `true` is not assignable to `never`, so the call fails to compile.
The result type also uses `Omit<Shape, Extract<keyof Shape, keyof M>>` —
intersecting first — so the computation only ever sees keys that exist. The
`Record<…, never>` intersection is a general technique for rejecting unknown
keys in an object parameter.

**★ What is the smallest fix, and what does it not fix?**
`export type StrictOmit<T, K extends keyof T> = Omit<T, K>` — one line, and
every existing use can be find-and-replaced. It does not fix `Omit`'s behaviour
over unions, it does not make a derived public type any less coupled to its
internal source, and it must not be named `Omit` in a global declaration file,
because shadowing the global breaks library code that depends on the loose
constraint.

**★ Why is `Omit` over a discriminated union usually a mistake?**
Because `keyof (A | B)` is only the keys common to both, so `Omit` collapses
the union to those shared keys and the members' distinctive fields disappear.
Narrowing then finds a member without the property it should have. If you
genuinely want to omit from each member, distribute the conditional —
`T extends unknown ? Omit<T, K> : never` — or, more readably, omit at the
member declarations and re-union them.

---

← Prev: [`Pick`, `Omit`, `Partial`, `Required`](02-pick-omit-partial-required.md) ·
[Overview](README.md) ·
Next → [`Record`, index signatures and `Map`](04-record-index-signatures-and-map.md)
