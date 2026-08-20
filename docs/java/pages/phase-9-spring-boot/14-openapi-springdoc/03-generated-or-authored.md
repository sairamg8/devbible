---
title: "Generated or authored: the choice nobody makes deliberately"
sidebar_label: "3 · Generated or authored"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against springdoc.org (introduction and FAQ), the
> springdoc-openapi-maven-plugin README (github.com/springdoc/springdoc-openapi-maven-plugin,
> latest release 1.5), OpenAPI Generator's generator documentation
> (openapi-generator.tech/docs/generators/typescript-fetch, and the
> `openapi-generator-maven-plugin` release 7.24.0 on Maven Central), and the
> OpenAPI Specification v3.1.1. Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**There are three ways a Spring service can have an OpenAPI document, and almost
every team picks one by accident — usually by adding a dependency because a
colleague did. The choice is not cosmetic. Generating the document from your
code guarantees it matches the code and simultaneously makes your class names,
your package layout and your annotation habits part of a public contract you
cannot change without breaking consumers. Writing the document by hand keeps the
design deliberate and the contract stable, and buys you a document that is wrong
the moment somebody edits a controller. Neither problem goes away by ignoring
it; you only get to choose which one you would rather manage.**

## The three routes

| Route | Where the document comes from | Who owns the truth |
|---|---|---|
| **Runtime generation** (springdoc) | the library introspects the live application context and emits the document from `/v3/api-docs` | the code |
| **Build-time generation** | a build plugin starts the app or reads the classes and writes the document to a file | the code |
| **Contract-first** | a human writes the YAML; a generator produces server interfaces the controllers implement | the document |

The middle route is not a third philosophy — it is the first one with the
document captured as an artifact instead of served from a port. It matters a
great deal operationally (chunk 7) and not at all philosophically.

## The case for generating it

**It cannot drift.** This is the entire argument and it is a strong one. A
document produced by inspecting `@GetMapping`, `@RequestBody` and the return
type of the handler *is* what the service does, because it was read out of what
the service does. Nobody has to remember to update it. Nobody can update it
wrongly. A code review that changes a response type changes the document in the
same commit, for free.

**It is nearly free to start.** One dependency, no configuration, and you have a
document and a UI. For an internal service with two consumers who sit ten feet
away, that is the correct amount of effort to spend.

**It stays honest under refactoring.** Add a field to a record and it appears.
Delete an endpoint and it disappears. The failure mode of hand-written
documentation — the endpoint that was removed two years ago and is still
documented — is structurally impossible.

## The case against generating it, which is the part people skip

**Your implementation names become your public API.** springdoc names schemas
after Java simple class names. `OrderResponse` in the document is
`OrderResponse` in the code. A generated TypeScript client will export a type
called `OrderResponse`. Rename the record to `OrderView` in a tidy-up commit and
you have made a breaking change to your consumers' build with no HTTP change at
all — no status code moved, no field changed, and the frontend will not compile.

**Your annotations are now contract, and they are scattered.** The description a
consumer reads lives in a `@Operation` on line 340 of a controller. There is no
one place to review "what does this API promise?" before shipping it, because
the promise is distributed across every handler. Design review of an API becomes
code review of forty files.

**The document is only as good as the types.** Generation cannot describe what
the type system does not say. A handler returning `ResponseEntity<?>` or
`Map<String, Object>` generates a schema of `object` with no properties — which
is worse than no documentation, because it looks like documentation. The
generator will not warn you; it will faithfully report that you described
nothing.

**You cannot design before you build.** The document appears after the code
exists, so it cannot be the thing the frontend team reviews *before* the backend
is written. On a team where the API is negotiated between two groups, that
ordering is the whole problem.

## The case for contract-first

Contract-first inverts the dependency: the YAML is the source, checked into the
repository and reviewed like code, and a generator produces the Java interfaces
your controllers implement.

