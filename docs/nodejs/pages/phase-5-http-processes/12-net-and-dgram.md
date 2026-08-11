---
title: "node:net, node:dgram and framing"
sidebar_label: "12 · net and dgram"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span> · custom binary protocols are <span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`node:net` is TCP, `node:dgram` is UDP, and HTTP is built on the first of them.
You will rarely write either directly — but the one idea here, that TCP has no
message boundaries, explains a whole class of bugs one layer up.**

## TCP is a byte stream, not a message stream

```js
const c = connect(port, '127.0.0.1', () => {
  c.write('ALPHA'); c.write('BRAVO'); c.write('CHARLIE');
  c.end();
});
```

```console
$ node netdemo.mjs
  tcp server: chunk 1 = "ALPHABRAVOCHARLIE" (17 bytes)
  tcp server: 3 writes arrived as 1 chunk(s)
```

Three writes, one `'data'` event. TCP guarantees **order** and **delivery**, and
guarantees nothing about how bytes are grouped. The kernel coalesces small writes
(Nagle's algorithm), and a large write is split by the path MTU. One `write` may
arrive as five events, or five writes as one.

This is the same fact behind the secret that spans two chunks in
[Phase 3](../phase-3-buffers-streams/13-transform-streams.md), and behind an HTTP
body arriving in 49 pieces ([page 02](02-request-bodies.md)). Anything that parses
a socket per `'data'` event is broken; it just happens to work on localhost with
small payloads.

## Framing is the fix

The protocol has to say where messages end. Three ways, in order of how often you
will meet them: a **delimiter** (`\n` — Redis, SMTP), a **length prefix** (most
binary protocols), or a **self-describing header** (HTTP's `Content-Length`).

```js
// length-prefix decoder: 4-byte big-endian length, then that many bytes
let buf = Buffer.alloc(0);
socket.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  for (;;) {
    if (buf.length < 4) return;                 // header incomplete
    const len = buf.readUInt32BE(0);
    if (buf.length < 4 + len) return;           // payload incomplete
    handle(buf.subarray(4, 4 + len));
    buf = buf.subarray(4 + len);                // keep the remainder
  }
});
```

```console
$ node netdemo.mjs         # 3 messages sent as 3 arbitrary, mid-message splits
  framed server: message = "ALPHA"
  framed server: message = "BRAVO"
  framed server: message = "CHARLIE"
```

The two properties that make it correct: it **accumulates** across events, and it
**loops** — one `'data'` event may complete several messages. Dropping the loop
is the usual bug, and it only shows up under load, when writes coalesce.

Two things to add before this is production code. **Bound the buffer** — a peer
that sends a 4 GB length prefix, or never sends the terminator, will otherwise
grow it until the process dies; reject anything over a maximum message size.
And prefer `Buffer.concat` on an *array* of pending chunks rather than
reallocating per chunk if throughput matters.

Better still, do not hand-roll the decoder: a `Transform` in object mode gives
you backpressure and `pipeline` cleanup for free
([Phase 3, page 13](../phase-3-buffers-streams/13-transform-streams.md)).

## The rest of `node:net`

```js
const server = createServer((socket) => {           // socket is a Duplex
  socket.setNoDelay(true);                          // disable Nagle for latency
  socket.setKeepAlive(true, 30_000);
  socket.setTimeout(60_000, () => socket.destroy());
  pipeline(socket, transform, socket).catch(log);
});
server.listen({ port: 0, host: '127.0.0.1' });
server.listen('/tmp/app.sock');                     // Unix domain socket
```

`socket.setNoDelay(true)` matters for request/response protocols, where Nagle can
add up to 40 ms waiting for more data to batch. Unix domain sockets skip the
network stack entirely and are the right choice for a sidecar or a local database
on the same host.

## UDP — boundaries kept, delivery not

```console
$ node netdemo.mjs
  udp server: datagram "ALPHA" (5 bytes) from 127.0.0.1:37928
  udp server: datagram "BRAVO" (5 bytes) from 127.0.0.1:37928
  udp server: datagram "CHARLIE" (7 bytes) from 127.0.0.1:37928
```

The exact inverse of TCP. Each `send` is one `'message'` event with its own
boundary — **no framing needed** — but there is no ordering, no retransmission,
no connection and no backpressure. A datagram either arrives whole or not at all.

```js
const socket = createSocket('udp4');
socket.on('message', (msg, rinfo) => handle(msg, rinfo.address, rinfo.port));
socket.bind(8125);
socket.send(Buffer.from('metric:1|c'), 8125, '127.0.0.1');
```

Keep datagrams under ~1200 bytes to stay inside the typical path MTU; larger ones
get IP-fragmented, and losing one fragment loses the whole datagram. Where you
will actually meet UDP: StatsD metrics, DNS, syslog, and video — all cases where a
lost message is cheaper than a delayed one.

## Gotchas

**Symptom:** A TCP parser works in development and corrupts data in production
**Cause:** It assumed one `'data'` event equals one message.
**Fix:** Accumulate and frame explicitly, looping until the buffer is short.

**Symptom:** Messages stop being processed after a burst
**Cause:** The decoder handles one message per event and leaves the rest in the
buffer.
**Fix:** The `for(;;)` loop.

**Symptom:** Memory grows without bound on a socket
**Cause:** An unbounded accumulation buffer with no maximum message size.
**Fix:** Cap it and destroy the socket when exceeded.

**Symptom:** Consistent ~40 ms latency on a request/response protocol
**Cause:** Nagle's algorithm batching small writes.
**Fix:** `socket.setNoDelay(true)`.

**Symptom:** UDP messages over ~1500 bytes disappear
**Cause:** IP fragmentation plus one lost fragment.
**Fix:** Keep datagrams small.

**Symptom:** Half-open sockets accumulate
**Cause:** A peer vanished without FIN; TCP has no way to notice.
**Fix:** `setKeepAlive` and an application-level timeout.

## Interview questions

**★ Why can't you treat a TCP `'data'` event as a message?**
TCP is a byte stream. It preserves order and delivery, not grouping — the kernel
coalesces small writes and splits large ones at the MTU. Demonstrated above: three
`write` calls arrived as a single 17-byte event. Messages exist only if the
protocol frames them.

**★ How do you frame messages over TCP?**
A delimiter, a length prefix, or a self-describing header. A length-prefix decoder
must accumulate bytes across events, check that both the header and the payload
are complete, and loop, because one event can complete several messages.

**★ TCP or UDP — what actually differs for the programmer?**
TCP gives ordering, retransmission, flow control and backpressure, and takes away
message boundaries. UDP gives message boundaries and takes away everything else.
So TCP needs framing and UDP needs the application to handle loss and ordering.

**★ What is `setNoDelay` for?**
Disabling Nagle's algorithm, which delays small writes hoping to batch them. On a
request/response protocol that shows up as a fixed tens-of-milliseconds latency
that no profiler explains.

**When would you use a Unix domain socket?**
When both ends are on the same host — a sidecar, a local Postgres, a metrics
agent. It skips the TCP/IP stack and its permissions are filesystem permissions.

**Where does UDP actually get used in a web stack?**
StatsD metrics, DNS queries, syslog forwarding — anywhere a dropped message is
cheaper than a delayed one, and where the volume makes per-message acknowledgement
too expensive.

---

← Prev: [WebSockets](11-websockets.md) · Next → [node:dns](13-dns.md)
