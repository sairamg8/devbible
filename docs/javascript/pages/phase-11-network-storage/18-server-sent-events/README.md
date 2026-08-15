---
title: "18 · Server-sent events"
sidebar_label: "Overview"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events), [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource); HTML Standard § [server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html). Documentation-validated; **no timings**.

**Server-sent events are a long-lived HTTP response the server keeps writing to**, parsed by
the browser into events. One-way, text-only, and — the reason it exists — **reconnecting and
resuming on its own**.

🔴 **Know-tier: recognise that it hands you free the two hardest parts of a WebSocket
client** — automatic reconnection with a server-tunable delay, and gap replay through
`Last-Event-ID`.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`EventSource` and the stream format](./01-eventsource-and-the-stream-format.md)** | The `text/event-stream` format and its four fields; ⚠️ **why a named `event:` never reaches `onmessage`**; automatic reconnection, `retry:` and 🔴 **resumption via `Last-Event-ID`**; `readyState` and why `close()` is mandatory; `withCredentials`, CORS and the missing headers; and the limits — one-way, text-only, **six connections per domain on HTTP/1.1** |

## The shape in eight lines

```js
const es = new EventSource("/updates", { withCredentials: true });

es.addEventListener("price", (e) => apply(JSON.parse(e.data)));  // matches `event: price`
es.addEventListener("error", () => {/* the browser is already retrying */});

es.close();   // the only way to stop the retry loop
```

```
event: price
data: {"sku":"A1","cents":1299}
id: 4711

```

## Phase gate

You are done with this topic when you can say **what `Last-Event-ID` is for**, and **why a
stream using `event:` names never fires `onmessage`**.

## Where this connects

- [13 · 05 · WebSocket — when not to](../13-websocket/05-when-not-to.md) — the full comparison, and why SSE is the honest default for server → client
- [13 · 04 · Staying connected](../13-websocket/04-staying-connected.md) — the reconnection and gap-replay work SSE does for you
- [05 · CORS from the client side](../05-cors-client-side/README.md) — SSE **is** subject to CORS, unlike WebSocket
- [01 · `fetch`](../01-fetch/README.md) — where client → server actions go, since this direction is one-way

---

Start → [1 · `EventSource` and the stream format](./01-eventsource-and-the-stream-format.md)
