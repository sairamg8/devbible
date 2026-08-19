---
title: "API versioning: the mechanism"
sidebar_label: "12 · Versioning mechanism"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0.8 reference,
> *Web MVC → Annotated Controllers → Request Mapping → API Version*
> (docs.spring.io — the `version` attribute, fixed versus baseline `"1.2+"`
> matching, the rule that the highest match closest to the request version wins
> and that unversioned methods have lowest priority) and *Web MVC → MVC Config →
> API Versioning* (the `ApiVersionConfigurer` callback on `WebMvcConfigurer`
> with `useRequestHeader`, `useQueryParam`, `usePathSegment` and
> `useMediaTypeParameter`; `addSupportedVersions`, `setVersionRequired`,
> `setDefaultVersion`, `detectSupportedVersions` (on by default); the default
> semantic version parser with `ApiVersionParser` as the extension point;
> `ApiVersionDeprecationHandler` with a standard implementation setting RFC 9745
> `Deprecation`, RFC 8594 `Sunset` and `Link` headers; and
> `InvalidApiVersionException` producing HTTP 400), plus the Spring Framework
> 7.0 release notes (API versioning as a new first-class feature across MVC,
> WebFlux, `RestClient` and `WebClient`). Spring Boot 4.1.0,
> Spring Framework 7.0.x, JDK 25.

**Spring Framework 7 made API versioning a first-class mapping condition, which
changes the shape of the problem rather than merely automating it. Before 7,
every team invented versioning out of the parts they had — a path prefix, a
`params` condition, a header check in a filter — and each invention was a
private convention the framework knew nothing about. Now the version is a
declared dimension of the mapping alongside path and verb, with its own
resolution strategy, its own precedence rules and its own deprecation headers.
Nothing written before November 2025 describes this.**

## Turning it on

Versioning is off until you say where the version comes from:

```java
@Configuration
class WebConfiguration implements WebMvcConfigurer {

    @Override
    public void configureApiVersioning(ApiVersionConfigurer configurer) {
        configurer.useRequestHeader("API-Version");
    }
}
```

Four resolution strategies are available on `ApiVersionConfigurer`:

| Strategy | Where the version comes from |
|---|---|
| `useRequestHeader(String)` | a dedicated request header |
| `useQueryParam(String)` | a query parameter |
| `usePathSegment(int)` | a path segment — requires a `/{version}` URI variable |
| `useMediaTypeParameter(String)` | a parameter on the media type |

Alongside them:

- **`addSupportedVersions(String...)`** — declare the supported set explicitly.
- **`detectSupportedVersions(boolean)`** — **on by default**: the supported set
  is inferred from the versions actually declared across your request mappings.
- **`setVersionRequired(boolean)`** — whether a request must carry a version.
- **`setDefaultVersion(String)`** — what an unversioned request is treated as.

That `detectSupportedVersions` defaults to *on* is the detail worth noticing:
declaring `version = "1.3"` on a single handler adds 1.3 to the supported set
for the whole application. Convenient, and a real footgun — a half-finished
handler for a version you have not announced makes that version look supported.
Turning detection off and listing versions explicitly is the safer posture for a
public API.

## Declaring versions on handlers

```java
@RestController
@RequestMapping("/account/{id}")
class AccountController {

    @GetMapping
    Account getAccount() { ... }
    // matches ANY version — lowest priority, superseded by any specific match

    @GetMapping(version = "1.1")
    Account getAccount1_1() { ... }
    // 1.1 exactly

    @GetMapping(version = "1.2+")
    Account getAccount1_2() { ... }
    // 1.2 and every supported version above it

    @GetMapping(version = "1.5")
    Account getAccount1_5() { ... }
    // 1.5 exactly
}
```

Three forms and one precedence rule:

- **Fixed** — `"1.2"` matches that version only.
- **Baseline** — `"1.2+"` matches 1.2 and supported versions above it.
- **Absent** — matches any version, but is superseded by any specific match.

