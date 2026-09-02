---
title: "ReturnType<typeof productsRepo> keeps the repository's interface and its implementation as one declaration, and the general rule behind it is that two declarations of one shape will disagree on a Tuesday"
sidebar_label: "01 · Derive, never re-declare"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the `lib.es5.d.ts` declarations read from
> `typescript@6.0.3` (TypeScript is not installed in this checkout) —
> `type ReturnType<T extends (...args: any) => any> = T extends (...args: any)
> => infer R ? R : any;`,
> `type Parameters<T extends (...args: any) => any> = T extends (...args: infer
> P) => any ? P : never;`, and the full `Awaited<T>` declaration quoted below —
> plus the handbook's
> [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
> reference and
> [`typeof` type operator](https://www.typescriptlang.org/docs/handbook/2/typeof-types.html).
> Target: **TypeScript 7.0.2** (phase spine).
> Documentation-validated; **no console blocks, no timings**.

**[Chapter 03·02b](../03-typing-raw-pg-results/02b-the-query-module-typed.md)
used `ReturnType<typeof productsRepo>` and said the general argument lived
here.** It is one sentence long: *a hand-written type beside the thing it
describes is a second declaration, and second declarations drift.* The rest is
knowing which derivations are cheap, which couple two things you did not mean
to couple, and what the three function-shaped utilities actually say.

## The promise, delivered

```ts
// apps/api/src/db/products.ts
export function productsRepo(pool: Pool) {
  return {
    list: (args: ListProductsArgs) => listProducts(pool, args),
    bySlug: (slug: string) => productBySlug(pool, slug),
  };
}

export type ProductsRepo = ReturnType<typeof productsRepo>;
```

```ts
// the alternative, written by hand
export interface ProductsRepo {
  list: (args: ListProductsArgs) => Promise<ProductListRow[]>;
  bySlug: (slug: string) => Promise<ProductDetailRow | null>;
}
```

The interface is not *wrong*; it is a **second place the truth lives**. Add
`byId` to the factory and the interface silently lacks it, so a consumer typed
`ProductsRepo` cannot call a method that exists. Change `bySlug` to take a
`ProductId` and the interface still says `string`, and every call site keeps
passing strings until something 404s. Neither divergence produces an error at
the point of change; both produce one somewhere else, later.

**`ReturnType<typeof f>` collapses the two into one.** The factory is the
declaration; the type is a view of it.

### The declaration, and the `any` at the end of it

```ts
type ReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : any;
```

📌 **The false branch is `any`, not `never`, and that is worth noticing.** The
constraint already requires `T` to be a function, so the false branch is
unreachable for any legal argument — but if `T` is `any`, the conditional's
result is `any` too. A `productsRepo` that lost its types (an untyped import, a
`.js` module with no declarations) yields `ProductsRepo = any`, and every
consumer silently stops being checked. The failure is invisible; the tell is
hovering the type and seeing `any`.

## `Parameters` and `Awaited`

```ts
type Parameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never;

type Awaited<T> = T extends null | undefined ? T : // special case for `null | undefined` when not in `--strictNullChecks` mode
    T extends object & { then(onfulfilled: infer F, ...args: infer _): any; } ? // `await` only unwraps object types with a callable `then`. Non-object types are not unwrapped
        F extends ((value: infer V, ...args: infer _) => any) ? // if the argument to `then` is callable, extracts the first argument
            Awaited<V> : // recursively unwrap the value
        never : // the argument to `then` was not callable
    T; // non-object or non-thenable
```

**`Parameters<T>` is a tuple**, which is what makes it composable with indexed
access:

```ts
// the argument type of a query function, without exporting it separately
type ListArgs = Parameters<typeof listProducts>[1];
//   ^ ListProductsArgs — [0] is the Pool
```

**`Awaited<T>` unwraps recursively and only unwraps thenables** — the comments
in the declaration say so directly. It is what makes an async repository's row
type reachable in one expression:

```ts
type ProductRow = Awaited<ReturnType<ProductsRepo['bySlug']>>;
//   ^ ProductDetailRow | null
```

That composition — `Awaited<ReturnType<T[K]>>` — is the single most useful
derivation in a codebase full of async functions, and it is three utilities
stacked with no cleverness at all.

## When deriving is the wrong answer

Deriving couples two things **on purpose**. The question is never "can I derive
this?" but "should these move together?".

| Situation | Derive? | Why |
|---|---|---|
| Repository interface from its factory | ✅ | They *are* one thing; the interface is a view |
| Response DTO from a database row type | ⚠️ | They move together until the day the API must not change and the column does — [chapter 02·04](../02-zod-as-the-source-of-truth/04-response-schemas-and-mappers.md) keeps them separate for exactly this reason |
| A published API type from an internal type | ❌ | A refactor of the internal type becomes a breaking change to consumers, discovered by them |
| A test fixture's type from the production type | ✅ | You *want* the fixture to stop compiling when the shape changes |
| A React component's props from a data type | ⚠️ | Fine while the component renders that data; a coupling the moment it renders a subset |

🔴 **The published-type row is the one that bites.** `export type PublicOrder =
Omit<OrderRow, 'internal_notes'>` looks tidy and means that renaming a column
changes your package's public API. Anything other packages import is a
declaration you *want* to have to edit deliberately.

## Gotchas

**★ `ReturnType<typeof f>` is `any` when `f` is `any`, and nothing says so.**
An untyped import, a `.js` module without declarations, or a factory whose own
return type inferred to `any` all produce a repo type that checks nothing. The
symptom is that every consumer compiles no matter what you do to it. Hover the
alias; if it says `any`, the derivation is decorative.

**★ `typeof f` on an overloaded function gives you the last overload only.**
`ReturnType` of an overloaded function resolves against the final signature,
silently. Repository factories are not usually overloaded, but the query
helpers sometimes are, and a `ReturnType` over one of those is quietly wrong
rather than an error.

**★ Deriving a public type from an internal one exports your refactors.**
`Omit<OrderRow, 'internal_notes'>` as a package's public type means a column
rename is a breaking change for every consumer, and nobody at the rename site
knows. Public types are hand-written declarations, and the check that they
still match is a test, not an equality of types.

**★ `Awaited<T>` unwraps recursively, which is almost always what you want and
occasionally not.** A function returning `Promise<Promise<Order>>` — usually a
mistake — gives `Awaited` a plain `Order`, so the utility hides the double wrap
rather than reporting it. The declaration's own comment describes the recursion
explicitly.

**★ `Parameters<T>` is a tuple type, so `Parameters<T>[0]` is a positional
read.** Inserting a parameter shifts every index, and every `[1]` in the
codebase now refers to something else — silently, because the new type is
usually also legal somewhere. Prefer naming the argument type and exporting it
when more than one place reads it.

**★ `ReturnType` on a generic function gives you the *unresolved* return
type.** `ReturnType<typeof identity>` for `function identity<T>(x: T): T` is
`unknown`, because the type parameter has no argument to be inferred from. If
you need the instantiated return, derive from a call:
`type R = ReturnType<typeof identity<string>>`.

**★ A derived repo type is only as narrow as the factory's inferred return.**
If `productsRepo` is annotated `: ProductsRepo` — the hand-written interface —
then `ReturnType<typeof productsRepo>` is that interface again and the
derivation is circular decoration. The whole benefit comes from the factory's
return type being *inferred*. Do not annotate the factory.

**★ `Awaited<ReturnType<…>>` reads inside-out and is worth aliasing once.**
Three nested utilities at a call site is a type nobody re-reads. Export
`type ProductRow = Awaited<ReturnType<ProductsRepo['bySlug']>>` from the module
that owns the repo, and let consumers use the name.

## Interview questions

**★ Why `ReturnType<typeof productsRepo>` rather than an interface?**
Because the factory and the interface would be two declarations of one shape,
and nothing keeps them in step: add a method and the interface silently lacks
it; change an argument type and the interface still advertises the old one.
Neither divergence errors where the change was made. The derived type makes the
factory the single declaration and the type a view of it, so the interface
cannot be out of date.

**★ What does `ReturnType`'s false branch tell you about its failure mode?**
That it produces `any` rather than an error. The declaration is
`T extends (...args: any) => infer R ? R : any`, and the constraint means the
false branch is unreachable for legal arguments — but an `any` input makes the
whole conditional `any`, so a repo whose factory lost its types yields a repo
type that checks nothing. There is no diagnostic; the only signal is that
everything downstream suddenly compiles.

**★ How do you get the row type out of an async repository method?**
`Awaited<ReturnType<ProductsRepo['bySlug']>>` — indexed access to reach the
method, `ReturnType` to get its `Promise<…>`, `Awaited` to unwrap it. `Awaited`
recurses and only unwraps thenables, per its declaration's comments, so it
handles a promise of a promise as well as the ordinary case. Alias it once in
the module that owns the repo rather than repeating the three-deep expression.

**★ When should you *not* derive?**
When the two types should be able to move independently. A package's published
types are the clear case: deriving them from internal shapes means a column
rename or an internal refactor becomes a breaking change nobody noticed making.
Response DTOs are the borderline case — this app writes them by hand, with a
mapper, precisely so the API can hold still while the database moves.

**★ Someone annotates the repo factory with the hand-written interface *and*
derives the type from it. What has that achieved?**
Nothing, twice. The factory's return type is now the annotation, so
`ReturnType<typeof productsRepo>` is that interface again — a circular
restatement — and the hand-written interface is back as the single source of
truth with the derivation as decoration on top. The benefit depends entirely on
the factory's return type being *inferred*, which means leaving it unannotated
and letting the object literal define the shape.

---

← [Overview](README.md) ·
Next → [`Pick`, `Omit`, `Partial`, `Required`, `Readonly`](02-pick-omit-partial-required.md)
