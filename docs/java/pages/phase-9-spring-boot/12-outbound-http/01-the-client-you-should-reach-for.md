---
title: "Four clients, one right answer, and most of the internet is wrong about it"
sidebar_label: "1 · Which client"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework reference *REST Clients*
> (docs.spring.io/spring-framework/reference/integration/rest-clients.html) and
> the Spring Boot reference *Calling REST Services*
> (docs.spring.io/spring-boot/reference/io/rest-client.html). Spring Boot 4.1.0,
> Spring Framework 7.0.x, JDK 25.

**Spring ships four ways to call another HTTP service, and in Framework 7 the
ordering between them changed in a way that invalidates almost every tutorial
written before 2025. `RestTemplate` — the one every sample uses — is
*deprecated*, and the reference documentation says so in as many words. Its
replacement is `RestClient`, which is not a wrapper and not a shim: it is the
same request-factory infrastructure with a fluent API and better error
ergonomics. `WebClient` still exists and is still excellent, but the argument
that used to sell it — "you need it for concurrency" — died with virtual
threads. And the option most people have never used, the declarative HTTP
interface, is now the nicest of the four for the ordinary case of "I call three
endpoints on one service".**

## The four options, as the reference lists them

The Spring Framework reference enumerates exactly four:

| Option | Style | Framework 7 status |
|---|---|---|
| **`RestClient`** | synchronous, fluent | **the recommended synchronous client** (since 6.1) |
| **`WebClient`** | non-blocking, reactive, fluent | fully supported; the right client *inside* a reactive stack |
| **`RestTemplate`** | synchronous, template methods | **deprecated as of Spring Framework 7.0** |
| **HTTP service clients** | annotated Java interface, generated proxy | backed by any of the three above |

Note the fourth row carefully: HTTP interfaces are not a fifth transport. They
are a *declaration style* that sits on top of a `RestClient`, a `WebClient` or
(still, for now) a `RestTemplate`. Choosing an interface does not choose a
client — you still choose a client underneath it. That is
[chunk 4](04-http-interfaces.md).

## `RestTemplate` is deprecated — say it plainly

The reference states that as of Spring Framework 7.0, `RestTemplate` is
deprecated in favour of `RestClient` and will be removed in a future version.
That is not a soft signal from a blog post; it is the reference documentation
for the version you are on.

What that does **not** mean:

- It does not mean your existing `RestTemplate` code stops compiling. It is
  deprecated, not removed, and the removal is "a future version" with no date
  attached.
- It does not mean you should spend a sprint rewriting working call sites. A
  deprecation warning is not an outage.

What it does mean is that **every new call site should be `RestClient`**, and
that the migration, when you do it, has an unusually cheap on-ramp. The
reference documents a gradual path whose first step costs one line:

```java
// Keep the existing, fully configured RestTemplate. Wrap it.
RestClient restClient = RestClient.create(restTemplate);
```

That `RestClient` shares the wrapped template's request factory, message
converters and interceptors. So you can introduce `RestClient` into a class that
already has a `RestTemplate` bean without re-deriving any of its configuration,
migrate call sites one at a time, and only at the end replace the `RestTemplate`
construction with `RestClient.Builder`.

The reference publishes a direct translation table. The four rows that cover
most real code:

| `RestTemplate` | `RestClient` |
|---|---|
| `getForObject(url, Class, vars…)` | `get().uri(url, vars…).retrieve().body(Class)` |
| `getForEntity(url, Class, vars…)` | `get().uri(url, vars…).retrieve().toEntity(Class)` |
| `postForObject(url, body, Class, vars…)` | `post().uri(url, vars…).body(body).retrieve().body(Class)` |
| `exchange(url, method, entity, Class, vars…)` | `method(m).uri(url, vars…).headers(…).body(…).retrieve().toEntity(Class)` |

There is one behavioural difference hiding in the migration that is worth
knowing before you hit it. When no request factory is specified, `RestTemplate`
historically defaults to `SimpleClientHttpRequestFactory`, which is built on
`HttpURLConnection`; `RestClient`, given the same empty classpath, picks
`JdkClientHttpRequestFactory` over the modern `java.net.http.HttpClient`
instead. Same code, different transport, different timeout knobs — which is
why [chunk 6](06-what-a-timeout-covers.md) exists.

