---
title: "Three more rules decide what actually gets installed — a pnpm catalog `ng update` refuses to touch, a deprecated version it installs anyway rather than fail, and a minimum release age it honours if something configures it"
sidebar_label: "05b · What else shapes the plan"
sidebar_position: 5.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/update-resolver.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/update-resolver.ts).
> The catalog error, the deprecation fallback and `isReleaseAgeSatisfied` are quoted verbatim.
> Documentation-validated; **no sandbox run**. 🔴 **Where `minReleaseAge` is configured from is
> stated here as unknown rather than guessed** — see the note in that section.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The peer gate decides whether the plan is allowed to proceed. Three other rules decide what the
plan contains.** They are unrelated to each other and share a page because they share a
consequence: each one produces an outcome that looks like a bug the first time you meet it — a
command that refuses to edit your versions, an install of a package npm has marked deprecated, and a
new release the CLI declines to pick up. All three are deliberate.

## `catalog:` — the one case where `ng update` hands the job back to you

pnpm workspaces and Yarn 4 let a monorepo declare dependency versions once, centrally, and have
every package reference them as `catalog:`. `ng update` cannot edit that, and rather than guessing,
it stops and tells you exactly what to do instead:

```ts
throw new Error(
  `The following packages to update are configured to use \`catalog:\`:\n` +
    `${updatesList}\n\n` +
    `Because catalogs are shared across the monorepo, 'ng update' cannot modify them directly.\n` +
    `Please perform the following steps to update:\n` +
    `  1. Manually update the versions for these packages in your catalog configuration file ` +
    `(e.g., pnpm-workspace.yaml or .yarnrc.yml).\n` +
    `  2. Run '${installCmd}' to install the updated versions.\n` +
    `  3. Run the following command(s) from the workspace root to execute the migration schematics:\n` +
    `${migrationCommands}`,
);
```

and the command it builds for step 3:

```ts
const fromVer = pkg.current === 'unknown' ? '<current-version>' : pkg.current;
return `  ng update ${pkg.name} --migrate-only --from ${fromVer}`;
```

🔴 **This is the canonical answer to "how do I upgrade Angular in a pnpm-catalog monorepo": you do
the version half, and you hand the migration half back to `ng update --migrate-only --from`.** The
two halves of the command ([03 · What `ng update` actually does](03-what-ng-update-actually-does.md))
come apart cleanly here, which is exactly why `--migrate-only` exists.

Worked, for a v21 → v22 move on pnpm:

```yaml
# pnpm-workspace.yaml — step 1, by hand
catalog:
  '@angular/core': ^22.1.5
  '@angular/common': ^22.1.5
  '@angular/compiler': ^22.1.5
  '@angular/platform-browser': ^22.1.5
  '@angular/router': ^22.1.5
  '@angular/forms': ^22.1.5
  '@angular/cli': ^22.1.7
  '@angular/build': ^22.1.7
```

```bash
# step 2
pnpm install

# step 3 — from the workspace root, one command per package, naming where you came from
ng update @angular/core --migrate-only --from 21.2.23
ng update @angular/cli  --migrate-only --from 21.2.23
```

⚠️ **Step 1 is where the "one major at a time" rule stops being enforced for you.** Nothing checks
your hand-edited catalog, so the guard described in
[02 · One major at a time](02-one-major-at-a-time.md) cannot fire. Editing `21` to `23` in a YAML
file is a two-major jump that no code will refuse — and the migrations you then replay are the ones
for a ladder you did not climb.

⚠️ **Note `'<current-version>'` in the generated command.** When the CLI cannot determine what you
were on, it emits that literal placeholder rather than a number. If you paste the suggested command
unchanged, it fails; the value you need is the version *before* your catalog edit, so read it out of
git rather than out of the working tree:

```bash
git show HEAD:pnpm-workspace.yaml | grep '@angular/core'
```

## Deprecated versions are avoided, then installed anyway

Version selection prefers a non-deprecated release and falls back rather than failing:

```ts
const sorted = semver.rsort(candidates);

for (const version of sorted) {
  const manifest = await registryClient.getManifest(metadata.name, version);
  if (manifest && !manifest.deprecated) {
    return version;
  }
}

