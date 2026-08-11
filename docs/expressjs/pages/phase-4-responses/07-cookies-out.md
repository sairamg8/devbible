---
title: "Setting cookies"
sidebar_label: "07 · Cookies out"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

**`res.cookie` is built in. Flags decide whether browser JS can read the cookie
and when it is sent.**

```js
// set-cookie.mjs
import express from 'express';

const app = express();
app.get('/set', (req, res) => {
  res.cookie('sid', 'abc', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  res.end('ok');
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/set`);
  console.log(res.headers.getSetCookie?.() || res.headers.get('set-cookie'));
  server.close();
});
```

```console
$ node set-cookie.mjs
[ 'sid=abc; Path=/; HttpOnly; SameSite=Lax' ]
```

| Flag | Why |
|---|---|
| `httpOnly` | Block `document.cookie` (XSS mitigation for session tokens) |
| `secure` | HTTPS only — required with `SameSite=None` |
| `sameSite` | CSRF posture for cookie-based sessions |
| `path` / `domain` | Scope |

Reading cookies needs `cookie-parser` (Phase 3). Auth product rules: Phase 8 and
Node Phase 8.

## Interview questions

**★ Why httpOnly on session cookies?**  
Stops trivial XSS from stealing the cookie via JavaScript.

---

← Prev: [SPA fallback](06-spa-fallback.md) · Next → [Streaming and downloads](08-streaming-and-downloads.md)
