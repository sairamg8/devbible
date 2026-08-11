---
title: "Background jobs from routes"
sidebar_label: "05 · Jobs from routes"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Validate, persist, enqueue, respond. Never await email/webhooks/PDF generation on the request path.**

```js
await orders.create(input);          // in a transaction with outbox when needed (Node 7)
await queue.add('send-receipt', {id});
res.status(202).json({id, status: 'accepted'});
```

Cross-link Node Phase 7 for outbox, retries, and worker shutdown.

## Interview questions

**★ Why 202 for queued work?**  
Accepted for processing — not necessarily completed.


---

← Prev: [DI without a framework](04-di-without-framework.md) · Next → [Folders and DTOs](06-folders-and-dtos.md)