```xml
<plugin>
  <groupId>org.openapitools</groupId>
  <artifactId>openapi-generator-maven-plugin</artifactId>
  <version>7.24.0</version>
  <executions>
    <execution>
      <goals><goal>generate</goal></goals>
      <configuration>
        <inputSpec>${project.basedir}/src/main/resources/openapi/orders.yaml</inputSpec>
        <generatorName>spring</generatorName>
        <configOptions>
          <interfaceOnly>true</interfaceOnly>
          <useSpringBoot3>true</useSpringBoot3>
        </configOptions>
      </configuration>
    </execution>
  </executions>
</plugin>
```

What that buys:

- **The contract is reviewable in one file**, in one pull request, before a line
  of implementation exists.
- **The compiler enforces it.** Your controller implements a generated
  interface; remove a method or change a parameter type and the build fails.
  That is a much stronger guarantee than "the document was generated from the
  code", because it works in the direction you actually care about — the code
  cannot silently stop matching the contract.
- **Consumers can start immediately**, from the same YAML, with a mock server.
- **Naming is deliberate.** Schema names are chosen for the consumer, not
  inherited from whatever the DTO happened to be called.

🔴 **The generator's Spring templates are the part to check before committing to
this.** `useSpringBoot3` is the option name in OpenAPI Generator's Spring
generator, and the generated interfaces target the Spring Boot 3 / Jakarta
generation. Whether the 7.x templates emit interfaces that compile cleanly
against **Spring Boot 4.1 and Framework 7** — where `spring-boot-starter-web` is
now `spring-boot-starter-webmvc` and `RestTemplate` is deprecated — is something
to verify against the generator's own release notes for the version you pin
before you adopt it, not something to assume from the option name. Generated
server stubs are exactly the kind of code that lags a major framework release.

## What contract-first costs

**Drift, in the other direction.** Nothing in an annotation-driven Spring
controller forces it to match a YAML file — unless you use the generated
interfaces, which is the whole point and which teams routinely skip because the
generated code "looks ugly". A contract-first setup where the controllers do not
implement the generated interfaces is strictly worse than generation: you now
have two artifacts, neither checking the other.

**Hand-writing OpenAPI is tedious and error-prone.** It is a large, deeply
nested format, and human-authored documents are where you find the
copy-pasted `nullable: true` from chunk 2 and the response block that describes
`application/json` for an endpoint that returns
`application/problem+json`. A linter in CI is not optional here; it is the thing
that makes the approach survivable.

**The generated Java is code you now own.** Its style is not yours, its naming
conventions are not yours, and upgrading the generator can change it. Teams
handle this by never committing generated sources and regenerating at build
time — which is right, and which means a generator outage or a version bump is a
build outage.

## Choosing, honestly

| If this is true | Choose |
|---|---|
| Internal service, consumers are the same team, API changes ship with the frontend | **Generate** — springdoc, no ceremony |
| Public or partner API where consumers upgrade on their own schedule | **Contract-first** — the contract must be stable and reviewable independently of your refactoring |
| Frontend and backend are separate teams negotiating the API before it is built | **Contract-first**, or at minimum a design document reviewed before implementation |
| Existing large service with no document at all | **Generate first.** A generated document you then critique beats a hand-written one nobody finishes |
| Multiple services that must share model definitions | **Contract-first**, with the shared schemas in one place |

There is also a defensible middle: **generate, but treat the generated document
as a reviewed artifact**. Publish it from CI (chunk 7), diff it against the
previous release, and fail the build on a breaking change. That gives you
generation's honesty plus contract-first's stability discipline, at the cost of
one CI step. For most services in the shape this phase describes, that is the
right answer.

## Where Swagger Core and the older tooling fit

Before springdoc, the common route was Swagger Core's own annotations plus
`swagger-maven-plugin`, scanning classes at build time to emit the document.
That still works and the annotations are the same ones — springdoc *uses*
Swagger Core, which is why the annotations in chunk 6 are
`io.swagger.v3.oas.annotations.*` and not Spring types at all. What springdoc
adds is the Spring-awareness: it reads `@GetMapping` and `@RequestParam`, so you
do not have to restate in Swagger annotations what Spring annotations already
say. Choosing raw Swagger Core over springdoc for a Spring application means
writing the mapping information twice, which is why nobody does it any more.

## Gotchas

