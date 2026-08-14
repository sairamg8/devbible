---
title: "03.2 · URLs, parsing and the client surface"
sidebar_label: "02 · URLs and parsing"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`URL()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL), [`Response.headers`](https://developer.mozilla.org/en-US/docs/Web/API/Response/headers), [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch). Documentation-validated.

**The status check is the wrapper's job; the base URL and the parse are its manners.** Both are
places where a small mistake is invisible until a specific endpoint hits it.

## Base URL — use `URL`, not concatenation

```js
const BASE = "https://api.example.com/v2/";

function resolve(path) {
  return new URL(path, BASE).toString();
}
```

String concatenation produces `…/v2//users` or `…/v2users` depending on which side has the
slash, and both are real bugs that only show up against a strict server or a router that does
not normalise. The `URL` constructor applies the standard relative-resolution rules instead —
the full treatment is [04 · `URL` and `URLSearchParams`](../04-url-and-searchparams/README.md).

🔴 **Two resolution rules bite here**, and both are worth memorising now:

```js
new URL("users", "https://api.example.com/v2")    // → https://api.example.com/users
new URL("users", "https://api.example.com/v2/")   // → https://api.example.com/v2/users
new URL("/users", "https://api.example.com/v2/")  // → https://api.example.com/users
```

- A base **without** a trailing slash loses its last segment — the base's final path component
  is treated as a file name and replaced. **Always give the base a trailing slash.**
- A path **with** a leading slash is *absolute-path* relative: it discards the base path
  entirely and keeps only the origin. So inside a wrapper with a versioned base, call sites must
  pass `"users"`, not `"/users"`, or the version prefix silently disappears.

Those two together explain nearly every "my base URL is being ignored" report. They are not
quirks of `URL` — they are RFC 3986 relative resolution, the same rules a browser uses for
`<a href>`.

**A defensive wrapper can normalise both**, and it is worth doing because call sites will get it
wrong:

```js
const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
const url  = new URL(String(path).replace(/^\/+/, ""), base);
```

Now `api.get("/users")` and `api.get("users")` mean the same thing, which is the behaviour every
caller already assumes.

## Parsing — trust `Content-Type`, not the endpoint

```js
async function parse(res) {
  if (res.status === 204 || res.status === 205) return null;
  if (res.headers.get("content-length") === "0") return null;

  const type = res.headers.get("content-type") ?? "";
  if (type.includes("json")) return res.json();
  if (type.startsWith("text/")) return res.text();
  return res.blob();
}
```

**An endpoint that "always returns JSON" does not.** The day a proxy in front of it serves a 502
page, or a CDN returns a maintenance HTML page with a 200, or the route falls through to the SPA
index, the body is HTML. Branching on the header means the wrapper degrades to a string instead
of throwing a parse error that names the wrong layer.

`includes("json")` rather than `=== "application/json"` because:

- the real header is usually `application/json; charset=utf-8` — a parameter is appended;
- `+json` suffix types are common in exactly the APIs that bother with structured errors:
  `application/problem+json` (RFC 9457), `application/vnd.api+json` (JSON:API),
  `application/ld+json`.

An equality check rejects all of those and falls back to text, and then callers get a string
where they expected an object — a bug that survives review because the happy path works.

**Empty bodies deserve their own branch.** `204 No Content` and `205 Reset Content` are defined
to have none; a `content-length: 0` on any status is the general case. Returning `null` is
kinder than returning `""`, because `null` is what a caller checks for.

## Version 2 — put together

```js
const BASE = "https://api.example.com/v2/";

export async function request(path, { method = "GET", body, headers, ...rest } = {}) {
  const url = new URL(String(path).replace(/^\/+/, ""), BASE);

  const res = await fetch(url, { method, body, headers, ...rest });

  if (!res.ok) {
    const copy = res.clone();
    let payload;
    try { payload = await res.json(); } catch { payload = await copy.text(); }
    throw new HttpError(res.status, payload, url.toString());
  }

  return parse(res);
}
```

Note `fetch(url, …)` with a `URL` object rather than a string. `fetch` accepts anything
stringifiable, so this is not a conversion you need to do by hand — and passing the object keeps
the failure (an invalid URL throws a `TypeError` at construction, before any network work) at the
line that caused it.

## Method helpers are the ergonomics

```js
export const api = {
  get:    (path, opts)       => request(path, { ...opts, method: "GET" }),
  post:   (path, body, opts) => request(path, { ...opts, method: "POST",  body }),
  put:    (path, body, opts) => request(path, { ...opts, method: "PUT",   body }),
  patch:  (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts)       => request(path, { ...opts, method: "DELETE" }),
};
```

This is where the wrapper stops being a chore. `api.post("orders", { itemId })` reads like the
thing it does, and the JSON encoding, the `ok` check, the typed error and the base URL all happen
once, in one file, where they can be fixed once.

