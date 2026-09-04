---
title: "Adding springdoc: the version facts that actually matter"
sidebar_label: "4 · Adding springdoc"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against the springdoc-openapi GitHub releases API
> (github.com/springdoc/springdoc-openapi/releases — v3.1.0 published
> 2026-08-01, v3.0.0 published 2025-11-21, v2.9.0 published 2026-08-01), the
> published POMs on Maven Central
> (repo1.maven.org/maven2/org/springdoc/springdoc-openapi/3.1.0/ and
> .../springdoc-openapi-starter-webmvc-ui/3.1.0/), springdoc.org and
> springdoc.org/properties.html. Spring Boot 4.1.1, Spring Framework 7.0.x,
> JDK 25.

**springdoc-openapi is a community project, not a Spring project, and its
compatibility with Spring Boot is therefore something you check rather than
something you assume. Its version line is the whole story: the 1.x line was
Spring Boot 2, the 2.x line was Spring Boot 3 and the Jakarta namespace move,
and the 3.x line is Spring Boot 4. Get the line wrong and you do not get a
gentle warning — you get a context that fails to start, because a library
compiled against a different Spring generation is not a runtime problem you can
configure your way out of.**

## The version facts, established from primary sources

These are read from the springdoc releases API and the published Maven Central
POMs on **2026-08-20**, not from memory:

| Fact | Value | Where it came from |
|---|---|---|
| Current release | **3.1.0**, published **2026-08-01** | the GitHub releases API |
| What 3.1.0 targets | **"Upgrade Spring Boot to version 4.1.0"** | the v3.1.0 release notes |
| Build parent of 3.1.0 | `org.springframework.boot:spring-boot-starter-parent:4.1.0` | the published `springdoc-openapi-3.1.0.pom` |
| When the 3.x line began | **3.0.0**, published **2025-11-21**, notes: **"Upgrade to Spring Boot 4.0.0!"** and "Spring Framework 7 – Initial API versioning support" | the v3.0.0 release notes |
| The maintained Spring Boot 3 line | **2.9.0**, published 2026-08-01, notes: "Upgrade Spring Boot to version 3.5.16" | the v2.9.0 release notes |
| Swagger Core / Swagger UI pinned by 3.1.0 | swagger-core **2.2.52**, swagger-ui **5.32.11** | the 3.1.0 parent POM properties |
| Artifact ids | **unchanged** from the 2.x line — the `springdoc-openapi-starter-*` family | Maven Central listing |

So: **springdoc-openapi 3.1.0 does support Spring Boot 4.1 — it is built against
`spring-boot-starter-parent:4.1.0` — and that is confirmed from the release
notes and the published POM, not inferred.** Its `springdoc-openapi-starter-webmvc-ui`
POM also depends on Boot 4 module artifacts (`spring-boot-starter-webmvc-test`,
`spring-boot-tomcat`, `spring-boot-health`), which is corroborating evidence
that it was compiled against the Boot 4 module layout.

⚠️ **One caution, stated plainly because it is exactly the kind of thing that
misleads.** The project's own `README.md` on `main` still carries the sentence
*"For Spring-boot v4 support, make sure you use springdoc-openapi v2"* and
describes the requirement as "Spring-boot v4 (Java 17 & Jakarta EE 9)" — both of
which are stale leftovers from the Boot 3 era wording (Boot 4 is Jakarta EE 11,
and the v2 line targets Boot 3.5.x). The release notes and the POMs are the
authority; the README paragraph is not. **Check the version on springdoc.org and
on Maven Central before you pin it, because the README has been wrong.**

## Which line to use

| Your Spring Boot | springdoc line | Latest as of 2026-08-20 |
|---|---|---|
| 4.x | **3.x** | 3.1.0 |
| 3.5.x and earlier 3.x | 2.x | 2.9.0 |
| 2.x | 1.x | (legacy, documented at springdoc.org/v1/) |

The 2.x and 3.x lines are released in lockstep — 2.9.0 and 3.1.0 came out on the
same day with substantially the same fixes — so being on the older line is not
being abandoned. It is being on the line for your Boot generation.

## The dependency

```xml
<dependency>
  <groupId>org.springdoc</groupId>
  <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
  <version>3.1.0</version>
</dependency>
```

There is no `@Enable…` annotation and no configuration class. The starter
auto-configures, and the document plus the UI are live.

