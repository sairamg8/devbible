---
title: "WebSockets"
sidebar_label: "11 · WebSockets"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS), `ws` 8.21.3.

**Node ships a WebSocket *client* and no WebSocket *server*. The global
`WebSocket` was unflagged in v22.0.0 and stopped being experimental in v22.4.0;
for the server side you install `ws`, which is what Socket.IO, Fastify and
everything else is built on.**

```console
$ node wsdemo.mjs
global WebSocket available? function | WebSocketServer in core? no — `ws` from npm
```

## The protocol in one paragraph

The client sends an ordinary HTTP GET with `Upgrade: websocket` and a
`Sec-WebSocket-Key`. The server answers `101 Switching Protocols` with a hash of
that key, and from then on the TCP connection carries **frames** instead of HTTP
— text or binary, either direction, no request/response pairing. Because it
begins as HTTP it passes through proxies and firewalls that allow HTTP, and it
inherits the cookies sent with the handshake.

## Server, with the parts that matter

```js
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const server = createServer((req, res) => res.writeHead(426).end('Upgrade Required'));
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket, req) => {
  socket.isAlive = true;
  socket.on('pong', () => { socket.isAlive = true; });
  socket.on('message', (data, isBinary) => socket.send(isBinary ? data : `echo:${data}`));
  socket.on('close', (code, reason) => log({ code, reason: reason.toString() }));
});

// the heartbeat every production server needs
setInterval(() => {
  for (const s of wss.clients) {
    if (!s.isAlive) { s.terminate(); continue; }
    s.isAlive = false; s.ping();
  }
}, 30_000).unref();
```

```console
$ node wsdemo.mjs
   32 ms server: client connected from ::ffff:127.0.0.1 | protocol: ""
   46 ms client: open, readyState 1
   50 ms server: recv text (5 bytes): hello
   51 ms server: recv binary (4 bytes): <Buffer 01 02 03 04>
   53 ms client: recv text echo:hello
   54 ms client: recv binary <1,2,3,4>
   58 ms client: closed code=4001 reason="done" wasClean=true
```

**The heartbeat is not optional.** A laptop that goes to sleep, a phone that
loses signal or a NAT device that drops an idle mapping leaves the TCP connection
open as far as the server is concerned. Without ping/pong those sockets accumulate
forever, each holding whatever per-connection state you attached. `terminate()`
kills immediately; `close()` performs the closing handshake and can itself hang.

## Client — built in

```js
const ws = new WebSocket('wss://example.com/ws');
ws.binaryType = 'arraybuffer';
ws.addEventListener('open', () => ws.send('hello'));
ws.addEventListener('message', (ev) => handle(ev.data));   // string or ArrayBuffer
ws.addEventListener('close', (ev) => log(ev.code, ev.reason, ev.wasClean));
ws.addEventListener('error', () => {/* no detail — by design */});
```

The API is the browser's, events and all — not an `EventEmitter`. Two things it
does not do: **it never reconnects**, and its `error` event carries no diagnostic
detail (deliberately, so a browser cannot probe the network). Any real client
needs its own reconnect-with-backoff loop, and close codes are where the
information is: `1000` normal, `1001` going away, `1006` **abnormal — no close
frame received**, which is what a dropped connection looks like. `4000`–`4999`
are yours to define, as `4001 "done"` is above.

## Authentication

The handshake is an HTTP request, so cookies sent with it arrive on `req` —
which is convenient and also means **WebSocket handshakes are not protected by
the same-origin policy**. A page on any origin can open a socket to your server
with the user's cookies attached, and CORS does not apply. Check `req.headers.origin`
yourself in `verifyClient` or the `upgrade` handler, and prefer a token:

```js
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', async (req, socket, head) => {
  const ok = ALLOWED_ORIGINS.has(req.headers.origin) && await verify(tokenFrom(req));
  if (!ok) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});
```

`noServer: true` with an explicit `upgrade` handler is the shape to use whenever
authorisation is involved — it lets you reject before a socket exists. Note the
browser API cannot set request headers, so a token travels in the query string
(and therefore into access logs) or in the first message after connect.

