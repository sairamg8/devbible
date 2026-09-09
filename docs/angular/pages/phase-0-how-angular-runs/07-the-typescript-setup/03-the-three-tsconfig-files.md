---
title: "A default `ng new` writes a root `tsconfig.json` containing neither `\"strict\": true` nor `\"strictTemplates\": true` — the CLI's own test suite asserts both are absent, because `--strict` does not turn strictness on, it declines to turn the defaults off"
sidebar_label: "03 · The three tsconfig files"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against `angular/angular-cli` at tag `v22.1.7` —
> [`packages/schematics/angular/workspace/files/tsconfig.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/tsconfig.json.template),
> [`workspace/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/schema.json),
> [`ng-new/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/ng-new/schema.json),
> [`workspace/index_spec.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/index_spec.ts) —
> and the [TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html),
> "Simple Default Changes". Documentation-validated; **no sandbox run** — no workspace was generated.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Open the `tsconfig.json` of a workspace generated with default options and the most important thing in it is a pair of settings that are not there. There is no `"strict": true` and no `"strictTemplates": true` — yet the project is strict on both counts, because TypeScript 6.0 made `strict` default to `true` and Angular 22.0.0 made `strictTemplates` default to `true`, and the CLI deliberately declines to restate either. The only branch of the template that writes strictness settings at all is the `--no-strict` branch, which writes three of them to turn things off. This is not an accident of templating: the CLI's own test suite asserts, in the strict case, that both keys are `undefined`. Once you have read that assertion, `--strict` stops meaning "make it strict" and starts meaning what it actually means — *do not disable the defaults, and add the four extras that are not covered by them*.**

## Why there are three files and not one

The workspace ships three TypeScript configurations, and they exist to answer one question that cannot be answered per-file: **which ambient global declarations is this source file allowed to see?**

`types` and the `@types` auto-inclusion behaviour it controls are properties of a *program*, not of a file. Application code must not see `describe` and `it`; test code must. So there have to be two programs, which means two configs — `tsconfig.app.json` and `tsconfig.spec.json` — and a third file to hold everything the two have in common, which is the root `tsconfig.json`. [03b · The app and spec configs](03b-the-app-and-spec-configs.md) covers the two leaves and the single option that differentiates them; [03c · The solution root and project references](03c-the-solution-root-and-project-references.md) covers how the root ties them together and why it compiles nothing itself.

This page is about what the root file *contains*, and about the two settings it conspicuously does not.

## The root template, exactly as the CLI carries it

`packages/schematics/angular/workspace/files/tsconfig.json.template` at `v22.1.7`, complete and unmodified:

```text
/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "compileOnSave": false,
  "compilerOptions": {<% if (strict) { %>
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,<% } else { %>
    "strict": false,<% } %>
    "skipLibCheck": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "ES2022",
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false<% if (strict) { %>,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true<% } else { %>,
    "strictTemplates": false<% } %>
  },
  "files": []
}
```

🔴 **That block is fenced as `text` and not as `json` on purpose: it is not valid JSON.** The `<% if (strict) { %>` and `<% } else { %>` markers are EJS template tags, evaluated by the schematic before the file is written. Copying this into a real project produces a parse error, and it is a genuinely easy mistake to make when you have gone looking for "the Angular tsconfig" and landed in the CLI repository.

## The file you actually get

The `strict` option defaults to `true` in both schemas that can reach this template — `workspace/schema.json` and `ng-new/schema.json` each declare `"strict": {"type": "boolean", "default": true}` — so a plain `ng new` takes the first branch of every conditional:

```jsonc
/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "compileOnSave": false,
  "compilerOptions": {
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "ES2022",
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true
  },
  "files": []
}
```

What each of those ten `compilerOptions` keys is for — and which are Angular requirements versus workspace choices you may change — belongs to [09 · TypeScript 6 defaults and the generated options](09-typescript-6-defaults-and-what-ng-new-writes.md). What matters here is the shape: two sibling objects, ten keys in one and three in the other, and `"files": []` at the bottom.

## 🔴 Read what is not there

Neither `"strict": true` nor `"strictTemplates": true` appears anywhere in that file. Both behaviours are nonetheless on, and they arrive from two entirely unrelated places:

**`compilerOptions.strict` comes from TypeScript.** From the TypeScript 6.0 release notes, "Simple Default Changes", verbatim:

> *"The appetite for stricter typing continues to grow, and we've found that most new projects want `strict` mode enabled. If you were already using `"strict": true`, nothing changes for you. If you were relying on the previous default of `false`, you'll need to explicitly set `"strict": false` in your `tsconfig.json`."*

