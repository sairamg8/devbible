---
title: "Shaping the JSON"
sidebar_label: "10 · Shaping the JSON"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot 4.1.1 reference *JSON* chapter
> (docs.spring.io — the auto-configured `JsonMapper` bean, the
> `spring.jackson.default-property-inclusion`, `spring.jackson.serialization.*`,
> `spring.jackson.deserialization.*` and `spring.jackson.time-zone` properties,
> `@JacksonComponent` with `ValueSerializer`/`ValueDeserializer` and the
> `ObjectValueSerializer`/`ObjectValueDeserializer` base classes,
> `@JacksonMixin` and `JacksonMixinModule`), the Spring Boot 4.0 migration guide
> (the `Jackson2ObjectMapperBuilderCustomizer` → `JsonMapperBuilderCustomizer`
> rename), and the spring.io blog *Introducing Jackson 3 support in Spring*
> (2025-10-07). Jackson annotations remain in
> `com.fasterxml.jackson.annotation`. Spring Boot 4.1.1, JDK 25.

**Four settings shape the JSON your API emits more than any code you write:
whether nulls appear, what case property names use, how instants are rendered,
and how numbers with decimal places are carried. Leave any of them implicit and
your wire contract is whatever the current library default happens to be — which
[chunk 9](09-jackson-3-what-changed.md) has just demonstrated is a thing that
changes underneath you. These are contract decisions wearing the costume of
configuration.**

## Null inclusion

```yaml
spring:
  jackson:
    default-property-inclusion: non_null   # omit null fields entirely
```

The trade is genuine and not obvious in either direction.

**Including nulls** makes the response self-describing. A client sees every
field the schema defines, and can distinguish "the server sent null" from "this
field does not exist in this version". For anyone debugging by reading a
response, it is far kinder.

**Omitting nulls** produces smaller payloads and avoids a wall of nulls on
sparse objects — but it makes *absent* and *null* indistinguishable to the
client. That is precisely the ambiguity [chunk 6](06-the-absent-field.md) is
about, now pointing outward instead of inward: your client now has the problem
your `PATCH` handler had.

For a typed, generated client, `non_null` is usually right. For an API humans
read, including nulls is better. What matters most is that the answer is the
**same everywhere** — an API that mixes the two across endpoints forces every
consumer to handle both, which is worse than either choice.

## Naming strategy

```yaml
spring:
  jackson:
    property-naming-strategy: SNAKE_CASE
```

Java is `camelCase`; a great many API style guides are `snake_case`. Choose once,
globally, and never per-DTO — a mixed API is a permanent tax on every consumer
and on every piece of documentation.

Where a single field genuinely needs a different wire name, `@JsonProperty` on
that component is the local override and survives the global strategy:

```java
public record Customer(
        String  displayName,                     // → display_name
        @JsonProperty("vat_no") String vatNumber // → vat_no, not vat_number
) { }
```

Note the direction of the coupling: with a global strategy, **renaming a Java
field renames a public JSON property**. That is convenient right up until it is
a breaking change made by an IDE refactor, which is the same hazard
[chunk 3](03-the-named-inputs.md) raised for `@RequestParam` names. For fields
in a published contract, pinning them with `@JsonProperty` is cheap insurance.

## `java.time`, and the formats worth pinning

Jackson 3's defaults are sound — ISO-8601, and `java.time` handled without
registering a module. Two decisions remain yours.

**Which type belongs in the DTO.** An API almost always wants an unambiguous
instant:

```java
public record Invoice(
        Instant issuedAt,                                    // ISO-8601 instant
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate dueOn  // a date, no time
) { }
```

`LocalDateTime` carries no zone, so serialising it publishes a timestamp whose
meaning depends on knowing the server's zone — information no client has and no
schema conveys, which makes every consumer's interpretation a guess. Use
`Instant`, or `OffsetDateTime` where the original offset itself carries meaning.
Reserve `LocalDate` and `LocalTime` for genuinely zoneless concepts: a date of
birth, a shop's opening time, a public holiday.

**Whether to pin the format.** `@JsonFormat` makes the wire representation
explicit rather than inherited, which is worth doing for anything a client
parses with a fixed pattern. `spring.jackson.time-zone` sets the zone used for
formatting where a zone is needed at all — worth setting explicitly to `UTC`
rather than inheriting the host's, so a container's timezone configuration
cannot change your output.

## Money, and why `BigDecimal` is only half the answer

Money is `BigDecimal` or an integer count of minor units, never `double` —
binary floating point cannot represent decimal fractions exactly, which
[Phase 1](../../phase-1-language-core/README.md) covers.

