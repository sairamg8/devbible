---
title: "The payoff: a typed client the frontend cannot get wrong"
sidebar_label: "10 · The typed client"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against OpenAPI Generator's generator documentation
> (openapi-generator.tech/docs/generators/typescript-fetch — "Generates a
> TypeScript client library using Fetch API", marked STABLE, and the
> `npmName`, `useSingleRequestParameter` and `enumPropertyNaming` options), the
> `openapi-generator-maven-plugin` **7.24.0** listing on Maven Central
> (published 2026-07-20), and springdoc.org/properties.html for
> `springdoc.api-docs.version`. Spring Boot 4.1.0, Spring Framework 7.0.x,
> JDK 25.

**For a fullstack reader this is why the topic exists. Every decision in the
previous eight chunks — validating at the boundary, returning real record types
instead of maps, pinning schema names and operation ids, describing the failure
responses, capturing the document as a versioned artifact — converges here, on a
generated TypeScript client where a backend change that breaks the frontend
breaks it at compile time in CI rather than at runtime in a browser. And the
converse is just as true and less often said: feed a generator a document full
of `object` schemas and undocumented errors and it will cheerfully produce a
client full of `any`, which is worse than no client because it looks like
safety.**

## Generating the client

```xml
<plugin>
  <groupId>org.openapitools</groupId>
  <artifactId>openapi-generator-maven-plugin</artifactId>
  <version>7.24.0</version>
  <executions>
    <execution>
      <goals><goal>generate</goal></goals>
      <configuration>
        <inputSpec>${project.build.directory}/openapi.yaml</inputSpec>
        <generatorName>typescript-fetch</generatorName>
        <output>${project.build.directory}/ts-client</output>
        <configOptions>
          <npmName>@example/orders-client</npmName>
        </configOptions>
      </configuration>
    </execution>
  </executions>
</plugin>
```

`typescript-fetch` is documented as generating "a TypeScript client library
using Fetch API" and is marked **STABLE**. The options worth knowing before you
adopt it, because each one shows up in the generated call sites:

| Option | Default | What it changes |
|---|---|---|
| `npmName` | *(none)* | required to produce a publishable package |
| `useSingleRequestParameter` | `true` | operations take one options object rather than positional arguments |
| `enumPropertyNaming` | `PascalCase` | how enum members are named — also `camelCase`, `snake_case`, `UPPERCASE`, `original` |

The same generator has targets for many other languages, so the document is
equally the source of a Kotlin client for a mobile app or a Python one for a
data pipeline. Nothing about that path is TypeScript-specific except the
generator name.

## What the chain actually buys, decision by decision

| Something you did earlier | What it becomes in the client |
|---|---|
| a `record` DTO instead of `Map<String, Object>` (chunk 3) | a named model interface with typed fields, not `any` |
| `@NotNull`, `@Size`, `@Pattern` on that record (chunk 5) | required fields and documented constraints in the model |
| a real `enum` rather than a `String` (chunk 5) | a union type the compiler checks |
| `@Schema(name = …)` (chunk 5) | a stable exported type name, decoupled from your Java class name |
| `@Operation(operationId = …)` (chunk 6) | a stable function name, decoupled from your Java method name |
| `@ApiResponse` with `application/problem+json` (chunk 7) | a typed error shape the UI can switch on |
| the versioned artifact (chunk 9) | a client package pinned to a contract version, not to whatever is deployed |

The dependency runs in one direction: **the client is exactly as good as the
document, and the document is exactly as good as the types and annotations.**
This is why "add springdoc" is not a task you can finish in one commit — the
library is trivial to add and the contract quality is the work.

## Where this leaves the frontend

The generated package is a build-time dependency of the frontend, pinned to a
version. A backend release publishes a new client version; the frontend upgrades
deliberately and its compiler reports every call site that no longer matches.
That is the same guarantee contract-first gets from generated server interfaces
(chunk 3), applied at the other end of the wire — and it is available whichever
of the two routes you took, because both produce the same document.

Two habits make it hold:

- **Never edit the generated code.** Generate into a build directory, publish,
  and depend on the version. A hand-edited client is a client that silently
  disagrees with the contract.
- **Upgrade the client as a visible step.** If the frontend floats to "latest",
  a backend change breaks a frontend build nobody expected to be touched, and
  the value of compile-time safety turns into an interruption.

