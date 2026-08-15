---
title: "02 · Shipping errors to a reporter"
sidebar_label: "02 · Shipping to a reporter"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon), [`fetch()` § `keepalive`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#keepalive), [`Document: visibilitychange` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event), [`Error.prototype.stack`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/stack), [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause), [`crypto.randomUUID()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID), [Source map format](https://developer.mozilla.org/en-US/docs/Glossary/Source_map), [`Window: unhandledrejection` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event). Documentation-validated; **no timings, no console blocks**.

Catching the error ([01](./01-the-handlers.md)) is the easy half. The half that decides whether
the dashboard is useful is what you attach to it, how much of it you send, and whether the send
survives the page closing.

## What to send

An error on its own answers "what broke" and nothing else. The context is what makes it fixable:

| Field | Why |
|---|---|
| `name`, `message`, **`stack`** | the error itself |
| **the `cause` chain**, flattened | the layer that actually failed ([08](../08-custom-error-classes/02-cause-chains-and-boundaries.md)) |
| `code` | the stable identity to group by |
| **release / build id** | which deploy — the first question anyone asks |
| URL and route | where the user was |
| **session or correlation id** | ties this to the server logs, and to a support ticket |
| user agent, viewport | the "only on iOS Safari" class of bug |
| **breadcrumbs** — the last few actions | the reproduction steps you will otherwise never get |

🔴 **The release id and the correlation id are the two people forget, and the two support asks
for first.** Without a release id you cannot tell a regression from a long-standing bug; without a
correlation id a user's report cannot be joined to anything.

**Serialise deliberately** — remember `JSON.stringify(err)` yields `{}` because `message` and
`stack` are non-enumerable, so build the payload field by field.

## What must never be sent

| Never | Because |
|---|---|
| Passwords, tokens, cookies, auth headers | the reporter is a third party with its own breach surface |
| Whole request or response bodies | they contain the above, and personal data |
| Personal data — email, address, payment details | it lands in a system with different retention rules |
| Full form contents in breadcrumbs | the same, from a different direction |

**Scrub on the way out, not on the way in.** A single redaction step over the payload — keys
matching `token|secret|password|authorization|cookie`, and values that look like an email or a
card number — is the only reliable place to do it, because you cannot audit every call site.

⚠️ **Errors from a form submission are the classic leak**: the payload gets attached "for
context", and the user's address ends up in your error tracker. Attach an id; look the rest up.

## Do not send everything, forever

A production application can generate an extraordinary volume of the *same* error. Three
controls, and all three are worth having:

```js
const seen = new Map();

function shouldSend(key) {
  const n = (seen.get(key) ?? 0) + 1;
  seen.set(key, n);
  return n <= 3;                     // 🔴 first three of each distinct error, then stop
}
```

- **Deduplicate** by a stable key — `name` + `code` + the top frames, **not** the message with its
  interpolated ids, or every occurrence looks unique.
- **Rate-limit** per session, so one error in a render loop cannot send thousands of reports.
- **Sample** high-volume, low-value categories — a known third-party script error, a network blip
  — rather than turning them off entirely, so you keep the trend.

⚠️ **Sampling must be recorded.** A dashboard that silently drops 90% of an error makes it look
ten times rarer than it is; send the count with the sample.

## Getting the report out as the page closes

An error during navigation or unload is often the most interesting one, and it is exactly when a
normal `fetch` is likely to be cancelled.

```js
const body = JSON.stringify(payload);
navigator.sendBeacon('/errors', new Blob([body], { type: 'application/json' }))
  || fetch('/errors', { method: 'POST', body, keepalive: true });   // ✅ fallback
```

**`sendBeacon` queues the request and lets the page go**, which is what it exists for. `fetch`
with `keepalive: true` does the same job with more control over headers — both have size limits
smaller than a normal request, which is another reason to keep the payload lean.

🔴 **Flush on `visibilitychange` to `'hidden'`, not on `unload`.** It is the reliable signal on
mobile, where a backgrounded page may never fire `unload` at all — the lifecycle argument in
[Phase 10 · 09 · Visibility and lifecycle](../../phase-10-events/09-scroll-resize-visibility/02-visibility-and-lifecycle.md).

## A stack you can read

A minified stack — `t.default.a` at line 1, column 48302 — is not a stack. **Source maps are what
make it one**, and the deployment question is where they live:

| Approach | Consequence |
|---|---|
| Ship `.map` files publicly | anyone can read your source |
| **Upload maps to the reporter at build time** | ✅ readable stacks, source stays private |
| No maps at all | the dashboard is decorative |

**Tie the upload to the release id**, so a stack from an old build resolves against the maps for
*that* build. This is the other reason the release id matters.

## The reporter must never break the page

```js
function report(payload) {
  try {
    if (!shouldSend(key(payload))) return;
    send(scrub(payload));
  } catch { /* deliberately ignored: reporting must never break the page */ }
}
```

🔴 **Everything in this pipeline runs on a path that is already failing.** A throw inside the
reporter becomes an uncaught exception, which fires the handler, which calls the reporter — the
loop from [01](./01-the-handlers.md). Wrap it, keep it cheap, and never `await` it in a code path
the user is waiting on.

⚠️ **Consider what happens when the reporting endpoint itself is down**, since an outage is
exactly when error volume spikes. Fire-and-forget with a bounded in-memory queue is correct;
retrying error reports with backoff is a way to turn one outage into two.

## Alert on rates, not on errors

Every application has a background rate of errors it cannot fix — extensions, ancient browsers,
networks failing mid-request. **Alerting on "an error happened" trains everyone to ignore the
alerts.**

Useful signals are comparative: a **new** error group that has never been seen before, a **spike**
against the same hour last week, an error rate crossing a share of sessions, or **any** occurrence
of a specific error you have decided is never acceptable. That is a rate, a first-seen, or an
explicit allowlist — never a raw count.

## Gotchas

**Symptom: the reporter shows `{}` for the error.**
Cause — `JSON.stringify(err)`; `message` and `stack` are non-enumerable.
Fix — build the payload field by field, including a flattened `cause` chain.

**Symptom: thousands of identical reports from one session.**
Cause — no dedup or rate limit; an error inside a render loop.
Fix — dedup on a stable key, cap per session, sample the rest and send the count.

**Symptom: every occurrence looks like a distinct error.**
Cause — the grouping key includes an interpolated id or timestamp.
Fix — group on `name` + `code` + top frames.

**Symptom: errors that happen during navigation never arrive.**
Cause — a normal `fetch` cancelled as the page unloads.
Fix — `sendBeacon`, or `fetch` with `keepalive`, flushed on `visibilitychange`.

**Symptom: a user's email address is in the error tracker.**
Cause — a payload attached for context.
Fix — scrub on the way out; attach ids, not data.

**Symptom: the stack is unreadable minified frames.**
Cause — no source maps uploaded for that release.
Fix — upload maps at build time, keyed to the release id; do not serve them publicly.

**Symptom: an error loop takes the page down.**
Cause — the reporting code threw, triggering the global handler again.
Fix — wrap the reporter; never let it throw or block.

**Symptom: nobody reacts to the alerts.**
Cause — alerting on raw error counts, including the unfixable background rate.
Fix — alert on new groups, spikes and rate thresholds.

## Interview questions

**★ What do you send with an error, beyond the error?**
Stack and the flattened `cause` chain, a stable `code`, the **release id**, the URL and route, a
**correlation id**, environment details, and recent breadcrumbs. The release and correlation ids
are the two most often missing and the two most asked for.

**★ What must never be sent?**
Credentials, tokens, cookies, whole request bodies and personal data. Scrub on the way out, since
you cannot audit every call site, and attach ids instead of payloads.

**★ How do you stop one error flooding the reporter?**
Deduplicate on a stable key, rate-limit per session, and sample the high-volume low-value
categories — sending the count so the trend stays honest.

**★ How do you get a report out while the page is closing?**
`navigator.sendBeacon`, or `fetch` with `keepalive: true`, flushed on `visibilitychange` to
hidden rather than on `unload` — which is unreliable on mobile.

**★ Why does the dashboard show minified frames?**
No source maps for that release. Upload them at build time keyed to the release id rather than
serving them publicly.

**★ What is the rule about the reporting code itself?**
It must never throw, never block, and never be retried aggressively — it runs on a path that is
already failing, and a throw inside it re-enters the global handler.

**What should you alert on?**
New error groups, spikes against a baseline, and rate thresholds — not raw counts, which include
the unfixable background rate and train people to ignore alerts.

---

← [01 · The handlers](./01-the-handlers.md) · [Topic index](./README.md)
