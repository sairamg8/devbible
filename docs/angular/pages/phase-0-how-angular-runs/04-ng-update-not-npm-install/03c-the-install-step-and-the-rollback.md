---
title: "The install step deletes node_modules on npm and forces the install past npm's own peer resolution — and when it fails, the rollback restores package.json and nothing else"
sidebar_label: "03c · The install step"
sidebar_position: 3.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts)
> (the two install tasks and the `catch` that restores the manifest),
> [`.../update/utilities/cli-version.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/cli-version.ts)
> (the npm 7 force decision, comment quoted verbatim).
> Documentation-validated; **no sandbox run** — every message below is quoted from the source line
> that emits it. ⚠️ One behaviour on this page is **explicitly unexplained by the source**; it is
> flagged where it appears.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Step 10 is the one that can leave a mess.** Two tasks run in sequence — `Cleaning node modules
directory` and `Installing packages` — and the first is destructive while the second is the one most
likely to fail. If it does, a `catch` restores `package.json` to its original bytes and prints
`Restored package.json to its original state.`, which reads reassuringly and covers exactly one
file. `node_modules` is already gone. The lockfile is in whatever state the failed install left it.
`ng update` is **recoverable**, not transactional, and the difference is worth understanding before
you need it rather than during.

## `node_modules` is deleted, but only for npm

```ts
{
  title: 'Cleaning node modules directory',
  skip() {
    return packageManager.name !== 'npm'
      ? 'Cleaning not required for this package manager.'
      : false;
  },
  async task(_, task) {
    try {
      await fs.rm(path.join(commandRoot, 'node_modules'), {
        force: true, recursive: true, maxRetries: 3,
      });
    } catch (e) {
      assertIsError(e);
      if (e.code === 'ENOENT') {
        task.skip('Cleaning not required. Node modules directory not found.');
      }
    }
  },
},
```

Two skip messages, exact: **`Cleaning not required for this package manager.`** and **`Cleaning not
required. Node modules directory not found.`**

Three details in that task body:

- **`recursive: true, force: true`** — the whole tree goes, and a missing directory is not an error.
- **`maxRetries: 3`** — the removal is retried. The source gives no reason for the retries, so treat
  it as an allowance for transient failures rather than assuming which ones.
- **The path is `commandRoot`**, the workspace root — not every `node_modules` in a monorepo.

⚠️ **The source states the npm-only behaviour and does not explain it.** There is no comment beside
the skip condition and no documentation page giving a reason why npm needs a wipe while pnpm and
yarn do not. The honest position is to describe the behaviour and decline to invent a rationale.

## npm 7 and later gets `--force`, and *that* one is explained

From
[`cli-version.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/cli-version.ts):

```ts
// npm 7+ can fail due to it incorrectly resolving peer dependencies that have valid SemVer
// ranges during an update. Update will set correct versions of dependencies within the
// package.json file. The force option is set to workaround these errors.
if (packageManager.name === 'npm') {
  const version = await packageManager.getVersion();
  if (semver.gte(version, '7.0.0')) {
    if (verbose) {
      logger.info('NPM 7+ detected -- enabling force option for package installation');
    }
    return true;
  }
}
```

The argument in that comment is worth internalising. The CLI has *already* resolved a correct set
of versions — that is what steps 7 and 8 were for — and written them into `package.json`. npm's own
peer resolution is therefore redundant work that can only produce a false negative on a tree the CLI
already knows is coherent. Forcing past it is not recklessness; it is declining to solve the same
problem twice with a worse solver.

🔴 **This is a different `--force` from the `ng update --force` flag.** That one is documented as
*"Ignore peer dependency version mismatches"* and applies to the CLI's own peer gate in step 8. The
one above is passed to npm, automatically, whether or not you asked. Confusing the two leads people
to believe `ng update` always skips peer validation, which it does not.

`--verbose` is what makes it visible: **`NPM 7+ detected -- enabling force option for package
installation`**.

## The rollback, and what it does not restore

```ts
} catch (e) {
  if (originalPackageJsonContent !== undefined) {
    try {
      await fs.writeFile(packageJsonPath, originalPackageJsonContent, 'utf8');
      logger.info('Restored package.json to its original state.');
    } catch (restoreError) {
      assertIsError(restoreError);
      logger.error(`Failed to restore package.json: ${restoreError.message}`);
    }
  }

  if (e instanceof CommandError) {
    return 1;
  }

  throw e;
}
```

Messages, exact: **`Unable to install packages`** (the thrown `CommandError`),
**`Restored package.json to its original state.`** and
**`Failed to restore package.json: <message>`**.

🔴 **The rollback restores `package.json`. That is the entire scope of it.** After a failed install
you are left with:

| | State after a failed install |
|---|---|
| `package.json` | ✅ restored to its exact original bytes, from the in-memory backup taken in step 9 |
| `node_modules` | ❌ **already deleted**, if you are on npm |
| the lockfile | ❌ **modified** by the failed install, in whatever state it reached |

