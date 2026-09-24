---
name: devbible-express-master-depth-pass
description: Express Master-tier depth pass — the live Express resume point, the measured depth defect, the 28-topic worklist and per-topic state
metadata:
  type: project
---

# Express — Master-tier depth pass (started 2026-08-14 by session `ffadd057`, continued by `b7f137c4`)

🔴 **LOCKED 2026-08-14** — *"Lock it in express js"*, given to session `b7f137c4`. Express
is rule 11 **§11a** in `~/.claude/CLAUDE.md`, which is now a **table of per-session locks**
rather than one language, so the JavaScript order no longer reads as cancelling this one.
The `docs/README.md` Express claim was repointed to `b7f137c4` rather than opened twice.
Cadence here is **per file**. Detail: [[devbible-feedback-express-supersedes-react-only]].

**Instruction that started it (verbatim):** *"I want you to pick up express js from
memory you will get to know about the progress i am counting on you to finish it and do
not wait for me and pick recomended action till the express js compelte again do not wait
for me. Especially there was hard rule about file size and memory saved make sure you
have to follow as it as"* — plus, mid-turn: *"there were other sesssions running
simulatenously on different lang so do not worry about build errors fix only what your
working on."*

So: **run to Express completion without pausing**, honour
[[devbible-feedback-never-compress-to-fit-cap]] exactly, and **only ever fix Express** —
other languages' build warnings belong to their own live sessions.

⚠️ **This superseded the React-only standing order** in the session that started it, and
is now a lock in its own right — see [[devbible-feedback-express-supersedes-react-only]].

## Why there is work left, when the last session marked Express COMPLETE

[[devbible-expressjs-completion]] is accurate on everything **countable**, and I
re-verified all of it on 2026-08-14 before starting. It is all still true:

- 11 phases, **114 of 114 syllabus topics**, 86 pages (the memory says 85; it is 86)
- **every** page carries `> Verified:`, a tier badge, Gotchas, a Trade-off and Interview
  questions — the audit returned zero misses on all five
- **every** phase README has a Coverage table
- **zero** duplicate `##` headings (the defect that pass introduced and fixed)
- **zero** files over 300 lines

**What it does not capture is depth.** Measured 2026-08-14, all 86 non-README pages:

| Tier | Pages | Avg lines | Max |
|---|---|---|---|
| Master | **28** | **139** | **200** |
| Know | 14 | 160 | 216 |
| Understand | 41 | 144 | 197 |
| When Needed | 2 | 192 | 193 |

🔴 **The tier curve is flat, and no Master topic is chunked.** Master averages *fewer*
lines than Understand. The deepest Master page in Express is 200 lines; the deepest page
of any tier is 216. Compare the rest of the corpus: PostgreSQL Master topics median
**530 lines chunked** vs 220 unchunked; React Phase 2 turned 16 topics into 29 files;
Node's median is 205 with real spread.

That is exactly the tell the hard rule names — *"a run of pages all landing in a narrow
band … is evidence of budgeting, not of topics that happened to be that size"* — except
here the band sits **well under** the cap rather than just under it. Express was written
fastest of any technology in this project (the original 78 pages in 30 minutes by a
co-session; the completion pass at ~2 h for 50 topics), and the depth shows it.

**Conclusion: Express is structurally complete and not finished.** The remaining work is
a depth pass across the **28 Master-tier topics**, each expanded to the depth the topic
deserves and **split into a `NN-topic/` directory on a concept boundary when it passes
300 lines**.

## Rules binding this pass

- 🔴 **The 300-line cap is a FILE-SIZE rule, never a content budget.** Write the
  explanation the topic deserves first, then split. A Master topic running 600–1000+
  lines across three or four chunks is the expected outcome here, not an exception.
  [[devbible-feedback-never-compress-to-fit-cap]]
- 🔴 **No sandbox, no runs, no `ex*` scripts.** Documentation and the web only, source
  named in the `> Verified:` line. **No run means no console block** — never reconstruct
  one. [[devbible-no-new-sandbox-scripts]]
- **Additive, not destructive.** Existing prose, examples and console blocks stay.
  In particular the Phase 0 `Sandbox-measured` Verified lines and the two flagged-wrong
  `body: undefined` blocks (`3/01`, `3/02`) are left exactly as they are.
- **Chunk link form:** every link ends in `.md` and keeps every numeric prefix —
  `../01-inner-join/README.md`, `../01-inner-join/02-fan-out.md`. Never the directory
  slug. When a file becomes a directory, fix inbound links in the **phase README, the
  Coverage table, neighbouring page footers, and page bodies** — the body links are the
  ones the corpus keeps missing.
- **UI after every topic; memory after every 2–3 files.** Both, always.
- **Shared checkout, other sessions live** — never `git add -A`, stage explicit paths,
  touch only the `expressjs` rows in `src/data/progress.js`, and ignore build warnings
  that are not Express's. [[devbible-feedback-parallel-sessions]]

## The 28 Master topics — worklist

Baseline line counts measured 2026-08-14, before any expansion.

