---
title: "13 · What belongs on the server instead"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Website security](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/First_steps/Website_security), [Client-side form validation](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation), [`Set-Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie), [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP). Documentation-validated; **no timings and no console output**.

The syllabus row is *the honest list of things the client must never be trusted with* — and it
closes the Understand tier of this phase deliberately. Everything before it was capability; this
is the limit.

🔴 **Anything the browser computes, the user can change.** Not a determined attacker — anyone with
DevTools, a proxy or `curl`. The front end is a convenience running on someone else's computer,
and the server has to treat every request as though it came from a stranger, because sometimes it
did.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The trust boundary](./01-the-trust-boundary.md)** | Why obfuscation is not a control; the forged-assumption table; **the honest list** — authn, authz, validation, prices, coupons, inventory, business rules, secrets, rate limits, ids, time, uploads, entitlements, field visibility — as what the client *may* do versus what the server *must*; "never send and hide"; why client validation is a UX feature; why there is no secret in a bundle; the headers only a server can set |
| 02 | **[Getting it right in practice](./02-getting-it-right.md)** | One shared schema enforced twice; posting intent rather than conclusions; optimistic UI that adopts the server's answer; idempotency keys generated once per intent; the BFF proxy and how it becomes an open proxy; sessions, `HttpOnly` and what logout means; what the client legitimately owns; a per-feature checklist |

## Three facts worth carrying out of this topic

- **Post intent, not conclusions.** Items and quantities, never totals — the server prices the
  order from its own data and the UI renders what comes back.
- **"Send everything and hide it in the UI" is a data leak.** The response is in the network tab,
  the logs and any cache that touched it.
- **A well-built client is not a thin one.** It owns the entire experience and none of the
  decisions.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [02 · Client-side security](../02-client-side-security/README.md) — XSS, dependencies, and why
  a token in `localStorage` is one injected script away from gone
- [10 · WebCrypto](../10-webcrypto/README.md) — the same boundary, applied to keys: client-side
  crypto cannot protect you from the server that ships the script
- [12 · Feature detection and progressive enhancement](../12-feature-detection/README.md) — what
  the user gets when the client-side layer does not run at all
- [Phase 11 · 05 · CORS, client-side](../../phase-11-network-storage/05-cors-client-side/README.md)
  — the server-decided policy the browser merely enforces
- **Express** — the server half of every row in this table lives in the
  [Express bible](/docs/expressjs)

---

Start → [01 · The trust boundary](./01-the-trust-boundary.md)
