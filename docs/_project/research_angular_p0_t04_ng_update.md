---
name: research-angular-p0-04-to-12-ng-update-build-and-tooling
description: Banked primary-source research for Angular Phase 0 topics 04-12 (ng update, @angular/build, angular.json, the TypeScript setup, ng new, the release train, partial compilation, JIT vs AOT, dev-mode-only behaviour) — verbatim quotes and URLs for every chunk.
metadata:
  type: reference
---

# Research bank — Angular Phase 0, topics `04`–`12`

Researched **2026-09-09** against `angular/angular` at tag **`v22.1.5`**, `angular/angular-cli`
at tag **`v22.1.7`**, `microsoft/TypeScript` at tags **`v6.0.2`** and **`v5.9.2`**, angular.dev
(served at `v22.1.5+sha-ef48630`), and `registry.npmjs.org`. **No sandbox was run** — every code
block below is *source text read from a repository or a documentation page*, never program output.
No `ng update` was executed, no project was scaffolded, no build was run.

**Who this is for.** The unwritten chunks of Phase 0 topics **04 through 12**:

| Syllabus topic | Directory to create under `docs/angular/pages/phase-0-how-angular-runs/` |
|---|---|
| 04 · `ng update`, not `npm install` | `04-ng-update-not-npm-install/` |
| 05 · The build: `@angular/build` | `05-the-build-angular-build/` |
| 06 · `angular.json` anatomy | `06-angular-json-anatomy/` |
| 07 · The TypeScript setup Angular requires | `07-the-typescript-setup/` |
| 08 · What `ng new` produces in v22 | `08-what-ng-new-produces/` |
| 09 · The release train | `09-the-release-train/` |
| 10 · Partial compilation | `10-partial-compilation/` |
| 11 · JIT vs AOT | `11-jit-vs-aot/` |
| 12 · Dev-mode-only behaviour | `12-dev-mode-only-behaviour/` |

🔴 **Those directory names are a proposal, not a fact.** Nothing links to them yet
(§0.4 proves it). Whoever writes topic 04 first should fix the names and record them here.

Jump to your own `## Chunk NN` section; read `## 0 · Facts every chunk needs` first, it is short
and load-bearing.

🔴 **Rule for using this bank: if a claim is not in here with a URL, either verify it yourself or
write it as explicitly uncertain.** `## 99 · UNSETTLED` lists what I could not settle — it is long
on purpose.

---

## 0 · Facts every chunk needs

### 0.1 The version spine — re-measured 2026-09-09, do not re-derive

| | |
|---|---|
| `@angular/core` `latest` | **22.1.5** · `next` **22.2.0-next.5** |
| `@angular/cli` / `@angular/build` `latest` | **22.1.7** · `next` **22.2.0-next.6** |
| CLI LTS tags | `v21-lts` **21.2.23** · `v20-lts` **20.3.36** · `v19-lts` **19.2.27** |
| core LTS tags | `v21-lts` **21.2.22** · `v20-lts` **20.3.30** · `v19-lts` **19.2.25** |
| `@angular/compiler-cli@22.1.5` peers | **`typescript: >=6.0 <6.1`** · `@angular/compiler: 22.1.5` |
| `@angular/core@22.1.5` peers | `rxjs: ^6.5.3 \|\| ^7.4.0` · `zone.js: ~0.15.0 \|\| ~0.16.0` (**optional**) · `@angular/compiler: 22.1.5` (**optional**) |
| engines (`compiler-cli`, `@angular/cli`) | `node: ^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0` |
| `@angular/cli@22.1.7` extra engines | `npm: ^6.11.0 \|\| ^7.5.6 \|\| >=8.0.0` · `yarn: >= 1.13.0` |
| `typescript` on npm | `latest` **7.0.2**, `next` 7.1.0-dev.20260908.1 — 🔴 **outside Angular's range** |
| v22.0.0 released | **2026-06-03** |

Sources (all fetched 2026-09-09):
`https://registry.npmjs.org/-/package/@angular/core/dist-tags`,
`https://registry.npmjs.org/-/package/@angular/cli/dist-tags`,
`https://registry.npmjs.org/-/package/@angular/build/dist-tags`,
`https://registry.npmjs.org/-/package/typescript/dist-tags`,
`https://registry.npmjs.org/@angular/core/22.1.5`,
`https://registry.npmjs.org/@angular/compiler-cli/22.1.5`,
`https://registry.npmjs.org/@angular/cli/22.1.7`.

✅ **The existing spine matched on every number I could re-check**: Angular **22.1.5**, CLI /
`@angular/build` / `@angular/ssr` **22.1.7**, TypeScript peer **`>=6.0 <6.1`**. Only the LTS
dist-tags have drifted since topic 03's bank (v20 CLI 20.3.30 → **20.3.36**, v21 CLI 21.2.22 →
**21.2.23**, v19 CLI 19.2.25 → **19.2.27**) — patch churn on the LTS lines, nothing structural.

⚠️ **One date discrepancy, do not paper over it.** The corpus says `@angular/core@22.1.5` was
*"published 2026-09-03"*. The `angular/angular` CHANGELOG heading reads **`# 22.1.5 (2026-09-02)`**
([source](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md)), and the CLI CHANGELOG
reads **`# 22.1.7 (2026-09-02)`**. Both can be true — the changelog dates the release commit, npm
dates the publish. If a chunk needs a date, say which one it is.

⚠️ **`typescript` is NOT a peer of `@angular/core`.** It is a peer of `@angular/compiler-cli`,
`@angular/build` and `@angular-devkit/build-angular`. Say "TypeScript peer `>=6.0 <6.1`" without
attributing it to `core`. (Same rule topic 03's bank set; it still holds.)

### 0.2 The `> Verified:` line to copy (adapt the source list per chunk)

```markdown
> Verified: 2026-09-09 against angular.dev
> [Page title](url) — and `angular/angular-cli` at tag `v22.1.7`:
> [`path/file.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/path/file.ts).
> Documentation-validated; **no sandbox run** — no `ng update`, `ng new` or build was executed.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
```

Blob URL shapes (both verified working in this environment):
`https://github.com/angular/angular/blob/v22.1.5/<path>` ·
`https://github.com/angular/angular-cli/blob/v22.1.7/<path>` ·
`https://github.com/microsoft/TypeScript/blob/v6.0.2/<path>`.

🔴 **Reading the source yourself: `raw.githubusercontent.com` 404s in this environment.** Use:

```bash
gh api repos/angular/angular-cli/contents/<path>?ref=v22.1.7 -q .content | base64 -d
gh api repos/angular/angular/contents/<path>?ref=v22.1.5     -q .content | base64 -d
```

`gh api "repos/<owner>/<repo>/git/trees/<tag>?recursive=1" -q '.tree[].path'` lists the whole tree
cheaply — use it before guessing a path.

🔴 **angular.dev pages render fine to `curl` for prose, but its API-reference pages and
`/reference/migrations` are client-rendered** — the prerendered HTML for those carries only the
sidebar. Do not quote an API page from a `curl`; read the source or the golden instead
(§99.1).

### 0.3 🔴 Scope boundary — the deep `ng update` mechanics belong to **Phase 15**

The syllabus row itself says so, verbatim:

> *"**`ng update` is the upgrade mechanism, not `npm install`** — schematics rewrite your source;
> skipping a major and jumping two is the single most expensive Angular mistake (Master in Phase
> 15, where the mechanics live)"*
> — `docs/angular/syllabus/01-the-angular-model.md` line 32

**What Phase 0 topic 04 owns** (Understand tier): *that* the upgrade path is a command which
rewrites source rather than a version bump; the one-major-at-a-time rule and its error; the shape
of `ng-update` metadata; required vs optional migrations as a concept; the fact that a migration is
a schematic. Enough that a reader is never surprised.

**What Phase 15 owns** (Master tier, and must be forward-referenced, never taught here):
writing your own migration schematic; the `@angular-devkit/schematics` `Tree`/`Rule` API;
`NodeWorkflow` internals; recovering a half-applied update; monorepo and catalog strategies;
per-library `ng update` authoring. If a chunk finds itself explaining `workflow.execute()`, it has
crossed the line.

🔴 **Phase 15 does not exist on disk.** Write it as **bold text plus *(not written yet)***, never
as a link. Same for Phase 5, Phase 6 and Phase 14.

### 0.4 🔴 What already exists in this phase, and must NOT be re-derived

Topic 01 (`01-compiler-with-a-framework-attached/`) is content-dense and **already owns four
subjects this bank touches**. Duplicating them is the single most likely failure of these nine
topics. Verified by reading the files on disk 2026-09-09:

| Already written | File | What it already says |
|---|---|---|
| **Partial compilation + the linker** | `01-compiler-with-a-framework-attached/12f-partial-compilation-and-the-linker.md` | The whole mechanism at **Master** tier: `compilationMode`, the `ɵɵngDeclare*` family, `separate_compilation.md`, the `@angular/compiler-cli/linker/babel` plugin, "compiled once and linked N times" |
| **Version skew** | `…/12g-version-skew-is-a-coded-concern.md` | The five compiler gates on library/app version mismatch |
| **The TypeScript pin** | `…/13b-ngc-is-tsc-and-the-typescript-pin.md` | `ngc` is `tsc`; the version check in full; why the window is one minor wide; the escape hatch and why it is not one |
| **`strictTemplates`** | `…/14f-what-stricttemplates-actually-switches.md` + `14g-what-turning-strict-templates-off-costs.md` | Every flag it switches, and the cost of turning it off |
| **The v22 upgrade experience** | `…/17c-the-v22-upgrade-wall.md` | The seven v22 changes, the order to do them in, and the argument tying them together |

🔴 **Consequences, per topic:**

- **Topic 07 (TypeScript setup)** must NOT re-explain the pin's enforcement or `strictTemplates`'
  flag list. It owns the **tsconfig file split**, what the v22 template actually writes, and the
  compatibility *matrix* across versions. Link to `13b`/`14f`.
- **Topic 10 (Partial compilation)** is **Know** tier and `12f` is **Master** tier on the same
  subject. Topic 10's honest job is a short orientation page that says what a `ɵɵngDeclare*` call
  is, points at `12f` for the mechanism, and then covers the one thing `12f` does not: the
  **JIT-fallback error** a library hits when the linker did not run (§Chunk 18). Do not write a
  second Master page. Report the overlap rather than resolving it alone.
- **Topic 04** may reference `17c` for what a real v22 upgrade feels like, and must not repeat its
  seven-item table.

Relative links from topic 04's directory to topic 01's files take the form
`../01-compiler-with-a-framework-attached/12f-partial-compilation-and-the-linker.md`.
🔴 **`ls` it before writing it.**

### 0.5 🔴 Nothing links to topics 04–12 yet — you are free, and you are on the hook

`docs/angular/pages/phase-0-how-angular-runs/README.md` lists rows 04–12 as **bold text, not
links**, and says so explicitly:

> *"A title that is **not a link** has no page yet — a link to a page that does not exist is a
> broken link, and this repo builds with none. Each row becomes a link as its topic lands."*

So: **no filename is fixed by an inbound link.** Pick good ones. But the moment you create a
topic directory you must also make its row in that README a link, and every link you write from a
new chunk must resolve. `yarn linkcheck docs/angular` before reporting any file done.

`sidebar_position` = the chunk number. `sidebar_label` = `"NN · Short label"` with a **middle dot**
(matches every existing Phase 0 file).

### 0.6 The chunk plan — 21 chunks across nine topics

| Chunk | Topic | Suggested filename | Subject |
|---|---|---|---|
| 01 | 04 | `01-why-npm-install-is-not-an-upgrade.md` | The two halves of an Angular version bump |
| 02 | 04 | `02-one-major-at-a-time.md` | The rule, its verbatim error, and the cost of breaking it |
| 03 | 04 | `03-what-ng-update-actually-does.md` | The command's control flow, step by step |
| 04 | 04 | `04-the-ng-update-metadata-contract.md` | `packageGroup`, `migrations`, `requirements` |
| 05 | 04 | `05-the-peer-dependency-gate.md` | Forward/reverse peer validation and `--force` |
| 06 | 04 | `06-required-and-optional-migrations.md` | The two buckets, `--migrate-only`, `--name`, `--from`/`--to`, `-C` |
| 07 | 04 | `07-the-v22-migration-inventory.md` | Every migration v22 ships, automatic and on-demand |
| 08 | 05 | `01-what-angular-build-actually-runs.md` | esbuild → rolldown → Vite, each with its job |
| 09 | 05 | `02-the-webpack-builders-are-deprecated.md` | The deprecation, the compatibility ladder, the migration |
| 10 | 06 | `01-the-generated-angular-json.md` | The file the schematic writes, field by field |
| 11 | 06 | `02-configurations-file-replacements-budgets.md` | The three fields you actually edit |
| 12 | 07 | `01-the-typescript-peer-pin.md` | `>=6.0 <6.1`, the compatibility matrix, and TS 7 on npm |
| 13 | 07 | `02-the-tsconfig-split.md` | Three files, what each sets, and TS 6's `strict` default |
| 14 | 08 | `01-the-file-tree-ng-new-writes.md` | The tree, from the schematic templates |
| 15 | 08 | `02-the-generated-files-line-by-line.md` | `main.ts`, `app.config.ts`, `app.routes.ts`, `app.ts` |
| 16 | 08 | `03-the-ng-new-option-matrix.md` | Every flag, its default, and what it changes |
| 17 | 09 | `01-the-release-train.md` | 🔴 **12-month majors** and 24-month support |
| 18 | 09 | `02-reading-a-changelog.md` | v22.0.0's breaking-change list as a worked example |
| 19 | 10 | `01-partial-compilation-in-one-page.md` | Orientation + the JIT-fallback error (see §0.4) |
| 20 | 11 | `01-jit-vs-aot.md` | Where JIT survives and why it is not a deployment option |
| 21 | 12 | `01-dev-mode-only-behaviour.md` | `ngDevMode`, `isDevMode()`, `provideNgReflectAttributes()` |

🔴 **Every one of these will split past 300 lines.** Topic 03 planned 17 chunks and every single
one became 5–10 files. Plan the concept boundary, then let the file count fall out.

### 0.7 Vocabulary — get these right once

- **schematic** — a code generator/transformer shipped inside an npm package, run by
  `@angular-devkit/schematics`. `ng generate` runs one; `ng update` runs a special kind called a
  **migration**.
- **migration** — a schematic with a `version` field, listed in a package's migration collection,
  which `ng update` runs automatically when crossing that version.
- **builder** — the unit `ng build`/`ng serve`/`ng test` actually invoke, named
  `<package>:<builder-name>` (e.g. `@angular/build:application`). Run by **Architect**.
- **target** — a named entry under a project's `targets` (or legacy `architect`) in `angular.json`
  that pairs a builder with options.
- **`packageGroup`** — the `ng-update` field naming the packages that must move together.
- **partial compilation / the linker** — see §0.4; owned by topic 01 chunk 12f.

---

## Chunk 01 — Why `npm install` is not an upgrade

### 01.1 The thesis, and the evidence for it

An Angular major version bump has **two halves**, and `npm install` does one of them.

1. **Version numbers in `package.json` and the lockfile.** `npm install` does this.
2. **Rewrites to your own source files.** `npm install` cannot do this, has no idea it is needed,
   and will leave you with a project that installs cleanly and does not compile.

The proof that half 2 exists is that Angular ships the rewrites as code, in the packages
themselves. `@angular/core@22.1.5`'s own `package.json` on npm carries:

```json
"ng-update": {
  "migrations": "./schematics/migrations.json",
  "packageGroup": ["@angular/core", "@angular/bazel", "@angular/common", "@angular/compiler",
    "@angular/compiler-cli", "@angular/animations", "@angular/elements",
    "@angular/platform-browser", "@angular/platform-browser-dynamic", "@angular/forms",
    "@angular/platform-server", "@angular/upgrade", "@angular/router",
    "@angular/language-service", "@angular/localize", "@angular/service-worker"]
}
```

Source: `https://registry.npmjs.org/@angular/core/22.1.5` (read 2026-09-09).

That `migrations` path points at a file of schematics that edit *your* `.ts` files. `npm install`
never opens it.

### 01.2 The framework's own commitment, verbatim

angular.dev, *Angular versioning and releases*, under **Breaking change policy and update paths**:

> *"Support update automation via the `ng update` command. It provides code transformations which
> we often have tested ahead of time over hundreds of thousands of projects at Google"*
> — https://angular.dev/reference/releases

That sentence is the whole chunk's argument in the framework's own words: the migrations are not a
convenience, they are how Angular discharges its own breaking-change obligation.

### 01.3 What the command's own help says it is for

`ng update`'s `describe` string, verbatim from the CLI source:

```ts
command = 'update [packages..]';
describe = 'Updates your workspace and its dependencies. See https://update.angular.dev/.';
```

Source: [`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts).

Note **"your workspace *and* its dependencies"** — the workspace comes first in the sentence.

And its long description, verbatim and complete
([`long-description.md`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/long-description.md)):

> *"Perform a basic update to the current stable release of the core framework and CLI by running
> the following command."*
>
> ```
> ng update @angular/cli @angular/core
> ```
>
> *"To update to the next beta or pre-release version, use the `--next` option."*
>
> *"To update from one major version to another, use the format"*
>
> ```
> ng update @angular/cli@^<major_version> @angular/core@^<major_version>
> ```
>
> *"We recommend that you always update to the latest patch version, as it contains fixes we
> released since the initial major release. For example, use the following command to take the
> latest 21.x.x version and use that to update."*
>
> ```
> ng update @angular/cli@^21 @angular/core@^21
> ```
>
> *"For detailed information and guidance on updating your application, see the interactive
> [Angular Update Guide](/update-guide)."*

🔴 **Two things to draw out of that.** First, `@angular/cli` is named *before* `@angular/core` in
every example — the CLI is what runs the migrations, so it moves first. Second, the recommendation
is `@^21`, **a caret range on the major, not a bare major** — because the latest patch of a major
contains fixes the `.0` release did not.

### 01.4 What a bare `ng update` prints, from the source that prints it

Run with no package names, `ng update` reports rather than changes. The exact strings, from
`printUpdateUsageMessage` in
[`update-resolver.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/update-resolver.ts):

```ts
if (packagesToUpdate.length == 0) {
  logger.info('We analyzed your package.json and everything seems to be in order. Good work!');
  return;
}

logger.info('We analyzed your package.json, there are some packages to update:\n');
…
logger.info(
  '  ' + ['Name', 'Version', 'Command to update'].map((x, i) => x.padEnd(pads[i])).join(''),
);
…
logger.info(
  `\nThere might be additional packages which don't provide 'ng update' capabilities that are outdated.\n` +
    `You can update the additional packages by running the update command of your package manager.`,
);
```

⚠️ **Do not render this as a fake terminal block.** There was no sandbox. Quote the strings inline
as backticked phrases, or show the source as above and say it is the source. The authoring
contract forbids ` ```console ` fences outright.

The row for each package is built as:

```ts
return [name, `${info.installed.version} -> ${version} `, command];
```

and the command column is:

```ts
let command = `ng update ${name}`;
if (!tag) {
  command += `@${semver.parse(version)?.major || version}`;
} else if (tag == 'next') {
  command += ' --next';
}
```

🔴 **That `if (!tag)` branch is the one worth explaining.** `tag` is emptied a few lines earlier
precisely when the installed major is more than one behind the latest — so the printed advice
becomes `ng update @angular/core@23` rather than `ng update @angular/core`. **The report tells you
to take one major, not the latest.** See Chunk 02.

### 01.5 Which packages even appear in that report

Only ones that opted in:

```ts
const packagesToUpdate = mappedPackages
  .filter(
    ({ info, version, target }) =>
      target?.['ng-update'] && semver.compare(info.installed.version, version) < 0,
  )
```

Same file. **No `ng-update` key in the manifest → the package is invisible to `ng update`**, which
is exactly what the closing "there might be additional packages" sentence is apologising for.

### 01.6 Gotchas to write (symptom-first)

- **Symptom:** `npm install @angular/core@latest` succeeds, then `ng build` produces hundreds of
  template errors. **Cause:** half 2 never ran; the source rewrites Angular ships as migrations
  were skipped. **Fix:** revert the lockfile and `package.json`, then `ng update @angular/cli@^22
  @angular/core@^22`. Show the revert.
- **Symptom:** `ng update` says "everything seems to be in order" while a dependency is visibly
  outdated. **Cause:** that dependency has no `ng-update` key, so it is filtered out of the report
  (§01.5). **Fix:** update it with the package manager directly.
- **Symptom:** `ng update @angular/core` without `@angular/cli`. **Cause/Fix:** the CLI runs the
  migrations; the documented invocation names both, CLI first (§01.3).
- **Symptom:** `ng update @angular/cli@22` pulls 22.0.0 rather than 22.1.7. **Cause:** a bare major
  is a range with a floor; the docs recommend `@^22`. **Fix:** show both forms.

### 01.7 Interview questions

- **★ Why can a framework not just use semver and let `npm install` do the upgrade?** Because a
  breaking change in a compiler-backed framework changes the meaning of *your* source, not only the
  library's API surface. Angular's answer is to ship the rewrite as executable code and commit to
  it in the release policy (§01.2).
- **What does `ng update` with no arguments do?** Nothing to your project. It analyses
  `package.json` and prints a table of what could move and the exact command for each (§01.4).
- **Why does the printed command sometimes carry a version and sometimes not?** Because the
  resolver refuses to advise a multi-major jump and names the next major explicitly (§01.4).
- **A library in your dependencies never shows up in `ng update`'s report. Is it up to date?**
  Unknown — it simply has no `ng-update` metadata (§01.5).

---

## Chunk 02 — One major at a time

### 02.1 🔴 The error, verbatim — this is the chunk's spine

From
[`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts),
inside `updatePackagesAndMigrate`, copied exactly:

```ts
if (ANGULAR_PACKAGES_REGEXP.test(node.name)) {
  const { name, version } = node;
  const toBeInstalledMajorVersion = +manifest.version.split('.')[0];
  const currentMajorVersion = +version.split('.')[0];

  if (toBeInstalledMajorVersion - currentMajorVersion > 1) {
    // Only allow updating a single version at a time.
    if (currentMajorVersion < 6) {
      // Before version 6, the major versions were not always sequential.
      // Example @angular/core skipped version 3, @angular/cli skipped versions 2-5.
      logger.error(
        `Updating multiple major versions of '${name}' at once is not supported. Please migrate each major version individually.\n` +
          `For more information about the update process, see https://update.angular.dev/.`,
      );
    } else {
      const nextMajorVersionFromCurrent = currentMajorVersion + 1;

      logger.error(
        `Updating multiple major versions of '${name}' at once is not supported. Please migrate each major version individually.\n` +
          `Run 'ng update ${name}@${nextMajorVersionFromCurrent}' in your workspace directory ` +
          `to update to latest '${nextMajorVersionFromCurrent}.x' version of '${name}'.\n\n` +
          `For more information about the update process, see https://update.angular.dev/?v=${currentMajorVersion}.0-${nextMajorVersionFromCurrent}.0`,
      );
    }

    return 1;
  }
}
```

Quotable sentence, exact: **`Updating multiple major versions of '<name>' at once is not supported.
Please migrate each major version individually.`**

Note the gate is `> 1`, so **one major ahead is allowed and two is refused**. And the guard is
scoped by:

```ts
export const ANGULAR_PACKAGES_REGEXP = /^@(?:angular|nguniversal)\//;
```

— [`utilities/constants.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/constants.ts),
whose own doc comment reads:

> *"Regular expression to match Angular packages. Checks for packages starting with `@angular/` or
> `@nguniversal/`."*

🔴 **So a third-party library is not guarded.** `ng update some-lib@5` from `some-lib@2` is
attempted. That is a real gotcha and belongs on the page.

### 02.2 The same rule, from the documentation side

angular.dev, *Angular versioning and releases*, verbatim:

> *"You can `ng update` to any version of Angular, provided that the following criteria are met:
> The version you want to update **to** is supported. The version you want to update **from** is
> within one major version of the version you want to upgrade to."*
>
> *"For example, you can update from version 11 to version 12, provided that version 12 is still
> supported. If you want to update across multiple major versions, perform each update one major
> version at a time. For example, to update from version 10 to version 12: Update from version 10
> to version 11. Update from version 11 to version 12."*
> — https://angular.dev/reference/releases

### 02.3 Why the rule exists — argue it from the migration range, not from vibes

`ng update` selects migrations by a semver range built from the *installed* version and the
*target* version. From
[`utilities/migration.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/migration.ts):

```ts
const migrationRange = new semver.Range(
  '>' + (semver.prerelease(from) ? from.split('-')[0] + '-0' : from) + ' <=' + to.split('-')[0],
);
```

and then, per schematic in the collection:

```ts
description.version = coerceVersionNumber(description.version);
if (!description.version) {
  continue;
}

if (semver.satisfies(description.version, migrationRange, { includePrerelease: true })) {
  (description.optional ? optionalMigrations : requiredMigrations).push(…);
}
```

**Two consequences to draw out:**

1. The migrations for a skipped major are still *selected* by a two-major range — `>20.0.0
   <=22.0.0` matches both the v21 and v22 migrations. So the failure is not "the migrations get
   lost".
2. The failure is that **migration N+2 runs against source that migration N+1 has not yet
   rewritten**, and the migrations are only sorted by version, not composed:
   ```ts
   function compareMigrations(a, b) { return semver.compare(a.version, b.version); }
   ```
   Each is written assuming the previous major's shape. Angular's own guard is the cheaper answer
   than making every migration idempotent across two majors.

⚠️ **Say that consequence as an inference from the code, not as a quoted rule.** I found no
documentation sentence stating *why* — see §99.4.

### 02.4 The escape hatch the CLI gives itself: a temporary newer CLI

The one place `ng update` does reach forward is the CLI binary itself. From `cli.ts`:

```ts
if (!disableVersionCheck && options.packages?.length) {
  const cliVersionToInstall = await checkCLIVersion(
    options.packages, logger, packageManager, options.next,
  );

  if (cliVersionToInstall) {
    logger.warn(
      'The installed Angular CLI version is outdated.\n' +
        `Installing a temporary Angular CLI versioned ${cliVersionToInstall} to perform the update.`,
    );

    return runTempBinary(
      `@angular/cli@${cliVersionToInstall}`, packageManager, process.argv.slice(2),
    );
  }
}
```

Quotable, exact: **`The installed Angular CLI version is outdated.`** /
**`Installing a temporary Angular CLI versioned <v> to perform the update.`**

And the version it picks, with the reasoning comment intact
([`utilities/cli-version.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/cli-version.ts)):

```ts
export function getCLIUpdateRunnerVersion(
  packagesToUpdate: string[] | undefined,
  next: boolean,
): string | number {
  if (next) {
    return 'next';
  }

  const updatingAngularPackage = packagesToUpdate?.find((r) => ANGULAR_PACKAGES_REGEXP.test(r));
  if (updatingAngularPackage) {
    // If we are updating any Angular package we can update the CLI to the target version because
    // migrations for @angular/core@13 can be executed using Angular/cli@13.
    // This is same behaviour as `npx @angular/cli@13 update @angular/core@13`.

    // `@angular/cli@13` -> ['', 'angular/cli', '13']
    // `@angular/cli` -> ['', 'angular/cli']
    const tempVersion = coerceVersionNumber(updatingAngularPackage.split('@')[2]);

    return semver.parse(tempVersion)?.major ?? 'latest';
  }

  // When not updating an Angular package we cannot determine which schematic runtime the migration should to be executed in.
  // Typically, we can assume that the `@angular/cli` was updated previously.
  // Example: Angular official packages are typically updated prior to NGRX etc...
  // Therefore, we only update to the latest patch version of the installed major version of the Angular CLI.

  // This is important because we might end up in a scenario where locally Angular v12 is installed, updating NGRX from 11 to 12.
  // We end up using Angular ClI v13 to run the migrations if we run the migrations using the CLI installed major version + 1 logic.
  return VERSION.major;
}
```

🔴 **This is the fact that resolves the chicken-and-egg question every reader has**: "how does my
v21 CLI know how to run v22's migrations?" It does not — it downloads a v22 CLI to a temp
directory and re-execs itself under it. `runTempBinary` in the same file spawns it with:

