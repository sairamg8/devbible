---
title: "Authentication middleware"
sidebar_label: "04 · Authn middleware"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

**Parse session or Bearer JWT, attach `req.user`, else 401. Do not re-teach argon2 or JWT structure here — Node Phase 8.**

```js
export function requireAuth({sessions, tokens}) {
  return async (req, res, next) => {
    try {
      const user = await resolveUser(req, {sessions, tokens});
      if (!user) return res.status(401).json({error: {code: 'UNAUTHENTICATED'}});
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}
```

## Interview questions

**★ What does authn middleware put on req?**  
The authenticated principal (`req.user`), not permissions alone.


---

← Prev: [Coercion traps](03-coercion-traps.md) · Next → [Cookies and sessions wire-up](05-cookies-sessions-wireup.md)
