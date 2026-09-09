---
title: "The `migrations` field is one string, validated four ways and resolved two ways — and the fallback added for private registries exists because some registries delete the field before you ever see it"
sidebar_label: "04b · Finding the migrations"
sidebar_position: 4.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts)
> — the validation chain, the resolution fallback and the doc comment on
> `resolveFallbackMigrations` are quoted verbatim from that file.
> Documentation-validated; **no sandbox run**; every error string below is quoted from the line that
> emits it, not reconstructed.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`packageGroup` decides which packages move. `migrations` decides whether anything gets rewritten
at all** — it is the single string that points `ng update` at the collection of schematics it will
run against your source. A package with a `packageGroup` and no `migrations` will happily move eight
version numbers and change not one line of your code. Everything in this page is about how that one
string is validated, how it is turned into a file on disk, and the one case where the field is
present at the publisher and absent by the time the CLI reads it.

## The validation chain, in the order it runs

`--migrate-only` reads the field straight off the manifest and rejects it four ways before doing
anything. This is the whole chain, verbatim:

```ts
const updateMetadata = packageNode['ng-update'];
let migrations = updateMetadata?.migrations;
if (migrations === undefined) {
  logger.error('Package does not provide migrations.');
  return 1;
} else if (typeof migrations !== 'string') {
  logger.error('Package contains a malformed migrations field.');
  return 1;
} else if (path.posix.isAbsolute(migrations) || path.win32.isAbsolute(migrations)) {
  logger.error(
    'Package contains an invalid migrations field. Absolute paths are not permitted.',
  );
  return 1;
}

// Normalize slashes
migrations = migrations.replace(/\\/g, '/');

if (migrations.startsWith('../')) {
  logger.error(
    'Package contains an invalid migrations field. Paths outside the package root are not permitted.',
  );
  return 1;
}
```

The four exact strings, which is what you will actually be searching for:

| Message | What the manifest did |
|---|---|
| `Package does not provide migrations.` | No `ng-update.migrations` key at all |
| `Package contains a malformed migrations field.` | Present but not a string — an array or object |
| `Package contains an invalid migrations field. Absolute paths are not permitted.` | `/opt/…` or `C:\…` |
| `Package contains an invalid migrations field. Paths outside the package root are not permitted.` | Starts with `../` after slash normalisation |

🔴 **The two path checks are a sandbox, and the order matters.** Backslashes are normalised to
forward slashes *between* the absolute-path check and the `../` check, which is why a Windows-style
`..\..\evil.json` is caught: it becomes `../../evil.json` before the last test runs. Both
`path.posix.isAbsolute` and `path.win32.isAbsolute` are consulted, so a manifest published from
Windows cannot smuggle an absolute path past a CLI running on Linux.

⚠️ **All four are `logger.error` plus `return 1`, not exceptions.** The command exits non-zero with
one line and no stack trace — which in CI reads as a generic failure unless someone scrolls to the
message.

## Two legal shapes, both shipping in v22

The field is validated as a *relative* path, but resolution accepts two quite different things, and
Angular itself publishes one of each:

```json
"migrations": "./schematics/migrations.json"
```

A **package-relative path**, which is what `@angular/core` publishes. It is resolved against the
package's own directory in `node_modules`.

```json
"migrations": "@schematics/angular/migrations/migration-collection.json"
```

A **bare module specifier**, which is what `@angular/cli` publishes. It names a file inside a
*different* package — the collection lives in `@schematics/angular`, not in the CLI — and is
resolved through Node's resolver.

Neither is absolute and neither starts with `../`, so both survive the validation above. The second
one is the interesting case, because it means a package's migrations do not have to live in that
package.

## Resolution: the local path first, `require.resolve` second

```ts
const localMigrations = path.join(packagePath, migrations);
if (existsSync(localMigrations)) {
  migrations = localMigrations;
} else {
  // Try to resolve from package location.
  // This avoids issues with package hoisting.
  try {
    const packageRequire = createRequire(packagePath + '/');
    migrations = packageRequire.resolve(migrations, { paths: this.resolvePaths });
  } catch (e) { … }
}
```

