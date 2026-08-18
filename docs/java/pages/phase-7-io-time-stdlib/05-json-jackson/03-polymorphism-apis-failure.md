---
title: "Polymorphism, the three APIs, and failure"
sidebar_label: "3 · Polymorphism, APIs, failure"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the jackson-databind javadoc
> (`@JsonTypeInfo`, `PolymorphicTypeValidator`,
> `BasicPolymorphicTypeValidator`, `JsonNode`, `StdSerializer`,
> `StdDeserializer`, exception types — javadoc.io, 2.x line), the Jackson
> 2.10 "Safe Default Typing" announcement and jackson-databind issue #2428
> (`activateDefaultTyping` replacing deprecated `enableDefaultTyping`),
> cowtowncoder's "On Jackson CVEs" write-up, and the FasterXML wiki's
> Jackson Release 3.0 notes (GA 2025-10-03; `tools.jackson` rename;
> unchecked `JacksonException`).

**Three separable skills close out Jackson. Polymorphic deserialization —
where the JSON names the Java type — is the one feature with a CVE series
attached, and the safe form is an allow-list, never an open world. The
three processing APIs — databind, tree, streaming — are altitude choices,
and forcing everything through POJOs is as wrong as parsing everything by
hand. And the exception taxonomy is operational: it tells you whether the
bytes were bad (client's fault), the shape was bad (contract drift), or
your mapping was bad (your bug) — which is the 400-vs-500 decision.**

## Polymorphism done safely: a closed set of names

The safe pattern is annotation-scoped typing over a set *you* enumerate —
logical names on the wire, an allow-list in the code:

```java
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
    @JsonSubTypes.Type(value = CardPayment.class, name = "card"),
    @JsonSubTypes.Type(value = SepaPayment.class, name = "sepa")
})
public sealed interface Payment permits CardPayment, SepaPayment {}
```

- `{"type":"card", ...}` selects `CardPayment`; an unknown name fails with
  `InvalidTypeIdException` instead of instantiating anything.
- **`Id.NAME` + `@JsonSubTypes` is safe by construction** — the wire can
  only choose among classes you listed. The dangerous axis is `Id.CLASS`
  (fully-qualified class names in the JSON), which lets the *sender* pick
  the type to instantiate.
- [Sealed hierarchies](../../phase-2-classes-objects/09-sealed-adts.md)
  and this annotation express the same closed-world claim — one to the
  compiler, one to the wire; keeping `permits` and `@JsonSubTypes` in sync
  is a two-line code review habit.
- `include = As.EXISTING_PROPERTY` reuses a real field as the
  discriminator; `As.WRAPPER_OBJECT` nests the payload under the name —
  choose per API style, the safety story is identical.

## The CVE history, in one paragraph

**Default typing** (`ObjectMapper.enableDefaultTyping()`) embedded class
names for broad type categories — and combined with deserializing into
`Object`/`Serializable`, let attackers name a **gadget class**: something
on the classpath whose constructor or setters do dangerous work
(JNDI lookups, file access, code execution). CVE-2017-7525 opened a series
that ran to dozens of CVEs, each a newly-discovered gadget added to an
ever-growing internal blocklist — an arms race the blocklist side loses by
design. Jackson **2.10** replaced the mechanism: `enableDefaultTyping` was
deprecated in favor of **`activateDefaultTyping`**, which *requires* a
`PolymorphicTypeValidator`, flipping the model from block-list to
allow-list. Jackson 3 removes the unsafe methods entirely.

```java
PolymorphicTypeValidator ptv = BasicPolymorphicTypeValidator.builder()
        .allowIfSubType("com.acme.events.")     // your packages only
        .build();
JsonMapper.builder()
        .activateDefaultTyping(ptv, DefaultTyping.NON_FINAL, As.PROPERTY)
```

The operational rules that fall out: never enable default typing you can
replace with `@JsonTypeInfo(Id.NAME)`; never deserialize attacker-supplied
JSON into `Object`-typed fields with typing active; and treat a
`jackson-databind` version bump as a security patch, not routine.

## Three APIs: databind, tree, streaming

| API | Entry | Use when |
|---|---|---|
| **Data binding** | `readValue`/`writeValue` | The shape is known and yours — DTOs at boundaries. The default. |
| **Tree model** | `readTree` → `JsonNode` | Shape unknown, heterogeneous, or partially interesting: webhooks, PATCH bodies, "route on one field, keep the rest opaque" |
| **Streaming** | `JsonParser`/`JsonGenerator` | Payloads too big to hold, or one record wanted from a huge array — token-by-token, constant memory |

The tree model is the pragmatic middle: `node.path("event").asText("")`
never NPEs (`path` returns a *missing node*, `get` returns `null`), and
`mapper.treeToValue(node.get("data"), OrderCreated.class)` drops back into
databind once you know the shape. `mapper.convertValue(map, Dto.class)`
does POJO↔POJO/`Map` conversion through the same machinery — no JSON text
involved. Streaming is what databind is built on; hand-written parser
loops are a last resort you benchmark your way into, not a default.

## Custom (de)serializers

For the cases annotations can't express — money as `"12.99"` strings, a
legacy `"yes"/"no"` boolean, a domain type with an internal representation
the wire must not see:

```java
public final class MoneySerializer extends StdSerializer<Money> {
    public MoneySerializer() { super(Money.class); }
    @Override public void serialize(Money v, JsonGenerator g, SerializerProvider p)
            throws IOException {
        g.writeString(v.toDecimalString());     // "12.99", never a float
    }
}
// registration, on the one shared mapper:
.addModule(new SimpleModule().addSerializer(new MoneySerializer()))
```

`StdDeserializer<Money>` mirrors it for reads. Prefer module registration
on the shared mapper over `@JsonSerialize(using = ...)` scattered on
types: the module keeps wire policy in the same place as every other
policy decision ([chunk 2](02-the-policy-decisions.md)). Inside a custom
deserializer, fail with `ctxt.reportInputMismatch(...)` rather than bare
exceptions, so errors join the taxonomy below.

## The exception taxonomy — and the 400/500 rule

All 2.x Jackson exceptions extend `JacksonException` → 
`JsonProcessingException` (an `IOException`). The split that matters:

- **`StreamReadException`** (`JsonParseException`) — the bytes aren't
  valid JSON. Sender's fault → **400**.
- **`DatabindException`** (`JsonMappingException`) — valid JSON, wrong
  shape. Its leaf types say what drifted:
  `MismatchedInputException` (wrong structure/type),
  `UnrecognizedPropertyException` (unknown field under strict policy),
  `InvalidTypeIdException` (unknown/blocked polymorphic name),
  `InvalidFormatException` (`"abc"` where a number belongs),
  `ValueInstantiationException` (the constructor threw — a record's
  compact-constructor validation surfaces here). Contract violation →
  **400**, with the exception's path (`getPath()`) naming the field.
- **`InvalidDefinitionException`** — Jackson can't even build a
  (de)serializer: missing module, no creator, broken annotations. The
  *mapping* is wrong, not the message — **500**, and a bug to fix.

That mapping — read/shape errors to 4xx, definition errors to 5xx — is the
whole design of a service's JSON error handler, and belongs beside the
[exception-translation](../../phase-5-exceptions/04-custom-exceptions-translation.md)
boundary rules.

## What Jackson 3 changes

GA **2025-10-03**; the 2.x line continues in parallel (2.22 current;
2.21/2.18 LTS). The moves that matter when you meet a Jackson 3 codebase
— Spring Boot 4 is the mainstream on-ramp:

- **Package and Maven rename:** `com.fasterxml.jackson.*` →
  `tools.jackson.*` — *except* `jackson-annotations`, which keeps
  `com.fasterxml.jackson.annotation` so 2.x and 3.x can share annotated
  DTOs (JSTEP-1). The two lines coexist on one classpath, which is how
  large migrations stay incremental.
- **`JacksonException` extends `RuntimeException`**, not `IOException` —
  the checked-exception ceremony around `readValue` disappears, aligning
  with the [checked-vs-unchecked](../../phase-5-exceptions/01-hierarchy-checked-unchecked/README.md)
  argument: callers could never repair a parse failure anyway.
- **The 2.13+ names become the only names:** `StreamReadException`,
  `StreamWriteException`, `DatabindException` — the `Json*`-prefixed
  legacy names go.
- **Immutable-by-builder becomes the default construction style** — the
  discipline [chunk 1](01-objectmapper-and-records.md) recommends is now
  the API — and defaults shift toward what most services configured
  manually (ISO-8601 dates among them).
- **`enableDefaultTyping` is gone**; only validator-gated
  `activateDefaultTyping` remains.

## Gotchas

**Symptom:** security scanner flags the service for a jackson-databind CVE though the code never calls `enableDefaultTyping`
**Cause:** a dependency activates default typing, or an `Object`-typed field plus permissive config reproduces the conditions; scanners flag the vulnerable *version* regardless
**Fix:** upgrade — databind bumps are security patches; audit for `Object`/generic fields reachable from external JSON

**Symptom:** `InvalidTypeIdException` in production after a producer starts sending a new event subtype
**Cause:** `@JsonSubTypes` allow-list not updated — the closed world did its job on an uncoordinated rollout
**Fix:** ship the consumer's new subtype mapping first; optionally route unknown names to a fallback type via `@JsonTypeInfo(defaultImpl = ...)` where skipping is safe

**Symptom:** `permits` lists three subtypes, `@JsonSubTypes` lists two — the third serializes but can't come back
**Cause:** the compiler checks the sealed set, nothing checks the annotation mirror of it
**Fix:** a unit test asserting every permitted subtype round-trips; the test fails at the PR that adds the subtype

**Symptom:** NPE deep in webhook-handling code on `node.get("data").get("id")`
**Cause:** `get` returns Java `null` for a missing field — chained calls die on the first absence
**Fix:** `path(...)`, which returns a missing node safe to chain, with `asText("")`/`isMissingNode()` at the end

**Symptom:** OOM parsing a bulk export that "worked in staging"
**Cause:** databind materializes the whole array; staging's file was small
**Fix:** stream it — `JsonParser` positioned per element, `readValueAs` each object, constant memory regardless of file size

**Symptom:** every malformed request logs as an ERROR with a stack trace and pages on-call
**Cause:** one catch-all handler treats all `JacksonException`s as server faults
**Fix:** split the taxonomy — `StreamReadException`/`DatabindException` → 400 + path in the response body; `InvalidDefinitionException` → 500 + alert

**Symptom:** after a Jackson 3 migration, `catch (IOException)` blocks around `readValue` no longer compile
**Cause:** `JacksonException` is unchecked in 3.x — those catches now catch nothing Jackson throws
**Fix:** catch `JacksonException` (or its read/write subtypes) explicitly; the migration is mechanical but must be done, not deleted

## Interview questions

**★ Why was Jackson's default typing a remote-code-execution risk when the library never executes JSON?**
It let the wire name the class to instantiate. Instantiation runs
constructors and setters — a gadget class on the classpath does dangerous
work there (JNDI lookup, file write). The payload doesn't "execute"; the
*type choice* does.

**★ Why did the blocklist approach fail, and what replaced it?**
Each CVE was one newly-found gadget; the set of dangerous classes on
arbitrary classpaths is unbounded, so the blocklist was always one
discovery behind. 2.10's `activateDefaultTyping` requires a
`PolymorphicTypeValidator` — an allow-list, where safety doesn't depend on
enumerating the infinite bad set.

**★ When is `@JsonTypeInfo` safe despite the CVE history?**
With `Id.NAME` and `@JsonSubTypes`: the discriminator selects among
classes the developer enumerated, so the attacker's choice space is your
allow-list. The danger was open-world forms — `Id.CLASS`, or default
typing without a validator.

**★ Databind, tree, streaming — pick one per scenario: a webhook with 40 event shapes; your own REST DTO; a 2 GB export.**
Webhook → tree (route on the discriminator, `treeToValue` the branch you
model). Own DTO → databind. Export → streaming (constant memory, token
cursor). The skill is refusing to force the first and third through POJOs.

**★ A record's compact constructor throws on invalid data during deserialization. What does the caller catch, and what status code?**
`ValueInstantiationException` (a `DatabindException` leaf) wrapping the
cause — valid JSON, invalid content → 400, with `getPath()` pointing at
the offending field.

**★ Why does `InvalidDefinitionException` deserve a different alert severity than `MismatchedInputException`?**
Mismatched input is *their* data drifting — expected in production,
handled per-request. Invalid definition means your mapper/type
configuration is broken — every request for that type fails until a
deploy, which is a 500-class incident.

**★ Why did Jackson 3 keep `jackson-annotations` in the old package when everything else moved to `tools.jackson`?**
So one annotated DTO jar serves both lines (JSTEP-1) — libraries can stay
2.x while applications move to 3.x, and the two coexist on a classpath
during migration instead of forcing an ecosystem flag-day.

**★ What does making `JacksonException` unchecked in 3.x say about the checked-exception design argument?**
Parse failures aren't a condition the immediate caller can repair —
2.x forced ceremony (`throws IOException` or wrap-rethrow) for an error
that always propagates to a boundary handler anyway. Unchecked is the
honest signature; it's the same argument as for most infrastructure
failures.

---

← Prev: [The policy decisions](02-the-policy-decisions.md) · Index: [Phase 7 — I/O, time and the everyday stdlib](../README.md) · Next → [Regex](../06-regex.md)
