---
title: "Static files"
sidebar_label: "05 · Static files"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**`express.static` serves files from a directory. Put it after API routes if the
same app also hosts a SPA, and set cache headers deliberately.**

```js
import express from 'express';
import path from 'node:path';

const app = express();
app.use('/assets', express.static(path.join(process.cwd(), 'public'), {
  maxAge: '1y',
  etag: true,
  index: false,
}));
```

| Option | Notes |
|---|---|
| `maxAge` | Long for hashed filenames; short/none for HTML |
| `etag` | Default weak ETags — fine for many apps |
| `fallthrough` | Whether to `next` on miss |
| `dotfiles` | Express 5 defaults — do not serve secrets |

Prefer a CDN / Nginx for heavy static traffic (infra syllabi). Express static is
fine for small apps and admin UIs.

## Gotchas

**Symptom:** `node_modules` or `.env` exposed  
**Cause:** Static root too high  
**Fix:** Root only the build output directory

## Interview questions

**★ When should HTML use short cache and JS use long?**  
Fingerprinted assets can be immutable; HTML points at changing hashes.

---

← Prev: [Headers already sent](04-headers-already-sent.md) · Next → [SPA fallback](06-spa-fallback.md)
