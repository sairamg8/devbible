---
title: "rows[0] is typed as a row and is often undefined, which is the one unsoundness in this data layer that costs production incidents"
sidebar_label: "04 · Rows that lie"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **`@types/pg`** declarations on DefinitelyTyped
> ([`types/pg/index.d.ts`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pg/index.d.ts))
> — `QueryResult.rows: R[]` — and the TypeScript
> [`noUncheckedIndexedAccess` reference](https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess).
> **TypeScript 7.0.2**, `pg` **8.x**, PostgreSQL **17**. Concept homes:
> [TypeScript 10·02 — `noUncheckedIndexedAccess`](../../../../typescript/pages/phase-10-strictness/02-nouncheckedindexedaccess.md),
> [TypeScript 10·07 — unsound by design](../../../../typescript/pages/phase-10-strictness/07-unsound-by-design/README.md),
> [TypeScript 1·10 — null and undefined](../../../../typescript/pages/phase-1-type-vocabulary/10-null-and-undefined.md).

**`rows` is declared `R[]`, so `rows[0]` has type `R` and the value is
`undefined` whenever the query matched nothing.** That is not a `pg` bug — it is
TypeScript's documented, deliberate unsoundness about array indexing, and every
data layer in every language with this property has the same bruise. In this app
the bruise has a specific shape: `const {rows: [order]} = await tx.query(…)`
appears in the checkout path, the auth path and every `bySlug` lookup, and in
each of them the empty case is a real possibility with a different correct
response.

## The declaration and the hole

```ts
export interface QueryResult<R extends QueryResultRow = any> extends QueryResultBase {
    rows: R[];
}
```

`R[]`, indexed, yields `R`. Under default settings TypeScript does not add
`undefined` to an indexed access, because doing so would make ordinary
loop-and-index code intolerable. The
[`noUncheckedIndexedAccess`](https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess)
flag changes it — and changes it everywhere, including the twenty places in the
React code where an index is provably in range.

**This app turns it on.** The cost is real and is paid in ceremony at array
indexing sites; the benefit is that the single highest-frequency runtime
`TypeError` in a raw-SQL codebase becomes a compile error. But the flag is not
the fix on its own, because the ergonomic response to it is `rows[0]!`, and a
non-null assertion is the same lie with a shorter spelling.

## The fix: two helpers, and no bare indexing in `db/`

```ts
// db/rows.ts
export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  constructor(readonly what: string) {
    super(`${what} not found`);
    this.name = 'NotFoundError';
  }
}

/** Zero or one row expected. Returns undefined for zero. */
export function maybeOne<R>(rows: readonly R[]): R | undefined {
  if (rows.length > 1) {
    throw new Error(`expected at most one row, got ${rows.length}`);
  }
  return rows[0];
}

/** Exactly one row expected. Throws a domain error for zero. */
export function exactlyOne<R>(rows: readonly R[], what: string): R {
  const row = maybeOne(rows);
  if (row === undefined) throw new NotFoundError(what);
  return row;
}
```

```ts
// db/products.ts
export async function productBySlug(
  pool: Pool, slug: string,
): Promise<ProductDetailRow | undefined> {
  const {rows} = await q(pool).query<ProductDetailRow>(
    `select id, name, slug, description, price_cents, stock, attributes
       from products where slug = $1 and deleted_at is null`,
    [slug],
  );
  return maybeOne(rows);
}
```

Three properties fall out of that pair, and each answers a mistake:

1. **The return type carries the absence.** `ProductDetailRow | undefined`
   forces
   [3·05's handler](../../phase-3-express-api/05-catalog-endpoints.md) to write
   the 404 branch — it cannot forget, because the compiler will not let it read
   `.name`.
2. **"At most one" is checked at run time, not assumed.** A unique index
   *should* make two rows impossible; if two arrive, something is wrong that a
   silent `rows[0]` would hide forever. The throw is loud on purpose.
3. **`exactlyOne` names what was missing.** `NotFoundError('product')` reaches
   [the error contract's classify table](../../phase-3-express-api/09-the-error-contract.md)
   with enough information to become a 404 with a useful title, rather than a
   `TypeError` becoming a 500.

🔴 **The rule that makes this stick: no bare `rows[…]` outside `db/rows.ts`.**
Not a style preference — it is the only mechanical way to guarantee the two
helpers are the sole path from an array to a row, and it is enforceable by
lint. Destructuring counts: `const {rows: [order]} = …` is an index in
disguise, and it types `order` as `R` with no `undefined` in sight.

## `returning` is where this bites hardest

```ts
const {rows} = await tx.query<{id: number}>(
  `insert into orders (user_id, status, address, total_cents, idempotency_key)
   values ($1, 'pending', $2, 0, $3)
   on conflict (idempotency_key) do nothing
   returning id`,
  [userId, address, idempotencyKey],
);
```

[1·06's checkout transaction](../../phase-1-database/06-the-checkout-transaction/01-the-transaction.md)
depends on this query returning **zero** rows when the idempotency key already
exists — the empty result *is* the replay signal. So:

```ts
const inserted = maybeOne(rows);          // {id: number} | undefined
if (!inserted) {
  // replay: fetch the original order and return it unchanged
  const {rows: existing} = await tx.query<OrderReplayRow>(
    `select id, status, total_cents from orders where idempotency_key = $1`,
    [idempotencyKey],
  );
  return {order: exactlyOne(existing, 'order'), replay: true};
}
```

The second `exactlyOne` is not defensive padding. If the insert conflicted, a
row with that key exists by definition — so zero rows here means the row was
deleted between the two statements inside a transaction, which is either a bug
or a database being edited by hand. Turning that into `NotFoundError('order')`
rather than `TypeError: Cannot read properties of undefined` is the difference
between a log line you can act on and one you cannot.

⚠️ **`update … returning` has the same shape and a different meaning.**
`update products set stock = stock - $1 where id = $2 returning stock` returns
zero rows when the `where` matched nothing — a product deleted mid-checkout —
which is a **domain** condition, not an invariant violation. Use `maybeOne` and
branch; do not reach for `exactlyOne` because the happy path always has a row.

## The other three lies in the same family

**`rowCount` is `number | null`.** Covered in
[chunk 01](01-the-generic-is-an-assertion.md); the practical consequence is that
`if (result.rowCount === 0)` is not the same test as `if (rows.length === 0)`,
and only the second is available for statements without `returning`. Prefer
`returning`.

**`Array.prototype.find` returns `T | undefined` and everyone knows it; `.filter()[0]`
returns `T` and nobody notices.** In the checkout's stock check:

```ts
const short = items.filter((i) => i.stock < i.quantity);
if (short.length > 0) throw new OutOfStockError(short.map((i) => i.product_id));
```

is safe because it never indexes. `const first = items.filter(…)[0]` would type
as `CheckoutItemRow` and be `undefined` for an in-stock cart.

**A `Promise.all` of queries preserves tuple positions and loses nothing — until
someone maps.** `const [a, b] = await Promise.all([qa(), qb()])` is properly
typed as a tuple. `const results = await Promise.all(ids.map(fetchOne))` is
`(Row | undefined)[]` only if `fetchOne` says so; if it returns `Row` by
indexing, the whole array inherits the lie.

## Gotchas

**★ `const {rows: [order]} = await …` is an unchecked index wearing
destructuring syntax.** It is the most common spelling of this bug in the
codebase precisely because it reads like it cannot fail. `order` is typed as the
row and is `undefined` for an empty result. `maybeOne(rows)` is one more token
and carries the truth.

**★ `noUncheckedIndexedAccess` turns the lie into an error and invites `!` as
the answer.** The flag is right and the non-null assertion is the same
unsoundness with fewer characters, now blessed by the author. Ban `!` in `db/`
via `@typescript-eslint/no-non-null-assertion` and route every access through
the helpers.

**★ `exactlyOne` where `maybeOne` belongs converts a normal condition into a
500.** A product that does not exist is a 404 — an ordinary outcome of a public
URL. Throwing `NotFoundError` from the data layer is fine *if* the classify
table maps it to 404; throwing a bare `Error` is not. Decide per query whether
zero rows is a domain outcome or an invariant violation, and pick the helper
that says so.

**★ `rows.length > 1` in `maybeOne` throws on a query you thought was unique.**
That is the point, and it will fire the first time someone forgets the `limit 1`
or joins a one-to-many. It is a much better failure than silently processing the
first of six.

**★ A `readonly R[]` parameter on the helpers is doing real work.**
`maybeOne(rows: readonly R[])` means the helper cannot sort, splice or reverse
the driver's array in place. It also means the helpers accept a `readonly`
array, which the mapper layer may well hand them. It costs nothing and removes
a category of aliasing bug.

**★ `rows.at(0)` is honest and `rows[0]` is not, under default settings.**
`Array.prototype.at` is declared to return `T | undefined`. If for some reason
the flag cannot be turned on project-wide, `at(0)` is the one-token migration
that makes indexing truthful at the sites that matter.

**★ Empty-result handling that lives in the route rather than the data layer
gets duplicated and then diverges.** Three routes call `productBySlug`; if each
does its own `if (!rows.length)` the 404 message drifts and one of them
eventually forgets. The data layer returns `T | undefined` and the routes each
decide the HTTP response — one decision per route, one absence check total.

## Interview questions

**★ Why is `rows[0]` typed as a row when it may be `undefined`?**
Because TypeScript's default index-signature behaviour omits `undefined` from
indexed access — a deliberate unsoundness that keeps ordinary loop code
readable. `pg` declares `rows: R[]`, so the index yields `R`. Nothing about it
is specific to the driver; the same hole exists for every array in the codebase,
and the data layer is simply where it costs the most.

**★ You turn on `noUncheckedIndexedAccess`. Are you done?**
No. The flag makes the lie a compile error and the path of least resistance is
`rows[0]!`, which restores the lie with the author's signature on it. The flag
plus a ban on non-null assertions in `db/` plus two helpers that own every
array-to-row transition is the complete answer; any one of the three alone
leaves the same production `TypeError`.

**★ What is the difference between `maybeOne` and `exactlyOne`, and how do you
choose?**
`maybeOne` returns `T | undefined` and is for queries where zero rows is a
normal outcome — a slug that does not exist, an update whose `where` matched
nothing. `exactlyOne` throws a domain `NotFoundError` and is for queries where
zero rows means an invariant is broken — reading back a row you just inserted or
conflicted with. Choose by asking whether zero rows is something a user can
cause.

**★ Why does `maybeOne` throw when more than one row arrives?**
Because "at most one" was an assumption, and an assumption that silently
selects the first of many is unfalsifiable. If a unique index is supposed to
guarantee it, a second row means the index is missing or the query is not the
one you thought — both worth an immediate loud failure rather than a subtly
wrong response served indefinitely.

**★ In the checkout, an insert with `on conflict do nothing … returning`
produces zero rows. Is that an error?**
No — it is the replay signal, and the whole idempotency design depends on it.
Zero rows means the idempotency key already existed, so the correct behaviour is
to fetch the original order and return it. The follow-up read *does* use
`exactlyOne`, because at that point the row's existence is guaranteed by the
conflict that just happened.

**★ Why must absence be represented in the data layer's return type rather than
handled in the route?**
Because a return type is checked and a convention is not. `ProductDetailRow |
undefined` forces every one of the three callers to handle the empty case, in
the way each of them should. A data layer that returns `ProductDetailRow` and
"just returns undefined sometimes" pushes an unwritten rule to three files, and
the first caller to forget it ships a 500 where a 404 belonged.

---

← Prev: [What `pg` actually returns](03-what-pg-actually-returns.md) ·
[Overview](README.md) ·
Next → [Closing the loop](05-closing-the-loop.md)
