---
title: "Phase 4 — Responses and static files"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Express 5.2.1 on Node 24.19.0.**

> ✅ **Phase complete — 12 of 12 topics, 2026-08-14.** This phase needed more than a
> verification pass: **content negotiation had no page** (now 09), and pages 04, 07 and
> 08 had no Gotchas and no Trade-off section. Those were written, and every page now
> carries a `> Verified:` line. **Documentation-validated, not sandbox-measured** —
> nothing was run, so no console block was added or changed.

What leaves the process — status, body shape, files, cookies, SPA fallback.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[res methods](01-res-methods/README.md)** *(3 chunks)* | <span className="db-tier t-master">Master</span> | What `res.send` really does — the `typeof` dispatch, the ETag, the silent 304; which of the twenty-two methods are terminal; and how to shape a body |
| 02 | **[Status and headers](02-status-and-headers/README.md)** *(2 chunks)* | <span className="db-tier t-master">Master</span> | The status as the only thing intermediaries read, the two new Express 5 throws, and why a late `res.set` fails silently while a late `res.send` throws |
| 03 | **[Response shapes](03-response-shapes.md)** | <span className="db-tier t-understand">Understand</span> | Envelope vs bare resource |
| 04 | **[Headers already sent](04-headers-already-sent.md)** | <span className="db-tier t-understand">Understand</span> | Double-send class of bugs |
| 05 | **[Static files](05-static-files.md)** | <span className="db-tier t-understand">Understand</span> | `express.static`, cache headers |
| 06 | **[SPA fallback](06-spa-fallback.md)** | <span className="db-tier t-understand">Understand</span> | Why `*` throws; named splat after API routes |
| 07 | **[Cookies out](07-cookies-out.md)** | <span className="db-tier t-understand">Understand</span> | `res.cookie` flags |
| 08 | **[Streaming and downloads](08-streaming-and-downloads.md)** | <span className="db-tier t-know">Know</span> | `sendFile`, `download`, streams, compression |
| 09 | **[Content negotiation](09-content-negotiation.md)** | <span className="db-tier t-understand">Understand</span> | `res.format`, `req.accepts`, and the `Vary` header everyone forgets |

> 🔴 **Master-tier depth pass complete for this phase** (session `ffadd057`,
> 2026-08-14). Both Master topics were written at 63–86 lines with neither chunked —
> topic 02 at **63 lines was the thinnest page in the whole Express corpus** — and
> have been rewritten to full depth as `NN-topic/` directories: **01 is 3 chunks
> (789 lines), 02 is 2 chunks (~530)**. Still no runs: the new mechanism claims are
> read from `express@5.2.1`'s `lib/response.js`, cited by function.

## Coverage

All 12 syllabus topics. **Page 09 was written on 2026-08-14 — content negotiation
had no page at all**, which the phase README had no Coverage table to reveal.
Read it after 03; it is numbered last only to avoid renumbering existing links.

| Syllabus topic | Page |
|---|---|
| `res` methods with discipline | 01 (chunks [01](01-res-methods/01-what-res-send-does.md) · [02](01-res-methods/02-the-method-map.md) · [03](01-res-methods/03-choosing-and-shaping.md)) |
| Status and header discipline | 02 (chunks [01](02-status-and-headers/01-status-as-contract.md) · [02](02-status-and-headers/02-headers-and-timing.md)) |
| Response shape conventions | 03 |
| Content negotiation — `Accept`, `res.format` | **09** |
| Headers already sent | 04 |
| Streaming a response from a handler | 08 |
| `res.sendFile` / `res.download` | 08 |
| `express.static` | 05 |
| Serving a built SPA from Express | 06 |
| Cache headers on static assets | 05 |
| Setting cookies on the response | 07 |
| Compression middleware | 08 |

## Phase gate

Every success and error path ends in exactly one response with a deliberate
status and consistent JSON shape; SPA fallback does not steal `/api`.

---

← Syllabus: [Part 2](../../syllabus/02-http-surface.md) · Start → [res methods](01-res-methods/README.md)
