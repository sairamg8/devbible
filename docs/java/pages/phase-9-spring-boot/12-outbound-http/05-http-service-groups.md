---
title: "Groups turn a family of clients into configuration"
sidebar_label: "5 · HTTP service groups"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework reference *REST Clients →
> HTTP Service Clients*, in particular the *HTTP Service Group* and
> `AbstractHttpServiceRegistrar` sections
> (docs.spring.io/spring-framework/reference/integration/rest-clients.html), and
> the Spring Boot reference *Calling REST Services → HTTP Service Clients* for
> the `spring.http.serviceclient.*` properties
> (docs.spring.io/spring-boot/reference/io/rest-client.html). Spring Boot 4.1.0,
> Spring Framework 7.0.x, JDK 25.

**Declaring an interface is the easy half. The half that decides whether the
client survives contact with four environments is *registration*: how the proxy
becomes a bean, where its base URL comes from, and whose timeouts it inherits.
Framework 7's answer is groups — `@ImportHttpServices` names a family of
interfaces, and Boot then exposes that family's base URL and timeouts as ordinary
properties under `spring.http.serviceclient.<group>.*`, overriding the
application-wide defaults. The result is a client with no URL in the Java, and a
per-dependency timeout you can change without a rebuild.**

## `@ImportHttpServices` — the Framework 7 registration

Hand-building factories in `@Configuration` gets old at the third client.
Framework 7 added declarative registration:

```java
@Configuration
@ImportHttpServices(group = "echo", types = {EchoServiceA.class, EchoServiceB.class})
@ImportHttpServices(group = "greeting", basePackageClasses = GreetServiceA.class)
public class ClientConfig { }
```

Boot's variant scans packages, so the common case is one annotation on the
application class:

```java
@SpringBootApplication
@ImportHttpServices(group = "echo", basePackages = "com.example.myclients")
public class MyApplication { }
```

Each interface in the group becomes an injectable bean. Where two groups declare
the same interface type, inject `HttpServiceProxyRegistry` and ask for the one
you want:

```java
public EchoController(HttpServiceProxyRegistry registry) {
    this.primary = registry.getClient("echo1", EchoService.class);
    this.secondary = registry.getClient("echo2", EchoService.class);
}
```

For registration that has to be computed rather than annotated — a client per
tenant read from configuration, say — extend `AbstractHttpServiceRegistrar`:

```java
public class MyHttpServiceRegistrar extends AbstractHttpServiceRegistrar {

    @Override
    protected void registerHttpServices(GroupRegistry registry, AnnotationMetadata metadata) {
        registry.forGroup("echo").register(EchoServiceA.class, EchoServiceB.class);
        registry.forGroup("greeting").detectInBasePackages(GreetServiceA.class);
    }
}
```

## Groups are the point: configuration without a URL in the code

Once an interface belongs to a group, its base URL and timeouts move out of the
Java and into properties — which is what you wanted all along, because the URL of
a downstream service differs per environment and a `@Value` on every client is
the thing you were trying to delete.

```java
public interface EchoService {
    @PostExchange
    Map<?, ?> echo(@RequestBody Map<String, String> message);
}
```

```yaml
spring:
  http:
    clients:
      connect-timeout: 1s
    serviceclient:
      echo:
        base-url: https://echo.zuplo.io
        connect-timeout: 2s
        read-timeout: 2s
```

Read the precedence there carefully, because it is the whole design:
`spring.http.clients.connect-timeout` is the application-wide default and
`spring.http.serviceclient.echo.connect-timeout` overrides it **for that group
only**. A slow partner API gets a longer timeout without loosening anything for
your fast internal services — the per-dependency isolation
[chunk 7](07-configuring-timeouts-in-boot.md) argues for, expressed in
configuration rather than in code.

For anything properties cannot express, a group configurer reaches the underlying
builder:

```java
@Bean
RestClientHttpServiceGroupConfigurer echoGroupConfigurer() {
    return groups -> groups
            .filterByName("echo")
            .forEachClient((group, clientBuilder) ->
                    clientBuilder.defaultHeader("X-Service-Group", group.name()));
}
```