| # | Phase | Page | Base | State |
|---|---|---|---|---|
| 1 | 0 basics | `01-what-express-is/` | 121 | ✅ **4 chunks, 958 lines** — `6b37199` |
| 2 | 0 basics | `02-app-router-server/` | 130 | ✅ **5 chunks, 1,129 lines** — `65cfb51` |
| 3 | 0 basics | `03-request-lifecycle/` | 135 | ✅ **3 chunks, 735 lines** — `8611c21` |
| 4 | 1 routing | `01-http-methods/` | 117 | ✅ **3 chunks, 717 lines** — `c3efed5` |
| 5 | 1 routing | `02-params-and-query/` | 145 | ✅ **3 chunks, 763 lines** — `76207d9` |
| 6 | 1 routing | `03-router-composition/` | 135 | ✅ **3 chunks, 764 lines** — `51976c4` |
| 7 | 2 middleware | `01-middleware-contract/` | 117 | ✅ **3 chunks, 750 lines** — `68d5015` |
| 8 | 2 middleware | `02-execution-order/` | 102 | ✅ **2 chunks, 508 lines** — `bbeebe0` |
| 9 | 2 middleware | `03-next-semantics/` | 152 | ✅ **3 chunks, 799 lines** — `6c80ae8` |
| 10 | 3 requests | `01-req-anatomy/` | 123 | ✅ **3 chunks, 741 lines** — `26b669d` |
| 11 | 3 requests | `02-json-and-urlencoded/` | 110 | ✅ **3 chunks, 706 lines** — `73641c4` |
| 12 | 3 requests | `03-size-limits/` | 89 | ✅ **3 chunks, 659 lines** — `43ba472` |
| 13 | 4 responses | `01-res-methods/` | 86 | ✅ **3 chunks, 789 lines** — `4aecd01` |
| 14 | 4 responses | `02-status-and-headers/` | **63** | ✅ **2 chunks, 495 lines** — `4aecd01` (was the thinnest page in the corpus) |
| 15 | 5 errors | `01-error-middleware/` | 137 | ✅ **3 chunks, 783 lines** — `3cd4481` |
| 16 | 5 errors | `02-async-errors/` | 153 | ✅ **3 chunks, 812 lines** — `710511c` |
| 17 | 5 errors | `03-error-contract/` | 147 | ✅ **3 chunks, 730 lines** — `d98cff1` |
| 18 | 6 REST | `01-rest-resources/` | 128 | ✅ **3 chunks, 729 lines** — `0eae9e3` |
| 19 | 6 REST | `02-status-mapping/` | 129 | ✅ **2 chunks, 484 lines** — `1fc44ab` |
| 20 | 6 REST | `03-pagination/` | 152 | ✅ **2 chunks, 496 lines** — `9550802` |
| 21 | 7 layering | `01-controller-service-repository/` | 185 | ✅ **3 chunks, 761 lines** — `a18404c` |
| 22 | 8 authz | `01-validate-at-boundary/` | 157 | ✅ **2 chunks, 492 lines** — `260e9c9` |
| 23 | 8 authz | `02-validation-factory/` | 200 | ✅ **3 chunks, 758 lines** — `ee2e57c` |
| 24 | 8 authz | `04-authn-middleware/` | 192 | ✅ **DONE** — 3 chunks (244+269+282) + README, 192 → 876 lines |
| 25 | 8 authz | `06-rbac-middleware/` | 167 | ✅ **3 chunks + README, 891 lines** — `15f247c` |
| 26 | 8 authz | `07-ownership/` | 171 | ✅ **3 chunks + README, 801 lines** — `f3a27ca` |
| 27 | 9 hardening | `01-trust-proxy/` | 183 | ✅ **3 chunks + README, 712 lines** — `5a670af` |
| 28 | 10 factory | `01-create-app/` | 179 | ✅ **3 chunks + README, 743 lines** — `b7bb522` |

## 🔴 The find that makes this pass possible — the Express source is on disk

**`sandbox/express-verify/node_modules/` holds `express@5.2.1` and `router@2.2.0`.**
Reading it is **not a run** — it is a primary source, better than the prose docs, and it
lifts the depth ceiling enormously. Cite by file and function; add no console block.

Sizes, `wc -l`, 2026-08-14: express `lib/` = `application.js` 631 · `response.js` 1053 ·
`request.js` 514 · `utils.js` 271 · `view.js` 205 · `express.js` 81 = **2,755**;
router = `index.js` 748 · `layer.js` 247 · `route.js` 242 = **1,237**.

Mechanism facts already mined from it, reusable across the whole pass:

- **`createApplication` returns a function**, `function(req,res,next){app.handle(...)}`,
  then `mixin`es `EventEmitter.prototype` and `lib/application.js` onto it. The app *is*
  a request listener and *is* an EventEmitter.
- **`app.handle` re-parents prototypes, it does not wrap.**
  `Object.setPrototypeOf(req, this.request)` on the live `http.IncomingMessage`, where
  `app.request` is `Object.create(express/lib/request.js)` plus an `app` property. So
  `req instanceof http.IncomingMessage` stays true and every Node method survives.
- Order inside `app.handle`: `finalhandler` chosen → `X-Powered-By` → `req.res`/`res.req`
  → both `setPrototypeOf` → `res.locals = Object.create(null)` → `router.handle`.
- **`app.listen` is 8 lines**: `http.createServer(this)` then `server.listen(...)`; wraps
  a callback in `once` and also binds it to `server.once('error')` — so `EADDRINUSE`
  *does* reach it, which the docs never say.
- 🔴 **`app.router` is a lazy getter** that constructs `new Router({caseSensitive, strict})`
  on **first access**, reading both settings once. Any route registration triggers it, so
  `app.set('strict routing', …)` afterwards is **silently ignored**.
- **`defaultConfiguration` sets** `x-powered-by` on, `etag` `'weak'`, `env` from
  `NODE_ENV`, **`query parser` `'simple'`**, `subdomain offset` 2, `trust proxy` false,
  view/views/jsonp names, `view cache` only in production. It never sets
  `case sensitive routing` / `strict routing` — hence `undefined`, not `false`.
  🔴 **This settles the `qs` vs `simple` doc contradiction: the source says `simple`.**
- **`defaultConfiguration` registers the `mount` listener** that `setPrototypeOf`s a
  sub-app's `request`/`response`/`engines`/`settings` onto the parent's — sub-app
  inheritance is by prototype chain, and a `Router` gets none of it.
- **`express.json/raw/text/urlencoded` are re-exports of `body-parser`**, `express.static`
  is `serve-static`, `express.Router` is `router`. Their errors and options belong to
  those packages, not to Express.

### From `router@2.2.0` (mined for topic 2, reusable for phases 1, 2 and 5)

- **`Router.prototype = function () {}`** — the prototype is literally a Function, and
  the constructor does `Object.setPrototypeOf(router, this)` over an inner
  `function router(req,res,next){ router.handle(...) }`. **A Router is callable for the
  same reason an app is.** That is why `app.use` can take a function, a Router or a whole
  sub-app with no special case.
- **`Router.prototype.use` builds its Layer with `{sensitive: caseSensitive, strict:
  false, end: false}` and `layer.route = undefined`.** So `strict routing` **never**
  affects a `use` mount, a `use` layer is a **prefix** match, and `layer.route` is the
  flag the dispatcher uses to tell middleware from routes.
- Source comment on `use`, quotable: *"Use (like `.all`) will run for any http METHOD,
  but it will not add handlers for those methods so OPTIONS requests will not consider
  `.use` functions even if they could respond."*
