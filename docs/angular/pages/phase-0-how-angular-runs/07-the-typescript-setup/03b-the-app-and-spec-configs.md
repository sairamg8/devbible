---
title: "`tsconfig.app.json` and `tsconfig.spec.json` differ in exactly one `compilerOptions` key — `types` — and the empty array in the app config is the single line that makes `describe()` a compile error in application source"
sidebar_label: "03b · The app and spec configs"
sidebar_position: 3.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against `angular/angular-cli` at tag `v22.1.7` —
> [`application/files/common-files/tsconfig.app.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/tsconfig.app.json.template),
> [`application/files/common-files/tsconfig.spec.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/tsconfig.spec.json.template),
> [`application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/schema.json),
> [`application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts).
> Documentation-validated; **no sandbox run** — no workspace was generated and no build was executed.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The two leaf configurations look like they might diverge in all sorts of ways, and they do not: everything about how your code is compiled — target, module, every strictness setting, every `angularCompilerOptions` key — is inherited from the root and identical in both. They differ in exactly one `compilerOptions` key, `types`, plus their file globs. That one key is the answer to a question that cannot be asked per-file: which ambient global declarations may this source file see? `tsconfig.app.json` sets `"types": []`, which switches off automatic inclusion of every `@types/*` package on disk — and that empty array, not any rule of the framework, is why writing `describe()` in `src/app/app.ts` fails to compile. Delete it and the file still builds, tests still pass, and the guard rail is gone with nothing to show for it in any diff a reviewer would flag.**

## `tsconfig.app.json`, exactly as the CLI carries it

`packages/schematics/angular/application/files/common-files/tsconfig.app.json.template` at `v22.1.7`, complete:

```text
/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "extends": "<%= relativePathToWorkspaceRoot %>/tsconfig.json",
  "compilerOptions": {
    "types": []
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "src/**/*.spec.ts"
  ]
}
```

`<%= relativePathToWorkspaceRoot %>` is an EJS substitution, which is why this is fenced as text rather than JSON. For a single-application workspace it resolves to `.`, so the file you get on disk reads `"extends": "./tsconfig.json"`. For an application generated under `projects/my-app/`, it resolves to the path that climbs back out.

Three things are being said, and they are worth taking one at a time.

## `"types": []` — an empty array is not "no opinion"

It is *"include no `@types` packages automatically at all."* Without the key, TypeScript's default behaviour is to pull in every package under `node_modules/@types` and make its global declarations visible to the whole program. In an Angular workspace that set includes the test framework's globals and Node's globals, so without the empty array **`describe`, `it`, `expect` and `process` would all be in scope inside `src/app/app.ts`, and code using them would compile.**

That is the entire mechanism behind a rule most developers experience as a framework behaviour: a stray `describe()` left in application code is a compile error because of one line in one config file, not because Angular knows the difference between application code and test code.

🔴 **This is the highest-value line in the file and the easiest to delete by accident.** It has no visible effect while everything is correct, so removing it — to make an editor stop complaining, or while pasting in a `types` entry for something you genuinely need — produces no failure, no warning, and no test regression. The loss surfaces months later as test-framework globals compiling inside a component, or a `process.env` reference that type-checks locally and is `undefined` in a browser.

If you do need an ambient package in application code, **add it to the array; never empty the array**:

```json
"compilerOptions": {
  "types": ["node"]
}
```

That admits exactly one, and keeps every other `@types/*` package out.

## `include` and `exclude` — the app config deliberately drops the specs

`"include": ["src/**/*.ts"]` is the application's own source, all of it. `"exclude": ["src/**/*.spec.ts"]` is the other half of the split: **spec files are not part of the application program at all.** They are compiled by `tsconfig.spec.json`, with different `types`, and never by the build.

Two consequences follow directly. Anything outside `src/` is invisible to the application build no matter where you import it from — a top-level `shared/` folder is not compiled unless `include` is extended. And any file inside `src/` that is *not* a spec **is** in the application program, whether or not it is reachable from `main.ts`: a leftover scratch file, a `*.stories.ts`, or a helper that only tests use will all be type-checked by the build.

## `tsconfig.spec.json`, exactly as the CLI carries it

