---
title: "03.2 · Failing well"
sidebar_label: "02 · Failing well"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After), [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static), [`navigator.onLine`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine), [`Window: online` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event), [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause). Documentation-validated; **no timings**.

**The client's real job is turning many kinds of failure into a few the UI can act on.** Without
that, every call site ends up parsing error messages, and the UI grows a branch per endpoint.

## The four outcomes a call site should see

🔴 **Reduce everything to these**, and the UI's error handling becomes finite:

| Outcome | Means | UI |
|---|---|---|
| **Success** | it worked | render |
| **Rejected input** (4xx, not 401/408/429) | the request was wrong | show the field errors — retrying cannot help |
| **Try again** (network, timeout, 408, 429, 5xx) | transient | retry affordance, or automatic |
| **Not you any more** (401 after refresh, 403) | auth or permission | re-authenticate, or say "not allowed" |

⚠️ **Cancellation is not in the table because it is not an outcome** — an `AbortError` means the
application superseded the request, and the UI shows nothing at all.

```js
export function classify(err) {
  if (err.name === "AbortError") return "cancelled";
  if (err.name === "TimeoutError" || err.name === "TypeError") return "retry";
  if (err instanceof HttpError) {
    if (err.status === 401 || err.status === 403) return "auth";
    if (err.status === 408 || err.status === 429 || err.status >= 500) return "retry";
    return "input";
  }
  return "unknown";                                   // 🔴 a real bug — do not swallow it
}
```

🔴 **The `unknown` branch matters.** A `TypeError: cannot read properties of undefined` from your
own response-parsing code must **not** be classified as a network failure and silently retried —
that hides a real bug behind an infinite retry.

## Errors that keep their cause

```js
class HttpError extends Error {
  constructor(status, body, url, { cause } = {}) {
    super(`HTTP ${status} for ${url}`, { cause });
    this.name = "HttpError";
    this.status = status;
    this.body = body;
    this.url = url;
  }
}
```

**`Error.cause`** preserves the original error when you wrap — `new Error("Checkout failed", {
cause: err })` keeps the `HttpError` and its status reachable, and modern devtools display the
chain. ⚠️ **Wrapping without `cause` destroys the diagnosis** and is the most common way a useful
error becomes "something went wrong".

## Backoff that respects the server

From [Phase 11 · 03 · 06](../../phase-11-network-storage/03-fetch-wrapper/06-retries.md): backoff,
jitter, and `Retry-After` — MDN describes it as indicating *how long the user agent should wait
before making a follow-up request*.

🔴 **Two details specific to a storefront:**

- **`Retry-After` has two legal forms** — delay-seconds and an HTTP date — and parsing a date with
  `Number()` gives `NaN`, so `setTimeout(NaN)` fires **immediately**. The polite backoff becomes
  the fastest possible retry against a server that just asked you to slow down.
- **Jitter is not decoration.** A checkout API that restarts has every client failing at the same
  instant; a fixed delay brings them all back simultaneously and re-breaks it.

⚠️ **And cap the total.** Three attempts over ~4 seconds is a retry; ten over two minutes is a hung
page with no feedback. **Surface a "still trying" state after the first retry** rather than a
spinner that never changes.

## Offline

```js
window.addEventListener("online", () => retryQueuedRequests());
window.addEventListener("offline", () => showOfflineBanner());
```

⚠️ **`navigator.onLine` is not a connectivity check.** It reports whether the device has *a network
interface*, not whether your API is reachable — a captive portal, a VPN or a dead upstream all read
as online. **`true` is not a promise; `false` is reliable.** Use it to *stop trying* and to trigger
a retry on `online`, never as proof that a request will succeed.

**The useful pattern is: on a network failure, show a banner and retry when `online` fires** — it
turns "everything is broken" into "you are offline", which is a completely different user
experience for the same failure.

## What to report, and what not to

🔴 **Report:** the status, the request id, the endpoint (not the full URL if it carries ids), the
classification, and the retry count. That is enough to find the server-side log line.

🔴 **Do not report:** the request body, the response body, headers, or anything from the URL's
query string. **They contain tokens, addresses and payment details**
([Phase 12 · 02 · 01](../../phase-12-browser-platform/02-client-side-security/01-the-trust-boundary.md)),
and an error tracker is a third party.

