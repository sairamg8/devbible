# Phase 14 · Microservice architecture — notes every fork in this phase must read

Target stack: **Spring Boot 4.1.1 / Spring Framework 7.0.9 · Spring Cloud 2025.1.x
"Oakwood" (every component 5.0.x) · JDK 25**, Kubernetes-first.

> Verified 2026-09-01 against spring.io/projects/spring-cloud, the spring-cloud-release
> Supported-Versions wiki, the Oakwood 2025.1.0 GA announcement, the Spring Cloud Gateway
> reference, spring.io/projects/spring-grpc and spring.io/projects/spring-modulith.

## 🔴 THE VERSION SPINE — verified, do not re-derive, do not quote a project's front page

| | Pinned for this phase |
|---|---|
| JDK | **25** |
| Spring Boot | **4.1.1** · Spring Framework **7.0.9** |
| **Spring Cloud release train** | 🔴 **2025.1.x — codename `Oakwood`** |
| Every Spring Cloud component | 🔴 **5.0.x** (Gateway, OpenFeign, Config, Netflix, Consul, Contract, Kubernetes, CircuitBreaker, Stream, Commons, Function, Vault, Task, Zookeeper, Bus) |
| Spring gRPC | **1.0.3** — supports Boot **4.1.x** |
| Spring Modulith | **2.1.1** — supports Boot **4.1.x** |

🔴 **The train is named by YEAR, the components by SEMVER.** `2025.1.0` is the BOM;
`5.0.0` is what Gateway itself reports. A page that says "Spring Cloud Gateway 2025.1" is
wrong, and so is one that says "Spring Cloud 5.0". Say **train 2025.1.x, Gateway 5.0.x**.

⚠️ **Boot 4.1 compatibility arrived in 2025.1.2, not 2025.1.0.** Oakwood's GA baseline was
Boot **4.0.0**; the train picked up 4.1.x from **2025.1.2** (2026-06-11) onward. If a page
pins a BOM version in a `pom.xml`, pin **2025.1.2 or later** — never `2025.1.0` next to
Boot 4.1.

## 🔴 The eight facts that make most published samples wrong on this phase

Oakwood was a **breaking** train. Every one of these silently invalidates the top Google
result. **Name the change on the page** — do not just write the new form and let the reader
wonder why their tutorial differs.

1. 🔴 **The old Gateway artifacts were REMOVED in 2025.1.0**, not deprecated —
   they had been deprecated in 2025.0 and are now gone. `spring-cloud-starter-gateway`
   **does not resolve**. The artifacts are now split by *style* and *web stack*:
   `spring-cloud-gateway-server-webflux` · `spring-cloud-gateway-server-webmvc` ·
   `spring-cloud-gateway-proxyexchange-webflux` · `spring-cloud-gateway-proxyexchange-webmvc`,
   with starters `spring-cloud-starter-gateway-server-webflux` / `-webmvc`.
   **The configuration property prefixes moved to match the module names too.** Topic 07
   owns this; verify the exact current prefixes against the Gateway reference before writing
   a single YAML block.
2. 🔴 **`spring-cloud-starter-parent` no longer exists.** Import the BOM
   (`spring-cloud-dependencies:2025.1.x`) under `<dependencyManagement>`. Any page showing a
   `<parent>` of `spring-cloud-starter-parent` is pre-Oakwood.
3. 🔴 **Jackson 3** across Boot 4 / Oakwood. Package and module names changed from Jackson 2.
   Do not copy a `com.fasterxml.jackson.databind` import from an old sample without checking.
4. 🔴 **REST Assured support was REMOVED from Spring Cloud Contract 5.0.** Topic 11's
   generated-test story changed — verify what Contract 5.0 generates now before describing
   it, and do not reproduce the classic `RestAssuredMockMvc` generated test from the docs of
   an older train.
