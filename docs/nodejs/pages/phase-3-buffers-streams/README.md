---
title: "Phase 3 — Buffers and streams"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target runtime: Node 24 — the Active LTS as of August 2026.**
> Every example on these pages was executed on **Node 24.19.0**, including every
> timing, RSS figure and error message.

**Complete — all 19 pages written.**

The bytes half of Node. Phase 2 was about *when* code runs; this phase is about
*what moves through it*. Two ideas carry the whole phase: a Buffer is raw bytes
outside the V8 heap, and a stream keeps memory constant no matter how much data
arrives.

## Binary data

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Buffer basics](01-buffer-basics.md)** | <span className="db-tier t-master">Master</span> | Bytes, not characters — and `subarray` shares memory |
| 02 | **[Encodings](02-encodings.md)** | <span className="db-tier t-understand">Understand</span> | Eight names, three lossless, and the +33% that breaks your size limit |
| 03 | **[alloc vs allocUnsafe](03-alloc-vs-allocunsafe.md)** | <span className="db-tier t-understand">Understand</span> | 20× faster, and it handed back a previous request's password 44% of the time |
| 04 | **[Buffer is a Uint8Array](04-buffer-as-uint8array.md)** | <span className="db-tier t-understand">Understand</span> | Every Web API takes one — and `slice()` means the opposite thing |
| 05 | **[string_decoder](05-string-decoder.md)** | <span className="db-tier t-understand">Understand</span> | Why `chunk.toString()` corrupts text only in production |
| 06 | **[Binary data and endianness](06-binary-data-and-endianness.md)** | <span className="db-tier t-when">When Needed</span> | Length-prefixed framing, and the length field an attacker controls |

## Streams — the core

| # | Page | Tier | In one line |
|---|---|---|---|
| 07 | **[Why streams exist](07-why-streams.md)** | <span className="db-tier t-master">Master</span> | 670 MB versus 88 MB for the same answer |
| 08 | **[The four stream types](08-stream-types.md)** | <span className="db-tier t-master">Master</span> | Readable, Writable, Duplex, Transform — and the callback that hangs everything |
| 09 | **[Backpressure](09-backpressure.md)** | <span className="db-tier t-master">Master</span> | `write()` returning `false` is the whole protocol |
| 10 | **[pipeline over pipe](10-pipeline.md)** | <span className="db-tier t-master">Master</span> | `.pipe()` leaks descriptors and crashes the process; `pipeline` does not |
| 11 | **[Consuming with for await](11-for-await-of.md)** | <span className="db-tier t-master">Master</span> | Backpressure, `try`/`catch` and cleanup in ordinary loop syntax |

## Streams — the rest

| # | Page | Tier | In one line |
|---|---|---|---|
| 12 | **[Events, flowing and paused](12-stream-events-and-modes.md)** | <span className="db-tier t-understand">Understand</span> | Attach a `'data'` handler one tick late and you get nothing |
| 13 | **[Transform streams](./13-transform-streams/README.md)** | <span className="db-tier t-understand">Understand</span> | The redaction that fails because the secret spanned two chunks |
| 14 | **[Object mode](14-object-mode.md)** | <span className="db-tier t-understand">Understand</span> | 16 items, not 65 536 bytes — and `null` still means "the end" |
| 15 | **[Web Streams](15-web-streams.md)** | <span className="db-tier t-understand">Understand</span> | What `fetch` hands you, and the four conversion functions |
| 16 | **[zlib](16-zlib.md)** | <span className="db-tier t-know">Know</span> | Brotli's default quality costs 75 s where quality 4 costs 0.7 |
| 17 | **[Custom Readable and Writable](17-custom-readable-writable.md)** | <span className="db-tier t-know">Know</span> | Mostly: don't. When you must, `_writev` and `_destroy` are the reasons |
| 18 | **[stream/promises and compose](18-stream-promises-and-compose.md)** | <span className="db-tier t-know">Know</span> | `finished`, `consumers`, and shipping three stages as one value |
| 19 | **[High water marks](19-highwatermark-tuning.md)** | <span className="db-tier t-when">When Needed</span> | 64 KB is the default and the curve is flat past 256 KB |

## Coverage — all 21 syllabus rows

21 rows map to 19 pages, with two merges:

| Merged row | Landed on |
|---|---|
| Buffer pooling internals and `Buffer.poolSize` | 03, with `allocUnsafe` — the pool is why it is fast |
| Flowing vs. paused mode | 12, with the stream events that switch between them |

Everything else is one row to one page. Two rows were split rather than merged in
practice: "why streams exist" (07) and "the four types" (08) stayed separate
because the first is a memory argument and the second is an API map.

## Phase gate

**Deliverable:** stream-process a file larger than available RAM — read,
transform, compress, write — with backpressure respected end to end and errors
propagating correctly.

```js
// the gate, in one pipeline
await pipeline(
  createReadStream(hugeFile),      // 09: backpressure from the sink reaches here
  new SplitLines(),                // 13: re-frame bytes into records
  redactSecrets(),                 // 13: safe because framing came first
  createGzip({ level: 1 }),        // 16: level 1, not the default
  createWriteStream(out),
  { signal },                      // 10: cancellable
);
```

You have passed when you can explain, without looking: what `write()` returning
`false` means, why the file handle leaks if that chain used `.pipe()`, and why
the redaction would silently fail without `SplitLines`.

## Where this connects

- **Phase 0 — the runtime model** explained the libuv thread pool; `zlib` and
  `fs` both live on it, which is [page 16](16-zlib.md)'s concurrency ceiling.
- **Phase 2 — async** gave you `for await`, `AbortController` and bounded
  concurrency. Pages 11, 10 and 18 are those ideas applied to bytes.
- **Phase 4 — filesystem** is the main source and sink for everything here.
- **Phase 5 — HTTP** is where request bodies and responses turn out to be
  streams, and where the size limits from page 01 stop being theoretical.
- **Phase 8 — security** picks up path traversal, zip bombs and timing-safe
  comparison properly.

---

← Phase 2: [Async and the event loop](../phase-2-async/README.md) · Start → [Buffer basics](01-buffer-basics.md)
