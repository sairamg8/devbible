---
title: "Discriminated unions: the order state machine"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the TypeScript handbook's
> [narrowing and discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html),
> [indexed access types](https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html)
> and the
> [`satisfies` release note](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html);
> the **zod 4.4.3** declarations in this repo (`discriminatedUnion`); and the
> PostgreSQL 17 references for
> [`ALTER TYPE`](https://www.postgresql.org/docs/17/sql-altertype.html) and
> [`UPDATE`](https://www.postgresql.org/docs/17/sql-update.html).
> Target: **TypeScript 7.0.2**, PostgreSQL **17**, zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**Two of this schema's rules are already unions written in SQL, and a third —
the order lifecycle — is a state machine written nowhere.** This chapter carries
all three into the type system, and is careful about which layer actually
enforces what: the compiler stops a developer, a runtime guard stops a request,
and only a conditional `UPDATE` stops a race.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Impossible states](01-impossible-states-and-the-schema.md)** | `check (num_nonnulls(session_id, user_id) = 1)` as a union; the row type that expresses four states where two are legal; `throw new Error('unreachable')` as the tell; 🔴 **do not build the union the schema cannot support** |
| 2 | **[The transition table](02-the-transition-table.md)** | `as const satisfies Record<OrderStatus, …>` — and what a plain annotation destroys; `Next<S>` and why `Next<'delivered'>` is `never`; the runtime guard from the same table; 🔴 **compare-and-swap in the `where` clause is the only layer that survives concurrency** |
| 3 | **[Exhaustiveness and the wire](03-exhaustiveness-in-the-ui-and-on-the-wire.md)** | `assertNever` and why it returns `never`; 🔴 the `default:` clause that silently deletes the phase gate; where exhaustiveness pays in this app; `z.discriminatedUnion` reconstituting a union from JSON; strict vs lenient parsing for a client that predates a status |
| 4 | **[Where it does not pay](04-where-a-union-does-not-pay.md)** | Three shapes that want a nullable field instead; literal union vs discriminated union; the three ways this misfires; the full priced checklist for adding a sixth status |

## The four sentences to keep

1. **A check constraint on the write side and a discriminated union on the read
   side are the same statement**, with one mapper between them.
2. **The union must be derived from columns that exist.** A member with a field
   the schema lacks forces the mapper to invent data.
3. **`as const satisfies` keeps the information a plain annotation destroys** —
   and the annotation gives no warning that it destroyed it.
4. **Types stop developers, guards stop requests, and only the `where` clause
   stops a race.** All three, or the first two are decoration.

## Phase gate

You are done with this topic when you can turn a check constraint into a union
and say where the mapper goes, explain why `Next<'delivered'>` is `never`,
write the conditional `UPDATE` that makes a status change atomic and say what
zero returned rows means, explain what a `default:` clause does to
exhaustiveness, and price a sixth order status end to end.

## Where this connects

Backwards to
[the status enum](../02-zod-as-the-source-of-truth/05-the-status-enum-four-ways.md),
which produces the union this chapter switches on, and to
[the row types](../03-typing-raw-pg-results/README.md), which are the input to
every mapper here. Forwards to
[the typed handlers](../05-typed-express-handlers/README.md), where the
transition guard becomes an endpoint, and to
[the custom hooks](../06-typing-the-custom-hooks/README.md), whose `AsyncState`
is the same pattern applied to loading and error.

---

Phase index: [Phase 6 — TypeScript across the stack](../README.md) ·
← Prev chapter: [Typing raw `pg` results](../03-typing-raw-pg-results/README.md) ·
Next chapter → [Typed Express handlers](../05-typed-express-handlers/README.md)
