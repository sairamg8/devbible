---
title: "Link map · Express · Part 4 (phases 8–10)"
sidebar_label: "04 · Express · Edge & ops"
sidebar_position: 4
---

# Link map · Express · Part 4 (phases 8–10)

Covers every topic row of `docs/expressjs/syllabus/04-edge-and-ops.md`: T08-01 to T08-13 phase 8 (validation and authorization), T09-01 to T09-09 phase 9 (hardening), T10-01 to T10-11 phase 10 (app factory and ops boundary). That is 33 rows, matching the syllabus Counts table.
All 33 have a page of ours (✅), except where a row has no page of its own, in which case the block names the page that carries it. *read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** expressjs.com serves the 5.x docs. npm on 2026-10-12: `express` 5.3.0, `zod` 4.6.6, `helmet` 8.3.0, `cors` 2.8.6, `express-rate-limit` 8.7.1, `express-session` 1.19.0, `express-jwt` 8.5.1, `supertest` 7.3.1, `serverless-http` 4.0.0, `connect-timeout` 1.9.1. The Node docs fetched are v26.11.1. Pin versions in each page's `> Verified:` line. Express 5 facts read in the migration guide: `req.query` is a getter (no longer writable) with the `simple` parser by default; `req.body` is `undefined` when unparsed; rejected promises reach error middleware.
`github.com` and `npmjs.com` return 403 to our fetcher, so READMEs are cited as `raw.githubusercontent.com` copies. `helmetjs.github.io` redirects to `helmet.js.org`.

---

## Phase 8 — Validation and authorization at the edge

### T08-01 · Why validate at the HTTP boundary — Master · ✅ written `docs/expressjs/pages/phase-8-validation-authz/01-validate-at-boundary/README.md`
- **Read this:** [Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) · OWASP · allowlist vs denylist, "parse safely, then validate", structured data, common pitfalls (*read* headings and strategy sections) · covers our angle: **partial** — framework-neutral, no Express or `req.body` · fetched 2026-10-12
- **Also good:** [REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) · OWASP · input validation section: check length, range, format, type; size limit with 413; unsupported Content-Type gets 415 (*read*) · fetched 2026-10-12
- **Our delta:** services never see raw `req.body`; Express 5 leaves `req.body` as `undefined` when no parser ran, so "validated" must include "parsed at all".