`WebClientHttpServiceGroupConfigurer` is the reactive counterpart.

## ⚠️ These property names moved during the 4.0 cycle

The keys above — `spring.http.clients.*` for the application-wide defaults and
`spring.http.serviceclient.<group>.*` for a group — are the ones documented in
the Spring Boot reference for the 4.1 line. Earlier material from the 4.0
milestone period used a different shape for the same settings (a
`spring.http.client.service.*` namespace, with `…service.group.<name>.base-url`
for the per-group URL). If a sample does not take effect, the first thing to
suspect is that it was written against the older spelling. Boot's
`spring-boot-properties-migrator` module exists exactly for this: add it
temporarily, and it reports renamed keys at startup and maps them for you while
you fix them.

**Do not guess a key.** A misspelled configuration property is silently ignored
by relaxed binding — you get no error, and the timeout you thought you set is
simply the default. Check it against the reference for your exact version, and
prefer the IDE's completion from the configuration metadata over typing it.

## What sits on top of groups

Two things build on the group abstraction and are worth knowing exist, because
they change what you have to write yourself:

- **Spring Cloud 2025.1** adds transparent support for **load balancing and
  circuit breaking for HTTP service groups** — so a group can resolve a logical
  service name through discovery and be wrapped in a circuit breaker without the
  interface changing.
- **Spring Security 7.0** adds OAuth2 support for HTTP service groups, detecting
  a **`@ClientRegistrationId`** annotation on `@HttpExchange` methods to decide
  which client registration's token to attach.

⚠️ **Both are stated here from the Spring team's announcement of the feature
set, not from a configuration reference I have read end to end**, so treat the
capability as real and the exact configuration surface as something to look up in
the Spring Cloud and Spring Security references for your release train. The
architectural point stands either way: because the group is the unit of
configuration, cross-cutting concerns can attach to a group rather than to every
interface in it. Authorisation on the way *out* is
[Topic 11 — Spring Security](../11-spring-security/README.md)'s subject; here it
is enough to know that the token acquisition does not have to be your code.

## Error handling for a proxied interface

The interface has no obvious place to hang an `onStatus` handler, so the handler
goes on the client that backs it — which is the right place anyway, because the
policy is per dependency, not per method:

```java
RestClient restClient = RestClient.builder()
        .defaultStatusHandler(HttpStatusCode::isError, (request, response) -> {
            throw new UpstreamFailure(response.getStatusCode(), request.getURI());
        })
        .build();
```

The consequence is a real constraint: **an HTTP interface cannot easily express
"404 means absent on this method but is an error on that one"**, because the
policy is client-wide. There are two honest answers. Declare the method's return
as `ResponseEntity<T>` and branch on the status in the caller; or accept that
this method wants the fluent API and write that one call by hand. Mixing the two
styles in a codebase is fine — they share the same `RestClient` underneath.

## Gotchas

**⚠️ Hard-coding the URL in `@HttpExchange(url = "https://...")`**
**Symptom:** the client cannot be pointed at a staging instance without a
rebuild.
**Cause:** the absolute URL lives in the annotation, which is a compile-time
constant.
**Fix:** put the interface in a group and set `spring.http.serviceclient.<group>.base-url`.
Keep only the *path* in the annotation.

**⚠️ Expecting one interface to be one bean when it is in two groups**
**Symptom:** an ambiguous-bean failure, or the wrong endpoint being called.
**Cause:** the same interface type registered under two group names.
**Fix:** inject `HttpServiceProxyRegistry` and resolve by group name, or split the
interface so each group has its own type.

**⚠️ Assuming the interface is where timeouts go**
**Symptom:** someone searches the interface for a timeout attribute, finds none,
and concludes HTTP interfaces "do not support timeouts".
**Cause:** the interface is a declaration; the exchange is executed by the
adapter's client.
**Fix:** configure the group (`spring.http.serviceclient.<group>.read-timeout`)
or the underlying `RestClient`. The full argument is in
[chunk 6](06-what-a-timeout-covers.md).

