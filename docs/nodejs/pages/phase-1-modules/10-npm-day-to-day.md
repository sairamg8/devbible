---
title: "npm day to day"
sidebar_label: "10 · npm day to day"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 with **npm 12.0.2**, the version bundled with Node 24.19.0.

**The dozen commands you actually run, and the two decisions that matter:
which dependency list a package belongs in, and whether the machine you are on
should be resolving ranges at all.**

## Installing

```console
$ npm install                    # everything in package.json
$ npm install express            # add a runtime dependency
$ npm install -D vitest          # add a dev dependency
$ npm install express@5.1.0      # a specific version
$ npm install express@latest     # newest, crossing majors
$ npm ci                         # exact lockfile install — CI and production
```

`npm i` is the alias. `--save` has been the default since npm 5 and does nothing.

## `dependencies` vs `devDependencies`

The test is one question: **does the running application need this?**

| Goes in `dependencies` | Goes in `devDependencies` |
|---|---|
| `express`, `pg`, `mongoose`, `redis` | `vitest`, `eslint`, `prettier` |
| `zod` — if you validate at runtime | `typescript` — if you compile ahead of deploy |
| `pino` — you log in production | `@types/*` — types vanish at runtime |
| anything imported by shipped code | test fixtures, build scripts |

```console
$ npm install --omit=dev         # what production installs
```

Getting this wrong fails in one direction only, and it fails in production:
something in `devDependencies` that shipped code imports is missing after
`--omit=dev`. Nothing catches it locally, because locally you installed everything.

The reliable check is a production-shaped install in CI:

```console
$ npm ci --omit=dev && node -e "require('./src/server.js')"
```

**The TypeScript nuance:** if you compile to JavaScript before deploying,
`typescript` is a dev dependency. If you run `.ts` directly in production — Node
strips types natively now, see [TypeScript without a build
step](12-typescript-natively.md) — you still do not need `typescript` at runtime,
because Node does the stripping itself. `@types/*` packages are always dev-only.

## Scripts and `npx`

```console
$ npm run dev                    # run a script
$ npm run                        # list available scripts
$ npm test                       # `run` is optional for test/start/stop/restart
$ npm run test -- --watch        # everything after -- goes to the script
```

Scripts get `node_modules/.bin` on `PATH`, so `eslint` in a script means your
locally-installed eslint, not a global one. That is why versions stay consistent
across a team.

`npx` runs a binary that may not be installed:

```console
$ npx tsc --version              # uses the local one if present
$ npx create-vite@latest my-app  # downloads, runs, does not install
```

`npx` prefers the local `node_modules/.bin`, then downloads to a cache. **It
prompts before downloading something not already present** — read that prompt. A
typo'd package name is a real attack vector, and `npx` executes what it fetches.

## Inspecting

```console
$ npm ls express                 # where a package resolved from, and why
$ npm ls --depth=0               # direct dependencies only
$ npm explain lodash             # which package pulled this in
$ npm outdated                   # what has newer versions
$ npm view express versions      # every published version
$ npm pack --dry-run             # what publishing would ship
```

`npm explain` is the one to remember. When something appears in your tree and you
did not ask for it, it prints the chain that dragged it in.

## Global installs

```console
$ npm install -g some-cli        # avoid
```

Global packages are invisible to your project, unversioned across machines, and a
common cause of "works on my machine". Two better options: add the tool to
`devDependencies` and call it from a script, or use `npx` for one-off runs.

The legitimate exceptions are version managers and package managers themselves —
things that must exist before a project does.

## Configuration

```ini
# .npmrc — committed, project-level
engine-strict=true
save-exact=true
```

`save-exact=true` makes `npm install <pkg>` write `5.1.0` instead of `^5.1.0`.
Worth considering for applications, where you want every change deliberate; less
so for libraries, where over-tight ranges force needless duplicate installs on
consumers.

Never commit a `.npmrc` containing a token. Registry credentials belong in
`~/.npmrc` or an environment variable.

## Gotchas

**Symptom:** `Cannot find module` in production for a package that works locally
**Cause:** It is in `devDependencies` and production installed with `--omit=dev`.
**Fix:** Move it to `dependencies`. Add a `npm ci --omit=dev` smoke test to CI.

**Symptom:** `npm run test -- --watch` does not pass the flag through
**Cause:** Missing `--` separator.
**Fix:** Keep the `--`. Everything after it goes to the script.

**Symptom:** A CLI behaves differently for one teammate
**Cause:** They have a global install shadowing the project's version.
**Fix:** Call it through an npm script so `node_modules/.bin` wins, and remove the
global.

**Symptom:** `npm ls` reports `invalid` or `extraneous`
**Cause:** `node_modules` drifted from the lockfile — usually a hand-edit or an
interrupted install.
**Fix:** `rm -rf node_modules && npm ci`.

**Symptom:** A package you never installed is in the tree
**Cause:** It is transitive.
**Fix:** `npm explain <pkg>` prints the chain. Do not import it directly — it can
vanish on any update.

**Symptom:** `npx` ran something unexpected
**Cause:** A typo'd or malicious package name fetched and executed from the
registry.
**Fix:** Read the confirmation prompt. Pin with `npx pkg@version` for anything you
run repeatedly.

## Interview questions

**★ When does a package belong in `devDependencies` rather than `dependencies`?**
When the running application never imports it — test runners, linters, formatters,
type definitions, build tools. Production installs with `--omit=dev`, so anything
shipped code imports must be a real dependency.

**★ What does `npx` actually do?**
It resolves a binary from the local `node_modules/.bin` first, and if it is not
there, downloads the package to a cache and executes it without installing it into
the project. It prompts before fetching something new, which matters because it is
executing code from the registry.

**★ Why should you avoid global installs?**
They are unversioned, invisible to the project, and differ per machine, so tool
behaviour stops being reproducible. Put the tool in `devDependencies` and call it
from a script, where `node_modules/.bin` guarantees everyone runs the same
version.

**★ How do you find out why a package is in your tree?**
`npm explain <pkg>` prints the dependency chain that pulled it in. `npm ls <pkg>`
shows every copy and where each resolved from.

**What does `--` do in `npm run test -- --watch`?**
It separates npm's own arguments from the script's. Without it npm consumes the
flag itself and the script never sees it.

**What is `save-exact` and when would you enable it?**
It makes installs write exact versions instead of `^` ranges. Useful for
applications, where every dependency change should be explicit and reviewed; less
appropriate for libraries, where tight ranges force duplicate copies on consumers.

---

← Prev: [Semver and lockfiles](09-semver-and-lockfiles.md) · Next → [npm, pnpm, yarn and workspaces](11-package-managers.md)
