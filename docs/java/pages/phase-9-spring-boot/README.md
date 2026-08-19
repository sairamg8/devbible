---
title: "Phase 9 — Spring Boot and the web"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Spring Boot 4.1.0 (11 Jun 2026) on Spring Framework 7.0, JDK 25.**
> ⚠️ Spring Boot **4** renamed `spring-boot-starter-web` to
> **`spring-boot-starter-webmvc`**, moved to **Jakarta EE 11** and **Jackson 3**,
> deprecated **`RestTemplate`** in favour of `RestClient`, and removed
> `@MockBean`/`@SpyBean`. Almost every Spring tutorial online predates this —
> these pages are written against 4.x and say so.
> Documentation-validated — every page names its sources on a `> Verified:` line
> (the Spring Boot and Spring Framework reference docs and release notes, the
> Spring Security reference for topic 11).
> No sandbox: pages carry Java/config code, never fabricated logs, startup
> banners or HTTP transcripts.

The framework nearly every Java job means when it says "Java". These pages
teach the machinery — DI, auto-configuration, the request pipeline — because
the annotations are learnable in a day but debuggable only with the model.

🚧 **0 of 16 written.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **Why frameworks: the servlet model** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Embedded Tomcat, one (virtual) thread per request |
| 02 | **The IoC container** *(not written yet)* | <span className="db-tier t-master">Master</span> | Beans, stereotypes, scanning — the object graph Spring builds |
| 03 | **Dependency injection** *(not written yet)* | <span className="db-tier t-master">Master</span> | Constructor injection as the only default |
| 04 | **Bean scopes and lifecycle** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Singletons, `@PostConstruct`, the circular-dependency error |
| 05 | **Boot auto-configuration** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | What `@SpringBootApplication` triggers; the conditions report |
| 06 | **Configuration and profiles** *(not written yet)* | <span className="db-tier t-master">Master</span> | `@ConfigurationProperties`, profiles, env overrides — 12-factor |
| 07 | **REST controllers** *(not written yet)* | <span className="db-tier t-master">Master</span> | Mappings, records as bodies, `ResponseEntity`, status on purpose |
| 08 | **Validation** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Bean Validation at the boundary; custom validators |
| 09 | **Error handling** *(not written yet)* | <span className="db-tier t-master">Master</span> | `@ControllerAdvice` + `ProblemDetail` (RFC 9457) |
| 10 | **The request pipeline** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Filters vs interceptors vs AOP — where each concern belongs |
| 11 | **Spring Security, the working subset** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Filter chain, JWT resource server, CORS/CSRF for SPA + API |
| 12 | **Outbound HTTP** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `RestClient`, timeouts, error mapping |
| 13 | **Actuator** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Liveness vs readiness — and locking the rest down |
| 14 | **OpenAPI with springdoc** *(not written yet)* | <span className="db-tier t-know">Know</span> | The generated contract your frontend consumes |
| 15 | **WebFlux and reactive** *(not written yet)* | <span className="db-tier t-know">Know</span> | What it costs, and why virtual threads moved the default back |
| 16 | **The alternatives** *(not written yet)* | <span className="db-tier t-know">Know</span> | Quarkus, Micronaut, Helidon — the trade-offs |

## Phase gate

**Deliverable:** a small Boot service with one resource: validated POST, typed
config via `@ConfigurationProperties`, a `@ControllerAdvice` returning
`ProblemDetail`, and health/readiness split for a container orchestrator.

## Where this connects

- **[Phase 2](../phase-2-classes-objects/README.md)** (dispatch, interfaces) and
  **[Phase 5](../phase-5-exceptions/README.md)** are the mechanics under every
  annotation here.
- **Phase 10 — Data access** adds the repository layer to this service.
- **Phase 13 — OAuth2** extends topic 11 into the full protocol.
