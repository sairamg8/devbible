---
name: research-angular-p0-10-11-12-linker-jit-devmode
description: Banked primary-source research for Angular Phase 0 topics 10 (partial compilation), 11 (JIT vs AOT) and 12 (dev-mode-only behaviour) — verbatim quotes and URLs for every planned chunk.
metadata:
  type: reference
---

# Research bank — Angular Phase 0, topics `10`, `11`, `12`

Researched **2026-09-09** against `angular/angular` at tag **`v22.1.5`**, `angular/angular-cli`
at tag **`v22.1.7`**, `ng-packagr/ng-packagr` at tag **`22.1.1`**, angular.dev,
`registry.npmjs.org`, and the **published `@angular/material@22.1.5` package on the npm CDN**.
**No sandbox was run** — every code block below is *source text read from a repository, a package,
or a documentation page*, never program output.

**Who this is for.** The unwritten chunks of three Phase 0 topics:

| Topic | Directory (proposed) | Tier |
|---|---|---|
| 10 · Partial compilation | `10-partial-compilation/` | <span className="db-tier t-know">Know</span> |
| 11 · JIT vs AOT | `11-jit-vs-aot/` | <span className="db-tier t-know">Know</span> |
| 12 · Dev-mode-only behaviour | `12-dev-mode-only-behaviour/` | <span className="db-tier t-know">Know</span> |

🔴 **Rule for using this bank: if a claim is not in here with a URL, either verify it yourself or
write it as explicitly uncertain.** `## 99 · UNSETTLED` lists what I could not settle, and it is
long on purpose — topic 12 in particular is full of claims that are easy to assert and hard to
prove.

🔴 **All three topics are `Know` tier, not `Master`.** That is a shallower bar than topics 01–03
next door. Bank accordingly: these topics owe the reader *what the thing is, what it looks like in
the wild, and what breaks* — they do **not** owe a second compiler explanation. Topic **01** is the
compiler topic and it is **closed at 86 pages**. §0.5 lists every hand-off.

---

## 0 · Facts every chunk needs

### 0.1 The version spine — re-measured 2026-09-09, do not re-derive

Measured from `registry.npmjs.org` on 2026-09-09. **No drift from the spine the existing pages
carry.** Two additions.

| | |
|---|---|
| `@angular/core` `latest` | **22.1.5** (`next` 22.2.0-next.5) |
| `@angular/cli` / `@angular/build` `latest` | **22.1.7** (`next` 22.2.0-next.6) |
| LTS lines | v21 → 21.2.22 · v20 → 20.3.30 · v19 → 19.2.25 |
| **`ng-packagr` `latest`** | 🔴 **22.1.1** — a *third* number, not 22.1.5 and not 22.1.7 (`next` 22.2.0-next.5) |
| **`@angular/platform-browser-dynamic` `latest`** | 22.1.5, and ⚠️ **npm-deprecated** (§0.3) |
| `@angular/core@22.1.5` peers | `rxjs: ^6.5.3 \|\| ^7.4.0` · `zone.js: ~0.15.0 \|\| ~0.16.0` (**optional**) · `@angular/compiler: 22.1.5` (**optional**) |
| `@angular/platform-browser-dynamic@22.1.5` peers | `@angular/core`, `@angular/common`, **`@angular/compiler`**, `@angular/platform-browser` — all `22.1.5`, **none optional** |
| TypeScript peer (`compiler-cli`, `@angular/build`) | `>=6.0 <6.1` |

Sources: `https://registry.npmjs.org/-/package/@angular/core/dist-tags`,
`https://registry.npmjs.org/-/package/@angular/cli/dist-tags`,
`https://registry.npmjs.org/-/package/@angular/build/dist-tags`,
`https://registry.npmjs.org/-/package/ng-packagr/dist-tags`,
`https://registry.npmjs.org/-/package/@angular/platform-browser-dynamic/dist-tags`,
`https://registry.npmjs.org/@angular/core/22.1.5`,
`https://registry.npmjs.org/@angular/platform-browser-dynamic/22.1.5`.

🔴 **`ng-packagr` is on its own number (22.1.1).** Topic 10 is the first topic in this phase that
has to name it, and writing "22.1.7" there would be wrong. Say **ng-packagr 22.1.1** and do not
attribute it to the CLI's number.

🔴 **`@angular/compiler` is an *optional* peer of `@angular/core` and a *required* peer of
`@angular/platform-browser-dynamic`.** That one line is the whole JIT/AOT packaging story and
topic 11 should lead with it.

### 0.2 The `> Verified:` line to copy (adapt the source list per chunk)

```markdown
> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/…/file.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/…/file.ts),
> `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/build/src/…`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/…),
> and angular.dev [Page title](url).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · ng-packagr **22.1.1** · TypeScript peer `>=6.0 <6.1`.
```

Blob URL shapes, all verified working in this session:

- `https://github.com/angular/angular/blob/v22.1.5/<path>`
- `https://github.com/angular/angular-cli/blob/v22.1.7/<path>`
- 🔴 `https://github.com/ng-packagr/ng-packagr/blob/22.1.1/<path>` — **no `v` prefix.** `v22.1.1`
  404s (`No commit found for the ref v22.1.1`); the bare `22.1.1` resolves. Do not copy the `v`
  habit from the Angular repos.

🔴 **Reading source yourself: `raw.githubusercontent.com` 404s in this environment.** Use
`gh api repos/<owner>/<repo>/contents/<path>?ref=<tag> -q .content | base64 -d`.

For a published package's emitted JavaScript, `https://cdn.jsdelivr.net/npm/<pkg>@<version>/<file>`
works and is a legitimate primary source — it serves the exact bytes in the npm tarball.

### 0.3 🔴 The one thing the dispatch spec gets wrong

The brief for topic 11 says *"where JIT still exists (`TestBed`, `platform-browser-dynamic`)"*.
**`platform-browser-dynamic` is deprecated, and has been for two majors.**

Three independent pieces of evidence, all read this session:

1. **npm.** `registry.npmjs.org/@angular/platform-browser-dynamic/22.1.5` carries a top-level
   `deprecated` string, verbatim:

   > *"@angular/platform-browser-dynamic is deprecated. Use `@angular/platform-browser` instead."*

   This is the message `npm install` prints. It is a *package-level* deprecation, which is stronger
   than a JSDoc tag: every install of every version emits it.

2. **The public-API golden**, `goldens/public-api/platform-browser-dynamic/index.api.md` at
   `v22.1.5` ([link](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/platform-browser-dynamic/index.api.md)),
   in full — the package's *entire* surface is three exports and two of them are deprecated:

   ```ts
   // @public @deprecated (undocumented)
   export class JitCompilerFactory implements CompilerFactory {
       // (undocumented)
       createCompiler(options?: CompilerOptions[]): Compiler;
   }

   // @public @deprecated (undocumented)
   export const platformBrowserDynamic: (extraProviders?: StaticProvider[]) => PlatformRef;

   // @public (undocumented)
   export const VERSION: Version;
   ```

   ⚠️ Per topic 03's `12h-experimental-preview-and-dev-only.md`, a golden's `// @public` is
   API-Extractor's release tag and **not** Angular's stability marker. Here the golden's
   `@deprecated` half is corroborated by npm and by the CHANGELOG, so it is safe to cite — but cite
   the CHANGELOG as the primary and the golden as confirmation, not the other way round.

3. **The CHANGELOG.** From `CHANGELOG.md` at `v22.1.5`, under **`# 20.0.0 (2025-05-28)`**:

   > *"### platform-browser"*
   > *"- All entries of the `@angular/platform-browser-dynamic`"*

   listed under that release's **`## Deprecations`** heading, and in the same release's commit
   table:

   > *"`bc2cab747f` | refactor | Deprecate the `platform-browser-dynamic` package (#61043)"*

   Source: [`CHANGELOG.md`](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md), the
   `20.0.0` section.

