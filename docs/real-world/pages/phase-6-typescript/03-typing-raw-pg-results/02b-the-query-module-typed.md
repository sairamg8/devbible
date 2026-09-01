---
title: "The catalog query typed end to end, where the sort table is the union, the params array is unknown, and Array.at is the one honest indexer"
sidebar_label: "02b · The query module, typed"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **`@types/pg`** declarations on DefinitelyTyped
> ([`types/pg/index.d.ts`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pg/index.d.ts))
> and the TypeScript handbook's
> [`satisfies` release note](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html).
> **TypeScript 7.0.2**, `pg` **8.x**, PostgreSQL **17**. Concept homes:
> [TypeScript 2·10 — `satisfies`](../../../../typescript/pages/phase-2-narrowing/10-satisfies/README.md),
> [TypeScript 3·04 — `keyof`](../../../../typescript/pages/phase-3-generics/04-keyof/README.md),
> [TypeScript 5·03 — utility types](../../../../typescript/pages/phase-5-type-level/03-utility-types/README.md).
> The query is [1·04's](../../phase-1-database/04-the-catalog-query.md), unchanged.

**Typing an existing query module should change no runtime behaviour and no
line of SQL — if it does, the types are being used to redesign, which is a
separate decision made for separate reasons.** What follows is 1·04's catalog
query with types and nothing else, and four decisions inside it that are
transferable to every other module in `db/`.

## A whole query module, typed

Here is [1·04's catalog query](../../phase-1-database/04-the-catalog-query.md)
with types added and nothing else changed:

```ts
// db/products.ts
import type {Pool} from 'pg';
import {q} from './tx.js';

const SORTS = {
  newest:     {column: 'created_at',  dir: 'desc'},
  price_asc:  {column: 'price_cents', dir: 'asc'},
  price_desc: {column: 'price_cents', dir: 'desc'},
} as const satisfies Record<string, {column: string; dir: 'asc' | 'desc'}>;

export type Sort = keyof typeof SORTS;
//   'newest' | 'price_asc' | 'price_desc'

export type Cursor = {value: number | string; id: number};

export type ListProductsArgs = {
  categorySlug?: string;
  minCents?: number;
  maxCents?: number;
  sort?: Sort;
  cursor?: Cursor;
  limit?: number;
};

export type ProductPage = {
  items: ProductListRow[];
  nextCursor: Cursor | null;
};

export async function listProducts(
  pool: Pool, args: ListProductsArgs = {},
): Promise<ProductPage> {
  const {categorySlug, minCents, maxCents, sort = 'newest', cursor, limit = 24} = args;
  const s = SORTS[sort];                       // exhaustive: Sort is keyof SORTS

  const where: string[] = ['p.deleted_at is null'];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown): void => {
    params.push(value);
    where.push(clause.replace('?', `$${params.length}`));
  };

  if (categorySlug) add('c.slug = ?', categorySlug);
  if (minCents != null) add('p.price_cents >= ?', minCents);
  if (maxCents != null) add('p.price_cents <= ?', maxCents);

  if (cursor) {
    const op = s.dir === 'asc' ? '>' : '<';
    params.push(cursor.value, cursor.id);
    where.push(`(p.${s.column}, p.id) ${op} ($${params.length - 1}, $${params.length})`);
  }

  params.push(limit + 1);
  const {rows} = await q(pool).query<ProductListRow>(
    `select p.id, p.name, p.slug, p.price_cents, p.stock,
            p.${s.column} as sort_value,
            (select object_key from product_images i
              where i.product_id = p.id order by i.position limit 1) as cover
       from products p
       join categories c on c.id = p.category_id
      where ${where.join(' and ')}
      order by p.${s.column} ${s.dir}, p.id ${s.dir}
      limit $${params.length}`,
    params,
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return {
    items: page,
    nextCursor: hasMore && last ? {value: last.sort_value, id: last.id} : null,
  };
}
```

Four typing decisions in there, each worth naming:

- **`SORTS` is `as const satisfies Record<…>`.** `as const` freezes the literal
  strings so `keyof typeof SORTS` is the sort union and `s.dir` narrows to
  `'asc' | 'desc'`; `satisfies` checks the table's shape without widening it.
  Without `as const`, `s.dir` is `string` and the `op` ternary silently accepts
  a typo'd direction.
- **`Sort` is derived from the table**, so 3·02's `z.enum(['newest',
  'price_asc', 'price_desc'])` and the SQL table cannot drift far — and where
  they *could*, one line closes it:
  `const _sortsMatch: Sort = z.infer<typeof SortSchema>` in the schemas file.
- **`params` is `unknown[]`, not `any[]`.** The driver serialises whatever you
  give it; `unknown[]` says "these are values, not to be read" and stops a
  later `params[0].toUpperCase()` from compiling.
- **`page.at(-1)` is `ProductListRow | undefined`.** `Array.prototype.at`
  returns an optional, which is correct — `page` may be empty — so the
  `hasMore && last` guard is required by the type, not by taste. `page[page.length - 1]`
  would have typed as `ProductListRow` and been a lie; chunk 04 is about that
  family of lie.

## Naming the repo's own type

2·02's modules are factories returning an object of query functions. Do not
hand-write the interface for that object:

```ts
export function productsRepo(pool: Pool) {
  return {
    list: (args: ListProductsArgs) => listProducts(pool, args),
    bySlug: (slug: string) => productBySlug(pool, slug),
  };
}

