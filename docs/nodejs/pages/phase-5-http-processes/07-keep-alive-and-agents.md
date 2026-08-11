---
title: "Keep-alive and connection pooling"
sidebar_label: "07 · Keep-alive and agents"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Opening a TCP connection costs a round trip; a TLS one costs two or three. An
HTTP client that does not reuse connections pays that on every call. This is the
classic silent bottleneck — nothing errors, everything is just slower than it
should be.**

There are two pools in Node, and they are unrelated: `http.Agent` for
`http.request`, and undici's `Dispatcher` for `fetch`.

## `http.Agent` — for `node:http`

```console
$ node agent.mjs
http.globalAgent.keepAlive     : true
http.globalAgent.maxSockets    : Infinity
http.globalAgent.maxFreeSockets: 256
default keepAliveMsecs         : 1000

20 sequential requests, keepAlive:false -> 20 TCP connections
20 sequential requests, keepAlive:true  -> 1 TCP connections
20 parallel   requests, maxSockets:3    -> 3 TCP connections
```

Twenty requests over one connection instead of twenty. **`keepAlive` has defaulted
to `true` since Node 19**, so the old advice to construct an agent purely to
enable it is out of date — but any library still passing `keepAlive: false`, or
constructing `new Agent()` from a pre-19 code sample, silently opts out.

| Option | Default | Meaning |
|---|---|---|
| `keepAlive` | `true` | Reuse sockets after the response ends |
| `keepAliveMsecs` | `1000` | TCP keep-alive probe delay on idle sockets |
| `maxSockets` | `Infinity` | Concurrent sockets **per origin** |
| `maxFreeSockets` | `256` | Idle sockets kept per origin |
| `maxTotalSockets` | `Infinity` | Across all origins |
| `timeout` | none | Idle socket timeout |

`maxSockets` is a concurrency limit disguised as a pool setting: at 3, twenty
parallel requests use three connections and queue. That is often what you want
against a fragile upstream — the queue is backpressure.

## The dispatcher — for `fetch`

```console
$ node undici.mjs
20 sequential fetch(), default dispatcher   -> 2 TCP connections
20 parallel   fetch(), default dispatcher   -> 19 TCP connections
20 parallel   fetch(), Agent{connections:4} -> 4 TCP connections
```

Sequential calls reuse. **Parallel calls do not queue** — the default dispatcher
opens a connection per concurrent request, so a burst of 500 becomes 500 sockets
to one origin. Against a service with its own connection limits that is how you
DoS a dependency from your own service.

Bounding it needs undici explicitly:

```js
import { Agent, setGlobalDispatcher } from 'undici';

setGlobalDispatcher(new Agent({
  connections: 64,             // per origin — the cap that matters
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 60_000,
  pipelining: 1,
}));
```

**`undici` must be installed to do this.** Node bundles it internally but does not
export it as a module — `import 'undici'` in a bare Node script fails with
`ERR_MODULE_NOT_FOUND`. Add the dependency; the installed copy sets the same
global dispatcher that built-in `fetch` reads. Verified with undici 8.10.0 on
Node 24.19.0. That also means the installed version and the bundled one can
differ, so pin it.

### The per-call `dispatcher` trap

Per-client pools are better hygiene than one global — a burst of payment traffic
should not starve every other outbound call. The obvious way to do it does not
work:

```js
import { Agent, fetch as undiciFetch } from 'undici';

const payments = new Agent({ connections: 16 });

await fetch(url, { dispatcher: payments });          // ❌ UND_ERR_INVALID_ARG
await undiciFetch(url, { dispatcher: payments });    // ✅
```

```console
$ node tlsdemo2.mjs
global fetch, default trust   -> FAILED: UNABLE_TO_VERIFY_LEAF_SIGNATURE
global fetch + userland Agent -> FAILED: UND_ERR_INVALID_ARG
undici.fetch + our CA         -> 200 secure
global fetch, global disp.    -> 200 secure
```

**Node's built-in `fetch` rejects a dispatcher built by the `undici` you
installed** — the bundled copy and the npm copy are different classes, and the
instance check fails. `setGlobalDispatcher` works across the boundary because it
writes a well-known global; the per-call option does not. So on Node 24 you pick
one: `setGlobalDispatcher` with global `fetch`, or import `fetch` from `undici`
and use `dispatcher` per call. Mixing them fails at runtime, not at startup.