The `catch` body is elided above because it only builds the second of the two messages listed at
the end of this section; everything else is the source verbatim.

Read the comment: **`This avoids issues with package hoisting.`** The `createRequire(packagePath +
'/')` call builds a resolver rooted at *the package that declared the migrations*, not at the
workspace root. That distinction is the entire reason migrations work under pnpm and under npm
workspaces, where a dependency's own dependencies may sit in a nested `node_modules` that the
workspace root cannot see.

The trailing `'/'` is not cosmetic either — `createRequire` treats its argument as a file path
unless it ends in a separator, so without it the resolver would be rooted one directory too high.

Two failure strings come out of this step:

- `Migrations for package were not found.`
- `Unable to resolve migrations for package.  [<message>]`

The double space in the second is in the source, quoted here as-is so a search for it matches.

## The private-registry fallback, and the bug it fixes

A v22-era addition, and one worth knowing before you diagnose it the hard way. `ng update` will now
re-read migration metadata **off disk, after installing**, because some registries do not serve it.
The doc comment on the function, verbatim:

> *"Resolves migrations from installed package manifests on disk when they were omitted from the
> initial update plan.*
>
> *This fallback is necessary because private package registries (such as GitHub Packages)
> frequently strip custom non-npm metadata properties (like `ng-update`) from their remote registry
> API responses. By inspecting `node_modules/<package>/package.json` after installation, we ensure
> that any migration collections defined by the package are discovered and queued."*

```ts
export async function resolveFallbackMigrations(
  workspaceRoot: string,
  plan: UpdatePlan,
): Promise<{ package: string; collection: string; from: string; to: string }[]> {
```

**The symptom this explains is a nasty one:** on a private registry, `ng update` bumped every
version and ran zero migrations, reporting success. Nothing was wrong with the packages — the
registry's API response had dropped the `ng-update` key on the way out, so the CLI built an update
plan in which no package had any migrations to run. The tarball on disk had the key the whole time;
nobody had looked there.

🔴 **This is the failure mode where the command's own output is actively misleading**, because an
update with no migrations looks exactly like an update whose migrations were all no-ops. If you are
on a mirror or a proxying registry and on a CLI older than v22, assume nothing ran and check:

```bash
node -p "JSON.stringify(require('@angular/core/package.json')['ng-update'], null, 2)"
npm view @angular/core@22.1.5 ng-update --registry=https://registry.npmjs.org/
```

If the first prints an `ng-update` block and the second (against your own registry, with the flag
removed) prints nothing, the registry is stripping the field.

## Gotchas

**★ Symptom: `Package does not provide migrations.` from a `--migrate-only` run.** Cause: the
package's published manifest has no `ng-update.migrations` key — it may still have a `packageGroup`,
which is why the ordinary update appeared to work. Fix: confirm against the registry before blaming
your command, and if it is genuinely absent there is nothing to replay:

```bash
npm view @angular/core@22.1.5 ng-update.migrations
```

**★ Symptom: on a private registry, versions moved and no migration ran — and the command reported
success.** Cause: the registry stripped the non-npm `ng-update` property out of its API response, so
the update plan contained no migrations. Fix: on CLI v22 the on-disk fallback handles it
automatically; on anything older, replay the range by hand once the install has landed:

```bash
ng update @angular/core --migrate-only --from=21.2.23
```

**★ Symptom: a library's migrations never run in a pnpm workspace, though the same library works in
a plain npm project.** Cause: hoisting — the collection is resolvable from the library's own
directory but not from the workspace root. Fix: this is precisely what the
`createRequire(packagePath + '/')` fallback exists for, so first make sure you are on a CLI new
enough to have it; if the collection still will not resolve, the publisher's `migrations` path is
pointing at a package it does not actually depend on.

**★ Symptom: `Package contains a malformed migrations field.`** Cause: `migrations` was published as
something other than a string — an array of collections is the common mistake, because a package
with two migration collections looks like it should be able to say so. Fix: it cannot; one string,
one collection. Merge the collections, or point at a collection that includes the others:

```json
"ng-update": { "migrations": "./schematics/migrations.json" }
```

