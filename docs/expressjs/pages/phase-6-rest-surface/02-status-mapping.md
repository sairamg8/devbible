---
title: "HTTP status mapping"
sidebar_label: "02 · Status mapping"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Map create/read/update/delete to the status codes clients and caches understand.**

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

## Gotchas

**Symptom:** Everything returns 200  
**Cause:** Envelope-only APIs  
**Fix:** Real statuses; body for details

## Interview questions

**★ Why 201 on create?**  
Signals a new resource; pairs with `Location` when useful.

**Is DELETE always 204?**  
204 if no body; 200 if you return the deleted representation — pick one style.


---

← Prev: [REST resources](01-rest-resources.md) · Next → [Pagination](03-pagination.md)
