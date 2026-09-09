---
title: "Your browserslist is translated into an esbuild `target` through an eight-name whitelist that silently drops everything else, keeps only the lowest version of each browser, and is the reason widening the list changes nothing"
sidebar_label: "03c · browserslist → esbuild target"
sidebar_position: 3.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against `angular/angular-cli` at tag `v22.1.7` —
> [`packages/angular/build/src/tools/esbuild/target.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/esbuild/target.ts)
> (the supported-browser set and its four normalisation comments, quoted verbatim) — and the
> browserslist section of angular.dev
> [Angular CLI builds](https://angular.dev/tools/cli/build).
> Documentation-validated; **no sandbox run** — no build was executed and no output is reproduced.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The single thing that decides which JavaScript syntax your build emits is a file most projects
never open, and it does not reach the bundler unchanged.** Your browserslist is *translated* into an
esbuild `target` through a whitelist of eight browser names, with everything outside that set
dropped without a word — no warning, no error, no entry in the target. That one fact explains the
most confusing result in this area: you add browsers to `.browserslistrc`, the downlevelling target
does not move, and nothing tells you why. Four further normalisation rules then rewrite the versions
that did survive, and each of them is a place where browserslist and esbuild disagree about what a
version string means.

## The default is Angular's own support matrix

> *"By default, the Angular CLI uses a `browserslist` configuration which [matches browsers
> supported by Angular](https://angular.dev/reference/versions#browser-support) for the current
> major version."*
>
> *"To override the internal configuration, run [`ng generate config
> browserslist`](https://angular.dev/cli/generate/config), which generates a `.browserslistrc`
> configuration file in the project directory matching Angular's supported browsers."*
> — [angular.dev/tools/cli/build](https://angular.dev/tools/cli/build)

⚠️ The two links inside that quote are site-relative on angular.dev; they are absolutised here so
they resolve, and they point at angular.dev, not at this site.

So a project with no `.browserslistrc` is not unconfigured — it is using Angular's list for its
major. Generating the file gives you the same set as a starting point, which is the right way round:
you begin from Angular's list and edit down.

## Eight names, and everything else is dropped

The translation lives in one file, and its whitelist is short enough to reproduce whole:

```ts
// https://esbuild.github.io/api/#target
const ESBUILD_SUPPORTED_BROWSERS: ReadonlySet<string> = new Set([
  'chrome', 'edge', 'firefox', 'ie', 'ios', 'node', 'opera', 'safari',
]);
```

Its own doc comment states the contract, verbatim:

> *"Transform browserlists result to esbuild target.*
> *Only the lowest version for each browser is returned to avoid issues with esbuild and rolldown
> when multiple versions of the same target engine are specified."*
> — [`target.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/esbuild/target.ts)

🔴 **A browserslist entry whose name is not in that set is skipped — silently.** The code's guard is
a bare `continue` when `ESBUILD_SUPPORTED_BROWSERS.has(browserName)` is false: no warning, no error,
no entry in the target. Names people commonly add that are **not** in the eight —
`samsung`, `and_chr`, `and_ff`, `op_mob`, `op_mini`, `electron`, `kaios`, `baidu` — therefore have
**zero effect on the downlevelling target**. They are valid browserslist names; they are just not
names esbuild's `target` understands.

⚠️ **`ie` being in that set is a fact about esbuild's namespace, not about Angular's support
matrix.** It does not mean an Angular 22 application supports Internet Explorer.

## The four normalisation rules

Each is a distinct transformation with its own comment in the source. Together they are the whole
translation.

**1 · iOS Safari is renamed.**

```ts
// browserslist uses the name `ios_saf` for iOS Safari whereas esbuild uses `ios`
if (browserName === 'ios_saf') { browserName = 'ios'; }
```

**2 · A version range collapses to its lower bound.**

```ts
// browserslist uses ranges `15.2-15.3` versions but only the lowest is required
// to perform minimum supported feature checks. esbuild also expects a single version.
[version] = version.split('-');
```

**3 · Safari Technology Preview becomes 999.**

```ts
// esbuild only supports numeric versions so `TP` is converted to a high number (999) since
// a Technology Preview (TP) of Safari is assumed to support all currently known features.
version = '999';
```

**4 · A lone major gains a `.0`.**

```ts
// A lone major version is considered by esbuild to include all minor versions. However,
// browserslist does not and is also inconsistent in its `.0` version naming. For example,
// Safari 15.0 is named `safari 15` but Safari 16.0 is named `safari 16.0`.
version += '.0';
```

Rule 4 is the one worth remembering as a general lesson: **browserslist and esbuild disagree about
what a version string means**, and the translation exists to reconcile two vocabularies rather than
to make a decision on your behalf.

## The instruction the documentation gives, and means