```ts
const { status, error } = spawnSync(process.execPath, [binPath, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NG_DISABLE_VERSION_CHECK: 'true',
    NG_CLI_ANALYTICS: 'false',
  },
});
```

with `NG_DISABLE_VERSION_CHECK` set so the child does not recurse.

### 02.5 The clean-tree precondition

Before it will touch anything, `ng update` demands a clean working tree — from `cli.ts`'s yargs
`.check()`:

```ts
if (packages?.length && !checkCleanGit(this.context.root)) {
  if (allowDirty) {
    logger.warn(
      'Repository is not clean. Update changes will be mixed with pre-existing changes.',
    );
  } else {
    throw new CommandModuleError(
      'Repository is not clean. Please commit or stash any changes before updating.',
    );
  }
}
```

Quotable, exact: **`Repository is not clean. Please commit or stash any changes before updating.`**
The opt-out is `--allow-dirty`, whose own description is
*"Whether to allow updating when the repository contains modified or untracked files."*

`checkCleanGit` is scoped to the workspace root, not the whole repo — the doc comment says so:

> *"Checks if the git repository is clean. This function only checks for changes that are within
> the specified root directory. Changes outside the root directory are ignored."*
> — [`utilities/git.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/git.ts)

🔴 **Useful monorepo fact**: a dirty sibling package elsewhere in the repo does not block the
update.

### 02.6 Gotchas to write

- **Symptom:** `Updating multiple major versions of '@angular/core' at once is not supported.`
  **Cause:** target major − installed major > 1. **Fix:** the error names the exact next command;
  show the loop of `ng update @angular/cli@N @angular/core@N` for each N.
- **Symptom:** a third-party library upgraded three majors in one `ng update` and its migrations
  produced nonsense. **Cause:** the guard only matches `@angular/` and `@nguniversal/` (§02.1).
  **Fix:** step it manually, one major per run.
- **Symptom:** `Repository is not clean.` in CI. **Cause:** generated files or an untracked
  artefact inside the workspace root. **Fix:** `.gitignore` them, or `--allow-dirty` with the
  warning understood.
- **Symptom:** `ng update` appears to hang, then a different CLI version's output appears.
  **Cause:** the temporary-CLI re-exec of §02.4. **Fix:** none needed — but explain it, because it
  is why `ng --version` afterwards disagrees with what ran.
- **Symptom:** you are on v19, want v22, and v19 is out of support. **Cause:** three majors, and
  §02.2's first criterion ("the version you want to update **to** is supported") is about the
  target, not the source. **Fix:** 19 → 20 → 21 → 22, three runs; and read `17c` in topic 01 for
  what the last hop costs.

### 02.7 Interview questions

- **★ Why does Angular refuse a two-major `ng update` when the migrations for both majors would be
  selected anyway?** Because migrations are ordered by version but each assumes the previous
  major's source shape; running N+2 against un-migrated source is worse than refusing (§02.3).
  Present the "worse than refusing" half as reasoning, not as a quoted rule.
- **★ Your CLI is v21 and you are updating to v22. Which CLI runs the v22 migrations?** A v22 CLI
  the command installs into a temporary directory and re-execs (§02.4).
- **Is the one-major rule enforced for every dependency?** No — only for `@angular/*` and
  `@nguniversal/*` (§02.1).
- **Why does `ng update` insist on a clean tree?** So the diff it produces is reviewable and
  revertible; the check is scoped to the workspace root only (§02.5).
- **What is the difference between `ng update @angular/core@22` and `@^22`?** The documented advice
  is the caret form, because it takes the latest patch of the major rather than `.0` (§01.3).

---

## Chunk 03 — What `ng update` actually does, step by step

### 03.1 The full option surface, verbatim from the builder

From
[`cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts):

| Option | Type | Default | Description (verbatim) |
|---|---|---|---|
| `packages` (positional, array) | string | — | *"The names of package(s) to update."* |
| `--force` | boolean | `false` | *"Ignore peer dependency version mismatches."* |
| `--next` | boolean | `false` | *"Use the prerelease version, including beta and RCs."* |
| `--migrate-only` | boolean | — | *"Only perform a migration, do not update the installed version."* |
| `--name` | string | — | *"The name of the migration to run. Only available when a single package is updated."* |
| `--from` | string | — | *"Version from which to migrate from. Only available when a single package is updated, and only with 'migrate-only'."* |
| `--to` | string | — | *"Version up to which to apply migrations. Only available when a single package is updated, and only with 'migrate-only' option. Requires 'from' to be specified. Default to the installed version detected."* |
| `--allow-dirty` | boolean | `false` | *"Whether to allow updating when the repository contains modified or untracked files."* |
| `--verbose` | boolean | `false` | *"Display additional details about internal operations during execution."* |
| `--create-commits` / `-C` | boolean | `false` | *"Create source control commits for updates and migrations."* |

Two constraints encoded in the builder, worth stating:

```ts
.middleware((argv) => {
  if (argv.name) {
    argv['migrate-only'] = true;
  }
  …
})
```

— **`--name` implies `--migrate-only`.** And:

```ts
if (migrateOnly) {
  if (packages?.length !== 1) {
    throw new CommandModuleError(
      `A single package must be specified when using the 'migrate-only' option.`,
    );
  }
}
```

Quotable, exact: **`A single package must be specified when using the 'migrate-only' option.`**

`--name` also carries `conflicts: ['to', 'from']`; `--from` carries `implies: ['migrate-only']`;
`--to` carries `implies: ['from', 'migrate-only']`.

### 03.2 The order of operations — read off the source, not invented

1. **Version check / temp-CLI re-exec** (§02.4).
2. **Parse each package identifier**, rejecting non-registry ones:
   ```ts
   if (!packageIdentifier.registry) {
     logger.error(`Package '${request}' is not a registry package identifer.`);
     return 1;
   }
   ```
   (⚠️ the typo *"identifer"* is in the source — quote it as it is or paraphrase, do not silently
   correct it inside a `> *"…"*` block.)
   Duplicates are rejected too: **`Duplicate package '<name>' specified.`**
3. **Resolve a bare name to a tag:**
   ```ts
   if (packageIdentifier.rawSpec === '*') {
     packageIdentifier.fetchSpec = options.next ? 'next' : 'latest';
     packageIdentifier.type = 'tag';
   }
   ```
4. **Report the package manager and collect dependencies:**
   ```ts
   logger.info(`Using package manager: ${colors.gray(packageManager.name)}`);
   logger.info('Collecting installed dependencies...');
   const rootDependencies = await packageManager.getProjectDependencies();
   logger.info(`Found ${rootDependencies.size} dependencies.`);
   ```
5. **With no packages named → report only** and return 0 (Chunk 01 §01.4).
6. **Validate each package is actually a dependency:** **`Package '<name>' is not a dependency.`**
   And skip no-ops: **`Package '<name>' is already at '<v>'.`** /
   **`Package '<name>' is already up to date.`**
7. **`logger.info('Fetching dependency metadata from registry...')`**, then the one-major guard
   (Chunk 02).
8. **Resolve the plan** (`resolveUserUpdatePlan`) — peer validation lives here (Chunk 05).
9. **Back up `package.json` in memory**, then `applyUpdatePlan` writes the new ranges.
10. **Two Listr tasks, titled exactly:** `'Cleaning node modules directory'` and
    `'Installing packages'`.
11. **Optionally commit** the dependency change.
12. **Run migrations** (Chunk 06).

### 03.3 How the version ranges are rewritten — the detail nobody expects

`applyUpdatePlan` in
[`update-resolver.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/update-resolver.ts):

```ts
const updateDependency = (deps: Record<string, string>, name: string, newVersion: string) => {
  const oldVersion = deps[name];
  const aliasPrefix = 'npm:';

  // If the dependency uses an npm package alias (e.g., "npm:registry-name@version-range"),
  // parse and reconstruct the alias with the new target version while preserving
  // the original alias registry name and any version prefix character (like ^ or ~).
  if (oldVersion.startsWith(aliasPrefix)) {
    …
  } else {
    // Standard dependency formatting, keeping any semantic versioning operator prefix (e.g., ^ or ~).
    const execResult = /^[\^~]/.exec(oldVersion);
    deps[name] = `${execResult ? execResult[0] : ''}${newVersion}`;
  }
};
```

🔴 **Your range operator is preserved.** A `~22.0.0` stays a tilde; a pinned `22.0.0` stays pinned.
And the placement rules:

```ts
for (const [name, targetVersion] of plan.packagesToUpdate.entries()) {
  logger.info(`Updating package.json with dependency ${name} to version ${targetVersion}...`);

  if (packageJson.dependencies && packageJson.dependencies[name]) {
    updateDependency(packageJson.dependencies, name, targetVersion);
    if (packageJson.devDependencies) { delete packageJson.devDependencies[name]; }
    if (packageJson.peerDependencies) { delete packageJson.peerDependencies[name]; }
  } else if (packageJson.devDependencies && packageJson.devDependencies[name]) {
    updateDependency(packageJson.devDependencies, name, targetVersion);
    if (packageJson.peerDependencies) { delete packageJson.peerDependencies[name]; }
  } else if (packageJson.peerDependencies && packageJson.peerDependencies[name]) {
    updateDependency(packageJson.peerDependencies, name, targetVersion);
  } else {
    if (!packageJson.dependencies) { packageJson.dependencies = {}; }
    packageJson.dependencies[name] = `^${targetVersion}`;
  }
}
```

⚠️ **A package listed in both `dependencies` and `devDependencies` loses the `devDependencies`
entry.** That is a real, surprising, sourced behaviour — put it in Gotchas.

And the file is rewritten wholesale:

```ts
const eofMatches = packageJsonContent.match(/\r?\n$/);
const eof = eofMatches?.[0] ?? '';
const newContent = JSON.stringify(packageJson, null, 2) + eof;
```

🔴 **`JSON.stringify(…, null, 2)` — your `package.json` is reformatted to two-space indentation and
loses nothing but its formatting.** Only the trailing newline is preserved. Worth a gotcha for
teams with a four-space house style or a JSON linter in CI.

### 03.4 `node_modules` is deleted, but only for npm

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

And npm 7+ gets `--force` pushed at it, with the reason in the comment
([`cli-version.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/cli-version.ts)):

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

### 03.5 What happens when install fails — the rollback

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

Quotable, exact: **`Unable to install packages`** (the thrown `CommandError`) and
**`Restored package.json to its original state.`**

🔴 **The rollback restores `package.json` only.** `node_modules` has already been deleted (npm) and
the lockfile has been touched by the failed install. Say that plainly — it is the difference
between "safe" and "recoverable".

### 03.6 Gotchas to write

- **Symptom:** `package.json` diff is enormous after an update that changed two versions.
  **Cause:** the whole file is re-serialised with `JSON.stringify(…, null, 2)` (§03.3).
  **Fix:** commit a formatting-only commit first, or set the repo's formatter to two spaces.
- **Symptom:** a package vanished from `devDependencies`. **Cause:** it was in `dependencies` too,
  and the dev entry is deleted (§03.3). **Fix:** re-add it deliberately, or de-duplicate before
  updating.
- **Symptom:** `Unable to install packages`, and now `node_modules` is gone. **Cause:** the clean
  task ran before the install task; only `package.json` is rolled back (§03.5). **Fix:** `git
  checkout` the lockfile and reinstall.
- **Symptom:** `ng update` is much slower on npm than on pnpm. **Cause:** the `node_modules` wipe
  is npm-only (§03.4).
- **Symptom:** `Package 'foo' is not a registry package identifer.` **Cause:** a git or file
  specifier was passed. **Fix:** only registry identifiers are supported.

### 03.7 Interview questions

- **★ Walk through what `ng update @angular/cli@^22 @angular/core@^22` does, in order.** §03.2.
- **Does `ng update` change your `package.json` formatting?** Yes — it re-serialises the whole file
  at two-space indentation, preserving only the trailing newline (§03.3).
- **If the install step fails, what state is the project in?** `package.json` restored,
  `node_modules` deleted (on npm), lockfile modified (§03.5).
- **Why does `ng update` delete `node_modules` on npm and not on pnpm or yarn?** Stated as a
  behaviour in the skip condition; the reason is not stated in the source (§99.5).

---

## Chunk 04 — The `ng-update` metadata contract

### 04.1 The three fields, from the interface that models them

[`update-resolver.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/update-resolver.ts):

```ts
export interface UpdateMetadata {
  packageGroupName?: string;
  packageGroup: { [packageName: string]: string };
  requirements: { [packageName: string]: string };
  migrations?: string;
}
```

### 04.2 `packageGroup` — both shapes, both real

**Array form**, `@angular/core@22.1.5` (§01.1) — sixteen packages, no versions.

**Object form**, `@angular/cli@22.1.7`, verbatim from
`https://registry.npmjs.org/@angular/cli/22.1.7`:

```json
"ng-update": {
  "migrations": "@schematics/angular/migrations/migration-collection.json",
  "packageGroup": {
    "@angular/cli": "22.1.7",
    "@angular/ssr": "22.1.7",
    "@angular/build": "22.1.7",
    "@angular-devkit/core": "22.1.7",
    "@angular-devkit/architect": "0.2201.7",
    "@angular-devkit/schematics": "22.1.7",
    "@angular-devkit/build-angular": "22.1.7",
    "@angular-devkit/build-webpack": "0.2201.7"
  }
}
```

The resolver accepts either:

```ts
const packageGroupNames = Array.isArray(packageGroup)
  ? packageGroup
  : Object.keys(packageGroup);
```

🔴 **Two facts worth a paragraph each.**

1. **`ng update @angular/cli` moves eight packages, including `@angular/build`.** A reader who has
   only ever typed `ng update @angular/cli @angular/core` has never had to name `@angular/build`,
   and this is why.
2. **`@angular-devkit/architect` is `0.2201.7`, not `22.1.7`.** The `0.MAJORMINOR.PATCH` scheme —
   `0.` + `2201` (major 22, minor 01) + `.7` — is how the devkit packages that are not
   semver-locked to the framework are versioned. Same for `@angular-devkit/build-webpack`. If a
   reader ever wonders why one line of their `package.json` looks like a typo, this is the answer.

And when the metadata is malformed, verbatim:

```ts
logger.warn(`PackageGroup metadata for ${packageJson.name} is malformed. Ignoring.`);
```

### 04.3 `migrations` — a path, and the four ways it can be wrong

From `migrateOnly` in `cli.ts`, the whole validation chain, verbatim:

```ts
const updateMetadata = packageNode['ng-update'];
let migrations = updateMetadata?.migrations;
if (migrations === undefined) {
  logger.error('Package does not provide migrations.');
  return 1;
} else if (typeof migrations !== 'string') {
  logger.error('Package contains a malformed migrations field.');
  return 1;
} else if (path.posix.isAbsolute(migrations) || path.win32.isAbsolute(migrations)) {
  logger.error(
    'Package contains an invalid migrations field. Absolute paths are not permitted.',
  );
  return 1;
}

// Normalize slashes
migrations = migrations.replace(/\\/g, '/');

if (migrations.startsWith('../')) {
  logger.error(
    'Package contains an invalid migrations field. Paths outside the package root are not permitted.',
  );
  return 1;
}
```

Four exact strings for the error table: **`Package does not provide migrations.`** ·
**`Package contains a malformed migrations field.`** ·
**`Package contains an invalid migrations field. Absolute paths are not permitted.`** ·
**`Package contains an invalid migrations field. Paths outside the package root are not
permitted.`**

Note the two legal shapes, both live in v22: a **package-relative path**
(`./schematics/migrations.json`, `@angular/core`) and a **bare module specifier**
(`@schematics/angular/migrations/migration-collection.json`, `@angular/cli`). The resolution tries
the local path first and falls back to `require.resolve`:

```ts
const localMigrations = path.join(packagePath, migrations);
if (existsSync(localMigrations)) {
  migrations = localMigrations;
} else {
  // Try to resolve from package location.
  // This avoids issues with package hoisting.
  try {
    const packageRequire = createRequire(packagePath + '/');
    migrations = packageRequire.resolve(migrations, { paths: this.resolvePaths });
  } catch (e) { … }
}
```

with failure strings **`Migrations for package were not found.`** and
**`Unable to resolve migrations for package.  [<message>]`** (note the double space, it is in the
source).

### 04.4 🔴 The private-registry fallback — a v22-era detail worth banking

`ng update` will now re-read migration metadata off disk after installing, because some registries
strip it. The doc comment, verbatim, from `cli.ts`:

> *"Resolves migrations from installed package manifests on disk when they were omitted from the
> initial update plan.*
>
> *This fallback is necessary because private package registries (such as GitHub Packages)
> frequently strip custom non-npm metadata properties (like `ng-update`) from their remote registry
> API responses. By inspecting `node_modules/<package>/package.json` after installation, we ensure
> that any migration collections defined by the package are discovered and queued."*

```ts
export async function resolveFallbackMigrations(
  workspaceRoot: string,
  plan: UpdatePlan,
): Promise<{ package: string; collection: string; from: string; to: string }[]> {
```

**Symptom this explains:** on a private registry, `ng update` used to bump versions and silently
run zero migrations.

### 04.5 `requirements` — present in the type, unread by me

`UpdateMetadata.requirements` is declared (§04.1) and populated by `_getUpdateMetadata`, but I did
not read the code that *enforces* it and found no documentation page describing it. See §99.6.
**Name the field; do not describe its behaviour.**

### 04.6 `packageGroupName`, and why a report collapses sixteen rows into one

From `printUpdateUsageMessage`:

```ts
const packageGroupName =
  (ngUpdate?.['packageGroupName'] as string | undefined) ||
  packageGroupNames.find((n) => infoMap.has(n));

if (packageGroupName) {
  if (packageGroups.has(name)) {
    return null;
  }
  for (const groupName of packageGroupNames) {
    packageGroups.set(groupName, packageGroupName);
  }
  packageGroups.set(packageGroupName, packageGroupName);
  name = packageGroupName;
}
```

**That `return null` is why `ng update` prints one `@angular/core` row rather than sixteen
`@angular/*` rows.** It is a small thing that visibly shapes the output.

### 04.7 Gotchas to write

- **Symptom:** `ng update @angular/cli` also changed `@angular/build` and `@angular-devkit/*`.
  **Cause:** the CLI's `packageGroup` (§04.2). **Fix:** none — this is correct; explain it.
- **Symptom:** `@angular-devkit/architect` sits at `0.2201.7` while everything else is `22.1.7`.
  **Cause:** the `0.MAJORMINOR.PATCH` scheme (§04.2).
- **Symptom:** on a private registry, versions moved and no migration ran. **Cause:** the registry
  stripped `ng-update`. **Fix:** v22's on-disk fallback handles it (§04.4); on older CLIs, run
  `ng update <pkg> --migrate-only --from <old>` by hand.
- **Symptom:** `Package does not provide migrations.` from `--migrate-only`. **Cause:** no
  `ng-update.migrations` in the manifest (§04.3).
- **Symptom:** a library's migrations never run in a pnpm workspace. **Cause:** hoisting; the
  resolver's `createRequire(packagePath + '/')` fallback exists for exactly this (§04.3).

### 04.8 Interview questions

- **★ What is `packageGroup` and why does it exist?** §04.2 — one command moves a set that must
  stay version-locked, so a partial upgrade is not expressible.
- **★ How does a third-party library opt into `ng update`?** By adding `ng-update.migrations` (and
  usually `packageGroup`) to its published `package.json`, pointing at a migration collection
  (§04.3). No `ng-update` key → invisible (§01.5).
- **Why is `@angular-devkit/architect` versioned `0.2201.7`?** §04.2.
- **Your company's private registry serves Angular packages. Migrations stopped running. Why?**
  §04.4.

---

## Chunk 05 — The peer-dependency gate

### 05.1 Both directions are checked — the source, verbatim

`_validateForwardPeerDependencies` — *does the thing I am installing accept what else is here?*

```ts
if (!semver.satisfies(resolvedVersion, resolvedRange, { includePrerelease: true })) {
  logger.error(
    `Package ${JSON.stringify(name)} has an incompatible peer dependency to ` +
      `${JSON.stringify(peer)} (requires ${JSON.stringify(range)}, ` +
      `would install ${JSON.stringify(resolvedVersion)}).`,
  );
  error = error || !isOptional;
}
```

`_validateReversePeerDependencies` — *does anything already here reject what I am installing?*

```ts
if (!semver.satisfies(version, resolvedRange, { includePrerelease: next || undefined })) {
  logger.error(
    `Package ${JSON.stringify(installed)} has an incompatible peer dependency to ` +
      `${JSON.stringify(name)} (requires ${JSON.stringify(range)}, ` +
      `would install ${JSON.stringify(version)}).`,
  );
  error = error || !isOptional;
}
```

Both from
[`update-resolver.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/update-resolver.ts).

Message shape, exact:
**`Package "<A>" has an incompatible peer dependency to "<B>" (requires "<range>", would install
"<version>").`**

🔴 **`error = error || !isOptional`** — an **optional** peer mismatch is logged as an error but does
**not** fail the run. That is why you can see red text and still get an update. It is also why
`zone.js` (an optional peer of `@angular/core`) never blocks a zoneless project.

### 05.2 The gate itself

```ts
if (error && !force) {
  throw new Error(
    'Incompatible peer dependencies found. See above for details. ' +
      'You can bypass this check using the --force option.',
  );
}
```

Quotable, exact: **`Incompatible peer dependencies found. See above for details. You can bypass
this check using the --force option.`**

### 05.3 🔴 The special case: `@angular/core` gets its peer range widened

This is the most interesting function in the file, and nothing in the documentation mentions it.
Verbatim:

```ts
export function angularMajorCompatGuarantee(range: string) {
  let newRange = semver.validRange(range);
  if (!newRange) {
    return range;
  }
  let major = 1;
  while (!semver.gtr(major + '.0.0', newRange)) {
    major++;
    if (major >= 99) {
      return newRange;
    }
  }

  newRange = range;
  for (let minor = 0; minor < 20; minor++) {
    newRange += ` || ^${major}.${minor}.0-alpha.0 `;
  }

  return semver.validRange(newRange) || range;
}

const knownPeerCompatibleList: { [name: string]: PeerVersionTransform } = {
  '@angular/core': angularMajorCompatGuarantee,
};
```

**What it does, in prose:** find the lowest major *above* the declared range, then widen the range
to also accept every `^MAJOR.MINOR.0-alpha.0` for minors 0–19 of that major.

**Why it matters:** a library that declares `"@angular/core": "^21.0.0"` is, for the purposes of
`ng update` only, treated as if it also accepted `^22.0.0-alpha.0` … `^22.19.0-alpha.0`. So
third-party libraries do not block an Angular major update on the strength of a peer range they
have not yet bumped.

⚠️ **The name is the framework's own**: `angularMajorCompatGuarantee`. Use it, and be precise that
this is a **CLI-side allowance, not a promise the library made**. The library may still break.

🔴 **This does not widen the peer check your package manager runs afterwards.** The install step
separately forces npm 7+ (§03.4). Do not conflate the two.

### 05.4 The catalog error — monorepos with pnpm/yarn catalogs

Verbatim from the same file:

```ts
throw new Error(
  `The following packages to update are configured to use \`catalog:\`:\n` +
    `${updatesList}\n\n` +
    `Because catalogs are shared across the monorepo, 'ng update' cannot modify them directly.\n` +
    `Please perform the following steps to update:\n` +
    `  1. Manually update the versions for these packages in your catalog configuration file ` +
    `(e.g., pnpm-workspace.yaml or .yarnrc.yml).\n` +
    `  2. Run '${installCmd}' to install the updated versions.\n` +
    `  3. Run the following command(s) from the workspace root to execute the migration schematics:\n` +
    `${migrationCommands}`,
);
```

and the command it suggests for step 3:

```ts
const fromVer = pkg.current === 'unknown' ? '<current-version>' : pkg.current;
return `  ng update ${pkg.name} --migrate-only --from ${fromVer}`;
```

🔴 **This is the canonical answer to "how do I update Angular in a pnpm-catalog monorepo": you do
the version half yourself and hand the migration half back to `ng update --migrate-only --from`.**
It is worth its own worked example.

### 05.5 Deprecated versions are avoided, but not refused

```ts
const sorted = semver.rsort(candidates);

for (const version of sorted) {
  const manifest = await registryClient.getManifest(metadata.name, version);
  if (manifest && !manifest.deprecated) {
    return version;
  }
}

// Fallback to deprecated versions if no non-deprecated version satisfies
for (const version of sorted) {
  const manifest = await registryClient.getManifest(metadata.name, version);
  if (manifest) {
    return version;
  }
}
```

**Relevance to this corpus:** `@angular/platform-browser-dynamic@22.1.5` and
`@angular-devkit/build-angular@22.1.7` are both npm-deprecated (§Chunk 09, §Chunk 20). This is the
code that decides what happens when the only satisfying version is a deprecated one — it installs
it anyway.

### 05.6 A minimum release age is honoured, if configured

```ts
function isReleaseAgeSatisfied(
  registryClient: RegistryClient,
  metadata: PackageMetadata,
  version: string,
): boolean {
  const minReleaseAge = registryClient.minReleaseAge;
  if (!minReleaseAge || !metadata.time) {
    return true;
  }
  const publishTimeStr = metadata.time[version];
  if (!publishTimeStr) { return true; }
  const publishTime = Date.parse(publishTimeStr);
  if (isNaN(publishTime)) { return true; }
  return Date.now() - publishTime >= minReleaseAge;
}
```

⚠️ **I did not find where `minReleaseAge` is configured from** (npm's `minimumReleaseAge`, an
`.npmrc` key, a CLI option — unknown). See §99.7. Bank the mechanism, not a configuration
instruction.

### 05.7 Gotchas to write

- **Symptom:** `Incompatible peer dependencies found.` **Cause:** a forward or reverse peer range
  is violated by the plan (§05.1). **Fix:** update the offending library first; `--force` only if
  you have read which peer and decided it is survivable. Show both.
- **Symptom:** red peer errors scroll past and the update completes anyway. **Cause:** every
  mismatch was on an **optional** peer (§05.1). **Fix:** none, but read them.
- **Symptom:** a library pinned to `^21` did not block the v22 update. **Cause:**
  `angularMajorCompatGuarantee` widened its range for the check (§05.3). **Fix:** verify the
  library actually supports v22; the CLI did not.
- **Symptom:** `'ng update' cannot modify them directly` in a pnpm workspace. **Cause:** `catalog:`
  entries (§05.4). **Fix:** the three-step recipe, quoted.
- **Symptom:** `ng update` installed a deprecated package. **Cause:** it was the only satisfying
  version (§05.5).

### 05.8 Interview questions

- **★ `ng update` reports an incompatible peer dependency. What are your options and what does each
  cost?** Update the library; wait; `--force` and own the mismatch. `--force` does not change what
  gets installed, only whether the check is fatal (§05.2).
- **★ Why doesn't every third-party library block an Angular major upgrade?**
  `angularMajorCompatGuarantee` (§05.3) — and it is a CLI allowance, not a library guarantee.
- **What is the difference between a forward and a reverse peer check here?** §05.1.
- **How do you run an Angular update in a pnpm-catalog monorepo?** §05.4.

---

## Chunk 06 — Required and optional migrations

### 06.1 The two buckets, and how a migration lands in one

From
[`utilities/migration.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/migration.ts):

```ts
export interface MigrationSchematicDescription extends SchematicDescription<
  FileSystemCollectionDescription,
  FileSystemSchematicDescription
> {
  version?: string;
  optional?: boolean;
  recommended?: boolean;
  documentation?: string;
}
```

```ts
(description.optional ? optionalMigrations : requiredMigrations).push(…);
```

**Four fields, four jobs:** `version` decides *whether it is in range*; `optional` decides *which
bucket*; `recommended` decides *whether its checkbox is pre-ticked*; `documentation` becomes a URL.

A migration with **no `version`** is skipped entirely:

```ts
description.version = coerceVersionNumber(description.version);
if (!description.version) {
  continue;
}
```

### 06.2 Required migrations — no prompt, and the exact banner

```ts
if (requiredMigrations.length) {
  logger.info(colors.cyan(`** Executing migrations of package '${packageName}' **\n`));
  requiredMigrations.sort(compareMigrations);
  const result = await executePackageMigrations(…);
  if (result === 1) { return 1; }
}
```

Quotable, exact: **`** Executing migrations of package '<name>' **`**

### 06.3 Optional migrations — the prompt, and the non-TTY behaviour

```ts
if (optionalMigrations.length) {
  logger.info(colors.magenta(`** Optional migrations of package '${packageName}' **\n`));
  optionalMigrations.sort(compareMigrations);
  const migrationsToRun = await getOptionalMigrationsToRun(logger, optionalMigrations, packageName);
  if (migrationsToRun?.length) {
    return executePackageMigrations(workflow, logger, migrationsToRun, packageName, commit);
  }
}
```

and:

```ts
logger.info(
  `This package has ${numberOfMigrations} optional migration${
    numberOfMigrations > 1 ? 's' : ''
  } that can be executed.`,
);

if (!isTTY()) {
  for (const migration of optionalMigrations) {
    const { title } = getMigrationTitleAndDescription(migration);
    logger.info(colors.cyan(figures.pointer) + ' ' + colors.bold(title));
    logger.info(colors.gray(`  ng update ${packageName} --name ${migration.name}`));
    logger.info('');
  }
  return undefined;
}

logger.info(
  'Optional migrations may be skipped and executed after the update process, if preferred.',
);
…
const answer = await askChoices(
  `Select the migrations that you'd like to run`,
  optionalMigrations.map((migration) => {
    const { title, documentation } = getMigrationTitleAndDescription(migration);
    return {
      name: `[${colors.white(migration.name)}] ${title}${documentation ? ` (${documentation})` : ''}`,
      value: migration.name,
      checked: migration.recommended,
    };
  }),
  null,
);
```

🔴 **In CI (no TTY) every optional migration is skipped and printed as a command to run later.**
That is a first-class fact: an automated `ng update` in a pipeline silently does *less* than the
same command on a laptop. Quotable strings:
**`This package has N optional migrations that can be executed.`** ·
**`Optional migrations may be skipped and executed after the update process, if preferred.`** ·
**`Select the migrations that you'd like to run`**.

`checked: migration.recommended` is why *some* boxes are pre-ticked.

### 06.4 How a migration's description becomes a title

```ts
function getMigrationTitleAndDescription(migration: MigrationSchematicDescription): {
  title: string;
  description: string;
  documentation?: string;
} {
  const [title, ...description] = migration.description.split('. ');

  return {
    title: title.endsWith('.') ? title : title + '.',
    description: description.join('.\n  '),
    documentation: migration.documentation
      ? new URL(migration.documentation, 'https://angular.dev').href
      : undefined,
  };
}
```

🔴 **The migration's `description` field is split on `'. '`: first sentence is the title, the rest
is the body.** That is why the descriptions in `migrations.json` read the way they do, and why one
of them (§07.2, `incremental-hydration`) has a stray hyphen — it was written to a format.

`documentation` is resolved **relative to `https://angular.dev`**, which is why the CLI's own
migration collection stores `"documentation": "tools/cli/build-system-migration"` rather than a
full URL.

### 06.5 What happens per migration — including the v22 formatting step

```ts
logger.info(colors.cyan(figures.pointer) + ' ' + colors.bold(title));
if (description) { logger.info('  ' + description); }

const { success, files } = await executeSchematic(
  workflow, logger, migration.collection.name, migration.name,
);
if (!success) { return 1; }

let modifiedFilesText: string;
switch (files.size) {
  case 0:  modifiedFilesText = 'No changes made'; break;
  case 1:  modifiedFilesText = '1 file modified'; break;
  default: modifiedFilesText = `${files.size} files modified`; break;
}

if (files.size) {
  try {
    await formatFiles(process.cwd(), files);
  } catch (error) {
    assertIsError(error);
    logger.warn(
      `WARNING: Formatting of files failed with the following error: ${error.message}`,
    );
  }
}

logger.info(`  Migration completed (${modifiedFilesText}).`);
```

🔴 **`formatFiles` — the migrated files are run through Prettier.** (`import { formatFiles } from
'../../../utilities/prettier';`) This matches `ng new` now scaffolding `prettier` as a
devDependency and writing a `.prettierrc` (§Chunk 14). Quotable:
**`Migration completed (N files modified).`** / **`No changes made`** /
**`WARNING: Formatting of files failed with the following error: <message>`**.

Failure strings from `executeSchematic`:
**`✖ Migration failed. See above for further details.`** (the `figures.cross` glyph) and
**`✖ Migration failed: <message>` / `  See "<logPath>" for further details.`**

### 06.6 `--create-commits`: one commit per migration

```ts
if (commit) {
  const commitPrefix = `${packageName} migration - ${migration.name}`;
  const commitMessage = migration.description
    ? `${commitPrefix}\n\n${migration.description}`
    : commitPrefix;
  const committed = commitChanges(logger, commitMessage);
  if (!committed) {
    // Failed to commit, something went wrong. Abort the update.
    return 1;
  }
}
```

Commit-message shape, exact: **`<package> migration - <migration-name>`**, with the migration's
full description as the body. And the dependency-bump commit, from `cli.ts`:

```ts
if (!commitChanges(logger, `Angular CLI update for packages - ${packagesToUpdate.join(', ')}`))
```

exact: **`Angular CLI update for packages - <pkg>, <pkg>`**.

The commit itself, from
[`utilities/git.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/git.ts):

```ts
export function createCommit(message: string) {
  // Stage entire working tree for commit.
  execGit(['add', '-A']);

  // Commit with the message passed via stdin to avoid bash escaping issues.
  execGit(['commit', '--no-verify', '-F', '-'], message);
}
```

⚠️ **`git add -A` and `--no-verify`.** Everything untracked in the tree is swept into the commit,
and your hooks do not run. That is exactly why the clean-tree precondition exists (§02.5), and it
is a gotcha worth naming.

Reporting strings: **`  No changes to commit after migration.`** ·
**`  Committed migration step (<short-hash>): <first line>.`** ·
**`  Failed to look up hash of most recent commit, continuing anyways.`**

### 06.7 `--migrate-only`, `--name`, `--from`, `--to` — the recovery surface

```ts
if (options.name) {
  return executeMigration(workflow, logger, packageName, migrations, options.name, options.createCommits);
}

const from = coerceVersionNumber(options.from);
if (!from) {
  logger.error(`"from" value [${options.from}] is not a valid version.`);
  return 1;
}

return executeMigrations(
  workflow, logger, packageName, migrations, from,
  options.to || packageNode.version, options.createCommits,
);
```

and, for a named migration that does not exist:

```ts
const name = collection.listSchematicNames().find((name) => name === migrationName);
if (!name) {
  logger.error(`Cannot find migration '${migrationName}' in '${packageName}'.`);
  return 1;
}
```

Quotable: **`Cannot find migration '<name>' in '<package>'.`** ·
**`"from" value [<v>] is not a valid version.`** ·
**`** Executing '<name>' of package '<package>' **`** ·
**`Package is not installed.`**

🔴 **`--to` defaults to the *installed* version**, not the latest. So
`ng update @angular/core --migrate-only --from 21.0.0` replays every migration in
`(21.0.0, <installed>]`.

`coerceVersionNumber` is worth showing, because it is why `--from 21` works:

```ts
export function coerceVersionNumber(version: string | undefined): string | undefined {
  if (!version) { return undefined; }

  if (!/^\d{1,30}\.\d{1,30}\.\d{1,30}/.test(version)) {
    const match = version.match(/^\d{1,30}(\.\d{1,30})*/);
    if (!match) { return undefined; }

    if (!match[1]) {
      version = version.substring(0, match[0].length) + '.0.0' + version.substring(match[0].length);
    } else if (!match[2]) {
      version = version.substring(0, match[0].length) + '.0' + version.substring(match[0].length);
    } else {
      return undefined;
    }
  }

  return semver.valid(version) ?? undefined;
}
```

`21` → `21.0.0`; `21.2` → `21.2.0`.

### 06.8 Gotchas to write

- **Symptom:** the CI upgrade did fewer transforms than the local one. **Cause:** no TTY → optional
  migrations skipped (§06.3). **Fix:** run the printed `ng update <pkg> --name <migration>`
  commands explicitly in the pipeline.
- **Symptom:** an unrelated stray file ended up in the migration commit. **Cause:** `git add -A`
  (§06.6). **Fix:** the clean-tree rule; do not use `--allow-dirty` with `-C`.
- **Symptom:** pre-commit hooks did not run on the migration commits. **Cause:** `--no-verify`
  (§06.6).
- **Symptom:** the whole file was reformatted by a migration that changed one line. **Cause:**
  `formatFiles` runs Prettier over every touched file (§06.5). **Fix:** adopt the scaffolded
  `.prettierrc`, or accept the diff.
- **Symptom:** you skipped an optional migration and want it back. **Fix:**
  `ng update <pkg> --name <migration>` — and note `--name` implies `--migrate-only` (§03.1).
- **Symptom:** `--migrate-only --from 21` did more than expected. **Cause:** `--to` defaults to the
  installed version, so the range is `(21.0.0, installed]` (§06.7).
- **Symptom:** `A single package must be specified when using the 'migrate-only' option.`
  **Cause/Fix:** §03.1.

### 06.9 Interview questions

- **★ What is the difference between a required and an optional migration, and who decides?** The
  `optional` flag in the package's own migration collection (§06.1); required run silently,
  optional prompt — and are skipped entirely without a TTY (§06.3).
- **★ You ran `ng update` in CI and the codebase came out differently from a local run. Why?**
  §06.3.
- **How do you re-run one migration after the fact?** `ng update <pkg> --name <migration>` (§06.7).
- **What exactly does `--create-commits` commit?** One commit per migration, message
  `<package> migration - <name>`, produced with `git add -A` and `--no-verify` (§06.6).
- **Why did a migration reformat files it did not otherwise change?** Prettier runs over every
  touched file (§06.5).

---

## Chunk 07 — The v22 migration inventory

### 07.1 Why an inventory belongs on a page at all

Because it turns "schematics rewrite your source" from an assertion into something the reader can
check, and because every entry names a v22 breaking change from the other direction. It is also
the cheapest possible cross-reference to topic 01's `17c-the-v22-upgrade-wall.md`.

### 07.2 `@angular/core`'s automatic migrations — the whole file, verbatim

[`packages/core/schematics/migrations.json`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/migrations.json)
at `v22.1.5`, complete:

```json
{
  "schematics": {
    "change-detection-eager": {
      "version": "22.0.0",
      "description": "Adds `ChangeDetectionStrategy.Eager` to all components.",
      "factory": "./bundles/change-detection-eager.cjs#migrate"
    },
    "http-xhr-backend": {
      "version": "22.0.0",
      "description": "Adds 'withXhr' to 'provideHttpClient' function calls when the 'HttpXhrBackend' is used. For more information see: https://angular.dev/api/common/http/withXhr",
      "factory": "./bundles/http-xhr-backend.cjs#migrate"
    },
    "strict-templates-default": {
      "version": "22.0.0",
      "description": "Adds 'strictTemplates: false' in tsconfig.json when not set.",
      "factory": "./bundles/strict-templates-default.cjs#migrate"
    },
    "can-match-snapshot-required": {
      "version": "22.0.0",
      "description": "Adds the required third argument to canMatch callsites.",
      "factory": "./bundles/can-match-snapshot-required.cjs#migrate"
    },
    "incremental-hydration": {
      "version": "22.0.0",
      "description": "Adds withNoIncrementalHydration() opt out to provideClientHydration() when incremental hydration is not enabled to retain pre-v22 behavior-.",
      "factory": "./bundles/incremental-hydration.cjs#migrate"
    },
    "strict-safe-navigation-narrow": {
      "version": "22.0.0",
      "description": "Disables the 'nullishCoalescingNotNullable & optionalChainNotNullable extended diagnostics.",
      "factory": "./bundles/strict-safe-navigation-narrow.cjs#migrate"
    },
    "model-output": {
      "version": "22.0.0",
      "description": "Migrate broken duplicate outputs",
      "factory": "./bundles/model-output.cjs#migrate"
    },
    "safe-optional-chaining": {
      "version": "22.0.0",
      "description": "Wraps optional chaining expressions in $safeNavigationMigration().",
      "factory": "./bundles/safe-optional-chaining.cjs#migrate"
    }
  }
}
```

🔴 **All eight are `22.0.0` and none is marked `optional`** — so **all eight run without asking**
on a v21 → v22 update. That is a strong, checkable claim and the best single argument in the whole
topic.

🔴 **Two of them exist to *undo* v22's new defaults**, and that is the interesting observation:
`strict-templates-default` writes `strictTemplates: false` and `strict-safe-navigation-narrow`
disables two extended diagnostics. Topic 01's `15e-what-changes-underneath-you.md` already covers
what to do about those two — **link, do not re-argue**.

⚠️ The stray `behavior-.` and the unbalanced quote in `'nullishCoalescingNotNullable &
optionalChainNotNullable` are in the source. Quote as-is; do not tidy inside a quote block.

### 07.3 The CLI's migrations — the whole file, verbatim

[`packages/schematics/angular/migrations/migration-collection.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/migrations/migration-collection.json)
at `v22.1.7`, complete:

