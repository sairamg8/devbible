---
title: "Headers already sent"
sidebar_label: "04 · Headers already sent"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**The first write wins. A second `res.json` / `send` throws
`Cannot set headers after they are sent to the client`.**

## Measured

```js
// double-res.mjs
import express from 'express';

const app = express();
app.get('/d', (req, res, next) => {
  res.json({a: 1});
  next();
});
app.use((req, res) => {
  try {
    res.json({b: 2});
  } catch (err) {
    console.log('error:', err.message);
  }
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log('body', await (await fetch(`http://127.0.0.1:${port}/d`)).json());
  server.close();
});
```

```console
$ node double-res.mjs
error: Cannot set headers after they are sent to the client
body { a: 1 }
```

## Causes

- `next()` after `res.json`
- Error middleware after a handler already responded
- Multiple `return res…` paths fall through

Guard: `if (res.headersSent) return next(err);` in error middleware.

## Interview questions

**★ What does the headers-already-sent error mean?**  
Something tried to write status/headers/body after the response started.

---

← Prev: [Response shapes](03-response-shapes.md) · Next → [Static files](05-static-files.md)
