---
sidebar_position: 11
title: "If you can keep the pages static, you can keep a strict CSP: build-time SRI hashes and a header in next.config.js do what nonces do without turning off the CDN"
sidebar_label: "CSP without nonces: SRI and static headers"
description: "The two alternatives to nonce-based CSP — a static Content-Security-Policy header in next.config.js, and experimental Subresource Integrity hashing — plus third-party scripts, common violations, and how to choose."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [How to set a Content Security Policy (CSP) for your Next.js application](https://nextjs.org/docs/app/guides/content-security-policy) (docs `lastUpdated` 2026-03-20), [`headers` in `next.config.js`](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers), and the [`with-strict-csp` example](https://github.com/vercel/next.js/tree/canary/examples/with-strict-csp).
> Target: **Next.js 16.3.4**. Experimental SRI support was added in `v14.0.0` and is **App Router only**. Prior page: [10 · CSP: nonces and the dynamic-rendering tax](10-content-security-policy-nonces-and-the-dynamic-rendering-tax.md).

**The nonce is not the only way to run a strict CSP, and for most applications it is the wrong one. Two alternatives exist. A static `Content-Security-Policy` header configured in `next.config.js` costs nothing and keeps every page static — but it needs `'unsafe-inline'`, which is a real concession. Experimental Subresource Integrity hashing gives you a strict, inline-free policy *and* keeps static generation, because the hashes are computed at build time from files that will not change. The SRI route is the only option in the guide that is both strict and CDN-cacheable, and it is worth understanding precisely what "experimental" means here before you either adopt or dismiss it.**

## The static header

If your application does not actually require nonces, the docs let you skip the proxy entirely and set the CSP header directly in `next.config.js`:

```js filename="next.config.js"
const isDev = process.env.NODE_ENV === 'development'

const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
`

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, ''),
          },
        ],
      },
    ]
  },
}
```

Be honest about the trade. `script-src 'self' 'unsafe-inline'` allows any inline script on the page to execute — which is precisely the primitive most reflected-XSS payloads need. What this policy *does* still buy you is substantial and often undervalued:

| Directive | What it stops |
| --- | --- |
| `default-src 'self'` | Loading resources from attacker-controlled origins |
| `object-src 'none'` | Legacy plugin injection |
| `base-uri 'self'` | `base` tag hijacking that repoints every relative URL |
| `form-action 'self'` | Credential exfiltration by repointing a form |
| `frame-ancestors 'none'` | Clickjacking |
| `upgrade-insecure-requests` | Mixed-content downgrades |

Only one row of that table — the script one — is weakened by `'unsafe-inline'`. A team that concludes "we can't do CSP without nonces, so we'll skip CSP" has thrown away six controls to avoid conceding one.

The `source: '/(.*)'` pattern applies the header to every route including static assets. That is safe for a document policy, and unlike the proxy approach it costs no compute.

## Subresource Integrity: strict *and* static

Next.js ships **experimental** support for hash-based CSP built on Subresource Integrity, offered explicitly as the alternative to nonces. The claim attached to it is the one that matters: it lets you keep static generation while still running a strict CSP.

The mechanism is entirely build-time. Rather than minting a per-request value, SRI computes cryptographic hashes of your JavaScript files during the build and emits them as `integrity` attributes on the script tags. The browser then uses those attributes to verify that the files were not modified in transit.

```js filename="next.config.js"
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    sri: {
      algorithm: 'sha256', // or 'sha384' or 'sha512'
    },
  },
}

module.exports = nextConfig
```

Because the integrity attributes are independent of the policy, the CSP itself becomes the strict one you wanted — no `'unsafe-inline'`, no nonce:

```js filename="next.config.js"
const isDev = process.env.NODE_ENV === 'development'

const cspHeader = `
    default-src 'self';
    script-src 'self'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
`

