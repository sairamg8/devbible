---
title: "EventSource is a reconnecting client the browser already ships — the specification decides when it retries, when it gives up permanently, and the difference is invisible unless you read readyState"
sidebar_label: "03f · Reconnection and readyState"
sidebar_position: 165
description: "The EventSource client as the specification defines it: nineteen lines of IDL, the three-value readyState, the two different failures that both fire error, why a clean end of stream reconnects forever, the retry field, and everything EventSource structurally cannot do."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the WHATWG HTML Living Standard
> [§9.2.2 The `EventSource` interface, §9.2.3 Processing model, §9.2.9 Garbage collection](https://html.spec.whatwg.org/multipage/server-sent-events.html);
> the WHATWG [Fetch Standard](https://fetch.spec.whatwg.org/) §2.2.5 (a request's default method);
> MDN [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) and
> [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).
> Documentation-verified against the specification text, **no sandbox run, no browser testing**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**The best reason to choose SSE is the one nobody demos: the browser already contains a reconnecting client, and its behaviour is specified rather than invented by a library. But that client is opaque — it gives you one URL, one boolean, three integers and a single `error` event that means two completely different things. This page is that client exactly as the specification writes it: which failures retry and which are terminal, why closing the stream cleanly makes the browser come back forever, the one knob the server has over the retry schedule, and the short list of things `EventSource` structurally cannot do. The resume half of the contract — `id:` and `Last-Event-ID` — is [03fa](03fa-designing-a-resumable-sse-stream.md).**

## The entire client API, in nineteen lines of IDL

There is no hidden surface. This is the whole interface:

```webidl
[Exposed=(Window,Worker)]
interface EventSource : EventTarget {
  constructor(USVString url, optional EventSourceInit eventSourceInitDict = {});

  readonly attribute USVString url;
  readonly attribute boolean withCredentials;

  // ready state
  const unsigned short CONNECTING = 0;
  const unsigned short OPEN = 1;
  const unsigned short CLOSED = 2;
  readonly attribute unsigned short readyState;

  // networking
  attribute EventHandler onopen;
  attribute EventHandler onmessage;
  attribute EventHandler onerror;
  undefined close();
};

dictionary EventSourceInit {
  boolean withCredentials = false;
};
```

Read that as a list of what you are *not* given: no method, no body, no headers, no timeout, no reconnect callback, no way to observe the current backoff, no access to the response status. One URL and one boolean. [03g · `fetch` and `ReadableStream`](03g-fetch-and-readablestream-when-you-need-headers.md) exists entirely because that dictionary has exactly one member.

The constructor's own steps confirm how little is configurable:

> *"Let corsAttributeState be Anonymous. If the value of eventSourceInitDict's withCredentials member is true, then set corsAttributeState to Use Credentials … Let request be the result of creating a potential-CORS request given urlRecord, the empty string, and corsAttributeState. … User agents **may** set (`Accept`, `text/event-stream`) in request's header list. Set request's cache mode to "no-store"."*

Note that even the `Accept` header is a *may*. Nothing about the request is yours.

## `readyState` is three values, and `CONNECTING` covers two very different situations

The spec's own definitions:

> *"`CONNECTING` (numeric value 0) — The connection has not yet been established, or it was closed and the user agent is reconnecting. `OPEN` (numeric value 1) — The user agent has an open connection and is dispatching events as it receives them. `CLOSED` (numeric value 2) — The connection is not open, and the user agent is not trying to reconnect. Either there was a fatal error or the `close()` method was invoked."*

> *"When the object is created, its `readyState` must be set to `CONNECTING` (0)."*

The load-bearing distinction is between `CONNECTING` and `CLOSED`, not between `CONNECTING` and `OPEN`. `CONNECTING` means *the browser is still working on your behalf* — it will try again on its own schedule. `CLOSED` means it has given up permanently, and nothing you do to that object will restart it; you must construct a new `EventSource`.

## Two different failures both fire `error`, and only one of them retries

This is the fact that makes SSE error handling confusing, and it is fully specified. There are two distinct algorithms, reached from different response conditions.

**Reestablish the connection** — retryable:

> *"Queue a task to run the following steps: If the `readyState` attribute is set to `CLOSED`, abort the task. Set the `readyState` attribute to `CONNECTING`. Fire an event named `error` at the `EventSource` object."*

**Fail the connection** — terminal:

> *"…sets the `readyState` attribute to `CLOSED` and fires an event named `error` at the `EventSource` object. Once the user agent has failed the connection, it does not attempt to reconnect."*

Both fire `error`. The `error` event carries no useful detail — no status code, no reason. **The only way to tell which one happened is to read `readyState` inside the handler.**

```ts
source.addEventListener('error', () => {
  if (source.readyState === EventSource.CLOSED) {
    // Terminal. The browser will not retry. Non-200, wrong Content-Type,
    // an aborted request, or something called close().
    onGiveUp()
  } else {
    // readyState === CONNECTING. A retry is already scheduled.
    // Do NOT construct a second EventSource here.
    onTransientDrop()
  }
})
```

Which responses land in which branch is stated in the constructor's fetch steps:

> *"If res is an aborted network error, then fail the connection. Otherwise, if res is a network error, then reestablish the connection, unless the user agent knows that to be futile, in which case the user agent may fail the connection. Otherwise, if res's status is not 200, or if res's `Content-Type` is not `text/event-stream`, then fail the connection."*

So: **a `500`, a `401`, a `302`, or a `200` with the wrong `Content-Type` is terminal.** A dropped TCP connection is retryable. That asymmetry is why [03b](03b-the-event-stream-format.md) insists you never surface an application error as a status code once you have decided to stream — a `500` is not retried, it is abandoned.

## A clean end of stream is a reconnect, not a finish

The most counter-intuitive line in the specification, and the origin of the "why is my handler being invoked in a loop" bug:

> *"Let processEventSourceEndOfBody given response res be the following step: if res is not a network error, then reestablish the connection."*

When your Route Handler calls `controller.close()`, the response body ends normally. That is not a network error, so **the browser reconnects.** There is no server-side way to say *we are done, stop asking*. If your stream is finite — a job that finished, an export that completed — the client must call `close()` when it sees your terminal event:

```ts
source.addEventListener('job-complete', (e) => {
  render(JSON.parse((e as MessageEvent).data))
  source.close() // the ONLY way to stop the reconnect loop
})
```

Without that `close()`, a handler that streams three progress events and closes becomes an endless poll at whatever the reconnection time happens to be.

## The reconnect algorithm, in order

From §9.2.3. These steps run in parallel with the page, not as a task:

1. If `readyState` is `CLOSED`, abort — `close()` wins over a pending reconnect.
2. Set `readyState` to `CONNECTING`, fire `error`.
3. > *"Wait a delay equal to the reconnection time of the event source."*
4. > *"Optionally, wait some more. In particular, if the previous attempt failed, then user agents might introduce an exponential backoff delay to avoid overloading a potentially already overloaded server. Alternatively, if the operating system has reported that there is no network connectivity, user agents might wait for the operating system to announce that the network connection has returned before retrying."*
5. If `readyState` is no longer `CONNECTING`, return.
6. Set `Last-Event-ID` in the request's header list, if there is one — [03fa](03fa-designing-a-resumable-sse-stream.md).
7. Fetch the request again.

Step 4 is the one to internalise: **backoff is optional and implementation-defined.** The specification permits a user agent to retry at exactly your `retry:` interval forever. You cannot assume the browser will soften a reconnect storm, so the server has to survive one — see [03h · What silently breaks SSE in production](03h-what-silently-breaks-sse-in-production.md) for what a synchronised reconnect does to a function-per-connection deployment.

The initial delay is not yours either:

> *"A reconnection time, in milliseconds. This must initially be an implementation-defined value, probably in the region of a few seconds."*

"Probably in the region of a few seconds" is the entire guarantee. If the delay matters to your design, set it yourself.

## `retry:` — the server owns the client's schedule

The only knob you get, and it lives inside the stream:

> *"If the field name is "retry" — If the field value consists of only ASCII digits, then interpret the field value as an integer in base ten, and set the event stream's reconnection time to that integer. Otherwise, ignore the field."*

It is sticky: once set it survives reconnects for the lifetime of that `EventSource` object. Send it once, first thing:

```ts
// Inside the Route Handler's ReadableStream start(), before anything else.
controller.enqueue(encoder.encode('retry: 5000\n\n'))
```

It is also your load-shedding lever. A handler under pressure can raise the reconnection time *on the way out*, pushing every client it is about to drop into a longer wait:

```ts
function shedLoad(controller: ReadableStreamDefaultController<Uint8Array>) {
  // Slows every client that reconnects from this point onward.
  controller.enqueue(encoder.encode('retry: 30000\n'))
  controller.enqueue(encoder.encode('event: backoff\ndata: {"reason":"overloaded"}\n\n'))
  controller.close()
}
```

The ordering matters: `retry:` has to reach the client *before* the socket goes away, because a client that has already lost the connection will never read it.

## The complete client, with the parts people leave out

```tsx
'use client'
import { useEffect, useState } from 'react'

type Status = 'connecting' | 'live' | 'offline'

export function BoardFeed({ boardId }: { boardId: string }) {
  const [status, setStatus] = useState<Status>('connecting')
  const [items, setItems] = useState<Activity[]>([])

  useEffect(() => {
    const source = new EventSource(`/api/boards/${boardId}/events`)

    source.addEventListener('open', () => setStatus('live'))

    source.addEventListener('snapshot', (e) => {
      setItems(JSON.parse((e as MessageEvent).data).items)
    })

    source.addEventListener('activity', (e) => {
      setItems((prev) => [JSON.parse((e as MessageEvent).data), ...prev])
    })

    source.addEventListener('auth-expired', () => {
      source.close() // terminal by our own protocol, not the browser's
      redirectToLogin()
    })

    source.addEventListener('error', () => {
      // CLOSED is terminal; CONNECTING means a retry is already scheduled.
      setStatus(source.readyState === EventSource.CLOSED ? 'offline' : 'connecting')
    })

    // 🔴 Required. An open EventSource is strongly referenced from the global
    // object, so it is not collected when the component unmounts.
    return () => source.close()
  }, [boardId])

  return <Feed status={status} items={items} />
}
```

That cleanup is not hygiene, it is specified reachability:

> *"While an `EventSource` object's `readyState` is `OPEN`, and the object has one or more event listeners registered for `message` or `error` events, there must be a strong reference from the `Window` or `WorkerGlobalScope` object that the `EventSource` object's constructor was invoked from to the `EventSource` object itself."*

Drop your reference without calling `close()` and the connection stays open, the Route Handler on the server stays alive, and in a client-side-routed app you accumulate one live stream per navigation.

## What `EventSource` structurally cannot do

| You want | `EventSource` | Why |
|---|---|---|
| An `Authorization: Bearer …` header | ❌ | The init dictionary has one member, `withCredentials` |
| Any other custom request header | ❌ | Same |
| A `POST` body — a filter, a query, a subscription list | ❌ | The request is a `GET`; the spec never sets a method, and Fetch says *"Unless stated otherwise it is `GET`"* |
| Cross-origin cookies | ✅ | `new EventSource(url, { withCredentials: true })` |
| To read the response status or headers | ❌ | Nothing is exposed; a non-`200` is only ever an `error` event |
| To control the backoff curve | ❌ | Only `retry:`, and only from the server |
| To abort mid-request | ✅ | `close()` |
| To run inside a Worker | ✅ | `[Exposed=(Window,Worker)]` — the spec's own answer to the per-domain connection limit |

The header row is the one that decides architectures. If your API is a bearer-token API, `EventSource` cannot call it — the token has to go in the URL, where it lands in access logs, referrers and browser history, or in a cookie. When neither is acceptable you drop to `fetch` and write the client yourself, headers, ticket-minting and all: [03g · `fetch` and `ReadableStream`](03g-fetch-and-readablestream-when-you-need-headers.md). The other structural ceiling — how many of these connections a browser will hold open at once, and what a synchronised reconnect after a deploy does to your capacity — is production behaviour rather than API surface, and lives in [03h · What silently breaks SSE in production](03h-what-silently-breaks-sse-in-production.md).

## Gotchas

**★ Symptom: your handler is invoked over and over in production and you never wrote a poll.** Cause: the stream closes normally and the browser reconnects, because a clean end of body is a reconnect — *"if res is not a network error, then reestablish the connection."* Fix: for a finite stream, tell the client it is finished and have the client `close()`. The server cannot do it alone:

```ts
// server
controller.enqueue(encodeEvent({ event: 'done', data: { ok: true } }))
controller.close()
```

```ts
// client
source.addEventListener('done', () => source.close())
```

**★ Symptom: an expired session kills the feed permanently and only a page reload fixes it.** Cause: the handler returned `401`, and a non-`200` status *fails* the connection — `readyState` becomes `CLOSED` and *"it does not attempt to reconnect."* Fix: authorize before you open the stream so a genuinely unauthenticated request gets a real `401` at connect time, and report mid-stream expiry as an application event the client can act on:

```ts
// The stream is already open; a status code is no longer available to you.
controller.enqueue(encodeEvent({ event: 'auth-expired', data: {} }))
controller.close()
```

**★ Symptom: `error` fires constantly and your outage counter climbs even though the feed works.** Cause: you counted `error` events as failures. The spec fires `error` as *step 2 of reestablishing* — it is the "I am about to retry" notification, not an exception. Fix: branch on `readyState` and escalate only on `CLOSED`:

```ts
source.onerror = () => {
  if (source.readyState === EventSource.CLOSED) reportOutage()
}
```

**★ Symptom: after a network blip the client has two streams and every event renders twice.** Cause: an `onerror` handler that constructs a replacement `EventSource`. The browser was already reconnecting the original, and now both are live. Fix: never create a new `EventSource` from `error` unless `readyState` is `CLOSED`, and never without closing the old one first:

```ts
source.onerror = () => {
  if (source.readyState !== EventSource.CLOSED) return // already retrying
  source.close()
  scheduleFreshConnection()
}
```

**★ Symptom: the reconnect delay you set with `retry:` is ignored.** Cause: either the value was not pure ASCII digits — `retry: 5_000`, `retry: 5e3`, a float from a division — or it never reached the client because you emitted it just before closing. Fix: send `retry:` as the first bytes of every stream, as an integer, so even a client that connects and immediately drops has already received it:

```ts
controller.enqueue(encodeEvent({ retry: Math.trunc(delayMs), data: 'connected' }))
```

**★ Symptom: navigating away from the page leaves a Route Handler running on the server.** Cause: the component unmounted without calling `close()`. The spec keeps a strong reference from the global object while listeners are registered, so the object is not collectable and nothing aborts the fetch. Fix: `return () => source.close()` from the effect. In React 19's development Strict Mode the effect runs twice, so a missing cleanup shows up immediately as two connections — treat that as the check, not as a bug to suppress.

**★ Symptom: an `EventSource` created during render, not in an effect.** Cause: treating it as a value rather than a subscription. Every render then opens a connection and none of them are closed. Fix: it belongs in `useEffect` with a cleanup, keyed on whatever identifies the stream — the `[boardId]` dependency in the component above is the whole subscription identity, and getting it wrong either leaks streams or fails to switch boards.

## Interview questions

**★ Both a dropped Wi-Fi connection and a `500` from the server fire the same `error` event. How do you tell them apart, and why does it matter?**
By reading `readyState` inside the handler, because the two go through different specified algorithms. A network error runs *reestablish the connection*, which sets `readyState` to `CONNECTING` and then fires `error` — the browser is telling you it is about to retry. A non-`200` status, or a `200` whose `Content-Type` is not `text/event-stream`, runs *fail the connection*, which sets `readyState` to `CLOSED` and fires `error`; the spec then says *"Once the user agent has failed the connection, it does not attempt to reconnect."* It matters because the two need opposite responses: on `CONNECTING` you show a reconnecting indicator and otherwise do nothing, and on `CLOSED` you must construct a new `EventSource` yourself or the feed is dead until a page reload. It also constrains the server — once you have decided to stream, you can never again report a failure as a status code, because that is the terminal branch.

**★ Your handler streams a job's progress and calls `controller.close()` when the job finishes. What does the browser do?**
It reconnects. The end-of-body step is *"if res is not a network error, then reestablish the connection"*, and a clean close is not a network error, so the browser waits the reconnection time and issues the request again — forever. There is no "we are finished" signal in the protocol at all. The fix is a terminal application event plus `source.close()` on the client; the client is the only party that can stop the loop.

**★ A colleague sets `retry: 100` so the feed "recovers instantly". What is wrong with that?**
It converts every outage into a self-inflicted flood. Backoff is optional in the spec — *"user agents might introduce an exponential backoff delay"* — so you cannot assume the browser will soften it, and in a serverless deployment each reconnect is a fresh function invocation rather than a cheap socket reuse. With a hundred connected clients and a 100 ms retry, an intermediary that drops everything at once produces roughly a thousand invocations a second against a service that is already unhealthy. Worse, they are synchronised, because every client took the same interval from the same stream. A sane value is seconds, jittered per connection on the server, and raised deliberately while you are shedding load.

**★ Why does an `EventSource` that goes out of scope keep its connection open?**
Because the specification makes it reachable. While `readyState` is `OPEN` and the object has a `message` or `error` listener registered, *"there must be a strong reference from the `Window` or `WorkerGlobalScope` object … to the `EventSource` object itself"*, and the same holds while it is `CONNECTING` with an `open`, `message` or `error` listener. Dropping your own reference therefore collects nothing. Only `close()` — or the document going away permanently, which forcibly closes it — aborts the fetch. In an SPA with client-side routing that is the difference between one connection and one per navigation, and on the server it is a Route Handler invocation that stays alive and, on a serverless platform, stays billable.

**★ The spec says the initial reconnection time is "implementation-defined, probably in the region of a few seconds". What do you do with that?**
Stop depending on it. If the delay matters — because you are pricing invocations, or because a five-second gap in a trading UI is unacceptable, or because you want a thundering herd spread out — send `retry:` yourself, as the first bytes of the stream, so it is set before anything can go wrong. Treat the browser's default as "some number you did not choose, which differs between engines and may change". The corollary is that `retry:` is the only cross-browser control you have over reconnect timing, which is why it is worth sending even when the default would probably have been fine.

---

← [03e · Pull sources and back-pressure](03e-pull-sources-and-back-pressure.md) · [Chapter 15 overview](01-explanation.md) · Next → [03fa · Designing a resumable SSE stream](03fa-designing-a-resumable-sse-stream.md)
