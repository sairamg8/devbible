---
title: "HTTP/1.1 is one request at a time per connection; HTTP/2 multiplexes many on one connection but a lost packet stalls them all because TCP cannot see the streams; HTTP/3 puts the streams on QUIC over UDP so a loss stalls one — which changes everything for a phone on a bad network and almost nothing for the server behind the gateway"
sidebar_label: "11 · HTTP/1.1, HTTP/2 and HTTP/3"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against [RFC 9113](https://www.rfc-editor.org/rfc/rfc9113.html) (HTTP/2
> — the abstract, stream multiplexing, pipelining's head-of-line blocking, and *"TCP
> head-of-line blocking is not addressed by this protocol"*), [RFC 9114](https://www.rfc-editor.org/rfc/rfc9114.html)
> (HTTP/3 — the abstract and the sentence on a lost packet stalling every HTTP/2 transaction),
> [RFC 9000](https://www.rfc-editor.org/rfc/rfc9000.html) (QUIC — UDP datagrams, streams,
> the integrated TLS handshake, connection migration) and MDN's server-sent-events page (the
> six-connection limit) — verbatim below. Browser connection limits are stated as MDN gives
> them, not as a figure per browser. **No sandbox run.**

**The three HTTP versions carry the same semantics — the same methods, status codes and headers
of RFC 9110 — over three different transports, and the difference is what happens when a
connection carries many requests and a packet is lost.** HTTP/1.1 carries one request at a
time per connection; the browser opens a handful of connections per host and queues the rest,
and a slow response blocks the requests behind it on its connection. HTTP/2 puts every request
on one connection as an independent stream, compresses headers, and removes the queue — but
the streams share one TCP connection, and TCP delivers bytes in order, so one lost packet
stalls every stream until it is retransmitted; the RFC says so in as many words. HTTP/3 keeps
the streams and moves them onto QUIC, a transport over UDP that recovers loss per stream and
folds the TLS handshake into its own, so a loss stalls one stream and a connection survives the
phone changing networks. For a mobile client on a lossy link, that is the difference between a
page that stalls and one that does not; for the server behind the gateway, which terminates
the client's protocol and speaks whatever it likes to the services, it changes nothing about
the design. This page is the three versions and the one mechanism that separates them, what
each changes for the client, what each does not change for the server, and the gateway's job
of translating between them.

## The three, and the one mechanism

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| Transport | TCP + TLS | TCP + TLS | QUIC over UDP, TLS integrated |
| Requests per connection | one at a time (pipelining exists and is unused) | many, as multiplexed streams | many, as QUIC streams |
| Browser's answer to concurrency | several connections per host, the rest queued | one connection per host | one connection per host |
| Headers | text, repeated on every request | compressed (HPACK) | compressed (QPACK) |
| A lost packet stalls | that connection's one request | **every stream on the connection** — TCP head-of-line blocking | the one stream the packet belonged to |
| Handshake to first byte | TCP + TLS: two round trips (one on TLS resumption) | the same | one round trip; zero on resumption with 0-RTT |
| Changing networks mid-connection | the connection dies | the connection dies | connection migration — the connection survives |
| Server push | — | specified; widely disabled | specified; likewise |
| Middleboxes | pass everything | pass everything | some networks block or throttle UDP; clients fall back |

The mechanism, in the RFCs' words. HTTP/2's purpose:

> *"HTTP/2 enables a more efficient use of network resources and a reduced latency by
> introducing field compression and allowing multiple concurrent exchanges on the same
> connection."* — *"Multiplexing of requests is achieved by having each HTTP request/response
> exchange associated with its own stream."* — RFC 9113

What HTTP/1.1's pipelining could not fix, and what HTTP/2 also does not:

> *"HTTP/1.1 added request pipelining, but this only partially addressed request concurrency and
> still suffers from application-layer head-of-line blocking."* — *"TCP head-of-line blocking is
> not addressed by this protocol."* — RFC 9113

Why that matters, from HTTP/3's own introduction:

> *"Because the parallel nature of HTTP/2's multiplexing is not visible to TCP's loss recovery
> mechanisms, a lost or reordered packet causes all active transactions to experience a stall
> regardless of whether that transaction was directly impacted by the lost packet."* — RFC 9114

And what QUIC changes:

> *"By providing reliability at the stream level and congestion control across the entire
> connection, QUIC has the capability to improve the performance of HTTP compared to a TCP
> mapping."* — RFC 9114

> QUIC packets *"are carried in UDP datagrams to better facilitate deployment in existing
> systems and networks."* — *"Application protocols exchange information over a QUIC connection
> via streams, which are ordered sequences of bytes."* — *"QUIC integrates the TLS handshake,
> although using a customized framing for protecting packets."* — RFC 9000

The one-sentence version for the round: *"HTTP/2 moved the queue from the browser into one
connection; HTTP/3 moved the connection off TCP so that one lost packet no longer stalls the
whole queue."*

## Head-of-line blocking, at each layer

The term means the same thing three times and candidates conflate them:

