---
title: "Async errors on Express 5"
sidebar_label: "02 · Async errors"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Rejected promises from async handlers reach error middleware on Express 5.
You do not need `express-async-errors` for that baseline.**

```js
// async-err.mjs
import express from 'express';

const app = express();
app.get('/boom', async (req, res) => {
  throw new Error('async boom');
});
app.use((err, req, res, next) => {
  res.status(500).json({error: err.message});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/boom`)).json());
  server.close();
});
```

```console
$ node async-err.mjs
{ error: 'async boom' }
```

Still use `try/catch` when you convert errors to domain responses inside the
handler without wanting the global mapper.

## Interview questions

**★ Express 5 vs 4 for async throw?**  
5 forwards rejections; 4 often needed wrappers or manual `next(err)`.

---

← Prev: [Four-arg error middleware](01-error-middleware.md) · Next → [Error response contract](03-error-contract.md)
