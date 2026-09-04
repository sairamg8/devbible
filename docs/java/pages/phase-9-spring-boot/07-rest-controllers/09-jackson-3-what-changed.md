---
title: "Jackson 3: what changed on the wire"
sidebar_label: "9 · Jackson 3 changes"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the spring.io blog *Introducing Jackson 3 support
> in Spring* (2025-10-07 — the `com.fasterxml.jackson` → `tools.jackson` package
> move with `jackson-annotations` deliberately unchanged, immutable `JsonMapper`
> extending `ObjectMapper`, `Jackson2ObjectMapperBuilder` withdrawn in favour of
> Jackson's own `JsonMapper.Builder`, `JacksonJsonHttpMessageConverter`
> replacing `MappingJackson2HttpMessageConverter` and implementing
> `SmartHttpMessageConverter`, and the changed defaults
> `WRITE_DATES_AS_TIMESTAMPS=false` and `SORT_PROPERTIES_ALPHABETICALLY=true`),
> the Spring Boot 4.1.1 reference *JSON* chapter (docs.spring.io — the
> auto-configured `JsonMapper` bean, `spring.jackson.*` properties,
> `@JacksonComponent`, `@JacksonMixin`, `JacksonMixinModule`, the
> `spring.http.converters.preferred-json-mapper` escape hatch, and Jackson 2
> support being deprecated for removal in a later 4.x), and the Spring Boot 4.0
> migration guide (the `spring.jackson.read/write` → `spring.jackson.json.read/write`
> move and the `Jackson2ObjectMapperBuilderCustomizer` →
> `JsonMapperBuilderCustomizer` rename). Spring Boot 4.1.1, JDK 25.

**Spring Boot 4 changed the JSON library underneath every REST controller, and
two of Jackson 3's new defaults are visible on the wire. Dates now serialise as
ISO-8601 strings rather than numeric timestamps, and properties now come out in
alphabetical order rather than declaration order. Neither breaks a
specification-conformant client, and both will break somebody's client — which
makes this the one part of a Boot 3 to Boot 4 upgrade that is a *contract*
change rather than a code change.**

## What actually changed

| | Jackson 2 / Boot 3 | Jackson 3 / Boot 4 |
|---|---|---|
| Package | `com.fasterxml.jackson.*` | **`tools.jackson.*`** |
| Annotations package | `com.fasterxml.jackson.annotation` | **unchanged** — deliberately |
| Entry point | mutable `ObjectMapper` | immutable **`JsonMapper`** (extends `ObjectMapper`) |
| Spring builder | `Jackson2ObjectMapperBuilder` | withdrawn — use `JsonMapper.Builder` |
| Boot customizer | `Jackson2ObjectMapperBuilderCustomizer` | **`JsonMapperBuilderCustomizer`** |
| MVC converter | `MappingJackson2HttpMessageConverter` | **`JacksonJsonHttpMessageConverter`** |
| Custom ser/deser base | `JsonSerializer` / `JsonDeserializer` | **`ValueSerializer`** / **`ValueDeserializer`** |
| Boot annotations | `@JsonComponent` / `@JsonMixin` | **`@JacksonComponent`** / **`@JacksonMixin`** |
| Dates | epoch numbers by default | **ISO-8601 strings by default** |
| Property order | declaration order | **alphabetical by default** |

That the **annotations package is unchanged** is the single most useful fact
here: `@JsonProperty`, `@JsonIgnore`, `@JsonFormat` and the rest are still
`com.fasterxml.jackson.annotation`, so annotated DTOs migrate untouched. It is
the programmatic API — mappers, serialisers, modules — that moved.

## 🔴 The two default changes that are visible on the wire

### Dates are ISO-8601 now

`WRITE_DATES_AS_TIMESTAMPS` defaults to **`false`** in Jackson 3. A
`java.time.Instant` that used to serialise as a number now serialises as a
string:

```
Boot 3 / Jackson 2 default:   "createdAt": 1755561600.000000000
Boot 4 / Jackson 3 default:   "createdAt": "2026-08-19T00:00:00Z"
```

This is the better default and it is what most APIs configured by hand anyway.
It is still a wire change: a client parsing that field as a number now receives a
string and fails.

It also means the long-standing advice to register `JavaTimeModule` and disable
`WRITE_DATES_AS_TIMESTAMPS` is obsolete under Boot 4 — the auto-configured
`JsonMapper` handles `java.time` types out of the box.

### Properties are sorted alphabetically now

`SORT_PROPERTIES_ALPHABETICALLY` defaults to **`true`**. Field order in the JSON
output is no longer the order the components are declared in.

By the JSON specification, object member order is not significant, so no
conformant client should care. In practice two things do care:

- **Tests that assert on an exact JSON string.** These break, and the fix is to
  compare parsed structures instead — which they should have been doing.