1. **Application-layer, HTTP/1.1.** One request per connection at a time; the response in
   flight blocks the requests queued behind it. The browser's workaround — several connections
   per host — is bounded, and the bound has consequences: MDN's server-sent-events page gives
   *"a very low number (6)"* per browser on HTTP/1.1, which is why six open event streams
   exhaust a site ([06](06-long-lived-connections.md)). HTTP/2 removes this layer entirely.
2. **Transport-layer, TCP.** TCP promises in-order delivery of one byte stream. When a packet
   is lost, the bytes after it have arrived but cannot be delivered until the retransmission
   lands, so every HTTP/2 stream whose data was in those later packets waits — RFC 9114's
   *"all active transactions … stall"*. On a wired link with negligible loss this is invisible;
   on a mobile link losing one packet in a hundred, it is the dominant stall.
3. **Stream-level, QUIC.** Each stream is its own ordered byte sequence; a loss on one stream
   delays only that stream's later bytes. The others proceed. This is what HTTP/3 buys, and it
   buys it *only* on lossy links — which is the honest scope of "HTTP/3 is faster".

## What changes for the client on a bad network

A phone on a train: variable latency, packet loss, a network change at every station.

- **Fewer round trips to the first byte.** QUIC's integrated handshake is one round trip cold,
  zero on resumption with 0-RTT — with 0-RTT's replay caveat from
  [10](10-tls-termination-and-where-it-lives.md) — against TCP + TLS's two. On a 300 ms mobile
  round trip that is the difference visible to the eye.
- **Loss stalls one stream.** A page loading thirty resources over one HTTP/2 connection stalls
  entirely on one lost packet; over HTTP/3 the twenty-nine unaffected resources keep arriving.
- **Connection migration.** RFC 9000's abstract lists *"network path migration"*: a QUIC
  connection is identified by a connection ID rather than the address pair, so a phone moving
  from cellular to Wi-Fi keeps its connection — and its TLS state, and its in-flight streams —
  where a TCP connection dies and everything restarts.
- **Header compression** — HTTP/2 and HTTP/3 both — matters on mobile for the many small
  requests whose headers (cookies, user agent) outweigh their bodies.
- **The fallback.** Some networks block UDP or throttle it; clients try HTTP/3 and fall back to
  HTTP/2 over TCP, and the server advertises HTTP/3 availability so the client knows to try.
  A design that *requires* HTTP/3 has excluded those networks.

## What changes nothing on the server

The client's protocol ends at the gateway (or the CDN edge), which terminates it and opens its
own connections to the services — and those connections are chosen for the server's needs, not
the phone's:

- **The gateway translates.** A browser speaking HTTP/3 to the edge, the edge speaking HTTP/2 to
  the gateway over pooled connections, the gateway speaking HTTP/1.1 or gRPC-over-HTTP/2 to
  services — all in one request's path, and every hop is a separate protocol choice. Services
  never see QUIC unless they choose to.
- **Inside the datacentre, loss is rare and latency is half a millisecond**, so head-of-line
  blocking at the transport layer is not the problem HTTP/3 solves; the reason to use HTTP/2
  between services is multiplexing over pooled connections — which is also the reason a
  layer-4 balancer sees one hot connection ([02](02-load-balancing-layer-4-vs-layer-7.md)).
- **The semantics are identical.** Methods, status codes, headers, caching, idempotency — RFC
  9110 applies to all three. Nothing in the API design, the rate limiter, the retry policy or
  the cache key changes with the version.
- **Where it does touch the server:** the edge and gateway need UDP open on 443 and a stack
  that speaks QUIC; per-connection state is different (QUIC lives in user space, so CPU per
  connection is higher than kernel TCP for now); and the connection-tier arithmetic of
  [06](06-long-lived-connections.md) — streams per connection — applies to HTTP/2 and HTTP/3
  alike.

The sentence: *"HTTP/3 at the edge for the phones; HTTP/2 over pooled connections inside; the
services never know the difference, and nothing in the API changes."*

## The storefront

The CDN edge speaks HTTP/3 and HTTP/2 to clients, advertising HTTP/3 and falling back; the
product page's thirty images arrive over one connection and a lost packet on the train delays
one of them. Edge to gateway is HTTP/2 over a pool of warm connections. The gateway speaks
HTTP/1.1 to the Node services — one request per connection from a pool, which is simple and
fast at half a millisecond — and the order status stream is SSE over HTTP/2 from the connection
tier so that a user's tabs share one connection. The API is the same on every hop.

## Gotchas

**★ Symptom: "HTTP/2 fixes head-of-line blocking."** Cause: the two layers conflated. Fix: it
fixes the application-layer queue; RFC 9113 says TCP head-of-line blocking is not addressed;
that is HTTP/3's job, and only on lossy links.

**★ Symptom: "we'll use HTTP/3 between services for speed."** Cause: a mobile-network benefit
applied inside a datacentre. Fix: loss is rare and latency is sub-millisecond inside; HTTP/2 over
pooled connections for multiplexing; HTTP/3 at the edge for phones.