- **`Router.prototype.handle` installs** `req.next = next`, sets `req.baseUrl = parentUrl`
  and **`req.originalUrl = req.originalUrl || req.url` (set once, outermost wins)**, and
  wraps the callback in `restore(callback, req, 'baseUrl', 'next', 'params')` so a nested
  router cannot leak those three to its parent.
- 🔴 **`if (layerError) { match = false; continue }`** — **route layers refuse to match
  while an error is pending.** This single line is the mechanism behind error middleware,
  behind "an error handler above the route never runs", and behind 404-not-being-an-error.
- **`if (++sync > 100) return setImmediate(next, err)`** — the router breaks the
  synchronous call stack every 100 consecutive `next()` calls; `sync` resets when a layer
  actually runs.
- **`if (!hasMethod && req.method !== 'HEAD') match = false`** — a route with no `head`
  handler still matches HEAD, and the `Route` dispatches it to the `get` stack. That is
  the mechanism behind the documented "app.get covers HEAD unless app.head came first".
- **`trimPrefix`** requires the character after the prefix to be `/` or nothing (so
  `/admin` does not match `/administrator`), slices the prefix off `req.url`, re-adds a
  leading `/`, and appends the prefix to `req.baseUrl` with any trailing slash stripped.
- 🔴 **Express DOES send an `Allow` header — for `OPTIONS` only.**
  `generateOptionsResponder` threads an empty `methods` array through the walk;
  `sendOptionsResponse` sorts and de-duplicates it and sets `Allow`, `Content-Length`,
  `Content-Type: text/plain`, `X-Content-Type-Options: nosniff`, with the same string as
  the body. Fires only if at least one **route** matched and nothing responded.
  ⚠️ **This refines the phase-1 note in [[devbible-expressjs-completion]]** that said
  there is "no built-in `Allow` header anywhere" — true for 405, **false for OPTIONS**.
  Express still never sends 405.
- 🔴 **`app.get` is OVERLOADED**: `if (method === 'get' && arguments.length === 1) return
  this.set(path)`. So **`app.get('/health')` with a forgotten handler reads a *setting*,
  returns the app, and throws nothing** — the route is silently never registered. No
  other verb does this; `app.post('/x')` throws `argument handler is required`.
- **The verb helpers are generated from `require('node:http').METHODS`** — **35 on Node
  24.19.0**, lowercased, including `QUERY`, `SEARCH`, `REPORT`, `PURGE`, the WebDAV
  verbs, and `M-SEARCH` reachable only as `app['m-search']`.
- **`app.all` loops all 35 methods** and pushes **35 layers**; `Route.prototype.all`
  pushes **one** layer with `method: undefined` and sets `methods._all`. Same behaviour,
  different object — and `route.all` is the one that chains with the verbs after it.
- **The HEAD→GET rewrite is conditional on `!this.methods.head`**, in **both**
  `Route._handlesMethod` and `Route.dispatch`. So registering `app.head` **takes HEAD
  away from the GET handler** rather than adding a path. And the rewrite is at dispatch,
  so **HEAD runs the whole GET handler** — cheap on the wire, not on the server.
- **`Route._methods()` appends `'head'`** when `get` exists and `head` does not, so the
  `OPTIONS` `Allow` header advertises the fallback.
- **A 405 cannot be done globally** — the method map lives on each `Route` inside a
  router's `stack`, an internal. Per-route `route.all(...)` after the verbs is the honest
  form, and RFC 9110 §15.5.6 makes `Allow` **required** on a 405.
### From `path-to-regexp@8.4.2` and `express/lib/request.js` (mined for topic 5)

- 🔴 **`req.params` has a NULL PROTOTYPE for string paths but NOT for RegExp routes.**
  `path-to-regexp`'s `match` builds `Object.create(null)`; the router's own
  `regexpMatcher` (the RegExp branch of `Layer`) builds a plain `{}`. So
  `req.params.hasOwnProperty(…)` throws on one route and works on another. Always
  `Object.hasOwn`.
- **Unmatched optional params are OMITTED**, not `undefined` — `if (m[i] === undefined)
  continue` in `match()`, so the key is never created and `'x' in req.params` is false.
- **The splat decoder is `(value) => value.split(delimiter).map(decode)`** — hence splat
  params are **arrays of individually decoded segments**. Express 4 code reading
  `req.params[0]` gets a comma-joined string.
- **`decodeParam`** rewrites a `URIError` to `Failed to decode param '<val>'` and sets
  **`err.status = 400`**; `matchLayer` catches the throw and it becomes the walk's error.
  A custom error handler that ignores `err.status` turns it into a 500.
- **`Layer` calls `pathRegexp.match(opts.strict ? _path : loosen(_path), {sensitive, end,
  trailing: !opts.strict, decode: decodeParam})`** — `loosen()` strips trailing slashes
  **from the pattern** when `strict` is off.
- 🔴 **`req.query` is a GETTER that re-parses on EVERY access** —
  `defineGetter(req,'query', …)` calls `queryparse(querystring)` each time, so two reads
  return two different objects, mutation is pointless, and Express 5's "no longer
  writable" is a consequence of this shape.
- **`compileQueryParser` accepts exactly** `true`/`'simple'` → `querystring.parse`,
  `false` → disabled (`req.query` is an always-empty `Object.create(null)`),
  `'extended'` → `qs`, a function → yours; **anything else throws `TypeError` at
  `app.set` time**.
- 🔴 **`parseExtendedQueryString` runs `qs@6.15.3` with `allowPrototypes: true`** — an
  option **qs's own README carries a WARNING against**: *"It is generally a bad idea to
  enable this option."* So under `extended`, `?a[hasOwnProperty]=b` yields
  `{a:{hasOwnProperty:'b'}}` and any code calling that method crashes. Scope it correctly
  in writing: this shadows properties **on the parsed object**, it is not global
  `Object.prototype` pollution.
- **`simple` is not the mitigation for the shape attack.** It defuses bracket nesting but
  **arrays from duplicate keys survive on both parsers**, and a later switch to
  `extended` reopens the object case with no code change.

### From `router@2.2.0` `handle`/`mergeParams`/`restore` (mined for topic 6)

