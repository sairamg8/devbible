---
title: "OpenAPI from the schemas"
sidebar_label: "12 · OpenAPI"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the OpenAPI 3.1 specification and the
> zod-to-openapi / zod v4 JSON-schema docs. Concept home:
> [Express — the REST surface](../../../expressjs/pages/phase-6-rest-surface/README.md).

## The problem

The API now has a real contract — schemas at the boundary
([ch. 02](02-the-validation-boundary.md)), one error shape
([ch. 09](09-the-error-contract.md)), stable wire mappers
([ch. 05](05-catalog-endpoints.md)). What it doesn't have is a *document*:
something the frontend team reads, the typed client
([Phase 6](../../syllabus/02-frontend.md)) generates from, and a partner
can be handed. The rule that makes the document trustworthy: **generated
from the zod schemas that actually run** — a hand-written spec is a second
implementation, and second implementations drift.

## The approach

zod v4 exports JSON Schema natively (`z.toJSONSchema`); OpenAPI 3.1 *is*
JSON Schema plus routing metadata. So the generator walks a route registry
and assembles the document — the schemas themselves are already written:

```js
// src/openapi.js — run by `node src/openapi.js > openapi.json` in CI
import {z} from 'zod';
import * as catalog from './routes/catalog.schemas.js';
import * as checkout from './routes/checkout.schemas.js';
import * as authz from './routes/auth.schemas.js';

// the registry: every public route names its schemas ONCE, here
const routes = [
  {method: 'get', path: '/products', query: catalog.ListProductsQuery,
   response: catalog.ProductPage, tags: ['catalog']},
  {method: 'get', path: '/products/{slug}', params: catalog.ProductParams,
   response: catalog.ProductDetail, tags: ['catalog']},
  {method: 'post', path: '/checkout', body: checkout.CheckoutBody,
   response: checkout.CheckoutResult, tags: ['checkout'],
   headers: checkout.IdemHeader, auth: true},
  {method: 'post', path: '/auth/login', body: authz.LoginBody,
   response: authz.LoginResult, tags: ['auth']},
  // …one line per public route; the lint step below keeps this honest
];

const toSchema = (s) => z.toJSONSchema(s, {target: 'openapi-3.1'});

export function buildDocument() {
  const paths = {};
  for (const r of routes) {
    const params = [
      ...Object.entries(r.params?.shape ?? {}).map(([name, s]) => ({
        name, in: 'path', required: true, schema: toSchema(s),
      })),
      ...Object.entries(r.query?.shape ?? {}).map(([name, s]) => ({
        name, in: 'query', required: !s.isOptional(), schema: toSchema(s),
      })),
    ];
    (paths[r.path] ??= {})[r.method] = {
      tags: r.tags,
      security: r.auth ? [{cookieAuth: []}] : [],
      parameters: params,
      ...(r.body && {requestBody: {required: true, content:
        {'application/json': {schema: toSchema(r.body)}}}}),
      responses: {
        200: {description: 'success', content:
          {'application/json': {schema: toSchema(r.response)}}},
        default: {description: 'error', content:
          {'application/json': {schema: toSchema(ProblemDetails)}}},
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {title: 'Storefront API', version: process.env.GIT_SHA ?? 'dev'},
    components: {securitySchemes: {cookieAuth:
      {type: 'apiKey', in: 'cookie', name: '__Host-session'}}},
    paths,
  };
}

const ProblemDetails = z.object({          // ch. 09's wire shape, as a schema
  type: z.string(), title: z.string(), status: z.number().int(),
  code: z.string(), request_id: z.string(),
});
```

What this buys, concretely: `/docs` (a static Swagger-UI page in
development), the generated TypeScript client in Phase 6
(`openapi.json` → typed fetch functions), and a diffable artifact — CI
stores the file per commit, and **a breaking-change diff on `openapi.json`
is a review conversation before it is a client incident**.

## The honest limits

- **Response schemas are declared, not enforced.** Request schemas run in
  the boundary middleware; nothing validates what `res.json` ships against
  `ProductPage`. The gap is closed by contract tests (the API test suite
  parses responses *with the same schemas*), which is cheaper than
  runtime response validation and catches drift where it starts — in
  tests.
- **The registry is a list humans maintain.** A route missing from it is
  invisible in the docs. The lint: the test suite walks the Express
  router stack (`app._router`), diffs mounted public paths against
  registry paths, and fails on unregistered routes — mechanical honesty
  for a manual list.
- **Webhooks and admin routes are deliberately absent** — partner-facing
  webhook docs are a separate, versioned document (their audience is not
  the SPA), and admin endpoints don't need a public contract.

## Gotchas

- **Symptom:** the generated schema for `ListProductsQuery` marks every
  field required. **Cause:** `.optional()` was applied after `.default()`
  in some schemas — a defaulted field parses as always-present, and the
  JSON-schema export reflects that. **Fix:** it is *correct* — a default
  means the response of parsing always has the field; the OpenAPI
  `required` describes the parsed contract. For wire-level optionality,
  document the default (the export carries it) rather than fighting the
  type.
- **Symptom:** the spec says `version: dev` in production artifacts.
  **Cause:** `GIT_SHA` unset in the CI step. **Fix:** the build injects
  it; a spec without a version cannot anchor a compatibility conversation,
  which was the artifact's job.

## Interview questions

1. **★ Why generate the spec from the validation schemas instead of
   writing it by hand?** A hand-written spec is a parallel claim about
   the API with no enforcement — it drifts the day a schema changes, and
   drifted docs are worse than none because they are *trusted*. Generation
   inverts the arrow: the code that runs is the source, so the document
   is at worst incomplete, never wrong about what it covers.
2. **★ The request side is enforced and the response side is only
   declared — why is that asymmetry acceptable?** Requests are adversarial
   input: enforcement is security. Responses are your own code's output:
   the failure mode is drift, not attack, and drift is caught by contract
   tests running the same schemas at test time — full runtime response
   validation would tax every request to catch what tests catch free.
3. **What makes an OpenAPI diff in CI more valuable than the document
   itself?** The document describes a moment; the diff describes a
   *change* — which is what breaks clients. Reviewing `openapi.json`
   deltas turns "removed a field" from a production incident into a PR
   comment, and the version stamp ties every client generation to the
   exact contract it was built against.

---

← Prev: [Inbound webhooks](11-inbound-webhooks.md) ·
Phase index: [Phase 3 — The Express API](README.md) ·
Next phase → **Phase 4 · The React UI** *(not written yet)*
