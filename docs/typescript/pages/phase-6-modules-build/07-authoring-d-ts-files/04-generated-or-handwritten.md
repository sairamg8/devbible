---
title: "Generated, or written by hand"
sidebar_label: "02 · Generated or hand-written"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** (`declaration`,
> `declarationMap`, `emitDeclarationOnly`, `declarationDir`, `stripInternal`) and
> the compiler's own **option records** — every default and every co-requirement
> below is read out of the installed **TypeScript 5.9.3** option table
> (`optionDeclarations`) and its `verifyCompilerOptions` checks, not recalled.
> **No sandbox, no console blocks.**

The default answer to *"how do I get a `.d.ts`?"* is **you do not write one — you
turn on a flag.** This chunk is the flag, its four companions, and the small set
of cases where hand-writing is genuinely the right call.

## `declaration` — the flag

From the compiler's own option record:

> **`--declaration`** (short name **`-d`**), type `boolean`.
> *"Generate `.d.ts` files from TypeScript and JavaScript files in your
> project."*
> 🔴 Default: **`false` unless `composite` is set.**

That default is worth stating precisely, because it is the source of two
opposite surprises:

- **You turned on `composite` for project references and got declaration emit as
  a side effect.** `composite` requires `.d.ts` output — that is how a referenced
  project is consumed — so it switches `declaration` on for you. Suddenly your
  build reports declaration-emit errors it never reported before, in code you did
  not touch. See **13 · Project references and `tsc -b`** *(not written yet)*.
- **You are publishing a package and shipping no types at all**, because
  `declaration` is off by default and nothing warns you. Nothing in `strict`
  turns it on. The failure is silent, and your consumers see `any`.

What it produces, from the TSConfig reference:

```ts
// src/hello.ts
export let helloWorld = "hi";
```

```ts
// dist/hello.d.ts
export declare let helloWorld: string;
```

Note what happened: the initializer became a type, and `declare` was added.
That is chunk 01's ambient-context rule applied mechanically to your source.

## The four companions

| Option | Default | What it does |
|---|---|---|
| `declarationMap` | `false` | *"Create sourcemaps for `.d.ts` files."* |
| `emitDeclarationOnly` | `false` | *"Only output `.d.ts` files and not JavaScript."* |
| `declarationDir` | — | *"Specify the output directory for generated declaration files."* |
| `stripInternal` | `false` | *"Disable emitting declarations that have `@internal` in their JSDoc comments."* |

🔴 **Three of them require `declaration` — or `composite`.** The compiler's
`verifyCompilerOptions` raises the same diagnostic for each:

> **TS5069:** *"Option '{0}' cannot be specified without specifying option '{1}'
> or option '{2}'."*

…instantiated as `declarationMap` → (`declaration`, `composite`),
`declarationDir` → (`declaration`, `composite`), and `emitDeclarationOnly` →
(`declaration`, `composite`). And one more:

> **TS5053:** *"Option '{0}' cannot be specified with option '{1}'."* —
> `declarationDir` with `outFile`.

### `declarationMap` is the one people leave off and should not

Without it, **go to definition** on a symbol from another package in your
monorepo lands you in `dist/index.d.ts` — a generated file with no bodies, where
you cannot read the implementation or edit anything. With it, the editor follows
the map back to the original `.ts`.

It costs a `.d.ts.map` file per declaration and nothing at runtime. In a monorepo
it is close to mandatory, and the reason is in **12 · Sharing types across a
monorepo** *(not written yet)* — it is the flag that makes "build the package"
feel like "import the source".

⚠️ **The map is only useful if the sources it points at are present.** In a
published npm package, a `.d.ts.map` whose `sources` are not shipped is dead
weight; either ship the sources too or leave the maps out of the package.

### `emitDeclarationOnly` — types from one tool, JavaScript from another

The common modern build splits the job: a bundler (esbuild, swc, Vite, tsup)
transpiles fast and without a type checker, and `tsc` runs alongside purely to
produce `.d.ts`. That is what this flag is for.

