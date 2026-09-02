---
title: "Exclude and Extract are one-line conditional types whose entire behaviour comes from distributing over a union, and the day you need them not to distribute the fix is a pair of square brackets"
sidebar_label: "05 · Exclude, Extract, distributivity"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the `lib.es5.d.ts` declarations read from
> `typescript@6.0.3` (TypeScript is not installed in this checkout) —
> `type Exclude<T, U> = T extends U ? never : T;`,
> `type Extract<T, U> = T extends U ? T : never;`,
> `type NonNullable<T> = T & {};` — the handbook on
> [conditional types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
> (distributive conditional types) and
> [narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html),
> and the **4.8** release note covering
> [unconstrained generics and `{}`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-8.html).
> The status union is
> [chapter 02·05's](../02-zod-as-the-source-of-truth/05-the-status-enum-four-ways.md).
> Target: **TypeScript 7.0.2** (phase spine).
> Documentation-validated; **no console blocks, no timings**.

**`Exclude` and `Extract` are two lines that differ only in which branch
returns `never`, and everything interesting about them is a property of
conditional types rather than of the utilities themselves.** They filter a union
because a conditional type applied to a naked type parameter *distributes* over
that union — apply the condition to each member, drop the `never`s, re-union the
rest. Once you see that, both utilities are obvious, the surprises are
predictable, and the `[T] extends [U]` trick has an obvious reason to exist.

## The declarations

```ts
type Exclude<T, U> = T extends U ? never : T;
type Extract<T, U> = T extends U ? T : never;
type NonNullable<T> = T & {};
```

## Over this app's status union

```ts
type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

type Open      = Exclude<OrderStatus, 'delivered' | 'cancelled'>;
//   'pending' | 'paid' | 'shipped'
type Terminal  = Extract<OrderStatus, 'delivered' | 'cancelled'>;
//   'delivered' | 'cancelled'
type Fulfilled = Exclude<OrderStatus, 'pending' | 'cancelled'>;
//   'paid' | 'shipped' | 'delivered'
```

```ts
// apps/api/src/orders/transitions.ts — a function only the open statuses reach
export function cancel(orderId: OrderId, from: Open): Promise<Order> { … }

cancel(id, 'delivered');
//         ^^^^^^^^^^^ Argument of type '"delivered"' is not assignable to parameter of type 'Open'
```

**This is the payoff, and it is small and real:** the transition table in
[chapter 04·02](../04-discriminated-unions/02-the-transition-table.md) already
knows which statuses can be cancelled; `Exclude` lets a *signature* know it too,
so the wrong call is a compile error rather than a runtime guard.

⚠️ **Add a sixth status and `Open` silently includes it.** `Exclude` is a
blocklist, with the same polarity problem as `Omit` — a new member joins every
`Exclude`-derived type automatically. `Extract` is the allowlist: a new status
is absent from `Terminal` until someone adds it, which is the failure you want
when the set is a state machine. **Prefer `Extract` for the sets you enumerate,
`Exclude` for the ones you subtract from.**

## Extracting a union member by its discriminant

The single most useful application in this codebase:

```ts
type SuccessOf<T>  = Extract<AsyncState<T>, {status: 'success'}>;
//   {status: 'success'; data: T}
type WithExtras    = Extract<ApiError, {code: keyof typeof ERROR_EXTRAS}>;
//   the five error members that carry extras
type ApiFailureOf<K extends ApiFailure['kind']> = Extract<ApiFailure, {kind: K}>;
//   ApiFailureOf<'api'> is {kind:'api'; path: string; status: number; error: ApiError}
```

`Extract<Union, {tag: value}>` reads as *"the members of this union assignable
to this shape"*, which for a discriminated union is exactly *"the member(s) with
this tag"*. [Chapter 06·01c](../06-typing-the-custom-hooks/01c-narrowing-asyncstate-at-the-call-site.md)
uses the first, [chapter 07·04c](../07-the-typed-api-client/04c-parsing-and-rendering-api-errors.md)
the second.

## Distributivity, stated once

The handbook's rule:

> *"When conditional types act on a generic type, they become distributive when
> given a union type."*

So `Exclude<'a' | 'b', 'a'>` is evaluated as
`('a' extends 'a' ? never : 'a') | ('b' extends 'a' ? never : 'b')`, which is
`never | 'b'`, which is `'b'`. **`never` disappearing from a union is what makes
the filter work** — it is the union's identity element.

Distribution requires a **naked type parameter** on the left of `extends`. Wrap
it in a tuple and it stops:

```ts
type IsExactly<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;

type A = IsExactly<OrderStatus, 'pending'>;   // false
type B = IsExactly<'pending', 'pending'>;     // true
```

📌 **Why the brackets are needed.** Without them,
`T extends U ? true : false` with `T = 'a' | 'b'` distributes and gives
`boolean` — the union of the two branch results — rather than a single answer.
`[T] extends [U]` compares the whole union to the whole union in one step,
which is what "exactly" means.

🔴 **The classic case is `never`.** `T extends never ? 'yes' : 'no'` with
`T = never` gives `never`, not `'no'` — distributing over the empty union
produces the empty union. `[T] extends [never] ? 'yes' : 'no'` gives `'yes'`.
Any type-level helper that tests for `never` needs the brackets, and the bug
without them is a `never` that propagates silently into whatever consumed it.

## `NonNullable<T>` is `T & {}`

```ts
type NonNullable<T> = T & {};
```

It is not a conditional type at all. `{}` is the type of *everything except
`null` and `undefined`*, so intersecting removes exactly those two and leaves
the rest untouched. TypeScript 4.8 made this change as part of a broader tidy-up
of unconstrained generics and `{}`; the practical consequence is that
`NonNullable` composes better than the old conditional version — it does not
distribute, and it preserves the type in cases where a conditional would have
collapsed it.

```ts
// where it is actually used in this app
type ResolvedProduct = NonNullable<Awaited<ReturnType<ProductsRepo['bySlug']>>>;
//   ProductDetailRow — the repo returns `ProductDetailRow | null`
```

## Gotchas

**★ `Exclude` is a blocklist and inherits the polarity problem.** A sixth order
status joins every `Exclude`-derived set the moment it is added to the union,
with no error anywhere. `Extract` fails the other way — the new status is
missing until someone includes it — which is the correct failure for a state
machine. Choose the direction deliberately, not by which reads better.

**★ `Exclude<T, U>` does not require `U` to overlap `T`.** Same silence as
`Omit`: `Exclude<OrderStatus, 'refunded'>` is the whole union, and no
diagnostic. If you want the check, constrain it —
`type ExcludeStrict<T, U extends T> = Exclude<T, U>` — which is the same
one-line fix as `StrictOmit`.

**★ Distribution needs a naked type parameter, so `Exclude` inside another
conditional may not behave as expected.** The rule is about the *checked* type
being a bare `T`, not about the utility being used. Wrapping in a tuple, an
array, or reading a property all suppress distribution — sometimes helpfully,
sometimes not.

**★ `T extends never ? A : B` never gives you `B` when `T` is `never`.**
Distributing over the empty union produces `never`, so the whole conditional is
`never`. Every "is this type `never`" helper needs `[T] extends [never]`. This
is the single most commonly-hit distribution surprise.

**★ `boolean` is a union of `true | false`, and it distributes.**
`T extends true ? 'y' : 'n'` with `T = boolean` gives `'y' | 'n'`, because
`boolean` is `true | false` and each member takes a different branch. Anything
conditional on a boolean type parameter needs the tuple wrapper if a single
answer is wanted.

**★ `Extract` returning `never` is how a typo presents.**
`Extract<ApiFailure, {kind: 'apii'}>` is `never`, and `never` is assignable to
everything, so the error appears wherever the result is *used* — often as
"argument of type X is not assignable to parameter of type never" in a
different file. When an `Extract` result behaves oddly, hover it first.

**★ `Extract<Union, Shape>` matches by assignability, not by tag equality.**
`Extract<ApiFailure, {path: string}>` matches every member that has a `path`,
which is five of six — usually not what someone reaching for a discriminant
wanted. Always extract on the discriminant property, and make the shape as
specific as the tag.

**★ `NonNullable<T>` is `T & {}` and therefore does not distribute.** That is
usually invisible and matters when `T` is a union containing an object type:
the result is an intersection rather than a filtered union, which prints
differently in errors and hover text even though it behaves the same. Do not be
alarmed by `(A | B) & {}` in a message.

**★ `Exclude` on a union of *object* types compares by assignability and will
delete more than you meant.** `Exclude<{a: 1} | {a: 1; b: 2}, {a: 1}>` removes
*both*, because `{a: 1; b: 2}` is assignable to `{a: 1}`. For object unions,
filter on a discriminant literal rather than on a shape.

**★ `never[]` and `never` are different failures and look alike.** A filter
that removed everything gives `never`; a filter over an array's element type
that removed everything gives `never[]`, which is still an array and still
assignable to array parameters, so the mistake travels further before
surfacing.

## Interview questions

**★ Write `Exclude` and `Extract` from memory and say why they work.**
`type Exclude<T, U> = T extends U ? never : T;` and
`type Extract<T, U> = T extends U ? T : never;`. They work because a
conditional type over a naked type parameter distributes across a union: the
condition is applied to each member separately and the results are re-unioned.
The members that fail the test become `never`, and `never` vanishes from a
union, so what remains is the filter's output.

**★ What is `[T] extends [U]` for?**
Turning distribution off. Wrapping both sides in a one-element tuple means the
checked type is no longer a naked type parameter, so the condition is evaluated
once against the whole union rather than per member. That is required whenever
you want a single answer instead of a union of answers — testing whether two
types are identical, and above all testing for `never`, since
`T extends never ? A : B` with `T = never` distributes over the empty union and
yields `never`.

**★ Why is `Extract` usually the better direction for a state machine?**
Because it is an allowlist. Adding a sixth order status silently joins every
`Exclude`-derived set — `Open` quietly grows a member nobody considered —
whereas an `Extract`-derived set stays as it was until someone adds the new
member deliberately. For a set that encodes a rule, "missing until stated" is a
much better failure than "included until excluded".

**★ How do you get one member out of a discriminated union?**
`Extract<Union, {tag: 'value'}>` — the members assignable to that shape, which
for a discriminated union is the member with that tag. Extract on the
*discriminant*, not on some other property: `Extract<ApiFailure, {path:
string}>` matches five of six members because most of them have a `path`, and
the result is a union nobody wanted.

**★ Why is `NonNullable<T>` declared as `T & {}` rather than a conditional?**
Because `{}` is the type of every value except `null` and `undefined`, so the
intersection removes exactly those two — no conditional needed. TypeScript 4.8
made the change as part of tidying up how unconstrained generics interact with
`{}`. The practical difference is that it does not distribute, so it preserves
unions and generic parameters in places where the old conditional definition
could collapse them.

**★ An `Extract` you wrote is behaving as though the type does not exist. What
is the first thing you check?**
Whether it evaluated to `never`. A typo in the discriminant value, or a shape
that matches no member, produces `never` — which is assignable to everything,
so nothing errors at the declaration and the failure surfaces wherever the type
is used, usually as a confusing "not assignable to parameter of type never".
Hover the alias before reading the error.

---

← Prev: [`Record`, index signatures and `Map`](04-record-index-signatures-and-map.md) ·
[Overview](README.md) ·
Next → [`satisfies` versus annotation versus `as`](06-satisfies-versus-annotation.md)
