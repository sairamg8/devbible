---
title: "\"Connect\" and \"read\" do not mean what you think, and neither is a deadline"
sidebar_label: "6 · What a timeout covers"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework 7.0.x API for
> `JdkClientHttpRequestFactory` and `SimpleClientHttpRequestFactory`
> (docs.spring.io/spring-framework/docs/current/javadoc-api/), the JDK 25 API for
> `java.net.http.HttpRequest.Builder.timeout(Duration)`
> (docs.oracle.com/en/java/javase/25/docs/api/java.net.http/), the Spring
> Framework reference *REST Clients → Client Request Factories*, and the Spring
> Boot reference *Calling REST Services → HTTP Client Detection*. Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**Two words appear on every HTTP client — connect timeout and read timeout — and
neither of them is the thing you actually want, which is a *deadline*: a bound on
how long this call can take in total. A connect timeout bounds only the TCP and
TLS handshake, which is the part that almost never hangs. A read timeout means
different things on different request factories, and on one of them it is not
even a read timeout. And on the default JDK client, the JDK's own javadoc says
that not setting a timeout means "block forever". A dependency that accepts your
connection, sends response headers, and then stops — the single most common
degraded-service failure mode — can hold your thread past every timeout you
thought you had set.**

## The three things people mean by "timeout"

| Name | Bounds | What it protects you from |
|---|---|---|
| **Connect timeout** | establishing the TCP connection (and, depending on the library, the TLS handshake) | a host that is down, a firewall that blackholes, DNS pointing at nothing |
| **Read / response timeout** | waiting for response data — either *any* data, or the *complete* response, depending on the library | a peer that accepted the connection and then went quiet |
| **Deadline** | the entire call, including connection acquisition, retries and body streaming | everything, including the failure modes the other two miss |

Only the third is what a caller cares about. The first two are what the libraries
give you, and the gap between them is where outages live.

The failure the connect timeout does *not* cover is the important one. A service
under load — GC pause, saturated thread pool, a lock convoy — usually still
*accepts* connections, because accepting is done by the OS. Your connect succeeds
in a millisecond. Then nothing comes back. Everything after that point is the
read timeout's problem, and if the read timeout is unset, "nothing comes back" is
a state your thread can sit in indefinitely.

## The request factories differ, and the differences are not cosmetic

`RestClient` and `RestTemplate` both go through a `ClientHttpRequestFactory`. The
reference lists five:

| Factory | Underlying library |
|---|---|
| `JdkClientHttpRequestFactory` | `java.net.http.HttpClient` |
| `HttpComponentsClientHttpRequestFactory` | Apache HttpComponents `HttpClient` |
| `JettyClientHttpRequestFactory` | Jetty `HttpClient` |
| `ReactorNettyClientRequestFactory` | Reactor Netty `HttpClient` |
| `SimpleClientHttpRequestFactory` | `HttpURLConnection` |

And it states the detection order: if no factory is specified, `RestClient` uses
Apache or Jetty if they are on the classpath, then the JDK client, and finally the
simple default. Boot's own detection, documented separately, is Apache → Jetty →
Reactor Netty → JDK → simple.

🔴 **Two consequences of leaving detection alone.** First, *adding a dependency
can change your HTTP transport.* Some other library pulls in Apache
HttpComponents transitively, and your outbound calls silently move onto a
different client with a different pool and different timeout semantics. Second,
**the detected factory differs between your CI image and production** if the
dependency graphs differ at all. Pin it (that is
[chunk 8](08-pinning-the-factory-tls-proxy.md)) and the question stops existing.

## The JDK client: what "read timeout" actually means there

This is the case worth reading carefully, because the JDK client is what you get
by default on a lean classpath.

`JdkClientHttpRequestFactory` exposes `setReadTimeout(int)` and
`setReadTimeout(Duration)`. Its javadoc says the timeout value is the underlying
`HttpClient`'s read timeout, that `0` means an infinite timeout, and that the
default is *the system's default timeout*.

There is no `setConnectTimeout` on that factory at all. The connect timeout for
the JDK client is set on the `java.net.http.HttpClient` itself, via
`HttpClient.newBuilder().connectTimeout(...)` — which is why Boot exposes it as a
property and hands you a builder rather than expecting you to reach through the
factory.

And the JDK's own request-level timeout, which is the mechanism available for
bounding the response, is documented as:

> Sets a timeout for this request. If the response is not received within the
> specified timeout then an `HttpTimeoutException` is thrown from
> `HttpClient::send` or `HttpClient::sendAsync` completes exceptionally with an
> `HttpTimeoutException`. The effect of not setting a timeout is the same as
> setting an infinite `Duration`, i.e. block forever.

