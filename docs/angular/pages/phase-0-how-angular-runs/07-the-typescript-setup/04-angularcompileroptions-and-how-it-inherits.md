---
title: "`angularCompilerOptions` is a sibling of `compilerOptions` in the same file and is read by a completely different piece of code — Angular re-implements `extends` by hand for that one key, because TypeScript has never heard of it"
sidebar_label: "04 · angularCompilerOptions inheritance"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options) — and
> `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/perform_compile.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/perform_compile.ts).
> Source read through the GitHub contents API at that tag. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**One JSON file, two option objects, two entirely different merge engines.** `compilerOptions` is
inherited across `extends` by TypeScript, whose rules are specified, documented and stable.
`angularCompilerOptions` is inherited by about twenty-five lines of Angular's own code inside
`readConfiguration`, written precisely because TypeScript has no reason to know the key exists. The
two produce a similar *outcome* — the child wins — by completely different means, and the Angular
one has properties the TypeScript one does not. 🔴 Anyone reasoning about `angularCompilerOptions`
inheritance from the TypeScript handbook is reading the wrong specification, and this page is the
right one.

## Two objects, two readers

angular.dev states the shape in one sentence:

> *"The Angular options object, `angularCompilerOptions`, is a sibling to the `compilerOptions`
> object."*

and then says this about inheritance generally:

> *"A TypeScript configuration can inherit settings from another file using the `extends` property."*

That second sentence is true, and it is the whole problem: it is written about *TypeScript*
configuration, and a reader carries it across to the sibling object without noticing that nothing
in TypeScript is looking at that sibling.

```jsonc
// tsconfig.json — the workspace root. Two siblings, two consumers.
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true
  }
}
```

`tsc` reads the first object and ignores the second. `ngtsc` — the Angular compiler, which
[*is* `tsc` with transformers installed](../01-compiler-with-a-framework-attached/13b-ngc-is-tsc-and-the-typescript-pin.md)
— reads both, but it gets the second one by parsing the file a second time, itself.

## The reader, in full

From `readConfiguration` in
[`perform_compile.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/perform_compile.ts)
at `v22.1.5`, verbatim:

```ts
    const readConfigFile = (configFile: string) =>
      ts.readConfigFile(configFile, (file) => host.readFile(host.resolve(file)));
    const readAngularCompilerOptions = (
      configFile: string,
      parentOptions: NgCompilerOptions = {},
    ): NgCompilerOptions => {
      const {config, error} = readConfigFile(configFile);

      if (error) {
        // Errors are handled later on by 'parseJsonConfigFileContent'
        return parentOptions;
      }

      // Note: In Google, `angularCompilerOptions` are stored in `bazelOptions`.
      // This function typically doesn't run for actual Angular compilations, but
      // tooling like Tsurge, or schematics may leverage this helper, so we account
      // for this here.
      const angularCompilerOptions =
        config.angularCompilerOptions ?? config.bazelOptions?.angularCompilerOptions;

      // we are only interested into merging 'angularCompilerOptions' as
      // other options like 'compilerOptions' are merged by TS
      let existingNgCompilerOptions = {...angularCompilerOptions, ...parentOptions};
      if (!config.extends) {
        return existingNgCompilerOptions;
      }

      const extendsPaths: string[] =
        typeof config.extends === 'string' ? [config.extends] : config.extends;

      // Call readAngularCompilerOptions recursively to merge NG Compiler options
      // Reverse the array so the overrides happen from right to left.
      return [...extendsPaths].reverse().reduce((prevOptions, extendsPath) => {
        const extendedConfigPath = getExtendedConfigPath(configFile, extendsPath, host, fs);

        return extendedConfigPath === null
          ? prevOptions
          : readAngularCompilerOptions(extendedConfigPath, prevOptions);
      }, existingNgCompilerOptions);
    };
```

🔴 **The sentence the whole topic rests on**, verbatim from that source, upstream grammar intact:

