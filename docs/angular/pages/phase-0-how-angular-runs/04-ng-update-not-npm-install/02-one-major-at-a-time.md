---
title: "You cannot skip an Angular major, and the rule is not advice — a guard in the CLI compares the two major numbers and refuses the run when the difference exceeds one"
sidebar_label: "02 · One major at a time"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Angular versioning and releases](https://angular.dev/reference/releases);
> `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts),
> [`.../update/utilities/constants.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/constants.ts),
> [`.../update/utilities/migration.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/migration.ts).
> Documentation-validated; **no sandbox run** — every message below is quoted from the source that
> emits it. ⚠️ The *reason* a two-major jump breaks is marked below as an inference from the code;
> no documentation sentence states it.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The single most expensive Angular mistake is trying to go from v19 to v22 in one command, and the
reason it is expensive is that it does not fail loudly enough on the first attempt to stop you from
working around it.** `ng update` refuses the jump with a clear message and a non-zero exit. The
temptation is then to bypass the tool — hand-edit the versions, `npm install`, and start fixing
compile errors — which produces a project that builds and has silently skipped two majors' worth of
source rewrites. This chunk is the rule, the guard that enforces it, and the honest state of the
evidence on *why* the rule exists.

## The rule, as the documentation states it

From angular.dev, *Angular versioning and releases*, verbatim:

> *"You can `ng update` to any version of Angular, provided that the following criteria are met:
> The version you want to update **to** is supported. The version you want to update **from** is
> within one major version of the version you want to upgrade to."*
>
> *"For example, you can update from version 11 to version 12, provided that version 12 is still
> supported. If you want to update across multiple major versions, perform each update one major
> version at a time. For example, to update from version 10 to version 12: Update from version 10
> to version 11. Update from version 11 to version 12."*
> — [angular.dev/reference/releases](https://angular.dev/reference/releases)

Two criteria, and they are about different ends of the jump:

- **The target must be supported.** That is a statement about the version you are going *to*, not
  the one you are coming *from*. A v19 project can still be updated to v20 even though v19 itself
  left support, because the constraint is on the destination.
- **The source must be within one major of the target.** This is the one the CLI enforces in code.

## The guard, verbatim

From `updatePackagesAndMigrate` in
[`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts):

```ts
if (ANGULAR_PACKAGES_REGEXP.test(node.name)) {
  const { name, version } = node;
  const toBeInstalledMajorVersion = +manifest.version.split('.')[0];
  const currentMajorVersion = +version.split('.')[0];

  if (toBeInstalledMajorVersion - currentMajorVersion > 1) {
    // Only allow updating a single version at a time.
    if (currentMajorVersion < 6) {
      // Before version 6, the major versions were not always sequential.
      // Example @angular/core skipped version 3, @angular/cli skipped versions 2-5.
      logger.error(
        `Updating multiple major versions of '${name}' at once is not supported. Please migrate each major version individually.\n` +
          `For more information about the update process, see https://update.angular.dev/.`,
      );
    } else {
      const nextMajorVersionFromCurrent = currentMajorVersion + 1;

      logger.error(
        `Updating multiple major versions of '${name}' at once is not supported. Please migrate each major version individually.\n` +
          `Run 'ng update ${name}@${nextMajorVersionFromCurrent}' in your workspace directory ` +
          `to update to latest '${nextMajorVersionFromCurrent}.x' version of '${name}'.\n\n` +
          `For more information about the update process, see https://update.angular.dev/?v=${currentMajorVersion}.0-${nextMajorVersionFromCurrent}.0`,
      );
    }

    return 1;
  }
}
```

The message, exact:

> **`Updating multiple major versions of '<name>' at once is not supported. Please migrate each major version individually.`**

Four things to take from that block, in order of how often they matter:

1. **The comparison is `toBeInstalled - current > 1`.** One major ahead is allowed; two is refused.
   There is no configuration, no flag and no environment variable that relaxes it — `--force`
   bypasses the *peer dependency* check, not this one.
2. **The error names your exact next command.** `Run 'ng update @angular/core@20' in your workspace
   directory to update to latest '20.x' version of '@angular/core'.` The tool has already worked out
   the ladder for you; it is a matter of running it three times rather than solving anything.
3. **The URL is parameterised** — `https://update.angular.dev/?v=19.0-20.0` — so the interactive
   update guide opens on the hop you are actually attempting, not on its front page.
