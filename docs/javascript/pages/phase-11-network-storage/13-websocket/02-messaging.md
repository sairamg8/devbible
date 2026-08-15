---
title: "2 · Messaging"
sidebar_label: "2 · Messaging"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`WebSocket.send()`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send), [`binaryType`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/binaryType), [`bufferedAmount`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/bufferedAmount), [`MessageEvent`](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent), [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket), [`WebSocketStream`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocketStream). Documentation-validated; **no timings**.

## `send()` — four types, and two ways to lose data

```js
ws.send("plain text");                  // string → UTF-8 text frame
ws.send(JSON.stringify(message));       // still a string
ws.send(arrayBuffer);                   // binary frame
ws.send(uint8Array);                    // TypedArray or DataView → binary frame
ws.send(blob);                          // binary frame — ⚠️ blob.type is IGNORED
```

**A string is encoded as UTF-8**, and `bufferedAmount` grows by the **byte** count, not the
character count — the distinction from
[Phase 5 · 26 · 01](../../phase-5-built-in-library/26-text-encoding/01-textencoder-and-textdecoder.md).
For a `Blob`, MDN is explicit that "the `Blob.type` is ignored": the wire carries bytes, and
nothing about the content type travels with them.

🔴 **The two failure modes are not symmetric, and that is the whole trap:**

| `readyState` | `send()` does |
|---|---|
| `CONNECTING` (0) | **throws `InvalidStateError`** |
| `OPEN` (1) | queues the data ✅ |
| `CLOSING` (2) / `CLOSED` (3) | **silently discards the data** |

**Sending too early throws; sending too late does nothing at all.** MDN: "The browser will
throw an exception if you call `send()` when the connection is in the `CONNECTING` state. If
you call `send()` when the connection is in the `CLOSING` or `CLOSED` states, the browser
will silently discard the data."

The silent half is the one that reaches production. A message sent while the socket is dying
is gone, no error is raised, and the only symptom is state that quietly disagrees with the
server.

```js
function send(data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(data);
  else outbox.push(data);            // flush on the next "open" — chunk 4
}
```

**And `send()` is asynchronous** — "it does not wait for the data to be transmitted before
returning to the caller." It returning is not delivery, not receipt, and not acknowledgement.
If you need to know the server got something, the server has to say so, in your own protocol.

⚠️ **One more documented behaviour worth knowing:** "If the data can't be sent (for example,
because it needs to be buffered but the buffer is full), the socket is closed automatically."
Flooding your own outbound buffer does not throw — it drops the connection.

## Receiving

```js
ws.addEventListener("message", (e) => {
  e.data;   // string, Blob or ArrayBuffer
});
```

`message` is a
[`MessageEvent`](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent), the same
interface used by `postMessage` and `EventSource`. **Text frames always arrive as a string.**
Binary frames arrive as whatever `binaryType` says:

```js
ws.binaryType = "arraybuffer";   // default is "blob"
```

| `binaryType` | binary `e.data` | Use when |
|---|---|---|
| `"blob"` *(default)* | a `Blob` | you will hand it straight to an `<img>`, `fetch` body or IndexedDB — **the bytes may never be read** |
| `"arraybuffer"` | an `ArrayBuffer` | you will parse it now — a `DataView` or typed array over it, **no `await`** |

**Choose it by what you do next**, exactly as in
[12 · 01](../12-blob-file-filereader/01-blob-and-file.md): a `Blob` is a handle, an
`ArrayBuffer` is the bytes in memory. Parsing a `Blob` costs an extra asynchronous read;
holding an `ArrayBuffer` you only wanted to forward costs memory.

⚠️ **Set `binaryType` before messages can arrive** — right after construction. Changing it
later only affects subsequent frames, so a handler written for one type will see the other.

🔴 **A bare `JSON.parse(e.data)` is a latent crash.** Anything can arrive on that socket: a
plain-text error from a proxy, a heartbeat frame, a binary frame you did not expect, a
message from a newer server version. The parse throws inside an event handler, where nothing
is there to catch it.

```js
ws.addEventListener("message", (e) => {
  if (typeof e.data !== "string") return handleBinary(e.data);
  let msg;
  try { msg = JSON.parse(e.data); } catch { return; }   // ✅ never trust the wire
  route(msg);
});
```

## 🔴 Framing: you get messages, not a protocol

**What WebSocket gives you over raw TCP is message boundaries.** Each `message` event is one
complete message, in order, exactly as it was sent — you never reassemble a stream or hunt
for a delimiter.

**What it does not give you is anything about what the message *means*:**

- no message type
- no request/response pairing
- no acknowledgement
- no sequence number
- no schema or version

So every real application invents the same envelope. Write it deliberately rather than
discovering it in pieces:

```js
{ type: "order.updated", id: "c3f1", ts: 1730000000, seq: 412, payload: { … } }
```

| Field | Why it exists |
|---|---|
| `type` | one socket carries every kind of message; this is how you route |
| `id` | **correlates a reply to a request** — the socket has no such notion |
| `seq` | lets the client detect a **gap** after a reconnect (chunk 4) |
| `ts` | orders events that arrive out of band, and ages stale state |

