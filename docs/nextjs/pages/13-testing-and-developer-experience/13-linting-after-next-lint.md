---
sidebar_position: 13
title: "next lint was removed in Next.js 16 and next build no longer runs the linter, so an upgraded project silently stops linting until you wire ESLint or Biome up yourself"
sidebar_label: "13 · Linting after next lint"
description: "What the next lint removal actually broke, what the next-lint-to-eslint-cli codemod writes and how its output differs from the current recommended config, choosing between ESLint and Biome in create-next-app, and the AGENTS.md block next dev maintains."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16), [ESLint Plugin](https://nextjs.org/docs/app/api-reference/config/eslint), [Installation](https://nextjs.org/docs/app/getting-started/installation), [create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app) and [Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods).
> Target: **Next.js 16.3.4** · `next lint` removed in 16.0 · `@next/eslint-plugin-next` defaults to ESLint Flat Config.

**The dangerous half of this change is not the removed command — a missing binary fails loudly. It is the second sentence of the release note: `next build` no longer runs the linter. A team whose CI ran `next build` and considered linting covered now has a green pipeline that lints nothing, and no error anywhere tells them. Meanwhile `create-next-app` has stopped assuming ESLint at all: it offers ESLint, Biome or None, and Biome brings formatting with it, which changes what your Prettier setup is for.**

## What was removed

The upgrade guide states the change in three short clauses, and the third is the one that costs people months:

> *"The `next lint` command has been removed. Use Biome or ESLint directly. `next build` no longer runs linting."*

The guide adds a fourth casualty separately: the `eslint` option in the Next.js config file is also removed.

```js title="next.config.mjs"
/** @type {import('next').NextConfig} */
const nextConfig = {
  // No longer supported
  // eslint: {},
}

export default nextConfig
```

So three things went at once: the command, the build-time integration, and the config surface (`ignoreDuringBuilds`, `dirs`) that only existed to configure the build-time integration. The ESLint reference confirms the config side from its own angle — as part of the removal, the `eslint` option in your Next config file is no longer needed and can be safely deleted.

## The codemod, and the thing to check afterwards

```bash
npx @next/codemod@canary next-lint-to-eslint-cli .
```

The codemod's documented behaviour is four steps. It creates an `eslint.config.mjs` carrying the Next.js recommended configurations. It updates the `package.json` scripts so they run `eslint .` rather than `next lint`. It adds the necessary ESLint dependencies to `package.json`. And it preserves any existing ESLint configuration it finds rather than overwriting it.

```json title="package.json"
{
  "scripts": {
    "lint": "eslint ."
  }
}
```

The generated config uses the legacy-config compatibility shim:

```js title="eslint.config.mjs — as written by the codemod"
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
]

export default eslintConfig
```

The ESLint API reference, meanwhile, documents the *native* flat setup with no shim:

```js title="eslint.config.mjs — as documented for a new project"
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
```

Both are valid. The codemod's job is to move you off `next lint` without breaking anything, so it reaches for `FlatCompat` and the `next/...` shareable-config names. The reference describes where you should end up: direct imports of `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`, and `@eslint/eslintrc` gone from your dependencies. Treat the codemod output as step one of two.

## The three `eslint-config-next` entry points

- **`eslint-config-next`** — base config with Next.js, React and React Hooks rules, for JavaScript and TypeScript files.
- **`eslint-config-next/core-web-vitals`** — everything in the base, plus rules that affect Core Web Vitals raised from warnings to errors. Recommended for most projects, and automatically included by `create-next-app`.
- **`eslint-config-next/typescript`** — TypeScript rules from `typescript-eslint`, used *alongside* one of the other two, based on `plugin:@typescript-eslint/recommended`.

The plugin ships rules you will actually meet: `@next/next/no-img-element`, `@next/next/no-html-link-for-pages`, `@next/next/no-async-client-component`, `@next/next/no-sync-scripts`, `@next/next/inline-script-id`, `@next/next/google-font-display` and around fifteen more, all enabled in the recommended set.

## ESLint or Biome

`create-next-app` now asks:

```txt
Which linter would you like to use? ESLint / Biome / None
```

with `--eslint`, `--biome` and `--no-linter` as the non-interactive equivalents. The distinction that matters is how the docs characterise each option.

**ESLint** is described as the traditional and most popular JavaScript linter, and the Next.js-specific rules it brings come from `@next/eslint-plugin-next`.

**Biome** is described as a fast, modern linter *and formatter* that combines the functionality of ESLint and Prettier — and its Next.js coverage is characterised as built-in Next.js and React domain support, included for optimal performance.

Scripts, per the installation guide:

```json title="package.json — ESLint"
{
  "scripts": {
    "lint": "eslint",
    "lint:fix": "eslint --fix"
  }
}
```

```json title="package.json — Biome"
{
  "scripts": {
    "lint": "biome check",
    "format": "biome format --write"
  }
}
```

Biome replaces Prettier as well as ESLint. ESLint does not — it contains formatting rules that fight Prettier, which is why the docs recommend adding `eslint-config-prettier`:

```js title="eslint.config.mjs"
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import prettier from 'eslint-config-prettier/flat'

const eslintConfig = defineConfig([
  ...nextVitals,
  prettier,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])

export default eslintConfig
```

The critical difference for an existing codebase is that the Next.js-specific rules live in `@next/eslint-plugin-next`, and Biome's coverage is only ever described as built-in Next.js and React *domain support* — never as a port of that plugin. If your team relies on specific `@next/next/*` rules, verify Biome covers the ones you care about before switching.

## Flat config is now the default

`@next/eslint-plugin-next` now defaults to the ESLint Flat Config format, and the upgrade guide gives the reason it moved: it aligns the plugin with ESLint v10, which will drop legacy config support altogether.

If you are still on `.eslintrc.*`, that is now borrowed time on two fronts — the plugin's default and ESLint v10 itself.

## Adding Next.js rules to an existing ESLint setup

Two documented paths, and choosing wrong produces confusing duplicate-plugin errors.

**Use the plugin directly** if you already configure `react`, `react-hooks`, `jsx-a11y` or `import` — separately or through a preset like `airbnb` — or have custom `parserOptions`, or use `eslint-plugin-import` with custom resolvers:

```js title="eslint.config.mjs"
import { defineConfig } from 'eslint/config'
import nextPlugin from '@next/eslint-plugin-next'

const eslintConfig = defineConfig([
  // Your other configurations...
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
    },
  },
])

export default eslintConfig
```

The reference's justification for that path is precise: registering the plugin directly eliminates the risk of the collisions and errors that occur when the same plugins or parsers get imported across multiple configurations.

**Spread the shareable config** only for straightforward setups, remembering that ESLint applies configs in order so later entries override earlier ones for matching files.

In a monorepo where Next.js is not at the root, tell the plugin where the app is:

```js title="eslint.config.mjs"
settings: {
  next: {
    rootDir: 'packages/my-app/',
  },
}
```

`rootDir` accepts a path, a glob such as `"packages/*/"`, or an array of both.

## The other thing `create-next-app` scaffolds

The recommended-defaults path now includes an agent instruction file:

```txt
Would you like to use the recommended Next.js defaults?
    Yes, use recommended defaults - TypeScript, ESLint, Tailwind CSS, App Router, AGENTS.md
```

`--agents-md` is on by default, and its documented purpose is to include `AGENTS.md` and `CLAUDE.md` to guide coding agents — where the `CLAUDE.md` simply references `AGENTS.md`. For an existing project, `npx @next/codemod@canary agents-md` sets it up.

The block inside `AGENTS.md` is *managed*: `next dev` writes and maintains a version-matched section, delimited by a `BEGIN:nextjs-agent-rules` / `END:nextjs-agent-rules` HTML-comment pair, pointing agents at the docs bundled in `node_modules/next/dist/docs/`. The upgrade guide anticipates the obvious reaction and heads it off: the block is written and re-added by `next dev` — you can verify that in `node_modules/next/dist/server/lib/generate-agent-files.js` — so removing it from a diff only re-creates the same uncommitted change, and committing it with your work is what keeps the tree clean.

## Gotchas

**★ The silent failure is `next build` no longer linting, not the missing command.**
A `next lint` invocation fails loudly with an unknown command. A CI pipeline that only ran `next build` and treated lint as covered now passes with zero linting and no message. Audit every pipeline for an explicit `eslint` or `biome check` step as part of the upgrade — this is the single most likely thing to be quietly wrong in an upgraded repository months later.

**★ The `eslint` key in `next.config` is removed, so `ignoreDuringBuilds` is not doing what it says.**
It configured a build-time integration that no longer exists. A project carrying `eslint: { ignoreDuringBuilds: true }` looks like it has deliberately deferred linting, when in fact nothing would run either way. Delete the key during the upgrade so the config stops lying.

**★ The codemod's output is not the configuration the docs recommend.**
It writes a `FlatCompat` shim over `next/core-web-vitals` and `next/typescript`, pulling in `@eslint/eslintrc`. The API reference documents direct imports of `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` with `defineConfig` and `globalIgnores`. Both work; only one is the destination. Plan a follow-up commit rather than assuming the codemod left you in the recommended state.

**★ Overriding `ignores` silently drops the config's own defaults.**
`eslint-config-next` ships default ignores — `.next/**`, `out/**`, `build/**`, `next-env.d.ts` — and the documented examples re-declare all four inside `globalIgnores` precisely because overriding replaces them. Omit them and ESLint starts linting build output, which is slow, noisy, and produces errors in files you do not own.

**★ Choosing Biome is also choosing a formatter, and choosing ESLint is not.**
Biome combines linting and formatting, so it displaces Prettier. ESLint contains formatting rules that conflict with Prettier, which is why `eslint-config-prettier/flat` is a documented addition rather than an optional nicety. Picking a linter without deciding the formatting question leaves two tools disagreeing about your source on every save.

**★ Biome's Next.js coverage is not a port of `@next/eslint-plugin-next`.**
The docs claim built-in Next.js and React *domain support*, which is a different claim from implementing the twenty-odd `@next/next/*` rules. If your codebase depends on specific ones — `no-html-link-for-pages` and `no-async-client-component` are the two that catch real bugs rather than style — confirm the equivalent exists before migrating.

**★ Spreading `eslint-config-next` into a config that already has `airbnb` or `react-app` produces plugin collisions.**
The reference names the exact triggers: `react`, `react-hooks`, `jsx-a11y` or `import` already configured, custom `parserOptions`, or `eslint-plugin-import` with custom resolvers. In those cases register `@next/eslint-plugin-next` directly and spread only its recommended rules, rather than the whole shareable config.

**★ In a monorepo the plugin cannot find your app, and the rules that need it go quiet.**
Rules like `no-html-link-for-pages` need to know where the app lives. Without `settings.next.rootDir` they cannot resolve your routes, so the linter runs clean for the wrong reason. Set `rootDir` to a path, a glob, or an array of them.

**★ Legacy `.eslintrc` is on borrowed time from two directions.**
`@next/eslint-plugin-next` now defaults to flat config, and ESLint v10 will drop legacy config support. A project still on `.eslintrc` should schedule the migration rather than wait for a major version to force it.

**★ Deleting the managed `AGENTS.md` block just re-creates it.**
`next dev` rewrites the version-matched section every run. Removing it from a diff produces an uncommitted change that comes straight back; the documented advice is to commit it with your work so the tree stays clean. After an upgrade, check the block still points at `node_modules/next/dist/docs/` rather than an older `.next-docs/` directory.

**★ `--no-linter` is a real choice and it leaves you with nothing.**
"None" in the prompt skips linter configuration entirely — no config file, no lint script. That is defensible for a spike and a trap for anything that outlives the week, because nothing in the build will ever remind you.

## Interview questions

**★ What exactly changed about linting in Next.js 16, and which part is dangerous?**
Three things: `next lint` was removed, `next build` stopped running the linter, and the `eslint` option in the Next.js config was removed. The dangerous one is the second. A missing command fails loudly; a build that quietly stops linting leaves a green pipeline that checks nothing, and there is no warning anywhere.

**★ What does the `next-lint-to-eslint-cli` codemod do, and what is left to do afterwards?**
It creates an `eslint.config.mjs` with Next.js recommended configuration, rewrites `package.json` scripts from `next lint` to `eslint .`, adds the needed dependencies, and preserves any existing ESLint configuration it finds. What it leaves behind is a `FlatCompat` shim over the `next/...` config names; the reference documents direct imports of `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` instead, so migrating off `@eslint/eslintrc` is a follow-up.

**★ What is the difference between `eslint-config-next` and `eslint-config-next/core-web-vitals`?**
The base config carries Next.js, React and React Hooks rules for JS and TS files. The `core-web-vitals` entry includes all of that and raises the rules that affect Core Web Vitals from warnings to errors. It is what `create-next-app` scaffolds and what the docs recommend for most projects. `eslint-config-next/typescript` is a third, additive entry for `typescript-eslint` rules.

**★ How does choosing Biome instead of ESLint change the rest of your toolchain?**
Biome is a linter *and* a formatter, so it displaces Prettier as well as ESLint, and its scripts are `biome check` and `biome format --write`. ESLint keeps the formatting question open — its own formatting rules conflict with Prettier, so `eslint-config-prettier` becomes a required piece. The other consideration is rule coverage: the Next.js-specific rules live in `@next/eslint-plugin-next`, and Biome is documented as having built-in Next.js and React domain support rather than as implementing that plugin.

**★ You are adding Next.js rules to a codebase that already extends `airbnb`. What do you do?**
Register `@next/eslint-plugin-next` directly and spread only `nextPlugin.configs.recommended.rules` into a config object scoped to your source files, rather than spreading the whole `eslint-config-next` shareable config. The docs name this case explicitly — conflicting `react`, `react-hooks`, `jsx-a11y` or `import` plugins — because importing the same plugins through two configs causes collisions.

**★ Your monorepo lints clean and you do not believe it. What would you check first?**
`settings.next.rootDir`. When Next.js is not installed at the repository root, `@next/eslint-plugin-next` needs to be told where the application lives; without it the route-aware rules cannot resolve anything and simply do not fire. Set it to a path, a glob like `"packages/*/"`, or an array.

**★ What is the `AGENTS.md` file `create-next-app` writes, and why does the block inside it keep coming back?**
It is an instruction file for coding agents, included by default along with a `CLAUDE.md` that references it. `next dev` writes and maintains a version-matched block inside it that points agents at the docs bundled in `node_modules/next/dist/docs/`, so an agent works from the Next.js version you actually have rather than its training data. Deleting the block only produces an uncommitted change that the next `next dev` restores; the documented advice is to commit it.

---

← [12 · TypeScript 7 and build type checking](12-typescript-7-and-build-type-checking.md) · [Chapter 13 overview](01-explanation.md)