**The highest version match closest to the request version wins**, and
unversioned methods have the lowest priority. So with the controller above, a
request for 1.3 lands on `getAccount1_2()` — 1.2+ covers it, and nothing more
specific claims it. A request for 1.5 lands on `getAccount1_5()`, because an
exact match beats a baseline that would also have matched.

This is what the baseline form buys: **you write a handler once and it keeps
serving every later version until something supersedes it.** The alternative —
copying a handler for each version — is how versioned codebases become
unmaintainable, because every bug fix has to be applied N times and nothing
tells you when you missed one.

## Gotchas

**Symptom:** `version = "1.2"` on a handler has no effect and every request reaches it
**Cause:** versioning is not enabled — no `configureApiVersioning` callback declared a resolution strategy, so nothing extracts a version from the request and the condition never participates
**Fix:** implement `WebMvcConfigurer.configureApiVersioning` and call one of `useRequestHeader`, `useQueryParam`, `usePathSegment` or `useMediaTypeParameter`

**Symptom:** a version nobody announced starts being accepted
**Cause:** `detectSupportedVersions` is **on by default**, so the supported set is inferred from the versions declared across your mappings — a half-finished handler annotated with a future version silently added it
**Fix:** call `detectSupportedVersions(false)` and `addSupportedVersions(...)` explicitly for a public API, so the supported set is a deliberate declaration rather than a side effect of what is in the source tree

**Symptom:** a request for 1.5 reaches the handler declared `version = "1.2+"` rather than the one declared `version = "1.5"`
**Cause:** it should not — the highest match closest to the request version wins, and an exact match outranks a baseline. If this is happening, the exact handler differs on another mapping condition, so it never became a candidate
**Fix:** compare the two mappings on path, verb, `consumes` and `produces`, not just on version. A version condition cannot rescue a mapping that failed on something else

## Interview questions

**★ What did Spring Framework 7 change about API versioning?**
It made the version a first-class mapping condition rather than something each
team improvised. Before 7 you built versioning out of whatever was available — a
path prefix, a `params` condition, a header inspected in a filter — and the
framework knew nothing about any of it, so precedence, error handling and
deprecation were all yours to invent. Now the version is a declared dimension of
the mapping alongside path and verb, configured once through
`ApiVersionConfigurer`, with defined precedence rules, a semantic parser, RFC
deprecation headers, and a 400 with `InvalidApiVersionException` for
unsupported versions. It is available across MVC, WebFlux, `RestClient` and
`WebClient`, so a client can declare the version it wants the same way a server
declares what it serves.

**★ Explain fixed versus baseline version mappings and the precedence rule.**
A fixed mapping — `version = "1.2"` — matches that version only. A baseline
mapping — `version = "1.2+"` — matches 1.2 and every supported version above it.
A handler with no version attribute matches any version but has the lowest
priority. The rule is that the highest version match closest to the request
version wins, so given handlers at 1.1, 1.2+ and 1.5, a request for 1.3 reaches
the 1.2+ handler and a request for 1.5 reaches the exact 1.5 handler because an
exact match outranks a baseline that also covers it. The baseline form is the
important one in practice: it lets one handler keep serving every later version
until something supersedes it, which is the main defence against a codebase with
one copy of each handler per version.

**★ What does `detectSupportedVersions` do, and would you leave it on?**
It infers the set of supported versions from the versions actually declared
across your request mappings, and it is **on by default**. For an internal
service that is convenient — the supported set follows the code with no separate
list to maintain. For a public API I would turn it off and use
`addSupportedVersions` explicitly, because otherwise annotating one
half-finished handler with a future version silently announces that version as
supported. Making the supported set a deliberate declaration rather than an
emergent property of the source tree is worth the small amount of duplication.

---

← Prev: [Customising serialisation](11-customising-serialisation.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Versioning strategy and lifecycle](13-versioning-strategy.md)
