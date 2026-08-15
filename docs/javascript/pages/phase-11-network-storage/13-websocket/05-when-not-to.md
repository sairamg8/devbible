---
title: "5 · Authentication, and when not to"
sidebar_label: "5 · Auth, and when not to"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`WebSocket()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket), [Writing WebSocket servers](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers), [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events), [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource), [`WebTransport`](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport), [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch). Documentation-validated; **no timings**.

## 🔴 You cannot set a header on the handshake

```js
new WebSocket(url);
new WebSocket(url, protocols);
```

**That is the entire constructor.** There is no init object, no `headers` — so
`Authorization: Bearer …`, the way every other request in the app authenticates, is simply
not available from a browser. The handshake *is* an HTTP request ([chunk 1](./01-connecting.md)),
but you do not get to write it.

**Four things fit through the gap, and one of them is the answer:**

| Approach | Reality |
|---|---|
| **Cookies** | Sent automatically, work with `HttpOnly`, need no code — **and are exactly what makes CSWSH possible**, because WebSocket is not subject to CORS |
| **Token in the query string** | Works everywhere — and **the URL lands in access logs, proxy logs and error reports** |
| **Token as a sub-protocol** | Abuses `Sec-WebSocket-Protocol`; the server must echo the value back, and it is still a header you did not choose |
| **✅ A short-lived ticket** | An authenticated HTTP call mints a single-use, seconds-long ticket; the socket URL carries **that**, not the session |

### Cookies, and the CSWSH problem again

Cookies ride along because the handshake is an ordinary request — MDN's server guide lists
`Cookie` among the headers a client may send. That makes them the least-code option and the
one with the sharp edge: **any origin can open a socket to your server and the cookies go
with it**, because there is no CORS check to stop it ([chunk 1](./01-connecting.md)).

**So cookie-authenticated sockets require the server to validate `Origin`** — and to treat a
missing `Origin` as a rejection. `SameSite` helps in the same direction it helps for CSRF: a
handshake is not a top-level navigation, so `SameSite=Lax` cookies are not attached to a
cross-site one ([09 · 02](../09-cookies/02-tokens-and-samesite.md)). Neither check is a
substitute for the other.

### Why the query string is worse than it looks

`wss://example.com/socket?token=eyJhbGciOi…` works, and that is the problem — it looks fine
in development, where nothing is logging. In production the full URL is written to the
server's access log, the load balancer's log, any proxy in between, and often into error
tracking. **A long-lived session token in a log file is a credential you have to rotate.**

🔴 **Which is why the ticket pattern exists:**

```js
const { ticket } = await fetch("/api/ws-ticket", { method: "POST", credentials: "include" })
  .then((r) => r.json());                       // authenticated normally, headers and all

const ws = new WebSocket(`${wsUrl}?ticket=${encodeURIComponent(ticket)}`);
```

**The ticket is single-use, expires in seconds, and grants nothing but this connection.** In
a log it is worthless by the time anyone reads it. The real credential never leaves the HTTP
request, where you *can* set headers.

⚠️ **Mint a fresh ticket on every reconnect attempt**, not once at startup — after a long
backoff the old one has expired, and a client that retries with a dead ticket loops forever
against a `4xxx` close ([chunk 4](./04-staying-connected.md)).

### First-message authentication

The other common shape is to connect first and authenticate as the first message:

```js
ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "auth", token })));
// server: no valid auth within N seconds → close(4001, "unauthenticated")
```

**It keeps the token out of the URL** and fits the envelope you already have
([chunk 2](./02-messaging.md)). ⚠️ **But the connection exists before anyone is
authenticated**, so unauthenticated sockets consume server resources and must be
rate-limited and closed on a short timer.

### 🔴 Tokens expire; connections do not notice

**A socket open for hours outlives a token minted for minutes.** Nothing in the protocol
re-checks it, so the server must — periodically, and by closing with a distinct application
code when it fails:

```js
FATAL.add(4001);   // "re-authenticate over HTTP, then reconnect" — never a blind retry
```

Without that, an expired session produces a client that reconnects forever and a server that
rejects it forever ([chunk 3](./03-closing.md)).

## When *not* to use a WebSocket

**The question is not "do I want live updates" — it is "which direction, how often, and can
I afford a stateful connection".**

| | Direction | Reconnects itself | Payload | Notes |
|---|---|---|---|---|
| **`fetch` on an interval** | pull | n/a | anything | **HTTP caching, `ETag`, retries, headers** all still work |
| **Long polling** | pull, near-live | per request | anything | a held request per client — most of a socket's cost, little of its benefit |
| **`EventSource` (SSE)** | **server → client only** | ✅ **built in** | **text only** | `retry:` and `Last-Event-ID` give resumption for free |
| **WebSocket** | **bidirectional** | ❌ **you write it** | text + binary | everything in chunks 1–4 is yours to maintain |
| **`WebTransport`** | bidirectional | ❌ | streams + **unreliable datagrams** | HTTP/3; "Newly available. Since March 2026…" per MDN — check your targets |

### SSE is the one people skip and should not

**`EventSource` is a persistent HTTP response in `text/event-stream` format**, and it hands
you for free the two hardest things in chunk 4:

- **Reconnection.** "By default, if the connection between the client and server closes, the
  connection is restarted automatically", and the server tunes the delay with a `retry:`
  field in the stream.
- **Resumption.** An `id:` field sets the last event ID, which the browser sends back on
  reconnect — so the server can replay the gap. That is the `seq`-and-`resume` protocol from
  chunk 4, standardised.

