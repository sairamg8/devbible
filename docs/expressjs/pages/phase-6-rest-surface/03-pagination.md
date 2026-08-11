---
title: "Pagination"
sidebar_label: "03 · Pagination"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**Always cap `limit`. Prefer cursor pagination for large or volatile lists; offset is simpler and drifts.**

## Offset

```http
GET /items?limit=20&offset=40
```

Easy, slow on deep pages, unstable if rows insert while paging.

## Cursor

```http
GET /items?limit=20&cursor=eyJpZCI6MTIzfQ
```

Stable for infinite scroll; opaque cursors hide storage details. Encode nothing
sensitive without signing/encrypting.

## Rules

1. Default `limit` (e.g. 20) and **max** (e.g. 100)  
2. Return `nextCursor` / `hasMore` consistently  
3. Never allow `limit=999999`

## Interview questions

**★ Why cap limit?**  
Protects DB and API CPU from accidental or malicious full-table pulls.

**Offset vs cursor trade-off?**  
Offset: simple, deep-page pain. Cursor: stable, more implementation work.


---

← Prev: [Status mapping](02-status-mapping.md) · Next → [Filter sort search](04-filter-sort-search.md)