**So the date is Angular 20.0.0, 28 May 2025.** The replacement named by npm is
`@angular/platform-browser`, whose golden exports `platformBrowser` with **no** deprecation marker
([`goldens/public-api/platform-browser/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/platform-browser/index.api.md)):

```ts
export const platformBrowser: (extraProviders?: StaticProvider[]) => PlatformRef;
```

🔴 The Phase 0 `README.md` row for topic 11 was **already updated on disk during this session** by
another lane to read *"⚠️ `platform-browser-dynamic` is npm-deprecated at 22.1.5"*. Match that
wording; do not re-derive it and do not soften it.

### 0.4 Vocabulary — six terms these three topics share, fixed here so chunks do not drift

| Term | What it means, exactly | Where it is defined |
|---|---|---|
| **partial compilation** | `compilationMode: 'partial'` — the compiler emits `ɵɵngDeclare*` calls instead of `ɵɵdefine*` | topic 01 `13d`, `12f` |
| **declaration** | one `ɵɵngDeclareX({...})` call: a plain data object describing a class | §10.2 |
| **linking** | converting a declaration into a real definition, at the *consumer's* Angular version | §10.4 |
| **the linker** | `@angular/compiler-cli/linker/babel` — a Babel plugin | §10.4 |
| **AOT** | the compiler runs in the build; templates become instruction calls before shipping | §11.1 |
| **JIT** | the same compiler runs in the browser, from the decorator, at first access of `ɵcmp` | §11.1 |
| **`ngDevMode`** | a *global*, not an import: `null \| NgDevModePerfCounters`, replaced by a constant at build time | §12.1 |

⚠️ **"partial compilation" and "JIT" are the same compiler.** Do not present them as two systems.
`ɵɵngDeclareDirective` in `@angular/core` calls `getCompilerFacade({usage: JitCompilerUsage.PartialDeclaration, …})` —
topic 01's `12f` already establishes this and quotes it. **Link it, do not re-derive it.**

### 0.5 🔴 Hand-offs — where each chunk must link topic 01 rather than re-explain

Topic 01 (`01-compiler-with-a-framework-attached/`, **86 pages, closed**) already owns all of the
following. A chunk in 10/11/12 that explains any of these again is duplicating a Master-tier page
from a Know-tier page, which is the worst possible direction.

| What | Owned by | Which chunk of ours must link it |
|---|---|---|
| Why locality makes separate compilation possible; the `separate_compilation.md` semver quote; the three `compilationMode` values verbatim; the ten `ɵɵngDeclare*` names as a table; `partial.ts`'s `ɵɵngDeclareDirective` body; the `./linker` + `./linker/babel` package exports | `01/12f-partial-compilation-and-the-linker.md` | **10 · 01** and **10 · 04** |
| The five version gates in `NgCompiler`; `angularCoreVersion`; "version skew is designed for, not tolerated" | `01/12g-version-skew-is-a-coded-concern.md` | **10 · 05**, **10 · 07** |
| `compilationMode: 'full' \| 'partial' \| 'experimental-local'` as *compiler options*; the local-portability trap | `01/13d-compilation-mode-and-the-local-portability-trap.md` | **10 · 07** |
| `ɵɵdefineComponent`'s arguments, `decls`/`vars`/`consts`, the `ɵfac`, `ɵɵComponentDeclaration` and the `.d.ts` side | `01/06`, `01/06b`, `01/06c`, `01/06d` | **10 · 02** (the declaration is the *input* to what 06 describes) |
| Ivy/locality itself, `ngtsc` as a TypeScript transformer, the TypeScript `>=6.0 <6.1` pin | `01/12`, `01/13`, `01/13b` | **11 · 01** |
| `@defer`'s `dependencyResolverFn` and the nine conditions | `01/11`–`01/11d` | **12 · 06** (only for `ɵɵngDeclareClassMetadataAsync`) |
| The negative-error-code encoding that decides which errors get a `Find more at …` link | `01/13c-the-ng-error-code-is-a-typescript-code.md`, and topic 03's `§0.7` | **12 · 05** |

Topic **03** (`03-the-provider-array/`) also owns three things ours touch:

| What | Owned by | Ours must |
|---|---|---|
| `provideNgReflectAttributes()` **as an entry in the provider array**; the attributes-are-deprecated-but-the-function-is-not distinction | `03/11g-the-standalone-core-providers.md` and `03/12h-experimental-preview-and-dev-only.md` | **12 · 07** links both and explains the *runtime*, not the array placement |
| Why dev-only code is `if (ngDevMode) {…}` and never an early `return`; the ESBuild comment verbatim | `03/16c-what-a-production-build-tells-you.md` | **12 · 04** quotes it once and links |
| `provideStabilityDebugging()` is **not** stripped from production; `provideCheckNoChangesConfig` collapses to an empty provider set | `03/11g`, `03/12h`, `03/05f` | **12 · 05** names them in a table row each and links |

Topics **04/05/06/07/08/09 are other agents' scope right now.** Where ours touch theirs, write **one
line and a pointer**, not the material:

- `aot` and `optimization` are `@angular/build` **builder options** → topic **05**.
- Where those options live in `angular.json` (`configurations`, `production` vs `development`) → topic **06**.
- `compilationMode` as an `angularCompilerOptions` key in a tsconfig → topic **07**.
- What `ng new` puts in `tsconfig.json` → topic **08**.
- Which Angular versions are still supported (relevant to §10.5's mismatch error) → topic **09**.

Because topics 04–09 do not exist on disk, **write them as bold text plus *(not written yet)***,
never as links. `onBrokenLinks: 'throw'`; one dangling link blocks every lane's deploy.

### 0.6 The four `ng*` globals the CLI defines — the table all three topics share

From `angular/angular-cli` at `v22.1.7`,
[`packages/angular/build/src/tools/esbuild/application-code-bundle.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/esbuild/application-code-bundle.ts),
in `getEsBuildCommonOptions`, verbatim:

```ts
    define: {
      ...options.define,
      // Only set to false when script optimizations are enabled. It should not be set to true because
      // Angular turns `ngDevMode` into an object for development debugging purposes when not defined
      // which a constant true value would break.
      ...(optimizationOptions.scripts ? { 'ngDevMode': 'false' } : undefined),
      'ngJitMode': jit ? 'true' : 'false',
      'ngServerMode': 'false',
      'ngHmrMode': options.templateUpdates ? 'true' : 'false',
    },
```

🔴 **Four facts in nine lines, and each belongs to a different one of our three topics.**

1. **`ngDevMode` is defined only when `optimizationOptions.scripts` is true.** It is *never* defined
   as `true` — the development build leaves it undefined and lets `initNgDevMode()` turn it into an
   object at runtime (§12.1). The comment says exactly why: a constant `true` *"would break"* the
   perf-counter object.
2. **`ngDevMode` therefore tracks `optimization.scripts`, not the configuration name.** A
   `configurations.production` block that sets `"optimization": false` produces a build with
   development semantics; a `development` configuration that turns optimization on produces one
   without them. **Topic 12 must say this; it is the single most commonly assumed-wrong fact in the
   area.**
3. **`ngJitMode` is a separate flag** and it is always defined, both ways. §11.2.
4. **The server bundle sets only `ngServerMode`.** From the same file:

   ```ts
   function getEsBuildServerCommonOptions(options: NormalizedApplicationBuildOptions): BuildOptions {
     const isNodePlatform = options.ssrOptions?.platform !== Platform.Neutral;

     const commonOptions = getEsBuildCommonOptions(options);
     commonOptions.define ??= {};
     commonOptions.define['ngServerMode'] = 'true';
     …
   ```

   🔴 It calls `getEsBuildCommonOptions(options)` and overrides **one** key. So the *server* bundle
   inherits the same `ngDevMode` rule as the browser bundle: `'false'` iff
   `optimizationOptions.scripts`. See §100.2 — three pages in this corpus carry an explicit ⚠️ about
   this precise question and this is the read that settles it.

### 0.7 What the three topics must NOT claim — the honesty floor

There is no sandbox. In particular:

- **Never state a bundle size, a byte delta, or a "the compiler is ~130 kB" number.** angular.dev
  says *"roughly half of Angular itself"* (§11.4) and that sentence, quoted, is the only size claim
  any of these pages may make.
- **Never show a build log, a linker warning as it appears in a terminal, or `ng build` output.**
  The linker's mismatch text is quotable because it is a **string literal in the source** (§10.5) —
  present it as a source quote, never as observed output.
- **Never claim what a specific optimiser step did to a specific bundle.** §12.6 gives the exact
  code of the elision step; that is a claim about the *transform*, which is provable, not about an
  *output*, which is not.
- The one compiled artefact in this bank that is real is the `@angular/material@22.1.5`
  `divider.mjs` in §10.2 — it is a published file, fetched, and it should be labelled as such every
  time it is quoted.

---

## 1 · The single most valuable mechanism across the three topics

**All three topics are the same sentence seen from three angles: *Angular's output is not one
artefact, it is a spectrum of finishedness, and where on that spectrum your code sits is decided by
build flags rather than by your source.***

- Topic **10**: a library's output is deliberately *unfinished* (`ɵɵngDeclareComponent`), and
  something else finishes it, at the consumer's version.
- Topic **11**: an application's output is either finished at build time (AOT) or finished in the
  browser (JIT), from the same compiler, chosen by one boolean.
- Topic **12**: a production application's output has had whole *behaviours* removed — not just
  strings — by a flag substitution plus one elision pass.

The unifying artefact is `ngDevMode`/`ngJitMode`/`compilationMode`: **three switches, none of which
appear in your source, all of which change what your code means.** If a chunk in any of these three
topics can end on that observation, it should.

---

# TOPIC 10 — Partial compilation

**Proposed directory:** `10-partial-compilation/`
**Proposed chunk plan (7):**

| # | Filename | Covers |
|---|---|---|
| 01 | `01-why-a-library-ships-declarations.md` | The problem restated in one page; hand-off to `01/12f` for the semver argument |
| 02 | `02-a-real-published-declaration.md` | 🔴 `@angular/material@22.1.5`'s `divider.mjs`, verbatim, field by field |
| 03 | `03-min-version-and-version.md` | `R3PartialDeclaration`'s two version fields, and what the observed values mean |
| 04 | `04-the-linker-is-a-babel-plugin.md` | `defaultLinkerPlugin`, `LinkerOptions`, `DEFAULT_LINKER_OPTIONS`, the ten declaration names |
| 05 | `05-version-negotiation.md` | 🔴 `PartialLinkerSelector.getLinker` and the mismatch message — **the gap `01/12f` explicitly left open** |
| 06 | `06-where-the-linker-runs-and-when-it-does-not.md` | The CLI's `javascript-transformer-worker`; `getCompilerFacade`'s "the Angular Linker has not processed" message |
| 07 | `07-building-a-partial-library.md` | ng-packagr's own `tsconfig.ngc.json`; how to check a package; `enableResourceInlining` |

No filenames are fixed by inbound links — **nothing on disk links into topic 10 yet.** `01/12f` and
`01/12g` end with `Next →` pointing inside topic 01, and the topic-01 README lists
*"10 · Partial compilation **(not written yet)**"* as bold text. Names are yours; keep
`sidebar_position` = chunk number and `sidebar_label` = `"NN · Short label"` with a middle dot.

---

## Chunk 10·01 — Why a library ships declarations

### 10.01.1 🔴 This chunk is mostly a hand-off. Say so and be short.

`01/12f-partial-compilation-and-the-linker.md` already carries, verbatim and sourced:

- the `separate_compilation.md` quote about npm packages not being able to contain factories
  *"because if any of their dependencies change, their factories would be invalid, preventing them
  from using version ranges in their dependencies"*;
- the three `compilationMode` values quoted from `public_options.ts` **and** from angular.dev;
- the ten-row `ɵɵngDeclare*` → `ɵɵdefine*` table;
- `packages/core/src/render3/jit/partial.ts`'s `ɵɵngDeclareDirective` body;
- the `./linker` and `./linker/babel` `exports` entries from `compiler-cli`'s `package.json`.

**Write this chunk as: one paragraph of the argument, then**

> The full argument — the design document's own sentence about version ranges, and why locality
> is what made the third option possible — is
> [01 · 12f](../01-compiler-with-a-framework-attached/12f-partial-compilation-and-the-linker.md).
> This topic starts where that page stops: what the declaration actually looks like on npm, and
> what the linker does with the two version numbers inside it.

### 10.01.2 The framing sentence this topic is allowed to own

`01/12f` explains *why* partial exists. What it does **not** do is state the packaging consequence
plainly, and that is this topic's opening claim:

**A published Angular library does not contain a compiled component. It contains a description of
one, plus a `.d.ts`, and the compiled component is produced in *your* build.** Which means: the
component in `node_modules` is not the component that runs; the one that runs was produced on your
machine, by your Angular version, from data the library author shipped.

Three consequences, each of which becomes a later chunk:

1. The description carries **version metadata about itself** (§10.03).
2. Something in your pipeline has to **run** to finish it, and it can fail to (§10.06).
3. What the library author sees when they build is **not** what a consumer runs (§10.07).

### 10.01.3 Gotchas to write

- **★ Symptom: you `grep`ped `node_modules/<lib>/fesm2022/*.mjs` for `ɵɵdefineComponent` to check
  the library "compiled", found nothing, and concluded the package is broken.** Cause: a
  partial-mode package contains `ɵɵngDeclareComponent`, never `ɵɵdefineComponent` — the definition
  does not exist until your build makes it. Fix: grep for `ɵɵngDeclare` instead. (`01/12f` already
  ships this pair of `grep` commands as a gotcha; **link it rather than repeating it**.)
- **Symptom: a library's source is TypeScript with a `templateUrl`, but the published `.mjs` has an
  inline `template:` string.** Cause: not the linker — ng-packagr's own tsconfig sets
  `enableResourceInlining: true` (§10.07). Fix: none needed; this is why a published package has no
  `.html` files to resolve.

### 10.01.4 Interview questions

- **★ What is actually inside an Angular library on npm?** A description, not a definition. Each
  decorated class carries `static ɵcmp = i0.ɵɵngDeclareComponent({…})` — a plain data object naming
  the selector, the inputs, the host bindings and the template **as an unparsed string** — plus a
  `.d.ts` carrying the same information at the type level for your template type-checker. The
  compiled `ɵɵdefineComponent` call is produced in the consuming application's build by the Angular
  linker, at the application's Angular version. So the same published package produces different
  compiled output in two applications on two Angular versions, from identical bytes.

---

## Chunk 10·02 — A real published declaration

🔴 **This is the chunk that earns the topic.** Everything below was fetched from
`https://cdn.jsdelivr.net/npm/@angular/material@22.1.5/fesm2022/divider.mjs`, which serves the
bytes in the published npm tarball. Label it that way on the page: *"read from the published
`@angular/material@22.1.5` package, not compiled here."*

### 10.02.1 The whole file, in three quotable pieces

`MatDivider` was chosen because it is the smallest real component in a widely-installed package —
130 lines, one template, two inputs, four host bindings.

**Piece one — the class and its two static fields**, verbatim:

```js
import * as i0 from '@angular/core';
import { Input, ViewEncapsulation, Component, NgModule } from '@angular/core';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { BidiModule } from '@angular/cdk/bidi';

class MatDivider {
  get vertical() {
    return this._vertical;
  }
  set vertical(value) {
    this._vertical = coerceBooleanProperty(value);
  }
  _vertical = false;
  …
  static ɵfac = i0.ɵɵngDeclareFactory({
    minVersion: "12.0.0",
    version: "22.1.4",
    ngImport: i0,
    type: MatDivider,
    deps: [],
    target: i0.ɵɵFactoryTarget.Component
  });
  static ɵcmp = i0.ɵɵngDeclareComponent({
    minVersion: "14.0.0",
    version: "22.1.4",
    type: MatDivider,
    isStandalone: true,
    selector: "mat-divider",
    inputs: {
      vertical: "vertical",
      inset: "inset"
    },
    host: {
      attributes: {
        "role": "separator"
      },
      properties: {
        "attr.aria-orientation": "vertical ? \"vertical\" : \"horizontal\"",
        "class.mat-divider-vertical": "vertical",
        "class.mat-divider-horizontal": "!vertical",
        "class.mat-divider-inset": "inset"
      },
      classAttribute: "mat-divider"
    },
    ngImport: i0,
    template: '',
    isInline: true,
    styles: [".mat-divider {\n  display: block;\n  margin: 0;\n  border-top-style: solid;\n …"],
    encapsulation: i0.ViewEncapsulation.None
  });
}
```

(The `styles` array is one long string; truncate it on the page with an explicit `…` and say you
truncated it. Do **not** silently shorten a quoted literal.)

**Piece two — the class metadata call, top-level and unguarded**, verbatim:

```js
i0.ɵɵngDeclareClassMetadata({
  minVersion: "12.0.0",
  version: "22.1.4",
  ngImport: i0,
  type: MatDivider,
  decorators: [{
    type: Component,
    args: [{
      selector: 'mat-divider',
      host: {
        'role': 'separator',
        '[attr.aria-orientation]': 'vertical ? "vertical" : "horizontal"',
        '[class.mat-divider-vertical]': 'vertical',
        '[class.mat-divider-horizontal]': '!vertical',
        '[class.mat-divider-inset]': 'inset',
        'class': 'mat-divider'
      },
      template: '',
      encapsulation: ViewEncapsulation.None,
      styles: [".mat-divider {\n  display: block;\n …"]
    }]
  }],
  propDecorators: {
    vertical: [{ type: Input }],
    inset: [{ type: Input }]
  }
});
```

**Piece three — the module**, verbatim, showing three more declaration kinds in one class:

```js
class MatDividerModule {
  static ɵfac = i0.ɵɵngDeclareFactory({
    minVersion: "12.0.0", version: "22.1.4", ngImport: i0,
    type: MatDividerModule, deps: [], target: i0.ɵɵFactoryTarget.NgModule
  });
  static ɵmod = i0.ɵɵngDeclareNgModule({
    minVersion: "14.0.0", version: "22.1.4", ngImport: i0,
    type: MatDividerModule, imports: [MatDivider], exports: [MatDivider, BidiModule]
  });
  static ɵinj = i0.ɵɵngDeclareInjector({
    minVersion: "12.0.0", version: "22.1.4", ngImport: i0,
    type: MatDividerModule, imports: [BidiModule]
  });
}
```

### 10.02.2 🔴 The seven observations to make about it — this is the page's spine

1. **`template: ''` and `isInline: true`.** The template is a **string**, not compiled output.
   Nothing in this file parsed `<div>{{x}}</div>`. Whatever template Angular ships in a partial
   package is *source text*, and the template compiler runs in the consumer's build. That single
   fact is why the linker has to be a full compiler and not a mapping function, and it is the fact
   the rest of the topic hangs on.
2. **The host bindings are strings too** — `"vertical ? \"vertical\" : \"horizontal\""` is an
   unparsed Angular expression. Same argument.
3. **`ngImport: i0`.** Every declaration carries a reference to the `@angular/core` namespace
   import. It is how the linker knows which module to generate instruction imports against. It is
   also why the file's very first line is `import * as i0 from '@angular/core'`.
4. **`isStandalone: true`** is emitted explicitly, even though v19+ makes it the default. §10.07
   explains why the linker cannot rely on the default.
5. **`minVersion` differs per declaration kind on the same class.** `ɵfac` and the class metadata
   say `12.0.0`; `ɵcmp` and `ɵmod` say `14.0.0`. It is not a property of the package. §10.03.
6. 🔴 **`version: "22.1.4"` in a package whose own version is `22.1.5`.** The `version` field is the
   Angular compiler that *built* the library, and Angular Material's release train is not lockstep
   with the exact patch it was compiled against. Anyone reading this file and expecting `22.1.5`
   learns something real here.
7. **The decorator is duplicated in full.** `ɵɵngDeclareClassMetadata` re-states the entire
   `@Component({...})` argument, styles string and all — so the CSS is in the published file
   **twice**. That is not an accident (§12.6 gives its purpose and §10.02.3 its cost).

### 10.02.3 What the class-metadata duplicate is for, and what it costs

Its purpose, verbatim from
[`packages/compiler/src/render3/r3_class_metadata_compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/r3_class_metadata_compiler.ts):

> *"Metadata of a class which captures the original Angular decorators of a class. The original
> decorators are preserved in the generated code to allow TestBed APIs to recompile the class using
> the original decorator with a set of overrides applied."*

🔴 That sentence links all three of our topics: the duplicate exists **so that TestBed can JIT-
recompile the class** (topic 11), and it is **removed in an optimised build** (topic 12 §12.6).

⚠️ Note the shape difference and do not gloss it: in the **published library** the
`ɵɵngDeclareClassMetadata` call is a bare top-level statement, not wrapped in `ngDevMode &&`. In
**application** output the compiler emits the guarded, IIFE-wrapped form (§12.6.1). Whether the
declaration-linked form ends up guarded after linking was **not** read — see §99.4.

### 10.02.4 Gotchas to write

- **★ Symptom: a published library's `.mjs` is much larger than the same code compiled in your
  application, and the CSS appears twice.** Cause: `ɵɵngDeclareClassMetadata` re-emits the entire
  decorator argument, including the `styles` array, next to the `ɵcmp` that already carries it.
  Fix: nothing at the library end — that duplicate is what makes `TestBed.overrideComponent` work.
  It is elided from the *application's* production bundle by the CLI's advanced-optimisation pass
  (§12.6), not by you.
- **★ Symptom: you tried to read a library's template out of `node_modules` and found `template:
  ''`.** Cause: the component's template really is empty in this example — but more generally, a
  partial package carries the template as an **inline string**, whatever it was in source, because
  ng-packagr compiles with `enableResourceInlining: true` (§10.07). Fix: read the declaration's
  `template` property; there is no `.html` file to find.
- **Symptom: you assumed `version` in a declaration is the library's own version, and used it to
  detect which release of a package a bundle contains.** Cause: `version` is *"the Angular compiler
  that was used to compile this declaration"* (§10.03) — `@angular/material@22.1.5` reports
  `22.1.4`. Fix: read `package.json`, not the declaration.

### 10.02.5 Interview questions

- **★ Open a published Angular library's `.mjs` and you find `template: '<div>{{name}}</div>'` as a
  plain string. What does that tell you about when the template was compiled?** That it has not
  been. Partial compilation stops before the template compiler: the declaration carries the
  template as source text, the host bindings as unparsed expression strings, and the selector as an
  unparsed selector. Everything that turns those into `ɵɵelementStart`/`ɵɵadvance`/
  `ɵɵproperty` calls happens in the *consuming* application's build, in the linker, at that
  application's Angular version. It is also why the linker cannot be a lookup table — it has to be
  the whole template compiler, which is exactly why the same code path serves JIT.
- **Why does a partially-compiled class carry its own decorator twice?** Once as the declaration
  (`ɵɵngDeclareComponent`), which is the machine-readable input to the linker, and once as
  `ɵɵngDeclareClassMetadata`, which preserves *"the original Angular decorators … to allow TestBed
  APIs to recompile the class using the original decorator with a set of overrides applied"*. The
  first is how the component gets built; the second is how a test can rebuild it differently. The
  second is dead weight in production and is elided there.

---

## Chunk 10·03 — `minVersion` and `version`

### 10.03.1 The type, verbatim — 20 lines that define the whole format

From [`packages/compiler/src/render3/partial/api.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/partial/api.ts):

```ts
export interface R3PartialDeclaration {
  /**
   * The minimum version of the compiler that can process this partial declaration.
   */
  minVersion: string;

  /**
   * Version number of the Angular compiler that was used to compile this declaration. The linker
   * will be able to detect which version a library is using and interpret its metadata accordingly.
   */
  version: string;

  /**
   * A reference to the `@angular/core` ES module, which allows access
   * to all Angular exports, including Ivy instructions.
   */
  ngImport: o.Expression;

  /**
   * Reference to the decorated class, which is subject to this partial declaration.
   */
  type: o.Expression;
}
```

**Four fields, and every `ɵɵngDeclare*` metadata interface in the file extends this one.** So every
declaration of every kind carries all four; the kind-specific fields (`selector`, `inputs`, `host`,
`template`…) are additions.

### 10.03.2 🔴 The two version fields do different jobs, and the difference is the chunk

| Field | Means | Who reads it | Failure mode if you confuse them |
|---|---|---|---|
| `minVersion` | *"The minimum version of the compiler that can process this partial declaration"* — a **requirement on the consumer** | `PartialLinkerSelector.getLinker` picks a linker whose range intersects `>=minVersion` (§10.05) | You think it says which Angular built the library |
| `version` | *"Version number of the Angular compiler that was used to compile this declaration"* — a **fact about the producer** | the linker, to *"interpret its metadata accordingly"* — e.g. `getDefaultStandaloneValue` (§10.07) | You think it is a floor, and expect old libraries to fail |

The doc comment on `version` says the purpose out loud: *"The linker will be able to detect which
version a library is using and interpret its metadata accordingly."* **Detect and interpret** — the
linker changes how it *reads* the object based on this number, independently of which linker
implementation was chosen. §10.07 has the concrete case.

### 10.03.3 Why `minVersion` differs per declaration kind on one class

Observed in `divider.mjs` (§10.02): `ɵɵngDeclareFactory`, `ɵɵngDeclareInjector` and
`ɵɵngDeclareClassMetadata` say `12.0.0`; `ɵɵngDeclareComponent` and `ɵɵngDeclareNgModule` say
`14.0.0`.

The reason is stated in `partial_linker_selector.ts`'s own doc comment
([link](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/linker/src/file_linker/partial_linkers/partial_linker_selector.ts)):

> *"When there is a change to a declaration interface that requires a new partial-linker, the
> `minVersion` of the partial-declaration should be updated, the new linker implementation should
> be added to the end of the collection, and the version of the previous linker should be updated."*

So `minVersion` is a **per-declaration-interface** number, bumped when *that interface* gained
something an older linker could not read. A component declaration's shape changed at 14.0.0; a
factory declaration's has not changed since 12.0.0. It is not a property of the package, the
library, or the Angular version that built it.

⚠️ **Do not claim what changed at 14.0.0.** I did not find the commit. Write it as "the component
declaration interface last changed in a way that needed a new linker at 14.0.0" — which is what the
number means by definition — and stop.

### 10.03.4 The placeholder version, and why you will see it

From [`partial_linkers/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/linker/src/file_linker/partial_linkers/util.ts):

```ts
export const PLACEHOLDER_VERSION = '0.0.0-PLACEHOLDER';
```

Angular's own package sources carry `"version": "0.0.0-PLACEHOLDER"` (see
[`packages/platform-browser-dynamic/package.json`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser-dynamic/package.json))
and the release process substitutes it. The linker has two special paths for it — one in
`getLinker` and one in `getRange` — quoted in §10.05.3.

### 10.03.5 Gotchas to write

- **★ Symptom: an error tells you a library "requires Angular version 19.1.0 or newer", the library
  is on npm as `1.4.0`, and you cannot find any 19.1.0 anywhere.** Cause: the number in that
  message is the declaration's `minVersion`, a property of the declaration *interface*, not of the
  package. It says which linker generation is needed to read the object. Fix: read the message's
  other number too — *"published using Angular version X"* is `version`, the Angular that built it
  (§10.05.2), and that is the one to compare against your own.
- **Symptom: a monorepo library is built and consumed inside the same repo, and you see
  `0.0.0-PLACEHOLDER` in a declaration.** Cause: you are looking at Angular's own unreleased
  sources, or at a build made from them; `PLACEHOLDER_VERSION` is what the release process
  substitutes. Fix: nothing — the linker special-cases it (§10.05.3).

### 10.03.6 Interview questions

- **★ A partial declaration has both `minVersion` and `version`. Which one would tell you that your
  application is too old to consume the library?** `minVersion` — it is defined as *"the minimum
  version of the compiler that can process this partial declaration"*, and it is what the linker
  selector actually tests against its linker ranges. `version` is the opposite direction: *"the
  version of the Angular compiler that was used to compile this declaration"*, which the linker
  reads to decide **how to interpret** the object, not whether it can. The clearest evidence they
  are independent is that one class in a published package carries several `minVersion`s — the
  factory says `12.0.0` while the component says `14.0.0` — with one `version` throughout.

---

## Chunk 10·04 — The linker is a Babel plugin

### 10.04.1 The plugin entry point, verbatim

From [`packages/compiler-cli/linker/babel/src/babel_plugin.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/linker/babel/src/babel_plugin.ts), the file in full minus the licence header:

```ts
/**
 * This is the Babel plugin definition that is provided as a default export from the package, such
 * that the plugin can be used using the module specifier of the package. This is the recommended
 * way of integrating the Angular Linker into a build pipeline other than the Angular CLI.
 *
 * When the module specifier `@angular/compiler-cli/linker/babel` is used as a plugin in a Babel
 * configuration, Babel invokes this function (by means of the default export) to create the plugin
 * instance according to the provided options.
 *
 * The linker plugin that is created uses the native NodeJS filesystem APIs to interact with the
 * filesystem. Any logging output is printed to the console.
 *
 * @param api Provides access to the Babel environment that is configuring this plugin.
 * @param options The plugin options that have been configured.
 */
export function defaultLinkerPlugin(api: ConfigAPI, options: Partial<LinkerOptions>): PluginObject {
  api.assertVersion(8);

  return createEs2015LinkerPlugin({
    ...options,
    fileSystem: new NodeJSFileSystem(),
    logger: new ConsoleLogger(LogLevel.info),
  });
}
```

Three things worth naming:

- 🔴 **`api.assertVersion(8)`** — the plugin requires **Babel 8**. A pipeline on Babel 7 will fail
  at plugin construction, not at link time. That is a real, checkable constraint and it is not in
  any guide.
- The doc comment states the intended audience out loud: *"the recommended way of integrating the
  Angular Linker into a build pipeline other than the Angular CLI"*. So this entry point is for
  webpack/Rollup/Vite-without-the-CLI; §10.06 shows what the CLI does instead (it does **not** use
  this default export).
- It hard-wires `NodeJSFileSystem` and a console logger — which is why the CLI bypasses it and calls
  `createEs2015LinkerPlugin` directly with its own filesystem and logger shims (§10.06.2).

### 10.04.2 `LinkerOptions` — the whole surface, verbatim, with its defaults

From [`packages/compiler-cli/linker/src/file_linker/linker_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/linker/src/file_linker/linker_options.ts), in full:

```ts
/**
 * Options to configure the linking behavior.
 */
export interface LinkerOptions {
  /**
   * Whether to use source-mapping to compute the original source for external templates.
   * The default is `true`.
   */
  sourceMapping: boolean;

  /**
   * This option tells the linker to generate information used by a downstream JIT compiler.
   *
   * Specifically, in JIT mode, NgModule definitions must describe the `declarations`, `imports`,
   * `exports`, etc, which are otherwise not needed.
   */
  linkerJitMode: boolean;

  /**
   * How to handle a situation where a partial declaration matches none of the supported
   * partial-linker versions.
   *
   * - `error` - the version mismatch is a fatal error.
   * - `warn` - a warning is sent to the logger but the most recent partial-linker
   *   will attempt to process the declaration anyway.
   * - `ignore` - the most recent partial-linker will, silently, attempt to process
   *   the declaration.
   *
   * The default is `error`.
   */
  unknownDeclarationVersionHandling: 'ignore' | 'warn' | 'error';
}

/**
 * The default linker options to use if properties are not provided.
 */
export const DEFAULT_LINKER_OPTIONS: LinkerOptions = {
  sourceMapping: true,
  linkerJitMode: false,
  unknownDeclarationVersionHandling: 'error',
};
```

🔴 **`unknownDeclarationVersionHandling` defaults to `'error'`, and the CLI does not override it**
(§10.06.2 shows the CLI's option object — it passes `linkerJitMode`, `sourceMapping`, a `logger` and
a `fileSystem`, and nothing else). **So in a CLI build, a library too new for your linker is a
fatal build failure, not a warning.** §10.05 is where that failure's text lives.

🔴 **`linkerJitMode` is the linker's own JIT switch**, and the CLI wires it straight to the build's
`jit` flag (§11.2). Its doc comment is the cleanest one-sentence statement of what JIT costs in
output size that exists anywhere in the source: NgModule definitions *"must describe the
`declarations`, `imports`, `exports`, etc, which are otherwise not needed."* Quote it in topic 11 as
well.

### 10.04.3 The ten declaration function names, verbatim, and the naming contract

From [`partial_linker_selector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/linker/src/file_linker/partial_linkers/partial_linker_selector.ts):

```ts
export const declarationFunctions = [
  ɵɵngDeclareDirective,
  ɵɵngDeclareClassMetadata,
  ɵɵngDeclareComponent,
  ɵɵngDeclareFactory,
  ɵɵngDeclareInjectable,
  ɵɵngDeclareInjector,
  ɵɵngDeclareNgModule,
  ɵɵngDeclarePipe,
  ɵɵngDeclareClassMetadataAsync,
  ɵɵngDeclareService,
];
```

⚠️ `01/12f` already prints the ten as a two-column table mapping each to the `ɵɵdefine*` it
replaces. **Do not repeat the table — link it and quote the array instead**, because the array is
what the *linker* uses and the table is what the *compiler* emits.

The detection is naive on purpose. From
[`needs_linking.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/linker/src/file_linker/needs_linking.ts), the whole function:

```ts
export function needsLinking(path: string, source: string): boolean {
  return declarationFunctions.some((fn) => source.includes(fn));
}
```

with the doc comment:

> *"This function may return true even for source files that don't actually contain any
> declarations that need to be compiled."*

And the CLI has its own, cheaper version of the same test, keyed on the shared prefix. From
`angular/angular-cli` at `v22.1.7`,
[`packages/angular/build/src/tools/esbuild/javascript-transformer-worker.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/esbuild/javascript-transformer-worker.ts):

```ts
/**
 * The function name prefix for all Angular partial compilation functions.
 * Used to determine if linking of a JavaScript file is required.
 * If any additional declarations are added or otherwise changed in the linker,
 * the names MUST begin with this prefix.
 */
const LINKER_DECLARATION_PREFIX = 'ɵɵngDeclare';
```

🔴 **"the names MUST begin with this prefix"** is a cross-repository contract written down in the
CLI, constraining the framework. It is the sort of thing that only exists because someone broke it
once.

### 10.04.4 Gotchas to write

- **★ Symptom: a non-CLI pipeline (webpack/Rollup + `ts-loader`, or Vite without `@angular/build`)
  ships an application where library components silently never render.** Cause: linking is
  something a build has to *do*. Without the plugin the `ɵɵngDeclare*` calls survive into the
  bundle unlinked, and at runtime they take the JIT fallback path (§10.06.3) — which throws if
  `@angular/compiler` is not loaded. Fix: add the plugin's module specifier to the Babel config —
  and note it needs **Babel 8** because of `api.assertVersion(8)`:

  ```json
  { "plugins": ["@angular/compiler-cli/linker/babel"] }
  ```

- **★ Symptom: you set `unknownDeclarationVersionHandling: 'warn'` to get past a build failure, and
  the build now passes but the application breaks in an unrelated place.** Cause: `'warn'` and
  `'ignore'` do exactly the same thing as `'error'` minus the stopping — *"the most recent
  partial-linker will attempt to process the declaration anyway"*. It is not a compatibility shim;
  it is "guess". Fix: treat the default `'error'` as correct and upgrade the application, or pin the
  library back.
- **Symptom: `@angular/compiler-cli/linker/babel` throws at configuration time in a Babel 7
  pipeline.** Cause: `api.assertVersion(8)`. Fix: upgrade Babel, or use the CLI.

### 10.04.5 Interview questions

- **★ The Angular linker is a Babel plugin. Name two things that follows from, and one thing it
  costs.** It follows that (a) it runs over **already-emitted JavaScript**, so it can process a
  package downloaded from npm with no TypeScript program attached — which no `tsc` transformer
  could; and (b) everything the conversion needs must be **in the declaration object**, because a
  Babel plugin has no type-checker to consult. What it costs is that linking is a step a pipeline
  can simply omit: nothing in the package metadata makes it happen, and the failure mode is a
  runtime JIT error rather than a build error.
- **What does `unknownDeclarationVersionHandling` default to, and why is that the right default?**
  `'error'`. The alternatives both mean "let the newest linker try anyway", and the newest linker is
  by definition one that has never seen this declaration shape — so the outcome is either a crash
  somewhere else or, worse, a component that links to something subtly wrong. Failing the build with
  a message naming both versions is the only outcome that points at the actual problem. The CLI
  does not override it.

---

## Chunk 10·05 — Version negotiation

🔴 **`01/12f` closes with an explicit `⚠️ What this page does not claim`: the linker's
version-negotiation logic, and what happens when a package was built by a *newer* Angular. That gap
is this chunk. Open the page by saying so** — a corpus that names its own gap and then fills it is
worth more than one that never had the gap.

### 10.05.1 The selector, verbatim

From [`partial_linker_selector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/linker/src/file_linker/partial_linkers/partial_linker_selector.ts), the class doc comment first:

> *"A helper that selects the appropriate `PartialLinker` for a given declaration."*
>
> *"The selection is made from a database of linker instances, chosen if their given semver range
> satisfies the `minVersion` of the partial declaration to be linked."*
>
> *"Note that the ranges are checked in order, and the first matching range will be selected. So
> ranges should be most restrictive first. In practice, since ranges are always `<=X.Y.Z` this
> means that ranges should be in ascending order."*
>
> *"Note that any \"pre-release\" versions are stripped from ranges. Therefore if a `minVersion` is
> `11.1.0-next.1` then this would match `11.1.0-next.2` and also `12.0.0-next.1`. (This is different
> to standard semver range checking, where pre-release versions do not cross full version
> boundaries.)"*

and then the method itself, in full:

```ts
  getLinker(functionName: string, minVersion: string, version: string): PartialLinker<TExpression> {
    if (!this.linkers.has(functionName)) {
      throw new Error(`Unknown partial declaration function ${functionName}.`);
    }
    const linkerRanges = this.linkers.get(functionName)!;

    if (version === PLACEHOLDER_VERSION) {
      // Special case if the `version` is the same as the current compiler version.
      // This helps with compliance tests where the version placeholders have not been replaced.
      return linkerRanges[linkerRanges.length - 1].linker;
    }

    const declarationRange = getRange('>=', minVersion);
    for (const {range: linkerRange, linker} of linkerRanges) {
      if (semver.intersects(declarationRange, linkerRange)) {
        return linker;
      }
    }

    const message =
      `This application depends upon a library published using Angular version ${version}, ` +
      `which requires Angular version ${minVersion} or newer to work correctly.\n` +
      `Consider upgrading your application to use a more recent version of Angular.`;

    if (this.unknownDeclarationVersionHandling === 'error') {
      throw new Error(message);
    } else if (this.unknownDeclarationVersionHandling === 'warn') {
      this.logger.warn(`${message}\nAttempting to continue using this version of Angular.`);
    }

    // No linker was matched for this declaration, so just use the most recent one.
    return linkerRanges[linkerRanges.length - 1].linker;
  }
```

### 10.05.2 🔴 The error message, and how to read both of its numbers

```text
This application depends upon a library published using Angular version <version>,
which requires Angular version <minVersion> or newer to work correctly.
Consider upgrading your application to use a more recent version of Angular.
```

⚠️ **Present this as a source quote, not as terminal output.** It is a string literal assembled in
`getLinker`; nothing was run here to produce it.

Reading it correctly is the whole practical value of this chunk:

- **`<version>`** is the Angular that **built the library** (the declaration's `version`).
- **`<minVersion>`** is the **linker generation required** (the declaration's `minVersion`).
- 🔴 **Neither number is your application's Angular version.** Nothing in this message tells you
  what you are on. The message says "upgrade" without saying from what — so the first thing to do
  on seeing it is `npm ls @angular/core`, not to change a config.

And the failure is **`throw new Error(message)`** — a plain `Error`, **not** a `RuntimeError`, so it
has **no `NG` code** and no `Find more at …` link. Do not go looking for an `NG0xxx` for it; there
isn't one. (Contrast `FatalLinkerError` in
[`fatal_linker_error.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/linker/src/fatal_linker_error.ts),
which the linker uses for malformed declarations — a different class, also uncoded.)