**★ Symptom: the product page stalls entirely on the phone when one image packet is lost.**
Cause: everything on one HTTP/2 connection over TCP. Fix: HTTP/3 at the edge, where a loss
stalls one stream.

**Symptom: six event streams and the site hangs on HTTP/1.1.** Cause: the per-browser
connection limit MDN describes. Fix: HTTP/2, where streams multiplex on one connection.

**Symptom: the site is unreachable on a network that blocks UDP.** Cause: HTTP/3 required, no
fallback. Fix: advertise HTTP/3, always keep HTTP/2 over TCP available; clients fall back.

**Symptom: the API redesigned "for HTTP/2".** Cause: semantics thought to change with the
version. Fix: RFC 9110 semantics apply to all three; methods, caching and idempotency are
unchanged.

**Symptom: one hot backend behind a network balancer after moving to HTTP/2.** Cause:
multiplexing makes one connection carry everything. Fix: a layer-7 balancer distributing
streams.

**Symptom: a phone's connection resets at every network change.** Cause: TCP identified by
address pair. Fix: HTTP/3's connection migration — the QUIC connection ID survives the change.

**Symptom: 0-RTT enabled with HTTP/3 and a replayed request.** Cause: the same 0-RTT caveat as
TLS 1.3. Fix: early data only for idempotent requests; the gateway rejects it otherwise.

**Symptom: "server push makes it faster."** Cause: a feature that is specified and widely
disabled. Fix: preload hints and early hints; do not design around push.

## Interview questions

**★ What is the difference between HTTP/1.1, HTTP/2 and HTTP/3, in one mechanism?**
Where the queue lives and what a lost packet stalls. HTTP/1.1 handles one request at a time per
connection, so the browser opens a few connections and queues the rest, and a slow response
blocks those behind it. HTTP/2 multiplexes every request as a stream on one connection with
compressed headers — RFC 9113's concurrent exchanges on the same connection — but the streams
share one TCP byte stream, and RFC 9113 says TCP head-of-line blocking is not addressed: one
lost packet stalls every stream. HTTP/3 puts the streams on QUIC over UDP, which recovers loss
per stream and integrates the TLS handshake, so a loss stalls one stream and the connection
survives a network change. The semantics — RFC 9110 — are the same in all three.

**★ What changes for a mobile client on a bad network, and what changes on the server?**
For the phone: fewer round trips to the first byte with QUIC's integrated handshake; a lost
packet delays one resource instead of the whole page; the connection survives moving from
cellular to Wi-Fi via connection migration; compressed headers matter on many small requests;
and a fallback to HTTP/2 over TCP where UDP is blocked. For the server: nothing in the API,
the caching, the rate limiting or the retry policy — the gateway terminates the client's
protocol and speaks HTTP/2 over pooled connections or HTTP/1.1 to the services, where loss is
rare and latency is sub-millisecond. The edge needs UDP on 443 and a QUIC stack; that is the
extent of it.

**★ Why does HTTP/2 not fix head-of-line blocking, if it multiplexes?**
Because it multiplexes above TCP, and TCP delivers one ordered byte stream: when a packet is
lost, bytes that arrived after it cannot be delivered until the retransmission lands, so every
stream whose data was in those later packets waits — RFC 9114 describes a lost or reordered
packet causing all active transactions to stall regardless of which one it hit. HTTP/2 removed
the application-layer queue of HTTP/1.1; the transport-layer queue needed a transport that
knows about streams, which is QUIC.

**Why would you not use HTTP/3 between services?**
Because its benefits address loss and latency on the client's link — per-stream loss recovery,
a shorter handshake, connection migration — and inside a datacentre loss is negligible and the
round trip is half a millisecond, so there is nothing to recover. Between services the win is
multiplexing over pooled connections, which HTTP/2 over TCP provides with a kernel transport
that costs less CPU per connection than a user-space QUIC stack. HTTP/3 at the edge for phones;
HTTP/2 inside.

**A user opens six tabs of the order status page on HTTP/1.1 and the seventh request hangs.
Why, and what is the fix?**
MDN's server-sent-events documentation states the per-browser limit of open connections on
HTTP/1.1 as a very low number, six, across tabs; each event stream holds one, so the seventh
connection to that host has none left. The fix is HTTP/2, where the streams are multiplexed on
one connection and the negotiated stream limit is around a hundred — which is also why "we use
SSE" must be followed by "over HTTP/2".

**Does moving to HTTP/2 or HTTP/3 change the API design?**
No. The semantics of RFC 9110 — methods, status codes, headers, caching directives, idempotency
— apply identically over all three; the version changes the framing and the transport, not the
meaning. What it changes is operational: the balancer must be layer 7 to distribute HTTP/2
streams, the connection tier's arithmetic is in streams, the edge must speak QUIC, and 0-RTT
early data must be limited to idempotent requests. An API redesigned "for HTTP/2" has
misunderstood which layer moved.

---

← Prev: [10 · TLS termination and where it lives](10-tls-termination-and-where-it-lives.md) · Index: [Phase 2 — The request path](README.md) · Next → **Service discovery** *(not written yet)*
