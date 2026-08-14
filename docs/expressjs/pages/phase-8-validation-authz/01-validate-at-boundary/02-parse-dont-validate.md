---
title: "Parse, don't validate"
sidebar_label: "02 · Parse, don't validate"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Validating checks the original and then uses it. Parsing returns a *new value*
containing only what the schema described. That one difference eliminates mass
assignment, prototype pollution and unbounded fields for free.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** The Express
> facts referenced are established elsewhere and cited inline: `req.body` is
> `undefined` until a parser runs, `req.query` is a **getter** that cannot be
> assigned to in Express 5 (read from `express@5.2.1`'s `lib/request.js` in
> `sandbox/express-verify/node_modules/`, and stated in the
> [migration guide](https://expressjs.com/en/guide/migrating-5.html) as *"the
> `req.query` property is no longer a writable property and is instead a
> getter"*). **The parse-don't-validate discipline is this bible's guidance** —
> Express provides no validation of any kind, and the library choice is yours.

## The distinction

```js
// ⛔ validate: check, then use the original — the type is still unknown
if (typeof req.body.email !== 'string') return res.sendStatus(400);
await userService.register(req.body);        // still the raw, unbounded object

// ✅ parse: the output is a NEW value whose shape is guaranteed
const input = registerSchema.parse(req.body);  // {email, password} — nothing else
await userService.register(input);
```

Parsing returns a **new object containing only what the schema described**. Three
bug classes die with that one property:

- **Mass assignment** is impossible — `{"email": "…", "role": "admin"}` loses
  `role`, because the schema never mentioned it. A validate-and-pass-through
  approach hands it straight to the service.
- **Prototype pollution** payloads (`__proto__`, `constructor`) do not survive
  into the output object.
- **Unbounded input** is bounded — a `.max()` on a string is the difference
  between a rejected request and a 10 MB value travelling through your system.

🔴 **The most common mistake in Express codebases is calling
`schema.parse(req.body)` and then passing `req.body` onward anyway.** The call
looks like it did something; the value that continues is the raw object. Whatever
library you use, **use its parse output** — and if it is easy to forget, that is
an argument for the factory in
[page 02](../02-validation-factory/README.md), which puts the result somewhere the
handler has to read.

## Where the parsed value goes

🔴 **Not back onto `req.query`.** The Express 4 idiom throws:

```js
req.query = schema.parse(req.query);
// TypeError: Cannot set property query of #<IncomingMessage> which has only a getter
```

`req.query` is a getter in Express 5, which also means it **re-parses on every
access** and returns a new object each time — so mutating it would have been
pointless even where it is allowed
([Phase 1 · 02 · chunk 02](../../phase-1-routing/02-params-and-query/02-the-query-parser.md)).

Put the output on a property of your own:

```js
req.validated = {body, query, params};
```

One property, not three, so a handler reads one thing and a type declaration
covers it in one place
([Phase 8 · 09](../09-type-inference.md)). And **do not** overwrite `req.body`
either: it works, it looks tidy, and it destroys the distinction between "what
arrived" and "what we accepted", which is exactly what you want when debugging.

## Strict by default

A schema that ignores unknown keys is only half a boundary. Most libraries default
to stripping them, which is the safe behaviour; some default to passing them
through, which is not.

| Behaviour | Effect on `{"email": "…", "role": "admin"}` | Verdict |
|---|---|---|
| **strip** unknown keys (typical default) | `{email}` — `role` silently dropped | safe; the caller is not told |
| **error** on unknown keys | 400 with "unrecognized key: role" | safest, and best for a first-party client |
| **passthrough** unknown keys | `{email, role}` | ⛔ mass assignment restored |

**This bible's default: error on unknown keys for first-party APIs, strip for
public ones.** Erroring catches a client that is silently sending a field you
renamed — a real and hard-to-find bug — but on a public API it means every new
optional field a client sends is a 400, and forwards-compatibility usually wins
there.

Whichever you pick, **never passthrough** on a body that reaches a persistence
layer.

## Bound everything, not just the body

The 100 kb body limit says nothing about the shape inside it
([Phase 3 · 03 · chunk 03](../../phase-3-requests/03-size-limits/03-what-it-does-not-protect.md)).
Four bounds worth making habitual:

```js
z.object({
  name:  z.string().min(1).max(200),          // every string
  tags:  z.array(z.string().max(40)).max(20), // every array, and its elements
  page:  z.number().int().min(1).max(10_000), // every number, both ends
  notes: z.string().max(5_000).optional(),
}).strict();
```

- **Every string gets a `.max()`.** A field with no upper bound is a 100 kb field.
- **Every array gets a `.max()`** — an array of 10,000 ids is 10,000 queries, and
  bytes never said so.
- **Every number gets both ends.** `?limit=-1` is the case an upper bound alone
  misses ([Phase 6 · 03 · chunk 01](../../phase-6-rest-surface/03-pagination/01-offset-and-its-drift.md)).
- **Nesting depth is bounded by the schema itself**, which is one more thing a
  hand-rolled check does not give you.

## What a schema cannot do

Being clear about the ceiling, because "we validate at the boundary" is sometimes
treated as the whole of input security:

| Not a schema's job | Whose it is |
|---|---|
| "this id belongs to the caller" | the service, as a **scoped query** — [Phase 8 · 07](../07-ownership.md) |
| "this user may perform this action" | authorization middleware, then the service |
| "this value is unique" | the database constraint, mapped to a 409 |
| "this URL is safe to redirect to" | an allow-list, not a pattern — [Phase 9 · 05](../../phase-9-hardening/05-csrf-and-injection.md) |
| "this HTML is safe to render" | a sanitiser at the point of *output*, not input |
| "this string is not SQL injection" | parameterised queries. A schema is not an escaper |

🔴 **The last two are the ones that get confused.** Escaping and sanitising are
**output** concerns — the same string is safe in JSON, dangerous in HTML, and
irrelevant in a parameterised query. A boundary that tries to strip dangerous
characters on the way *in* corrupts legitimate data and still misses contexts it
did not anticipate.

## Trade-off

A schema per endpoint is real work: every field is declared twice — once in the
schema, once in whatever type or model it becomes — and adding a field means
touching both. Teams feel this most on internal APIs where the caller is their own
front end and "we control the client" feels like a reason to skip it.

**It is not.** The client is not the only caller — curl, a replayed request, a
compromised token, a future integration. And the payoff is not merely security:
services that receive parsed input can stop defending themselves, so every
function below the boundary gets simpler and its tests get shorter.

Where you can genuinely economise is by **generating the type from the schema**
rather than writing both ([page 09](../09-type-inference.md)), which removes the
duplication rather than the check.

## Gotchas

**Symptom:** A user promotes themselves by adding `"role": "admin"` to a profile
update
**Cause:** Mass assignment — the raw body was passed to the service after
validation
**Fix:** Use the **parse output**, never the original object. An unlisted key must
not survive the boundary

**Symptom:** `TypeError: Cannot set property query of #<IncomingMessage> which has
only a getter`
**Cause:** The Express 4 idiom `req.query = schema.parse(req.query)`
**Fix:** `req.validated = …`. And note the getter re-parses on every access, so
mutating it was never meaningful

**Symptom:** `schema.parse(req.body)` is called and the bug persists
**Cause:** The handler then used `req.body` anyway
**Fix:** Assign the result and read only that. A factory that puts it on
`req.validated` makes the raw object easy to stop reaching for

**Symptom:** Clients started getting 400s after adding a harmless new field
**Cause:** A strict schema on a public API
**Fix:** Strip rather than error on public surfaces; error on first-party ones,
where an unexpected key is usually a rename someone missed

**Symptom:** Validation passes but the database rejects the row
**Cause:** Schema and constraints disagree — a length or enum drifted
**Fix:** Keep them aligned deliberately, and treat a constraint violation reaching
the client as a bug in the schema

**Symptom:** A sanitiser strips apostrophes from names to "prevent SQL injection"
**Cause:** Escaping treated as an input concern
**Fix:** Parameterised queries. Escaping is contextual and belongs at output; on
input it corrupts data and still misses contexts

## Interview questions

**★ What is the difference between "validate" and "parse", and why does it
matter?**
Validating checks the original and then uses it; parsing returns a **new value
containing only what the schema described**. Parsing eliminates mass assignment,
prototype pollution and unbounded fields for free — validating leaves all three
possible, because the raw object is what continues downstream.

**★ How does an attacker escalate privileges through a profile-update endpoint?**
Mass assignment: add `"role": "admin"` to the body. If the handler validates and
then passes `req.body` through, the extra key survives. Passing the parse output
makes it impossible, because the schema never mentioned `role`.

**★ Where do you put the parsed value, and why not back on `req.query`?**
On a property of your own — `req.validated`. `req.query` is a getter in
Express 5, so assigning to it throws; and because it re-parses on every access,
mutating it would have been pointless anyway.

**★ Should a schema error on unknown keys or strip them?**
Error for a first-party API, where an unexpected key usually means a rename
someone missed; strip for a public one, where forwards-compatibility matters more.
Never passthrough on anything that reaches persistence.

**What can a schema not do?**
Ownership, authorization, uniqueness, redirect safety, and escaping. The last is
the one that gets confused: escaping is an **output** concern, because the same
string is safe in JSON and dangerous in HTML — stripping characters on input
corrupts data and still misses contexts.

**Why bound individual fields when the body already has a limit?**
Because 100 kb leaves plenty of room for one 10 MB-equivalent field after
decompression, and an array of 10,000 short ids is 10,000 queries. Bytes are not
work, so every string and array needs its own `.max()`.

---

← Prev: [What untrusted means](01-what-untrusted-means.md) · Index: [Validate at the boundary](README.md) · Next topic → [Validation factory](../02-validation-factory/README.md)
