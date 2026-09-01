---
title: "pool.query<Product> is an unchecked assertion wearing generic syntax, and knowing that is what makes the rest of the chapter necessary"
sidebar_label: "01 · The generic is an assertion"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **`@types/pg`** declarations on DefinitelyTyped
> ([`types/pg/index.d.ts`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pg/index.d.ts)),
> read directly — `QueryResultRow`, `QueryResult`, `QueryResultBase` and the
> `query` overloads are quoted verbatim below. **TypeScript 7.0.2**, **Node
> 24.19.0**, PostgreSQL **17**, `pg` **8.x** with `@types/pg`. Concept homes:
> [TypeScript 2·08 — `as` assertions](../../../../typescript/pages/phase-2-narrowing/08-as-assertions/README.md),
> [TypeScript 10·03 — containing `any`](../../../../typescript/pages/phase-10-strictness/03-containing-any.md),
> [PostgreSQL — Node and `pg`](../../../../postgresql/syllabus/03-node-and-pg.md).
> The data layer being typed is
> [2·02's](../../phase-2-node-services/02-the-data-layer.md).

**There is no ORM in this app, which means there is no mechanism anywhere that
compares a SQL string to a TypeScript type.** `pool.query<ProductRow>(sql)` reads
like a checked operation and is not: the type parameter is written into the
result type and nothing validates it. It is `as ProductRow[]` with better
ergonomics. That is not a reason to stop using it — naming the shape once beats
naming it never — but every guarantee in this chapter has to be built on top of
that admission rather than around it, and a team that believes the generic is a
check will write code that is wrong in a way nobody is looking for.

## The declarations, verbatim

From `types/pg/index.d.ts`:

```ts
export interface QueryResultRow {
    [column: string]: any;
}

export interface QueryResultBase {
    command: string;
    rowCount: number | null;
    oid: number;
    fields: FieldDef[];
}

export interface QueryResult<R extends QueryResultRow = any> extends QueryResultBase {
    rows: R[];
}
```

and the overload every call in this codebase resolves to:

```ts
query<R extends QueryResultRow = any, I = any[]>(
    queryTextOrConfig: string | QueryConfig<I>,
    values?: QueryConfigValues<I>,
): Promise<QueryResult<R>>;
```

Three facts fall straight out, in order of how much damage each does.

**1 · `R` defaults to `any`.** An un-annotated call —

```ts
const {rows} = await pool.query('select id, name from products');
```

— gives `rows: any[]`. Not `unknown[]`, not `Record<string, unknown>[]`.
`rows[0].nmae.toUpperCase()` compiles. `rows[0].price_cents * quantity`
compiles when the column is a string. Every property access below an
un-annotated query is outside the type system, and the boundary between the
typed and untyped halves of the codebase is invisible in a diff.

**2 · The parameter is written *into* the result, never checked against the
SQL.** The SQL is a `string`. TypeScript has no view into what columns it
selects, what types they are, or whether it selects anything at all.
`pool.query<{banana: Date}>('select 1')` type-checks and produces a
`QueryResult<{banana: Date}>` whose rows contain a single `?column?` property.

**3 · `QueryResultRow` constrains `R` to something index-signature-shaped.**
The constraint is satisfied by essentially every object type, so it is not
protecting you from anything — but the *declaration form* of your row types
interacts with it, which is the next section.

## Row types are `type` aliases here, not interfaces

The natural way to write a row type is an interface. There is a long-standing
TypeScript distinction that makes a type alias the safer default when a
constraint mentions an index signature: an object type written as a type alias
gets an *implicit* index signature and an `interface` does not, which is why
`interface Foo {a: string}` famously fails to satisfy `Record<string, unknown>`
while `type Foo = {a: string}` succeeds
([microsoft/TypeScript#15300](https://github.com/microsoft/TypeScript/issues/15300)).

⚠️ **Whether `QueryResultRow`'s `any`-valued index signature triggers the same
failure is a compiler detail I could not settle from the documentation** — the
assignability rules for index signatures whose value type is `any` are not
spelled out in the handbook, and this page does not run a compiler. The
practical response is to sidestep the question: declare row types as `type`
aliases. It costs nothing, it removes a class of error message that reads as
nonsense the first time you meet it, and row types have no use for the two
things an interface offers that an alias does not (declaration merging and
`extends` clauses that read nicely) — a row type must never merge, and it
should never extend.

```ts
// db/products.ts — the house form
export type ProductListRow = {
  id: number;
  name: string;
  slug: string;
  price_cents: number;
  stock: number;
  sort_value: number | string;
  cover: string | null;
};
```

## What the generic does buy

It would be a mistake to read all of the above as "so do not bother". A named
row type on every query buys three things a bare `any` does not, and they are
worth the price of writing them:

- **One place to state the shape.** Every consumer of `listProducts` agrees
  about what a row is, because they all read the same declaration.
- **A break point for the phase gate.** Renaming `price_cents` in the schema
  means editing `ProductListRow`, and *that* edit breaks the mapper, the
  handler and the component. The type is the transmission belt; the fact that
  it is unverified against the SQL does not stop it from propagating a change.
- **A place for a comment about the driver.** `sort_value: number | string` is
  a fact about `pg`'s type parsing, not about the schema, and the row type is
  where it can be written down next to the thing it describes.

**What it does not buy is verification.** The SQL and the type are two
declarations of the same fact, exactly like the hand-written union and the
runtime array of
[chapter 02's status enum](../02-zod-as-the-source-of-truth/05-the-status-enum-four-ways.md)
— and the closure is the same shape: not a type, but a check that runs in CI.
[Chunk 05](05-closing-the-loop.md) builds it.

## Where the assertion is least safe

Rank the app's queries by how badly a wrong row type would hurt, because that
ranking decides where the extra effort goes:

| Query | If the type is wrong | Assurance level |
|---|---|---|
| `checkout`'s locked read of `cart_items` | wrong price snapshot, wrong stock decrement — money | 🔴 runtime-parsed |
| `orders.byUser` | wrong data rendered in the account page | row type + contract test |
| `listProducts` | a missing image, a broken sort | row type |
| dashboard aggregates | a wrong number on an admin chart | row type |

🔴 **Money-carrying rows get a runtime parse and everything else does not.**
That is a deliberate, uneven allocation of the one expensive tool available,
and it is defensible precisely because it is uneven —
[chunk 05](05-closing-the-loop.md) states the rule and shows the parse.

## Gotchas

**★ An un-annotated `pool.query` produces `any[]` and disables checking
downstream, invisibly.** No error, no warning, and `any` is contagious: the
mapper's inferred parameter type becomes `any`, the handler's response object
becomes partly `any`, and a rename that should break three files breaks none.
The lint rule that makes this visible is
`@typescript-eslint/no-unsafe-member-access` plus a ban on calling `.query`
outside `db/` — see
[TypeScript 10·11](../../../../typescript/pages/phase-10-strictness/11-typescript-eslint/README.md).

**★ `pool.query<Whatever>(sql)` never fails, however wrong `Whatever` is.**
The type parameter is not compared to the SQL — it cannot be, the SQL is a
`string`. This means a copy-pasted query with a copy-pasted row type stays
"correct" after one of the two is edited. Treat the pairing as a comment that
the compiler happens to propagate.

**★ `select *` and a row type are actively incompatible.** The type lists the
columns you remembered; the query returns the columns that exist. Adding
`internal_notes` to `products` changes what the query returns and nothing else,
so a mapper that spreads the row now ships it. Every query in `db/` names its
columns explicitly — that rule exists for the wire contract first
([3·05's mapper argument](../../phase-3-express-api/05-catalog-endpoints.md))
and for the row type second.

**★ `rowCount` is `number | null`, and the `null` is not decorative.**
`QueryResultBase` declares it nullable because not every command reports a row
count. `if (result.rowCount > 0)` is a compile error under `strictNullChecks`
and `result.rowCount! > 0` is the wrong fix. For "did this update hit
anything?", prefer `returning` and check `rows.length`, which is a plain
`number` and is what the app does after every `update … returning id`.

**★ The `I` parameter types the *values* array and defaults to `any[]`.**
`query<R, I>(text, values?: QueryConfigValues<I>)` — so parameter arity and
order are unchecked too. Passing `[cartId]` to a query with three placeholders
is a runtime error from Postgres, not a compile error. This is the strongest
argument for keeping SQL and its parameter array physically adjacent in a small
function rather than assembling them across files.

**★ A row type is not a domain type, and naming it `Product` guarantees the
confusion.** `Product` in the shared package is the resource; `ProductListRow`
is what one query returns. Chapter 1's
[row-vs-resource rule](../01-the-shared-types-package/01-why-a-package.md) is
enforced here by naming: every row type ends in `Row` and lives in `db/`, and
nothing under `db/` is re-exported from the shared package.

## Interview questions

**★ Is `pool.query<ProductRow>(sql)` type-safe?**
No. The type parameter is written into the result type and nothing compares it
to the SQL — the SQL is a string the compiler cannot read. It is an assertion
with generic syntax, equivalent to `as ProductRow[]` on the rows. It is still
worth writing, because it names the shape in one place and propagates schema
changes to consumers; it simply is not a check.

**★ What is the type of `rows` when you do not supply the parameter, and why
does that matter more than it sounds?**
`any[]`, because `R` defaults to `any` in the `query` overload. It matters
because `any` propagates: the mapper's parameter, the handler's response and
eventually the component's props inherit it, so a whole vertical slice silently
leaves the type system, and nothing in a diff shows where the boundary moved.

**★ Why does this app write row types as `type` aliases rather than
interfaces?**
Because a constraint mentioning an index signature — which `R extends
QueryResultRow` is — is the one place where the alias/interface distinction
bites, and an alias never loses. Row types have no need for declaration
merging, so the only feature an interface offers here is the one that could hurt.

**★ Why is `select *` incompatible with a row type in a way that naming
columns is not?**
Because `select *` makes the query's result depend on the schema rather than on
the query text, so adding a column changes what comes back without changing any
file a reviewer reads. The row type then under-describes the result, and any
code that spreads the row ships the new column. Named columns make the query
and the type change together, in one diff.

**★ `result.rowCount > 0` fails to compile. What is the right fix?**
`rowCount` is declared `number | null`, so the comparison is rejected under
`strictNullChecks`. The right fix is usually to stop asking `pg` and ask the
query: add `returning id` and test `rows.length`, which is a `number`. The
wrong fix is `rowCount!`, which asserts away a nullability the driver's authors
put there on purpose.

**★ Given the generic is unchecked, why not skip it and cast at the mapper
instead?**
Because the mapper's cast would sit in the file with the most business logic
and the least driver context, and it would be one cast per consumer rather than
one per query. Keeping the assertion at the `query` call puts it next to the
SQL it is a claim about — which is the only place a reviewer can evaluate it.

---

← [Overview](README.md) ·
Next → [A row type per query](02-a-row-type-per-query.md)
