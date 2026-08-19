---
title: "What Actuator actually is"
sidebar_label: "1 · What Actuator is"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot 4.1.0 reference — *Actuator ·
> Endpoints* (docs.spring.io/spring-boot/reference/actuator/endpoints.html: the
> endpoint catalogue table, the `@Endpoint` / `@ReadOperation` /
> `@WriteOperation` / `@DeleteOperation` contract, `@Selector`, and the
> technology-specific `@WebEndpoint` / `@JmxEndpoint` /
> `@EndpointWebExtension` annotations). Spring Boot 4.1.0, Spring Framework
> 7.0.x, JDK 25.

**Actuator is not "a set of URLs Spring gives you". It is an endpoint
*infrastructure*: a small set of beans, each declaring operations in terms that
mention no HTTP at all, which are then published over one or more
*technologies* — HTTP and JMX. Understanding that the endpoint and its
publication are separate things is what makes the rest of Actuator legible,
because every configuration property you will write is about one or the other,
and confusing the two is the source of nearly every "why is this a 404"
question.**

## The dependency

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

Worth saying explicitly given how much else moved in Boot 4: **this starter was
not renamed.** `spring-boot-starter-web` became
[`spring-boot-starter-webmvc`](../05-auto-configuration/01-what-a-starter-is.md)
and `spring-boot-starter-aop` became `spring-boot-starter-aspectj`, but the
actuator starter kept its name. Plenty of internal *classes* moved — see
[health](03-health-properly.md) and [locking it down](10-locking-it-down.md) —
but the POM line from a Boot 2 tutorial still resolves.

Adding it is enough. There is no `@EnableActuator`; the starter puts classes on
the classpath and [auto-configuration](../05-auto-configuration/README.md) does
the rest. That is worth holding onto, because it means an endpoint can appear
in your application as a side effect of somebody adding an unrelated starter.

## An endpoint is a bean with annotated methods

The whole model is four annotations plus one for path segments:

```java
import org.springframework.boot.actuate.endpoint.annotation.DeleteOperation;
import org.springframework.boot.actuate.endpoint.annotation.Endpoint;
import org.springframework.boot.actuate.endpoint.annotation.ReadOperation;
import org.springframework.boot.actuate.endpoint.annotation.Selector;
import org.springframework.boot.actuate.endpoint.annotation.WriteOperation;

@Component
@Endpoint(id = "featureflags")
public class FeatureFlagsEndpoint {

    private final FeatureFlagStore store;

    public FeatureFlagsEndpoint(FeatureFlagStore store) {
        this.store = store;
    }

    @ReadOperation
    public Map<String, Boolean> all() {
        return this.store.snapshot();
    }

    @ReadOperation
    public Boolean one(@Selector String name) {   // /actuator/featureflags/{name}
        return this.store.get(name);
    }

    @WriteOperation
    public void set(@Selector String name, boolean value) {
        this.store.set(name, value);
    }

    @DeleteOperation
    public void clear(@Selector String name) {
        this.store.remove(name);
    }
}
```

Three things about that class are the design, not decoration:

- **It mentions no HTTP.** No `@RequestMapping`, no `ResponseEntity`, no path,
  no status code. The *operation kind* determines the verb — `@ReadOperation`
  maps to `GET`, `@WriteOperation` to `POST`, `@DeleteOperation` to `DELETE` —
  and `@Selector` contributes a path segment. Parameters that are not selectors
  become query parameters on a read and request-body properties on a write.
- **The same bean is published over JMX**, as an MBean with operations, with no
  extra work. That is why the model is deliberately not MVC-shaped: it has to
  be expressible as an MBean as well as a URL, so the abstraction has to be the
  operation rather than the request.
- **The id is the identity everywhere.** `featureflags` is the URL segment, the
  JMX name, and the token you write in every `management.*` property that talks
  about this endpoint. Ids must be lowercase alphanumeric, which catches
  everyone who names the endpoint after the class.

## When one technology needs something the other does not

`@Endpoint` publishes over both technologies. When that is wrong there are
narrower forms:

- **`@WebEndpoint`** — HTTP only. `heapdump`, `logfile` and `prometheus` are
  web-only because streaming a file has no sensible MBean shape.
- **`@JmxEndpoint`** — JMX only.
- **`@EndpointWebExtension`** and **`@EndpointJmxExtension`** — augment an
  existing `@Endpoint` with technology-specific behaviour rather than replacing
  it.

`health` is the extension case worth knowing, because it explains a behaviour
that otherwise looks like magic. The core health endpoint returns a status
object; it has no idea what an HTTP status code is. The **web extension** is
what maps `DOWN` to a 503 and `UP` to a 200. So when a load balancer's
behaviour surprises you, the thing to reason about is the extension's status
mapping, not the health indicator — and that mapping is configurable, which
[chunk 3](03-health-properly.md) gets into.

## What that separation buys you

The payoff is that a custom `@Endpoint` inherits the entire management story
for free. It lands under the management base path. It moves to the management
port when you set one. It is covered by `EndpointRequest.toAnyEndpoint()` in a
security configuration. It respects the access and exposure properties. It is
publishable over JMX.

