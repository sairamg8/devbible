---
title: "JSON with Jackson"
sidebar_label: "05 · JSON with Jackson"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the FasterXML Jackson project documentation
> (github.com/FasterXML/jackson wiki — release lines: **2.22** is the current
> 2.x branch, released 2026-05-31; **3.2** is the current 3.x branch,
> 2026-06-08; 2.21 and 2.18 are the 2.x LTS branches), the jackson-databind
> javadoc (javadoc.io, `ObjectMapper`, `ObjectReader`, `ObjectWriter`), and
> the jackson-databind 2.12 release notes (record support). Pages teach the
> **2.x API** — the line almost every production codebase is on — and name
> where 3.x differs.

**Jackson is the JSON boundary of most Java services — every request body,
every response, every message payload passes through an `ObjectMapper`. The
library rewards exactly one discipline: configure one mapper, share it
everywhere, and make every policy decision — unknown fields, nulls, dates,
polymorphism — *explicit* at that one place. Teams that scatter `new
ObjectMapper()` through the codebase don't have a JSON policy; they have as
many policies as call sites, and the bugs live in the differences.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[One mapper, records in and out](01-objectmapper-and-records.md)** | Why `ObjectMapper` is created once and shared (cost + thread-safety, the builder discipline), `ObjectReader`/`ObjectWriter` for per-call variation, records as DTOs (2.12+), visibility rules, constructor binding with `@JsonCreator`/`@JsonProperty` |
| 2 | **[The policy decisions](02-the-policy-decisions.md)** | Unknown fields (`FAIL_ON_UNKNOWN_PROPERTIES` both ways), null vs absent vs default, `JsonInclude`, `Optional` via `jackson-datatype-jdk8`, `java.time` via `JavaTimeModule`, the annotations that carry weight, generics with `TypeReference` |
| 3 | **[Polymorphism, the three APIs, and failure](03-polymorphism-apis-failure.md)** | `@JsonTypeInfo` and the default-typing CVE history (allow-lists, `PolymorphicTypeValidator`), data binding vs tree model vs streaming, custom (de)serializers, the `JacksonException` taxonomy, what Jackson 3 changes |

## Why this is a Master topic

- **It is the wire format of the job.** REST bodies, Kafka payloads, config
  files, audit events — in a Java service, JSON *is* Jackson, and its
  defaults decide what your API silently accepts and emits.
- **The failure modes are policy, not code.** An extra field that 400s a
  mobile client, a `LocalDate` serialized as `[2026,8,18]`, a null that
  became `0` — every one traces to a mapper decision nobody made on purpose.
- **One of its features is a documented attack surface.** Polymorphic
  deserialization with open typing produced a long CVE series; using
  `@JsonTypeInfo` safely is a security skill, not a convenience.
- **Spring Boot sits on top of it.** **Phase 9 · Spring Boot and the web**
  *(not written yet)* autoconfigures exactly one shared mapper — knowing
  Jackson is knowing what that autoconfiguration decided for you.

## Where this connects

- **[Records](../../phase-2-classes-objects/08-records/README.md)** — the
  DTO carrier this topic serializes; Jackson 2.12+ binds them natively.
- **[Optional](../../phase-4-lambdas-streams/07-optional/README.md)** —
  absent-vs-null at the JSON boundary is the same distinction in wire form.
- **[`java.time` — topic 01](../01-java-time/README.md)** — the types the
  `JavaTimeModule` exists to carry as ISO-8601.

---

← Prev: [`HttpClient`](../04-httpclient.md) · Index: [Phase 7 — I/O, time and the everyday stdlib](../README.md) · Next → [One mapper, records in and out](01-objectmapper-and-records.md)
