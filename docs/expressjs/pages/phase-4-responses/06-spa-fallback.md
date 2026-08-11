---
title: "SPA fallback"
sidebar_label: "06 · SPA fallback"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

**Client-side routers need `index.html` on unknown paths. On Express 5,
`app.get('*')` throws at boot. Use a named splat, and register it after API
routes.**

## Order that works

```js
// spa.mjs — pattern measured on Express 5.2.1
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-'));
fs.writeFileSync(path.join(dir, 'index.html'), '<html>hi</html>');

const app = express();
app.get('/api/ping', (req, res) => res.json({ok: true}));
app.use(express.static(dir));
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(dir, 'index.html'));
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('api', await (await fetch(`${base}/api/ping`)).json());
  console.log('spa', (await (await fetch(`${base}/app/route`)).text()).slice(0, 20));
  server.close();
  fs.rmSync(dir, {recursive: true});
});
```

```console
$ node spa.mjs
api { ok: true }
spa <html>hi</html>
```

## What fails

```js
app.get('*', handler); // THROWS on Express 5 at registration
```

See Phase 0 / Phase 1 path pages for the error text.

## Gotchas

**Symptom:** `/api/users` returns HTML  
**Cause:** Catch-all registered before API  
**Fix:** API first, then static, then splat

**Symptom:** Boot crash after copy-paste from a 2020 MERN tutorial  
**Cause:** `app.get('*')`  
**Fix:** Named splat pattern for Express 5

## Interview questions

**★ Why did Express 5 break SPA tutorials?**  
Bare `*` path tokens are invalid; registration throws.

**Correct mount order for API + SPA?**  
API → static assets → HTML fallback.

---

← Prev: [Static files](05-static-files.md) · Next → [Cookies out](07-cookies-out.md)
