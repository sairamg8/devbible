---
title: "Conflicts and preconditions"
sidebar_label: "02 · Conflicts and preconditions"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**409, 412 and 428 are the three statuses that describe *state*, not input — and
they are the ones most APIs collapse into 400. Getting them right is what lets a
client resolve a conflict instead of guessing.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** Statuses are
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html): §15.5.10 (409),
> §15.5.13 (412), and 428 is
> [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) §3. 🔴 **Express does
> not evaluate `If-Match` at all** — `req.fresh` returns early for any method that
> is not GET or HEAD, read from `express@5.2.1`'s `lib/request.js` in
> `sandbox/express-verify/node_modules/`
> ([Phase 3 · 01 · chunk 02](../../phase-3-requests/01-req-anatomy/02-the-twelve-getters.md)),
> and this corpus previously shipped a page claiming otherwise, corrected on
> [page 07](../07-etag-and-cache.md). Where the RFC leaves a choice, the
> recommendation below is **this bible's**.

## The three, and what each tells a client to do

| Status | Means | The client should |
|---|---|---|
| **409 Conflict** | the request conflicts with the **current state** of the resource | re-read, decide, and possibly retry with different content |
| **412 Precondition Failed** | the client stated an expectation (`If-Match`) and it was wrong | re-read, re-apply its change, retry |
| **428 Precondition Required** | the client stated **no** expectation and this endpoint demands one | retry *with* an `If-Match` |

The distinction that matters: **409 is about the state, 412 is about a claim the
client made about the state, and 428 is about the claim being absent.** A 400
says "your request was malformed", which is none of these — and it tells a client
to fix its code rather than re-read and retry.

## 409 in practice

The two common causes are different enough to be worth separating in the error
`code`, even though they share a status:

```js
// a uniqueness conflict — the client can change the value and retry
if (err.code === '23505') throw new AppError('EMAIL_TAKEN', 'That email is already registered');

// a state-machine conflict — retrying with the same input will never work
if (order.status !== 'pending') throw new AppError('ORDER_NOT_CANCELLABLE',
  `An order in state ${order.status} cannot be cancelled`);
```

Both are 409; only the first is retryable with modified input. **The `code` is
what tells them apart**, which is exactly the division of labour from
[Phase 5 · 03](../../phase-5-errors/03-error-contract/README.md) — the status is
for intermediaries, the code is for the client.

🔴 **Never let a driver's message become the 409 body.** `duplicate key value
violates unique constraint "users_email_key"` names your table and your index.
Map it at the repository boundary
([Phase 5 · 03 · chunk 02](../../phase-5-errors/03-error-contract/02-what-is-safe-to-expose.md)).

**Include what would help.** For a state conflict, the current state; for a
uniqueness conflict, the field. Not the conflicting *record* — that is somebody
else's data.

## Optimistic concurrency, and what Express does not do

The lost-update problem in one line: two clients read version 3, both write, and
the second silently overwrites the first. The HTTP answer is a validator plus a
precondition:

```text
GET  /orders/7            → 200, ETag: "v3"
PUT  /orders/7            If-Match: "v3"   → 200, ETag: "v4"
PUT  /orders/7            If-Match: "v3"   → 412 Precondition Failed
```

🔴 **Express evaluates none of this.** `req.fresh` handles only the *read-side*
validators (`If-None-Match`, `If-Modified-Since`) and returns early for anything
that is not GET or HEAD. `If-Match` is never looked at. RFC 9110 puts precondition
evaluation on the origin server — which is your handler:

```js
const expected = req.get('If-Match');
if (!expected) {
  return res.status(428).json({error: {code: 'PRECONDITION_REQUIRED',
    message: 'If-Match is required for updates'}});
}

// re-check at the write, not before it
const updated = await orders.updateIfVersion(id, req.user.orgId, parse(expected), req.validated);
if (!updated) return res.status(412).json({error: {code: 'VERSION_MISMATCH'}});

