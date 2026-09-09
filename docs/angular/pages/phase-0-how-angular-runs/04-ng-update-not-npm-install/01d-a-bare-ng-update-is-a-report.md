---
title: "`ng update` with no package names changes nothing at all — it is a read-only report, it can only see packages that opted in, and the command it prints for you deliberately names one major rather than the latest"
sidebar_label: "01d · A bare `ng update` is a report"
sidebar_position: 1.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/update-resolver.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/update-resolver.ts)
> (`printUpdateUsageMessage`),
> [`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts).
> Documentation-validated; **no sandbox run** — every string below is quoted from the source that
> emits it, not from a terminal. There are no transcripts on this page.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Typed with no arguments, `ng update` is the safest command in the Angular toolchain: it installs
nothing, writes nothing and returns zero.** It reads your `package.json`, asks the registry what
each dependency's newest matching version is, and prints a table of what could move together with
the exact command to move it. Two things about that table are worth knowing before you trust it.
It can only see packages that published `ng-update` metadata — everything else is invisible to it,
and the report says so in a sentence most people skim. And the command in the third column is
frequently **not** the command to get to the latest version; when you are more than one major
behind it deliberately names the next major instead.

## The report path, in the source

From `printUpdateUsageMessage` in
[`update-resolver.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/update-resolver.ts):

```ts
if (packagesToUpdate.length == 0) {
  logger.info('We analyzed your package.json and everything seems to be in order. Good work!');
  return;
}

logger.info('We analyzed your package.json, there are some packages to update:\n');
…
logger.info(
  '  ' + ['Name', 'Version', 'Command to update'].map((x, i) => x.padEnd(pads[i])).join(''),
);
…
logger.info(
  `\nThere might be additional packages which don't provide 'ng update' capabilities that are outdated.\n` +
    `You can update the additional packages by running the update command of your package manager.`,
);
```

Three columns — `Name`, `Version`, `Command to update` — and a closing paragraph that is an
apology. Read it again slowly: *"there might be additional packages which don't provide 'ng update'
capabilities that are outdated."* The command is telling you, in the last line of its own output,
that it is not a dependency audit.

## What the report can see, and what it cannot

The filter that builds the table:

```ts
const packagesToUpdate = mappedPackages
  .filter(
    ({ info, version, target }) =>
      target?.['ng-update'] && semver.compare(info.installed.version, version) < 0,
  )