```json
{
  "encapsulation": false,
  "schematics": {
    "add-istanbul-instrumenter": {
      "version": "22.0.0",
      "factory": "./add-istanbul-instrumenter/migration",
      "description": "Add 'istanbul-lib-instrument' to 'devDependencies' if Karma unit testing is used."
    },
    "use-application-builder": {
      "version": "22.0.0",
      "factory": "./use-application-builder/migration",
      "description": "Migrate application projects to the new build system. Application projects that are using the '@angular-devkit/build-angular' package's 'browser' and/or 'browser-esbuild' builders will be migrated to use the new 'application' builder. You can read more about this, including known issues and limitations, here: https://angular.dev/tools/cli/build-system-migration",
      "optional": true,
      "recommended": true,
      "documentation": "tools/cli/build-system-migration"
    },
    "migrate-karma-to-vitest": {
      "version": "22.0.0",
      "factory": "./migrate-karma-to-vitest/migration",
      "description": "Migrate projects using legacy Karma unit-test builder to the new unit-test builder with Vitest.",
      "optional": true
    },
    "trust-proxy-headers": {
      "version": "22.0.0",
      "factory": "./trust-proxy-headers/migration",
      "description": "Add 'trustProxyHeaders' configuration to 'AngularNodeAppEngine' or 'AngularAppEngine'. For more information see: https://angular.dev/best-practices/security#configuring-trusted-proxy-headers"
    },
    "update-workspace-config": {
      "version": "22.0.0",
      "factory": "./update-workspace-config/migration",
      "description": "Update the angular workspace configuration."
    }
  }
}
```

🔴 **This file is the perfect worked example of §06.1's four fields.** `use-application-builder` is
the only one carrying all three of `optional`, `recommended` and `documentation` — so it is the one
whose checkbox is pre-ticked and whose prompt line shows a `https://angular.dev/tools/cli/build-system-migration`
URL (§06.4). `migrate-karma-to-vitest` is optional and **not** recommended, so its box is empty.
The other three are required.

The documented way to run the big one by hand, verbatim from angular.dev:

> *"This migration is entirely optional for v18 and can also be run manually at anytime after an
> update via the following command:"*
>
> ```
> ng update @angular/cli --name use-application-builder
> ```
> — https://angular.dev/tools/cli/build-system-migration

### 07.4 The on-demand migrations — `ng generate`, not `ng update`

A second, larger family ships as **generators**, run by name whenever you like. The whole
collection, verbatim from
[`packages/core/schematics/collection.json`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/collection.json)
at `v22.1.5` (descriptions and aliases exact, `factory`/`schema` elided for width — say so if you
elide):

| Name | Aliases | Description (verbatim) |
|---|---|---|
| `standalone-migration` | `standalone` | *"Converts the entire application or a part of it to standalone"* |
| `inject-migration` | `inject` | *"Converts usages of constructor-based injection to the inject() function"* |
| `route-lazy-loading-migration` | `route-lazy-loading` | *"Updates route definitions to use lazy-loading of components instead of eagerly referencing them"* |
| `signal-input-migration` | `signal-inputs`, `signal-input` | *"Updates `@Input` declarations to signal inputs, while also migrating all relevant references."* |
| `signal-queries-migration` | `signal-queries`, `signal-query`, `signal-query-migration` | *"Updates query declarations to signal queries, while also migrating all relevant references."* |
| `output-migration` | `outputs` | *"Updates @output declarations to the functional equivalent, while also migrating all relevant references."* |
| `signals` | — | *"Combines all signals-related migrations into a single migration"* |
| `cleanup-unused-imports` | — | *"Removes unused imports from standalone components."* |
| `self-closing-tags-migration` | `self-closing-tag` | *"Updates the components templates to use self-closing tags where possible"* |
| `common-to-standalone-migration` | `common-to-standalone` | *"Replaces CommonModule with individual imports from @angular/common"* |
| `control-flow-migration` | `control-flow` | *"Converts the entire application to block control flow syntax"* |
| `ngclass-to-class-migration` | `ngclass-to-class` | *"Updates usages of `ngClass` directives to the `class` bindings where possible"* |
| `ngstyle-to-style-migration` | `ngstyle-to-style` | *"Updates usages of `ngStyle` directives to the `style` bindings where possible"* |
| `router-testing-module-migration` | — | *"Replaces deprecated RouterTestingModule with provideRouter() as recommended in the deprecation note"* |
| `service-migration` | `service` | *"Converts @Injectable to @Service where applicable"* |

Invocation shape: `ng generate @angular/core:<name>` (or any alias).

🔴 **`service-migration` is new in 22.1.** The CHANGELOG entry, verbatim:
*"feat | add migration from injectable to service"* under **`22.1.0 (2026-07-29)` → migrations**
([source](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md)). It converts `@Injectable`
to `@Service`. ⚠️ **`@Service` itself is Phase 6 material — name it, do not teach it here.**

⚠️ **`packages/core/schematics/migrations/` on disk holds twelve directories**, not the same twelve
as either list — it is the implementation directory shared by both collections:
`can-match-snapshot-required`, `change-detection-eager`, `http-xhr-backend`,
`incremental-hydration`, `model-output`, `output-migration`, `safe-optional-chaining`,
`self-closing-tags-migration`, `signal-migration`, `signal-queries-migration`,
`strict-safe-navigation-narrow`, `strict-templates-default`. Do not present it as a third list.

### 07.5 The published index of on-demand migrations is on angular.dev

`https://angular.dev/reference/migrations` is the catalogue page, and each entry has a "Migrate
now" action. ⚠️ **The page is client-rendered and I could enumerate only three entries from its
prerendered HTML** (NgStyle to Style Bindings, RouterTestingModule migration, CommonModule to
standalone imports). **Cite §07.4's `collection.json` as the authority for the full list**, and
cite the page as where a reader finds it with prose. See §99.1.

### 07.6 Gotchas to write

- **Symptom:** after v22, `tsconfig.json` contains `"strictTemplates": false` that nobody wrote.
  **Cause:** the required `strict-templates-default` migration (§07.2). **Fix:** topic 01's
  `15e-what-changes-underneath-you.md` — link it, and show the removal.
- **Symptom:** `withNoIncrementalHydration()` appeared in `app.config.ts`. **Cause:** the required
  `incremental-hydration` migration (§07.2). **Fix:** decide deliberately; topic 03's
  `11c-incremental-hydration-and-event-replay.md` covers the feature.
- **Symptom:** the Karma → Vitest migration never offered itself in CI. **Cause:** it is optional
  and not `recommended`, and optional migrations are skipped without a TTY (§06.3, §07.3).
- **Symptom:** `ng generate @angular/core:signals` did nothing on a file. **Cause:** these
  generators are best-effort ("where possible" appears in four descriptions). **Fix:** run, review,
  finish by hand.
- **Symptom:** you want to convert to standalone but the app is huge. **Fix:**
  `ng generate @angular/core:standalone` is scoped — topic 02's
  `09-the-standalone-migration-schematic.md` already documents its modes; link rather than repeat.

### 07.7 Interview questions

- **★ Name the two kinds of Angular migration and how you invoke each.** Version-triggered
  migrations in a package's migration collection, run by `ng update`; on-demand generators in the
  `ng generate` collection, run by name (§07.2–§07.4).
- **★ Two of v22's automatic migrations turn new behaviour off. Why would a framework ship that?**
  Because the alternative is a project that will not build at all on upgrade day; the migration
  buys the team a working build and a decision to make later (§07.2).
- **Which v22 migration is optional but pre-ticked, and why?** `use-application-builder` — it is
  `optional: true, recommended: true` (§07.3).
- **How would you re-run the build-system migration a year after upgrading?**
  `ng update @angular/cli --name use-application-builder` (§07.3).

---

## Chunk 08 — What `@angular/build` actually runs

### 08.1 🔴 The correction the syllabus needs: it is three tools, not two

The syllabus row says *"esbuild for output, Vite for the dev server"*. In v22.1 that is **one tool
short**. `@angular/build@22.1.7`'s own dependencies, verbatim from
[`packages/angular/build/package.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/package.json):

```json
"esbuild": "0.28.2",
"rolldown": "1.2.0",
"vite": "8.1.5",
"oxc-parser": "0.142.0",
"sass": "1.101.0",
"beasties": "0.4.3",
"piscina": "5.2.0",
"browserslist": "^4.26.0",
"magic-string": "1.0.0",
"@babel/core": "8.0.1",
"watchpack": "2.5.2"
```

and the file that says what rolldown is *for*, verbatim — the whole `@fileoverview` of
[`packages/angular/build/src/builders/application/chunk-optimizer.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/chunk-optimizer.ts):

> *"This file provides a function to optimize JavaScript chunks using rolldown. It is designed to be
> used after an esbuild build to further optimize the output. The main function, `optimizeChunks`,
> takes the result of an esbuild build, identifies the main browser entry point, and then uses
> rolldown to rebundle and optimize the chunks. This process can result in smaller and more
> efficient code by combining and restructuring the original chunks. The file also includes helper
> functions to convert rolldown's output into an esbuild-compatible metafile, allowing for
> consistent analysis and reporting of the build output."*

And it is **on by default**, from
[`src/utils/environment-options.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/environment-options.ts):

```ts
/**
 * Allows using Rolldown for chunk optimization instead of Rollup.
 * This is useful for debugging and testing scenarios.
 */
export const useRolldownChunks = parseTristate(process.env['NG_BUILD_CHUNKS_ROLLDOWN']) ?? true;
```

**When it landed:** `@angular/build` **22.1.0 (2026-07-29)**, CHANGELOG entry verbatim:
*"perf | default chunk optimization to use Rolldown"*
([`angular-cli` CHANGELOG](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md)). A
follow-up in **22.1.4 (2026-08-13)**: *"fix | set target for Rolldown dependency prebundling in Vite
dev server"* — so Rolldown reaches the dev server's prebundling too.

**The accurate one-liner for v22.1:** *esbuild compiles and bundles, Rolldown re-bundles the chunks,
Vite serves.* Say the `NG_BUILD_CHUNKS_ROLLDOWN` escape hatch exists and is documented in the source
as *"useful for debugging and testing scenarios"* — not as a supported production switch.

⚠️ **The environment variable is a source-level flag, not a documented CLI option.** I found no
angular.dev page for it. Present it as such.

### 08.2 Vite is the dev server and only the dev server — verbatim

> *"The usage of Vite in the Angular CLI is currently within a **development server capacity
> only**. Even without using the underlying Vite build system, Vite provides a full-featured
> development server with client side support that has been bundled into a low dependency npm
> package. This makes it an ideal candidate to provide comprehensive development server
> functionality. The current development server process uses the new build system to generate a
> development build of the application in memory and passes the results to Vite to serve the
> application. The usage of Vite, much like the Webpack-based development server, is encapsulated
> within the Angular CLI `dev-server` builder and currently cannot be directly configured."*
> — https://angular.dev/tools/cli/build-system-migration

🔴 **"currently cannot be directly configured"** is the sentence readers most need. There is no
`vite.config.ts` in an Angular app.

### 08.3 What the build system claims for itself

> *"In v17 and higher, the new build system provides an improved way to build Angular applications.
> This new build system includes: A modern output format using ESM, with dynamic import expressions
> to support lazy module loading. Faster build-time performance for both initial builds and
> incremental rebuilds. Newer JavaScript ecosystem tools such as `esbuild` and `Vite`. Integrated
> SSR and prerendering capabilities. Automatic global and component stylesheet hot replacement."*
>
> *"This new build system is stable and fully supported for use with Angular applications."*
> — https://angular.dev/tools/cli/build-system-migration

### 08.4 The builders `@angular/build` publishes — the whole manifest

[`packages/angular/build/builders.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/builders.json)
at `v22.1.7`, complete:

```json
{
  "builders": {
    "application": {
      "implementation": "./src/builders/application/index",
      "schema": "./src/builders/application/schema.json",
      "description": "Build an application."
    },
    "dev-server": {
      "implementation": "./src/builders/dev-server/index",
      "schema": "./src/builders/dev-server/schema.json",
      "description": "Execute a development server for an application."
    },
    "extract-i18n": {
      "implementation": "./src/builders/extract-i18n/index",
      "schema": "./src/builders/extract-i18n/schema.json",
      "description": "Extract i18n messages from an application."
    },
    "karma": {
      "implementation": "./src/builders/karma",
      "schema": "./src/builders/karma/schema.json",
      "description": "Run Karma unit tests."
    },
    "ng-packagr": {
      "implementation": "./src/builders/ng-packagr/index",
      "schema": "./src/builders/ng-packagr/schema.json",
      "description": "Build a library with ng-packagr."
    },
    "unit-test": {
      "implementation": "./src/builders/unit-test",
      "schema": "./src/builders/unit-test/schema.json",
      "description": "[EXPERIMENTAL] Run application unit tests."
    }
  }
}
```

🔴 **`unit-test` is labelled `[EXPERIMENTAL]` — and it is what `ng new` scaffolds as the `test`
target in v22** (§Chunk 10, §Chunk 16). State both facts side by side and let the reader draw the
conclusion; do not editorialise beyond what the two sources say.

### 08.5 The dev server's own option surface

