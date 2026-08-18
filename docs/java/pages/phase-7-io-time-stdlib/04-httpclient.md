---
title: "HttpClient"
sidebar_label: "04 · HttpClient"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `java.net.http` — `HttpClient` (and `HttpClient.Builder`,
> `HttpClient.Redirect`, the `close()`/`AutoCloseable` section),
> `HttpRequest`, `HttpResponse.BodyHandlers`,
> `HttpConnectTimeoutException`, `HttpTimeoutException` — and JEP 321
> (the JDK 11 HTTP Client).

**Since JDK 11 the platform can call another service without a library:
`java.net.http.HttpClient` speaks HTTP/1.1 and HTTP/2, sync and async,
with connection pooling behind one immutable, thread-safe client object.
The two decisions that separate production use from demo code are made at
construction and per request: one shared client for the application, and
a timeout on every single request — because the default is *no* request
timeout at all.**

## One client, built once

```java
HttpClient client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(3))
        .followRedirects(HttpClient.Redirect.NORMAL)
        .build();
```

The client owns connection pooling and HTTP/2 multiplexing; it is
immutable and safe to share, and creating one per request throws that
pooling away while accumulating idle resources. Build it once, inject it
everywhere — the same lifecycle discipline as a Jackson `ObjectMapper` or
a JDBC pool.

- **Version:** HTTP/2 is attempted by default and negotiation falls back
  to 1.1 automatically; force with `.version(...)` only when a broken
  intermediary demands it.
- **Redirects:** the default is `NEVER` — a 301 comes back to you as a
  301. `NORMAL` follows redirects except from HTTPS to HTTP; `ALWAYS`
  follows those too, which is rarely what you want.
- **Executor:** async callbacks run on an internal default executor
  unless you supply one — supply one in servers where you need naming,
  bounds or metrics.
- **Lifecycle:** `HttpClient` is `AutoCloseable` since JDK 21; `close()`
  waits for in-flight requests. Close it at application shutdown — not
  per request, which is the new-client-per-request mistake wearing
  try-with-resources clothes
  ([try-with-resources](../phase-5-exceptions/03-try-with-resources/README.md)).

## Every request names its timeout

```java
HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.example.com/orders"))
        .timeout(Duration.ofSeconds(5))          // ← without this: wait forever
        .header("Accept", "application/json")
        .GET()
        .build();
```

Two timeouts, two failure types:

| Timeout | Set on | Fires as |
|---|---|---|
| Connect | the client builder | `HttpConnectTimeoutException` (a subtype of the below) |
| Request (whole exchange) | **each request** | `HttpTimeoutException` from `send`/the async future |

There is **no default request timeout**. A dependency that stops
answering mid-response holds your thread (or your future) indefinitely —
this is the classic incident: one slow downstream, every worker parked in
`send`, the service stops taking traffic. The fix is boring and total:
`.timeout(...)` on *every* request, no exceptions granted.

## Bodies in and out

`BodyPublishers` supply the request body: `ofString(json)`, `ofFile(path)`,
`ofInputStream(supplier)` for streaming, `noBody()`. `BodyHandlers`
consume the response: `ofString()` (charset taken from the Content-Type,
UTF-8 otherwise), `ofFile(path)`, `ofInputStream()` / `ofLines()` for
streaming without buffering the whole payload, `discarding()` when only
the status matters. JSON is just a string body plus Jackson at each end —
the mapping topic is [JSON with Jackson](05-json-jackson/README.md).

## Status codes are data, not exceptions

```java
HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
if (response.statusCode() / 100 != 2) {
    throw new UpstreamException(response.statusCode(), response.body());
}
```

A 404 or a 500 returns *normally* — `statusCode()` is yours to check;
nothing throws on a non-2xx. Exceptions are reserved for the exchange
itself failing: `IOException` (connect refused, connection reset),
`HttpTimeoutException`, `InterruptedException` from the blocking `send`
(cancellation — restore or rethrow, phase 6's
[interruption protocol](../phase-6-concurrency/01-threads-lifecycle-interrupt/README.md)).
Teams migrating from clients that throw on 4xx/5xx ship the
forgot-to-check-status bug in their first week.

There is also no application-level retry, backoff or circuit breaking in
the client. That belongs to the caller — deliberately, since only the
caller knows which requests are idempotent and what a safe retry budget
is.

## Sync, async, and virtual threads

```java
// blocking — one line, exceptions in your face
HttpResponse<String> r = client.send(request, BodyHandlers.ofString());

// async — a CompletableFuture pipeline
client.sendAsync(request, BodyHandlers.ofString())
      .thenApply(HttpResponse::body)
      .orTimeout(5, TimeUnit.SECONDS);
```

`sendAsync` returns a `CompletableFuture` with everything phase 6 said
about executors and composition
([`CompletableFuture`](../phase-6-concurrency/07-completablefuture/README.md)).
On [virtual threads](../phase-6-concurrency/02-platform-vs-virtual-threads/README.md)
the calculus tilts hard toward the blocking form: `send` parks a cheap
virtual thread, the code reads top-to-bottom, exceptions carry sane stack
traces — the throughput argument for async chains was priced by platform
threads. Keep `sendAsync` for genuine composition: racing two sources,
fanning out and joining many calls.

