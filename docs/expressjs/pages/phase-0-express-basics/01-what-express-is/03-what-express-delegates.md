---
title: "What Express delegates"
sidebar_label: "03 · What Express delegates"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**Routing is not in Express. Neither is body parsing or static file serving. The
framework you install is 2,755 lines of glue, helpers and settings.**

> Verified: 2026-08-14. Read from the installed **`express@5.2.1`** and
> **`router@2.2.0`** source in `sandbox/express-verify/node_modules/`, cited by
> file and function; line counts are `wc -l` over those packages on that date.
> **Reading source is not a run — nothing was executed for this page, and it
> carries no console block.** Public API cross-checked against
> [expressjs.com · Application](https://expressjs.com/en/5x/api/application.html)
> and [Using middleware](https://expressjs.com/en/guide/using-middleware.html).

## Express does not contain a router

`express/lib/express.js` line 19 is `var Router = require('router')`. The routing
engine is a **separate package**, and `express.Router` is a re-export of it:

```js
exports.Route  = Router.Route;
exports.Router = Router;
```

The app's own router is built lazily, on first access, by a getter installed in
`app.init`:

```js
// express/lib/application.js — app.init()
Object.defineProperty(this, 'router', {
  configurable: true, enumerable: true,
  get: function getrouter() {
    if (router === null) {
      router = new Router({
        caseSensitive: this.enabled('case sensitive routing'),
        strict: this.enabled('strict routing')
      });
    }
    return router;
  }
});
```

🔴 **That getter is a trap with a date on it.** `caseSensitive` and `strict` are
read **once**, at the moment the router is first created — which is your first
`app.use`, your first `app.get`, or the first request, whichever happens first.
`app.set('strict routing', true)` *after* a route is registered has no effect at
all, and nothing warns you. Settings the router consumes must be set before any
route exists, which is one of the reasons the [app
factory](../../phase-10-app-factory/01-create-app/README.md) puts every `app.set(…)` at
the very top of the function.

The practical shape of the delegation:

| You call | Actually implemented in |
|---|---|
| `app.get('/x', h)` | `router@2.2.0` — `Router.prototype.route` → `Route.prototype.get` |
| `express.Router()` | `router@2.2.0`, unchanged |
| `express.json()` | `body-parser` — re-exported |
| `express.urlencoded()` | `body-parser` — re-exported |
| `express.raw()` / `express.text()` | `body-parser` — re-exported |
| `express.static()` | `serve-static` — re-exported |
| the 404 and the default 500 page | `finalhandler` |

Those re-exports are literal, five lines at the bottom of `lib/express.js`:

```js
exports.json       = bodyParser.json
exports.raw        = bodyParser.raw
exports.text       = bodyParser.text
exports.urlencoded = bodyParser.urlencoded
exports.static     = require('serve-static');
```

So `express.json()` **is** `body-parser`'s `json()`. Express 5 folded
`body-parser` and `serve-static` back into the dependency list rather than
reimplementing them, which is why their option tables in the Express docs read
verbatim as those packages' options — and why `express.static`'s defaults
(`fallthrough: true`, `maxAge: 0`, `dotfiles: 'ignore'`) are `serve-static`'s
defaults, covered in [Phase 4 ·
05](../../phase-4-responses/05-static-files.md).

**Why this matters beyond trivia.** When `express.json()` throws a 413 or a
`entity.parse.failed`, the stack you are reading is `body-parser`'s, its options
are `body-parser`'s, and its issue tracker is `body-parser`'s. Chasing those
behaviours in the Express repository finds nothing. The same goes for path
matching: `/users/:id{/:action}` is `path-to-regexp` syntax via `router`, and the
Express 5 migration guide's routing changes are that dependency's changes.

## How big Express actually is

| Package | Files | Lines |
|---|---|---|
| `express@5.2.1` `lib/` | `application.js` 631 · `response.js` 1053 · `request.js` 514 · `utils.js` 271 · `view.js` 205 · `express.js` 81 | **2,755** |
| `router@2.2.0` | `index.js` 748 · `layer.js` 247 · `route.js` 242 | **1,237** |

Two things fall out of that table.

**`response.js` alone is 38% of Express.** The framework is mostly response
helpers — `res.json`, `res.send`, `res.sendFile`, `res.format`, `res.redirect`,
`res.cookie`. That is the actual product, and it is why [Phase
4](../../phase-4-responses/01-res-methods/README.md) has more genuine Express API in it
than any other phase.

**Routing, the thing Express is named for, is not in Express** — 1,237 lines in a
package Express depends on, which you can install and use without Express at all.

The framework being this small is a feature you should use: when behaviour
surprises you, reading the relevant function is a realistic afternoon. Very
little of this corpus's Express content could not be confirmed by opening
`node_modules/express/lib/`.

## The settings the source sets, before you set anything

`defaultConfiguration` runs inside `app.init()`, so these are true of every app
the moment `express()` returns:

| Setting | Default | Why it matters |
|---|---|---|
| `x-powered-by` | enabled | Advertises the framework; commonly disabled |
| `etag` | `'weak'` | Weak validators **cannot** be used with `If-Match` — see [Phase 6 · 07](../../phase-6-rest-surface/07-etag-and-cache.md) |
| `env` | `process.env.NODE_ENV` or `'development'` | Chooses whether the default error handler leaks stacks |
| `query parser` | `'simple'` | ⬇ see below |
| `subdomain offset` | `2` | How `req.subdomains` is sliced |
| `trust proxy` | `false` | The highest-consequence Express setting — [Phase 9 · 01](../../phase-9-hardening/01-trust-proxy/README.md) |
| `view` / `views` | `View` / `resolve('views')` | Template engine plumbing |
| `jsonp callback name` | `'callback'` | |
| `view cache` | enabled **only** when `env === 'production'` | A template change appears immediately in dev and never in prod |

Note what is *absent*. `case sensitive routing` and `strict routing` are never
set, so they read back as **`undefined`**, not `false` — the correction recorded
on [page 05](../05-application-settings.md), and the reason a
`settings.strict === false` branch never fires.

🔴 **This settles a contradiction in Express's own documentation.** The
[`req.query` reference](https://expressjs.com/en/5x/api/request.html) still
carries Express 4 text saying the query parser *"by default uses the `qs`
module"*; the 5.x settings table and the migration guide say `simple`. **The
source says `simple`** — one line in `defaultConfiguration`. Believe the source,
and when it matters, read back `app.get('query parser')` rather than trusting
either prose page. What the two parsers actually differ on is
[Phase 1 · 02](../../phase-1-routing/02-params-and-query/02-the-query-parser.md) and
[Phase 3 · 04](../../phase-3-requests/04-query-parser.md).

## Gotchas

**Symptom:** `app.set('strict routing', true)` or `'case sensitive routing'` has
no effect
**Cause:** The base router is built by a lazy getter that reads both **once**, on
first access — and your first `app.get()` already triggered it
**Fix:** Set every router-consumed setting before registering any route. This is
one of the concrete reasons the app factory orders `app.set(…)` first

**Symptom:** You search the Express repository for the source of a
`entity.too.large` error and find nothing
**Cause:** It is `body-parser`'s error; `express.json` is a re-export
**Fix:** Read the actual owning package —`body-parser`, `serve-static`,
`finalhandler`, `router`, `path-to-regexp`. `node_modules/express/package.json`
lists them all

**Symptom:** A settings change works locally and not in production, with no error
**Cause:** `view cache` is enabled only when `NODE_ENV === 'production'`, and
`env` is read once at `app.init()` — setting `NODE_ENV` after `express()` is too
late
**Fix:** Set `NODE_ENV` in the environment, before the process starts; never from
inside the app

**Symptom:** Two Express versions behave differently on the same route pattern
and the Express changelog says nothing
**Cause:** Path syntax lives in `path-to-regexp`, reached through `router` — a
transitive dependency bump changes matching without an Express release note
**Fix:** Pin and read `router`'s changelog too;
[Phase 1 · 05](../../phase-1-routing/05-path-matching-express5.md) covers the
Express 5 syntax changes that came from exactly this

## Interview questions

**★ Is `express.json()` written by Express?**
No. It is `body-parser`'s `json()`, re-exported by `express/lib/express.js`, and
`express.static` is `serve-static`. That is why their option tables in the Express
docs match those packages exactly, and why their errors carry those packages'
codes.

**★ What is the default query parser in Express 5, and why is the answer
contested?**
`simple`, which uses Node's `querystring` and does not build nested objects. The
`req.query` reference page still carries Express 4 prose saying `qs`; the source
sets `simple` in `defaultConfiguration`. Read back `app.get('query parser')` if it
matters.

**★ Why might `app.set('case sensitive routing', true)` silently do nothing?**
Because `app.router` is a lazy getter that constructs the router the first time it
is touched, reading `caseSensitive` and `strict` at that moment only. Any route
registration touches it. Set those before the first route.

**★ How much of Express is routing?**
None of it. Routing is `router@2.2.0`, a separate 1,237-line package. Express's
own `lib/` is 2,755 lines, and 1,053 of those are `response.js` — the framework is
mostly response helpers.

**Why does `x-powered-by` need `app.disable` rather than deleting the header in
middleware?**
Because `app.handle` sets it before routing, once per request, for every route.
Middleware can only remove it on the paths that middleware runs on. One setting
covers the app.

**What does `env` control, and when is it read?**
It defaults from `NODE_ENV` at `app.init()` and decides whether the default error
handler includes `err.stack` and whether `view cache` is enabled. Because it is
read at init, changing `process.env.NODE_ENV` afterwards does not move it.

---

← Prev: [The app is a function](02-the-app-is-a-function.md) · Index: [What Express is](README.md) · Next → [Where Express stops](04-the-boundary.md)
