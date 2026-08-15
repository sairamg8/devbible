---
title: "02 · Getting it right in practice"
sidebar_label: "02 · Getting it right"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Client-side form validation](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation), [`Set-Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie), [`SameSite` cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie/SameSite), [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), [`Idempotency-Key` semantics — HTTP idempotent methods](https://developer.mozilla.org/en-US/docs/Glossary/Idempotent), [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch), [`Navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon). Documentation-validated; **no timings and no console output**.

Knowing the boundary is not the same as building across it well. The good version keeps the
snappy client experience *and* is correct when the client lies — and the two goals conflict less
often than people expect.

## One schema, two enforcement points

```js
// shared/order.schema.js — imported by the browser bundle AND the server
export const OrderSchema = { quantity: { type: 'integer', min: 1, max: 20 }, /* … */ };
```

**The client uses it for feedback; the server uses it as the decision.** Neither trusts the other,
and they cannot drift, because there is one definition. This is the single highest-value pattern
in the topic and it costs almost nothing in a JavaScript stack — it is also the reason validation
libraries built around a shared schema won.

⚠️ **Shared schema is not shared trust.** The server still runs it on the incoming payload; the
import does not mean "the client already checked".

## Post intent, not conclusions

```js
// ❌ the client decided
await fetch('/api/orders', { method: 'POST', body: JSON.stringify({ total: 4200, discount: 'SUMMER' }) });

// ✅ the client asked; the server decides
await fetch('/api/orders', { method: 'POST', body: JSON.stringify({
  items: [{ sku: 'A-1', quantity: 2 }], couponCode: 'SUMMER',
}) });
```

🔴 **The request carries what the user wants, never what the outcome should be.** Prices, totals,
tax, discount eligibility, permissions and inventory are conclusions — the server reaches them
from its own data and sends them back for display. A response that echoes the computed total is
what the UI should render, in preference to its own preview.

## Optimistic UI, reconciled

Optimism is a presentation choice, not a decision:

```js
addLocally(item);                                  // instant feedback
try {
  const server = await api.addToCart(item);        // the authority
  replaceLocal(server.cart);                       // 🔴 adopt the server's version wholesale
} catch (err) {
  rollback(item);
  show(err.message);
}
```

**Adopt the server's answer even when it agrees** — that is what keeps the two from drifting after
the tenth interaction. The failure mode to design for is not "the request failed" but "the request
succeeded and returned something different".

## Idempotency, because the network retries

A retried POST can charge twice. The standard shape is a client-generated key that the server uses
to deduplicate:

```js
const key = crypto.randomUUID();                    // stable across retries of THIS action
await fetch('/api/payments', { method: 'POST', headers: { 'Idempotency-Key': key }, body });
```

**Generate the key once per user intent, not per attempt** — a key regenerated on retry defeats
the entire mechanism. The server stores the key with the result and returns the same result for a
repeat. This is one of the few security-relevant things a client legitimately generates, and it
works because the *server* enforces the semantics.

## Keep secrets behind your own endpoint

```
browser → your API (holds the key, checks the session, rate-limits) → third-party API
```

The proxy — a "backend for frontend" — is where the key lives, where quotas are enforced and where
the response can be trimmed to what the client should see. It also gives you one place to add
caching, and it removes an entire class of CORS problems
([Phase 11 · 05 · CORS, client-side](../../phase-11-network-storage/05-cors-client-side/README.md)).

⚠️ **A proxy is not a licence to forward blindly.** If it accepts an arbitrary upstream URL or
arbitrary parameters, you have built an open proxy and an SSRF vector. Whitelist the operations it
supports.

## Sessions: what the browser holds

| | |
|---|---|
| **Session token** | an `HttpOnly`, `Secure`, `SameSite` cookie — script cannot read it |
| **CSRF defence** | `SameSite=Lax`/`Strict`, plus a token for cross-site flows that need it |
| **Logout** | the server invalidates; clearing client state alone leaves the session usable |
| **"Remember me"** | a server-side decision about lifetime, not a client-side flag |