**`angularCompilerOptions.strictTemplates` comes from Angular.** It has defaulted to `true` since 22.0.0, and topic 01 documents the flip and its consequences at Master tier in [14f · `strictTemplates` is on by default](../01-compiler-with-a-framework-attached/14f-what-stricttemplates-actually-switches.md). What that default switches on flag by flag, and what an upgrade migration does about it, are [05 · `strictTemplates` is the default in v22](05-stricttemplates-is-the-default-in-v22.md) and [06 · What `strictTemplates` actually switches on](06-what-stricttemplates-switches-on.md).

Notice how tightly those two decisions are coupled without either file mentioning the other. The CLI can safely omit `"strict": true` **only because** it also pins `typescript` to `~6.0.2` ([01](01-the-typescript-peer-pin.md)), which guarantees the workspace is on a TypeScript where that default holds. A workspace whose TypeScript was dragged backwards would silently lose strictness with no line in any config file changing.

## The CLI's own test suite asserts the omission

This is the strongest evidence in the topic, and it converts "the template happens not to write it" into "the CLI intends not to write it". From `packages/schematics/angular/workspace/index_spec.ts` at `v22.1.7`, both specs verbatim:

```ts
  it('should not add strict compiler options when false', async () => {
    const tree = await schematicRunner.runSchematic('workspace', {
      ...defaultOptions,
      strict: false,
    });
    const { compilerOptions, angularCompilerOptions } = parseJson(
      tree.readContent('tsconfig.json').toString(),
    );
    expect(compilerOptions.strict).toBeFalse();
    expect(angularCompilerOptions.strictTemplates).toBeFalse();
    expect(angularCompilerOptions.strictInputAccessModifiers).toBeUndefined();
    expect(angularCompilerOptions.strictInjectionParameters).toBeUndefined();
  });

  it('should add strict compiler options when true', async () => {
    const tree = await schematicRunner.runSchematic('workspace', {
      ...defaultOptions,
      strict: true,
    });
    const { compilerOptions, angularCompilerOptions } = parseJson(
      tree.readContent('tsconfig.json').toString(),
    );
    expect(compilerOptions.strict).toBeUndefined();
    expect(angularCompilerOptions.strictTemplates).toBeUndefined();
    expect(angularCompilerOptions.strictInputAccessModifiers).toBeTrue();
    expect(angularCompilerOptions.strictInjectionParameters).toBeTrue();
  });
```

🔴 **`expect(compilerOptions.strict).toBeUndefined()` in the `strict: true` case.** A test that asserts a key is *absent* is a test protecting a decision. If someone "helpfully" added `"strict": true` to the strict branch of the template, that spec would fail — which is upstream saying, in the only unambiguous way available, that the omission is the intended output.

Read the two specs side by side and the naming inverts:

| Schematic option | What it writes to `compilerOptions` | What it writes to `angularCompilerOptions` |
|---|---|---|
| `--strict` (**default**) | the four extras; **no `strict` key** | `strictInjectionParameters`, `strictInputAccessModifiers`; **no `strictTemplates` key** |
| `--no-strict` | `"strict": false` | `"strictTemplates": false` |

**The branch that writes strictness settings is the branch that turns strictness off.** `--strict` adds four TypeScript options that the `strict` family does not cover and two Angular options, and otherwise stays silent and lets the defaults stand. `--no-strict` is the one that has work to do: it must explicitly counteract two defaults it does not control.

That the four extras are written in a branch where `strict` is already `true` by default is itself informative — writing them would be pointless if `strict` implied them. They are separate switches that a strict project is expected to want, not members of the `strict` family.

## Three unrelated switches, all called "strict"

Every conversation about this goes wrong in the same place, so disambiguate on first use, every time:

| Name | Whose option | Where it lives | Default | Written by `ng new`? |
|---|---|---|---|---|
| `compilerOptions.strict` | **TypeScript's** | `tsconfig.json` | `true`, since TypeScript 6.0 | only in the `--no-strict` branch, as `false` |
| `angularCompilerOptions.strictTemplates` | **Angular's** | `tsconfig.json` | `true`, since Angular 22.0.0 | only in the `--no-strict` branch, as `false` |
| `--strict` | **the schematic's** | the `ng new` command line | `true` | it *is* the flag; it decides which branch runs |

🔴 **The schematic flag writes neither of the other two in its default state.** That is the single most surprising fact in this topic, and it is the reason a reader can look at a strict, default, brand-new workspace and conclude — reasonably, and wrongly — that strictness was never enabled.

## Gotchas

