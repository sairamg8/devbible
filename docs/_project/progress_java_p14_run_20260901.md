---
name: progress-java-p14-run-20260901
description: Java phase 14 (microservice architecture) run started 2026-09-01 by session af46ba56 — the verified Oakwood 2025.1.x version spine, the eight breaking changes that invalidate published samples, the twelve fixed directory names, and the coordinator+3-fork split.
metadata:
  type: project
---

# ☕ Java phase 14 · Microservice architecture — run of 2026-09-01

Session `af46ba56`, coordinator. Started on the user's *"continue with java and microservices"*,
then *"Please deploy max 3 more agents split work between all of you and make sure to follow
hard rules"*. **Four workers: coordinator + 3 `devbible-author` forks.** The user's cap of *3
additional* agents overrides [[java-playbook]]'s 3-including-coordinator ceiling — the user set
the number, so the number is 4.

Position and claims live on [[java-board]]. This file is the **banked research and the reasoning**,
so no later session re-derives either.

## 🔴 The verified version spine — do NOT re-derive

Verified 2026-09-01 against spring.io/projects/spring-cloud, the spring-cloud-release
Supported-Versions wiki, the Oakwood 2025.1.0 GA announcement, the Spring Cloud Gateway
reference, spring.io/projects/spring-grpc and spring.io/projects/spring-modulith.

| | Pinned |
|---|---|
| JDK | 25 |
| Spring Boot | 4.1.0 · Framework 7.0.8 |
| **Spring Cloud train** | **2025.1.x — `Oakwood`** |
| Every Spring Cloud component | **5.0.x** |
| Spring gRPC | 1.0.3 (supports Boot 4.1.x) |
| Spring Modulith | 2.1.1 (supports Boot 4.1.x) |

⚠️ **Boot 4.1 compatibility arrived in 2025.1.2 (2026-06-11), not in Oakwood's GA.** Oakwood
GA'd against Boot **4.0.0**. Any `pom.xml` on a page must pin **2025.1.2 or later** next to Boot
4.1. Trains map: 2025.1.x→Boot 4.0/4.1 · 2025.0.x (Northfields)→3.5 · 2024.0.x (Moorgate)→3.4 ·
2023.0.x (Leyton)→3.2/3.3.

🔴 **The train is named by YEAR, the components by SEMVER.** "Spring Cloud Gateway 2025.1" and
"Spring Cloud 5.0" are both wrong. Train 2025.1.x, Gateway 5.0.x.

## 🔴 Oakwood was a BREAKING train — eight facts that invalidate most published samples

This is the expensive finding of the run. Each one silently breaks a copy-paste from the top
search result.

1. **The old Gateway artifacts were REMOVED in 2025.1.0** (deprecated in 2025.0).
   `spring-cloud-starter-gateway` **does not resolve.** Verified starter:
   `org.springframework.cloud:spring-cloud-starter-gateway-server-webflux`. Four modules now:
   `spring-cloud-gateway-server-webflux` / `-webmvc` and
   `spring-cloud-gateway-proxyexchange-webflux` / `-webmvc`. Property prefixes migrated to match
   the module names (`spring.cloud.gateway.enabled` confirmed; the route/predicate/filter
   prefixes still need reading from the reference). ⚠️ The `-webmvc` **starter** id follows the
   pattern but was not quoted verbatim on the page checked — confirm before printing it.
2. **`spring-cloud-starter-parent` no longer exists.** Import `spring-cloud-dependencies` as a BOM.
3. **Jackson 3** is the Boot 4 baseline — package names differ from Jackson 2.
4. **REST Assured support was REMOVED from Spring Cloud Contract 5.0**, and `stubrunner`
   properties moved to `spring.cloud.contract.stubrunner`. Contract's generated-test story is
   therefore *not* what any tutorial shows.
5. ⚠️ **`RestTemplate` support was removed from Spring Cloud Netflix 5.0 — but NARROWLY.**
   🔴 **The first draft of `_PHASE-NOTES.md` got this wrong and it was corrected the same day**
   (commit `c30e9aba`). The removal is the **Eureka client's own HTTP transport**:
   `RestTemplateTransportClientFactory` deprecated for removal in favour of a `RestClient`-based
   implementation; the Eureka client now speaks to the Eureka *server* over `RestClient`,
   `WebClient` or Jersey (add `spring-boot-restclient`; WebClient wins only if
   `spring-boot-webclient` is present **and** `eureka.client.webclient.enabled=true`).
   ❌ **It does NOT mean `@LoadBalanced RestTemplate` is gone.** Spring Cloud LoadBalancer
   (Commons **5.0.x**) still supports **RestTemplate, RestClient, WebClient and HTTP Service
   Clients** — `BlockingLoadBalancerClient` for the first two,
   `ReactorLoadBalancerExchangeFilterFunction` for WebClient, and new in 5.0.0 the
   `LoadBalancerRestClientHttpServiceGroupConfigurer` /
   `LoadBalancerWebClientHttpServiceGroupConfigurer` pair.
