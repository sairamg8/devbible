---
title: "TypeScript's compiler and Vite's resolver are two independent programs that each read a different config for the same alias, so keeping tsconfig.json paths and resolve.alias in sync by hand is a maintenance tax you can delete with resolve.tsconfigPaths or vite-tsconfig-paths"
sidebar_label: "01a · tsconfig paths vs resolve.alias"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Shared Options](https://vite.dev/config/shared-options), the Rolldown documentation — [tsconfig resolution](https://rolldown.rs/options/tsconfig), and the [`vite-tsconfig-paths`](https://github.com/aleclarson/vite-tsconfig-paths) README. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ tsconfig paths vs resolve.alias

**`tsc` and Vite's dev server are two separate resolvers reading two separate configuration files, and neither one consults the other.** `resolve.alias` in `vite.config.ts` tells Vite's own resolution pipeline how to turn `@/utils` into a real file at build and dev time; `tsconfig.json`'s `paths` (with `baseUrl`) tells the TypeScript language service and `tsc` how to type-check the same specifier and how your editor jumps to a definition. An app that only configures one of the two will run correctly with red squiggles everywhere, or type-check cleanly and crash at runtime — and the fix for either failure mode is never "wait for it to sync," because nothing syncs them automatically unless you add something that does.

## Two independent programs reading two independent files

Nothing in `vite.config.ts` is visible to `tsc`, and nothing in `tsconfig.json` is visible to Vite's default resolver — each program's alias support is documented entirely separately, on entirely separate pages, and neither one references the other's config format:

```typescript
// vite.config.ts — this is the ONLY thing Vite's resolver reads for the alias
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
});
```

```json
// tsconfig.json — this is the ONLY thing tsc and the TS language service read
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

Both are needed for `import { formatDate } from '@/utils/date'` to (a) actually run and (b) type-check and get IDE navigation. Configuring only the first gives you a working app with an editor screaming `Cannot find module '@/utils/date' or its corresponding type declarations.`; configuring only the second gives you a green editor and a runtime resolution failure the moment the bundler actually has to load the module, because Vite never looked at `tsconfig.json`'s `paths` by default.

`tsconfig.json`'s `paths` also carries a documented restriction worth knowing even before you touch Vite's side of it — it only applies to files TypeScript's own project actually includes:

> *"`paths` only applies to a file matched by a `tsconfig.json` through its `files` or `include`. Non-JS extension files should be explicitly listed in them, since a bare `"src"` or `"**/*"` `include` only matches TS/JS extensions, aligning with TypeScript's behavior."* — [Shared Options](https://vite.dev/config/shared-options)

## The mismatch pattern, and which side notices it

Because there is no shared source of truth, the two configs drift independently, and each drift direction produces a different failure:

```typescript
// vite.config.ts
resolve: {
  alias: {
    '@': path.resolve(import.meta.dirname, 'src'),
    '@ui': path.resolve(import.meta.dirname, '../../packages/ui-kit/src'),
  },
},
```

```json
// tsconfig.json — someone added '@ui' to vite.config.ts and forgot this file
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
      // '@ui/*' is missing here — tsc has never heard of it
    }
  }
}
```

```typescript
// src/App.tsx
import { Button } from '@ui/Button'; // ✅ runs fine — Vite resolves it via resolve.alias
// ❌ the editor and `tsc --noEmit` both report:
// Cannot find module '@ui/Button' or its corresponding type declarations.
```

The reverse drift — adding a path to `tsconfig.json` and forgetting `vite.config.ts` — is the more dangerous one, because it type-checks cleanly and only fails when the module actually loads:

```json
// tsconfig.json — '@ui' added here
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"], "@ui/*": ["../../packages/ui-kit/src/*"] } } }
```

```typescript
// vite.config.ts — '@ui' was never added to resolve.alias
resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
```

```typescript
// src/App.tsx — type-checks perfectly; fails to resolve at dev/build time,
// because Vite's default resolver has no idea '@ui' means anything
import { Button } from '@ui/Button';
```

## Two ways to stop maintaining both files by hand

### `resolve.tsconfigPaths` — read `tsconfig.json`'s `paths` directly, without a plugin

Vite 8 ships a first-party boolean that makes the *TypeScript* config the single source of truth, rather than the other way around:

> *"Enables the tsconfig paths resolution feature. `paths` option in `tsconfig.json` will be used to resolve imports."* — [Shared Options](https://vite.dev/config/shared-options)

Type `boolean`, default `false` — it is opt-in, not automatic just because a `paths` field exists:

```typescript
// vite.config.ts — one flag, tsconfig.json's paths become the alias source of truth
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
});
```

```json
// tsconfig.json — the ONLY place the mapping needs to live now
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@ui/*": ["../../packages/ui-kit/src/*"]
    }
  }
}
```

The same `files`/`include` restriction quoted above still applies — a `tsconfig.json` whose `include` only matches TS/JS extensions will not extend `paths` resolution to a bare-imported `.css` or `.svg` unless that pattern is widened — and one CSS preprocessor is explicitly carved out:

> *"Note that `resolve.tsconfigPaths` does not apply inside `.less` files."* — [Shared Options](https://vite.dev/config/shared-options)

This option is a thin surface over a capability that already lives in Rolldown's own resolver, not something Vite reimplemented:

> *"Rolldown's resolver uses `compilerOptions.paths`* ('Path mapping for module resolution') *and `compilerOptions.baseUrl`* ('Base directory for path resolution')*."* … *"Rolldown respects `references` and `include`/`exclude` patterns in tsconfig, while esbuild does not."* — [Rolldown, tsconfig resolution](https://rolldown.rs/options/tsconfig)

That last sentence is worth flagging on its own: it is a documented, cross-tool-attributed difference (Rolldown vs. esbuild) in how faithfully `tsconfig.json`'s project-reference structure is honoured — relevant if a monorepo's `tsconfig.json` uses `references` to compose several sub-projects' `paths`.

### `vite-tsconfig-paths` — the community plugin, for when you need it before `resolve.tsconfigPaths` covers your case

`vite-tsconfig-paths` predates the native option and is still the more battle-tested choice for setups involving multiple `tsconfig.json` files (a monorepo with one per package) or `baseUrl`-driven bare-import remapping:

> *"Give `vite` the ability to resolve imports using TypeScript's path mapping."* — [`vite-tsconfig-paths`](https://github.com/aleclarson/vite-tsconfig-paths)

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
});
```

It documents an additional `baseUrl` behaviour worth knowing before enabling it on an existing app: a `baseUrl` does not just gate the `paths` map, it also reroutes ordinary bare imports through your source tree first.

> *"If the `baseUrl` is defined, it gets prepended to all bare imports, and its resolution will take precedence over node_modules."* — [`vite-tsconfig-paths`](https://github.com/aleclarson/vite-tsconfig-paths)

Concretely: `baseUrl: '.'` plus a source file literally named `react.ts` in the project root would be tried *before* `node_modules/react` for a bare `import 'react'` — almost never what you want, and a reason to keep `baseUrl` scoped tightly (e.g. `"baseUrl": "./src"`) rather than pointed at the repo root out of habit.

One more fact worth recording for anyone pinning TypeScript alongside this plugin: its own v7 changed how it reads the config, specifically to decouple from the compiler version:

> *"Config parsing no longer loads the TypeScript compiler, so projects can use TypeScript 7 without a peer dependency conflict."* — [`vite-tsconfig-paths`](https://github.com/aleclarson/vite-tsconfig-paths)

### Choosing between the two, and the option nobody should pick

The three shapes side by side:

```typescript
// A — manual mirroring: resolve.alias AND tsconfig.json paths, kept in sync by hand.
// Two files, two chances to drift, zero automation. Only ever correct as a starting
// point before you reach for either of the two options below.
resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },

// B — resolve.tsconfigPaths: true. tsconfig.json is the single source of truth.
// First-party, no extra dependency, backed directly by Rolldown's own resolver.
resolve: { tsconfigPaths: true },

// C — vite-tsconfig-paths plugin. Same goal, more configuration surface
// (loose mode, multiple tsconfig roots), and the option to reach for when a
// monorepo's project-reference graph needs more than the native flag handles.
plugins: [tsconfigPaths()],
```

Whichever of B or C you pick, `tsconfig.json`'s `paths` becomes the *only* file you edit when adding an alias — `vite.config.ts` no longer needs a matching `resolve.alias` entry for that alias at all, which is the entire point.

## Gotchas

**★ Symptom: `import { Button } from '@ui/Button'` runs fine in the browser but the editor and `tsc --noEmit` both report `Cannot find module '@ui/Button'`.** Cause: `resolve.alias` has the mapping, `tsconfig.json`'s `paths` does not — the two resolvers are independent and this is the direction of drift that type-checking catches. Fix: add the matching entry to `tsconfig.json`'s `paths`, or stop maintaining two files and turn on `resolve.tsconfigPaths` or `vite-tsconfig-paths`.

**★ Symptom: the editor and `tsc` are both green, but the dev server throws a resolution error for the same import at runtime.** Cause: the drift ran the other way — `tsconfig.json`'s `paths` has the entry, `resolve.alias` in `vite.config.ts` does not, so nothing but the type-checker ever knew about it. Fix: add it to `resolve.alias`, or switch to `resolve.tsconfigPaths`/`vite-tsconfig-paths` so `tsconfig.json` is the only file that needs the entry.

**★ Symptom: turning on `resolve.tsconfigPaths` did nothing for an alias that imports a `.svg` file.** Cause: *"`paths` only applies to a file matched by a `tsconfig.json` through its `files` or `include`"*, and a bare `"src"` or `"**/*"` include pattern only matches TS/JS extensions by TypeScript's own rules — the `.svg` importer file itself may be fine, but if the *target* file's extension isn't matched by `include`, the mapping is not applied to it. Fix: widen the relevant `include` pattern, or keep a targeted `resolve.alias` entry for asset-heavy alias roots alongside `tsconfigPaths`.

