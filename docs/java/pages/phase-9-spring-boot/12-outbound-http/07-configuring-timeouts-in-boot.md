---
title: "Set them once, in properties, and never in a Java literal"
sidebar_label: "7 · Configuring timeouts"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Boot reference *Calling REST Services*
> — the global HTTP client configuration section
> (docs.spring.io/spring-boot/reference/io/rest-client.html) — and the Spring
> Boot 4.0 Configuration Changelog for the
> `spring.http.client.*` → `spring.http.clients.*` renames. Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**Every timeout in this topic should be a property, not a line of Java, for one
reason: a property can be changed during an incident and a `Duration.ofSeconds`
literal cannot. Boot 4 gives you a global default for every HTTP client in the
application, and a per-group override for each downstream service. The catch —
and it will cost you an afternoon if nobody tells you — is that the
property namespace was renamed in Boot 4, so every key you find in a pre-2026
article is wrong, and a wrong key is silently ignored rather than rejected.**

## The global defaults

```yaml
spring:
  http:
    clients:
      connect-timeout: 2s
      read-timeout: 1s
      redirects: dont-follow
      ssl:
        bundle: mybundle
```

These apply to every auto-configured HTTP client in the application — which is
precisely why [chunk 2](02-wiring-it-in-boot-4.md) insists you take the
auto-configured builder. A client built with `RestClient.create()` never sees any
of this.

## The Boot 3 → Boot 4 rename, which breaks every article

The namespace changed shape. Two confirmed examples from the configuration
changelog:

| Boot 3 | Boot 4 |
|---|---|
| `spring.http.client.factory` | `spring.http.clients.imperative.factory` |
| `spring.http.client.connect-timeout` | `spring.http.clients.connect-timeout` |

Note that the rename is not uniform: `factory` moved *down* into an `imperative`
sub-namespace while `connect-timeout` merely pluralised `client`. So you cannot
fix a Boot 3 configuration by search-and-replacing `client` to `clients` — some
keys need the extra level and some do not.

⚠️ **A wrong key is silently ignored.** Relaxed binding does not reject unknown
properties, so a mistyped timeout looks exactly like a timeout you never set:
the application starts, the call works in testing, and the bound you believe you
have does not exist. Two defences:

1. Add `spring-boot-properties-migrator` temporarily during the upgrade. It
   analyses the environment at startup, reports renamed keys, and maps them at
   runtime while you fix them. Remove it when you are done — it is a migration
   aid, not a dependency.
2. Verify the bound rather than the key. The Actuator `configprops` endpoint
   shows what actually bound, and a startup assertion that the value is non-null
   costs four lines.

## Per-service overrides, which is the shape you actually want

A single global timeout is a compromise between your fast internal service and
the partner API that takes 800 ms on a good day. Set it low and you break the
partner; set it high and the internal service gets no protection at all.

The group properties from [chunk 5](05-http-service-groups.md) are the fix:

```yaml
spring:
  http:
    clients:
      connect-timeout: 1s
      read-timeout: 1s
    serviceclient:
      partner:
        base-url: https://partner.example.com
        connect-timeout: 2s
        read-timeout: 5s
```

The global values are the default for everything; the group overrides them for
that dependency only. This is the operational property worth designing for:
**a change made for one dependency must not loosen any other**.

If a client is not registered as a service group, the equivalent is to configure
its builder directly — which is [chunk 8](08-pinning-the-factory-tls-proxy.md).

## There is no per-call timeout, and that is deliberate

A question that comes up immediately: can one `RestClient` call have a longer
timeout than the others on the same client? Not through the fluent chain — the
timeout belongs to the request factory, which belongs to the client, so there is
nothing on `get().uri(...)` to override it.

That is the right design, and the reason is worth internalising. A timeout is a
property of *the dependency and the operation class*, not of one call site. If
one endpoint on a service is genuinely slower than the rest — a report
generation, a bulk export — it is a different operation with a different
reliability profile, and it deserves its own client:

```java
@Configuration(proxyBeanMethods = false)
class ReportingClients {

    @Bean
    RestClient reportingFastClient(RestClient.Builder builder) {
        return builder.baseUrl("https://reports.internal").build();   // global 1s
    }

    @Bean
    RestClient reportingExportClient(RestClient.Builder builder,
            ClientHttpRequestFactoryBuilder<?> factories) {
        return builder.baseUrl("https://reports.internal")
                .requestFactory(factories.build(
                        HttpClientSettings.defaults().withReadTimeout(Duration.ofSeconds(30))))
                .build();
    }
}
```

Two beans, two names, two obvious timeouts — and the 30-second bound cannot leak
onto the calls that should answer in a second. The alternative people ask for,
a per-call override, has the property that the loosest value in the codebase
tends to spread.

## Redirects are a timeout question too

`spring.http.clients.redirects` accepts a strategy — `dont-follow` is the value
shown in the reference. It belongs in this chunk because a followed redirect is
*another request*, with another connect and another read, inside a call the
caller believes is bounded by one timeout. If you are trying to reason about a
worst case, following redirects silently multiplies it, and a redirect loop
against a misconfigured gateway is the pathological version.