5. ⚠️🔴 **`RestTemplate` support was removed from Spring Cloud Netflix 5.0 — but read what that
   actually means.** *This note was corrected 2026-09-01 after the first draft overstated it;
   the correction is itself the lesson.* The removal is about **the Eureka client's own HTTP
   transport** — how your app talks to the *Eureka server*. `RestTemplateTransportClientFactory`
   was deprecated for removal in favour of a `RestClient`-based implementation; the Eureka
   client now uses **`RestClient`, `WebClient` or Jersey** under the hood (add
   `spring-boot-restclient`; if `spring-boot-webclient` is also present and
   `eureka.client.webclient.enabled=true`, WebClient wins, otherwise RestClient).
   🔴 **It does NOT mean `@LoadBalanced RestTemplate` is gone.** Spring Cloud LoadBalancer
   (Commons **5.0.x**) still lists **`RestTemplate`, `RestClient`, `WebClient` and HTTP Service
   Clients** as load-balanced clients — `BlockingLoadBalancerClient` serves RestTemplate and
   RestClient, `ReactorLoadBalancerExchangeFilterFunction` serves WebClient, and **new in
   5.0.0** are `LoadBalancerRestClientHttpServiceGroupConfigurer` /
   `LoadBalancerWebClientHttpServiceGroupConfigurer` for HTTP Service Clients (used when the
   group `baseUrl` is null or its scheme is `lb`). Prefer `RestClient` for new code and say
   why — but **do not tell the reader their `@LoadBalanced RestTemplate` stopped working.**
6. 🔴 **gRPC is in Spring Boot itself now** — Boot 4.1 has a `gRPC` reference section, with
   **Spring gRPC 1.0.3** as the project. Topic 06 must be written against *that*, not against
   any of the three community `grpc-spring-boot-starter` forks
   (`grpc-ecosystem/grpc-spring` 3.1.0, `yidongnan` 2.15.0, `LogNet` 5.2.0) — all of which
   are pinned to Boot 2.7/3.2 and are the top search results. Name them and say why they are
   not the answer here.
7. 🔴 **`spring-cloud-stream-binder-kafka-reactive` is discontinued** (Reactor Kafka is no
   longer supported), as are `spring-cloud-function-rsocket` and
   `spring-cloud-function-deployer`. Only relevant here in passing — **phase 15 owns Stream**
   — but do not link a reader toward a dead binder.
8. 🔴 **`spring-cloud-circuitbreaker-spring-retry` is maintenance-only.** Topic 04 may name
   circuit breaking as the coupling consequence, but **phase 16 owns Resilience4j**; point
   there rather than teaching it.

⚠️ Also removed on this train: `javax.inject` and `javax.annotation` support. And
`stubrunner` properties moved to the `spring.cloud.contract.stubrunner` prefix (topic 11).

## 🔴 The README banner is stale — reconcile, do not silently diverge

`README.md` opens with *"Target: Spring Boot 3.x / Spring Cloud 2023+ era"*. That was written
2026-08-17, three trains ago. **The phase owner updates that banner to the spine above.**
Directory names and topic titles are **not** renamed — inbound links point at them.

## 🔴 No sandbox, no cluster, no Docker

Documentation-validated only, like every other Java phase. **No `kubectl` output, no Eureka
dashboard screenshots, no trace waterfalls, no latency numbers from "a run", no container
logs.** Java source, `pom.xml`/`build.gradle` fragments and YAML carry these pages. A
measured-looking number that was not measured is the single worst thing a page here can
contain — this phase is *full* of tempting ones (p99s, hop counts, availability figures).

⚠️ **Availability arithmetic is the exception and it is arithmetic, not measurement.**
`0.99^n` is a calculation the reader can redo; label it as such. Never present it as
observed production data.

## Boundaries inside the phase (fixed — a fork that crosses one duplicates another's work)

- **01 Monolith first** owns the *argument against splitting*: what microservices actually
  buy and who pays, team topology as the real driver, and **Spring Modulith 2.1.1** as the
  in-process answer (modules, `ApplicationModules` verification, the module test slice,
  documentation generation). It does **not** teach any Spring Cloud component.
- **02 Service boundaries** owns *where the line goes*: bounded contexts, invariants and
  transaction boundaries, aggregate ownership, the "one service one capability" test, and the
  refactoring path out of a wrong boundary. 🔴 **It owns the drawing of the line; 03 owns the
  data consequence.** 02 must not turn into a database chapter.
- **03 Database-per-service** owns the *data consequence*: the joins you lose, API
  composition vs CQRS read models, duplicated reference data, shared-database as an
  anti-pattern and when it is nonetheless right, and the fact that cross-service
  transactions are gone. 🔴 **Sagas belong to phase 15 topic 10** — name the problem, hand off.
- **04 Sync vs async** owns *coupling as a decision*: availability multiplication (`0.99^n`),
  latency budgets across hops, temporal coupling, request-response over messaging, and the
  honest table of which interactions must be synchronous. 🔴 **It owns the decision; phase 15
  owns the brokers.** No RabbitMQ or Kafka mechanics here.
