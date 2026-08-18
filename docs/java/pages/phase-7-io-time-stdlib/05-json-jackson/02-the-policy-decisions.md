---
title: "The policy decisions"
sidebar_label: "2 · The policy decisions"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the jackson-databind javadoc
> (`DeserializationFeature`, `SerializationFeature`, `JsonInclude`,
> `TypeReference`, javadoc.io, 2.x line — current branch 2.22), the
> jackson-modules-java8 README (`JavaTimeModule`, `Jdk8Module`), and the
> jackson-annotations javadoc (`@JsonProperty`, `@JsonAlias`,
> `@JsonCreator`, `@JsonValue`, `@JsonAnyGetter`/`@JsonAnySetter`).

**A JSON boundary has exactly four questions, and Jackson has a default
answer to each that you may not want: what happens to a field the DTO
doesn't know (unknown fields), what happens to a field the JSON doesn't
send (absent vs null vs default), what goes on the wire when a value is
null or empty (`@JsonInclude`), and how non-JSON-native types — dates,
`Optional`, generics — cross at all. A team that hasn't answered these four
*on purpose* has answered them by accident, and accident is where the
production bugs live.**

## Unknown fields: the tolerant-reader decision

Read side, `FAIL_ON_UNKNOWN_PROPERTIES` — **on by default**, so an
unexpected field throws `UnrecognizedPropertyException`:

```java
// Global policy: tolerate what we don't model (the usual service choice)
JsonMapper.builder()
        .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
```

- **Disable it for API payloads.** A provider adding a response field is a
  compatible change *only* if consumers ignore what they don't know — the
  tolerant-reader rule. Strict mode turns someone else's additive deploy
  into your 400s.
- **Keep it strict for config files.** In configuration, an unknown key is
  almost always a typo (`timeoutMilis`), and silently ignoring it means the
  intended setting silently didn't apply. Same feature, opposite call —
  which is why it's a *policy*, not a universal best practice.
- Per-type override beats a global exception:
  `@JsonIgnoreProperties(ignoreUnknown = true)` on the DTO, or an
  `ObjectReader` `.without(...)` at one call site
  ([chunk 1](01-objectmapper-and-records.md)).

`@JsonIgnoreProperties({"internalScore"})` with named fields also *drops
those fields on write* — it is a both-directions annotation, unlike the
read-only `ignoreUnknown` flag.

## Absent vs null vs default: three states, two hands

JSON distinguishes a field that is **absent**, one that is **`null`**, and
one with a value. Plain binding collapses the first two:

- Object fields: absent **and** explicit `null` both arrive as Java `null`
  — a record constructor cannot tell "not sent" from "sent as null".
- Primitive fields: absent and `null` both become `0` / `false` —
  **silently**. A payment amount that was never sent deserializes as `0`.
  `DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES` turns the explicit
  `null` into an error; an absent primitive still defaults. Declaring the
  wrapper type (`Integer`) plus validation is the honest fix.
- `@JsonProperty(required = true)` looks like the answer but **is only
  enforced for `@JsonCreator` constructor binding** (records qualify) — on
  setter/field binding it is documentation, not validation. Compact-
  constructor null checks in [records](../../phase-2-classes-objects/08-records/README.md)
  are the reliable guard.

Where the *distinction itself* is the requirement — an HTTP `PATCH` where
"absent" means *leave unchanged* and `null` means *clear the value* — plain
POJO binding cannot express it. Read the body as a tree (`JsonNode`, next
chunk) and check `has(...)` vs `isNull()`, or use a three-state wrapper
like OpenAPI's **jackson-databind-nullable** `JsonNullable`.

## `Optional` via `Jdk8Module`

```java
JsonMapper.builder().addModule(new Jdk8Module())
public record Profile(String id, Optional<String> nickname) {}
```

With the module, `"nickname": null` binds to `Optional.empty()` and an
`Optional` field serializes as its value or `null`. Two honest caveats:

- **An absent field still binds the record component to `null`, not
  `empty()`** — Jackson passes `null` for what it never saw. Normalize in
  the compact constructor
  (`nickname = nickname == null ? Optional.empty() : nickname`) or don't
  put `Optional` on DTOs at all — the
  [Optional page](../../phase-4-lambdas-streams/07-optional/README.md)'s
  "return type, not field type" advice applies to wire DTOs too.
