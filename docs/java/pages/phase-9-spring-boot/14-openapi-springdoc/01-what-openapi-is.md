---
title: "What OpenAPI is, and why machine-readable is the point"
sidebar_label: "1 · What OpenAPI is"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against the OpenAPI Specification v3.1.1 (24 October 2024)
> and v3.2.0 (19 September 2025) at spec.openapis.org/oas/latest.html and
> spec.openapis.org/oas/v3.1.1.html, and the springdoc-openapi properties
> reference (springdoc.org/properties.html) for the version springdoc emits.
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**An OpenAPI document is not documentation. It is a *description* — a JSON or
YAML file that states, in a format other programs can read without guessing,
every path your service answers, every input each one takes, every shape it can
return, and how a caller authenticates. Human-readable documentation is one of
the things you can build from it, and by far the least interesting. The reason
to have one is that a machine on the other side of the boundary — a client
generator, a mock server, a gateway, a contract test, a linter in CI — can act
on it. And which *version* of the format you emit
decides what those machines can do with it, which is the next chunk.**

## What is actually in the document

An OpenAPI document is one object with a small number of top-level fields. The
ones you will meet:

| Field | What it holds |
|---|---|
| `openapi` | the spec version string this document conforms to |
| `info` | title, version, description, contact, `license` |
| `servers` | the base URLs the paths are relative to |
| `paths` | every URL template, and under each one the operations by HTTP method |
| `components` | reusable pieces — `schemas`, `responses`, `parameters`, `securitySchemes`, and in 3.1 `pathItems` |
| `security` | the authentication requirements that apply document-wide |
| `tags` | named groupings that a UI renders as sections |
| `webhooks` | (3.1+) requests the API *sends*, not ones it receives |

An operation under `paths` is where the interesting part lives — its
`operationId`, `parameters`, `requestBody`, and a map of `responses` keyed by
status code, each pointing at a media type and a schema.

The shape below is the documented format, quoted from the specification's own
structure — not output from a running service:

```yaml
openapi: 3.1.1
info:
  title: Orders API
  version: "2026-08-20"
paths:
  /orders/{id}:
    get:
      operationId: getOrder
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        "200":
          description: the order
          content:
            application/json:
              schema: { $ref: "#/components/schemas/OrderResponse" }
        "404":
          description: no such order
          content:
            application/problem+json:
              schema: { $ref: "#/components/schemas/ProblemDetail" }
components:
  schemas:
    OrderResponse:
      type: object
      required: [id, total]
      properties:
        id: { type: string, format: uuid }
        total: { type: number }
```

Two things to notice, because they are the whole argument of this topic. The
`404` is described as carefully as the `200` — a contract that only describes
success is half a contract. And every schema is a `$ref` into `components`,
which means the *names* of your Java types have leaked into a document your
consumers will pin against.

## Why "machine-readable" is the load-bearing word

A wiki page describing your API is a promise. An OpenAPI document is an input.
The difference is what you can attach to it:

- **A typed client**, generated rather than hand-written, so a field you renamed
  becomes a compile error in the frontend instead of an `undefined` at runtime.
- **A UI** — Swagger UI, Scalar, Redoc — that renders the document, and which
  you did not write or maintain.
- **A mock server** that answers the described shapes, so a frontend can be
  built before the backend exists.
- **Contract tests** that assert a deployed service still matches the document
  its consumers were generated from.
- **Gateway and proxy configuration**, request validation at the edge, and
  routing derived from the same file.
- **A linter in CI** — Spectral and its equivalents — that fails a build when an
  operation has no `operationId`, no error response, or a breaking change
  against the previous published version.

None of that is available from prose. All of it is available from a file.

## Gotchas

**⚠️ `servers` still pointing at `localhost`**
**Symptom:** a consumer generates a client that calls
`http://localhost:8080` in their CI.
**Cause:** `servers` holds the base URLs the paths are relative to, and the
default is whatever example was copied in first.
**Fix:** set them deliberately, one entry per environment you actually publish,
with a `description` on each — the `OpenAPI` bean in chunk 6 is where they
belong.

```yaml
servers:
  - url: https://api.example.com
    description: production
  - url: https://api.staging.example.com
    description: staging
```

**⚠️ Treating Swagger UI as "the document"**
**Symptom:** the team's shared link is a UI page on a running environment, and
nobody can say what the contract was two releases ago.
**Cause:** the UI is the visible thing, so it becomes the noun people use.
**Fix:** treat the JSON or YAML as the artifact and the UI as one renderer of
it. The distinction is the difference between a contract you can version, diff
and generate from, and a web page — and it is why chunk 9 exists.

**⚠️ The document's `info.version` is not your build version**
**Symptom:** every deploy publishes a "new API version", and consumers learn to
ignore the field.
**Cause:** it is easy to wire `info.version` to the Maven `${project.version}`
because it is right there.
**Fix:** `info.version` describes the *contract*. Move it when the contract
moves, not when the jar does — which is the same argument
[topic 07 makes about where an API version lives](../07-rest-controllers/13-versioning-strategy.md).

## Interview questions

**★ What is the difference between "Swagger" and "OpenAPI"?**
"Swagger" was the original name of the specification; since 3.0 the
specification itself is **OpenAPI**, published at spec.openapis.org by the
OpenAPI Initiative. "Swagger" survives as the brand of the tooling — Swagger UI,
Swagger Core, Swagger Editor — which is why the annotations a Spring service
uses live in `io.swagger.v3.oas.annotations` packages even though the format
they describe is called OpenAPI. People use the two words interchangeably and
usually mean the UI.

**★ What is OpenAPI, in one sentence, and what is it not?**
It is a machine-readable description of an HTTP API — a JSON or YAML document
listing paths, operations, parameter and body schemas, response shapes by status
code, and security schemes. It is not a framework, not a runtime, not a testing
tool and not a code generator; it is the input those things consume. The
distinction matters because people conflate it with Swagger UI, which is just
one renderer of one document.

**★ Why describe error responses in the document at all — isn't the happy path the contract?**
The failure shapes *are* the contract. A client that handles `200` and treats
everything else as "something went wrong" is a client that cannot show the user
which field was rejected. If your service returns RFC 9457 `ProblemDetail` with
extension members, and the document does not say so, every consumer reverse
engineers it from a screenshot. Describing errors is the difference between a
generated client that is useful and one that is a thin `fetch` wrapper.

**★ Someone says "we don't need OpenAPI, we have a wiki page". What is the actual counter-argument?**
That a wiki page cannot be executed. It cannot generate a typed client, cannot
fail a CI build on a breaking change, cannot drive a mock server, and cannot be
diffed meaningfully between releases. It also drifts, silently and immediately,
because nothing forces it to change when the code does. The value of OpenAPI is
not that it is nicer prose — it is that it is an input to programs.

**★ What is `components` for, and what is the risk of relying on it?**
It holds reusable definitions — schemas, responses, parameters, security schemes
— referenced by `$ref` so the document stays small and consistent. The risk is
that the *keys* in `components/schemas` become part of your public contract.
Generated clients name their model classes after them, so renaming a Java class
renames a schema and breaks the consumer's build. That is a real cost of
generating the document from code rather than writing it, and it is the subject
of chunk 3.

---

← Index: [OpenAPI with springdoc](README.md) · Next → [What 3.1 changed](02-what-3-1-changed.md)
