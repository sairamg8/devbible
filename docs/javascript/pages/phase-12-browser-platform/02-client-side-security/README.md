---
title: "02 · Client-side security"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Window.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage), [`rel="noopener"`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/noopener), [`X-Frame-Options`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options), [Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity), [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP), [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy). Documentation-validated.

**A check that runs in the browser is a user-experience feature, not a security control.**
Everything in this topic follows from that sentence — what the client can never be trusted with,
which holes you deliberately punch in the same-origin policy, and how much of the code on your
page you did not write.

**XSS itself lives in [Phase 9 · 06 · Sanitising HTML](../../phase-9-dom/06-sanitising-html/README.md)**
— the sinks, the sanitisers and Trusted Types. This topic is everything else on the client's
security surface.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The trust boundary](./01-the-trust-boundary.md)** | Why client validation filters nothing; **send inputs, not conclusions** (the `{ total: 4.99 }` checkout); why there is no secret in a bundle and obfuscation is not a control; hidden UI as UX rather than authorisation; what CORS does and does **not** protect; and the honest table of what the client must never be trusted with |
| 2 | **[Other windows and frames](./02-windows-and-frames.md)** | MDN's `postMessage` rules taken one clause at a time — never `"*"`, always check `origin`/`source`, and **still validate the payload**; `window.opener` and the tab-nabbing navigation it allows; 🔴 **`target="_blank"` is implicitly `noopener` now but `window.open()` is not**; clickjacking and why the fix is a header (`frame-ancestors`, `X-Frame-Options`) rather than client code; and the `sandbox` combination that undoes itself |
| 3 | **[Storage, dependencies and depth](./03-storage-and-dependencies.md)** | The token-storage decision as **XSS versus CSRF**, stated honestly, with the point that storage choice is mitigation and not a fix; dependencies as arbitrary code in your origin, and the five practices that actually help; third-party `<script src>` and **SRI** — including why `crossorigin` is mandatory and why SRI cannot pin a "latest" URL; and CSP/Trusted Types as the layer that assumes everything else failed |

## The three sentences to keep

1. **Send inputs, not conclusions.** Every authorisation and every price is recomputed on the
   server, per request.
2. **Never `postMessage(data, "*")`, always check `event.origin`, and validate the payload
   anyway.**
3. **Storage choice trades XSS exposure for CSRF exposure** — it does not remove either, and it
   is not a substitute for preventing sinks.

## Phase gate

You are done with this topic when you can say what client-side validation is *for*, explain what
an attacker gains from `window.opener`, write a `message` listener with all three checks, and
state the token-storage trade-off without reaching for a slogan.

## Where this connects

- [Phase 9 · 06 · Sanitising HTML](../../phase-9-dom/06-sanitising-html/README.md) — XSS, the sinks, and Trusted Types
- [Phase 11 · 05 · CORS from the client side](../../phase-11-network-storage/05-cors-client-side/README.md) — what CORS is and is not protecting
- [Phase 11 · 03 · 04 · Auth and the 401 refresh](../../phase-11-network-storage/03-fetch-wrapper/04-auth-and-refresh.md) — where the storage decision lands in code
- [01 · DevTools beyond `console.log`](../01-devtools/README.md) — the tools that make "the bundle is public" concrete

---

Start → [01 · The trust boundary](./01-the-trust-boundary.md)
