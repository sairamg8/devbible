---
name: research-angular-p0-07-typescript-and-08-ng-new
description: Banked primary-source research for Angular Phase 0 topics 07 (the TypeScript setup — COMPLETE, chunks 07.01-07.09) and 08 (what `ng new` produces — INCOMPLETE, cut off at chunk 08.04 by a rate limit; no UNSETTLED section was ever written).
metadata:
  type: reference
---

# Research bank — Angular Phase 0, topics `07` (TypeScript setup) and `08` (`ng new` output)

Researched **2026-09-09** against `angular/angular` at tag **`v22.1.5`**, `angular/angular-cli`
at tag **`v22.1.7`**, angular.dev, `registry.npmjs.org`, and the TypeScript 6.0 release notes.
**No sandbox was run** — every code block below is *source text read from a repository or a
documentation page*, never program output. There is no `ng new` transcript anywhere in this file
and there must not be one on any page written from it.

**Who this is for.** The unwritten chunks of

- `docs/angular/pages/phase-0-how-angular-runs/07-the-typescript-setup-angular-requires/`
- `docs/angular/pages/phase-0-how-angular-runs/08-what-ng-new-produces/`

Both are tier **Understand** per the phase README. Neither directory exists on disk yet, so
**every filename in this bank is a proposal, not a fixture** — unlike topic 03, nothing links
inward yet. Read `## 0 · Facts every chunk needs` first; it is short and load-bearing.

🔴 **Rule for using this bank: if a claim is not in here with a URL, either verify it yourself or
write it as explicitly uncertain.**

## 🔴 THIS BANK IS INCOMPLETE — read this before using it

**The banking agent was killed by a session rate limit on 2026-09-09 part-way through topic 08.**
What survives is genuine, verified work and is safe to write from; what is missing is missing, not
elsewhere.

| | state |
|---|---|
| **Topic 07** — the TypeScript setup | ✅ **complete**, chunks `07.01`–`07.09` |
| **Topic 08** — what `ng new` produces | ⚠️ **CUT OFF at chunk `08.04`** (the root component). Later chunks were never banked. |
| `## 99 · UNSETTLED` | ⛔ **NEVER WRITTEN.** |
| `## 100 · Found, not fixed` | ⛔ **NEVER WRITTEN.** |

🔴 **The missing `## 99 · UNSETTLED` is the dangerous part.** Every other bank in this corpus ends
with an explicit list of what its author could *not* settle, and the pages written from it cite
those items by name instead of inventing confident answers. This bank has no such list, so
**absence of a caveat here means nothing was recorded — it does NOT mean the claim is settled.**
A chunk written from this bank must verify anything load-bearing that it cannot find here with a
URL attached, or state it as uncertain.

**Topic 07 may be written from this bank now.** **Topic 08 may not be finished from it** — bank the
remainder first (the `ng new` file tree past the root component), or the later chunks will be
written from nothing.

---

## 0 · Facts every chunk needs

### 0.1 The version spine — re-measured 2026-09-09, matched the existing spine exactly

Every number below was re-fetched from `registry.npmjs.org` on **2026-09-09**. **Nothing drifted**
from the spine the corpus already carries.

| | Measured 2026-09-09 | Spine on existing pages | Match? |
|---|---|---|---|
| `@angular/core` `latest` | **22.1.5** | 22.1.5 | ✅ |
| `@angular/core` `next` | 22.2.0-next.5 | 22.2.0-next.5 | ✅ |
| `@angular/cli` `latest` | **22.1.7** (`next` 22.2.0-next.6) | 22.1.7 | ✅ |
| `@angular/build` `latest` | **22.1.7** (`next` 22.2.0-next.6) | 22.1.7 | ✅ |
| `@angular/ssr` `latest` | **22.1.7** (`next` 22.2.0-next.6) | 22.1.7 | ✅ |
| `@angular/compiler-cli@22.1.5` `typescript` peer | **`>=6.0 <6.1`** | `>=6.0 <6.1` | ✅ |
| `@angular/build@22.1.7` `typescript` peer | **`>=6.0 <6.1`** | (not previously stated) | new |
| LTS | v21 → 21.2.22 · v20 → 20.3.30 · v19 → 19.2.25 | same | ✅ |
| CLI LTS | v21 → 21.2.23 · v20 → 20.3.36 · v19 → 19.2.27 | (not previously stated) | new |
| engines (`compiler-cli`, `@angular/build`, `@angular/cli`) | `node: ^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0` | same | ✅ |
| 🔴 `typescript` `latest` on npm | **7.0.2** | — | **see §0.4** |
| `typescript` `next` | 7.1.0-dev.20260908.1 | — | — |
| TypeScript versions published | `6.0.2`, `6.0.3`, `7.0.2` are all real tags | — | — |

Sources:
`https://registry.npmjs.org/-/package/@angular/core/dist-tags`,
`https://registry.npmjs.org/-/package/@angular/cli/dist-tags`,
`https://registry.npmjs.org/-/package/@angular/build/dist-tags`,
`https://registry.npmjs.org/-/package/@angular/ssr/dist-tags`,
`https://registry.npmjs.org/-/package/typescript/dist-tags`,
`https://registry.npmjs.org/@angular/compiler-cli/22.1.5`,
`https://registry.npmjs.org/@angular/build/22.1.7`,
`https://registry.npmjs.org/@angular/cli/22.1.7`.

### 0.2 The `> Verified:` line to copy (adapt the source list per chunk)

```markdown
> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Page title](url) — and `angular/angular` at tag `v22.1.5`:
> [`path/file.ts`](https://github.com/angular/angular/blob/v22.1.5/path/file.ts);
> `angular/angular-cli` at tag `v22.1.7`:
> [`path/file`](https://github.com/angular/angular-cli/blob/v22.1.7/path/file).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
```

Blob URL shapes (both verified working while writing this bank):
`https://github.com/angular/angular/blob/v22.1.5/<path>` and
`https://github.com/angular/angular-cli/blob/v22.1.7/<path>`.

🔴 **Reading source yourself: `raw.githubusercontent.com` 404s in this environment.** Use
`gh api repos/angular/angular/contents/<path>?ref=v22.1.5 -q .content | base64 -d`
(and `repos/angular/angular-cli/... ?ref=v22.1.7` for the CLI). To list a whole tree:
`gh api repos/angular/angular-cli/git/trees/v22.1.7?recursive=1 -q '.tree[].path'`.

### 0.3 🔴 Shared vocabulary — say these words the same way on every chunk

- **The pin** — the string `>=6.0 <6.1`. It is a **`peerDependencies` entry**, and it is also
  independently re-implemented as a **runtime check inside the compiler** (§07.1). Two mechanisms,
  one range. Do not conflate them; a page that says "npm enforces it" is wrong about half of it.
- **`compilerOptions` vs `angularCompilerOptions`** — two sibling objects in one JSON file, read by
  two different consumers, merged across `extends` by two different mechanisms (§07.4). Never
  write "tsconfig option" without saying which of the two you mean.
- **The three tsconfigs** — `tsconfig.json` (workspace root, **solution-style**),
  `tsconfig.app.json`, `tsconfig.spec.json`. Always name all three when discussing "the split".
- **Strict mode** is ambiguous and must be disambiguated on first use in every chunk. There are
  **three unrelated things** called strict here:
  1. TypeScript's `compilerOptions.strict` (a TS flag, now default `true` — §07.10);
  2. Angular's `angularCompilerOptions.strictTemplates` (default `true` since v22.0.0 — §07.5);
  3. the CLI schematic's `--strict` option (a **schematic** flag, default `true`, that decides
     which of the above get *written into the file* — §07.3, §08.1).
  🔴 They are three different switches and the schematic one writes *neither* of the other two in
  its default state. That is the single most surprising fact in topic 07.

### 0.4 🔴 The fact that reframes topic 07: `npm i typescript@latest` breaks the build

Measured 2026-09-09: `typescript` `latest` on npm is **7.0.2**. Angular 22.1.5's pin is
`>=6.0 <6.1`. The two do not overlap and are a **whole major apart**.

So the ordinary, correct-looking instinct — "keep my tooling up to date" — installs a TypeScript
that Angular 22 refuses to compile with. This is not a hypothetical: it is the arithmetic of two
release trains that ship on different cadences. §07.1 has the exact error text.

⚠️ **Do not write "TypeScript 7 is unsupported by Angular" as a permanent fact.** It is true of
**22.1.5**. A later Angular minor may widen the pin. Write it as *"Angular 22.1.5 pins `>=6.0 <6.1`;
`typescript@latest` was 7.0.2 when this page was written"* and let the currency workflow re-measure.

### 0.5 🔴 Scope boundaries — four agents are working this phase in parallel

Where your material touches a neighbour's topic, **write one line and a forward pointer**, never a
second explanation. Topics 04–06 and 09–12 are **not written yet**, so they are **bold text plus
*(not written yet)***, never links.

| Neighbour | Owns | Your one line |
|---|---|---|
| **04 · `ng update`, not `npm install`** | schematics, migration mechanics, the update flow | The `strict-templates-default` migration (§07.5c) is *quoted* here because it decides what is in **your tsconfig**; the machinery that runs it is 04's. |
| **05 · The build: `@angular/build`** | esbuild/Vite, builders | `@angular/build` is the package that *reads* `tsconfig.app.json` and carries the second copy of the TS peer pin. Name it, stop. |
| **06 · `angular.json` anatomy** | projects, targets, builders, `configurations`, budgets | Topic 08 lists `angular.json` as **a generated file** and says what it is in one sentence. 🔴 **Do not describe targets, builders or budgets.** |
| **09 · The release train** | six-month majors, LTS windows, changelogs | §07.2's "why the pin moves every six months" is one sentence pointing at 09. |
| **10 · Partial compilation** / **11 · JIT vs AOT** | `ɵɵngDeclareComponent`, the linker, where JIT survives | §07.1's "the compiler reads TypeScript's internal API" must **not** turn into an AOT explanation. |
| **12 · Dev-mode-only behaviour** | `ngDevMode`, what vanishes in production | Nothing in 07/08 needs it. |
| **Phase 1 — Components and templates** | the template language itself | §07.7 shows what `strictTemplates` *rejects*. It must not become a template-syntax tutorial. |
| **Phase 6 — Dependency injection** | injectors, tokens, `inject()` | `strictInjectionParameters` (§07.8) is named and its effect quoted; the DI mechanism is Phase 6's. |
| **Phase 14 — Performance and the build** | budgets, bundle analysis | — |

### 0.6 🔴 Topic 08's hand-off contract — topic 03 already teaches this in depth

Topic **03 · The provider array** closed **2026-09-09 at 17 chunks / 90 files**. It already
contains, in depth, most of what a naive "tour of the generated files" page would re-explain.
**Topic 08 is the tour of the tree that hands off to those pages.**

Verified on disk 2026-09-09 (`ls` of `03-the-provider-array/`) — these files exist and are safe
to link:

| What topic 08 is about to explain | 🔴 Link this instead of re-explaining |
|---|---|
| `app.config.ts` — the object, `ApplicationConfig`, the one property | `../03-the-provider-array/01-app-config-and-what-bootstrap-does-with-it.md` |
| `main.ts` — what `bootstrapApplication(App, appConfig)` does | same file (it quotes both generated files verbatim and walks the six-step bootstrap) |
| The `.catch((err) => console.error(err))` in `main.ts` | `../03-the-provider-array/06c-when-a-startup-initializer-fails.md` |
| `provideBrowserGlobalErrorListeners()` — the one provider in the generated array | `../03-the-provider-array/06f-provide-browser-global-error-listeners.md` |
| Why there is **no** `provideZonelessChangeDetection()` in the generated file | `../03-the-provider-array/05-change-detection-providers.md` |
| `provideZoneChangeDetection({eventCoalescing: true})` in the `--no-zoneless` variant | `../03-the-provider-array/05b-provide-zone-change-detection-the-opt-out.md` |
| `app.routes.ts` — `provideRouter(routes)` and what `Routes` is to bootstrap | `../03-the-provider-array/07-provide-router-and-the-route-array.md` |
| The SSR trio (`app.config.server.ts`, `main.server.ts`, `app.routes.server.ts`) | `../03-the-provider-array/17c-the-generated-server-files.md` and `17-the-server-config-merge.md` |
| `mergeApplicationConfig` in the generated server config | `../03-the-provider-array/17-the-server-config-merge.md` |
| `BootstrapContext` in `main.server.ts` | `../03-the-provider-array/17d-bootstrapcontext-and-the-server-platform.md` |

🔴 **The sentence topic 03 chunk 01 already owns, and topic 08 must not restate as a discovery:**

> *"`app.config.ts` is a **file name chosen by a schematic**, not an API: the exported symbol could
> be called anything, live anywhere, and be assembled by a function. `bootstrapApplication` only
> cares that the second argument structurally matches `ApplicationConfig`."*

Topic 08 may *use* that fact (it is the thesis of the whole topic — these are **files a template
wrote**, not framework contracts) but must cite it, not re-derive it.

### 0.7 🔴 MDX hazards specific to these two topics

The authoring contract's Rule 6 bites unusually hard here because both topics quote generated
files.

1. **`app.html`'s generated content is a minefield.** The real template
   (§08.4) opens with **eight consecutive bare `<!-- ... -->` HTML comments** and ends with
   `<router-outlet />`. A bare `<!--` in prose and a bare `<Something` in prose both abort the
   Docusaurus build. **Inside a fenced code block they are safe.** Never lift a line of that file
   into prose without backticking it.
2. **`<router-outlet />`, `<app-root>`, `<user-detail>`** — always inside backticks or a fence.
3. The tsconfig templates contain `<% if (strict) { %>` EJS tags. `<%` is not `<Word`, so it does
   not trip the bare-tag rule, but **fence them anyway** — they are not valid JSON and a reader
   must be told so explicitly (§08.1).
4. `>=6.0 <6.1` contains a bare `<6` — **`<6` is not `<Letter`, so MDX tolerates it**, but the
   corpus convention is to backtick it every time: `` `>=6.0 <6.1` ``. Do that; it is also more
   readable.

### 0.8 The tier badge and sidebar conventions for both topics

Both topics are **Understand** per the phase README, so every chunk opens with:

```markdown
<span className="db-tier t-understand">Understand</span>
```

`sidebar_position` = the chunk number, unique and gap-free per directory.
`sidebar_label` = `"NN · Short label"` with a **middle dot** (`·`, U+00B7), matching topic 03.

---

## 1 · The single most valuable mechanism in topic 07

**Angular's TypeScript pin is enforced twice, by two independent mechanisms, and only one of them
is `package.json`.**

Most readers assume the `>=6.0 <6.1` range is a packaging concern — an npm peer warning you can
ignore or `--force` past. It is not. The Angular compiler **re-checks the version at compile time,
from inside its own constructor**, and throws a plain `Error` when it fails. The two mechanisms
have different failure surfaces, different timing, and different escape hatches:

| | `peerDependencies` | The in-compiler check |
|---|---|---|
| Lives in | `@angular/compiler-cli/package.json`, `@angular/build/package.json` | `packages/compiler-cli/src/typescript_support.ts` |
| Fires at | **install time** | **every compilation**, in `NgtscProgram`'s constructor |
| Enforced by | npm/yarn/pnpm, and `typescript` is **optional** for `compiler-cli` (§07.1b) | Angular itself, unconditionally |
| Failure | an `ERESOLVE` conflict, or a warning, or nothing at all | a thrown `Error` that fails the build |
| Escape hatch | `--legacy-peer-deps`, `--force`, a `resolutions` field | `angularCompilerOptions.disableTypeScriptVersionCheck` |

🔴 **That asymmetry is the whole point.** The install-time half can be silenced by the flags people
reach for reflexively when a peer conflict blocks them. The compile-time half cannot — so the
reader who "fixed" the peer conflict with `--force` has not fixed anything; they have moved the
error from `npm install` to `ng build`, where it is harder to recognise. Every chunk in topic 07
that touches the pin should be built on this table.

---

## Chunk 07.01 — `07-the-typescript-peer-pin.md`

### 07.1 The pin, from the published package metadata

From `https://registry.npmjs.org/@angular/compiler-cli/22.1.5`, fetched 2026-09-09, the
`peerDependencies` and `peerDependenciesMeta` objects **exactly as published**:

```json
"peerDependencies": {
  "typescript": ">=6.0 <6.1",
  "@angular/compiler": "22.1.5"
},
"peerDependenciesMeta": {
  "typescript": {
    "optional": true
  }
},
"engines": {
  "node": "^22.22.3 || ^24.15.0 || >=26.0.0"
}
```

And from `https://registry.npmjs.org/@angular/build/22.1.7`, the same pin appears again — with a
crucial difference. `@angular/build`'s `peerDependenciesMeta` marks **fourteen** of its peers
optional (`less`, `karma`, `rollup`, `vitest`, `postcss`, `ng-packagr`, `tailwindcss`,
`@angular/ssr`, `@angular/core`, `@angular/localize`, `@angular/service-worker`,
`istanbul-lib-instrument`, `@angular/platform-server`, `@angular/platform-browser`) —
**and `typescript` is not one of them**:

```json
"peerDependencies": {
  "typescript": ">=6.0 <6.1",
  "tslib": "^2.3.0",
  "@angular/compiler": "^22.0.0",
  "@angular/compiler-cli": "^22.0.0",
  ...
}
```

🔴 **So the same range is optional in one package and required in the other.** `typescript` is an
**optional** peer of `@angular/compiler-cli@22.1.5` and a **required** peer of
`@angular/build@22.1.7`. A CLI-built application depends on both, so in practice the required one
governs — but a library built with `ng-packagr`, or a Bazel/Nx setup that uses `compiler-cli`
without `@angular/build`, sits on the optional one and gets a *quieter* install.

