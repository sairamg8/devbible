---
title: "When REST stops fitting"
sidebar_label: "02 · When REST stops fitting"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Some operations are not CRUD on a noun. Forcing them into that shape produces
URLs that need decoding — `POST /orders/7/cancellation` for what is plainly
"cancel order 7". Name them honestly and move on.**

> Verified: 2026-08-14 — **not an Express question**, and no sandbox run backs
> this page. Method semantics (safe, idempotent, cacheable) are
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §9.2; `QUERY` appears in
> Node's `METHODS` list and in the Express
> [routing guide](https://expressjs.com/en/guide/routing.html)'s verb list, read
> from `require('node:http').METHODS` in
> [Phase 1 · 01 · chunk 01](../../phase-1-routing/01-http-methods/01-the-verb-table.md).
> **Everything else here is this bible's guidance**, stated as such — Express
> enforces no naming and REST prescribes no answer to most of it.

## Five shapes that are not CRUD

**1 · An action on a resource.**

```text
POST /orders/7/cancel          ✅ says what it does
POST /orders/7/cancellation    ⚠️ a fake noun for the same thing
PUT  /orders/7  {status: 'cancelled'}   ⚠️ hides a workflow behind a field write
```

The third is the one worth arguing about, because it *looks* RESTful. Setting
`status` to `cancelled` through a generic update means the client is driving a
state machine through a field, and every validation about *which* transitions are
legal has to live inside the update handler. **A dedicated action route makes the
transition explicit**, gives it its own authorization check, and lets it return
its own errors — `409 ORDER_ALREADY_SHIPPED` rather than a field-level validation
message.

**Prefer an action route when the operation has preconditions, side effects
beyond the record, or its own permission.** A refund sends money; a password
reset sends an email; a re-index queues work. None of those is a field write.

**2 · A search too complex for a query string.**

```text
GET  /orders?status=open&created_after=2026-01-01     ✅ simple filters
POST /orders/search   {…a real query…}                ✅ when it stops being simple
```

A `POST` for a read is unpleasant — it is neither safe nor cacheable, so
intermediaries cannot help — and it is the honest choice once the query needs
nesting, boolean logic or a payload that will not fit in a URL. It also keeps
sensitive terms out of access logs, CDN logs and `Referer` headers
([Phase 1 · 02 · chunk 03](../../phase-1-routing/02-params-and-query/03-shape-and-trust.md)).

Worth knowing: **`QUERY` is a real HTTP method** — a safe, idempotent read that
carries a body — and Express generates `app.query` for it because Node's
`METHODS` list includes it. It is the shape this case wants; adoption across
clients and intermediaries is the reason most APIs still use `POST /search`.

**3 · A singleton.** `/me`, `/settings`, `/health`. A collection of one is a
fiction; `/users/me/settings/1` helps nobody. Name the singleton and give it
`GET` and `PATCH`.

**4 · Bulk operations.** `POST /orders/bulk` or `PATCH /orders` with a list.
There is **no honest status code** for "three succeeded and two failed" — the
choices are `207 Multi-Status` (RFC 4918, from WebDAV) or a documented 200 with
per-item statuses ([Phase 6 · 10](../10-patch-and-bulk.md)). Whichever you pick,
cap the batch size: the byte limit says nothing about the row count
([Phase 3 · 03 · chunk 03](../../phase-3-requests/03-size-limits/03-what-it-does-not-protect.md)).

**5 · Relationships as things.** Sometimes the *link* is the resource:

```text
PUT    /users/42/roles/admin      grant
DELETE /users/42/roles/admin      revoke
```

This is genuinely RESTful and often overlooked in favour of an action route. It
is better here because both operations are **idempotent** — granting a role twice
is granting it once — which `POST /users/42/grant-role` is not.

## Choosing between an action and a sub-resource

The test that decides it, in order:

1. **Is the operation idempotent?** If yes, a `PUT`/`DELETE` on a sub-resource is
   available and better — clients may retry it safely
   ([Phase 1 · 01 · chunk 03](../../phase-1-routing/01-http-methods/03-405-and-method-semantics.md)).
2. **Does it produce a thing you would want to list or fetch later?** A refund
   is a record; `POST /payments/7/refunds` returning `201` with a `Location` is
   then the right shape, and `GET /payments/7/refunds` follows naturally.
3. **Otherwise, name the verb.** `POST /orders/7/cancel`. It is a `POST` because
   it is neither safe nor idempotent, and needs an idempotency key if retries are
   expected ([Phase 6 · 06](../06-idempotency-keys.md)).

Note how often step 2 turns an apparent action into a resource. "Refund",
"invitation", "export", "session" all look like verbs and are all things with a
lifecycle — and modelling them as resources gives you the list endpoint, the
status field and the audit trail for free.

## What you give up by going RPC

Being clear-eyed about the cost, because "just use RPC" is as lazy as forcing
every verb into a noun:

- **Guessability.** A client that has used `/orders` can predict `/invoices`. It
  cannot predict `/orders/7/cancel` — that has to be documented and read.
- **Uniform tooling.** Generic REST clients, admin scaffolds and some code
  generators assume the CRUD shape.
- **Cacheability.** A `POST` is not cacheable, so a `POST /search` gives up
  intermediary caching that a `GET` would have had.
- **Method semantics as a contract.** `PUT` tells every client "retry is safe".
  `POST /cancel` does not, so you must supply idempotency yourself.

The rule this bible uses: **use nouns wherever the operation really is CRUD, and
stop pretending when it is not.** A payment refund, a password reset and a batch
re-index are actions; naming them as fake resources helps nobody. But apply the
two-step test first, because many "actions" are resources you have not named yet.

## Trade-off

REST purity buys predictability and generic tooling; honest naming buys
readability and precise semantics. The two conflict only at the edges, and the
edges are where all the arguments happen.

**The position that holds up: be strict in the middle and pragmatic at the
edges.** Ninety percent of an API is CRUD on nouns, and there is no excuse for
irregularity there. The remaining ten percent — the workflows, the searches, the
bulk operations — should be *few*, *named clearly*, and *documented explicitly*,
rather than smuggled in as clever resource modelling.

The failure mode to avoid is the middle position: an API that is *almost*
resource-shaped, with three endpoints that are not and no stated rule about which
is which. Clients then cannot guess anything, and you have paid REST's cost
without its benefit.

## Gotchas

**Symptom:** A generic `PUT /orders/:id` lets a client set `status: 'shipped'`
directly
**Cause:** A state machine driven through a field write
**Fix:** An explicit transition route with its own preconditions, permission and
error codes. Keep `status` read-only in the update schema

**Symptom:** A search endpoint's URL exceeds a proxy's length limit
**Cause:** A complex query encoded in the query string
**Fix:** `POST /orders/search` with a JSON body — accepting the loss of
cacheability — and validate it with the same schema machinery as any other body

**Symptom:** Customer emails appear in CDN and access logs
**Cause:** They were search terms in a query string
**Fix:** Move the lookup to a request body

**Symptom:** Retrying a failed "grant role" call creates a duplicate
**Cause:** It was modelled as `POST /users/42/grant-role`, which is not idempotent
**Fix:** `PUT /users/42/roles/admin` — the relationship as a resource, which is
idempotent by construction

**Symptom:** A bulk endpoint returns 200 and clients treat partial failure as
success
**Cause:** No honest status exists for mixed outcomes, and the default was chosen
by accident
**Fix:** Decide deliberately — 207, or a documented 200 with per-item statuses —
and say so in the OpenAPI document

**Symptom:** The API is "REST-ish" and clients look up every endpoint
**Cause:** A few unexplained non-resource routes with no stated rule
**Fix:** Write the rule down: nouns for CRUD, named verbs for the listed
exceptions. Predictability comes from the rule, not from purity

## Interview questions

**★ When is an RPC-style route the right answer?**
When the operation is not CRUD on a single resource — it has preconditions, side
effects beyond the record, or its own permission. A refund, a password reset, a
re-index. Forcing those into fake nouns produces URLs that have to be decoded.

**★ How do you decide between `POST /orders/7/cancel` and a sub-resource?**
Two questions first. Is it idempotent — if so, `PUT`/`DELETE` on a sub-resource
is better, because clients may retry safely. Does it produce something you would
list or fetch later — if so, it is a resource you have not named yet
(`POST /payments/7/refunds`). Only if both are no, name the verb.

**★ What is wrong with driving a state machine through `PUT`?**
Every rule about which transitions are legal ends up inside a generic update
handler, the transition has no permission of its own, and the failure is a
field-level validation message rather than a `409` with a meaningful code. An
explicit route makes all three explicit.

**★ Why is `POST /search` sometimes right despite being a read?**
Because a complex query does not fit in a URL, and a body gets validated by the
same machinery as any other body and stays out of access logs, CDN logs and
`Referer` headers. The cost is real: a `POST` is neither safe nor cacheable.
`QUERY` is the method designed for this, and adoption is why most APIs still use
`POST`.

**What do you lose by going RPC?**
Guessability, generic tooling, cacheability for reads, and method semantics as a
retry contract. That is why the rule is strict in the middle and pragmatic at the
edges — not pragmatic everywhere.

**What is the worst position to end up in?**
"Almost REST": mostly resource-shaped with a few unexplained exceptions and no
stated rule. Clients cannot guess anything, so you pay REST's cost without
getting its benefit.

---

← Prev: [Nouns, collections, items](01-nouns-collections-items.md) · Index: [REST resources](README.md) · Next → [Designing a resource surface](03-designing-a-surface.md)