**★ Symptom: `resolve.tsconfigPaths: true` is set, but an alias used only inside a `.less` file's `@import` still fails to resolve.** Cause: documented exception — *"`resolve.tsconfigPaths` does not apply inside `.less` files"*. Fix: give that specific alias a normal `resolve.alias` entry as well; the two mechanisms are not mutually exclusive and can be combined per-alias.

**★ Symptom: after adding `vite-tsconfig-paths`, an internal file at the project root shadows the real `node_modules` package with the same name for one specific bare import.** Cause: `baseUrl` in `tsconfig.json` — per the plugin's own documentation, a defined `baseUrl` "gets prepended to all bare imports, and its resolution will take precedence over node_modules," not just to names listed in `paths`. Fix: scope `baseUrl` to a subdirectory (`"baseUrl": "./src"`) rather than the repo root, so it cannot collide with real package names.

**★ Symptom: a monorepo `tsconfig.json` composed from several sub-project `tsconfig.json` files via `references` behaves differently under Vite than it did under an esbuild-based tool.** Cause: documented, named difference at the resolver level — *"Rolldown respects `references` and `include`/`exclude` patterns in tsconfig, while esbuild does not"*. Fix: treat this as an upgrade in fidelity, not a regression — verify the newly-honoured `references`/`include` boundaries are what you actually intended, since a boundary esbuild silently ignored may now be enforced.

