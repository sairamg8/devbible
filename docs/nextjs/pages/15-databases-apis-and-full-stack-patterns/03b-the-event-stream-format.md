---
title: "The event stream format is an ABNF grammar with four field names, and every field the spec does not name is discarded without a word"
sidebar_label: "03b · The event stream format"
sidebar_position: 161
description: "text/event-stream as the WHATWG specification defines it: the ABNF, UTF-8, the required MIME type, and exactly what data / event / id / retry each do to the parser's buffers."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the WHATWG HTML Living Standard
> [§9.2 Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
> (§9.2.2 The EventSource interface, §9.2.5 Parsing an event stream, §9.2.6 Interpreting an
> event stream, §9.2.7 Authoring notes) and MDN
> [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).
> Documentation-verified against the specification text, **no sandbox run**.
> Target: **Next.js 16.3.4** · Node **24.20.0**.

**SSE needs no server library because the protocol is a text format you can produce with string concatenation. That is its great virtue and the origin of every bug it has: nothing validates your output. This page is the format exactly as the specification defines it — the grammar, the encoding rule, the MIME type the client enforces, and what each of the four legal fields does to the parser's internal buffers. [03c](03c-producing-the-stream-correctly.md) turns it into a producer you can copy.**

## The grammar, verbatim

The HTML Living Standard defines the format as ABNF:

> ```
> stream        = [ bom ] *event
> event         = *( comment / field ) end-of-line
> comment       = colon *any-char end-of-line
> field         = 1*name-char [ colon [ space ] *any-char ] end-of-line
> end-of-line   = ( cr lf / cr / lf )
> ```
> — [WHATWG HTML §9.2.5](https://html.spec.whatwg.org/multipage/server-sent-events.html)

Read `event = *( comment / field ) end-of-line` carefully: an event is **zero or more lines followed by an empty line**. The blank line is the terminator, not a separator. That is why every SSE payload ends with two line feeds, and it is the single fact that explains most silent streams.

Two more hard rules from the same section:

> *"Event streams in this format must always be encoded as UTF-8."*

> *"Lines must be separated by either a U+000D CARRIAGE RETURN U+000A LINE FEED (CRLF) character pair, a single U+000A LINE FEED (LF) character, or a single U+000D CARRIAGE RETURN (CR) character."*

And the MIME type is not negotiable:

> *"This event stream format's MIME type is `text/event-stream`."*

The client enforces both the type and the status. If your handler answers with `application/json`, or with anything other than `200`, the browser does not attempt to parse a byte:

> *"Otherwise, if res's status is not 200, or if res's `Content-Type` is not `text/event-stream`, then fail the connection."*
> — [WHATWG HTML §9.2.2](https://html.spec.whatwg.org/multipage/server-sent-events.html)

"Fail the connection" is a term of art in this spec: it sets `readyState` to `CLOSED`, fires `error`, and **does not retry**. That is different from a network error, which does retry. So a `500` from your handler kills the subscription permanently, while a dropped TCP connection does not.

## How a line becomes a field

The parser is a line loop with three cases, and the third one is the surprise:

> *"If the line is empty (a blank line) — Dispatch the event, as defined below."*
> *"If the line starts with a U+003A COLON character (:) — Ignore the line."*
> *"If the line contains a U+003A COLON character (:) — Collect the characters on the line before the first colon, and let field be that string. Collect the characters on the line after the first colon, and let value be that string. If value starts with a U+0020 SPACE character, remove it from value."*
> *"Otherwise, the string is not empty but does not contain a colon — Process the field … using the whole line as the field name, and the empty string as the field value."*
> — [WHATWG HTML §9.2.6](https://html.spec.whatwg.org/multipage/server-sent-events.html)

Three consequences worth internalising:

1. **Only the first colon splits.** `data: {"a":1}` has a value of `{"a":1}`, not `{"a"`.
2. **Exactly one leading space is stripped.** Two spaces after the colon means the value keeps one.
3. **A bare word on a line is a field with an empty value.** A stray line reading `data` appends a lone line feed to the data buffer rather than erroring.

## The four fields, and what each one does to the buffers

Field names are compared literally, with no case folding. Everything else is dropped:

> *"All other field names are ignored."*
> — [MDN · Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)

The parser keeps three buffers: a **data buffer**, an **event type buffer**, and a **last event ID buffer**. Knowing which of those survives a dispatch is the whole model.

### `data` — appends to the data buffer

> *"Append the field value to the data buffer, then append a single U+000A LINE FEED (LF) character to the data buffer."*
> — [WHATWG HTML §9.2.6](https://html.spec.whatwg.org/multipage/server-sent-events.html)

Consecutive `data:` lines therefore concatenate with a line feed between them, and the trailing line feed is trimmed at dispatch:

> *"If the data buffer's last character is a U+000A LINE FEED (LF) character, then remove the last character from the data buffer."*

```text
data: line one
data: line two
```

dispatches one event whose `event.data` is the two lines joined by a single line feed.

🔴 **If the data buffer is empty, no event fires at all:**

> *"If the data buffer is an empty string, set the data buffer and the event type buffer to the empty string and return."*

An event block consisting only of `id: 42` therefore sets the last event ID and dispatches nothing. That is occasionally exactly what you want, and frequently the reason a "why did my custom event not fire" ticket exists.

### `event` — sets the event type buffer, which resets on dispatch

> *"Set the event type buffer to the field value."*

The dispatched event's `type` becomes that string instead of `message`, so on the client you need `addEventListener('taskMoved', …)` — `onmessage` will not see it.

> *"The `onmessage` handler is called if no event name is specified for a message."*
> — MDN

⚠️ The event type buffer is reset after every dispatch. It does **not** persist the way the last event ID does. Every named event must carry its own `event:` line.

### `id` — sets the last event ID buffer, which does **not** reset

> *"If the field value does not contain U+0000 NULL, then set the last event ID buffer to the field value. Otherwise, ignore the field."*

And on dispatch:

> *"Set the last event ID string of the event source to the value of the last event ID buffer. The buffer does not get reset, so the last event ID string of the event source remains set to this value until the next time it is set by the server."*

That string is what the browser sends back in `Last-Event-ID` when it reconnects, and it is also exposed on each event as `lastEventId`:

> *"Initialize event's … `lastEventId` attribute to the last event ID string of the event source."*

So an event with no `id` of its own still reports the most recent ID the server ever sent. **03f** *(not written yet)* is entirely about exploiting that.

### `retry` — sets the reconnection time, in milliseconds

> *"If the field value consists of only ASCII digits, then interpret the field value as an integer in base ten, and set the event stream's reconnection time to that integer. Otherwise, ignore the field."*

Send it once, early — it persists on the `EventSource` object for the life of the subscription. The default is implementation-defined:

> *"A reconnection time, in milliseconds. This must initially be an implementation-defined value, probably in the region of a few seconds."*
> — [WHATWG HTML §9.2.2](https://html.spec.whatwg.org/multipage/server-sent-events.html)

`retry: 5s` and `retry: 5000ms` are both silently ignored, which is a nasty class of bug because nothing warns you.

### Comments — ignored, but still bytes

> *"A colon as the first character of a line is in essence a comment, and is ignored."*
> — MDN

> *"The comment line can be used to prevent connections from timing out; a server can send a comment periodically to keep the connection alive."*

The spec's authoring notes put a number on it:

> *"Legacy proxy servers are known to, in certain cases, drop HTTP connections after a short timeout. To protect against such proxy servers, authors can include a comment line (one starting with a ':' character) every 15 seconds or so."*
> — [WHATWG HTML §9.2.7](https://html.spec.whatwg.org/multipage/server-sent-events.html)

## What the spec says about buffering, before your infrastructure gets a vote

Even the *client's own* buffering strategy is called out, and the wording is a good early warning that this protocol is sensitive to intermediaries:

> *"Since connections established to remote servers for such resources are expected to be long-lived, UAs should ensure that appropriate buffering is used. In particular, while line buffering with lines are defined to end with a single U+000A LINE FEED (LF) character is safe, block buffering or line buffering with different expected line endings can cause delays in event dispatch."*
> — [WHATWG HTML §9.2.5](https://html.spec.whatwg.org/multipage/server-sent-events.html)

And on the transport:

> *"Authors are also cautioned that HTTP chunking can have unexpected negative effects on the reliability of this protocol, in particular if the chunking is done by a different layer unaware of the timing requirements."*
> — §9.2.7

**03h** *(not written yet)* is the operational version of those two sentences.

## Gotchas

**★ Symptom: `addEventListener('message', …)` stops firing after you add `event:` lines.** Cause: naming an event routes it away from `message`. MDN: *"The event "message" is a special case, as it will capture events without an event field as well as events that have the specific type `event: message`. It will not trigger on any other event type."* Fix: register a listener per event type, or drop the `event:` field and put the type inside the JSON payload:

```ts
// Option A — named events, one listener each
source.addEventListener('taskMoved', onTaskMoved)
source.addEventListener('taskCreated', onTaskCreated)

// Option B — one channel, discriminated union in the payload
controller.enqueue(encodeEvent({ data: { kind: 'taskMoved', id, column } }))
```

**★ Symptom: an event with an `id` but no `data` "does nothing" and you conclude IDs are broken.** Cause: they are not — the dispatch algorithm sets the last event ID *before* it checks whether the data buffer is empty. The ID is recorded; the event is simply not delivered. Fix: if you want a visible checkpoint, give it a payload. If you only want to advance the resume cursor without waking the UI, an id-only block is exactly the right tool, and you should comment it as deliberate:

```ts
// Advance the client's resume cursor without dispatching anything.
controller.enqueue(new TextEncoder().encode(`id: ${cursor}\n\n`))
```

**★ Symptom: the client's reconnection delay never changes no matter what you send.** Cause: the value was not pure ASCII digits — `retry: 5_000`, `retry: 5e3`, a quoted string, or a float from a division. Fix: truncate to an integer and interpolate a number, never a string:

```ts
frame += `retry: ${Math.max(0, Math.trunc(delayMs))}\n`
```

**★ Symptom: a field you invented — `channel:`, `user:`, `tenant:` — never shows up on the client.** Cause: only `event`, `data`, `id` and `retry` exist. *"All other field names are ignored."* Fix: put it inside the JSON in `data`, or encode it in the event name:

```ts
controller.enqueue(
  encodeEvent({ event: `board:${boardId}`, data: { kind: 'taskMoved', id } }),
)
```

**★ Symptom: a stray line in your output changes the payload and you cannot see why.** Cause: a line with no colon is a field with an empty value, not an error — *"the entire line is treated as the field name with an empty value string."* A bare `data` line therefore appends a lone line feed to the data buffer. Fix: never emit a bare field name; always write `name: value`, which an encoder guarantees.

**★ Symptom: non-ASCII characters arrive mangled.** Cause: something in the path re-encoded the body, or you built bytes with a non-UTF-8 encoder. The spec is absolute: *"Event streams in this format must always be encoded as UTF-8."* Fix: use one `TextEncoder` (which only produces UTF-8) and declare the charset on the response:

```ts
headers: { 'Content-Type': 'text/event-stream; charset=utf-8' }
```

**★ Symptom: your handler returns `500` on a transient database error and the client never comes back.** Cause: a non-`200` status makes the client *fail* the connection rather than *reestablish* it, and failing is terminal — `readyState` goes to `CLOSED` and no retry is scheduled. Fix: never surface an error as a status code once you have decided to stream. Open the stream with `200`, then report the failure as an event and let the client decide:

```ts
try {
  for await (const change of changes) {
    controller.enqueue(encodeEvent({ data: change }))
  }
} catch (cause) {
  controller.enqueue(encodeEvent({ event: 'streamError', data: { retryable: true } }))
  controller.close() // a clean close reconnects; a 500 would not
}
```

**★ Symptom: two spaces after the colon and the value keeps one of them.** Cause: exactly one U+0020 is stripped, not all leading whitespace. Fix: emit one space, or none — both are equivalent, and an encoder makes it consistent.

## Interview questions

**★ What is the difference between `event:` and putting a `type` key in the JSON?**
`event:` changes the DOM event type the browser dispatches, so it is delivered to `addEventListener('thatName', …)` and *not* to `onmessage`. A `type` key inside `data` arrives as a plain `message` event that you switch on yourself. The `event:` field is cleaner when consumers genuinely differ per type and you want independent listeners; the in-payload discriminant is better when you have a single reducer, when you want exhaustiveness checking from a TypeScript discriminated union, or when the number of event types is large enough that registering listeners becomes bookkeeping. There is no protocol advantage either way — the field is one line of text. The one asymmetry to remember is that the event type buffer resets after each dispatch while the last event ID does not, so a named-event stream must repeat the name on every frame.

**★ Why can a server send `id:` with no `data:` and what is it for?**
Because the dispatch algorithm sets the last event ID from its buffer *before* it checks whether the data buffer is empty, and the id buffer explicitly is not reset between events. So an id-only block advances the client's resume cursor without delivering anything to application code. That is exactly what you want for a stream where most underlying changes are irrelevant to this subscriber: you keep the cursor moving so that a reconnect does not replay thousands of skipped events, without waking the UI for each one. It is also how you checkpoint a stream that is idle but healthy.

**★ A handler throws and returns a `500`. What does the browser do, and how does that differ from the network dropping?**
They are opposite outcomes, which is the trap. A non-`200` status, or a `Content-Type` that is not `text/event-stream`, makes the user agent *fail the connection*: `readyState` becomes `CLOSED`, an `error` event fires, and no reconnection is scheduled — the subscription is over until your code constructs a new `EventSource`. A network error makes it *reestablish the connection*: `readyState` goes back to `CONNECTING`, an `error` event fires, and it retries after the reconnection time. So a transient database failure surfaced as an HTTP `500` is strictly worse than the connection simply dying. Once you have committed to streaming, errors belong inside the stream.

**Why does the spec forbid anything but UTF-8, when HTTP has a `charset` parameter?**
Because the parser operates on decoded scalar values and the field grammar is defined in terms of specific code points — colon, CR, LF, and the U+FEFF byte order mark that gets stripped. Allowing a negotiated charset would mean the framing characters themselves could be encoded differently per stream, so a parser could not find event boundaries without first agreeing on the encoding. Fixing it at UTF-8 makes the framing decodable byte-wise before any charset question arises. In practice this means you build the stream with a `TextEncoder`, which only produces UTF-8, and you never hand it bytes from another source.

**A payload contains a carriage-return/line-feed pair. What does the client receive, and why?**
Two `data` field lines, because `end-of-line` in the grammar includes CRLF, and a raw CRLF inside your value therefore terminates the field. If the remainder happens to contain a colon it is parsed as a new field with an unknown name and dropped; if it does not, the entire remaining line becomes a field name with an empty value and is also dropped. Either way you lose data silently. The fix is structural: split the payload on all three line-ending forms and prefix each piece with `data: `, which is also how multi-line values are meant to be expressed.

**Why is the last `data:` line's trailing line feed removed at dispatch?**
Because `data` appends a line feed after *every* field value, including the last one, so without the trim every single-line event would arrive with a spurious trailing newline. The spec removes exactly one character, and only if the buffer's last character is a line feed. The observable consequence is that a two-line payload arrives joined by one line feed with none at the end, and a deliberately-empty-line payload — two `data:` fields with empty values — arrives as a single line feed. It is a small rule that people rediscover the hard way when they diff a round-tripped string.

---

← [03 · Real-time: the shapes](03-real-time-server-sent-events-and-websockets-in-a-serverless.md) · [Chapter 15 overview](01-explanation.md) · Next → [03c · Producing the stream correctly](03c-producing-the-stream-correctly.md)
