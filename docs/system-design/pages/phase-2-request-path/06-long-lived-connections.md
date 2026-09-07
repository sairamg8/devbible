---
title: "WebSockets are two-way on one TCP connection, server-sent events are one-way with reconnection built into the browser, long polling is a request that waits — and the design problems are the same for all three: a connection lives on one node, a message must find that node, and a deploy disconnects everyone at once"
sidebar_label: "06 · Long-lived connections"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455.html) (the
> WebSocket protocol — abstract and §1.1, verbatim), MDN
> [*Using server-sent events*](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
> (one-way, automatic reconnection, `retry`, `text/event-stream`, the per-browser connection
> limit — verbatim) and [RFC 9113](https://www.rfc-editor.org/rfc/rfc9113.html) (HTTP/2's
> concurrent exchanges on one connection). Connection registries, pub/sub fan-out and
> reconnection jitter are common practice, stated as such. **No sandbox run.**

**A request-response system forgets the client the moment it answers; a long-lived connection
is a client the server must remember — and the remembering is where the design work is.** The
three mechanisms differ in shape: a WebSocket is a single TCP connection carrying messages both
ways; server-sent events are a one-way HTTP response that never ends, with the browser
reconnecting on its own; long polling is an ordinary request that the server holds until it has
something to say. But once a connection is open, every one of them creates the same three
problems: it lives on *one* node, so the fleet is no longer interchangeable; a message for that
user must be delivered to *that* node, so something has to know where each user is; and a
deploy or a node failure closes thousands of connections at once, which reconnect at once. This
page is the three mechanisms compared with the RFC and MDN facts that decide between them,
connections per node and what limits them, the routing problem and its two standard answers,
the reconnection storm and how it is tamed, and the storefront's one legitimate use — the order
status page.

## The three mechanisms

| | WebSocket | Server-sent events | Long polling |
|---|---|---|---|
| Direction | two-way | server → client only | server → client, one message per request |
| Transport | one TCP connection, upgraded from HTTP; binary or text frames | one HTTP response, `text/event-stream`, never closed | ordinary HTTP requests, each held until data or timeout |
| Reconnection | the application's job | built into the browser, with a server-settable `retry` and `Last-Event-ID` | the next request *is* the reconnection |
| Through proxies and CDNs | needs the upgrade supported end to end; some corporate proxies block | plain HTTP — passes anything that streams; buffering proxies break it | plain HTTP — passes everything |
| Per-connection cost | a socket and its buffers on the node | a socket and a response in progress | a socket per outstanding request, re-established each time |
| Browser limit | per-host connection limits apply; commonly a few hundred | **6 per browser** on HTTP/1.1 across tabs; ~100 streams on HTTP/2 | the ordinary request limit |
| Use it for | chat, collaborative editing, games, anything the client sends often | notifications, feeds, progress, order status — server pushes, client rarely talks | the fallback when neither is available; low-frequency updates |

The RFC states what WebSockets exist to replace:

> *"The server is forced to use a number of different underlying TCP connections for each
> client: one for sending information to the client and a new one for each incoming message."*
> — *"A simpler solution would be to use a single TCP connection for traffic in both directions.
> This is what the WebSocket Protocol provides."* — RFC 6455, §1.1

And MDN states the two facts that make SSE the right default for push-only:

> *"This is a one-way connection, so you can't send events from a client to a server."* —
> *"By default, if the connection between the client and server closes, the connection is
> restarted."* — MDN, *Using server-sent events*

The choice in a round is usually SSE: most product features push and rarely receive, and the
browser's built-in reconnection with `Last-Event-ID` is a resume mechanism the application does
not have to write. WebSockets earn their cost when the client sends often. Long polling is what
you say when the interviewer adds "and it has to work through a proxy that breaks streaming".

## The connection limit nobody remembers

SSE has a browser-side ceiling that decides an architecture, and MDN states it with the number:

> *"When not used over HTTP/2, SSE suffers from a limitation to the maximum number of open
> connections, which can be especially painful when opening multiple tabs, as the limit is per
> browser and is set to a very low number (6)."* — *"When using HTTP/2, the maximum number of
> simultaneous HTTP streams is negotiated between the server and the client (defaults to 100)."*
> — MDN, *Using server-sent events*

Six connections per browser, across every tab of the site, on HTTP/1.1. A user with six tabs
open has no connection left for the seventh — or for any other request to that host. The
answer is HTTP/2, where an SSE stream is one of a hundred multiplexed streams on one connection
(RFC 9113: *"multiple concurrent exchanges on the same connection"*), and it is the reason "we
use SSE" must be followed by "over HTTP/2". The same multiplexing is why a layer-4 balancer
sees all of those streams as one connection ([02](02-load-balancing-layer-4-vs-layer-7.md)).

## Connections per node

A node holds a socket, its kernel buffers and an application object per connection; the ceiling
is memory and file descriptors before it is CPU, because an idle connection costs almost no CPU.
Tens of thousands of idle connections per node is ordinary; the number that matters is the
*message rate* — a node with fifty thousand connections each receiving one message a second is
doing fifty thousand writes a second, which is a different node from one with the same
connections receiving one a minute. Two consequences for the design:

- **Capacity is connections × message rate**, and the estimate ([phase 1](../phase-1-the-method/03-back-of-the-envelope-estimation.md))
  has to say both: "a hundred thousand users online, one order update a minute each — two
  thousand messages a second across the fleet, a handful of nodes."
- **Connections are stateful load**, so the balancer cannot rebalance them; a node that
  accepted more than its share keeps them until they close. Balance at accept time (least
  connections — this is the one place it is the right algorithm) and accept that the
  distribution drifts.

The connection-holding tier is therefore separated from the stateless request tier: a
**connection gateway** — nodes that do nothing but hold sockets and forward — behind which the
ordinary stateless services do the work. The gateway nodes are the ones that need draining
with care.

## Routing a message to the node that holds the socket

The user's order was paid; the order service wants to push "paid" to the user's page; the
user's socket is on connection node 7 of 20. Two standard answers:

**A registry.** Each connection node records `user → node` in a shared store (Redis) on
connect and removes it on disconnect, with a TTL as a safety net. The order service looks up the
node and sends the message to it directly. Precise, one hop, and the registry is a store on the
failure walk — stale entries after a node dies without cleanup are the operational reality, and
the TTL plus a heartbeat is what bounds them.

**Publish-subscribe.** The order service publishes to a channel — per user, or per topic —
and every connection node subscribes to the channels of the users it holds; the node that has
the socket delivers, the others ignore. No registry, no lookup, one extra hop through the
broker; the cost is fan-out — a message on a channel reaches every subscribed node, so
per-user channels keep the fan-out to the nodes that matter, and a broker is on the failure
walk.

```ts
// pub/sub delivery, in shape: the connection node subscribes to the channels of the users it holds
// and writes to their sockets; the order service only publishes. Illustrative — not a runnable server.
type Socket = { send(data: string): void };

export class ConnectionNode {
  private sockets = new Map<string, Set<Socket>>();          // userId → open sockets on THIS node

  constructor(private readonly sub: { subscribe(ch: string, fn: (m: string) => void): void; unsubscribe(ch: string): void }) {}

  onConnect(userId: string, socket: Socket): void {
    let set = this.sockets.get(userId);
    if (!set) {
      set = new Set();
      this.sockets.set(userId, set);
      this.sub.subscribe(`user:${userId}`, (msg) => this.deliver(userId, msg));  // subscribe once per user per node
    }
    set.add(socket);
  }

  onDisconnect(userId: string, socket: Socket): void {
    const set = this.sockets.get(userId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) { this.sockets.delete(userId); this.sub.unsubscribe(`user:${userId}`); }
  }

  private deliver(userId: string, msg: string): void {
    for (const s of this.sockets.get(userId) ?? []) s.send(msg);   // a user with three tabs has three sockets
  }
}
// the order service: publish(`user:${userId}`, JSON.stringify({orderId, status: 'paid'})) — it never knows which node
```

The choice is a trade-off sentence: registry for precision and one hop at the cost of a lookup
and stale-entry handling; pub/sub for simplicity and no lookup at the cost of a broker hop and
fan-out. Most systems of the storefront's size use pub/sub on Redis and never need the registry.

## The reconnection storm

A deploy of the connection tier, or a node failure, closes every connection on that node at
the same instant; every client reconnects at the same instant; the reconnections are TLS
handshakes, authentication, subscriptions and — if the application resends state on connect —
a burst of reads, all landing on the surviving nodes at once. Fifty thousand reconnections in
one second is a self-inflicted spike, and it is the "reconnection storm after a deploy" that
the syllabus names. Four mechanisms, used together:

1. **Drain slowly.** Stop accepting on the node being replaced, then close connections in
   batches over minutes rather than all at once — the drain of [02](02-load-balancing-layer-4-vs-layer-7.md),
   with a timeout of minutes for this tier.
2. **Jitter on the client.** Reconnect after a random delay with exponential backoff — the
   SSE `retry` field is the server's hint, and the client adds randomness — so the storm is
   spread over a window instead of a second.
3. **Cheap reconnection.** TLS resumption ([01](01-from-the-tap-to-the-first-byte.md)), a
   token that is verified locally, and *no* state resend on connect: the client sends
   `Last-Event-ID` and gets only what it missed — SSE's resume mechanism, reimplemented for
   WebSockets as a cursor.
4. **Admission at the connection gateway.** A connect-rate limit that answers "try again in n
   seconds" rather than accepting a hundred thousand handshakes at once — the same admission
   idea as sale day.

The sentence: *"deploys of the connection tier drain over minutes, clients reconnect with
jittered backoff and a cursor so they fetch only what they missed, and the gateway rate-limits
connects — otherwise a deploy is a spike the size of the online population."*

## Where the messages come from

The push is the *last* hop of an asynchronous flow, not a synchronous call from the service
that did the work. The order service commits, writes the outbox row, the publisher emits the
event, and a *notification consumer* publishes to the user's channel — the same log and
consumers as [phase 1's read and write paths](../phase-1-the-method/08-read-path-and-write-path.md).
Two reasons: the service that commits must not wait on a broker or a socket, and the push must
survive the user being offline — the event is durable in the log, and the client's cursor
fetches it on reconnect. A push sent directly from the request handler is lost if the socket is
closed at that moment, and blocks the commit if the broker is slow.

## The storefront

One feature earns a long-lived connection: the **order status page** after checkout — pending,
paid, shipped — and it is push-only, so it is SSE over HTTP/2, reconnecting with
`Last-Event-ID` set to the last status event's ID, served by a small connection tier that
subscribes to `user:{id}` channels on Redis. The notification consumer publishes status events
from the log. Everything else — the catalogue, the cart, checkout — is request-response. A
WebSocket would be justified for a live-chat support feature, and the interviewer who asks
"why not WebSockets everywhere" gets: two-way is not needed, the browser reconnects SSE for
free, and plain HTTP passes every proxy.

## Gotchas

**★ Symptom: "we use SSE" and the seventh tab hangs.** Cause: the six-connection-per-browser
limit on HTTP/1.1, which MDN states. Fix: SSE over HTTP/2, where streams are multiplexed on one
connection.

**★ Symptom: the order is paid and the page never updates — on one node in twenty.** Cause: the
message was sent to the wrong node, or to none; no routing. Fix: pub/sub on a per-user channel
that every connection node subscribes to for the users it holds, or a registry with a TTL.

**★ Symptom: a deploy causes a spike of TLS handshakes and reads the size of the online
population.** Cause: every connection closed at once and every client reconnecting at once. Fix:
drain over minutes, jittered backoff on the client, a cursor so reconnects fetch only what they
missed, a connect-rate limit at the gateway.

**Symptom: WebSockets chosen for a notifications feed.** Cause: two-way assumed necessary. Fix:
SSE — one-way, browser-managed reconnection, plain HTTP through proxies; WebSockets when the
client sends often.

**Symptom: pushes lost when the user was offline.** Cause: the push sent from the request
handler, fire-and-forget. Fix: events durable in the log; the client resumes with a cursor; the
push is the last hop of the asynchronous flow.

**Symptom: the commit waits on the broker.** Cause: publishing inside the handler. Fix: the
outbox; the notification consumer publishes.

**Symptom: the registry says the user is on a node that died an hour ago.** Cause: no cleanup on
abrupt death. Fix: entries with a TTL refreshed by heartbeat, or pub/sub with no registry.

**Symptom: one connection node holds three times the others' connections.** Cause: connections
are sticky by nature and the balancer spread them by round robin at a bad moment. Fix: least
connections at accept time; accept the drift; size for it.

**Symptom: SSE works locally and stalls in production.** Cause: a buffering proxy or CDN holding
the response until it ends. Fix: disable buffering for the stream route; `Cache-Control:
no-store`; flush headers immediately.

**Symptom: the capacity estimate counts connections only.** Cause: message rate ignored. Fix:
connections × messages per second per connection is the load; idle connections are cheap,
writes are not.

## Interview questions

**★ WebSockets, server-sent events or long polling — how do you choose?**
By direction and environment. WebSockets are two-way on one TCP connection — RFC 6455's single
connection for traffic in both directions — and earn their cost when the client sends often:
chat, collaboration. SSE is one-way, server to client, over a plain HTTP response the browser
reconnects on its own with `Last-Event-ID`, so it is the default for push-only features —
notifications, feeds, order status — and it passes any proxy that streams. Long polling is the
fallback for environments that break both. SSE must be over HTTP/2, because MDN's six-connection
limit per browser on HTTP/1.1 applies across tabs.

**★ The order service wants to push "paid" to a user whose socket is on one of twenty nodes.
How does the message get there?**
Either a registry — each connection node records user-to-node in Redis on connect, with a TTL
and heartbeat, and the service sends to that node — or publish-subscribe: the service
publishes to a per-user channel, every connection node subscribes to the channels of the users
it holds, and the node with the socket delivers. Pub/sub costs a broker hop and fan-out but
needs no lookup or stale-entry handling; a registry is one hop but is a store on the failure
walk. Either way the push is the last hop of the asynchronous flow from the outbox, not a call
from the handler that committed.

**★ What happens when you deploy the connection tier, and how do you make it survivable?**
Every connection on the replaced node closes at once and every client reconnects at once —
handshakes, authentication, subscriptions and state fetches the size of the online population,
landing on the surviving nodes in a second. Drain over minutes in batches; make clients
reconnect with jittered exponential backoff; make reconnection cheap with TLS resumption, local
token verification and a cursor so only missed events are fetched; and rate-limit connects at
the gateway so the excess waits instead of arriving.

**Why must the push be the last hop of an asynchronous flow rather than sent from the request
handler?**
Because a push from the handler is lost if the socket is closed at that instant — the user
offline, mid-reconnect — and it makes the commit wait on a broker or a socket. With the event
in the log via the outbox, it is durable: a notification consumer publishes it, the connection
node delivers it if the user is connected, and if not the client's cursor fetches it on
reconnect. The handler's only job is the transaction.

**How many connections can a node hold, and what actually limits it?**
Tens of thousands of idle connections per node is ordinary — a socket, its buffers and an
application object each, bounded by memory and file descriptors rather than CPU. What limits a
node is message rate: fifty thousand connections at one message a second is fifty thousand
writes a second, a different machine from the same connections at one a minute. The estimate is
connections times messages per second; and because connections cannot be rebalanced once
accepted, balance at accept time with least connections and size for drift.

**Why is a separate connection tier worth having?**
Because connections are stateful load and the rest of the system is stateless. Holding sockets
on the same nodes that run request handlers means every deploy of business logic disconnects
everyone, and every handler restart is a reconnection storm. A thin tier that only holds
sockets and forwards — subscribing to channels, writing frames — is deployed rarely and
drained carefully, while the stateless services behind it deploy as often as they like.

---

← Prev: [05 · CDNs](05-cdns.md) · Index: [Phase 2 — The request path](README.md) · Next → **Rate limiting** *(not written yet)*
