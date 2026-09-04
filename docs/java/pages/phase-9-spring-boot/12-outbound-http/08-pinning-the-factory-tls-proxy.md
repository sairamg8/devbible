---
title: "Pin the transport, scope the trust store, and stop guessing"
sidebar_label: "8 · Factory, TLS and proxy"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Boot reference *Calling REST Services*
> — HTTP client detection, the `ClientHttpRequestFactoryBuilder` and
> `ClientHttpConnectorBuilder` sections, RestClient SSL support and
> `InetAddressFilter`
> (docs.spring.io/spring-boot/reference/io/rest-client.html) — the Spring Boot
> how-to *HTTP Clients* (docs.spring.io/spring-boot/how-to/http-clients.html),
> and the Spring Boot 4.1.1 API for `org.springframework.boot.http.client`. Spring
> Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Which HTTP library executes your outbound calls is, by default, a function of
your classpath — which means it can change when someone adds an unrelated
dependency, and can differ between your CI image and production. That is an
absurd thing to leave to chance for the component whose failure modes you spent
two chunks reasoning about. Pin it. While you are in there, do the other two
transport decisions properly as well: scope TLS material to the one client that
needs it instead of poisoning the JVM's global trust store, and route through
your egress proxy in one place rather than in each service class.**

## Two properties pick the implementation

`spring.http.clients.*` carries the timeouts [chunk 7](07-configuring-timeouts-in-boot.md)
configured; two further keys under it choose *which library applies them*:

```yaml
spring:
  http:
    clients:
      imperative:
        factory: jetty        # RestClient / RestTemplate
      reactive:
        connector: jetty      # WebClient
```

🔴 **Pin the factory.** [Chunk 6](06-what-a-timeout-covers.md) argued why: with
detection, a transitive dependency can move your entire outbound traffic onto a
different HTTP library, with a different pool and different timeout semantics,
and the change is invisible in your diff. One property removes that.

## Reaching the factory directly

Where properties cannot express it, build `HttpClientSettings`, hand them to a
`ClientHttpRequestFactoryBuilder`, and set the resulting factory on the client
builder:

```java
HttpClientSettings settings = HttpClientSettings
        .ofSslBundle(sslBundles.getBundle("partner-mtls"))
        .withReadTimeout(Duration.ofSeconds(2));

ClientHttpRequestFactory factory =
        ClientHttpRequestFactoryBuilder.detect().build(settings);

RestClient client = builder
        .baseUrl("https://partner.example.com")
        .requestFactory(factory)
        .build();
```

⚠️ **`HttpClientSettings` is the Boot 4 type.** Boot 3 called the equivalent
`ClientHttpRequestFactorySettings`, and that class does not appear in the Boot
4.1 `org.springframework.boot.http.client` package listing. A sample naming the
old type is a Boot 3 sample, and its property names will be wrong too.

`ClientHttpRequestFactoryBuilder` has named variants — `jdk()`, `httpComponents()`,
`jetty()`, `reactor()`, `simple()` — alongside `detect()`. Use a named one when
you mean it; `detect()` re-introduces the classpath dependence you were trying to
remove.

To customise the underlying library's own builder — a proxy selector, a pool
size, a socket option — override the `ClientHttpRequestFactoryBuilder` bean and
Boot will use yours everywhere:

```java
@Configuration(proxyBeanMethods = false)
public class HttpClientConfiguration {

    @Bean
    ClientHttpRequestFactoryBuilder<?> clientHttpRequestFactoryBuilder(
            ProxySelector proxySelector) {
        return ClientHttpRequestFactoryBuilder.jdk()
                .withHttpClientCustomizer(b -> b.proxy(proxySelector));
    }
}
```

The reactive equivalent is a `ClientHttpConnectorBuilder<?>` bean.

## SSL bundles rather than a hand-rolled trust store

Boot's SSL bundle abstraction is wired into the clients directly. Inject
`RestClientSsl` and apply a named bundle:

```java
@Service
public class PartnerClient {

    private final RestClient restClient;

    PartnerClient(RestClient.Builder builder, RestClientSsl ssl) {
        this.restClient = builder
                .baseUrl("https://partner.example.com")
                .apply(ssl.fromBundle("partner-mtls"))
                .build();
    }
}
```

The bundle is ordinary configuration under `spring.ssl.bundle.*`, subject to the
precedence rules in
[Topic 06 — Configuration and profiles](../06-configuration-and-profiles/README.md).
`WebClientSsl` is the reactive counterpart, and a global default bundle can be
set with `spring.http.clients.ssl.bundle`.

The reason this matters is the alternative. Setting `javax.net.ssl.keyStore` and
`javax.net.ssl.trustStore` as system properties changes TLS for the entire JVM —
your database driver, your metrics exporter, your identity provider client — to
solve a problem with one downstream service. A bundle is scoped to the client you
apply it to.

## Filtering where your client is allowed to connect

Boot exposes an `InetAddressFilter` on `HttpClientSettings`, which decides which
resolved addresses a client may connect to:

```java
InetAddressFilter onlyExternal = InetAddressFilter.externalAddresses();

HttpClientSettings settings = HttpClientSettings.defaults()
        .withInetAddressFilter(onlyExternal);

ClientHttpRequestFactory factory =
        ClientHttpRequestFactoryBuilder.jdk().build(settings);
```

It can also be declared as a bean to apply globally, and composed by CIDR:

```java
@Bean
InetAddressFilter httpClientInetAddressFilter() {
    return InetAddressFilter.of("192.168.1.0/24").andNot("192.168.1.1", "192.168.1.10");
}
```

