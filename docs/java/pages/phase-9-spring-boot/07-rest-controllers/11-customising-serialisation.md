---
title: "Customising serialisation"
sidebar_label: "11 · Customising serialisation"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot 4.1.0 reference *JSON* chapter
> (docs.spring.io — `@JacksonComponent` registering `ValueSerializer` and
> `ValueDeserializer` beans with the auto-configured `JsonMapper`, the
> `ObjectValueSerializer`/`ObjectValueDeserializer` base classes, `@JacksonMixin`
> and `JacksonMixinModule`, and the `spring.http.converters.preferred-json-mapper`
> property), the Spring Boot 4.0 migration guide (the
> `Jackson2ObjectMapperBuilderCustomizer` → `JsonMapperBuilderCustomizer`
> rename), and the spring.io blog *Introducing Jackson 3 support in Spring*
> (2025-10-07 — `ValueSerializer`/`ValueDeserializer` replacing
> `JsonSerializer`/`JsonDeserializer`, and `Jackson2ObjectMapperBuilder` being
> withdrawn in favour of Jackson's own `JsonMapper.Builder`).
> Spring Boot 4.1.0, JDK 25.

**There is exactly one auto-configured `JsonMapper` in a Boot application, and
it serialises everything — your REST responses, your message payloads, your
webhook bodies. That single instance is the reason customisation has a right way
and a wrong way. Adjusting it through a customizer bean keeps every default Boot
established; replacing it with your own bean discards all of them at once, and
presents as serialisation mysteriously misbehaving rather than as the one line
that caused it.**

## Three levels, in order of preference

| Need | Reach for |
|---|---|
| change a global setting | **`JsonMapperBuilderCustomizer`** bean |
| annotate a type you cannot edit | **`@JacksonMixin`** |
| control how one type converts | **`@JacksonComponent`** with `ValueSerializer`/`ValueDeserializer` |
| a genuinely separate contract | a second, explicitly constructed `JsonMapper` |

Notice what is not on the list: defining a `@Bean JsonMapper`. That is the
option that looks most natural and is almost always wrong.

## Global settings: `JsonMapperBuilderCustomizer`

```java
@Bean
JsonMapperBuilderCustomizer customJson() {
    return builder -> builder.enable(SerializationFeature.INDENT_OUTPUT);
}
```

The customizer receives the builder Boot is already configuring, so your change
composes with everything else rather than replacing it. Multiple customizer
beans are supported and are applied in `@Order`.

⚠️ **Note the rename.** In Boot 3 this was `Jackson2ObjectMapperBuilderCustomizer`;
in Boot 4 it is `JsonMapperBuilderCustomizer`. Separately, Spring no longer
provides `Jackson2ObjectMapperBuilder` at all — Jackson's own
`JsonMapper.Builder` is the builder now.

Prefer a `spring.jackson.*` property over a customizer where one exists: it is
visible in configuration, overridable per profile and per environment, and does
not require a code change to alter. Use the customizer for what the properties
do not expose.

## One type: `@JacksonComponent`

```java
@JacksonComponent
public class MoneyJackson {

    // ⚠️ ValueSerializer, not JsonSerializer — Jackson 3 renamed the base types
    public static class Serializer extends ValueSerializer<Money> {
        ...
    }

    public static class Deserializer extends ValueDeserializer<Money> {
        ...
    }
}
```

Boot discovers `@JacksonComponent` beans and registers them with the
auto-configured `JsonMapper`. The nested-class arrangement is a convention that
keeps a type's serialiser and deserialiser together, which matters because they
have to agree — a serialiser changed without its deserialiser produces output
the application cannot read back.

For the common case where the type maps to a JSON *object*, Boot ships
`ObjectValueSerializer` and `ObjectValueDeserializer` base classes that handle
the traversal boilerplate, leaving you a `serializeObject` /
`deserializeObject` method to fill in.

**When a custom serialiser is actually justified** is narrower than it looks.
Most of what people write them for — renaming a field, omitting nulls, formatting
a date — is a `@JsonProperty`, an inclusion setting or a `@JsonFormat`. A
genuine custom serialiser earns its place when the JSON representation is
structurally different from the Java one: a value object that should appear as a
scalar, a legacy format you must emit exactly, a type whose wire form is
computed rather than mapped.

## A type you do not own: `@JacksonMixin`

When the class comes from a library you cannot edit, the annotations have
nowhere to go. A mixin is a separate class that carries them, and
`JacksonMixinModule` applies them to the target:

```java
@JacksonMixin(VendorAddress.class)
abstract class VendorAddressMixin {
    @JsonIgnore abstract String getInternalRoutingCode();
    @JsonProperty("postal_code") abstract String getZip();
}
```

This is the right tool whenever the alternative would be forking a dependency or
wrapping every instance in a DTO purely to change two field names. It also keeps
serialisation concerns out of a type that has other responsibilities — the same
argument as not annotating persistence entities for JSON.

## 🔴 Why not define your own `JsonMapper` bean

```java
// ⛔ Discards module discovery, every spring.jackson.* property,
//    java.time handling, the inclusion policy and the naming strategy.
@Bean
JsonMapper jsonMapper() {
    return JsonMapper.builder().build();
}
```

Boot backs off its auto-configuration when you define the bean yourself, which
is the intended behaviour and exactly the problem: you did not want to opt out
of everything, you wanted to change one thing.

The symptom is distinctive and worth memorising, because it is the fastest route
to the cause: **several unrelated aspects of serialisation stop working at
once.** Dates revert, the naming strategy stops applying, `spring.jackson.*`
properties appear to be ignored, a registered module vanishes. One setting
misbehaving is a setting; everything misbehaving is a replaced bean.

## The trade-off: one mapper, many contracts

The single shared mapper is convenient until two consumers need genuinely
different rules — an external API contracted to `snake_case` while an internal
message payload is `camelCase`, or a webhook whose bytes are signed and must not
be reordered while everything else may be.

Global properties cannot express that. Two honest resolutions:

**Per-DTO annotations**, where the difference is small and local:

```java
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonPropertyOrder(alphabetic = false)   // bytes are signed; order is fixed
public record WebhookEvent(String eventId, Instant occurredAt, ...) { }
```

The deviation is visible on the type that deviates, which is exactly where a
reader will look for it.

**A second, explicitly constructed `JsonMapper`**, where the two contracts are
genuinely separate. Build it yourself, keep it out of the message-converter
chain, and inject it into the component that needs it. Boot even anticipates a
related case with `spring.http.converters.preferred-json-mapper`, which selects
which mapper the MVC converters use when both Jackson 3 and Jackson 2 are
present.

What does not work is adjusting the global mapper for whichever contract is
currently being worked on. Each adjustment is invisible to every other consumer
until one of them breaks, and by then the change responsible is several releases
back — which is the worst possible ratio of cause to symptom.

## Gotchas

**Symptom:** defining a `JsonMapper` bean makes `java.time` serialisation, the naming strategy and every `spring.jackson.*` property stop working at once
**Cause:** the custom bean replaced the auto-configured one, so Boot backed off and every default it had applied went with it
**Fix:** use a `JsonMapperBuilderCustomizer` to adjust the auto-configured mapper instead. The breadth of the breakage is the diagnosis — one setting misbehaving is a setting, everything misbehaving is a replaced bean

**Symptom:** an internal consumer breaks after a change made for an external one
**Cause:** both are served by the single auto-configured `JsonMapper`, so a global setting changed for one silently changed the other
**Fix:** where two consumers need genuinely different rules, give the non-default one its own explicitly constructed `JsonMapper` outside the converter chain, or express the difference with per-DTO annotations so it is visible on the type

**Symptom:** a custom serialiser compiles against `JsonSerializer` and no longer resolves after the Boot 4 upgrade
**Cause:** Jackson 3 renamed the base types to `ValueSerializer` and `ValueDeserializer` and moved the package to `tools.jackson`
**Fix:** extend the new base types and fix the imports. The **annotations** package did not move, which is why a partially-migrated codebase can look almost finished

**Symptom:** a `Jackson2ObjectMapperBuilderCustomizer` bean is silently never applied
**Cause:** that is the Boot 3 name; Boot 4 uses `JsonMapperBuilderCustomizer`, and a bean of an unrecognised type is simply a bean nobody asked for — it does not fail, it just does nothing
**Fix:** rename to `JsonMapperBuilderCustomizer`. Beans that are silently ignored rather than rejected are worth grepping for specifically during a major upgrade

**Symptom:** round-tripping an object through JSON loses a field or throws
**Cause:** a custom `ValueSerializer` was written without a matching `ValueDeserializer`, so the emitted shape is one the application cannot read back
**Fix:** write them as a pair — the nested-class convention inside one `@JacksonComponent` exists to make the omission visible — and test the round trip rather than only the serialisation direction

**Symptom:** a custom serialiser exists purely to rename a field or format a date
**Cause:** reaching for the most powerful tool first; these are `@JsonProperty` and `@JsonFormat` respectively
**Fix:** delete it. Reserve custom serialisers for cases where the JSON structure genuinely differs from the Java structure — a value object appearing as a scalar, a computed representation, a legacy format that must be emitted exactly

## Interview questions

**★ Why not just define your own `JsonMapper` bean when you need to customise something?**
Because Boot backs off its auto-configuration when the bean is user-defined,
which discards everything it had set up: module discovery, all the
`spring.jackson.*` property bindings, `java.time` handling, the inclusion and
naming strategies. You wanted to change one thing and opted out of all of them.
The symptom is distinctive — several unrelated aspects of serialisation stop
working simultaneously — and it presents as "serialisation is behaving
strangely" rather than as the one line responsible. A
`JsonMapperBuilderCustomizer` receives the builder Boot is already configuring,
so the change composes instead of replacing.

**★ You need `snake_case` for an external API but `camelCase` for an internal message payload. How?**
Not with the global naming strategy, because there is a single auto-configured
`JsonMapper` serialising both. Two honest options. Where the difference is small
and local, express it per DTO with `@JsonNaming` or field-level `@JsonProperty`,
which has the advantage that the deviation is visible on the type that deviates.
Where the contracts are genuinely separate, construct a second `JsonMapper`
explicitly, keep it out of the message-converter chain, and inject it where it
is needed. What I would avoid is adjusting the global mapper whenever the
contract currently in hand demands it, because each change is invisible to the
other consumer until it breaks, by which point the cause is several releases
back.

**★ What is `@JacksonMixin` for, and how does it differ from `@JacksonComponent`?**
`@JacksonComponent` registers custom serialisers and deserialisers — classes
extending `ValueSerializer` or `ValueDeserializer` — as beans that Boot wires
into the auto-configured `JsonMapper`. It is for controlling how a type is
*converted*. `@JacksonMixin` is for when you only need to *annotate* a type you
do not own: the mixin class carries the Jackson annotations and
`JacksonMixinModule` applies them to the target. So a library class you cannot
edit can be given `@JsonIgnore` or `@JsonProperty` without forking the
dependency or wrapping every instance in a DTO, and serialisation concerns stay
out of a type that has other responsibilities.

**★ When is a custom serialiser actually the right tool?**
Much less often than it gets used. Renaming a field is `@JsonProperty`, omitting
nulls is an inclusion setting, formatting a date is `@JsonFormat` — none of
those needs code. A custom `ValueSerializer` earns its place when the JSON
representation is *structurally* different from the Java one: a value object
that should appear on the wire as a scalar, a legacy format that must be emitted
byte-for-byte, or a representation that is computed rather than mapped. And it
should always be written as a pair with its deserialiser, because a serialiser
changed alone produces output the application can no longer read back — which is
why Boot's convention nests both inside one `@JacksonComponent`.

**★ What silently breaks when upgrading Jackson 2 customisation to Boot 4?**
Three things, and the first two fail loudly while the third does not. Custom
serialisers extending `JsonSerializer` no longer resolve, because Jackson 3
renamed the base types to `ValueSerializer`/`ValueDeserializer` and moved the
package to `tools.jackson`. `Jackson2ObjectMapperBuilder` was withdrawn in
favour of Jackson's own `JsonMapper.Builder`. And the quiet one: a
`Jackson2ObjectMapperBuilderCustomizer` bean is now just a bean of a type
nothing looks for, so it compiles, registers and does absolutely nothing — the
rename to `JsonMapperBuilderCustomizer` has no compile error to guide you. Beans
that become inert rather than invalid are worth grepping for deliberately during
a major upgrade. Note the annotations package did not move, which is why a
partial migration can look almost complete.

---

← Prev: [Shaping the JSON](10-shaping-the-json.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [API versioning](12-api-versioning.md)