**⚠️ Renaming a DTO is a breaking change to generated clients**
**Symptom:** the frontend build fails after a backend commit that changed no
behaviour.
**Cause:** schema keys in `components/schemas` come from Java simple class
names, and the client's exported types are named from schema keys.
**Fix:** pin the schema name explicitly so the Java name and the contract name
can move independently.

```java
@Schema(name = "OrderResponse")
public record OrderView(UUID id, BigDecimal total) { }
```

**⚠️ Contract-first without implementing the generated interfaces**
**Symptom:** the YAML says one thing, the service does another, and everyone
trusted the YAML.
**Cause:** the generator was configured with `interfaceOnly`, the interfaces
were generated, and the controllers were written independently of them.
**Fix:** make the controller implement the interface, so the compiler is the
enforcement mechanism.

```java
@RestController
class OrderController implements OrdersApi {   // generated interface
    @Override public ResponseEntity<OrderResponse> getOrder(UUID id) { ... }
}
```

**⚠️ `Map<String, Object>` and wildcard returns generate an empty schema**
**Symptom:** the client generator emits `any` / `object` for a response the team
believes is documented.
**Cause:** the generator can only describe what the type says, and
`ResponseEntity<?>` says nothing.
**Fix:** return a real type. This is the same argument
[topic 07 makes for records as DTOs](../07-rest-controllers/05-records-as-dtos.md)
— it just has a second consequence you can now see in the document.

**⚠️ Committing generated server stubs**
**Symptom:** a generator upgrade produces a 4,000-line diff nobody can review,
and a merge conflict in code no human wrote.
**Cause:** generated sources under `src/main/java`.
**Fix:** generate into `target/generated-sources` (the plugin's default) and add
that to the build's source roots; never commit it.

## Interview questions

**★ Should the OpenAPI document be generated from the code or written by hand?**
It depends on who your consumers are. Generated documents cannot drift, which is
worth a great deal for an internal service. Hand-written documents can be
reviewed and stabilised independently of refactoring, which is worth more for a
public or partner API where consumers upgrade on their own schedule. The
question to ask is: if I rename a class next week, is it acceptable that a
consumer's build breaks? If not, generation alone is not enough.

**★ What is the hidden cost of annotation-driven generation?**
Your implementation details become contract. Class simple names become schema
keys, package structure influences grouping, and the descriptions your consumers
read are scattered across every controller rather than reviewable in one place.
None of that is visible on day one; all of it shows up the first time you tidy
up the code and something downstream breaks.

**★ How does contract-first actually enforce the contract? Isn't it just a YAML file?**
Only if you stop at the YAML. The enforcement comes from generating server
interfaces and having your controllers implement them — then removing an
operation or changing a parameter type is a compile error. Teams that generate
the interfaces and ignore them get the worst of both worlds: two artifacts,
neither validating the other. The compiler is the mechanism, not the file.

**★ Can you get the benefits of both?**
Largely, yes. Generate the document from the code, then publish it from CI as a
build artifact, diff it against the last released version, and fail the build on
a breaking change. You keep generation's guarantee that the document matches the
code, and you add contract-first's guarantee that the contract does not move
without someone deciding it should.

**★ Why do the OpenAPI annotations live in `io.swagger.v3.oas.annotations` rather than a Spring package?**
Because springdoc does not define them. It uses Swagger Core — the reference
implementation of the specification's object model — for schema resolution and
serialisation, and layers Spring-awareness on top so that `@GetMapping` and
`@RequestParam` are understood without restating them. It is a community
project, not a Spring project, which is also why its version and its Spring Boot
compatibility have to be checked separately from Boot's own.

**★ When would you deliberately choose raw Swagger Core over springdoc for a Spring service?**
Essentially never. You would have to declare the mapping information twice —
once for Spring, once for Swagger — and keep them in step by hand, which
reintroduces exactly the drift that generation exists to remove. The historical
reason was that springdoc did not exist or did not support your Spring version;
that is a compatibility question, and it is the subject of the next chunk.

---

← Prev: [What OpenAPI is](01-what-openapi-is.md) · Index: [OpenAPI with springdoc](README.md) · Next → [Adding springdoc](04-adding-springdoc.md)
