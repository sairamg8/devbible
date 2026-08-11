---
title: "Webhooks"
sidebar_label: "09 · Webhooks"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

**Inbound: raw body + signature + timestamp skew. Outbound: enqueue, return 202 — do not await the remote world on the request thread.**

## Receive

1. `express.raw` on the webhook path (Phase 3)  
2. Verify HMAC (or provider scheme) with `crypto.timingSafeEqual`  
3. Reject old timestamps (replay window)  
4. Persist event id for dedupe  
5. Enqueue work; respond quickly  

## Deliver

Fire-and-forget from the route is a bug under load. Use Node Phase 7 jobs;
Express only accepts the command and returns **202**.

## Interview questions

**★ Why raw body for verification?**  
Signature is over exact bytes, not re-serialized JSON.


---

← Prev: [OpenAPI](08-openapi.md) · Index: [Phase 6](README.md)
