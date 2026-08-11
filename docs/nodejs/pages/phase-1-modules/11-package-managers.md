---
title: "npm, pnpm, yarn and workspaces"
sidebar_label: "11 · Package managers"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 with **npm 12.0.2** on Node 24.19.0. Corepack ships the others.

**All three install packages. The difference that matters is the shape of
`node_modules`, and whether an undeclared dependency can accidentally work.**

## The layout difference

**npm and yarn hoist.** Transitive dependencies are flattened into the top-level
`node_modules` so duplicates collapse:

```
node_modules/
├── express/          ← you declared this
├── body-parser/      ← you did NOT — express did
└── ms/               ← something four levels down did
```

Because [resolution walks upward](05-module-resolution.md), `require('ms')` now
works from anywhere in your project. It works until express drops it, at which
point your code breaks and the diff that caused it is in someone else's package.
This is **phantom dependencies**.

**pnpm does not hoist.** It installs every package once into a global
content-addressable store and builds `node_modules` from symlinks, with only your
declared dependencies at the top level:

```
node_modules/
├── express -> .pnpm/express@5.1.0/node_modules/express
└── .pnpm/            ← the real tree, one copy of each version on disk
```

`require('ms')` fails immediately. That is the feature: an undeclared import is an
error on your machine, not a surprise in production six weeks later.

| | npm | yarn (Berry) | pnpm |
|---|---|---|---|
| Layout | hoisted | hoisted, or PnP | symlinked store |
| Phantom deps possible | yes | yes (no under PnP) | **no** |
| Disk for 5 projects sharing a dep | 5 copies | 5 copies | **1 copy** |
| Install speed | baseline | fast | **fastest on warm cache** |
| Lockfile | `package-lock.json` | `yarn.lock` | `pnpm-lock.yaml` |
| Ships with Node | **yes** | via Corepack | via Corepack |

The honest recommendation: **npm is the default and it is fine.** It ships with
Node, every tutorial assumes it, and no CI system needs configuring for it. Choose
pnpm when you have a monorepo, a lot of projects on one disk, or you have been
bitten by phantom dependencies. Choose yarn if the team already uses it.

Do not mix. Two lockfiles in one repo means two different trees depending on who
ran what.

## Corepack

Node ships Corepack, which pins the package manager per project:

```json
{ "packageManager": "pnpm@10.4.1" }
```

```console
$ corepack enable
$ pnpm install        # Corepack fetches exactly 10.4.1
```

Everyone gets the same package manager version without a global install. Corepack
is distributed with Node but not enabled by default — `corepack enable` is a
one-time per-machine step, which is the friction that keeps adoption low.

## Workspaces

One repository, several packages, one install, one lockfile. All three managers
support it; the npm form:

```json
{
  "name": "mono-root",
  "private": true,
  "version": "1.0.0",
  "workspaces": ["packages/*"]
}
```

```json
{
  "name": "@acme/api",
  "version": "1.0.0",
  "type": "module",
  "dependencies": { "@acme/shared": "1.0.0" }
}
```

`npm install` at the root links siblings instead of downloading them:

```console
$ npm install
$ ls -l node_modules/@acme/
api -> ../../packages/api
shared -> ../../packages/shared

$ node packages/api/index.js
api resolved workspace sibling → acme
```

`@acme/shared` is a symlink to the local directory, so an edit there is visible to
`@acme/api` immediately — no build, no publish, no `npm link`.

```console
$ npm install lodash -w @acme/api    # add a dep to one workspace
$ npm run build -w @acme/api         # run a script in one workspace
$ npm run test --workspaces          # run it in all of them
```

`private: true` on the root is not optional — it stops a stray `npm publish` from
pushing the whole monorepo.

**When workspaces earn their place:** packages that are released together and
change together — an app plus the client library it defines, a shared config
package. **When they do not:** unrelated services that happen to share a
repository. You inherit coupled installs and a shared lockfile for no benefit.

The thing workspaces do not give you is build orchestration. Once you need "build
shared before api, and only if it changed", that is Turborepo or Nx — outside this
phase.

## Gotchas

**Symptom:** An import works locally and fails after switching to pnpm
**Cause:** A phantom dependency — you were importing something you never declared.
**Fix:** Add it to `dependencies`. pnpm found a real bug.

**Symptom:** Two lockfiles in the repository
**Cause:** Different people used different package managers.
**Fix:** Pick one, delete the others, add `packageManager` to `package.json` and
enable Corepack.

**Symptom:** A workspace change is not picked up by another workspace
**Cause:** The dependent imports built output (`dist/`) that has not been rebuilt.
**Fix:** Rebuild, or point the sibling's `exports` at source during development.

**Symptom:** `npm publish` in a monorepo tries to publish the root
**Cause:** Missing `private: true`.
**Fix:** Add it to the root `package.json`.

**Symptom:** Two copies of the same library in one bundle
**Cause:** Version ranges in different workspaces resolved to different versions,
so hoisting could not collapse them.
**Fix:** Align the ranges, or use `overrides` to force one version.

## Interview questions

**★ What is a phantom dependency?**
A package your code imports successfully without declaring it, because a package
manager hoisted it into the top-level `node_modules` for some other package's
benefit. It breaks the moment the real dependent drops or moves it — and the
change that broke you is in someone else's release.

**★ How does pnpm's `node_modules` differ from npm's?**
npm flattens the whole tree into top-level `node_modules`. pnpm keeps one copy of
each package version in a global content-addressable store and builds
`node_modules` from symlinks, exposing only your declared dependencies at the top
level. That saves disk across projects and makes undeclared imports fail
immediately.

**★ What do workspaces give you?**
One install and one lockfile across several packages in a repository, with local
packages symlinked instead of downloaded, so changes in one are immediately
visible in another. They do not give you build orchestration or ordering.

**Which package manager should a new project use?**
npm unless there is a reason — it ships with Node and needs no setup. pnpm for
monorepos, machines running many projects, or teams that want undeclared imports
to fail loudly.

**What is Corepack for?**
Pinning the package manager and its version per project via the `packageManager`
field, so everyone uses the same one without a global install. It ships with Node
but must be enabled once per machine.

---

← Prev: [npm day to day](10-npm-day-to-day.md) · Next → [TypeScript without a build step](12-typescript-natively.md)
