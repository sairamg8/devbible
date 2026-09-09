---
title: "`@angular/build:application` is resolved in five steps, each with its own error message — so the string that fails tells you exactly which step failed, if you know what the five are"
sidebar_label: "03d · Resolving a builder string"
sidebar_position: 3.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular_devkit/architect/node/node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts)
> at tag `v22.1.7`. Documentation-validated; **no sandbox run** — every message below is transcribed
> from that source, not captured from a terminal.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A builder string is a package name, a colon and a key in that package's manifest, and turning it
into a function is ordinary Node module resolution with four failure points bolted on.** Nothing
about Angular's own builders is special: `@angular/build:application` goes through the same five
steps a builder you wrote yourself would. Each step throws a distinct sentence, which makes the
resolver one of the few parts of the CLI you can debug purely from the message. The stage *before*
this one — finding the project and the target at all — is
[03e](03e-the-error-ladder-of-an-invocation.md).

## The five steps

**1 · Split on the first colon.**

```ts
const [packageName, builderName] = builderStr.split(':', 2);
if (!builderName) {
  throw new Error('No builder name specified.');
}
```

**2 · Resolve the package's `package.json`, anchored at a base path.**

```ts
// Resolve and load the builders manifest from the package's `builders` field, if present
const packageJsonPath = localRequire.resolve(packageName + '/package.json', { paths: [basePath] });
```

🔴 Note `paths: [basePath]`. Resolution is anchored at a base path the host supplies, not at the
file that mentions the builder — so a package installed somewhere unusual in a nested
`node_modules` is not necessarily reachable.

**3 · Read the package's `builders` field.**

```ts
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { builders?: string };
const buildersManifestRawPath = packageJson['builders'];
if (!buildersManifestRawPath) {
  throw new Error(`Package ${JSON.stringify(packageName)} has no builders defined.`);
}
```

A package is a builder package because its `package.json` has a `"builders"` key naming a manifest
file. That is the entire contract.

**4 · Look the name up in that manifest.**

```ts
// Attempt to locate an entry for the specified builder by name
const builder = buildersManifest.builders?.[builderName];
if (!builder) {
  throw new Error(`Cannot find builder ${JSON.stringify(builderStr)}.`);
}
```

**5 · If the entry is a bare string, recurse — it is an alias.**

```ts
// Resolve alias reference if entry is a string
if (typeof builder === 'string') {
  return this.resolveBuilder(
    builder,
    path.dirname(packageJsonPath),
    (seenBuilders ?? new Set()).add(builderStr),
  );
}
```

with a cycle guard:

```ts
if (seenBuilders?.has(builderStr)) {
  throw new Error('Circular builder alias references detected: ' + [...seenBuilders, builderStr]);
}
```

This is how one builder string can be a synonym for another — an entry whose value is
`"@angular/build:application"` rather than an object simply re-enters the resolver with that string.

## What the resolver returns

```ts
return Promise.resolve({
  name: builderStr,
  builderName,
  description: builder['description'],
  optionSchema: JSON.parse(schemaText) as json.schema.JsonSchema,
  import: path.join(buildersManifestDirectory, implementationPath),
});
```

Two of those fields matter to a reader of `angular.json`:

- **`optionSchema`** is where option validation actually comes from. The workspace schema types
  `options` for editing; this is what the CLI validates against at run time, loaded from the path the
  builder's manifest names.
- 🔴 **`description` is the string in the package's `builders.json`**, and it is what appears in help
  output — including the `[EXPERIMENTAL]` prefix carried by `@angular/build:unit-test`. That prefix
  is a string in a manifest, not a policy statement; **the documentation does not state a stability
  level for the `unit-test` builder**, while `ng new` writes it as the default `test` target.

Three more errors guard the paths inside the manifest, verbatim:

```text
Package "${packageName}" has an invalid builders manifest path: "${buildersManifestRawPath}"
Package "${packageName}" has an invalid builder implementation path: "${builderName}" --> "${builder.implementation}"
Package "${packageName}" has an invalid builder schema path: "${builderName}" --> "${builder.schema}"
```

These fire when a manifest points outside its own package — a packaging bug in a builder, not
something a workspace file can cause.

## Gotchas

**★ Symptom: `Cannot find builder "@angular/build:aplication".`** Cause: the package resolved and its
manifest loaded — the failure is the *key lookup*, so the package name was right and the builder name
was not. Fix: correct the name after the colon; nothing about installation is at fault here:

```json
{
  "targets": {
    "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } }
  }
}
```

**★ Symptom: `Cannot find builder "@angular-devkit/build-angular:application".` in a fresh v22
workspace.** Cause: the same key-lookup failure, but for the opposite reason — that package is not
installed by `ng new` in v22, so the resolver never gets a manifest for it. Fix: use the string for
the package you have:

```json
{
  "targets": {
    "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } }
  }
}
```

