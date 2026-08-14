---
title: "05 · Storybook 10 and the package consolidation"
sidebar_label: "05 · Storybook 10 and packages"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the [Storybook 9.0 addon migration guide](https://storybook.js.org/docs/9/addons/addon-migration-guide)
> (the package consolidation table), the [Storybook 10 migration guide](https://storybook.js.org/docs/releases/migration-guide),
> the [Storybook 10.0 release notes](https://storybook.js.org/releases/10.0),
> the [10.3 release post](https://storybook.js.org/blog/storybook-10-3/), and
> [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest) on the npm registry.
> **No sandbox run** — this page carries no console output.

This is the topic that saves you an afternoon.

Storybook made two large structural changes in consecutive majors. Almost every
tutorial, Stack Overflow answer and AI-generated snippet about Storybook predates
them. When you paste one and it fails, the error is a module resolution failure,
which is the least informative error possible — it tells you a package is missing,
not that the package was **deleted on purpose two years ago**.

## The two changes

**Storybook 9 (2025) consolidated the packages.** Most `@storybook/*` packages
were folded into the single `storybook` package, and several addons were deleted
outright because their features became core.

**Storybook 10 (October 2025) went ESM-only.** Your `.storybook/main.ts` and any
preset must be valid ESM, and Node **20.19+ or 22.12+** is required. Reported
benefits of the ESM move were a ~29% smaller install and unminified `dist` output
for readable stack traces.

Current on npm as of 2026-08-14: **`storybook@10.5.8`**.

## The mapping — the table to bookmark

### Moved into the core `storybook` package

| Pre-9.0 | On 10.x |
|---|---|
| `@storybook/test` | **`storybook/test`** |
| `@storybook/addon-actions` | **`storybook/actions`** |
| `@storybook/theming` | **`storybook/theming`** |
| `@storybook/manager-api` | **`storybook/manager-api`** |
| `@storybook/preview-api` | **`storybook/preview-api`** |
| `@storybook/addon-viewport` | **`storybook/viewport`** |
| `@storybook/addon-highlight` | **`storybook/highlight`** |

Note the shape: the `@` and the slash-scope are gone. `@storybook/test` becomes
`storybook/test` — a subpath of the one package you already depend on.

### Deleted — the feature is core, install nothing

| Pre-9.0 package | What happened |
|---|---|
| `@storybook/addon-essentials` | **Gone.** It was a meta-package bundling the addons below; they are all core now |
| `@storybook/addon-interactions` | **Gone.** Interactions are core |
| `@storybook/addon-controls` | **Gone.** Controls are core |
| `@storybook/addon-backgrounds` · `-measure` · `-outline` · `-toolbars` | **Gone.** All core |
| `@storybook/addon-onboarding` | **Gone** |

If you see `addons: ['@storybook/addon-essentials']` in a `main.ts`, that config
is from Storybook 8 or earlier. **Delete the line.** Do not look for a
replacement — there is not one, because you already have the features.

### Moved to a different package

| Pre-9.0 | On 10.x |
|---|---|
| `@storybook/blocks` | **`@storybook/addon-docs/blocks`** |

### Moved under `/internal` — not public API

`@storybook/channels`, `@storybook/client-logger`, `@storybook/core-events`,
`@storybook/types` and `@storybook/components` are now
`storybook/internal/channels`, `storybook/internal/client-logger`, and so on. The
`/internal` is a warning: these are not covered by the public API contract, and
importing from them is how an addon breaks on a minor release.

### Still their own packages

`@storybook/react` · `@storybook/react-vite` · `@storybook/react-webpack5` ·
`@storybook/vue3` · `@storybook/nextjs` · `@storybook/addon-a11y` ·
`@storybook/addon-docs` · `@storybook/test-runner`

**The rule that makes this memorable:** renderers, framework integrations and
addons that are genuinely optional stayed separate. Everything that was really
"part of Storybook" moved into `storybook`.

## What this looks like in practice

```ts
// ❌ A snippet from 2024. Three of these four lines fail on 10.x.
import {expect, userEvent, within, fn} from '@storybook/test';
import {action} from '@storybook/addon-actions';
import {themes} from '@storybook/theming';
import type {Meta, StoryObj} from '@storybook/react';
```

```ts
// ✅ The same code on 10.x.
import {expect, userEvent, within, fn} from 'storybook/test';
import {action} from 'storybook/actions';
import {themes} from 'storybook/theming';
import type {Meta, StoryObj} from '@storybook/react';   // renderer — unchanged
```

```ts
// ❌ main.ts from Storybook 8 — two separate failures.
const config = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',    // deleted package
    '@storybook/addon-interactions',  // deleted package
  ],
  framework: {name: '@storybook/react-vite', options: {}},
};
module.exports = config;              // not ESM — will not load on 10.x
```

```ts
// ✅ On 10.x. The addons are gone because you already have them.
import type {StorybookConfig} from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: {name: '@storybook/react-vite', options: {}},
};

export default config;
```

## Upgrading rather than fixing by hand

```bash
npx storybook@latest upgrade
```

Automigrations handle the common cases, including most of the import rewrites and
the removal of deleted addons.

```bash
npx storybook doctor
```

Reports duplicate Storybook dependencies and incompatible addons — the two things
that produce the strangest post-upgrade symptoms. Run it when something is wrong
in a way that does not make sense; a duplicated `storybook` version in the lockfile
produces failures that look like nothing else on this page.

The canonical, exhaustive list of changes lives in the project's `MIGRATION.md` on
GitHub. The migration guide deliberately links to it rather than reproducing it.

## What is genuinely new, not just moved

Worth knowing so you do not mistake a new API for a mistake:

- **CSF factories** — `defineMeta`, a typed alternative to the plain-object story
  shape. React first; extended to Vue, Angular and Web Components in **10.3**.
  Covered in Phase 1.
- **Storybook MCP for React** (10.3) — Model Context Protocol support for
  AI-assisted workflows. Too new to build guidance on; named here so you recognise
  it.
- **10.4** — first-class TanStack React support, a sidebar that can scope to
  stories affected by a change, and a sharing flow for work in progress.

## Gotchas

**Symptom — `Cannot find module '@storybook/test'` after an upgrade.**
*Cause:* it moved into the core package in 9.0. *Fix:* `storybook/test`. Same
shape for `@storybook/addon-actions` → `storybook/actions` and
`@storybook/theming` → `storybook/theming`.

**Symptom — `Cannot find module '@storybook/addon-essentials'`.**
*Cause:* it was **deleted**, not moved — it was a meta-package for addons that are
now core. *Fix:* remove it from `addons` in `main.ts` and install nothing. The
same applies to `addon-interactions`, `addon-controls`, `addon-backgrounds`,
`addon-measure`, `addon-outline` and `addon-toolbars`. Searching for a replacement
is the trap; there is not one because you already have the feature.

**Symptom — Storybook will not start after upgrading from 8.x, with a config
loading error.** *Cause:* 10.x requires `main.ts` and presets to be valid ESM; a
`module.exports`, a `require()`, or a bare `__dirname` will not run. *Fix:*
convert to `import` / `export default`, and replace `__dirname` with
`path.dirname(fileURLToPath(import.meta.url))`.

**Symptom — Storybook fails on a modern-looking Node version.**
*Cause:* 10.x needs **20.19+ or 22.12+** specifically — a 20.x older than 20.19
fails even though it is Node 20. *Fix:* check the minor, not just the major.

**Symptom — a copied example half-works: the code runs but a panel is empty or a
type is wrong.** *Cause:* mixed-era imports — some rewritten, some not — or two
Storybook versions resolved in the lockfile. *Fix:* `npx storybook doctor` first;
it finds duplicate dependencies and incompatible addons, which is what produces
symptoms that match nothing else here.

**Symptom — an addon you wrote breaks on a Storybook minor release.**
*Cause:* it imports from `storybook/internal/*`, which is explicitly not public
API. *Fix:* use the public entry points; if the thing you need is only available
under `/internal`, treat that as a signal the approach is unsupported.

## Interview questions

**★ A Storybook example from 2024 fails with "Cannot find module
'@storybook/test'". What happened?**
Storybook 9 consolidated most `@storybook/*` packages into the single `storybook`
package. `@storybook/test` is now `storybook/test`, a subpath of a dependency you
already have. The same move applies to `addon-actions` → `storybook/actions`,
`theming`, `manager-api` and `preview-api`.

**★ What is the difference between a package that *moved* and one that was
*deleted* in Storybook 9?**
Moved packages have a new import path — the feature is unchanged. Deleted ones —
`addon-essentials`, `addon-interactions`, `addon-controls`, `backgrounds`,
`measure`, `outline`, `toolbars` — had their features absorbed into core, so
there is no replacement to install and the correct action is to delete the entry
from `main.ts`. Looking for a replacement for a deleted addon is the common
time-waster.

**★ What is the headline breaking change in Storybook 10?**
It is ESM-only. `.storybook/main.ts` and any presets must be valid ESM, and Node
20.19+ or 22.12+ is required. A `module.exports` or a bare `__dirname` in a config
that worked on 8.x will not load.

**How would you upgrade a Storybook 8 project?**
`npx storybook@latest upgrade`, which runs automigrations for the common import
rewrites and removes deleted addons; then `npx storybook doctor` to catch
duplicate Storybook dependencies and incompatible addons; then check `main.ts` is
valid ESM by hand, since that is the piece most likely to need judgement.

**Which packages did *not* get consolidated, and is there a pattern?**
The renderers (`@storybook/react`, `@storybook/vue3`), the framework integrations
(`@storybook/react-vite`, `@storybook/nextjs`) and the genuinely optional addons
(`addon-a11y`, `addon-docs`, `test-runner`). The pattern is that anything you
might legitimately not have stayed separate; anything that was really part of
Storybook moved in.

**Why is importing from `storybook/internal/*` a bad idea?**
It is explicitly outside the public API contract, so it can change on a minor
release. Anything of yours that depends on it — typically an addon — will break
without a major version bump to warn you.

---

**← Prev** [04 · Installing into an existing app](./04-installing-into-an-existing-app.md) ·
**Next →** the phase index — [Phase 0 overview](./README.md)
