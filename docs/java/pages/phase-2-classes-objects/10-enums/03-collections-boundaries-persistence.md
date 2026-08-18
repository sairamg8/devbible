---
title: "Collections, boundaries, persistence"
sidebar_label: "3 · Collections, boundaries, persistence"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `java.util.EnumSet` and `java.util.EnumMap`
> Javadoc (JDK 25), JEP 441 (pattern matching for switch — exhaustiveness),
> the Jackson databind documentation for enum features
> (`READ_UNKNOWN_ENUM_VALUES_USING_DEFAULT_VALUE`), and the Jakarta
> Persistence 3.x specification for `@Enumerated`.

**Enums earn their keep at the edges of a system — the collections that
index by them, the `switch` that must cover them, and the JSON field or
database column where the closed world of your constants meets input you
don't control. Inside the process the compiler protects you; at the
boundary, `valueOf` throws, unknown values arrive, and constants get
renamed between deployments. This chunk is the difference between an enum
that models the domain and one that causes the incident.**

## `EnumSet` and `EnumMap` — the collections that know the population

Because the constant set is closed and ordinals are dense, the JDK ships
two specialized implementations:

- **`EnumSet`** — a bit vector: one `long` for enums up to 64 constants.
  `contains`/`add`/`remove` are bit operations; set algebra
  (`retainAll`, `addAll`) is bitwise and/or. Effectively free compared to
  `HashSet<Status>`, with iteration in declaration order.
- **`EnumMap`** — an array indexed by ordinal. No hashing, no collisions,
  no boxing of keys, iteration in declaration order.

```java
static final Set<OrderStatus> TERMINAL =
    EnumSet.of(OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED);

Map<PaymentMethod, FeeCalculator> strategies =
    new EnumMap<>(PaymentMethod.class);
```

Practical rules: any `Set` of enum constants should be an `EnumSet`, any
map *keyed* by one an `EnumMap` — the API types stay `Set`/`Map`, only the
construction changes. `EnumSet.allOf(Status.class)` also replaces the
`values()`-clone in "iterate all constants" code. Neither is thread-safe
for writes (wrap with `Collections.synchronizedMap` or copy); neither
accepts null keys/elements — `EnumMap.put(null, v)` throws
`NullPointerException`, unlike `HashMap`.

## `switch` exhaustiveness — the compiler covering your cases

A `switch` *expression* over an enum with no `default` must cover every
constant, and the compiler proves it:

```java
String label = switch (status) {
    case NEW       -> "Awaiting payment";
    case PAID      -> "Payment received";
    case SHIPPED   -> "In transit";
    case DELIVERED -> "Delivered";
    case CANCELLED, REFUNDED -> "Closed";
};
```

The load-bearing rule: **omit `default` on purpose.** With every constant
listed, adding `ON_HOLD` to the enum makes this `switch` a compile error at
every site that must now decide — exactly the tour of the codebase you
want. A `default` arm converts that compile error into silent misbehaviour.
(The compiler still inserts a hidden throwing branch for the
separate-compilation case — an enum recompiled with new constants against
old switch code throws `MatchException`/`IncompatibleClassChangeError`
rather than falling through.) Statement-form `switch` on older codebases
gets no such checking — one more reason the expression form (phase 1's
[switch topic](../../phase-1-language-core/08-control-flow-switch/01-the-modern-switch.md))
is the default. How sealed hierarchies extend the same exhaustiveness to
class hierarchies is [topic 09](../09-sealed-adts.md).

## `valueOf` at the boundary — parse deliberately

`Status.valueOf(input)` is an *assertion* that input is one of your
identifiers, exact case. On user or partner input that assertion is false
weekly. The boundary pattern:

```java
public enum Channel {
    WEB("web"), MOBILE("mob"), PARTNER_API("api");

    private final String code;
    Channel(String code) { this.code = code; }
    public String code() { return code; }

    private static final Map<String, Channel> BY_CODE =
        Arrays.stream(values())
              .collect(Collectors.toUnmodifiableMap(Channel::code, c -> c));

    public static Optional<Channel> fromCode(String code) {
        return Optional.ofNullable(
            BY_CODE.get(code == null ? null : code.toLowerCase(Locale.ROOT)));
    }
}
```

The pieces: an **explicit code** decoupled from the identifier (rename
`PARTNER_API` freely; `"api"` is the contract), a **static lookup map**
(built after the constants exist — the class-init rule from chunk 1), an
**`Optional` return** so the caller decides whether absence is a 400, a
default, or a skip — instead of `IllegalArgumentException` deciding for
them (usually as a 500).

## JSON: Jackson and unknown values

Default Jackson behaviour: serialize as `name()`, deserialize by exact
name, throw `InvalidFormatException` on anything else. For an API that
must tolerate evolution:

- **`@JsonValue` on the `code()` accessor** makes the explicit code the
  wire format; **`@JsonCreator` on a static factory** (`fromCode`, made
  total with an `UNKNOWN` constant or a thrown *domain* error) controls
  parsing.
- Or globally:
  `READ_UNKNOWN_ENUM_VALUES_USING_DEFAULT_VALUE` with `@JsonEnumDefaultValue
  UNKNOWN` — new upstream values degrade to a sentinel instead of failing
  the whole payload.
- The **event-stream rule**: a consumer one deploy behind the producer
  *will* receive constants it doesn't have. Either version the schema, or
  every enum crossing an async boundary carries an `UNKNOWN` arm — and the
  exhaustive `switch` then forces every consumer to say what "unknown"
  means for it. That is the feature.

## Databases: `@Enumerated` and the mapping rule

