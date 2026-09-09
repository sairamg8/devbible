---
title: "Your v21 CLI cannot run v22's migrations, so it does not try — it installs a v22 CLI into a temporary directory and re-executes itself under it, and it widens @angular/core's peer ranges by exactly one major so libraries do not block the hop"
sidebar_label: "02c · How the CLI keeps its promise"
sidebar_position: 2.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts),
> [`.../update/utilities/cli-version.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/cli-version.ts),
> [`.../update/update-resolver.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/update-resolver.ts)
> (`angularMajorCompatGuarantee`).
> Documentation-validated; **no sandbox run** — every message and comment below is quoted from the
> source. ⚠️ Neither mechanism on this page appears in angular.dev's documentation; both are read
> from the CLI source.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every reader who understands that migrations are code eventually asks the obvious question: your
installed CLI is v21, the migrations you need to run shipped with v22, so how does a v21 program
execute v22's schematics?** It does not. It downloads a v22 CLI into a temporary directory and
re-executes the whole command under it. That single fact explains a surprising amount of otherwise
baffling behaviour — the pause partway through an update, output that does not match the CLI you
think you have, and `ng --version` afterwards disagreeing with whatever just ran. The second half
of this page is the other mechanism nobody documents: the CLI quietly widens `@angular/core`'s
declared peer ranges by exactly one major so that a library which has not yet bumped its peer
declaration cannot block an Angular update on paper alone.

## The temporary CLI, verbatim

From
[`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts):

```ts
if (!disableVersionCheck && options.packages?.length) {
  const cliVersionToInstall = await checkCLIVersion(
    options.packages, logger, packageManager, options.next,
  );

  if (cliVersionToInstall) {
    logger.warn(
      'The installed Angular CLI version is outdated.\n' +
        `Installing a temporary Angular CLI versioned ${cliVersionToInstall} to perform the update.`,
    );

    return runTempBinary(
      `@angular/cli@${cliVersionToInstall}`, packageManager, process.argv.slice(2),
    );
  }
}
```

The two messages, exact:

> **`The installed Angular CLI version is outdated.`**
> **`Installing a temporary Angular CLI versioned <version> to perform the update.`**

Note where the check sits: `options.packages?.length` gates it, so a bare `ng update`
([01d · A bare `ng update` is a report](01d-a-bare-ng-update-is-a-report.md)) never triggers it.
Reporting does not need a newer runtime; migrating does.

## Which version it picks, and the reasoning in the source's own comments

From
[`utilities/cli-version.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/cli-version.ts), complete:

```ts
export function getCLIUpdateRunnerVersion(
  packagesToUpdate: string[] | undefined,
  next: boolean,
): string | number {
  if (next) {
    return 'next';
  }

  const updatingAngularPackage = packagesToUpdate?.find((r) => ANGULAR_PACKAGES_REGEXP.test(r));
  if (updatingAngularPackage) {
    // If we are updating any Angular package we can update the CLI to the target version because
    // migrations for @angular/core@13 can be executed using Angular/cli@13.
    // This is same behaviour as `npx @angular/cli@13 update @angular/core@13`.

    // `@angular/cli@13` -> ['', 'angular/cli', '13']
    // `@angular/cli` -> ['', 'angular/cli']
    const tempVersion = coerceVersionNumber(updatingAngularPackage.split('@')[2]);

    return semver.parse(tempVersion)?.major ?? 'latest';
  }

  // When not updating an Angular package we cannot determine which schematic runtime the migration should to be executed in.
  // Typically, we can assume that the `@angular/cli` was updated previously.
  // Example: Angular official packages are typically updated prior to NGRX etc...
  // Therefore, we only update to the latest patch version of the installed major version of the Angular CLI.

  // This is important because we might end up in a scenario where locally Angular v12 is installed, updating NGRX from 11 to 12.
  // We end up using Angular ClI v13 to run the migrations if we run the migrations using the CLI installed major version + 1 logic.
  return VERSION.major;
}
```

Three branches, and the third is the one with consequences:

| You are updating | Runner CLI version | Why |
|---|---|---|
| any `@angular/*` package with an explicit version | **that package's major** | *"migrations for `@angular/core@13` can be executed using `Angular/cli@13`"* |
| anything, with `--next` | the `next` **dist-tag** | you asked for pre-releases, so the runner must be one |
| **only non-Angular packages** | **`VERSION.major`** — the major of the CLI you already have | *"we cannot determine which schematic runtime the migration should to be executed in"* |

