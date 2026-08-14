---
title: "PATCH semantics and bulk endpoints"
sidebar_label: "10 · PATCH · bulk"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

**PUT replaces, PATCH changes part of a thing — and "part of" needs a format you
have actually chosen. Bulk endpoints break every assumption a single status code
carries.**

> Verified: 2026-08-14 — **no sandbox run**. The method semantics are
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html): PUT replaces the target
> resource with the enclosed representation and **is idempotent**; PATCH applies a set of
> changes and **is not idempotent in general**. Two patch document formats are
> standardised — **JSON Patch**, [RFC 6902](https://www.rfc-editor.org/rfc/rfc6902.html)
> (`application/json-patch+json`), and **JSON Merge Patch**,
> [RFC 7386](https://www.rfc-editor.org/rfc/rfc7386.html)
> (`application/merge-patch+json`). Express contributes only the routing and
> `express.json()`; it has no opinion on any of this, and no built-in support for either
> format. Everything about bulk endpoints below is **design guidance** — HTTP has no
> standard for batch operations, which is precisely the problem this page describes.

## PUT vs PATCH, in one table

| | PUT | PATCH |
|---|---|---|
| Body means | The **complete** new representation | A **description of changes** |
| Omitted field | Cleared — it is not in the new representation | Untouched |
| Idempotent | **Yes**, by specification | **Not necessarily** — depends on your format |
| Typical use | Replace a whole document | Change one or two fields |

The omitted-field row is where data gets destroyed. A client that GETs a resource,
edits one field, and PUTs back a body built from an older read will silently clear
every field added since. PATCH avoids that by saying nothing about what it does not
mention.

## Choosing a patch format — and saying which one

The most common implementation is "send the fields you want to change":

```http
PATCH /users/42
Content-Type: application/merge-patch+json

{"displayName": "Ada"}
```

That is **JSON Merge Patch** (RFC 7386), and it is a fine default. Its one real
limitation is a consequence of its simplicity: **`null` means delete**, so it
cannot distinguish "set this field to null" from "remove this field", and it
cannot address array elements at all — a merge patch replaces an array wholesale.

**JSON Patch** (RFC 6902) is the explicit alternative:

```http
PATCH /orders/7
Content-Type: application/json-patch+json

[
  {"op": "replace", "path": "/status", "value": "paid"},
  {"op": "add", "path": "/tags/-", "value": "priority"},
  {"op": "test", "path": "/version", "value": 3}
]
```

It addresses array positions, distinguishes `add` from `replace`, and has a `test`
op that turns the whole document into a conditional write — a lightweight
alternative to `If-Match` ([page 07](07-etag-and-cache.md)). It costs a real
implementation and a body most humans cannot read at a glance.

**Whichever you pick, name it in `Content-Type` and document it.** The genuinely
bad outcome is an endpoint that accepts `{"status": "paid"}` and is described
nowhere — clients then guess whether `null` deletes, whether arrays merge, and
whether omitting a field clears it. That guessing is the actual cost of not
choosing.

## Is your PATCH idempotent?

It depends entirely on what the operations do:

```json
{"status": "paid"}                             ← idempotent: same result every time
[{"op": "add", "path": "/tags/-", "value": "x"}]  ← NOT: appends every time
{"op": "increment", "path": "/views"}          ← NOT: a counter, by definition
```

Field-setting merge patches are idempotent in practice, which is why most APIs get
away without thinking about it. The moment a patch appends to an array or adjusts
a number relatively, retries change the outcome — and that endpoint needs an
[idempotency key](06-idempotency-keys.md) exactly as a POST would.

## Bulk endpoints: one request, many outcomes

HTTP status codes describe **one** result. A request that creates fifty resources
where three fail has no honest single code — 200 hides the failures, 400 hides the
successes, and 500 is a lie.

Two workable shapes, and the choice is about atomicity:

**All-or-nothing.** Wrap it in a transaction; any failure rolls back everything.
The status code is then honest — 201 or 400 — because there really is one outcome.
Simple to reason about, and the right default for related changes.

**Per-item results.** Process independently and return a document describing each:

```http
HTTP/1.1 207 Multi-Status
Content-Type: application/json

{
  "results": [
    {"index": 0, "status": 201, "id": "ord_1"},
    {"index": 1, "status": 409, "error": {"code": "DUPLICATE"}},
    {"index": 2, "status": 201, "id": "ord_3"}
  ]
}
```

`207 Multi-Status` comes from WebDAV ([RFC 4918](https://www.rfc-editor.org/rfc/rfc4918.html))
and is the closest thing HTTP offers; a plain `200` with the same body is equally
defensible as long as it is documented. **What matters is that each item carries
its own status and its own error code**, so a client can retry exactly the three
that failed.

Whichever shape you choose, **cap the batch size** and validate the whole array
before executing any of it — the same reasoning as `limit` on
[pagination](03-pagination/README.md). An uncapped bulk endpoint is a denial-of-service
primitive with a friendly name.

## Trade-off

Bulk endpoints exist because N round trips are slow and, without them, clients
invent their own parallelism and hammer you harder. They buy real latency wins for
clients that genuinely have batches.

They cost you the properties that make a REST API easy to operate: one status per
request, per-resource authorisation that is obvious in the URL, cache keys that
mean something, and logs where one line is one operation. A partial failure is
also a support burden — "did it work?" now has a per-item answer that someone must
read.

**Add them when a measured client pattern demands it**, not because the API feels
incomplete without them. HTTP/2 multiplexing has already removed much of the round-trip
argument.

## Gotchas

**Symptom:** A PUT wipes fields the client never intended to touch  
**Cause:** PUT replaces the whole representation; the client sent a body built from a
stale read  
**Fix:** Use PATCH for partial updates, and require `If-Match` on PUT so a stale write
is rejected rather than applied

**Symptom:** Clients cannot set a field to `null`  
**Cause:** JSON Merge Patch treats `null` as delete — the two are indistinguishable  
**Fix:** Use JSON Patch where the distinction matters, or a sentinel documented for
that field

**Symptom:** Retrying a PATCH doubles a value or duplicates a tag  
**Cause:** The patch is relative (`add` to an array, increment a counter), so it is not
idempotent  
**Fix:** Treat those endpoints like POSTs — idempotency keys, or redesign to set an
absolute value

**Symptom:** A bulk request returns 200 and the client believes everything succeeded  
**Cause:** Per-item failures buried in a body nobody inspects  
**Fix:** Per-item statuses in the response, and document that the top-level code says
nothing about individual items

**Symptom:** One enormous bulk request exhausts memory or the connection pool  
**Cause:** No cap on array length, and the `100kb` body limit raised without a new bound  
**Fix:** Cap the item count explicitly and reject oversized batches with 413 or 400

**Symptom:** Half a batch applied and the client cannot tell which half  
**Cause:** Non-transactional processing with no per-item result  
**Fix:** Pick one — transactional all-or-nothing, or per-item results. The middle is
unusable

## Interview questions

**★ PUT versus PATCH?**
PUT replaces the entire representation — anything omitted is cleared — and is
idempotent by specification. PATCH describes a change, leaves unmentioned fields
alone, and is not idempotent in general.

**★ Which patch formats are standardised, and how do they differ?**
JSON Merge Patch (RFC 7386) — send the fields you want changed, where `null` means
delete and arrays are replaced wholesale. JSON Patch (RFC 6902) — an explicit list of
ops with paths, able to address array positions and carrying a `test` op for
conditional writes.

**★ Why is JSON Merge Patch unable to set a field to null?**
Because `null` is its delete signal. There is no way to express "the value is
literally null" — that is the price of its simplicity, and the main reason to reach
for RFC 6902.

**★ What status code should a bulk request return when some items fail?**
There is no honest single code, which is the whole problem. Either make it
transactional so there genuinely is one outcome, or return per-item statuses —
`207 Multi-Status`, or a documented `200` with a results array. Never a bare 200 with
failures hidden in the body.

**Is PATCH idempotent?**
Only if your operations are. Setting fields is; appending to an array or incrementing
a counter is not — and those endpoints need idempotency keys like any POST.

**When should you add a bulk endpoint?**
When a measured client pattern needs it. They cost per-request statuses, clean
authorisation, useful cache keys and one-line-per-operation logs — real losses that
should be paid for by a real gain.

---

← Prev: [Webhooks](09-webhooks.md) · Next → [Hypermedia](11-hypermedia.md)
