---
title: "13 · WebSocket"
sidebar_label: "Overview"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket), [`WebSocket()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket), [The WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API), [Writing WebSocket client applications](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications), [`CloseEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent), [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource). Documentation-validated; **no timings**.

**A WebSocket is a persistent, bidirectional, message-oriented connection.** It starts as
an HTTP request, upgrades, and then both sides can send at any time until someone closes
it.

🔴 **The API is small and the hard parts are not in it.** Connecting, sending and receiving
are four lines. Reconnection, backoff, detecting a connection that is dead but not closed,
queueing messages while disconnected, and resynchronising state after a gap are all yours
to write — and they are the whole reason production WebSocket code is longer than the
examples.

⚠️ **And the first question is whether you need one at all.** A WebSocket is a stateful
connection per user; it defeats HTTP caching, complicates load balancing and scaling, and
survives neither a sleeping laptop nor a flaky network without help. Polling or
server-sent events are frequently the better answer, and the decision is in chunk 5.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Connecting](./01-connecting.md)** | Constructing *is* connecting; the URL, the schemes and mixed content; the HTTP handshake and `101 Switching Protocols`; 🔴 **WebSocket is not subject to CORS**, and what CSP `connect-src` does instead; sub-protocols; the `readyState` machine; the four events, and why `error` tells you nothing |
| 2 | **[Messaging](./02-messaging.md)** | Sending text and binary, and the two ways `send()` loses data; `binaryType`; 🔴 **framing — the protocol gives you messages, your application still needs an envelope**; request/response built by hand; `bufferedAmount`, and 🔴 **the inbound backpressure the API does not have** |
| 3 | **[Closing](./03-closing.md)** | Closing is a **handshake**; `close(code, reason)` and what it rejects; the 123-**byte** reason limit; `CloseEvent`'s `code`, `reason` and `wasClean`; the close-code table, why **`1006` tells you nothing**, and using `4000`–`4999` to say "do not reconnect" |
| 4 | **[Staying connected](./04-staying-connected.md)** | 🔴 **Reconnection with backoff and jitter**, and why a naive retry loop takes your own server down; when to reset the counter; heartbeats, and why **TCP will not tell you the connection died**; bounded outboxes and what is safe to replay; resynchronising after a gap |
| 5 | **Authentication, and when not to** *(next)* | Authenticating a handshake you **cannot set headers on** — cookies, query strings, sub-protocols and the ticket pattern; and the honest comparison against polling, long polling, SSE and plain `fetch`, including what a persistent connection costs you |

## The whole API

```js
const ws = new WebSocket("wss://example.com/socket");

ws.addEventListener("open",    () => ws.send(JSON.stringify({ type: "hello" })));
ws.addEventListener("message", (e) => handle(JSON.parse(e.data)));
ws.addEventListener("close",   (e) => reconnect(e));
ws.addEventListener("error",   () => {/* a close event always follows */});
```

**Four events, `send`, `close`, and `readyState`.** Everything else on this page is what
you build around them.

## Phase gate

You are done with this topic when you can say **why a reconnect loop needs jitter as well
as backoff**, and **why an application-level heartbeat is necessary when TCP already has
one**.

## Where this connects

- [01 · `fetch`](../01-fetch/README.md) — the request/response model this replaces, and usually should not
- [05 · CORS from the client side](../05-cors-client-side/README.md) — and why WebSocket is **not** subject to it, which matters for security
- [08 · Aborting and timing out](../08-aborting-and-timing-out/README.md) — the cancellation and lifecycle patterns reused here
- [12 · `Blob`, `File` and object URLs](../12-blob-file-filereader/README.md) — what a binary message arrives as
- **18 · Server-sent events** *(later in this phase)* — the simpler one-way alternative
- [Phase 5 · 25 · Typed arrays](../../phase-5-built-in-library/25-typed-arrays/README.md) — reading a binary frame

---

Start → [1 · Connecting](./01-connecting.md)
