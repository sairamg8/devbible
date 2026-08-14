---
title: "03.4 · Auth and the 401 refresh"
sidebar_label: "04 · Auth and refresh"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`RequestInit.credentials`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#credentials), [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch), [`Request.body`](https://developer.mozilla.org/en-US/docs/Web/API/Request/body), [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers). Documentation-validated.

**Auth is the part of the wrapper that changes over time.** The token expires, the cookie is
scoped, and the recovery path — refresh and retry — is the single piece of wrapper code most
likely to log your users out if written the obvious way.

## Injecting a token

```js
async function authHeader(getToken) {
  const token = await getToken?.();
  return token ? { Authorization: `Bearer ${token}` } : null;
}
```

🔴 **`getToken` is a *function*, not a value.** This is the whole point. The token changes — it
is refreshed, it is replaced on login, it is cleared on logout — and reading it once at
client-construction time pins the wrapper to whatever token existed when the module was first
imported.

```js
// ❌ pinned forever to the token that existed at page load
const client = createClient({ token: localStorage.getItem("token") });

// ✅ read per request
const client = createClient({ getToken: () => authStore.accessToken });
```

The failure the first version produces looks like **"the API logs me out after an hour"**, and
it survives investigation for a long time because the refresh code works perfectly — it just
updates a token nobody reads again.