**Request/response has to be built, because it does not exist:**

```js
const pending = new Map();

function request(type, payload) {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send(JSON.stringify({ type, id, payload }));
  });
}

// in the message handler
if (msg.id && pending.has(msg.id)) {
  pending.get(msg.id).resolve(msg.payload);
  pending.delete(msg.id);
}
```

⚠️ **That `pending` map leaks unless you also handle timeouts and disconnects.** Every entry
needs an `AbortSignal.timeout()` or an equivalent, and `close` must reject everything still
outstanding — otherwise a dropped connection leaves promises pending forever
([08 · 02](../08-aborting-and-timing-out/02-cancellation-as-a-lifecycle.md)).

**Ordering is guaranteed within one connection and across nothing else.** After a reconnect
you are a new client, and any assumption that message *n+1* follows message *n* is gone.

## `bufferedAmount`, and the backpressure you do not get

```js
ws.bufferedAmount;   // bytes queued by send() but not yet on the network
```

- It **resets to zero once all queued data has been sent**.
- 🔴 It **does not reset when the connection closes** — "if you keep calling `send()`, this
  will continue to climb." So `bufferedAmount === 0` is not a health check, and a growing
  value can mean either *a slow network* or *a dead socket you have not noticed yet*.

**Outbound, that number is the only lever there is** — there is no drain event, so you check
it before sending anything large or frequent:

```js
if (ws.bufferedAmount < MAX_QUEUED) ws.send(frame);
else dropOrCoalesce(frame);          // cursor positions, telemetry, live prices
```

**For high-rate updates, coalescing beats queueing.** The tenth cursor position makes the
previous nine worthless; send the latest on a `requestAnimationFrame` tick instead of all ten.

🔴 **Inbound there is no backpressure at all, and MDN says so plainly:**

> "The `WebSocket` API has no way to apply backpressure, therefore when messages arrive
> faster than the application can process them, the application will either fill up the
> device's memory by buffering those messages, become unresponsive due to 100% CPU usage, or
> both."

**The server cannot be told to slow down.** So the defences are yours: keep the `message`
handler cheap, buffer into an array and drain on a frame, subscribe to less, or move the
socket into a **Web Worker** so parsing never touches the main thread.

⚠️ **[`WebSocketStream`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocketStream)
is the promise-and-streams API that *does* apply backpressure automatically** — and it is
**experimental and non-standard**, not part of any specification yet. Know it exists; do not
ship it.

## Gotchas

**Symptom → cause → fix.**

- **`InvalidStateError` on the first send** → sending before `open`, in `CONNECTING` → queue
  and flush in the `open` handler.
- **Messages vanish with no error near a disconnect** → `send()` in `CLOSING`/`CLOSED` is
  silently discarded → check `readyState`, queue, and re-send after reconnect.
- **The message handler crashes on some messages** → `JSON.parse` on a non-JSON or binary
  frame → type-check `e.data` and wrap the parse.
- **Binary handling works in one place and not another** → `binaryType` was changed after
  frames started arriving, or left at the default `"blob"` → set it immediately after
  construction.
- **`bufferedAmount` climbs forever** → still calling `send()` after the socket closed; the
  value does not reset on close → gate every send on `readyState`.
- **The tab gets slow under load and then unresponsive** → no inbound backpressure exists →
  coalesce, batch on a frame, subscribe to less, or parse in a worker.
- **The socket closes by itself when sending a lot** → the outbound buffer filled and "the
  socket is closed automatically" → watch `bufferedAmount` and drop or coalesce.
- **Replies get matched to the wrong request after a reconnect** → correlation ids reused, or
  the `pending` map kept across connections → clear the map on `close` and reject what is
  outstanding.
- **A `Blob` sent with a `type` arrives without it** → "the `Blob.type` is ignored" → put the
  content type in your envelope.

## Interview questions

**What happens if you `send()` before the socket is open, and after it closed?** Before: it
throws `InvalidStateError`. After: the data is silently discarded. The silent case is the
dangerous one, which is why sends are gated on `readyState` and queued.

**Does `send()` returning mean the message was delivered?** No. It is asynchronous and only
enqueues; `bufferedAmount` tracks what is still queued. Delivery confirmation must be part of
your own protocol.

**WebSocket gives you message boundaries — what does it not give you?** Types, ids,
acknowledgements, sequence numbers and versioning. Request/response is built on top with a
correlation id and a pending map, and that map must be cleaned up on timeout and on close.

**When would you choose `binaryType = "arraybuffer"` over the default `"blob"`?** When you are
about to parse the bytes — an `ArrayBuffer` is already in memory and needs no `await`. Keep
`"blob"` when the data is only forwarded to an `<img>`, a `fetch` body or IndexedDB, because
the bytes may never need reading.

**Why can a WebSocket application be overwhelmed by inbound messages?** Because the API has no
backpressure — the reader cannot slow the sender. The mitigations are cheaper handlers,
batching, subscribing to less, or a worker; `WebSocketStream` solves it properly but is
experimental and non-standard.

---

← [1 · Connecting](./01-connecting.md) · Next → **3 · Closing** *(next)*
