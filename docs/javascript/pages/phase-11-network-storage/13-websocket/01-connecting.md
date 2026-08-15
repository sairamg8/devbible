---
title: "1 · Connecting"
sidebar_label: "1 · Connecting"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`WebSocket()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket), [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket), [`readyState`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState), [`protocol`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/protocol), [Writing WebSocket client applications](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications), [Writing WebSocket servers](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers), [CSP `connect-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src). Documentation-validated; **no timings**.

## Constructing one *is* connecting

```js
const ws = new WebSocket("wss://example.com/socket");
```

**There is no `connect()` method.** The constructor starts the connection immediately and
returns a socket that is not yet usable. Everything you do next is arranged around that
one fact: you cannot create the socket early and open it later, and you cannot `await` it
— the only signal that it is ready is the `open` event.

⚠️ **So a socket created at module scope starts connecting at import time**, before your
app has decided whether it needs one, and possibly before you have a token to authenticate
with. Create it inside the code that owns it.

### The URL

**`ws:` and `wss:` are the WebSocket schemes**, and MDN also documents `http:` and `https:`
as accepted by the constructor — they are treated as the equivalent WebSocket scheme.
**A relative URL is allowed** and "is relative to the base URL of the calling script",
which is the clean way to avoid hardcoding a host:

```js
const url = new URL("/socket", location.href);
url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(url);
```

The constructor throws a **`SyntaxError` `DOMException`** if parsing of the URL fails, if
the scheme is anything other than those four, if the URL **has a fragment**, or if the
`protocols` argument is malformed (see below).

🔴 **Use `wss:` in anything real.** MDN is explicit: "In a real application, web pages
should be served using HTTPS, and the WebSocket connection should use `wss` as the
protocol", and "Most user agents now require a secure link for all WebSocket connections
unless they're on the same device or possibly on the same network." A `ws:` connection
from an `https:` page is **mixed content** — "WebSockets should not be used in a mixed
content environment" — and browsers block it. The `localhost` exemption is what makes the
mistake survive development and fail on deploy.

### The handshake, and why the first request is HTTP

The connection opens as an ordinary HTTP request that asks to change protocols:

```http
GET /chat HTTP/1.1
Host: example.com:8000
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

**`101 Switching Protocols` is the success status** — not `200`. The server proves it
understood the handshake by concatenating your `Sec-WebSocket-Key` with the fixed string
`258EAFA5-E914-47DA-95CA-C5AB0DC85B11`, taking the **SHA-1** hash and base64-encoding it
into `Sec-WebSocket-Accept`. That is a proof of protocol comprehension, **not** security —
the key is a nonce, not a secret.

**Three consequences of the handshake being HTTP:**

1. **Cookies are sent**, like any same-origin request — which is the usual way a browser
   WebSocket is authenticated, and the reason for the hijacking problem below.
2. **Proxies, load balancers and CDNs must be configured to pass `Upgrade` through.** A
   handshake that returns `200` or `400` instead of `101` is nearly always an
   intermediary, not your code.
3. **After the `101`, it is no longer HTTP.** No caching, no status codes, no retries by
   the browser, no `Retry-After` — everything HTTP gave you for free is now yours to
   build ([chunk 4](./04-staying-connected.md)).

### 🔴 WebSocket is not subject to CORS

The handshake **does** carry an `Origin` header — MDN's server-side guide says "All
browsers send an `Origin` header" — but **the browser does not enforce anything based on
the response.** There is no preflight, no `Access-Control-Allow-Origin` check, no opaque
result. Any page on the web can open a WebSocket to your server, and the user's cookies
go with it.

> "You can use this header for security (checking for same origin, automatically allowing
> or denying, etc.) and send a 403 Forbidden if you don't like what you see. This is
> effective against Cross Site WebSocket Hijacking (CSWH). However, be warned that
> non-browser agents can send a faked `Origin`. Most applications reject requests without
> this header." — MDN, *Writing WebSocket servers*

**So the origin check is the server's job, and it is not optional.** Read that alongside
[05 · CORS from the client side](../05-cors-client-side/README.md): the mental model
"the browser stops cross-origin reads" simply does not hold here.

⚠️ **And because it is cookie-authenticated by default, the fix is the same shape as
CSRF's** — check `Origin` on the server, and prefer a short-lived ticket over ambient
cookie authentication (chunk 5 covers how, given that you cannot set headers).

**The client-side lever that does exist is CSP.** `connect-src` restricts `fetch()`,
`XMLHttpRequest`, **`WebSocket`**, `EventSource` and `sendBeacon`, so a policy limits
which servers your own page may connect to:

```http
Content-Security-Policy: connect-src https://example.com wss://example.com
```

⚠️ **Name the `wss:` origin explicitly.** MDN warns that "`connect-src 'self'` does not
resolve to websocket schemes in all browsers" — a policy that looks complete can still
break the socket in some engines. **15 · CSP** *(not written yet)* covers the rest of the
policy.

## Sub-protocols

```js
const ws = new WebSocket(url, ["v2.chat.example.com", "v1.chat.example.com"]);
ws.addEventListener("open", () => {
  ws.protocol;   // whichever ONE the server chose, or "" if it chose none
});
```

**The second argument is "a single string or an array of strings representing the
sub-protocol(s) that the client would like to use, in order of preference"**, sent as
`Sec-WebSocket-Protocol`. Omitting it defaults to `[]`.

- **Only one sub-protocol can be selected per connection**, and the server picks it.
- **Read `ws.protocol` after `open`** to find out which — before that it is empty.
- A duplicated or otherwise invalid entry makes the **constructor throw `SyntaxError`**.

⚠️ **This is a version negotiation channel, not a feature flag.** It is the cleanest way
to roll out a breaking message-format change while old clients are still connected — the
server keeps supporting `v1` and answers `v2` to clients that ask. It is also, in
practice, the only place to put a token when you cannot set headers, which is a hack
covered honestly in chunk 5.

## The state machine

```js
ws.readyState;   // a number, always one of four
```

| Constant | Value | Meaning (MDN) |
|---|---|---|
| `WebSocket.CONNECTING` | `0` | "Socket has been created. The connection is not yet open." |
| `WebSocket.OPEN` | `1` | "The connection is open and ready to communicate." |
| `WebSocket.CLOSING` | `2` | "The connection is in the process of closing." |
| `WebSocket.CLOSED` | `3` | "The connection is closed or couldn't be opened." |

**It is a one-way trip: `0 → 1 → 2 → 3`, or `0 → 3` if the connection never opened.**
There is no path back to `CONNECTING`. **A socket that has closed cannot be reopened** —
reconnecting means constructing a *new* `WebSocket`, which is why reconnection logic owns
the socket variable rather than the other way round.

⚠️ **Compare the constants, not the literals** — `ws.readyState === WebSocket.OPEN` reads
as what it means, and `=== 1` does not. The constants exist on both the constructor and
the instance.

## The four events

```js
ws.addEventListener("open",    (e) => {});   // Event      — handshake succeeded
ws.addEventListener("message", (e) => {});   // MessageEvent — e.data
ws.addEventListener("error",   (e) => {});   // Event      — no detail, ever
ws.addEventListener("close",   (e) => {});   // CloseEvent — e.code, e.reason, e.wasClean
```

**`open` fires once**, when `readyState` becomes `OPEN`. It is the only correct place to
send the first message.

🔴 **`error` tells you nothing, and that is by design.** The event is a plain `Event` with
no code, no message and no reason — deliberately, so that a page cannot use a failing
socket to probe the local network. MDN: "On an error, the connection is closed and the
`close` event will be fired."

**So the two rules that follow are the ones people get wrong:**

- **Do not put recovery logic in `error`.** A `close` always follows it; if you retry in
  both handlers you get two reconnects for one failure.
- **`close` is the single place that knows what happened**, via `e.code` and `e.wasClean`
  — and even that is limited (chunk 2's close-code table explains why a failed handshake
  and a dropped cable both look like `1006`).

```js
ws.addEventListener("error", () => {});          // log only
ws.addEventListener("close", (e) => scheduleReconnect(e));   // ✅ one owner
```

⚠️ **A failed connection produces `error` then `close` with no `open` in between.** Any
state you set in `open` — "connected", a queue flush, a resubscribe — must therefore have
a matching reset in `close`, or the second attempt starts from a lie.

## Cleaning up

**A `WebSocket` is not garbage-collected while it is open** — the connection itself is a
live reference, so an unclosed socket in a component that unmounted keeps running,
keeps firing handlers, and keeps its listeners alive.

```js
// framework-agnostic teardown
const ac = new AbortController();
ws.addEventListener("message", onMessage, { signal: ac.signal });
ws.addEventListener("close", onClose, { signal: ac.signal });