- **`restore(fn, obj, ...props)`** snapshots the named props at router entry and
  **reassigns them before calling `fn`** — so `baseUrl`, `next` and `params` are put back
  as the request unwinds. Router isolation runs in **both** directions.
- **`req.params` is ASSIGNED, not merged**: `req.params = self.mergeParams ?
  mergeParams(layer.params, parentParams) : layer.params`.
- 🔴 **`mergeParams` is `Object.assign(copyOfParent, childParams)` — the CHILD WINS.**
  A nested bare `:id` silently shadows the parent's, with no warning. Naming discipline
  (`:userId`, `:orderId`) is the only defence.
- **Numeric (RegExp) captures are RE-INDEXED, not overwritten** — the child's indices are
  offset past the count of the parent's, so the parent keeps `[0]`, `[1]` and the child's
  `[0]` becomes `[2]`.
- **A `Router` does NOT inherit `case sensitive routing` / `strict routing` from the app.**
  The app passes them only to **its own base router**, at first construction. A router you
  build takes them from its own constructor options — so an app-wide setting silently does
  not apply across a mount.
- **`processParams` keeps a `called` cache keyed by param name**, which is the mechanism
  behind the doc's *"a param callback will be called only once in a request-response
  cycle"*, and it re-applies a callback's **modified** value on later matches.

### From `router@2.2.0` `handle`/`route.js` (mined for topic 9 — `next` semantics)

- **`next` interprets its one argument FOUR ways**: `layerError = err === 'route' ? null
  : err`, then `if (layerError === 'router') setImmediate(done, null)`, then
  `if (layerError)` for error mode. **Falsy is silently "no error"** — which is exactly
  what makes `fs.readFile(path, next)` work, since an error-first callback passes `null`.
- 🔴 **A non-sentinel string becomes the error VALUE.** `next('user not found')` reaches
  error middleware as a primitive string: `err.message`, `err.status` and `err.stack` are
  all `undefined`, so the usual result is an empty 500. And **the two sentinels have no
  namespace** — a message that happens to equal `'router'` silently changes control flow.
- **`next('router')` exits the whole router via `setImmediate`** — asynchronous, one tick,
  and the router's frames are gone from any later stack trace.
- **`Route.dispatch`'s `next` mirrors both sentinels**: `err === 'route'` → `done()` (leave
  the route, keep walking the router); `err === 'router'` → `done(err)` (propagate).
- **`res.status()` after `headersSent` fails SILENTLY** — it mutates a field nobody reads
  and does not throw. Only a *write* throws `ERR_HTTP_HEADERS_SENT`. That asymmetry is why
  a too-late status is invisible and a too-late body is loud, in someone else's code.
- **Nothing in express or router sets a timer.** A hang has no status, no `'finish'` event
  and therefore no access-log line. A timeout middleware makes it visible; it does not
  cancel anything.

### From `express/lib/request.js` and `body-parser@2.3.0` (mined for topics 10 and 11)

- **`req` has exactly TWELVE `defineGetter` properties**: `query path protocol secure ip
  ips subdomains host hostname fresh stale xhr`. **None is cached** — each recomputes on
  every access.
- 🔴 **SIX of them read `trust proxy fn`** — `ip`, `ips`, `protocol`, `secure`, `host`,
  `hostname` (and `subdomains` via `hostname`). They fail **together**, which is why one
  wrong setting breaks rate limiting, `secure` cookies and HTTPS redirects at once.
- **`req.protocol`** = `socket.encrypted ? 'https':'http'`, then, if trusted, the **first**
  comma-separated `X-Forwarded-Proto` value. TLS at a proxy with no `trust proxy` ⇒
  `req.secure === false` ⇒ the "secure cookie disappears in production" bug.
- **`req.fresh` returns early unless the method is GET or HEAD**, and needs a 2xx/304
  status. That is the mechanism behind Express never evaluating `If-Match`.
- **`req.get` aliases `referer`/`referrer`** (checks `referrer` first) and **throws
  `TypeError`** on a missing or non-string name.
- **`req.is()` returns `null` for no body** vs `false` for a body of another type.
- **`body-parser@2.3.0`** — the four gates in `read()`: already-finished → no body
  (`hasBody`) → `shouldParse` (content type) → charset. **The first three are silent.**
  And the literal line **`if (!('body' in req)) { req.body = undefined }`** is where the
  `undefined` comes from.
- 🔴 **`strict: true` (default) rejects VALID JSON.** First non-whitespace char must be
  `{` or `[`, so `42`, `"hello"`, `true`, `null` — all valid RFC 8259 documents — are 400
  `entity.parse.failed`. A body-parser policy, not a JSON rule.
- 🔴 **An EMPTY body parses to `{}`** in both strict and non-strict modes, with the source
  comment *"special-case empty json body, as it's a common client-side mistake"*. So
  "sent nothing" and "sent `{}`" are indistinguishable at the parser.
- **`limit` default is the literal `102400`**; an unparseable value **throws at mount
  time** (`option limit "…" is invalid`).
- **A failing `verify` hook is 403 `entity.verify.failed`**, not 400 — modelled as an
  authenticity check.
- **Error table**: 400 `entity.parse.failed` · 403 `entity.verify.failed` · 413
  `entity.too.large` (from `raw-body`) · 415 `charset.unsupported` · 415
  `encoding.unsupported`. **`err.type` is the stable contract; `err.message` is not.**
- **JSON charset gate** is `charset.slice(0,4) === 'utf-'`, so only `utf-*` is accepted.

### From `raw-body` and `body-parser` `contentstream` (mined for topic 12)

- **TWO paths to 413.** Up front in `readStream`, `length > limit` from
  `Content-Length` — **nothing is read**, error carries `expected`/`length`/`limit`.
  Then in `onData`, `received > limit` — error carries `received`. **Different fields**,
  so an error handler reporting the size must read both.
- 🔴 **`contentstream` only sets `req.length` for an `identity` encoding.** A compressed
  body therefore **always** takes the accumulator path: **`limit` measures the
  DECOMPRESSED size**, a zip bomb is bounded in memory but not in the CPU to inflate up
  to `limit` per request.
- **body-parser DRAINS the request on error** (`dump(req, …)`) before calling `next`, so
  an unread body cannot corrupt the next request on a keep-alive connection; it also
  `unpipe()`s and destroys any decompression stream it created.
