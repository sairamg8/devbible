---
title: "Filtering, sorting, search"
sidebar_label: "04 · Filter · sort · search"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**Allow-list fields and operators. Never pass raw `req.query` into Mongo or SQL builders.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> This is the one page in the phase whose core claim Express states itself: *"as
> `req.query`'s shape is based on user-controlled input, all properties and values should
> be validated before trusting (e.g., `req.query.foo.toString()` may fail if `foo` is not
> present or not a string)"*
> ([request reference](https://expressjs.com/en/5x/api/request/)).
> **Shape, not just value** — that is the whole operator-injection problem below.
> Express 5's `simple` query parser narrows the blast radius without closing it: bracket
> keys stay literal, but repeated keys still produce **arrays** where your code expects a
> string ([Phase 1](../phase-1-routing/02-params-and-query.md)). Parameterised queries
> are [Node Phase 6](../../../nodejs/pages/phase-6-data-access/README.md).

## Safe pattern

```js
const SORTABLE = new Set(['createdAt', 'name']);
const sort = SORTABLE.has(req.query.sort) ? req.query.sort : 'createdAt';
```

Search endpoints that hit full-text indexes belong behind explicit `q` params and
timeouts — do not run unbounded scans on the request thread (Node event loop).

## The shape attack, concretely

Value validation is the part everyone writes. **Shape** validation is the part that
gets missed, and it is where the exploit lives.

```js
// ⛔ every value here is "just a string" — and the object is not what you think
// ?email[$ne]=x           → {email: {$ne: 'x'}}      matches ANY user
// ?email[$regex]=.*       → {email: {$regex: '.*'}}  matches ANY user
// ?role=user&role=admin   → {role: ['user','admin']} an array, not a string
const user = await User.findOne(req.query);
```

Express 5's `simple` parser keeps `email[$ne]=x` as the literal key `'email[$ne]'`,
which defuses the first two — **but only until someone sets `query parser` to
`extended`**, or the value reaches a layer that parses brackets itself. The third
case needs no bracket syntax at all and works on every parser.

The defence is not "escape the input". It is **never hand the request object to a
query builder**. Construct the filter yourself, field by field, from an allow-list:

```js
const FILTERABLE = new Set(['status', 'email']);

const filter = {};
for (const [key, value] of Object.entries(req.query)) {
  if (!FILTERABLE.has(key)) continue;
  if (typeof value !== 'string') continue;   // rejects arrays AND objects
  filter[key] = value;
}
```

Two lines carry the weight: the allow-list decides *which* keys exist, and the
`typeof` check decides that a value is a string rather than a structure. Skipping
either one is how this becomes a CVE.

## Sorting is an availability concern too

An allow-list on sort fields is usually explained as injection defence. The bigger
day-to-day reason is **indexes**: sorting on an unindexed column makes the database
sort the whole result set, and a user who can name any column can trivially find
the slow one. `SORTABLE` should list the columns you have indexes for, and the
direction should be an enum (`asc`/`desc`), never a passthrough string.

## Search needs a bound, always

Full-text search is the endpoint most likely to be handed a pathological input.
Three bounds, none optional:

1. **A minimum query length.** `q=a` scans everything and returns nothing useful.
2. **A statement timeout** on the database side, so a slow scan fails instead of
   occupying a connection.
3. **A result cap**, independent of pagination.

The event-loop framing matters here: the scan itself happens in the database, so
it does not block Node — but the connection it holds is from a fixed-size pool, and
exhausting the pool stalls every other request just as effectively
([Node Phase 6](../../../nodejs/pages/phase-6-data-access/README.md)).

## Trade-off

An allow-list means every new filterable field is a code change — a client cannot
add `?createdBefore=` without you shipping something. That friction is the feature:
it forces each field through review, where someone can ask whether it is indexed
and whether it exposes anything.

Generic filter languages (`?filter={"$and":[…]}`, GraphQL-ish query params) remove
the friction and hand clients the ability to write arbitrary, unindexed,
unauthorised queries. If you genuinely need one, it belongs behind a parser you
control that compiles to a restricted subset — never as a pass-through to the
database.

## Gotchas

**Symptom:** `?filter[$gt]=…` operator injection in Mongo  
**Cause:** Merging query objects blindly  
**Fix:** Allow-list + Node Phase 6 parameterized queries

**Symptom:** `req.query.status.toLowerCase is not a function`  
**Cause:** A repeated parameter — `?status=a&status=b` — produced an **array**  
**Fix:** Check `typeof value === 'string'` before using any query value. The docs warn
about exactly this

**Symptom:** An authentication check passes for a request that supplied no password  
**Cause:** A structured value (`{$ne: null}`) reaching a query builder through an object
comparison  
**Fix:** Never pass `req.query` or `req.body` into a query. Build the object from
primitives you validated

**Symptom:** One endpoint is orders of magnitude slower than the rest  
**Cause:** A client sorting on an unindexed column, allowed because sort was passthrough  
**Fix:** `SORTABLE` lists indexed columns only; direction is an enum

**Symptom:** The connection pool exhausts during a traffic spike on search  
**Cause:** Unbounded scans holding connections  
**Fix:** Minimum query length, statement timeout, result cap

## Interview questions

**★ Why allow-list sort fields?**  
Prevents sorting on unindexed or sensitive columns and injection-style operators.

**★ Why is validating query *values* not enough?**  
Because the attack is in the *shape*. `?email[$ne]=x` supplies a perfectly valid
string inside an object, and a query builder reads it as an operator. Express's own
docs warn that `req.query`'s **shape** is user-controlled — check `typeof`, not just
content.

**★ Does Express 5's `simple` query parser fix operator injection?**  
It reduces it — bracket keys stay literal rather than becoming nested objects — but
it does not fix it. Repeated keys still produce arrays, and switching the parser to
`extended` restores the whole problem. Never rely on the parser as the defence.

**A search endpoint is slow under load but the event loop looks healthy. What is happening?**  
The scan runs in the database, not in Node — but each one holds a pooled connection.
Exhaust the pool and every other route waits, with no event-loop lag to show for it.

**Why is an allow-list better than escaping?**  
Escaping tries to make dangerous input safe; an allow-list means dangerous input is
never in the query at all. It also fails closed — an unknown field is ignored rather
than passed through.


---

← Prev: [Pagination](03-pagination.md) · Next → [Versioning](05-versioning.md)
