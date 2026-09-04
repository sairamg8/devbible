---
title: "The few annotations that earn their place"
sidebar_label: "6 · The annotations"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against the annotation set published in
> `io.swagger.core.v3:swagger-annotations-jakarta` **2.2.52** (the version
> pinned by springdoc-openapi 3.1.0 — class listing read from the Maven Central
> artifact), the springdoc-openapi README section *Adding API Information and
> Security documentation*, springdoc.org/properties.html for
> `springdoc.override-with-generic-response` and `springdoc.auto-tag-classes`,
> and the Spring Framework reference for `@RestController` semantics as
> already established in [topic 07](../07-rest-controllers/README.md).
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Swagger Core ships around fifty annotations and you need about seven of them.
The temptation with a generated document is to annotate everything, which
produces controllers where the OpenAPI metadata outweighs the code and a
document that says the same thing twice. The rule that keeps this sane: an
annotation earns its place only when it says something the *types cannot*. A
`@Parameter(description = "the order id")` on a parameter already called `id` is
noise. An `@ApiResponse` describing the `409` your `@ControllerAdvice` returns is
the difference between a contract and a wish.**

## The set worth learning

All of these are in `io.swagger.v3.oas.annotations` — they are Swagger Core
annotations, not Spring ones (chunk 3 explains why).

| Annotation | Package suffix | Says what the types cannot |
|---|---|---|
| `@Operation` | *(root)* | the summary and description of one endpoint |
| `@ApiResponse` / `@ApiResponses` | `responses` | the non-2xx outcomes and their bodies — chunk 7 |
| `@Schema` | `media` | a schema's name, description, example, or an explicit type |
| `@Parameter` | *(root)* | a parameter's description, example, or that it is hidden |
| `@Tag` / `@Tags` | `tags` | a grouping that is not one-per-controller |
| `@Hidden` | *(root)* | "this is not part of the public contract" — chunk 8 |
| `@OpenAPIDefinition` | *(root)* | document-level `info`, `servers`, `security`, `tags` |
| `@SecurityScheme` / `@SecurityRequirement` | `security` | how a caller authenticates — chunk 8 |

Worth knowing they exist without reaching for them: `@ArraySchema`,
`@ExampleObject`, `@Content`, `@ExtensionProperty`, `@Webhook`, and `@OpenAPI31`.

## `@Operation` — the one that pays for itself

```java
@GetMapping("/orders/{id}")
@Operation(
    summary = "Fetch one order",
    description = """
        Returns the order and its lines. Callers holding only the
        `orders:read` scope see the order without pricing.""")
public OrderResponse get(@PathVariable UUID id) { ... }
```

`summary` is what a UI shows in the collapsed operation list, and it is the
single most valuable string in the document. `description` supports Markdown and
is where a genuine caveat belongs — the sort of thing that otherwise lives in a
Slack message.

`@Operation` also carries `operationId`. springdoc derives one from the method
name by default, which means **renaming a Java method renames the generated
client's function**. If your document is consumed by a code generator, setting
`operationId` explicitly is the same defensive move as setting a schema name:

```java
@Operation(operationId = "getOrder")
```

## `@Schema` — three jobs, one annotation

```java
public record CreateOrder(
        @Schema(description = "your reference; must be unique per customer",
                example = "ORD-2026-00142")
        @NotBlank @Size(max = 64) String reference,

        @Schema(description = "gross total in the order currency", example = "129.99")
        @NotNull @DecimalMin("0.01") BigDecimal total) { }
```

The three jobs, in descending order of value:

1. **`name`** — decoupling the schema key from the Java class name (chunk 5).
2. **`example`** — the value a UI pre-fills and a reader copies. A good example
   is worth more than a paragraph of description.
3. **`description`** — for the semantic the type does not carry.

`@Schema` also has `accessMode`, worth knowing for the case where one DTO is used
in both directions and a field is server-assigned:

```java
@Schema(accessMode = Schema.AccessMode.READ_ONLY)
UUID id
```

Though the better answer is usually two records — a request one and a response
one — which is the position
[topic 07 takes](../07-rest-controllers/05-records-as-dtos.md).

## `@Parameter` — mostly for hiding, occasionally for examples

Most parameters need nothing: the name, location and required-ness all come
from the Spring annotation, and the constraints come from validation. `@Parameter`
earns its place in two cases.

**An example**, where the format is not obvious from the type:

```java
@GetMapping("/orders")
public List<OrderResponse> search(
        @Parameter(description = "ISO-8601 instant; results are strictly after it",
                   example = "2026-08-01T00:00:00Z")
        @RequestParam Instant placedAfter) { ... }
```

**Hiding an argument that is not a caller input at all.** A handler may take
`Authentication`, `HttpServletRequest` or an injected principal — things the
framework supplies and a caller never sends. Where those leak into the document
as parameters, `@Parameter(hidden = true)` removes them:

```java
@GetMapping("/orders/mine")
public List<OrderResponse> mine(
        @Parameter(hidden = true) Authentication authentication) { ... }
```

`@Parameter` also carries `required` and `schema`, which override what was
inferred. Reach for those last: a document that disagrees with the code is worse
than one that is merely terse, and an overridden `required` is exactly the kind
of disagreement nobody notices until a client sends nothing.

## `@Tag` and grouping

`springdoc.auto-tag-classes` is `true`, so every controller becomes a tag named
after the class. That is fine until your controllers are split for code reasons
rather than for the consumer's benefit. `@Tag` overrides it:

