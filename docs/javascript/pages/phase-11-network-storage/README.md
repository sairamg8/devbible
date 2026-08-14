---
title: "Phase 11 — Network, storage and data transfer"
sidebar_label: "Overview"
sidebar_position: 0
---

*21 topics.* How data gets in and out of the browser. As the syllabus puts it, **the `fetch`
rows and the CORS row cover the majority of "it works in Postman but not in the browser"**.

## Status — **in progress** (2026-08-14)

**Master tier first.** Phase 11 has **five** Master topics — 01 through 05 — written in
syllabus order. **03 of 5 done.**

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[`fetch`](./01-fetch/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Request bodies](./02-request-bodies/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[A `fetch` wrapper worth reusing](./03-fetch-wrapper/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | `URL` and `URLSearchParams` | <span className="db-tier t-master">Master</span> | planned |
| 05 | CORS from the client side | <span className="db-tier t-master">Master</span> | planned |
| 06–15 | `Request`/`Response`/`Headers`, reading responses, aborting, cookies, web storage, uploads, `Blob`/`File`, WebSocket, `postMessage`, CSP | <span className="db-tier t-understand">Understand</span> | deferred |
| 16–21 | IndexedDB, service workers, SSE, streams, `sendBeacon`, `XMLHttpRequest` | <span className="db-tier t-know">Know</span> | deferred |

## How these pages are verified

**Documentation-validated** against MDN and the Fetch specification. No sandbox, so no page
prints a response body, a timing or a header dump nobody produced.

## Where this connects

- [Phase 7 · Asynchronous JavaScript](../phase-7-async/README.md) — every API here is promise-based
- [Phase 9 · 06 · Sanitising HTML](../phase-9-dom/06-sanitising-html/README.md) — what not to do with a response body
- [Phase 8 · 03 · `Error` and its subclasses](../phase-8-modules-errors/03-error-and-subclasses/README.md) — the typed errors a fetch wrapper should throw

---

Start → [01 · `fetch`](./01-fetch/README.md)