**★ Symptom: you ran `ng new` with defaults, opened `tsconfig.json`, found no `"strict": true`, and concluded the project is not strict.** Cause: `strict` defaults to `true` in TypeScript 6.0 and the CLI declines to restate it; the CLI's own spec asserts the key is `undefined`. Fix: nothing is broken — but if your team wants the setting to be *visible* rather than merely *true*, adding it is harmless and self-documenting:

```json
"compilerOptions": {
  "strict": true,
  "noImplicitOverride": true,
  "noPropertyAccessFromIndexSignature": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

**★ Symptom: a project generated with `--no-strict` was "made strict" by setting `"strict": true`, and templates are still not type-checked.** Cause: `--no-strict` writes **three** things across two objects, and flipping the TypeScript one leaves the Angular one in place. Fix: remove `strictTemplates: false` as well — and add the two extras the strict branch would have given you:

```json
"compilerOptions": {
  "strict": true
},
"angularCompilerOptions": {
  "enableI18nLegacyMessageIdFormat": false,
  "strictInjectionParameters": true,
  "strictInputAccessModifiers": true
}
```

with `"strictTemplates": false` deleted outright rather than set to `true` — deleting it restores the framework default and leaves one fewer thing to maintain when the default next moves.

**★ Symptom: an upgraded project has `"strictTemplates": false` in a file nobody on the team edited.** Cause: this is not the `ng new` template — an upgrade migration wrote it, so that a project which built before the default flipped still builds after. Fix: the line is a deferral, not a decision. Delete it and fix the errors that appear, on a branch, deliberately. [14g · What turning it off costs](../01-compiler-with-a-framework-attached/14g-what-turning-strict-templates-off-costs.md) is the argument for doing so, and [05 · `strictTemplates` is the default in v22](05-stricttemplates-is-the-default-in-v22.md) covers the migration itself.

**★ Symptom: `"strictTemplates": false` is in the file and nobody can say whether it was generated that way or written by an upgrade.** Cause: the `--no-strict` branch of the template and the v22 upgrade migration produce the *same line*, and the file does not record which wrote it. Fix: read the neighbours, because the two origins have different fingerprints. A `--no-strict` generation also wrote `"strict": false` and omitted both extras:

```json
"compilerOptions": {
  "strict": false
},
"angularCompilerOptions": {
  "enableI18nLegacyMessageIdFormat": false,
  "strictTemplates": false
}
```

A migration into a workspace that was generated strict leaves the two extras in place and no `"strict": false` anywhere:

```json
"angularCompilerOptions": {
  "enableI18nLegacyMessageIdFormat": false,
  "strictInjectionParameters": true,
  "strictInputAccessModifiers": true,
  "strictTemplates": false
}
```

The second shape is a project that *was* strict and was stepped back one setting by an upgrade — which is the one worth putting on a backlog.

**★ Symptom: your `tsconfig.json` contains keys this template does not write, or is missing ones it does.** Cause: a generated file is a snapshot of the CLI that produced it, and nothing rewrites it afterwards except explicit migrations. A workspace generated three majors ago carries three-majors-ago's template — including options that no longer exist, such as `fullTemplateTypeCheck`, which [14g](../01-compiler-with-a-framework-attached/14g-what-turning-strict-templates-off-costs.md) records as gone in v22. Fix: diff against the current template deliberately rather than assuming your file is what `ng new` produces today, and delete options that no longer have a meaning:

```json
"angularCompilerOptions": {
  "enableI18nLegacyMessageIdFormat": false,
  "strictInjectionParameters": true,
  "strictInputAccessModifiers": true
}
```

**★ Symptom: you copied the tsconfig out of the Angular CLI repository and TypeScript reports a parse error near the first `{` of `compilerOptions`.** Cause: you copied `tsconfig.json.template`, and `<% if (strict) { %>` is an EJS tag, not JSON. Fix: take the resolved output above, not the template — the template is source code for a generator and never valid on its own.

**★ Symptom: you added `strictTemplates` to `compilerOptions` and it had no effect.** Cause: `compilerOptions` and `angularCompilerOptions` are two sibling objects read by two different consumers. Angular reads only the second one; a key in the first is invisible to it. Fix — the key has to be in the Angular object:

```json
"compilerOptions": {
  "target": "ES2022"
},
"angularCompilerOptions": {
  "strictTemplates": true
}
```

⚠️ Whether TypeScript itself complains about the unrecognised key in `compilerOptions` is a TypeScript behaviour this page does not settle; do not rely on getting a warning.

**Symptom: the team's shared "strict" checklist includes options that are already on, and disagreements follow about whether the project is strict.** Cause: three unrelated switches share the word, and two of them are defaults that were never written down. Fix: settle it against the file rather than against memory — the three-row table above is the whole surface, and the only authoritative statement about the *effective* configuration is what the compiler resolves, not what the file says.

**Symptom: someone removed the four extra options because "`strict` covers those".** Cause: it does not — they are written in a branch where `strict` is already `true`, which is only sensible if `strict` does not imply them. Fix: put them back. They are the part of `--strict` that is genuinely additive:

```json
"compilerOptions": {
  "noImplicitOverride": true,
  "noPropertyAccessFromIndexSignature": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

**Symptom: a workspace was generated strict, and then someone pinned TypeScript backwards to an older major to "match another repo".** Cause: `"strict": true` is not in the file, so strictness is inherited from the TypeScript default — a TypeScript predating that default silently turns it off, with no config change to review. Fix: keep the pin at the CLI's range ([01](01-the-typescript-peer-pin.md)); if a downgrade is genuinely required, write `"strict": true` explicitly first so the setting survives the move.

**Symptom: two workspaces in one organisation disagree about strictness and their `tsconfig.json` files look nearly identical.** Cause: the difference is likely a single `"strict": false` or `"strictTemplates": false` left by a `--no-strict` generation years ago, or by a migration. Fix: diff for the *negations*, not for the affirmations — in this template, an absent key means on and a present key very often means off.

## Interview questions

**★ You generate a workspace with default options. Where does `tsconfig.json` say `"strict": true`?**
Nowhere, and that is deliberate. TypeScript 6.0 changed the default of `strict` to `true`, so the CLI's strict branch omits the key entirely and writes only four additional options that `strict` does not cover. The same is true of `strictTemplates`, which has defaulted to `true` in Angular since 22.0.0 and is likewise absent. The only branch of the template that writes strictness keys is `--no-strict`, which writes `"strict": false` and `"strictTemplates": false` to counteract the two defaults. A good answer names the two independent sources of the defaults — TypeScript's release and Angular's release — because they are not one decision.

**★ How would you prove the omission is intentional rather than a template oversight?**
The CLI's own workspace spec asserts it. In the `strict: true` case it asserts `expect(compilerOptions.strict).toBeUndefined()` and `expect(angularCompilerOptions.strictTemplates).toBeUndefined()`, and in the `strict: false` case it asserts both are `false`. A test that fails when a key is *added* exists specifically to protect the absence, so anyone who "fixed" the template by writing `"strict": true` into it would break the build. This is a good general technique to be able to describe: when documentation is silent about intent, upstream's test suite is often the place where intent is written down unambiguously.

**★ What does `--strict` actually do, then?**
It selects a branch. In its default state it adds four TypeScript options — `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch` — and two Angular options, `strictInjectionParameters` and `strictInputAccessModifiers`, and otherwise leaves the defaults alone. `--no-strict` is the branch that does the writing: `"strict": false`, `"strictTemplates": false`, and the two Angular extras dropped. So the flag's honest name would be closer to *"do not disable the defaults, and add the extras"* than to *"turn strictness on"*.

**★ Why does `--no-strict` produce more configuration than `--strict`?**
Because defaults only need restating when you are contradicting them. Both `strict` and `strictTemplates` are on by default, from TypeScript and from Angular respectively, so the strict branch has nothing to say about them and the non-strict branch has to override both. This inversion — the permissive option generating more configuration than the safe one — is a good general signal to look for when reading any generator's output: the settings that appear are usually the ones fighting a default.

**A colleague says "Angular projects are strict by default, so we do not need to check." What is the precise version of that statement?**
That *newly generated* projects are strict by default, because the schematic's `strict` option defaults to `true` and neither underlying default is disabled. It says nothing about a project generated with `--no-strict`, and nothing about a project that was upgraded rather than generated — an upgrade migration can write `"strictTemplates": false` into a config precisely so that an existing project keeps building. The general rule is that a framework default tells you about new projects, and only the file tells you about this one.

**Which of the three "strict" switches would you expect to find in `angular.json` rather than `tsconfig.json`?**
None of them at generation time — the schematic's `--strict` is a command-line option consumed when the workspace is created, not a persisted setting, and the other two are TypeScript and Angular compiler options that live in `tsconfig.json`. The nuance worth knowing is that a schematic's default *can* be persisted in `angular.json`'s schematics defaults block, which [13h · Schematics and generator defaults](../06-angular-json-anatomy/13h-schematics-and-generator-defaults.md) covers — so the value used by a future `ng generate` is configurable even though the flag itself leaves no trace in the tsconfig.

---

← Prev: [Why the pin is one minor wide](02-why-the-pin-is-one-minor-wide.md) · Index: [Topic index](README.md) · Next → [The app and spec configs](03b-the-app-and-spec-configs.md)
