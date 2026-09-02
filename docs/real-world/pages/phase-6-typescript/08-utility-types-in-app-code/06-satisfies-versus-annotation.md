---
title: "satisfies earns its place on tables and not on mappers, because a table's value is its specific type and an annotation replaces exactly that — which is the information the three tables in this app cannot afford to lose"
sidebar_label: "06 · satisfies vs annotation vs as"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the TypeScript **4.9** release note on
> [the `satisfies` operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html),
> the handbook on
> [`const` assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#const-assertions)
> and
> [type assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions),
> and the `lib.es5.d.ts` declarations of `Record` and `Exclude` read from
> `typescript@6.0.3` (TypeScript is not installed in this checkout). The
> argument was promised by
> [chapter 02·04](../02-zod-as-the-source-of-truth/04-response-schemas-and-mappers.md).
> Target: **TypeScript 7.0.2** (phase spine).
> Documentation-validated; **no console blocks, no timings**.

**[Chapter 02·04](../02-zod-as-the-source-of-truth/04-response-schemas-and-mappers.md)
ended by saying `satisfies` earns its place on tables — the sort table, the
error-code map, the route registry — and not on mappers, and pointed here for
the argument.** It is a single distinction: a mapper's job is to produce exactly
a contract, so replacing its inferred type with that contract loses nothing and
catches excess properties; a table's *value* is its specific type — the literal
keys, the literal values — and an annotation throws that away while looking
like it added safety.

## The dilemma, in the release note's own words

> *"TypeScript developers are often faced with a dilemma: we want to ensure
> that some expression matches some type, but also want to keep the most
> specific type of that expression for inference purposes."*

> *"We could try to catch that `bleu` typo by using a type annotation on
> `palette`, but we'd lose the information about each property."*

**Check, without replacing.** That is the whole feature, and every use below is
an instance of it.

## The three tables

### 1 · The sort table

```ts
// apps/api/src/db/products.ts
export const SORT_SQL = {
  newest:     'p.created_at desc, p.id desc',
  price_asc:  'p.price_cents asc, p.id asc',
  price_desc: 'p.price_cents desc, p.id desc',
} as const satisfies Record<SortKey, string>;
```

- **`satisfies`** checks that every `SortKey` has an entry and that no key
  outside the union sneaks in. Add `'rating_desc'` to `SortKey` and this object
  fails to compile.
- **`as const`** keeps the values as string literals, so `SORT_SQL[sort]` is a
  literal type rather than `string` — which matters when the value is
  interpolated into SQL and you want the set of possible fragments to be
  finite and reviewable.
- **An annotation** — `const SORT_SQL: Record<SortKey, string> = {…}` — checks
  the same completeness and gives back `string`, and `keyof typeof SORT_SQL`
  becomes `SortKey` either way here (because `K` is already the union), so this
  is the table where the loss is smallest and the habit is still worth
  keeping.

### 2 · The error-code map

```ts
// packages/shared/src/error-extras.ts
export const ERROR_EXTRAS = {
  OUT_OF_STOCK:     z.object({product_ids: z.array(z.number().int())}),
  PAYMENT_DECLINED: z.object({decline_code: z.string()}),
  STALE_STATUS:     z.object({current: OrderStatusSchema}),
  RATE_LIMITED:     z.object({retry_after_seconds: z.number().int()}),
  VALIDATION:       z.object({issues: z.array(FieldIssue)}),
} as const satisfies Partial<Record<ErrorCode, z.ZodType>>;
```

🔴 **Here the annotation is actively destructive**, and
[chapter 07·04b](../07-the-typed-api-client/04b-narrowing-errorbody-by-code.md)
depends on it not being one. With `const ERROR_EXTRAS: Partial<Record<ErrorCode,
z.ZodType>>`, `keyof typeof ERROR_EXTRAS` is the *whole* `ErrorCode` union
rather than the five keys present, and each value is `z.ZodType | undefined`.
The mapped type that builds `ApiError` reads `C extends keyof Extras` — which
is now true for all twenty-one codes — and gives every member the extras of
none of them. The table still looks right; the type it generates is nonsense.

### 3 · The route registry

```ts
// packages/shared/src/routes.ts
export const routes = { get: {…}, post: {…}, … } as const satisfies ApiMap;
```

Same failure, larger blast radius:
[chapter 07·03](../07-the-typed-api-client/03-the-route-map.md) spells it out —
annotate and `keyof typeof routes.get` collapses to `string`, the indexed
access returns the generic `RouteSpec`, and every response type becomes
`unknown` while every call site keeps compiling.

**The pattern across all three: an annotation is fine when you only wanted the
check, and wrong the moment anything reads `keyof typeof` or indexes into the
object.**

## And why a mapper takes the annotation

```ts
// apps/api/src/http/mappers.ts
export function productSummary(p: ProductListRow): ProductSummary {
  return {
    slug: p.slug, name: p.name, price_cents: p.price_cents,
    in_stock: p.stock > 0, cover_url: p.cover ? `/uploads/${p.cover}` : null,
  };
}
```

Chapter 02·04's reasoning, restated: `satisfies` on the returned object would
keep the *narrower* inferred type — `cover_url: string` where the branch is
statically known — so the function's public type becomes narrower than the
contract, and a caller can come to depend on a narrowness the schema never
promised. **A mapper's entire job is to produce exactly the contract**, so
replacing its inferred type with the contract is not a loss, and the annotation
also catches excess properties on the returned literal.

📌 **The rule in one line: annotate when the declared type is the point;
`satisfies` when the value's own type is the point.**

## `as` is neither, and it is the one to be nervous about

```ts
const SORT_SQL = { … } as Record<SortKey, string>;   // ✗
```

An assertion tells the compiler what to believe. A missing `SortKey` entry is
not reported, and a *misspelled* key is not reported either as long as the
object is close enough to be assertable. `satisfies` reports both.

**The three, side by side:**

| Form | Checks the value? | Result type | Reports a missing key? |
|---|---|---|---|
| `const x: T = {…}` | ✅ | `T` | ✅ |
| `const x = {…} satisfies T` | ✅ | the literal type of the value | ✅ |
| `const x = {…} as T` | partially | `T` | ❌ |

⚠️ **`as` has exactly two legitimate uses in this corpus**: narrowing a value
you have already validated at run time — the single `as ApiError` in
[chapter 07·04c](../07-the-typed-api-client/04c-parsing-and-rendering-api-errors.md)
— and `as const`, which is not a type assertion in the same sense at all.
Everything else is a claim, and claims are what the phase gate is trying to
eliminate.

## Gotchas

**★ `as const` and `satisfies` do different jobs and both are usually
wanted.** `as const` alone gives literal types and no shape check, so a key
that should not exist compiles until a lookup fails. `satisfies` alone checks
the shape and lets values widen — `dir` becomes `string`. `as const satisfies
T` is the combination, and the order matters: the `as const` applies to the
expression, then `satisfies` checks the result.

**★ 🔴 Annotating a table destroys `keyof typeof` and nothing tells you.**
Every consumer keeps compiling, because `string` accepts the keys they were
passing and `unknown` accepts every response they were assigning. The client
goes from precise to useless silently, which is the worst possible failure
shape.

**★ `satisfies` does not make a value `readonly`.** It is a check, not a
modifier. If mutation matters — a registry a wrapper could push into — that is
`as const`'s job, and `Object.freeze` is the run-time half.

**★ `satisfies` on a function's return expression narrows the function's public
type.** That is the mapper case: the inferred literal type flows out through
the inferred return type, so callers see a shape narrower than the contract and
may depend on it. Annotate the *function's return type* instead; the annotation
is the contract and the body is checked against it.

**★ Excess-property checking still applies with `satisfies`, and that is a
feature.** `{slug, name, stock} satisfies ProductSummary` reports `stock` as an
excess property, which is exactly the check chapter 02·04 wanted from
`satisfies` on the mapper. The reason the mapper still takes the annotation is
the *return type widening*, not the excess check.

**★ Excess-property checking does not survive a spread.** `{...base, extra: 1}
satisfies T` does not report `extra` if `base` is a variable, because the
freshness that drives the check is lost. This is the hole
[chapter 02·04](../02-zod-as-the-source-of-truth/04-response-schemas-and-mappers.md)
called "the excess-property hole you will hit within a week" — and neither
`satisfies` nor an annotation closes it.

**★ `satisfies` is a compile-time operator with no run-time output.** It emits
nothing, so it cannot be used to validate data — a habit worth naming, because
the word suggests a check that happens. The run-time equivalent is a schema
parse.

**★ A table declared with `satisfies` still allows a wrong *value* if the
constraint is loose.** `Record<SortKey, string>` accepts any string, so
`price_asc: 'p.price_cents asc'` missing its tiebreaker compiles. The
constraint is only as strong as the type you wrote; `satisfies` guarantees
conformance to it, not correctness.

**★ `satisfies` before `as const` is a different expression.** `{…} satisfies T
as const` parses and applies the const assertion to the *result* of the
satisfies expression, which is not what anyone means. Write `as const
satisfies T`.

**★ Under an older compiler `satisfies` does not exist.** It landed in 4.9, so
a package published for consumers on older TypeScript cannot use it in
`.d.ts`-visible positions. That is rarely a live concern now and is worth
knowing when a build fails with an inscrutable parse error in someone else's
CI.

## Interview questions

**★ Why does the sort table use `as const satisfies Record<SortKey, string>`
rather than an annotation?**
Because the annotation replaces the object's type with `Record<SortKey,
string>`, which gives back `string` values and — for tables whose keys are not
already a closed union — a `keyof` of `string`. `satisfies` performs the same
completeness check while leaving the declared type as the literal object, so
the SQL fragments stay literal types and `keyof typeof` stays the real key set.
The release note frames it exactly as a dilemma between matching a type and
keeping the most specific type.

**★ Where is annotating a table actively destructive rather than merely
lossy?**
Anywhere a type is computed from the object. The error-extras table is the
sharpest case: annotated as `Partial<Record<ErrorCode, z.ZodType>>`, `keyof
typeof ERROR_EXTRAS` becomes all twenty-one codes instead of the five present,
so the mapped type that builds `ApiError` gives every member the extras of none
of them — and nothing errors. The route map is the same failure with a bigger
blast radius: every response type silently becomes `unknown`.

**★ So why does a mapper take the annotation?**
Because a mapper's job is to produce exactly the contract, so replacing its
inferred type with the contract loses nothing you wanted. `satisfies` on the
returned object keeps the narrower inferred type — `cover_url: string` where a
branch is statically known — and that narrowness leaks into the function's
public type, letting callers depend on a guarantee the schema never made.
Annotate the return type and the body is checked against the contract.

**★ What does `as` do that neither of the others does?**
Stop checking. An assertion tells the compiler to believe the type, so a
missing key and a wrong value both pass, and the only failure is at run time.
Its two legitimate uses here are narrowing a value already validated at run
time, and `as const`, which is a different operation despite the shared
keyword.

**★ Does `satisfies` catch excess properties?**
Yes — on a fresh object literal. `{slug, name, stock} satisfies ProductSummary`
reports `stock`. What it does *not* survive is a spread: `{...base, extra: 1}`
loses the freshness that drives the check, so the extra key goes unreported by
`satisfies` and by an annotation alike. That hole is why response mappers in
this app are also covered by a parse rather than by types alone.

**★ Is `as const satisfies T` ever wrong?**
When you actually want the widened type — a mutable table whose values will be
reassigned, or a value passed to something expecting mutable arrays, where the
deep `readonly` from `as const` becomes an assignability error. In that case
`satisfies T` alone gives you the check and the specific type without the
readonly modifiers, which is usually the right middle ground.

---

← Prev: [`Exclude`, `Extract` and distributivity](05-exclude-extract-and-distributivity.md) ·
[Overview](README.md) ·
Next → [Template literal types](07-template-literal-types.md)
