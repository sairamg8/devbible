---
title: "A second DELETE of a card that is already gone has achieved the client's goal, and returning 404 for it is a defensible choice that will cost you — this page argues both sides so the decision is deliberate, then handles the delete that races an update"
sidebar_label: "08d · 204, 200, and idempotent delete"
sidebar_position: 60
description: "204 vs 200 vs 202 straight from RFC 9110, why DELETE is defined as idempotent and what that does and does not oblige you to return, the honest argument for 404, the conditional delete with If-Match, 410 Gone, and deleting a row another request is mid-update on."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against RFC 9110 §9.2.2 (Idempotent Methods), §9.3.5 (DELETE), §15.3.5 (204), §15.5.5 (404), §15.5.11 (410), §13.1.1 (`If-Match`) — [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html) — and the PostgreSQL 18 manual, [13.2.1 Read Committed](https://www.postgresql.org/docs/18/transaction-iso.html). Quotes copied from the published RFC text file.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**Two questions decide the whole shape of a delete endpoint, and both are usually answered by copying whatever the last endpoint did. What does a successful delete return — 204, 200 with a body, or 202? And what does a *repeated* delete return, when the card is already gone? The specification is unambiguous about the first and deliberately silent about the second, which is why the second is worth arguing properly: 204 is the goal-state reading, 404 is the resource reading, and the reason to prefer 204 is not purity but that every retry mechanism in the world will replay your DELETE and you have to decide what those replays produce.**

## The success codes, quoted

RFC 9110 §9.3.5 lists exactly three and says when each applies:

> *"If a DELETE method is successfully applied, the origin server SHOULD send*
> - *a 202 (Accepted) status code if the action will likely succeed but has not yet been enacted,*
> - *a 204 (No Content) status code if the action has been enacted and no further information is to be supplied, or*
> - *a 200 (OK) status code if the action has been enacted and the response message includes a representation describing the status."*

The decision table falls out of it directly:

| Situation | Code | Body |
|---|---|---|
| The row is gone (or soft-deleted) when the response is written | **204** | none |
| You want to tell the client something — the deleted representation, an undo token, a retention deadline | **200** | that thing |
| The delete was enqueued and a worker will perform it | **202** | ideally a status URL |

⚠️ **202 is not a way to make a slow delete feel fast.** It is a promise that the deletion has *not* happened yet, and the client is entitled to act on that — for instance by polling. If a cascade takes a long time and you want to return early, you have to actually enqueue the work (ch15 [04d](../15-databases-apis-and-full-stack-patterns/04d-postgres-as-a-queue-skip-locked.md)) and accept that the resource remains readable in the interim, or hide it immediately with a soft delete and let the hard purge be the background job. The second is almost always the better design, and it returns 204.

RFC 9110 also has a warning that catches people who put a body on the *request*:

> *"Although request message framing is independent of the method used, content received in a DELETE request has no generally defined semantics, cannot alter the meaning or target of the request, and might lead some implementations to reject the request and close the connection because of its potential as a request smuggling attack … A client SHOULD NOT generate content in a DELETE request."*

🔴 **Do not design a DELETE that requires a request body.** Anything the delete needs — a reason, a cascade flag, a confirmation token — goes in the query string or a header, or the operation is a POST to a sub-resource. `fetch` will let you send a body; some intermediary will drop it.

## Why delete is idempotent, and what that actually obliges

RFC 9110 §9.2.2:

> *"A request method is considered 'idempotent' if the intended effect on the server of multiple identical requests with that method is the same as the effect for a single such request. Of the request methods defined by this specification, PUT, DELETE, and safe request methods are idempotent."*

Note the wording carefully: it constrains the **effect on the server**, not the status code. Deleting an already-deleted card changes nothing, so a 404 on the second call does not make DELETE non-idempotent in the specification's sense. **The RFC does not tell you what to return.** Anyone who says "the spec requires 204 on a repeated delete" is wrong; the argument has to be made on other grounds.

Here it is.

## The case for 204 on a repeated delete

**1 · The client's goal state is achieved.** The client asked for the card not to exist. It does not exist. Reporting failure for a request whose intent is satisfied forces every caller to write `if (res.status === 404) { /* actually fine */ }`, which is error handling that exists solely to un-do your status code.

**2 · Retries are not optional and not yours.** Because DELETE is idempotent, everything in the chain is entitled to replay it. RFC 9110: *"the request can be repeated automatically if a communication failure occurs before the client is able to read the server's response"*, and a proxy may do so — the prohibition is only on non-idempotent methods. So the sequence *"DELETE → response lost → DELETE"* is normal traffic, not a client bug, and it produces a 404 that nothing did wrong.

**3 · The 404 is a lie about which failure occurred.** The client cannot distinguish *"already deleted"* from *"never existed"* from *"exists but you cannot see it"*, and those need different reactions.

**4 · Concurrent deletes are ordinary.** Two people clicking delete on the same card is a race with no wrong answer, and one of them getting an error for succeeding is a poor user experience with no upside.

## The case for 404, which is not silly

**1 · It is honest about the resource.** RFC 9110 §15.5.5: *"The 404 (Not Found) status code indicates that the origin server did not find a current representation for the target resource or is not willing to disclose that one exists."* At the moment of the second request that is exactly true, and every *other* method on that URL returns 404, so DELETE returning 204 makes it the one verb that reports success on a nonexistent resource.

**2 · It catches client bugs.** A UI deleting the same id twice, a script iterating a stale list, an integration with an off-by-one — a 404 surfaces those. A blanket 204 hides them.

**3 · It composes with 410.** If your soft delete keeps the row, you can distinguish *"deleted, and we know it"* (410 Gone) from *"never existed"* (404), which is genuinely more information than 204 gives. RFC 9110 notes *"the 410 (Gone) status code is preferred over 404 if the origin server knows … that the condition is likely to be permanent."*

## The recommendation, and how to make it not matter

**Return 204 for both, and pick 404 only if you have a specific reason from the list above.** The client-bug argument is real, but it is better served by logging the repeat than by failing the request — you get the diagnostic without making every caller handle a success as an error.

```ts
// app/api/cards/[cardId]/route.ts
import { softDeleteCard, cardEverExisted } from '@/lib/dal/cards'

export async function DELETE(_req: Request, ctx: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await ctx.params

  const deleted = await softDeleteCard(cardId)   // returns null if it was already gone
  if (deleted) return new Response(null, { status: 204 })

  // Nothing to delete. Decide once, here, and document it.
  //  (a) goal-state reading — the default this chapter recommends:
  return new Response(null, { status: 204 })

  //  (b) resource reading — uncomment ONE of these instead, never both:
  //  const existed = await cardEverExisted(cardId)
  //  return new Response(null, { status: existed ? 410 : 404 })
}
```

🔴 **Whichever you pick, make it the same for every resource in the API.** The cost of this decision is not the code; it is that a client written against a 204 delete and pointed at a 404 delete breaks in a way nobody tests for.

⚠️ **The 410 branch has a disclosure consequence.** Answering 410 tells the caller that this id was real, which is information a 404 withholds — and topic 11 argues that sometimes you *want* the 404 for exactly that reason. If card ids are unguessable UUIDs the leak is small; if they are sequential integers, 410 is an enumeration oracle.

## The conditional delete

`If-Match` is not just for updates. RFC 9110 §13.1.1 names DELETE explicitly: *"If-Match is most often used with state-changing methods (e.g., POST, PUT, DELETE) to prevent accidental overwrites when multiple user agents might be acting in parallel on the same resource."*

*"Delete this card only if it is still the one I read"* is a real requirement — a user who reads a card, walks away, comes back to a card someone else has rewritten, and deletes it, has deleted something they never saw.

```ts
export async function DELETE(req: Request, ctx: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await ctx.params
  const ifMatch = req.headers.get('if-match')

  if (ifMatch) {
    const expected = versionFromIfMatch(ifMatch, cardId)
    if (expected === null) return new Response(null, { status: 400 })

    const [row] = await db.update(cards)
      .set({ deletedAt: sql`now()`, version: sql`${cards.version} + 1` })
      .where(and(
        eq(cards.id, cardId),
        eq(cards.version, expected),
        isNull(cards.deletedAt),
      ))
      .returning({ id: cards.id })

    if (row) return new Response(null, { status: 204 })

    const [current] = await db.select().from(cards)
      .where(and(eq(cards.id, cardId), isNull(cards.deletedAt))).limit(1)
    // Present but a different version → the precondition failed. Absent → already gone.
    return current
      ? Response.json({ code: 'precondition_failed', current }, { status: 412 })
      : new Response(null, { status: 204 })
  }

  await softDeleteCard(cardId)
  return new Response(null, { status: 204 })
}
```

Note the asymmetry with [07e](07e-etag-if-match-and-412.md): a failed precondition on a **card that is now absent** is still a 204, because the goal state is reached. A failed precondition on a card that is *present but changed* is a 412, because the client conditioned on a state that no longer holds and the deletion has not happened.

## Deleting a row another request is mid-update on

Both orders are safe, and the reason is the Read Committed rule from [07c](07c-the-lost-update.md). What differs is what each request observes.

**Hard delete versus a concurrent update:**

```text
time   Request A (DELETE)                 Request B (PATCH)         row c1
──────────────────────────────────────────────────────────────────────────
t1     BEGIN                              BEGIN
t2     DELETE … WHERE id='c1'                                        locked by A
t3                                        UPDATE … WHERE id='c1'    B waits on A
t4     COMMIT                                                        row gone
t5                                        B wakes, re-evaluates
                                          → row was deleted:
                                            0 rows affected
t6                                        COMMIT (nothing written)
──────────────────────────────────────────────────────────────────────────
```

The manual: *"the second updater will ignore the row if the first updater deleted it"*. B's `UPDATE` affects zero rows. If B is the versioned update from [07d](07d-optimistic-concurrency-with-a-version-column.md), it runs its disambiguating `SELECT`, finds nothing, and returns **404** — which is right: the card the user was editing no longer exists.

**Soft delete versus a concurrent update** is a plain write conflict, and the guard is what makes it correct:

- A's `UPDATE … SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL` and B's patch contend on the same row lock. Whoever is second re-evaluates.
- If A wins, B's `WHERE … AND deleted_at IS NULL` no longer matches, B affects zero rows, and B returns 404 — provided **every write carries `deleted_at IS NULL`**, which is why [08b](08b-what-soft-delete-costs-every-read.md) insists on it for writes and not only reads.
- If B wins, A's guard still matches (B did not delete it) and A deletes the freshly-updated row. The user's edit is recorded in the audit trail and then the card is deleted, which is the honest outcome.

🔴 **The failure case is a soft-delete `UPDATE` without the `deleted_at IS NULL` guard on the *patch* side.** B then happily patches a row A deleted a millisecond earlier, and the card is deleted with an `updated_at` newer than its `deleted_at` — a state that makes no sense and that nothing will flag.

## Gotchas

**★ Symptom: a client's delete succeeds and its retry returns 404, and the client reports an error to the user.** Cause: the second request found nothing and the endpoint reads 404 as the honest answer. Fix: return 204 for the already-gone case, and log the repeat if you want the diagnostic — the client should not have to treat a satisfied goal as an error.

**★ Symptom: two users delete the same card and one sees a failure.** Cause: same as above, arriving from concurrency rather than retry. Fix: same — 204 for both. There is no wrong answer to a race whose outcome both parties wanted.

**★ Symptom: a DELETE with a JSON body works locally and the body is missing in production.** Cause: RFC 9110 says content in a DELETE has no defined semantics and some implementations reject it outright as a smuggling risk; an intermediary dropped it. Fix: move the parameter to the query string, or make the operation a POST to a sub-resource:

```
POST /api/cards/[cardId]/archive     { "reason": "duplicate" }
```

**★ Symptom: a 202 was returned and the client immediately re-read the card and found it.** Cause: 202 means the action has *not* been enacted, and the client is entitled to that reading. Fix: if you want the resource gone immediately, soft-delete synchronously and return 204, then purge in the background. Reserve 202 for deletions that genuinely complete later, and give it a status URL.

**★ Symptom: an already-deleted card returns 410 and an id-enumeration script uses it to discover which ids were real.** Cause: 410 asserts prior existence; 404 does not. Fix: return 404 (or 204) uniformly for anything the caller cannot see. If ids are sequential, this is not a theoretical concern — the same reasoning drives topic 11's argument for answering 404 on purpose.

**★ Symptom: a card is deleted and its `updated_at` is later than its `deleted_at`.** Cause: a concurrent patch that lacked the `deleted_at IS NULL` guard wrote to the row after the delete committed. Fix: every write predicate carries the guard, not just every read:

```ts
.where(and(eq(cards.id, cardId), isNull(cards.deletedAt)))
```

**★ Symptom: `DELETE` is not idempotent in practice because it decrements a counter.** Cause: a side effect attached to the delete rather than derived from the state. A replayed DELETE runs it twice. Fix: derive the counter (`SELECT count(*) … WHERE deleted_at IS NULL`) or make the side effect conditional on the delete having actually affected a row — the `if (deleted)` branch in the handler above is the hook for it.

**★ Symptom: the delete endpoint returns 204 and the UI still shows the card until a refresh.** Cause: 204 has no body, so a client doing optimistic UI has nothing to reconcile against, and the cache was not invalidated. Fix: invalidate the tag server-side as part of the delete, and — if the client needs the row — use 200 with the deleted representation. That is exactly the case RFC 9110 reserves 200 for.

**★ Symptom: DELETE succeeds for a caller who should not be able to see the card, and the 204 confirms the card existed.** Cause: authorization was checked on the delete but the response distinguishes "deleted" from "no such card". Fix: the ownership predicate belongs in the DAL's `WHERE` clause so an unauthorised delete affects zero rows and is indistinguishable from a missing one — [04c · the ownership predicate](04c-the-ownership-predicate.md).

**★ Symptom: DELETE returns 204 and a subsequent GET still returns the card.** Cause: the read path does not carry the soft-delete predicate, or a cache is serving the old representation. Fix: this is the one thing RFC 9110 genuinely requires of a delete — the resource must stop being available. Check the read predicate first, the cache second.

## Interview questions

**★ Does the HTTP specification require a repeated DELETE to return 204?**
No, and this is worth being precise about. Idempotency in RFC 9110 constrains "the intended effect on the server of multiple identical requests", not the status code, and deleting an already-deleted resource changes nothing on the server whatever you return. So a 404 on the second call is specification-conforming. The argument for 204 is practical rather than legal: the client's goal state is achieved, retries of an idempotent method are legitimate and will happen, and a 404 forces every caller to write error handling for a success.

**★ Make the case for 404 on a repeated delete.**
It is honest about the resource — at that moment there is no current representation, which is exactly what 404 means, and every other method on that URL agrees. It surfaces client bugs like a stale list being iterated or a double-submit, which a blanket 204 hides. And if you keep soft-deleted rows you can answer 410 Gone for "we deleted this" versus 404 for "never existed", which carries more information than 204 does. The counter-argument is that 410 also discloses that the id was real, which is an enumeration oracle if ids are guessable.

**★ When is 202 the right code for a delete?**
Only when the deletion has genuinely not happened yet — you have enqueued it and a worker will perform it. It is not a performance trick, because a client is entitled to read 202 as "not yet done" and to poll. If a cascade is slow and you want to return quickly, the better design is a synchronous soft delete that makes the resource disappear immediately, returning 204, with the hard purge as a background job.

**★ Why should a DELETE request not carry a body?**
Because RFC 9110 says content in a DELETE "has no generally defined semantics, cannot alter the meaning or target of the request", and warns that some implementations reject such requests and close the connection because of the request-smuggling risk. Practically, an intermediary may drop it, so a delete whose behaviour depends on its body will work in development and behave differently in production. Parameters go in the query string, or the operation becomes a POST to a sub-resource.

**★ A DELETE and a PATCH hit the same row at the same instant. What happens?**
They serialise on the row lock, and the loser re-evaluates its `WHERE` clause against the winner's result — PostgreSQL's documented Read Committed behaviour. If the delete wins, the patch affects zero rows and the handler returns 404, which is correct because the card the user was editing is gone. If the patch wins, the delete's guard still matches and the card is deleted with the edit recorded in whatever audit trail you keep. The dangerous variant is a soft delete where the patch's predicate omits `deleted_at IS NULL`, because then the patch writes to a row that was deleted a moment earlier and nothing complains.

**★ How does `If-Match` change the delete, and what does a failed precondition return?**
It turns "delete this card" into "delete this card only if it is still the one I read", which matters when the card may have been rewritten since. A failed precondition on a card that is present but at a different version is a 412, because the client conditioned on a state that no longer holds and the deletion did not happen. A failed precondition on a card that is *absent* is still a 204 under the goal-state reading, since the client's intent is satisfied — the asymmetry is deliberate and worth stating in your API documentation.

**★ Your delete decrements a "cards remaining" counter. What is wrong with that?**
A replayed DELETE runs the decrement twice, and DELETE is idempotent precisely so that replays are legal — so this is a bug that the specification's own retry guidance will trigger. Either derive the number from the rows rather than maintaining it, or make the side effect conditional on the delete having actually changed something, so the second call finds zero affected rows and skips it.

---

← [08c · Cascades and referential integrity](08c-cascades-and-referential-integrity.md) · [Chapter 16 overview](01-explanation.md) · Next → [08e · Restoring a soft-deleted row](08e-restoring-a-soft-deleted-row.md)
