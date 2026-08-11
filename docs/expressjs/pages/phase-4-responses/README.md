---
title: "Phase 4 — Responses and static files"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Express 5.2.1 on Node 24.19.0.**

What leaves the process — status, body shape, files, cookies, SPA fallback.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[res methods](01-res-methods.md)** | <span className="db-tier t-master">Master</span> | One terminal call: `status` + `json` / `send` / `end` |
| 02 | **[Status and headers](02-status-and-headers.md)** | <span className="db-tier t-master">Master</span> | Set status before body; immutability after send |
| 03 | **[Response shapes](03-response-shapes.md)** | <span className="db-tier t-understand">Understand</span> | Envelope vs bare resource |
| 04 | **[Headers already sent](04-headers-already-sent.md)** | <span className="db-tier t-understand">Understand</span> | Double-send class of bugs |
| 05 | **[Static files](05-static-files.md)** | <span className="db-tier t-understand">Understand</span> | `express.static`, cache headers |
| 06 | **[SPA fallback](06-spa-fallback.md)** | <span className="db-tier t-understand">Understand</span> | Why `*` throws; named splat after API routes |
| 07 | **[Cookies out](07-cookies-out.md)** | <span className="db-tier t-understand">Understand</span> | `res.cookie` flags |
| 08 | **[Streaming and downloads](08-streaming-and-downloads.md)** | <span className="db-tier t-know">Know</span> | `sendFile`, `download`, streams |

## Phase gate

Every success and error path ends in exactly one response with a deliberate
status and consistent JSON shape; SPA fallback does not steal `/api`.

---

← Syllabus: [Part 2](../../syllabus/02-http-surface.md) · Start → [res methods](01-res-methods.md)
