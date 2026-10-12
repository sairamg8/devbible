---
title: "Link map · Express · Part 1 (phases 0–2)"
sidebar_label: "01 · Express · Foundations"
sidebar_position: 1
---

# Link map · Express · Part 1 — Foundations (phases 0–2)

Covers all 26 topic rows of `docs/expressjs/syllabus/01-foundations.md`: T00-01 to T00-08 (Express over `node:http`), T01-01 to T01-09 (routing and path matching), T02-01 to T02-09 (middleware). **All 26 have a page of ours (✅).**
*read* = I read the passage; *headings only* = fetched, headings/size checked. No `#anchors` are given. Third-party links carry a date where the page shows one.

🔴 **Version note.** npm on 2026-10-12: `express` latest **5.3.0** (published 2026-10-09; `latest-4` is 4.22.3), `router` 2.2.0, `path-to-regexp` 8.4.2. Our README still says 5.2.1, so the `> Verified:` lines are one minor behind. Express 5.x needs Node 18 or newer (`engines` in the repo `package.json`). expressjs.com pages show no date, so only the fetch date is given. `github.com` returns 403 to our fetcher, so source and READMEs are cited as `raw.githubusercontent.com` copies. URLs are the final ones after redirects.

---

## Phase 0 — Express over `node:http`