res.set('ETag', etagFor(updated)).json(present(updated));
```

Two subtleties in those lines, and both are load-bearing:

**1 · The check must happen at the write.** Loading the row, comparing versions,
then updating is a read-modify-write race — two requests can both pass the
comparison before either writes. The version has to be in the `WHERE` clause
(`UPDATE … WHERE id = $1 AND version = $2`), and "no rows updated" is the 412.

**2 · Express's default `ETag` is weak**, and RFC 9110 requires **strong**
comparison for `If-Match`. So a writable resource needs its **own** validator — a
version column, or a strong ETag you compute — rather than the one `res.send`
generates. That is the correction on
[page 07](../07-etag-and-cache.md), and the reason the code above uses
`etagFor(updated)`.

## 428, and when to demand a precondition

`428 Precondition Required` exists so a server can insist. Without it, a client
that omits `If-Match` gets a last-write-wins update and never learns that
concurrency control was available.

**Demand it where a lost update is expensive** — anything with money, state
machines, or collaborative editing. **Do not demand it everywhere**: for a
single-writer resource it is ceremony that every client must implement for no
benefit, and it makes a simple `curl` two calls instead of one.

If you do demand it, say so in the OpenAPI document and in the 428 body, because
a client cannot discover the requirement any other way
([Phase 6 · 08](../08-openapi.md)).

## The statuses people reach for instead, and why they are worse

| Instead of | People send | Why it is worse |
|---|---|---|
| 409 | 400 | Tells the client to fix its request; the request was fine, the state was not |
| 409 | 422 | Implies a semantic problem with the payload, not with the world |
| 412 | 409 | Loses the "you told me v3 and it is v4" specificity, so the client cannot know to re-read |
| 428 | 400 | The client has no way to learn that a precondition was expected |
| 409 | 500 | Turns a normal, expected outcome into your error budget and someone's pager |

That last row is the expensive one. **A uniqueness conflict is not an error on
your side** — it is the database doing its job. Letting it reach the default
handler as a 500 pollutes the error rate and pages someone for a user typing an
email that already exists.

## Trade-off

Precise statuses let clients, proxies and caches behave correctly without parsing
your body — a 409 tells a client to re-read and retry, a 404 tells it to stop.
**That is the whole value: the status line is the part of your API that
intermediaries understand.**

The cost is that HTTP's vocabulary rarely fits a domain exactly, and arguments
about 400-vs-422 or 403-vs-404 consume real review time for little benefit.

**Resolve it by picking the coarse class correctly** — client error, server error,
conflict — **and putting the precision in your error `code`**
([Phase 5 · 03](../../phase-5-errors/03-error-contract/README.md)). Clients branch
on the code; caches only ever see the number. The one distinction always worth
arguing about is 4xx versus 5xx, because it decides whose pager rings.

## Gotchas

**Symptom:** A duplicate email pages the on-call engineer
**Cause:** The driver's unique-violation error reached the default handler as a
500
**Fix:** Map it at the repository to a 409 with a code. It is an expected outcome,
not a failure

**Symptom:** Two users' edits overwrite each other and nobody notices
**Cause:** No precondition. Last write wins, silently
**Fix:** A version column, `If-Match`, and the version in the `WHERE` clause of
the update

**Symptom:** `If-Match` is sent and ignored
**Cause:** Express does not evaluate it — `req.fresh` returns early for
non-GET/HEAD and only ever checks the read-side validators
**Fix:** Evaluate it in the handler. RFC 9110 makes it the origin server's job

**Symptom:** Optimistic concurrency still loses updates under load
**Cause:** The version was compared after loading the row rather than in the
`UPDATE … WHERE version = $n`
**Fix:** Re-check at the write. The pre-check races by construction

**Symptom:** A 409 body contains a table and index name
**Cause:** A driver message forwarded into the envelope
**Fix:** Map at the boundary; the client gets a code and a field name

**Symptom:** A client never sends `If-Match` and nobody realises
**Cause:** The endpoint accepts requests without it
**Fix:** 428 if lost updates matter for that resource — it is the only way the
client learns the requirement exists

## Interview questions

**★ What is the difference between 409 and 412?**
409 says the request conflicts with the current state; 412 says the client stated
an expectation about that state (`If-Match`) and the expectation was wrong. The
client's next move differs: after a 412 it knows to re-read and re-apply, which a
bare 409 does not tell it.

**★ Does Express evaluate `If-Match`?**
No. `req.fresh` only ever evaluates the read-side validators and returns early for
any method that is not GET or HEAD. RFC 9110 puts precondition evaluation on the
origin server, which means your handler. This corpus previously claimed otherwise
and the page is corrected.

**★ Why must the version check be part of the `UPDATE` statement?**
Because loading, comparing and then writing is a read-modify-write race — two
requests can both pass the comparison before either writes. Putting the version
in the `WHERE` clause makes the check and the write atomic, and "zero rows
updated" is the 412.

**★ Why can't you use Express's generated `ETag` with `If-Match`?**
Because Express's `etag` setting defaults to `'weak'`, and RFC 9110 requires
strong comparison for `If-Match`. A writable resource needs its own strong
validator — typically a version column.

**What is 428 for?**
For a server to insist on a precondition. Without it, a client that omits
`If-Match` silently gets last-write-wins and never discovers that concurrency
control was on offer. Demand it where a lost update is expensive; skip it where
it is ceremony.

**Why is returning 500 for a unique-constraint violation a real problem?**
Because it is not your failure — the database did exactly what it was told. A 500
puts an expected outcome into your error rate and onto someone's pager, and it
tells the client to retry something that will never succeed unchanged.

---

← Prev: [CRUD to status](01-crud-to-status.md) · Index: [Status mapping](README.md) · Next topic → [Pagination](../03-pagination.md)
