---
title: "Validation middleware factory"
sidebar_label: "02 · Validation factory"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**`validate({body, params, query})` returns middleware. On failure: 400 with stable codes. On success: attach parsed data.**

```js
// shape — use real Zod in the app
export function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) req.validated = { ...req.validated, body: schemas.body.parse(req.body) };
      if (schemas.params) req.validated = { ...req.validated, params: schemas.params.parse(req.params) };
      if (schemas.query) req.validated = { ...req.validated, query: schemas.query.parse(req.query) };
      next();
    } catch (err) {
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      next(err);
    }
  };
}
```

Schemas themselves are Understand-level library surface; the factory and boundary habit are Master.

## Interview questions

**★ Where do you put the parsed result?**  
On `req` under a clear name (`req.validated`) — not mixed with raw body.


---

← Prev: [Validate at boundary](01-validate-at-boundary.md) · Next → [Coercion traps](03-coercion-traps.md)