## Gotchas

**Symptom:** all request threads parked in `HttpClient.send`, service unresponsive, no errors logged — recovers only on restart
**Cause:** a downstream stopped responding mid-exchange and the requests carry no `.timeout(...)`; the default is to wait forever
**Fix:** `.timeout(...)` on every `HttpRequest`, connect timeout on the client; alert on p99 latency of dependencies so the slow-down is seen before the pile-up

**Symptom:** integration works against the happy path; against a decommissioned endpoint the code parses an HTML error page as JSON
**Cause:** no `statusCode()` check — the client returns 4xx/5xx responses normally instead of throwing
**Fix:** check the status family before touching the body; encode the policy once in a helper so it can't be forgotten per call site

**Symptom:** memory and native resources creep up under load; sockets in the thousands
**Cause:** a new `HttpClient` built per request — each carries its own connection pool and resources, and none of them reuse connections
**Fix:** one shared client for the application (it is immutable and thread-safe); close it only at shutdown

**Symptom:** a call that works in curl returns 301 with an empty-looking body through Java
**Cause:** the client default is `Redirect.NEVER` — the redirect is handed back to you, not followed
**Fix:** `.followRedirects(Redirect.NORMAL)` on the builder (follows redirects but refuses HTTPS→HTTP downgrades), or handle the `Location` header deliberately

**Symptom:** responses arrive gzip-compressed and body parsing fails with binary garbage
**Cause:** the JDK client neither sends `Accept-Encoding: gzip` nor decompresses automatically — but the code copied a snippet that set the header manually
**Fix:** either don't advertise gzip, or advertise it and wrap the body stream in `GZIPInputStream` when `Content-Encoding: gzip` comes back; frameworks' clients do this for you, the JDK's does not

**Symptom:** async pipeline completes exceptionally with `CompletionException` and the real cause is buried
**Cause:** `sendAsync` failures (timeout, I/O) surface wrapped, per `CompletableFuture` semantics
**Fix:** unwrap with `.getCause()` in `exceptionally`/`handle`; the unwrapping rules are phase 6 topic 07's

**Symptom:** POSTs occasionally hang against one particular legacy server only
**Cause:** HTTP/2 negotiation or expect-continue behavior the intermediary mishandles
**Fix:** pin `.version(HTTP_1_1)` for that client (or per request) after verifying with the server's operators — version pinning is a workaround to record, not a default

## Interview questions

**★ Which two timeouts exist, where is each configured, and what happens if you set neither?**
Connect timeout on the client builder — fails the TCP/TLS establishment
with `HttpConnectTimeoutException`. Request timeout on each
`HttpRequest` — bounds the whole exchange, failing with
`HttpTimeoutException`. Defaults: no request timeout and no connect
timeout — a hung dependency parks your thread or future indefinitely.
Production rule: both, always, sized from the dependency's SLO.

**★ Why doesn't a 500 throw an exception, and what discipline follows?**
The exchange succeeded — a status line and body came back; only
transport-level failure throws (`IOException`, timeout, interrupt). The
client refuses to guess whether a 404 is exceptional for your use case
(for an existence check it's a normal answer). Discipline: every call
site — or one shared helper — checks `statusCode()` and maps non-2xx to
a domain outcome deliberately.

**★ One `HttpClient` per request — what breaks and why is the fix free?**
Each client owns a connection pool, so per-request clients get zero
connection reuse (full TCP+TLS handshake every call) and leak idle
sockets and their resources until GC. The fix is free because the client
is immutable and thread-safe by specification: build one, share it
everywhere, close it at shutdown (`AutoCloseable` since JDK 21).

**★ You're on virtual threads. `send` or `sendAsync` — argue it.**
`send`. The async form existed to keep scarce platform threads from
blocking; a virtual thread parked in `send` costs almost nothing, and the
blocking form gives linear code, real stack traces and straightforward
exception handling. `sendAsync` remains right for composition itself —
racing mirrors, scatter-gather across many endpoints — not for avoiding
the block.

**★ Where did retries go?**
Nowhere — the JDK client doesn't do application-level retries, backoff
or circuit breaking. Only the caller knows idempotency (retrying a
timed-out POST can double-charge) and the retry budget the system can
afford. Wrap the call in your own policy or a resilience library, and
key it on idempotent methods and connection-level failures, not on any
5xx.

**★ What does `Redirect.NORMAL` refuse to do that `ALWAYS` allows?**
Follow a redirect from HTTPS to plain HTTP — a downgrade that would leak
what the original secure request carried. `NORMAL` follows everything
else automatically; `NEVER` (the default) hands every 3xx back to you.

---

← Prev: [Streams, buffers and charsets](03-streams-buffers-charsets.md) · Index: [Phase 7 — I/O, time and the everyday stdlib](README.md) · Next → [JSON with Jackson](05-json-jackson/README.md)
