---
title: "What 3.1 changed, and what version you are actually emitting"
sidebar_label: "2 · What 3.1 changed"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against the OpenAPI Specification **v3.1.1** (24 October
> 2024) at spec.openapis.org/oas/v3.1.1.html — the Schema Object, Info/License
> Object, `jsonSchemaDialect`, `webhooks`, `components.pathItems` and the
> binary-data migration note in §4.4.2.1 — the OpenAPI Specification **v3.2.0**
> (19 September 2025) at spec.openapis.org/oas/latest.html, and
> springdoc.org/properties.html for `springdoc.api-docs.version`. Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**The version string at the top of an OpenAPI document is not a formality — it
decides which keywords mean anything. 3.1 stopped OpenAPI's Schema Object being
a divergent near-copy of JSON Schema and made it a superset of Draft 2020-12,
which quietly invalidated a decade of copy-pasteable snippets: `nullable` is not
a 3.1 keyword, exclusive bounds and binary formats are spelled differently, and
an unrecognised keyword in JSON Schema is not an error but an annotation, so
every one of those mistakes fails silently rather than loudly. Meanwhile the
published specification has moved on to 3.2 and springdoc has not, which means
the honest answer to "which version are we emitting?" is a thing to check rather
than assume.**

## The Schema Object became JSON Schema

Through 3.0, OpenAPI's Schema Object was *based on* an old JSON Schema draft but
diverged from it: it had keywords JSON Schema did not (`nullable`), lacked
keywords JSON Schema did, and used different types for some it shared. Any tool
that wanted to validate data against an OpenAPI schema had to implement
OpenAPI's dialect rather than reuse a JSON Schema library.

3.1 ended that. The specification states the Schema Object "is a superset of the
JSON Schema Specification Draft 2020-12", and that OAS data types are the JSON
Schema types — `null`, `boolean`, `object`, `array`, `number`, `string`,
`integer`. The practical consequences:

| Change | 3.0 | 3.1 |
|---|---|---|
| Nullability | `nullable: true` alongside `type: string` | `type: [string, "null"]` — `nullable` is not a 3.1 keyword |
| Dialect declaration | none | `jsonSchemaDialect` at the document root, supplying the default `$schema` for every Schema Object |
| Licence | `license.url` only | `license.identifier`, an SPDX expression, **mutually exclusive** with `url` |
| Reusable path items | not possible | `components.pathItems` |
| Outbound calls | `callbacks` only, nested under an operation | top-level `webhooks`, a map of Path Item Objects, for requests you initiate |

The one that will bite you is the first. Every pre-2021 tutorial, every Stack
Overflow answer, and a great many generated 3.0 documents use `nullable: true`.
In a 3.1 document that key is not a specified keyword; a strict JSON Schema
2020-12 validator treats an unknown keyword as an annotation and *ignores* it,
so the field silently stops being described as nullable rather than failing
loudly.

## 3.2 exists, and you are probably not emitting it

The current published specification is **3.2.0, dated 19 September 2025**. That
is worth knowing so you are not surprised by it, and worth not chasing: tool
support lags the specification by a long way, and springdoc's documented option
for the emitted version is `springdoc.api-docs.version`, whose documented values
are OpenAPI 3.0 and OpenAPI 3.1, defaulting to `openapi_3_1`. There is no 3.2
setting.

So the honest position for a Spring service today is: **you emit 3.1, you should
check that every consumer of your document can read 3.1, and if one cannot, you
set `springdoc.api-docs.version=openapi_3_0` deliberately and accept the weaker
schema vocabulary.** That is a real decision with a real cost, not a formality.

```yaml
springdoc:
  api-docs:
    # documented values: openapi_3_0 | openapi_3_1 (default openapi_3_1)
    version: openapi_3_1
```

## Gotchas

**⚠️ `nullable: true` pasted into a 3.1 document does nothing**
**Symptom:** a field your team believes is documented as nullable generates as
non-nullable in the TypeScript client, and nobody notices until a `null` arrives
in production.
**Cause:** `nullable` is a 3.0 keyword. 3.1's Schema Object is JSON Schema
2020-12, where an unrecognised keyword is not an error — it is ignored.
**Fix:** express it as a type union.

