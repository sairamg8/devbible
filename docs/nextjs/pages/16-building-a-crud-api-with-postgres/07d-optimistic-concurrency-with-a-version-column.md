---
title: "Optimistic concurrency is one integer, one extra clause in the WHERE, and a check of the affected-row count — and the whole design rests on PostgreSQL re-evaluating that WHERE clause against the row as it exists at write time"
sidebar_label: "07d · Optimistic concurrency"
sidebar_position: 53
description: "The version column, the single UPDATE that both checks and bumps it, why the affected-row count is the signal, how to tell a conflict from a missing row without a second query, the 409 response, and what the client is expected to do with it."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 manual — [13.2.1 Read Committed](https://www.postgresql.org/docs/18/transaction-iso.html) — RFC 9110 §15.5.10 (409 Conflict) — [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html) — and the published `drizzle-orm` **0.45.2** typings for `PgUpdateBase` and `PgDeleteBase` ([unpkg](https://unpkg.com/drizzle-orm@0.45.2/pg-core/query-builders/update.d.ts)). The `pg` result shape is quoted from [node-postgres · `pg.Result`](https://node-postgres.com/apis/result).
> Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `pg` **8.23.0** · **Next.js 16.3.4** · Node **24.20.0**.

**The `version` column in the SprintDesk schema exists for exactly one purpose and this page is it. The client reads a card and gets `version: 7`. It sends the update back with `version: 7` attached. The server writes `… WHERE id = $1 AND version = 7`, and sets `version = version + 1` in the same statement. If someone else wrote in between, the row's version is 8, the predicate does not match, **zero rows are affected**, and the server answers 409 instead of silently overwriting. There is no lock, no retry, no held transaction and no extra round trip: the conflict check and the write are one statement, and the affected-row count is the entire signalling mechanism.**

## Why it works: the manual's own sentence

From [07c](07c-the-lost-update.md), the Read Committed rule for a would-be updater that finds a row another transaction has changed:

> *"If the first updater commits, the second updater will ignore the row if the first updater deleted it, otherwise it will attempt to apply its operation to the updated version of the row. The search condition of the command (the `WHERE` clause) is re-evaluated to see if the updated version of the row still matches the search condition. If so, the second updater proceeds with its operation using the updated version of the row."*
> — [PostgreSQL 18 · 13.2.1](https://www.postgresql.org/docs/18/transaction-iso.html)

🔴 **"The search condition … is re-evaluated" is the whole design.** Postgres already re-checks your `WHERE` clause against the post-update row. A `WHERE id = $1` always passes that re-check, which is why the plain update always wins. Adding `AND version = $2` gives the re-check something that can fail. You are not introducing a new mechanism; you are supplying a predicate to one that was already running.

This also means the guarantee holds *even when the two updates genuinely overlap in time*, not only when they are separated by seconds. The loser waits for the winner's row lock, re-evaluates, fails the version test, and reports zero rows.

## The column

It is already in the schema this chapter shares:

```ts
// db/schema.ts — the relevant column
version: integer('version').notNull().default(1),
```

`integer`, not `bigint`, is a deliberate ceiling of 2,147,483,647 edits to one card. `timestamp` is a tempting alternative and is wrong — two writes inside the same clock tick get the same value, and a clock that steps backwards makes an old version look current. **A monotonic counter the database owns is the only value that cannot lie.**

## The statement

```sql
UPDATE cards
   SET title      = $3,
       body       = $4,
       status     = $5,
       position   = $6,
       version    = version + 1,
       updated_at = now()
 WHERE id = $1
   AND version = $2
   AND deleted_at IS NULL
RETURNING *;
```

Everything that matters is in that statement:

- **`version = version + 1`** is computed by the database from the row it locked, so the bump itself can never be lost.
- **`AND version = $2`** is the check. It is a predicate, not a payload — a version that is only in the `SET` list does nothing at all.
- **`AND deleted_at IS NULL`** keeps soft-deleted rows unwritable ([08](08-delete.md)).
- **`RETURNING *`** gives you the new row *and* the affected-row count in one result, so there is no second query.

## The Data Access Layer function

```ts
// lib/dal/cards.ts
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { cards } from '@/db/schema'

export type UpdateOutcome =
  | { kind: 'updated'; card: typeof cards.$inferSelect }
  | { kind: 'conflict'; current: typeof cards.$inferSelect }
  | { kind: 'gone' }

export async function updateCardVersioned(
  cardId: string,
  expectedVersion: number,
  set: Partial<typeof cards.$inferInsert>,
): Promise<UpdateOutcome> {
  const [row] = await db.update(cards)
    .set({ ...set, version: sql`${cards.version} + 1`, updatedAt: sql`now()` })
    .where(and(
      eq(cards.id, cardId),
      eq(cards.version, expectedVersion),
      isNull(cards.deletedAt),
    ))
    .returning()

  if (row) return { kind: 'updated', card: row }

  // Zero rows. Two possible reasons — ask which, once.
  const [current] = await db.select().from(cards)
    .where(and(eq(cards.id, cardId), isNull(cards.deletedAt)))
    .limit(1)

  return current ? { kind: 'conflict', current } : { kind: 'gone' }
}
```

🔴 **Zero affected rows is ambiguous and you must disambiguate it.** It means either *the card exists and someone else changed it* (409) or *the card does not exist, or is soft-deleted, or you cannot see it* (404). Returning 409 for a card that was deleted sends the client into a retry loop against a row that will never come back; returning 404 for a genuine conflict tells the user their card vanished. The second `SELECT` runs only on the failure path, so it costs nothing in the common case.

⚠️ **The follow-up `SELECT` is itself a fresh read**, so in principle the row could be deleted between the failed update and the select. The outcome then is `gone`, which is the correct answer anyway — this is one of the rare races where both branches lead to the right response.

## How Drizzle reports the affected-row count

Two shapes, and the difference is verified from the 0.45.2 typings rather than remembered:

```ts
// (a) WITHOUT .returning() — the result is the driver's raw query result.
const res = await db.update(cards).set(set).where(pred)
// For node-postgres this is a pg.Result. Its rowCount is documented as
// "The number of rows processed by the last command. Can be null for commands
//  that never affect rows" — node-postgres, pg.Result.

// (b) WITH .returning() — the result is an array of rows.
const rows = await db.update(cards).set(set).where(pred).returning()
// rows.length === 0 means nothing matched.
```

In `drizzle-orm` **0.45.2**, `PgUpdateBase` is declared as
`QueryPromise<TReturning extends undefined ? PgQueryResultKind<TQueryResult, never> : TReturning[]>`
— that conditional type is the whole story. **Prefer (b).** `rows.length` is driver-independent, it is typed, and it hands you the fresh row you need for the response and the new `ETag` without a second query. `rowCount` is typed `int | null` in node-postgres and its exact value under a different driver is not something the Drizzle types promise.

## The Route Handler

```ts
// app/api/cards/[cardId]/route.ts (PATCH, versioned)
import { z } from 'zod'
import { updateCardVersioned } from '@/lib/dal/cards'
import { buildCardSet, CardPatch } from '@/lib/schemas/card'

const Body = CardPatch.extend({ version: z.number().int().positive() })

export async function PATCH(req: Request, ctx: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await ctx.params
  const parsed = Body.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ issues: parsed.error.issues }, { status: 400 })
  }

  const { version, ...patch } = parsed.data
  const set = buildCardSet(patch)
  if (Object.keys(set).length === 0) {
    return Response.json({ error: 'empty patch' }, { status: 400 })
  }

  const outcome = await updateCardVersioned(cardId, version, set)

  switch (outcome.kind) {
    case 'updated':
      return Response.json(outcome.card, { status: 200 })
    case 'gone':
      return new Response(null, { status: 404 })
    case 'conflict':
      return Response.json(
        { code: 'version_conflict', expected: version, current: outcome.current },
        { status: 409 },
      )
  }
}
```

The 409 body carries the **current** representation on purpose. RFC 9110 §15.5.10:

> *"The 409 (Conflict) status code indicates that the request could not be completed due to a conflict with the current state of the target resource. This code is used in situations where the user might be able to resolve the conflict and resubmit the request. The server SHOULD generate content that includes enough information for a user to recognize the source of the conflict."*

A 409 with an empty body forces the client to re-`GET`, and a client that must re-`GET` will usually just re-send blindly, which reintroduces the bug you fixed. Send the current row and the client can diff it. The single response envelope this fits into is **the single error envelope, topic 10** *(not written yet)*.

## What the client is supposed to do with a 409

**Not** retry automatically. That is the one thing that turns a correct 409 into a lost update with extra steps. The three legitimate responses, in the order they apply:

1. **Merge automatically, when the fields are disjoint.** The client sent `{title}` and the conflict is in `body`. Re-apply the same patch against the returned current version and resubmit once. This is safe precisely because the patch is a partial and its own field did not change underneath it.
2. **Show the user both values.** The client sent `{title: 'Login bug'}`, the current title is `'Login defect'`. There is no correct machine answer.
3. **Reload and discard.** Acceptable for low-value fields, brutal for a long text body — do not silently discard something the user typed.

```ts
// client — merge-if-disjoint, escalate otherwise. One retry, never a loop.
async function patchCard(id: string, patch: object, version: number) {
  const res = await fetch(`/api/cards/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...patch, version }),
  })
  if (res.status !== 409) return res

  const { current } = await res.json()
  const contested = Object.keys(patch).filter((k) => current[k] !== undefined)
  const disjoint = contested.every((k) => (patch as never)[k] === current[k])
  if (!disjoint) return res              // a human has to decide

  return fetch(`/api/cards/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...patch, version: current.version }),
  })
}
```

## Gotchas

**★ Symptom: the version column is present, incremented on every write, and updates are still lost.** Cause: `version` is in the `SET` list but not in the `WHERE` clause, so the update matches on `id` alone and the counter is a decoration. Fix: it must be a predicate — `.where(and(eq(cards.id, id), eq(cards.version, expected)))` — and the affected-row count is what you check.

**★ Symptom: the API returns 409 for a card that was deleted, and the client retries forever.** Cause: zero affected rows was mapped straight to 409 without asking why. Fix: on the zero-row path, run one `SELECT` and branch — a visible row means 409, no row means 404, as `updateCardVersioned` above does.

**★ Symptom: a client that hits a 409 immediately re-sends and wins, and the other user's edit is gone anyway.** Cause: the client treats 409 as a transient error and retries with the *fresh* version and the *stale* payload. That is precisely the overwrite the check exists to stop. Fix: never retry a 409 automatically unless the contested fields are provably disjoint; otherwise surface it. A 409 is a decision, not a transient failure.

**★ Symptom: `version` is bumped by a background job, and every user edit now conflicts.** Cause: the counter is shared between human edits and machine writes — a denormalised count, a search-vector refresh, a nightly reindex. Fix: machine writes that do not change anything a user edits must not bump the user-facing version. Either exclude them explicitly, or version the editable subset separately:

```sql
-- a maintenance write that must not invalidate anyone's open editor
UPDATE cards SET search_vector = to_tsvector('english', title || ' ' || coalesce(body,''))
 WHERE id = $1;   -- deliberately does NOT touch version
```

**★ Symptom: the version overflows or wraps after a bulk import.** Cause: `integer` caps at 2,147,483,647 and a script that rewrites every row in a loop can burn through versions faster than humans ever will. Fix: bulk operations bypass the versioned path — one statement for the whole set, not a loop of read-modify-writes. If the counter genuinely needs the headroom, `bigint` costs four bytes per row and is a migration you do once.

**★ Symptom: two requests from the same user, one from a stale browser tab, conflict constantly.** Cause: correct behaviour — the stale tab genuinely holds an old version. Fix: the client should refresh its version when the resource changes under it. If the app already has an SSE stream (ch15 [03d](../15-databases-apis-and-full-stack-patterns/03d-writing-the-sse-route-handler.md)), push the new version on the card-changed event and the open tab stops being stale.

**★ Symptom: `version` appears in the PATCH schema and a client sets it to an arbitrary number to force a write.** Cause: it is being treated as a writable field. Fix: it is an *expectation*, not a value — the server always writes `version + 1` computed in SQL and never accepts a client-supplied new version. Note in the handler above that `version` is destructured out of the body and never reaches `buildCardSet`.

**★ Symptom: a conflict is reported when the client's patch would have changed nothing.** Cause: the version moved because of some other field, and the check is per-row rather than per-field. Fix: this is the accepted cost of a single row version, and the mitigation is to shrink what a write touches rather than to weaken the check. Per-field versioning is possible and is almost never worth the complexity; if two fields genuinely have independent lifecycles, that is a signal they belong in different rows.

**★ Symptom: the version check works through the API and is bypassed by a Server Action.** Cause: the action called `db.update(...)` directly instead of the DAL. Fix: there is one write path; the action calls `updateCardVersioned` like everything else. This is the argument for **the Data Access Layer, topic 04** *(not written yet)* — the guarantee is only as strong as the number of ways around it.

## Interview questions

**★ Why does adding `AND version = $2` to the WHERE clause actually prevent a lost update, given nothing is locked?**
Because PostgreSQL already re-evaluates the `WHERE` clause against the current version of the row at write time — the manual says "the search condition of the command is re-evaluated to see if the updated version of the row still matches". A predicate on `id` alone always passes that re-evaluation, so the second write always lands. A predicate that includes the version fails it when someone else has written, and the statement affects zero rows. The check is atomic with the write because it *is* the write.

**★ Zero rows were affected. What do you return, and how do you know?**
You do not know yet — zero rows means either "the row changed underneath you" or "the row is not there". Those are 409 and 404 and they lead the client to opposite behaviour, so the handler runs one `SELECT` on the failure path and branches. Skipping that branch is the most common way this pattern is shipped broken, because the happy path is fine and the 404 case only shows up as a client stuck retrying a deleted resource.

**★ Why not use `updated_at` as the version token?**
Because a timestamp is not guaranteed to change between two writes. Two updates within the same clock tick produce the same value, and the second client's precondition then passes against a row it never saw. Clock adjustments make it worse: a backward step can make a stale token look current. An integer the database increments is monotonic by construction and needs no assumptions about clocks — which is also the argument against a `Last-Modified`/`If-Unmodified-Since` pair, whose HTTP-date values only have one-second resolution.

**★ Should the client retry automatically on 409?**
Only when it can prove the fields it is writing did not change — that is, when its patch is disjoint from what moved. Blind retry with a refreshed version and a stale payload is exactly the overwrite the version column exists to prevent, dressed up as error handling. In general, 409 means a human has to decide, which is why the response body should carry the current representation so the client can show both values rather than force a reload.

**★ What is the cost of optimistic concurrency, honestly?**
Round trips on contention and complexity in the client. Every write now requires the client to have read recently and to carry a token, every conflict is a user-visible event somebody has to design a UI for, and a hot row edited by many people can conflict often enough to be annoying. The trade is that the failure mode moves from silent data loss to a visible conflict — which is almost always the right trade, but it is a trade, not a free win.

**★ A background job bumps `version` on every row nightly. What breaks?**
Every editor that was open across the job's run gets a 409 on its next save, for a change nobody made to anything they were editing. The version has stopped meaning "the state a user might have based an edit on" and started meaning "the row was touched". Maintenance writes that do not change user-editable state must leave the counter alone, which is a one-line decision in the maintenance query and impossible to retrofit once clients have learned to auto-retry conflicts.

---

← [07c · The lost update](07c-the-lost-update.md) · [Chapter 16 overview](01-explanation.md) · Next → [07e · ETag, If-Match and 412](07e-etag-if-match-and-412.md)
