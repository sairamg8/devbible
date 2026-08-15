---
title: "1 · What a policy breaks"
sidebar_label: "1 · What a policy breaks"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Content-Security-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy), [CSP guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP), [`Content-Security-Policy-Report-Only`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only), [`default-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/default-src), [`connect-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src). Documentation-validated; **no timings**.

**A Content Security Policy is a response header that tells the browser which sources it may
execute and load from.** It is the second line of defence against XSS: it does not stop
injection, it stops injected script from *running*.

```http
Content-Security-Policy: script-src 'nonce-r4nd0m'; object-src 'none'; base-uri 'none'
```

🔴 **From the JavaScript side, a policy is felt as things that stop working** — inline
`<script>`, `onclick=`, `eval`, a CDN you forgot to list, a WebSocket that will not connect.
This chunk is the map of what breaks and why;
[chunk 2](./02-nonces-and-strict-dynamic.md) is how to have a strict policy and a working app at the same time.

## Where a policy comes from

| Delivery | Notes |
|---|---|
| **`Content-Security-Policy` response header** | the real one; supports everything |
| **`<meta http-equiv="Content-Security-Policy">`** | "a useful option for some use cases, such as a client-side-rendered single page app which has only static resources, because you can then avoid relying on any server infrastructure. **However, this option does not support all CSP features.**" |
| **`Content-Security-Policy-Report-Only`** | reports without enforcing — and **cannot be delivered in a `<meta>` element** |

⚠️ **`frame-ancestors`, `report-uri` and `sandbox` are among the directives a `<meta>` tag
cannot deliver**, which is exactly the set people reach for. If the policy matters, it is a
header.

**Multiple policies are allowed and they intersect, never union.** Two headers mean a
resource must satisfy *both* — so adding a second policy can only ever forbid more, which is
why a "temporary extra header" is a common cause of a mysterious block.

## The directives, grouped by what they guard

| Group | Directives |
|---|---|
| **Scripts** | `script-src`, `script-src-elem` (`<script>` elements), `script-src-attr` (**inline event handlers**) |
| **Styles** | `style-src`, `style-src-elem`, `style-src-attr` |
| **Content** | `img-src`, `font-src`, `media-src`, `object-src`, `manifest-src` |
| **Frames and workers** | `frame-src`, `child-src`, `worker-src` |
| **Network** | **`connect-src`** — `fetch()`, `XMLHttpRequest`, **`WebSocket`**, `EventSource`, `sendBeacon()`, `<a ping>` |
| **Document** | `base-uri`, `sandbox` |
| **Navigation** | `form-action`, `frame-ancestors` |
| **Reporting** | `report-to`, `report-uri` |

🔴 **`connect-src` is the one that surprises JavaScript developers**, because it covers every
way a page talks to a server — including `WebSocket`, which is otherwise subject to no
browser-side origin check at all ([13 · 01](../13-websocket/01-connecting.md)). ⚠️ And MDN
warns that **`connect-src 'self'` does not resolve to websocket schemes in all browsers** —
name the `wss:` origin explicitly.

### `default-src` is a fallback, not a default

**`default-src` "serves as a fallback for the other fetch directives"** — omit `img-src` and
images follow `default-src`; omit `script-src-elem` and it follows `script-src`, then
`default-src`.

🔴 **Nine directives do not fall back at all**, and every one of them is security-relevant:

`base-uri` · `form-action` · `frame-ancestors` · `sandbox` · `report-uri` · `report-to` ·
`trusted-types` · `require-trusted-types-for` · `upgrade-insecure-requests`

**So `default-src 'self'` alone leaves `base-uri` and `form-action` wide open.** A single
injected `<base href="https://evil.example">` re-points every relative URL on the page — which
is why the strict policies in chunk 2 always carry `base-uri 'none'` explicitly.

## What a policy blocks that JavaScript notices

**Four things, and they account for nearly every "CSP broke my app" report:**

```html
<script>doThing()</script>          <!-- ❌ inline script -->
<p onclick="doThing()">hi</p>       <!-- ❌ inline event handler -->
<a href="javascript:doThing()">     <!-- ❌ javascript: URL -->
```

```js
eval("1+1");                        // ❌
new Function("return 1");           // ❌
setTimeout("doThing()", 0);         // ❌ — the string form only
```

**MDN is blunt about the first one:** "Inline JavaScript is one of the most common XSS
vectors, and one of the most basic goals of a CSP is to prevent its uncontrolled use."

🔴 **A policy that blocks injected inline script blocks *your* inline script too. That is the
feature, not a bug** — the browser cannot tell them apart, which is the entire reason the
protection works. The fix is never `'unsafe-inline'`; it is a nonce or a hash
([chunk 2](./02-nonces-and-strict-dynamic.md)).

**The refactors are mechanical:**

```html
<!-- before -->
<p onclick="console.log('Hello')">click me</p>

<!-- after -->
<p id="hello">click me</p>
<script nonce="{RANDOM}">
  document.querySelector("#hello").addEventListener("click", () => {
    console.log("Hello");
  });
</script>
```

⚠️ **`setTimeout("code", 0)` is blocked but `setTimeout(fn, 0)` is not** — the string form is
an `eval` in disguise, which is the whole reason the function form is the only one worth
writing ([Phase 7 · 12 · Timers](../../phase-7-async/12-timers/README.md)).

⚠️ **Frameworks that compile templates at runtime need `'unsafe-eval'`.** That is a build
configuration problem, not a CSP problem: use the ahead-of-time build and the requirement
disappears.

