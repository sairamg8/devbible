---
title: "Validate at the HTTP boundary"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Everything from the network is untrusted. Parse it before services run.**

> Verified: 2026-08-14 — **no sandbox run and no console block in either chunk.**
> Express states the premise itself: *"as `req.query`'s shape is based on
> user-controlled input, all properties and values should be validated before
> trusting"* ([request reference](https://expressjs.com/en/5x/api/request.html)) —
> **shape**, not only value. Two documented facts make the boundary concrete:
> **`req.body` is `undefined` until a body parser runs** and stays `undefined`
> when the `Content-Type` did not match
> ([express reference](https://expressjs.com/en/5x/api/express.html)), and
> `req.query` is a getter that cannot be assigned to
> ([migration guide](https://expressjs.com/en/guide/migrating-5.html)) — the
> latter read from `express@5.2.1`'s `lib/request.js` in
> `sandbox/express-verify/node_modules/`. **Express validates nothing**: it ships
> six built-in middleware and none of them is a validator. Zod, Valibot and the
> rest are packages; **the boundary discipline is this bible's guidance.**

The principle outlives any library. Whether you use Zod, Valibot, or hand
parsers, **services receive validated data**, not `req.body`.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[What untrusted means](01-what-untrusted-means.md)** | Every request surface and its specific trap, the four payloads a truthiness check accepts, where the trust boundary actually is, and what Express does and does not do |
| 02 | **[Parse, don't validate](02-parse-dont-validate.md)** | Why the parse *output* kills three bug classes, where to put it now that `req.query` is a getter, strict-versus-strip, bounding every field, and what a schema cannot do |

**Split on a concept boundary at the 300-line mark.** 01 is the threat, 02 is the
discipline.

## Phase gate

You can name four payloads that pass `if (!req.body.x)`, explain why the parse
output matters rather than the check, and say what a schema is *not* responsible
for.

## Where this connects

- **← [Phase 1 · 02 · chunk 03](../../phase-1-routing/02-params-and-query/03-shape-and-trust.md)**
  — the shape attack on `req.query`, and why `simple` is not the mitigation.
- **← [Phase 3 · 02](../../phase-3-requests/02-json-and-urlencoded/README.md)** —
  how `req.body` comes to exist, and the empty body that parses to `{}`.
- **← [Phase 3 · 03 · chunk 03](../../phase-3-requests/03-size-limits/03-what-it-does-not-protect.md)**
  — why a body limit says nothing about a field.
- **→ [02 · Validation factory](../02-validation-factory/README.md)** — the middleware
  that makes this the default rather than a habit.
- **→ [03 · Coercion traps](../03-coercion-traps.md)** — `z.coerce.number()`
  accepting `''` as `0`, and friends.
- **→ [07 · Ownership](../07-ownership.md)** — the check a schema structurally
  cannot make.
- **→ [09 · Type inference](../09-type-inference.md)** — removing the duplication
  rather than the check.
- **→ [Phase 5 · 03 · chunk 02](../../phase-5-errors/03-error-contract/02-what-is-safe-to-expose.md)**
  — why a forwarded constraint violation leaks schema details.
- **→ [Phase 9 · 05 · CSRF and injection](../../phase-9-hardening/05-csrf-and-injection.md)**
  — escaping as an output concern, not an input one.

---

← Index: [Phase 8](../README.md) · Start → [What untrusted means](01-what-untrusted-means.md)
