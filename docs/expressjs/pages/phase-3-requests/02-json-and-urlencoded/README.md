---
title: "JSON and urlencoded parsers"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**`express.json()` and `express.urlencoded()` read the stream into `req.body`
only when `Content-Type` matches. Wrong type means empty body, not a thrown
error.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**, against
> **`body-parser@2.3.0`** — which is what these parsers actually are, re-exported
> by `express/lib/express.js`. Gates, options and error codes are read from
> `body-parser`'s `lib/read.js`, `lib/utils.js` and `lib/types/json.js`, plus
> `raw-body`, in `sandbox/express-verify/node_modules/`, cited per chunk by
> function. Cross-checked against the
> [express reference](https://expressjs.com/en/5x/api/express.html) — whose option
> tables are body-parser's verbatim — and the
> [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html).
> **Reading source is not a run.** The single console block (chunk 01) is re-used
> unchanged from the earlier authorised `sandbox/express-verify` run and **carries
> a known error, flagged in place**: `body: undefined` cannot survive `res.json`.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The four gates](01-the-four-gates.md)** | The four checks before a byte is read, why three of them are silent, where `req.body = undefined` literally comes from, and the webhook trap |
| 02 | **[The parsers and their options](02-the-parsers-and-their-options.md)** | All four parsers and every option with its real default; `strict` rejecting valid JSON; an empty body parsing to `{}` anyway; `extended`'s flipped default |
| 03 | **[Errors and choices](03-errors-and-choices.md)** | The status + `type` table, why to branch on `type` and never on the message, and where to mount |

**Split on concept boundaries at the 300-line mark.** 01 is when a parser runs,
02 is what it does when it does, 03 is what happens when it fails.

## Phase gate

You can say why valid JSON with the wrong `Content-Type` produces no error, what
an empty JSON body parses to, and which `err.type` codes body-parser emits.

## Where this connects

- **← [Phase 0 · 01 · chunk 03](../../phase-0-express-basics/01-what-express-is/03-what-express-delegates.md)**
  — `express.json` is a re-export of `body-parser`, which is why its errors and
  options belong to that package.
- **← [Phase 0 · 03 · chunk 01](../../phase-0-express-basics/03-request-lifecycle/01-the-nine-stages.md)**
  — stage 6, and why the body does not exist before it.
- **← [01 · req anatomy](../01-req-anatomy/README.md)** — `req.is`, and what
  `req.body` is before any of this.
- **→ [03 · Size limits](../03-size-limits/README.md)** — the `limit` option as a
  denial-of-service control.
- **→ [04 · Query parser](../04-query-parser.md)** — the same `simple`/`extended`
  split, on the query string.
- **→ [05 · Malformed bodies](../05-malformed-bodies.md)** — the 400 path in full.
- **→ [06 · raw and text](../06-raw-and-text.md)** — the two parsers chunk 02 only
  sketches.
- **→ [Phase 6 · 09 · Webhooks](../../phase-6-rest-surface/09-webhooks.md)** — the
  raw-bytes requirement, and why `verify` returns 403.
- **→ [Phase 8 · 01 · Validate at the boundary](../../phase-8-validation-authz/01-validate-at-boundary.md)**
  — the schema that has to reject the `{}` the parser accepts.

---

← Prev topic: [req anatomy](../01-req-anatomy/README.md) · Start → [The four gates](01-the-four-gates.md)