## `WebClient` is no longer the answer to "I need concurrency"

For roughly a decade the argument for `WebClient` in an otherwise blocking
application went: *a synchronous HTTP call parks a platform thread; platform
threads are expensive; therefore fan out reactively.* Every part of that
argument was true, and the conclusion followed.

On JDK 21+ with virtual threads enabled, the middle premise is gone. A blocking
call on a virtual thread unmounts from its carrier while it waits, so a thousand
concurrent outbound calls cost a thousand cheap continuations rather than a
thousand OS threads. The synchronous code you would rather read now has the
concurrency profile you used to have to buy with `Mono` and `Flux`.

That does not make `WebClient` obsolete. It narrows what it is *for*:

- **You are already in WebFlux.** Then `WebClient` is the correct client and
  `RestClient` would block an event-loop thread — the one failure mode reactive
  stacks cannot tolerate. See
  [Topic 15 — WebFlux and the reactive stack](../15-webflux-reactive/README.md).
- **You need streaming semantics**, not request/response — server-sent events, a
  response body consumed incrementally, backpressure from a slow consumer
  propagated to the producer.
- **You need Reactor's operator vocabulary** for the composition itself:
  `retryWhen`, `timeout`, `zip` across several calls with real cancellation
  semantics. `Flux` cancellation actually aborts the in-flight HTTP exchange;
  interrupting a blocking thread is a weaker signal.

If none of those is true, a `RestClient` call on a virtual thread is simpler,
easier to debug, produces a stack trace that names your own code, and does not
colour every method that touches it. The argument in full is in
[Why virtual threads changed the answer](../15-webflux-reactive/11-why-virtual-threads-changed-the-answer.md)
and [Choosing between the stacks](../15-webflux-reactive/12-choosing.md).

Its API is the same shape as `RestClient`'s, deliberately — the reactive
terminals differ, not the chain:

```java
Mono<Details> details = webClient.get()
        .uri("/{name}/details", name)
        .retrieve()
        .bodyToMono(Details.class);
```

## Gotchas

**⚠️ You wrap `RestTemplate` and lose nothing — then throw the wrapper away**
**Symptom:** a migration stalls because "we cannot move, the template has six
interceptors and a custom message converter".
**Cause:** the team assumed `RestClient.Builder` had to be reconstructed from
scratch.
**Fix:** `RestClient.create(restTemplate)` inherits all of it. Migrate call
sites first, configuration last:

```java
@Bean
RestClient legacyBridge(RestTemplate configuredTemplate) {
    return RestClient.create(configuredTemplate);
}
```

**⚠️ `RestClient` in a WebFlux controller**
**Symptom:** throughput collapses under modest load on a reactive service, and
the thread dump shows a handful of `reactor-http-nio` threads parked in socket
reads.
**Cause:** a synchronous client called from a handler running on the event loop.
There are only as many event-loop threads as cores; blocking one blocks every
request assigned to it.
**Fix:** use `WebClient` on the reactive stack. If you must call blocking code,
move it off the loop explicitly — `Mono.fromCallable(...).subscribeOn(...)` —
and understand that you have re-introduced a thread pool you now have to size.

**⚠️ Treating "deprecated" as "broken" and rewriting everything at once**
**Symptom:** a large, risky pull request that touches every outbound call in the
service and cannot be reviewed properly.
**Cause:** reading a deprecation as an emergency.
**Fix:** the reference's own migration path — wrap, migrate call sites
incrementally, replace construction last. Deprecations in Spring have
historically run for several major versions.

**⚠️ Assuming `WebClient` needs a reactive server**
**Symptom:** an argument in review that "we cannot use `WebClient`, we are on
MVC".
**Cause:** conflating the client with the server stack.
**Fix:** `WebClient` works perfectly well from a servlet application — it just
gives you a `Mono` you will probably `block()` on, which is exactly the
complexity `RestClient` removes. The point is not that it is illegal; it is that
it buys you nothing there.

