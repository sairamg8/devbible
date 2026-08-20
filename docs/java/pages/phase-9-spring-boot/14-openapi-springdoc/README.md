---
title: "OpenAPI with springdoc"
sidebar_label: "14 · OpenAPI with springdoc"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against springdoc.org (index, `properties.html`,
> `faq.html`), the springdoc-openapi GitHub releases API — **v3.1.0 published
> 2026-08-01** ("Upgrade Spring Boot to version 4.1.0"), **v3.0.0 published
> 2025-11-21** ("Upgrade to Spring Boot 4.0.0!"), v2.9.0 published 2026-08-01
> (Spring Boot 3.5.16) — the published Maven Central POMs for
> `org.springdoc:springdoc-openapi:3.1.0` (parent
> `spring-boot-starter-parent:4.1.0`) and
> `springdoc-openapi-starter-webmvc-ui:3.1.0`, the OpenAPI Specification
> **v3.1.1** (24 October 2024) and **v3.2.0** (19 September 2025) at
> spec.openapis.org, the published `swagger-annotations-jakarta` and
> `swagger-core-jakarta` **2.2.52** artifacts, the springdoc-openapi-maven-plugin
> README (release **1.5**), and OpenAPI Generator's typescript-fetch generator
> documentation (`openapi-generator-maven-plugin` **7.24.0**). Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**Your frontend has a contract with your service whether or not you wrote one
down. The only question is where it lives: in a wiki page that was true once, in
the head of the developer who built both sides, or in a machine-readable
document that other programs can act on. springdoc gives you the third for the
price of one dependency — and then hands you a bill you were not expecting,
because a document generated from your code makes your class names, your method
names and your annotation habits part of what consumers depend on. This topic is
about collecting the benefit and understanding the bill: what OpenAPI actually
is, which springdoc line works with Spring Boot 4, what the library infers for
free from a controller you have already written, the handful of annotations that
earn their place, how to describe the failures and the authentication, why
Swagger UI usually does not belong in production, and how the document becomes a
build artifact and then a typed client.**

## The chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What OpenAPI is](01-what-openapi-is.md)** | What is actually in the document, and why "machine-readable" is the load-bearing word — the six things you can attach to a file and cannot attach to prose |
| 2 | **[What 3.1 changed](02-what-3-1-changed.md)** | The Schema Object becoming a superset of JSON Schema 2020-12, the keywords that changed spelling and now fail silently, and why 3.2.0 exists but you are not emitting it |
| 3 | **[Generated or authored](03-generated-or-authored.md)** | The three routes and their real costs — generation cannot drift but leaks your implementation names; contract-first is stable but only enforced if you implement the generated interfaces |
| 4 | **[Adding springdoc](04-adding-springdoc.md)** | 🔴 The version facts, from the release notes and the published POMs: 3.x is the Spring Boot 4 line, 3.1.0 builds against `spring-boot-starter-parent:4.1.0`, and the project README is stale |
| 5 | **[What it infers for free](05-what-it-infers.md)** | Everything a conventional controller already says, Bean Validation constraints becoming schema constraints, the `-parameters` flag, `Pageable`, and where inference stops |
| 6 | **[The annotations](06-the-annotations.md)** | The seven that earn their place, why they are Swagger Core annotations rather than Spring ones, and the `OpenAPI` bean for everything above the paths |
| 7 | **[Documenting the failures](07-documenting-the-failures.md)** | `@ApiResponse`, `override-with-generic-response`, `application/problem+json`, and why a schema of `ProblemDetail` omits exactly the fields the frontend needs |
| 8 | **[Security and lockdown](08-security-and-lockdown.md)** | Describing a bearer-JWT scheme, permitting the doc paths under Spring Security, and the production decision that is the same problem as Actuator exposure |
| 9 | **[Capturing the document](09-capturing-the-document.md)** | The Maven plugin, `attachArtifact`, deterministic ordering so a CI diff is readable, and what `pre-loading-enabled` costs |
| 10 | **[The typed client](10-the-typed-client.md)** | OpenAPI Generator, what each earlier decision becomes in the generated TypeScript, and the 3.1-compatibility caveat to check before you rely on it |

