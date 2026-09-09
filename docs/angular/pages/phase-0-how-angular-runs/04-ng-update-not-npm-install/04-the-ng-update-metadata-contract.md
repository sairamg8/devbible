---
title: "A package declares its own upgrade in four fields of its published `package.json`, and `packageGroup` is the one that explains why `ng update @angular/cli` moved eight packages you never named"
sidebar_label: "04 · The `ng-update` metadata contract"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/update-resolver.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/update-resolver.ts),
> [`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts),
> and the published manifest at `https://registry.npmjs.org/@angular/cli/22.1.7`.
> Documentation-validated; **no sandbox run** — every message below is quoted from the source line
> that emits it.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`ng update` has no built-in list of what Angular is. Everything it knows, it reads out of the
`ng-update` key in each package's published `package.json`.** That key is a four-field contract, and
it is public: any library on npm can implement it and get the same treatment `@angular/core` gets.
Reading it is what turns three otherwise baffling behaviours into obvious ones — why updating one
package changes seven others, why one dependency is versioned `0.2201.7` while its siblings are
`22.1.7`, and why a report about sixteen packages prints a single line.

## The four fields, from the interface that models them

The CLI models the contract as a TypeScript interface. Every field is optional except
`packageGroup` and `requirements`, and in practice most publishers set two of the four:

```ts
export interface UpdateMetadata {
  packageGroupName?: string;
  packageGroup: { [packageName: string]: string };
  requirements: { [packageName: string]: string };
  migrations?: string;
}
```

Read as behaviour rather than as types:

| Field | What it decides |
|---|---|
| `packageGroup` | **Which other packages move when this one moves.** |
| `packageGroupName` | Which single name the group is *reported* under. |
| `migrations` | Where the code that rewrites your source lives — [04b](04b-finding-the-migrations.md). |
| `requirements` | Declared in the interface and populated by the resolver; see the caveat at the end of this page. |

🔴 **The key in `package.json` is `ng-update`, and the interface above is what the CLI parses it
into.** A package with no `ng-update` key is not "up to date" — it is invisible, which is the whole
point of [01d · A bare `ng update` is a report](01d-a-bare-ng-update-is-a-report.md).

## `packageGroup` — two shapes, both live in v22

The interface types `packageGroup` as an object. The resolver accepts an array as well, and both
shapes ship in the same release of Angular.

**The array form** is what `@angular/core@22.1.5` publishes — sixteen package names, no versions.
That manifest is quoted in full in
[01 · Why `npm install` is not an upgrade](01-why-npm-install-is-not-an-upgrade.md); the short
version is that the framework packages are named as a set and carry no per-package version, because
they are all published at the version of the package you asked for.

**The object form** is what `@angular/cli@22.1.7` publishes, verbatim from the registry:

```json
"ng-update": {
  "migrations": "@schematics/angular/migrations/migration-collection.json",
  "packageGroup": {
    "@angular/cli": "22.1.7",
    "@angular/ssr": "22.1.7",
    "@angular/build": "22.1.7",
    "@angular-devkit/core": "22.1.7",
    "@angular-devkit/architect": "0.2201.7",
    "@angular-devkit/schematics": "22.1.7",
    "@angular-devkit/build-angular": "22.1.7",
    "@angular-devkit/build-webpack": "0.2201.7"
  }
}
```

The resolver normalises the two shapes in one line, and everything downstream sees a list of names:

```ts
const packageGroupNames = Array.isArray(packageGroup)
  ? packageGroup
  : Object.keys(packageGroup);
```

And when the value is neither an array nor an object, the group is dropped rather than fatal —
the exact string, from the same file:

```ts
logger.warn(`PackageGroup metadata for ${packageJson.name} is malformed. Ignoring.`);
```

⚠️ **`Ignoring` means the update still runs.** A malformed group downgrades a multi-package upgrade
to a single-package one and prints one warning in a long log. If you publish a library with an
`ng-update` key, this is the failure mode to look for — not a crash.

## Two things that object is quietly telling you

**`ng update @angular/cli` moves eight packages, including `@angular/build`.** If you have only
ever typed `ng update @angular/cli @angular/core`, you have never had to name `@angular/build` — the
package that actually builds your application since v18 — and this is why. It rides along in the
CLI's group. The same is true of `@angular/ssr`: a project that server-renders gets its SSR package
moved by a command that does not mention it.

The practical consequence is that the two-package command in the docs is not a shorthand for "the
two most important packages". It is *one member of each of the two groups* — the framework group
under `@angular/core` and the tooling group under `@angular/cli` — and naming one member of a group
is the same as naming all of it.

**`@angular-devkit/architect` is `0.2201.7`, not `22.1.7`.** That is not a typo and not a stale
pin. The devkit packages that are not semver-locked to the framework use a `0.MAJORMINOR.PATCH`
scheme: a literal `0.`, then `2201` — major `22`, minor `01`, zero-padded to two digits — then the
patch, `.7`. So `0.2201.7` and `22.1.7` are the same release. `@angular-devkit/build-webpack` uses
it too.

```text
0 . 22 01 . 7
│    │  │    └── patch
│    │  └─────── minor, zero-padded to two digits
│    └────────── major
└─────────────── literal 0, so the package stays on 0.x semver
```

The reason it exists is the semver contract: staying on `0.x` means these packages are not making a
stable-API promise on their own, while still encoding which framework release they belong to. When
someone opens a PR and asks why one line of `package.json` looks wrong, this is the answer.

## `packageGroupName` — why a report collapses sixteen rows into one

`ng update` with no arguments prints a table of what is behind. Sixteen `@angular/*` packages are
behind at the same moment, and it prints **one** row. That collapsing is `packageGroupName`, and the
mechanism is a `return null` in the reporting path:

```ts
const packageGroupName =
  (ngUpdate?.['packageGroupName'] as string | undefined) ||
  packageGroupNames.find((n) => infoMap.has(n));

if (packageGroupName) {
  if (packageGroups.has(name)) {
    return null;
  }
  for (const groupName of packageGroupNames) {
    packageGroups.set(groupName, packageGroupName);
  }
  packageGroups.set(packageGroupName, packageGroupName);
  name = packageGroupName;
}
```

Read it in order. The first package of a group to be considered has not been seen, so it falls
through, registers **every** name in its group as mapping to the group name, and renames itself to
the group name. Every later member of that group now hits `packageGroups.has(name)` and returns
`null` — dropped from the report.

Note the fallback in the first statement: when a package does not set `packageGroupName` explicitly,
the group is reported under **the first member of `packageGroup` that is actually installed**. So
the name in your report is not necessarily the package you would have chosen; it is the first one
the resolver found.

## `requirements` — named here, not explained

`requirements` is declared in `UpdateMetadata` above and populated by the resolver's
`_getUpdateMetadata`. **This corpus has not read the code that enforces it, and the Angular
documentation does not appear to describe it.** It is named on this page so that a reader who finds
the key in a manifest knows it is part of the contract and not a stray; what it *does* is left
unstated deliberately, rather than guessed at.

The gate that stops an update on an incompatible peer dependency is a different mechanism entirely,
and it is the subject of **05 · The peer-dependency gate** *(not written yet)*.

## Gotchas

**★ Symptom: `ng update @angular/cli` also changed `@angular/build`, `@angular/ssr` and three
`@angular-devkit/*` packages you never mentioned.** Cause: the CLI's `packageGroup` names eight
packages, and naming one member of a group selects all of it. Fix: none — this is correct, and it
is what keeps the builder in step with the CLI that invokes it. What you should change is the
expectation, and the review: read the whole `package.json` diff, not the two lines you predicted.

**★ Symptom: `@angular-devkit/architect` is pinned at `0.2201.7` while every sibling is `22.1.7`,
and a reviewer flagged it as wrong.** Cause: the `0.MAJORMINOR.PATCH` scheme — `0.` + `2201` + `.7`
is release 22.1.7. Fix: leave it alone; it is what the CLI's own `packageGroup` publishes. To prove
it in a review, read the group off the registry manifest rather than arguing from memory:

```bash
npm view @angular/cli@22.1.7 ng-update.packageGroup
```

**★ Symptom: a bare `ng update` reports one `@angular/core` row, so you believe only one package is
behind.** Cause: `packageGroupName` collapses the whole group into a single row by returning `null`
for every member after the first. Fix: read the row as "this group is behind", and if you need the
per-package truth, ask npm rather than the report:

```bash
npm outdated | grep '^@angular'
```

**★ Symptom: your own library publishes an `ng-update` key and `ng update` ignores the group.**
Cause: `packageGroup` was neither an array nor an object — a string or a nested object will do it —
and the CLI warns `PackageGroup metadata for <name> is malformed. Ignoring.` rather than failing.
Fix: publish one of the two accepted shapes:

```json
"ng-update": {
  "packageGroup": ["@acme/ui", "@acme/ui-testing"],
  "migrations": "./schematics/migrations.json"
}
```

**★ Symptom: the group is reported under a package name nobody on the team recognises.** Cause: no
`packageGroupName` was published, so the CLI fell back to the first member of `packageGroup` that is
installed — which depends on what your project actually depends on. Fix: publishers set
`packageGroupName` explicitly to control this; consumers cannot.

**★ Symptom: a monorepo has `@angular/build` at one version and `@angular/cli` at another after a
hand-edit, and nothing complains until a build fails.** Cause: `packageGroup` is only consulted by
`ng update`; it is not a runtime or install-time constraint, so nothing enforces the group if you
edit `package.json` yourself. Fix: move the group with the command that understands it —
`ng update @angular/cli` — rather than editing versions.

**★ Symptom: you added `ng-update` to a library and expected `ng update @acme/ui` to also bump
`@angular/core`.** Cause: a `packageGroup` names packages that move *with yours to your version*; it
cannot express "and drag this other publisher's package forward". Fix: express Angular compatibility
in `peerDependencies` instead, which is what the peer gate reads.

## Interview questions

**★ What is `packageGroup` and why does it exist?**
It is the list of packages that must move together, published inside the `ng-update` key of a
package's own `package.json`. It exists because Angular's packages are built and tested as one unit
at one version — a project with `@angular/core` at 22.1.5 and `@angular/common` at 21.2.23 is a
configuration nobody tested. Making the group the unit of the command means a partial upgrade is not
merely discouraged, it is not expressible: you name one member and the CLI resolves the rest.

**★ How does a third-party library opt into `ng update`?**
By publishing an `ng-update` key in its `package.json` with a `migrations` path pointing at a
migration collection, and usually a `packageGroup` naming its own sibling packages. Nothing else is
required — there is no registration, no allowlist, and no Angular-team involvement. The corollary is
the one that bites: a library with no `ng-update` key is invisible to `ng update` entirely, so
`everything seems to be in order` says nothing about it
([01d](01d-a-bare-ng-update-is-a-report.md)).

**★ Why is `@angular-devkit/architect` versioned `0.2201.7` when the CLI it ships with is
`22.1.7`?**
Because the devkit packages that are not semver-locked to the framework encode the framework release
into a `0.x` version: `0.` + `2201` (major 22, minor 01) + `.7` (patch). Staying on `0.x` means they
make no independent stable-API promise, while the middle segment still says exactly which release
they belong to. They are the same release, written two ways.

**★ You run `ng update` with no arguments and see a single `@angular/core` row. How many packages
is that row actually about, and how would you find out?**
Sixteen, for the framework group in v22. The reporting path registers every member of a group
against one group name and returns `null` for each subsequent member, so the row is the group, not
the package. To see the members, read the published metadata —
`npm view @angular/core@22.1.5 ng-update.packageGroup` — rather than inferring it from the report.

**Why does a malformed `packageGroup` warn instead of failing the command?**
Because the group is an optimisation of the update, not a precondition for it. The CLI can still
update the package you named; it simply cannot expand that into a set. Failing would turn a
publisher's metadata bug into a hard block on every consumer's upgrade, so it degrades instead —
which is defensible, and is also why the warning is easy to miss in a long log.

**What is the difference between `packageGroup` and `peerDependencies` for expressing
compatibility?**
`packageGroup` is about *co-movement*: these packages are versioned and released together, so move
them together. `peerDependencies` is about *compatibility with something you do not control*: this
library works against Angular in this range. A library publishes both — a group for its own siblings
and a peer range for the framework — and they are read by different parts of the update.

{/* FOOTER */}