```java
@RestController
@Tag(name = "Orders", description = "Placing, reading and cancelling orders")
class OrderQueryController { ... }
```

Two controllers with the same `@Tag(name = "Orders")` merge into one section,
which is usually what a consumer wants.

⚠️ `Tag` is one of the most collided-on simple names in Java. The one you want
is `io.swagger.v3.oas.annotations.tags.Tag`. JUnit 5's `org.junit.jupiter.api.Tag`
will be offered first by every IDE in a test-adjacent file.

## The `OpenAPI` bean — everything above the paths

`info`, `servers` and document-level `security` do not belong on any controller.
There are two documented ways to supply them; pick one and use it consistently.

**A bean**, which lets you build values from configuration:

```java
@Configuration
class OpenApiConfig {
    @Bean
    OpenAPI ordersApi(@Value("${app.api-version}") String version) {
        return new OpenAPI()
            .info(new Info()
                .title("Orders API")
                .version(version)
                .description("Order placement and lifecycle.")
                .license(new License().name("Apache-2.0").identifier("Apache-2.0")))
            .servers(List.of(
                new Server().url("https://api.example.com").description("production"),
                new Server().url("https://api.staging.example.com").description("staging")));
    }
}
```

**Or the annotation**, which the springdoc README recommends placing on a
Spring-managed bean "for better performance of documentation generation":

```java
@Configuration
@OpenAPIDefinition(
    info = @Info(title = "Orders API", version = "2026-08-20"),
    servers = @Server(url = "https://api.example.com"))
class OpenApiConfig { }
```

Note `license.identifier` in the bean example — the SPDX form from chunk 2, which
is mutually exclusive with `url`.

## Gotchas

**⚠️ Annotating what the types already say**
**Symptom:** a controller where every parameter has a `@Parameter` repeating its
name, and reviews stop reading them.
**Cause:** treating annotation coverage as a quality metric.
**Fix:** delete any annotation whose content is derivable from the signature. The
document is not improved by `@Parameter(description = "the id")` on `UUID id`.

**⚠️ `operationId` changing when you rename a method**
**Symptom:** the frontend's generated client loses a function after a backend
refactor.
**Cause:** springdoc derives `operationId` from the method name.
**Fix:** pin it — `@Operation(operationId = "getOrder")` — for any document a
generator consumes.

**⚠️ The wrong `Tag`, `Parameter` or `Schema` import**
**Symptom:** the annotation compiles and does nothing, or does something
unrelated.
**Cause:** `Tag` collides with JUnit's, `Parameter` with several, and `Schema`
with Jakarta and JSON-B types.
**Fix:** check the import is under `io.swagger.v3.oas.annotations`.

**⚠️ Defining an `OpenAPI` bean and also using `@OpenAPIDefinition`**
**Symptom:** one of the two appears to be ignored.
**Cause:** two sources for the same top-level fields.
**Fix:** choose one. The bean if the values come from configuration; the
annotation if they are constants.

## Interview questions

**★ Which OpenAPI annotations do you actually use, and why so few?**
`@Operation` for summary and description, `@ApiResponse` for the failure
outcomes, `@Schema` for names and examples, `@Tag` for grouping, `@Hidden` for
omission, and one `OpenAPI` bean or `@OpenAPIDefinition` for the document header.
Few, because springdoc already infers everything the types and Spring
annotations carry — so any annotation that restates the signature is pure noise
that makes the real annotations harder to see in review.

**★ What is `operationId` and why should you set it?**
It is the document's unique identifier for an operation, and code generators use
it to name the generated function. springdoc derives it from the Java method
name, so a rename that changes nothing about the HTTP contract still changes the
generated client's API. Pinning it explicitly decouples your method names from
your consumers' code, exactly as pinning `@Schema(name = …)` decouples your class
names.

**★ When is `@Parameter` worth adding?**
Rarely for description — the name and location already come from
`@PathVariable` or `@RequestParam`, and the constraints from validation. It is
worth adding for an `example` where the format is not obvious from the type, and
for `hidden = true` on arguments the framework injects rather than the caller
sends, such as `Authentication` or `HttpServletRequest`, which otherwise appear
in the document as parameters nobody can supply. Its `required` and `schema`
attributes override inference and should be a last resort, because an override
that disagrees with the code is worse than a terse document.

**★ Where should document-level information like `servers` and `info` live?**
In one place — either an `OpenAPI` bean or an `@OpenAPIDefinition` on a
configuration class, never both. The bean is better when values come from
configuration, because it can take a version or a base URL from the
`Environment` in the ordinary way; the annotation is fine for constants. The
springdoc README specifically recommends putting `@OpenAPIDefinition` and
`@SecurityScheme` on a Spring-managed bean rather than anywhere they will be
found by scanning.

**★ Your team wants a rule for when an annotation is justified. What would you write down?**
"Annotate only what the types cannot say." Everything derivable from the method
signature, the mapping annotation, the return type or the validation constraints
is already in the document. What is left is intent, non-success outcomes, values
a `String` is allowed to take, examples, and stable public names — and those are
worth annotating precisely because nothing else can produce them.

---

← Prev: [What it infers for free](05-what-it-infers.md) · Index: [OpenAPI with springdoc](README.md) · Next → [Documenting the failures](07-documenting-the-failures.md)
