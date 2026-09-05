---
title: "Write exactly one function that serializes an SSE frame, because every framing bug is a missing blank line and no layer in the stack will tell you"
sidebar_label: "03c · Producing the stream correctly"
sidebar_position: 31
description: "An encoder that cannot produce an invalid frame, the framing mistakes table, and the four response headers an SSE endpoint must set — with why each one is there."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the WHATWG HTML Living Standard
> [§9.2.5–§9.2.7 Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html),
> MDN [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
> (whose reference server sets `X-Accel-Buffering: no`), and the Next.js
> [Streaming guide](https://nextjs.org/docs/app/guides/streaming) §"What can affect streaming".
> Documentation-verified, **no sandbox run**.
> Target: **Next.js 16.3.4** · Node **24.20.0**.

**The format from [03b](03b-the-event-stream-format.md) is simple enough that everyone concatenates it inline at first, and then spends an afternoon on a stream that connects, stays open, transfers bytes and dispatches nothing. There is no error to catch: an unterminated event is a valid, incomplete event, and the client waits forever. The cure is structural — one encoder, used everywhere, that cannot emit a frame without its terminating blank line — plus four response headers, each of which exists because something in a real deployment breaks without it.**

## An encoder that cannot get the framing wrong

```ts
// lib/sse.ts
export type ServerSentEvent = {
  /** Becomes the DOM event type. Omit for the default `message` event. */
  event?: string
  /** Sets the client's last event ID; echoed back as `Last-Event-ID` on reconnect. */
  id?: string
  /** Reconnection delay in whole milliseconds. Non-integers are ignored by the client. */
  retry?: number
  /** Any value; objects are JSON-encoded. */
  data: unknown
}

const encoder = new TextEncoder()
const LINE_BREAKS = /\r\n|\r|\n/

/** Serialize one event into the wire format, terminated by a blank line. */
export function encodeEvent(evt: ServerSentEvent): Uint8Array {
  let frame = ''

  if (evt.event !== undefined) {
    // A field value must not contain a line break; it would start a new field.
    frame += `event: ${oneLine(evt.event)}\n`
  }
  if (evt.id !== undefined) {
    // A NUL anywhere in the id makes the client ignore the whole field.
    frame += `id: ${oneLine(evt.id).replace(/\u0000/g, '')}\n`
  }
  if (evt.retry !== undefined) {
    // Only ASCII digits are honoured, so coerce to a non-negative integer.
    frame += `retry: ${Math.max(0, Math.trunc(evt.retry))}\n`
  }

  const payload =
    typeof evt.data === 'string' ? evt.data : JSON.stringify(evt.data)

  // Every physical line of the payload needs its own `data:` prefix.
  for (const line of payload.split(LINE_BREAKS)) {
    frame += `data: ${line}\n`
  }

  // The blank line is what dispatches the event. Nothing happens without it.
  frame += '\n'

  return encoder.encode(frame)
}

/** A comment line. Ignored by the client; used as a keep-alive and as a flush probe. */
export function encodeComment(text = ''): Uint8Array {
  return encoder.encode(`: ${oneLine(text)}\n\n`)
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ')
}
```

Four decisions in that file each correspond to a real defect:

1. **`event` and `id` values are flattened to a single line.** A line break inside them does not escape — it starts a new field, and the parser reads the remainder as a field with an unknown name and discards it.
2. **NUL is stripped from `id`.** The spec ignores the entire `id` field if the value contains U+0000, so a UUID coming out of a binary column with a stray NUL silently breaks resumption rather than erroring.
3. **The payload is split on all three line-ending forms and each piece gets its own `data:` prefix.** This is how the format expresses a multi-line value; anything else corrupts it.
4. **The blank line is appended unconditionally.** The most common SSE bug becomes structural rather than something you have to remember at each call site.

Note what the encoder does *not* do: it does not accept a `Response`, does not know about Next.js, and has no I/O. That makes it trivially unit-testable — assert on the exact string for a handful of inputs, including a multi-line payload and a payload with a CRLF — which is the only test in this whole area that pays for itself.

## The framing mistakes, side by side

| You emitted | The client sees | Why |
|---|---|---|
| a `data:` line, one line feed | nothing, ever | No blank line, so the event is never dispatched |
| a `data:` line, then a blank line | `message`, with `data` as the raw text | Correct — you still `JSON.parse` on the client |
| `data:hello` with no space | `data` is `hello` | The single leading space is optional and stripped if present |
| `data:` then two spaces then `hello` | `data` keeps one leading space | Only **one** leading space is stripped |
| `event: ping` and a blank line | nothing | Empty data buffer, so dispatch returns early |
| `id: 7` and a blank line | nothing dispatched, `Last-Event-ID` becomes `7` | Same early return; the ID still sticks |
| two `data:` lines, then a blank line | one event, values joined by a line feed | Consecutive `data` fields concatenate |
| `retry: 2s` | reconnection delay unchanged | Not ASCII digits, so the field is ignored |
| a partial event when the stream ends | nothing | *"If the file ends in the middle of an event, before the final empty line, the incomplete event is not dispatched."* |
| pretty-printed JSON in one `data:` | a truncated event, or two events | Real line breaks in the value terminate the field |

## The response headers, and why each one is there

```ts
return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  },
})
```

**`Content-Type: text/event-stream`** — required. The client fails the connection outright on anything else, and failing does not retry. The `charset` parameter is redundant (the format is UTF-8 by definition) but harmless and makes intent explicit to intermediaries.

**`Cache-Control: no-cache, no-store, no-transform`** — `no-cache`/`no-store` stop an intermediary storing a fragment of a stream, which is meaningless but does happen. `no-transform` is the one people omit: it asks proxies not to recompress the body, and recompression is precisely what buffers your chunks. Note that Next.js already sets `private, no-cache, no-store, max-age=0, must-revalidate` on dynamic responses, per the [CDN caching guide](https://nextjs.org/docs/app/guides/cdn-caching) — setting it yourself makes the intent local and survives a route that some future change accidentally makes cacheable.

**`Connection: keep-alive`** — a no-op under HTTP/2, where it is in fact a forbidden header, but conventional and harmless under HTTP/1.1.

**`X-Accel-Buffering: no`** — nginx-specific and the highest-value line here. MDN's own reference SSE server sets it, and the Next.js Streaming guide recommends the same header globally:

> *"Nginx and similar reverse proxies buffer responses by default. Disable buffering by setting the `X-Accel-Buffering` header to `no`"*
> — [Next.js · Streaming](https://nextjs.org/docs/app/guides/streaming)

If you want it on every route rather than per handler, the guide's `next.config.js` form is:

```js
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*{/}?',
        headers: [{ key: 'X-Accel-Buffering', value: 'no' }],
      },
    ]
  },
}
```

⚠️ That applies the header to *everything*, including your static HTML, which is usually fine but is a global change; scoping the `source` to `/api/:path*` is the safer version if only your API streams.

## Gotchas

**★ Symptom: the connection opens, bytes are received, and no event ever fires.** Cause: you enqueued a `data:` line with only one line feed. The parser is still waiting for the blank line that terminates the event, and will wait forever. Fix: terminate every event with a blank line, structurally, via the encoder:

```ts
controller.enqueue(encodeEvent({ event: 'taskMoved', data: { id, column } }))
// not: controller.enqueue(encoder.encode('data: ' + JSON.stringify(payload) + '\n'))
```

**★ Symptom: a payload splits into two events, or truncates, once someone turns on pretty-printing for debugging.** Cause: `JSON.stringify` escapes line breaks *inside strings*, but `JSON.stringify(x, null, 2)` puts real line breaks *between* tokens, and each one ends the `data` field. Fix: never pretty-print into `data`, and prefix every physical line regardless — the loop makes the mistake survivable:

```ts
for (const line of payload.split(LINE_BREAKS)) frame += `data: ${line}\n`
```

**★ Symptom: the last event of a batch is missing when the stream closes.** Cause: `controller.close()` ran after the fields were enqueued but before the terminating blank line, so the final event is the "incomplete event" the spec discards. Fix: close only after a complete frame — which, with the encoder, is automatic:

```ts
controller.enqueue(encodeEvent({ event: 'done', data: { count } }))
controller.close()
```

**★ Symptom: events appear in bursts of ten or twenty rather than one at a time.** Cause: something between you and the browser is block-buffering — nginx by default, a CDN that will not pass chunked responses, or the compression layer. Fix: set `X-Accel-Buffering: no` and `Cache-Control: no-transform`, and prove the path with a comment sent before any work:

```ts
start(controller) {
  controller.enqueue(encodeComment('open'))  // must appear instantly
  // …only then start producing real events
}
```

If that comment does not arrive immediately, the problem is downstream of your code and no change to the handler will fix it. [03h](03h-what-silently-breaks-sse-in-production.md) enumerates the layers.

**★ Symptom: it streams in production and arrives all at once in a `curl` test, so you "fix" working code.** Cause: `curl` buffers its own output. The Next.js guide is explicit: *"Command-line tools like `curl` also buffer by default. The `-N` flag disables output buffering, but `curl` still relies on newline characters to flush lines to the terminal."* Fix: test with a reader that prints per chunk rather than trusting the terminal, and send `Accept-Encoding: identity` so the compression layer is out of the picture:

```js
// stream-probe.mjs — reads chunks as they arrive, no shell buffering involved
const res = await fetch('https://example.com/api/board/1/events', {
  headers: { Accept: 'text/event-stream', 'Accept-Encoding': 'identity' },
})
const reader = res.body.getReader()
const decoder = new TextDecoder()
for (;;) {
  const { done, value } = await reader.read()
  if (done) break
  process.stdout.write(decoder.decode(value, { stream: true }))
}
```

**★ Symptom: the first event takes seconds to appear even though the handler produced it immediately.** Cause: gzip or Brotli is holding bytes until it has enough to compress. *"Gzip and Brotli compression can buffer chunks internally before flushing, as the compression algorithm needs enough data to compress efficiently."* Fix: `no-transform` on the response, and if a reverse proxy compresses independently, exclude `text/event-stream` from its compressible types. In nginx that is a `gzip_types` that does not include the SSE type, plus `proxy_buffering off` for the location.

**★ Symptom: an `id` containing a NUL byte silently disables resumption.** Cause: the spec ignores the whole `id` field if the value contains U+0000, so the last event ID never advances and every reconnect replays from the beginning. Fix: strip it in the encoder, which the version above does:

```ts
frame += `id: ${oneLine(evt.id).replace(/\u0000/g, '')}\n`
```

**★ Symptom: `Content-Length` appears on the response and the client hangs at exactly that many bytes.** Cause: something computed a length for a body that has no length — usually a wrapper that buffered the stream to measure it. Fix: never set `Content-Length` on a streaming response and never pass the stream through code that collects it; a streaming body must be chunked (HTTP/1.1) or framed (HTTP/2).

## Interview questions

**★ Why does an SSE event end with two line feeds rather than one?**
Because a line terminator ends a *field* and a blank line ends an *event*. The ABNF says `event = *( comment / field ) end-of-line` — zero or more field lines followed by an empty line — so the parser only dispatches when it reads a line with nothing on it. The practical consequence is that a producer emitting a single `data:` line has produced a perfectly valid, still-incomplete event, and the client holds it in its buffer indefinitely. There is no error and no timeout: the connection looks healthy and nothing fires. That asymmetry — one line feed is silence, two is delivery — is why every production SSE server should have exactly one function that writes frames.

**★ How do comments keep a connection alive when the client ignores them?**
The client ignores them *semantically* — no event is dispatched — but they are still bytes on the wire, and it is the bytes that matter to every intermediary. A proxy that closes idle connections is counting time since the last byte, not since the last event. The spec's authoring notes recommend a comment "every 15 seconds or so" for exactly this reason. Comments also have a diagnostic use: one sent immediately on connect tells you whether the path between you and the browser buffers, because if it does not appear instantly, nothing downstream is flushing — and that is a much faster first test than reasoning about your producer.

**★ Which of the four SSE response headers can you drop, and which will bite you?**
`Content-Type` is mandatory — the client refuses to parse anything else and does not retry after refusing. `X-Accel-Buffering: no` is the one people drop and then spend a day on, because its absence produces working-but-batched behaviour rather than an error, and only on deployments that sit behind nginx. `Cache-Control` is nearly always already correct because Next.js marks dynamic responses uncacheable, but adding `no-transform` yourself is worth it since that is the directive that discourages recompression. `Connection: keep-alive` is the one you can genuinely drop: it is meaningless under HTTP/2 and implied under HTTP/1.1.

**Why put the encoder in its own module instead of inlining the string building in the handler?**
Because the failure mode is silent and the correctness rules are all in the serialization, not in the handler. Once framing lives in one function, "did we terminate the event" stops being a per-call-site question, the multi-line and NUL rules are enforced once, and the whole thing is testable without a server, a socket or a browser — you assert on a string. The handler is then only responsible for *when* to send, which is the part that genuinely differs per route. It also means that when you later need a second transport — writing the same events to a log, or to a test double — you already have a pure function that produces the bytes.

**A reviewer asks why you do not just use a library for this. What is the honest answer?**
That the serialization is thirty lines and fully specified, so a dependency buys very little, while the parts that *are* hard — lifecycle, cancellation, heartbeats, resumption, back-pressure — are not what SSE libraries typically solve well and are specific to your data source anyway. The counter-argument is real on the client side, where a robust `fetch`-based reader has genuinely fiddly incremental-parsing logic; there, a small library is defensible. On the server, the encoder above plus the handler in [03d](03d-writing-the-sse-route-handler.md) is the whole surface.

---

← [03b · The event stream format](03b-the-event-stream-format.md) · [Chapter 15 overview](01-explanation.md) · Next → [03d · Writing the SSE Route Handler](03d-writing-the-sse-route-handler.md)
