---
title: "`remotePatterns` is not configuration, it is an allow-list deciding who may hand bytes to a native decoder running on your server — and every field you omit widens it to `**`"
sidebar_label: "04d · remotePatterns"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js Image component API reference
> ([nextjs.org/docs/app/api-reference/components/image](https://nextjs.org/docs/app/api-reference/components/image)),
> sections `#remotepatterns`, `#localpatterns`, `#maximumredirects`, `#maximumresponsebody`,
> `#dangerouslyallowlocalip`, `#dangerouslyallowsvg`, `#contentsecuritypolicy`, `#domains`
> (page header declares `version: 16.3.4`, `lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**.
> 🔴 `next` is **not installed in this checkout** — no T1 probe was possible; every rule below
> is quoted. **No sandbox run, no requests issued.** The 2026 image-decoder incident itself is
> owned by [ch18 · supply-chain vigilance](../18-advanced-ecosystem-topics/03b-supply-chain-vigilance.md)
> and the CVE record by ch10; this page draws the operational conclusion and does not re-derive them.

**Writing `hostname: '**'` to make a 400 go away is the most consequential line most Next.js developers ever add to a config file, and it is usually added at 11pm during a demo. `/_next/image` is a public, unauthenticated endpoint that takes a URL from the query string, fetches it, and feeds the response to a native image decoder inside your server process. `remotePatterns` is the only thing standing between that decoder and the entire internet. It is an access-control list wearing the costume of a build setting, and the reference's own wording — "allow images from specific external paths and block all others" — is the language of an allow-list, not of a convenience.**

## The mechanism

> *"Use `remotePatterns` in your `next.config.js` file to allow images from specific external paths and block all others. This ensures that only external images from your account can be served."*

A `src` that is an absolute URL is matched against every entry. If none matches:

> *"Any other protocol, hostname, port, or unmatched path will respond with `400` Bad Request."*

Two spellings are accepted. The `URL` form landed in `v15.3.0` and is the terser one; the object form is the one you need for wildcards.

```js
// next.config.js — URL form
module.exports = {
  images: {
    remotePatterns: [new URL('https://cdn.sprintdesk.io/tenants/**')],
  },
};
```

```js
// next.config.js — object form, every field stated
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sprintdesk.io',
        port: '',
        pathname: '/tenants/**',
        search: '',
      },
    ],
  },
};
```

That second config means, exactly: HTTPS only, that one host, the default port, a path under `/tenants/`, and **no query string at all**.

## 🔴 Every field you omit becomes `**`

This is the sentence to memorise, because it inverts the intuition that an unspecified field is "not checked":

> *"When omitting `protocol`, `port`, `pathname`, or `search` then the wildcard `**` is implied. This is not recommended because it may allow malicious actors to optimize urls you did not intend."*

So the friendly-looking minimal config is not a narrow rule with fewer conditions; it is a **wide** rule with three conditions silently set to "anything":

```js
// This is NOT "just the hostname". It is: any protocol, any port,
// any path, any query string — on that host.
remotePatterns: [{ hostname: 'cdn.sprintdesk.io' }]
```

On a shared object store, or any host that serves user-uploaded content under paths you do not control, "any path on that host" is a meaningfully different grant from "the `/tenants/` prefix".

### Wildcard syntax

> *"`*` match a single path segment or subdomain. `**` match any number of path segments at the end or subdomains at the beginning. This syntax does not work in the middle of the pattern."*

| Pattern | Matches | Does not match |
|---|---|---|
| `hostname: 'cdn.acme.com'` | that host exactly | `img.cdn.acme.com` |
| `hostname: '*.acme.com'` | `img.acme.com` | `a.b.acme.com`, `acme.com` |
| `hostname: '**.acme.com'` | `img.acme.com`, `a.b.acme.com` | `acme.com` |
| `pathname: '/t/*'` | `/t/123` | `/t/123/full` |
| `pathname: '/t/**'` | `/t/123`, `/t/123/full` | `/other/123` |
| `pathname: '/**/thumb'` | — **invalid**, `**` cannot sit mid-pattern | |

The reference confirms the subdomain case explicitly for `**.example.com`: *"This allows subdomains like `image.example.com`. Query strings and custom ports are still blocked."* — because in that example `search` and `port` were stated as `''`.

### `search` is the field people forget

The `search` property pins the query string, and its default-to-`**` behaviour matters more than it looks. `localPatterns` carries the plainest warning, and it applies to both:

> *"Omitting the `search` property allows all search parameters which could allow malicious actors to optimize URLs you did not intend. Try using a specific value like `search: '?v=2'` to ensure an exact match."*

Why does an unconstrained query string matter? Because `/_next/image` caches per source URL, and a source URL that differs only in a query parameter is a different cache entry. A host that ignores unknown parameters gives an attacker an unbounded family of distinct URLs that all resolve to the same image — every one of them a fresh transcode and a fresh disk write.

## `localPatterns` — the same control for your own `public/`

> *"Use `localPatterns` in your `next.config.js` file to allow images from specific local paths to be optimized and block all others."*

```js
module.exports = {
  images: {
    localPatterns: [{ pathname: '/assets/images/**', search: '' }],
  },
};
```

> *"The example above will ensure the `src` property of `next/image` must start with `/assets/images/` and must not have a query string. Attempting to optimize any other path will respond with `400` Bad Request error."*

This is the control people never set, because local paths feel trusted. They are trusted for *content*; they are not narrow for *cardinality*. If any route writes user-controlled files under `public/`, or if a path segment is user-supplied, `localPatterns` is what stops the optimizer being pointed at everything you ship.

## 🔴 Redirects are not re-validated

This is the sharpest edge on the page and it is easy to miss in the reference:

> *"Note that any allowed `remotePatterns` that respond with a redirect will follow the redirect from the remote image server without validating `remotePatterns` again on the redirect location. You can reduce or disable redirects by configuring `maximumRedirects`."*
> *"For your convenience, these redirects do not need to satisfy `remotePatterns`."*

Read that carefully. **An allowed host can redirect the optimizer anywhere.** Your allow-list constrains the *first* hop only. If the allowed host is a CDN you control end to end, that is fine. If it is a third-party image service, a user-configurable avatar provider, or anything that will 302 to a URL derived from its own input, your allow-list is one redirect deep.

> *"The default image optimization loader will follow HTTP redirects when fetching remote images up to 3 times."*

```js
// next.config.js — the strict posture: no redirect escape hatch at all.
module.exports = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sprintdesk.io', port: '', pathname: '/tenants/**', search: '' },
    ],
    maximumRedirects: 0,
  },
};
```

Set it to `0` unless you know why you need hops, and if you do need them, know that each one is outside the allow-list.

## The other four settings that are security settings

**`dangerouslyAllowLocalIP`** — default `false`. The name is the documentation:

> *"In rare cases when self-hosting Next.js on a private network, you may want to allow optimizing images from local IP addresses on the same network. This is not recommended for most users because it could allow malicious users to access content on your internal network."*
> *"This might be necessary when hosting Next.js in a VPC with split-horizon DNS and you receive status 400 Bad Request. Only enable once you understand the SSRF risk."*

That is server-side request forgery, named by the docs. The optimizer fetching a URL supplied by a client is the textbook SSRF shape; the local-IP block is what keeps it pointed outward.

**`dangerouslyAllowSVG`** — default off, for two stated reasons:

> *"SVG is a vector format meaning it can be resized losslessly. SVG has many of the same features as HTML/CSS, which can lead to vulnerabilities without proper Content Security Policy (CSP) headers."*
> *"We recommend using the `unoptimized` prop when the `src` prop is known to be SVG. This happens automatically when `src` ends with `".svg"`."*

If you must serve SVG through the endpoint, the reference pairs it with two more settings and does not treat either as optional:

```js
module.exports = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};
```

> *"it is strongly recommended to also set `contentDispositionType` to force the browser to download the image, as well as `contentSecurityPolicy` to prevent scripts embedded in the image from executing."*

The application-wide CSP story — nonces, the dynamic-rendering tax, static headers — is [ch10](../10-forms-authentication-and-security-hardening/10-content-security-policy-nonces-and-the-dynamic-rendering-tax.md); this one is the optimizer's own response header.

**`contentDispositionType`** defaults to `attachment` since `v15.0.0`:

> *"By default, the loader sets the `Content-Disposition` header to `attachment` for added protection since the API can serve arbitrary remote images."*

Changing it to `inline` means a stranger can hand out a link to `/_next/image?url=…` on *your* origin that renders in the browser. That is a hosted-content problem, not an image problem.

**`maximumResponseBody`** — default 50 MB.

> *"If you know all your source images are small, you can protect memory constrained servers by reducing this to a smaller value such as 5 MB."*

An allow-listed host that serves a very large file still costs you the fetch and the decode. This bounds it.

## Headers are never forwarded

> *"For security reasons, the Image Optimization API using the default loader will *not* forward headers when fetching the `src` image. If the `src` image requires authentication, consider using the `unoptimized` property to disable Image Optimization."*

This is why private, signed or cookie-gated images do not work through the optimizer, and the workaround is documented as giving up optimization rather than as a header pass-through. For SprintDesk, that means tenant-private attachments either go through short-lived signed URLs the optimizer can fetch anonymously, or they render `unoptimized` from a route handler that does the authorisation itself.

## ⚠ Deprecated: `domains`

> *"Warning: Deprecated since Next.js 14 in favor of strict `remotePatterns` in order to protect your application from malicious users."*
> *"the `domains` configuration does not support wildcard pattern matching and it cannot restrict protocol, port, or pathname. Since most remote image servers are shared between multiple tenants, it's safer to use `remotePatterns` to ensure only the intended images are optimized."*

The phrase *"shared between multiple tenants"* is the reason. `domains: ['storage.example.com']` on a shared object store grants every other customer of that store the ability to feed your decoder.

## The operational conclusion

The 2026 image-decoder incident — an unauthenticated RCE reached through a native AVIF decoder under `sharp`, mitigated upstream by disabling AVIF optimization — is written up in [ch18 · supply-chain vigilance](../18-advanced-ecosystem-topics/03b-supply-chain-vigilance.md), and the CVE record itself in [ch10 · the 2026 CVE record](../10-forms-authentication-and-security-hardening/14-the-2026-cve-record-eleven-vulnerabilities-and-what-each-one-teaches.md). **Do not re-derive it here.** The single conclusion this page needs from it:

🔴 **`remotePatterns` does not prevent decoder vulnerabilities. It decides how many parties can reach one.** A narrow allow-list turns "any host on the internet can trigger this" into "our own CDN can trigger this" — which is the difference between a page-out at 3am and an upgrade scheduled for Tuesday. The coarse-filter argument generalises in [ch10 · defense in depth](../10-forms-authentication-and-security-hardening/04-defense-in-depth-proxyts-as-a-coarse-filter.md).

## Gotchas

**★ Symptom: images 400 in production after a CDN change, and the fix that ships is `hostname: '**'`.** Cause: the allow-list is doing its job and the deadline is doing its job harder. Fix: add the specific host with all five fields stated. Keep a review rule that any wildcard hostname is a blocking comment, because this line never gets narrowed again once it lands.

```js
{ protocol: 'https', hostname: 'assets.sprintdesk.io', port: '', pathname: '/uploads/**', search: '' }
```

**★ Symptom: a config that "only allows one hostname" is accepting arbitrary paths and query strings on that host.** Cause: omitted fields imply `**` — *"When omitting `protocol`, `port`, `pathname`, or `search` then the wildcard `**` is implied."* Fix: state all five fields on every entry, always, even when the value is `''`.

**★ Symptom: the allow-list is narrow and the optimizer still fetched a host that is not on it.** Cause: an allowed host returned a redirect, and *"these redirects do not need to satisfy `remotePatterns`"* — the allow-list is only checked on the first hop. Fix: `maximumRedirects: 0`, or accept explicitly that any allowed host can redirect you anywhere.

**★ Symptom: the image cache grows without bound and disk fills on a self-hosted deployment.** Cause: unconstrained cardinality — an omitted `search` lets the same image be requested under unlimited distinct URLs, and each is its own cache entry. Fix: pin `search`, pin `qualities` (see [04](04-next-image-priority-blur-placeholders-remote-patterns-avif-w.md)), and bound the cache with `maximumDiskCacheSize` (see **04e** *(not written yet)*).

**★ Symptom: an authenticated image renders as a broken icon through `<Image>` but works when opened directly in the browser.** Cause: your cookie went with the browser request and did not go with the optimizer's — *"the Image Optimization API using the default loader will not forward headers when fetching the `src` image."* Fix: signed URLs the optimizer can fetch anonymously, or `unoptimized` on that image.

```tsx
<Image src={privateUrl} alt="" width={800} height={600} unoptimized />
```

**★ Symptom: an SVG logo returns 400.** Cause: SVG is not optimized by default. Fix: nothing — the reference says the `unoptimized` behaviour *"happens automatically when `src` ends with `".svg"`"*. If the URL does not end in `.svg`, pass `unoptimized` explicitly. Do **not** reach for `dangerouslyAllowSVG` for this; it is a different and much larger decision.

**Symptom: `dangerouslyAllowSVG: true` was added and nothing else.** Cause: the two companion settings were treated as optional. Fix: set `contentDispositionType: 'attachment'` and a restrictive `contentSecurityPolicy` in the same change, exactly as the reference pairs them.

**Symptom: self-hosting inside a VPC, and every internal image URL returns 400.** Cause: `dangerouslyAllowLocalIP` defaults to `false` and the host resolves to a private address under split-horizon DNS. Fix: the flag exists for this — but read its sentence first. Enabling it makes your public image endpoint able to fetch internal addresses, which is SSRF by construction. Prefer publishing the assets on a reachable public host.

**Symptom: `domains` is in the config and still works, so nobody migrates.** Cause: it is deprecated, not removed. Fix: migrate anyway — `domains` cannot restrict protocol, port or pathname, so on any shared host it grants far more than intended.

**Symptom: `/_next/image` URLs are being shared as links to arbitrary hosted content.** Cause: `contentDispositionType: 'inline'` was set, so the endpoint renders remote images in-browser on your origin. Fix: leave it at the `attachment` default unless you have a specific reason and have thought about who can construct those URLs.

**Symptom: a very large source image pins server memory on a small container.** Cause: the loader will fetch source images up to 50 MB by default. Fix: `maximumResponseBody` set to what your real assets actually need.

## Interview questions

**★ Why is `remotePatterns` described as a security control rather than a configuration convenience?**
Because it is the access-control list for a public, unauthenticated endpoint that performs native image decoding on your server using a URL supplied in the query string. The bytes that reach the decoder are chosen by whoever the pattern allows. With a specific host and path prefix, that is your CDN. With a wildcard hostname, it is anyone on the internet who can construct a URL. The pattern does not make the decoder safe — it decides the size of the set of parties who can hand it input, and that set size is what separates a scheduled upgrade from an incident.

**★ What does an omitted field in a `remotePatterns` entry mean?**
`**` — the widest possible match, not "unchecked" and not "default". Omitting `pathname` allows every path on the host; omitting `search` allows every query string; omitting `protocol` allows any protocol. The reference states this and immediately says it *"is not recommended"*. The practical rule is to write all five fields on every entry even when the value is the empty string, because the empty string and the omission mean opposite things.

**★ Your allow-list names exactly one host. Can the optimizer end up fetching from a different one?**
Yes. Allowed hosts may redirect, and the documentation says redirects are followed *"without validating `remotePatterns` again on the redirect location"* — up to three hops by default. So the allow-list constrains the first request only. If the allowed host is a third-party service whose redirect target is influenced by its own input, your allow-list is effectively as wide as that service. Setting `maximumRedirects: 0` closes it; anything above zero is a deliberate acceptance.

**★ How does the optimizer's cache turn a wide allow-list into a cost problem as well as a security problem?**
Every distinct combination of source URL, width, quality and negotiated format is a separate cache entry with a separate transcode. A wide pattern means an attacker controls the source URL; an omitted `search` means they can generate unlimited distinct URLs for the same image; an unbounded `qualities` list (before Next 16 made it required) multiplied that again. The result is CPU spent transcoding and disk spent storing, both driven by a stranger. Narrowing the patterns, pinning `search`, and declaring `qualities` all reduce the cardinality of that cache key — which is the same fix as the security fix.

**★ A teammate wants `dangerouslyAllowSVG: true` so designers can upload SVG logos. What is your response?**
That the flag's name is the argument, and that the docs give the reason: SVG has the same capabilities as HTML and CSS, so a served SVG can carry script. The right answer for logos is almost always `unoptimized`, which the component already applies automatically when the `src` ends in `.svg` — vector art is losslessly resizable, so there is nothing for the optimizer to do. If the flag genuinely must go on, it goes on together with `contentDispositionType: 'attachment'` and a restrictive `contentSecurityPolicy`, because the reference pairs all three and the two companions are what make it survivable.

**Why does the optimizer refuse to forward headers, and what does that force you to do for private images?**
Forwarding request headers would mean the shared, cacheable optimizer endpoint carrying a user's credentials to a third-party origin — and caching the result, which is worse. So the documented behaviour is not to forward them at all, with `unoptimized` named as the escape. Practically, private images take one of two shapes: short-lived signed URLs the optimizer can fetch anonymously, or an authenticated route handler that streams the bytes with the optimizer bypassed entirely. The second costs you resizing and format negotiation, which is the honest trade.

**Why was `domains` deprecated in favour of `remotePatterns`?**
Because `domains` could only express "this hostname", with no protocol, port or path constraint and no wildcard matching. The reference's stated reason is that most remote image servers are multi-tenant — so allowing a hostname on a shared object store allows every other tenant of that store to feed your image pipeline. `remotePatterns` can express the path prefix that distinguishes your bucket from theirs, which is the whole point.

**What is `localPatterns` for, if local files are already yours?**
For cardinality and for paths that are not really yours. Any route that writes user-supplied files under `public/`, and any `src` built from a user-supplied segment, means "local" no longer means "authored by us". `localPatterns` narrows which local paths the optimizer will touch and — with `search: ''` — stops the same local file being requested under an unlimited number of distinct cache keys.

---

← [04c · Blur placeholders](04c-blur-placeholders-where-the-bytes-come-from.md) · [Chapter index](01-explanation.md) · Next → **04e · Format negotiation** *(not written yet)*
