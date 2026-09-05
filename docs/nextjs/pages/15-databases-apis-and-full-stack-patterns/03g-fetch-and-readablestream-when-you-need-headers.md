---
title: "You abandon EventSource for exactly one reason — the request — and the price is that you now own the decoder, the line splitter, the field parser and the dispatch rule the browser was running for you"
sidebar_label: "03g · fetch + ReadableStream"
sidebar_position: 166
description: "Reading text/event-stream with fetch, response.body, getReader and TextDecoder: why an Authorization header or a POST body forces it, the multi-byte and frame-boundary problems chunked reading creates, and a complete spec-faithful SSE parser."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against MDN
> [`Response.body`](https://developer.mozilla.org/en-US/docs/Web/API/Response/body),
> [`ReadableStreamDefaultReader.read()`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/read),
> [`ReadableStreamDefaultReader.cancel()`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/cancel),
> [`TextDecoder.decode()`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/decode); the WHATWG HTML Living Standard
> [§9.2.5 Parsing an event stream and §9.2.6 Interpreting an event stream](https://html.spec.whatwg.org/multipage/server-sent-events.html);
> Next.js [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers).
> Documentation-verified against the specification text, **no sandbox run**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**There is one honest reason to stop using `EventSource`: the request. Its constructor takes a URL and `{ withCredentials }`, so it cannot carry an `Authorization` header, cannot carry a body, and cannot be anything but a `GET` — and if your API is a bearer-token API, or your subscription needs a filter too complex for a query string, that is the end of the conversation. `fetch` has none of those limits, because `response.body` is a `ReadableStream` and `text/event-stream` is just bytes. What you inherit in exchange is everything the browser was doing invisibly: UTF-8 decoding across chunk boundaries, splitting lines that arrive split, buffering a frame that arrives in three pieces, the field grammar, the dispatch rule and the id buffer. This page is that client, written correctly. The reconnection loop — which you also now own — is [03ga](03ga-owning-reconnection-when-you-own-the-client.md).**

## What you gain, and the five jobs you take on

| | `EventSource` | `fetch` + `ReadableStream` |
|---|---|---|
| Custom request headers | ❌ | ✅ |
| `POST` with a body | ❌ | ✅ |
| Response status and headers visible | ❌ | ✅ |
| Reconnection | ✅ specified, automatic | 🔴 **yours** |
| `Last-Event-ID` on reconnect | ✅ automatic | 🔴 **yours** |
| `retry:` honoured | ✅ automatic | 🔴 **yours** |
| Line and frame parsing | ✅ | 🔴 **yours** |
| UTF-8 decoding across chunks | ✅ | 🔴 **yours** |
| Abort | `close()` | `AbortController` |
| Runs inside a Worker | ✅ | ✅ |

Every 🔴 in that table is a real bug that has shipped. The two that bite hardest are the ones that look like they work: a decoder that splits a multi-byte character, and a parser that assumes one `read()` is one frame.

## The pipeline, and the guarantee at each stage

```text
fetch(url, { headers, body, signal })
  -> Response          check .ok and .headers.get('content-type') YOURSELF
  -> .body             a ReadableStream of Uint8Array, or null
  -> .getReader()      { value, done } per read
  -> TextDecoder       stream: true, or you corrupt multi-byte characters
  -> line splitter     lines may span reads; CR may split from LF
  -> field parser      the §9.2.6 grammar
  -> dispatch          on a blank line, and only if the data buffer is non-empty
```

The relevant guarantees, verbatim:

> *"The `body` read-only property of the `Response` interface is a `ReadableStream` of the body contents."*
> — MDN, [`Response.body`](https://developer.mozilla.org/en-US/docs/Web/API/Response/body)

> *"If a chunk is available, the promise will be fulfilled with an object of the form `{ value: theChunk, done: false }`. If the stream becomes closed, the promise will be fulfilled with an object of the form `{ value: undefined, done: true }`. If the stream becomes errored, the promise will be rejected with the relevant error."*
> — MDN, [`ReadableStreamDefaultReader.read()`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/read)

Note what is *not* guaranteed anywhere: that a chunk is a line, that a chunk is a frame, or that a chunk ends on a character boundary. A chunk is whatever the network gave you.

## `stream: true` is not an optimisation, it is correctness

`TextDecoder.decode()` takes an options object with one member:

> *"`stream` — A boolean flag indicating whether additional data will follow in subsequent calls to `decode()`. Set to `true` if processing the data in chunks, and `false` for the final chunk or if the data is not chunked. It defaults to `false`."*
> — MDN, [`TextDecoder.decode()`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/decode)

It defaults to `false`, which is the wrong default for this job. UTF-8 encodes characters in one to four bytes — MDN's own example notes that the euro sign encodes as `Uint8Array(3) [226, 130, 172]` — and a TCP segment boundary does not respect that. Decode a chunk that ends mid-character with `stream: false` and the trailing bytes become a replacement character and are lost; the next chunk then starts with orphaned continuation bytes and produces more replacement characters. With `stream: true` the decoder retains the incomplete sequence and completes it on the next call.

The symptom is a single diamond question-mark appearing in one message out of a few thousand, in a payload containing an emoji or an accented name — which is why it survives every test suite and reaches production.

## The parser, complete

This is §9.2.6 implemented directly. It is not long; it is just precise.

```ts
// lib/sse-parser.ts
const NUL = String.fromCharCode(0x00)
const BOM = String.fromCharCode(0xfeff)

export type ParsedEvent = { type: string; data: string; lastEventId: string }

export type ParserHandlers = {
  onEvent: (event: ParsedEvent) => void
  onRetry?: (milliseconds: number) => void
  onComment?: (text: string) => void
}

/**
 * Incremental parser for `text/event-stream`.
 * Feed it decoded text in whatever pieces arrive; it holds partial lines.
 */
export function createSseParser(handlers: ParserHandlers) {
  let buffer = ''
  let dataBuffer = ''
  let eventTypeBuffer = ''
  let lastEventId = ''
  let sawBom = false

  function processField(name: string, value: string) {
    switch (name) {
      case 'data':
        // "Append the field value to the data buffer, then append a single
        //  U+000A LINE FEED (LF) character to the data buffer."
        dataBuffer += value + '\n'
        break
      case 'event':
        eventTypeBuffer = value
        break
      case 'id':
        // "If the field value does not contain U+0000 NULL, then set the last
        //  event ID buffer to the field value. Otherwise, ignore the field."
        if (!value.includes(NUL)) lastEventId = value
        break
      case 'retry':
        // "If the field value consists of only ASCII digits, then interpret the
        //  field value as an integer ... Otherwise, ignore the field."
        if (/^[0-9]+$/.test(value)) handlers.onRetry?.(Number(value))
        break
      default:
        break // "All other field names are ignored."
    }
  }

  function dispatch() {
    if (dataBuffer === '') {
      // "If the data buffer is an empty string, set the data buffer and the
      //  event type buffer to the empty string and return."
      eventTypeBuffer = ''
      return
    }
    const data = dataBuffer.slice(0, -1) // drop the trailing LF
    handlers.onEvent({
      type: eventTypeBuffer === '' ? 'message' : eventTypeBuffer,
      data,
      lastEventId,
    })
    dataBuffer = ''
    eventTypeBuffer = ''
  }

  function processLine(line: string) {
    if (line === '') return dispatch()
    if (line.startsWith(':')) return handlers.onComment?.(line.slice(1))
    const colon = line.indexOf(':')
    if (colon === -1) {
      // "If the line does not contain a colon, process the field using the whole
      //  line as the field name, and the empty string as the field value."
      return processField(line, '')
    }
    const name = line.slice(0, colon)
    let value = line.slice(colon + 1)
    // "If value starts with a U+0020 SPACE character, remove it from value."
    if (value.startsWith(' ')) value = value.slice(1)
    processField(name, value)
  }

  return {
    /** Feed decoded text. Safe to call with partial lines. */
    feed(text: string) {
      if (!sawBom) {
        sawBom = true
        if (text.startsWith(BOM)) text = text.slice(1)
      }
      buffer += text

      // A trailing CR may be the first half of a CRLF that has not arrived yet.
      let end = buffer.length
      if (buffer.endsWith('\r')) end -= 1

      let start = 0
      let i = 0
      while (i < end) {
        const ch = buffer[i]
        if (ch === '\n') {
          processLine(buffer.slice(start, i))
          i += 1
          start = i
        } else if (ch === '\r') {
          processLine(buffer.slice(start, i))
          i += buffer[i + 1] === '\n' ? 2 : 1
          start = i
        } else {
          i += 1
        }
      }
      buffer = buffer.slice(start)
    },

    /** The current resume cursor, for Last-Event-ID on the next attempt. */
    get lastEventId() {
      return lastEventId
    },
  }
}
```

Three details in there are the ones hand-rolled parsers get wrong:

- **A trailing CR is held back.** The grammar's `end-of-line` is `cr lf / cr / lf`. A chunk ending in CR is ambiguous until the next byte arrives; treating it as a terminator immediately turns one CRLF into two line breaks, which turns one frame into two and dispatches an event early with half its data.
- **An empty data buffer dispatches nothing.** A frame consisting of `id: 4711` alone advances the cursor and fires no event. A parser that emits it produces phantom `message` events carrying empty strings.
- **Exactly one leading space is stripped**, not all whitespace. A payload written after `data:` and two spaces genuinely begins with a space.

## Reading the response

```ts
// lib/sse-fetch.ts
import { createSseParser, type ParsedEvent } from './sse-parser'

export async function readEventStream(
  response: Response,
  onEvent: (event: ParsedEvent) => void,
  onRetry?: (ms: number) => void,
): Promise<string> {
  // EventSource does these two checks for you and fails the connection on either.
  if (!response.ok) throw new Error(`stream refused: ${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.startsWith('text/event-stream')) {
    throw new Error(`unexpected content-type: ${contentType}`)
  }
  if (!response.body) throw new Error('response has no body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  const parser = createSseParser({ onEvent, onRetry })

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      parser.feed(decoder.decode(value, { stream: true }))
    }
    parser.feed(decoder.decode()) // flush a held partial character
  } finally {
    reader.releaseLock()
  }

  // Returned so the caller can send it as Last-Event-ID on the next attempt.
  return parser.lastEventId
}
```

Note the `finally`. If the caller aborts, `read()` rejects, and without releasing the lock the stream stays locked to a reader nobody holds. Aborting — the only thing that actually tears the connection down on the server — is part of the lifecycle you now own, and lives in [03ga](03ga-owning-reconnection-when-you-own-the-client.md).

## The request itself is the next page

Everything above is the *response* half — bytes in, events out. The half you came for, the `Authorization` header and the `POST` body, plus the reconnection loop, the backoff, the `Last-Event-ID` you now have to send yourself and the CORS preflight a custom header costs you, is [03ga](03ga-owning-reconnection-when-you-own-the-client.md).

## Gotchas

**★ Symptom: one message in a few thousand renders with a replacement character where an emoji or an accented name should be.** Cause: `decoder.decode(value)` without `{ stream: true }`, splitting a multi-byte UTF-8 sequence across a chunk boundary. Fix: one decoder for the whole response, `stream: true` on every chunk, and a final flush:

```ts
const decoder = new TextDecoder('utf-8')
parser.feed(decoder.decode(value, { stream: true }))
// after done:
parser.feed(decoder.decode())
```

**★ Symptom: events are occasionally truncated, or two events merge into one.** Cause: treating each `read()` as a frame — `JSON.parse(text.replace('data: ', ''))` and friends. A chunk is not a line and a line is not a frame. Fix: a stateful parser that holds a partial buffer between chunks; the one above is the whole of it.

**★ Symptom: creating one `TextDecoder` per chunk "fixed" nothing and is now slower.** Cause: a fresh decoder has no retained state, so `stream: true` on a new instance is meaningless — the incomplete sequence it saves is discarded along with the object. Fix: hoist the decoder outside the read loop. It is stateful by design; that is the point.

**★ Symptom: a server error renders as an SSE parse failure rather than an error.** Cause: no `response.ok` check, so a `500` carrying an HTML error page went into the parser and produced garbage fields. `EventSource` performed this check for you and failed the connection. Fix: validate status and `Content-Type` before touching `response.body`, as `readEventStream` does above.

**★ Symptom: the stream appears to stop after the first event when a payload contains a newline.** Cause: a multi-line `data:` payload — which the spec joins with LF — parsed as several frames because the code split raw text on a blank-line pattern instead of tracking fields. Fix: accumulate `data:` lines into the data buffer and dispatch only on an empty line, which is exactly what `processField` and `dispatch` do.

**★ Symptom: `TypeError` from `getReader`, or a "locked to a reader" error.** Cause: `response.body` was read twice, or a previous reader never released its lock after an abort. Fix: `reader.releaseLock()` in a `finally`, and never call both `response.text()` and `response.body.getReader()` on the same response.

**★ Symptom: the whole feature works in the browser and hangs in a Server Component.** Cause: this is a client-side pattern; a Server Component that opens a long-lived stream blocks the render it belongs to. Fix: it belongs in a `'use client'` component inside `useEffect`, or in a Worker. If you need to consume a stream *on the server*, that is a Route Handler proxying an upstream API, not a component.

**★ Symptom: the parser emits events with empty `data` that no listener wants.** Cause: dispatching on every blank line regardless of the data buffer. The spec returns early when the data buffer is empty, which is what makes an id-only checkpoint frame silent. Fix: the `if (dataBuffer === '')` guard in `dispatch()`; without it every checkpoint frame becomes a phantom event.

**★ Symptom: the client works over one deployment and hangs behind a proxy that rewrites line endings.** Cause: a parser that only splits on LF. The grammar allows `cr lf`, `cr` or `lf`, and something in the path normalised them. Fix: handle all three, and hold back a trailing CR until the next chunk arrives — the ambiguity is real and it silently doubles line breaks.

## Interview questions

**★ Why would you write an SSE client by hand when `EventSource` exists?**
Only because of the request. `EventSource`'s constructor takes a URL and an init dictionary with a single member, `withCredentials`, so there is no way to add an `Authorization` header, no way to send a body, and no way to use a method other than `GET` — the spec never sets a method and Fetch's default is `GET`. If your API authenticates with bearer tokens, or the subscription needs a payload larger or more structured than a query string, `EventSource` simply cannot make the call. Everything else it does — reconnecting, tracking the last event id, honouring `retry:`, parsing — you are then obliged to reimplement, so it is a decision to make deliberately rather than by reflex.

**★ How would you authenticate a server-sent event stream when your API uses bearer tokens?**
With `EventSource` you cannot, directly: the constructor takes a URL and `{ withCredentials }`, so there is no header to put the token in. That leaves three options. A cookie, with `withCredentials: true` for cross-origin, which is usually correct and gets `HttpOnly` and `SameSite` for free. A short-lived, single-use, stream-scoped ticket minted by an ordinary authenticated `POST` and passed in the query string, accepting that it will appear in access logs but is worthless within the minute. Or this page: `fetch` with an `Authorization` header, which is the only option that keeps the credential out of the URL entirely — at the cost of the parser above and the retry loop in [03ga](03ga-owning-reconnection-when-you-own-the-client.md).

**★ What exactly goes wrong if you call `decode()` without `stream: true`?**
UTF-8 is a variable-length encoding and a network chunk can end in the middle of a character. Without `stream: true` the decoder treats each call as a complete input, so an incomplete trailing sequence is replaced by U+FFFD and discarded, and the following chunk begins with continuation bytes that have no lead byte and produce further replacement characters. The result is one corrupted character roughly whenever a multi-byte character lands on a chunk boundary — rare, non-deterministic, and invisible in tests written with ASCII fixtures. With `stream: true` the decoder retains the partial sequence and completes it on the next call; a final `decode()` with no arguments flushes whatever is left.

**★ Your parser splits on a blank-line pattern to find frames. Why is that wrong?**
Two reasons. First, the grammar allows three line terminators — `cr lf`, `cr` and `lf` — so a stream with CRLF endings separates frames with two CR LF pairs, which a naive LF-based split never finds. Second, and more fundamental, chunk boundaries are arbitrary: the separator itself can arrive split across two `read()` calls, and a trailing CR is ambiguous until the next byte shows up. A correct implementation is stateful — it accumulates into a buffer, extracts only complete lines, holds back a dangling CR, and dispatches on an empty line rather than on a byte pattern in the raw text.

**★ You abort the fetch. What actually happens on the server?**
The abort propagates through the fetch to the connection, and in a Route Handler that surfaces as `request.signal` aborting and as the `ReadableStream`'s `cancel()` callback firing — which is why both must be wired to the same idempotent cleanup. Merely stopping your read loop does not do this: the socket stays open, the handler keeps producing, and on a serverless platform the invocation keeps running and keeps costing. `AbortController` is the only thing that tears the connection down from the client, and it is the direct equivalent of `EventSource.close()`.

**★ When would you reach for `fetch` streaming even though `EventSource` would work?**
When you need the response metadata. `EventSource` never shows you a status code or a header, so you cannot distinguish "rate limited, retry after thirty seconds" from "your token is bad, stop trying" — both are just an `error` event with `readyState` of `CLOSED`. With `fetch` you read `response.status` and `Retry-After` and act on them, which turns a dead feed into a correct backoff. That single capability is often worth the parser, because it is the difference between a client that recovers and one that gives up silently.

---

← [03fa · Resumable streams and Last-Event-ID](03fa-designing-a-resumable-sse-stream.md) · [Chapter 15 overview](01-explanation.md) · Next → [03ga · Owning reconnection](03ga-owning-reconnection-when-you-own-the-client.md)