**⚠️ Migrating the call site and inheriting a different transport**
**Symptom:** a rewritten call starts failing on a proxy, or a `PATCH` that used
to be rejected now works (or vice versa), with no other change.
**Cause:** the default request factory differs between the two clients when the
classpath offers no HTTP library.
**Fix:** stop leaving it to detection. Pin the factory once, globally, and know
what you picked — see [chunk 8](08-pinning-the-factory-tls-proxy.md).

## Interview questions

**★ Spring Framework 7 deprecated `RestTemplate`. What replaced it, and why is
the replacement not just a cosmetic API change?**
`RestClient` replaced it. The important part is what did *not* change: both sit
on the same `ClientHttpRequestFactory` abstraction and the same
`HttpMessageConverter` chain, so the transport, the timeouts and the JSON
handling are identical infrastructure. What changed is the surface.
`RestTemplate` exposes about a dozen overloaded template methods whose parameter
order you have to remember, and its error behaviour is bolted on through a
`ResponseErrorHandler` you set globally on the instance. `RestClient` exposes one
fluent chain where the terminal operation states what you want back — `body`,
`toEntity`, `toBodilessEntity`, `exchange` — and lets you attach `onStatus`
handlers per call. That per-call granularity is the real win: "404 means empty
here, but 404 means a bug there" is a sentence you can express.

**★ Your team is on WebFlux purely because someone said it was needed for
concurrency. Virtual threads now exist. What do you tell them?**
That the premise they bought it for is gone, and that this is a reason to stop
*adding* reactive code rather than a reason to rip it out. The historic argument
was that a blocking HTTP call pins an expensive platform thread, so a service
fanning out to several dependencies needed non-blocking I/O to avoid a thread per
in-flight call. On virtual threads a blocking call unmounts from its carrier
while it waits, so the cost model is roughly what reactive gave you, with code
that reads top to bottom and produces stack traces that name your methods. But a
reactive codebase is reactive all the way through — the colour of the functions
is contagious — so a partial migration gives you both models and the debugging
difficulty of both. The honest advice: new services default to MVC plus virtual
threads plus `RestClient`; existing WebFlux services stay WebFlux and keep using
`WebClient`; and you migrate only when something else already forces the module
open.

**★ What is the relationship between an HTTP service interface and
`RestClient`?**
An HTTP service interface is a declaration, not a transport. You annotate a Java
interface with `@HttpExchange` methods, and `HttpServiceProxyFactory` generates a
proxy that translates each call into an HTTP exchange. The exchange itself is
performed by an adapter over a real client — `RestClientAdapter`,
`WebClientAdapter` or `RestTemplateAdapter`. So choosing the interface style
still leaves you choosing which client executes the calls, and all the
configuration that matters — timeouts, pooling, observation — is configured on
that underlying client, not on the interface.

**★ Is there any situation in 2026 where you would start a new project on
`RestTemplate`?**
Essentially no, and the burden of proof is high. The one defensible case is a
codebase where every outbound call already goes through a thin internal wrapper
built on `RestTemplate`, the wrapper is well tested, and adding a second client
would mean two configurations of timeouts and observation to keep in sync — and
even then the right move is to change the wrapper's implementation to
`RestClient.create(restTemplate)` and keep the wrapper's own API stable. Writing
*new* `getForObject` calls in 2026 means writing against a deprecated API that
the framework has publicly committed to removing.

**★ You are asked to fan out to five independent services and combine the
results, in a servlet application. Do you need `WebClient`?**
No. That is exactly the case virtual threads and structured concurrency solve
with ordinary blocking code: open a scope, fork five subtasks each making a
blocking `RestClient` call, join, and combine. Every one of those virtual threads
unmounts while it waits, so the five calls overlap, and if one fails the scope
can cancel the rest. The advantages over the reactive version are that the code
reads as five calls and a join, the stack traces are real, and a debugger
breakpoint behaves the way you expect. See
[Phase 6 — Concurrency](../../phase-6-concurrency/README.md). The case where
`WebClient` still wins is streaming or genuine backpressure, neither of which a
fan-out-and-combine needs.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Wiring it in Boot 4](02-wiring-it-in-boot-4.md)
