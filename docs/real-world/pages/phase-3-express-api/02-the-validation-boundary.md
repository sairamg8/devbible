---
title: "The validation boundary"
sidebar_label: "02 · The validation boundary"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the zod v4 docs and Express 5 docs. Concept home:
> [Express — validate at the boundary](../../../expressjs/pages/phase-8-validation-authz/01-validate-at-boundary/README.md),
> [coercion traps](../../../expressjs/pages/phase-8-validation-authz/03-coercion-traps.md),
> [Node — input validation](../../../nodejs/pages/phase-8-security/17-input-validation.md).

## The problem

Every request field is untrusted text until proven otherwise — `?limit=9999999`,
a negative quantity, an `attributes` object with a `__proto__` key, a cursor
from three filters ago. The boundary's job is **parse, don't validate**: turn
raw HTTP into typed, constrained values once, at the door, so every layer
behind it works with data that cannot be malformed. One middleware factory
does it for the whole API.

## The implementation

```js
// src/middleware/validate.js
import {ZodError} from 'zod';
import {ApiError} from './errors.js';        // ch. 09's error class

/** validate({params, query, body}) — parses each part it is given and
 *  replaces req.valid with the typed results. */
export function validate(schemas) {
  return (req, res, next) => {
    try {
      req.valid = {};
      for (const part of ['params', 'query', 'body']) {
        if (schemas[part]) req.valid[part] = schemas[part].parse(req[part]);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new ApiError(400, 'VALIDATION', 'invalid request', {
          issues: err.issues.map((i) => ({
            path: i.path.join('.'), message: i.message,
          })),
        }));
      } else next(err);
    }
  };
}
```

The schemas live next to the routes that use them — and double as the
API's type source ([Phase 6](../../syllabus/02-frontend.md) infers from
them):

```js
// src/routes/catalog.schemas.js
import {z} from 'zod';

export const ListProductsQuery = z.object({
  category: z.string().min(1).max(80).optional(),
  min_cents: z.coerce.number().int().min(0).optional(),
  max_cents: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  cursor: z.string().base64().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(48).default(24),
}).strict()
  .refine((q) => q.min_cents == null || q.max_cents == null
                 || q.min_cents <= q.max_cents,
          {message: 'min_cents must not exceed max_cents'});

export const ProductParams = z.object({slug: z.string().min(1).max(120)});
```

```js
// src/routes/catalog.js (excerpt) — the boundary in use
router.get('/', validate({query: ListProductsQuery}), async (req, res) => {
  const q = req.valid.query;                       // typed, constrained, done
  const page = await catalog.list({
    categorySlug: q.category, minCents: q.min_cents, maxCents: q.max_cents,
    sort: q.sort, cursor: decodeCursor(q.cursor), limit: q.limit,
  });
  res.json({items: page.items, next_cursor: encodeCursor(page.nextCursor)});
});
```

## The rules, and why each exists

**`.strict()` on every object schema.** Unknown keys are rejected, not
stripped. Silently dropping them hides client bugs (a misspelled `sortt=`
does nothing and nobody knows); rejecting turns the typo into a 400 with the
key named. It is also the cheap half of a
[mass-assignment defence](../../../nodejs/pages/phase-8-security/15-deserialization-redirects-mass-assignment.md):
a request cannot smuggle `role: 'admin'` into a schema that never declared
`role`.

**`z.coerce` for query and params only — never for body.** Query strings are
*always* strings, so `"24"` → 24 is repairing HTTP's type system. A JSON
body already has types: a client sending `"quantity": "2"` has a bug, and
coercing it would paper over the disagreement until it surfaces somewhere
worse ([the coercion traps page](../../../expressjs/pages/phase-8-validation-authz/03-coercion-traps.md)
catalogues the endings).

**Bounds on everything.** `limit` caps at 48 (nobody browses 500 products —
that is a scraper or a DoS probe); strings carry max lengths; the cursor is
size-capped base64. Every missing bound is a resource decision delegated to
the least trusted party in the system.

**`req.valid`, not mutation.** The middleware writes the parsed result to
its own property instead of overwriting `req.query`/`req.body` — handlers
that read `req.valid.query` are grep-ably *inside* the boundary, and any
handler touching `req.query` directly is visibly outside it in review.

**Business rules stay out.** "Stock is insufficient" is not a validation
error — it needs the database and belongs to the service (chapter 07 returns
it as a domain error). The boundary checks what is knowable from the bytes
alone; `.refine` is for *cross-field shape* (min ≤ max), not for state.

## Gotchas

- **Symptom:** admin product-attribute updates fail with `Unrecognized key`
  on legitimate new attributes. **Cause:** `.strict()` on the free-form
  `attributes` object — the one place the schema must be open by design.
  **Fix:** `attributes: z.record(z.string().max(40), AttrValue)` — a
  *record* schema constrains keys and values without enumerating them; per
  [chapter 1·08's discipline](../phase-1-database/08-jsonb-attributes.md),
  the per-category allowed keys are checked in the admin service, where the
  category is known.
- **Symptom:** `req.valid.query.limit` is `NaN` and the DB errors.
  **Cause:** `?limit=abc` with a bare `z.number()` — no, that rejects; the
  actual culprit is `z.coerce.number()` *without* `.int().min().max()`,
  which accepts `NaN` in older zod or `Infinity` from `"1e999"`. **Fix:**
  the full chain as written — coerce, then constrain; coercion alone is
  not validation.
- **Symptom:** a pentest reports prototype-pollution attempts returning
  200. **Cause:** `__proto__` keys in a JSON body reaching a naive merge
  somewhere behind a non-strict schema. **Fix:** `.strict()` everywhere
  (the key is rejected at the door), plus the
  [pollution-safe merge rules](../../../nodejs/pages/phase-8-security/13-prototype-pollution.md)
  for the one admin path that deep-merges attributes.

## Interview questions

1. **★ What does "parse, don't validate" change about the layers behind the
   boundary?** Validation-as-predicate leaves the data as it arrived —
   every consumer re-checks or trusts blindly. Parsing produces a *new
   value of a narrower type*; downstream code cannot even express the
   malformed case. The type system (Phase 6 makes this literal) carries
   the proof forward, so the check exists exactly once.
2. **★ Why reject unknown keys instead of stripping them?** Stripping is
   silent: client typos become no-ops, evolving clients get no signal, and
   security reviews can't tell "ignored" from "processed". Rejection gives
   fast client feedback and makes the accepted surface exactly the
   documented one. The cost — coordinated deploys when adding fields — is
   real and paid deliberately (add server-side first, clients follow).
3. **Why is coercing JSON body types more dangerous than coercing query
   strings?** Query coercion converts within one honest encoding (HTTP
   made everything strings). Body coercion *reconciles a disagreement*
   between client and server about what type a field is — the client's
   model is already wrong, and coercion hides it until the field reaches
   code that cares (comparison, storage, another consumer of the same
   client).
4. **Where does "quantity must not exceed stock" get checked, and why not
   here?** In the checkout service, inside the transaction, against locked
   rows ([chapter 1·06](../phase-1-database/06-the-checkout-transaction/01-the-transaction.md)) —
   the only place the answer is race-free. The boundary's `max(99)` on
   quantity is a *plausibility* bound, not the business rule; conflating
   them puts a stale database read at the door and a false confidence
   behind it.

---

← Prev: [Project structure](01-project-structure.md) ·
Next → **Auth** *(not written yet)*
