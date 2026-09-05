---
title: "One query inside a transaction callback written against db instead of tx runs on a different connection, commits on its own, and survives the rollback — and because both objects have the same methods and the same types, nothing in the language, the linter or the test suite will tell you"
sidebar_label: "09b · The tx rule"
sidebar_position: 63
description: "Why db and tx are different connections, the four shapes the bug takes, why TypeScript cannot catch it as written, and three mechanisms that make it structurally impossible — a Tx-only DAL signature, a proxy that throws, and an ESLint rule."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the published `drizzle-orm` **0.45.2** typings — `PgTransaction extends PgDatabase`, `PgSession.transaction<T>(transaction: (tx: PgTransaction<…>) => Promise<T>, config?: PgTransactionConfig)` ([unpkg](https://unpkg.com/drizzle-orm@0.45.2/pg-core/session.d.ts)) — and the [node-postgres pooling documentation](https://node-postgres.com/features/pooling).
> Documentation-verified; **no sandbox run, no timings**.
> Target: `drizzle-orm` **0.45.2** · `pg` **8.23.0** · **PostgreSQL 18.4** · **Next.js 16.3.4** · Node **24.20.0**.

**`db.transaction(async (tx) => { … })` checks out one client from the pool, issues `BEGIN` on it, and gives you `tx` bound to that client. `db` is still in scope inside the callback, and it is still bound to the *pool* — so a query written against `db` checks out a **second** client, runs outside your transaction, and commits by itself. If the transaction then rolls back, that write stays. There is no error, no warning and no type mismatch, because `PgTransaction` extends `PgDatabase`: `tx` and `db` have the same methods with the same signatures, and every call site type-checks either way. This is the most common correctness bug in Drizzle codebases, it is a one-character difference, and this page is about making it impossible rather than about remembering not to do it.**

## What the two objects actually are

From the 0.45.2 typings:

```ts
export declare abstract class PgTransaction<…> extends PgDatabase<…> { … }
export declare abstract class PgSession<…> {
  abstract transaction<T>(
    transaction: (tx: PgTransaction<TQueryResult, TFullSchema, TSchema>) => Promise<T>,
    config?: PgTransactionConfig,
  ): Promise<T>
}
```

`PgTransaction extends PgDatabase`. That inheritance is what makes `tx` usable everywhere `db` is — and it is exactly what makes the mistake invisible, because the substitution is legal in the direction you do not want as well.

Underneath, with `pg`:

- `db` wraps a `Pool`. Each query calls `pool.query`, which checks out a client, runs the statement in its own implicit transaction, and returns the client.
- `tx` wraps **one checked-out client**, on which `BEGIN` has already run. Every `tx` query goes to that client; `COMMIT` or `ROLLBACK` ends it and the client goes back.

**Two objects, two connections, two independent transactions.**

## The interleaving

```text
time   your callback                         connection A (tx)      connection B (pool)
──────────────────────────────────────────────────────────────────────────────────────
t1     db.transaction(…) starts              BEGIN
t2     await tx.update(cards)…               UPDATE cards           —
t3     await db.insert(boardEvents)…         —                      INSERT board_events
t4                                           —                      COMMIT  ← independent
t5     throw new Error('validation')
t6     transaction aborts                    ROLLBACK
──────────────────────────────────────────────────────────────────────────────────────
final: the card was NOT moved. The event saying it moved is committed and permanent.
```

Every consumer of `board_events` now believes a move happened that did not. On the SprintDesk stack that means the SSE stream (ch15 [03fa](../15-databases-apis-and-full-stack-patterns/03fa-designing-a-resumable-sse-stream.md)) replays a phantom move to every open board, and a client that resumed from `Last-Event-ID` has no way to discover it was wrong.

## The four shapes it takes

**1 · The direct slip.** One line among ten, usually added later:

```ts
await db.transaction(async (tx) => {
  await tx.update(cards).set(patch).where(eq(cards.id, cardId))
  await db.insert(boardEvents).values({ boardId, kind: 'card.moved', cardId })  // 🔴 db
})
```

**2 · The helper that closes over `db`.** The worst one, because the call site looks correct:

```ts
// lib/dal/events.ts
export async function recordEvent(boardId: string, kind: string, cardId: string) {
  await db.insert(boardEvents).values({ boardId, kind, cardId })   // 🔴 captured db
}

// the call site is clean and completely wrong
await db.transaction(async (tx) => {
  await tx.update(cards).set(patch).where(eq(cards.id, cardId))
  await recordEvent(boardId, 'card.moved', cardId)                 // 🔴 outside the tx
})
```

**3 · The shadowed name.** A nested transaction whose parameter is also called `tx`, so an inner statement silently targets the wrong one — legal, and no linter default complains:

```ts
await db.transaction(async (tx) => {
  await tx.transaction(async (tx) => {          // 🔴 shadows the outer tx
    await tx.insert(comments).values(c)         // which one is this?
  })
})
```

**4 · The floating promise.** Not a `db`/`tx` confusion, but the same class of silent partial write — an un-awaited query may still be in flight when `COMMIT` runs, or may be issued after it:

```ts
await db.transaction(async (tx) => {
  tx.insert(boardEvents).values(e)              // 🔴 no await
  await tx.update(cards).set(patch).where(eq(cards.id, cardId))
})
```

## Why TypeScript does not catch it as written

Because `db` genuinely satisfies every type the call site asks for. `PgTransaction` is a subtype of `PgDatabase`, so a parameter typed `PgDatabase` accepts both, and a bare `db.insert(...)` inside a closure is just a call to a variable in an enclosing scope — which is normal, correct TypeScript everywhere else in the language.

**Which means the fix is not "be careful". It is to change the types, the runtime object, or the lint rules so the mistake stops being expressible.** Three mechanisms, in increasing order of strength.

## Fix 1 — every DAL function takes a `Tx` and never reaches for `db`

```ts
// lib/db/tx.ts
import { db } from '@/db'
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
```

```ts
// lib/dal/events.ts — the helper cannot use the wrong connection because it has none
import type { Tx } from '@/lib/db/tx'
import { boardEvents } from '@/db/schema'

export async function recordEvent(tx: Tx, boardId: string, kind: string, cardId: string) {
  await tx.insert(boardEvents).values({ boardId, kind, cardId })
}
```

```ts
// lib/dal/cards.ts
export async function moveCard(cardId: string, toBoardId: string, expectedVersion: number) {
  return db.transaction(async (tx) => {
    const [moved] = await tx.update(cards)
      .set({ boardId: toBoardId, version: sql`${cards.version} + 1` })
      .where(and(eq(cards.id, cardId), eq(cards.version, expectedVersion)))
      .returning()
    if (!moved) return null

    await recordEvent(tx, toBoardId, 'card.moved', cardId)   // ✅ must be passed one
    return moved
  })
}
```

🔴 **Typing the parameter as `Tx` and not as `PgDatabase` is the whole point.** `Tx` is `PgTransaction`, and a plain `db` is not assignable to it — so `recordEvent(db, …)` is a compile error. If you widen the parameter to "either", you have given the guarantee away.

This is the cheapest fix and it covers the two shapes that actually happen in review — the direct slip becomes a lint-visible oddity, and the captured-`db` helper becomes a compile error.

## Fix 2 — make `db` unusable while a transaction is open

Fix 1 relies on every helper being written that way. This one catches the ones that were not, at runtime, on the first request that hits them. Node's `AsyncLocalStorage` follows the async call chain, so a helper five frames deep can be told it is inside a transaction:

```ts
// lib/db/guard.ts
import { AsyncLocalStorage } from 'node:async_hooks'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'

const inTransaction = new AsyncLocalStorage<true>()
const real = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema })

const GUARDED = new Set(['select', 'insert', 'update', 'delete', 'execute', 'query'])

/** Behaves exactly like `db`, except it refuses to run a query inside a transaction. */
export const db = new Proxy(real, {
  get(target, prop, receiver) {
    if (inTransaction.getStore() && typeof prop === 'string' && GUARDED.has(prop)) {
      throw new Error(
        `db.${prop}() was called inside a transaction. Use the tx handle instead — ` +
        `this query would run on a different connection and survive a rollback.`,
      )
    }
    if (prop === 'transaction') {
      return (fn: (tx: unknown) => Promise<unknown>, config?: unknown) =>
        (target as never as typeof real).transaction(
          (tx) => inTransaction.run(true, () => fn(tx)), config as never)
    }
    return Reflect.get(target, prop, receiver)
  },
}) as typeof real
```

**What this buys:** the captured-`db` helper throws a message that names the bug, on the first request, in development, instead of committing a phantom row in production. **What it costs:** a `Proxy` on every property access of `db`, and one place in the codebase that is genuinely clever and therefore needs a comment. ⚠️ It also assumes `db` is the only handle — a second `drizzle(...)` instance anywhere routes around it.

## Fix 3 — a lint rule, so it never reaches review

`no-restricted-syntax` can forbid the identifier `db` anywhere inside a `transaction` callback:

```js
// eslint.config.js
export default [{
  files: ['lib/dal/**/*.ts'],
  rules: {
    'no-restricted-syntax': ['error', {
      selector:
        "CallExpression[callee.property.name='transaction'] " +
        "ArrowFunctionExpression MemberExpression[object.name='db']",
      message:
        'Use the tx handle inside a transaction callback. A db query runs on another ' +
        'connection, commits independently, and survives the rollback.',
    }],
  },
}]
```

Plus the two rules that catch shape 4, which are worth having regardless:

```js
'@typescript-eslint/no-floating-promises': 'error',
'no-shadow': 'error',              // catches the shadowed `tx` in a nested transaction
```

⚠️ **The AST selector above only catches the *lexical* case** — `db` written literally inside the callback. It cannot see the helper in shape 2, which is why Fix 1 is the one that matters and this is a cheap second net.

**Use all three if the codebase has more than a couple of people in it.** They fail in different places: the type at compile time, the proxy at first execution, the lint rule at review.

## Gotchas

**★ Symptom: a rollback left half the work committed.** Cause: a query inside the callback used `db`, so it ran on a second pooled connection in its own implicit transaction and committed independently. Fix: pass `tx` into every helper and type the parameter as `Tx`, so `db` is not assignable — Fix 1 above.

**★ Symptom: a helper looks correct at the call site and still writes outside the transaction.** Cause: the helper imports `db` at module scope and closes over it; nothing at the call site reveals that. Fix: helpers take `tx` as their first parameter. If a helper genuinely must work both inside and outside a transaction, give it two exports — `recordEventIn(tx, …)` and `recordEvent(…)` that opens one — rather than one function with a widened type.

**★ Symptom: `board_events` contains an event for a change that never happened.** Cause: exactly the interleaving diagrammed above, and it is worse than a lost write because consumers act on it. On this stack an SSE client replays a phantom move and cannot discover it was wrong. Fix: the event insert uses `tx`, always. This is why the milestone in ch15 [06](../15-databases-apis-and-full-stack-patterns/06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md) puts the event row inside the transaction.

**★ Symptom: a nested transaction's inner writes went to the outer transaction.** Cause: the inner callback's parameter shadows the outer `tx`, or the developer reused the outer handle inside. Fix: `no-shadow`, and name inner handles distinctly (`tx`, `txInner`) so a review can see which is which.

**★ Symptom: a write inside a transaction sometimes lands and sometimes does not, with no pattern.** Cause: a floating promise — the query was issued without `await`, so whether it reached the server before `COMMIT` is a race. Fix: `@typescript-eslint/no-floating-promises` as an error, not a warning.

**★ Symptom: the app deadlocks against itself under load, and the stack shows one request waiting on a row it already locked.** Cause: the callback took a row lock on `tx` and then queried the same row through `db` — a *second* connection waiting for a transaction that cannot proceed until the query returns. Fix: same rule. This is the one variant that fails loudly, and it is the lucky case: it surfaces in development instead of corrupting data in production.

**★ Symptom: the pool exhausts during a burst, with far fewer concurrent requests than `max`.** Cause: each transaction holds one client and every stray `db` call inside it checks out a second, so the effective concurrency per request is two connections rather than one. Fix: the rule again — and note that the resource arithmetic in ch15 [01b](../15-databases-apis-and-full-stack-patterns/01b-the-three-kinds-of-pool.md) assumes one connection per in-flight request.

**★ Symptom: the guard proxy does not fire for one module.** Cause: that module constructed its own `drizzle(...)` instance rather than importing the shared one. Fix: one exported `db` in the codebase, and a lint rule forbidding `drizzle(` outside `lib/db/`. A guard that can be routed around is a guard that will be.

**★ Symptom: a Server Action and a Route Handler behave differently for the same operation.** Cause: one of them opens its own transaction around a DAL function that already opens one, so the inner call becomes a savepoint with different failure semantics. Fix: the boundary lives in the DAL operation and nowhere else — [09](09-transactions-and-multi-table-writes.md) argues where, and the `…In(tx, …)` split is how two operations compose.

## Interview questions

**★ What actually happens if you call `db.insert(...)` inside a `db.transaction` callback?**
It checks out a *second* client from the pool and runs the insert in its own implicit transaction on that connection. It has no relationship to the transaction you are inside: it commits immediately, it does not see your uncommitted rows, and it is not rolled back if your transaction aborts. So a rollback leaves it behind, permanently, with no error anywhere.

**★ Why does TypeScript not catch it?**
Because `PgTransaction` extends `PgDatabase`, so `tx` and `db` expose the same methods with the same signatures and every call site type-checks with either. The mistake is not a type error; it is a scope choice — reaching for a variable from an enclosing module rather than the parameter you were given — and that is ordinary, correct TypeScript everywhere else. The only way to make the type system help is to type helper parameters as `Tx` specifically, so `db` is not assignable to them.

**★ Which shape of this bug is hardest to see in review?**
The helper that closes over `db` at module scope. The call site inside the transaction reads perfectly — `await recordEvent(boardId, 'card.moved', cardId)` — and the defect is in a different file, in an import. That is why the structural fix is to make every DAL helper take a `Tx` as its first parameter: it turns a bug you have to notice into a bug that does not compile.

**★ How would you make this impossible rather than merely discouraged?**
Three layers, because they fail at different times. Type every helper's connection parameter as `Tx`, so passing `db` is a compile error. Wrap the exported `db` in a proxy that consults an `AsyncLocalStorage` flag set for the duration of a transaction callback and throws with a message naming the bug — that catches helpers written before the convention, on the first request that runs them. And add a `no-restricted-syntax` rule for a literal `db` inside a transaction callback, plus `no-floating-promises` and `no-shadow`, so most of it never reaches review.

**★ What is the worst consequence of this bug in an event-sourced or streaming system?**
A committed event describing a change that was rolled back. Consumers are entitled to treat the event as fact, and they have no channel through which to learn it was not — a client that resumed the SSE stream from `Last-Event-ID` has processed a phantom move and there is no compensating event coming. That is strictly worse than a lost write, because a lost write is detected the next time someone reads the row, while a phantom event propagates outward and is never revisited.

**★ There is a variant of this bug that fails loudly. Which, and why is that good news?**
Taking a row lock on `tx` and then querying that row through `db`. The second connection waits for a lock held by a transaction that cannot proceed until the second query returns, so the request deadlocks against itself and PostgreSQL eventually aborts one side. It is the same mistake, but it surfaces immediately in development instead of quietly committing a row in production — which is the argument for the guard proxy, whose entire purpose is to convert the silent variants into loud ones.

---

← [09 · Transactions — what needs one](09-transactions-and-multi-table-writes.md) · [Chapter 16 overview](01-explanation.md) · Next → [09c · Isolation levels in PostgreSQL 18](09c-isolation-levels-in-postgresql-18.md)
