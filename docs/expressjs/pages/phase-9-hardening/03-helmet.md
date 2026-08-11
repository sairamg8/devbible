---
title: "Helmet"
sidebar_label: "03 · Helmet"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

**Helmet mounts secure default headers. APIs may disable noisy browser-only policies; still review each toggle.**

```js
import helmet from 'helmet';
app.use(helmet());
```

CSP matters more for HTML apps than pure JSON APIs. Do not treat Helmet as a full security program.

## Interview questions

**★ What problem does Helmet address?**  
Common missing security headers (and related defaults), not auth or injection by itself.


---

← Prev: [CORS](02-cors.md) · Next → [Rate limiting](04-rate-limiting.md)
