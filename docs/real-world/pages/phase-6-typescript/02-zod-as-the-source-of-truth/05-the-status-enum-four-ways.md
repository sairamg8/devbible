---
title: "One status list has to be four artifacts, and the only one the compiler cannot reach is the Postgres enum"
sidebar_label: "05 · The status enum, four ways"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **zod 4.4.3** declarations in this repo
> (`classic/schemas.d.ts` — `_enum`, `ZodObject.pick/omit/extend/merge`,
> `ZodType.brand`), the [zod API reference](https://zod.dev/api) on branded
> types, and the
> [PostgreSQL 17 `ALTER TYPE` reference](https://www.postgresql.org/docs/17/sql-altertype.html).
> **TypeScript 7.0.2**, zod **4.4.3**, PostgreSQL **17**. Concept homes:
> [TypeScript 1·13 — enum vs union](../../../../typescript/pages/phase-1-type-vocabulary/13-enum-vs-union.md),
> [TypeScript 1·02 — literal types and `as const`](../../../../typescript/pages/phase-1-type-vocabulary/02-literal-types-and-as-const.md).
> The database enum is
> [1·01's `order_status`](../../phase-1-database/01-the-schema/02-carts-orders-reviews-outbox.md).

**The storefront's order status exists in four places and only three of them
are in TypeScript's reach.** The Postgres enum type, the runtime array the API
validates against, the union the client switches on, and the zod schema that
parses a response — all describing the same five strings. Chapter 1 showed how
to make three of them one declaration. This chunk finishes the job, names the
fourth as the one that needs a test rather than a type, and then does the same
exercise for the other kind of value that keeps getting confused with itself: a
`bigint` id.

## Four artifacts, one declaration, one test

```ts
// packages/shared/src/order.ts
import {z} from 'zod';

export const ORDER_STATUSES = [
  'pending', 'paid', 'shipped', 'delivered', 'cancelled',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];
//   'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'

export const OrderStatusSchema = z.enum(ORDER_STATUSES);
//   ZodEnum — parses at the boundary, infers back to OrderStatus
```

`z.enum` accepting the frozen array is declared, verbatim from
`zod/v4/classic/schemas.d.ts`:

```ts
declare function _enum<const T extends readonly string[]>(
  values: T, params?: string | core.$ZodEnumParams
): ZodEnum<util.ToEnum<T[number]>>;
export { _enum as enum };
```

📌 **`const T extends readonly string[]`.** The `const` type parameter is what
preserves the literal strings through the call — without it the argument widens
to `string[]` and `z.infer<typeof OrderStatusSchema>` is `string`. The `as
const` on the array and the `const` on zod's parameter are doing the same job
from the two sides;
[TypeScript 3·12](../../../../typescript/pages/phase-3-generics/12-const-type-parameters/README.md)
is the mechanism.

So one declaration yields three artifacts and `z.infer<typeof
OrderStatusSchema>` is `OrderStatus` by construction, not by coincidence.

🔴 **The fourth artifact lives in the database and no type reaches it.**

```sql
create type order_status as enum
  ('pending', 'paid', 'shipped', 'delivered', 'cancelled');
```

Add a value there and TypeScript is unaffected; add one to `ORDER_STATUSES` and
Postgres rejects the insert with `22P02` at run time, in the checkout path, in
production. The only honest closure is a **test**, not a type:

```ts
// apps/api/test/enum-parity.test.ts
import {ORDER_STATUSES} from '@storefront/shared';
import {pool} from '../src/db/pool.js';

test('the order_status enum matches ORDER_STATUSES exactly', async () => {
  const {rows} = await pool.query<{label: string}>(
    `select e.enumlabel as label
       from pg_enum e join pg_type t on t.oid = e.enumtypid
      where t.typname = 'order_status'
      order by e.enumsortorder`,
  );
  expect(rows.map((r) => r.label)).toEqual([...ORDER_STATUSES]);
});
```

⚠️ **Order matters in that assertion and it is not pedantry.** Postgres orders
enum values by `enumsortorder`, and `ORDER_STATUSES` also encodes the lifecycle
order that
**chapter 04 · Discriminated unions** *(not written yet)* builds its transition
table from. Asserting set equality would pass while the two lists disagree about
what comes after `paid`.

## Adding a status is a migration with a rule attached

The PostgreSQL 17 documentation, verbatim:

> *"If `ALTER TYPE ... ADD VALUE` (the form that adds a new value to an enum
> type) is executed inside a transaction block, the new value cannot be used
> until after the transaction has been committed."*

So a migration that adds `'packed'` and then updates rows to use it **in the
same transaction** fails — and this app's migrations run in transactions by
default ([1·02](../../phase-1-database/02-migrations.md)). The sequence is two
migrations: one that adds the value and commits, one that uses it. The
TypeScript side is one line in `ORDER_STATUSES`, and the parity test is what
makes the two halves land together instead of a fortnight apart.

📌 Worth knowing before you reach for the enum type at all: this app uses a
Postgres enum for `order_status` because the set is small, closed and ordered,
and a check constraint or lookup table would each trade something for
flexibility nobody has asked for. The full comparison is
[PostgreSQL 2·11 — enum, check, lookup](../../../../postgresql/pages/phase-2-types/11-enum-check-lookup.md).

## Gotchas

**★ Without `as const` the whole derivation collapses to `string`.**
`const ORDER_STATUSES = ['pending', …]` widens to `string[]`, so
`typeof ORDER_STATUSES[number]` is `string`, and `z.enum` — despite its `const`
type parameter — is handed an already-widened type it cannot recover. Every
status comparison then accepts every string, silently. The failure is that the
compiler *stops* complaining.

**★ A TypeScript `enum` here would be worse than either.**
`enum OrderStatus { Pending = 'pending', … }` produces a runtime object, is not
assignable from the string literal `'pending'` without the enum member, and
crosses the wire as a string that no longer matches its own type. The union is
the wire format; the enum is a second representation of it.
[TypeScript 1·13](../../../../typescript/pages/phase-1-type-vocabulary/13-enum-vs-union.md)
carries the full argument.

**★ The Postgres enum and the TypeScript union will drift, and only a test
notices.** `ALTER TYPE … ADD VALUE` in a hotfix, or a `ORDER_STATUSES` edit
without a migration — either direction compiles and deploys. The parity test
against `pg_enum` is not optional infrastructure; it is the only thing standing
where a type would be if the database were in TypeScript's reach.

**★ Adding an enum value and using it in one transaction fails.**
Per the PostgreSQL documentation quoted above, the new value cannot be used
until the adding transaction commits. A migration that adds `'packed'` and
backfills rows in the same file fails at the backfill, with an error about the
value being unsafe to use — which reads as though the value does not exist.
Split it into two migrations.

## Interview questions

**★ Why derive `OrderStatus` from an array rather than writing the union?**
Because the array is needed at run time (validation, iteration, seeding
dropdowns) and the union at build time (exhaustive switches), and writing both
means adding a status to one and not the other — which compiles. One `as const`
array, one indexed access, and a `z.enum` gives all three from one edit.

**★ There are four representations of order status. Which one cannot be
type-checked, and what do you do instead?**
The Postgres enum type. TypeScript has no view into the database catalogue, so
the closure is a test that queries `pg_enum` and asserts the labels equal
`ORDER_STATUSES`, in order. It is the same class of check as a migration test:
the type system stops at the driver, so anything beyond it needs a runtime
assertion in CI.

**★ Why must the parity test compare order, not just membership?**
Because the array's order is itself meaningful — the lifecycle sequence the
transition table is built from — and because Postgres orders enum labels by
`enumsortorder`. A set comparison passes while the two disagree about what
follows `paid`, which is exactly the disagreement that matters.

**★ What goes wrong when a migration adds an enum value and uses it in the same
transaction?**
Postgres refuses: per the `ALTER TYPE` documentation, a value added inside a
transaction block cannot be used until that transaction commits. The migration
fails at the statement that uses the value, and the error names the value rather
than the transaction, so it reads like the `ALTER` did not happen. Two
migrations, in order.

---

← Prev: [Wire types, envelopes and the remainder](04b-wire-types-and-envelopes.md) ·
[Overview](README.md) ·
Next → [Composition and branded ids](05b-composition-and-branded-ids.md)