For a downstream service you control, `dont-follow` is usually right: a redirect
is a contract change you would rather see as an error than absorb.

## Gotchas

**⚠️ A property that has no effect and no error**
**Symptom:** the timeout is unchanged after a configuration edit.
**Cause:** the key is from Boot 3, or misspelled. Relaxed binding ignores unknown
keys.
**Fix:** check it against the reference for your exact version, use
`spring-boot-properties-migrator` during an upgrade, and verify with the
Actuator `configprops` endpoint rather than by reading the YAML again.

**⚠️ Search-and-replacing `spring.http.client` to `spring.http.clients`**
**Symptom:** the timeouts start working and the factory selection silently stops.
**Cause:** `factory` moved to `spring.http.clients.imperative.factory`, not to
`spring.http.clients.factory`.
**Fix:** migrate key by key against the changelog. The rename is not uniform.

**⚠️ One global timeout for every dependency**
**Symptom:** either the partner API times out constantly, or the internal service
has a five-second bound it never needed.
**Cause:** a single `spring.http.clients.read-timeout` doing the work of two
policies.
**Fix:** global default plus per-group overrides under
`spring.http.serviceclient.<group>.*`.

**⚠️ Timeouts in Java literals**
**Symptom:** an incident where the only mitigation is a rebuild and a deploy.
**Cause:** `Duration.ofSeconds(30)` compiled into a `@Configuration` class.
**Fix:** bind them from properties, so they can move through the config-map or
the environment during an incident. Even a `@Value("${...}")` is better than a
literal.

**⚠️ Overriding `ClientHttpRequestFactoryBuilder` and losing the timeouts**
**Symptom:** `spring.http.clients.read-timeout` stops taking effect after a proxy
was added.
**Cause:** a hand-built factory bean was set on the client instead of a
*builder* bean, so Boot could not apply the settings to it.
**Fix:** publish a `ClientHttpRequestFactoryBuilder<?>` bean, as above. Boot
applies the configured `HttpClientSettings` to the builder you supply; it cannot
apply them to a finished `ClientHttpRequestFactory` you constructed yourself.

## Interview questions

**★ Where should HTTP timeouts live, and why not in code?**
In configuration properties, because during an incident a property can be changed
through the environment or a config map and a compiled literal cannot. It also
means the value is visible to whoever is on call without reading Java, and it can
differ per environment — a two-second bound that is right in production may be
wrong against a slow test double. The one thing to be careful about is that a
mistyped property is silently ignored, so "it is in the YAML" is not evidence it
took effect; verify with the Actuator `configprops` endpoint or a startup
assertion.

**★ What changed about HTTP client properties in Boot 4, and how do you migrate
safely?**
The namespace moved from `spring.http.client.*` to `spring.http.clients.*`, but
not uniformly: `spring.http.client.connect-timeout` became
`spring.http.clients.connect-timeout`, while `spring.http.client.factory` became
`spring.http.clients.imperative.factory` — an extra level, because the reactive
connector needed a parallel namespace. So a blanket search-and-replace fixes the
timeouts and silently breaks the factory selection. The safe migration is to add
`spring-boot-properties-migrator` temporarily, let it report the renames at
startup, fix them against the changelog, and then remove the module.

**★ You need a five-second read timeout for one slow partner and one second for
everything else. How?**
Set `spring.http.clients.read-timeout: 1s` as the application-wide default, then
register the partner's interfaces in a service group and override
`spring.http.serviceclient.partner.read-timeout: 5s`. The property design is
deliberately layered so that raising a bound for one dependency cannot loosen it
for any other — which is the failure mode of the alternative, where somebody
raises the single global timeout during an incident and every other client
inherits the looser bound permanently.

**★ Can you give one call a longer timeout than the others on the same
`RestClient`?**
Not through the fluent chain, because the timeout lives on the request factory
and the factory belongs to the client. The intended answer is a second client
bean: if one endpoint is a bulk export that legitimately takes thirty seconds,
that is a different operation class with a different reliability profile, and
giving it its own named `RestClient` makes the two bounds visible side by side in
configuration. It also has a property a per-call override would not: the loose
timeout cannot spread. In my experience per-call overrides drift towards the
largest value anyone ever needed, because raising the number at the call site is
the fastest way to make a flaky test pass.

**★ Why does following redirects matter when you are reasoning about timeouts?**
Because each redirect is a further request — another connection acquisition,
another connect timeout, another read timeout — inside what the caller believes
is one bounded call. A three-hop redirect chain triples the worst case that your
configured numbers imply, and a redirect loop against a misconfigured gateway is
bounded only by whatever hop limit the library happens to have. For a service you
control, `spring.http.clients.redirects: dont-follow` is usually the better
default: a redirect where you did not expect one is a contract change, and
surfacing it as an error is more useful than silently absorbing it.

---

← Prev: [What a timeout covers](06-what-a-timeout-covers.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Pinning the factory, TLS and the proxy](08-pinning-the-factory-tls-proxy.md)
