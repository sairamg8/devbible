---
title: "1 · What it still does"
sidebar_label: "1 · What it still does"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`XMLHttpRequest`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest), [`XMLHttpRequest.readyState`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/readyState), [`XMLHttpRequest.upload`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload), [`XMLHttpRequest.responseType`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseType), [`ProgressEvent`](https://developer.mozilla.org/en-US/docs/Web/API/ProgressEvent), [Synchronous XHR](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/send). Documentation-validated; **no timings**.

**`XMLHttpRequest` is the previous generation, and MDN says so** — the Fetch API is the
recommended interface for new work ([01 · `fetch`](../01-fetch/README.md)). Despite the name
it "can retrieve any type of data, not just XML".

🔴 **Know-tier: you need it for two reasons.** You will read it in existing code, and there is
**one thing `fetch` still cannot do** — report upload progress.

## The shape

```js
const xhr = new XMLHttpRequest();
xhr.open("POST", "/api/items");                 // 1 · configure
xhr.setRequestHeader("Content-Type", "application/json");  // ⚠️ only after open()
xhr.responseType = "json";
xhr.timeout = 10_000;

xhr.addEventListener("load", () => use(xhr.response, xhr.status));
xhr.addEventListener("error", () => fail("network"));
xhr.addEventListener("timeout", () => fail("timeout"));
xhr.addEventListener("abort", () => {});
xhr.addEventListener("loadend", () => stopSpinner());   // always, whatever happened

xhr.send(JSON.stringify(body));                 // 2 · go
```

**`readyState` is the old, coarse state machine** — you will see it in code that predates the
event names above:

| Value | Name | Meaning |
|---|---|---|
| `0` | `UNSENT` | not yet opened |
| `1` | `OPENED` | `open()` called |
| `2` | `HEADERS_RECEIVED` | response headers received |
| `3` | `LOADING` | body downloading |
| `4` | `DONE` | complete |

⚠️ **`readyState === 4` means "finished", not "succeeded"** — a 404 and a 500 both reach it.
That is the same trap as `fetch`'s promise resolving for any HTTP status
([01 · `fetch`](../01-fetch/README.md)): the status has to be checked separately.

**`responseType`** decides what `xhr.response` is — `""`/`"text"`, `"json"`, `"blob"`,
`"arraybuffer"`, `"document"`. ⚠️ **Reading `xhr.responseText` when `responseType` is not text
or empty throws** — a common porting error.

## 🔴 The one thing `fetch` cannot do: upload progress

```js
xhr.upload.addEventListener("progress", (e) => {
  if (e.lengthComputable) setPercent((e.loaded / e.total) * 100);
});
```

**`xhr.upload` is a separate `XMLHttpRequestUpload` target**, and that separation is the whole
point: listening for `progress` on `xhr` itself gives you *download* progress, which for an
upload jumps straight to 100% when the response arrives.

⚠️ **`lengthComputable` must be checked** — without a known total, `e.total` is meaningless.

**This is why XHR survives in upload code**, and it is covered in the upload topic itself
([11 · 02](../11-uploading-files/02-sending-it.md)). Everything else in a modern codebase
should be `fetch`.

## Mapping it onto `fetch`

| XHR | `fetch` |
|---|---|
| `xhr.timeout` + `timeout` event | `AbortSignal.timeout()` ([08 · 01](../08-aborting-and-timing-out/01-the-controller-and-the-signal.md)) |
| `xhr.abort()` | `AbortController.abort()` |
| `xhr.withCredentials = true` | `credentials: "include"` |
| `xhr.setRequestHeader()` | `headers: { … }` |
| `xhr.responseType = "blob"` | `await response.blob()` |
| `load` / `error` events | promise resolve / reject |
| **`xhr.upload` progress** | **no equivalent** |
| streaming a response | `response.body` ([19 · 01](../19-streams/01-the-three-streams.md)) |

⚠️ **`error` fires only for network-level failures** in both APIs — an HTTP error status is a
successful transaction that carries a bad status code.

## Synchronous XHR — the one to recognise and delete

```js
xhr.open("GET", url, false);   // ⛔ third argument false = synchronous
xhr.send();
```

🔴 **Synchronous `XMLHttpRequest` on the main thread is deprecated**, and browsers warn about
it. It blocks everything — rendering, input, timers — until the response arrives, and it was
the original reason `sendBeacon` had to be invented
([20 · 01](../20-sendbeacon-keepalive/01-sending-on-the-way-out.md)).

**If you find it, it is almost always in an unload handler**, and the replacement is
`sendBeacon` or `fetch(..., { keepalive: true })` fired on `visibilitychange`.

## Gotchas

**Symptom → cause → fix.**

- **`InvalidStateError` from `setRequestHeader`** → called before `open()` → headers go
  between `open()` and `send()`.
- **`xhr.responseText` throws** → `responseType` is `"json"`/`"blob"`/`"arraybuffer"` → read
  `xhr.response` instead.
- **The success handler runs on a 404** → `readyState === 4` and the `load` event mean
  *finished*, not *succeeded* → check `xhr.status`.
- **The upload progress bar jumps straight to 100%** → the listener is on `xhr`, not
  `xhr.upload` → move it.
- **Progress percentages are `NaN`** → `lengthComputable` is `false`, so `e.total` is unusable
  → guard on it.
- **The page freezes during a request** → synchronous XHR → make it async; use `sendBeacon`
  for the unload case.
- **Cookies are not sent cross-origin** → `withCredentials` defaults to `false`, and the
  server must name a specific origin → set both ([05 · CORS](../05-cors-client-side/README.md)).
- **A ported `fetch` call lost its timeout** → `fetch` has no `timeout` option →
  `AbortSignal.timeout()`.

## Interview questions

**Is there any reason to use `XMLHttpRequest` today?** One: upload progress. `xhr.upload`
emits `progress` events that `fetch` has no equivalent for. Everything else is better served
by `fetch`.

**Why does upload progress need `xhr.upload` rather than `xhr`?** Because events on the
request object itself track the *download* of the response. The upload has its own event
target, and using the wrong one is why progress bars appear to jump to 100%.

**What does `readyState === 4` tell you?** That the request finished — not that it succeeded.
The HTTP status is separate, exactly as with `fetch`'s resolved promise.

**Why is synchronous XHR deprecated?** It blocks the main thread — rendering, input and
timers — until the response arrives. The legacy use case, sending data at unload, is what
`sendBeacon` and `keepalive` replaced.

**How do XHR's cancellation and timeout map onto `fetch`?** `abort()` becomes an
`AbortController`, and `xhr.timeout` becomes `AbortSignal.timeout()` — with the caveat that
the two produce differently-named `DOMException`s, `AbortError` and `TimeoutError`.

---

← [Overview](./README.md) · [Phase 11](../README.md)
