---
title: "Idempotency keys"
sidebar_label: "06 · Idempotency keys"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

**Clients retry POSTs. Without an idempotency key you double-charge. Store the first response and replay it.**

> Verified: 2026-08-14 — **no sandbox run**. `Idempotency-Key` is **not yet a standard**:
> it is an IETF HTTPAPI working-group Internet-Draft,
> [draft-ietf-httpapi-idempotency-key-header](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07),
> at **version 07** (published 15 Oct 2025, intended status Standards Track). Checked
> 2026-08-14 — treat the header name as an emerging convention that major payment APIs
> already use, not as something you can cite an RFC number for.
> What *is* settled: [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) makes GET,
> HEAD, PUT and DELETE idempotent and POST not — which is the entire reason this
> mechanism exists. Express contributes nothing here; there is no built-in support.

## Flow

1. Client sends `Idempotency-Key: <uuid>` on unsafe requests  
2. Server stores key → response (status + body) under a TTL  
3. Replay returns the same result without re-executing side effects  

Keys are **HTTP API product** concerns. Job idempotency is Node Phase 7 — related,
different layer.

## The race is the hard part

The three-step flow above is correct and incomplete. Written naively it has a
window that a retrying client will find, because retries arrive *concurrently*
with the original — that is what a timeout means.

```text
request A: look up key → miss → start charging …
request B: look up key → MISS  → start charging …   ← both charge
```

Checking then inserting is two operations, and anything can happen between them.
The fix is to make **claiming the key** a single atomic step:

1. **Insert the key first**, with a unique constraint, in state `in_progress`.
2. If the insert **fails on conflict**, this is a duplicate. Read the stored row:
   - state `completed` → replay the stored status and body;
   - state `in_progress` → the original is still running. Answer **409**, and let
     the client retry later. Do not wait, and do not execute.
3. Do the work, then update the row to `completed` with the response.

The database's unique constraint is doing the mutual exclusion. Anything softer —
a check-then-set in application code, a Redis `GET` followed by `SET` — reintroduces
the window it was meant to close.

**Store the key and the side effect in one transaction** where you can. If the
charge commits and the key write fails, the retry charges again, which is the exact
failure the mechanism exists to prevent.

## What the stored record has to hold

| Field | Why |
|---|---|
| The key | Scoped per **client**, never global — otherwise one caller's UUID collides with another's |
| Request fingerprint | A hash of method + path + body, to detect the same key used for a different request |
| State | `in_progress` / `completed`, for the race above |
| Status + body | So the replay is byte-identical, not recomputed |
| Created-at | For the TTL |

**Scoping matters more than it looks.** Keys are client-generated UUIDs; two
tenants can and eventually will send the same one. Key the record on
`(client_id, idempotency_key)`.

## TTL, and what expiry means

Records cannot live forever, and the expiry window is a real decision: it is how
long a retry is still recognised as a retry. Too short and a client retrying after
a long outage double-charges; too long and the store grows without bound. **24
hours is the common choice**, and it should be longer than your clients' maximum
retry window — which means you have to know what that is.

After expiry, a replayed key looks like a new request. That is unavoidable; it is
why the window should be documented in your API docs rather than left implicit.

## Trade-off

Idempotency keys turn "did my payment go through?" from an unanswerable question
into a mechanical one, and they are close to mandatory for anything financial. The
cost is a storage layer on the write path — an extra round trip before every unsafe
request, a table that grows with traffic, and a state machine that must be right or
it makes things worse.

They are also only as good as the client. A client that generates a fresh key per
*attempt* rather than per *operation* gets no protection at all, and this is the
single most common implementation mistake. **Document that the key belongs to the
operation, not the request**, and say it twice.

## Gotchas

**Symptom:** Same key, different body  
**Cause:** Client bug or attack  
**Fix:** Reject with 409 if payload hash mismatches stored request

**Symptom:** Two concurrent retries both execute  
**Cause:** Check-then-insert instead of an atomic claim  
**Fix:** Insert the key with a unique constraint *first*; treat a conflict as the
duplicate signal

**Symptom:** Duplicate charges despite keys being stored  
**Cause:** The side effect committed but the key record did not — two separate
transactions  
**Fix:** Write the key and the effect in one transaction, or use the effect's own row
as the key record

**Symptom:** Clients get no protection at all  
**Cause:** The client generates a new UUID for each retry attempt  
**Fix:** Documentation, loudly: one key per *operation*, reused across every attempt of
that operation

**Symptom:** One tenant's key collides with another's  
**Cause:** Keys stored globally  
**Fix:** Scope on `(client, key)`. Client-generated UUIDs are not a global namespace

**Symptom:** A retry during a long-running original returns a partial result  
**Cause:** The `in_progress` state was ignored  
**Fix:** 409 while in progress. Never execute and never block

## Interview questions

**★ Which methods need idempotency keys most?**  
POST (and some PATCH) that create side effects; GET/PUT are already idempotent by design when implemented correctly.

**★ Two retries of the same request arrive at once. How do you stop both executing?**  
Claim the key atomically — insert it with a unique constraint before doing any work,
and treat the conflict as "this is a duplicate". Check-then-insert leaves a window
that concurrent retries hit, and concurrency is exactly what a timeout produces.

**★ The charge succeeded but the key record failed to save. What happens next, and how do you prevent it?**  
The retry charges again — the failure the whole mechanism exists to prevent. Prevent
it by writing the key and the side effect in a single transaction.

**Why scope keys per client?**  
Keys are client-generated UUIDs, so they are not a shared namespace. Global storage
means one tenant's key can shadow another's, and the second caller silently receives
the first caller's response.

**Is `Idempotency-Key` a standard?**  
Not yet — it is an IETF Internet-Draft (httpapi working group, version 07 as of late
2025) on the Standards Track. Widely used by payment APIs, but cite it as a
convention, not an RFC.

**What should a retry receive while the original is still running?**  
409, immediately. Blocking ties up a connection for an unknown duration, and executing
defeats the purpose.


---

← Prev: [Versioning](05-versioning.md) · Next → [ETag and Cache-Control](07-etag-and-cache.md)