## Choosing WS or SSE

| | WebSocket | SSE |
|---|---|---|
| Direction | Both | Server → client |
| Transport | Upgraded TCP | Plain HTTP |
| Reconnect | You write it | Built into `EventSource` |
| Resume after drop | You design it | `Last-Event-ID`, free |
| Proxy trouble | Needs upgrade support | Buffering only |
| Compression, auth, cookies | Special-cased | Ordinary HTTP |
| Server side in Node | `ws` | Nothing to install |

**Default to SSE** ([page 10](10-streaming-and-sse.md)) unless the client sends
messages frequently. Chat, collaborative editing, multiplayer and live cursors
want WebSockets; notifications, progress, dashboards and streamed model output do
not. Long-polling is the fallback for environments that break both.

Scaling has one structural consequence: connections are **stateful and pinned**.
Two users on the same channel may land on different instances, so broadcasting
requires a shared bus — Redis pub/sub is the usual answer — and a deploy
disconnects every client at once, which makes client-side backoff with jitter a
correctness requirement rather than a nicety. See
[page 23](./23-cluster.md) on sticky sessions.

## Gotchas

**Symptom:** Connection count climbs and never falls
**Cause:** No ping/pong heartbeat, so silently dead sockets are never reaped.
**Fix:** The `isAlive` interval above, with `terminate()`.

**Symptom:** `error` fires with no useful information
**Cause:** The browser-compatible API omits it deliberately.
**Fix:** Read the close code — `1006` means the connection dropped with no close
frame. Log server-side for the real reason.

**Symptom:** Works locally, fails behind the proxy with a 400 or a hang
**Cause:** The proxy is not configured to pass `Upgrade` and `Connection` headers.
**Fix:** `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`
plus a long `proxy_read_timeout`.

**Symptom:** Any website can open a socket to your server as a logged-in user
**Cause:** The handshake is not covered by CORS or the same-origin policy.
**Fix:** Validate `Origin` on upgrade and authenticate explicitly.

**Symptom:** A deploy causes a thundering herd of reconnects
**Cause:** Every client reconnects immediately and simultaneously.
**Fix:** Exponential backoff with jitter on the client.

**Symptom:** Messages are delivered to some users and not others after scaling out
**Cause:** Clients are connected to different instances with no shared bus.
**Fix:** Redis pub/sub or an equivalent fan-out.

## Interview questions

**★ Does Node have WebSocket support built in?**
Only the client — the global `WebSocket`, unflagged in v22.0.0 and stable from
v22.4.0. There is no server implementation in core, so the server side is `ws`
from npm, which everything else wraps.

**★ How does a WebSocket connection start?**
As an HTTP GET with `Upgrade: websocket` and `Sec-WebSocket-Key`. The server
replies `101 Switching Protocols` with the hashed key and the connection switches
from HTTP messages to WebSocket frames. That HTTP beginning is why it traverses
proxies and why it carries cookies.

**★ Why is a ping/pong heartbeat mandatory?**
Because a lost connection is not always signalled. Sleeping laptops, dropped
mobile signal and expired NAT mappings leave the server holding sockets that will
never send anything again. Periodic pings and a liveness flag are the only way to
find and terminate them.

**★ Is a WebSocket handshake protected by CORS?**
No. Any origin can open a WebSocket to your server, with the user's cookies
attached, and no preflight occurs. Origin checking and authentication have to be
done explicitly during the upgrade.

**When would you choose SSE instead?**
Whenever the traffic is one-way. SSE is plain HTTP, so it inherits auth,
compression and proxy behaviour, and `EventSource` handles reconnection and
resumption via `Last-Event-ID` with no code. WebSockets earn their complexity
only when the client sends often.

**What does close code 1006 mean?**
The connection closed without a close frame — a drop, not a clean shutdown. It is
the code you will see for network failures, and it cannot be sent deliberately.

---

← Prev: [Streaming and SSE](10-streaming-and-sse.md) · Next → [node:net and node:dgram](12-net-and-dgram.md)
