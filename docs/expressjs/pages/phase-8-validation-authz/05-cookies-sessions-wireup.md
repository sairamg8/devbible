---
title: "Cookies and session wire-up"
sidebar_label: "05 · Sessions wire-up"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Express mounts cookie/session middleware and sets cookie flags. Choosing sessions vs JWT is Node Phase 8.**

- `cookie-parser` before session  
- `res.cookie` flags: httpOnly, secure, sameSite (Phase 4)  
- Session store (`connect-redis`) is integration only — Redis syllabus owns Redis  

## Interview questions

**★ Why mount cookie-parser before session middleware?**  
Session libraries read cookies from the parsed object.


---

← Prev: [Authn middleware](04-authn-middleware.md) · Next → [RBAC middleware](06-rbac-middleware.md)