```yaml
# 3.0
total: { type: number, nullable: true }
# 3.1
total: { type: [number, "null"] }
```

**⚠️ A consumer that only speaks 3.0 fails on a 3.1 document in a confusing way**
**Symptom:** an older generator or gateway rejects the document, or worse
produces a client with every model typed as `any`.
**Cause:** the `openapi: 3.1.x` version string and the JSON Schema keywords are
both unfamiliar to it.
**Fix:** pin the emitted version rather than arguing with the tool, and record
*why* in the config so nobody "modernises" it back.

```yaml
springdoc:
  api-docs:
    version: openapi_3_0   # gateway X cannot parse 3.1 — revisit when it can
```

**⚠️ `license.identifier` and `license.url` are mutually exclusive**
**Symptom:** a validator rejects an `info` block that sets both.
**Cause:** 3.1 says plainly that `identifier` "is mutually exclusive of the
`url` field".
**Fix:** pick one — the SPDX identifier if the licence is a standard one.

```yaml
info:
  license:
    name: Apache-2.0
    identifier: Apache-2.0   # not both this and url
```

**⚠️ `format: binary` and `format: byte` are 3.0 spellings**
**Symptom:** a file-upload or file-download schema that no longer means what it
did, or a validator that ignores the format.
**Cause:** 3.1's migration guidance (spec section 4.4.2.1) converts these to
JSON Schema's `contentMediaType` and `contentEncoding` — the OAS-specific
`format` values were how 3.0 expressed something JSON Schema already had
keywords for.
**Fix:** express it with the content keywords.

```yaml
# 3.0
avatar: { type: string, format: binary }
# 3.1
avatar: { type: string, contentMediaType: application/octet-stream }
```

**⚠️ `exclusiveMinimum` may not look the same in a 3.0 and a 3.1 document**
**Symptom:** a consumer's validator disagrees with yours about a boundary value.
**Cause:** JSON Schema and OAS 3.0 have historically represented exclusive
bounds differently — Swagger Core's own model carries *both* an
`exclusiveMinimum` and an `exclusiveMinimumValue` field, which is what a library
looks like when it has to serialise two spec versions.
**Fix:** this is a case where the documentation does not settle the exact
serialisation for you — **read the emitted document for the
`springdoc.api-docs.version` you have configured**, and do not assume a
`@DecimalMin` with `inclusive = false` renders identically in both.
## Interview questions

**★ What changed between OpenAPI 3.0 and 3.1, and why should a backend developer care?**
3.1's Schema Object became a superset of JSON Schema Draft 2020-12 instead of a
divergent near-copy. That means any JSON Schema 2020-12 tooling can validate
against your schemas directly, and it means keywords changed: `nullable` is
gone, nullability is a type union, and the document can declare its dialect via
`jsonSchemaDialect`. A backend developer cares because copy-pasted 3.0 snippets
now fail silently rather than loudly.

**★ Is OpenAPI 3.2 out, and should you be emitting it?**
3.2.0 was published on 19 September 2025. You are almost certainly not emitting
it: springdoc's documented `springdoc.api-docs.version` values are 3.0 and 3.1,
defaulting to 3.1. Chasing the newest spec revision is usually the wrong move
anyway — the value of the document comes from what your consumers' tools can
read, not from the version string.

**★ Why does 3.1 not just say "use JSON Schema" and stop there?**
Because an API description needs things JSON Schema has no opinion about —
paths, operations, parameter locations, media types, security schemes, servers.
3.1's move was to stop *diverging* on the part that overlaps: the Schema Object
is now a superset of JSON Schema 2020-12 rather than a lookalike, so schema
tooling composes, while the rest of the document remains OpenAPI's own.

**★ A consumer says your document is invalid. How do you work out who is wrong?**
Start with the version. Establish what `openapi:` says the document is, then
check what the consumer's tool supports — a 3.0-only validator reading a 3.1
document will report perfectly valid JSON Schema keywords as unknown. After
that, check whether the disagreement is over a keyword whose representation
changed between versions, such as nullability or exclusive bounds. Most "invalid
document" reports are version-mismatch reports wearing a different hat.

---

← Prev: [What OpenAPI is](01-what-openapi-is.md) · Index: [OpenAPI with springdoc](README.md) · Next → [Generated or authored](03-generated-or-authored.md)
