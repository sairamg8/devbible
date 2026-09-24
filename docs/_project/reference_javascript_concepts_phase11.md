---
name: devbible-javascript-concepts-phase11
description: Load-bearing claims and sources for JavaScript phase 11 — network, storage and data transfer
metadata:
  type: reference
---

*Child of [[devbible-javascript-concepts]]. Open when working on phase 11.*

Provenance: **documentation-validated** against MDN / the Fetch spec. No sandbox — no page
prints a response body, timing or header dump.

Phase 11 has **5 Master topics** (01–05). ✅ **ALL FIVE DONE** — Master tier complete.

## Topic 01 · fetch (commit `19b5ec9`)

- 🔴 **A 404 is a successful fetch.** MDN: *"if the server responds with an error like `404`,
  then `fetch()` fulfills with a `Response`."* Framing used on the page: **the promise answers
  "did the HTTP exchange happen?", not "did it go well?"**
- Second-order symptom people actually report: `res.json()` throwing **`SyntaxError`** because
  it parsed an HTML error page after `ok` was never checked.
- What rejects: *"a network error or a bad scheme"* — DNS/connection, offline, **CORS/CSP
  block**, abort (`DOMException` named `AbortError`), malformed URL. **Never 4xx/5xx.**
- 🔴 **`TypeError: Failed to fetch` is deliberately vague** — revealing the real response would
  defeat the same-origin policy. **Detail is in the console, not the error object.**
- Defaults: `GET`; **`credentials: "same-origin"`** (🔴 no cookies cross-origin → API 401s
  while the address bar works); `mode: "cors"`.
- 🔴 **Body is a read-once stream** — MDN: *"not possible to read the same response (or
  request) body more than once"*. `res.clone()` **before** the first read. Consequence: a
  wrapper that logs raw text on failure must clone or it eats the parser's body.