### T00-01 · What Express is and is not — Master · ✅ written `docs/expressjs/pages/phase-0-express-basics/01-what-express-is/`
- **Read this:** [Hello world example](https://expressjs.com/en/starter/hello-world/) · expressjs.com · the whole app is `express()`, one `app.get`, one `app.listen` (*read*) · covers our angle: **partial** — shows the smallness, says nothing about `node:http` underneath · fetched 2026-10-12
- **Also good:** [Anatomy of an HTTP Transaction](https://nodejs.org/learn/http/anatomy-of-an-http-transaction) · nodejs.org · what Node gives you before Express: `createServer`, method, URL, headers, body, status, response (*headings only*, about 4,500 words) · [Express Readme (raw)](https://raw.githubusercontent.com/expressjs/express/master/Readme.md) · github (raw) · "Fast, unopinionated, minimalist web framework" (*read*) · fetched 2026-10-12
- **Our delta:** the "router and middleware over `http.Server`" claim with the mechanism, which no tutorial gives; what Express delegates and where it stops.

### T00-02 · `app` vs `Router` vs `http.Server` — Master · ✅ `docs/expressjs/pages/phase-0-express-basics/02-app-router-server/`
- **Read this:** [Application API: `app.listen()`](https://expressjs.com/en/5x/api/application/) · expressjs.com · `app.listen` returns an `http.Server` and is shorthand for `http.createServer(this)` then `listen`; the `app` is passed as the request listener (*read*) · covers our angle: **partial** — the app-to-server link only, not the router stack · fetched 2026-10-12
- **Also good:** [pillarjs/router README (raw)](https://raw.githubusercontent.com/pillarjs/router/master/README.md) · github (raw) · the package Express 5 uses for routing: options `strict`, `caseSensitive`, `mergeParams`; `use`, `route`, `param` (*read* the API list) · [Routing: `express.Router`](https://expressjs.com/en/guide/routing/) · expressjs.com · "a complete middleware and routing system", the "mini-app" (*read*) · fetched 2026-10-12
- **Our delta:** the `router.handle` walk and the object graph (who listens, who mounts, who owns the stack); `app.init` creating a `Router` from the `router` package is in source (`lib/application.js`, raw, *read*), not in any guide.

### T00-03 · The request lifecycle — Master · ✅ `docs/expressjs/pages/phase-0-express-basics/03-request-lifecycle/`
- **Read this:** [Using middleware](https://expressjs.com/en/guide/using-middleware/) · expressjs.com · a middleware may run code, change `req`/`res`, end the cycle, or call the next one; if it does not end the cycle it must call `next()` or the request hangs (*read*) · covers our angle: **partial** — the chain and its endings, not the socket end or the final handler · fetched 2026-10-12
- **Also good:** [Anatomy of an HTTP Transaction](https://nodejs.org/learn/http/anatomy-of-an-http-transaction) · nodejs.org · the Node half of the path (*headings only*) · [Error Handling](https://expressjs.com/en/guide/error-handling/) · expressjs.com · default handler, and what happens when `next(err)` comes after headers are written (*read*) · fetched 2026-10-12
- **Our delta:** the nine stages and the four endings as one diagram; where a request is lost when nobody calls `next` and nobody responds (the phase gate).

### T00-04 · Application instantiation — Understand · ✅ `docs/expressjs/pages/phase-0-express-basics/04-creating-an-app.md`
- **Read this:** [Application API: `app.listen()`](https://expressjs.com/en/5x/api/application/) · expressjs.com · documents `http.createServer(app).listen(80)` and `https.createServer(options, app).listen(443)` next to `app.listen` (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the `listen` error path (callback and the `error` event on the returned server), and tests that import `app` without listening.

### T00-05 · Application settings (grouped) — Understand · ✅ `docs/expressjs/pages/phase-0-express-basics/05-application-settings.md`
- **Read this:** [Application API: settings table](https://expressjs.com/en/5x/api/application/) · expressjs.com · `query parser` default `"simple"`; `strict routing` default undefined; `x-powered-by` default true; sub-apps inherit several settings (*read*) · covers our angle: full for the listed settings · fetched 2026-10-12
- **Also good:** [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/) · expressjs.com · what `trust proxy` changes (*read* the intro) · [Security best practices](https://expressjs.com/en/advanced/best-practice-security/) · expressjs.com · `app.disable('x-powered-by')`, with the note that it only discourages fingerprinting (*read*) · fetched 2026-10-12
- **Our delta:** which defaults to change and why; `env` and `case sensitive routing` are in the same table but were not separately checked, so **not confirmed** here.

### T00-06 · Express 5 vs 4 — Understand · ✅ `docs/expressjs/pages/phase-0-express-basics/06-express-5-vs-4.md`
- **Read this:** [Upgrade to Express v5](https://expressjs.com/en/guide/migrating-5/) · expressjs.com · removed `app.del`, `req.param(name)`, `res.json(obj, status)`; rejected promises forwarded to error middleware; `req.query` now a getter and default parser "simple"; path syntax changes (wildcards need names, `?` becomes braces), with `()[]?+!` reserved; the page does not name path-to-regexp v8, the routing guide does (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Introducing Express v5](https://expressjs.com/en/blog/2024-10-15-v5-release/) · expressjs.com blog, 2024-10-15 · sections on Node support, path matching, promises, body parser (*headings only*) · fetched 2026-10-12
- **Our delta:** a check-list ordered by what breaks first on upgrade; the guide lists codemods, we should say which to run.

### T00-07 · When not to use Express — Know · ✅ `docs/expressjs/pages/phase-0-express-basics/07-when-not-to-use-express.md`
- **Read this:** [Fastify benchmarks](https://fastify.dev/benchmarks/) · fastify.dev, updated 2026-10-01 · lists Express 5.2.1 at 27,474 req/s against Fastify 5.12.5 at 50,373, and calls it an "illustrative comparison" (*read*) · covers our angle: **partial** — vendor numbers, no trade-offs · fetched 2026-10-12
- **Also good:** [Hono motivation](https://hono.dev/docs/concepts/motivation) · hono.dev · built on Web Standard APIs so one app runs on several runtimes (*read*) · [Hono benchmarks](https://hono.dev/docs/concepts/benchmarks) · hono.dev · router speed only, "express (includes handling)" is one of the routers measured (*read*) · fetched 2026-10-12
- **Our delta:** 🔴 both numbers come from the vendors; our page must say a hello-world benchmark is not an app and name what Express still wins (ecosystem, familiarity). No neutral source was found.

### T00-08 · Reading Express docs and source shape — Know · ✅ `docs/expressjs/pages/phase-0-express-basics/07-when-not-to-use-express.md` (and 01 chunks 02–03)
- **Read this:** [`lib/application.js` (raw)](https://raw.githubusercontent.com/expressjs/express/master/lib/application.js) · github (raw) · `app.init`, `defaultConfiguration`, `app.handle`, `app.listen`; requires `router` · covers our angle: full for "where application lives" (*read* the head and `listen`) · fetched 2026-10-12
- **Also good:** [Express Readme (raw)](https://raw.githubusercontent.com/expressjs/express/master/Readme.md) · github (raw) · install, philosophy, project team (*headings only*) · fetched 2026-10-12
- **Our delta:** the map from API page to file (`lib/application.js`, `request.js`, `response.js`, `express.js`, `view.js`, `utils.js` all exist on master); the router lives in the separate `router` package, not in `lib/`.

---

## Phase 1 — Routing and path matching

### T01-01 · HTTP method routing — Master · ✅ `docs/expressjs/pages/phase-1-routing/01-http-methods/`
- **Read this:** [Routing: route methods](https://expressjs.com/en/guide/routing/) · expressjs.com · the verb helpers and `app.all` (*headings only* for this section) · covers our angle: **partial** — nothing on a method mismatch · fetched 2026-10-12
- **Also good:** [405 Method Not Allowed](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/405) · MDN · a 405 must carry an `Allow` header (*read*) · [FAQ: How do I handle 404 responses?](https://expressjs.com/en/starter/faq/) · expressjs.com · a 404 is not an error, it means no more work was found (*read*) · fetched 2026-10-12
- **Our delta:** that Express answers a method mismatch with 404, not 405, by default. **Not confirmed** by any page above, so our page must show it by running code.

### T01-02 · Route params, query strings, wildcards — Master · ✅ `docs/expressjs/pages/phase-1-routing/02-params-and-query/`
- **Read this:** [Routing: route parameters](https://expressjs.com/en/guide/routing/) · expressjs.com · `:name`, `*splat` (value is an array), optional segments in braces, `/{*splat}` also matches `/` (*read*) · covers our angle: full for params and wildcards, **partial** for query · fetched 2026-10-12
- **Also good:** [Request API: `req.query`](https://expressjs.com/en/5x/api/request/) · expressjs.com · shape is user-controlled, so every value is untrusted and must be validated (*read*) · [path-to-regexp Readme (raw)](https://raw.githubusercontent.com/pillarjs/path-to-regexp/master/Readme.md) · github (raw) · the grammar (*read*); latest on npm is 8.4.2 · fetched 2026-10-12
- **Our delta:** the null prototype on `req.params` for string routes, and `req.query` as a getter and `req.params` with a null prototype for string paths (both from the migration guide, *read*, not from the routing guide). That the getter re-parses on each access is **not confirmed**, the source was not opened.

### T01-03 · `express.Router()` composition — Master · ✅ `docs/expressjs/pages/phase-1-routing/03-router-composition/`
- **Read this:** [Routing: `express.Router`](https://expressjs.com/en/guide/routing/) · expressjs.com · a router module with its own middleware, mounted with `app.use` (*read*) · covers our angle: full for the basic pattern · fetched 2026-10-12
- **Also good:** [pillarjs/router README (raw)](https://raw.githubusercontent.com/pillarjs/router/master/README.md) · github (raw) · `router.use`, `router.route`, `mergeParams` example (*read*) · fetched 2026-10-12
- **Our delta:** composition at scale (feature modules, one mount list), which neither page covers.

### T01-04 · Nested routers and multi-level prefixes — Understand · ✅ `docs/expressjs/pages/phase-1-routing/03-router-composition/02-mergeparams-and-isolation.md`
- **Read this:** [pillarjs/router README (raw): Router options](https://raw.githubusercontent.com/pillarjs/router/master/README.md) · github (raw) · `mergeParams` merges the parent `req.params`, default false (*read*) · covers our angle: **partial** — nothing on how prefixes concatenate · fetched 2026-10-12
- **Also good:** [Application API: `app.mountpath`](https://expressjs.com/en/5x/api/application/) · expressjs.com · a sub-app's mount path, a string or array (*read*) · fetched 2026-10-12
- **Our delta:** the four URL properties under a mount and the `restore` isolation. **Not confirmed** here: the router source was not opened for this map.

### T01-05 · Route ordering pitfalls — Understand · ✅ `docs/expressjs/pages/phase-1-routing/04-route-ordering.md`
- **Read this:** none found — tried: "Express route order matters /:id before static", "Express route ordering" on expressjs.com and search; the hits were blog and course pages (codefinity, gurubase, leyaa), not opened.
- **Also good:** [Router API: `router.use()`](https://expressjs.com/en/5x/api/router/) · expressjs.com · middleware is invoked sequentially, so order defines precedence (*read*) · [Using middleware: skipping to the next route](https://expressjs.com/en/guide/using-middleware/) · expressjs.com · `next('route')` hands control to the next matching route (*read*) · fetched 2026-10-12
- **Our delta:** the whole topic: static before param, catch-all last, with runnable proof. The Router API page states the order rule for middleware only; no page shows the `/:id` before `/export` case.

### T01-06 · Express 5 path-to-regexp changes — Understand · ✅ `docs/expressjs/pages/phase-1-routing/05-path-matching-express5.md`
- **Read this:** [Upgrade to Express v5: path route matching syntax](https://expressjs.com/en/guide/migrating-5/) · expressjs.com · the before and after code examples; reserved characters `()[]?+!` need `\`; names are identifiers or quoted (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [path-to-regexp Readme (raw): Errors](https://raw.githubusercontent.com/pillarjs/path-to-regexp/master/Readme.md) · github (raw) · "Unexpected ?" and "Unexpected (" errors with the fixes (*read*) · fetched 2026-10-12
- **Our delta:** regex literals are still legal route paths in 5 (routing guide, *read*), so "regex routes need rewriting" is only true for string patterns. Say so.

### T01-07 · `router.param(name, handler)` — Know · ✅ `docs/expressjs/pages/phase-1-routing/06-router-param.md`
- **Read this:** [Router API: `router.param()`](https://expressjs.com/en/5x/api/router/) · expressjs.com · callback `(req, res, next, value, name)`; takes one name, not an array; the `:user` loading example (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [pillarjs/router README (raw): `router.param`](https://raw.githubusercontent.com/pillarjs/router/master/README.md) · github (raw) · the callback may return a Promise, rejection goes to `next` (*read*) · fetched 2026-10-12
- **Our delta:** load plus 404 once, and `app.param(fn)` and a leading colon being removed (migration guide headings).

### T01-08 · `app.route(path)` chaining — Know · ✅ `docs/expressjs/pages/phase-1-routing/07-app-route-and-hosts.md`
- **Read this:** [Routing: `app.route()`](https://expressjs.com/en/guide/routing/) · expressjs.com · chained handlers per method on one path (*read* the example) · covers our angle: full · fetched 2026-10-12
- **Also good:** [pillarjs/router README (raw): `router.route`](https://raw.githubusercontent.com/pillarjs/router/master/README.md) · github (raw) · `Router.Route` and `route.all` (*headings only*) · fetched 2026-10-12
- **Our delta:** why it exists (one path, one place) and that it is not a mount.

### T01-09 · Host-based routing and `app.mountpath` — When Needed · ✅ `docs/expressjs/pages/phase-1-routing/07-app-route-and-hosts.md`
- **Read this:** [vhost README (raw)](https://raw.githubusercontent.com/expressjs/vhost/master/README.md) · github (raw) · `vhost(hostname, handle)`, string with `*` or RegExp, called like standard middleware (*read*) · covers our angle: **partial** — `app.mountpath` is on the Application API page · fetched 2026-10-12
- **Also good:** [Request API: `req.hostname`](https://expressjs.com/en/5x/api/request/) · expressjs.com · from the `Host` header, or `X-Forwarded-Host` when `trust proxy` is not false; the client can set it (*read*) · fetched 2026-10-12
- **Our delta:** 🔴 the Host header is attacker-controlled, so host routing is not an auth boundary; `vhost` last-release date was not checked, **not confirmed** as maintained.

---

## Phase 2 — Middleware architecture

### T02-01 · The middleware contract — Master · ✅ `docs/expressjs/pages/phase-2-middleware/01-middleware-contract/`
- **Read this:** [Writing middleware](https://expressjs.com/en/guide/writing-middleware/) · expressjs.com · `req`, `res`, `next`; the four things a middleware may do; `next` is not part of the Node API, it is the third argument (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [pillarjs/router README (raw): Middleware](https://raw.githubusercontent.com/pillarjs/router/master/README.md) · github (raw) · a returned Promise is awaited and a rejection calls `next` (*read*) · fetched 2026-10-12
- **Our delta:** arity as part of the contract, and what middleware must not do.

### T02-02 · Execution order and mounting — Master · ✅ `docs/expressjs/pages/phase-2-middleware/02-execution-order/`
- **Read this:** [Using middleware](https://expressjs.com/en/guide/using-middleware/) · expressjs.com · application-level, router-level, error, built-in, third-party; optional mount path; sub-stacks (*read*) · covers our angle: **partial** — states the types but not the registration-order rule in one sentence · fetched 2026-10-12
- **Also good:** [Routing: route handlers](https://expressjs.com/en/guide/routing/) · expressjs.com · multiple callbacks per route, arrays, `next('route')` (*read*) · fetched 2026-10-12
- **Our delta:** one mechanism, not four, and how to print the order.

### T02-03 · `next()` vs `next(err)` vs never calling `next` — Master · ✅ `docs/expressjs/pages/phase-2-middleware/03-next-semantics/`
- **Read this:** [Error Handling](https://expressjs.com/en/guide/error-handling/) · expressjs.com · handlers that return a Promise call `next(value)` on rejection or throw; async functions are the recommended style; if headers are already sent, the default handler closes the connection (*read*) · covers our angle: **partial** — the hang and double-send are not named · fetched 2026-10-12
- **Also good:** [Using middleware](https://expressjs.com/en/guide/using-middleware/) · expressjs.com · "left hanging" if a middleware neither ends the cycle nor calls `next()` (*read*) · fetched 2026-10-12
- **Our delta:** the silent hang with no status code, the double send, `next('route')` and `next('router')`. The second string was not checked on any page here, **not confirmed**.

### T02-04 · Middleware as a factory — Understand · ✅ `docs/expressjs/pages/phase-2-middleware/04-middleware-factories.md`
- **Read this:** [Writing middleware: configurable middleware](https://expressjs.com/en/guide/writing-middleware/) · expressjs.com · export a function taking options that returns the middleware (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** per-mount config instead of a module-level global; validating options when the factory is called, not per request.

### T02-05 · Middleware that must run first / last — Understand · ✅ `docs/expressjs/pages/phase-2-middleware/05-first-and-last.md`
- **Read this:** [Using middleware: error-handling middleware](https://expressjs.com/en/guide/using-middleware/) · expressjs.com · four arguments `(err, req, res, next)` (*read*) · covers our angle: **partial** — nothing on body parser placement · fetched 2026-10-12
- **Also good:** [Error Handling: writing error handlers](https://expressjs.com/en/guide/error-handling/) · expressjs.com · the section on handler placement (*headings only*) · fetched 2026-10-12
- **Our delta:** the order table (parser, auth, routes, 404, error handler) and why a four-arg function registered early never sees later errors. That second claim is ours to prove by running it.

### T02-06 · Mutating `req` / `res` safely — Understand · ✅ `docs/expressjs/pages/phase-2-middleware/06-mutating-req-res.md`
- **Read this:** [Overriding the Express API](https://expressjs.com/en/guide/overriding-express-api/) · expressjs.com · `req`/`res` inherit by prototype; extension points `express.request` and `app.request`; some properties cannot be overridden (*read*) · covers our angle: **partial** — about the framework API, not about attaching `req.user` · fetched 2026-10-12
- **Also good:** [Writing middleware: `requestTime`](https://expressjs.com/en/guide/writing-middleware/) · expressjs.com · a middleware adds a property to `req`; TypeScript needs declaration merging, property optional (*read*) · fetched 2026-10-12
- **Our delta:** names you must not clobber, and one namespaced property (such as `req.ctx`) over many.

### T02-07 · Built-in middleware map — Know · ✅ `docs/expressjs/pages/phase-2-middleware/07-builtin-and-third-party.md`
- **Read this:** [Using middleware: built-in middleware](https://expressjs.com/en/guide/using-middleware/) · expressjs.com · `express.static`, `json`, `raw`, `text`, `urlencoded` (*read*) · covers our angle: full for the list · fetched 2026-10-12
- **Also good:** [Express middleware](https://expressjs.com/en/resources/middleware/) · expressjs.com · the maintained modules list (*headings only*) · fetched 2026-10-12
- **Our delta:** Express 5 changes to `express.urlencoded` and `express.static` options (migration guide headings, not read in full).

### T02-08 · Evaluating third-party middleware — Know · ✅ `docs/expressjs/pages/phase-2-middleware/07-builtin-and-third-party.md`
- **Read this:** [Express middleware: additional modules](https://expressjs.com/en/resources/middleware/) · expressjs.com · warns that listed modules are not maintained by the Express team and listing is no endorsement (*read*) · covers our angle: **partial** — no criteria for choosing · fetched 2026-10-12
- **Also good:** [Security best practices](https://expressjs.com/en/advanced/best-practice-security/) · expressjs.com · production security advice; the dependency section was not opened, **not confirmed** (*headings only*) · fetched 2026-10-12
- **Our delta:** the checklist (last release, Express 5 support, open advisories) and "does this need to be middleware at all?"

### T02-09 · Terminating early — Understand · ✅ `docs/expressjs/pages/phase-2-middleware/03-next-semantics/03-double-send-and-guards.md`
- **Read this:** [Writing middleware](https://expressjs.com/en/guide/writing-middleware/) · expressjs.com · ending the request-response cycle is one of the four jobs; a middleware that does not end it must call `next()` (*read*) · covers our angle: **partial** — does not warn against `next()` after `res.json` · fetched 2026-10-12
- **Also good:** [Error Handling](https://expressjs.com/en/guide/error-handling/) · expressjs.com · the failure when `next(err)` arrives after the response has started (*read*) · fetched 2026-10-12
- **Our delta:** `return res.json(...)` as a habit, and the "headers already sent" error as the symptom of `next` after send.
