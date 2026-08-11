---
title: "404 and process-level errors"
sidebar_label: "06 · 404 · process"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

**404 is normal middleware (3 args) after routes. Process crashes are not Express
topics — cross-link Node.**

```js
app.use((req, res) => {
  res.status(404).json({error: {code: 'NOT_FOUND', message: 'Not found'}});
});
// error middleware after this
```

| Concern | Where |
|---|---|
| Request 404 / 500 envelope | **Express** (this phase) |
| `unhandledRejection` / `uncaughtException` | **Node** Phase 5 |
| Structured logging of errors | **Node** Phase 10 + request-id middleware |

## Interview questions

**★ Is 404 an error middleware?**  
No — three-argument middleware that always sends 404 when reached.

---

← Prev: [Operational vs programmer](05-operational-vs-programmer.md) · Index: [Phase 5](README.md)
