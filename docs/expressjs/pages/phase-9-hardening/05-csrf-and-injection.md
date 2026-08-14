---
title: "CSRF and injection surfaces"
sidebar_label: "05 · CSRF · injection"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Cookie session APIs may need CSRF defenses. Bearer tokens in Authorization usually do not. Never `res.redirect(userInput)` unchecked.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> Express ships **no CSRF protection**; `csurf` was the historical package and is
> **archived — do not teach or adopt it**. The open-redirect risk is acknowledged in
> Express's own docs: `res.redirect` links to
> [Prevent open redirects](https://expressjs.com/en/advanced/best-practice-security.html)
> in the security best-practices guide
> ([response reference](https://expressjs.com/en/5x/api/response/)).
> The CSRF reasoning rests on a browser behaviour, not an Express one: **cookies are
> attached automatically to cross-site requests, `Authorization` headers are not** — which
> is the whole distinction below. `SameSite` semantics are the cookie specification
> ([RFC 6265bis](https://datatracker.ietf.org/doc/draft-ietf-httpbis-rfc6265bis/)), surfaced
> in Express through `res.cookie`'s `sameSite` option
> ([Phase 8](../phase-8-validation-authz/05-cookies-sessions-wireup.md)).
> Injection theory and measured bypasses are
> [Node Phase 8](../../../nodejs/pages/phase-8-security/README.md).

`csurf` is **archived** — do not teach it as current. Prefer modern patterns (double-submit cookie, SameSite, framework guidance) aligned with Node Phase 8.

Open redirects and header injection are handler bugs:

```js
// bad
res.redirect(req.query.next);
// good — allow-list relative paths
```

Cross-link Node SSRF/open-redirect pages for measured bypasses.

## The one question that decides whether CSRF applies

**Does the browser attach your credential automatically?**

| Credential | Sent automatically cross-site? | CSRF applies? |
|---|---|---|
| Session cookie | **Yes** — that is what cookies do | **Yes** |
| `Authorization: Bearer …` | No — JavaScript must add it | **No** |
| Cookie *read by JS* and sent as a header | No — it is a header by the time it is sent | No |

CSRF exists because a cookie is *ambient authority*: `evil.example` can cause the
victim's browser to issue a request to your API, and the browser attaches the
session cookie without anyone's consent. It cannot attach an `Authorization`
header, because only your own JavaScript sets that — and the same-origin policy
stops it running on the attacker's page.

So the decision is mechanical: **cookie sessions need a CSRF story; bearer tokens
do not.** A "we use JWTs so we are safe" claim is only true if the JWT travels in a
header. **A JWT in a cookie is a cookie**, and CSRF applies exactly as it would to
a session id.

## `SameSite` is most of the defence now

`SameSite=Lax` — the modern browser default — withholds the cookie on cross-site
POST, PUT and DELETE, which removes the classic CSRF shape. That is a large
improvement, and it is why `csurf`-era token machinery is rarely the first answer
today.

It is not the whole answer:

- **`Lax` still permits top-level GET navigation.** Any state-changing GET remains
  exploitable by a link — which is a second reason GET must never mutate
  ([Phase 6](../phase-6-rest-surface/02-status-mapping.md)).
- **`SameSite=None` is required for genuinely cross-site flows**, and turns the
  defence off exactly where you needed it.
- **Same-site is not same-origin.** A subdomain you do not fully control —
  `user-content.example.com` — is same-site with `app.example.com`, so a compromise
  there sidesteps `Lax` entirely.

Where those apply, add the **double-submit cookie** pattern (a random value in both
a cookie and a header, compared server-side) or synchroniser tokens. **Do not reach
for `csurf`** — it is archived, and mounting an unmaintained security dependency is
its own risk.

A cheap belt-and-braces check for cookie APIs: verify the `Origin` header on unsafe
methods against your allow-list. It costs nothing and catches the cross-site cases
that matter.

## Open redirects, header injection, and where they come from

Both are handler bugs — Express hands you exactly enough rope.

**Open redirect.** `res.redirect(req.query.next)` sends the user wherever an
attacker chooses, wearing your domain in the link. It is the credibility half of
most phishing, and it also breaks OAuth flows that use redirect URIs as a trust
boundary.

```js
// ⛔ arbitrary destination
res.redirect(req.query.next);

// ⚠️ still broken: '//evil.example' is protocol-relative and leaves your site.
//    So does 'https:/\/\evil.example' after browser normalisation.
if (next.startsWith('/')) res.redirect(next);

// ✅ allow-list of known destinations, or resolve and check the origin
const DESTINATIONS = {dashboard: '/app', billing: '/app/billing'};
res.redirect(DESTINATIONS[req.query.next] ?? '/app');
```

**Prefer a key-to-path map over validating a URL.** URL validation is a losing game
of normalisation edge cases; a lookup table has no edge cases.

**Header injection** is the same shape one layer down: user input written into a
response header. Node rejects newlines in header values, so classic CRLF splitting
is blocked at the runtime — but the input still reaches whatever consumes the
header. A user-controlled `Location`, `Set-Cookie` attribute or `Content-Disposition`
filename is untrusted data in a position of authority. **Never interpolate request
data into a header you did not construct.**

## Trade-off

Bearer tokens sidestep CSRF entirely, which is a real simplification — and they pay
for it by living somewhere JavaScript can read, putting theft back on the XSS
table. Cookie sessions with `httpOnly` invert that: theft becomes hard, CSRF becomes
your problem.

**Neither is free, and "we use JWTs" is not an answer to CSRF** unless you can say
where the token lives. For browser clients this bible's default remains
`httpOnly` cookies with `SameSite=Lax`, plus an `Origin` check on unsafe methods —
strong defaults, small surface, and no unmaintained dependency.

For open redirects the trade is flexibility: an allow-list means a genuinely dynamic
post-login destination needs registering. That friction is proportionate to what a
redirect parameter is worth to an attacker.

## Gotchas

**Symptom:** "We use JWTs, so CSRF does not apply" — but it does  
**Cause:** The JWT is stored in a cookie, so the browser attaches it automatically  
**Fix:** Location decides, not format. Cookie ⇒ CSRF applies

**Symptom:** A state-changing GET is triggered by an `<img>` tag on another site  
**Cause:** `SameSite=Lax` permits top-level GET, and the endpoint mutates  
**Fix:** Never mutate on GET. This is the second reason for the rule

**Symptom:** CSRF protection disappears after enabling a cross-site integration  
**Cause:** `SameSite=None` was required and removed the defence  
**Fix:** Add double-submit or synchroniser tokens for those flows

**Symptom:** `res.redirect('//evil.example')` leaves the site despite a `startsWith('/')` check  
**Cause:** Protocol-relative URLs begin with `/`  
**Fix:** An allow-list of destinations, not string validation

**Symptom:** A dependency audit flags `csurf`  
**Cause:** It is archived  
**Fix:** Remove it. Use `SameSite` plus double-submit, or a maintained alternative

**Symptom:** A subdomain compromise bypasses `SameSite`  
**Cause:** Same-site includes sibling subdomains  
**Fix:** Do not treat `SameSite` as an origin boundary; add the `Origin` check

## Interview questions

**★ When is CSRF a concern for a JSON API?**  
When auth relies on cookies automatically sent by the browser cross-site.

**★ Does using JWTs make you immune to CSRF?**  
Only if the token travels in a header. A JWT stored in a cookie is attached
automatically by the browser, so CSRF applies exactly as it does to a session id.
**Where the credential lives decides, not what format it is in.**

**★ How much of CSRF does `SameSite=Lax` solve, and what is left?**  
Most of the classic shape — it withholds the cookie on cross-site POST/PUT/DELETE.
Left over: state-changing GETs (Lax permits top-level navigation), flows that require
`SameSite=None`, and sibling subdomains, since same-site is not same-origin.

**★ Why is `if (next.startsWith('/'))` an insufficient open-redirect guard?**  
`//evil.example` is protocol-relative and starts with `/`. Validating URLs is a
normalisation arms race; map a key to a known path instead and there are no edge cases.

**Why should `csurf` not be used?**  
It is archived. An unmaintained dependency in the security path is a liability, and
`SameSite` plus double-submit covers the ground without it.

**What makes an open redirect worth an attacker's time?**  
It lends your domain's credibility to a phishing link, and it undermines flows —
OAuth in particular — that treat redirect URIs as a trust boundary.


---

← Prev: [Rate limiting](04-rate-limiting.md) · Next → [Timeouts and secrets at edge](06-timeouts-and-secrets.md)
