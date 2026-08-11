---
title: "Filtering, sorting, search"
sidebar_label: "04 · Filter · sort · search"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**Allow-list fields and operators. Never pass raw `req.query` into Mongo or SQL builders.**

## Safe pattern

```js
const SORTABLE = new Set(['createdAt', 'name']);
const sort = SORTABLE.has(req.query.sort) ? req.query.sort : 'createdAt';
```

Search endpoints that hit full-text indexes belong behind explicit `q` params and
timeouts — do not run unbounded scans on the request thread (Node event loop).

## Gotchas

**Symptom:** `?filter[$gt]=…` operator injection in Mongo  
**Cause:** Merging query objects blindly  
**Fix:** Allow-list + Node Phase 6 parameterized queries

## Interview questions

**★ Why allow-list sort fields?**  
Prevents sorting on unindexed or sensitive columns and injection-style operators.


---

← Prev: [Pagination](03-pagination.md) · Next → [Versioning](05-versioning.md)