## Interview questions

**★ Why doesn't Vite just read `tsconfig.json`'s `paths` by default, given that most projects already have one?**
Because `resolve.alias` and TypeScript's `paths` are two independently designed features owned by two independently versioned tools, and Vite has no framework-level obligation to assume a project even uses TypeScript. Reading `tsconfig.json` unconditionally would mean every non-TypeScript project pays the cost of a `tsconfig.json` lookup on every resolution, and every TypeScript project that *doesn't* want its `paths` to double as runtime aliases would have no way to opt out. `resolve.tsconfigPaths` exists as an explicit, opt-in `boolean` for exactly the projects that do want that coupling.

**★ A teammate says "I added the alias to vite.config.ts, why is TypeScript still complaining?" What question do you ask first?**
Whether they also added it to `tsconfig.json`'s `paths` — or whether the project has `resolve.tsconfigPaths` or `vite-tsconfig-paths` enabled, in which case the fix is the opposite: the entry belongs in `tsconfig.json` and `vite.config.ts` shouldn't need touching at all. The two failure directions look similar from the outside ("an alias doesn't work somewhere") but have opposite fixes, so the first diagnostic step is always "which of the two config files, or neither, has the mapping."

**★ What does `vite-tsconfig-paths`'s handling of `baseUrl` do that a naive `paths`-only reading would not, and why is that risky?**
It reroutes *every* bare import — not just names explicitly listed in `paths` — through the `baseUrl` directory first, ahead of `node_modules`, per its own documentation ("gets prepended to all bare imports, and its resolution will take precedence over node_modules"). That is risky exactly where `baseUrl` is set broadly (like the repo root): a source file that happens to share a name with a real npm package — `utils.ts`, `types.ts`, `config.ts` — starts shadowing that package for every bare import in the project, silently, because the plugin was never told to scope its reach to a `paths` map alone.

**★ Why might a team deliberately choose `vite-tsconfig-paths` over the native `resolve.tsconfigPaths`, even after the native option exists?**
Maturity and configuration surface for cases the native flag doesn't yet cover — the plugin predates the native option, has been exercised across more monorepo shapes (multiple `tsconfig.json` roots, project references, looser matching), and its v7 decoupling from loading the actual TypeScript compiler removes a peer-dependency constraint that matters on a codebase pinning an unusual TypeScript version. The native option is the right default for a new, single-`tsconfig.json` project; the plugin remains the safer choice where the project's `tsconfig.json` topology is more complex than "one file at the root."

---

← [01 · resolve.alias fundamentals](01-resolve-options.md) · [Vite overview](../../README.md) · Next → [01b · Aliases in CSS, HTML & assets](01b-aliases-in-css-html-and-assets.md)
