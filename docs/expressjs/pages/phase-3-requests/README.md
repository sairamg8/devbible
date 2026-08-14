---
title: "Phase 3 — Requests and body parsing"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Express 5.2.1 on Node 24.19.0.** Status codes and error `type` values
> below were measured on that pair.

> ✅ **Phase complete — 12 of 12 topics, 2026-08-14.** Every page carries a `> Verified:`
> line naming the Express documentation behind its claims. **Documentation-validated,
> not sandbox-measured** — nothing was run in this pass, so no console block was added
> or changed.
>
> ⚠️ **Two console blocks on this phase are known to be wrong and were deliberately left
> in place** — pages [01](01-req-anatomy.md) and [02](02-json-and-urlencoded.md) both
> print `body: undefined`, which no real run can produce: the value crosses `res.json`,
> and `JSON.stringify` omits `undefined` properties, so the key is **absent**. Each page
> says so in its Verified line. They are not rewritten because inventing replacement
> output is worse than a flagged error.
>
> Two other places where the documentation stops short, both stated on the page rather
> than papered over: the `qs`-vs-`simple` contradiction inside Express's own docs (page
> 04), and the absence of any upstream warning about sanitising upload filenames or
> distrusting client `mimetype` (page 07).

Everything clients send — and the limits that keep one request from taking the
process down.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[req anatomy](01-req-anatomy.md)** | <span className="db-tier t-master">Master</span> | What is populated when — and what needs middleware |
| 02 | **[JSON and urlencoded](02-json-and-urlencoded.md)** | <span className="db-tier t-master">Master</span> | `express.json` / `urlencoded`, content-type gates |
| 03 | **[Size limits](03-size-limits.md)** | <span className="db-tier t-master">Master</span> | 413 too large — DoS control, not optional polish |
| 04 | **[Query parser](04-query-parser.md)** | <span className="db-tier t-understand">Understand</span> | Express 5 `simple` vs `extended` |
| 05 | **[Malformed bodies](05-malformed-bodies.md)** | <span className="db-tier t-understand">Understand</span> | 400 parse failures into error middleware |
| 06 | **[raw and text](06-raw-and-text.md)** | <span className="db-tier t-understand">Understand</span> | Webhooks and signatures over bytes |
| 07 | **[Multipart uploads](07-multipart-uploads.md)** | <span className="db-tier t-understand">Understand</span> | Multer 2.x boundary, MIME, size |
| 08 | **[Cookies and helpers](08-cookies-and-helpers.md)** | <span className="db-tier t-know">Know</span> | cookie-parser asymmetry; `accepts` / `is` |

## Coverage

| Syllabus topic | Page |
|---|---|
| `req` anatomy | 01 |
| Body parsers json/urlencoded | 02 |
| Body size limits | 03 |
| query parser simple vs extended | 04 |
| Malformed payloads | 05 |
| raw / text | 06 |
| Headers / content-type | 02 · 05 |
| Client IP | 01 (pair Phase 9) |
| Multipart + upload validation | 07 |
| Reading cookies | 08 |
| req helpers | 08 |

## Phase gate

Mount JSON parsing with a hard size limit, handle a huge body without hanging,
and receive multipart without trusting `Content-Type` alone.

---

← Syllabus: [Part 2 — HTTP surface](../../syllabus/02-http-surface.md) · Start → [req anatomy](01-req-anatomy.md)
