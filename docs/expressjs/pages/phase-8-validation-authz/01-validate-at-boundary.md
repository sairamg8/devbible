---
title: "Validate at the HTTP boundary"
sidebar_label: "01 · Validate at boundary"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Everything from the network is untrusted. Parse it before services run.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> Express states the premise itself: *"as `req.query`'s shape is based on user-controlled
> input, all properties and values should be validated before trusting"*
> ([request reference](https://expressjs.com/en/5x/api/request/)) — **shape**, not only
> value, which is the whole point below. Two documented facts make the boundary concrete:
> **`req.body` is `undefined` until a body parser runs** and stays `undefined` when the
> `Content-Type` did not match ([express reference](https://expressjs.com/en/5x/api/express/)),
> and Express **validates nothing** — it ships six built-in middleware and none of them
> is a validator. Zod, Valibot and the rest are packages; the boundary habit is yours.

The principle outlives Zod. Whether you use Zod, Valibot, or hand parsers,
**services receive validated data**, not `req.body`.

## What "untrusted" actually covers

The word is used so often it stops meaning anything. Concretely, a request can
lie about all of these, and every one has produced real vulnerabilities:

| Source | What an attacker controls |
|---|---|
| `req.body` | Every key, every value, the **type** of every value, and the nesting |
| `req.query` | Same — plus arrays appear from repeated keys with no bracket syntax |
| `req.params` | The segment content: `../`, a 10 MB string, a `$ne` object in some parsers |
| `req.headers` | All of them, including `X-Forwarded-For` unless a proxy overwrites it |
| `req.cookies` | Values are client-side storage; signed cookies prove origin, not truth |

**Type is the one people forget.** `{"id": 42}` and `{"id": {"$gt": 0}}` are both
valid JSON bodies, and only a parser that checks the shape rejects the second.
Checking `if (!req.body.id) return 400` passes both.

## Parse, don't validate

The distinction is not pedantry — it changes what the rest of your code can assume.

```js
// ⛔ validate: check, then use the original — the type is still unknown
if (typeof req.body.email !== 'string') return res.sendStatus(400);
await userService.register(req.body);        // still the raw, unbounded object

// ✅ parse: the output is a NEW value whose shape is guaranteed
const input = registerSchema.parse(req.body);  // {email, password} — nothing else
await userService.register(input);
```

Parsing returns a **new object containing only what the schema described**. That
single property kills a whole class of bug:

- **Mass assignment** is impossible — `{"email": "…", "role": "admin"}` loses `role`
  because the schema never mentioned it. A validate-and-pass-through approach hands
  it straight to the service.
- **Prototype pollution** payloads (`__proto__`, `constructor`) do not survive.
- **Unbounded input** is bounded — a `.max()` on a string is the difference between
  a rejected request and a 10 MB value travelling through your system.

**Whatever library you use, use its parse output.** The most common mistake in
Express codebases is calling `schema.parse(req.body)` and then passing `req.body`
onward anyway.

## Why the boundary, and not the database

The database *does* enforce constraints, and relying on that alone fails in four
ways:

1. **Too late.** Work has already happened — rows written in the same transaction,
   external calls made, jobs enqueued.
2. **Bad errors.** A constraint violation is a driver error with a constraint name.
   Turning it into a useful 400 with a field name means parsing driver strings, and
   [Phase 5](../phase-5-errors/03-error-contract.md) explains why forwarding it raw
   leaks schema details.
3. **It cannot see most of it.** Nothing in a schema constrains "this string must be
   a valid URL", "this array has at most 50 items", or "this id must belong to the
   caller".
4. **It is not the only consumer.** Data reaches queues, caches and external APIs
   without passing a table.

Validate at the boundary *and* constrain in the database. They defend different
things — the boundary defends your code, the constraint defends your data.

## Trade-off

A schema per endpoint is real work: every field is declared twice — once in the
schema, once in whatever type or model it becomes — and adding a field means
touching both. Teams feel this most on internal APIs where the caller is their own
front end and "we control the client" feels like a reason to skip it.

It is not. **The client is not the only caller** — curl, a replayed request, a
compromised token, a future integration. And the payoff is not merely security:
services that receive parsed input can stop defending themselves, so every function
below the boundary gets simpler and its tests get shorter.

Where you can genuinely economise is by **generating the type from the schema**
rather than writing both ([page 09](09-type-inference.md)), which removes the
duplication rather than the check.

## Gotchas

**Symptom:** A user promotes themselves by adding `"role": "admin"` to a profile update  
**Cause:** Mass assignment — the raw body was passed to the service after validation  
**Fix:** Use the **parse output**, never the original object. An unlisted key must not
survive the boundary

**Symptom:** `Cannot read properties of undefined (reading 'email')`  
**Cause:** `req.body` is `undefined` — no body parser mounted, or the `Content-Type` did
not match the parser's `type`  
**Fix:** Mount `express.json()` before the route, and let the schema reject a missing
body rather than crashing on it

**Symptom:** A field passes validation as an object instead of a string  
**Cause:** Only presence or truthiness was checked, not type  
**Fix:** Type checks are the point. `if (!req.body.id)` accepts `{$ne: null}`

**Symptom:** Validation passes but the database rejects the row  
**Cause:** Schema and constraints disagree — a length or enum drifted  
**Fix:** Keep them aligned deliberately; treat a constraint violation reaching the client
as a bug in the schema

**Symptom:** A 10 MB string field exhausts memory downstream  
**Cause:** No `.max()` on the field; the 100 kb body limit allows plenty of room  
**Fix:** Bound every string and array in the schema, not just the body as a whole

## Interview questions

**★ Why not validate only in the database?**  
Late failures, worse errors, and injection risk before you reach the DB.

**★ What is the difference between "validate" and "parse", and why does it matter?**  
Validating checks the original and then uses it; parsing returns a **new value
containing only what the schema described**. Parsing eliminates mass assignment,
prototype pollution and unbounded fields for free — validating leaves all three
possible, because the raw object is what continues downstream.

**★ How does an attacker escalate privileges through a profile-update endpoint?**  
Mass assignment: add `"role": "admin"` to the body. If the handler validates and then
passes `req.body` through, the extra key survives. Passing the parse output makes it
impossible.

**Which part of a request is untrusted?**  
All of it — body, query, params, headers, cookies — and not just the values but the
**types**. Express's own docs warn that `req.query`'s shape is user-controlled.

**Why is a truthiness check insufficient?**  
`if (!req.body.id)` accepts `{"$ne": null}`, an array, or a 10 MB string. Presence is
not type, and type is where the exploits live.

---

← Index: [Phase 8](README.md) · Next → [Validation factory](02-validation-factory.md)
