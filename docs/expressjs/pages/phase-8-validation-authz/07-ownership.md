---
title: "Resource ownership"
sidebar_label: "07 · Ownership"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

**"Is this row mine?" — load the resource, compare owner id to `req.user.id`, else 404 or 403 by policy.**

Prefer **404** when existence should stay secret; **403** when the resource is visible but forbidden. Document the choice.

## Interview questions

**★ Why 404 instead of 403 for another user's private doc?**  
Avoids leaking that the id exists.


---

← Prev: [RBAC middleware](06-rbac-middleware.md) · Next → [Multi-tenant and logout](08-tenant-and-logout.md)