⚠️ **Do not report cancellations or offline errors as exceptions.** They are the normal operation of
the app, and reporting them buries the real errors under noise — which is how a team stops reading
its error tracker.

## Degrading rather than blanking

The storefront rule: 🔴 **one failed widget must not blank the page.** A failed recommendations
call should leave the product visible; only the product fetch itself is fatal to that page.

That means **the error boundary is per-region, not per-page**, and each region needs:

- **a retry affordance** for `retry`-class errors,
- **a message that names the region** ("Recommendations are unavailable"), not a generic banner,
- **a fallback** where one exists — cached data, a simpler view, or nothing at all.

⚠️ **"Nothing at all" is a legitimate answer for a non-essential widget** — silently omitting
recommendations is better than an error box that the user can do nothing about.

## Gotchas

**Symptom:** Every call site parses error messages
**Cause:** The client throws untyped errors.
**Fix:** A typed error and a `classify` function returning a small fixed set.

**Symptom:** A bug in the response parser is retried forever
**Cause:** Unknown errors classified as transient.
**Fix:** An explicit `unknown` class that is never retried.

**Symptom:** A wrapped error loses its status
**Cause:** Re-thrown without `cause`.
**Fix:** `new Error(msg, { cause: err })`.

**Symptom:** A 429 is retried immediately
**Cause:** `Retry-After` in HTTP-date form parsed with `Number()` → `NaN` → `setTimeout(NaN)`.
**Fix:** Parse both forms.

**Symptom:** A recovering API is knocked over by its own clients
**Cause:** Fixed-delay retries synchronised by the outage.
**Fix:** Backoff **plus jitter**.

**Symptom:** A spinner that never resolves
**Cause:** Too many retries with no user-visible state change.
**Fix:** Cap the total, and show "still trying" after the first retry.

**Symptom:** Requests fail while `navigator.onLine` is `true`
**Cause:** It reports an interface, not reachability — captive portals and VPNs read as online.
**Fix:** Treat `true` as unproven; `false` is reliable.

**Symptom:** The error tracker is full of `AbortError`
**Cause:** Cancellations reported as exceptions.
**Fix:** Do not report normal operation — it buries the real errors.

**Symptom:** A token appears in the error tracker
**Cause:** The request body, headers or query string were attached.
**Fix:** Report the status, endpoint, request id and classification only.

**Symptom:** One failed widget blanks the page
**Cause:** A page-level error boundary.
**Fix:** Per-region boundaries with per-region messages and fallbacks.

## Interview questions

**★ How many kinds of failure should a call site see?**
Four: rejected input, try again, not-you-any-more, and unknown — plus cancellation, which is not an
outcome and shows nothing. Reducing everything to that set is what stops the UI growing a branch
per endpoint.

**★ Why does the `unknown` class matter?**
Because a `TypeError` from your own parsing code must not be treated as a network failure and
retried — that hides a real bug behind an infinite retry loop. Unknown errors surface; they do not
retry.

**★ What does `Error.cause` buy you?**
It preserves the original error when wrapping, so a `HttpError`'s status is still reachable from a
higher-level "Checkout failed" and devtools show the chain. Wrapping without it is the most common
way a diagnosable error becomes "something went wrong".

**★ What is the trap in `Retry-After`?**
It has two legal forms — delay-seconds and an HTTP date. Parsing the date form with `Number()`
yields `NaN`, and `setTimeout(NaN)` fires **immediately**, so the polite backoff becomes the
fastest possible retry against a server that just asked you to wait.

**★ Can you trust `navigator.onLine`?**
Only when it is `false`. `true` means the device has a network interface, not that your API is
reachable — captive portals, VPNs and dead upstreams all read as online. Use it to stop trying and
to trigger a retry on the `online` event.

**★ What do you send to an error tracker?**
Status, endpoint, request id, classification and retry count — enough to find the server log line.
**Never** the request or response body, headers, or query string: they carry tokens, addresses and
payment details, and the tracker is a third party.

**How do you stop one failed call blanking the page?**
Per-region error boundaries with region-specific messages, a retry affordance for transient errors,
and a fallback — including "render nothing", which is the right answer for a non-essential widget.

---

← [01 · Composing the client](./01-composing-the-client.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