> *"Avoid expanding this list to more browsers. Even if your application code more broadly
> compatible, Angular itself might not be. You should only ever _reduce_ the set of browsers or
> versions in this list."*
> — [angular.dev/tools/cli/build](https://angular.dev/tools/cli/build)

*(The missing word in the second sentence is in the source; it is quoted as published.)*

That instruction and the eight-name whitelist point the same way. Expanding the list is at best
ineffective — if the name is outside the set, nothing happens — and at worst actively misleading,
because a name *inside* the set with an older version will lower your target and change your output
without making the framework itself work on that browser. **Reduction is the only direction with a
predictable result.**

## What this page does not cover

Two more defaults reshape the output **after** the bundle is written — critical CSS is inlined into
your HTML and font CSS is fetched over the network — and a third, the rolldown chunk-optimization
pass, re-chunks it. The first two are
[03d · Critical CSS and font inlining](03d-critical-css-and-font-inlining.md); the third is
[04 · The Rolldown chunk optimizer](04-the-rolldown-chunk-optimizer.md).

## Gotchas

**★ Symptom: you widen `.browserslistrc` and the emitted syntax does not change at all.** Cause: the
browser name is not one of esbuild's eight, so the translation drops it with a bare `continue` — no
warning is produced. Fix: use names from the supported set, and remember that the documentation's
instruction is to reduce rather than expand:

```
# .browserslistrc — names esbuild's target actually understands
chrome >= 120
edge >= 120
firefox >= 120
safari >= 16.0
```

**★ Symptom: two versions of the same browser are listed and the output targets the older one.**
Cause: by design — *"Only the lowest version for each browser is returned"*, to avoid ambiguity
between esbuild and rolldown when one engine appears twice. Fix: nothing to fix, but state your
floor deliberately rather than letting a query imply it:

```
# .browserslistrc — one explicit floor per engine beats an implicit one
safari >= 16.0
```

**★ Symptom: `safari TP` is in your browserslist and the target appears to require nothing at
all.** Cause: `TP` is converted to version `999`, on the assumption that a Technology Preview
supports every currently known feature — so it raises the Safari floor to something no real user
has. Fix: keep Technology Preview out of a build's browserslist; it belongs in a testing matrix,
not a compilation target:

```
# .browserslistrc — a real floor, not a preview
safari >= 16.0
```

**★ Symptom: `safari 15` and `safari 16.0` in the same file behave inconsistently.** Cause:
browserslist itself is inconsistent about `.0` naming — the source comment says so — and the
translation appends `.0` to a lone major so esbuild reads it the same way. Fix: write explicit
minor versions everywhere and remove the ambiguity:

```
safari >= 16.0
```

**Symptom: you add `electron 30` (or `samsung >= 12`) to support a specific runtime and nothing
changes.** Cause: neither name is in the eight-name set, so both are dropped. Fix: express the floor
through a browser esbuild knows — for an Electron target, the Chrome version it embeds:

```
# .browserslistrc — Electron's floor stated as the Chrome it ships
chrome >= 126
```

⚠️ You are responsible for mapping the runtime to the right Chrome version; the build system does
not do that for you and this page does not attempt to state a mapping.

**Symptom: your project has no `.browserslistrc` and someone claims it therefore has no browser
target.** Cause: Angular supplies an internal configuration matching its own supported browsers for
the current major. Fix: generate the file if you want it visible and editable, then edit downwards:

```bash
ng generate config browserslist
```

## Interview questions

**★ How does `.browserslistrc` affect an Angular build, exactly?**
It is translated into an esbuild `target`. The translation keeps only browsers whose names are in an
eight-entry whitelist — `chrome`, `edge`, `firefox`, `ie`, `ios`, `node`, `opera`, `safari` — renames
`ios_saf` to `ios`, collapses a version range to its lower bound, converts Safari `TP` to `999`, and
appends `.0` to a lone major. Anything else in the file is skipped without a warning. So the file is
not passed through: it is filtered and normalised, and the result is what actually decides which
JavaScript syntax is emitted.

**★ Why does adding a browser to browserslist sometimes do nothing at all?**
Because the name is not one esbuild's `target` recognises. `samsung`, `and_chr`, `op_mini`,
`electron` and friends are perfectly valid browserslist names, and the translation drops each of
them with a bare `continue` — no warning, no error. The failure mode is the worst kind: a
configuration change that looks applied, produces no diagnostic, and has no effect. The check is to
compare your names against the eight in `ESBUILD_SUPPORTED_BROWSERS`.

**★ The documentation says to "only ever reduce" the browser list. Why is that stronger advice than
it sounds?**
Two reasons, and they compound. First, expanding is usually ineffective for the reason above.
Second, and more seriously: your build target and the framework's support matrix are different
things. Lowering an entry that *is* in the whitelist really does change the emitted syntax — so you
will produce output that parses on an older browser while Angular itself may not run there. You have
then made the build tell you a comforting lie. Reducing the set can only make the output more
conservative, which is the direction with no surprises.

**★ Why does the translation keep only the lowest version of each browser?**
Because a `target` with two versions of the same engine is ambiguous, and the source says so
directly — *"to avoid issues with esbuild and rolldown when multiple versions of the same target
engine are specified."* Functionally, the lowest version is also the only one that matters: the
target expresses a *minimum* feature level, so the oldest supported version of an engine determines
what may be emitted. Note the mention of rolldown in that comment — the target has to satisfy both
bundlers in the pipeline, not just esbuild.

---

← Prev: [Eleven concerns, one process](03b-eleven-concerns-one-process.md) · Index: [Topic index](README.md) · Next → [Critical CSS and font inlining](03d-critical-css-and-font-inlining.md)
