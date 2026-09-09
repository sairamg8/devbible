---
title: "Angular resolves `angularCompilerOptions` inheritance in two places written by different people for different reasons, and the second one — the upgrade migration — cannot follow a base config that is a published package, which is how a project that had opted in gets an opt-out written into it"
sidebar_label: "04d · The second implementation"
sidebar_position: 4.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/core/schematics/migrations/strict-templates-default/index.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/migrations/strict-templates-default/index.ts)
> and
> [`packages/compiler-cli/src/perform_compile.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/perform_compile.ts),
> both read through the GitHub contents API at that tag. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**🔴 Two independent places in the Angular codebase re-implement `angularCompilerOptions`
inheritance, and both explain in a comment why they had to.** That is as strong as source evidence
gets for *this is a genuine, load-bearing quirk and not an incidental detail*. It is also a hazard,
because the two implementations are **not equivalent**: the compiler's resolves `extends` properly,
the migration's does a path join. A workspace whose tsconfig extends a base config published as a
package gets one answer from the compiler and a different one from the tool that rewrites the file.

## Why there are two

The `strict-templates-default` migration needs the same answer the compiler needs — *what is the
resolved `strictTemplates` for this tsconfig?* — and it cannot call the compiler's reader, because a
schematic operates on a virtual `Tree` rather than the filesystem. So it writes the walk again. From
[`strict-templates-default/index.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/migrations/strict-templates-default/index.ts)
at `v22.1.5`, the helper in full:

```ts
function getResolvedAngularCompilerOptions(tree: any, tsconfigPath: string): Record<string, any> {
  if (!tree.exists(tsconfigPath)) return {};

  const sourceFile = ts.readJsonConfigFile(tsconfigPath, (path) => tree.readText(path));
  const config = ts.convertToObject(sourceFile, []);

  let angularOptions = config.angularCompilerOptions || {};

  // Manually resolve inheritance for Angular-specific options.
  // Since the TypeScript API doesn't perform a deep merge of custom/non-standard keys
  // during config parsing, we must traverse the inheritance chain manually
  if (config.extends) {
    // Management extends property...
    const parentPath = join(dirname(tsconfigPath), config.extends);

    const parentOptions = getResolvedAngularCompilerOptions(tree, parentPath);

    // Merge: the options of the current file overwrite those of the parent
    angularOptions = {
      ...parentOptions,
      ...angularOptions,
    };
  }

  return angularOptions;
}
```

The two comments, side by side. The compiler's:

> *"we are only interested into merging 'angularCompilerOptions' as other options like
> 'compilerOptions' are merged by TS"*

The migration's:

> *"Since the TypeScript API doesn't perform a deep merge of custom/non-standard keys during config
> parsing, we must traverse the inheritance chain manually"*

Same finding, arrived at twice.

## The spread order is opposite, and the semantics are identical

The migration writes the obvious spread — `{...parentOptions, ...angularOptions}` — with the comment
*"the options of the current file overwrite those of the parent"*, because here `parentOptions`
really is the extended file's options: the recursion happens *before* the merge, and its result is
spread first.

The compiler achieves the same outcome with the accumulator inverted, spreading `parentOptions`
last, because there `parentOptions` is what the caller already resolved — see
[04b · Reading the merge](04b-reading-the-merge.md).

| | Recursion | Spread | Who wins |
|---|---|---|---|
| `perform_compile.ts` | after the merge, passing the accumulator down | `{...angularCompilerOptions, ...parentOptions}` | the leaf |
| `strict-templates-default` | before the merge, taking the parent's result | `{...parentOptions, ...angularOptions}` | the leaf |

Same semantics, opposite-looking code. 🔴 Show one without the other and a reader concludes the two
disagree — which is exactly the mistake this page exists to prevent.

## Where the two resolvers actually disagree

They are not equivalent, and every difference is the migration choosing simplicity:

| | `perform_compile.ts` (the compiler) | `strict-templates-default` (the migration) |
|---|---|---|
| `extends` as an **array** | normalised and reduced right-to-left | no branch — `config.extends` is passed straight to `join()` |
| `extends` resolution | `getExtendedConfigPath(...)`, a real resolver | `join(dirname(tsconfigPath), config.extends)` — a path join |
| File missing or unresolvable | returns the accumulated options | `if (!tree.exists(tsconfigPath)) return {};` |
| JSON errors | `if (error) return parentOptions;` | `ts.convertToObject(sourceFile, [])` — the second argument is the diagnostics sink, a throwaway array |
| `bazelOptions` fallback | yes, via `??` | no — `config.angularCompilerOptions \|\| {}` |
| Depth | recursive | recursive |

⚠️ What Node's `path.join` does when handed an array rather than a string was not established by the
sources read for this page. What *is* established is that the migration has no array branch, so a
workspace using array `extends` is outside what that helper was written for.

## The consequence: a base config published as a package is invisible

`join(dirname('/tsconfig.app.json'), '@acme/tsconfig-base')` is `/@acme/tsconfig-base` — a path
inside the project, not the package in `node_modules`. `tree.exists` is false, the helper returns
`{}`, and the migration concludes that the chain does not set `strictTemplates`. It then writes
`"strictTemplates": false` into the leaf, and the compiler's merge is child-wins, so that leaf value
now beats whatever the shared base config said.

```jsonc
// tsconfig.app.json — after an upgrade the migration could not reason about
{
  "extends": "@acme/tsconfig-base",
  "angularCompilerOptions": {
    "strictTemplates": false
  }
}
```