`packages/schematics/angular/application/files/common-files/tsconfig.spec.json.template` at `v22.1.7`, complete:

```text
/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "extends": "<%= relativePathToWorkspaceRoot %>/tsconfig.json",
  "compilerOptions": {
    "types": [
      "<%= testRunner === 'vitest' ? 'vitest/globals' : 'jasmine' %>"
    ]
  },
  "include": [
    "src/**/*.d.ts",
    "src/**/*<% if (standalone) { %>.spec<% } %>.ts"
  ]
}
```

Resolved with the v22 defaults — `application/schema.json` declares `"testRunner": {"enum": ["vitest", "karma"], "default": "vitest"}` and `standalone` defaults to `true`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": [
      "vitest/globals"
    ]
  },
  "include": [
    "src/**/*.d.ts",
    "src/**/*.spec.ts"
  ]
}
```

🔴 **`"vitest/globals"` is the v22 default, not `"jasmine"`.** Any page, answer or memory showing `"types": ["jasmine"]` in a v22 spec config is describing a workspace generated with `--test-runner=karma`, or an older CLI. The template can produce either, and it produces exactly one — the ternary picks a single string.

⚠️ **The `standalone` conditional in `include` is genuinely odd.** For a standalone application the glob is `src/**/*.spec.ts`; for `--no-standalone` the `.spec` segment drops out and it widens to `src/**/*.ts` — the *entire* source tree compiled in a program where the test framework's globals are ambient. **No documented reason for this was found**, and it is stated here as an observation about the template rather than as a rationale.

⚠️ `src/**/*.d.ts` appears in the spec config's `include` and not in the app config's. Since the app config includes `src/**/*.ts`, which already matches `.d.ts` files, this looks like belt-and-braces rather than a real difference in which declarations each program can reach — again, an observation, not a rule.

## The three files are a star, not a chain

Both leaves extend the **root**. Neither extends the other, and nothing extends a leaf.

```text
        tsconfig.json          ← every shared compilerOptions,
        /           \            and ALL angularCompilerOptions
       /             \
tsconfig.app.json   tsconfig.spec.json
  types: []            types: ["vitest/globals"]
```

🔴 **So anything you put in `tsconfig.app.json` is invisible to your tests.** A `paths` mapping, a `lib` entry, a strictness override, an `angularCompilerOptions` key — the spec program never sees it, because its `extends` chain does not pass through the app config. Shared configuration has exactly one correct home, and it is the root. How `angularCompilerOptions` in particular merges across `extends` — by a mechanism that is not TypeScript's — is [04 · `angularCompilerOptions` and how it inherits](04-angularcompileroptions-and-how-it-inherits.md).

## Which file each tool is actually pointed at

Nothing scans for these files or guesses. The application schematic writes the build target's config path into `angular.json` explicitly. From `packages/schematics/angular/application/index.ts` at `v22.1.7`:

```ts
          tsConfig: `${projectRoot}tsconfig.app.json`,