**★ Symptom: `No builder name specified.`** Cause: the builder string has no colon — usually a
package name pasted alone, or a colon lost to a find-and-replace. Fix: a builder string is always
`<package>:<name>`:

```json
{
  "targets": {
    "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } }
  }
}
```

**★ Symptom: `Package "@angular/build" has no builders defined.`** Cause: the package's own
`package.json` has no `"builders"` key — a corrupted install, a partially-restored cache, or a
hand-edited `node_modules`. It is never caused by `angular.json`. Fix: reinstall rather than editing
the workspace file:

```bash
rm -rf node_modules
npm ci
```

**Symptom: `Circular builder alias references detected: …`** Cause: a `builders.json` entry whose
value is a string pointing, directly or through a chain, back at itself. This only happens in a
custom or vendored builder package. Fix: an alias must terminate in an object entry with an
`implementation` and a `schema`:

```json
{
  "builders": {
    "smoke": { "implementation": "./dist/smoke.js", "schema": "./dist/schema.json", "description": "Runs the smoke suite." },
    "smoke-alias": "@acme/builders:smoke"
  }
}
```

**Symptom: a builder resolves for one developer and not another with identical `angular.json`.**
Cause: resolution is anchored at a base path with `paths: [basePath]`, so it depends on where the
package is installed rather than on the workspace file. Hoisting differences between package
managers, a partially installed workspace, or a package installed in a nested `node_modules` all
produce this. Fix: make the dependency explicit in the workspace's own `package.json` so every
install places it in the same location:

```json
{
  "devDependencies": {
    "@angular/build": "22.1.7"
  }
}
```

**Symptom: `[EXPERIMENTAL]` appears next to a builder in help output and there is no matching notice
in the documentation.** Cause: the label is the `description` string from the package's
`builders.json`, surfaced verbatim by the resolver. `@angular/build:unit-test` carries it while
`ng new` writes that builder as the default `test` target, and **the documentation does not state a
stability level for it**. Fix: nothing to change in `angular.json`; note both facts and decide with
them rather than around them:

```json
{
  "targets": {
    "test": { "builder": "@angular/build:unit-test", "options": {} }
  }
}
```

## Interview questions

**★ Walk through what happens between `ng build` and a bundler starting.**
The CLI resolves the workspace file, finds the project, and looks up the target named `build`, which
throws `Project "<name>" does not exist.` or `Project target does not exist.` if either lookup fails.
It reads that target's `builder` string, splits it on the first colon into a package name and a
builder name, and resolves `<package>/package.json` from a supplied base path. It reads the
`"builders"` field of that `package.json` to find a manifest, looks the builder name up as a key in
the manifest, and — if the entry is a bare string — re-enters the whole process with that string,
guarding against cycles. When it finds an object entry, it loads the implementation path and the
option schema and returns a descriptor. Only then does anything build.

**★ What is a builder alias, and why does the resolver recurse?**
A manifest entry whose value is a string rather than an object. When the resolver finds one, it calls
itself with that string, which lets a package expose a builder name that is really another package's
builder — the mechanism behind `@angular-devkit/build-angular:application` resolving to the
`@angular/build` implementation. Because aliases can chain, the resolver carries a set of strings it
has already seen and throws `Circular builder alias references detected:` followed by the chain when
one repeats. The chain in that message is the diagnostic: it shows you the exact loop.

**Where does the text next to a builder in help output come from?**
The `description` field of the entry in the package's `builders.json`, which the resolver copies
straight into the descriptor it returns. That means it is authored by whoever published the package,
with no processing — which is why `@angular/build:unit-test` shows an `[EXPERIMENTAL]` prefix that is
simply part of a string. It is worth treating as a signal from the maintainers rather than as a
documented status: the documentation does not state a stability level for that builder.

**Why can a builder resolve on one machine and not another with the same `angular.json`?**
Because the workspace file names a string and the resolution of that string is a filesystem question.
The resolver calls `require.resolve` with an explicit `paths` array anchored at a base path, so what
matters is where the package physically landed — which package manager installed it, whether it was
hoisted, whether a partial install left it out. This is why "it works locally" and "it fails in CI"
so often reduce to the lockfile rather than to anything in `angular.json`, and why declaring the
builder package as a direct dev dependency is worth doing even when something else already pulls it
in.

**A target has a builder from a package you wrote. What does that package have to contain?**
A `package.json` with a `"builders"` field naming a manifest file; a manifest whose keys are builder
names and whose values are objects with `implementation` and `schema` paths (and optionally a
`description`); an implementation module at that path; and an option schema at that path. The
documented layout adds the source-level detail — `src/my-builder.ts`, `src/schema.json`,
`builders.json`, `package.json`, `tsconfig.json`. Nothing about Angular's own builders differs from
this; they are found by exactly the same five steps.

{/* FOOTER */}