From
[`src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json)
at `v22.1.7` — every property, with its real default:

| Option | Default | Description (verbatim, trimmed) |
|---|---|---|
| `buildTarget` | — | *"A build builder target to serve in the format of `project:target[:configuration]`…"* |
| `port` | `4200` | *"Port to listen on."* |
| `host` | `'localhost'` | *"Host to listen on."* |
| `proxyConfig` | — | *"Proxy configuration file."* |
| `ssl` / `sslKey` / `sslCert` | `false` / — / — | *"Serve using HTTPS."* |
| `allowedHosts` | `[]` | *"The hosts that the development server will respond to. **This option sets the Vite option of the same name.**"* |
| `define` | — | *"Defines global identifiers that will be replaced with a specified constant value…"* |
| `headers` | — | *"Custom HTTP headers to be added to all responses."* |
| `open` | `false` | *"Opens the url in default browser."* |
| `liveReload` | `true` | *"Whether to reload the page on change, using live-reload."* |
| `servePath` | — | *"The pathname where the application will be served."* |
| `hmr` | — | *"Enable hot module replacement. **Defaults to the value of 'liveReload'.** Currently, only global and component stylesheets…"* |
| `watch` | `true` | *"Rebuild on change."* |
| `poll` | — | *"Enable and define the file watching poll time period in milliseconds."* |
| `inspect` | `false` | *"Activate debugging inspector. This option only has an effect when 'SSR' or 'SSG' are enabled."* |
| `prebundle` | `true` | *"Enable and control the Vite-based development server's prebundling capabilities…"* |
| `verbose` | — | *"Adds more details to output logging."* |

🔴 **`allowedHosts` "sets the Vite option of the same name"** is the one place the schema admits Vite
by name — the seam is visible in exactly one option.

⚠️ **v22 breaking change on the port**, verbatim from the CLI CHANGELOG for `22.0.0`:
> *"The `@angular/build:dev-server (ng serve)` now assigns the highest priority to the `PORT`
> environment variable. This value will override any port configurations specified in `angular.json`
> or via the `--port` command-line flag. This includes the default port 4200."*

### 08.6 HMR, precisely — what it does and does not do

> *"While general JavaScript-based hot module replacement (HMR) is currently not supported, several
> more specific forms of HMR are available: global stylesheet (`styles` build option), component
> stylesheet (inline and file-based), component template (inline and file-based)."*
>
> *"The HMR capabilities are automatically enabled and require no code or configuration changes to
> use. Angular provides HMR support for both file-based (`templateUrl`/`styleUrl`/`styleUrls`) and
> inline (`template`/`styles`) component styles and templates."*
>
> *"If preferred, the HMR capabilities can be disabled by setting the `hmr` development server
> option to `false`. This can also be changed on the command line via: `ng serve --no-hmr`"*
> — https://angular.dev/tools/cli/build-system-migration

And the FOUC note, verbatim:

> *"With the development server, you may see a small Flash of Unstyled Content (FOUC) on startup as
> the server initializes. The development server attempts to defer processing of stylesheets until
> first use to improve rebuild times. This will not occur in builds outside the development
> server."*

### 08.7 Prebundling

> *"Prebundling provides improved build and rebuild times when using the development server. Vite
> provides prebundling capabilities that are enabled by default when using the Angular CLI. The
> prebundling process analyzes all the third-party project dependencies within a project and
> processes them the first time the development server is executed. This process removes the need to
> rebuild and bundle the project's dependencies each time a rebuild occurs or the development server
> is executed."*
>
> *"In most cases, no additional customization is required. However, some situations where it may be
> needed include: Customizing loader behavior for imports within the dependency such as the `loader`
> option; Symlinking a dependency to local code for development such as `npm link`; Working around
> an error encountered during prebundling of a dependency."*
>
> *"By default, `prebundle` is set to `true` but can be set to `false` to fully disable prebundling.
> However, excluding specific dependencies is recommended instead since rebuild times will increase
> with prebundling disabled."*
> — https://angular.dev/tools/cli/build-system-migration

with the config shape, quoted from the same page:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "prebundle": {
      "exclude": ["some-dep"]
    }
  }
}
```

### 08.8 Gotchas to write

- **Symptom:** `ng serve` ignores `--port`. **Cause:** the `PORT` environment variable outranks it
  since v22.0.0 (§08.5). **Fix:** `unset PORT`, or set it.
- **Symptom:** a flash of unstyled content on `ng serve` only. **Cause:** deferred stylesheet
  processing (§08.6). **Fix:** none needed; it does not happen in a real build.
- **Symptom:** you want to change a Vite setting. **Cause/Fix:** you cannot — the dev server
  *"currently cannot be directly configured"* (§08.2); `allowedHosts` is the one pass-through
  (§08.5).
- **Symptom:** an `npm link`ed dependency's changes do not appear. **Cause:** prebundling (§08.7).
  **Fix:** `prebundle.exclude`, shown in JSON.
- **Symptom:** editing a component class body triggers a full reload while editing its template does
  not. **Cause:** template/stylesheet HMR exists; general JS HMR does not (§08.6).

### 08.9 Interview questions

- **★ Which bundler builds an Angular v22 app?** Both — esbuild produces the build, Rolldown
  re-bundles the chunks by default since `@angular/build` 22.1.0 (§08.1).
- **★ Where does Vite fit, and can you configure it?** Dev server only, and no (§08.2).
- **Why is there no `vite.config.ts` in an Angular project?** §08.2.
- **What kinds of HMR does Angular actually support?** Global stylesheet, component stylesheet,
  component template — not general JavaScript (§08.6).
- **The default test builder in a new v22 app is labelled experimental. Which is it, and what
  replaced what?** `@angular/build:unit-test`, scaffolded by `ng new`, with Vitest as the default
  runner (§08.4, §Chunk 16).

---

## Chunk 09 — The Webpack builders are deprecated

### 09.1 🔴 The npm deprecation notice — the strongest evidence available

`@angular-devkit/build-angular@22.1.7` carries an npm `deprecated` field. Verbatim from
`https://registry.npmjs.org/@angular-devkit/build-angular/22.1.7` (read 2026-09-09):

```json
{
  "version": "22.1.7",
  "description": "Angular Webpack Build Facade",
  "deprecated": "Angular's Webpack support is deprecated. Use the esbuild and Vite-based \"@angular/build\" package instead."
}
```

That string is printed by every package manager on install. It is the single best quote for this
page, because it is the one the reader will actually see.

### 09.2 The four deprecations in the v22.0.0 CLI CHANGELOG, verbatim

From [`angular-cli` CHANGELOG, `22.0.0 (2026-06-03)` → Deprecations](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md):

> **`@angular-devkit/build-angular`** — *"Webpack builders in build-angular are deprecated. Use
> @angular/build builders instead."*
>
> **`@angular-devkit/build-webpack`** — *"Webpack builders in build-webpack are deprecated. Use
> @angular/build builders instead."*
>
> **`@ngtools/webpack`** — *"@ngtools/webpack loader and plugin are deprecated. Use @angular/build
> instead."*
>
> **`@angular/ssr`** — *"CommonEngine APIs are deprecated in favor of AngularNodeAppEngine or
> AngularAppEngine."*

**Three packages, one message.** That is the shape of the deprecation: not a builder, a *toolchain*.

### 09.3 The documentation's own IMPORTANT box

> *"**IMPORTANT:** The existing webpack-based build system and `browser` builder are deprecated.
> Applications can temporarily continue to use the `browser` builder and projects can opt-out of
> migrating during an update, but the Angular team recommends migrating to the new build system."*
> — https://angular.dev/tools/cli/build-system-migration

🔴 **"projects can opt-out of migrating during an update"** — that is `use-application-builder`
being `optional: true` (§07.3), stated from the documentation side. Cross-link the two.

### 09.4 The complete builder inventory, and which package owns which

The CLI's own enum is the authoritative list. Verbatim from
[`packages/schematics/angular/utility/workspace-models.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/utility/workspace-models.ts)
at `v22.1.7`, including its doc comment:

```ts
/**
 * An enum of the official Angular builders.
 * Each enum value provides the fully qualified name of the associated builder.
 * This enum can be used when analyzing the `builder` fields of project configurations from the
 * `angular.json` workspace file.
 */
export enum Builders {
  Application = '@angular-devkit/build-angular:application',
  AppShell = '@angular-devkit/build-angular:app-shell',
  Server = '@angular-devkit/build-angular:server',
  Browser = '@angular-devkit/build-angular:browser',
  SsrDevServer = '@angular-devkit/build-angular:ssr-dev-server',
  Prerender = '@angular-devkit/build-angular:prerender',
  BrowserEsbuild = '@angular-devkit/build-angular:browser-esbuild',
  Karma = '@angular-devkit/build-angular:karma',
  BuildKarma = '@angular/build:karma',
  BuildUnitTest = '@angular/build:unit-test',
  TsLint = '@angular-devkit/build-angular:tslint',
  NgPackagr = '@angular-devkit/build-angular:ng-packagr',
  BuildNgPackagr = '@angular/build:ng-packagr',
  DevServer = '@angular-devkit/build-angular:dev-server',
  BuildDevServer = '@angular/build:dev-server',
  ExtractI18n = '@angular-devkit/build-angular:extract-i18n',
  BuildExtractI18n = '@angular/build:extract-i18n',
  BuildApplication = '@angular/build:application',
}
```

🔴 **The naming convention is the whole story in one table.** Every `Build*` member is the
`@angular/build` version of a `@angular-devkit/build-angular` member of the same name. A page can
render this as a two-column "legacy → current" table and it will be correct by construction:

| Legacy (`@angular-devkit/build-angular:`) | Current (`@angular/build:`) |
|---|---|
| `application` | `application` |
| `dev-server` | `dev-server` |
| `extract-i18n` | `extract-i18n` |
| `karma` | `karma` |
| `ng-packagr` | `ng-packagr` |
| `browser`, `browser-esbuild`, `server`, `app-shell`, `prerender`, `ssr-dev-server` | **no successor — `application` absorbed all six** |
| `tslint` | **none; TSLint is long dead** |
| — | `unit-test` (new, `[EXPERIMENTAL]`, §08.4) |

That "absorbed all six" claim is documented, verbatim:

> *"The `application` builder now provides the integrated functionality for all of the following
> preexisting builders: `app-shell`, `prerender`, `server`, `ssr-dev-server`."*
> — https://angular.dev/tools/cli/build-system-migration

(That names four. `browser` and `browser-esbuild` are the two the migration converts *from* — see
§09.5. Be precise: four absorbed, two replaced.)

### 09.5 The two-step compatibility ladder — quoted, because the distinction is subtle

> *"The `browser-esbuild` builder builds only the client-side bundle of an application designed to
> be compatible with the existing `browser` builder that provides the preexisting build system. This
> builder provides equivalent build options, and in many cases, it serves as a drop-in replacement
> for existing `browser` applications."*
>
> *"The `application` builder covers an entire application, such as the client-side bundle, as well
> as optionally building a server for server-side rendering and performing build-time prerendering
> of static pages. The `application` builder is generally preferred as it improves server-side
> rendered (SSR) builds, and makes it easier for client-side rendered projects to adopt SSR in the
> future. However it requires a little more migration effort, particularly for existing SSR
> applications if performed manually."*
>
> *"If the `application` builder is difficult for your project to adopt, `browser-esbuild` can be an
> easier solution which gives most of the build performance benefits with fewer breaking changes."*
> — https://angular.dev/tools/cli/build-system-migration

And the minimal edit, quoted:

> *"Changing the `builder` field is the only change you will need to make."*

(applies to `browser` → `browser-esbuild`; for `browser` → `application` the same page says
*"Changing the `builder` field is the first change you will need to make."*)

### 09.6 What the automated migration actually does — the eight bullets, verbatim

> *"The migration does the following:*
>
> - *Converts existing `browser` or `browser-esbuild` target to `application`*
> - *Removes any previous SSR builders (because `application` does that now).*
> - *Updates configuration accordingly.*
> - *Merges `tsconfig.server.json` with `tsconfig.app.json` and adds the TypeScript option
>   `"esModuleInterop": true` to ensure `express` imports are ESM compliant.*
> - *Updates application server code to use new bootstrapping and output directory structure.*
> - *Removes any webpack-specific builder stylesheet usage such as the tilde or caret in
>   `@import`/`url()` and updates the configuration to provide equivalent behavior*
> - *Converts to use the new lower dependency `@angular/build` Node.js package if no other
>   `@angular-devkit/build-angular` usage is found."*
> — https://angular.dev/tools/cli/build-system-migration

🔴 **That last bullet is the answer to "why is `@angular-devkit/build-angular` still in my
`package.json` after migrating?"** — because something else in the workspace still uses it.

Also verbatim, and worth quoting as a warning:

> *"While many changes can be automated and most applications will not require any further changes,
> each application is unique and there may be some manual changes required. After the migration,
> please attempt a build of the application as there could be new errors that will require
> adjustments within the code."*

### 09.7 The `browser` → `application` option renames, complete and verbatim

> - *`main` should be renamed to `browser`.*
> - *`polyfills` should be an array, rather than a single file.*
> - *`buildOptimizer` should be removed, as this is covered by the `optimization` option.*
> - *`resourcesOutputPath` should be removed, this is now always `media`.*
> - *`vendorChunk` should be removed, as this was a performance optimization which is no longer
>   needed.*
> - *`commonChunk` should be removed, as this was a performance optimization which is no longer
>   needed.*
> - *`deployUrl` should be removed and is not supported. Prefer `<base href>` instead.*
> - *`ngswConfigPath` should be renamed to `serviceWorker`.*
> — https://angular.dev/tools/cli/build-system-migration

⚠️ **`deployUrl` is still present in the v22 `application` schema** with the description *"Customize
the base path for the URLs of resources in 'index.html' and component stylesheets. This option is
on…"* ([schema.json](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)),
which contradicts *"is not supported"* on the doc page. See §100.4 — flag it, do not silently pick
one.

### 09.8 The known issues that bite on migration — all verbatim

**Output location:**

> *"By default, after a successful build by the application builder the bundle is located in a
> `dist/<project-name>/browser` directory (instead of `dist/<project-name>` for the browser
> builder). This might break some of the toolchains that rely the previous location."*

**ESM default vs namespace imports:**

> *"TypeScript by default allows default exports to be imported as namespace imports and then used
> in call expressions. This is unfortunately a divergence from the ECMAScript specification. The
> underlying bundler (`esbuild`) within the new build system expects ESM code that conforms to the
> specification."*

with the warning text, quoted from the doc page (**this is documentation text, not captured build
output — say so on the page**):

> *"▲ [WARNING] Calling "moment" will crash at run-time because it's an import namespace object,
> not a function [call-import-namespace]"*

and the fix, quoted:

> *"When enabled, the `esModuleInterop` option provides better alignment with the ECMAScript
> specification and is also recommended by the TypeScript team."*

**Web workers:**

> *"However, the code within the Worker will not currently be type-checked by the TypeScript
> compiler. TypeScript code is supported just not type-checked. Additionally, any nested workers
> will not be processed by the build system."*

**Order-dependent side-effectful imports:**

> *"Import statements that are dependent on a specific ordering and are also used in multiple lazy
> modules can cause top-level statements to be executed out of order. This is not common as it
> depends on the usage of side-effectful modules and does not apply to the `polyfills` option. This
> is caused by a defect in the underlying bundler but will be addressed in a future update."*

**SSR CommonJS:**

> *"Remember to remove any CommonJS assumptions in the application server code if using SSR such as
> `require`, `__filename`, `__dirname`, or other constructs from the CommonJS module scope. All
> application code should be ESM compatible. This does not apply to third-party dependencies."*

**Karma incompatibility:**

> *"The new features of the `application` builder described here are incompatible with the `karma`
> test builder by default because it is using the `browser` builder internally. Users can opt-in to
> use the `application` builder by setting the `builderMode` option to `application` for the `karma`
> builder. This option is currently in developer preview."*

### 09.9 The new-build-system-only features worth naming

**`define`** — build-time identifier replacement:

> *"The `define` option allows identifiers present in the code to be replaced with another value at
> build time. This is similar to the behavior of Webpack's `DefinePlugin`…"*
>
> *"All replacement values are defined as strings within the configuration file. If the replacement
> is intended to be an actual string literal, it should be enclosed in single quote marks."*
>
> *"**IMPORTANT:** This option will not replace identifiers contained within Angular metadata such
> as a Component or Directive decorator."*

with the example config quoted verbatim from the page:

```json
"build": {
  "builder": "@angular/build:application",
  "options": {
    "define": {
        "SOME_NUMBER": "5",
        "ANOTHER": "'this is a string literal, note the extra single quotes'",
        "REFERENCE": "globalThis.someValue.noteTheAbsentSingleQuotes"
    }
  }
}
```

**`loader`** — the six loader kinds, verbatim:

> - *`text` - inlines the content as a `string` available as the default export*
> - *`binary` - inlines the content as a `Uint8Array` available as the default export*
> - *`file` - emits the file at the application output path and provides the runtime location of the
>   file as the default export*
> - *`dataurl` - inlines the content as a data URL.*
> - *`base64` - inlines the content as a Base64-encoded string.*
> - *`empty` - considers the content to be empty and will not include it in bundles*

**Import/export conditions** — the replacement for `fileReplacements`:

> *"For optimized builds, the `production` condition is enabled. For non-optimized builds, the
> `development` condition is enabled. For browser output code, the `browser` condition is enabled."*
>
> *"An optimized build is determined by the value of the `optimization` option. When `optimization`
> is set to `true` or more specifically if `optimization.scripts` is set to `true`, then the build is
> considered optimized. This classification applies to both `ng build` and `ng serve`. In a new
> project, `ng build` defaults to optimized and `ng serve` defaults to non-optimized."*
>
> *"**HELPFUL:** If currently using the `fileReplacements` build option, this feature may be able to
> replace its usage."*

🔴 **That HELPFUL box is the bridge to Chunk 11.** `fileReplacements` has a successor now, and the
`angular.json` page should say so.

### 09.10 Gotchas to write

- **Symptom:** deploy scripts break after migrating; `dist/<name>/index.html` is gone.
  **Cause:** output moved to `dist/<name>/browser/` (§09.8). **Fix:** show the `outputPath` object
  form (§Chunk 11) or update the script.
- **Symptom:** `Calling "moment" will crash at run-time…` **Cause:** namespace import of a default
  export (§09.8). **Fix:** `esModuleInterop: true` and `import moment from 'moment'` — show both
  lines.
- **Symptom:** `@angular-devkit/build-angular` is still installed after migrating. **Cause:**
  another target still uses it (§09.6, last bullet). **Fix:** find it — `karma`, `ng-packagr` and
  `extract-i18n` targets are the usual culprits.
- **Symptom:** a `~` or `^` prefixed `@import` in SCSS stopped resolving. **Cause:** webpack-specific
  stylesheet syntax, removed by the migration (§09.6). **Fix:** show the plain path.
- **Symptom:** an npm-install warning about a deprecated package on every install. **Cause:**
  §09.1. **Fix:** run `use-application-builder`.
- **Symptom:** web-worker code compiles but its type errors never appear. **Cause:** §09.8.

### 09.11 Interview questions

- **★ Are the Webpack builders removed in v22?** No — deprecated, in three packages at once, and
  still published at 22.1.7 (§09.1, §09.2). Deprecation lasts *"at least the next major release
  (period of at least 12 months)"* (§Chunk 17).
- **★ What is `browser-esbuild` for, given `application` exists?** A drop-in compatibility step for
  projects that cannot take `application` yet (§09.5).
- **Which builders did `application` absorb?** `app-shell`, `prerender`, `server`, `ssr-dev-server`
  (§09.4).
- **Why did your output path change after migrating?** §09.8.
- **What replaced `fileReplacements` in the new build system, and is `fileReplacements` gone?**
  Import/export conditions with subpath imports; `fileReplacements` still exists and still works
  (§09.9, §Chunk 11).

---

## Chunk 10 — The generated `angular.json`

### 10.1 The workspace file as the schematic writes it

[`packages/schematics/angular/workspace/files/angular.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/angular.json.template)
at `v22.1.7`, verbatim (it is an EJS template — the `<% %>` blocks are the template language, not
JSON):

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

🔴 **`ng new` writes a workspace with an empty `projects` object**, and the *application*
schematic then adds the project. Two schematics, two files, one command. That is why
`ng new my-workspace --no-create-application` is a legal thing to do:

> *"If you intend to have multiple projects in a workspace, you can skip the initial application
> generation when you create the workspace, and give the workspace a unique name. The following
> command creates a workspace with all of the workspace-wide configuration files, but no root-level
> application."*
>
> ```
> ng new my-workspace --no-create-application
> ```
> — https://angular.dev/reference/configs/file-structure

Also note **`"version": 1`** — the `angular.json` *schema* version, not the Angular version. Say so;
it is a recurring confusion.

### 10.2 🔴 The project block, exactly as the code builds it

This is the single most valuable artefact in the topic, because it is what a reader's own file looks
like. From
[`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts)
at `v22.1.7`, verbatim:

```ts
const project = {
  root: normalize(projectRoot),
  sourceRoot,
  projectType: ProjectType.Application,
  prefix: options.prefix || 'app',
  schematics,
  targets: {
    build: {
      builder: Builders.BuildApplication,
      defaultConfiguration: 'production',
      options: {
        browser: `${sourceRoot}/main.ts`,
        polyfills: options.zoneless ? undefined : ['zone.js'],
        tsConfig: `${projectRoot}tsconfig.app.json`,
        inlineStyleLanguage,
        assets: [{ 'glob': '**/*', 'input': `${projectRoot}public` }],
        styles: [`${sourceRoot}/styles.${options.style}`],
      },
      configurations: {
        production: {
          budgets,
          outputHashing: 'all',
        },
        development: {
          optimization: false,
          extractLicenses: false,
          sourceMap: true,
        },
      },
    },
    serve: {
      builder: Builders.BuildDevServer,
      defaultConfiguration: 'development',
      options: {},
      configurations: {
        production: {
          buildTarget: `${options.name}:build:production`,
        },
        development: {
          buildTarget: `${options.name}:build:development`,
        },
      },
    },
    test:
      options.skipTests || options.minimal
        ? undefined
        : {
            builder: Builders.BuildUnitTest,
            options:
              options.testRunner === TestRunner.Vitest
                ? {}
                : {
                    runner: 'karma',
                  },
          },
  },
};
```

**Resolving the constants** (all from §09.4's `Builders` enum and the defaults in §Chunk 16):

- `Builders.BuildApplication` = `@angular/build:application`
- `Builders.BuildDevServer` = `@angular/build:dev-server`
- `Builders.BuildUnitTest` = `@angular/build:unit-test` — the `[EXPERIMENTAL]` one (§08.4)
- `options.zoneless` defaults to **`true`**, so `polyfills` is `undefined` and **the key is absent
  from a default v22 `angular.json`**
- `options.testRunner` defaults to **`'vitest'`**, so the `test` target's `options` is **`{}`**
- `inlineStyleLanguage` is `options?.style !== Style.Css ? options.style : undefined` — **absent for
  the default CSS project**

🔴 **Six lines of `options` and three of `configurations`. That is the whole build target.** Every
other option in the 45-property schema (§Chunk 11) is a default you never wrote.

### 10.3 The budgets, both sets, from the same file

```ts
let budgets: { type: string; maximumWarning: string; maximumError: string }[];
if (options.strict) {
  budgets = [
    { type: 'initial',            maximumWarning: '500kB', maximumError: '1MB' },
    { type: 'anyComponentStyle',  maximumWarning: '4kB',   maximumError: '8kB' },
  ];
} else {
  budgets = [
    { type: 'initial',            maximumWarning: '2MB',   maximumError: '5MB' },
    { type: 'anyComponentStyle',  maximumWarning: '6kB',   maximumError: '10kB' },
  ];
}
```

`strict` defaults to **`true`** (§Chunk 16), so **a default v22 app errors the build at a 1 MB
initial bundle**. That number is worth stating outright.

### 10.4 The `schematics` block — why yours may be empty and a colleague's is not

```ts
const schematics: JsonObject = {};

if (options.inlineTemplate || options.inlineStyle || options.minimal || options.style !== Style.Css) {
  const componentSchematicsOptions: JsonObject = {};
  if (options.inlineTemplate ?? options.minimal) { componentSchematicsOptions.inlineTemplate = true; }
  if (options.inlineStyle ?? options.minimal)    { componentSchematicsOptions.inlineStyle = true; }
  if (options.style && options.style !== Style.Css) { componentSchematicsOptions.style = options.style; }

  schematics['@schematics/angular:component'] = componentSchematicsOptions;
}

if (options.skipTests || options.minimal) {
  const schematicsWithTests = [
    'class', 'component', 'directive', 'guard', 'interceptor', 'pipe', 'resolver', 'service',
  ];
  schematicsWithTests.forEach((type) => {
    ((schematics[`@schematics/angular:${type}`] ??= {}) as JsonObject).skipTests = true;
  });
}

if (!options.standalone) {
  const schematicsWithStandalone = ['component', 'directive', 'pipe'];
  schematicsWithStandalone.forEach((type) => {
    ((schematics[`@schematics/angular:${type}`] ??= {}) as JsonObject).standalone = false;
  });
}

if (options.fileNameStyleGuide === '2016') {
  const schematicsWithTypeSymbols = ['component', 'directive', 'service'];
  schematicsWithTypeSymbols.forEach((type) => {
    const schematicDefaults = (schematics[`@schematics/angular:${type}`] ??= {}) as JsonObject;
    schematicDefaults.type = type;
    schematicDefaults.addTypeToClassName = false;
  });

  const schematicsWithTypeSeparator = ['guard', 'interceptor', 'module', 'pipe', 'resolver'];
  schematicsWithTypeSeparator.forEach((type) => {
    ((schematics[`@schematics/angular:${type}`] ??= {}) as JsonObject).typeSeparator = '.';
  });
}
```

🔴 **In a default v22 project (`--style=css`, tests on, standalone, 2025 naming) `schematics` is an
empty object.** Every entry in it is a record of a non-default choice made at `ng new` time. That is
the cleanest possible illustration of "which fields you set and which are scaffolding".

The documentation's framing of the same block, verbatim:

> *"The "name" of a schematic is in the format: `<schematic-package>:<schematic-name>`. Schematics
> for the default Angular CLI `ng generate` sub-commands are collected in the package
> `@schematics/angular`. For example, the schematic for generating a component with `ng generate
> component` is `@schematics/angular:component`. The fields given in the schematic's schema
> correspond to the allowed command-line argument values and defaults for the Angular CLI
> sub-command options."*
> — https://angular.dev/reference/configs/workspace-config

### 10.5 The workspace-level `cli` options — the whole table, verbatim

From https://angular.dev/reference/configs/workspace-config:

| Property | Details (verbatim) | Type | Default |
|---|---|---|---|
| `analytics` | *"Share anonymous usage data with the Angular Team. A boolean value indicates whether or not to share data, while a UUID string shares data using a pseudonymous identifier."* | `boolean \| string` | `false` |
| `cache` | *"Control persistent disk cache used by Angular CLI Builders."* | Cache options | `{}` |
| `schematicCollections` | *"List schematics collections to use in `ng generate`."* | `string[]` | `[]` |
| `packageManager` | *"The preferred package manager tool to use."* | `npm \| cnpm \| pnpm \| yarn \| bun` | `npm` |
| `warnings` | *"Control Angular CLI specific console warnings."* | Warnings options | `{}` |

**Cache options**, verbatim:

| Property | Details | Type | Default |
|---|---|---|---|
| `enabled` | *"Configure whether disk caching is enabled for builds."* | `boolean` | `true` |
| `environment` | *"Configure in which environment disk cache is enabled. `ci` enables caching only in continuous integration (CI) environments. `local` enables caching only outside of CI environments. `all` enables caching everywhere."* | `local \| ci \| all` | `local` |
| `path` | *"The directory used to stored cache results."* | `string` | `.angular/cache` |

**Warnings options**, verbatim:

| Property | Details | Type | Default |
|---|---|---|---|
| `versionMismatch` | *"Show a warning when the global Angular CLI version is newer than the local one."* | `boolean` | `true` |

🔴 **`.angular/cache` is in the generated `.gitignore`** — verbatim from
[`__dot__gitignore.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/__dot__gitignore.template):
`/.angular/cache`. Tie the two together; it is the only reason that odd-looking directory exists.

⚠️ **`bun` is in the `packageManager` enum in v22.** Worth one line.

### 10.6 The per-project properties, verbatim

From the same page:

| Property | Details (verbatim) | Type | Default |
|---|---|---|---|
| `root` | *"The root directory for this project's files, relative to the workspace directory. Empty for the initial application, which resides at the top level of the workspace."* | `string` | required |
| `projectType` | *"One of "application" or "library" An application can run independently in a browser, while a library cannot."* | `application \| library` | required |
| `sourceRoot` | *"The root directory for this project's source files."* | `string` | `''` |
| `prefix` | *"A string that Angular prepends to selectors when generating new components, directives, and pipes using `ng generate`. Can be customized to identify an application or feature area."* | `string` | `'app'` |
| `i18n` | *"Internationalization options for the project…"* | i18n options | `{}` |
| `schematics` | *"A set of schematics that customize the `ng generate` sub-command option defaults for this project."* | see §10.4 | `{}` |
| `architect` | *"Configuration defaults for Architect builder targets for this project."* | targets | `{}` |

⚠️ **`architect` vs `targets`.** The documentation page uses `architect` throughout; the v22
schematic writes **`targets`** (§10.2). Both are accepted — `WorkspaceProject` declares both fields,
each with the comment *"Tool options."*
([`workspace-models.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/utility/workspace-models.ts)).
🔴 **A v22 page must show `targets`, because that is what the reader's file says**, and must
mention `architect` once so the docs page does not confuse them. See §100.2.

### 10.7 What a target is — verbatim

> *"Architect is the tool that the Angular CLI uses to perform complex tasks, such as compilation and
> test running. Architect is a shell that runs a specified builder to perform a given task, according
> to a target configuration."*
>
> *"Each target object specifies the `builder` for that target, which is the npm package for the tool
> that Architect runs. Each target also has an `options` section that configures default options for
> the target, and a `configurations` section that names and specifies alternative configurations for
> the target."*
>
> *"**HELPFUL:** All options in the configuration file must use `camelCase`, rather than `dash-case`
> as used on the command line."*
> — https://angular.dev/reference/configs/workspace-config

Target property table, verbatim:

| Property | Details |
|---|---|
| `builder` | *"The CLI builder used to create this target in the form of `<package-name>:<builder-name>`."* |
| `options` | *"Build target default options."* |
| `configurations` | *"Alternative configurations for executing the target. Each configuration sets the default options for that intended environment, overriding the associated value under `options`."* |

And the standard targets, verbatim: `build`, `serve`, `e2e`, `test`, `lint`, `extract-i18n` — each
described as *"Configures defaults for options of the `ng <cmd>` command."*

⚠️ **The page still says the builder schemas *"are collected in the `@angular-devkit/build-angular`
package"***. For a v22 project using `@angular/build` that is stale. See §100.1.

### 10.8 Gotchas to write

- **Symptom:** `polyfills` is missing from `angular.json` and you expected `["zone.js"]`.
  **Cause:** zoneless is the v22 default, so the key is not written (§10.2).
- **Symptom:** `ng build` fails with a budget error on a 1.1 MB bundle. **Cause:** `strict` budgets
  (§10.3). **Fix:** show the budget entry being raised deliberately, and say what the number was.
- **Symptom:** `ng generate component` produces an inline template for a colleague and a separate
  file for you. **Cause:** the per-project `schematics` block (§10.4).
- **Symptom:** a documentation snippet uses `architect` and your file uses `targets`. **Cause:**
  §10.6.
- **Symptom:** `--output-hashing` on the command line but `outputHashing` in the file. **Cause:**
  camelCase-in-file rule (§10.7).
- **Symptom:** a stale `.angular/cache` after a dependency change. **Cause/Fix:** §10.5; the `cache`
  block, and the directory is gitignored.

### 10.9 Interview questions

- **★ Name every field `ng new` actually writes into a default v22 `angular.json` build target.**
  `browser`, `tsConfig`, `assets`, `styles` under `options`; `budgets` + `outputHashing` under
  `production`; `optimization`, `extractLicenses`, `sourceMap` under `development`; plus `builder`
  and `defaultConfiguration` (§10.2). Nine values.
- **★ Why is a default project's `schematics` object empty?** Because every entry records a
  non-default `ng new` choice (§10.4).
- **What is `"version": 1` at the top of `angular.json`?** The workspace schema version (§10.1).
- **What is the difference between `architect` and `targets`?** Same thing; `targets` is what v22
  writes (§10.6).
- **Where does the CLI put its build cache and why is it not in git?** `.angular/cache`, gitignored
  by the scaffold (§10.5).

---

## Chunk 11 — `configurations`, `fileReplacements`, budgets

### 11.1 `configurations` — the mechanism, verbatim

> *"Angular CLI builders support a `configurations` object, which allows overwriting specific options
> for a builder based on the configuration provided on the command line."*
>
> *"Angular CLI comes with two build configurations: `production` and `development`. By default, the
> `ng build` command uses the `production` configuration, which applies several build optimizations,
> including: Bundling files; Minimizing excess whitespace; Removing comments and dead code;
> Minifying code to use short, mangled names."*
>
> *"You can define and name extra alternate configurations (such as `staging`, for instance)
> appropriate to your development process. You can select an alternate configuration by passing its
> name to the `--configuration` command line flag."*
> — https://angular.dev/reference/configs/workspace-config and
> https://angular.dev/tools/cli/environments

🔴 **The composition rule, verbatim — this is the load-bearing sentence:**

> *"You can also pass in more than one configuration name as a comma-separated list. For example, to
> apply both `staging` and `french` build configurations, use the command
> `ng build --configuration staging,french`. In this case, the command parses the named
> configurations from left to right. If multiple configurations change the same setting, the
> last-set value is the final one. In this example, if both `staging` and `french` configurations
> set the output path, the value in `french` would get used."*

**Left to right, last wins.** Not merged, not first-wins.

And the `defaultConfiguration` fact from §10.2: `build` has `defaultConfiguration: 'production'`,
`serve` has `defaultConfiguration: 'development'`. **That is why `ng build` is optimised and
`ng serve` is not, and it is a two-word answer, not folklore.**

### 11.2 `fileReplacements` — the schema, and the pattern that constrains it

From
[`application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
at `v22.1.7`, verbatim:

```json
"fileReplacements": {
  "description": "Replace compilation source files with other compilation source files in the build.",
  "type": "array",
  "items": { "$ref": "#/definitions/fileReplacement" },
  "default": []
}
```

```json
"fileReplacement": {
  "type": "object",
  "properties": {
    "replace": { "type": "string", "pattern": "\\.(([cm]?[jt])sx?|json)$" },
    "with":    { "type": "string", "pattern": "\\.(([cm]?[jt])sx?|json)$" }
  },
  "additionalProperties": false,
  "required": ["replace", "with"]
}
```

🔴 **The regex is the interesting part.** `.js`, `.jsx`, `.ts`, `.tsx`, `.cjs`, `.mjs`, `.cts`,
`.mts`, `.json` — and **nothing else**. You cannot swap an `.html`, a `.css` or an image with
`fileReplacements`. That constraint is not stated in prose anywhere I found; it is only in the
schema. It is exactly the kind of thing a page should show.

Also: **it is a build option, not a top-level one** — it lives under a `configurations` entry, which
is what makes it environment-specific.

### 11.3 The environments workflow, verbatim

> *"`@angular/build:application` supports file replacements, an option for substituting source files
> before executing a build. Using this in combination with `--configuration` provides a mechanism for
> configuring environment-specific data in your application."*
>
> *"Start by generating environments to create the `src/environments/` directory and configure the
> project to use file replacements."*
>
> ```
> ng generate environments
> ```
>
> *"The project's `src/environments/` directory contains the base configuration file,
> `environment.ts`, which provides the default configuration for production. You can override default
> values for additional environments, such as `development` and `staging`, in target-specific
> configuration files."*
>
> ```
> my-app/src/environments
> ├── environment.development.ts
> ├── environment.staging.ts
> └── environment.ts
> ```
> — https://angular.dev/tools/cli/environments

🔴 **The security note, verbatim — this belongs on the page in full:**

> *"**CRITICAL:** Files in `src/environments/` are bundled into your client-side application and
> visible to anyone who loads the page. Never store secrets such as API keys here. Use a server-side
> proxy or a secrets manager instead."*

⚠️ **`ng generate environments` is not run by `ng new`.** There is no `src/environments/` in a
default v22 app (§Chunk 14 proves it from the template list). Say so — half the internet assumes
otherwise.

And the successor, from §09.9: import/export conditions with `package.json` `imports`. Quoted:

> *"**HELPFUL:** If currently using the `fileReplacements` build option, this feature may be able to
> replace its usage."*

with the worked shape, quoted from the same page:

```json
{
  "imports": {
    "#logger": {
      "development": "./src/logging/debug.ts",
      "default": "./src/logging/noop.ts"
    }
  }
}
```

### 11.4 Budgets — the complete definition

From
[`application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json),
`definitions.budget`, verbatim:

```json
{
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "description": "The type of budget.",
      "enum": ["all", "allScript", "any", "anyScript", "anyComponentStyle", "bundle", "initial"]
    },
    "name":           { "type": "string", "description": "The name of the bundle." },
    "baseline":       { "type": "string", "description": "The baseline size for comparison." },
    "maximumWarning": { "type": "string", "description": "The maximum threshold for warning relative to the baseline." },
    "maximumError":   { "type": "string", "description": "The maximum threshold for error relative to the baseline." },
    "minimumWarning": { "type": "string", "description": "The minimum threshold for warning relative to the baseline." },
    "minimumError":   { "type": "string", "description": "The minimum threshold for error relative to the baseline." },
    "warning":        { "type": "string", "description": "The threshold for warning relative to the baseline (min & max)." },
    "error":          { "type": "string", "description": "The threshold for error relative to the baseline (min & max)." }
  },
  "additionalProperties": false,
  "required": ["type"]
}
```

🔴 **Seven budget types, and only two are scaffolded** (§10.3: `initial`, `anyComponentStyle`). The
other five — `all`, `allScript`, `any`, `anyScript`, `bundle` — exist and nobody uses them, which is
exactly what a reference page is for. And **`minimum*` budgets exist**: you can fail a build for a
bundle that got *too small*, which is a genuinely surprising fact.

`baseline` + `warning`/`error` is the relative form; `maximumWarning`/`maximumError` is the absolute
form. `type` is the only required field.

The doc-page framing, verbatim:

> *"budgets — Default size-budget type and thresholds for all or parts of your application. You can
> configure the builder to report a warning or an error when the output reaches or exceeds a
> threshold size."*
> — https://angular.dev/reference/configs/workspace-config

### 11.5 `outputPath` — the object form, from the schema

```json
"outputPath": {
  "description": "Specify the output path relative to workspace root.",
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "base":    { "type": "string", "description": "Specify the output path relative to workspace root." },
        "browser": { "type": "string", "pattern": "^[-\\w\\.]*$", "default": "browser",
                     "description": "The output directory name of your browser build within the output path base. Defaults to 'browser'." },
        "server":  { "type": "string", "pattern": "^[-\\w\\.]*$", "default": "server",
                     "description": "The output directory name of your server build within the output path base. Defaults to 'server'." },
        "media":   { "type": "string", "pattern": "^[-\\w\\.]+$", "default": "media",
                     "description": "The output directory name of your media files within the output browser directory. Defaults to 'media'." }
      },
      "required": ["base"],
      "additionalProperties": false
    },
    { "type": "string" }
  ]
}
```

🔴 **This is the fix for §09.8's "output moved to `dist/<name>/browser`".** Setting
`"outputPath": { "base": "dist/my-app", "browser": "" }` puts it back. Note `browser`'s pattern is
`^[-\w\.]*$` — the `*` permits the empty string, `media`'s `+` does not.

### 11.6 The rest of the options, with real defaults

Extracted from the same schema (45 properties; these are the ones a page must cover). **Every
default below is read from the schema, not remembered.**

| Option | Default | Note |
|---|---|---|
| `tsConfig` | — | 🔴 **the only required option** |
| `aot` | `true` | *"Build using Ahead of Time compilation."* — see Chunk 20 |
| `optimization` | `true` | boolean or object |
| `sourceMap` | `false` | scaffolded to `true` in `development` (§10.2) |
| `outputHashing` | `'none'` | scaffolded to `'all'` in `production` (§10.2) |
| `extractLicenses` | `true` | scaffolded to `false` in `development` |
| `namedChunks` | `false` | |
| `progress` | `true` | |
| `deleteOutputPath` | `true` | |
| `statsJson` | `false` | *"Generates a 'stats.json' file which can be analyzed with https://esbuild.github.io/analyze/."* |
| `subresourceIntegrity` | `false` | |
| `serviceWorker` | `false` | |
| `ssr` | `false` | |
| `prerender` | — | |
| `crossOrigin` | `'none'` | |
| `inlineStyleLanguage` | `'css'` | |
| `i18nMissingTranslation` | `'warning'` | |
| `i18nDuplicateTranslation` | `'warning'` | |
| `allowedCommonJsDependencies` | `[]` | *"A list of CommonJS or AMD packages that are allowed to be used without a build time warning. Use `'*'` to allow…"* |
| `externalDependencies` | `[]` | |
| `clearScreen` | `false` | |
| `watch` | `false` | |
| `verbose` | `false` | |
| `conditions` | — | *"Custom package resolution conditions used to resolve conditional exports/imports. Defaults to ['module', 'deve…"* |
| `security` | — | *"Security features to protect against XSS and other common attacks"* — object with key `autoCsp` |

🔴 **`statsJson` pointing at `https://esbuild.github.io/analyze/`** is a nice concrete detail: the
v22 bundle-analysis story is esbuild's analyser, not webpack-bundle-analyzer.