```

🔴 **That one line answers "which tsconfig does my build read?"** — the one its target names. The root `tsconfig.json` is never read as a build's entry configuration; it is reached only *through* a leaf's `extends`. Targets, builders and the rest of that file's structure belong to [06 · `angular.json` anatomy](../06-angular-json-anatomy/README.md), and the generated build target specifically to [05c · The build target](../06-angular-json-anatomy/05c-the-build-target.md).

| File | Who reads it | What it uniquely contributes |
|---|---|---|
| `tsconfig.json` | nothing directly — reached via `extends`; plus editors and `tsc -b` via `references` | every shared `compilerOptions` and **all** `angularCompilerOptions` |
| `tsconfig.app.json` | the `build` and `serve` targets, by name, from `angular.json` | `types: []`; includes `src/**/*.ts`; **excludes** `*.spec.ts` |
| `tsconfig.spec.json` | the `test` target | `types: ["vitest/globals"]`; includes `*.spec.ts` and `*.d.ts` |

The `references` column of that table — how the root points at the leaves, and who actually uses those pointers — is [03c · The solution root and project references](03c-the-solution-root-and-project-references.md).

## Gotchas

**★ Symptom: `describe`, `it` or `expect` resolve happily inside `src/app/app.ts` and the file compiles.** Cause: `"types": []` was removed from or edited out of `tsconfig.app.json`, so every `@types/*` package under `node_modules` is auto-included again. Fix — restore the empty array, and if something legitimately needed a type package, name that package instead of removing the guard:

```json
"compilerOptions": {
  "types": []
}
```

**★ Symptom: you set `"strictTemplates": false` in `tsconfig.app.json` to unblock a build, and `ng test` still fails template type-checking.** Cause: `tsconfig.spec.json` extends the **root**, not the app config — the three files are a star. Fix: put anything shared in the root, and put it in a leaf only when you mean *that leaf only*:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": []
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

with `strictTemplates` moved up into the root's `angularCompilerOptions` if it really must be off.

**★ Symptom: a `paths` alias works in the application and not in tests — `Cannot find module '@shared/util'` from a spec.** Cause: the same star shape. `paths` was added to `tsconfig.app.json`, which the spec program does not inherit from. Fix: `paths` belongs in the root, where both leaves see it:

```json
"compilerOptions": {
  "baseUrl": ".",
  "paths": {
    "@shared/*": ["src/app/shared/*"]
  }
}
```

**★ Symptom: you added a top-level `shared/` folder outside `src/`, imported from it, and the build behaves as though the files do not exist.** Cause: `tsconfig.app.json`'s `include` is `src/**/*.ts` and nothing else. Fix — extend the glob rather than moving to a wildcard that would sweep in `node_modules`:

```json
"include": [
  "src/**/*.ts",
  "shared/**/*.ts"
]
```

**★ Symptom: `ng test` can see Node globals and `ng build` cannot, and it feels like a bug.** Cause: it is the design — `types` is the only `compilerOptions` difference between the two leaves, and that is precisely what it is for. Fix: none, unless you genuinely need a type package in application code, in which case add it by name to the app config's array:

```json
"compilerOptions": {
  "types": ["node"]
}
```

**★ Symptom: the spec config says `"types": ["jasmine"]` and you were expecting Vitest.** Cause: the template's ternary picks one string from the `testRunner` option, whose v22 default is `vitest`; `jasmine` means the workspace was generated with `--test-runner=karma`, or by an older CLI. Fix: nothing is wrong — but do not mix the two, because the globals in scope must match the runner actually executing the file:

```json
"compilerOptions": {
  "types": ["vitest/globals"]
}
```

**Symptom: someone deleted `exclude` from `tsconfig.app.json` so the editor would stop reporting errors in spec files, and now every `describe()` in every spec is a compile error.** Cause: removing the exclusion pulls the specs into the *application* program, which has `types: []` — so the specs are now compiled by the config least able to compile them. Fix: restore the exclusion; the editor problem is a project-references problem and is solved in [03c](03c-the-solution-root-and-project-references.md):

```json
"exclude": [
  "src/**/*.spec.ts"
]
```

**Symptom: a file inside `src/` that no application code imports is still type-checked by `ng build`, and its errors fail the build.** Cause: `include` is a glob over the directory, not a graph walk from `main.ts` — everything under `src/` that is not a spec is in the program. Fix: exclude the file explicitly, or move it out of `src/`:

```json
"exclude": [
  "src/**/*.spec.ts",
  "src/**/*.stories.ts"
]
```

**★ Symptom: you need an ambient declaration in application code — a global type, or a `declare module` for an untyped package — and `"types": []` appears to block it.** Cause: it does not. `types` governs *automatic* inclusion of packages under `node_modules/@types`; it has no effect on `.d.ts` files that your own `include` glob already matches. Fix: put the declaration in `src/`, where `src/**/*.ts` picks it up for the application program and `src/**/*.d.ts` picks it up for the spec program — both see it, and the allowlist stays empty:

```ts
// src/globals.d.ts
declare module 'untyped-legacy-widget';

declare global {
  interface Window {
    __APP_BUILD_ID__: string;
  }
}

