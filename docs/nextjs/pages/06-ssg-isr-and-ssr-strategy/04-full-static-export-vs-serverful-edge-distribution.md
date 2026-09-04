---
title: "A static export is not a rendering mode, it is a smaller framework — `output: 'export'` removes thirteen documented features, and five of the removals are really just 'move this into your CDN's configuration console'"
sidebar_label: "04 · Static export: what it removes"
sidebar_position: 25
description: "What next.config's output: 'export' actually emits in Next.js 16.3.4, the complete verbatim list of thirteen unsupported features, what each one costs, and the Headers entry that means less than it looks."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How to create a static export](https://nextjs.org/docs/app/guides/static-exports) (docs `lastUpdated` 2026-08-25), [`output`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) (`lastUpdated` 2025-10-08) and [Deploying](https://nextjs.org/docs/app/getting-started/deploying) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified (T2); `next` is **not installed in this checkout**, so **no package probe and no sandbox run** — every claim below is quoted from the docs, or explicitly marked uncertain.

**Teams reach for `output: 'export'` because it sounds like a deployment choice — "same app, cheaper hosting." It is not. It is a *feature* choice that happens to be spelled as a config key: thirteen documented capabilities stop existing, and several are ones you use without ever naming, like a redirect in `next.config.js` or a Content-Security-Policy header. Read the escape-hatch column of the table below and the real shape of the trade appears — five of the thirteen resolve to "do it in your CDN's configuration instead", which relocates infrastructure out of a reviewed, typed repository and into a console. This chunk is the inventory of what goes. [04b](04b-what-survives-and-the-force-static-trap.md) is the inventory of what stays, plus the one flag that turns a loud failure into a silent one.**

## What `output: 'export'` actually emits

One key, and the doc's own optional neighbours:

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',

  // Optional: Change links `/me` -> `/me/` and emit `/me.html` -> `/me/index.html`
  // trailingSlash: true,

  // Optional: Prevent automatic `/me` -> `/me/`, instead preserve `href`
  // skipTrailingSlashRedirect: true,

  // Optional: Change the output directory `out` -> `dist`
  // distDir: 'dist',
}

