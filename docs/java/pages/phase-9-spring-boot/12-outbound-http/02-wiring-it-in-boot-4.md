---
title: "Take the builder, never call create() — Boot 4's client wiring"
sidebar_label: "2 · Wiring it in Boot 4"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Boot reference *Calling REST Services*
> (docs.spring.io/spring-boot/reference/io/rest-client.html), the Spring Boot 4.0
> Migration Guide
> (github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)
> and the Spring Boot 4.1.0 API for `org.springframework.boot.http.client`
> (docs.spring.io/spring-boot/api/java/org/springframework/boot/http/client/package-summary.html).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Everything Boot gives an outbound client — the timeouts, the SSL bundle, the
proxy, the metrics, the trace propagation — is applied to the auto-configured
*builder*, not to the client class. So the single line that decides whether your
service is observable and survivable is which of two nearly identical
expressions you wrote: `builder.build()` or `RestClient.create()`. The second
compiles, passes its test, reads fine in review, and quietly opts out of every
protection the platform team put in place. This chunk is about the wiring you
inherit for free and the two ways people accidentally decline it.**

## The starters are new in Boot 4, and this is where upgrades break

Boot 4 reorganised the web starters, and HTTP clients got their own. From the
migration guide:

| Starter | What it brings |
|---|---|
| `spring-boot-starter-restclient` | `RestClient` and its auto-configuration |
| `spring-boot-starter-restclient-test` | the test-side support for the above |
| `spring-boot-starter-webclient` | `WebClient` and its auto-configuration |
| `spring-boot-starter-webclient-test` | the test-side support for the above |
| `spring-boot-starter-webmvc` | the servlet web stack (renamed from `-web`) |

Two consequences bite immediately:

1. **`spring-boot-starter-web` is now `spring-boot-starter-webmvc`.** Copying a
   `pom.xml` fragment from a 2024 article gives you an artifact id that no longer
   resolves against the Boot 4 BOM.
2. **Being a web application no longer implies having an HTTP client.** In Boot 3
   the reactive `WebClient` arrived transitively often enough that people assumed
   it was always present. In Boot 4 the client you want is a dependency you
   declare.

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-restclient</artifactId>
</dependency>
```

If `RestClient.Builder` will not inject after an upgrade, that missing starter is
the near-certain cause — long before you start suspecting component scanning.

## The prototype builder, and why it is a prototype

Boot auto-configures a **prototype-scoped `RestClient.Builder`**: a fresh,
pre-configured builder per injection point.

```java
@Service
public class InventoryClient {

    private final RestClient restClient;

    InventoryClient(RestClient.Builder builder) {
        this.restClient = builder
                .baseUrl("https://inventory.internal")
                .defaultHeader("Accept", "application/json")
                .build();
    }
}
```

Prototype scope is a deliberate design decision, not an accident of
configuration. The builder is *mutable*, and every consumer specialises it. If it
were a singleton, `builder.baseUrl("https://a")` in one service and
`builder.baseUrl("https://b")` in another would mutate the same object, and which
one won would depend on bean initialisation order — invisible in a test with one
client, catastrophic in production with five. Prototype scope gives each
injection point its own copy of the shared configuration, free to be
specialised.

The same holds for `WebClient.Builder`, and — for as long as you still have one —
`RestTemplateBuilder`. Note the asymmetry there: Boot auto-configures
`RestTemplateBuilder` but deliberately does **not** auto-configure a
`RestTemplate` bean, for exactly the reason above.

## 🔴 `RestClient.create()` opts out of everything

This is the single highest-value fact in the topic, so it gets stated on its own.

```java
// ❌ Compiles. Passes its unit test. Ships. Has no timeout and no metric.
private final RestClient client = RestClient.create("https://inventory.internal");