The failure it addresses is **server-side request forgery**: a request parameter
that becomes part of an outbound URL, pointed by an attacker at `127.0.0.1`, at
your metadata service, or at an internal admin endpoint that trusts anything
originating inside the network. Filtering by resolved address is the right layer
for this, because a hostname allow-list is defeated by DNS that resolves to a
private address — the check has to happen after resolution. A host was rejected
by the filter surfaces as `FilteredHostException`.

⚠️ **Filtering is not authorisation.** It stops a client reaching an address; it
says nothing about whether the *content* of an outbound URL should have come from
user input in the first place. Validate the input as well.

## The proxy, in one place

To customise the underlying library's own builder — a proxy selector, a socket
option, a pool size — override the `ClientHttpRequestFactoryBuilder` bean, and
Boot will use yours for every auto-configured client:

```java
@Configuration(proxyBeanMethods = false)
public class HttpClientConfiguration {

    @Bean
    ClientHttpRequestFactoryBuilder<?> clientHttpRequestFactoryBuilder(
            ProxySelector proxySelector) {
        return ClientHttpRequestFactoryBuilder.jdk()
                .withHttpClientCustomizer(b -> b.proxy(proxySelector));
    }
}
```

The reactive equivalent is a `ClientHttpConnectorBuilder<?>` bean. A
`ProxySelector` rather than a fixed proxy is the right shape because egress rules
are usually per destination: internal hosts direct, everything else via the
proxy.

## Gotchas

**⚠️ Using `detect()` after arguing for pinning**
**Symptom:** the factory is still classpath-dependent despite an explicit
`ClientHttpRequestFactoryBuilder` bean.
**Cause:** the bean was built with `ClientHttpRequestFactoryBuilder.detect()`.
**Fix:** name the one you want — `.jdk()`, `.httpComponents()`, `.jetty()`,
`.reactor()`.

**⚠️ Setting `javax.net.ssl.trustStore` to talk to one partner**
**Symptom:** an unrelated component — the database driver, an OTLP exporter —
starts failing TLS after a change made for the partner integration.
**Cause:** the system properties are JVM-global.
**Fix:** an SSL bundle applied to that one client.

**⚠️ An allow-list of hostnames used as SSRF protection**
**Symptom:** a penetration test reaches an internal service through a URL your
validation approved.
**Cause:** the check ran on the hostname; DNS resolved it to a private address.
**Fix:** filter on the *resolved address* with `InetAddressFilter`, which runs
after resolution, and keep the input validation as well.

## Interview questions

**★ Why pin the request factory rather than let Boot detect it?**
Because detection is a function of the classpath and the classpath changes for
unrelated reasons. Boot's order prefers Apache, then Jetty, then Reactor Netty,
then the JDK client, then the simple fallback — so a library that brings Apache
HttpComponents in transitively moves every outbound call onto a different
transport with a different pool and different timeout semantics, with no change
in your own code. It can also differ between environments if the dependency
graphs differ. Pinning it costs one property and converts a whole class of
mysterious behaviour changes into a dependency change you can see.

**★ What is `HttpClientSettings` and when do you need it?**
It is the Boot 4 value type describing settings applied when creating an
imperative or reactive HTTP client — timeouts, SSL bundle, redirect handling and
so on. You need it when properties cannot express what you want: for instance
combining a specific SSL bundle with a specific read timeout on one client while
leaving every other client alone. You build the settings, pass them to a
`ClientHttpRequestFactoryBuilder`, and set the resulting factory on the client
builder. It replaces Boot 3's `ClientHttpRequestFactorySettings`, which is a
useful tell: a sample naming the old type predates Boot 4 and its property names
will be wrong too.

**★ How would you configure mutual TLS to one partner without affecting anything
else in the JVM?**
Define an SSL bundle under `spring.ssl.bundle.*`, inject `RestClientSsl`, and
apply it to that client with `.apply(ssl.fromBundle("partner-mtls"))`. Everything
else keeps the default trust store because you did not touch it. The alternative
people reach for — setting `javax.net.ssl.keyStore` and `trustStore` system
properties — changes TLS for the entire JVM, including the database driver and
any telemetry exporter, which is how a partner integration ends up breaking
metrics shipping.

**★ How do you set a proxy for outbound calls?**
Override the `ClientHttpRequestFactoryBuilder` bean with a named variant and a
customiser on the underlying library's builder — for the JDK client,
`ClientHttpRequestFactoryBuilder.jdk().withHttpClientCustomizer(b -> b.proxy(proxySelector))`.
Boot then uses your builder for every auto-configured client, so the proxy is
applied once rather than per client. The reactive equivalent is a
`ClientHttpConnectorBuilder<?>` bean. Doing it this way rather than through the
`http.proxyHost` system properties keeps the setting scoped to the HTTP clients
Spring builds, and keeps it visible to anyone reading the configuration classes.

**★ What is `InetAddressFilter` for, and why is filtering by address rather than
by hostname the right call?**
It restricts which resolved addresses an HTTP client is permitted to connect to,
and its purpose is server-side request forgery: the class of bug where a URL
derived from user input is fetched by your service, from inside your network,
with whatever network trust that position carries — a cloud metadata endpoint, a
`127.0.0.1` admin port, an internal service that authenticates by network
location. Filtering on the hostname does not work, because an attacker controls
DNS for a domain they own and can point it at a private address; the decision has
to be made after resolution, which is exactly where the filter sits. It is a
network control, not a substitute for validating that the input should have been
a URL at all.

---

← Prev: [Configuring timeouts](07-configuring-timeouts-in-boot.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The pool is the real limit](09-the-pool-is-the-real-limit.md)
