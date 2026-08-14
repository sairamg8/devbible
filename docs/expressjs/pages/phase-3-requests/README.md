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
> in place** — pages [01](01-req-anatomy/03-reading-headers-and-content.md) and [02](02-json-and-urlencoded/01-the-four-gates.md) both
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
| 01 | **[req anatomy](01-req-anatomy/README.md)** *(3 chunks)* | <span className="db-tier t-master">Master</span> | The prototype chain and what each layer contributes; the twelve getters and the six that read `trust proxy`; and reading headers correctly |
| 02 | **[JSON and urlencoded](02-json-and-urlencoded/README.md)** *(3 chunks)* | <span className="db-tier t-master">Master</span> | The four gates before a byte is read; every option with its real default; and the status + `err.type` table |
| 03 | **[Size limits](03-size-limits/README.md)** *(3 chunks)* | <span className="db-tier t-master">Master</span> | The two paths to 413 and why a compressed body only takes one; the five layers a body crosses; and what a size limit does not protect |
| 04 | **[Query parser](04-query-parser.md)** | <span className="db-tier t-understand">Understand</span> | Express 5 `simple` vs `extended` |
| 05 | **[Malformed bodies](05-malformed-bodies.md)** | <span className="db-tier t-understand">Understand</span> | 400 parse failures into error middleware |
| 06 | **[raw and text](06-raw-and-text.md)** | <span className="db-tier t-understand">Understand</span> | Webhooks and signatures over bytes |
| 07 | **[Multipart uploads](07-multipart-uploads.md)** | <span className="db-tier t-understand">Understand</span> | Multer 2.x boundary, MIME, size |
| 08 | **[Cookies and helpers](08-cookies-and-helpers.md)** | <span className="db-tier t-know">Know</span> | cookie-parser asymmetry; `accepts` / `is` |

> 🔴 **Master-tier depth pass complete for this phase** (session `ffadd057`,
> 2026-08-14). Topics 01–03 were written at 89–123 lines with none chunked — sized
> to the 300-line cap rather than to the topic — and have been rewritten to full
> depth as `NN-topic/` directories: **01 is 3 chunks (741 lines), 02 is 3 chunks
> (706), 03 is 3 chunks (~700)**. Still no runs: the new mechanism claims are read
> from the installed `express@5.2.1`, `body-parser@2.3.0` and `raw-body` source,
> cited by function, and the two known-wrong console blocks stay flagged in place.

## Coverage

| Syllabus topic | Page |
|---|---|
| `req` anatomy | 01 (chunks [01](01-req-anatomy/01-two-objects-in-one.md) · [02](01-req-anatomy/02-the-twelve-getters.md) · [03](01-req-anatomy/03-reading-headers-and-content.md)) |
| Body parsers json/urlencoded | 02 (chunks [01](02-json-and-urlencoded/01-the-four-gates.md) · [02](02-json-and-urlencoded/02-the-parsers-and-their-options.md) · [03](02-json-and-urlencoded/03-errors-and-choices.md)) |
| Body size limits | 03 (chunks [01](03-size-limits/01-two-paths-to-413.md) · [02](03-size-limits/02-choosing-and-layering.md) · [03](03-size-limits/03-what-it-does-not-protect.md)) |
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

← Syllabus: [Part 2 — HTTP surface](../../syllabus/02-http-surface.md) · Start → [req anatomy](01-req-anatomy/README.md)
