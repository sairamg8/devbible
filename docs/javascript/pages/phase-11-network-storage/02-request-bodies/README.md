---
title: "02 · Request bodies"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using FormData Objects](https://developer.mozilla.org/en-US/docs/Web/API/FormData/Using_FormData_Objects), [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch), [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams). Documentation-validated.

**The body type decides the `Content-Type` — and for two of them the browser decides it for
you, so setting it yourself breaks the request.**

| Body | `Content-Type` | Set it yourself? |
|---|---|---|
| `JSON.stringify(obj)` | `application/json` | **yes** |
| `FormData` | `multipart/form-data; boundary=…` | 🔴 **never** |
| `URLSearchParams` | `application/x-www-form-urlencoded` | no |
| `Blob` / `File` | the blob's `type` | usually no |

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Choosing a body](./01-choosing-a-body.md)** | Why a string body needs its header set by hand (the "works in Postman" failure); MDN's direct warning against setting `Content-Type` for `FormData` and **why the boundary is the point**, including the shared-wrapper version of the bug; `URLSearchParams` for file-free posts; `Blob`/`File`; and the two constraints — `GET` cannot have a body, and a `Request` body is **read-once** |

## The three sentences to keep

1. **A string body is not labelled for you.** JSON needs its header.
2. **Never set `Content-Type` for `FormData`** — you destroy the boundary, and the server
   reports an empty form rather than a header problem.
3. **A wrapper that always sets `application/json` breaks every upload.**

## Phase gate

You are done with this topic when you can name which body types set their own header, explain
the boundary and why a manual header defeats it, and say why a retried `Request` sends nothing.

## Where this connects

- [01 · `fetch`](../01-fetch/README.md) — the read-once body rule, on the response side
- [Phase 5 · 09 · JSON](../../phase-5-built-in-library/09-json/README.md) — what `JSON.stringify` silently drops

---

Start → [01 · Choosing a body](./01-choosing-a-body.md)