export {};
```

**★ Symptom: a test helper that only specs import — `src/testing/mock-store.ts` — is type-checked by `ng build` and shows up in build errors.** Cause: `exclude` names `src/**/*.spec.ts` and nothing else, so a helper that is not literally a spec is part of the application program. Fix: either name the file so the existing exclusion catches it, or extend the exclusion to the folder that holds test-only code:

```json
"exclude": [
  "src/**/*.spec.ts",
  "src/testing/**/*.ts"
]
```

⚠️ If you exclude a folder from the app config, make sure the spec config's `include` still reaches it — `src/**/*.spec.ts` will not match `src/testing/mock-store.ts`, so that glob needs widening too, or the helper ends up in neither program.

**Symptom: in a `--no-standalone` workspace, the whole source tree appears to be compiled with test globals available.** Cause: the `standalone` conditional in the spec template drops the `.spec` segment from the glob, widening `include` from `src/**/*.spec.ts` to `src/**/*.ts`. **No documented reason for this was found**, so treat it as observed behaviour of the v22.1.7 template rather than a rule with intent behind it. Fix, if the widening is unwanted, is to narrow the glob by hand:

```json
"include": [
  "src/**/*.d.ts",
  "src/**/*.spec.ts"
]
```

## Interview questions

**★ Why does an Angular workspace have three tsconfig files instead of one?**
Because application code and test code must see different ambient globals, and `types` is a program-level setting — there is no way to say "these files may see `describe` and those may not" inside a single program. So there are two programs: one for the application, with `"types": []`, and one for the specs, with the test runner's globals. The third file exists to hold everything the two share, which turns out to be almost everything — target, module, all strictness settings and the entire `angularCompilerOptions` object. Stated as an invariant: the leaves differ in exactly one `compilerOptions` key plus their globs, and every other difference you find in a real project was introduced by hand.

**★ What does `"types": []` in `tsconfig.app.json` actually do?**
It disables automatic inclusion of every `@types/*` package found under `node_modules/@types`. That is what keeps test-framework globals and Node globals out of application source, and it is the reason a stray `describe()` in a component file fails to compile. It is worth being emphatic that this is configuration rather than framework behaviour: nothing in Angular knows which of your files are tests. It is also the most dangerous line in the file to delete, because deleting it breaks nothing immediately — the build stays green, the tests stay green, and the only symptom is that a category of mistake stops being caught.

**★ `tsconfig.spec.json` extends the root rather than `tsconfig.app.json`. Why does that matter in practice?**
Because it makes the three files a star and not a chain, so nothing you add to the app config reaches the tests. The two symptoms people actually hit are a `paths` alias that resolves in the application and not in a spec, and a strictness override applied to the app config that leaves `ng test` still failing. The rule that follows is short: shared configuration has exactly one home, the root, and a setting belongs in a leaf only when you specifically mean that one program.

**★ Which tsconfig does `ng build` read, and how does it decide?**
It does not decide — `angular.json` tells it. The application schematic writes `tsConfig: "<projectRoot>tsconfig.app.json"` into the build target, so the config is named explicitly per target, and the `test` target names the spec config the same way. The root `tsconfig.json` is never a build's entry configuration; it is reached only through a leaf's `extends`. This is why "which tsconfig is in effect" is answered by reading `angular.json`, not by reasoning about file names.

**Why is the generated spec config's `types` entry `vitest/globals` rather than `jasmine`?**
Because `testRunner` defaults to `vitest` in v22's application schema, and the template's ternary emits one string or the other from that option. The practical point is that the entry must match the runner actually executing the file — the array is what makes the globals type-check, not what makes them exist at run time, so a mismatch produces either unresolved names or names that type-check and are undefined when the test runs.

**You need `process.env` typing inside application code. What do you change, and what do you not change?**
Add `"node"` to `tsconfig.app.json`'s `types` array. What you do not do is delete the array to "let TypeScript find everything", because that also readmits the test framework's globals into application source and silently removes the check that keeps them out. The general principle: `types` is an allowlist, and the correct edit to an allowlist is always to add an entry, never to remove the list.

---

← Prev: [The three tsconfig files](03-the-three-tsconfig-files.md) · Index: [Topic index](README.md) · Next → [The solution root and references](03c-the-solution-root-and-project-references.md)
