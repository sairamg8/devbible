---
title: "build.sourcemap: 'hidden' only stops the browser from finding the map automatically — the file is still written to dist/, and whether it is reachable depends entirely on what your deploy step and web server do with it"
sidebar_label: "01i · Source maps in production"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Build Options](https://vite.dev/config/build-options) (`build.sourcemap`). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

**`build.sourcemap` is a build option, but whether a production source map leaks your original TypeScript is a deployment decision, made downstream of the build, by whatever serves `dist/` to the internet.** The three-way choice between `true`, `'inline'` and `'hidden'` is covered from the build-cost and file-shape angle in **11 · Optimization and performance** at [`01h-sourcemaps-target-and-minifiers.md`](../11-optimization-and-performance/01h-sourcemaps-target-and-minifiers.md), including the exact quoted definitions and the sentry-cli upload workflow; this chunk assumes that mechanism and covers only what belongs to deployment — access control at the web server or CDN layer, and how the choice differs by build (client vs SSR).

## The one sentence that matters for deployment, restated precisely

> *"`'hidden'` works like `true` except that the corresponding sourcemap comments in the bundled files are suppressed."* — [Build Options](https://vite.dev/config/build-options)

Read literally: **`'hidden'` removes a comment, not a file.** The `.map` file is written to `outDir` exactly as it is for `true`. The only difference is that the bundled `.js` file no longer carries a `//# sourceMappingURL=app-a1b2c3.js.map` comment telling a browser's devtools where to automatically fetch it. Nothing about `'hidden'` prevents a request to `/assets/app-a1b2c3.js.map` from succeeding — it only prevents devtools from making that request *for you*. Anyone who already knows or guesses the filename (trivial: it is almost always the corresponding `.js` filename with `.map` appended) can fetch it directly with `curl` and reconstruct your original source, comments included, if your deploy step shipped the file to the same place as everything else.

**This means `'hidden'` is a discovery barrier, not an access-control mechanism.** Actual access control is a deploy-pipeline and web-server responsibility, and it has to be implemented separately.

## The deploy-pipeline pattern: upload, then remove before publish

The correct arrangement for an error tracker (Sentry, Rollbar, Bugsnag, and equivalents) is: build with `'hidden'` so the comment never ships, have the CI pipeline upload the `.map` files to the tracker as a distinct step, and then **delete them from the artifact before it is published** — the map's job is done once the tracker has ingested it; it should never reach a public bucket or CDN origin at all.

```yaml
# .github/workflows/deploy.yml — upload maps, then remove them before the publish step
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - run: yarn install --frozen-lockfile
      - run: yarn build   # build.sourcemap: 'hidden' in vite.config.ts

      - name: Upload source maps to the error tracker
        run: |
          sentry-cli releases files "${{ github.sha }}" upload-sourcemaps ./dist/assets \
            --url-prefix '~/assets'

      - name: Strip maps before anything is published
        run: find ./dist -name '*.map' -delete

      - name: Publish
        run: aws s3 sync ./dist s3://acme-storefront-prod --delete
```

Ordering matters and is easy to get backwards: **upload before delete**, always in the same step or job, never split across a pipeline where a failure between the two leaves either no maps anywhere (broken error tracking) or maps sitting in the artifact that the next step publishes unchanged.

## Defence in depth: the web server should refuse to serve `.map` files anyway

Because `'hidden'` is only a discovery barrier, a deploy that accidentally skips the delete step — a pipeline change, a manual `aws s3 sync` that bypasses CI, a developer running `vite build` locally without the CI script's cleanup — should not be the only thing standing between your source and the public internet. Configure the web server or CDN to refuse `.map` requests outright:

```nginx
# nginx.conf — refuse to serve source maps even if one slipped into the published artifact
location ~* \.map$ {
    deny all;
    return 404;
}
```

```
# S3 bucket policy fragment (JSON) — deny GetObject for anything ending in .map,
# independent of what the deploy pipeline did or didn't clean up.
{
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::acme-storefront-prod/*.map"
}
```

This is the same "defence in depth, not a single point of trust" principle as any other access-control problem — the deploy pipeline's delete step is the primary control, and the web-server rule is what catches the case where that control failed silently.

## The SSR build changes the calculus entirely

Client and SSR builds have opposite exposure, and the same `build.sourcemap` setting can be the wrong choice for one of them even when it's right for the other:

- The **client build**'s source map, if reachable, is fetched by an anonymous browser over the public internet — the exposure is to every visitor.
- The **SSR build**'s output runs on your own server, inside your own infrastructure. Its source map is read by *your* Node process for *your* own stack traces, and — unless something is misconfigured to serve `dist/server/` as static files, which it should never be — it is never requested by a client at all.

That asymmetry means it is entirely reasonable to run `build.sourcemap: true` (not `'hidden'`) for the SSR build specifically, since there is no browser ever fetching it, while keeping `'hidden'` plus the upload-and-strip pipeline for the client build. Configuring both builds identically is the more common mistake in either direction — either over-cautiously stripping maps from a server bundle that never leaves your infrastructure, or, far worse, applying the client build's relaxed settings to the client output and shipping full public maps by habit.

## Gotchas

**★ Symptom: your original TypeScript, including internal comments, is fully readable in a stranger's browser devtools.** Cause: `build.sourcemap: true` emits both the `.map` file and the `//# sourceMappingURL` comment that tells devtools to fetch it automatically — anyone visiting the site gets the reconstructed source for free. Fix: `'hidden'` stops the automatic fetch, but only the deploy pipeline's delete step (below) actually prevents the file from being reachable at all.
```yaml
- run: find ./dist -name '*.map' -delete   # after uploading to the error tracker, before publish
```

**★ Symptom: `build.sourcemap: 'hidden'` was set specifically to keep source maps private, and they are still publicly fetchable at their predictable filename.** Cause: `'hidden'` suppresses the comment in the bundled `.js` file; it does not stop the `.map` file from being written to `outDir`, and it does not stop a web server from serving a file that exists in the served directory. Fix: the deploy pipeline must delete the `.map` files after uploading them to the error tracker and before the artifact is published — `'hidden'` alone is a discovery barrier, not a permission barrier.

**★ Symptom: source maps were uploaded to the error tracker in one pipeline run, and the next deploy shipped a build with no maps uploaded at all — stack traces in the tracker are unresolved for that release.** Cause: the upload and delete steps were split across separate jobs or a pipeline change reordered them, and a failure between the two left the release with no maps anywhere. Fix: keep upload-then-delete in the same job, in that order, so a failed upload fails the whole deploy rather than silently shipping unresolved stack traces.

**★ Symptom: a security scan flags publicly fetchable `.map` files on a site whose CI pipeline is believed to strip them.** Cause: someone deployed outside the pipeline — a manual sync, a hotfix script, a rollback that republished an older artifact captured before the strip step existed. Fix: this is exactly the failure mode the web-server or CDN-level `deny` rule exists to catch; a pipeline convention with no independent enforcement is one bypass away from a leak.

**★ Symptom: server-side stack traces in production logs are unreadable minified garbage, even though the client bundle correctly has clean, resolved stack traces in the error tracker.** Cause: the same `sourcemap: 'hidden'`-plus-strip pipeline built for the client bundle was applied unmodified to the SSR build, and the SSR build's maps got deleted before your own log-processing pipeline could read them — even though nothing external was ever going to fetch them. Fix: the SSR build has a different exposure profile than the client build; it is reasonable to keep `sourcemap: true` for it and skip the strip step entirely, since the maps never leave your own infrastructure.

## Interview questions

**★ What is the actual difference between `sourcemap: true` and `sourcemap: 'hidden'`, and why is calling `'hidden'` "private" a mistake?**
Both modes write the `.map` file to `outDir` — that part is identical. The only difference is that `true` also inserts a `//# sourceMappingURL=...` comment into the bundled JavaScript, which is what makes a browser's devtools fetch the map automatically the moment anyone opens them. `'hidden'` removes that comment and nothing else. Calling `'hidden'` "private" mistakes a discovery mechanism for an access-control mechanism: the file is still sitting in the published directory at a predictable filename, and anyone who requests it directly — with `curl`, not devtools — gets it just as they would with `true`. Actual privacy requires a deploy step that deletes the file after uploading it to an error tracker, and ideally a web-server rule that refuses `.map` requests as a second line of defence.

**★ Why might it be correct to use `sourcemap: true` for an SSR build's server bundle while using `'hidden'` plus a strip-before-publish pipeline for the client build, in the same project?**
Because the two builds have opposite exposure. The client bundle is downloaded by anonymous browsers over the public internet, so any source map sitting next to it is a map anyone can fetch — hence the discipline of stripping it after uploading to an error tracker. The SSR build's output runs entirely inside your own server process; nothing external ever requests `dist/server/entry-server.js` or its map, because it is never served as a static asset to a browser. There is no exposure to defend against, so the map can stay in place permanently for your own stack-trace readability with none of the leak risk that justifies stripping it from the client build.

**★ A deploy pipeline uploads source maps to Sentry and then publishes the build. What ordering mistake would silently break error tracking, and what ordering mistake would silently leak source?**
Deleting the maps before the upload step runs breaks error tracking silently — the deploy still succeeds, the site still works, and only weeks later does someone notice every production error in the tracker is an unresolved, minified stack trace with no way to map it back. The opposite mistake — publishing the artifact before (or without) deleting the maps — leaks source, and it is also silent: the site works identically whether or not the maps are reachable, so nothing about normal operation surfaces the problem. Both failures are invisible in the pipeline's success/failure output, which is exactly why "upload, then delete, both in the same job" is the version worth writing down rather than trusting to memory.

---

← [01h · Env baking & runtime config](01h-env-baking-and-runtime-config.md) · [Vite overview](../../README.md) · Next → [01j · Deploying an SSR/Node app](01j-deploying-an-ssr-node-app.md)
