---
title: "Phase 11 — Network, storage and data transfer"
sidebar_label: "Overview"
sidebar_position: 0
---

*21 topics.* How data gets in and out of the browser. As the syllabus puts it, **the `fetch`
rows and the CORS row cover the majority of "it works in Postman but not in the browser"**.

## Status — 🚧 **Understand tier under way — 8 of 21** (2026-08-15)

**Master tier ✅ COMPLETE** — all five Master topics (01–05), written in syllabus order.

🚧 **Now the Understand tier (06–15), then Know (16–21).** **06–08 are written**; 09 onward remain.

🔴 **Chunk A of the four-way JavaScript split owns this phase** (session `21d2f5de`, 2026-08-15) —
the old "lane B" note was from the closed two-lane split. Chunk A also owns **phase 5, which is now
complete at every tier (26/26)**, and that pairing is deliberate: this phase's `Blob`, upload,
`postMessage` and streams topics lean on phase 5's typed arrays (25), text encoding (26) and
`structuredClone` (21).

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[`fetch`](./01-fetch/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Request bodies](./02-request-bodies/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[A `fetch` wrapper worth reusing](./03-fetch-wrapper/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[`URL` and `URLSearchParams`](./04-url-and-searchparams/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | **[CORS from the client side](./05-cors-client-side/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 06 | **[`Request`, `Response` and `Headers`](./06-request-response-headers/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 07 | **[Reading responses](./07-reading-responses/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 08 | **[Aborting and timing out](./08-aborting-and-timing-out/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 09–15 | Cookies, web storage, uploads, `Blob`/`File`, WebSocket, `postMessage`, CSP | <span className="db-tier t-understand">Understand</span> | 🚧 next |
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