### 11.7 Assets — the object form, verbatim

> *"Each `build` target configuration can include an `assets` array that lists files or folders you
> want to copy as-is when building your project. By default, the contents of the `public/` directory
> are copied over."*
>
> | Fields | Details |
> |---|---|
> | `glob` | *"A node-glob using `input` as base directory."* |
> | `input` | *"A path relative to the workspace root."* |
> | `output` | *"A path relative to `outDir`. **Because of the security implications, the Angular CLI never writes files outside of the project output path.**"* |
> | `ignore` | *"A list of globs to exclude."* |
> | `followSymlinks` | *"Allow glob patterns to follow symlink directories. This allows subdirectories of the symlink to be searched. Defaults to `false`."* |
> — https://angular.dev/reference/configs/workspace-config

⚠️ **The doc page's worked example uses `"input": "src/assets/"`; the v22 scaffold writes
`"input": "<projectRoot>public"`** (§10.2). The `public/` directory is the v22 shape. See §100.3.

### 11.8 Gotchas to write

- **Symptom:** `fileReplacements` refuses an `.html` swap. **Cause:** the schema's extension pattern
  (§11.2). **Fix:** move the varying value into a `.ts` and replace that.
- **Symptom:** `ng build --configuration staging,production` did not do what you expected.
  **Cause:** left-to-right, last-wins (§11.1). **Fix:** reorder, and show both orders.
- **Symptom:** an API key ended up in the production bundle. **Cause:** `src/environments/` is
  client code (§11.3). **Fix:** server-side proxy; quote the CRITICAL box.
- **Symptom:** `src/environments/` does not exist in a new project. **Cause:** it is generated on
  demand by `ng generate environments` (§11.3).
- **Symptom:** deploy expects `dist/my-app/index.html`. **Fix:** the `outputPath` object form
  (§11.5), shown in JSON.
- **Symptom:** a CommonJS dependency warning on every build. **Fix:**
  `allowedCommonJsDependencies` (§11.6) — and say what the warning is actually telling you.
- **Symptom:** `ng serve` output is unminified and `ng build`'s is not, with no flags passed.
  **Cause:** `defaultConfiguration` differs per target (§11.1).

### 11.9 Interview questions

- **★ Two configurations set the same option and you pass both. Which wins?** The rightmost
  (§11.1).
- **★ Why is `ng build` optimised by default and `ng serve` not?** `defaultConfiguration` is
  `'production'` on `build` and `'development'` on `serve` (§10.2, §11.1).
- **What file types can `fileReplacements` swap?** Only JS/TS/JSON variants, per the schema pattern
  (§11.2).
- **Name a budget type nobody uses and say what it does.** Any of `all`, `allScript`, `any`,
  `anyScript`, `bundle`; and `minimumWarning`/`minimumError` fail a build for being too small
  (§11.4).
- **Is `src/environments/` still the recommended way to configure per-environment values?** It still
  works; the build system now offers import/export conditions as an alternative and the docs say so
  (§11.3, §09.9).

---

## Chunk 12 — The TypeScript peer pin

### 12.1 The pin, from the manifest that carries it

`@angular/compiler-cli@22.1.5`, verbatim from `https://registry.npmjs.org/@angular/compiler-cli/22.1.5`:

```json
"peerDependencies": {
  "typescript": ">=6.0 <6.1",
  "@angular/compiler": "22.1.5"
},
"engines": {
  "node": "^22.22.3 || ^24.15.0 || >=26.0.0"
}
```