The wire is a **separate decision**, and getting the domain type right does not
settle it. JSON numbers carry no precision guarantee, and JavaScript parses them
as IEEE-754 doubles — so a `BigDecimal` serialised as a bare number has its
precision destroyed in the browser before any client code runs. Correct
server-side arithmetic does not survive a lossy transport.

```java
public record Money(String amount, String currency) { }     // "19.99", "GBP"
public record Money(long amountMinor, String currency) { }  // 1999, "GBP"
```

Both are defensible. The minor-unit form additionally removes every argument
about rounding, at the cost of the client needing to know each currency's
exponent — which is not always 2 (JPY is 0, KWD is 3). The string form is more
immediately readable and is what most payment APIs use.

The bare `BigDecimal` number is the one that quietly loses a penny.

## Gotchas

**Symptom:** monetary amounts are off by fractions of a penny in a browser client, though the server's arithmetic is provably correct
**Cause:** a `BigDecimal` serialised as a bare JSON number, which JavaScript parses as an IEEE-754 double — the precision is gone before any client code runs
**Fix:** serialise money as a string, or as an integer count of minor units with the currency alongside. The domain type being `BigDecimal` does not protect the wire

**Symptom:** a `LocalDateTime` field is interpreted as the wrong moment by clients in other zones
**Cause:** `LocalDateTime` carries no zone, so the value's meaning depends on knowing the server's — which no client does and no schema states
**Fix:** use `Instant` or `OffsetDateTime` in DTOs. Reserve `LocalDate` and `LocalTime` for genuinely zoneless concepts

**Symptom:** timestamps change format or offset after a deployment to a different host or container image
**Cause:** the formatting zone was inherited from the host rather than set, so the JVM's default timezone became part of your wire contract
**Fix:** set `spring.jackson.time-zone: UTC` explicitly, and prefer `Instant` so there is nothing zone-dependent to format in the first place

**Symptom:** an IDE rename of a DTO field silently breaks clients
**Cause:** with a global naming strategy and no `@JsonProperty`, the Java field name *is* the public JSON property name, so a refactor is a breaking API change that compiles cleanly
**Fix:** pin fields that are part of a published contract with `@JsonProperty`, and cover the response shape with a test that asserts on parsed field names rather than on the DTO class

**Symptom:** some endpoints omit null fields and others include them
**Cause:** `@JsonInclude` was applied to individual DTOs at different times rather than a global inclusion policy being chosen
**Fix:** set `spring.jackson.default-property-inclusion` once and remove the per-DTO annotations, keeping them only where a specific payload genuinely differs and the difference is documented

## Interview questions

**★ How would you serialise a monetary amount, and why isn't `BigDecimal` enough?**
`BigDecimal` is the right domain type, because binary floating point cannot
represent decimal fractions exactly and `double` is therefore wrong for money
regardless. But the wire is a separate decision: JSON numbers carry no precision
guarantee and JavaScript parses them as IEEE-754 doubles, so a `BigDecimal`
emitted as a bare number loses precision in the browser before any client code
runs. So I serialise money as a string, or as an integer count of minor units
with the currency alongside. The minor-unit form also removes all rounding
ambiguity, at the cost of the client knowing each currency's exponent — which is
not universally 2, since JPY is 0 and KWD is 3.

**★ `Instant` or `LocalDateTime` in a DTO?**
`Instant`, or `OffsetDateTime` where the original offset itself carries meaning.
`LocalDateTime` has no zone, so serialising it publishes a timestamp whose
meaning depends on knowing the server's zone — information no client has and no
schema conveys, which makes every consumer's interpretation a guess that happens
to be right in development. `LocalDate` and `LocalTime` are correct for
genuinely zoneless concepts such as a date of birth or a shop's opening time,
and those usually deserve an explicit `@JsonFormat` so the representation is
pinned rather than inherited. I would also set `spring.jackson.time-zone` to UTC
explicitly, so a container's timezone cannot become part of the contract.

**★ Include nulls in responses, or omit them?**
It depends on the consumer, and the decision should be global rather than per
endpoint. Including nulls makes the response self-describing — a client sees
every field the schema defines and can distinguish an explicit null from a field
that does not exist in this version. Omitting them with
`default-property-inclusion: non_null` gives smaller payloads and avoids a wall
of nulls on sparse objects, at the cost of making absent and null
indistinguishable — the same ambiguity that makes `PATCH` hard, now pointed at
your client. For a typed generated client I lean to omitting; for an API humans
debug, including is kinder. The genuinely bad outcome is mixing the two across
endpoints, because then every consumer has to handle both.

---

← Prev: [Jackson 3: what changed](09-jackson-3-what-changed.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Customising serialisation](11-customising-serialisation.md)