## Why this runs to ten files

- **The specification and its versions are two different subjects.** Chunk 1 is
  about what a description *is* and what it buys; chunk 2 is about the fact that
  3.1 redefined the vocabulary and 3.2 exists. Merging them buries the version
  argument under an introduction, and the version argument is the one that
  produces silent failures — an unrecognised keyword in JSON Schema is an
  annotation, not an error.
- **The springdoc version question is the one most likely to be answered
  wrongly, so it gets its own chunk with its sources named.** springdoc is a
  community project outside Spring's release train; its Boot compatibility is a
  fact to look up per release, and its own `README.md` currently contradicts its
  release notes. A page that asserted a version without saying where the number
  came from would be the exact failure this topic is meant to prevent.
- **Generated versus contract-first is a real argument, not a preamble.** Most
  teams never make the choice consciously and then live with the consequence for
  years. Compressing it into a paragraph would leave the reader with a library
  and no basis for deciding whether they want what it does.
- **Inference and annotation are opposite halves and get separate chunks.** One
  is about what you get without doing anything; the other is about the small
  number of things worth doing. Merging them produces the annotate-everything
  habit this topic argues against.
- **Errors and security each fail in their own specific way.** The error chunk
  exists because `ProblemDetail`'s extension members defeat schema generation —
  a concrete trap with a concrete fix. The security chunk exists because two
  unrelated problems share a word, and conflating them is how a browsable
  console of every internal endpoint ends up on the public internet.
- **Capturing the document and generating a client are separate concerns with
  separate tooling.** The first is a Maven plugin, a determinism property and a
  CI diff; the second is a different plugin, a different failure mode and a
  compatibility caveat that has to be stated cautiously because the
  documentation does not settle it.

## Where this connects

- **[Topic 07 — REST controllers](../07-rest-controllers/README.md)** — every
  mapping and binding annotation this topic reads. Chunk 4 is that page seen
  from the document's side, and the `-parameters` requirement,
  [records as DTOs](../07-rest-controllers/05-records-as-dtos.md),
  [collection shapes](../07-rest-controllers/08-collections-and-hypermedia.md)
  and [where an API version lives](../07-rest-controllers/13-versioning-strategy.md)
  all have consequences here.
- **[Topic 08 — Validation](../08-validation/README.md)** — the
  [constraint catalogue](../08-validation/02-the-constraints.md) whose
  annotations become schema constraints. 🔴 The
  strongest argument for validating at the boundary is in chunk 5: an
  unvalidated DTO produces a contract that promises nothing.
- **[Topic 09 — Error handling](../09-error-handling/06-problemdetail-and-rfc-9457.md)**
  — the `ProblemDetail` body chunk 7 has to describe, and
  [the extension members](../09-error-handling/07-extension-members.md) that
  make describing it awkward.
- **[Topic 11 — Spring Security](../11-spring-security/README.md)** — the
  [JWT resource server](../11-spring-security/09-jwt-resource-server.md) chunk 8
  describes, the [filter chains](../11-spring-security/06-matchers-and-multiple-chains.md)
  that must permit the doc paths, and the
  [CORS setup](../11-spring-security/12-cors-for-an-spa.md) an externally-hosted
  UI needs.
- **[Topic 06 — Configuration and profiles](../06-configuration-and-profiles/01-the-environment-and-precedence.md)**
  — every `springdoc.*` setting is an ordinary `Environment` property, which is
  why a property is a weaker production control than a missing dependency.
- **[Topic 13 — Actuator](../13-actuator/README.md)** — the same exposure question asked
  about a different surface. Chunk 7 argues the two decisions belong together.
- **[Topic 15 — WebFlux and reactive](../15-webflux-reactive/README.md)** —
  which starter you pick (`-webmvc-*` or `-webflux-*`) follows the web stack you
  actually run.
- **[Records](../../phase-2-classes-objects/08-records/README.md)** — the
  language feature that makes a DTO generate a clean schema, and whose absence
  is why `Map<String, Object>` generates nothing useful.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [What OpenAPI is](01-what-openapi-is.md)