`@angular/build@22.1.7` carries the same TypeScript peer, verbatim from
[`packages/angular/build/package.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/package.json):

```json
"typescript": ">=6.0 <6.1"
```

as does `@angular-devkit/build-angular@22.1.7` (`https://registry.npmjs.org/@angular-devkit/build-angular/22.1.7`).

🔴 **Three packages, one range.** And **not** `@angular/core` — §0.1.

🔴 **Do not re-explain how the pin is enforced or why the window is one minor wide.** Topic 01's
`13b-ngc-is-tsc-and-the-typescript-pin.md` already does that in full, including the version check's
source. **Link to it.** This chunk owns the *matrix* and the *ecosystem consequence*.

### 12.2 🔴 The ecosystem consequence: TypeScript `latest` is outside the range

Measured 2026-09-09 from `https://registry.npmjs.org/-/package/typescript/dist-tags`:

```json
{"latest":"7.0.2","next":"7.1.0-dev.20260908.1","beta":"6.0.0-beta","rc":"7.0.1-rc", …}
```

**`npm install typescript@latest` in an Angular 22 project installs TypeScript 7.0.2, which the
peer range `>=6.0 <6.1` rejects.** That is the sharpest possible illustration of why the pin
matters, and it is true today rather than hypothetically.

The version the scaffold actually pins, verbatim from
[`packages/schematics/angular/utility/latest-versions/package.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/utility/latest-versions/package.json)
at `v22.1.7`:

```json
"typescript": "~6.0.2"
```

**A tilde, not a caret** — `>=6.0.2 <6.1.0`, which is the peer range narrowed to what the CLI has
tested.

### 12.3 The compatibility matrix — verbatim, for every supported version

From https://angular.dev/reference/versions (*Version compatibility*), the **Actively supported
versions** table, complete:

| Angular | Node.js | TypeScript | RxJS |
|---|---|---|---|
| `22.0.x` | `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0` | `>=6.0.0 <6.1.0` | `^6.5.3 \|\| ^7.4.0` |
| `21.0.x \|\| 21.1.x \|\| 21.2.x` | `^20.19.0 \|\| ^22.12.0 \|\| ^24.0.0` | `>=5.9.0 <6.0.0` | `^6.5.3 \|\| ^7.4.0` |
| `20.2.x \|\| 20.3.x` | `^20.19.0 \|\| ^22.12.0 \|\| ^24.0.0` | `>=5.8.0 <6.0.0` | `^6.5.3 \|\| ^7.4.0` |
| `20.0.x \|\| 20.1.x` | `^20.19.0 \|\| ^22.12.0 \|\| ^24.0.0` | `>=5.8.0 <5.9.0` | `^6.5.3 \|\| ^7.4.0` |

The page's own framing, verbatim:

> *"The following tables describe the versions of Node.js, TypeScript, and RxJS that each version of
> Angular requires."*

and, above the second table:

> *"This table covers Angular versions that are no longer under long-term support (LTS). This
> information was correct when each version went out of LTS and is provided without any further
> guarantees. It is listed here for historical reference."*

🔴 **The pattern to point out: the TypeScript window is one or two minors wide, every time, going
back to v9.** A page can state that as a measured observation off this table rather than as a claim.
Useful data points from the historical table (all verbatim): Angular `9.0.x` → `>=3.6.0 <3.8.0`;
`13.0.x` → `~4.4.3`; `17.0.x` → `>=5.2.0 <5.3.0`; `19.2.x` → `>=5.5.0 <5.9.0`.

⚠️ **One discrepancy to bank, not to hide.** The compatibility page says Angular 22's Node range is
`^26.0.0`; the packages' own `engines` say `>=26.0.0` (§12.1). The package metadata is the thing npm
enforces. See §100.5.

⚠️ **A second one.** The CLI's `22.0.0` CHANGELOG says *"Node.js v20 is no longer supported. The
minimum supported Node.js versions are now v22.22.0 and v24.13.1."* — but `@angular/cli@22.1.7`'s
`engines` say `^22.22.3 || ^24.15.0`. **The floors moved inside the 22.x line**, which is exactly
what the release policy licenses: *"In minor releases, we update peer dependencies by expanding the
supported versions"* (§Chunk 17). Use it as the worked example of that rule.

### 12.4 RxJS and zone.js

`@angular/core@22.1.5` peers, verbatim (`https://registry.npmjs.org/@angular/core/22.1.5`):

```json
"peerDependencies": {
  "rxjs": "^6.5.3 || ^7.4.0",
  "zone.js": "~0.15.0 || ~0.16.0",
  "@angular/compiler": "22.1.5"
},
"peerDependenciesMeta": {
  "zone.js": { "optional": true },
  "@angular/compiler": { "optional": true }
}
```

🔴 **`zone.js` is an *optional* peer in v22** — that is the type-level statement of "zoneless by
default", and it is why §05.1's optional-peer rule matters in practice.

🔴 **`@angular/compiler` is an *optional* peer too**, and that is the type-level statement of "AOT
by default, JIT on request" — Chunk 20 picks it up.

The scaffold pins `"rxjs": "~7.8.0"` and `"zone.js": "~0.16.0"`
([`latest-versions/package.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/utility/latest-versions/package.json)),
and `zone.js` is only added when the project is **not** zoneless
([`application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts)):

```ts
if (!options.zoneless) {
  rules.push(
    addDependency('zone.js', latestVersions['zone.js'], {
      type: DependencyType.Default, …
    }),
  );
}
```

### 12.5 Gotchas to write

- **Symptom:** `npm install typescript@latest` and the Angular build stops working. **Cause:**
  TypeScript `latest` is 7.0.2, outside `>=6.0 <6.1` (§12.2). **Fix:** `npm install -D
  typescript@~6.0.2`, the exact scaffolded pin.
- **Symptom:** a lint or editor tool wants a newer TypeScript than Angular allows. **Cause:** the
  one-minor window (§12.3). **Fix:** name it as a scheduling constraint, and point at
  `13b-ngc-is-tsc-and-the-typescript-pin.md` for why the window cannot simply be widened.
- **Symptom:** `ng update` fails on the TypeScript peer before touching anything else. **Cause:**
  the peer gate (§05.1) plus the pin. **Fix:** move TypeScript first, alone — topic 01's `17c`
  already prescribes this order; link it rather than repeating.
- **Symptom:** Node 20 CI stopped working after v22. **Cause:** the v22.0.0 CLI breaking change
  (§12.3).
- **Symptom:** `zone.js` peer warnings in a zoneless project. **Cause:** it is an optional peer, so
  the warning is not fatal (§12.4, §05.1).

### 12.6 Interview questions

- **★ Which Angular package declares the TypeScript peer, and which does not?**
  `@angular/compiler-cli`, `@angular/build` and `@angular-devkit/build-angular` do;
  `@angular/core` does not (§12.1).
- **★ What happens today if you run `npm install typescript@latest` in an Angular 22 app?** You get
  TypeScript 7.0.2 and violate the peer range (§12.2).
- **How wide is Angular's TypeScript support window historically?** One to two minors, consistently,
  read off the compatibility table (§12.3).
- **What does `zone.js` being an optional peer tell you about v22?** That zoneless is the default and
  the polyfill is opt-in (§12.4).

---

## Chunk 13 — The tsconfig split

### 13.1 The three files, and the one-line rule

| File | Written by | Purpose (angular.dev, verbatim) |
|---|---|---|
| `tsconfig.json` | the **workspace** schematic | *"The base TypeScript configuration for projects in the workspace. All other configuration files inherit from this base file."* |
| `tsconfig.app.json` | the **application** schematic (`common-files`) | *"Application-specific TypeScript configuration, including Angular compiler options."* |
| `tsconfig.spec.json` | the **application** schematic (`common-files`) | *"TypeScript configuration for application tests."* |

— https://angular.dev/reference/configs/file-structure

Libraries get two more: *"`tsconfig.lib.json` — Library-specific TypeScript Configuration, including
Angular compiler options"* and *"`tsconfig.lib.prod.json` — Library-specific TypeScript Configuration
that is used when building the library in production mode."*, plus their own `tsconfig.spec.json`.

### 13.2 🔴 The root `tsconfig.json`, verbatim from the template

[`packages/schematics/angular/workspace/files/tsconfig.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/tsconfig.json.template)
at `v22.1.7`, complete and unedited:

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

So a **default (strict) v22 workspace `tsconfig.json`** resolves to:

```json
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

### 13.3 🔴🔴 The observation that makes this chunk: `"strict": true` is gone

Look at §13.2 again. The **strict** branch does **not** set `"strict": true`. The **non-strict**
branch sets `"strict": false`. Neither branch sets `"strictTemplates": true`.

Both absences have the same cause: **the defaults moved underneath the template.**

**(a) `strictTemplates` defaults to `true` in Angular 22.** angular.dev, verbatim:

> *"strictTemplates — When `true`, enables strict template type checking. The strictness flags that
> this option enables allow you to turn on and off specific types of strict template type checking.
> See troubleshooting template errors. **Default is `true`.**"*
> — https://angular.dev/reference/configs/angular-compiler-options

(Topic 01's `14f`/`14g` own what it switches. Do not repeat them.)

**(b) `strict` defaults to `true` in TypeScript 6.0.** Proven by reading both compilers, verbatim:

`microsoft/TypeScript` at **`v5.9.2`**,
[`src/compiler/utilities.ts`](https://github.com/microsoft/TypeScript/blob/v5.9.2/src/compiler/utilities.ts):

```ts
export function getStrictOptionValue(compilerOptions: CompilerOptions, flag: StrictOptionName): boolean {
    return compilerOptions[flag] === undefined ? !!compilerOptions.strict : !!compilerOptions[flag];
}
```

`microsoft/TypeScript` at **`v6.0.2`**,
[`src/compiler/utilities.ts`](https://github.com/microsoft/TypeScript/blob/v6.0.2/src/compiler/utilities.ts):

```ts
export function getStrictOptionValue(compilerOptions: CompilerOptions, flag: StrictOptionName): boolean {
    return compilerOptions[flag] === undefined ? (compilerOptions.strict !== false) : !!compilerOptions[flag];
}
```

**`!!compilerOptions.strict`** → **`compilerOptions.strict !== false`**. Absent means off in 5.9;
absent means on in 6.0.

Corroborated by the option declaration in
[`src/compiler/commandLineParser.ts`](https://github.com/microsoft/TypeScript/blob/v6.0.2/src/compiler/commandLineParser.ts),
where the `strict` entry's `defaultValueDescription` is **`false` at `v5.9.2`** and **`true` at
`v6.0.2`**.

🔴 **This is why the v22 template writes `"strict": false` explicitly in the non-strict branch and
writes nothing in the strict branch.** Under TS 6 you must now opt *out*, and the scaffold does
exactly that.

⚠️ **Scope this claim carefully.** What was verified here is `getStrictOptionValue`, the function
every individual strict flag (`strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`,
`useUnknownInCatchVariables`, …) resolves through. ✅ **The release notes have since been read
(2026-09-09) and corroborate it** — see §99.8, which is now closed. Cite both sources; do **not**
repeat the old "the release notes were not checked" caveat.

### 13.4 The rest of the root options, and why each is there

- **`"module": "preserve"`** — implies `moduleResolution: "bundler"`, which is why no
  `moduleResolution` key appears. The build system bundles; TypeScript emits nothing.
- **`"target": "ES2022"`** — 🔴 note this is the *TypeScript* target; the deployed downlevelling is
  the build system's job via `browserslist` (`"browserslist": "^4.26.0"` in `@angular/build`'s
  dependencies, §08.1).
- **`"isolatedModules": true`** — required by a per-file transpiler; esbuild is one.
- **`"experimentalDecorators": true`** — Angular's decorators are the TS-legacy kind, not the
  ES/stage-3 kind. This one line is the whole answer to "are Angular decorators standard
  decorators?" (⚠️ the *reason* is not stated in the template; present the flag as fact and the
  inference as inference).
- **`"importHelpers": true`** — pairs with the `tslib` dependency the scaffold adds.
- **`"skipLibCheck": true`** — skips `.d.ts` checking.
- **`"compileOnSave": false`** and **`"files": []`** — the root config compiles nothing itself.
- **`"enableI18nLegacyMessageIdFormat": false`** — the one `angularCompilerOptions` entry that is
  present in *both* branches.

⚠️ **`references` is added, not templated.** The application schematic appends TypeScript project
references pointing at the two child configs:

```ts
function addTsProjectReference(...paths: string[]) {
  return (host: Tree) => {
    if (!host.exists('tsconfig.json')) { return host; }
    const newReferences = paths.map((path) => ({ path }));
    const file = new JSONFile(host, 'tsconfig.json');
    const jsonPath = ['references'];
    const value = file.get(jsonPath);
    file.modify(jsonPath, Array.isArray(value) ? [...value, ...newReferences] : newReferences);
  };
}
```

called as:

```ts
addTsProjectReference('./' + join(normalize(appDir), 'tsconfig.app.json')),
options.skipTests || options.minimal
  ? noop()
  : addTsProjectReference('./' + join(normalize(appDir), 'tsconfig.spec.json')),
```

— [`application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts).

🔴 **`"references"` in the root `tsconfig.json` is a v22-era detail** and explains a key that is not
in the template. ⚠️ I did **not** verify what the build system does with the references (whether it
runs TypeScript in build-mode). See §99.9.

### 13.5 `tsconfig.app.json`, verbatim

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

**Three jobs and nothing else:** extend the base, set `"types": []` (no ambient `@types` leak into
app code), include the sources, exclude the specs.

🔴 **`"types": []` is the load-bearing line.** Without it, every `@types/*` package in
`node_modules` — including `@types/node` and `@types/jasmine` — is ambiently available to
browser code. That is how `process.env` starts type-checking in a browser bundle and then fails at
runtime.

### 13.6 `tsconfig.spec.json`, verbatim

[`…/common-files/tsconfig.spec.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/tsconfig.spec.json.template):

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

🔴 **`"types": ["vitest/globals"]` in a default v22 project** — the mirror image of §13.5. The spec
config exists precisely to widen `types` for one directory's worth of files. Under
`--test-runner=karma` it is `["jasmine"]` instead.

⚠️ **The `include` differs by `standalone`**: a standalone project includes only `*.spec.ts` (plus
`.d.ts`); a `--standalone false` project includes **all** `src/**/*.ts`. Non-obvious, sourced,
worth a sentence.

### 13.7 Where `strictTemplates` and friends live now

The full `angularCompilerOptions` surface is documented at
https://angular.dev/reference/configs/angular-compiler-options. Entries worth quoting here, verbatim:

> *"strictInjectionParameters — When `true`, reports an error for a supplied parameter whose
> injection type cannot be determined. When `false`, constructor parameters of classes marked with
> `@Injectable` whose type cannot be resolved produce a warning. The recommended value is `true`, but
> the default value is `false`. When you use the Angular CLI command `ng new --strict`, it is set to
> `true` in the created project's configuration."*
>
> *"strictStandalone — When `true`, reports an error if a component, directive, or pipe is not
> standalone."*

⚠️ **That `strictInjectionParameters` entry says `ng new --strict`, but `strict` defaults to `true`
in v22** (§Chunk 16). The doc sentence predates the default flip. See §100.6.

⚠️ **The compiler-options page also still documents `skipTemplateCodegen`, `strictMetadataEmit`,
`skipMetadataEmit`, `.metadata.json`, `.ngfactory.js` and `.ngstyle.js`** — all View-Engine-era.
Topic 01 owns the compiler; do not import that vocabulary into this topic. Mention only that the
page carries historical options.

### 13.8 Gotchas to write

- **Symptom:** `process.env` type-checks in a component and crashes in the browser. **Cause:**
  `types` was widened in `tsconfig.app.json` or the `"types": []` line was removed (§13.5). **Fix:**
  restore `"types": []` and inject configuration instead.
- **Symptom:** a `.spec.ts` compiles in the IDE but not under `ng build`. **Cause:**
  `tsconfig.app.json` excludes specs; the IDE may be using the root config (§13.5).
- **Symptom:** `describe`/`it` are untyped after switching runners. **Cause:** `tsconfig.spec.json`'s
  `types` array names one runner (§13.6). **Fix:** show both values.
- **Symptom:** `strict` was never `true` in your `tsconfig.json` and yet strict errors appear.
  **Cause:** TypeScript 6.0 made it the default (§13.3). **Fix:** if you genuinely want it off,
  `"strict": false` — the same line the non-strict template writes.
- **Symptom:** you set `"strictTemplates": true` and nothing changed. **Cause:** it is already the
  default in v22 (§13.3).
- **Symptom:** an unfamiliar `"references"` array in the root config. **Cause:** the application
  schematic added it (§13.4).

### 13.9 Interview questions

- **★ Why are there three tsconfig files rather than one?** Because `types` and `include` must differ
  between app code and test code, and both must share everything else (§13.5, §13.6).
- **★ A v22 `tsconfig.json` does not contain `"strict": true`. Is the project strict?** Yes —
  TypeScript 6.0 flipped the default, and the non-strict scaffold now writes `"strict": false`
  explicitly (§13.3).
- **What does `"types": []` do and why does it matter?** §13.5.
- **Why is `experimentalDecorators` still on in 2026?** Angular's decorators are the TS-legacy form
  (§13.4) — state the flag as fact, the reasoning as reasoning.
- **Where does `strictTemplates` live and what is its default?** `angularCompilerOptions`, `true`
  since v22 (§13.3), with topic 01's `14f` for what it switches.

---

## Chunk 14 — The file tree `ng new` writes

### 14.1 🔴 Provenance rule for this chunk — read it before writing a tree

**There was no sandbox. No `ng new` was run.** Everything below is the **schematic's own template
file list**, read from `angular/angular-cli` at tag `v22.1.7` via
`gh api "repos/angular/angular-cli/git/trees/v22.1.7?recursive=1"`. A page that shows a tree must
say **"reconstructed from the CLI's own schematic templates at v22.1.7"**, not "here is what you
get".

⚠️ **What this method cannot tell you:** the exact ordering of a directory listing, file sizes, and
anything produced by `npm install` rather than by the schematic. Do not invent those.

### 14.2 The template inventory, verbatim from the tree

**Workspace schematic** — `packages/schematics/angular/workspace/files/`:

```
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
```

**Application schematic** — `packages/schematics/angular/application/files/`:

```
common-files/
  public/favicon.ico.template
  src/app/app__suffix__.html.template
  src/index.html.template
  src/styles.__style__.template
  tsconfig.app.json.template
  tsconfig.spec.json.template

standalone-files/
  src/app/app.config.ts.template
  src/app/app.routes.ts.template
  src/app/app__suffix__.spec.ts.template
  src/app/app__suffix__.ts.template
  src/main.ts.template

module-files/
  src/app/app__suffix__.spec.ts.template
  src/app/app__suffix__.ts.template
  src/app/app__typeSeparator__module.ts.template
  src/main.ts.template
```

Plus one file from a *third* schematic: the application schematic delegates the root component's
stylesheet to `schematic('component', …)` (§14.4).

### 14.3 The resulting tree for a default `ng new my-app`

Defaults in force (all from §Chunk 16): `standalone: true`, `routing: true`, `zoneless: true`,
`style: 'css'`, `strict: true`, `skipTests: false`, `ssr: false`, `testRunner: 'vitest'`,
`fileNameStyleGuide: '2025'` (so `suffix` is the empty string and there is no `.component` infix).

```
my-app/
├── .editorconfig
├── .gitignore
├── .prettierrc
├── .vscode/
│   ├── extensions.json
│   ├── launch.json
│   └── tasks.json
├── README.md
├── angular.json
├── package.json
├── public/
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── app.config.ts
│   │   ├── app.css
│   │   ├── app.html
│   │   ├── app.routes.ts
│   │   ├── app.spec.ts
│   │   └── app.ts
│   ├── index.html
│   ├── main.ts
│   └── styles.css
├── tsconfig.app.json
├── tsconfig.json
└── tsconfig.spec.json
```

⚠️ **`app.css` is generated by the delegated `component` schematic, not by a template in this
list.** Say so, or omit it. ⚠️ **`node_modules/` and the lockfile come from the install step, not
the schematic** — mention them in prose, not in the tree.

🔴 **Three things a reader coming from v17 will get wrong:**
1. **`public/`, not `src/assets/`.** The asset glob in `angular.json` points at `<root>public`
   (§10.2).
2. **`app.ts`, not `app.component.ts`.** That is `fileNameStyleGuide: '2025'` (§Chunk 16).
3. **No `src/environments/`.** It is `ng generate environments`, on demand (§11.3).

### 14.4 The naming machinery, from the code

```ts
const suffix = options.fileNameStyleGuide === '2016' ? '.component' : '';
const typeSeparator = options.fileNameStyleGuide === '2016' ? '.' : '-';
```

— [`application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts).

So `app__suffix__.ts.template` becomes `app.ts` under the 2025 guide and `app.component.ts` under
the 2016 guide. And the root component is generated by delegation:

```ts
schematic('component', {
  name: 'app',
  selector: appRootSelector,
  flat: true,
  path: sourceDir,
  skipImport: true,
  project: options.name,
  ...componentOptions,
}),
```

with `appRootSelector = \`${options.prefix}-root\`` — i.e. **`app-root`** by default.

Files are filtered out rather than conditionally generated:

```ts
options.routing ? noop() : filter((path) => !path.endsWith('app.routes.ts.template')),
componentOptions.skipTests ? filter((path) => !path.endsWith('.spec.ts.template')) : noop(),
```

```ts
options.minimal ? filter((path) => !path.endsWith('tsconfig.spec.json.template')) : noop(),
componentOptions.inlineTemplate ? filter((path) => !path.endsWith('app__suffix__.html.template')) : noop(),
```

**So: `--no-routing` drops `app.routes.ts`; `--skip-tests` drops every `.spec.ts`; `--minimal` drops
`tsconfig.spec.json`; `--inline-template` drops `app.html`.** Each is one filter line, and a page can
state each with confidence.

### 14.5 `index.html`, verbatim

[`common-files/src/index.html.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/src/index.html.template):

```html
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

For `ng new my-app`: `<title>MyApp</title>` and `<app-root></app-root>`.

🔴 **There is no `<script>` tag.** The build system injects them. The doc page says so, verbatim:

> *"index.html — The main HTML page that is served when someone visits your site. The CLI
> automatically adds all JavaScript and CSS files when building your app, so you typically don't need
> to add any `<script>` or `<link>` tags here manually."*
> — https://angular.dev/reference/configs/file-structure

🔴 **`<base href="/">` is required by the router**, and its absence is a classic deployment bug. One
sentence, and forward-reference the routing phase.

### 14.6 `package.json`, verbatim from the template

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

and the *application* schematic adds three more devDependencies on top:

```ts
const APPLICATION_DEV_DEPENDENCIES = [
  { name: '@angular/compiler-cli', version: latestVersions.Angular },
  { name: '@angular/build', version: latestVersions.AngularBuild },
  { name: 'typescript', version: latestVersions['typescript'] },
];
```

— [`application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts),
each added with `ExistingBehavior.Skip`.

🔴 **`@angular/compiler` is a runtime `dependency` in the scaffold**, even though it is an
*optional* peer of `core` (§12.4) and AOT does not need it at runtime. Note it; Chunk 20 explains
what it is doing there.

🔴 **`prettier` is a scaffolded devDependency in v22**, alongside the `.prettierrc` template — and
§06.5 showed `ng update`'s migrations run Prettier over every file they touch. Connect the two.

The version placeholders resolve through
[`utility/latest-versions.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/utility/latest-versions.ts):

```ts
const dependencies = require('./latest-versions/package.json')['dependencies'];

export const latestVersions: Record<string, string> & {
  Angular: string; DevkitBuildAngular: string; AngularBuild: string;
  AngularSSR: string; NgPackagr: string;
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

⚠️ **The `0.0.0-…-PLACEHOLDER` strings are substituted at release time.** They are *not* what a
generated `package.json` contains. Do **not** show them as output. The real values for the
third-party pins **are** readable, verbatim from
[`utility/latest-versions/package.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/utility/latest-versions/package.json)
at `v22.1.7`:

```json
"prettier": "^3.8.1",
"rxjs": "~7.8.0",
"tslib": "^2.3.0",
"typescript": "~6.0.2",
"zone.js": "~0.16.0",
"vitest": "^4.0.8",
"@vitest/coverage-v8": "^4.0.8",
"@vitest/coverage-istanbul": "^4.0.8",
"@vitest/browser-playwright": "^4.0.8",
"@vitest/browser-webdriverio": "^4.0.8",
"@vitest/browser-preview": "^4.0.8",
"jsdom": "^28.0.0",
"playwright": "^1.48.0",
"webdriverio": "^9.0.0",
"karma": "~6.4.0",
"jasmine-core": "~6.3.0",
"@types/jasmine": "~6.0.0",
"@types/node": "^20.17.19",
"@types/express": "^5.0.1",
"express": "^5.1.0",
"less": "^4.2.0",
"postcss": "^8.5.3",
"tailwindcss": "^4.1.12",
"@tailwindcss/postcss": "^4.1.12",
"istanbul-lib-instrument": "^6.0.3",
"browser-sync": "^3.0.0",
"jasmine-spec-reporter": "~7.0.0",
"karma-chrome-launcher": "~3.2.0",
"karma-coverage": "~2.2.0",
"karma-jasmine": "~5.1.0",
"karma-jasmine-html-reporter": "~2.2.0"
```

The file's own header comment, verbatim:
*"Package versions used by schematics in @schematics/angular."* /
*"This file is needed so that dependencies are synced by Renovate."*

🔴 **`tailwindcss` and `@tailwindcss/postcss` are in the v22 scaffold's version list**, and
`ng new --style=tailwind` delegates to a `tailwind` schematic
(`isTailwind ? schematic('tailwind', {…}) : noop()` in `application/index.ts`). Worth one line in
Chunk 16.

### 14.7 `.gitignore`, verbatim

[`workspace/files/__dot__gitignore.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/__dot__gitignore.template),
complete:

```
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

🔴 Three details worth a sentence each: **`/.angular/cache`** (§10.5); **`!.vscode/mcp.json`** — the
scaffold expects an MCP config, matching the CLI's own MCP server work in the 22.1.x changelog; and
**`__screenshots__/`** — Vitest browser-mode screenshots, matching the Vitest default.

### 14.8 The docs' file-structure page is stale — bank the discrepancy, do not repeat it

https://angular.dev/reference/configs/file-structure still describes, verbatim:

> *"app.component.ts — Defines the application's root component, named `AppComponent`."* ·
> *"app.component.html"* · *"app.component.css"* · *"app.component.spec.ts"* ·
> *"app.module.ts — Defines the root module, named `AppModule` … Only generated when using the
> `--standalone false` option."* ·
> *"app.config.ts — … Only generated when using the `--standalone` option."*

🔴 **All of that is the 2016 naming guide and the pre-v22 default.** In v22, `--standalone` is the
default (§Chunk 16) and the file names have no `.component` infix (§14.4). **The schematic templates
win.** Say on the page that the docs page lags, and cite both. See §100.7.

The page's own file-tree section for `src/` also still lists `favicon.ico` at the top level of
`src/`; the v22 template puts it at `public/favicon.ico`. Same treatment.

### 14.9 Gotchas to write

- **Symptom:** a tutorial says to edit `src/app/app.component.ts` and there is no such file.
  **Cause:** `fileNameStyleGuide: '2025'` (§14.4). **Fix:** `--file-name-style-guide=2016` to
  reproduce the old names, or read `app.ts`.
- **Symptom:** assets in `src/assets/` are not copied. **Cause:** the asset glob points at `public/`
  (§10.2, §14.3). **Fix:** move them, or add an `assets` entry — show the object form.
- **Symptom:** an image `<img src="assets/x.png">` 404s. **Cause:** same. **Fix:** `public/x.png`
  serves at `/x.png`.
- **Symptom:** routing breaks when deployed to a subdirectory. **Cause:** `<base href="/">`
  (§14.5).
- **Symptom:** `src/environments/` missing. **Cause:** §11.3.
- **Symptom:** the generated project already has Prettier opinions. **Cause:** `.prettierrc` is
  scaffolded and `prettier` is a devDependency (§14.6).

### 14.10 Interview questions

- **★ What is in `public/` and how did it get there?** The asset directory; the `assets` glob in
  `angular.json` points at it, and `favicon.ico` is the only template file in it (§14.2, §10.2).
- **★ Why is there no `<script>` tag in `index.html`?** The build system injects them (§14.5).
- **Which files does `--no-routing` remove?** Exactly one: `app.routes.ts`, by a filter line
  (§14.4).
- **Where does the `app-root` selector come from?** `${options.prefix}-root`, prefix defaulting to
  `app` (§14.4).
- **Why is `@angular/compiler` a runtime dependency of a scaffolded app?** §14.6, answered in
  Chunk 20.

---

## Chunk 15 — The generated files, line by line

### 15.1 `main.ts`, verbatim

[`standalone-files/src/main.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/standalone-files/src/main.ts.template):

```
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app<%= suffix %>';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
```

Five lines. 🔴 **`bootstrapApplication` is topic 02's subject** —
`02-standalone-by-default/01-bootstrapapplication-line-by-line.md` already covers it line by line.
**Link, do not re-explain.** What this chunk owns is that the file is *this short*, and that
`.catch(console.error)` is the only error handling the scaffold gives you at bootstrap
(forward-reference topic 03's `06-startup-and-error-listener-providers.md` for
`provideBrowserGlobalErrorListeners`).

For contrast, the **NgModule** variant,
[`module-files/src/main.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/module-files/src/main.ts.template)
— read it if the page wants the `--standalone false` comparison; I did not fetch it, so do not quote
it from memory (§99.10).

### 15.2 `app.config.ts`, verbatim

[`standalone-files/src/app/app.config.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/standalone-files/src/app/app.config.ts.template):

```
import { ApplicationConfig, provideBrowserGlobalErrorListeners<% if (!zoneless) { %>, provideZoneChangeDetection<% } %> } from '@angular/core';<% if (routing) { %>
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';<% } %>

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),<% if (!zoneless) { %>
    provideZoneChangeDetection({ eventCoalescing: true }),<% } %>
    <% if (routing) { %>provideRouter(routes)<% } %>
  ]
};
```

Resolved for the **default v22** (`zoneless: true`, `routing: true`):

```ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes)
  ]
};
```

🔴 **Two providers.** Not three, and **no `provideZonelessChangeDetection()`** — zoneless is the
default, so nothing is written for it. Topic 03's `05-change-detection-providers.md` already proves
that from the token side and topic 03's bank calls it "the headline". **Link; do not re-derive.**

🔴 **`provideZoneChangeDetection({ eventCoalescing: true })` is what `--no-zoneless` writes.** Note
the option — the zone-based scaffold is not the bare `provideZoneChangeDetection()`.

### 15.3 `app.routes.ts`, verbatim

[`standalone-files/src/app/app.routes.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/standalone-files/src/app/app.routes.ts.template),
complete — three lines, no template syntax at all:

```ts
import { Routes } from '@angular/router';

export const routes: Routes = [];
```

The one thing to say about it: **the array is exported separately from `app.config.ts` so that it
can be code-split and so that `provideRouter(routes)` has one and only one argument.** Everything
else is the routing phase.

### 15.4 `app.ts` (the root component), verbatim

[`standalone-files/src/app/app__suffix__.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/standalone-files/src/app/app__suffix__.ts.template):

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
  `,<% } %><% else { %>
  templateUrl: './app<%= suffix %>.html',<% } %>
})
export class App {
  protected readonly title = signal('<%= name %>');
}
```

⚠️ **I reproduced the `<% } %><% else { %>` sequence as it appears in the fetched file; if a chunk
quotes this template verbatim, re-fetch and re-check that one line** — EJS `else` placement is
easy to transcribe wrong, and this is the kind of detail the corpus is held to. Everything else in
the block was read directly.

Resolved for the default:

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

🔴 **Four things a v22 reader should notice, each one sentence:**
1. **No `standalone: true`.** It is the default since v19 — topic 02 owns this; link
   `03-standalone-by-default-which-version-changed-what.md`.
2. **`imports: [RouterOutlet]` on a component**, not a module — topic 02's
   `04-what-imports-actually-means.md`.
3. **`protected readonly title = signal(...)`** — the scaffold's default state primitive is a
   signal, and `protected` because it is used from the template and nowhere else. Phase 2 owns
   signals.
4. **`styleUrl`, singular** — not `styleUrls`.

And the template it points at,
[`common-files/src/app/app__suffix__.html.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/src/app/app__suffix__.html.template)
— ⚠️ **I did not fetch this file.** It is in the template list but I never read its contents. Do not
invent the welcome page. See §99.11.

### 15.5 Gotchas to write

- **Symptom:** you add `provideZonelessChangeDetection()` to a v22 `app.config.ts` and get an
  NG0914 warning. **Cause:** it is already the default. **Fix:** remove it; topic 03's
  `05-change-detection-providers.md` has the error verbatim — link it.
- **Symptom:** a bootstrap error is only visible as a bare `console.error`. **Cause:** `main.ts`'s
  `.catch` is the whole handler (§15.1). **Fix:** `provideBrowserGlobalErrorListeners()` covers
  runtime errors, not the bootstrap rejection — be precise about which.
- **Symptom:** `styleUrls` (plural) in a copied snippet does not match the scaffold. **Cause:**
  §15.4.
- **Symptom:** `title` is inaccessible from a parent component. **Cause:** `protected` (§15.4).
- **Symptom:** `--no-zoneless` produced `provideZoneChangeDetection({ eventCoalescing: true })` and
  you expected the bare call. **Cause:** §15.2.

### 15.6 Interview questions

- **★ How many providers does a default v22 `app.config.ts` contain, and which?** Two:
  `provideBrowserGlobalErrorListeners()` and `provideRouter(routes)` (§15.2).
- **★ Why is there no `provideZonelessChangeDetection()` in a zoneless v22 app?** Because zoneless
  is the default and nothing needs to be written (§15.2).
- **Why is `routes` in its own file?** §15.3.
- **What does `protected readonly title = signal('my-app')` tell you about Angular's defaults in
  2026?** Signals are the scaffolded state primitive, and template-only members are `protected`
  (§15.4).

---

## Chunk 16 — The `ng new` option matrix

### 16.1 🔴 Every option and its real default, from the schema

