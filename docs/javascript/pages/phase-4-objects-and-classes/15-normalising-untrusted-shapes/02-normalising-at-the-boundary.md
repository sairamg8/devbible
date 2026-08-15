---
title: "2 · Normalising at the boundary"
sidebar_label: "2 · Normalising at the boundary"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Number()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/Number), [`Number.isFinite()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite), [`parseInt()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt), [`Array.isArray()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray), [`Date`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date), [`Object.fromEntries()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries), [`Object.create()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone). Documentation-validated; **no timings**.

**Normalise once, where the data arrives. Everything inward gets a shape you defined.**

The alternative — defending at every read — is what produces a codebase where `?.` appears two
hundred times and every component has a slightly different opinion about what a missing price
means. The boundary is one place; the reads are everywhere.

```js
export function toProduct(raw) {
  return {
    id:        String(raw?.id ?? ""),
    name:      String(raw?.name ?? "Untitled"),
    priceCents: toInt(raw?.price_cents, 0),
    tags:      Array.isArray(raw?.tags) ? raw.tags.map(String) : [],
    inStock:   Boolean(raw?.in_stock),
    createdAt: toDate(raw?.created_at),
  };
}
```

Four properties this shape has, and each is deliberate:

1. **It is total** — every input produces a `Product`, never a throw and never `undefined`.
2. **Every field has a type that cannot be absent.** Downstream code never writes `?.` again.
3. **It renames** — `price_cents` becomes `priceCents` once, here, not in forty components.
4. **It drops everything else.** Unknown keys do not travel inward, so a field the API adds cannot
   collide with one of yours.

## The converters, and why each is not obvious

```js
function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
```

🔴 **`Number("")` is `0`, and `Number(null)` is `0`.** An empty form field therefore becomes a real
zero unless you check for it first — which is why the fallback belongs *outside* the coercion and
why a bare `Number(x) || fallback` is wrong twice over (it also rejects a legitimate `0`).

⚠️ **`parseInt` is the wrong tool here.** `parseInt("12px")` is `12` and `parseInt("abc")` is `NaN`
— it reads a prefix, which is right for CSS values and wrong for a field that should have been a
number. Use `Number` when the whole string must be numeric.

```js
function toDate(value) {
  const d = new Date(value ?? "");
  return Number.isNaN(d.getTime()) ? null : d;
}
```

**`new Date("garbage")` does not throw** — it returns an Invalid Date, an object that behaves
normally until you format it and get `"Invalid Date"` in the UI. The only reliable test is
`Number.isNaN(d.getTime())`.

```js
const STATUSES = ["draft", "published", "archived"];
const toStatus = (v) => (STATUSES.includes(v) ? v : "draft");
```

**An enum is an allowlist with a fallback.** Anything else lets an unknown status from a newer
server version flow into a `switch` that has no case for it.

## Where the boundary is

- **HTTP responses** — in the fetch wrapper or the API client, not in the component.
- **`localStorage` / `sessionStorage`** — always strings, always possibly stale from an older
  version of your own code, and `JSON.parse` on them always needs a `try`.
- **Query strings and route params** — every value is a string; `?page=abc` is a real request.
- **`postMessage`, `WebSocket` frames, file uploads** — sender is not under your control.
- **Environment variables and config files** — `process.env.PORT` is `"3000"`, a string, and
  `PORT=0` is a legitimate value that `||` would eat.

⚠️ **Your own database is a boundary too** if the rows predate a schema change. "We wrote it, so it
is fine" is how a nullable column added last year becomes a crash today.

## Making it hard to skip

A normaliser only helps if it cannot be bypassed. Two mechanisms, in increasing strength:

**Return the normalised type from the only function that fetches.** If `getProduct()` is the sole
export and it returns `Product`, no caller can hold a raw payload.

**Freeze the result** so a consumer cannot mutate a shared object —
[12 · `Object.freeze` and `seal`](../12-freeze-and-seal/README.md), and note that a shallow freeze
is enough here precisely because a normalised shape is shallow by design.

For a lookup keyed by data, build it with a null prototype so an `id` of `"constructor"` cannot
collide — [14 · `Object.create` and dictionaries](../14-object-creation-patterns/02-object-create-and-dictionaries.md):

```js
const byId = Object.assign(Object.create(null), Object.fromEntries(products.map((p) => [p.id, p])));
```

🔴 **And never merge untrusted keys into an object you did not build null-prototyped** — that is
prototype pollution, and a normaliser that copies known fields by name is immune to it by
construction. **Copying a fixed list of fields is a security property, not just tidiness.**

## Throw, or return a fallback?

Both are right, in different places:

| | Total normaliser (fallbacks) | Validating parser (throws / returns a result) |
|---|---|---|
| Bad input becomes | a safe default | an error you must handle |
| Good for | rendering, analytics, anything cosmetic | money, permissions, anything you write back |
| Risk | a silent wrong value | an unhandled failure path |

🔴 **The rule that resolves it: never default a value you are going to write back or charge for.**
A missing display name can become `""`. A missing price must not become `0`.

A middle form avoids exceptions for expected failures:

```js
const result = parseProduct(raw);            // { ok: true, value } | { ok: false, error }
if (!result.ok) return renderError(result.error);
```

## Schema libraries, and when they earn their place

Zod, Valibot, Ajv and friends do exactly what the hand-written normaliser above does, with better
error messages and — in TypeScript — a type inferred from the schema, so the type and the runtime
check cannot drift apart.

**Reach for one when** there are more than a handful of shapes, when errors must name the offending
field, or when you are in TypeScript and want the type derived from the validator rather than
declared twice.

**Hand-written is fine when** there are one or two shapes and you would rather not add a dependency
to the client bundle.

🔴 **What is never fine is a TypeScript type assertion instead of a check.**

```ts
const product = (await res.json()) as Product;   // 🔴 checks nothing at runtime
```

`as` is a claim to the compiler, erased at build time. `res.json()` returns `any`/`unknown` for a
reason: **the value came from outside the program**. Parse it, then the type is earned rather than
asserted.

## Gotchas

**Symptom:** An empty form field became `0` in the database
**Cause:** `Number("")` is `0`, and `Number(null)` is `0` too.
**Fix:** Check for absence before coercing; keep the fallback outside the conversion.

**Symptom:** A legitimate `0` was replaced by the default
**Cause:** `Number(x) || fallback` — `||` treats `0` as missing.
**Fix:** `Number.isFinite(n) ? n : fallback`.

**Symptom:** `"12px"` became the number `12`
**Cause:** `parseInt` reads a numeric prefix and stops.
**Fix:** `Number()` when the entire string must be a number.

**Symptom:** `"Invalid Date"` rendered in the UI
**Cause:** `new Date(bad)` returns an Invalid Date instead of throwing.
**Fix:** `Number.isNaN(d.getTime())` and normalise to `null`.

**Symptom:** A `switch` on a status fell through to no case
**Cause:** A newer server sent a value the client has never heard of.
**Fix:** Normalise enums against an allowlist with a fallback.

**Symptom:** `?page=abc` produced `NaN` deep inside pagination
**Cause:** Query-string values are always strings and were never validated.
**Fix:** Normalise route and query params at the router boundary like any other input.

**Symptom:** A property appeared on every object in the app after a merge
**Cause:** Prototype pollution from an untrusted `__proto__` key.
**Fix:** Copy a fixed list of known fields, or build the target with `Object.create(null)`.

**Symptom:** TypeScript said the payload was valid and it was not
**Cause:** A type assertion (`as Product`) is erased at build time and checks nothing.
**Fix:** Parse and validate at runtime; let the type follow from the parser.

**Symptom:** Data read from `localStorage` crashed after a deploy
**Cause:** It was written by an older version of the same app.
**Fix:** Treat your own storage as untrusted, version the key, and normalise on read.

## Interview questions

**★ What does "normalise at the boundary" mean, and why?**
Convert untrusted input into a shape you defined, once, at the point it enters the program — the
API client, the storage read, the router. Everything inward then has fields that cannot be absent,
so the `?.` and the `??` live in one function instead of every consumer, and the mapping from their
names to yours happens once.

**★ What makes a good normaliser?**
It is total (every input yields a valid value, no throw), every field has a non-absent type, it
renames external fields to internal ones, and it drops everything it does not know about. That last
point is also a security property — copying a fixed list of fields makes prototype pollution
impossible by construction.

**★ Why is `Number(x) || fallback` wrong?**
Twice over. `Number("")` and `Number(null)` are both `0`, so genuinely empty input becomes a real
zero; and `||` then treats a legitimate `0` as missing and replaces it. Use
`Number.isFinite(n) ? n : fallback`.

**★ When should a normaliser throw instead of defaulting?**
When the value is written back or acted on — money, permissions, identifiers. Default the cosmetic
things; refuse the consequential ones. A silent wrong price is worse than a handled error.

**★ Why is `as Product` on a `fetch` response a problem?**
Type assertions are compile-time only and erased at build. `res.json()` is `any`/`unknown`
specifically because the value came from outside the program. Asserting a type does not make the
data have it; a runtime parse does, and then the type is a consequence rather than a claim.

**When is a schema library worth the dependency?**
More than a handful of shapes, or errors that must name the offending field, or TypeScript where
you want the type inferred from the validator so the two cannot drift. For one or two shapes a
hand-written function is fine and ships nothing.

**Is your own database an untrusted boundary?**
Yes, whenever rows can predate a schema change. A column made nullable last year is a crash today,
and "we wrote it" is not a guarantee about what the row looks like now.

---

← [1 · Reading it safely](./01-reading-a-shape-you-did-not-define.md) · [Topic index](./README.md) · [Phase index](../README.md) →