**★ Symptom: `Package contains an invalid migrations field. Paths outside the package root are not
permitted.`** Cause: a monorepo published a package whose `migrations` pointed up into a shared
`tools/` directory — correct on the developer's disk, meaningless in an npm tarball. Fix: the path
must resolve inside the published package, or be a bare specifier naming a package that is a real
dependency. Check what actually shipped, not what is in the source tree:

```bash
npm pack @acme/ui && tar -tf acme-ui-*.tgz | grep migrations
```

**★ Symptom: `Unable to resolve migrations for package.  [Cannot find module …]` naming a package
you do not have.** Cause: the manifest used a bare module specifier — like the CLI's own
`@schematics/angular/migrations/migration-collection.json` — and that package is not installed. Fix:
it must be a dependency of the package that declares it; if you are the publisher, move it out of
`devDependencies`.

**★ Symptom: you fixed the `migrations` path in your library, republished the same version, and the
CLI still cannot find it.** Cause: nothing in this chain re-reads the registry once the tarball is
in the local cache, and a republished identical version is a cache hit. Fix: publish a new patch
version. Registries do not guarantee mutation of an existing one, and neither the plan nor the
on-disk fallback will notice.

**★ Symptom: a Windows-authored path with backslashes fails validation on CI but passes locally.**
Cause: the normalisation runs *after* the absolute-path check, so `C:\tools\migrations.json` is
rejected as absolute on every platform, while `..\shared\migrations.json` is only caught by the
later `../` test. Fix: publish POSIX-style relative paths; there is no case where a backslash in
this field is correct.

## Interview questions

**★ Where do a package's migrations actually live, and does the CLI require them to be in that
package?**
The `ng-update.migrations` string points at a migration collection, and no, it does not have to be
in the same package. Two shapes are legal and Angular publishes one of each: `@angular/core` uses a
package-relative path (`./schematics/migrations.json`) resolved against its own directory, while
`@angular/cli` uses a bare module specifier
(`@schematics/angular/migrations/migration-collection.json`) that resolves into a different package
entirely. Resolution tries the local path first and falls back to `require.resolve` rooted at the
declaring package.

**★ Your company runs a private registry. `ng update` bumps versions but no migrations run. Why?**
Because private registries such as GitHub Packages frequently strip non-npm metadata properties from
their registry API responses, and `ng-update` is one of them. The CLI builds its update plan from
that response, so it sees packages with no migrations and queues none — and reports success, because
nothing failed. The v22 CLI works around it by re-reading
`node_modules/<package>/package.json` after installation and queueing anything it finds there. On an
older CLI the workaround is manual: let the install happen, then replay the range with
`--migrate-only --from`.

**★ Why does the CLI reject absolute paths and `../` in the `migrations` field?**
Because the field is publisher-controlled data that the CLI turns into a filesystem read, so it is
an untrusted path. Constraining it to the package root means a published manifest cannot make the
CLI read an arbitrary file on the machine running the update. The checks are ordered to survive
platform differences: both the POSIX and Windows absolute-path tests run, then backslashes are
normalised, then the `../` test runs against the normalised string.

**Why is `createRequire(packagePath + '/')` used instead of resolving from the workspace root?**
Because package managers do not agree on where a dependency's dependencies live. Under npm's
hoisting they usually land at the workspace root; under pnpm they live in a nested store that the
root cannot see. Rooting the resolver at the package that declared the migrations asks the question
from the only place guaranteed to have the right view of that package's own dependencies. The
trailing slash matters — `createRequire` treats a path without one as a file, which would root the
resolver a directory too high.

**A package publishes `packageGroup` but no `migrations`. What happens on `ng update`?**
Every package in the group moves to the new version and no code is rewritten. That is a legitimate
configuration — plenty of libraries have breaking changes they document rather than automate — but
it means the update is exactly the `npm install` that
[01](01-why-npm-install-is-not-an-upgrade.md) warns about, with the version resolution done for you.
The distinction matters when you are auditing an upgrade: a clean working tree after `ng update` is
evidence of nothing until you know whether the package ships migrations at all.

{/* FOOTER */}
