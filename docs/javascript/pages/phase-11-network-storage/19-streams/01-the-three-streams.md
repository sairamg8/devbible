---
title: "1 · The three streams"
sidebar_label: "1 · The three streams"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API), [Using readable streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams), [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream), [`WritableStream`](https://developer.mozilla.org/en-US/docs/Web/API/WritableStream), [`TransformStream`](https://developer.mozilla.org/en-US/docs/Web/API/TransformStream), [`ReadableStream.tee()`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/tee), [`TextDecoderStream`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream), [`CompressionStream`](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream). Documentation-validated; **no timings**.

**Streams are how the platform moves data it does not want to hold all of at once.** Three
interfaces, one idea:

| Type | Is | Example |
|---|---|---|
| **`ReadableStream`** | a source you pull chunks from | `response.body`, `blob.stream()` |
| **`WritableStream`** | a sink you push chunks into | a file writer, `WebSocketStream`'s writable |
| **`TransformStream`** | a readable **and** a writable, wired together | `TextDecoderStream`, `CompressionStream` |

🔴 **Know-tier framing: the reason to care is that streaming makes memory bounded and
time-to-first-byte real.** Reading a 2 GB response with `await response.text()` asks for 2 GB
of memory; reading it as a stream asks for one chunk.

**The reader loop over a `fetch` body is owned by
[07 · 02](../07-reading-responses/02-streaming-a-body.md)** — progress, cancellation, and why
you decode with a stream rather than per chunk. This page is the API around it.

## Reading

```js
for await (const chunk of response.body) { … }        // ✅ simplest, async-iterable
```

```js
const reader = response.body.getReader();             // the explicit form
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  handle(value);                                      // a Uint8Array, for a fetch body
}
```

**`read()` resolves to `{ value, done }`** and has exactly three outcomes: a chunk with
`done: false`, `{ value: undefined, done: true }` when the stream has closed, or a rejection
when it errored.

🔴 **`getReader()` locks the stream.** MDN: no other reader may read it "until the lock is
released by invoking `releaseLock()`". That lock is why a body can only be consumed once, and
why `response.clone()` exists ([07 · 01](../07-reading-responses/01-the-body-readers.md)) —
the same rule that forces `response.clone()` before caching in a service worker
([17 · 01](../17-service-workers/01-the-lifecycle-and-the-cache.md)).

⚠️ **`for await…of` on a stream is not universal** — MDN warns that a browser "may not
support async iteration", so library code uses `getReader()` and application code can use
either.

## Piping, and why it beats a hand-written loop

```js
await response.body
  .pipeThrough(new TextDecoderStream())        // bytes → text, statefully and correctly
  .pipeThrough(new TransformStream({ transform: splitLines }))
  .pipeTo(writable);                           // returns a promise: resolves at the end
```

- **`pipeThrough(transform)`** returns the transform's readable side, so it chains.
- **`pipeTo(writable)`** returns a promise that settles when the whole stream is done, and
  **propagates errors and cancellation in both directions** — a broken sink cancels the
  source.

🔴 **That propagation is the real argument for piping.** A hand-written `while` loop has to
remember to cancel the reader on error, on early exit and on unmount; a pipe does it by
construction.

⚠️ **`TextDecoderStream` exists because decoding per chunk is wrong** — a multi-byte
character can straddle a chunk boundary
([Phase 5 · 26 · 01](../../phase-5-built-in-library/26-text-encoding/01-textencoder-and-textdecoder.md)
is the `{stream: true}` version of the same trap).

## Writing your own

```js
new ReadableStream({
  start(controller) { … },                 // set up; enqueue initial chunks
  pull(controller) { … },                  // called when the consumer wants more ← backpressure
  cancel(reason) { … },                    // consumer gave up: release resources
}, { highWaterMark: 3, size: () => 1 });   // the queuing strategy
```

```js
new TransformStream({
  transform(chunk, controller) { controller.enqueue(map(chunk)); },
  flush(controller) { … },                 // last chance to emit
});
```

🔴 **`pull` is backpressure made concrete.** The stream calls it only when its internal queue
falls below `highWaterMark` — so a producer that only enqueues inside `pull` cannot outrun its
consumer. That is precisely what the WebSocket API lacks
([13 · 02](../13-websocket/02-messaging.md)), and what the wider async-backpressure discussion
in [Phase 7 · 22](../../phase-7-async/22-backpressure.md) is about.

⚠️ **A producer that enqueues in a loop inside `start` has no backpressure at all** — it fills
the queue as fast as it can, which is the bug streams were designed to prevent.

## Closing, cancelling and teeing

| Call | Meaning |
|---|---|
| `controller.close()` | no more chunks — **already-enqueued ones can still be read** |
| `stream.cancel(reason)` / `reader.cancel()` | **discard the stream and its queued chunks**, and tell the source |
| `reader.releaseLock()` | give the stream back, without cancelling it |
| `stream.tee()` | split into **two independent streams** |

```js
const [toBrowser, toCache] = response.body.tee();   // the service-worker idiom
```

⚠️ **`tee()` is not free.** The two branches are read independently, so chunks the slower
branch has not consumed are buffered — teeing a large body and reading one side slowly holds
the difference in memory.

## The transforms you get for free

```js
blob.stream()
  .pipeThrough(new DecompressionStream("gzip"))
  .pipeThrough(new TextDecoderStream())
  .pipeTo(sink);
```

- **`TextDecoderStream` / `TextEncoderStream`** — bytes ↔ text, correctly across chunks.
- **`CompressionStream` / `DecompressionStream`** — `"gzip"`, `"deflate"`, `"deflate-raw"`.
- **`Blob.stream()`** turns any blob into a readable one
  ([12 · 01](../12-blob-file-filereader/01-blob-and-file.md)), which is how you process a huge
  file without reading it.

⚠️ **A `Response` can be *built* from a stream** — `new Response(stream)` — which is how a
service worker synthesises a body it is generating or transforming as it goes.

## Gotchas

**Symptom → cause → fix.**

- **`TypeError: body stream already read` / "locked"** → the body was consumed twice, or a
  reader still holds the lock → `clone()` before the first read, or `releaseLock()`.
- **Text arrives with `` characters at chunk boundaries** → decoding each chunk separately →
  `pipeThrough(new TextDecoderStream())`.
- **A cancelled request keeps downloading** → the reader was abandoned without `cancel()` →
  cancel, or use `pipeTo`, which propagates.
- **A custom stream floods memory** → chunks are enqueued in `start` rather than in `pull` →
  produce inside `pull` and set a `highWaterMark`.
- **`for await…of` throws on a stream in some browsers** → async iteration of streams is not
  universally supported → use `getReader()`.
- **`tee()` makes memory grow** → one branch is read much more slowly than the other → read
  both at similar rates, or do not tee.
- **`close()` did not stop the data** → close only prevents *new* chunks; queued ones remain
  readable → `cancel()` to discard.
- **Nothing streams and it all arrives at once** → the server buffers, or a proxy does → the
  same buffering problem as SSE ([18 · 01](../18-server-sent-events/01-eventsource-and-the-stream-format.md)).

## Interview questions

**What problem do streams solve?** Processing data larger than memory, and starting work
before all of it has arrived — bounded memory and earlier first output, instead of buffering
a whole response.

**Why can a response body only be read once?** Reading takes a lock on the stream, and the
data is consumed as it flows. `clone()` gives you a second stream; `tee()` splits one you
already hold.

**What is the difference between `close()` and `cancel()`?** `close()` says no more chunks
will be enqueued but already-queued ones can still be read; `cancel()` discards the stream and
its queue and signals the source to stop.

**Where does backpressure live in the Streams API?** In the queuing strategy and the `pull`
callback: the source is asked for more only when the internal queue drops below
`highWaterMark`, so a well-written producer cannot outrun its consumer.

**Why `pipeThrough`/`pipeTo` rather than a manual loop?** They propagate errors and
cancellation through the whole chain automatically, which a hand-written loop has to
reimplement at every exit point.

**Why decode with `TextDecoderStream` rather than per chunk?** Because a multi-byte character
can span a chunk boundary; a stateful decoder holds the partial sequence, a per-chunk decode
corrupts it.

---

← [Overview](./README.md) · [Phase 11](../README.md)
