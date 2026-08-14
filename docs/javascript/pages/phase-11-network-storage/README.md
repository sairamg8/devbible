---
title: "Phase 11 — Network, storage and data transfer"
sidebar_label: "Overview"
sidebar_position: 0
---

*21 topics.* How data gets in and out of the browser. As the syllabus puts it, **the `fetch`
rows and the CORS row cover the majority of "it works in Postman but not in the browser"**.

## Status — **Master tier COMPLETE** (2026-08-14)

**Master tier first.** Phase 11 has **five** Master topics — 01 through 05 — and **all five are
written**. Topics 06–21 (Understand and Know) are deferred until the Master tiers of the
remaining phases are done.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[`fetch`](./01-fetch/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Request bodies](./02-request-bodies/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[A `fetch` wrapper worth reusing](./03-fetch-wrapper/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[`URL` and `URLSearchParams`](./04-url-and-searchparams/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | **[CORS from the client side](./05-cors-client-side/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
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

The Master tier reads as a single arc: what `fetch` does not do (01), what you send (02), the
client you build from it (03), the URLs it takes (04), and why the browser refuses to hand you
the answer (05).
