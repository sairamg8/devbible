---
title: "Timeouts and secrets at the edge"
sidebar_label: "06 · Timeouts · secrets"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

**Request timeout middleware is a soft deadline. Deep budgets are Node Phase 7. Secrets never live in middleware source.**

Fail boot if required env is missing (Node 12-factor). Edge code only reads `process.env` via a validated config module.

## Interview questions

**★ Why validate env at boot, not on first request?**  
Fail fast before taking traffic.


---

← Prev: [CSRF and injection surfaces](05-csrf-and-injection.md) · Index: [Phase 9](README.md)
