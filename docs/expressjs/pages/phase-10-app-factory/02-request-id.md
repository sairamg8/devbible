---
title: "Request-id middleware"
sidebar_label: "02 · Request id"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

**Generate or accept `X-Request-Id`, set on `req`, return on the response, continue with AsyncLocalStorage (Node Phase 10).**

```js
app.use((req, res, next) => {
  const id = req.get('x-request-id') || crypto.randomUUID();
  req.requestId = id;
  res.set('X-Request-Id', id);
  next();
});
```

## Interview questions

**★ Why accept inbound request ids?**  
Trace continuity across gateways and clients.


---

← Prev: [createApp](01-create-app.md) · Next → [Supertest](03-supertest.md)
