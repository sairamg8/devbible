---
title: "Params and query"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Path params are part of the route pattern. Query strings are not — they land on
`req.query` after the path matches, re-parsed on every access, in whatever shape
the caller chose.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. Mechanism claims
> are read from `router@2.2.0`'s `lib/layer.js`, **`path-to-regexp@8.4.2`**'s
> compiled `match`, and `express@5.2.1`'s `lib/request.js` and `lib/utils.js`, all
> in `sandbox/express-verify/node_modules/` and cited per chunk by function.
> Parser behaviour is cross-checked against
> [`querystring.parse`](https://nodejs.org/api/querystring.html) and **`qs@6.15.3`**'s
> README. **Reading source is not a run.** The two console blocks in this topic
> (chunks 01 and 02) are re-used unchanged from the earlier authorised
> `sandbox/express-verify` run and are **sandbox-measured**; nothing was executed
> for this rewrite.

> ⚠️ **The Express docs contradict themselves on the default query parser.** The
> [`req.query` reference](https://expressjs.com/en/5x/api/request.html) still says
> `qs`; the 5.x settings table, the migration guide **and the source** say
> `simple`. [Chunk 02](02-the-query-parser.md) settles it and shows how to read it
> back for your own version.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Path params](01-path-params.md)** | Where params come from, the null prototype that only string routes have, splats as arrays, optional params omitted rather than `undefined`, and the malformed-escape 400 |
| 02 | **[The query parser](02-the-query-parser.md)** | A getter that re-parses on every access and cannot be assigned to; the four parser settings; and the `allowPrototypes` flag `extended` sets against `qs`'s own advice |
| 03 | **[Shape and trust](03-shape-and-trust.md)** | Every value is `string \| string[]` on the *default* parser; the `?email[$ne]=x` shape; and why `simple` is not the mitigation |

**Split on concept boundaries at the 300-line mark.** 01 is what the path gives
you, 02 is what the query string gives you, 03 is why neither can be trusted.

## Phase gate

You can say why `req.params.hasOwnProperty` throws on one route and not another,
what `req.query.role.toLowerCase()` does when the parameter is sent twice, and
why `req.query = parsed` throws on Express 5.

## Where this connects

- **← [01 · HTTP methods](../01-http-methods/README.md)** — the other half of a
  route.
- **→ [04 · Route ordering](../04-route-ordering.md)** — what happens when two
  patterns could both match.
- **→ [05 · Path matching on Express 5](../05-path-matching-express5.md)** — the
  full `path-to-regexp` 8 syntax, and what throws at registration.
- **→ [06 · `router.param`](../06-router-param.md)** — loading a resource once for
  every route that names it.
- **→ [Phase 3 · 04 · Query parser](../../phase-3-requests/04-query-parser.md)** —
  the parser choice from the request-handling side.
- **→ [Phase 6 · 04 · Filter, sort, search](../../phase-6-rest-surface/04-filter-sort-search.md)**
  — the allow-list chunk 03 insists on.
- **→ [Phase 8 · 01 · Validate at the boundary](../../phase-8-validation-authz/01-validate-at-boundary/README.md)**
  — parse-don't-validate, in full.
- **→ [Phase 8 · 03 · Coercion traps](../../phase-8-validation-authz/03-coercion-traps.md)**
  — `z.coerce.number()` accepting `''` as `0`, and friends.

---

← Prev topic: [HTTP methods](../01-http-methods/README.md) · Start → [Path params](01-path-params.md)
