---
title: "The migration checks three separate things before writing, and each guard exists because a different way of already having the setting would otherwise be overwritten"
sidebar_label: "05e · The three guards"
sidebar_position: 5.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/core/schematics/migrations/strict-templates-default/index.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/migrations/strict-templates-default/index.ts),
> [`packages/core/schematics/utils/project_tsconfig_paths.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/utils/project_tsconfig_paths.ts) —
> both read through the GitHub contents API at that tag. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A migration that writes into your files has to be certain it is not undoing a decision you
already made.** `strict-templates-default` gets there with three guards rather than one, because
there are three different ways a project can already have `strictTemplates` — set in the file, set
in an ancestor it extends, or not applicable because the file is not an Angular project's at all.
What the migration writes, and into which files, is
[05c · What the upgrade wrote into your file](05c-what-the-upgrade-wrote-into-your-file.md).

## Three guards, and why each exists

```ts
      if (
        !compilerOptions ||
        typeof compilerOptions !== 'object' ||
        Object.keys(compilerOptions).length === 0
      ) {
        continue;
      }

      const angularOptions = getResolvedAngularCompilerOptions(tree, tsconfigPath);

      if (angularOptions['strictTemplates'] !== undefined) {
        continue;
      }

      if (json.get(['angularCompilerOptions', 'strictTemplates']) === undefined) {
        json.modify(['angularCompilerOptions', 'strictTemplates'], false);
      }
```

- **The `compilerOptions` guard** skips a file that has no meaningful TypeScript configuration of
  its own — missing, not an object, or empty.
- **The resolved-value guard** asks whether the project already has an opinion *anywhere in its
  inheritance chain*, walking `extends` by hand — the resolver, and the ways it diverges from the
  compiler's, are [04d · The second implementation](04d-the-second-implementation.md).
- **The own-key guard** asks whether this particular file already carries the key, which matters
  when a build target and a test target resolve to the same file.

Together: the migration only ever writes into a file that was genuinely relying on the framework's
default.

## The asymmetry, stated plainly

| How the app reached v22 | `strictTemplates` in the project tsconfigs | Effective value |
|---|---|---|
| `ng new` on v22 | **absent** | **`true`** — the compiler's default |
| `ng update` from v21 | **written explicitly as `false`** by the migration | **`false`** |

Both projects are on Angular 22.1.5. Both are "using the defaults" as far as anyone reading the
project's history is concerned. They type-check differently.

## Gotchas

**★ Symptom: a project upgraded from v21 and a project generated fresh on v22 type-check
differently, with no `strictTemplates` visible in either one's history as a decision.** Cause: the
generated project relies on the compiler default of `true`; the upgraded one had `false` written in
by the migration. Fix: read the effective value rather than the file, and treat the written key as a
dated TODO:

```bash
grep -rn 'strictTemplates' --include='tsconfig*.json' .
```

**★ Symptom: you set `strictTemplates: true` in a shared base config and the migration wrote `false`
into a leaf anyway.** Cause: it would not — the resolved-value guard walks `extends` and skips a
file whose project already has an opinion anywhere in its chain. If `false` was written, the base
was not actually reachable from that leaf. Fix: check what the leaf really extends, because the
migration's resolver and the compiler's differ in ways that matter:

```bash
node -p "require('./tsconfig.app.json').extends"
```

**★ Symptom: a tsconfig that is purely a solution root was skipped and you expected it to be
edited.** Cause: the first guard skips any file whose `compilerOptions` is missing, not an object,
or empty — which is exactly what a solution-style root looks like. Fix: expected; the setting
belongs in a file that configures a compilation, not in one that only lists references.

**★ Symptom: the migration was re-run and did not double-write.** Cause: the own-key guard — the
file already carries `strictTemplates`, so `json.modify` is never reached. Fix: none needed; this is
what makes the migration safe to replay with `--migrate-only`.

**★ Symptom: an application and its specs resolve to the same tsconfig and you expected two
writes.** Cause: the build and test paths are de-duplicated, and the own-key guard catches the
second visit regardless. Fix: expected. Where the opt-out lands relative to the app/spec split is
[07e · Where the opt-out goes](07e-where-the-opt-out-goes.md).

## Interview questions

**★ Why does the migration check the resolved value and the file's own key separately?**
Because they answer different questions. Walking `extends` establishes whether the project already
gets a value from somewhere — a base config, a shared preset — in which case writing into the leaf
would silently override a deliberate inherited decision. Checking the file's own key establishes
whether this exact file has already been visited or hand-edited. A single check would miss one of
the two: only the resolved value, and a re-run could double-write; only the local key, and an
inherited `true` would be clobbered with `false`. Two guards, deliberately, and a third that skips
files that do not exist at all.

---

← Prev: [The opt-out is a dated TODO](05d-the-opt-out-is-a-dated-todo.md) · Index: [Topic index](README.md) · Next → [What strictTemplates switches on](06-what-stricttemplates-switches-on.md)
