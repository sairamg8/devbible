---
title: "03.1 · What fetch leaves you with"
sidebar_label: "01 · What fetch leaves you"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch), [`Response.ok`](https://developer.mozilla.org/en-US/docs/Web/API/Response/ok), [`Response.clone()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/clone), [`Response.status`](https://developer.mozilla.org/en-US/docs/Web/API/Response/status). Documentation-validated.

**A `fetch` wrapper exists to make one decision once.** Every call site otherwise repeats the
same four steps — build the URL, check `ok`, parse the body, decide what to throw — and the
third and fourth are the ones people skip.

## What the wrapper is actually for

`fetch` is deliberately low-level. It does not:

- **throw on 4xx or 5xx** — [01 · The critical surprise](../01-fetch/01-the-critical-surprise.md);
- **parse anything** — you call `res.json()` yourself, and it throws `SyntaxError` when the
  server sent HTML;
- **join URLs** — you concatenate strings and get `//` or a missing `/`;
- **carry auth**, a timeout, or a retry policy.

None of that is an oversight. It is the same design as `XMLHttpRequest` before it: a transport,
not a client. **The wrapper is the client**, and writing one is a standard interview exercise
precisely because it forces you to say out loud what `fetch` does not do.

The failure a wrapper prevents is not "verbose code". It is this:

```js
// ❌ at 40 call sites
const res = await fetch("/api/users/" + id);
const user = await res.json();      // 404 → SyntaxError: Unexpected token '<'
```

The 404 arrived fine, `res.json()` tried to parse the server's HTML error page, and the stack
trace you get names **JSON parsing** — three layers away from the real problem, which is that
nobody checked `res.ok`.

## Version 1 — the three lines that matter

```js
export async function request(path, options = {}) {
  const res = await fetch(path, options);

  if (!res.ok) throw new HttpError(res.status, await res.text());

  return res.status === 204 ? null : res.json();
}
```

Small as it is, that already fixes the common failure: **`!res.ok` is checked before the body
is parsed**, and the thrown error carries the status. Everything in the rest of this topic is
refinement of these three lines, not replacement.

Note the `204` guard. A `204 No Content` has an empty body, and `res.json()` on an empty body
rejects with a `SyntaxError`. `DELETE` endpoints return `204` more often than any other, which
is why "delete works but the promise rejects" is such a common report.

## A typed error, not a string

```js
export class HttpError extends Error {
  constructor(status, body, url) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
    this.url = url;
  }
}
```

Subclassing `Error` is covered in
[Phase 8 · 03 · `Error` and its subclasses](../../phase-8-modules-errors/03-error-and-subclasses/README.md);
the point here is **what the caller can now do**:

```js
try {
  await request("orders", { method: "POST", body: … });
} catch (err) {
  if (err instanceof HttpError && err.status === 409) return showConflictDialog(err.body);
  if (err instanceof HttpError && err.status >= 500) return showRetryBanner();
  throw err;                                  // network error, or a real bug
}
```

🔴 **Throwing a string, or `new Error(res.statusText)`, throws the status away** — and the
status is the only thing that lets a caller distinguish "your input was wrong" (422) from
"try again later" (503) from "you are logged out" (401).

`statusText` is worse than it first looks. It is the reason phrase from the HTTP/1.1 status
line, and **HTTP/2 removed reason phrases entirely** — so against an HTTP/2 server it is
routinely the empty string. An error message that is sometimes `"Not Found"` and sometimes `""`
depending on the transport is not an error message.

**Keep the body.** For most APIs the useful message is in the response body — `{"error":
"email already registered"}` — and a wrapper that discards it forces every debugging session
into the network tab.

## Reading the error body without eating it

The response body is a stream you can read **once**
([01 · 01](../01-fetch/01-the-critical-surprise.md)). So a wrapper that wants to *log* the raw
text and *also* hand a parsed object to the caller has to `clone()` first:

```js
if (!res.ok) {
  const copy = res.clone();                 // clone BEFORE the first read
  let body;
  try { body = await res.json(); }          // most APIs send JSON errors
  catch { body = await copy.text(); }       // …but not all. HTML, or empty.
  throw new HttpError(res.status, body, res.url);
}
```

MDN is explicit about the ordering constraint:

> "`clone()` throws a `TypeError` if the response body has already been used."

So the clone must be taken **before** `res.json()` is attempted, not in the `catch` after it
failed. That is the whole trick, and getting it backwards produces a confusing
`TypeError: Response body is already used` that masks the original parse failure — you end up
debugging the error handler instead of the error.

⚠️ **Do not clone unconditionally.** MDN warns about the cost:

> "If only one cloned branch is consumed, then the entire body will be buffered in memory."

> "Therefore, `clone()` is one way to read a response twice in sequence, but you should not use
> it to read very large bodies in parallel at different speeds."

Cloning every response so a logger *might* use it means every large download is buffered twice.
Clone on the **error path only**, where bodies are small and the second read actually happens.

## Gotchas

**Symptom:** `SyntaxError: Unexpected token '<'` from `res.json()`
**Cause:** The response was an HTML error page; nobody checked `res.ok`.
**Fix:** Check `res.ok` before parsing anything.

**Symptom:** `SyntaxError` on a `DELETE` that clearly worked
**Cause:** `204 No Content` has an empty body and `res.json()` cannot parse `""`.
**Fix:** Return `null` for `204`.

**Symptom:** `TypeError: Response body is already used` while handling an error
**Cause:** `clone()` was called after the first read attempt.
**Fix:** Clone **before** reading. MDN: *"`clone()` throws a `TypeError` if the response body
has already been used."*

**Symptom:** The error message is empty
**Cause:** The wrapper used `res.statusText`, and HTTP/2 has no reason phrases.
**Fix:** Use the status number and the response body.

**Symptom:** A caller cannot tell a 422 from a 500
**Cause:** The wrapper threw a plain `Error` with a string message.
**Fix:** A typed `HttpError` carrying `status`, `body` and `url`.

**Symptom:** Memory grows on large downloads through the wrapper
**Cause:** Every response is cloned "in case" something logs it, and only one branch is read.
**Fix:** Clone on the error path only — MDN: *"the entire body will be buffered in memory."*

**Symptom:** The API's helpful error text never reaches the UI
**Cause:** The wrapper threw before reading the body, or read only `res.status`.
**Fix:** Read the body on the failure path and attach it to the error.

## Interview questions

**★ Why does almost every codebase end up with a `fetch` wrapper?**
Because `fetch` is a transport, not a client: it does not throw on 4xx/5xx, does not parse,
does not join URLs, and carries no auth, timeout or retry policy. Each of those is a decision
that should be made once rather than at every call site — and the `res.ok` check is the one
that gets skipped when it is not centralised.

**★ What is the minimum a wrapper must do?**
Check `res.ok` before reading the body, and throw an error that carries the **status** and the
**response body**. Everything else — base URL, headers, timeouts, retries — is convenience built
on top of those two.

**★ Why not throw `new Error(res.statusText)`?**
`statusText` is the HTTP/1.1 reason phrase, and HTTP/2 removed reason phrases, so it is
frequently empty. It also discards the status code — the only thing that lets a caller
distinguish "fix your input" from "retry later" from "log in again".

**★ Your wrapper logs the raw error body and also returns a parsed object. What breaks, and why?**
The body is a read-once stream, so the second read fails. You must `res.clone()` **before** the
first read — MDN: *"`clone()` throws a `TypeError` if the response body has already been used."*
And you should clone only on the error path, because *"if only one cloned branch is consumed,
then the entire body will be buffered in memory."*

**★ A `DELETE` succeeds but the promise rejects with `SyntaxError`. Why?**
It returned `204 No Content`. `res.json()` on an empty body throws. Return `null` for `204`.

**Why does the stack trace point at JSON parsing when the real problem is a 404?**
Because the 404 was a *successful* fetch. The first thing that actually throws is the parser
meeting an HTML error page, three layers away from the missing `ok` check.

---

[Topic index](./README.md) · Next → [02 · URLs, parsing and the client surface](./02-urls-and-parsing.md)
