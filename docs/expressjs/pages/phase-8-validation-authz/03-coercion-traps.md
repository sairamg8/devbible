---
title: "Coercion traps"
sidebar_label: "03 · Coercion traps"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

**Query and params are strings. `z.number()` without coerce fails or needs `z.coerce.number()` deliberately.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> Everything below follows from documented parser behaviour rather than library quirks.
> The default `query parser` is **`"simple"`** — Node's `querystring`
> ([application settings](https://expressjs.com/en/5x/api/application/)) — under which
> `'foo=bar&abc=xyz&abc=123'` parses to `{foo: 'bar', abc: ['xyz','123']}`
> ([`querystring.parse`](https://nodejs.org/api/querystring.html)): **every value is a
> string, and a repeated key silently becomes an array**.
> Three Express 5 changes from the [migration guide](https://expressjs.com/en/guide/migrating-5.html)
> matter here, quoted: *"the `req.query` property is no longer a writable property and is
> instead a getter"*; *"the `req.body` property returns `undefined` when the body has not
> been parsed"* (Express 4 returned `{}`); and **`req.params` now has a null prototype**
> for string paths, with wildcard params being **arrays** and unmatched params *omitted
> entirely* rather than `undefined`.

```js
// ?limit=20 → string "20"
```

Booleans like `?active=false` are the string `"false"` (truthy!). Use explicit enums or coerce helpers.

## The five traps, in order of how often they bite

**1. `"false"` is truthy.** The classic:

```js
if (req.query.active) { /* runs for ?active=false */ }
```

Never coerce a query flag with `Boolean()` or truthiness. Use an explicit enum —
`z.enum(['true','false']).transform(v => v === 'true')` — so `?active=maybe` is a
400 rather than a silent `true`.

**2. A repeated key becomes an array.** `?role=user&role=admin` yields
`['user','admin']`, with no bracket syntax needed and on every parser setting. Any
code doing `req.query.role.toLowerCase()` throws, and any code doing
`req.query.role === 'admin'` silently returns false. **Every query value is
`string | string[]`** until a schema says otherwise — that is the type to write
down.

**3. `z.coerce.number()` accepts more than you think.** Coercion uses `Number()`,
and `Number('')` is `0`, `Number(' ')` is `0`, `Number('0x10')` is `16`,
`Number('1e3')` is `1000`. So `?limit=` becomes a limit of zero, not a missing
value. Bound it: `z.coerce.number().int().min(1).max(100)`.

**4. `NaN` passes a lazy check.** `Number('abc')` is `NaN`, and `NaN` is falsy —
so `const limit = Number(req.query.limit) || 20` quietly works, while
`if (limit < 1)` does not fire, because every comparison with `NaN` is false.

**5. Dates.** `new Date('not-a-date')` returns an Invalid Date rather than throwing,
and it propagates silently until something formats it. Parse dates explicitly and
reject what does not parse.

## Params in Express 5 changed shape

Three changes make `req.params` less object-like than it looks:

```js
// route: '/files/*splat'    request: /files/images/logo.png
req.params.splat            // ['images', 'logo.png']  ← an ARRAY, not a string

// string paths give req.params a NULL PROTOTYPE
req.params.hasOwnProperty('id')   // ⛔ TypeError — the method does not exist
Object.hasOwn(req.params, 'id')   // ✅

// an unmatched optional param is ABSENT, not undefined
'id' in req.params                // false — Express 4 gave you undefined
```

The null prototype is a security improvement — a `__proto__` segment cannot pollute
anything — and it breaks the habit of calling `hasOwnProperty` on it. Use
`Object.hasOwn`, or let a schema do the work.

## Coerce at the boundary, once

The rule that keeps this from spreading: **the schema is the only place coercion
happens.** Below the boundary, a `limit` is a number because the parse output says
so — no defensive `Number()` calls, no `?? 20` defaults scattered through the
service.

```js
const listQuery = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  active: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  tags:   z.union([z.string(), z.array(z.string())])
           .transform((v) => (Array.isArray(v) ? v : [v]))   // trap 2, handled once
           .default([]),
});
```

`tags` shows the shape of the fix for repeated keys: accept both forms at the
boundary and normalise, so nothing downstream ever asks "is this a string or an
array?"

## Trade-off

Explicit coercion schemas are verbose — a three-field query needs a dozen lines,
and it feels like ceremony next to `Number(req.query.limit)`. Cheap alternatives
exist (`z.coerce` everywhere, a global "coerce query params" helper) and they trade
verbosity for silence: `?limit=` becomes `0`, `?active=false` becomes `true`, and
neither raises anything.

**Prefer explicit and noisy.** These bugs do not throw — they produce wrong
behaviour that looks like a feature request ("the filter doesn't work"), and they
are found by users rather than by tests.

## Gotchas

**Symptom:** `?active=false` behaves as `true`  
**Cause:** `"false"` is a non-empty string, therefore truthy  
**Fix:** An explicit enum with a transform. Never truthiness-test a query flag

**Symptom:** `req.query.role.toLowerCase is not a function`  
**Cause:** A repeated key produced an array  
**Fix:** Type query values as `string | string[]` and normalise in the schema

**Symptom:** `?limit=` returns zero rows  
**Cause:** `Number('')` is `0`, and coercion accepted it  
**Fix:** `.min(1)` — and let an empty value be missing rather than zero

**Symptom:** `req.params.hasOwnProperty is not a function`  
**Cause:** Express 5 gives `req.params` a null prototype for string paths  
**Fix:** `Object.hasOwn(req.params, key)`

**Symptom:** A wildcard route builds a broken path  
**Cause:** `req.params.splat` is an **array** in Express 5; joining it with `,` instead
of `/`  
**Fix:** `req.params.splat.join('/')`, and check any Express 4 code reading
`req.params[0]`

**Symptom:** An invalid date silently becomes "Invalid Date" in the database  
**Cause:** `new Date(...)` does not throw on garbage  
**Fix:** Parse and reject at the boundary

## Interview questions

**★ Why is `Boolean("false")` a trap?**  
Non-empty strings are truthy in JavaScript.

**★ What type is a query parameter, really?**  
`string | string[]`. A repeated key — `?role=a&role=b` — produces an array under the
default `simple` parser, with no bracket syntax and no way for the client to signal
intent. Code assuming a string throws or silently mis-compares.

**★ What does `z.coerce.number()` do with `?limit=`?**  
Gives you `0`, because `Number('')` is `0`. Empty becomes a valid zero rather than a
missing value — which is why coerced numbers need `.min()`.

**What changed about `req.params` in Express 5?**  
It has a null prototype for string paths (so `hasOwnProperty` is gone — use
`Object.hasOwn`), wildcard params are arrays, and unmatched params are omitted
entirely rather than being `undefined`.

**Where should coercion happen?**  
Only at the boundary, in the schema. Once the parse output is the value that travels
downstream, no service needs a defensive `Number()` — and there is exactly one place
to fix when a rule changes.


---

← Prev: [Validation factory](02-validation-factory/README.md) · Next → [Authn middleware](04-authn-middleware.md)