## The keywords, and the two to avoid

| Source expression | Means |
|---|---|
| `'self'` | the document's own origin — **scheme, host and port** ([14 · 01](../14-same-origin-and-postmessage/01-what-an-origin-is.md)) |
| `'none'` | nothing at all; must be the only value |
| `https://cdn.example.com` | that origin |
| `'nonce-…'` / `'sha256-…'` | this specific inline script — chunk 2 |
| `'strict-dynamic'` | trust propagates from an already-trusted script — chunk 2 |
| ⚠️ **`'unsafe-inline'`** | "defeats much of the purpose of having a CSP" |
| ⚠️ **`'unsafe-eval'`** | re-enables `eval`, `Function`, string timers |

🔴 **An allow-list of domains is weaker than it looks.** If any allowed origin hosts a JSONP
endpoint, an open redirect or an old copy of a framework with a known gadget, an attacker
injects a `<script src>` pointing at *your own allow-list* and the policy waves it through.
That is the reason the modern recommendation is nonces plus `'strict-dynamic'` rather than a
list of CDNs.

## Deploying without breaking the site

**`Content-Security-Policy-Report-Only` enforces nothing and reports everything.** It is the
only sane way to introduce a policy on an app that was not built for one:

```http
Content-Security-Policy-Report-Only: script-src 'nonce-{RANDOM}'; report-to csp-endpoint
```

**Run both headers at once** — an enforcing policy you trust, plus a report-only one you are
trying to tighten to. Ship the second only when the reports go quiet.

### Watching violations from JavaScript

```js
document.addEventListener("securitypolicyviolation", (e) => {
  report({
    blocked: e.blockedURI,          // what was refused
    directive: e.effectiveDirective, // which directive refused it
    disposition: e.disposition,      // "enforce" or "report"
    file: e.sourceFile, line: e.lineNumber, column: e.columnNumber,
    sample: e.sample,                // first ~40 chars — inline only
  });
});
```

**The fields worth knowing:**

- **`disposition`** distinguishes an *enforced* violation from a *report-only* one — the same
  handler sees both, and conflating them makes a report-only rollout look like an outage.
- **`sample`** is "usually the first 40 characters" and is **only populated for inline
  scripts, event handlers, or styles** — never for external resources.
- **`effectiveDirective`** is the directive that actually refused; **`violatedDirective` is a
  historical alias** of it.
- The event fires on the **element**, the **document** and in **workers** — it bubbles, so a
  document-level listener catches element violations.

⚠️ **Do not rely on this event as your only reporting.** It cannot see violations that happen
before your script runs — including the blocking of your reporting script. `report-to` is
server-side and sees everything.

## Gotchas

**Symptom → cause → fix.**

- **`Refused to execute inline script…`** → no `'unsafe-inline'`, no nonce → add a nonce or a
  hash, never `'unsafe-inline'`.
- **A click handler stopped firing after the policy shipped** → `onclick=` is an inline
  handler, governed by `script-src-attr` → `addEventListener`.
- **`eval` errors only in production** → the policy is applied there, or the dev build uses a
  runtime compiler → use the ahead-of-time build.
- **The WebSocket connects locally and is refused in production** → `connect-src` does not
  list the `wss:` origin, and `'self'` may not cover websocket schemes → name it explicitly.
- **`frame-ancestors` in a `<meta>` tag does nothing** → that directive is header-only → send
  the header.
- **A policy got stricter after adding a second header** → multiple policies **intersect** →
  remove the extra one; you cannot loosen by adding.
- **`default-src 'self'` is set and a `<base>` injection still works** → `base-uri` does not
  fall back to `default-src` → set `base-uri 'none'` (and `form-action`).
- **The report-only rollout looks like an outage in the dashboards** → `disposition` was not
  checked → split enforced from reported.
- **Injected script loads from an allow-listed CDN** → the allow-list contains a JSONP or
  redirect gadget → move to nonces plus `'strict-dynamic'`.

## Interview questions

**What does CSP actually protect against?** It does not prevent injection; it prevents
injected content from executing or loading — the second line of defence after escaping and
validating.

**Why does a good CSP break your own inline scripts?** Because the browser cannot distinguish
your inline script from an injected one. Blocking the whole category is what makes it
effective; nonces and hashes are how you re-admit the specific scripts you wrote.

**What is `default-src` and what does it not cover?** A fallback for the *fetch* directives
only. `base-uri`, `form-action`, `frame-ancestors`, `sandbox`, the reporting directives and
the Trusted Types directives never fall back — so they must be set explicitly.

**Which directive governs `fetch`, `WebSocket` and `EventSource`?** `connect-src` — and
`'self'` does not reliably cover `ws:`/`wss:`, so the WebSocket origin is named explicitly.

**How do you introduce a CSP on an existing app?** With `Content-Security-Policy-Report-Only`
alongside the enforced policy, collecting violations through `report-to` and the
`securitypolicyviolation` event until they stop, then promoting it.

**Why is a domain allow-list considered weak?** Any allowed origin that hosts a JSONP
endpoint, an open redirect or a vulnerable library becomes a way to load attacker-chosen code
from a permitted source. Nonce-based policies with `'strict-dynamic'` avoid trusting whole
domains.

---

← [Overview](./README.md) · Next → [2 · Nonces, hashes and `strict-dynamic`](./02-nonces-and-strict-dynamic.md)