export type ProductsRepo = ReturnType<typeof productsRepo>;
```

`ReturnType<typeof f>` keeps the repo's interface and its implementation as one
declaration — add a method and every consumer's type gains it. Writing the
interface by hand adds a second declaration and the usual drift.
**Chapter 08 · Utility types in app code** *(not written yet)* is where this
pattern is argued in general; here it is simply the right answer.

## Gotchas

**★ Renaming a column in the SQL and not in the row type is undetectable.**
`select p.price_cents as price` with `ProductListRow.price_cents` still
declared compiles, and `row.price_cents` is `undefined` at run time with type
`number`. Nothing in this chunk fixes that — [chunk 05](05-closing-the-loop.md)
is the only place it gets closed, and it is closed by a check in CI, not a type.

**★ `as const` without `satisfies` and `satisfies` without `as const` each lose
half the point.** `as const` alone gives literal types and no shape check, so a
typo in a key name compiles until a lookup fails. `satisfies` alone checks the
shape and lets `dir` widen to `string`. The combination — `as const satisfies
Record<…>` — is the only spelling that gives literal keys *and* a checked
shape.

**★ `params: any[]` re-opens everything the row type closed.**
A values array typed `any[]` lets you read from it — `params[0].id` compiles —
and lets you push a whole row into it by accident. `unknown[]` allows pushing
and forbids reading, which is exactly the contract a parameter array has.

**★ `keyof typeof SORTS` and the zod enum are still two declarations.**
`Sort` comes from the table; `SortSchema` is `z.enum(['newest', 'price_asc',
'price_desc'])` in the route's schemas file. Adding a sort to one and not the
other compiles: the query module gains a branch nothing can reach, or the
schema accepts a value that makes `SORTS[sort]` `undefined` and the next line
throw on `.column`. One line closes it, in the schemas file where both are
already imported:

```ts
import type {Sort} from '../db/products.js';
export const SortSchema = z.enum(['newest', 'price_asc', 'price_desc']);
const _sortsMatch: Sort = '' as z.infer<typeof SortSchema>;   // must be assignable
```

**★ A dynamically built `where` array is a `string[]` and the compiler is not
reading it.** `where.join(' and ')` produces valid SQL or invalid SQL with equal
enthusiasm, and `$${params.length}` numbering is arithmetic nobody checks. The
type system's contribution here is limited to keeping *values* out of the
string — that is what `add(clause, value)` enforces by taking the value
separately — and the injection guarantee comes from that separation, not from
any type.

**★ Identifiers interpolated into SQL must come from a `keyof`, never from a
parameter.** `p.${s.column}` is safe only because `s` was looked up in `SORTS`
by a key of type `Sort`. Widen `sort` to `string` anywhere on that path — an
un-`as const`-ed table, a `String(req.query.sort)`, a `Record<string, …>`
annotation — and the same line becomes an injection point. The narrowness of
`Sort` is a security property, not a convenience.

## Interview questions

**★ What does `as const satisfies Record<…>` give you that either half alone
does not?**
`as const` preserves the literal keys and values, so `keyof typeof SORTS` is a
usable union and `dir` narrows to `'asc' | 'desc'`. `satisfies` checks the
table against a shape without widening the value's type. Together you get a
checked table whose keys are a type; separately you get either an unchecked
literal or a checked but widened one.

**★ Why is the repo's type `ReturnType<typeof productsRepo>` and not a
hand-written interface?**
Because a hand-written interface is a second declaration of the same shape and
will drift the first time someone adds a method. Deriving it keeps the
implementation as the single source, and adding a query is one edit that every
consumer's type picks up.

**★ Why is `page.at(-1)` preferable to `page[page.length - 1]` here?**
Because `at` is declared to return `T | undefined` and the index signature is
declared to return `T`. The array can be empty, so the honest type is the
optional one, and the `hasMore && last` guard that follows is required by the
compiler rather than remembered by the author. Under
`noUncheckedIndexedAccess` the bracket form types the same way — but the app
should not depend on a compiler flag to make one expression truthful.

**★ Why is `params` typed `unknown[]` rather than `any[]`?**
Because a parameter array is write-only from the application's point of view:
values go in, the driver serialises them, nothing reads them back. `unknown[]`
permits the writes and forbids the reads, so `params[0].id` is a compile error.
`any[]` permits both and would let a whole row be pushed in by accident and
then read as though it were a scalar.

**★ How does typing the sort table protect against SQL injection?**
The one thing a parameter cannot be is an identifier, so the column name has to
be interpolated. It is safe because it is looked up in a frozen table by a key
whose type is `keyof typeof SORTS` — a three-member union that no user input can
inhabit without passing the boundary schema first. Lose the narrowness anywhere
on that path and the interpolation becomes an injection point with no other
change to the code.

---

← Prev: [A row type per query](02-a-row-type-per-query.md) ·
[Overview](README.md) ·
Next → [What `pg` actually returns](03-what-pg-actually-returns.md)
