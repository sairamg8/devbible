---
title: "OpenAPI"
sidebar_label: "08 · OpenAPI"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

**The contract is part of the product. Drift between OpenAPI and handlers is a bug.**

> Verified: 2026-08-14 — **no sandbox run**. OpenAPI is an external specification
> maintained by the OpenAPI Initiative ([spec.openapis.org](https://spec.openapis.org/)),
> not an Express feature: Express ships no spec generation, no validation middleware, and
> no route introspection you could reliably derive a document from. Everything here is
> tooling and practice. **3.1 is the version to target** — it aligns with JSON Schema
> proper, which is what makes sharing schemas with a validator (Zod and friends,
> [Phase 8](../phase-8-validation-authz/README.md)) workable rather than approximate.

## Practice

- Write or generate OpenAPI 3.x for public routes  
- CI: fail on breaking changes or on route/doc mismatch if you have tooling  
- Use the same schemas as Zod when possible (Phase 8) to avoid double sources of truth  

Swagger UI is optional sugar — the artifact is the spec.

## Drift is the only real problem

Every OpenAPI decision reduces to one question: **what stops the document and the
code from disagreeing?** A spec nobody trusts is worse than no spec, because
readers act on it.

There are three arrangements, and only two of them survive contact with a team.

| Approach | Drift risk | Reality |
|---|---|---|
| **Hand-written spec, separate from code** | **High** | Correct on the day it is written. Six months later it documents an endpoint that was renamed and misses three that exist |
| **Generated from code annotations** (JSDoc comments) | **Medium** | Lives next to the handler, so it is *usually* updated — but a comment is not executable, and a wrong one is invisible |
| **Derived from the validation schemas** you already run | **Low** | The schema that validates the request *is* the documented request. It cannot drift, because drift would break the endpoint |

The third is the only one where correctness is structural rather than
disciplinary. If you already validate with Zod
([Phase 8](../phase-8-validation-authz/README.md)), the schema is executable truth
— generate the spec from it and you have one source instead of two things to keep
in sync.

Where the spec cannot be derived — descriptions, examples, auth flows, deprecation
notes — hand-writing is fine. Those are the parts that do not silently break.

## What CI can enforce

"Keep the spec updated" is not a process. These are:

1. **Every route appears in the spec.** Walk the router stack, diff against the
   document's paths, fail on either direction — an undocumented endpoint *and* a
   documented endpoint that no longer exists.
2. **Responses match their schemas.** Validate your integration-test responses
   against the spec. A test suite you already run becomes a contract check for free.
3. **Breaking changes are flagged.** Diff the spec against the previous release and
   fail on removals, type changes and newly-required fields — the same list as
   [versioning](05-versioning.md). This is the check that catches the accidental
   breakage, because it does not rely on anyone noticing.

Check 3 is worth the most and is the one usually skipped.

## Trade-off

A spec buys generated clients, contract tests, a review surface for API changes,
and onboarding that does not require reading handlers. For a public API it is not
optional — it is the product's documentation.

It costs a maintained artifact, and an inaccurate one actively misleads: a client
generated from a wrong spec fails in ways that look like server bugs. **The
question is never "spec or no spec" but "generated or hand-maintained"** — and for
an internal API changing weekly, a hand-written document that nobody updates is
worse than an honest README.

## Gotchas

**Symptom:** The spec documents an endpoint that no longer exists  
**Cause:** Hand-maintained document, route deleted, nobody edited the YAML  
**Fix:** CI diffs the router against the spec in both directions

**Symptom:** A generated client sends a field the server rejects  
**Cause:** The spec and the validator disagree — two sources of truth  
**Fix:** Generate the spec from the validation schemas so there is only one

**Symptom:** A breaking change ships and nobody noticed in review  
**Cause:** No spec diff in CI; the change looked additive in the code diff  
**Fix:** Diff the spec against the last release and fail on removals, type changes and
newly-required fields

**Symptom:** Swagger UI is served in production and exposes internal endpoints  
**Cause:** The UI mounted unconditionally  
**Fix:** Gate it on environment or behind auth. The spec is a deliverable; the browser
UI usually is not

**Symptom:** Error responses are undocumented, so clients handle only the happy path  
**Cause:** The spec describes 200s and nothing else  
**Fix:** Document the error envelope and the `code` values
([Phase 5](../phase-5-errors/03-error-contract.md)). They are part of the contract —
clients branch on them

## Interview questions

**★ Why bother with OpenAPI for an internal API?**  
Onboarding, client generation, contract tests, and explicit breaking-change review.

**★ What is the actual failure mode of OpenAPI, and how do you prevent it?**  
Drift. The document and the handlers disagree, and readers act on the document.
Prevent it structurally — derive the spec from the validation schemas you already
execute, so a mismatch would break the endpoint rather than just the docs.

**★ What would you have CI check about the spec?**  
That every route is documented and every documented route exists; that test responses
validate against their schemas; and that the spec diff against the previous release
contains no removals, type changes or newly-required fields.

**Hand-written or generated?**  
Generated for anything mechanical — paths, request and response schemas. Hand-written
for what cannot drift silently: descriptions, examples, auth flows.

**Why target OpenAPI 3.1?**  
It aligns with JSON Schema, which is what makes sharing one schema between your
validator and your spec realistic instead of approximate.


---

← Prev: [ETag and Cache-Control](07-etag-and-cache.md) · Next → [Webhooks](09-webhooks.md)
