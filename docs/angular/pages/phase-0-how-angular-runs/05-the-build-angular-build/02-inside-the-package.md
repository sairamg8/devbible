---
title: "Two description strings and an `engines` range tell you what `@angular/build` is, which release line it lives on, and why a patch bump can stop installing on the Node version that worked last month"
sidebar_label: "02 · Inside the package"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against the **published manifest** of `@angular/build` **22.1.7**
> ([registry.npmjs.org/@angular/build/22.1.7](https://registry.npmjs.org/@angular/build/22.1.7))
> and of `@angular-devkit/build-angular` **22.1.7**
> ([registry.npmjs.org/@angular-devkit/build-angular/22.1.7](https://registry.npmjs.org/@angular-devkit/build-angular/22.1.7)),
> plus the `22.0.0` breaking-changes section of
> [CHANGELOG.md](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md) at tag
> `v22.1.7`. Documentation-validated; **no sandbox run** — every version string below is copied
> from a manifest, not from an install.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The whole "is the Angular build webpack?" argument is settled by two `description` fields, and
the rest of the manifest tells you the two things that actually break installs.** `@angular/build`
calls itself *"Official build system for Angular"*; the package it replaced calls itself
*"Angular Webpack Build Facade"*, at the same version, from the same release. Around those two
strings sit a version number on a release line that is **not** the framework's, and an
`engines.node` range that moved *inside* the 22.x line — the two facts most likely to make an
install fail for reasons that have nothing to do with your code.

## Two description strings, and the story is over

```json
{ "name": "@angular/build",                "description": "Official build system for Angular" }
```
```json
{ "name": "@angular-devkit/build-angular", "description": "Angular Webpack Build Facade" }
```

Both read from the published manifests at version **22.1.7** — the same version, the same release,
the same day. One package calls itself *the* build system; the other calls itself a **facade** over
webpack. That word choice is not marketing. A facade is a thin adapter in front of something else,
and [02d · The peer contract](02d-the-peer-contract.md) shows what the something else costs you at
install time.

## The manifest, minus the parts that argue nothing

```json
{
  "name": "@angular/build",
  "version": "22.1.7",
  "description": "Official build system for Angular",
  "engines": {
    "node": "^22.22.3 || ^24.15.0 || >=26.0.0",
    "npm": "^6.11.0 || ^7.5.6 || >=8.0.0",
    "yarn": ">= 1.13.0"
  },
  "builders": "builders.json"
}
```

Four fields worth naming:

- **`version`** is `22.1.7`, and `@angular/core`'s `latest` is `22.1.5`. 🔴 **These are two
  independent release lines.** The CLI, `@angular/build`, `@angular/ssr` and
  `@angular-devkit/build-angular` all move together at `22.1.7`; the framework packages move
  together at `22.1.5`. A `package.json` that writes `"@angular/core": "22.1.7"` is asking for a
  version that is not on that line.
- **`engines.node`** is the floor, and it moved *inside* the minor line — the next section.
- **`engines.npm`** accepts `^6.11.0`, which predates this release by years. Read it as permissive,
  not as a statement about which npm versions were tested.
- **`builders`** is the field that makes this a *builder package* at all: it names the manifest
  that maps a short builder name to an implementation and an option schema. What that file declares
  is [02c · The six builders it declares](02c-the-six-builders-it-declares.md).

The one field this page does not summarise is `dependencies`, because twenty-six lines of it is the
entire argument of the topic and it gets its own page:
[02b · Twenty-six dependencies](02b-twenty-six-dependencies.md).

## `engines.node` — and the patch release that raised the floor

The major set the floor, verbatim from the `22.0.0` breaking changes:

> *"Node.js v20 is no longer supported. The minimum supported Node.js versions are now v22.22.0
> and v24.13.1."*
> — [CHANGELOG.md](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md), `22.0.0 (2026-06-03)`

The manifest at 22.1.7 says something slightly different: `^22.22.3 || ^24.15.0 || >=26.0.0`. Both
numbers are correct, and they are not the same claim. **v22.0.0 dropped Node 20 and set the floor
at 22.22.0 / 24.13.1; by patch 22.1.7 the floor had moved up to 22.22.3 / 24.15.0.** Quote the
changelog for *why* the floor exists and the `engines` field for *what it is today* — a Node
version that satisfied the major can stop satisfying a patch, without you deliberately changing a
single Angular constraint.

Read the range precisely. `^22.22.3` means `>=22.22.3 <23.0.0`; `^24.15.0` means
`>=24.15.0 <25.0.0`; `>=26.0.0` is open-ended. Nothing accepts Node 23 or Node 25 — those are
Node's odd-numbered, non-LTS lines and the range simply does not include them.

⚠️ **`engines` is a declaration, not a guard rail.** A mismatch surfaces as an `EBADENGINE`
complaint from npm; whether that is a warning you scroll past or a hard failure depends on your
`engine-strict` setting, which is why CI is the right place to make it decisive.

## Where the rest of this chunk went

The manifest has three more parts, and each is a page rather than a paragraph:

| Part | Page | Why it is separate |
|---|---|---|
| `dependencies` | [02b · Twenty-six dependencies](02b-twenty-six-dependencies.md) | The list *is* the argument — four bundler tools, and no webpack |
| `builders.json` | [02c · The six builders it declares](02c-the-six-builders-it-declares.md) | The package's entire public surface, and where `browser` is not |
| `peerDependencies` | [02d · The peer contract](02d-the-peer-contract.md) | Fourteen of eighteen peers are optional, and that has teeth |
| what a new app installs | [02e · What `ng new` installs](02e-what-ng-new-installs.md) | Four dev dependencies, and webpack in none of them |

## Gotchas

**★ Symptom: `npm install` complains `EBADENGINE` on a machine that installed the same project
fine last month, and nothing in your `package.json` changed majors.** Cause: the Node floor moved
*within* the 22.x line. v22.0.0 required Node 22.22.0 / 24.13.1; the 22.1.7 manifest requires
`^22.22.3 || ^24.15.0 || >=26.0.0`. A `.nvmrc` written from the release-notes numbers is already
below the floor. Fix: pin the runtime beside the project from the **manifest**, not the changelog,
and make CI refuse to proceed rather than warn:

```
# .nvmrc
24.15.0
```
```
# .npmrc — turn an engines mismatch into a hard failure instead of a warning
engine-strict=true
```

**★ Symptom: you upgrade CI to a newer Node to get ahead of the curve and every install starts
warning.** Cause: `^22.22.3 || ^24.15.0 || >=26.0.0` covers 22.x, 24.x and 26-and-up. Node 23 and
Node 25 are odd-numbered lines and are not in the range at all. Fix: stay on an even line:

```yaml
# .github/workflows/build.yml — the Node the manifest actually accepts
- uses: actions/setup-node@v4
  with:
    node-version: '24.15.0'
```

**★ Symptom: you write `"@angular/core": "^22.1.7"` to "keep everything on one version" and the
install resolves to something you did not expect.** Cause: two release lines. The framework is
`22.1.5`; the CLI, `@angular/build` and `@angular/ssr` are `22.1.7`. Fix: let each line carry its
own caret, and check the tags rather than assuming:

```json
{
  "dependencies": { "@angular/core": "^22.1.5" },
  "devDependencies": { "@angular/build": "^22.1.7", "@angular/cli": "^22.1.7" }
}
```
```bash
npm view @angular/core version
npm view @angular/build version
```

**★ Symptom: your Docker build stage runs `npm ci --omit=dev` and then `ng: not found`.** Cause:
the whole build system lives in `devDependencies` — `@angular/build`, `@angular/cli`,
`@angular/compiler-cli` and `typescript` are all dev dependencies of a generated workspace, and you
cannot build without them. Fix: install everything in the build stage and copy only the output
forward:

```dockerfile
FROM node:24.15.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/my-app/browser /usr/share/nginx/html
```

**Symptom: an audit asks which npm versions are supported and you quote `engines.npm`.** Cause:
`^6.11.0 || ^7.5.6 || >=8.0.0` is a compatibility floor inherited from much older releases, not a
tested matrix — npm 6 shipped years before this Angular major existed. Fix: quote the Node range,
which is specific and current, and pin the package manager explicitly if the answer matters:

```json
{ "packageManager": "npm@10.9.0" }
```

**Symptom: a reviewer flags `@angular/build` being two patches ahead of `@angular/core` as
dependency drift.** Cause: expected — the two lines publish on different days. Fix: nothing, but
prove it rather than arguing it:

```bash
npm view @angular/build dist-tags
npm view @angular/core dist-tags
```

## Interview questions

**★ What is `@angular/build`, described in terms a package manager would recognise?**
A devDependency published on the `22.1.7` CLI release line whose manifest declares
`"description": "Official build system for Angular"`, an `engines.node` floor of
`^22.22.3 || ^24.15.0 || >=26.0.0`, a `"builders": "builders.json"` field that makes it a builder
package, and twenty-six exact-pinned runtime dependencies. You can characterise the whole tool from
that object without reading a line of its source, which is the point: the manifest is public, dated
and unarguable, where "Angular uses esbuild now" is a claim someone has to trust you on.

**★ Why is `@angular/build` at 22.1.7 when `@angular/core` is at 22.1.5? Is that a mistake?**
No — they are two independently versioned release lines that share a major. The tooling packages
(`@angular/cli`, `@angular/build`, `@angular/ssr`, `@angular-devkit/build-angular`) move together;
the framework packages (`@angular/core`, `@angular/compiler`, `@angular/compiler-cli`) move
together. Patch releases land on the two lines on different days, so the numbers routinely differ
by a patch or two. The practical consequence is that "we are on Angular 22.1.7" is not a
well-formed sentence, and a `package.json` written that way asks for a framework version that does
not exist.

**★ A patch release of the build system changed the Node version your project requires. How is that
allowed, and how do you keep a team from tripping over it?**
`engines` is metadata about the environment, not a public API surface, so tightening it inside a
patch line is not a SemVer break by the definition Angular applies to its packages — v22.0.0 named
22.22.0 / 24.13.1 and the manifest at 22.1.7 names 22.22.3 / 24.15.0. The way you stop it hurting
is to source the pinned Node version from the manifest rather than the release notes, keep it in
`.nvmrc` (or the CI `setup-node` step) next to the project, and set `engine-strict=true` so a
mismatch fails the install instead of scrolling past as a warning. Anything softer than that turns
into "works on my machine" a fortnight later.

**What is `engines` actually enforcing, and what is it not?**
It declares a compatibility range; enforcement is the package manager's decision. npm surfaces a
mismatch as `EBADENGINE`, and the `engine-strict` setting decides whether that is fatal. Nothing in
the field stops the code from running on an unsupported runtime — it stops the *install* from being
silent about it. That distinction matters because a build that runs on an out-of-range Node can
fail later and much less legibly, at a syntax or API the runtime does not have, with no line in the
log connecting it back to the version.

---

← Prev: [What `ng build` actually runs](01-what-ng-build-actually-runs.md) · Index: [Topic index](README.md) · Next → [Twenty-six dependencies](02b-twenty-six-dependencies.md)
