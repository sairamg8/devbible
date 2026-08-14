---
title: "Body size limits"
sidebar_label: "03 · Size limits"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**Default limits exist so one client cannot stream gigabytes into memory. Treat
`limit` as a production control. Oversize → 413.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> Every body parser documents `limit` with a default of **`"100kb"`**
> ([express reference](https://expressjs.com/en/5x/api/express/)) — that is the number
> you inherit if you never set one, and it applies to `json`, `urlencoded`, `raw` and
> `text` alike. The `413` / `entity.too.large` console block below predates this pass and
> was **not** re-measured; the earlier verification review lists it among the claims it
> checked by hand, and 413 is the correct status for an over-limit entity.

## Measured

```js
// limit.mjs
import express from 'express';

const app = express();
app.use(express.json({limit: '1kb'}));
app.post('/echo', (req, res) => res.json({ok: true}));
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({type: err.type, message: err.message});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/echo`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({pad: 'x'.repeat(2000)}),
  });
  console.log(res.status, await res.json());
  server.close();
});
```

```console
$ node limit.mjs
413 { type: 'entity.too.large', message: 'request entity too large' }
```

## Choosing limits

| API style | Ballpark |
|---|---|
| JSON RPC-ish CRUD | `100kb`–`1mb` |
| Larger documents | Raise deliberately; prefer files/object storage |
| File uploads | Multipart limits (page 07), not only JSON limit |

Different routes can use different limits via route-level parsers.

## Trade-off

Tight limits protect memory and fail honest big clients. Document max body size
in your API contract. Streaming large payloads belongs in streams/files (Node
Phases 3–4), not unbounded `express.json()`.

## Gotchas

**Symptom:** App OOM under load  
**Cause:** Huge default or no limit on a public parser  
**Fix:** Set explicit `limit`; rate-limit (Phase 9)

**Symptom:** 413 in browser with no useful JSON  
**Cause:** Error middleware missing  
**Fix:** Map `entity.too.large` to a stable error body (Phase 5)

## Interview questions

**★ What status code means the body was too large?**  
**413** Payload Too Large (`entity.too.large` in Express/body-parser).

**Why not leave the default forever?**  
Defaults may not match your threat model; explicit limits are reviewable.

**How do you allow one route a bigger body?**  
Mount a higher-limit parser on that route only.

---

← Prev: [JSON and urlencoded](02-json-and-urlencoded/README.md) · Next → [Query parser](04-query-parser.md)
