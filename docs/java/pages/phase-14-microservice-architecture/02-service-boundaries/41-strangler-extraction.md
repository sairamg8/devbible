---
title: "The Strangler Fig pattern enables incremental, zero-downtime service extraction from a legacy monolith through proxy-intercepted routing"
sidebar_label: "41 · Strangler extraction"
sidebar_position: 67
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Martin Fowler, *StranglerFigApplication*
> ([martinfowler.com](https://martinfowler.com/bliki/StranglerFigApplication.html)); microservices.io
> *Strangler Application*
> ([microservices.io](https://microservices.io/patterns/refactoring/strangler-application.html)).
> 🔴 **Both sources are narrower than the pattern's reputation** — see *What the sources do and do
> not say* below.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**Big-bang rewrites of enterprise monoliths almost universally fail because they freeze business feature delivery, underestimate accumulated legacy edge cases, and attempt to switch 100% of production traffic in a single catastrophic release. Martin Fowler's Strangler Fig pattern replaces the big-bang rewrite with an incremental migration inspired by Australian strangler fig vines, which seed in the canopy of a host tree, grow aerial roots downward, and gradually envelop and replace the host tree over years. In software architecture, a strangler migration places an intercepting API gateway in front of the monolith, extracts bounded capabilities into standalone microservices one at a time, redirects traffic route-by-route, and systematically deprecates legacy paths until the monolith is completely eliminated.**

## What the sources do and do not say

The pattern is quoted constantly and read rarely, so it is worth putting the actual text on the page.
Fowler's metaphor:

> *"These are vines that germinate in a nook of a tree. As it grows, it draws nutrients from the host
> tree until it reaches the ground to grow roots and the canopy to get sunlight."*

The method:

> *"Like the fig, it begins with small additions, often new features, that are built on top of, yet
> separate to the legacy code base. As we do this we move bits of behavior from the legacy system
> into the new code base."*

And the case against the alternative, which is the reason the pattern exists:

> 🔴 *"We've seen this simple-sounding plan go down in flames most of the time. Replacing a serious IT
> system takes a long time, and the users can't wait for new features."*

> *"Replacements seem easy to specify, but often it's hard to figure out the details of existing
> behavior."*

microservices.io states the same shape as a pattern:

> Problem: *"How do you migrate a legacy monolithic application to a microservice architecture?"*
> Solution: *"Modernize an application by incrementally developing a new (strangler) application
> around the legacy application."*

⚠️ **Now the part that matters for accuracy.** Neither source specifies the mechanics this page and
most others go on to describe. **Fowler's article does not discuss event interception or asset
capture**, and the microservices.io page **does not specify request routing, glue-code or
anti-corruption mechanics, or data replication during migration.** Everything below about gateways,
routing and dual-run is engineering practice built on top of the pattern — sound, widely used, and
**not** attributable to either source. This page says so rather than letting a reader assume Fowler
prescribed a gateway.

**One consequence of Fowler's second sentence is worth pulling out**, because it is the argument
people skip: *"it's hard to figure out the details of existing behavior."* The strangler's advantage
over a rewrite is not that it is safer to deploy — it is that **you never have to specify the whole
system at once.** You specify one route, discover its real behaviour by running both, and move on.
A rewrite requires knowing everything up front, and the knowledge does not exist.

## Selecting the first candidate for extraction

The first service extracted sets the precedent for the entire organization's cloud-native infrastructure, CI/CD pipelines, container orchestration, and observability standards.

Selecting the wrong first candidate is fatal:
- **Never extract the Core Domain first**: Do not begin with `OrderProcessing` or `CorePricing`. The team will be fighting distributed transaction failures and eventual consistency while simultaneously learning Kubernetes, Helm, OpenTelemetry, and Kafka.
- **Select a Supporting or Generic Subdomain**: Ideal candidates are `NotificationService`, `InvoicePdfGenerator`, or `UserPreferences`.
- **Ideal characteristics**:
  1. Low inbound transactional coupling (few synchronous dependencies from other modules).
  2. Clear, well-understood domain boundaries with a modest schema footprint.
  3. High tangible value (e.g., capability requires independent autoscaling due to CPU-intensive PDF rendering or distinct bursty notification spikes).

```
Phase 1: Direct Access
Clients =======================> [ Monolith ]

Phase 2: Intercept
Clients ===> [ API Gateway ] ===> [ Monolith ]

Phase 3: Coexist & Strangle
Clients ===> [ API Gateway ] ===+===> [ Monolith ] (legacy paths)
                                |
                                +===> [ Extracted Service ] (e.g., /api/notifications/**)

Phase 4: Complete
Clients ===> [ API Gateway ] ===+===> [ Extracted Service 1 ]
                                +===> [ Extracted Service 2 ]
                                +===> [ Monolith Decommissioned ]
```

## Step-by-step extraction workflow

### Step 1: Intercept — introduce the gateway
Before changing a single line of backend application code, place a reverse proxy or API gateway (e.g., Spring Cloud Gateway) between external clients and the monolith. 

Initially, 100% of traffic passes through the gateway directly to the monolith:

```yaml
# Spring Cloud Gateway (application.yml)
spring:
  cloud:
    gateway:
      server:
        mvc:
          routes:
            - id: monolith-fallback
              uri: http://monolith-internal.prod.svc.cluster.local:8080
              predicates:
                - Path=/**
```

Verify that production telemetry, latency profiles, TLS termination, and authentication headers function identically through the gateway.

### Step 2: Transform — build the standalone microservice
Develop the new microservice in isolation:
- Give it a dedicated database schema and independent connection pool.
- Expose a modern REST, gRPC, or event-driven interface.
- Implement Change Data Capture (CDC) or outbox streaming to synchronize state between the legacy database and the new microservice during the transition.

### Step 3: Coexist — route traffic incrementally
Update the gateway configuration to divert specific sub-paths or header-tagged traffic to the new microservice, while falling back to the monolith for all remaining routes:

```java
package com.example.gateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.ServerResponse;

import static org.springframework.cloud.gateway.server.mvc.handler.GatewayServerResponse.ok;
import static org.springframework.cloud.gateway.server.mvc.handler.HandlerFunctions.http;
import static org.springframework.cloud.gateway.server.mvc.predicate.GatewayRequestPredicates.path;

@Configuration
public class StranglerGatewayRoutes {

    @Value("${services.monolith.url:http://monolith:8080}")
    private String monolithUrl;

    @Value("${services.notification.url:http://notification-service:8081}")
    private String notificationUrl;

    @Bean
    public RouterFunction<ServerResponse> routeRules() {
        return org.springframework.cloud.gateway.server.mvc.handler.GatewayRouterFunctions.route()
                // Strangle: Divert notifications to the extracted microservice
                .route(path("/api/v1/notifications/**"), http(notificationUrl))
                // Fallback: All other routes continue to the monolith
                .route(path("/**"), http(monolithUrl))
                .build();
    }
}
```

Support canary routing or feature toggles using header-based predicates:
```java
// Route beta testers or internal staff to the new service first
.route(path("/api/v1/orders/**").and(org.springframework.cloud.gateway.server.mvc.predicate.GatewayRequestPredicates.header("X-Feature-Beta", "true")), http(orderServiceUrl))
```

### Step 4: Strangle and retire
Once the new microservice handles 100% of production traffic for the route without regression:
1. Remove the old controller and service code from the monolith repository.
2. Drop the obsolete tables from the monolith database.
3. Clean up the proxy route rule to make the new path permanent.

## The comparison run: how you discover behaviour nobody documented

Fowler's *"hard to figure out the details of existing behavior"* has a concrete answer, and it is the
technique that separates a strangler that works from one that ships bugs at the same rate as a
rewrite. **Before routing a request to the new service, route it to both and compare.**

```java
// src/main/java/com/retailer/gateway/PricingComparisonFilter.java
package com.retailer.gateway;

import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
class PricingComparisonRunner {

    private static final Logger log = LoggerFactory.getLogger(PricingComparisonRunner.class);

    private final LegacyPricingClient legacy;
    private final PricingServiceClient extracted;

    PricingComparisonRunner(LegacyPricingClient legacy, PricingServiceClient extracted) {
        this.legacy = legacy;
        this.extracted = extracted;
    }

    // The legacy answer is still the one returned. The new one is only observed.
    PriceQuote quote(PriceRequest request) {
        PriceQuote authoritative = legacy.quote(request);
        try {
            PriceQuote candidate = extracted.quote(request);
            if (!Objects.equals(authoritative.totalMinor(), candidate.totalMinor())) {
                log.warn("strangler-divergence route=pricing sku={} legacy={} candidate={}",
                    request.sku(), authoritative.totalMinor(), candidate.totalMinor());
            }
        } catch (RuntimeException e) {
            log.warn("strangler-candidate-failed route=pricing sku={}", request.sku(), e);
        }
        return authoritative;
    }
}
```

🔴 **Three properties make this safe, and all three are easy to lose:**

1. **The legacy answer is what the caller receives.** The candidate is observed, never served.
2. **The candidate's failures are swallowed and logged.** A bug in the new service must not become an
   incident in the old path — the moment a comparison run can take production down, it gets turned
   off and the discovery stops.
3. **The comparison runs on real traffic, for a full business cycle.** Divergences cluster at month
   end, in the currency nobody tested, and in the customer segment created in 2014.

⚠️ **Do not run comparisons on requests with side effects.** A read-side comparison is free; a
write-side one charges the customer twice. For writes, compare the *decision* rather than executing
both — have the candidate compute what it would have written and log the difference against what the
legacy path actually wrote.

## Gotchas

**★ Selecting the core revenue-generating domain as the first extraction.**
Attempting to extract the complex `Order` or `Checkout` flow as Service #1 overwhelms the team. Unforeseen transactional coupling, distributed tracing gaps, and infrastructure instability will derail the project and destroy organizational confidence in the architecture.

**★ Monolith session affinity breaking at the gateway.**
If the monolith relies on in-memory HTTP sessions (`HttpSession`), routing some requests to an extracted service causes session state loss when the client returns to the monolith. Migrate the monolith to centralized session management (Spring Session backed by Redis) or stateless JWT tokens before introducing the strangler gateway.

**★ The "Two-Phase Commit Trap" during dual-run.**
Attempting to keep both the legacy monolith database and the new microservice database mutually consistent using synchronized synchronous writes causes partial failure states. Establish a single clear system of record for each phase of the migration.

**★ Divergences are found only after the new service is already serving traffic.**
Cause: routing was flipped on the strength of a test suite. The tests encode what somebody believed
the legacy behaviour was, which is precisely the thing Fowler says is hard to determine — *"it's hard
to figure out the details of existing behavior."*
Fix: run both paths against real traffic and compare before flipping anything, with the legacy answer
served and the candidate observed. The divergence log is the specification nobody wrote down.

**★ The comparison run is disabled after it causes an outage.**
Cause: the candidate's exceptions or latency propagated into the legacy path, so a defect in code that
was not yet serving anybody took production with it.
Fix: the candidate call is wrapped, its failures swallowed and logged, and — where volume warrants —
run on a sample or asynchronously. A comparison harness that can cause an incident will be switched
off, and switching it off is what makes the eventual cutover blind.

**★ The extraction is 'behaviourally identical' and month-end breaks.**
Cause: the comparison ran for a sprint. The legacy system's undocumented behaviour is concentrated in
periodic processes, unusual segments and edge-case currencies that a fortnight of traffic never
exercises.
Fix: measure the comparison window in business cycles, not sprints, and check divergence counts by
segment rather than in aggregate — a 0.01% overall divergence rate can be a 100% divergence rate for
one customer type.

**★ Abandoning the strangler halfway through.**
A common enterprise anti-pattern is extracting 3 services and leaving the remaining 80% in the monolith permanently. The organization now suffers the worst of both worlds: maintaining microservice infrastructure while still deploying a brittle monolith. A strangler program requires explicit organizational commitment to see each capability through to full legacy retirement.

## Interview questions

**★ What is the Strangler Fig pattern and why is it superior to a Big Bang rewrite?**
The Strangler Fig pattern incrementally replaces legacy capabilities by intercepting requests at an API gateway and redirecting them to newly deployed microservices. Unlike Big Bang rewrites—which freeze feature development for months, carry extreme deployment risk, and frequently fail—the Strangler Fig delivers immediate business value, tests architecture under real traffic, and allows graceful rollback at each step.

**★ How do you determine the boundary and order of services to extract using the Strangler Fig?**
Start with low-risk, loosely coupled supporting or generic subdomains (e.g., notifications, reporting, image processing). This allows the team to establish CI/CD pipelines, container orchestration, monitoring, and security patterns safely. Only after operational maturity is achieved should the team tackle high-coupling, core business domains.

**★ How do you handle cross-cutting concerns like authentication when placing an API Gateway in front of a strangler application?**
The API gateway acts as the centralized policy enforcement point. It validates authentication tokens (e.g., OAuth2 JWTs) and injects standardized downstream headers (`X-User-Id`, `X-User-Roles`). If the legacy monolith requires its own cookie or session, the gateway can translate or pass through cookies while passing bearer tokens to the modern microservice.

**★ Fowler gives two arguments against a big-bang rewrite. Which one is the stronger argument for a strangler, and why?**
The famous one is about delivery risk — *"Replacing a serious IT system takes a long time, and the
users can't wait for new features."* The stronger one is epistemic: *"Replacements seem easy to
specify, but often it's hard to figure out the details of existing behavior."* A rewrite requires you
to specify the whole system up front, and the knowledge required to do that does not exist anywhere —
not in the documentation, not in the tests, and often not in anyone's head. A strangler never asks
you to. You take one route, discover its real behaviour by running both implementations against
production traffic, and move on. That reframes the pattern from "a safer deployment strategy" to "a
discovery strategy", which is also why the comparison run is the part you cannot skip.

**★ How do you establish that an extracted service behaves like the code it replaces?**
Not with a test suite, because the suite encodes what somebody believed the legacy behaviour was.
You run both against real traffic with the legacy answer served and the candidate merely observed,
and you log every divergence. Three properties keep it safe: the caller always receives the legacy
result, the candidate's failures are swallowed rather than propagated, and the run lasts a full
business cycle rather than a sprint. Reads are free to compare; writes are not, so for those you
compare the *decision* the candidate would have made against what the legacy path actually did rather
than executing both. The divergence log that comes out of this is the specification nobody ever wrote.

**★ What data migration strategy prevents inconsistency while the monolith and extracted service coexist?**
Use Change Data Capture (CDC) via Debezium or a Transactional Outbox. During the transition, designate one system as the authoritative writer. If the monolith remains the writer, stream database change events to the new service to populate its database. When write authority cuts over to the new service, invert the CDC stream back to the monolith if legacy dependencies still require read access.

---

← [Splitting a service](40-splitting-a-service.md) · [Topic index](README.md) · Next → [The cost of changing a boundary](42-the-cost-of-changing-a-boundary.md)