```json
{
  "compilerOptions": {
    "declaration": true,
    "emitDeclarationOnly": true,
    "declarationMap": true,
    "outDir": "dist"
  }
}
```

Two consequences of that split worth knowing before you adopt it:

- **The type check is no longer on the critical path of your JavaScript output.**
  Your bundler will happily emit code that does not type-check. If nothing runs
  `tsc` in CI, you have quietly turned type checking off.
- **`allowImportingTsExtensions` becomes available.** The compiler gates it on
  exactly this: *"Option 'allowImportingTsExtensions' can only be used when
  either 'noEmit' or 'emitDeclarationOnly' is set"* (**TS5096**) — because a `.ts`
  specifier in emitted JavaScript would be unloadable. That trade is
  **06 · File extensions** *(not written yet)*'s.

### `declarationDir` — and why you usually do not need it

If `outDir` is `dist`, declarations already land in `dist`. `declarationDir` is
for the case where they should go somewhere else — a `types/` folder a package
manifest points at. Most projects that set it are working around a packaging
decision that would be simpler to change.

## It works on JavaScript too

The option's own description says *"from TypeScript **and JavaScript** files"*.
With `allowJs` and JSDoc annotations, `tsc` will produce declarations for a
plain-JavaScript package — which is how a JS-only library ships real types
without converting a line of source.

⚠️ **The trap is the output path**, and the TSConfig reference names it: *"When
working with `.d.ts` files for JavaScript files you may want to use
`emitDeclarationOnly` or use `outDir` to ensure that the JavaScript files are not
overwritten."* With no `outDir`, emit lands next to the input, and the emitted
`.js` overwrites the source `.js`. Set one or the other before the first run.

## So when *do* you write one by hand?

Four cases, and they are narrower than most codebases assume.

**1 · A dependency that ships no types, and no `@types` package exists.**
The `declare module 'legacy-lib'` shim. This is the most common hand-written
declaration in any repo and it has its own topic — **08 · Typing an untyped
dependency** *(not written yet)*.

**2 · Things that are not code.** `*.css`, `*.svg`, `*.json`, `?raw` imports —
your bundler makes these importable, but `tsc` has never heard of them. A
hand-written module declaration is the only way to teach it. **16 · Typing
non-code imports** *(not written yet)*.

**3 · Globals that exist at runtime but come from nowhere the compiler can see.**
A `<script>` tag, a server-injected `window.__CONFIG__`, a bundler-replaced
`process.env.NODE_ENV`, a test framework's globals. These are `declare global`
and `declare const`, and the mechanics are chunk 05's.

**4 · An API surface you maintain deliberately, decoupled from your source.**
Rare, and rarely a good idea — the moment the hand-written file and the
implementation disagree, the compiler is on the *file's* side and your consumers
get a lie that type-checks. Do this only when the implementation genuinely cannot
express the type: heavy runtime metaprogramming, a `Proxy`-based API, generated
code you do not control.

🔴 **Everything else should be generated.** A hand-written declaration for code
you own is a second source of truth, and it drifts. The generated file is a
projection of the implementation and cannot.

## Reading the generated file is the point

The habit worth building: **treat `dist/*.d.ts` as your API diff.** It is
mechanically derived, it is what consumers actually see, and a change in it is a
change to your public surface — including changes you did not intend, like an
internal type escaping through an inferred return.

```bash
# a review habit, not a build step
git diff -- 'dist/**/*.d.ts'
```

If that diff is large after a change you thought was internal, it was not
internal. `@internal` and `stripInternal` are the tools for pulling the surface
back in, and they are chunk 11.

## Gotchas

**Symptom:** Published package has no types; consumers see `any` everywhere.
**Cause:** `declaration` defaults to `false` and nothing warns you.
**Fix:** Set `"declaration": true` and check that the built `.d.ts` is actually
included in the published files. Packaging is **11 · Publishing a typed package**
*(not written yet)*.

