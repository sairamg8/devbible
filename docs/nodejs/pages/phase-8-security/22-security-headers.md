---
title: "Security headers and CSP"
sidebar_label: "22 · Security headers"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** with **helmet 8.3.0** — every output below is
> from `sandbox/p8-security/ex21-headers.mjs`.

Security headers are instructions to a **browser**. They do nothing for an API consumed by
other servers, and they cannot fix a vulnerability — they reduce what an existing one can
reach. That framing keeps the effort proportionate: `helmet()` is one line and 0.80 µs,
and the only part that needs thought is CSP.

## What one line gives you

```console
content-security-policy            default-src 'self';base-uri 'self';…
cross-origin-opener-policy         same-origin
cross-origin-resource-policy       same-origin
origin-agent-cluster               ?1
referrer-policy                    no-referrer
strict-transport-security          max-age=31536000; includeSubDomains
x-content-type-options             nosniff
x-dns-prefetch-control             off
x-download-options                 noopen
x-frame-options                    SAMEORIGIN
x-permitted-cross-domain-policies  none
x-xss-protection                   0
```

Node itself sends none of these. Three are worth understanding rather than accepting.

**`x-xss-protection: 0` is deliberate.** The legacy browser XSS auditor introduced its own
vulnerabilities and is gone from modern browsers; helmet explicitly disables it rather than
leaving it unset. Anyone telling you to set it to `1; mode=block` is working from a 2016
checklist.

**`strict-transport-security` is on by default with `includeSubDomains`** — which, per
[page 19](./19-https-hsts-cookies.md), is a commitment. Every subdomain must have a
certificate.

**`x-frame-options: SAMEORIGIN` is the compatibility copy** of the CSP directive below.

## CSP is the one that requires a decision

The default policy:

```console
default-src 'self'          script-src 'self'           object-src 'none'
base-uri 'self'             script-src-attr 'none'      form-action 'self'
img-src 'self' data:        frame-ancestors 'self'      upgrade-insecure-requests
font-src 'self' https: data:
style-src 'self' https: 'unsafe-inline'
```

That is a genuinely useful policy: no inline scripts, no `onclick=` attributes, no
plugins, no framing by other origins. Two honest caveats — **`style-src` still allows
`'unsafe-inline'`**, because breaking every inline style breaks most sites, and
`font-src`/`style-src` allow any `https:` origin.

**A CSP with `'unsafe-inline'` in `script-src` is not a CSP.** It re-permits exactly what
an XSS payload injects:

```console
script-src 'self' 'unsafe-inline'    re-permits exactly what XSS injects
script-src *                         any origin
script-src 'self' https://cdn.…      as trustworthy as that CDN, including its JSONP endpoints
```

That last one is the subtle failure: allowlisting a large CDN often allowlists an endpoint
on it that will echo back arbitrary JavaScript.

If you need inline script, use a **nonce**, regenerated per response:

