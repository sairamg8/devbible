---
title: "REST resource modeling"
sidebar_label: "01 · REST resources"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Resources are nouns. Collections are lists of them. Prefer `/orders/12/items` over `/getOrderItems`.**

## Modeling

| Style | Example | When |
|---|---|---|
| Collection | `GET /users` | List + create (`POST /users`) |
| Item | `GET /users/:id` | Read/update/delete one |
| Sub-resource | `/users/:id/orders` | Owned hierarchy |
| Action (RPC) | `POST /payments/:id/refund` | Verb is the product |

RPC-style routes are fine when the domain is an action, not a thing — name them
honestly instead of inventing fake nouns.

## Trade-off

Deep hierarchies mirror the domain and complicate authorization and caching.
Flatten when joins explode.

## Gotchas

**Symptom:** `/users/export` captured by `:id`  
**Cause:** Route order (Phase 1)  
**Fix:** Static segments first

## Interview questions

**★ Collection URL for creating a user?**  
`POST /users` (or your versioned mount), not `POST /createUser` unless you chose RPC deliberately.

**When is RPC-style acceptable?**  
Multi-step operations that are not natural CRUD on a single resource.


---

← Index: [Phase 6](README.md) · Next → [Status mapping](02-status-mapping.md)
