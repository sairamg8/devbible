---
title: "1 · `EventSource` and the stream format"
sidebar_label: "1 · EventSource and the format"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events), [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource), [`EventSource()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource), [`EventSource.readyState`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/readyState), [`MessageEvent`](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent); and the [HTML Standard § server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) for `Last-Event-ID`. Documentation-validated; **no timings**.

**Server-sent events are a persistent HTTP response the server keeps writing to.** The
browser parses it into events, and — the part that matters — **reconnects and resumes by
itself**.

```js
const es = new EventSource("/updates");
es.addEventListener("message", (e) => apply(JSON.parse(e.data)));
es.addEventListener("error", () => {/* the browser is already retrying */});
```

🔴 **This is the API that gives you free what a WebSocket makes you build**: reconnection,
backoff and gap resumption ([13 · 04](../13-websocket/04-staying-connected.md) is that same
work done by hand). Its price is that it is **one-way and text-only** — the full comparison,
and when to choose which, is in [13 · 05](../13-websocket/05-when-not-to.md).

## The wire format

**The response is `Content-Type: text/event-stream`**, and messages are separated by a blank
line. Four field names, colon-delimited:

```
event: price
data: {"sku":"A1","cents":1299}
id: 4711
retry: 5000

data: a plain message with no event name

: this is a comment, and a useful keep-alive
```

| Field | Effect |
|---|---|
| `data` | the payload; **repeat the field for multiple lines**, joined with `\n` |
| `event` | names the event — dispatched as *that* type, **not** as `message` |
| `id` | "The event ID to set the `EventSource` object's last event ID value" |
| `retry` | "the browser will wait for the specified time before attempting to reconnect… must be an integer, specifying the reconnection time in milliseconds. If a non-integer value is specified, the field is ignored" |

⚠️ **A named `event:` does not fire the `message` handler.** That is the most common "my
events stopped arriving" report:

```js
es.addEventListener("price", handlePrice);   // ✅ matches `event: price`
es.onmessage = handleAnything;               // ❌ never sees it
```

⚠️ **`data` is always a string.** JSON is a convention, not a feature, and it must be parsed —
inside a `try`, because a proxy's error page or a truncated frame will otherwise throw in an
event handler ([13 · 02](../13-websocket/02-messaging.md) makes the same point for sockets).

## Reconnection and resumption — the whole point

**"By default, if the connection between the client and server closes, the connection is
restarted automatically."** The `error` event is informational; the browser is already
retrying, and `readyState` is back to `CONNECTING` (`0`) — `OPEN` is `1`, `CLOSED` is `2`,
and `CLOSED` is only reached by `es.close()` or an unrecoverable failure.

🔴 **Resumption is what makes this more than a reconnect loop.** When a message carries an
`id:`, the browser remembers it, and per the HTML Standard the `Last-Event-ID` request header
"reports an `EventSource` object's last event ID string to the server when the user agent is
to reestablish the connection" — encoded as UTF-8 and sent only when that string is not
empty.

```http
GET /updates HTTP/1.1
Last-Event-ID: 4711
```

**So the server can replay exactly the gap**, which is the `seq`/`resume` protocol from
[13 · 04](../13-websocket/04-staying-connected.md), standardised and free. ⚠️ **An `id:`
field with no value resets the last event ID to the empty string**, so no header is sent on
the next attempt — a deliberate way to say "do not try to resume".

⚠️ **The server has to actually implement replay.** The header arrives whether or not anyone
reads it, and an app that ignores it silently loses every event that happened during the gap
— which looks fine in development, where the gap is a second.

## Handling the connection

```js
es.readyState;   // 0 CONNECTING · 1 OPEN · 2 CLOSED
es.close();      // ✅ stops retrying — the only way out
```

🔴 **`close()` is not optional.** Nothing stops the retry loop on its own, so a component that
opens an `EventSource` and unmounts without closing leaves a connection reconnecting forever
in the background.

**Two more shapes worth knowing:**

- **`new EventSource(url, { withCredentials: true })`** is the only option there is —
  "whether the `EventSource` object was instantiated with cross-origin (CORS) credentials
  set". ⚠️ **There is no way to set a header**, so authentication is cookies or a
  ticket-in-the-URL, exactly as for WebSocket ([13 · 05](../13-websocket/05-when-not-to.md)).
- ✅ **`EventSource` is subject to CORS** — unlike WebSocket — so a cross-origin stream needs
  the usual `Access-Control-Allow-Origin` ([05 · CORS](../05-cors-client-side/README.md)), and
  the browser enforces it.
- **It is available in Web Workers**, which is where a busy stream belongs.

## The limits to know before choosing it

- 🔴 **The HTTP/1.1 connection cap.** MDN: "When not used over HTTP/2, SSE suffers from a
  limitation to the maximum number of open connections… the limit is *per browser* and is set
  to a very low number (6). The limit is per browser + domain" — **so the seventh tab simply
  hangs.** "When using HTTP/2, the maximum number of simultaneous HTTP streams is negotiated
  between the server and the client (defaults to 100)."
- **One-way.** "This is a one-way connection, so you can't send events from a client to a
  server." Client actions go over `fetch` — which is usually the right shape anyway.
- **Text only.** Binary means base64 and ~33%
  ([Phase 5 · 26 · 02](../../phase-5-built-in-library/26-text-encoding/02-base64.md)).
- ⚠️ **Intermediaries buffer.** A proxy or a compression layer that buffers the response
  defeats the whole mechanism, which is why production SSE endpoints disable buffering and
  send periodic comment lines (`:` keep-alives) to keep the connection warm.

## Gotchas

**Symptom → cause → fix.**

- **Events arrive in the network panel but no handler runs** → the stream uses `event:` names
  and the code listens for `message` → `addEventListener("<name>", …)`.
- **Nothing arrives at all** → the response is not `text/event-stream`, or a proxy is
  buffering → set the content type and disable buffering.
- **Multi-line payloads arrive truncated** → each line needs its own `data:` field →
  repeat the field; the lines are joined with `\n`.
- **The `retry` field is ignored** → it was not an integer → send milliseconds as an integer.
- **The client reconnects forever after the user leaves the page** → `close()` was never
  called → close on teardown.
- **A gap in data after a disconnect, silently** → the server never implemented
  `Last-Event-ID` replay → read the header and replay, or refetch a snapshot.
- **The seventh tab of the app hangs** → six connections per browser+domain on HTTP/1.1 →
  serve over HTTP/2.
- **Cross-origin stream is blocked** → SSE *is* subject to CORS → send
  `Access-Control-Allow-Origin`, and `withCredentials` plus a specific origin if cookies are
  involved.
- **`JSON.parse` throws inside the handler** → the payload was not JSON → wrap it.

## Interview questions

**What does `EventSource` give you that a WebSocket does not?** Automatic reconnection and
standardised resumption: the browser retries by itself, the server can tune the delay with
`retry:`, and the last `id:` comes back as a `Last-Event-ID` header so the gap can be
replayed. All of that is hand-written code on a WebSocket.

**Why does a named event not reach `onmessage`?** Because the `event:` field sets the
dispatched event type. `message` is only the default when no name is given.

**How does the server know where to resume?** From the `Last-Event-ID` request header, set
from the last `id:` field the browser saw — but only if the server implements the replay.

**What are SSE's hard limits?** One-way, text-only, and — over HTTP/1.1 — six connections per
browser and domain, so a user with several tabs open stops connecting. HTTP/2 replaces that
with negotiated streams.

**How do you authenticate an `EventSource`?** Cookies with `withCredentials`, or a token in
the URL — there is no way to set a request header. Unlike WebSocket, it *is* subject to CORS,
so cross-origin use needs the response headers too.

**How do you stop one?** `close()`. Nothing else ends the retry loop, and an unclosed stream
keeps reconnecting after the component that made it is gone.

---

← [Overview](./README.md) · [Phase 11](../README.md)