⚠️ **`typescript` is NOT a peer of `@angular/core` at all.** Say "TypeScript peer `>=6.0 <6.1`"
and attribute it to `@angular/compiler-cli` and `@angular/build`, never to `core`. (This warning
is carried forward from topic 03's bank §0.1, where it was already needed once.)

### 07.1b What the CLI actually installs

`ng new` does not install `typescript@latest`. It installs a version the CLI hard-codes. From
[`packages/schematics/angular/utility/latest-versions/package.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/utility/latest-versions/package.json)
at `v22.1.7`, the relevant lines verbatim:

```json
"typescript": "~6.0.2",
"rxjs": "~7.8.0",
"tslib": "^2.3.0",
"zone.js": "~0.16.0",
"prettier": "^3.8.1",
"vitest": "^4.0.8",
"jasmine-core": "~6.3.0",
"karma": "~6.4.0",
"tailwindcss": "^4.1.12"
```

The file's own header comment explains why it exists:

> *"Package versions used by schematics in @schematics/angular."*
> *"This file is needed so that dependencies are synced by Renovate."*

That value is threaded into the generated `package.json` through
[`latest-versions.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/utility/latest-versions.ts),
which spreads the dependency map and then overrides the Angular-versioned entries with build-time
placeholders:

```ts
const dependencies = require('./latest-versions/package.json')['dependencies'];

export const latestVersions: Record<string, string> & {
  Angular: string;
  DevkitBuildAngular: string;
  AngularBuild: string;
  AngularSSR: string;
  NgPackagr: string;
} = {
  ...dependencies,

  // As Angular CLI works with same minor versions of Angular Framework, a tilde match for the current
  Angular: '0.0.0-ANGULAR-FW-VERSION',
  NgPackagr: '0.0.0-NG-PACKAGR-VERSION',
  DevkitBuildAngular: '^0.0.0-PLACEHOLDER',
  AngularBuild: '^0.0.0-PLACEHOLDER',
  AngularSSR: '^0.0.0-PLACEHOLDER',
};
```

🔴 **The `0.0.0-PLACEHOLDER` strings are substituted during the release build**, which is why you
cannot read the Angular version out of the CLI source. `~6.0.2` for TypeScript, however, is
literal — that is the real range a v22.1.7 `ng new` writes.

**`~6.0.2` is narrower than the peer pin.** `~6.0.2` allows `>=6.0.2 <6.1.0`; the peer allows
`>=6.0.0 <6.1.0`. So a fresh app is pinned *inside* the supported window with room for patches and
none for a minor. Worth one sentence.

### 07.1c 🔴 The compile-time check, in full — this is the section that earns the chunk

[`packages/compiler-cli/src/typescript_support.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/typescript_support.ts)
at `v22.1.5`, the whole file minus the licence header, verbatim:

```ts
import ts from 'typescript';

import {compareVersions} from './version_helpers';

/**
 * Minimum supported TypeScript version
 * ∀ supported typescript version v, v >= MIN_TS_VERSION
 *
 * Note: this check is disabled in g3, search for
 * `angularCompilerOptions.disableTypeScriptVersionCheck` config param value in g3.
 */
const MIN_TS_VERSION = '6.0.0';

/**
 * Supremum of supported TypeScript versions
 * ∀ supported typescript version v, v < MAX_TS_VERSION
 * MAX_TS_VERSION is not considered as a supported TypeScript version
 *
 * Note: this check is disabled in g3, search for
 * `angularCompilerOptions.disableTypeScriptVersionCheck` config param value in g3.
 */
const MAX_TS_VERSION = '6.1.0';

/**
 * The currently used version of TypeScript, which can be adjusted for testing purposes using
 * `setTypeScriptVersionForTesting` and `restoreTypeScriptVersionForTesting` below.
 */
let tsVersion = ts.version;

export function setTypeScriptVersionForTesting(version: string): void {
  tsVersion = version;
}

export function restoreTypeScriptVersionForTesting(): void {
  tsVersion = ts.version;
}

/**
 * Checks whether a given version ∈ [minVersion, maxVersion[.
 * An error will be thrown when the given version ∉ [minVersion, maxVersion[.
 *
 * @param version The version on which the check will be performed
 * @param minVersion The lower bound version. A valid version needs to be greater than minVersion
 * @param maxVersion The upper bound version. A valid version needs to be strictly less than
 * maxVersion
 *
 * @throws Will throw an error if the given version ∉ [minVersion, maxVersion[
 */
export function checkVersion(version: string, minVersion: string, maxVersion: string) {
  if (compareVersions(version, minVersion) < 0 || compareVersions(version, maxVersion) >= 0) {
    throw new Error(
      `The Angular Compiler requires TypeScript >=${minVersion} and <${maxVersion} but ${version} was found instead.`,
    );
  }
}

export function verifySupportedTypeScriptVersion(): void {
  checkVersion(tsVersion, MIN_TS_VERSION, MAX_TS_VERSION);
}
```

Five things a chunk should draw out of that file, in this order:

1. **The message string, exactly.** The template is
   `` `The Angular Compiler requires TypeScript >=${minVersion} and <${maxVersion} but ${version} was found instead.` ``
   With the v22.1.5 constants substituted, a reader on TypeScript 7.0.2 sees
   `` `The Angular Compiler requires TypeScript >=6.0.0 and <6.1.0 but 7.0.2 was found instead.` ``
   🔴 **Note the shape difference from the peer range.** The peer says `>=6.0 <6.1`; the error says
   `>=6.0.0 and <6.1.0`. Same interval, different rendering, because the error interpolates the
   two three-part constants. A page that quotes the error must use the three-part form, and a page
   that quotes the peer must use the two-part form. Do not normalise them to each other.
2. **It is a plain `Error`, not a `RuntimeError`.** There is no `NG` code, no error-code enum entry,
   and therefore **no `angular.dev/errors/...` page and no `Find more at …` suffix**. Searching for
   an NG code will find nothing. Say so — it is exactly what a stuck reader will try.
3. **The interval is half-open**, and both doc comments say so in set notation:
   *"∀ supported typescript version v, v < MAX_TS_VERSION"* and
   *"MAX_TS_VERSION is not considered as a supported TypeScript version"*. `6.1.0` itself is out.
4. **The comparison is `compareVersions`, Angular's own** (`./version_helpers`), not semver's
   range satisfaction. ⚠️ I did not read `version_helpers.ts`; see UNSETTLED #3 before asserting
   anything about prereleases (`6.1.0-beta`).
5. **Both doc comments name the escape hatch**, twice, identically:
   *"Note: this check is disabled in g3, search for `angularCompilerOptions.disableTypeScriptVersionCheck` config param value in g3."*
   The flag is real and public — §07.1d.

### 07.1d Where the check fires, and the flag that disables it

From
[`packages/compiler-cli/src/ngtsc/program.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/program.ts)
at `v22.1.5`, inside the `NgtscProgram` constructor:

```ts
    const perfRecorder = ActivePerfRecorder.zeroedToNow();

    perfRecorder.phase(PerfPhase.Setup);

    // First, check whether the current TS version is supported.
    if (!options.disableTypeScriptVersionCheck) {
      verifySupportedTypeScriptVersion();
    }
```

🔴 **`// First, check whether the current TS version is supported.` — it is literally the first
statement of the compilation.** Nothing is analysed, no template is parsed, no file is emitted.
That is why the failure looks like a tooling crash rather than a compile error: it happens before
compilation has a diagnostic channel to report into.

angular.dev documents the flag on
[Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options):

> *"When `true`, the compiler does not look at the TypeScript version and does not report an error
> when an unsupported version of TypeScript is used."*

Note the two halves of that sentence: it does not *look*, and it does not *report*. It does not
make the unsupported version work — it makes the compiler stop telling you. Frame it that way
whenever the chunk mentions the flag.

### 07.1e Gotchas to write (symptom-first)

1. **Symptom: `The Angular Compiler requires TypeScript >=6.0.0 and <6.1.0 but 7.0.2 was found
   instead.`** Cause: `typescript@latest` is 7.0.2 and Angular 22.1.5 supports only the 6.0 line
   (§0.4). Fix in code — pin it back in `package.json` to the range the CLI itself writes:
   ```json
   "devDependencies": {
     "typescript": "~6.0.2"
   }
   ```
2. **Symptom: `npm install` succeeded, `ng build` fails with the version error.** Cause: the two
   enforcement mechanisms in §1. `typescript` is an **optional** peer of `@angular/compiler-cli`,
   so a mismatch there need not block the install — and `--legacy-peer-deps` / `--force` silence
   the `@angular/build` one. Fix: stop passing the flag and let the resolver tell you; then pin.
3. **Symptom: a monorepo where one workspace builds and another does not, on the same lockfile.**
   Cause: a hoisted `typescript` in the root and a nested one in a package. The compiler reads
   `ts.version` from **whichever `typescript` module the compilation actually loaded**, not from
   the manifest. Fix: pin `typescript` at the root and remove the nested copy.
4. **Symptom: you set `disableTypeScriptVersionCheck: true` and now get thousands of unrelated
   type errors.** Cause: the check was the guardrail, not the problem; the compiler emits type-check
   blocks against TypeScript internals whose shape moved. Fix: remove the flag and pin the version.
   Show the flag being deleted, not added.
5. **Symptom: `ng update` refuses to run.** ⚠️ **Do not write this one.** It is topic 04's, and I
   did not verify the message. Named here only so a writer does not reach for it.
6. **Symptom: the error names a version you never installed.** Cause: a `resolutions` /
   `overrides` field, or a package manager patch, silently substituted one. Fix: check the
   lockfile for `typescript` before touching `package.json`.

### 07.1f Interview questions

- ★ *Angular pins TypeScript to `>=6.0 <6.1` — a single minor. Why so narrow, when most libraries
  accept a caret range?* → Because the compiler is not a *consumer* of TypeScript's public API, it
  is a **host** of TypeScript's compiler: it constructs `ts.Program`s, emits type-check blocks into
  a synthetic program, and reads internal-ish surfaces that TypeScript is free to move in a minor.
  §07.2 has the sourced version of this. Bonus half-answer: the check is duplicated at runtime
  precisely because a peer range alone is advisory.
- ★ *`npm install` printed a peer warning about `typescript` and you ignored it. What actually
  happens?* → Nothing, until the first compile — then `NgtscProgram`'s constructor throws
  `The Angular Compiler requires TypeScript >=6.0.0 and <6.1.0 but X was found instead.` before any
  analysis. The install-time and compile-time checks are independent (§1).
- ★ *Is there an `NG` code for the TypeScript version error?* → No. It is a plain `Error` thrown
  from `checkVersion`, with no `RuntimeError` wrapper and no error-code enum entry, so there is no
  `angular.dev/errors` page for it. Searching an NG code is a dead end.
- *What does `disableTypeScriptVersionCheck` do, and when is it legitimate?* → It skips
  `verifySupportedTypeScriptVersion()` entirely. Its documented home is Google's internal monorepo,
  named in the source comment twice, where the TypeScript version is managed globally. In an
  application it converts a clear failure into an obscure one.
- *Is `typescript` a peer dependency of `@angular/core`?* → No. It is a peer of
  `@angular/compiler-cli` (optional) and `@angular/build` (required). `core` ships no TypeScript
  peer at all, which is why the pin surprises people who only read `core`'s manifest.

---

## Chunk 07.02 — `08-why-the-pin-is-one-minor-wide.md`

This chunk is short and mostly *reasoning from sourced facts*. Keep it honest: the "why" is only
partly documented, and UNSETTLED #1 says so.

### 07.2a What the release record actually shows

From `angular/angular`'s `CHANGELOG.md` at `v22.1.5`
([link](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md)), three entries, each with
its release heading, verbatim:

Under **`# 21.2.0 (2026-02-25)`**, `### core`:

> `| 81cabc1477 | feat | add support for TypeScript 6 |`

Under **`# 22.0.0 (2026-06-03)`**, `### core`:

> `| 8fe025f514 | feat | drop support for TypeScript 5.9 |`

Under **`# 22.0.0 (2026-06-03)`**, `## Breaking Changes` → `### core`:

> *"- * TypeScript versions older than 6.0 are no longer supported."*

(The stray `*` after the dash is in the changelog, not a transcription error. Quote it as-is or
say you have trimmed it; do not silently clean it.)

🔴 **The pattern that answers the question is right there in the dates.** Support for the new
TypeScript major arrives in a **minor** of the *previous* Angular major (21.2.0, February), and
support for the old one is dropped in the **next major** (22.0.0, June). So there is a real
overlap window — v21.2 accepts both 5.9 and 6.0 — and the window closes at the major boundary.
That is a deliberate migration ramp, not an oversight, and it is the single best thing this chunk
can show.

⚠️ **The overlap claim needs care.** I read the changelog entries, not v21.2's
`typescript_support.ts`. The inference "21.2 accepted both" follows from *adding* 6 in 21.2 and
*dropping* 5.9 only in 22.0 — but I did not read v21.2's `MIN_TS_VERSION`/`MAX_TS_VERSION`
constants to confirm the range literally widened rather than moved. See UNSETTLED #2. Write it as
"the changelog shows support added in 21.2 and 5.9 dropped in 22.0" and let the reader draw the
conclusion, or read the v21.2 file first.

### 07.2b The mechanism, stated as a reading

The narrow pin follows from what `compiler-cli` *is*. Facts already sourced elsewhere in this bank
that a chunk can chain into an argument:

- It constructs and owns a `ts.Program` (`NgtscProgram`, §07.1d).
- It calls `ts.parseJsonConfigFileContent` and `ts.readConfigFile` directly (§07.4).
- It reads `ts.version` off the module object at runtime (§07.1c).
- It generates **type-check blocks** — synthetic TypeScript that TypeScript then checks — and the
  entire `TypeCheckingConfig` in §07.6 exists to shape that generated code.
- The `DiagnosticCategoryLabel` enum maps onto `ts.DiagnosticCategory` (§07.8).

🔴 **Frame it as: Angular does not *use* TypeScript, it *drives* TypeScript.** A library that
imports types can accept a caret range. A tool that emits code into another compiler's program and
reads its diagnostics is coupled to that compiler's minor.

⚠️ **I found no Angular documentation page stating this rationale.** It is an inference from the
source. The chunk must say so — "the documentation does not state why the range is one minor wide;
what follows is a reading of the compiler's source" — rather than presenting it as doctrine.
UNSETTLED #1.

### 07.2c The consequence the reader actually needs

Two release trains, different cadences, and the pin is the seam:

- Angular majors: every six months (**topic 09 · The release train** *(not written yet)* owns the
  full cadence — one line here, then stop).
- TypeScript minors: roughly quarterly, and TypeScript **6.0 → 7.0** happened inside this window
  (§0.4).

So `typescript@latest` is *routinely* ahead of what Angular accepts, and the correct posture is
**"let `ng update` move TypeScript"**, not `npm install typescript@latest`. That sentence is the
bridge to **topic 04 · `ng update`, not `npm install`** *(not written yet)* — one line, a pointer,
and stop. 🔴 Do not explain `ng update` here.

### 07.2d Gotchas to write

1. **Symptom: "I upgraded TypeScript and Angular broke; I'll upgrade Angular to match."** Cause:
   the causality is backwards — Angular decides which TypeScript is acceptable, not the reverse.
   Fix: revert TypeScript to the pinned range, then move Angular deliberately.
2. **Symptom: a `typescript` entry in `dependencies` rather than `devDependencies`.** Cause: hand
   editing. The CLI writes it to `devDependencies` (§08.2). It is a compile-time tool; shipping it
   as a runtime dependency is wrong even though nothing fails loudly. Fix, in code:
   ```json
   "devDependencies": {
     "typescript": "~6.0.2"
   }
   ```
3. **Symptom: a shared monorepo pins one TypeScript across Angular and non-Angular packages.**
   Cause: the Angular constraint is the tightest one present, so it governs the whole repo.
   Fix: pin to Angular's range, or split the workspace's TypeScript resolution.

### 07.2e Interview questions

- ★ *Why can Angular not just accept `^6.0.0`?* → `^6.0.0` includes 6.1, 6.2 and so on, and the
  compiler emits code into TypeScript's own program and reads surfaces that move between minors.
  The half-open `[6.0.0, 6.1.0)` interval is the compiler saying it has been tested against exactly
  one minor. Note the constants are literally `MIN_TS_VERSION`/`MAX_TS_VERSION`, not a semver range
  string — Angular does its own comparison.
- *When does Angular add support for a new TypeScript major?* → The changelog shows TypeScript 6
  support arriving in **21.2.0** (a minor of the previous major) and 5.9 being dropped in
  **22.0.0**. Support lands early, removal waits for the major boundary.
- *Your CI installs `typescript@latest`. What breaks and when?* → Nothing at install; the first
  `ng build` throws the version error before any analysis. Pin the version in `package.json`.

---

## Chunk 07.03 — `09-the-three-tsconfig-files.md`

🔴 **This is the chunk the topic title promises and the one most likely to be written from memory
instead of from source. Every file below was read from the CLI's own templates.**

### 07.3a The root `tsconfig.json`, verbatim from the template

[`packages/schematics/angular/workspace/files/tsconfig.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/tsconfig.json.template)
at `v22.1.7`, complete and unmodified, EJS tags included:

```
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

🔴 **Fence this as plain text, not `json` — it is not valid JSON.** `<% if (strict) { %>` is an EJS
template tag. Show the template once, then show the *resolved* default output separately (§07.3b)
and say which is which. A reader who copies the template into a real project gets a parse error.

### 07.3b The default resolved output — and the two omissions that define the topic

With the schematic defaults (`strict: true`, from
[`workspace/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/schema.json)
and [`ng-new/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/ng-new/schema.json),
both `"strict": {"type": "boolean", "default": true}`), the generated file is:

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

🔴 **Read what is NOT there.** In the *strict* branch — the default — the file contains **no
`"strict": true`** and **no `"strictTemplates": true`**. Only the negations are ever written, in
the `--no-strict` branch. Both settings are on by **default**, from two different places:

- `compilerOptions.strict` — **TypeScript 6.0 made it default `true`** (§07.10).
- `angularCompilerOptions.strictTemplates` — **Angular 22.0.0 made it default `true`** (§07.5).

**This is deliberate, and the CLI's own test suite asserts it.** From
[`packages/schematics/angular/workspace/index_spec.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/index_spec.ts)
at `v22.1.7`, both specs verbatim:

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

🔴 `expect(compilerOptions.strict).toBeUndefined();` and
`expect(angularCompilerOptions.strictTemplates).toBeUndefined();` **in the `strict: true` case.**
That is upstream asserting the omission on purpose. This is the strongest single piece of evidence
in topic 07 and the chunk should lead the section with it — it converts "the template happens not
to write it" into "the CLI intends not to write it."

**The reader-facing consequence, which is the whole point:**
`--strict` does not mean "turn strictness on". It means *"do not turn the defaults off, and add
the extras."* `--no-strict` is the branch that actually writes settings — three of them
(`strict: false`, `strictTemplates: false`, and dropping the two extras).

### 07.3c `tsconfig.app.json`, verbatim

[`packages/schematics/angular/application/files/common-files/tsconfig.app.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/tsconfig.app.json.template):

```
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

For a single-application workspace, `relativePathToWorkspaceRoot` resolves to `.`, so the resolved
`"extends"` is `"./tsconfig.json"`.

Three things to explain, in order:

1. **`"types": []`** — an empty array is not "no opinion", it is **"no automatic `@types` inclusion
   at all"**. Without it, TypeScript pulls in every `@types/*` package under `node_modules/@types`,
   which for an application means test globals (`jasmine`, `vitest/globals`) and Node's globals
   leak into application code and *compile*. The empty array is what makes
   `describe(...)` a compile error in `src/app/app.ts`. This is the single highest-value line in
   the file and most readers have never noticed it.
2. **`"include": ["src/**/*.ts"]`** — the application's own source, all of it.
3. **`"exclude": ["src/**/*.spec.ts"]`** — 🔴 **the app config deliberately excludes the specs.**
   That exclusion is the other half of the split: specs are compiled by `tsconfig.spec.json`, with
   different `types`, and never by the app build.

### 07.3d `tsconfig.spec.json`, verbatim

[`packages/schematics/angular/application/files/common-files/tsconfig.spec.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/tsconfig.spec.json.template):

```
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

Resolved with the v22 defaults (`testRunner: 'vitest'`, `standalone: true` — both from
[`application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/schema.json)):

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

Points worth a paragraph each:

- **`types` is the *only* `compilerOptions` difference between app and spec.** Everything else —
  target, module, strictness, `angularCompilerOptions` — is inherited. The split exists to answer
  one question: *which ambient globals is this file allowed to see?*
- 🔴 **`"vitest/globals"` is the v22 default, not `"jasmine"`.** `testRunner` defaults to
  `"vitest"` in both `application/schema.json` and `ng-new/schema.json`
  (`"testRunner": {"enum": ["vitest", "karma"], "default": "vitest"}`). A page that shows
  `"types": ["jasmine"]` is describing `--test-runner=karma`, or an older CLI. Say which.
- ⚠️ **The `standalone` conditional in `include` is genuinely odd**: for a standalone app the glob
  is `src/**/*.spec.ts`, but for `--no-standalone` it widens to `src/**/*.ts` — the *whole* source
  tree compiled with test globals available. I could not find a documented reason. UNSETTLED #6.
- **`src/**/*.d.ts` is included in the spec config and not in the app config.** ⚠️ The app config
  includes `src/**/*.ts`, which already matches `.d.ts` files, so this is belt-and-braces rather
  than a difference in reachable declarations. State it as an observation, not a rule.

### 07.3e 🔴 The root config is a *solution* config — `"files": []` plus `references`

The root `tsconfig.json` ends with `"files": []` and lists **no `include`**. On its own that
config compiles nothing at all. It is a **solution-style / project-references** root, and the
application schematic wires the references in as a separate step.

From
[`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts)
at `v22.1.7`, verbatim:

```ts
function addTsProjectReference(...paths: string[]) {
  return (host: Tree) => {
    if (!host.exists('tsconfig.json')) {
      return host;
    }

    const newReferences = paths.map((path) => ({ path }));

    const file = new JSONFile(host, 'tsconfig.json');
    const jsonPath = ['references'];
    const value = file.get(jsonPath);
    file.modify(jsonPath, Array.isArray(value) ? [...value, ...newReferences] : newReferences);
  };
}
```

and its two call sites, in the schematic's `chain([...])`:

```ts
    return chain([
      addAppToWorkspaceFile(options, appDir),
      addTsProjectReference('./' + join(normalize(appDir), 'tsconfig.app.json')),
      options.skipTests || options.minimal
        ? noop()
        : addTsProjectReference('./' + join(normalize(appDir), 'tsconfig.spec.json')),
```

🔴 **Four consequences, and this is the part nobody writes down:**

1. **The root `tsconfig.json` is written by the *workspace* schematic and then mutated by the
   *application* schematic.** The template you read in §07.3a is not the final file. `references`
   appears only after an application is added. This is also why `--create-application=false`
   leaves a root config with `"files": []` and **no `references` key at all**.
2. **The reference to `tsconfig.spec.json` is conditional** on `!skipTests && !minimal`. So
   `ng new --minimal` or `--skip-tests` produces a root config with exactly **one** reference.
   And note the *matching* conditional in the common-files pipeline —
   `options.minimal ? filter((path) => !path.endsWith('tsconfig.spec.json.template')) : noop()` —
   so under `--minimal` the spec config is not generated *and* not referenced. Two conditions kept
   in sync by hand.
3. **The paths are prefixed `'./'` explicitly** and built with `join(normalize(appDir), ...)`. For
   a root application `appDir` is `''`-ish, giving `./tsconfig.app.json`; for a project under
   `projects/`, `./projects/<name>/tsconfig.app.json`.
4. **`addTsProjectReference` appends, it does not replace** —
   `Array.isArray(value) ? [...value, ...newReferences] : newReferences`. So `ng generate
   application` in an existing workspace adds to the list. That is how a multi-project workspace's
   root config accumulates.

⚠️ **What I did NOT verify: whether `@angular/build` actually *uses* the project references.**
Solution-style roots exist so that `tsc -b` and editors can resolve a multi-project workspace; it
does not follow that the Angular builder performs a referenced build. The builder is handed
`tsConfig: "<projectRoot>tsconfig.app.json"` directly (§07.3f). **Write the references as "what
the CLI generates and what editors and `tsc -b` use", not as "how `ng build` works".**
UNSETTLED #5. 🔴 The builder side is **topic 05 · The build: `@angular/build`** *(not written yet)*
— one line, then stop.

### 07.3f Which config each tool is actually pointed at

The application schematic writes the build target's `tsConfig` into `angular.json`. From the same
`application/index.ts`:

```ts
          tsConfig: `${projectRoot}tsconfig.app.json`,
```

🔴 **That single line is the answer to "which file does my build read?"** — `angular.json` names
it explicitly per target. The root `tsconfig.json` is reached only *through* `extends`.

**Topic 06 · `angular.json` anatomy** *(not written yet)* owns targets, builders and options.
This chunk quotes the one `tsConfig` line, says "a target names its tsconfig", and stops.

The resulting mental model, which the chunk should state as a table:

| File | Who reads it | What it uniquely contributes |
|---|---|---|
| `tsconfig.json` | nothing directly — reached via `extends`; plus editors / `tsc -b` via `references` | every shared `compilerOptions` and **all** `angularCompilerOptions` |
| `tsconfig.app.json` | the `build` / `serve` targets, named in `angular.json` | `types: []`, includes `src/**/*.ts`, **excludes** `*.spec.ts` |
| `tsconfig.spec.json` | the `test` target | `types: ["vitest/globals"]`, includes `*.spec.ts` and `*.d.ts` |

### 07.3g Gotchas to write

1. **Symptom: `Cannot find name 'describe'.` in a `.spec.ts` file, in the editor only.** Cause: the
   editor resolved the file through `tsconfig.app.json` (which **excludes** `*.spec.ts` and sets
   `types: []`) instead of `tsconfig.spec.json`. Fix: ensure the root config's `references` array
   contains **both** projects — the spec reference is conditional on `!skipTests && !minimal`
   (§07.3e #2), so a `--minimal` workspace never had one:
   ```json
   "references": [
     { "path": "./tsconfig.app.json" },
     { "path": "./tsconfig.spec.json" }
   ]
   ```
2. **Symptom: `describe` / `it` resolve fine inside `src/app/app.ts` (application code).** Cause:
   `"types": []` was removed or edited in `tsconfig.app.json`, so every `@types/*` package is
   auto-included again. Fix: put it back —
   ```json
   "compilerOptions": {
     "types": []
   }
   ```
3. **Symptom: you added `"strictTemplates": false` to `tsconfig.app.json` and the *tests* still
   fail template type-checking.** Cause: `tsconfig.spec.json` extends the **root**, not
   `tsconfig.app.json`. The three files form a **star, not a chain** — app and spec are siblings.
   Fix: put shared `angularCompilerOptions` in the root; put them in a leaf only when you mean
   *that leaf only*.
4. **Symptom: a setting you put in the root has no effect for the app.** Cause: a leaf redeclared
   the same key. `angularCompilerOptions` merges **shallowly**, child-wins (§07.4). Fix: remove the
   leaf's copy, or set the value you want there.
5. **Symptom: `ng test` sees Node globals; `ng build` does not.** Cause: working as designed —
   `types` is the only `compilerOptions` difference between the two leaves. Not a bug. If you
   genuinely need Node types in application code, add them explicitly to `tsconfig.app.json`'s
   `types` array rather than emptying it.
6. **Symptom: you added a new top-level source folder and the build ignores it.** Cause:
   `tsconfig.app.json`'s `include` is `src/**/*.ts` — anything outside `src/` is invisible. Fix:
   extend `include`, in code:
   ```json
   "include": [
     "src/**/*.ts",
     "shared/**/*.ts"
   ]
   ```
7. **Symptom: `tsc` at the workspace root reports "no inputs were found".** Cause: `"files": []`
   with no `include` — the root compiles nothing by design (§07.3e). Fix: build a referenced
   project, or point `tsc` at a leaf config.
8. **Symptom: a second application's config overwrote the first's reference.** It cannot —
   `addTsProjectReference` appends (§07.3e #4). If a reference is missing, it was hand-edited.

### 07.3h Interview questions

- ★ *Why are there three tsconfig files instead of one?* → Because application code and test code
  need **different ambient globals**, and that is expressible only by compiling them as two
  programs. The root holds everything shared (including all `angularCompilerOptions`); the two
  leaves differ in exactly one `compilerOptions` key — `types` — plus their `include`/`exclude`
  globs. The root is a solution-style config (`"files": []`) that compiles nothing itself and lists
  the leaves under `references`.
- ★ *What does `"types": []` in `tsconfig.app.json` actually do?* → It disables automatic inclusion
  of every `@types/*` package in `node_modules/@types`. That is what stops test globals and Node
  globals from being visible — and compiling — inside application source. Deleting it is a common
  self-inflicted wound: everything still builds, and the failure only shows up when a `describe()`
  accidentally left in application code type-checks.
- ★ *`tsconfig.spec.json` extends the root, not `tsconfig.app.json`. Why does that matter?* →
  Because the three files are a star, not a chain. Anything you put in `tsconfig.app.json` — a
  path mapping, a strictness override, a `lib` — is invisible to tests. Shared configuration has
  exactly one correct home: the root.
- *What is `"files": []` doing in the root config?* → Marking it as a solution/project-references
  root. It contributes options through `extends` and lists the real projects in `references`; it
  has no inputs of its own.
- *Which tsconfig does `ng build` read?* → The one named by the build target's `tsConfig` option in
  `angular.json` — `<projectRoot>tsconfig.app.json` by default. The root is reached only through
  that file's `extends`.
- *You ran `ng new --minimal`. What is different about the tsconfigs?* → `tsconfig.spec.json` is
  not generated (the common-files pipeline filters the template out) and the root's `references`
  array has one entry instead of two.

---

## Chunk 07.04 — `10-angularcompileroptions-and-how-it-inherits.md`

🔴 **The best-kept secret in the Angular tsconfig: `compilerOptions` and `angularCompilerOptions`
inherit through `extends` by two completely different mechanisms — and Angular's is hand-rolled.**

### 07.4a Where the object lives

angular.dev, [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options), verbatim:

> *"The Angular options object, `angularCompilerOptions`, is a sibling to the `compilerOptions`
> object."*

and on inheritance generally:

> *"A TypeScript configuration can inherit settings from another file using the `extends` property."*

That second sentence is true but incomplete, and the gap is the whole chunk.

### 07.4b The hand-rolled merge, verbatim

From
[`packages/compiler-cli/src/perform_compile.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/perform_compile.ts)
at `v22.1.5`, inside `readConfiguration`:

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

and the result being handed to TypeScript:

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

### 07.4c The load-bearing comment, and five things it implies

🔴 **The sentence the whole chunk is built on**, verbatim from the source:

> *"we are only interested into merging 'angularCompilerOptions' as other options like
> 'compilerOptions' are merged by TS"*

(The grammar is upstream's. Quote it as written — the corpus rule is that the source wins,
typos included. Do not silently correct "into" to "in".)

Five implications, each worth a paragraph:

1. **Two merge engines, one file.** `compilerOptions` is merged by
   `ts.parseJsonConfigFileContent`, which is TypeScript's own well-specified `extends` handling.
   `angularCompilerOptions` is merged by the ~25 lines above, written by Angular, because
   TypeScript has no reason to know the key exists. Anyone reasoning about
   `angularCompilerOptions` inheritance from the TypeScript handbook is reading the wrong spec.
2. **The Angular merge is SHALLOW.** `{...angularCompilerOptions, ...parentOptions}` is one spread
   level. So a nested object — `extendedDiagnostics`, which has `defaultCategory` and `checks`
   (§07.8) — is **replaced wholesale**, not deep-merged. A leaf config that sets
   `extendedDiagnostics: {checks: {...}}` **discards** the root's `defaultCategory`. 🔴 This is the
   most damaging practical consequence and belongs in the gotchas.
3. **Child wins — but the parameter name says the opposite.** In
   `{...angularCompilerOptions, ...parentOptions}`, the spread that lands **last** wins, and that
   is `parentOptions`. Yet the semantics are child-wins. The resolution is that
   `parentOptions` is an **accumulator threaded downward**: `readAngularCompilerOptions(configFileName)`
   starts with `{}` for the file you named, computes that file's options, and then recurses into
   the *extended* file passing the already-accumulated (i.e. **descendant**) options as
   `parentOptions`. So by the time you are reading the root `tsconfig.json`, `parentOptions` holds
   `tsconfig.app.json`'s values, and spreading it last makes the **leaf** win. ⚠️ **Say this
   carefully or not at all.** It is correct as described, but the identifier is actively
   misleading, and a chunk that quotes the line without the explanation will teach the inverse.
4. **`extends` may be an array**, and the reduce is over `[...extendsPaths].reverse()` with the
   comment *"Reverse the array so the overrides happen from right to left."* Multiple `extends`
   entries are a TypeScript 5.0+ feature; Angular honours it for its own key too.
5. **`bazelOptions.angularCompilerOptions` is an accepted alternative location**, per the comment
   *"Note: In Google, `angularCompilerOptions` are stored in `bazelOptions`."* — with the read as
   `config.angularCompilerOptions ?? config.bazelOptions?.angularCompilerOptions`. Note `??`: a
   present-but-empty `angularCompilerOptions: {}` **wins over** any `bazelOptions` copy, because
   `{}` is not nullish. Worth one sentence; it is not application-relevant but it explains the code.

### 07.4d Independent corroboration — Angular's own migration does the same thing by hand

The `strict-templates-default` migration (§07.5c, quoted in full there) contains this helper and
this comment, verbatim from
[`packages/core/schematics/migrations/strict-templates-default/index.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/migrations/strict-templates-default/index.ts):

```ts
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
```

🔴 **Two independent places in the Angular codebase re-implement `angularCompilerOptions`
inheritance, and they say so in their comments.** That is the strongest possible evidence that
this is a real, load-bearing quirk and not an incidental detail.

Note also that the migration's spread is `{...parentOptions, ...angularOptions}` — the **obvious**
order, with an explicit comment *"the options of the current file overwrite those of the parent"* —
whereas `perform_compile.ts` achieves the same outcome with the accumulator inverted (#3 above).
Same semantics, opposite-looking code. If the chunk shows both, show them together and explain the
difference; showing only `perform_compile.ts`'s line is how a writer gets this backwards.

⚠️ The migration's version handles only a **string** `extends`, not an array (`join(dirname(...), config.extends)`).
`perform_compile.ts` handles both. Do not present the migration's helper as the general rule.

### 07.4e Gotchas to write

1. **Symptom: you set `extendedDiagnostics.defaultCategory` in the root and
   `extendedDiagnostics.checks` in `tsconfig.app.json`, and `defaultCategory` reverts to the
   default.** Cause: the shallow spread (§07.4c #2) replaces the whole `extendedDiagnostics`
   object. Fix — put both in the same file:
   ```json
   "angularCompilerOptions": {
     "extendedDiagnostics": {
       "defaultCategory": "error",
       "checks": {
         "invalidBananaInBox": "suppress"
       }
     }
   }
   ```
2. **Symptom: an `angularCompilerOptions` setting in `tsconfig.app.json` does not apply to tests.**
   Cause: the star topology (§07.3g #3) — `tsconfig.spec.json` extends the root, not the app
   config. Fix: move it to the root.
3. **Symptom: an unknown key in `angularCompilerOptions` is silently ignored.** Cause: the merge is
   an untyped object spread; there is no schema validation of the key set at this layer. Only
   specific options get compatibility diagnostics (§07.8). Fix: check the spelling against
   [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options);
   a typo produces no error.
4. **Symptom: after `ng update`, a `strictTemplates` you never wrote appears in your tsconfig.**
   Cause: the migration in §07.5c. Not a bug — see that section for what value it writes and why.

### 07.4f Interview questions

- ★ *Both `compilerOptions` and `angularCompilerOptions` inherit through `extends`. Is the
  behaviour the same?* → The *outcome* is similar (child wins) but the *mechanism* is entirely
  different. `compilerOptions` is merged by `ts.parseJsonConfigFileContent`. `angularCompilerOptions`
  is merged by Angular's own recursive helper in `perform_compile.ts`, whose comment says
  *"we are only interested into merging 'angularCompilerOptions' as other options like
  'compilerOptions' are merged by TS"*. TypeScript does not know the key exists.
- ★ *You set `extendedDiagnostics.defaultCategory` in the root and `extendedDiagnostics.checks` in
  a leaf. What do you get?* → Only `checks`. Angular's merge is a **shallow** object spread, so the
  leaf's `extendedDiagnostics` replaces the root's entirely and `defaultCategory` falls back to its
  own default (`warning`). Nested `angularCompilerOptions` objects are all-or-nothing per file.
- *Does `extends` support an array?* → Yes, and Angular honours it —
  `[...extendsPaths].reverse().reduce(...)`, with the comment *"Reverse the array so the overrides
  happen from right to left."*
- *Where else does Angular re-implement this merge?* → In the `strict-templates-default`
  schematic, whose comment reads *"Since the TypeScript API doesn't perform a deep merge of
  custom/non-standard keys during config parsing, we must traverse the inheritance chain manually"*.
  Two implementations, same reason.

---

## Chunk 07.05 — `11-stricttemplates-is-the-default-in-v22.md`

🔴 **The headline: `strictTemplates` defaults to `true` in Angular 22, and a new app's
`tsconfig.json` never says so.** Proved three ways below. This is the chunk most likely to
contradict every blog post and every pre-v22 memory the reader has.

### 07.5a Proof 1 — the type's own doc comment

From
[`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts)
at `v22.1.5`, inside `interface TypeCheckingOptions` (which carries `@publicApi`), verbatim:

```ts
  /**
   * If `true`, implies all template strictness flags below (unless individually disabled).
   *
   * Defaults to `true`
   */
  strictTemplates?: boolean;
```

Two independent claims in four lines: the default, and the semantics
(*"implies all template strictness flags below (unless individually disabled)"* — which §07.6
cashes out flag by flag).

### 07.5b Proof 2 — the implementation, which is stricter than "defaults to true"

From
[`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
at `v22.1.5`, with its own doc comment:

```ts
  /**
   * strictTemplate is `true` by default.
   * Explicit opt-out is required to disable strictness
   */
  private get strictTemplates(): boolean {
    return this.options.strictTemplates !== false;
  }
```

🔴 **`!== false`, not `?? true`.** The distinction is real and worth a paragraph: `undefined`,
`null`, `0`, `""` and any other value all resolve to **strict**. The *only* thing that disables it
is the literal boolean `false`. The doc comment says exactly this —
*"Explicit opt-out is required to disable strictness"* — and a hand-written
`"strictTemplates": null` or a JSON `0` does not opt out.

The same getter is consulted at both extended-diagnostics gates in the file
(`if (this.strictTemplates && extendedTemplateChecker !== null)`, twice), so the `!== false`
semantics govern the extended checks too.

### 07.5c 🔴 Proof 3, and the best gotcha in the topic — the migration writes `false`

`ng update` into v22 does **not** leave your existing project on the new default. From
[`packages/core/schematics/migrations/strict-templates-default/index.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/migrations/strict-templates-default/index.ts)
at `v22.1.5`, the whole migration function and its doc comment, verbatim:

```ts
/**
 * Migration that adds `strictTemplates: false` to `tsconfig.json` files.
 */
export function migrate(): Rule {
  return async (tree) => {
    const {buildPaths, testPaths} = await getProjectTsConfigPaths(tree, {
      angularBuildersOnly: true,
    });
    const allPaths = [...new Set([...buildPaths, ...testPaths])];

    for (const tsconfigPath of allPaths) {
      const json = new JSONFile(tree, tsconfigPath);
      const compilerOptions = json.get(['compilerOptions']);

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
    }
  };
}
```

The doc comment is unambiguous: **`Migration that adds `strictTemplates: false` to `tsconfig.json` files.`**

🔴 **So two Angular 22.1.5 applications can have opposite template strictness, and the difference
is only how they got to v22:**

| How the app reached v22 | `strictTemplates` in `tsconfig.json` | Effective value |
|---|---|---|
| `ng new` on v22 | **absent** | **`true`** (the default) |
| `ng update` from v21 | **written explicitly as `false`** by the migration | **`false`** |

That asymmetry is the single most useful fact a v22 Angular developer can carry, and nothing on
angular.dev states it. It explains "why does the same code type-check in my new project and not in
the old one" completely.

Four mechanics of the migration worth calling out:

1. **It is preserve-behaviour, not adopt-the-default.** The whole point of writing `false` is that
   an upgraded codebase keeps compiling. A team that wants the new strictness must **delete the
   line the migration added**. Show that as the fix, in code.
2. **It skips configs with no `compilerOptions`** — `!compilerOptions || typeof compilerOptions !== 'object' || Object.keys(compilerOptions).length === 0`
   → `continue`. A tsconfig that is purely a solution root can be skipped.
   🔴 **CORRECTED 2026-09-09 — this note previously said the workspace root `tsconfig.json` "is not
   skipped". That is WRONG, and it presumed the root is visited at all.** `project_tsconfig_paths.ts`
   at `v22.1.5` excludes it by name, with the comment verbatim: *"Note that we are not interested in
   IDE-specific tsconfig files (e.g. /tsconfig.json)"*. The migration writes into
   `tsconfig.app.json` and `tsconfig.spec.json`, **never** the workspace root. A reader who greps
   the root for `strictTemplates` and finds nothing has not found evidence the migration did not
   run.
3. **It checks the resolved, inherited value first** — `getResolvedAngularCompilerOptions` walks
   `extends` (§07.4d) — so if any ancestor already sets `strictTemplates`, nothing is written.
   Then it checks the file's own key again before writing. Two guards, deliberately.
4. **It only visits Angular-builder projects** — `getProjectTsConfigPaths(tree, {angularBuildersOnly: true})`
   — and it visits **both** `buildPaths` and `testPaths`, de-duplicated through a `Set`. So both
   `tsconfig.app.json` and `tsconfig.spec.json` are candidates.

🔴 **Boundary: the *mechanism* of `ng update` — how migrations are discovered, ordered and run —
is topic 04 · `ng update`, not `npm install`** *(not written yet)*. This chunk quotes what the
migration **writes into your tsconfig** and stops there. One line pointing forward.

### 07.5d When the default changed, and the changelog gap

From `angular/angular`'s `CHANGELOG.md` at `v22.1.5`:

Under **`# 22.0.0 (2026-06-03)`**, `### migrations`:

> `| 682aaf943f | feat | add strictTemplates to tsconfig during ng update |`
> `| 1415d86980 | fix | Fix typo for strict-template migration |`

Under **`# 22.1.0 (2026-07-29)`**, `### language-service`:

> `| a99fb915c0 | fix | account for strictTemplates being enabled by default |`

⚠️ 🔴 **`strictTemplates` becoming the default is NOT in v22.0.0's `## Breaking Changes` list.**
I read that section in full (it has entries under `compiler`, `compiler-cli`, `core`, `forms`,
`http`, `platform-browser`, `router` and `upgrade`) and the default flip is not among them. The
migration entry under `### migrations` is the only changelog trace, plus the v22.1.0 language-service
follow-up. That is a real documentation gap and belongs in `## 100 · Found, not fixed`, not in a
confident sentence claiming the changelog announced it.

What the v22.0.0 breaking-changes list **does** say, under `### compiler`, and which is closely
related enough to quote here verbatim:

> *"- This change will trigger the `nullishCoalescingNotNullable` and `optionalChainNotNullable`
> diagnostics on exisiting projects. You might want to disable those 2 diagnotiscs in your
> `tsconfig` temporarily."*

(Two typos — "exisiting", "diagnotiscs" — are upstream. Quote as-is.) And the paired migration,
under `### migrations`:

> `| 6a435658e2 | feat | Disabling nullishCoalescingNotNullable & optionalChainNotNullable on ng update |`

🔴 **Same pattern as `strictTemplates`: a new default, plus a migration that writes the old
behaviour into your config.** Two instances of the same policy in one release is worth naming
explicitly — Angular's v22 posture is *"new projects get the strict default; upgraded projects get
an explicit opt-out written for them."* That generalisation is well supported by two independent
migrations and is the through-line of this chunk.

### 07.5e Gotchas to write

1. **Symptom: the same component compiles in a new project and fails in an old one, on the same
   Angular version.** Cause: the migration wrote `strictTemplates: false` into the upgraded
   project (§07.5c). Fix — delete the line to adopt the default:
   ```json
   "angularCompilerOptions": {
     "enableI18nLegacyMessageIdFormat": false,
     "strictInjectionParameters": true,
     "strictInputAccessModifiers": true
   }
   ```
2. **Symptom: you set `"strictTemplates": null` (or removed the value but left the key) expecting to
   disable it.** Cause: `this.options.strictTemplates !== false` — only the literal `false`
   disables it (§07.5b). Fix: write `false`, or delete the key entirely to get the default.
3. **Symptom: you deleted `strictTemplates: false` from `tsconfig.app.json` and templates are still
   unchecked.** Cause: an ancestor still sets it. The migration writes into **both** build and test
   configs, and `angularCompilerOptions` inherits (§07.4). Fix: grep all three files.
4. **Symptom: hundreds of new template errors after removing the opt-out.** Cause: working as
   intended — §07.6 lists exactly which checks switched on and §07.7 shows what each rejects. Fix:
   re-enable strictness *and* disable individual flags, rather than the all-or-nothing switch —
   §07.6c shows that each flag is honoured independently on top of the `strictTemplates` baseline.
5. **Symptom: your editor reports template errors the build does not (or vice versa).** Cause: the
   language service reads the same config, but v22.1.0 shipped
   `fix | account for strictTemplates being enabled by default` — an editor on an older
   `@angular/language-service` can disagree with the compiler. Fix: align the language-service
   version with the compiler version.
6. **Symptom: `strictTemplates: false` and now `extendedDiagnostics` is an error.** Cause: a
   compatibility check — full text and code in §07.8. Fix is shown there.

### 07.5f Interview questions

- ★ *Is `strictTemplates` on or off in a fresh Angular 22 app, and how would you prove it from the
  generated files?* → **On.** And you cannot prove it from the generated files — that is the point.
  The root `tsconfig.json` does not contain the key at all, because the CLI only writes the
  *negations*. The proof is `public_options.ts`'s `Defaults to `true`` and
  `compiler.ts`'s `return this.options.strictTemplates !== false;`, plus the CLI's own spec
  asserting `expect(angularCompilerOptions.strictTemplates).toBeUndefined()` in the strict case.
- ★ *Two teams are both on Angular 22.1.5. One has template type errors, the other does not, with
  the same component. What is the most likely cause?* → One project was created with `ng new` on
  v22 (no key, default `true`) and the other was migrated with `ng update`, which ran the
  `strict-templates-default` migration and wrote `strictTemplates: false` into the tsconfig to
  preserve the old behaviour.
- ★ *Why `!== false` rather than `?? true`?* → So that only an explicit boolean `false` opts out.
  `undefined`, `null` and any other value keep strictness on. The source comment says it directly:
  *"Explicit opt-out is required to disable strictness"*. It closes the "I set it to something
  falsy and expected it off" class of mistake.
- *Did the v22 changelog announce the default change as a breaking change?* → No. The only
  changelog traces are the `ng update` migration entry under v22.0.0's `### migrations` and a
  v22.1.0 language-service fix, `account for strictTemplates being enabled by default`. The
  `## Breaking Changes` section does not mention it.

---

## Chunk 07.06 — `12-what-stricttemplates-actually-switches-on.md`

The doc comment says `strictTemplates` *"implies all template strictness flags below (unless
individually disabled)"*. This chunk shows the implication as code, because the mapping is not
one-to-one and the surprises are in the exceptions.

### 07.6a The public option surface, verbatim

All from
[`public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts)
at `v22.1.5`, `interface TypeCheckingOptions`. **Each of these carries its own documented
default, and they are not all `false`.** Quoting the JSDoc for each:

| Option | Documented default (verbatim from JSDoc) | What it checks (verbatim) |
|---|---|---|
| `strictTemplates` | *"Defaults to `true`"* | *"If `true`, implies all template strictness flags below (unless individually disabled)."* |
| `typeCheckHostBindings` | (no JSDoc default; see §07.6d) | *"Whether type checking of host bindings is enabled."* |
| `strictInputTypes` | *"Defaults to `false`."* | *"Whether to check the type of a binding to a directive/component input against the type of the field on the directive/component."* |
| `strictInputAccessModifiers` | *"Defaults to `false`, even if \"strictTemplates\" and/or \"strictInputTypes\" is set."* | *"Whether to check if the input binding attempts to assign to a restricted field (readonly, private, or protected) on the directive/component."* |
| `strictNullInputTypes` | *"Defaults to `false`."* | *"Whether to use strict null types for input bindings for directives."* |
| `strictAttributeTypes` | *"Defaults to `false`."* | *"Whether to check text attributes that happen to be consumed by a directive or component."* |
| `strictSafeNavigationTypes` | *"Defaults to `false`."* | *"Whether to use a strict type for null-safe navigation operations."* |
| `strictDomLocalRefTypes` | *"Defaults to `false`."* | *"Whether to infer the type of local references."* |
| `strictOutputEventTypes` | *"Defaults to `false`."* | *"Whether to infer the type of the `$event` variable in event bindings for directive outputs or animation events."* |
| `strictDomEventTypes` | *"Defaults to `false`."* | *"Whether to infer the type of the `$event` variable in event bindings to DOM events."* |
| `strictContextGenerics` | *"Defaults to `false`."* | *"Whether to include the generic type of components when type-checking the template."* |
| `strictLiteralTypes` | *"Defaults to `false` unless `strictTemplates` is set."* | *"Whether object or array literals defined in templates use their inferred type, or are interpreted as `any`."* |

🔴 **Read the "default" column carefully — it is about the *option*, not the *behaviour*.** Every
individual flag defaults to `false` as an option value, and `strictTemplates` then supplies the
behaviour anyway. That is exactly what makes this confusing, and §07.6c is the resolution.

Three JSDoc paragraphs worth quoting in full because they contain the real detail:

**`strictInputAccessModifiers`** — the one flag `strictTemplates` genuinely does *not* imply:

> *"Defaults to `false`, even if "strictTemplates" and/or "strictInputTypes" is set. Note that if
> `strictInputTypes` is not set, or set to `false`, this flag has no effect."*
> *"Tracking issue for enabling this by default: https://github.com/angular/angular/issues/38400"*

angular.dev repeats it on [Template type checking](https://angular.dev/tools/cli/template-typecheck):

> *"This option is `false` by default, even with `strictTemplates` set to `true`."*

🔴 **And yet the CLI writes `"strictInputAccessModifiers": true` into a new workspace's
`tsconfig.json`** (§07.3b). That is the *only* reason a fresh v22 app has it on. Two apps that both
"use the defaults" differ here if one hand-wrote its tsconfig. Excellent gotcha material.

**`strictNullInputTypes`**, whose body explains a subtlety nothing else states:

> *"If this is `true`, applications that are compiled with TypeScript's `strictNullChecks` enabled
> will produce type errors for bindings which can evaluate to `undefined` or `null` where the
> inputs's type does not include `undefined` or `null` in its type. If set to `false`, all binding
> expressions are wrapped in a non-null assertion operator to effectively disable strict null
> checks."*

🔴 *"all binding expressions are wrapped in a non-null assertion operator"* — turning the flag off
does not merely skip a check, it **actively rewrites the generated type-check block** to add `!`.
That is a mechanism sentence, and it is the kind of thing this corpus exists to surface.

**`strictDomEventTypes`**, whose *implementation* comment (in `compiler.ts`, §07.6b) gives a
reason the JSDoc does not:

> ```ts
>         // Checking of DOM events currently has an adverse effect on developer experience,
>         // e.g. for `<input (blur)="update($event.target.value)">` enabling this check results in:
>         // - error TS2531: Object is possibly 'null'.
>         // - error TS2339: Property 'value' does not exist on type 'EventTarget'.
>         checkTypeOfDomEvents: strictTemplates,
> ```

🔴 **That comment names two exact TypeScript error codes and the template that produces them.**
`TS2531` and `TS2339` on `$event.target.value` is the single most-hit `strictTemplates` failure in
practice, and Angular's own source documents it. §07.7 builds the worked example on it.

### 07.6b The implication, as code

From
[`compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)'s
`getTypeCheckingConfig()`, the strict branch verbatim:

```ts
    let typeCheckingConfig: TypeCheckingConfig;
    if (strictTemplates) {
      typeCheckingConfig = {
        applyTemplateContextGuards: strictTemplates,
        checkQueries: false,
        checkTemplateBodies: true,
        alwaysCheckSchemaInTemplateBodies: true,
        checkTypeOfInputBindings: strictTemplates,
        honorAccessModifiersForInputBindings: false,
        checkControlFlowBodies: true,
        strictNullInputBindings: strictTemplates,
        checkTypeOfAttributes: strictTemplates,
        // Even in full template type-checking mode, DOM binding checks are not quite ready yet.
        checkTypeOfDomBindings: false,
        checkTypeOfOutputEvents: strictTemplates,
        checkTypeOfAnimationEvents: strictTemplates,
        // Checking of DOM events currently has an adverse effect on developer experience,
        // e.g. for `<input (blur)="update($event.target.value)">` enabling this check results in:
        // - error TS2531: Object is possibly 'null'.
        // - error TS2339: Property 'value' does not exist on type 'EventTarget'.
        checkTypeOfDomEvents: strictTemplates,
        checkTypeOfDomReferences: strictTemplates,
        // Non-DOM references have the correct type in View Engine so there is no strictness flag.
        checkTypeOfNonDomReferences: true,
        // Pipes are checked in View Engine so there is no strictness flag.
        checkTypeOfPipes: true,
        strictSafeNavigationTypes: strictTemplates,
        useContextGenericType: strictTemplates,
        strictLiteralTypes: true,
        enableTemplateTypeChecker: this.enableTemplateTypeChecker,
        useInlineTypeConstructors,
        controlFlowPreventingContentProjection:
          this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
        unusedStandaloneImports:
          this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
        allowSignalsInTwoWayBindings,
        allowDomEventAssertion,
      };
    } else {
```

and the non-strict branch, for contrast:

```ts
      typeCheckingConfig = {
        applyTemplateContextGuards: false,
        checkQueries: false,
        checkTemplateBodies: false,
        checkControlFlowBodies: false,
        // Enable deep schema checking in "basic" template type-checking mode only if Closure
        // compilation is requested, which is a good proxy for "only in google3".
        alwaysCheckSchemaInTemplateBodies: this.closureCompilerEnabled,
        checkTypeOfInputBindings: false,
        strictNullInputBindings: false,
        honorAccessModifiersForInputBindings: false,
        checkTypeOfAttributes: false,
        checkTypeOfDomBindings: false,
        checkTypeOfOutputEvents: false,
        checkTypeOfAnimationEvents: false,
        checkTypeOfDomEvents: false,
        checkTypeOfDomReferences: false,
        checkTypeOfNonDomReferences: false,
        checkTypeOfPipes: false,
        strictSafeNavigationTypes: false,
        useContextGenericType: false,
        strictLiteralTypes: false,
        enableTemplateTypeChecker: this.enableTemplateTypeChecker,
        useInlineTypeConstructors,
        controlFlowPreventingContentProjection:
          this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
        unusedStandaloneImports:
          this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
        allowSignalsInTwoWayBindings,
        allowDomEventAssertion,
      };
```

🔴 **The five entries that are NOT `strictTemplates` in the strict branch are the whole lesson:**

| Entry | Strict branch value | Why it is not `strictTemplates` |
|---|---|---|
| `honorAccessModifiersForInputBindings` | **`false`** | the `strictInputAccessModifiers` carve-out — §07.6a, with the tracking issue #38400 |
| `checkTypeOfDomBindings` | **`false`** | source comment: *"Even in full template type-checking mode, DOM binding checks are not quite ready yet."* |
| `checkTypeOfNonDomReferences` | **`true`** (hard-coded) | *"Non-DOM references have the correct type in View Engine so there is no strictness flag."* |
| `checkTypeOfPipes` | **`true`** (hard-coded) | *"Pipes are checked in View Engine so there is no strictness flag."* |
| `strictLiteralTypes` | **`true`** (hard-coded) | matches the JSDoc's *"Defaults to `false` unless `strictTemplates` is set."* |

Plus `checkQueries: false` in **both** branches — a check that exists in the type and is never
switched on by either mode. ⚠️ I did not find what enables it. Do not speculate; UNSETTLED #8.

And note `alwaysCheckSchemaInTemplateBodies`: `true` under strict, but under non-strict it is
`this.closureCompilerEnabled`, with the comment *"Enable deep schema checking in "basic" template
type-checking mode only if Closure compilation is requested, which is a good proxy for "only in
google3.""*

### 07.6c 🔴 The override layer — every flag beats `strictTemplates`

Immediately after the branch, verbatim, with its own comment:

```ts
    // Apply explicitly configured strictness flags on top of the default configuration
    // based on "strictTemplates".
    if (this.options.strictInputTypes !== undefined) {
      typeCheckingConfig.checkTypeOfInputBindings = this.options.strictInputTypes;
      typeCheckingConfig.applyTemplateContextGuards = this.options.strictInputTypes;
    }
    if (this.options.strictInputAccessModifiers !== undefined) {
      typeCheckingConfig.honorAccessModifiersForInputBindings =
        this.options.strictInputAccessModifiers;
    }
    if (this.options.strictNullInputTypes !== undefined) {
      typeCheckingConfig.strictNullInputBindings = this.options.strictNullInputTypes;
    }
    if (this.options.strictOutputEventTypes !== undefined) {
      typeCheckingConfig.checkTypeOfOutputEvents = this.options.strictOutputEventTypes;
      typeCheckingConfig.checkTypeOfAnimationEvents = this.options.strictOutputEventTypes;
    }
    if (this.options.strictDomEventTypes !== undefined) {
      typeCheckingConfig.checkTypeOfDomEvents = this.options.strictDomEventTypes;
    }
    if (this.options.strictSafeNavigationTypes !== undefined) {
      typeCheckingConfig.strictSafeNavigationTypes = this.options.strictSafeNavigationTypes;
    }
    if (this.options.strictDomLocalRefTypes !== undefined) {
      typeCheckingConfig.checkTypeOfDomReferences = this.options.strictDomLocalRefTypes;
    }
    if (this.options.strictAttributeTypes !== undefined) {
      typeCheckingConfig.checkTypeOfAttributes = this.options.strictAttributeTypes;
    }
    if (this.options.strictContextGenerics !== undefined) {
      typeCheckingConfig.useContextGenericType = this.options.strictContextGenerics;
    }
    if (this.options.strictLiteralTypes !== undefined) {
      typeCheckingConfig.strictLiteralTypes = this.options.strictLiteralTypes;
    }
```

Four facts a chunk must take from this block:

1. **The guard is `!== undefined`, uniformly.** So the *presence of the key* is what matters, and
   `false` is a real, honoured value. This is the mechanism behind angular.dev's advice —
   *"Disable certain type-checking operations individually, while maintaining strictness in other
   aspects, by setting a strictness flag to `false`"* — and it is why granular opt-out is the right
   response to a wall of errors, not `strictTemplates: false`.
2. **Two flags each drive two config entries.** `strictInputTypes` sets *both*
   `checkTypeOfInputBindings` **and** `applyTemplateContextGuards`; `strictOutputEventTypes` sets
   *both* `checkTypeOfOutputEvents` **and** `checkTypeOfAnimationEvents`. Turning off "input type
   checking" also turns off template context guards — a much larger blast radius than the name
   suggests. 🔴 This is genuinely non-obvious and belongs in the gotchas.
3. **The names do not match.** The option is `strictDomLocalRefTypes`; the config entry is
   `checkTypeOfDomReferences`. `strictContextGenerics` → `useContextGenericType`.
   `strictNullInputTypes` → `strictNullInputBindings`. A page must give both names or the reader
   cannot connect a source comment to a tsconfig key. Build the mapping table.
4. **`strictInputAccessModifiers` is in this list**, so setting it to `true` in the tsconfig is
   exactly how the CLI's generated workspace overrides the hard-coded `false` in §07.6b. The two
   halves finally meet.

### 07.6d `typeCheckHostBindings` — defaulted elsewhere, and `true`

`typeCheckHostBindings` is declared in `TypeCheckingOptions` with the bare JSDoc
*"Whether type checking of host bindings is enabled."* and **no documented default**. The default
lives in the implementation instead, in `compiler.ts`:

```ts
    const typeCheckHostBindings = this.options.typeCheckHostBindings ?? true;
```

🔴 Note `?? true` here, versus `!== false` for `strictTemplates` (§07.5b). **Two different
default-resolution idioms in the same file**, with different behaviour for `null`. Under `??`, a
`null` value falls through to `true`; under `!== false`, `null` also yields `true` — they agree on
`null` but disagree on nothing an application can express in JSON. Worth one sentence for accuracy,
not a section.

angular.dev confirms the value on
[Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options):

> *"When `true`, enables type checking of expressions in the `host` object literal and
> `@HostBinding`/`@HostListener` decorators of components and directives. Default is `true`."*

The variable is threaded into three call sites in `compiler.ts` (alongside
`!!this.options.strictStandalone`), so host-binding checking is independent of `strictTemplates` —
**it is on even with `strictTemplates: false`.** That is a real and useful distinction: an upgraded
project with the migration's opt-out still gets host-binding type checking.

### 07.6e Gotchas to write

1. **Symptom: you set `strictInputTypes: false` to silence input errors, and unrelated
   structural-directive context errors disappear too.** Cause: that one option sets **two** config
   entries — `checkTypeOfInputBindings` *and* `applyTemplateContextGuards` (§07.6c #2). Fix: if you
   only meant input assignability, there is no narrower flag; prefer fixing the types or using
   `$any()` at the call site (§07.7d).
2. **Symptom: `private` / `readonly` inputs are assignable from a template even with
   `strictTemplates: true`.** Cause: `honorAccessModifiersForInputBindings` is hard-coded `false`
   in the strict branch; the JSDoc says *"Defaults to `false`, even if "strictTemplates" and/or
   "strictInputTypes" is set."* Fix, in code:
   ```json
   "angularCompilerOptions": {
     "strictInputAccessModifiers": true
   }
   ```
   (A CLI-generated workspace already has this line — see §07.3b. A hand-written tsconfig will not.)
3. **Symptom: `strictInputAccessModifiers: true` has no effect.** Cause: its JSDoc —
   *"Note that if `strictInputTypes` is not set, or set to `false`, this flag has no effect."*
   Someone disabled `strictInputTypes`. Fix: remove that override.
4. **Symptom: DOM property bindings are not type-checked even under `strictTemplates`.** Cause:
   `checkTypeOfDomBindings: false`, hard-coded in **both** branches, with the source comment
   *"Even in full template type-checking mode, DOM binding checks are not quite ready yet."* Fix:
   there is none — it is not configurable. Say so plainly rather than inventing a flag.
5. **Symptom: pipe return types are checked even with `strictTemplates: false`.** Cause:
   `checkTypeOfPipes: true` is hard-coded in **both** branches —
   *"Pipes are checked in View Engine so there is no strictness flag."* Same for
   `checkTypeOfNonDomReferences`. Not everything is under the switch.
6. **Symptom: host bindings are type-checked in a project that opted out of `strictTemplates`.**
   Cause: `typeCheckHostBindings` is a separate option defaulting to `true` (§07.6d). Fix, if you
   really want it off:
   ```json
   "angularCompilerOptions": {
     "typeCheckHostBindings": false
   }
   ```

### 07.6f Interview questions

- ★ *`strictTemplates` "implies all template strictness flags". Name one it does not imply, and
  why.* → `strictInputAccessModifiers`. In the strict branch `honorAccessModifiersForInputBindings`
  is hard-coded `false`, and the JSDoc says so explicitly, pointing at tracking issue #38400 for
  enabling it by default. The CLI compensates by writing `"strictInputAccessModifiers": true` into
  every generated workspace — so the *framework* default and the *CLI* default differ.
- ★ *You have 400 template errors after enabling `strictTemplates`. What is the right response?* →
  Not `strictTemplates: false`. Every individual flag is applied **on top of** the
  `strictTemplates` baseline with an `!== undefined` guard, so you can keep the baseline and
  disable the specific check that is generating the noise — most often `strictDomEventTypes`,
  which the source itself flags as having *"an adverse effect on developer experience"* for
  `$event.target.value`.
- ★ *What does turning `strictNullInputTypes` off actually do?* → More than skip a check. Its
  JSDoc: *"If set to `false`, all binding expressions are wrapped in a non-null assertion operator
  to effectively disable strict null checks."* The compiler rewrites the generated type-check block
  to add `!`.
- *Is `typeCheckHostBindings` governed by `strictTemplates`?* → No. It is resolved separately as
  `this.options.typeCheckHostBindings ?? true`, so host bindings are type-checked even in a project
  that set `strictTemplates: false`.
- *Which checks are on regardless of the mode?* → `checkTypeOfPipes` and
  `checkTypeOfNonDomReferences` are hard-coded `true` in both branches, because (per the source
  comments) both were already checked in View Engine and so never got a strictness flag. And
  `checkTypeOfDomBindings` is hard-coded `false` in both.

---

## Chunk 07.07 — `13-what-stricttemplates-rejects.md`

🔴 **This chunk earns its place from the failures, shown.** The authoring contract's Rule 3
requires the fix in code, and Rule 4 forbids invented output — so quote error *codes and strings*
from the sources below, as backticked inline phrases, and never build a console block.

### 07.7a The canonical nullable-input rejection, from angular.dev

[Template type checking](https://angular.dev/tools/cli/template-typecheck) supplies this example.
The code is quotable verbatim:

```ts
export interface User {
  name: string;
}

@Component({
  selector: 'user-detail',
  template: '{{ user.name }}',
})
export class UserDetailComponent {
  user = input.required<User>();
}

@Component({
  selector: 'app-root',
  template: '<user-detail [user]="selectedUser"></user-detail>',
})
export class AppComponent {
  selectedUser: User | null = null;
}
```

The binding `[user]="selectedUser"` is rejected because `selectedUser` is `User | null` and the
input's type is `User`. Under `strictTemplates: false` this compiled, because
`strictNullInputBindings` was `false` and — per its JSDoc — *"all binding expressions are wrapped
in a non-null assertion operator"*.

The documented fixes, verbatim from the same page:

> *"the non-null assertion operator `!` at the end of a nullable expression, such as
> `<user-detail [user]="user!"></user-detail>`"*

and for the async-pipe case:

> *"`<user-detail [user]="(user$ | async)!"></user-detail>`"*

🔴 **Prefer showing the *honest* fix first and the assertion second.** Widening the input to
`User | null` and handling it, or `@if (selectedUser) { … }`, is the fix; `!` is the escape hatch.
A reference handbook that leads with `!` teaches people to silence the checker.

### 07.7b The `$event.target.value` rejection — with two exact TypeScript codes

This is the highest-frequency `strictTemplates` failure and Angular's own source documents it.
From `compiler.ts` (§07.6b), verbatim:

```ts
        // Checking of DOM events currently has an adverse effect on developer experience,
        // e.g. for `<input (blur)="update($event.target.value)">` enabling this check results in:
        // - error TS2531: Object is possibly 'null'.
        // - error TS2339: Property 'value' does not exist on type 'EventTarget'.
        checkTypeOfDomEvents: strictTemplates,
```

So for the template `<input (blur)="update($event.target.value)">` the reader gets **`TS2531`** and
**`TS2339`**, and the cause is that `Event.target` is typed `EventTarget | null` and `EventTarget`
has no `value`. Both codes are TypeScript's, not Angular's — say so, because the reader will
otherwise search angular.dev for them and find nothing.

Fixes, in ascending order of honesty, all shown in code:

```ts
// 1. The escape hatch angular.dev documents — opts the expression out of checking entirely.
//    Template: <input (blur)="update($any($event.target).value)">

// 2. Narrow it in the component, which is the fix that keeps the type system working.
update(event: Event): void {
  const input = event.target as HTMLInputElement;
  this.value.set(input.value);
}
// Template: <input (blur)="update($event)">

// 3. Turn the single check off, keeping the rest of strictTemplates (§07.6c).
```

```json
"angularCompilerOptions": {
  "strictDomEventTypes": false
}
```

🔴 **Option 3 is legitimate here in a way it usually is not**, because Angular's own source comment
concedes the check has *"an adverse effect on developer experience"*. Quote the comment when
recommending it — that is what makes it a sourced recommendation rather than an opinion.

### 07.7c The other rejection classes, each traced to its flag

Build one section per row, each with a template that fails, the flag that causes it, and the fix.
**Every "what it checks" string below is verbatim JSDoc from §07.6a** — do not paraphrase them.

| Flag (config entry) | Rejects | Sourced description |
|---|---|---|
| `strictInputTypes` (`checkTypeOfInputBindings`) | assigning an expression of the wrong type to an input | *"if this is `false` then the expression `[input]="expr"` will have `expr` type-checked, but not the assignment of the resulting type to the `input` property"* |
| `strictNullInputTypes` (`strictNullInputBindings`) | a nullable expression bound to a non-nullable input | §07.7a |
| `strictAttributeTypes` (`checkTypeOfAttributes`) | a text attribute consumed as a typed input | *"in a template containing `<input matInput disabled>` the `disabled` attribute ends up being consumed as an input with type `boolean` by the `matInput` directive. At runtime, the input will be set to the attribute's string value, which is an empty string for attributes without a value, so with this flag set to `true`, an error would be reported."* |
| `strictSafeNavigationTypes` | treating `a?.b` as `any` | *"If this is `false`, then the return type of `a?.b` or `a?()` will be `any`. If set to `true`, then the return type of `a?.b` for example will be the same as the type of the ternary expression `a != null ? a.b : a`."* |
| `strictDomLocalRefTypes` (`checkTypeOfDomReferences`) | a `#ref` on a DOM node typed `any` | *"the type of a `#ref` variable on a DOM node in the template will be determined by the type of `document.createElement` for the given DOM node. If set to `false`, the type of `ref` for DOM nodes will be `any`."* |
| `strictOutputEventTypes` | `$event` typed `any` on an `@Output()` | *"the type of `$event` will be inferred based on the generic type of `EventEmitter`/`Subject` of the output."* |
| `strictContextGenerics` (`useContextGenericType`) | a generic component's parameters collapsed to `any` | *"If a component has generic type parameters and this setting is `true`, those generic parameters will be included in the context type for the template. If `false`, any generic parameters will be set to `any`."* |
| `strictLiteralTypes` | an inline `{}` / `[]` in a template treated as `any` | *"Whether object or array literals defined in templates use their inferred type, or are interpreted as `any`."* |

🔴 **The `<input matInput disabled>` case is the best one in the table** and deserves the longest
treatment: it is a *correct* rejection of code that genuinely misbehaves at runtime (the attribute
delivers `""`, not `true`), which makes it the best argument for the whole feature. The fix is
`[disabled]="true"`, shown in code.

### 07.7d The escape hatches, ranked, all sourced

angular.dev, [Template type checking](https://angular.dev/tools/cli/template-typecheck), verbatim:

1. > *"Use the `$any()` type-cast function in certain contexts to opt out of type-checking for a
   > part of the expression"* — and *"Disable checking of a binding expression by surrounding the
   > expression in a call to the `$any()` cast pseudo-function. The compiler treats it as a cast to
   > the `any` type just like in TypeScript."* Documented example: `{{$any(person).address.street}}`.
2. > *"Disable certain type-checking operations individually, while maintaining strictness in other
   > aspects, by setting a strictness flag to `false`"* — the §07.6c mechanism.
3. > *"Disable strict checks entirely by setting `strictTemplates: false` in the application's
   > TypeScript configuration file, `tsconfig.json`"*

🔴 **Present them in exactly this order — narrowest blast radius first** — and say so. `$any()`
affects one expression; a flag affects one check across the app; `strictTemplates: false` affects
every check listed in §07.6b. The page should state that ordering as a rule, because the ordering
*is* the advice.

⚠️ **Note that angular.dev names `tsconfig.json` as the file.** That is right for a CLI workspace
(the root holds all `angularCompilerOptions` — §07.3f) and the chunk should keep it, but it is
worth one line explaining *why* the root and not `tsconfig.app.json`: because the spec config
extends the root, not the app config (§07.3g #3).

### 07.7e The three modes, for the reader who arrives with older knowledge

angular.dev documents three modes, and the older two still appear in every pre-v22 article.
Verbatim:

- **Basic:** *"Angular validates only top-level expressions in a template."* and the limitation
  *"it doesn't check embedded views, such as `*ngIf`, `*ngFor`, other `<ng-template>` embedded
  view."*
- **Full:** *"Angular is more aggressive in its type-checking within templates."* —
  *"Embedded views (such as those within an `*ngIf` or `*ngFor`) are checked"*, *"Pipes have the
  correct return type"*, but *"The following still have type `any`: Local references to DOM
  elements; The `$event` object; Safe navigation expressions."*
  🔴 *"The `fullTemplateTypeCheck` flag has been deprecated in Angular 13."*
- **Strict:** *"Strict mode is a superset of full mode, and is accessed by setting the
  `strictTemplates` flag to true. This flag supersedes the `fullTemplateTypeCheck` flag."*

The compiler's own comment agrees, from `getTypeCheckingConfig()`:

> ```ts
>     // Determine the strictness level of type checking based on compiler options. As
>     // `strictTemplates` is a superset of `fullTemplateTypeCheck`, the former implies the latter.
>     // Also see `verifyCompatibleTypeCheckOptions` where it is verified that `fullTemplateTypeCheck`
>     // is not disabled when `strictTemplates` is enabled.
> ```

⚠️ **That comment references a check that I could not find in the v22.1.5 source.**
`verifyCompatibleTypeCheckOptions` exists (§07.8b) but its body contains **no**
`fullTemplateTypeCheck` clause — only `extendedDiagnostics` ones. The error code
`CONFIG_STRICT_TEMPLATES_IMPLIES_FULL_TEMPLATE_TYPECHECK = 4002` still exists in the enum. So the
comment appears to describe behaviour that has been removed while the code stayed. UNSETTLED #7,
and it belongs in `## 100 · Found, not fixed`.

🔴 **Do not write a page that tells a v22 reader to set `fullTemplateTypeCheck`.** It is deprecated
since v13, `strictTemplates` supersedes it, and it is now the default anyway. Mention it once,
historically, so a reader who meets it in an old tsconfig knows what it was.

### 07.7f Gotchas to write

Beyond the fixes above, symptom-first:

1. **`TS2531: Object is possibly 'null'` on `$event.target`** — §07.7b. Fix in code, three ways.
2. **`TS2339: Property 'value' does not exist on type 'EventTarget'`** — same cause, same fixes.
   Two codes, one mistake; a reader searching either should land on the same section.
3. **Symptom: `<input matInput disabled>` now errors.** Cause: `checkTypeOfAttributes`. The
   attribute really does deliver `""`. Fix: `[disabled]="true"`.
4. **Symptom: `#ref` on a DOM element lost its `any` and now errors.** Cause:
   `checkTypeOfDomReferences` — the ref is now typed from `document.createElement`. Fix: use the
   real element type, or `$any(ref)`.
5. **Symptom: an `async` pipe result is rejected as possibly `null`.** Cause: `AsyncPipe` returns
   `T | null`. Fix: `@if` narrowing, or the documented `(user$ | async)!`.
6. **Symptom: an inline object literal in a template stops being `any`.** Cause:
   `strictLiteralTypes`, hard-coded `true` in the strict branch. Fix: type it, or hoist it into the
   component where it can be typed properly.
7. **Symptom: errors appear only in an `@if` / `@for` body.** Cause: you were previously in
   **basic** mode, which *"doesn't check embedded views"*. The bodies were never checked before.
   Not a regression — a first check.
8. **Symptom: `$any()` does not silence an error.** Cause: `$any()` casts an **expression**; it
   cannot fix an error about the *assignment target* (a `private` input, a missing required input).
   Fix depends on the actual flag — send the reader to §07.6c's mapping table.

### 07.7g Interview questions

- ★ *`<input (blur)="update($event.target.value)">` fails under `strictTemplates`. Why, and what
  are your three options?* → `Event.target` is `EventTarget | null` and `EventTarget` has no
  `value`, giving `TS2531` and `TS2339` — both TypeScript codes, not Angular ones. Options:
  `$any($event.target).value` (one expression), narrowing in the component with
  `event.target as HTMLInputElement` (the real fix), or `strictDomEventTypes: false` (one check,
  app-wide). Angular's own source comment concedes this check has *"an adverse effect on developer
  experience"*, which is unusually strong support for the third option.
- ★ *Why does `<input matInput disabled>` error under `strictTemplates`, and is the compiler right?*
  → Yes, it is right. The attribute is consumed as a `boolean` input but delivers the attribute's
  string value — an empty string for a valueless attribute. The template was always wrong; only now
  does anything say so. Fix: `[disabled]="true"`.
- ★ *A colleague fixes every strict-template error with `!`. What is wrong with that?* → `!` asserts
  a fact the type system has evidence against, at a point where the framework will happily render
  `null`. The documented escape hatches have an order — `$any()` for one expression, a strictness
  flag for one check, `strictTemplates: false` for all of them — and a blanket `!` is worse than
  any of them because it is invisible in the tsconfig and unreviewable at scale.
- *What is `fullTemplateTypeCheck` and should you set it?* → The pre-`strictTemplates` middle mode,
  *"deprecated in Angular 13"* and superseded. `strictTemplates` is *"a superset of full mode"* and
  is the v22 default. Never set it in new code; recognise it in old tsconfigs.

---

## Chunk 07.08 — `14-the-other-angular-compiler-options.md`

The four options a generated workspace actually contains, plus the configuration errors the
compiler raises about them. This is the chunk that closes the tsconfig surface.

### 07.8a The four in a generated workspace, each sourced

A default v22 workspace's `angularCompilerOptions` has exactly three keys (§07.3b). Here is each,
plus `strictStandalone` and `extendedDiagnostics` which are not generated but are frequently added.

**`enableI18nLegacyMessageIdFormat: false`** — the one key present in *both* schematic branches
(it sits outside the `<% if (strict) %>`). ⚠️ I did not read its implementation or find a doc
sentence for it. UNSETTLED #9. **Name it as "generated, i18n-related, and not this topic's
business" and point at an i18n phase; do not invent a description.**

**`strictInjectionParameters: true`** — written only in the strict branch. Its JSDoc, verbatim
from `public_options.ts` (note it lives in `LegacyNgcOptions`, not `TypeCheckingOptions`):

> *"Always report errors a parameter is supplied whose injection type cannot be determined. When
> this value option is not provided or is `false`, constructor parameters of classes marked with
> `@Injectable` whose type cannot be resolved will produce a warning. With this option `true`, they
> produce an error. When this option is not provided is treated as if it were `false`."*

angular.dev agrees and adds a recommendation:

> *"When `true`, reports an error for a supplied parameter whose injection type cannot be
> determined."* Default is `false`, but *"the recommended value is `true`."*

🔴 **So the framework default is `false` and the CLI writes `true`.** Same shape as
`strictInputAccessModifiers` (§07.6a). Both are cases where *the CLI is stricter than the
framework*, and a chunk should name that as a pattern: **"generated by `ng new`" and "Angular's
default" are not the same thing, and this file contains two examples.** The DI mechanism behind
"injection type cannot be determined" is **Phase 6 — Dependency injection** *(not written yet)* —
one line, then stop.

**`strictInputAccessModifiers: true`** — covered in §07.6a. Written only in the strict branch,
hard-coded `false` in the compiler's strict branch, honoured through the §07.6c override layer.

**`strictStandalone`** — not generated. From `public_options.ts`, `interface DiagnosticOptions`:

> ```ts
>   /**
>    * If enabled, non-standalone declarations are prohibited and result in build errors.
>    */
>   strictStandalone?: boolean;
> ```

angular.dev: *"When `true`, reports an error if a component, directive, or pipe is not standalone."*
Read in `compiler.ts` as `!!this.options.strictStandalone` (three call sites), so it is
**`false` unless explicitly set**. Relevant to **topic 02 · Standalone by default** (written, and
linkable at `../02-standalone-by-default/README.md`) — one line and a link, not a re-explanation.

**`typeCheckHostBindings`** — §07.6d. Default `true`.

**`disableTypeScriptVersionCheck`** — §07.1d.

### 07.8b `extendedDiagnostics`, and the three configuration errors

From `public_options.ts`, `interface DiagnosticOptions`, verbatim:

```ts
export interface DiagnosticOptions {
  /** Options which control how diagnostics are emitted from the compiler. */
  extendedDiagnostics?: {
    /**
     * The category to use for configurable diagnostics which are not overridden by `checks`. Uses
     * `warning` by default.
     */
    defaultCategory?: DiagnosticCategoryLabel;

    /**
     * A map of each extended template diagnostic's name to its category. This can be expanded in
     * the future with more information for each check or for additional diagnostics not part of the
     * extended template diagnostics system.
     */
    checks?: {[Name in ExtendedTemplateDiagnosticName]?: DiagnosticCategoryLabel};
  };
```

and the category enum, verbatim, with its per-member JSDoc:

```ts
export enum DiagnosticCategoryLabel {
  /** Treat the diagnostic as a warning, don't fail the compilation. */
  Warning = 'warning',

  /** Treat the diagnostic as a hard error, fail the compilation. */
  Error = 'error',

  /** Ignore the diagnostic altogether. */
  Suppress = 'suppress',
}
```

Three values — `'warning'`, `'error'`, `'suppress'` — and the default is `warning`. Note that
`compiler.ts` reads `defaultCategory` with `||`, not `??`:

```ts
        controlFlowPreventingContentProjection:
          this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
        unusedStandaloneImports:
          this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
```

⚠️ `||` rather than `??` means an empty string would also fall through to `Warning`. Since the
enum has no empty member this is not reachable through valid config, but if a page quotes the line
it should quote it accurately.

🔴 **The three compatibility errors, verbatim.** From `verifyCompatibleTypeCheckOptions` in
`compiler.ts`, which is a generator yielding `ts.Diagnostic`s:

```ts
function* verifyCompatibleTypeCheckOptions(
  options: NgCompilerOptions,
): Generator<ts.Diagnostic, void, void> {
  if (options.extendedDiagnostics && options.strictTemplates === false) {
    yield makeConfigDiagnostic({
      category: ts.DiagnosticCategory.Error,
      code: ErrorCode.CONFIG_EXTENDED_DIAGNOSTICS_IMPLIES_STRICT_TEMPLATES,
      messageText: `
Angular compiler option "extendedDiagnostics" is configured, however "strictTemplates" is disabled.

Using "extendedDiagnostics" requires that "strictTemplates" is also enabled.

One of the following actions is required:
1. Remove "strictTemplates: false" to enable it.
2. Remove "extendedDiagnostics" configuration to disable them.
      `.trim(),
    });
  }

  const allowedCategoryLabels = Array.from(Object.values(DiagnosticCategoryLabel)) as string[];
  const defaultCategory = options.extendedDiagnostics?.defaultCategory;
  if (defaultCategory && !allowedCategoryLabels.includes(defaultCategory)) {
    yield makeConfigDiagnostic({
      category: ts.DiagnosticCategory.Error,
      code: ErrorCode.CONFIG_EXTENDED_DIAGNOSTICS_UNKNOWN_CATEGORY_LABEL,
      messageText: `
Angular compiler option "extendedDiagnostics.defaultCategory" has an unknown diagnostic category: "${defaultCategory}".

Allowed diagnostic categories are:
${allowedCategoryLabels.join('\n')}
      `.trim(),
    });
  }

  for (const [checkName, category] of Object.entries(options.extendedDiagnostics?.checks ?? {})) {
    if (!SUPPORTED_DIAGNOSTIC_NAMES.has(checkName)) {
      yield makeConfigDiagnostic({
        category: ts.DiagnosticCategory.Error,
        code: ErrorCode.CONFIG_EXTENDED_DIAGNOSTICS_UNKNOWN_CHECK,
        messageText: `
Angular compiler option "extendedDiagnostics.checks" has an unknown check: "${checkName}".

Allowed check names are:
${Array.from(SUPPORTED_DIAGNOSTIC_NAMES).join('\n')}
        `.trim(),
      });
    }

    if (!allowedCategoryLabels.includes(category)) {
      yield makeConfigDiagnostic({
        category: ts.DiagnosticCategory.Error,
        code: ErrorCode.CONFIG_EXTENDED_DIAGNOSTICS_UNKNOWN_CATEGORY_LABEL,
        messageText: `
Angular compiler option "extendedDiagnostics.checks['${checkName}']" has an unknown diagnostic category: "${category}".

Allowed diagnostic categories are:
${allowedCategoryLabels.join('\n')}
        `.trim(),
      });
    }
  }
}
```

🔴 **The first message is the one to build a gotcha on**, and it is unusually good documentation:
it states the constraint, the reason, and **both** fixes, numbered. Quote it whole.

Note that the first check tests `options.strictTemplates === false` — the *explicit* opt-out only.
So `extendedDiagnostics` with `strictTemplates` **absent** (the default, `true`) is fine; the error
fires only when someone wrote `false`. That matches §07.5b's `!== false` semantics exactly and is
worth one sentence connecting the two.

### 07.8c The `NG` codes these become

From
[`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts)
at `v22.1.5`, verbatim:

```ts
  CONFIG_FLAT_MODULE_NO_INDEX = 4001,
  CONFIG_STRICT_TEMPLATES_IMPLIES_FULL_TEMPLATE_TYPECHECK = 4002,
  CONFIG_EXTENDED_DIAGNOSTICS_IMPLIES_STRICT_TEMPLATES = 4003,
  CONFIG_EXTENDED_DIAGNOSTICS_UNKNOWN_CATEGORY_LABEL = 4004,
  CONFIG_EXTENDED_DIAGNOSTICS_UNKNOWN_CHECK = 4005,
  CONFIG_EMIT_DECLARATION_ONLY_UNSUPPORTED = 4006,
```

🔴 **The `4000` block is the configuration-error range**, and all six are `CONFIG_*`. That is a
tidy, memorable fact: *a diagnostic in the 4000s is about your tsconfig, not your code.* Compare
with the ranges topic 03's bank already established for other packages (core `100-999`,
platform-browser `5000-5500`, http `2800-2899`) — **this corpus can now name a fourth**, and a
chunk saying so is doing genuine synthesis.

⚠️ **How these render is not something I verified.** `makeConfigDiagnostic` sets
`code: ngErrorCode(code)`, and I did not read `ngErrorCode`. Topic 03's bank §0.7 established the
core rule (negative codes get a guide page and a `Find more at …` suffix; positive ones do not) but
that rule was derived for `core`'s runtime errors, **not** for `compiler-cli`'s `ts.Diagnostic`s,
which travel through TypeScript's diagnostic pipeline instead. **Do not assert `NG4003` as the
displayed string.** UNSETTLED #10. Say "error code `CONFIG_EXTENDED_DIAGNOSTICS_IMPLIES_STRICT_TEMPLATES`
(4003)" and quote the `messageText`, which *is* verified.

Also worth one line: `CONFIG_EMIT_DECLARATION_ONLY_UNSUPPORTED = 4006` has a matching check with a
one-line message, verbatim from `compiler.ts`:

```ts
      messageText: 'TS compiler option "emitDeclarationOnly" is not supported.',
```

guarded by `if (!options.emitDeclarationOnly || !!options._experimentalAllowEmitDeclarationOnly)`.
A tsconfig setting that Angular flatly rejects is a good, short gotcha.

### 07.8d Gotchas to write

1. **Symptom: `Angular compiler option "extendedDiagnostics" is configured, however
   "strictTemplates" is disabled.`** Cause: exactly what it says. Fix — the message names both, so
   show both:
   ```json
   "angularCompilerOptions": {
     "extendedDiagnostics": { "defaultCategory": "error" }
   }
   ```
   (delete `"strictTemplates": false`), **or** delete the `extendedDiagnostics` block.
2. **Symptom: `... has an unknown check: "..."`, listing the allowed names.** Cause: a typo, or a
   check name from a newer/older Angular. Fix: copy a name from the printed list — the message
   emits `SUPPORTED_DIAGNOSTIC_NAMES` in full, so the answer is in the error.
3. **Symptom: `... has an unknown diagnostic category: "..."`.** Cause: anything other than
   `warning`, `error`, `suppress`. Fix: use one of the three.
4. **Symptom: after `ng update` to v22, `nullishCoalescingNotNullable` and
   `optionalChainNotNullable` fire everywhere.** Cause: the v22.0.0 breaking change quoted in
   §07.5d, which explicitly advises *"You might want to disable those 2 diagnotiscs in your
   `tsconfig` temporarily."* — and there is a migration that does it for you. Fix, in code:
   ```json
   "angularCompilerOptions": {
     "extendedDiagnostics": {
       "checks": {
         "nullishCoalescingNotNullable": "suppress",
         "optionalChainNotNullable": "suppress"
       }
     }
   }
   ```
   🔴 But see §07.4e #1 — putting a `checks` block in a *leaf* config discards the root's
   `defaultCategory`.
5. **Symptom: `TS compiler option "emitDeclarationOnly" is not supported.`** Cause: `emitDeclarationOnly`
   in `compilerOptions`. Fix: remove it.
6. **Symptom: `strictInjectionParameters` produces a warning, not an error.** Cause: the option is
   absent or `false` — its JSDoc says an unresolvable `@Injectable` parameter *"will produce a
   warning"* by default and an error only *"With this option `true`"*. A generated workspace sets
   it; a hand-written tsconfig does not.

### 07.8e Interview questions

- ★ *Can you use `extendedDiagnostics` with `strictTemplates: false`?* → No. The compiler yields a
  configuration error whose message names both fixes: *"1. Remove "strictTemplates: false" to
  enable it. 2. Remove "extendedDiagnostics" configuration to disable them."* Note the check is
  `strictTemplates === false` specifically, so omitting the key (the v22 default, `true`) is fine.
- ★ *What are the three values an extended diagnostic can take?* → `'warning'` (*"don't fail the
  compilation"*), `'error'` (*"fail the compilation"*) and `'suppress'` (*"Ignore the diagnostic
  altogether"*). `defaultCategory` is `warning`.
- ★ *A generated workspace sets `strictInjectionParameters: true` but Angular's own default is
  `false`. Why does that matter?* → Because "the default" is ambiguous in this ecosystem. There are
  framework defaults and CLI defaults, and this file contains two options where they differ
  (`strictInjectionParameters`, `strictInputAccessModifiers`). A hand-written tsconfig, or one
  inherited from a non-CLI setup, is measurably less strict than a generated one even though both
  "use defaults".
- *What does a diagnostic in the 4000s tell you?* → It is a `CONFIG_*` code — your tsconfig is
  wrong, not your code.

---

## Chunk 07.09 — `15-typescript-6-defaults-and-the-generated-compileroptions.md`

The last piece of the puzzle: why the generated `compilerOptions` looks so short, and which of the
settings in it are Angular requirements versus TypeScript-6 accommodations.

### 07.9a TypeScript 6.0's default changes, verbatim

From the [TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html),
"Simple Default Changes", verbatim:

> **`strict` is now `true` by default**: *"The appetite for stricter typing continues to grow, and
> we've found that most new projects want `strict` mode enabled. If you were already using
> `"strict": true`, nothing changes for you. If you were relying on the previous default of
> `false`, you'll need to explicitly set `"strict": false` in your `tsconfig.json`."*

> **`module` defaults to `esnext`**: *"Similarly, the new default `module` is `esnext`,
> acknowledging that ESM is now the dominant module format."*

> **`target` defaults to current-year ES version**: *"The new default `target` is the most recent
> supported ECMAScript spec version (effectively a floating target). Right now, that target is
> `es2025`. This reflects the reality that most developers are shipping to evergreen runtimes and
> don't need to compile down to older ECMAScript versions."*

> **`noUncheckedSideEffectImports` is now `true` by default**: *"This helps catch issues with typos
> in side-effect-only imports."*

> **`libReplacement` is now `false` by default**: *"This flag previously incurred a large number of
> failed module resolutions for every run, which in turn increased the number of locations we
> needed to watch under `--watch` and editor scenarios. In a new project, `libReplacement` never
> does anything until other explicit configuration takes place, so it makes sense to turn this off
> by default for the sake of better performance by default."*

> *"If these new defaults break your project, you can specify the previous values explicitly in
> your `tsconfig.json`."*

🔴 **The first one closes the loop opened in §07.3b.** The CLI's strict branch writes no
`"strict": true` because TypeScript 6 supplies it. Angular's `~6.0.2` pin (§07.1b) guarantees that
a generated workspace is always on a TypeScript where that default holds. The two decisions are
coupled, and neither file mentions the other.

### 07.9b The generated `compilerOptions`, line by line

From §07.3b, the ten keys a default workspace gets, each with what it is for. **Mark clearly which
are Angular requirements and which are workspace choices** — the reader's question is always "can I
change this?"

| Key | Value | Why it is there |
|---|---|---|
| `"skipLibCheck": true` | | skip type-checking `.d.ts` files — a build-time choice, safely changed |
| `"isolatedModules": true` | | ⚠️ near-mandatory: the Angular build transpiles file-by-file with esbuild, so constructs needing whole-program knowledge are unsafe. **Topic 05 owns the build** — one line. |
| `"experimentalDecorators": true` | | 🔴 Angular's decorators are the **legacy** TypeScript decorators, not the ES/TC39 stage-3 ones. Turning this off breaks every `@Component`. |
| `"importHelpers": true` | | emit helpers as imports from `tslib` rather than inlining them per file — which is why `tslib` is a **runtime `dependency`** in the generated `package.json` (§08.2) |
| `"target": "ES2022"` | | 🔴 **explicitly pinned, overriding TypeScript 6's floating `es2025` default.** Angular fixes the target rather than letting it drift with the compiler version. |
| `"module": "preserve"` | | 🔴 **explicitly pinned, overriding TypeScript 6's `esnext` default.** |
| `"compileOnSave": false` | | (top-level, not in `compilerOptions`) an editor hint |
| `"noImplicitOverride": true` | strict branch only | not part of `strict` |
| `"noPropertyAccessFromIndexSignature": true` | strict branch only | not part of `strict` |
| `"noImplicitReturns": true` | strict branch only | not part of `strict` |
| `"noFallthroughCasesInSwitch": true` | strict branch only | not part of `strict` |

🔴 **Two findings here are worth their own sections:**

1. **`target` and `module` are pinned *against* TypeScript 6's new floating defaults.** TypeScript
   made `target` *"effectively a floating target"*; Angular's template writes `"ES2022"` anyway. A
   floating target would mean the same source emitting different output on a patch upgrade of
   TypeScript — unacceptable for a framework that ships build artefacts. Say it that way; the
   release notes and the template together make the argument, though **neither states this
   rationale explicitly** — mark it as a reading (UNSETTLED #11).
2. **The four flags in the strict branch are exactly the useful ones `strict` does *not* include.**
   `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns` and
   `noFallthroughCasesInSwitch` are all outside TypeScript's "strict mode family". So the CLI's
   `--strict` is genuinely *"`strict` plus four"*, and after TypeScript 6 the "plus four" is the
   only part it still has to write down. That is a satisfying, checkable statement.

⚠️ **I did not verify from TypeScript's own documentation that those four are outside the `strict`
family.** The `tsconfig/strict` reference page I fetched did not enumerate the family. The
inference is strong (the CLI would not write redundant keys) but it is an inference. UNSETTLED #12.

### 07.9c Gotchas to write

1. **Symptom: a decorator error after someone "modernised" the tsconfig by removing
   `experimentalDecorators`.** Cause: Angular uses legacy TypeScript decorators. Fix: restore it.
2. **Symptom: `import { x } from './y'` where `y` only has a type — a runtime error about a missing
   export.** Cause: `isolatedModules: true` requires `import type` for type-only imports because
   each file is transpiled alone. Fix, in code:
   ```ts
   import type { User } from './user';
   ```
3. **Symptom: `tslib` is missing at runtime.** Cause: `importHelpers: true` emits imports from
   `tslib`, so it is a real runtime dependency — and it is in `dependencies`, not
   `devDependencies`, in the generated `package.json` (§08.2). Fix: reinstall it as a dependency.
4. **Symptom: output changed after a TypeScript patch upgrade.** Cause: only if `target` was
   removed — TypeScript 6's default is *"effectively a floating target"*. Fix: keep the explicit
   `"target": "ES2022"`.
5. **Symptom: you set `"strict": false` and template checking is still on.** Cause: two unrelated
   switches (§0.3). `strictTemplates` is an `angularCompilerOptions` key with its own default. Fix:
   set `strictTemplates: false` too — and read §07.8b first, because that combination is an error
   if `extendedDiagnostics` is configured.
6. **Symptom: `Property 'foo' comes from an index signature, so it must be accessed with ['foo']`.**
   Cause: `noPropertyAccessFromIndexSignature: true`, written by `--strict` and **not** part of
   TypeScript's `strict`. Fix: use bracket access, or drop the flag deliberately.
7. **Symptom: a project created with `--no-strict` behaves very differently.** Cause: that branch
   writes three things (`strict: false`, `strictTemplates: false`) and omits the four extras plus
   the two Angular strictness keys. It is a much bigger difference than the flag name suggests.

### 07.9d Interview questions

- ★ *A v22 `tsconfig.json` contains no `"strict": true`. Is the project strict?* → Yes. TypeScript
  6.0 made `strict` default to `true`, and the CLI pins `typescript` to `~6.0.2`, so the default
  always applies. The CLI only ever writes the *negation*, in the `--no-strict` branch — and its
  own spec asserts `expect(compilerOptions.strict).toBeUndefined()` for the strict case.
- ★ *Why does Angular write `"target": "ES2022"` when TypeScript 6 already picks a target?* →
  TypeScript 6's default is *"effectively a floating target"* (currently `es2025`). A floating
  target means the emitted output can change when the compiler is upgraded, which is unacceptable
  for a framework shipping build artefacts. Same reasoning for pinning `"module": "preserve"` over
  the new `esnext` default. (Angular does not document this rationale — it is a reading.)
- ★ *What does `--strict` actually add, given TypeScript 6's defaults?* → Four TypeScript flags
  outside the `strict` family (`noImplicitOverride`, `noPropertyAccessFromIndexSignature`,
  `noImplicitReturns`, `noFallthroughCasesInSwitch`) and two Angular ones
  (`strictInjectionParameters`, `strictInputAccessModifiers`). It adds nothing that `strict` or
  `strictTemplates` already give you by default — which is why the file looks so short.
- *Why is `tslib` a runtime dependency and not a dev dependency?* → `importHelpers: true` makes
  TypeScript emit imports of its helper functions from `tslib` instead of inlining a copy per file.
  The helpers are in the shipped bundle, so `tslib` is genuinely runtime.
- *Why `experimentalDecorators`?* → Angular's `@Component`, `@Injectable` and friends are legacy
  TypeScript decorators, not the TC39 stage-3 decorators TypeScript 5 shipped. The flag selects the
  legacy semantics.

---
---

# Topic 08 — What `ng new` produces in v22

🔴 **Read `## 0.6` before writing a line of this topic.** Topic 03 closed at 90 files and already
teaches `app.config.ts`, `main.ts`, `bootstrapApplication`, `provideRouter` and the whole SSR trio
in depth. **This topic is the tour of the tree.** Its job is: *here is every file, here is what it
is, here is why it exists, and here is where the deep explanation lives.* A chunk that re-explains
the provider array has failed.

The thesis to write on the topic README: **none of these files is an API.** Every one of them is
the output of an EJS template that a schematic chose to render. The framework's contracts are
`bootstrapApplication`'s signature and the `ApplicationConfig` shape; everything else — the
filenames, the folder layout, the `.catch`, the placeholder markup — is a **convention a template
author picked**, and can be changed. That reframing is what makes the topic worth reading rather
than a directory listing.

---

## Chunk 08.01 — `01-ng-new-is-two-schematics.md`

### 08.1a `ng new` runs `ng-new`, which runs `workspace` then `application`

The generated tree comes from **three** schematic directories in `angular/angular-cli`, and knowing
which file comes from which is the organising principle of the whole topic. Read from the tree at
`v22.1.7` (`gh api repos/angular/angular-cli/git/trees/v22.1.7?recursive=1`):

```
packages/schematics/angular/ng-new/
  index.ts
  schema.json

packages/schematics/angular/workspace/
  index.ts
  schema.json
  files/
    .prettierrc.template
    README.md.template
    __dot__editorconfig.template
    __dot__gitignore.template
    __dot__vscode/extensions.json.template
    __dot__vscode/launch.json.template
    __dot__vscode/tasks.json.template
    angular.json.template
    package.json.template
    tsconfig.json.template

packages/schematics/angular/application/
  index.ts
  schema.json
  files/
    common-files/
      public/favicon.ico.template
      src/app/app__suffix__.html.template
      src/index.html.template
      src/styles.__style__.template
      tsconfig.app.json.template
      tsconfig.spec.json.template
    standalone-files/
      src/main.ts.template
      src/app/app.config.ts.template
      src/app/app.routes.ts.template
      src/app/app__suffix__.ts.template
      src/app/app__suffix__.spec.ts.template
    module-files/
      src/main.ts.template
      src/app/app__suffix__.ts.template
      src/app/app__suffix__.spec.ts.template
      src/app/app__typeSeparator__module.ts.template
```

🔴 **That listing is itself the best diagram in the topic.** Three template sets:

- **`workspace/files/`** — the *workspace* layer. Everything at the repo root. Rendered once.
- **`application/files/common-files/`** — rendered for **both** standalone and NgModule apps.
- **`application/files/standalone-files/`** — the v22 default. `module-files/` is its
  `--no-standalone` counterpart and exists only for legacy interop
  (**topic 02 · Standalone by default** — `../02-standalone-by-default/README.md`, written).

**The filename encodings are worth explaining once**, because they look like corruption:

| Encoding | Means |
|---|---|
| `__dot__gitignore.template` | renders as `.gitignore` — a literal leading dot would make the template file itself hidden |
| `app__suffix__.ts.template` | `__suffix__` is substituted; see §08.1c |
| `styles.__style__.template` | substituted with the `style` option — `css` by default |
| `app__typeSeparator__module.ts.template` | `-` or `.` per the style guide (§08.1c) |
| `.template` suffix | stripped on output; keeps the templates from being compiled as part of the CLI |

⚠️ Note `.prettierrc.template` is **not** `__dot__prettierrc` — it is inconsistent with
`__dot__gitignore` and `__dot__editorconfig` in the same directory. That is upstream's
inconsistency, observed on disk. Mention it only if the chunk discusses the encoding; do not
present it as significant.

### 08.1b The option defaults that decide the tree

🔴 **This table is the most useful thing in topic 08** and it is read from the two schemas, not
from a blog. From
[`ng-new/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/ng-new/schema.json)
and
[`application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/schema.json)
at `v22.1.7`:

| Option | Default in `application/schema.json` | Effect on the tree |
|---|---|---|
| `standalone` | **`true`** | `standalone-files/` rather than `module-files/`; no `app-module.ts` |
| `routing` | **`true`** | `app.routes.ts` is generated; `provideRouter(routes)` appears in `app.config.ts` |
| `zoneless` | **`true`** | **no** `provideZoneChangeDetection` in `app.config.ts`; the spec uses `await fixture.whenStable()` |
| `ssr` | **`false`** | the `ssr` schematic is **not** run — no `main.server.ts`, no `app.config.server.ts` |
| `style` | **`"css"`** | `styles.css`, `app.css` |
| `testRunner` | **`"vitest"`** | `tsconfig.spec.json` gets `"types": ["vitest/globals"]` |
| `skipTests` | **`false`** | `app.spec.ts` is generated and `tsconfig.spec.json` is referenced |
| `minimal` | **`false`** | `tsconfig.spec.json` is generated; `.editorconfig` and the `test` VS Code task exist |
| `strict` | **`true`** | see §07.3b — writes the *extras*, not the defaults |
| `fileNameStyleGuide` | **`"2025"`** | `app.ts`, not `app.component.ts` — §08.1c |
| `prefix` | **`"app"`** | the root selector, `app-root` |
| `viewEncapsulation` | *(none)* | falls through to Angular's default |
| `inlineStyle` / `inlineTemplate` | *(none)* | separate `.html` and `.css` files |

⚠️ **`routing`, `ssr` and `zoneless` have NO `default` key in `ng-new/schema.json`** — they are
declared there with descriptions and `x-user-analytics` but no default. The defaults above come
from `application/schema.json`, which is the schematic `ng-new` delegates to. **A chunk should say
"the application schematic's defaults" rather than "the `ng new` defaults", or verify how the CLI
prompts.** ⚠️ I did not read `ng-new/index.ts`'s option forwarding, and I did not verify whether
the CLI *prompts* interactively for any of these. UNSETTLED #13 — and it matters, because "`ng new`
asks you about routing" is a thing many readers remember from earlier versions.

`ng-new`'s own defaults, which are genuinely its own: `skipInstall: false`, `skipGit: false`,
`commit: true`, `newProjectRoot: "projects"`, `createApplication: true`, `minimal: false`,
`strict: true`, `standalone: true`, `fileNameStyleGuide: "2025"`, `prefix: "app"`,
`skipTests: false`, `testRunner: "vitest"`.

And `ng-new` has one option `application` does not, worth a sentence:

> ```json
>     "aiConfig": {
>       "type": "array",
>       "uniqueItems": true,
>       "description": "Specifies which AI tools to generate configuration files for. These file are used to improve the outputs of AI tools by following the best practices.",
>       "items": {
>         "type": "string",
>         "enum": ["none", "claude-code", "cursor", "gemini-cli", "open-ai-codex", "vscode"]
>       }
>     },
> ```

⚠️ It has **no default**, and I did not read what files it emits. Name it as "v22 can generate
AI-tool config files; the option is `--ai-config`" and stop. UNSETTLED #14.

### 08.1c 🔴 `fileNameStyleGuide` — why the file is `app.ts` and not `app.component.ts`

This is the single most visible change for anyone returning to Angular, and it is one line of code.
From
[`application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts)
at `v22.1.7`, verbatim:

```ts
    const suffix = options.fileNameStyleGuide === '2016' ? '.component' : '';
    const typeSeparator = options.fileNameStyleGuide === '2016' ? '.' : '-';
```

With the default `'2025'`, `suffix` is the **empty string**. So `app__suffix__.ts.template` renders
as `app.ts`, `app__suffix__.html.template` as `app.html`, and `app__suffix__.spec.ts.template` as
`app.spec.ts`. With `--file-name-style-guide=2016` you get `app.component.ts`, `app.component.html`,
`app.component.spec.ts` — and `app.module.ts` rather than `app-module.ts`, because `typeSeparator`
flips from `-` to `.`.

The schema's own description, verbatim:

> *"The file naming convention to use for generated files. The '2025' style guide (default) uses a
> concise format (e.g., `app.ts` for the root component), while the '2016' style guide includes the
> type in the file name (e.g., `app.component.ts`). For more information, see the Angular Style
> Guide (https://angular.dev/style-guide)."*

🔴 **Consequence for the class name: it is `App`, not `AppComponent`.** The standalone template
(§08.4a) declares `export class App`, and `main.ts` imports `{ App }`. Every pre-2025 tutorial says
`AppComponent`. Call this out loudly — it is the #1 reason copied code does not compile.

⚠️ The `.template` files use `<%= suffix %>` **inside import paths too** —
`import { App } from './app<%= suffix %>';` — so the import specifier tracks the filename. Show the
resolved form, not the template, when demonstrating.

### 08.1d The generation order, and one surprise in it

From `application/index.ts`'s `chain([...])`, the steps in order (abridged to the structure, with
each element quoted from source):

```ts
    return chain([
      addAppToWorkspaceFile(options, appDir),
      addTsProjectReference('./' + join(normalize(appDir), 'tsconfig.app.json')),
      options.skipTests || options.minimal
        ? noop()
        : addTsProjectReference('./' + join(normalize(appDir), 'tsconfig.spec.json')),
      options.standalone
        ? noop()
        : schematic('module', { name: 'app', /* ... */ }),
      schematic('component', {
        name: 'app',
        selector: appRootSelector,
        flat: true,
        path: sourceDir,
        skipImport: true,
        project: options.name,
        ...componentOptions,
      }),
      mergeWith(
        apply(url(options.standalone ? './files/standalone-files' : './files/module-files'), [
          options.routing ? noop() : filter((path) => !path.endsWith('app.routes.ts.template')),
          componentOptions.skipTests
            ? filter((path) => !path.endsWith('.spec.ts.template'))
            : noop(),
          applyTemplates({ /* ... */ }),
          move(appDir),
        ]),
        MergeStrategy.Overwrite,
      ),
      mergeWith(
        apply(url('./files/common-files'), [
          options.minimal
            ? filter((path) => !path.endsWith('tsconfig.spec.json.template'))
            : noop(),
          componentOptions.inlineTemplate
            ? filter((path) => !path.endsWith('app__suffix__.html.template'))
            : noop(),
          applyTemplates({ /* ... */ }),
          move(appDir),
        ]),
        MergeStrategy.Overwrite,
      ),
      options.ssr
        ? schematic('ssr', {
            project: options.name,
            skipInstall: true,
          })
        : noop(),
      options.skipPackageJson ? noop() : addDependenciesToPackageJson(options),
```

🔴 **The surprise: `ng new` runs the ordinary `component` schematic for the root component, and
then overwrites its output.** Step 5 generates `app.ts`/`app.html`/`app.css`/`app.spec.ts` the same
way `ng generate component` would; steps 6 and 7 then `mergeWith(..., MergeStrategy.Overwrite)`
the application-specific templates on top. So:

- **`app.css` (or `app.scss`, …) comes from the `component` schematic**, not from any template in
  `application/files/`. That is why you will not find it in the listing in §08.1a — an accurate
  file-by-file page must say where it came from. 🔴 **This is the fact a writer will get wrong.**
- `app.ts`, `app.html` and `app.spec.ts` are generated twice and the second version wins.
- `skipImport: true` is passed because there is no `AppModule` to import into.
- **The `ssr` schematic runs last**, and only when `options.ssr` — which is how the whole server
  trio appears. Those files are topic 03's (§0.6); this topic lists them and links.

The three `filter(...)` calls are how options subtract files:

| Condition | File removed |
|---|---|
| `!options.routing` | `app.routes.ts.template` |
| `componentOptions.skipTests` | every `*.spec.ts.template` |
| `options.minimal` | `tsconfig.spec.json.template` |
| `componentOptions.inlineTemplate` | `app__suffix__.html.template` |

### 08.1e Gotchas to write

1. **Symptom: a tutorial says `AppComponent` and your project has `App`.** Cause:
   `fileNameStyleGuide: '2025'` (§08.1c). Fix: use `App`, or generate with
   `--file-name-style-guide=2016` if you must match older material.
2. **Symptom: you cannot find where `app.css` comes from.** Cause: it is generated by the
   `component` schematic, not by `application/files/` (§08.1d). Fix: none needed — but it is why
   `--inline-style` removes it and no template filter mentions it.
3. **Symptom: `ng new --minimal` and there is no `tsconfig.spec.json`.** Cause: the filter in
   §08.1d, matched by the conditional project reference in §07.3e. Fix: expected behaviour.
4. **Symptom: no `app.routes.ts`.** Cause: `--no-routing`. `provideRouter` also disappears from
   `app.config.ts`, because the template's `<% if (routing) %>` guards both the import and the
   provider (§08.5a).
5. **Symptom: `.gitignore` is missing after copying files out of the CLI repo by hand.** Cause: the
   template is named `__dot__gitignore.template`; the substitution happens at render time. Fix: not
   a real user scenario — mention only in the encoding discussion.

### 08.1f Interview questions

- ★ *What does `ng new` actually run?* → The `ng-new` schematic, which runs `workspace` (root-level
  files) and then `application` (the `src/` tree), and `application` in turn runs the ordinary
  `component` schematic for the root component and then overwrites parts of its output with
  application-specific templates. `ssr` runs last, only with `--ssr`.
- ★ *Why is the root component class called `App` in v22 rather than `AppComponent`?* → The
  `fileNameStyleGuide` option defaults to `'2025'`, which sets the schematic's `suffix` to the
  empty string. `'2016'` restores `.component` in the filename. It is a naming convention chosen by
  a schematic, not a framework rule.
- *Which of the generated files are Angular APIs?* → None of them. The framework's contracts are
  `bootstrapApplication`'s signature and the `ApplicationConfig` shape. Filenames, folder layout
  and the `.catch` are template author choices — topic 03 chunk 01 states this for `app.config.ts`
  specifically.
- *What removes `app.routes.ts` from the output?* → `--no-routing`, through
  `filter((path) => !path.endsWith('app.routes.ts.template'))` in the standalone-files pipeline.

---

## Chunk 08.02 — `02-the-workspace-layer.md`

Everything at the repository root, all from `workspace/files/` at `v22.1.7`.

### 08.2a `package.json`, verbatim from the template

[`workspace/files/package.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/package.json.template):

```
{
  "name": "<%= utils.dasherize(name) %>",
  "version": "0.0.0",
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "watch": "ng build --watch --configuration development"<% if (!minimal) { %>,
    "test": "ng test"<% } %>
  },
  "private": true,
  <% if (packageManagerWithVersion) { %>"packageManager": "<%= packageManagerWithVersion %>",<% } %>
  "dependencies": {
    "@angular/common": "<%= latestVersions.Angular %>",
    "@angular/compiler": "<%= latestVersions.Angular %>",
    "@angular/core": "<%= latestVersions.Angular %>",
    "@angular/forms": "<%= latestVersions.Angular %>",
    "@angular/platform-browser": "<%= latestVersions.Angular %>",
    "@angular/router": "<%= latestVersions.Angular %>",
    "rxjs": "<%= latestVersions['rxjs'] %>",
    "tslib": "<%= latestVersions['tslib'] %>"
  },
  "devDependencies": {
    "@angular/cli": "<%= '^' + version %>",
    "@angular/compiler-cli": "<%= latestVersions.Angular %>",
    "prettier": "<%= latestVersions['prettier'] %>",
    "typescript": "<%= latestVersions['typescript'] %>"
  }
}
```

Substituting from §07.1b's `latest-versions/package.json` and the version spine, the resolved file
for a default v22.1.7 workspace is:

```json
{
  "name": "my-app",
  "version": "0.0.0",
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "test": "ng test"
  },
  "private": true,
  "dependencies": {
    "@angular/common": "^22.1.5",
    "@angular/compiler": "^22.1.5",
    "@angular/core": "^22.1.5",
    "@angular/forms": "^22.1.5",
    "@angular/platform-browser": "^22.1.5",
    "@angular/router": "^22.1.5",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0"
  },
  "devDependencies": {
    "@angular/cli": "^22.1.7",
    "@angular/compiler-cli": "~22.1.5",
    "prettier": "^3.8.1",
    "typescript": "~6.0.2"
  }
}
```

⚠️ 🔴 **The Angular version *ranges* in that resolved block are NOT verified.** `latestVersions.Angular`
is the literal string `'0.0.0-ANGULAR-FW-VERSION'` in the source, substituted at release-build time
(§07.1b), so the source does not tell you whether the emitted range uses `^` or `~`. The
`latest-versions.ts` comment — *"As Angular CLI works with same minor versions of Angular Framework,
a tilde match for the current"* — is a **truncated sentence** that hints at a tilde but does not
settle it, and the `@angular/cli` entry is unambiguously `'^' + version`. **UNSETTLED #15. Do not
publish the resolved `dependencies` block with invented range operators.** Either show only the
template, or show the resolved block with the Angular entries written as
`"@angular/core": "<the 22.1.5 range the CLI emits — see UNSETTLED>"` and say so.

What **is** safe to state from the template:

1. 🔴 **Eight runtime dependencies, and only eight.** `@angular/common`, `compiler`, `core`,
   `forms`, `platform-browser`, `router`, plus `rxjs` and `tslib`. **No `zone.js`** — v22 is
   zoneless by default (topic 03 chunk 05). **No `@angular/animations`** — deprecated (topic 03
   chunk 11f). **No `@angular/platform-browser-dynamic`.**
2. **`@angular/compiler` is a *runtime* dependency, not a dev one.** Worth a sentence: it is
   optional at runtime for an AOT build (topic 03's bank recorded `@angular/compiler` as an
   *optional* peer of `core`), and **topic 11 · JIT vs AOT** *(not written yet)* owns why it is
   still listed. One line, then stop.
3. **`@angular/forms` is included even though nothing generated uses it.** A convenience, not a
   requirement.
4. **`typescript` and `@angular/compiler-cli` are devDependencies; `tslib` is a dependency.** The
   `tslib` placement is explained by `importHelpers: true` (§07.9b).
5. **`prettier` is a dependency of a new workspace**, paired with `.prettierrc` (§08.2d). New in
   recent CLI versions and worth noting.
6. **`"private": true`** — the workspace is not publishable.
7. **Four scripts, five with tests.** `watch` is `ng build --watch --configuration development` —
   note it names a *configuration*, which is **topic 06 · `angular.json` anatomy**'s subject
   *(not written yet)*. Name it, stop.
8. **`packageManager` is emitted only if `packageManagerWithVersion` is set**, and note the comma
   placement inside the EJS tag — a template detail, not a user-facing one.

### 08.2b `angular.json`, verbatim — and the boundary

[`workspace/files/angular.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/angular.json.template), complete:

```
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,<% if (packageManager) { %>
  "cli": {
    "packageManager": "<%= packageManager %>"
  },<% } %>
  "newProjectRoot": "<%= newProjectRoot %>",
  "projects": {
  }
}
```

🔴 **The workspace schematic writes an `angular.json` with an EMPTY `projects` object.** The
application schematic fills it in afterwards, via `addAppToWorkspaceFile(options, appDir)` (§08.1d).
That is the same two-phase pattern as the root `tsconfig.json` and its `references` (§07.3e) — the
workspace layer writes a skeleton, the application layer mutates it — and naming the pattern once
covers both files.

`"version": 1` is the *file format* version, not the Angular version. Say so; it is a recurring
confusion.

🔴 **STOP THERE. `angular.json`'s anatomy — `projects`, targets, builders, `configurations`,
`fileReplacements`, `budgets` — is topic 06** *(not written yet)*. This chunk quotes the four-line
skeleton, states what the file is in one angular.dev sentence, and points forward. The one
angular.dev sentence to use, verbatim from
[Workspace and project file structure](https://angular.dev/reference/configs/file-structure):

> *"CLI configuration for all projects in the workspace, including configuration options for how to
> build, serve, and test each project."*

### 08.2c `README.md`, `.gitignore`, `.editorconfig`

angular.dev's one-line descriptions, verbatim, for the whole workspace layer:

| File | angular.dev's description |
|---|---|
| `angular.json` | *"CLI configuration for all projects in the workspace, including configuration options for how to build, serve, and test each project."* |
| `package.json` | *"Configures npm package dependencies that are available to all projects in the workspace."* |
| `tsconfig.json` | *"The base TypeScript configuration for projects in the workspace. All other configuration files inherit from this base file."* |
| `.editorconfig` | *"Configuration for code editors."* |
| `.gitignore` | *"Specifies intentionally untracked files that Git should ignore."* |
| `README.md` | *"Documentation for the workspace."* |

⚠️ **angular.dev's `tsconfig.json` line — *"All other configuration files inherit from this base
file"* — is accurate and worth quoting, but it does not mention that the root compiles nothing
(`"files": []`) or that `angularCompilerOptions` inherits by a different mechanism.** Link
**07 · The TypeScript setup Angular requires** for both. That is topic 08's cleanest hand-off to
topic 07, and both chunks should carry it.

`.editorconfig`, verbatim from
[`workspace/files/__dot__editorconfig.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/__dot__editorconfig.template):

```ini
# Editor configuration, see https://editorconfig.org
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.ts]
quote_type = single
ij_typescript_use_double_quotes = false

[*.md]
max_line_length = off
trim_trailing_whitespace = false
```

⚠️ **`.editorconfig` is NOT generated under `--minimal`** — the CLI's own spec asserts it:
`expect(files).not.toContain('/.editorconfig');` in the minimal case, while the non-minimal spec
lists it (§08.2e). Everything else at the root is generated either way.

`.gitignore`, verbatim from
[`workspace/files/__dot__gitignore.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/__dot__gitignore.template):

```gitignore
# See https://docs.github.com/get-started/getting-started-with-git/ignoring-files for more about ignoring files.

# Compiled output
/dist
/tmp
/out-tsc
/bazel-out

# Node
/node_modules
npm-debug.log
yarn-error.log

# IDEs and editors
.idea/
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace

# Visual Studio Code
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json
!.vscode/mcp.json
.history/*

# Miscellaneous
/.angular/cache
.sass-cache/
/connect.lock
/coverage
/libpeerconnection.log
testem.log
/typings
__screenshots__/

# System files
.DS_Store
Thumbs.db
```

Three entries deserve a sentence each:

- 🔴 **`/.angular/cache`** — the build cache. Its existence is why a second `ng build` is fast and
  why "delete `.angular/` and rebuild" is a real remedy. **Topic 05** *(not written yet)* owns the
  cache; name it, stop.
- **`.vscode/*` with four `!` re-inclusions** — the workspace *does* commit its VS Code config
  (§08.2d), and the negations are what make that possible. `!.vscode/mcp.json` is in the list even
  though the workspace schematic does not generate one.
- **`__screenshots__/`** — new-ish, and consistent with `vitest` browser-mode testing being the
  default `testRunner`.

### 08.2d `.prettierrc` and `.vscode/`

[`workspace/files/.prettierrc.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/.prettierrc.template), complete:

```json
{
  "printWidth": 100,
  "singleQuote": true,
  "overrides": [
    {
      "files": "*.html",
      "options": {
        "parser": "angular"
      }
    }
  ]
}
```

🔴 **`"parser": "angular"` for `*.html`** is the interesting line: Angular templates are not HTML
(topic 01's thesis — *"Templates are a separate language"*), and Prettier needs to be told. That is
a nice, small piece of evidence for the phase's central claim, and topic 08 is allowed to make that
connection in one sentence with a link to `../01-compiler-with-a-framework-attached/README.md`.

[`workspace/files/__dot__vscode/extensions.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/__dot__vscode/extensions.json.template), complete:

```jsonc
{
  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=827846
  "recommendations": ["angular.ng-template"]
}
```

`angular.ng-template` is the Angular Language Service extension — the thing that gives you template
type errors in the editor, and therefore the thing whose version can disagree with the compiler
(§07.5e #5).

[`workspace/files/__dot__vscode/tasks.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/__dot__vscode/tasks.json.template), complete:

```
{
  // For more information, visit: https://go.microsoft.com/fwlink/?LinkId=733558
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "start",
      "isBackground": true,
      "problemMatcher": {
        "owner": "typescript",
        "pattern": "$tsc",
        "background": {
          "activeOnStart": true,
          "beginsPattern": {
            "regexp": "Changes detected"
          },
          "endsPattern": {
            "regexp": "bundle generation (complete|failed)"
          }
        }
      }
    }<% if (!minimal) { %>,
    {
      "type": "npm",
      "script": "test",
      "isBackground": true,
      "problemMatcher": { /* identical shape, same regexes */ }
    }<% } %>
  ]
}
```

⚠️ The `test` task's `problemMatcher` is character-for-character identical to the `start` one in
the template. If a chunk shows both, say they are identical rather than printing the block twice —
or print it once and say the second task repeats it.

⚠️ `launch.json.template` exists in the tree and I **did not read it**. The workspace spec asserts
it contains a configuration named `ng test` in the non-minimal case (§08.2e), which is all I can
state. UNSETTLED #16 — do not describe its contents beyond that.

### 08.2e The workspace file list, asserted by upstream's own spec

The strongest available evidence for "which files exist" is the CLI's own test. From
[`workspace/index_spec.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/index_spec.ts) at `v22.1.7`, verbatim:

```ts
  it('should create all files of a workspace', async () => {
    const options = { ...defaultOptions };
    const tree = await schematicRunner.runSchematic('workspace', options);
    const files = tree.files;
    expect(files).toEqual(
      jasmine.arrayContaining([
        '/.vscode/extensions.json',
        '/.vscode/launch.json',
        '/.vscode/tasks.json',
        '/.editorconfig',
        '/angular.json',
        '/.gitignore',
        '/package.json',
        '/README.md',
        '/tsconfig.json',
      ]),
    );
  });
```

and the `--minimal` variant, which differs by exactly one entry:

```ts
    expect(files).toEqual(
      jasmine.arrayContaining([
        '/.vscode/extensions.json',
        '/.vscode/launch.json',
        '/.vscode/tasks.json',
        '/angular.json',
        '/.gitignore',
        '/package.json',
        '/README.md',
        '/tsconfig.json',
      ]),
    );

    expect(files).not.toContain('/.editorconfig');
```

🔴 **Note what is missing from both lists: `.prettierrc`.** The template exists in
`workspace/files/` and is not asserted by the spec, because `jasmine.arrayContaining` only checks
that the listed entries are present. **Do not read the spec as an exhaustive list** — say
"upstream's spec asserts these nine" and derive the full set from the template directory (§08.1a).
A page that presents the spec list as the complete tree omits `.prettierrc`.

Two more specs worth quoting, because they pin the version story:

```ts
  it('should set the CLI version in package.json', async () => {
    const tree = await schematicRunner.runSchematic('workspace', defaultOptions);
    const pkg = JSON.parse(tree.readContent('/package.json'));
    expect(pkg.devDependencies['@angular/cli']).toMatch('6.0.0');
  });

  it('should use the latest known versions in package.json', async () => {
    const tree = await schematicRunner.runSchematic('workspace', defaultOptions);
    const pkg = JSON.parse(tree.readContent('/package.json'));
    expect(pkg.dependencies['@angular/core']).toEqual(latestVersions.Angular);
    expect(pkg.dependencies['rxjs']).toEqual(latestVersions['rxjs']);
    expect(pkg.devDependencies['typescript']).toEqual(latestVersions['typescript']);
  });
```

(The `'6.0.0'` there is the *test fixture's* `version` option — `defaultOptions` is
`{ name: 'foo', version: '6.0.0' }` — **not** an Angular or TypeScript version. It is a trap for a
reader skimming for version numbers, and a chunk quoting this spec must say so.)

### 08.2f Gotchas to write

1. **Symptom: `zone.js` is not installed and an old tutorial's `polyfills` entry fails.** Cause:
   v22 is zoneless by default and `zone.js` is not in the generated `dependencies`. Fix: it is
   genuinely not needed; if you opted into zones, see
   `../03-the-provider-array/05d-the-polyfill-half-and-noopngzone.md`, which covers exactly the
   `angular.json`/provider-array desync this produces.
2. **Symptom: `@angular/animations` is missing.** Cause: not generated; deprecated in v22. Fix:
   `../03-the-provider-array/11f-animations-are-deprecated.md`.
3. **Symptom: `.editorconfig` is missing.** Cause: `--minimal`, asserted by upstream's spec.
4. **Symptom: the `.vscode` folder is gitignored but the files are committed.** Cause: the four `!`
   negations in `.gitignore`. Working as designed.
5. **Symptom: `"version": 1` in `angular.json` misread as the Angular version.** Cause: it is the
   file format version. Fix: nothing to do — a labelling problem, worth one sentence.
6. **Symptom: `tslib` removed from `dependencies` because "it looks like a dev tool".** Cause:
   `importHelpers: true` makes it runtime (§07.9b). Fix: put it back.

---

## Chunk 08.03 — `03-the-src-directory.md`

### 08.3a `src/index.html`, verbatim

[`application/files/common-files/src/index.html.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/src/index.html.template), complete:

```
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title><%= utils.classify(name) %></title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <<%= selector %>></<%= selector %>>
</body>
</html>
```

Resolved for `ng new my-app` (`prefix` defaults to `app`, so `selector` is `app-root`):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>MyApp</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <app-root></app-root>
</body>
</html>
```

⚠️ **MDX: `<app-root>` and `<base href="/">` must never appear in prose** — backtick or fence them
(§0.7). The whole file is safe inside a fence.

Four things to explain, in this order:

1. 🔴 **`<base href="/">` is the router's dependency, not decoration.** The router's default
   `LocationStrategy` is `PathLocationStrategy`, which requires a base href. Deleting this line
   breaks routing. It is also why `withHashLocation()` exists as an alternative
   (`../03-the-provider-array/08b-with-router-config-and-hash-location.md`) and why deploying to a
   sub-path needs `--base-href`. One sentence and a link; **Phase 8 — Routing** *(not written yet)*
   owns location strategies.
2. **`<app-root></app-root>` is the only markup in the body**, and it matches the root component's
   `selector`. `bootstrapApplication(App, appConfig)` finds this element and renders into it. The
   deep version is `../03-the-provider-array/01-app-config-and-what-bootstrap-does-with-it.md` —
   link, do not re-derive.
3. **There are no `<script>` or `<link rel="stylesheet">` tags.** angular.dev, verbatim:
   > *"The main HTML page that is served when someone visits your site. The CLI automatically adds
   > all JavaScript and CSS files when building your app."*
   🔴 That is the whole point of the file — you write the shell, the builder injects the bundles
   with their content hashes. Editing it to add a `<script src="main.js">` is a classic mistake.
   **Topic 05** *(not written yet)* owns the injection.
4. **`utils.classify(name)`** turns `my-app` into `MyApp` for the `<title>`, while
   `utils.dasherize(name)` is used for the `package.json` name (§08.2a). Two different string
   helpers on the same input — worth one line, because it explains why the title is PascalCase.

### 08.3b `src/styles.css`, verbatim

[`application/files/common-files/src/styles.__style__.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/src/styles.__style__.template)
is **one line**:

```css
/* You can add global styles to this file, and also import other style files */
```

angular.dev: *"Global CSS styles applied to the entire application."*

The `__style__` in the filename is substituted from the `style` option (default `"css"`), so
`--style=scss` yields `src/styles.scss`. The enum is
`["css", "scss", "sass", "less", "tailwind"]`.

🔴 **`tailwind` is a `style` value in v22 and is handled specially.** From
`application/index.ts`, verbatim:

```ts
    const isTailwind = options.style === Style.Tailwind;
    if (isTailwind) {
      options.style = Style.Css;
    }
```

So `--style=tailwind` produces `.css` files and then does something extra. ⚠️ **I did not read
what the extra step is** — I read only this reassignment and saw `tailwindcss` and
`@tailwindcss/postcss` in `latest-versions/package.json`. UNSETTLED #17. Name the option, quote
the two lines, and say the rest is not verified.

### 08.3c `public/`

The only template is
[`application/files/common-files/public/favicon.ico.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/public/favicon.ico.template)
— a binary file, so **do not attempt to show its contents.**

angular.dev, verbatim:

> *"Contains image and other asset files to be served as static files by the dev server and copied
> as-is when you build your application."*

Two points:

- 🔴 **`public/` is a sibling of `src/`, not inside it.** The path in the schematic is
  `common-files/public/favicon.ico.template`, alongside `common-files/src/`. Readers coming from
  Angular 16 and earlier expect `src/assets/`; the rename to a root-level `public/` is a real
  change and copied tutorials get it wrong.
- **`index.html` references it as `href="favicon.ico"`** — a bare relative path, not
  `public/favicon.ico`, because the contents of `public/` are copied to the output root. The
  mapping is configured in `angular.json` — **topic 06** *(not written yet)*. One line, stop.

### 08.3d `src/main.ts` — hand off, do not re-explain

[`application/files/standalone-files/src/main.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/standalone-files/src/main.ts.template), complete:

```
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app<%= suffix %>';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
```

Resolved (`suffix` = `''`):

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
```

angular.dev: *"The main entry point for your application."*

🔴 **This is a hand-off point, and the strictest one in the topic.**
`../03-the-provider-array/01-app-config-and-what-bootstrap-does-with-it.md` already contains this
exact file verbatim, the full `bootstrapApplication` signature, `internalCreateApplication`'s
`allAppProviders`, the three-tier injector table and the six-step bootstrap order.

**Chunk 08.03 should say, in total, about four sentences:**

- It is three imports and one call. That is the entire entry point.
- `App` is the first argument, `appConfig` the second; the second is optional.
- The `.catch` matters — a bootstrap failure *rejects a promise* rather than throwing, so without
  it a failed startup can be completely silent. Link
  `../03-the-provider-array/06c-when-a-startup-initializer-fails.md`.
- Everything about what the call *does*:
  **link `../03-the-provider-array/01-app-config-and-what-bootstrap-does-with-it.md`**.

⚠️ **Do not restate the six-step bootstrap order here.** It is topic 03's and duplicating it means
two pages that can drift apart.

### 08.3e Gotchas to write

1. **Symptom: routing 404s on refresh after deploying to a sub-path.** Cause: `<base href="/">` no
   longer matches the deploy path. Fix: `ng build --base-href /my-app/` — and note the flag exists
   because the tag is a build-time concern.
2. **Symptom: you added `src/assets/` and the files are not served.** Cause: v22 uses a root-level
   `public/` (§08.3c). Fix: move them into `public/`.
3. **Symptom: you added a `<script>` to `index.html` and it is not hashed / not bundled.** Cause:
   the builder injects bundles; hand-added tags are passed through untouched. Fix: import the code
   from `main.ts`, or configure it as a script in `angular.json` (topic 06).
4. **Symptom: styles in `styles.css` do not apply to a component's internals.** Cause: view
   encapsulation, not the file. **Phase 1 — Components and templates** *(not written yet)* owns it;
   name it and stop.
5. **Symptom: the app renders nothing and the console is empty.** Cause: the `.catch` was removed,
   or bootstrap rejected before the root component was created. 🔴 Topic 03 chunk 01 already carries
   this gotcha in full — **link it rather than restating it**, and if you keep a one-line version
   here, make it point there.
6. **Symptom: `<app-root>` in `index.html` does not match the component selector.** Cause:
   `--prefix` was changed after generation, or the component's `selector` was edited. Fix: keep the
   two in sync; the template generates both from the same `selector` value.

### 08.3f Interview questions

- ★ *What is `<base href="/">` for, and what breaks without it?* → The router's default
  `PathLocationStrategy` resolves URLs against it. Remove it and routing breaks; deploy under a
  sub-path without updating it and every route 404s on refresh. `--base-href` exists for exactly
  that, and `withHashLocation()` is the alternative strategy.
- ★ *`index.html` has no script tags. How does the application load?* → The builder injects the
  emitted bundles at build time, with content hashes. angular.dev states it directly: *"The CLI
  automatically adds all JavaScript and CSS files when building your app."*
- *Where do static assets go in v22?* → `public/`, a sibling of `src/`. Not `src/assets/`.
- *`main.ts` ends with `.catch((err) => console.error(err))`. Is that boilerplate?* → No.
  `bootstrapApplication` returns a promise and a bootstrap failure rejects it rather than throwing,
  so without the catch a failed startup can produce a blank page and an empty console.

---

## Chunk 08.04 — `04-the-root-component.md`

### 08.4a `src/app/app.ts`, verbatim

[`application/files/standalone-files/src/app/app__suffix__.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/standalone-files/src/app/app__suffix__.ts.template), complete:

```
import { Component, signal } from '@angular/core';<% if (routing) { %>
import { RouterOutlet } from '@angular/router';<% } %>

@Component({
  imports: [<% if (routing) { %>RouterOutlet<% } %>],
  selector: '<%= selector %>',<% if (inlineStyle) { %>
  styles: [],<% } else { %>
  styleUrl: './app<%= suffix %>.<%= style %>',<% } %><% if (inlineTemplate) { %>
  template: `
    <h1>Hello, {{ title() }}</h1>

    <% if (routing) {
     %><router-outlet /><%
    } %>
  `,<% } %><% } else { %>
  templateUrl: './app<%= suffix %>.html',<% } %>
})
export class App {
  protected readonly title = signal('<%= name %>');
}
```

⚠️ **The EJS above is transcribed from the source file and its brace structure around the
`inlineTemplate` branch is dense.** Show the **resolved** version to readers and keep the template
form only if the chunk is specifically about the schematic. Resolved with all v22 defaults
(`routing: true`, `inlineStyle`/`inlineTemplate` unset, `style: 'css'`, `suffix: ''`,
`selector: 'app-root'`, `name: 'my-app'`):

```ts
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('my-app');
}
```

🔴 **Five things in eleven lines, and every one of them is a v22 signal:**

1. **No `standalone: true`.** It is the default in v22 and the flag exists only as a legacy
   opt-out. `../02-standalone-by-default/README.md` (written) owns this — link it.
2. **`imports: [RouterOutlet]`** — dependencies are declared on the component, not in a module.
   Also `../02-standalone-by-default/README.md`, whose chunk 04 is titled *"What `imports` actually
   means"*. Link, do not re-explain.
3. 🔴 **`protected readonly title = signal('my-app')`** — the generated root component uses a
   **signal**, and the template calls it as `title()`. Three separate v22 statements in one line:
   signals are the default state primitive; `protected` because the template can read protected
   members but nothing outside the class should; `readonly` because you replace the *value*
   (`title.set(...)`), never the signal. **Phase 4 — Signals** *(not written yet)* owns the
   mechanism; this chunk explains the three modifiers and stops.
4. **`imports: []` when `--no-routing`** — an empty array, not an omitted key. A template artefact
   worth one line.
5. **The `@Component` key order is `imports`, `selector`, `styleUrl`, `templateUrl`** — note
   `imports` comes *first* in v22's template. Cosmetic, but readers comparing against older
   generated code notice.

### 08.4b `src/app/app.html` — the placeholder, and how to handle it

[`application/files/common-files/src/app/app__suffix__.html.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/src/app/app__suffix__.html.template)
is **~340 lines**: eight banner comments, a `<style>` block of about 150 lines of CSS custom
properties and rules, an inline Angular SVG logo of several thousand characters, a `@for` block of
six documentation links, three social SVGs, a closing banner, and finally the router outlet.

🔴 **Do NOT reproduce this file.** It would blow the 300-line cap on its own, contributes almost
nothing, and its bare `<!-- ... -->` comments are MDX build-breakers if any line escapes a fence
(§0.7). Instead:

**(a) Quote the banner, which tells the reader what to do with the file** — the first and last
comment blocks say it plainly:

> `<!-- * * * * * * * * * * The content below * * * * * * * * * * * -->`
> `<!-- * * * * * * * * * * is only a placeholder * * * * * * * * * * -->`
> `<!-- * * * * * * * * * * and can be replaced.  * * * * * * * * * * -->`
> `<!-- * * * * * * * * * Delete the template below * * * * * * * * * -->`
> `<!-- * * * * * * * to get started with your project! * * * * * * * -->`

**(b) Quote only the two structural lines that matter**, which are the first and last non-comment
content:

```html
<h1>Hello, {{ title() }}</h1>
```

and, at the very end of the file:

```html
<router-outlet />
```

**(c) Make three observations that are actually interesting**, each one line:

- 🔴 **`<router-outlet />` is the LAST element in the file, after ~340 lines of placeholder.**
  That is why deleting "the placeholder" so often deletes the outlet too and routing silently stops
  working. Best gotcha in the chunk.
- **The `<style>` block is inline in the template, not in `app.css`** — so `app.css` is *empty* and
  the placeholder's styling lives in the HTML. Readers who delete `app.css` expecting the pink
  gradient to vanish are looking in the wrong file.
- **The links block uses `@for (item of [...]; track item.title)`** — the v22 built-in control flow
  with a mandatory `track`, in generated code. **Phase 1** *(not written yet)* owns `@for`; note it
  in one line as evidence that built-in control flow is the default idiom now.

### 08.4c `src/app/app.css`

Generated by the **`component` schematic**, not by any template in `application/files/` (§08.1d).
It is empty (or contains only a comment). ⚠️ **I did not read the `component` schematic's stylesheet
template**, so do not state its exact contents. Say "empty by default" only if you verify it, or
say "generated by the `component` schematic" and move on. UNSETTLED #18.

The extension follows `--style`; `--inline-style` replaces it with `styles: []` in the decorator
(visible in the EJS in §08.4a).

### 08.4d `src/app/app.spec.ts`, verbatim

[`application/files/standalone-files/src/app/app__suffix__.spec.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/standalone-files/src/app/app__suffix__.spec.ts.template), complete:

```
import { TestBed } from '@angular/core/testing';
import { App } from './app<%= suffix %>';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', <% if (zoneless) { %>async <% } %>() => {
    const fixture = TestBed.createComponent(App);
    <%= zoneless ? 'await fixture.whenStable();' : 'fixture.detectChanges();' %>
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hello, <%= name %>');
  });
});
```

Resolved with `zoneless: true` (the default) and `name: 'my-app'`:

```ts
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hello, my-app');
  });
});
```

🔴 **The zoneless conditional is the whole reason to show this file**, and it is a genuinely
important v22 fact:

| `zoneless` | Test signature | Synchronisation call |
|---|---|---|
| `true` (**default**) | `async () => {` | `await fixture.whenStable();` |
| `false` | `() => {` | `fixture.detectChanges();` |

**Zoneless testing is asynchronous.** `fixture.detectChanges()` is a synchronous, imperative
"render now"; `await fixture.whenStable()` waits for the scheduler to settle. Every pre-v22 test
written against `detectChanges()` is a candidate for silent breakage in a zoneless app — the
assertion runs before the render. That single table is worth the chunk.

Three more notes:

- **`imports: [App]`** in `configureTestingModule` — a standalone component is *imported*, not
  *declared*. Link `../02-standalone-by-default/README.md`.
- **`describe`/`it`/`expect` are globals** here, which is exactly what `tsconfig.spec.json`'s
  `"types": ["vitest/globals"]` provides (§07.3d). 🔴 **This is topic 08's cleanest hand-off to
  topic 07** — the two files explain each other, and both chunks should carry the link.
- ⚠️ The template's spec uses `describe`/`it` (Jasmine-shaped names) while the default runner is
  **vitest**. Vitest's globals provide `describe`/`it`/`expect` too, so this is consistent — but
  say "vitest, in Jasmine-compatible global style" rather than implying Jasmine is the runner.

### 08.4e Gotchas to write

1. **🔴 Symptom: routing stops working right after you delete the placeholder markup.** Cause:
   `<router-outlet />` is the **last** line of `app.html`, after ~340 lines of placeholder, so
   "select all and delete" takes it with them (§08.4b). Fix, in code — put it back:
   ```html
   <router-outlet />
   ```
2. **Symptom: a test passes on `main` and fails after enabling zoneless.** Cause:
   `fixture.detectChanges()` is synchronous and no longer forces a render. Fix, in code:
   ```ts
   it('should render title', async () => {
     const fixture = TestBed.createComponent(App);
     await fixture.whenStable();
     // assertions here
   });
   ```
3. **Symptom: `{{ title }}` renders `[object Object]` or a function source.** Cause: `title` is a
   **signal**; the template must call it — `{{ title() }}`. Fix: add the parentheses.
4. **Symptom: `title` is not accessible from a parent component or a test.** Cause: it is
   `protected`. Templates may read protected members; external code may not. Fix: widen it
   deliberately, or expose a method — do not reflexively make it `public`.
5. **Symptom: `this.title = signal('x')` fails to compile.** Cause: `readonly`. You set the
   signal's *value*, not the property. Fix: `this.title.set('x')`.
6. **Symptom: `Cannot find name 'describe'` in `app.spec.ts`.** Cause: the tsconfig split —
   §07.3g #1. Fix is there.
7. **Symptom: deleting `app.css` does not remove the placeholder styling.** Cause: the styles are
   in a `<style>` block inside `app.html`, not in `app.css` (§08.4b). Fix: delete the placeholder
   markup — carefully, keeping `<router-outlet />`.
8. **Symptom: an old tutorial's `declarations: [AppComponent]` in `configureTestingModule` fails.**
   Cause: two changes at once — the class is `App` (§08.1c) and standalone components go in
   `imports`, not `declarations`. Fix: `imports: [App]`.

### 08.4f Interview questions

- ★ *The generated root component has `protected readonly title = signal('my-app')`. Explain all
  three modifiers.* → `signal` because signals are v22's default state primitive and the template
  reads it as `title()`. `protected` because Angular templates can read protected class members,
  so the field is reachable where it needs to be and nowhere else. `readonly` because the signal
  object is the identity — you change the value with `.set()`, and reassigning the property would
  break every existing subscription.
- ★ *Why is the generated spec `async` with `await fixture.whenStable()` instead of
  `fixture.detectChanges()`?* → Because `zoneless` defaults to `true`. Without Zone.js there is no
  synchronous "render now" hook; the scheduler settles asynchronously. The template literally
  branches on the option:
  `<%= zoneless ? 'await fixture.whenStable();' : 'fixture.detectChanges();' %>`. It is also why
  porting a pre-v22 test suite to zoneless produces assertions that run before the render.
- ★ *You deleted the placeholder in `app.html` and routing broke. Why?* → `<router-outlet />` is
  the last element in the file, after roughly 340 lines of placeholder markup and an inline
  `<style>` block. It is very easy to delete along with everything else.
- *Why is there no `standalone: true` in the generated `@Component`?* → It is the v22 default. The
  flag now exists only as a legacy opt-out (`standalone: false`).
- *Where does `app.css` come from, given it is not in `application/files/`?* → From the ordinary
  `component` schematic, which `application/index.ts` invokes for the root component before
  overwriting some of its output with application-specific templates.
