---
title: "One frozen table becomes the compile-time constraint, the runtime guard and the SQL predicate, and only the third of those survives a concurrent update"
sidebar_label: "02 · The transition table"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the TypeScript handbook on
> [indexed access types](https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html)
> and the
> [`satisfies` release note](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html),
> and the
> [PostgreSQL 17 `UPDATE` reference](https://www.postgresql.org/docs/17/sql-update.html).
> **TypeScript 7.0.2**, PostgreSQL **17**. Concept homes:
> [TypeScript 3·06 — indexed access types](../../../../typescript/pages/phase-3-generics/06-indexed-access-types.md),
> [TypeScript 3·02 — constraints](../../../../typescript/pages/phase-3-generics/02-constraints/README.md),
> [TypeScript 2·10 — `satisfies`](../../../../typescript/pages/phase-2-narrowing/10-satisfies/README.md).
> The status enum is
> [1·01's](../../phase-1-database/01-the-schema/02-carts-orders-reviews-outbox.md).

**An order goes `pending → paid → shipped → delivered`, or `pending → paid →
cancelled`, and nothing else — and there are exactly three places that rule can
be enforced.** The type system stops an invalid call from compiling; a runtime
guard stops one that arrived over HTTP; and a conditional `UPDATE` stops the
one that lost a race with another process. All three read the same table, and
the third is the only one that is actually load-bearing under concurrency —
which is worth internalising before enjoying the first.

## The table

```ts
// packages/shared/src/order-transitions.ts
import type {OrderStatus} from './order.js';

export const TRANSITIONS = {
  pending:   ['paid', 'cancelled'],
  paid:      ['shipped', 'cancelled'],
  shipped:   ['delivered'],
  delivered: [],
  cancelled: [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>;
```

Both halves of `as const satisfies` are doing work, and the failure modes
differ:

- **`as const`** freezes each array into a `readonly` tuple of literals, so
  `typeof TRANSITIONS['paid']` is `readonly ['shipped', 'cancelled']` rather
  than `string[]`. Without it every type derived below collapses to
  `OrderStatus`.
- **`satisfies Record<OrderStatus, readonly OrderStatus[]>`** checks that
  **every** status has an entry and that every entry is a status. Add a sixth
  status to `ORDER_STATUSES` and this line fails to compile with a message
  naming the missing key. That is the phase gate firing inside the shared
  package, before any consumer is touched.

🔴 **Reverse the order and you lose the whole thing.** `satisfies … as const` is
a syntax error; a plain annotation — `const TRANSITIONS: Record<OrderStatus,
readonly OrderStatus[]> = {…}` — compiles and widens every array to
`readonly OrderStatus[]`, so `Next<'shipped'>` becomes "any status". The
annotation checks the shape and destroys the information; `satisfies` checks
the shape and keeps it.

## The type that makes an invalid transition uncallable

```ts
export type Next<S extends OrderStatus> = typeof TRANSITIONS[S][number];

// Next<'pending'>   = 'paid' | 'cancelled'
// Next<'shipped'>   = 'delivered'
// Next<'delivered'> = never        ← indexing an empty tuple
```

```ts
export function transition<From extends OrderStatus, To extends Next<From>>(
  from: From, to: To,
): To {
  return to;
}
```

```ts
transition('pending', 'paid');        // ✅
transition('paid', 'shipped');        // ✅
transition('pending', 'shipped');     // ✗ 'shipped' is not 'paid' | 'cancelled'
transition('delivered', 'cancelled'); // ✗ To extends never — uncallable
```

📌 **`Next<'delivered'>` is `never`, and that is the elegant part.** A terminal
state's row is the empty tuple, indexing it by `number` yields `never`, and a
type parameter constrained by `never` admits no argument at all. The
"delivered orders cannot change" rule is expressed by writing `delivered: []`
and nothing else.

⚠️ **This only helps where the `from` status is statically known.** In the admin
service the current status came out of the database as `OrderStatus` — the whole
union — so `Next<OrderStatus>` distributes to the union of all reachable
statuses, which is nearly everything. **The compile-time check protects code
that knows where it is**, such as the checkout writing `pending → paid`; it does
not protect code handling an arbitrary order. That is what the next two layers
are for.

## The runtime guard, from the same table

```ts
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (TRANSITIONS[from] as readonly OrderStatus[]).includes(to);
}
```

```ts
// apps/api/src/services/orders.ts
export async function setStatus(orderId: number, to: OrderStatus) {
  const current = await orders.statusOf(orderId);
  if (!canTransition(current, to)) {
    throw new ApiError(409, 'INVALID_TRANSITION',
      `cannot move an order from ${current} to ${to}`, {from: current, to});
  }
  // …
}
```

**One table, two artifacts** — the same arrangement as
[the status enum](../02-zod-as-the-source-of-truth/05-the-status-enum-four-ways.md),
for the same reason: a hand-written runtime guard beside a hand-written type is
two declarations that can disagree, and the disagreement compiles.

⚠️ **The `as readonly OrderStatus[]` in `canTransition` is a widening
assertion, not a lie.** `TRANSITIONS[from]` where `from: OrderStatus` is a union
of five tuple types, and `.includes` on that union is awkward to call. Widening
to the common supertype is safe here precisely because `satisfies` already
proved every entry is a `readonly OrderStatus[]`.

## The only layer that survives concurrency

Both layers above read the status, decide, and then write — two statements with
a gap. Two admins clicking "cancel" and "ship" at the same moment both read
`paid`, both pass the guard, and both write. The last one wins and the order is
`shipped` after being `cancelled`, or the reverse.

**The fix is not a lock and not a transaction; it is putting the precondition
into the `UPDATE`:**

```sql
update orders
   set status = $2, updated_at = now()
 where id = $1 and status = $3
returning id, status, total_cents;
```

```ts
export async function setStatus(
  orderId: number, from: OrderStatus, to: OrderStatus,
): Promise<OrderRow> {
  if (!canTransition(from, to)) {
    throw new ApiError(409, 'INVALID_TRANSITION', '…', {from, to});
  }
  const {rows} = await q(pool).query<OrderRow>(
    `update orders set status = $2, updated_at = now()
      where id = $1 and status = $3
     returning id, status, total_cents, created_at`,
    [orderId, to, from],
  );
  const updated = maybeOne(rows);
  if (!updated) {
    // either the order is gone, or someone else moved it first
    throw new ApiError(409, 'STALE_STATUS',
      'the order changed while you were looking at it', {expected: from});
  }
  return updated;
}
```

🔴 **`where … and status = $3` is compare-and-swap, and it is the real
enforcement.** The empty result is the conflict signal — the same shape as the
checkout's `on conflict do nothing … returning`
([1·06](../../phase-1-database/06-the-checkout-transaction/01-the-transaction.md))
and read with the same `maybeOne` helper from
[3·04](../03-typing-raw-pg-results/04-rows-that-lie.md).

Notice what the signature change bought: `setStatus(orderId, from, to)` forces
the caller to state the status it *believes* the order has, so the staleness is
detectable. A `setStatus(orderId, to)` signature cannot express the check, and
no amount of type-level machinery recovers it.

## Where each layer earns its place

| Layer | Catches | Cannot catch |
|---|---|---|
| `To extends Next<From>` | a developer writing an impossible transition in code | anything where `from` is only known at run time |
| `canTransition` | an admin request with a bad transition; a worker replaying a stale message | two valid-looking requests racing |
| `where status = $3` | the race, atomically | a transition that is *legal but wrong* — business logic |

**All three, or the first two are decoration.** Deleting the SQL predicate and
keeping the other two produces a system that is correct in every test and wrong
under load, which is the most expensive category of correct.

## Gotchas

**★ `Record<OrderStatus, …>` as an annotation widens; as a `satisfies` it does
not.** The annotated form compiles, checks completeness, and turns every tuple
into `readonly OrderStatus[]`, so `Next<S>` becomes `OrderStatus` for every `S`
and the compile-time layer silently stops doing anything. There is no error; the
types simply become uninformative.

**★ `Next<OrderStatus>` is nearly the whole union, so a generic helper over "any
order" gets no protection.** Distribution over the union unions all the
successor sets. This is not a flaw to fix — it is the accurate answer to "what
can an order of unknown status become?" — but it does mean the compile-time
layer is worth exactly as much as the caller's static knowledge.

**★ A missing status in `TRANSITIONS` is caught; a *wrong* successor is not.**
`satisfies Record<OrderStatus, readonly OrderStatus[]>` proves every key exists
and every value is a status. It cannot prove `paid → delivered` is absent
because the business says so. The table is the specification; only review and
tests check it against the business.

**★ Terminal states must be `[]`, not omitted.** Leaving `delivered` out of the
table fails the `satisfies` check — good — but the tempting fix of typing the
record `Partial<Record<OrderStatus, …>>` makes `TRANSITIONS[from]` possibly
`undefined` and `Next<S>` degenerate. Write the empty array; it is the
statement "nothing follows this".

**★ `TRANSITIONS[from].includes(to)` needs a widening assertion, and reaching
for `as any` instead re-opens the table.** `as readonly OrderStatus[]` keeps the
element type; `as any[]` or `as string[]` would let `includes('shpped')`
compile. The narrow assertion is the one that stays safe.

**★ Read-modify-write on a status is a race in every codebase that has more
than one writer, and this app has three** — the admin API, the webhook
dispatcher and the checkout transaction. Any `select status … then update …`
pair is wrong; the precondition belongs in the `where` clause.

**★ A `409` for a lost race is not the same error as a `409` for an illegal
transition.** `INVALID_TRANSITION` means "you asked for something impossible";
`STALE_STATUS` means "you asked for something that was possible a moment ago".
The client's response differs — one is a bug report, the other is a refresh —
so [the error contract](../../phase-3-express-api/09-the-error-contract.md) gets
two codes, not one.

**★ The `updated_at = now()` in the same statement is not decoration.** Without
it, a status change leaves `updated_at` stale, and the abandoned-cart and
reporting queries that filter on it silently miss the order. Any conditional
update that changes state changes `updated_at` in the same statement, because a
second statement can fail independently.

## Interview questions

**★ How does `Next<'delivered'>` end up as `never`, and what does that buy?**
`TRANSITIONS['delivered']` is the empty readonly tuple after `as const`, and
indexing an empty tuple type by `number` yields `never`. A type parameter
constrained by `never` cannot be satisfied by any argument, so
`transition('delivered', anything)` fails to compile. The rule "terminal states
do not move" is expressed by writing an empty array.

**★ Why `as const satisfies Record<…>` rather than a type annotation?**
The annotation checks completeness and then widens every tuple to
`readonly OrderStatus[]`, which destroys the successor information the whole
design depends on — with no error to indicate anything was lost. `satisfies`
performs the same completeness check and leaves the inferred literal types
intact.

**★ The compile-time check looks airtight. Why is a runtime guard still
required?**
Because types are erased and most transitions do not have a statically known
starting status: the admin endpoint receives a status string over HTTP and the
current status comes from a database read typed as the whole union. The
compile-time layer protects code that knows where it is; the runtime guard
protects everything else, and reads the same table so the two cannot disagree.

**★ Two admins act on the same order simultaneously and both requests pass the
guard. What stops the corruption?**
Only the SQL: `update … where id = $1 and status = $3`. The read-then-write pair
in application code has a gap that no type and no guard can close, so the
precondition moves into the statement that does the write. Zero rows returned
is the conflict signal, surfaced as a distinct `STALE_STATUS` error.

**★ Why does `setStatus` take `from` as a parameter when it could read it?**
Because reading it inside the function recreates the race it is trying to
prevent. Taking the expected status as an argument makes the caller's belief
explicit and lets it become the `where` clause's predicate — which is the only
place the comparison and the write happen atomically.

**★ What does the transition table *not* verify?**
That the transitions are the right ones. `satisfies` proves every status has an
entry and every entry contains statuses; it cannot know that the business
forbids `paid → delivered`. The table is the specification of the state
machine, so it is exactly as correct as the person who wrote it — which is why
it lives in one file, in the shared package, and changes to it are reviewed as
specification changes.

---

← Prev: [Impossible states](01-impossible-states-and-the-schema.md) ·
[Overview](README.md) ·
Next → [Exhaustiveness in the UI and on the wire](03-exhaustiveness-in-the-ui-and-on-the-wire.md)
