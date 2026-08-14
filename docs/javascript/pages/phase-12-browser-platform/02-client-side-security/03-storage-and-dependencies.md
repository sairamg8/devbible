---
title: "02.3 · Storage, dependencies and depth"
sidebar_label: "03 · Storage and dependencies"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity), [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP), [`Window.localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API). Documentation-validated.

**The two remaining client-side surfaces are where you put the token and whose code you run.**
Both are decisions, not defaults, and both are usually made once and never revisited.

## Where the token goes

The perennial argument, stated honestly: **there is no option that is safe against everything.**

| | `localStorage` / `sessionStorage` | `HttpOnly` cookie |
|---|---|---|
| Readable by JavaScript | **yes** — so XSS steals it | **no** |
| Sent automatically | no — you attach the header | yes, per cookie scope |
| CSRF exposure | none (nothing is automatic) | **yes** — needs `SameSite` and/or a token |
| Cross-origin API | simple — just a header | needs `credentials` + CORS + `SameSite=None` |
| Survives a tab close | `localStorage` yes, `sessionStorage` no | per `Max-Age`/`Expires` |

🔴 **The real trade is XSS versus CSRF**, and the honest summary is:

- **`HttpOnly` cookies remove token theft from the XSS blast radius.** An attacker with script
  execution can still *act as the user* while the page is open — the cookie rides along on every
  request they make from your origin — but they cannot exfiltrate a credential to use later,
  from elsewhere, after the tab is closed. That difference is worth a lot.
- **Storage-based tokens have no CSRF problem** because nothing is attached automatically, and
  they are far simpler for a cross-origin API. But **any** XSS reads them —
  `localStorage.getItem` is one line, and the token leaves the building.

**The decision follows the architecture more than the theory:** same-origin app and API →
`HttpOnly` cookies with `SameSite=Lax`, and CSRF handled. Genuinely cross-origin API → a token,
kept in memory rather than `localStorage` where you can manage it, with a short lifetime and a
refresh flow ([Phase 11 · 03 · 04](../../phase-11-network-storage/03-fetch-wrapper/04-auth-and-refresh.md)).

⚠️ **What is not a real answer:** storing the token "encrypted" in `localStorage`. The key has to
be in the bundle ([01 · The trust boundary](./01-the-trust-boundary.md)), so the attacker has
both halves.

And the point that outranks the whole table: 🔴 **if you have XSS, the storage choice is a
mitigation, not a fix.** An attacker running script in your origin can call your API directly
with whatever credential mechanism you chose. Preventing the sinks —
[Phase 9 · 06 · Sanitising HTML](../../phase-9-dom/06-sanitising-html/README.md) — is the
control; storage choice reduces the damage afterwards.

## Other things not to put in storage

- **PII you do not need after the request.** Web storage is not cleared by "log out" unless you
  clear it, is shared across tabs, and persists on a shared computer.
- **Anything you have not size-checked.** Storage is synchronous and blocks the main thread; a
  megabyte of JSON round-tripped on every render is a jank source, not just a memory one.
- **Anything from another origin's control.** Storage is per origin, but a subdomain takeover or
  an injected script on your own origin reads it all.

## Dependencies — the code you did not write

Most JavaScript in a modern app is not yours, and every package runs with your origin's full
authority: your DOM, your storage, your cookies, your API session. A compromised dependency is
not "a vulnerability in a library" — it is arbitrary code in your security context.

The practices that actually help, in order of return:

1. **A lockfile, committed, and installs that respect it** (`npm ci`, `yarn --immutable`). A
   build that silently picks up a new patch version is a build you cannot reproduce or audit.
2. **`npm audit` / `yarn npm audit` in CI**, with the results triaged rather than ignored. Noise
   is real; unread output is worse.
3. **Fewer dependencies.** Every added package is added attack surface and an added maintainer to
   trust. A six-line utility is not worth a dependency tree.
4. **Pin and review what runs at install time.** Lifecycle scripts execute on developer machines
   and CI with their credentials, and that is where supply-chain attacks land.
5. **Watch transitive depth.** You are trusting everyone your dependencies trust, and nobody
   reads that list.

## Third-party scripts on the page

A `<script src="https://cdn.example.com/widget.js">` is strictly worse than a dependency: it is
fetched at runtime, from a host you do not control, and its contents can change between page
loads. Analytics, chat widgets and tag managers all have this shape.

**Subresource Integrity** is the mitigation, and MDN describes it exactly:

> "**Subresource Integrity** (SRI) is a security feature that enables browsers to verify that
> resources they fetch (for example, from a CDN) are delivered without unexpected manipulation.
> It works by allowing you to provide a cryptographic hash that a fetched resource must match."

> "The browser will then calculate the hash of the resource contents … and compare the result
> with all the specified values: if the actual value matches any of the specified values, then
> the browser will load the resource, otherwise it will **refuse to load the resource, and return
> a network error**."

```html
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>
```

⚠️ **`crossorigin` is required, not optional.** MDN explains why: a resource loaded from HTML is
fetched in `no-cors` mode by default, and *"subresource integrity could enable an attacker to
derive information about the content of a subresource, even when it's requested in `no-cors`
mode. To prevent this attack, browsers will not allow `no-cors` requests to use subresource
integrity, so a request like this will always fail."*

🔴 **SRI only works for resources that do not change.** A vendor that ships "always latest" at a
stable URL cannot be pinned this way — which is the honest reason so many third-party snippets
have no `integrity`, and a good argument for self-hosting a pinned copy instead.

## Defence in depth: CSP and Trusted Types

Both are server headers that change what your JavaScript is *allowed* to do — the last layer,
and the one that turns a mistake into a blocked action rather than an incident.

- **Content Security Policy** restricts where scripts, styles, frames and connections may come
  from. A strict policy (nonce-based, with `strict-dynamic`) means an injected `<script>` tag
  does not execute even if an attacker gets one into the DOM. It also carries `frame-ancestors`
  for clickjacking ([02 · Other windows and frames](./02-windows-and-frames.md)).
- **Trusted Types** — covered in
  [Phase 9 · 06 · Sanitising HTML](../../phase-9-dom/06-sanitising-html/README.md) — makes
  passing a plain string to a DOM sink throw, converting "remember to sanitise" into a platform
  guarantee.

Both will break things when first enabled. **Report-only mode exists for exactly that**: deploy
the policy in report mode, read the violations for a release cycle, then enforce. A CSP that was
never enforced because it broke the app protects nothing.

## Gotchas

**Symptom:** A stolen token is used days later from another machine
**Cause:** It was in `localStorage` and XSS exfiltrated it.
**Fix:** `HttpOnly` cookies, or in-memory short-lived tokens — and fix the XSS.

**Symptom:** Cookie auth works and requests are forged from another site
**Cause:** Cookies are sent automatically — the CSRF half of the trade.
**Fix:** `SameSite`, plus a CSRF token for state-changing requests.

**Symptom:** "We encrypt the token in `localStorage`"
**Cause:** The key ships in the bundle.
**Fix:** Not a control. Choose a storage model and fix the sinks.

**Symptom:** A logged-out user's data is still on a shared computer
**Cause:** Web storage is not cleared by a logout that only drops a cookie.
**Fix:** Clear it explicitly; prefer `sessionStorage` for per-session data.

**Symptom:** The app janks on every render
**Cause:** Large synchronous `localStorage` round-trips.
**Fix:** Store less; storage is synchronous and blocks the main thread.

**Symptom:** A build picks up a compromised patch release
**Cause:** Installs did not respect the lockfile.
**Fix:** `npm ci` / immutable installs, lockfile committed.

**Symptom:** A CDN script changed behaviour overnight
**Cause:** Runtime-fetched third-party code with no integrity check.
**Fix:** SRI where the URL is stable; self-host a pinned copy where it is not.

**Symptom:** `integrity` is set and the script always fails to load
**Cause:** Missing `crossorigin` — MDN: browsers *"will not allow `no-cors` requests to use
subresource integrity, so a request like this will always fail."*
**Fix:** Add `crossorigin="anonymous"` and ensure the host sends CORS headers.

**Symptom:** CSP was written, never enforced, and protects nothing
**Cause:** It broke the app, so it stayed in report-only forever.
**Fix:** Report-only as a *migration step* — read violations, fix, then enforce.

## Interview questions

**★ `localStorage` or an `HttpOnly` cookie for an access token?**
It is XSS versus CSRF, not safe versus unsafe. `HttpOnly` removes token *theft* from the XSS
blast radius — an attacker can still act while the page is open but cannot exfiltrate a
credential for later — at the cost of CSRF exposure and more CORS work cross-origin. Storage has
no CSRF problem and is simpler cross-origin, but any XSS reads it in one line. Same-origin app
and API → cookies; genuinely cross-origin → short-lived in-memory tokens with a refresh flow.

**★ Does the storage choice matter if you have XSS?**
It reduces damage, it does not prevent it. Script running in your origin can call your API with
whatever mechanism you chose. Preventing sinks is the control; storage choice is mitigation.

**★ What does Subresource Integrity guarantee, and what does it not?**
That the fetched bytes match a hash you specified — MDN: otherwise the browser *"will refuse to
load the resource, and return a network error."* It does **not** help when the vendor legitimately
updates the file at a stable URL, and it requires `crossorigin`, because browsers *"will not
allow `no-cors` requests to use subresource integrity."*

**★ Why is a third-party `<script src>` worse than an npm dependency?**
It is fetched at runtime from a host you do not control and can change between page loads, with
no review step at all. A dependency at least enters through a lockfile and a build you can audit.

**★ What is the first thing you would do about supply-chain risk?**
Commit the lockfile and make CI installs immutable, so builds are reproducible and a silently
updated transitive dependency cannot enter. Then audit in CI, then reduce the dependency count.

**★ Why do most CSPs never get enforced, and what is the way through?**
Because a strict policy breaks something on first deployment and report-only becomes permanent.
Treat report-only as a migration step with a deadline: collect violations for a release, fix
them, then enforce.

**What is the ordering of these defences?**
Do not create sinks (Trusted Types, correct DOM APIs) → do not run code you have not vetted
(lockfiles, SRI) → limit what code can do if it runs anyway (CSP) → limit what a stolen
credential is worth (`HttpOnly`, short lifetimes). Each layer assumes the previous one failed.

---

← [02 · Other windows and frames](./02-windows-and-frames.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
