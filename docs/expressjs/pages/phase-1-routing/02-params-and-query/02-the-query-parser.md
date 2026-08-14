---
title: "The query parser"
sidebar_label: "02 · The query parser"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**`req.query` is a getter that re-parses the query string every time you touch
it, using one of four configurable strategies — and the Express docs disagree
with themselves about which one is the default.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. **The console block
> below is re-used unchanged from the earlier authorised `sandbox/express-verify`
> run and is sandbox-measured** — nothing was executed for this rewrite. The
> getter and the parser table are read from `express@5.2.1`'s `lib/request.js`
> (`defineGetter(req, 'query', …)`) and `lib/utils.js` (`compileQueryParser`,
> `parseExtendedQueryString`) in `sandbox/express-verify/node_modules/`. `simple`
> is [`querystring.parse`](https://nodejs.org/api/querystring.html); `extended`
> is **`qs@6.15.3`**, and the `allowPrototypes` warning below is quoted from
> **qs's own README**.

## It is a getter, and it does not cache

```js
// express/lib/request.js
defineGetter(req, 'query', function query(){
  var queryparse = this.app.get('query parser fn');

  if (!queryparse) {
    return Object.create(null);          // parsing disabled
  }

  var querystring = parse(this).query;   // parseurl, which does cache

  return queryparse(querystring);        // ← runs on every access
});
```

Three things fall out of those eight lines.

**1 · Every access re-parses.** `req.query.page` and `req.query.limit` on two
lines are two full parses of the query string, returning **two different
objects**. Consequences:

- `req.query.a === req.query.a` is `false` for any object-valued key.
- Mutating `req.query.filters.status` does nothing — you mutated a throwaway.
- In a hot loop, destructure once: `const {page, limit} = req.query`.

**2 · You cannot assign to it.** This is the Express 5 breaking change quoted in
the migration guide — *"the `req.query` property is no longer a writable property
and is instead a getter"*. The Express 4 validation pattern
`req.query = schema.parse(req.query)` **throws**. Put the parsed value somewhere
of your own — `req.validated` — which is
[Phase 8 · 02](../../phase-8-validation-authz/02-validation-factory/README.md).

**3 · Disabling the parser gives you a null-prototype empty object**, not
`undefined`. `app.set('query parser', false)` means `req.query` is always `{}`
with no prototype, and you read the raw string from `req.url` yourself.

## The four settings

```js
// express/lib/utils.js — compileQueryParser()
switch (val) {
  case true:
  case 'simple':   fn = querystring.parse;         break;
  case false:                                      break;   // disabled
  case 'extended': fn = parseExtendedQueryString;  break;
  default: throw new TypeError('unknown value for query parser function: ' + val);
}
```

| `app.set('query parser', …)` | Parser | Notes |
|---|---|---|
| `'simple'` **(default)** | Node's `querystring.parse` | No bracket syntax. Duplicate keys become arrays |
| `'extended'` | `qs@6.15.3` with `allowPrototypes: true` | Nested objects, arrays, depth limits — and the warning below |
| `false` | none | `req.query` is `Object.create(null)`, always empty |
| a function | yours | `(rawQueryString) => object`. The escape hatch nobody uses and everybody should consider |
| anything else | — | **throws `TypeError` at `app.set` time** |

The custom-function option is underused. If what you actually need is "three
known filters, all strings, nothing nested", a fifteen-line parser is safer than
`extended` and faster than `simple` plus validation — and it fails at the edge
rather than in a handler.

## `simple` in practice

```js
// query.mjs
import express from 'express';

const app = express();
// default query parser on Express 5.2.1 is "simple"
app.get('/search', (req, res) => res.json(req.query));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const u =
    `http://127.0.0.1:${port}/search?a=1&a=2&a[b]=1&q=hello%20world`;
  console.log(await (await fetch(u)).json());
  server.close();
});
```

```console
$ node query.mjs
{ a: [ '1', '2' ], 'a[b]': '1', q: 'hello world' }
```

| Input | `simple` (default) | `extended` (`qs`) |
|---|---|---|
| `a=1&a=2` | `{a: ['1','2']}` | `{a: ['1','2']}` |
| `a[b]=1` | `{'a[b]': '1'}` — **literal key** | `{a: {b: '1'}}` |
| `a[]=1` | `{'a[]': '1'}` | `{a: ['1']}` |
| `q=hello%20world` | `{q: 'hello world'}` | same |
| *(absent)* | `{}` | `{}` |

**Express 4's default was `extended`.** Upgrading silently turns
`req.query.filter.status` into `undefined`, because the key is now the literal
string `'filter[status]'`. Nothing throws; the filter is simply ignored and the
endpoint returns unfiltered data. That is a data-exposure bug wearing the costume
of a parser change, and it is the reason this page exists at Master tier.

## ⚠️ The docs contradict themselves — and the source settles it

The [`req.query` reference](https://expressjs.com/en/5x/api/request.html) still
says the parser *"by default uses the `qs` module"*. That sentence is left over
from Express 4. The 5.x settings table and the migration guide say `simple`.

**The source says `simple`** — `this.set('query parser', 'simple')`, one line in
`defaultConfiguration`
([Phase 0 · 01 · chunk 03](../../phase-0-express-basics/01-what-express-is/03-what-express-delegates.md)).
When it matters for a version you did not read the source of, **read it back**:

```js
app.get('query parser')       // 'simple' on a default Express 5.2.1 app
```

## 🔴 `extended` enables an option qs itself warns against

```js
// express/lib/utils.js
function parseExtendedQueryString(str) {
  return qs.parse(str, {
    allowPrototypes: true
  });
}
```

From **qs's own README**, on that option:

> By default parameters that would overwrite properties on the object prototype
> are ignored … or set `allowPrototypes` to `true` which will allow user input to
> overwrite those properties. **WARNING** It is generally a bad idea to enable
> this option as it can cause problems when attempting to use the properties that
> have been overwritten. Always be careful with this option.

Express enables it, for Express 4 compatibility. So on an app with
`query parser: 'extended'`:

```text
GET /search?a[hasOwnProperty]=b   →   req.query = { a: { hasOwnProperty: 'b' } }
```

and `req.query.a.hasOwnProperty('x')` is now a **TypeError**, thrown from
whatever library happens to call it — commonly deep inside a validator or a
serialiser, with a stack that points nowhere near the route.

Be precise about the scope: this shadows properties **on the parsed object**. It
is not the same thing as polluting `Object.prototype` globally. It is still a
remotely-triggerable crash in any code that calls a built-in method on a nested
query value, and it is one more reason to treat `extended` as opt-in with a
reason rather than a default you restore out of habit.

## Gotchas

**Symptom:** `req.query.filter.status` became `undefined` after upgrading to
Express 5, with no error, and the endpoint quietly returns everything
**Cause:** The default parser changed from `extended` to `simple`; `filter[status]`
is now one literal key
**Fix:** Decide deliberately — change the client to flat keys, set
`app.set('query parser', 'extended')`, or supply a custom function. Then add a
test that asserts the filter actually filtered

**Symptom:** `TypeError: Cannot set property query of #<IncomingMessage> which
has only a getter`
**Cause:** The Express 4 pattern `req.query = schema.parse(req.query)`. In
Express 5 `req.query` is a getter
**Fix:** Assign to your own property — `req.validated = schema.parse(req.query)`

**Symptom:** Mutating `req.query` in middleware has no effect downstream
**Cause:** Every access re-parses and returns a **new** object; you mutated a
temporary
**Fix:** Read once into a local, and pass the parsed result explicitly

**Symptom:** `hasOwnProperty is not a function` deep inside a validator
**Cause:** `extended` runs `qs` with `allowPrototypes: true`, so a crafted query
can shadow a built-in on a nested object
**Fix:** Prefer `simple`; if you need `extended`, validate the *shape* before
anything touches those values —
[chunk 03](03-shape-and-trust.md)

**Symptom:** `app.set('query parser', 'qs')` throws at startup
**Cause:** `compileQueryParser` accepts only `true`, `'simple'`, `false`,
`'extended'` or a function
**Fix:** Use `'extended'` — the `qs` parser is what that name selects

## Interview questions

**★ What is the Express 5 default query parser, and why is the answer contested?**
`simple`, Node's `querystring.parse` — no bracket syntax, duplicate keys become
arrays. The `req.query` reference page still carries Express 4 prose saying `qs`;
the settings table, the migration guide and the source all say `simple`. Read
back `app.get('query parser')` when it matters.

**★ `req.query` is a getter. What follows from that?**
It re-parses on every access, so two reads give two different objects and
mutation is pointless; and you cannot assign to it, which breaks the Express 4
validation idiom of writing the parsed value back. Read once into a local, and
put validated output on your own property.

**★ What breaks when you upgrade an Express 4 app that used nested query
filters?**
`?filter[status]=open` stops nesting: the key becomes the literal string
`'filter[status]'` and `req.query.filter` is `undefined`. Nothing throws — the
filter is silently ignored, so an endpoint returns more data than it should.

**★ What is `allowPrototypes`, and why does it matter that Express sets it?**
It is a `qs` option that lets user input overwrite properties inherited from the
object prototype; qs's README explicitly warns against enabling it. Express's
`extended` parser enables it for Express 4 compatibility, so
`?a[hasOwnProperty]=b` produces an object whose `hasOwnProperty` is a string —
and any code calling that method crashes.

**When would you supply a custom query parser function?**
When the API's query surface is small and known. A short function that reads the
three filters you support, rejects everything else and returns typed values is
safer than `extended` and removes a validation step — and it fails at the edge,
not in a handler.

**What does `app.set('query parser', false)` do?**
Disables parsing. `req.query` becomes an always-empty `Object.create(null)`, and
the raw query string is yours to read off `req.url`. Reasonable for a service
that takes no query parameters, as a positive assertion that it takes none.

---

← Prev: [Path params](01-path-params.md) · Index: [Params and query](README.md) · Next → [Shape and trust](03-shape-and-trust.md)
