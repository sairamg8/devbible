---
title: "07.1 · The double-submitted checkout"
sidebar_label: "01 · The double submit"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`crypto.randomUUID()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID), [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static), [`Window.sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage), [`beforeunload` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event), [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After). Documentation-validated; **no timings**.

**Two orders from one checkout is the most expensive bug a storefront can ship**, and it has more
causes than the one everybody guards against.

## The five ways it happens

1. **The user double-clicks.** The obvious one, and the only one a disabled button addresses.
2. **The user refreshes** during a slow request and submits again.
3. 🔴 **The client retries after a timeout.** The request succeeded and the *response* was lost —
   the retry creates a second order ([Phase 11 · 03 · 06](../../phase-11-network-storage/03-fetch-wrapper/06-retries.md)).
4. **A network blip retries at a lower layer** — a proxy, a service worker, or the browser itself.
5. **Two tabs.** The cart is shared; the checkout is not.

🔴 **Only the first is a UI problem.** The other four happen with a perfectly disabled button,
which is why "disable the button" is not a fix — it is a courtesy.

## Why the timeout case is the important one

> **A timeout means you stopped listening. It does not mean the server did nothing.**

The request may have arrived, the order may be committed, and the response may have been lost on
the way back or simply been slower than your eight seconds. **The client cannot distinguish
"never arrived" from "arrived and answered too late"** — and that is not a limitation to engineer
around, it is a property of networks.

⚠️ **So a retry is either unsafe, or the endpoint is idempotent.** There is no third option, and
this is the entire justification for the mechanism.

## The idempotency key

```js
// 🔴 generated ONCE per logical operation, not per attempt
const idempotencyKey = crypto.randomUUID();

await withRetry(() =>
  api.post("orders", order, {
    headers: { "Idempotency-Key": idempotencyKey },
  }),
);
```

**The contract:** the server stores the key with the result of the first request that used it, and
returns **that stored result** for any repeat — same status, same body. The second request does not
create anything.

Three rules, and each is a real failure when broken:

- 🔴 **One key per logical operation, generated *outside* the retry loop.** Generated per attempt,
  every retry looks like a new order to the server, and you have built the bug you were preventing.
- 🔴 **The key must survive a reload.** A key held only in memory is regenerated when the user
  refreshes and submits again — which is cause 2 from the list. **`sessionStorage`, keyed by the
  cart's contents or a checkout session id**, is the usual answer.
- **A new key for a genuinely new attempt.** After a *rejected* order — declined card, corrected
  address — the user is making a different request, and reusing the key would return the stored
  failure forever.

```js
function keyForCheckout(cartFingerprint) {
  const storageKey = `idem:${cartFingerprint}`;
  let key = sessionStorage.getItem(storageKey);
  if (!key) {
    key = crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
  }
  return key;
}
```

⚠️ **The fingerprint decides what "the same operation" means.** Cart contents plus address plus
total is a reasonable definition; the cart alone would reuse a key after the user changes the
delivery address, which is a different order.

## `crypto.randomUUID()` and its one constraint

MDN: it generates a v4 UUID using a cryptographically secure random number generator.

⚠️ **It is only available in a secure context** — HTTPS or `localhost`. On plain HTTP over a LAN it
is `undefined`, and the fallback matters:

```js
const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;   // ⚠️ weaker, but present
```

🔴 **`Math.random()` is not cryptographically secure and can collide**, which for an idempotency key
means two different orders sharing one key — the second silently returning the first's result. It
is an acceptable *fallback*, not a design.

## Disabling the button is still worth doing

⚠️ **It is a courtesy, not a fix** — but the courtesy matters:

```js
button.disabled = true;
try {
  await submit();
} finally {
  button.disabled = false;                 // 🔴 in finally, or a failure locks the user out
}
```

🔴 **Re-enable in a `finally`.** A button disabled on submit and re-enabled only on success leaves
the user permanently stuck after any failure — which is a worse bug than the one it was preventing,
because there is no recovery except a reload.

**And show progress.** A disabled button with no feedback reads as broken, and a user who thinks
the page is broken refreshes — which is cause 2 again.

