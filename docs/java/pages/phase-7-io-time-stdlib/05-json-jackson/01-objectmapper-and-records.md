---
title: "One mapper, records in and out"
sidebar_label: "1 · One mapper, records"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the jackson-databind javadoc for
> `ObjectMapper`, `ObjectReader`, `ObjectWriter` and `JsonMapper` (javadoc.io,
> 2.x line — current branch 2.22), and the jackson-databind 2.12 release
> notes (native record support). JDK 25 target.

**`ObjectMapper` is expensive to build and cheap to use: it constructs and
caches (de)serializers per type on first contact, and after configuration it
is fully thread-safe for `readValue`/`writeValue`. Both facts point at the
same design — build one, configure it completely, share it everywhere. The
anti-pattern `new ObjectMapper()` inside a request handler pays the
serializer-cache warm-up on every call *and* forks your JSON policy into an
uncontrolled copy.**

## One mapper, built once

```java
public final class Json {
    public static final ObjectMapper MAPPER = JsonMapper.builder()
            .addModule(new JavaTimeModule())                       // java.time as ISO-8601
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    private Json() {}
}
```

Three details carry the weight:

- **`JsonMapper.builder()` (2.10+) over `new ObjectMapper()` + setters.**
  The builder finishes configuration *before* anyone can use the instance.
  With the mutable style, a mapper that is configured on one thread and used
  on another needs safe publication like any shared object — the builder
  makes the finished mapper effectively immutable instead
  ([the phase-6 argument](../../phase-6-concurrency/15-immutability-first-strategy/README.md)).
- **Configure, then never reconfigure.** The javadoc's contract is
  thread-safety *for reading and writing*; calling `configure(...)` on a
  mapper already in use is a data race on policy. If one endpoint needs a
  different setting, that is what `ObjectReader`/`ObjectWriter` are for.
- **In Spring Boot you don't build it** — the framework provides the shared,
  configured instance; inject it. Building your own beside it recreates the
  forked-policy problem the shared bean exists to solve (**Phase 9**
  *(not written yet)*).

## Per-call variation: `ObjectReader` and `ObjectWriter`

```java
ObjectReader lenient = Json.MAPPER.readerFor(Order.class)
        .without(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
ObjectWriter pretty  = Json.MAPPER.writerWithDefaultPrettyPrinter();
```

Both are immutable and thread-safe; every `with`/`without` returns a new
instance sharing the mapper's caches. They are the correct answer to "this
one endpoint needs different settings" — cheap, local, and the base mapper's
policy stays intact.

## Records as DTOs

Since **Jackson 2.12** records bind natively — the canonical constructor is
the deserialization entry point and the accessors are the serialization
properties, no annotations, no setters:

```java
public record OrderDto(String id, List<LineDto> lines, Instant placedAt) {}

OrderDto in  = Json.MAPPER.readValue(body, OrderDto.class);
String   out = Json.MAPPER.writeValueAsString(in);
```

This pairs with everything [records](../../phase-2-classes-objects/08-records/README.md)
already are: immutable, value-semantic carriers with a compact constructor
for validation — which runs during deserialization too, so a record that
rejects `null` lines rejects them from JSON as well. That is the cleanest
input-validation seam in the stack: the DTO cannot exist in an invalid
state, no matter who parsed it.

For classes (non-records), Jackson needs either a no-args constructor plus
field/setter access, or an annotated constructor:

```java
public class LegacyDto {
    private final String id;

    @JsonCreator
    public LegacyDto(@JsonProperty("id") String id) { this.id = id; }

    public String getId() { return id; }
}
```

`@JsonCreator` marks the constructor; `@JsonProperty` names each parameter —
required for classes unless the build records parameter names
(`-parameters`; records carry their component names intrinsically).

## What Jackson can see: visibility

Default visibility: **public getters and public fields** are properties;
private fields are not — *unless* a getter exposes them. Consequences worth
knowing cold:

- A private field with a public `getX()` serializes; renaming the getter
  renames the JSON property (`getFullName()` → `fullName`).
- A `boolean isActive()` accessor serializes as `active` — the `is` prefix
  is stripped, which surprises people diffing field names against JSON.