// Fallback to deprecated versions if no non-deprecated version satisfies
for (const version of sorted) {
  const manifest = await registryClient.getManifest(metadata.name, version);
  if (manifest) {
    return version;
  }
}
```

Two passes over the same sorted candidate list, the second without the deprecation test. The
behaviour is: **highest satisfying non-deprecated version if one exists, otherwise highest
satisfying version, deprecated or not.**

This is not hypothetical in v22. Several packages in the Angular tree carry npm deprecation notices
while remaining the only thing that satisfies their range — `@angular/platform-browser-dynamic` and
`@angular-devkit/build-angular` among them. When `ng update` installs one of those, it is this
fallback firing, not an oversight.

⚠️ **A deprecation notice is metadata, not a broken package.** The fallback is the right call — the
alternative is a command that cannot upgrade a project which depends, however indirectly, on
something the maintainers have marked as superseded. What it costs you is the warning: the notice
appears in your package manager's output, not in `ng update`'s.

## A minimum release age, if something sets it

```ts
function isReleaseAgeSatisfied(
  registryClient: RegistryClient,
  metadata: PackageMetadata,
  version: string,
): boolean {
  const minReleaseAge = registryClient.minReleaseAge;
  if (!minReleaseAge || !metadata.time) {
    return true;
  }
  const publishTimeStr = metadata.time[version];
  if (!publishTimeStr) { return true; }
  const publishTime = Date.parse(publishTimeStr);
  if (isNaN(publishTime)) { return true; }
  return Date.now() - publishTime >= minReleaseAge;
}
```

The mechanism is a supply-chain control: a version published more recently than `minReleaseAge` is
not considered, so a compromised release that is caught and unpublished within the window never
reaches you. Note how thoroughly it fails open — no configured age, no `time` map, no entry for this
version, or an unparseable timestamp all return `true`.

🔴 **How `minReleaseAge` is configured is not stated here, because this corpus has not established
it.** It is read off the registry client rather than off any CLI option, which makes an `.npmrc`
key or an npm client setting the plausible sources, but *plausible* is not *verified*. If you need
this control, find out how it is set before relying on it — and be aware that the CLI's silent
fail-open means a misconfiguration is indistinguishable from the feature working.

## Gotchas

**★ Symptom: `Because catalogs are shared across the monorepo, 'ng update' cannot modify them directly.`**
Cause: one or more packages in the update plan resolve through a pnpm or Yarn catalog. Fix: the
three-step recipe the error itself prints — edit the catalog, install, then replay migrations with
`--migrate-only --from`. Do not work around it by converting the catalog entries to literal versions;
you would be undoing the thing the monorepo is for.

**★ Symptom: you pasted the CLI's suggested step-3 command and it failed on `'<current-version>'`.**
Cause: the CLI could not determine the installed version, so it emitted a literal placeholder. Fix:
substitute the version you were on before the catalog edit, read from git rather than from the
working tree, which now holds the new one.

**★ Symptom: `ng update` installed a package npm reports as deprecated.** Cause: no non-deprecated
version satisfied the range, so the second selection pass installed the deprecated one. Fix: this is
correct behaviour and not something to override. Check whether a successor package exists and plan
the migration to it separately — the deprecation notice names it.

**★ Symptom: a catalog monorepo skipped the "one major at a time" guard and the migrations produced
nonsense.** Cause: the guard lives in `ng update`'s version resolution, and in a catalog workspace
you performed that step by hand in YAML. Fix: climb the ladder deliberately — one major per catalog
edit, install and replay migrations at each rung, exactly as
[02b · Running the ladder](02b-running-the-ladder.md) describes for the ordinary case.

**★ Symptom: a release that came out this morning is not picked up, and `npm view` shows it as
`latest`.** Cause: a configured `minReleaseAge` excludes versions younger than the window. Fix:
either wait out the window or find and change the setting — but confirm the setting exists before
concluding that is the cause, because every failure path in that function returns `true` and the
symptom has other explanations.

**★ Symptom: you set a minimum release age and new versions are installed anyway.** Cause: the check
fails open in four separate ways — no configured value reaching the registry client, no `time` map
in the metadata, no entry for that version, or an unparseable timestamp. Fix: none available from
the CLI, which logs nothing when it fails open; verify the setting at the layer that owns it.

## Interview questions

**★ How do you update Angular in a pnpm monorepo that uses catalogs?**
In three steps, because `ng update` will refuse and tell you so. Update the versions by hand in
`pnpm-workspace.yaml` (or `.yarnrc.yml` for Yarn), run the install, then run
`ng update <package> --migrate-only --from <the version you were on>` from the workspace root for
each package that has migrations. The interesting part of the answer is *why* it splits this way:
`ng update` is a version change plus a code change, and a catalog only takes the version half out of
its hands. `--migrate-only` exists precisely so the other half can still be run. The risk to name is
that hand-editing the catalog bypasses the major-version guard, so the discipline of one major at a
time becomes yours to keep.

**★ `ng update` installed a package that npm says is deprecated. Is that a bug?**
No. Version selection makes two passes over the sorted candidates: the first skips anything with a
`deprecated` field, the second does not. So a deprecated version is installed only when nothing else
satisfies the range — which is the situation for a few packages in the Angular tree itself. The
alternative design, failing the update, would mean any project transitively depending on a
superseded package could never upgrade. What you lose is visibility, since the deprecation notice
surfaces in the package manager's output rather than the CLI's.

**What is `minReleaseAge` for, and what should make you cautious about relying on it?**
It is a supply-chain control: versions published within the window are not considered, so a
malicious release caught and unpublished quickly never gets installed. The caution is that
`isReleaseAgeSatisfied` returns `true` on every uncertainty — no configured value, no publish-time
metadata, no entry for the version, an unparseable date — and logs nothing when it does. A
misconfigured minimum release age therefore behaves exactly like a correctly configured one that
happens not to be excluding anything.

**Why does the catalog error exist at all, rather than `ng update` editing the catalog file?**
Because the catalog is shared state for the whole monorepo, and the update plan is scoped to one
workspace's dependencies. Writing the new version into the catalog would change the resolved version
for every package that references it, including ones the command was never asked to touch. Refusing
and printing the recipe keeps a monorepo-wide decision with the human making it.

{/* FOOTER */}
