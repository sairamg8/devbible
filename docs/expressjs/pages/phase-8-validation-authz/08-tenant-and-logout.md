---
title: "Multi-tenant scoping and logout"
sidebar_label: "08 · Tenant · logout"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

**Force `tenantId` from identity, never from raw body alone. Logout clears cookies / hits revocation — storage is Node/Redis.**

Optional auth middleware enriches `req.user` when a token is present but does not 401 when absent — useful for public+personalized routes.

## Interview questions

**★ Why ignore client-supplied tenantId?**  
Tenant hopping / IDOR if trusted.


---

← Prev: [Ownership checks](07-ownership.md) · Index: [Phase 8](README.md)
