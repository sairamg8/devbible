---
title: "The resource-server starter configures two beans and one filter chain, and every defect in this topic comes from believing it configured more — the audience it does not check, the validators it silently replaces, the matcher order it obeys and the startup coupling it does not create"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Spring Security 7.x reference — *OAuth 2.0 Resource
> Server / JWT*, *OAuth 2.0 Changes* migration guide — and the 7.0.x sources for
> `NimbusJwtDecoder`, `JwtValidators`, `JwtTypeValidator`, `JwtIssuerValidator`,
> `JwtTimestampValidator`, `BearerTokenAuthenticationFilter`,
> `DefaultBearerTokenResolver`, `JwtAuthenticationProvider`, `JwtAuthenticationConverter`
> ([docs.spring.io/spring-security](https://docs.spring.io/spring-security/reference/));
> Spring Boot 4.1.0 `OAuth2ResourceServerProperties` and its auto-configuration
> ([docs.spring.io/spring-boot](https://docs.spring.io/spring-boot/reference/));
> RFC 6750 §2 (Authenticated Requests), §3 (`WWW-Authenticate`)
> ([rfc-editor.org/rfc/rfc6750](https://www.rfc-editor.org/rfc/rfc6750.txt)); RFC 8414 (AS
> metadata) ([datatracker.ietf.org/doc/html/rfc8414](https://datatracker.ietf.org/doc/html/rfc8414));
> RFC 9068 §4 ([rfc-editor.org/rfc/rfc9068](https://www.rfc-editor.org/rfc/rfc9068.txt));
> RFC 8725 §3.9 ([datatracker.ietf.org/doc/html/rfc8725](https://datatracker.ietf.org/doc/html/rfc8725)).
> Target: **JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x**.
> **No sandbox** — Java source, YAML/properties config and quoted javadoc only; no HTTP
> transcripts, no real tokens, no real JWKS.

**One property, `spring.security.oauth2.resourceserver.jwt.issuer-uri`, turns a Spring Boot
application into a resource server. That single line is why this topic is dangerous: it
produces something that works, on the first try, while leaving four decisions unmade that
nobody will surface until an incident. It does not validate the audience. It does not fail
fast when the authorization server is unreachable. It accepts exactly one signature
algorithm. And the moment you add one custom validator with `setJwtValidator`, it silently
stops running the three it shipped with.**

The organising idea is to know exactly where the boundary of the auto-configuration is.
`issuer-uri` is not a URL keys are fetched from — it is a **claim asserted about every token**
plus a **three-way probe for a metadata document**, and conflating those two roles is why the
same value works in staging and 401s in production. The filter chain is one
`SecurityFilterChain` bean in a DSL where `and()` no longer exists. The request path is seven
objects between the `Authorization` header and the `SecurityContext`, and knowing which one
you are in is the difference between fixing a converter and rewriting a config you did not
need to touch.

**14 chunks, ~3,452 lines.** Read 01, then 02 and 04 — those three are the shape of the whole
topic.

## Chunks

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[What the starter gives you](01-what-the-starter-gives-you.md)** | <span className="db-tier t-master">Master</span> | 🔴 Two beans and one filter chain — believing it configures more is the most expensive misunderstanding in the topic |
| 2 | **[`issuer-uri`](02-issuer-uri.md)** | <span className="db-tier t-master">Master</span> | Not a URL you fetch keys from: a claim asserted about every token *plus* a three-way metadata probe |
| 3 | **[`jwk-set-uri` and static keys](02b-jwk-set-uri-and-static-keys.md)** | <span className="db-tier t-master">Master</span> | Four ways to say where the keys are, trading rotation against startup independence — one quietly requires a single algorithm |
| 4 | **[Trusted algorithms](02c-trusted-algorithms.md)** | <span className="db-tier t-master">Master</span> | The decoder trusts exactly one signature algorithm until told otherwise; every widening is a decision you must justify |
| 5 | **[Startup coupling](03-startup-coupling.md)** | <span className="db-tier t-master">Master</span> | `issuer-uri` does *not* make the service refuse to start when the AS is down — and the ways teams undo that deferral are all their own code |
| 6 | **[Timeouts and the JWK cache](03b-timeouts-and-the-jwk-cache.md)** | <span className="db-tier t-master">Master</span> | Thirty seconds and five minutes are the two numbers you ship with; changing either without deleting your validators needs a customizer nobody knows exists |
| 7 | **[The filter chain](04-the-filter-chain.md)** | <span className="db-tier t-master">Master</span> | One bean, a DSL where `and()` is gone, and four things `oauth2ResourceServer` does before the first request |
| 8 | **[Matcher and chain order](04b-matcher-order.md)** | <span className="db-tier t-master">Master</span> | 🔴 Two levels of first-match: a `permitAll` at the top and a missing catch-all chain open a resource server without one error |
| 9 | **[`STATELESS`, CSRF and CORS](04c-stateless-csrf-cors.md)** | <span className="db-tier t-master">Master</span> | Three decisions that look like boilerplate — and the one place the framework is already right and the internet tells you to undo it |
| 10 | **[The request path](05-the-request-path.md)** | <span className="db-tier t-master">Master</span> | One request, seven objects — the only way to know which component to fix, plus the authority Spring Security 7 adds at the last hop |
| 11 | **[Bearer token resolution](05b-bearer-token-resolution.md)** | <span className="db-tier t-master">Master</span> | A regex and two switches that default to off, because RFC 6750 §2 spends most of its length explaining why |
| 12 | **[Alternative token transports](05c-alternative-token-transports.md)** | <span className="db-tier t-master">Master</span> | Form field, query string, custom header — and the ten-line custom resolver that undoes why bearer tokens needed no CSRF |
| 13 | **[The default validators](06-the-default-validators.md)** | <span className="db-tier t-master">Master</span> | 🔴 Three in Spring Security 7, not two — every page listing `exp`/`nbf`/`iss` describes a version you are not running |
| 14 | **[Composing validators](06b-composing-validators.md)** | <span className="db-tier t-master">Master</span> | 🔴 `setJwtValidator` **replaces**, so adding one check silently removes three; `createDefaultWithValidators` exists for exactly this |

## The six things this topic is really about

**1 · Know the boundary of the auto-configuration.** The starter gives you a `JwtDecoder` and
a default `SecurityFilterChain`, and that is the whole list. Authority mapping, audience
validation, method security, error-response shaping, multi-tenancy and outbound client
support are all *not* configured. Every one of them is a thing teams assume is handled.

**2 · `issuer-uri` wears two hats and they fail differently.** As a *claim*, it is the exact
string every token's `iss` must equal — a trailing slash, `http` vs `https`, or an internal
hostname makes a correctly-signed token fail. As a *probe*, it is a base URL Spring tries in
up to three metadata layouts to find `/.well-known/openid-configuration` or the RFC 8414
equivalent. A value that satisfies the probe from inside your cluster may not equal the `iss`
your AS actually stamps — that is the staging-works-production-401 story.

**3 · Nothing fails fast, and that is deliberate.** Discovery is deferred to the first
request, so a resource server starts happily with its authorization server down. Teams undo
this by touching the decoder in a `@PostConstruct` or an eager `@Bean` method — always their
own code, never the framework's. Whether you *want* fail-fast is a real decision; chunk 05
makes it one rather than an accident.

**4 · `setJwtValidator` replaces the whole chain.** This is the single highest-yield fact in
the topic. Adding an audience check with `decoder.setJwtValidator(new JwtAudienceValidator(...))`
removes issuer, timestamp and type validation in one line, and nothing warns you: tokens
still verify, expiry silently stops being checked. `JwtValidators.createDefaultWithValidators(...)`
merges instead of replacing, adding each standard validator only where you did not supply one
of that type.

**5 · Both matcher levels are first-match, and the failure is silent.** Which
`SecurityFilterChain` runs is decided by the first matching `securityMatcher` across ordered
chains; which rule wins inside it is decided by the first matching
`authorizeHttpRequests` entry. A `permitAll()` placed above a specific rule wins. A chain
whose matcher is narrower than intended lets requests fall to a chain that permits them. No
exception, no log line — just an open endpoint.

**6 · The defaults changed in Spring Security 7 and most published material has not caught
up.** The default validator set is now three, not two, and includes a `typ` check that
rejects RFC 9068's mandated `at+jwt`. Chunk 13 lists what actually runs; the `typ` mechanism
itself is [06 · The Spring 7 `typ` collision](../06-jwt-anatomy-and-validation/03c-the-spring-7-typ-collision.md).

## Still owed in this topic

Named in the prose of chunks 01, 02, 02c, 03, 04, 05, 06 and 06b and not written yet. The
configuration surface is covered; the mapping, error and multi-tenancy surfaces are not.

- **06c · Audience** *(not written yet)* · **06d · A validator bean** *(not written yet)* ·
  **06e · Clock skew and the missing `exp`** *(not written yet)* · **06f · RFC 9068
  validation** *(not written yet)*.
- **07 · Authorities mapping** *(not written yet)*, with **07b · The converters**,
  **07c · Authorities by property** and **07e · Roles are not scopes** *(none written yet)* —
  `JwtAuthenticationConverter`, the `SCOPE_` prefix, and the Keycloak `realm_access.roles`
  converter.
- **08 · Opaque token introspection** *(not written yet)* — RFC 7662 as an alternative to
  local validation.
- **09 · Multi-tenancy** *(not written yet)* and **09b · Dynamic tenants and mixed token
  formats** *(not written yet)* — `fromTrustedIssuers(...)` and the tenant resolver.
- **10 · Error responses** *(not written yet)*, **10b · What not to leak** *(not written
  yet)*, **10c · Protected resource metadata** *(not written yet)*.
- **12 · Actuator and the resource server** *(not written yet)*.

## Phase gate

You are done with this topic when you can write a resource-server configuration from an empty
file, say which claims it validates and which it does not, explain why adding one validator
removes three, and name the two places a first-match rule can silently open an endpoint.

## Where this connects

- **06 · JWT anatomy and validation** — the wire format and the validation algorithm this
  topic configures.
- **05 · The three tokens** — why a refresh token must never reach the component configured
  here.
- [03 · Authorization code + PKCE](../03-authorization-code-pkce/README.md) — how the token
  arriving at this server was obtained.
- [Phase 9 · Spring Boot, topic 11](../../phase-9-spring-boot/README.md) — the same
  configuration seen from the framework side rather than the protocol side.

---

Start → [What the starter gives you](01-what-the-starter-gives-you.md)