- **Anything computing a hash or a signature over the serialised bytes.** A
  webhook payload signature, a cached-response `ETag` derived from the body, a
  stored document compared byte-for-byte. These break *silently* in the sense
  that the code still runs; it just stops matching.

The second category is the one that bites, because nothing about the failure
points at property ordering.

### The escape hatch, and when to use it

```yaml
spring:
  jackson:
    use-jackson2-defaults: true   # aligns defaults with Jackson 2 in Boot 3
```

This exists for exactly this problem: it makes the auto-configured `JsonMapper`
behave as closely as possible to Boot 3's. It is a **migration aid, not a
destination** — Jackson 2 support is deprecated and slated for removal in a
later Boot 4.x, so treat this flag as a dated ticket rather than a setting.

Where only one behaviour matters, set that one rather than reverting everything:

```yaml
spring:
  jackson:
    serialization:
      sort-properties-alphabetically: false
```

## Gotchas

**Symptom:** after upgrading to Boot 4, a client fails parsing a timestamp field that used to be a number
**Cause:** Jackson 3 defaults `WRITE_DATES_AS_TIMESTAMPS` to `false`, so dates now serialise as ISO-8601 strings
**Fix:** the right long-term answer is to update the client, since ISO-8601 is the better contract. To buy time, set `spring.jackson.serialization.write-dates-as-timestamps: true` — narrowly, rather than reverting every default with `use-jackson2-defaults`

**Symptom:** webhook signature verification starts failing after a Boot 4 upgrade, with no code change and no error
**Cause:** `SORT_PROPERTIES_ALPHABETICALLY` now defaults to `true`, so the serialised bytes changed. Anything hashing or signing the body no longer matches
**Fix:** pin the ordering where bytes are load-bearing — `spring.jackson.serialization.sort-properties-alphabetically: false`, or `@JsonPropertyOrder` on the specific payload type. This is the failure worth searching for proactively during an upgrade, because nothing about it points at property ordering

**Symptom:** tests comparing the response to an exact JSON string break wholesale
**Cause:** the same ordering change
**Fix:** compare parsed structures rather than strings. The tests were asserting on something the JSON specification says is insignificant, so this is a latent defect the upgrade surfaced rather than caused

**Symptom:** a custom serialiser compiles against `JsonSerializer` and no longer resolves after the upgrade
**Cause:** Jackson 3 renamed the base types to `ValueSerializer` and `ValueDeserializer`, and moved the package from `com.fasterxml.jackson` to `tools.jackson`
**Fix:** extend the new base types and update the imports. Note the **annotations** package did not move, so `@JsonProperty` and friends need no change — which is why a partial migration can look almost complete

## Interview questions

**★ What changed about JSON between Spring Boot 3 and 4?**
Jackson 3 became the baseline, with Jackson 2 support deprecated for removal in
a later 4.x. Programmatically the package moved from `com.fasterxml.jackson` to
`tools.jackson`, the entry point became an immutable `JsonMapper` rather than a
mutable `ObjectMapper`, `MappingJackson2HttpMessageConverter` was replaced by
`JacksonJsonHttpMessageConverter`, and the serialiser base types were renamed to
`ValueSerializer` and `ValueDeserializer`. Crucially the **annotations** package
did not move, so annotated DTOs migrate untouched. And two defaults changed
visibly on the wire: dates now serialise as ISO-8601 strings rather than epoch
numbers, and properties are sorted alphabetically rather than by declaration.

**★ Which of those changes can break a client, and how would you find out before shipping?**
The two default changes, because they alter the bytes. The date change breaks
any client parsing that field as a number — noisy and easy to find. The ordering
change is the dangerous one, because JSON says member order is insignificant, so
nothing conformant should care, but anything hashing or signing the serialised
body does: webhook payload signatures, `ETag`s derived from the body,
stored documents compared byte-for-byte. Those fail silently in the sense that
the code still runs and simply stops matching. Before shipping I would
specifically grep for anywhere the response body is hashed, signed or compared
as a string, and I would expect exact-JSON-string tests to break — which is a
latent defect surfaced rather than caused.

**★ What is `spring.jackson.use-jackson2-defaults` and when would you set it?**
It configures the auto-configured `JsonMapper` to behave as closely as possible
to Jackson 2's defaults under Boot 3 — the migration aid for exactly the wire
changes above. I would set it only as a dated, ticketed step during an upgrade,
never as a settled configuration, because Jackson 2 support is deprecated for
removal in a later 4.x and the flag is aligning you with something that is going
away. Where only one behaviour actually matters, I would set that one property
instead — for instance disabling alphabetical sorting — rather than reverting
every default to keep one client happy.

---

← Prev: [Collections and hypermedia](08-collections-and-hypermedia.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Shaping the JSON](10-shaping-the-json.md)
