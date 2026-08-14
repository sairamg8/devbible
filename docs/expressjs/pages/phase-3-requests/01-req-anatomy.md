---
title: "req anatomy"
sidebar_label: "01 · req anatomy"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**`req` is Node’s `IncomingMessage` plus Express fields. Some properties exist
only after middleware runs. `req.cookies` is not free.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> [Request reference](https://expressjs.com/en/5x/api/request/): `req.body` is *"by
> default … `undefined`, and is populated when you use body-parsing middleware"*;
> `req.cookies` needs cookie-parser and *"defaults to `{}`"* only once that middleware
> is mounted; `req.ip` is *"derived from the left-most entry in the `X-Forwarded-For`
> header"* whenever `trust proxy` does not evaluate to false, and `req.ips` is otherwise
> *"an empty array"*.
>
> ⚠️ **Known error in the console block below, left in place rather than replaced.** It
> prints `body: undefined`. A real run cannot print that: the value crosses `res.json`,
> and `JSON.stringify` **omits** object properties whose value is `undefined` —
> *"they are either omitted (when found in an object) or changed to `null` (when found
> in an array)"*
> ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)).
> The `body` key would simply be **absent**. Since this pass runs nothing, the block is
> not rewritten from imagination — the correction is stated here instead. **The lesson is
> the more useful one anyway: `undefined` does not survive a JSON round-trip.**

## Always there (routing)

| Field | Meaning |
|---|---|
| `req.method` | HTTP method |
| `req.url` / `req.originalUrl` | Path (+ query) views |
| `req.path` | Pathname |
| `req.params` | Route params after match |
| `req.query` | Parsed query (parser setting matters) |
| `req.headers` | Lowercased header map |
| `req.ip` / `req.ips` | Client IP — **wrong behind proxy** until `trust proxy` (Phase 9) |

## Populated by middleware

| Field | Needs |
|---|---|
| `req.body` | `express.json` / `urlencoded` / `raw` / `text` / multer |
| `req.cookies` | **`cookie-parser`** — not built into Express |
| `req.signedCookies` | cookie-parser with secret |
| `req.user` | Your auth middleware (Phase 8) |

```js
// anatomy.mjs
import express from 'express';

const app = express();
app.post('/echo', (req, res) => {
  res.json({
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    hasCookieParser: typeof req.cookies,
  });
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(
    `http://127.0.0.1:${port}/echo?x=1`,
    {
      method: 'POST',
      headers: {'content-type': 'application/json', cookie: 'a=b'},
      body: '{"hi":true}',
    },
  );
  console.log(await res.json());
  server.close();
});
```

```console
$ node anatomy.mjs
{
  method: 'POST',
  path: '/echo',
  query: { x: '1' },
  body: undefined,
  hasCookieParser: 'undefined'
}
```

No parser → no `body`. No cookie-parser → no `cookies` object (writing cookies
still uses `res.cookie` — Phase 4).

## Trade-off

Putting everything on `req` is convenient. Document what your app attaches
(`req.user`, `req.ctx`) so handlers do not assume ghosts.

## Gotchas

**Symptom:** `Cannot read properties of undefined (reading 'session')`  
**Cause:** Assumed cookie/session middleware mounted  
**Fix:** Mount order and presence checks

**Symptom:** `req.ip` is `127.0.0.1` in production  
**Cause:** Reverse proxy; `trust proxy` false  
**Fix:** Phase 9

## Interview questions

**★ Is `req.body` available without middleware?**  
No — undefined until a body parser runs.

**★ Is `req.cookies` built into Express?**  
No — install and mount `cookie-parser` (or parse `Cookie` yourself).

**What is `req.originalUrl` for?**  
Full original path including mount and query — useful behind routers.

---

← Index: [Phase 3](README.md) · Next → [JSON and urlencoded](02-json-and-urlencoded.md)