🔴 **That third branch is why you update Angular before you update your Angular-ecosystem
libraries.** The source comment spells out both the assumption and the failure it avoids: *"Angular
official packages are typically updated prior to NGRX etc..."*, and *"we might end up in a scenario
where locally Angular v12 is installed, updating NGRX from 11 to 12. We end up using Angular ClI
v13 to run the migrations if we run the migrations using the CLI installed major version + 1
logic."* (the `ClI` typo is in the source.) Updating a third-party library runs its migrations under **your currently installed CLI's
major**, so if that CLI is stale, the library's migrations run on a runtime older than the one they
were written for.

## How it re-executes

`runTempBinary`, from the same file:

```ts
const { status, error } = spawnSync(process.execPath, [binPath, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NG_DISABLE_VERSION_CHECK: 'true',
    NG_CLI_ANALYTICS: 'false',
  },
});
```

Three details worth having:

- **`stdio: 'inherit'`** — the child's output goes straight to your terminal, which is why the
  transition is nearly invisible. What you read after the warning line is a *different program's*
  output.
- **`NG_DISABLE_VERSION_CHECK: 'true'`** — set so the child does not perform the same check and
  spawn a grandchild. That environment variable is the recursion guard, and it is the same one
  `disableVersionCheck` reads in the parent.
- **`process.argv.slice(2)`** — your original arguments are passed through unchanged.

**Nothing about your project's installed CLI changes.** The temporary binary is used for the
duration of the command; afterwards, `ng --version` reports whatever `package.json` and the
migrations left you with, which is why the version that *ran* your update and the version you *have*
can legitimately differ.

## `angularMajorCompatGuarantee` — the other one-major allowance