**Symptom:** Turning on `composite` produced a wave of new errors.
**Cause:** `composite` implies `declaration`, and declaration emit surfaces
errors ordinary compilation never needed to raise.
**Fix:** They are real — chunks 08 and 09 are the family of them and their fixes.

**Symptom:** `TS5069: Option 'declarationMap' cannot be specified without
specifying option 'declaration' or option 'composite'.`
**Cause:** A companion flag without the flag it decorates.
**Fix:** Add `"declaration": true` — or `composite`, if you also want project
references.

**Symptom:** `TS5053: Option 'declarationDir' cannot be specified with option
'outFile'.`
**Cause:** `outFile` concatenates into a single output; a separate declaration
directory has no meaning in that layout.
**Fix:** Drop one. In new code, drop `outFile`.

**Symptom:** Your `.js` source files were overwritten by the build.
**Cause:** `allowJs` with `declaration` and no `outDir`, so emit landed on the
inputs.
**Fix:** Set `outDir`, or `emitDeclarationOnly`. Recover the sources from git
before doing anything else.

**Symptom:** Go-to-definition always lands in a bodyless `.d.ts`.
**Cause:** No `declarationMap`.
**Fix:** `"declarationMap": true`, and make sure the sources it points at exist
where the map says.

**Symptom:** The bundler builds fine, CI is green, and production has type
errors.
**Cause:** `emitDeclarationOnly` split the pipeline and nothing runs the checker.
**Fix:** Add an explicit `tsc --noEmit` (or the declaration build) as a CI step.
The bundler is not checking anything.

**Symptom:** A hand-written `.d.ts` describes a function that no longer exists.
**Cause:** Case 4 above — a hand-maintained surface drifting from its
implementation.
**Fix:** Generate it. If you cannot, add a test that imports the module and
exercises the declared surface, so the lie fails somewhere.

**Symptom:** Edits to `dist/index.d.ts` vanish on every build.
**Cause:** It is generated output.
**Fix:** Change the source, or augment the module from your own file.

## Interview questions

**★ How do you produce a `.d.ts` for a package you are publishing?**
`"declaration": true` in `tsconfig.json`, and make sure the output directory is
in the published files with the manifest pointing at it. Add `declarationMap` if
consumers or a monorepo will navigate into it. Hand-writing it is the exception,
not the route.

**★ What is `emitDeclarationOnly` for?**
Splitting the build: a fast transpiler (esbuild/swc/Vite) emits the JavaScript,
and `tsc` runs only to produce declarations. The catch is that type checking is
then off the JavaScript path entirely, so CI has to run the checker explicitly or
you have silently stopped checking.

**★ Why did enabling `composite` suddenly break the build?**
Because `composite` implies `declaration` — the compiler's own default for
`declaration` is *"false unless `composite` is set"*. Declaration emit has to
*name* every exported type, which raises a family of errors (`TS4023`, `TS2742`,
`TS9005`…) that ordinary compilation never needs to.

**When is hand-writing a declaration file the right call?**
Four cases: an untyped dependency, non-code imports, runtime-injected globals,
and an API whose type genuinely cannot be expressed by its implementation.
Anything else you own should be generated, because a hand-written file is a
second source of truth and it drifts.

**What does `declarationMap` actually buy?**
Source maps for declarations, so editors resolve go-to-definition through the
`.d.ts` to the original source instead of stopping at a bodyless generated file.
It matters most in monorepos, where nearly every cross-package jump would
otherwise dead-end.

**Can you generate declarations from JavaScript?**
Yes — the flag's description says "from TypeScript and JavaScript files", and
with `allowJs` plus JSDoc types you get real declarations from a JS-only
codebase. Watch the output path: without `outDir` or `emitDeclarationOnly`, emit
overwrites the input `.js` files.

**Is `declaration` turned on by `strict`?**
No. `strict` is a family of *checking* flags; `declaration` is an *emit* flag and
is unrelated. The only thing that turns it on implicitly is `composite`.

---

← Prev: [03 · The three declaration spaces](./03-the-three-spaces.md) · Next → [05 · Module or global](./05-module-or-global.md)
