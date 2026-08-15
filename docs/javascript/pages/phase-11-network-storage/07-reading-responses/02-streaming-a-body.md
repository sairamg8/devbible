---
title: "02 · Streaming a body"
sidebar_label: "02 · Streaming a body"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Using readable streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams), [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream), [`ReadableStreamDefaultReader.read()`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/read), [`TextDecoderStream`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream), [`Response.body`](https://developer.mozilla.org/en-US/docs/Web/API/Response/body). Documentation-validated; **no timings**.

`response.body` is a `ReadableStream`, which means you can act on a response **as it arrives**
instead of waiting for all of it. Three things that only work this way: progress on a download,
rendering a long response incrementally, and processing something larger than memory.

## The reader loop

```js
const res = await fetch(url);
const reader = res.body.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  handle(value);                 // value is a Uint8Array
}
```

Three facts to hold:

- 🔴 **`value` is always a `Uint8Array`** — bytes, never a string, even for a text response.
- **Getting a reader locks the stream.** Nothing else can read it, including `res.json()`, until
  you call `reader.releaseLock()`.
- **`reader.cancel()`** stops consumption and discards what is queued — the right thing to call
  when the user navigates away mid-download.

`for await…of` reads much better, and MDN notes async iteration of a `ReadableStream` **is not
supported everywhere** — so feature-detect or keep the reader loop when the target matters:

```js
for await (const chunk of res.body) {      // chunk is a Uint8Array
  handle(chunk);
}
```

## Text: pipe through a decoder, do not decode per chunk

```js
const stream = res.body.pipeThrough(new TextDecoderStream());
for await (const text of stream) {
  output.append(text);                     // now strings
}
```

🔴 **Do not call `new TextDecoder().decode(chunk)` on each chunk.** A multi-byte character can be
split across a chunk boundary, and decoding each piece independently corrupts it — mojibake that
appears only for non-ASCII text and only sometimes. `TextDecoderStream` carries the partial
character across the boundary, which is exactly why it exists.

The same shape handles newline-delimited JSON, which is what most streaming APIs actually send:

```js
let buffer = '';
for await (const text of res.body.pipeThrough(new TextDecoderStream())) {
  buffer += text;
  const lines = buffer.split('\n');
  buffer = lines.pop();                     // keep the incomplete last line
  for (const line of lines) if (line) handle(JSON.parse(line));
}
if (buffer) handle(JSON.parse(buffer));
```

⚠️ **The `lines.pop()` is not optional.** A chunk boundary falls mid-line far more often than test
data suggests, and without it you parse half a JSON object.

## Download progress

```js
const res = await fetch(url);
const total = Number(res.headers.get('Content-Length')) || 0;
let received = 0;

const reader = res.body.getReader();
const chunks = [];

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  chunks.push(value);
  received += value.length;
  if (total) onProgress(received / total);
}

const blob = new Blob(chunks);
```

Two caveats worth stating plainly:

- ⚠️ **`Content-Length` is often absent** — with chunked transfer encoding or compression the
  server may not send it, and then there is no total to divide by. Show an indeterminate indicator
  rather than a fake percentage.
- ⚠️ **When the response is compressed, `Content-Length` is the compressed size while `received`
  counts decompressed bytes**, so the ratio can exceed 1. Clamp it, and treat the number as a hint.

📌 **`fetch` still cannot report *upload* progress.** That is the one thing `XMLHttpRequest` does
that `fetch` does not, and the reason XHR survives — the Know-tier topic
**21 · `XMLHttpRequest`** *(not written yet)*.

## Cancelling

```js
const controller = new AbortController();
const res = await fetch(url, { signal: controller.signal });
// …
controller.abort();          // aborts the fetch AND the body stream
```

`AbortController` is the right level: it cancels the request and the stream together, and it is the
same mechanism that removes event listeners
([Phase 10 · 02](../../phase-10-events/02-addeventlistener/README.md)). `reader.cancel()` alone
stops your reading but is a lower-level tool.

## When not to stream

Streaming is more code and more ways to be wrong. It earns its place for:

- **progress on a large download**
- **incremental rendering** — showing the first rows of a long result immediately
- **data larger than memory**
- **long-lived responses** — an LLM token stream, a log tail, newline-delimited JSON

For an ordinary API call returning a few kilobytes of JSON, `await res.json()` is correct and
streaming is noise.

**The trade-off:** streaming buys you time-to-first-byte-visible and bounded memory, and costs you
a decoder, a buffer, boundary handling and cancellation logic. Take it when the response is big or
slow, not because it sounds better.

## Gotchas

**Symptom: non-ASCII characters are mangled, intermittently.**
Cause — each chunk decoded independently, splitting a multi-byte character.
Fix — `pipeThrough(new TextDecoderStream())`, which carries partial characters across boundaries.

**Symptom: `TypeError: Failed to execute 'json' on 'Response': body stream is locked`.**
Cause — a reader is attached.
Fix — `reader.releaseLock()`, or decide up front whether you are streaming or buffering.

**Symptom: JSON parse errors on a streaming endpoint.**
Cause — parsing a chunk that ends mid-line.
Fix — keep the trailing incomplete line in a buffer and parse it when the next chunk arrives.

**Symptom: the progress bar reports more than 100%.**
Cause — a compressed response, where `Content-Length` is compressed and the received bytes are not.
Fix — clamp, and treat the total as approximate.

**Symptom: there is no progress at all.**
Cause — no `Content-Length` header, common with chunked encoding.
Fix — show an indeterminate indicator; do not invent a denominator.

**Symptom: `for await` over `res.body` throws a `TypeError`.**
Cause — that browser does not support async iteration of a `ReadableStream`.
Fix — the `getReader()` loop, which is universally supported.

**Symptom: the download keeps going after the user navigates away.**
Cause — nothing cancelled it.
Fix — an `AbortController`, aborted in teardown; it cancels the request and the stream.

## Interview questions

**★ What does `response.body.getReader()` give you, and what type are the chunks?**
A reader over the response's `ReadableStream`, yielding `{ done, value }` where **`value` is always
a `Uint8Array`** — bytes, even for text.

**★ Why decode with `TextDecoderStream` rather than per chunk?**
Because a multi-byte character can straddle a chunk boundary. Decoding chunks independently
corrupts it; the stream decoder carries the partial character across.

**★ How do you report download progress, and when can you not?**
Sum `value.length` per chunk and divide by `Content-Length`. You cannot when that header is absent
— chunked encoding — and the ratio is unreliable when the response is compressed, since the header
counts compressed bytes.

**★ Why does `fetch` still not do upload progress?**
It has no equivalent of XHR's upload progress events, which is the reason `XMLHttpRequest` remains
in use.

**★ When is streaming the wrong choice?**
For ordinary small JSON responses. It buys time-to-first-render and bounded memory at the cost of
decoding, buffering, boundary handling and cancellation — worth it only for large, slow or
long-lived responses.

**How do you cancel a streamed download?**
`AbortController` on the fetch — it cancels the request and the body stream together.
`reader.cancel()` only stops your reading.

---

← [01 · The body readers](./01-the-body-readers.md) · [Topic index](./README.md) ·
**08 · Aborting and timing out** *(not written yet)* →