// ✅ Identical behaviour on the happy path; correct everywhere else.
InventoryClient(RestClient.Builder builder) {
    this.client = builder.baseUrl("https://inventory.internal").build();
}
```

A statically created `RestClient` never passes through auto-configuration, so it
inherits:

- **none of the `spring.http.clients.*` timeouts** — so it has whatever the
  underlying library defaults to, which for the JDK client is *no response
  timeout at all*;
- **none of your `RestClientCustomizer` beans** — no shared interceptors, no
  auth header, no user-agent;
- **no SSL bundle** — so it uses the JVM default trust store, not your bundle;
- **no `ObservationRegistry`** — so it emits no `http.client.requests` metric and
  propagates no trace context, which is
  [chunk 16](16-observing-outbound-calls.md).

The reason it survives code review is that it looks *simpler*. The reason it is
dangerous is that all four of those omissions are invisible until the dependency
degrades, at which point you have neither the timeout that would have protected
you nor the chart that would have told you why.

**This is worth enforcing mechanically**, because reading the diff will not catch
it — an ArchUnit rule or a Checkstyle regex banning `RestClient.create` and
`new RestTemplate` outside configuration classes costs an hour and pays forever.

## `RestClientCustomizer`: applying something to every client

For configuration that must apply to *every* client in the application, declare a
`RestClientCustomizer` bean. Boot applies every such bean to every
auto-configured `RestClient.Builder` before you receive it.

```java
@Bean
RestClientCustomizer serviceIdentityCustomizer(
        @Value("${spring.application.name}") String appName) {
    return builder -> builder
            .defaultHeader("User-Agent", appName)
            .requestInterceptor(new CorrelationIdPropagatingInterceptor());
}
```

The customiser contract is **additive**. It is the right place for cross-cutting
concerns — identity headers, correlation propagation, a shared interceptor. It is
the wrong place for anything a *specific* client needs, because it fires for all
of them, including clients calling third parties you do not want to send internal
headers to.

The equivalent bean for the reactive client is `WebClientCustomizer`.

## Interceptors and initializers on the builder

Two builder hooks look interchangeable and are not, and the difference is
whether the hook can see the *response*.

An interceptor sits in the
execution chain and can see and modify the request *and* the response, and can
short-circuit the call. An initializer only prepares the request before it is
executed. If all you need is "put this header on everything", the initializer is
the smaller tool and cannot accidentally swallow a response.

## Gotchas

**⚠️ A `RestClient` field initialised inline**
**Symptom:** one client in the codebase has no metrics and ignores the global
timeout, and nobody can see why.
**Cause:** `private final RestClient client = RestClient.create(...)` as a field
initialiser — it runs before, and independently of, any injection.
**Fix:** build it in the constructor from the injected builder. If the class is
not a bean, make it one; a client that cannot be configured centrally is a
liability.

**⚠️ Injecting `RestClient` instead of `RestClient.Builder`**
**Symptom:** `NoSuchBeanDefinitionException` for `RestClient`.
**Cause:** Boot auto-configures the *builder*, not a `RestClient` bean — exactly
as it auto-configures `RestTemplateBuilder` and not `RestTemplate`. There is no
single sensible base URL, so there is no sensible single client.
**Fix:** inject the builder and build one client per dependency you call. If you
want a `RestClient` bean, declare it yourself in `@Configuration` — one per
downstream service, named after that service.

**⚠️ Sharing one `RestClient` across two downstream services**
**Symptom:** metrics and timeouts cannot be tuned per dependency; a change made
for a slow partner API loosens the timeout on your own fast internal service.
**Cause:** one client with no `baseUrl`, given a full URL at each call site.
**Fix:** one client per downstream service, each with its own `baseUrl` and its
own timeouts. The `client.name` observation tag is derived from the request URI
host, so this also keeps your dashboards separable.

**⚠️ A `RestClientCustomizer` that adds an internal auth header**
**Symptom:** an internal service token turns up in an outbound request to a third
party, in their access logs.
**Cause:** the customiser is global by definition and fires for every client.
**Fix:** put per-destination concerns on the specific builder, or gate the
interceptor on the request host:

```java
@Bean
RestClientCustomizer internalAuth(TokenSource tokens) {
    return builder -> builder.requestInterceptor((request, body, execution) -> {
        if (request.getURI().getHost().endsWith(".internal")) {
            request.getHeaders().setBearerAuth(tokens.current());
        }
        return execution.execute(request, body);
    });
}
```

**⚠️ An interceptor that logs bodies and quietly buffers them**
**Symptom:** memory pressure and longer-held connections after "just adding some
logging".
**Cause:** reading a streamed body to log it requires buffering it.
**Fix:** log the template, status and duration; keep bodies behind a `DEBUG`
logger or sampling.

## Interview questions

**★ Why is the auto-configured `RestClient.Builder` a prototype bean rather than
a singleton?**
Because the builder is mutable and every consumer specialises it. As a singleton,
two services calling `baseUrl(...)` would mutate the same object and the winner
would depend on bean initialisation order — a bug invisible in a test with one
client and catastrophic in production with five. Prototype scope means each
injection point receives a fresh builder that already carries the shared,
Boot-applied configuration — timeouts, SSL bundles, customisers, observation
registry — and can then specialise it without affecting anyone else. It is the
same reasoning behind `RestTemplateBuilder` being auto-configured while
`RestTemplate` is not.

**★ A colleague writes `RestClient.create("https://api.example.com")` in a
`@Service`. It compiles, the test passes, and it ships. What is wrong with it?**
It works, which is why it survives review — and that is the problem. A statically
created client never passes through auto-configuration, so it inherits none of
the `spring.http.clients.*` timeouts, none of the `RestClientCustomizer` beans,
no SSL bundle, and no `ObservationRegistry`. In practice that means whatever
timeout the underlying library defaults to — frequently none — and no
`http.client.requests` metric, so when that dependency degrades you have neither
protection nor visibility. The fix is to inject `RestClient.Builder` and call
`build()`. It is worth an ArchUnit test, because the defect is not visible in the
diff.

**★ Where would you put a header that must be on every outbound request the
service makes, and where would you *not* put it?**
A `RestClientCustomizer` bean, because Boot applies every such bean to every
auto-configured builder, so it survives someone adding a sixth client next
quarter. What you would *not* do is add it in each service class's constructor,
because the seventh one will forget. The thing to be careful about is that
"every outbound request" genuinely means every one, including calls to third
parties — so an internal auth token does not belong in a global customiser
unless the interceptor checks the destination host first.

**★ Boot auto-configures `RestClient.Builder` but not `RestClient`. Why not just
give us the client?**
Because there is no single correct client. A `RestClient` carries a base URL,
default headers, a timeout profile and an error-handling policy, all of which are
properties of *the dependency you are calling*, not of your application. A single
auto-configured client would have to have none of them, which would push every
call site into passing absolute URLs and re-specifying timeouts — losing exactly
the per-dependency isolation you want. The builder is the largest unit that can
be sensibly shared.

**★ What is the difference between a `requestInterceptor` and a
`requestInitializer` on the builder?**
An interceptor participates in the execution chain: it sees the request, decides
whether and when to call the rest of the chain, and sees the response — so it can
retry, log timings, or short-circuit. An initializer only prepares the request
before execution and never sees the response. For "add this header to
everything", the initializer is the correct, smaller tool; reaching for an
interceptor there gives you the ability to accidentally swallow or corrupt a
response in code that was only ever meant to set a header.

**★ What would you check first if `RestClient.Builder` fails to inject after
upgrading a Boot 3 service to Boot 4?**
Whether `spring-boot-starter-restclient` is declared. Boot 4 split the HTTP
clients into their own starters, so a web application no longer transitively
receives a client just by being a web application — the identical code worked in
Boot 3 because the dependency arrived incidentally. While in the `pom.xml` I
would also check that `spring-boot-starter-web` has been renamed to
`spring-boot-starter-webmvc`, and that `spring-boot-starter-validation` is
declared explicitly, since Boot 4 stopped bringing validation in transitively
too.

---

← Prev: [Which client](01-the-client-you-should-reach-for.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The fluent API in anger](03-the-fluent-api.md)