### 10.05.3 The two special cases, and the answer to "what if the library is NEWER than me?"

**Special case 1 — the placeholder.** `if (version === PLACEHOLDER_VERSION)` returns the newest
linker with no range check at all. Its comment: *"This helps with compliance tests where the version
placeholders have not been replaced."*

**Special case 2 — an unpublished Angular.** From `getRange` in the same file:

```ts
function getRange(comparator: '<=' | '>=', versionStr: string): semver.Range {
  // If the provided version is exactly `0.0.0` then we are known to be running with an unpublished
  // version of angular and assume that all ranges are compatible.
  if (versionStr === '0.0.0' && (PLACEHOLDER_VERSION as string) === '0.0.0') {
    return new semver.Range('*.*.*');
  }
  const version = new semver.SemVer(versionStr);
  // Wipe out any prerelease versions
  version.prerelease = [];
  return new semver.Range(`${comparator}${version.format()}`);
}
```

Note `version.prerelease = []` — this is the mechanical half of the doc comment's pre-release note.
A `-next.1` and a `-next.2` are the same version to this code.

🔴 **Now the question `01/12f` left open: what happens when the library was built by a *newer*
Angular than yours?** The answer, read off the code:

The linker map at `v22.1.5` is **one entry per declaration kind**, all at `LATEST_VERSION_RANGE`:

```ts
  const LATEST_VERSION_RANGE = getRange('<=', PLACEHOLDER_VERSION);

  linkers.set(ɵɵngDeclareDirective, [
    {range: LATEST_VERSION_RANGE, linker: new PartialDirectiveLinkerVersion1(sourceUrl, code)},
  ]);
  …
```

and there is exactly **one** `Version1` class per kind on disk
([`partial_linkers/`](https://github.com/angular/angular/tree/v22.1.5/packages/compiler-cli/linker/src/file_linker/partial_linkers)
contains `partial_component_linker_1.ts`, `partial_directive_linker_1.ts`, … and no `_2`). So at
v22 the whole multi-generation machinery is *armed but unused*: every kind has a single linker whose
range is `<= <this compiler's version>`.

Consequently: a declaration whose `minVersion` is **higher than the linker's own version** produces
a `declarationRange` of `>=minVersion` that does **not** intersect `<=ourVersion`, no linker
matches, and the loop falls through to the message and the `throw`. That is the newer-library case,
and it is a hard build failure by default.

⚠️ **State the limit honestly:** this is a reading of `createLinkerMap` and `getLinker` at
`v22.1.5`. I did not read a released Angular in which a second linker generation exists, so the
"most restrictive first / ascending order" machinery is described from its own doc comment and the
worked example in it, not from a live multi-entry map. Say that on the page.

### 10.05.4 The commented example the doc carries — quote it, it is the clearest thing in the file

```ts
 * {range: getRange('<=', '13.0.0'), linker PartialDirectiveLinkerVersion2(...) },
 * {range: getRange('<=', '13.1.0'), linker PartialDirectiveLinkerVersion3(...) },
 * {range: getRange('<=', '14.0.0'), linker PartialDirectiveLinkerVersion4(...) },
 * {range: LATEST_VERSION_RANGE, linker: new PartialDirectiveLinkerVersion1(...)},
```

> *"If the `LATEST_VERSION_RANGE` is `<=15.0.0` then the fallback linker would be
> `PartialDirectiveLinkerVersion1` for any version greater than `15.0.0`."*

🔴 **Note the counter-intuitive naming: `Version1` is the *newest*, and it is last in the list.**
The numbered classes are declaration-format generations in the order they were *added to the file*,
and `Version1` — the original — has been kept in step with the current format while the numbered
ones froze. Anyone reading `partial_component_linker_1.ts` and assuming it is legacy code has it
exactly backwards.

### 10.05.5 Gotchas to write

- **★ Symptom: your build fails with "This application depends upon a library published using
  Angular version 23.x, which requires Angular version 23.0.0 or newer to work correctly" and you
  have no idea which of your dependencies it is.** Cause: the message names two versions and neither
  is a package name — the linker is looking at an anonymous AST node in an already-bundled `.mjs`.
  Fix: find the package by the prefix the CLI itself keys on, then read its declarations:

  ```bash
  grep -rl 'ɵɵngDeclare' node_modules/*/fesm2022 node_modules/@*/*/fesm2022 2>/dev/null
  grep -ho '"minVersion": *"[^"]*"' node_modules/@acme/widgets/fesm2022/*.mjs | sort -u
  ```

- **★ Symptom: you tried to "unblock" the build with
  `unknownDeclarationVersionHandling: 'warn'` and the message is now a warning, but the components
  from that library misbehave in ways with no obvious cause.** Cause: the code path after the warn
  is `return linkerRanges[linkerRanges.length - 1].linker` — the newest linker reads a declaration
  shape it does not know. The warning even says so: *"Attempting to continue using this version of
  Angular."* Fix: it is a diagnostic escape hatch, not a compatibility mode. Upgrade the
  application, or pin the library to a release built by an Angular you can link.
- **★ Symptom: you searched angular.dev for the "requires Angular version … or newer" message and
  found nothing.** Cause: it is a plain `throw new Error(...)` in the linker, not a `RuntimeError`;
  it has no `NG` code, no docs page and no `Find more at` link. Fix: search the source, not the
  errors reference. Same for `FatalLinkerError`.
- **Symptom: a prerelease dependency links fine even though its `minVersion` looks higher than your
  Angular.** Cause: `getRange` does `version.prerelease = []`, so `11.1.0-next.1` is compared as
  `11.1.0` — the doc comment says this is *"different to standard semver range checking, where
  pre-release versions do not cross full version boundaries"*. Fix: none, but do not reason about
  linker compatibility using `npm semver` intuitions; the linker's rules are looser.

### 10.05.6 Interview questions

- **★ You upgrade a library and your build dies with a message about "a library published using
  Angular version X, which requires Angular version Y or newer". Walk through what actually
  happened.** The linker read a `ɵɵngDeclare*` call, took its `minVersion`, and built the semver
  range `>=minVersion`. It then walked its list of linker implementations for that declaration kind,
  each carrying a `<=someVersion` range, looking for an intersection. None intersected — meaning no
  linker in *your* `@angular/compiler-cli` is new enough to read that declaration shape. Because
  `unknownDeclarationVersionHandling` defaults to `'error'` and the CLI does not override it, that
  is a `throw`, so the build stops. The two numbers in the message are the library's *producer*
  version and the required *linker generation*; neither is yours, which is why the first diagnostic
  step is `npm ls @angular/core`.
- **★ Can a library be too new for your application? Can it be too old?** Too new, yes — and it is a
  build failure by default, for the reason above. Too old, essentially no: `minVersion` produces a
  `>=` range that intersects every `<=` linker range above it, so old declarations keep matching.
  The design is deliberately asymmetric, and it is the same asymmetry a peer-dependency range has:
  the library declares a floor, the consumer supplies a ceiling.
- **In the linker's own example, `PartialDirectiveLinkerVersion1` is listed last and described as
  the fallback. Why is the *first* version the newest?** Because the numbered classes are frozen
  snapshots of older declaration formats, added as the format changed, while `Version1` — the
  original class — is the one that keeps being updated to the current format. The list is ordered by
  ascending `<=` range so the most restrictive (oldest) match wins first, and `LATEST_VERSION_RANGE`
  sits at the end as the catch-all. At `v22.1.5` there is only ever one entry per kind, so the
  machinery is present and unexercised.

---

## Chunk 10·06 — Where the linker runs, and when it does not

### 10.06.1 In a CLI build it is a Babel pass inside a worker pool, over `node_modules`

From `angular/angular-cli` at `v22.1.7`,
[`packages/angular/build/src/tools/esbuild/javascript-transformer-worker.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/esbuild/javascript-transformer-worker.ts):

```ts
async function requiresLinking(path: string, source: string): Promise<boolean> {
  // @angular/core and @angular/compiler will cause false positives
  // Also, TypeScript files do not require linking
  if (/[\\/]@angular[\\/](?:compiler|core)|\.tsx?$/.test(path)) {
    return false;
  }

  // Check if the source code includes one of the declaration functions.
  // There is a low chance of a false positive but the names are fairly unique
  // and the result would be an unnecessary no-op additional plugin pass.
  return source.includes(LINKER_DECLARATION_PREFIX);
}
```

🔴 **Three facts the page should pull out of those nine lines.**

1. **`.ts`/`.tsx` files are excluded.** Your own source is never linked — it is compiled by `ngtsc`
   in `full` mode. Linking is exclusively a `node_modules` concern.
2. **`@angular/core` and `@angular/compiler` are excluded by path**, because they *mention* the
   declaration function names (they define them) without containing declarations. A substring test
   over `ɵɵngDeclare` would false-positive on the framework itself.
3. The test is a substring check on a **prefix**, which is why the framework side carries the
   *"the names MUST begin with this prefix"* comment quoted in §10.04.3.

### 10.06.2 The options the CLI actually passes — and the two that are surprising

From the same file:

```ts
  const linkerPlugin = linkerPluginCreator({
    linkerJitMode: options.jit,
    // This is a workaround until https://github.com/angular/angular/issues/42769 is fixed.
    sourceMapping: false,
    logger: { … },
    fileSystem: { resolve: path.resolve, exists: fs.existsSync, … },
  });
```

- 🔴 **`sourceMapping: false`, described in the code as a workaround for an open Angular issue
  (#42769).** The `LinkerOptions` doc says the default is `true`; the CLI turns it off. So
  *"whether to use source-mapping to compute the original source for external templates"* is off in
  every CLI build, and has been long enough for a linked issue number to sit in the source. That is
  a genuinely non-obvious fact and it is exactly the sort of thing a Know-tier page should surface.
- **`linkerJitMode: options.jit`** — the linker's JIT switch is wired directly to the build's
  `jit` flag, which is `!aot` (§11.2). One boolean in `angular.json` reaches the linker.
- The CLI calls `createEs2015LinkerPlugin` **directly**, not the `defaultLinkerPlugin` default
  export, so it can supply its own logger and a minimal filesystem shim. That is why §10.04.1's
  "recommended way … other than the Angular CLI" comment is worded the way it is.

Two more structural facts from the surrounding code, both cheap and both worth a sentence:

- The plugin module is **lazily imported and cached per worker**:

  ```ts
  linkerPluginCreator ??= (await import('@angular/compiler-cli/linker/babel'))
    .createEs2015LinkerPlugin;
  ```

  so an application with no partial dependencies never loads the linker at all.
- Transform results are **content-hash cached**, from
  [`javascript-transformer.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/esbuild/javascript-transformer.ts):

  ```ts
        const hash = createHash('sha256');
        hash.update(`${!!skipLinker}--${!!sideEffects}`);
        hash.update(data);
        hash.update(this.#fileCacheKeyBase);
        cacheKey = hash.digest('hex');
  ```

  which is why linking a large dependency tree is expensive exactly once.

### 10.06.3 🔴 When linking does not happen: the runtime fallback, verbatim

If a declaration reaches the browser unlinked, `ɵɵngDeclareComponent` is a **real function in
`@angular/core`** and it runs — asking for the JIT compiler. From
[`packages/core/src/compiler/compiler_facade.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/compiler/compiler_facade.ts), in full:

```ts
export function getCompilerFacade(request: JitCompilerUsageRequest): CompilerFacade {
  const globalNg: ExportedCompilerFacade = global['ng'];
  if (globalNg && globalNg.ɵcompilerFacade) {
    return globalNg.ɵcompilerFacade;
  }

  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    // Log the type as an error so that a developer can easily navigate to the type from the
    // console.
    console.error(`JIT compilation failed for ${request.kind}`, request.type);

    let message = `The ${request.kind} '${request.type.name}' needs to be compiled using the JIT compiler, but '@angular/compiler' is not available.\n\n`;
    if (request.usage === JitCompilerUsage.PartialDeclaration) {
      message += `The ${request.kind} is part of a library that has been partially compiled.\n`;
      message += `However, the Angular Linker has not processed the library such that JIT compilation is used as fallback.\n`;
      message += '\n';
      message += `Ideally, the library is processed using the Angular Linker to become fully AOT compiled.\n`;
    } else {
      message += `JIT compilation is discouraged for production use-cases! Consider using AOT mode instead.\n`;
    }
    message += `Alternatively, the JIT compiler should be loaded by bootstrapping using '@angular/platform-browser-dynamic' or '@angular/platform-server',\n`;
    message += `or manually provide the compiler with 'import "@angular/compiler";' before bootstrapping.`;
    throw new Error(message);
  } else {
    throw new Error('JIT compiler unavailable');
  }
}
```

**This one function is load-bearing for all three topics** and each should quote a different half:

- **Topic 10** owns the `PartialDeclaration` branch: *"The component is part of a library that has
  been partially compiled. However, the Angular Linker has not processed the library such that JIT
  compilation is used as fallback."* — i.e. "your pipeline forgot to link, and I am now the fallback
  you did not ask for".
- **Topic 11** owns the `Decorator` branch: *"JIT compilation is discouraged for production
  use-cases! Consider using AOT mode instead."* — the framework saying it in its own error text.
- **Topic 12** owns the `else`: in a production build the entire message collapses to the fifteen
  characters **`JIT compiler unavailable`**, with no kind, no class name and no advice. It is the
  same pattern as `NG0201` in `03/16c` — quote that page rather than re-arguing it.

⚠️ Note the message names `platform-browser-dynamic` as a remedy while that package is deprecated
(§0.3). The advice line `import "@angular/compiler";` is the one that is not deprecated. **Say so
where you quote it**, because a reader following the error's own advice will install a deprecated
package.

### 10.06.4 Gotchas to write

- **★ Symptom: `The component 'FooCmp' needs to be compiled using the JIT compiler, but
  '@angular/compiler' is not available` in the browser, naming a component from a third-party
  library you never touched.** Cause: the library shipped partial declarations and your bundler
  never ran the linker, so the `ɵɵngDeclareComponent` call executed at runtime and asked for JIT.
  Read the second paragraph of the error — *"the Angular Linker has not processed the library"* — it
  names the actual cause. Fix: add the linker to the pipeline (§10.04.4); do **not** follow the
  error's suggestion of importing `@angular/compiler`, which makes it work by shipping the compiler
  to users.
- **★ Symptom: your own components are fine and only `node_modules` ones fail this way.** Cause:
  `requiresLinking` excludes `.ts`/`.tsx` — your source went through `ngtsc` in `full` mode and was
  never a declaration. Fix: the problem is entirely in the JS-transform stage of your pipeline.
- **★ Symptom: a template error inside a library points at a generated location rather than the
  library's own template.** Cause: the CLI passes `sourceMapping: false` to the linker as *"a
  workaround until https://github.com/angular/angular/issues/42769 is fixed"*, so the linker does
  not compute the original source for external templates. Fix: none available through the CLI —
  reproduce against the library's own repository.
- **Symptom: a production build fails at runtime with the bare string `JIT compiler unavailable` and
  nothing else.** Cause: `getCompilerFacade`'s non-`ngDevMode` branch. Fix: reproduce with a
  development build of the same bundle, where the same throw carries the class name and the
  diagnosis. (This is topic **12**'s territory — link it.)

### 10.06.5 Interview questions

- **★ Where does the Angular linker run in a CLI build, and which files does it touch?** In a Babel
  pass inside `@angular/build`'s JavaScript-transformer worker pool, over emitted JavaScript from
  `node_modules` — never over your own `.ts`, which the CLI excludes by extension because your
  source is compiled by `ngtsc` in `full` mode. It also excludes `@angular/core` and
  `@angular/compiler` by path, since those *define* the declaration functions and would false-
  positive a substring test. The plugin is lazily imported the first time a file actually needs it,
  and results are content-hash cached, so a large dependency tree is linked once.
- **★ What happens if the linker never runs?** The `ɵɵngDeclare*` calls survive into the bundle, and
  they are real functions in `@angular/core`, so they execute in the browser and call
  `getCompilerFacade` with `usage: JitCompilerUsage.PartialDeclaration`. If `@angular/compiler` is
  not loaded that throws, with a message whose second paragraph diagnoses it precisely: *"the
  Angular Linker has not processed the library such that JIT compilation is used as fallback."* If
  `@angular/compiler` *is* loaded, it silently works — and you have shipped the compiler and moved
  the library's compilation into every user's browser. The second outcome is the dangerous one,
  because nothing fails.

---

## Chunk 10·07 — Building a partial library

### 10.07.1 🔴 ng-packagr already sets partial mode. Correct the folk rule.

From `ng-packagr` at tag **`22.1.1`**,
[`src/lib/ts/conf/tsconfig.ngc.json`](https://github.com/ng-packagr/ng-packagr/blob/22.1.1/src/lib/ts/conf/tsconfig.ngc.json),
in full:

```json
{
  "angularCompilerOptions": {
    "compilationMode": "partial",
    "strictTemplates": true,
    "enableResourceInlining": true
  },
  "buildOnSave": false,
  "compileOnSave": false,
  "compilerOptions": {
    "target": "es2022",
    "module": "es2022",
    "moduleResolution": "bundler",
    "outDir": "AUTOGENERATED",
    "declaration": true,
    "declarationDir": "AUTOGENERATED",
    "sourceMap": true,
    "inlineSourceMap": false,
    "inlineSources": true,
    "skipLibCheck": true,
    "emitDecoratorMetadata": false,
    "experimentalDecorators": true,
    "importHelpers": true,
    "lib": ["dom", "es2018"]
  },
  "files": ["AUTOGENERATED"],
  "exclude": ["node_modules", "dist", "**/*.shim.ts", "**/*.spec.ts"]
}
```

**`"compilationMode": "partial"` is ng-packagr's own baseline, not something a library author
writes.** Every `ng-packagr`-built library is partial by default; a library ends up `full` only if
someone actively overrode it.

Four more things in that file worth a line each:

- **`enableResourceInlining: true`** — this is why a published declaration has `template: '…'` and
  `isInline: true` even when the source used `templateUrl` (§10.02). It is a *library-build* option
  and it explains the whole shape of a published package.
- **`strictTemplates: true`** at the library level, independent of the application's setting
  (topic 01 `14f` owns `strictTemplates`; link, do not explain).
- **`experimentalDecorators: true` with `emitDecoratorMetadata: false`** — the decorators are
  syntax the compiler reads, and no `design:type` metadata is emitted.
- `AUTOGENERATED` placeholders: ng-packagr rewrites `outDir`, `declarationDir` and `files` per
  entry point.

ng-packagr also *reports* the mode it is using. From
[`src/lib/ng-package/entry-point/compile-ngc.transform.ts`](https://github.com/ng-packagr/ng-packagr/blob/22.1.1/src/lib/ng-package/entry-point/compile-ngc.transform.ts):

```ts
      spinner.start(
        `Compiling with Angular sources in ${tsConfig.options.compilationMode || 'full'} compilation mode.`,
      );
```

⚠️ That is a **source string**, not a captured build log. Quote it as source and say which line it
comes from — do not present it as output you saw.

### 10.07.2 🔴 Found, not fixed — this corrects a gotcha already on disk

`01/12f-partial-compilation-and-the-linker.md` carries this gotcha:

> **★ Symptom: your library works in your own workspace and consumers on a different Angular
> version get failures inside your components.** Cause: `compilationMode` defaults to `'full'` …
> Fix: build the library in partial mode. In a CLI workspace this belongs in the library's
> production tsconfig — **verify it is there rather than assuming the generator set it**

The *compiler's* default is indeed `'full'` — that part is right and quoted from `public_options.ts`
correctly. But the practical claim reads as "check that your library tsconfig sets partial mode",
and for an `ng-packagr` library that is unnecessary: **ng-packagr's own base tsconfig sets it, and
your library tsconfig extends that.** The failure mode 12f describes needs someone to have actively
overridden it, or to be building the library with something other than ng-packagr.

**Not mine to fix.** Logged in §100.1. Topic 10 should state the accurate version and cross-link.

### 10.07.3 The linker reads `version` to decide defaults — the mirror of `01/12g`

From [`partial_linkers/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/linker/src/file_linker/partial_linkers/util.ts):

```ts
const STANDALONE_IS_DEFAULT_RANGE = new semver.Range(`>= 19.0.0 || ${PLACEHOLDER_VERSION}`, {
  includePrerelease: true,
});

export function getDefaultStandaloneValue(version: string): boolean {
  return STANDALONE_IS_DEFAULT_RANGE.test(version);
}
```

🔴 **This is `01/12g` seen from the other end.** `12g` shows `NgCompiler` asking what version of
`@angular/core` *the program* resolved to, in order to decide `implicitStandaloneValue` at `>= 19.0.0`.
Here the **linker** asks what version *the declaration says built it*, to decide the same default,
at the same `>= 19.0.0` boundary. Same question, same threshold, two different sources of truth —
because at link time there is no program to ask, only the object.

That is the concrete meaning of `version`'s doc comment: *"The linker will be able to detect which
version a library is using and interpret its metadata accordingly."*

⚠️ It also explains why `@angular/material`'s declaration emits `isStandalone: true` explicitly
(§10.02.2, observation 4): a declaration built by a pre-19 compiler and one built by a post-19
compiler mean different things by an *absent* `isStandalone`, so emitting it removes the ambiguity.
**That last sentence is my inference from the two facts, not a quote — mark it as a reading.**

### 10.07.4 Gotchas to write

- **★ Symptom: you added `"compilationMode": "partial"` to your library's `tsconfig.lib.prod.json`
  and nothing changed.** Cause: ng-packagr's base `tsconfig.ngc.json` already sets it; you set a
  value that was already the effective one. Fix: nothing to do — and if you are debugging a
  cross-version failure, the cause is elsewhere. Confirm the mode from the emitted output rather
  than from config (`grep 'ɵɵngDeclare' dist/<lib>/fesm2022/*.mjs`).
- **★ Symptom: an *application* was built with `compilationMode: 'partial'`, usually from a copied
  library tsconfig, and behaviour is subtly wrong.** Cause: partial output is *"an intermediate form
  suitable for publication to NPM"*, not a deployable application. Fix: remove the option so the
  application takes the `'full'` default. (`01/12f` already ships this gotcha with the corrected
  tsconfig — **link it, do not duplicate it**.)
- **★ Symptom: your library's published package has no `.html` or `.css` files and consumers report
  they cannot override a template.** Cause: `enableResourceInlining: true` in ng-packagr's base
  tsconfig folds `templateUrl`/`styleUrls` into the declaration as strings at library build time.
  Fix: this is by design and is what makes the package self-contained; expose theming through CSS
  custom properties rather than through overridable files.
- **Symptom: two libraries in one monorepo emit different `isStandalone` behaviour for identical
  source.** Cause: the declaration's `version` decides the standalone default at the linker end
  (`>= 19.0.0`), just as the resolved `@angular/core` decides it at the compiler end. Fix: the
  diagnostic is the same one `01/12g` gives — `npm ls @angular/core --all`.

### 10.07.5 Interview questions

- **★ Do you have to configure anything to publish an Angular library in partial mode?** With
  `ng-packagr` — which is what `ng build <library>` uses — no. Its own base tsconfig sets
  `"compilationMode": "partial"` alongside `strictTemplates` and `enableResourceInlining`, and your
  library tsconfig extends it. The compiler's default is `'full'`, so partial mode *is* a deliberate
  choice — it is just one ng-packagr already made for you. What is worth verifying is the opposite
  direction: that nothing in your workspace *overrode* it back to `full`, and the way to verify is
  to grep the emitted `.mjs` for `ɵɵngDeclare` rather than to read config.
- **The linker has a function `getDefaultStandaloneValue(version)` that tests `>= 19.0.0`. Why does
  it need one?** Because a declaration is a data object with no program behind it, and the meaning
  of an *absent* `isStandalone` field depends on which Angular compiled the library — standalone
  became the default at v19. At compile time `NgCompiler` answers the same question by reading the
  resolved `@angular/core` from the TypeScript program; at link time there is no program, so the
  linker reads the `version` field the producer stamped into the declaration. It is exactly the
  behaviour `version`'s doc comment promises: detect which version the library is using and
  *"interpret its metadata accordingly"*.