`ng update` validates peer dependencies before it will change anything, and a library declaring
`"@angular/core": "^21.0.0"` would, read literally, block every update to v22 until its author
publishes a new range. The CLI applies a transform to `@angular/core`'s ranges specifically. From
[`update-resolver.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/update-resolver.ts):

```ts
export function angularMajorCompatGuarantee(range: string) {
  let newRange = semver.validRange(range);
  if (!newRange) {
    return range;
  }
  let major = 1;
  while (!semver.gtr(major + '.0.0', newRange)) {
    major++;
    if (major >= 99) {
      return newRange;
    }
  }

  newRange = range;
  for (let minor = 0; minor < 20; minor++) {
    newRange += ` || ^${major}.${minor}.0-alpha.0 `;
  }

  return semver.validRange(newRange) || range;
}

const knownPeerCompatibleList: { [name: string]: PeerVersionTransform } = {
  '@angular/core': angularMajorCompatGuarantee,
};
```

**What it does, in prose.** Find the lowest major *above* the declared range, then widen the range
to also accept every `^MAJOR.MINOR.0-alpha.0` for minors 0 through 19 of that major. A library
declaring `^21.0.0` is treated, for the purposes of `ng update` only, as though it also accepted
`^22.0.0-alpha.0` through `^22.19.0-alpha.0`.

**Why it exists.** It is the same one-major policy expressed from the other side. Angular's release
policy commits to a bounded amount of breakage per major, so the CLI is willing to assume a library
built for major N will work on major N+1 — and to *stop assuming* at N+2, exactly where
[chunk 02](02-one-major-at-a-time.md)'s guard also stops.

🔴 **Two boundaries on that assumption, and both matter.**

- **The name says "guarantee" and it is not one.** It is a CLI-side allowance during the update
  plan. The library made no promise, its author may not have tested against the new major, and the
  code may break at runtime. `angularMajorCompatGuarantee` widens a *check*, not a compatibility.
- **It does not widen the peer check your package manager runs afterwards.** The install step is a
  separate process with its own peer resolution; the CLI works around npm 7+ by forcing the install
  rather than by teaching npm this transform. Do not expect a plain `npm install` later to be as
  forgiving.

The full peer gate — that it validates in both directions, that an *optional* peer mismatch logs an
error without failing, and precisely what `--force` skips — is **05 · The peer-dependency gate**
*(not written yet)*.

## Gotchas

**★ Symptom: `ng update` printed `The installed Angular CLI version is outdated.` and then appeared
to hang before producing output that looks like a different version of the tool.** Cause: it is
installing a temporary CLI at the target major and will re-execute the command under it. Fix:
nothing to fix — but the pause is an install, so it takes as long as an install takes and it needs
registry access. In a network-restricted environment this is the step that fails.

**★ Symptom: after a successful update, `ng --version` reports a version different from the one
whose output you just watched.** Cause: the update ran under a temporary binary that was never
installed into your project. Fix: read `package.json` for the truth about what your project is on;
the temporary CLI leaves no trace there by design.

**★ Symptom: you updated a third-party Angular library first, and its migrations misbehaved.**
Cause: when no `@angular/*` package is named, the runner falls back to `VERSION.major` — your
currently installed CLI's major — because the CLI cannot infer which schematic runtime the
library's migrations expect. Fix: follow the order the source comment assumes, framework first:

```bash
ng update @angular/cli@^22 @angular/core@^22     # 1 · framework and CLI
ng update some-state-library@^22                 # 2 · then the ecosystem
```

**★ Symptom: a library declaring `"@angular/core": "^21.0.0"` did not block your v22 update, and
then broke at runtime.** Cause: `angularMajorCompatGuarantee` widened its declared range by one
major for the purposes of the update plan. Fix: the allowance is the CLI's, not the library's —
check the library's release notes for actual v22 support before treating a clean `ng update` as
evidence of compatibility.

**★ Symptom: `ng update` succeeded, and a later plain `npm install` failed on the same peer
range.** Cause: the widening is applied inside the update resolver only. The package manager's own
peer resolution never sees it, and the CLI works around npm 7+ separately by forcing the install.
Fix: pin or override the peer explicitly if you need every subsequent install to succeed, and treat
the mismatch as debt to clear rather than as noise.

**★ Symptom: `ng update --next` pulled a pre-release CLI to run the migrations.** Cause: with
`--next`, `getCLIUpdateRunnerVersion` returns the `next` dist-tag rather than a major number, so the
runner is itself a pre-release. Fix: expected and necessary — pre-release migrations need a
pre-release runtime — but it means a `--next` update is running unreleased schematics against your
source. Do it on a branch.

**★ Symptom: in a locked-down CI image with no registry access, `ng update` fails at the temporary
CLI step even though everything is already in the lockfile.** Cause: the temporary binary is
fetched at run time and is not part of your dependency tree. Fix: run updates where the network is;
this is another reason `ng update` is not a build-pipeline step.

## Interview questions

**★ Your installed CLI is v21 and you are updating to v22. Which CLI runs the v22 migrations?**
A v22 CLI that the command installs into a temporary directory and then re-executes itself under,
passing your original arguments through with `stdio: 'inherit'` and `NG_DISABLE_VERSION_CHECK` set
so the child does not repeat the check. Your project's own CLI is never used to run migrations it
does not ship, and the temporary binary is not installed into the project — which is why
`ng --version` afterwards can disagree with the output you just watched.

**★ How does the CLI decide which version of itself to fetch as the runner?**
By reading the packages you named. If any is an `@angular/*` package with an explicit version, it
takes that package's major, on the reasoning stated in the source comment — *"migrations for
`@angular/core@13` can be executed using `Angular/cli@13`"*. With `--next` it takes the `next`
dist-tag. And if you named only non-Angular packages, it falls back to the major of the CLI you
already have, because it has no way to infer which schematic runtime a third-party library's
migrations were written for.

**★ Why should you update Angular before your Angular-ecosystem libraries?**
Because of that third branch. A `ng update some-library@22` with no Angular package named runs the
library's migrations under your *installed* CLI's major. If you have not moved Angular yet, that is
the old major, and the library's v22 migrations are executing on a v21 schematic runtime. The
source comment states the assumption directly: *"Angular official packages are typically updated
prior to NGRX etc..."*

**★ What is `angularMajorCompatGuarantee`, and is the name accurate?**
It is a function in the update resolver that widens `@angular/core` peer ranges by exactly one
major — for a declared `^21.0.0` it appends `^22.0.0-alpha.0` through `^22.19.0-alpha.0` — so that
a library which has not yet bumped its peer declaration does not block an Angular update. The name
is optimistic. It is a CLI-side allowance applied while resolving the update plan; the library made
no promise, and nothing was tested. It also does not affect the peer resolution your package
manager performs on subsequent installs.

**Why does a bare `ng update` never fetch a temporary CLI?**
Because the check is gated on `options.packages?.length`. With no packages named the command only
reports, and reporting needs no schematic runtime — there are no migrations to execute, so there is
nothing that a newer CLI would be required for.

**What stops the temporary CLI from spawning another temporary CLI?**
`NG_DISABLE_VERSION_CHECK: 'true'` in the spawned child's environment. The parent sets it
explicitly, and the child's own version check reads it and skips. Without that, a CLI whose
version check disagreed with its own would recurse.

{/* FOOTER */}
