---
title: "Two Angular 22.1.5 applications can have opposite template strictness and the only difference is how each one reached v22 — a required migration writes `strictTemplates: false` into the tsconfigs your build targets name, and pointedly not into the workspace root"
sidebar_label: "05c · What the upgrade wrote"
sidebar_position: 5.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/core/schematics/migrations/strict-templates-default/index.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/migrations/strict-templates-default/index.ts),
> [`packages/core/schematics/utils/project_tsconfig_paths.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/utils/project_tsconfig_paths.ts) —
> both read through the GitHub contents API at that tag. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**🔴 The single most useful fact a v22 Angular developer can carry: two applications on Angular
22.1.5 can have opposite template strictness, and the difference is only how each one got there.**
A project created with `ng new` on v22 has no `strictTemplates` key and is strict by default. A
project that reached v22 through `ng update` had `"strictTemplates": false` written into it by a
required migration, so that upgrade day did not become a wall of template errors. Nothing on
angular.dev states this asymmetry, and it completely explains *"why does the same component
type-check in my new project and not in the old one."*

## The migration, in full

From
[`strict-templates-default/index.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/migrations/strict-templates-default/index.ts)
at `v22.1.5`, verbatim, with its doc comment:

```ts
/**
 * Migration that adds `strictTemplates: false` to `tsconfig.json` files.
 */
export function migrate(): Rule {
  return async (tree) => {
    const {buildPaths, testPaths} = await getProjectTsConfigPaths(tree, {
      angularBuildersOnly: true,
    });
    const allPaths = [...new Set([...buildPaths, ...testPaths])];

    for (const tsconfigPath of allPaths) {
      const json = new JSONFile(tree, tsconfigPath);
      const compilerOptions = json.get(['compilerOptions']);

      if (
        !compilerOptions ||
        typeof compilerOptions !== 'object' ||
        Object.keys(compilerOptions).length === 0
      ) {
        continue;
      }

      const angularOptions = getResolvedAngularCompilerOptions(tree, tsconfigPath);

      if (angularOptions['strictTemplates'] !== undefined) {
        continue;
      }

      if (json.get(['angularCompilerOptions', 'strictTemplates']) === undefined) {
        json.modify(['angularCompilerOptions', 'strictTemplates'], false);
      }
    }
  };
}
```

The doc comment is not ambiguous: *"Migration that adds `strictTemplates: false` to `tsconfig.json`
files."* This is **preserve-behaviour, not adopt-the-default**. The whole point of writing `false`
is that an upgraded codebase keeps compiling.

The `ng update` machinery that schedules it — how it is discovered, why it is required rather than
optional, and what else runs alongside it — is
[04 · 07 The v22 migration inventory](../04-ng-update-not-npm-install/07-the-v22-migration-inventory.md).
This page is only about what lands in your compiler configuration.

## Which files it touches — and which it deliberately does not