## The unread body, again

```console
$ node unread.mjs
   62 ms request 1: status 200 — body NOT read
(hangs — request 2 never starts)
```

A pooled connection is returned when the response body is finished. An unread
body never finishes, so with `connections: 1` the pool is permanently empty. With
the default pool the symptom is slower and stranger: connection count climbs,
file descriptors leak, and eventually calls hang with no error. Consume or
`cancel()` every body ([page 05](05-fetch.md)).

## Keep-alive on the server side

The same idea inbound, where the failure mode is a 502:

```js
server.keepAliveTimeout = 65_000;      // default 5000
server.headersTimeout   = 66_000;      // must exceed keepAliveTimeout
```

If the proxy in front of Node holds idle connections for 60 s and Node drops them
at 5 s, the proxy will occasionally send a request into a socket Node is closing
at that instant. It cannot know whether the request was processed, so it returns
502. **Node's idle timeout must exceed the proxy's** — AWS ALB defaults to 60 s,
which is where the 65 comes from.

## When pooling is the wrong answer

Behind a load balancer that distributes per *connection*, a long-lived pool pins
you to whichever backends you connected to first, and a scale-up event delivers
no new traffic to the new instances. The fix is a bounded connection lifetime
(`keepAliveMaxTimeout`, or periodic recycling), not disabling keep-alive.

## Gotchas

**Symptom:** Outbound latency is dominated by connection setup
**Cause:** A client library constructing `new Agent({ keepAlive: false })`, or
per-request agents.
**Fix:** One shared agent or dispatcher for the process lifetime.

**Symptom:** A burst of traffic opens hundreds of sockets to one upstream
**Cause:** undici's default dispatcher does not bound per-origin concurrency.
**Fix:** `new Agent({ connections: N })` and pass it as `dispatcher`.

**Symptom:** Intermittent 502s from the load balancer, no errors in Node
**Cause:** `keepAliveTimeout` shorter than the proxy's idle timeout.
**Fix:** Raise it above the proxy's, and keep `headersTimeout` higher still.

**Symptom:** `EMFILE` or steadily climbing fd count in a service that only makes
HTTP calls
**Cause:** Unread response bodies pinning connections.
**Fix:** Consume or cancel every body.

**Symptom:** New instances receive no traffic after a scale-up
**Cause:** Existing pooled connections never expire.
**Fix:** Bound connection lifetime rather than disabling keep-alive.

**Symptom:** `UND_ERR_INVALID_ARG` when passing a `dispatcher` to `fetch`
**Cause:** Built-in `fetch` does not accept an `Agent` from the npm `undici`.
**Fix:** `setGlobalDispatcher`, or import `fetch` from `undici` too. Note also
that `http.request` takes `agent`, never `dispatcher`.

## Interview questions

**★ What does keep-alive save, and how much?**
The TCP handshake and, over HTTPS, the TLS handshake — one and two-plus round
trips respectively. Measured here: twenty sequential requests used one connection
with keep-alive and twenty without.

**★ Is `keepAlive` still off by default in Node?**
No. `http.globalAgent.keepAlive` has been `true` since Node 19. The stale advice
survives in code samples, and passing `keepAlive: false` explicitly is now the
thing that causes the problem.

**★ Why do parallel `fetch` calls open so many connections?**
undici's default dispatcher has no per-origin concurrency cap, so it opens a
connection per in-flight request rather than queueing — nineteen for twenty
parallel calls in the measurement above. Bounding it requires an explicit
`Agent({ connections })`.

**★ Where do intermittent 502s from a load balancer come from?**
Node closing an idle keep-alive connection at the same moment the proxy reuses
it. Node's `keepAliveTimeout` defaults to 5 s, well under a typical 60 s proxy
idle timeout, so the race is common. Raise Node's above the proxy's.

**How do you bound concurrency to one flaky upstream without touching the rest?**
Give that client its own dispatcher with a low `connections` value and pass it per
call. Requests beyond the cap queue instead of piling onto the dependency.

**Why does an unread response body matter to the pool?**
The connection is only returned when the body stream completes. An unread body
never completes, so the connection is held for the life of the process.

---

← Prev: [Outbound timeouts](06-outbound-timeouts.md) · Next → [Outbound client discipline](08-outbound-client-discipline.md)