```

Two conditions, both required:

1. **`target?.['ng-update']`** — the *newest* manifest for that package, as fetched from the
   registry, must carry an `ng-update` key. No key, no row. This is the same key
   [chunk 01](01-why-npm-install-is-not-an-upgrade.md) read out of `@angular/core@22.1.5`'s
   published manifest.
2. **`semver.compare(installed, target) < 0`** — the installed version must actually be behind.

🔴 **So `everything seems to be in order` means "no `ng-update`-aware package is behind."** It does
not mean your dependencies are current, and it does not mean they are secure. `lodash`, `rxjs`,
`express`, your design system, your date library — none of them publish `ng-update` metadata, so
none of them can ever produce a row here regardless of how far behind they are. `npm outdated` and
your package manager's audit are separate tools and remain your job.

## The third column, and why it sometimes carries a version

Each row is built by:

```ts
return [name, `${info.installed.version} -> ${version} `, command];
```

and the command string by:

```ts
let command = `ng update ${name}`;
if (!tag) {
  command += `@${semver.parse(version)?.major || version}`;
} else if (tag == 'next') {
  command += ' --next';
}
```

Three outcomes, and the middle one is the interesting one:

| What you see | When | What it means |
|---|---|---|
| `ng update @angular/core` | the resolved target is a plain tag such as `latest` | go straight there |
| `ng update @angular/core@23` | **`tag` was cleared** because the jump is more than one major | 🔴 the report is routing you through an intermediate major |
| `ng update @angular/core --next` | the resolved target came from the `next` tag | you asked for pre-releases |

`tag` is emptied a few lines earlier precisely when the installed major is more than one behind the
latest available. The report therefore does not advise you to jump to `latest`; it advises you to
take **one major**, and the number it prints is the next one, not the newest one. That behaviour is
the same policy the update command enforces with an outright refusal —
[02 · One major at a time](02-one-major-at-a-time.md).

⚠️ This is a place where the printed advice is genuinely load-bearing rather than decorative. A
reader who ignores the `@23` and types `ng update @angular/core` on a v21 project gets the error
rather than the update.

## What it costs to run

The report path hits the registry: it has to resolve each dependency's newest matching version and
read that version's manifest to test for `ng-update`. So it needs network access and it is not
instant on a large `package.json`, but it makes no change to your working tree, holds no lock, and
does not care whether your git status is clean — the clean-tree precondition applies only when
packages are named. That makes a bare `ng update` a reasonable thing to put in a weekly reminder,
a scheduled job, or the first thing you type when picking up an unfamiliar Angular project.

## Gotchas

**★ Symptom: `ng update` says `We analyzed your package.json and everything seems to be in order.
Good work!` while a dependency you can see on npm is three versions behind.** Cause: that
dependency does not publish `ng-update` metadata, so it is filtered out of the report entirely. Fix:
use the package manager for the packages the CLI cannot see — the two tools cover different sets and
neither subsumes the other:

```bash
ng update            # what Angular's migration system can move
npm outdated         # everything else in the manifest
npm audit            # the security dimension, which ng update never reports on
```

**★ Symptom: you copied the command out of the report, ran it, and ended up on a version older than
the one the report's `Version` column showed.** Cause: the `Version` column shows the resolved
target, but the `Command to update` column names the **next major** when you are more than one
behind. They are answering different questions and can legitimately disagree by two majors. Fix:
trust the command column; it encodes the constraint, the version column does not.

**★ Symptom: a bare `ng update` in CI fails or hangs.** Cause: it needs registry access to resolve
targets and read manifests; in an air-gapped or proxied job it has nothing to talk to. Fix: it is a
reporting command, not a build step — run it where the network is, and keep it out of the build
pipeline.

**★ Symptom: the report lists a package with a jump like `19.2.25 -> 22.1.5` and you assume that
is one command.** Cause: the `Version` column is purely informational — installed on the left,
newest resolvable on the right — and says nothing about how many runs it takes to get there. Fix:
read the third column, which will say `@20`, and plan three separate updates. What that ladder
costs is [02 · One major at a time](02-one-major-at-a-time.md).

**★ Symptom: `ng update --next` reports different packages from `ng update`.** Cause: `--next`
changes which dist-tag the target is resolved from — *"Use the prerelease version, including beta
and RCs"* — so packages already at the newest stable release can appear as behind. Fix: expected;
do not use `--next` to decide whether your project is current.

**★ Symptom: nothing about your third-party Angular libraries appears, even though they clearly
support v22.** Cause: publishing `ng-update` is opt-in, and plenty of Angular-ecosystem libraries
never bothered — they have no migrations to run, so they had no reason to. Fix: their absence from
the report carries no information at all, in either direction. Check their release notes.

## Interview questions

**★ What does `ng update` with no arguments actually do?**
Nothing to your project. It reads `package.json`, resolves each dependency's newest matching
version from the registry, keeps only those whose newest manifest carries an `ng-update` key and
whose installed version is behind, and prints a three-column table — name, `installed -> target`,
and the exact command to perform that update. It writes no file, runs no migration, and does not
require a clean git tree.

**★ `ng update` reported that everything is in order. Are your dependencies up to date?**
Unknown, and probably not. The report's filter requires the target manifest to carry `ng-update`
metadata, which almost nothing outside the Angular ecosystem publishes. The command says so itself
in its closing line: *"There might be additional packages which don't provide 'ng update'
capabilities that are outdated."* It is a report on the migration system's coverage, not a
dependency audit.

**★ Why does the command in the report sometimes carry a version number and sometimes not?**
Because the resolver refuses to advise a multi-major jump. When the installed major is more than
one behind the newest, the internal `tag` is cleared and the printed command is built as
`ng update <name>@<major>` naming the *next* major — so the advice routes you through the
intermediate versions rather than at the latest one. When the target came from a plain tag, the
bare command is printed; when it came from the `next` tag, `--next` is appended instead.

**A library in your dependencies never appears in `ng update`'s report. What can you conclude?**
Only that it does not publish `ng-update` metadata, or that it is not behind. You cannot tell which
from the report, and you cannot conclude that it is current. Absence from the table is not evidence
of anything.

**Would you put `ng update` in CI?**
Not the bare form as a gate, no — it needs registry access, its output is advisory, and it exits
zero whether or not there is anything to do, so it cannot fail a build on the condition you care
about. It is useful as a scheduled reporting job whose output a human reads. The *updating* form is
a worse fit still, because optional migrations need a TTY to prompt and will be skipped —
[01c · The CLI's own collection](01c-the-clis-own-collection.md).

---

← Prev: [The CLI's own collection](01c-the-clis-own-collection.md) · Index: [Topic index](README.md) · Next → [One major at a time](02-one-major-at-a-time.md)