module.exports = nextConfig
```

> *"When running `next build`, Next.js generates an HTML file per route. By breaking a strict SPA into individual HTML files, Next.js can avoid loading unnecessary JavaScript code on the client-side, reducing the bundle size and enabling faster page loads."*

> *"After running `next build`, Next.js will create an `out` folder with the HTML/CSS/JS assets for your application."*

For the routes `/` and `/blog/[id]`, the documented output is `/out/index.html`,
`/out/404.html`, `/out/blog/post-1.html`, `/out/blog/post-2.html`. There is no server, no
manifest interpreter, no function — a directory of files.

Navigation between those files is still client-side:

> *"Since route transitions happen client-side, this behaves like a traditional SPA."*

That sentence is why an export is not the same as a hand-written static site. The first paint
comes from the `.html` file the host served; every subsequent `Link` navigation fetches that
route's static payload and re-renders on the client. You get file-per-route *and* SPA
transitions, which is genuinely the best property of this mode.

**⚠️ The config reference will not help you.** The [`output`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) page in 16.3.4 documents output
file tracing and `output: 'standalone'`, and **does not mention `'export'` at all**. The guide
is the only reference for it. If a teammate says "it's in the config docs", it is not.

**⚠️ `next export` the command no longer exists.** From the guide's version history:
`v13.3.0` — *"`next export` is deprecated and replaced with `"output": "export"`"*; `v14.0.0` —
*"`next export` has been removed in favor of `"output": "export"`"*. A tutorial that runs
`next export` is at least three majors stale. `v13.4.0` is where App Router support arrived:
*"App Router (Stable) adds enhanced static export support, including using React Server Components and Route Handlers."*

Serving the result needs a rewrite rule you must write yourself. The doc's own Nginx block:

```nginx
server {
  listen 80;
  server_name acme.com;

  root /var/www/out;

  location / {
      try_files $uri $uri.html $uri/ =404;
  }

  # This is necessary when `trailingSlash: false`.
  # You can omit this when `trailingSlash: true`.
  location /blog/ {
      rewrite ^/blog/(.*)$ /blog/$1.html break;
  }

  error_page 404 /404.html;
  location = /404.html {
      internal;
  }
}
```

## The thirteen unsupported features, verbatim

> *"Features that require a Node.js server, or dynamic logic that cannot be computed during the build process, are **not** supported:"*

| # | Doc's wording | What it costs you | Escape hatch |
|---|---|---|---|
| 1 | *"Dynamic Routes with `dynamicParams: true`"* | No on-demand generation of an unlisted path | Set `dynamicParams = false` and enumerate |
| 2 | *"Dynamic Routes without `generateStaticParams()`"* | Every dynamic segment fully enumerated at build | Enumerate, or make the route client-fetched |
| 3 | *"Route Handlers that rely on Request"* | No query, body, method or header reads in a handler | `GET` + `force-static` handlers still emit files |
| 4 | *"Cookies"* | `cookies()` — no session read, no flag, no locale cookie | Read `document.cookie` in a Client Component |
| 5 | *"Rewrites"* | `next.config.js` `rewrites` do nothing | Do it in Nginx / CloudFront / Cloudflare config |
| 6 | *"Redirects"* | `next.config.js` `redirects` do nothing | Host-level redirect rules |
| 7 | *"Headers"* | `next.config.js` `headers` — **no CSP, HSTS or cache-control from Next** | Host-level headers: `add_header`, `_headers`, CDN policy |
| 8 | *"Proxy"* | No `proxy.ts` — no auth gate, no geo rewrite, no tenant resolution | An edge worker at the CDN, or nothing |
| 9 | *"Incremental Static Regeneration"* | Content changes require a full rebuild and redeploy | Rebuild on a CMS webhook |
| 10 | *"Image Optimization with the default `loader`"* | No `/_next/image` resizing endpoint | Custom loader — see [04b](04b-what-survives-and-the-force-static-trap.md) |
| 11 | *"Draft Mode"* | No CMS preview that bypasses the cache | Preview against a second, serverful deploy |
| 12 | *"Server Actions"* | No mutations — every write goes to a separate API | `fetch` an external API from a Client Component |
| 13 | *"Intercepting Routes"* | No modal-over-a-route, no parallel-route interception | Client-side modal state |

Read the escape-hatch column carefully: **five of the thirteen are "move the work into your
CDN configuration."** That is the real shape of the trade. A static export does not delete
rewrites, redirects, headers and edge auth from your system; it moves them out of a
version-controlled, typed, reviewable `next.config.js` and `proxy.ts` into whatever
configuration language your host speaks, where nothing in your test suite covers them.

### The grouping that predicts what will break

- **The request is gone** (4, 3, and by implication `headers()`). Nothing in the build knows
  who is asking. Personalisation, auth, locale-by-cookie and geo move to the client, or do
  not happen.
- **The routing layer is gone** (5, 6, 7, 8, 13). Everything Next.js does *before* a page
  renders — rewrite, redirect, header injection, proxy, interception — has no place to run.
- **Post-build regeneration is gone** (9, 11). The only way content changes is a new build.
  This is the item that makes a marketing team unhappy six months in, not on day one.
- **Mutation is gone** (12). A form now needs somewhere else to POST.
- **Enumeration is mandatory** (1, 2). Build duration becomes linear in content count with no
  long-tail relief — precisely the relief that
  [02 · `generateStaticParams` at scale](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md)
  is about.

The removals are also why the deployment table in the [Deploying](https://nextjs.org/docs/app/getting-started/deploying) guide reads the way it does — Node.js
server: **All**; Docker container: **All**; Static export: **Limited**; Adapters: **Varies**.

> *"Running as a static export **does not** support Next.js features that require a server."*

### 🔴 On `Headers` — the entry that means less than it looks

Item 7 links to `/docs/app/api-reference/config/next-config-js/headers`, the **config option**,
not the `headers()` request function. The `headers()` function is *not* separately enumerated
in the unsupported list. It is covered only indirectly, by the Server Components section
(*"unless they consume dynamic server functions"*, anchored to the unsupported list) and by
this sentence from the Route Handlers section:

> *"If you need to read dynamic values from the incoming request, you cannot use a static export."*

**I could not confirm from the documentation which error a `headers()` call inside a page
produces under `output: 'export'`, or whether it is treated identically to `cookies()`.** Treat
both as unavailable — the mechanism, that no request exists at build time, admits no other
answer — but do not tell a colleague the docs enumerate `headers()`, because they do not.

## Gotchas

**★ Symptom: your Content-Security-Policy and HSTS headers vanish in production but work locally.** Cause: `headers` in `next.config.js` is item 7 — the key is still accepted by the config type and is simply never applied, because nothing is serving the response. Fix: move them to the host. On Nginx that is `add_header`; on Cloudflare Pages and Netlify it is a `_headers` file; on S3 + CloudFront it is a response-headers policy. Then assert them in CI with a request against the deployed URL, because no part of the Next.js build will ever fail for their absence.

**★ Symptom: `next.config.js` `redirects` are ignored and the old URLs 404 after a domain migration.** Cause: items 5 and 6 — `rewrites` and `redirects` need a server to execute them. Fix: translate every entry into host configuration *before* the cutover, and then delete the `next.config.js` copy rather than leaving it dead, so the next reader is not misled into believing it is live.

**★ Symptom: a route works in development but 404s in production for values that are not on the list.** Cause: item 1 — `dynamicParams: true` is unsupported, so an unlisted `/blog/[id]` has no file in `out/` and `try_files` falls through to `=404`. Fix: `export const dynamicParams = false` so dev and prod behave identically, and make `generateStaticParams` the single source of truth for what exists.

**★ Symptom: `next build` gets slower every sprint and eventually times out in CI.** Cause: items 1 and 2 make full enumeration mandatory, so build duration is linear in content count. The "prerender the top thousand, generate the tail on demand" strategy from [02](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md) is exactly the strategy static export removes. Fix: cap what you export and client-fetch the tail, or accept this growth curve deliberately and budget for a serverful mode before it becomes urgent — see [04d](04d-the-migration-back-and-the-one-way-door.md).

**★ Symptom: a form submits and nothing happens; the network tab shows a POST to the page's own URL that 404s.** Cause: item 12 — a Server Action is a POST to the route where it is used, and there is no server on that route. Fix: the action becomes a `fetch` from a Client Component to an API you host elsewhere. The progressive-enhancement property Server Actions gave you — a form that works before hydration — is gone and cannot be recovered in this mode. See [ch4 · Server Actions](../04-data-fetching-in-the-app-router/05-server-actions-mutations-form-submissions-progressive-enhanc.md).

**★ Symptom: the CMS preview button opens the published page, not the draft.** Cause: item 11 — Draft Mode sets a cookie and bypasses caches, and both halves require a server. Fix: run preview as a *second*, serverful deployment of the same repository pointed at the draft API, and give editors that URL. Static export and CMS preview are not reconcilable inside one deploy.

**★ Symptom: `proxy.ts` exists, is committed, has a matcher, and never runs.** Cause: item 8. Fix: if the logic was authentication it must move to a CDN worker or be abandoned; if it was a rewrite it moves to host config. 🔴 Do not leave the file in the repository — a `proxy.ts` that cannot run is a security control that a reviewer will believe is enforcing something.

**★ Symptom: an intercepting route renders as a full page instead of a modal.** Cause: item 13. Fix: implement the modal with client state and a shallow URL update, or keep the route and accept the full-page navigation. There is no server-side interception without a server.

**★ Symptom: the site works when you open `out/index.html` locally but every deep link 404s on the host.** Cause: the export emits `/out/blog/post-1.html`, and a plain file server asked for `/blog/post-1` does not try the `.html` suffix. Fix: the `try_files $uri $uri.html $uri/ =404;` rule above, or `trailingSlash: true` so every route becomes a directory with an `index.html` and ordinary directory-index behaviour finds it.

**★ Symptom: someone "fixed" the missing ISR by adding `export const revalidate = 60`, and the build passes.** Cause: nothing rejects it; item 9 means there is no runtime to act on the value. Fix: delete it and rebuild on a CMS webhook instead. A `revalidate` in a static export is a comment that looks like a guarantee — and under Cache Components the export is `v16.0.0`-removed anyway, see [ch4 · the segment config surface](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md).

**Symptom: `output: 'export'` is set and `next build` still succeeds while `proxy.ts`, `redirects` and a Server Action are all present.** Cause: the guide's error guarantee is worded for `next dev` — *"Attempting to use any of these features with `next dev` will result in an error"* — and the docs do not restate it for `next build`. Fix: do not rely on the build to police this. Run the app under `next dev` with `output: 'export'` set in the same config CI builds with, and treat that as the check. Configuring export only in a production-only config branch is how these get to production unnoticed.

## Interview questions

**★ Why is `output: 'export'` a feature decision rather than a hosting decision?**
Because thirteen documented capabilities stop existing, and most of them are not things you would list if asked what your app uses. Nobody says "our architecture depends on `next.config.js` redirects" — but the redirects are there, and after an export they silently stop applying. The honest framing is that an export is a different, smaller framework that shares your source tree. The hosting saving is real, and it is downstream of the feature loss rather than independent of it.

**★ You need a redirect from `/old-pricing` to `/pricing` under a static export. Where does it live, and what did you lose?**
In host configuration — an Nginx `return 301`, a CloudFront function, a `_redirects` file. What you lost is that the rule is no longer in the repository the application team reviews, no longer typed, and no longer exercised by any test that runs on a pull request. Five of the thirteen unsupported items resolve this way, which is why "static export simplifies our infrastructure" is usually false: it relocates infrastructure from code into console configuration, and console configuration has no code review.

**★ What does `output: 'standalone'` have to do with `output: 'export'`?**
Nothing except the config key, and the collision causes real confusion. `'standalone'` is the *serverful* option: output file tracing via `@vercel/nft`, plus a copied `node_modules` subset and a minimal `server.js`, for running the full framework in a small container with every feature intact. `'export'` produces no server at all. They are opposite ends of one key — and the `output` config reference documents only `'standalone'`, so a reader who looks up `output` never sees `'export'` described at all.

**★ If a Next.js app must run on a platform with no Node.js, is static export the only answer?**
It is the only first-party answer, but state the requirement precisely first. The docs' minimum is blunt — *"To run Next.js, your platform needs a Node.js server. That's it."* — and a single `next start` process handles every feature correctly. So the real question is rarely "can we run Node" and usually "do we want to operate a process." If the answer to the second is no but the first is yes, a container on a managed runtime keeps all thirteen features while an export gives them up. [04c](04c-when-export-wins-and-what-a-server-buys.md) works through the cases where giving them up is still correct.

**★ Which of the thirteen removals would you expect a team to discover last, and why?**
Draft Mode and ISR — items 11 and 9. Both are invisible on day one because the site is new and the content is fresh, and both surface months later through people who were not in the architecture meeting: an editor who wants to preview an unpublished post, and a marketing lead who wants a price change live without a deploy. Every other item fails during development, loudly. These two fail as a process complaint, which is why they get argued about rather than fixed.

**★ A colleague argues that `dynamicParams: false` is not really a loss, since you can enumerate everything. What is the counter-argument?**
That the loss is not correctness, it is the shape of the build. With on-demand generation, build time is bounded by however many paths you *chose* to prerender and the long tail costs nothing at build. With enumeration mandatory, build time is a function of content volume, which grows without anyone deciding to grow it. The failure is not a wrong page; it is a CI job that crosses a timeout during a release, with no code change to blame.

---

← [03 · ISR at enterprise level](03-isr-at-enterprise-level-stale-while-revalidate-tuning.md) · [Chapter 6 overview](01-explanation.md) · Next → [04b · What survives, and the `force-static` trap](04b-what-survives-and-the-force-static-trap.md)
