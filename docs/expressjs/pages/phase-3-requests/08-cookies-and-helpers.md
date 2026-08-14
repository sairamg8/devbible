---
title: "Cookies and req helpers"
sidebar_label: "08 · Cookies · helpers"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

**Writing cookies is built in (`res.cookie`). Reading them needs `cookie-parser`
(or manual `Cookie` header parsing). Small req helpers avoid reinventing Accept
negotiation.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> The asymmetry this page is named for is documented on both sides: `res.cookie` is a
> [response method](https://expressjs.com/en/5x/api/response/), while `req.cookies` is
> populated only *"when using cookie-parser middleware"* and `req.signedCookies` likewise
> — each *"defaults to `{}`"* once that middleware is mounted
> ([request reference](https://expressjs.com/en/5x/api/request/)). `cookie-parser` is not
> in Express's built-in list, so it is an install.
> The helpers are documented with the exact semantics used below: `req.is()` returns the
> **matching content type** or `false` (`req.is('html')` → `'html'`), `req.accepts()`
> returns the best match from the `Accept` header or `false`, and `req.get()` is
> case-insensitive with `Referrer`/`Referer` interchangeable.

## The asymmetry

```js
// Without cookie-parser:
//   req.cookies → undefined
//   res.cookie('a', 'b') → works (sets Set-Cookie)
```

```js
import cookieParser from 'cookie-parser';
app.use(cookieParser());
// optional: cookieParser('secret') for signed cookies → req.signedCookies
```

Session middleware typically depends on cookie parsing — mount order matters
(Phase 8).

## Helpers worth knowing

| Helper | Use |
|---|---|
| `req.accepts('json')` | Content negotiation |
| `req.is('json')` | Content-Type check |
| `req.get('Authorization')` | Header read (case-insensitive) |
| `req.range(...)` | Range requests for files |

You can live without memorizing every helper; know they exist before writing
stringly parsers.

## Trade-off

Signed cookies detect tampering; they are not encryption. Secrets still need
HTTPS and careful flags on `res.cookie` (Phase 4 / 8).

## Gotchas

**Symptom:** `req.cookies` undefined with Set-Cookie working  
**Cause:** Expected read side to be free  
**Fix:** Mount `cookie-parser`

**Symptom:** Signed cookie always fails  
**Cause:** Secret rotated or wrong parser secret  
**Fix:** Align secrets; treat as logout

## Interview questions

**★ Does Express parse cookies by default?**  
No — not into `req.cookies` without middleware.

**Difference between cookies and signed cookies?**  
Signed values use a server secret to detect modification; still visible to the
client unless `httpOnly` and not encrypted by default.

---

← Prev: [Multipart uploads](07-multipart-uploads.md) · Index: [Phase 3](README.md)