6. **gRPC is in Spring Boot itself** (Boot 4.1 has a gRPC reference section; project = Spring
   gRPC 1.0.3). The three community starters that dominate search — `grpc-ecosystem/grpc-spring`
   3.1.0 (Boot 3.2), `yidongnan` 2.15.0 (Boot 2.7), `LogNet` 5.2.0 — are all stale here.
7. **`spring-cloud-stream-binder-kafka-reactive` discontinued** (Reactor Kafka unsupported), as
   are `spring-cloud-function-rsocket` and `spring-cloud-function-deployer`.
8. **`spring-cloud-circuitbreaker-spring-retry` is maintenance-only.**

Also gone: `javax.inject` / `javax.annotation` support.

## What was produced

- ✅ **`_PHASE-NOTES.md`** (174 lines, commit `2a060fde`) — binding. The spine, the eight facts,
  the twelve **fixed directory names**, the twelve topic boundaries, the no-sandbox rule, and
  the house rules that bite hardest here.
- ✅ **Phase README banner corrected** (`5edafa6d`). It said *"Spring Boot 3.x / Spring Cloud
  2023+ era"* — **three trains stale**, written 2026-08-17. Banner only: **no directory or topic
  title was renamed**, because inbound links point at them (the phase-11 `01-junit-5` precedent).
- ✅ **All nine remaining `_plan.md` files** — topics 03, 05, 06, 07, 08, 09, 10, 11, 12. Each
  has a fixed boundary paragraph, a chunk table and a **"verify, do not assume"** list naming the
  Oakwood trap that topic must defuse. Those rows are now `📋 planned` and cold-session-ready.

## The fork split

| Fork | Topic | Directory |
|---|---|---|
| A | 01 · Monolith first — honestly (Understand) | `01-monolith-first` |
| B | 02 · Service boundaries from bounded contexts (Master) | `02-service-boundaries` |
| C | 04 · Sync vs async as the coupling decision (Master) | `04-sync-vs-async` |

**Disjoint whole directories**, each fork owning its own `README.md` and numbering chunks 1..N —
so **there is no cross-fork renumbering at close**, unlike the phase-12 banded run. Forks run
**no git commands**; the coordinator commits. Every brief carried the 300-line split rule with
the prove-a-split measurement, the **no-forward-links** rule (phase 11 relearned it at a cost of
23 dangling links), the `{/* FOOTER */}` marker, and *"verify the brief, do not comply with it"*.

🔴 **Topic 12 must be written LAST.** Its entire value is linking back to 02/03/04/05; written
early it guarantees dangling links.

## Why 02 and 03 went to different waves

02 (where the boundary goes) and 03 (the data consequence) are the tightest overlap in the
phase — the classic failure is 02 turning into a database chapter. Fork B was given 02 with an
explicit hand-off clause, and 03 was left planned so it is written **against a finished 02**
rather than concurrently with it.


## 🔴 The correction that proves the rule, 2026-09-01

The coordinator's own `_PHASE-NOTES.md` **fact 5 was wrong on first writing**, taken from the
Oakwood release note *"RestTemplate support removed from Spring Cloud Netflix"* and generalised
into *"the `@LoadBalanced RestTemplate` idiom is gone on this train"*. It is not. Verifying
against the **Spring Cloud Commons 5.0.x LoadBalancer reference** and
`RestTemplateTransportClientFactory`'s own deprecation note showed the removal is the **Eureka
transport only**.

Fixed in commit `c30e9aba` across three files — `_PHASE-NOTES.md` fact 5, topic 08's `_plan.md`
(where it was the topic's headline trap) and topic 05's verify list — and **fork C was messaged
mid-run**, because its brief carried the wrong claim.

**The lesson, stated for the next phase:** a release-note bullet is a *summary written for people
who already know the codebase*. "X support removed from module Y" almost never means "X is gone".
Follow it to the class or the reference page before putting it in a brief — a wrong brief
propagates into every page a fork writes, and this one would have told readers to rip out working
code. This is the fifth time in the Java corpus that **the author who verified rather than
complied was right**; the difference here is that the brief being verified was the coordinator's
own. See [[feedback-verify-your-own-measurements]].
