---
title: "Which bundler performs the chunk pass is decided by a tristate environment variable that ignores every value it does not recognise — and since 22.1.0 it re-chunks your server build too, so two machines with different shells produce different bundles from the same commit"
sidebar_label: "04c · The Rolldown switch"
sidebar_position: 4.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **`@angular/build` 22.1.7** — the source of
> [`src/utils/environment-options.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/environment-options.ts)
> and [`src/builders/application/chunk-optimizer.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/chunk-optimizer.ts)
> at tag `v22.1.7`; the `22.1.0` section of
> [CHANGELOG.md](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md); and the
> `dependencies`, `peerDependencies` and `peerDependenciesMeta` of the published manifest at
> [registry.npmjs.org/@angular/build/22.1.7](https://registry.npmjs.org/@angular/build/22.1.7).
> Source-validated; **no sandbox run** — nothing on this page was executed, and one claim is
> recorded below as explicitly unconfirmed.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The chunk optimizer has two implementations, and which one runs is decided by a variable that
silently ignores any value it does not literally recognise.** Rolldown became the default in 22.1.0;
Rollup was there before it and is still declared, as an optional peer. Neither switch is public API,
neither appears in a JSON schema or on angular.dev, and both are read once at module load — which
means the chunk graph you ship can differ between your laptop and CI for no reason visible in the
repository. This chunk is that switch, the fallback behind it, the 22.1.0 change that extended the
pass to server builds, and how to stop the environment deciding your output by accident.

## The switch

```ts
/**
 * Allows using Rolldown for chunk optimization instead of Rollup.
 * This is useful for debugging and testing scenarios.
 */
export const useRolldownChunks = parseTristate(process.env['NG_BUILD_CHUNKS_ROLLDOWN']) ?? true;
```

Two things in five lines. The default is `true` — Rolldown — via `?? true`. And the doc comment
tells you what the maintainers think the switch is *for*: *"debugging and testing scenarios"*. It is
not a supported way to choose a bundler for production, and it should not appear in a `package.json`
script that ships.

## `parseTristate` recognises four strings, and nothing else is an error

The parser behind that line accepts exactly four literals:

```ts
/** A set of strings that are considered "truthy" when parsing environment variables. */
const TRUTHY_VALUES = new Set(['1', 'true']);

/** A set of strings that are considered "falsy" when parsing environment variables. */
const FALSY_VALUES = new Set(['0', 'false']);
```

Anything else returns `undefined`, and `undefined` is not an error — it is an absence, so `?? true`
supplies the default. The source even acknowledges the gap, in a comment beside the parser:
`// TODO: Consider whether a warning is useful in this case of a malformed value`.

⚠️ **So `NG_BUILD_CHUNKS_ROLLDOWN=rollup` selects Rolldown.** So does `=no`, `=off`, `=disabled` and
every other plausible-looking spelling. There is no warning, no log line and no failure — you get
the default and a false sense of having configured something. The same strictness governs the whole
`NG_BUILD_*` family; that surface and its parsing rules belong to
[11 · Cache, workers and the environment variables](11-cache-and-workers.md).

🔴 **Note the contrast with its neighbour.** `NG_BUILD_OPTIMIZE_CHUNKS`, taught in
**[04b · What the second pass is worth](04b-what-the-second-pass-is-worth.md)**, does *not* use
`parseTristate` — it has its own bespoke parser with a `Number.parseInt` branch. Two variables
controlling one pass, sitting in the same file, parsing their values by different rules. Do not
carry an assumption from one to the other.

## What `rollup` is doing in the peer dependencies

`@angular/build@22.1.7` declares `"rollup": "^4.0.0"` in `peerDependencies`, and lists it in
`peerDependenciesMeta` as `{"optional": true}`. `rolldown`, meanwhile, is a hard runtime dependency
at an exact pin:

```json
"dependencies": {
  "rolldown": "1.2.0"
},
"peerDependencies": {
  "rollup": "^4.0.0"
},
"peerDependenciesMeta": {
  "rollup": { "optional": true }
}
```

*(Three fields lifted from the published manifest; the complete dependency and peer lists are
[02 · Inside the package](02-inside-the-package.md).)*

That asymmetry is exactly what you would expect from the 22.1.0 changelog line
*"default chunk optimization to use Rolldown"*: Rollup was the previous implementation, it is now
the fallback the switch selects, and it is optional because most projects never take that path.
`chunk-optimizer.ts` imports from it only as a type — `import type { Plugin } from 'rollup'` — which
costs nothing at runtime.

🔴 **What could not be confirmed: whether taking the Rollup path requires you to install `rollup`
yourself.** An optional peer plus a type-only import is consistent with either answer, and neither
the changelog nor angular.dev — which does not mention the chunk optimizer at all — settles it.
Treat `NG_BUILD_CHUNKS_ROLLDOWN=0` as a switch that may need `rollup` present in `node_modules`, and
verify that before depending on it in a pipeline.

## Server builds joined the pass in 22.1.0

> *"| 51f69276f | feat | enable chunk optimization for server builds |"*
> — [CHANGELOG.md](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md), section `# 22.1.0 (2026-07-29)`

Before 22.1.0 the pass applied to the browser output. From 22.1.0 the server output is optimized as
well. For an SSR application that means the 22.0.x → 22.1.x upgrade changes **both** halves of the
chunk graph at once, and it changes them for two reasons that landed in the same release — Rolldown
becoming the default optimizer (`585d08af8`) and the server output entering the pass (`51f69276f`).

⚠️ Worth separating when you review that diff: a browser bundle that changed could be either cause;
a server bundle that changed for the first time is the second one.

## Making two machines agree

Everything on this page and on 04b is decided by the environment, and the environment is the least
version-controlled thing in your build. A variable exported from a shell profile eighteen months
ago, a CI image that sets one for an unrelated reason, a `Dockerfile` `ENV` line copied from another
project — any of these silently changes which bundler produced your chunks, and nothing in the
repository records it.

If output equality matters — a reproducible-build requirement, a byte-diff gate in review, or a
"why is CI different" investigation — make the decision explicit rather than inherited:

```bash
# CI: state the chunk-optimizer decision instead of inheriting it
export NG_BUILD_OPTIMIZE_CHUNKS=3
export NG_BUILD_CHUNKS_ROLLDOWN=1
ng build --configuration production
```

⚠️ **That buys reproducibility with a dependency on an internal detail.** These variables carry no
compatibility promise and can change in a patch release; pinning them means your build now has an
opinion about `@angular/build`'s internals. Do it where the reproducibility is the requirement, and
leave them alone everywhere else.

There is no `angular.json` equivalent. Neither variable has a builder option, the `application`
schema has no rolldown or chunk-optimizer property, and there is no configuration file the optimizer
reads — it constructs its rolldown input in code from the esbuild result.

## Gotchas

**★ Symptom: `NG_BUILD_CHUNKS_ROLLDOWN=rollup` still runs Rolldown.** Cause: the value is parsed as
a tristate — only `1`, `true`, `0` and `false` are recognised; everything else becomes `undefined`
and `?? true` restores the default, with no warning. Fix: use the falsy literal:

```bash
NG_BUILD_CHUNKS_ROLLDOWN=0 ng build --configuration production
```

**★ Symptom: an SSR application's server bundles changed shape on a 22.0.x → 22.1.x upgrade, on top
of the browser bundles changing.** Cause: two 22.1.0 entries landing together — `585d08af8` made
Rolldown the default optimizer and `51f69276f` extended chunk optimization to server builds. Fix:
nothing to fix, but to see the old shape once while you review, take the pass out:

```bash
NG_BUILD_OPTIMIZE_CHUNKS=0 ng build --configuration production
```

**★ Symptom: CI and local builds of the same commit produce different JavaScript.** Cause: one
environment has one of these variables set and the other does not, and neither build reports which
path it took. Fix: set both explicitly on both sides so the decision is in the repository rather
than in someone's shell:

```bash
export NG_BUILD_OPTIMIZE_CHUNKS=3
export NG_BUILD_CHUNKS_ROLLDOWN=1
```

**★ Symptom: exporting the variable from inside a build script has no effect.** Cause:
`useRolldownChunks` and `optimizeChunksThreshold` are module-level constants, evaluated the first
time `environment-options.ts` is imported — which happens inside the already-running `ng` process.
Fix: put the variable in the environment of the command itself, not in a step that runs after it
starts:

```bash
NG_BUILD_CHUNKS_ROLLDOWN=0 ng build
```

**Symptom: you add the variables to `angular.json` and they are ignored.** Cause: they are process
environment variables read from `process.env`, not builder options; `angular.json` has no field for
either, and `additionalProperties` on the builder schemas would reject an invented one anyway. Fix:
set them where a process environment is set — the npm script, the CI job, or the shell:

```json
{
  "scripts": {
    "build:norolldown": "NG_BUILD_CHUNKS_ROLLDOWN=0 ng build --configuration production"
  }
}
```

**Symptom: you plan to standardise the team on the Rollup path because it is "the safer one".**
Cause: reading an optional peer dependency as a supported configuration. The switch's own doc
comment scopes it to *"debugging and testing scenarios"*, and whether the Rollup path needs `rollup`
installed is unconfirmed. Fix: if a Rolldown defect is blocking you, disable the pass entirely
rather than switching implementations, and pin the CLI version that works while you wait for a fix —
see [04 · `ng update`, not `npm install`](../04-ng-update-not-npm-install/README.md):

```bash
NG_BUILD_OPTIMIZE_CHUNKS=0 ng build --configuration production
```

**Symptom: you go looking for a `rolldown.config.ts` to tune the pass and find none.** Cause: the
optimizer constructs its input options in code from the esbuild result; the only switches are the
two environment variables, and there is no `angular.json` option for any of it. Fix: use the switch,
and treat it as a debugging lever rather than project configuration:

```bash
NG_BUILD_OPTIMIZE_CHUNKS=0 ng build
```

## Interview questions

**★ What is `rollup` doing in `@angular/build`'s peer dependencies if Angular uses Rolldown?**
It is the other implementation of the same pass. `NG_BUILD_CHUNKS_ROLLDOWN` exists specifically to
select between them, its doc comment says the switch is *"useful for debugging and testing
scenarios"*, and Rolldown only became the default in 22.1.0 — before that, Rollup performed the
chunk optimization. So `rollup` stays declared as an **optional** peer at `^4.0.0` while `rolldown`
is a hard dependency pinned exactly at `1.2.0`, and `chunk-optimizer.ts` imports from `rollup` only
as a type. What I would not assert is whether taking the Rollup path requires installing `rollup`
yourself; the optional-peer declaration and the type-only import are consistent with either answer,
and no source settles it.

**★ What happens if you set `NG_BUILD_CHUNKS_ROLLDOWN` to a value the CLI does not recognise?**
Nothing, silently. `parseTristate` accepts only `'1'`, `'true'`, `'0'` and `'false'`; every other
string returns `undefined`, and `?? true` then applies the default. So `=rollup`, `=off` and `=no`
all leave Rolldown in place, with no warning — the source even carries a `TODO` wondering whether a
warning would be useful. The reason this is worth knowing beyond this one variable is that it is the
family behaviour: the entire `NG_BUILD_*` surface parses this strictly, so a misspelled value
anywhere in it reads as "unset" and looks like the feature ignoring you.

**★ Why can two machines produce different bundles from the same commit?**
Because the chunk optimizer's three gates include two environment variables that are not in the
repository. `NG_BUILD_OPTIMIZE_CHUNKS` decides whether the pass runs and
`NG_BUILD_CHUNKS_ROLLDOWN` decides which bundler performs it, both are read once at module load from
`process.env`, and neither is echoed anywhere in the build's own reporting. A CI image that exports
one, or a developer who set one months ago while debugging, changes the shipped chunk graph with no
trace in the diff. The fix is to set both explicitly in CI so the decision lives in version control,
accepting that this pins you to internals with no compatibility promise.

**★ Are these variables configuration?**
No, and treating them as configuration is the mistake. They live in
`packages/angular/build/src/utils/environment-options.ts` — an internal utility file. They appear in
no builder schema, so `angular.json` cannot set them and would reject them if you tried; they are
absent from angular.dev, which does not document the chunk optimizer at all; and they are outside
Angular's semantic-versioning guarantees, so a patch release may change or remove one. They are
debugging levers. A build pipeline that depends on one should say in a comment why, so that the
dependency is deliberate rather than inherited.

**What changed for server-side rendered applications in 22.1.0?**
Chunk optimization started applying to the server build as well as the browser build
(`51f69276f`, *"feat | enable chunk optimization for server builds"*), in the same release that made
Rolldown the default implementation (`585d08af8`). For an SSR project the practical effect is that a
22.0.x → 22.1.x upgrade rewrites both halves of the output at once, for two independent reasons. If
you have to attribute a change during that review, the distinguishing signal is that a server bundle
entering the pass for the first time can only be the second entry.

---

← Prev: [What the second pass is worth](04b-what-the-second-pass-is-worth.md) · Index: [Topic index](README.md) · Next → [Vite is only the dev server](05-vite-is-only-the-dev-server.md)
