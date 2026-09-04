---
title: "Which HTTP client object your service ends up holding is decided by your classpath, by whether you injected a builder or called a static factory, and by a deprecation that almost everybody overstates"
sidebar_label: "14 · The client you actually get"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Spring Boot **4.1** reference, "Calling REST Services"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/io/rest-client.html)), the
> Spring Framework 7.0.x reference, "REST Clients"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html)),
> and `_PHASE-NOTES.md` fact 5 on Spring Cloud LoadBalancer (Commons **5.0.x**).
> 🔴 **No sandbox.** Version spine: JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 ·
> Spring Cloud train 2025.1.x.

**[13 · Timeouts in Spring](04c-timeouts-in-spring.md) established that the timeout properties
have no documented default, which means the behaviour of an unconfigured client is a property
of *which client you got*. That turns out to be three separate questions, and on most projects
all three are answered by accident: which HTTP library the classpath selected, whether the
object in your service was built by the auto-configuration or by a static factory that ignores
it, and whether the `RestTemplate` you inherited is actually broken. The third question is the
one where the internet will lie to you, and acting on the lie costs a rewrite.**

## Which library, and why your classpath decides

The Boot reference documents the selection order. For imperative clients (`RestClient`,
`RestTemplate`), in order of preference: Apache HttpClient, Jetty HttpClient, Reactor Netty
HttpClient, the JDK client (`java.net.http.HttpClient`), then `HttpURLConnection`. For
reactive clients (`WebClient`): Reactor Netty, the Jetty RS client, Apache HttpClient, then
the JDK client.

**Read that as a warning.** Adding a dependency for an unrelated reason can change which HTTP
client your application uses, and therefore change its unconfigured timeout behaviour, without
a single line of your code changing. Pin it deliberately:

```yaml
spring:
  http:
    clients:
      imperative:
        factory: jdk
      reactive:
        connector: reactor
```

## Which object: the builder is auto-configured, the static factory is not

Spring Boot auto-configures a prototype `RestClient.Builder` bean, and the reference gives
three ways to customise a client, of which the third is a trapdoor:

1. Inject `RestClient.Builder` and call its methods — narrow scope. The builder can be cloned
   with `RestClient.Builder other = builder.clone();` when you need a variant.
2. Declare `RestClientCustomizer` beans — application-wide.
3. *"Fall back to the original API"* by calling `RestClient.create()` — and the reference is
   explicit that **no auto-configuration is applied**.

The same three-way structure exists for `WebClient` (`WebClient.Builder`,
`WebClientCustomizer`, `WebClient.create()`) and for `RestTemplate` (`RestTemplateBuilder`,
`RestTemplateCustomizer`, or defining your own `RestTemplateBuilder` bean).

Option 3 inside a `@Service` is a defect, and a quiet one: the code compiles, the calls work in
development, and the client has none of your `spring.http.clients` settings, no group, no
customizers, no observation instrumentation and — on Spring Cloud — no load balancing. It looks
identical in review to the correct version.

```java
// wrong in a service class: opts out of everything the application configured
private final RestClient pricing = RestClient.create("https://pricing.internal");

// right: the auto-configuration applies, including timeouts, groups and customizers
PricingGateway(RestClient.Builder builder) {
    this.pricing = builder.baseUrl("https://pricing.internal").build();
}
```

## Setting it in Java, when configuration is not enough

For a client that needs settings the properties cannot express, build the request factory
yourself. The Boot reference's own example:

```java
@Service
public class MyService {

    private final RestClient restClient;

    public MyService(RestClient.Builder restClientBuilder, SslBundles sslBundles) {
        HttpClientSettings settings = HttpClientSettings
                .ofSslBundle(sslBundles.getBundle("mybundle"))
                .withReadTimeout(Duration.ofMinutes(2));
        ClientHttpRequestFactory requestFactory =
                ClientHttpRequestFactoryBuilder.detect().build(settings);
        this.restClient = restClientBuilder.baseUrl("https://example.org")
                .requestFactory(requestFactory).build();
    }

    public Details someRestCall(String name) {
        return this.restClient.get().uri("/{name}/details", name)
                .retrieve().body(Details.class);
    }
}
```

Two things to notice, because both are traps.

**`RestClient.create()` bypasses everything.** The reference lists it as the "fall back to the
original API" option, and is explicit that no auto-configuration is applied. A
`RestClient.create("https://…")` in a service class has no group, no configured timeouts, and
no customizers. The same is true of `WebClient.create()`. If you want the application's
settings, you inject the auto-configured **builder**, never call the static factory.

**The two-minute read timeout in that example is Spring's illustration, not a
recommendation.** For an inter-service call on a user's request path, two minutes is longer
than every budget in this topic by two orders of magnitude. Copying documentation examples for
their timeout values is a real and common way to end up with an unbudgeted system.

## `RestTemplate`: deprecated, not removed

Because this is widely mis-stated, here is what the Spring Framework 7.0 reference actually
says, verbatim:

> *"As of Spring Framework 7.0, `RestTemplate` is deprecated in favor of `RestClient` and will
> be removed in a future version, please use the 'Migrating to RestClient' guide. For
> asynchronous and streaming scenarios, consider the reactive `WebClient`."*

