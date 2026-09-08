---
title: "vite preview serves dist/ so you can sanity-check a build, and the documentation is explicit that it is not, and was never meant to be, a production server"
sidebar_label: "01c · vite preview"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Deploying a Static Site](https://vite.dev/guide/static-deploy), [Preview Options](https://vite.dev/config/preview-options), [Command Line Interface](https://vite.dev/guide/cli). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ `vite preview`: the last local check, not a deployment target

**`vite preview` exists to answer exactly one question — does the actual production build, as built, work — and it answers a narrower version of that question than most people assume.** It serves the real `dist/` output, not source files re-transformed on the fly the way `vite`'s dev server does, which is why it catches classes of bug dev mode structurally cannot: a `base` mismatch, a minification bug, code that only breaks once tree-shaken. What it does not do is behave like the host you're about to deploy to, and the documentation says so directly.

## What it is

> *"The `vite preview` command will boot up a local static web server that serves the files from `dist` at `http://localhost:4173`. It's an easy way to check if the production build looks OK in your local environment."*

> *"This command starts a server in the build directory (by default `dist`). Run `vite build` beforehand to ensure that the build directory is up-to-date. Depending on the project's configured [`appType`](https://vite.dev/config/shared-options#apptype), it makes use of certain middleware."*

And the constraint, stated without qualification:

> *"Locally preview the production build. Do not use this as a production server as it's not designed for it."*

> *"It is important to note that `vite preview` is intended for previewing the build locally and not meant as a production server."*

```bash
vite build                      # produces dist/, using whatever base/outDir are configured
vite preview                    # serves dist/ at http://localhost:4173
```

## The options that matter for a sanity check

`preview.port` defaults to `4173` — distinct from the dev server's `5173`, deliberately, so both can run at once:

> *"Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on."*

That auto-increment behavior is worth knowing before it surprises you: a `preview.port: 8080` that finds 8080 taken will silently serve on 8081 instead, unless `preview.strictPort` says otherwise:

> *"Set to `true` to exit if port is already in use, instead of automatically trying the next available port."*

```ts
// vite.config.ts
export default {
  server: {
    port: 3030,
  },
  preview: {
    port: 8080,
    strictPort: true, // fail loudly instead of silently drifting to 8081
  },
};
```

The CLI form covers the same ground without touching the config file, and it's how the static-deploy guide itself recommends configuring it — as a package.json script rather than a hardcoded config value:

```json
{
  "scripts": {
    "preview": "vite preview --port 8080"
  }
}
```

`vite preview` also accepts `--outDir <dir>`, `--host [host]`, `--strictPort`, `--open [path]`, and — critically for the `base` chunk this one follows — `--base <path>`, all listed in the [CLI reference](https://vite.dev/guide/cli) with the same defaults as the equivalent config options.

## Why the `--base` flag on `preview` is not optional for a real sanity check

A build produced with `vite build --base=/project-name/` emits every asset reference prefixed with `/project-name/`. `vite preview` run with no matching flag serves `dist/` at the domain root of `http://localhost:4173/` — which means the check that's supposed to catch a `base` mismatch before it reaches production will not actually reproduce the mismatch unless it's told to:

```bash
vite build --base=/project-name/
vite preview --base=/project-name/    # matches the ACTUAL deploy path, so a base
                                       # misconfiguration shows up here, not on the live host
```

Skipping the flag doesn't make `preview` fail — it makes `preview` succeed at a check that no longer tests the thing you needed tested. See **[01](01-shipping-the-build.md)** for the full mechanism `base` controls and every other way it goes wrong.

## What `preview` cannot tell you

`vite preview`'s "static web server" is Vite's own, and it has no knowledge of the routing rules, headers, redirects, or edge behavior your actual host applies. Concretely, it will not tell you:

- Whether a deep client-side route survives a hard refresh — that depends on the host's SPA fallback rule (Netlify `_redirects`, Vercel `vercel.json`, nginx `try_files`, none of which `preview` implements), covered in **[01d](01d-spa-fallback-hosted-platforms.md)** and **[01e](01e-spa-fallback-self-managed-infrastructure.md)**.
- Whether the cache headers your host actually sends match what **[01f](01f-caching-strategy-and-library-mode-deployment.md)** describes — `preview` sends its own default headers, not the ones a CDN or reverse proxy in front of production will apply.
- Whether a CSP, a custom domain's TLS setup, or any host-specific middleware behaves as configured.
- Whether the app actually works when served from the real origin rather than `localhost` — cookie domains, CORS, and anything origin-sensitive is untested by definition.

`vite preview` answers "is this build artifact itself correct," not "will this deployment work." Both checks are necessary; only one of them is `vite preview`'s job.

## Gotchas

**★ Symptom: `vite preview` works perfectly, and the identical `dist/` 404s on refresh at any deep route once actually deployed.** Cause: `vite preview`'s built-in static server has no SPA fallback rule of its own for arbitrary unmatched paths beyond serving the configured entry — it is not a stand-in for the host's routing configuration, and a passing local preview says nothing about whether the target host's rewrite rule (or lack of one) is correctly configured. Fix: verify the SPA fallback separately, against the actual host's own mechanism — **[01d](01d-spa-fallback-hosted-platforms.md)** / **[01e](01e-spa-fallback-self-managed-infrastructure.md)** — `vite preview` passing is not evidence for this.

**★ Symptom: a CI job runs `vite preview` and treats a successful boot as "the deployment is verified."** Cause: conflating "the static server started and served files" with "the production deployment will behave correctly" — the documentation's own wording, *"not meant as a production server,"* is about more than performance or scaling; it's that the serving behavior itself (no host-specific rewrite rules, no real cache headers, no TLS, no CDN edge behavior) is deliberately minimal. Fix: use `vite preview` for what it verifies — the build artifact — and verify deployment-specific behavior (routing, headers, TLS) against a real or staging deployment on the actual host, not a local static server standing in for it.

**★ Symptom: `preview.port: 8080` was configured, a teammate's `preview` command reports it started fine, but the app they're looking at in the browser is a stale build from a different process.** Cause: port 8080 was already occupied — by a leftover previous `preview` process, most commonly — so Vite silently incremented to 8081 (or wherever the next free port was) per the documented auto-retry behavior, and the teammate is looking at whatever *was* on 8080. Fix: set `preview.strictPort: true` in any environment where silently serving on the wrong port is worse than failing loudly, which is most CI and most "am I actually testing what I think I'm testing" situations.

**★ Symptom: a build tested locally with `vite preview` (no flags) is declared "verified," then breaks in production specifically at the sub-path the app is deployed to.** Cause: `vite preview` with no `--base` serves at the domain root, so a `base` mismatch that only manifests at a non-root deploy path is invisible to a preview run that never simulates being at that path. Fix: always pass the same `--base` value the real deployment will use — `vite build --base=X && vite preview --base=X` — treating a mismatch here as the whole point of running preview at all.

## Interview questions

**★ Why does Vite ship a preview server at all, instead of telling users to just deploy and check?**
Because several classes of bug only exist in the built artifact and are invisible in `vite`'s dev server — dev mode serves source files transformed on demand, with no minification, no tree-shaking, no bundling of `node_modules`, and (critically) no `base` rewriting the way a real build applies it. A `base` misconfiguration, a bug introduced by minification, or code that behaves differently once dead-code-eliminated are all things dev mode structurally cannot surface, because dev mode never produces the artifact that has them. `vite preview` closes that gap cheaply — a local static server serving the exact `dist/` output — without requiring an actual deploy cycle to find out.

**★ The docs say `vite preview` is "not designed" to be a production server. What specifically does that rule out, beyond "don't run it at scale"?**
It rules out treating `preview`'s serving behavior as representative of anything host-specific: it has no SPA fallback/rewrite configuration of its own to test against, it does not send the cache headers a real deployment's CDN or reverse proxy would send, it has no TLS story, and it does not exercise CORS or cookie-domain behavior the way serving from a real origin does. "Not designed for it" is not (only) a performance disclaimer — it's a scope disclaimer. `preview` verifies the build artifact is internally correct; it does not verify the deployment configuration around that artifact, because it has none of its own that matches production.

**★ Why does `vite preview` accept a `--base` flag at all, if the build already baked `base` into the output files?**
Because `preview` needs to know at what path *it itself* should serve those files for the already-baked-in asset references to resolve correctly. If a build was produced with `base: '/project-name/'`, every asset reference inside `index.html` expects to be requested at `/project-name/assets/...` — and `preview` has to be told to actually serve the app under that same sub-path locally, rather than at its own root, or the exact 404 pattern that base mismatches produce in production will simply not occur in the local check, defeating the point of running the check at all.

**★ What is the concrete difference between a "successful preview" and a "verified deployment," and why does that distinction matter operationally?**
A successful preview confirms the build artifact — the JavaScript, CSS, and HTML `vite build` produced — is internally self-consistent and loads correctly when served from a plain static file server at the right base path. A verified deployment additionally requires the *host's* configuration to be correct: its SPA fallback rule (or lack of one, for a non-SPA app), its cache headers, its TLS setup, any CDN or reverse-proxy behavior sitting in front of the origin. Treating a passing `vite preview` as sufficient sign-off skips the second half entirely, and the failures that live there — a missing rewrite rule, a wrong `Cache-Control` header — are exactly the ones that don't reproduce locally and therefore surface for the first time in front of real users.

---

← [01b · public/ at deploy time](01b-public-directory-and-publicdir.md) · [Vite overview](../../README.md) · Next → [01d · SPA fallback: hosted platforms](01d-spa-fallback-hosted-platforms.md)