Three things follow, and they are the reason this chunk exists:

1. **"Block forever" is the documented default.** Not a long default. Forever.
2. It times *the response being received*, not each individual socket read. That
   is a different — and generally better — guarantee than a classic socket
   `SO_TIMEOUT`, which resets on every byte and therefore never fires against a
   peer that dribbles one byte a second.
3. ⚠️ **What it does not clearly bound is a slow response *body*.** The javadoc
   says "if the response is not received"; whether a large body still streaming
   after headers have arrived is inside or outside that window is not something I
   could settle from the javadoc text alone. Treat a large streamed body as
   *unbounded* unless you have verified otherwise on your JDK, and put a real
   deadline around it — [chunk 11](11-deadlines-not-timeouts.md).

## Apache, Jetty and Reactor Netty

The other factories have their own vocabularies, and the mapping is not
one-to-one:

- **Apache HttpComponents** distinguishes a *connect* timeout, a *response*
  timeout, and — separately — a **connection request timeout**: how long a caller
  will wait for a *pooled connection to become available*. That third one has no
  equivalent on the JDK client and is the one that fires first when a pool is
  exhausted. It is the subject of [chunk 9](09-the-pool-is-the-real-limit.md).
- **Jetty** and **Reactor Netty** both express the response bound as an idle or
  read-handler timeout on the channel. The Boot reference's Reactor Netty example
  configures a connect timeout with `ChannelOption.CONNECT_TIMEOUT_MILLIS` and a
  read bound by adding a `ReadTimeoutHandler` to the pipeline — which is a
  per-read idle timeout, not a whole-response one.
- **`SimpleClientHttpRequestFactory`** is `HttpURLConnection`. It has no
  connection pool worth the name and lacks capabilities the others have. It
  exists as a last-resort fallback, not as a choice.

The practical summary: **"read timeout" is a Spring-level word that each library
implements with whatever it has**, and whether it bounds the whole response or
only the gap between two bytes depends on which library you are on. That is a
strong argument for pinning the factory rather than accepting detection.

## What none of them give you

None of these is a deadline. Specifically:

- A read timeout is **per attempt**. Add a retry and the worst case multiplies.
- A connect timeout can fire more than once against a multi-homed host, because
  the client may try several resolved addresses.
- None of them counts time spent **waiting for a connection from the pool**
  except Apache's connection-request timeout.
- None of them knows how much of the *caller's* budget has already been spent.

So the honest way to read a configured timeout is: *this is a bound on one
attempt at one phase of one call, on this library.* Turning that into "this
request will answer within 400 ms" is the work of chunks
[8](09-the-pool-is-the-real-limit.md) and [9](11-deadlines-not-timeouts.md).

## Gotchas

**⚠️ "We set a timeout" turns out to mean the connect timeout only**
**Symptom:** an incident where every thread is parked in a socket read against
one degraded dependency, in a service whose configuration visibly contains a
timeout.
**Cause:** only `connect-timeout` was set. The dependency was reachable — it just
never answered.
**Fix:** always set both. A connect timeout without a read timeout protects you
from the failure mode that is already obvious and leaves you exposed to the one
that actually happens.

**⚠️ Assuming an unset timeout means "some sensible default"**
**Symptom:** a call that hangs for minutes with no exception.
**Cause:** for the JDK client the documented effect of not setting a request
timeout is to block forever; `setReadTimeout(0)` on the Spring factory is
likewise explicitly infinite.
**Fix:** set the value explicitly, in configuration, for every client. "Inherit
the default" is not a decision you can defend in a post-mortem.

**⚠️ A transitive dependency changes the request factory**
**Symptom:** timeout behaviour, pooling and even proxy handling change after a
dependency bump that touched nothing you own.
**Cause:** detection picks Apache or Jetty as soon as it appears on the
classpath, ahead of the JDK client.
**Fix:** pin the factory explicitly. Then a new transitive dependency is a
dependency, not a transport change.

**⚠️ Setting a read timeout and believing a slow body is covered**
**Symptom:** a call bounded to two seconds occupies a thread for a minute while
a very large response streams in.
**Cause:** depending on the library, the bound applies to receiving the response
(or to each read), not to finishing the body.
**Fix:** bound the body itself. Cap what you are willing to accept — a
`Content-Length` check before reading, or a size-limited read — and put a real
deadline around the whole operation.

