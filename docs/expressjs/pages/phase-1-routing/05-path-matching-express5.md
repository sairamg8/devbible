---
title: "Path matching on Express 5"
sidebar_label: "05 · Path matching (v5)"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Express 5 rewrote path matching. Illegal patterns throw when you register the
route — the process never listens. Upgrade pain is front-loaded.**

> Verified: 2026-08 · Express **5.2.1**
>
> Re-validated 2026-08-14 against the documentation — **no sandbox run**.
> [Migrating to Express 5](https://expressjs.com/en/guide/migrating-5.html) confirms
> each row of the migration map: a wildcard *"must have a name"* (`/*splat`, or
> `/{*splat}` to include the root), `'/:file.:ext?'` becomes `'/:file{.:ext}'`, and
> regex-alternation paths like `'/[discussion|page]/:slug'` become the array
> `['/discussion/:slug', '/page/:slug']`.
> One consequence the migration guide adds and this page does not: a named wildcard
> gives you an **array**, `{splat: ['foo','bar']}` — the
> [request reference](https://expressjs.com/en/5x/api/request/) shows
> `/files/images/image.png` producing `req.params.file = ['images','image.png']`.

## Patterns that throw

```js
// path-v5.mjs
import express from 'express';

const app = express();

function tryReg(label, path) {
  try {
    app.get(path, (req, res) => res.end('ok'));
    console.log(label, '→ accepted');
  } catch (err) {
    console.log(label, '→ THREW:', err.message.split('\n')[0]);
  }
}

tryReg("'*'", '*');
tryReg("'/*splat'", '/*splat');
tryReg("'/user/:id?'", '/user/:id?');
tryReg("'/users/:userId'", '/users/:userId');
```

```console
$ node path-v5.mjs
'*' → THREW: Missing parameter name at index 1: *; visit https://git.new/pathToRegexpError for info
'/*splat' → accepted
'/user/:id?' → THREW: Unexpected ? at index 9: /user/:id?; visit https://git.new/pathToRegexpError for info
'/users/:userId' → accepted
```

## Migration map

| Express 4 habit | Express 5 direction |
|---|---|
| `app.get('*', …)` SPA fallback | Named splat, e.g. `/*splat` (Phase 4) |
| Optional `:id?` | Separate routes or new optional syntax per migration guide |
| Some custom regex paths | Re-check against current path-to-regexp rules |

Always keep the [official migration guide](https://expressjs.com/en/guide/migrating-5.html)
open during upgrades — this page is the footgun list, not the full changelog.

## Trade-off

Throwing at boot is **better** than silent wrong matches: you fail in deploy, not
for one user in production. The cost is every old tutorial path string becomes a
suspect.

## Gotchas

**Symptom:** `Error: Missing parameter name` on startup  
**Cause:** Bare `*` or invalid path token  
**Fix:** Named parameters only; fix SPA fallback

**Symptom:** Optional params from a gist crash the app  
**Cause:** `:name?` not accepted as before  
**Fix:** Two routes (`/user` and `/user/:id`) or updated syntax

**Symptom:** Works on a developer laptop on Express 4, dies on 5 in CI  
**Cause:** Version skew  
**Fix:** Pin Express 5 in all environments; run a smoke boot test

## Interview questions

**★ What happens if you register `app.get('*')` on Express 5?**  
It **throws** during registration.

**★ How do you express a catch-all path on Express 5?**  
Use a named splat such as `/*splat` (exact form per docs/version).

**Why is boot-time throw preferable to silent mismatch?**  
Broken deploys beat intermittent routing bugs in production.

**Where do you verify path syntax for an upgrade?**  
Official Express 5 migration guide + a boot test of your route table.

**Is this the same as middleware order bugs?**  
No — those fail at request time. Invalid paths fail before listen.

---

← Prev: [Route ordering](04-route-ordering.md) · Next → [router.param](06-router-param.md)