From
[`packages/schematics/angular/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/schema.json)
at `v22.1.7`. **Defaults read from the file, not remembered.** Only `name` is required.

| Option | Type | Default | Description (verbatim, trimmed at 130 chars) |
|---|---|---|---|
| `name` | string | — | *"The name for the new application. This name will be used for the project directory and various identifiers throughout the applicat…"* |
| `projectRoot` | string | — | *"The directory where the new application's files will be created, relative to the workspace root. If not specified, the application…"* |
| `routing` | boolean | **`true`** | *"Generate an application with routing already configured. This sets up the necessary files and modules for managing navigation betw…"* |
| `standalone` | boolean | **`true`** | *"Create an application that utilizes the standalone API, eliminating the need for NgModules. This can simplify the structure of you…"* |
| `zoneless` | boolean | **`true`** | *"Generate an application that does not use `zone.js`."* |
| `strict` | boolean | **`true`** | *"Enable stricter bundle budget settings for the application. This helps to keep your application's bundle size small and improve pe…"* |
| `testRunner` | string | **`'vitest'`** | *"The unit testing runner to use."* |
| `fileNameStyleGuide` | string | **`'2025'`** | *"The file naming convention to use for generated files. The '2025' style guide (default) uses a concise format (e.g., `app.ts` for …"* |
| `style` | string | **`'css'`** | *"The type of stylesheet files to be created for components in the application."* |
| `prefix` | string | **`'app'`** | *"A prefix to be added to the selectors of components generated within this application…"* |
| `ssr` | boolean | **`false`** | *"Configure the application for Server-Side Rendering (SSR) and Static Site Generation (SSG/Prerendering)."* |
| `skipTests` | boolean | **`false`** | *"Skip the generation of a unit test files `spec.ts`."* |
| `minimal` | boolean | **`false`** | *"Generate a minimal project without any testing frameworks. This is intended for learning purposes and simple experimentation, not …"* |
| `skipInstall` | boolean | **`false`** | *"Skip the automatic installation of packages. You will need to manually install the dependencies later."* |
| `skipPackageJson` | boolean | **`false`** | *"Do not add dependencies to the `package.json` file."* |
| `inlineStyle` | boolean | — | *"Include the styles for the root component directly within the `app.ts` file. Only CSS styles can be included inline. By default, a…"* |
| `inlineTemplate` | boolean | — | *"Include the HTML template for the root component directly within the `app.ts` file. By default, a separate template file (e.g., `a…"* |
| `viewEncapsulation` | string | — | *"Sets the view encapsulation mode for the application's components. This determines how component styles are scoped and applied."* |

🔴 **The four defaults that define v22 as a version**, and each has a visible consequence banked
elsewhere:

| Default | Consequence, and where it is proven |
|---|---|
| `standalone: true` | no `NgModule` anywhere — topic 02 |
| `zoneless: true` | no `zone.js` dependency (§12.4), no `polyfills` key (§10.2), two providers not three (§15.2) |
| `testRunner: 'vitest'` | `@angular/build:unit-test` with empty options (§10.2), `"types": ["vitest/globals"]` (§13.6), `__screenshots__/` gitignored (§14.7) |
| `fileNameStyleGuide: '2025'` | `app.ts` / `app.html` / `app.css` (§14.4), and the docs page lags (§14.8) |

🔴 **`strict: true` means "bundle budgets", not "TypeScript strict".** The description says so
verbatim: *"Enable stricter bundle budget settings"*. It **also** flips
`strictInjectionParameters`/`strictInputAccessModifiers` in `tsconfig.json` (§13.2) — two effects,
one flag. And since TypeScript 6.0 made `strict` default-true (§13.3), `--no-strict` no longer
turns TypeScript strictness off by omission; it writes `"strict": false` explicitly.

### 16.2 What `--minimal` actually removes

Traced through the code (§10.2, §10.4, §14.4):

- no `test` target in `angular.json` (`options.skipTests || options.minimal ? undefined : …`)
- no `tsconfig.spec.json` (filtered out)
- no `"test": "ng test"` script in `package.json` (`<% if (!minimal) { %>`)
- `skipTests: true` written into eight `@schematics/angular:*` entries (§10.4)
- inline style and inline template default to `true`:
  ```ts
  : {
      inlineStyle: options.inlineStyle ?? true,
      inlineTemplate: options.inlineTemplate ?? true,
      skipTests: true,
      …
    };
  ```

and the schema's own warning, verbatim: *"This is intended for learning purposes and simple
experimentation, not …"* — quote the full sentence from the schema when writing the page.

### 16.3 `--style=tailwind` is a fifth value, not a preprocessor

```ts
const isTailwind = options.style === Style.Tailwind;
if (isTailwind) {
  options.style = Style.Css;
}
…
isTailwind
  ? schematic('tailwind', { project: options.name, skipInstall: options.skipInstall })
  : noop(),
```

— [`application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts).

**Tailwind is CSS plus a delegated schematic**, and `tailwindcss: ^4.1.12` +
`@tailwindcss/postcss: ^4.1.12` are in the version list (§14.6). ⚠️ I did **not** read the `tailwind`
schematic, so do not describe what it writes (§99.12).

`inlineStyleLanguage` in `angular.json` is set only when the style is not CSS:

```ts
const inlineStyleLanguage = options?.style !== Style.Css ? options.style : undefined;
```

— so a Tailwind project, having been rewritten to CSS, gets **no** `inlineStyleLanguage` key either.

### 16.4 `--ssr` delegates too

```ts
options.ssr
  ? schematic('ssr', { project: options.name, skipInstall: true })
  : noop(),
```

Topic 03's `17-the-server-config-merge/` already documents the generated server files at CLI 22.1.7
(its bank §17.2). **Link there rather than re-fetching.**

### 16.5 Where a workspace-level default overrides the flag

The workspace `angular.json` template writes `cli.packageManager` (§10.1) and `newProjectRoot`; the
project block writes `schematics` (§10.4). So *some* `ng new` flags become permanent workspace
config and others are one-shot. That distinction — **"which fields you set and which are scaffolding
you never touch again"**, the syllabus's own phrasing — is best made as a table:

| `ng new` flag | Where it survives |
|---|---|
| `--prefix` | `projects.<name>.prefix` — read by every future `ng generate` |
| `--style` (non-css) | `schematics['@schematics/angular:component'].style` and `inlineStyleLanguage` |
| `--skip-tests`, `--minimal` | `skipTests: true` on eight schematics |
| `--no-standalone` | `standalone: false` on three schematics |
| `--file-name-style-guide=2016` | `type`/`addTypeToClassName`/`typeSeparator` on eight schematics |
| `--package-manager` | `cli.packageManager` |
| `--zoneless`, `--routing`, `--ssr`, `--strict` | **nowhere** — they shape the initial files and then are gone |

🔴 **That last row is the answer to the syllabus's question.** A project's *ongoing* configuration is
`prefix`, `schematics`, `cli`, and the target `options`/`configurations`. Everything else was a
one-time decision baked into source.

### 16.6 Gotchas to write

- **Symptom:** `--strict` did not make TypeScript stricter the way you expected. **Cause:** it is
  primarily a *budget* flag, plus two `angularCompilerOptions` (§16.1). **Fix:** state the two
  effects.
- **Symptom:** a colleague's generated components have inline templates. **Cause:** `--minimal` or
  `--inline-template` at `ng new` time, persisted into `schematics` (§16.2, §16.5).
- **Symptom:** `ng generate component` produces `.scss` and you never asked. **Cause:** `--style` is
  persisted (§16.5).
- **Symptom:** `--minimal` project cannot run `ng test`. **Cause:** no `test` target, no
  `tsconfig.spec.json`, no npm script (§16.2). **Fix:** re-add all three; show them.
- **Symptom:** you want the old `app.component.ts` names. **Fix:** `--file-name-style-guide=2016`
  (§14.4) — and note it persists into `schematics` for future generation (§16.5).

### 16.7 Interview questions

- **★ Name the four `ng new` defaults that changed what a "new Angular app" means by v22, and one
  observable consequence of each.** §16.1's second table.
- **★ Does `--strict` control TypeScript's `strict`?** No — bundle budgets plus two Angular compiler
  options; TypeScript's `strict` is on by default under TS 6 regardless (§16.1, §13.3).
- **Which `ng new` choices persist into the project and which are one-shot?** §16.5.
- **What does `--minimal` remove, exactly?** §16.2 — four separate places.
- **Is `--style=tailwind` a stylesheet language?** No: CSS plus a delegated schematic (§16.3).

---

## Chunk 17 — The release train

### 17.1 🔴🔴 STOP — the syllabus and the phase README are both wrong about the cadence

The syllabus row says:

> *"**The release train** — majors every six months (May/June and November), 6 months active support
> plus 12 months LTS…"*
> — `docs/angular/syllabus/01-the-angular-model.md` line 37

**As of v22 that is no longer true, and angular.dev says so explicitly.** Verbatim from
https://angular.dev/reference/releases (page served at v22.1.5, read 2026-09-09):

> *"In general, expect the following release cycle:*
> - *A major release every 12 months*
> - *4-6 minor releases for each major release*
> - *A patch release and pre-release (`next` or `rc`) build almost every week"*

and, in a HELPFUL callout immediately below:

> *"**HELPFUL:** Until Angular v22, Angular had a 6-month major release cycle, with 1-3 minor
> releases for each major release"*

and on support:

> *"**All major releases are typically supported for 24 months.**"*
>
> | Support stage | Support Timing | Details |
> |---|---|---|
> | Active | 12 months | *"Regularly-scheduled updates and patches are released"* |
> | Long-term (LTS) | 12 months | *"Only critical fixes and security patches are released"* |

🔴 **12-month majors, 12 months active + 12 months LTS = 24 months.** Not 6 + 6 + 12. This is the
single most important correction in the whole bank; a page written from the syllabus row would be
wrong on the topic's headline fact. **Report it; do not silently fix the syllabus** (§100.8).

### 17.2 The live schedule, verbatim

**Release schedule**, from the same page:

| Version | Date |
|---|---|
| v22.1 | *Week of 2026-07-27* |
| v22.2 | *~ September 2026* |
| v22.3 | *~ November 2026* |
| v22.4 | *~ January 2027* |
| v22.5 | *~ March 2027* |
| v23.0 | *~ June 2027* |

**Actively supported versions**, verbatim:

| Version | Status | Released | Active ends | LTS ends |
|---|---|---|---|---|
| `^22.0.0` | Active | 2026-06-03 | 2027-06 | 2028-06 |
| `^21.0.0` | LTS | 2025-11-19 | 2026-06-03 | 2027-06 |
| `^20.0.0` | LTS | 2025-05-28 | 2025-11-19 | 2026-11-28 |

> *"Angular versions v2 to v19 are no longer supported."*

🔴 **v20 and v21 are six months apart (2025-05-28, 2025-11-19) and v22 and v23 are twelve
(2026-06-03, ~2027-06).** The table *contains* the cadence change as data. That is the best
possible illustration and it costs one sentence.

🔴 **Five minors planned for v22 (22.1 through 22.5)** matches *"4-6 minor releases"*. And the
corpus's own spine sits at 22.1.x — so a reader can see where they are on the train.

⚠️ **Both tables carry the caveat** *"Approximate dates are offered as general guidance and are
subject to change."* / *"Dates are offered as general guidance and are subject to change."* Quote
it; the corpus should not present ~November 2026 as a commitment.

### 17.3 What each level of change means, verbatim

> | Level of change | Details |
> |---|---|
> | **Major release** | *"Contains significant new features, some but minimal developer assistance is expected during the update. When updating to a new major release, you might need to run update scripts, refactor code, run additional tests, and learn new APIs."* |
> | **Minor release** | *"Contains new smaller features. Minor releases are fully backward-compatible; no developer assistance is expected during update, but you can optionally modify your applications and libraries to begin using new APIs, features, and capabilities that were added in the release. **We update peer dependencies in minor versions by expanding the supported versions, but we do not require projects to update these dependencies.**"* |
> | **Patch release** | *"Low risk, bug fix release. No developer assistance is expected during update."* |
> — https://angular.dev/reference/releases

🔴 **The bolded sentence is what §12.3's Node-range drift is** — the floors moved from `^22.22.0 ||
^24.13.1` at 22.0.0 to `^22.22.3 || ^24.15.0` at 22.1.7. Use the real numbers as the worked example
of the rule.

And the CLI/core alignment, verbatim:

> *"**HELPFUL:** As of Angular version 7, the major versions of Angular core and the CLI are aligned.
> This means that in order to use the CLI as you develop an Angular app, the version of
> `@angular/core` and the CLI need to be the same."*

⚠️ **"the same" is loose.** In practice the *majors* align and the patches do not: core is 22.1.5,
CLI is 22.1.7 (§0.1). Quote the sentence and then state the observed reality with the numbers.

### 17.4 Pre-release channels, verbatim

> | Pre-release type | Details |
> |---|---|
> | Next | *"The release that is under active development and testing. The next release is indicated by a release tag appended with the `-next` identifier, such as `8.1.0-next.0`."* |
> | Release candidate | *"A release that is feature complete and in final testing. A release candidate is indicated by a release tag appended with the `-rc` identifier, such as version `8.1.0-rc.0`."* |
>
> *"The latest `next` or `rc` pre-release version of the documentation is available at
> `next.angular.dev`."*

Live proof, from the dist-tags (§0.1): `@angular/core` `next` is **22.2.0-next.5**, `@angular/cli`
`next` is **22.2.0-next.6**. That is `--next` on `ng update` (§03.1) pointing at something real.

### 17.5 The deprecation policy, verbatim — and why it dates every deprecation in this corpus

> *"When the Angular team intends to remove an API or feature, it will be marked as deprecated. This
> occurs when an API is obsolete, superseded by another API, or otherwise discontinued. Deprecated
> API remain available through their deprecated phase, which lasts a minimum one major version
> (approximately one year)."*
>
> **Announcement** — *"We announce deprecated APIs and features in the change log. Deprecated APIs
> appear in the documentation with strikethrough. When we announce a deprecation, we also announce a
> recommended update path. Additionally, all deprecated APIs are annotated with `@deprecated` in the
> corresponding documentation, which enables text editors and IDEs to provide hints if your project
> depends on them."*
>
> **Deprecation period** — *"When an API or a feature is deprecated, it is still present in at least
> the next major release (period of at least 12 months). After that, deprecated APIs and features are
> candidates for removal. A deprecation can be announced in any release, but the removal of a
> deprecated API or feature happens only in major release. Until a deprecated API or feature is
> removed, it is maintained according to the LTS support policy, meaning that only critical and
> security issues are fixed."*
>
> **npm dependencies** — *"We only make npm dependency updates that require changes to your
> applications in a major release. In minor releases, we update peer dependencies by expanding the
> supported versions, but we do not require projects to update these dependencies until a future
> major version. This means that during minor Angular releases, npm dependency updates within
> Angular applications and libraries are optional."*
> — https://angular.dev/reference/releases

🔴 **"at least the next major release (period of at least 12 months)"** — under the *new* 12-month
cadence, one major *is* a year. Deprecations announced in 22.0.0 (`@angular-devkit/build-angular`,
`platform-browser-dynamic`, CommonEngine) are therefore candidates for removal in **v23,
~June 2027**. Say it with the date; it is what a reader is actually asking.

### 17.6 Developer Preview and Experimental, verbatim

> **Developer Preview** — *"Occasionally we introduce new APIs under the label of "Developer
> Preview". These are APIs that are fully functional and polished, but that we are not ready to
> stabilize under our normal deprecation policy. This may be because we want to gather feedback from
> real applications before stabilization, or because the associated documentation or migration
> tooling is not fully complete. … The policies and practices that are described in this document do
> not apply to APIs marked as Developer Preview. Such APIs can change at any time, even in new patch
> versions of the framework."*
>
> **Experimental** — *"These APIs might not become stable at all or have significant changes before
> becoming stable. The policies and practices that are described in this document do not apply to
> APIs marked as experimental. Such APIs can change at any time, even in new patch versions of the
> framework."*

🔴 **This is the paragraph that makes `@angular/build:unit-test`'s `[EXPERIMENTAL]` label (§08.4)
mean something concrete** — a project scaffolded by `ng new` in v22 has its test target on a builder
that may change in a patch. State both facts; let the reader weigh it.

### 17.7 The compatibility policy, verbatim

> *"To guarantee backward compatibility of Angular we run a series of checks before we merge any
> change: Unit tests and integration tests; Comparing the type definitions of the public API surface
> before and after the change; Running the tests of all the applications at Google that depend on
> Angular."*
>
> *"Any changes to the public API surface are made in accordance with the versioning, support, and
> depreciation policies previously described. In exceptional cases, such as critical security
> patches, fixes may introduce backwards incompatible changes."*

🔴 **"Comparing the type definitions of the public API surface"** is the golden files
(`goldens/public-api/**/index.api.md`) that this corpus quotes throughout — worth one sentence
connecting the policy to the artefact readers can go and look at.

### 17.8 Gotchas to write

- **Symptom:** you planned two Angular upgrades a year. **Cause:** the six-month cadence ended at
  v22 (§17.1). **Fix:** one major a year, plus 4–6 minors.
- **Symptom:** a version you are on says "LTS" and a security fix you need is not backported.
  **Cause:** LTS is *"Only critical fixes and security patches"* and, per the LTS-fixes rule,
  narrower still (§17.9's quote). **Fix:** upgrade.
- **Symptom:** a peer-dependency floor moved in a patch and CI broke. **Cause:** minors expand peer
  ranges (§17.3), and §12.3 has the real example. **Fix:** read the engines, not the changelog
  headline.
- **Symptom:** a Developer Preview API changed in a patch. **Cause:** the policy explicitly excludes
  it (§17.6).
- **Symptom:** you are on v19 and want v22. **Cause:** v19 is out of support (§17.2) and it is three
  majors (§Chunk 02).

### 17.9 The LTS-fix rule, verbatim (needed by §17.8)

> *"As a general rule, a fix is considered for an LTS version if it resolves one of: A newly
> identified security vulnerability, A regression, since the start of LTS, caused by a 3rd party
> change, such as a new browser version."*
> — https://angular.dev/reference/releases

**Two conditions, and a plain bug is not one of them.** That is the sentence that makes "LTS" mean
something specific.

### 17.10 Interview questions

- **★ How often does Angular ship a major, and how long is it supported?** Every 12 months as of
  v22; 24 months total, 12 active + 12 LTS (§17.1). And the cadence *changed at v22* — a candidate
  who says "every six months" is quoting the pre-v22 policy.
- **★ What is guaranteed to be safe in a minor release, and what is not?** Backward-compatible
  features and expanded peer ranges are; anything marked Developer Preview or Experimental is not
  (§17.3, §17.6).
- **A dependency was deprecated in 22.0.0. When can it be removed?** No earlier than the next major
  — v23, ~June 2027 (§17.5).
- **What actually gets fixed in an LTS release?** Only the two categories in §17.9.
- **How does Angular verify it has not broken its public API?** Type-definition comparison plus the
  Google-wide test run (§17.7).

---

## Chunk 18 — Reading a changelog

### 18.1 The method, and why the changelog beats the update guide for this

`update.angular.dev` is an interactive wizard; a reference page cannot quote it usefully (§99.13).
The **CHANGELOG's `## Breaking Changes` section, grouped by package**, is the artefact a reader can
actually read, diff and search. The whole chunk is: *here is the v22.0.0 section, here is how to
triage it.*

Both files, at the pinned tags:
[`angular/angular` CHANGELOG](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md) ·
[`angular/angular-cli` CHANGELOG](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md).

**Structure to describe:** newest release first; each release is `# <version> (<date>)`; a major
carries `## Breaking Changes` and `## Deprecations` **before** the per-package commit tables; every
other release is per-package commit tables only. So **`grep -n '^## Breaking Changes'` finds every
major** — a genuinely useful reading technique, and it costs one line.

### 18.2 The framework's v22.0.0 breaking changes, verbatim and complete

From [`angular/angular` CHANGELOG, `# 22.0.0 (2026-06-03)`](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md):

**compiler**
> - *"This change will trigger the `nullishCoalescingNotNullable` and `optionalChainNotNullable`
>   diagnostics on exisiting projects. You might want to disable those 2 diagnotiscs in your
>   `tsconfig` temporarily."*
> - *"data prefixed attribute no-longer bind inputs nor outputs."*
> - *"The compiler will throw when there a when inputs, outputs or model are binding to the same
>   input/outputs."*
> - *"`in` variables will throw in template expressions."*

**compiler-cli**
> - *"Elements with multiple matching selectors will now throw at compile time."*

**core**
> - *"The second arguement of appRef.bootstrap does not accept `any` anymore. Make sure the element
>   you pass is not nullable."*
> - *"\* TypeScript versions older than 6.0 are no longer supported."*
> - *"Leave animations are no longer limited to the element being removed."*
> - *"Component with undefined `changeDetection` property are now `OnPush` by default. Specify
>   `changeDetection: ChangeDetectionStrategy.Eager` to keep the previous behavior."*
> - *"change AnimationCallbackEvent.animationComplete signature"*
> - *"`ChangeDetectorRef.checkNoChanges` was removed. In tests use `fixture.detectChanges()`
>   instead."*
> - *"`createNgModuleRef` was removed, use `createNgModule` instead"*
> - *"`ComponentFactoryResolver` and `ComponentFactory` are no longer available. Pass the component
>   class directly to APIs that previously required a factory, such as
>   `ViewContainerRef.createComponent` or use the standalone `createComponent` function."*

**forms**
> - *"`min` and `max` validation rules no longer support string values. Bound values must be numbers
>   or null."*

**http**
> - *"Use the `HttpXhrBackend` with `provideHttpClient(withXhr)` if you want to keep supporting upload
>   progress reports."*

**platform-browser**
> - *"This removes styles when they appear to no longer be used by an associated `host`. However other
>   DOM on the page may still be affected by those styles if not leveraging
>   `ViewEncapsulation.Emulated` or if those styles are used by elements outside of Angular,
>   potentially causing other DOM to appear unstyled."*
> - *"Hammer.js integration has been removed. Use your own implementation."*

**router**
> - *"The return type for `TitleStrategy.getResolvedTitleForRoute` was previously 'any' while the
>   actual return type could only be either `string` or `undefined`. The return type now reflects the
>   possible values correctly. Code that reads the value may need to be adjusted."*
> - *"The `currentSnapshot` parameter in `CanMatchFn` and the `canMatch` method of the `CanMatch`
>   interface is now required. While this was already the behavior of the Router at runtime, existing
>   class implementations of `CanMatch` must now include the third argument to satisfy the
>   interface."*
> - *"paramsInheritanceStrategy now defaults to 'always' — The default value of
>   paramsInheritanceStrategy has been changed from 'emptyOnly' to 'always'. This means that route
>   parameters are inherited from all parent routes by default. To restore the previous behavior, set
>   paramsInheritanceStrategy to 'emptyOnly' in your router configuration."*
> - *"`provideRoutes()` has been removed. Use `provideRouter()` or `ROUTES` as multi token if
>   necessary."*

**upgrade**
> - *"Deprecated `getAngularLib`/`setAngularLib` have been removed use
>   `getAngularJSGlobal`/`setAngularJSGlobal` instead."*

⚠️ The typos (*"exisiting"*, *"diagnotiscs"*, *"arguement"*, *"when there a when"*, the stray `*`)
are in the source. **Quote them; do not correct inside a quote block.** The house rule about not
altering quoted text applies to upstream typos too.

### 18.3 The framework's v22 deprecations, verbatim

**22.0.0 → http**
> - *"`withFetch` is now deprecated, it can be safely removed."*
> - *"The `reportProgress` option is deprecated please use `reportUploadProgress` &
>   `reportDownloadProgress` instead."*

**22.0.1 (2026-06-10) → platform-server**
> - *"XHR support in `@angular/platform-server` is deprecated. Use standard `fetch` APIs instead."*

**22.1.0 (2026-07-29) → http**
> - *"`HttpClient.jsonp`, `HttpClientJsonpModule`, and related JSONP classes/functions are
>   deprecated. Use standard HTTP requests instead."*

🔴 **Deprecations land in patch and minor releases, not only in majors.** Three of the four above
did. That directly illustrates §17.5's *"A deprecation can be announced in any release, but the
removal … happens only in major release."* — and it is the single best reason to read patch
changelogs at all.

### 18.4 The CLI's v22.0.0 breaking changes, verbatim and complete

From the [`angular-cli` CHANGELOG](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md):

**(unscoped)**
> - *"Node.js v20 is no longer supported. The minimum supported Node.js versions are now v22.22.0 and
>   v24.13.1."*
> - *"The `@angular-devkit/architect-cli` package is no longer available. The `architect` CLI tool has
>   been moved to the `@angular-devkit/architect` package."*
> - *"The experimental `@angular-devkit/build-angular:jest` and
>   `@angular-devkit/build-angular:web-test-runner` builders have been removed."*

**@angular/build**
> - *"The `@angular/build:dev-server (ng serve)` now assigns the highest priority to the `PORT`
>   environment variable. This value will override any port configurations specified in `angular.json`
>   or via the `--port` command-line flag. This includes the default port 4200."*
> - *"`istanbul-lib-instrument` is now an optional peer dependency. Projects using karma with code
>   coverage enabled will need to ensure that istanbul-lib-instrument is installed. Note: `ng update`
>   will automatically add this dependency during the update process."*

**@angular/ssr**
> - *"The server no longer falls back to Client-Side Rendering (CSR) when a request fails host
>   validation. Requests with unrecognized 'Host' headers will now return a 400 Bad Request status
>   code. Users must ensure all valid hosts are correctly configured in the 'allowedHosts' option."*

🔴 **The `istanbul-lib-instrument` entry names its own migration** — *"`ng update` will automatically
add this dependency during the update process"* — and that migration is
`add-istanbul-instrumenter` in §07.3. **A breaking change and its migration, quoted from both ends.**
That is the single best worked example in the chunk.

🔴 **The removed experimental builders** (`jest`, `web-test-runner`) are §17.6's Experimental policy
in action: removed in a major, with no deprecation cycle, exactly as the policy allows.

### 18.5 The triage method a page should teach

Read the v22.0.0 list above and sort each entry into one of four buckets. This is the transferable
skill, and every bucket has examples in §18.2/§18.4:

| Bucket | How you find out | v22 examples |
|---|---|---|
| **The build refuses to start** | immediately | TypeScript < 6.0; Node 20 |
| **A compile error you have never seen** | first `ng build` | duplicate selectors; `in` in a template; `data-` attribute bindings; duplicate input/output |
| **A silent behaviour change** | 🔴 **never, unless you read for it** | `OnPush` default; `paramsInheritanceStrategy: 'always'`; `?.` returning `undefined`; unused-style removal |
| **A removal with a named replacement** | a `Cannot find name` error | `ComponentFactoryResolver`; `createNgModuleRef`; `provideRoutes()`; `ChangeDetectorRef.checkNoChanges` |

🔴 **Row three is the whole point of reading a changelog.** Rows one, two and four announce
themselves. Topic 01's `17c-the-v22-upgrade-wall.md` already prescribes the *order* to attack them
in and already flags `?.` as the one with no build-time signal — **link to it, do not restate its
list.**

### 18.6 Gotchas to write

- **Symptom:** the upgrade built cleanly and a view silently stopped updating. **Cause:** the
  `OnPush`-by-default breaking change (§18.2). **Fix:** `changeDetection:
  ChangeDetectionStrategy.Eager` as the changelog says — and then do it properly; link topic 01's
  `17c`.
- **Symptom:** route params that used to be absent now appear. **Cause:**
  `paramsInheritanceStrategy` default flip (§18.2). **Fix:** the changelog names the restore, quote
  it.
- **Symptom:** `ng serve` on the wrong port in CI. **Cause:** `PORT` now outranks everything
  (§18.4).
- **Symptom:** Karma coverage broke. **Cause:** `istanbul-lib-instrument` became an optional peer
  (§18.4). **Fix:** the migration adds it; if you skipped it, install it.
- **Symptom:** SSR returns 400 for a host that used to render. **Cause:** the host-validation change
  (§18.4). **Fix:** `allowedHosts`.
- **Symptom:** you read only the major's changelog and missed a deprecation. **Cause:** deprecations
  land in minors and patches (§18.3).

### 18.7 Interview questions

- **★ Which class of breaking change is the dangerous one, and why?** The silent behaviour change —
  nothing in the toolchain tells you (§18.5).
- **★ Give an example of a v22 breaking change that the framework fixes for you, and name the
  mechanism.** `istanbul-lib-instrument` → `add-istanbul-instrumenter`; or `HttpXhrBackend` →
  `http-xhr-backend` (§18.4, §07.2).
- **Where do you look for the breaking changes of a major?** The `## Breaking Changes` section of
  the release's CHANGELOG entry, grouped by package; `grep '^## Breaking Changes'` finds every major
  (§18.1).
- **Do deprecations only appear in majors?** No — three of v22's four appeared in 22.0.1 and 22.1.0
  (§18.3).
- **Two experimental builders were deleted in v22 with no deprecation period. Was that a policy
  violation?** No — the Experimental policy explicitly excludes them (§17.6, §18.4).

---

## Chunk 19 — Partial compilation, in one page

### 19.1 🔴 Read §0.4 first. This chunk must not become a second Master page.

`01-compiler-with-a-framework-attached/12f-partial-compilation-and-the-linker.md` already teaches
this mechanism at Master tier, with `compilationMode`, the `ɵɵngDeclare*` family, the
`separate_compilation.md` design doc, the Babel linker plugin and the "compiled once, linked N
times" thesis. Its own thesis paragraph is on disk and can be read directly.

`12g-version-skew-is-a-coded-concern.md` covers version skew.

**This topic is `Know` tier.** Its honest job is:
1. a one-paragraph orientation that names `ɵɵngDeclareComponent` and says why it exists;
2. a pointer to `12f` for the mechanism and `12g` for skew;
3. the **one thing `12f` explicitly does not cover** — what happens when the linker does *not*
   run — which is §19.2.

If a writer finds themselves quoting `separate_compilation.md`, they are duplicating `12f`.
🔴 **Report the overlap to the caller rather than resolving it alone** — the right answer may be to
delete topic 10 from the syllabus and point row 10 at `12f`.

### 19.2 The thing `12f` leaves open: the JIT fallback, and its error verbatim

`12f`'s own `> Verified:` line says, on disk:

> *"⚠️ **Explicitly not confirmed here:** the linker's own version-negotiation logic — how a partial
> declaration's minimum-version marker is handled — was **not** read for this topic."*

So the seam is: **what does a partial declaration do at runtime if nothing linked it?** It falls
back to JIT — and the error says so, in full. Verbatim from
[`packages/core/src/compiler/compiler_facade.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/compiler/compiler_facade.ts)
at `v22.1.5`, complete:

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

🔴 **This one function is the best artefact in the whole topic**, because it connects three of the
nine syllabus rows at once:

- **Partial compilation** — `JitCompilerUsage.PartialDeclaration` and the sentence *"The `<kind>` is
  part of a library that has been partially compiled."*
- **JIT vs AOT** — *"JIT compilation is discouraged for production use-cases! Consider using AOT mode
  instead."* and the two named platforms.
- **Dev-mode-only behaviour** — the entire diagnostic is inside
  `if (typeof ngDevMode === 'undefined' || ngDevMode)`, and production gets the four-word
  **`JIT compiler unavailable`**.

Chunks 20 and 21 both quote from it. That is fine; each should quote the branch it owns and
cross-link.

**Exact strings for the error table:**
`JIT compilation failed for <kind>` (a `console.error`, not part of the thrown message) ·
`The <kind> '<Name>' needs to be compiled using the JIT compiler, but '@angular/compiler' is not
available.` · `The <kind> is part of a library that has been partially compiled.` ·
`However, the Angular Linker has not processed the library such that JIT compilation is used as
fallback.` · `Ideally, the library is processed using the Angular Linker to become fully AOT
compiled.` · `JIT compilation is discouraged for production use-cases! Consider using AOT mode
instead.` · `Alternatively, the JIT compiler should be loaded by bootstrapping using
'@angular/platform-browser-dynamic' or '@angular/platform-server',` ·
`or manually provide the compiler with 'import "@angular/compiler";' before bootstrapping.` ·
`JIT compiler unavailable`

⚠️ **`'@angular/platform-browser-dynamic'` in that message is now a deprecated package** (§Chunk 20).
The error text has not caught up. Flag it on the page; do not fix the quote.

### 19.3 Where the linker lives — enough to point, not to teach

The linker's source tree at `v22.1.5`, from
`gh api "repos/angular/angular/git/trees/v22.1.5?recursive=1"`:

```
packages/compiler-cli/linker/README.md
packages/compiler-cli/linker/index.ts
packages/compiler-cli/linker/babel/index.ts
packages/compiler-cli/linker/babel/src/babel_plugin.ts
packages/compiler-cli/linker/babel/src/es2015_linker_plugin.ts
packages/compiler-cli/linker/src/file_linker/file_linker.ts
packages/compiler-cli/linker/src/file_linker/needs_linking.ts
packages/compiler-cli/linker/src/file_linker/partial_linkers/partial_component_linker_1.ts
packages/compiler-cli/linker/src/file_linker/partial_linkers/partial_directive_linker_1.ts
packages/compiler-cli/linker/src/file_linker/partial_linkers/partial_factory_linker_1.ts
packages/compiler-cli/linker/src/file_linker/partial_linkers/partial_injectable_linker_1.ts
packages/compiler-cli/linker/src/file_linker/partial_linkers/partial_injector_linker_1.ts
packages/compiler-cli/linker/src/file_linker/partial_linkers/partial_class_metadata_linker_1.ts
packages/compiler-cli/linker/src/file_linker/partial_linkers/partial_class_metadata_async_linker_1.ts
```

⚠️ **I did not read any of these files.** The `_1` suffix pattern is visible in the paths and looks
like a per-declaration-version linker, but **that is an inference from a filename** — see §99.14.
`12f` is the page that already has the sourced version of this.

There is also `adev/src/content/examples/angular-linker-plugin/webpack.config.mjs` in the tree —
i.e. angular.dev documents using the linker in a custom webpack build. Point at
https://angular.dev/tools/libraries/creating-libraries for the library-authoring side rather than
re-deriving it.

### 19.4 Gotchas to write

- **Symptom:** `The <kind> '<Name>' needs to be compiled using the JIT compiler, but
  '@angular/compiler' is not available.` with *"part of a library that has been partially
  compiled"*. **Cause:** the linker did not process that library. **Fix:** the message states the
  intent — *"Ideally, the library is processed using the Angular Linker to become fully AOT
  compiled"*; in a CLI app the linker runs automatically, so the usual real cause is a custom build
  pipeline. Show the message and cite §19.2.
- **Symptom:** the same failure in production gives only `JIT compiler unavailable`. **Cause:** the
  `ngDevMode` guard (§19.2, §Chunk 21). **Fix:** reproduce in a development build.

### 19.5 Interview questions

- **★ A library on npm contains `ɵɵngDeclareComponent` calls. Why not finished instruction calls?**
  One-paragraph orientation, then hand off to `12f` (§19.1).
- **★ What happens at runtime if a partially-compiled library is never linked?** JIT fallback, and
  if `@angular/compiler` is absent, the error in §19.2 — which names the situation explicitly.
- **Why does the production build of that same failure say almost nothing?** §19.2's `ngDevMode`
  guard.

---

## Chunk 20 — JIT vs AOT

### 20.1 The two modes, verbatim

> | Angular compile | Details |
> |---|---|
> | Just-in-Time (JIT) | *"Compiles your application in the browser at runtime. This was the default until Angular 8."* |
> | Ahead-of-Time (AOT) | *"Compiles your application and libraries at build time. This is the default starting in Angular 9."* |
>
> *"When you run the `ng build` (build only) or `ng serve` (build and serve locally) CLI commands, the
> type of compilation (JIT or AOT) depends on the value of the `aot` property in your build
> configuration specified in `angular.json`. By default, `aot` is set to `true` for new CLI
> applications."*
> — https://angular.dev/tools/cli/aot-compiler

Corroborated from the schema:
[`application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
gives `aot` a **default of `true`** with the description *"Build using Ahead of Time compilation."*
🔴 **And `ng new` does not write an `aot` key at all** (§10.2) — the default carries it.

### 20.2 Why AOT — the five reasons, verbatim

> | Reasons | Details |
> |---|---|
> | Faster rendering | *"With AOT, the browser downloads a pre-compiled version of the application. The browser loads executable code so it can render the application immediately, without waiting to compile the application first."* |
> | Fewer asynchronous requests | *"The compiler inlines external HTML templates and CSS style sheets within the application JavaScript, eliminating separate ajax requests for those source files."* |
> | Smaller Angular framework download size | *"There's no need to download the Angular compiler if the application is already compiled. **The compiler is roughly half of Angular itself**, so omitting it dramatically reduces the application payload."* |
> | Detect template errors earlier | *"The AOT compiler detects and reports template binding errors during the build step before users can see them."* |
> | Better security | *"AOT compiles HTML templates and components into JavaScript files long before they are served to the client. With no templates to read and no risky client-side HTML or JavaScript evaluation, there are fewer opportunities for injection attacks."* |
> — https://angular.dev/tools/cli/aot-compiler

🔴 **"The compiler is roughly half of Angular itself"** is the number that ends the argument. Quote
it exactly and attribute it.

### 20.3 The type-level statement: `@angular/compiler` is an *optional* peer

From §12.4, verbatim: `@angular/core@22.1.5` lists `"@angular/compiler": "22.1.5"` under
`peerDependencies` **and** `{"@angular/compiler": {"optional": true}}` under
`peerDependenciesMeta`.

🔴 **That is AOT-by-default expressed in the manifest**: the compiler is not required to run
Angular. And yet the `ng new` scaffold puts `@angular/compiler` in `dependencies` (§14.6) — because
`TestBed` needs it (§20.5). Two facts, one paragraph, no speculation beyond that.

### 20.4 🔴 `platform-browser-dynamic` is DEPRECATED in v22 — the syllabus row is out of date

The syllabus says JIT still exists in *"`TestBed`, `platform-browser-dynamic`"*. Both are still
true, but the second now carries a deprecation the page must state.

**npm**, verbatim from `https://registry.npmjs.org/@angular/platform-browser-dynamic/22.1.5`:

```json
{
  "version": "22.1.5",
  "deprecated": "@angular/platform-browser-dynamic is deprecated. Use `@angular/platform-browser` instead."
}
```

**The source's own JSDoc**, verbatim from
[`packages/platform-browser-dynamic/src/platform_providers.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser-dynamic/src/platform_providers.ts)
at `v22.1.5`:

```ts
/**
 * @deprecated Use the `platformBrowser` function instead from `@angular/platform-browser`.
 * In case you are not in a CLI app and rely on JIT compilation, you will also need to import `@angular/compiler`
 */
export const platformBrowserDynamic: (extraProviders?: StaticProvider[]) => PlatformRef =
  createPlatformFactory(
    platformBrowser,
    'browserDynamic',
    INTERNAL_BROWSER_DYNAMIC_PLATFORM_PROVIDERS,
  );
```

🔴 **The second sentence of that JSDoc is the migration path in one line**: `platformBrowser` +
`import '@angular/compiler'` replaces `platformBrowserDynamic`.

**The golden confirms the whole package is deprecated surface**, verbatim from
[`goldens/public-api/platform-browser-dynamic/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/platform-browser-dynamic/index.api.md):

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

**Two of three exports deprecated; only `VERSION` is not.** That is a package with nothing left.

And what it actually provides, verbatim from the same source file — this is *all* JIT is,
mechanically:

```ts
const INTERNAL_BROWSER_DYNAMIC_PLATFORM_PROVIDERS: StaticProvider[] = [
  {
    provide: COMPILER_OPTIONS,
    useValue: {providers: [{provide: ResourceLoader, useClass: ResourceLoaderImpl, deps: []}]},
    multi: true,
  },
  {provide: CompilerFactory, useClass: JitCompilerFactory, deps: [COMPILER_OPTIONS]},
];
```

🔴 **Two providers.** A `ResourceLoader` (so `templateUrl` can be *fetched* at runtime — the thing
AOT inlines, §20.2) and a `CompilerFactory`. That is the entire difference between
`platformBrowserDynamic` and `platformBrowser`, and it makes §20.2's "fewer asynchronous requests"
row concrete.

Per §17.5, a deprecation announced in the v22 line is a removal candidate in **v23, ~June 2027**.

### 20.5 Where JIT genuinely survives: `TestBed`

`TestBed`'s public surface still carries the JIT seams, verbatim from
[`packages/core/testing/src/test_bed.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/testing/src/test_bed.ts)
at `v22.1.5`:

```ts
configureCompiler(config: {providers?: any[]; useJit?: boolean}): void;
```

```ts
/**
 * Compile components with a `templateUrl` for the test's NgModule.
 * It is necessary to call this function
 * as fetching urls is asynchronous.
 */
static compileComponents(): Promise<any> {
  return TestBedImpl.INSTANCE.compileComponents();
}
```

```ts
/**
 * Overrides the template of the given component, compiling the template
 * in the context of the TestingModule.
 *
 * Note: This works for JIT and AOTed components as well.
 */
static overrideTemplateUsingTestingModule(component: Type<any>, template: string): TestBed {
```

🔴 **`overrideTemplateUsingTestingModule`'s note — *"This works for JIT and AOTed components as
well"* — is the cleanest evidence that a runtime compiler is present in tests.** You cannot override
a template at runtime without one.

And `compileComponents`'s doc comment — *"It is necessary to call this function as fetching urls is
asynchronous"* — is the `ResourceLoader` of §20.4 seen from the test side.

⚠️ **What I did NOT verify**, and a page must not assert: exactly how the Vitest/Karma builders make
`@angular/compiler` available to `TestBed` (an injected setup file, the scaffolded runtime
dependency of §14.6, or something else). See §99.15. The safe, sourced statement is: *the scaffold
lists `@angular/compiler` as a runtime dependency, and `TestBed` exposes APIs that require a runtime
compiler.*

### 20.6 Gotchas to write

- **Symptom:** an npm-install deprecation warning about `@angular/platform-browser-dynamic`.
  **Cause:** §20.4. **Fix:** the JSDoc's own one-liner — `platformBrowser` plus
  `import '@angular/compiler'` if you truly need JIT. Show both lines.
- **Symptom:** you want to ship JIT to reduce build time. **Cause/Fix:** *"The compiler is roughly
  half of Angular itself"* (§20.2), plus the security row. Quote both; do not editorialise further.
- **Symptom:** `templateUrl` works in tests and you assume it works in production. **Cause:** AOT
  inlines it (§20.2); JIT fetches it (§20.4's `ResourceLoader`).
- **Symptom:** a runtime error names `@angular/platform-browser-dynamic` as a fix. **Cause:** the
  error text in §19.2 predates the deprecation (§20.4). **Fix:** import `@angular/compiler`
  directly, which the same message also offers.
- **Symptom:** `aot` is nowhere in your `angular.json` and you want to confirm AOT is on.
  **Cause/Fix:** the schema default is `true` (§20.1).

### 20.7 Interview questions

- **★ Why is JIT not a deployment option?** Payload (*"roughly half of Angular itself"*), latency,
  late error detection, and the injection-surface argument — all four quoted in §20.2.
- **★ Where does JIT still exist in a v22 project?** `TestBed` (§20.5), and the deprecated
  `platformBrowserDynamic` (§20.4). Naming the deprecation is part of a correct answer in 2026.
- **What does `platformBrowserDynamic` actually add over `platformBrowser`?** Exactly two providers:
  a `ResourceLoader` and a `JitCompilerFactory` (§20.4).
- **`@angular/compiler` is an *optional* peer of `@angular/core` but a *runtime dependency* of a
  scaffolded app. Explain.** §20.3 + §14.6 + §20.5.
- **When could `@angular/platform-browser-dynamic` be removed?** No earlier than v23, ~June 2027
  (§17.5, §20.4).

---

## Chunk 21 — Dev-mode-only behaviour

### 21.1 `ngDevMode` — the declaration and its docstring, verbatim

[`packages/core/src/util/ng_dev_mode.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/util/ng_dev_mode.ts)
at `v22.1.5`:

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

🔴 **`ngDevMode` is not a boolean — it is an object of six hydration performance counters.** That is
the fact readers never guess, and it makes the *"cuts down on boilerplate"* comment legible.

🔴 **`?ngDevMode=false` in the URL turns it off**, and that is in the docstring. Proof, verbatim from
the same file:

```ts
const locationString = typeof location !== 'undefined' ? location.toString() : '';
…
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
```

⚠️ **It is a substring match on the whole URL**, so a query string, a hash, or a path containing
`ngDevMode=false` all trigger it. State that precisely — `indexOf(...) === -1` is right there.

### 21.2 Why it is a global and not an import — the comment says it

```ts
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

🔴 **The three-part idiom `typeof ngDevMode === 'undefined' || ngDevMode` appears in every
dev-mode guard in the framework** — §21.3, §21.4, §19.2 all use it. **"Undefined means on"** is the
design decision, stated in the comment: *"unless we are doing production build where we explicitly
set `ngDevMode == false` we should be helping the developer"*.

🔴 **And it is a bare global identifier, not a property access** — which is exactly what makes it
minifier-eliminable. The `enableProdMode` comment says so (§21.3).

### 21.3 `isDevMode()` and `enableProdMode()`, both verbatim

[`packages/core/src/util/is_dev_mode.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/util/is_dev_mode.ts)
at `v22.1.5`, complete:

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

🔴 **Three things, each worth a paragraph:**

1. **`isDevMode()` is one line of `ngDevMode`.** It is a public reader of the private global,
   nothing more. Reading it makes "how do I check dev mode?" a solved question forever.
2. **The `optimization` option is what sets production mode** — named in *both* JSDocs, and
   `optimization` defaults to `true` in the `application` builder (§11.6) and is set to `false` in
   the scaffolded `development` configuration (§10.2). 🔴 **That is the whole chain: `ng serve` →
   `development` configuration → `optimization: false` → `ngDevMode` truthy.** Four links, all
   sourced in this bank.
3. **The comment on `enableProdMode` explains the guard's shape**: *"The below check is there so when
   ngDevMode is set via terser `global['ngDevMode'] = false;` is also dropped."* — the guard exists
   so the minifier can delete the assignment too, not only the branch.

And *"Using this method is discouraged as the Angular CLI will set production mode when using the
`optimization` option."* is the sentence that answers "should I call `enableProdMode()`?" — no.

### 21.4 `provideNgReflectAttributes()` — the whole file, verbatim

[`packages/core/src/ng_reflect.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/ng_reflect.ts)
at `v22.1.5`:

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
```

🔴 **`provideNgReflectAttributes()` in a production build returns
`makeEnvironmentProviders([])` — an empty provider array.** The call site survives; the provider does
not. That is the single clearest example of "dev-mode-only" as a *shape*, not a runtime `if`.

🔴 **The token's own description string is dev-mode-guarded too**: `'NG_REFLECT_FLAG'` in
development, `''` in production. Topic 03's bank §0.7 already documented this pattern for error
messages — this is the same trick applied to a token, and a nice cross-link.

⚠️ **Precision, carried forward from topic 03's bank §99.8 and re-verified here:** the JSDoc says the
`ng-reflect-*` **attributes** *"are deprecated"*. The **function** carries no `@deprecated` tag.
Do not merge the two.

The value serialisation is worth showing because it explains a truncation people notice:

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

**30 characters, then truncated**, and the failure string
`[ERROR] Exception while trying to serialize the value` is exact.

And the attribute-name mangling:

```ts
export function normalizeDebugBindingName(name: string) {
  // Attribute names with `$` (eg `x-y$`) are valid per spec, but unsupported by some browsers
  name = camelCaseToDashCase(name.replace(/[$@]/g, '_'));
  return `ng-reflect-${name}`;
}
```

So `[myInput]` becomes `ng-reflect-my-input`, and `$`/`@` become `_`.

### 21.5 The other dev-mode-only surface this chunk should enumerate

Everything in this bank that is guarded by `ngDevMode`, each already quoted above:

| Behaviour | Guard | Section |
|---|---|---|
| The full JIT-failure message | `if (typeof ngDevMode === 'undefined' \|\| ngDevMode)`, else `JIT compiler unavailable` | §19.2 |
| `ng-reflect-*` attributes | the provider array is empty in production | §21.4 |
| The `NG_REFLECT_FLAG` token description | `''` in production | §21.4 |
| Hydration perf counters | they *are* `ngDevMode` | §21.1 |
| Framework assertions incl. unidirectional-data-flow | *"turns off assertions and other checks within the framework"* | §21.3 |

⚠️ **Topic 03 already owns `provideCheckNoChangesConfig`** (`03-the-provider-array/05-…`, developer
preview, dev-mode only). Link, do not duplicate.

⚠️ **Angular error messages carry a `Find more at …` suffix only in development** — topic 03's bank
§0.7 documents that machinery in full. Cross-link rather than re-deriving it.

### 21.6 Gotchas to write

- **Symptom:** `ng-reflect-*` attributes are in the DOM in development and gone in production, and a
  selector/test depended on them. **Cause:** §21.4 — the providers array is empty in production.
  **Fix:** stop depending on them; the JSDoc says they are deprecated and will stop being produced.
- **Symptom:** an `ng-reflect-*` value is cut off. **Cause:** the 30-character slice (§21.4).
- **Symptom:** dev-only assertions fire in a build you thought was production. **Cause:**
  `optimization: false` — the `development` configuration (§21.3, §10.2). **Fix:** `ng build`
  defaults to `production`; check `--configuration`.
- **Symptom:** production behaviour differs after adding `?ngDevMode=false` to a URL. **Cause:**
  §21.1 — a substring match on the whole URL. **Fix:** it is a debugging aid, not a deployment
  switch.
- **Symptom:** a `ReferenceError` on `ngDevMode` in a library. **Cause:** referencing the bare global
  before init (§21.2, and the linked issue 31595). **Fix:** the guard idiom the comment prescribes,
  shown verbatim.
- **Symptom:** you called `enableProdMode()` and nothing changed. **Cause:** the CLI already set it
  via `optimization` (§21.3). **Fix:** stop calling it; the JSDoc calls it discouraged.

### 21.7 Interview questions

- **★ What is `ngDevMode`, precisely?** A global that is either `false`, `undefined`, or an object of
  six hydration performance counters — and `undefined` counts as *on* (§21.1, §21.2).
- **★ What actually turns production mode on in an Angular CLI app?** The `optimization` build
  option, named in both `isDevMode` and `enableProdMode` JSDocs (§21.3). Not `enableProdMode()`,
  which the docs discourage.
- **★ What does `provideNgReflectAttributes()` do in a production build?** Returns an empty
  `EnvironmentProviders` — the provider is not merely inert, it is absent (§21.4).
- **How is `isDevMode()` implemented?** `typeof ngDevMode === 'undefined' || !!ngDevMode` — one line
  (§21.3).
- **Why is the guard written `typeof ngDevMode === 'undefined' || ngDevMode` everywhere rather than
  just `ngDevMode`?** To avoid a `ReferenceError` on an undeclared global, and so the minifier can
  eliminate both the branch and the assignment (§21.2, §21.3).
- **Are the `ng-reflect-*` attributes deprecated? Is the function?** The attributes are, per the
  JSDoc; the function carries no `@deprecated` tag (§21.4).

---

## 99 · UNSETTLED — do not guess these

Each was attempted once, at most. If a chunk needs one, either verify it or write *"the
documentation does not state whether X"*. 🔴 **Twenty pages stating an item as uncertain is a
correct outcome; twenty pages inventing twenty different confident answers is not.**

1. **The full list of on-demand migrations published on angular.dev.**
   `https://angular.dev/reference/migrations` is client-rendered; its prerendered HTML contains only
   three entries (NgStyle to Style Bindings, RouterTestingModule migration, CommonModule to
   standalone imports). §07.4's `collection.json` is the authority for the fifteen. **Do not claim
   the doc page lists exactly those fifteen** — I could not see the page. Same limitation applies to
   every `angular.dev/api/**` page: I read the *sources* and *goldens* instead.

2. **What `update.angular.dev` actually contains.** `https://angular.dev/update-guide` returned
   1,139 characters of shell — a client-rendered app. Every quote in this bank about the update
   guide is from the CLI source or `reference/releases`, never from the wizard. **Describe it as
   "the interactive Angular Update Guide" and link it; do not describe its steps.**

3. **Why `ng update` deletes `node_modules` for npm only.** The skip condition and its message
   (*"Cleaning not required for this package manager."*) are in the source (§03.4); no comment or
   doc explains the reasoning. Present the behaviour, not a rationale.

4. **Why a two-major jump would actually break, in the framework's own words.** §02.3's argument —
   migrations are version-sorted, not composed, and each assumes the previous major's shape — is my
   reading of `executeMigrations` and `compareMigrations`. I found **no** documentation sentence
   giving the reason. angular.dev states the rule (§02.2) but not the cause. **Write it as an
   inference from the code, explicitly labelled.**

5. **What `ng-update.requirements` does.** Declared in `UpdateMetadata` (§04.1) and populated by
   `_getUpdateMetadata`; I did not read the enforcement path and found no doc page. **Name the
   field; do not describe behaviour.**

6. **How `minReleaseAge` is configured** (§05.6). The mechanism is in the source; the configuration
   surface (`.npmrc`? an `angular.json` key? a CLI flag?) is not. **Describe the check; do not tell
   a reader how to turn it on.**

7. **Whether the `@angular/build:unit-test` builder's `[EXPERIMENTAL]` label has an angular.dev
   counterpart.** The label is in `builders.json` (§08.4) and the schematic default is `vitest`
   (§16.1). I did not find a doc page stating the stability level of the default test target.
   **Quote the `builders.json` description and the §17.6 policy; do not assert what the Angular team
   intends.**

8. **TypeScript 6.0's `strict` default — ✅ SETTLED 2026-09-09. This item is CLOSED.**
   ~~The release notes were not consulted.~~ **They have been.** A topic-07 author fetched
   `https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html` on 2026-09-09:
   the page exists, carries a *"Simple Default Changes"* section, and its sentences match the
   t07/t08 bank's §07.9a quotes word for word. The flip is now corroborated **twice** — the release
   notes, and independently `getStrictOptionValue` changing from `!!compilerOptions.strict` at
   `v5.9.2` to `compilerOptions.strict !== false` at `v6.0.2`.
   🔴 **Cite both. Do NOT write "the release notes were not consulted"** — repeating that is now
   itself a false provenance claim, in the opposite direction from the one this item was guarding
   against. Kept rather than deleted so a session that already read the old wording sees why it
   changed.

9. **What Angular's build system does with the root `tsconfig.json`'s `references` array** (§13.4).
   The schematic writes it; whether `@angular/build` runs TypeScript in project-references build mode
   is unread. **State that the array is written; do not describe its effect.**

10. **The NgModule variants of `main.ts` and `app.module.ts`** (`module-files/`). I listed the
    template paths but did not fetch their contents. If a chunk wants the `--standalone false`
    comparison, **fetch them first**:
    `packages/schematics/angular/application/files/module-files/src/main.ts.template` and
    `…/src/app/app__typeSeparator__module.ts.template` at `v22.1.7`.

11. **The generated `app.html` welcome page** (§15.4). `common-files/src/app/app__suffix__.html.template`
    is in the tree; **I never read it.** 🔴 **Do not describe the welcome screen.** Fetch it if a
    chunk needs it.

12. **What the `tailwind` schematic writes** (§16.3). The delegation is in the code and the version
    pins are in `latest-versions`; the schematic itself is unread. **Name the delegation; do not
    describe the output.**

13. **The `.prettierrc`, `README.md`, `.editorconfig` and `.vscode/*` template contents.** All four
    are in the template list (§14.2) and none was fetched. **Do not quote them.**

14. **The linker's partial-linker versioning** (§19.3). The `_1` suffix on
    `partial_component_linker_1.ts` etc. is a filename pattern I did not verify the meaning of.
    Topic 01's `12f` already flags the same gap in its own `> Verified:` line. **Do not resolve it
    here.**

15. **How `@angular/compiler` reaches `TestBed` under `@angular/build:unit-test`** (§20.5). I found
    no setup file, injected import or polyfill in the builder tree that does it. The safe statement
    is the two sourced facts (scaffold lists it as a dependency; `TestBed` exposes APIs needing a
    runtime compiler). **Do not assert a mechanism.**

16. **Whether the six `NgDevModePerfCounters` are readable by application code in a supported way**
    (§21.1). They are on a global `ngDevMode` object; nothing says they are public API. **Describe
    them as internal counters.**

17. **`NG_BUILD_CHUNKS_ROLLDOWN` as a supported switch** (§08.1). The source comment says
    *"This is useful for debugging and testing scenarios."* — that is all the support there is.
    **Do not present it as a configuration option.**

18. **Whether `deployUrl` works** (§09.7). The doc page says *"should be removed and is not
    supported"*; the v22 `application` schema still declares it. **Say both; recommend `<base href>`
    as the page does; do not claim to know which is right.**

19. **The exact publish date of `@angular/core@22.1.5`.** Changelog says 2026-09-02, the corpus says
    published 2026-09-03 (§0.1). I did not read the registry's `time` field. **If a date is
    load-bearing, fetch `https://registry.npmjs.org/@angular/core` and read `time['22.1.5']`.**

20. **Whether the EJS `<% } %><% else { %>` line in `app__suffix__.ts.template` is transcribed
    exactly** (§15.4). Everything else in that template was read directly; that one line should be
    re-fetched before being quoted verbatim on a page.

---

## 100 · Found, not fixed — defects outside this topic

Reported per the standing rule; **I changed nothing outside my one file.**

1. 🔴 **`angular.dev/reference/configs/workspace-config` is stale on builders.** It says the builder
   schemas *"are collected in the `@angular-devkit/build-angular` package"* — the package deprecated
   in v22 (§09.1). A v22 project's schemas are in `@angular/build`. Worth one sentence on Chunk 10
   noting the doc lag; **the source wins**, per the house rule.

2. ⚠️ **The same page uses `architect` throughout; the v22 schematic writes `targets`** (§10.6).
   Both are accepted. Any chunk quoting the page must say so, or a reader will not find the key in
   their own file.

3. ⚠️ **The same page's assets example uses `"input": "src/assets/"`; v22 scaffolds
   `"input": "<root>public"`** (§11.7, §10.2).

4. 🔴 **angular.dev contradicts the v22 schema on `deployUrl`.** The build-system-migration page says
   *"`deployUrl` should be removed and is not supported"*; `application/schema.json` at v22.1.7 still
   declares it with a description. §99.18.

5. ⚠️ **angular.dev's version-compatibility table says Angular 22 needs Node `^26.0.0`; the packages'
   `engines` say `>=26.0.0`** (§12.1, §12.3). npm enforces the manifest.

6. ⚠️ **`angular.dev/reference/configs/angular-compiler-options` says `strictInjectionParameters` is
   set *"When you use the Angular CLI command `ng new --strict`"*** — but `strict` defaults to `true`
   in v22 (§16.1), so it is set by default. The sentence predates the flip.

7. 🔴 **`angular.dev/reference/configs/file-structure` describes the pre-v22 scaffold**: it names
   `app.component.ts`, `app.component.html`, `app.component.css`, `app.component.spec.ts`,
   `app.module.ts`, `favicon.ico` at the top of `src/`, and says `app.config.ts` is *"Only generated
   when using the `--standalone` option"* when standalone is the default. §14.8 has the correction
   from the schematic templates.

8. 🔴🔴 **THE BIG ONE — this corpus's own syllabus and phase README are wrong about the release
   cadence.**
   - `docs/angular/syllabus/01-the-angular-model.md` line 37 says *"majors every six months (May/June
     and November), 6 months active support plus 12 months LTS"*.
   - **angular.dev says 12-month majors, 4–6 minors each, and 24 months of support (12 active + 12
     LTS)** — and adds *"Until Angular v22, Angular had a 6-month major release cycle, with 1-3 minor
     releases for each major release"* (§17.1).

   The syllabus row is a correct description of the **pre-v22** policy and an incorrect description
   of the current one. 🔴 **A chunk written from that row would be wrong on topic 09's headline
   fact.** Not mine to edit — reported. The same correction affects any other page in the corpus
   that states the cadence; I did not sweep for those.

9. ⚠️ **`docs/angular/pages/phase-0-how-angular-runs/README.md` says *"🚧 In progress — 1 of 12
   written, 2 more in flight (measured off disk 2026-09-06)"*.** By 2026-09-09 topics 01 and 03 are
   substantially larger. The count is stale; whoever lands topic 04 should re-measure it and make
   row 04 a link at the same time (§0.5).

10. 🔴 **Nine files in `01-compiler-with-a-framework-attached/` were over the 300-line cap while I
    worked** — reported repeatedly by the repo's own pre/post-tool hook on 2026-09-09, with the
    numbers changing between reports because another agent is actively writing there:
    `10g-calls-enums-and-the-values-in-between.md` (354), `10gc-dynamic-strings-and-enum-members.md`
    (374), `10h-syntax-the-evaluator-cannot-read.md` (307→313), `10i-the-field-shape-family.md`
    (512→354→335), `10id-the-imports-family.md` (423), `10if-selector-shape-and-the-missing-token.md`
    (350).
    🔴 **Per topic 03's bank §100.2, re-measure before acting on any cap claim** — that lane appears
    to be splitting as it goes, and several of these numbers fell while I watched. **Not mine to
    touch.**

11. ⚠️ **Topic 10 (Partial compilation, `Know`) overlaps a `Master`-tier page that already exists**
    (`01-…/12f-partial-compilation-and-the-linker.md`). §0.4 and §19.1 propose treating topic 10 as
    an orientation page plus the JIT-fallback material. 🔴 **The alternative — deleting the syllabus
    row and pointing it at `12f` — is a decision for whoever owns the syllabus, not for a chunk
    author.** Reported, not resolved.

12. ⚠️ **Topic 07 (TypeScript setup) similarly overlaps `13b-ngc-is-tsc-and-the-typescript-pin.md`
    and `14f`/`14g`.** §12.1 and §13.1 scope topic 07 to the *matrix* and the *file split* to avoid
    it. Same caveat: the boundary is proposed here, not agreed.

13. ⚠️ **The error message in `packages/core/src/compiler/compiler_facade.ts` recommends
    `'@angular/platform-browser-dynamic'`, a package deprecated in the same version** (§19.2,
    §20.4). Upstream inconsistency, not ours. Worth a sentence on the page that quotes it; **do not
    edit the quote.**
