---
title: "Error response contract"
sidebar_label: "03 · Error contract"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**One public JSON shape for errors. Include a stable `code`. Never send
`err.stack` when `NODE_ENV === 'production'`.**

```js
function errorMiddleware(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.statusCode || err.status || 500;
  const body = {
    error: {
      code: err.code || (status >= 500 ? 'INTERNAL' : 'REQUEST_ERROR'),
      message:
        status >= 500 && process.env.NODE_ENV === 'production'
          ? 'Internal Server Error'
          : err.expose === false
            ? 'Internal Server Error'
            : err.message,
    },
  };
  if (process.env.NODE_ENV !== 'production' && status >= 500) {
    body.error.stack = err.stack;
  }
  res.status(status).json(body);
}
```

Log full `err` + `requestId` server-side (Phase 10 / Node Phase 10).

## Interview questions

**★ What must never appear in production error JSON?**  
Stack traces and internal exception messages for unexpected 500s.

---

← Prev: [Async errors on Express 5](02-async-errors.md) · Next → [Mapping to HTTP](04-mapping-to-http.md)