**⚠️ A group name that differs by one character from the property key**
**Symptom:** the base URL is never applied and requests go to a relative path
that resolves against nothing.
**Cause:** `@ImportHttpServices(group = "echo")` with
`spring.http.serviceclient.echoservice.base-url` in the YAML.
**Fix:** the group name in the annotation and the key segment must match exactly.
Because unknown properties bind silently, a startup assertion is worth the four
lines — fail fast if the client has no base URL rather than discovering it on the
first request.

**⚠️ Setting a group timeout and expecting it to apply to a hand-built client**
**Symptom:** `spring.http.serviceclient.echo.read-timeout` has no effect on a
`RestClient` you constructed in `@Configuration`.
**Cause:** group properties configure the clients Boot builds *for that group*.
A client you built yourself is not in the group.
**Fix:** either register the interface through `@ImportHttpServices` and let Boot
build the client, or configure your hand-built client explicitly — see
[chunk 7](07-configuring-timeouts-in-boot.md).

## Interview questions

**★ What do groups buy you in `@ImportHttpServices`?**
They turn a family of interfaces into a configurable unit. Once `EchoService` is
in group `echo`, its base URL and timeouts come from
`spring.http.serviceclient.echo.*` rather than from a `@Value` or an annotation
constant, so the URL differs per environment without touching Java. Group
properties also *override* the application-wide `spring.http.clients.*` defaults,
which gives you the thing you actually want operationally: a longer read timeout
for the slow partner API without loosening it for anything else. And a
`RestClientHttpServiceGroupConfigurer` reaches the underlying builder for
anything properties cannot express.

**★ An HTTP interface method must treat 404 as "not found, return empty", but
other methods on the same interface must treat 404 as an error. How do you handle
it?**
You cannot express that on the interface, because the status policy lives on the
backing client and is therefore client-wide. Two honest options. Declare that
method's return type as `ResponseEntity<T>`, keep the client's handler from
throwing on 4xx, and branch on the status in the caller. Or accept that this
particular call wants per-call control and write it with the fluent API and an
`onStatus` handler, reusing the same underlying `RestClient`. I would not
contort the interface to avoid the second option — mixed styles over one client
are fine, and the alternative is a status handler with a special case keyed on
the URI, which is worse.

**★ How do you register a client per tenant, where the tenant list comes from
configuration?**
`@ImportHttpServices` is an annotation, so it cannot loop. The mechanism for
computed registration is `AbstractHttpServiceRegistrar`: override
`registerHttpServices(GroupRegistry, AnnotationMetadata)` and call
`registry.forGroup(name).register(...)` once per tenant, then `@Import` the
registrar. At injection time you resolve by group name through
`HttpServiceProxyRegistry` rather than by type, because every tenant shares the
interface type.

**★ Why is the group, rather than the interface, the unit of configuration?**
Because the things you need to configure are properties of the *dependency*, not
of any one call: the base URL, the connect and read timeouts, the TLS bundle, the
auth token, the circuit breaker. Those are shared by every interface that talks
to the same downstream service and differ between downstream services. Making the
group the unit means a family of interfaces gets one coherent configuration, and
that a change like "give the partner API a longer read timeout" is one property
line rather than an edit in every client. It is also what lets Spring Cloud and
Spring Security attach load balancing, circuit breaking and OAuth registration at
group level without touching the interfaces.

**★ A property you set under `spring.http.serviceclient.*` has no effect. How do
you debug it?**
Start from the fact that relaxed binding ignores unknown keys silently, so "no
effect" and "wrong key" look identical. Check three things in order: that the
group name in the property matches the `group` attribute exactly; that the key
itself is the one in the reference for your Boot version, since this namespace
changed shape during the 4.0 milestone cycle; and that the client you are
observing is actually the one Boot built for the group rather than a
`RestClient` someone constructed by hand in a `@Configuration` class. The
`spring-boot-properties-migrator` module will report a renamed key at startup,
and the Actuator `configprops` endpoint will show what actually bound.

---

← Prev: [HTTP interfaces](04-http-interfaces.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [What a timeout covers](06-what-a-timeout-covers.md)