**Its limits are real and you should know them before choosing:**

- 🔴 **One-way.** MDN: "This is a one-way connection, so you can't send events from a client
  to a server." Client → server goes over ordinary `fetch`, which is usually fine — most
  "realtime" apps are read-heavy with occasional writes.
- **Text only.** Binary means base64, at ~33% overhead
  ([Phase 5 · 26 · 02](../../phase-5-built-in-library/26-text-encoding/02-base64.md)).
- 🔴 **The HTTP/1.1 connection limit bites hard.** MDN: "When not used over HTTP/2, SSE
  suffers from a limitation to the maximum number of open connections… the limit is *per
  browser* and is set to a very low number (6). The limit is per browser + domain" — so six
  tabs and the seventh hangs. **Over HTTP/2 the limit becomes negotiated streams (default
  100)**, which is why SSE is a different proposition on a modern stack.
- **It cannot set headers either** — only `withCredentials` for cross-origin cookies. The
  ticket pattern applies here too.

⚠️ **And SSE *is* subject to CORS**, unlike WebSocket — a genuine security advantage, not
merely a difference.

### What a persistent connection actually costs

**Choosing a WebSocket is choosing to hold state.** The bill:

- **Every intermediary must cooperate.** Load balancers need `Upgrade` forwarding and long
  idle timeouts; some serverless and edge platforms cannot hold a connection at all.
- **Horizontal scaling stops being free.** Two servers means a client subscribed on one
  cannot see an event published on the other without a pub/sub bus between them.
- **You lose HTTP.** No caching, no CDN, no conditional requests, no `Retry-After`, no status
  codes — a request-shaped problem now needs a hand-built request/response layer
  ([chunk 2](./02-messaging.md)).
- **Observability gets worse.** One long-lived connection is a single line in an access log;
  message-level visibility is something you build.
- **Capacity is measured in connections, not requests per second** — including all the idle
  ones from open background tabs.

### The decision, briefly

- **Server → client only** (feeds, notifications, progress, dashboards) → **SSE**, and write
  client actions with `fetch`.
- **Genuinely bidirectional and latency-sensitive** (chat with typing state, collaborative
  editing, multiplayer, live trading) → **WebSocket**.
- **Occasional freshness** (a list that should not be stale) → **polling with `ETag`** is
  boring, cacheable and almost always enough.
- **Media, games, or data where "late" is worse than "lost"** → **WebTransport** datagrams
  or WebRTC — a WebSocket is reliable and ordered, so a stalled message delays every message
  behind it.

🔴 **The honest default: if only the server talks, do not open a WebSocket.** Half the
production WebSocket code in the world is an SSE stream with a reconnection bug.

## Gotchas

**Symptom → cause → fix.**

- **`Authorization` header is ignored / cannot be set** → the constructor takes only a URL and
  sub-protocols → use a ticket, cookies, or first-message auth.
- **Session tokens turn up in access logs** → the token was put in the socket URL → mint a
  short-lived single-use ticket instead.
- **Reconnect works at first, then always fails after a long outage** → the ticket was minted
  once at startup and expired → mint one per attempt.
- **The socket reconnects forever after a session expires** → the server closes without a
  distinct code, so the client cannot tell fatal from transient → close with a `4xxx` the
  client treats as fatal and re-authenticate over HTTP.
- **Unauthenticated connections pile up** → first-message auth with no timer → close after a
  few seconds without valid auth, and rate-limit handshakes.
- **A cross-origin page can drive your socket with a user's cookies** → no `Origin` check;
  there is no CORS here → validate `Origin` server-side and reject when it is missing.
- **The seventh tab of an SSE app never connects** → the HTTP/1.1 six-connection-per-domain
  limit → serve over HTTP/2.
- **Everything works with one server and breaks after scaling out** → clients are connected to
  different instances → put a pub/sub bus behind the socket layer.
- **Real-time features work locally and drop every minute in production** → a load balancer's
  idle timeout, or no `Upgrade` forwarding → configure the intermediary and heartbeat below
  its timeout ([chunk 4](./04-staying-connected.md)).

## Interview questions

**How do you authenticate a browser WebSocket, given you cannot set headers?** Cookies (with a
server-side `Origin` check, because there is no CORS), a token in the query string (which
leaks into logs), a sub-protocol hack, first-message authentication, or — the usual answer —
a short-lived single-use ticket minted by an authenticated HTTP request and passed in the URL.

**What happens when the token behind an open socket expires?** Nothing, unless the server
checks. A connection is authenticated once at the handshake, so the server must re-validate
periodically and close with an application code that tells the client to re-authenticate
rather than retry.

**When would you choose SSE over a WebSocket?** Whenever the traffic is server → client.
`EventSource` reconnects automatically, resumes with `Last-Event-ID`, is subject to CORS, and
is plain HTTP; the client's occasional writes go over `fetch`. The trade is text-only
payloads and, on HTTP/1.1, the six-connections-per-domain limit.

**What does a WebSocket cost that HTTP does not?** Sticky, stateful connections: `Upgrade`-
aware infrastructure, a pub/sub bus once there is more than one server, no caching or CDN, and
capacity measured in concurrent connections including idle tabs.

**When is a WebSocket the wrong answer even for realtime data?** When updates flow one way
(SSE), when "reasonably fresh" is enough (cached polling), or when late data is worse than
lost data — WebSocket is reliable and ordered, so one stalled message delays everything behind
it, which is what WebTransport's datagrams and WebRTC exist to avoid.

---

← [4 · Staying connected](./04-staying-connected.md) · [Overview](./README.md)
