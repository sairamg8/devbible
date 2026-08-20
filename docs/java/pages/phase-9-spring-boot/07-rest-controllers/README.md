---
title: "REST controllers"
sidebar_label: "07 · REST controllers"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Annotated
> Controllers*, *Mapping Requests*, *Handler Methods*, *Method Arguments*,
> *Responses* and *API Versioning*
> (docs.spring.io/spring-framework/reference/web/webmvc.html) — the Spring Boot
> reference *JSON* section, and the Spring Boot 4.0 release notes for the move
> to **Jackson 3** and the `spring-boot-starter-webmvc` rename. Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**A REST controller is two independent stages wearing one annotation. First the
request is *mapped* — narrowed by path, method, content type, headers and now
version, until exactly one handler matches or you get a 404, 405, 415 or 406.
Only then are the method's arguments *resolved*, by a separate chain of
resolvers that will happily fall back to a guess when you forget an annotation.
Nearly every controller bug is one stage being blamed for the other's
behaviour: a mapping you thought was narrower than it is, or a parameter that
bound from the query string when you meant the body. And every decision you make
here — the status code, the list wrapper, the JSON field naming, where the
version lives — is a decision your clients will hold you to for years.**

This topic runs to thirteen files. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The controller and the pipeline](01-the-controller-and-the-pipeline.md)** | What `@RestController` actually composes, the path a request takes as far as a controller author needs it, the shortcut mappings, and `PathPattern` replacing `AntPathMatcher` |
| 2 | **[Narrowing the match: media types and conditions](02-narrowing-the-match.md)** | `consumes` and `produces` as *conditions* not descriptions, the method-level override trap, `params`/`headers`, and choosing deliberately between 404, 405, 415 and 406 |
| 3 | **[Binding the named inputs](03-the-named-inputs.md)** | `@PathVariable`, `@RequestParam`, `@RequestHeader`, `@CookieValue`; `required`, `defaultValue` and `Optional`; and the `-parameters` compiler flag that must be on |
| 4 | **[Binding the body, and the fallback that bites](04-binding-the-body.md)** | `@RequestBody` as the only resolver that reads the entity body, the silent fallback rule that produces no exception and no log line, multipart, and where `BindingResult` must sit |
| 5 | **[Records as DTOs](05-records-as-dtos.md)** | Why a record is the right shape for a body, how Jackson 3 binds one, validation on records, and never returning persistence entities |
| 6 | **[The absent field, and why `PATCH` is hard](06-the-absent-field.md)** | Absent, `null` and default collapsing into one indistinguishable case; what the RFCs actually say; and the three honest options with their costs |
| 7 | **[The response: status codes chosen on purpose](07-the-response.md)** | `ResponseEntity` vs `@ResponseStatus`, the codes worth choosing deliberately, and `ETag`/`If-Match` for optimistic concurrency |
| 8 | **[Collections, pagination and hypermedia](08-collections-and-hypermedia.md)** | Why a bare JSON array is the least reversible mistake in an API, offset vs cursor paging, why the total count is not free, and where HATEOAS fits |
| 9 | **[Jackson 3: what changed on the wire](09-jackson-3-what-changed.md)** | The package and builder renames, and the two default changes that alter your responses without you touching code |
| 10 | **[Shaping the JSON](10-shaping-the-json.md)** | Null inclusion, naming strategy, `java.time` formats worth pinning, and why `BigDecimal` is only half the answer for money |
| 11 | **[Customising serialisation](11-customising-serialisation.md)** | The three levels in order of preference — `JsonMapperBuilderCustomizer`, `@JacksonComponent`, `@JacksonMixin` — and why defining your own `JsonMapper` bean is the wrong move |
| 12 | **[API versioning: the mechanism](12-api-versioning.md)** | Framework 7's first-class version condition — turning it on, and declaring versions on handlers |
| 13 | **[Versioning strategy and lifecycle](13-versioning-strategy.md)** | Where the version should live, version formats, deprecating a version properly, and the cost you pay forever |

## Why this runs to thirteen files

- **Mapping and binding are separate stages and confusing them is the topic's
  central bug.** Chunks 1–2 are entirely about *which handler runs*; chunks 3–6
  are entirely about *what its parameters receive*. A reader who keeps those
  apart can diagnose almost anything; a reader who does not will keep adding
  annotations until something works.
- **The body deserves four chunks because the failure modes are silent.** A
  missing `@RequestBody` binds successfully to an empty object. A record
  component is never absent. `PATCH` has no correct implementation, only three
  defensible ones. None of these throws, so none of them is discovered by
  testing the happy path.
- **Jackson 3 is a Boot 4 breaking change that shows up on the wire.** It is not
  a footnote you can attach to the DTO chunk — the package moved, the builder
  customiser is renamed, `@JsonComponent` is now `@JacksonComponent`, and two
  defaults changed. Anyone reading a pre-2026 tutorial alongside these pages
  needs it stated once, in its own place.
- **API versioning is new in Framework 7 and splits cleanly in two.** The
  mechanism is small and mechanical; the strategy is a long-lived contract
  decision with no reversible answer. Merging them buries the argument under the
  syntax.
- **The response shape chunks are the ones a reader will come back to.** Status
  codes and list wrappers are decided once per API and regretted for years,
  which is why they get argument rather than a table.

## Where this connects

- **[Topic 01 — Why frameworks: the servlet model](../01-why-frameworks-servlet-model/README.md)**
  — `DispatcherServlet`, `HandlerMapping` and the thread your controller method
  runs on. Chunk 1 assumes that picture.
- **[Topic 02 — The IoC container](../02-the-ioc-container/README.md)** and
  **[Topic 03 — Dependency injection](../03-dependency-injection/README.md)** —
  a controller is an ordinary singleton bean, which is exactly why it must be
  stateless.
- **[Topic 06 — Configuration and profiles](../06-configuration-and-profiles/01-the-environment-and-precedence.md)**
  — the JSON and mapping properties in chunks 10 and 12 are `Environment`
  properties like any other.
- **[Topic 08 — Validation](../08-validation/README.md)** — `@Valid` sits on the
  `@RequestBody` parameter chunk 4 describes; that topic owns the constraint
  set and the custom validators.
- **[Topic 09 — Error handling](../09-error-handling/README.md)** — chunk 7 chooses the status
  codes; that topic owns the single error body shape every failure returns.
- **[Records](../../phase-2-classes-objects/08-records/README.md)** and
  **[Immutable design](../../phase-2-classes-objects/12-immutable-design/README.md)**
  — chunks 5 and 6 are those language pages applied at a network boundary, and
  the "a component always has a value" fact is a record fact, not a Spring one.
- **[Jackson](../../phase-7-io-time-stdlib/05-json-jackson/README.md)** — the
  library itself, independent of Spring. Chunks 9–11 are what Boot auto-wires
  on top of it.
- **[`java.time`](../../phase-7-io-time-stdlib/01-java-time/README.md)** — the
  types chunk 10 pins formats for.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The controller and the pipeline](01-the-controller-and-the-pipeline.md)