🔴 **Note the spread order: `...opts` first, then `method`.** Reversed, a caller passing
`{ method: "HEAD" }` inside `opts` would silently override the helper — so `api.get(path, opts)`
would issue a `POST`. It is a one-token bug that no test catches unless someone thought to write
it.

## Make it a factory, not a singleton

```js
export function createClient({ baseUrl, ...defaults } = {}) {
  return { get: …, post: … };          // closes over baseUrl
}
```

A module-level singleton reading a global base URL cannot serve:

- **tests**, which need a base pointing at a mock server;
- **a second API** — an auth service and a product service in the same app;
- **server-side rendering**, where relative URLs have no origin to resolve against and the base
  must be absolute.

One factory covers all three, and it costs nothing: export a default instance built from the
factory for the common case.

## What the wrapper must not do

**Do not swallow errors.** A wrapper that returns `null` on failure moves the failure to a
`Cannot read properties of null` two functions later, in code that has no idea a request even
happened.

**Do not put UI in it.** A wrapper that shows a toast on every 401 cannot be used by the login
form, which needs to show the 401 inline. Return the information; leave the reaction outside.

**Do not retry `POST` by default** — [06 · Retries](./06-retries.md).

**Do not add interceptors "for later".** A request/response interceptor chain is the point where
a wrapper becomes a framework, and where a stack trace stops telling you which code changed the
request. Add one when a second concrete need appears, not before.

## Gotchas

**Symptom:** Requests hit `…/v2//users` or `…/v2users`
**Cause:** String concatenation of base and path.
**Fix:** `new URL(path, BASE)`.

**Symptom:** The base URL's `/v2` disappears
**Cause:** Either the base had no trailing slash (its last segment is replaced), or the path had
a leading slash (the base path is discarded entirely).
**Fix:** Normalise both in the wrapper: force a trailing slash on the base, strip leading slashes
from the path.

**Symptom:** A caller gets a string where an object was expected
**Cause:** The parse branch tested `content-type === "application/json"` and the server sent
`application/problem+json` or added `; charset=utf-8`.
**Fix:** `type.includes("json")`.

**Symptom:** A 200 response fails to parse
**Cause:** A proxy, CDN maintenance page or SPA fallback returned HTML with a success status.
**Fix:** Branch on `Content-Type` and degrade to text rather than throwing.

**Symptom:** `api.get(path, { method: "POST" })` sends a `GET`, or vice versa
**Cause:** Spread order in the method helpers.
**Fix:** Caller options first, then the helper's own `method`.

**Symptom:** Tests hit the real API
**Cause:** The client is a module-level singleton reading a global base URL.
**Fix:** A `createClient({ baseUrl })` factory; export a default instance for convenience.

**Symptom:** The same wrapper cannot be used on the server
**Cause:** Relative URLs have no origin during SSR.
**Fix:** The factory again — pass an absolute base on the server.

**Symptom:** A failing request produces `Cannot read properties of null` somewhere unrelated
**Cause:** The wrapper returned `null` instead of throwing.
**Fix:** Throw; let the caller decide.

## Interview questions

**★ Why `new URL(path, base)` instead of `base + path`?**
Concatenation produces `//` or a missing separator depending on which side carries the slash.
`URL` applies RFC 3986 relative resolution — the same rules the browser uses for `<a href>` —
and throws immediately on an invalid URL rather than sending a broken request.

**★ A wrapper with base `https://api.example.com/v2/` is called with `"/users"`. What is requested?**
`https://api.example.com/users` — a leading slash makes the reference absolute-path relative, so
the base's path is discarded and only the origin survives. The `/v2` prefix vanishes. Strip
leading slashes in the wrapper.

**★ And with base `https://api.example.com/v2` (no trailing slash) called with `"users"`?**
`https://api.example.com/users`. Without the trailing slash the base's last segment is treated
as a file name and replaced. Always normalise the base to end with `/`.

**★ Why branch on `Content-Type` instead of always calling `.json()`?**
Because a proxy's 502 page, a CDN maintenance page, an SPA fallback, or a plain-text health check
all arrive at an endpoint that "always returns JSON". Branching degrades gracefully instead of
throwing a parse error that names the wrong layer.

**★ Why `includes("json")` rather than an equality check?**
Real headers carry parameters (`; charset=utf-8`) and suffix types (`application/problem+json`,
`application/vnd.api+json`). Equality rejects exactly the APIs that send structured errors.

**Why should the client be a factory?**
Tests need a mock base, apps often talk to more than one API, and SSR needs an absolute base.
A singleton reading a global serves none of the three.

**What is wrong with `{ method: "GET", ...opts }` in a method helper?**
The caller's options win, so `api.get(path, { method: "POST" })` silently issues a `POST`. Put
the helper's `method` last.

---

← [01 · What fetch leaves you](./01-what-fetch-leaves-you.md) · [Topic index](./README.md) ·
Next → [03 · Headers and bodies](./03-headers-and-bodies.md)
