---
title: "A client-side router can produce a URL the file server has never heard of, and every managed hosting platform needs telling, in its own format, to serve index.html instead of a 404"
sidebar_label: "01d · SPA fallback: hosted platforms"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Deploying a Static Site](https://vite.dev/guide/static-deploy) — and each host's own documentation, named per section below. Documentation-validated; **no sandbox run**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ SPA fallback, host by host: the managed platforms

**A history-mode client-side router produces URLs — `/settings/profile`, `/orders/482` — that exist only inside the app's JavaScript, not as real files in `dist/`.** A user who navigates there from the app's own links is fine, because the router intercepts the navigation and never asks the server for anything. A user who refreshes the page, bookmarks it, or opens it as a direct link is not fine by default: the browser asks the file server for `/settings/profile` as an actual HTTP request, the server has no such file, and — absent a rewrite rule — returns a 404 instead of `index.html`. Every static host needs telling, in its own configuration format, to serve `index.html` (with a `200`, not a redirect) for any path that isn't a real file. ⚠️ Vite's own [static-deploy guide](https://vite.dev/guide/static-deploy) covers the *build and deploy steps* for most of these hosts but does not spell out the fallback rewrite rule for most of them — the configs below are quoted or sourced from each host's own current documentation, named per section.

This chunk covers the managed, Git-connected platforms — Netlify, Vercel, Cloudflare Pages, GitHub Pages. Self-managed infrastructure (S3 + CloudFront, nginx, Apache) is **[01e](01e-spa-fallback-self-managed-infrastructure.md)**.

## Netlify — `_redirects`

Source: [Netlify — Rewrites and proxies](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/), as of the docs at the time of writing.

> *"If you're developing a single page app and want the history `pushState` method to work so you get clean URLs, you'll want to add the following rewrite rule. If you have other redirect or rewrite rules, this is typically the last rule listed."*

```
# dist/_redirects (or public/_redirects, so it's copied verbatim into dist/ by Vite)
/*  /index.html  200
```

> *"This will effectively serve the `index.html` instead of giving a `404` no matter what URL the browser requests."*

The `200` is load-bearing, not incidental: Netlify's redirect files distinguish a rewrite (serve different content, same URL — status `200`) from a redirect (browser URL actually changes — status `301`/`302`). Placement matters too, per the same quote — if you have other rules (an API proxy, a legacy-path redirect), this catch-all belongs last, since Netlify evaluates redirect rules in order and a match short-circuits the rest.

For a Vite project, `_redirects` belongs in `public/` so it's copied into `dist/` unchanged by the mechanism in **[01b](01b-public-directory-and-publicdir.md)** — it is not something the build step generates.

## Vercel — `vercel.json` rewrites

Source: [Vercel — Rewrites](https://vercel.com/docs/rewrites), as of the docs at the time of writing.

> *"Rewrites are defined in a `vercel.json` file in your project's root directory"* … *"A rewrite routes a request to a different destination without changing the URL in the browser."*

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This is a same-application rewrite in Vercel's own terminology — routing within the project rather than proxying to an external origin — and it is unconditional by design here: every path that doesn't match a real static file falls through to `index.html`, letting the client-side router take over. `vercel.json` lives at the project root, not inside `public/` — it is Vercel's own build-time configuration file, read before the static files are served, not a file Vite needs to know about at all.

## Cloudflare Pages — automatic, unless you opt out

Source: [Cloudflare Pages — Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/), as of the docs at the time of writing.

Cloudflare Pages is the one platform in this list where the fallback is the *default* behavior, not something you configure:

> *"If your project does not include a top-level `404.html` file, Pages assumes that you are deploying a single-page application. This includes frameworks like React, Vue, and Angular. Pages' default single-page application behavior matches all incoming paths to the root (`/`), allowing you to capture URLs like `/about` or `/help` and respond to them from within your SPA."*

For a plain Vite SPA with no `public/404.html`, there is nothing to add — the platform already does the right thing. The gotcha runs the other direction: adding a genuine `404.html` (for a legitimately non-SPA static site, or a hybrid app that wants a real 404 page for truly missing assets) silently **disables** this automatic behavior, because its presence is exactly the signal Cloudflare uses to decide the site isn't an SPA.

## GitHub Pages — two separate problems, and only one of them is `base`

GitHub Pages has no server-side rewrite mechanism at all — no config file, no dashboard setting, nothing equivalent to `_redirects` or `vercel.json`. It serves static files, and a request for a path with no matching file gets its actual `404.html`, full stop. This produces two distinct failures that are easy to conflate:

**Failure one — `base` mismatch.** Covered in full in **[01](01-shipping-the-build.md)**: if `base` doesn't match `/<REPO>/` for a project site, every *asset* 404s and the page is blank. This has nothing to do with routing.

**Failure two — deep-link 404 on a correctly-based app.** Even with `base` set correctly, a request for `/project-name/settings/profile` — a route that exists only in the client-side router — has no matching file in the repo, and GitHub Pages returns its real `404.html`. There is no config setting to fix this, because GitHub Pages has no rewrite mechanism to configure.

The community workaround — not part of GitHub's or Vite's own documentation — is the `404.html` redirect trick popularized by [rafgraph/spa-github-pages](https://github.com/rafgraph/spa-github-pages):

> *"When the GitHub Pages server gets a request for a path defined with frontend routes, e.g. `example.tld/foo`, it returns a custom `404.html` page. The custom `404.html` page contains a script that takes the current url and converts the path and query string into just a query string, and then redirects the browser to the new url with only a query string and hash fragment."*

> *"the GitHub Pages server receives the new request, e.g. `example.tld/?/...`, ignores the query string and returns the `index.html` file, which has a script that checks for a redirect in the query string before the single page app is loaded."*

Mechanically: a custom `404.html` (placed in `public/` so Vite copies it into `dist/` verbatim, per **[01b](01b-public-directory-and-publicdir.md)`) encodes the requested path into a query string and does a client-side redirect to the site root; a small script in `index.html`, run before the app mounts, decodes that query string and restores the intended route via `history.replaceState` before the router ever sees anything. It works, but it round-trips through an actual browser redirect and a real 404 response on the way — a client-side patch over a genuine server limitation, not a rewrite rule in the nginx/Netlify sense.

> *"if you are setting up a Project Pages site and not using a custom domain (i.e. your site's address is `username.github.io/repo-name`), then you need to set `pathSegmentsToKeep` to `1` in the `404.html` file in order to keep `/repo-name` in the path after the redirect."*

That last quote is the trap: `pathSegmentsToKeep` is a **separate** setting from `base`, in a **different** file (`404.html`'s own script, not `vite.config.ts`), and it has to agree with the repo sub-path independently — getting `base` right and forgetting `pathSegmentsToKeep`, or vice versa, produces a working root page and a still-broken deep link.

## Gotchas

**★ Symptom: a Netlify `_redirects` file with the exact documented rule still doesn't take effect.** Cause: the file was placed in the project's `src/` or root directory rather than `public/`, so Vite's build never copies it into `dist/` — Netlify reads `_redirects` from the deployed output directory, not from the repository root. Fix: `_redirects` belongs in `public/_redirects`, so the mechanism in **[01b](01b-public-directory-and-publicdir.md)** carries it into `dist/_redirects` on every build.

**★ Symptom: a Vercel `vercel.json` rewrite to `/index.html` works for client-side routes, but an actual API route under `/api/*` now also serves `index.html` instead of running the serverless function.** Cause: the catch-all pattern `/(.*)`  matches everything, including paths that were supposed to be handled elsewhere, and rewrite rules apply in the order they're evaluated. Fix: order matters — any rule for a real route (an API path, a genuinely separate asset directory) needs to appear **before** the catch-all SPA fallback in the `rewrites` array, or use a source pattern that explicitly excludes those paths.

**★ Symptom: a Cloudflare Pages SPA fallback that used to work stopped working after adding a custom 404 page for a specific static-content section of the site.** Cause: *"If your project does not include a top-level `404.html` file, Pages assumes that you are deploying a single-page application"* — adding **any** top-level `404.html`, even one intended only for genuinely missing assets, flips Cloudflare's assumption and disables the automatic SPA-fallback routing for the entire deployment. Fix: for a hybrid site that needs both a real 404 experience and SPA routing on specific paths, this needs Cloudflare's explicit `_redirects`/`_routes.json` configuration rather than relying on the implicit default — treat the automatic behavior as an SPA-or-not switch, not something you can partially opt out of with a single file.

**★ Symptom: on GitHub Pages, the app loads fine at the root and 404s on every deep link, even though `base` is confirmed correct.** Cause: `base` only fixes asset URLs — it does nothing for GitHub Pages' complete absence of a server-side rewrite mechanism, which is a separate problem requiring the `404.html` redirect trick, not a `base` adjustment. Fix: implement the community workaround (`404.html` + a decode script in `index.html`), and confirm `pathSegmentsToKeep` in `404.html`'s own script matches the repo path independently of `base`.

**★ Symptom: the GitHub Pages `404.html` trick works for the root site but drops the repo name from the path on a project-pages deploy (`username.github.io/repo-name`).** Cause: `pathSegmentsToKeep` in the `404.html` script defaults to `0`, which is correct for a user/org site or a custom domain at the root, but strips one path segment too many for a project site nested under `/repo-name/`. Fix: set `pathSegmentsToKeep` to `1` in `404.html` specifically for a project-pages deploy — this value has nothing to do with `base` and must be set independently.

## Interview questions

**★ Why does GitHub Pages need a client-side hack for SPA routing when every other static host in this list has a first-class rewrite config?**
Because GitHub Pages is fundamentally a static file server with no request-time configuration surface at all — no rewrite rules, no headers config, no server-side logic of any kind that a project can supply. Netlify, Vercel, and Cloudflare Pages are all, underneath the "just static hosting" marketing, running a request-routing layer in front of the files that can be told "if nothing matches, serve this instead." GitHub Pages has no equivalent layer to configure, so the only lever left is client-side: use its *existing* 404 behavior (which it does support, and which is customizable) as a signal to redirect, and un-redirect on arrival before the router ever notices anything happened.

**★ What's the practical difference between a rewrite (Netlify's `200`, Vercel's `rewrites`) and the GitHub Pages 404.html trick, beyond "one works and one is a workaround"?**
A rewrite happens entirely server-side, transparently, in a single request-response cycle — the browser asks for `/settings`, the server internally serves `index.html`'s bytes while keeping `/settings` in the address bar, and nothing about the URL, history, or the number of round trips is visible to the client. The GitHub Pages trick is a genuine two-hop client-side redirect: the browser gets a real `404` response first, runs a script that rewrites the URL into a query string and issues a second navigation, and *then* gets `index.html`, which runs another script to restore the original path via `history.replaceState`. It's observably slower (a real extra round trip), briefly shows the wrong URL in the address bar mid-flight, and depends on JavaScript executing correctly in that narrow window — a genuinely different mechanism, not a cosmetic difference in how the same result is achieved.

**★ Why does adding a custom `404.html` to a Cloudflare Pages project change the platform's SPA-fallback behavior, when the same action has no effect on Netlify or Vercel?**
Because Cloudflare Pages uses the *presence of a top-level `404.html`* as its signal for whether a project is an SPA at all, rather than requiring an explicit opt-in like Netlify's `_redirects` rule or Vercel's `vercel.json` rewrite. Netlify and Vercel's fallback behavior is something you add; Cloudflare's is something that exists by default and a specific file (`404.html`) turns off. That makes Cloudflare's mechanism convenient for a pure SPA (zero configuration needed) and a trap for a hybrid project that wants both a real 404 page and client-side routing, since the two goals compete for the same file's presence.

**★ On GitHub Pages, `base` is set correctly and the site loads at the root, but a bookmarked deep link still 404s. Why doesn't fixing `base` also fix this?**
Because `base` and the deep-link 404 are unrelated problems that happen to both live under "GitHub Pages configuration." `base` controls what URL prefix Vite writes into every *asset* reference — get it right, and the JavaScript and CSS the page needs actually load. The deep-link 404 is about what happens when the *browser itself* requests a path that isn't a real file in the repository, which is a routing question `base` has no bearing on — the assets could be perfectly resolvable and the server would still have no file called `/project-name/settings/profile` to serve. Fixing one does nothing for the other; both need to be addressed, independently, for a GitHub Pages SPA deploy with client-side routing to fully work.

---

← [01c · vite preview](01c-vite-preview-is-not-a-production-server.md) · [Vite overview](../../README.md) · Next → [01e · SPA fallback: self-managed infra](01e-spa-fallback-self-managed-infrastructure.md)