module.exports = {
  experimental: {
    sri: {
      algorithm: 'sha256',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, ''),
          },
        ],
      },
    ]
  },
}
```

The docs list four benefits. **Static generation** — pages can still be statically generated and cached. **CDN compatibility** — those static pages work with CDN caching. **Better performance** — no server-side rendering is required on each request. And **build-time security** — hashes are generated at build time, which is what guarantees the integrity check.

Three limitations sit against them. The feature is **experimental**, and the docs say it may change or be removed. It is **App Router only** and is not supported in the Pages Router. And it is **build-time only**, so it cannot handle dynamically generated scripts.

"Build-time only" is the one that determines whether this works for you. Any script whose contents are decided at request time — a server-rendered inline JSON blob, a per-tenant configuration script, an analytics snippet templated with a user identifier — has no build-time hash and will be blocked. Data that must reach the client at request time should travel as data (a props value, an RSC payload, a `data-` attribute read by a hashed script), not as generated JavaScript.

The docs also note that the two mechanisms compose: for dynamic rendering scenarios you can still generate nonces in the proxy where you need them, running SRI integrity attributes and nonce-based CSP together rather than choosing between them.

That is the escape hatch for a mostly-static site with a handful of genuinely dynamic routes: SRI everywhere, plus a proxy scoped by matcher to only those routes.

## Third-party scripts

```tsx filename="app/layout.tsx"
import { GoogleTagManager } from '@next/third-parties/google'
import { headers } from 'next/headers'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nonce = (await headers()).get('x-nonce')

  return (
    <html lang="en">
      <body>
        {children}
        <GoogleTagManager gtmId="GTM-XYZ" nonce={nonce} />
      </body>
    </html>
  )
}
```

Note what this costs: reading `headers()` in the **root layout** makes every route in the application dynamic. If analytics is the only reason you adopted nonces, that is the entire performance bill of the previous page paid for a tag manager.

The policy additions:

```ts filename="proxy.ts"
const cspHeader = `
  default-src 'self';
  script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com;
  connect-src 'self' https://www.google-analytics.com;
  img-src 'self' data: https://www.google-analytics.com;
`
```

Three directives for one integration, and that is the minimum: the tag manager's own script, the beacon endpoint it posts to, and the tracking pixel it loads. Every third-party tool expands the policy along all three axes, and a tag manager that lets marketers add further tags at runtime expands it unpredictably — which is a governance problem, not a technical one.

## The violations you will actually hit

The guide enumerates four common violations and the remedy for each. **Inline styles**: either use a CSS-in-JS library that supports nonces, or move the styles into external files. **Dynamic imports**: make sure your `script-src` policy actually permits them. **WebAssembly**: add `'wasm-unsafe-eval'` if the application uses WASM. **Service workers**: add the appropriate policies for the service worker's own scripts.

Inline styles are the one that surprises people. A CSS-in-JS runtime injects `style` elements during render; unless it accepts a nonce, `style-src 'self'` blocks them and the page renders unstyled. This is why the documented development policy relaxes `style-src` to `'unsafe-inline'` while keeping `script-src` strict — and why a build-time CSS solution (CSS Modules, Tailwind, or any library that emits a stylesheet rather than runtime `style` tags) removes the problem entirely rather than working around it.

Dynamic imports are what `'strict-dynamic'` exists for: a nonce-trusted script loading further chunks. Without it, every chunk URL would need enumerating.

## Production issues the docs call out

Three production problems the guide names, with its own diagnosis for each. **Nonce not applied** — check that your proxy is actually running on all the routes that need it. **Static assets blocked** — verify that your CSP permits Next.js's own static assets. **Third-party scripts** — add the required domains to the policy.

The first one is the matcher problem in reverse: a matcher tightened to exclude prefetches and assets can also, through one regex mistake, exclude a real route — which then renders with no policy at all. A CSP that silently stops applying is worse than one that visibly breaks, because nothing reports it.

## Choosing

| | Static header | SRI | Nonce |
| --- | --- | --- | --- |
| Blocks inline script injection | No | Yes | Yes |
| Pages stay static | Yes | Yes | No |
| CDN-cacheable | Yes | Yes | No |
| Works with PPR | Yes | Yes | No |
| Works with ISR | Yes | Yes | No |
| Handles request-time generated scripts | n/a | No | Yes |
| Stability | Stable | Experimental | Stable |
| Router support | Both | App Router only | Both |

Read top to bottom rather than left to right. If nothing in your application generates script *content* at request time — which is true of most applications — the nonce column buys you nothing that SRI does not, and costs you five rows.

## Version history

| Version | Change |
| --- | --- |
| `v14.0.0` | Experimental SRI support added, for hash-based CSP |
| `v13.4.20` | The version from which Next.js is recommended for proper nonce handling and CSP header parsing |

The SRI feature has been experimental for two major versions. **I could not confirm from the documentation any plan or timeline for stabilising it**; the limitation note still says the feature *"may change or be removed"*, and that should be weighed as a real risk on a long-lived application.

## Gotchas

**★ Rejecting CSP entirely because you cannot avoid `'unsafe-inline'`.**
`'unsafe-inline'` weakens exactly one directive. `default-src`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` and `upgrade-insecure-requests` all still function, covering clickjacking, `base`-tag hijacking, form exfiltration, plugin injection and mixed content. Ship the static header first, then improve the script directive.

