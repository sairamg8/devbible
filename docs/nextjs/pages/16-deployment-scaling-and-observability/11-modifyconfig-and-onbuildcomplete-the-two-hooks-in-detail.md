---
sidebar_position: 11
title: "modifyConfig fires on every CLI command that loads the config, not just the build — and onBuildComplete is the one moment the whole build is describable"
sidebar_label: "The two adapter hooks in detail"
description: "The lifecycle, parameters and failure modes of modifyConfig and onBuildComplete, including phase branching, repoRoot versus projectDir in monorepos, and reading back the final config."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [Adapters · API Reference](https://nextjs.org/docs/app/api-reference/adapters/api-reference), [Creating an Adapter](https://nextjs.org/docs/app/api-reference/adapters/creating-an-adapter), [Adapters · Use Cases](https://nextjs.org/docs/app/api-reference/adapters/use-cases), [Adapters · Supporting Immutable Static Assets](https://nextjs.org/docs/app/api-reference/adapters/immutable-static-assets), and [`next.config.js` phases](https://nextjs.org/docs/app/api-reference/config/next-config-js).
> Target: **Next.js 16.3.4**. Node.js `>= 20.9`. Adapter API stable since 16.2. See [10 · The Adapters API — why it exists](10-the-adapters-api-why-it-exists-and-how-a-platform-wires-one-in.md) for the interface as a whole.

**The two adapter hooks look symmetrical and are not. `modifyConfig` is a *lifecycle* hook that runs whenever anything loads `next.config.js` — including `next dev` — and whose job is to negotiate capabilities before the build starts. `onBuildComplete` is a *reporting* hook that runs exactly once, after the build, and is the only moment at which the entire application is describable as data. Most adapter bugs are one of two misunderstandings: forgetting that `modifyConfig` fires outside a build, or resolving paths against the wrong root inside `onBuildComplete`.**

## `modifyConfig` — capability negotiation, not build configuration

The reference defines when the hook runs in one sentence, and the scope of it is wider than the name suggests:

> *"Called for any CLI command that loads the `next.config.js` file to allow modification of the configuration."*

Read that again: **any CLI command**. `next dev`, `next build`, `next start`, `next info` — anything that loads the config calls your hook. That is why `ctx.phase` exists and why every published adapter branches on it first.

The parameters, as the reference defines them:

- `config` — the complete Next.js configuration object.
- `ctx.phase` — the current build phase.
- `ctx.nextVersion` — the version of Next.js being used.
- `ctx.projectDir` — the absolute path to the Next.js project directory.

**Returns:** the modified configuration object, and the hook may be async — returning a promise for the config is explicitly allowed.

```js filename="my-adapter.js"
/** @type {import('next').NextAdapter} */
const adapter = {
  name: 'my-custom-adapter',

  async modifyConfig(config, { phase, nextVersion, projectDir }) {
    if (phase !== 'phase-production-build') return config

    return {
      ...config,
      // Platform capability declarations go here.
    }
  },
}

module.exports = adapter
```

### The canonical use: declaring a capability the *platform* provides

The immutable-static-assets adapter pattern is the cleanest example in the docs of what `modifyConfig` is actually for. The adapter is not configuring the build; it is telling Next.js what the hosting side can guarantee — while leaving the user a veto:

```js filename="my-adapter.js"
async modifyConfig(config, { phase }) {
  if (phase === 'phase-production-build') {
    config.supportsImmutableAssets =
      // Default to true, but allow users to opt-out
      config.supportsImmutableAssets ?? true

    // Optionally, pass a salt for the content hashes
    // config.outputHashSalt = getSaltForCurrentProject()
  }
  return config
}
```

The `??` is load-bearing. `config.supportsImmutableAssets ?? true` respects an explicit `false` from the user's own `next.config.js` and only supplies a default when the user said nothing. An adapter that wrote `config.supportsImmutableAssets = true` unconditionally would override a deliberate opt-out — and the `supportsImmutableAssets` reference is blunt about the consequence: turning the feature on when your provider or adapter does not actually support it can result in broken deployments. Not degraded caching, not a warning in the log — broken.

### `nextVersion` is how an adapter survives a framework major

You receive the running Next.js version before the build starts. That is the hook for feature-detecting a config key that does not exist on older versions, rather than setting it blindly and having the config validator reject it:

```js
const [major, minor] = nextVersion.split('.').map(Number)
const supportsImmutable = major > 16 || (major === 16 && minor >= 3)

if (supportsImmutable) {
  config.supportsImmutableAssets = config.supportsImmutableAssets ?? true
}
```

### Returning, not mutating

The signature returns a config, and the type permits a promise. Spreading a new object is the safer form because it makes the mutation surface explicit and survives a future where the input is frozen. The docs' own immutable-assets example mutates in place and returns; both are accepted today.

## `onBuildComplete` — the whole build, described exactly once

The reference is equally terse about the second hook: it is called after the build process completes, and it is handed detailed information about the routes and the outputs that build produced. Once, at the end, with everything known.

The context object splits into three groups, and it is worth holding them apart mentally because they answer different questions.

**Where things are on disk.**

| Field | What the reference says it holds |
| --- | --- |
| `projectDir` | The absolute path to the Next.js project directory |
| `repoRoot` | The absolute path to the *detected* repository root |
| `distDir` | The absolute path to the build output directory |

**What identifies this build.**

| Field | What the reference says it holds |
| --- | --- |
| `buildId` | A unique identifier for the current build |
| `nextVersion` | The version of Next.js being used |
| `config` | The **final** Next.js configuration — the one with `modifyConfig` already applied |

**What was built, and how to reach it.** `outputs` carries detailed information about all build outputs, organised by type; `routing` is the object holding Next.js's routing phases and their metadata. Each is large enough to have its own reference page, and each is covered separately in this chapter.

A skeleton that touches every group:

```js filename="my-adapter.js"
/** @type {import('next').NextAdapter} */
const adapter = {
  name: 'my-custom-adapter',

  async onBuildComplete({
    routing,
    outputs,
    projectDir,
    repoRoot,
    distDir,
    config,
    nextVersion,
    buildId,
  }) {
    // 1. Ship the compute units.
    for (const page of [...outputs.appPages, ...outputs.appRoutes]) {
      await packageFunction({
        id: page.id,
        entry: page.filePath,
        // assets keys are relative to repoRoot, not projectDir
        files: page.assets,
        maxDuration: page.config.maxDuration,
      })
    }

    // 2. Ship the bytes.
    for (const file of outputs.staticFiles) {
      await uploadStaticAsset(file.filePath, file.pathname)
    }

    // 3. Emit a routing table the platform's edge can execute.
    await writePlatformRoutes({
      buildId,
      basePath: config.basePath || '',
      phases: routing,
    })
  },
}

module.exports = adapter
```

### `buildId` is not `deploymentId`

`buildId` identifies the build; the separate `deploymentId` config option identifies the *deployment* and drives skew protection. They are related but not interchangeable — and since 16.2 they interact. In that release the Pages Router stopped detecting version skew from the build ID and started detecting it from the response header instead, and as a direct consequence the build ID is now held constant whenever `deploymentId` is set.

An adapter that keys platform storage on `buildId` while the app sets `deploymentId` will find that key stops changing between deployments. Key on whichever identity your platform actually rotates.

### The `output: 'export'` special case

One shape of build makes almost the entire `outputs` object empty. When `config.output` is set to `'export'`, only `outputs.staticFiles` is populated; every other array — `pages`, `appPages`, `pagesApi`, `appRoutes` and `prerenders` — comes back empty, because the entire application has been exported as static files and there is no compute left to describe.

An adapter that iterates `outputs.appPages` and concludes "no routes, something went wrong" is looking at a perfectly healthy static export. Branch on `config.output` before validating.

## What adapters are actually built for

The Use Cases page enumerates six intended shapes, and they are broader than "deploy to my cloud":

- **Deployment platform integration** — automatically configure build outputs for a specific hosting platform.
- **Asset processing** — transform or optimize the build outputs.
- **Monitoring integration** — collect build metrics and route information.
- **Custom bundling** — package the outputs in a platform-specific format.
- **Build validation** — ensure the outputs meet specific requirements.
- **Route generation** — use the processed route information to generate platform-specific routing configuration.

Three of those six — monitoring, validation, route generation — are read-only. A CI check that fails the build when a route's traced dependency set exceeds a size budget, or when a new dynamic route appears without a matching CDN rule, is a legitimate adapter that ships nothing anywhere.

## Gotchas

**★ `modifyConfig` runs during `next dev` and quietly corrupts your development server.**
Local development starts behaving like production — assets pointing at a CDN origin that does not exist, or a capability flag set that the dev server cannot honour. The cause is that the hook fires for *any* CLI command loading `next.config.js`, not just a build. Guard on the phase and return the untouched config for everything else:

```js
async modifyConfig(config, { phase }) {
  if (phase !== 'phase-production-build') return config
  config.supportsImmutableAssets = config.supportsImmutableAssets ?? true
  return config
}
```

**★ Overwriting a user's explicit opt-out instead of defaulting around it.**
A user sets `supportsImmutableAssets: false` to work around a CDN problem; the adapter sets it to `true` on every build and the workaround silently stops working. Use nullish coalescing so an explicit `false` survives, exactly as the documented example does: `config.supportsImmutableAssets = config.supportsImmutableAssets ?? true`. The same discipline applies to any capability flag an adapter defaults.

**★ Reading the user's `next.config.js` again inside `onBuildComplete`.**
Your adapter's own `modifyConfig` changes appear not to have taken effect. The cause is that `ctx.config` is documented as the *final* configuration — the one with `modifyConfig` already applied — while re-`require`ing the file from disk gives you the pre-modification object your hook was handed in the first place. Only ever read `ctx.config`:

```js
async onBuildComplete({ config }) {
  const immutable = config.supportsImmutableAssets === true
  // not: require(path.join(projectDir, 'next.config.js'))
}
```

**★ Assuming `projectDir === repoRoot`.**
Traced dependency paths resolve to nothing in a monorepo and the packaged function is missing half its `node_modules`. Output `assets` are documented as a map whose *keys* are paths relative to the repo root and whose values are absolute paths — and in a pnpm or Turborepo layout the repo root is several levels above the Next.js app. Resolve asset keys against `repoRoot`, and place the function entry relative to `projectDir`:

```js
for (const [relKey, absPath] of Object.entries(page.assets)) {
  const destination = path.join(bundleRoot, relKey) // relKey is repoRoot-relative
  await copyFile(absPath, destination)
}
```

**★ Treating a missing hook as an error when composing adapters.**
A wrapper adapter that delegates to another one throws on `undefined`, because both hooks are optional in the interface (`modifyConfig?`, `onBuildComplete?`). Call through defensively and fall back to the identity behaviour:

```js
const inner = require('some-other-adapter')
module.exports = {
  name: 'wrapper',
  async modifyConfig(config, ctx) {
    return (await inner.modifyConfig?.(config, ctx)) ?? config
  },
  async onBuildComplete(ctx) {
    await inner.onBuildComplete?.(ctx)
  },
}
```

**★ Concluding a static export is a broken build.**
`outputs.appPages`, `outputs.pages`, `outputs.pagesApi`, `outputs.appRoutes` and `outputs.prerenders` are all empty when `config.output === 'export'`, by design — only `staticFiles` is populated. A "did anything build?" assertion written against `appPages` fails on every export build. Branch on `config.output` first:

```js
if (config.output === 'export') {
  await uploadAll(outputs.staticFiles)
  return
}
```

**★ Keying platform storage on `buildId` in an app that sets `deploymentId`.**
Since 16.2 the build ID is deliberately held constant when `deploymentId` is set, so a cache namespace or asset prefix derived from `buildId` stops rotating between deployments and starts serving the previous deployment's artefacts. Key on `config.deploymentId` when it is present, and fall back to `buildId` only when it is not.

**★ Doing unbounded work in `onBuildComplete` and blowing the builder's time limit.**
The hook is awaited as part of `next build`, so every upload, hash and API call happens inside the build's wall clock. A build that succeeded locally times out on a hosted builder with a tighter limit. Batch uploads with bounded concurrency, and skip content you can prove is already present — which for content-addressed assets is exactly what `immutableHash` is for.

## Interview questions

**★ What are the two adapter hooks, and when is each called?**
`modifyConfig(config, ctx)` is called for any CLI command that loads `next.config.js` — including `next dev` — receiving the complete config plus `phase`, `nextVersion` and `projectDir`, and returning a possibly-modified config, optionally asynchronously. `onBuildComplete(ctx)` is called once after the build finishes, receiving `routing`, `outputs`, `projectDir`, `repoRoot`, `distDir`, the *final* `config`, `nextVersion` and `buildId`. Both are optional.

**★ Why does `modifyConfig` receive a `phase` at all?**
Because it is not build-specific. It fires on any config load. Without branching on `phase === 'phase-production-build'`, an adapter mutates the development configuration too, which produces local-only bugs that never reproduce in CI — the most expensive kind.

**★ You need to know whether immutable assets were enabled for this build. Where do you read it?**
From `ctx.config` inside `onBuildComplete`, never from the user's config file. The reference defines that field as the final Next.js configuration with `modifyConfig` applied, so it already reflects whatever your own hook decided — including the case where the user's explicit `false` overrode your default.

**★ In a monorepo, which path do you resolve traced assets against, and why?**
`repoRoot`. Every function-shaped output documents `assets` the same way: the key is the path relative to the repo root and the value is the absolute path. `projectDir` points at the Next.js app, which in a workspace is typically `packages/web` — several levels below where the keys are anchored. Using `projectDir` produces paths that either do not exist or, worse, exist and point at the wrong file.

**★ How would you write an adapter that deploys nothing?**
Implement only `onBuildComplete` and treat it as a report. The Use Cases page explicitly names monitoring integration, build validation and route generation as adapter use cases. A CI adapter can assert that no route's traced dependency set exceeds a size budget, that every dynamic route has a matching CDN rule, or simply emit route counts and output sizes as build metrics — and then return without writing anything outside the build directory.

**★ An adapter sets a config key that does not exist in the Next.js version being built. What happens, and how do you avoid it?**
The config validator rejects unknown keys, so the build fails on a version where the capability has not landed — which is how an adapter that works on 16.3 breaks a user pinned to 16.1. Feature-detect using `ctx.nextVersion`, which is handed to `modifyConfig` precisely so the adapter can decide before touching the config. This is the mechanism that lets one adapter version span a framework major.

**★ Why is `buildId` a poor cache-namespace key on some apps?**
Because it is not guaranteed to change per deployment. From 16.2, when `deploymentId` is set the build ID is held constant — the framework deliberately moved skew detection to a response header instead of the build ID. An adapter that namespaces platform storage by `buildId` will therefore collide across deployments on exactly those apps that were careful enough to configure skew protection.

---

← [The Adapters API — why it exists](10-the-adapters-api-why-it-exists-and-how-a-platform-wires-one-in.md) · [Chapter 16 overview](01-explanation.md) · Next → [Adapter output types](12-adapter-output-types-what-a-build-actually-is.md)
