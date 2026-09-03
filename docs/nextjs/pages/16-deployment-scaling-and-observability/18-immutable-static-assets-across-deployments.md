---
sidebar_position: 18
title: "Skew protection made every deployment re-download every byte; immutable static assets in 16.3 fix that by admitting content-addressed files cannot skew"
sidebar_label: "Immutable static assets"
description: "Why ?dpl exists, what supportsImmutableAssets changes, the /_next/static/immutable/* namespace, the adapter's obligations around immutableHash, and outputHashSalt as the collision escape hatch."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [`supportsImmutableAssets`](https://nextjs.org/docs/app/api-reference/config/next-config-js/supportsImmutableAssets), [Adapters · Supporting Immutable Static Assets](https://nextjs.org/docs/app/api-reference/adapters/immutable-static-assets), [`outputHashSalt`](https://nextjs.org/docs/app/api-reference/config/next-config-js/outputHashSalt), [`deploymentId`](https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId), [Adapters · Output Types](https://nextjs.org/docs/app/api-reference/adapters/output-types), [CDN Caching](https://nextjs.org/docs/app/guides/cdn-caching), and [Next.js 16.3](https://nextjs.org/blog/next-16-3).
> Target: **Next.js 16.3.4**. `supportsImmutableAssets` and `outputHashSalt` were both **added in 16.3.0**. Prior page: [17 · Deploying beyond Vercel](17-choosing-a-deployment-target-beyond-vercel.md).

**Skew protection and browser caching have been quietly at war since `deploymentId` shipped. Skew protection appends `?dpl=<id>` to every static asset URL so a client never mixes assets across deployments — which also means every asset URL changes on every deployment, so every browser re-downloads a bundle that is byte-for-byte identical to the one it already has. Next.js 16.3 resolves the contradiction by noticing that a content-addressed filename cannot skew: if the hash is in the name, the bytes are the name. Assets that qualify move to `/_next/static/immutable/*`, drop the `?dpl`, and survive across deployments in both the browser and the CDN. The cost is a new obligation on the hosting side, and it is a serious one.**

## The problem, stated exactly

> *"When skew protection is enabled, static asset requests include a deployment-specific query parameter, for example:"*

```plain
GET https://foo.com/_next/static/chunks/0d_ks0ow7ur6m.js?dpl=<unique-deployment-id>
```

> *"One downside is that browsers have to download static assets again after each new deployment, even when those assets have not changed."*

Look at that URL. The filename `0d_ks0ow7ur6m.js` already contains a content hash — the file's identity is already in its name — and yet the `?dpl` makes it a different URL on every deployment. The information needed to cache it forever is right there and is being deliberately discarded.

## The fix

> *"Immutable static assets allow the `?dpl` query parameter to be omitted for static assets that are guaranteed to be immutable and content-addressed by their filename. This lets browsers cache those assets indefinitely and allows unchanged static assets to be skipped when uploading files during subsequent deployments:"*

```plain
GET https://foo.com/_next/static/immutable/chunks/0d_ks0ow7ur6m.js
```

The 16.3 release note is one sentence and it is the whole argument:

> *"Immutable static assets can now be reused across deployments. Since they're immutable, they cannot suffer from issues related to skew."*

Two savings, not one. Browsers stop re-downloading; **deployments stop re-uploading**. On a large application with a hundred megabytes of chunks where a release changes three of them, the upload phase becomes proportional to what changed.

The prefix is deliberate and is a CDN-configuration seam:

> *"When `config.supportsImmutableAssets` is enabled, Next.js outputs immutable content-addressed static assets under the public path `/_next/static/immutable/*`. This prefix can be used to differentiate immutable static assets from non-immutable static assets at the CDN level."*

## Who turns this on

Not you, in the ordinary case. The config reference opens with a warning:

> *"**Attention**: This option is primarily intended for adapter authors. App developers should only set it when troubleshooting adapter-specific issues."*

> *"**Enabling this feature when your provider or adapter does not support it can result in broken deployments.**"*

The adapter declares support; the application developer can only veto:

> *"You can use this config option to opt out of immutable static assets when your adapter has enabled support for them. If your adapter has not enabled this feature, this option has no effect"*

```js filename="next.config.js"
/** @type {import('next').NextConfig} */
const nextConfig = {
  supportsImmutableAssets: false,
}

module.exports = nextConfig
```

## What the adapter must do

Two steps, and one obligation that outlives the build.

> *"1. In the `modifyConfig`, set the `config.supportsImmutableAssets` property to `true` (if it's not already set to `false` by the user) to signal that you support deploying immutable static assets, and 2. In `onBuildComplete`, read the `outputs.staticFiles[].immutableHash` property to determine which static assets are immutable and have to be requested without the `?dpl` query parameter."*

```js filename="my-adapter.js"
/** @type {import('next').NextAdapter} */
const adapter = {
  name: 'my-custom-adapter',

  async modifyConfig(config, { phase }) {
    if (phase === 'phase-production-build') {
      config.supportsImmutableAssets =
        // Default to true, but allow users to opt-out
        config.supportsImmutableAssets ?? true

      // Optionally, pass a salt for the content hashes
      // config.outputHashSalt = getSaltForCurrentProject()
    }
    return config
  },

  async onBuildComplete({ outputs }) {
    for (const output of outputs.staticFiles) {
      if (output.immutableHash != null) {
        // This has to be requestable at `output.pathname`
        // even without the `?dpl` query parameter.
        uploadOrVerifyImmutableStaticAsset(
          output.filePath,
          output.pathname,
          output.immutableHash
        )
      } else {
        // This is a non-immutable static asset and will be requested with
        // the `?dpl` query parameter, scoped to the deployment.
        uploadStaticAsset(output.filePath, output.pathname)
      }
    }

    // Process other outputs....
  },
}
```

The function name in the documented example — `uploadOrVerifyImmutableStaticAsset` rather than `uploadImmutableStaticAsset` — is the design in miniature. For a content-addressed asset already present, the correct action is to *verify* rather than re-upload.

### The obligation

> *"At runtime, these immutable static assets are requested without the `?dpl` query parameter and thus live in a shared namespace across deployments. You must ensure that these assets are immutable and not changed (even after a new deployment) or deleted (for as long as there are active deployments using them)."*

Read that as two separate promises, because they fail differently.

**Never changed.** Overwriting `/_next/static/immutable/chunks/abc.js` with different bytes poisons every browser and CDN cache that holds it, for up to a year, with no invalidation path. There is no `?dpl` to bump.

**Never deleted while referenced.** A deployment-scoped cleanup that removes assets belonging to "the previous deployment" will delete files the current deployment still points at, because unchanged assets are *the same file*. Every previous asset-lifecycle policy anyone wrote for `?dpl`-scoped assets is wrong under this model. Reference-count, or retain.

### Hash truncation, and why the full hash is handed to you

> *"Next.js may use a truncated shorter content hash as the filename, so `outputs.staticFiles[].immutableHash` contains the full content hash which can be used to validate that no hash collision occurred."*

The filename hash is truncated for URL length; `immutableHash` is the full one. Truncation means collisions are possible in principle. A correct `uploadOrVerify` implementation compares the full `immutableHash` against the stored object's recorded hash and treats a mismatch as an error rather than as an idempotent no-op — because a mismatch means two different files want the same immutable URL.

### Non-immutable assets do not go away

> *"Note that you need to continue supporting non-immutable static assets (which may change between deployments and continue to be requested with the `?dpl` query parameter), e.g. for the `public` folder or for older Next.js versions."*

Files from `public/` keep their author-chosen names and can change content without changing name. They stay `?dpl`-scoped. This is exactly the hashed/un-hashed split OpenNext documented years earlier, now expressed as a field on the build output: `immutableHash` present or absent.

## `outputHashSalt` — the rotation escape hatch

> *"`outputHashSalt` is an option that incorporates a configurable salt string into every content-addressed output filename (chunks, assets). Changing this value forces all output hashes to change, which is useful for invalidating cached assets across deployments without modifying source files."*

```js filename="next.config.js"
/** @type {import('next').NextConfig} */
const nextConfig = {
  outputHashSalt: 'my-deployment-salt',
}

module.exports = nextConfig
```

> *"This works with both Webpack and Turbopack bundlers."*

And the two-layer composition, which is the part worth remembering:

> *"The `NEXT_HASH_SALT` environment variable can also be used for the same purpose. When both are set, the values are **concatenated** (`outputHashSalt + NEXT_HASH_SALT`) to form the effective salt. This lets you combine a per-project salt baked into the config with a per-deployment salt injected at build time via environment variable."*

```bash filename="Terminal"
NEXT_HASH_SALT=my-deployment-salt next build
```

The adapter docs name the intended emergency use: *"You can use `config.outputHashSalt` to set a salt for the content hashes, if you want to rotate the hashes for any reason (e.g. after a detected hash collision)."*

Note the perverse interaction: setting `NEXT_HASH_SALT` to something per-deployment rotates *every* hash on *every* deployment, which reintroduces the exact full-re-download behaviour immutable assets exist to eliminate. It is a break-glass tool, not a hygiene practice.

## Where it fits with `deploymentId` and CDN policy

`deploymentId` still does everything else it did — the `x-deployment-id` request header, the `x-nextjs-deployment-id` response header, the `data-dpl-id` attribute on `html`, and participation in the `'use cache'` cache key. Immutable assets narrow only the `?dpl` query parameter, and only for content-addressed files.

The CDN guide's baseline policy is unchanged and is what immutable assets let the browser finally keep:

> *"Static assets (JavaScript, CSS, images, fonts) served from `/_next/static/` include content hashes in their filenames and have a 1 year `max-age` and `immutable` directive: `public, max-age=31536000, immutable`"*

And the routing phase that applies it is `onMatch`, described in the adapter reference as carrying *"immutable cache headers for hashed static assets."* An adapter that serves `/_next/static/immutable/*` from object storage without applying `onMatch` gets the URL stability and none of the caching.

Testing ties this together: the compatibility harness requires the logs script to emit `NEXT_SUPPORTS_IMMUTABLE_ASSETS:` so the suite knows which URL shape to assert.

## Gotchas

**★ Overwriting an immutable asset URL with different bytes.**
There is no invalidation path. The URL carries no `?dpl`, browsers were told `max-age=31536000, immutable`, and CDNs cached it under the same policy. A build pipeline that rebuilds and re-uploads "the same" file with a non-deterministic timestamp or a different minifier version has just pinned broken JavaScript into caches for a year. Verify against `immutableHash` before writing; treat a mismatch as a build failure, not an overwrite.

**★ Reusing a `?dpl`-era retention policy and deleting assets the live deployment still needs.**
"Delete assets from deployments older than N days" was safe when every deployment had its own asset namespace. Under the immutable namespace, an unchanged chunk from six months ago *is* the chunk the current deployment serves. The docs say assets must not be deleted *"for as long as there are active deployments using them."* Reference-count against live deployments, or retain indefinitely and pay the storage.

**★ Enabling `supportsImmutableAssets: true` in an application's own config.**
The reference is explicit that the option is *"primarily intended for adapter authors"* and that enabling it where the provider does not support it *"can result in broken deployments"* — assets requested at `/_next/static/immutable/*` with no `?dpl` against a host that never learned to serve that namespace. From the app side the option is a veto (`false`), not a switch.

**★ Treating a hash mismatch on an existing object as idempotent.**
Filenames may use a truncated hash. Two different files can therefore want the same immutable path. If your upload path is "object exists, skip", a collision silently serves the wrong file forever. Compare the full `immutableHash`, and if it differs from what is recorded, fail loudly — that is precisely the case `outputHashSalt` exists to remediate.

**★ Setting `NEXT_HASH_SALT` per deployment.**
It rotates every content hash on every build, so every asset URL changes on every deployment — reinstating the exact behaviour immutable assets removed, while also invalidating your entire CDN. It is a break-glass response to a detected collision or a compromised artefact, not a cache-busting convenience.

**★ Forgetting that `public/` files are not immutable.**
`/logo.png` keeps its name when its content changes, so it has no `immutableHash` and stays `?dpl`-scoped. An adapter that assumes every `STATIC_FILE` is immutable will pin a stale logo into every browser cache for a year. Branch on `immutableHash != null`, exactly as the documented example does.

**★ Serving the immutable namespace without applying `onMatch` headers.**
Stable URLs alone buy nothing. The `Cache-Control: public, max-age=31536000, immutable` header comes from the `onMatch` routing phase, and a platform that short-circuits routing for static content never applies it. The result is stable URLs that browsers still revalidate on every navigation.

**★ Declaring `NEXT_SUPPORTS_IMMUTABLE_ASSETS: 1` to the test harness before the storage side is done.**
The marker changes which asset URLs the compatibility suite expects. Declaring support you have not built produces asset-test failures that read like a CDN misconfiguration and send you debugging the wrong layer.

**★ Assuming this reduces bandwidth for first-time visitors.**
It does not. A cold browser downloads exactly the same bytes. The saving is for *returning* visitors across a deployment boundary, and for the deployment pipeline's own upload step. Frame the benefit as repeat-visit latency and build time, not as CDN egress on new traffic.

## Interview questions

**★ Why did skew protection make browser caching worse, and how does 16.3 resolve it?**
Skew protection appends `?dpl=<deploymentId>` to static asset URLs so a client never mixes assets across deployments. Because the query parameter is part of the URL, every asset becomes a new URL on every deployment and browsers re-download files that have not changed. 16.3 observes that a content-addressed filename already encodes identity — so those files cannot skew — and serves them from `/_next/static/immutable/*` without the `?dpl`, letting browsers and CDNs keep them indefinitely.

**★ Who is supposed to enable `supportsImmutableAssets`, and what happens if the wrong party does?**
The adapter, from `modifyConfig`, because only the hosting side can guarantee the namespace behaves correctly. The docs warn that enabling it *"when your provider or adapter does not support it can result in broken deployments"* — assets are then requested from a path the host does not serve. From the application side the option is only meaningful as `false`, an opt-out; if the adapter has not enabled it, setting it has no effect at all.

**★ What are the adapter's two runtime obligations for immutable assets, and how do they fail?**
Never change an immutable asset's bytes, and never delete one while any active deployment references it. Changing bytes poisons every browser and CDN cache holding that URL for up to a year with no invalidation path. Deleting one breaks live deployments, because an unchanged asset is literally shared across deployments rather than copied per deployment — which invalidates every asset-retention policy written for the `?dpl` model.

**★ Why does `immutableHash` exist when the hash is already in the filename?**
Because the filename hash may be truncated for URL length, while `immutableHash` is the full content hash. Truncation admits collisions, so the full hash is what an adapter compares before deciding an existing object is the same file. The documented purpose is *"to validate that no hash collision occurred."*

**★ What is `outputHashSalt` for, and how does it compose with `NEXT_HASH_SALT`?**
It injects a salt into every content-addressed output filename, forcing all hashes to change without touching source — the remedy after a detected hash collision or when you need to invalidate everything. It works with both Webpack and Turbopack. When both `outputHashSalt` and the `NEXT_HASH_SALT` environment variable are set, the values are *concatenated* (`outputHashSalt + NEXT_HASH_SALT`), which is designed for a per-project salt in config plus a per-deployment salt at build time.

**★ Which static assets do not become immutable, and why?**
Anything without a content hash in its filename — principally files from `public/`, which keep author-chosen names and can change content without changing name. They keep the `?dpl` query parameter and stay deployment-scoped. The build output signals this by leaving `immutableHash` undefined on those `STATIC_FILE` outputs.

**★ Both savings from this feature — name them and say who benefits.**
Returning visitors stop re-downloading unchanged assets after a deployment, because the URL and its one-year `immutable` cache entry both survive. And the deployment pipeline stops re-uploading unchanged assets, because a content-addressed object already present can be verified rather than written. First-time visitors see no difference at all.

**★ How does this interact with the adapter compatibility test suite?**
The harness requires the logs script to print a `NEXT_SUPPORTS_IMMUTABLE_ASSETS:` marker, because whether the adapter supports immutable assets changes which URL shape the tests must assert — `/_next/static/immutable/*` without `?dpl`, versus deployment-scoped assets with it. Declaring support the storage layer has not implemented produces failures that look like CDN misconfiguration.

{/* FOOTER */}