**★ Adopting SRI while the application still emits request-time inline scripts.**
SRI hashes are computed at build time. A server-rendered configuration script, a per-tenant snippet, or an analytics tag templated with a user identifier has no build-time hash and is blocked. The fix is to move the varying part into data — an RSC prop, a `data-` attribute, or a JSON response — read by a script that *is* hashable.

**★ Reading `headers()` in the root layout to nonce a tag manager.**
The root layout wraps every route, so a `headers()` call there makes the entire application dynamic. If a third-party tag is the only reason nonces exist in your app, you have paid the full dynamic-rendering bill — no ISR, no PPR, no CDN caching — for analytics. Consider loading the tag from a hashed script that reads its configuration from a `data-` attribute instead.

**★ Assuming `'strict-dynamic'` and a host allowlist work together.**
Browsers that honour `'strict-dynamic'` ignore host-source expressions in the same directive. A `script-src 'self' 'nonce-…' 'strict-dynamic' https://cdn.example.com` reads as though the CDN is allowed, and in a `'strict-dynamic'`-aware browser it is not — the CDN script is allowed only if a trusted script loaded it. Policies that "work in one browser and not another" are usually this.

**★ Blocking your own CSS-in-JS runtime with `style-src 'self'`.**
Runtime style injection creates `style` elements the policy has not authorised, and the page renders unstyled with no JavaScript error. Either use a library that accepts a nonce, or move to a build-time CSS strategy so no runtime injection happens at all — the second removes the class of problem instead of managing it.

**★ Forgetting `'wasm-unsafe-eval'` when the app loads WebAssembly.**
WASM instantiation is governed by `script-src` and requires `'wasm-unsafe-eval'` in a strict policy. It is not covered by `'self'`, and the failure appears as an instantiation error rather than as a CSP report, which sends people debugging the WASM module.

**★ A matcher regex that silently drops a real route.**
The recommended matcher excludes `api`, `_next/static`, `_next/image`, `favicon.ico` and prefetches. One character wrong in that negative lookahead and a genuine route stops receiving the header — and a missing CSP produces no error anywhere. Assert the header's presence in an end-to-end test on a representative route rather than trusting the regex by inspection.

**★ Shipping SRI on a Pages Router application.**
It is App Router only. On Pages Router the config is accepted and the integrity attributes do not appear, leaving you with a strict policy and no way to satisfy it — a fully broken site with a correct-looking configuration.

