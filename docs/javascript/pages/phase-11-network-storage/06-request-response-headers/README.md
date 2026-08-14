---
title: "06 · `Request`, `Response` and `Headers`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response), [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request), [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers), [`Response.clone()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/clone). Documentation-validated; **no timings**.

The syllabus row is *constructing them directly, cloning, and why a body can only be read once* —
the three objects `fetch` is built from. Knowing them turns `fetch` from a function you call into a
protocol you can intercept, fake and reuse.

🔴 **The rule that catches everyone: the body is a stream, so it reads once.** `clone()` before the
first read, or read once and keep the value.

## Chunk

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The three objects](./01-the-three-objects.md)** | Building a `Request` and copying one with changes, every `Response` property (including `ok` and opaque responses), the static constructors, the six body readers and single use, `clone()` and what it costs, and `Headers` — case-insensitivity, `append` versus `set`, `getSetCookie`, exposed and forbidden headers |

## Three facts worth carrying out of this topic

- **`res.json()` throws on an empty body.** A 204 or an empty error response breaks any wrapper
  that calls it unconditionally — read `text()` and parse when non-empty.
- **Header names are case-insensitive**, and `append` adds where `set` replaces.
- **A `Request` body is single-use too**, so a retry must clone or rebuild it.

## Phase gate

You can write a `fetch` wrapper with timeout, error handling and JSON parsing, and explain what
CORS is doing when a request fails.

## Where this connects

- [01 · `fetch`](../01-fetch/README.md) — where the "a 404 does not reject" rule comes from
- [03 · A `fetch` wrapper worth reusing](../03-fetch-wrapper/README.md) — the place all of this
  lands in real code
- [05 · CORS from the client side](../05-cors-client-side/README.md) — why some response headers
  are invisible, and what an opaque response is
- **07 · Reading responses** *(not written yet)* — the body readers in depth, including streaming

---

Start → [01 · The three objects](./01-the-three-objects.md)