- **05 Inter-service REST** owns *change over the wire*: tolerant reader, additive-only
  evolution, DTO versioning strategies, the deploy-order deadlock, `RestClient`/OpenFeign 5.0
  as the client, and timeouts as a client-side obligation.
- **06 gRPC** owns protobuf contracts, streaming modes, deadlines, and the honest comparison
  with REST — on **Spring gRPC 1.0.3 / Boot 4.1**. Tier is Know: breadth over depth.
- **07 API gateway** owns the edge: routing, predicates and filters, auth termination, rate
  limiting, and the rule that **no business logic lives at the edge** — on the **renamed
  Oakwood artifacts** (fact 1).
- **08 Service discovery** owns *finding an instance*: client-side vs server-side discovery,
  Eureka and Consul on Netflix/Consul 5.0, **and the argument that on Kubernetes the platform
  already did this** (Services + DNS). Must state fact 5.
- **09 Centralized configuration** owns Spring Cloud Config 5.0 vs ConfigMaps/Secrets, refresh
  semantics, and secrets handling. Tier Know.
- **10 Correlation** owns W3C `traceparent`, Micrometer Tracing, propagation across hops and
  into logs via MDC. 🔴 **Phase 12 topic 09 owns tracing infrastructure** — 10 owns the
  correlation *identifier* and what an incident looks like without it. Check what phase 12
  actually wrote before duplicating: `ls ../phase-12-jvm-production/`.
- **11 Contract testing** owns Spring Cloud Contract 5.0 and Pact as the *provider CI gate*:
  consumer-driven contracts, stub runner, and why an integration environment is not the
  answer. 🔴 **Phase 11 owns testing technique** — 11 here owns the cross-service contract only.
- **12 The distributed monolith** owns the *tells* (lockstep deploys, shared database, chatty
  sync chains, a change that touches five repos) and the honest fix. It is the phase's
  closing argument and may reference every topic before it.

## 🔴 The twelve directory names — FIXED, so links resolve across forks

Invent one and you break every inbound link another fork wrote. These are the names:

| # | Directory | # | Directory |
|---|---|---|---|
| 01 | `01-monolith-first` | 07 | `07-api-gateway` |
| 02 | `02-service-boundaries` | 08 | `08-service-discovery` |
| 03 | `03-database-per-service` | 09 | `09-centralized-configuration` |
| 04 | `04-sync-vs-async` | 10 | `10-correlation-across-services` |
| 05 | `05-inter-service-rest` | 11 | `11-contract-testing` |
| 06 | `06-grpc` | 12 | `12-the-distributed-monolith` |

Each topic directory numbers its own chunks **1..N contiguously**, with `README.md` at
`sidebar_position: 0`. Because forks hold whole disjoint directories, there is **no
cross-fork renumbering at close** — keep your own positions contiguous as you go.

## The house rules that bite hardest in this phase

- 🔴 **300 lines is a file-size cap, never a content budget.** Write to exhaustion, then split
  on a concept boundary into a lettered sibling with its own frontmatter, tier badge,
  `> Verified:` line, Gotchas and Interview questions. **Prove a split**: record `wc -l` and
  `grep -c '^\*\*★'` before; both totals must go **up** after.
- 🔴 **A topic is not closed without a `README.md` index** (`sidebar_position: 0`,
  `sidebar_label: "Overview"`). Copy `../phase-11-testing/02-assertj/README.md`.
- 🔴 **Never link forward to a chunk you have not written.** It fails the Docusaurus build.
  Write it as `**Title** *(not written yet)*` in bold prose and convert it to a link when the
  chunk lands. This is the phase-13 precedent (commit `39ad34bc`) and it cost phase 11
  twenty-three dangling links to relearn.
- 🔴 **Verify the brief; do not comply with it.** Four times in phase 11 the source
  contradicted the brief and **the author who checked was right**. If anything above is wrong
  against a primary source, the source wins — fix the notes and say so.
- **Tier badges** use the phase README's classes: `t-understand`, `t-master`, `t-know`.
  Match the README exactly; do not "fix" a class name mid-run.

## Phase gate (from the README — the phase must actually deliver this)

Given "split this order system", the reader can argue **against** the split for a two-team
shop and **for** it at scale — naming boundaries by invariant, the sync/async choice per
interaction, and the availability cost of each synchronous hop.
