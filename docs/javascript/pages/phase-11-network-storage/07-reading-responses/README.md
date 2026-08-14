---
title: "07 · Reading responses"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Response.json()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/json), [`Response.blob()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/blob), [`Response.body`](https://developer.mozilla.org/en-US/docs/Web/API/Response/body), [Using readable streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams), [`TextDecoderStream`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream). Documentation-validated; **no timings**.

The syllabus row is *`json`, `text`, `blob`, `arrayBuffer`, `formData`, and streaming a body as it
arrives* — six ways to buffer the whole thing, and one way not to.

🔴 **The one-line rule:** choose by **what the data will become**, not by what it looks like. And
`json()` is the wrong default for a wrapper, because it rejects on an empty body.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The body readers](./01-the-body-readers.md)** | The six methods and what each is for, why wrappers read `text()` and parse, object URLs and revoking them, binary via `arrayBuffer`/`bytes`, and the errors each reader throws |
| 02 | **[Streaming a body](./02-streaming-a-body.md)** | The reader loop and `Uint8Array` chunks, `TextDecoderStream` and why per-chunk decoding corrupts text, newline-delimited JSON, download progress and when `Content-Length` lies, cancellation, and when not to stream |

## Three facts worth carrying out of this topic

- **`json()` rejects on an empty body**, and ignores `Content-Type` — which is why an HTML error
  page reads as `Unexpected token '<'`.
- **`fetch` resolves on headers**, so a connection dropping mid-body fails at the *read*, not the
  fetch.
- **Never decode stream chunks individually** — a multi-byte character straddling a boundary is
  corrupted. `TextDecoderStream` exists for exactly that.

## Phase gate

You can write a `fetch` wrapper with timeout, error handling and JSON parsing, and explain what
CORS is doing when a request fails.

## Where this connects

- [06 · `Request`, `Response` and `Headers`](../06-request-response-headers/01-the-three-objects.md)
  — why the body reads only once, and `clone()`
- [03 · A `fetch` wrapper worth reusing](../03-fetch-wrapper/README.md) — where the defensive
  `text()`-then-parse shape belongs
- [01 · `fetch`](../01-fetch/README.md) — the "a 404 does not reject" rule these readers sit on top
  of
- **08 · Aborting and timing out** *(not written yet)* — `AbortController`, which cancels the
  request and its stream together

---

Start → [01 · The body readers](./01-the-body-readers.md)