**Deprecated. Not removed. Still works.** Boot 4.1 still auto-configures a
`RestTemplateBuilder`, and Spring Cloud LoadBalancer on the Oakwood train (Commons 5.0.x)
still load-balances `RestTemplate` alongside `RestClient`, `WebClient` and HTTP Service
Clients. A page that tells you `@LoadBalanced RestTemplate` has stopped working is wrong, and
acting on it would mean rewriting code that is fine.

Use `RestClient` for new code because it is the supported direction and has the better API —
not because the alternative broke.

## Gotchas

**★ Adding an unrelated dependency can change your HTTP client.** The selection order is
classpath-driven — Apache, then Jetty, then Reactor Netty, then the JDK client for imperative
use. Pulling in a library that transitively brings Apache HttpClient promotes it to first
choice. Pin `spring.http.clients.imperative.factory` so that the choice is a decision rather
than a side effect.

**★ `RestClient.create()` and `WebClient.create()` opt out of all of it.** No group, no
properties, no customizers, no observability instrumentation, no load balancing. They are
appropriate in tests and in throwaway tools, and they are a defect in a service class. Inject
the builder.

**★ Copying a timeout out of a documentation example imports a value chosen to illustrate an
API.** The Boot reference's `withReadTimeout(Duration.ofMinutes(2))` demonstrates
`HttpClientSettings`; it is not advice about inter-service calls. Derive the number from the
budget, then sanity-check it against the dependency's latency distribution.

**★ `RestClient` is synchronous and thread-safe, and the builder is a prototype bean.**
The Framework reference notes that *"Once created, a `RestClient` is safe to use in multiple
threads."* Build one per dependency at construction time and hold it; never build one per
request. The `RestClient.Builder` bean is prototype-scoped precisely so that each injection
point gets its own instance to configure without affecting anyone else's.

**★ A `WebClient` in an otherwise imperative service pulls in a second HTTP stack.**
Reactive clients select a connector via `spring.http.clients.reactive.connector` with a
different preference order and a different configuration surface from the imperative factory.
You now have two sets of timeout semantics to keep aligned against one latency budget.
Sometimes justified; never free.

**★ The "Migrating to RestClient" guide is a real artefact and the deprecation names it.**
The Framework reference says *"please use the 'Migrating to RestClient' guide"*. Follow it
rather than translating method by method: the default status handling differs, and a mechanical
rewrite silently changes behaviour on 4xx and 5xx responses — which for a synchronous
dependency is precisely the behaviour your retry and fallback logic depends on.

## Interview questions

**★ Is `RestTemplate` removed in Spring Framework 7?**
No. It is deprecated: the reference says it is *"deprecated in favor of `RestClient` and will
be removed in a future version"*. It still works, Boot 4.1 still auto-configures a
`RestTemplateBuilder`, and Spring Cloud LoadBalancer on the current train still supports
load-balanced `RestTemplate` alongside `RestClient`, `WebClient` and HTTP Service Clients. Use
`RestClient` for new code because that is the supported direction; do not rewrite working
`@LoadBalanced RestTemplate` code on the belief that it stopped functioning.

**★ Why is `RestClient.create("https://…")` inside a `@Service` a code smell?**
Because it opts out of everything the application configured. The reference lists the static
factory as the way to "fall back to the original API", with no auto-configuration applied —
which means no group, no `spring.http.clients` timeouts, no `RestClientCustomizer` beans, no
load balancing and no instrumentation. Injecting the auto-configured `RestClient.Builder`
gets all of it, and costs one constructor parameter.

**★ Your service's latency changed after a dependency upgrade that touched no application
code. What is one Spring-specific explanation?**
The upgrade pulled a different HTTP client onto the classpath and changed which request factory
Boot selects. The documented preference for imperative clients is Apache, Jetty, Reactor Netty,
the JDK client, then `HttpURLConnection`, and those libraries differ in connection pooling,
keep-alive handling and what an unconfigured timeout means. Pinning
`spring.http.clients.imperative.factory` removes the whole class of surprise, and is worth doing
even when the current default is the one you want.

**★ How do you apply a cross-cutting concern to every HTTP client in the application?**
Declare a `RestClientCustomizer` bean, or a `WebClientCustomizer` for the reactive side — the
reference lists this as the application-wide customisation option. It is the right home for a
correlation-header interceptor, a deadline-propagation interceptor or a default `Accept` header.
Note the consequence: it applies to every client built from the auto-configured builder and to
none built by `RestClient.create()`, which is an independent reason to ban the static factory in
service code.

**★ When would you use `HttpClientSettings` and `ClientHttpRequestFactoryBuilder` instead of
properties?**
When the setting is not expressible as configuration or must be computed: a per-client SSL
bundle combined with a specific read timeout, a factory chosen programmatically, or values
derived at startup. The reference's own example builds
`HttpClientSettings.ofSslBundle(...).withReadTimeout(...)` and passes it to
`ClientHttpRequestFactoryBuilder.detect().build(settings)`. For the ordinary case — a base URL
and two timeouts per dependency — HTTP Service groups in `application.yml` are simpler and keep
the whole latency budget readable in one place.

{/* FOOTER */}