function dispose() {
  ac.abort();          // every listener at once — 08 · 01
  ws.close(1000, "bye");
}
```

That `{ signal }` form is from
[08 · Aborting and timing out](../08-aborting-and-timing-out/01-the-controller-and-the-signal.md)
— it is the reason inline arrow-function listeners are removable here at all.

🔴 **Close on `pagehide`, not `unload`.** MDN's client guide recommends closing there
specifically so the page stays eligible for the back/forward cache:

```js
window.addEventListener("pagehide", () => ws.close());
```

An open socket is one of the things that can disqualify a page from bfcache, which turns
an instant back-navigation into a full reload.

## Gotchas

**Symptom → cause → fix.**

- **`SyntaxError` from `new WebSocket(...)` and nothing connects** → the URL has a
  fragment, an unsupported scheme, or the `protocols` array repeats a value → fix the
  URL; build it with `new URL()` rather than string concatenation.
- **Works on `localhost`, fails on the deployed site with a mixed-content console error**
  → the page is `https:` and the socket URL is hardcoded `ws:` → derive the scheme from
  `location.protocol`.
- **The handshake returns `200`/`400`/`502` instead of `101`** → a proxy, load balancer
  or dev-server middleware is not forwarding `Upgrade`/`Connection` → configure the
  intermediary; this is almost never application code.
- **`error` fires with an empty event and no way to tell why** → that is the specified
  behaviour, not a bug → read `close`'s `code`/`wasClean`, and log server-side.
- **Two reconnects per drop** → retry logic in both `error` and `close` → keep it in
  `close` only.
- **CSP blocks the socket even though `connect-src 'self'` is set** → some engines do not
  resolve `'self'` to `ws:`/`wss:` → list the `wss:` origin explicitly.
- **Any origin on the web can talk to your socket server with the user's cookies** →
  WebSocket is not subject to CORS and no browser check exists → validate `Origin`
  server-side and use a short-lived ticket instead of ambient cookies.
- **Back-navigation is slow after adding a socket** → the open connection blocks bfcache
  → `close()` on `pagehide`.

## Interview questions

**Why is the first WebSocket request an HTTP request, and what status means success?**
So it can reuse port 443, existing TLS and existing infrastructure. The client sends
`Upgrade: websocket` with a `Sec-WebSocket-Key`; success is **`101 Switching Protocols`**
with a `Sec-WebSocket-Accept` derived by SHA-1 of the key plus a fixed magic string.
After that the connection is no longer HTTP.

**Is a WebSocket subject to CORS?** No. The `Origin` header is sent, but the browser
enforces nothing on the response — there is no preflight and no
`Access-Control-Allow-Origin` check. Cookies are attached like any same-origin request,
so the server must check `Origin` itself or it is open to cross-site WebSocket hijacking.

**What does the `error` event give you?** Nothing — it is a bare `Event` with no
diagnostic detail, deliberately, and a `close` event always follows it. Diagnosis comes
from `close`'s `code`, `reason` and `wasClean`, plus server logs.

**Can you reuse a `WebSocket` after it closes?** No. `readyState` moves only forwards to
`CLOSED`; reconnecting means constructing a new socket, which is why the reconnect logic
must own the reference.

**When does `ws.protocol` have a value?** Only after `open`, and only if the server chose
one of the sub-protocols you offered — at most one per connection.

---

← [Overview](./README.md) · Next → [2 · Messaging](./02-messaging.md)