> *"we are only interested into merging 'angularCompilerOptions' as other options like
> 'compilerOptions' are merged by TS"*

Note `ts.readConfigFile` in the first line. That call **parses one file**. It does not resolve
`extends`. TypeScript's `extends` resolution happens later, in `parseJsonConfigFileContent`, and it
covers only the options TypeScript knows about. Everything after that line exists to do the same
walk again, for one key.

Also note where the walk *starts*: `readAngularCompilerOptions` is handed a single `configFile` and
climbs **upward** through `extends`. It never descends. A tsconfig that nothing names and nothing
extends is not part of any merge, however carefully its `angularCompilerOptions` is written.

## Where the merged object ends up

The result is spread into the options bag handed to TypeScript, in the same function:

```ts
    const existingCompilerOptions: api.CompilerOptions = {
      genDir: basePath,
      basePath,
      ...readAngularCompilerOptions(configFileName),
      ...existingOptions,
    };

    const parseConfigHost = createParseConfigHost(host, fs);
    const {
      options,
      errors,
      fileNames: rootNames,
      projectReferences,
    } = ts.parseJsonConfigFileContent(
      config,
      parseConfigHost,
      basePath,
      existingCompilerOptions,
      configFileName,
    );
```

**One flat bag.** Angular options and TypeScript options end up in the *same* object. That is why
the compiler later reads `this.options.strictTemplates` and `this.options.strictInputTypes` off the
same `NgCompilerOptions` it reads `strict` from — the two pages that cash that out are
[05 · `strictTemplates` is the default in v22](05-stricttemplates-is-the-default-in-v22.md) and
[06 · What `strictTemplates` switches on](06-what-stricttemplates-switches-on.md).

**The merge runs once per configuration read**, with the top-level config name. The recursion inside
`readAngularCompilerOptions` is the only walk; nothing re-reads the chain per file or per component.

⚠️ How `ts.parseJsonConfigFileContent` combines `existingCompilerOptions` with the file's own
`compilerOptions` is TypeScript's contract, and it was not established by the sources read for this
page. What *is* established is that the Angular options are fully merged before that call, and
arrive as part of its `existingOptions` argument.

## Gotchas

**★ Symptom: you put an Angular option inside `compilerOptions` and nothing happens.** Cause:
`readAngularCompilerOptions` reads exactly two properties of the parsed config —
`config.angularCompilerOptions` and `config.bazelOptions?.angularCompilerOptions`. A key under
`compilerOptions` reaches neither, at any point in the chain. Fix — move it into the sibling object:

```jsonc
{
  "compilerOptions": {
    "strict": true
  },
  "angularCompilerOptions": {
    "strictTemplates": true
  }
}
```

⚠️ Whether TypeScript *additionally* reports the stray key as an unknown compiler option was not
settled by the sources read for this page. The Angular half is certain: it never sees it.

**★ Symptom: a key in `angularCompilerOptions` has no effect at all, and no error is reported.**
Cause: the merge is an untyped object spread with no schema validation of the key set at this
layer. A misspelled key is just another property on the bag; nothing here compares it against a
list of legal names. Fix: check the spelling against
[Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options) — and be
aware that the reference page is not a reliable inventory either, because it documents options that
no longer exist. That drift is catalogued in
[01 · 13e The option surface](../01-compiler-with-a-framework-attached/13e-the-option-surface-and-config-time-diagnostics.md):

```jsonc
{
  "angularCompilerOptions": {
    "strictTemplates": true
  }
}
```

**★ Symptom: a `tsconfig.json` you created and carefully configured is ignored by the build.**
Cause: the walk starts at the config the build target names and climbs through `extends`. A config
that is neither named nor extended is never opened. Fix: put the options in a file that is already
in the chain, or point the target at yours:

```jsonc
// angular.json — the build target names exactly one entry point into the chain
{
  "options": {
    "tsConfig": "tsconfig.app.json"
  }
}
```