**★ Treating an experimental feature as a permanent architectural decision.**
SRI has been experimental since `v14.0.0` and the docs still say the feature may change or be removed. That is acceptable for a policy layer you can swap for a static header in one commit; it is not acceptable if your compliance evidence names it. Keep the fallback policy written down.

**★ Setting the CSP in `next.config.js` headers *and* in the proxy.**
Both apply. Browsers enforce multiple `Content-Security-Policy` headers as the *intersection* of the policies, so the result is stricter than either — usually strict enough to block your own scripts, and confusing to debug because each policy looks correct on its own. Pick one delivery mechanism.

## Interview questions

**★ You cannot use nonces because the site must stay on a CDN. What are your options?**
Two. A static `Content-Security-Policy` header in `next.config.js`, which keeps everything static but needs `'unsafe-inline'` in `script-src`. Or experimental SRI, which hashes your JavaScript at build time, adds `integrity` attributes, and lets you ship a genuinely strict policy — no nonce, no `'unsafe-inline'` — while keeping static generation and CDN caching. SRI is the only option that is both strict and cacheable.

**★ What does a CSP with `'unsafe-inline'` still protect against?**
Everything except inline script execution. `default-src 'self'` restricts where resources may be loaded from; `object-src 'none'` blocks legacy plugin injection; `base-uri 'self'` prevents a `base` tag from repointing every relative URL; `form-action 'self'` prevents credential exfiltration through a repointed form; `frame-ancestors 'none'` prevents clickjacking; `upgrade-insecure-requests` prevents mixed-content downgrades. Six controls survive; one is weakened.

**★ Why can SRI keep pages static when nonces cannot?**
Because a hash of a file is a property of the file, not of the request. It can be computed at build time and remains valid for every visitor, so the HTML containing the `integrity` attribute is identical for everyone and can be prerendered and cached. A nonce is a per-request secret and, by definition, cannot appear in a shared artefact.

**★ What breaks under SRI that works under nonces?**
Anything whose script *content* is produced at request time — a server-rendered configuration or state blob, a per-tenant snippet, an analytics tag templated with a user identifier. The docs state the limitation as being build-time only: SRI cannot handle dynamically generated scripts. The remedy is to pass request-time information as data rather than as generated code.

**★ Can you combine SRI and nonces?**
Yes, and the docs suggest it for mixed applications — for dynamic rendering scenarios you can still generate nonces in the proxy, combining SRI integrity attributes with the nonce-based approach. The practical shape is SRI for the whole site plus a proxy matcher scoped to only the routes that genuinely need per-request scripts, so the dynamic-rendering cost is paid only where it is earned.

**★ Adding Google Tag Manager under a strict CSP requires which directives, and what is the hidden cost?**
`script-src` must allow `https://www.googletagmanager.com` (or trust it via `'strict-dynamic'` from a nonce-carrying script), `connect-src` must allow `https://www.google-analytics.com` for the beacon, and `img-src` must allow it for the tracking pixel. The hidden cost is that reading the nonce with `headers()` in the root layout makes the entire application dynamically rendered — and that a tag manager which lets non-engineers add further tags expands the policy in ways no code review sees.

**★ A CSS-in-JS page renders unstyled in production with a strict policy. Why?**
Runtime style injection creates `style` elements that `style-src 'self'` does not authorise. Nothing throws — CSP blocks silently from the page's perspective. Either use a library that accepts the nonce, or move to build-time CSS so no runtime injection occurs. Note that the docs' own development policy relaxes `style-src` to `'unsafe-inline'` for exactly this reason.

**★ Why is setting the CSP in both `next.config.js` and the proxy a bug rather than belt-and-braces?**
Because browsers enforce multiple `Content-Security-Policy` headers as an intersection, not a union. The effective policy is the strictest combination of both, which will usually block resources each policy individually permits, and neither header looks wrong when inspected alone. Choose one delivery mechanism and keep the policy in one place.

{/* FOOTER */}