## What the client owes the server

🔴 **The client's whole job here is: generate a stable key, send it on every attempt of the same
operation, and change it when the operation genuinely changes.** The deduplication itself is the
server's — it is the only side that can see the database.

That has one consequence worth stating plainly: **an endpoint that ignores the header gives no
protection at all.** The header is a request for a guarantee, and if the API does not document
idempotency support, **the client must not retry that call**
([Phase 11 · 03 · 06](../../phase-11-network-storage/03-fetch-wrapper/06-retries.md)) — surface the
failure and let the user decide, which is a "try again" button and a human in the loop.

## Recovering when you genuinely do not know

Sometimes the request is gone and there is no key. The honest options, in order:

1. **Ask the server** — "does an order exist for this cart/session?" A `GET` is always safe.
2. **Show the uncertainty**: *"We could not confirm your order. Check your orders page before
   trying again."* ⚠️ **Worse than either is a silent retry**, which is how a customer gets charged
   twice.
3. **Reconcile out of band** — a follow-up email or a support flow. Not elegant, and better than a
   duplicate charge.

## Gotchas

**Symptom:** Two orders from one checkout despite a disabled button
**Cause:** A timeout retry, a refresh, a proxy retry, or two tabs — none of which the button
touches.
**Fix:** An idempotency key.

**Symptom:** Idempotency keys are in place and duplicates still happen
**Cause:** The key is generated inside the retry loop, so each attempt is a new operation.
**Fix:** Generate once per logical operation, outside the loop.

**Symptom:** A refresh creates a second order
**Cause:** The key lived only in memory.
**Fix:** `sessionStorage`, keyed by a fingerprint of the operation.

**Symptom:** A corrected order returns the old failure forever
**Cause:** The key was reused after a genuine rejection.
**Fix:** A new key when the operation actually changes — include the address in the fingerprint.

**Symptom:** `crypto.randomUUID is not a function`
**Cause:** Not a secure context — plain HTTP.
**Fix:** A fallback, while knowing it is weaker and can collide.

**Symptom:** The checkout button is stuck disabled
**Cause:** Re-enabled only on success.
**Fix:** `finally`.

**Symptom:** Users refresh mid-checkout
**Cause:** A disabled button with no progress feedback reads as broken.
**Fix:** Show progress.

**Symptom:** The header is sent and duplicates still occur
**Cause:** The endpoint does not implement idempotency.
**Fix:** Do not retry that call; surface the failure and let the user decide.

## Interview questions

**★ A checkout creates two orders. Name the causes.**
Double-click, refresh, **a client retry after a timeout**, a lower-layer retry (proxy, service
worker), and two tabs. Only the first is a UI problem — which is why disabling the button is a
courtesy, not a fix.

**★ Why is the timeout case the important one?**
Because a timeout means **you stopped listening, not that the server did nothing**. The order may
be committed and the response lost. The client cannot distinguish that from "never arrived", so a
retry is either unsafe or the endpoint is idempotent — there is no third option.

**★ Where must an idempotency key be generated?**
Once per **logical operation**, outside the retry loop, and it must **survive a reload** —
`sessionStorage` keyed by a fingerprint of the operation. Generated per attempt it achieves
nothing; held in memory it does not survive the refresh case.

**★ When do you generate a *new* key?**
When the operation genuinely changes — a corrected address, a different card after a decline.
Reusing the key would return the stored failure forever, so the fingerprint must include the fields
that make it a different order.

**★ Is `crypto.randomUUID()` always available?**
Only in a **secure context** — HTTPS or `localhost`. The `Math.random()` fallback is not
cryptographically secure and can collide, which for an idempotency key means two orders sharing one
key. Acceptable as a fallback, not as a design.

**★ Whose responsibility is the deduplication?**
The server's — it is the only side that can see the database. The client's job is a stable key sent
on every attempt. **An endpoint that ignores the header gives no protection**, and against such an
endpoint the client must not retry at all.

**What do you do when you do not know whether the order went through?**
Ask the server with a safe `GET`; if that is impossible, **show the uncertainty** and point the user
at their orders page. A silent retry is how someone gets charged twice.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