**⚠️ Copying a Reactor Netty `ReadTimeoutHandler` example onto a `RestClient`**
**Symptom:** the configuration compiles and does nothing.
**Cause:** the handler configures a Netty channel pipeline; it applies to the
reactive `ClientHttpConnector`, not to whatever factory your synchronous client
is using.
**Fix:** configure the factory your client actually has. If you do not know which
one that is, that is the real finding.

**⚠️ Treating a per-attempt timeout as a per-call bound in a retrying client**
**Symptom:** a call documented as "2 second timeout" takes eight seconds.
**Cause:** three retries at two seconds each, plus backoff.
**Fix:** either budget the retries into the number you promise, or use a
mechanism that bounds the whole retry sequence — Framework 7's `@Retryable` has a
`timeout` attribute for exactly this, covered in
[chunk 15](15-retrying-safely.md).

## Interview questions

**★ What is the difference between a connect timeout and a read timeout, and
which one protects you from a degraded dependency?**
The connect timeout bounds establishing the connection — TCP, and depending on
the library the TLS handshake. The read or response timeout bounds waiting for
data once connected. The read timeout is the one that matters for a degraded
dependency, and the reason is that degradation rarely stops a host accepting
connections: accepting is done by the kernel, so a service in a GC pause or with
a saturated thread pool still completes your handshake in a millisecond and then
tells you nothing. A connect timeout alone protects you only from a host that is
fully down, which is the failure you would have noticed anyway.

**★ On the default JDK-based request factory, what happens if you set no
timeouts at all?**
Nothing good, and the documentation is unusually blunt about it: the JDK's
`HttpRequest.Builder.timeout` javadoc says the effect of not setting a timeout is
the same as an infinite `Duration` — block forever. Spring's
`JdkClientHttpRequestFactory` mirrors that, documenting `0` as an infinite
timeout. So an unconfigured client against a peer that accepts and then goes
silent will park the calling thread indefinitely. In a servlet application with a
bounded request-handling pool, that is how one slow dependency takes the whole
service down; with virtual threads you do not exhaust a pool, but you still
accumulate unbounded in-flight work and every caller still waits.

**★ Why is it a problem to let Spring detect the request factory?**
Because the detected factory is a function of the classpath, and the classpath
changes for reasons that have nothing to do with HTTP. Detection prefers Apache,
then Jetty, then Reactor Netty, then the JDK client, then the simple fallback —
so a library that pulls in Apache HttpComponents transitively silently moves
every outbound call onto a different client with a different connection pool and
different timeout semantics. Worse, the graphs can differ between your test image
and production, so the transport you tested is not the one you shipped. Pinning
the factory costs one property and removes an entire class of "it changed and
nobody touched it" incidents.

**★ Someone shows you a read timeout of 2 seconds and says the call cannot take
longer than 2 seconds. Where are they wrong?**
In at least four places. The read timeout bounds one attempt, so any retry
multiplies it. It does not cover waiting for a connection from an exhausted pool
— only Apache has a separate connection-request timeout for that, and it is
usually unset. Depending on the library it may not cover streaming a large
response body after the headers arrive. And a connect timeout can fire more than
once against a multi-homed host as the client tries successive addresses. A
timeout is a bound on one phase of one attempt on one library; it is not a
deadline, and treating it as one is how a "2 second" call shows up as a ten
second p99.

**★ Apache HttpComponents has a timeout the JDK client does not. Which, and why
does it matter?**
The connection-request timeout: how long a caller waits to be handed a
*connection from the pool*, as distinct from waiting for the remote host. It
matters because under load the pool is usually the first thing to run out, and
without that timeout the wait for a connection is unbounded — so a client that
looks correctly configured, with both connect and read timeouts set, can still
have threads parked indefinitely, and they will be parked inside the pool rather
than in a socket read, which makes the thread dump look nothing like the
"downstream is slow" case people expect.

**★ What is the practical difference between a per-read socket timeout and a
whole-response timeout?**
A per-read timeout, the classic `SO_TIMEOUT` model, fires only when no byte
arrives for the configured interval — so a peer sending one byte per second keeps
the connection alive forever without ever tripping it. A whole-response timeout
bounds the entire response regardless of how the data is paced, which is strictly
the stronger guarantee against a slow-drip peer. The JDK client's request timeout
is documented in terms of receiving the response, which is the stronger shape;
Reactor Netty's `ReadTimeoutHandler` is the per-read shape. Knowing which one
your factory implements is the difference between a bound and a suggestion.

---

← Prev: [HTTP service groups](05-http-service-groups.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Configuring timeouts in Boot 4](07-configuring-timeouts-in-boot.md)
