---
title: "A Vite production build emits no inline script by default, so a strict Content-Security-Policy with no unsafe-inline mostly just works — until html.cspNonce enters the picture, and it was built for a server-rendered app, not a static SPA"
sidebar_label: "01m · Content-Security-Policy"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Features](https://vite.dev/guide/features) (`html.cspNonce`), [Shared Options](https://vite.dev/config/shared-options) (`html.cspNonce`). Documentation-validated; **no sandbox run, no timings**. Additional context: [vitejs/vite issue #20531](https://github.com/vitejs/vite/issues/20531), naming the SPA-specific limitation quoted below. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

**The good news first: a default Vite production build gives a strict Content-Security-Policy very little to fight.** Every script and stylesheet Vite writes into `index.html` is an external `<script src>` or `<link href>` reference to a hashed file — there is no inline `<script>` body and no inline `<style>` block anywhere in the default output. A CSP with `script-src 'self'` and no `'unsafe-inline'` is compatible with that output as-is. The complication arrives the moment you need `html.cspNonce` — either because a plugin or your own code does inject something inline, or because you want `strict-dynamic` — and the mechanism behind it was designed with an assumption that a plain static SPA deploy does not satisfy.

## What ships inline by default: nothing, confirmed

Vite's automatic optimizations — modulepreload directives, the dynamic-import waterfall rewrite covered in [11 · Optimization and performance](../11-optimization-and-performance/01g-preloading-and-cache-granularity.md) — all manifest as additional `<link>` tags and rewritten `import()` calls, not inline script bodies. The documentation's own description of the generated output is consistent with this: `<link rel="modulepreload">` for entries and their imports, `<link rel="stylesheet">` for extracted CSS, `<script type="module" src="...">` for the entry itself. **The documentation does not state whether `build.chunkImportMap` (an experimental option that emits an import map) produces that map as an inline `<script type="importmap">` or as an external reference** — if your project uses that experimental feature and enforces a strict CSP, verify the emitted tag directly against your own build output rather than assuming either shape.

## `html.cspNonce` — what it does, quoted

> *"When `html.cspNonce` is set, Vite adds a nonce attribute with the specified value to any `<script>` and `<style>` tags, as well as `<link>` tags for stylesheets and module preloading."* — [Features](https://vite.dev/guide/features)

> *"Additionally, when this option is set, Vite will inject a meta tag (`<meta property="csp-nonce" nonce="PLACEHOLDER" />`)."*

> `html.cspNonce` — type `string`. — [Shared Options](https://vite.dev/config/shared-options)

```typescript
// vite.config.ts — the option as documented
import { defineConfig } from 'vite';

export default defineConfig({
  html: {
    cspNonce: process.env.VITE_CSP_NONCE,
  },
});
```

The tags this attaches a `nonce="..."` attribute to are exactly the ones a CSP's `script-src`/`style-src` need to permit — `<script>`, `<style>`, and `<link rel="stylesheet">`/`<link rel="modulepreload">`. The injected `<meta property="csp-nonce">` tag exists so that any script running on the page **after** load can read the current nonce value back out — the documented use case is a framework or a piece of your own runtime code that needs to inject a further tag matching the same policy after the initial page has already rendered.

## The trap: a nonce is only meaningful if it's fresh on every request

A CSP nonce's entire security property depends on unpredictability **per response** — an attacker who can guess or observe the nonce for one response can craft a malicious script tag carrying that same nonce value and have the browser trust it. This is precisely what a static, pre-built SPA cannot provide on its own:

> *"if you build a SPA with `vite build`, the nonce will be generated only once, which is not secure at all, as it should be different for every request."* — reported against the html.cspNonce documentation, [vitejs/vite#20531](https://github.com/vitejs/vite/issues/20531)

Read literally: `vite build` runs once. Whatever string you pass as `html.cspNonce` at that moment is baked into `dist/index.html` as a literal attribute value — exactly the same class of fact as `VITE_*` variables in [01h](01h-env-baking-and-runtime-config.md). It does not change per visitor, per request, or per day. A static file server has no mechanism to swap it out per request, because a static file server serves the same bytes to everyone.

**`html.cspNonce` is a mechanism built for a server that renders the HTML per request** — an SSR app, or a backend-templated app in the shape covered in [01k](01k-manifest-and-backend-integration.md) — where the server generates a fresh random nonce for every response, injects it both into the HTML tags and into the `Content-Security-Policy` response header it sends alongside that HTML, and the two must match exactly for that request. For a pure static SPA build with no per-request server logic, a build-time nonce provides no real protection against the attack a nonce exists to stop, even though the tags and the meta element are all present and correctly formed.

```javascript
// server.js — the SSR/backend-templated shape where cspNonce is actually meaningful:
// a fresh nonce generated per request, matched between the header and the HTML.
import { randomBytes } from 'node:crypto';

app.use((req, res, next) => {
  res.locals.nonce = randomBytes(16).toString('base64');
  res.setHeader(
    'Content-Security-Policy',
    `script-src 'self' 'nonce-${res.locals.nonce}'; style-src 'self' 'nonce-${res.locals.nonce}'`,
  );
  next();
});

app.use('*', async (req, res) => {
  const { render } = await import('./dist/server/entry-server.js');
  // The SAME nonce, generated above for THIS request, has to reach the HTML Vite
  // produced — which means html.cspNonce cannot be a build-time vite.config.ts
  // constant here at all; it has to be threaded through per-request.
  const html = injectNonce(await render(req.originalUrl), res.locals.nonce);
  res.send(html);
});
```

That last comment is the crux: for a per-request-fresh nonce to work with an SSR app, `html.cspNonce` as a static `vite.config.ts` value is the wrong tool entirely, because the config is evaluated once, at build time — the nonce has to be substituted into the already-built HTML template per request by the server, a step outside anything `vite.config.ts` can express.

## Gotchas

**★ Symptom: `html.cspNonce` was configured for a static SPA deploy expecting it to satisfy a security review's CSP requirement, and the review correctly flags it as providing no real protection.** Cause: `vite build` runs once, so the configured nonce value is a fixed literal in every copy of `dist/index.html` served to every visitor — the core security property of a nonce, freshness per response, cannot exist in an artifact that is the same bytes for everyone. Fix: for a static SPA, prefer a CSP built around `'self'` and, if inline content is genuinely unavoidable, hash-based `script-src 'sha256-...'` values computed against the specific inline content at build time — not a nonce, which requires a per-request server to be meaningful.

**★ Symptom: `html.cspNonce`'s injected `<meta property="csp-nonce">` tag is present in the HTML, and a piece of runtime code that's supposed to read it back out gets a stale or generic-looking value.** Cause: whatever produced the HTML did not actually generate a fresh nonce for that specific request and thread it consistently between the response header and the meta tag — commonly, a build-time constant was reused across requests, or a caching layer served a previously rendered page whose nonce no longer matches the header the caching layer generates fresh. Fix: verify the nonce generation happens in the same per-request code path that sets the `Content-Security-Policy` header, and disable caching for any HTML response that carries a per-request nonce — caching one defeats the freshness the other depends on.

**★ Symptom: a strict CSP with no `'unsafe-inline'` was applied to a Vite-built SPA and nothing broke.** Not actually a gotcha — this is the expected, correct outcome, worth stating because teams sometimes assume Vite output needs `'unsafe-inline'` by default and add it defensively. Cause/context: default Vite output contains no inline `<script>` bodies or `<style>` blocks; every reference is external. Fix: nothing to fix — verify by inspecting your actual `dist/index.html`, and only add `html.cspNonce` (and accept its constraints above) if something genuinely does inject inline content, such as a plugin or the experimental `build.chunkImportMap`.

## Interview questions

**★ Why is `html.cspNonce` described as designed for a per-request server, and what specifically fails if you use it for a purely static SPA build?**
A nonce's security guarantee rests entirely on being unpredictable and unique per HTTP response — if the same nonce value is reused across responses, an attacker who has seen it in one legitimate response can attach it to an injected malicious script tag, and the browser has no way to tell the two apart. `vite build` executes exactly once, so whatever value is passed to `html.cspNonce` becomes a fixed string baked into every copy of the built `index.html` — the artifact is identical for every visitor and every request. There is no mechanism in a static file server to swap that literal out per request, so while the nonce attributes and the meta tag are all present and correctly formed, the freshness property that makes a nonce a security control rather than decoration simply cannot exist. The option only does its job when paired with a server that renders (or at minimum, rewrites) the HTML per request and can generate a matching, fresh nonce for the response header at the same time.

**★ A CSP for a Vite-built app forbids `'unsafe-inline'` in `script-src`. Does the default build output need an exception, and why or why not?**
No exception is needed by default, because Vite's build never emits inline script bodies for its own output — every script it writes is an external `<script type="module" src="...">` reference to a hashed file in `dist/`, and the same is true for stylesheets via `<link rel="stylesheet">`. A strict policy with no `'unsafe-inline'` is therefore compatible with an unmodified Vite production build as-is. The exception would only become necessary if something else in the pipeline introduces genuinely inline content — a plugin that injects an inline `<script>` for analytics bootstrapping, hand-written inline styles in a hand-authored backend template, or an experimental feature whose output shape hasn't been fully audited against the policy — at which point the correct tool is either removing the inline content, switching to `html.cspNonce` with a server that can make nonces per-request meaningful, or a `script-src 'sha256-...'` hash pinned to that specific inline content's fixed value.

---

← [01l · Module preload & the polyfill](01l-module-preload-and-the-polyfill.md) · [Vite overview](../../README.md) · Next → [01n · Docker build-args vs runtime env](01n-docker-build-args-vs-runtime-env.md)
