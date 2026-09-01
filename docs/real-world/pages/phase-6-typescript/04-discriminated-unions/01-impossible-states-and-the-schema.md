---
title: "The database already encodes two unions as check constraints, and modelling them as unions in TypeScript is how the constraint stops being re-checked in every function"
sidebar_label: "01 · Impossible states"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the TypeScript handbook's
> [discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
> and the
> [PostgreSQL 17 `num_nonnulls` / constraint documentation](https://www.postgresql.org/docs/17/functions-comparison.html).
> **TypeScript 7.0.2**, PostgreSQL **17**, zod **4.4.3**. Concept homes:
> [TypeScript 2·05 — discriminated unions](../../../../typescript/pages/phase-2-narrowing/05-discriminated-unions.md),
> [TypeScript 2·06 — exhaustiveness](../../../../typescript/pages/phase-2-narrowing/06-exhaustiveness.md),
> [TypeScript 1·05 — union types](../../../../typescript/pages/phase-1-type-vocabulary/05-union-types.md).
> The constraints being modelled are
> [1·01's](../../phase-1-database/01-the-schema/02-carts-orders-reviews-outbox.md).

**Two of this schema's most important rules are already unions — they are just
written in SQL.** `check (num_nonnulls(session_id, user_id) = 1)` says a cart is
a guest cart *or* an account cart, never both and never neither. The naive row
type says both columns are `bigint | null`, which makes four states
representable where the database permits two, and every function that touches a
cart re-derives which one it has. Modelling it as a discriminated union moves
that derivation to one place — the row-to-domain boundary — and lets the
compiler carry the answer everywhere else.

## The constraint, and the type that ignores it

```sql
create table carts (
  id         bigint generated always as identity primary key,
  session_id bigint references sessions (id) on delete cascade,
  user_id    bigint references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(session_id, user_id) = 1)
);
```

The row type that copies the DDL:

```ts
export type CartRow = {
  id: number;
  session_id: number | null;
  user_id: number | null;
  created_at: Date;
  updated_at: Date;
};
```

That type is *correct* — it is exactly what the driver returns — and it is
useless as a domain type. Four combinations are expressible; the database
permits two. So every consumer writes a version of this:

```ts
function ownerOf(cart: CartRow) {
  if (cart.user_id != null) return {kind: 'user', id: cart.user_id};
  if (cart.session_id != null) return {kind: 'session', id: cart.session_id};
  throw new Error('unreachable');       // ← the constraint, re-stated, again
}
```

🔴 **The `throw new Error('unreachable')` is the tell.** It appears wherever a
database invariant has not been carried into the type system, and it appears
*once per consumer*. The fix is not to write it better; it is to write it once.

## The union, and the one function that produces it

```ts
// packages/shared/src/cart.ts
export type CartOwner =
  | {readonly kind: 'guest'; readonly sessionId: number}
  | {readonly kind: 'account'; readonly userId: number};

export type Cart = {
  readonly id: number;
  readonly owner: CartOwner;
  readonly updatedAt: Date;
};
```

```ts
// db/carts.ts — the boundary, and the ONLY place the constraint is re-checked
export function toCart(row: CartRow): Cart {
  const owner: CartOwner =
    row.user_id != null    ? {kind: 'account', userId: row.user_id}
    : row.session_id != null ? {kind: 'guest', sessionId: row.session_id}
    : (() => { throw new Error(`cart ${row.id} violates its owner constraint`); })();

  return {id: row.id, owner, updatedAt: row.updated_at};
}
```

Now the merge-on-login logic from
[3·06](../../phase-3-express-api/06-cart-endpoints.md) reads without a single
null check:

```ts
switch (cart.owner.kind) {
  case 'guest':   return mergeGuestCart(cart.owner.sessionId, userId);
  case 'account': return cart;                    // already theirs
}
```

**`cart.owner.sessionId` exists in the `guest` branch and nowhere else.** Not
"is non-null in the guest branch" — *exists*. Writing `cart.owner.userId` there
is a compile error naming the property, which is a far better message than a
`null` five frames later.

📌 **`readonly` on every member is deliberate.** A union member whose fields can
be reassigned can be walked out of its own branch: `if (o.kind === 'guest') {
o.kind = 'account'; }` compiles against a mutable union and leaves an object
with `kind: 'account'` and no `userId`. `readonly` makes the narrowing durable.

## Why the discriminant is a literal field and not a boolean

The alternative shapes, and what each costs:

| Shape | Problem |
|---|---|
| `{isGuest: boolean; sessionId?: number; userId?: number}` | Narrowing on a boolean works, but the payload stays optional in both branches — the four-state problem, restored |
| `{sessionId: number \| null; userId: number \| null}` | The original row type. No narrowing at all |
| `{kind: 'guest' \| 'account'; id: number}` | One shape, not a union. Loses which id it is — the whole point |
| ✅ `{kind: 'guest'; sessionId} \| {kind: 'account'; userId}` | Each branch carries exactly its own data |

The rule underneath: **the discriminant must be a property whose type is a
literal in each member**, because that is what TypeScript's narrowing looks
for. `kind: string` in both members narrows nothing.

## The orders table is a partial version of the same story

`orders.status` is an enum column, so a status union comes free —
[chapter 2·05](../02-zod-as-the-source-of-truth/05-the-status-enum-four-ways.md)
derives it from `ORDER_STATUSES`. What the schema does **not** have today is
per-status data:

```sql
create table orders (
  id              bigint generated always as identity primary key,
  user_id         bigint not null references users (id) on delete restrict,
  status          order_status not null default 'pending',
  address         jsonb not null,
  total_cents     bigint not null check (total_cents >= 0),
  idempotency_key text not null unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

There is no `shipped_at`, no `tracking_number`, no `cancellation_reason`. So
**today the honest model is a plain literal union, not a discriminated union of
objects**:

```ts
export type Order = {
  readonly id: number;
  readonly status: OrderStatus;      // the five-member literal union
  readonly totalCents: number;
  readonly createdAt: Date;
};
```

⚠️ **Do not build the union you wish the schema had.** A
`{status: 'shipped'; shippedAt: Date}` member requires a `shipped_at` column;
inventing one in the type produces a mapper that fabricates a date, and a
fabricated value is worse than a missing one. This is the single most common
way discriminated unions go wrong in application code: the union is designed
from the UI's wishes rather than from the data that exists.

**When the column does arrive**, this is exactly where it lands:

```sql
alter table orders add column shipped_at timestamptz;
alter table orders add constraint orders_shipped_at_matches_status
  check ((status in ('shipped', 'delivered')) = (shipped_at is not null));
```

```ts
export type Order =
  | {readonly status: 'pending' | 'paid' | 'cancelled'; readonly id: number; …}
  | {readonly status: 'shipped' | 'delivered'; readonly shippedAt: Date; readonly id: number; …};
```

The check constraint and the union say the same thing in two languages, and
`toOrder` is the one function that translates. That symmetry — **a check
constraint on the write side, a discriminated union on the read side, one
mapper between them** — is the pattern this chapter is really about; the cart is
simply the instance the schema already has.

## Gotchas

**★ A row type is not a domain type, and a union makes the difference
unavoidable.** `CartRow` has two nullable columns; `Cart` has an owner. Trying
to make one type serve both means the union's narrowing is unavailable at the
data layer or the nullable columns leak into the domain. Two types and one
mapper, as
[chapter 1's row-vs-resource rule](../01-the-shared-types-package/01-why-a-package.md)
already required.

**★ `throw new Error('unreachable')` is a database constraint that never made
it into the type system.** Every occurrence marks a place where an invariant is
being re-derived. It is fine *once*, in the mapper, where it is a genuine
integrity check on data that should be impossible; it is a smell everywhere
else.

**★ A union member without `readonly` can be narrowed and then invalidated.**
`if (o.kind === 'guest') { o.kind = 'account'; }` type-checks on a mutable
union and produces an object matching neither member. The compiler does not
re-check the narrowing after the assignment. `readonly` on the discriminant is
the minimum; `readonly` on every field is the habit.

**★ Optional properties are not a discriminated union.**
`{kind: 'guest' | 'account'; sessionId?: number; userId?: number}` narrows the
`kind` and leaves both payloads optional, so every branch still starts with a
null check. The payload has to live *inside* the member for narrowing to reach
it.

**★ A `boolean` discriminant narrows but does not scale.** `isGuest: boolean`
works for two states and forces a rewrite at three. `kind: 'guest' | 'account'`
costs the same today and extends by adding a member. Prefer a literal
discriminant even when there are exactly two cases.

**★ Building the union from the UI's needs rather than the schema's columns
produces a mapper that invents data.** `shippedAt: row.updated_at` in a
`shipped` member is the shape of that mistake: it type-checks, it renders, and
it is wrong for every order whose row was touched after shipping. If the column
does not exist, the union member cannot.

**★ Widening the discriminant anywhere destroys narrowing everywhere.**
`const kind = cart.owner.kind as string` or a helper typed `(kind: string) =>
…` turns the literal back into `string`, and every downstream `switch` silently
stops being exhaustive. Keep the discriminant's type narrow across every
function boundary it crosses.

**★ `JSON.parse` of a stored union is `any`, and the narrowing is fiction.**
The cart's owner is not stored as JSON here, but the `address` column is. A
union read out of `jsonb` has to be parsed — `z.discriminatedUnion('kind', […])`
— before any `switch` on it means anything.
[Chunk 03](03-exhaustiveness-in-the-ui-and-on-the-wire.md) is that boundary in
full.

## Interview questions

**★ What is a discriminated union for, in one sentence?**
Making states that the domain forbids unrepresentable in the type, so the check
happens once at the boundary instead of once per consumer.

**★ The `carts` table has two nullable columns and a check constraint. Why is
the row type wrong as a domain type?**
Because it expresses four states — both null, both set, and the two legal ones
— where the database permits two. Every consumer must therefore re-derive which
of the two it holds, and the derivation ends in a `throw new Error(
'unreachable')` that is really the check constraint, restated in TypeScript,
several times.

**★ Where exactly does the union get produced, and why there?**
In the mapper from `CartRow` to `Cart`, at the data layer's edge. It is the one
place that has the raw nullable columns and the one place where a violation is
a genuine integrity error worth throwing on. Everywhere upstream of it works
with a type in which the illegal states do not exist.

**★ Why must the discriminant be a literal type rather than a `string`?**
Because narrowing works by comparing a property's *literal* type against a
value; if the property is typed `string` in every member, the comparison
eliminates nothing and every branch keeps the full union. `as const`, or a
literal-typed field in each member, is what makes the switch meaningful.

**★ Why is `readonly` on union members more than tidiness?**
Because narrowing is not re-validated after a mutation. Assigning to the
discriminant inside a narrowed branch produces an object that matches no member
and a variable the compiler still believes is narrowed. Marking the fields
readonly makes the narrowing durable rather than momentary.

**★ Someone models `Order` as a union with a `shippedAt` on the shipped
member, and the schema has no such column. What happens?**
The mapper must produce a value, so it borrows one — usually `updated_at` — and
the type system endorses it. The UI then displays a shipping date that is
actually the last time anything about the order changed. The union has to be
derived from columns that exist; if the UI needs the date, the change is a
migration and a check constraint first, and a union member second.

---

← [Overview](README.md) ·
Next → [The transition table](02-the-transition-table.md)