The family, from Maven Central and the project README:

| Artifact | What it adds |
|---|---|
| `springdoc-openapi-starter-webmvc-api` | the document only — `/v3/api-docs`, no UI |
| `springdoc-openapi-starter-webmvc-ui` | the above **plus** the bundled Swagger UI webjar |
| `springdoc-openapi-starter-webflux-api` | the same, for WebFlux |
| `springdoc-openapi-starter-webflux-ui` | WebFlux plus UI |

🔴 **Prefer `-api` over `-ui` for anything that reaches production.** The `-ui`
starter pulls the `org.webjars:swagger-ui` webjar and `webjars-locator-lite`
onto the classpath and serves a browsable console. If you have decided the
console does not belong in production — and chunk 7 argues it usually does not —
the cleanest way to not ship it is to not put it on the classpath, rather than
to disable it with a property somebody can flip back.

Which starter matters for WebFlux versus MVC is the same split
[topic 15 describes](../15-webflux-reactive/README.md); pick the one matching
the web stack you actually run.

## Where the endpoints live

| Thing | Default path | Property |
|---|---|---|
| OpenAPI document, JSON | `/v3/api-docs` | `springdoc.api-docs.path` |
| OpenAPI document, YAML | `/v3/api-docs.yaml` | (derived from the above) |
| Swagger UI | `/swagger-ui.html` | `springdoc.swagger-ui.path` |
| Swagger UI's own config | `/v3/api-docs/swagger-config` | `springdoc.swagger-ui.configUrl` |

All of these sit under the application's `context-path`, on the **application
port**. They are not Actuator endpoints and they do not move to the management
port by default — a distinction that matters the moment you run Actuator on a
separate port, which **[Topic 13 — Actuator](../13-actuator/README.md)** covers.

## The properties worth knowing on day one

Every default below is quoted from springdoc.org/properties.html as of
2026-08-20.

| Property | Default | What it does |
|---|---|---|
| `springdoc.api-docs.enabled` | `true` | disable the `/v3/api-docs` endpoint entirely |
| `springdoc.api-docs.path` | `/v3/api-docs` | move the document |
| `springdoc.api-docs.version` | `openapi_3_1` | choose OpenAPI 3.0 or 3.1 |
| `springdoc.swagger-ui.enabled` | `true` | disable the UI, keep the document |
| `springdoc.swagger-ui.path` | `/swagger-ui.html` | move the UI |
| `springdoc.packages-to-scan` | `*` | restrict scanning to your own packages |
| `springdoc.paths-to-match` | `/*` | restrict which paths appear |
| `springdoc.show-actuator` | `false` | include Actuator endpoints in the document |
| `springdoc.cache.disabled` | `false` | stop caching the computed document |
| `springdoc.pre-loading-enabled` | `false` | build the document at startup instead of on first request |
| `springdoc.writer-with-order-by-keys` | `false` | emit keys in deterministic alphabetical order |
| `springdoc.use-fqn` | `false` | name schemas by fully-qualified class name |
| `springdoc.auto-tag-classes` | `true` | derive a tag per controller class |
| `springdoc.override-with-generic-response` | `true` | attach `@ControllerAdvice` responses to every operation |
| `springdoc.use-management-port` | `false` | serve the UI on the Actuator management port |
| `springdoc.default-produces-media-type` | `*/*` | the media type assumed when none is declared |

Two of those are not day-one settings but day-one *decisions*:
`writer-with-order-by-keys` and `pre-loading-enabled`. Both are argued for in
chunk 7, because both only matter once the document leaves the developer's
laptop.

## Grouping one service into several documents

A service with an internal admin surface and a public surface should not present
them as one document. `springdoc.group-configs` splits them, and the UI gets a
selector:

```yaml
springdoc:
  group-configs:
    - group: public
      display-name: Orders API
      paths-to-match: /api/**
    - group: admin
      display-name: Admin (internal)
      paths-to-match: /internal/**
```

Each group is served at the api-docs path with the group name appended, and each
can be filtered by `packages-to-scan`, `paths-to-exclude`, `packages-to-exclude`,
`produces-to-match`, `consumes-to-match` and `headers-to-match`. Grouping is the
right tool when the *audiences* differ; it is the wrong tool for hiding one
endpoint, which is `@Hidden` (chunk 6).

