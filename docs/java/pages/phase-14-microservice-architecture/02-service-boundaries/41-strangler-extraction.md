---
title: "The Strangler Fig pattern enables incremental, zero-downtime service extraction from a legacy monolith through proxy-intercepted routing"
sidebar_label: "41 · Strangler extraction"
sidebar_position: 60
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Martin Fowler, *StranglerFigApplication* ([martinfowler.com](https://martinfowler.com/bliki/StranglerFigApplication.html));
> Sam Newman, *Monolith to Microservices* (O'Reilly), Chapter 3: Splitting the Monolith.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**Big-bang rewrites of enterprise monoliths almost universally fail because they freeze business feature delivery, underestimate accumulated legacy edge cases, and attempt to switch 100% of production traffic in a single catastrophic release. Martin Fowler's Strangler Fig pattern replaces the big-bang rewrite with an incremental migration inspired by Australian strangler fig vines, which seed in the canopy of a host tree, grow aerial roots downward, and gradually envelop and replace the host tree over years. In software architecture, a strangler migration places an intercepting API gateway in front of the monolith, extracts bounded capabilities into standalone microservices one at a time, redirects traffic route-by-route, and systematically deprecates legacy paths until the monolith is completely eliminated.**

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

## Gotchas

**★ Selecting the core revenue-generating domain as the first extraction.**
Attempting to extract the complex `Order` or `Checkout` flow as Service #1 overwhelms the team. Unforeseen transactional coupling, distributed tracing gaps, and infrastructure instability will derail the project and destroy organizational confidence in the architecture.

**★ Monolith session affinity breaking at the gateway.**
If the monolith relies on in-memory HTTP sessions (`HttpSession`), routing some requests to an extracted service causes session state loss when the client returns to the monolith. Migrate the monolith to centralized session management (Spring Session backed by Redis) or stateless JWT tokens before introducing the strangler gateway.

**★ The "Two-Phase Commit Trap" during dual-run.**
Attempting to keep both the legacy monolith database and the new microservice database mutually consistent using synchronized synchronous writes causes partial failure states. Establish a single clear system of record for each phase of the migration.

**★ Abandoning the strangler halfway through.**
A common enterprise anti-pattern is extracting 3 services and leaving the remaining 80% in the monolith permanently. The organization now suffers the worst of both worlds: maintaining microservice infrastructure while still deploying a brittle monolith. A strangler program requires explicit organizational commitment to see each capability through to full legacy retirement.

## Interview questions

**★ What is the Strangler Fig pattern and why is it superior to a Big Bang rewrite?**
The Strangler Fig pattern incrementally replaces legacy capabilities by intercepting requests at an API gateway and redirecting them to newly deployed microservices. Unlike Big Bang rewrites—which freeze feature development for months, carry extreme deployment risk, and frequently fail—the Strangler Fig delivers immediate business value, tests architecture under real traffic, and allows graceful rollback at each step.

**★ How do you determine the boundary and order of services to extract using the Strangler Fig?**
Start with low-risk, loosely coupled supporting or generic subdomains (e.g., notifications, reporting, image processing). This allows the team to establish CI/CD pipelines, container orchestration, monitoring, and security patterns safely. Only after operational maturity is achieved should the team tackle high-coupling, core business domains.

**★ How do you handle cross-cutting concerns like authentication when placing an API Gateway in front of a strangler application?**
The API gateway acts as the centralized policy enforcement point. It validates authentication tokens (e.g., OAuth2 JWTs) and injects standardized downstream headers (`X-User-Id`, `X-User-Roles`). If the legacy monolith requires its own cookie or session, the gateway can translate or pass through cookies while passing bearer tokens to the modern microservice.

**★ What data migration strategy prevents inconsistency while the monolith and extracted service coexist?**
Use Change Data Capture (CDC) via Debezium or a Transactional Outbox. During the transition, designate one system as the authoritative writer. If the monolith remains the writer, stream database change events to the new service to populate its database. When write authority cuts over to the new service, invert the CDC stream back to the monolith if legacy dependencies still require read access.

---

← [Splitting a service](40-splitting-a-service.md) · [Topic index](README.md) · Next → [The cost of changing a boundary](42-the-cost-of-changing-a-boundary.md)
