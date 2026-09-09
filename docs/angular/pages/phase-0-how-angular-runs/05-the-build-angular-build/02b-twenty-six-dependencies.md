---
title: "Twenty-six runtime dependencies, twenty-five of them pinned exactly, and not one of them is webpack — the dependency list is the shortest complete proof of what the Angular build is"
sidebar_label: "02b · Twenty-six dependencies"
sidebar_position: 2.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against the **published manifest** of `@angular/build` **22.1.7**
> ([registry.npmjs.org/@angular/build/22.1.7](https://registry.npmjs.org/@angular/build/22.1.7))
> and of `@angular-devkit/build-angular` **22.1.7**
> ([registry.npmjs.org/@angular-devkit/build-angular/22.1.7](https://registry.npmjs.org/@angular-devkit/build-angular/22.1.7)),
> and the `22.1.0 (2026-07-29)` section of
> [CHANGELOG.md](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md) at tag
> `v22.1.7`. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**One JSON object answers what the Angular build is made of, and it takes ninety seconds to
read.** `@angular/build@22.1.7` declares twenty-six runtime dependencies. Four of them are the
bundler ecosystem — `esbuild`, `vite`, `rolldown`, `oxc-parser` — and `webpack` is not among the
twenty-six, nor is `webpack-dev-server`, nor any `*-loader`, nor `terser`. Twenty-five of the
twenty-six are **exact pins**, which is a deliberate posture rather than an accident, and it is
also why you cannot bump `esbuild` yourself when a scanner flags it.

## The dependency list, in full

Copied verbatim from the published manifest:

```json
"dependencies": {
  "esbuild": "0.28.2",
  "vite": "8.1.5",
  "rolldown": "1.2.0",
  "oxc-parser": "0.142.0",
  "sass": "1.101.0",
  "piscina": "5.2.0",
  "beasties": "0.4.3",
  "listr2": "11.0.0",
  "watchpack": "2.5.2",
  "browserslist": "^4.26.0",
  "magic-string": "1.0.0",
  "@babel/core": "8.0.1",
  "@ampproject/remapping": "2.3.0",
  "@vitejs/plugin-basic-ssl": "2.3.0",
  "@angular-devkit/architect": "0.2201.7",
  "parse5-html-rewriting-stream": "8.0.1",
  "@babel/helper-annotate-as-pure": "8.0.0",
  "@babel/helper-split-export-declaration": "7.24.7",
  "@inquirer/confirm": "6.1.1",
  "https-proxy-agent": "9.1.0",
  "jsonc-parser": "3.3.1",
  "mrmime": "2.0.1",
  "picomatch": "4.0.5",
  "semver": "7.8.5",
  "source-map-support": "0.5.21",
  "tinyglobby": "0.2.17"
}
```

🔴 **Twenty-six entries and exactly one carries a range.** `browserslist` is `^4.26.0`; every other
dependency is an exact pin. The build system ships the precise bundler, parser and Sass compiler it
was tested against, and no lockfile resolution can drift them.

## What is absent is louder than what is present

No `webpack`. No `webpack-dev-server`, no `webpack-merge`, no `css-loader`, `sass-loader`,
`less-loader`, `babel-loader`, `postcss-loader`, `source-map-loader` or `resolve-url-loader`. No
`terser`. No `copy-webpack-plugin`, `mini-css-extract-plugin` or `license-webpack-plugin`.

Every one of those names **does** appear in the dependency list of
`@angular-devkit/build-angular@22.1.7` — the same version, published the same day, describing
itself as *"Angular Webpack Build Facade"*. Among its dependencies: `webpack: 5.109.2`,
`webpack-dev-server: 5.2.6`, `webpack-dev-middleware: 8.0.3`, `webpack-merge: 6.0.1`,
`terser: 5.49.0`, `css-loader: 7.1.4`, `sass-loader: 17.0.0`, `less-loader: 13.0.0`,
`babel-loader: 10.1.1`, `postcss-loader: 8.2.1`, `source-map-loader: 5.0.0`,
`resolve-url-loader: 5.0.0`, `copy-webpack-plugin: 14.0.0`, `mini-css-extract-plugin: 2.10.2`,
`license-webpack-plugin: 4.0.2`, `webpack-subresource-integrity: 5.1.0`,
`@ngtools/webpack: 22.1.7`, `@angular-devkit/build-webpack: 0.2201.7`, `esbuild-wasm: 0.28.2` —
**and `@angular/build: 22.1.7` itself.**

🔴 **The legacy package depends on the new one, not the other way round.** That direction is the
single most useful thing to know about the migration: moving off webpack is *subtraction*, not
substitution. [02d · The peer contract](02d-the-peer-contract.md) works through what that means for
your `package.json`.

## The four that carry the argument

| Package | Pinned at | What it is here | Evidence |
|---|---|---|---|
| `esbuild` | `0.28.2` | The bundler | angular.dev names esbuild as the bundler for `@angular/build:application` |
| `vite` | `8.1.5` | The development server | the migration guide lists *"esbuild and Vite"* as the new tooling |
| `rolldown` | `1.2.0` | A second, chunk-optimizing pass over esbuild's output | `22.1.0` changelog, below |
| `oxc-parser` | `0.142.0` | The JavaScript parser behind the optimization and i18n passes | `22.1.0` changelog, below |

The rolldown and oxc rows are new enough that most written material predates them. From the
`22.1.0 (2026-07-29)` section, `### @angular/build`, verbatim:

> *"| 585d08af8 | perf | default chunk optimization to use Rolldown |"*
> *"| 10dc30f9c | feat | migrate advanced optimization Babel plugins to oxc-parser + magic-string |"*
> *"| 917393a4c | feat | migrate i18n inliner to oxc-parser + magic-string |"*
> *"| 51f69276f | feat | enable chunk optimization for server builds |"*
> — [CHANGELOG.md](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md)

Four rows explaining four dependencies at once: `rolldown` and `oxc-parser` are load-bearing and
recent, `magic-string` is the source-editing library those oxc passes write through, and chunk
optimization now runs for server builds as well as browser ones.

🔴 **A production Angular build therefore runs two bundlers.** esbuild bundles; rolldown then
re-chunks what esbuild produced. When that second pass runs, when it does not, and what it changes
about your output is **04 · The Rolldown chunk optimizer** *(not written yet)*.

⚠️ **Babel did not leave.** `@babel/core` is still an exact dependency at `8.0.1`, with two Babel
helpers beside it. The changelog names *which* passes moved to oxc — the advanced-optimization
plugins and the i18n inliner — not all of them.

## The other twenty-two

Angular does not document what each dependency is for, and this table does not pretend otherwise:
the right-hand column is each library's **own** published purpose, not a claim from Angular's
documentation. It is here so that reading `npm ls` inside an Angular project stops being
mysterious.

| Group | Packages | What they are |
|---|---|---|
| Stylesheets | `sass`, `beasties` | The Sass compiler, bundled outright; and the critical-CSS inliner angular.dev names by name |
| Source transformation | `@babel/core`, `@babel/helper-annotate-as-pure`, `@babel/helper-split-export-declaration`, `magic-string`, `@ampproject/remapping` | The remaining Babel passes, string-level source edits, and source-map composition |
| Parallelism and watching | `piscina`, `watchpack` | A worker-thread pool and a file watcher |
| Targets | `browserslist` | Translated into an esbuild `target` — [03b](03c-browserslist-becomes-an-esbuild-target.md) |
| The builder contract | `@angular-devkit/architect` | The layer that invokes builders at all |
| Dev-server plumbing | `@vitejs/plugin-basic-ssl`, `https-proxy-agent`, `mrmime` | Self-signed HTTPS, proxying, MIME lookup |
| HTML | `parse5-html-rewriting-stream` | Streaming HTML rewriting, for `index.html` transforms |
| Terminal | `listr2`, `@inquirer/confirm` | Task-list rendering and a yes/no prompt |
| Small utilities | `jsonc-parser`, `picomatch`, `semver`, `source-map-support`, `tinyglobby` | JSON-with-comments parsing, glob matching, version comparison, source-mapped stack traces, globbing |

Two entries in that table are worth a second look. **`sass` is a direct dependency** while Less,
PostCSS and Tailwind are optional *peers* — a real asymmetry with real consequences, worked through
in [02d](02d-the-peer-contract.md). And **`@angular-devkit/architect` is versioned `0.2201.7`**, not
`22.1.7`. The devkit packages have long carried a `0.MMmm.p`-shaped number, and `0.2201.7` lines up
with major 22, minor 1, patch 7 — the same release train, written differently. ⚠️ No source was found for a
document that states that scheme normatively; treat the mapping as a reading of the number rather
than a rule you can cite.

## Gotchas

**★ Symptom: `npm ls webpack` finds webpack in a v22 application you never configured for
webpack.** Cause: `@angular/build` cannot pull it in — it has no webpack dependency at all — so
something else did, and it is almost always `@angular-devkit/build-angular`, dragged in by a
leftover builder string in one target or by a third-party schematic. Fix: find who asked for it,
then find the target that justifies it:

```bash
npm ls webpack
grep -n '"builder"' angular.json
```

Every `"builder"` line beginning `@angular-devkit/build-angular:` is a reason the webpack stack is
installed; **08 · Migrating off webpack** *(not written yet)* removes them.

**★ Symptom: a security scanner flags the `esbuild` or `vite` version and `npm audit fix` will not
move it.** Cause: `@angular/build` pins them **exactly** — `"esbuild": "0.28.2"`, not `^0.28.2` —
so there is no range for resolution to float. Fix: you can force one with an override, but you are
then running a combination Angular did not test, so treat it as temporary and record why:

```json
{
  "overrides": { "esbuild": "0.28.3" }
}
```

The durable fix is a patch bump of `@angular/build` itself, which is what `ng update` does — see
[04 · `ng update`, not `npm install`](../04-ng-update-not-npm-install/README.md).

**★ Symptom: you go looking for `terser` options to tune minification and there is nothing to
tune.** Cause: there is no terser in the dependency list, and minification is not a separately
configured tool here — it is one of the things the builder's `optimization` option turns on, per
that option's own schema description (*"Including minification of scripts and styles"*). Fix: the
toggle you have is `optimization`, not a minifier configuration — **topic 06 ·
`angular.json` anatomy** *(not written yet)* owns its shape:

```json
{ "optimization": { "scripts": false } }
```

**★ Symptom: you try to add a Vite plugin, or look for `vite.config.ts`, and find no way in.**
Cause: Vite is here as the **development server**, not as the bundler — production output is
esbuild's, and there is no Vite configuration file in an Angular workspace to extend. Fix: use the
extension points the builder actually declares, and read **05 · Vite is only the dev server**
*(not written yet)* before designing around Vite:

```bash
grep -rn "vite" angular.json || echo "nothing to configure here"
```

**Symptom: `@babel/core` shows up in your dependency tree and you conclude the build is still
Babel-based.** Cause: Babel is still there at `8.0.1`, but v22.1.0 moved the advanced-optimization
plugins and the i18n inliner to `oxc-parser` + `magic-string`. Fix: nothing to do — but do not
reason about build performance from Babel's presence alone, and do not add a `.babelrc` expecting
the Angular build to read it:

```bash
# a Babel config in an Angular workspace configures nothing in the Angular build
ls -1 .babelrc babel.config.js 2>/dev/null && echo "these are not read by @angular/build"
```

**Symptom: a dependency review asks why one build package needs a worker pool, an HTML rewriter and
an interactive prompt.** Cause: `@angular/build` carries `application`, `dev-server`,
`extract-i18n`, `karma`, `ng-packagr` and `unit-test` in one package —
[02c](02c-the-six-builders-it-declares.md) — so its dependency list is the union of six builders'
needs, not one. Fix: answer with the builder manifest rather than the dependency list:

```bash
node -p "Object.keys(require('./node_modules/@angular/build/builders.json').builders).join(', ')"
```

**Symptom: `@angular-devkit/architect` appears as `0.2201.7` and looks like an unrelated,
pre-1.0 package.** Cause: the devkit packages carry a `0.MMmm.p`-shaped version, so `0.2201.7`
reads as major 22, minor 1, patch 7 — the same release as `@angular/build@22.1.7`. Fix: read it as
a devkit version, and do not "upgrade" it independently:

```bash
npm view @angular-devkit/architect version
```

## Interview questions

**★ Which single fact most cleanly supports "the Angular build is not webpack"?**
The dependency list of `@angular/build@22.1.7`. It is twenty-six entries long and contains no
webpack package of any kind, while `@angular-devkit/build-angular@22.1.7` — the same version, the
same release — describes itself as *"Angular Webpack Build Facade"* and carries `webpack`,
`webpack-dev-server`, five loaders and `terser`. Two published manifests settle it without reading
a line of Angular source, which is why it is the argument worth memorising.

**★ Why are the dependency versions exact rather than ranged, and what does that mean for you?**
Twenty-five of the twenty-six are exact pins; only `browserslist` carries a caret. It means the
build system ships a known-tested bundler, parser and Sass compiler rather than whatever your
lockfile resolves — which is what you want from a build tool. The cost lands on you the day a
scanner flags `esbuild`: no range means no `npm audit fix`, and your options are a `package.json`
`overrides` entry that puts you on an untested combination, or a patch bump of `@angular/build`
through `ng update`. The second is the supported answer.

**★ How many bundlers run in a production Angular build at 22.1.x, and why?**
Two. esbuild bundles the application, and since v22.1.0 rolldown runs a second pass over the result
— the changelog row is *"default chunk optimization to use Rolldown"*, and the same release enabled
that pass for server builds. The reason the second pass exists is that esbuild's chunking is fast
but not maximally economical, and a rebundle can combine and restructure chunks. Knowing it exists
matters mostly because it explains why chunk counts and names can change when you toggle
optimization, which otherwise looks like a bug.

**`@babel/core` is still a dependency after v22.1.0 migrated plugins to `oxc-parser`. What should
you conclude?**
That the migration was partial and specific, not a rewrite. The changelog names two things that
moved — the advanced-optimization plugins and the i18n inliner — and Babel remains pinned at
`8.0.1` with two helper packages beside it, so some passes still go through it. The general lesson
is worth more than the specific one: a dependency list tells you what a tool *can* reach for, and a
changelog tells you what it *changed last release*. Neither alone supports a confident claim about
how a build works today.

**What does it tell you that `@angular-devkit/build-angular` depends on `@angular/build`?**
That they are not two competing implementations you choose between — the legacy package is a
superset that re-exposes the new builders and adds the whole webpack stack on top. Practically, a
project that keeps `@angular-devkit/build-angular` installed for one remaining webpack target is
paying for roughly twenty webpack packages it does not otherwise use, and the migration is
therefore a subtraction: change the builder strings, then delete the dependency.

{/* FOOTER */}