4. **`return 1`.** The command exits non-zero having changed nothing. Your `package.json` is
   untouched. This is a refusal, not a partial application.

### The `currentMajorVersion < 6` branch, and why it exists

The comment explains itself: *"Before version 6, the major versions were not always sequential.
Example `@angular/core` skipped version 3, `@angular/cli` skipped versions 2-5."* On a pre-v6
project, `currentMajorVersion + 1` would name a version that may never have existed, so the CLI
declines to guess and prints the generic message with no suggested command. If you are ever on
Angular 5, the tool will tell you the rule and leave the route to you.

## 🔴 The guard only applies to Angular's own packages

The scope is one regular expression, from
[`utilities/constants.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/constants.ts):

```ts
export const ANGULAR_PACKAGES_REGEXP = /^@(?:angular|nguniversal)\//;
```

whose own doc comment reads:

> *"Regular expression to match Angular packages. Checks for packages starting with `@angular/` or
> `@nguniversal/`."*

So `ng update some-ui-kit@8` from `some-ui-kit@5` is **attempted**. The migrations for majors 6, 7
and 8 will be selected and run in version order against source none of them expects, and whatever
comes out the other side is what you get. Third-party Angular libraries carry exactly the same
migration risk as the framework and none of the protection — the discipline has to come from you.

## Why the jump breaks — and how much of this is documented

⚠️ **Everything in this section below the first paragraph is an inference from the CLI's source.
angular.dev states the rule but gives no reason for it, and I found no documentation sentence
explaining the mechanism.** It is presented here because the mechanism is visible in the code and
because "because they said so" is not a usable model — but treat the causal claim as reasoning,
not as a quoted guarantee.

The obvious hypothesis — *"the skipped major's migrations get lost"* — is **wrong**, and the source
says so. Migrations are selected by a semver range built from the installed version to the target,
from [`utilities/migration.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/migration.ts):

```ts
const migrationRange = new semver.Range(
  '>' + (semver.prerelease(from) ? from.split('-')[0] + '-0' : from) + ' <=' + to.split('-')[0],
);
```

A v20 → v22 update builds the range `>20.0.0 <=22.0.0`, which matches both the v21 migrations and
the v22 migrations. They would all be collected:

```ts
if (semver.satisfies(description.version, migrationRange, { includePrerelease: true })) {
  (description.optional ? optionalMigrations : requiredMigrations).push(…);
}
```

And they would run in version order, because that is the only ordering the CLI applies:

```ts
function compareMigrations(a, b) { return semver.compare(a.version, b.version); }
```

**The inference:** sorting is not composition. Migration `22.0.0` is written against source that
migration `21.0.0` has already transformed — that is the only shape its authors ever had to
consider, and it is the shape every project that upgraded one major at a time will present. Run the
two in sequence on v20 source and the v21 migration behaves correctly, but the v22 migration meets
whatever the v21 migration left behind *plus* v20 constructs the v21 migration was not looking for.
The failure mode is not an exception; it is a migration matching nothing and reporting no changes,
which is indistinguishable from success.

Making every migration idempotent and shape-agnostic across two majors is a permanent tax on every
migration Angular will ever write. A single comparison of two integers in the CLI is not. The guard
is the cheaper answer, and that is the shape of the argument — but again, the framework does not
say this anywhere I could find.

## Gotchas

**★ Symptom: `Updating multiple major versions of '@angular/core' at once is not supported. Please
migrate each major version individually.`** Cause: the target major minus the installed major is
greater than one. Fix: run the ladder, one rung at a time, verifying between each — and read the
suggested command out of the error, which already names the correct next hop:

```bash
ng update @angular/cli@^20 @angular/core@^20   # then test, then commit
ng update @angular/cli@^21 @angular/core@^21   # then test, then commit
ng update @angular/cli@^22 @angular/core@^22
```

**★ Symptom: you hit the refusal, gave up on the tool, hand-edited the versions and fixed the
compile errors instead.** Cause: the refusal exits non-zero and changes nothing, which makes
bypassing it feel like a free choice. Fix: it is the most expensive thing you can do to an Angular
codebase. Two majors of behaviour-preserving migrations never ran, so the project silently adopted
every new default, and its source is now in a shape no future migration was written against.
Revert and run the ladder.

**★ Symptom: a third-party Angular library was upgraded three majors in one `ng update` and its
migrations produced nonsense — half-renamed symbols, imports pointing at modules that no longer
exist.** Cause: `ANGULAR_PACKAGES_REGEXP` matches only `@angular/` and `@nguniversal/`, so nothing
guarded that library. Fix: step it manually, one major per run, exactly as you would the framework:

```bash
ng update some-ui-kit@6
ng update some-ui-kit@7
ng update some-ui-kit@8
```

**★ Symptom: `--force` did not get you past the multi-major refusal.** Cause: `--force` is
documented as *"Ignore peer dependency version mismatches"* and does nothing else. The major-version
guard has no bypass at all. Fix: there is no flag; run the ladder.

**★ Symptom: the guard fires on a package you did not name on the command line.** Cause: it walks
the resolved dependency graph, and `packageGroup` pulls a whole family in with the package you did
name. Fix: expected — the family moves together, so the constraint applies to every member. The
`packageGroup` mechanism is **04 · The `ng-update` metadata contract** *(not written yet)*.

## Interview questions

**★ Why does Angular refuse a two-major `ng update` when the migrations for both majors would be
selected anyway?**
The selection is not the problem — a v20 → v22 update builds the range `>20.0.0 <=22.0.0`, which
matches both majors' migrations, so nothing is lost. The problem, and this is reasoning from the
source rather than a documented statement, is that migrations are only *sorted* by version, never
composed: `compareMigrations` is `semver.compare` on the version field and nothing more. Each
migration is written against the source shape the previous major's migrations produce, so a v22
migration running over v20-shaped source may match nothing and report no changes — a silent failure
that looks exactly like success. Refusing the run is cheaper than making every migration Angular
will ever write idempotent across two majors. Angular states the rule on angular.dev but does not
publish this reason; treat the mechanism as an inference.

**★ Is the one-major rule enforced for every dependency in your project?**
No. The guard is inside a test against `ANGULAR_PACKAGES_REGEXP`, which is
`/^@(?:angular|nguniversal)\//`. Everything else — every third-party Angular library, every
component kit with its own migration collection — is unguarded, and a three-major jump on one of
those will be attempted rather than refused. The migration risk is identical; only the safety net
is missing.

**Does `--force` get you past the multi-major guard?**
No. `--force` is scoped to peer dependency mismatches — its own description is *"Ignore peer
dependency version mismatches"* — and the major-version comparison has no bypass flag whatsoever.
The command returns 1 and writes nothing.

**What does the CLI do when the project is on a pre-v6 Angular and you attempt a multi-major
update?**
It prints the same refusal without a suggested command. The source comment gives the reason: before
version 6 the major versions were not sequential — `@angular/core` skipped 3 and `@angular/cli`
skipped 2 through 5 — so `current + 1` is not reliably a version that exists, and the CLI declines
to invent one.

**What state is your project in after the guard fires?**
Untouched. The check runs before the update plan is applied, so `package.json`, the lockfile and
`node_modules` are all exactly as they were, and the process exits 1. That is worth knowing because
it means you can attempt the wrong thing safely and read the error for the right command.

{/* FOOTER */}