🔴 **Logout that only clears `localStorage` is not logout.** If the credential is still valid at
the server, anyone holding a copy is still authenticated.

## What the client legitimately owns

The boundary is not "the client does nothing". It owns everything about the *experience*:

| The client owns | Why |
|---|---|
| Perceived speed — optimistic updates, skeletons, prefetch | it is the only thing that can react instantly |
| Presentation state — expanded rows, sort order, drafts | the server does not care |
| Input assistance — formatting, masks, live validation | instant, accessible, no round trip |
| Offline drafts and queued actions | IndexedDB plus a sync on reconnect |
| Rendering, accessibility, motion, focus | nothing else can ([11](../11-accessibility-from-javascript/README.md)) |
| Instrumentation of what the user experienced | only the client sees LCP, INP and CLS ([06 · 03](../06-performanceobserver/03-the-metrics.md)) |

**A well-built client is not a thin one.** It is one that owns the experience completely and owns
no decisions.

## A checklist for a feature

1. **What decision is being made?** If money, access, identity or data visibility — server.
2. **What would a forged request do?** Send the endpoint the worst payload you can think of, with
   `curl`, and check the response.
3. **Does the response contain more than the UI shows?** If so, the server is over-sending.
4. **Can this be replayed?** If so, an idempotency key or a nonce.
5. **What happens with JavaScript disabled or broken?** ([12 · Progressive enhancement](../12-feature-detection/02-progressive-enhancement.md))
6. **Where are the headers set?** CSP, cookie flags and CORS are server config, in review like
   everything else.

## Gotchas

**Symptom: the UI and the server disagree after a few actions.**
Cause — optimistic updates that never adopt the server's version.
Fix — replace local state with the response, even on success.

**Symptom: a customer was charged twice on a flaky connection.**
Cause — a retried POST with no idempotency key, or a key regenerated per attempt.
Fix — one key per user intent, stored and deduplicated server-side.

**Symptom: validation rules drift between client and server.**
Cause — two hand-written copies.
Fix — one shared schema, enforced independently on both sides.

**Symptom: the BFF proxy is being used to reach arbitrary hosts.**
Cause — it forwards a URL from the request.
Fix — a whitelist of operations; never take the upstream target from the client.

**Symptom: users remain logged in after "log out".**
Cause — only client state was cleared.
Fix — invalidate server-side; the cookie is not the session.

**Symptom: a feature is hidden in the UI but reachable by URL.**
Cause — authorisation implemented as rendering.
Fix — check on every request, per resource.

## Interview questions

**★ How do you keep a fast optimistic UI without trusting the client?**
Update locally for feedback, send the *intent*, and adopt the server's response as the truth —
even when it agrees. The server decides; the client only predicts, and reconciles.

**★ What goes in the request body for a checkout?**
Item ids and quantities, and a coupon code — the things the user chose. Never prices, totals, tax
or discount amounts; those are conclusions the server reaches from its own data.

**★ What is an idempotency key and who generates it?**
A unique id the client generates **once per user intent** and repeats on every retry, so the server
can deduplicate. The client generates it; the server enforces the semantics.

**★ Why proxy third-party APIs through your own backend?**
Because the key cannot live in the browser. The proxy also lets you check the session, rate-limit,
trim the response and avoid CORS entirely — but it must whitelist operations, or it becomes an open
proxy.

**★ Is "the client should be thin" the right conclusion?**
No. The client should own the experience completely — perceived speed, presentation state, input
assistance, accessibility, offline drafts, and the only measurements of what the user actually
experienced. It should own no *decisions*.

**Your app hides an admin panel from non-admins. Is that enough?**
No — that is cosmetic. The endpoints behind it must authorise every request, because the panel is
just a URL and the API is just HTTP.

---

← [01 · The trust boundary](./01-the-trust-boundary.md) · [Topic index](./README.md)