- A "getter" that computes (`getTotal()` summing lines) becomes a JSON
  property you may never have intended to ship — Jackson cannot tell state
  from derivation. `@JsonIgnore` it, or don't name it like a getter.
- Field-only binding (no getters at all) is opt-in:
  `.visibility(PropertyAccessor.FIELD, Visibility.ANY)` — common in codebases
  that treat DTOs as dumb structs.

Records sidestep the whole table: components are the properties, full stop.

## Gotchas

**Symptom:** service latency spikes under load; profiler shows time in Jackson class introspection
**Cause:** `new ObjectMapper()` per request — every call rebuilds serializers instead of hitting the shared mapper's cache
**Fix:** one static shared mapper (or the framework's bean); `ObjectReader`/`ObjectWriter` for per-call variation

**Symptom:** two endpoints emit different date formats for the same DTO
**Cause:** two mappers configured differently — the JSON policy forked at construction sites
**Fix:** single construction point owning all policy; code review treats a bare `new ObjectMapper()` as a defect

**Symptom:** `InvalidDefinitionException: Cannot construct instance … no Creators`
**Cause:** a class (not record) with only a parameterized constructor and no `@JsonCreator`, compiled without `-parameters`
**Fix:** annotate with `@JsonCreator`/`@JsonProperty`, add `-parameters` plus the parameter-names module, or make it a record

**Symptom:** JSON contains a field the DTO doesn't declare, e.g. `"total": 129.9`
**Cause:** a computed public `getTotal()` — Jackson serializes accessors, not fields
**Fix:** `@JsonIgnore` the derived accessor, or rename it out of getter shape; decide *explicitly* what is wire contract

**Symptom:** record's compact-constructor validation never seems to run on some inputs
**Cause:** it does run — but a field absent from JSON arrives as `null`/`0`, and the validation only checked something else
**Fix:** validate all invariants in the compact constructor; absent-vs-null policy is **chunk 2 · The policy decisions** *(not written yet)*'s subject

**Symptom:** mapper configured at startup behaves unconfigured for the first few requests
**Cause:** `configure(...)` called on another thread after the mapper was already published and warming caches — a policy race
**Fix:** builder style — finish configuration before publication; never mutate a shared mapper

## Interview questions

**★ Why is `ObjectMapper` supposed to be shared, and what makes that safe?**
It caches per-type (de)serializers built by reflection — construction is the
expensive part. The javadoc contracts thread-safety for read/write once
configuration is done, so one fully-configured instance serves all threads;
per-call needs are met by immutable `ObjectReader`/`ObjectWriter` views.

**★ What did Jackson 2.12 change about records?**
Native support: the canonical constructor is used for deserialization and
components for serialization, with intrinsic parameter names — no
`@JsonCreator`/`@JsonProperty`, no setters, and compact-constructor
validation guards the JSON boundary for free.

**★ A teammate adds `getDiscountedTotal()` to a DTO and the API response
grows a field. Explain.**
Default visibility treats public getters as properties — Jackson serializes
what the accessor surface implies, including computed values. `@JsonIgnore`
or non-getter naming keeps derivations off the wire.

**★ When is `ObjectReader` the right tool over a second mapper?**
Whenever one call site needs a policy tweak (leniency, a view, a different
root type). Readers/writers are immutable, share the mapper's caches, and
keep the global policy single-sourced; a second mapper forks policy and
caches.

**★ Why does the builder pattern matter for a shared mapper beyond style?**
It closes the configuration window before publication — the shared object is
effectively immutable, so no safe-publication reasoning or policy races;
mutable configure-after-share needs the same care as any shared mutable
state.

**★ How does constructor binding interact with `-parameters`?**
Jackson needs parameter *names* to match JSON keys. Classes lose names at
compile time unless `-parameters` is on (plus the parameter-names module in
2.x); records always retain component names, which is one reason they bind
so cleanly.

---

← Prev: [JSON with Jackson](README.md) · Index: [Phase 7 — I/O, time and the everyday stdlib](../README.md) · Next → **The policy decisions** *(not written yet)*
