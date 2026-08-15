---
title: "19 · Streams"
sidebar_label: "Overview"
sidebar_position: 19
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API), [Using readable streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams), [`TransformStream`](https://developer.mozilla.org/en-US/docs/Web/API/TransformStream). Documentation-validated; **no timings**.

**Three interfaces — `ReadableStream`, `WritableStream`, `TransformStream` — and one idea:
move data in chunks so memory stays bounded and work can start before the data has finished
arriving.**

🔴 **Know-tier: recognise the shape and the two rules.** Reading **locks** the stream (which
is why a body is read once), and **backpressure lives in `pull` plus `highWaterMark`** — the
mechanism a WebSocket has no equivalent of.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The three streams](./01-the-three-streams.md)** | Reading with `for await…of` and `getReader()`, and 🔴 **the reader lock**; `pipeThrough`/`pipeTo` and why they beat a manual loop; writing your own source and 🔴 **`pull` as backpressure**; `close` vs `cancel` vs `releaseLock` vs `tee()`; and the free transforms — `TextDecoderStream`, `CompressionStream`, `Blob.stream()` |

## The shape in six lines

```js
await response.body
  .pipeThrough(new DecompressionStream("gzip"))
  .pipeThrough(new TextDecoderStream())
  .pipeTo(sink);                     // errors and cancellation propagate both ways

for await (const chunk of blob.stream()) { … }   // bounded memory, whatever the size
```

## Phase gate

You are done with this topic when you can say **why a response body can only be read once**,
and **where backpressure lives in a `ReadableStream`**.

## Where this connects

- [07 · 02 · Streaming a body](../07-reading-responses/02-streaming-a-body.md) — the reader loop, download progress and cancellation, at Understand depth
- [12 · `Blob`, `File` and object URLs](../12-blob-file-filereader/README.md) — `blob.stream()`, the way to process a huge file
- [13 · 02 · WebSocket messaging](../13-websocket/02-messaging.md) — the API with **no** inbound backpressure, which is what this one has
- [Phase 5 · 26 · Text encoding](../../phase-5-built-in-library/26-text-encoding/README.md) — why chunk-boundary decoding needs a stateful decoder
- [Phase 7 · 22 · Async work and backpressure](../../phase-7-async/22-backpressure.md) — the general idea

---

Start → [1 · The three streams](./01-the-three-streams.md)
