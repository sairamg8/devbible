---
title: "Link map · Node.js · Part 3b (phases 8–9)"
sidebar_label: "03b · Node.js · Security, Testing (8–9)"
sidebar_position: 4
---

# Link map · Node.js · Part 3b — Security and Testing (phases 8–9)

Covers every topic row of phases 8 and 9 in `docs/nodejs/syllabus/03-application.md`: T08-01 to T08-28 (Security) and T09-01 to T09-20 (Testing, incl. contract testing). **All 48 rows have a page of ours (✅).**
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** nodejs.org/api served **v26.11.1** on 2026-10-12. OWASP, MDN, Node and vendor docs show no page date, so only the fetch date is given. `github.com` and `npmjs.com` return 403 to our fetcher, so READMEs are cited as `raw.githubusercontent.com` copies.

---

## Phase 8 — Security

### T08-01 · Password storage — Master · ✅ written `docs/nodejs/pages/phase-8-security/01-password-storage.md`
- **Read this:** [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) · OWASP · Argon2id first (min 19 MiB, 2 iterations), then scrypt, bcrypt with a 72-byte limit; why fast hashes like MD5 and SHA-1 fail (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [node-argon2 README (raw)](https://raw.githubusercontent.com/ranisalt/node-argon2/master/README.md) · github (raw) · the Node binding (size checked only, *headings only*) · fetched 2026-10-12
- **Our delta:** which of the three ships in Node core versus needs a native addon; the numbers above are OWASP's minimums, not ours.

### T08-02 · Sessions vs. JWT — Master · ✅ `…/02-sessions-vs-jwt.md`
- **Read this:** [Stop using JWT for sessions](http://cryto.net/~joepie91/blog/2016/06/13/stop-using-jwt-for-sessions/) · joepie91, 13 Jun 2016 · the revocation argument: a revoked admin keeps a valid token until it expires (*read*) · covers our angle: **partial** — one-sided, and the author's own update says suggested fixes were impractical · fetched 2026-10-12
- **Also good:** [Token Best Practices](https://auth0.com/docs/secure/tokens/token-best-practices) · Auth0 docs · sections on tokens vs cookies, refresh-token usage and limits, JWT validation (*headings only*) · [RFC 8725: JWT Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.html) · IETF · threat list (weak signatures, weak keys) (*headings only*) · fetched 2026-10-12
- **Our delta:** the balanced table (revocation, expiry, storage, refresh); no single page gives it. A 2016 post must not be cited as current fact.

### T08-03 · Where to store tokens — Master · ✅ `…/03-token-storage.md`
- **Read this:** [HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html) · OWASP · "Do not store session identifiers in local storage"; `HttpOnly` cookies mitigate that (*read*) · covers our angle: **partial** — nothing on the CSRF side of the trade · fetched 2026-10-12
- **Also good:** [Token Storage](https://auth0.com/docs/secure/security-guidance/data-security/token-storage) · Auth0 docs · browser in-memory vs local-storage scenarios (*headings only*) · [OAuth 2.0 for Browser-Based Applications](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps) · IETF draft-27 · threat of malicious JavaScript, architecture patterns (*headings only*; a draft, not final) · fetched 2026-10-12
- **Our delta:** the XSS-versus-CSRF trade-off table; link to the CSRF page.

### T08-04 · Authorization vs. authentication — Master · ✅ `…/04-authentication-vs-authorization.md`
- **Read this:** [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) · OWASP · least privilege, deny by default, validate permissions on every request, lookup IDs (*read* the headings) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Access control vulnerabilities](https://portswigger.net/web-security/access-control) · PortSwigger · vertical vs horizontal, IDOR (*headings only*) · fetched 2026-10-12

### T08-05 · Session management — Understand · ✅ `…/05-session-management.md`
- **Read this:** [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) · OWASP · renew the ID after a privilege change, idle and absolute timeouts, logout (*read* the headings, ≈9k words) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the Node cookie-session code; the cheat sheet is language-neutral.

### T08-06 · OAuth 2.0 / OIDC flows — Know · ✅ `…/06-oauth-oidc.md`
- **Read this:** [Authorization Code Flow with PKCE](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce) · Auth0 docs · `code_verifier`, `code_challenge`, then ID token and access token (*read*) · covers our angle: **partial** — vendor-flavoured, SDK does the work · fetched 2026-10-12
- **Also good:** [OAuth2 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html) · OWASP · implicit grant marked deprecated; `state` as CSRF protection (*read*) · [How OpenID Connect Works](https://openid.net/developers/how-connect-works/) · OpenID Foundation, published 2023-02-14, modified 2023-07-20 per page metadata · OIDC is built on OAuth 2.0 (*read*) · fetched 2026-10-12
- **Checked, not chosen:** [RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700) (≈18k words, *headings only*, reference not tutorial); [oauth.net/2](https://oauth.net/2/) (link hub).
- **Our delta:** a hand-written flow in Node without a vendor SDK.

### T08-07 · MFA and TOTP — When Needed · ✅ `…/07-mfa-totp.md`
- **Read this:** [Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html) · OWASP · TOTP as the common soft token, when to require MFA, reset procedure (*read*) · covers our angle: **partial** — policy, not code · fetched 2026-10-12
- **Also good:** [RFC 6238: TOTP](https://www.rfc-editor.org/rfc/rfc6238.html) · IETF, May 2011 · the algorithm, extending HOTP with time (*read* the abstract) · fetched 2026-10-12

### T08-08 · Injection: SQL, NoSQL, command — Master · ✅ `…/08-injection.md`
- **Read this:** [Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html) · OWASP · rule 1 validate input, rule 2 use a safe API, rule 3 escape in context (*read* the headings) · covers our angle: **partial** — general, no Mongo operator example · fetched 2026-10-12
- **Also good:** [NoSQL injection](https://portswigger.net/web-security/nosql-injection) · PortSwigger · `$where`, `$ne`, `$regex` operators, a prevention section (*read*) · [OS command injection](https://portswigger.net/web-security/os-command-injection) · PortSwigger · (*headings only*) · fetched 2026-10-12
- **Our delta:** `child_process.exec` vs `execFile`; SQL specifics sit in OWASP's SQL Injection Prevention sheet (*headings only*).

### T08-09 · XSS and output encoding — Master · ✅ `…/09-xss.md`
- **Read this:** [Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) · OWASP · encode per context (HTML, attribute, JS, CSS, URL); for JSON check `Content-Type` is `application/json`, not `text/html` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Content Security Policy guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) · MDN · strict CSP, Trusted Types (*headings only*) · fetched 2026-10-12

### T08-10 · Path traversal — Master · ✅ `…/10-path-traversal.md`
- **Read this:** [Path Traversal](https://community.owasp.org/attacks/Path_Traversal) · OWASP · the attack, request variations, avoidance; advice to normalize input before file I/O (*read*) · covers our angle: **partial** — no Node `path.resolve` plus prefix check · fetched 2026-10-12
- **Our delta:** the resolve-then-check-prefix pattern and symlinks.
- *Not opened:* [PortSwigger file path traversal](https://portswigger.net/web-security/file-path-traversal) (returned 200 only).

### T08-11 · CSRF — Understand · ✅ `…/11-csrf.md`
- **Read this:** [CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) · OWASP · tokens, Fetch Metadata, SameSite and a section on when SameSite may be enough on its own (*read* the headings, ≈8.9k words) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Cross-site request forgery](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF) · MDN · shorter; tokens, fetch metadata, SameSite as defense in depth (*read*) · fetched 2026-10-12

### T08-12 · SSRF — Understand · ✅ `…/12-ssrf.md`
- **Read this:** [SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) · OWASP · case 1 (allowlist possible) vs case 2 (any destination); IMDSv2; deny-list as last resort (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [What is SSRF?](https://portswigger.net/web-security/ssrf) · PortSwigger · filter bypasses, blind SSRF (*headings only*) · fetched 2026-10-12

### T08-13 · Prototype pollution — Understand · ✅ `…/13-prototype-pollution.md`
- **Read this:** [Prototype Pollution Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html) · OWASP · use `Map`/`Set`, `Object.create(null)`, freeze/seal, `--disable-proto=delete` (flagged as defense in depth) (*read*) · covers our angle: full, short (≈860 words) · fetched 2026-10-12
- **Also good:** [Prototype pollution](https://portswigger.net/web-security/prototype-pollution) · PortSwigger · sources, sinks, gadgets (*headings only*) · fetched 2026-10-12

### T08-14 · ReDoS — Understand · ✅ `…/14-redos.md`
- **Read this:** [Don't Block the Event Loop](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) · nodejs.org · the REDOS section; names `safe-regex` and notes it will not catch every case; suggests `node-re2` (*read*) · covers our angle: full for Node · fetched 2026-10-12
- **Also good:** [Regular expression Denial of Service](https://community.owasp.org/attacks/Regular_expression_Denial_of_Service_-_ReDoS) · OWASP · evil regex, examples (*headings only*) · fetched 2026-10-12

### T08-15 · Deserialization, open redirects, mass assignment — Know · ✅ `…/15-deserialization-redirects-mass-assignment.md`
- **Read this (1/3):** [Deserialization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html) · OWASP · alternative formats, only deserialize signed data (*read* the headings) · covers our angle: **partial** — examples are PHP, Python, Java, .NET, none for Node · fetched 2026-10-12
- **Read this (2/3):** [Unvalidated Redirects and Forwards](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) · OWASP · safe vs dangerous redirects, validating URLs (*read* the headings) · fetched 2026-10-12
- **Read this (3/3):** [Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html) · OWASP · has a NodeJS + Mongoose section with allow-listing and block-listing (*headings only*) · fetched 2026-10-12
- **Our delta:** the JS angle (`JSON.parse` is safe, `eval`/`vm` is not; `Object.assign` from `req.body`) is ours.

### T08-16 · Timing attacks — Know · ✅ `…/16-timing-attacks.md`
- **Read this:** [Security Best Practices](https://nodejs.org/learn/getting-started/security-best-practices) · nodejs.org · CWE-208 section: use `timingSafeEqual` for sensitive comparisons, scrypt for passwords (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Crypto: timingSafeEqual](https://nodejs.org/api/crypto.html) · nodejs.org · the API entry `crypto.timingSafeEqual(a, b)` in a ≈38k-word reference (*headings only*) · fetched 2026-10-12
- **Our delta:** equal-length requirement and hashing both sides first; not confirmed on the pages above.

### T08-17 · Input validation at the boundary — Master · ✅ `…/17-input-validation.md`
- **Read this:** [Zod: Basic usage](https://zod.dev/basics) · zod.dev · schema, `.parse` returns a typed deep clone, `.safeParse` avoids try/catch (*read*) · covers our angle: **partial** — the "parse, don't validate" argument is not stated · fetched 2026-10-12
- **Also good:** [Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) · OWASP · allowlist vs denylist, "Parse Safely, Then Validate" (*read* the headings) · [Valibot: Introduction](https://valibot.dev/guides/introduction/) · valibot.dev · (*headings only*) · fetched 2026-10-12

### T08-18 · Secrets handling — Master · ✅ `…/18-secrets.md`
- **Read this (1/2):** [Command-line options](https://nodejs.org/api/cli.html) · nodejs.org · lists `--env-file` and `--env-file-if-exists` (*headings only*, huge reference) · covers our angle: **partial** · fetched 2026-10-12
- **Read this (2/2):** [Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) · OWASP · lifecycle, rotation, auditing; container env-var warning (*read*, ≈10k words) · fetched 2026-10-12
- **Our delta:** `.env` never in git and what `--env-file` does not do; neither page is a Node walkthrough.

### T08-19 · HTTPS, HSTS, cookie flags — Master · ✅ `…/19-https-hsts-cookies.md`
- **Read this (1/2):** [Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security) · MDN · `max-age`, `includeSubDomains`, `preload` (*read*) · covers our angle: full for HSTS · fetched 2026-10-12
- **Read this (2/2):** [Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies) · MDN · `HttpOnly`, `SameSite`, `__Host-` prefix rules (*read*) · fetched 2026-10-12
- **Also good:** [Transport Layer Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html) · OWASP · protocols, ciphers, certificates (*headings only*) · fetched 2026-10-12

### T08-20 · `node:crypto` — Understand · ✅ `…/20-node-crypto.md`
- **Read this:** [Crypto](https://nodejs.org/api/crypto.html) · nodejs.org · the class reference (≈38k words): Hash, Hmac, KeyObject, `timingSafeEqual` (*headings only*) · covers our angle: **partial** — reference, no guidance on what to use · fetched 2026-10-12
- **Our delta:** the short list (hash, HMAC, `randomBytes`, `randomUUID`, `timingSafeEqual`) and what not to use; look up, do not read through.

### T08-21 · Rate limiting and brute-force protection — Understand · ✅ `…/21-rate-limiting.md`
- **Read this:** [rate-limiter-flexible README (raw)](https://raw.githubusercontent.com/animir/node-rate-limiter-flexible/master/README.md) · github (raw) · protects from DoS and brute force; backends include Redis, Mongo, Postgres, memory, cluster (*read*) · covers our angle: **partial** — a library README, not the concepts · fetched 2026-10-12
- **Also good:** [express-rate-limit README (raw)](https://raw.githubusercontent.com/express-rate-limit/express-rate-limit/main/readme.md) · github (raw) · middleware, built-in memory store plus external stores (*read*) · fetched 2026-10-12
- **Our delta:** per-account vs per-IP keys and lockout trade-offs; I did not find a page that states them. OWASP's Denial of Service sheet has a rate-limiting section (*headings only*).

### T08-22 · Security headers (`helmet`) — Understand · ✅ `…/22-security-headers.md`
- **Read this:** [HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html) · OWASP · `X-Content-Type-Options: nosniff`, frame options, Referrer-Policy, HSTS, CSP (*read*) · covers our angle: full for the headers · fetched 2026-10-12
- **Also good:** [Helmet.js](https://helmet.js.org/) · helmet.js.org · `app.use(helmet())` sets a default set of headers (*read*) · [CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html) · OWASP · strict, nonce-based CSP (*headings only*) · fetched 2026-10-12

### T08-23 · Supply chain — Understand · ✅ `…/23-supply-chain.md`
- **Read this (1/2):** [Auditing package dependencies](https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities/) · npm docs · running and acting on `npm audit` (*headings only*) · covers our angle: **partial** · fetched 2026-10-12
- **Read this (2/2):** [Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements/) · npm docs · Sigstore, publishing with provenance from GitHub Actions or GitLab, verifying (*headings only*) · fetched 2026-10-12
- **Also good:** [Security Best Practices](https://nodejs.org/learn/getting-started/security-best-practices) · nodejs.org · "Malicious Third-Party Modules" threat (*headings only*) · [Dependency Graph SBOM Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Dependency_Graph_SBOM_Cheat_Sheet.html) · OWASP · (*headings only*) · fetched 2026-10-12
- **Our delta:** install scripts, lockfile discipline and typosquatting are not confirmed on these pages. *Not opened:* a Snyk npm-security article that surfaced in search (secondary).

### T08-24 · Permission Model — Know · ✅ `…/24-permission-model.md`
- **Read this:** [Permissions](https://nodejs.org/api/permissions.html) · nodejs.org · `--allow-fs-read`, `--allow-fs-write`, `--allow-net`, `--allow-child-process`; added v20.0.0, stable since v23.5.0 and v22.13.0 (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the syllabus says `--allow-net` is granular and "added v25"; that is **not confirmed** on this page. The page also lists `--allow-worker`, `--allow-addons`, `--allow-wasi`, `--allow-ffi`.

### T08-25 · Web Crypto API — Know · ✅ `…/25-web-crypto.md`
- **Read this:** [Web Crypto API (Node)](https://nodejs.org/api/webcrypto.html) · nodejs.org · `Crypto`, `CryptoKey`, `SubtleCrypto`, algorithm support table (*headings only*, ≈9k words) · covers our angle: **partial** — reference · fetched 2026-10-12
- **Also good:** [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) · MDN · warns the primitives are easy to misuse; secure contexts only (*read*) · fetched 2026-10-12

### T08-26 · Encryption, signing, key management — Know · ✅ `…/26-encryption-and-keys.md`
- **Read this (1/2):** [Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) · OWASP · AES with at least 128-bit (ideally 256-bit) keys, secure modes, key rotation (*read*) · covers our angle: **partial** · fetched 2026-10-12
- **Read this (2/2):** [Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html) · OWASP · generation, storage, cryptoperiods and rotation, compromise recovery (*headings only*) · fetched 2026-10-12
- **Our delta:** the Node code (`createCipheriv`, `sign`/`verify`) is ours.

### T08-27 · Audit logging and tamper-evidence — When Needed · ✅ `…/27-audit-logging.md`
- **Read this:** [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) · OWASP · which events to log, attributes, data to exclude; protect logs from tampering (*read*) · covers our angle: **partial** — hash chaining or append-only designs are **not confirmed** on the page · fetched 2026-10-12

### T08-28 · bcrypt in depth — Understand · ✅ `…/28-bcrypt/` (two pages)
- **Read this:** [node.bcrypt.js README (raw)](https://raw.githubusercontent.com/kelektiv/node.bcrypt.js/master/README.md) · github (raw) · only the first 72 bytes are used, bytes not characters; async API marked recommended; prebuilt binaries list Linux musl (*read*) · covers our angle: **partial** — the Alpine failure is not confirmed · fetched 2026-10-12
- **Also good:** [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) · OWASP · legacy bcrypt: work factor 10 or more, 72-byte limit (*read*) · fetched 2026-10-12
- **Our delta:** cost factor stored inside the hash and the event-loop cost of the sync APIs; not stated in the text I read.

---

## Phase 9 — Testing

### T09-01 · `node:test` — Master · ✅ `docs/nodejs/pages/phase-9-testing/01-node-test-runner.md`
- **Read this:** [Test runner](https://nodejs.org/api/test.html) · nodejs.org · subtests, `describe`/`it`, skipping, watch mode, global setup, running from the CLI (*headings only*, long reference) · covers our angle: full · fetched 2026-10-12
- **Our delta:** page is a reference; our order (first test, hooks, CLI, watch) is the tutorial.

### T09-02 · `node:assert` strict — Master · ✅ `…/02-node-assert.md`
- **Read this:** [Assert](https://nodejs.org/api/assert.html) · nodejs.org · "Strict assertion mode", `deepStrictEqual`, `rejects`, `throws`, `partialDeepStrictEqual` (*headings only*) · covers our angle: full · fetched 2026-10-12

### T09-03 · Unit vs. integration vs. e2e — Master · ✅ `…/03-unit-integration-e2e.md`
- **Read this:** [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) · martinfowler.com, 26 Feb 2018 (Ham Vocke) · unit, integration, contract, UI and e2e layers; warns against the "ice-cream cone" (*read*, ≈12.7k words) · covers our angle: full; examples are JVM · fetched 2026-10-12
- **Also good:** [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details) · Kent C. Dodds, 17 Aug 2020 · false negatives and false positives from coupling to internals (*headings only*) · fetched 2026-10-12

### T09-04 · Writing testable code — Master · ✅ `…/04-testable-code.md`
- **Read this:** [Dependency Injection in Javascript and Testing](https://blog.kartones.net/post/dependency-injection-in-javascript-and-testing/) · Kartones Blog · the module-import style vs injected collaborators, with a Node `fs` example (*read*) · covers our angle: **partial** — date not shown; Jest-leaning · fetched 2026-10-12
- **Also good:** [Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html) · Fowler, 23 Jan 2004 · the canonical text (*headings only*) · fetched 2026-10-12
- **Our delta:** composition root plus `node:test` with plain fakes, no container.

### T09-05 · API testing — Master · ✅ `…/05-api-testing.md`
- **Read this:** [supertest README (raw)](https://raw.githubusercontent.com/ladjs/supertest/master/README.md) · github (raw) · binds the app to an ephemeral port if not listening; async/await examples (*read*) · covers our angle: **partial** — the `fetch` against a real server route is not shown · fetched 2026-10-12
- **Our delta:** `server.listen(0)` plus `fetch`; no page I opened shows it.

### T09-06 · Async testing — Master · ✅ `…/06-async-testing.md`
- **Read this:** [Test runner](https://nodejs.org/api/test.html) · nodejs.org · includes an "Extraneous asynchronous activity" section (*headings only*) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [Assert: rejects](https://nodejs.org/api/assert.html) · nodejs.org · `assert.rejects(asyncFn[, error][, message])` listed (*headings only*) · fetched 2026-10-12
- **Our delta:** the forgotten-`await` failure and the unhandled-rejection symptom.

### T09-07 · Mocking, timers, `mock.module()` — Understand · ✅ `…/07-mocking.md`, `…/08-module-mocking.md`
- **Read this:** [Test runner: Mocking](https://nodejs.org/api/test.html) · nodejs.org · `mock.fn`, `mock.method`, `mock.module(specifier)`, MockTimers, Dates (*headings only*) · covers our angle: full for the API · fetched 2026-10-12
- **Our delta:** the CLI reference lists `--experimental-test-module-mocks`, so module mocking is still behind a flag. The `mock.module(specifier[, options])` entry shows added v22.3.0, v20.18.0 and "Stability: 1.0 - Early development" (re-read by the verifier). Mock timers and `mock.fn` carry no such line in the text I read.
- *Checked, not chosen:* none found for ESM module mocking beyond the official page.

### T09-08 · Test doubles and over-mocking — Understand · ✅ `…/09-test-doubles.md`
- **Read this:** [Test Double](https://martinfowler.com/bliki/TestDouble.html) · Fowler · dummy, fake, stub, mock vocabulary after Meszaros (*read*, ≈350 words) · covers our angle: **partial** — "spy" does not appear on that page · fetched 2026-10-12
- **Also good:** [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html) · Fowler, 2 Jan 2007 · classical vs mockist testing (*headings only*) · [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details) · Kent C. Dodds, 17 Aug 2020 · over-coupling as a smell (*headings only*) · fetched 2026-10-12

### T09-09 · Fixtures, factories, test data — Understand · ✅ `…/10-fixtures-and-factories.md`
- **Read this:** [Don't use fixtures in Cypress and unit tests — use factories](https://dev.to/dgreene1/don-t-use-fixtures-in-cypress-and-unit-tests-use-factories-5cnh) · DEV Community, 18 Sep 2020 (Dan Greene) · the factory argument (*headings only* of the page text) · covers our angle: **partial** — Cypress and TypeScript flavoured · fetched 2026-10-12
- **Also good:** [Object Mother](https://martinfowler.com/bliki/ObjectMother.html) · Fowler · (*headings only*, ≈540 words) · fetched 2026-10-12

### T09-10 · Coverage — Understand · ✅ `…/11-coverage.md`
- **Read this (1/2):** [Test runner: Collecting code coverage](https://nodejs.org/api/test.html) · nodejs.org · the section and reporters (*headings only*); the section shows "Stability: 1 - Experimental", and `--experimental-test-coverage` is listed in the CLI reference · covers our angle: full for the how · fetched 2026-10-12
- **Read this (2/2):** [Code Coverage Best Practices](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html) · Google Testing Blog, Aug 2020 (per URL) · chasing 100% gives "a false sense of security" and wasted tests; target depends on criticality (*read*) · fetched 2026-10-12

### T09-11 · Vitest / Jest — Understand · ✅ `…/12-vitest-and-jest.md`
- **Read this:** [Why Vitest](https://vitest.dev/guide/why) · vitest.dev (site showed v5.0.4) · Vite-native runner, how it differs from other runners (*read*, ≈670 words) · covers our angle: **partial** — an advocate's view, no comparison with `node:test` · fetched 2026-10-12
- **Also good:** [Getting Started (Jest)](https://jestjs.io/docs/getting-started) · jestjs.io · setup, Babel, TypeScript, ESLint (*headings only*) · fetched 2026-10-12

### T09-12 · Testcontainers — Know · ✅ `…/13-testcontainers.md`
- **Read this:** [Getting started with Testcontainers for Node.js](https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/) · testcontainers.com · PostgreSQL via Docker with `pg` and `@testcontainers/postgresql`; uses Jest (*read*) · covers our angle: **partial** — not `node:test` · fetched 2026-10-12
- **Also good:** [Testcontainers for NodeJS](https://node.testcontainers.org/) · node.testcontainers.org · project home (*headings only*, ≈240 words) · fetched 2026-10-12

### T09-13 · Newer runner flags — Know · ✅ `…/14-runner-flags.md`
- **Read this:** [Test runner](https://nodejs.org/api/test.html) · nodejs.org · sections "Randomizing tests execution order" and "Test tags" (added v26.2.0, Stability 1.0 - Early development); `context.workerId`; "Test instrumentation and OpenTelemetry" (*read* the tag block, *headings only* otherwise) · covers our angle: full · fetched 2026-10-12
- **Our delta:** 🔴 the syllabus names `--test-random-order` and `--test-name-tag`; neither string appears in the v26.11.1 CLI page. It lists `--test-randomize`, `--test-random-seed` and `--experimental-test-tag-filter`. Our page should use those and say so.

### T09-14 · Snapshot testing — Know · ✅ `…/15-snapshot-testing.md`
- **Read this:** [Test runner: Snapshot testing](https://nodejs.org/api/test.html) · nodejs.org · the section exists; the CLI lists `--test-update-snapshots` (*headings only*) · covers our angle: **partial** · fetched 2026-10-12
- **Our delta:** when snapshots rot into rubber-stamped diffs; no page opened argues it.

### T09-15 · ESLint flat config, Prettier, Biome — Know · ✅ `…/16-lint-and-format.md`
- **Read this:** [Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files) · ESLint · `eslint.config.js` and its variants, configuration objects, files and ignores (*read*, ≈6.4k words) · covers our angle: **partial** — ESLint only · fetched 2026-10-12
- **Also good:** [Biome quick start](https://biomejs.dev/installation/quick-start/) · biomejs.dev · one tool for lint and format, migrating from ESLint and Prettier (*headings only*) · [Prettier docs](https://prettier.io/docs/) · prettier.io · "an opinionated code formatter" (*read*) · fetched 2026-10-12

### T09-16 · Property-based and mutation testing — When Needed · ✅ `…/17-property-and-mutation.md`
- **Read this (1/2):** [fast-check: Introduction](https://fast-check.dev/docs/introduction/) · fast-check.dev · runs assertions over hundreds of generated cases and shrinks failures to a minimal input (*read*) · covers our angle: full for property tests · fetched 2026-10-12
- **Read this (2/2):** [What is mutation testing?](https://stryker-mutator.io/docs/) · Stryker · why coverage alone does not show test quality (*read*, ≈660 words) · fetched 2026-10-12

### T09-17 · Load testing — When Needed · ✅ `…/18-load-testing.md`
- **Read this:** [autocannon README (raw)](https://raw.githubusercontent.com/mcollina/autocannon/master/README.md) · github (raw) · an HTTP/1.1 benchmarking tool written in Node, with pipelining and HTTPS (*read*) · covers our angle: **partial** — tool README · fetched 2026-10-12
- **Also good:** [Grafana k6 docs](https://grafana.com/docs/k6/latest/) · grafana.com · JavaScript-scripted load testing (*headings only*) · fetched 2026-10-12

### T09-18 · Contract testing — Understand · ✅ `…/19-contract-testing.md`
- **Read this:** [How Pact works](https://docs.pact.io/getting_started/how_pact_works) · Pact docs · consumer tests, provider verification, provider states (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Contract Test](https://martinfowler.com/bliki/ContractTest.html) · Fowler, 12 Jan 2011 · short; suggests consumer-driven contracts to catch unexpected breaks (*read*) · fetched 2026-10-12

### T09-19 · Schema compatibility — Understand · ✅ `…/20-schema-compatibility.md`
- **Read this:** [AIP-180: Backwards compatibility](https://google.aip.dev/180) · Google API Improvement Proposals · adding, removing or renaming, changing types, semantic changes (*read* the headings) · covers our angle: **partial** — written for protobuf and Google APIs · fetched 2026-10-12
- **Our delta:** the JSON/HTTP version of the same rules and "which need a new version"; I found no Node-specific page.

### T09-20 · Consumer-driven contracts — Know · ✅ `…/19-contract-testing.md` (shared with T09-18)
- **Read this:** [Pact introduction](https://docs.pact.io/) · Pact docs · describes Pact as a code-first consumer-driven contract testing tool (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Consumer-Driven Contracts: A Service Evolution Pattern](https://martinfowler.com/articles/consumerDrivenContracts.html) · Ian Robinson, 12 Jun 2006 · the original pattern; schema versioning, breaking changes (*headings only*) · fetched 2026-10-12
