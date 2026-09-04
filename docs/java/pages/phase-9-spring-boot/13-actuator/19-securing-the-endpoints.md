---
title: "Securing the endpoints: the chain that backs off"
sidebar_label: "19 · Securing the endpoints"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Boot 4.1.1 reference — *Actuator ·
> Endpoints · Security* (docs.spring.io/spring-boot/reference/actuator/endpoints.html:
> *"If Spring Security is on the classpath and no other `SecurityFilterChain`
> bean is present, all actuators other than `/health` are secured by Spring Boot
> auto-configuration"*; *"For security purposes, only the `/health` endpoint is
> exposed over HTTP by default"*; the `EndpointRequest.toAnyEndpoint()` matcher
> example with `hasRole`; and the note that *"`EndpointRequest.to("endpoint")`
> will consider the endpoint root and all its subpaths, effectively matching
> `/actuator/endpoint/**`"*; and *Actuator · Endpoints · CORS Support* — *"CORS
> support is disabled by default and is only enabled once you have set the
> `management.endpoints.web.cors.allowed-origins` property"*). Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**Boot secures your actuator endpoints for you, and it stops the moment you
define a `SecurityFilterChain` bean — which every application with a login or an
API eventually does. That is the hole, and it is a nasty one because the
protection was never configured: it was inherited, it disappears silently in a
commit about something else entirely, and no test fails. Anything that depends on
you *not* having written some configuration is a control you will lose without
noticing.**

## The auto-configuration that backs off

The reference is precise: *"If Spring Security is on the classpath and no other
`SecurityFilterChain` bean is present, all actuators other than `/health` are
secured by Spring Boot auto-configuration."*

Read the middle clause again. **The protection is conditional on you not having
defined a chain.** So the sequence that produces a real incident looks like this,
and every step in it is normal:

1. Actuator and Spring Security are both on the classpath. Actuators are secured.
   Someone verifies this, and they are right.
2. Six months later a `SecurityFilterChain` bean is added — for JWT, for a login
   form, for CORS, for anything at all.
3. The auto-configured chain backs off, exactly as
   [auto-configuration](../05-auto-configuration/04-bean-conditions-and-back-off.md)
   is designed to.
4. The new chain says nothing about actuator paths, so they fall through to
   whatever its rules imply — and in a chain written for an API, with
   `permitAll()` on a prefix, that can be open.

Nothing failed. No test broke. The change was about authentication and the review
was about authentication. **From the commit that adds a chain onward, actuator
security is yours**, and the way to make that survivable is to put it in a chain
of its own rather than as a rule inside the application's.

## `EndpointRequest`, and a chain of its own

```java
@Bean
@Order(1)
SecurityFilterChain actuatorSecurity(HttpSecurity http) throws Exception {
    http.securityMatcher(EndpointRequest.toAnyEndpoint())
        .authorizeHttpRequests(requests -> requests
                .requestMatchers(EndpointRequest.to(HealthEndpoint.class)).permitAll()
                .anyRequest().hasRole("ENDPOINT_ADMIN"))
        .httpBasic(Customizer.withDefaults())
        .csrf(csrf -> csrf.disable());
    return http.build();
}
```

Four decisions in that block are worth naming, because each of them is a mistake
people make.

**`securityMatcher(EndpointRequest.toAnyEndpoint())` scopes the whole chain**, so
it applies to actuator requests and nothing else. That is the
[multiple-chain pattern](../11-spring-security/06-matchers-and-multiple-chains.md),
and it is what stops the application's own chain from having to know that
actuator exists. It also means `EndpointRequest` resolves the real paths from
your configuration rather than hard-coding `/actuator/**`, so moving the base
path or the port later requires no change to either chain.

**`@Order(1)`** puts it ahead of the application's chain. Without an explicit
order the chains are consulted in an order you did not choose and the first
matching one wins — see
[configuring the chain](../11-spring-security/05-configuring-the-chain.md).

**`EndpointRequest.to(HealthEndpoint.class)` permits health, and only health.**
The reference notes that this form *"will consider the endpoint root and all its
subpaths, effectively matching `/actuator/endpoint/**`"* — so it covers `/health`
and `/health/readiness` together, which is what a probe needs and is worth
knowing when you are trying to permit one health group and not another.

**CSRF is disabled *in this chain only*.** Actuator's write operations —
`POST /actuator/loggers/...`, `DELETE /actuator/caches/...` — are state-changing
requests and meet CSRF protection like anything else
([chunk 02](02-exposure-access-and-ports.md)). Disabling it here is defensible
because these calls come from tooling presenting credentials rather than from a
browser carrying a session cookie. Disabling it globally so that one call works
is a regression in your application, and the scoped chain is exactly what makes
the narrow fix available. The reasoning is in
[CSRF decisions](../11-spring-security/13-csrf-decisions.md).

`EndpointRequest.toAnyEndpoint().excluding(HealthEndpoint.class)` is the
alternative shape, scoping the chain to everything *except* health and leaving
health to the application's chain. Both work; the difference is which chain owns
the health rules, and owning them here is usually simpler to reason about.

The broader model — chains, matchers, `hasRole` versus `hasAuthority`, and how
the filters actually run — is [topic 11](../11-spring-security/README.md).

## CORS, which is off until you name an origin

Actuator has its own CORS configuration, separate from your application's:

```yaml
management:
  endpoints:
    web:
      cors:
        allowed-origins: "https://ops.example.com"
        allowed-methods: "GET,POST"
```

The reference is unambiguous about the default: *"CORS support is disabled by
default and is only enabled once you have set the
`management.endpoints.web.cors.allowed-origins` property."* So a browser-based
dashboard calling actuator from another origin fails until you say which origin,
and the failure is a browser CORS error rather than anything the server logs as
a problem — which is why this is usually diagnosed as an authentication issue
first.

Two things are worth being deliberate about here. `allowed-methods` defaults to
`GET` only, so the write operations — `POST /actuator/loggers/...` — need it
listed explicitly, and needing to list it is a good moment to ask whether a
browser should be issuing them at all. And the setting is genuinely separate from
your application's CORS configuration, which means an origin permitted for your
API is not thereby permitted for your management endpoints. That separation is
the right default: the two have different audiences, and
[CORS for an SPA](../11-spring-security/12-cors-for-an-spa.md) is a different
problem from CORS for an operations console.

## Gotchas

**Symptom:** actuator endpoints were protected, then became open after a release that only touched authentication
**Cause:** Boot secures actuators only while no other `SecurityFilterChain` bean exists; defining one makes the auto-configured protection back off
**Fix:** add a dedicated, ordered actuator chain in the same commit as any new chain — and treat "we added a `SecurityFilterChain`" as a permanent trigger for reviewing actuator, because nothing else will remind you

**Symptom:** the actuator chain is defined but the application's rules match first
**Cause:** no explicit order, so chain precedence is not what you assumed and the first matching chain wins
**Fix:** `@Order(1)` on the actuator chain, with a `securityMatcher` narrow enough that it cannot swallow application requests

**Symptom:** the security rules stop applying after `management.endpoints.web.base-path` is changed
**Cause:** the chain matched a hard-coded `/actuator/**` pattern instead of using `EndpointRequest`
**Fix:** use `EndpointRequest.toAnyEndpoint()`, which resolves the configured paths. This coupling is precisely what it exists to remove

**Symptom:** the Kubernetes readiness probe starts failing with 401 after the actuator chain is added
**Cause:** the probe presents no credentials, and `health` was not permitted — or was permitted by a literal path that does not cover `/health/readiness`
**Fix:** `EndpointRequest.to(HealthEndpoint.class)` with `permitAll()`, which covers the endpoint root and its subpaths, so the group probes are included

**Symptom:** `POST /actuator/loggers/...` returns 403 with correct credentials
**Cause:** CSRF protection rather than authentication — it is a state-changing request
**Fix:** disable CSRF **within the actuator chain only**, as shown above. A global disable to make one call work trades a real protection for a convenience

**Symptom:** the actuator chain works locally and everything 401s once the management port is in use
**Cause:** the management server is a separate server and does not inherit the application server's configuration, which includes anything you set up around authentication at the container level
**Fix:** configure the management server explicitly — [chunk 02](02-exposure-access-and-ports.md) lists what does not carry over. `EndpointRequest` still matches correctly; it is the surrounding server configuration that is missing

**Symptom:** an operations dashboard on another origin cannot call actuator, and the server logs show nothing wrong
**Cause:** actuator CORS is disabled until `management.endpoints.web.cors.allowed-origins` is set, and a CORS refusal happens in the browser rather than on the server
**Fix:** name the origin, and the methods if you need more than `GET`:
```properties
management.endpoints.web.cors.allowed-origins=https://ops.example.com
management.endpoints.web.cors.allowed-methods=GET,POST
```

## Interview questions

**★ Spring Security is on the classpath. Are your actuator endpoints secured?**
Only until you define a `SecurityFilterChain` bean. The reference is explicit that
the auto-configuration secures all actuators other than `/health` *if no other
chain is present*, so the protection is conditional and it vanishes the moment
anyone adds a chain for JWT, a login form or CORS. That is the most dangerous
shape a control can have: never configured, only inherited, and removed by a
commit about something else that is reviewed by someone thinking about something
else.

**★ How should an actuator security rule be written, and why that way?**
As its own `SecurityFilterChain`, ordered ahead of the application's and scoped
with `securityMatcher(EndpointRequest.toAnyEndpoint())`. Two reasons. The
application's chain then does not need to know actuator exists, so neither chain
changes when the base path or the port moves. And `EndpointRequest` resolves the
configured paths rather than hard-coding `/actuator/**`, which is the coupling
that silently breaks the day someone sets
`management.endpoints.web.base-path`.

**★ Your readiness probe starts returning 401 after you secure actuator. What happened?**
The probe presents no credentials and `health` was not permitted — or it was
permitted by a literal path that does not cover the group sub-paths, so
`/health/readiness` fell through to the authenticated rule.
`EndpointRequest.to(HealthEndpoint.class)` is the fix, because the reference
states it matches the endpoint root and all its subpaths. It is a good example of
why the typed matcher beats a string: the string is right until the URL space
grows.

**★ Why disable CSRF in the actuator chain rather than globally?**
Because the actuator write operations are made by tooling presenting credentials,
not by a browser carrying a session cookie, so the attack CSRF defends against
does not apply to them — while your application's own state-changing endpoints
are an entirely different matter. Disabling CSRF globally so that one `POST` to
`/actuator/loggers` succeeds trades a real protection for a convenience. Having a
separately scoped chain is what makes the narrow, correct fix available at all.

**★ Would you permit `/health` anonymously, and does that contradict the rest of this topic?**
Usually yes, and no. A load balancer or kubelet cannot present credentials, so
something has to be anonymous for the instance to stay in rotation. It does not
contradict the hardening because the *content* is controlled separately:
`show-details` and `show-components` decide whether an anonymous caller learns
anything beyond `UP` or `DOWN`, which is the argument of
[chunk 04](04-health-aggregation-and-details.md). Anonymous access to a
one-word answer is a different proposition from anonymous access to your
dependency graph.

**★ An internal dashboard on another origin cannot reach your actuator endpoints. Where do you look?**
At `management.endpoints.web.cors.allowed-origins`, which is unset by default and
disables actuator CORS entirely until you name an origin. The reason this is
misdiagnosed so often is that the refusal happens in the browser — the server
sees a request it is perfectly happy with, logs nothing unusual, and the symptom
looks like an authentication problem. Note also that `allowed-methods` defaults
to `GET`, so the write operations need it listed, and that actuator's CORS
configuration is deliberately separate from the application's: an origin trusted
by your API is not thereby trusted by your management endpoints.

---

← Prev: [Locking it down](18-locking-it-down.md) · Index: [Actuator](README.md) · Next → [Sanitising what is returned](20-sanitising-what-is-returned.md)
