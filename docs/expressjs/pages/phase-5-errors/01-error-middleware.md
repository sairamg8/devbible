---
title: "Four-arg error middleware"
sidebar_label: "01 · Error middleware"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Error middleware has four parameters. Express detects it by arity. Mount it
last.**

```js
// error-mw.mjs
import express from 'express';

const app = express();
app.get('/boom', (req, res, next) => next(new Error('nope')));
app.use((req, res) => res.status(404).json({error: 'not found'}));
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
$ node error-mw.mjs
{ error: 'nope' }
```

If you omit `next` from the signature, Express treats the function as normal
middleware and your errors vanish into the wrong path.

## Gotchas

**Symptom:** Error handler never runs  
**Cause:** Three parameters, or mounted above routes  
**Fix:** Four args, bottom of stack

## Interview questions

**★ How does Express recognize error middleware?**  
Function length 4: `(err, req, res, next)`.

---

← Index: [Phase 5](README.md) · Next → [Async errors on Express 5](02-async-errors.md)
