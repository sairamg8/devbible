---
title: "CORS in Express"
sidebar_label: "02 · CORS"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

**Browsers enforce CORS, not servers alone. Credentials + wildcard origins do not mix.**

```js
import cors from 'cors';
app.use(cors({
  origin: ['https://app.example.com'],
  credentials: true,
}));
```

Dynamic origin reflection must allow-list — reflecting any `Origin` with credentials is a bug.

## Interview questions

**★ Can you use `Access-Control-Allow-Origin: *` with cookies?**  
No — browsers forbid credentialed requests with `*`.


---

← Prev: [trust proxy](01-trust-proxy.md) · Next → [Helmet](03-helmet.md)