- Without the module, an `Optional` serializes via reflection as
  `{"present":true}` — a policy decision made by *forgetting a module*.

## `java.time` via `JavaTimeModule` — and the `[2026,8,18]` trap

Without `JavaTimeModule` on the classpath-registered mapper, writing an
`Instant` throws `InvalidDefinitionException` ("Java 8 date/time type not
supported by default"). With the module registered but defaults untouched,
`SerializationFeature.WRITE_DATES_AS_TIMESTAMPS` is **enabled**, so a
`LocalDate` goes on the wire as the array `[2026,8,18]` and an `Instant`
as decimal seconds. Every mapper that touches an API therefore wants:

```java
.addModule(new JavaTimeModule())
.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)   // ISO-8601 text
```

which yields `"2026-08-18"` and `"2026-08-18T14:30:00Z"` — the ISO-8601
boundary format the [java.time topic](../01-java-time/README.md) argues
for. Spring Boot's autoconfigured mapper makes exactly these two moves for
you; a hand-built side mapper silently doesn't.

## Serialization side: `@JsonInclude`

What to *emit* for null/empty is a contract decision clients can see:

| Value | Emits |
|---|---|
| `ALWAYS` (default) | every property, `null` as `null` |
| `NON_NULL` | drops nulls |
| `NON_ABSENT` | drops nulls **and** empty `Optional` |
| `NON_EMPTY` | additionally drops `""`, empty collections/maps |
| `NON_DEFAULT` | drops anything equal to the field's default |

Set it once on the mapper (`.serializationInclusion(NON_NULL)`) or
per-DTO/field with `@JsonInclude`. Dropping nulls halves chatty payloads —
but a client that distinguishes "field null" from "field missing" (a PATCH
consumer, a JS `in` check) reads the two differently, so changing this on
a live API is a breaking change in disguise.

## The annotations that carry weight

- **`@JsonProperty("order_id")`** — rename one property; for whole-payload
  conventions prefer `.propertyNamingStrategy(SNAKE_CASE)` on the mapper.
- **`@JsonAlias({"orderId", "order_id"})`** — *accept* old names on read
  while *writing* only the canonical one: the rename-migration tool.
- **`@JsonCreator` + `@JsonProperty`** — constructor binding for
  non-record classes ([chunk 1](01-objectmapper-and-records.md)).
- **`@JsonValue`** — serialize a wrapper type as its single value: an
  `OrderId` record with `@JsonValue String value()` goes on the wire as a
  bare string, keeping domain types out of the JSON.
- **`@JsonAnySetter` / `@JsonAnyGetter`** on a `Map<String,Object>` —
  catch-all for pass-through fields you must round-trip but don't model.
- **`@JsonIgnore`** — keep derived accessors and secrets off the wire.

## Generics: `TypeReference` and `JavaType`

Erasure means `readValue(json, List.class)` can only produce
`List<LinkedHashMap>` — the element type is gone at runtime, so Jackson
binds each element to its untyped default and the `ClassCastException`
surfaces later, at first element use:

```java
List<Order> orders = mapper.readValue(json, new TypeReference<List<Order>>() {});
```

The anonymous subclass freezes the full generic type where Jackson can
read it. When the type is only known at runtime — a generic envelope
opened per message type — build a `JavaType`:

```java
JavaType t = mapper.getTypeFactory().constructParametricType(Envelope.class, Payment.class);
Envelope<Payment> e = mapper.readValue(json, t);
```

## Gotchas

**Symptom:** mobile releases start failing with 400s the day the backend ships a new response field
**Cause:** the *client's* mapper left `FAIL_ON_UNKNOWN_PROPERTIES` at its strict default — additive server change, intolerant reader
**Fix:** disable it in every consumer of external JSON; reserve strictness for config parsing

**Symptom:** config typo `retrys: 5` and the service runs with the default retry count, no error anywhere
**Cause:** unknown-field tolerance applied globally, including to the one place strictness was the feature
**Fix:** parse config with a strict `ObjectReader` (`.with(FAIL_ON_UNKNOWN_PROPERTIES)`) even if the shared mapper is lenient

**Symptom:** `LocalDate` fields arrive at the frontend as `[2026,8,18]`
**Cause:** `JavaTimeModule` registered but `WRITE_DATES_AS_TIMESTAMPS` left enabled — array form is that feature's `LocalDate` output
**Fix:** disable the feature for ISO-8601 text; assert the wire format in a contract test so a rebuilt mapper can't regress it

**Symptom:** an unsent `int quantity` deserializes as `0` and an order for zero items passes validation
**Cause:** absent primitives take the Java default silently; `FAIL_ON_NULL_FOR_PRIMITIVES` only guards *explicit* null
**Fix:** wrapper type + compact-constructor check (`quantity == null` → reject), which also documents the field as genuinely optional-or-not

**Symptom:** PATCH endpoint can't distinguish "leave nickname alone" from "clear nickname"
**Cause:** POJO binding collapses absent and null before your code runs
**Fix:** read the patch body as `JsonNode` and branch on `has`/`isNull`, or bind with `JsonNullable` from jackson-databind-nullable

**Symptom:** `Optional` field serializes as `{"present":false}`
**Cause:** `Jdk8Module` not registered — Jackson falls back to reflecting over `Optional`'s bean shape
**Fix:** register the module on the one shared mapper; add a round-trip test per module-dependent type

**Symptom:** after "renaming" a JSON field with `@JsonProperty`, old producers break
**Cause:** `@JsonProperty` renames both directions — reads no longer accept the old name
**Fix:** `@JsonAlias` for the old spelling alongside `@JsonProperty` for the new: write-new, read-both is the migration shape

**Symptom:** `@JsonProperty(required = true)` on a setter-bound class lets absent fields through
**Cause:** `required` is enforced only in `@JsonCreator` property-based binding — records and annotated constructors, not setters
**Fix:** bind through a constructor (record), or validate after binding; don't trust the annotation alone

## Interview questions

**★ Why is `FAIL_ON_UNKNOWN_PROPERTIES` wrong for API clients but right for config files?**
API payloads evolve additively — tolerant readers are what make a
provider's new field a non-breaking change. Config keys don't "evolve" at
runtime; an unknown key is a typo, and failing loudly is the feature. The
same flag implements opposite policies at the two boundaries.

**★ JSON can say `"x": null` or omit `x` entirely. What does each become in a record, and when does the difference matter?**
Both reach the canonical constructor as `null` (primitives: `0`/`false`) —
plain binding erases the distinction. It matters for PATCH semantics
(absent = keep, null = clear), which needs the tree model or a
three-state wrapper like `JsonNullable`.

**★ A payment DTO declares `int amountCents` and a buggy producer stops sending it. What happens?**
Nothing visible: absent primitive → `0`, no exception, and a zero-amount
payment flows on. Wrapper type plus constructor validation converts the
producer bug into an immediate `MismatchedInputException`-adjacent failure
instead of corrupt data.

**★ What two mapper settings make `java.time` types wire-safe, and what do you get if you forget each?**
`addModule(new JavaTimeModule())` — forget it and serialization throws
`InvalidDefinitionException`. `disable(WRITE_DATES_AS_TIMESTAMPS)` —
forget it and you ship `[2026,8,18]` arrays and epoch decimals instead of
ISO-8601 text.

**★ `@JsonProperty` vs `@JsonAlias` — which one is the rename tool?**
Both, together: `@JsonProperty` sets the canonical name for reads *and*
writes; `@JsonAlias` adds extra accepted read spellings. A safe rename
writes the new name while aliasing the old until all producers migrate.

**★ Why does `readValue(json, List.class)` "work" and then throw far from the parse site?**
Erasure: without the element type, Jackson binds elements to
`LinkedHashMap`. The unchecked assignment defers the
`ClassCastException` to first element access — `TypeReference` (compile-
time known) or `JavaType` (runtime-built) hands Jackson the full type.

**★ When is `@JsonInclude(NON_NULL)` a breaking API change?**
When any client distinguishes null-valued from missing fields — JS `in`
checks, JSON-schema `required`, merge-patch consumers. Dropping nulls
changes *presence*, which is part of the contract even though no value
changed.

**★ What is `@JsonValue` for, and what's the deserialization counterpart?**
Collapsing a single-field wrapper (an `OrderId` domain type) to its raw
value on the wire. The reverse trip works via the type's single-argument
constructor or a `@JsonCreator` factory — domain types at the edges
without leaking wrapper objects into the JSON.

---

← Prev: [One mapper, records in and out](01-objectmapper-and-records.md) · Index: [JSON with Jackson](README.md) · Next → [Polymorphism, the three APIs, and failure](03-polymorphism-apis-failure.md)
