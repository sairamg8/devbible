---
title: "HTTP status mapping"
sidebar_label: "02 · Status mapping"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Map create/read/update/delete to the status codes clients and caches understand.**

> Verified: 2026-08-14 — **no sandbox run**. The status semantics here are
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), not Express behaviour: Express
> supplies `res.status()` and nothing more, and **Express 5 restricts it to 100–999**
> ([migration guide](https://expressjs.com/en/guide/migrating-5.html)). Two RFC facts the
> table below depends on: **GET, HEAD, PUT and DELETE are idempotent while POST is not**,
> and a **204 carries no body** — sending one is a protocol error, not a style choice.
> `res.sendStatus(204)` and `res.status(204).end()` are the two correct spellings;
> `res.status(204).json({})` is not.

## CRUD → status

| Operation | Typical success | Common failures |
|---|---|---|
| Create | **201** + `Location` optional | 400 validation, 409 conflict |
| Read | **200** | 404 |
| Replace/Update | **200** or **204** | 400, 404, 409 |
| Delete | **204** or **200** | 404 |
| Idempotent PUT | Same result on retry | |

Unsafe methods that are not idempotent (many POSTs) need [idempotency keys](06-idempotency-keys.md)
when clients retry.

## Idempotency is a promise, not an observation

RFC 9110 calls PUT and DELETE idempotent, and that is a promise **your handler
has to keep** — the method name does not make it true.

| Method | Idempotent? | What that obliges you to do |
|---|---|---|
| GET, HEAD | Yes | No side effects at all. A GET that writes is a bug, and caches will punish it |
| PUT | Yes | Replacing with the same body twice must leave the same state — so PUT sets fields, it does not increment them |
| DELETE | Yes | **The second delete must also succeed.** Deleting an already-deleted resource is 204, not 404 |
| POST | **No** | Which is why retries need [idempotency keys](06-idempotency-keys.md) |
| PATCH | **No** in general | `{"op": "increment"}` is not idempotent; `{"status": "paid"}` is. Depends on your patch semantics |

The DELETE row is the one people get wrong. A client that times out and retries
should not see a 404 — from its perspective the resource is gone either way, which
is the point of idempotence. Return 204 for "gone now", and reserve 404 for "this
id never existed", if you can even tell the difference.

## `Location`, and the 201 that clients can use

A 201 without a `Location` header tells the client something was created but not
where. Adding it costs a line and removes a guess:

```js
res.status(201).location(`/orders/${order.id}`).json(order);
```

Return the created representation in the body as well. A client that has to issue
a GET after every POST doubles its request count for information you already held.

## Trade-off

Precise statuses let clients, proxies and caches behave correctly without parsing
your body — a 409 tells a client to re-read and retry, a 404 tells it to stop.
That is the whole value: **the status line is the part of your API that
intermediaries understand.**

The cost is that HTTP's vocabulary rarely fits a domain exactly, and arguments
about 400-vs-422 or 403-vs-404 consume real review time for little benefit. Resolve
it by picking the coarse class correctly — client error, server error, conflict —
and putting the precision in your error `code`
([Phase 5](../phase-5-errors/03-error-contract.md)). Clients branch on the code;
caches only ever see the number.

## Gotchas

**Symptom:** Everything returns 200  
**Cause:** Envelope-only APIs  
**Fix:** Real statuses; body for details

**Symptom:** A retried DELETE returns 404 and the client reports a failure  
**Cause:** Treating "already deleted" as missing  
**Fix:** 204 on repeat deletes. Idempotence means the second call succeeds too

**Symptom:** A 204 response has a body, and some clients hang or error  
**Cause:** `res.status(204).json(...)` — 204 must carry no body  
**Fix:** `res.sendStatus(204)` or `res.status(204).end()`

**Symptom:** Clients issue a GET immediately after every POST  
**Cause:** The 201 returned neither a body nor a `Location`  
**Fix:** Return the representation, and set `Location` to its canonical URL

**Symptom:** A GET is being retried by a proxy and causing duplicate side effects  
**Cause:** A GET that mutates — a "mark as read" or counter endpoint  
**Fix:** Move it to POST. Safe methods are assumed side-effect-free by every
intermediary on the path

## Interview questions

**★ Why 201 on create?**  
Signals a new resource; pairs with `Location` when useful.

**Is DELETE always 204?**  
204 if no body; 200 if you return the deleted representation — pick one style.

**★ What does it mean for a method to be idempotent, and which are?**  
Repeating the request leaves the same state as making it once. GET, HEAD, PUT and
DELETE are idempotent by specification; POST is not. It is a promise your handler
must keep — the method name alone guarantees nothing.

**★ A client retries DELETE after a timeout. What should it get?**  
204 again. Returning 404 breaks the idempotence guarantee and turns a successful
delete into a client-visible error.

**Why is PATCH not idempotent in general?**  
Because it depends on your patch semantics. Setting a field is idempotent;
incrementing one is not. That is why PATCH sometimes needs an idempotency key and
PUT does not.

**Where should precision live — the status code or the error body?**  
The class in the status, the detail in the `code`. Intermediaries only understand
the number; clients branch on the code.


---

← Prev: [REST resources](01-rest-resources.md) · Next → [Pagination](03-pagination.md)
