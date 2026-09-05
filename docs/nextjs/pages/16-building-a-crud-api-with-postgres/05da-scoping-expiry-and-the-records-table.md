---
title: "An idempotency key that is globally unique is an enumerable namespace, one that never expires is a promise you cannot keep, and one stored anywhere but the database it protects can be separated from the row by a single crash"
sidebar_label: "05da · Scoping, expiry, records"
sidebar_position: 35
description: "Why the key must be scoped to a boundary the caller already passed, why the expiry policy is part of the published contract, the records table that the key column cannot replace, and why a cache can front idempotency but never own it."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the IETF Internet-Draft [*The Idempotency-Key HTTP Header Field*](https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.txt) (`draft-ietf-httpapi-idempotency-key-header-07`, October 2025) and RFC 9110 [§15.5.21 422 Unprocessable Content](https://www.rfc-editor.org/rfc/rfc9110#section-15.5.21).
> ⚠️ The idempotency header is an **Internet-Draft, not an RFC**; draft-07 carried an expiry of 18 April 2026 and no later revision was published as of the verification date.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**[05d](05d-idempotency-keys-for-a-retried-post.md) built the mechanism: a key, a unique index, a replay. That mechanism is correct and still insufficient, because three of its properties are decisions rather than code. Where the key's uniqueness is scoped decides whether one tenant can read another's outcomes. How long a key lives decides whether a client's retry budget is safe or produces the duplicate you were preventing. And where the key record is stored decides whether a crash can separate it from the row it protects. All three are things a client must be told, which is why the draft makes publication a MUST rather than a nicety.**

## Scope the key to a boundary the caller has already passed

The index in [05d](05d-idempotency-keys-for-a-retried-post.md) is on `(board_id, idempotency_key)`, not on `idempotency_key` alone, and that is a security decision.

A globally unique key column fails in two directions. **Enumerability:** send a key, observe whether the response is a fresh 201 or a replayed 200, and you have learned whether a request bearing that key already existed somewhere in the system. On a global namespace that is an oracle over every tenant. **Collision:** two unrelated tenants generating UUIDs independently will eventually produce the same value, and on a global index the second one receives the first one's card. That is a data leak arrived at by a birthday argument rather than by a bug in anyone's code.

Scoping the uniqueness to the narrowest thing the caller has already been authorised for closes both, because the comparison can only ever happen inside a boundary the caller passed. For SprintDesk that boundary is the board — `requireBoardAccess(boardId)` has already run before the insert, so a key is only ever matched against keys from a board the caller can reach.

The general form on a records table makes the scope explicit rather than implicit in a compound index:

```sql
CREATE TABLE idempotency_records (
  scope           text        NOT NULL,  -- e.g. 'board:<uuid>:cards.create'
  key             text        NOT NULL,
  fingerprint     text        NOT NULL,  -- digest of the canonicalised body
  status          text        NOT NULL,  -- 'in_flight' | 'completed'
  response_status integer,
  response_body   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);
```

The `scope` string carries both the tenant boundary and the operation, so the same key sent to `cards.create` and to `cards.move` is two independent facts. Without the operation in the scope, a client that reuses a key across two different endpoints — which the draft forbids but clients do anyway — silently gets one endpoint's answer from the other.

## Expiry is part of the contract, not a cleanup job

The draft is explicit that the lifecycle is yours and that publishing it is mandatory:

> *"The resource MAY require time based idempotency keys to be able to purge or delete a key upon its expiry. The resource SHOULD define such expiration policy and publish it in the documentation."*

> *"Resources MUST publish a idempotency related specification. This specification MUST include expiration related policy if applicable."*

> *"A resource is responsible for managing the lifecycle of the idempotency key."*

On the cheap key-column design the key lives on the card row forever, which is fine for storage and wrong for semantics: a client reusing a key a year later receives a replay of a card it has long forgotten. A scheduled statement makes the published policy real:

```sql
-- run on a schedule; 24 hours is a common window and must be documented
UPDATE cards
   SET idempotency_key = NULL
 WHERE idempotency_key IS NOT NULL
   AND created_at < now() - interval '24 hours';
```

```sql
-- the records-table equivalent
DELETE FROM idempotency_records
 WHERE created_at < now() - interval '24 hours';
```

Past the window a repeated key is simply a new request. 🔴 **That is the coupling clients get wrong**, and it is the same trap [ch15 · 04ea](../15-databases-apis-and-full-stack-patterns/04ea-external-effects-and-provider-idempotency.md) documents from the consuming side: a retry budget that outlives the server's key window produces exactly the duplicate the key existed to prevent. Your published window is therefore a constraint on your clients' retry policy, and it belongs in your API documentation next to the header name, not in a runbook.

## The fingerprint, and the rule the key column cannot express

The draft's fourth outcome needs a stored digest of the request:

> *"An idempotency fingerprint MAY be used in conjunction with an idempotency key to determine the uniqueness of a request. Such a fingerprint is generated from request payload data by the resource."*

> *"If there is an attempt to reuse an idempotency key with a different request payload, the resource SHOULD reply with a HTTP 422 status code."*

```ts
// lib/idempotency/fingerprint.ts
import 'server-only'
import { createHash } from 'node:crypto'

/**
 * Canonicalise before hashing, or key order and whitespace change the digest
 * and every retry looks like a payload change.
 */
export function fingerprint(input: Record<string, unknown>): string {
  const canonical = JSON.stringify(
    Object.keys(input)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = input[k]
        return acc
      }, {}),
  )
  return createHash('sha256').update(canonical).digest('hex')
}
```

Hash the **parsed and validated** object, not the raw body bytes. A client that re-serialises its request between attempts — different key order, different whitespace, a `Content-Length` that changed because a number lost a trailing zero — produces different bytes for the same intent, and a byte-level digest would reject every one of those as a payload change. Hashing `parsed.data` compares what the request *means* rather than how it was typed.

⚠️ **The fingerprint is a rejection mechanism, not a merge mechanism.** Two requests with the same key and different payloads are a client bug; the draft's answer is 422 and yours should be too. Do not try to reconcile them.

## Why the key record and the row must commit together

🔴 **A key stored in one system and a row in another can be separated by a single crash, and both separations are worse than having no idempotency at all.**

If the key is recorded first and the process dies before the insert, every subsequent retry sees a claimed key and replays a result that does not exist — the card is permanently uncreatable with that key, and the client has no way to diagnose it. If the row is inserted first and the key is not recorded, the retry creates a duplicate, which is the failure the key existed to prevent.

Both designs in this topic avoid it structurally. The key column is set *in the same `INSERT`*, so there is no gap at all. The records table needs a transaction:

```ts
// lib/dal/cards.ts — the records-table variant
export async function createCardWithRecord(
  boardId: string,
  input: CreateCardInput,
  key: string,
): Promise<CreateResult> {
  await requireBoardAccess(boardId)
  const scope = `board:${boardId}:cards.create`
  const digest = fingerprint(input)

  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .insert(idempotencyRecords)
      .values({ scope, key, fingerprint: digest, status: 'in_flight' })
      .onConflictDoNothing({ target: [idempotencyRecords.scope, idempotencyRecords.key] })
      .returning({ scope: idempotencyRecords.scope })

    if (!claimed) {
      const [prior] = await tx
        .select()
        .from(idempotencyRecords)
        .where(and(eq(idempotencyRecords.scope, scope), eq(idempotencyRecords.key, key)))
        .limit(1)

      if (!prior) return { outcome: 'in_flight' }
      if (prior.fingerprint !== digest) return { outcome: 'payload_mismatch' }
      if (prior.status !== 'completed') return { outcome: 'in_flight' }
      return { outcome: 'replayed', card: prior.responseBody as CardDTO }
    }

    const [card] = await tx.insert(cards)
      .values({ boardId, title: input.title, body: input.body ?? null,
                status: input.status ?? 'todo', position: input.position ?? 0 })
      .returning(CARD_COLUMNS)

    await tx.update(idempotencyRecords)
      .set({ status: 'completed', responseStatus: 201, responseBody: card })
      .where(and(eq(idempotencyRecords.scope, scope), eq(idempotencyRecords.key, key)))

    return { outcome: 'created', card }
  })
}
```

Everything inside `db.transaction` commits or rolls back together, so the claimed key and the card are one fact. ⚠️ Note the consequence: because the claim rolls back with the work, a request that fails *and rolls back* releases its key, so the retry is a genuine first attempt rather than a replay of a failure. If you want the draft's *"success or an error"* replay of failures, the record must be written in a separate committed transaction from the effect — which reintroduces exactly the gap this section warns about, and is a trade you should make deliberately and document.

**A cache is not a substitute.** An in-memory map is per instance, so a retry routed to another instance sees nothing — the same per-instance reasoning as [ch15 · 05h](../15-databases-apis-and-full-stack-patterns/05h-a-shared-cache-across-instances.md). A shared cache with TTL eviction can drop the record while the row persists, producing a duplicate at an arbitrary later time. A cache can front the lookup as an optimisation; the uniqueness has to be enforced by the same system that holds the data.

## When the key column is enough, and when it is not

| Condition | Key column on `cards` | `idempotency_records` |
|---|---|---|
| One operation to protect | ✅ | overkill |
| The operation always produces exactly one addressable row | ✅ | ✅ |
| Several operations sharing a key space | ❌ no scope for the operation | ✅ `scope` column |
| Detecting a reused key with a changed payload | ❌ nowhere to store a fingerprint | ✅ |
| Replaying a **failure**, per the draft's *"success or an error"* | ❌ no row exists to replay | ✅ `response_status` + `response_body` |
| Bulk or multi-row operations | ❌ no single row to hang the key off | ✅ |

The sharpest trigger for the records table is replaying failures. The draft says the resource should *"respond with the result of the previously completed operation, success or an error"* — and an error produced no row, so there is nothing for a key column to live on.

## Gotchas

**★ Symptom: a client changes the payload between retries and gets the first payload's card back.** Cause: no fingerprint, so the key alone decided the request was a duplicate. Fix: store a digest of the canonicalised, validated body with the key and compare it, returning 422 on mismatch as the draft prescribes. On the key-column design this is not expressible at all, which is the main reason to move to `idempotency_records`.

**★ Symptom: the fingerprint check rejects legitimate retries as payload mismatches.** Cause: the digest was taken over the raw request bytes, so a re-serialisation with different key ordering or whitespace produced a different hash for the same intent. Fix: canonicalise first — sort the keys of the *parsed* object and hash that, as `fingerprint()` above does. Compare meaning, not formatting.

**★ Symptom: the idempotency key namespace is global, and one tenant's request replays for another.** Cause: the unique index was on `(idempotency_key)` alone. Fix: scope it to something the caller is already authorised for — `(board_id, idempotency_key)`, or an explicit `scope` column — so a key can only ever match within a boundary the caller has passed. This is a security property, not tidiness: a global key space is an enumeration oracle.

**★ Symptom: a key sent to one endpoint replays a response from a different endpoint.** Cause: the scope carried the tenant but not the operation, so `cards.create` and `cards.move` shared a namespace. Fix: put the operation in the scope — `` `board:${boardId}:cards.create` `` — so the same key against two operations is two independent records. The draft forbids clients from reusing keys this way; the server should still not depend on them obeying.

**★ Symptom: replays keep working long after the key should have expired, then stop working in a way nobody can explain.** Cause: no published expiry policy, so behaviour depended on whether a cleanup job happened to have run. Fix: pick a window, implement it as a scheduled statement, and document it. The draft is explicit that the resource *"SHOULD define such expiration policy and publish it in the documentation"* — an unpublished window is indistinguishable from a bug.

**★ Symptom: duplicates appear only for clients with long retry budgets.** Cause: the client kept retrying past your key window, so a late attempt arrived after the key was purged and was correctly treated as a new request. Fix: publish the window, and state in your documentation that a client's total retry budget must be shorter than it. This is the server-side mirror of the provider-key trap in [ch15 · 04ea](../15-databases-apis-and-full-stack-patterns/04ea-external-effects-and-provider-idempotency.md), and it is the reason the two pages have to agree.

**★ Symptom: the key was recorded in Redis and duplicates still occur after a failover.** Cause: the key record and the row were in different systems, so nothing made them commit or fail together — and a TTL eviction can drop the record while the card persists. Fix: put the uniqueness in the same database as the data, in the same statement or the same transaction as the insert. A cache can front it as an optimisation; it cannot own it.

**★ Symptom: an operation that fails is never replayed — each retry re-attempts it from scratch.** Cause: the record was claimed inside the same transaction as the work, so a rollback released the claim. Fix: this is correct for a transient failure and wrong if you promised the draft's *"success or an error"* replay. Decide which you are offering. Replaying failures requires committing the record separately from the effect, which reopens the crash gap — so if you do it, do it knowingly and document that a replayed failure is a stored response rather than a re-execution.

**★ Symptom: an endpoint documented as idempotent accepts requests with no key and quietly creates duplicates.** Cause: the key was made optional so as not to break existing clients. Fix: decide, then publish. The draft's answer for a required key that is missing is a 400 with a link to your documentation. A middle path — accept the key when present, and document that requests without one are unprotected — is honest; advertising idempotency you do not enforce is not.

**★ Symptom: `idempotency_records` grows without bound and starts dominating table size.** Cause: the cleanup was written and never scheduled, or was scheduled on a host that was decommissioned. Fix: the expiry statement is part of the feature, not an operational extra; put it in the same migration story as the table and monitor row count as a first-class metric. A key table that is never pruned is also an ever-growing index on every write path that touches it.

## Interview questions

**★ Why must the idempotency key and the row it protects be written in the same transaction?**
Because otherwise a crash between the two writes leaves the system in a state worse than having no idempotency at all. If the key is recorded first and the process dies before the insert, every retry sees a claimed key and replays a result that does not exist — the card is permanently missing and that key can never create it. If the insert lands first and the key is not recorded, the retry creates a duplicate, which is the failure you were preventing. One statement, or one transaction, makes them a single atomic fact: either the key exists and the card exists, or neither does. This is the same argument the SprintDesk milestone makes for enqueueing a job inside the transaction that causes it, and it is why a Redis-backed key store is unsound however fast it is — an external system cannot join your `COMMIT`.

**★ Why should the key be scoped rather than globally unique?**
Two reasons, one correctness and one security. Correctness: a globally unique key column means a UUID collision between two unrelated tenants returns one tenant's card to the other — a data leak produced by a birthday-problem argument rather than by any bug in your code. Security: a global key namespace is an oracle. Send a key, observe whether you get a replay or a fresh create, and you have learned whether a request bearing that key exists somewhere in the system. Scoping the index to `(board_id, idempotency_key)` means a key is only ever compared within a boundary the caller has already been authorised for, so both problems disappear — and the index is smaller.

**★ You have an idempotency implementation but no documentation of it. What is actually broken?**
Everything the feature was for. A client cannot send a header it does not know exists, so the default path is still an unprotected POST. A client that does send one cannot know the key format you accept, so it may send something you reject or silently truncate. And it cannot know the expiry window, so it cannot size its retry budget — a retry sent after your key has been purged creates a duplicate, which is precisely the failure the mechanism exists to prevent. The draft states the obligation directly: *"Resources MUST publish a idempotency related specification. This specification MUST include expiration related policy if applicable."* An idempotency implementation is half server behaviour and half published contract, and only the first half is code.

**★ When is a key column on the resource table enough, and when do you need a records table?**
The column is enough when there is exactly one operation to protect, that operation always produces one addressable row, and you never need to replay a failure. Create-a-card qualifies: the key lives on the card, the partial unique index enforces it, and a replay is a read of that row. You need the records table as soon as any of the three stops holding — when several operations share a key space and need an explicit scope, when the operation does not produce a single addressable row (a bulk import, a state transition), or when the draft's 422 payload-mismatch rule matters, because comparing fingerprints requires storing a fingerprint and the resource table has nowhere to put one. Replaying failures is the sharpest trigger: an error produced no row, so a key column has nothing to hang off.

**★ Why hash the parsed object rather than the raw request body?**
Because the raw bytes encode formatting decisions that the client is entitled to change between attempts, and none of them mean the request changed. A retry serialised by a different code path can reorder object keys, alter whitespace, or render a number differently, and a byte-level digest treats every one of those as a payload mismatch — so you would return 422 to clients doing exactly the right thing. Hashing the canonicalised, validated object compares intent: the same four field values in any order produce the same digest, and only an actual change to a value produces a different one. The cost is that fields your schema strips are invisible to the fingerprint, which is another argument for `strictObject` on the boundary schema, since with strict parsing there are no stripped fields to be invisible.

**★ Your key window is 24 hours and a client retries for 48. Whose bug is it, and how do you prevent it?**
It is a contract failure, and the server usually owns the prevention even when the client owns the mistake. Past the window a repeated key is a new request by design, so the second day's retry legitimately creates a duplicate — the server did nothing wrong and the client did nothing obviously wrong either. The prevention is publication: the window has to be in the API documentation next to the header name, stated as a constraint on the client's retry budget, because the client cannot infer it and cannot discover it safely by experiment. This is the same coupling the consuming side hits with a payment provider's key expiry, so if your service both offers and consumes idempotency you need the two windows written down together — one bounds your clients, the other bounds you.

---

← [05d · Idempotency keys](05d-idempotency-keys-for-a-retried-post.md) · Next → [05e · Identifier choice](05e-client-supplied-ids-and-identifier-choice.md)