## Gotchas

**⚠️ Committing the generated client**
**Symptom:** the frontend's types and the backend's contract disagree because
somebody edited the generated code.
**Cause:** generated sources under version control invite hand-editing.
**Fix:** generate at build time into a build directory, publish it as a package,
and let consumers depend on the version — never on a copy.

**⚠️ A 3.1 document fed to a generator that only handles 3.0**
**Symptom:** models generate as `any`, or the generator rejects the file.
**Cause:** springdoc's documented default is `openapi_3_1`, and the
typescript-fetch documentation page describes OAS2 and OAS3 features without
explicitly stating 3.1 support.
**Fix:** verify against the release notes of the generator version you pin. If
it does not hold, emit 3.0 for the published artifact deliberately.

```yaml
springdoc:
  api-docs:
    version: openapi_3_0   # generator X does not fully handle 3.1 — recheck on upgrade
```

**⚠️ Generating from the running service instead of the artifact**
**Symptom:** two developers generate clients that differ, and neither matches
what was released.
**Cause:** `inputSpec` pointed at a URL on a deployed environment.
**Fix:** point it at the versioned file from chunk 9. A contract you fetch from
a moving target is not a contract.

**⚠️ Enum naming drift**
**Symptom:** the client's enum members do not match the backend's, or change
shape on a generator upgrade.
**Cause:** `enumPropertyNaming` defaults to `PascalCase` and is a generator
setting, not a document one — so the document is stable and the client is not.
**Fix:** set it explicitly and treat it as part of the client's published API.

**⚠️ Expecting the generator to invent what the document omits**
**Symptom:** the client has no error types, or a response body typed `object`.
**Cause:** the document did not describe them.
**Fix:** the earlier chunks — this is not a generator problem and no generator
option fixes it.

## Interview questions

**★ Walk through how the frontend ends up with types it cannot get wrong.**
The backend's records and validation constraints generate schemas; CI captures
the document as a versioned artifact; OpenAPI Generator turns that into a
TypeScript client with model types, per-operation functions named from
`operationId`, and typed error shapes. The frontend imports the package. A
renamed field or a removed endpoint then fails the frontend's compile instead of
producing `undefined` in a browser. The chain only holds if the names are stable
— which is why the earlier chunks argued for pinning schema names and operation
ids.

**★ What would make you distrust that generated client?**
A document that describes nothing useful. Wildcard return types, unvalidated
DTOs, undocumented error responses and `Map<String, Object>` bodies all generate
cleanly and produce a client full of `any`. The generator is only as good as the
contract, and the contract is only as good as the types and annotations behind
it — which is the whole argument of this topic in one sentence.

**★ Is the generated TypeScript client guaranteed to understand your document?**
Not automatically. springdoc's documented default emits OpenAPI 3.1, and a given
generator version may only fully support 3.0 — the typescript-fetch
documentation page does not state 3.1 support explicitly. That is a
compatibility fact to check against the generator's release notes for the
version you pin, and the fallback if it does not hold is to emit 3.0 for the
published artifact deliberately, accepting the weaker schema vocabulary.

**★ Why generate from the artifact rather than from the running service?**
Because the running service moves. Two developers generating on different days
get different clients, and neither corresponds to a release anyone can name. The
versioned artifact is the thing consumers can pin, diff and roll back to; the
`/v3/api-docs` endpoint is a debugging aid.

**★ Should the generated client be committed to the frontend repository?**
No. Generate it in a build, publish it as a versioned package, and let the
frontend depend on that version. Committed generated code gets hand-edited, and
a hand-edited client is one that silently disagrees with the contract it was
supposed to enforce — which removes the entire benefit while keeping the
maintenance cost.

**★ You have added springdoc and the frontend still hand-writes its types. What is missing?**
Everything between the two: the document is not captured as an artifact, so
there is nothing stable to generate from; or it is captured but full of `object`
schemas and undocumented errors, so the generated client would be no better than
what they have. "Adding springdoc" is the first ten minutes of the work; the
contract quality and the pipeline are the rest of it.

---

← Prev: [Capturing the document](09-capturing-the-document.md) · Index: [OpenAPI with springdoc](README.md)
