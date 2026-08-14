---
title: "01.1 · The critical surprise"
sidebar_label: "01 · The critical surprise"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch), [`Response.ok`](https://developer.mozilla.org/en-US/docs/Web/API/Response/ok), [`Response.clone()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/clone). Documentation-validated.

**A 404 is a successful `fetch`.** This is the one behaviour that catches everyone, and it
follows from a deliberate design decision rather than an oversight.

MDN:

> "The promise returned by `fetch()` will reject on **some** errors, such as a **network error
> or a bad scheme**. However, **if the server responds with an error like `404`, then
> `fetch()` fulfills with a `Response`**, so we have to check the status before we can read
> the response body."

🔴 **The promise's state answers "did the HTTP exchange happen?", not "did it go well?"** The
server was reached, it replied, the reply arrived — from the transport's point of view, that
is a success. What the reply *says* is your problem.

```js
const res = await fetch("/api/thing");   // 500 from the server
// no throw. res.status === 500, res.ok === false
```

This is exactly the inversion that produces "the error handling never runs":

```js
try {
  const res = await fetch(url);
  const data = await res.json();   // ⚠️ on a 500, this parses the error page
  render(data);
} catch (e) {
  showError();                     // only runs for network failures
}
```

## Check `response.ok`

MDN's pattern:

```js
async function getData() {
  const url = "https://example.org/products.json";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    // …
  } catch (error) {
    console.error(error.message);
  }
}
```

`response.ok` is `true` for statuses in the 200–299 range and `false` otherwise. **Throwing on
`!ok` is what makes `fetch` behave the way people already assume it behaves**, and it is why
essentially every codebase ends up with a wrapper — [03 · A `fetch` wrapper worth
reusing](../README.md).

Two refinements worth building in from the start:

```js
if (!res.ok) {
  const body = await res.text();                 // the server usually explains
  throw new HttpError(res.status, res.statusText, body);
}
```

- **Read the body on failure.** An API's error response is normally the most useful thing in
  the incident, and discarding it leaves you with a bare status code.
- **Throw a typed error** ([Phase 8 · 03](../../phase-8-modules-errors/03-error-and-subclasses/README.md)),
  so callers can branch on `instanceof` or a `status` field rather than parsing a message.

## What *does* reject

The short list — MDN names *"a network error or a bad scheme"*:

- The request never completed: DNS failure, connection refused, the user went offline.
- The request was **blocked**: CORS, a Content Security Policy, an extension.
- The request was **aborted** via an `AbortController` (a `DOMException` named `AbortError`).
- A malformed URL or unsupported scheme.

🔴 **A CORS failure rejects, and the rejection reason is deliberately vague.** The browser
tells your JavaScript almost nothing — usually just `TypeError: Failed to fetch` — because
revealing the real response would itself defeat the same-origin policy. **The detail is in the
console, not in the error object**, which is why "read the console error" is the actual advice
in [05 · CORS from the client side](../05-cors-client-side/README.md).

So `TypeError: Failed to fetch` means "the request did not produce a usable response", and the
cause is nearly always CORS, offline, or a blocked request — never a 4xx or 5xx.

## The defaults

MDN's list, and each one is a decision you inherit silently:

| | Default |
|---|---|
| method | `GET` |
| credentials | **`same-origin`** — "only send and include credentials for same-origin requests" |
| mode | `cors` — "uses CORS mechanism for cross-origin requests" |

**`credentials: "same-origin"` is the one that surprises people.** A cross-origin request sends
**no cookies** by default, so an authenticated API on another origin returns 401 while the same
URL works when pasted into the address bar. Opting in is explicit:

```js
fetch(url, { credentials: "include" });   // send cookies cross-origin
```

…and it requires the server to cooperate, which is where wildcard-with-credentials becomes an
issue — again [05](../README.md).

## The body can be read once

MDN:

> "This means it's **not possible to read the same response (or request) body more than
> once**"

```js
const data = await res.json();
const text = await res.text();     // ⚠️ throws — the body is already consumed
```

The body is a stream. Once `json()`, `text()`, `blob()`, `arrayBuffer()` or `formData()` has
drained it, it is gone. To read it twice, clone **before** reading:

```js
const response1 = await fetch(url);
const response2 = response1.clone();

const result1 = await response1.json();
const result2 = await response2.json();
```

The practical version of this: a wrapper that logs the raw text on failure and parses JSON on
success **must clone first**, or the log consumes the body the parser needs.

## Gotchas

**Symptom:** `try`/`catch` around `fetch` never catches a 500
**Cause:** MDN: *"if the server responds with an error like `404`, then `fetch()` fulfills"*.
Only network-level failures reject.
**Fix:** `if (!res.ok) throw …` explicitly.

**Symptom:** `res.json()` throws `SyntaxError` on an error response
**Cause:** The server returned an HTML error page, and you parsed it as JSON because `!ok` was
never checked.
**Fix:** Check `ok` first; read `text()` on failure.

**Symptom:** `TypeError: Failed to fetch` with no detail
**Cause:** A network-level failure — usually **CORS**, offline, or a blocked request. The
browser withholds detail on purpose.
**Fix:** Read the **console**, not the error object.

**Symptom:** A cross-origin authenticated request returns 401, but works in the address bar
**Cause:** `credentials` defaults to **`same-origin`**, so no cookies are sent cross-origin.
**Fix:** `credentials: "include"`, plus server-side CORS cooperation.

**Symptom:** `Body has already been read` / `body stream already read`
**Cause:** The body is a stream and can be consumed once.
**Fix:** `res.clone()` **before** the first read.

**Symptom:** An abort surfaces as a generic error in the UI
**Cause:** Aborting rejects with a `DOMException` named `AbortError`.
**Fix:** Check `e.name === "AbortError"` and treat it as a cancellation, not a failure.

## Interview questions

**★ Does `fetch` reject on a 404?**
No. MDN: *"if the server responds with an error like `404`, then `fetch()` fulfills with a
`Response`"*. The promise answers *"did the HTTP exchange happen?"*, not *"did it go well?"*
Check `response.ok` and throw yourself.

**★ What does make `fetch` reject?**
Network-level failures — *"a network error or a bad scheme"*: DNS or connection failures,
being offline, a **CORS** or CSP block, an abort, or a malformed URL. Never a 4xx or 5xx.

**★ Why is `TypeError: Failed to fetch` so uninformative?**
Because the failure is usually CORS, and telling your JavaScript what the response actually
was would defeat the same-origin policy. The detail goes to the **console** instead.

**★ Why does a cross-origin authenticated request fail when the same URL works in the browser
address bar?**
`credentials` defaults to **`same-origin`**, so cookies are not sent cross-origin. You need
`credentials: "include"` and matching server-side CORS configuration.

**★ Why can't you call both `res.json()` and `res.text()`?**
The body is a stream — MDN: *"not possible to read the same response (or request) body more
than once"*. Use `res.clone()` before the first read; this is why a wrapper that logs the raw
body on failure must clone.

**What should a failure path do with the response body?**
Read it. An API's error body is usually the most useful thing in the incident, and throwing a
typed error carrying the status and that body is what makes callers able to branch without
parsing messages.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
