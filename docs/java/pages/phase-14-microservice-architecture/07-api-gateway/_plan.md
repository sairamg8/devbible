# Topic 07 · API gateway with Spring Cloud Gateway — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **the edge**: one entry point for routing, cross-cutting auth, rate limiting and
aggregation — and the rule that **no business logic lives there**. 🔴 **05 owns
service-to-service REST**; 07 is client-to-system. 🔴 **08 owns discovery**, though the gateway
consumes it. 🔴 **Phase 13 owns OAuth2/OIDC**; 07 covers only where the token is *terminated*
and what is forwarded. 🔴 **16 owns Resilience4j**; 07 names the filter and hands off.

## 🔴 The trap this topic exists to defuse
`_PHASE-NOTES.md` fact 1: **the old Gateway artifacts were REMOVED in Spring Cloud 2025.1.0**
(deprecated in 2025.0, gone in 2025.1). **`spring-cloud-starter-gateway` does not resolve.**
Verified from the Gateway reference, 2026-09-01: the starter is
**`org.springframework.cloud:spring-cloud-starter-gateway-server-webflux`**. The four modules
are `spring-cloud-gateway-server-webflux` · `spring-cloud-gateway-server-webmvc` ·
`spring-cloud-gateway-proxyexchange-webflux` · `spring-cloud-gateway-proxyexchange-webmvc`.
⚠️ **Confirm the `-webmvc` starter id from the docs directly** — it follows the pattern but was
not quoted verbatim on the page checked. **Every gateway tutorial online predates this.**

⚠️ Also verified: Gateway Server WebFlux **requires the Netty runtime** and does not work in a
traditional servlet container or as a WAR. That is why the WebMVC variant exists — make the
choice explicit rather than presenting WebFlux as the only option.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-what-an-edge-is-for.md` | One place for the things every client needs and no service should repeat |
| 2 | `02-the-artifacts-changed.md` | 🔴 The removal, the four new modules, and how to read a pre-Oakwood tutorial |
| 2b | `02b-webflux-or-webmvc.md` | Netty vs servlet; the runtime constraint that decides it |
| 3 | `03-routes.md` | `id`, `uri`, predicates, filters — the anatomy of one route |
| 3b | `03b-yaml-or-java-dsl.md` | `RouteLocatorBuilder` vs configuration, and when each wins |
| 4 | `04-predicates.md` | Path, Host, Method, Header, Query, Weight — matching order matters |
| 5 | `05-filters.md` | Request and response filters; the `Gateway` filter chain |
| 5b | `05b-global-filters-and-ordering.md` | The order that decides whether auth ran before rewriting |
| 5c | `05c-writing-a-custom-filter.md` | A filter factory, done properly |
| 6 | `06-routing-to-discovered-services.md` | `lb://` URIs and the discovery locator |
| 7 | `07-auth-at-the-edge.md` | Terminating the token once; what is forwarded downstream |
| 7b | `07b-the-gateway-is-not-your-authorization.md` | Why services must still authorize — the confused-deputy risk |
| 8 | `08-rate-limiting.md` | The Redis rate limiter, the key resolver, and what a 429 should say |
| 9 | `09-timeouts-and-circuit-breaking-at-the-edge.md` | Edge timeouts, the CircuitBreaker filter, and the hand-off to phase 16 |
| 10 | `10-no-business-logic-at-the-edge.md` | The filter that grew into a service nobody owns |
| 10b | `10b-bff-instead.md` | Backend-for-frontend as the honest home for client-shaped logic |
| 11 | `11-the-gateway-is-a-single-point-of-failure.md` | Scaling it, deploying it, and what its outage takes down |
| 12 | `12-observability-at-the-edge.md` | The access log you actually want, and correlation (hands off to 10) |
| 13 | `13-the-checklist.md` | Reviewing a proposed route before it ships |

## Verify, do not assume
- ⚠️ 🔴 **Quote every artifact id from the Gateway reference.** One wrong id makes the whole
  page useless, and the ids just changed.
- ⚠️ 🔴 Verify the **current configuration property prefixes**. Oakwood migrated them to match
  the new module names; `spring.cloud.gateway.enabled` was confirmed, but the route/predicate/
  filter prefixes must be read from the reference — **do not carry a pre-Oakwood YAML block**.
- ⚠️ Verify the rate-limiter's current dependency and key-resolver contract.
- ⚠️ **No sandbox.** No gateway logs, no curl transcripts, no latency numbers. YAML and Java only.