- On `!ok`: read the body (the API's error text is the useful part) and throw a **typed**
  error carrying status + body.

## Topic 02 · Request bodies (commit `7f3f6ff`)

| Body | Content-Type | Set yourself? |
|---|---|---|
| `JSON.stringify(obj)` | `application/json` | **yes** |
| `FormData` | `multipart/form-data; boundary=…` | 🔴 **never** |
| `URLSearchParams` | `application/x-www-form-urlencoded` | no |
| `Blob`/`File` | the blob's `type` | usually no |

- A **string body gets no automatic Content-Type** → the "works in Postman" failure.
- 🔴 MDN warning quoted: *"do not explicitly set the `Content-Type` header"* for FormData —
  *"Doing so will prevent the browser from being able to set the `Content-Type` header with
  the **boundary expression**"*. **The server then reports an EMPTY FORM, not a header
  problem**, which sends you looking in the wrong place.
- 🔴 **A shared wrapper that always sets `application/json` breaks every upload.** Topic 03
  must skip the header for FormData bodies.
- `JSON.stringify` drops `undefined` → send `null` if the field must appear.
- `GET`/`HEAD` cannot have a body (TypeError). **A `Request` body is read-once too** → a retry
  helper that stores and replays a `Request` is a real bug.

## Topic 03 · A `fetch` wrapper worth reusing (commit `13bc322`, 6 chunks)

Sources: MDN *Using the Fetch API*, `Response.clone()`, `URL()` constructor, `Headers`,
`Headers.set()`/`append()`, `RequestInit.credentials`, `AbortSignal.timeout()`,
`AbortSignal.any()`, `AbortController.abort()`, `AbortSignal`, `Request.body`, `Retry-After`.

**01 · What fetch leaves you with**
- `fetch` is a transport, not a client: no throw on 4xx/5xx, no parse, no URL join, no auth,
  timeout or retry. The wrapper *is* the client.
- 🔴 The missing `ok` check surfaces as `SyntaxError: Unexpected token '<'` **from the parser**,
  three layers from the cause.
- `204 No Content` → `res.json()` throws. Return `null`. This is the "DELETE works but rejects"
  report.
- 🔴 `statusText` is the HTTP/1.1 reason phrase and **HTTP/2 removed reason phrases** → routinely
  empty. Throw status + body instead.
- `clone()` must be taken **before** the first read — MDN: *"`clone()` throws a `TypeError` if
  the response body has already been used."* Error path only: *"If only one cloned branch is
  consumed, then the entire body will be buffered in memory."*

**02 · URLs, parsing and the client surface**
- 🔴 Base **without** trailing slash loses its last segment; path **with** leading slash discards
  the base path (RFC 3986). Together these are every "my base URL is ignored" report. Normalise
  both in the wrapper.
- Parse by `Content-Type`, `includes("json")` not equality — `; charset=utf-8`,
  `application/problem+json` (RFC 9457), `application/vnd.api+json`.
- Method-helper spread order: `...opts` **first**, then `method`, or `api.get(p,{method:"POST"})`
  silently POSTs.
- Factory not singleton — tests, a second API, SSR.

**03 · Headers and bodies**
- 🔴 `Content-Type` must be **absent** for FormData/URLSearchParams/Blob/ArrayBuffer/typed
  array/ReadableStream. `ArrayBuffer.isView()` covers every typed array + DataView.
- 🔴 MDN: *"header names are matched by case-insensitive byte sequence"* — object spread keeps
  both `Content-Type` and `content-type`. Merge through `new Headers()`.
- `set` overwrites, `append` accumulates → an `append` merge loop triples `Accept`.
- Forbidden header names (`Host`, `Origin`, `Referer`, `Connection`, `Content-Length`, `Cookie`)
  never reach the wire. Cross-origin responses expose only safelisted headers unless
  `Access-Control-Expose-Headers`.

**04 · Auth and the 401 refresh**
- 🔴 `getToken` must be a **function**; a captured value presents as "logs me out after an hour"
  even though refresh works.
- `credentials` default `"same-origin"` → no cookies cross-origin; `"include"` requires
  `Access-Control-Allow-Credentials: true` **and a specific origin** (wildcard rejected).
- 🔴 **Single-flight the refresh.** Six parallel 401s → six refreshes → rotation invalidates the
  rest → the recovery code logs the user out. Share one in-flight promise, clear it in
  **`finally`** (in `then`, a failed refresh poisons every later request until reload).
- Guards: retry once; exclude the refresh endpoint; 401 **not** 403.

**05 · Timeouts and cancellation**
- `fetch` has **no** timeout. `AbortSignal.timeout(ms)` aborts *"with a `TimeoutError`
  `DOMException`"*; `abort()` default reason is *"`AbortError` `DOMException`"*.
- 🔴 Both are `DOMException` → **check `err.name`, not `instanceof`**. Third case is `TypeError`.
- `AbortSignal.any()` — *"the abort reason will be set to the reason of the first signal that is
  aborted"* — is what preserves the distinction; a hand-rolled combiner flattens both to
  `AbortError`. **Baseline 2024, newly available.**
- MDN: timeout is *"based on active rather than elapsed time"*, paused in bfcache/suspended
  worker → not a wall-clock deadline.
- `abort()` also stops *"the consumption of any response bodies, or streams"* → a rejection can
  surface from `res.json()`.
- 🔴 Destructure `signal` out of options; leaving it in `...rest` silently deletes the timeout.

**06 · Retries**
- Retryable: `TypeError`, `TimeoutError`, 408, 429, 5xx. **Never** `AbortError`; never other 4xx.
- 🔴 **A timeout means you stopped listening, not that the server did nothing** → a retried
  `POST` creates duplicate orders. Only with an idempotency key, **generated outside the loop**.
- Jitter is load-bearing: the outage synchronises the clients, so a fixed delay preserves the
  herd perfectly.
- `Retry-After` has **two legal forms** (`<delay-seconds>` and `<http-date>`); parsing a date
  with `Number()` gives `NaN` and `setTimeout(NaN)` fires immediately — the opposite of backoff.
- Every attempt needs a **fresh timeout signal** (an aborted signal stays aborted — MDN on
  `any()`) and a **fresh body** (`Request` body is read-once; a `ReadableStream` body cannot be
  retried at all).

## Topic 04 · `URL` and `URLSearchParams` (commit `250b974`, 3 chunks)

Sources: MDN `URL`, `URL()` constructor, `URL.parse()`, `URL.canParse()`, `URLSearchParams`
(+ constructor/get/getAll/set/append), `URL.searchParams`, `encodeURIComponent()`,
`encodeURI()`, `String.prototype.toWellFormed()`.

**01 · The URL object**
- 🔴 The three misleading components: `protocol` **includes the final `':'`** (so
  `=== "https"` is always false); `host` carries the port, `hostname` never does; `search`
  and `hash` include their leading `?`/`#`.
- `origin` and `searchParams` are **read-only**; everything else is writable and reserialises.
- Constructor **throws** `TypeError` on invalid input — a feature in a wrapper. `URL.parse()`
  *"returns `null`"* instead; prefer it to `canParse()` + `new URL()` (double parse +
  check-then-use gap).
- Relative resolution: base without trailing slash loses its last segment; leading slash
  discards the base path; `//host` is scheme-relative; an absolute reference ignores the base.
- 🔴 **`URL` is not a validator and not a security boundary.** The open-redirect bug is
  `target.startsWith("https://myapp.com")` — `https://myapp.com.evil.test/` passes. Compare
  **`url.origin`**.
- Browser normalisation (case, default port, `.`/`..`, punycode) is why a URL signature can
  fail to match server-side.

**02 · URLSearchParams**
- A query string is a **multimap**. `get()` = *"the first value"*, `getAll()` = *"all the
  values"*.
- 🔴 MDN: the constructor *"does not parse full URLs"* — it only *"strips an initial leading
  `?`"*. Pass `url.search`.
- 🔴 The object form cannot repeat a key, and `{tag:["a","b"]}` stringifies to `tag=a%2Cb` —
  **the most common surprise**. Use the array-of-pairs form. `undefined`/`null` become the
  literal strings.
- `set()` — *"If there are several values, the others are deleted"* — vs `append()`. `append`
  in a loop with no clear step is the "parameters accumulate on every filter change" bug.
- `get()` returns `""` for `?flag=` and `null` when absent; both falsy → use `has()`.
- `Object.fromEntries(params)` **silently drops duplicates**. `sort()` sorts *"by their keys"*
  for canonical forms. `size` counts duplicates separately.
- `url.searchParams` is a **live view but a read-only property** — assigning to it does nothing
  (silent in sloppy mode); assign to `url.search` to replace the query.
- `toString()` has **no** leading `?`; `url.search` **does** → the `??` bug.

**03 · Encoding rules**
- 🔴 **Two different percent-encode sets.** MDN: `URLSearchParams` uses the
  `application/x-www-form-urlencoded` set (*"all code points except ASCII alphanumeric, `*`,
  `-`, `.`, and `_`"*) and encodes *"U+0020 SPACE as `+`"*. `encodeURIComponent` leaves
  `A–Z a–z 0–9 - _ . ! ~ * ' ( )` and encodes space as `%20`.
- 🔴 **The `+` corruption:** `decodeURIComponent("hello+world")` → `"hello+world"`. Decoding
  form-encoded data with URI rules puts literal plus signs in the database — noticed first in
  email addresses. Parse with `URLSearchParams` on both sides.
- 🔴 **A path segment needs `encodeURIComponent` by hand** — `URL` will NOT escape a `/` inside
  an id, because a slash is legal in a path. `orders/a/b` becomes two segments → 404.
- `encodeURI` encodes *"fewer characters … excluding those that are part of the URI syntax"* →
  wrong for a component. `escape()` never.
- Round trip through `URLSearchParams` is lossless in both directions (`a+b` → `q=a%2Bb`;
  `q=a+b` → `"a b"`).
- **Lone surrogates:** `encodeURIComponent` throws `URIError` *"if one attempts to encode a
  surrogate which is not part of a high-low pair"*; fix with `toWellFormed()`, which *"replaces
  lone surrogates with the Unicode replacement character"*. Reachable from a truncated emoji.
  `URLSearchParams` does not throw here.
- `decodeURIComponent` throws on a bare `%` or a truncated escape → guard or avoid.

## Topic 05 · CORS from the client side (commit `36623e8`, 3 chunks)

Sources: MDN *Cross-Origin Resource Sharing (CORS)* guide, *CORS-safelisted request header*,
`Access-Control-Allow-Credentials`, `Access-Control-Expose-Headers`, `Access-Control-Max-Age`,
`RequestInit.credentials`, `Vary`, `Response.type`, Same-origin policy.

**01 · What the browser is actually doing**
- MDN: CORS is *"an HTTP-header based mechanism that allows a **server** to indicate any origins
  … from which a **browser** should permit loading resources."* → server decides, browser
  enforces, **no client-side fix exists**.
- Origin = scheme + host + port. 🔴 **A subdomain is a different origin**; shared ownership is
  irrelevant.
- 🔴 **The request is still sent; the RESPONSE is blocked** (simple requests). So a CORS-blocked
  `POST` may have created the record — retrying is the duplicate-order scenario. The network tab
  showing 200 while the console errors is both things being true.
- CORS is **not** server-side security: it protects the *user's* data from other pages. Auth and
  CSRF are still required.
- The `TypeError` is vague **by design** — detail in the error object would let a page probe
  cross-origin responses. Cannot be branched on, cannot be logged from script.
- 🔴 **`mode: "no-cors"` is not a workaround** — opaque response, `type: "opaque"`, status `0`,
  unreadable body, and it silently downgrades to simple-request rules. Converts a loud error into
  a silent `null`.
- Only three fixes: server headers, a proxy on your own origin, or move the call to your backend.

**02 · Simple versus preflighted**
- The exact test (MDN, *"meets all the following conditions"*): methods `GET`/`HEAD`/`POST`;
  manually-set headers limited to `Accept`, `Accept-Language`, `Content-Language`,
  `Content-Type`, `Range` (single value); `Content-Type` limited to
  `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`; no `ReadableStream`
  body; no `XMLHttpRequest.upload` listeners.
- 🔴 **`application/json` is NOT safelisted** → nearly every real API call is preflighted. The
  safelist is "what an HTML form could already do cross-origin".
- Preflight = `OPTIONS` + `Origin` + `Access-Control-Request-Method` (*"what HTTP method will be
  used"*) + `Access-Control-Request-Headers` (*"what HTTP headers will be used"*).
- 🔴 **The preflight carries no credentials** → auth middleware mounted before CORS answers 401
  and the symptom is a CORS error. Also 404/405 when the router only knows `POST` — this is why
  "GET works, POST doesn't".
- `Access-Control-Max-Age` = *"how long the results of a preflight request can be cached"*;
  ⚠️ browsers cap it, and the cache is per method/header set.
- Four console messages decoded, incl. `Redirect is not allowed for a preflight request`
  (http→https or trailing slash).
- 🔴 Debugging habit: **read the `OPTIONS` response in the network tab**, not the request you
  wrote.

**03 · Credentials and exposure**
- `credentials: "include"` **plus** `Access-Control-Allow-Credentials: true` **plus** an explicit
  origin. MDN: the server *"must not specify the `*` wildcard … but must instead specify an
  explicit origin"*; with a wildcard *"the browser will block access to the response."* Wildcards
  also stop working for `Allow-Headers`/`Allow-Methods`.
- 🔴 **`Vary: Origin`** — echoing the origin makes the response depend on a request header; a CDN
  without `Vary` serves one origin's permission to another. **Presents as CORS failing only in
  production and only for some users.**
- `Access-Control-Expose-Headers` *"adds the specified headers to the allowlist that JavaScript
  … is allowed to access"* → this is why `res.headers.get("x-total-count")` is `null` while the
  network tab shows it. Prefer putting the value in the body.
- 🔴 **`SameSite` is an independent gate** from `credentials`. `Lax` (modern default) is not sent
  cross-site; cross-site needs `None; Secure`. Same symptom as forgetting `credentials`.
- **Same-site ≠ same-origin**: `app.` and `api.example.com` are the same site (Lax cookies flow)
  but different origins (CORS applies).
- 7-step checklist; steps 2–7 are all server-side — the client's whole contribution is one
  option plus the header/method choices that decide whether a preflight happens.
