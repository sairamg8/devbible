---
title: "RBAC middleware"
sidebar_label: "06 · RBAC"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

**Role checks after authentication. Fail closed with 403 — not 401.**

```js
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({error: {code: 'UNAUTHENTICATED'}});
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({error: {code: 'FORBIDDEN'}});
    }
    next();
  };
}
```

## Interview questions

**★ 401 vs 403 after a role check fails?**  
403 when identity is known; 401 when missing.


---

← Prev: [Cookies and sessions wire-up](05-cookies-sessions-wireup.md) · Next → [Ownership checks](07-ownership.md)