---

# TOPIC 11 — JIT vs AOT

**Proposed directory:** `11-jit-vs-aot/`
**Proposed chunk plan (5):**

| # | Filename | Covers |
|---|---|---|
| 01 | `01-the-same-compiler-at-a-different-time.md` | What JIT and AOT literally share; the decorator path; `getCompilerFacade`'s two usages |
| 02 | `02-the-switch-is-one-boolean.md` | `aot: true` in the builder schema; `jit = !aot`; `ngJitMode`; the three things it turns off |
| 03 | `03-where-jit-still-runs.md` | 🔴 TestBed (and it is not `platform-browser-dynamic`); the unlinked-declaration fallback; the deprecated platform |
| 04 | `04-why-it-is-not-a-deployment-option.md` | The compiler ships; no build-time template errors; `advancedOptimizations` is off; the framework's own error text says so |
| 05 | `05-the-guide-is-stale.md` | ⚠️ angular.dev's AOT page still describes the pre-Ivy collector, `.metadata.json` and `StaticReflector` |

No filenames are fixed by inbound links. Topic 01's README lists *"11 · JIT vs AOT **(not written
yet)**"* as bold text with the one-liner *"the same compiler, run at a different time, and why that
is a debugging tool rather than a deployment option"* — that phrasing is a good spine for chunk 01.

---

## Chunk 11·01 — The same compiler at a different time

### 11.01.1 The claim, and the code that proves it

