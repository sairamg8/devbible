---
title: "01 · fetch"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch), [`Response.ok`](https://developer.mozilla.org/en-US/docs/Web/API/Response/ok), [`Response.clone()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/clone). Documentation-validated.

**A 404 is a successful `fetch`.** The promise answers *"did the HTTP exchange happen?"*, not
*"did it go well?"*

> "if the server responds with an error like `404`, then `fetch()` **fulfills** with a
> `Response`, so we have to check the status before we can read the response body." — MDN

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The critical surprise](./01-the-critical-surprise.md)** | Why a 404 fulfils and what that does to a `try`/`catch`; checking `response.ok`, reading the error body, and throwing a typed error; **what actually rejects** and why `TypeError: Failed to fetch` is deliberately uninformative; the defaults you inherit — especially `credentials: "same-origin"`, which sends no cookies cross-origin; and the body being a **stream you can read once**, with `clone()` |

## The three sentences to keep

1. **Only network-level failures reject.** 4xx and 5xx fulfil — check `response.ok` yourself.
2. **`TypeError: Failed to fetch` means CORS, offline, or blocked.** The detail is in the
   console by design.
3. **The body reads once.** Clone before the first read if anything else needs it.

## Phase gate

You are done with this topic when you can say exactly what makes `fetch` reject, write the
`!res.ok` guard without thinking, explain why a cross-origin authenticated request 401s, and
say why a logging wrapper must clone.

## Where this connects

- [Phase 7 · 08 · Error handling in async code](../../phase-7-async/08-error-handling/README.md) — the `try`/`catch` this behaviour defeats
- [Phase 8 · 03 · `Error` and its subclasses](../../phase-8-modules-errors/03-error-and-subclasses/README.md) — the typed error to throw on `!ok`

---

Start → [01 · The critical surprise](./01-the-critical-surprise.md)