`getProjectTsConfigPaths` supplies the file list, and its first comment settles a question the
migration's own doc comment leaves open. From
[`project_tsconfig_paths.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/utils/project_tsconfig_paths.ts)
at `v22.1.5`, verbatim:

```ts
  // Start with some tsconfig paths that are generally used within CLI projects. Note
  // that we are not interested in IDE-specific tsconfig files (e.g. /tsconfig.json)
  const buildPaths = new Set<string>();
  const testPaths = new Set<string>();
```

🔴 **The workspace root `tsconfig.json` is not a candidate.** The list is built by walking
`angular.json`'s projects and targets and collecting each target's `tsConfig` option:

```ts
      for (const [, options] of allTargetOptions(target)) {
        const tsConfig = options['tsConfig'];
        // Filter out tsconfig files that don't exist in the CLI project.
        if (typeof tsConfig !== 'string' || !tree.exists(tsConfig)) {
          continue;
        }

        if (name === 'test' || name.includes('test')) {
          testPaths.add(normalize(tsConfig));
        } else {
          buildPaths.add(normalize(tsConfig));
        }
      }
```

Four consequences, all from that block:

1. **In a default workspace the migration writes into `tsconfig.app.json` and
   `tsconfig.spec.json`** — the two files named by the `build` and `test` targets — and not into
   the root. So an upgraded project usually ends up with the key in *two* files.
2. **A target counts as a test target by name**: `name === 'test' || name.includes('test')`.
   Anything else carrying a `tsConfig` — `server`, `lint`, a custom target — lands in `buildPaths`.
3. **Every configuration is inspected, not just the default options.** `allTargetOptions` yields
   `target.options` and then each entry of `target.configurations`, so a `tsConfig` overridden only
   under `production` is still collected.
4. **Only Angular builders count**, because the migration passes `angularBuildersOnly: true`. The
   recognised prefixes are, verbatim:

```ts
const angularBuilderPrefixes = [
  '@angular-devkit/build-angular:',
  '@angular/build:',
  '@nx/angular:',
  '@angular-builders/',
  'ngx-build-plus:',
];
```

with the reason in the function's own doc comment:

> *"This avoids picking up tsconfig files of non-Angular projects in a mixed workspace (e.g. an Nx
> monorepo), which should not be touched by Angular migrations."*

## Gotchas

**★ Symptom: the same component compiles in a new project and fails in an old one, on the same
Angular version.** Cause: the migration wrote `strictTemplates: false` into the upgraded project's
tsconfigs. Fix — delete the line to adopt the default, then work through the errors:

```jsonc
{
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true
  }
}
```

**★ Symptom: you deleted `strictTemplates: false` from `tsconfig.app.json` and templates are still
unchecked.** Cause: the migration visits **both** build and test tsconfigs, so the key is very
likely in a second file too. Fix: search every tsconfig, not just the one the build names:

```bash
grep -rn strictTemplates -- '**/tsconfig*.json'
```

**★ Symptom: a `strictTemplates` you never wrote appears in `tsconfig.app.json` but not in the
workspace root, which is where you expected it.** Cause: the file list comes from `angular.json`
targets, and the root is explicitly excluded — *"we are not interested in IDE-specific tsconfig
files (e.g. /tsconfig.json)"*. Fix: nothing is wrong; look where the targets point. If you want one
shared answer, move it to the root yourself and delete the leaves:

```jsonc
// tsconfig.json — one decision for build and test
{
  "angularCompilerOptions": {
    "strictTemplates": false
  }
}
```

**Symptom: a project in your monorepo was skipped entirely.** Cause: `angularBuildersOnly: true`
restricts the walk to targets whose builder starts with one of five recognised prefixes; a project
using a different builder is never visited. Fix: set the value explicitly in that project rather
than relying on a migration having been there:

```jsonc
{
  "angularCompilerOptions": {
    "strictTemplates": false
  }
}
```

**Symptom: the migration skipped a tsconfig that clearly needed it.** Cause: one of three guards —
the file's `compilerOptions` is absent, not an object, or empty; the resolved chain already defines
`strictTemplates`; or the file's own `angularCompilerOptions.strictTemplates` is already set. Fix:
check which, in that order — each is a different statement about whether the project already had an
opinion.

**Symptom: a target named `integration-test` had its tsconfig classified as a test config.** Cause:
`name === 'test' || name.includes('test')` is a substring match on the target name. Fix: harmless
for this migration, because both lists are merged into one `Set` before anything is written — but
worth knowing when reading other schematics that treat `buildPaths` and `testPaths` differently.

**Symptom: a `tsConfig` that only appears under a `production` configuration was modified.** Cause:
`allTargetOptions` yields `target.options` *and* every named configuration's options. Fix: expected
behaviour; review the diff for configuration-specific tsconfigs as well as the default ones.

**Symptom: you moved the opt-out to the workspace root for one shared answer, and worry a later
migration will write it into the leaves again.** Cause: it depends on whether that migration
resolves inheritance. The v22 `strict-templates-default` migration does, so a root value is
respected — but only when `extends` is a relative path it can follow. Fix: keep `extends` relative
during upgrades ([04d](04d-the-second-implementation.md)).

## Interview questions

**★ Two teams are both on Angular 22.1.5. One has template type errors, the other does not, with the
same component. What is the most likely cause?**
One project was created with `ng new` on v22 — no `strictTemplates` key, so the compiler's default
of `true` applies — and the other was migrated with `ng update`, which ran the required
`strict-templates-default` migration and wrote `"strictTemplates": false` into its project tsconfigs
to preserve the pre-v22 behaviour. Both projects look like they are "using the defaults"; only one
of them is.

**★ Which files does the migration write into?**
Every tsconfig named by a `tsConfig` option on a target of an Angular builder — collected from
`angular.json` across `target.options` and every named configuration, de-duplicated, and filtered to
files that exist. In a default workspace that is `tsconfig.app.json` and `tsconfig.spec.json`. The
workspace root `tsconfig.json` is explicitly excluded, with the source comment *"we are not
interested in IDE-specific tsconfig files (e.g. /tsconfig.json)"*. So an upgraded project usually
ends up with the key in two files, and deleting one is not enough.

**★ Why does the migration check the resolved value and then the file's own key?**
Two different questions. The resolved-value guard asks whether the project already has an opinion
anywhere in its inheritance chain, in which case nothing should be written. The own-key guard asks
whether this particular file already carries the key, which protects against writing it twice when a
build target and a test target resolve to the same file. A third guard, on `compilerOptions`, skips
files that carry no TypeScript configuration of their own. Together they mean the migration only
writes into a file that was genuinely relying on the framework default.

**How does a migration decide a project is "an Angular project" at all?**
By the builder string on the target, matched against five prefixes —
`@angular-devkit/build-angular:`, `@angular/build:`, `@nx/angular:`, `@angular-builders/` and
`ngx-build-plus:`. The doc comment gives the reason: *"This avoids picking up tsconfig files of
non-Angular projects in a mixed workspace (e.g. an Nx monorepo), which should not be touched by
Angular migrations."* It is a useful thing to know in both directions: a custom builder means
Angular's migrations will pass your project by, and you inherit the job they would have done.

**A colleague says the migration "edits your tsconfig.json". Why is that phrasing worth correcting?**
Because it sends people to the wrong file. The migration's own doc comment uses the same loose
phrasing — *"adds `strictTemplates: false` to `tsconfig.json` files"* — but the implementation
excludes the workspace root by name and writes only into the per-target configs. Someone who greps
the root, finds nothing, and concludes the migration did not run will then be surprised by the
build.

## Where this goes next

What that line *means* once it is in your repository — why it is a dated TODO rather than a
preference, how to remove it without reinstating it wholesale, and the second v22 migration that
does exactly the same thing for two extended diagnostics — is
[05d · The opt-out is a dated TODO](05d-the-opt-out-is-a-dated-todo.md).

---

← Prev: [What the CLI writes](05b-what-the-cli-writes-and-does-not-write.md) · Index: [Topic index](README.md) · Next → [The opt-out is a dated TODO](05d-the-opt-out-is-a-dated-todo.md)