## Gotchas

**⚠️ Adding springdoc 2.x to a Spring Boot 4 application**
**Symptom:** the application context fails to start, or a `NoSuchMethodError` /
`NoClassDefFoundError` surfaces from inside springdoc during auto-configuration.
**Cause:** the 2.x line is compiled against Spring Boot 3.5.x; Boot 4 renamed
and re-modularised starters and moved APIs. This is a compile-time mismatch
showing up at class-load time, not something a property can fix.
**Fix:** move to the 3.x line.

```xml
<artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
<version>3.1.0</version>   <!-- 3.x for Boot 4; 2.x is the Boot 3.5 line -->
```

**⚠️ Trusting the project README over the release notes**
**Symptom:** you pin springdoc 2.x for a Boot 4 service because the README told
you to.
**Cause:** the README's compatibility paragraph is stale — it says "For
Spring-boot v4 support, make sure you use springdoc-openapi v2" while every 3.x
release note says the opposite.
**Fix:** check the release notes and the published parent POM, which are
generated from the build and cannot be stale.

**⚠️ Letting Spring Boot's dependency management pick the version**
**Symptom:** a version you did not choose, or none at all.
**Cause:** springdoc is not in Spring Boot's BOM — it is a third-party project.
**Fix:** state the version explicitly, or manage it with your own property so a
single place controls it.

```xml
<properties>
  <springdoc.version>3.1.0</springdoc.version>
</properties>
```

**⚠️ `packages-to-scan` left at `*` in a service with lots of dependencies**
**Symptom:** the document contains endpoints you did not write — from a library,
an error controller, or a framework-supplied handler.
**Cause:** the default scans everything.
**Fix:** name your own packages.

```yaml
springdoc:
  packages-to-scan: com.example.orders.web
  paths-to-match: /api/**
```

**⚠️ Expecting the UI at `/swagger-ui`**
**Symptom:** a 404 at the path everyone remembers.
**Cause:** the documented default is `/swagger-ui.html`; the webjar's own
resources live under `/swagger-ui/`, and the two are not the same path.
**Fix:** use the documented default, or set it explicitly so nobody has to
remember.

```yaml
springdoc:
  swagger-ui:
    path: /swagger-ui.html
```

## Interview questions

**★ Which springdoc version works with Spring Boot 4, and how would you find out?**
The 3.x line — 3.1.0 as of August 2026, which its own release notes describe as
upgrading to Spring Boot 4.1.0 and whose published parent POM is
`spring-boot-starter-parent:4.1.0`. The way to find out is the release notes and
the POM on Maven Central, not the README and not a blog post. springdoc is a
community project outside Spring's release train, so its compatibility is a fact
to look up per release rather than something the Boot BOM guarantees.

**★ What actually happens if you use the wrong springdoc line?**
The application fails to start, typically with a `NoClassDefFoundError` or
`NoSuchMethodError` raised during auto-configuration. A library compiled against
a different Spring generation is referencing classes and method signatures that
no longer exist. There is no property, no exclusion and no shim that fixes it —
the only fix is the matching line.

**★ Why prefer the `-api` starter over the `-ui` starter?**
Because the `-ui` starter puts Swagger UI on the classpath, and the most
reliable way to not serve a browsable API console in production is for it not to
be there. Disabling it with `springdoc.swagger-ui.enabled=false` works, but it is
a property somebody can override with an environment variable; a missing
dependency is not.

**★ Your service has a public API and an internal admin API. How do you document them?**
As two groups, via `springdoc.group-configs`, each filtered by
`paths-to-match` or `packages-to-scan`. That produces two documents from one
application, so the public one can be published to consumers without leaking the
existence of the internal surface. Hiding a handful of operations is a different
problem and uses `@Hidden`; different audiences is what grouping is for.

**★ Are the springdoc endpoints Actuator endpoints?**
No. `/v3/api-docs` and the Swagger UI are ordinary web endpoints on the
application port and are unaffected by `management.endpoints.web.exposure`.
There is a `springdoc.use-management-port` property to move the UI onto the
management port if you want it there, but the default is that they are part of
your application's public surface — which is precisely why they need a security
decision of their own.

---

← Prev: [Generated or authored](03-generated-or-authored.md) · Index: [OpenAPI with springdoc](README.md) · Next → [What it infers for free](05-what-it-infers.md)