Making it `async` costs nothing and buys the case where the token lives somewhere asynchronous
(IndexedDB, a service worker, an extension's storage API).

**Return `null`, not `{}`,** when there is no token, so the header merge from
[03 · Headers and bodies](./03-headers-and-bodies.md) can skip the source entirely. Sending
`Authorization: Bearer undefined` is worse than sending nothing: some servers answer 400 instead
of 401, and the client's "am I logged in" logic never sees the 401 it is watching for.

## Cookies are not a header you set

The other half of auth is not injected at all. From
[01 · The critical surprise](../01-fetch/01-the-critical-surprise.md), `fetch` defaults to
`credentials: "same-origin"` — so a **cross-origin** API call sends **no cookies**, while the
same URL typed into the address bar sends them.

That is the "works in the browser, 401s in the app" report, and it is one option:

```js
fetch(url, { credentials: "include" })   // send cookies cross-origin
```

The three values:

| Value | Cookies sent |
|---|---|
| `"omit"` | never |
| `"same-origin"` | **default** — same-origin requests only |
| `"include"` | always, cross-origin included |

⚠️ **`include` is not free.** The server must answer with `Access-Control-Allow-Credentials:
true` **and** an explicit origin — `Access-Control-Allow-Origin: *` is rejected by the browser
once credentials are involved, because a wildcard plus credentials would let any site read
authenticated responses. The server half is
[05 · CORS from the client side](../05-cors-client-side/README.md) and the Express syllabus.

🔴 **Pick one scheme.** A token in `localStorage` *and* cookies means two auth paths that can
disagree — requests succeed in one tab and fail in another depending on which credential happened
to be fresh. Cookie-based auth with `HttpOnly` keeps the token out of reach of XSS; header-based
auth is simpler cross-origin. Both are defensible; running both by accident is not.

## The 401 refresh, and why it needs a lock

The obvious implementation is a bug:

```js
// ❌ ten parallel 401s trigger ten refreshes
if (res.status === 401) {
  await refreshToken();
  return request(path, options);
}
```

A page that loads six widgets at once fires six requests. All six get 401. All six call
`refreshToken()`. With **rotating** refresh tokens — where using a refresh token invalidates it
and issues a new one — the first call succeeds and invalidates the token the other five are
using. Five refreshes fail, and the user is logged out by the very code meant to keep them
logged in.

It is worse than a plain race, because it is *intermittent*: it needs concurrency, so it does not
reproduce when you click one button in isolation.

**Single-flight it** — share one in-flight refresh promise:

```js
let refreshing = null;

function refreshOnce() {
  refreshing ??= refreshToken().finally(() => { refreshing = null; });
  return refreshing;
}
```

Every concurrent caller awaits the *same* promise, one network refresh happens, and `finally`
clears the slot so the next 401 starts a fresh one. This is the promise-sharing pattern from
[Phase 7 · 09 · Sequential vs parallel](../../phase-7-async/09-sequential-vs-parallel/README.md)
applied to the one place it matters most.

`finally` rather than `then` because **the slot must be cleared on failure too** — otherwise a
single failed refresh poisons every future request with a permanently rejected promise, and the
only fix the user has is a reload.

## Wiring the retry

```js
async function requestWithAuth(path, options, { isRetry = false } = {}) {
  const res = await request(path, options);          // throws HttpError on !ok

  …
}

// in the error path:
catch (err) {
  const canRefresh =
    err instanceof HttpError && err.status === 401 && !isRetry && !isRefreshEndpoint(path);

  if (!canRefresh) throw err;

  await refreshOnce();
  return requestWithAuth(path, options, { isRetry: true });
}
```

Three guards, each protecting against a real failure:

- **`!isRetry` — retry once, then give up.** A second 401 after a successful refresh means the
  token is not the problem (the user lacks permission, or the resource is gone). Retrying again
  loops until something else breaks.
- **`!isRefreshEndpoint(path)`** — otherwise a failing refresh endpoint refreshes to fix its own
  401, recursing until the stack or the rate limiter gives out.
- **`err.status === 401`, not 403.** A 401 means "authenticate"; a 403 means "authenticated, and
  not allowed". Refreshing on 403 turns a permissions message into an infinite retry.

## Re-sending a request body

If the wrapper retries anything — after a refresh, or on a 503 — it must be able to build the
request **again**. From
[02 · Choosing a body](../02-request-bodies/01-choosing-a-body.md):

🔴 **A `Request`'s body is read-once, exactly like a response's.** A wrapper that stores a
constructed `Request` and replays it sends an empty body the second time — and the server's
error will be about a missing field, not about a replayed stream.

```js
// ❌ the retry sends nothing
const req = new Request(url, { method: "POST", body });
await fetch(req);
await fetch(req);          // body already consumed

// ✅ keep the inputs, build per attempt
await fetch(url, { method: "POST", body });
await fetch(url, { method: "POST", body });
```

Which is why the retry above re-calls `requestWithAuth(path, options)` rather than re-sending a
`Request` object: `path` and `options` are inert data and can be used any number of times.

⚠️ **Two body types cannot be retried at all.** A `ReadableStream` body is consumed by the first
attempt and cannot be recreated. A `FormData` built from a file input can usually be re-sent, but
not if the underlying `File` has become unreadable — the user moved or deleted it, which throws
when the second read happens. A wrapper that supports retries should **refuse** to retry a stream
body rather than silently send nothing.

## Gotchas

**Symptom:** The user is logged out roughly an hour after loading the page
**Cause:** The token was read once when the client was created, so every request uses the stale
one no matter how often it is refreshed.
**Fix:** Pass `getToken` as a function and call it per request.

**Symptom:** The server answers 400 instead of 401 when logged out
**Cause:** The wrapper sent `Authorization: Bearer undefined`.
**Fix:** Return `null` from the auth source and skip the header entirely.

**Symptom:** The API 401s from the app but the same URL works in the address bar
**Cause:** `credentials` defaults to `"same-origin"`, so no cookies cross-origin.
**Fix:** `credentials: "include"`, plus `Access-Control-Allow-Credentials: true` and a specific
origin on the server.

**Symptom:** `credentials: "include"` still sends no cookies, and the console shows a CORS error
**Cause:** The server replies `Access-Control-Allow-Origin: *`, which is rejected once
credentials are involved.
**Fix:** The server must echo a specific origin.

**Symptom:** A page load triggers a burst of token refreshes and logs the user out
**Cause:** Every parallel 401 started its own refresh; rotation invalidated the others.
**Fix:** Single-flight the refresh — one shared in-flight promise.

**Symptom:** After one failed refresh, every request fails forever until reload
**Cause:** The shared promise slot was cleared in `then`, not `finally`, so the rejected promise
stayed cached.
**Fix:** Clear it in `finally`.

**Symptom:** A 403 causes an endless refresh loop
**Cause:** The refresh branch triggers on any auth-ish status.
**Fix:** Refresh on 401 only. 403 means authenticated and not permitted.

**Symptom:** The refresh endpoint itself recurses
**Cause:** Its own 401 re-enters the refresh path.
**Fix:** Exclude the refresh endpoint explicitly.

**Symptom:** A retried request arrives with an empty body
**Cause:** The same `Request` object was replayed; its body is read-once.
**Fix:** Rebuild from the original inputs each attempt; refuse to retry stream bodies.

**Symptom:** Auth works in one tab and fails in another
**Cause:** Both a stored token and cookies are in play, and they disagree.
**Fix:** Pick one scheme.

## Interview questions

**★ Why is `getToken` a function rather than a token string?**
Because the token changes. Capturing the value at client-construction time pins every future
request to the token that existed at page load, which presents as "it logs me out after an
hour" — even though the refresh code works perfectly.

**★ Why does the API 401 from JavaScript but work in the address bar?**
`fetch` defaults to `credentials: "same-origin"`, so no cookies are sent cross-origin. Setting
`credentials: "include"` also requires the server to send
`Access-Control-Allow-Credentials: true` with a specific origin — a wildcard is rejected once
credentials are involved.

**★ Ten requests fire at once and all get 401. What does a naive refresh do?**
Ten refresh calls. With rotating refresh tokens the first invalidates the rest, so nine fail and
the user is logged out by the recovery code. Fix: single-flight — one shared in-flight promise,
cleared in `finally`, retried once only.

**★ Why clear the shared refresh promise in `finally` rather than `then`?**
So a failed refresh does not leave a permanently rejected promise cached. Cleared only on
success, every subsequent request awaits that rejection and the app cannot recover without a
reload.

**★ Why refresh on 401 but not 403?**
401 means "you are not authenticated" — a new token may fix it. 403 means "authenticated, and not
allowed" — a new token cannot. Refreshing on 403 turns a permissions error into a retry loop.

**★ Why can't a wrapper cache a built `Request` and replay it?**
Its body is a read-once stream, so the replay sends nothing and the server complains about
missing fields rather than about the body. Keep the inputs — path, method, body value — and
construct a new request per attempt.

**Which bodies can never be retried?**
`ReadableStream` bodies, which are consumed by the first attempt and cannot be recreated. A
wrapper should refuse rather than silently send an empty body.

---

← [03 · Headers and bodies](./03-headers-and-bodies.md) · [Topic index](./README.md) ·
Next → [05 · Timeouts and cancellation](./05-timeouts-and-cancellation.md)
