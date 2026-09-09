---
title: "The update rewrites your whole package.json rather than patching it — it preserves your range operators, silently deletes a duplicated devDependency entry, and re-serialises every line of the file"
sidebar_label: "03b · What it writes to package.json"
sidebar_position: 3.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/update-resolver.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/update-resolver.ts)
> (`applyUpdatePlan` and `updateDependency`, both read in full).
> Documentation-validated; **no sandbox run** — every message and comment below is quoted from the
> source that emits it.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Step 9 of [chunk 03](03-what-ng-update-actually-does.md) is where `ng update` first touches your
disk, and it is `package.json` it touches.** Three of the things it does there surprise people
every time. The file is not patched in place — it is parsed, mutated as an object and re-serialised
whole, which reformats every line of it. A package listed in both `dependencies` and
`devDependencies` loses the `devDependencies` entry without a word. And your range operators are
deliberately preserved, so an update never loosens a pin you did not mean to have. None of these is
a bug; all three are visible in twenty lines of source. What happens *after* the manifest is
written — the `node_modules` wipe, the install, and the rollback that covers only this one file —
is [03c · The install step](03c-the-install-step-and-the-rollback.md).

## Your range operator is preserved

From `applyUpdatePlan` in
[`update-resolver.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/update-resolver.ts):

```ts
const updateDependency = (deps: Record<string, string>, name: string, newVersion: string) => {
  const oldVersion = deps[name];
  const aliasPrefix = 'npm:';

  // If the dependency uses an npm package alias (e.g., "npm:registry-name@version-range"),
  // parse and reconstruct the alias with the new target version while preserving
  // the original alias registry name and any version prefix character (like ^ or ~).
  if (oldVersion.startsWith(aliasPrefix)) {
    …
  } else {
    // Standard dependency formatting, keeping any semantic versioning operator prefix (e.g., ^ or ~).
    const execResult = /^[\^~]/.exec(oldVersion);
    deps[name] = `${execResult ? execResult[0] : ''}${newVersion}`;
  }
};
```

🔴 **Whatever operator you had, you keep.** A `~22.0.0` comes back as a tilde range on the new
version. A pinned `22.0.0` with no operator stays pinned. And an npm alias — the
`"npm:registry-name@version-range"` form — is reconstructed with its original alias name intact.

That is a genuinely thoughtful piece of behaviour and it has a consequence: **`ng update` does not
loosen a pin for you.** A team that pins exact versions deliberately gets exact versions back, and a
team that pinned by accident three years ago stays pinned and keeps wondering why patch releases
never arrive.

## Which section of the manifest gets the update — and what gets deleted

```ts
for (const [name, targetVersion] of plan.packagesToUpdate.entries()) {
  logger.info(`Updating package.json with dependency ${name} to version ${targetVersion}...`);

  if (packageJson.dependencies && packageJson.dependencies[name]) {
    updateDependency(packageJson.dependencies, name, targetVersion);
    if (packageJson.devDependencies) { delete packageJson.devDependencies[name]; }
    if (packageJson.peerDependencies) { delete packageJson.peerDependencies[name]; }
  } else if (packageJson.devDependencies && packageJson.devDependencies[name]) {
    updateDependency(packageJson.devDependencies, name, targetVersion);
    if (packageJson.peerDependencies) { delete packageJson.peerDependencies[name]; }
  } else if (packageJson.peerDependencies && packageJson.peerDependencies[name]) {
    updateDependency(packageJson.peerDependencies, name, targetVersion);
  } else {
    if (!packageJson.dependencies) { packageJson.dependencies = {}; }
    packageJson.dependencies[name] = `^${targetVersion}`;
  }
}
```

Read the `delete` calls. The precedence is `dependencies` → `devDependencies` → `peerDependencies`,
and **each level deletes the package from every lower level**:

| Where the package was | What happens |
|---|---|
| `dependencies` only | updated in place, operator preserved |
| `dependencies` **and** `devDependencies` | updated in `dependencies`; ⚠️ **the `devDependencies` entry is deleted** |
| `devDependencies` only | updated in place, operator preserved |
| `devDependencies` **and** `peerDependencies` | updated in `devDependencies`; the `peerDependencies` entry is deleted |
| `peerDependencies` only | updated in place |
| nowhere | 🔴 **added to `dependencies` with a caret** — even if you would have wanted it in `devDependencies` |

The de-duplication is defensible — a package genuinely should not be in two sections — but it
happens silently, in a diff that also contains a hundred other changes, and a library author who
deliberately lists a package in both `devDependencies` and `peerDependencies` will lose the peer
declaration.

## The whole file is re-serialised

```ts
const eofMatches = packageJsonContent.match(/\r?\n$/);
const eof = eofMatches?.[0] ?? '';
const newContent = JSON.stringify(packageJson, null, 2) + eof;
```

🔴 **`JSON.stringify(packageJson, null, 2)`.** The file is not edited line by line; it is parsed
into an object, mutated, and printed fresh at **two-space indentation**. The only thing carried
across from your original file is the trailing newline, preserved deliberately by that regex.

What that means in practice:

- A repo with a four-space `package.json` gets a whole-file diff on every update.
- Any JSON formatting your linter enforces that differs from `JSON.stringify`'s output — key
  alignment, spacing conventions — is undone.
- Key **order** survives, because `JSON.parse` preserves insertion order for string keys and
  `JSON.stringify` walks them in that order. Formatting is what changes, not arrangement.
- Anything that is not valid JSON — comments in a `.json` file, for instance — was already
  impossible here, so nothing is lost to that.

The fix is to get there first: reformat `package.json` to two-space indentation in its own commit
*before* you upgrade, so the update's diff contains only the update.

## What it announces, and what it never touches

Every package in the plan gets a line before it is written:

```ts
logger.info(`Updating package.json with dependency ${name} to version ${targetVersion}...`);
```

That is your audit trail. Because `packageGroup` can pull in a dozen packages you never named
([chunk 01](01-why-npm-install-is-not-an-upgrade.md)), this is the cheapest way to see the actual
scope of the change *before* reading the diff.

Now read the loop for what is **absent**. It touches `dependencies`, `devDependencies` and
`peerDependencies`, and nothing else. It writes nothing to:

- **`overrides` / `resolutions`** — a pin you put there to force a transitive version stays exactly
  as it was, still naming the old version, and your package manager will still honour it. The CLI
  does not read it and does not warn you about it.
- **`optionalDependencies`** — it is not one of the three branches, so a package declared only
  there falls through to the final `else` and is **added to `dependencies` with a caret** while the
  `optionalDependencies` entry is left in place. The package ends up declared twice.
- **`engines`** — the Node range your project declares for itself is untouched, even though the
  Angular major you just moved to has its own `engines` requirement.
- **`scripts`** — `applyUpdatePlan` never touches them. A *migration* may, in step 12, but that is
  a different mechanism with a different diff.

## Gotchas

**★ Symptom: the `package.json` diff is enormous after an update that changed two version
numbers.** Cause: the file is re-serialised whole with `JSON.stringify(packageJson, null, 2)`, so
any indentation other than two spaces is rewritten everywhere. Fix: normalise first, in its own
commit, so the upgrade diff shows only the upgrade:

```bash
node -e "const fs=require('fs');const p='package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n')"
git commit -am "chore: normalise package.json formatting to two spaces"
```

**★ Symptom: a package silently vanished from `devDependencies` after an update.** Cause: it was
listed in `dependencies` too, and the higher-precedence branch deletes the lower entries. Fix:
de-duplicate deliberately before updating — decide which section it belongs in and remove the other
— rather than discovering the decision was made for you inside a large diff.

**★ Symptom: a library's `peerDependencies` entry disappeared after `ng update`.** Cause: the same
deletion cascade — a package present in both `devDependencies` and `peerDependencies` keeps only the
dev entry. Fix: for a published library this is a real regression in your manifest; check the diff
of `package.json` specifically on any update to a library project, and restore the peer declaration.

**★ Symptom: `ng update` added a package to `dependencies` that should have been a dev
dependency.** Cause: the final `else` branch — a package in the update plan that is in none of the
three sections is added to `dependencies` with a caret. Fix: move it to `devDependencies` yourself
afterwards; the CLI has no way to know which you intended.

**★ Symptom: your `~` ranges are still `~` and you expected the update to widen them.** Cause: the
operator prefix is deliberately preserved. Fix: it is working as designed — if you want caret
ranges, change them yourself; `ng update` will keep whatever it finds.

**★ Symptom: `ng update` reported success and the installed version is still the old one.** Cause:
an `overrides` (npm) or `resolutions` (yarn) entry still pins that package, and the update loop
never touches those sections. Fix: update the override in the same commit — the CLI will not do it
and will not warn you:

```jsonc
// package.json — the entry ng update never looks at
{
  "overrides": {
    "@angular/core": "21.2.23"
  }
}
```

**★ Symptom: a package now appears in both `optionalDependencies` and `dependencies`.** Cause:
`optionalDependencies` is not one of the three branches, so the package matched none of them and
fell through to the final `else`, which adds it to `dependencies`. Fix: delete whichever of the two
you did not intend; nothing in the CLI will reconcile them for you.

**★ Symptom: your project's own `engines.node` range is now narrower than the Angular major you
just moved to requires.** Cause: `applyUpdatePlan` writes dependency versions and nothing else —
your `engines` field is yours. Fix: update it deliberately as part of the upgrade, so CI and
contributors are told about the new floor:

```jsonc
// package.json — yours to maintain; ng update will never touch it
{
  "engines": {
    "node": "^22.22.3 || ^24.15.0 || >=26.0.0"
  }
}
```

## Interview questions

**★ Does `ng update` change your `package.json` formatting?**
Yes, and this catches teams out. The file is parsed, mutated as a JavaScript object and re-emitted
with `JSON.stringify(packageJson, null, 2)`, so the whole file comes back at two-space indentation.
Only the trailing newline is carried across, preserved by an explicit regex. Key order survives
because both `JSON.parse` and `JSON.stringify` preserve insertion order; it is purely the whitespace
that is rewritten. The practical answer is to normalise the file in a separate commit before
upgrading.

**★ A package was listed in both `dependencies` and `devDependencies`. What does `ng update` do?**
It updates the `dependencies` entry, preserving your range operator, and **deletes** the
`devDependencies` entry outright. The same cascade applies one level down: a package in
`devDependencies` and `peerDependencies` keeps only the dev entry. It is a de-duplication that is
arguably correct and definitely silent, and for a library project losing a peer declaration is a
real regression.

**★ Which parts of `package.json` does `ng update` never write to, and why does that matter?**
`applyUpdatePlan` only ever touches `dependencies`, `devDependencies` and `peerDependencies`. It
does not write `overrides` or `resolutions`, `optionalDependencies`, `engines` or `scripts`. Two of
those absences bite. An override pinning an Angular package silently survives the update and keeps
your installed version where it was, with no warning — the update reports success and nothing moved.
And an `optionalDependencies`-only package matches none of the three branches, so it falls through
to the fallback that adds it to `dependencies`, leaving it declared twice.

**Does the update reorder the keys in your manifest?**
No. `JSON.parse` preserves insertion order for string keys and `JSON.stringify` emits them in that
order, so the arrangement of your manifest survives intact. What changes is whitespace: the file
is re-emitted at two-space indentation regardless of what it used before, and only the trailing
newline is carried across from the original bytes.

**How would you audit which packages an update is about to change, before reading the diff?**
Read the `Updating package.json with dependency <name> to version <version>...` lines it prints —
one per package in the plan. That matters because `packageGroup` can pull in a dozen packages you
never named on the command line, so the set that moves is routinely larger than the set you asked
for, and this log is the tool telling you exactly which.

**What happens to a dependency declared with an npm alias?**
It is handled specially and correctly. The updater detects the `npm:` prefix and reconstructs the
alias with the new target version, keeping both the original alias registry name and any operator
prefix. This is one of the few places where the CLI does string surgery rather than a plain
replacement, and the source comment documents it.

---

← Prev: [What `ng update` actually does](03-what-ng-update-actually-does.md) · Index: [Topic index](README.md) · Next → [The install step](03c-the-install-step-and-the-rollback.md)
