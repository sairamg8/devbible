---
title: "`ng new --strict` is the branch that writes *fewer* settings — it means \"do not turn the defaults off, and add the two extras\" — while `--no-strict` is the only branch that writes anything about strictness at all"
sidebar_label: "05b · What the CLI writes"
sidebar_position: 5.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** and CLI **22.1.7** — `angular/angular-cli` at tag
> `v22.1.7`:
> [`packages/schematics/angular/workspace/files/tsconfig.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/tsconfig.json.template),
> [`packages/schematics/angular/workspace/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/schema.json),
> [`packages/schematics/angular/ng-new/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/ng-new/schema.json);
> and `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[05](05-stricttemplates-is-the-default-in-v22.md) proved the compiler's default. This page is the
other half: what the schematic actually puts in the file, and why the strict workspace is the one
with fewer lines.** The tsconfig template has exactly one conditional, and reading it backwards is
the fastest way to understand the CLI's posture — `--strict` writes nothing for the two options it
is named after, and `--no-strict` writes three explicit `false`s. On top of that sit two extras the
strict branch adds precisely because the compiler's defaults do **not** cover them.

## The template, with its branch visible

From
[`tsconfig.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/tsconfig.json.template)
at `v22.1.7`, complete. ⚠️ **This is not valid JSON** — `<% if (strict) { %>` is an EJS tag, and
copying this into a project produces a parse error. It is shown to make the branch visible:

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

`strict` defaults to `true` in both
[`workspace/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/schema.json)
and
[`ng-new/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/ng-new/schema.json)
— both declare `"strict": {"type": "boolean", "default": true}` — so the resolved default output is:

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

## `--strict` does not mean "turn strictness on"

| | `--strict` (the default) | `--no-strict` |
|---|---|---|
| `compilerOptions.strict` | **not written** — TypeScript's own default applies | `false`, written explicitly |
| `angularCompilerOptions.strictTemplates` | **not written** — Angular's default applies | `false`, written explicitly |
| `strictInjectionParameters` | `true` | omitted |
| `strictInputAccessModifiers` | `true` | omitted |
| Four `noImplicit*` / `noFallthrough*` TypeScript checks | `true` | omitted |

🔴 So `--strict` means *"do not turn the defaults off, and add the extras."* `--no-strict` is the
branch that actually writes settings about strictness — two `false`s plus the loss of everything in
the left column.

## Why there are two extras, and why they are not symmetrical

`strictInjectionParameters` and `strictInputAccessModifiers` are in the strict branch because the
compiler's defaults do not cover them. They are not the same case, though:

- **`strictInputAccessModifiers`** is explicitly carved out of `strictTemplates`. Its JSDoc in
  `public_options.ts` reads *"Defaults to `false`, even if "strictTemplates" and/or
  "strictInputTypes" is set."* — and inside the compiler's strict branch the corresponding config
  entry is hard-coded `false`. 🔴 **The CLI's line is the only reason a generated workspace checks
  access modifiers on input bindings.** A hand-written tsconfig with `strictTemplates: true` and
  nothing else will not. The carve-out is
  [06 · What `strictTemplates` switches on](06-what-stricttemplates-switches-on.md).
- **`strictInjectionParameters`** is a dependency-injection option, unrelated to template checking.
  It is in the same branch because `--strict` is a workspace-wide posture, not a template setting.

So two applications that both "use the defaults" differ on `strictInputAccessModifiers` if one was
generated by the CLI and the other's tsconfig was written by hand. That is a genuine, reproducible
difference between two projects on the same Angular version with no `false` anywhere in either file.

## Three unrelated things called "strict"

Disambiguate on first use, every time, because all three appear in this one topic:

| Name | What it is | Default | Written into `tsconfig.json`? |
|---|---|---|---|
| `compilerOptions.strict` | a **TypeScript** flag | `true` in TypeScript 6 | only in the `--no-strict` branch, as `false` |
| `angularCompilerOptions.strictTemplates` | an **Angular compiler** option | `true` since Angular 22.0.0 | only in the `--no-strict` branch, as `false` |
| `ng new --strict` | a **schematic** option | `true` | it *is* the branch — it writes neither of the above in its default state |

The schematic flag decides what gets written; the other two decide what the compilers do when
nothing is written. In the default state the schematic one writes neither of the others. That is the
single most surprising fact in this topic.

## Gotchas

**★ Symptom: `ng new --strict` and `ng new --no-strict` produce tsconfigs that differ in a way you
did not expect — the strict one has *fewer* settings about strictness.** Cause: `--strict` writes
nothing for the two options it is named after and adds extras; `--no-strict` writes two explicit
`false`s and drops the extras. Fix: compare against the resolved output above rather than assuming
the flag adds settings. The tell that a workspace is `--no-strict` is a literal `"strict": false`:

```jsonc
{
  "compilerOptions": {
    "strict": false
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictTemplates": false
  }
}
```

**★ Symptom: `strictInjectionParameters` and `strictInputAccessModifiers` are in your tsconfig and
nobody remembers choosing them.** Cause: they are the `--strict` branch's two extras, written by the
workspace schematic. Fix: nothing is wrong — but do not "tidy them away" as redundant. Deleting
`strictInputAccessModifiers` genuinely turns a check off, because `strictTemplates` does not imply
it:

```jsonc
{
  "angularCompilerOptions": {
    "strictInputAccessModifiers": true
  }
}
```

**★ Symptom: a hand-written tsconfig with `strictTemplates: true` behaves less strictly than a
generated one.** Cause: the generated one carries `strictInputAccessModifiers: true`, which
`strictTemplates` does not imply. Fix: copy the whole generated `angularCompilerOptions` block, not
just the option you remembered:

```jsonc
{
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true
  }
}
```

**Symptom: `compilerOptions.strict` is missing from a strict workspace and you add it back "to be
safe".** Cause: TypeScript 6 made it default `true`, so the CLI stopped writing it. Fix: adding
`"strict": true` to a `--strict` project is harmless and redundant; adding it to a `--no-strict`
project silently reverses a deliberate decision. Check which branch generated the file first — the
tell is the literal `"strict": false`.

**Symptom: you copied the tsconfig template out of the CLI repository and the project will not
parse.** Cause: the template contains EJS tags (`<% if (strict) { %>`) and is not JSON. Fix: use the
resolved output above, or generate a workspace and copy from that.

**Symptom: two developers disagree about what "strict mode" means in a code review.** Cause: three
different switches share the word, and one of them is a schematic flag that no longer exists
anywhere in the project once the workspace has been generated. Fix: name the object —
`compilerOptions.strict`, `angularCompilerOptions.strictTemplates`, or the `ng new` flag — every
time, in writing.

**Symptom: you passed `--no-strict` for a migration-in-progress and later cannot tell which settings
were the CLI's and which were yours.** Cause: the branch writes plain values with no marker. Fix:
record the flag in the repository, and annotate the two lines the branch is responsible for:

```jsonc
{
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictTemplates": false
  }
}
```

**Symptom: you removed `"strict": false` from a `--no-strict` workspace expecting a small change and
got a wall of TypeScript errors.** Cause: `compilerOptions.strict` is TypeScript's umbrella flag and
it is default `true` in TypeScript 6, so removing the `false` enables the whole family at once. Fix:
step through the family individually rather than the umbrella, and keep the Angular option separate
— they are unrelated switches that happen to share a word.

## Interview questions

**★ What does `ng new --strict` actually do, given that it is already the default?**
It selects the branch of the tsconfig template that writes *nothing* for `compilerOptions.strict`
and `angularCompilerOptions.strictTemplates`, and instead adds four TypeScript checks
(`noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`,
`noFallthroughCasesInSwitch`) plus `strictInjectionParameters: true` and
`strictInputAccessModifiers: true`. `--no-strict` is the branch that writes settings about
strictness: `strict: false` and `strictTemplates: false`, dropping all six extras. The flag's name
describes the intent, not the mechanism — the strict workspace has fewer strictness lines in its
tsconfig, not more.

**★ Why does the CLI write `strictInputAccessModifiers: true` if `strictTemplates` is already on?**
Because `strictTemplates` does not imply it. Inside the compiler's strict branch the corresponding
config entry is hard-coded `false`, and the option's own JSDoc says *"Defaults to `false`, even if
"strictTemplates" and/or "strictInputTypes" is set."* The CLI's line is the only reason a generated
workspace checks access modifiers on input bindings — a hand-written tsconfig will not, even with
`strictTemplates` explicitly `true`. It is the clearest case in the topic of the *CLI* default and
the *framework* default being different things.

**A teammate says the generated tsconfig is "just the defaults". Is that right?**
Not quite, and the difference is worth naming. Six of its lines are the CLI's opinion, not the
compilers': four TypeScript checks that `strict` does not include, and two Angular options that the
compiler defaults to `false`. Everything else in the file that looks like strictness — the absence
of `strict` and the absence of `strictTemplates` — is the defaults, expressed as silence. So the
generated workspace is *stricter* than a bare tsconfig with the same compilers, by six lines.

**How would you make a hand-written tsconfig match a generated one?**
Copy the whole `angularCompilerOptions` block and the four `noImplicit*`/`noFallthrough*` TypeScript
checks. Do not reason option by option about which are redundant, because the redundancy is not
uniform: `strictTemplates: true` is genuinely redundant, `strictInputAccessModifiers: true` is
genuinely load-bearing, and there is nothing in the file's shape that distinguishes them.

**Why does the CLI write only the negations for `strict` and `strictTemplates`?**
Because writing the positive value pins your project to today's default. If the CLI wrote
`"strictTemplates": true` into every workspace, the value would be indistinguishable from a
deliberate choice — and Angular's own upgrade migration explicitly skips any file where the resolved
value is already defined, so a generated `true` would change how future migrations treat the
project. Silence keeps the project on the framework's default, wherever that moves; see
[05c](05c-what-the-upgrade-wrote-into-your-file.md) for the same logic running in the other
direction.

{/* FOOTER */}