The proof is a single function with a two-value enum. From
[`packages/core/src/compiler/compiler_facade.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/compiler/compiler_facade.ts):

```ts
export const enum JitCompilerUsage {
  Decorator,
  PartialDeclaration,
}

interface JitCompilerUsageRequest {
  usage: JitCompilerUsage;
  kind: 'directive' | 'component' | 'pipe' | 'injectable' | 'NgModule' | 'service';
  type: Type;
}

export function getCompilerFacade(request: JitCompilerUsageRequest): CompilerFacade {
  const globalNg: ExportedCompilerFacade = global['ng'];
  if (globalNg && globalNg.ɵcompilerFacade) {
    return globalNg.ɵcompilerFacade;
  }
  …
```

🔴 **The JIT compiler is not imported. It is looked up on `global.ng.ɵcompilerFacade`.** That is the
whole packaging mechanism: `@angular/core` never depends on `@angular/compiler` (which is why the
peer is *optional*, §0.1); importing `@angular/compiler` for its side effect installs the facade on
the global; `getCompilerFacade` finds it or throws.

`kind` has **six** values — `'directive' | 'component' | 'pipe' | 'injectable' | 'NgModule' |
'service'` — which is a compact statement of everything JIT can compile. `'service'` is the v22
`@Service` addition; note it and move on (it belongs to a later phase).

### 11.01.2 The decorator path, verbatim — where "at runtime" actually happens

From [`packages/core/src/render3/jit/directive.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/jit/directive.ts):

```ts
/**
 * Compile an Angular component according to its decorator metadata, and patch the resulting
 * component def (ɵcmp) onto the component type.
 *
 * Compilation may be asynchronous (due to the need to resolve URLs for the component template or
 * other resources, for example). In the event that compilation is not immediate, `compileComponent`
 * will enqueue resource resolution into a global queue and will fail to return the `ɵcmp`
 * until the global queue has been resolved with a call to `resolveComponentResources`.
 */
export function compileComponent(type: Type<any>, metadata: Component): void {
  // Initialize ngDevMode. This must be the first statement in compileComponent.
  // See the `initNgDevMode` docstring for more information.
  (typeof ngDevMode === 'undefined' || ngDevMode) && initNgDevMode();

  let ngComponentDef: ComponentDef<unknown> | null = null;

  // Metadata may have resources which need to be resolved.
  maybeQueueResolutionOfComponentResources(type, metadata);
  …
  Object.defineProperty(type, NG_COMP_DEF, {
    get: () => {
      if (ngComponentDef === null) {
        const compiler = getCompilerFacade({
          usage: JitCompilerUsage.Decorator,
          kind: 'component',
          type: type,
        });
        …
```

**Three observations, and they are the chunk.**

1. 🔴 **JIT compilation is *lazy*, and the laziness is a property getter.** `compileComponent` does
   not compile anything; it installs a `get` on `ɵcmp` that compiles on first read. So "compiled at
   runtime" means "compiled the first time something asks for the definition" — usually the first
   time the component is rendered, not at import.
2. **The `templateUrl` problem is why JIT has an async story at all.** `maybeQueueResolutionOfComponentResources`
   plus a global queue plus `resolveComponentResources` exist because a decorator can name a file
   that has to be fetched. AOT has no such problem: the resource is inlined at build time.
3. **`initNgDevMode()` is called as the first statement**, with the comment saying it must be. Topic
   12 §12.1.4 explains why that ordering exists.

Two JIT-only refusals worth quoting from the same getter:

```ts
        if (metadata.foreignImports !== undefined) {
          throw new Error(
            `Foreign components are not supported in JIT mode. ` +
              `Component '${type.name}' cannot specify 'foreignImports'.`,
          );
        }

        if (componentNeedsResolution(metadata)) {
          const error = [`Component '${type.name}' is not resolved:`];
          if (metadata.templateUrl) {
            error.push(` - templateUrl: ${metadata.templateUrl}`);
          }
```

⚠️ `foreignImports` is a v22 surface I did not research further — name the refusal, do not explain
the feature. See §99.7.

### 11.01.3 The three entry points into one compiler

The page's summary table. Every row is sourced above:

| Entry point | When | `usage` tag | Input |
|---|---|---|---|
| `ngtsc` transformer | build time, over your `.ts` | — (not `getCompilerFacade`) | TypeScript nodes, via the transformer's extraction |
| the linker | build time, over `node_modules` JS | — (`compiler-cli`'s own path) | a declaration object |
| `ɵɵngDeclareX` at runtime | first read of `ɵcmp`, unlinked | `PartialDeclaration` | a declaration object |
| the decorator at runtime | first read of `ɵcmp`, JIT build | `Decorator` | the decorator's metadata object |

🔴 **`01/12f` already states the unifying design rule** and quotes `architecture.md`: Compilers
*"will not take Typescript nodes directly as input, but will operate against information extracted
from TS sources by the transformer. In addition to helping enforce the rules above, this restriction
also enables Compilers to run at runtime during JIT mode."* **Link that page for the rule; this
chunk owns the four-row table.**

### 11.01.4 Gotchas to write

- **★ Symptom: in a JIT build a component compiles fine at import and throws only when the route
  that uses it is first visited.** Cause: `compileComponent` installs a getter; the compiler runs on
  the first read of `ɵcmp`. A metadata problem therefore surfaces at first render, not at load. Fix:
  none at runtime — this is the structural argument for AOT, where the same error is a build error.
- **★ Symptom: `Component 'X' is not resolved: - templateUrl: ./x.html` in a JIT context.** Cause:
  JIT has to *fetch* the template, and the definition was read before the global resolution queue
  was drained. Fix: in tests, `await TestBed.compileComponents()`; in an application, this is a
  reason not to use JIT.
- **Symptom: `@angular/compiler` is in your `dependencies` and you cannot work out what pulled it
  in.** Cause: it is an **optional** peer of `@angular/core` and a **required** peer of
  `@angular/platform-browser-dynamic`; something on the second list, or `@angular/core/testing`
  (§11.03.2), imports it. Fix: `npm ls @angular/compiler`.

### 11.01.5 Interview questions

- **★ "JIT and AOT are the same compiler" — defend that literally.** `@angular/core` never imports
  the compiler; it calls `getCompilerFacade`, which looks up `global.ng.ɵcompilerFacade` — a facade
  installed as a side effect of loading `@angular/compiler`. The same facade serves two callers, told
  apart only by a two-value enum: `JitCompilerUsage.Decorator` when a `@Component` is being compiled
  from its decorator in the browser, and `JitCompilerUsage.PartialDeclaration` when a
  `ɵɵngDeclareComponent` from an unlinked library is being finished. And the build-time compiler is
  the same code again, because the design rule forbids Compilers from taking TypeScript nodes
  directly — they consume extracted metadata objects, which is precisely what makes running them at
  runtime possible. One compiler, four entry points.
- **When exactly does JIT compilation run?** Not at import. `compileComponent` installs a property
  getter on the class's `ɵcmp`, and the compiler runs the first time that property is read — in
  practice, the first time the component is instantiated. That is why a JIT application can start
  cleanly and then fail on a route, and why JIT needs an asynchronous resource-resolution queue for
  `templateUrl`: the definition can be *asked for* before the template has been fetched.

---

## Chunk 11·02 — The switch is one boolean

### 11.02.1 `aot` is a builder option, and it defaults to `true`

From `angular/angular-cli` at `v22.1.7`,
[`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json), the whole property:

```json
"aot": {
  "type": "boolean",
  "description": "Build using Ahead of Time compilation.",
  "x-user-analytics": "ep.ng_aot",
  "default": true
}
```

🔴 **There is no `jit` option in the `application` builder schema.** I checked the property list:
`aot` is present, `jit` is not. `jit` is an *internal* value, derived. From
[`packages/angular/build/src/builders/application/options.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/options.ts):

```ts
    advancedOptimizations: !!aot && optimizationOptions.scripts,
    …
    jit: !aot,
```

**Two lines, and they are the chunk's whole mechanism.**

- `jit: !aot` — JIT is not something you turn on; it is what you get by turning AOT off.
- 🔴 `advancedOptimizations: !!aot && optimizationOptions.scripts` — **advanced optimisations
  require AOT.** A JIT build gets none of them **even in a production configuration**. §11.04.3 and
  topic 12 §12.6 both depend on this line.

angular.dev states the option's effect and its history, verbatim from
[Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler):

> *"Just-in-Time (JIT) — Compiles your application in the browser at runtime. This was the default
> until Angular 8."*
> *"Ahead-of-Time (AOT) — Compiles your application and libraries at build time. This is the default
> starting in Angular 9."*
> *"When you run the `ng build` (build only) or `ng serve` (build and serve locally) CLI commands,
> the type of compilation (JIT or AOT) depends on the value of the `aot` property in your build
> configuration specified in `angular.json`. By default, `aot` is set to `true` for new CLI
> applications."*

⚠️ Where that page goes wrong is §11.05 — these three sentences are the part that is still accurate.

### 11.02.2 What flipping it changes, mechanically — the four things

All four from the CLI at `v22.1.7`, already quoted in §0.6 and §11.02.1:

| # | What changes | Where |
|---|---|---|
| 1 | `define: {'ngJitMode': jit ? 'true' : 'false'}` | `application-code-bundle.ts` |
| 2 | `advancedOptimizations` becomes **false**, whatever `optimization` says | `options.ts` |
| 3 | the linker is told `linkerJitMode: options.jit` | `javascript-transformer-worker.ts` (§10.06.2) |
| 4 | `@angular/compiler` must reach the browser | §11.04 |

**On (1):** `ngJitMode` is a *compile-time guard in generated code*, exactly parallel to `ngDevMode`.
From [`packages/compiler/src/render3/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/util.ts):

```ts
export function jitOnlyGuardedExpression(expr: o.Expression): o.Expression {
  return guardedExpression('ngJitMode', expr);
}

export function devOnlyGuardedExpression(expr: o.Expression): o.Expression {
  return guardedExpression('ngDevMode', expr);
}

function guardedExpression(guard: string, expr: o.Expression): o.Expression {
  const guardExpr = new o.ExternalExpr({name: guard, moduleName: null});
  const guardNotDefined = new o.BinaryOperatorExpr(
    o.BinaryOperator.Identical,
    new o.TypeofExpr(guardExpr),
    o.literal('undefined'),
  );
  const guardUndefinedOrTrue = new o.BinaryOperatorExpr(
    o.BinaryOperator.Or,
    guardNotDefined,
    guardExpr,
    /* type */ undefined,
    /* sourceSpan */ undefined,
  );
  return new o.BinaryOperatorExpr(o.BinaryOperator.And, guardUndefinedOrTrue, expr);
}
```

🔴 **One function, two guards, identical shape:** `(typeof G === 'undefined' || G) && <expr>`.
`ngDevMode` and `ngJitMode` are the same mechanism pointed at two different questions. Topic 12 §12.4
owns the shape; topic 11 owns the observation that there are **two** of them, which nobody expects.

**On (3):** the reason JIT changes what the *linker* emits is in `LinkerOptions`' own doc comment
(§10.04.2, quote it here too): *"in JIT mode, NgModule definitions must describe the `declarations`,
`imports`, `exports`, etc, which are otherwise not needed."*

### 11.02.3 The pointer to topics 05 and 06 — one line, no more

Where `aot` and `optimization` live in `angular.json`, how `configurations` layer them, and what the
`@angular/build` application builder is, belong to **topic 05 — the build** *(not written yet)* and
**topic 06 — `angular.json` anatomy** *(not written yet)*. This chunk says only: `aot` is a boolean
option on the application builder, its default is `true`, and it is set per configuration.

### 11.02.4 Gotchas to write

- **★ Symptom: you set `"aot": false` for a faster build and your production bundle got *bigger* and
  slower, beyond the compiler's own size.** Cause: `advancedOptimizations: !!aot && optimizationOptions.scripts`
  — turning AOT off turns the advanced optimisation pass off too, regardless of your `optimization`
  setting. That pass is what elides class metadata and adds the `/*#__PURE__*/` annotations that let
  the bundler drop unused components (topic 12 §12.6). Fix: leave `aot` at its default; if build
  time is the problem, that is a different lever entirely.
- **★ Symptom: `ngJitMode is not defined` at runtime in a hand-rolled bundler pipeline.** Cause:
  generated code references `ngJitMode` as a bare global, guarded by `typeof ngJitMode ===
  'undefined' || ngJitMode`. The guard makes an *undefined* global safe; a pipeline that half-defines
  it, or that strips the guard, does not. Fix: define it the way the CLI does, as a literal
  substitution, not as a runtime assignment.
- **Symptom: someone says "we build with JIT in development for speed".** Cause: a habit from before
  v9. Fix: the CLI's development configuration still uses `aot: true`; the dev-server's speed comes
  from esbuild and incremental compilation, not from skipping AOT. Turning `aot` off changes what
  the code *is*, not just how fast it built.

### 11.02.5 Interview questions

- **★ How do you switch an Angular application to JIT, and what else changes when you do?** You set
  `"aot": false` on the application builder — there is no `jit` option; the CLI computes `jit: !aot`
  internally. Four things then change. `ngJitMode` is defined as `'true'` instead of `'false'`, so
  JIT-guarded generated code survives. The linker is told `linkerJitMode: true`, so NgModule
  definitions are emitted with the `declarations`/`imports`/`exports` a runtime compiler needs and an
  AOT build does not. `@angular/compiler` has to reach the browser. And — the one people miss —
  `advancedOptimizations` is computed as `!!aot && optimizationOptions.scripts`, so it becomes
  `false` and you lose the metadata elision and pure annotations even in a production configuration.
- **`ngDevMode` and `ngJitMode` — what do they have in common?** They are the same mechanism. One
  helper, `guardedExpression(guard, expr)`, generates
  `(typeof G === 'undefined' || G) && <expr>` for both, and the CLI substitutes both as esbuild
  `define` constants so the guard folds at build time. The difference is only which question is being
  asked and when the answer is set: `ngJitMode` follows `!aot` and is always defined; `ngDevMode` is
  defined **only** when script optimisation is on, and is left undefined otherwise so the runtime can
  turn it into a perf-counter object.

---

## Chunk 11·03 — Where JIT still runs

🔴 **This chunk has to correct two widely-held beliefs at once.** The brief names `TestBed` and
`platform-browser-dynamic`; the second is deprecated (§0.3) and, more surprisingly, **the CLI's own
test setup does not use it.**

### 11.03.1 The three places JIT genuinely runs at v22

| # | Place | Evidence |
|---|---|---|
| 1 | **`TestBed`**, whenever it overrides or recompiles a class | §11.03.2 |
| 2 | **an unlinked partial declaration** reaching the browser | §10.06.3 |
| 3 | **an application built with `aot: false`** | §11.02 |

And two places it is commonly *believed* to run and does not:

- **`platform-browser-dynamic`** — deprecated at Angular 20.0.0 (§0.3), and not what `ng test`
  uses (§11.03.3).
- **the dev server.** `ng serve` uses the same `aot: true` default; there is no JIT development mode
  in the CLI at v22.

### 11.03.2 🔴 `@angular/core/testing` has a hard static import of `@angular/compiler`

From [`packages/core/testing/src/test_bed_compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/testing/src/test_bed_compiler.ts), line 9:

```ts
import {ResourceLoader} from '@angular/compiler';
```

**That single import is the whole answer to "how does JIT get into a test build".** It is a static,
unconditional import in `@angular/core/testing`; loading the testing entry point loads
`@angular/compiler`, whose side effect installs `global.ng.ɵcompilerFacade`, which is what
`getCompilerFacade` looks up. No platform, no configuration, no `platformBrowserDynamic`.

The same file calls the JIT compiler directly when TestBed has to rebuild a class:

```ts
      compileComponent(declaration, metadata);
```

and drains the resource queue the decorator path fills:

```ts
      await ɵresolveComponentResources(resolver);
      …
    ɵclearResolutionOfComponentResourcesQueue().forEach((value, key) =>
```

`TestBed`'s public surface reflects it. From
[`packages/core/testing/src/test_bed.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/testing/src/test_bed.ts):

```ts
  configureCompiler(config: {providers?: any[]; useJit?: boolean}): this {
    if (config.useJit != null) {
      throw new Error('JIT compiler is not configurable via TestBed APIs.');
    }
```

🔴 **`useJit` is not a choice any more — passing it at all throws.** TestBed *is* JIT where it needs
to be, and there is no switch. That error string is a nice one-line proof.

And the error you get for the async-metadata case:

```ts
    if (getAsyncClassMetadataFn(type)) {
      const isCompiled = !!getComponentDef(type);

      if (!isCompiled) {
        throw new Error(
          `Component '${type.name}' has unresolved metadata. ` +
            `Please call \`await TestBed.compileComponents()\` before running this test.`,
        );
      }
    }
```

### 11.03.3 What `ng test` actually initialises — not `platformBrowserDynamic`

From `angular/angular-cli` at `v22.1.7`,
[`packages/angular/build/src/builders/unit-test/runners/vitest/build-options.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/unit-test/runners/vitest/build-options.ts) — this is a **generated setup file**, quoted from the template that produces it:

```ts
      @NgModule({
        providers: [
          ...(typeof Zone !== 'undefined' ? [provideZoneChangeDetection()] : []),
          ...providers,
          { provide: TestComponentRenderer, useClass: DynamicDOMTestComponentRenderer },
        ],
      })
      class TestModule {}

      getTestBed().initTestEnvironment([BrowserTestingModule, TestModule], platformBrowserTesting(), {
        errorOnUnknownElements: true,
        errorOnUnknownProperties: true,
      });
```

🔴 **`platformBrowserTesting()` and `BrowserTestingModule`, from `@angular/platform-browser/testing`
— not `platformBrowserDynamicTesting()`.** So the modern `ng test` stack does not touch the
deprecated package at all; the JIT capability arrives through `@angular/core/testing`'s import of
`@angular/compiler` (§11.03.2), not through a "dynamic" platform.

Two more facts from the same template worth a line:

- `errorOnUnknownElements: true` and `errorOnUnknownProperties: true` are the CLI's defaults for
  tests, not Angular's.
- Zone.js is conditional: `typeof Zone !== 'undefined' ? [provideZoneChangeDetection()] : []`.

⚠️ **The relationship between the test build's `aot` setting and TestBed's JIT usage was not fully
traced.** The unit-test builder's own options file does not set `aot`, so it presumably inherits the
application builder's `true`. See §99.5 — do **not** assert "`ng test` builds AOT" without checking.

### 11.03.4 Why TestBed needs the class metadata that production strips

The chain, each link sourced:

1. `compileClassMetadata`'s own doc comment (§10.02.3) says the decorators are preserved *"to allow
   TestBed APIs to recompile the class using the original decorator with a set of overrides
   applied"*.
2. `setClassMetadata` writes them onto the class as `decorators` / `ctorParameters` /
   `propDecorators`. From
   [`packages/core/src/render3/metadata.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/metadata.ts):

   > *"Adds decorator, constructor, and property metadata to a given type via static metadata fields
   > on the type."*
   > *"These metadata fields can later be read with Angular's `ReflectionCapabilities` API."*
   > *"Calls to `setClassMetadata` can be guarded by ngDevMode, resulting in the metadata assignments
   > being tree-shaken away during production builds."*

3. `ReflectionCapabilities` reads them back. From
   [`packages/core/src/reflection/reflection_capabilities.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/reflection/reflection_capabilities.ts):

   ```ts
     private _ownAnnotations(typeOrFunc: Type<any>, parentCtor: any): any[] | null {
       // Prefer the direct API.
       if ((<any>typeOrFunc).annotations && (<any>typeOrFunc).annotations !== parentCtor.annotations) {
         …
       }

       // API of tsickle for lowering decorators to properties on the class.
       if ((<any>typeOrFunc).decorators && (<any>typeOrFunc).decorators !== parentCtor.decorators) {
         return convertTsickleDecoratorIntoMetadata((<any>typeOrFunc).decorators);
       }
       …
   ```

4. `@angular/core/testing`'s resolvers call it: `const annotations = reflection.annotations(type);`
   ([`packages/core/testing/src/resolvers.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/testing/src/resolvers.ts)).

🔴 **So `TestBed.overrideComponent` works because a production optimiser has not yet run.** That is
the single most useful sentence connecting topics 11 and 12, and it is why "why can't I write a
production-build integration test the way I write a unit test" has a mechanical answer.

### 11.03.5 Gotchas to write

- **★ Symptom: you added `@angular/platform-browser-dynamic` because a guide, or Angular's own JIT
  error message, told you to, and `npm install` printed a deprecation warning.** Cause: the package
  was deprecated in Angular 20.0.0 and carries an npm-level deprecation: *"@angular/platform-browser-dynamic
  is deprecated. Use `@angular/platform-browser` instead."* The error message in `getCompilerFacade`
  still names it. Fix: the same error's *other* suggestion is the current one —
  `import "@angular/compiler";` before bootstrapping — and for tests you need neither, because
  `@angular/core/testing` imports the compiler itself.
- **★ Symptom: `TestBed.configureCompiler({useJit: true})` throws `JIT compiler is not configurable
  via TestBed APIs.`** Cause: the option is gone; the method throws if `useJit != null`. Fix: delete
  the call. There is no JIT/AOT choice inside TestBed.
- **★ Symptom: `Component 'X' has unresolved metadata. Please call \`await
  TestBed.compileComponents()\` before running this test.`** Cause: the component's template
  contains `@defer`, so its metadata was emitted as `ɵɵngDeclareClassMetadataAsync`/
  `setClassMetadataAsync` and is applied only after its deferred dependencies resolve. Fix: what the
  message says — `await TestBed.compileComponents()`. Note this is the *only* remaining common
  reason to call it in a v22 codebase.
- **Symptom: you cannot find where JIT is enabled in your test configuration.** Cause: it is not
  enabled anywhere. `@angular/core/testing` statically imports `@angular/compiler`, which installs
  the compiler facade as a side effect. Fix: nothing to configure — and note the corollary, that
  `@angular/compiler` is in your test bundle whether or not you use JIT features.

### 11.03.6 Interview questions

- **★ Where does JIT compilation still happen in a modern Angular application?** Three places. In
  `TestBed`, whenever a class is overridden or recompiled — and there it is not optional:
  `configureCompiler({useJit})` throws if you pass the flag at all. In a partially-compiled library
  that reached the browser unlinked, where `ɵɵngDeclareComponent` executes and asks for the compiler
  as a fallback. And in an application deliberately built with `aot: false`. What is *not* a place
  any more is `@angular/platform-browser-dynamic`: it was deprecated in Angular 20.0.0 and the CLI's
  own test setup initialises `platformBrowserTesting()` from `@angular/platform-browser/testing`
  instead.
- **★ How does the JIT compiler get into a test bundle if `@angular/compiler` is an optional peer of
  `@angular/core`?** Through a single static import: `@angular/core/testing`'s `test_bed_compiler.ts`
  imports `ResourceLoader` from `@angular/compiler`. Loading `@angular/core/testing` therefore loads
  `@angular/compiler`, whose side effect installs `ɵcompilerFacade` on the `ng` global — which is
  exactly what `getCompilerFacade` looks for. No platform and no configuration are involved, which is
  why there is nothing to switch on and nothing to switch off.
- **Why does `TestBed.overrideComponent` have anything at all to work with?** Because the compiler
  emits the original decorator a second time, as `setClassMetadata(type, decorators, ctorParameters,
  propDecorators)`, explicitly *"to allow TestBed APIs to recompile the class using the original
  decorator with a set of overrides applied"*. `ReflectionCapabilities` reads those static fields back
  and TestBed's resolvers rebuild the metadata from them. The same source comment says the calls
  *"can be guarded by ngDevMode, resulting in the metadata assignments being tree-shaken away during
  production builds"* — so the thing that makes overriding possible is precisely the thing production
  removes.

---

## Chunk 11·04 — Why it is not a deployment option

### 11.04.1 The framework says so in its own error text

From `getCompilerFacade` (§10.06.3), the `Decorator` branch, verbatim:

> *"JIT compilation is discouraged for production use-cases! Consider using AOT mode instead."*

That is a string literal in `@angular/core`. It is the strongest single citation available and the
page should lead with it.

### 11.04.2 The size argument — the only size claim these pages may make

angular.dev, [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler), on the
third reason to use AOT:

> *"Smaller Angular framework download size — There's no need to download the Angular compiler if
> the application is already compiled. The compiler is roughly half of Angular itself, so omitting it
> dramatically reduces the application payload."*

🔴 **"roughly half of Angular itself" is a quote, and quoting it is the only way this corpus is
allowed to talk about the compiler's size** (§0.7). Do not convert it to kilobytes.

The other three reasons on the same page, all quotable verbatim, and each maps to a different thing
this phase already teaches:

> *"Faster rendering — With AOT, the browser downloads a pre-compiled version of the application. The
> browser loads executable code so it can render the application immediately, without waiting to
> compile the application first."*
> *"Fewer asynchronous requests — The compiler inlines external HTML templates and CSS style sheets
> within the application JavaScript, eliminating separate ajax requests for those source files."*
> *"Detect template errors earlier — The AOT compiler detects and reports template binding errors
> during the build step before users can see them."*
> *"Better security — AOT compiles HTML templates and components into JavaScript files long before
> they are served to the client. With no templates to read and no risky client-side HTML or
> JavaScript evaluation, there are fewer opportunities for injection attacks."*

⚠️ **"Fewer asynchronous requests" is the `templateUrl` resolution queue** from §11.01.2 — the
`maybeQueueResolutionOfComponentResources` / `resolveComponentResources` machinery exists only
because of it. Connect the two; the guide states the symptom and the source shows the mechanism.

⚠️ **"Detect template errors earlier" understates it at v22.** Template *type* checking
(`strictTemplates`, on by default since v22 — topic 01 `14f`) is not merely earlier under AOT, it is
**absent** under JIT: the type-check blocks are generated TypeScript in the build, and there is no
build. Say that, and link `14f`.

### 11.04.3 The optimisation argument, which the guide does not make

🔴 **This is the strongest modern argument and it is not on angular.dev at all.** From
`options.ts` (§11.02.1):

```ts
    advancedOptimizations: !!aot && optimizationOptions.scripts,
```

So a JIT build never runs the advanced-optimisation pass, regardless of `optimization`. Topic 12
§12.6 shows exactly what that pass does: it elides `ɵsetClassMetadata`, `ɵsetClassMetadataAsync` and
`ɵsetClassDebugInfo`; it removes `decorators` / `ctorParameters` / `propDecorators` static
assignments; and it wraps `ɵcmp`/`ɵdir`/`ɵfac`/`ɵinj`/`ɵmod`/`ɵpipe`/`ɵprov` in `/*#__PURE__*/`
IIFEs so unused components can be dropped.

**So `aot: false` costs you the compiler's download, template type checking, and tree-shaking of
your own components — three separate bills, not one.**

### 11.04.4 Gotchas to write

- **★ Symptom: a JIT-built application has no template type errors and you conclude the templates
  are clean.** Cause: template type checking is generated TypeScript checked by `tsc` during the
  build. Under JIT there is no such build step, so `strictTemplates` — on by default since v22 —
  checks nothing. Fix: keep `aot: true`; a green JIT build is not evidence.
- **★ Symptom: someone proposes JIT "so users get a smaller first payload since we only compile what
  we use".** Cause: the arithmetic is backwards. JIT ships *the compiler*, which the guide calls
  *"roughly half of Angular itself"*, **plus** every template as an uncompiled string, **plus** it
  disables the pass that would have let the bundler drop unused components. Fix: none — the position
  has no version in which it is true.
- **★ Symptom: a JIT build works locally and breaks under a strict Content-Security-Policy in
  production.** Cause: a runtime compiler generates functions from strings. Fix: this is a structural
  reason AOT exists, and it is the practical form of the guide's *"no risky client-side HTML or
  JavaScript evaluation"*. ⚠️ **I did not verify which specific CSP directive Angular's JIT compiler
  trips** — see §99.6; state the general shape and do not name `unsafe-eval` as though verified.

### 11.04.5 Interview questions

- **★ Give three independent reasons AOT rather than JIT for a deployed application.** One: the
  compiler ships. angular.dev puts it as *"the compiler is roughly half of Angular itself"*, and JIT
  means every user downloads it. Two: template type checking disappears. `strictTemplates` is on by
  default since v22 and it works by generating TypeScript type-check blocks during the build — with
  no build there is nothing to check, so a JIT application has no build-time template errors at all,
  only runtime ones. Three, and the one people miss: the CLI computes
  `advancedOptimizations: !!aot && optimizationOptions.scripts`, so `aot: false` also turns off the
  pass that elides class metadata and adds pure annotations — you lose tree-shaking of your own
  components on top of everything else. Angular's own source is blunter than any of these: the JIT
  error text says *"JIT compilation is discouraged for production use-cases!"*.

---

## Chunk 11·05 — ⚠️ The guide is stale

🔴 **This chunk exists because the primary source is wrong, and this corpus's rule is that the source
wins — so when the source contradicts the shipped compiler, the page must say which is which.**
Topic 01's `10f` and `09e` already do exactly this for the metadata guides; this is the same problem
on the AOT page, and it should cross-link them.

### 11.05.1 What angular.dev's AOT page still describes

Read 2026-09-09 from [https://angular.dev/tools/cli/aot-compiler](https://angular.dev/tools/cli/aot-compiler).
Verbatim, from the "Compilation phases" table:

> *"1 code analysis — In this phase, the TypeScript compiler and AOT collector create a
> representation of the source. The collector does not attempt to interpret the metadata it
> collects. It represents the metadata as best it can and records errors when it detects a metadata
> syntax violation."*
> *"2 code generation — In this phase, the compiler's StaticReflector interprets the metadata
> collected in phase 1, performs additional validation of the metadata, and throws an error if it
> detects a metadata restriction violation."*

and from "Phase 1: Code analysis":

> *"At the same time, the AOT collector analyzes the metadata recorded in the Angular decorators and
> outputs metadata information in `.metadata.json` files, one per `.d.ts` file."*
> *"You can think of `.metadata.json` as a diagram of the overall structure of a decorator's
> metadata, represented as an abstract syntax tree (AST)."*

and from "No arrow functions":

> *"The AOT compiler does not support function expressions and arrow functions, also called lambda
> functions."*

and from "How AOT works":

> *"The Angular compiler extracts the metadata once and generates a factory for `Typical`."*

### 11.05.2 🔴 Why every one of those is describing a compiler Angular stopped shipping

| The page says | What v22 actually does | Where this corpus proves it |
|---|---|---|
| an *"AOT collector"* | `ngtsc`, a TypeScript **transformer**, with a *partial evaluator* | `01/13-where-the-compiler-runs-ngtsc.md`, `01/09c-the-partial-evaluator-is-the-grammar.md` |
| *"`.metadata.json` files, one per `.d.ts`"* | nothing of the kind; metadata lives in the `.d.ts` as `ɵɵComponentDeclaration` type arguments, and in npm packages as `ɵɵngDeclare*` calls | `01/06d`, and **topic 10 §10.02** |
| *"the compiler's `StaticReflector`"* | not a v22 concept | — |
| *"generates a factory"* | generates `ɵcmp` (a definition) plus `ɵfac` (a factory) — the guide's model predates the split | `01/06`, `01/06d` |
| *"does not support … arrow functions"* | ⚠️ **false as stated** — this corpus has already established that the folk rule is wrong | `01/09d-the-single-return-function-rule.md`, `01/10f-destructuring-in-metadata.md` |

The `.metadata.json` sentence is the decisive one: **`.metadata.json` is exactly the pre-Ivy
mechanism that partial compilation replaced**, and `01/12f` quotes the design doc explaining why. So
the AOT guide is describing the world *before* topic 10 exists.

### 11.05.3 What on that page is still true, and should be quoted

Only three things, and topic 11 quotes all three elsewhere:

1. The JIT/AOT definitions and their default-version history (§11.02.1).
2. The `aot` property in `angular.json` and its `true` default (§11.02.1).
3. The four "reasons" bullets (§11.04.2).

Everything from *"How AOT works"* downward on that page should be treated as historical.

### 11.05.4 Gotchas to write

- **★ Symptom: you followed angular.dev's AOT page, looked for `.metadata.json` files in your
  library's `dist/`, and found none.** Cause: `.metadata.json` was the pre-Ivy library metadata
  format; it was replaced by partial compilation, which puts the metadata in the emitted JavaScript
  as `ɵɵngDeclare*` calls and in the `.d.ts` as declaration types. Fix: look at the `.mjs`
  (**[10 · 02](02-a-real-published-declaration.md)**) and the `.d.ts`
  (`01/06d`). The guide is describing a compiler Angular stopped shipping.
- **★ Symptom: you rewrote a `useFactory: () => new Server()` into an exported function because the
  AOT guide said arrow functions are unsupported, and nothing changed.** Cause: that section
  describes the pre-Ivy collector. `01/09d` establishes from the shipped partial evaluator that a
  helper *is* called provided its body is a single `return`. Fix: read `01/09d` and `01/10f` for the
  rules the compiler actually applies; do not use the AOT guide as a metadata reference.
- **Symptom: you cite "the compiler's StaticReflector" in a design document or a code review.**
  Cause: the AOT guide. Fix: `ngtsc` is a TypeScript transformer and the relevant component is the
  partial evaluator; `01/13` and `01/09c` are the accurate description.

### 11.05.5 Interview questions

- **★ angular.dev's AOT page describes an "AOT collector" writing `.metadata.json` files and a
  `StaticReflector` interpreting them. Is that how Angular 22 compiles?** No — that is the pre-Ivy
  compiler. Angular 22 runs `ngtsc` as a TypeScript transformer with a partial evaluator, emits
  `ɵcmp`/`ɵfac` per class from that class's own file, and — for libraries — emits `ɵɵngDeclare*`
  calls whose whole purpose was to *replace* `.metadata.json`. The tell is right there in the page's
  own text: `.metadata.json` is the mechanism partial compilation exists to remove, so a page that
  still teaches it cannot be describing a version that has partial compilation. The parts of that
  page that remain accurate are the JIT/AOT definitions, the `aot` build option, and the four
  reasons to prefer AOT; everything from "How AOT works" down is historical.

---

# TOPIC 12 — Dev-mode-only behaviour

**Proposed directory:** `12-dev-mode-only-behaviour/`
**Proposed chunk plan (7):**

| # | Filename | Covers |
|---|---|---|
| 01 | `01-what-ngdevmode-actually-is.md` | 🔴 The `declare global` block verbatim; four possible values; the perf counters; `?ngDevMode=false` |
| 02 | `02-isdevmode-and-enableprodmode.md` | Both functions in full; why `enableProdMode` is discouraged; the terser comment |
| 03 | `03-how-the-flag-gets-its-value.md` | 🔴 `define: {'ngDevMode': 'false'}` gated on `optimization.scripts`, not on the configuration name |
| 04 | `04-the-shape-of-a-dev-only-guard.md` | `devOnlyGuardedExpression`; branch-not-return; hand-off to `03/16c` |
| 05 | `05-what-actually-vanishes.md` | The inventory, with a row per check and a source for each |
| 06 | `06-class-metadata-and-the-elision-pass.md` | 🔴 `setClassMetadata`/`setClassDebugInfo` and the oxc pass that removes them |
| 07 | `07-provide-ng-reflect-attributes.md` | The runtime side: `NG_REFLECT_ATTRS_FLAG`, the 30-character truncation, hand-offs to `03/11g` and `03/12h` |

No filenames are fixed by inbound links.

---

## Chunk 12·01 — What `ngDevMode` actually is

🔴 **The prompt for this topic flagged this as the thing that is easy to assert and hard to prove.
It is provable, and here is the proof.**

### 12.01.1 The declaration, verbatim — it is a global, and its type is not `boolean`

From [`packages/core/src/util/ng_dev_mode.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/util/ng_dev_mode.ts):

```ts
declare global {
  /**
   * Values of ngDevMode
   * Depending on the current state of the application, ngDevMode may have one of several values.
   *
   * For convenience, the “truthy” value which enables dev mode is also an object which contains
   * Angular’s performance counters. This is not necessary, but cuts down on boilerplate for the
   * perf counters.
   *
   * ngDevMode may also be set to false. This can happen in one of a few ways:
   * - The user explicitly sets `window.ngDevMode = false` somewhere in their app.
   * - The user calls `enableProdMode()`.
   * - The URL contains a `ngDevMode=false` text.
   * Finally, ngDevMode may not have been defined at all.
   */
  const ngDevMode: null | NgDevModePerfCounters;

  interface NgDevModePerfCounters {
    hydratedNodes: number;
    hydratedComponents: number;
    dehydratedViewsRemoved: number;
    dehydratedViewsCleanupRuns: number;
    componentsSkippedHydration: number;
    deferBlocksWithIncrementalHydration: number;
  }
}
```

🔴 **Four facts, and they settle almost every question anyone has about `ngDevMode`.**

1. **It is a `declare global`, not an export.** You never import it. It is referenced as a bare
   identifier in generated code and in framework source, and it is *supplied* — by a build-time
   substitution, by the runtime initialiser, or by nothing at all.
2. **Its declared type is `null | NgDevModePerfCounters`** — never `boolean`. The comment explains
   why: *"the 'truthy' value which enables dev mode is also an object which contains Angular's
   performance counters. This is not necessary, but cuts down on boilerplate for the perf
   counters."*
3. **It has four possible states**, and the doc comment enumerates them: an object (dev), `false`
   (set explicitly, or by `enableProdMode()`, or by `ngDevMode=false` in the URL), and *"ngDevMode
   may not have been defined at all"*. **That fourth state is why every guard in Angular is
   `typeof ngDevMode === 'undefined' || ngDevMode` and not just `ngDevMode`** — see §12.04.
4. 🔴 **`ngDevMode=false` in the URL turns it off.** That is a documented, shipped mechanism almost
   nobody knows about. §12.01.3 has the code.

### 12.01.2 The six perf counters are all about hydration

`hydratedNodes`, `hydratedComponents`, `dehydratedViewsRemoved`, `dehydratedViewsCleanupRuns`,
`componentsSkippedHydration`, `deferBlocksWithIncrementalHydration`.

Worth a sentence: the counters that survive in v22 are entirely a hydration-debugging surface. So
`ngDevMode` in a browser console is not a boolean you inspect — it is a small object whose fields
tell you how an SSR hydration pass went. Hydration itself belongs to a later phase; **name the
counters and stop**.

### 12.01.3 `initNgDevMode` — how the object comes into existence

From the same file, in full:

```ts
function ngDevModeResetPerfCounters(): NgDevModePerfCounters {
  const locationString = typeof location !== 'undefined' ? location.toString() : '';
  const newCounters: NgDevModePerfCounters = {
    hydratedNodes: 0,
    hydratedComponents: 0,
    dehydratedViewsRemoved: 0,
    dehydratedViewsCleanupRuns: 0,
    componentsSkippedHydration: 0,
    deferBlocksWithIncrementalHydration: 0,
  };

  // Make sure to refer to ngDevMode as ['ngDevMode'] for closure.
  const allowNgDevModeTrue = locationString.indexOf('ngDevMode=false') === -1;
  if (!allowNgDevModeTrue) {
    global['ngDevMode'] = false;
  } else {
    if (typeof global['ngDevMode'] !== 'object') {
      global['ngDevMode'] = {};
    }
    Object.assign(global['ngDevMode'], newCounters);
  }
  return newCounters;
}

/**
 * This function checks to see if the `ngDevMode` has been set. If yes,
 * then we honor it, otherwise we default to dev mode with additional checks.
 *
 * The idea is that unless we are doing production build where we explicitly
 * set `ngDevMode == false` we should be helping the developer by providing
 * as much early warning and errors as possible.
 *
 * `ɵɵdefineComponent` is guaranteed to have been called before any component template functions
 * (and thus Ivy instructions), so a single initialization there is sufficient to ensure ngDevMode
 * is defined for the entire instruction set.
 *
 * When checking `ngDevMode` on toplevel, always init it before referencing it
 * (e.g. `((typeof ngDevMode === 'undefined' || ngDevMode) && initNgDevMode())`), otherwise you can
 *  get a `ReferenceError` like in https://github.com/angular/angular/issues/31595.
 *
 * Details on possible values for `ngDevMode` can be found on its docstring.
 */
export function initNgDevMode(): boolean {
  // The below checks are to ensure that calling `initNgDevMode` multiple times does not
  // reset the counters.
  // If the `ngDevMode` is not an object, then it means we have not created the perf counters
  // yet.
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    if (typeof ngDevMode !== 'object' || Object.keys(ngDevMode).length === 0) {
      ngDevModeResetPerfCounters();
    }
    return typeof ngDevMode !== 'undefined' && !!ngDevMode;
  }
  return false;
}
```

🔴 **The three loud things in that block.**

1. **The URL check is `locationString.indexOf('ngDevMode=false') === -1`** — a plain substring test
   over the *whole* URL string, not a query-parameter parse. So `?ngDevMode=false`,
   `#ngDevMode=false`, and a path segment containing the text all work; and so does a URL that
   happens to contain the substring for an unrelated reason. Worth a gotcha.
2. **The default is dev mode.** The doc comment states the policy: *"unless we are doing production
   build where we explicitly set `ngDevMode == false` we should be helping the developer by
   providing as much early warning and errors as possible."* An undefined `ngDevMode` means dev,
   never prod. **This is why the CLI never defines it as `true` (§0.6) — it does not need to.**
3. **`ɵɵdefineComponent` is the initialisation site**, and the comment says why that is sufficient:
   it is *"guaranteed to have been called before any component template functions (and thus Ivy
   instructions), so a single initialization there is sufficient to ensure ngDevMode is defined for
   the entire instruction set."* That is a nice connection to `01/06b-inside-definecomponent.md` —
   **link it**.
4. **The `ReferenceError` footnote.** `typeof ngDevMode === 'undefined' || ngDevMode` is not
   defensive style; without the `typeof` guard a bare reference to an undeclared global throws.
   Angular links its own issue #31595 for it.

### 12.01.4 Gotchas to write

- **★ Symptom: `console.log(ngDevMode)` in the browser prints an object with `hydratedNodes` in it,
  and you conclude something hydration-related is running.** Cause: `ngDevMode`'s truthy value *is*
  the perf-counter object — *"this is not necessary, but cuts down on boilerplate for the perf
  counters"*. The object's existence means "development mode", not "hydration ran". Fix: read the
  counters' values, not the object's presence.
- **★ Symptom: adding `?ngDevMode=false` to a URL made a development build behave like production
  in some ways and not others.** Cause: the URL switch sets the *runtime* global to `false`, so
  every `if (ngDevMode)` branch stops running — but nothing was removed from the bundle, class
  metadata is still there, error strings are still there, and code already executed before
  `initNgDevMode` ran is unaffected. Fix: it is a runtime toggle, not a build mode; use it to
  reproduce a *behaviour*, never to estimate a bundle.
- **★ Symptom: a URL unrelated to Angular flipped dev mode off.** Cause: the check is
  `locationString.indexOf('ngDevMode=false') === -1` over the entire URL string — any occurrence
  anywhere, in a path, a hash or another parameter's value, matches. Fix: know it exists; it is a
  genuine (if unlikely) way to get a "works on my machine" split.
- **★ Symptom: `ReferenceError: ngDevMode is not defined` in code you wrote, in a pipeline that is
  not the Angular CLI.** Cause: you referenced the bare global without the `typeof` guard, in an
  environment where nothing defined it. Angular's own comment names the issue (#31595) and the fix.
  Fix: use the framework's shape exactly —

  ```ts
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    // dev-only
  }
  ```

  and note that inside `@angular/core`'s own build a plain `ngDevMode &&` is safe because
  `ɵɵdefineComponent` has already initialised it; **in your code it may not have.**

### 12.01.5 Interview questions

- **★ What type is `ngDevMode`?** `null | NgDevModePerfCounters` — declared as a global `const`, not
  a boolean and not an import. Its truthy value is an object carrying six hydration performance
  counters, which the source describes as a convenience: *"the 'truthy' value which enables dev mode
  is also an object … This is not necessary, but cuts down on boilerplate for the perf counters."*
  It has four states in practice: the counter object, `false`, and — the one that shapes every guard
  in the framework — not defined at all. Undefined means *development*, because the policy is that
  unless a production build has explicitly set it false, the framework should give the developer as
  much warning as it can.
- **★ Name three ways `ngDevMode` can become falsy.** The source lists them: someone sets
  `window.ngDevMode = false` directly; someone calls `enableProdMode()`; or the URL contains the text
  `ngDevMode=false`. And a fourth, which is the one that matters in practice and is not in that list
  because it is not a runtime event at all: the CLI substitutes the literal `false` at build time when
  script optimisation is enabled, so the guards fold and are eliminated rather than evaluated.

---

## Chunk 12·02 — `isDevMode()` and `enableProdMode()`

### 12.02.1 Both functions, in full

From [`packages/core/src/util/is_dev_mode.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/util/is_dev_mode.ts) — the whole file minus the licence header:

```ts
/**
 * Returns whether Angular is in development mode.
 *
 * By default, this is true, unless `enableProdMode` is invoked prior to calling this method or the
 * application is built using the Angular CLI with the `optimization` option.
 * @see {@link /cli/build ng build}
 *
 * @publicApi
 */
export function isDevMode(): boolean {
  return typeof ngDevMode === 'undefined' || !!ngDevMode;
}

/**
 * Disable Angular's development mode, which turns off assertions and other
 * checks within the framework.
 *
 * One important assertion this disables verifies that a change detection pass
 * does not result in additional changes to any bindings (also known as
 * unidirectional data flow).
 *
 * Using this method is discouraged as the Angular CLI will set production mode when using the
 * `optimization` option.
 * @see {@link /cli/build ng build}
 *
 * @publicApi
 */
export function enableProdMode(): void {
  // The below check is there so when ngDevMode is set via terser
  // `global['ngDevMode'] = false;` is also dropped.
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    global['ngDevMode'] = false;
  }
}
```

Both are `@publicApi`, and both appear plainly in
[`goldens/public-api/core/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/core/index.api.md):

```ts
export function enableProdMode(): void;
export function isDevMode(): boolean;
```

### 12.02.2 🔴 `isDevMode()` is a one-line read of the global — that is the whole point

`return typeof ngDevMode === 'undefined' || !!ngDevMode;`

**There is no state of its own.** `isDevMode()` is a *public, documented* accessor for the same
global the framework's internal guards read directly. Two consequences the page should draw:

- **It cannot be tree-shaken the way an inline guard can.** `if (ngDevMode) {…}` becomes
  `if (false) {…}` and disappears; `if (isDevMode()) {…}` becomes a call to a function whose body
  contains the folded constant. Whether a given bundler then inlines and folds it was **not
  verified** — see §99.9. **Say "prefer the inline guard for code that must not ship" and cite
  `03/16c`'s ESBuild comment, not a claim about `isDevMode()`.**
- **It is the right tool for *branching*, not for *removing*.** If you want two behaviours, use
  `isDevMode()`. If you want code gone, use the guard shape in §12.04.

### 12.02.3 🔴 The `enableProdMode` comment is the best single sentence about build-time substitution

```ts
  // The below check is there so when ngDevMode is set via terser
  // `global['ngDevMode'] = false;` is also dropped.
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    global['ngDevMode'] = false;
  }
```

Read it slowly. The `if` is not protecting against double-calls. **It exists so that when the
minifier has already substituted `ngDevMode` with `false`, the condition folds to `false` and the
assignment — the entire body of the public function — is eliminated.** `enableProdMode()` optimises
*itself* out of a production bundle.

That is the same argument `03/16c-what-a-production-build-tells-you.md` quotes from
`r3_injector.ts` — *"ESBuild is conservative about removing dead code that follows `return;` …
Using a conditional ensures the dev-only logic is reliably tree-shaken in production builds"* — and
the two together are the strongest possible case for the guard shape. **Quote `16c`'s version by
link and this one in full; they are different files making the same argument.**

### 12.02.4 What the JSDoc concedes

> *"Using this method is discouraged as the Angular CLI will set production mode when using the
> `optimization` option."*

🔴 **The official documentation of `enableProdMode` names `optimization` — not `production`, not
`ng build --configuration production`.** It is the same rule §0.6 reads out of the CLI's `define`
block, stated in `@angular/core`'s own JSDoc. Two independent sources, one rule; the page should use
both.

And the JSDoc for `isDevMode` says the same thing from the other side: *"By default, this is true,
unless `enableProdMode` is invoked prior to calling this method or the application is built using
the Angular CLI with the `optimization` option."*

### 12.02.5 Gotchas to write

- **★ Symptom: you call `enableProdMode()` in `main.ts` and nothing changes in a production build.**
  Cause: nothing was left to change — the CLI already substituted `ngDevMode` with `false`, and the
  function's own body is guarded so it folds away too. The call is a no-op that predates the CLI
  doing this for you. Fix: delete it; the JSDoc says *"using this method is discouraged"*.
- **★ Symptom: you call `enableProdMode()` in a *development* build to test production behaviour,
  and only some things change.** Cause: it sets the runtime global to `false`, so runtime `if
  (ngDevMode)` branches stop running — but the code is all still in the bundle, class metadata is
  still attached, and anything that already read `ngDevMode` before your call is unaffected. It is
  the same partial simulation as `?ngDevMode=false` (§12.01.4). Fix: use a real production build to
  reason about production.
- **★ Symptom: you used `isDevMode()` to keep a large debug panel out of the production bundle and it
  is still there.** Cause: `isDevMode()` is a function call, not a foldable constant, so the
  bundler's dead-code elimination has strictly less to work with than with `if (ngDevMode)`. Fix:
  wrap with the inline guard for *removal*; reserve `isDevMode()` for *branching*. (⚠️ Do not claim
  a specific bundler outcome — §99.9.)
- **Symptom: `enableProdMode()` after bootstrap has no effect on messages you already saw.** Cause:
  ordering. Its own JSDoc says *"unless `enableProdMode` is invoked prior to calling this method"*.
  Fix: nothing — this is another argument for letting the build set it.

### 12.02.6 Interview questions

- **★ What does `enableProdMode()` do in an Angular 22 CLI application?** Effectively nothing, and
  its own source explains why. Its body is `if (typeof ngDevMode === 'undefined' || ngDevMode) {
  global['ngDevMode'] = false; }`, and the comment above it says the condition exists *"so when
  ngDevMode is set via terser, `global['ngDevMode'] = false;` is also dropped"* — the function
  optimises itself away once the build has substituted the constant. The JSDoc is explicit that
  *"using this method is discouraged as the Angular CLI will set production mode when using the
  `optimization` option"*. It is a leftover from before the CLI did this, and the only thing it is
  still good for is temporarily flipping a *development* build's runtime behaviour, which simulates
  production behaviour but not production output.
- **`isDevMode()` versus `if (ngDevMode)` — when would you use each?** `isDevMode()` is a public,
  one-line read of the same global: `typeof ngDevMode === 'undefined' || !!ngDevMode`. Use it when
  you want two behaviours and both are meant to ship. Use the inline `if (ngDevMode) { … }` when you
  want the code *gone*, because that is a condition a bundler can fold to `false` and eliminate
  whole, which is precisely the argument the framework makes about its own dev-only code — and,
  neatly, the argument `enableProdMode` applies to itself.

---

## Chunk 12·03 — How the flag gets its value in a build

🔴 **This chunk is the most useful one in topic 12 and the one most likely to be got wrong. It has
one job: kill the belief that `ngDevMode` follows the `production` configuration.**

### 12.03.1 The `define` block, and the comment that settles it

§0.6 carries the block; quote it in full on the page. The load-bearing three lines:

```ts
      // Only set to false when script optimizations are enabled. It should not be set to true because
      // Angular turns `ngDevMode` into an object for development debugging purposes when not defined
      // which a constant true value would break.
      ...(optimizationOptions.scripts ? { 'ngDevMode': 'false' } : undefined),
```

**Read as three claims:**

1. **The condition is `optimizationOptions.scripts`.** Not `configuration === 'production'`; the CLI
   has no idea what your configuration is called at this point. `optimization.scripts` is a boolean
   from the builder schema (its `optimization` option is `true` by default and expands to
   `{scripts, styles, fonts}`).
2. **It is never set to `true`.** The comment says why: `ngDevMode` is an *object* at runtime and
   *"a constant true value would break"* the counters (§12.01).
3. **Therefore development builds get `undefined`, and `undefined` means dev** by
   `initNgDevMode`'s policy (§12.01.3). The two halves fit exactly.

Corroborating source, independent of the CLI: `isDevMode`'s own JSDoc (§12.02.4) —
*"the application is built using the Angular CLI with the **`optimization`** option"*.

### 12.03.2 🔴 The server bundle follows the same rule — and this closes an open ⚠️ in this corpus

From `application-code-bundle.ts` (§0.6):

```ts
function getEsBuildServerCommonOptions(options: NormalizedApplicationBuildOptions): BuildOptions {
  const isNodePlatform = options.ssrOptions?.platform !== Platform.Neutral;

  const commonOptions = getEsBuildCommonOptions(options);
  commonOptions.define ??= {};
  commonOptions.define['ngServerMode'] = 'true';
  …
```

It builds on `getEsBuildCommonOptions(options)` — the same function containing the `ngDevMode` rule
— and overrides exactly one key. **So the server bundle's `ngDevMode` is `'false'` under the same
condition as the browser bundle's: `optimizationOptions.scripts`.**

⚠️ **State the limit precisely.** This says the two bundles are produced from one options object
with one `optimization` setting, so they agree. It does **not** prove anything about a hand-rolled
SSR pipeline, about `@angular/ssr` at runtime, or about a workspace that configures a separate
server target. Write it as: *"in a `@angular/build` application build, the server bundle inherits the
browser bundle's `ngDevMode` rule, because the server options are the common options with
`ngServerMode` overridden."*

**Three pages in this corpus carry an explicit ⚠️ saying this was not verified.** See §100.2 — they
are `03/05g`, and by extension `03/17d` and `03/15`. This is the read that settles the CLI half of
it. **Not mine to edit.**

### 12.03.3 The four `ng*` globals as a table — this is the chunk's reference exhibit

| Global | Value in a CLI build | Set by | Owned by |
|---|---|---|---|
| `ngDevMode` | `'false'` **iff** `optimization.scripts`; otherwise **not defined** | esbuild `define` | topic 12 |
| `ngJitMode` | `'true'` iff `aot: false`; `'false'` otherwise — **always defined** | esbuild `define` | topic 11 §11.02 |
| `ngServerMode` | `'false'` in the browser bundle, `'true'` in the server bundle | esbuild `define` (+ a `globalThis` banner for some entry points) | Phase 12 / SSR |
| `ngHmrMode` | `'true'` iff `options.templateUpdates` | esbuild `define` | topic 05 *(not written yet)* |

🔴 **`ngDevMode` is the only one of the four that is conditionally *absent*.** Every other flag is
always defined, both ways. That asymmetry is the entire reason its guards are written
`typeof x === 'undefined' || x` and the others could have been simpler.

⚠️ `ngServerMode` also appears as a `globalThis['ngServerMode'] = true;` banner line in two places in
the same file. I did not trace which entry points get the banner versus the define; **do not
characterise it beyond "both mechanisms are used"** (§99.10).

### 12.03.4 Gotchas to write

- **★ Symptom: your production build still shows full Angular error messages and `window.ng` in the
  console.** Cause: the configuration you built has `"optimization": false` (or
  `"optimization": {"scripts": false}`). `ngDevMode` is defined as `'false'` **only** when script
  optimisation is on; the configuration's *name* is irrelevant. Fix: check
  `optimization`, not the configuration name:

  ```json
  {
    "configurations": {
      "production": {
        "optimization": { "scripts": true, "styles": true, "fonts": true }
      }
    }
  }
  ```

- **★ Symptom: a "development-like" configuration you built for a staging environment behaves like
  production — no `NG0201` text, no `ng` global — and you cannot work out why.** Cause: the same rule
  in the other direction. Someone turned script optimisation on. Fix: same check.
- **★ Symptom: you expected `ngDevMode === true` in a development build and got an object.** Cause:
  the CLI deliberately never defines it as `true`, because *"Angular turns `ngDevMode` into an object
  for development debugging purposes when not defined which a constant true value would break"*. Fix:
  test truthiness, never `=== true`.
- **★ Symptom: an SSR production deployment logs Angular's full development error text on the server
  and the six-character code in the browser.** Cause: in a `@angular/build` application build this
  should not happen — the server options are the common options with only `ngServerMode` overridden,
  so both bundles get the same `ngDevMode` treatment. If you see the split, something outside the
  application builder produced the server bundle. Fix: check whether the server artefact came from
  `@angular/build` at all, and whether the target that produced it has `optimization` on. ⚠️ Frame
  this as a diagnostic, not as a guarantee (§99.11).

### 12.03.5 Interview questions

- **★ Which build setting turns Angular's development mode off?** `optimization` — specifically
  `optimization.scripts` — and **not** the configuration named `production`. The CLI's esbuild
  `define` block sets `'ngDevMode': 'false'` only when script optimisation is enabled, with a comment
  saying it must never be set to `true` because Angular turns `ngDevMode` into a perf-counter object
  when it is undefined *"which a constant true value would break"*. `@angular/core` says the same
  thing from its own side: `isDevMode`'s JSDoc names *"the Angular CLI with the `optimization`
  option"*. So a `production` configuration with optimisation off ships development semantics, and a
  `development` configuration with optimisation on ships production ones.
- **Does an SSR server bundle get the same treatment?** In a `@angular/build` application build, yes.
  `getEsBuildServerCommonOptions` calls `getEsBuildCommonOptions(options)` — the function containing
  the `ngDevMode` rule — and overrides exactly one key, `ngServerMode`. So both bundles are produced
  from the same `optimization` setting and agree about `ngDevMode`. That is worth knowing because a
  disagreement is the classic cause of "the server logs a full Angular error and the browser logs six
  characters", and it tells you where to look: at whatever produced the server artefact, not at the
  framework.

---

## Chunk 12·04 — The shape of a dev-only guard

### 12.04.1 The generator, verbatim

§11.02.2 quotes `guardedExpression` in full from
[`packages/compiler/src/render3/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/util.ts).
Quote it here too — it is topic 12's own material as much as topic 11's — and read out what it
generates:

```js
(typeof ngDevMode === 'undefined' || ngDevMode) && <expression>
```

**Three properties, each with a reason:**

1. **`typeof ngDevMode === 'undefined'` first.** Because the global may genuinely not exist, and a
   bare reference to an undeclared identifier throws a `ReferenceError` — Angular links its own issue
   #31595 in `initNgDevMode`'s doc comment (§12.01.3).
2. **`|| ngDevMode`** — undefined means development (§12.01.3's policy).
3. **`&& <expression>`**, not `if`. Because the compiler is emitting an *expression*, not a
   statement, and because `false && X` is the most reliably eliminable thing a minifier can be
   handed.

### 12.04.2 Branch, never guard-clause — and the source that argues it

`03/16c-what-a-production-build-tells-you.md` already quotes `r3_injector.ts`:

> *"Note: we use `if (ngDevMode) { ... }` instead of an early return. ESBuild is conservative about
> removing dead code that follows `return;` inside a function body, so the block may remain in the
> bundle. Using a conditional ensures the dev-only logic is reliably tree-shaken in production
> builds."*

**Quote it once here, credit `16c`, and link.** Then add the *second* instance of the same argument,
which `16c` does not have: `enableProdMode`'s own comment (§12.02.3), where the framework applies
the technique to a public function's entire body.

Two independent files, same argument, one written about a private helper and one about a public API.
That pairing is the chunk's strongest content and it is new.

### 12.04.3 The three shapes you will see in Angular's own source

All observed in files read this session:

| Shape | Where it appears | Why |
|---|---|---|
| `typeof ngDevMode === 'undefined' \|\| ngDevMode` | generated code; `@angular/core` top-level statements; public entry points (`isDevMode`, `enableProdMode`, `getCompilerFacade`, `ApplicationRef.tick`) | the global may not exist here |
| bare `ngDevMode &&` | deep inside `render3` (`application_ref.ts` line 67, `change_detection.ts`, `directive.ts`) | safe because `ɵɵdefineComponent` has already run `initNgDevMode` |
| `!!ngDevMode` | where a `boolean` is required — `configurable: !!ngDevMode`, `const checkNoChangesMode = !!ngDevMode && …` | the value is an object, not a boolean |

🔴 **The bare form is safe *for Angular* and not necessarily for you**, and the reason is the
`ɵɵdefineComponent` guarantee quoted in §12.01.3. In application code, use the `typeof` form. That
distinction is genuinely useful and is not written down anywhere in the docs.

### 12.04.4 Gotchas to write

- **★ Symptom: your dev-only validation is still in the production bundle.** Cause: you wrote it as a
  guard clause (`if (!ngDevMode) return …;` then the check), and the minifier will not reliably drop
  statements *after* a `return`. Fix: wrap, never guard — `03/16c` ships the ✗/✓ code pair for this;
  **link it rather than duplicating the example**.
- **★ Symptom: `ReferenceError: ngDevMode is not defined` from your own library, only in some
  consumers' builds.** Cause: you copied the bare `ngDevMode &&` form out of `render3` source. That
  form is only safe because `@angular/core` guarantees `ɵɵdefineComponent` ran first; your library
  has no such guarantee. Fix: use `typeof ngDevMode === 'undefined' || ngDevMode`.
- **★ Symptom: `ngDevMode === true` is never true, even in development.** Cause: the truthy value is
  the perf-counter *object*. Fix: `!!ngDevMode`, or just use it in a boolean position.
- **Symptom: you want a TypeScript type for `ngDevMode` in your own library and cannot find one to
  import.** Cause: it is `declare global`, not an export; the type `NgDevModePerfCounters` is
  declared in the same global block. Fix: it is ambient once `@angular/core`'s types are in the
  program; you do not import it and you should not redeclare it.

### 12.04.5 Interview questions

- **★ Why is Angular's dev-only code always `if (ngDevMode) { … }` and never an early `return`?**
  Because the two are not equivalent to a bundler. `ngDevMode` is substituted with the literal
  `false` at build time, so a conditional whose test folds to `false` has its whole branch
  eliminated; statements sequenced *after* a `return` are not eliminated with the same confidence.
  Angular says so twice in its own source. `r3_injector.ts`: *"ESBuild is conservative about removing
  dead code that follows `return;` inside a function body, so the block may remain in the bundle.
  Using a conditional ensures the dev-only logic is reliably tree-shaken in production builds."* And
  `enableProdMode` applies the same trick to itself — its entire body is wrapped in
  `if (typeof ngDevMode === 'undefined' || ngDevMode)` with the comment *"so when ngDevMode is set via
  terser, `global['ngDevMode'] = false;` is also dropped."*
- **Angular's own source sometimes writes `ngDevMode &&` and sometimes `typeof ngDevMode ===
  'undefined' || ngDevMode`. Which should you copy?** The long one. The short one is only safe inside
  `@angular/core`'s render engine, where `ɵɵdefineComponent` is guaranteed to have called
  `initNgDevMode` before any instruction runs — the source says exactly that, and links the
  `ReferenceError` issue (#31595) that made them write it down. Your library has no such ordering
  guarantee, so a bare reference to an undeclared global can throw.

---

## Chunk 12·05 — What actually vanishes

🔴 **This is the inventory chunk. Every row needs a source, and the rows split into three kinds that
must not be conflated:** *the check disappears*, *the message disappears but the throw remains*, and
*the check remains and only the diagnosis disappears*. That three-way split is the chunk's argument.

### 12.05.1 Kind A — the check itself does not run

**`checkNoChanges` / `ExpressionChangedAfterItHasBeenCheckedError` (NG0100).** From
[`packages/core/src/application/application_ref.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_ref.ts):

```ts
  private tickImpl = (): void => {
    (typeof ngDevMode === 'undefined' || ngDevMode) && warnIfDestroyed(this._destroyed);
    …
      this._runningTick = true;
      this.synchronize();
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        for (let view of this.allViews) {
          view.checkNoChanges();
        }
      }
```

🔴 **The entire second change-detection pass is inside one `if (ngDevMode)`.** NG0100 is not a
message that gets shorter in production — the *check that produces it never happens*. Unidirectional
data flow is enforced in development only. (`enableProdMode`'s JSDoc says so in prose: *"One
important assertion this disables verifies that a change detection pass does not result in
additional changes to any bindings (also known as unidirectional data flow)."*)

`change_detection.ts` corroborates from the instruction side
([link](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/change_detection.ts)):

```ts
  const checkNoChangesMode = !!ngDevMode && isInCheckNoChangesMode();
  …
    if (ngDevMode && isExhaustiveCheckNoChanges()) {
```

**`window.ng` — the whole console debugging surface.** Same file:

```ts
export function publishDefaultGlobalUtils() {
  ngDevMode && _publishDefaultGlobalUtils();
}
```

and from [`packages/core/src/render3/util/global_utils.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/util/global_utils.ts):

> *"Publishes the given function to `window.ng` so that it can be used from the browser console when
> an application is not in production."*

🔴 **`ng.getComponent()`, `ng.applyChanges()`, `ng.getInjector()`, the injector profiler that Angular
DevTools reads — none of it exists in a production build.** `publishDefaultGlobalUtils` also calls
`setupFrameworkInjectorProfiler()` (only `if (typeof window !== 'undefined')`), so the DI profiling
data DevTools shows is dev-only too.

⚠️ There is a second gate in `publishUtil`: `if (typeof COMPILED === 'undefined' || !COMPILED)`, a
Closure Compiler flag with its own explanatory comment. Name it as a second, Closure-specific gate;
do not claim the CLI sets it (§99.12).

### 12.05.2 Kind B — the throw remains, the message does not

**Every `RuntimeError` whose second argument is `ngDevMode && '…'`.** Examples read this session, all
from `application_ref.ts`:

```ts
      throw new RuntimeError(
        RuntimeErrorCode.RECURSIVE_APPLICATION_REF_TICK,
        ngDevMode && 'ApplicationRef.tick is called recursively',
      );
```

```ts
    setThrowInvalidWriteToSignalError(() => {
      let errorMessage = '';
      if (ngDevMode) {
        const activeConsumer = getActiveConsumer();
        errorMessage =
          activeConsumer && isReactiveLViewConsumer(activeConsumer)
            ? 'Writing to signals is not allowed while Angular renders the template (eg. interpolations)'
            : 'Writing to signals is not allowed in a `computed`';
      }
      throw new RuntimeError(RuntimeErrorCode.SIGNAL_WRITE_FROM_ILLEGAL_CONTEXT, errorMessage);
    });
```

Codes, from [`packages/core/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts) (header: *"Reserved error code range: 100-999."*):

```ts
  EXPRESSION_CHANGED_AFTER_CHECKED = -100,
  RECURSIVE_APPLICATION_REF_TICK = 101,
  INFINITE_CHANGE_DETECTION = 103,
  …
  SIGNAL_WRITE_FROM_ILLEGAL_CONTEXT = 600,
```

⚠️ Per topic 03 §0.7 and `01/13c`, the **sign** decides the link: negative codes get
`Find more at https://angular.dev/errors/NGxxxx` (and only in dev), positive ones do not. So
`NG0100` has a guide page; `NG0101`, `NG0103` and `NG0600` do not. `03/16c` already works this
example end-to-end for `NG0201` — **link it and do not re-derive the formatting machinery**.

Also in this class: **`InjectionToken` descriptions**. From `application_ref.ts`:

```ts
export const APP_BOOTSTRAP_LISTENER = new InjectionToken<
  ReadonlyArray<(compRef: ComponentRef<any>) => void>
>(ngDevMode ? 'appBootstrapListener' : '');
```

and from [`packages/core/src/ng_reflect.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/ng_reflect.ts):

```ts
export const NG_REFLECT_ATTRS_FLAG = new InjectionToken<boolean>(
  typeof ngDevMode === 'undefined' || ngDevMode ? 'NG_REFLECT_FLAG' : '',
  { factory: () => NG_REFLECT_ATTRS_FLAG_DEFAULT },
);
```

🔴 **Token descriptions are strings and strings are payload**, so they are stripped one by one at
each construction site. That is why a production `NG0201` names no token — the token has no name.
`03/16c` owns that consequence; this chunk owns the general rule.

### 12.05.3 🔴 Kind C — the check runs, only the *report* is dev-only. This is the dangerous class.

**`MAXIMUM_REFRESH_RERUNS`.** From `application_ref.ts`:

```ts
const MAXIMUM_REFRESH_RERUNS = 10;
```

```ts
    let runs = 0;
    while (this.dirtyFlags !== ApplicationRefDirtyFlags.None && runs++ < MAXIMUM_REFRESH_RERUNS) {
      profiler(ProfilerEvent.ChangeDetectionSyncStart);
      try {
        this.synchronizeOnce();
      } finally {
        profiler(ProfilerEvent.ChangeDetectionSyncEnd);
      }
    }

    if ((typeof ngDevMode === 'undefined' || ngDevMode) && runs >= MAXIMUM_REFRESH_RERUNS) {
      throw new RuntimeError(
        RuntimeErrorCode.INFINITE_CHANGE_DETECTION,
        ngDevMode &&
          'Infinite change detection while refreshing application views. ' +
            'Ensure views are not calling `markForCheck` on every template execution or ' +
            'that afterRender hooks always mark views for check.',
      );
    }
```

🔴 **Read the two statements together.** The `while` loop and its cap of **10** are *not* guarded —
they run identically in production. What is guarded is the `throw`. So:

- In **development**, an infinite change-detection loop is a loud `NG0103` naming two likely causes.
- In **production**, the same loop stops silently after ten passes, `dirtyFlags` is still non-zero,
  and **the application renders with stale views and no error whatsoever.**

**That is the single best fact in topic 12** and it is exactly the shape the corpus should be
hunting: not "the message got shorter" but "the failure got silent". Nothing in the docs says it.

⚠️ **Be precise about what I verified.** I read that the loop is unguarded and the throw is guarded,
in `synchronize()` at `v22.1.5`. I did **not** verify what a user sees in that state, and there is
no sandbox. Write the mechanical claim — *"the loop exits after ten passes and the dev-only throw is
the only thing that reports it"* — and stop there.

**Same class: the `ɵcmp` property descriptor.** From
[`packages/core/src/render3/jit/directive.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/jit/directive.ts):

```ts
    // Make the property configurable in dev mode to allow overriding in tests
    configurable: !!ngDevMode,
```

The definition still exists in production; it is only no longer *replaceable*. Which is the
mechanical reason `TestBed.overrideComponent` is a development-only capability (§11.03.4).

**And the standalone-import verification**, same file:

```ts
  const directiveDefs = () => {
    if (ngDevMode) {
      for (const rawDep of imports) {
        verifyStandaloneImport(rawDep, type);
      }
    }
```

The defs are still computed in production; only the validation of each import is skipped.

### 12.05.4 The inventory table the page should ship

| What | Kind | Guarded thing | Source |
|---|---|---|---|
| `checkNoChanges` second pass / **NG0100** | A | the whole pass | `application_ref.ts` `tickImpl` |
| exhaustive check-no-changes | A | `isExhaustiveCheckNoChanges()` branches | `render3/instructions/change_detection.ts` |
| `window.ng` console utilities + injector profiler | A | `publishDefaultGlobalUtils` | `application_ref.ts` L67, `global_utils.ts` |
| `ng-reflect-*` attributes | A | the flag read *and* the emission | `ng_reflect.ts`, `component_ref.ts` (§12.07) |
| `setClassMetadata` / `setClassDebugInfo` | A | the call, plus an elision pass | §12.06 |
| `assert*` helpers | A | *"meant only to be called in dev mode as sanity checks"* | `util/assert.ts` header |
| `verifyStandaloneImport` per import | C | validation only; defs still computed | `jit/directive.ts` |
| `RuntimeError` message text | B | the string argument | `errors.ts` + every call site |
| `Find more at …` links | B | `ngDevMode && code < 0` | `errors.ts` (`03/§0.7`) |
| `InjectionToken` descriptions | B | the description string | `application_ref.ts`, `ng_reflect.ts` |
| `NullInjector` message + injector `debugName` | B | the strings | `03/16c` — **link, do not repeat** |
| **NG0103 infinite change detection** | **C** | 🔴 **only the throw; the 10-pass loop runs** | `application_ref.ts` `synchronize()` |
| `ɵcmp` `configurable` | C | only overridability | `jit/directive.ts` |
| `warnIfDestroyed` on `ApplicationRef` | A | the warning | `application_ref.ts` |
| `provideCheckNoChangesConfig()` | A | returns an empty provider set | `03/05f` — **link** |
| `provideStabilityDebugging()` | ⛔ **none** | 🔴 explicitly **not** removed from production | `03/11g`, `03/12h` — **link** |
| `provideNgReflectAttributes()` | A | returns an empty provider set | §12.07 |

🔴 **The `provideStabilityDebugging()` row is the one that makes the table worth having.** It is the
counter-example: a debugging tool that is *deliberately* not dev-only, with a source comment saying
so. Without it the table reads as "debug things vanish", which is the wrong lesson.

The `assert*` header, verbatim, from
[`packages/core/src/util/assert.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/util/assert.ts):

> *"The functions in this file verify that the assumptions we are making about state in an
> instruction are correct before implementing any logic. They are meant only to be called in dev
> mode as sanity checks."*

⚠️ Note the wording — *"meant only to be called in dev mode"*. The functions themselves contain no
guard; every **call site** carries `ngDevMode &&`. Do not claim the assertions are self-guarding.

### 12.05.5 Gotchas to write

- **★ Symptom: an `ExpressionChangedAfterItHasBeenCheckedError` (NG0100) in development that
  "goes away" in production, and someone proposes shipping it.** Cause: it did not go away; the
  second change-detection pass that detects it is inside `if (ngDevMode)` in `ApplicationRef.tick`.
  The bug is still there, just unreported. Fix: treat NG0100 as a real defect. `enableProdMode`'s own
  JSDoc calls this *"one important assertion"* it disables.
- **★ Symptom: a production build has views that never update, with nothing in the console.** Cause:
  possibly `MAXIMUM_REFRESH_RERUNS`. The `while (… runs++ < 10)` loop is **not** dev-guarded, but the
  `NG0103` throw that reports hitting the cap **is** — so in production the loop simply stops and the
  application carries on with un-refreshed views. Fix: reproduce against a development build of the
  same route; if `NG0103` fires there, that is your answer. (⚠️ Present this as a hypothesis to test,
  not as a certain diagnosis — §99.13.)
- **★ Symptom: `ng.getComponent($0)` is undefined in a deployed application, and Angular DevTools
  shows nothing.** Cause: `publishDefaultGlobalUtils()` is `ngDevMode && _publishDefaultGlobalUtils()`,
  and the injector profiler it installs is gated the same way. The `ng` global is documented as being
  for *"when an application is not in production"*. Fix: none — deploy a non-optimised build to a
  staging origin if you need it.
- **★ Symptom: you audited the corpus and concluded "everything with 'debug' in the name is stripped
  in production".** Cause: an over-generalisation. `provideStabilityDebugging()` says the opposite in
  its own doc: *"Neither the zone.js task tracking plugin nor this utility are removed from production
  bundles."* Fix: check each one; `03/12h` has the taxonomy.
- **Symptom: a production error is a bare `NG0101` or `NG0103` with no text and no link.** Cause: two
  things at once — the message argument is `ngDevMode && '…'`, which is `false` and renders as empty,
  and the `Find more at` suffix is `ngDevMode && code < 0`, and both codes are positive so they would
  have no link even in development. Fix: `03/16c` walks the identical mechanism for `NG0201`.

### 12.05.6 Interview questions

- **★ Name something Angular checks in development that it does not check in production, and
  something it checks in both but only reports in development.** The first: the second change-detection
  pass. `ApplicationRef.tick` runs `for (let view of this.allViews) view.checkNoChanges();` inside
  `if (typeof ngDevMode === 'undefined' || ngDevMode)`, so `ExpressionChangedAfterItHasBeenChecked`
  (NG0100) is not a message that shortens in production — the check does not happen. The second, and
  the more interesting one: `ApplicationRef.synchronize()`'s refresh loop is capped at
  `MAXIMUM_REFRESH_RERUNS = 10`, and that `while` loop is **not** guarded — but the `NG0103` throw that
  fires when the cap is reached **is**. So an infinite-change-detection condition behaves identically
  in both builds; the only difference is whether anything tells you.
- **★ Why does a production Angular error carry a number and almost nothing else?** Because the
  message text is a separate argument that is written `ngDevMode && '…'` at essentially every call
  site, so it evaluates to `false` and renders as empty; because token descriptions are constructed as
  `ngDevMode ? 'name' : ''`, so there is no name to print; and because the `Find more at
  https://angular.dev/errors/NGxxxx` suffix is itself guarded by `ngDevMode && code < 0`. Three
  independent strippings, which is why no build flag short of a development build brings the text
  back and why source maps do not help — the string was never generated.
- **Is everything with "debug" in its name removed from a production Angular bundle?** No, and the
  counter-example is deliberate. `provideStabilityDebugging()` carries the comment *"IMPORTANT:
  Neither the zone.js task tracking plugin nor this utility are removed from production bundles. They
  are intended for temporary use while debugging stability issues during development, including for
  optimized production builds."* It is designed to be usable against an optimised build, which is
  where a stability bug is most likely to appear — so the only thing that removes it is you.

---

## Chunk 12·06 — Class metadata and the elision pass

🔴 **This chunk answers the question the topic brief flagged as hardest: *exactly which optimiser step
removes which guard*. It is answerable, precisely, and here is the code.**

### 12.06.1 What the compiler emits, and its shape

From [`packages/compiler/src/render3/r3_class_metadata_compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/r3_class_metadata_compiler.ts):

```ts
export function compileClassMetadata(metadata: R3ClassMetadata): o.InvokeFunctionExpr {
  const fnCall = internalCompileClassMetadata(metadata);
  return o.arrowFn([], [devOnlyGuardedExpression(fnCall).toStmt()]).callFn([]);
}
```

🔴 **Read the shape: an arrow function containing one dev-guarded statement, immediately invoked.**
So the emitted JavaScript is:

```js
(() => { (typeof ngDevMode === 'undefined' || ngDevMode) && i0.ɵsetClassMetadata(Type, [...], null, {...}); })();
```

**Why an IIFE and not a bare statement?** Because the elision pass in §12.06.3 requires the call's
nearest enclosing function to be a function expression or arrow function. The shape is not
incidental; it is the contract between the two repositories.

The async sibling carries the same note:

> *"Similar to the `setClassMetadata` call, it's wrapped into the `ngDevMode` check to tree-shake
> away this code in production mode."*

on `compileComponentClassMetadata`, whose doc also shows the generated form:

```ts
 * setClassMetadataAsync(type, () => [
 *   import('./cmp-a').then(m => m.CmpA);
 *   import('./cmp-b').then(m => m.CmpB);
 * ], (CmpA, CmpB) => {
 *   setClassMetadata(type, decorators, ctorParameters, propParameters);
 * });
```

⚠️ That is the `@defer` case — a component whose template defers dependencies gets
`setClassMetadataAsync`, which is why `TestBed.createComponent` on such a component demands
`await TestBed.compileComponents()` (§11.03.2). Link `01/11` for `@defer` itself; do not explain it.

### 12.06.2 The runtime functions being removed

`setClassMetadata`'s doc comment (§11.03.4) states its purpose and its removability in the same
breath: *"Calls to `setClassMetadata` can be guarded by ngDevMode, resulting in the metadata
assignments being tree-shaken away during production builds."*

`ɵsetClassDebugInfo` is smaller and says it outright. From
[`packages/core/src/render3/debug/set_debug_info.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/debug/set_debug_info.ts), the whole function:

```ts
/**
 * Sets the debug info for an Angular class.
 *
 * This runtime is guarded by ngDevMode flag.
 */
export function ɵsetClassDebugInfo(
  type: Type<any> | AbstractType<any>,
  debugInfo: ClassDebugInfo,
): void {
  const def = getComponentDef(type);
  if (def !== null) {
    def.debugInfo = debugInfo;
  }
}
```

So `ComponentDef.debugInfo` — the class name, file path and line number Angular DevTools uses to
take you to a component's source — exists only in development.

### 12.06.3 🔴 The pass that removes them, named exactly

**There are two implementations in `@angular/build` at `v22.1.7`, and the one that runs is the oxc
one.** Get this right; a reader who greps will find both.

**(a) The Babel plugin**, `packages/angular/build/src/tools/babel/plugins/elide-angular-metadata.ts`
([link](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/babel/plugins/elide-angular-metadata.ts)),
still exported from that directory's `index.ts`:

```ts
const SET_CLASS_METADATA_NAME = 'ɵsetClassMetadata';
const SET_CLASS_METADATA_ASYNC_NAME = 'ɵsetClassMetadataAsync';
const SET_CLASS_DEBUG_INFO_NAME = 'ɵsetClassDebugInfo';
```

```ts
        if (
          Object.hasOwn(angularMetadataFunctions, calleeName) &&
          angularMetadataFunctions[calleeName](path.get('arguments'))
        ) {
          // The metadata function is always emitted inside a function expression
          const parent = path.getFunctionParent();

          if (parent && (parent.isFunctionExpression() || parent.isArrowFunctionExpression())) {
            // Replace the metadata function with `void 0` which is the equivalent return value
            // of the metadata function.
            path.replaceWith(t.buildUndefinedNode());
          }
        }
```

**(b) The oxc pass that the build actually runs.** From
[`packages/angular/build/src/tools/esbuild/javascript-transformer-worker.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/esbuild/javascript-transformer-worker.ts):

```ts
  // Run advanced optimizations using our fast oxc-transform
  if (options.advancedOptimizations) {
    const { transform } = await import('../babel/plugins/oxc-transform.js');
    …
    const result = transform(filename, code, {
      sourcemap: useInputSourcemap,
      sideEffects: options.sideEffects,
      jit: options.jit,
      topLevelSafeMode,
    });
```

and the corresponding code in
[`oxc-transform.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/babel/plugins/oxc-transform.ts):

```ts
/**
 * A set of Angular metadata decorator functions that can be elided.
 */
const angularMetadataFunctions = new Set([
  'ɵsetClassMetadata',
  'ɵsetClassMetadataAsync',
  'ɵsetClassDebugInfo',
]);
```

```ts
      if (calleeName && angularMetadataFunctions.has(calleeName)) {
        const parentFunc = functionStack[functionStack.length - 1];
        if (
          parentFunc &&
          (parentFunc.type === 'FunctionExpression' ||
            parentFunc.type === 'ArrowFunctionExpression')
        ) {
          s.overwrite(node.start, node.end, 'void 0');
          markEdited(node.start, node.end);

          return;
        }
      }
```

**The answer, stated exactly:** the step is the CLI's **advanced-optimisation pass**, implemented in
`oxc-transform.ts`, which rewrites the *call expression* to `void 0` when its callee name is one of
three (`ɵsetClassMetadata`, `ɵsetClassMetadataAsync`, `ɵsetClassDebugInfo`) **and** its nearest
enclosing function is a function expression or arrow function. It runs **iff `advancedOptimizations`**,
which the CLI computes as `!!aot && optimizationOptions.scripts` (§11.02.1).

🔴 So the elision has **two** independent preconditions — AOT and script optimisation — and neither is
the `ngDevMode` define, which is a third, separate mechanism. The page must not merge them.

### 12.06.4 The same pass does three more things — name them, they are visible in any bundle

From `oxc-transform.ts`:

```ts
/**
 * A set of Angular static properties that should be wrapped in pure IIFE statements.
 */
const angularStaticsToWrap = new Set([
  'ɵcmp', 'ɵdir', 'ɵfac', 'ɵinj', 'ɵmod', 'ɵpipe', 'ɵprov', 'INJECTOR_KEY',
]);

/**
 * A map of static properties and their matcher predicate functions to check if they
 * can be safely elided from class declarations.
 */
const angularStaticsToElide: Record<string, (node: Node) => boolean> = {
  'ctorParameters'(node) {
    return node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression';
  },
  'decorators'(node) {
    return node.type === 'ArrayExpression';
  },
  'propDecorators'(node) {
    return node.type === 'ObjectExpression';
  },
};
```

1. **Elides `ctorParameters` / `decorators` / `propDecorators` static assignments** — the *other*
   spelling of class metadata, the one `ReflectionCapabilities._ownAnnotations` reads (§11.03.4). So
   the pass removes both the function call and the property assignments.
2. **Wraps the seven Angular statics in `/*#__PURE__*/` IIFEs**, which is what lets a bundler drop an
   unused component entirely.
3. **Adds `/*#__PURE__*/` to top-level calls** — subject to `topLevelSafeMode`, which the worker
   computes as `!(sideEffects === false && /node_modules\/@angular\//.test(filename))`, i.e. the
   aggressive form is reserved for side-effect-free `@angular/*` packages.

🔴 **Point (1) is the link back to topic 11:** `TestBed.overrideComponent` reads `type.decorators`,
and this pass deletes `type.decorators`. That closes the loop between the three topics.

### 12.06.5 Gotchas to write

- **★ Symptom: you set `"optimization": true` and expected class metadata to be gone, and it is
  still in the bundle.** Cause: the elision needs `advancedOptimizations`, which the CLI computes as
  `!!aot && optimizationOptions.scripts`. If `aot` is `false` the pass never runs, whatever
  `optimization` says. Fix: leave `aot` at its default `true`.
- **★ Symptom: you hand-wrote a `ɵsetClassMetadata`-shaped call, or post-processed the compiler's
  output, and the metadata survived optimisation.** Cause: the pass requires the call's nearest
  enclosing function to be a `FunctionExpression` or `ArrowFunctionExpression` — the compiler emits
  the call inside an immediately-invoked arrow *specifically* to satisfy that. A bare top-level call
  is not elided. Fix: do not reshape compiler output.
- **★ Symptom: an integration test that inspects `MyComponent.decorators` passes locally and fails
  against a production bundle.** Cause: the advanced-optimisation pass elides the `decorators`,
  `ctorParameters` and `propDecorators` static assignments as well as the `ɵsetClassMetadata` call.
  Fix: never reflect over Angular's class metadata in application code — it is a TestBed
  implementation detail with an explicit removal step aimed at it.
- **★ Symptom: Angular DevTools cannot navigate to a component's source in a deployed application.**
  Cause: `ɵsetClassDebugInfo` is elided by the same pass, and it is what sets `ComponentDef.debugInfo`
  — its own doc says *"This runtime is guarded by ngDevMode flag."* Fix: none in production.
- **Symptom: you found `elide-angular-metadata.ts` in `@angular/build` and assume that Babel plugin
  is what runs.** Cause: at 22.1.7 there are two implementations; the transformer worker imports
  `oxc-transform.js` for the advanced-optimisation stage, and the Babel stage runs only the linker and
  optional coverage instrumentation. Fix: read `javascript-transformer-worker.ts` before attributing
  behaviour to either.

### 12.06.6 Interview questions

- **★ Exactly which build step removes Angular's class metadata from a production bundle, and what
  are its preconditions?** The CLI's advanced-optimisation pass, implemented in `@angular/build`'s
  `oxc-transform.ts`. It walks call expressions and, when the callee name is `ɵsetClassMetadata`,
  `ɵsetClassMetadataAsync` or `ɵsetClassDebugInfo` **and** the nearest enclosing function is a
  function expression or arrow function, overwrites the whole call with `void 0`. It also elides the
  `decorators` / `ctorParameters` / `propDecorators` static assignments and wraps `ɵcmp`, `ɵdir`,
  `ɵfac`, `ɵinj`, `ɵmod`, `ɵpipe` and `ɵprov` in `/*#__PURE__*/` IIFEs. Its precondition is
  `advancedOptimizations`, computed as `!!aot && optimizationOptions.scripts` — so **both** AOT and
  script optimisation. That is a different and independent mechanism from the `ngDevMode: 'false'`
  esbuild define, which only makes the guard fold.
- **★ Why does the compiler wrap `setClassMetadata` in an immediately-invoked arrow function rather
  than emitting a plain guarded statement?** Because the elision pass keys on it. Both the Babel and
  the oxc implementations check `path.getFunctionParent()` / the enclosing function node and only
  rewrite the call when its parent is a function expression or arrow function — the Babel plugin's
  comment says it in as many words: *"The metadata function is always emitted inside a function
  expression."* So `compileClassMetadata`'s `o.arrowFn([], [devOnlyGuardedExpression(fnCall).toStmt()]).callFn([])`
  is a contract between `angular/angular` and `angular/angular-cli`, not a stylistic choice. Change
  the shape and the metadata stops being removable.

---

## Chunk 12·07 — `provideNgReflectAttributes()`

⚠️ **Topic 03 owns the provider-array angle. This chunk owns the runtime.** `03/11g` establishes the
JSDoc and the attributes-versus-function deprecation distinction; `03/12h` establishes the taxonomy
of dev-only providers. **Both must be linked in the first three lines**, and neither's argument may
be re-made here.

### 12.07.1 The whole file, verbatim — it is 69 lines and all of it is relevant

From [`packages/core/src/ng_reflect.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/ng_reflect.ts):

```ts
/** Defines the default value of the `NG_REFLECT_ATTRS_FLAG` flag. */
export const NG_REFLECT_ATTRS_FLAG_DEFAULT = false;

/**
 * Defines an internal flag that indicates whether the runtime code should be
 * producing `ng-reflect-*` attributes.
 */
export const NG_REFLECT_ATTRS_FLAG = new InjectionToken<boolean>(
  typeof ngDevMode === 'undefined' || ngDevMode ? 'NG_REFLECT_FLAG' : '',
  {
    factory: () => NG_REFLECT_ATTRS_FLAG_DEFAULT,
  },
);

/**
 * Enables the logic to produce `ng-reflect-*` attributes on elements with bindings.
 *
 * Note: this is a dev-mode only setting and it will have no effect in production mode.
 * In production mode, the `ng-reflect-*` attributes are *never* produced by Angular.
 *
 * Important: using and relying on the `ng-reflect-*` attributes is not recommended,
 * they are deprecated and only present for backwards compatibility. Angular will stop
 * producing them in one of the future versions.
 *
 * @publicApi
 */
export function provideNgReflectAttributes(): EnvironmentProviders {
  const providers =
    typeof ngDevMode === 'undefined' || ngDevMode
      ? [
          {
            provide: NG_REFLECT_ATTRS_FLAG,
            useValue: true,
          },
        ]
      : [];
  return makeEnvironmentProviders(providers);
}

export function normalizeDebugBindingName(name: string) {
  // Attribute names with `$` (eg `x-y$`) are valid per spec, but unsupported by some browsers
  name = camelCaseToDashCase(name.replace(/[$@]/g, '_'));
  return `ng-reflect-${name}`;
}

const CAMEL_CASE_REGEXP = /([A-Z])/g;

function camelCaseToDashCase(input: string): string {
  return input.replace(CAMEL_CASE_REGEXP, (...m: any[]) => '-' + m[1].toLowerCase());
}

export function normalizeDebugBindingValue(value: any): string {
  try {
    // Limit the size of the value as otherwise the DOM just gets polluted.
    return value != null ? value.toString().slice(0, 30) : value;
  } catch (e) {
    return '[ERROR] Exception while trying to serialize the value';
  }
}
```

### 12.07.2 🔴 Four dev-mode mechanisms in one small file — this is the chunk's spine

**This file is the single best worked example in topic 12**, because it shows four of the topic's
mechanisms stacked on one feature:

1. **A token description stripped** — `ngDevMode ? 'NG_REFLECT_FLAG' : ''` (§12.05.2's Kind B).
2. **A provider set that collapses to empty** — `provideNgReflectAttributes()` returns
   `makeEnvironmentProviders([])` in production, so the call costs the import and nothing else
   (`03/12h`'s "dev-only in effect, and the provider set collapses" category).
3. **A default that means the feature is off even when the token is reachable** —
   `NG_REFLECT_ATTRS_FLAG_DEFAULT = false`, supplied by the token's own `factory`.
4. **A consumer-side guard that makes the whole thing unreachable anyway** — §12.07.3.

### 12.07.3 The consumer side — belt, braces and a third belt

From [`packages/core/src/render3/component_ref.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/component_ref.ts):

```ts
  let ngReflect = false;
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    ngReflect = rootLViewInjector.get(NG_REFLECT_ATTRS_FLAG, NG_REFLECT_ATTRS_FLAG_DEFAULT);
  }

  return {
    rendererFactory,
    sanitizer,
    changeDetectionScheduler,
    ngReflect,
    tracingService,
  };
```

🔴 **The token is not even *read* outside development.** So the JSDoc's claim — *"in production mode,
the `ng-reflect-*` attributes are **never** produced by Angular"* — is guaranteed three times over:
the provider set is empty, the token's default is `false`, and the read is skipped. That is worth
saying, because it is the only place in this topic where the framework belts-and-braces a dev-only
feature this hard, and the reason is obvious once stated: these attributes were once produced
unconditionally and are now a compatibility relic.

### 12.07.4 The 30-character truncation — nobody knows this and it burns people

```ts
export function normalizeDebugBindingValue(value: any): string {
  try {
    // Limit the size of the value as otherwise the DOM just gets polluted.
    return value != null ? value.toString().slice(0, 30) : value;
  } catch (e) {
    return '[ERROR] Exception while trying to serialize the value';
  }
}
```

🔴 **`ng-reflect-*` values are `String(value).slice(0, 30)`.** For any object that is
`[object Object]` — nineteen characters of nothing. For a long string it is a silent truncation with
no ellipsis. And a `toString()` that throws yields the literal text
`[ERROR] Exception while trying to serialize the value` in a DOM attribute.

And the name mangling, from the same file: `name.replace(/[$@]/g, '_')` then camelCase → dash-case,
prefixed `ng-reflect-`. So an input called `userId$` becomes `ng-reflect-user-id_`. **The comment
explains why:** *"Attribute names with `$` (eg `x-y$`) are valid per spec, but unsupported by some
browsers."*

### 12.07.5 The deprecation, stated exactly — do not overstate it

Copy `03/11g`'s precision verbatim rather than paraphrasing:

- The **attributes** are described as deprecated in prose: *"they are deprecated and only present for
  backwards compatibility. Angular will stop producing them in one of the future versions."*
- The **function** is not tagged `@deprecated`. The core golden marks it plain:

  ```ts
  export function provideNgReflectAttributes(): EnvironmentProviders;
  ```

  with no deprecation annotation, and the JSDoc's tag is `@publicApi`.
- Consequence: no editor strikethrough, no `ng update` migration, no build warning. The removal date
  is *"one of the future versions"*, deliberately not a version number.

⚠️ Per `03/12h`, do **not** cite the golden's `// @public` as evidence of stability — cite the JSDoc.
Here the golden is used only to show the **absence** of a `@deprecated` tag, which is a legitimate
negative reading of a machine-generated record of the exported surface.

### 12.07.6 Gotchas to write

- **★ Symptom: an end-to-end selector on `[ng-reflect-user-id]` passes locally and fails against a
  deployed build.** Cause: the attributes are dev-mode only — *"In production mode, the
  `ng-reflect-*` attributes are **never** produced by Angular"* — and they are guarded three separate
  ways. Fix: select on a `data-testid` you control. Do this before the attributes are removed
  entirely, not after. (`03/11g` ships this gotcha too; **cross-link rather than duplicating the
  argument**, and make this version about the *runtime* triple-guard.)
- **★ Symptom: an `ng-reflect-*` attribute shows `[object Object]`, or a value cut off mid-word.**
  Cause: `normalizeDebugBindingValue` is `value.toString().slice(0, 30)`, with the comment *"Limit the
  size of the value as otherwise the DOM just gets polluted."* There is no ellipsis and no
  serialisation. Fix: do not read data out of these attributes; use `ng.getComponent($0)` in the
  console instead (also dev-only — §12.05.1).
- **★ Symptom: an attribute is `ng-reflect-user-id_` and you cannot find where the underscore came
  from.** Cause: `name.replace(/[$@]/g, '_')` before camelCase→dash-case, because *"Attribute names
  with `$` (eg `x-y$`) are valid per spec, but unsupported by some browsers"*. So a signal-ish input
  named `userId$` reflects as `ng-reflect-user-id_`. Fix: none; know the rule.
- **★ Symptom: an `ng-reflect-*` attribute contains `[ERROR] Exception while trying to serialize the
  value`.** Cause: the binding's value has a `toString()` that throws, and
  `normalizeDebugBindingValue` catches and substitutes that literal string. Fix: the bug is in your
  `toString()`, and the attribute is telling you so.
- **★ Symptom: you removed `provideNgReflectAttributes()` from a production config expecting a size
  win.** Cause: in a production build the function already returns `makeEnvironmentProviders([])`.
  Fix: remove it for clarity, not for size — and note the contrast with `provideStabilityDebugging()`,
  which really does ship (`03/12h`).
- **Symptom: you searched for a `@deprecated` tag on `provideNgReflectAttributes` to justify a
  removal and found none.** Cause: the deprecation is on the *attributes*, not the function. Fix: make
  the argument on the attributes. (`03/11g` owns this; link it.)

### 12.07.7 Interview questions

- **★ `provideNgReflectAttributes()` is described as dev-mode only. Count the mechanisms that make
  that true.** Four, on one small feature. The function itself returns
  `makeEnvironmentProviders([])` outside development, so nothing is registered. The token's own
  factory defaults to `NG_REFLECT_ATTRS_FLAG_DEFAULT`, which is `false`, so even a reachable token
  answers "off". `component_ref.ts` only *reads* the token inside `if (typeof ngDevMode === 'undefined'
  || ngDevMode)` and otherwise hard-codes `ngReflect = false`. And the token's own description string
  is `ngDevMode ? 'NG_REFLECT_FLAG' : ''`, so even the name is stripped. That is why the JSDoc can say
  the attributes are *"never"* produced in production and mean it literally.
- **★ Is `provideNgReflectAttributes()` deprecated?** No — and being precise about this is the point.
  The `ng-reflect-*` **attributes** are: *"they are deprecated and only present for backwards
  compatibility. Angular will stop producing them in one of the future versions."* The **function**
  carries `@publicApi` and no `@deprecated` tag, and the public-API golden lists it plain. So there is
  no strikethrough, no migration and no build warning, and the deadline is deliberately not a version
  number. If you are arguing to remove usage, argue about the attributes — a reviewer who checks the
  function will find your claim false.
- **What actually ends up in an `ng-reflect-*` attribute?** `String(value).slice(0, 30)`, with no
  ellipsis, wrapped in a `try/catch` that substitutes `[ERROR] Exception while trying to serialize the
  value` if `toString()` throws — the comment says *"Limit the size of the value as otherwise the DOM
  just gets polluted."* The name is the input's name with `$` and `@` replaced by `_`, camelCase
  converted to dash-case, prefixed `ng-reflect-`. So an object shows as `[object Object]` and
  `userId$` becomes `ng-reflect-user-id_`. It was never a data channel; it is a debugging aid on its
  way out.

---

## 99 · UNSETTLED — do not guess these

Each of these was attempted once. If a chunk needs one, either verify it or write
*"the documentation does not state whether X"*. 🔴 **This section is the most valuable thing in this
bank.** Topic 12 in particular is full of claims that are easy to assert confidently and impossible
to prove without running a build — and there is no sandbox.

1. **What changed in the component declaration interface at `minVersion: 14.0.0`.** §10.03.3
   establishes *that* `minVersion` differs per declaration kind (12.0.0 for factory/injector/class
   metadata, 14.0.0 for component/NgModule) and what the number *means* by definition. I did not find
   the commit or release note that bumped it. **Write the meaning, never the cause.** Anyone tempted
   to say "standalone components" or "signal inputs" is guessing.

2. **Whether a second `PartialLinker` generation has ever shipped.** At `v22.1.5` every declaration
   kind maps to exactly one linker at `LATEST_VERSION_RANGE`, and `partial_linkers/` contains only
   `_1` files. The multi-generation selection machinery, the "ascending order" rule and the
   `Version2/3/4` example are all read from the file's **doc comment**, not from a live map.
   ⚠️ Do not write "when Angular adds a new linker generation, X happens" as though observed.

3. **Whether the linker's `LATEST_VERSION_RANGE` is genuinely the compiler's own version at
   runtime.** It is `getRange('<=', PLACEHOLDER_VERSION)`, and `PLACEHOLDER_VERSION` is the literal
   `'0.0.0-PLACEHOLDER'` in source, substituted at release. I did **not** read a published
   `@angular/compiler-cli` bundle to confirm the substitution lands there. The reasoning in §10.05.3
   about a too-new library failing depends on that substitution. **Present the conclusion as a
   reading of the source, and say the substitution was not verified in a published artefact.**

4. **Whether `ɵɵngDeclareClassMetadata` output is `ngDevMode`-guarded *after linking*.** In the
   published `@angular/material@22.1.5` `divider.mjs` the call is a **bare top-level statement**
   (§10.02.3), whereas the compiler's `compileClassMetadata` emits an IIFE-wrapped, `ngDevMode &&`
   guarded `ɵsetClassMetadata` (§12.06.1). I did not read
   `partial_class_metadata_linker_1.ts`'s emit, so **whether the linker restores the guarded IIFE
   shape — and therefore whether library class metadata is elidable in a consumer's production
   build — is unknown.** 🔴 This matters: if it does not, every partial dependency's decorators ship
   to production. **Do not assert either way.** The file to read is
   `packages/compiler-cli/linker/src/file_linker/partial_linkers/partial_class_metadata_linker_1.ts`
   (fetched to scratch this session at 49 lines, not analysed).

5. **Whether `ng test` builds AOT.** `@angular/build`'s `unit-test` builder options file does not set
   `aot`, and its `schema.json` was not read; the `application` builder's default is `true`. So the
   *likely* answer is yes — but the vitest runner also generates a setup file that calls
   `initTestEnvironment`, and how the two option sets merge was not traced. 🔴 It matters because if
   tests build AOT, then TestBed's JIT usage is confined to *overrides*, and the mental model
   "tests are JIT" is wrong. **Write "the unit-test builder does not set `aot`; the application
   builder's default is `true`" and stop.**

6. **Which CSP directive a JIT build requires.** §11.04.4 has a gotcha about CSP. I did **not** read
   how Angular's JIT compiler generates functions (`new Function`, `eval`, or something else) at
   v22, and therefore cannot name `unsafe-eval` as verified. **State the general shape — a runtime
   compiler builds functions from strings — and do not name a directive.**

7. **`Component.foreignImports` at v22.** `jit/directive.ts` throws *"Foreign components are not
   supported in JIT mode. Component 'X' cannot specify 'foreignImports'."* I read the refusal and
   nothing else — not what the feature is, not its stability tag, not whether it is in the golden.
   **Name the refusal as a JIT limitation; do not describe the feature.**

8. **`kind: 'service'` in `JitCompilerUsageRequest`.** The v22 `@Service` surface appears in the
   compiler facade's `kind` union and in the linker's `ɵɵngDeclareService`. Not researched. **Name
   it in a list, explain nothing.**

9. **Whether `isDevMode()` is eliminated by esbuild in a production build.** §12.02.2 argues that an
   inline `if (ngDevMode)` is more reliably removable than `if (isDevMode())`, and the framework's
   own comments argue for the inline shape. But I did **not** verify whether esbuild inlines the
   one-line `isDevMode` body and folds it. 🔴 **Do not claim `isDevMode()` prevents tree-shaking.**
   Write the guidance ("use the inline guard when the code must not ship") without a claim about
   what a specific bundler does.

10. **`ngServerMode`: define versus banner.** `application-code-bundle.ts` contains both
    `commonOptions.define['ngServerMode'] = 'true'` and, twice,
    `jsBanner.push("globalThis['ngServerMode'] = true;")`. Which entry points get which was not
    traced. **Say "both mechanisms are used" and leave it; `ngServerMode` belongs to a later phase
    anyway.**

11. **Whether a *deployed* SSR server bundle always agrees with its browser bundle about
    `ngDevMode`.** §12.03.2 proves the two are produced from one options object inside
    `@angular/build`'s application builder. It does **not** cover: a workspace with a separate server
    target, a hand-rolled SSR pipeline, `@angular/ssr` used outside the CLI, or a platform host that
    re-bundles. 🔴 Three pages in this corpus carry a ⚠️ on exactly this question (§100.2) —
    **narrow the claim to "a `@angular/build` application build", never to "SSR".**

12. **The `COMPILED` gate in `publishUtil`.** `global_utils.ts` wraps the `window.ng` assignment in
    `if (typeof COMPILED === 'undefined' || !COMPILED)`, with a comment about Closure Compiler
    globals clobbering `ng`. Whether anything in the `@angular/build` pipeline defines `COMPILED` was
    **not** checked. **Attribute the `window.ng` removal to the `ngDevMode` guard in
    `publishDefaultGlobalUtils`, which is proven, and mention `COMPILED` as a second Closure-specific
    gate without claiming it fires in a CLI build.**

13. **What a user actually observes when `MAXIMUM_REFRESH_RERUNS` is hit in production.** §12.05.3
    proves the loop is unguarded and the `NG0103` throw is guarded. It does **not** prove what the UI
    looks like afterwards — `dirtyFlags` handling after the loop exits was not traced, and there is no
    sandbox. 🔴 This is the most tempting sentence in the topic to over-write. **Write the mechanical
    claim only: "the loop exits after ten passes and the dev-only throw is the only thing that
    reports it."**

14. **Whether `ngDevMode` affects `@defer`'s `setClassMetadataAsync` path differently.**
    `compileComponentClassMetadata`'s doc says it is *"wrapped into the `ngDevMode` check to
    tree-shake away this code in production mode"*, and the oxc pass lists `ɵsetClassMetadataAsync`
    among the three elidable names. But `setClassMetadataAsync` also monkey-patches
    `__ngAsyncComponentMetadataFn__` onto the class, which `TestBed.createComponent` checks via
    `getAsyncClassMetadataFn`. Whether *that* patching survives production was not traced.
    **Do not claim it either way.**

15. **The `assert*` family's actual production cost.** `util/assert.ts`'s header says the functions
    are *"meant only to be called in dev mode as sanity checks"*, and the call sites carry
    `ngDevMode &&`. The functions themselves contain no guard, so **the function bodies are in the
    bundle unless the bundler drops them as unreferenced.** I did not verify that they are dropped.
    **Say "every call site is guarded"; do not say "the assertions are not in the bundle".**

16. **Whether the `ngDevMode=false` URL switch works after bootstrap.** `initNgDevMode` reads
    `location.toString()` at the moment it runs, which is during the first `ɵɵdefineComponent`.
    Whether a later navigation that adds the substring has any effect was not investigated. **Describe
    it as read once at initialisation, which is what the code shows, and note the limit.**

17. **`enableResourceInlining`'s exact semantics.** §10.07.1 attributes the inline `template:`/
    `styles:` in a published package to ng-packagr's `enableResourceInlining: true`. That is a
    reasonable read of the option name plus the observed output, but I did **not** read the compiler
    option's documentation or implementation. **Mark it as an inference, or verify against
    `packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts` before stating it flatly.**

18. **Whether `@angular/material` is representative.** §10.02's declaration is one component from one
    package. Angular Material is built by the Angular team with their own tooling, which may differ
    from a plain `ng generate library` + `ng-packagr` output in ways I did not check (the `version:
    "22.1.4"` mismatch hints at a bespoke release process). **Say "read from the published
    `@angular/material@22.1.5`"; do not say "a typical Angular library looks like this".**

---

## 100 · Found, not fixed — defects and drift outside my scope

Reported per the standing rule; **I changed nothing outside my one file. No `git add`, no commit.**

1. ⚠️ **`01/12f-partial-compilation-and-the-linker.md` gives advice that is unnecessary for an
   `ng-packagr` library.** Its first gotcha reads *"In a CLI workspace this belongs in the library's
   production tsconfig — **verify it is there rather than assuming the generator set it**"*, and
   shows a `tsconfig.lib.prod.json` with `"compilationMode": "partial"` as the fix. The *compiler's*
   default is indeed `'full'` and that part is correctly sourced — but **ng-packagr's own base
   `tsconfig.ngc.json` sets `"compilationMode": "partial"`** (§10.07.1, read from
   `ng-packagr@22.1.1`), and every library tsconfig extends it. So the described failure requires
   someone to have actively overridden it, or to be building without ng-packagr. Not wrong, but it
   sends a reader to check something that is already true. Topic 10 §10.07.2 states the accurate
   version and cross-links. **Topic 01 is closed; not mine to edit.**

2. ⚠️ **Three pages carry an explicit ⚠️ about `ngDevMode` on a server build, and §12.03.2 settles
   the CLI half of it.**
   - `03/05g-the-check-no-changes-interval.md:212` — *"this page did not verify how a given server
     build defines `ngDevMode` or exactly when that destruction happens"*.
   - `03/17d-bootstrapcontext-and-the-server-platform.md:100` — *"In a production server build the
     second argument to …"*.
   - `03/15-route-level-providers.md:149` — *"Whether the injector stores it in a production build
     was not read for this page"*.

   The read: `getEsBuildServerCommonOptions` calls `getEsBuildCommonOptions(options)` and overrides
   only `ngServerMode`, so **in a `@angular/build` application build the server bundle's `ngDevMode`
   follows the same `optimizationOptions.scripts` rule as the browser bundle's.** That is narrower
   than "SSR" (§99.11) and does not settle the `05g` destruction-timing half at all. **Not mine to
   edit; recorded so whoever owns those pages can use it.**

3. ⚠️ **angular.dev's AOT compiler page is substantially stale** —
   [https://angular.dev/tools/cli/aot-compiler](https://angular.dev/tools/cli/aot-compiler) still
   teaches the *"AOT collector"*, *"`.metadata.json` files, one per `.d.ts`"*, *"the compiler's
   `StaticReflector`"*, *"generates a factory"*, and *"the AOT compiler does not support function
   expressions and arrow functions"*. All five describe the pre-Ivy compiler. This is the **same
   class of defect** topic 01 already documents for `guide/di/debugging-and-troubleshooting-di`,
   `reference/errors/NG0201` and the metadata guides (`01/10f`, `01/09d`), and it is the sixth
   angular.dev page this corpus has caught. Topic 11 chunk 05 is dedicated to it.
   🔴 **Worth escalating**: the metadata-restrictions half of that page directly contradicts
   `01/09d-the-single-return-function-rule.md` and `01/10f-destructuring-in-metadata.md`, which were
   written **from the shipped compiler's partial evaluator**. Two of this corpus's own pages already
   say the guide is wrong; a third now says it about the AOT page specifically.

4. ⚠️ **`getCompilerFacade`'s error message recommends a deprecated package.** The string in
   `packages/core/src/compiler/compiler_facade.ts` at `v22.1.5` reads *"the JIT compiler should be
   loaded by bootstrapping using '@angular/platform-browser-dynamic' or '@angular/platform-server'"*,
   while `@angular/platform-browser-dynamic` has carried an npm deprecation and a golden
   `@deprecated` since Angular 20.0.0 (§0.3). Not a devbible defect — an upstream one — but any page
   quoting that error must say so, or a reader will follow the advice and install a deprecated
   package. Topic 10 §10.06.3 and topic 11 §11.03.5 both flag it.

5. ⚠️ **Two implementations of the metadata-elision pass coexist in `@angular/build@22.1.7`.**
   `src/tools/babel/plugins/elide-angular-metadata.ts` (a Babel plugin, still exported from that
   directory's `index.ts`) and the equivalent logic inside
   `src/tools/babel/plugins/oxc-transform.ts` (which is what `javascript-transformer-worker.ts`
   actually imports for the `advancedOptimizations` stage). Anyone grepping the CLI will find the
   Babel one first and describe behaviour that does not run. Not a devbible defect; recorded because
   it is a trap for the next agent, and because **topic 05** *(not written yet)* will hit it when it
   describes the build pipeline.

6. ℹ️ **`ng-packagr` is on its own release number, `22.1.1`.** Every existing Phase 0 page states the
   spine as *"Angular 22.1.5 · CLI / `@angular/build` / `@angular/ssr` 22.1.7 · TypeScript peer
   `>=6.0 <6.1`"*. Topic 10 is the first page in this phase that must name ng-packagr, and its number
   is neither of those. **Whoever owns the phase README may want the spine line extended.** Note also
   that its GitHub tags have **no `v` prefix** (`22.1.1`, not `v22.1.1`) — a `v`-prefixed blob URL
   404s and would ship a broken link (§0.2).

7. ℹ️ **Two files in topic 04's directory were reported over the 300-line cap by the repo's own hook
   while I was reading** — `04-ng-update-not-npm-install/01-why-npm-install-is-not-an-upgrade.md`
   (321) and `01b-what-a-migration-rewrites.md` (301). **That directory is another agent's live lane
   right now**, so this is almost certainly work in flight rather than a defect. Recorded only so it
   is not lost; **do not act on it** without re-measuring.

---

## 101 · Provenance — what was actually read, so nobody re-fetches it

Every file below was fetched this session via `gh api …/contents/<path>?ref=<tag>` (or, where
marked, over HTTPS) and read. **Do not re-derive.**

**`angular/angular` @ `v22.1.5`**
`packages/core/src/util/is_dev_mode.ts` (44) · `packages/core/src/util/ng_dev_mode.ts` (95) ·
`packages/core/src/util/assert.ts` (149) · `packages/core/src/ng_reflect.ts` (69) ·
`packages/core/src/compiler/compiler_facade.ts` (49) · `packages/core/src/render3/metadata.ts` (121) ·
`packages/core/src/render3/debug/set_debug_info.ts` (26) ·
`packages/core/src/render3/util/global_utils.ts` (235) ·
`packages/core/src/render3/instructions/change_detection.ts` (566, grepped) ·
`packages/core/src/render3/jit/directive.ts` (551) ·
`packages/core/src/render3/component_ref.ts` (grepped) ·
`packages/core/src/application/application_ref.ts` (899) ·
`packages/core/src/reflection/reflection_capabilities.ts` (303) ·
`packages/core/testing/src/test_bed.ts` (998) · `packages/core/testing/src/test_bed_compiler.ts` (1266, grepped) ·
`packages/core/testing/src/resolvers.ts` (128) · `packages/core/src/errors.ts` (grepped) ·
`packages/compiler/src/render3/util.ts` (181) ·
`packages/compiler/src/render3/partial/api.ts` (607) ·
`packages/compiler/src/render3/r3_class_metadata_compiler.ts` (164) ·
`packages/compiler-cli/linker/babel/src/babel_plugin.ts` (39) ·
`packages/compiler-cli/linker/src/file_linker/linker_options.ts` (49) ·
`packages/compiler-cli/linker/src/file_linker/needs_linking.ts` (28) ·
`packages/compiler-cli/linker/src/file_linker/partial_linkers/partial_linker_selector.ts` (221) ·
`packages/compiler-cli/linker/src/file_linker/partial_linkers/util.ts` (124) ·
`packages/compiler-cli/linker/src/fatal_linker_error.ts` (34) ·
`packages/platform-browser-dynamic/package.json` + `src/platform-browser-dynamic.ts` ·
`goldens/public-api/core/index.api.md` (grepped) · `goldens/public-api/core/testing/index.api.md` (grepped) ·
`goldens/public-api/platform-browser/index.api.md` (grepped) ·
`goldens/public-api/platform-browser-dynamic/index.api.md` (whole) ·
`CHANGELOG.md` (the 20.0.0 section)

⚠️ Fetched to scratch but **not analysed**:
`packages/compiler-cli/linker/src/file_linker/partial_linkers/partial_class_metadata_linker_1.ts`
(49 lines) — see §99.4.

**`angular/angular-cli` @ `v22.1.7`**
`packages/angular/build/src/tools/esbuild/application-code-bundle.ts` (792) ·
`packages/angular/build/src/tools/esbuild/javascript-transformer.ts` (243) ·
`packages/angular/build/src/tools/esbuild/javascript-transformer-worker.ts` (200) ·
`packages/angular/build/src/tools/babel/plugins/elide-angular-metadata.ts` (128) ·
`packages/angular/build/src/tools/babel/plugins/index.ts` (12) ·
`packages/angular/build/src/tools/babel/plugins/oxc-transform.ts` (768) ·
`packages/angular/build/src/builders/application/options.ts` (756, grepped) ·
`packages/angular/build/src/builders/application/schema.json` (728, property-inspected) ·
`packages/angular/build/src/builders/unit-test/builder.ts` (391, grepped) ·
`packages/angular/build/src/builders/unit-test/options.ts` (172, grepped) ·
`packages/angular/build/src/builders/unit-test/runners/vitest/build-options.ts` (grepped)

**`ng-packagr/ng-packagr` @ `22.1.1`** (no `v` prefix)
`src/lib/ts/conf/tsconfig.ngc.json` (whole) ·
`src/lib/ng-package/entry-point/compile-ngc.transform.ts` (grepped)

**npm registry** — dist-tags for `@angular/core`, `@angular/cli`, `@angular/build`, `ng-packagr`,
`@angular/platform-browser-dynamic`; full metadata for `@angular/core@22.1.5` and
`@angular/platform-browser-dynamic@22.1.5`.

**Published package over HTTPS** —
`https://cdn.jsdelivr.net/npm/@angular/material@22.1.5/fesm2022/divider.mjs` (130 lines, whole file
read; quoted in §10.02).

**angular.dev** — [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler),
read in full 2026-09-09.

🔴 **No sandbox was run. Nothing in this bank is program output.**
