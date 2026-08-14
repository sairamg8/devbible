---
title: "Express 5 vs 4"
sidebar_label: "06 · Express 5 vs 4"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

**Express 5 is the line this bible targets. Two upgrades break real apps: path
syntax and async error handling. Measure them; do not rely on Express 4 folklore.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0** — console blocks re-run
> through `sandbox/express-verify`. **Sandbox-measured.** The breaking-change list is
> cross-checked against the official
> [Migrating to Express 5](https://expressjs.com/en/guide/migrating-5.html) guide.

## Path matching rewrite

Express 5 uses a new path-to-regexp. Patterns that were common in Express 4 can
**throw at registration time** — the process fails before any request arrives.

```js
// path-break.mjs
import express from 'express';

const app = express();

function tryPath(label, path) {
  try {
    app.get(path, (req, res) => res.end('ok'));
    console.log(label, '→ accepted');
  } catch (err) {
    console.log(label, '→ THREW:', err.message.split('\n')[0]);
  }
}

tryPath("app.get('*')", '*');
tryPath("app.get('/*splat')", '/*splat');
tryPath("app.get('/user/:id?')", '/user/:id?');
```

```console
$ node path-break.mjs
app.get('*') → THREW: Missing parameter name at index 1: *; visit https://git.new/pathToRegexpError for info
app.get('/*splat') → accepted
app.get('/user/:id?') → THREW: Unexpected ? at index 9: /user/:id?; visit https://git.new/pathToRegexpError for info
```

**SPA history fallbacks** that used `app.get('*', …)` must move to a named splat
(e.g. `/*splat`) or another Express 5–legal pattern. Phase 4 covers serving a
built SPA in full.

The replacements are mechanical once you know them — braces mark the optional
part, and alternation becomes an array:

| Express 4 | Express 5 |
|---|---|
| `'*'` | `'/*splat'` — or `'/{*splat}'` to match the root too |
| `'/:file.:ext?'` | `'/:file{.:ext}'` |
| `'/[discussion\|page]/:slug'` | `['/discussion/:slug', '/page/:slug']` |

A named wildcard also changes what you *read*: `req.params.splat` is an **array**
of path segments in Express 5, not a string. Do not copy Express 4 path strings
blindly — check them against the migration guide.

## Async errors forward to `next`

In Express 5, a rejected promise from an async handler is forwarded to error
middleware. You no longer need a wrapping utility for the happy path.

```js
// async-error.mjs
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
  const res = await fetch(`http://127.0.0.1:${port}/boom`);
  console.log(res.status, await res.json());
  server.close();
});
```

```console
$ node async-error.mjs
500 { error: 'async boom' }
```

You still need try/catch when you **handle** the error inside the handler (and
send a specific response) without wanting the global error middleware. Phase 5
owns the full error contract.

## Other upgrade notes

| Area | Direction |
|---|---|
| Removed deprecated APIs | `app.del`, old `req.param()` behaviour, etc. — use modern replacements |
| `query parser` default | `simple` (see settings page + Phase 3) |
| Promise support | First-class in the stack |

Always read the official [migrating to Express 5](https://expressjs.com/en/guide/migrating-5.html)
guide for the full list when upgrading a large 4.x app.

## Trade-off

Staying on Express 4 avoids migration cost and freezes you on a maintenance line.
Moving to 5 costs path audits and dependency bumps (e.g. Multer 2.x) and buys
supported async behaviour and modern path rules.

## Gotchas

**Symptom:** App crashes on boot after “just bumping express”  
**Cause:** A route path threw during `app.get(...)` registration  
**Fix:** Grep for `*`, `?`, and old regex paths; fix against Express 5 rules

**Symptom:** SPA refresh returns 404 or server fails to start  
**Cause:** Catch-all `*` route  
**Fix:** Named splat / ordered static + fallback (Phase 4)

**Symptom:** Assumed async errors still needed `express-async-errors`  
**Cause:** Express 4 habit  
**Fix:** On Express 5, rejected handler promises reach error middleware; keep
four-arg error middleware mounted last

## Interview questions

**★ Name two Express 5 changes that break Express 4 apps.**  
Path-to-regexp syntax (e.g. `*`) and the new default query parser; plus async
rejection forwarding as a behavioural change people rely on.

**★ Does `app.get('*')` work on Express 5?**  
No — it throws at registration. Use a named splat pattern such as `/*splat`.

**What happens when an async handler throws on Express 5?**  
The rejection is passed to error middleware as if you called `next(err)`.

**Should new projects start on Express 4?**  
No for this bible — target 5.x. Legacy 4.x apps need a deliberate migration plan.

**Where do you look for the full migration list?**  
The official Express 5 migration guide — not blog posts from 2019.

---

← Prev: [Application settings](05-application-settings.md) · Next → [When not to use Express](07-when-not-to-use-express.md)