Every step of that is in the source: the path join, the `tree.exists` guard, the
`angularOptions['strictTemplates'] !== undefined` skip that consequently does not fire, and the
compiler's child-wins merge. A base config referenced by a **relative** path is followed correctly
and does suppress the write.

The migration itself — what it writes, when it skips, and which files it visits — is
[05c · What the upgrade wrote into your file](05c-what-the-upgrade-wrote-into-your-file.md); the
`ng update` machinery that schedules it is
[04 · 07 The v22 migration inventory](../04-ng-update-not-npm-install/07-the-v22-migration-inventory.md).

## Gotchas

**★ Symptom: after `ng update`, a `strictTemplates: false` appears in a project that inherits
`strictTemplates: true` from a shared base config.** Cause: the migration resolves `extends` with a
path join, so a package-specifier base is not found, `tree.exists` is false, and the helper returns
`{}` — the inherited value is invisible to the guard that would have skipped the file. Fix: delete
the added line and let inheritance work, once you have confirmed the base really does set it:

```jsonc
{
  "extends": "@acme/tsconfig-base",
  "angularCompilerOptions": {}
}
```

**★ Symptom: two Angular tools report different resolved options for the same tsconfig.** Cause:
they are running different resolvers — the compiler's, the migration's, or a third party's own
`ts.parseJsonConfigFileContent` call, which resolves no Angular options at all. Fix: treat the
compiler's answer as authoritative for what gets built, and check any tool that *rewrites* your
config against the compiler's behaviour before trusting its edits.

**Symptom: a base config with a JSON syntax error causes the migration to behave as though the file
were empty, without any warning.** Cause: `ts.convertToObject(sourceFile, [])` is passed a throwaway
diagnostics array, so parse problems are collected into a value nobody reads. Fix: keep base configs
parseable, and read the migration's diff rather than trusting it silently:

```bash
git diff -- '**/tsconfig*.json'
```

**Symptom: you moved to an array `extends` and the migration stopped skipping your project.** Cause:
the migration passes `config.extends` straight to `join()` and has no array branch, so the parent is
not resolved and no inherited value is seen. Fix: for the duration of an upgrade, a single-string
`extends` is the shape both resolvers agree on:

```jsonc
{
  "extends": "./tsconfig.base.json"
}
```

**Symptom: a Bazel-style config's `bazelOptions.angularCompilerOptions` is honoured by the build and
ignored by the migration.** Cause: the compiler falls back to it with
`config.angularCompilerOptions ?? config.bazelOptions?.angularCompilerOptions`; the migration reads
only `config.angularCompilerOptions || {}`. Fix: none at the config level — expect schematics to
disagree with the compiler in that layout, and review anything they write.

**Symptom: you copied the migration's helper into your own tooling and it disagrees with the build.**
Cause: it is deliberately the simpler of the two; it exists to answer one yes/no question about one
key inside a schematic. Fix: for anything that must match the build, call the compiler's
`readConfiguration` from `@angular/compiler-cli` rather than re-deriving the merge.

**Symptom: you reviewed the two spread orders and concluded that a schematic and the compiler
disagree about precedence.** Cause: they do not — the recursion runs on opposite sides of the merge,
so the leaf wins in both. Fix: compare *outcomes*, not spread order; the table above is the
comparison.

## Interview questions

**★ Where else does Angular re-implement the `angularCompilerOptions` merge, and why does that
matter?**
In the `strict-templates-default` schematic, whose comment reads *"Since the TypeScript API doesn't
perform a deep merge of custom/non-standard keys during config parsing, we must traverse the
inheritance chain manually"*. It matters twice over: as evidence that the quirk is real and
deliberate rather than incidental, and because the two implementations are not equivalent. The
migration handles only a string `extends`, resolves it by joining it onto the config's own
directory, and returns `{}` for a file it cannot find — so a base config referenced as a published
package is invisible to it, and it will write an opt-out into a project that had already opted in.

**★ The migration spreads `{...parentOptions, ...angularOptions}` and the compiler spreads
`{...angularCompilerOptions, ...parentOptions}`. Do they disagree?**
No. They mean different things by *parent*. In the migration, the recursion runs first and
`parentOptions` genuinely holds the extended file's options, so the current file is spread last and
wins — the comment says so: *"the options of the current file overwrite those of the parent"*. In
the compiler, `parentOptions` is an accumulator threaded downward that already holds the
descendant's values, so spreading it last also makes the leaf win. Identical semantics, opposite
code.

**How would you detect that an upgrade migration mis-resolved your inheritance chain?**
By reading the diff it produced against what you know the chain says. The signal is a strictness key
appearing in a leaf that already inherited a value for it — the migration only writes when the
resolved value is `undefined`, so a write is a claim that nothing up the chain set it. If your base
config does set it, the resolver did not reach the base config, and the most likely reason is that
`extends` names a package rather than a relative path.

**Why can a schematic not just call the compiler's `readConfiguration`?**
Because a schematic edits a virtual `Tree` — an in-memory overlay of pending changes — rather than
the filesystem, and it must reason about the state of the workspace *as the migration will leave
it*. The compiler's reader is built around a filesystem host. Re-implementing the walk against the
`Tree` is the cheaper of the two ways to bridge that, and the cost is the divergence catalogued
above.

**If you had to make the two implementations agree, what is the minimum change?**
Give the migration's helper a real `extends` resolver — the same job `getExtendedConfigPath` does
for the compiler — so that a package specifier and an array both resolve. The spread order needs no
change; the two already produce the same precedence. Everything else in the divergence table follows
from resolution, not from merging.

{/* FOOTER */}