**Symptom: a build tool that is not `ng` ignores `angularCompilerOptions` entirely.** Cause: the
merge lives in `@angular/compiler-cli`'s `readConfiguration`. Any tool that calls
`ts.parseJsonConfigFileContent` itself — a bare `tsc`, a bundler plugin, an IDE feature reading the
config directly — gets TypeScript's `extends` handling and nothing else. Fix: there is no
tsconfig-side fix. Route the compile through the Angular builder, or accept that the tool is
type-checking without Angular's options and treat its output as advisory.

**Symptom: an Angular option and a TypeScript option with related names disagree about what is
enabled.** Cause: they are unrelated switches that happen to share the word *strict* and live in
the same file. `compilerOptions.strict` is TypeScript's; `angularCompilerOptions.strictTemplates`
is Angular's; and the CLI's `--strict` schematic flag is a third thing that decides what gets
written into the file in the first place. Fix: name which of the three you mean, every time — the
consequences are the subject of
[05 · `strictTemplates` is the default in v22](05-stricttemplates-is-the-default-in-v22.md).

## Interview questions

**★ Both `compilerOptions` and `angularCompilerOptions` inherit through `extends`. Is it the same
behaviour?**
The outcome rhymes — the child wins in both — but the mechanism is entirely separate.
`compilerOptions` is merged by `ts.parseJsonConfigFileContent`, TypeScript's own well-specified
handling. `angularCompilerOptions` is merged by a recursive helper inside Angular's
`readConfiguration`, whose comment states the split outright: *"we are only interested into merging
'angularCompilerOptions' as other options like 'compilerOptions' are merged by TS"*. TypeScript
does not know the key exists, so nothing in TypeScript's documentation is a source of truth about
how it inherits. The differences that follow from that are real — see
[04b](04b-reading-the-merge.md) and [04c](04c-what-the-shallow-merge-costs.md).

**★ A key in `angularCompilerOptions` is misspelled. What happens?**
Nothing visible. The merge is an untyped object spread with no schema check at that layer, so the
key rides along as an ordinary property and every consumer looking for the correct name finds
`undefined`. That matters more than it sounds, because several Angular options are resolved with
`!== undefined` or `!== false` tests where *absent* means *take the default* — so a typo does not
disable a check, it silently leaves the option at whatever the default is, which in v22 is
increasingly *on*.

**Where do the merged Angular options live once the config has been read?**
In the same flat options object as the TypeScript options. `readConfiguration` builds
`existingCompilerOptions` from `genDir`, `basePath`, the merged `angularCompilerOptions`, and then
any programmatically-supplied options, and hands the whole thing to
`ts.parseJsonConfigFileContent`. That is why the compiler reads `this.options.strictTemplates` off
the same bag it reads TypeScript options from, and why an Angular option name and a TypeScript
option name can never collide safely.

**Which file does the merge start from, and does it ever look downward?**
It starts from the single config file passed to `readConfiguration` — in a CLI workspace, the one
the build target names in its `tsConfig` option — and it only ever climbs `extends`. There is no
mechanism by which a config elsewhere in the repository contributes options to a compilation that
does not reach it through that chain.

**Why does Angular parse the tsconfig twice?**
Because `ts.readConfigFile` parses one file and returns its JSON, without resolving `extends`, and
`ts.parseJsonConfigFileContent` resolves `extends` but only for options it recognises. Neither
call, on its own, produces a merged `angularCompilerOptions`. The first parse feeds Angular's own
recursive walk; the second parse produces the TypeScript half and the file list.

## Where this goes next

How that walk resolves **direction** — why the child wins when the parent is spread last — plus
array `extends` and the two ways a file in the chain contributes nothing without saying so, is
[04b · Reading the merge](04b-reading-the-merge.md). What the merge does to a **nested** option is
[04c · What the shallow merge costs](04c-what-the-shallow-merge-costs.md). And the reason to believe
any of it: Angular implements this walk **twice**, in two places that behave differently —
[04d · The second implementation](04d-the-second-implementation.md).

{/* FOOTER */}
