---
title: "Who mints the identifier is a protocol decision disguised as a column default — a server-minted id means the client cannot address the resource until the round trip returns, and a client-minted one makes creates idempotent for free while turning your primary key into untrusted input"
sidebar_label: "05e · Identifier choice"
sidebar_position: 36
description: "gen_random_uuid() and what defaultRandom() actually emits, uuidv4 versus uuidv7 in PostgreSQL 18, the three things a client-supplied id buys and the three it costs, and why a client id is never a trust boundary."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the [PostgreSQL 18 UUID functions reference](https://www.postgresql.org/docs/18/functions-uuid.html) and RFC 9110 [§9.3.3 POST](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.3), [§9.3.4 PUT](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.4).
> `defaultRandom()`'s emitted SQL **read from the published `drizzle-orm` 0.45.2 build** (`pg-core/columns/uuid.js`).
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**RFC 9110 describes POST as creating *"a new resource that has yet to be identified by the origin server"* — the identifier does not exist until the server makes it. That single sentence is why a create response needs `Location`, why `RETURNING` is not optional, and why a client cannot render an optimistic row with a real key. Letting the client mint the id inverts all three, and it is a legitimate design with real costs rather than a shortcut. This page is the trade; [05ea](05ea-the-position-value-and-concurrent-creates.md) is the other value a create has to invent.**

## What the canonical schema actually does

```ts
id: uuid('id').primaryKey().defaultRandom(),
```

Read from the published `drizzle-orm` 0.45.2 build, `pg-core/columns/uuid.js`:

```js
/**
 * Adds `default gen_random_uuid()` to the column definition.
 */
defaultRandom() {
  return this.default(sql`gen_random_uuid()`);
}
```

So the default is a database-side call to `gen_random_uuid()`, which the PostgreSQL 18 reference describes as generating *"a version 4 (random) UUID"*. Two consequences follow immediately.

**The value does not exist in your process until the statement returns.** There is no id to log, no id to put in a trace span, and no id to hand to a client, until `RETURNING` brings it back. That is the mechanical reason [05](05-create.md) treats `RETURNING` as structural rather than as an optimisation.

**The id is generated per row, by the server, at insert time.** Two concurrent creates cannot collide on it, and no client can influence it. That is the property you give up by accepting a client id.

## PostgreSQL 18's three generators

The UUID functions reference lists them:

> *"`gen_random_uuid ( ) → uuid` · `uuidv4 ( ) → uuid` — Generates a version 4 (random) UUID"*

> *"`uuidv7 ( [ shift interval ] ) → uuid` — Generates a version 7 (time-ordered) UUID. The timestamp is computed using UNIX timestamp with millisecond precision + sub-millisecond timestamp + random."*

`uuidv4()` is a spelling of `gen_random_uuid()`; the docs list them on one row with the same description. `uuidv7()` is the interesting one: it is **time-ordered**, so successive values sort in generation order, and PostgreSQL 18 ships a companion extractor:

> *"`uuid_extract_timestamp ( uuid ) → timestamp with time zone` — Extracts a timestamp with time zone from a UUID of version 1 or 7. For other versions, this function returns null. Note that the extracted timestamp is not necessarily exactly equal to the time the UUID was generated; this depends on the implementation that generated the UUID."*

Two honest observations, and one thing I am not going to assert.

**Time-ordered keys give you a free secondary sort.** `ORDER BY id` on a v7 column is chronological, which for `cards` means the composite pagination index in the chapter schema — `(board_id, created_at, id)` — has a tiebreaker that already agrees with insertion order rather than being arbitrary. With v4 the `id` component is a pure tiebreaker with no meaning; with v7 it is a finer-grained timestamp. Neither is wrong; the second is more useful.

**Time-ordered keys leak creation time.** `uuid_extract_timestamp` works for anyone who has the id, so a v7 primary key exposed in a URL tells every recipient when the row was made — to the millisecond. For a card that is harmless. For an invoice number, a password-reset token, or anything where creation timing is business-sensitive, it is a disclosure you made by choosing a default.

⚠️ **I am not going to claim a performance figure for v7 versus v4 index locality.** The common argument — that random UUIDs scatter B-tree inserts across the index while time-ordered ones append — is mechanically plausible and widely repeated, but the PostgreSQL documentation does not state it, and there is no sandbox here to measure it. Treat it as a hypothesis to test on your own data, not as a fact this page is giving you.

If you want v7, say so explicitly rather than relying on a helper:

```ts
import { sql } from 'drizzle-orm'
// v7: time-ordered. Note that this leaks creation time to anyone holding the id.
id: uuid('id').primaryKey().default(sql`uuidv7()`),
```

## What a client-supplied id buys

Accepting an id in the request body — or, more honestly, moving to `PUT /api/cards/{id}` where the client chooses the URL — buys exactly three things.

**1 · An optimistic row with a real key.** The client can render the card the instant the user hits enter, keyed by the id it just minted, and reconcile without a swap when the response arrives. With a server-minted id the optimistic row has a temporary key that must be replaced, and every piece of state referencing it — selection, scroll anchor, an in-flight edit — has to be remapped.

**2 · Offline-first creation.** A client that is offline can create rows, queue them, and sync later, with references between them intact because the ids were real from the start. This is not achievable with server-minted ids without inventing a client-side id anyway and mapping it afterwards.

**3 · Idempotency, nearly free.** The primary key is already unique, so a retried create collides and raises `23505`. That is genuine, and it is why some APIs skip the idempotency-key machinery entirely.

🔴 **But the third one is weaker than it looks, and this is the trap.** A primary-key collision does not tell you *why* the id already exists. A retry of your own request and a genuine collision with a row somebody else created are the same SQLSTATE on the same constraint, and the correct response differs: the first is a 200 replay, the second is a 409. To distinguish them you have to compare the stored row against the request — which is the fingerprint from [05da](05da-scoping-expiry-and-the-records-table.md) under another name. A dedicated idempotency key stays cleaner, because it says *"this is a retry of that request"* rather than *"this row exists"*.

RFC 9110 is on the side of moving to PUT if you go this way, because PUT is defined for exactly this shape:

> *"The PUT method requests that the state of the target resource be created or replaced with the state defined by the representation enclosed in the request message content."*

> *"If the target resource does not have a current representation and the PUT successfully creates one, then the origin server MUST inform the user agent by sending a 201 (Created) response."*

And PUT is idempotent by definition, so the client may retry it and every proxy in the path may too — which is the property [05d](05d-idempotency-keys-for-a-retried-post.md) spends a whole page manufacturing for POST.

## What it costs

**1 · The primary key becomes untrusted input.** It needs validating like any other field — `z.uuid()` at minimum — and it needs the same suspicion as a query parameter. A client that can choose ids can choose id `00000000-0000-0000-0000-000000000000` for every row it creates, can choose ids that collide with rows it cannot see (learning of their existence from the 409), and can choose ids that are not random at all.

**2 · It becomes an existence oracle.** `PUT /api/cards/{id}` returning 201 versus 200 tells the caller whether that id was already in use — across the whole table, not just their own boards. Closing that means the ownership check has to run *before* the existence check and has to answer identically for "not yours" and "does not exist", which is topic 11's argument about answering 404 on purpose.

**3 · You lose the guarantee that ids are unguessable.** If the client mints them, some client will mint them badly — a counter, a timestamp, a hash of the title. Any code that treats "holding the id" as evidence of anything then becomes unsound. It should never have been sound anyway, which is the next section.

## A client-supplied id is never a trust boundary

This is worth stating flatly because it is the failure that follows client ids around.

**A UUID in a URL is not authorisation.** Whether it was minted by `gen_random_uuid()` or by the client, `GET /api/cards/{id}` must still check that the caller is a member of the team that owns the board that owns the card. Unguessability is a defence against enumeration, not against a leaked link, a shared screenshot, a browser history sync, a referrer header, or a former employee's notes.

With server-minted v4 ids there is at least a floor: the values are random, so an attacker cannot walk the space. With client-minted ids even that floor is gone, because you cannot make clients generate randomness they have no incentive to generate. The mitigation is the same in both cases and it is not about the id at all — the ownership predicate lives in **the Data Access Layer, topic 04** *(not written yet)*, and every row-returning query is scoped by it.

## The middle path

You do not have to choose globally. A common and defensible arrangement:

```ts
// The server owns the primary key. The client may supply its own correlation id,
// which is stored, indexed per board, and returned — but is not the key.
export const CreateCardRequest = z.strictObject({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(10_000).nullish(),
  status: CardStatus.optional(),
  position: z.number().finite().optional(),
  clientRef: z.uuid().optional(),   // echoed back; never the primary key
})
```

The client gets its optimistic-UI reconciliation key and its offline correlation, and the server keeps a primary key it minted and can reason about. The `clientRef` can even carry the idempotency role if you index it per board — at which point you have rebuilt [05d](05d-idempotency-keys-for-a-retried-post.md) with the key in the body instead of a header, which is a legitimate variant and should be documented as one.

## Gotchas

**★ Symptom: an optimistic row briefly duplicates on screen when the create response arrives.** Cause: the client keyed the optimistic row by a temporary id and the server returned a different one, so React rendered both until the reconciliation ran. Fix: either accept a client-supplied id so the key never changes, or return the client's own correlation id in the response so the client can match on it — the `clientRef` field above — rather than matching on content, which breaks the moment two cards have the same title.

**★ Symptom: `PUT /api/cards/{id}` tells an attacker which ids exist.** Cause: the handler checked existence before ownership, so 201 and 200 differ observably for an id the caller has no right to know about. Fix: resolve ownership first and answer identically for "not found" and "not yours" — topic 11 owns the argument for choosing 404 deliberately. The status code difference between create and replace only becomes safe once both are inside a boundary the caller has passed.

**★ Symptom: the id in the API response is not the id in the database.** Cause: a UUID was generated in application code and sent as a value while the column *also* carried `defaultRandom()`; whichever path the insert took, one of the two values was discarded and the code returned the wrong one. Fix: pick one generator. If the database owns it, do not send a value and read it back with `RETURNING`. If the application owns it, drop `.defaultRandom()` from the column so the two cannot disagree.

**★ Symptom: a client id collides with a row on a board the caller cannot see, and the 409 confirms it exists.** Cause: the uniqueness of a primary key is global, so a conflict crosses every tenancy boundary in the table. Fix: the response for a conflict with an invisible row must be indistinguishable from the response for a conflict with a visible one — or, better, do not put client-chosen values in a globally unique column at all; keep them in a per-board indexed `clientRef` as shown above.

**★ Symptom: switching the column default to `uuidv7()` made card ids reveal exactly when each was created.** Cause: v7 encodes a millisecond timestamp, and PostgreSQL 18 ships `uuid_extract_timestamp` to read it back out of any v7 or v1 value. Fix: this is a deliberate trade, not a bug — keep v7 where creation time is not sensitive, and use `gen_random_uuid()` where it is. Do not attempt to obscure it by re-ordering bytes; the version nibble still says v7 and the field layout is public.

**★ Symptom: a retried `PUT` with a client-supplied id returns 409 instead of succeeding.** Cause: the handler treated any existing row as a conflict, which defeats the entire reason PUT is idempotent — the spec requires that repeating it have the same intended effect. Fix: PUT must replace, not refuse. If you want create-only semantics, that is what `If-None-Match: *` is for, and the refusal is then explicit and requested by the client rather than being the endpoint's default.

**★ Symptom: an id-based "secret link" feature leaks after a link is shared.** Cause: the id was treated as a capability because it is a random UUID. Fix: unguessability is not authorisation, and the fix is not a longer id. Either enforce the ownership predicate on every read, or issue an actual capability — a signed, scoped, expiring token — and treat it as a credential with a revocation story. A primary key has neither expiry nor revocation.

**★ Symptom: some client ids are sequential integers rendered as UUIDs, and enumeration becomes possible.** Cause: client-minted ids are only as random as the least careful client, and nothing in your API forces randomness. Fix: you cannot enforce it, so do not depend on it — which means either the server mints the key, or you accept that ids are guessable and rely entirely on the ownership check. Writing `z.uuid()` and assuming randomness is the mistake; the format validates, the entropy does not.

## Interview questions

**★ Why does RFC 9110 describe POST as creating a resource "that has yet to be identified by the origin server", and what does that force into your response?**
Because with POST the client is submitting content to a collection and asking the collection to do something with it; the collection decides what the result is called. The client therefore cannot know the identifier before the response, which forces three things. The response must carry `Location`, because that is the protocol-defined place the identifier goes and §15.3.2's fallback makes the omission actively wrong. The insert must use `RETURNING`, because the server-generated value does not exist in your process until the statement returns. And any optimistic UI has to key its provisional row on something temporary and reconcile afterwards. If you want to avoid all three, the answer is not a better POST — it is PUT with a client-chosen identifier, which is a different protocol shape with different costs.

**★ A colleague says a client-supplied id makes idempotency keys unnecessary. Where does that argument break?**
It breaks on the question *why does this id already exist?* The primary key gives you uniqueness, so a duplicate create fails — but `23505` on the primary key is identical whether the cause is your own retry or a genuine collision with a row someone else created, and the correct responses differ: the retry deserves a 200 replay of the existing card, the collision deserves a 409. Distinguishing them means comparing the stored row against the incoming request, which is a payload fingerprint under another name, so you have rebuilt most of the idempotency-record machinery anyway and without the vocabulary for it. The argument does hold in one useful form: if you move to PUT, idempotency is genuine and specified rather than manufactured, because PUT is defined to be idempotent and a replace is naturally repeatable.

**★ What does `uuidv7()` give you and what does it cost, in this schema specifically?**
It gives the `id` column a meaningful order. The chapter's pagination index is `(board_id, created_at, id)`, and with v4 the `id` component is a pure tiebreaker with no relation to anything — it exists only to make the sort total. With v7 it is a finer-grained timestamp, so the tiebreaker agrees with insertion order and two cards created in the same millisecond still sort deterministically in the order they were made. The cost is disclosure: PostgreSQL 18 ships `uuid_extract_timestamp`, so anyone holding a v7 id can read its creation time to the millisecond, and ids travel in URLs, logs, screenshots and referrers. For a card that is fine. For anything where creation timing is business-sensitive it is a leak you introduced by changing a default. What I would not do is choose between them on an index-locality performance argument the documentation does not make and this page has not measured.

**★ Why is a random UUID in a URL not a security control?**
Because unguessability defends against exactly one attack — enumeration — and URLs leak through a dozen channels that have nothing to do with guessing. A link gets pasted into a chat, a screenshot goes into a ticket, browser history syncs to another device, a referrer header carries it to a third party, a proxy logs it, a former employee still has their notes. Every one of those hands over the id intact, and if the id is the only check, the resource is now public to whoever received it. The correct control is a predicate about the caller — is this person a member of the team that owns the board that owns this card — evaluated on every read, in the Data Access Layer where it cannot be forgotten. With client-supplied ids the argument is stronger still, because you cannot even rely on the values being random: clients that mint their own ids will eventually include one that mints them from a counter.

**★ You want optimistic UI without giving the client the primary key. What do you do?**
Add a `clientRef` field: the client mints a UUID, sends it with the create, and the server stores it, indexes it per board, and echoes it in the response. The client keys its optimistic row by `clientRef`, so the key never changes when the response arrives and nothing has to be remapped — no selection lost, no scroll jump, no in-flight edit orphaned. The server keeps a primary key it generated, so the key space stays random, uniqueness stays inside a boundary rather than being global, and no client mistake can make ids guessable. The `clientRef` can also carry the idempotency role if the index is unique per board, which is the same mechanism as [05d](05d-idempotency-keys-for-a-retried-post.md) with the key in the body instead of a header. The only real cost is one more column and the obligation to document what the field is for.

---

← [05da · Scoping, expiry and the records table](05da-scoping-expiry-and-the-records-table.md) · Next → [05ea · The position value and concurrent creates](05ea-the-position-value-and-concurrent-creates.md)
