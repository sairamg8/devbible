---
title: "Rate limiting"
sidebar_label: "04 · Rate limiting"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**Limit by IP or user. Skip liveness probes. Keys must use the real client IP (`trust proxy`).**

```js
import rateLimit from 'express-rate-limit';
app.use('/api', rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
}));
```

Brute-force protection on `/login` is tighter than global API limits.

## Interview questions

**★ Where should login rate limits sit?**  
On the auth routes, stricter than general API limits.


---

← Prev: [Helmet](03-helmet.md) · Next → [CSRF and injection surfaces](05-csrf-and-injection.md)
