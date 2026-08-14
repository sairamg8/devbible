---
title: "CRUD to status"
sidebar_label: "01 · CRUD to status"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Map create/read/update/delete to the status codes clients and caches
understand. The status line is the part of your API that intermediaries read —
and the only part they can act on.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** The status
> semantics are [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §15, not
> Express behaviour: Express supplies `res.status()` and nothing more, and
> **Express 5 restricts it to 100–999**, throwing `TypeError` for a non-integer
> and `RangeError` outside the range — read from `express@5.2.1`'s
> `lib/response.js` in `sandbox/express-verify/node_modules/` and quoted in
> [Phase 4 · 02 · chunk 01](../../phase-4-responses/02-status-and-headers/01-status-as-contract.md).
> Two RFC facts the tables depend on: **GET, HEAD, PUT and DELETE are idempotent
> while POST is not**, and a **204 carries no body**. Where the RFC leaves a
> choice, the recommendation is **this bible's** and says so.

## The table

| Operation | Success | Body | Headers | Common failures |
|---|---|---|---|---|
| Create | **201** | the created resource | **`Location`** | 400 validation · 409 conflict · 422 if you use it |
| Read one | **200** | the resource | `ETag`, `Cache-Control` | 404 |
| Read many | **200** | a page object, never a bare array | `Link` | 400 bad filter |
| Replace (`PUT`) | **200** | the new state | | 400 · 404 · 409 · 412 |
| Update (`PATCH`) | **200** | the new state | | 400 · 404 · 409 · 415 for an unknown patch format |
| Delete | **204** | none — `res.send` strips it | | 404 (but see below) · 409 if it cannot be deleted |
| Async action | **202** | an **id** to poll, not a snapshot | `Location` of the status resource | 409 if already running |

Two rows deserve their own note.

**A 204 genuinely carries no body**, and Express enforces it: `res.send` removes
`Content-Type`, `Content-Length` and `Transfer-Encoding` and empties the chunk
for 204 and 304, so `res.status(204).json({deleted: true})` silently sends
nothing ([Phase 4 · 01 · chunk 01](../../phase-4-responses/01-res-methods/01-what-res-send-does.md)).
The two correct spellings are `res.sendStatus(204)` and `res.status(204).end()`.

**202 is "intentionally noncommittal"**, in RFC 9110's own words. It is the right
answer when work is queued rather than done, and the body must be an **id the
client can poll**, not a snapshot of a state that has not settled. The enqueue
must happen *after* the commit, or you can accept work you then lose
([Phase 7 · 05](../../phase-7-layering/05-jobs-from-routes.md)).

## 200 or 204 for an update?

Both are defensible and the argument is not worth much, but the trade is real:

| | 200 with the new state | 204 |
|---|---|---|
| Round trips | one — the client already has the result | two, if the client needs the new state |
| Payload | the full resource, every time | nothing |
| Server-computed fields | visible immediately (`updatedAt`, a derived total) | invisible until the next GET |
| Concurrency | the client gets the new `ETag` for its next write | it must re-read to get one |

**This bible's default is 200 with the new state**, for the concurrency reason as
much as the round trip: a client doing optimistic concurrency needs the new
validator after every write, and forcing a GET to get it widens the race it was
trying to close ([Phase 6 · 07](../07-etag-and-cache.md)).

204 is right when the resource is large and the client demonstrably does not want
it back.

## The DELETE question

🔴 **The second DELETE must also succeed.** RFC 9110 calls DELETE idempotent,
which is a promise about *effect*: after one call the resource is gone, and after
two it is still gone. A client that timed out and retried has not done anything
wrong, and answering 404 tells it something is broken when nothing is.

```js
// ✅ idempotent — the effect is the same either way
await orders.delete(id, req.user.orgId);
res.sendStatus(204);
```

The counter-argument — "but 404 tells the caller the id was wrong" — is weaker
than it sounds, because you usually cannot distinguish "already deleted" from
"never existed" without keeping tombstones, and if you can, exposing that
distinction leaks the existence of deleted records.

**Where a 404 on DELETE is right:** when the resource is one the caller must be
able to see to delete, and hiding non-existence is the security requirement
anyway — in which case *both* "not yours" and "not there" are 404
([Phase 8 · 07](../../phase-8-validation-authz/07-ownership/README.md)).

## Idempotency is a promise, not an observation

RFC 9110 labels the methods; **your handler has to keep the promise.** The method
name does not make it true.

| Method | Idempotent? | What that obliges you to do |
|---|---|---|
| GET, HEAD | Yes | No side effects at all. A GET that writes is a bug, and prefetchers and crawlers will find it |
| PUT | Yes | Replacing with the same body twice leaves the same state — so `PUT` **sets** fields, it does not increment them |
| DELETE | Yes | **The second delete must also succeed** |
| POST | **No** | Which is why retries need [idempotency keys](../06-idempotency-keys.md) |
| PATCH | **No** in general | `{"op":"increment"}` is not idempotent; `{"status":"paid"}` is. It depends on your patch format — [Phase 6 · 10](../10-patch-and-bulk.md) |

The obligation is not academic. **Clients, proxies, service meshes and job
runners retry idempotent methods automatically after a timeout**, without asking.
A `PUT` that increments a counter will be double-counted by infrastructure you do
not control and cannot see.

## The `Location` header

A 201 without `Location` tells the client something was created but not where:

```js
res.status(201).location(`${req.baseUrl}/${order.id}`).json(present(order));
```

**Return the created representation as well.** A client that must GET after every
POST doubles its request count for information you already had in memory.

And build the URL from `req.baseUrl` — the router does not know where it is
mounted, so a hard-coded prefix is a second place the mount path lives
([Phase 1 · 03 · chunk 01](../../phase-1-routing/03-router-composition/01-mounting-a-router.md)).

`Location` matters on **202** too, pointing at the status resource the client
should poll.

## Gotchas

**Symptom:** `res.status(204).json({ok: true})` sends an empty response
**Cause:** `res.send` strips the body and the content headers for 204 and 304 —
RFC 9110 forbids a body
**Fix:** Use 200 if you want a body

**Symptom:** A retried DELETE returns 404 and the client reports an error
**Cause:** The handler treats "already deleted" as "not found"
**Fix:** 204 for both. Idempotence is a promise about effect, and a retry is not
a client mistake

**Symptom:** A counter is double-incremented after a network blip
**Cause:** An increment behind a `PUT`, which infrastructure retries automatically
**Fix:** `PUT` sets, `POST` increments — and a `POST` that must be retried safely
needs an idempotency key

**Symptom:** A client polls immediately after a 202 and gets a 404
**Cause:** The status resource is created asynchronously, after the response
**Fix:** Create the status record in the same transaction as accepting the work,
and return its `Location`

**Symptom:** Clients issue a GET after every POST
**Cause:** The create returns 201 with an empty body, or no `Location`
**Fix:** Return both. You already have the resource in memory

**Symptom:** `res.status(err.code)` throws inside the error handler
**Cause:** Express 5 validates the argument, and `err.code` was a string
**Fix:** Map through a table with a 500 default
([Phase 5 · 04](../../phase-5-errors/04-mapping-to-http.md))

## Interview questions

**★ What should a create return?**
201, the created resource, and a `Location` header. The id is the one thing the
client could not compute, so returning it saves a round trip — and `Location`
tells them where it now lives.

**★ 200 or 204 for an update?**
Both are defensible. This bible defaults to 200 with the new state, because a
client doing optimistic concurrency needs the new `ETag` after every write, and
forcing a GET to obtain it widens the race the `ETag` existed to close. 204 is
right when the resource is large and the client does not want it back.

**★ Should a second DELETE return 404?**
No — 204. DELETE is idempotent, which is a promise about effect: after one call
it is gone, after two it is still gone. A client that timed out and retried has
done nothing wrong, and you usually cannot distinguish "already deleted" from
"never existed" anyway.

**★ Why does it matter that PUT is idempotent?**
Because clients, proxies, service meshes and job runners retry idempotent methods
automatically after a timeout, without asking. A `PUT` that increments will be
double-counted by infrastructure you do not control.

**When is 202 the right status?**
When the work is accepted and not finished. RFC 9110 calls it "intentionally
noncommittal". The body carries an **id to poll**, not a snapshot of unsettled
state, and the enqueue happens after the commit.

**Is PATCH idempotent?**
Not in general — it depends on the patch format. `{"status":"paid"}` is;
`{"op":"increment"}` is not. JSON Merge Patch is idempotent because it sets
absolute values, which is also why it cannot express "set this field to null"
other than as a delete.

---

Index: [Status mapping](README.md) · Next → [Conflicts and preconditions](02-conflicts-and-preconditions.md)
