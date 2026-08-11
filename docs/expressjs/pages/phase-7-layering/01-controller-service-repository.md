---
title: "Controller → service → repository"
sidebar_label: "01 · CSR wiring"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Controllers translate HTTP. Services own rules. Repositories own queries. Driver types do not leak upward.**

## Responsibilities

| Layer | Does | Does not |
|---|---|---|
| Controller | parse/validate input already on `req`, call service, map status | SQL, business rules |
| Service | invariants, orchestration | `res.json`, Express types |
| Repository | queries/commands via drivers | HTTP status decisions |

Node Phase 6 owns *how* repositories and transactions work. Express owns where
the HTTP layer stops.

## Interview questions

**★ Why keep Express types out of services?**  
Services stay testable without spinning an HTTP server.


---

← Index: [Phase 7](README.md) · Next → [Domain vs transport](02-domain-vs-transport.md)
