---
title: "Idempotency keys"
sidebar_label: "06 · Idempotency keys"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

**Clients retry POSTs. Without an idempotency key you double-charge. Store the first response and replay it.**

## Flow

1. Client sends `Idempotency-Key: <uuid>` on unsafe requests  
2. Server stores key → response (status + body) under a TTL  
3. Replay returns the same result without re-executing side effects  

Keys are **HTTP API product** concerns. Job idempotency is Node Phase 7 — related,
different layer.

## Gotchas

**Symptom:** Same key, different body  
**Cause:** Client bug or attack  
**Fix:** Reject with 409 if payload hash mismatches stored request

## Interview questions

**★ Which methods need idempotency keys most?**  
POST (and some PATCH) that create side effects; GET/PUT are already idempotent by design when implemented correctly.


---

← Prev: [Versioning](05-versioning.md) · Next → [ETag and Cache-Control](07-etag-and-cache.md)