Note also the two exit paths. A `CommandError` — the ordinary "install failed" case — returns 1
quietly. Anything else is re-thrown, so an unexpected fault still surfaces with a stack rather than
being swallowed by the recovery path.

The recovery is two lines of git, which is the second reason step 0's clean-tree requirement
matters: git *is* the recovery mechanism for everything the rollback does not cover.

```bash
git checkout -- package-lock.json    # or yarn.lock / pnpm-lock.yaml
npm ci                               # rebuild node_modules from the restored lockfile
```

## Gotchas

**★ Symptom: `Unable to install packages`, and now `node_modules` is gone.** Cause: the cleaning
task ran before the install task, and the rollback covers only `package.json`. Fix: restore the
lockfile from git and reinstall from it:

```bash
git status                            # confirm package.json is back to HEAD
git checkout -- package-lock.json
npm ci
```

**★ Symptom: `Failed to restore package.json: <message>` — the rollback itself failed.** Cause:
the write could not complete; a permissions problem, a read-only mount, or a file lock. Fix: the
manifest is now in the *updated* state with no install behind it, so recover from git rather than
by hand: `git checkout -- package.json package-lock.json && npm ci`.

**★ Symptom: `ng update` feels much slower on npm than on pnpm or yarn.** Cause: the `node_modules`
wipe runs only for npm, so npm reinstalls the entire tree from scratch while the others resolve
incrementally. Fix: nothing to fix; expect it, and do not schedule an upgrade five minutes before a
demo.

**★ Symptom: `npm install` afterwards reports peer conflicts on the tree `ng update` just installed
successfully.** Cause: the update's install ran with `--force` on npm 7+, deliberately, because the
CLI had already computed correct versions. Your later plain `npm install` has no such context. Fix:
resolve the peer complaint properly — usually by updating the complaining library — rather than
adopting `--force` as a habit.

**★ Symptom: you assumed `ng update --force` was what caused npm to skip peer checks.** Cause: two
different forces. `ng update --force` suppresses the CLI's own peer gate in step 8; the npm
`--force` is applied automatically at install time on npm 7+. Fix: keep them separate — a run
without `ng update --force` still forced the npm install.

**★ Symptom: in a monorepo, a sibling package's `node_modules` survived while the workspace's was
wiped.** Cause: the removal targets `commandRoot`, the workspace root, not every `node_modules` in
the repository. Fix: expected, and usually what you want — but it means a stale hoisted tree
elsewhere is not cleaned for you.

**★ Symptom: the update succeeded and CI then failed to reproduce the install from the lockfile.**
Cause: the install ran forced, so the lockfile it produced can encode a tree npm would not choose
unaided. Fix: run `npm ci` locally against the committed lockfile before opening the pull request,
so the reproducibility problem surfaces on your machine rather than in the pipeline.

## Interview questions

**★ If the install step fails, what state is your project in?**
`package.json` is restored to its original bytes, and the command says so —
`Restored package.json to its original state.` Everything else is left as it fell: `node_modules`
has already been deleted if you are on npm, and the lockfile has been modified by the failed
install. The command is recoverable rather than transactional, and the recovery is to check the
lockfile out of git and reinstall. This is a large part of why the clean-tree precondition exists —
git is the only mechanism covering the two things the rollback does not.

**★ Why does the CLI force the install on npm 7 and later?**
Because npm 7 introduced automatic peer-dependency installation and, in the source's words, *"can
fail due to it incorrectly resolving peer dependencies that have valid SemVer ranges during an
update."* The CLI has already resolved a correct set of versions and written them into
`package.json`, so npm's resolution is redundant and can only produce a false failure. With
`--verbose` you see it announce this: `NPM 7+ detected -- enabling force option for package
installation`. It is applied automatically and is unrelated to the `ng update --force` flag, which
suppresses the CLI's own peer gate.

**★ Why does `ng update` delete `node_modules` on npm and not on pnpm or yarn?**
The behaviour is unambiguous — the task's `skip()` returns `Cleaning not required for this package
manager.` for anything that is not npm — but the reason is not stated anywhere. There is no comment
in the source and no documentation page explaining it. The honest answer is to describe the
behaviour precisely and say the rationale is not published, rather than to construct one.

**What does the command do with an error that is not an install failure?**
It re-throws it. The `catch` restores `package.json` unconditionally, then returns 1 only for a
`CommandError`; anything else propagates. So an unexpected fault surfaces with its stack rather than
being flattened into a generic non-zero exit, which matters when you are diagnosing a failure the
CLI did not anticipate.

**Is `ng update` safe to run on an important branch?**
It is safe in the sense that everything before the manifest write is read-only and every failure
after it is recoverable from git — but only if git can recover it, which is why it refuses to start
from a dirty tree. On a branch with committed state and a committed lockfile, the worst case is a
`git checkout` and a reinstall. On a dirty tree with `--allow-dirty`, the worst case is that you
cannot tell your own uncommitted work from the tool's changes.

---

← Prev: [What it writes to package.json](03b-what-it-writes-to-your-project.md) · Index: [Topic index](README.md) · Next → [The option surface](03d-the-option-surface.md)
