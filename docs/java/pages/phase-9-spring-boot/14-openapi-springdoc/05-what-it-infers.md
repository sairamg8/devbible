---
title: "What springdoc infers for free, and where the inference stops"
sidebar_label: "5 · What it infers for free"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against springdoc.org (introduction: "JSR-303,
> specifically for @NotNull, @Min, @Max, and @Size") and springdoc.org/faq.html
> (the `-parameters` compiler setting, `@ParameterObject` for `Pageable`,
> `springdoc.model-converters.pageable-converter.enabled`), the constraint
> handling in `io.swagger.v3.core.jackson.ModelResolver` as published in
> `swagger-core-jakarta` **2.2.52** (the version pinned by springdoc 3.1.0), and
> the springdoc release notes for #3239, #3281 and #3293. Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**The reason springdoc is worth adding at all is that a controller written the
way [topic 07](../07-rest-controllers/README.md) describes it is already almost
fully described. The mapping annotations say the path and method. The parameter
annotations say what is a path variable and what is a query string. The record
says the body's shape. And — this is the part that surprises people — the Bean
Validation constraints you put on that record become *schema* constraints in the
document. Which means validating at the boundary is not only a correctness
decision; it is the single highest-leverage thing you can do for the quality of
your generated contract, because every constraint you declare is a constraint
your consumers' generated clients can enforce before they ever make a request.**

## What comes from Spring's own annotations

Everything in this table is inferred without a single OpenAPI annotation:

| What you wrote | What appears in the document |
|---|---|
| `@RestController` on a class | the class becomes a `tag` (`springdoc.auto-tag-classes`, default `true`) |
| `@GetMapping("/orders/{id}")` | a `paths` entry with a `get` operation |
| `@PostMapping(consumes=…, produces=…)` | the operation's `requestBody` and `responses` media types |
| `@PathVariable UUID id` | a `parameter` with `in: path`, `required: true`, schema `string`/`format: uuid` |
| `@RequestParam(required=false) String q` | a `parameter` with `in: query`, `required: false` |
| `@RequestParam(defaultValue="20") int size` | the parameter's schema `default` |
| `@RequestHeader("X-Tenant") String tenant` | a `parameter` with `in: header` |
| `@RequestBody CreateOrder body` | a `requestBody` referencing the schema for `CreateOrder` |
| return type `ResponseEntity<OrderResponse>` | the `200` response's schema, unwrapped from `ResponseEntity` |
| return type `List<OrderResponse>` | an `array` schema with `items` referencing `OrderResponse` |
| a `record` as a DTO | an `object` schema whose properties are the record components |
| `@ResponseStatus(HttpStatus.CREATED)` | the success response keyed `201` rather than `200` |

That is a real contract, generated from code you were going to write anyway.

## Validation constraints become schema constraints

This is the part worth calling out on its own, because it is the strongest
argument in this whole phase for validating at the edge.

springdoc's introduction states the library supports "JSR-303, specifically for
`@NotNull`, `@Min`, `@Max`, and `@Size`", and its FAQ adds `@NotEmpty`,
`@NotBlank`, `@PositiveOrZero` and `@NegativeOrZero`. The actual handling lives
in Swagger Core's `ModelResolver`, and the published `swagger-core-jakarta`
2.2.52 artifact — the one springdoc 3.1.0 pins — carries methods named
`applyNotNullAnnotations`, `applySizeConstraint`, `applyMinConstraint`,
`applyMaxConstraint`, `applyDecimalMinConstraint`, `applyDecimalMaxConstraint`,
`applyPatternConstraint`, `applyEmailConstraint`, `applyNotBlankConstraint`,
`applyNotEmptyConstraint`, `applyPositiveConstraint`, `applyNegativeConstraint`,
`applyPositiveOrZeroConstraint` and `applyNegativeOrZeroConstraint`. Support for
`@Range` was added in springdoc 3.0.3 (#3239).

So a validated record:

```java
public record CreateOrder(
        @NotBlank @Size(max = 64) String reference,
        @NotNull @DecimalMin("0.01") BigDecimal total,
        @Email String notifyAddress,
        @Positive int quantity) { }
```

produces a schema in which `reference` and `total` are **required**, `reference`
carries a maximum length, `total` carries a minimum, `notifyAddress` carries the
`email` format, and `quantity` carries a lower bound. None of that needed an
OpenAPI annotation. All of it becomes validation in a generated TypeScript
client, and all of it is visible to a consumer reading the document.

🔴 **The consequence is worth stating explicitly: an unvalidated DTO produces a
contract that promises nothing.** The same record without constraints generates
four optional properties of the right primitive types and no bounds at all — a
document that says "send me an object with four fields, any values". The topic
that owns the constraint catalogue and where the annotations belong is
[topic 08 — Validation](../08-validation/02-the-constraints.md); this is the
second reason to read it.

## Where inference stops

springdoc reads types and annotations. It cannot read intent. What it cannot
give you:

- **Why an operation exists.** No annotation on a handler says what it is *for*.
- **Which error statuses it returns.** Unless something declares them, the
  document shows a success response and nothing else. (`@ControllerAdvice`
  helps — see chunk 6 and `springdoc.override-with-generic-response`.)
- **Meaning inside a type.** `String status` is `type: string`. That it must be
  one of four values is knowable only from an enum or a `@Schema`.
- **Anything behind a wildcard or a raw type.** `ResponseEntity<?>`,
  `Map<String, Object>` and a raw `List` describe nothing, faithfully.
- **Whether a value is nullable**, beyond what `@NotNull` and the type say.

## The `-parameters` trap, again

springdoc's FAQ is explicit: without the compiler's `-parameters` setting, "some
parameters are not generated in the resulting OpenAPI spec". This is the same
flag [topic 07 requires for `@RequestParam` name inference](../07-rest-controllers/03-the-named-inputs.md)
— it is not a separate problem, it is the same missing metadata seen from a
different angle.

`spring-boot-starter-parent` configures it, so most projects have it without
knowing. A project that does not inherit that parent must set it:

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-compiler-plugin</artifactId>
  <configuration>
    <parameters>true</parameters>
  </configuration>
</plugin>
```

The tell is a document whose parameters are named `arg0`, `arg1` — or are
missing outright.

## `Pageable`, `Page` and the generics that generate badly

Spring Data's `Pageable` is a single method parameter that stands for three
query parameters. Left alone it generates as an object body, which is wrong.
springdoc's documented answer is `@ParameterObject`:

```java
@GetMapping("/orders")
public Page<OrderResponse> list(@ParameterObject Pageable pageable) { ... }
```

which expands it into `page`, `size` and `sort` query parameters. The behaviour
can be turned off with
`springdoc.model-converters.pageable-converter.enabled=false`.

`Page<T>` on the *return* side is handled by a converter of springdoc's own, and
that converter has needed repeated fixes — the 3.1.0 notes record #3281,
"Stabilize Spring Data `Page` schema property order", and 3.0.3 records #3226,
propagating `@JsonView` context when resolving the `Page<T>` schema. The lesson
is not that it is broken; it is that a heavily-generic third-party return type
is the least predictable thing you can put in a contract. If your `Page` schema
matters to consumers, **check the generated document rather than assuming**, and
consider returning your own page wrapper — which is what
[topic 07 argues for on contract grounds anyway](../07-rest-controllers/08-collections-and-hypermedia.md).

## Gotchas

**⚠️ Two DTOs with the same simple name collide in `components/schemas`**
**Symptom:** one schema silently wins; a consumer's generated client has one
`Address` type with the wrong fields.
**Cause:** schema keys are Java *simple* names, so `orders.Address` and
`billing.Address` both want the key `Address`.
**Fix:** either name them explicitly, or switch the whole document to
fully-qualified names.

```java
@Schema(name = "BillingAddress")
public record Address(String line1, String postcode) { }
```

```yaml
springdoc:
  use-fqn: true   # global: schema keys become fully-qualified class names
```

`use-fqn` is the blunt instrument — it makes every schema key long and ugly for
consumers. Prefer explicit `@Schema(name = …)` on the colliding types.

**⚠️ Parameters appear as `arg0` or vanish entirely**
**Symptom:** query parameters missing from the document, or named `arg0`.
**Cause:** the `-parameters` compiler setting is off.
**Fix:** the `maven-compiler-plugin` configuration above. Verify by fetching the
document and looking for the real names — do not verify by looking at the UI,
which may be cached.

**⚠️ An enum-shaped `String` documents as an unconstrained string**
**Symptom:** consumers send `"CANCELED"` when you accept `"CANCELLED"`.
**Cause:** `String status` genuinely is any string as far as the type system is
concerned.
**Fix:** use a real enum, which generates as a schema `enum` with the values
listed. Failing that, state the values.

```java
public enum OrderStatus { NEW, PAID, SHIPPED, CANCELLED }
public record OrderResponse(UUID id, OrderStatus status) { }
```

**⚠️ `@JsonProperty` renaming and a `SNAKE_CASE` naming strategy**
**Symptom:** schema property names in the document do not match what the service
actually serialises.
**Cause:** the schema is resolved from the Java model, and the JSON naming
strategy is applied at serialisation time; the two have historically disagreed
in corner cases — springdoc 3.1.0 fixes #3293, "Inconsistent OpenAPI schema
naming with `SNAKE_CASE`: some Java record fields remain camelCase".
**Fix:** stay on a current springdoc, and if you use a non-default naming
strategy, treat "does the document match the wire?" as something to check in CI
rather than assume. The naming strategy itself is
[topic 07's subject](../07-rest-controllers/10-shaping-the-json.md).

**⚠️ Endpoints you did not write appear in the document**
**Symptom:** framework or library controllers show up.
**Cause:** `springdoc.packages-to-scan` defaults to `*`.
**Fix:** restrict it, as in chunk 4. Note that Actuator endpoints are *not*
included by default — `springdoc.show-actuator` is `false`.

**⚠️ A `@RestController` returning `ModelAndView` disappears**
**Symptom:** an endpoint is simply absent.
**Cause:** `springdoc.model-and-view-allowed` defaults to `false`.
**Fix:** set it to `true` if you genuinely have such a handler — but a
`ModelAndView` from a `@RestController` is usually the real bug.

## Interview questions

**★ What does springdoc give you without any OpenAPI annotations at all?**
Paths and methods from the mapping annotations, parameters and their `in`
location from `@PathVariable` / `@RequestParam` / `@RequestHeader`, the request
body schema from `@RequestBody`, the success response schema from the handler's
return type with `ResponseEntity` unwrapped, one tag per controller class, and —
the part people miss — schema constraints derived from Bean Validation
annotations on the DTOs. For a controller written conventionally that is most of
a usable contract.

**★ How do Bean Validation annotations affect the generated document?**
They become schema constraints. `@NotNull` contributes to the schema's `required`
list; `@Size`, `@Min`/`@Max`, `@DecimalMin`/`@DecimalMax`, `@Pattern`, `@Email`,
`@NotBlank`, `@NotEmpty` and the positive/negative family all map onto
corresponding schema keywords via Swagger Core's `ModelResolver`. The practical
effect is that a well-validated DTO produces a contract a client generator can
enforce, and an unvalidated one produces a contract that promises nothing.

**★ Does that mean validation is really a documentation feature?**
No — it is a correctness feature that happens to have a documentation dividend,
and the dividend is a good reason to be thorough about it. It also cuts the
other way: if you validate somewhere other than the boundary — in a service
method, by hand — none of it reaches the document, because springdoc reads
annotations on the types the controller declares.

**★ Why do some parameters show up as `arg0`?**
Because parameter names are not in the bytecode unless the class was compiled
with `-parameters`. Spring can often recover the name from an explicit
`@RequestParam("q")`, but springdoc has nothing to fall back on when the
annotation carries no name. `spring-boot-starter-parent` sets the flag; a
project that does not inherit it must configure `maven-compiler-plugin` itself.

**★ Why does `ResponseEntity<Page<T>>` generate a schema people complain about?**
Because it is two layers of generics over a third-party type with a large,
internally-structured shape. springdoc unwraps `ResponseEntity` fine, but `Page`
needs a dedicated converter, and that converter has had a run of fixes —
property ordering was only stabilised in the 3.1.0 line. If the shape matters to
your consumers, return a wrapper you control and describe it yourself; you get a
stable contract and a smaller one.

**★ Two packages both have an `Address` record. What happens and what do you do?**
They collide on the schema key `Address` and one wins non-deterministically, so
a consumer gets a type with the wrong fields. The targeted fix is
`@Schema(name = "BillingAddress")` on one of them. The blunt fix is
`springdoc.use-fqn=true`, which makes every key fully qualified and therefore
unique — and makes every generated client type name long. Prefer the targeted
fix.

**★ Where does inference genuinely stop, and what do you do about it?**
It stops at intent and at anything the type system does not carry: why an
operation exists, which errors it returns, what a `String` is allowed to
contain, and anything behind a wildcard. The answer is a small number of
annotations applied where they pay for themselves — which is the next chunk —
not a blanket annotation policy.

---

← Prev: [Adding springdoc](04-adding-springdoc.md) · Index: [OpenAPI with springdoc](README.md) · Next → [The annotations that earn their place](06-the-annotations.md)