- Sibling errors from the same reader: **400 `request.aborted`** (`code: 'ECONNABORTED'`)
  and **500 `stream.encoding.set`** when something called `req.setEncoding()` above the
  parser.

### From `express/lib/response.js` (mined for topics 13–14) — the richest file, 1,053 lines

- **`res.send` dispatches on `typeof`**: string → **`text/html`** (not plain!) if no
  Content-Type set; `null` → **empty body**; `ArrayBuffer.isView` → `application/octet-stream`;
  boolean/number/other object → **delegates to `res.json`**.
  🔴 So **`res.send(404)` is a 200 with the JSON body `404`** — the Express 4 `sendStatus`
  alias is gone.
- **After the dispatch, `res.send` also**: appends `charset=utf-8` to a string's type;
  computes `Content-Length` (cheap `byteLength` path when no ETag and `chunk.length <
  1000`); generates the ETag via `etag fn`; 🔴 **`if (req.fresh) this.status(304)`** — it
  *silently downgrades your 200 to an empty 304*; **strips `Content-Type`,
  `Content-Length`, `Transfer-Encoding` and empties the body for 204 and 304** (205 gets
  `Content-Length: 0`); and **drops the body for HEAD**.
- **`res.json` is a thin wrapper** — `stringify(obj, json replacer, json spaces, json
  escape)`, set `application/json` if unset, then **`return this.send(body)`**. So every
  behaviour above applies to every JSON response.
- **`res.sendStatus(code)` is TERMINAL and sends a body**: the status *message* as
  `text/plain`. `res.sendStatus(404)` writes the literal `Not Found`.
- 🔴 **`res.status` now throws** — `TypeError` for a non-integer, `RangeError` outside
  100–999. An error map emitting a made-up code fails **inside the error handler**.
- **`res.redirect` does NOT go through `res.send`.** Default **302**; two-arg overload;
  it **content-negotiates a small body** via `res.format` and calls `res.end` directly.
  **`res.location` = `set('Location', encodeUrl(url))` — encodes, never validates**, which
  is the open-redirect surface.
- **`res.set`** stringifies everything (`String(val)` — so `undefined` becomes the text
  `"undefined"`), allows arrays, **throws `TypeError` for an array `Content-Type`**, and
  runs Content-Type through `mime.contentType` (hence the auto charset).
  **`res.append` accumulates into an array**; `res.vary` de-duplicates; `res.links`
  appends to an existing `Link`.
- **`res.type`**: no `/` ⇒ extension lookup, **unknown falls back to
  `application/octet-stream`** rather than throwing — so a typo silently becomes a
  download.
- **Header timing asymmetry**: after `headersSent`, `res.set`/`res.status` are **silent
  no-ops**; only a write throws.

### From `finalhandler@2.1.1` (mined for topic 15)

- **The SAME call produces every 404 and every default 500** — `if (err) {…} else { status
  = 404; msg = 'Cannot ' + req.method + ' ' + encodeUrl(...) }`. That is the mechanical
  reason a 404 never reaches four-arg middleware, and where `Cannot GET /foo` comes from.
- **`getErrorStatusCode`** believes `err.status` only if it is a **number in [400,600)**,
  then `err.statusCode` on the same terms. **A string `'404'` is ignored; a 3xx is
  ignored.** Otherwise it falls back to `res.statusCode` (defaulted to 500 outside
  400–599) — so **a handler that already called `res.status(422)` and then threw yields a
  422**.
- **`err.headers` is copied ONLY when the error supplied a valid status.**
- **`getErrorMessage`: outside `production` the response BODY is `err.stack`** itself, not
  the message. In production it is the bare status text — safe and useless, which is the
  real argument for a custom handler.
- 🔴 **If the response already started, finalhandler calls `req.socket.destroy()`** — not
  a graceful end, deliberately, because a truncated body that ends cleanly would be
  parsed as complete. That is what `if (res.headersSent) return next(err)` delegates to.
- **Express's `logerror` `console.error`s `err.stack` unless `env === 'test'`**, scheduled
  with `setImmediate` — the origin of terminal stack traces no logger of yours emitted.
- There is also a **404 guard**: `if (!err && res.headersSent) return` — it declines to
  404 a response that has already started.

- **`app.use`'s duck test is `fn.handle && fn.set`.** A sub-app also gets
  `fn.mountpath = path`, `fn.parent = this`, a `mount` emit, and a `mounted_app` wrapper
  that **restores the parent's `req`/`res` prototypes** before calling `next(err)` on
  fallthrough. A `Router` has no `set`, so it gets none of that — hence no `mountpath`.

## NEXT — resume here