A `@RestController` that does the same job inherits **none** of that. It sits on
your public port, in the middle of your business API, and has to be secured
separately by somebody who remembers it exists. That is the practical reason to
reach for `@Endpoint` when the thing you are exposing is operational rather than
part of your product's API — not tidiness, but the fact that the operational
controls apply to it automatically.

## Gotchas

**Symptom:** you name a custom endpoint `feature-flags` and it never appears anywhere
**Cause:** endpoint ids must be lowercase alphanumeric; a hyphen is not a permitted character
**Fix:** use a legal id and map the URL separately if you want the hyphen:
```properties
# @Endpoint(id = "featureflags")
management.endpoints.web.path-mapping.featureflags=feature-flags
```

**Symptom:** a custom endpoint's `@WriteOperation` parameters arrive null, and you were expecting them as query parameters
**Cause:** on a write operation, non-`@Selector` parameters are read from the JSON request body, not the query string — the operation maps to `POST`
**Fix:** send them in the body:
```json
{ "name": "checkout-v2", "value": true }
```

**Symptom:** an operational endpoint you wrote as a `@RestController` turns out to be publicly reachable in production, while every actuator endpoint is properly locked down
**Cause:** the controller is on the application port under your application's security rules; `EndpointRequest.toAnyEndpoint()` never matched it because it is not an endpoint
**Fix:** make it an `@Endpoint` so it inherits the management port, base path and security matcher — or add an explicit `securityMatcher` for its path, but the first option is the one that stays correct when somebody adds a management port later

**Symptom:** an endpoint appears in your application after a routine dependency upgrade and nobody added it
**Cause:** endpoint presence is classpath-driven — several endpoints auto-configure when a particular bean or library shows up, so a new starter can bring one along
**Fix:** nothing to fix in the endpoint; the defence is the exposure allowlist described in [exposure, access and where endpoints live](02-exposure-access-and-ports.md), which makes a new endpoint invisible until somebody names it

**Symptom:** you write a custom endpoint and it works over HTTP but the operations team cannot see it in JConsole
**Cause:** JMX exposure is configured separately from web exposure, and its include list is its own property
**Fix:** add it to the JMX list too:
```properties
management.endpoints.jmx.exposure.include=health,info,featureflags
```

## Interview questions

**★ How does Actuator's endpoint model differ from a `@RestController`, and why is it built that way?**
An endpoint is a bean annotated `@Endpoint` whose methods are annotated
`@ReadOperation`, `@WriteOperation` or `@DeleteOperation`, with `@Selector`
parameters contributing path segments. It mentions no HTTP concepts at all —
no mapping, no status, no `ResponseEntity`. The reason is that the same
endpoint must be publishable over JMX as an MBean as well as over HTTP as a
URL, so the abstraction has to be the *operation*, not the request.
Technology-specific behaviour goes into an `@EndpointWebExtension` or
`@EndpointJmxExtension`, which is exactly how `health` maps a `DOWN` status to
an HTTP 503 without the core endpoint knowing what HTTP is.

**★ You need a custom management endpoint. When is `@Endpoint` the right tool rather than a controller?**
When the thing you are exposing is operational rather than part of your
application's API: a feature-flag dump, a cache invalidation trigger, a
scheduler kick. Going through `@Endpoint` means it inherits the whole
management story automatically — the management base path, the management port
if one is configured, coverage by `EndpointRequest.toAnyEndpoint()` in your
security configuration, the access and exposure properties, and JMX
publication. A controller inherits none of it and quietly sits on the public
port next to your business API. That last consequence is the one that actually
causes incidents.

**★ Why was `spring-boot-starter-actuator` not renamed in Boot 4 when so many other starters were?**
The Boot 4 renames tracked the modularization and were mostly about removing
ambiguity: `spring-boot-starter-web` became `spring-boot-starter-webmvc`
because it always meant "Spring MVC and specifically not WebFlux". The actuator
starter had no such ambiguity to fix, so the coordinates are unchanged. What
did change is where a lot of actuator *classes* live — the health contributor
types and `EndpointRequest` both moved packages — so a Boot 3 application with
custom health indicators or an actuator security configuration compiles against
the same starter and still fails to compile.

**★ What determines the HTTP verb for an actuator operation?**
The annotation, and nothing else. `@ReadOperation` is `GET`, `@WriteOperation`
is `POST`, `@DeleteOperation` is `DELETE`. You do not get to choose, because
the operation kind is also what the access-level machinery reasons about — a
`read-only` access level means "read operations only", which is only a coherent
concept if the operation kind is intrinsic to the method rather than something
a mapping annotation decided.

**★ What is `@Selector` for, and how does it change the shape of a URL?**
It marks a parameter as contributing a path segment rather than being read from
the query string or body, so `@ReadOperation Boolean one(@Selector String name)`
becomes `/actuator/featureflags/{name}`. It is how `health` supports
`/actuator/health/readiness` and how `loggers` supports
`/actuator/loggers/com.example`. There is also a form that matches all
remaining segments, which is what lets the loggers endpoint accept a dotted
logger name as a single selector.

---

← Index: [Actuator](README.md) · Phase: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Exposure, access and where endpoints live](02-exposure-access-and-ports.md)