JPA's default for an enum field is `@Enumerated(EnumType.ORDINAL)` —
chunk 1's time bomb as a *default*. The working options:

| Mapping | Breaks when | Verdict |
|---|---|---|
| `ORDINAL` (default) | anyone reorders/inserts a constant | never |
| `EnumType.STRING` | a constant is *renamed* | good default — renames are visible refactors; pin with tests |
| `AttributeConverter` to an explicit code | only if you edit the codes | best for long-lived schemas; identifiers stay free |
| native DB enum type / check constraint | DDL migration per new constant | fine, budget the migration |

The converter form (`@Converter(autoApply = true)` on an
`AttributeConverter<Channel, String>` delegating to `code()`/`fromCode`)
gives one canonical wire/storage code reused by JSON and JDBC alike.

## Gotchas

**Symptom:** production 500s traced to `IllegalArgumentException: No enum constant Channel.Api`
**Cause:** raw `valueOf` on external input — exact-match, case-sensitive, exception-throwing
**Fix:** parse at the boundary via a code map returning `Optional`; reserve `valueOf` for values you wrote yourself

**Symptom:** every row's status shifts meaning after an innocent-looking enum edit; no test failed
**Cause:** JPA's default `ORDINAL` mapping persisted declaration positions
**Fix:** `EnumType.STRING` at minimum, an `AttributeConverter` with explicit codes for long-lived schemas — and a test pinning each constant's stored form

**Symptom:** consumer service crashes deserializing events after the producer deployed a new enum value
**Cause:** closed-world assumption crossed an async boundary with independent deploy cadence
**Fix:** `UNKNOWN` sentinel + Jackson's default-value read feature (or schema versioning); let exhaustive switches force each consumer to handle it

**Symptom:** `NullPointerException` from `EnumMap.put` / `EnumSet.add` where a `HashMap` "worked"
**Cause:** both specialized types reject null — there is no ordinal for null
**Fix:** model absence as `Optional` or an explicit `NONE` constant, not as a null key

**Symptom:** a `switch` expression stopped compiling after someone added an enum constant — treated as a nuisance and "fixed" with `default -> null`
**Cause:** misunderstanding: the error *is* the exhaustiveness feature doing its job
**Fix:** handle the new constant at every site; `default -> null` reintroduces silent NPEs one call later

**Symptom:** `MatchException` (or `IncompatibleClassChangeError`) at runtime from a switch that "covers everything"
**Cause:** the enum gained constants and only it was recompiled — the switch's compiled exhaustiveness is stale
**Fix:** rebuild dependents together (any sane CI does); treat the exception as "redeploy the consumer", not a code bug

**Symptom:** `HashSet<Status>` and boxed-key `HashMap` hot in allocation profiles
**Cause:** hashing machinery for a type with a perfect array index
**Fix:** `EnumSet`/`EnumMap` — same interfaces, bit-vector and array internals

**Symptom:** enum serialized to JSON as `"Awaiting payment"` and nothing can parse it back
**Cause:** someone overrode `toString()` for display and Jackson's `WRITE_ENUMS_USING_TO_STRING` was on
**Fix:** wire format comes from `name()` or a `@JsonValue` code — never from display text; display strings live in the UI layer or a `displayName` field

## Interview questions

**★ Why are `EnumSet` and `EnumMap` faster than their hash-based equivalents?**
The constant population is closed with dense ordinals, so membership is a
bit test in a `long` (EnumSet) and lookup is an array index (EnumMap) — no
hashing, no collision handling, no key boxing, and iteration falls out in
declaration order.

**★ When should a `switch` over an enum have a `default` arm?**
Almost never in application code you recompile as a whole. Omitting it
makes the compiler flag every switch when a constant is added — the
codebase tour you want. `default` belongs only where old compiled switches
must survive a *newer* enum class at runtime (plugins, independent jars).

**★ How do you accept an enum from an HTTP request safely?**
Never raw `valueOf`. A static factory over a lookup map of explicit codes,
normalized case, returning `Optional` (or throwing a domain-typed error the
web layer maps to 400). With Jackson, `@JsonCreator` on that factory and
`@JsonValue` on the code accessor keep the wire contract independent of
constant names.

**★ Compare the JPA enum mapping options.**
`ORDINAL` (the default) breaks on any reorder — never use it. `STRING`
survives reorders and breaks only on renames, which are visible refactors —
a good default, pinned by tests. An `AttributeConverter` with explicit
codes decouples storage from identifiers entirely. A DB-native enum or
check constraint adds integrity at the cost of a migration per constant.

**★ A new enum value will be produced by a service that deploys before its consumers. Design for it.**
Treat the enum as open at the boundary: consumers carry an `UNKNOWN`
sentinel, deserialization maps unrecognized codes to it (Jackson's
`READ_UNKNOWN_ENUM_VALUES_USING_DEFAULT_VALUE` or a total `fromCode`), and
exhaustive switches force each consumer to define behaviour for `UNKNOWN`
— skip, park, or dead-letter. Alternatively version the schema and gate the
producer on consumer rollout.

**Why does the compiler still insert a throwing branch in an "exhaustive" switch?**
Exhaustiveness is proved against the enum *as compiled against*. Another
jar can ship more constants later without this switch recompiling; the
hidden branch turns that staleness into `MatchException` instead of
undefined fallthrough.

**Where do display strings for enum constants belong?**
Not in `toString()` if anything serializes the enum — a `displayName` field
(chunk 2's `Currency`) or a UI-layer mapping. `name()`/codes are contracts;
display text changes with copywriting.

---

← Prev: [Behaviour per constant](02-behaviour-per-constant.md) · Index: [Enums](README.md)