```js
const nonce = crypto.randomBytes(16).toString('base64');
res.writeHead(200, {
  'content-security-policy':
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'; object-src 'none'; base-uri 'none'`,
}).end(`<script nonce="${nonce}">ok()</script><script>injected()</script>`);
```

The first script runs; the injected one does not, because the attacker cannot know the
nonce. **A fixed nonce is worse than no nonce** — it is a permanent password for running
script on your page.

CSP is the second line behind correct output encoding ([page 09](./09-xss.md)), not a
replacement for it. It changes an XSS from "attacker runs code" to "attacker runs code
only if they can also bypass the policy".

**Roll it out with `Report-Only`:**

```console
content-security-policy-report-only: default-src 'self'; report-uri /csp-reports
```

Violations are reported and nothing is blocked. Run it for a week, read the reports, then
switch the header name. Shipping an enforcing CSP straight to production is how a policy
gets reverted permanently after one broken page.

## `nosniff`, and why `Content-Type` is the real control

```console
{"content-type":"text/plain"}                     -> nosniff: null
{"content-type":"text/plain","x-content-type…"}   -> nosniff: nosniff
{}                                                -> ct: null
```

Without `nosniff`, a browser may ignore your `Content-Type` and *guess* from the bytes —
so `text/plain` containing `<script>` can be executed as HTML. With it, the declared type
is binding. And note the third row: Node sends **no `Content-Type` at all** by default,
which leaves the browser nothing to obey. That is the same finding page 09 opens with, and
`nosniff` is only the backstop for it.

This matters most for user uploads served from your origin. `nosniff` plus a correct type
plus a separate origin is the actual defence; the header alone is one third of it.

## Framing

```console
x-frame-options     -> SAMEORIGIN
frame-ancestors     -> 'none'
```

`frame-ancestors` supersedes `X-Frame-Options` — modern browsers obey the CSP directive
and ignore the header when both are present. Keep both only while you care about
pre-2016 clients. `'none'` unless you have a reason; clickjacking against a state-changing
button is what it prevents, and it complements the CSRF work on
[page 11](./11-csrf.md).

## CORS is not one of these headers

```console
ACAO:* response read by a non-browser client -> {"secret":"visible"}
```

CORS **relaxes** the browser's same-origin rule; it does not restrict anyone. `curl`, a
server-side `fetch` and every attacker tool ignore it entirely. `Access-Control-Allow-Origin`
is not access control, and a permissive CORS policy is only a vulnerability in combination
with *cookie* authentication, where it can let another origin read authenticated
responses. With bearer tokens it usually means nothing at all.

The pair to be careful with is `Access-Control-Allow-Origin` reflecting the request's
`Origin` *plus* `Access-Control-Allow-Credentials: true` — that combination is a
cross-origin read of authenticated content, and browsers only refuse the literal `*` case.

## The cost

```console
added response bytes -> 356 per response (uncompressed)
helmet() per request -> 80.1 ms / 100k = 0.80 µs
```

Under a microsecond of CPU and a third of a kilobyte, which HTTP/2 header compression
mostly removes for repeat requests. There is no performance argument here.

For a **JSON API with no browser UI**, most of these headers are inert — no HTML means no
CSP surface, no framing, no sniffing of a `application/json` response you correctly typed.
The ones that still earn their place are `Strict-Transport-Security`, `nosniff`, and
`Cross-Origin-Resource-Policy`. Sending the rest costs nothing and answers the scanner.

## Gotchas

**Symptom:** CSP is set and XSS still executes
**Cause:** `'unsafe-inline'` in `script-src`, or a fixed nonce.
**Fix:** Remove `unsafe-inline`; generate the nonce per response. Helmet's default has no `unsafe-inline` for scripts — only for styles.

**Symptom:** A CSP was enabled and half the site broke
**Cause:** Enforcing mode first.
**Fix:** `Content-Security-Policy-Report-Only` with a `report-uri`, read the reports, then enforce.

**Symptom:** An uploaded `.txt` executes as HTML
**Cause:** MIME sniffing — the browser guessed from content rather than the declared type.
**Fix:** `X-Content-Type-Options: nosniff`, an explicit correct `Content-Type`, and a separate origin for user content.

**Symptom:** Subdomains became unreachable after adding helmet
**Cause:** Its default HSTS includes `includeSubDomains` with a one-year `max-age`.
**Fix:** Configure `hsts` explicitly and ramp `max-age`, per page 19.

**Symptom:** Headers are set but attackers read the API anyway
**Cause:** Expecting browser directives to constrain non-browser clients — CORS especially.
**Fix:** Authorization on the server. Headers are defence in depth for browser users only.

**Symptom:** A scanner reports the framework and version
**Cause:** `X-Powered-By`. Node sets none; Express sets it unless disabled — verified.
**Fix:** `app.disable('x-powered-by')`, or helmet, which removes it.

## Interview questions

**★ What does CSP actually protect against, and what makes one useless?**
It restricts where scripts, styles and other resources may come from, so an injected
`<script>` has no permitted origin to run from. It is useless with `'unsafe-inline'` in
`script-src` — that re-permits precisely what XSS injects — with `script-src *`, or with a
nonce reused across responses.

**★ How do you deploy a CSP without breaking the site?**
`Content-Security-Policy-Report-Only` with a `report-uri`. Nothing is blocked, violations
are collected, and you fix them before renaming the header to the enforcing form.

**★ Is CSP a replacement for output encoding?**
No — second line only. Encoding stops the injection; CSP limits what an injection that got
through can do. A site with a strong CSP and no encoding is one policy bypass from
compromise.

**★ Why is `X-Content-Type-Options: nosniff` needed if you set `Content-Type`?**
Because without it browsers may ignore the declared type and sniff the bytes, so
`text/plain` containing markup can execute as HTML. It is also the backstop for Node's own
default — a bare `node:http` response has no `Content-Type` at all.

**★ Is CORS a security control?**
No. It relaxes the browser same-origin policy; it constrains nobody else — verified, a
non-browser client read an `ACAO: *` response directly. It becomes dangerous only when
combined with cookie auth and a reflected `Origin` plus
`Access-Control-Allow-Credentials`.

**What does helmet cost, and is it enough?**
0.80 µs per request and 356 bytes of headers. It is a correct baseline, and the only part
that needs real thought is the CSP — the default keeps `'unsafe-inline'` for styles, and
its HSTS default includes `includeSubDomains`, which is a commitment.

---

← Prev: [Rate limiting](./21-rate-limiting.md) · Next → [Supply chain](./23-supply-chain.md)