**Phase 0 COMPLETE and build-verified (0 Express broken links). Phase 1 topic 01 done.
Phase 1 COMPLETE and build-verified (0 Express broken links; the JS and TS ones in that
log are other sessions').

**Phases 0, 1 and 2 COMPLETE and build-verified** — the phase-2 close build reported
**zero broken links anywhere in the site**.

**Phases 0–3 COMPLETE and build-verified** (zero broken links).

**Phases 0–4 COMPLETE and build-verified** (zero broken links).

**Phases 0–5 COMPLETE and build-verified** (zero broken links).

**Phases 0–6 COMPLETE and build-verified** (zero broken links).

**Phases 0–7 COMPLETE.** (Phase 7's build is pending — run it at the phase-8 close, or
now if convenient.)

🔴 **PER-FILE SAVES from 2026-08-14** — user reported 90% usage and asked that progress
be saved *the moment each file completes*, not per topic. Commit each chunk as it is
written and update this memory with the exact chunk state.

✅ **#24 COMPLETE (2026-08-14).** `04-authn-middleware/` = `_category_.json` +
`01-one-question-only.md` (244) + `02-tokens-sessions-and-cost.md` (269) +
`03-mounting-and-testing.md` (282) + `README.md` (81). Flat file `git rm`'d, **10 inbound
links repointed** to `04-authn-middleware/README.md`, phase-8 topic row *(3 chunks)* and
two Coverage rows updated, `docs/README.md` counters to **24 of 28**. `check-links.py`
**0 broken**; the isolated build reports **0 Express broken links** (the three in that log
are TypeScript's, another session's). Commits `1068ee3` · `99c2711` · `c7cc23e` ·
`ab5bb0a` · `8f1773b`.

What the two new chunks argue, so they are not re-derived:
- **02** — stateless vs session is *where the truth lives*, and the other five rows follow
  from it. A signature check does not prove the account exists / the role is current / the
  user has not logged out; that staleness window is the token's lifetime. Three revocation
  answers: denylist on `jti` with TTL = remaining lifetime, per-user version counter, or
  short lifetimes + refresh. **Rotate refresh on use; reuse = theft, invalidate the
  family.** Cookie vs `Authorization` is an exposure trade (CSRF vs XSS), not a security
  ranking. Identifiers not data in a token — 16 KiB of headers is a **431**. Sources:
  RFC 6750, RFC 7519 §4.1, RFC 9110 §15.5.2, RFC 6585 §5, MDN Set-Cookie, Node
  `--max-http-header-size`, the express-session / cookie-parser entries on expressjs.com.
- **03** — opt-in vs opt-out is decided by **asymmetric forgetting**: forgetting to protect
  is silent and ships, forgetting to exempt is a loud 401. So opt-out on the owning router,
  with the *public* routes as the greppable commented list. **CORS before authn** —
  preflight carries no credentials, so a 401'd `OPTIONS` surfaces as a CORS error on
  correct config. Rate limit before, body-parse after (raw-body webhooks excepted). Test
  the **deny** paths and assert identical bodies; route-coverage test with `PUBLIC` kept in
  the test file. ⚠️ **Do not enumerate routes from `router.stack`** — undocumented internal.

✅ **#25 COMPLETE (2026-08-14).** `06-rbac-middleware/` = `01-the-second-question.md` (253)
+ `02-permissions-not-roles.md` (273) + `03-what-rbac-cannot-do.md` (298) + `README.md` (67).
Flat file `git rm`'d, 5 inbound links repointed, phase-8 topic row *(3 chunks)* and the RBAC
Coverage row updated, `docs/README.md` to **25 of 28**. `check-links.py` 0 broken.

What the chunks argue:
- **01** — 401 vs 403 are *instructions to the client*, not shades of no; a 403 sent as 401
  makes a well-behaved client refresh-and-retry forever. Fail closed in four places
  (`?? []`, missing `req.user` → 401 not a TypeError→500, a thrown lookup denies, unguarded
  route unreachable). Normalize the role **once** where `req.user` is built. **Authn is
  per-router, authz is per-route** — a router-wide permission over-grants reads.
- **02** — routes name capabilities (`orders:delete`), not roles; `resource:action`, no
  wildcards (retroactive silent grants), **flat lists over hierarchy** (the first auditor
  role breaks the chain), **grant-only, no deny rules** (precedence is where bugs hide).
  Role in the token, permissions resolved server-side; permissions-in-token can't change
  until expiry and grows toward 431. OAuth scope is the deliberate exception —
  RFC 6749 §3.3 + `insufficient_scope`→403 in RFC 6750 §3.1. Five-step migration; never
  bulk find-and-replace.
- **03** — the gap stated exactly: middleware runs before the load, so ownership is
  impossible there, and **every happy-path test passes** because tests use the user's own
  ids. `router.param` is not the fix (loads on every route with that param, hides I/O in
  routing, can't express state/time rules, splits authz across layers) — it earns its place
  only for uniform tenant scoping. When RBAC stops fitting: roles that describe
  *relationships* → ABAC/ReBAC, but **do not build a policy engine early**. The **role ×
  route matrix test** catches the unmounted guard a unit test cannot. Log denials (actor,
  permission, route — never the credential).

✅ **#26 COMPLETE (2026-08-14) — PHASE 8 MASTER TIER DONE.** `07-ownership/` =
`01-the-bug-that-survives-review.md` (207) + `02-scope-the-query.md` (267) +
`03-status-and-proving-it.md` (256) + `README.md` (71). Flat file `git rm`'d, **26 inbound
links repointed** (the most of any topic — ownership is referenced across phases 1, 2, 4,
5, 6, 7, 8, 10 and the reviews dir). `check-links.py` 0 broken; **phase-8 close build: 0
Express broken links** (the git and typescript ones in that log are other sessions').

What the chunks argue:
- **01** — IDOR survives review because every line is individually right, and survives tests
  because fixtures use the user's own ids. **Six places the identifier arrives**: path, body
  field, nested route's parent, filter/sort key, every element of a bulk array, indirect
  refs (file keys, export ids). **UUIDs are not a fix**; schema validation is not a fix.
- **02** — scope the query (`findOwned(id, actorId)`) over compare-after-load, for four
  reasons incl. *the unauthorized row never enters the process* and *timing collapses*.
  The unscoped method **should not exist**. Writes: scope the statement and **check the
  affected-row count** (a matched-nothing UPDATE is not an error). Nested routes need parent
  scope + the relationship asserted. Scope from `req.user`, never the payload. Privileged
  path named separately (`findByIdAcrossTenants`) so the audit is a grep — never an
  `ignoreOwnership` flag. PostgreSQL RLS is a backstop, not a substitute.
- **03** — 404 vs 403 by *what the caller may learn*; RFC 9110 §15.5.4 explicitly permits
  404 to hide a forbidden resource, §15.5.5 covers "unwilling to disclose". Choose per
  resource type — a lone 403 among 404s leaks by contrast. **Channels that leak anyway**:
  distinct error code in the envelope, ETag/Location headers, response time, body shape,
  side effects. The missing fixture is **a second real user**; the write test must assert
  the row is unchanged; a mocked repo defeats the whole suite.

**Then** #25's successors — `06-rbac-middleware.md` (167), #26 `07-ownership.md` (171), #27
`phase-9/01-trust-proxy.md` (183), #28 `phase-10/01-create-app.md` (179) — and that is
the whole pass. Run a build at the phase-8 close and again at the end.

⚠️ **Phase 8 is the highest-consequence phase in the corpus** — ownership/IDOR, tenant
isolation, authn. The existing pages already carry good material (see the phase-8
concept record in [[devbible-expressjs-completion]]); the depth pass should deepen the
*mechanism* and keep every security claim conservative.

🔴 **Trap found at topic 20: cross-track links need one MORE `..` inside a chunk
directory.** `../../../postgresql/pages/README.md` was right from
`phase-6-rest-surface/` and is wrong from `phase-6-rest-surface/03-pagination/` — it
needs four. `check-links.py` caught it; the flat-file version had been correct. Run the build at each phase close,
after `rm -rf .docusaurus-express node_modules/.cache`.

⚠️ **Phase 6 onward is mostly NOT Express API.** REST modelling, status mapping and
pagination are design topics — the source-reading that carried phases 0–5 gives much less
here. Lean on **RFC 9110**, **RFC 8288** (Link), **RFC 9457** (problem+json) and the
concept record in [[devbible-expressjs-completion]], and keep saying on-page which
recommendations are this bible's rather than upstream.

🔴🔴 **PASS COMPLETE — 28 of 28, 2026-08-14.** The 28 Master topics went from **3,829
lines to 21,190**, 2–5 chunks each, every split on a concept boundary. Express corpus now
**179 files / 29,893 lines**, 11 phases, 114/114 topics, **0 files over 300**, **0 broken
links** in a clean isolated rebuild (`rm -rf .docusaurus-express node_modules/.cache` +
`DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-express yarn build --out-dir build-express`
— the typescript/git links in that log are other sessions'). Boards updated: `docs/README.md`
claims row + technology row, `docs/expressjs/pages/README.md` notice rewritten to ✅.
`src/data/progress.js` needed **no change** — Express already read 114/114 there; the depth
pass changed depth, not topic counts.

**Topic 28 notes:** chunk 01 = an app that never listens is still an app (`app.listen` is
`http.createServer(app).listen`), the four forbidden side effects and what each breaks
(`process.on` is the insidious one — fine in prod, leaks per test), config as a parameter
not `process.env`, the two-independent-apps honesty test (shared factory-created state →
order-dependent test failures; shared *injected* deps are fine). Chunk 02 = the full mount
sequence with a reason per line, **the two silent ordering mistakes** (CORS below authn;
a 3-arg error handler is never called as one), settings apply globally but belong at the
top and **do not cross into a mounted sub-app**, branch on config not `NODE_ENV`, and test
order through consequences. Chunk 03 = factory assembles / entrypoint commits, fakes over
mocks at the composition root, three runtimes from one object, the threading cost scales
with *dependencies* not routes, and a 6-step migration that leaves the app running at
every step.

## 🔴 After the pass — user decisions of 2026-08-14 (session `b7f137c4`)

The user reviewed the finished pass and made three calls. **Honour them; do not re-open.**

**1 · NEW Phase 5 topic 08 · "Every error that arrives"** — asked for directly (*"Hope
there was better topic for global error handling that should cover various errors such
async errors, database errors ... library will throw or reference errors and all kinds of
errors"*). Written, Master tier, 3 chunks + README = **828 lines**, commit `1503799`.
Express is now **115 syllabus topics, 183 files, 30,731 lines**; `src/data/progress.js`
phase 5 went 9→10 topics/pages. Build clean, 0 over cap, 0 Express broken links.
- Chosen shape (they picked it from three options): a **new topic 08**, not deepening the
  thin `04-mapping-to-http` (161) and `05-operational-vs-programmer` (130). Those two stay
  as they are — 08 links to them rather than duplicating.
- The rule the topic exists to argue: **the global handler formats, it does not
  interpret** — translation happens at the boundary that knows the vocabulary (the
  repository knows `23505` on `users_email_key`), never as a `switch` in the handler.
- 01 taxonomy (six families + who translates each, the four fields `status`/`code`/
  `expose`/`cause`, normalising non-`Error` throws incl. `throw undefined`); 02 SQLSTATE
  table **agreeing with the sandbox-proven PostgreSQL one** (`22P02` is 400 not 404,
  `40001`/`40P01` retry the whole transaction then 503, `42xxx` is a 500 = your bug),
  Mongo 11000, Prisma P2002/P2025, and 502 vs 503 vs 504 for outbound calls (an upstream
  401 is **your** 500), `fetch`'s error hiding in `cause`, `TimeoutError` vs `AbortError`;
  03 programmer errors are never 400 even when input triggered them, the fallback line by
  line, `res.headersSent` → `next(err)`, aborted clients are traffic not errors, crash
  only on process-level `uncaughtException`, and the **table test** proving every 500 says
  `INTERNAL` and leaks no stack/constraint/system code.

**2 · PARKED: Phase 9/01 `trust proxy` and Phase 8/07 `resource ownership`** —
*"Lets park trust proxy and resouce ownsership for future"*. **Interpretation applied:
kept exactly as written, nothing deleted, no re-tiering** — they are simply off the
reading path and get no further work. Recorded in the `docs/README.md` claims row. If the
user later means something stronger (delete, or re-tier to When Needed), that is a new
instruction.

**3 · `createApp` KEPT as written.** They floated dropping it (*"i think we can drop
createApp?"*) but never confirmed when offered keep / trim / delete, so it stands at 743
lines. 15 pages link to it. Do not delete on the strength of the question alone.

## 🔴 Verified state as of 2026-08-14 — re-measured, not quoted

Run against the files, not read off the board. **Use these numbers, not older ones.**

| Check | Scope | Result |
|---|---|---|
| `> Verified:` line | content pages + topic indexes | **171 / 171** |
| Tier badge | content pages + topic indexes | **171 / 171** |
| Gotchas | content pages | **142 / 142** |
| Interview questions | content pages | **142 / 142** |
| Coverage table | phase indexes | **11 / 11** |
| Files over 300 lines | corpus | **0** |
| Broken relative links | checker + isolated build | **0** |

**Shape:** 183 files = 142 content + 29 topic indexes + 11 phase indexes + 1 corpus index.
**115 syllabus topics map onto 86 topic units.** 30,731 lines.

**Tiers, measured per page** (Master 114 files / 21,407 lines · Understand 41 / 5,895 ·
Know 14 / 2,235 · When Needed 2 / 383).

🔴 **TRAP — a naive `grep -rl 't-master"'` OVER-COUNTS.** Phase index pages list every
tier in their topic tables, so they match all four. I published 76/62 from that grep and
had to correct it. **Count the FIRST `db-tier t-X` per file, excluding the corpus and
phase READMEs** — the correct non-Master figure is **57 content pages, 53 under 200
lines**. Script that gets it right is in the session log; re-derive it the same way.

## Artifact published for the user

**https://claude.ai/code/artifact/04883faf-f058-45d1-b11a-b8adc6e9a715** — "Is Express
Done?", a status ledger of the whole track (headline stats, the re-run audit, per-phase
lines with bars, tier depth, standing decisions, how claims were checked). **The user
said they love it.** File: `express-status.html` in this session's scratchpad. To update
it from a later session, pass that URL as `url` to the Artifact tool — republishing
without it creates a second artifact. Design: paper-ledger identity, teal/ochre/brick
tokens, Georgia display + system sans + mono numerals, full light/dark token set.

## Testing coverage — asked about 2026-08-14, answered from a measurement

Express-side testing is **deliberately split with the Node track**, and the boundary is
worth keeping: **Express covers *what to test about an Express app*, Node Phase 9 owns
*how to test in Node*** (21 pages: runner, assert, unit/integration/e2e, mocking, module
mocking, doubles, fixtures, coverage, vitest/jest, testcontainers, snapshot, property and
mutation, load, contract, schema compatibility).

- **Dedicated Express pages: 2** — `phase-10/03-supertest.md` (170) and
  `04-auth-in-tests.md` (159), **both Understand tier**, so both sit inside the 53 thin
  non-Master pages.
- **16 pages carry a testing section**, most added by the depth pass: deny-path tests and
  the forgotten-route coverage test (8/04·03), the **role × route matrix** (8/06·03), the
  **second-user ownership test** (8/07·03), the **error-taxonomy table test** (5/08·03),
  mount-order-by-consequence (10/01·02), contract tests (5/03·03), per-layer tests
  (7/01·02), schema tests (8/02·03), router isolation (1/03·03).
- **Only 2 Express pages link to Node Phase 9** — the cross-link is thin, and that is the
  cheapest real improvement if the user wants testing strengthened.

## What is left for whoever takes Express next

**Nothing is outstanding.** The depth pass is 28/28 and topic 08 is written. What
*exists* but was never in scope, measured 2026-08-14:

- **The Understand and Know tiers were never depth-passed** — 52 Understand files (6,625
  lines) and 24 Know files (2,904), against Master's 125 files / 22,137 lines. **62 of
  those 76 non-Master pages are under 200 lines.** That is by design: the depth pass was
  scoped to Master. It is the obvious next body of work **only if the user asks**.
- The two `body: undefined` console blocks (`3/01`, `3/02`) stay flagged-wrong in place —
  fixing them needs a run, which rule 8 forbids.
- The 28 rewritten topics have had **no review pass**. They are new, build-verified and
  link-checked, but nobody has re-read them.

🔴 **A stale generated-files dir breaks the build with a misleading error.** After
converting files to directories, the first build failed with
`Cannot find module '@site/docs/expressjs/pages/phase-1-routing/02-params-and-query.md'`
— the deleted flat files, still referenced by the cache. **`rm -rf .docusaurus-express
node_modules/.cache` first**; both, every time a file becomes a directory. Claim is recorded in
`docs/README.md` (both the claims row and the technology row) and
`docs/expressjs/pages/README.md`.

### The per-topic loop that worked, in order

1. `grep -rn "<page-stem>" docs/ src/` to find inbound links **before** converting a file
   to a directory.
2. `mkdir NN-topic/`, write `_category_.json` as
   `{"label":"NN · Topic","position":N,"collapsed":true}`.
3. Write the chunks first, then the `README.md` index (tier badge, Verified line,
   one-liner, chunk table, phase gate, "Where this connects").
4. `git rm` the old flat file; `wc -l` every chunk — **the first draft of chunk 02 came
   out at 357 and had to be re-split**, which is normal and is the rule working.
5. Fix inbound links: phase README topic row, phase README **footer**, the neighbouring
   page's **Prev** footer, and the phase README **Coverage table** (point rows at the
   specific chunk, not just the directory).
6. Run the relative-link walker (below), update the phase README note, `docs/README.md`
   rows, commit, update this memory.

```bash
python3 sandbox/express-verify/check-links.py       # committed; exit 1 on any break
```

🔴 **Two build traps, both hit for real at the phase-0 close.**

**1 · `--out-dir` is NOT enough isolation.** Docusaurus also shares `.docusaurus/`, and a
concurrent session mid-write produced a screenful of
`Cannot find module '@site/.docusaurus/...react...json'` errors that were **not mine**.
The command that actually isolates a build in this checkout:

```bash
DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-express \
  yarn build --out-dir build-express 2>&1 | grep -A1 expressjs
```

**2 · 🔴 The ad-hoc walker missed a real broken link and the build caught it.** Its regex
required the target to start with `.`, so a **bare sibling filename — the commonest form
inside a chunk directory — was invisible**. The straggler it missed was
`[Chunk 03](03-the-boundary.md)`, stale after that chunk was renumbered to 04: exactly
the file-became-a-directory straggler this corpus keeps producing, and exactly the class
`fixlinks.py` also cannot catch. The committed `check-links.py` matches any non-absolute,
non-URL link ending in `.md`.

**A walker pass is still not a build pass.** Run the build at every phase boundary.

### Chunk shape that topic 01 settled on

`01-what-express-is/` = the problem (why a framework at all) · the machine (source-level
mechanism) · what the machine delegates (separate packages, sizes, settings) · where the
machine stops (boundaries, trade-off). That four-way split generalises to most of the
remaining Master topics: **why → how it works → what it hands off → where it ends.**

## Known defects carried forward, deliberately not fixed

All three are from [[devbible-expressjs-completion]] and stay as they are, because
fixing any of them needs a run and runs are forbidden:

- `3/01`, `3/02` — shown output says `body: undefined`; the key is actually **absent**
  (`JSON.stringify` drops undefined values). Flagged in each page's Verified line.
- `6/07-etag-and-cache` — showed `If-Match → 412` as if Express evaluated it. **It does
  not.** Block labelled in place; the page now carries the handler you must write.
- Express's own docs **contradict each other** on the query parser (`req.query` reference
  still says `qs`; the 5.x settings table and migration guide say `simple`). Recorded on
  the page as a warning — read back `app.get('query parser')` rather than trusting prose.
