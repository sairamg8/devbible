---
title: "10 · Global error handling"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Window: error` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event), [`Window: unhandledrejection` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event), [`Window: rejectionhandled` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/rejectionhandled_event), [`ErrorEvent`](https://developer.mozilla.org/en-US/docs/Web/API/ErrorEvent), [`crossorigin`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/crossorigin), [`Navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon), [`securitypolicyviolation`](https://developer.mozilla.org/en-US/docs/Web/API/Document/securitypolicyviolation_event) — and Node.js [`process` § `uncaughtException`](https://nodejs.org/api/process.html#event-uncaughtexception), [§ `unhandledRejection`](https://nodejs.org/api/process.html#event-unhandledrejection). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *`window.onerror`, `unhandledrejection`, `error` events, and shipping errors
to a reporter*.

🔴 **A global handler does not handle anything — it reports.** Its job is to guarantee that no
failure reaches a user without also reaching you, which means covering every channel and getting
the report out even as the page closes.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The handlers](./01-the-handlers.md)** | The browser's **four non-overlapping channels** — `error`, `unhandledrejection`, capture-phase resource errors, `securitypolicyviolation`; `onerror`'s legacy signature and the two ways to suppress; `rejectionhandled` and false positives; **"Script error." and the two things `crossorigin` needs**; Node's `uncaughtException` and `unhandledRejection` and why you exit; installing first, defensively; and what these handlers can never see |
| 02 | **[Shipping errors to a reporter](./02-shipping-to-a-reporter.md)** | What to send — including the release id and correlation id everyone forgets; what must never be sent, and scrubbing on the way out; dedup, rate limiting and honest sampling; `sendBeacon` / `keepalive` flushed on `visibilitychange`; source maps uploaded per release; why the reporter must never throw or block; and alerting on rates rather than counts |

## Four facts worth carrying out of this topic

- **Four channels, no overlap.** A rejected promise never fires `error`; a failed `<img>` never
  bubbles; a blocked script fires neither.
- **"Script error." needs both halves** — `crossorigin="anonymous"` on the tag *and*
  `Access-Control-Allow-Origin` on the response.
- **`uncaughtException` is not recovery.** Node's own docs say the stack has already unwound:
  report, flush, exit.
- **The reporter must never throw**, or the global handler re-enters it and the page loops.

## Phase gate

You can list every channel an error can arrive on in your application — including Workers — say
which of them your project currently listens to, and describe what leaves the browser when one
fires and what is deliberately stripped from it.

## Where this connects

- [Phase 7 · 08 · Unhandled rejections](../../phase-7-async/08-error-handling/03-unhandled-rejections.md)
  — when a rejection is declared unhandled, and why `rejectionhandled` exists
- [09 · Results versus exceptions](../09-failing-well/02-results-versus-exceptions.md) — why a
  global handler cannot compensate for an empty `catch`
- [08 · Cause chains and boundaries](../08-custom-error-classes/02-cause-chains-and-boundaries.md)
  — the chain the report flattens, and why `JSON.stringify(err)` is `{}`
- [05 · Code splitting](../05-dynamic-import/02-code-splitting.md) — chunk-load failures reported
  as their own class
- [Phase 10 · 09 · Visibility and lifecycle](../../phase-10-events/09-scroll-resize-visibility/02-visibility-and-lifecycle.md)
  — flushing on `visibilitychange` instead of `unload`
- **12 · Finding a leak** · **13 · Bundlers and the build** *(not written yet)* — source maps and
  release ids come from there

---

Start → [01 · The handlers](./01-the-handlers.md)
