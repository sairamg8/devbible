---
title: "Content negotiation"
sidebar_label: "09 · Content negotiation"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

**One URL, several representations. `res.format` picks one from the client's
`Accept` header — and for a JSON API the right answer is usually "don't
negotiate at all".**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> [`res.format`](https://expressjs.com/en/5x/api/response/) *"performs
> content-negotiation on the `Accept` HTTP header"*, selecting a handler *"based on
> acceptable types ordered by quality values"*; with no match it *"responds with 406
> 'Not Acceptable'"* unless a `default` callback is supplied.
> [`req.accepts`](https://expressjs.com/en/5x/api/request/) returns the best matching
> type or `false`. `res.vary`, `res.type` and their documented semantics are from the
> same references.

## Why it exists

The same resource can be an HTML page, a JSON document, or a CSV export. HTTP's
answer is not three URLs — it is **one URL and an `Accept` header**:

```http
GET /reports/42
Accept: text/html
```

The client states what it can render; the server picks. That is content
negotiation, and `res.format` is Express's implementation of it.

## `res.format`

Each key is a MIME type or an extension; the value is the handler that produces
that representation.

```js
app.get('/reports/:id', async (req, res, next) => {
  const report = await loadReport(req.params.id);

  res.format({
    'application/json'() {
      res.json(report);
    },
    'text/csv'() {
      res.type('csv').send(toCsv(report));
    },
    'text/html'() {
      res.send(renderHtml(report));
    },
    default() {
      res.status(406).json({error: 'not_acceptable'});
    },
  });
});
```

Two behaviours are worth reading carefully, because they are the whole reason
this page has a gotcha section:

- **Quality values are respected.** `Accept: text/html;q=0.8, application/json`
  selects JSON, because an unqualified type is `q=1`. You do not parse this
  yourself, and you should not try.
- **No match means 406**, automatically — *unless* you supply `default`, which
  takes over completely. A `default` that quietly sends JSON turns a negotiation
  failure into a silent wrong answer.

## `res.format` vs `req.accepts`

They answer different questions.

| | `res.format` | `req.accepts` |
|---|---|---|
| Shape | Dispatch table — you write one branch per type | A test — returns the best match, or `false` |
| No match | **406 automatically**, or your `default` | Returns `false`; you decide what happens |
| Best for | A handler that genuinely has several representations | A guard, or negotiating something other than the body |

```js
// req.accepts: a guard, not a dispatcher
app.get('/export', (req, res) => {
  if (!req.accepts('csv')) return res.sendStatus(406);
  res.type('csv').send(toCsv(rows));
});
```

## The `Vary` header — the part everyone forgets

If a response depends on a request header, **caches must be told**, or the first
client's representation gets served to the next client who wanted a different
one. A shared cache that has stored the JSON version will happily hand it to a
browser asking for HTML.

```js
res.vary('Accept');
```

`res.vary(field)` adds the field to the `Vary` response header if it is not
already there. Any handler that negotiates on `Accept` should set it — and the
same applies to negotiating on `Accept-Language` or `Accept-Encoding`.

This is the one line most negotiation code is missing, and the resulting bug —
"the API sometimes returns HTML" — is maddening to reproduce, because it depends
on who warmed the cache.

## The honest recommendation for APIs

**Most JSON APIs should not negotiate.** They should return JSON, always, and say
so. Negotiation earns its complexity when:

- you genuinely serve a browser **and** a machine client from one URL, or
- you offer a real export format (CSV, PDF) alongside the resource, or
- you are versioning representations through media types.

Otherwise it adds a branch to every handler, a cache-correctness obligation, and
a class of bug where a client's careless `Accept: */*` picks a representation
nobody intended. A separate `/reports/42.csv` route is cheaper to reason about
and trivially cacheable.

## Trade-off

Negotiation buys one canonical URL per resource — good for linking, good for
REST purity, and the only clean way to serve both a browser and a machine from
the same address. It costs a branch per handler, a `Vary` header you must
remember, and cache keys that multiply by the number of representations. Pick it
when a resource really has several forms; reach for distinct routes when it does
not.

## Gotchas

**Symptom:** Clients occasionally receive HTML from a JSON endpoint (or vice versa)
**Cause:** Negotiated response cached without `Vary: Accept`, then served to a
client that asked for something else
**Fix:** `res.vary('Accept')` in every negotiating handler. Verify it survives your
CDN and reverse proxy configuration too

**Symptom:** A client sending `Accept: */*` gets an unexpected representation
**Cause:** `*/*` matches whatever you listed **first**; key order is the tiebreak
**Fix:** Put the representation you want as the default first in the object, and
treat `*/*` as "caller has no preference", not "caller wants HTML"

**Symptom:** A negotiation failure returns 200 with the wrong body
**Cause:** A `default()` branch that sends real content instead of refusing
**Fix:** `default` should refuse — 406 — or deliberately serve one documented
fallback. It replaces the automatic 406 entirely, so a lenient `default` cannot
fail loudly

**Symptom:** `res.format` runs the wrong branch for `Accept: text/html;q=0.8, application/json`
**Cause:** Reading the header left to right instead of by quality value; the
unqualified `application/json` is `q=1` and wins
**Fix:** Trust `res.format` — it orders by q-value, which is exactly why hand-rolled
`req.headers.accept.includes('json')` checks are wrong

## Interview questions

**★ What is content negotiation, and which header drives it?**
Serving different representations of one resource from one URL, chosen by the
client's `Accept` header (with `Accept-Language` and `Accept-Encoding` doing the
same job for language and compression). Express implements it with `res.format`.

**★ What does Express do when no branch of `res.format` matches?**
It responds **406 Not Acceptable** — unless you provide a `default` callback,
which takes over that case entirely.

**★ Why does a negotiated response need a `Vary` header?**
Because the response body depends on a request header. Without `Vary: Accept`, a
shared cache stores one representation under the URL alone and serves it to
clients that asked for a different one.

**Difference between `res.format` and `req.accepts`?**
`res.format` is a dispatch table with an automatic 406; `req.accepts` is a
predicate returning the best match or `false`, leaving the decision to you.

**Should a JSON API use `res.format`?**
Usually not. Return JSON unconditionally and document it. Negotiation is worth
its cost when a resource genuinely has multiple representations — an export
format, or a browser and a machine client sharing one URL.

**How is `*/*` handled?**
It matches, and the first key in your `res.format` object wins. Order the object
deliberately rather than assuming a client that expressed no preference wants
your richest representation.

---

← Prev: [Streaming and downloads](08-streaming-and-downloads.md) · Index: [Phase 4](README.md)
