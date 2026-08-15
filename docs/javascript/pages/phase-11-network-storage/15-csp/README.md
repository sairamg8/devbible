---
title: "15 · Content Security Policy"
sidebar_label: "Overview"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Content-Security-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy), [CSP guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP), [`SecurityPolicyViolationEvent`](https://developer.mozilla.org/en-US/docs/Web/API/SecurityPolicyViolationEvent). Documentation-validated; **no timings**.

**CSP is the browser refusing to run code you did not authorise.** It is a response header,
so it is not JavaScript — but it lands entirely on JavaScript, because what a strict policy
forbids is inline script, inline handlers, `javascript:` URLs and `eval`.

🔴 **The point of it is that it cannot tell your inline script from an injected one.** That
is why a good policy breaks a badly-structured app, and why the fix is always a nonce or a
hash rather than `'unsafe-inline'`.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What a policy breaks](./01-what-a-policy-breaks.md)** | Header vs `<meta>` vs report-only; the directive groups, and 🔴 **`connect-src` governing `fetch`, `WebSocket` and `EventSource`**; `default-src` as a fallback and **the nine directives that never fall back**; the four things blocked from JavaScript's side; why a **domain allow-list is weak**; rolling out with report-only and the `securitypolicyviolation` event |
| 2 | **[Nonces, hashes and `strict-dynamic`](./02-nonces-and-strict-dynamic.md)** | Making a strict policy and a working app coexist — per-response nonces and why static HTML cannot carry one; hashes for build-time-known scripts; what `'strict-dynamic'` actually trusts and what it gives up; the migration order; and Trusted Types |

## The policy worth memorising

```http
Content-Security-Policy:
  script-src 'nonce-{RANDOM}' 'strict-dynamic';
  object-src 'none';
  base-uri 'none';
```

**Three lines, and the last two are there because `object-src` and `base-uri` do not fall
back to anything.**

## Phase gate

You are done with this topic when you can say **why `'unsafe-inline'` defeats the purpose of
a policy**, and **why a nonce must change on every response**.

## Where this connects

- [05 · CORS from the client side](../05-cors-client-side/README.md) — CORS decides what you may *read*; CSP decides what you may *load and run*
- [13 · WebSocket](../13-websocket/01-connecting.md) — `connect-src` is the only browser-side control over where a socket may connect
- [14 · Same-origin and `postMessage`](../14-same-origin-and-postmessage/README.md) — `'self'` means that origin tuple exactly
- [Phase 9 · 06 · Sanitising HTML](../../phase-9-dom/06-sanitising-html/README.md) — the first line of defence; CSP is the second

---

Start → [1 · What a policy breaks](./01-what-a-policy-breaks.md)
