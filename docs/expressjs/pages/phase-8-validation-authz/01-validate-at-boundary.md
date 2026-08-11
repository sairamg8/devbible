---
title: "Validate at the HTTP boundary"
sidebar_label: "01 · Validate at boundary"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Everything from the network is untrusted. Parse it before services run.**

The principle outlives Zod. Whether you use Zod, Valibot, or hand parsers,
**services receive validated data**, not `req.body`.

## Interview questions

**★ Why not validate only in the database?**  
Late failures, worse errors, and injection risk before you reach the DB.


---

← Index: [Phase 8](README.md) · Next → [Validation factory](02-validation-factory.md)
