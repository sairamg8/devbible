---
title: "What untrusted actually means"
sidebar_label: "01 · What untrusted means"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Everything from the network is untrusted — and not just the values. The
**types** and the **shape** are attacker-controlled too, which is the half that
truthiness checks miss.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** Express states
> the premise itself: *"as `req.query`'s shape is based on user-controlled input,
> all properties and values should be validated before trusting"*
> ([request reference](https://expressjs.com/en/5x/api/request.html)) — **shape**,
> not only value, which is the whole point of this page. Two documented facts make
> the boundary concrete: **`req.body` is `undefined` until a body parser runs**
> and stays `undefined` when the `Content-Type` did not match
> ([express reference](https://expressjs.com/en/5x/api/express.html)), and Express
> **validates nothing** — it ships six built-in middleware and none of them is a
> validator. The `req.params` null-prototype and the array-from-repeated-keys
> behaviours are read from `path-to-regexp@8.4.2` and Node's `querystring` in
> `sandbox/express-verify/node_modules/`
> ([Phase 1 · 02](../../phase-1-routing/02-params-and-query/README.md)). Zod,
> Valibot and the rest are packages; **the boundary habit is this bible's
> guidance.**

## Every surface, and what an attacker controls

The word "untrusted" is used so often it stops meaning anything. Concretely, a
request can lie about all of these, and every row has produced real
vulnerabilities:

| Source | What an attacker controls | The specific trap |
|---|---|---|
| `req.body` | every key, every value, the **type** of every value, and the nesting | mass assignment; `{"$ne": null}` |
| `req.query` | the same — plus arrays appear from **repeated keys with no bracket syntax** | `?role=a&role=b` is `['a','b']` on the *default* parser |
| `req.params` | the segment content | `../` traversal; a 10 MB segment; **a null-prototype object**, so `req.params.hasOwnProperty` throws |
| `req.headers` | all of them, including `X-Forwarded-For` unless a proxy overwrites it | `req.ip` becomes client-chosen with `trust proxy: true` |
| `req.cookies` | values are client-side storage | a signed cookie proves **origin, not truth** — and it is still readable |
| the URL itself | length, encoding, casing | a malformed `%` escape is a 400 from `decodeParam`, not a 500 |

🔴 **Type is the one people forget.** `{"id": 42}` and `{"id": {"$gt": 0}}` are
both valid JSON bodies, and only a parser that checks the shape rejects the
second. `if (!req.body.id) return 400` passes both — and passes `[]`, `"aaaa…"`
(10 MB) and `{"$ne": null}` as well.

## Four things a truthiness check accepts

Worth spelling out, because "we validate" usually means exactly this check:

```js
if (!req.body.email) return res.sendStatus(400);
```

| Payload | Passes? | What happens next |
|---|---|---|
| `{"email": {"$ne": null}}` | ✅ | a Mongo query becomes "any user" — NoSQL injection |
| `{"email": ["a@b.c", "x@y.z"]}` | ✅ | `email.toLowerCase()` throws, or the array is coerced to `'a@b.c,x@y.z'` |
| `{"email": "a".repeat(10_000_000)}` | ✅ | 10 MB travels through the system, well inside the 100 kb body limit if compressed |
| `{"email": "ok@x.com", "role": "admin"}` | ✅ | mass assignment, if the raw object continues downstream |

None of those is exotic. All four are the *first* things a scanner tries.

## Where the trust boundary actually is

Not "at the edge of the system" — that is too vague to act on. **The boundary is
the line where a value stops being `unknown` and starts being a declared type.**
In an Express app that line should be one middleware per route, and everything
below it should be able to stop defending itself.

Three things follow:

- **The boundary is per route, not per app.** A global "sanitiser" that strips
  suspicious characters is not a boundary — it does not know what any endpoint
  expects, so it can only guess, and guessing produces both false positives and
  gaps.
- **The boundary produces a value, not a verdict.** A check that returns
  `true`/`false` leaves the original object in play, which is the subject of
  [chunk 02](02-parse-dont-validate.md).
- **Below the boundary, defensive checks are noise.** A service that re-checks
  `typeof input.email === 'string'` is either duplicating the schema or admitting
  the boundary is not trusted — and both are worth fixing rather than tolerating.

## What Express does and does not do for you

| Concern | Express | You |
|---|---|---|
| Turning bytes into `req.body` | ✅ `body-parser`, gated on `Content-Type` | mount it |
| Rejecting an oversize body | ✅ `limit`, 413 | choose the number |
| Rejecting a malformed JSON body | ✅ 400 `entity.parse.failed` | map the error |
| Checking that `email` is a string | ❌ **nothing** | a schema |
| Removing keys you did not ask for | ❌ **nothing** | parse, not validate |
| Bounding a single field's length | ❌ **nothing** | `.max()` per field |
| Knowing that `id` belongs to the caller | ❌ **nothing** | the service, scoped |

The middle three rows are the whole subject. Express's built-ins stop at "this is
syntactically a JSON object of at most 100 kb" — which is a real defence and is
nowhere near a validated input
([Phase 3 · 02](../../phase-3-requests/02-json-and-urlencoded/README.md)).

## Why not just rely on the database?

The database *does* enforce constraints, and relying on that alone fails in four
ways:

1. **Too late.** Work has already happened — rows written in the same
   transaction, external calls made, jobs enqueued.
2. **Bad errors.** A constraint violation is a driver error naming a constraint.
   Turning it into a useful 400 with a field name means parsing driver strings,
   and forwarding it raw leaks schema details
   ([Phase 5 · 03 · chunk 02](../../phase-5-errors/03-error-contract/02-what-is-safe-to-expose.md)).
3. **It cannot see most of it.** Nothing in a schema constrains "this string must
   be a valid URL", "this array has at most 50 items", or "this id must belong to
   the caller".
4. **It is not the only consumer.** Data reaches queues, caches and external APIs
   without passing a table.

**Validate at the boundary *and* constrain in the database.** They defend
different things — the boundary defends your code, the constraint defends your
data. A boundary check can be bypassed by a bug; a constraint cannot.

## Gotchas

**Symptom:** A field passes validation as an object instead of a string
**Cause:** Only presence or truthiness was checked, not type
**Fix:** Type checks are the point. `if (!req.body.id)` accepts `{$ne: null}`, an
array, and a 10 MB string

**Symptom:** `Cannot read properties of undefined (reading 'email')`
**Cause:** `req.body` is `undefined` — no parser mounted, or the `Content-Type`
did not match the parser's `type`
**Fix:** Mount `express.json()` above the route, and let the schema reject a
missing body rather than crashing on it

**Symptom:** `req.query.role.toLowerCase is not a function`, only in production
**Cause:** The parameter was sent twice, so the **default** parser produced an
array — no bracket syntax needed
**Fix:** A schema that rejects arrays, or an explicit `typeof === 'string'` check

**Symptom:** `req.params.hasOwnProperty(...)` throws
**Cause:** For string paths, `path-to-regexp` builds params with
`Object.create(null)` — no prototype
**Fix:** `Object.hasOwn`. Note a RegExp route uses a plain object, which makes
this look intermittent

**Symptom:** A 10 MB string field exhausts memory downstream
**Cause:** No `.max()` on the field; a 100 kb body has plenty of room for one
**Fix:** Bound every string and array in the schema, not just the body as a whole

**Symptom:** A global sanitiser blocks a legitimate value containing an
apostrophe
**Cause:** Guessing at intent instead of declaring it per endpoint
**Fix:** A schema per route. Sanitising by pattern produces both false positives
and gaps

## Interview questions

**★ Which part of a request is untrusted?**
All of it — body, query, params, headers, cookies — and not just the values but
the **types and the shape**. Express's own documentation says `req.query`'s shape
is user-controlled, which is the sentence the whole topic rests on.

**★ Why is a truthiness check insufficient?**
`if (!req.body.id)` accepts `{"$ne": null}`, an array, and a 10 MB string.
Presence is not type, and type is where the exploits live — the NoSQL-injection
payload and the mass-assignment payload both pass every presence check.

**★ What does Express validate?**
Nothing. It ships six built-in middleware and none is a validator. `body-parser`
gets you as far as "this is syntactically JSON, under the limit, with a matching
content type" — a real defence, and nowhere near a validated input.

**★ Why not rely on the database's constraints?**
They fire too late (work has already happened), produce driver errors that leak
schema names when forwarded, cannot express most rules — URL format, array
length, ownership — and are not the only consumer, because data also reaches
queues, caches and external APIs. Do both: the boundary defends your code, the
constraint defends your data.

**Where exactly is the trust boundary?**
The line where a value stops being `unknown` and becomes a declared type — one
middleware per route. It is per route rather than per app, because a global
sanitiser does not know what any endpoint expects and can only guess.

**What should code below the boundary do about validation?**
Nothing. A service re-checking `typeof input.email === 'string'` is either
duplicating the schema or admitting the boundary is not trusted, and both are
worth fixing rather than tolerating.

---

Index: [Validate at the boundary](README.md) · Next → [Parse, don't validate](02-parse-dont-validate.md)