### T08-02 · Zod schemas for `body`, `params`, `query` — Understand · ✅ written `docs/expressjs/pages/phase-8-validation-authz/02-validation-factory/03-schemas-that-hold-up.md`
- **Read this:** [Defining schemas](https://zod.dev/api) · zod.dev · primitives, string formats, objects, optionals, enums; labelled Zod 4, "latest version" (*headings only* plus the coercion and `stringbool` passages *read*) · covers our angle: **partial** — a library reference, nothing HTTP-specific · fetched 2026-10-12
- **Also good:** [Using Zod with Express](https://stevekinney.com/courses/full-stack-typescript/using-zod-with-express) · Steve Kinney · schemas wired to body, params and query; last modified 2026-03-09; examples use Zod 3 conventions with v4 notes (*read*) · fetched 2026-10-12
- **Our delta:** three schemas per route (one per source), `.strict()` or strip policy for unknown keys, and that the page pins Zod 4.x.

### T08-03 · Reusable validation middleware factory — Master · ✅ written `docs/expressjs/pages/phase-8-validation-authz/02-validation-factory/README.md`
- **Read this:** [Using Zod with Express](https://stevekinney.com/courses/full-stack-typescript/using-zod-with-express) · Steve Kinney · `validateBody`, `validateQuery`, `validateParams` factories: schema in, 400 with details out, parsed output replaces the request property; last modified 2026-03-09 (*read*) · covers our angle: **partial** — it overwrites `req.query`, which the Express 5 migration guide says is no longer writable · fetched 2026-10-12
- **Also good:** [Writing middleware](https://expressjs.com/en/guide/writing-middleware/) · expressjs.com · the configurable-middleware pattern (export a function that returns the middleware) and Express 5 async rejection handling (*read*) · fetched 2026-10-12
- **Our delta:** 🔴 put parsed output on a new property (not `req.query`); only 400 for input errors, `next(err)` for everything else; typed output on `req`.

### T08-04 · Coercion traps — Understand · ✅ written `docs/expressjs/pages/phase-8-validation-authz/03-coercion-traps.md`
- **Read this:** [Defining schemas → Coercion](https://zod.dev/api) · zod.dev · coercion is plain `Boolean(input)` and `Number(input)`; `z.stringbool()` parses "true", "1", "yes", "on" style strings (*read*) · covers our angle: **partial** — does not say what `Boolean("false")` gives, and has nothing on repeated query keys or arrays · fetched 2026-10-12
- **Also good:** [Moving to Express 5](https://expressjs.com/en/guide/migrating-5/) · expressjs.com · default query parser is now `simple` (was `extended`), `req.query` is a getter (*read*) · fetched 2026-10-12
- **Our delta:** `z.coerce.boolean()` turning the string "false" into `true` (follows from `Boolean(input)`, not stated by the page), empty string to `0`, repeated keys giving arrays; query values arrive as strings or arrays only.

### T08-05 · Type inference from schemas — Know · ✅ written `docs/expressjs/pages/phase-8-validation-authz/09-type-inference.md`
- **Read this:** [Zod basics](https://zod.dev/basics) · zod.dev · `z.infer`, plus `z.input` and `z.output` when a `.transform()` makes them differ (*read*) · covers our angle: **partial** — nothing on typing Express handlers · fetched 2026-10-12
- **Also good:** [Using Zod with Express](https://stevekinney.com/courses/full-stack-typescript/using-zod-with-express) · Steve Kinney · notes that Zod 4 changed the `ZodType` generics (*read*) · fetched 2026-10-12
- **Our delta:** getting the inferred type onto `req` without `any` (declaration merging, as the Express writing-middleware page shows for `requestTime`).

### T08-06 · Authentication middleware — Master · ✅ written `docs/expressjs/pages/phase-8-validation-authz/04-authn-middleware/README.md`
- **Read this:** [express-jwt README (raw)](https://raw.githubusercontent.com/auth0/express-jwt/master/README.md) · github (raw) · Bearer parsing, invalid token throws, a handler maps `UnauthorizedError` to 401; decoded payload lands on `req.auth` (v6 used `req.user`) (*read*) · covers our angle: **partial** — JWT only, no session branch, and Express 5 support is **not confirmed** by the README · fetched 2026-10-12
- **Also good:** [Writing middleware](https://expressjs.com/en/guide/writing-middleware/) · expressjs.com · attaching a property to `req` and calling `next()`; async middleware errors reach the error handler in Express 5 (*read*) · fetched 2026-10-12
- **Our delta:** our own `req.user` shape, one question only (who are you), 401 with no body leaks, and no crypto re-teach (Node Phase 8).

### T08-07 · Session store vs JWT header wire-up — Understand · ✅ written `docs/expressjs/pages/phase-8-validation-authz/05-cookies-sessions-wireup.md`
- **Read this:** [express-session](https://expressjs.com/en/resources/middleware/session/) · expressjs.com · cookie options, `trust proxy` needed for `secure: true`, `saveUninitialized: false` for login sessions, default MemoryStore not for production, `regenerate()` after login (*read*) · covers our angle: **partial** — session side only · fetched 2026-10-12
- **Also good:** [JSON Web Token Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html) · OWASP · stateless sessions need an invalidation plan; a denylist undercuts statelessness, so consider server sessions (*read*) · fetched 2026-10-12
- **Our delta:** the Express-layer choice table (cookie plus store vs `Authorization` header); the trade-offs themselves live on the Node page.

### T08-08 · Cookie flags on the auth path — Understand · ✅ written `docs/expressjs/pages/phase-8-validation-authz/05-cookies-sessions-wireup.md`
- **Read this:** [Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) · MDN · `HttpOnly`, `Secure`, `SameSite` Strict/Lax/None, `Path`, `Domain`, `Max-Age`, the `__Host-` prefix (*read*) · covers our angle: **partial** — no refresh-cookie guidance · fetched 2026-10-12
- **Also good:** [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) · OWASP · cookie attribute section; leave `Domain` unset, narrow `Path`, `SameSite=Strict` preferred; renew the id after a privilege change (*read*) · fetched 2026-10-12
- **Our delta:** refresh-cookie pattern (path-scoped, rotated): no page found that states it, so our page owns the argument and must not cite one for it.

### T08-09 · RBAC middleware (403 vs 401) — Master · ✅ written `docs/expressjs/pages/phase-8-validation-authz/06-rbac-middleware/README.md`
- **Read this:** [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) · OWASP · least privilege, deny by default, check on every request, prefer attribute or relationship based control over plain RBAC, test authorization (*headings only*) · covers our angle: **partial** — framework-neutral, no middleware shape · fetched 2026-10-12
- **Also good:** [REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) · OWASP · 401 is missing or bad credentials; 403 is authenticated but lacking permission (*read*) · fetched 2026-10-12
- **Our delta:** `requireRole` and `requirePermission` factories, deny by default, and why the page says "permissions, not roles".

### T08-10 · Resource ownership checks — Master · ✅ written `docs/expressjs/pages/phase-8-validation-authz/07-ownership/README.md`
- **Read this:** [IDOR Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) · OWASP · scope the lookup by owner (`findByIdAndOwnerId` style) or verify ownership after fetching (*read* the mitigation example) · covers our angle: **partial** — Java and Spring examples only · fetched 2026-10-12
- **Also good:** [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) · OWASP · "ensure lookup IDs are not accessible even when guessed" (*headings only*) · fetched 2026-10-12
- **Our delta:** Express version of "scope the query"; 403 vs 404 for another user's row is **not confirmed** by any page read (the REST sheet defines 404 only as non-existent resource).

### T08-11 · Multi-tenant scoping — Understand · ✅ written `docs/expressjs/pages/phase-8-validation-authz/08-tenant-and-logout.md`
- **Read this:** [Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) · OWASP · section 1 says to treat client-supplied tenant ids as selectors only; good example reads the id from verified token claims, bad one from an `X-Tenant-ID` header (*read* section 1) · covers our angle: **partial** — the rest (RLS, caches, storage) is outside our row · fetched 2026-10-12
- **Our delta:** `tenantId` comes from `req.user`, is merged into every query and into create payloads, and a body `tenantId` is stripped by the schema.

### T08-12 · Logout and revocation surface — Know · ✅ written `docs/expressjs/pages/phase-8-validation-authz/08-tenant-and-logout.md`
- **Read this:** [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) · OWASP · logout must invalidate the session on the server; clearing the cookie alone is not enough; idle and absolute timeouts (*read*) · covers our angle: **partial** — session cookies only, not JWT denylist endpoints · fetched 2026-10-12
- **Also good:** [express-session](https://expressjs.com/en/resources/middleware/session/) · expressjs.com · `req.session.destroy()` ends the session (*read*) · [JSON Web Token Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html) · OWASP · denylist keyed on `jti` and `iss`, Token Status Lists; the page describes no logout flow (*read*) · fetched 2026-10-12
- **Our delta:** the Express surface only (clear cookie, call the denylist endpoint); storage mechanism stays on the Node and Redis pages.

### T08-13 · Optional auth middleware — Know · ✅ written `docs/expressjs/pages/phase-8-validation-authz/08-tenant-and-logout.md`
- **Read this:** [express-jwt README (raw)](https://raw.githubusercontent.com/auth0/express-jwt/master/README.md) · github (raw) · `credentialsRequired: false` continues when no token is present, with an example (*read*) · covers our angle: **partial** — a bad token still throws, and the README does not discuss "enrich only" semantics · fetched 2026-10-12
- **Our delta:** fail-safe shape: no token means anonymous, a present but invalid token is still 401, never silently anonymous.

---

## Phase 9 — Hardening middleware

### T09-01 · `trust proxy` — Master · ✅ written `docs/expressjs/pages/phase-9-hardening/01-trust-proxy/README.md`
- **Read this:** [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/) · expressjs.com · values (`true`, hop count, subnets, function); effect on `req.ip`, `req.protocol`, `req.hostname`; spoofing warning for `true` and for hop counts with uneven paths (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Troubleshooting proxy issues](https://express-rate-limit.mintlify.app/guides/troubleshooting-proxy-issues) · express-rate-limit docs · a `/ip` test route and raise the number until it matches your public IP; wrong value makes the limiter global (*read*) · [express-session](https://expressjs.com/en/resources/middleware/session/) · expressjs.com · `secure: true` behind a proxy needs `trust proxy` (*read*) · fetched 2026-10-12
- **Our delta:** diagnosing a missing setting from wrong IPs in logs; never `true` when the proxy does not overwrite `X-Forwarded-For`.

### T09-02 · CORS in Express — Understand · ✅ written `docs/expressjs/pages/phase-9-hardening/02-cors.md`
- **Read this:** [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · MDN · what triggers a preflight, `Authorization` header preflights, no `*` with credentials, `Vary: Origin`, `Access-Control-Max-Age` (*read*) · covers our angle: **partial** — browser side; nothing on the `cors` package · fetched 2026-10-12
- **Also good:** [cors middleware](https://expressjs.com/en/resources/middleware/cors/) · expressjs.com · string, array, RegExp and function origins, `credentials`, `preflightContinue`; it carries no warning about reflecting arbitrary origins (*read*) · fetched 2026-10-12
- **Our delta:** allowlist exact origins (anchor any RegExp), `credentials: true` with a fixed or allowlisted origin, mount before auth so preflight never needs a token.

### T09-03 · Helmet as mounted middleware — Understand · ✅ written `docs/expressjs/pages/phase-9-hardening/03-helmet.md`
- **Read this:** [Helmet](https://helmet.js.org/) · helmet.js.org · default header list, CSP `directives`, `reportOnly`, per-request nonces via functions, disabling a header; COEP is not set by default (*read*) · covers our angle: **partial** — no separate advice for APIs vs HTML pages · fetched 2026-10-12
- **Also good:** [Security best practices](https://expressjs.com/en/advanced/best-practice-security/) · expressjs.com · "Use Helmet", reduce fingerprinting (`x-powered-by`), secure cookies; v5.x docs, undated (*read*) · fetched 2026-10-12
- **Our delta:** an API-only app can keep defaults but turn CSP concerns off for JSON; CSP trade-offs for pages.

### T09-04 · Rate limiting at the app layer — Understand · ✅ written `docs/expressjs/pages/phase-9-hardening/04-rate-limiting.md`
- **Read this:** [express-rate-limit configuration](https://express-rate-limit.mintlify.app/reference/configuration) · express-rate-limit docs · `windowMs`, `limit`, `keyGenerator` (default client IP, `ipv6Subnet` applied), `skip`, `standardHeaders`, `handler`, `store` (*read*) · covers our angle: **partial** — config only; proxy keys are on the troubleshooting page · fetched 2026-10-12
- **Also good:** [Troubleshooting proxy issues](https://express-rate-limit.mintlify.app/guides/troubleshooting-proxy-issues) · express-rate-limit docs · without `trust proxy` every client shares the proxy IP; IP:PORT lists can reset limits (*read*) · [Security best practices](https://expressjs.com/en/advanced/best-practice-security/) · expressjs.com · brute-force section points to `rate-limiter-flexible` (*read*) · fetched 2026-10-12
- **Our delta:** key by user when authenticated, skip health routes, external store beyond one process (the overview page warns MemoryStore is inconsistent across processes).

### T09-05 · CSRF — when needed, `csurf` archived — Understand · ✅ written `docs/expressjs/pages/phase-9-hardening/05-csrf-and-injection.md`
- **Read this:** [CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) · OWASP · tokens still essential for cookie-authenticated apps; signed double-submit recommended; custom headers for APIs; `SameSite` is defence in depth, not a replacement (*read*) · covers our angle: **partial** — Bearer-token APIs are not discussed · fetched 2026-10-12
- **Also good:** [csurf README (raw)](https://raw.githubusercontent.com/expressjs/csurf/master/README.md) · github (raw) · the repository is archived and "no longer actively maintained"; names no replacement (*read*) · fetched 2026-10-12
- **Our delta:** 🔴 do not teach `csurf`. OWASP says `SameSite` does not replace a CSRF defence in most deployments, while Session Management lists it as defence in depth; our page must keep that nuance.

### T09-06 · Injection surfaces: open redirect, header injection — Understand · ✅ written `docs/expressjs/pages/phase-9-hardening/05-csrf-and-injection.md`
- **Read this:** [Unvalidated Redirects and Forwards Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) · OWASP · avoid user-supplied destinations, map ids server-side, allowlist approved destinations, reject userinfo, intermediate page (*read*) · covers our angle: **partial** — no Express code; nothing on header injection · fetched 2026-10-12
- **Also good:** [Express 5.x API: Response](https://expressjs.com/en/5x/api/response/) · expressjs.com · `res.location()` passes the URL "without any validation"; the `res.redirect()` entry gives no warning (*read*) · fetched 2026-10-12
- **Our delta:** header (CRLF) injection: the Express response docs do not mention it, so any claim about Node rejecting CR/LF in header values is **not confirmed** here; verify before the page states it.

### T09-07 · Security headers beyond defaults — COOP/COEP — Know · ✅ written `docs/expressjs/pages/phase-9-hardening/03-helmet.md`
- **Read this:** [Making your website cross-origin isolated using COOP and COEP](https://web.dev/articles/coop-coep) · web.dev · what each header does; needed for cross-origin isolation, `SharedArrayBuffer`; published 2020-04-13, updated 2022-06-21 (*read*) · covers our angle: **partial** — dated, browser-feature focused, no Express or API-only advice · fetched 2026-10-12
- **Also good:** [Helmet](https://helmet.js.org/) · helmet.js.org · defaults `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin`; COEP off by default (*read*) · fetched 2026-10-12
- **Our delta:** an API serving JSON gains little from COEP; the "which headers to skip for API-only apps" argument is ours.

### T09-08 · Request timeout middleware — Know · ✅ written `docs/expressjs/pages/phase-9-hardening/06-timeouts-and-secrets.md`
- **Read this:** [connect-timeout](https://expressjs.com/en/resources/middleware/timeout/) · expressjs.com · emits a timeout (503) but "node will continue processing" the request; `haltOnTimedout` guard; not recommended as top-level middleware without precautions; Express 5 compatibility is **not confirmed** on the page (*read*) · covers our angle: full for the soft deadline · fetched 2026-10-12
- **Also good:** [Node.js HTTP API](https://nodejs.org/api/http.html) · nodejs.org · lists `server.requestTimeout`, `server.headersTimeout`, `server.setTimeout()`, `server.timeout` (*headings only*; defaults **not confirmed** from the page) · fetched 2026-10-12
- **Our delta:** a soft deadline does not cancel work; pair with cancellation. Deep budgets stay on Node Phase 7.

### T09-09 · Secrets and config at the edge — Know · ✅ written `docs/expressjs/pages/phase-9-hardening/06-timeouts-and-secrets.md`
- **Read this:** [The Twelve-Factor App: Config](https://12factor.net/config) · 12factor.net · config in environment variables, strict separation from code, the "could we open-source it now" test (*read*) · covers our angle: **partial** — says nothing about failing boot on missing variables · fetched 2026-10-12
- **Also good:** [Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) · OWASP · lifecycle, rotation, CI/CD, cloud sections (*headings only*) · fetched 2026-10-12
- **Our delta:** fail boot when a required variable is missing (a schema over `process.env`); no page found that teaches it for Express.

---

## Phase 10 — Testable app and ops boundary

### T10-01 · App factory `createApp(deps)` — Master · ✅ written `docs/expressjs/pages/phase-10-app-factory/01-create-app/README.md`
- **Read this:** none found — tried: web searches "express createApp factory testing supertest dependency injection" and the Express guides I read (none covers it); results were issue trackers and tutorials with no explanation worth citing (*Not opened:* a project issue titled "Export createApp()")
- *Checked, not chosen:* [AVA endpoint testing recipe (raw)](https://raw.githubusercontent.com/avajs/ava/main/docs/recipes/endpoint-testing.md) · imports a ready-made `app`, shows no factory or injection; advises a fresh server per test file (*read*)
- **Our delta:** the whole topic is ours: pure function, no `listen`, injected clients, fresh instance per test.

### T10-02 · Request-id / correlation middleware — Understand · ✅ written `docs/expressjs/pages/phase-10-app-factory/02-request-id.md`
- **Read this:** [Keep Express Correlation IDs with AsyncLocalStorage](https://oneuptime.com/blog/post/2026-09-11-express-async-local-storage-correlation/view) · oneuptime · 2026-09-11 · `randomUUID()`, `run(store, next)`, a logger reading `getStore()`, written for `express@5` (*read*) · covers our angle: **partial** — it always generates an id and never reads an inbound `X-Request-Id`; the header it sets is `X-Correlation-ID` · fetched 2026-10-12
- **Also good:** [Asynchronous context tracking](https://nodejs.org/api/async_context.html) · nodejs.org · `AsyncLocalStorage` marked Stable; HTTP server example gives each request an id via `run()` and `getStore()` (*read*) · fetched 2026-10-12
- **Our delta:** accept-or-generate with validation of the inbound value, echo on the response, and set it on `req`.

### T10-03 · Integration testing with Supertest — Understand · ✅ written `docs/expressjs/pages/phase-10-app-factory/03-supertest.md`
- **Read this:** [supertest README (raw)](https://raw.githubusercontent.com/ladjs/supertest/master/README.md) · github (raw) · pass an Express app and it binds a free port; `.expect()` on status, body, headers; async/await; no test framework needed (*read*) · covers our angle: full for the client side · fetched 2026-10-12
- **Our delta:** the `createApp({ ...mocks })` happy path plus a 403 path, with no real database.

### T10-04 · Authenticating inside tests — Understand · ✅ written `docs/expressjs/pages/phase-10-app-factory/04-auth-in-tests.md`
- **Read this:** [supertest README (raw)](https://raw.githubusercontent.com/ladjs/supertest/master/README.md) · github (raw) · `request.agent(app)` persists cookies; set an `Authorization` header with `.set()` (*read*) · covers our angle: **partial** — nothing on minting tokens or sessions in a test helper · fetched 2026-10-12
- **Our delta:** a helper that mints a session or JWT through our own signing function, never copying production crypto pages.

### T10-05 · Mocking external services at the router boundary — Understand · ✅ written `docs/expressjs/pages/phase-10-app-factory/03-supertest.md`
- **Read this:** [How to Mock External APIs in Node.js Tests](https://oneuptime.com/blog/post/2026-01-06-nodejs-mock-external-apis-tests/view) · oneuptime · 2026-01-06 · sections on Nock, MSW, webhooks, and a "Dependency Injection Pattern" with a mock service object (*read* headings and summary) · covers our angle: **partial** — it does not show an Express factory, and supertest is not named · fetched 2026-10-12
- **Our delta:** inject fakes through `createApp`; use HTTP-level mocks only for what a handler calls outbound; never mock Express itself.

### T10-06 · Health vs readiness endpoints — Understand · ✅ written `docs/expressjs/pages/phase-10-app-factory/05-health-and-boot.md`
- **Read this:** [Liveness, readiness and startup probes](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/) · kubernetes.io · liveness restarts, readiness gates traffic; liveness should signal only unrecoverable failure; back-end availability belongs in readiness (*read*; the last 18k characters were not read) · covers our angle: **partial** — Kubernetes terms, no Express code · fetched 2026-10-12
- **Also good:** [Health checks and graceful shutdown](https://expressjs.com/en/advanced/healthcheck-graceful-shutdown/) · expressjs.com · liveness vs readiness in two sentences, with the SIGTERM example (*read*) · fetched 2026-10-12
- **Our delta:** cheap liveness route, readiness that pings the injected pool and redis, and skipping both in rate limiting.

### T10-07 · Boot order with Express — Understand · ✅ written `docs/expressjs/pages/phase-10-app-factory/05-health-and-boot.md`
- **Read this:** [Structuring Node.js apps](https://marius.me.uk/blog/2017/12/structuring-nodejs-apps/) · marius.me.uk · 2017-12-30 · calling `app.listen()` before the database connection exists lets requests arrive early; start listening inside the connect handler (*read* the start-up section) · covers our angle: **partial** — Mongoose-only, 2017, no env validation or readiness · fetched 2026-10-12
- **Our delta:** validate env, connect deps, `createApp`, `listen`, then report ready; no official page found. 🔴 The source is old; treat it as an illustration, not as authority.

### T10-08 · Graceful HTTP shutdown hang-off — Understand · ✅ written `docs/expressjs/pages/phase-10-app-factory/06-shutdown-and-entrypoint.md`
- **Read this:** [Health checks and graceful shutdown](https://expressjs.com/en/advanced/healthcheck-graceful-shutdown/) · expressjs.com · on SIGTERM stop accepting requests, finish in-flight ones, clean up, then exit; `server.close()` example (*read*) · covers our angle: **partial** — no keep-alive handling or timeout fallback · fetched 2026-10-12
- **Also good:** [Node.js HTTP: server.close](https://nodejs.org/api/http.html#serverclosecallback) · nodejs.org · `close()` stops new connections; since 19.0.0 it also closes idle connections; `closeAllConnections()` is forceful (*read*) · fetched 2026-10-12
- **Our delta:** drain order, a hard deadline, and workers and pools staying on Node's pages.

### T10-09 · Separate `server.js` / `app.js` — Know · ✅ written `docs/expressjs/pages/phase-10-app-factory/06-shutdown-and-entrypoint.md`
- **Read this:** [supertest README (raw)](https://raw.githubusercontent.com/ladjs/supertest/master/README.md) · github (raw) · if the server is not listening it is bound to an ephemeral port, which is why tests need no `listen` (*read*) · covers our angle: **partial** — states the effect, never argues the file split · fetched 2026-10-12
- **Also good:** [AVA endpoint testing recipe (raw)](https://raw.githubusercontent.com/avajs/ava/main/docs/recipes/endpoint-testing.md) · github (raw) · example imports `app` from `./app.js` and wraps it in a server (*read*) · fetched 2026-10-12
- **Our delta:** the entrypoint is the only file that calls `listen`.

### T10-10 · Feature flags or route toggles at mount time — When Needed · ✅ written `docs/expressjs/pages/phase-10-app-factory/07-flags-and-serverless.md`
- **Read this:** [Feature Toggles (aka Feature Flags)](https://martinfowler.com/articles/feature-toggles.html) · martinfowler.com · 2017-10-09 · toggle categories; static routing fixed per deployment vs per-request routing (*read*) · covers our angle: **partial** — no Express code · fetched 2026-10-12
- **Our delta:** mount-time toggle means a static decision per process (inside `createApp`); per-request flags are a different design.

### T10-11 · Exporting the app for serverless adapters — When Needed · ✅ written `docs/expressjs/pages/phase-10-app-factory/07-flags-and-serverless.md`
- **Read this:** [serverless-http README (raw)](https://raw.githubusercontent.com/dougmoscrop/serverless-http/master/README.md) · github (raw) · wrap the app with `serverless(app)` and export a handler; Express listed as supported (*read*) · covers our angle: **partial** — Express 5 support is **not confirmed** by the README · fetched 2026-10-12
- **Our delta:** export `createApp()` output, never listen at import time; check Express 5 compatibility before promising it.
