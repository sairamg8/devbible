---
title: "Shape and trust"
sidebar_label: "03 · Shape and trust"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**The caller controls not just the *values* in `req.query` but their **types**.
A validator that checks what a value contains, without checking what it is, is
not a validator.**

> Verified: 2026-08-14. Express's own
> [security best practices](https://expressjs.com/en/advanced/best-practice-security.html)
> warn that `req.query`'s shape is user-controlled and advise validating it. The
> array-from-duplicate-keys behaviour is
> [`querystring.parse`](https://nodejs.org/api/querystring.html)'s, documented
> there; the bracket-nesting behaviour is `qs@6.15.3`'s, reached only under
> `query parser: 'extended'`. **No sandbox run backs this page and it carries no
> console block.** The mitigations are this bible's guidance, stated as such —
> Express provides no validation of any kind.

## Every query value is `string | string[]`

This is true on the **default** parser, with no bracket syntax and no
configuration. `querystring.parse` turns a repeated key into an array:

```text
?role=admin              →  { role: 'admin' }
?role=admin&role=user    →  { role: ['admin', 'user'] }
```

Nothing in your code asked for that, and nothing warns. So:

```js
// ❌ throws on ?role=a&role=b — role is an array
if (req.query.role.toLowerCase() === 'admin') { … }

// ❌ passes on ?role=a&role=admin — Array.includes, not String.includes
if (req.query.role.includes('admin')) { … }

// ❌ silently wrong — Array coerced to 'a,b'
db.query('… WHERE role = $1', [req.query.role]);
```

The last one is the dangerous shape: no crash, no log, a query that ran with a
value nobody intended.

**The rule: check the type before the value.**

```js
const role = typeof req.query.role === 'string' ? req.query.role : undefined;
```

or let a schema do it, which is
[Phase 8 · 03](../../phase-8-validation-authz/03-coercion-traps.md) — with the
warning that a naive `z.string()` on `req.query.role` **fails** for the array
case, which is the correct outcome, and that `z.coerce.number()` accepts `''` as
`0`, which is not.

## Under `extended`, the caller also controls nesting

Switch to `qs` and the type set widens from `string | string[]` to *arbitrary
nested objects*:

```text
?email[$ne]=x            →  { email: { $ne: 'x' } }
?a[hasOwnProperty]=b     →  { a: { hasOwnProperty: 'b' } }
?a[0]=x&a[1]=y           →  { a: ['x', 'y'] }
```

The first line is the NoSQL-injection shape. A handler that does

```js
db.collection('users').findOne({ email: req.query.email })
```

was written expecting a string and receives an operator object; the query becomes
"any user whose email is not `x`", which is the first user in the collection.
Nothing was concatenated, nothing was eval'd, and no amount of escaping would
have helped — the attack is in the **shape**, and the fix is to assert the shape.

⚠️ **`simple` defuses the bracket syntax but not the array case.** On the
default parser `?email[$ne]=x` is the harmless literal key `'email[$ne]'`. But
`?role=a&role=b` is still an array on *both* parsers, and any code path that
switches to `extended` later — a config change, a library default, a new service
copying an old one — re-opens the object case with no code change. **Do not treat
`simple` as the mitigation.** It narrows the surface; the type check is what
closes it.

## Defence, in the order it should be applied

1. **Parse, do not validate.** Run the query through a schema and use the
   schema's **output** — a new object containing only the keys you described.
   Passing `req.query` onward after validating it leaves every unexpected key in
   place. That distinction is the whole of
   [Phase 8 · 01](../../phase-8-validation-authz/01-validate-at-boundary.md).
2. **Allow-list every field name that reaches a query.** Sorting and filtering
   are the two places where a query key becomes an identifier in SQL or a Mongo
   path. `?sort=-created_at` must be looked up in a map, never interpolated —
   [Phase 6 · 04](../../phase-6-rest-surface/04-filter-sort-search.md).
3. **Cap what is uncapped.** `?limit=100000` is a denial-of-service with a valid
   type. Bound it, and prefer cursor pagination so deep pages are not a cost at
   all — [Phase 6 · 03](../../phase-6-rest-surface/03-pagination/README.md).
4. **Never put identity in the query.** `?userId=` invites a caller to change it.
   Identity comes from the authenticated principal, and tenancy should not even
   be *expressible* in the input —
   [Phase 8 · 08](../../phase-8-validation-authz/08-tenant-and-logout.md).

## Trade-off

Rich query languages in the URL — nesting, operators, arbitrary field names —
are genuinely useful, and every one of those features is also an input the
caller controls completely.

**Where the flexibility is worth it:** an internal analytics endpoint with one
trusted client; a search surface whose whole purpose is expressiveness, behind an
allow-list of fields and a hard result cap.

**Where it is not:** anything public, anything multi-tenant, anything whose query
keys become database identifiers. Flat, allow-listed, explicitly typed
parameters cost a few more lines in the client and remove an entire vulnerability
class.

**The middle position that usually wins:** keep `simple`, expose a fixed set of
flat filter parameters, and if a caller genuinely needs a complex query, give it
a `POST /search` with a JSON body and a schema. A body is validated by the same
machinery as every other body, and it does not travel in logs, `Referer` headers
or browser history — which is where a query string with a customer email ends up.

## Gotchas

**Symptom:** `req.query.role.toLowerCase is not a function`, only in production
**Cause:** Someone sent the parameter twice; `querystring.parse` produced an
array. This is the **default** parser — no bracket syntax needed
**Fix:** `typeof x === 'string'` before use, or a schema that rejects arrays

**Symptom:** A Mongo query returns the wrong user and nothing looks malformed
**Cause:** `query parser: 'extended'` let `?email[$ne]=x` arrive as an operator
object, and it was passed straight into `findOne`
**Fix:** Assert the type at the boundary. Escaping cannot help — the payload is a
shape, not a string

**Symptom:** A filter that worked for months silently stops filtering
**Cause:** The parser default changed under an upgrade, so a bracketed key became
a literal one and the handler's `req.query.filter?.status` is `undefined`
**Fix:** Fail closed — an unrecognised or unparseable filter should 400, not be
ignored. A schema with `.strict()` gives you that for free

**Symptom:** `?limit=1000000` takes the service down
**Cause:** A valid integer with no upper bound
**Fix:** Cap it in the schema, and treat the cap as part of the API contract

**Symptom:** Customer emails turn up in access logs and CDN logs
**Cause:** They were query parameters, and query strings are logged everywhere by
default
**Fix:** Move sensitive lookups to a POST body, or hash the identifier

## Interview questions

**★ Why is `typeof req.query.x === 'string'` a necessary check even on the
default parser?**
Because a repeated key produces an array. `?role=a&role=b` gives
`['a','b']` from `querystring.parse` with no bracket syntax involved, so any
string method on it throws and any interpolation of it silently produces `'a,b'`.

**★ What is the NoSQL-injection shape in a query string, and what stops it?**
`?email[$ne]=x`, which under the `extended` parser arrives as
`{email: {$ne: 'x'}}` and turns an equality lookup into "any user except". No
escaping helps, because nothing is being escaped — the attack is the type. The
fix is asserting the shape at the boundary.

**★ Is switching to the `simple` parser a sufficient mitigation?**
No. It removes the bracket-nesting case, but arrays from duplicate keys survive
on both parsers, and a later switch to `extended` re-opens the object case
without any code change. Treat it as narrowing the surface, not closing it.

**★ What does "parse, don't validate" mean for `req.query` specifically?**
Use the schema's **output object**, which contains only the keys the schema
described, rather than validating `req.query` and then passing `req.query`
onward. The second form leaves every unexpected key in place, which is how mass
assignment and unbounded fields survive validation.

**Why should identity never be a query parameter?**
Because the caller chooses it. `?userId=` makes an object-level authorization bug
a one-character exploit. Identity comes from the authenticated principal, and
tenancy is best kept out of the schema entirely so it cannot arrive at all.

**When is a `POST /search` better than a rich query string?**
When the query is genuinely complex, or contains anything sensitive. A body is
validated by the same schema machinery as any other body, has no length limit
problems, and does not end up in access logs, CDN logs, `Referer` headers or
browser history.

---

← Prev: [The query parser](02-the-query-parser.md) · Index: [Params and query](README.md) · Next topic → [Router composition](../03-router-composition/README.md)
